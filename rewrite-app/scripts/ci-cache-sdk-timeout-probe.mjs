import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {runInNewContext} from 'node:vm';
import {spawn} from 'node:child_process';
import {fileURLToPath} from 'node:url';

// Inspect the actual MIT-licensed distribution already used by pinned
// actions/setup-node. No dependency or application timer is replaced.
const pinnedSha256='61462d80fd9850ceb0fd072b80777ce297f537fb2ec2d7c8d87983e80ce7e4fa';
function fragment(source,startMarker,endMarker){
 const start=source.indexOf(startMarker);assert.ok(start>=0);assert.equal(source.indexOf(startMarker,start+startMarker.length),-1);
 const end=source.indexOf(endMarker,start);assert.ok(end>start);return source.slice(start,end+endMarker.length);
}
async function sourceFrom(path){
 const bytes=await readFile(path);assert.equal(createHash('sha256').update(bytes).digest('hex'),pinnedSha256,'Only the actual pinned setup-node bundle can qualify SDK behavior.');
 const source=bytes.toString('utf8');
 return [fragment(source,'var downloadUtils_awaiter =','\n};'),
  fragment(source,'function getDownloadOptions(copy) {','\n}'),
  fragment(source,'const promiseWithTimeout = (timeoutMs, promise) =>','\n});'),
  'globalThis.ownedSdk={getDownloadOptions,promiseWithTimeout};'].join('\n');
}
function sdk(source,environment,timers){
 const context={process:{env:environment},core_debug:()=>{},...timers};
 runInNewContext(source,context,{timeout:1000});return context.ownedSdk;
}
function fakeTimers(){
 let serial=0;const pending=new Map();return{pending,
  setTimeout(callback,milliseconds){const id=++serial;pending.set(id,{callback,milliseconds});return id;},
  clearTimeout(id){pending.delete(id);}};
}
async function deterministic(source){
 const normalTimers=fakeTimers(),normal=sdk(source,{},normalTimers),defaults=normal.getDownloadOptions();
 assert.equal(defaults.segmentTimeoutInMs,600000);assert.equal(defaults.timeoutInMs,30000);
 const boundedTimers=fakeTimers(),bounded=sdk(source,{SEGMENT_DOWNLOAD_TIMEOUT_MINS:'1'},boundedTimers),options=bounded.getDownloadOptions();
 assert.deepEqual(JSON.parse(JSON.stringify(options)),{...JSON.parse(JSON.stringify(defaults)),segmentTimeoutInMs:60000});
 for(const[implementation,timers,bound]of[[normal,normalTimers,600000],[bounded,boundedTimers,60000]]){
  await assert.rejects(implementation.promiseWithTimeout(bound,Promise.reject(Error('owned-cache-download-rejection'))),/owned-cache-download-rejection/);
  assert.equal(timers.pending.size,1,'The actual rejected SDK path retains its segment timer; do not relabel it as cleared.');
  assert.equal([...timers.pending.values()][0].milliseconds,bound);timers.pending.clear();
  assert.equal(await implementation.promiseWithTimeout(bound,Promise.resolve('owned-cache-bytes')),'owned-cache-bytes');
  assert.equal(timers.pending.size,0,'Successful cache data must clear its timer.');
  const held=implementation.promiseWithTimeout(bound,new Promise(()=>{}));assert.equal(timers.pending.size,1);
  [...timers.pending.values()][0].callback();assert.equal(await held,'timeout');assert.equal(timers.pending.size,0);
 }
 return{actualPinnedSdk:true,setupNodeCommit:'949feb2413d6458794dcd2491c4babbbce0c15c1',cacheLibrary:'6.3.0',sourceSha256:pinnedSha256,
  defaultSegmentMs:600000,configuredSegmentMs:60000,requestMsUnchanged:30000,rejectedDownloadTimerRetained:true,successfulDownloadTimerCleared:true,pendingDownloadTimesOut:true};
}
async function child(source,mode){
 const implementation=sdk(source,{SEGMENT_DOWNLOAD_TIMEOUT_MINS:'1'},{setTimeout,clearTimeout}),bound=implementation.getDownloadOptions().segmentTimeoutInMs;
 assert.equal(bound,60000);let outcome;
 if(mode==='reject'){
  await assert.rejects(implementation.promiseWithTimeout(bound,Promise.reject(Error('owned-cache-download-rejection'))),/owned-cache-download-rejection/);outcome='owned-cache-miss';
 }else if(mode==='pending'){
  assert.equal(await implementation.promiseWithTimeout(bound,new Promise(()=>{})),'timeout');outcome='owned-cache-segment-timeout';
 }else{assert.equal(mode,'resolve');assert.equal(await implementation.promiseWithTimeout(bound,Promise.resolve('owned-cache-bytes')),'owned-cache-bytes');outcome='owned-cache-hit';}
 console.log(JSON.stringify({case:mode,bound,outcome}));
}
async function realCase(path,mode){
 const started=performance.now();return new Promise((resolve,reject)=>{
  const processChild=spawn(process.execPath,[fileURLToPath(import.meta.url),path,'--child='+mode],{stdio:['ignore','pipe','pipe']});let output='',error='';
  processChild.stdout.on('data',data=>{output+=data;});processChild.stderr.on('data',data=>{error+=data;});
  const timer=setTimeout(()=>processChild.kill('SIGKILL'),75000);
  processChild.once('error',failure=>{clearTimeout(timer);reject(failure);});
  processChild.once('close',(status,signal)=>{clearTimeout(timer);try{
   assert.equal(status,0,error.slice(0,1000));assert.equal(signal,null);const elapsedMs=Math.round(performance.now()-started);
   const receipt=JSON.parse(output);assert.equal(receipt.case,mode);assert.equal(receipt.bound,60000);
   if(mode==='resolve')assert.ok(elapsedMs<10000);else assert.ok(elapsedMs>=59000&&elapsedMs<75000);
   resolve({...receipt,elapsedMs,realProcessExitVerified:true});
  }catch(failure){reject(failure);}});
 });
}
const[path,option]=process.argv.slice(2);assert.ok(path);assert.ok(option===undefined||option==='--real-timers'||/^--child=(reject|pending|resolve)$/.test(option));
const source=await sourceFrom(path);
if(option?.startsWith('--child='))await child(source,option.slice(8));
else{
 const receipt=await deterministic(source);
 if(option==='--real-timers')receipt.realCases=await Promise.all(['reject','pending','resolve'].map(mode=>realCase(path,mode)));
 console.log(JSON.stringify(receipt));
}
