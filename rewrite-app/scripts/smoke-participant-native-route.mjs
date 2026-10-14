import { observeParticipantCommandCompletions, assertNativeCommandCompletion } from "./participant-command-completion-smoke-observer.mjs";
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
const artifacts = await mkdtemp(join(tmpdir(), "testcenter-native-route-"));
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
const errors = [], checks = [], nativeRequests = [], observations = [], releases = [];
let browser, page;
const poll = async (predicate, message) => {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) { if (await predicate()) return; await delay(50); }
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
  const api = async (path, body, token) => {
    const response = await fetch(base + path, { method: body === undefined ? "GET" : "POST",
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { "content-type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    assert.ok(response.ok, `${path}: HTTP ${response.status}`); return response.json();
  };
  const operator = (await api("/api/v1/admin/auth/sign-in", { username: "demo-admin", password: "demo-admin-password" })).sessionToken;
  const workspaceKey = "owned-native-route", workspace = `/api/v1/tenants/demo-tenant/workspaces/${workspaceKey}`;
  await api("/api/v1/tenants/demo-tenant/workspaces", { workspaceKey, displayName: "Owned native route lifetime" }, operator);
  const content = JSON.parse(localDemoSourcePackage.sourceDocument), unit = content.bookletEntries[0].unitEntries[0];
  content.bookletEntries = ["first", "second"].map(key => ({ bookletKey: key, displayLabel: `${key} lifecycle booklet`,
    config: { ask_for_fullscreen: "OFF", lock_test_on_termination: "OFF", browserBehaviour: "standard" },
    unitEntries: [1, 2].map(index => ({ ...unit, unitKey: `${key}-${index}`, displayLabel: `${key} Unit ${index}` })) }));
  const source = await api(workspace + "/source-packages", { fileName: "native-route.json", mediaType: "application/json", contentStructure: content }, operator);
  const imported = await api(workspace + "/import-jobs", { sourcePackageId: source.sourcePackage.sourcePackageId }, operator);
  await api(workspace + `/content-releases/${imported.stagedContentRelease.contentReleaseId}/activate`, { activatedByActorId: "owned-native-route-browser" }, operator);
  await api(workspace + "/participant-roster", { rosterText: '<Testtakers><Group id="owned"><Login mode="run-hot-return" name="route-person"><Booklet>first</Booklet><Booklet>second</Booklet></Login></Group></Testtakers>' }, operator);
  browser = await chromium.launch({ headless: process.env.CI === "true" && process.env.UI_SMOKE_HEADFUL !== "true" });
  page = await browser.newPage({ viewport: { width: 1280, height: 720 }, locale: "de-DE" });
  page.on("pageerror", error => errors.push(String(error)));
  page.on("request", request => { if (new URL(request.url()).pathname.endsWith("/native-commands")) nativeRequests.push(request.postDataJSON()); });
  await page.goto(`${base}/app/participant?ui=original&tenantKey=demo-tenant&workspaceKey=${workspaceKey}`, { waitUntil: "networkidle" });
  // Real RouterLinks establish a preceding route for actual browser Back/Forward.
  await page.locator("#applicationPrivacyNoticeLink").click();
  await page.getByRole("link", { name: "Back to participant entry", exact: true }).click();
  await page.locator("#originalLoginName").fill("route-person");
  const signedIn = page.waitForResponse(response => new URL(response.url()).pathname.endsWith("/auth/sign-in") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Weiter", exact: true }).click(); const identity = await (await signedIn).json();
  const currentPath = `/api/v1/participant/sessions/${identity.participantSession.participantSessionId}/current-state`;
  const read = async runId => (await api(currentPath + (runId ? `?testRunId=${runId}` : ""), undefined, identity.sessionToken)).currentRunState.testRun;
  const repository = createSqliteFirstSliceRepository(file);
  const native = (keyword, args = []) => page.evaluate(({ keyword, args }) => window.tc[keyword](args), { keyword, args });
  const methods = () => page.waitForFunction(() => ["debug", "pause", "resume", "terminate", "goto"].every(key => typeof window.tc?.[key] === "function"));
  const player = () => page.frameLocator("iframe").locator("#demoPlayerAnswer");
  const journal = () => page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith("testcenter-rewrite:participant-native-command:v1:")).map(key => JSON.parse(localStorage.getItem(key))));
  const emptyJournal = () => poll(async () => (await journal()).length === 0, "The native journal was not drained");
  const mark = name => { checks.push(name); console.log(`participant_native_route=${name}:passed`); };
  const start = async key => { await page.locator(`#originalParticipantStarter mat-card[data-booklet-key="${key}"] button`).click(); await player().waitFor(); await methods(); };
  await start("first"); const first = await read();
  await player().fill("First trusted Ω");
  await poll(async () => parseVeronaUnitResponse((await read(first.testRunId)).unitResponses["first-1"])?.unitState.dataParts.answer === "First trusted Ω", "First trusted answer missing");
  const answers = run => ({ responses: run.unitResponses, clocks: run.unitResponseFieldTimestamps });
  const saved = answers(await read(first.testRunId));
  const unavailable = route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "owned_temporarily_unavailable" }) });
  await page.route("**/native-commands", unavailable);
  await native("goto", ["2"]); await poll(async () => (await journal()).some(entry => entry.prepared), "Prepared intent was not persisted");
  const queued = (await journal())[0], owner = queued.owner;
  assert.equal(queued.scope.testRunId, first.testRunId); assert.ok(!JSON.stringify(queued).includes(identity.sessionToken));
  await page.unroute("**/native-commands", unavailable); await page.reload({ waitUntil: "networkidle" });
  await methods(); await poll(async () => (await read(first.testRunId)).currentUnitKey === "first-2", "Reload did not deliver the captured goto");
  await emptyJournal();
  const delivered = nativeRequests.filter(request => request.deliveryId === queued.id);
  assert.ok(delivered.length >= 2); for (const request of delivered) assert.deepEqual(request, queued.request);
  assert.equal(await page.evaluate(() => sessionStorage.getItem("testcenter-rewrite:participant-native-owner:v1")), owner);
  assert.deepEqual(answers(await read(first.testRunId)), saved);
  mark("document-reload-retains-owner-and-exact-prepared-intent");

  const completionPackets = observeParticipantCommandCompletions(page);
  let lost = false;
  const lostResponse = async route => {
    const response = await route.fetch(); assert.equal(response.status(), 200);
    observations.push({ kind: "lost-receipt", application: (await response.json()).application });
    lost = true; await route.abort("failed");
  };
  await page.route("**/native-commands", lostResponse);
  await native("pause"); await poll(() => Promise.resolve(lost), "The owned lost receipt was not produced");
  const committed = (await journal())[0]; assert.ok(committed?.prepared); assert.equal((await read(first.testRunId)).status, "paused");
  await page.unroute("**/native-commands", lostResponse);
  const replay = page.waitForResponse(response => new URL(response.url()).pathname.endsWith("/native-commands") && response.request().postDataJSON().deliveryId === committed.id);
  await page.reload({ waitUntil: "networkidle" }); const replayed = (await (await replay).json()).application;
  assert.equal(replayed.applied, false); assert.equal(replayed.deliveryId, committed.id); await emptyJournal();
  await assertNativeCommandCompletion({ repository, run: first, request: committed.request, packets: completionPackets, poll });
  assert.deepEqual(answers(await read(first.testRunId)), saved);
  mark("reload-after-committed-lost-receipt-is-idempotent");

  await page.evaluate(() => { window.ownedRouteDocument = "same document Ω"; localStorage.setItem("owned-native-route-unrelated", "retained"); });
  await page.route("**/native-commands", unavailable);
  await native("resume"); await poll(async () => (await journal()).some(entry => entry.prepared), "Route test never queued resume");
  const canceled = (await journal())[0], beforeLeave = nativeRequests.length;
  await page.goBack(); await page.getByRole("heading", { name: "Privacy", exact: true }).waitFor();
  assert.equal(await page.evaluate(() => window.ownedRouteDocument), "same document Ω");
  assert.equal(await page.evaluate(() => ["debug", "pause", "resume", "terminate", "goto"].every(key => typeof window.tc?.[key] !== "function")), true);
  assert.equal((await journal()).length, 0, "Angular route destruction retained an effectful command");
  assert.equal(await page.evaluate(() => localStorage.getItem("owned-native-route-unrelated")), "retained");
  await page.unroute("**/native-commands", unavailable); await page.goForward(); await methods();
  await page.locator("#participantRoutePausedState").waitFor();
  await page.evaluate(() => dispatchEvent(new Event("online"))); await delay(1200);
  assert.equal(nativeRequests.length, beforeLeave); assert.equal((await read(first.testRunId)).status, "paused");
  assert.deepEqual(answers(await read(first.testRunId)), saved);
  observations.push({ kind: "canceled-on-spa-destruction", deliveryId: canceled.id, sameDocument: true, noReplayOnReentry: true });
  mark("angular-route-destruction-cancels-retry-and-reentry-cannot-replay-it");

  await native("resume"); await player().waitFor(); await emptyJournal();
  let releaseSave, saveHeld = false;
  const saveGate = new Promise(done => { releaseSave = done; }); releases.push(releaseSave);
  const heldSave = async route => { const response = await route.fetch(); assert.equal(response.status(), 200); saveHeld = true; await saveGate; try { await route.fulfill({ response }); } catch {} };
  await page.route("**/save-progress", heldSave); await player().fill("Second Unit drain Ω");
  await poll(() => Promise.resolve(saveHeld), "Trusted save was not held");
  const beforePrepare = nativeRequests.length; await native("goto", ["1"]);
  await poll(async () => (await journal()).some(entry => !entry.prepared), "Waiting native preparation was not journaled");
  await page.goBack(); await page.getByRole("heading", { name: "Privacy", exact: true }).waitFor();
  assert.equal((await journal()).length, 0); assert.equal(await page.evaluate(() => window.ownedRouteDocument), "same document Ω");
  releaseSave(); await page.unroute("**/save-progress", heldSave); await page.goForward(); await methods(); await player().waitFor();
  await page.evaluate(() => dispatchEvent(new Event("online"))); await delay(1200);
  assert.equal(nativeRequests.length, beforePrepare); const drained = await read(first.testRunId);
  assert.equal(drained.currentUnitKey, "first-2"); assert.equal(parseVeronaUnitResponse(drained.unitResponses["first-2"]).unitState.dataParts.answer, "Second Unit drain Ω");
  assert.deepEqual(drained.unitResponses["first-1"], saved.responses["first-1"]); assert.deepEqual(drained.unitResponseFieldTimestamps["first-1"], saved.clocks["first-1"]);
  mark("route-destruction-during-trusted-answer-drain-cannot-dispatch-goto");

  let releaseNative, nativeHeld = false;
  const nativeGate = new Promise(done => { releaseNative = done; }); releases.push(releaseNative);
  const heldNative = async route => {
    if (route.request().postDataJSON().keyword !== "pause") return route.continue();
    const response = await route.fetch(); assert.equal(response.status(), 200); nativeHeld = true;
    observations.push({ kind: "committed-before-destruction", application: (await response.json()).application });
    await nativeGate; try { await route.fulfill({ response }); } catch {}
  };
  await page.route("**/native-commands", heldNative); await native("pause");
  await poll(() => Promise.resolve(nativeHeld), "Committed native reply was not held"); assert.equal((await read(first.testRunId)).status, "paused");
  await page.goBack(); await page.getByRole("heading", { name: "Privacy", exact: true }).waitFor(); assert.equal((await journal()).length, 0);
  await page.goForward(); await methods(); await page.locator("#participantRoutePausedState").waitFor();
  await native("terminate"); await page.locator("#originalParticipantStarter mat-card").first().waitFor(); await start("second");
  const second = await read(); assert.notEqual(second.testRunId, first.testRunId);
  await player().fill("Other Booklet Ω");
  await poll(async () => parseVeronaUnitResponse((await read(second.testRunId)).unitResponses["second-1"])?.unitState.dataParts.answer === "Other Booklet Ω", "Second Run answer missing");
  const secondBefore = await read(second.testRunId), firstBefore = await read(first.testRunId), beforeLate = nativeRequests.length;
  releaseNative(); await page.unroute("**/native-commands", heldNative); await page.evaluate(() => dispatchEvent(new Event("online"))); await delay(1200);
  assert.equal(await page.evaluate(() => window.ownedRouteDocument), "same document Ω");
  assert.equal(nativeRequests.length, beforeLate); assert.deepEqual(await read(second.testRunId), secondBefore); assert.deepEqual(await read(first.testRunId), firstBefore);
  assert.equal(await player().inputValue(), "Other Booklet Ω"); assert.equal(new URL(page.url()).searchParams.get("testRunId"), second.testRunId);
  assert.deepEqual(await repository.listPendingParticipantRunCommands(first), []); assert.deepEqual(await repository.listPendingParticipantRunCommands(second), []);
  await page.screenshot({ path: join(artifacts, "replacement-controller.png"), fullPage: true });
  mark("committed-old-effect-stays-on-its-run-and-late-reply-cannot-project-on-replacement");
  assert.deepEqual(errors, []);
} catch (error) {
  await page?.screenshot({ path: join(artifacts, "failure.png"), fullPage: true }).catch(() => {});
  await writeFile(join(artifacts, "failure.json"), JSON.stringify({ error: String(error), stack: error.stack, checks, errors, nativeRequests,
    body: await page?.locator("body").innerText().catch(() => "") }, null, 2)); throw error;
} finally {
  for (const release of releases) release(); await page?.unrouteAll({ behavior: "wait" });
  await writeFile(join(artifacts, "native-route.json"), JSON.stringify({ checks, errors, nativeRequests, observations }, null, 2));
  await browser?.close();
  if (server.exitCode === null) { server.kill("SIGTERM"); await Promise.race([closed, delay(5_000)]); if (server.exitCode === null) server.kill("SIGKILL"); }
  await closed; gate.assertHealthy(); console.log("owned_api=shutdown");
}
