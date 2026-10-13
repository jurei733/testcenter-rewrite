import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import {Subject,BehaviorSubject,timer} from 'rxjs';
import {TestScheduler} from 'rxjs/testing';
import {filter,concatMap,ignoreElements,startWith,mergeMap,map,tap} from 'rxjs/operators';

const fixture=JSON.parse(readFileSync(new URL('./fixtures/original-command-handler-lifetime.json',import.meta.url),'utf8'));
assert.equal(fixture.originalCommit,'ee2ab9ab64bd91209ef8534bbe6005838024e46d');
const code=ts.transpileModule(`export const load=(timer,filter,concatMap,ignoreElements,startWith,mergeMap,map,tap)=>{${fixture.interfaces}\n${Object.values(fixture.sources).map(value=>value.extracted).join('\n')}\nreturn {CommandService,TestControllerService,TestControllerComponent,subscribe:function(){return ${fixture.callback};}};};`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {load}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const original=load(timer,filter,concatMap,ignoreElements,startWith,mergeMap,map,tap);
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
