import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import {Subject,BehaviorSubject,timer,lastValueFrom,of} from 'rxjs';
import {TestScheduler} from 'rxjs/testing';
import {filter,concatMap,ignoreElements,startWith,mergeMap,map,tap} from 'rxjs/operators';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/original-command-handler-lifetime.json',import.meta.url),'utf8'));
assert.equal(fixture.originalCommit,'ee2ab9ab64bd91209ef8534bbe6005838024e46d');
const code=ts.transpileModule(`export const load=(timer,filter,concatMap,ignoreElements,startWith,mergeMap,map,tap,lastValueFrom,of)=>{${fixture.interfaces}\n${Object.values(fixture.sources).map(value=>value.extracted).join('\n')}\nreturn {CommandService,TestControllerService,TestControllerComponent,subscribe:function(){return ${fixture.callback};}};};`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {load}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const original=load(timer,filter,concatMap,ignoreElements,startWith,mergeMap,map,tap,lastValueFrom,of);
for(const reversed of [false,true])test(`actual Original handlers overlap after ${reversed?'reversed':'normal'} successful ACK completion`,async()=>{
 const started=[],states=[],completed=[],acks=new Map(),scheduler=new TestScheduler(assert.deepEqual);
 let release;const held=new Promise(done=>{release=done;});const logical=reversed?['resume','pause']:['pause','resume'];
 const service=new original.TestControllerService();service.testId=42;service.currentUnitSequenceId=1;service.state$=new BehaviorSubject('RUNNING');
 service.state$.subscribe(state=>states.push(state));service.interruptTimer=()=>{};
 service.setUnitNavigationRequest=()=>{started.push(service.state$.getValue()==='PAUSED'?'pause':'resume');return started.length===1?held:Promise.resolve(true);};
 const root=new original.TestControllerComponent();root.tcs=service;root.bs={addTestLog:(_id,entries)=>completed.push(entries[0].content)};
 const receiver=new original.CommandService();receiver.tcs=service;receiver.executedCommandIds=[];receiver.commandReceived$=new Subject();receiver.command$=new Subject();
 receiver.http={patch:path=>{const id=Number(path.match(/command\/(\d+)\/executed$/)[1]),ack=new Subject();acks.set(id,ack);return ack;}};
 const subscription=receiver.command$.subscribe(original.subscribe.call(root));let receiving;
 try{
  scheduler.run(()=>{
   receiving=receiver.subscribeReceivedCommands();
   receiver.commandReceived$.next({id:1,keyword:'pause',arguments:[]});receiver.commandReceived$.next({id:2,keyword:'resume',arguments:[]});
   scheduler.schedule(()=>{const ack=acks.get(reversed?2:1);ack.next({});ack.complete();},1200);
   scheduler.schedule(()=>{const ack=acks.get(reversed?1:2);ack.next({});ack.complete();},1500);
  });
  await Promise.resolve();await Promise.resolve();assert.deepEqual(started,logical);assert.deepEqual(completed,[logical[1]]);
  assert.equal(states.at(-1),reversed?'PAUSED':'RUNNING');
  release(true);await Promise.resolve();await Promise.resolve();assert.deepEqual(completed,[logical[1],logical[0]]);
 }finally{release(true);receiving?.unsubscribe();subscription.unsubscribe();}
});

for(const args of [[],['0'],['id','missing']])test(`actual Original Goto enters RUNNING even when its arguments reject: ${JSON.stringify(args)}`,async()=>{
 const service=new original.TestControllerService();service.state$=new BehaviorSubject('PAUSED');service.unitAliasMap={};
 const root=new original.TestControllerComponent();root.tcs=service;
 await assert.rejects(async()=>root.handleCommand('goto',args));assert.equal(service.state$.getValue(),'RUNNING');
});
for(const keyword of ['pause','resume'])test(`actual Original ${keyword} completion does not overwrite a newer ERROR`,async()=>{
 let release;const held=new Promise(done=>{release=done;}),service=new original.TestControllerService();service.state$=new BehaviorSubject('RUNNING');service.currentUnitSequenceId=1;service.interruptTimer=()=>{};
 let calls=0;service.setUnitNavigationRequest=()=>++calls===1?held:Promise.resolve(false);
 const root=new original.TestControllerComponent();root.tcs=service;
 const navigation=root.handleCommand(keyword,[]);assert.equal(service.state$.getValue(),keyword==='pause'?'PAUSED':'RUNNING');
 service.errorOut();assert.equal(service.state$.getValue(),'ERROR');release(true);await navigation;assert.equal(service.state$.getValue(),'ERROR');
});

for(const [initial,later]of [['RUNNING','PAUSED'],['PAUSED','RUNNING'],['LOADING','PAUSED'],['ERROR','RUNNING']])test(`actual Original termination observes ${later} after held deactivation, rather than invocation ${initial}`,async()=>{
 const permission=new Subject(),events=[];let release;const flush=new Promise(done=>{release=done;});
 const service=new original.TestControllerService();service.testId=42;service.currentUnitSequenceId=1;service.state$=new BehaviorSubject(initial);service.interruptTimer=()=>{};service.setUnitNavigationRequest=()=>Promise.resolve(true);
 service.canDeactivateUnit=(url,force)=>{assert.equal(url,'/r/starter');assert.equal(force,true);return permission;};
 service.closeAllBuffers=()=>{events.push(['buffers',service.state$.getValue()]);return flush;};service.bs={lockTest:()=>{events.push(['lock',service.state$.getValue()]);return of(true);}};service.router={navigate:()=>{events.push(['navigate',service.state$.getValue()]);return Promise.resolve(true);}};
 const root=new original.TestControllerComponent();root.tcs=service;
 const pending=root.handleCommand('terminate',['lock']);assert.equal(service.state$.getValue(),initial);assert.deepEqual(events,[]);
 await service[later==='PAUSED'?'pause':'resume']();permission.next(true);permission.complete();await Promise.resolve();await Promise.resolve();
 const expected=later==='PAUSED'?'TERMINATED_PAUSED':'TERMINATED';assert.equal(service.state$.getValue(),expected);assert.deepEqual(events,[['buffers',expected]]);
 release();await pending;assert.deepEqual(events,[['buffers',expected],['lock',expected],['navigate',expected]]);
});
test('actual Original already-TERMINATED guard returns before deactivation, locks or navigation',async()=>{
 const service=new original.TestControllerService();service.state$=new BehaviorSubject('TERMINATED');service.canDeactivateUnit=()=>assert.fail('Already terminated entered deactivation');
 assert.equal(await service.terminateTest('source',true,true),true);
});
test('actual Original denied unforced termination retains the running controller',async()=>{
 const service=new original.TestControllerService();service.state$=new BehaviorSubject('RUNNING');service.canDeactivateUnit=()=>of(false);service.closeAllBuffers=()=>assert.fail('Denied deactivation flushed');
 assert.equal(await service.terminateTest('source',false,true),true);assert.equal(service.state$.getValue(),'RUNNING');
});

for(const [initial,later]of [['RUNNING','PAUSED'],['PAUSED','RUNNING']])test(`actual forced Original termination enters its terminal phase before held buffers, preserving later ${later}`,async()=>{
 const events=[];let release;const buffers=new Promise(done=>{release=done;});
 const service=new original.TestControllerService();service.testId=42;service.currentUnitSequenceId=1;service.currentUnit={parent:{locked:false}};service.state$=new BehaviorSubject(initial);
 service.interruptTimer=()=>events.push(['interrupt',service.state$.getValue()]);service.setUnitNavigationRequest=()=>Promise.resolve(true);
 service.closeAllBuffers=()=>{events.push(['buffers',service.state$.getValue()]);return buffers;};
 service.bs={lockTest:()=>{events.push(['lock',service.state$.getValue()]);return of(true);}};service.router={navigate:()=>{events.push(['navigate',service.state$.getValue()]);return Promise.resolve(true);}};
 const root=new original.TestControllerComponent();root.tcs=service;
 const pending=root.handleCommand('terminate',['lock']);await Promise.resolve();await Promise.resolve();
 const terminal=initial==='PAUSED'?'TERMINATED_PAUSED':'TERMINATED';assert.equal(service.state$.getValue(),terminal);assert.deepEqual(events,[['interrupt',initial],['buffers',terminal]]);
 await service[later==='PAUSED'?'pause':'resume']();assert.equal(service.state$.getValue(),later);
 release();await pending;assert.equal(service.state$.getValue(),later);assert.deepEqual(events.slice(-2),[['lock',later],['navigate',later]]);
});
