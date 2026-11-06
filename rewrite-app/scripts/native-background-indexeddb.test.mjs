import assert from 'node:assert/strict';
import {test,before,after} from 'node:test';
import {createServer} from 'node:http';
import {readFile} from 'node:fs/promises';
import {createRequire} from 'node:module';
import {chromium} from 'playwright';
const require=createRequire(import.meta.url),ts=require('typescript');
const source=await readFile(new URL('../apps/web/src/native-save-runtime/runtime.js',import.meta.url),'utf8');
const bridge=ts.transpileModule(await readFile(new URL('../apps/web/src/app/native-participant/native-background.ts',import.meta.url),'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText;
const bridgeScript=`(()=>{const exports={};const require=name=>{if(name==='../../native-save-runtime/runtime.js')return TestcenterNativeSave;throw Error('Unknown fixture module');};${bridge};globalThis.NativeBridge=exports;})();`;
let browser,server,base,requests=[],failUnit;
before(async()=>{
 server=createServer(async(req,res)=>{
  if(req.url==='/runtime.js'){res.writeHead(200,{'Content-Type':'application/javascript'});res.end(source);return;}
  if(req.url==='/bridge.js'){res.writeHead(200,{'Content-Type':'application/javascript'});res.end(bridgeScript);return;}
  if(req.url==='/worker.js'){res.writeHead(200,{'Content-Type':'application/javascript','Service-Worker-Allowed':'/'});res.end("importScripts('/runtime.js');TestcenterNativeSave.installWorker(self);self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));");return;}
  if(req.url.startsWith('/test/')){let body='';for await(const chunk of req)body+=chunk;requests.push({path:req.url,method:req.method,headers:req.headers,body});
   const status=failUnit&&req.url.includes('/unit/'+failUnit+'/')?503:req.method==='PATCH'?200:201;
   res.writeHead(status,{'Content-Type':'text/plain',...(req.url.endsWith('/state')?{'X-Native-State-Result':'{"version":1,"revision":1,"controlEpoch":0,"superseded":false}'}:{})});res.end('');return;}
  res.writeHead(200,{'Content-Type':'text/html'});res.end('<!doctype html><title>Owned native IndexedDB fixture</title><script src="/runtime.js"></script><script src="/bridge.js"></script>');
 });await new Promise(done=>server.listen(0,'127.0.0.1',done));base='http://127.0.0.1:'+server.address().port;
 const channel=process.env.UI_SMOKE_BROWSER_CHANNEL??(process.env.CI==='true'?undefined:'chrome');browser=await chromium.launch({...(channel?{channel}:{}),headless:true});
});
after(async()=>{await browser?.close();await new Promise(done=>server?.close(done));});
async function pageFixture(t){
 requests=[];failUnit=undefined;const context=await browser.newContext();t.after(()=>context.close());await context.addCookies([{name:'ambient',value:'must-not-send',url:base}]);const page=await context.newPage();await page.goto(base);
 await page.evaluate(async()=>{
  const rt=TestcenterNativeSave.createRuntime({indexedDB,crypto,locks:navigator.locks,fetch:(...args)=>fetch(...args),origin:location.origin});window.rt=rt;
  const token='owned-IndexedDB-capability-'+crypto.randomUUID(),actor=await rt.authorize(token);window.token=token;window.actor=actor;
  window.make=(alias,value='retained',clock=1)=>({id:crypto.randomUUID(),kind:'response',unitAlias:alias,originalUnitId:'ORIGINAL',queuedAt:clock,phase:'staged',payload:JSON.stringify({timeStamp:clock,dataParts:{owned:value},responseType:'owned/type',originalUnitId:'ORIGINAL'})});
  window.documentFor=(entries,revision=1)=>({version:1,actor,testId:'9007199254740993',revision,entries});
  window.bucket='testcenter-native-unit-journal:v1:'+actor+':9007199254740993:'+crypto.randomUUID();
  window.sendWorker=async message=>{const registration=await navigator.serviceWorker.ready,channel=new MessageChannel();return new Promise((resolve,reject)=>{
   const timeout=setTimeout(()=>reject(Error('Native worker reply deadline')),10000);channel.port1.onmessage=e=>{clearTimeout(timeout);resolve(e.data);channel.port1.close();};registration.active.postMessage({type:'testcenter-native-save-v1',...message},[channel.port2]);
  });};
  await navigator.serviceWorker.register('/worker.js',{scope:'/',updateViaCache:'none'});await navigator.serviceWorker.ready;
 });page.ownedToken=await page.evaluate(()=>token);return page;
}
const ownRequests=page=>requests.filter(request=>request.headers.authtoken===page.ownedToken);
test('actual IndexedDB and Service Worker keep live and unsealed documents on their original buffer windows',async t=>{
 const page=await pageFixture(t);const result=await page.evaluate(async()=>{
  const doc=documentFor([make('A')]);await rt.putSnapshot(bucket,JSON.stringify(doc),false);
  const unsealed=await sendWorker({action:'drain'});let release,acquired;const held=new Promise(done=>{release=done;}),ready=new Promise(done=>{acquired=done;});
  const lock=navigator.locks.request(bucket,async()=>{await rt.putSnapshot(bucket,JSON.stringify(doc),true);acquired();return held;});
  await ready;const live=await sendWorker({action:'drain'});window.releaseDocumentLease=async()=>{release();await lock;};
  return {unsealed,live,pending:(await rt.readRecord(bucket)).document.entries.length};
 });assert.deepEqual(result,{unsealed:{ok:true},live:{ok:false},pending:1});assert.deepEqual(ownRequests(page),[]);await page.evaluate(()=>releaseDocumentLease());
});
test('only the final sealed revision dispatches; stale snapshots and late handoffs cannot resurrect acknowledged data',async t=>{
 const page=await pageFixture(t);const result=await page.evaluate(async()=>{
  const old=documentFor([make('A','old',1)]),newer=structuredClone(old);newer.revision=2;newer.entries[0].payload=JSON.stringify({timeStamp:2,dataParts:{owned:'new Ω\n  '},responseType:'owned/type',originalUnitId:'ORIGINAL'});
  await rt.putSnapshot(bucket,JSON.stringify(old),false);await rt.putSnapshot(bucket,JSON.stringify(newer),false);
  const stale=await sendWorker({action:'seal',bucket,text:JSON.stringify(old)});const before=(await rt.readRecord(bucket)).document.entries.length;
  const latest=await sendWorker({action:'seal',bucket,text:JSON.stringify(newer)});const saved=await rt.readRecord(bucket);
  await sendWorker({action:'seal',bucket,text:JSON.stringify(old)});
  await rt.putSnapshot(bucket,JSON.stringify({...newer,revision:3,entries:[]}),true);await rt.putSnapshot(bucket,JSON.stringify(newer),true);
  return {stale,before,latest,pending:(await rt.readRecord(bucket)).pending,receipt:saved.receipts[newer.entries[0].id],id:newer.entries[0].id,payload:newer.entries[0].payload};
 });assert.deepEqual(result.stale,{ok:true});assert.equal(result.before,1);assert.deepEqual(result.latest,{ok:true});assert.equal(result.pending,0);assert.match(result.receipt,/^[a-f0-9]{64}$/);
 const sent=ownRequests(page);assert.equal(sent.length,2);assert.equal(sent[1].body,result.payload);assert.ok(sent.every(r=>r.headers['x-native-delivery-id']===result.id&&!r.headers.cookie&&!r.headers.authorization));
});
test('the actual bridge reconciles worker receipts by payload fingerprint before removing an old local journal',async t=>{
 const page=await pageFixture(t);const result=await page.evaluate(async()=>{
  const doc=documentFor([make('A','retained')]);localStorage.setItem(bucket,JSON.stringify(doc));await rt.putSnapshot(bucket,JSON.stringify(doc),true);await sendWorker({action:'drain'});
  const owner=new AbortController(),context=NativeBridge.nativeBackground(token,owner.signal);await context.ready;await context.settled();const stored=await rt.readRecord(bucket);
  return {local:localStorage.getItem(bucket),pending:stored.pending,revision:stored.revision,receipts:stored.receipts};
 });assert.equal(result.local,null);assert.equal(result.pending,0);assert.equal(result.revision,2);assert.deepEqual(result.receipts,{});assert.equal(ownRequests(page).filter(r=>r.method==='PUT').length,1);
});
test('a worker acknowledgement cannot clear a different newer local payload with the same delivery ID',async t=>{
 const page=await pageFixture(t);await page.evaluate(async()=>{
  const doc=documentFor([make('A','accepted')]);await rt.putSnapshot(bucket,JSON.stringify(doc),true);await sendWorker({action:'drain'});
  const changed=structuredClone(doc);changed.revision=2;changed.entries[0].payload=JSON.stringify({timeStamp:2,dataParts:{owned:'newer local'},responseType:'owned/type',originalUnitId:'ORIGINAL'});localStorage.setItem(bucket,JSON.stringify(changed));
 });failUnit='A';const result=await page.evaluate(async()=>{
  const owner=new AbortController(),context=NativeBridge.nativeBackground(token,owner.signal);await context.ready;const retained=JSON.parse(localStorage.getItem(bucket));owner.abort();
  return retained.entries[0].payload;
 });assert.equal(JSON.parse(result).dataParts.owned,'newer local');
});
test('receipt notifications reconcile only accepted Units while failed entries remain in both stores',async t=>{
 const page=await pageFixture(t);failUnit='B';
 await page.evaluate(async()=>{
  const doc=documentFor([make('A','A'),make('B','B'),make('C','C')]);localStorage.setItem(bucket,JSON.stringify(doc));
  const owner=new AbortController(),context=NativeBridge.nativeBackground(token,owner.signal);window.owner=owner;window.bg=context;await context.ready;
  await sendWorker({action:'drain'});
 });
 await page.waitForFunction(()=>{const doc=JSON.parse(localStorage.getItem(bucket)||'null');return doc?.entries?.length===1&&doc.entries[0].unitAlias==='B';});
 const retained=await page.evaluate(async()=>({local:JSON.parse(localStorage.getItem(bucket)).entries.map(e=>e.unitAlias),stored:(await rt.readRecord(bucket)).document.entries.map(e=>e.unitAlias)}));assert.deepEqual(retained,{local:['B'],stored:['B']});
 failUnit=undefined;await page.evaluate(()=>sendWorker({action:'drain'}));await page.waitForFunction(()=>localStorage.getItem(bucket)===null);assert.equal((await page.evaluate(()=>rt.readRecord(bucket))).pending,0);
 assert.equal(ownRequests(page).filter(r=>r.method==='PUT'&&r.path.includes('/unit/A/')).length,1);assert.equal(ownRequests(page).filter(r=>r.method==='PUT'&&r.path.includes('/unit/C/')).length,1);
});
test('abort during initialization and late worker registration cannot reauthorize a retired grant',async t=>{
 const page=await pageFixture(t);const result=await page.evaluate(async()=>{
  let release;const posted=[];Object.defineProperty(navigator,'serviceWorker',{configurable:true,value:{controller:null,ready:new Promise(done=>{release=done;}),addEventListener(){},removeEventListener(){}}});
  const owner=new AbortController(),context=NativeBridge.nativeBackground(token,owner.signal);owner.abort();await context.ready.catch(()=>{});
  release({active:{postMessage:message=>posted.push(message.action)}});await new Promise(done=>setTimeout(done,0));
  return posted;
 });assert.deepEqual(result,['retire']);
});
