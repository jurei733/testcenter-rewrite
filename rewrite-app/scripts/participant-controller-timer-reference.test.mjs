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
${['interfaces','timer','ticker','service','controller','guard','unitHost'].map(key=>fixture.sources[key].extracted).join('\n')}
return {TestControllerService,TestControllerComponent,MaxTimerEvent,TimerData,UnitActivateGuard,UnithostComponent};};`;
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
 return {original,service,root,timerEvents,buffers,writes,navigation,locks,release,pastDeadline,
  cleanup:()=>{release();service.finishTimer();subscription.unsubscribe();}};
}
const settle=async()=>{for(let n=0;n<8;n++)await Promise.resolve();};

test('actual Original code-first Unit host waits for the code, then starts its timer in place',async()=>{
 const f=setup();try{
  f.service.interruptTimer();f.service.timers.timed=0;
  const parent={id:'timed',timerId:'timed',locked:null,children:[],locks:{show:false,time:false,code:true,afterLeave:false},restrictions:{codeToEnter:{code:'Owned'},timeMax:{minutes:5/60}}};
  const unit={sequenceId:1,localIndex:0,parent,lockedAfterLeaving:false,state:{PRESENTATION_PROGRESS:'complete',RESPONSE_PROGRESS:'complete'}};
  parent.children.push(unit);
  Object.assign(f.service,{booklet:{config:{},units:{id:'timed'}},currentUnit:unit,currentUnitSequenceId:1,units:{1:unit},testlets:{timed:parent},navigation$:new Subject()});
  f.service.updateAllLocks();let prepared=0;
  const host=new f.original.UnithostComponent();Object.assign(host,{tcs:f.service,prepareIframe:()=>{prepared++;}});
  host.runUnit();assert.equal(prepared,0);assert.equal(f.service.currentTimerId,'');
  host.onSubmitCode('wrong');assert.equal(prepared,0);assert.equal(parent.locks.code,true);assert.equal(f.service.currentTimerId,'');
  host.onSubmitCode('oWnEd');assert.equal(prepared,1);assert.equal(parent.locked,null);assert.equal(f.service.currentTimerId,'timed');assert.equal(f.service.timers.timed*60,5);assert.equal(f.service.currentUnitSequenceId,1);assert.deepEqual(f.navigation,[]);
 }finally{f.cleanup();}
});

test('actual Original Resume redirects a leave-locked current Unit to the next accessible code-entry Unit',async()=>{
 const f=setup();try{
  const parent={id:'intro',locked:null,locks:{show:false,time:false,code:false,afterLeave:false},restrictions:{}};
  const codeParent={id:'protected',locked:{by:'code'},locks:{show:false,time:false,code:true,afterLeave:false},restrictions:{codeToEnter:{code:'owned'}}};
  const unit=(sequenceId,parent,lockedAfterLeaving)=>({sequenceId,localIndex:0,parent,lockedAfterLeaving,state:{PRESENTATION_PROGRESS:'complete',RESPONSE_PROGRESS:'complete'}});
  const first=unit(1,parent,true),second=unit(2,codeParent,false);
  Object.assign(f.service,{currentUnit:first,currentUnitSequenceId:1,units:{1:first,2:second},navigation$:new Subject()});
  const guard=new f.original.UnitActivateGuard();Object.assign(guard,{tcs:f.service,router:{parseUrl:redirect=>({redirect})}});
  f.service.router={navigate:async([url])=>{
   assert.equal(url,'/t/42/u/1');assert.deepEqual(await guard.canActivate({params:{u:'1'}}),{redirect:'/t/42/u/2'});return true;
  }};
  assert.equal(await f.root.handleCommand('resume',[]),true);
 }finally{f.cleanup();}
});

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

for(const [balance,enforce] of [[0,true],[0,false],[2,true]])test(`actual Original Resume and Unit host start ${balance===0?'the full authored time':'the positive balance'} after Pause (enforced=${enforce})`,async()=>{
 const f=setup();try{
  const parent={id:'timed',timerId:'timed',locked:null,locks:{show:false,time:false,code:false,afterLeave:false},restrictions:{timeMax:{minutes:5/60}}};
  const unit={sequenceId:1,localIndex:0,parent,lockedAfterLeaving:false,state:{PRESENTATION_PROGRESS:'complete',RESPONSE_PROGRESS:'complete'}};
  Object.assign(f.service,{currentUnit:unit,currentUnitSequenceId:1,units:{1:unit},testlets:{timed:parent},navigation$:new Subject(),testMode:{forceTimeRestrictions:enforce,showCode:false}});
  // A real zero STEP is independently proven by the native-Worker browser gate.
  await f.root.handleTimer(new f.original.TimerData(balance/60,'timed','STEP'));
  const pause=f.root.handleCommand('pause',[]);assert.equal(f.service.timers.timed*60,balance);assert.equal(parent.locks.time,false);f.release();await pause;
  let prepared=0;const host=new f.original.UnithostComponent(),guard=new f.original.UnitActivateGuard();
  Object.assign(host,{tcs:f.service,prepareIframe:()=>{prepared++;}});Object.assign(guard,{tcs:f.service,router:{parseUrl:redirect=>({redirect})}});
  f.service.router={navigate:async([url])=>{assert.equal(url,'/t/42/u/1');assert.equal(await guard.canActivate({params:{u:'1'}}),true);host.runUnit();return true;}};
  assert.equal(await f.root.handleCommand('resume',[]),true);assert.equal(f.service.state$.getValue(),'RUNNING');assert.equal(prepared,1);
  assert.equal(f.service.timers.timed*60,balance||5);assert.equal(f.service.currentTimerId,'timed');assert.equal(f.timerEvents.at(-1).type,'STARTED');assert.equal(parent.locks.time,false);
 }finally{f.cleanup();}
});
