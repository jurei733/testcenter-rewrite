import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {readFileSync} from 'node:fs';
import {resolve,dirname} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const app=fileURLToPath(new URL('..',import.meta.url));
const root=resolve(app,'apps/web/src/app/native-participant');
const require=createRequire(resolve(app,'package.json')),ts=require('typescript'),rx=require('rxjs'),ops=require('rxjs/operators');
await import(pathToFileURL(require.resolve('@angular/compiler')).href);
const {signal}=await import(pathToFileURL(require.resolve('@angular/core')).href);
const http=await import(pathToFileURL(require.resolve('@angular/common/http')).href);
class MaterialDialog{}class MaterialSnack{}class OwnedEnvironment{}class OwnedDocument{}
const bindings=new Map(),cache=new Map();class Session{}class Tcs{}class HttpError extends Error{constructor(status,body){super(body);this.status=status;this.body=body;}}
const navigationTypes={NavigationEnd:class{constructor(id){this.id=id;}},NavigationCancel:class{constructor(id){this.id=id;}},NavigationError:class{constructor(id){this.id=id;}}};
const angular={signal,EnvironmentInjector:OwnedEnvironment,Injectable:()=>value=>value,InjectionToken:class{constructor(name){this.name=name;}},inject:key=>{assert.ok(bindings.has(key),'missing '+String(key?.name));return bindings.get(key);}};
function load(file){
 file=resolve(root,file);if(cache.has(file))return cache.get(file);const exports={};cache.set(file,exports);
 const source=file.endsWith('/native-owned-router.ts')&&process.env.NATIVE_PARTICIPANT_ROUTER_SOURCE_FILE?readFileSync(process.env.NATIVE_PARTICIPANT_ROUTER_SOURCE_FILE,'utf8'):readFileSync(file,'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
 new Function('exports','require',code)(exports,spec=>{
  if(spec==='@angular/core')return angular;if(spec==='@angular/common')return {DOCUMENT:OwnedDocument};if(spec==='@angular/material/dialog')return {MatDialog:MaterialDialog};if(spec==='@angular/material/snack-bar')return {MatSnackBar:MaterialSnack};if(spec==='@angular/common/http')return http;if(spec==='@angular/router')return navigationTypes;if(spec.startsWith('@angular/'))return new Proxy({}, {get:()=>class{}});if(spec==='rxjs')return rx;if(spec==='rxjs/operators')return ops;
  if(spec.endsWith('native-session.service'))return{NativeMonitorSessionService:Session,NativeMonitorHttpError:HttpError};
  if(spec.endsWith('test-controller.service'))return{TestControllerService:Tcs};
  if(spec.endsWith('code-input.component'))return{CodeInputComponent:class{}};
  if(spec.endsWith('unithost.component'))return{UnithostComponent:class{}};
  if(spec.endsWith('shared.module'))return{WebsocketBackendService:load('shared/services/websocket-backend.service.ts').WebsocketBackendService,TestMode:load('shared/classes/test-mode.class.ts').TestMode};
  if(spec.endsWith('worker.util'))return{createTicker:()=>{throw Error('Unexpected worker in buffer fixture');}};
  if(spec==='@iqb/responses')return require(spec);
  if(spec.startsWith('.')&&spec.endsWith('.json'))return {default:JSON.parse(readFileSync(resolve(dirname(file),spec),'utf8'))};
  if(spec.startsWith('.'))return load(resolve(dirname(file),spec+'.ts'));return require(spec);
 });return exports;
}
const tokens=load('native-tokens.ts'),{NativeHttpClient}=load('native-http-client.ts'),{CommandService}=load('test-controller/services/command.service.ts');
test('destroying the actual owned injector retires only its Router adapter and preserves global navigation',async()=>{
 const core=await import(pathToFileURL(require.resolve('@angular/core')).href),{nativeOwnedRouter}=load('native-owned-router.ts');
 const {DefaultUrlSerializer}=await import(pathToFileURL(require.resolve('@angular/router')).href);const serializer=new DefaultUrlSerializer();
 const signal=new AbortController(),events=new rx.Subject(),calls=[];let destroyed=0,completed=0;
 const globalRouter={events,parseUrl:url=>serializer.parse(url),createUrlTree:commands=>serializer.parse(commands[0]),navigate:async commands=>{calls.push(commands);return true;},currentNavigation:()=>({id:3}),ngOnDestroy(){destroyed++;},dispose(){destroyed++;}};
 const context={current:true,signal:signal.signal,testId:'9007199254740993'};
 const token=new core.InjectionToken('owned router fixture'),env=core.createEnvironmentInjector([{provide:token,useFactory:()=>nativeOwnedRouter(globalRouter,()=>context)}],core.Injector.NULL);
 const proxy=env.get(token);proxy.events.subscribe({complete:()=>completed++});
 assert.equal(await proxy.navigate(['/native-test/9007199254740993/u/1']),true);env.destroy();assert.equal(destroyed,0);assert.equal(completed,1);
 assert.equal(await proxy.navigate(['/native-start']),false);assert.equal(proxy.currentNavigation(),null);assert.equal(await globalRouter.navigate(['/native-start']),true);assert.equal(calls.length,2);
 let lateCompleted=false;proxy.events.subscribe({complete:()=>lateCompleted=true});assert.equal(lateCompleted,true);
});
bindings.set(tokens.NATIVE_RENDER_NOTIFY,()=>{});
bindings.set(tokens.NATIVE_ERROR_RECEIVER,null);
const {CustomtextService:NativeTexts}=load('shared/services/customtext/customtext.service.ts');
test('native custom text reset clears existing unknown-key subscribers and retirement clears retained subjects',()=>{
 session();const texts=new NativeTexts();texts.addCustomTexts({'owned-private-key':'Actor A private'});const retained=texts.getCustomText$('owned-private-key');assert.equal(retained.value,'Actor A private');
 texts.restoreDefault(true);assert.equal(retained.value,null);assert.equal(texts.getCustomText$('owned-private-key'),retained);texts.addCustomTexts({'owned-private-key':'Actor B private'});assert.equal(retained.value,'Actor B private');
 texts.ngOnDestroy();assert.equal(retained.value,null);assert.equal(retained.isStopped,true);
});
const settle=()=>new Promise(done=>setImmediate(done));globalThis.window={};globalThis.location={origin:'https://native.invalid'};
function session(){let scope=new AbortController(),token='actor-A';const value={access:()=>token?{token}:null,get accessSignal(){return scope.signal;},clear(){scope.abort();scope=new AbortController();token=null;},replace(){scope.abort();scope=new AbortController();token='actor-B';}};bindings.set(Session,value);bindings.set(tokens.NATIVE_RUN_TEST_ID,'1');return value;}
test('native HTTP sends only the captured AuthToken and rejects foreign, canonical and other-test paths',async()=>{
 const owner=session(),client=new NativeHttpClient(),requests=[];globalThis.fetch=async(url,options)=>{requests.push({url:String(url),options});return new Response('');};
 assert.equal(await rx.firstValueFrom(client.patch('/test/1/command/9223372036854775807/executed',{})),null);
 assert.equal(requests[0].options.headers.AuthToken,'actor-A');assert.equal(requests[0].options.headers.Authorization,undefined);assert.equal(requests[0].options.credentials,'omit');assert.equal(requests[0].options.redirect,'error');assert.equal(requests[0].options.body,'{}');
 for(const path of ['https://foreign.invalid/test/1','/api/participant/1','/test/2/commands'])await assert.rejects(rx.firstValueFrom(client.get(path)));
 owner.replace();await assert.rejects(rx.firstValueFrom(client.get('/test/1/commands')));assert.equal(requests.length,1);assert.equal(client.isCurrent,false);
});
test('retiring native HTTP completes subscribers and aborts the owned pending request',async()=>{
 const owner=session(),client=new NativeHttpClient();let signal,complete=0,values=0;
 globalThis.fetch=(_url,options)=>{signal=options.signal;return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('aborted')),{once:true}));};
 client.get('/test/1/commands').subscribe({next:()=>values++,complete:()=>complete++});owner.replace();await settle();assert.equal(signal.aborted,true);assert.equal(complete,1);assert.equal(values,0);
});
test('native resource progress counts actual UTF8 bytes and returns unmodified text',async()=>{
 session();const client=new NativeHttpClient(),events=[];globalThis.fetch=async()=>new Response(new ReadableStream({start(c){c.enqueue(Uint8Array.from([195]));c.enqueue(Uint8Array.from([164,120]));c.close();}}),{headers:{'Content-Length':'3'}});
 await new Promise((done,reject)=>client.get('/file/cap/ws_1/resource',{observe:'events',reportProgress:true,responseType:'text'}).subscribe({next:v=>events.push(v),error:reject,complete:done}));
 assert.deepEqual(events.slice(0,-1).map(v=>[v.type,v.loaded,v.total]),[[3,1,3],[3,3,3]]);assert.equal(events.at(-1).body,'äx');assert.equal(events.at(-1).type,4);
});
test('native 401 retires the actor even with an empty response body',async()=>{
 const owner=session(),client=new NativeHttpClient();globalThis.fetch=async()=>new Response('',{status:401});let completed=false;client.get('/test/1/commands').subscribe({complete:()=>completed=true});await settle();await settle();assert.equal(owner.access(),null);assert.equal(completed,true);
});
function commands(t){
 t.mock.timers.enable({apis:['setTimeout','setInterval','Date']});const scope=new AbortController(),started=[],tcs={testId:'1',state$:new rx.BehaviorSubject('INIT'),testMode:{receiveRemoteCommands:false}};
 const client={accessSignal:scope.signal,get isCurrent(){return !scope.signal.aborted;},patch(path,body){const response=new rx.Subject();started.push({path,body,response,time:Date.now()});return response;}};
 for(const [key,value]of [[NativeHttpClient,client],[Tcs,tcs],[tokens.NATIVE_RUN_TEST_ID,'1'],[tokens.NATIVE_PRODUCTION,true],[tokens.NATIVE_BACKEND_URL,'/'],[tokens.NATIVE_BROADCASTER_URL,'']])bindings.set(key,value);
 const service=new CommandService(),effects=[];service.command$.subscribe(cmd=>effects.push(cmd));const send=id=>service.commandReceived$.next({id,keyword:'pause',arguments:[],timestamp:'9223372036854775807'});t.after(()=>service.ngOnDestroy());return{service,scope,started,tcs,effects,send};
}
test('native ACK starts one second apart, overlaps, deduplicates pending packets and dispatches in completion order',t=>{
 const f=commands(t),one='9223372036854775806',two='9223372036854775807';f.send(one);f.send(one);f.send(two);assert.equal(f.started.length,1);assert.deepEqual(f.effects,[]);t.mock.timers.tick(999);assert.equal(f.started.length,1);t.mock.timers.tick(1);assert.equal(f.started.length,2);assert.equal(f.started[1].time-f.started[0].time,1000);assert.ok(f.started[0].path.endsWith('/'+one+'/executed'));assert.deepEqual(f.started[0].body,{});
 f.started[1].response.next(null);f.started[1].response.complete();assert.deepEqual(f.effects.map(x=>x.id),[two]);f.started[0].response.next(null);f.started[0].response.complete();assert.deepEqual(f.effects.map(x=>x.id),[two,one]);f.send(one);t.mock.timers.tick(5000);assert.equal(f.started.length,2);assert.equal(window.tc,undefined);
});
test('a failed native ACK produces no effect and a later poll can retry it',t=>{
 const f=commands(t);f.send('1');f.started[0].response.error(Error('HTTP500'));assert.deepEqual(f.effects,[]);f.send('1');t.mock.timers.tick(1000);assert.equal(f.started.length,2);f.started[1].response.next(null);f.started[1].response.complete();assert.deepEqual(f.effects.map(x=>x.id),['1']);
});
test('access retirement cancels pending native ACKs and queued starts',t=>{
 const f=commands(t);f.send('1');f.send('2');f.scope.abort();f.started[0].response.next(null);t.mock.timers.tick(10000);assert.equal(f.started.length,1);assert.deepEqual(f.effects,[]);
});
test('a retired test cannot redirect delayed ACKs or effects to another test in the same actor',t=>{
 const f=commands(t);f.send('1');f.send('2');f.tcs.testId='2';f.started[0].response.next(null);f.started[0].response.complete();t.mock.timers.tick(2000);f.send('3');t.mock.timers.tick(2000);assert.equal(f.started.length,1);assert.deepEqual(f.effects,[]);
});
test('destroying a native run aborts its requests while preserving the actor session',async()=>{
 const owner=session(),client=new NativeHttpClient();let signal,complete=0;globalThis.fetch=(_url,options)=>{signal=options.signal;return new Promise((_resolve,reject)=>signal.addEventListener('abort',()=>reject(Error('run destroyed')),{once:true}));};
 client.get('/test/1/commands').subscribe({complete:()=>complete++});client.ngOnDestroy();await settle();assert.equal(signal.aborted,true);assert.equal(client.accessSignal.aborted,true);assert.equal(complete,1);assert.equal(owner.access().token,'actor-A');await assert.rejects(rx.firstValueFrom(client.get('/test/1/commands')));
});
const {NativePlayerChannel}=load('native-player-channel.ts');
function playerChannel(){const owner=new AbortController(),sent=[];let current=true;const channel=new NativePlayerChannel(owner.signal,()=>current);const source={postMessage:(data,origin)=>sent.push({data,origin})},frame={contentWindow:source,isConnected:true,remove(){this.isConnected=false;}},lease=channel.bind(frame,'UNIT_A',()=>true);const event=(data,options={})=>({data,source,origin:'null',...options});return{owner,sent,channel,source,frame,lease,event,retire:()=>current=false};}
test('native player accepts only its connected opaque frame and nonce, never public aliases or ambient windows',()=>{
 const f=playerChannel(),ready={type:'vopReadyNotification',metadata:{specVersion:'6.0'}};
 for(const options of[{source:{}},{origin:'https://foreign.invalid'}])assert.equal(f.channel.receive(f.event(ready,options)),undefined);
 assert.equal(f.channel.receive(f.event(null)),undefined);assert.equal(f.channel.receive(f.event([])),undefined);assert.equal(f.channel.receive(f.event({type:'vopStateChangedNotification',sessionId:f.lease.nonce})),undefined);
 assert.ok(f.channel.receive(f.event(ready)));assert.equal(f.channel.beginReady(f.lease),true);assert.equal(f.channel.receive(f.event(ready)),undefined);assert.equal(f.channel.completeReady(f.lease),true);
 assert.equal(f.channel.receive(f.event({type:'vopStateChangedNotification',sessionId:'UNIT_A'})),undefined);
 assert.equal(f.channel.receive(f.event({type:'vopStateChangedNotification',sessionId:'old-nonce'})),undefined);
 const packet=f.channel.receive(f.event({type:'vopStateChangedNotification',sessionId:f.lease.nonce,unitState:{dataParts:{a:'{"raw":true}'}}}));assert.equal(packet.message.sessionId,'UNIT_A');assert.deepEqual(packet.message.unitState,{dataParts:{a:'{"raw":true}'}});
 f.channel.send({type:'vopStartCommand',sessionId:'UNIT_A',unitDefinition:'raw XML'});assert.equal(f.sent.length,1);assert.equal(f.sent[0].data.sessionId,f.lease.nonce);assert.equal(f.sent[0].origin,'*');f.channel.send({type:'vopStartCommand',sessionId:'UNIT_B'});assert.equal(f.sent.length,1);f.channel.destroy();
});
test('replacing a native frame with the same unit alias retires its nonce and target',()=>{
 const f=playerChannel();f.channel.beginReady(f.lease);const second={contentWindow:{postMessage(){}},isConnected:true,remove(){this.isConnected=false;}},next=f.channel.bind(second,'UNIT_A',()=>true);assert.notEqual(next.nonce,f.lease.nonce);assert.equal(f.frame.isConnected,false);assert.equal(f.channel.completeReady(f.lease),false);assert.equal(f.channel.receive(f.event({type:'vopReadyNotification'})),undefined);f.channel.send({sessionId:'UNIT_A',type:'vopStartCommand'});assert.deepEqual(f.sent,[]);f.channel.destroy();
});
test('native frame retirement physically detaches on run/actor loss and suppresses delayed ready or output',()=>{
 const f=playerChannel();f.channel.beginReady(f.lease);f.owner.abort();assert.equal(f.frame.isConnected,false);assert.equal(f.channel.completeReady(f.lease),false);assert.equal(f.channel.receive(f.event({type:'vopReadyNotification'})),undefined);f.channel.send({sessionId:'UNIT_A',type:'vopStartCommand'});assert.deepEqual(f.sent,[]);
 const g=playerChannel();g.channel.beginReady(g.lease);g.retire();assert.equal(g.channel.completeReady(g.lease),false);assert.equal(g.channel.receive(g.event({type:'vopReadyNotification'})),undefined);g.channel.destroy();
});
test('a delayed old native view cleanup cannot retire the replacement frame lease',()=>{
 const f=playerChannel(),nextFrame={contentWindow:{postMessage(){}},isConnected:true,remove(){this.isConnected=false;}},next=f.channel.bind(nextFrame,'UNIT_B',()=>true);f.channel.clear(f.lease);assert.equal(nextFrame.isConnected,true);assert.equal(f.channel.beginReady(next),true);assert.equal(f.channel.completeReady(next),true);f.channel.destroy();
});
angular.Component=()=>value=>value;angular.ViewChild=()=>()=>{};
const {VeronaAPIService}=load('test-controller/services/verona-api.service.ts'),{UnithostComponent}=load('test-controller/components/unithost/unithost.component.ts');
function unitHost(){
 const owner=new AbortController(),client={accessSignal:owner.signal,get isCurrent(){return !owner.signal.aborted;}},sent=[];bindings.set(NativeHttpClient,client);bindings.set(tokens.NATIVE_FILE_SERVER_URL,'/');const api=new VeronaAPIService();
 const unit={alias:'UNIT_A',sequenceId:1,label:'Private A',definition:'<Unit>A raw Ω</Unit>',unitDefinitionType:'unit.test',dataParts:{a:'{"raw":true}'},state:{}},tcs={currentUnit:unit,currentUnitSequenceId:1,workspaceId:'9223372036854775807',booklet:{config:{}},sharedParameters:[],AddToUnitStateBuffer(){},testMode:{saveResponses:true}};let resolve,reject;const barrier=new Promise((a,b)=>{resolve=a;reject=b;});tcs.closeAllBuffers=()=>barrier;
 const mds={http:client,appConfig:{veronaPlayerApiVersionMin:2,veronaPlayerApiVersionMax:6},getAuthData:()=>({groupToken:'cap-A',viewSettings:{}})},host=new UnithostComponent(tcs,mds,{},api,{}, {},{backendUrl:'/'},{}),source={postMessage:(data,origin)=>sent.push({data,origin})},frame={contentWindow:source,isConnected:true,remove(){this.isConnected=false;}},lease=api.channel.bind(frame,unit.alias,()=>tcs.currentUnit===unit);host.playerLease=lease;
 return{owner,api,unit,tcs,mds,host,source,frame,lease,sent,resolve,reject,event:{source,origin:'null',data:{type:'vopReadyNotification',metadata:{specVersion:'6.0'}}}};
}
test('the actual Source Unit host starts only its own ready frame with opaque session and unchanged definition/state',async()=>{
 const f=unitHost(),pending=f.host.handleIncomingMessage(f.event);assert.equal(f.sent.length,0);f.resolve({targets:{}});await pending;assert.equal(f.sent.length,1);assert.equal(f.sent[0].data.sessionId,f.lease.nonce);assert.equal(f.sent[0].data.unitDefinition,f.unit.definition);assert.deepEqual(f.sent[0].data.unitState.dataParts,f.unit.dataParts);f.host.ngOnDestroy();f.api.ngOnDestroy();
});
for(const failure of [false,true])test('the actual Unit host drops late '+(failure?'failed':'successful')+' ready work after unit replacement',async()=>{
 const f=unitHost(),pending=f.host.handleIncomingMessage(f.event);f.tcs.currentUnit={...f.unit,alias:'UNIT_B',sequenceId:2,definition:'B secret'};const nextFrame={contentWindow:{postMessage(){}},isConnected:true,remove(){this.isConnected=false;}};f.api.channel.bind(nextFrame,'UNIT_B',()=>true);
 if(failure)f.reject(Error('A private failure'));else f.resolve({targets:{}});await pending;assert.deepEqual(f.sent,[]);assert.equal(f.mds.appError,undefined);f.host.ngOnDestroy();assert.equal(nextFrame.isConnected,true,'old view destruction cannot detach B');f.api.ngOnDestroy();
});
test('destroying the actual Unit host before its deferred initialization prevents late subscriptions',async()=>{
 const f=unitHost();f.host.ngOnInit();f.host.ngOnDestroy();await settle();assert.deepEqual(f.host.subscriptions,{});assert.equal(f.frame.isConnected,false);f.api.ngOnDestroy();
});
const {UnitDeactivateGuard}=load('test-controller/routing/unit-deactivate.guard.ts');
function leaving(){const f=playerChannel(),pending=new rx.Subject(),events=new rx.Subject();let id=7;const client={ownError:error=>error,accessSignal:f.owner.signal,get isCurrent(){return !f.owner.signal.aborted;}},tcs={booklet:{config:{}},getUnitDeactivationCheck:()=>pending},router={currentNavigation:()=>({id,trigger:'imperative'}),events};bindings.set(NativeHttpClient,client);return{...f,pending,events,tcs,router,guard:new UnitDeactivateGuard(tcs,router),component:{holdPlayer:()=>f.channel.hold()},nextNavigation:()=>id++};}
test('actual native leave guard retains the frame inert through saving and restores it unchanged on Stay',()=>{
 const f=leaving(),before=f.frame;let result;f.guard.canDeactivate(f.component,{}, {},{url:'/native-test/1/u/2'}).subscribe(v=>result=v);assert.equal(f.frame.inert,true);assert.equal(f.frame.isConnected,true);assert.equal(result,undefined);f.pending.next(false);assert.equal(result,false);assert.equal(f.frame,before);assert.equal(f.frame.inert,false);assert.equal(f.frame.isConnected,true);assert.equal(f.events.observers.length,0);f.channel.destroy();
});
test('actual native leave guard holds the same frame until a successful guard navigation settles',()=>{
 const f=leaving();f.guard.canDeactivate(f.component,{}, {},{url:'/native-test/1/u/2'}).subscribe();f.pending.next(true);assert.equal(f.frame.inert,true);f.events.next(new navigationTypes.NavigationCancel(7));assert.equal(f.frame.inert,false);assert.equal(f.frame.isConnected,true);f.channel.destroy();
});
test('native leave retirement cancels pending work, detaches the frame and cannot block actor replacement',()=>{
 const f=leaving();let result;f.guard.canDeactivate(f.component,{}, {},{url:'/native-test/1/u/2'}).subscribe(v=>result=v);f.owner.abort();assert.equal(result,true);assert.equal(f.frame.isConnected,false);assert.equal(f.pending.observers.length,0);assert.equal(f.events.observers.length,0);f.pending.next(false);assert.equal(result,true);
});
test('overlapping native navigation holds cannot release each other early',()=>{
 const f=leaving(),first=new rx.Subject(),second=new rx.Subject();let count=0;f.tcs.getUnitDeactivationCheck=()=>++count===1?first:second;f.guard.canDeactivate(f.component,{}, {},{url:'/native-test/1/u/2'}).subscribe();f.nextNavigation();f.guard.canDeactivate(f.component,{}, {},{url:'/native-test/1/u/3'}).subscribe();first.next(false);assert.equal(f.frame.inert,true);second.next(true);f.events.next(new navigationTypes.NavigationEnd(8));assert.equal(f.frame.inert,false);f.channel.destroy();
});
const {UnitActivateGuard}=load('test-controller/routing/unit-activate.guard.ts');
test('actual native unit guard preserves the complete signed-int64 test route',async()=>{
 const id='9223372036854775807';bindings.set(tokens.NATIVE_RUN_TEST_ID,id);const guard=new UnitActivateGuard({booklet:null},{parseUrl:path=>path},{});assert.equal(await guard.canActivate({parent:{params:{t:id}},params:{u:'1'}}),'/native-test/'+id);
});
test('actual native unit guard rejects a different run before reading its unit or booklet',async()=>{
 bindings.set(tokens.NATIVE_RUN_TEST_ID,'1');const guard=new UnitActivateGuard({booklet:{},getUnit(){throw Error('must not read another run');}},{parseUrl:path=>path},{});assert.equal(await guard.canActivate({parent:{params:{t:'2'}},params:{u:'1'}}),'/native-test');
});
angular.signal=(await import(pathToFileURL(require.resolve('@angular/core')).href)).signal;
const {HeaderService:NativeParticipantHeader}=load('shared/services/header.service.ts');
test('native participant header physically clears its title at retirement and ignores late old-view writes',()=>{
 const a=new AbortController();bindings.set(NativeHttpClient,{accessSignal:a.signal});const old=new NativeParticipantHeader();old.title='A private';old.isHeaderHidden=true;assert.equal(old.title,'A private');a.abort();assert.equal(old.title,'');assert.equal(old.state().title,'');
 const b=new AbortController();bindings.set(NativeHttpClient,{accessSignal:b.signal});const current=new NativeParticipantHeader();current.title='B private';old.title='late A';assert.equal(old.title,'');assert.equal(current.title,'B private');old.ngOnDestroy();assert.equal(current.title,'B private');b.abort();assert.equal(current.title,'');current.ngOnDestroy();
});

const {NativeOwnedDialog,NativeOwnedSnackBar}=load('native-owned-overlays.ts');
function overlayUi(){
 const dialogs=[],snacks=[],nodes=new Map();
 const parentDialog={open(component,config){const closed=new rx.Subject(),element={removed:false,remove(){this.removed=true;}},ref={config,element,closes:0,detects:0,afterClosed:()=>closed,close(value){this.closes++;closed.next(value);closed.complete();},componentRef:{location:{nativeElement:element},changeDetectorRef:{detectChanges(){ref.detects++;}}}};dialogs.push(ref);return ref;}};
 const parentSnack={open(message,action,config){const dismissed=new rx.Subject(),panel=config.panelClass.at(-1),element={removed:false,remove(){this.removed=true;nodes.delete(panel);}},ref={message,config,element,dismisses:0,afterDismissed:()=>dismissed,dismiss(){this.dismisses++;dismissed.next();dismissed.complete();}};snacks.push(ref);nodes.set(panel,element);return ref;},dismiss(){throw Error('Unowned global dismissal');}};
 return{dialogs,snacks,parentDialog,parentSnack,document:{querySelectorAll(selector){return nodes.has(selector.slice(1))?[nodes.get(selector.slice(1))]:[];}}};
}
function overlays(ui=overlayUi()){
 const f=playerChannel(),client={ownError:error=>error,accessSignal:f.owner.signal,get isCurrent(){return !f.owner.signal.aborted;}},injector={owned:true};
 for(const[key,value]of[[NativeHttpClient,client],[VeronaAPIService,{channel:f.channel}],[MaterialDialog,ui.parentDialog],[MaterialSnack,ui.parentSnack],[OwnedEnvironment,injector],[OwnedDocument,ui.document]])bindings.set(key,value);
 return{...f,ui,client,injector,dialog:new NativeOwnedDialog(),snack:new NativeOwnedSnackBar()};
}
test('native dialog Stay releases only its own hold and preserves the navigation hold',()=>{
 const f=overlays(),release=f.channel.hold(),values=[];f.dialog.open(class{}).afterClosed().subscribe(v=>values.push(v));const ref=f.ui.dialogs[0];assert.equal(ref.detects,1);assert.equal(ref.config.injector,f.injector);assert.equal(f.frame.inert,true);
 ref.close(false);assert.deepEqual(values,[false]);assert.equal(f.frame.inert,true);assert.equal(f.frame.isConnected,true);release();assert.equal(f.frame.inert,false);f.dialog.ngOnDestroy();
});
test('unit replacement cancels and physically removes only its owned dialog without a fabricated decision',()=>{
 const f=overlays(),values=[];f.dialog.open(class{}).afterClosed().subscribe(v=>values.push(v));const ref=f.ui.dialogs[0],next={isConnected:true,inert:false,contentWindow:{postMessage(){}},remove(){this.isConnected=false;}};
 f.channel.bind(next,'UNIT_B',()=>true);assert.equal(ref.closes,1);assert.equal(ref.element.removed,true);assert.equal(f.frame.isConnected,false);assert.equal(next.inert,false);assert.deepEqual(values,[]);
 f.dialog.open(class{}).afterClosed().subscribe(v=>values.push(v));assert.equal(next.inert,true);f.ui.dialogs[1].close(true);assert.deepEqual(values,[true]);assert.equal(next.inert,false);f.dialog.ngOnDestroy();
});
test('actor retirement cannot close or release a replacement dialog and drops late opens',()=>{
 const ui=overlayUi(),a=overlays(ui),values=[];a.dialog.open(class{}).afterClosed().subscribe(v=>values.push(v));const b=overlays(ui);b.dialog.open(class{});a.owner.abort();assert.equal(ui.dialogs[0].element.removed,true);assert.equal(ui.dialogs[0].closes,1);assert.equal(ui.dialogs[1].element.removed,false);assert.equal(ui.dialogs[1].closes,0);assert.equal(b.frame.inert,true);assert.deepEqual(values,[]);
 a.dialog.open(class{}).afterClosed().subscribe(v=>values.push(v));assert.equal(ui.dialogs.length,2);assert.deepEqual(values,[]);a.dialog.ngOnDestroy();b.owner.abort();b.dialog.ngOnDestroy();
});
test('native snackbar retirement removes only its private panel and never dismisses globally',()=>{
 const ui=overlayUi(),a=overlays(ui);a.snack.open('A private','',{panelClass:'source-class'});const b=overlays(ui);b.snack.open('B private');a.owner.abort();assert.equal(ui.snacks[0].element.removed,true);assert.equal(ui.snacks[0].dismisses,1);assert.equal(ui.snacks[1].element.removed,false);assert.equal(ui.snacks[1].dismisses,0);assert.ok(ui.snacks[0].config.panelClass.includes('source-class'));assert.equal(a.snack.open('late'),undefined);assert.equal(ui.snacks.length,2);a.snack.ngOnDestroy();b.owner.abort();b.snack.ngOnDestroy();
});
const {ToastService}=load('shared/services/toast.service.ts');
test('native Source toast stacking keeps independent dismissals and retires without a fake user action',t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=overlays(),toast=new ToastService(),values=[],completed=[];toast.showSnackbar('A one','close',100).subscribe({next:()=>values.push(1),complete:()=>completed.push(1)});toast.showSnackbar('A two','close',200).subscribe({next:()=>values.push(2),complete:()=>completed.push(2)});assert.equal(toast.toasts().length,2);
 toast.dismissToast(toast.toasts()[0].id);toast.dismissToast(1);assert.deepEqual(values,[1]);assert.equal(toast.toasts().length,1);f.owner.abort();assert.equal(toast.toasts().length,0);assert.deepEqual(values,[1]);assert.deepEqual(completed,[1,2]);toast.showSnackbar('late').subscribe(()=>values.push(3));t.mock.timers.tick(500);assert.deepEqual(values,[1]);toast.ngOnDestroy();f.dialog.ngOnDestroy();f.snack.ngOnDestroy();
});

const {TestControllerService:NativeController}=load('test-controller/services/test-controller.service.ts');
function nativeBuffers(){
 bindings.set(tokens.NATIVE_RUN_TEST_ID,'9223372036854775807');
 const f=overlays(),requests={unitData:new rx.Subject(),unitState:new rx.Subject(),testState:new rx.Subject()},calls=[];
 const backend={updateDataParts:(...args)=>{calls.push(['unitData',...args]);return requests.unitData;},patchUnitState:(...args)=>{calls.push(['unitState',...args]);return requests.unitState;},patchTestState:(...args)=>{calls.push(['testState',...args]);return requests.testState;}};
 const controller=new NativeController({},backend,{}, {},{}, {},{});controller.testId='9223372036854775807';controller.testMode={saveResponses:true};controller.units={1:{id:'original-unit',alias:'UNIT_A'}};controller.unitAliasMap={UNIT_A:1};controller.updateVariables=()=>false;
 const finish=()=>{controller.ngOnDestroy();f.owner.abort();f.dialog.ngOnDestroy();f.snack.ngOnDestroy();};
 return{...f,controller,requests,calls,finish,enqueue(){controller.unitDataPartsBuffer$.next({unitAlias:'UNIT_A',dataParts:{answer:'raw Ω'},unitStateDataType:'native'});controller.unitStateBuffer$.next({testId:controller.testId,unitAlias:'UNIT_A',state:[{key:'PRESENTATION',content:'complete',timeStamp:11}]});controller.addToTestStateBuffer('FOCUS','HAS');}};
}
test('native internal navigation preserves only the immutable owned run, including unsafe integer IDs',async()=>{
 const {DefaultUrlSerializer}=await import(pathToFileURL(require.resolve('@angular/router')).href);
 navigationTypes.PRIMARY_OUTLET='primary';
 const f=nativeBuffers();try{
  const parser=new DefaultUrlSerializer();f.controller.router={parseUrl:url=>parser.parse(url)};f.controller.state$.next('RUNNING');
  for(const path of ['/native-test/9223372036854775807/u/2','/native-test/9223372036854775807/status','/native-test/9223372036854775807/u/1?mode=test'])assert.equal(f.controller.willAlsoEndTest(path),false,path);
  f.controller.testId='9223372036854775806';
  for(const path of ['/native-start','/native-test/9223372036854775806/u/1','/native-test/9223372036854775808/u/1','/t/9223372036854775807/u/1'])assert.equal(f.controller.willAlsoEndTest(path),true,path);
 }finally{f.finish();}
});
test('native Source empty saved-buffer close requires all three distinct buffer kinds',async t=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval']});const f=nativeBuffers();try{const nav=f.controller.navigation$.getValue(),p=f.controller.closeAllBuffers('empty','saved');t.mock.timers.tick(1);assert.equal(await p,nav);}finally{f.finish();}
});
test('duplicate saved events from one buffer cannot qualify the native close barrier',async t=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval']});const f=nativeBuffers();try{
 for(const name of['unitDataPartsBuffer','unitStateBuffer','testStateBuffer'])f.controller.destroySubscription(name);
 let id,done=false;const sub=f.controller.bufferClosed$.subscribe(value=>{id=value;for(let i=0;i<3;i++)f.controller.bufferFlushEventsOnClose$.next({type:'unitData',event:'saved',id});});
 const p=f.controller.closeAllBuffers('duplicate','saved');p.then(()=>done=true);t.mock.timers.tick(1);await Promise.resolve();assert.equal(done,false);
 f.controller.bufferFlushEventsOnClose$.next({type:'unitState',event:'saved',id});await Promise.resolve();assert.equal(done,false);
 f.controller.bufferFlushEventsOnClose$.next({type:'testState',event:'saved',id});await p;sub.unsubscribe();
 }finally{f.finish();}
});
test('retiring a partly saved native run cancels owned saves and cannot fabricate a saved receipt',async t=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval']});const f=nativeBuffers();try{f.enqueue();const events=[];const sub=f.controller.bufferFlushEventsOnClose$.subscribe(event=>events.push(event));const p=f.controller.closeAllBuffers('pending','saved');t.mock.timers.tick(1);assert.equal(f.calls.length,3);assert.ok(Object.values(f.requests).every(subject=>subject.observed));
 f.requests.unitData.next(null);f.requests.unitData.complete();assert.equal(events.filter(e=>e.event==='saved').length,1);
 const rejected=assert.rejects(p);f.owner.abort();await rejected;assert.ok(Object.values(f.requests).every(subject=>!subject.observed));
 f.requests.unitState.next(null);f.requests.unitState.complete();f.requests.testState.next(null);f.requests.testState.complete();t.mock.timers.tick(100000);assert.equal(events.filter(e=>e.event==='saved').length,1);assert.equal(f.calls.length,3);await assert.rejects(f.controller.closeAllBuffers('late','saved'),{name:'AbortError'});sub.unsubscribe();
 }finally{f.finish();}
});
test('an unacknowledged native saved-buffer wait retains its finite20s deadline',async t=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval']});const f=nativeBuffers();try{f.enqueue();const p=f.controller.closeAllBuffers('deadline','saved'),rejected=assert.rejects(p,{name:'TimeoutError'});t.mock.timers.tick(1);t.mock.timers.tick(20000);await rejected;}finally{f.finish();}
});

test('queued native buffers wait for all three owned null receipts and retain the opaque run ID',async t=>{
 t.mock.timers.enable({apis:['setTimeout','setInterval']});const f=nativeBuffers();try{f.enqueue();let done=false;const p=f.controller.closeAllBuffers('all-receipts','saved');p.then(()=>done=true);t.mock.timers.tick(1);assert.equal(f.calls.length,3);assert.equal(f.calls[0][1],'9223372036854775807');assert.equal(f.calls[1][1].testId,'9223372036854775807');assert.equal(f.calls[2][1].testId,'9223372036854775807');
 f.requests.unitData.next(null);f.requests.unitData.complete();f.requests.unitState.next(null);f.requests.unitState.complete();await Promise.resolve();assert.equal(done,false);
 f.requests.testState.next(null);f.requests.testState.complete();assert.equal(await p,f.controller.navigation$.getValue());
 }finally{f.finish();}
});

const {NativeTestStarterService}=load('native-test-starter.service.ts');
function nativeStarter(text){
 let actor=new AbortController();const access={token:'owned',flags:[],claims:{test:[{id:'BOOKLET#exact native name',flags:{locked:false,running:false}}]}};
 const session={access:()=>access,get accessSignal(){return actor.signal;},text};bindings.set(Session,session);
 return {service:new NativeTestStarterService(),access,replace(){actor.abort();actor=new AbortController();}};
}
test('native card start sends the exact Booklet and accepts only lossless positive int64 receipts',async()=>{
 let raw='9223372036854775807',calls=[];const f=nativeStarter(async(...args)=>{calls.push(args);return raw;});
 assert.equal(await f.service.start('BOOKLET#exact native name',new AbortController().signal),'9223372036854775807');assert.deepEqual(calls[0].slice(0,4),['PUT','/test',{bookletName:'BOOKLET#exact native name'},'owned']);
 for(raw of ['0','01','-1','"9007199254740993"','9223372036854775808','1e3','NaN',''])await assert.rejects(f.service.start('BOOKLET#exact native name',new AbortController().signal),/Test-ID/);
 assert.equal(f.service.pendingBooklet(),'');
});
test('native card start checks current grants and locks before creating a Test',async()=>{
 let calls=0;const f=nativeStarter(async()=>{calls++;return '1';});
 await assert.rejects(f.service.start('another Booklet',new AbortController().signal),/nicht freigegeben/);f.access.claims.test[0].flags.locked=true;await assert.rejects(f.service.start('BOOKLET#exact native name',new AbortController().signal),/nicht freigegeben/);assert.equal(calls,0);
});
test('retired card owners cannot block or clear replacement starts in the same actor',async()=>{
 const responses=[];const f=nativeStarter(()=>new Promise(resolve=>responses.push(resolve))),owner=new AbortController();
 const old=f.service.start('BOOKLET#exact native name',owner.signal),rejected=assert.rejects(old,{name:'AbortError'});await assert.rejects(f.service.start('BOOKLET#exact native name',new AbortController().signal),/bereits geöffnet/);assert.equal(responses.length,1);
 owner.abort();const replacement=f.service.start('BOOKLET#exact native name',new AbortController().signal);assert.equal(responses.length,2);responses[0]('1');await rejected;assert.equal(f.service.pendingBooklet(),'BOOKLET#exact native name');responses[1]('9007199254740993');assert.equal(await replacement,'9007199254740993');assert.equal(f.service.pendingBooklet(),'');
});
test('destroying or replacing the native starter scope rejects a late accepted create response',async()=>{
 for(const retire of ['destroy','replace']){
  let resolve,signal;const f=nativeStarter((...args)=>{signal=args[5];return new Promise(done=>resolve=done);}),start=f.service.start('BOOKLET#exact native name',new AbortController().signal),rejected=assert.rejects(start,{name:'AbortError'});
  if(retire==='destroy'){f.service.ngOnDestroy();assert.equal(signal.aborted,true);await assert.rejects(f.service.start('BOOKLET#exact native name',new AbortController().signal),{name:'AbortError'});}else f.replace();assert.equal(f.service.pendingBooklet(),'');resolve('9007199254740993');await rejected;assert.equal(f.service.pendingBooklet(),'');
 }
});

const {dispatchOwnedError}=load('../owned-error-routing.ts');
const turn=async()=>{await settle();await settle();};
test('native service-status reads use the owned transport without allowing unrelated system endpoints',async()=>{
 session();const client=new NativeHttpClient(),calls=[];globalThis.fetch=async url=>{calls.push(String(url));return new Response('{"fileService":"ok","cacheService":"ok","broadcastingService":"ok"}');};
 assert.equal((await rx.firstValueFrom(client.get('/system/status'))).fileService,'ok');await assert.rejects(rx.firstValueFrom(client.get('/system/config')));assert.equal(calls.length,1);client.ngOnDestroy();
});
test('native retries use the Original finite delays and frozen response bytes before a real receipt',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date']});session();const client=new NativeHttpClient(),calls=[],body={timeStamp:123,dataParts:{answer:'original Ω'}};
 t.after(()=>client.ngOnDestroy());globalThis.fetch=async(_url,options)=>{calls.push({at:Date.now(),body:options.body});return new Response(calls.length<5?'Temporary':'',{status:calls.length<5?503:201});};
 const start=Date.now(),done=rx.firstValueFrom(client.put('/test/1/unit/OWNED/response',body));await turn();assert.equal(calls.length,1);body.dataParts.answer='later edit';
 for(const delay of[50,500,1000,2000]){t.mock.timers.tick(delay-1);await turn();const before=calls.length;t.mock.timers.tick(1);await turn();assert.equal(calls.length,before+1);}
 assert.equal(await done,null);assert.deepEqual(calls.map(c=>c.at-start),[0,50,550,1550,3550]);assert.equal(new Set(calls.map(c=>c.body)).size,1);assert.equal(JSON.parse(calls[4].body).dataParts.answer,'original Ω');
});
test('exhausted native retries retain status/error metadata and route only to their original owner',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date']});session();const delivered=[];bindings.set(tokens.NATIVE_ERROR_RECEIVER,error=>delivered.push(error));const client=new NativeHttpClient();let calls=0;
 t.after(()=>{client.ngOnDestroy();bindings.set(tokens.NATIVE_ERROR_RECEIVER,null);});
 globalThis.fetch=async()=>{calls++;return new Response('Owned '+ 'actor-A'+' unavailable',{status:503,headers:{'error-id':'OWNED-ID','test-mode':'integration'}});};
 const done=rx.firstValueFrom(client.put('/test/1/unit/OWNED/response',{})).then(()=>{throw Error('Unexpected successful write');},error=>error);await turn();
 for(const delay of[50,500,1000,2000]){t.mock.timers.tick(delay);await turn();}
 const error=await done;assert.equal(calls,5);assert.equal(error.code,503);assert.equal(error.type,'network_temporally');assert.equal(error.errorId,'owned-id');assert.equal(error.testMode,'integration');assert.equal(error.description,'Owned [redacted] unavailable');assert.deepEqual(delivered,[]);
 assert.equal(dispatchOwnedError(error),true);assert.deepEqual(delivered,[error]);assert.equal(dispatchOwnedError(error),true);assert.equal(delivered.length,1);
});
test('retiring an actor during native retry delay cancels all remaining attempts and error delivery',async t=>{
 t.mock.timers.enable({apis:['setTimeout','Date']});const owner=session(),client=new NativeHttpClient();let calls=0,complete=0,errors=0;
 globalThis.fetch=async()=>{calls++;return new Response('Temporary',{status:503});};
 client.put('/test/1/unit/OWNED/response',{}).subscribe({complete:()=>complete++,error:()=>errors++});await turn();owner.replace();t.mock.timers.tick(10000);await turn();assert.equal(calls,1);assert.equal(complete,1);assert.equal(errors,0);client.ngOnDestroy();
});
test('native forbidden responses retire the actor without retrying',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const owner=session(),client=new NativeHttpClient();let calls=0,completed=false;
 globalThis.fetch=async()=>{calls++;return new Response('Forbidden',{status:403});};client.get('/test/1').subscribe({complete:()=>completed=true});await turn();t.mock.timers.tick(10000);await turn();assert.equal(calls,1);assert.equal(completed,true);assert.equal(owner.access(),null);client.ngOnDestroy();
});
test('the native20s logical-request deadline also ends a hanging retry attempt',async t=>{
 const deadline=new AbortController();t.mock.method(AbortSignal,'timeout',ms=>{assert.equal(ms,20000);return deadline.signal;});session();const client=new NativeHttpClient();let calls=0;
 globalThis.fetch=(_url,options)=>{calls++;return new Promise((_resolve,reject)=>options.signal.addEventListener('abort',()=>reject(options.signal.reason),{once:true}));};
 const done=rx.firstValueFrom(client.get('/test/1')).then(()=>{throw Error('Unexpected success');},error=>error);await turn();deadline.abort(new DOMException('Owned deadline','TimeoutError'));const error=await done;assert.equal(calls,1);assert.equal(error.type,'network');assert.equal(error.code,0);client.ngOnDestroy();
});

const {NativeTerminalCompletionService}=load('native-terminal-completion.service.ts');
function terminalCompletions(t){
 let scope=new AbortController(),token='actor-A';const calls=[];
 const session={get accessSignal(){return scope.signal;},access:()=>({token}),text:async(...args)=>{calls.push(args);return '';},replace(){scope.abort();scope=new AbortController();token='actor-B';}};
 bindings.set(Session,session);const service=new NativeTerminalCompletionService();t.after(()=>service.ngOnDestroy());return{session,service,calls};
}
test('a captured terminal log waits for its own navigation completion and settles before Starter claim refresh',async t=>{
 const f=terminalCompletions(t),scope=f.session.accessSignal,lease=f.service.begin('9007199254740995','terminate lock');let settled=false;
 const waiting=f.service.whenSettled(scope).then(()=>{settled=true;});await settle();assert.equal(settled,false);assert.equal(f.calls.length,0);
 await lease.complete();await waiting;assert.equal(settled,true);assert.equal(f.calls.length,1);
 assert.equal(f.calls[0][0],'PUT');assert.equal(f.calls[0][1],'/test/9007199254740995/log');assert.equal(f.calls[0][3],'actor-A');
 assert.equal(f.calls[0][2][0].key,'command executed');assert.equal(f.calls[0][2][0].content,'terminate lock');assert.ok(Number.isSafeInteger(f.calls[0][2][0].timeStamp));
 await lease.complete();assert.equal(f.calls.length,1);
});
test('terminal completion cannot follow a replacement actor or a retired grant into another request',async t=>{
 const f=terminalCompletions(t),scope=f.session.accessSignal,lease=f.service.begin('9007199254740995','terminate');f.session.replace();
 await lease.complete();await f.service.whenSettled(scope);assert.equal(f.calls.length,0);
});
test('actor retirement aborts an in-flight terminal log and releases the old Starter wait',async t=>{
 const f=terminalCompletions(t);let signal;
 f.session.text=(_method,_path,_body,_token,_raw,operation)=>{signal=operation;return new Promise((_resolve,reject)=>operation.addEventListener('abort',()=>reject(operation.reason),{once:true}));};
 const scope=f.session.accessSignal,lease=f.service.begin('9007199254740995','terminate'),pending=lease.complete();await settle();assert.equal(signal.aborted,false);f.session.replace();await pending;await f.service.whenSettled(scope);assert.equal(signal.aborted,true);
});
test('terminal log retries retain the captured test, actor, bytes and one logical deadline',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=terminalCompletions(t),attempts=[];
 f.session.text=async(...args)=>{attempts.push(args);if(attempts.length<3)throw new HttpError(503,'temporary');return '';};
 const lease=f.service.begin('9007199254740995','terminate lock'),done=lease.complete();await settle();t.mock.timers.tick(50);await settle();t.mock.timers.tick(500);await done;
 assert.equal(attempts.length,3);assert.equal(new Set(attempts.map(a=>JSON.stringify(a[2]))).size,1);assert.equal(new Set(attempts.map(a=>a[5])).size,1);
 assert.ok(attempts.every(a=>a[1]==='/test/9007199254740995/log'&&a[3]==='actor-A'));
});
test('cancelled or invalid terminal completion leases cannot send a log',async t=>{
 const f=terminalCompletions(t),lease=f.service.begin('9007199254740995','terminate');lease.cancel();await lease.complete();
 await f.service.begin('9223372036854775808','terminate').complete();await f.service.begin('another/run','terminate').complete();assert.equal(f.calls.length,0);
});
test('retirement during terminal-log backoff cancels the retry without an unhandled old-actor error',async t=>{
 t.mock.timers.enable({apis:['setTimeout']});const f=terminalCompletions(t);let requests=0;
 f.session.text=async()=>{requests++;throw new HttpError(503,'temporary');};
 const lease=f.service.begin('9007199254740995','terminate'),done=lease.complete();await settle();f.session.replace();await done;t.mock.timers.tick(5000);await settle();assert.equal(requests,1);
});
