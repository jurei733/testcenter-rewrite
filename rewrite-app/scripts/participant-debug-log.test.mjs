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
const state=()=>({testRun:{tenantId:'owned',workspaceId:'owned',participantSessionId:'owned-session',testRunId:'owned-run'},executionMode:{saveResponses:true}});
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
const flush=async()=>{for(let index=0;index<12;index++)await Promise.resolve();};
function fixture({values=new Map(),respond=async()=>({ok:true,json:async()=>({savedCount:1})}),denied=false}={}){
 let selected=state(),time=0,identity=0,credential='owned-credential';const timers=[],calls=[],listeners=new Map();
 const storage={get length(){return values.size;},key:index=>[...values.keys()][index]??null,getItem:key=>values.get(key)??null,
  setItem:(key,value)=>{if(denied)throw Error('Denied');values.set(key,value);},removeItem:key=>values.delete(key)};
 const create=load(productionApiRoutes,resolveRoutePath,()=>credential);
 const options={readState:()=>selected,storage,window:{addEventListener:(name,fn)=>listeners.set(name,fn),removeEventListener:(name,fn)=>{if(listeners.get(name)===fn)listeners.delete(name);}},
  now:()=>1791676800123,id:()=>`owned-entry-${++identity}`,schedule:(callback,delay)=>{const timer={at:time+delay,callback,canceled:false};timers.push(timer);return()=>timer.canceled=true;},
  fetch:async(url,request)=>{calls.push({url,request});return respond(url,request,calls.length);}};
 const logger=create(options);
 const advance=async(next=time)=>{time=next;for(const timer of timers.slice())if(!timer.canceled&&timer.at<=time){timer.canceled=true;timer.callback();}await flush();};
 return {logger,options,create,values,storage,calls,listeners,advance,select:value=>{selected=value;logger.observeScope();},credential:value=>credential=value};
}
test('native debug logs bind captured arguments, timestamp and credential to the log-only endpoint',async()=>{
 const f=fixture(),args=['OFF','Exact Ä/β\n";'];try{f.logger.log(args);args[0]='untrusted';assert.equal(f.values.size,1);await f.advance();
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].url,'/api/v1/participant/test-runs/owned-run/test-logs');
  assert.equal(f.calls[0].request.headers.authorization,'Bearer owned-credential');assert.equal(f.calls[0].request.cache,'no-store');
  assert.deepEqual(JSON.parse(f.calls[0].request.body),{logs:[{unitKey:null,originalUnitId:null,entries:[{key:'command executed',timeStamp:1791676800123,content:'debug OFF Exact Ä/β\n";',clientEntryId:'owned-entry-1'}]}]});
  assert.equal(f.values.size,0);
 }finally{f.logger.stop();}
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
