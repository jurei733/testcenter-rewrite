import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
await import('@angular/compiler');
const path=new URL('../apps/web/src/app/native-monitor/native-session.service.ts',import.meta.url);
let code=ts.transpileModule(await readFile(path,'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,experimentalDecorators:true}}).outputText;
code=code.replaceAll("'@angular/core'",JSON.stringify(import.meta.resolve('@angular/core')));
const {NativeMonitorSessionService,NativeMonitorHttpError}=await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const storageKey='testcenter-native-monitor-session';
const access=token=>({token,claims:{testGroupMonitor:[{id:'owned',label:'Owned',type:'testGroupMonitor',flags:[]}]},customTexts:{}});
const response=(value,status=200)=>new Response(typeof value==='string'?value:JSON.stringify(value),{status});
const deferred=()=>{let resolve;const promise=new Promise(done=>resolve=done);return {promise,resolve};};
const settle=()=>new Promise(done=>setImmediate(done));
async function fixture(run,token){const oldFetch=globalThis.fetch,oldStorage=globalThis.localStorage,oldSecure=globalThis.isSecureContext,values=new Map(token?[[storageKey,token]]:[]);globalThis.localStorage={getItem:key=>values.get(key)??null,setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)};globalThis.isSecureContext=true;try{await run(values);}finally{globalThis.fetch=oldFetch;globalThis.localStorage=oldStorage;globalThis.isSecureContext=oldSecure;}}
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
