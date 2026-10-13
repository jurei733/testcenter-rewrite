import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,mkdtemp,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {build} from 'esbuild';
import {chromium} from 'playwright';

const fixture=JSON.parse(await readFile(new URL('./fixtures/original-controller-timer-lifetime.json',import.meta.url),'utf8'));
assert.equal(fixture.originalCommit,'ee2ab9ab64bd91209ef8534bbe6005838024e46d');
const sources=['interfaces','timer','ticker','service','controller'].map(key=>fixture.sources[key].extracted).join('\n');
const script=`import {BehaviorSubject,Subject,interval,timer,lastValueFrom,of,Observable} from 'rxjs';
import {map,takeUntil} from 'rxjs/operators';
${sources}
globalThis.originalTimer={TestControllerService,TestControllerComponent,BehaviorSubject,Subject};`;
const compiled=await build({stdin:{contents:script,resolveDir:process.cwd(),loader:'ts'},bundle:true,format:'iife',platform:'browser',write:false});
const bundle=compiled.outputFiles[0].text;
const artifacts=await mkdtemp(join(tmpdir(),'testcenter-original-timer-worker-'));
console.log('owned_artifacts='+artifacts);
const errors=[],checks=[];
const server=createServer((request,response)=>{
 response.setHeader('content-type',request.url==='/bundle.js'?'application/javascript':'text/html');
 response.end(request.url==='/bundle.js'?bundle:'<!doctype html><meta charset="utf-8"><script src="/bundle.js"></script>');
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser;
try{
 browser=await chromium.launch({headless:process.env.UI_SMOKE_HEADFUL!=='true'});
 for(const keyword of ['pause','terminate','terminate-error']){
  const page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.evaluate(()=>{
   const worker=globalThis.Worker,create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
   const lifecycle=[];
   globalThis.Worker=class extends worker{
    constructor(...args){super(...args);lifecycle.push('created');}
    postMessage(value,...args){lifecycle.push('message:'+value);return super.postMessage(value,...args);}
    terminate(){lifecycle.push('terminated');return super.terminate();}
   };
   URL.createObjectURL=value=>{lifecycle.push('url-created');return create(value);};
   URL.revokeObjectURL=value=>{lifecycle.push('url-revoked');return revoke(value);};
   const {TestControllerService,TestControllerComponent,BehaviorSubject,Subject}=globalThis.originalTimer;
   const service=new TestControllerService(),root=new TestControllerComponent(),events=[],writes=[],buffers=[],navigation=[];
   let release;const held=new Promise(done=>{release=done;});
   Object.assign(service,{testId:42,booklet:{config:{}},state$:new BehaviorSubject('RUNNING'),timers$:new Subject(),timers:{},currentTimerId:'',timerIntervalSubscription:null,
    currentUnit:{parent:{id:'timed',locked:false}},testMode:{forceTimeRestrictions:false},timerWarningPoints:[],shouldShowConfirmationUI:()=>false,
    addToTestStateBuffer:(key,value)=>writes.push([key,JSON.parse(value)]),closeAllBuffers:()=>{buffers.push(Date.now());return held;},router:{navigate:()=>{navigation.push(Date.now());return Promise.resolve(true);}}});
   root.tcs=service;
   const subscription=service.timers$.subscribe(event=>{events.push({type:event.type,seconds:event.timeLeftSeconds,time:Date.now()});void root.handleTimer(event);});
   globalThis.ownedTimer={service,root,events,writes,buffers,navigation,lifecycle,release,subscription};
   service.startTimer({id:'timed',restrictions:{timeMax:{minutes:0.1}}});
  });
  await page.waitForFunction(()=>globalThis.ownedTimer.events.some(e=>e.type==='STEP'&&e.seconds===3));
  const before=await page.evaluate(keyword=>{
   const f=globalThis.ownedTimer;if(keyword==='terminate-error')f.service.state$.next('ERROR');
   f.pending=f.root.handleCommand(keyword==='pause'?'pause':'terminate',[]);
   return {balance:f.service.timers.timed*60,workerEvents:[...f.lifecycle],bufferCalls:f.buffers.length,phase:f.service.state$.getValue()};
  },keyword);
  assert.equal(before.balance,3);
  if(keyword==='terminate-error')assert.equal(before.workerEvents.includes('terminated'),false);
  else assert.equal(before.workerEvents.includes('terminated'),true);
  await page.waitForFunction(()=>Date.now()>globalThis.ownedTimer.events[0].time+6500);
  const after=await page.evaluate(async()=>{
   const f=globalThis.ownedTimer;
   const held={balance:f.service.timers.timed*60,events:[...f.events],writes:[...f.writes],buffers:f.buffers.length,navigation:f.navigation.length,lifecycle:[...f.lifecycle],visibleTimer:f.root.timerValue??null};
   f.release();await f.pending;f.service.finishTimer();f.subscription.unsubscribe();
   return {held,navigation:f.navigation.length};
  });
  assert.equal(after.held.buffers,1);assert.equal(after.held.navigation,0);assert.equal(after.navigation,1);
  assert.equal(after.held.balance,keyword==='terminate-error'?0:3);assert.equal(after.held.visibleTimer,null);
  assert.equal(after.held.events.some(e=>e.type==='ENDED'),keyword==='terminate-error');
  assert.equal(after.held.events.some(e=>e.type==='INTERRUPTED'),keyword!=='terminate-error');
  assert.equal(after.held.lifecycle.filter(e=>e==='created').length,1);
  assert.equal(after.held.lifecycle.filter(e=>e==='terminated').length,1);
  assert.equal(after.held.lifecycle.filter(e=>e==='url-revoked').length,1);
  // The real Worker ticks immediately. Its zero STEP persists a zero balance
  // before the outer expiry timer emits ENDED and persists that balance again.
  assert.deepEqual(after.held.writes,keyword==='terminate-error'?[['TESTLETS_TIMELEFT',{timed:0.1}],['TESTLETS_TIMELEFT',{timed:0}],['TESTLETS_TIMELEFT',{timed:0}]]:[['TESTLETS_TIMELEFT',{timed:0.1}]]);
  checks.push({keyword,before,after});console.log('original_controller_timer_worker='+keyword+':passed');
  await page.close();
 }
 assert.deepEqual(errors,[]);
 await writeFile(join(artifacts,'worker-reference.json'),JSON.stringify({originalCommit:fixture.originalCommit,fixtureSha256:createHash('sha256').update(JSON.stringify(fixture)).digest('hex'),checks,errors},null,2)+'\n');
}finally{
 await browser?.close();await new Promise(done=>server.close(done));console.log('owned_server=shutdown');
}
