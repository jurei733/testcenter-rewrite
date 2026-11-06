import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';
const hash=value=>createHash('sha256').update(value).digest('hex');

/** Official STARS payloads, real native pause and production worker delivery.
 * The coordinator only seeds retained local journals and reads server results;
 * it never writes a Unit response or sends a worker drain/seal message. */
export async function runNativeStarsClosedRunsSmoke({browser,base,file,out,fixture,mark,configure,release,responseReceipts,testWriteReceipts,serverMessages}){
 const stem='native-stars-closure',runs=[],errors=[],workerRequests=[];let monitorContext,monitorPage;
 const pauseText=JSON.parse(await readFile(new URL('../apps/web/src/app/native-participant/shared/objects/custom-texts.json',import.meta.url),'utf8')).booklet_pausedmessage.defaultvalue;
 const wait=async(predicate,label)=>{const end=Date.now()+20000;while(Date.now()<end){const value=await predicate();if(value)return value;await new Promise(done=>setTimeout(done,20));}throw Error('Native STARS closure deadline: '+label);};
 const readDb=operation=>{const db=new DatabaseSync(file,{readOnly:true});try{db.exec('PRAGMA busy_timeout=1000');return operation(db);}finally{db.close();}};
 const snapshot=run=>readDb(db=>{const value=db.prepare('SELECT t.test_run_id,t.status,t.locked,t.original_test_state_json,t.testlet_timers_json FROM test_runs t JOIN original_test_numbers n ON n.test_run_id=t.test_run_id WHERE n.test_number=?').get(run.testId);assert.ok(value);const state=JSON.parse(value.original_test_state_json);return{runId:value.test_run_id,status:value.status,locked:!!value.locked,controller:state.CONTROLLER,timeLeft:state.TESTLETS_TIMELEFT,timers:value.testlet_timers_json};});
 const accepted=()=>responseReceipts.filter(row=>row.status===201&&runs.some(run=>run.ids?.includes(row.deliveryId))&&row.path.endsWith('/response'));
 const markedCount=()=>readDb(db=>db.prepare('SELECT unit_json FROM original_native_units WHERE test_run_id IN (?,?)').all(...runs.map(run=>run.paused.runId)).filter(row=>JSON.parse(row.unit_json).parts.some(part=>part.id==='ownedRecovery'&&part.content?.startsWith('nativeClosure:'))).length);
 const queue=page=>page.evaluate(async()=>{
  const local=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(/^testcenter-native-(?:unit|test)-journal:v1:/.test(key??'')){const doc=JSON.parse(localStorage.getItem(key));local.push({key,testId:doc.testId,entries:doc.entries});}}
  const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('testcenter-native-save-v1',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
  try{const rows=await new Promise((resolve,reject)=>{const request=db.transaction('documents').objectStore('documents').getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});return{local,rows};}finally{db.close();}
 });
 try{
  await configure(stem+'-setup',0);
  for(const [index,name]of ['stars-3','stars-4'].entries()){
   const context=await browser.newContext({viewport:{width:1280,height:850}}),page=await context.newPage(),run={index,name,context,page};runs.push(run);page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(String(error)));
   const network=new WeakMap();context.on('request',request=>{const path=new URL(request.url()).pathname,id=request.headers()['x-native-delivery-id'];if(!path.endsWith('/response')||!request.postDataJSON()?.dataParts?.ownedRecovery?.startsWith('nativeClosure:'))return;const row={testId:run.testId,path,method:request.method(),deliveryId:id,body:request.postData(),worker:!!request.serviceWorker(),actorHash:hash(request.headers().authtoken??''),zeroActorPagesAtStart:runs.every(row=>row.context.pages().length===0)};workerRequests.push(row);network.set(request,row);});
   context.on('response',response=>{const row=network.get(response.request());if(row){row.status=response.status();row.zeroActorPagesAtReply=runs.every(run=>run.context.pages().length===0);}});
   await page.goto(base+'/app/native-start?ui=original');await page.getByRole('textbox',{name:'Anmeldename',exact:true}).fill(name);await page.locator('[data-cy=login-user]').click();await page.getByLabel('Kennwort',{exact:true}).fill('123');await page.locator('[data-cy=login-user]').click();
   const card=page.locator('[data-cy^="booklet-"]').filter({hasText:fixture.source.booklet.bookletKey});await card.waitFor();await card.getByRole('button').click();await page.waitForURL(/\/native-test\/[1-9][0-9]*\/u\/[0-9]+(?:\?|$)/);
   run.testId=/\/native-test\/([1-9][0-9]*)/.exec(new URL(page.url()).pathname)[1];run.current=/\/u\/([0-9]+)/.exec(new URL(page.url()).pathname)[1];
   const first=page.frameLocator('iframe').locator('[data-cy="button-0"] input');await first.waitFor({state:'attached'});const choice=await first.isChecked()?page.frameLocator('iframe').locator('[data-cy="button-1"] input'):first;
   const saved=page.waitForResponse(response=>new URL(response.url()).pathname===`/test/${run.testId}/unit/${run.current}/response`&&response.status()===201);await choice.dispatchEvent('click');run.base=(await saved).request().postDataJSON();run.token=await page.evaluate(()=>localStorage.getItem('testcenter-native-monitor-session'));await page.evaluate(()=>navigator.serviceWorker.ready);
   assert.equal(run.base.originalUnitId.toUpperCase(),fixture.source.unit.unitKey.toUpperCase());assert.equal(run.base.responseType,fixture.source.player.unitStateType);
  }
  assert.notEqual(runs[0].testId,runs[1].testId);
  await configure(stem+'-offline',0,'stars-offline',undefined,{testIds:runs.map(run=>run.testId)});
  for(const run of runs){
   const seeded=await run.page.evaluate(async({testId,base,current,index})=>{
    const token=localStorage.getItem('testcenter-native-monitor-session'),actor=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),byte=>byte.toString(16).padStart(2,'0')).join(''),key='testcenter-native-unit-journal:v1:'+actor+':'+testId+':'+crypto.randomUUID(),now=Date.now();
    const entries=Array.from({length:28},(_,i)=>{const unitAlias=String(i+1);return{id:crypto.randomUUID(),kind:'response',unitAlias,originalUnitId:base.originalUnitId,queuedAt:now+(unitAlias===current?100:i),phase:'staged',payload:JSON.stringify({...base,timeStamp:now,dataParts:{...base.dataParts,ownedRecovery:'nativeClosure:'+index+':'+unitAlias+' Ω'}})};});localStorage.setItem(key,JSON.stringify({version:1,actor,testId,revision:1,entries}));return{key,actor,entries};
   },{testId:run.testId,base:run.base,current:run.current,index:run.index});Object.assign(run,seeded,{ids:seeded.entries.map(row=>row.id)});
   await run.page.reload({waitUntil:'domcontentloaded'});await run.page.getByRole('button',{name:'Erneut speichern',exact:true}).waitFor();
   const retained=await run.page.evaluate(key=>JSON.parse(localStorage.getItem(key)),run.key);assert.deepEqual(retained.entries.map(({phase,...row})=>row),run.entries.map(({phase,...row})=>row));
   await wait(async()=>{const value=await queue(run.page);const row=value.rows.find(row=>row.bucket===run.key);return row?.document.entries.length===28;},'production IndexedDB mirror contains all28 responses');
  }
  assert.equal(accepted().length,0);mark('native-Original-STARS-56-retained-real-payloads-enter-production-IndexedDB-before-closure');
  monitorContext=await browser.newContext({viewport:{width:1280,height:850}});monitorPage=await monitorContext.newPage();monitorPage.setDefaultTimeout(20000);monitorPage.on('pageerror',error=>errors.push(String(error)));
  await monitorPage.goto(base+'/app/group-monitor/group1?ui=original');await monitorPage.locator('input[name=name]').fill(fixture.observer.name);await monitorPage.locator('[data-cy=login-user]').click();await monitorPage.locator('input[name=password]').fill(fixture.observer.password);await monitorPage.locator('[data-cy=login-user]').click();await monitorPage.locator('[data-cy=gm-card-0]').getByRole('button',{name:'Gruppen-Monitor Starten',exact:true}).click();await monitorPage.waitForURL(/\/group-monitor\/group1\/full(?:\?|$)/);
  for(const run of runs)await monitorPage.locator('tc-test-session[data-test-id="'+run.testId+'"]').getByRole('checkbox').check();
  const pauseReply=monitorPage.waitForResponse(response=>new URL(response.url()).pathname==='/monitor/command'&&response.request().method()==='PUT');void pauseReply.catch(()=>{});await monitorPage.locator('[data-cy=GM_pause_button]').click();assert.equal((await pauseReply).status(),201);
  for(const run of runs){await run.page.getByText(pauseText,{exact:true}).waitFor();assert.equal(await run.page.locator('iframe').count(),0);await wait(()=>snapshot(run).controller==='PAUSED','acknowledged Source pause reaches persisted Test state');run.paused=snapshot(run);}
  await monitorContext.close();monitorContext=undefined;
  const foreign=()=>readDb(db=>db.prepare('SELECT test_run_id,unit_name,unit_json FROM original_native_units WHERE test_run_id NOT IN (?,?) ORDER BY test_run_id,unit_name').all(...runs.map(run=>run.paused.runId)).map(row=>[row.test_run_id,row.unit_name,hash(row.unit_json)]));const foreignBefore=foreign();
  await configure(stem,0,'stars-closure',undefined,{testIds:runs.map(run=>run.testId),closureIds:runs.flatMap(run=>run.ids)});
  for(const run of runs){run.worker=run.context.serviceWorkers()[0];assert.ok(run.worker);run.page.on('dialog',dialog=>dialog.accept());const closed=run.page.waitForEvent('close');await run.page.close({runBeforeUnload:true});await closed;}
  assert.ok(runs.every(run=>run.context.pages().length===0));
  for(const run of runs)await wait(()=>serverMessages.some(message=>message.nativeHeld===stem+':'+run.testId),'worker reaches held Unit response');
  assert.equal(accepted().length,0,'No pending response may be accepted before all actor pages close and both gates release');
  assert.equal(markedCount(),0,'The production database must have no pending marker committed before gate release');
  for(const run of runs)assert.equal(await release(stem+':'+run.testId),true);
  await wait(()=>new Set(accepted().map(row=>row.deliveryId)).size===56,'all56 closed-worker responses reach native201');assert.equal(accepted().length,56);
  const closedQueues=[];
  for(const run of runs){
   const state=await wait(async()=>{const value=await run.worker.evaluate(async()=>{
    const clients=await self.clients.matchAll({type:'window',includeUncontrolled:true});const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('testcenter-native-save-v1',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});try{const rows=await new Promise((resolve,reject)=>{const request=db.transaction('documents').objectStore('documents').getAll();request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});return{clients:clients.length,pending:rows.filter(row=>row.pending).length,entries:rows.reduce((sum,row)=>sum+row.document.entries.length,0)};}finally{db.close();}
   });return value.pending===0&&value.entries===0?value:false;},'actual worker acknowledges its entire IndexedDB queue without a page');assert.equal(state.clients,0);closedQueues.push(state);
   assert.deepEqual(snapshot(run),run.paused);const writes=workerRequests.filter(row=>row.testId===run.testId&&row.status===201);assert.equal(writes.length,28);for(const row of writes){assert.equal(row.worker,true);assert.equal(row.zeroActorPagesAtReply,true);assert.equal(row.actorHash,run.actor);assert.equal(row.body,run.entries.find(entry=>entry.id===row.deliveryId)?.payload);}
   run.serverHashes=[];for(const entry of run.entries){const reply=await run.context.request.get(base+`/test/${run.testId}/unit/${encodeURIComponent(run.base.originalUnitId)}/alias/${entry.unitAlias}`,{headers:{AuthToken:run.token,'X-Native-Unit-Protocol':'1'}});assert.equal(reply.status(),200);const value=await reply.json(),body=JSON.parse(entry.payload);assert.deepEqual(value.dataParts,body.dataParts);assert.equal(value.unitResponseType,body.responseType);for(const key of Object.keys(body.dataParts))assert.equal(value.nativeClocks.partClocks[key],body.timeStamp);run.serverHashes.push(hash(JSON.stringify(Object.entries(value.dataParts).sort())));}
  }
  assert.equal(markedCount(),56);assert.deepEqual(foreign(),foreignBefore);mark('native-Original-STARS-workers-deliver56-after-zero-pages-with-exact-actor-payloads-and-paused-status');
  for(const run of runs){
   run.page=await run.context.newPage();run.page.setDefaultTimeout(20000);run.page.on('pageerror',error=>errors.push(String(error)));await run.page.goto(base+'/app/native-start?ui=original');
   await wait(async()=>{const value=await queue(run.page);return value.local.every(row=>row.entries.length===0)&&value.rows.every(row=>!row.pending&&row.document.entries.length===0);},'receipt reconciliation removes all local pending entries');
   const card=run.page.locator('[data-cy^="booklet-"]').filter({hasText:fixture.source.booklet.bookletKey});await card.waitFor();if(!await card.getByRole('button').isDisabled()){await card.getByRole('button').click();await run.page.getByText(pauseText,{exact:true}).waitFor();}
   assert.equal(await run.page.locator('iframe').count(),0);assert.equal(await run.page.locator('app-error').count(),0);assert.deepEqual(snapshot(run),run.paused);
  }
  assert.equal(accepted().length,56);assert.deepEqual(foreign(),foreignBefore);assert.deepEqual(errors,[]);mark('native-Original-STARS-56-worker-receipts-reconcile-without-reopening-paused-Players-or-touching-foreign-answers');
  await writeFile(join(out,'native-stars-closed-runs.json'),JSON.stringify({success:true,sourceCommit:fixture.source.sourceCommit,fixtureHashes:fixture.hashes,observerRosterSha256:fixture.observer.rosterSha256,officialParticipantRecordsUnchanged:true,participantContexts:2,separateMonitorContextClosed:true,zeroActorPagesBeforeGateRelease:true,manualWorkerWake:false,closedQueues,totalAccepted:56,runs:runs.map(run=>({testId:run.testId,actor:run.actor,current:run.current,retained:28,accepted:28,ids:run.ids,paused:run.paused,serverHashes:run.serverHashes})),workerRequests,errors},null,2));
 }catch(error){for(const run of runs)if(!run.page.isClosed())await run.page.screenshot({path:join(out,stem+'-'+run.index+'-failure.png')}).catch(()=>{});if(monitorPage&&!monitorPage.isClosed())await monitorPage.screenshot({path:join(out,stem+'-monitor-failure.png')}).catch(()=>{});await writeFile(join(out,'native-stars-closed-runs-failure.json'),JSON.stringify({error:String(error),runs:runs.map(run=>({testId:run.testId,current:run.current,ids:run.ids,paused:run.paused,pages:run.context.pages().length})),workerRequests,responseReceipts:responseReceipts.filter(row=>row.phase.startsWith(stem)),testWriteReceipts:testWriteReceipts.filter(row=>row.phase.startsWith(stem)),serverMessages:serverMessages.filter(row=>Object.values(row).some(value=>typeof value==='string'&&value.startsWith(stem))),errors},null,2));throw error;}
 finally{await monitorContext?.close();for(const run of runs)await run.context.close();}
}
