import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
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
    assert.notEqual(identity.sessionToken, operatorToken);
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
    const reentryLink = new URL(await page.locator("#participantRouteSessionAnchor").getAttribute("href"));
    assert.equal(reentryLink.searchParams.get("participantSessionId"), identity.participantSession.participantSessionId);
    assert.equal(reentryLink.searchParams.get("testRunId"), initial.testRunId);
    assert.equal(reentryLink.searchParams.get("bookletKey"), assignment);
    reentryLink.searchParams.set("ui", ui);
    // Seed another open assignment only in this owned repository. The general
    // second-starter-launch P0 is still blocked; this is selection proof, not
    // proof of that separate workflow. The writer process closes its own DB.
    const otherRunId = randomUUID();
    const otherRun = { ...run, testRunId: otherRunId,
      bookletAssignmentKey: "variant-booklet#level:beginner",
      presetBookletStates: { level: "beginner" }, bookletStates: { level: "beginner" },
      unitResponses: { "variant-unit": "Owned independent beginner answer" },
      updatedAt: new Date(Date.now() + 1).toISOString() };
    const writer = spawn(process.execPath, ["--input-type=module", "-e", `
      import { createSqliteFirstSliceRepository } from "@testcenter-rewrite-app/sqlite-store";
      let input = ""; for await (const chunk of process.stdin) input += chunk;
      await createSqliteFirstSliceRepository(${JSON.stringify(join(artifacts, "store.sqlite"))}).saveTestRun(JSON.parse(input));
    `], { cwd: process.cwd(), stdio: ["pipe", "ignore", "inherit"] });
    const written = new Promise((done, reject) => {
      writer.once("error", reject);
      writer.once("exit", code => code === 0 ? done() : reject(new Error(`Owned fixture writer exited ${code}.`)));
    });
    writer.stdin.end(JSON.stringify(otherRun));
    await written;
    const sessionPath = `/api/v1/participant/sessions/${identity.participantSession.participantSessionId}`;
    const participantHeaders = { authorization: `Bearer ${identity.sessionToken}` };
    const legacy = await fetch(`${baseUrl}${sessionPath}/current-state`, { headers: participantHeaders });
    assert.equal(legacy.status, 200);
    assert.equal((await legacy.json()).currentRunState.testRun.testRunId, otherRunId,
      "The selection fixture must really have a different latest run.");
    const eventPath = `${sessionPath}/events`;
    const [, channel, acknowledgement] = await Promise.all([
      page.goto(reentryLink.href, { waitUntil: "networkidle" }),
      page.waitForResponse(response => new URL(response.url()).pathname === eventPath &&
        new URL(response.url()).searchParams.get("testRunId") === initial.testRunId),
      page.waitForResponse(response => new URL(response.url()).pathname === `${eventPath}/acknowledgements` &&
        response.request().postDataJSON()?.testRunId === initial.testRunId)
    ]);
    assert.equal(channel.status(), 200);
    assert.equal(acknowledgement.status(), 200);
    await textarea.waitFor();
    await page.waitForFunction(answer => document.querySelector("#participantRouteUnitResponse")?.value === answer, exactAnswer);
    await page.reload({ waitUntil: "networkidle" });
    await textarea.waitFor();
    await page.waitForFunction(answer => document.querySelector("#participantRouteUnitResponse")?.value === answer, exactAnswer);
    assert.equal(await textarea.inputValue(), exactAnswer);
    assert.equal(await page.locator("#participantRouteRunId").innerText(), initial.testRunId);
    const saveOther = async answer => {
      const response = await fetch(`${baseUrl}/api/v1/participant/test-runs/${otherRunId}/save-progress`, {
        method: "POST", headers: { ...participantHeaders, "content-type": "application/json" },
        body: JSON.stringify({ responseUnitKey: "variant-unit", unitResponse: answer, status: "running" })
      });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).testRun.unitResponses["variant-unit"], answer);
    };
    const monitorPath = `${workspace}/monitor/open-runs/${initial.testRunId}/commands`;
    await api(monitorPath, { commandType: "pause", actorId: "owned-selection-smoke" });
    await saveOther("Owned background beginner update after advanced pause");
    await page.locator("#participantRouteStatus", { hasText: "paused" }).waitFor();
    assert.equal(await page.locator("#participantRouteRunId").innerText(), initial.testRunId);
    assert.equal(await textarea.count(), 0, "A selected monitor pause must remove answer editing.");
    await api(monitorPath, { commandType: "resume", actorId: "owned-selection-smoke" });
    await saveOther("Owned background beginner update after advanced resume");
    await textarea.waitFor();
    await page.waitForFunction(answer => document.querySelector("#participantRouteUnitResponse")?.value === answer, exactAnswer);
    assert.equal(await page.locator("#participantRouteRunId").innerText(), initial.testRunId);
    const latestOther = await fetch(`${baseUrl}${sessionPath}/current-state`, { headers: participantHeaders });
    assert.equal(latestOther.status, 200);
    assert.equal((await latestOther.json()).currentRunState.testRun.testRunId, otherRunId);
    await page.screenshot({ path: join(artifacts, `${ui}-resumed.png`) });
    assert.deepEqual(errors, []);
    await context.close();
    process.stdout.write(`participant_variant=${ui}: same assignment/run/answer after real starter return and hard reload\n`);
    process.stdout.write(`participant_selection=${ui}: owned two-run fixture, scoped live acknowledgement, pause/resume and background-save isolation\n`);
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
