import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import {resolveRoutePath} from '@testcenter-rewrite-app/contracts';
import {participantNativeCommandRoute,participantNativeCommandKeywords} from '@testcenter-rewrite-app/contracts/participant-native-command';
const source=readFileSync(new URL('../apps/web/src/app/participant-native-command.ts',import.meta.url),'utf8');
const ast=ts.createSourceFile('native.ts',source,ts.ScriptTarget.Latest,true);
const statements=ast.statements.filter(node=>!ts.isImportDeclaration(node)).map(node=>node.getText(ast).replace(/^export /,''));
const compiled=ts.transpileModule('export const load=(participantNativeCommandRoute,participantNativeCommandKeywords,resolveRoutePath,readParticipantSessionCredential)=>{'+statements.join('\n')+';return createParticipantNativeCommands;};',
 {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {load}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const scope={tenantId:'owned',workspaceId:'workspace',participantSessionId:'participant',testRunId:'run',contentReleaseId:'release',bookletKey:'booklet'};
const deferred=()=>{let resolve;return {promise:new Promise(done=>resolve=done),get resolve(){return resolve;}};};
const flush=async()=>{for(let i=0;i<24;i++)await Promise.resolve();};
function fixture({values=new Map(),owner='owned-tab',respond,prepare}={}){
 let state={testRun:{...scope}},generation=0,credential='Owned credential',time=0,id=0;const calls=[],applied=[],failures=[],timers=[],listeners=new Map(),prepared=[];
 const storage={get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 const create=load(participantNativeCommandRoute,participantNativeCommandKeywords,resolveRoutePath,()=>credential);
 const receipt=body=>({application:{...body,scope:{...scope},applied:true,executedAt:'2026-10-12T00:00:00.000Z',testRun:{...scope},participantSession:{tenantId:scope.tenantId,workspaceId:scope.workspaceId,participantSessionId:scope.participantSessionId}}});
 const options={ownerId:owner,readState:()=>state,controllerStatus:()=> 'RUNNING',generation:()=>generation,
  prepare:async current=>{prepared.push(current);if(prepare)await prepare(current);},applied:async(value,current)=>{if(current())applied.push(value);},failed:error=>failures.push(error.message),storage,
  window:{addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:(k,v)=>{if(listeners.get(k)===v)listeners.delete(k);}},
  now:()=>1791763200123,id:()=>`owned-${++id}`,schedule:(callback,delay)=>{const timer={at:time+delay,callback,canceled:false};timers.push(timer);return()=>timer.canceled=true;},
  fetch:async(url,request)=>{calls.push({url,request});const body=JSON.parse(request.body);return respond?respond(body,calls.length,receipt):{ok:true,json:async()=>receipt(body)};}};
 const native=create(options);
 const advance=async(next=time)=>{time=next;for(const t of timers.slice())if(!t.canceled&&t.at<=time){t.canceled=true;t.callback();}await flush();};
 return {native,options,create,values,calls,applied,failures,prepared,listeners,advance,receipt,
  select:next=>{state=next;native.observeScope();},replace:()=>{generation++;native.observeScope();},credential:value=>credential=value};
}
test('native commands clone exact arguments, drain before dispatch and use only the owned participant endpoint',async()=>{
 const gate=deferred(),f=fixture({prepare:()=>gate.promise}),args=['id','Alias Ω','give 2'];try{
  f.native.command('goto',args);args[1]='mutated';await f.advance();assert.equal(f.calls.length,0);gate.resolve();await flush();
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].url,'/api/v1/participant/sessions/participant/native-commands');
  const request=f.calls[0].request;assert.equal(request.headers.authorization,'Bearer Owned credential');assert.equal(request.cache,'no-store');
  assert.deepEqual(JSON.parse(request.body),{testRunId:'run',contentReleaseId:'release',bookletKey:'booklet',deliveryId:'owned-1',keyword:'goto',arguments:['id','Alias Ω','give 2'],controllerStatus:'RUNNING',timeStamp:1791763200123});
  assert.equal(f.applied.length,1);assert.equal(f.values.size,0);
 }finally{f.native.stop();}
});
test('a lost response retries the identical prepared packet without repeating the answer drain',async()=>{
 const f=fixture({respond:async(body,count,receipt)=>{if(count===1)throw Error('lost response');return {ok:true,json:async()=>({...receipt(body),application:{...receipt(body).application,applied:false}})};}});try{
  f.native.command('pause',[]);await f.advance();assert.equal(f.calls.length,1);for(let i=0;i<12;i++)f.native.observeScope();await f.advance(999);assert.equal(f.calls.length,1);
  await f.advance(1000);assert.equal(f.calls.length,2);assert.equal(f.prepared.length,1);assert.equal(f.calls[0].request.body,f.calls[1].request.body);assert.equal(f.applied.length,1);assert.equal(f.values.size,0);
 }finally{f.native.stop();}
});
test('prepared intents survive reload in their own tab without storing or reusing credentials',async()=>{
 const f=fixture({respond:async()=>{throw Error('offline');}});f.native.command('resume',[]);await f.advance();assert.ok(![...f.values.values()].join().includes('Owned credential'));
 // Capture the document's persisted state before fixture cleanup. A real
 // document reload does not destroy the Angular route (covered in the browser gate).
 const persisted=new Map(f.values);f.native.stop();
 const next=fixture({values:persisted});try{await next.advance();assert.equal(next.calls.length,1);assert.equal(next.prepared.length,0);assert.equal(next.calls[0].request.body,f.calls[0].request.body);assert.equal(next.values.size,0);}finally{next.native.stop();}
});
test('another tab does not restore this tab\'s pending controller intent',async()=>{
 const f=fixture({respond:async()=>{throw Error('offline');}});f.native.command('terminate',['lock']);await f.advance();const persisted=new Map(f.values);f.native.stop();
 const other=fixture({values:persisted,owner:'other-tab'});try{await other.advance();assert.deepEqual(other.calls,[]);assert.equal(other.values.size,1);}finally{other.native.stop();}
});
test('controller replacement cancels same-Run intents and fences the late response',async()=>{
 const gate=deferred(),f=fixture({respond:async(body,_count,receipt)=>{await gate.promise;return {ok:true,json:async()=>receipt(body)};}});try{
  f.native.command('goto',['2']);await f.advance();f.replace();assert.equal(f.calls[0].request.signal.aborted,true);gate.resolve();await flush();await f.advance(1000);
  assert.deepEqual(f.applied,[]);assert.equal(f.calls.length,1);assert.equal(f.values.size,0);
 }finally{f.native.stop();}
});
test('route destruction cancels the pending journal without needing another scope observation',async()=>{
 const gate=deferred(),f=fixture({respond:async(body,_count,receipt)=>{await gate.promise;return {ok:true,json:async()=>receipt(body)};}});
 f.native.command('pause',[]);f.native.command('resume',[]);await f.advance();assert.equal(f.values.size,2);
 f.values.set('unrelated','protected');const foreign=JSON.parse(f.values.get('testcenter-rewrite:participant-native-command:v1:owned-1'));
 foreign.owner='another-tab';foreign.id='foreign';foreign.request.deliveryId='foreign';
 const foreignKey='testcenter-rewrite:participant-native-command:v1:foreign';f.values.set(foreignKey,JSON.stringify(foreign));
 f.native.stop();assert.equal(f.calls[0].request.signal.aborted,true);assert.equal(f.listeners.size,0);
 assert.deepEqual([...f.values.keys()].sort(),[foreignKey,'unrelated'].sort());
 gate.resolve();await flush();await f.advance(1000);assert.deepEqual(f.applied,[]);assert.equal(f.calls.length,1);
 const next=fixture({values:f.values});try{await next.advance();assert.deepEqual(next.calls,[]);}finally{next.native.stop();}
});
test('route destruction while draining trusted answers cannot dispatch the waiting intent',async()=>{
 const gate=deferred(),f=fixture({prepare:()=>gate.promise});f.native.command('goto',['2']);await f.advance();
 assert.equal(f.prepared.length,1);f.native.stop();gate.resolve();await flush();await f.advance(1000);
 assert.equal(f.values.size,0);assert.deepEqual(f.calls,[]);assert.deepEqual(f.applied,[]);
});
for(const field of Object.keys(scope))test(`a replaced ${field} cannot receive an old native intent`,async()=>{
 const gate=deferred(),f=fixture({respond:async(body,_count,receipt)=>{await gate.promise;return {ok:true,json:async()=>receipt(body)};}});try{
  f.native.command('pause',[]);await f.advance();f.select({testRun:{...scope,[field]:'foreign'}});gate.resolve();await flush();assert.deepEqual(f.applied,[]);assert.equal(f.values.size,0);
 }finally{f.native.stop();}
});
for(const changed of ['scope','keyword','arguments','controllerStatus','timeStamp','executedAt','testRun','participantSession'])test(`a forged ${changed} receipt cannot project an effect`,async()=>{
 const f=fixture({respond:async(body,_count,receipt)=>{const value=receipt(body);value.application[changed]=changed==='scope'||changed==='testRun'||changed==='participantSession'?{}:changed==='arguments'?['forged']:null;return {ok:true,json:async()=>value};}});try{
  f.native.command('pause',[]);await f.advance();assert.deepEqual(f.applied,[]);assert.equal(f.failures.length,1);assert.equal(f.values.size,0);
 }finally{f.native.stop();}
});
test('intents are ordered, permanent failures are surfaced and signed-out scopes send nothing',async()=>{
 const f=fixture({respond:async(body,count,receipt)=>count===1?{ok:false,status:400}:{ok:true,json:async()=>receipt(body)}});try{
  f.native.command('pause',[]);f.native.command('resume',[]);await f.advance();await f.advance();assert.deepEqual(f.calls.map(call=>JSON.parse(call.request.body).keyword),['pause','resume']);assert.equal(f.failures.length,1);assert.equal(f.applied.length,1);
  f.credential(null);f.native.command('pause',[]);await f.advance();assert.equal(f.calls.length,2);f.select(null);assert.equal(f.values.size,0);
 }finally{f.native.stop();}
});
