import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import {BehaviorSubject,Subject,interval,timer,lastValueFrom,of,Observable} from 'rxjs';
import {map,takeUntil} from 'rxjs/operators';
import {TestScheduler} from 'rxjs/testing';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/original-controller-timer-lifetime.json',import.meta.url),'utf8'));
assert.equal(fixture.originalCommit,'ee2ab9ab64bd91209ef8534bbe6005838024e46d');
const source=`export const load=(interval,timer,lastValueFrom,of,Observable,map,takeUntil,Worker)=>{
${['interfaces','timer','ticker','service','controller'].map(key=>fixture.sources[key].extracted).join('\n')}
return {TestControllerService,TestControllerComponent,MaxTimerEvent};};`;
const emitted=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {load}=await import('data:text/javascript;base64,'+Buffer.from(emitted).toString('base64'));

function setup({state='RUNNING',unit=true,locked=false}={}){
 const scheduler=new TestScheduler(assert.deepEqual);
 const original=load(period=>interval(period,scheduler),due=>timer(due,scheduler),lastValueFrom,of,Observable,map,takeUntil,undefined);
 const service=new original.TestControllerService(),root=new original.TestControllerComponent();
 const timerEvents=[],buffers=[],writes=[],navigation=[],locks=[];
 let release;
 const waiting=new Promise(done=>{release=done;});
 Object.assign(service,{testId:42,booklet:{config:{}},state$:new BehaviorSubject(state),timers$:new Subject(),timers:{},timerIntervalSubscription:null,currentTimerId:'',
  currentUnit:unit?{parent:{id:'timed',locked}}:null,
  testMode:{forceTimeRestrictions:false},timerWarningPoints:[],shouldShowConfirmationUI:()=>false,
  addToTestStateBuffer:(key,value)=>writes.push([key,JSON.parse(value)]),
  closeAllBuffers:(...args)=>{buffers.push(args);return waiting;},
  router:{navigate:(...args)=>{navigation.push(args);return Promise.resolve(true);}},
  bs:{lockTest:(...args)=>{locks.push(args);return of(true);}}
 });
 root.tcs=service;
 const subscription=service.timers$.subscribe(event=>{
  timerEvents.push({type:event.type,seconds:event.timeLeftSeconds});void root.handleTimer(event);
 });
 service.startTimer({id:'timed',restrictions:{timeMax:{minutes:5/60}}});
 scheduler.maxFrames=2500;scheduler.flush();
 assert.equal(service.timers.timed*60,3);
 assert.equal(service.currentTimerId,'timed');
 const pastDeadline=()=>{scheduler.maxFrames=10000;scheduler.flush();};
 return {service,root,timerEvents,buffers,writes,navigation,locks,release,pastDeadline,
  cleanup:()=>{release();service.finishTimer();subscription.unsubscribe();}};
}
const settle=async()=>{for(let n=0;n<8;n++)await Promise.resolve();};

test('actual Original Pause interrupts immediately and retains time while its buffers wait beyond expiry',async()=>{
 const f=setup();try{
  const pending=f.root.handleCommand('pause',[]);
  assert.equal(f.service.currentTimerId,'');assert.equal(f.service.timerIntervalSubscription,null);
  assert.equal(f.service.state$.getValue(),'PAUSED');assert.equal(f.root.timerValue,null);
  assert.deepEqual(f.timerEvents.map(e=>e.type),['STARTED','STEP','STEP','INTERRUPTED']);
  assert.equal(f.buffers.length,1);f.pastDeadline();
  assert.equal(f.service.timers.timed*60,3);assert.deepEqual(f.navigation,[]);
  assert.deepEqual(f.timerEvents.map(e=>e.type),['STARTED','STEP','STEP','INTERRUPTED']);
  assert.deepEqual(f.writes,[['TESTLETS_TIMELEFT',{timed:5/60}]]);
  f.release();await pending;assert.equal(f.navigation.length,1);
  assert.equal(f.service.timers.timed*60,3);
 }finally{f.cleanup();}
});

for(const state of ['RUNNING','PAUSED'])test(`actual Original forced termination from ${state} stops the timer before its continuation and answer buffers`,async()=>{
 const f=setup({state});try{
  const pending=f.root.handleCommand('terminate',['lock']);
  assert.equal(f.service.state$.getValue(),state);
  assert.equal(f.service.currentTimerId,'');assert.equal(f.service.timerIntervalSubscription,null);
  assert.equal(f.root.timerValue,null);assert.equal(f.buffers.length,0);
  await settle();assert.equal(f.buffers.length,1);
  assert.equal(f.service.state$.getValue(),state==='PAUSED'?'TERMINATED_PAUSED':'TERMINATED');
  f.pastDeadline();assert.equal(f.service.timers.timed*60,3);
  assert.deepEqual(f.timerEvents.map(e=>e.type),['STARTED','STEP','STEP','INTERRUPTED']);
  assert.deepEqual(f.writes,[['TESTLETS_TIMELEFT',{timed:5/60}]]);
  assert.deepEqual(f.locks,[]);assert.deepEqual(f.navigation,[]);
  f.release();await pending;assert.equal(f.locks.length,1);assert.equal(f.navigation.length,1);
  assert.equal(f.service.timers.timed*60,3);
 }finally{f.cleanup();}
});

for(const [name,options] of [['ERROR',{state:'ERROR'}],['missing current Unit',{unit:false}],['locked immediate parent',{locked:true}]])
test(`actual Original forced termination bypasses interruption for ${name}, retaining the running timer through buffers`,async()=>{
 const f=setup(options);try{
  const pending=f.root.handleCommand('terminate',[]);
  assert.equal(f.service.currentTimerId,'timed');await settle();assert.equal(f.buffers.length,1);
  assert.equal(f.service.state$.getValue(),'TERMINATED');
  f.pastDeadline();assert.equal(f.service.timers.timed,0);
  assert.deepEqual(f.timerEvents.map(e=>e.type),['STARTED','STEP','STEP','STEP','STEP','ENDED']);
  assert.deepEqual(f.writes,[['TESTLETS_TIMELEFT',{timed:5/60}],['TESTLETS_TIMELEFT',{timed:0}]]);
  assert.deepEqual(f.navigation,[]);f.release();await pending;assert.equal(f.navigation.length,1);
 }finally{f.cleanup();}
});

test('actual Original exact TERMINATED early return leaves an existing timer and buffers untouched',async()=>{
 const f=setup({state:'TERMINATED'});try{
  assert.equal(await f.root.handleCommand('terminate',['lock']),true);
  assert.equal(f.service.currentTimerId,'timed');assert.deepEqual(f.buffers,[]);assert.deepEqual(f.locks,[]);assert.deepEqual(f.navigation,[]);
  f.pastDeadline();assert.equal(f.service.timers.timed,0);assert.equal(f.timerEvents.at(-1).type,'ENDED');
 }finally{f.cleanup();}
});
