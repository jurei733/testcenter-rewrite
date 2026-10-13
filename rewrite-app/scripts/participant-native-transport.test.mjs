import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import test from 'node:test';
import ts from 'typescript';
import {resolveRoutePath} from '@testcenter-rewrite-app/contracts';
import {participantNativeCommandRoute,participantNativeCommandKeywords,isParticipantControllerDispatch,isParticipantControllerDispatches,participantControllerTimerInterruptionRoute,isParticipantControllerTimerInterruptionRequest} from '@testcenter-rewrite-app/contracts/participant-native-command';
const source=readFileSync(new URL('../apps/web/src/app/participant-native-command.ts',import.meta.url),'utf8');
const ast=ts.createSourceFile('native.ts',source,ts.ScriptTarget.Latest,true);
assert.equal(ast.parseDiagnostics.length,0,'The real native transport must parse before extracting it for execution.');
const statements=ast.statements.filter(node=>!ts.isImportDeclaration(node)).map(node=>node.getText(ast).replace(/^export /,''));
const compiled=ts.transpileModule('export const load=(participantNativeCommandRoute,participantNativeCommandKeywords,resolveRoutePath,readParticipantSessionCredential,isParticipantControllerDispatch,isParticipantControllerDispatches,participantControllerTimerInterruptionRoute,isParticipantControllerTimerInterruptionRequest)=>{'+statements.join('\n')+';return Object.assign(createParticipantNativeCommands,{next:nextParticipantControllerDispatch,received:receivedParticipantControllerDispatch});};',
 {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ESNext}}).outputText;
const {load}=await import('data:text/javascript;base64,'+Buffer.from(compiled).toString('base64'));
const scope={tenantId:'owned',workspaceId:'workspace',participantSessionId:'participant',testRunId:'run',contentReleaseId:'release',bookletKey:'booklet'};
const deferred=()=>{let resolve;return {promise:new Promise(done=>resolve=done),get resolve(){return resolve;}};};
const flush=async()=>{for(let i=0;i<24;i++)await Promise.resolve();};
function fixture({values=new Map(),owner='owned-tab',respond,prepare,browserWindow,controllerStatus=()=> 'RUNNING',started,captureTimer}={}){
 let state={testRun:{...scope}},generation=0,credential='Owned credential',time=0,id=0;const calls=[],applied=[],failures=[],timers=[],listeners=new Map(),prepared=[];
 const storage={get length(){return values.size;},key:i=>[...values.keys()][i]??null,getItem:k=>values.get(k)??null,setItem:(k,v)=>values.set(k,v),removeItem:k=>values.delete(k)};
 const create=load(participantNativeCommandRoute,participantNativeCommandKeywords,resolveRoutePath,()=>credential,isParticipantControllerDispatch,isParticipantControllerDispatches,participantControllerTimerInterruptionRoute,isParticipantControllerTimerInterruptionRequest);
 const receipt=body=>body.testletKey?{interruption:{...body,scope:{...scope},applied:true,acceptedAt:'2026-10-12T00:00:00.000Z'}}:({application:{...body,scope:{...scope},applied:true,executedAt:'2026-10-12T00:00:00.000Z',testRun:{...scope},participantSession:{tenantId:scope.tenantId,workspaceId:scope.workspaceId,participantSessionId:scope.participantSessionId}}});
 const options={...(owner===null?{}:{ownerId:owner}),readState:()=>state,controllerStatus,started,captureTimer,generation:()=>generation,
  prepare:async current=>{prepared.push(current);if(prepare)await prepare(current);},applied:async(value,current)=>{if(current())applied.push(value);},failed:error=>failures.push(error.message),storage,
  window:browserWindow??{addEventListener:(k,v)=>listeners.set(k,v),removeEventListener:(k,v)=>{if(listeners.get(k)===v)listeners.delete(k);}},
  now:()=>1791763200123,id:()=>`owned-${++id}`,schedule:(callback,delay)=>{const timer={at:time+delay,callback,canceled:false};timers.push(timer);return()=>timer.canceled=true;},
  fetch:async(url,request)=>{calls.push({url,request});const body=JSON.parse(request.body);return respond?respond(body,calls.length,receipt):{ok:true,json:async()=>receipt(body)};}};
 const native=create(options);
 const advance=async(next=time)=>{time=next;for(const t of timers.slice())if(!t.canceled&&t.at<=time){t.canceled=true;t.callback();}await flush();};
 return {native,options,create,values,calls,applied,failures,prepared,listeners,advance,receipt,
  select:next=>{state=next;native.observeScope();},replace:(observe=true)=>{generation++;if(observe)native.observeScope();},credential:value=>credential=value};
}
test('native commands clone exact arguments, drain before dispatch and use only the owned participant endpoint',async()=>{
 const gate=deferred(),f=fixture({prepare:()=>gate.promise}),args=['id','Alias Ω','give 2'];try{
  f.native.command('goto',args);args[1]='mutated';await f.advance();assert.equal(f.calls.length,0);gate.resolve();await flush();
  assert.equal(f.calls.length,1);assert.equal(f.calls[0].url,'/api/v1/participant/sessions/participant/native-commands');
  const request=f.calls[0].request;assert.equal(request.headers.authorization,'Bearer Owned credential');assert.equal(request.cache,'no-store');
  assert.deepEqual(JSON.parse(request.body),{testRunId:'run',contentReleaseId:'release',bookletKey:'booklet',deliveryId:'owned-1',keyword:'goto',arguments:['id','Alias Ω','give 2'],controllerStatus:'RUNNING',timeStamp:1791763200123,controllerDispatch:{controllerId:'owned-tab',sequence:1}});
  assert.equal(f.applied.length,1);assert.equal(f.values.size,0);
 }finally{f.native.stop();}
});
test('a LOADING observation survives answer drain, reload and exact retry without resampling RUNNING',async()=>{
 const values=new Map(),f=fixture({values,controllerStatus:()=> 'LOADING',respond:async()=>({ok:false,status:503})});
 f.native.command('resume',[]);await f.advance();
 const packet=f.calls[0].request.body;assert.equal(JSON.parse(packet).controllerStatus,'LOADING');
 // A document reload keeps its prepared journal; Angular route destruction
 // deliberately removes it, so simulate replacement by constructing the transport.
 const restored=fixture({values,controllerStatus:()=> 'RUNNING'});
 try{await restored.advance();assert.equal(restored.calls[0].request.body,packet);assert.equal(restored.applied.length,1);assert.equal(values.size,0);}
 finally{f.native.stop();restored.native.stop();}
});
test('a held native application does not block another intent, and route replacement aborts both',async()=>{
 const held=deferred(),f=fixture({respond:async(body,_count,receipt)=>{await held.promise;return {ok:true,json:async()=>receipt(body)};}});
 try {
  f.native.command('pause',[]);await f.advance();f.native.command('resume',[]);await f.advance();
  assert.deepEqual(f.calls.map(call=>JSON.parse(call.request.body).keyword),['pause','resume']);
  assert.equal(f.values.size,2);f.replace();assert.ok(f.calls.every(call=>call.request.signal.aborted));
  held.resolve();await flush();assert.deepEqual(f.applied,[]);assert.equal(f.values.size,0);
 }finally{held.resolve();f.native.stop();}
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
 gate.resolve();await flush();await f.advance(1000);assert.deepEqual(f.applied,[]);assert.equal(f.calls.length,2);
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

const ownerKey='testcenter-rewrite:participant-native-owner:v1',handoffKey='testcenter-rewrite:participant-native-reload:v1';
const documentFor=({session=new Map(),type='navigate',denied=false}={})=>{
 const events=new Map(),storage={getItem:key=>session.get(key)??null,setItem:(key,value)=>session.set(key,value),removeItem:key=>session.delete(key)};
 const window={get sessionStorage(){if(denied)throw Error('Denied storage');return storage;},performance:{getEntriesByType:()=>[{type}]},
  addEventListener:(name,callback)=>{if(!events.has(name))events.set(name,new Set());events.get(name).add(callback);},removeEventListener:(name,callback)=>events.get(name)?.delete(callback)};
 return {window,session,events,event:name=>{for(const callback of events.get(name)??[])callback();}};
};
test('a cloned live document cannot replay or cancel the original tab even after an early reload',async()=>{
 const first=documentFor(),f=fixture({owner:null,browserWindow:first.window,respond:async()=>{throw Error('Offline');}});
 try{f.native.command('pause',[]);await f.advance();const packet=[...f.values.values()][0];
  const clone=documentFor({session:new Map(first.session),type:'reload'}),other=fixture({values:f.values,owner:null,browserWindow:clone.window});
  try{assert.notEqual(clone.session.get(ownerKey),first.session.get(ownerKey));await other.advance();assert.deepEqual(other.calls,[]);other.native.stop();assert.deepEqual([...f.values.values()],[packet]);}
  finally{other.native.stop();}
 }finally{f.native.stop();}
});
test('a genuine document reload consumes the departing handoff and retries the identical packet',async()=>{
 const first=documentFor(),f=fixture({owner:null,browserWindow:first.window,respond:async()=>{throw Error('Offline');}});
 f.native.command('resume',[]);await f.advance();const persisted=new Map(f.values);first.event('pagehide');assert.equal(first.session.get(handoffKey),first.session.get(ownerKey));
 const reload=documentFor({session:new Map(first.session),type:'reload'});f.native.stop();const next=fixture({values:persisted,owner:null,browserWindow:reload.window});
 try{assert.equal(reload.session.get(ownerKey),first.session.get(ownerKey));assert.equal(reload.session.has(handoffKey),false);await next.advance();assert.equal(next.prepared.length,0);assert.equal(next.calls[0].request.body,f.calls[0].request.body);}
 finally{next.native.stop();}
});
for(const type of ['navigate','back_forward'])test(`${type} cannot consume another document's reload handoff`,()=>{
 const doc=documentFor({session:new Map([[ownerKey,'old-tab'],[handoffKey,'old-tab']]),type}),f=fixture({owner:null,browserWindow:doc.window});
 try{assert.notEqual(doc.session.get(ownerKey),'old-tab');assert.equal(doc.session.has(handoffKey),false);}finally{f.native.stop();}
});
test('route recreation keeps one document owner and cached-document reactivation revokes its handoff',()=>{
 const doc=documentFor(),f=fixture({owner:null,browserWindow:doc.window}),owner=doc.session.get(ownerKey);f.native.stop();
 const next=f.create({...f.options});try{assert.equal(doc.session.get(ownerKey),owner);assert.equal(doc.events.get('pagehide').size,1);assert.equal(doc.events.get('pageshow').size,1);
  doc.event('pagehide');assert.equal(doc.session.get(handoffKey),owner);doc.event('pageshow');assert.equal(doc.session.has(handoffKey),false);
 }finally{next.stop();}
});
test('denied session storage retains a usable document-local owner across route recreation',async()=>{
 const doc=documentFor({denied:true}),f=fixture({owner:null,browserWindow:doc.window});try{
  f.native.command('pause',[]);const owner=JSON.parse([...f.values.values()][0]).owner;await f.advance();assert.equal(f.calls.length,1);f.native.stop();
  const next=f.create({...f.options});try{next.command('resume',[]);assert.equal(JSON.parse([...f.values.values()][0]).owner,owner);doc.event('pagehide');doc.event('pageshow');}
  finally{next.stop();}
 }finally{f.native.stop();}
});
test('a legacy owner without a departing handoff is not authority to restore its journal',async()=>{
 const legacy=fixture({respond:async()=>{throw Error('Offline');}});legacy.native.command('terminate',['lock']);await legacy.advance();const persisted=new Map(legacy.values);legacy.native.stop();
 const doc=documentFor({session:new Map([[ownerKey,'owned-tab']]),type:'reload'}),f=fixture({values:persisted,owner:null,browserWindow:doc.window});
 try{await f.advance();assert.deepEqual(f.calls,[]);assert.equal(f.values.size,1);f.native.stop();assert.equal(f.values.size,1);}finally{f.native.stop();}
});

for(const controllerEntry of [null,{active:'true',revision:1},{active:true,revision:0},{active:true,revision:1.5}])test(`a malformed controller entry cannot project a native receipt: ${JSON.stringify(controllerEntry)}`,async()=>{
 const f=fixture({respond:async(body,_count,receipt)=>{const value=receipt(body);value.application.testRun.controllerEntry=controllerEntry;return {ok:true,json:async()=>value};}});
 try{f.native.command('pause',[]);await f.advance();assert.deepEqual(f.applied,[]);assert.equal(f.failures.length,1);assert.equal(f.values.size,0);}finally{f.native.stop();}
});
test('native and received commands share one document counter, preserve retries and continue after a genuine reload',async()=>{
 const doc=documentFor(),f=fixture({owner:null,browserWindow:doc.window}),previousWindow=globalThis.window;
 globalThis.window=doc.window;
 try{
  f.native.command('pause',[]);await f.advance();const first=JSON.parse(f.calls[0].request.body).controllerDispatch;
  assert.equal(first.sequence,1);const accepted={testRunId:scope.testRunId,commandId:'owned-remote'};
  const remote=f.create.received(accepted);assert.deepEqual(remote,{controllerId:first.controllerId,sequence:2});
  f.native.command('resume',[]);await f.advance();assert.equal(JSON.parse(f.calls[1].request.body).controllerDispatch.sequence,3);
  assert.deepEqual(f.create.received(accepted),remote,'Retrying a received command cannot become a newer state effect.');
  assert.equal(f.create.next('another-run',doc.window).sequence,1);
  doc.event('pagehide');const reload=documentFor({session:new Map(doc.session),type:'reload'}),next=fixture({owner:null,browserWindow:reload.window});
  try{next.native.command('pause',[]);await next.advance();assert.deepEqual(JSON.parse(next.calls[0].request.body).controllerDispatch,{controllerId:first.controllerId,sequence:4});}
  finally{next.native.stop();}
  assert.ok(![...doc.session.values()].join().includes('Owned credential'));
 }finally{if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;f.native.stop();}
});
test('a prepared legacy journal retries its original packet without introducing dispatch metadata',async()=>{
 const old=fixture({respond:async()=>{throw Error('Offline');}});old.native.command('pause',[]);await old.advance();
 const values=new Map(old.values),key=[...values.keys()][0],entry=JSON.parse(values.get(key));delete entry.request.controllerDispatch;delete entry.version;values.set(key,JSON.stringify(entry));const packet=JSON.stringify(entry.request);old.native.stop();
 const restored=fixture({values});try{await restored.advance();assert.equal(restored.calls[0].request.body,packet);assert.equal(restored.prepared.length,0);assert.equal(restored.applied.length,1);}finally{restored.native.stop();}
});
test('a restored unclocked native packet retains its former FIFO before new v2 intents',async()=>{
 const held=deferred(),id='owned-legacy',request={testRunId:scope.testRunId,contentReleaseId:scope.contentReleaseId,bookletKey:scope.bookletKey,
  deliveryId:id,keyword:'pause',arguments:[],controllerStatus:'RUNNING',timeStamp:1791763200123};
 const values=new Map([['testcenter-rewrite:participant-native-command:v1:'+id,JSON.stringify({scope,owner:'owned-tab',id,keyword:'pause',args:[],request,prepared:true})]]);
 const f=fixture({values,respond:async(body,_count,receipt)=>{if(body.deliveryId===id)await held.promise;return {ok:true,json:async()=>receipt(body)};}});
 try{await f.advance();f.native.command('resume',[]);await f.advance();assert.equal(f.calls.length,1);
  assert.equal(f.calls[0].request.body,JSON.stringify(request));held.resolve();await flush();await f.advance();
  assert.deepEqual(f.calls.map(call=>JSON.parse(call.request.body).keyword),['pause','resume']);assert.equal(f.values.size,0);
 }finally{held.resolve();f.native.stop();}
});
for(const change of [value=>{value.stateRevision=0;},value=>{value.stateRevision=Number.MAX_SAFE_INTEGER+1;},value=>{value.controllerDispatches=null;},value=>{value.controllerDispatches={owned:0};}])test('malformed Run ordering evidence cannot project a native effect',async()=>{
 const f=fixture({respond:async(body,_count,receipt)=>{const value=receipt(body);change(value.application.testRun);return {ok:true,json:async()=>value};}});
 try{f.native.command('pause',[]);await f.advance();assert.deepEqual(f.applied,[]);assert.equal(f.failures.length,1);assert.equal(f.values.size,0);}finally{f.native.stop();}
});

for(const keyword of ['pause','resume','goto'])test(`${keyword} starts synchronously before its own held preparation without repeating on retry`,async()=>{
 const gate=deferred(),starts=[],f=fixture({prepare:()=>gate.promise,started:request=>starts.push(structuredClone(request)),respond:async()=>({ok:false,status:503})});
 try{
  f.native.command(keyword,keyword==='goto'?['0']:[]);assert.equal(starts.length,1);assert.equal(starts[0].keyword,keyword);assert.equal(starts[0].controllerDispatch.sequence,1);assert.equal(f.calls.length,0);
  await f.advance();assert.equal(f.calls.length,0);gate.resolve();await flush();await f.advance(1000);assert.equal(f.calls.length,2);assert.equal(starts.length,1);
 }finally{gate.resolve();f.native.stop();}
});

test('prepared terminal status remains byte-exact across retry and same-owner restoration',async()=>{
 const gate=deferred();let status='PAUSED';const f=fixture({prepare:()=>gate.promise,controllerStatus:()=>status,respond:async()=>({ok:false,status:503})});
 try{
  f.native.command('terminate',['lock']);await f.advance();status='RUNNING';gate.resolve();await flush();const packet=f.calls[0].request.body;assert.equal(JSON.parse(packet).controllerStatus,'PAUSED');
  status='ERROR';await f.advance(1000);assert.equal(f.calls[1].request.body,packet);
  const restored=fixture({values:new Map(f.values),controllerStatus:()=> 'PAUSED'});try{await restored.advance();assert.equal(restored.calls[0].request.body,packet);}finally{restored.native.stop();}
 }finally{gate.resolve();f.native.stop();}
});
test('an unprepared legacy termination retains its original observation and unclocked packet',async()=>{
 const gate=deferred(),f=fixture({prepare:()=>gate.promise,controllerStatus:()=> 'PAUSED'});f.native.command('terminate',['lock']);const values=new Map(f.values);f.native.stop();
 for(const [key,raw]of values){const entry=JSON.parse(raw);delete entry.version;values.set(key,JSON.stringify(entry));}
 const restored=fixture({values,controllerStatus:()=> 'RUNNING'});try{await restored.advance();const request=JSON.parse(restored.calls[0].request.body);assert.equal(request.controllerStatus,'PAUSED');assert.equal(request.controllerDispatch,undefined);}finally{gate.resolve();restored.native.stop();}
});

test('native forced termination enters its phase before held buffers and keeps later Pause ordering',async()=>{
 const gate=deferred(),starts=[];let status='RUNNING';const f=fixture({prepare:()=>gate.promise,controllerStatus:()=>status,started:request=>{starts.push(structuredClone(request));if(request.keyword==='pause')status='PAUSED';}});
 try{
  f.native.command('terminate',[]);assert.deepEqual(starts,[]);await flush();assert.equal(starts[0].keyword,'terminate');assert.equal(starts[0].controllerStatus,'RUNNING');assert.equal(starts[0].controllerDispatch.sequence,1);
  await f.advance();assert.equal(f.calls.length,0);f.native.command('pause',[]);assert.equal(starts[1].controllerDispatch.sequence,2);await f.advance();assert.equal(f.calls.length,0);
  gate.resolve();await flush();assert.deepEqual(f.calls.map(call=>JSON.parse(call.request.body)).map(packet=>[packet.keyword,packet.controllerStatus,packet.controllerDispatch.sequence]),[['terminate','RUNNING',1],['pause','RUNNING',2]]);
 }finally{gate.resolve();f.native.stop();}
});
test('a same-turn native Pause precedes the forced-deactivation continuation and changes terminal sampling',async()=>{
 const starts=[];let status='RUNNING';const f=fixture({controllerStatus:()=>status,started:request=>{starts.push(structuredClone(request));if(request.keyword==='pause')status='PAUSED';}});
 try{f.native.command('terminate',[]);f.native.command('pause',[]);assert.equal(starts.length,1);await flush();assert.deepEqual(starts.map(request=>[request.keyword,request.controllerStatus,request.controllerDispatch.sequence]),[['pause','RUNNING',1],['terminate','PAUSED',2]]);}
 finally{f.native.stop();}
});
test('route destruction before the forced-deactivation continuation prevents a terminal phase and delivery',async()=>{
 const starts=[],f=fixture({started:request=>starts.push(request)});f.native.command('terminate',[]);f.native.stop();await flush();await f.advance();assert.deepEqual(starts,[]);assert.deepEqual(f.calls,[]);assert.equal(f.values.size,0);
});

test('replacement before the terminal continuation cannot dispatch even before the next scope observation',async()=>{
 const starts=[],f=fixture({started:request=>starts.push(request)});try{f.native.command('terminate',[]);f.replace(false);await flush();await f.advance();assert.deepEqual(starts,[]);assert.deepEqual(f.calls,[]);assert.equal(f.values.size,0);}finally{f.native.stop();}
});
test('restoring an unprepared modern terminal packet does not replay or resample its former local phase',async()=>{
 const f=fixture();f.native.command('terminate',[]);await flush();const values=new Map(f.values),packet=JSON.parse([...values.values()][0]).request;assert.equal(packet.controllerDispatch.sequence,1);f.native.stop();
 const starts=[],restored=fixture({values,controllerStatus:()=> 'PAUSED',started:request=>starts.push(request)});
 try{await restored.advance();assert.deepEqual(starts,[]);assert.equal(restored.calls[0].request.body,JSON.stringify(packet));}
 finally{restored.native.stop();}
});

test('an already-TERMINATED invocation skips buffers and phase while the first termination still waits',async()=>{
 const gate=deferred(),starts=[];let status='RUNNING';const f=fixture({controllerStatus:()=>status,prepare:()=>gate.promise,started:request=>{starts.push(structuredClone(request));if(request.keyword==='terminate')status=request.controllerStatus==='PAUSED'?'TERMINATED_PAUSED':'TERMINATED';}});
 try{f.native.command('terminate',[]);await f.advance();assert.equal(f.calls.length,0);assert.equal(starts.length,1);f.native.command('terminate',['lock']);await f.advance();assert.equal(starts.length,1);assert.equal(f.prepared.length,1);
  const noop=JSON.parse(f.calls[0].request.body);assert.equal(noop.terminationNoop,true);assert.equal(noop.controllerStatus,'TERMINATED');assert.equal(noop.controllerDispatch.sequence,2);
  gate.resolve();await flush();const first=JSON.parse(f.calls[1].request.body);assert.equal(first.terminationNoop,undefined);assert.equal(first.controllerDispatch.sequence,1);assert.equal(first.controllerStatus,'RUNNING');assert.equal(f.values.size,0);
 }finally{gate.resolve();f.native.stop();}
});
test('same-turn termination invocations both pass the guard even if the second continuation observes TERMINATED',async()=>{
 const gate=deferred(),starts=[];let status='RUNNING';const f=fixture({controllerStatus:()=>status,prepare:()=>gate.promise,started:request=>{starts.push(structuredClone(request));status='TERMINATED';}});
 try{f.native.command('terminate',[]);f.native.command('terminate',['lock']);await f.advance();assert.equal(starts.length,2);assert.equal(f.prepared.length,2);assert.equal(f.calls.length,0);assert.deepEqual(starts.map(r=>[r.controllerStatus,r.terminationNoop]),[['RUNNING',undefined],['TERMINATED',undefined]]);gate.resolve();await flush();assert.ok(f.calls.every(c=>JSON.parse(c.request.body).terminationNoop===undefined));}
 finally{gate.resolve();f.native.stop();}
});
test('TERMINATED_PAUSED is not the already-TERMINATED guard and prepared no-op retries retain their decision',async()=>{
 const gate=deferred(),starts=[];let status='TERMINATED_PAUSED';const f=fixture({controllerStatus:()=>status,prepare:()=>gate.promise,started:r=>{starts.push(r);status='TERMINATED';},respond:async()=>({ok:false,status:503})});
 try{f.native.command('terminate',[]);await f.advance();assert.equal(starts.length,1);assert.equal(f.prepared.length,1);f.native.command('terminate',['lock']);await f.advance();const packet=f.calls[0].request.body;assert.equal(JSON.parse(packet).terminationNoop,true);
  status='RUNNING';await f.advance(1000);assert.equal(f.calls[1].request.body,packet);assert.equal(f.prepared.length,1);
  const values=new Map(f.values),restored=fixture({values,controllerStatus:()=> 'PAUSED'});try{await restored.advance();assert.ok(restored.calls.some(c=>c.request.body===packet));}finally{restored.native.stop();}
 }finally{gate.resolve();f.native.stop();}
});
for(const forged of [true,false])test(`a forged terminal early-return receipt cannot change projection (${forged})`,async()=>{
 const f=fixture({respond:async(body,_count,receipt)=>{const value=receipt(body);value.application.terminationNoop=forged;return{ok:true,json:async()=>value};}});try{f.native.command('pause',[]);await f.advance();assert.equal(f.applied.length,0);assert.equal(f.failures.length,1);}finally{f.native.stop();}
});

test('an early return bypasses a held legacy packet while later state effects keep legacy FIFO',async()=>{
 const gate=deferred(),id='owned-legacy',request={testRunId:scope.testRunId,contentReleaseId:scope.contentReleaseId,bookletKey:scope.bookletKey,deliveryId:id,keyword:'pause',arguments:[],controllerStatus:'RUNNING',timeStamp:1791763200123};
 const values=new Map([['testcenter-rewrite:participant-native-command:v1:'+id,JSON.stringify({scope,owner:'owned-tab',id,keyword:'pause',args:[],request,prepared:true})]]);
 const f=fixture({values,controllerStatus:()=> 'TERMINATED',respond:async(body,_count,receipt)=>{if(body.deliveryId===id)await gate.promise;return{ok:true,json:async()=>receipt(body)};}});
 try{await f.advance();f.native.command('terminate',['lock']);f.native.command('resume',[]);await f.advance();assert.equal(f.calls.length,2);assert.equal(JSON.parse(f.calls[1].request.body).terminationNoop,true);assert.equal(f.prepared.length,0);
  gate.resolve();await flush();await f.advance();assert.deepEqual(f.calls.map(c=>JSON.parse(c.request.body).keyword),['pause','terminate','resume']);assert.equal(f.prepared.length,1);
 }finally{gate.resolve();f.native.stop();}
});
test('restoring an effectful TERMINATED observation does not reclassify its passed invocation guard',async()=>{
 const gate=deferred();let status='RUNNING';const f=fixture({controllerStatus:()=>status,started:()=>{status='TERMINATED';},prepare:()=>gate.promise});f.native.command('terminate',[]);f.native.command('terminate',['lock']);await flush();const values=new Map(f.values);f.native.stop();
 const restored=fixture({values,controllerStatus:()=> 'TERMINATED'});try{await restored.advance();assert.equal(restored.prepared.length,2);assert.ok(restored.calls.every(c=>JSON.parse(c.request.body).terminationNoop===undefined));assert.equal(JSON.parse(restored.calls[1].request.body).controllerStatus,'TERMINATED');}finally{gate.resolve();restored.native.stop();}
});

const capturedTimer=(request,allocate)=>({testRunId:request.testRunId,contentReleaseId:request.contentReleaseId,bookletKey:request.bookletKey,
 deliveryId:request.deliveryId,keyword:request.keyword,controllerStatus:request.controllerStatus,controllerDispatch:allocate(),
 unitKey:'unit',testletKey:'timed',startedAt:'2026-10-12T00:00:00.000Z',expiresAt:'2026-10-12T00:00:06.000Z',remainingSeconds:3});
test('a timer interruption is captured immediately and acknowledged before answer drain; a lost main reply does not repeat it',async()=>{
 const timerGate=deferred(),answerGate=deferred();let captures=0,mainCalls=0;
 const f=fixture({captureTimer:(...args)=>{captures++;return capturedTimer(...args);},prepare:()=>answerGate.promise,
  respond:async(body,_count,receipt)=>{if(body.testletKey){await timerGate.promise;return {ok:true,json:async()=>receipt(body)};}
   mainCalls++;return mainCalls===1?{ok:false,status:503}:{ok:true,json:async()=>receipt(body)};}});
 try{
  f.native.command('pause',[]);assert.equal(captures,1);assert.equal(f.prepared.length,0);await f.advance();
  assert.equal(f.calls.length,1);assert.match(f.calls[0].url,/controller-timer-interruptions$/);assert.equal(f.prepared.length,0);
  const early=JSON.parse(f.calls[0].request.body);assert.equal(early.remainingSeconds,3);assert.equal(early.controllerDispatch.sequence,1);
  timerGate.resolve();await flush();assert.equal(f.prepared.length,1);assert.equal(f.calls.length,1);
  answerGate.resolve();await flush();assert.equal(mainCalls,1);await f.advance(1000);assert.equal(mainCalls,2);
  assert.equal(f.calls.filter(c=>c.url.endsWith('controller-timer-interruptions')).length,1);assert.equal(f.applied.length,1);assert.equal(f.values.size,0);
  assert.equal(f.calls[1].request.body,f.calls[2].request.body);
 }finally{timerGate.resolve();answerGate.resolve();f.native.stop();}
});
test('an unacknowledged terminal timer packet restores exact identity without recapturing a phase or timer',async()=>{
 const f=fixture({captureTimer:capturedTimer,respond:async()=>({ok:false,status:503})});
 f.native.command('terminate',[]);await f.advance();assert.equal(f.calls.length,1);assert.equal(f.prepared.length,0);
 const timerBody=f.calls[0].request.body,persisted=new Map(f.values);f.native.stop();
 const next=fixture({values:persisted,captureTimer:()=>assert.fail('Restoration recaptured its timer'),started:()=>assert.fail('Restoration replayed its phase'),
  respond:async(body,_count,receipt)=>({ok:true,json:async()=>body.testletKey?{interruption:{...receipt(body).interruption,applied:false}}:receipt(body)})});
 try{await next.advance();assert.equal(next.calls[0].request.body,timerBody);assert.equal(next.calls.length,2);assert.equal(next.prepared.length,1);assert.equal(next.applied.length,1);assert.equal(next.values.size,0);
  assert.equal(JSON.parse(next.calls[1].request.body).controllerDispatch.sequence,2);
 }finally{next.native.stop();}
});
test('a mismatched timer receipt fails closed before answer drain or command application',async()=>{
 const f=fixture({captureTimer:capturedTimer,respond:async(body,_count,receipt)=>({ok:true,json:async()=>({interruption:{...receipt(body).interruption,scope:{...scope,testRunId:'foreign'}}})})});
 try{f.native.command('pause',[]);await f.advance();assert.equal(f.calls.length,1);assert.equal(f.prepared.length,0);assert.equal(f.applied.length,0);assert.equal(f.values.size,0);assert.match(f.failures[0],/timer receipt/);}
 finally{f.native.stop();}
});
test('an exact terminal no-op never captures, prepares or dispatches a timer interruption',async()=>{
 const f=fixture({controllerStatus:()=> 'TERMINATED',captureTimer:()=>assert.fail('A no-op interrupted its timer')});
 try{f.native.command('terminate',['lock']);await f.advance();assert.equal(f.calls.length,1);assert.match(f.calls[0].url,/native-commands$/);assert.equal(f.prepared.length,0);assert.equal(JSON.parse(f.calls[0].request.body).terminationNoop,true);}
 finally{f.native.stop();}
});
