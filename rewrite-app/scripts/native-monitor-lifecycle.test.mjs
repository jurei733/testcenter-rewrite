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
bindings.set(core.ViewContainerRef,{owned:'monitor view'});
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
const finishPlans=new WeakMap();
function managerFixture(controller=new AbortController()){
 const streams=new Map(),writes=[];if(!finishPlans.has(controller))finishPlans.set(controller,new Map());const plans=finishPlans.get(controller);
 const backend={accessSignal:controller.signal,pendingFinishTargets:group=>plans.get(group)??[],rememberFinishTargets:(group,ids)=>plans.set(group,ids),getSessionsMonitor(){return rx.of(manager.sessions.map(row=>row.data));},cutConnection(){},observeSessionsMonitor(group){const stream=new rx.Subject();streams.set(group,stream);return stream;},lock(group,ids){writes.push({type:'lock',group,ids});return rx.of({commandType:'lock',testIds:ids});},command(keyword,args,ids){writes.push({type:keyword,args,ids});return rx.of({commandType:keyword,testIds:ids});}};
 bindings.set(GROUP_MONITOR_CONFIG,{checkForIdleInterval:0});
 const manager=new TestSessionManager(backend,{getBooklet:()=>rx.of({error:'general',species:null})});
 const rows=(group,ids)=>streams.get(group).next(ids.map(testId=>({testId,groupName:group,personLabel:testId,bookletName:'BOOK',timestamp:Date.now()/1000,testState:{CONTROLLER:'RUNNING',CONNECTION:'POLLING'}})));
 return {backend,controller,manager,streams,writes,rows};
}
function componentFixture(){
 const params=new rx.Subject(),profiles=new Map(),connected=[],navigated=[],confirmations=new rx.Subject(),gotoDialog=new rx.Subject(),gotos=[];let finishes=0,dialogRenders=0;
 const controller=new AbortController();const backend={accessSignal:controller.signal,connectionStatus$:new rx.BehaviorSubject('initial'),getProfile(id){const stream=new rx.Subject();profiles.set(id,stream);return stream;}};
 const empty=()=>({allChecked:false,numberOfSessions:0,differentBooklets:0,differentBookletSpecies:0,pausedSessions:0,lockedSessions:0,bookletStateLabels:{}});
 const tsm={checked:[],getMaxTimeAcrossAllSessions:()=>10,testCommandGoto(selection,time,targets){gotos.push({selection,time,targets});return rx.of(true);},sessions$:new rx.BehaviorSubject([]),sessionsStats$:new rx.BehaviorSubject(empty()),checkedStats$:new rx.BehaviorSubject(empty()),commandResponses$:new rx.Subject(),checkingOptions:{enableAutoCheckAll:true},filterOptions:{},connect(group){connected.push(group);},disconnect(){},resetFilters(){this.filterOptions={quick:{selected:false,filter:{value:''}}};},refreshFilters(){},commandFinishEverything(){finishes++;return rx.of({commandType:'terminate',testIds:['1']});}};
 const filterDialog=new rx.Subject(),filterOpen=[];let filterCloses=0;const filterOverlay={open:(component,config)=>{filterOpen.push(config);return {afterClosed:()=>filterDialog,close:()=>{filterCloses++;}};}};
 const cts={getCustomText:()=>null};bindings.set(shared.CustomtextService,cts);
 const component=new GroupMonitorComponent({open:()=>({afterClosed:()=>gotoDialog,componentRef:{changeDetectorRef:{detectChanges(){dialogRenders++;}}}})}, {params},backend,tsm,{navigateByUrl:path=>{navigated.push(path);return Promise.resolve(true);}},cts,{getAccessObject:(_,group)=>({label:group}),appTitle$:new rx.BehaviorSubject('Owned'),appSubTitle$:new rx.BehaviorSubject('')},filterOverlay,{},{},{showConfirmDialog:()=>confirmations});
 component.ngOnInit();
 return {component,params,profiles,connected,navigated,confirmations,controller,tsm,gotoDialog,gotos,filterDialog,filterOpen,get dialogRenders(){return dialogRenders;},get filterCloses(){return filterCloses;},get finishes(){return finishes;}};
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
 let count=0;const backend={cacheIdentity:{owned:1},accessSignal:new AbortController().signal,connectionClosed$:new rx.Subject(),getBooklet:()=>rx.defer(()=>{count++;return rx.of(count===1?{error:'general',species:null}:'owned XML');})};
 const service=new BookletService(backend);service.parseXml=()=>({metadata:{label:'Owned'},species:'owned'});
 assert.equal((await rx.firstValueFrom(service.getBooklet('BOOK'))).error,'general');
 const good=await rx.firstValueFrom(service.getBooklet('BOOK'));assert.equal(good.metadata.label,'Owned');
 assert.equal(await rx.firstValueFrom(service.getBooklet('BOOK')),good);assert.equal(count,2);
 backend.cacheIdentity={owned:2};await rx.firstValueFrom(service.getBooklet('BOOK'));assert.equal(count,3);
});
test('a retired access failure cannot evict the replacement Booklet request',async()=>{
 const old=new rx.Subject(),next=new rx.Subject();let count=0;const backend={cacheIdentity:{owned:1},accessSignal:new AbortController().signal,connectionClosed$:new rx.Subject(),getBooklet:()=>++count===1?old:next};
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
function selectGoto(f){
 const row={data:{testId:'9007199254740993'},booklet:{},timeLeft:{B1:0}};
 f.tsm.checked=[row];f.component.currentlySelected={element:{id:'B1',blockId:'B1'},originSession:row,nthClick:'first',inversion:false};
 return {row,selection:f.component.currentlySelected};
}
for(const transition of ['route','access','destroy','selection','targets'])test('Goto rejects a stale '+transition+' confirmation',()=>{
 const f=componentFixture();f.params.next({'group-name':'A'});selectGoto(f);f.component.testCommandGoto();
 if(transition==='route'){f.params.next({'group-name':'B'});selectGoto(f);f.tsm.checked[0].data.testId='9007199254740994';}
 else if(transition==='access')f.controller.abort();
 else if(transition==='destroy')f.component.ngOnDestroy();
 else if(transition==='selection')f.component.currentlySelected={...f.component.currentlySelected};
 else f.tsm.checked=[{...f.tsm.checked[0],data:{testId:'9007199254740994'}}];
 f.gotoDialog.next(7);assert.deepEqual(f.gotos,[]);if(transition!=='destroy')f.component.ngOnDestroy();
});
test('Goto sends only the originally confirmed rows and retains their exact numeric identities',()=>{
 const f=componentFixture();f.params.next({'group-name':'A'});const {row,selection}=selectGoto(f);const targets=f.tsm.checked;f.component.testCommandGoto();
 f.tsm.checked=[{...row}];f.gotoDialog.next(7);assert.equal(f.gotos.length,1);assert.equal(f.gotos[0].targets,targets);assert.equal(f.gotos[0].selection,selection);assert.equal(f.gotos[0].time,7);assert.equal(f.gotos[0].targets[0].data.testId,'9007199254740993');f.component.ngOnDestroy();
});
test('a Booklet read survives repeated snapshots, but an unfinished replacement aborts and retries after disconnect',async t=>{
 clock(t);const {backend,session}=transport(),requests=[],snapshots=new rx.Subject();
 session.text=(...args)=>{const wait=deferred();requests.push({signal:args[5],wait});return wait.promise;};backend.observeSessionsMonitor=()=>snapshots;
 const material=new BookletService(backend);material.parseXml=()=>({metadata:{label:'Owned slow'},species:'owned',states:{}});
 bindings.set(GROUP_MONITOR_CONFIG,{checkForIdleInterval:0});const manager=new TestSessionManager(backend,material);
 const packet={testId:'9007199254740993',personLabel:'Owned',bookletName:'BOOK',testState:{CONNECTION:'POLLING'},timestamp:1};
 manager.connect('A');snapshots.next([packet]);assert.equal(requests.length,1);t.mock.timers.tick(5000);snapshots.next([{...packet,timestamp:2}]);
 assert.equal(requests.length,1);assert.equal(requests[0].signal.aborted,false);t.mock.timers.tick(1000);requests[0].wait.resolve('Owned XML');await settle();assert.equal(manager.sessions.length,1);assert.equal(manager.sessions[0].data.timestamp,2);
 snapshots.next([{...packet,bookletName:'LATE'}]);assert.equal(requests.length,2);manager.disconnect();assert.equal(requests[1].signal.aborted,true);
 manager.connect('A');snapshots.next([{...packet,bookletName:'LATE'}]);assert.equal(requests.length,3);requests[1].wait.resolve('Retired XML');requests[2].wait.resolve('Current XML');await settle();assert.equal(manager.sessions.length,1);manager.disconnect();
});
test('access invalidation cancels an in-flight shared material request even with no current snapshot subscriber',async()=>{
 const {backend,session,controller}=transport(),wait=deferred();let signal;
 session.text=(...args)=>{signal=args[5];return wait.promise;};const service=new BookletService(backend);service.parseXml=()=>({species:'owned'});
 const subscription=service.getBooklet('BOOK').subscribe();subscription.unsubscribe();assert.equal(signal.aborted,false);controller.abort();assert.equal(signal.aborted,true);wait.resolve('Old XML');await settle();
});
test('mixed, missing and obsolete Booklet-state values sort without killing the live monitor',()=>{
 const f=managerFixture();const state={id:'route',label:'Route',default:'a',options:{a:{label:'Alpha'},b:{label:'Beta'}}};
 const row=(id,states,values)=>({data:{testId:id},booklet:{states,species:'owned'},bookletStates:values});
 const rows=[row('1',{route:state},{route:'b'}),row('2',{},{}),row('3',{route:state},{}),row('4',{route:state},{route:'obsolete'})];
 const sorted=f.manager.sortSessions({active:'bookletState:route',direction:'asc'},rows);assert.deepEqual(sorted.map(x=>x.data.testId),['3','1','2','4']);
 // Use the real production stats/filter/sort subscription with absent states.
 const material={getBooklet:name=>rx.of({metadata:{label:name},species:'owned',states:name==='A'?{route:state}:{}})};
 const manager=new TestSessionManager(f.backend,material);manager.connect('mixed');manager.sortBy$.next({active:'bookletState:route',direction:'asc'});
 const packet=(id,name,values)=>({testId:id,bookletName:name,personLabel:id,timestamp:1,testState:{BOOKLET_STATES:JSON.stringify(values)}});
 f.streams.get('mixed').next([packet('1','A',{route:'b'}),packet('2','B',{})]);assert.equal(manager.sessions.length,2);
 f.streams.get('mixed').next([packet('1','A',{route:'obsolete'}),packet('2','B',{}),packet('3','A',{})]);assert.equal(manager.sessions.length,3);assert.equal(manager.sessions[0].data.testId,'3');manager.disconnect();
});
test('finish locks materialized pending tests but never sends terminate to pending or nonpositive IDs',t=>{
 clock(t);const f=managerFixture();f.manager.connect('A');
 f.streams.get('A').next([
  {testId:'9007199254740993',personLabel:'Running',bookletName:'BOOK',testState:{status:'running',CONNECTION:'POLLING'},timestamp:1},
  {testId:'9007199254740994',personLabel:'Pending',bookletName:'BOOK',testState:{status:'pending'},timestamp:1},
  {testId:'0',personLabel:'Ghost',bookletName:'BOOK',testState:{status:'pending'},timestamp:1}
 ]);
 f.manager.commandFinishEverything().subscribe();assert.deepEqual(f.writes[0].ids,['9007199254740994','9007199254740993']);t.mock.timers.tick(1500);assert.deepEqual(f.writes[1].ids,['9007199254740993']);f.manager.disconnect();
});
test('the actual Goto producer uses captured targets and cannot start after its group was retired',()=>{
 const f=managerFixture();f.manager.connect('A');
 const block={id:'B1',blockId:'B1',restrictions:{},children:[{id:'UNIT',alias:'owned-target',label:'Owned'}]};
 const row=id=>({data:{testId:id,bookletName:'BOOK'},booklet:{species:'owned',states:{},units:{children:[block]}},timeLeft:{B1:0}});
 const a=row('9007199254740993'),b=row('9007199254740994'),selection={element:block};
 f.manager._checked={other:b};f.manager.testCommandGoto(selection,7,[a]).subscribe();assert.deepEqual(f.writes[0],{type:'goto',args:['id','owned-target','| closed timeblock reopened - new remaining time 7'],ids:['9007199254740993']});
 f.writes.length=0;const pending=f.manager.testCommandGoto(selection,7,[a]);f.manager.connect('B');pending.subscribe();assert.deepEqual(f.writes,[]);f.manager.disconnect();
});
for(const action of ['Pause','Resume','Unlock'])for(const transition of ['group','access'])test(action+' cannot outlive its '+transition+' context',()=>{
 const f=managerFixture(),pending=new rx.Subject();f.backend.command=()=>pending;f.backend.unlock=()=>pending;f.manager.connect('A');
 f.streams.get('A').next([{testId:'1',personLabel:'Owned',bookletName:'BOOK',timestamp:1,testState:{status:action==='Unlock'?'locked':'running',CONNECTION:'POLLING',CONTROLLER:'RUNNING'}}]);
 f.manager['testCommand'+action]();assert.equal(pending.observed,true);
 if(transition==='group')f.manager.connect('B');else f.controller.abort();assert.equal(pending.observed,false);f.manager.disconnect();
});
test('a failed immediate command reports its error without an unhandled subscription failure',async()=>{
 const {backend,session}=transport(),snapshots=new rx.Subject();backend.observeSessionsMonitor=()=>snapshots;
 session.text=async()=>{throw Error('Owned visible failure');};bindings.set(GROUP_MONITOR_CONFIG,{checkForIdleInterval:0});
 const manager=new TestSessionManager(backend,{getBooklet:()=>rx.of({error:'general',species:null})});manager.connect('A');snapshots.next([{testId:'1',personLabel:'Owned',bookletName:'BOOK',timestamp:1,testState:{status:'running',CONNECTION:'POLLING',CONTROLLER:'RUNNING'}}]);manager.testCommandPause();await settle();assert.equal(backend.problem$.value,'Owned visible failure');manager.disconnect();assert.equal(backend.problem$.value,'');
});

// Preset names are Test identities, not physical material IDs. Keep access and
// connection cancellation while coalescing all presets of the same material.
test('preset material reads use the native physical file ID without dropping the Test name',async()=>{
 const {backend,session}=transport(),requests=[];session.text=async(method,path)=>{requests.push(path);return 'owned XML';};
 const presets=['BOOK#route:first',' B O O K #route:last','BOOK#0','BOOK'];
 for(const name of presets)assert.equal(await rx.firstValueFrom(backend.getBooklet(name)),'owned XML');
 assert.deepEqual(requests,presets.map(()=>'/booklet/BOOK'));
});
test('different native presets share one scoped material request',async()=>{
 const material=new rx.Subject(),materialRequests=[];let reads=0;const backend={cacheIdentity:{owned:1},accessSignal:new AbortController().signal,connectionClosed$:new rx.Subject(),getBooklet:name=>{reads++;materialRequests.push(name);return material;}};
 const service=new BookletService(backend);service.parseXml=()=>({metadata:{label:'Owned'},species:'owned'});
 const a=rx.firstValueFrom(service.getBooklet('BOOK#route:first')),b=rx.firstValueFrom(service.getBooklet('BOOK#route:last'));
 material.next('owned XML');const [first,second]=await Promise.all([a,b]);assert.equal(reads,1);assert.deepEqual(materialRequests,['BOOK']);assert.equal(first,second);
 assert.equal((await rx.firstValueFrom(service.getBooklet('BOOK'))).metadata.label,'Owned');assert.equal(reads,1);
});
test('filter overlays receive the actual monitor view injector and save one completed filter',()=>{
 const f=componentFixture();f.params.next({'group-name':'A'});f.component.addFilter();
 assert.equal(f.filterOpen[0].viewContainerRef,bindings.get(core.ViewContainerRef));
 const filter={id:'owned',label:'Owned',target:'personLabel',value:'alpha',not:false,type:'equal'};f.filterDialog.next(filter);
 assert.deepEqual(f.tsm.filterOptions.owned,{selected:true,filter,source:'custom'});assert.equal(f.filterCloses,1);f.component.ngOnDestroy();
});
for(const transition of ['route','access','destroy'])test('filter completion cannot write into a retired '+transition+' context',()=>{
 const f=componentFixture();f.params.next({'group-name':'A'});f.component.addFilter();
 if(transition==='route')f.params.next({'group-name':'B'});else if(transition==='access')f.controller.abort();else f.component.ngOnDestroy();
 assert.equal(f.filterDialog.observed,false);assert.equal(f.filterCloses,1);
 f.filterDialog.next({id:'stale',label:'Stale',target:'personLabel',value:'alpha',not:false,type:'equal'});assert.equal(f.tsm.filterOptions.stale,undefined);if(transition!=='destroy')f.component.ngOnDestroy();
});

const finishPacket=(id,state={})=>({testId:id,groupName:'A',personLabel:id,bookletName:'BOOK',timestamp:1,testState:{CONTROLLER:'RUNNING',CONNECTION:'POLLING',...state}});
test('finish before first render waits for a fresh complete snapshot and uses its exact int64 targets',t=>{
 clock(t);const f=managerFixture(),fresh=new rx.Subject();f.manager.connect('A');let reads=0;f.backend.getSessionsMonitor=group=>{assert.equal(group,'A');reads++;return fresh;};
 f.manager.commandFinishEverything().subscribe();assert.equal(reads,1);assert.deepEqual(f.writes,[]);
 fresh.next([finishPacket('9007199254740993'),finishPacket('9007199254740994',{status:'pending'}),finishPacket('0',{status:'pending'})]);
 assert.deepEqual(f.writes,[{type:'lock',group:'A',ids:['9007199254740993','9007199254740994']}]);
 t.mock.timers.tick(1500);assert.deepEqual(f.writes[1],{type:'terminate',args:['lock'],ids:['9007199254740993']});f.manager.disconnect();
});
test('finish gets current native targets independently of stale rendered material',t=>{
 clock(t);const f=managerFixture();f.manager.connect('A');f.rows('A',['9007199254740993']);
 f.backend.getSessionsMonitor=()=>rx.of([finishPacket('9007199254740994')]);f.manager.commandFinishEverything().subscribe();
 assert.deepEqual(f.writes[0],{type:'lock',group:'A',ids:['9007199254740994']});t.mock.timers.tick(1500);assert.deepEqual(f.writes[1].ids,['9007199254740994']);f.manager.disconnect();
});
test('a failed finish snapshot never writes stale targets or reports successful completion',t=>{
 clock(t);const f=managerFixture();f.manager.connect('A');f.rows('A',['9007199254740993']);const failure=Error('Owned fresh snapshot failed');f.backend.getSessionsMonitor=()=>rx.throwError(()=>failure);let seen,success=false;
 f.manager.commandFinishEverything().subscribe({next:()=>{success=true;},error:error=>{seen=error;}});t.mock.timers.tick(2000);assert.equal(seen,failure);assert.equal(success,false);assert.deepEqual(f.writes,[]);f.manager.disconnect();
});
for(const transition of ['group','access','disconnect'])test('finish pending snapshot cannot outlive '+transition+' context',t=>{
 clock(t);const f=managerFixture(),fresh=new rx.Subject();f.manager.connect('A');f.backend.getSessionsMonitor=()=>fresh;f.manager.commandFinishEverything().subscribe();assert.equal(fresh.observed,true);
 if(transition==='group')f.manager.connect('B');else if(transition==='access')f.controller.abort();else f.manager.disconnect();
 assert.equal(fresh.observed,false);fresh.next([finishPacket('9007199254740993')]);t.mock.timers.tick(2000);assert.deepEqual(f.writes,[]);f.manager.disconnect();
});

test('Goto initializes the real form view before exposing its confirmation stream',()=>{
 const f=componentFixture();f.params.next({'group-name':'A'});selectGoto(f);f.component.testCommandGoto();assert.equal(f.dialogRenders,1);assert.equal(f.gotoDialog.observed,true);f.component.ngOnDestroy();
});

for(const stage of ['lock','terminate'])test('finish retries exact owned targets after a lost '+stage+' response',t=>{
 clock(t);const f=managerFixture();f.manager.connect('A');
 let rows=[finishPacket('9007199254740993'),finishPacket('9007199254740994',{status:'locked'})];
 f.backend.getSessionsMonitor=()=>rx.of(rows);const failure=Error('Owned '+stage+' failure');let first=true;
 const write=f.backend[stage==='lock'?'lock':'command'];f.backend[stage==='lock'?'lock':'command']=function(...args){
  const result=write.apply(this,args);if(first){first=false;return rx.throwError(()=>failure);}return result;
 };
 let seen,completed=false;f.manager.commandFinishEverything().subscribe({next:()=>{completed=true;},error:error=>{seen=error;}});
 t.mock.timers.tick(1500);assert.equal(seen,failure);assert.equal(completed,false);
 rows=rows.map(row=>({...row,testState:{...row.testState,status:'locked'}}));
 f.manager.commandFinishEverything().subscribe({next:()=>{completed=true;}});assert.equal(completed,false);t.mock.timers.tick(1500);
 assert.equal(completed,true);assert.deepEqual(f.writes.at(-1),{type:'terminate',args:['lock'],ids:['9007199254740993']});f.manager.disconnect();
});
test('an interrupted finish retains its exact targets across manager retirement in the same access',t=>{
 clock(t);const f=managerFixture();f.manager.connect('A');f.backend.getSessionsMonitor=()=>rx.of([finishPacket('9007199254740993')]);
 const sub=f.manager.commandFinishEverything().subscribe();sub.unsubscribe();f.manager.disconnect();t.mock.timers.tick(2000);assert.equal(f.writes.length,1);
 const next=managerFixture(f.controller);next.manager.connect('A');next.backend.getSessionsMonitor=()=>rx.of([finishPacket('9007199254740993',{status:'locked'}),finishPacket('9007199254740994',{status:'locked'})]);
 next.manager.commandFinishEverything().subscribe();t.mock.timers.tick(1500);assert.deepEqual(next.writes.at(-1).ids,['9007199254740993']);next.manager.disconnect();
});
test('a finish recovery plan cannot cross a native access replacement',t=>{
 clock(t);const old=managerFixture();old.manager.connect('A');old.backend.getSessionsMonitor=()=>rx.of([finishPacket('9007199254740993')]);old.manager.commandFinishEverything().subscribe();old.controller.abort();old.manager.disconnect();
 const next=managerFixture();next.manager.connect('A');next.backend.getSessionsMonitor=()=>rx.of([finishPacket('9007199254740993',{status:'locked'})]);next.manager.commandFinishEverything().subscribe();t.mock.timers.tick(1500);assert.deepEqual(next.writes.at(-1).ids,[]);assert.equal(old.writes.length,1);next.manager.disconnect();
});
test('recovery excludes targets now terminated or pending and never broadens to unrelated locked tests',t=>{
 clock(t);const f=managerFixture();f.manager.connect('A');f.backend.getSessionsMonitor=()=>rx.of([finishPacket('1'),finishPacket('2')]);const sub=f.manager.commandFinishEverything().subscribe();sub.unsubscribe();
 f.backend.getSessionsMonitor=()=>rx.of([finishPacket('1',{status:'locked',CONTROLLER:'TERMINATED'}),finishPacket('2',{status:'pending'}),finishPacket('3',{status:'locked'})]);
 f.manager.commandFinishEverything().subscribe();t.mock.timers.tick(1500);assert.deepEqual(f.writes.at(-1).ids,[]);f.manager.disconnect();
});

test('finish retains the Original connected TERMINATED_PAUSED target semantics',t=>{
 clock(t);const f=managerFixture();f.manager.connect('A');f.backend.getSessionsMonitor=()=>rx.of([finishPacket('1',{CONTROLLER:'TERMINATED_PAUSED'})]);
 f.manager.commandFinishEverything().subscribe();t.mock.timers.tick(1500);assert.deepEqual(f.writes.at(-1).ids,['1']);f.manager.disconnect();
});
