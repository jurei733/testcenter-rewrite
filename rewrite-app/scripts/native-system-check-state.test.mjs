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
const createInstallation=(ready=()=>Promise.resolve())=>new NativeSystemCheckInstallationService({ready});
test('retiring one view cannot cancel the shared startup mode or another waiting view',async()=>{
 const previous=globalThis.fetch,pending=deferred(),requests=[];
 globalThis.fetch=async(path,options)=>{requests.push({path,options});return pending.promise;};
 const installation=createInstallation(),first=new AbortController(),second=new AbortController();
 try{
  const retired=installation.ready(first.signal),active=installation.ready(second.signal);first.abort();await assert.rejects(retired,error=>error.name==='AbortError');
  assert.equal(requests.length,1);assert.equal(requests[0].path,'/sys-check-mode');assert.equal(requests[0].options.credentials,'omit');assert.equal(requests[0].options.redirect,'error');assert.equal(requests[0].options.headers.AuthToken,undefined);assert.equal(requests[0].options.signal.aborted,false);
  pending.resolve(new Response('false'));assert.equal(await active,false);assert.equal(installation.loginRequired(),false);
  assert.equal(await installation.ready(new AbortController().signal),false);assert.equal(requests.length,1);
 }finally{installation.ngOnDestroy();globalThis.fetch=previous;}
});
test('a malformed installation response cannot silently select anonymous or direct report saving',async()=>{
 const previous=globalThis.fetch;globalThis.fetch=async()=>new Response('{"mode":false}');
 const installation=createInstallation();
 try{await assert.rejects(installation.ready(new AbortController().signal),/Ungültiger Systemcheck-Modus/);assert.equal(installation.loginRequired(),null);}
 finally{installation.ngOnDestroy();globalThis.fetch=previous;}
});
test('a late startup response cannot rewind a newer administrative upload refresh or its waiting view',async()=>{
 const previous=globalThis.fetch,first=deferred(),second=deferred();let reads=0;
 globalThis.fetch=async()=>++reads===1?first.promise:second.promise;
 const installation=createInstallation();
 try{
  const waiting=installation.ready(new AbortController().signal),refreshed=installation.refresh();
  second.resolve(new Response('true'));assert.equal(await refreshed,true);
  first.resolve(new Response('false'));assert.equal(await waiting,true);assert.equal(installation.loginRequired(),true);assert.equal(installation.problem(),null);assert.equal(reads,2);
 }finally{installation.ngOnDestroy();globalThis.fetch=previous;}
});
test('a stale failed read cannot replace a successful current mode or open an obsolete application error',async()=>{
 const previous=globalThis.fetch,first=deferred();let reads=0;
 globalThis.fetch=async()=>++reads===1?first.promise:new Response('false');
 const installation=createInstallation();
 try{
  const waiting=installation.ready(new AbortController().signal);assert.equal(await installation.refresh(),false);
  first.resolve(new Response('old backend failure',{status:503}));assert.equal(await waiting,false);assert.equal(installation.problem(),null);assert.equal(installation.loginRequired(),false);
 }finally{installation.ngOnDestroy();globalThis.fetch=previous;}
});
test('an explicit upload refresh recovers a failed startup without permanently poisoning new view readiness',async()=>{
 const previous=globalThis.fetch;let reads=0;globalThis.fetch=async()=>++reads===1?new Response('owned failure',{status:503}):new Response('true');
 const installation=createInstallation();
 try{
  await assert.rejects(installation.ready(new AbortController().signal),error=>error.status===503);assert.equal(installation.loginRequired(),null);assert.equal(installation.problem().status,503);
  assert.equal(await installation.refresh(),true);assert.equal(await installation.ready(new AbortController().signal),true);assert.equal(installation.problem(),null);
 }finally{installation.ngOnDestroy();globalThis.fetch=previous;}
});
test('failed refreshes retain the last valid Source mode while exposing the application error',async()=>{
 const previous=globalThis.fetch;let reads=0;globalThis.fetch=async()=>++reads===1?new Response('false'):new Response('owned failure',{status:503});
 const installation=createInstallation();
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

// Drive Root's actual compiled lifecycle through the two legitimate code-load
// orders. The opener is a code capability; all requests/dialog ownership stays
// with the document, including an early fallback and later routed registration.
const rootCore=await import('@angular/core');
const rootSource=await readFile(new URL('../apps/web/src/app/bootstrap-root.component.ts',import.meta.url),'utf8');
const rootCode=ts.transpileModule(rootSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
function rootFixture(t){
 const previousWindow=globalThis.window,previousNavigator=Object.getOwnPropertyDescriptor(globalThis,'navigator');
 globalThis.window=new EventTarget();Object.defineProperty(globalThis,'navigator',{configurable:true,value:{onLine:true}});
 const effects=[],opens=[],closed=[],fallback=deferred();let problem=null,presenter;
 const bindings={settings:{loaded:()=>true},mode:{mode:()=> 'original'},errors:{presenter:()=>presenter},installation:{problem:()=>problem},router:{url:'/r/check-starter',events:{pipe:()=>({subscribe(){}})}},injector:{}};
 const exports={};new Function('exports','require',rootCode)(exports,spec=>{
  if(spec==='@angular/core')return {...rootCore,Component:()=>value=>value,Injector:'injector',inject:key=>bindings[key],effect:callback=>{effects.push(callback);callback();}};
  if(spec==='@angular/router')return {Router:'router',RouterOutlet:class{},NavigationEnd:class{}};
  if(spec==='@angular/core/rxjs-interop')return {takeUntilDestroyed:()=>{}};
  if(spec.endsWith('application-settings.service'))return {ApplicationSettingsService:'settings'};
  if(spec.endsWith('interface-mode.service'))return {InterfaceModeService:'mode'};
  if(spec.endsWith('native-system-check-installation.service'))return {NativeSystemCheckInstallationService:'installation'};
  if(spec.endsWith('native-error-presenter.service'))return {NativeErrorPresenterService:'errors'};
  if(spec.endsWith('native-system-check-installation-error'))return fallback.promise;
  throw Error('Unexpected Root dependency '+spec);
 });
 const component=new exports.BootstrapRootComponent();
 const open=(_injector,error,owner)=>{opens.push({error,owner});return()=>closed.push(error);};
 t.after(()=>{component.ngOnDestroy();if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;if(previousNavigator)Object.defineProperty(globalThis,'navigator',previousNavigator);else delete globalThis.navigator;});
 return {component,opens,closed,open,fallback,problem(value){problem=value;effects[0]();},register(value=open){presenter=value;effects[0]();},navigate(){window.dispatchEvent(new Event('popstate'));}};
}
const settleRoot=()=>new Promise(done=>setImmediate(done));
test('a routed presenter arriving after the early fallback must not reopen the same visible failure',async t=>{
 const f=rootFixture(t),error=Error('same public mode failure');f.problem(error);f.fallback.resolve({openNativeSystemCheckInstallationError:f.open});await settleRoot();assert.equal(f.opens.length,1);
 f.register();await settleRoot();assert.equal(f.opens.length,1);assert.equal(f.closed.length,0);
});
test('a routed presenter can replace a pending fallback and its later module cannot open a duplicate',async t=>{
 const f=rootFixture(t),error=Error('pending public mode failure');f.problem(error);f.register();assert.equal(f.opens.length,1);
 f.fallback.resolve({openNativeSystemCheckInstallationError:f.open});await settleRoot();assert.equal(f.opens.length,1);assert.equal(f.closed.length,0);
});
test('history dismissal while code is pending also survives later registration, while a new failure remains visible',async t=>{
 const f=rootFixture(t);f.problem(Error('retired failure'));f.navigate();f.register();f.fallback.resolve({openNativeSystemCheckInstallationError:f.open});await settleRoot();assert.equal(f.opens.length,0);
 const later=Error('new failure after history');f.problem(later);assert.equal(f.opens.length,1);assert.equal(f.opens[0].error,later);
});
test('a destroyed document cannot display a pending fallback or a subsequently registered presenter',async t=>{
 const f=rootFixture(t);f.problem(Error('retired document'));f.component.ngOnDestroy();f.register();f.fallback.resolve({openNativeSystemCheckInstallationError:f.open});await settleRoot();assert.equal(f.opens.length,0);
});
test('a genuinely new mode failure replaces the old dialog once under the same document owner',t=>{
 const f=rootFixture(t),first=Error('first failure'),second=Error('second failure');f.register();f.problem(first);f.problem(second);
 assert.equal(f.opens.length,2);assert.deepEqual(f.closed,[first]);assert.equal(f.opens[0].owner,f.opens[1].owner);assert.equal(f.opens[1].error,second);
});

test('startup never sends the public mode request until independent error code is available',async()=>{
 const previous=globalThis.fetch,codeReady=deferred(),requests=[];globalThis.fetch=async(path,options)=>{requests.push({path,options});return new Response('false');};
 const installation=createInstallation(()=>codeReady.promise);
 try{
  const waiting=installation.ready(new AbortController().signal);await settleRoot();assert.deepEqual(requests,[]);assert.equal(installation.loginRequired(),null);assert.equal(installation.problem(),null);
  codeReady.resolve();assert.equal(await waiting,false);assert.equal(requests.length,1);assert.equal(requests[0].options.credentials,'omit');assert.equal(requests[0].options.redirect,'error');
 }finally{installation.ngOnDestroy();globalThis.fetch=previous;}
});
test('a view retiring during error-code loading cannot cancel the other waiter or the shared read',async()=>{
 const previous=globalThis.fetch,codeReady=deferred();let reads=0;globalThis.fetch=async()=>{reads++;return new Response('true');};
 const installation=createInstallation(()=>codeReady.promise),first=new AbortController(),second=new AbortController();
 try{
  const retired=installation.ready(first.signal),active=installation.ready(second.signal);first.abort();await assert.rejects(retired,error=>error.name==='AbortError');assert.equal(reads,0);
  codeReady.resolve();assert.equal(await active,true);assert.equal(reads,1);assert.equal(installation.loginRequired(),true);
 }finally{installation.ngOnDestroy();globalThis.fetch=previous;}
});
test('destroying a document during code loading cannot start a late HTTP read or publish a new problem',async()=>{
 const previous=globalThis.fetch,codeReady=deferred();let reads=0;globalThis.fetch=async()=>{reads++;return new Response('false');};
 const installation=createInstallation(()=>codeReady.promise),pending=installation.ready(new AbortController().signal);const rejected=assert.rejects(pending,error=>error.name==='AbortError');
 try{installation.ngOnDestroy();codeReady.resolve();await rejected;assert.equal(reads,0);assert.equal(installation.problem(),null);assert.equal(installation.loginRequired(),null);}
 finally{globalThis.fetch=previous;}
});

const presenterSource=await readFile(new URL('../apps/web/src/app/native-error-presenter.service.ts',import.meta.url),'utf8');
const presenterCode=ts.transpileModule(presenterSource,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
function presenterFixture(){
 const module=deferred();let loads=0;const exports={};new Function('exports','require',presenterCode)(exports,spec=>{
  if(spec==='@angular/core')return {...rootCore,Injectable:()=>value=>value};
  if(spec.endsWith('native-system-check-installation-error')){loads++;return module.promise;}
  throw Error('Unexpected presenter dependency '+spec);
 });return{presenter:new exports.NativeErrorPresenterService(),module,get loads(){return loads;}};
}
test('concurrent code-readiness requests share one real module load and the registered capability',async()=>{
 const f=presenterFixture(),first=f.presenter.ready(),second=f.presenter.ready(),open=()=>()=>{};assert.equal(first,second);await settleRoot();assert.equal(f.loads,1);
 f.module.resolve({openNativeSystemCheckInstallationError:open});assert.equal(await first,open);assert.equal(await second,open);assert.equal(f.presenter.presenter(),open);assert.equal(await f.presenter.ready(),open);assert.equal(f.loads,1);
});
test('an already loaded routed presenter releases startup even while the import wrapper remains pending',async()=>{
 const f=presenterFixture(),pending=f.presenter.ready(),open=()=>()=>{};await settleRoot();f.presenter.register(open);assert.equal(await pending,open);assert.equal(f.presenter.presenter(),open);
 f.module.resolve({openNativeSystemCheckInstallationError:open});await settleRoot();assert.equal(f.loads,1);assert.equal(f.presenter.presenter(),open);
});
test('a late wrapper failure cannot revoke an already registered working error presenter',async()=>{
 let reject;const failed=new Promise((_resolve,fail)=>reject=fail),exports={};
 new Function('exports','require',presenterCode)(exports,spec=>spec==='@angular/core'?{...rootCore,Injectable:()=>value=>value}:failed);
 const presenter=new exports.NativeErrorPresenterService(),pending=presenter.ready(),open=()=>()=>{};presenter.register(open);assert.equal(await pending,open);reject(Error('late wrapper transport'));await settleRoot();assert.equal(await presenter.ready(),open);assert.equal(presenter.presenter(),open);
});
