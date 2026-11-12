import assert from 'node:assert/strict';
import test from 'node:test';
import {readFile} from 'node:fs/promises';
import ts from 'typescript';
const compile=async path=>ts.transpileModule(await readFile(new URL(path,import.meta.url),'utf8'),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,experimentalDecorators:true}}).outputText;
const url=code=>'data:text/javascript;base64,'+Buffer.from(code).toString('base64');
const errorUrl=url(await compile('../apps/web/src/app/native-monitor/native-http-error.ts'));
let code=await compile('../apps/web/src/app/native-system-check/native-system-check-installation.service.ts');
code=code.replaceAll("'@angular/core'",JSON.stringify(import.meta.resolve('@angular/core'))).replaceAll("'../native-monitor/native-http-error'",JSON.stringify(errorUrl));
const {NativeSystemCheckInstallationService}=await import(url(code));
const {parseNativeSystemCheckDirectory}=await import(url(await compile('../apps/web/src/app/native-system-check/native-system-check-directory.ts')));
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return{promise,resolve};};
test('retiring one view cannot cancel the shared startup mode or another waiting view',async()=>{
 const previous=globalThis.fetch,pending=deferred(),requests=[];
 globalThis.fetch=async(path,options)=>{requests.push({path,options});return pending.promise;};
 const installation=new NativeSystemCheckInstallationService(),first=new AbortController(),second=new AbortController();
 try{
  const retired=installation.ready(first.signal),active=installation.ready(second.signal);first.abort();await assert.rejects(retired,error=>error.name==='AbortError');
  assert.equal(requests.length,1);assert.equal(requests[0].path,'/sys-check-mode');assert.equal(requests[0].options.credentials,'omit');assert.equal(requests[0].options.redirect,'error');assert.equal(requests[0].options.headers.AuthToken,undefined);assert.equal(requests[0].options.signal.aborted,false);
  pending.resolve(new Response('false'));assert.equal(await active,false);assert.equal(installation.loginRequired(),false);
  assert.equal(await installation.ready(new AbortController().signal),false);assert.equal(requests.length,1);
 }finally{installation.ngOnDestroy();globalThis.fetch=previous;}
});
test('a malformed installation response cannot silently select anonymous or direct report saving',async()=>{
 const previous=globalThis.fetch;globalThis.fetch=async()=>new Response('{"mode":false}');
 const installation=new NativeSystemCheckInstallationService();
 try{await assert.rejects(installation.ready(new AbortController().signal),/Ungültiger Systemcheck-Modus/);assert.equal(installation.loginRequired(),null);}
 finally{installation.ngOnDestroy();globalThis.fetch=previous;}
});
test('a late startup response cannot rewind a newer administrative upload refresh or its waiting view',async()=>{
 const previous=globalThis.fetch,first=deferred(),second=deferred();let reads=0;
 globalThis.fetch=async()=>++reads===1?first.promise:second.promise;
 const installation=new NativeSystemCheckInstallationService();
 try{
  const waiting=installation.ready(new AbortController().signal),refreshed=installation.refresh();
  second.resolve(new Response('true'));assert.equal(await refreshed,true);
  first.resolve(new Response('false'));assert.equal(await waiting,true);assert.equal(installation.loginRequired(),true);assert.equal(installation.problem(),null);assert.equal(reads,2);
 }finally{installation.ngOnDestroy();globalThis.fetch=previous;}
});
test('a stale failed read cannot replace a successful current mode or open an obsolete application error',async()=>{
 const previous=globalThis.fetch,first=deferred();let reads=0;
 globalThis.fetch=async()=>++reads===1?first.promise:new Response('false');
 const installation=new NativeSystemCheckInstallationService();
 try{
  const waiting=installation.ready(new AbortController().signal);assert.equal(await installation.refresh(),false);
  first.resolve(new Response('old backend failure',{status:503}));assert.equal(await waiting,false);assert.equal(installation.problem(),null);assert.equal(installation.loginRequired(),false);
 }finally{installation.ngOnDestroy();globalThis.fetch=previous;}
});
test('an explicit upload refresh recovers a failed startup without permanently poisoning new view readiness',async()=>{
 const previous=globalThis.fetch;let reads=0;globalThis.fetch=async()=>++reads===1?new Response('owned failure',{status:503}):new Response('true');
 const installation=new NativeSystemCheckInstallationService();
 try{
  await assert.rejects(installation.ready(new AbortController().signal),error=>error.status===503);assert.equal(installation.loginRequired(),null);assert.equal(installation.problem().status,503);
  assert.equal(await installation.refresh(),true);assert.equal(await installation.ready(new AbortController().signal),true);assert.equal(installation.problem(),null);
 }finally{installation.ngOnDestroy();globalThis.fetch=previous;}
});
test('failed refreshes retain the last valid Source mode while exposing the application error',async()=>{
 const previous=globalThis.fetch;let reads=0;globalThis.fetch=async()=>++reads===1?new Response('false'):new Response('owned failure',{status:503});
 const installation=new NativeSystemCheckInstallationService();
 try{
  assert.equal(await installation.ready(new AbortController().signal),false);await assert.rejects(installation.refresh(),error=>error.status===503);
  assert.equal(await installation.ready(new AbortController().signal),false);assert.equal(installation.loginRequired(),false);assert.equal(installation.problem().status,503);
 }finally{installation.ngOnDestroy();globalThis.fetch=previous;}
});
test('native directory keeps exact int64 identity, ordered duplicates and arbitrary display text',()=>{
 assert.deepEqual(parseNativeSystemCheckDirectory(''),[]);
 const text='[{"workspaceId":9007199254740993,"name":"OWNED.CHECK","label":"Owned < Ω","description":"  Owned  "},{"workspaceId":9223372036854775807,"name":"OWNED.CHECK","label":"Other","description":""}]';
 assert.deepEqual(parseNativeSystemCheckDirectory(text),[{workspaceId:'9007199254740993',name:'OWNED.CHECK',label:'Owned < Ω',description:'  Owned  '},{workspaceId:'9223372036854775807',name:'OWNED.CHECK',label:'Other',description:''}]);
 assert.equal(parseNativeSystemCheckDirectory('[{"workspaceId":1,"name":"A","label":"A","description":""},{"workspaceId":1,"name":"A","label":"A","description":""}]').length,2);
 for(const text of ['{}','null','[{"workspaceId":9223372036854775808,"name":"A","label":"A","description":""}]','[{"workspaceId":1,"name":"../A","label":"A","description":""}]','[{"workspaceId":0,"name":"A","label":"A","description":""}]'])assert.throws(()=>parseNativeSystemCheckDirectory(text));
});
