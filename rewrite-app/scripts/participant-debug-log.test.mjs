import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import {productionApiRoutes,resolveRoutePath} from '@testcenter-rewrite-app/contracts';
const source=readFileSync(new URL('../apps/web/src/app/participant-debug-log.ts',import.meta.url),'utf8'),ast=ts.createSourceFile('log.ts',source,ts.ScriptTarget.Latest,true);
const declaration=ast.statements.filter(ts.isVariableStatement).flatMap(statement=>[...statement.declarationList.declarations]).find(item=>item.name.getText(ast)==='createParticipantDebugLog');
const code=ts.transpileModule(`export const load=(productionApiRoutes,resolveRoutePath,readParticipantSessionCredential)=>(${declaration.initializer.getText(ast)});`,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {load}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const prefix='testcenter-rewrite:participant-debug-log:v1:';
const state=()=>({testRun:{tenantId:'owned',workspaceId:'owned',participantSessionId:'owned-session',testRunId:'owned-run',contentReleaseId:'owned-release',bookletKey:'owned-booklet'},executionMode:{saveResponses:true}});
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
const flush=async()=>{for(let index=0;index<12;index++)await Promise.resolve();};
function fixture({values=new Map(),respond=async()=>({ok:true,json:async()=>({savedCount:1})}),denied=false,controller=false,idPrefix='owned-entry'}={}){
 let selected=state(),time=0,identity=0,credential='owned-credential',status='LOADING',alreadyRecorded=false,ready=false;const timers=[],calls=[],listeners=new Map();
 const storage={get length(){return values.size;},key:index=>[...values.keys()][index]??null,getItem:key=>values.get(key)??null,
  setItem:(key,value)=>{if(denied)throw Error('Denied');values.set(key,value);},removeItem:key=>values.delete(key)};
 const create=load(productionApiRoutes,resolveRoutePath,()=>credential);
 const options={readState:()=>selected,readControllerState:controller?()=>selected?{testRun:selected.testRun,status,alreadyRecorded,ready}:null:undefined,storage,window:{addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name);}},
  now:()=>1791676800123,id:()=>`${idPrefix}-${++identity}`,schedule:(callback,delay)=>{const timer={at:time+delay,callback,canceled:false};timers.push(timer);return()=>timer.canceled=true;},
  fetch:async(url,request)=>{calls.push({url,request});return respond(url,request,calls.length);}};
 const logger=create(options);
 const advance=async(next=time)=>{time=next;await flush();for(const timer of timers.slice())if(!timer.canceled&&timer.at<=time){timer.canceled=true;timer.callback();}await flush();};
 return {logger,options,create,values,storage,calls,listeners,advance,select:value=>{selected=value;logger.observeScope();},status:(value,recorded=false)=>{status=value;alreadyRecorded=recorded;logger.observeScope();},ready:()=>{ready=true;logger.observeScope();},credential:value=>credential=value};
}
test('native debug logs bind captured arguments, timestamp and credential to the log-only endpoint',async()=>{
 const f=fixture(),args=['OFF','Exact Ä/β\n";'];try{f.logger.log(args);args[0]='untrusted';await flush();assert.equal(f.values.size,1);await f.advance();
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].url,'/api/v1/participant/test-runs/owned-run/test-logs');
  assert.equal(f.calls[0].request.headers.authorization,'Bearer owned-credential');assert.equal(f.calls[0].request.cache,'no-store');
  assert.deepEqual(JSON.parse(f.calls[0].request.body),{logs:[{unitKey:null,originalUnitId:null,entries:[{key:'command executed',timeStamp:1791676800123,content:'debug OFF Exact Ä/β\n";',clientEntryId:'owned-entry-1'}]}]});
  assert.equal(f.values.size,0);
 }finally{f.logger.stop();}
});

test('native Debug completion captures its timestamp only in the fulfilled-handler microtask', async () => {
 const f=fixture(),args=['off','Exact Ω'];let clock=10_000;f.options.now=()=>clock;
 try{
  f.logger.log(args);assert.equal(f.values.size,0);assert.equal(f.calls.length,0);
  args[1]='mutated';clock=20_000;await f.advance();
  const logged=JSON.parse(f.calls[0].request.body).logs[0].entries[0];
  assert.equal(logged.timeStamp,20_000);assert.equal(logged.content,'debug off Exact Ω');
 }finally{f.logger.stop();}
});

test('a same-turn selection change cannot relabel the original Debug completion', async () => {
 const f=fixture();let clock=10_000;f.options.now=()=>clock;
 try{
  f.logger.log(['off']);f.select({...state(),testRun:{...state().testRun,testRunId:'new-selected-run'}});
  clock=20_000;await f.advance();assert.equal(f.calls.length,0);
  const entry=JSON.parse([...f.values.values()][0]);assert.equal(entry.scope.testRunId,'owned-run');assert.equal(entry.timestamp,20_000);
  f.select(state());await f.advance();assert.equal(f.calls.length,1);assert.equal(f.calls[0].url,'/api/v1/participant/test-runs/owned-run/test-logs');
 }finally{f.logger.stop();}
});

test('stopping a Debug logger before its handler microtask settles cannot create a later entry', async () => {
 const f=fixture();f.logger.log([]);f.logger.stop();await flush();assert.equal(f.values.size,0);assert.equal(f.calls.length,0);
});
for(const failure of ['network','500','malformed'])test(`${failure} retries one exact entry after one second; change detection cannot shorten the wait`,async()=>{
 const f=fixture({respond:async(_url,_request,attempt)=>{if(attempt>1)return {ok:true,json:async()=>({savedCount:1})};if(failure==='network')throw Error('Offline');if(failure==='500')return {ok:false,status:503};return {ok:true,json:async()=>({savedCount:-1})};}});
 try{f.logger.log([]);await f.advance();assert.equal(f.calls.length,1);assert.equal(f.values.size,1);
  for(let index=0;index<20;index++)f.logger.observeScope();await f.advance(999);assert.equal(f.calls.length,1);
  await f.advance(1000);assert.equal(f.calls.length,2);assert.equal(f.calls[1].request.body,f.calls[0].request.body);assert.equal(f.values.size,0);
 }finally{f.logger.stop();}
});
test('queued console logs survive reload with the same entry identity and never use the answer outbox',async()=>{
 const first=fixture({respond:async()=>{throw Error('Offline');}});first.logger.log(['on']);await first.advance();const values=first.values;first.logger.stop();
 const second=fixture({values});try{second.logger.observeScope();await second.advance();assert.equal(second.calls[0].request.body,first.calls[0].request.body);assert.equal(values.size,0);}finally{second.logger.stop();}
});
test('a late old-Run response cannot remove its pending entry or interfere with a new selected Run',async()=>{
 const held=deferred(),f=fixture({respond:async(_url,_request,attempt)=>({ok:true,json:()=>attempt===1?held.promise:Promise.resolve({savedCount:1})})});
 try{f.logger.log(['on']);await f.advance();assert.equal(f.calls.length,1);
  f.select({...state(),testRun:{...state().testRun,testRunId:'next-run'}});assert.equal(f.calls[0].request.signal.aborted,true);
  f.logger.log(['off']);await f.advance();assert.equal(f.calls.length,2);assert.match(f.calls[1].url,/next-run/);
  held.resolve({savedCount:1});await flush();assert.equal(f.values.size,1);assert.ok(f.values.has(prefix+'owned-entry-1'));
  f.select(state());await f.advance();assert.equal(f.calls.length,3);assert.equal(f.calls[2].request.body,f.calls[0].request.body);assert.equal(f.values.size,0);
 }finally{f.logger.stop();}
});
for(const mode of ['non-saving','no-controller','signed-out'])test(`${mode} sends no console log to the backend`,async()=>{
 const f=fixture();try{if(mode==='non-saving')f.select({...state(),executionMode:{saveResponses:false}});if(mode==='no-controller')f.select(null);if(mode==='signed-out')f.credential(null);
  f.logger.log([]);await f.advance();assert.equal(f.calls.length,0);
 }finally{f.logger.stop();}
});
for(const status of [401,404,409])test(`HTTP ${status} does not retry a permanently rejected console log`,async()=>{
 const f=fixture({respond:async()=>({ok:false,status})});try{f.logger.log([]);await f.advance();await f.advance(1000);assert.equal(f.calls.length,1);assert.equal(f.values.size,0);}finally{f.logger.stop();}
});
test('denied storage leaves a usable in-memory queue and cleanup cancels every owned listener/request',async()=>{
 const held=deferred(),f=fixture({denied:true,respond:async()=>held.promise});f.logger.log([]);await f.advance();assert.equal(f.calls.length,1);assert.equal(f.values.size,0);
 f.logger.stop();assert.equal(f.calls[0].request.signal.aborted,true);assert.equal(f.listeners.size,0);held.resolve({ok:true,json:async()=>({savedCount:1})});await flush();await f.advance(1000);assert.equal(f.calls.length,1);
});
test('malformed local data cannot prevent a valid own entry; other scopes and unrelated storage are retained',async()=>{
 const values=new Map([[prefix+'bad','malformed'],['unrelated','protected'],[prefix+'own',JSON.stringify({scope:state().testRun,id:'own',timestamp:1,args:[]})],
  [prefix+'foreign',JSON.stringify({scope:{...state().testRun,testRunId:'foreign-run'},id:'foreign',timestamp:1,args:['off']})]]);
 const f=fixture({values});try{f.logger.observeScope();await f.advance();assert.equal(f.calls.length,1);assert.equal(values.get('unrelated'),'protected');assert.ok(values.has(prefix+'foreign'));assert.ok(values.has(prefix+'bad'));assert.ok(!values.has(prefix+'own'));}finally{f.logger.stop();}
});

const controllerPrefix='testcenter-rewrite:participant-controller-log:v1:';
const packet=call=>JSON.parse(call.request.body).logs[0].entries[0];
const drain=async f=>{for(let index=0;index<12;index++)await f.advance();};
test('a saving authorized controller logs LOADING before a Unit exists and one real ready transition, with equal timestamps ordered by stable identity',async()=>{
 const f=fixture({controller:true});try{
  f.logger.observeScope();for(let index=0;index<20;index++)f.logger.observeScope();await drain(f);
  assert.deepEqual(f.calls.map(packet).map(entry=>entry.content),['LOADING']);
  f.status('RUNNING');await drain(f);f.status('RUNNING');await drain(f);
  assert.deepEqual(f.calls.map(packet),[
   {key:'CONTROLLER',timeStamp:1791676800123,content:'LOADING',clientEntryId:'controller-owned-entry-1-00000001'},
   {key:'CONTROLLER',timeStamp:1791676800123,content:'RUNNING',clientEntryId:'controller-owned-entry-1-00000002'}]);
  assert.ok(f.calls.every(call=>call.url==='/api/v1/participant/test-runs/owned-run/test-logs'&&JSON.parse(call.request.body).logs[0].unitKey===null));
  assert.equal(f.values.size,0);
 }finally{f.logger.stop();}
});
for(const ready of ['PAUSED','ERROR'])test(`initial ${ready} follows a captured LOADING without an answer or current Unit`,async()=>{
 const f=fixture({controller:true});try{f.status(ready);await drain(f);assert.deepEqual(f.calls.map(packet).map(entry=>entry.content),['LOADING',ready]);}finally{f.logger.stop();}
});
test('accepted native and durable Player statuses are observed without a second controller log; a later independent error is still saved',async()=>{
 const f=fixture({controller:true});try{f.logger.observeScope();await drain(f);f.status('RUNNING',true);f.status('PAUSED',true);f.status('TERMINATED_PAUSED',true);await drain(f);
  assert.deepEqual(f.calls.map(packet).map(entry=>entry.content),['LOADING']);
  f.status('ERROR');await drain(f);assert.deepEqual(f.calls.map(packet).map(entry=>entry.content),['LOADING','ERROR']);
 }finally{f.logger.stop();}
});
for(const failure of ['network','500','malformed'])test(`lifecycle ${failure} retries the exact LOADING before ready, with fresh credentials and no change-detection retry loop`,async()=>{
 const f=fixture({controller:true,respond:async(_url,_request,attempt)=>{
  if(attempt>1)return {ok:true,json:async()=>({savedCount:1})};if(failure==='network')throw Error('Offline');
  return failure==='500'?{ok:false,status:503}:{ok:true,json:async()=>({})};
 }});try{f.logger.observeScope();await f.advance();f.status('RUNNING');f.credential('fresh-credential');
  for(let index=0;index<20;index++)f.logger.observeScope();await f.advance(999);assert.equal(f.calls.length,1);
  await f.advance(1000);assert.equal(f.calls[1].request.body,f.calls[0].request.body);assert.equal(f.calls[1].request.headers.authorization,'Bearer fresh-credential');await drain(f);
  assert.deepEqual(f.calls.map(packet).map(entry=>entry.content),['LOADING','LOADING','RUNNING']);assert.equal(f.values.size,0);
 }finally{f.logger.stop();}
});
test('a pending lifecycle packet survives reload with its original timestamp and ID ahead of the next document lifecycle',async()=>{
 const first=fixture({controller:true,respond:async()=>{throw Error('Offline');}});first.logger.observeScope();await first.advance();first.logger.stop();
 const second=fixture({controller:true,values:first.values,idPrefix:'reload-entry'});try{second.status('RUNNING');await drain(second);
  assert.equal(second.calls[0].request.body,first.calls[0].request.body);assert.deepEqual(second.calls.map(packet).map(entry=>entry.content),['LOADING','LOADING','RUNNING']);
  assert.equal(second.values.size,0);assert.ok(!second.calls.some(call=>call.request.body.includes('credential')));
 }finally{second.logger.stop();}
});
for(const field of ['tenantId','workspaceId','participantSessionId','testRunId','contentReleaseId','bookletKey'])test(`a late ${field} lifecycle response cannot consume a former scope entry`,async()=>{
 const held=deferred(),f=fixture({controller:true,respond:async(_url,_request,attempt)=>({ok:true,json:()=>attempt===1?held.promise:Promise.resolve({savedCount:1})})});
 try{f.logger.observeScope();await f.advance();f.select({...state(),testRun:{...state().testRun,[field]:'replacement'}});await drain(f);
  assert.equal(f.calls[0].request.signal.aborted,true);held.resolve({savedCount:1});await flush();
  assert.ok(f.values.has(controllerPrefix+'controller-owned-entry-1-00000001'));
  f.select(state());await drain(f);assert.equal(f.calls[2].request.body,f.calls[0].request.body);assert.equal(f.values.size,0);
 }finally{f.logger.stop();}
});
test('malformed lifecycle scopes and unrelated storage remain untouched; non-saving and unauthenticated views send no lifecycle',async()=>{
 const values=new Map([['unrelated','protected'],[controllerPrefix+'foreign',JSON.stringify({scope:{...state().testRun,contentReleaseId:'foreign'},id:'foreign',timestamp:1,status:'LOADING'})],
  [controllerPrefix+'bad','malformed']]);
 const f=fixture({controller:true,values});try{f.select(null);await drain(f);assert.equal(f.calls.length,0);
  f.select({...state(),executionMode:{saveResponses:false}});await drain(f);assert.equal(f.calls.length,0);
  f.select(state());await drain(f);assert.equal(f.calls.length,1);assert.equal(values.get('unrelated'),'protected');assert.ok(values.has(controllerPrefix+'foreign'));assert.ok(values.has(controllerPrefix+'bad'));
 }finally{f.logger.stop();}
});
test('denied storage retains pre-Unit lifecycle in memory and stopping aborts its exact request and listener',async()=>{
 const held=deferred(),f=fixture({controller:true,denied:true,respond:async()=>held.promise});f.logger.observeScope();await f.advance();assert.equal(f.calls.length,1);assert.equal(f.values.size,0);
 f.logger.stop();assert.equal(f.calls[0].request.signal.aborted,true);assert.equal(f.listeners.size,0);held.resolve({ok:true,json:async()=>({savedCount:1})});await flush();await f.advance(1000);assert.equal(f.calls.length,1);
});

test('after the first full view, existing host and server paths own later statuses; a replacement entry starts a new initial lifecycle',async()=>{
 const f=fixture({controller:true});try{f.logger.observeScope();f.status('RUNNING');f.ready();await drain(f);
  f.status('PAUSED');f.status('RUNNING');f.status('ERROR');await drain(f);
  assert.deepEqual(f.calls.map(packet).map(entry=>entry.content),['LOADING','RUNNING']);
  f.select(null);f.select(state());await drain(f);assert.deepEqual(f.calls.map(packet).map(entry=>entry.content),['LOADING','RUNNING','LOADING','ERROR']);
 }finally{f.logger.stop();}
});
