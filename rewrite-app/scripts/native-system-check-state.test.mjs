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
test('native directory keeps exact int64 identity, ordered duplicates and arbitrary display text',()=>{
 assert.deepEqual(parseNativeSystemCheckDirectory(''),[]);
 const text='[{"workspaceId":9007199254740993,"name":"OWNED.CHECK","label":"Owned < Ω","description":"  Owned  "},{"workspaceId":9223372036854775807,"name":"OWNED.CHECK","label":"Other","description":""}]';
 assert.deepEqual(parseNativeSystemCheckDirectory(text),[{workspaceId:'9007199254740993',name:'OWNED.CHECK',label:'Owned < Ω',description:'  Owned  '},{workspaceId:'9223372036854775807',name:'OWNED.CHECK',label:'Other',description:''}]);
 assert.equal(parseNativeSystemCheckDirectory('[{"workspaceId":1,"name":"A","label":"A","description":""},{"workspaceId":1,"name":"A","label":"A","description":""}]').length,2);
 for(const text of ['{}','null','[{"workspaceId":9223372036854775808,"name":"A","label":"A","description":""}]','[{"workspaceId":1,"name":"../A","label":"A","description":""}]','[{"workspaceId":0,"name":"A","label":"A","description":""}]'])assert.throws(()=>parseNativeSystemCheckDirectory(text));
});
