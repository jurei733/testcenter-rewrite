import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {access,mkdtemp,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {setTimeout as delay} from 'node:timers/promises';
import {chromium} from 'playwright';
import {createSqliteFirstSliceRepository} from '@testcenter-rewrite-app/sqlite-store';
import {productionApiRoutes,resolveRoutePath,parseVeronaUnitResponse} from '@testcenter-rewrite-app/contracts';
import {localDemoSourcePackage} from '../apps/api/dist/apps/api/src/local-demo-bootstrap.js';
import {createServerRequestFailureGate} from './server-request-failure-gate.mjs';

const root=resolve(process.env.UI_SMOKE_FRONTEND_ROOT||'.');
await access(join(root,'dist/apps/web/browser/index.html'));
const artifacts=await mkdtemp(join(tmpdir(),'testcenter-controller-timer-'));
console.log('owned_artifacts='+artifacts);
const file=join(artifacts,'owned.sqlite'),gate=createServerRequestFailureGate();
const module=pathToFileURL(resolve('apps/api/dist/apps/api/src/index.js')).href;
const server=spawn(process.execPath,['--input-type=module','-e',`
 import {createProductionApiServer} from ${JSON.stringify(module)};
 const server=await createProductionApiServer();server.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));
 process.once('SIGTERM',()=>server.close(()=>process.exit(0)));`],{cwd:root,env:{...process.env,FIRST_SLICE_STORE:'sqlite',FIRST_SLICE_SQLITE_FILE:file,
 FIRST_SLICE_BOOTSTRAP_DEMO:'true',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',FIRST_SLICE_PROOF_OF_WORK_SCOPES:'',FIRST_SLICE_XML_SCHEMA_PROFILE:'legacy-compatibility',REQUIRE_LOGIN_PASSWORD:'false'},stdio:['ignore','pipe','pipe','ipc']});
gate.observeStream(server.stdout);gate.observeStream(server.stderr);
const closed=new Promise(done=>server.once('close',done));
const errors=[],checks=[],releases=[];
let browser;
const poll=async(predicate,message)=>{
 const deadline=Date.now()+20_000;
 while(Date.now()<deadline){if(await predicate())return;await delay(50);}
 throw Error(message);
};
try{
 const port=await new Promise((done,reject)=>{
  const timeout=setTimeout(()=>reject(Error('Owned timer API startup timed out')),20_000);
  server.once('message',({port})=>{clearTimeout(timeout);done(port);});server.once('error',reject);server.once('exit',()=>reject(Error('Owned timer API exited before startup')));
 });
 const base='http://127.0.0.1:'+port;
 const api=async(path,body,token,method=body===undefined?'GET':'POST')=>{
  const response=await fetch(base+path,{method,headers:{...(token?{authorization:'Bearer '+token}:{}),...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
  assert.ok(response.ok,`${method} ${path}: ${response.status} ${await response.clone().text()}`);return response.json();
 };
 const operator=(await api('/api/v1/admin/auth/sign-in',{username:'demo-admin',password:'demo-admin-password'})).sessionToken;
 const workspaceKey='owned-controller-timer',workspace='/api/v1/tenants/demo-tenant/workspaces/'+workspaceKey;
 await api('/api/v1/tenants/demo-tenant/workspaces',{workspaceKey,displayName:'Owned controller timer'},operator);
 const content=JSON.parse(localDemoSourcePackage.sourceDocument),unit=content.bookletEntries[0].unitEntries[0];
 content.bookletEntries=[{bookletKey:'first',displayLabel:'Timed commands',config:{unit_show_time_left:'ON'},
  testletEntries:[{testletKey:'timed',displayLabel:'Timed',parentTestletKey:null,restrictions:{timeMax:{minutes:1/6,leave:'confirm'}}}],
  unitEntries:[{...unit,unitKey:'first-unit',testletPath:['timed']},{...unit,unitKey:'after-timer',testletPath:[]}]},
  {bookletKey:'second',displayLabel:'Sibling',unitEntries:[{...unit,unitKey:'sibling-unit',testletPath:[]}]}];
 const source=await api(workspace+'/source-packages',{fileName:'timer.json',mediaType:'application/json',contentStructure:content},operator);
 const imported=await api(workspace+'/import-jobs',{sourcePackageId:source.sourcePackage.sourcePackageId},operator);
 await api(workspace+`/content-releases/${imported.stagedContentRelease.contentReleaseId}/activate`,{activatedByActorId:'owned-timer-browser'},operator);
 const scenarios=[{origin:'native',keyword:'pause',lostTimerReply:true},{origin:'native',keyword:'terminate'},{origin:'remote',keyword:'pause'},{origin:'remote',keyword:'terminate'}];
 await api(workspace+'/participant-roster',{rosterText:'<Testtakers><Group id="owned">'+scenarios.map((_,i)=>`<Login mode="run-hot-return" name="timer-${i}"><Booklet>first</Booklet><Booklet>second</Booklet></Login>`).join('')+'</Group></Testtakers>'},operator);
 const repository=createSqliteFirstSliceRepository(file);
 browser=await chromium.launch({headless:process.env.UI_SMOKE_HEADFUL!=='true'});
 for(const [index,scenario] of scenarios.entries()){
  const context=await browser.newContext({viewport:{width:1280,height:800},locale:'de-DE'}),page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  let releaseAnswer,releaseApplication,heldAnswer=false,heldApplication=false,loseReply=Boolean(scenario.lostTimerReply);
  const answerGate=new Promise(done=>{releaseAnswer=done;}),applicationGate=new Promise(done=>{releaseApplication=done;});releases.push(releaseAnswer,releaseApplication);
  const timerPackets=[],applications=[];
  try{
   await page.goto(base+`/app/participant?ui=original&tenantKey=demo-tenant&workspaceKey=${workspaceKey}`,{waitUntil:'networkidle'});
   await page.locator('#originalLoginName').fill('timer-'+index);await page.getByRole('button',{name:'Weiter',exact:true}).click();
   await page.locator('#originalParticipantStarter mat-card[data-booklet-key="first"] button').click();
   await page.frameLocator('iframe').locator('#demoPlayerAnswer').waitFor();
   const runId=new URL(page.url()).searchParams.get('testRunId');assert.ok(runId);
   await page.waitForFunction(()=>typeof window.tc?.pause==='function');await page.evaluate(()=>window.tc.debug());
   const pane=page.locator('[data-debug-window="main"]');await poll(async()=>/BS:\s*live/.test(await pane.innerText()),'Timer fixture reception did not become live');
   const initial=await repository.getTestRunById(runId);assert.equal(initial.testletTimers.timed.status,'running');
   const sibling={...structuredClone(initial),testRunId:crypto.randomUUID(),bookletKey:'second',bookletAssignmentKey:'second',currentUnitKey:'sibling-unit',testletTimers:{},unitResponses:{'sibling-unit':'Protected sibling'},unitResponseFieldTimestamps:{'sibling-unit':{opaque:99}}};await repository.saveTestRun(sibling);
   const siblingBefore=await repository.getTestRunById(sibling.testRunId),parentBefore=await repository.getParticipantSessionById(initial.participantSessionId);
   await page.route('**/save-progress',async route=>{
    const request=route.request().postDataJSON(),response=await route.fetch();assert.equal(response.status(),200);
    if(parseVeronaUnitResponse(request.unitResponse)?.unitState.dataParts?.answer==='Owned timer answer '+index){heldAnswer=true;await answerGate;}
    await route.fulfill({response});
   });
   await page.route('**/controller-timer-interruptions',async route=>{
    const packet=route.request().postDataJSON(),response=await route.fetch();assert.equal(response.status(),200);const receipt=(await response.json()).interruption;
    timerPackets.push({packet,receipt});
    if(loseReply){loseReply=false;await route.fulfill({status:503,contentType:'application/json',body:JSON.stringify({error:'owned_lost_timer_reply'})});}
    else await route.fulfill({response});
   });
   const captureApplication=async route=>{
    heldApplication=true;await applicationGate;const response=await route.fetch();assert.equal(response.status(),200);applications.push(await response.json());await route.fulfill({response});
   };
   await page.route('**/native-commands',captureApplication);await page.route('**/commands/*/application',captureApplication);
   await page.frameLocator('iframe').locator('#demoPlayerAnswer').fill('Owned timer answer '+index);
   await poll(()=>Promise.resolve(heldAnswer),'The timer fixture did not hold its committed Player answer');
   const before=await repository.getTestRunById(runId);
   if(scenario.origin==='native')await page.evaluate(keyword=>window.tc[keyword](),scenario.keyword);
   else await api(workspace+`/monitor/open-runs/${runId}/commands`,{commandType:scenario.keyword==='terminate'?'complete':'pause'},operator);
   await poll(()=>Promise.resolve(timerPackets.length>=(scenario.lostTimerReply?2:1)),'Timer interruption was blocked behind the answer buffer');
   const first=timerPackets[0];assert.ok(first.packet.remainingSeconds>0);assert.equal(first.receipt.applied,true);
   if(scenario.lostTimerReply){assert.deepEqual(timerPackets[1].packet,first.packet);assert.equal(timerPackets[1].receipt.applied,false);}
   await poll(async()=>new RegExp('STATUS:\\s*'+(scenario.keyword==='pause'?'PAUSED':'TERMINATED')).test(await pane.innerText()),'The controller phase did not enter before its held command');
   const wait=Math.max(0,Date.parse(first.packet.expiresAt)+500-Date.now());await delay(wait);
   const frozen=await repository.getTestRunById(runId);assert.equal(frozen.status,'running');assert.equal(frozen.currentUnitKey,'first-unit');assert.equal(frozen.testletTimers.timed.status,'paused');assert.equal(frozen.testletTimers.timed.remainingSeconds,first.packet.remainingSeconds);
   assert.equal(frozen.controllerDispatches?.[first.packet.controllerDispatch.controllerId]??0,0);assert.deepEqual(frozen.unitResponses,before.unitResponses);assert.deepEqual(frozen.unitResponseFieldTimestamps,before.unitResponseFieldTimestamps);assert.deepEqual(frozen.controllerEntry,before.controllerEntry);
   assert.deepEqual(await repository.getParticipantSessionById(initial.participantSessionId),parentBefore);assert.deepEqual(await repository.getTestRunById(sibling.testRunId),siblingBefore);
   assert.equal(applications.length,0);if(scenario.keyword==='terminate'||scenario.origin==='native')assert.equal(heldApplication,false,'An answer-draining command reached application before its answer receipt');
   releaseAnswer();await poll(()=>Promise.resolve(heldApplication),'The timer command did not reach application after its buffer release');releaseApplication();
   await poll(()=>Promise.resolve(applications.length===1),'The timer command application did not complete');
   const final=await repository.getTestRunById(runId);assert.equal(final.status,'paused');assert.equal(final.testletTimers.timed.remainingSeconds,first.packet.remainingSeconds);assert.deepEqual(final.unitResponses,before.unitResponses);assert.deepEqual(final.unitResponseFieldTimestamps,before.unitResponseFieldTimestamps);
   assert.deepEqual(await repository.getTestRunById(sibling.testRunId),siblingBefore);
   checks.push({scenario,timerPackets,before,frozen,final});console.log(`participant_controller_timer=${scenario.origin}-${scenario.keyword}${scenario.lostTimerReply?'-lost-reply':''}:passed`);
  }finally{releaseAnswer();releaseApplication();await page.unrouteAll({behavior:'wait'}).catch(()=>{});await context.close();}
 }
 assert.deepEqual(errors,[]);gate.assertHealthy();await writeFile(join(artifacts,'timer-interruptions.json'),JSON.stringify({checks,errors},null,2)+'\n');
}finally{
 for(const release of releases)release();await browser?.close();server.kill('SIGTERM');await closed;gate.assertHealthy();console.log('owned_api=shutdown');
}
