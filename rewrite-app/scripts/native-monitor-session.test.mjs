import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
await import('@angular/compiler');
const path=new URL('../apps/web/src/app/native-monitor/native-session.service.ts',import.meta.url);
let code=ts.transpileModule(await readFile(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,experimentalDecorators:true}}).outputText;
code=code.replaceAll("'@angular/core'",JSON.stringify(import.meta.resolve('@angular/core'))).replace("import('altcha-lib')",'Promise.resolve(globalThis.__nativeMonitorChallengeFixture)');
const {NativeMonitorSessionService,NativeMonitorHttpError}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const storageKey='testcenter-native-monitor-session';
const access=token=>({token,claims:{testGroupMonitor:[{id:'owned',label:'Owned',type:'testGroupMonitor',flags:[]}]},customTexts:{}});
const response=(value,status=200)=>new Response(typeof value==='string'?value:JSON.stringify(value),{status});
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
const settle=()=>new Promise(done=>setImmediate(done));
async function fixture(run,token){const oldFetch=globalThis.fetch,oldStorage=globalThis.localStorage,oldTabStorage=globalThis.sessionStorage,oldSecure=globalThis.isSecureContext,values=new Map(token?[[storageKey,token]]:[]),tabValues=new Map();globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};globalThis.sessionStorage={getItem:key=>tabValues.get(key)??null,setItem:(key,value)=>tabValues.set(key,value),removeItem:key=>tabValues.delete(key)};globalThis.isSecureContext=true;try{await run(values,tabValues);}finally{globalThis.fetch=oldFetch;globalThis.localStorage=oldStorage;globalThis.sessionStorage=oldTabStorage;globalThis.isSecureContext=oldSecure;}}

test('late native restoration cannot replace a newer real login',()=>fixture(async values=>{
 const pending=deferred(),requests=[];globalThis.fetch=async(path,options)=>{requests.push({path,options});return options.method==='GET'?pending.promise:response(access('new'));};const session=new NativeMonitorSessionService();assert.equal(session.restoring(),true);
 await session.login('owned','password');pending.resolve(response(access('old')));await settle();assert.equal(session.access().token,'new');assert.equal(values.get(storageKey),'new');assert.equal(session.restoring(),false);
 const login=requests.find(r=>r.options.method==='PUT');assert.equal(login.options.headers.AuthToken,undefined);assert.equal(login.options.headers.Authorization,undefined);assert.equal(login.options.cache,'no-store');assert.deepEqual(JSON.parse(login.options.body),{name:'owned',password:'password'});
},'old'));
test('logout prevents a late restoring request from bringing a native session back',()=>fixture(async values=>{
 const pending=deferred();globalThis.fetch=()=>pending.promise;const session=new NativeMonitorSessionService();await session.logout();pending.resolve(response(access('old')));await settle();assert.equal(session.access(),null);assert.equal(values.has(storageKey),false);
},'old'));
test('current revoked native credentials clear local access; a stale old-token failure cannot clear a replacement',()=>fixture(async values=>{
 let handler=()=>response(access('current'));globalThis.fetch=(path,options)=>handler(path,options);const session=new NativeMonitorSessionService();await session.login('owned','password');
 handler=()=>response('revoked current',403);await assert.rejects(session.text('GET','/monitor/group/owned/test-sessions'),error=>error instanceof NativeMonitorHttpError&&error.status===403&&!error.message.includes('current'));assert.equal(session.access(),null);assert.equal(values.has(storageKey),false);
 handler=()=>response(access('replacement'));await session.login('owned','password');handler=()=>response('revoked old',401);await assert.rejects(session.text('GET','/session',undefined,'old'));assert.equal(session.access().token,'replacement');
}));
test('restored claims must still authorize the monitor and insecure password entry sends no request',()=>fixture(async values=>{
 globalThis.fetch=async()=>response({token:'old',claims:{},customTexts:{}});const session=new NativeMonitorSessionService();await settle();assert.equal(session.access(),null);assert.equal(values.has(storageKey),false);
 globalThis.isSecureContext=false;let called=false;globalThis.fetch=async()=>{called=true;throw Error('Unexpected request');};await assert.rejects(session.login('owned','password'),/HTTPS/);assert.equal(called,false);assert.equal(session.busy(),false);
},'old'));
test('snapshot cancellation is combined with the existing finite HTTP deadline',()=>fixture(async()=>{
 globalThis.fetch=async()=>response(access('current'));const session=new NativeMonitorSessionService();await session.login('owned','password');const controller=new AbortController();let received;
 globalThis.fetch=async(path,options)=>{received=options.signal;return response([]);};await session.text('GET','/monitor/group/owned/test-sessions',undefined,undefined,false,controller.signal);assert.notEqual(received,controller.signal);assert.equal(received.aborted,false);controller.abort();assert.equal(received.aborted,true);
}));
test('access changes abort in-flight transport and reject an already-received late body',()=>fixture(async()=>{
 globalThis.fetch=async()=>response(access('current'));const session=new NativeMonitorSessionService();await session.login('owned','password');
 const body=deferred();let signal;globalThis.fetch=async(path,options)=>{signal=options.signal;return {ok:true,text:()=>body.promise};};
 const read=session.text('GET','/booklet/BOOK'),rejected=assert.rejects(read,error=>error.name==='AbortError');await settle();const old=session.accessSignal;
 session.clear();assert.equal(signal.aborted,true);assert.equal(old.aborted,true);assert.notEqual(session.accessSignal,old);body.resolve('Private old Booklet');await rejected;assert.equal(session.access(),null);
}));
test('starting a replacement login invalidates pending actions from the old access',()=>fixture(async()=>{
 globalThis.fetch=async()=>response(access('current'));const session=new NativeMonitorSessionService();await session.login('owned','password');const old=session.accessSignal;
 globalThis.fetch=async()=>response(access('replacement'));await session.login('replacement','password');assert.equal(old.aborted,true);assert.notEqual(session.accessSignal,old);assert.equal(session.access().token,'replacement');
}));

test('retiring a login owner rejects late credentials and revokes only its orphan access',()=>fixture(async values=>{
 const pending=deferred(),requests=[],owner=new AbortController();globalThis.fetch=async(path,options)=>{requests.push({path,options});return options.method==='DELETE'?response(''):pending.promise;};
 const session=new NativeMonitorSessionService(),login=session.login('owned','password',owner.signal),rejected=assert.rejects(login);owner.abort();const busyAfterRetirement=session.busy();
 pending.resolve(response(access('orphan')));await rejected;assert.equal(busyAfterRetirement,false);assert.equal(session.access(),null);assert.equal(values.has(storageKey),false);assert.equal(session.problem(),'');
 assert.deepEqual(requests.filter(r=>r.options.method==='DELETE').map(r=>r.options.headers.AuthToken),['orphan']);
}));
test('a retired credential failure cannot start proof-of-work or change replacement login state',()=>fixture(async()=>{
 const old=deferred(),current=deferred(),owner=new AbortController(),requests=[];globalThis.fetch=async(path,options)=>{requests.push(path);if(path==='/session/challenge')return response({});return requests.length===1?old.promise:current.promise;};
 const session=new NativeMonitorSessionService(),oldLogin=session.login('old','password',owner.signal),oldRejected=assert.rejects(oldLogin);
 const next=session.login('current','password');owner.abort();old.resolve(response('Brute Force protection active',400));await oldRejected;
 assert.equal(session.busy(),true);assert.equal(session.problem(),'');assert.deepEqual(requests,['/session/login','/session/login']);
 current.resolve(response(access('current')));await next;assert.equal(session.access().token,'current');assert.equal(session.problem(),'');
}));
test('a late failed login cannot overwrite a newer successful login problem state',()=>fixture(async()=>{
 const old=deferred();let first=true;globalThis.fetch=async()=>{if(first){first=false;return old.promise;}return response(access('current'));};
 const session=new NativeMonitorSessionService(),prior=session.login('old','password'),rejected=assert.rejects(prior);await session.login('current','password');old.resolve(response('old failure',401));await rejected;
 assert.equal(session.access().token,'current');assert.equal(session.problem(),'');assert.equal(session.busy(),false);
}));
test('retiring a proof-of-work login stops its workers and sends no proof completion',()=>fixture(async()=>{
 const saved={document:globalThis.document,Worker:globalThis.Worker,solver:globalThis.__nativeMonitorChallengeFixture};
 const work=deferred(),started=deferred(),workers=[],requests=[];globalThis.document={baseURI:'https://owned.example/'};
 globalThis.Worker=class{constructor(url,options){assert.equal(url.pathname,'/altcha-lib/dist/worker.js');assert.deepEqual(options,{type:'module'});this.stopped=false;workers.push(this);}terminate(){this.stopped=true;}};
 globalThis.__nativeMonitorChallengeFixture={solveChallengeWorkers:(factory)=>{if(typeof factory==='function')factory();started.resolve();return work.promise;}};
 globalThis.fetch=async(path,options)=>{requests.push({path,method:options.method});return path==='/session/login'?response('Brute Force protection active',400):response({challenge:'owned',salt:'owned',algorithm:'SHA-256',signature:'owned',maxNumber:1});};
 try{const owner=new AbortController(),session=new NativeMonitorSessionService(),login=session.login('owned','password',owner.signal),rejected=assert.rejects(login);
  await started.promise;owner.abort();work.resolve({number:1});await rejected;assert.ok(workers.length);assert.ok(workers.every(w=>w.stopped));
  assert.deepEqual(requests,[{path:'/session/login',method:'PUT'},{path:'/session/challenge',method:'POST'}]);assert.equal(session.access(),null);assert.equal(session.busy(),false);
 }finally{globalThis.document=saved.document;globalThis.Worker=saved.Worker;globalThis.__nativeMonitorChallengeFixture=saved.solver;}
}));

test('finish targets survive restoration and same-token refresh but never a replacement credential',()=>fixture(async(values,tabValues)=>{
 let next='current';globalThis.fetch=async()=>response(access(next));const first=new NativeMonitorSessionService();await first.login('owned','password');first.rememberFinishTargets('owned',['9007199254740993']);
 const restored=new NativeMonitorSessionService();await settle();assert.deepEqual(restored.pendingFinishTargets('owned'),['9007199254740993']);await restored.refresh();assert.deepEqual(restored.pendingFinishTargets('owned'),['9007199254740993']);
 next='replacement';await restored.login('replacement','password');assert.deepEqual(restored.pendingFinishTargets('owned'),[]);assert.equal(tabValues.size,0);
 restored.rememberFinishTargets('owned',['2']);restored.clear();assert.equal(tabValues.size,0);assert.deepEqual(restored.pendingFinishTargets('owned'),[]);
}));
test('an unauthorized restoration clears retained finish targets before any new access',()=>fixture(async(values,tabValues)=>{
 tabValues.set(storageKey+'-unfinished-finish',JSON.stringify({token:'old',groups:{A:['1']}}));globalThis.fetch=async()=>response('revoked',403);
 const session=new NativeMonitorSessionService();await settle();assert.deepEqual(session.pendingFinishTargets('owned'),[]);assert.equal(tabValues.size,0);assert.equal(values.size,0);
},'old'));

test('same-token claim refresh erases retained targets for a revoked group',()=>fixture(async(values,tabValues)=>{
 let claims=access('current');globalThis.fetch=async()=>response(claims);const session=new NativeMonitorSessionService();await session.login('owned','password');session.rememberFinishTargets('owned',['1']);
 claims={...claims,claims:{testGroupMonitor:[{id:'other',flags:[]}]}};await session.refresh();assert.deepEqual(session.pendingFinishTargets('owned'),[]);assert.equal(tabValues.size,0);
}));
