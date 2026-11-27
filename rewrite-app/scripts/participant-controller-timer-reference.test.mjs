import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import {BehaviorSubject,Subject,interval,timer,lastValueFrom,firstValueFrom,of,Observable,concat,defer,EMPTY} from 'rxjs';
import {map,takeUntil,concatMap,expand,filter,ignoreElements,take,tap} from 'rxjs/operators';
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

function extractNativeMethods(file, className, names) {
 const url = new URL('../apps/web/src/app/native-participant/test-controller/' + file, import.meta.url);
 const source = ts.createSourceFile(file, readFileSync(url, 'utf8'), ts.ScriptTarget.Latest, true);
 const definition = source.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === className);
 const methods = definition.members.filter(member =>
  names.includes(ts.isConstructorDeclaration(member) ? 'constructor' : member.name?.getText(source)));
 assert.equal(methods.length, names.length);
 return methods.map(member => member.getText(source)).join('\n');
}

const nativeTimerSource = `
export const load = ({firstValueFrom, concat, defer, EMPTY, timer, createTicker, performance, AppError, sessionStorage,
  MaxTimerEvent, concatMap, expand, filter, ignoreElements, take, takeUntil, tap, UnitNavigationTarget, prepareNativePlayerHtml}) => {
 class TimerData {
  ${extractNativeMethods('classes/test-controller.classes.ts', 'TimerData', ['constructor', 'displayedSeconds'])}
 }
 class NativeTestController {
  ${extractNativeMethods('services/test-controller.service.ts', 'TestControllerService',
    ['startTimer', 'consumePausedTimerDisplay', 'restoreResumedTimerDisplay', 'readPausedTimerDisplays', 'writePausedTimerDisplays', 'takePausedTimerDisplay',
      'confirmTimerExpiry', 'finishTimer', 'interruptTimer', 'resume', 'pause'])}
 }
 class NativeUnitHost {
  ${extractNativeMethods('components/unithost/unithost.component.ts', 'UnithostComponent', ['runUnit'])}
 }
 return {NativeTestController, NativeUnitHost};
};`;
const nativeTimerOutput = ts.transpileModule(nativeTimerSource, {
 compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext},
}).outputText;
const nativeTimerModule = await import('data:text/javascript;base64,' + Buffer.from(nativeTimerOutput).toString('base64'));

async function nativeExpiryFixture(replies, {remainingMilliseconds=1000, savedDisplay, savedResumed, expiresAt, nextClock,
 prepareNativePlayerHtml = async html => html}={}) {
 const scheduler = new TestScheduler(assert.deepEqual);
 const startedAt = '2026-11-25T12:00:00.000Z';
 const clock = {
  testletKey: 'timed', status: 'running', remainingMilliseconds, startedAt,
  expiresAt: expiresAt??new Date(Date.parse(startedAt)+remainingMilliseconds).toISOString(),
 };
 const pausedTimerKey = 'owned-paused-timer';
 const resumedTimerKey = 'owned-resumed-timer';
 const savedTimers = new Map(savedDisplay ? [[pausedTimerKey, JSON.stringify(savedDisplay)]] : []);
 if(savedResumed)savedTimers.set(resumedTimerKey,JSON.stringify(savedResumed));
 const {NativeTestController, NativeUnitHost} = nativeTimerModule.load({
  firstValueFrom, concat, defer, EMPTY, timer: delay => timer(delay, scheduler),
  createTicker: () => interval(100, scheduler), performance: {now: () => scheduler.now()}, AppError: Error,
  MaxTimerEvent: {STARTED: 'STARTED', STEP: 'STEP', ENDED: 'ENDED', INTERRUPTED: 'INTERRUPTED'},
  concatMap, expand, filter, ignoreElements, take, takeUntil, tap,
  UnitNavigationTarget: {PAUSE:'pause'}, prepareNativePlayerHtml,
  sessionStorage: {getItem: key => savedTimers.get(key), setItem: (key, value) => savedTimers.set(key,value), removeItem: key => savedTimers.delete(key)},
 });
 const controller = new NativeTestController();
 const unit = {alias: 'owned-unit', sequenceId: 2, parent: {timerId: 'timed'}};
 const events = [], expirations = [], entries = [];
 Object.assign(controller, {
  nativeCurrent: true, currentUnit: unit, testMode: {forceTimeRestrictions: true}, pausedTimerKey,resumedTimerKey,
  currentTimerId: '', timerRefreshId: 0, timerIntervalSubscription: null, timers$: new Subject(), owned: subscribe => subscribe(), mds: {},
  bs: {timer: (_id, alias, action, _previousStartedAt, gotoCommandId, pausedDisplay) => {
   if (action === 'enter') {
    entries.push({alias, gotoCommandId, pausedDisplay});
    return of(entries.length===1 ? clock : {...clock, ...nextClock});
   }
   assert.equal(action, 'expire');
   const reply = replies[expirations.length];
   assert.ok(reply, 'unexpected extra expiry request');
   expirations.push(scheduler.now());
   return of({...clock, ...reply});
  }},
 });
 controller.timers$.subscribe(event => {
  if (event.type !== 'STEP') events.push([scheduler.now(), event.type]);
 });
 assert.equal(await controller.startTimer({id: 'timed'}, unit, false, () => true), true);
 const advance = frame => {scheduler.maxFrames = frame;scheduler.flush();};
 return {controller, NativeUnitHost, unit, clock, entries, expirations, events, advance, savedTimers, resumedTimerKey, pausedTimerKey};
}

test('a reloaded timer restores the display only for the same server clock', async () => {
 const matching = {testletKey:'timed', startedAt:'2026-11-25T12:00:00.000Z', displayedSeconds:2};
 const different = {...matching, startedAt:'2026-11-25T11:59:00.000Z', displayedSeconds:0};
 const replies = [{status:'expired', remainingMilliseconds:0}];
 for(const [savedDisplay, expectedDisplay] of [[matching,2],[different,3]]){
  const fixture = await nativeExpiryFixture(replies,{remainingMilliseconds:2460,savedDisplay});
  assert.equal(fixture.controller.visibleTimer.data.displayedSeconds,expectedDisplay);
  assert.equal(fixture.savedTimers.has(fixture.pausedTimerKey),false);
  fixture.advance(2460);
  assert.deepEqual(fixture.expirations,[2460]);
  assert.deepEqual(fixture.events,[[0,'STARTED'],[2460,'ENDED']]);
 }
});

test('resuming a clock leaves the other paused block displays available', async () => {
 const current = {testletKey:'timed', startedAt:'2026-11-25T12:00:00.000Z', displayedSeconds:2};
 const parked = {...current,testletKey:'other',displayedSeconds:15};
 const fixture = await nativeExpiryFixture([],{remainingMilliseconds:2460,savedDisplay:[current,parked]});
 assert.equal(fixture.controller.visibleTimer.data.displayedSeconds,2);
 assert.deepEqual(JSON.parse(fixture.savedTimers.get(fixture.pausedTimerKey)),parked);
 assert.equal(fixture.controller.consumePausedTimerDisplay(parked),15);
 assert.equal(fixture.savedTimers.has(fixture.pausedTimerKey),false);
});

test('a document reload retains a resumed display only while its timer identity and deadline match', async () => {
 const savedDisplay={testletKey:'timed',startedAt:'2026-11-25T12:00:00.000Z',displayedSeconds:65};
 const resumed=await nativeExpiryFixture([],{remainingMilliseconds:65840,savedDisplay});
 const savedResumed=JSON.parse(resumed.savedTimers.get(resumed.resumedTimerKey));
 assert.equal(resumed.controller.visibleTimer.data.displayedSeconds,65);
 assert.equal(resumed.savedTimers.has(resumed.pausedTimerKey),false);
 const cases=[
  {remainingMilliseconds:65106,expiresAt:savedResumed.expiresAt,expected:65},
  {remainingMilliseconds:63870,expiresAt:savedResumed.expiresAt,expected:64},
  {remainingMilliseconds:65106,expiresAt:'2026-11-25T12:02:00.000Z',expected:66}
 ];
 for(const {remainingMilliseconds,expiresAt,expected} of cases){
  const reloaded=await nativeExpiryFixture([{status:'expired',remainingMilliseconds:0}],{remainingMilliseconds,expiresAt,savedResumed});
  assert.equal(reloaded.controller.visibleTimer.data.displayedSeconds,expected);
  reloaded.advance(remainingMilliseconds);
  assert.deepEqual(reloaded.events,[[0,'STARTED'],[remainingMilliseconds,'ENDED']]);
 }
});

test('native countdown waits for the authoritative remaining milliseconds before advancing', async () => {
 const fixture = await nativeExpiryFixture([{remainingMilliseconds: 18}, {status:'expired',remainingMilliseconds:0}]);
 fixture.advance(1017);
 assert.deepEqual(fixture.expirations, [1000]);
 assert.deepEqual(fixture.events, [[0,'STARTED']]);
 fixture.advance(1018);
 assert.deepEqual(fixture.expirations, [1000,1018]);
 assert.deepEqual(fixture.events, [[0,'STARTED'],[1018,'ENDED']]);
 assert.equal(fixture.controller.currentTimerId, '');
});

test('interrupting the native countdown retires a pending expiry retry', async () => {
 const fixture = await nativeExpiryFixture([{remainingMilliseconds: 18}]);
 fixture.advance(1000);
 fixture.controller.interruptTimer();
 fixture.advance(1030);
 assert.deepEqual(fixture.expirations, [1000]);
 assert.deepEqual(fixture.events, [[0,'STARTED'],[1000,'INTERRUPTED']]);
});

test('a late expiry response for a replaced server deadline cannot advance the old clock', async () => {
 const fixture = await nativeExpiryFixture([{status:'expired',remainingMilliseconds:0,expiresAt:'2026-11-25T12:00:02.000Z'}]);
 fixture.advance(1030);
 assert.deepEqual(fixture.expirations, [1000]);
 assert.deepEqual(fixture.events, [[0,'STARTED']]);
 fixture.controller.interruptTimer();
});

test('native Resume requests timed Unit entry even when its old countdown is still active', async () => {
 const deadline = '2026-11-25T12:00:18.000Z';
 const f = await nativeExpiryFixture([{status:'expired', remainingMilliseconds:0, expiresAt:deadline}],
  {remainingMilliseconds:3000,nextClock:{expiresAt:deadline,remainingMilliseconds:2455,displayCeilingSeconds:2}});
 f.advance(500);
 const priorDisplay = f.controller.visibleTimer.data.displayedSeconds;
 const navigations = [];
 Object.assign(f.controller, {
  state$: new BehaviorSubject('RUNNING'),
  setUnitNavigationRequest: async (...args) => {navigations.push(args);return true;},
  testlets: {timed: {id:'timed'}}, getPlayer: () => 'owned player', updateNavigationState: () => {},
 });
 assert.equal(await f.controller.resume(),true);
 const [[target, force, entry]] = navigations;
 assert.equal(target,'2');
 assert.equal(force,true);
 assert.equal(entry.unitSequenceId,2);
 assert.equal(entry.refreshTimer(),true);
 const host = new f.NativeUnitHost();
 let ready = 0;
 Object.assign(host,{tcs:f.controller,mds:{http:{isCurrent:true}},refreshTimer:entry.refreshTimer,prepareIframe:()=>{ready++;}});
 f.unit.parent.locked = {by:'code'};
 await host.runUnit();
 assert.equal(f.entries.length,1);
 assert.equal(ready,0);
 f.unit.parent.locked = null;
 await host.runUnit();
 assert.equal(ready,1);
 assert.deepEqual(f.entries,[{alias:f.unit.alias,gotoCommandId:undefined,pausedDisplay:undefined},
  {alias:f.unit.alias,gotoCommandId:undefined,
   pausedDisplay:{startedAt:f.clock.startedAt,expiresAt:f.clock.expiresAt,displayedSeconds:priorDisplay}}]);
 assert.equal(f.controller.visibleTimer.data.displayedSeconds,2);
 await host.runUnit();
 assert.equal(f.entries.length,2);
 f.advance(3000);
 assert.deepEqual(f.expirations,[2955]);
 assert.deepEqual(f.events,[[0,'STARTED'],[500,'STARTED'],[2955,'ENDED']]);
});

test('re-entering a running timer with the same deadline retains the existing ticker', async () => {
 const f = await nativeExpiryFixture([{status:'expired',remainingMilliseconds:0}],
  {remainingMilliseconds:3000,nextClock:{remainingMilliseconds:2500}});
 f.advance(500);
 const ticker = f.controller.timerIntervalSubscription;
 assert.equal(await f.controller.startTimer({id:'timed'},f.unit,false,()=>true),true);
 assert.equal(f.controller.timerIntervalSubscription,ticker);
 assert.equal(f.entries.length,2);
 f.advance(3000);
 assert.deepEqual(f.expirations,[3000]);
 assert.deepEqual(f.events,[[0,'STARTED'],[3000,'ENDED']]);
});

for (const pending of ['timer reply', 'timer error', 'player preparation']) {
 test(`a newer Pause retires a pending Resume ${pending} before navigation completes`, async () => {
  let prepare, readyToPrepare, finishPause;
  const prepared = new Promise(resolve => {prepare = resolve;});
  const preparing = new Promise(resolve => {readyToPrepare = resolve;});
  const pausedNavigation = new Promise(resolve => {finishPause = resolve;});
  const f = await nativeExpiryFixture([], {remainingMilliseconds: 3000,
   prepareNativePlayerHtml: () => {readyToPrepare(); return prepared;}});
  const reply = new Subject();
  let resumeEntry;
  Object.assign(f.controller, {
   state$: new BehaviorSubject('RUNNING'),
   setUnitNavigationRequest: async (target, _force, entry) => {
    if (target === 'pause') return pausedNavigation;
    resumeEntry = entry;
    return true;
   },
   testlets: {timed: {id:'timed'}},
   getPlayer: () => 'owned player',
   updateNavigationState: () => {}
  });
  f.controller.bs.timer = () => reply;
  await f.controller.resume();
  const host = new f.NativeUnitHost();
  let mounted = 0;
  Object.assign(host, {tcs:f.controller, mds:{http:{isCurrent:true}}, refreshTimer:resumeEntry.refreshTimer,
   prepareIframe: () => {mounted++;}});
  const entering = host.runUnit();
  if (pending === 'player preparation') {
   reply.next(f.clock);
   await preparing;
  }
  const pausing = f.controller.pause();
  assert.equal(f.controller.state$.getValue(), 'PAUSED');
  assert.equal(f.controller.currentTimerId, '');
  if (pending === 'timer error') reply.error(Error('late owned timer error'));
  else if (pending === 'timer reply') reply.next({...f.clock, expiresAt:'2026-11-25T12:00:18.000Z'});
  prepare('owned player');
  await entering;
  assert.equal(f.controller.currentTimerId, '');
  assert.equal(f.controller.timerIntervalSubscription, null);
  assert.equal(host.mds.appError, undefined);
  assert.equal(mounted, 0);
  finishPause(true);
  await pausing;
 });
}
