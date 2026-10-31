import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import ts from 'typescript';
import * as core from '@angular/core';
import * as rx from 'rxjs';
const tokens=new Map(),names=new Map();let bindings;
const imports=new Proxy({}, {get:(_,name)=>{if(!tokens.has(name)){const value=class{};tokens.set(name,value);names.set(value,name);}return tokens.get(name);}});
function load(relative){
 const source=process.env.NATIVE_MONITOR_ENTRY_SOURCE_REV?execFileSync('git',['show',process.env.NATIVE_MONITOR_ENTRY_SOURCE_REV+':rewrite-app/apps/web/src/app/native-monitor/'+relative],{encoding:'utf8'}):readFileSync(new URL('../apps/web/src/app/native-monitor/'+relative,import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
 const exports={};new Function('exports','require',code)(exports,spec=>spec==='@angular/core'?{...core,Component:()=>value=>value,Injectable:()=>value=>value,inject:key=>{const name=names.get(key)??key.name;assert.ok(bindings.has(name),'Missing dependency '+name);return bindings.get(name);}}:spec==='rxjs'?rx:imports);return exports;
}
const {NativeMonitorEntryComponent}=load('native-monitor-entry.component.ts');
const {HeaderService}=load('shared/services/header.service.ts');
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const settle=()=>new Promise(done=>setImmediate(done));
const access=token=>({token,claims:{testGroupMonitor:[{id:'owned',flags:[]}]}});
function fixture(){
 const route={firstChild:null},nav=[],events=new rx.Subject(),closed=new rx.Subject(),problem$=new rx.BehaviorSubject(''),calls=[];let scope=new AbortController(),closes=0,marks=0;
 const session={access:core.signal(access('original')),busy:core.signal(false),problem:core.signal(''),get accessSignal(){return scope.signal;},login:async()=>session.access(),refresh:async()=>{},logout:()=>{calls.push('logout');replace(null);return Promise.resolve();}};
 const replace=value=>{const old=scope;scope=new AbortController();session.access.set(value);old.abort();};
 bindings=new Map(Object.entries({NativeMonitorSessionService:session,ApplicationSettingsService:{settings:()=>({appTitle:'Owned'})},HeaderService:{},BackendService:{problem$},ChangeDetectorRef:{markForCheck(){marks++;}},Router:{events,navigate:async path=>{nav.push(path);return true;}},ActivatedRoute:route,MatDialog:{open:()=>({afterClosed:()=>closed,close:()=>{closes++;}})},InterfaceModeService:{select(){}},MainDataService:{appTitle$:new rx.BehaviorSubject('')}}));
 const header=new HeaderService();bindings.set('HeaderService',header);
 const component=new NativeMonitorEntryComponent();component.name='owned';return {component,header,route,session,nav,events,closed,calls,replace,problem$,get marks(){return marks;},get closes(){return closes;}};
}
test('monitor route changes notify the retained chooser view and stop notifying after view retirement',()=>{
 const f=fixture();assert.equal(f.component.allowedChild,false);monitorRoute(f);f.events.next(new imports.NavigationEnd());assert.equal(f.component.allowedChild,true);assert.equal(f.marks,1);
 f.component.ngOnDestroy();assert.equal(f.events.observed,false);f.events.next(new imports.NavigationEnd());assert.equal(f.marks,1);
});
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

function monitorRoute(f,group='owned'){f.route.firstChild={snapshot:{paramMap:new Map([['group-name',group]])}};}
test('retired access clears the private header even on the retained group route',()=>{
 const f=fixture();monitorRoute(f);f.header.title='Private group A';assert.equal(f.header.title,'Private group A');
 // Pinned Source LoginComponent restores the public 'Anmelden' heading.
 f.replace(null);assert.equal(f.header.title,'');assert.equal(f.component.headerTitle,'Anmelden');f.component.ngOnDestroy();
});
for(const sameToken of [false,true])test('a replacement access cannot display the previous header with '+(sameToken?'the same':'another')+' token',()=>{
 const f=fixture();monitorRoute(f);f.header.title='Private group A';f.replace(access(sameToken?'original':'replacement'));
 assert.equal(f.header.title,'');assert.equal(f.component.headerTitle,'Owned');f.header.title='Current group B';assert.equal(f.component.headerTitle,'Current group B');f.component.ngOnDestroy();
});
test('a new scope invalidates the old header even if its access object is retained',()=>{
 const f=fixture();monitorRoute(f);f.header.title='Private group A';f.replace(f.session.access());assert.equal(f.header.title,'');assert.equal(f.component.headerTitle,'Owned');f.component.ngOnDestroy();
});
test('an unauthorized child route shows only the public application title',()=>{
 const f=fixture();f.header.title='Private authorized group';monitorRoute(f,'forbidden');assert.equal(f.component.headerTitle,'Owned');f.component.ngOnDestroy();
});

test('a fresh sole monitor claim still enters the Source Starter instead of auto-opening the Monitor',async()=>{
 const f=fixture();await f.component.submit();assert.deepEqual(f.nav,[['/group-monitor']]);assert.equal(f.component.headerTitle,'Übersicht');assert.equal(f.component.showAccountPanel,true);f.component.ngOnDestroy();
});
test('the account panel belongs to the Starter and is absent from an authorized Monitor child',()=>{
 const f=fixture();assert.equal(f.component.showAccountPanel,true);monitorRoute(f);assert.equal(f.component.showAccountPanel,false);monitorRoute(f,'forbidden');assert.equal(f.component.showAccountPanel,true);f.replace(null);assert.equal(f.component.showAccountPanel,false);f.component.ngOnDestroy();
});
test('a failed current Starter refresh hides stale actions and explicit retry recovers',async()=>{
 const f=fixture();f.session.refresh=async()=>{throw Error('owned refresh unavailable');};await f.component.refreshStarter();assert.equal(f.component.starterRefreshing(),false);assert.equal(f.component.starterRefreshFailed(),true);assert.equal(f.component.problem(),'owned refresh unavailable');assert.ok(f.session.access());f.session.refresh=async()=>{};await f.component.refreshStarter();assert.equal(f.component.starterRefreshFailed(),false);assert.equal(f.component.problem(),'');f.component.ngOnDestroy();
});
test('an older refresh cannot publish errors or finish a replacement actors pending refresh',async()=>{
 const f=fixture(),old=deferred(),next=deferred();f.session.refresh=()=>old.promise;const pending=f.component.refreshStarter();f.replace(access('replacement'));f.session.refresh=()=>next.promise;const current=f.component.refreshStarter();old.reject(Error('old private error'));await pending;assert.equal(f.component.starterRefreshing(),true);assert.equal(f.component.problem(),'');assert.equal(f.component.starterRefreshFailed(),false);next.resolve();await current;assert.equal(f.component.starterRefreshing(),false);assert.equal(f.session.access().token,'replacement');f.component.ngOnDestroy();
});
test('a retired entry cannot publish an outstanding Starter refresh error',async()=>{
 const f=fixture(),pending=deferred();f.session.refresh=()=>pending.promise;const refresh=f.component.refreshStarter();f.component.ngOnDestroy();pending.reject(Error('retired refresh'));await refresh;assert.equal(f.component.problem(),'');assert.equal(f.component.starterRefreshFailed(),false);
});
