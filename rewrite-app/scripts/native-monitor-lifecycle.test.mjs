import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {resolve,dirname,relative as relativePath} from 'node:path';
import {fileURLToPath} from 'node:url';
import ts from 'typescript';
import * as core from '@angular/core';
import * as rx from 'rxjs';
import * as operators from 'rxjs/operators';

// Execute the complete production classes. Only Angular rendering/DI and the
// XML parser boundary are replaced; RxJS operators and scheduling are real.
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../apps/web/src/app/native-monitor');
const cache=new Map(),bindings=new Map(),tokens=new Map();
const token=name=>{if(!tokens.has(name))tokens.set(name,class{});return tokens.get(name);};
const stubs=new Proxy({}, {get:(_,name)=>token(name)});
const shared={...stubs,CustomtextService:token('CustomtextService'),CustomtextPipe:class{transform(text){return text;}},BookletParserService:class{}};
const angular={...core,Component:()=>value=>value,Injectable:()=>value=>value,ViewChild:()=>()=>{},inject:key=>{assert.ok(bindings.has(key),'Missing test dependency '+String(key));return bindings.get(key);}};
function load(relative){
 const file=resolve(root,relative);if(cache.has(file))return cache.get(file);
 const exports={};cache.set(file,exports);
 const source=process.env.NATIVE_MONITOR_SOURCE_REV?execFileSync('git',['show',process.env.NATIVE_MONITOR_SOURCE_REV+':rewrite-app/apps/web/src/app/native-monitor/'+relativePath(root,file)],{encoding:'utf8'}):readFileSync(file,'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
 new Function('exports','require',code)(exports,spec=>{
  if(spec==='@angular/core')return angular;
  if(spec==='rxjs')return rx;
  if(spec==='rxjs/operators')return operators;
  if(spec.startsWith('@angular/'))return stubs;
  if(spec.endsWith('shared/shared.module'))return shared;
  if(spec.endsWith('booklet-parser.service'))return {BookletParserService:class{}};
  if(spec.endsWith('.component')&&!spec.endsWith('/group-monitor.component'))return stubs;
  if(spec.startsWith('.'))return load(resolve(dirname(file),spec+'.ts'));
  throw Error('Unexpected runtime import '+spec);
 });return exports;
}
const {BackendService}=load('group-monitor/backend.service.ts');
const {NativeMonitorSessionService}=load('native-session.service.ts');
const {BookletService}=load('group-monitor/booklet/booklet.service.ts');
const {TestSessionManager}=load('group-monitor/test-session-manager/test-session-manager.service.ts');
const {GROUP_MONITOR_CONFIG}=load('group-monitor/group-monitor.config.ts');
const {GroupMonitorComponent}=load('group-monitor/group-monitor.component.ts');
const settle=()=>new Promise(done=>setImmediate(done));
const deferred=()=>{let resolve,reject;const promise=new Promise((a,b)=>{resolve=a;reject=b;});return {promise,resolve,reject};};
const clock=t=>t.mock.timers.enable({apis:['setTimeout','setInterval','Date']});
function transport(){
 const controller=new AbortController(),access={token:'owned'};
 const session={access:()=>access,accessSignal:controller.signal,text:async()=>''};bindings.set(NativeMonitorSessionService,session);
 return {backend:new BackendService(),session,controller};
}
function managerFixture(){
 const controller=new AbortController(),streams=new Map(),writes=[];
 const backend={accessSignal:controller.signal,cutConnection(){},observeSessionsMonitor(group){const stream=new rx.Subject();streams.set(group,stream);return stream;},lock(group,ids){writes.push({type:'lock',group,ids});return rx.of({commandType:'lock',testIds:ids});},command(keyword,args,ids){writes.push({type:keyword,args,ids});return rx.of({commandType:keyword,testIds:ids});}};
 bindings.set(GROUP_MONITOR_CONFIG,{checkForIdleInterval:0});
 const manager=new TestSessionManager(backend,{getBooklet:()=>rx.of({error:'general',species:null})});
 const rows=(group,ids)=>streams.get(group).next(ids.map(testId=>({testId,groupName:group,personLabel:testId,bookletName:'BOOK',timestamp:Date.now()/1000,testState:{CONTROLLER:'RUNNING',CONNECTION:'POLLING'}})));
 return {backend,controller,manager,streams,writes,rows};
}
function componentFixture(){
 const params=new rx.Subject(),profiles=new Map(),connected=[],navigated=[],confirmations=new rx.Subject();let finishes=0;
 const controller=new AbortController();const backend={accessSignal:controller.signal,connectionStatus$:new rx.BehaviorSubject('initial'),getProfile(id){const stream=new rx.Subject();profiles.set(id,stream);return stream;}};
 const empty=()=>({allChecked:false,numberOfSessions:0,differentBooklets:0,differentBookletSpecies:0,pausedSessions:0,lockedSessions:0,bookletStateLabels:{}});
 const tsm={sessions$:new rx.BehaviorSubject([]),sessionsStats$:new rx.BehaviorSubject(empty()),checkedStats$:new rx.BehaviorSubject(empty()),commandResponses$:new rx.Subject(),checkingOptions:{enableAutoCheckAll:true},filterOptions:{},connect(group){connected.push(group);},disconnect(){},resetFilters(){this.filterOptions={quick:{selected:false,filter:{value:''}}};},refreshFilters(){},commandFinishEverything(){finishes++;return rx.of({commandType:'terminate',testIds:['1']});}};
 const cts={getCustomText:()=>null};bindings.set(shared.CustomtextService,cts);
 const component=new GroupMonitorComponent({}, {params},backend,tsm,{navigateByUrl:path=>{navigated.push(path);return Promise.resolve(true);}},cts,{getAccessObject:(_,group)=>({label:group}),appTitle$:new rx.BehaviorSubject('Owned'),appSubTitle$:new rx.BehaviorSubject('')},{},{},{},{showConfirmDialog:()=>confirmations});
 component.ngOnInit();
 return {component,params,profiles,connected,navigated,confirmations,controller,tsm,get finishes(){return finishes;}};
}
const profile=(settings={},filters=[])=>({settings,filters,filtersEnabled:{}});

test('a six-second snapshot survives a five-second tick; unsubscribe still aborts its replacement',async t=>{
 clock(t);const {backend,session}=transport(),requests=[],rows=[];
 session.text=(...args)=>{const wait=deferred();requests.push({signal:args[5],wait});return wait.promise;};
 const subscription=backend.observeSessionsMonitor('owned').subscribe(value=>rows.push(value));
 t.mock.timers.tick(0);assert.equal(requests.length,1);t.mock.timers.tick(6000);
 assert.equal(requests[0].signal.aborted,false);assert.equal(requests.length,1);
 requests[0].wait.resolve('[]');await settle();assert.deepEqual(rows,[[]]);assert.equal(backend.connectionStatus$.value,'polling-sleep');
 t.mock.timers.tick(4000);assert.equal(requests.length,2);subscription.unsubscribe();assert.equal(requests[1].signal.aborted,true);
});
test('snapshot failure is not a successful empty snapshot and a later tick can recover',async t=>{
 clock(t);const {backend,session}=transport(),rows=[];let count=0;
 session.text=async()=>{if(!count++)throw Error('Owned timeout');return '[]';};const sub=backend.observeSessionsMonitor('owned').subscribe(value=>rows.push(value));
 t.mock.timers.tick(0);await settle();assert.deepEqual(rows,[]);assert.equal(backend.connectionStatus$.value,'error');assert.equal(backend.problem$.value,'Owned timeout');
 t.mock.timers.tick(5000);await settle();assert.deepEqual(rows,[[]]);assert.equal(backend.problem$.value,'');sub.unsubscribe();
});
test('Booklet errors retry while successful results remain shared and scoped',async()=>{
 let count=0;const backend={cacheIdentity:{owned:1},getBooklet:()=>rx.defer(()=>{count++;return rx.of(count===1?{error:'general',species:null}:'owned XML');})};
 const service=new BookletService(backend);service.parseXml=()=>({metadata:{label:'Owned'},species:'owned'});
 assert.equal((await rx.firstValueFrom(service.getBooklet('BOOK'))).error,'general');
 const good=await rx.firstValueFrom(service.getBooklet('BOOK'));assert.equal(good.metadata.label,'Owned');
 assert.equal(await rx.firstValueFrom(service.getBooklet('BOOK')),good);assert.equal(count,2);
 backend.cacheIdentity={owned:2};await rx.firstValueFrom(service.getBooklet('BOOK'));assert.equal(count,3);
});
test('a retired access failure cannot evict the replacement Booklet request',async()=>{
 const old=new rx.Subject(),next=new rx.Subject();let count=0;const backend={cacheIdentity:{owned:1},getBooklet:()=>++count===1?old:next};
 const service=new BookletService(backend);service.parseXml=xml=>({metadata:{label:xml},species:xml});
 const first=service.getBooklet('BOOK').subscribe();backend.cacheIdentity={owned:2};const second=service.getBooklet('BOOK');const result=rx.firstValueFrom(second);
 old.next({error:'general',species:null});assert.equal(service.getBooklet('BOOK'),second);next.next('Peer');assert.equal((await result).metadata.label,'Peer');assert.equal(count,2);first.unsubscribe();
});
test('finish-all captures original int64 targets before later lock snapshots',t=>{
 clock(t);const f=managerFixture();f.manager.connect('A');f.rows('A',['9007199254740993']);
 f.manager.commandFinishEverything().subscribe();assert.deepEqual(f.writes,[{type:'lock',group:'A',ids:['9007199254740993']}]);
 f.rows('A',['9007199254740994']);t.mock.timers.tick(1500);
 assert.deepEqual(f.writes[1],{type:'terminate',args:['lock'],ids:['9007199254740993']});f.manager.disconnect();
});
for(const transition of ['group','access','disconnect'])test('finish-all cannot continue after '+transition+' transition',t=>{
 clock(t);const f=managerFixture();f.manager.connect('A');f.rows('A',['9007199254740993']);f.manager.commandFinishEverything().subscribe();
 if(transition==='group'){f.manager.connect('B');f.rows('B',['9007199254740994']);}else if(transition==='access')f.controller.abort();else f.manager.disconnect();
 t.mock.timers.tick(2000);assert.equal(f.writes.length,1,'Only the already-requested original lock may remain');assert.equal(f.writes[0].group,'A');f.manager.disconnect();
});
test('a finish observable created for a retired group cannot start a lock on later subscription',t=>{
 clock(t);const f=managerFixture();f.manager.connect('A');f.rows('A',['1']);const operation=f.manager.commandFinishEverything();f.manager.connect('B');f.rows('B',['2']);operation.subscribe();t.mock.timers.tick(2000);assert.deepEqual(f.writes,[]);f.manager.disconnect();
});
test('profiles cancel out-of-order work, replace filters and return to defaults without a profile',()=>{
 const f=componentFixture(),filter={id:'original',label:'owned',target:'personLabel',value:'alpha',type:'equal',not:false};
 f.params.next({'group-name':'A','profile-id':'old'});const old=f.profiles.get('old');f.params.next({'group-name':'B','profile-id':'new'});assert.equal(old.observed,false);
 f.profiles.get('new').next(profile({view:'small',groupColumn:'show'},[filter]));old.next(profile({view:'full'}));assert.equal(f.component.displayOptions.view,'small');assert.deepEqual(f.connected,['B']);assert.equal(f.tsm.filterOptions['profile_filter:0'].selected,true);
 f.params.next({'group-name':'B'});assert.equal(f.component.displayOptions.view,'medium');assert.equal(f.component.displayOptions.groupColumn,'hide');assert.equal(f.tsm.filterOptions['profile_filter:0'],undefined);assert.deepEqual(f.connected,['B','B']);
 f.params.next({'group-name':'A','profile-id':'last'});const last=f.profiles.get('last');f.component.ngOnDestroy();assert.equal(last.observed,false);last.next(profile({view:'full'}));assert.equal(f.component.displayOptions.view,'medium');
});
test('a profile failure leaves the group disconnected and a later route can recover',()=>{
 const f=componentFixture();f.params.next({'group-name':'A','profile-id':'bad'});f.profiles.get('bad').error(Error('Owned failure'));assert.deepEqual(f.connected,[]);assert.equal(f.component.messages.at(-1).level,'error');f.params.next({'group-name':'B'});assert.deepEqual(f.connected,['B']);f.component.ngOnDestroy();
});
test('finish returns to the actual native chooser after the existing delay',t=>{
 clock(t);const f=componentFixture();f.params.next({'group-name':'A'});f.component.finishEverythingCommand();f.confirmations.next(true);t.mock.timers.tick(1999);assert.deepEqual(f.navigated,[]);t.mock.timers.tick(1);assert.deepEqual(f.navigated,['/group-monitor']);assert.equal(f.component.isClosing,false);f.component.ngOnDestroy();
});
for(const phase of ['confirmation','navigation'])test('route change cancels stale finish '+phase,t=>{
 clock(t);const f=componentFixture();f.params.next({'group-name':'A'});f.component.finishEverythingCommand();if(phase==='navigation')f.confirmations.next(true);f.params.next({'group-name':'B'});if(phase==='confirmation')f.confirmations.next(true);t.mock.timers.tick(3000);assert.deepEqual(f.navigated,[]);assert.equal(f.finishes,phase==='confirmation'?0:1);assert.equal(f.component.isClosing,false);f.component.ngOnDestroy();
});
