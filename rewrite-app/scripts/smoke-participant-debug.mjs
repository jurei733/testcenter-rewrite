import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import { createSqliteFirstSliceRepository } from "@testcenter-rewrite-app/sqlite-store";
import { parseVeronaUnitResponse } from "@testcenter-rewrite-app/contracts";
import { localDemoSourcePackage } from "../apps/api/dist/apps/api/src/local-demo-bootstrap.js";
import { createServerRequestFailureGate } from "./server-request-failure-gate.mjs";

// Actual production bundles, authenticated SQLite API and trusted Verona input.
// Source formatter/parser/config contracts are verified separately against pinned excerpts.
const root = resolve(process.env.UI_SMOKE_FRONTEND_ROOT || ".");
await access(join(root, "dist/apps/web/browser/index.html"));
const artifacts = await mkdtemp(join(tmpdir(), "testcenter-participant-debug-"));
console.log(`owned_artifacts=${artifacts}`);
const file = join(artifacts, "owned.sqlite"), gate = createServerRequestFailureGate();
const module = pathToFileURL(resolve("apps/api/dist/apps/api/src/index.js")).href;
const server = spawn(process.execPath, ["--input-type=module", "-e", `
 import { createProductionApiServer } from ${JSON.stringify(module)};
 const server=await createProductionApiServer();
 server.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));
 process.once('SIGTERM',()=>server.close(()=>process.exit(0)));
`], { cwd: root, env: { ...process.env, FIRST_SLICE_STORE: "sqlite", FIRST_SLICE_SQLITE_FILE: file,
  FIRST_SLICE_BOOTSTRAP_DEMO: "true", FIRST_SLICE_OPERATOR_AUTH_REQUIRED: "true", FIRST_SLICE_PROOF_OF_WORK_SCOPES: "",
  FIRST_SLICE_XML_SCHEMA_PROFILE: "legacy-compatibility", REQUIRE_LOGIN_PASSWORD: "false" }, stdio: ["ignore", "pipe", "pipe", "ipc"] });
gate.observeStream(server.stdout); gate.observeStream(server.stderr);
const closed = new Promise(done => server.once("close", done));
const errors = [], checks = [], requests = [];
let browser, page, releaseSnapshot;
const poll = async (predicate, message) => {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) { if (await predicate()) return; await delay(100); }
  throw Error(message);
};
try {
  const port = await new Promise((done, reject) => {
    const timer = setTimeout(() => reject(Error("Owned API startup timed out")), 20_000);
    server.once("message", ({ port }) => { clearTimeout(timer); done(port); });
    server.once("error", error => { clearTimeout(timer); reject(error); });
    server.once("exit", () => { clearTimeout(timer); reject(Error("Owned API exited before startup")); });
  });
  const base = `http://127.0.0.1:${port}`;
  const api = async (path, body, token, method = body === undefined ? "GET" : "POST") => {
    const response = await fetch(base + path, { method, headers: { ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(body === undefined ? {} : { "content-type": "application/json" }) }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    assert.ok(response.ok, `${method} ${path}: ${response.status} ${await response.clone().text()}`); return response.json();
  };
  const operator = (await api("/api/v1/admin/auth/sign-in", { username: "demo-admin", password: "demo-admin-password" })).sessionToken;
  const workspaceKey = "owned-debug", workspace = `/api/v1/tenants/demo-tenant/workspaces/${workspaceKey}`;
  await api("/api/v1/tenants/demo-tenant/workspaces", { workspaceKey, displayName: "Owned debug browser" }, operator);
  const content = JSON.parse(localDemoSourcePackage.sourceDocument);
  // Keep the real Player startup metadata and protocol, changing only the owned response fixture.
  content.playerEntries[0].html = content.playerEntries[0].html
    .replace('dataParts: { answer: answer.value },', 'unitStateDataType: "iqb-standard@1.0", dataParts: { answer: JSON.stringify([{id:"x",status:"CODING_COMPLETE",value:answer.value,code:Number(answer.value),score:Number(answer.value)}]) },')
    .replace('answer.value = String(event.data.unitState?.dataParts?.answer || "");', 'try { answer.value = JSON.parse(event.data.unitState?.dataParts?.answer || "[]")[0]?.value || ""; } catch { answer.value = ""; }')
    .replace('<textarea id="demoPlayerAnswer"', '<button id="ownedDebugError">Owned runtime error</button><textarea id="demoPlayerAnswer"')
    .replace('answer.addEventListener("input", () => {', 'document.querySelector("#ownedDebugError").addEventListener("click",()=>parent.postMessage({type:"vopRuntimeErrorNotification",sessionId,code:"owned-debug-error",message:"Owned debug error"},"*")); answer.addEventListener("input", () => {');
  const unit = content.bookletEntries[0].unitEntries[0];
  content.bookletEntries = [{ bookletKey: "first", displayLabel: "First debug booklet", customTexts: { owned_token: "Booklet override Ω" },
    config: { toolbar_show_unit_list: "FALSE", toolbar_show_reload_button: "FALSE", toolbar_show_fullscreen_button: "FALSE", lock_test_on_termination: "OFF" },
    testletEntries: [{ testletKey: "timed", displayLabel: "Timed", parentTestletKey: null, restrictions: { timeMax: { minutes: 5, leave: "none" } } }],
    unitEntries: [{ ...unit, unitKey: "first-unit", originalUnitId: "original-first", displayLabel: "First unit", testletPath: ["timed"] },
      { ...unit, unitKey: "next-unit", displayLabel: "Next unit", testletPath: ["timed"] }],
    stateEntries: [{ stateKey: "level", displayLabel: "Level", options: [
      { optionKey: "high", displayLabel: "High", conditions: [{ source: { type: "Score", unitKey: "first-unit", variableKey: "x", defaultValue: "0" }, expression: { type: "greaterThan", value: "1" } }] },
      { optionKey: "base", displayLabel: "Base", conditions: [] }] }] },
    { bookletKey: "second", displayLabel: "Second debug booklet", unitEntries: [{ ...unit, unitKey: "second-unit", displayLabel: "Second only unit", unitDefinition: "Second private definition", originalUnitId: "original-second" }] }];
  const source = await api(workspace + "/source-packages", { fileName: "debug.json", mediaType: "application/json", contentStructure: content }, operator);
  const imported = await api(workspace + "/import-jobs", { sourcePackageId: source.sourcePackage.sourcePackageId }, operator);
  await api(workspace + `/content-releases/${imported.stagedContentRelease.contentReleaseId}/activate`, { activatedByActorId: "owned-debug-browser" }, operator);
  await api(workspace + "/participant-roster", { rosterText: '<Testtakers><Group id="owned"><Login mode="run-hot-return" name="debug-person"><Booklet>first</Booklet><Booklet>second</Booklet></Login></Group></Testtakers>' }, operator);
  browser = await chromium.launch({ headless: process.env.CI === "true" && process.env.UI_SMOKE_HEADFUL !== "true" });
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "de-DE" });
  page = await context.newPage();
  page.on("pageerror", error => errors.push(String(error)));
  page.on("request", request => { const url = new URL(request.url()); if (url.pathname.endsWith("/debug-state")) requests.push({ method: request.method(), run: url.searchParams.get("testRunId") }); });
  await page.goto(`${base}/app/participant?ui=original&tenantKey=demo-tenant&workspaceKey=${workspaceKey}`, { waitUntil: "networkidle" });
  await page.locator("#originalLoginName").fill("debug-person");
  const signedIn = page.waitForResponse(response => new URL(response.url()).pathname === "/api/v1/participant/auth/sign-in" && response.request().method() === "POST");
  await page.getByRole("button", { name: "Weiter", exact: true }).click(); const identity = await (await signedIn).json();
  const currentPath = `/api/v1/participant/sessions/${identity.participantSession.participantSessionId}/current-state`;
  const start = async key => { await page.locator(`#originalParticipantStarter mat-card[data-booklet-key="${key}"] button`).click(); await page.frameLocator("iframe").locator("#demoPlayerAnswer").waitFor(); await page.waitForFunction(() => typeof window.tc?.debug === "function"); };
  await start("first");
  const run = (await api(currentPath, undefined, identity.sessionToken)).currentRunState.testRun;
  const repository = createSqliteFirstSliceRepository(file);
  const durable = async () => ({ run: await repository.getTestRunById(run.testRunId), parent: await repository.getParticipantSessionById(identity.participantSession.participantSessionId) });
  const windowPane = key => page.locator(`[data-debug-window="${key}"]`), tabs = page.locator("[data-debug-tabs]");
  const debug = async args => page.evaluate(args => window.tc.debug(args), args);
  const mark = name => { checks.push(name); console.log(`participant_debug=${name}:passed`); };
  assert.equal(await tabs.count(), 0); assert.deepEqual(requests, []); mark("production-disabled-until-command");
  await debug([]); await tabs.waitFor(); await windowPane("main").waitFor();
  assert.equal(await page.locator("[data-debug-tab]").count(), 10); await poll(() => Promise.resolve(requests.length === 1), "Selected snapshot was not requested");
  const main = windowPane("main"); assert.match(await main.innerText(), /MODE:\s*RUN-HOT-RETURN/);
  const beforeDrag = await main.boundingBox(); await main.locator("h1").hover({ position: { x: 8, y: 8 } });
  await page.mouse.down(); await page.mouse.move(beforeDrag.x + 108, beforeDrag.y + 58); await page.mouse.up();
  const afterDrag = await main.boundingBox(); assert.ok(afterDrag.x > beforeDrag.x + 50 && afterDrag.y > beforeDrag.y + 25); mark("ten-tabs-and-native-drag");
  await page.getByRole("button", { name: "Close main", exact: true }).click();
  for (const key of ["config", "testmode", "booklet", "unit", "customtexts", "variables", "states", "system", "tools"]) {
    await page.locator(`[data-debug-tab="${key}"]`).click(); await windowPane(key).waitFor();
    if (key === "config") assert.match(await windowPane(key).innerText(), /toolbar_show_unit_list:.*FALSE/);
    if (key === "testmode") assert.match(await windowPane(key).innerText(), /modeId:.*RUN-HOT-RETURN/);
    if (key === "booklet") { await poll(async () => (await windowPane(key).innerText()).includes("first-unit"), "Booklet snapshot not projected"); await windowPane(key).getByRole("button", { name: "Toggle Testlet timed", exact: true }).click(); await poll(async () => /restrictions.timeMax/.test(await windowPane(key).innerText()), "Expanded Testlet did not render"); }
    if (key === "unit") assert.match(await windowPane(key).innerText(), /original-first/);
    if (key === "customtexts") {
      const input = windowPane(key).getByRole("combobox"); await input.fill("owned_token"); await input.press("Escape"); await poll(async () => /Booklet override Ω/.test(await windowPane(key).innerText()), "Selected custom text did not render");
      await input.click(); await page.getByRole("listbox", { name: "Custom text tokens" }).waitFor();
      const firstOption = await page.getByRole("option").first().innerText(); await input.press("ArrowDown"); await input.press("Enter"); await poll(async () => await input.inputValue() === firstOption, "Keyboard selection did not reach the input");
      await input.fill("toString"); await input.press("Escape"); assert.ok(!(await windowPane(key).innerText()).includes("native code"));
    }
    if (key === "system") { await windowPane(key).getByRole("button", { name: "Refresh", exact: true }).click(); await poll(async () => /API:\s*ok/.test(await windowPane(key).innerText()), "Actual API health check failed"); }
    if (key === "tools") { const input = windowPane(key).getByRole("textbox", { name: "Test Condition" }); await input.fill('<If><Score of="x" from="first-unit"/><Is equal="0"/></If>'); await poll(async () => (await windowPane(key).innerText()).includes("Satisfied"), "Condition did not evaluate"); await input.fill('<If><Value/></If>'); await poll(async () => /Missing field: 'Is'/.test(await windowPane(key).innerText()), "Condition parse error did not render"); await input.fill('<If><Value of="<img src=x onerror=alert(1)>"/></If>'); assert.equal(await windowPane(key).locator("img").count(), 0); }
    await page.screenshot({ path: join(artifacts, `debug-${key}.png`), fullPage: true });
    await page.getByRole("button", { name: `Close ${key}`, exact: true }).click();
  }
  await poll(async () => await page.locator("[data-debug-window]").count() === 0, "Closed windows did not render"); assert.equal(await page.evaluate(() => localStorage.getItem("tc-debug")), "[]"); mark("all-ten-windows-config-tools-customtexts");
  await page.locator('[data-debug-tab="variables"]').click();
  const frame = page.frameLocator("iframe"); await frame.locator("#demoPlayerAnswer").fill("2");
  await poll(async () => (await windowPane("variables").innerText()).includes("CODING_COMPLETE"), "Tracked variables not projected from trusted Player input");
  const storedValue = async () => JSON.parse(parseVeronaUnitResponse((await durable()).run.unitResponses["first-unit"])?.unitState.dataParts?.answer ?? "[]")[0]?.value;
  await poll(async () => await storedValue() === "2", "Actual SQLite response missing");
  const count = requests.length; await context.setOffline(true); await frame.locator("#demoPlayerAnswer").fill("3");
  await poll(async () => /"3"/.test(await windowPane("variables").innerText()), "Offline local capture missing in Variables");
  assert.equal(requests.length, count); await context.setOffline(false);
  await poll(async () => await storedValue() === "3", "Offline capture was not delivered after reconnect");
  mark("tracked-variables-offline-local-capture");
  await debug(["off"]); await tabs.waitFor({ state: "detached" }); assert.equal(await page.evaluate(() => localStorage.getItem("tc-debug")), null);
  const issue = async (type, args) => (await api(workspace + `/monitor/open-runs/${run.testRunId}/commands`, { commandType: type, ...(args ? { debugArguments: args } : {}) }, operator)).command;
  await issue("debug", ["on"]); await tabs.waitFor(); mark("remote-debug-through-real-receiver");
  await issue("pause"); await poll(async () => (await durable()).run.status === "paused", "Real monitor pause missing");
  await poll(async () => /STATUS:\s*PAUSED/.test(await windowPane("main").innerText()), "Pane did not show PAUSED");
  const paused = await durable(); const logPath = workspace + `/test-logs?testRunId=${run.testRunId}&logKey=command%20executed`;
  const prior = (await api(logPath, undefined, operator)).items.map(item => item.testLog);
  const logged = page.waitForResponse(response => new URL(response.url()).pathname === `/api/v1/participant/test-runs/${run.testRunId}/test-logs` && response.request().method() === "POST");
  await debug(["off", "Paused exact Ω"]); assert.equal((await logged).status(), 200); await tabs.waitFor({ state: "detached" });
  const logs = (await api(logPath, undefined, operator)).items.map(item => item.testLog);
  assert.equal(logs.length, prior.length + 1); assert.equal(logs.filter(log => log.logContent === "debug off Paused exact Ω").length, 1);
  assert.deepEqual(await durable(), paused); mark("paused-console-log-preserves-run-parent-and-timer");
  await issue("resume"); await poll(async () => (await durable()).run.status === "running", "Monitor resume missing");
  await debug([]); await tabs.waitFor(); await page.reload({ waitUntil: "networkidle" });
  await page.waitForFunction(() => typeof window.tc?.debug === "function"); assert.equal(await tabs.count(), 0); assert.equal(await page.evaluate(() => localStorage.getItem("tc-debug")), '["main"]'); mark("production-reload-does-not-restore-window");
  // A late response from the former selected Run must not enter the new pane.
  const firstResponses = (await durable()).run.unitResponses;
  await debug(["off"]); await tabs.waitFor({ state: "detached" });
  let held = false, snapshotReady = false, snapshotDone;
  const snapshotFinished = new Promise(done => { snapshotDone = done; });
  const snapshotGate = new Promise(done => { releaseSnapshot = done; });
  const snapshotRoute = async route => {
    if (new URL(route.request().url()).searchParams.get("testRunId") !== run.testRunId || held) return route.continue();
    held = true; const response = await route.fetch(); snapshotReady = true; await snapshotGate;
    try { await route.fulfill({ response }); } catch {} // The former pane aborts its own request on destruction.
    finally { snapshotDone(); }
  };
  await page.route("**/debug-state?*", snapshotRoute);
  await debug([]); await tabs.waitFor();
  await poll(() => snapshotReady, "Owned old snapshot was not intercepted");
  await page.locator("#participantApplicationLogoButton").click();
  await page.locator("#participantConfirmationContinueButton").click();
  await page.locator("#originalParticipantStarter mat-card").first().waitFor();
  await start("second"); assert.equal(await tabs.count(), 0);
  await debug([]); await tabs.waitFor(); await page.locator('[data-debug-tab="unit"]').click();
  await poll(async () => (await windowPane("unit").innerText()).includes("original-second"), "Second selected Unit did not load");
  releaseSnapshot(); releaseSnapshot = null;
  await snapshotFinished;
  await page.unroute("**/debug-state?*", snapshotRoute);
  assert.ok(!(await windowPane("unit").innerText()).includes("original-first"));
  assert.deepEqual((await durable()).run.unitResponses, firstResponses);
  mark("late-former-run-snapshot-cannot-enter-selected-booklet");
  const second = (await api(currentPath, undefined, identity.sessionToken)).currentRunState.testRun;
  assert.equal(second.bookletKey, "second"); assert.notEqual(second.testRunId, run.testRunId);
  const errorDurable = async () => ({ run: await repository.getTestRunById(second.testRunId), parent: await repository.getParticipantSessionById(identity.participantSession.participantSessionId) });
  await page.frameLocator("iframe").locator("#ownedDebugError").click(); await page.locator("mat-dialog-container, #participantRuntimeErrorFallback").waitFor();
  await poll(async () => /STATUS:\s*ERROR/.test(await windowPane("main").innerText()), "Debug status did not show ERROR");
  const errored = await errorDurable(); await debug(["off"]); await tabs.waitFor({ state: "detached" }); await debug([]); await tabs.waitFor();
  assert.deepEqual(await errorDurable(), errored); mark("console-debug-remains-pure-after-controller-error");
  await page.screenshot({ path: join(artifacts, "debug-error.png"), fullPage: true });
  assert.deepEqual(errors, []);
} catch (error) {
  await page?.screenshot({ path: join(artifacts, "failure.png"), fullPage: true }).catch(() => {});
  await writeFile(join(artifacts, "failure.json"), JSON.stringify({ error: String(error), stack: error.stack, checks, errors, requests, body: await page?.locator("body").innerText().catch(() => "") }, null, 2));
  throw error;
} finally {
  releaseSnapshot?.();
  await writeFile(join(artifacts, "debug.json"), JSON.stringify({ checks, errors, requests }, null, 2));
  await browser?.close();
  if (server.exitCode === null) { server.kill("SIGTERM"); await Promise.race([closed, delay(5_000)]); if (server.exitCode === null) { server.kill("SIGKILL"); await closed; } }
  await closed; gate.assertHealthy(); console.log("owned_api=shutdown");
}
