import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import * as core from '@angular/core';
import * as rx from 'rxjs';
const tokens=new Map(),names=new Map();let bindings;
const imports=new Proxy({}, {get:(_,name)=>{if(!tokens.has(name)){const value=class{};tokens.set(name,value);names.set(value,name);}return tokens.get(name);}});
const source=process.env.NATIVE_MONITOR_ENTRY_SOURCE_REV?execFileSync('git',['show',process.env.NATIVE_MONITOR_ENTRY_SOURCE_REV+':rewrite-app/apps/web/src/app/native-monitor/native-monitor-entry.component.ts'],{encoding:'utf8'}):readFileSync(new URL('../apps/web/src/app/native-monitor/native-monitor-entry.component.ts',import.meta.url),'utf8');
const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
const exports={};new Function('exports','require',code)(exports,spec=>spec==='@angular/core'?{...core,Component:()=>value=>value,inject:key=>{const name=names.get(key);assert.ok(bindings.has(name),'Missing dependency '+name);return bindings.get(name);}}:spec==='rxjs'?rx:imports);
const {NativeMonitorEntryComponent}=exports;
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const settle=()=>new Promise(done=>setImmediate(done));
const access=token=>({token,claims:{testGroupMonitor:[{id:'owned',flags:[]}]}});
function fixture(){
 const nav=[],closed=new rx.Subject(),problem$=new rx.BehaviorSubject(''),calls=[];let scope=new AbortController(),closes=0;
 const session={access:core.signal(access('original')),busy:core.signal(false),problem:core.signal(''),get accessSignal(){return scope.signal;},login:async()=>session.access(),logout:()=>{calls.push('logout');replace(null);return Promise.resolve();}};
 const replace=value=>{const old=scope;scope=new AbortController();session.access.set(value);old.abort();};
 bindings=new Map(Object.entries({NativeMonitorSessionService:session,ApplicationSettingsService:{settings:()=>({appTitle:'Owned'})},HeaderService:{},BackendService:{problem$},Router:{navigate:async path=>{nav.push(path);return true;}},ActivatedRoute:{firstChild:null},MatDialog:{open:()=>({afterClosed:()=>closed,close:()=>{closes++;}})},InterfaceModeService:{select(){}},MainDataService:{appTitle$:new rx.BehaviorSubject('')}}));
 const component=new NativeMonitorEntryComponent();component.name='owned';return {component,session,nav,closed,calls,replace,problem$,get closes(){return closes;}};
}
test('retiring the entry cancels its login owner and cannot open a late sole claim',async()=>{
 const f=fixture(),pending=deferred();let owner;f.session.login=(_name,_password,signal)=>{owner=signal;return pending.promise;};
 const submitting=f.component.submit();f.component.ngOnDestroy();pending.resolve(access('late'));await submitting;
 assert.equal(owner?.aborted,true);assert.deepEqual(f.nav,[]);assert.equal(f.problem$.observed,false);
});
test('a late login rejection cannot rewrite a destroyed entry form',async()=>{
 const f=fixture(),pending=deferred();f.session.login=()=>pending.promise;f.component.password='owned password';const submitting=f.component.submit();f.component.ngOnDestroy();pending.reject(Error('late'));await submitting;assert.equal(f.component.problem(),'');assert.equal(f.component.password,'owned password');
});
for(const transition of ['access','destroy'])test('logout confirmation is closed and retired on '+transition,()=>{
 const f=fixture();f.component.logout();assert.equal(f.closed.observed,true);
 if(transition==='access')f.replace(access('replacement'));else f.component.ngOnDestroy();
 assert.equal(f.closed.observed,false);assert.equal(f.closes,1);f.closed.next(true);assert.deepEqual(f.calls,[]);assert.deepEqual(f.nav,[]);if(transition!=='destroy')f.component.ngOnDestroy();
});
test('confirmed logout keeps normal chooser navigation for the same retired access',async()=>{
 const f=fixture();f.component.logout();f.closed.next(true);f.closed.complete();await settle();assert.deepEqual(f.calls,['logout']);assert.deepEqual(f.nav,[['/group-monitor']]);assert.equal(f.closed.observed,false);f.component.ngOnDestroy();
});
for(const outcome of ['success','failure'])test('an old logout '+outcome+' cannot navigate or set errors in a replacement session',async()=>{
 const f=fixture(),pending=deferred();f.session.logout=()=>{f.calls.push('logout');f.replace(null);return pending.promise;};
 f.component.logout();f.closed.next(true);f.closed.complete();f.replace(access('replacement'));if(outcome==='success')pending.resolve();else pending.reject(Error('old logout failed'));await settle();
 assert.equal(f.session.access().token,'replacement');assert.deepEqual(f.nav,[]);assert.equal(f.component.problem(),'');f.component.ngOnDestroy();
});

test('replacement-login cancellation is silent even while the same entry view remains alive',async()=>{
 const f=fixture(),pending=deferred();f.session.login=()=>pending.promise;const submitting=f.component.submit();f.replace(access('replacement'));pending.reject(new DOMException('retired login','AbortError'));await submitting;
 assert.equal(f.component.problem(),'');assert.deepEqual(f.nav,[]);assert.equal(f.session.access().token,'replacement');f.component.ngOnDestroy();
});
