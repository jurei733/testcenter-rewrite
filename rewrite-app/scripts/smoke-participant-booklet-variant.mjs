import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

const frontendRoot = resolve(process.env.UI_SMOKE_FRONTEND_ROOT || ".");
await access(join(frontendRoot, "dist/apps/web/browser/index.html"));
const artifacts = await mkdtemp(join(tmpdir(), "testcenter-participant-variant-"));
process.stdout.write(`owned_artifacts=${artifacts}\n`);
const apiModule = pathToFileURL(resolve("apps/api/dist/apps/api/src/index.js")).href;
const server = spawn(process.execPath, ["--input-type=module", "-e", `
  import { createProductionApiServer } from ${JSON.stringify(apiModule)};
  const server = await createProductionApiServer();
  server.listen(0, "127.0.0.1", () => process.send({ port: server.address().port }));
  process.once("SIGTERM", () => server.close(() => process.exit(0)));
`], { cwd: frontendRoot, env: { ...process.env, PORT: "4310", FIRST_SLICE_STORE: "sqlite",
  FIRST_SLICE_SQLITE_FILE: join(artifacts, "store.sqlite"), FIRST_SLICE_BOOTSTRAP_DEMO: "true",
  FIRST_SLICE_OPERATOR_AUTH_REQUIRED: "true", FIRST_SLICE_PROOF_OF_WORK_SCOPES: "",
  FIRST_SLICE_XML_SCHEMA_PROFILE: "legacy-compatibility", REQUIRE_LOGIN_PASSWORD: "false" },
  stdio: ["ignore", "ignore", "inherit", "ipc"] });
let browser;
try {
  const port = await new Promise((done, reject) => {
    const timer = setTimeout(() => reject(new Error("Owned API startup timed out.")), 20_000);
    server.once("message", message => { clearTimeout(timer); done(message.port); });
    server.once("error", error => { clearTimeout(timer); reject(error); });
    server.once("exit", () => { clearTimeout(timer); reject(new Error("Owned API exited before ready.")); });
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  let operatorToken;
  const api = async (path, body) => {
    const response = await fetch(`${baseUrl}${path}`, { method: "POST",
      headers: { "content-type": "application/json", ...(operatorToken ? { authorization: `Bearer ${operatorToken}` } : {}) },
      body: JSON.stringify(body) });
    assert.ok(response.ok, `POST ${path}: ${response.status}`);
    return response.json();
  };
  operatorToken = (await api("/api/v1/admin/auth/sign-in", { username: "demo-admin", password: "demo-admin-password" })).sessionToken;
  const headful = ["1", "true", "yes", "on"].includes(String(process.env.UI_SMOKE_HEADFUL || "").toLowerCase());
  browser = await chromium.launch({ headless: process.env.CI === "true" && !headful });
  for (const ui of ["rewrite", "original"]) {
    const workspaceKey = `variant-${ui}`;
    await api("/api/v1/tenants/demo-tenant/workspaces", { workspaceKey, displayName: `Owned variant ${ui}` });
    const workspace = `/api/v1/tenants/demo-tenant/workspaces/${workspaceKey}`;
    const source = await api(`${workspace}/source-packages`, {
      fileName: "variant.json", mediaType: "application/json", contentStructure: { bookletEntries: [{
        bookletKey: "variant-booklet", displayLabel: "Preset variants",
        stateEntries: [{ stateKey: "level", displayLabel: "Level", options: [
          { optionKey: "advanced", displayLabel: "Advanced", conditions: [{
            source: { type: "Value", variableKey: "value", unitKey: "variant-unit", defaultValue: "0" },
            expression: { type: "greaterThan", value: "1" }
          }] },
          { optionKey: "beginner", displayLabel: "Beginner", conditions: [] }
        ] }],
        unitEntries: [{ unitKey: "variant-unit", displayLabel: "Variant response", content: "Owned exact-answer fixture" }]
      }] }
    });
    const imported = await api(`${workspace}/import-jobs`, { sourcePackageId: source.sourcePackage.sourcePackageId });
    await api(`${workspace}/content-releases/${imported.stagedContentRelease.contentReleaseId}/activate`, { activatedByActorId: "owned-variant-smoke" });
    await api(`${workspace}/participant-roster`, {
      rosterText: '<Testtakers><Group id="variant-group"><Login mode="run-hot-return" name="variant-browser">' +
        '<Booklet state="level:advanced">variant-booklet</Booklet><Booklet state="level:beginner">variant-booklet</Booklet>' +
        '</Login></Group></Testtakers>'
    });
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(String(error)));
    await page.goto(`${baseUrl}/app/participant?ui=${ui}&tenantKey=demo-tenant&workspaceKey=${workspaceKey}`, { waitUntil: "networkidle" });
    if (ui === "original") {
      await page.getByLabel("Anmeldename", { exact: true }).fill("variant-browser");
    } else {
      await page.locator("#participantLoginKey").fill("variant-browser");
    }
    const [signedIn] = await Promise.all([
      page.waitForResponse(response => new URL(response.url()).pathname === "/api/v1/participant/auth/sign-in" && response.request().method() === "POST"),
      ui === "original" ? page.getByRole("button", { name: "Weiter", exact: true }).click()
        : page.locator("#participantRouteSignInButton").click()
    ]);
    assert.equal(signedIn.status(), 200);
    const identity = await signedIn.json();
    const assignment = "variant-booklet#level:advanced";
    const select = async () => {
      if (ui === "original") await page.locator(`[data-booklet-key="${assignment}"] button`).click();
      else {
        await page.locator("#participantRouteBookletKey").selectOption(assignment);
        await page.locator("#participantRouteStartOrResumeButton").click();
      }
    };
    const launched = page.waitForResponse(response => /\/sessions\/[^/]+\/resume$/u.test(new URL(response.url()).pathname));
    await select();
    const first = await launched;
    assert.equal(first.status(), 200);
    const initial = (await first.json()).testRun;
    assert.equal(initial.bookletAssignmentKey, assignment);
    const textarea = page.locator("#participantRouteUnitResponse");
    await textarea.waitFor();
    const exactAnswer = `Exact browser answer: ä/β · ${ui}`;
    await textarea.fill(exactAnswer);
    await page.locator("#participantRouteReturnToStarterButton").click();
    await page.locator("#participantConfirmationContinueButton").waitFor();
    const returned = page.waitForResponse(response => new URL(response.url()).pathname === `/api/v1/participant/test-runs/${initial.testRunId}/return-to-starter`);
    await page.locator("#participantConfirmationContinueButton").click();
    const left = await returned;
    assert.equal(left.status(), 200);
    const paused = (await left.json()).testRun;
    assert.equal(paused.status, "paused");
    assert.deepEqual(paused.unitResponses, { "variant-unit": exactAnswer });
    if (ui === "original") await page.locator("#originalParticipantStarter").waitFor();
    else await page.locator("#participantRouteEntry").waitFor();
    const resumed = page.waitForResponse(response => /\/sessions\/[^/]+\/resume$/u.test(new URL(response.url()).pathname));
    await select();
    const again = await resumed;
    assert.equal(again.status(), 200);
    const run = (await again.json()).testRun;
    assert.equal(run.testRunId, initial.testRunId);
    assert.equal(run.bookletAssignmentKey, assignment);
    assert.deepEqual(run.presetBookletStates, { level: "advanced" });
    assert.deepEqual(run.unitResponses, { "variant-unit": exactAnswer });
    await textarea.waitFor();
    assert.equal(await textarea.inputValue(), exactAnswer);
    // The workspace-only URL is the login/starter entry, not a re-entry link.
    // Reopen the existing authenticated session through the supported link.
    await page.goto(`${baseUrl}/app/participant?ui=${ui}&participantSessionId=${encodeURIComponent(identity.participantSession.participantSessionId)}`, { waitUntil: "networkidle" });
    await textarea.waitFor();
    await page.waitForFunction(answer => document.querySelector("#participantRouteUnitResponse")?.value === answer, exactAnswer);
    await page.reload({ waitUntil: "networkidle" });
    await textarea.waitFor();
    await page.waitForFunction(answer => document.querySelector("#participantRouteUnitResponse")?.value === answer, exactAnswer);
    assert.equal(await textarea.inputValue(), exactAnswer);
    assert.equal(await page.locator("#participantRouteRunId").innerText(), initial.testRunId);
    await page.screenshot({ path: join(artifacts, `${ui}-resumed.png`) });
    assert.deepEqual(errors, []);
    await context.close();
    process.stdout.write(`participant_variant=${ui}: same assignment/run/answer after real starter return and hard reload\n`);
  }
} finally {
  await browser?.close().catch(() => undefined);
  if (server.exitCode === null) {
    const stopped = new Promise(done => server.once("exit", done));
    server.kill("SIGTERM");
    await Promise.race([stopped, delay(5_000)]);
    if (server.exitCode === null) { server.kill("SIGKILL"); await stopped; }
  }
  process.stdout.write("owned_api=shutdown\n");
}
