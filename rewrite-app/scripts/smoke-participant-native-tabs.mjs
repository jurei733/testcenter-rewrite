import { observeParticipantCommandCompletions, assertNativeCommandCompletion } from "./participant-command-completion-smoke-observer.mjs";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import { createSqliteFirstSliceRepository } from "@testcenter-rewrite-app/sqlite-store";
import { parseVeronaUnitResponse } from "@testcenter-rewrite-app/contracts";
import { localDemoSourcePackage } from "../apps/api/dist/apps/api/src/local-demo-bootstrap.js";
import { createServerRequestFailureGate } from "./server-request-failure-gate.mjs";
import { verifyParticipantNativeCrashRecovery } from "./participant-native-crash-smoke.mjs";
import {waitForParticipantNativeTabReady, verifyNativeTabReadiness, nativeTabFailureEvidence} from './participant-native-tab-readiness.mjs';

// Actual production bundles, authenticated SQLite API and trusted Verona input.
// Source formatter/parser/config contracts are verified separately against pinned excerpts.
const root = resolve(process.env.UI_SMOKE_FRONTEND_ROOT || ".");
await access(join(root, "dist/apps/web/browser/index.html"));
const artifacts = await mkdtemp(join(tmpdir(), "testcenter-native-tabs-"));
const publicEvidence = process.env.UI_SMOKE_ARTIFACT_DIR ? resolve(process.env.UI_SMOKE_ARTIFACT_DIR, 'participant-native-tabs') : artifacts;
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
const errors = [], checks = [], nativeRequests = [], observations = [], releases = [], pages = [];
const pendingRequests = new Map();
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
  const workspaceKey = "owned-native-tabs", workspace = `/api/v1/tenants/demo-tenant/workspaces/${workspaceKey}`;
  await api("/api/v1/tenants/demo-tenant/workspaces", { workspaceKey, displayName: "Owned native tab ownership" }, operator);
  const content = JSON.parse(localDemoSourcePackage.sourceDocument), unit = content.bookletEntries[0].unitEntries[0];
  content.bookletEntries = ["first", "second"].map(key => ({ bookletKey: key, displayLabel: `${key} lifecycle booklet`,
    config: { ask_for_fullscreen: "OFF", lock_test_on_termination: "OFF", browserBehaviour: "standard" },
    unitEntries: [1, 2].map(index => ({ ...unit, unitKey: `${key}-${index}`, displayLabel: `${key} Unit ${index}` })) }));
  const source = await api(workspace + "/source-packages", { fileName: "native-route.json", mediaType: "application/json", contentStructure: content }, operator);
  const imported = await api(workspace + "/import-jobs", { sourcePackageId: source.sourcePackage.sourcePackageId }, operator);
  await api(workspace + `/content-releases/${imported.stagedContentRelease.contentReleaseId}/activate`, { activatedByActorId: "owned-native-tabs-browser" }, operator);
  await api(workspace + "/participant-roster", { rosterText: `<Testtakers><Group id="owned">${["tabs-person", "native-crash-queued", "native-crash-committed"].map(name => `<Login mode="run-hot-return" name="${name}"><Booklet>first</Booklet><Booklet>second</Booklet></Login>`).join("")}</Group></Testtakers>` }, operator);
  const repository = createSqliteFirstSliceRepository(file);
  const mark = name => { checks.push(name); console.log(`participant_native_tabs=${name}:passed`); };
  const track = (target, label) => { const active = new Set(); pages.push(target); target.on("request", request => {
    active.add(request);
    pendingRequests.set(request, label);
    if (new URL(request.url()).pathname.endsWith("/native-commands")) nativeRequests.push({ label, request: request.postDataJSON() });
  }); const finished = request => {active.delete(request); pendingRequests.delete(request);};
    target.on('requestfinished', finished); target.on('requestfailed', finished);
    target.on('close', () => {for (const request of active) pendingRequests.delete(request); active.clear();});
    target.on("pageerror", error => errors.push(String(error))); };
  await verifyParticipantNativeCrashRecovery({ base, workspaceKey, api, repository, artifacts, track, mark, observations });
  browser = await chromium.launch({ headless: process.env.CI === "true" && process.env.UI_SMOKE_HEADFUL !== "true" });
  await verifyNativeTabReadiness(browser, base, mark);
  page = await browser.newPage({ viewport: { width: 1280, height: 720 }, locale: "de-DE" });
  track(page, "source");
  await page.goto(`${base}/app/participant?ui=original&tenantKey=demo-tenant&workspaceKey=${workspaceKey}`, { waitUntil: "domcontentloaded" });
  // Real RouterLinks establish a preceding route for actual browser Back/Forward.
  await page.locator("#applicationPrivacyNoticeLink").click();
  await page.getByRole("link", { name: "Back to participant entry", exact: true }).click();
  await page.locator("#originalLoginName").fill("tabs-person");
  const signedIn = page.waitForResponse(response => new URL(response.url()).pathname.endsWith("/auth/sign-in") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Weiter", exact: true }).click(); const identity = await (await signedIn).json();
  const currentPath = `/api/v1/participant/sessions/${identity.participantSession.participantSessionId}/current-state`;
  const read = async runId => (await api(currentPath + (runId ? `?testRunId=${runId}` : ""), undefined, identity.sessionToken)).currentRunState.testRun;
  const native = (keyword, args = []) => page.evaluate(({ keyword, args }) => window.tc[keyword](args), { keyword, args });
  const methods = () => waitForParticipantNativeTabReady(page);
  const player = () => page.frameLocator("iframe").locator("#demoPlayerAnswer");
  const journal = () => page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith("testcenter-rewrite:participant-native-command:v1:")).map(key => JSON.parse(localStorage.getItem(key))));
  const emptyJournal = () => poll(async () => (await journal()).length === 0, "The native journal was not drained");
  const start = async key => { await page.locator(`#originalParticipantStarter mat-card[data-booklet-key="${key}"] button`).click(); await player().waitFor(); await methods(); };
  await start("first"); const first = await read();
  await player().fill("First trusted Ω");
  await poll(async () => parseVeronaUnitResponse((await read(first.testRunId)).unitResponses["first-1"])?.unitState.dataParts.answer === "First trusted Ω", "First trusted answer missing");
  const answers = run => ({ responses: run.unitResponses, clocks: run.unitResponseFieldTimestamps });
  const saved = answers(await read(first.testRunId));
  const context = page.context(), prefix = "testcenter-rewrite:participant-native-command:v1:";
  const ownerKey = "testcenter-rewrite:participant-native-owner:v1";
  const ownerOf = target => target.evaluate(key => sessionStorage.getItem(key), ownerKey);
  const journalOf = target => target.evaluate(prefix => Object.keys(localStorage).filter(key => key.startsWith(prefix)).map(key => JSON.parse(localStorage.getItem(key))), prefix);
  const allMethods = waitForParticipantNativeTabReady;
  const unavailable = route => route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "owned_temporarily_unavailable" }) });
  await context.route("**/native-commands", unavailable);
  await native("pause"); await poll(async () => (await journal()).some(entry => entry.prepared), "Source intent was not prepared");
  const queued = (await journal())[0], sourceOwner = await ownerOf(page), entry = page.url();
  assert.equal(sourceOwner, queued.owner);
  const openCopy = async label => {
    const opening = context.waitForEvent("page");
    await page.evaluate(() => window.open("about:blank", "_blank"));
    const copy = await opening; track(copy, label);
    assert.equal(await ownerOf(copy), await ownerOf(page), "The real popup must copy the original sessionStorage before the application starts");
    assert.equal(await copy.evaluate(() => Boolean(opener)), true);
    return copy;
  };
  const clone = await openCopy("clone"), cloneEntry = new URL(entry); cloneEntry.searchParams.set("ui", "rewrite");
  await clone.goto(cloneEntry.href, { waitUntil: "domcontentloaded" }); await allMethods(clone);
  assert.notEqual(await ownerOf(clone), sourceOwner, "A real cloned sessionStorage reused the source tab's native owner");
  await delay(1200);
  assert.deepEqual(nativeRequests.filter(item => item.label === "clone"), [], "The new tab replayed another tab's native intent");
  assert.deepEqual((await journalOf(clone)).find(item => item.id === queued.id), queued);
  assert.deepEqual(answers(await read(first.testRunId)), saved);
  mark("real-opener-tab-cannot-replay-or-remove-source-intents");
  observations.push({ kind: "opener-clone", sourceOwner, cloneOwner: await ownerOf(clone), exactSelectedRun: first.testRunId });

  await clone.evaluate(() => { opener = null; window.ownedCloneDocument = "clone document Ω"; });
  const cloneOwner = await ownerOf(clone);
  await clone.evaluate(() => window.tc.goto(["2"]));
  await poll(async () => (await journalOf(clone)).some(entry => entry.owner === cloneOwner && entry.prepared), "Clone intent was not prepared");
  const own = (await journalOf(clone)).find(entry => entry.owner === cloneOwner), beforeReload = nativeRequests.length;
  await clone.reload({ waitUntil: "domcontentloaded" }); await allMethods(clone); await delay(1200);
  assert.equal(await ownerOf(clone), cloneOwner); assert.equal(await clone.evaluate(() => opener), null);
  const afterReload = nativeRequests.slice(beforeReload).filter(item => item.label === "clone");
  assert.ok(afterReload.length > 0); for (const item of afterReload) assert.deepEqual(item.request, own.request);
  assert.deepEqual((await journalOf(clone)).find(entry => entry.id === queued.id), queued);
  mark("opener-removal-and-reload-restore-only-the-clones-own-packet");

  await clone.evaluate(() => { window.ownedCloneDocument = "same clone document Ω"; localStorage.setItem("owned-tabs-unrelated", "retained"); });
  await clone.locator("#applicationPrivacyNoticeLink").click();
  await clone.locator("app-public-info-page").getByRole("heading", { name: "Privacy", exact: true }).waitFor();
  assert.equal(await clone.evaluate(() => window.ownedCloneDocument), "same clone document Ω");
  assert.equal((await journalOf(clone)).some(entry => entry.id === own.id), false);
  assert.deepEqual((await journalOf(clone)).find(entry => entry.id === queued.id), queued, "Destroying the clone canceled the source's pending command");
  await clone.goBack(); await allMethods(clone); await clone.evaluate(() => dispatchEvent(new Event("online"))); await delay(1200);
  assert.equal((await journalOf(clone)).some(entry => entry.id === own.id), false);
  assert.equal(await clone.evaluate(() => localStorage.getItem("owned-tabs-unrelated")), "retained");
  await clone.screenshot({ path: join(artifacts, "separate-clone.png"), fullPage: true }); await clone.close();
  assert.deepEqual((await journal()).find(entry => entry.id === queued.id), queued);
  mark("destroying-and-reentering-the-clone-retains-the-source-journal");

  const completionPackets = observeParticipantCommandCompletions(page);
  // Keep old-document retries unavailable until the reload has committed.
  // Otherwise a timer can acknowledge and clear the intent between unroute
  // and the request checkpoint, leaving no retained intent for reload to prove.
  await page.reload({ waitUntil: "commit" });
  const sourceBeforeReload = nativeRequests.length;
  await context.unroute("**/native-commands", unavailable);
  await methods();
  await poll(async () => (await read(first.testRunId)).status === "paused", "Source reload did not deliver its retained pause"); await emptyJournal();
  assert.equal(await ownerOf(page), sourceOwner);
  const sourceReplay = nativeRequests.slice(sourceBeforeReload).filter(item => item.label === "source");
  assert.ok(sourceReplay.length > 0); for (const item of sourceReplay) assert.deepEqual(item.request, queued.request);
  assert.deepEqual(answers(await read(first.testRunId)), saved);
  await assertNativeCommandCompletion({ repository, run: first, request: queued.request, packets: completionPackets, poll });
  mark("the-originating-tab-still-reloads-and-delivers-its-exact-intent-once");

  await context.route("**/native-commands", unavailable); await native("resume");
  await poll(async () => (await journal()).some(entry => entry.prepared), "Source resume was not journaled"); const resume = (await journal())[0];
  const early = await openCopy("early-reload"); await early.evaluate(() => { opener = null; });
  // The other cases use the real worker. This case deliberately models an
  // uncached bootstrap download so it can be interrupted before any app code.
  const uncached = await context.newCDPSession(early);
  await uncached.send("Network.enable");
  await uncached.send("Network.setBypassServiceWorker", { bypass: true });
  observations.push({ kind: "pre-bootstrap-copy", serviceWorkerBypassedForThisDownload: true });
  let releaseBootstrap, heldBootstraps = 0;
  const bootstrapGate = new Promise(done => { releaseBootstrap = done; }); releases.push(releaseBootstrap);
  const heldBootstrap = async route => { heldBootstraps++; await bootstrapGate; try { await route.continue(); } catch {} };
  await early.route("**/main-*.js", heldBootstrap);
  await early.goto(entry, { waitUntil: "commit" }); await poll(() => Promise.resolve(heldBootstraps > 0), "The copied tab's bootstrap was not held");
  assert.equal(await early.evaluate(() => typeof window.tc), "undefined");
  await early.reload({ waitUntil: "commit" }); await poll(() => Promise.resolve(heldBootstraps > 1), "The pre-bootstrap reload was not held");
  releaseBootstrap(); await allMethods(early); await early.unroute("**/main-*.js", heldBootstrap); await delay(1200);
  assert.notEqual(await ownerOf(early), sourceOwner); assert.equal(await early.evaluate(() => opener), null);
  assert.deepEqual(nativeRequests.filter(item => item.label === "early-reload"), [], "Reload before bootstrap adopted the copied owner");
  assert.deepEqual((await journalOf(early)).find(entry => entry.id === resume.id), resume);
  assert.equal((await read(first.testRunId)).status, "paused"); await early.close();
  assert.deepEqual((await journal()).find(entry => entry.id === resume.id), resume);
  mark("a-copied-tab-reloaded-before-bootstrap-cannot-adopt-the-source-owner");
  await context.unroute("**/native-commands", unavailable); await page.evaluate(() => dispatchEvent(new Event("online")));
  await poll(async () => (await read(first.testRunId)).status === "running", "Source resume did not retry"); await emptyJournal(); await player().waitFor();
  // A mounted iframe precedes its real Ready/Start replay. Keep the exact
  // saved-value assertion, but wait until the Player can receive trusted input.
  await poll(async () => !await player().isDisabled() && await player().inputValue() === "First trusted Ω", "The resumed Player did not restore its trusted saved answer after Start");
  assert.deepEqual(answers(await read(first.testRunId)), saved); assert.equal(await player().inputValue(), "First trusted Ω");
  assert.deepEqual(await repository.listPendingParticipantRunCommands(first), []);
  await page.screenshot({ path: join(artifacts, "source-retained-answer.png"), fullPage: true });
  mark("source-retry-retains-trusted-answers-clocks-and-the-selected-run");
  assert.deepEqual(errors, []);
} catch (error) {
  await mkdir(publicEvidence, {recursive: true});
  const origin = page ? new URL(page.url()).origin : '';
  await writeFile(join(publicEvidence, 'public-failure.json'), JSON.stringify(nativeTabFailureEvidence(error, checks, pendingRequests, origin), null, 2));
  await page?.screenshot({ path: join(artifacts, "failure.png"), fullPage: true }).catch(() => {});
  await writeFile(join(artifacts, "failure.json"), JSON.stringify({ error: String(error), stack: error.stack, checks, errors, nativeRequests,
    body: await page?.locator("body").innerText().catch(() => "") }, null, 2)); throw error;
} finally {
  for (const release of releases) release(); await page?.context().unrouteAll({ behavior: "wait" });
  await writeFile(join(artifacts, "native-tabs.json"), JSON.stringify({ checks, errors, nativeRequests, observations }, null, 2));
  await browser?.close();
  if (server.exitCode === null) { server.kill("SIGTERM"); await Promise.race([closed, delay(5_000)]); if (server.exitCode === null) server.kill("SIGKILL"); }
  await closed; gate.assertHealthy(); console.log("owned_api=shutdown");
}
