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
 await poll(async()=>{if(server.exitCode!==null)throw Error('Owned timer API exited before readiness');try{return (await fetch(base+'/readyz')).ok;}catch{return false;}},'Owned timer API readiness timed out');
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
  {bookletKey:'second',displayLabel:'Sibling',unitEntries:[{...unit,unitKey:'sibling-unit',testletPath:[]}]},
  {bookletKey:'code-entry',displayLabel:'Resume into code entry',
   testletEntries:[{testletKey:'intro',displayLabel:'Intro',parentTestletKey:null,restrictions:{lockAfterLeaving:{scope:'unit',confirm:false}}},
    {testletKey:'timed',displayLabel:'Protected timer',parentTestletKey:null,restrictions:{codeToEnter:{code:'OWNED',prompt:'Owned code'},timeMax:{minutes:1/6}}}],
   unitEntries:[{...unit,unitKey:'intro-unit',testletPath:['intro']},{...unit,unitKey:'first-unit',testletPath:['timed']},{...unit,unitKey:'after-timer',testletPath:[]}]}];
 const source=await api(workspace+'/source-packages',{fileName:'timer.json',mediaType:'application/json',contentStructure:content},operator);
 const imported=await api(workspace+'/import-jobs',{sourcePackageId:source.sourcePackage.sourcePackageId},operator);
 await api(workspace+`/content-releases/${imported.stagedContentRelease.contentReleaseId}/activate`,{activatedByActorId:'owned-timer-browser'},operator);
 const scenarios=[{origin:'native',keyword:'pause',lostTimerReply:true},{origin:'native',keyword:'terminate'},{origin:'remote',keyword:'pause'},{origin:'remote',keyword:'terminate'},
  ...['native','remote'].flatMap(origin=>['native','remote'].map(resume=>({origin,keyword:'pause',zero:true,resume}))),
  ...['native','remote'].map(origin=>({origin,keyword:'resume',code:true})),
  ...['pause','terminate'].map(keyword=>({origin:'native',keyword,legacy:true,lostTimerReply:keyword==='pause'}))].filter(scenario=>process.env.UI_SMOKE_TIMER_LEGACY_ONLY==='true'?scenario.legacy:process.env.UI_SMOKE_TIMER_CODE_ONLY==='true'?scenario.code:process.env.UI_SMOKE_TIMER_ZERO_ONLY!=='true'||scenario.zero);
 await api(workspace+'/participant-roster',{rosterText:'<Testtakers><Group id="owned">'+scenarios.map((scenario,i)=>`<Login mode="run-hot-return" name="timer-${i}"><Booklet>${scenario.code?'code-entry':'first'}</Booklet><Booklet>second</Booklet></Login>`).join('')+'</Group></Testtakers>'},operator);
 const repository=createSqliteFirstSliceRepository(file);
 browser=await chromium.launch({headless:process.env.UI_SMOKE_HEADFUL!=='true'});
 for(const [index,scenario] of scenarios.entries()){
  const context=await browser.newContext({viewport:{width:1280,height:800},locale:'de-DE'}),page=await context.newPage();
  page.on('pageerror',error=>errors.push(error.message));
  let releaseAnswer,releaseApplication,releaseAck,releaseLegacy,holdLegacyRoute,caseFailure,disposing=false,heldAnswer=false,heldApplication=false,heldAck=false,heldLegacy=false,loseReply=Boolean(scenario.lostTimerReply);
  const answerGate=new Promise(done=>{releaseAnswer=done;}),applicationGate=new Promise(done=>{releaseApplication=done;}),ackGate=new Promise(done=>{releaseAck=done;}),legacyGate=new Promise(done=>{releaseLegacy=done;});releases.push(releaseAnswer,releaseApplication,releaseAck,releaseLegacy);
  const timerPackets=[],applications=[],legacyApplications=[];
  let legacyPacket;
  try{
   await page.goto(base+`/app/participant?ui=original&tenantKey=demo-tenant&workspaceKey=${workspaceKey}`,{waitUntil:'networkidle'});
   await page.locator('#originalLoginName').fill('timer-'+index);await page.getByRole('button',{name:'Weiter',exact:true}).click();
   await page.locator(`#originalParticipantStarter mat-card[data-booklet-key="${scenario.code?'code-entry':'first'}"] button`).click();
   await page.frameLocator('iframe').locator('#demoPlayerAnswer').waitFor();
   const runId=new URL(page.url()).searchParams.get('testRunId');assert.ok(runId);
   await page.waitForFunction(()=>typeof window.tc?.pause==='function');await page.evaluate(()=>window.tc.debug());
   const pane=page.locator('[data-debug-window="main"]');await poll(async()=>/BS:\s*live/.test(await pane.innerText()),'Timer fixture reception did not become live');
   let initial=await repository.getTestRunById(runId);
   if(scenario.legacy){
    const id='owned-legacy-timer-'+index;
    legacyPacket={testRunId:initial.testRunId,contentReleaseId:initial.contentReleaseId,bookletKey:initial.bookletKey,deliveryId:id,keyword:'goto',arguments:['id','first-unit','give 0'],controllerStatus:'RUNNING',timeStamp:Date.now()};
    holdLegacyRoute=async route=>{
     const packet=route.request().postDataJSON();assert.deepEqual(packet,legacyPacket);heldLegacy=true;await legacyGate;
     const response=await route.fetch(),body=await response.json();legacyApplications.push(body);
     await writeFile(join(artifacts,'legacy-replies-'+index+'.json'),JSON.stringify({packet,status:response.status(),responses:legacyApplications},null,2)+'\n');
     assert.equal(response.status(),200,JSON.stringify(body));await route.fulfill({response}).catch(error=>{
      if(!disposing||!/Route is already handled|Target.*closed|Request.*aborted/i.test(error.message))throw error;
     });
    };
    await page.route('**/native-commands',holdLegacyRoute);
    // Seed only the replacement document: the departing live controller must
    // not discover and start this migration fixture before the real reload.
    await page.addInitScript(({run,packet})=>{
     if(window.top!==window)return;
     const owner=sessionStorage.getItem('testcenter-rewrite:participant-native-owner:v1');if(!owner)throw Error('The owned controller has no reload identity');
     const scope=Object.fromEntries(['tenantId','workspaceId','participantSessionId','testRunId','contentReleaseId','bookletKey'].map(key=>[key,run[key]]));
     localStorage.setItem('testcenter-rewrite:participant-native-command:v1:'+packet.deliveryId,JSON.stringify({scope,owner,id:packet.deliveryId,keyword:packet.keyword,args:packet.arguments,request:packet,prepared:true}));
    },{run:initial,packet:legacyPacket});
    await page.reload({waitUntil:'domcontentloaded'});await page.frameLocator('iframe').locator('#demoPlayerAnswer').waitFor();
    await page.waitForFunction(()=>typeof window.tc?.pause==='function');await page.evaluate(()=>window.tc.debug());
    await poll(()=>Promise.resolve(heldLegacy),'The real reload did not restore its unclocked legacy packet');
    await poll(async()=>/BS:\s*live/.test(await pane.innerText()),'Legacy fixture reception did not become live');
    initial=await repository.getTestRunById(runId);
   }
   if(scenario.code){
    assert.equal(initial.currentUnitKey,'intro-unit');assert.equal(initial.testletTimers.timed,undefined);
    await page.evaluate(()=>window.tc.pause());await poll(async()=>(await repository.getTestRunById(runId)).status==='paused','The code-entry fixture did not pause');await page.locator('#participantRoutePausedState').waitFor();
    const paused=await repository.getTestRunById(runId),zero={testletKey:'timed',status:'paused',durationSeconds:10,remainingSeconds:0,startedAt:paused.createdAt,expiresAt:null,updatedAt:paused.updatedAt,endedAt:null,interruptedAtUnitKey:'first-unit'};
    await repository.saveTestRun({...paused,lockedUnitKeys:['intro-unit'],testletTimers:{...paused.testletTimers,timed:zero}});
    if(scenario.origin==='native')await page.evaluate(()=>window.tc.resume());else await api(workspace+`/monitor/open-runs/${runId}/commands`,{commandType:'resume'},operator);
    await page.locator('#participantRouteTestletUnlockCode').waitFor();await page.waitForFunction(()=>!document.querySelector('iframe'));
    const waiting=await repository.getTestRunById(runId);assert.equal(waiting.currentUnitKey,'first-unit');assert.deepEqual(waiting.testletTimers.timed,zero);
    const responseBefore=structuredClone(waiting.unitResponses),clocksBefore=structuredClone(waiting.unitResponseFieldTimestamps);
    await page.locator('#participantRouteTestletUnlockCode').fill('wrong');
    const denied=page.waitForResponse(response=>response.url().endsWith('/testlets/timed/unlock'));await page.locator('#participantRouteTestletUnlockButton').click();assert.equal((await denied).status(),403);
    assert.deepEqual(await repository.getTestRunById(runId),waiting);assert.equal(await page.locator('iframe').count(),0);
    await page.locator('#participantRouteTestletUnlockCode').fill('oWnEd');await page.locator('#participantRouteTestletUnlockButton').click();await page.frameLocator('iframe').locator('#demoPlayerAnswer').waitFor();
    const unlocked=await repository.getTestRunById(runId);assert.equal(unlocked.currentUnitKey,'first-unit');assert.equal(unlocked.testletTimers.timed.status,'running');assert.equal(unlocked.testletTimers.timed.remainingSeconds,10);assert.equal(unlocked.testletTimers.timed.interruptedAtUnitKey,undefined);assert.deepEqual(unlocked.unitResponses,responseBefore);assert.deepEqual(unlocked.unitResponseFieldTimestamps,clocksBefore);
    checks.push({scenario,paused,waiting,unlocked});console.log(`participant_controller_timer=${scenario.origin}-resume-code-entry:passed`);continue;
   }
   assert.equal(initial.testletTimers.timed.status,'running');
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
    if(scenario.legacy&&route.request().postDataJSON().deliveryId===legacyPacket.deliveryId)return holdLegacyRoute(route);
    heldApplication=true;await applicationGate;const response=await route.fetch();assert.equal(response.status(),200);applications.push(await response.json());await route.fulfill({response});
   };
   await page.route('**/native-commands',captureApplication);await page.route('**/commands/*/application',captureApplication);
   await page.frameLocator('iframe').locator('#demoPlayerAnswer').fill('Owned timer answer '+index);
   await poll(()=>Promise.resolve(heldAnswer),'The timer fixture did not hold its committed Player answer');
   const before=await repository.getTestRunById(runId);
   if(scenario.zero&&scenario.origin==='remote'){
    await page.route('**/commands/*/acknowledgement',async route=>{const response=await route.fetch();assert.equal(response.status(),200);heldAck=true;await ackGate;await route.fulfill({response});});
    await api(workspace+`/monitor/open-runs/${runId}/commands`,{commandType:'pause'},operator);await poll(()=>Promise.resolve(heldAck),'The zero-tick remote Pause did not reach its held ACK');
   }
   if(scenario.zero)await delay(Math.max(0,Date.parse(initial.testletTimers.timed.expiresAt)-950-Date.now()));
   if(scenario.origin==='native')await page.evaluate(keyword=>window.tc[keyword](),scenario.keyword);
   else if(scenario.zero)releaseAck();
   else await api(workspace+`/monitor/open-runs/${runId}/commands`,{commandType:scenario.keyword==='terminate'?'complete':'pause'},operator);
   await poll(()=>Promise.resolve(timerPackets.length>=(scenario.lostTimerReply?2:1)),'Timer interruption was blocked behind the answer buffer');
   const first=timerPackets[0];if(scenario.zero)assert.equal(first.packet.remainingSeconds,0);else assert.ok(first.packet.remainingSeconds>0);assert.equal(first.receipt.applied,true);
   if(scenario.lostTimerReply){assert.deepEqual(timerPackets[1].packet,first.packet);assert.equal(timerPackets[1].receipt.applied,false);}
   await poll(async()=>new RegExp('STATUS:\\s*'+(scenario.keyword==='pause'?'PAUSED':'TERMINATED')).test(await pane.innerText()),'The controller phase did not enter before its held command');
   const wait=Math.max(0,Date.parse(first.packet.expiresAt)+500-Date.now());await delay(wait);
   const frozen=await repository.getTestRunById(runId);assert.equal(frozen.status,'running');assert.equal(frozen.currentUnitKey,'first-unit');assert.equal(frozen.testletTimers.timed.status,'paused');assert.equal(frozen.testletTimers.timed.remainingSeconds,first.packet.remainingSeconds);
   assert.equal(frozen.controllerDispatches?.[first.packet.controllerDispatch.controllerId]??0,0);assert.deepEqual(frozen.unitResponses,before.unitResponses);assert.deepEqual(frozen.unitResponseFieldTimestamps,before.unitResponseFieldTimestamps);assert.deepEqual(frozen.controllerEntry,before.controllerEntry);
   assert.deepEqual(await repository.getParticipantSessionById(initial.participantSessionId),parentBefore);assert.deepEqual(await repository.getTestRunById(sibling.testRunId),siblingBefore);
   assert.equal(applications.length,0);if(scenario.keyword==='terminate'||scenario.origin==='native')assert.equal(heldApplication,false,'An answer-draining command reached application before its answer receipt');
   if(scenario.legacy){
    assert.equal(legacyApplications.length,0,'The legacy state effect settled before its deliberate release');
    const queued=await page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('testcenter-rewrite:participant-native-command:v1:')).map(key=>JSON.parse(localStorage.getItem(key))));
    const modern=queued.find(entry=>entry.version===2&&entry.keyword===scenario.keyword);assert.equal(modern.timerInterrupted,true);assert.equal(modern.prepared,undefined);assert.deepEqual(queued.find(entry=>entry.request.deliveryId===legacyPacket.deliveryId).request,legacyPacket);
    releaseLegacy();await poll(()=>Promise.resolve(legacyApplications.length>=1),'The original unclocked packet did not settle after release');
   }
   releaseAnswer();await poll(()=>Promise.resolve(heldApplication),'The timer command did not reach application after its buffer release');releaseApplication();
   await poll(()=>Promise.resolve(applications.length===1),'The timer command application did not complete');
   const final=await repository.getTestRunById(runId);assert.equal(final.status,'paused');assert.equal(final.testletTimers.timed.remainingSeconds,first.packet.remainingSeconds);assert.deepEqual(final.unitResponses,before.unitResponses);assert.deepEqual(final.unitResponseFieldTimestamps,before.unitResponseFieldTimestamps);
   assert.deepEqual(await repository.getTestRunById(sibling.testRunId),siblingBefore);
   let resumed;
   if(scenario.zero){
    await page.locator('#participantRoutePausedState').waitFor();
    if(scenario.resume==='native')await page.evaluate(()=>window.tc.resume());else await api(workspace+`/monitor/open-runs/${runId}/commands`,{commandType:'resume'},operator);
    await poll(()=>Promise.resolve(applications.length===2),'The zero-tick Resume application did not complete');
    resumed=await repository.getTestRunById(runId);assert.equal(resumed.currentUnitKey,'first-unit','Zero STEP was treated as an expired block');assert.equal(resumed.testletTimers.timed.status,'running');assert.equal(resumed.testletTimers.timed.remainingSeconds,10);
    const receipt=applications[1].application,executedAt=receipt.executedAt??receipt.command.executedAt;assert.equal(resumed.testletTimers.timed.expiresAt,new Date(Date.parse(executedAt)+10_000).toISOString());
    assert.deepEqual(resumed.unitResponses,before.unitResponses);assert.deepEqual(resumed.unitResponseFieldTimestamps,before.unitResponseFieldTimestamps);assert.deepEqual(await repository.getTestRunById(sibling.testRunId),siblingBefore);
    await poll(async()=>await page.frameLocator('iframe').locator('#demoPlayerAnswer').inputValue()==='Owned timer answer '+index,'The restarted timed Unit did not restore its exact answer');
   }
   checks.push({scenario,timerPackets,legacyPacket,legacyApplications,before,frozen,final,resumed});console.log(`participant_controller_timer=${scenario.origin}-${scenario.keyword}${scenario.lostTimerReply?'-lost-reply':''}${scenario.zero?'-zero-'+scenario.resume+'-resume':''}${scenario.legacy?'-legacy-wait':''}:passed`);
  }catch(error){caseFailure=error;await writeFile(join(artifacts,'failure.json'),JSON.stringify({scenario,error:String(error),timerPackets,legacyPacket,legacyApplications,heldAnswer,heldApplication,heldLegacy,errors},null,2)+'\n');throw error;
  }finally{disposing=true;releaseAnswer();releaseApplication();releaseAck();releaseLegacy();await page.unrouteAll({behavior:caseFailure?'ignoreErrors':'wait'}).catch(()=>{});await context.close();}
 }
 for(const check of checks.filter(check=>check.scenario.legacy))assert.equal(check.legacyApplications.filter(reply=>reply.application.applied).length,1,'The repeated legacy wire packet must have exactly one state effect');
 assert.deepEqual(errors,[]);gate.assertHealthy();await writeFile(join(artifacts,'timer-interruptions.json'),JSON.stringify({checks,errors},null,2)+'\n');
}finally{
 for(const release of releases)release();await browser?.close();server.kill('SIGTERM');await closed;gate.assertHealthy();console.log('owned_api=shutdown');
}
