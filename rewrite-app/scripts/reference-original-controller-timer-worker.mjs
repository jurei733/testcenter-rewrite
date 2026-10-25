import {isSupervisedSmokeChild, reportSmokePhase} from './supervised-smoke.mjs';
import {superviseTimerSmoke} from './timer-smoke-supervision.mjs';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFile,mkdtemp,writeFile} from 'node:fs/promises';
import {createServer} from 'node:http';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {build} from 'esbuild';
import {chromium} from 'playwright';

if (!isSupervisedSmokeChild(import.meta.url)) {
  process.exitCode = await superviseTimerSmoke(import.meta.url, 'original-timer-reference');
} else {
reportSmokePhase('bootstrap-owned-original-timer-reference');
const fixture=JSON.parse(await readFile(new URL('./fixtures/original-controller-timer-lifetime.json',import.meta.url),'utf8'));
assert.equal(fixture.originalCommit,'ee2ab9ab64bd91209ef8534bbe6005838024e46d');
const sources=['interfaces','timer','ticker','service','controller','guard','unitHost'].map(key=>fixture.sources[key].extracted).join('\n');
const script=`import {BehaviorSubject,Subject,interval,timer,lastValueFrom,of,Observable} from 'rxjs';
import {map,takeUntil} from 'rxjs/operators';
${sources}
globalThis.originalTimer={TestControllerService,TestControllerComponent,UnitActivateGuard,UnithostComponent,BehaviorSubject,Subject};`;
const compiled=await build({stdin:{contents:script,resolveDir:process.cwd(),loader:'ts'},bundle:true,format:'iife',platform:'browser',write:false});
const bundle=compiled.outputFiles[0].text;
const artifactRoot=process.env.UI_SMOKE_CONTROLLER_TIMER_ARTIFACT_ROOT||tmpdir();
const artifacts=await mkdtemp(join(artifactRoot,'testcenter-original-timer-worker-'));
console.log('owned_artifacts='+artifacts);
const errors=[],checks=[];
const server=createServer((request,response)=>{
 response.setHeader('content-type',request.url==='/bundle.js'?'application/javascript':'text/html');
 response.end(request.url==='/bundle.js'?bundle:'<!doctype html><meta charset="utf-8"><script src="/bundle.js"></script>');
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));
let browser, activeKeyword = null;
const closePage = async (page, keyword) => {reportSmokePhase(`original:${keyword}:page-close`);await page.close();};
try{
 reportSmokePhase('original:chromium-launch');
 browser=await chromium.launch({headless:process.env.UI_SMOKE_HEADFUL!=='true'});
 for(const keyword of ['pause','terminate','terminate-error','zero-pause-enforced','zero-pause-preview','expired-enforced','expired-preview','goto-reentry','goto-zero-reentry']){
  activeKeyword=keyword;reportSmokePhase('original:'+keyword+':scenario');
  const page=await browser.newPage();page.on('pageerror',error=>errors.push(error.message));
  await page.goto('http://127.0.0.1:'+server.address().port);
  await page.evaluate(keyword=>{
   const worker=globalThis.Worker,create=URL.createObjectURL.bind(URL),revoke=URL.revokeObjectURL.bind(URL);
   const lifecycle=[];
   globalThis.Worker=class extends worker{
    constructor(...args){super(...args);lifecycle.push('created');}
    postMessage(value,...args){lifecycle.push('message:'+value);return super.postMessage(value,...args);}
    terminate(){lifecycle.push('terminated');return super.terminate();}
   };
   URL.createObjectURL=value=>{lifecycle.push('url-created');return create(value);};
   URL.revokeObjectURL=value=>{lifecycle.push('url-revoked');return revoke(value);};
   const {TestControllerService,TestControllerComponent,UnitActivateGuard,UnithostComponent,BehaviorSubject,Subject}=globalThis.originalTimer;
   const service=new TestControllerService(),root=new TestControllerComponent(),guard=new UnitActivateGuard(),host=new UnithostComponent(),events=[],writes=[],buffers=[],navigation=[],guardResults=[],handled=[];
   const locks=()=>({show:false,time:false,code:false,afterLeave:false});
   const timed={id:'timed',timerId:'timed',locked:null,locks:locks(),restrictions:{timeMax:{minutes:0.1}},children:[]},after={id:'after',timerId:'',locked:null,locks:locks(),children:[]};
   const first={sequenceId:1,alias:'timed-unit',localIndex:0,parent:timed,lockedAfterLeaving:false,state:{PRESENTATION_PROGRESS:'complete',RESPONSE_PROGRESS:'complete'}};
   const second={sequenceId:2,alias:'after-unit',localIndex:0,parent:after,lockedAfterLeaving:false,state:{PRESENTATION_PROGRESS:'complete',RESPONSE_PROGRESS:'complete'}};
   timed.children=[first];after.children=[second];
   const top={id:'root',locked:null,locks:locks(),children:[timed,after]};
   let resolveBuffers,preparedIframes=0;const held=new Promise(done=>{resolveBuffers=done;});
   const release=()=>resolveBuffers(service.getNavigationState(service.currentUnitSequenceId));
   Object.assign(service,{testId:42,booklet:{config:{},units:{id:'root'}},state$:new BehaviorSubject('RUNNING'),timers$:new Subject(),navigation$:new Subject(),timers:{},currentTimerId:'',timerIntervalSubscription:null,
    units:{1:first,2:second},unitAliasMap:{'timed-unit':1,'after-unit':2},testlets:{root:top,timed,after},currentUnit:first,currentUnitSequenceId:1,
    testMode:{forceTimeRestrictions:keyword.endsWith('-enforced')||keyword.startsWith('goto-'),showCode:false},timerWarningPoints:[],shouldShowConfirmationUI:()=>false,
    addToTestStateBuffer:(key,value)=>writes.push([key,JSON.parse(value)]),closeAllBuffers:()=>{buffers.push(Date.now());return held;},
    router:{navigate:async([url],options)=>{
     navigation.push({url,time:Date.now()});const match=url.match(/\/u\/(\d+)$/);if(!match)return true;
     if(keyword.startsWith('goto-'))await new Promise((done,fail)=>service.canDeactivateUnit(url,options?.state?.force).subscribe({next:done,error:fail}));
     const sequence=Number(match[1]),result=await guard.canActivate({params:{u:String(sequence)}});guardResults.push(result);
     if(result===true){service.currentUnit=service.units[sequence];service.currentUnitSequenceId=sequence;host.runUnit();}
     return result===true;
    }}});
   Object.assign(guard,{tcs:service,router:{parseUrl:url=>({redirect:url})},messageService:{showSnackbar(){}}});
   Object.assign(host,{tcs:service,prepareIframe:()=>{preparedIframes++;}});root.tcs=service;
   const value={service,root,guard,host,events,writes,buffers,navigation,guardResults,lifecycle,release,handled,get preparedIframes(){return preparedIframes;}};
   const subscription=service.timers$.subscribe(event=>{
    events.push({type:event.type,seconds:event.timeLeftSeconds,time:Date.now()});handled.push(root.handleTimer(event));
    if(keyword.startsWith('zero-pause-')&&event.type==='STEP'&&event.timeLeftSeconds===0&&!value.zeroPaused){value.zeroPaused=true;value.pending=root.handleCommand('pause',[]);}
   });
   Object.assign(value,{subscription});globalThis.ownedTimer=value;service.startTimer(timed);
  },keyword);
  if(keyword.startsWith('zero-pause-')||keyword.startsWith('expired-')){
   const zero=keyword.startsWith('zero-pause-');
   await page.waitForFunction(zero=>zero?globalThis.ownedTimer.zeroPaused:globalThis.ownedTimer.events.some(e=>e.type==='ENDED'),zero);
   const before=await page.evaluate(()=>{const f=globalThis.ownedTimer;return {balance:f.service.timers.timed*60,phase:f.service.state$.getValue(),locked:f.service.currentUnit.parent.locked?.by??null,timerId:f.service.currentTimerId,events:[...f.events]};});
   assert.equal(before.balance,0);assert.equal(before.timerId,'');
   if(keyword==='expired-enforced'){
    assert.equal(before.locked,'time');assert.equal(before.events.some(e=>e.type==='ENDED'),true);
    const route=await page.evaluate(()=>globalThis.ownedTimer.guard.canActivate({params:{u:'1'}}));assert.deepEqual(route,{redirect:'/t/42/u/2'});
    const after=await page.evaluate(async()=>{const f=globalThis.ownedTimer;f.host.runUnit();const blocked={balance:f.service.timers.timed*60,starts:f.events.filter(e=>e.type==='STARTED').length,preparedIframes:f.preparedIframes};f.release();await Promise.all(f.handled);f.service.finishTimer();f.subscription.unsubscribe();return blocked;});
    assert.deepEqual(after,{balance:0,starts:1,preparedIframes:0});checks.push({keyword,before,after});
   }else{
    assert.equal(before.locked,null);assert.equal(before.events.some(e=>e.type==='ENDED'),!zero);
    if(zero){assert.equal(before.phase,'PAUSED');await page.waitForFunction(()=>Date.now()>globalThis.ownedTimer.events[0].time+6500);}
    else await page.evaluate(()=>{const f=globalThis.ownedTimer;f.pending=f.root.handleCommand('pause',[]);});
    const held=await page.evaluate(()=>{const f=globalThis.ownedTimer;return {balance:f.service.timers.timed*60,events:[...f.events],navigation:f.navigation.length,locked:f.service.currentUnit.parent.locked?.by??null};});
    assert.equal(held.navigation,0);assert.equal(held.balance,0);assert.equal(held.locked,null);assert.equal(held.events.some(e=>e.type==='ENDED'),!zero);
    await page.evaluate(async()=>{const f=globalThis.ownedTimer;f.release();await f.pending;await f.root.handleCommand('resume',[]);});
    await page.waitForFunction(()=>globalThis.ownedTimer.events.filter(e=>e.type==='STARTED').length===2&&globalThis.ownedTimer.events.at(-1).type==='STEP');
    const after=await page.evaluate(()=>{const f=globalThis.ownedTimer;const restarted={balance:f.service.timers.timed*60,starts:f.events.filter(e=>e.type==='STARTED').map(e=>e.seconds),guardResults:[...f.guardResults],preparedIframes:f.preparedIframes,unit:f.service.currentUnitSequenceId};f.service.finishTimer();f.subscription.unsubscribe();return {...restarted,lifecycle:[...f.lifecycle]};});
    assert.deepEqual(after.starts,[6,6]);assert.equal(after.balance,5);assert.deepEqual(after.guardResults,[true]);assert.equal(after.preparedIframes,1);assert.equal(after.unit,1);
    assert.equal(after.lifecycle.filter(e=>e==='created').length,2);assert.equal(after.lifecycle.filter(e=>e==='terminated').length,2);assert.equal(after.lifecycle.filter(e=>e==='url-revoked').length,2);
    checks.push({keyword,before,held,after});
   }
   console.log('original_controller_timer_worker='+keyword+':passed');await closePage(page,keyword);continue;
  }
  await page.waitForFunction(keyword=>globalThis.ownedTimer.events.some(e=>e.type==='STEP'&&e.seconds===(keyword==='goto-zero-reentry'?0:3)),keyword);
  if(keyword.startsWith('goto-')){
   await page.evaluate(()=>globalThis.ownedTimer.root.handleCommand('goto',['id','timed-unit']));
   await page.waitForFunction(keyword=>globalThis.ownedTimer.events.filter(e=>e.type==='STARTED').length===2&&globalThis.ownedTimer.events.at(-1).type==='STEP'&&globalThis.ownedTimer.events.at(-1).seconds===(keyword==='goto-zero-reentry'?4:1),keyword);
   const before=await page.evaluate(()=>{const f=globalThis.ownedTimer;f.pending=f.root.handleCommand('pause',[]);return {starts:f.events.filter(e=>e.type==='STARTED').map(e=>e.seconds),balance:f.service.timers.timed*60};});
   const balance=keyword==='goto-zero-reentry'?4:1;assert.deepEqual(before.starts,[6,keyword==='goto-zero-reentry'?6:3]);assert.equal(before.balance,balance);
   await page.waitForFunction(()=>Date.now()>globalThis.ownedTimer.events[0].time+6500);
   const after=await page.evaluate(async()=>{const f=globalThis.ownedTimer;const held={balance:f.service.timers.timed*60,buffers:f.buffers.length,navigation:f.navigation.length,ended:f.events.some(e=>e.type==='ENDED'),lifecycle:[...f.lifecycle]};f.release();await f.pending;f.subscription.unsubscribe();return held;});
   assert.equal(after.balance,balance);assert.equal(after.buffers,1);assert.equal(after.navigation,1);assert.equal(after.ended,false);assert.equal(after.lifecycle.filter(e=>e==='created').length,2);assert.equal(after.lifecycle.filter(e=>e==='terminated').length,2);
   checks.push({keyword,before,after});console.log('original_controller_timer_worker='+keyword+':passed');await closePage(page,keyword);continue;
  }
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
  await closePage(page,keyword);
 }
 assert.deepEqual(errors,[]);
 await writeFile(join(artifacts,'worker-reference.json'),JSON.stringify({originalCommit:fixture.originalCommit,fixtureSha256:createHash('sha256').update(JSON.stringify(fixture)).digest('hex'),checks,errors},null,2)+'\n');
}catch(error){
 await writeFile(join(artifacts,'failure.json'),JSON.stringify({scenario:activeKeyword,error:{name:error.name,message:String(error.message).slice(0,4000)},completedCases:checks.map(row=>row.keyword)},null,2)+'\n');
 throw error;
}finally{
 reportSmokePhase('original:browser-close');await browser?.close();
 reportSmokePhase('original:server-close');await new Promise(done=>server.close(done));console.log('owned_server=shutdown');
}

}
