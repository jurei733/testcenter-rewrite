import { raceWithSmokeDeadline } from "./smoke-deadline.mjs";
import { loadOriginalVisualReference, assertOriginalVisualBrowser } from "./qualified-original-visuals.mjs";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { parseVeronaUnitResponse } from "@testcenter-rewrite-app/contracts";
import { localDemoSourcePackage } from "../apps/api/dist/apps/api/src/local-demo-bootstrap.js";
import { runtimeErrorPlayer } from "./runtime-error-fixture.mjs";
import { runtimeErrorContractCases } from "./runtime-error-contract-fixture.mjs";
import { createServerRequestFailureGate } from "./server-request-failure-gate.mjs";

const root = resolve(process.env.UI_SMOKE_FRONTEND_ROOT || ".");
await access(join(root, "dist/apps/web/browser/index.html"));
const contract = process.env.UI_SMOKE_RUNTIME_CONTRACT === "true";
const reference = await loadOriginalVisualReference(contract ? "original-runtime-error-contract" : "original-runtime-error");
assert.equal(reference.referenceRevision, "ee2ab9ab64bd91209ef8534bbe6005838024e46d");
if (contract) assert.deepEqual(Object.keys(reference.cases), runtimeErrorContractCases.map(s => s.key));
if (process.env.UI_SMOKE_ONLY_CASE) assert.ok(Object.hasOwn(reference.cases, process.env.UI_SMOKE_ONLY_CASE), "The requested runtime case must exist.");
const artifacts = await mkdtemp(join(tmpdir(), "testcenter-runtime-error-"));
console.log(`owned_artifacts=${artifacts}`);
const failureGate = createServerRequestFailureGate();
const module = pathToFileURL(resolve("apps/api/dist/apps/api/src/index.js")).href;
const server = spawn(process.execPath, ["--input-type=module", "-e", `
  import { createProductionApiServer } from ${JSON.stringify(module)};
  const server = await createProductionApiServer();
  server.listen(0, '127.0.0.1', () => process.send({port:server.address().port}));
  process.once('SIGTERM', () => server.close(() => process.exit(0)));
`], { cwd: root, env: { ...process.env, FIRST_SLICE_STORE: "sqlite", FIRST_SLICE_SQLITE_FILE: join(artifacts, "own.sqlite"),
  FIRST_SLICE_BOOTSTRAP_DEMO: "true", FIRST_SLICE_OPERATOR_AUTH_REQUIRED: "true", FIRST_SLICE_PROOF_OF_WORK_SCOPES: "",
  FIRST_SLICE_XML_SCHEMA_PROFILE: "legacy-compatibility", REQUIRE_LOGIN_PASSWORD: "false" }, stdio: ["ignore", "pipe", "pipe", "ipc"] });
failureGate.observeStream(server.stdout); failureGate.observeStream(server.stderr);
const serverClosed = new Promise(done => server.once("close", done));
const errors = [], states = {}; let browser;
const failDialog = process.env.UI_SMOKE_RUNTIME_DIALOG_FAILURE === "true";
const saveFailure = process.env.UI_SMOKE_RUNTIME_SAVE_FAILURE;
const replacementMode = process.env.UI_SMOKE_RUNTIME_REPLACEMENT;
const monitorCommand = process.env.UI_SMOKE_RUNTIME_LATE_COMMAND;
const receivedPauseOldSave = process.env.UI_SMOKE_RUNTIME_RECEIVED_PAUSE_OLD_SAVE === 'true';
const receivedPause = process.env.UI_SMOKE_RUNTIME_RECEIVED_PAUSE === 'true' || receivedPauseOldSave;
const receivedResume = process.env.UI_SMOKE_RUNTIME_RECEIVED_RESUME === 'true';
const receivedTerminate = process.env.UI_SMOKE_RUNTIME_RECEIVED_TERMINATE === 'true';
const lateSavePause = process.env.UI_SMOKE_RUNTIME_LATE_SAVE_PAUSE === 'true';
const commandOverlap = JSON.parse(await readFile(new URL('./fixtures/original-runtime-command-overlap.json', import.meta.url), 'utf8'));
assert.equal(commandOverlap.referenceRevision, reference.referenceRevision);
assert.ok(!monitorCommand || ['pause','complete'].includes(monitorCommand));
assert.ok(!(monitorCommand && receivedPause));
assert.ok(!(lateSavePause && (monitorCommand || receivedPause || replacementMode || saveFailure)));
assert.ok(!(receivedResume && (monitorCommand || receivedPause || lateSavePause || replacementMode || saveFailure)));
assert.ok(!(receivedTerminate && (monitorCommand || receivedResume || receivedPause || lateSavePause || replacementMode || saveFailure)));
assert.ok(!replacementMode || ["success", "reject"].includes(replacementMode));
try {
  const port = await new Promise((done, reject) => {
    const timer = setTimeout(() => reject(Error("Owned API did not start")), 20_000);
    server.once("message", ({ port }) => { clearTimeout(timer); done(port); });
    server.once("error", error => { clearTimeout(timer); reject(error); });
    server.once("exit", () => { clearTimeout(timer); reject(Error("Owned API exited before startup")); });
  });
  const base = `http://127.0.0.1:${port}`;
  const api = async (path, body, token, method = body === undefined ? "GET" : "POST") => {
    const response = await fetch(base + path, { method, headers: { ...(token ? {authorization:`Bearer ${token}`} : {}),
      ...(body === undefined ? {} : {"content-type":"application/json"}) }, ...(body === undefined ? {} : {body:JSON.stringify(body)}) });
    const payload = response.status === 204 ? null : await response.json();
    assert.ok(response.status === 200 || response.status === 201, `${method} ${path}: ${response.status}: ${JSON.stringify(payload)}`);
    return payload;
  };
  const poll = async (read, predicate) => {
    let value;
    for (let attempt = 0; attempt < 100; attempt++) { value = await read(); if (predicate(value)) return value; await delay(100); }
    assert.fail(`Owned API condition did not settle: ${JSON.stringify(value)}`);
  };
  const operator = (await api("/api/v1/admin/auth/sign-in", {username:"demo-admin",password:"demo-admin-password"})).sessionToken;
  browser = await chromium.launch({headless:process.env.CI === "true" && process.env.UI_SMOKE_HEADFUL !== "true"});
  assertOriginalVisualBrowser(browser, reference);
  for (const [key, expected] of Object.entries(reference.cases)) {
    if (process.env.UI_SMOKE_ONLY_CASE && key !== process.env.UI_SMOKE_ONLY_CASE) continue;
    const scenario = expected.definition;
    const [, theme, screen] = contract ? [null, scenario.theme, scenario.screen] : key.match(/^run-hot-return-(Primar|Sekundar|Erwachsene)-(desktop|mobile)-forbidden-false$/);
    const workspaceKey = `runtime-${key.toLowerCase()}`, workspace = `/api/v1/tenants/demo-tenant/workspaces/${workspaceKey}`;
    await api("/api/v1/tenants/demo-tenant/workspaces", {workspaceKey,displayName:workspaceKey}, operator);
    const content = JSON.parse(localDemoSourcePackage.sourceDocument);
    content.playerEntries[0].html = runtimeErrorPlayer(content.playerEntries[0].html, contract ? {...scenario, code:scenario.code} : {});
    content.bookletEntries = [{bookletKey:"owned-exit",displayLabel:"Logo Testheft",...(contract ? {customTexts:scenario.bookletCustomTexts} : {}),config:{silent_mode:"FALSE",
      force_presentation_complete:"ALWAYS",force_response_complete:"ALWAYS",toolbar_show_unit_list:"FALSE",
      toolbar_show_fullscreen_button:"FALSE",toolbar_show_reload_button:"FALSE",navbar_unit_label:"HIDDEN",navbar_page_label:"HIDDEN"},
      testletEntries:[{testletKey:"timed",displayLabel:"Zeitblock",parentTestletKey:null,
        restrictions:{timeMax:{minutes:5,leave:"forbidden"},lockAfterLeaving:{scope:"unit",confirm:true}}}],
      unitEntries:[{...content.bookletEntries[0].unitEntries[0],displayLabel:"Logo Aufgabe",testletPath:["timed"]}]}];
    const source = await api(workspace + "/source-packages", {fileName:"runtime.json",mediaType:"application/json",contentStructure:content}, operator);
    const imported = await api(workspace + "/import-jobs", {sourcePackageId:source.sourcePackage.sourcePackageId}, operator);
    await api(workspace + `/content-releases/${imported.stagedContentRelease.contentReleaseId}/activate`, {activatedByActorId:"runtime-proof"}, operator);
    await api(workspace + "/participant-roster", {rosterText:contract ? JSON.stringify([{loginKey:"exit-person",groupKey:"owned",groupLabel:"Exit Group",displayName:"exit-person",executionMode:"run-hot-return",booklets:[{id:"owned-exit"}],customTexts:scenario.loginCustomTexts}]) : '<Testtakers><Group id="owned" label="Exit Group"><Login mode="run-hot-return" name="exit-person"><Booklet>owned-exit</Booklet></Login></Group></Testtakers>'}, operator);
    await api("/api/v1/admin/application-settings", {themeName:theme, ...(contract ? {customTexts:scenario.applicationCustomTexts} : {})}, operator, "PATCH");
    const context = await browser.newContext({viewport:screen === "desktop" ? {width:1280,height:720} : {width:390,height:844},locale:"de-DE"});
    if (failDialog) {
      const assets = await readdir(join(root, "dist/apps/web/browser"));
      const matches = [];
      for (const asset of assets.filter(a => a.endsWith(".js"))) {
        if (/selectors:\s*\[\s*\[\s*"app-original-participant-error-launcher"/.test(await readFile(join(root, "dist/apps/web/browser", asset), "utf8"))) matches.push(asset);
      }
      assert.equal(matches.length, 1, "The actual error-dialog lazy bundle must be unambiguous.");
      await context.route(`**/${matches[0]}`, route => route.abort("failed"));
    }
    const page = await context.newPage(); page.on("pageerror", error => errors.push({key,error:String(error)}));
    await page.bringToFront();
    await page.goto(`${base}/app/participant?ui=original&theme=${theme}&tenantKey=demo-tenant&workspaceKey=${workspaceKey}`, {waitUntil:"networkidle"});
    await page.locator("#originalLoginName").fill("exit-person");
    const [signedIn] = await Promise.all([
      page.waitForResponse(r => new URL(r.url()).pathname === "/api/v1/participant/auth/sign-in" && r.request().method() === "POST"),
      page.getByRole("button", {name:"Weiter",exact:true}).click()
    ]);
    const identity = await signedIn.json(), token = identity.sessionToken;
    const currentPath = `/api/v1/participant/sessions/${identity.participantSession.participantSessionId}/current-state`;
    const currentState = async () => (await api(currentPath, undefined, token)).currentRunState;
    const frame = page.frameLocator("iframe"); await frame.locator("#ownedRuntimeError").waitFor();
    const element = await page.locator("iframe").elementHandle();
    const answer = `Own incomplete ${key} Ω  whitespace`;
    await frame.locator("#demoPlayerAnswer").fill(answer);
    await frame.locator("#exitPresentation").selectOption("some"); await frame.locator("#exitResponse").selectOption("none");
    const current = await poll(currentState, s => {
      const p = parseVeronaUnitResponse(s.testRun.unitResponses["unit-intro"] || "");
      return p?.unitState.presentationProgress === "some" && p.unitState.responseProgress === "none" && p.unitState.dataParts.answer === answer;
    });
    const runId = current.testRun.testRunId;
    let packet = current.testRun.unitResponses["unit-intro"];
    if (monitorCommand || receivedPause || lateSavePause || receivedResume || receivedTerminate) await page.locator('#participantRouteConnectionState[data-status="live"]').waitFor({state:'attached'});
    let releaseReceivedTerminate, releaseStoppedResume, terminalCommandId, stoppedResumeCommandId;
    if (receivedTerminate) {
      const receipts = new Map();
      let terminalAccepted, resumeAccepted;
      const accepted = Promise.all([new Promise(done => { terminalAccepted = done; }), new Promise(done => { resumeAccepted = done; })]);
      const terminalGate = new Promise(done => { releaseReceivedTerminate = done; });
      const resumeGate = new Promise(done => { releaseStoppedResume = done; });
      await context.route('**/api/v1/participant/sessions/**/commands/*/acknowledgement', async route => {
        const response = await route.fetch(); const body = await response.json();
        if (body.command?.testRunId === runId && !receipts.has(body.command.commandId)) {
          assert.ok(body.command.acknowledgedAt); assert.equal(body.command.executedAt, null);
          receipts.set(body.command.commandId, body.command);
          if (body.command.commandType === 'complete') { terminalAccepted(); await terminalGate; }
          else if (body.command.commandType === 'resume') { resumeAccepted(); await resumeGate; }
        }
        await route.fulfill({ response });
      });
      terminalCommandId = (await api(workspace + `/monitor/open-runs/${runId}/commands`, { commandType:'complete', actorId:'owned-received-terminate' }, operator)).command.commandId;
      stoppedResumeCommandId = (await api(workspace + `/monitor/open-runs/${runId}/commands`, { commandType:'resume', actorId:'owned-stopped-resume' }, operator)).command.commandId;
      let timer;
      try { await Promise.race([accepted, new Promise((_, reject) => { timer = setTimeout(() => reject(Error('Owned termination/resume acknowledgements did not start')), 15000); })]); }
      finally { clearTimeout(timer); }
      assert.equal(receipts.size, 2); assert.equal((await currentState()).testRun.status, 'running');
    }
    let releaseReceivedResume, receivedResumeCommand, receivedResumeReceipt;
    if (receivedResume) {
      let accepted, held=false;
      const started=new Promise(done=>{accepted=done;});
      const gate=new Promise(done=>{releaseReceivedResume=done;});
      await context.route('**/api/v1/participant/sessions/**/commands/*/acknowledgement',async route=>{
        const response=await route.fetch();const body=await response.json();
        if(!held && body.command?.testRunId===runId && body.command.commandType==='resume'){
          assert.ok(body.command.acknowledgedAt);
          held=true;receivedResumeReceipt=body.command;accepted();await gate;
        }
        await route.fulfill({response});
      });
      const issued=await api(workspace+`/monitor/open-runs/${runId}/commands`,{commandType:'resume',actorId:'owned-received-resume'},operator);
      assert.equal(issued.command.testRun.status,current.testRun.status);
      assert.equal(issued.command.testRun.currentUnitKey,current.testRun.currentUnitKey);
      receivedResumeCommand=issued.command.commandId;
      let timer;
      try{await Promise.race([started,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Owned same-status resume acknowledgement did not start')),15000);})]);}
      finally{clearTimeout(timer);}
      assert.equal(receivedResumeReceipt.commandId,receivedResumeCommand);
    }
    let releaseBeforePauseSave, releaseAfterPauseLog;
    if (receivedPauseOldSave) {
      let started,held=false;
      const ready=new Promise(done=>{started=done;}),gate=new Promise(done=>{releaseBeforePauseSave=done;}),logGate=new Promise(done=>{releaseAfterPauseLog=done;});
      await context.route(`**/api/v1/participant/test-runs/${encodeURIComponent(runId)}/save-progress`,async route=>{
        const requestPacket=parseVeronaUnitResponse(route.request().postDataJSON().unitResponse ?? '');
        if (!held && requestPacket?.unitState.dataParts.answer===answer+' before pause') {
          held=true;const response=await route.fetch();const body=await response.json();
          assert.equal(body.testRun.status,'running');packet=body.testRun.unitResponses['unit-intro'];
          started();await gate;await route.fulfill({response});
        } else {
          const body=route.request().postDataJSON();
          if(body.logs?.some(batch=>batch.entries.some(entry=>entry.key==='Runtime Error: runtime-error')))await logGate;
          await route.continue();
        }
      });
      await frame.locator('#demoPlayerAnswer').fill(answer+' before pause');
      let timer;
      try {await Promise.race([ready,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Owned pre-pause save response did not arrive')),15000);})]);}
      finally {clearTimeout(timer);}
      assert.equal(parseVeronaUnitResponse(packet).unitState.dataParts.answer,answer+' before pause');
    }
    let releaseLateSave, lateSaveStarted;
    if (lateSavePause) {
      const gate = new Promise(done=>{releaseLateSave=done;});
      let started, held=false;
      lateSaveStarted = new Promise(done=>{started=done;});
      await context.route(`**/api/v1/participant/test-runs/${encodeURIComponent(runId)}/save-progress`, async route=>{
        const body=route.request().postDataJSON();
        if (!held && body.logs?.some(batch=>batch.entries.some(entry=>entry.key==='Runtime Error: runtime-error'))) {
          held=true;started();await gate;
        }
        await route.continue();
      });
    }
    let releaseReceivedPause, receivedPauseCommand, receivedPauseReceipt;
    if (receivedPause) {
      let pausedRequest;
      const started = new Promise(done=>{pausedRequest=done;});
      const gate = new Promise(done=>{releaseReceivedPause=done;});
      let held = false;
      await context.route('**/api/v1/participant/sessions/**/commands/*/acknowledgement', async route=>{
        const response = await route.fetch();
        const body = await response.json();
        if (!held && body.command?.testRunId === runId && body.command.commandType === 'pause') {
          assert.ok(body.command.acknowledgedAt);
          held = true;receivedPauseReceipt=body.command;pausedRequest();await gate;
        }
        await route.fulfill({response});
      });
      receivedPauseCommand=(await api(workspace + `/monitor/open-runs/${runId}/commands`, {commandType:'pause',actorId:'owned-received-pause'}, operator)).command.commandId;
      let timer;
      try {await Promise.race([started,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Owned pause acknowledgement did not start')),15000);})]);}
      finally {clearTimeout(timer);}
      assert.equal(receivedPauseReceipt.commandId,receivedPauseCommand);
      assert.equal(await element.evaluate(el=>el.isConnected),true,'The held command receipt must defer the browser pause.');
    }
    // An unrelated window cannot send a trusted Player error.
    await page.evaluate(() => window.postMessage({type:"vopRuntimeErrorNotification",sessionId:"wrong-session",code:"runtime-error",message:"untrusted"}, "*"));
    await delay(200);
    assert.equal(await page.locator("mat-dialog-container").count(), 0);
    await frame.locator("#ownedRuntimeError").click(); await page.locator(failDialog ? "#participantRuntimeErrorFallback" : "mat-dialog-container").waitFor();
    if (receivedTerminate) {
      releaseReceivedTerminate();
      const starter = page.locator('app-original-participant-starter');
      await starter.locator('mat-card').waitFor(); await page.locator('iframe').waitFor({ state:'detached' });
      const source = commandOverlap.cases['queued-terminate'];
      const dialog = page.locator(failDialog ? '#participantRuntimeErrorFallback' : 'mat-dialog-container');
      assert.equal(await dialog.count(), Number(source.dialogRetained));
      const fallbackSurface = failDialog ? await dialog.locator('article').evaluate(card => ({
        background:getComputedStyle(card).backgroundColor, titleColor:getComputedStyle(card.querySelector('h2')).color,
        textColor:getComputedStyle(card.querySelector('p')).color
      })) : null;
      if (fallbackSurface) assert.equal(fallbackSurface.background, 'rgb(255, 255, 255)', 'The fallback card must be opaque even without a custom surface variable.');
      assert.equal(await page.locator('mat-card').count(), source.cardCount);
      assert.equal(await element.evaluate(el => el.isConnected), source.samePlayerFrameAsBeforeError);
      const terminated = await currentState();
      assert.equal(terminated.testRun.status, 'paused'); assert.equal(terminated.testRun.locked, false);
      assert.equal(terminated.testRun.currentUnitKey, 'unit-intro'); assert.equal(terminated.testRun.completedAt, null);
      assert.equal(terminated.participantSession.status, 'signed_in');
      assert.equal(terminated.testRun.unitResponses['unit-intro'], packet);
      const logs = await poll(() => api(workspace + `/test-logs?testRunId=${encodeURIComponent(runId)}&logKey=CONTROLLER&limit=100`, undefined, operator), payload =>
        payload.items.some(item => item.testLog.logContent === 'TERMINATED'));
      const controllers = logs.items.map(item => item.testLog).sort((a,b) => a.timestamp - b.timestamp).map(entry => entry.logContent);
      assert.deepEqual(controllers.slice(controllers.indexOf('ERROR')), source.controllerStates.slice(source.controllerStates.indexOf('ERROR')));
      await page.screenshot({ path:join(artifacts, `${key}-received-terminate.png`), fullPage:true });
      releaseStoppedResume(); await delay(300);
      const commandPath = `/api/v1/participant/sessions/${identity.participantSession.participantSessionId}/commands`;
      const readStoppedResume = async () => (await api(commandPath + `/${stoppedResumeCommandId}/acknowledgement`, {testRunId:runId}, token, 'PATCH')).command;
      const discarded = await readStoppedResume(); assert.ok(discarded.acknowledgedAt); assert.equal(discarded.executedAt, null);
      assert.deepEqual((await api(commandPath + `?testRunId=${runId}`, undefined, token)).commands, []);
      await page.locator('#participantRouteControllerReloadButton').click();
      await page.locator('mat-dialog-container, #participantRuntimeErrorFallback').waitFor({ state:'detached' });
      await starter.locator('mat-card').waitFor();
      const resume = starter.locator('mat-card-actions button').first(); assert.equal(await resume.isEnabled(), true);
      await resume.click(); await frame.locator('#demoPlayerAnswer').waitFor();
      states[key] = {phase:'resumed-after-terminate', terminalCommandId, stoppedResumeCommandId, discardedReceipt:discarded,
        resumedSession:(await currentState()).participantSession};
      await page.screenshot({path:join(artifacts, `${key}-resumed-after-terminate.png`), fullPage:true});
      await page.locator('#participantRouteConnectionState[data-status="live"]').waitFor({ state:'attached' }); await delay(1300);
      assert.equal(await frame.locator('#demoPlayerAnswer').inputValue(), answer);
      assert.equal((await currentState()).testRun.testRunId, runId);
      assert.deepEqual(await readStoppedResume(), discarded, 'The old ACKed resume must remain unapplied after re-entry.');
      const executed = await api(workspace + `/test-logs?testRunId=${encodeURIComponent(runId)}&logKey=${encodeURIComponent('command executed')}&limit=100`, undefined, operator);
      assert.deepEqual(executed.items.map(item => item.testLog.logContent), ['terminate']);
      states[key] = {receivedTerminate:true, terminalCommandId, stoppedResumeCommandId, dialogRetained:true,
        controllerStatesAfterError:controllers.slice(controllers.indexOf('ERROR')), discardedReceipt:discarded,
        resumedSameRun:true, savedResponsePreserved:true, oldCommandRedelivered:false, fallbackSurface};
      await page.screenshot({ path:join(artifacts, `${key}-resumed-after-terminate.png`), fullPage:true });
      await context.close(); console.log('original_runtime_received_terminate=preserved:passed'); continue;
    }
    if(receivedResume){
      assert.equal(await element.evaluate(el=>el.isConnected),true);
      releaseReceivedResume();await delay(1800);
      await page.locator('#participantRouteConnectionState[data-status="live"]').waitFor({state:'attached'});
      const actual={receivedResumeCommand,acknowledgedAt:receivedResumeReceipt.acknowledgedAt,
        samePlayerFrameAsBeforeError:await element.evaluate(el=>el.isConnected),
        iframeCount:await page.locator('iframe').count(),cardCount:await page.locator('mat-card').count(),
        dialogRetained:await page.locator(failDialog?'#participantRuntimeErrorFallback':'mat-dialog-container').count()===1,
        connectionStatus:await page.locator('#participantRouteConnectionState').count()
          ? await page.locator('#participantRouteConnectionState').getAttribute('data-status') : 'not-rendered'};
      states[key]=actual;
      await page.screenshot({path:join(artifacts,`${key}-received-resume.png`),fullPage:true});
      const sourceResume=commandOverlap.cases['queued-resume'];
      assert.equal(actual.samePlayerFrameAsBeforeError,sourceResume.samePlayerFrameAsBeforeError,
        'An accepted same-status resume must replace the errored Player as observed in Source queued-resume.');
      assert.equal(actual.iframeCount,Number(sourceResume.iframePreserved));
      assert.equal(actual.cardCount,sourceResume.cardCount);
      assert.equal(actual.dialogRetained,sourceResume.dialogRetained);
      assert.equal(actual.connectionStatus,'live');
      assert.equal(await frame.locator('#demoPlayerAnswer').inputValue(),answer,'The replacement Player must receive the saved response.');
      const logs=await poll(()=>api(workspace+`/test-logs?testRunId=${encodeURIComponent(runId)}&logKey=CONTROLLER&limit=100`,undefined,operator),payload=>{
        const entries=payload.items.map(item=>item.testLog).sort((a,b)=>a.timestamp-b.timestamp);
        const error=entries.findIndex(entry=>entry.logContent==='ERROR');
        return error>=0 && entries.slice(error+1).some(entry=>entry.logContent==='RUNNING');
      });
      const controllerStates=logs.items.map(item=>item.testLog).sort((a,b)=>a.timestamp-b.timestamp).map(entry=>entry.logContent);
      actual.controllerStatesAfterError=controllerStates.slice(controllerStates.indexOf('ERROR'));
      assert.deepEqual(actual.controllerStatesAfterError,sourceResume.controllerStates.slice(sourceResume.controllerStates.indexOf('ERROR')));
      assert.equal((await currentState()).testRun.unitResponses['unit-intro'],packet);
      await context.close();console.log('original_runtime_received_resume=preserved:passed');continue;
    }
    if (lateSavePause) {
      let timer;
      try {await Promise.race([lateSaveStarted,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Owned runtime log save did not start')),15000);})]);}
      finally {clearTimeout(timer);}
      await api(workspace + `/monitor/open-runs/${runId}/commands`, {commandType:'pause',actorId:'owned-late-save-pause'}, operator);
      assert.equal((await currentState()).testRun.status,'running','Issuance after ERROR cannot apply an unreceived pause.');
      releaseLateSave();
      const logs=workspace + `/test-logs?testRunId=${encodeURIComponent(runId)}&logKey=${encodeURIComponent('Runtime Error: runtime-error')}&unitKey=unit-intro`;
      const stored=await poll(()=>api(logs,undefined,operator),p=>p.items.length===1);
      assert.equal(stored.items[0].testLog.logContent,expected.errorDescription);
      const controllerLogs=workspace + `/test-logs?testRunId=${encodeURIComponent(runId)}&logKey=CONTROLLER&limit=100`;
      await poll(()=>api(controllerLogs,undefined,operator),p=>p.items.filter(i=>i.testLog.logContent==='ERROR').length===1);
      await page.waitForFunction(()=>localStorage.getItem('testcenter-rewrite:participant-save-outbox:v1')===null);
      await delay(700);
      states[key]={lateSavePause:true,iframePreserved:await element.evaluate(el=>el.isConnected),dialogCount:await page.locator(failDialog ? '#participantRuntimeErrorFallback' : 'mat-dialog-container').count()};
      await page.screenshot({path:join(artifacts,`${key}-late-save-pause.png`),fullPage:true});
      assert.equal(states[key].iframePreserved,commandOverlap.cases['pending-pause'].iframePreserved,'A save acknowledgement must not deliver a late monitor pause into ERROR.');
      assert.equal(states[key].dialogCount,1);
      assert.equal((await currentState()).testRun.unitResponses['unit-intro'],packet);
      await page.locator('#participantRouteControllerReloadButton').click();
      await page.locator('mat-dialog-container, #participantRuntimeErrorFallback').waitFor({state:'detached'});
      await page.locator('app-original-participant-paused mat-card').waitFor();
      assert.equal((await currentState()).testRun.unitResponses['unit-intro'],packet);
      await context.close();console.log('original_runtime_late_save_pause=preserved:passed');continue;
    }
    if (receivedPause) {
      assert.equal(await element.evaluate(el=>el.isConnected),true);
      releaseReceivedPause();
      await page.locator('iframe').waitFor({state:'detached'});
      await page.locator('app-original-participant-paused mat-card').waitFor();
      const sourcePause = commandOverlap.cases['queued-pause'];
      assert.equal(await element.evaluate(el=>el.isConnected),sourcePause.iframePreserved);
      assert.equal(await page.locator('mat-card').count(),sourcePause.cardCount);
      assert.equal(await page.locator(failDialog ? '#participantRuntimeErrorFallback' : 'mat-dialog-container').count(),Number(sourcePause.dialogRetained));
      await page.locator('#participantRouteConnectionState[data-status="live"]').waitFor({state:'attached'});
      if (receivedPauseOldSave) await page.evaluate(()=>{
        window.ownedPauseFrameAdds=0;
        window.ownedPauseObserver=new MutationObserver(records=>{
          for(const record of records)for(const node of record.addedNodes)
            if(node instanceof Element && (node.matches('iframe') || node.querySelector('iframe')))window.ownedPauseFrameAdds++;
        });
        window.ownedPauseObserver.observe(document.body,{childList:true,subtree:true});
      });
      releaseBeforePauseSave?.();
      if (receivedPauseOldSave) {await delay(700);releaseAfterPauseLog();}
      const logs = workspace + `/test-logs?testRunId=${encodeURIComponent(runId)}&logKey=${encodeURIComponent('Runtime Error: runtime-error')}&unitKey=unit-intro`;
      await poll(()=>api(logs,undefined,operator),p=>p.items.length===1);
      const controllerLogPath = workspace + `/test-logs?testRunId=${encodeURIComponent(runId)}&logKey=CONTROLLER&limit=100`;
      const controllerLogs = await poll(()=>api(controllerLogPath,undefined,operator),payload=>{
        const entries=payload.items.map(item=>item.testLog).sort((a,b)=>a.timestamp-b.timestamp);
        const error=entries.findIndex(entry=>entry.logContent==='ERROR');
        return error>=0 && entries.slice(error+1).some(entry=>entry.logContent==='PAUSED');
      });
      const controllerStates=controllerLogs.items.map(item=>item.testLog).sort((a,b)=>a.timestamp-b.timestamp).map(entry=>entry.logContent);
      assert.deepEqual(controllerStates.slice(controllerStates.indexOf('ERROR')),
        sourcePause.controllerStates.slice(sourcePause.controllerStates.indexOf('ERROR')),
        'Issuing and acknowledging pause must not persist PAUSED before the accepted command executes after ERROR.');
      if (receivedPauseOldSave) {
        await page.waitForFunction(()=>localStorage.getItem('testcenter-rewrite:participant-save-outbox:v1')===null);
        await delay(700);await page.locator('app-original-participant-paused mat-card').waitFor();
        assert.equal(await page.locator('iframe').count(),0,'An older running save snapshot cannot undo an accepted pause.');
        assert.equal(await page.evaluate(()=>{window.ownedPauseObserver.disconnect();return window.ownedPauseFrameAdds;}),0,'An old save cannot temporarily recreate the Player behind the retained dialog.');
      }
      assert.equal((await currentState()).testRun.unitResponses['unit-intro'],packet);
      states[key]={receivedPause:true,receivedPauseCommand,acknowledgedAt:receivedPauseReceipt.acknowledgedAt,errorDialogRetained:true,iframeRemoved:true,serverStatus:'paused'};
      await page.screenshot({path:join(artifacts,`${key}-received-pause.png`),fullPage:true});
      await page.locator('#participantRouteControllerReloadButton').click();
      await page.locator('mat-dialog-container, #participantRuntimeErrorFallback').waitFor({state:'detached'});
      await page.locator('app-original-participant-paused mat-card').waitFor();
      assert.equal((await currentState()).testRun.unitResponses['unit-intro'],packet);
      await context.close();console.log(receivedPauseOldSave ? 'original_runtime_received_pause_old_save=preserved:passed' : 'original_runtime_received_pause=preserved:passed');continue;
    }
    assert.equal(await element.evaluate(el => el.isConnected), expected.iframePreserved);
    assert.equal(await page.locator("#participantRouteControllerErrorState").count(), 0);
    assert.equal(await page.locator("mat-card").count(), expected.cardCount);
    const capture = async phase => {
      if (contract) await page.mouse.move(0,0);
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).every(a => !a.pending && a.playState !== "running"));
      await page.screenshot({path:join(artifacts, `${key}-${phase}.png`),fullPage:true});
      return page.locator("mat-dialog-container").evaluate(dialog => {
        const read = n => { const b = n.getBoundingClientRect(), s = getComputedStyle(n); return {x:b.x,y:b.y,width:b.width,height:b.height,font:s.font,color:s.color,background:s.backgroundColor,padding:s.padding,margin:s.margin,borderRadius:s.borderRadius,boxShadow:s.boxShadow}; };
        return {role:dialog.getAttribute("role"),box:read(dialog),title:dialog.querySelector("[mat-dialog-title]").textContent.trim(),
          titleBox:read(dialog.querySelector("[mat-dialog-title]")),contentBox:read(dialog.querySelector("mat-dialog-content")),
          introText:dialog.querySelector("mat-dialog-content > p").textContent.trim(),introWhiteSpace:getComputedStyle(dialog.querySelector("mat-dialog-content > p")).whiteSpace,expansion:read(dialog.querySelector("mat-expansion-panel")),
          icon:read(dialog.querySelector(".mat-icon")),actions:read(dialog.querySelector("mat-dialog-actions")),
          buttons:[...dialog.querySelectorAll("button")].map(n => ({text:n.textContent.trim(),box:read(n)}))};
      });
    };
    if (!failDialog) {
    const surface = await capture("collapsed"); states[key] = {collapsedDialog:surface};
    const compare = (actual, wanted, label) => {
      for (const part of ["x","y","width","height"]) assert.ok(Math.abs(actual[part] - wanted[part]) <= 0.6, `${key}/${label}/${part}: ${actual[part]} vs ${wanted[part]}`);
      for (const part of ["font","color","background","padding","margin","borderRadius","boxShadow"]) assert.equal(actual[part], wanted[part], `${key}/${label}/${part}`);
    };
    for (const field of ["box","titleBox","contentBox","expansion","icon","actions"]) compare(surface[field], expected.collapsedDialog[field], field);
    assert.equal(surface.role, expected.collapsedDialog.role); assert.equal(surface.title, expected.collapsedDialog.title);
    assert.equal(surface.introText, expected.introText); assert.deepEqual(surface.buttons.map(b => b.text), expected.collapsedDialog.buttons.map(b => b.text));
    if (contract) assert.equal(surface.introWhiteSpace, expected.introWhiteSpace);
    compare(surface.buttons[0].box, expected.collapsedDialog.buttons[0].box, "reload");
    assert.equal(await page.evaluate(() => document.activeElement.getAttribute("role")), expected.activeRole);
    await page.keyboard.press("Escape"); assert.equal(await page.locator("mat-dialog-container").count(), 1);
    await page.locator(".cdk-overlay-backdrop").click({position:{x:5,y:5}}); assert.equal(await page.locator("mat-dialog-container").count(), 1);
    const expansion = page.getByRole("button", {name:"Fehlerdetails",exact:true});
    await expansion.focus(); await page.keyboard.press("Enter");
    await capture("expanded");
    if (contract) {
      const description = await page.locator("mat-expansion-panel p").first().evaluate(p => ({html:p.innerHTML,text:p.textContent}));
      assert.deepEqual(description, expected.description);
      states[key].description = description;
    } else assert.ok((await page.locator("mat-expansion-panel").innerText()).includes(expected.errorDescription));
    } else {
      const fallback = page.locator("#participantRuntimeErrorFallback");
      assert.equal(await fallback.getAttribute("role"), "alertdialog");
      assert.equal(await fallback.locator("h2").textContent(), expected.collapsedDialog.title);
      assert.equal(await fallback.locator("article > p").textContent(), expected.introText);
      if (contract) assert.equal(await fallback.locator("article > p").evaluate(p => getComputedStyle(p).whiteSpace), expected.introWhiteSpace);
      await page.keyboard.press("Escape"); assert.equal(await fallback.count(), 1);
      await fallback.click({position:{x:5,y:5}}); assert.equal(await fallback.count(), 1);
      await fallback.locator("summary").click();
      if (contract) assert.deepEqual(await fallback.locator("details p").evaluate(p => ({html:p.innerHTML,text:p.textContent})), expected.description);
      else assert.equal(await fallback.locator("details p").innerText(), expected.errorDescription);
      await page.waitForFunction(() => !!document.activeElement.closest("#participantRuntimeErrorFallback"));
      await page.screenshot({path:join(artifacts, `${key}-fallback.png`),fullPage:true});
      states[key] = {fallback:true};
    }
    await frame.locator("#ownedRuntimeError").evaluate(button => {button.dataset.message = "Second owned runtime Ω"; button.click();});
    await delay(700);
    assert.equal(await page.locator(failDialog ? "#participantRuntimeErrorFallback" : "mat-dialog-container").count(), expected.repeatedDialogCount);
    assert.ok(!(await page.locator(failDialog ? "#participantRuntimeErrorFallback details" : "mat-expansion-panel").innerText()).includes("Second owned runtime Ω"));
    for (let i = 0; i < 5; i++) { await page.keyboard.press("Tab"); assert.equal(await page.evaluate(() => !!document.activeElement.closest("mat-dialog-container, #participantRuntimeErrorFallback")), true); }
    const unitLogsPath = workspace + `/test-logs?testRunId=${encodeURIComponent(runId)}&logKey=${encodeURIComponent(contract ? `Runtime Error: ${scenario.code}` : "Runtime Error: runtime-error")}&unitKey=unit-intro`;
    const controllerLogsPath = workspace + `/test-logs?testRunId=${encodeURIComponent(runId)}&logKey=CONTROLLER&limit=100`;
    const runtimeLogs = await poll(() => api(unitLogsPath, undefined, operator), p => p.items.length === expected.repeatedRuntimeLogCount);
    assert.deepEqual(runtimeLogs.items.map(i => i.testLog.logContent).sort(), [expected.errorDescription,"Second owned runtime Ω"].sort());
    await poll(() => api(controllerLogsPath, undefined, operator), p => p.items.filter(i => i.testLog.logContent === "ERROR").length === 1);
    const failed = await currentState();
    assert.equal(failed.testRun.status, "running"); assert.equal(failed.testRun.unitResponses["unit-intro"], packet);
    assert.deepEqual(failed.testRun.lockedUnitKeys, []); assert.deepEqual(failed.testRun.lockedTestletKeys, []);
    if (monitorCommand) {
      const issued=(await api(workspace + `/monitor/open-runs/${runId}/commands`, {commandType:monitorCommand,actorId:'owned-error-overlap'}, operator)).command;
      assert.equal(issued.testRun.status,'running','Issuance after ERROR cannot change the controller state.');
      await delay(700);
      const pending=await api(`/api/v1/participant/sessions/${identity.participantSession.participantSessionId}/commands?testRunId=${runId}`,undefined,identity.sessionToken);
      const receipt=pending.commands.find(command=>command.commandId===issued.commandId);
      assert.ok(receipt);assert.equal(receipt.acknowledgedAt,null);assert.equal(receipt.executedAt,null);
      assert.equal((await currentState()).testRun.status,'running');
      states[key].lateCommand = {command:monitorCommand,serverStatus:'running',acknowledgedAt:null,executedAt:null,
        iframePreserved:await element.evaluate(el=>el.isConnected),
        dialogCount:await page.locator(failDialog ? '#participantRuntimeErrorFallback' : 'mat-dialog-container').count()};
      await page.screenshot({path:join(artifacts,`${key}-late-${monitorCommand}.png`),fullPage:true});
      const sourceLate = commandOverlap.cases['pending-pause'];
      assert.equal(states[key].lateCommand.iframePreserved,sourceLate.iframePreserved,'Source ignores a command whose response arrives after ERROR; retain the errored frame until reload.');
      assert.equal(states[key].lateCommand.dialogCount,Number(sourceLate.dialogRetained));
      await page.locator('#participantRouteControllerReloadButton').click();
      await page.locator('mat-dialog-container, #participantRuntimeErrorFallback').waitFor({state:'detached'});
      await page.locator('iframe').waitFor({state:'detached'});
      if (monitorCommand === 'pause') await page.locator('app-original-participant-paused mat-card').waitFor();
      else {
        const starter=page.locator('app-original-participant-starter');
        await starter.locator('mat-card').waitFor();
        const terminated=await currentState();
        assert.equal(terminated.testRun.status,'paused');assert.equal(terminated.testRun.locked,false);
        assert.equal(terminated.testRun.currentUnitKey,'unit-intro');assert.equal(terminated.testRun.completedAt,null);
        assert.equal(terminated.participantSession.status,'signed_in');
        const resume=starter.locator('mat-card-actions button').first();assert.equal(await resume.isEnabled(),true);
        await resume.click();await frame.locator('#demoPlayerAnswer').waitFor();
        assert.equal(await frame.locator('#demoPlayerAnswer').inputValue(),answer);
        assert.equal((await currentState()).testRun.testRunId,runId,'Monitor termination must resume the same saved Run.');
      }
      assert.equal((await currentState()).testRun.unitResponses['unit-intro'],packet);
      await context.close();console.log(`original_runtime_late_command=${monitorCommand}:passed`);continue;
    }
    let expectedPacket = packet, expectedAnswer = answer;
    let expectedRuntimeLogCount = expected.repeatedRuntimeLogCount;
    const beforeReloadTimeOrigin = await page.evaluate(() => performance.timeOrigin);
    if (replacementMode) {
      const lateError = "Third owned runtime log during replacement Ω";
      const writes = [];
      let releaseSave, saveStarted;
      const blocked = new Promise(done => {saveStarted = done;});
      const gate = new Promise(done => {releaseSave = done;});
      let held = false;
      await context.route(`**/api/v1/participant/test-runs/${encodeURIComponent(runId)}/save-progress`, async route => {
        const body = route.request().postDataJSON();
        writes.push(body);
        if (!held && body.logs?.some(batch => batch.entries.some(entry => entry.content === lateError))) {
          held = true;
          saveStarted(body);
          await gate;
          if (replacementMode === "reject") {
            await route.fulfill({status:503,contentType:"application/json",body:'{"error":"owned_old_packet_unavailable"}'});
            return;
          }
        }
        await route.continue();
      });
      await frame.locator("#ownedRuntimeError").evaluate((button, message) => {
        button.dataset.message = message; button.click();
      }, lateError);
      const older = await raceWithSmokeDeadline(blocked, 10_000, () => {throw Error("Owned log-bearing delivery did not start");});
      expectedAnswer += " newer packet Ω";
      await frame.locator("#demoPlayerAnswer").evaluate((input, value) => {
        input.value = value; input.dispatchEvent(new Event("input", {bubbles:true}));
      }, expectedAnswer);
      const replacement = await poll(() => page.evaluate(() => {
        const raw = localStorage.getItem("testcenter-rewrite:participant-save-outbox:v1");
        return raw ? JSON.parse(raw).entries : [];
      }), entries => entries.some(entry => entry.testRunId === runId &&
        parseVeronaUnitResponse(entry.response)?.unitState.dataParts.answer === expectedAnswer));
      const latest = replacement.find(entry => entry.testRunId === runId && entry.unitKey === "unit-intro");
      expectedPacket = latest.response;
      const lateEntries = logs => logs.flatMap(batch => batch.entries).filter(entry => entry.content === lateError);
      assert.notEqual(latest.deliveryId, older.deliveryId);
      assert.equal(lateEntries(older.logs).length, 1);
      assert.deepEqual(lateEntries(latest.logs), lateEntries(older.logs), "The replacement must retain the exact original log identity before the older request settles.");
      assert.ok(lateEntries(latest.logs)[0].clientEntryId);
      const address = page.url();
      await page.locator("#participantRouteControllerReloadButton").click();
      await delay(350);
      assert.equal(page.url(), address);
      assert.equal(await element.evaluate(el => el.isConnected), true);
      assert.equal((await currentState()).testRun.unitResponses["unit-intro"], packet);
      releaseSave();
      await poll(currentState, state => state.testRun.unitResponses["unit-intro"] === expectedPacket);
      const delivered = writes.filter(body => body.unitResponse === expectedPacket);
      assert.ok(delivered.length > 0);
      assert.deepEqual(lateEntries(delivered.at(-1).logs), lateEntries(older.logs));
      expectedRuntimeLogCount++;
      const stored = await poll(() => api(unitLogsPath, undefined, operator), result => result.items.length === expectedRuntimeLogCount);
      assert.equal(stored.items.filter(item => item.testLog.logContent === lateError).length, 1);
      await page.waitForFunction(() => localStorage.getItem("testcenter-rewrite:participant-save-outbox:v1") === null);
      states[key].replacement = {olderResult:replacementMode, exactLogIdentityPreserved:true, runtimeLogCount:stored.items.length};
    } else if (saveFailure) {
      expectedAnswer += " late save Ω";
      let releaseSave, saveStarted;
      const blocked = new Promise(done => {saveStarted = done;});
      const gate = new Promise(done => {releaseSave = done;});
      let allowSave = false, attempts = 0;
      await context.route(`**/api/v1/participant/test-runs/${encodeURIComponent(runId)}/save-progress`, async route => {
        const body = route.request().postDataJSON();
        expectedPacket = body.unitResponse; attempts++; saveStarted();
        if (saveFailure === "delay") { await gate; await route.continue(); }
        else if (!allowSave) await route.fulfill({status:503,contentType:"application/json",body:'{"error":"owned_save_unavailable"}'});
        else await route.continue();
      });
      await frame.locator("#demoPlayerAnswer").evaluate((input, value) => {
        input.value = value; input.dispatchEvent(new Event("input", {bubbles:true}));
      }, expectedAnswer);
      await raceWithSmokeDeadline(blocked, 10_000, () => {throw Error("Owned late save did not start");});
      const address = page.url();
      await page.locator("#participantRouteControllerReloadButton").click();
      if (saveFailure === "reject") await poll(async () => attempts, n => n >= 3);
      await delay(350);
      assert.equal(page.url(), address, "An unsettled save cannot change the entry URL.");
      assert.equal(await element.evaluate(el => el.isConnected), true, "An unsettled save cannot reload the active frame.");
      assert.equal((await currentState()).testRun.unitResponses["unit-intro"], packet);
      assert.equal(await page.evaluate(value => localStorage.getItem("testcenter-rewrite:participant-save-outbox:v1")?.includes(value), expectedAnswer), true);
      if (saveFailure === "reject") {
        allowSave = true;
        await page.locator("#participantRouteControllerReloadButton").click();
      } else releaseSave();
    } else await page.locator("#participantRouteControllerReloadButton").click();
    // The error button exists in the initial iframe HTML, before Verona starts
    // it. This input becomes enabled only after the actual Start packet restores
    // its answer and progress; asserting earlier races the real message delivery.
    await page.waitForFunction(origin => performance.timeOrigin !== origin, beforeReloadTimeOrigin);
    await frame.locator("#demoPlayerAnswer:enabled").waitFor(); await page.locator("mat-dialog-container, #participantRuntimeErrorFallback").waitFor({state:"detached"});
    assert.equal(await frame.locator("#demoPlayerAnswer").inputValue(), expectedAnswer);
    assert.equal(await frame.locator("#exitPresentation").inputValue(), "some"); assert.equal(await frame.locator("#exitResponse").inputValue(), "none");
    const link = new URL(page.url()); assert.equal(link.searchParams.get("ui"), "original"); assert.equal(link.searchParams.get("testRunId"), runId);
    assert.equal(link.searchParams.get("participantSessionId"), identity.participantSession.participantSessionId);
    const recovered = await poll(() => api(controllerLogsPath, undefined, operator), p => p.items.some(i => i.testLog.logContent === "RUNNING"));
    assert.equal(recovered.items.filter(i => i.testLog.logContent === "ERROR").length, expected.controllerErrorWriteCount);
    assert.equal((await api(unitLogsPath, undefined, operator)).items.length, expectedRuntimeLogCount);
    assert.equal((await currentState()).testRun.unitResponses["unit-intro"], expectedPacket);
    await context.close(); console.log(`${contract ? "original_runtime_error_contract" : "original_runtime_error"}=${key}:passed`);
  }
  assert.deepEqual(errors, []); failureGate.assertHealthy();
} finally {
  await writeFile(join(artifacts, "runtime-error.json"), JSON.stringify({states,errors}, null, 2));
  await browser?.close(); server.kill("SIGTERM");
  await raceWithSmokeDeadline(serverClosed, 10_000, () => {server.kill("SIGKILL");throw Error("Owned API shutdown timed out");});
  failureGate.assertHealthy(); console.log("owned_api=shutdown");
}
