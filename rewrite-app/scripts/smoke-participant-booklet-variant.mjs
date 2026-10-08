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
let activeContext;
let activePage;
try {
  const port = await new Promise((done, reject) => {
    const timer = setTimeout(() => reject(new Error("Owned API startup timed out.")), 20_000);
    server.once("message", message => { clearTimeout(timer); done(message.port); });
    server.once("error", error => { clearTimeout(timer); reject(error); });
    server.once("exit", () => { clearTimeout(timer); reject(new Error("Owned API exited before ready.")); });
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  process.stdout.write(`owned_base_url=${baseUrl}\n`);
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
  browser = await chromium.launch({ headless: process.env.CI === "true" && !headful,
    channel: process.env.UI_SMOKE_BROWSER_CHANNEL || undefined });
  for (const ui of ["rewrite", "original"]) {
    const workspaceKey = `variant-${ui}`;
    await api("/api/v1/tenants/demo-tenant/workspaces", { workspaceKey, displayName: `Owned variant ${ui}` });
    const workspace = `/api/v1/tenants/demo-tenant/workspaces/${workspaceKey}`;
    const source = await api(`${workspace}/source-packages`, {
      fileName: "variant.json", mediaType: "application/json", contentStructure: { bookletEntries: [{
        bookletKey: "variant-booklet", displayLabel: "Preset variants",
        config: { browserBehaviour: "preventNav", toolbar_show_reload_button: "TRUE" },
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
    activeContext = context;
    await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
    const page = await context.newPage();
    activePage = page;
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
    const select = async (selectedAssignment = assignment) => {
      if (ui === "original") await page.locator(`[data-booklet-key="${selectedAssignment}"] button`).click();
      else {
        await page.locator("#participantRouteBookletKey").selectOption(selectedAssignment);
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
    const leave = async id => {
      await page.locator("#participantRouteReturnToStarterButton").click();
      await page.locator("#participantConfirmationContinueButton").waitFor();
      const response = page.waitForResponse(value => new URL(value.url()).pathname === `/api/v1/participant/test-runs/${id}/return-to-starter`);
      await page.locator("#participantConfirmationContinueButton").click();
      const result = await response;
      assert.equal(result.status(), 200);
      const payload = (await result.json()).testRun;
      assert.equal(payload.status, "paused");
      await page.locator(ui === "original" ? "#originalParticipantStarter" : "#participantRouteEntry").waitFor();
      return payload;
    };
    const enter = async selectedAssignment => {
      const response = page.waitForResponse(value => /\/sessions\/[^/]+\/resume$/u.test(new URL(value.url()).pathname));
      await select(selectedAssignment);
      const result = await response;
      assert.equal(result.status(), 200);
      const payload = (await result.json()).testRun;
      await textarea.waitFor();
      await page.waitForFunction(id => new URL(location.href).searchParams.get("testRunId") === id, payload.testRunId);
      assert.equal(new URL(page.url()).searchParams.get("bookletKey"), selectedAssignment);
      return payload;
    };
    await leave(initial.testRunId);
    // Both Runs are created through the actual guarded Starter workflow. No
    // repository seeding may stand in for starting the second unfinished test.
    const secondAssignment = "variant-booklet#level:beginner";
    const otherRun = await enter(secondAssignment);
    const otherRunId = otherRun.testRunId;
    assert.notEqual(otherRunId, initial.testRunId);
    assert.deepEqual(otherRun.presetBookletStates, { level: "beginner" });
    const secondAnswer = `Independent beginner bytes: 漢字/β · ${ui}`;
    await textarea.fill(secondAnswer);
    assert.deepEqual((await leave(otherRunId)).unitResponses, { "variant-unit": secondAnswer });
    assert.deepEqual((await enter(secondAssignment)).unitResponses, { "variant-unit": secondAnswer });
    await page.reload({ waitUntil: "networkidle" });
    await textarea.waitFor();
    await page.waitForFunction(answer => document.querySelector("#participantRouteUnitResponse")?.value === answer, secondAnswer);
    assert.equal(new URL(page.url()).searchParams.get("testRunId"), otherRunId);
    await leave(otherRunId);
    assert.deepEqual((await enter(assignment)).unitResponses, { "variant-unit": exactAnswer });
    // Exercise the actual Router guard after switching between two real Runs.
    // Native history is manipulated only to create Back/Forward destinations;
    // the application must restore its exact selected URL without reloading.
    const protectedUrl = page.url();
    const protectedPath = new URL(protectedUrl);
    assert.equal(protectedPath.searchParams.get("ui"), ui);
    const navigationDraft = `Unsaved protected navigation draft: ä/β · ${ui}`;
    await textarea.fill(navigationDraft);
    await page.evaluate(async path => {
      history.replaceState(history.state, "", "/app/runtime");
      history.pushState(history.state, "", path);
      await new Promise(done => {
        addEventListener("popstate", done, { once: true });
        history.back();
      });
    }, `${protectedPath.pathname}${protectedPath.search}`);
    await page.locator("#participantRouteNavigationNoticeTitle")
      .filter({ hasText: "Browser navigation disabled" }).waitFor();
    await page.waitForURL(protectedUrl);
    assert.equal(await textarea.inputValue(), navigationDraft);
    assert.equal(await page.locator("#participantRouteRunId").innerText(), initial.testRunId);
    await page.evaluate(async () => {
      history.pushState(history.state, "", "/app/runtime");
      await new Promise(done => {
        addEventListener("popstate", done, { once: true });
        history.back();
      });
    });
    await page.waitForURL(protectedUrl);
    await page.evaluate(() => new Promise(done => {
      addEventListener("popstate", done, { once: true });
      history.forward();
    }));
    await page.waitForURL(protectedUrl);
    assert.equal(await textarea.inputValue(), navigationDraft);
    assert.equal(await page.locator("#participantRouteRunId").innerText(), initial.testRunId);
    await page.screenshot({ path: join(artifacts, `${ui}-protected-navigation.png`) });
    await textarea.fill(exactAnswer);
    await Promise.all([
      page.waitForEvent("load"),
      // This raw-text extension uses the shared fallback Player in both modes;
      // Original Verona toolbar rendering has its own full browser acceptance.
      page.locator("#participantRouteReloadButton").click()
    ]);
    await textarea.waitFor();
    await page.waitForFunction(answer => document.querySelector("#participantRouteUnitResponse")?.value === answer, exactAnswer);
    assert.equal(page.url(), protectedUrl);
    assert.equal(await page.locator("#participantRouteRunId").innerText(), initial.testRunId);
    process.stdout.write(`participant_navigation=${ui}: prevented Back/Forward preserve exact Run URL and unsaved draft; shared fallback reload preserves saved answer and interface\n`);
    const sessionPath = `/api/v1/participant/sessions/${identity.participantSession.participantSessionId}`;
    const participantHeaders = { authorization: `Bearer ${identity.sessionToken}` };
    const saveOther = async answer => {
      const response = await fetch(`${baseUrl}/api/v1/participant/test-runs/${otherRunId}/save-progress`, {
        method: "POST", headers: { ...participantHeaders, "content-type": "application/json" },
        body: JSON.stringify({ responseUnitKey: "variant-unit", unitResponse: answer, status: "running" })
      });
      assert.equal(response.status, 200);
      assert.equal((await response.json()).testRun.unitResponses["variant-unit"], answer);
    };
    await saveOther(secondAnswer);
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
    const completedOther = await fetch(`${baseUrl}/api/v1/participant/test-runs/${otherRunId}/complete`, {
      method: "POST", headers: { ...participantHeaders, "content-type": "application/json" }, body: "{}"
    });
    assert.equal(completedOther.status, 200);
    const completedEntry = await fetch(`${baseUrl}${sessionPath}/resume`, {
      method: "POST", headers: { ...participantHeaders, "content-type": "application/json" },
      body: JSON.stringify({ bookletKey: secondAssignment })
    });
    assert.equal(completedEntry.status, 409);
    assert.equal((await completedEntry.json()).error, "booklet_already_completed");
    await page.reload({ waitUntil: "networkidle" });
    await textarea.waitFor();
    await page.waitForFunction(answer => document.querySelector("#participantRouteUnitResponse")?.value === answer, exactAnswer);
    assert.equal(await page.locator("#participantRouteRunId").innerText(), initial.testRunId,
      "Completing the other assignment must not close the unfinished selected Run.");
    await page.screenshot({ path: join(artifacts, `${ui}-resumed.png`) });
    assert.deepEqual(errors, []);
    await context.tracing.stop({ path: join(artifacts, `${ui}-trace.zip`) });
    await context.close();
    process.stdout.write(`participant_variant=${ui}: same assignment/run/answer after real starter return and hard reload\n`);
    process.stdout.write(`participant_selection=${ui}: two real unfinished Starter launches, exact URLs and hard reloads, scoped live acknowledgement, pause/resume, completion and background-save isolation\n`);

    // Non-saving entries share the same facade, but must not inherit the
    // read-only re-entry behavior that preserves saved A/B answers above.
    // Use real login, unlock and reload; never seed or reset repository data.
    const entryWorkspaceKey = `ephemeral-${ui}`;
    await api("/api/v1/tenants/demo-tenant/workspaces", {
      workspaceKey: entryWorkspaceKey, displayName: `Owned ephemeral ${ui}`
    });
    const entryWorkspace = `/api/v1/tenants/demo-tenant/workspaces/${entryWorkspaceKey}`;
    const entrySource = await api(`${entryWorkspace}/source-packages`, {
      fileName: "Booklet-entry.xml", mediaType: "application/xml",
      sourceDocument: '<Booklet><Metadata><Id>entry-booklet</Id><Label>Owned transient entry</Label></Metadata><Units>' +
        '<Testlet id="entry-block"><Restrictions><CodeToEnter code="ENTRY-CODE">Owned code</CodeToEnter>' +
        '<TimeMax minutes="5" leave="allowed"/></Restrictions><Unit id="entry-unit" label="Owned answer"><Definition>Owned response fixture</Definition></Unit></Testlet>' +
        '</Units></Booklet>'
    });
    const entryImport = await api(`${entryWorkspace}/import-jobs`, { sourcePackageId: entrySource.sourcePackage.sourcePackageId });
    await api(`${entryWorkspace}/content-releases/${entryImport.stagedContentRelease.contentReleaseId}/activate`, { activatedByActorId: "owned-entry-smoke" });
    const nonSavingModes = ["run-demo", "run-review", "run-simulation"];
    await api(`${entryWorkspace}/participant-roster`, {
      rosterText: '<Testtakers><Group id="entry-group">' + nonSavingModes.map(mode =>
        `<Login name="${mode}" mode="${mode}"><Booklet>entry-booklet</Booklet></Login>`).join("") + '</Group></Testtakers>'
    });
    for (const mode of nonSavingModes) {
      const entryContext = await browser.newContext({ viewport: { width: 1280, height: 800 } });
      activeContext = entryContext;
      await entryContext.tracing.start({ screenshots: true, snapshots: true, sources: true });
      const entryPage = await entryContext.newPage();
      activePage = entryPage;
      const entryErrors = [];
      entryPage.on("pageerror", error => entryErrors.push(String(error)));
      await entryPage.goto(`${baseUrl}/app/participant?${new URLSearchParams({ ui, tenantKey: "demo-tenant", workspaceKey: entryWorkspaceKey })}`, { waitUntil: "networkidle" });
      if (ui === "original") await entryPage.getByLabel("Anmeldename", { exact: true }).fill(mode);
      else await entryPage.locator("#participantLoginKey").fill(mode);
      const identityResponse = entryPage.waitForResponse(value =>
        new URL(value.url()).pathname === "/api/v1/participant/auth/sign-in" && value.request().method() === "POST");
      if (ui === "original") await entryPage.getByRole("button", { name: "Weiter", exact: true }).click();
      else await entryPage.locator("#participantRouteSignInButton").click();
      const entrySignedIn = await identityResponse;
      assert.equal(entrySignedIn.status(), 200);
      const entryIdentity = await entrySignedIn.json();
      const entrySessionPath = `/api/v1/participant/sessions/${entryIdentity.participantSession.participantSessionId}`;
      const readEntry = async () => {
        const value = await fetch(`${baseUrl}${entrySessionPath}/current-state`, {
          headers: { authorization: `Bearer ${entryIdentity.sessionToken}` }
        });
        assert.equal(value.status, 200);
        return (await value.json()).currentRunState;
      };
      await entryPage.locator("#participantRouteTestletUnlockCode").fill("ENTRY-CODE");
      await entryPage.locator("#participantRouteTestletUnlockButton").click();
      const entryAnswer = entryPage.locator("#participantRouteUnitResponse");
      await entryAnswer.waitFor();
      const transientAnswer = `Owned ephemeral answer ä/β · ${mode}/${ui}`;
      await entryAnswer.fill(transientAnswer);
      const beforeEntry = await readEntry();
      assert.equal(beforeEntry.executionMode.saveResponses, false);
      assert.equal(beforeEntry.testRun.currentUnitKey, "entry-unit");
      assert.deepEqual(beforeEntry.testRun.unlockedTestletKeys, ["entry-block"]);
      assert.ok(beforeEntry.testRun.testletTimers["entry-block"]);
      assert.deepEqual(beforeEntry.testRun.unitResponses, {});
      const entryRunId = beforeEntry.testRun.testRunId;
      assert.equal(new URL(entryPage.url()).searchParams.get("testRunId"), entryRunId);
      await entryPage.reload({ waitUntil: "networkidle" });
      const afterEntry = await readEntry();
      assert.equal(afterEntry.testRun.testRunId, entryRunId);
      assert.equal(afterEntry.testRun.currentUnitKey, null, "Non-saving hard reload must restore the code gate.");
      assert.deepEqual(afterEntry.testRun.unlockedTestletKeys, []);
      assert.deepEqual(afterEntry.testRun.testletTimers, {});
      assert.deepEqual(afterEntry.testRun.lockedTestletKeys, []);
      assert.deepEqual(afterEntry.testRun.lockedUnitKeys, []);
      assert.deepEqual(afterEntry.testRun.unitResponses, {});
      assert.equal(await entryPage.evaluate(answerValue =>
        Object.values(localStorage).some(value => value.includes(answerValue)), transientAnswer), false);
      await entryPage.locator("#participantRouteTestletUnlockCode").waitFor();
      assert.deepEqual(entryErrors, []);
      await entryPage.screenshot({ path: join(artifacts, `${ui}-${mode}.png`) });
      await entryContext.tracing.stop({ path: join(artifacts, `${ui}-${mode}-trace.zip`) });
      await entryContext.close();
      process.stdout.write(`participant_entry=${ui}/${mode}: exact Run, transient answer cleared, code gate and timers reset\n`);
    }
  }
} catch (error) {
  await activePage?.screenshot({ path: join(artifacts, "failure.png"), fullPage: true }).catch(() => undefined);
  await activeContext?.tracing.stop({ path: join(artifacts, "failure-trace.zip") }).catch(() => undefined);
  throw error;
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
