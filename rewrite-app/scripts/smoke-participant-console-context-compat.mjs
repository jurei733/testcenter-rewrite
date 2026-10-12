import assert from "node:assert/strict";
import { spawn, execFileSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access, mkdtemp, writeFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import { parseVeronaUnitResponse } from "@testcenter-rewrite-app/contracts";
import { localDemoSourcePackage } from "../apps/api/dist/apps/api/src/local-demo-bootstrap.js";
import { createServerRequestFailureGate } from "./server-request-failure-gate.mjs";

const root = resolve(process.env.UI_SMOKE_FRONTEND_ROOT || ".");
await access(join(root, "dist/apps/web/browser/index.html"));
const artifacts = await mkdtemp(join(tmpdir(), "testcenter-controller-context-compat-"));
console.log(`owned_artifacts=${artifacts}`);
const image = process.env.UI_SMOKE_COMPAT_API_IMAGE;
const container = `testcenter-context-compat-${randomUUID().slice(0, 8)}`;
const purpose = `owned-context-compat-${randomUUID()}`;
const docker = args => execFileSync("docker", args, { encoding: "utf8" }).trim();
const gate = createServerRequestFailureGate(), checks = [], errors = [], observations = [];
const poll = async (predicate, message) => {
  const deadline = Date.now() + 20_000;
  while (Date.now() < deadline) { if (await predicate()) return; await delay(100); }
  throw Error(message);
};
const freePort = () => new Promise((done, reject) => {
  const socket = createServer(); socket.once("error", reject);
  socket.listen(0, "127.0.0.1", () => { const port = socket.address().port; socket.close(error => error ? reject(error) : done(port)); });
});
const env = { FIRST_SLICE_STORE: "sqlite", FIRST_SLICE_SQLITE_FILE: image ? "/tmp/owned.sqlite" : join(artifacts, "owned.sqlite"),
  FIRST_SLICE_BOOTSTRAP_DEMO: "true", FIRST_SLICE_OPERATOR_AUTH_REQUIRED: "true", FIRST_SLICE_PROOF_OF_WORK_SCOPES: "",
  FIRST_SLICE_XML_SCHEMA_PROFILE: "legacy-compatibility", REQUIRE_LOGIN_PASSWORD: "false" };
let port = image ? await freePort() : null, imageId = null;
if (image) {
  assert.equal(docker(["ps", "-aq", "--filter", `name=^${container}$`]), "");
  imageId = docker(["image", "inspect", "--format", "{{.Id}}", image]);
}
const module = pathToFileURL(resolve("apps/api/dist/apps/api/src/index.js")).href;
const server = image ? spawn("docker", ["run", "--rm", "--name", container, "--label", `testcenter.purpose=${purpose}`,
  "--read-only", "--tmpfs", "/tmp:rw,size=128m,uid=1000,gid=1000", "-p", `127.0.0.1:${port}:4310`,
  "--mount", `type=bind,source=${join(root, "dist/apps/web/browser")},target=/app/dist/apps/web/browser,readonly`,
  ...Object.entries(env).flatMap(([key, value]) => ["-e", `${key}=${value}`]), image,
  "sh", "-c", "npm run db:migrate:sqlite:built && node apps/api/dist/apps/api/src/index.js"], { cwd: root, stdio: ["ignore", "pipe", "pipe"] }) :
  spawn(process.execPath, ["--input-type=module", "-e", `
    import { createProductionApiServer } from ${JSON.stringify(module)};
    const server=await createProductionApiServer();
    server.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));
    process.once('SIGTERM',()=>server.close(()=>process.exit(0)));
  `], { cwd: root, env: { ...process.env, ...env }, stdio: ["ignore", "pipe", "pipe", "ipc"] });
gate.observeStream(server.stdout); gate.observeStream(server.stderr);
const closed = new Promise(done => server.once("close", done));
let browser, page; const releases = [];
try {
  if (!image) port = await new Promise((done, reject) => {
    const timeout = setTimeout(() => reject(Error("Owned API startup timed out")), 20_000);
    server.once("message", value => { clearTimeout(timeout); done(value.port); });
    server.once("error", error => { clearTimeout(timeout); reject(error); });
    server.once("exit", () => { clearTimeout(timeout); reject(Error("Owned API exited before startup")); });
  });
  const base = `http://127.0.0.1:${port}`;
  await poll(async () => {
    if (server.exitCode !== null) throw Error("Owned API exited before readiness");
    try { return (await fetch(base + "/readyz")).ok; } catch { return false; }
  }, "Owned API readiness timed out");
  const api = async (path, body, token) => {
    const response = await fetch(base + path, { method: body === undefined ? "GET" : "POST",
      headers: { ...(token ? { authorization: `Bearer ${token}` } : {}), ...(body === undefined ? {} : { "content-type": "application/json" }) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    assert.ok(response.ok, `${path}: HTTP ${response.status}`); return response.json();
  };
  const operator = (await api("/api/v1/admin/auth/sign-in", { username: "demo-admin", password: "demo-admin-password" })).sessionToken;
  const workspaceKey = "owned-context-compat", workspace = `/api/v1/tenants/demo-tenant/workspaces/${workspaceKey}`;
  await api("/api/v1/tenants/demo-tenant/workspaces", { workspaceKey, displayName: "Owned context compatibility" }, operator);
  const content = JSON.parse(localDemoSourcePackage.sourceDocument), unit = content.bookletEntries[0].unitEntries[0];
  content.bookletEntries = ["first", "second"].map(key => ({ bookletKey: key, displayLabel: `${key} compatibility booklet`,
    config: { ask_for_fullscreen: "OFF", lock_test_on_termination: "OFF" },
    unitEntries: [{ ...unit, unitKey: key + "-unit", displayLabel: key + " compatibility unit" }] }));
  const source = await api(workspace + "/source-packages", { fileName: "compat.json", mediaType: "application/json", contentStructure: content }, operator);
  const imported = await api(workspace + "/import-jobs", { sourcePackageId: source.sourcePackage.sourcePackageId }, operator);
  await api(workspace + `/content-releases/${imported.stagedContentRelease.contentReleaseId}/activate`, { activatedByActorId: "owned-compat-browser" }, operator);
  await api(workspace + "/participant-roster", { rosterText: '<Testtakers><Group id="owned"><Login mode="run-hot-return" name="compat-person"><Booklet>first</Booklet><Booklet>second</Booklet></Login></Group></Testtakers>' }, operator);
  browser = await chromium.launch({ headless: process.env.CI === "true" && process.env.UI_SMOKE_HEADFUL !== "true" });
  page = await browser.newPage({ viewport: { width: 1280, height: 720 }, locale: "de-DE" });
  page.on("pageerror", error => errors.push(String(error)));
  const nativeRequests = [], stateRequests = [], contextResponses = [];
  page.on("request", request => {
    const url = new URL(request.url());
    if (url.pathname.endsWith("/native-commands")) nativeRequests.push(JSON.parse(request.postData()));
    if (url.pathname.endsWith("/current-state")) stateRequests.push({ session: url.pathname.split("/").at(-2), run: url.searchParams.get("testRunId") });
  });
  page.on("response", response => { if (new URL(response.url()).pathname.endsWith("/controller-context")) contextResponses.push(response.status()); });
  await page.goto(`${base}/app/participant?ui=original&tenantKey=demo-tenant&workspaceKey=${workspaceKey}`, { waitUntil: "networkidle" });
  await page.locator("#originalLoginName").fill("compat-person");
  const signIn = page.waitForResponse(response => new URL(response.url()).pathname.endsWith("/auth/sign-in") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Weiter", exact: true }).click(); const identity = await (await signIn).json();
  const currentPath = `/api/v1/participant/sessions/${identity.participantSession.participantSessionId}/current-state`;
  const read = async runId => (await api(currentPath + (runId ? `?testRunId=${runId}` : ""), undefined, identity.sessionToken)).currentRunState.testRun;
  const native = async (keyword, args = []) => page.evaluate(({ keyword, args }) => window.tc[keyword](args), { keyword, args });
  const methods = () => page.waitForFunction(() => ["debug", "pause", "resume", "terminate", "goto"].every(key => typeof window.tc?.[key] === "function"));
  const mark = name => { checks.push(name); console.log(`participant_context_compat=${name}:passed`); };
  const runs = {};
  for (const key of ["first", "second"]) {
    await page.locator(`#originalParticipantStarter mat-card[data-booklet-key="${key}"] button`).click();
    await page.frameLocator("iframe").locator("#demoPlayerAnswer").waitFor(); await methods();
    const run = await read(), answer = `Owned ${key} Ω`;
    await page.frameLocator("iframe").locator("#demoPlayerAnswer").fill(answer);
    await poll(async () => parseVeronaUnitResponse((await read(run.testRunId)).unitResponses[key + "-unit"])?.unitState.dataParts.answer === answer, "Trusted answer was not saved");
    await native("terminate"); await page.locator("#originalParticipantStarter mat-card").first().waitFor();
    runs[key] = await read(run.testRunId);
  }
  const entry = new URL(page.url()); entry.searchParams.delete("view"); entry.searchParams.set("testRunId", runs.first.testRunId);
  const unavailable = async () => {
    if (!image) await page.route("**/controller-context*", route => route.fulfill({ status: 404, contentType: "application/json",
      body: JSON.stringify({ error: "route_not_found", message: "Owned old API has no controller-context route." }) }));
  };
  const beforeNative = nativeRequests.length, beforeState = stateRequests.length, beforeContexts = contextResponses.length;
  await unavailable();
  let release, held = false; const heldGate = new Promise(done => { release = done; }); releases.push(release);
  await page.route("**/current-state?*", async route => {
    const request = route.request(), url = new URL(request.url());
    assert.equal(request.headers().authorization, `Bearer ${identity.sessionToken}`);
    assert.equal(url.searchParams.get("testRunId"), runs.first.testRunId);
    const response = await route.fetch(); assert.equal(response.status(), 200);
    assert.equal((await response.json()).currentRunState.testRun.testRunId, runs.first.testRunId);
    held = true; await heldGate; await route.fulfill({ response });
  });
  await page.goto(entry.href); await methods(); await poll(() => Promise.resolve(held), "Old API current state was never requested");
  await native("debug"); await native("pause"); await delay(100);
  assert.equal(nativeRequests.length, beforeNative); assert.equal(await page.locator("[data-debug-tabs]").count(), 0); assert.equal(await page.locator("iframe").count(), 0);
  assert.deepEqual(contextResponses.slice(beforeContexts), [404]);
  observations.push({ oldRouteStatus: 404, fallbackRun: runs.first.testRunId, latestRun: runs.second.testRunId,
    authenticatedFallback: true, authorizedOnlyAfterFullState: true });
  release(); await page.locator("#participantRoutePausedState").waitFor(); await page.unrouteAll({ behavior: "wait" });
  assert.ok(stateRequests.slice(beforeState).every(request => request.run === runs.first.testRunId && request.session === identity.participantSession.participantSessionId));
  mark("explicit-selected-run-reload-uses-authenticated-old-state-without-latest-fallback");
  await native("resume"); await page.frameLocator("iframe").locator("#demoPlayerAnswer").waitFor();
  assert.equal(await page.frameLocator("iframe").locator("#demoPlayerAnswer").inputValue(), "Owned first Ω");
  assert.equal(nativeRequests.at(-1).testRunId, runs.first.testRunId);
  const assertAnswers = async () => {
    for (const key of ["first", "second"]) {
      const actual = await read(runs[key].testRunId);
      assert.deepEqual(actual.unitResponses, runs[key].unitResponses); assert.deepEqual(actual.unitResponseFieldTimestamps, runs[key].unitResponseFieldTimestamps);
    }
  };
  await assertAnswers(); await page.screenshot({ path: join(artifacts, "old-api-selected-run.png"), fullPage: true });
  mark("native-resume-and-player-retain-selected-answers-and-other-booklet-clocks");
  await unavailable(); const legacy = new URL(entry); legacy.searchParams.delete("testRunId");
  const selectedByServer = await read(), legacyBefore = stateRequests.length, legacyContextBefore = contextResponses.length;
  const legacyState = page.waitForResponse(response => new URL(response.url()).pathname.endsWith("/current-state") && !new URL(response.url()).searchParams.has("testRunId"));
  await page.goto(legacy.href, { waitUntil: "networkidle" });
  const legacyReply = await legacyState; assert.equal(legacyReply.status(), 200);
  assert.equal((await legacyReply.json()).currentRunState.testRun.testRunId, selectedByServer.testRunId);
  assert.deepEqual(contextResponses.slice(legacyContextBefore), [404]);
  assert.equal(stateRequests[legacyBefore].run, null);
  assert.ok(stateRequests.slice(legacyBefore + 1).every(request => request.run === selectedByServer.testRunId));
  if (selectedByServer.status === "paused") await page.locator("#participantRoutePausedState").waitFor();
  else {
    await page.frameLocator("iframe").locator("#demoPlayerAnswer").waitFor();
    assert.equal(await page.frameLocator("iframe").locator("#demoPlayerAnswer").inputValue(), parseVeronaUnitResponse(selectedByServer.unitResponses[selectedByServer.currentUnitKey]).unitState.dataParts.answer);
  }
  await assertAnswers(); await page.unrouteAll({ behavior: "wait" });
  observations.push({ legacySessionOnly: true, authorizedServerSelection: selectedByServer.testRunId });
  mark("legacy-session-link-uses-the-authorized-server-selection-without-a-stale-browser-run");
  await unavailable(); const missing = new URL(entry); missing.searchParams.set("testRunId", randomUUID());
  const missingBefore = stateRequests.length, nativeBeforeMissing = nativeRequests.length;
  const rejectedState = page.waitForResponse(response => new URL(response.url()).pathname.endsWith("/current-state") && new URL(response.url()).searchParams.get("testRunId") === missing.searchParams.get("testRunId"));
  await page.goto(missing.href, { waitUntil: "networkidle" }); assert.equal((await rejectedState).status(), 404); await methods();
  await native("debug"); await native("pause"); await delay(100);
  assert.equal(nativeRequests.length, nativeBeforeMissing); assert.equal(await page.locator("iframe").count(), 0); assert.equal(await page.locator("[data-debug-tabs]").count(), 0);
  assert.ok(stateRequests.slice(missingBefore).length > 0 && stateRequests.slice(missingBefore).every(request => request.run === missing.searchParams.get("testRunId")));
  await assertAnswers(); await page.unrouteAll({ behavior: "wait" });
  mark("missing-explicit-run-stays-closed-without-an-unselected-state-read");
  const deniedBefore = stateRequests.length, nativeBeforeDenied = nativeRequests.length;
  await page.route("**/controller-context*", route => route.fulfill({ status: 401, contentType: "application/json",
    body: JSON.stringify({ error: "participant_session_access_required", message: "Owned rejected credential." }) }));
  await page.goto(entry.href, { waitUntil: "networkidle" }); await methods(); await native("debug"); await native("pause"); await delay(100);
  assert.equal(stateRequests.length, deniedBefore); assert.equal(nativeRequests.length, nativeBeforeDenied);
  assert.equal(await page.locator("iframe").count(), 0); assert.equal(await page.locator("[data-debug-tabs]").count(), 0); await assertAnswers();
  mark("context-access-rejection-does-not-probe-an-alternative-state-or-dispatch");
  await page.unrouteAll({ behavior: "wait" }); assert.deepEqual(errors, []);
} catch (error) {
  await page?.screenshot({ path: join(artifacts, "failure.png"), fullPage: true }).catch(() => {});
  await writeFile(join(artifacts, "failure.json"), JSON.stringify({ error: String(error), stack: error.stack, checks, errors,
    body: await page?.locator("body").innerText().catch(() => "") }, null, 2));
  throw error;
} finally {
  for (const release of releases) release(); await page?.unrouteAll({ behavior: "wait" });
  await writeFile(join(artifacts, "compat.json"), JSON.stringify({ checks, errors, observations, image: image ?? null, imageId,
    routeCompatibility: image ? "actual-prior-api-image-with-current-frontend" : "current-api-with-owned-unsupported-route-contract" }, null, 2));
  await browser?.close();
  if (image) {
    const left = docker(["ps", "-aq", "--filter", `name=^${container}$`]);
    if (left) { assert.equal(docker(["inspect", "--format", '{{index .Config.Labels "testcenter.purpose"}}', left]), purpose); docker(["stop", "-t", "5", left]); }
  } else if (server.exitCode === null) {
    server.kill("SIGTERM"); await Promise.race([closed, delay(5_000)]); if (server.exitCode === null) server.kill("SIGKILL");
  }
  await closed; gate.assertHealthy();
  if (image) assert.equal(docker(["ps", "-aq", "--filter", `name=^${container}$`]), "");
  console.log("owned_api=shutdown");
}
