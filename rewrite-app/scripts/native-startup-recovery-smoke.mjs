import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {DatabaseSync} from 'node:sqlite';

/** Hold the worker before its commit, capture an old real Test GET, then let
 * the worker commit and reconcile before delivering that old GET to the view. */
export async function runNativeStartupRecoverySmoke({browser,base,file,out,password,mark,configure,release,responseReceipts,serverMessages}){
 const context=await browser.newContext({viewport:{width:1280,height:850}}),errors=[],workerRequests=[];
 let page=await context.newPage(),evidence={success:false};page.setDefaultTimeout(20000);
 const observe=target=>target.on('pageerror',error=>errors.push(String(error)));observe(page);
 context.on('request',request=>{const path=new URL(request.url()).pathname;if(request.serviceWorker()&&/^\/test\//.test(path))workerRequests.push({method:request.method(),path,deliveryId:request.headers()['x-native-delivery-id'],body:request.postData()});});
 const wait=async(predicate,label)=>{const end=Date.now()+20000;while(Date.now()<end){const value=await predicate();if(value)return value;await new Promise(done=>setTimeout(done,20));}throw Error('Native startup recovery deadline: '+label);};
 const state=testId=>{const db=new DatabaseSync(file,{readOnly:true});try{db.exec('PRAGMA busy_timeout=1000');const row=db.prepare('SELECT original_test_state_json FROM test_runs WHERE test_run_id=(SELECT test_run_id FROM original_test_numbers WHERE test_number=?)').get(testId);assert.ok(row);return JSON.parse(row.original_test_state_json);}finally{db.close();}};
 try{
  await configure('native-startup-prepare',0);
  await page.goto(base+'/app/native-start?ui=original');await page.getByRole('textbox',{name:'Anmeldename',exact:true}).fill('native-startup');await page.locator('[data-cy=login-user]').click();await page.getByLabel('Kennwort',{exact:true}).fill(password);await page.locator('[data-cy=login-user]').click();
  const card=page.locator('[data-cy="booklet-OWNED.BROWSER"]');await card.waitFor();await card.getByRole('button',{name:'Starten',exact:true}).click();await page.waitForURL(/\/native-test\/[1-9][0-9]*\/u\/1(?:\?|$)/);
  const testId=/\/native-test\/([1-9][0-9]*)/.exec(new URL(page.url()).pathname)[1],url=page.url(),player=page.frameLocator('iframe');await player.locator('body[data-started=true]').waitFor();await page.evaluate(()=>navigator.serviceWorker.ready);assert.equal(await player.locator('#shared-start').textContent(),'[]');
  const shared=[{key:'owned-startup',value:'Worker before Player Ω'}],expected=JSON.stringify(shared);
  await player.getByRole('textbox',{name:'Shared key',exact:true}).fill(shared[0].key);await player.getByRole('textbox',{name:'Shared value',exact:true}).fill(shared[0].value);await player.getByRole('button',{name:'Share parameter',exact:true}).click();
  const pending=await page.waitForFunction(expected=>{
   for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(!key?.startsWith('testcenter-native-test-journal:v1:'))continue;const doc=JSON.parse(localStorage.getItem(key));const entry=doc.entries.find(row=>row.kind==='state'&&row.phase==='staged'&&JSON.parse(row.payload).some(item=>item.key==='SHARED_PARAMETERS'&&item.content===expected));if(entry)return{bucket:key,id:entry.id,testId:doc.testId};}return false;
  },expected).then(handle=>handle.jsonValue());assert.equal(pending.testId,testId);
  await configure('native-startup-recovery',1,'startup-worker-state',pending.id);assert.notEqual(state(testId).SHARED_PARAMETERS,expected);
  page.on('dialog',dialog=>dialog.accept());const closing=page.waitForEvent('close');await page.close({runBeforeUnload:true});await closing;assert.equal(context.pages().length,0);
  await wait(()=>workerRequests.some(row=>row.path===`/test/${testId}/state`&&row.deliveryId===pending.id)&&serverMessages.some(row=>row.nativeHeld==='native-startup-recovery'),'real closed-view worker at state gate');
  page=await context.newPage();page.setDefaultTimeout(20000);observe(page);const navigation=page.goto(url);void navigation.catch(()=>{});
  await wait(()=>serverMessages.some(row=>row.nativeHeld==='native-startup-recovery-test-read'),'old initial Test GET captured');
  const oldRead=serverMessages.find(row=>row.nativeStartupRead?.phase==='native-startup-recovery').nativeStartupRead;assert.equal(oldRead.status,200);assert.notEqual(oldRead.shared,expected);assert.equal(await page.locator('iframe').count(),0);
  evidence={...evidence,testId,pendingId:pending.id,oldReadShared:oldRead.shared,expectedShared:expected,zeroPagesBeforeWorkerRecovery:true,initialTestDataHeldBeforePlayer:true};mark('native-startup-captures-old-real-Test-data-before-worker-commit-and-Player-mount');
  assert.equal(await release('native-startup-recovery'),true);await wait(()=>state(testId).SHARED_PARAMETERS===expected,'worker Test state commits');
  const queues=await wait(async()=>{const value=await page.evaluate(async pending=>{
   const text=localStorage.getItem(pending.bucket),local=text?JSON.parse(text).entries.length:0;
   const db=await new Promise((resolve,reject)=>{const request=indexedDB.open('testcenter-native-save-v1',1);request.onsuccess=()=>resolve(request.result);request.onerror=()=>reject(request.error);});
   try{return await new Promise((resolve,reject)=>{const request=db.transaction('documents','readonly').objectStore('documents').get(pending.bucket);request.onsuccess=()=>resolve({local,indexed:request.result?.document.entries.length??-1});request.onerror=()=>reject(request.error);});}finally{db.close();}
  },pending);return value.local===0&&value.indexed===0?value:false;},'worker receipt reconciles before old Test GET is released');
  evidence={...evidence,backendShared:state(testId).SHARED_PARAMETERS,queues,receiptReconciledBeforeInitialTestResponse:true};mark('native-startup-worker-commits-and-clears-both-journals-before-initial-Test-response');
  assert.equal(await release('native-startup-recovery-test-read'),true);await navigation;
  const resumed=page.frameLocator('iframe');await resumed.locator('body[data-started=true]').waitFor();const actual=await resumed.locator('#shared-start').textContent();
  const reads=responseReceipts.filter(row=>row.phase==='native-startup-recovery'&&row.method==='GET'&&row.path===`/test/${testId}`);evidence={...evidence,playerShared:actual,testReads:reads.length,errors,workerRequests};
  assert.equal(actual,expected,'The actual opaque Player must receive the worker-committed shared parameters, never the held old Test data');assert.equal(reads.length,2,'Exactly one fresh Test GET is required after worker-only state recovery');assert.deepEqual(errors,[]);
  mark('native-startup-refetches-Test-once-and-mounts-the-real-Player-with-worker-committed-state');evidence.success=true;await writeFile(join(out,'native-startup-recovery.json'),JSON.stringify(evidence,null,2));
 }catch(error){evidence.error=String(error);evidence.errors=errors;evidence.workerRequests=workerRequests;evidence.backendNetwork=serverMessages.flatMap(row=>row.nativeBackgroundNetwork?.phase==='native-startup-recovery'?[row.nativeBackgroundNetwork]:[]);await writeFile(join(out,'native-startup-recovery-failure.json'),JSON.stringify(evidence,null,2));await page?.screenshot({path:join(out,'native-startup-recovery-failure.png')}).catch(()=>{});throw error;}
 finally{await context.close();}
}
