import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';

/** Actual browser closure and worker requests against the production native
 * SQLite API. The helper never sends a Unit response on the browser's behalf. */
export async function runNativeBackgroundLockedSmoke({browser,base,file,out,password,mark,configure,release,responseReceipts,serverMessages=[]}){
 const context=await browser.newContext({viewport:{width:1280,height:850}}),errors=[],workerRequests=[],network=[],requests=new WeakMap();
 const started=Date.now();let phase='initial';
 context.on('request',request=>{const url=new URL(request.url());if(url.origin!==base)return;const row={phase,time:Date.now()-started,method:request.method(),path:url.pathname.replace(/^(\/file\/)[^/]+/,'$1[resource-capability]'),worker:!!request.serviceWorker()};network.push(row);requests.set(request,row);});
 context.on('response',response=>{const row=requests.get(response.request());if(row){row.status=response.status();row.responseTime=Date.now()-started;}});
 context.on('requestfinished',request=>{const row=requests.get(request);if(row)row.finished=Date.now()-started;});
 context.on('requestfailed',request=>{const row=requests.get(request);if(row)row.failure=request.failure()?.errorText;});
 let page=await context.newPage();page.setDefaultTimeout(20000);
 context.on('request',request=>{const url=new URL(request.url());if(request.serviceWorker()&&/^\/test\//.test(url.pathname))workerRequests.push({path:url.pathname,method:request.method(),deliveryId:request.headers()['x-native-delivery-id'],body:request.postData()});});
 const observe=target=>target.on('pageerror',error=>errors.push(String(error)));observe(page);
 const snapshot=testId=>{const db=new DatabaseSync(file,{readOnly:true});try{
  db.exec('PRAGMA busy_timeout=1000');const run=db.prepare('SELECT t.test_run_id,t.locked,t.status,t.original_test_state_json,t.testlet_timers_json FROM test_runs t JOIN original_test_numbers n ON n.test_run_id=t.test_run_id WHERE n.test_number=?').get(testId);assert.ok(run);
  const unit=db.prepare('SELECT unit_json FROM original_native_units WHERE test_run_id=? AND unit_name=?').get(run.test_run_id,'OWNED.UNIT');
  return {runId:run.test_run_id,locked:!!run.locked,status:run.status,state:JSON.parse(run.original_test_state_json),timers:run.testlet_timers_json,response:unit?JSON.parse(unit.unit_json).parts.find(part=>part.id==='owned')?.content??null:null};
 }finally{db.close();}};
 const wait=async(predicate,label)=>{const deadline=Date.now()+20000;while(Date.now()<deadline){const value=await predicate();if(value)return value;await new Promise(done=>setTimeout(done,20));}throw Error('Native background acceptance deadline: '+label);};
 try{
  await configure('native-background-locked',0);
  await page.goto(base+'/app/native-start?ui=original');await page.getByRole('textbox',{name:'Anmeldename',exact:true}).fill('native-background');await page.locator('[data-cy=login-user]').click();await page.getByLabel('Kennwort',{exact:true}).fill(password);await page.locator('[data-cy=login-user]').click();
  const card=page.locator('[data-cy="booklet-OWNED.BROWSER"]');await card.waitFor();await card.getByRole('button',{name:'Starten',exact:true}).click();await page.waitForURL(/\/native-test\/[1-9][0-9]*\/u\/1(?:\?|$)/);
  const testId=/\/native-test\/([1-9][0-9]*)/.exec(new URL(page.url()).pathname)[1],actorToken=await page.evaluate(()=>localStorage.getItem('testcenter-native-monitor-session'));
  const player=page.frameLocator('iframe');await player.locator('body[data-started=true]').waitFor();await page.evaluate(()=>navigator.serviceWorker.ready);
  const answer='Owned locked background answer Ω  ';await player.getByRole('textbox',{name:'Owned answer',exact:true}).fill(answer);
  const pending=await page.waitForFunction(({testId,answer})=>{
   for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(!key?.startsWith('testcenter-native-unit-journal:v1:'))continue;
    const doc=JSON.parse(localStorage.getItem(key));if(doc.testId!==testId)continue;const row=doc.entries.find(entry=>entry.kind==='response'&&entry.phase==='staged'&&JSON.parse(entry.payload).dataParts.owned===answer);if(row)return{id:row.id,payload:row.payload,revision:doc.revision};
   }return false;
  },{testId,answer}).then(handle=>handle.jsonValue());
  await configure('native-background-locked',0,'background-closed-init',pending.id);
  assert.equal(snapshot(testId).response,null);assert.equal(workerRequests.some(request=>request.path.endsWith('/response')),false);mark('native-worker-preserves-the-live-Original-response-window-before-view-closure');
  const locked=await fetch(base+'/test/'+testId+'/lock',{method:'PATCH',headers:{AuthToken:actorToken,'Content-Type':'application/json'},body:JSON.stringify({timeStamp:Date.now(),message:'Owned background acceptance lock'})});assert.equal(locked.status,200);await locked.text();
  const blocked=await fetch(base+'/test/'+testId,{headers:{AuthToken:actorToken}});assert.equal(blocked.status,423);await blocked.text();const before=snapshot(testId);assert.equal(before.locked,true);
  assert.equal(await page.evaluate(({id,answer})=>{
   for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(!key?.startsWith('testcenter-native-unit-journal:v1:'))continue;const doc=JSON.parse(localStorage.getItem(key));if(doc.entries.some(row=>row.id===id&&row.phase==='staged'&&JSON.parse(row.payload).dataParts?.owned===answer))return true;}return false;
  },{id:pending.id,answer}),true);
  phase='closing';page.on('dialog',dialog=>dialog.accept());const closing=page.waitForEvent('close');await page.close({runBeforeUnload:true});await closing;assert.equal(context.pages().length,0);
  await wait(()=>serverMessages.some(message=>message.nativeHeld==='native-background-locked'),'worker response initialization reaches the owned gate');
  assert.equal(snapshot(testId).response,null);assert.equal(await release('native-background-locked'),true);
  const saved=await wait(()=>{const value=snapshot(testId);return value.response===answer?value:null;},'closed native view worker delivery');
  assert.equal(saved.locked,true);assert.equal(saved.status,before.status);assert.equal(saved.state.CONTROLLER,before.state.CONTROLLER);assert.deepEqual(saved.state.TESTLETS_TIMELEFT,before.state.TESTLETS_TIMELEFT);assert.equal(saved.timers,before.timers);
  const workerWrite=await wait(()=>workerRequests.find(request=>request.path===`/test/${testId}/unit/OWNED.UNIT/response`&&request.method==='PUT'&&request.deliveryId===pending.id),'observed real Service Worker response request');
  assert.equal(workerWrite.body,pending.payload);mark('closed-native-view-worker-commits-exact-pending-response-while-Test-GET-is423');
  phase='reopening';page=await context.newPage();page.setDefaultTimeout(20000);observe(page);await page.goto(base+'/app/native-start?ui=original');
  const lockedCard=page.locator('[data-cy="booklet-OWNED.BROWSER"]');await lockedCard.waitFor();assert.equal(await lockedCard.getByRole('button').isDisabled(),true);assert.equal(await page.locator('iframe').count(),0);assert.equal(await page.evaluate(()=>localStorage.getItem('testcenter-native-monitor-session')),actorToken);
  const queues=await wait(async()=>{const value=await page.evaluate(async testId=>{
   let localEntries=0,localDocuments=0;
   for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(!/^testcenter-native-(?:unit|test)-journal:v1:/.test(key??''))continue;const doc=JSON.parse(localStorage.getItem(key));if(doc.testId===testId){assertJournal(doc);localEntries+=doc.entries.length;localDocuments++;}}
   function assertJournal(doc){if(!Array.isArray(doc.entries))throw Error('Invalid owned native journal.');}
   const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('testcenter-native-save-v1',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
   try{return await new Promise((resolve,reject)=>{const request=db.transaction('documents','readonly').objectStore('documents').index('pending').getAll(1);request.onsuccess=()=>{const pending=request.result.filter(record=>record.testId===testId);resolve({localEntries,localDocuments,indexedPendingDocuments:pending.length,indexedEntries:pending.reduce((sum,record)=>sum+record.document.entries.length,0)});};request.onerror=()=>reject(request.error);});}finally{db.close();}
  },testId);return value.localEntries===0&&value.indexedPendingDocuments===0&&value.indexedEntries===0?value:false;},'both actual native queues reconcile');
  assert.equal(snapshot(testId).response,answer);assert.equal(snapshot(testId).locked,true);mark('locked-Source-starter-reconciles-both-native-queues-without-reopening-its-controller');
  assert.deepEqual(errors,[]);const replies=responseReceipts.filter(receipt=>receipt.phase==='native-background-locked'&&receipt.path===`/test/${testId}/unit/OWNED.UNIT/response`);assert.ok(replies.some(receipt=>receipt.status===201&&receipt.deliveryId===pending.id));
  await writeFile(join(out,'native-background-locked.json'),JSON.stringify({success:true,testId,capturedPacketId:pending.id,capturedRevision:pending.revision,exactPayload:true,testGetStatus:423,zeroOpenPagesDuringDelivery:true,backendGateReleasedOnlyAfterAllPagesClosed:true,lockedPreserved:true,controllerAndTimersPreserved:true,starterDisabled:true,localAndIndexedDBQueuesEmpty:true,queues,workerRequests,network,backendNetwork:serverMessages.flatMap(row=>row.nativeBackgroundNetwork?[row.nativeBackgroundNetwork]:[]),replyStatuses:replies.map(row=>row.status),errors},null,2));
 }catch(error){await page?.screenshot({path:join(out,'native-background-locked-failure.png')}).catch(()=>{});await writeFile(join(out,'native-background-locked-failure.json'),JSON.stringify({error:String(error),workerRequests,network,backendNetwork:serverMessages.flatMap(row=>row.nativeBackgroundNetwork?[row.nativeBackgroundNetwork]:[]),errors},null,2));throw error;}
 finally{await context.close();}
}
