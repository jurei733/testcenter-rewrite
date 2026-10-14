import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";
import { createSqliteFirstSliceRepository } from "@testcenter-rewrite-app/sqlite-store";
import { productionApiRoutes, resolveRoutePath, parseVeronaUnitResponse } from "@testcenter-rewrite-app/contracts";
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
  await api(workspace + "/participant-roster", { rosterText: '<Testtakers><Group id="owned"><Login mode="run-hot-return" name="debug-person"><Booklet>first</Booklet><Booklet>second</Booklet></Login><Login mode="run-hot-return" name="loading-person"><Booklet>first</Booklet><Booklet>second</Booklet></Login><Login mode="run-hot-return" name="remote-person"><Booklet>first</Booklet><Booklet>second</Booklet></Login></Group></Testtakers>' }, operator);
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
    const loadingRequests = [], loadingCompletions = []; let initialRun;
    loadingPage.on("request", request => {
      const path = new URL(request.url()).pathname;
      if (path.endsWith("/native-commands")) { loadingRequests.push(request.postDataJSON()); loadingObservations.push({ request: request.postDataJSON() }); }
      if (path.endsWith("/command-completions")) loadingCompletions.push(request.postDataJSON());
    });
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
    const controllerLogs = async () => (await loadingRepository.listParticipantTestLogsByWorkspace(initialRun.tenantId, initialRun.workspaceId))
      .filter(log => log.testRunId === initialRun.testRunId && log.logKey === "CONTROLLER").sort((a,b)=>a.timestamp-b.timestamp||a.participantTestLogId.localeCompare(b.participantTestLogId));
    await poll(async () => (await controllerLogs()).length > 0, "Initial LOADING was not persisted before any Unit");
    assert.deepEqual((await controllerLogs()).map(log=>log.logContent), ["LOADING"], "Entry fabricated RUNNING before the controller was ready");
    await loadingPage.evaluate(() => window.tc.resume());
    await poll(() => Promise.resolve(loadingRequests.length === 1), "Early Resume was not sent");
    assert.equal(loadingRequests[0].controllerStatus, "LOADING");
    const executionLogs = async () => (await loadingRepository.listParticipantTestLogsByWorkspace(initialRun.tenantId, initialRun.workspaceId))
      .filter(log => log.participantTestLogId.startsWith(`delivery:${initialRun.testRunId}:console:${loadingRequests[0].deliveryId}:`));
    await poll(async () => (await executionLogs()).some(log => log.logKey === "CONTROLLER" && log.logContent === "RUNNING"), "Early Resume omitted the LOADING to RUNNING log");
    await poll(async () => /STATUS:\s*RUNNING/.test(await loadingPane.innerText()), "Resume receipt did not advance the loading controller");
    assert.equal(await loadingPage.locator("iframe").count(), 0);
    const releasedLoadingAt = Date.now();
    releaseLoading(); await loadingPage.unrouteAll({ behavior: "wait" });
    await loadingPage.frameLocator("iframe").locator("#demoPlayerAnswer").waitFor();
    const run = await loadingRepository.getTestRunById(initialRun.testRunId);
    assert.deepEqual(run.unitResponses, initialRun.unitResponses);
    assert.deepEqual(run.unitResponseFieldTimestamps, initialRun.unitResponseFieldTimestamps);
    assert.equal((await executionLogs()).filter(log => log.logKey === "CONTROLLER").length, 1);
    const completionLogs = async () => (await loadingRepository.listParticipantTestLogsByWorkspace(initialRun.tenantId, initialRun.workspaceId))
      .filter(log => log.testRunId === initialRun.testRunId && log.logKey === "command executed" && log.logContent === "resume");
    await poll(async () => loadingCompletions.length === 1 && (await completionLogs()).length === 1, "Early Resume completion was not persisted after its client continuation");
    assert.deepEqual(loadingCompletions[0].command, { kind: "native", request: loadingRequests[0] });
    assert.equal(loadingCompletions[0].testRunId, initialRun.testRunId);
    assert.ok(loadingCompletions[0].timeStamp >= releasedLoadingAt);
    assert.equal((await completionLogs())[0].timestamp, loadingCompletions[0].timeStamp);
    await poll(async () => (await controllerLogs()).length >= 2, "Ready transition was not persisted");
    assert.deepEqual((await controllerLogs()).map(log=>log.logContent), ["LOADING", "RUNNING"], "Early Resume produced a duplicate lifecycle ready state");
    loadingObservations.push({ testRunId: run.testRunId, controllerTransitions: (await executionLogs()).filter(log => log.logKey === "CONTROLLER").map(log => log.logContent), answersAndClocksPreserved: true });
    await loadingPage.screenshot({ path: join(artifacts, "loading-resume.png"), fullPage: true });
    checks.push("early-resume-observes-loading-and-persists-the-real-controller-transition");
    console.log("participant_console_loading=early-resume-observes-loading-and-persists-the-real-controller-transition:passed");
  } catch (error) {
    await loadingPage.screenshot({ path: join(artifacts, "loading-resume-failure.png"), fullPage: true }).catch(() => {});
    throw error;
  } finally { releaseLoading(); await loadingPage.unrouteAll({ behavior: "wait" }).catch(() => {}); await loadingContext.close(); }
  // An application receipt changes the controller before a following full
  // view arrives. Holding that view must not block the next accepted command.
  const remoteIdentity = await api(productionApiRoutes.participant.signIn, {tenantKey:"demo-tenant",workspaceKey,loginKey:"remote-person"});
  const sibling = (await api(productionApiRoutes.participant.launch,{participantSessionId:remoteIdentity.participantSession.participantSessionId,bookletKey:"second"},remoteIdentity.sessionToken)).testRun;
  await api(resolveRoutePath(productionApiRoutes.participant.saveProgress,{testRunId:sibling.testRunId}),{status:"running",currentUnitKey:sibling.currentUnitKey,unitResponse:"Exact sibling answer Ω"},remoteIdentity.sessionToken);
  const siblingBefore = await loadingRepository.getTestRunById(sibling.testRunId);
  const remoteContext = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: "de-DE" });
  const remotePage = await remoteContext.newPage();page=remotePage;
  let releasePausedView,releaseTerminalRuntime,releaseGotoView;const pausedGate=new Promise(done=>{releasePausedView=done;});releases.push(releasePausedView);
  try {
    remotePage.on("pageerror",error=>errors.push(String(error)));
    await remotePage.goto(`${base}/app/participant?ui=original&tenantKey=demo-tenant&workspaceKey=${workspaceKey}`,{waitUntil:"networkidle"});
    await remotePage.locator("#originalLoginName").fill("remote-person");await remotePage.getByRole("button",{name:"Weiter",exact:true}).click();
    await remotePage.locator('#originalParticipantStarter mat-card[data-booklet-key="first"] button').click();
    await remotePage.frameLocator("iframe").locator("#demoPlayerAnswer").waitFor();
    const runId=new URL(remotePage.url()).searchParams.get("testRunId");assert.ok(runId);
    await remotePage.waitForFunction(()=>typeof window.tc?.debug==="function");await remotePage.evaluate(()=>window.tc.debug());
    const remotePane=remotePage.locator('[data-debug-window="main"]');
    await poll(async()=>/BS:\s*live/.test(await remotePane.innerText()),"Remote command stream did not become live");
    await remotePage.frameLocator("iframe").locator("#demoPlayerAnswer").fill("3");
    await poll(async()=>{const run=await loadingRepository.getTestRunById(runId);try{return JSON.parse(parseVeronaUnitResponse(run.unitResponses[run.currentUnitKey]).unitState.dataParts.answer)[0].value==='3';}catch{return false;}},"Trusted remote-case answer was not stored");
    let before=await loadingRepository.getTestRunById(runId);const applications=[],acks=[];let pausedHeld=false;
    remotePage.on("request",request=>{if(request.method()==="PATCH"&&new URL(request.url()).pathname.includes("/commands/"))acks.push({path:new URL(request.url()).pathname,body:request.postDataJSON()});});
    const captureApplication=async route=>{const response=await route.fetch();assert.equal(response.status(),200);applications.push(await response.json());await route.fulfill({response});};
    await remotePage.route("**/application",captureApplication);
    await remotePage.route("**/current-state?*",async route=>{
      const response=await route.fetch(),data=await response.json();
      if(!pausedHeld&&data.currentRunState.testRun.status==="paused"){pausedHeld=true;await pausedGate;}
      await route.fulfill({response});
    });
    const pause=(await api(workspace+`/monitor/open-runs/${runId}/commands`,{commandType:"pause"},operator)).command;
    await poll(()=>Promise.resolve(pausedHeld),"Remote Pause did not request its following full view");
    await poll(async()=>/STATUS:\s*PAUSED/.test(await remotePane.innerText()),"Remote Pause receipt did not project before its held full view");
    await remotePage.locator("#participantRoutePausedState").waitFor();
    checks.push("remote-pause-receipt-projects-before-the-following-unit-view");console.log("participant_console_loading=remote-pause-receipt-projects-before-the-following-unit-view:passed");
    const resume=(await api(workspace+`/monitor/open-runs/${runId}/commands`,{commandType:"resume"},operator)).command;
    await poll(async()=>(await loadingRepository.getTestRunById(runId)).status==="running","Remote Resume was blocked behind the held Pause view");
    await poll(async()=>/STATUS:\s*RUNNING/.test(await remotePane.innerText()),"Remote Resume receipt did not project RUNNING");
    await remotePage.frameLocator("iframe").locator("#demoPlayerAnswer").waitFor();
    await poll(async()=>(await remotePage.frameLocator("iframe").locator("#demoPlayerAnswer").inputValue())==="3","The resumed Player did not restore its stored answer");
    releasePausedView();await remotePage.unrouteAll({behavior:"wait"});
    await poll(async()=>/STATUS:\s*RUNNING/.test(await remotePane.innerText()),"Late Pause view reverted the accepted Resume");
    const after=await loadingRepository.getTestRunById(runId);
    assert.deepEqual(after.unitResponses,before.unitResponses);assert.deepEqual(after.unitResponseFieldTimestamps,before.unitResponseFieldTimestamps);
    assert.deepEqual(await loadingRepository.getTestRunById(sibling.testRunId),siblingBefore);
    assert.deepEqual(applications.map(value=>value.application.command.commandId),[pause.commandId,resume.commandId]);
    assert.ok(applications.every(value=>value.application.command.executedAt&&value.application.testRun.testRunId===runId));
    assert.deepEqual(applications.map(value=>value.application.command.executionSequence),[1,2]);
    assert.equal(acks.length,2);assert.ok(acks.every(ack=>ack.body.testRunId===runId));
    assert.ok(acks.some(ack=>ack.path.includes(pause.commandId)));assert.ok(acks.some(ack=>ack.path.includes(resume.commandId)));
    await poll(async()=>{
      const saved=(await loadingRepository.listParticipantTestLogsByWorkspace(after.tenantId,after.workspaceId)).filter(log=>log.testRunId===runId);
      return ['pause','resume'].every(keyword=>saved.filter(log=>log.logKey==='command executed'&&log.logContent===keyword).length===1);
    },'The two fulfilled remote command completions were not persisted exactly once');
    const logs=(await loadingRepository.listParticipantTestLogsByWorkspace(after.tenantId,after.workspaceId)).filter(log=>log.testRunId===runId);
    for(const keyword of ['pause','resume'])assert.equal(logs.filter(log=>log.logKey==='command executed'&&log.logContent===keyword).length,1);

    await remotePage.screenshot({path:join(artifacts,"remote-view-resume.png"),fullPage:true});
    checks.push("remote-resume-overtakes-held-view-and-fences-its-late-state");console.log("participant_console_loading=remote-resume-overtakes-held-view-and-fences-its-late-state:passed");
    for(const [origin,phase,successor] of [['remote','response','remote'],['remote','request','remote'],
      ['native','response','native'],['native','request','native'],['native','request','remote']]){
      const oldResetFrame=await remotePage.locator('iframe').elementHandle();
      const reset=remotePage.waitForResponse(response=>new URL(response.url()).pathname.endsWith('/native-commands')&&response.request().postDataJSON().keyword==='resume');
      await remotePage.evaluate(()=>window.tc.resume());await reset;
      if(oldResetFrame)await poll(()=>oldResetFrame.evaluate(frame=>!frame.isConnected),'The overlap fixture did not finish its preceding native Resume');
      await remotePage.frameLocator('iframe').locator('#demoPlayerAnswer').waitFor();
      const baseline=await loadingRepository.getTestRunById(runId),formerFrame=await remotePage.locator('iframe').elementHandle();assert.ok(formerFrame);
      const label=`${origin}-${phase}-${successor}`,nativeApplications=[];
      let releaseFirst,firstHeld=false,firstCommitted=false,firstRequest,firstApplication;
      const firstGate=new Promise(done=>{releaseFirst=done;});releases.push(releaseFirst);
      await remotePage.route('**/application',captureApplication);
      await remotePage.route(origin==='native'?'**/native-commands':'**/application',async route=>{
        const body=route.request().postDataJSON(),hold=!firstHeld&&(origin==='remote'||body.keyword==='pause');
        if(hold){firstHeld=true;firstRequest=body;if(phase==='request')await firstGate;}
        const response=await route.fetch(),application=(await response.json()).application;
        if(origin==='remote')applications.push({application});else nativeApplications.push({request:body,application});
        if(hold){firstApplication=application;firstCommitted=true;if(phase==='response')await firstGate;}
        await route.fulfill({response});
      });
      try {
        if(origin==='remote')await api(workspace+`/monitor/open-runs/${runId}/commands`,{commandType:'pause'},operator);
        else await remotePage.evaluate(()=>window.tc.pause());
        await poll(()=>Promise.resolve(phase==='response'?firstCommitted:firstHeld),'The earlier application did not reach its held boundary');
        if(phase==='request'){
          await poll(async()=>/STATUS:\s*PAUSED/.test(await remotePane.innerText()),'The accepted Pause did not enter PAUSED before its application request');
          assert.equal((await loadingRepository.getTestRunById(runId)).status,'running','A local controller phase must not forge a committed Run state');
          assert.equal(await formerFrame.evaluate(frame=>frame.isConnected),true,'The pending controller phase completed navigation before its held application');
        }
        let next;
        if(successor==='remote'){
          const command=(await api(workspace+`/monitor/open-runs/${runId}/commands`,{commandType:'resume'},operator)).command;
          await poll(()=>Promise.resolve(applications.some(value=>value.application.command.commandId===command.commandId)),'A later Resume was blocked by a held application');
          next=applications.find(value=>value.application.command.commandId===command.commandId).application;
          assert.equal(acks.filter(ack=>ack.path.includes(command.commandId)).length,1);
        }else{
          await remotePage.evaluate(()=>window.tc.resume());
          await poll(()=>Promise.resolve(nativeApplications.some(value=>value.request.keyword==='resume')),'A later native Resume was blocked by a held application');
          next=nativeApplications.find(value=>value.request.keyword==='resume').application;
        }
        assert.equal(next.controllerDispatch.controllerId,firstRequest.controllerDispatch.controllerId);
        assert.equal(next.controllerDispatch.sequence,firstRequest.controllerDispatch.sequence+1);
        await poll(()=>formerFrame.evaluate(frame=>!frame.isConnected),'The later Resume did not retire the Player while the earlier application was held');
        await remotePage.frameLocator('iframe').locator('#demoPlayerAnswer').waitFor();
        await poll(async()=>/STATUS:\s*RUNNING/.test(await remotePane.innerText()),'The later Resume did not project RUNNING before the earlier reply');
        releaseFirst();await remotePage.unrouteAll({behavior:'wait'});
        await poll(()=>Promise.resolve(Boolean(firstApplication)),'The earlier application did not finish after release');
        assert.equal(firstApplication.superseded,phase==='request'?true:undefined);
        await remotePage.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
        assert.match(await remotePane.innerText(),/STATUS:\s*RUNNING/);
        await poll(async()=>(await remotePage.frameLocator('iframe').locator('#demoPlayerAnswer').inputValue())==='3','The overlapping commands changed the stored Player response');
        const final=await loadingRepository.getTestRunById(runId);assert.equal(final.status,'running');
        assert.deepEqual(final.unitResponses,baseline.unitResponses);assert.deepEqual(final.unitResponseFieldTimestamps,baseline.unitResponseFieldTimestamps);
        assert.deepEqual(await loadingRepository.getTestRunById(sibling.testRunId),siblingBefore);
        loadingObservations.push({overlap:label,firstRequest,firstApplication,laterApplication:next,earlierApplicationHeldBeforeLaterReceipt:true,
          answersAndClocksPreserved:true,siblingPreserved:true});
        await remotePage.screenshot({path:join(artifacts,`overlap-${label}.png`),fullPage:true});
        const marker=`overlapping-${label}-keeps-later-resume`;checks.push(marker);console.log(`participant_console_loading=${marker}:passed`);
      }finally{releaseFirst();await remotePage.unrouteAll({behavior:'wait'}).catch(()=>{});}
    }
    await remotePage.route("**/application",captureApplication);
    for(const origin of ['native','remote']){
      const priorFrame=await remotePage.locator('iframe').elementHandle();
      const reset=remotePage.waitForResponse(response=>new URL(response.url()).pathname.endsWith('/native-commands')&&response.request().postDataJSON().keyword==='resume');
      await remotePage.evaluate(()=>window.tc.resume());await reset;
      if(priorFrame)await poll(()=>priorFrame.evaluate(frame=>!frame.isConnected),'The phase/error fixture did not finish its preceding Resume');
      await remotePage.frameLocator('iframe').locator('#ownedDebugError').waitFor();
      const baseline=await loadingRepository.getTestRunById(runId);
      let releasePause,releaseResume,heldPause=false,heldResume=false,pauseDone=false,pauseRequest,resumeRequest;
      const pauseGate=new Promise(done=>{releasePause=done;}),resumeGate=new Promise(done=>{releaseResume=done;});releases.push(releasePause,releaseResume);
      const pausePattern=origin==='native'?'**/native-commands':'**/application';
      await remotePage.route(pausePattern,async route=>{
        const body=route.request().postDataJSON();pauseRequest=body;heldPause=true;await pauseGate;
        const response=await route.fetch();if(origin==='remote')applications.push(await response.json());await route.fulfill({response});pauseDone=true;
      });
      try{
        if(origin==='native')await remotePage.evaluate(()=>window.tc.pause());
        else await api(workspace+`/monitor/open-runs/${runId}/commands`,{commandType:'pause'},operator);
        await poll(()=>Promise.resolve(heldPause),'The accepted Pause did not reach its held request');
        await poll(async()=>/STATUS:\s*PAUSED/.test(await remotePane.innerText()),'The held Pause did not enter its immediate phase');
        await remotePage.frameLocator('iframe').locator('#ownedDebugError').click();
        await poll(async()=>/STATUS:\s*ERROR/.test(await remotePane.innerText()),'A later trusted Player error did not interrupt the pending phase');
        await remotePage.locator('mat-dialog-container').waitFor();
        releasePause();await poll(()=>Promise.resolve(pauseDone),'The interrupted Pause did not finish after release');
        await remotePage.unroute(pausePattern);await remotePage.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
        assert.match(await remotePane.innerText(),/STATUS:\s*ERROR/,'The late command receipt overwrote the newer ERROR');
        assert.equal((await loadingRepository.getTestRunById(runId)).status,'paused');
        await remotePage.route('**/native-commands',async route=>{
          resumeRequest=route.request().postDataJSON();heldResume=true;await resumeGate;
          const response=await route.fetch();await route.fulfill({response});
        });
        await remotePage.evaluate(()=>window.tc.resume());await poll(()=>Promise.resolve(heldResume),'The fresh Resume did not reach its held request');
        await poll(async()=>/STATUS:\s*RUNNING/.test(await remotePane.innerText()),'Resume did not leave ERROR before its application');
        assert.equal(await remotePage.locator('mat-dialog-container').count(),1,'An immediate status phase removed the existing error dialog');
        assert.equal((await loadingRepository.getTestRunById(runId)).status,'paused');
        assert.equal(resumeRequest.controllerStatus,'ERROR');assert.equal(resumeRequest.controllerDispatch.controllerId,pauseRequest.controllerDispatch.controllerId);
        assert.equal(resumeRequest.controllerDispatch.sequence,pauseRequest.controllerDispatch.sequence+1);
        releaseResume();await remotePage.unrouteAll({behavior:'wait'});
        await remotePage.frameLocator('iframe').locator('#demoPlayerAnswer').waitFor();
        await poll(async()=>(await loadingRepository.getTestRunById(runId)).status==='running','The fresh Resume did not commit');
        const final=await loadingRepository.getTestRunById(runId);assert.deepEqual(final.unitResponses,baseline.unitResponses);assert.deepEqual(final.unitResponseFieldTimestamps,baseline.unitResponseFieldTimestamps);
        assert.deepEqual(await loadingRepository.getTestRunById(sibling.testRunId),siblingBefore);
        loadingObservations.push({phaseErrorOrigin:origin,pauseRequest,resumeRequest,newerErrorPreserved:true,immediateResumeRetainedDialog:true,answersAndClocksPreserved:true});
        const marker=`immediate-${origin}-phase-yields-to-newer-error-and-fresh-native-resume`;checks.push(marker);console.log(`participant_console_loading=${marker}:passed`);
      }finally{releasePause();releaseResume();await remotePage.unrouteAll({behavior:'wait'}).catch(()=>{});}
    }
    for(const scenario of [{origin:'native',later:'pause'},{origin:'native',later:'resume',initialPaused:true},{origin:'native'},{origin:'remote'},{origin:'native',noop:'native'},{origin:'native',noop:'remote'}]){
      const oldFrame=await remotePage.locator('iframe').elementHandle();
      const reset=remotePage.waitForResponse(response=>new URL(response.url()).pathname.endsWith('/native-commands')&&response.request().postDataJSON().keyword==='resume');
      await remotePage.evaluate(()=>window.tc.resume());await reset;
      if(oldFrame)await poll(()=>oldFrame.evaluate(frame=>!frame.isConnected),'The terminal phase fixture did not retire its preceding Player');
      await poll(async()=>(await remotePage.frameLocator('iframe').locator('#demoPlayerAnswer').inputValue())==='3','The terminal phase fixture did not restore its preceding trusted answer');
      if(scenario.origin==='remote'||scenario.noop==='remote')await poll(async()=>/BS:\s*live/.test(await remotePane.innerText()),'The terminal phase fixture did not reopen remote reception');
      const answer=scenario.initialPaused?'4':'5',packets=[],preparations=[],timerInterruptions=[];
      const observation={forcedTerminalPhase:scenario,packets,preparations,timerInterruptions};loadingObservations.push(observation);
      let releaseAnswer,releaseRuntime,releaseAck,answerHeld=false,runtimeHeld=false,ackHeld=false,loseNoop=scenario.noop==='native';
      const answerGate=new Promise(done=>{releaseAnswer=done;}),runtimeGate=new Promise(done=>{releaseRuntime=done;}),ackGate=new Promise(done=>{releaseAck=done;});releases.push(releaseAnswer,releaseRuntime,releaseAck);
      await remotePage.route('**/save-progress',async route=>{
        const request=route.request().postDataJSON(),response=await route.fetch();assert.equal(response.status(),200);preparations.push(request);
        const state=parseVeronaUnitResponse(request.unitResponse);
        if(state&&JSON.parse(state.unitState.dataParts.answer??'[]')[0]?.value===answer){answerHeld=true;await answerGate;}
        await route.fulfill({response});
      });
      const runtimePath=resolveRoutePath(productionApiRoutes.participant.getRuntimeState,{participantSessionId:before.participantSessionId});
      await remotePage.route(url=>url.pathname===runtimePath,async route=>{const response=await route.fetch();if(!scenario.later){runtimeHeld=true;await runtimeGate;}await route.fulfill({response});});
      await remotePage.route('**/native-commands',async route=>{const request=route.request().postDataJSON(),response=await route.fetch();packets.push({request,application:(await response.json()).application});if(loseNoop&&request.terminationNoop){loseNoop=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'owned_lost_noop_receipt'})});}else await route.fulfill({response});});
      await remotePage.route('**/controller-timer-interruptions',async route=>{const request=route.request().postDataJSON(),response=await route.fetch();assert.equal(response.status(),200);timerInterruptions.push({request,receipt:(await response.json()).interruption});await route.fulfill({response});});
      await remotePage.route('**/application',async route=>{const request=route.request().postDataJSON(),response=await route.fetch(),application=(await response.json()).application;packets.push({request,application});applications.push({application});await route.fulfill({response});});
      try{
        await remotePage.frameLocator('iframe').locator('#demoPlayerAnswer').fill(answer);await poll(()=>Promise.resolve(answerHeld),'The terminal phase fixture did not hold its exact committed answer');
        const baseline=await loadingRepository.getTestRunById(runId);observation.baseline=baseline;
        const assertOnlyPreparedTimer=async()=>{
          const current=await loadingRepository.getTestRunById(runId);
          if(current.stateRevision===baseline.stateRevision){assert.deepEqual(current,baseline);return;}
          await poll(()=>Promise.resolve(timerInterruptions.length===1),'An early Run change had no exact timer receipt');
          const {request,receipt}=timerInterruptions[0],timer=baseline.testletTimers[request.testletKey];
          assert.equal(receipt.applied,true);assert.equal(receipt.scope.testRunId,runId);assert.equal(request.unitKey,baseline.currentUnitKey);
          assert.equal(request.startedAt,timer.startedAt);assert.equal(request.expiresAt,timer.expiresAt);
          assert.deepEqual(current,{...baseline,stateRevision:baseline.stateRevision+1,updatedAt:receipt.acceptedAt,
            testletTimers:{...baseline.testletTimers,[request.testletKey]:{...timer,status:'paused',remainingSeconds:Math.min(timer.remainingSeconds,request.remainingSeconds),expiresAt:null,updatedAt:receipt.acceptedAt,endedAt:null,interruptedAtUnitKey:request.unitKey}}});
        };
        assert.equal(JSON.parse(parseVeronaUnitResponse(baseline.unitResponses['first-unit']).unitState.dataParts.answer)[0].value,answer);
        if(scenario.noop==='remote'){
          await remotePage.route('**/commands/*/acknowledgement',async route=>{if(route.request().method()!=='PATCH'){await route.continue();return;}const response=await route.fetch();assert.equal(response.status(),200);ackHeld=true;await ackGate;await route.fulfill({response});});
          await api(workspace+`/monitor/open-runs/${runId}/commands`,{commandType:'complete_and_lock'},operator);await poll(()=>Promise.resolve(ackHeld),'The no-op fixture did not retain its accepted remote ACK');
        }
        if(scenario.initialPaused)await remotePage.evaluate(()=>window.tc.pause());
        if(scenario.origin==='native')await remotePage.evaluate(()=>window.tc.terminate());else await api(workspace+`/monitor/open-runs/${runId}/commands`,{commandType:'complete'},operator);
        const terminalStatus=scenario.initialPaused?'TERMINATED_PAUSED':'TERMINATED';
        await poll(async()=>new RegExp(`STATUS:\\s*${terminalStatus}(?:\\s|$)`).test(await remotePane.innerText()),'Forced termination did not enter its terminal phase before the held answer buffer');
        assert.equal(packets.length,0,'Termination bypassed its held answer buffer');await assertOnlyPreparedTimer();
        if(scenario.noop){
          const parent=await loadingRepository.getParticipantSessionById(baseline.participantSessionId),logsBefore=(await loadingRepository.listParticipantTestLogsByWorkspace(baseline.tenantId,baseline.workspaceId)).filter(log=>log.testRunId===runId&&log.logKey==='command executed').length;
          if(scenario.noop==='native')await remotePage.evaluate(()=>window.tc.terminate(['lock']));else releaseAck();
          await poll(()=>Promise.resolve(packets.filter(value=>value.request.terminationNoop).length===(scenario.noop==='native'?2:1)),'An already-TERMINATED command waited for the first answer buffer or changed its guard decision');
          const ignored=packets.filter(value=>value.request.terminationNoop);observation.ignored=ignored;
          if(scenario.noop==='native'){assert.deepEqual(ignored[0].request,ignored[1].request);assert.equal(ignored[1].application.applied,false);await remotePage.waitForFunction(id=>!localStorage.getItem('testcenter-rewrite:participant-native-command:v1:'+id),ignored[0].request.deliveryId);}
          else assert.equal(ignored[0].application.command.terminationNoop,true);
          assert.equal(ignored[0].request.controllerStatus,'TERMINATED');await assertOnlyPreparedTimer();assert.deepEqual(await loadingRepository.getParticipantSessionById(baseline.participantSessionId),parent);
          await poll(async()=>(await loadingRepository.listParticipantTestLogsByWorkspace(baseline.tenantId,baseline.workspaceId)).filter(log=>log.testRunId===runId&&log.logKey==='command executed').length===logsBefore+1,'The fulfilled no-op completion was not persisted exactly once for its Run');
          assert.match(await remotePane.innerText(),/STATUS:\s*TERMINATED(?:\s|$)/);assert.equal(packets.filter(value=>value.request.keyword==='terminate'&&!value.request.terminationNoop).length,0);
        }
        if(scenario.later){await remotePage.evaluate(keyword=>window.tc[keyword](),scenario.later);await poll(async()=>new RegExp(`STATUS:\\s*${scenario.later==='pause'?'PAUSED':'RUNNING'}(?:\\s|$)`).test(await remotePane.innerText()),'A command arriving during terminal buffers did not enter its later phase');}
        releaseAnswer();
        if(scenario.later){
          const expected=scenario.later==='pause'?'paused':'running';await poll(async()=>packets.length===(scenario.initialPaused?3:2)&&(await loadingRepository.getTestRunById(runId)).status===expected,'A later phase did not survive terminal buffer completion');
          const terminal=packets.find(value=>value.request.keyword==='terminate'),later=packets.find(value=>value.request.keyword===scenario.later);assert.ok(terminal&&later);assert.ok(terminal.request.controllerDispatch.sequence<later.request.controllerDispatch.sequence);assert.equal(terminal.request.controllerStatus,scenario.initialPaused?'PAUSED':'RUNNING');
          await poll(async()=>new RegExp(`STATUS:\\s*${expected.toUpperCase()}(?:\\s|$)`).test(await remotePane.innerText()),'An old terminal receipt overwrote the later controller phase');
          assert.equal((await loadingRepository.getTestRunById(runId)).controllerEntry.active,true);
        }else{
          await poll(()=>Promise.resolve(runtimeHeld),'The terminal receipt did not reach its Starter reconciliation');
          const ended=await loadingRepository.getTestRunById(runId);assert.equal(ended.status,'paused');assert.equal(ended.controllerEntry.active,false);
          if(scenario.noop){const first=packets.find(value=>value.request.keyword==='terminate'&&!value.request.terminationNoop);assert.ok(first);assert.equal(first.application.superseded,undefined);assert.equal(ended.locked,false);const actor=first.request.controllerDispatch.controllerId;assert.equal(ended.controllerDispatches[actor],first.request.controllerDispatch.sequence);assert.ok(first.request.controllerDispatch.sequence<observation.ignored[0].request.controllerDispatch.sequence);observation.firstWaitingTerminationStillApplied=true;}
          await remotePage.evaluate(()=>window.tc.resume());await poll(async()=>(await loadingRepository.getTestRunById(runId)).status==='running','A fresh Resume did not reenter the terminated controller');
        }
        const saved=await loadingRepository.getTestRunById(runId);assert.deepEqual(saved.unitResponses,baseline.unitResponses);assert.deepEqual(saved.unitResponseFieldTimestamps,baseline.unitResponseFieldTimestamps);assert.deepEqual(await loadingRepository.getTestRunById(sibling.testRunId),siblingBefore);
        releaseRuntime();await remotePage.unrouteAll({behavior:'wait'});
        const previous=await remotePage.locator('iframe').count()?await remotePage.locator('iframe').elementHandle():null;
        await Promise.all([remotePage.waitForResponse(response=>new URL(response.url()).pathname.endsWith('/native-commands')&&response.request().postDataJSON().keyword==='resume'),remotePage.evaluate(()=>window.tc.resume())]);if(previous)await poll(()=>previous.evaluate(frame=>!frame.isConnected),'The terminal fixture did not finish its cleanup Resume');
        await poll(async()=>(await remotePage.frameLocator('iframe').locator('#demoPlayerAnswer').inputValue())===answer,'The renewed Player did not restore the exact trusted answer');
        await remotePage.frameLocator('iframe').locator('#demoPlayerAnswer').fill('3');await poll(async()=>JSON.parse(parseVeronaUnitResponse((await loadingRepository.getTestRunById(runId)).unitResponses['first-unit']).unitState.dataParts.answer)[0].value==='3','The terminal phase fixture did not settle its answer reset');before=await loadingRepository.getTestRunById(runId);
        const label=`forced-${scenario.origin}-terminal-before-buffers-${scenario.noop?'noop-'+scenario.noop:scenario.later?'later-'+scenario.later:'fresh-resume'}`;checks.push(label);console.log(`participant_console_loading=${label}:passed`);
      }finally{observation.finalRun=await loadingRepository.getTestRunById(runId);observation.body=await remotePage.locator('body').innerText().catch(()=> '');releaseAnswer();releaseRuntime();releaseAck();await remotePage.unrouteAll({behavior:'wait'}).catch(()=>{});}
    }
    // The preceding owned phase/error routes remove their handlers on exit.
    await remotePage.route("**/application",captureApplication);
    const terminalRuntimeGate=new Promise(done=>{releaseTerminalRuntime=done;});releases.push(releaseTerminalRuntime);
    let terminalRuntimeReads=0;
    const runtimePath=resolveRoutePath(productionApiRoutes.participant.getRuntimeState,{participantSessionId:before.participantSessionId});
    await remotePage.route(url=>url.pathname===runtimePath,async route=>{
      const response=await route.fetch();terminalRuntimeReads++;
      if(terminalRuntimeReads===1){assert.equal((await response.json()).runtimeState.participantSession.status,'signed_in');await terminalRuntimeGate;}
      await route.fulfill({response});
    });
    const previousFrame=await remotePage.locator('iframe').elementHandle();assert.ok(previousFrame);
    const terminalApplicationStart=applications.length;
    const terminate=(await api(workspace+`/monitor/open-runs/${runId}/commands`,{commandType:'complete'},operator)).command;
    await poll(()=>Promise.resolve(terminalRuntimeReads===1),'Terminal command did not hold its inactive runtime snapshot');
    await remotePage.evaluate(()=>window.tc.resume());
    await poll(async()=>{const run=await loadingRepository.getTestRunById(runId);return run.status==='running'&&(await loadingRepository.getParticipantSessionById(run.participantSessionId)).status==='launched';},'New native entry did not reactivate the terminated Run');
    await poll(()=>previousFrame.evaluate(frame=>!frame.isConnected),'New native receipt did not replace the prior Player');
    await remotePage.frameLocator('iframe').locator('#demoPlayerAnswer').waitFor();
    await poll(async()=>(await remotePage.frameLocator('iframe').locator('#demoPlayerAnswer').inputValue())==='3','The newer native entry did not restore its stored answer');
    await poll(async()=>/STATUS:\s*RUNNING/.test(await remotePane.innerText()),'New native receipt did not project the active entry');
    releaseTerminalRuntime();
    await poll(()=>Promise.resolve(terminalRuntimeReads>=2),'Late terminal runtime snapshot was not re-read for the newer entry');
    await remotePage.unrouteAll({behavior:'wait'});
    await remotePage.frameLocator('iframe').locator('#demoPlayerAnswer').waitFor();
    assert.equal(await remotePage.locator('#originalParticipantStarter mat-card').count(),0);
    assert.equal(new URL(remotePage.url()).searchParams.get('testRunId'),runId);
    const reentered=await loadingRepository.getTestRunById(runId);
    assert.deepEqual(reentered.unitResponses,before.unitResponses);assert.deepEqual(reentered.unitResponseFieldTimestamps,before.unitResponseFieldTimestamps);
    assert.deepEqual(await loadingRepository.getTestRunById(sibling.testRunId),siblingBefore);
    assert.deepEqual(applications.slice(terminalApplicationStart).map(value=>value.application.command.commandId),[terminate.commandId]);
    loadingObservations.push({testRunId:runId,remoteApplications:applications,acknowledgements:acks,terminalRuntimeReads,answersAndClocksPreserved:true,siblingPreserved:true,newerEntryRetained:true});
    checks.push('late-remote-termination-cannot-close-a-newer-native-entry');console.log('participant_console_loading=late-remote-termination-cannot-close-a-newer-native-entry:passed');
    const terminalDeferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return {promise,resolve};};
    for(const externalKeyword of ['resume','pause']) {
    if((await loadingRepository.getTestRunById(runId)).status==='paused') {
      await remotePage.evaluate(()=>window.tc.resume());
      await remotePage.frameLocator('iframe').locator('#demoPlayerAnswer').waitFor();
    }
    const externalPage=await remoteContext.newPage();externalPage.on('pageerror',error=>errors.push(String(error)));
    const runtimeRequest=terminalDeferred();releases.push(runtimeRequest.resolve);let runtimeRequested=false,runtimeRouteError,reactivatedRuntime;
    const externalBaseline=await loadingRepository.getTestRunById(runId),applicationStart=applications.length;
    const externalStatus=externalKeyword==='pause'?'paused':'running',followingKeyword=externalKeyword==='pause'?'resume':'pause';
    try {
      await externalPage.goto(remotePage.url(),{waitUntil:'networkidle'});
      await externalPage.waitForFunction(()=>typeof window.tc?.resume==='function');
      await externalPage.frameLocator('iframe').locator('#demoPlayerAnswer').waitFor();
      await remotePage.route('**/application',captureApplication);
      await remotePage.route(url=>url.pathname===runtimePath,async route=>{
        try {
          runtimeRequested=true;await runtimeRequest.promise;
          const response=await route.fetch();reactivatedRuntime=await response.json();await route.fulfill({response});
        }catch(error){runtimeRouteError=error;}
      });
      const terminalReceipt=remotePage.waitForResponse(response=>new URL(response.url()).pathname.endsWith('/native-commands')&&response.request().postDataJSON().keyword==='terminate');
      await remotePage.evaluate(()=>window.tc.terminate());
      const currentCredential=(await (await terminalReceipt).request().headerValue('authorization'))?.replace(/^Bearer /,'');assert.ok(currentCredential);
      await poll(()=>Promise.resolve(runtimeRequested),'The first controller did not hold its terminal runtime request');
      await poll(async()=>/STATUS:\s*TERMINATED/.test(await remotePane.innerText()),'The first controller did not enter TERMINATED before external reentry');
      const stopped=await loadingRepository.getTestRunById(runId);assert.equal(stopped.controllerEntry.active,false);
      if(externalKeyword==='pause') {
        await api(productionApiRoutes.participant.launch,{participantSessionId:stopped.participantSessionId,bookletKey:'second',controllerLifecycle:'browser-v1'},currentCredential);
        assert.deepEqual((await loadingRepository.getTestRunById(runId)).controllerEntry,stopped.controllerEntry,'Sibling entry must leave the selected entry closed.');
        assert.equal((await loadingRepository.getParticipantSessionById(stopped.participantSessionId)).status,'launched');
      }
      const externalReceipt=externalPage.waitForResponse(response=>new URL(response.url()).pathname.endsWith('/native-commands')&&response.request().postDataJSON().keyword===externalKeyword);
      await externalPage.evaluate(keyword=>window.tc[keyword](),externalKeyword);const externalApplication=(await (await externalReceipt).json()).application;
      assert.deepEqual(externalApplication.testRun.controllerEntry,{active:true,revision:stopped.controllerEntry.revision+1});
      assert.equal(externalApplication.applied,true);assert.equal(externalApplication.testRun.testRunId,runId);
      await poll(async()=>{
        const run=await loadingRepository.getTestRunById(runId);return run.status===externalStatus&&(await loadingRepository.getParticipantSessionById(run.participantSessionId)).status==='launched';
      },'The second page did not reactivate the same Run');
      let siblingAfter=siblingBefore;
      if(externalKeyword==='pause') {
        const siblingExit=await api(resolveRoutePath(productionApiRoutes.participant.getCurrentRunState,{participantSessionId:stopped.participantSessionId})+'?testRunId='+sibling.testRunId,undefined,currentCredential);
        const siblingRun=siblingExit.currentRunState.testRun;
        const result=await api(`/api/v1/participant/sessions/${stopped.participantSessionId}/native-commands`,{testRunId:siblingRun.testRunId,
          contentReleaseId:siblingRun.contentReleaseId,bookletKey:siblingRun.bookletKey,deliveryId:'owned-sibling-exit',keyword:'terminate',arguments:[],controllerStatus:'RUNNING',timeStamp:Date.now()},currentCredential);
        assert.equal(result.application.applied,true);assert.equal(result.application.participantSession.status,'signed_in');
        siblingAfter=await loadingRepository.getTestRunById(sibling.testRunId);assert.deepEqual(siblingAfter.unitResponses,siblingBefore.unitResponses);assert.deepEqual(siblingAfter.unitResponseFieldTimestamps,siblingBefore.unitResponseFieldTimestamps);
        assert.deepEqual((await loadingRepository.getTestRunById(runId)).controllerEntry,externalApplication.testRun.controllerEntry);
      }
      await externalPage.close();runtimeRequest.resolve();
      await poll(async()=>await remotePane.count()>0&&/BS:\s*live/.test(await remotePane.innerText()),externalKeyword==='pause'?'A fresh externally paused Run did not restore command reception':'A fresh externally reactivated Run did not restore command reception');
      await poll(async()=>new RegExp('STATUS:\\s*'+externalStatus.toUpperCase()).test(await remotePane.innerText()),'The first controller did not render the fresh externally reactivated Run');
      assert.equal(reactivatedRuntime.runtimeState.participantSession.status,externalKeyword==='pause'?'signed_in':'launched');
      const following=(await api(workspace+`/monitor/open-runs/${runId}/commands`,{commandType:followingKeyword},operator)).command;
      await poll(async()=>new RegExp('STATUS:\\s*'+(followingKeyword==='pause'?'PAUSED':'RUNNING')).test(await remotePane.innerText()),'The reactivated first controller did not apply a new remote Pause');
      await remotePage.unrouteAll({behavior:'wait'});if(runtimeRouteError)throw runtimeRouteError;
      const finalRun=await loadingRepository.getTestRunById(runId);assert.equal(finalRun.status,followingKeyword==='pause'?'paused':'running');
      assert.deepEqual(finalRun.unitResponses,externalBaseline.unitResponses);assert.deepEqual(finalRun.unitResponseFieldTimestamps,externalBaseline.unitResponseFieldTimestamps);
      assert.deepEqual(await loadingRepository.getTestRunById(sibling.testRunId),siblingAfter);
      if(externalKeyword==='pause')await loadingRepository.saveTestRun(siblingBefore);
      assert.deepEqual(applications.slice(applicationStart).map(value=>value.application.command.commandId),[following.commandId]);
      assert.deepEqual(applications.map(value=>value.application.command.executionSequence),applications.map((_,index)=>index+1));
      assert.equal(acks.filter(ack=>ack.path.includes(following.commandId)).length,1);
      loadingObservations.push({externalKeyword,siblingAfter,siblingTransitionsVerified:externalKeyword==='pause',stoppedEntry:stopped.controllerEntry,externalApplication,reactivatedRuntime,application:applications.at(-1),externalDocumentClosedBeforeNewCommand:true,
        sameRunReceptionRestored:true,answersAndClocksPreserved:true,siblingPreserved:externalKeyword!=='pause',
        siblingAnswersAndClocksPreserved:true,siblingChangedOnlyByItsOwnAcceptedCommand:externalKeyword==='pause',ownedSiblingFixtureRestoredForLaterGroups:externalKeyword==='pause'});
      await remotePage.screenshot({path:join(artifacts,`external-${externalKeyword}-reception.png`),fullPage:true});
      const marker=externalKeyword==='pause'?'a-newer-paused-entry-restores-reception-despite-sibling-parent-transitions':'an-external-same-run-entry-restores-the-rendered-controller-reception';checks.push(marker);console.log(`participant_console_loading=${marker}:passed`);
    }catch(error){await remotePage.screenshot({path:join(artifacts,`external-${externalKeyword}-failure.png`),fullPage:true}).catch(()=>{});throw error;}
    finally{runtimeRequest.resolve();await remotePage.unrouteAll({behavior:'wait'}).catch(()=>{});if(!externalPage.isClosed())await externalPage.close();}
    }
    await remotePage.evaluate(()=>window.tc.resume());
    await remotePage.frameLocator('iframe').locator('#demoPlayerAnswer').waitFor();
    const gotoApplicationStart=applications.length;
    await remotePage.route('**/application',captureApplication);
    const activeGotoViews=new Set();let gotoHeld=false,gotoReleased=false,gotoRouteError;const gotoGate=new Promise(done=>{releaseGotoView=()=>{gotoReleased=true;done();};});releases.push(releaseGotoView);
    await remotePage.route('**/current-state?*',async route=>{
      activeGotoViews.add(route);
      try {
        const response=await route.fetch(),data=await response.json();
        if(!gotoReleased&&data.currentRunState.testRun.currentUnitKey==='next-unit'&&data.currentRunState.testRun.status==='running'){gotoHeld=true;await gotoGate;}
        await route.fulfill({response});
      } catch(error) {
        const failure=route.request().failure();
        if(failure&&/abort|cancel/i.test(failure.errorText))loadingObservations.push({cancelledGotoView:failure.errorText});
        else gotoRouteError=error;
      } finally {activeGotoViews.delete(route);}
    });
    const goto=(await api(workspace+`/monitor/open-runs/${runId}/commands`,{commandType:'goto',targetUnitKey:'next-unit'},operator)).command;
    await poll(()=>Promise.resolve(gotoHeld),'Remote Goto did not request its target view');
    await poll(async()=>(await remotePage.locator('iframe:visible').count())===0,'Remote Goto kept the former Unit active while target metadata was held');
    assert.deepEqual((await loadingRepository.getTestRunById(runId)).unitResponses,before.unitResponses);
    await remotePage.screenshot({path:join(artifacts,'remote-goto-held-target.png'),fullPage:true});
    const gotoPause=(await api(workspace+`/monitor/open-runs/${runId}/commands`,{commandType:'pause'},operator)).command;
    await poll(async()=>/STATUS:\s*PAUSED/.test(await remotePane.innerText()),'Remote Pause waited behind the held Goto target view');
    releaseGotoView();await poll(()=>Promise.resolve(activeGotoViews.size===0),'A released Goto view route did not settle');
    await remotePage.unrouteAll({behavior:'ignoreErrors'});
    await remotePage.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
    if(gotoRouteError)throw gotoRouteError;
    assert.match(await remotePane.innerText(),/STATUS:\s*PAUSED/,'Late Goto view reverted the following Pause');
    await remotePage.route('**/application',captureApplication);
    const gotoResume=(await api(workspace+`/monitor/open-runs/${runId}/commands`,{commandType:'resume'},operator)).command;
    await remotePage.frameLocator('iframe').locator('#demoPlayerAnswer').waitFor();
    assert.equal(await remotePage.frameLocator('iframe').locator('#demoPlayerAnswer').inputValue(),'');
    const navigated=await loadingRepository.getTestRunById(runId);assert.equal(navigated.currentUnitKey,'next-unit');
    assert.deepEqual(navigated.unitResponses,before.unitResponses);assert.deepEqual(navigated.unitResponseFieldTimestamps,before.unitResponseFieldTimestamps);
    assert.deepEqual(await loadingRepository.getTestRunById(sibling.testRunId),siblingBefore);
    assert.deepEqual(applications.slice(gotoApplicationStart).map(value=>value.application.command.commandId),[goto.commandId,gotoPause.commandId,gotoResume.commandId]);
    assert.deepEqual(applications.map(value=>value.application.command.executionSequence),applications.map((_,index)=>index+1));
    assert.equal(acks.length,applications.length);assert.ok(acks.every(ack=>ack.body.testRunId===runId));
    loadingObservations.push({testRunId:runId,gotoApplications:applications.slice(gotoApplicationStart),answersAndClocksPreserved:true,siblingPreserved:true,formerUnitRetiredBeforeTargetView:true});
    checks.push('remote-goto-retires-the-former-unit-and-keeps-following-commands-live');console.log('participant_console_loading=remote-goto-retires-the-former-unit-and-keeps-following-commands-live:passed');

    await remotePage.unrouteAll({behavior:'wait'});
    for(const origin of ['remote','native']) {
      if((await loadingRepository.getTestRunById(runId)).status==='paused') {
        await remotePage.evaluate(()=>window.tc.resume());
        await remotePage.frameLocator('iframe').locator('#demoPlayerAnswer').waitFor();
      }
      await poll(async()=>/BS:\s*live/.test(await remotePane.innerText()),'Reception did not become live before the terminal case');
      const baseline=await loadingRepository.getTestRunById(runId),start=applications.length;
      const heldRuntime=terminalDeferred(),heldView=terminalDeferred(),completeAck=terminalDeferred(),resumeAck=terminalDeferred();
      releases.push(heldRuntime.resolve,heldView.resolve,completeAck.resolve,resumeAck.resolve);
      let runtimeReads=0,viewHeld=false,viewReleased=false,routeError;
      const heldAcks=[],issued=[];
      const routeFailure=(route,error)=>{
        const failure=route.request().failure();
        if(failure&&/abort|cancel/i.test(failure.errorText))loadingObservations.push({cancelledTerminalView:failure.errorText});
        else routeError=error;
      };
      try {
        await remotePage.route('**/application',captureApplication);
        await remotePage.route(url=>url.pathname===runtimePath,async route=>{
          try {
            const response=await route.fetch();runtimeReads++;
            if(runtimeReads===1){assert.equal((await response.json()).runtimeState.participantSession.status,'signed_in');await heldRuntime.promise;}
            await route.fulfill({response});
          } catch(error) {routeFailure(route,error);}
        });
        await remotePage.route('**/current-state?*',async route=>{
          try {
            const response=await route.fetch(),data=await response.json();
            if(!viewReleased&&data.currentRunState.testRun.status==='running'){viewHeld=true;await heldView.promise;}
            await route.fulfill({response});
          } catch(error) {routeFailure(route,error);}
        });
        if(origin==='remote') {
          await remotePage.route('**/commands/*/acknowledgement',async route=>{
            if(route.request().method()!=='PATCH')return route.continue();
            try {
              const response=await route.fetch(),command=(await response.json()).command;
              assert.ok(command.acknowledgedAt);heldAcks.push(command);
              await (command.commandType==='complete'?completeAck.promise:resumeAck.promise);
              await route.fulfill({response});
            } catch(error) {routeFailure(route,error);}
          });
          for(const commandType of ['complete','resume'])issued.push((await api(workspace+`/monitor/open-runs/${runId}/commands`,{commandType},operator)).command);
          await poll(()=>{if(routeError)throw routeError;return Promise.resolve(heldAcks.length===2);},'Both remote commands were not accepted before termination');
          assert.deepEqual(heldAcks.map(command=>command.commandId),issued.map(command=>command.commandId));
          completeAck.resolve();
        } else await remotePage.evaluate(()=>window.tc.terminate());
        await poll(()=>Promise.resolve(runtimeReads===1),`${origin} termination did not hold its Starter runtime`);
        await poll(async()=>/STATUS:\s*TERMINATED/.test(await remotePane.innerText()),`${origin} terminal receipt waited for its held Starter runtime`);
        await poll(async()=>!/BS:\s*live/.test(await remotePane.innerText()),`${origin} termination did not suspend new reception`);
        assert.equal(await remotePage.locator('iframe:visible').count(),0);
        if(origin==='remote')resumeAck.resolve();else await remotePage.evaluate(()=>window.tc.resume());
        await poll(async()=>{
          const run=await loadingRepository.getTestRunById(runId);
          return run.status==='running'&&(await loadingRepository.getParticipantSessionById(run.participantSessionId)).status==='launched';
        },`${origin} accepted Resume waited behind terminal presentation or left the parent inactive`);
        await poll(()=>Promise.resolve(viewHeld),`${origin} Resume did not hold its following Unit view`);
        await poll(async()=>/STATUS:\s*RUNNING/.test(await remotePane.innerText()),`${origin} Resume did not project before its Unit view`);
        await poll(async()=>/BS:\s*live/.test(await remotePane.innerText()),`${origin} Resume did not reopen reception before its Unit view`);
        // The held ACK routes are only needed for the two preaccepted receipts.
        await remotePage.unroute('**/commands/*/acknowledgement');
        const following=(await api(workspace+`/monitor/open-runs/${runId}/commands`,{commandType:'pause'},operator)).command;issued.push(following);
        await poll(async()=>/STATUS:\s*PAUSED/.test(await remotePane.innerText()),`${origin} reopened reception did not apply a fresh Pause while views were held`);
        heldRuntime.resolve();
        await poll(()=>Promise.resolve(runtimeReads>=2),`${origin} stale Starter runtime was not reread after Resume/Pause`);
        viewReleased=true;heldView.resolve();
        await remotePage.unrouteAll({behavior:'wait'});
        if(routeError)throw routeError;
        assert.equal(await remotePage.locator('#originalParticipantStarter mat-card').count(),0);
        assert.match(await remotePane.innerText(),/STATUS:\s*PAUSED/);
        assert.equal(new URL(remotePage.url()).searchParams.get('testRunId'),runId);
        const finalRun=await loadingRepository.getTestRunById(runId);
        assert.equal(finalRun.status,'paused');assert.equal(finalRun.currentUnitKey,baseline.currentUnitKey);
        assert.deepEqual(finalRun.unitResponses,baseline.unitResponses);
        assert.deepEqual(finalRun.unitResponseFieldTimestamps,baseline.unitResponseFieldTimestamps);
        assert.deepEqual(await loadingRepository.getTestRunById(sibling.testRunId),siblingBefore);
        assert.equal((await loadingRepository.getParticipantSessionById(finalRun.participantSessionId)).status,'launched');
        assert.deepEqual(applications.slice(start).map(value=>value.application.command.commandId),issued.map(command=>command.commandId));
        assert.ok(applications.slice(start).every(value=>value.application.applied&&value.application.command.executedAt));
        assert.deepEqual(applications.map(value=>value.application.command.executionSequence),applications.map((_,index)=>index+1));
        for(const command of issued)assert.equal(acks.filter(ack=>ack.path.includes(command.commandId)).length,1);
        loadingObservations.push({origin,testRunId:runId,applications:applications.slice(start),acceptedBeforeTermination:heldAcks,runtimeReads,
          terminalReceptionSuspended:true,acceptedResumeIndependentOfStarter:true,receptionReopenedBeforeUnitView:true,freshPauseApplied:true,answersAndClocksPreserved:true,siblingPreserved:true});
        await remotePage.screenshot({path:join(artifacts,`${origin}-terminal-presentation-independent.png`),fullPage:true});
        const marker=`${origin}-terminal-presentation-keeps-accepted-resume-and-reception-independent`;
        checks.push(marker);console.log(`participant_console_loading=${marker}:passed`);
      } finally {
        heldRuntime.resolve();viewReleased=true;heldView.resolve();completeAck.resolve();resumeAck.resolve();
        await remotePage.unrouteAll({behavior:'wait'}).catch(()=>{});
      }
    }

  }finally{releasePausedView();releaseTerminalRuntime?.();releaseGotoView?.();await remotePage.unrouteAll({behavior:"ignoreErrors"}).catch(()=>{});await remoteContext.close();}
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
  const gotoReceipt=deferred(),finalSaveReceipt=deferred();releases.push(gotoReceipt.resolve,finalSaveReceipt.resolve);let gotoReceiptHeld=false,finalSaveHeld=false;
  await page.route('**/native-commands',async route=>{
    if(route.request().postDataJSON().keyword!=='goto'){await route.continue();return;}
    const response=await route.fetch();gotoReceiptHeld=true;await gotoReceipt.promise;await route.fulfill({response});
  });
  await page.route('**/save-progress',async route=>{
    const body=route.request().postDataJSON();let final=false;
    try{final=body.responseUnitKey==='first-unit'&&JSON.parse(parseVeronaUnitResponse(body.unitResponse).unitState.dataParts.answer)[0].value==='7';}catch{}
    if(!final){await route.continue();return;}
    const response=await route.fetch();finalSaveHeld=true;await finalSaveReceipt.promise;await route.fulfill({response});
  });
  await page.route('**/current-state?*',async route=>{const response=await route.fetch();gotoHeld=true;await gotoView.promise;await route.fulfill({response});gotoDone.resolve();});
  await page.frameLocator('iframe').locator('#demoPlayerAnswer').fill('4');await native('goto',['2']);
  await poll(()=>Promise.resolve(gotoReceiptHeld),'Goto did not hold its confirmed application reply');
  // The server has changed selection, but the receipt has not yet reached this
  // controller. Actual input still belongs to its authenticated former frame.
  await page.frameLocator('iframe').locator('#demoPlayerAnswer').fill('7');
  await page.waitForFunction(()=>JSON.parse(localStorage.getItem('testcenter-rewrite:participant-save-outbox:v1')||'{"entries":[]}').entries.some(entry=>{
    try{return entry.unitKey==='first-unit'&&!entry.logOnly&&JSON.parse(JSON.parse(entry.response).unitState.dataParts.answer)[0].value==='7';}catch{return false;}
  }));
  await poll(()=>Promise.resolve(finalSaveHeld),'The trusted former-Unit answer receipt was not held');
  gotoReceipt.resolve();await poll(()=>Promise.resolve(gotoHeld),'Goto did not hold its next Unit view');
  await poll(async()=>(await page.locator('iframe').count())===0,'Goto must retire its former Unit while the target view is held');
  await native('terminate');finalSaveReceipt.resolve();await page.locator('#originalParticipantStarter mat-card').first().waitFor();
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
  const secondControllerLogs = async () => (await repository.listParticipantTestLogsByWorkspace(secondRun.tenantId,secondRun.workspaceId))
    .filter(log=>log.testRunId===secondRun.testRunId&&log.logKey==='CONTROLLER').sort((a,b)=>a.timestamp-b.timestamp||a.participantTestLogId.localeCompare(b.participantTestLogId));
  await poll(async()=>(await secondControllerLogs()).some(log=>log.logContent==='ERROR'),'Pre-Unit ERROR was not persisted');
  assert.deepEqual((await secondControllerLogs()).map(log=>log.logContent),['LOADING','ERROR']);

  await native('resume');await page.frameLocator('iframe').locator('#demoPlayerAnswer').waitFor();
  await poll(async()=>!await page.locator('mat-dialog-container, #participantRuntimeErrorFallback').count(),'Early Resume did not clear the error presentation');
  assert.deepEqual((await repository.getTestRunById(secondRun.testRunId)).unitResponses,secondRun.unitResponses);
  assert.deepEqual((await repository.getTestRunById(secondRun.testRunId)).unitResponseFieldTimestamps,secondRun.unitResponseFieldTimestamps);
  assert.deepEqual((await secondControllerLogs()).map(log=>log.logContent),['LOADING','ERROR','RUNNING']);
  mark('native-resume-recovers-before-the-first-unit-was-loaded');
  await page.unrouteAll({behavior:'wait'});
  // A new document has no in-memory authorized Run: its lightweight context must
  // establish scope even when the following full-state request fails.
  await page.waitForURL(url=>url.searchParams.get('testRunId')===secondRun.testRunId);
  const reloadEntry=page.url();let reloadFailure=false,contexts=0;
  let lostLogPacket=null,ackFailure=true,logReplayAllowed=false;const lostLogAttempts=[];
  await page.route('**/test-logs',async route=>{
    const packet=route.request().postDataJSON(),entry=packet.logs?.[0]?.entries?.[0];
    if(lostLogPacket&&entry?.clientEntryId===lostLogPacket.logs[0].entries[0].clientEntryId)lostLogAttempts.push(packet);
    if(ackFailure&&entry?.key==='CONTROLLER'&&entry.content==='LOADING'){
      ackFailure=false;lostLogPacket=packet;lostLogAttempts.push(packet);const response=await route.fetch();assert.equal(response.status(),200);
      await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'owned_lost_log_receipt'})});
    }else if(!logReplayAllowed&&entry?.key==='CONTROLLER')await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'owned_log_retry_held'})});
    else await route.continue();
  });

  page.on('request',request=>{if(new URL(request.url()).pathname.endsWith('/controller-context'))contexts++;});
  await page.route('**/current-state?*',async route=>{
    reloadFailure=true;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'owned_reload_load_failure',message:'Owned reload load failure'})});
  });
  await page.goto(reloadEntry,{waitUntil:'networkidle'});await allMethods();await native('debug');await pane().waitFor();
  await poll(async()=>/STATUS:\s*ERROR/.test(await pane().innerText()),'Reload ERROR had no authorized console');
  await poll(()=>Promise.resolve(Boolean(lostLogPacket)),'Owned lifecycle receipt loss was not injected');
  const lostEntry=lostLogPacket.logs[0].entries[0];
  await page.waitForFunction(id=>Object.keys(localStorage).some(key=>key.startsWith('testcenter-rewrite:participant-controller-log:v1:')&&JSON.parse(localStorage.getItem(key)).id===id),lostEntry.clientEntryId);
  logReplayAllowed=true;
  await page.goto(reloadEntry,{waitUntil:'networkidle'});await allMethods();await native('debug');await pane().waitFor();
  await poll(async()=>/STATUS:\s*ERROR/.test(await pane().innerText()),'Second reload lost the authorized error controller');
  await poll(async()=>(await secondControllerLogs()).filter(log=>log.logContent==='ERROR').length===3,'Pending lifecycle packets did not finish after reload');
  const replayed=(await secondControllerLogs()).filter(log=>log.participantTestLogId===`delivery:${secondRun.testRunId}:${lostEntry.clientEntryId}`);
  assert.ok(lostLogAttempts.length>=2);assert.ok(lostLogAttempts.every(packet=>JSON.stringify(packet)===JSON.stringify(lostLogPacket)));
  assert.equal(replayed.length,1);assert.equal(replayed[0].timestamp,lostEntry.timeStamp);assert.equal(replayed[0].logContent,'LOADING');
  await page.waitForFunction(()=>!Object.keys(localStorage).some(key=>key.startsWith('testcenter-rewrite:participant-controller-log:v1:')));
  mark('lost-lifecycle-receipt-reloads-with-the-same-timestamp-and-id-once');

  assert.deepEqual((await secondControllerLogs()).map(log=>log.logContent),['LOADING','ERROR','RUNNING','LOADING','ERROR','LOADING','ERROR']);
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
