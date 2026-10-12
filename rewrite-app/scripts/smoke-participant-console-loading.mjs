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
const errors = [], checks = [], requests = [], nativeRequests = [], progressRequests = [], loadingObservations = [];
let browser, page, releaseSnapshot; const releases=[];
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
    testletEntries: [{ testletKey: "timed", displayLabel: "Timed", parentTestletKey: null, restrictions: { timeMax: { minutes: 5, leave: "none" } } },
      { testletKey: "private-gate", displayLabel: "Private gate", parentTestletKey: "timed", restrictions: { codeToEnter: { code: "OWNED_PRIVATE_CODE_Ω", prompt: "Owned prompt" } } },
      { testletKey: "private-child", displayLabel: "Private child", parentTestletKey: "private-gate", restrictions: {} }],
    unitEntries: [{ ...unit, unitKey: "first-unit", originalUnitId: "original-first", displayLabel: "First unit", testletPath: ["timed"] },
      { ...unit, unitKey: "next-unit", displayLabel: "Next unit", testletPath: ["timed", "private-gate", "private-child"] }],
    stateEntries: [{ stateKey: "level", displayLabel: "Level", options: [
      { optionKey: "high", displayLabel: "High", conditions: [{ source: { type: "Score", unitKey: "first-unit", variableKey: "x", defaultValue: "0" }, expression: { type: "greaterThan", value: "1" } }] },
      { optionKey: "base", displayLabel: "Base", conditions: [] }] }] },
    { bookletKey: "second", displayLabel: "Second debug booklet", unitEntries: [{ ...unit, unitKey: "second-unit", displayLabel: "Second only unit", unitDefinition: "Second private definition", originalUnitId: "original-second" }] }];
  const source = await api(workspace + "/source-packages", { fileName: "debug.json", mediaType: "application/json", contentStructure: content }, operator);
  const imported = await api(workspace + "/import-jobs", { sourcePackageId: source.sourcePackage.sourcePackageId }, operator);
  await api(workspace + `/content-releases/${imported.stagedContentRelease.contentReleaseId}/activate`, { activatedByActorId: "owned-debug-browser" }, operator);
  await api(workspace + "/participant-roster", { rosterText: '<Testtakers><Group id="owned"><Login mode="run-hot-return" name="debug-person"><Booklet>first</Booklet><Booklet>second</Booklet></Login><Login mode="run-hot-return" name="loading-person"><Booklet>first</Booklet><Booklet>second</Booklet></Login></Group></Testtakers>' }, operator);
  browser = await chromium.launch({ headless: process.env.CI === "true" && process.env.UI_SMOKE_HEADFUL !== "true" });
  // Resume is a real controller transition even if the server Run is already
  // running: before the initial view arrives the controller itself is LOADING.
  const loadingContext = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: "de-DE" });
  const loadingPage = await loadingContext.newPage(); page = loadingPage;
  const loadingRepository = createSqliteFirstSliceRepository(file);
  let releaseLoading; const loadingGate = new Promise(done => { releaseLoading = done; });
  releases.push(releaseLoading);
  try {
    loadingPage.on("pageerror", error => errors.push(String(error)));
    const loadingRequests = []; let initialRun;
    loadingPage.on("request", request => { if (new URL(request.url()).pathname.endsWith("/native-commands")) {
      loadingRequests.push(request.postDataJSON()); loadingObservations.push({ request: request.postDataJSON() });
    } });
    await loadingPage.route("**/current-state?*", async route => {
      const response = await route.fetch(); initialRun ??= (await response.json()).currentRunState.testRun;
      await loadingGate; await route.fulfill({ response });
    });
    await loadingPage.goto(`${base}/app/participant?ui=original&tenantKey=demo-tenant&workspaceKey=${workspaceKey}`, { waitUntil: "networkidle" });
    await loadingPage.locator("#originalLoginName").fill("loading-person");
    await loadingPage.getByRole("button", { name: "Weiter", exact: true }).click();
    await loadingPage.locator('#originalParticipantStarter mat-card[data-booklet-key="first"] button').click();
    await poll(() => Promise.resolve(Boolean(initialRun)), "Initial loading response was not held");
    await loadingPage.waitForFunction(() => typeof window.tc?.resume === "function");
    await loadingPage.evaluate(() => window.tc.debug());
    const loadingPane = loadingPage.locator('[data-debug-window="main"]');
    await poll(async () => /STATUS:\s*LOADING/.test(await loadingPane.innerText()), "Initial controller is not LOADING");
    await loadingPage.evaluate(() => window.tc.resume());
    await poll(() => Promise.resolve(loadingRequests.length === 1), "Early Resume was not sent");
    assert.equal(loadingRequests[0].controllerStatus, "LOADING");
    const executionLogs = async () => (await loadingRepository.listParticipantTestLogsByWorkspace(initialRun.tenantId, initialRun.workspaceId))
      .filter(log => log.participantTestLogId.startsWith(`delivery:${initialRun.testRunId}:console:${loadingRequests[0].deliveryId}:`));
    await poll(async () => (await executionLogs()).some(log => log.logKey === "CONTROLLER" && log.logContent === "RUNNING"), "Early Resume omitted the LOADING to RUNNING log");
    await poll(async () => /STATUS:\s*RUNNING/.test(await loadingPane.innerText()), "Resume receipt did not advance the loading controller");
    assert.equal(await loadingPage.locator("iframe").count(), 0);
    releaseLoading(); await loadingPage.unrouteAll({ behavior: "wait" });
    await loadingPage.frameLocator("iframe").locator("#demoPlayerAnswer").waitFor();
    const run = await loadingRepository.getTestRunById(initialRun.testRunId);
    assert.deepEqual(run.unitResponses, initialRun.unitResponses);
    assert.deepEqual(run.unitResponseFieldTimestamps, initialRun.unitResponseFieldTimestamps);
    assert.equal((await executionLogs()).filter(log => log.logKey === "CONTROLLER").length, 1);
    assert.equal((await executionLogs()).filter(log => log.logKey === "command executed" && log.logContent === "resume").length, 1);
    loadingObservations.push({ testRunId: run.testRunId, controllerTransitions: (await executionLogs()).filter(log => log.logKey === "CONTROLLER").map(log => log.logContent), answersAndClocksPreserved: true });
    await loadingPage.screenshot({ path: join(artifacts, "loading-resume.png"), fullPage: true });
    checks.push("early-resume-observes-loading-and-persists-the-real-controller-transition");
    console.log("participant_console_loading=early-resume-observes-loading-and-persists-the-real-controller-transition:passed");
  } catch (error) {
    await loadingPage.screenshot({ path: join(artifacts, "loading-resume-failure.png"), fullPage: true }).catch(() => {});
    throw error;
  } finally { releaseLoading(); await loadingPage.unrouteAll({ behavior: "wait" }).catch(() => {}); await loadingContext.close(); }
  const context = await browser.newContext({ viewport: { width: 1920, height: 1080 }, locale: "de-DE" });
  page = await context.newPage();
  page.on("pageerror", error => errors.push(String(error)));
  page.on("request", request => { const url = new URL(request.url()); if (url.pathname.endsWith("/debug-state")) requests.push({ method: request.method(), run: url.searchParams.get("testRunId") }); });
  page.on("request", request => { if (new URL(request.url()).pathname.endsWith("/native-commands")) nativeRequests.push(JSON.parse(request.postData())); });
  page.on("request", request => { if (new URL(request.url()).pathname.endsWith("/save-progress")) progressRequests.push(JSON.parse(request.postData())); });
  await page.goto(`${base}/app/participant?ui=original&tenantKey=demo-tenant&workspaceKey=${workspaceKey}`, { waitUntil: "networkidle" });
  await page.locator("#originalLoginName").fill("debug-person");
  const signedIn = page.waitForResponse(response => new URL(response.url()).pathname === "/api/v1/participant/auth/sign-in" && response.request().method() === "POST");
  await page.getByRole("button", { name: "Weiter", exact: true }).click(); const identity = await (await signedIn).json();
  const currentPath = `/api/v1/participant/sessions/${identity.participantSession.participantSessionId}/current-state`;
  const start = async key => { await page.locator(`#originalParticipantStarter mat-card[data-booklet-key="${key}"] button`).click(); await page.frameLocator("iframe").locator("#demoPlayerAnswer").waitFor(); await page.waitForFunction(() => typeof window.tc?.debug === "function"); };
  const repository = createSqliteFirstSliceRepository(file);
  const native = async (keyword, args = []) => page.evaluate(({keyword,args})=>window.tc[keyword](args),{keyword,args});
  const mark = name => { checks.push(name); console.log(`participant_console_loading=${name}:passed`); };
  const allMethods = () => page.waitForFunction(()=>['debug','pause','resume','terminate','goto'].every(key=>typeof window.tc?.[key]==='function'));
  const pane = () => page.locator('[data-debug-window="main"]');
  await allMethods(); await native('pause'); await native('debug'); await delay(150);
  assert.deepEqual(nativeRequests,[]); assert.equal(await page.locator('[data-debug-tabs]').count(),0);
  mark('bindings-exist-without-authorizing-starter-intents');
  const deferred = () => { let resolve; const promise=new Promise(done=>{resolve=done;}); return {promise,resolve}; };
  const initial=deferred(),pausedView=deferred(),initialDone=deferred(),pausedDone=deferred();
  releases.push(initial.resolve,pausedView.resolve);let reads=0,heldRun,pausedHeld=false;
  await page.route('**/current-state?*',async route=>{
    const index=++reads,response=await route.fetch();
    if(index===1){heldRun=(await response.json()).currentRunState.testRun;await initial.promise;await route.fulfill({response});initialDone.resolve();}
    else if(index===2){pausedHeld=true;await pausedView.promise;await route.fulfill({response});pausedDone.resolve();}
    else await route.fulfill({response});
  });
  await page.locator('#originalParticipantStarter mat-card[data-booklet-key="first"] button').click();
  await poll(()=>Promise.resolve(Boolean(heldRun)),'Authorized initial state did not remain held');await allMethods();
  await native('debug');await pane().waitFor();
  await poll(async()=>/STATUS:\s*LOADING/.test(await pane().innerText()),'Early Debug did not render LOADING');
  assert.equal(await page.locator('iframe').count(),0);await page.locator('#participantRouteBookletLoading').waitFor();assert.equal(await page.locator('#participantRouteEntry').count(),0);
  await poll(async()=>!await page.locator('.participant-meta-grid').isVisible(),'Technical participant summary remained visible before the first Player');
  assert.equal(await page.locator('.participant-runtime-toolbar').isVisible(),false);
  assert.equal(await page.locator('.participant-completion-readiness').isVisible(),false);
  await page.screenshot({path:join(artifacts,'initial-loading.png'),fullPage:true});
  mark('debug-main-before-any-current-unit-view');
  await native('pause');await poll(async()=>(await repository.getTestRunById(heldRun.testRunId)).status==='paused','Early pause missing');
  await poll(()=>Promise.resolve(pausedHeld),'Paused view was not held');
  await poll(async()=>/STATUS:\s*PAUSED/.test(await pane().innerText()),'Receipt did not update early PAUSED status');await page.locator('#participantRoutePausedState').waitFor();assert.equal(await page.locator('#participantRouteEntry').count(),0);
  await native('resume');await poll(async()=>(await repository.getTestRunById(heldRun.testRunId)).status==='running','Resume blocked behind the held paused view');
  await page.frameLocator('iframe').locator('#demoPlayerAnswer').waitFor();
  initial.resolve();pausedView.resolve();await initialDone.promise;await pausedDone.promise;await page.unrouteAll({behavior:'wait'});
  await poll(async()=>/STATUS:\s*RUNNING/.test(await pane().innerText()),'Late paused reply reverted accepted resume');
  await page.frameLocator('iframe').locator('#demoPlayerAnswer').waitFor();
  assert.deepEqual((await repository.getTestRunById(heldRun.testRunId)).unitResponses,heldRun.unitResponses);
  assert.deepEqual((await repository.getTestRunById(heldRun.testRunId)).unitResponseFieldTimestamps,heldRun.unitResponseFieldTimestamps);
  mark('early-pause-resume-order-and-late-view-fence');
  const gotoView=deferred(),gotoDone=deferred();releases.push(gotoView.resolve);let gotoHeld=false;
  await page.route('**/current-state?*',async route=>{const response=await route.fetch();gotoHeld=true;await gotoView.promise;await route.fulfill({response});gotoDone.resolve();});
  await page.frameLocator('iframe').locator('#demoPlayerAnswer').fill('4');await native('goto',['2']);
  await poll(()=>Promise.resolve(gotoHeld),'Goto did not hold its next Unit view');
  await page.frameLocator('iframe').locator('#demoPlayerAnswer').fill('7');
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('testcenter-rewrite:participant-save-outbox:v1')||'{"entries":[]}').entries.some(entry=>{
    try{return entry.unitKey==='first-unit'&&!entry.logOnly&&JSON.parse(JSON.parse(entry.response).unitState.dataParts.answer)[0].value==='7';}catch{return false;}
  }));
  await native('terminate');await page.locator('#originalParticipantStarter mat-card').first().waitFor();
  const first=await repository.getTestRunById(heldRun.testRunId);
  assert.equal(first.currentUnitKey,'next-unit');assert.equal(first.status,'paused');
  assert.equal(JSON.parse(parseVeronaUnitResponse(first.unitResponses['first-unit']).unitState.dataParts.answer)[0].value,'7');
  assert.equal(Object.hasOwn(first.unitResponses,'next-unit'),false);assert.deepEqual(await repository.listPendingParticipantRunCommands(first),[]);
  gotoView.resolve();await gotoDone.promise;await page.unrouteAll({behavior:'wait'});
  assert.equal(await page.locator('iframe').count(),0);
  mark('goto-termination-drains-former-unit-without-a-new-unit-answer');
  let fail=true,secondRun;
  await page.route('**/current-state?*',async route=>{
    const response=await route.fetch();
    if(fail){fail=false;secondRun=(await response.json()).currentRunState.testRun;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'owned_initial_load_failure',message:'Owned load failure'})});}
    else await route.fulfill({response});
  });
  await page.locator('#originalParticipantStarter mat-card[data-booklet-key="second"] button').click();
  await poll(()=>Promise.resolve(Boolean(secondRun)),'Second initial failure was not injected');await allMethods();await native('debug');await pane().waitFor();
  await poll(async()=>/STATUS:\s*ERROR/.test(await pane().innerText()),'Early ERROR lost its Debug/controller scope');
  assert.equal(await page.locator('iframe').count(),0);await page.screenshot({path:join(artifacts,'early-error.png'),fullPage:true});
  await native('resume');await page.frameLocator('iframe').locator('#demoPlayerAnswer').waitFor();
  await poll(async()=>!await page.locator('mat-dialog-container, #participantRuntimeErrorFallback').count(),'Early Resume did not clear the error presentation');
  assert.deepEqual((await repository.getTestRunById(secondRun.testRunId)).unitResponses,secondRun.unitResponses);
  assert.deepEqual((await repository.getTestRunById(secondRun.testRunId)).unitResponseFieldTimestamps,secondRun.unitResponseFieldTimestamps);
  mark('native-resume-recovers-before-the-first-unit-was-loaded');
  await page.unrouteAll({behavior:'wait'});
  // A new document has no in-memory authorized Run: its lightweight context must
  // establish scope even when the following full-state request fails.
  await page.waitForURL(url=>url.searchParams.get('testRunId')===secondRun.testRunId);
  const reloadEntry=page.url();let reloadFailure=false,contexts=0;
  page.on('request',request=>{if(new URL(request.url()).pathname.endsWith('/controller-context'))contexts++;});
  await page.route('**/current-state?*',async route=>{
    reloadFailure=true;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'owned_reload_load_failure',message:'Owned reload load failure'})});
  });
  await page.goto(reloadEntry,{waitUntil:'networkidle'});await allMethods();await native('debug');await pane().waitFor();
  await poll(async()=>/STATUS:\s*ERROR/.test(await pane().innerText()),'Reload ERROR had no authorized console');
  assert.equal(reloadFailure,true);assert.ok(contexts>0);await native('terminate',['lock']);
  await page.locator('#originalParticipantStarter mat-card').first().waitFor();
  const terminated=await repository.getTestRunById(secondRun.testRunId);
  assert.equal(terminated.locked,true);assert.equal(terminated.status,'paused');assert.equal(terminated.completedAt,null);
  assert.deepEqual(terminated.unitResponses,secondRun.unitResponses);assert.deepEqual(terminated.unitResponseFieldTimestamps,secondRun.unitResponseFieldTimestamps);
  assert.deepEqual((await repository.getTestRunById(first.testRunId)).unitResponses,first.unitResponses);
  assert.deepEqual(await repository.listPendingParticipantRunCommands(terminated),[]);mark('reload-context-and-early-error-lock-termination');
  assert.deepEqual(nativeRequests.map(request => [request.keyword, request.controllerStatus]), [
    ['pause', 'LOADING'], ['resume', 'PAUSED'], ['goto', 'RUNNING'],
    ['terminate', 'RUNNING'], ['resume', 'ERROR'], ['terminate', 'ERROR']
  ]);
  await page.unrouteAll({behavior:'wait'});assert.deepEqual(errors,[]);

} catch (error) {
  await page?.screenshot({ path: join(artifacts, "failure.png"), fullPage: true }).catch(() => {});
  await writeFile(join(artifacts, "failure.json"), JSON.stringify({ error: String(error), stack: error.stack, checks, errors, requests, nativeRequests, progressRequests, loadingObservations, body: await page?.locator("body").innerText().catch(() => "") }, null, 2));
  throw error;
} finally {
  releaseSnapshot?.(); for(const release of releases)release(); await page?.unrouteAll({behavior:"wait"}).catch(() => {});
  await writeFile(join(artifacts, "debug.json"), JSON.stringify({ checks, errors, requests, nativeRequests, progressRequests, loadingObservations }, null, 2));
  await browser?.close();
  if (server.exitCode === null) { server.kill("SIGTERM"); await Promise.race([closed, delay(5_000)]); if (server.exitCode === null) { server.kill("SIGKILL"); await closed; } }
  await closed; gate.assertHealthy(); console.log("owned_api=shutdown");
}
