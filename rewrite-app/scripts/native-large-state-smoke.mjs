import assert from 'node:assert/strict';
import {writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {nativeLargeState} from './original-native-large-state-checks.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');

export async function runNativeLargeStateSmoke({browser,base,out,password,mark,configure,responseReceipts}){
 const context=await browser.newContext({viewport:{width:1280,height:850}}),page=await context.newPage(),errors=[];
 page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(String(error)));
 const wait=async(predicate,label)=>{const end=Date.now()+25000;while(Date.now()<end){if(await predicate())return;await new Promise(done=>setTimeout(done,25));}throw Error('Native large state deadline: '+label);};
 let testId;
 try{
  await configure('native-large-state-setup',0);
  await page.goto(base+'/app/native-start?ui=original');await page.getByRole('textbox',{name:'Anmeldename',exact:true}).fill('native-large-state');await page.locator('[data-cy=login-user]').click();await page.getByLabel('Kennwort',{exact:true}).fill(password);await page.locator('[data-cy=login-user]').click();
  await page.locator('[data-cy="booklet-OWNED.BROWSER"]').getByRole('button',{name:'Starten',exact:true}).click();await page.waitForURL(/\/native-test\/[1-9][0-9]*\/u\/1(?:\?|$)/);
  testId=/\/native-test\/([1-9][0-9]*)/.exec(new URL(page.url()).pathname)[1];
  const answer=()=>page.frameLocator('iframe').getByLabel('Owned answer',{exact:true});await answer().waitFor();await wait(async()=>await answer().isEnabled(),'real Verona Player starts');
  const type=async value=>answer().evaluate((input,value)=>{input.value=value;input.dispatchEvent(new Event('input',{bubbles:true}));},value);
  const large=nativeLargeState(),responsePath=`/test/${testId}/unit/OWNED.UNIT/response`;
  await type(large);await wait(()=>responseReceipts.some(row=>row.phase==='native-large-state-setup'&&row.path===responsePath&&row.status===201),'two-MiB actual native response accepted');
  await page.reload();await wait(async()=>await answer().isEnabled(),'reload starts Player');assert.equal(hash(await answer().inputValue()),hash(large));mark('native-two-MiB-Verona-answer-is-byte-exact-after-actual-API-save-and-reload');
  await page.evaluate(()=>{window.__largePlayer=document.querySelector('iframe');});
  const secured=await page.evaluate(()=>Object.keys(localStorage).filter(key=>key.startsWith('testcenter-native-unit-journal:v1:')).map(key=>[key,localStorage.getItem(key)]));
  await configure('native-large-state-offline',0,'stars-offline',undefined,{testIds:[testId]});
  const older='P'.repeat(3*1024*1024);await type(older);
  await wait(()=>responseReceipts.some(row=>row.phase==='native-large-state-offline'&&row.path===responsePath&&row.status===503),'three-MiB prior packet reaches Source buffer flush');
  const oldId=responseReceipts.find(row=>row.phase==='native-large-state-offline'&&row.path===responsePath&&row.status===503).deliveryId;
  await type(large);await page.getByRole('button',{name:'Erneut speichern',exact:true}).waitFor();
  await wait(()=>new Set(responseReceipts.filter(row=>row.phase==='native-large-state-offline'&&row.path===responsePath&&row.status===503).map(row=>row.deliveryId)).size===2,'large current packet coexists with the pending older packet');
  const packets=()=>responseReceipts.filter(row=>row.phase==='native-large-state-offline'&&row.path===responsePath&&row.status===503);
  await wait(()=>[...new Set(packets().map(row=>row.deliveryId))].every(id=>packets().filter(row=>row.deliveryId===id).length===5),'both Source retry series finish without dropping either immutable packet');
  assert.equal(await page.locator('app-error').count(),0);assert.equal(hash(await answer().inputValue()),hash(large));assert.equal(await page.evaluate(()=>window.__largePlayer===document.querySelector('iframe')),true);
  assert.match(await page.locator('[data-cy="toast-container"]').innerText(),/nicht lokal gesichert/);
  assert.equal(await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;}),true);
  for(const id of new Set(packets().map(row=>row.deliveryId)))assert.equal(new Set(packets().filter(row=>row.deliveryId===id).map(row=>row.bodySha256)).size,1);
  for(const[key,text]of secured)assert.equal(await page.evaluate(key=>localStorage.getItem(key),key),text);
  await page.screenshot({path:join(out,'native-large-state-pending.png')});mark('native-two-MiB-current-answer-retains-three-MiB-prior-packet-and-live-Player-through-ten-failures');
  await configure('native-large-state-retry',0);await page.getByRole('button',{name:'Erneut speichern',exact:true}).click();
  await wait(()=>new Set(responseReceipts.filter(row=>row.phase==='native-large-state-retry'&&row.path===responsePath&&row.status===201).map(row=>row.deliveryId)).size===2,'both original packets accepted');
  await page.getByRole('button',{name:'Erneut speichern',exact:true}).waitFor({state:'hidden'});
  const accepted=responseReceipts.filter(row=>row.phase==='native-large-state-retry'&&row.path===responsePath&&row.status===201);assert.equal(accepted.length,2);assert.ok(accepted.some(row=>row.deliveryId===oldId));
  for(const row of accepted)assert.equal(row.bodySha256,packets().find(old=>old.deliveryId===row.deliveryId).bodySha256);
  const token=await page.evaluate(()=>localStorage.getItem('testcenter-native-monitor-session')),reply=await context.request.get(base+`/test/${testId}/unit/OWNED.UNIT/alias/OWNED.UNIT`,{headers:{AuthToken:token}});assert.equal(reply.status(),200);assert.equal(hash((await reply.json()).dataParts.owned),hash(large));
  await page.reload();await wait(async()=>await answer().isEnabled(),'second reload restores latest large state');assert.equal(hash(await answer().inputValue()),hash(large));assert.deepEqual(errors,[]);mark('native-large-state-explicit-retry-keeps-frozen-identities-and-restores-latest-two-MiB-answer');
  await writeFile(join(out,'native-large-state-recovered.json'),JSON.stringify({testId,opaqueVeronaFixture:true,geoGebraApplicationExecuted:false,currentBytes:Buffer.byteLength(large),currentSha256:hash(large),priorBytes:Buffer.byteLength(older),priorMayBeViewMemory:true,failedAttempts:packets().length,accepted:accepted.map(({deliveryId,bodySha256,bodyBytes})=>({deliveryId,bodySha256,bodyBytes})),playerPreserved:true,unsafeDepartureProtected:true,reloadExact:true,errors},null,2));
 }catch(error){await page.screenshot({path:join(out,'native-large-state-failure.png')}).catch(()=>{});await writeFile(join(out,'native-large-state-failure.json'),JSON.stringify({error:String(error),testId,url:page.url(),errors,body:await page.locator('body').innerText().catch(()=>''),receipts:responseReceipts.filter(row=>row.phase.startsWith('native-large-state'))},null,2));throw error;}
 finally{await context.close();}
}
