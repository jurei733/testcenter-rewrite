import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';

export async function runNativeStarsCapacitySmoke(input){
 await runCapacityCase({...input,acrossRuns:false});await runCapacityCase({...input,acrossRuns:true});
}
async function runCapacityCase({browser,base,out,mark:report,fixture,responseReceipts,configure,acrossRuns}){
 const stem=acrossRuns?'native-stars-global-capacity':'native-stars-capacity',phase=stem+'-offline';
 const artifact=name=>join(out,name.replace('native-stars-capacity',stem));
 const mark=name=>report(acrossRuns?name.replace('native-STARS-capacity','native-STARS-global-capacity'):name);
 const context=await browser.newContext({viewport:{width:1280,height:850}}),page=await context.newPage(),errors=[];page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(String(error)));
 const wait=async(predicate,label)=>{const end=Date.now()+20000;while(Date.now()<end){if(await predicate())return;await new Promise(done=>setTimeout(done,20));}throw Error('Native capacity deadline: '+label);};
 let run;
 try{
  await configure(stem+'-setup',0);await page.goto(base+'/app/native-start?ui=original');await page.getByRole('textbox',{name:'Anmeldename',exact:true}).fill('stars-4');await page.locator('[data-cy=login-user]').click();await page.getByLabel('Kennwort',{exact:true}).fill('123');await page.locator('[data-cy=login-user]').click();
  const card=page.locator('[data-cy^="booklet-"]').filter({hasText:fixture.source.booklet.bookletKey});await card.waitFor();assert.equal(await card.count(),1);await card.getByRole('button',{name:'Starten',exact:true}).click();await page.waitForURL(/\/native-test\/[1-9][0-9]*\/u\/1(?:\?|$)/);
  const testId=/\/native-test\/([1-9][0-9]*)/.exec(new URL(page.url()).pathname)[1],first=page.frameLocator('iframe').locator('[data-cy="button-0"] input');await first.waitFor({state:'attached'});
  const save=page.waitForResponse(response=>new URL(response.url()).pathname===`/test/${testId}/unit/1/response`&&response.request().method()==='PUT'&&response.status()===201);await first.dispatchEvent('click');const body=(await save).request().postDataJSON();
  await wait(()=>page.evaluate(testId=>{for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith('testcenter-native-unit-journal:v1:')&&key.includes(':'+testId+':')&&JSON.parse(localStorage.getItem(key)).entries.length)return false;}return true;},testId),'initial Source Unit buffers empty');
  await configure(phase,0,'stars-offline',undefined,{testIds:[testId]});
  run=await page.evaluate(async({testId,body,acrossRuns})=>{
   const token=localStorage.getItem('testcenter-native-monitor-session'),actor=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(token))),byte=>byte.toString(16).padStart(2,'0')).join(''),key='testcenter-native-unit-journal:v1:'+actor+':'+testId+':'+crypto.randomUUID(),now=Date.now();
   const documents=[];
   if(acrossRuns)for(let i=0;i<200;i++){
    const other=String(1000000000000000n+BigInt(i)),key='testcenter-native-unit-journal:v1:'+actor+':'+other+':'+crypto.randomUUID(),entry={id:crypto.randomUUID(),kind:'response',unitAlias:'1',originalUnitId:body.originalUnitId,queuedAt:now+i,phase:'ready',payload:JSON.stringify({...body,timeStamp:now,dataParts:{...body.dataParts,ownedRecovery:'capacity:'+i+' Ω'}})},text=JSON.stringify({version:1,actor,testId:other,revision:1,entries:[entry]});localStorage.setItem(key,text);documents.push({key,text});
   }else{
    const entries=Array.from({length:200},(_,i)=>({id:crypto.randomUUID(),kind:'response',unitAlias:'OWNED.CAPACITY.'+i,originalUnitId:body.originalUnitId,queuedAt:now+i,phase:'ready',payload:JSON.stringify({...body,timeStamp:now,dataParts:{...body.dataParts,ownedRecovery:'capacity:'+i+' Ω'}})})),text=JSON.stringify({version:1,actor,testId,revision:1,entries});localStorage.setItem(key,text);documents.push({key,text});
   }return{testId,documents};
  },{testId,body,acrossRuns});
  const retainedHash=createHash('sha256').update(JSON.stringify(run.documents.map(row=>row.text))).digest('hex');
  const assertRetained=async()=>assert.deepEqual(await page.evaluate(docs=>docs.map(({key})=>localStorage.getItem(key)),run.documents),run.documents.map(row=>row.text),'All200 secured entries must remain byte-exact');

  const changed=page.frameLocator('iframe').locator('[data-cy="button-1"] input');await changed.dispatchEvent('click');
  await page.getByRole('button',{name:'Erneut speichern',exact:true}).waitFor();
  const unloadProtected=await page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;});assert.equal(unloadProtected,true);
  assert.equal(await changed.isChecked(),true,'The unsaved201st answer must remain selected in the live Player');await assertRetained();
  const retained=await page.evaluate(()=>{const rows=[];for(let i=0;i<localStorage.length;i++){const key=localStorage.key(i);if(key?.startsWith('testcenter-native-unit-journal:v1:')){const doc=JSON.parse(localStorage.getItem(key));rows.push(...doc.entries.map(row=>({actor:doc.actor,testId:doc.testId,unitAlias:row.unitAlias})));}}return rows;});assert.equal(new Set(retained.map(row=>JSON.stringify([row.actor,row.testId,row.unitAlias]))).size,200,'The rejected201st Unit must not be represented as durably queued');
  await page.screenshot({path:artifact('native-stars-capacity-pending.png')});await writeFile(artifact('native-stars-capacity-retained.json'),JSON.stringify({testId,acrossRuns,sourceCommit:fixture.source.sourceCommit,retained:200,retainedSha256:retainedHash,liveChangedChoice:true,errors},null,2));mark('native-STARS-capacity-keeps200-exact-and-shows-visible-retry-for-live201st-answer');
  assert.match(await page.locator('[data-cy="toast-container"]').innerText(),/nicht lokal gesichert/);
  await page.evaluate(()=>{window.__capacityPlayer=document.querySelector('iframe');});await page.frameLocator('iframe').locator('[data-cy="continue-button"]').dispatchEvent('click');
  // Original test retry policy: the initial request and four retries retain
  // one delivery identity and exact bytes. Failed capacity saves stay in view.
  const failed=()=>responseReceipts.filter(row=>row.phase===phase&&row.method==='PUT'&&row.path===`/test/${testId}/unit/1/response`&&row.status===503);
  await wait(()=>failed().length===5,'five fixed failed foreground attempts');assert.equal(new URL(page.url()).pathname,`/app/native-test/${testId}/u/1`);assert.equal(await changed.isChecked(),true);assert.equal(await page.evaluate(()=>window.__capacityPlayer===document.querySelector('iframe')),true);assert.equal(await page.locator('app-error').count(),0);await assertRetained();
  const failedIds=new Set(failed().map(row=>row.deliveryId)),failedBodies=new Set(failed().map(row=>row.body));assert.equal(failedIds.size,1);assert.equal(failedBodies.size,1);const deliveryId=[...failedIds][0],frozenPayload=[...failedBodies][0];
  const unsafeMirror=await page.evaluate(async id=>{const open=indexedDB.open('testcenter-native-save-v1');const db=await new Promise((done,reject)=>{open.onsuccess=()=>done(open.result);open.onerror=()=>reject(open.error);});try{return await new Promise((done,reject)=>{const request=db.transaction('documents').objectStore('documents').getAll();request.onsuccess=()=>done(request.result.some(row=>row.document.entries.some(entry=>entry.id===id)));request.onerror=()=>reject(request.error);});}finally{db.close();}},deliveryId);assert.equal(unsafeMirror,false,'An unsecured response must not be advertised to the Service Worker as a durable packet');mark('native-STARS-capacity-keeps-the-same-Player-through-failed-retries-and-denies-unsafe-navigation');
  await configure(stem+'-retry',0);await page.getByRole('button',{name:'Erneut speichern',exact:true}).click();
  await wait(()=>responseReceipts.some(row=>row.phase===stem+'-retry'&&row.method==='PUT'&&row.deliveryId===deliveryId&&row.status===201),'explicit retry commits exact201st payload');await page.getByRole('button',{name:'Erneut speichern',exact:true}).waitFor({state:'hidden'});assert.equal(await changed.isChecked(),true);await assertRetained();
  const token=await page.evaluate(()=>localStorage.getItem('testcenter-native-monitor-session')),reply=await context.request.get(base+`/test/${testId}/unit/${encodeURIComponent(body.originalUnitId)}/alias/1`,{headers:{AuthToken:token}});assert.equal(reply.status(),200);const stored=await reply.json(),expected=JSON.parse(frozenPayload);assert.deepEqual(stored.dataParts,expected.dataParts);assert.equal(stored.unitResponseType,expected.responseType);assert.notEqual(stored.dataParts.responses,body.dataParts.responses);
  const accepted=responseReceipts.filter(row=>row.phase===stem+'-retry'&&row.method==='PUT'&&row.deliveryId===deliveryId&&row.status===201);assert.equal(accepted.length,1);assert.equal(accepted[0].body,frozenPayload);assert.equal(await page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;}),false);assert.deepEqual(errors,[]);mark('native-STARS-capacity-explicit-retry-saves201st-exactly-once-with-all200-previous-entries-intact');
  await writeFile(artifact('native-stars-capacity-recovered.json'),JSON.stringify({testId,acrossRuns,sourceCommit:fixture.source.sourceCommit,fixtureHashes:fixture.hashes,retainedBefore:200,retainedAfter:200,retainedSha256:retainedHash,unsecuredMirror:false,livePlayerPreserved:true,navigationDeniedWhileUnsecured:true,failedAttempts:5,deliveryId,requestSha256:createHash('sha256').update(frozenPayload).digest('hex'),serverDataPartsSha256:createHash('sha256').update(JSON.stringify(stored.dataParts)).digest('hex'),accepted:1,errors},null,2));

 }catch(error){await page.screenshot({path:artifact('native-stars-capacity-failure.png')}).catch(()=>{});const diagnostics=await page.evaluate(run=>({stored:run?run.documents.map(({key})=>localStorage.getItem(key)):null,body:document.body.innerText}),run).catch(()=>({}));await writeFile(artifact('native-stars-capacity-failure.json'),JSON.stringify({error:String(error),url:page.url(),errors,retainedByteExact:run?JSON.stringify(diagnostics.stored)===JSON.stringify(run.documents.map(row=>row.text)):undefined,body:diagnostics.body,responseReceipts},null,2));throw error;}
 finally{await context.close();}
}
