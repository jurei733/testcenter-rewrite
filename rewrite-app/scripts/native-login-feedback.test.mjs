import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as core from '@angular/core';
import * as rx from 'rxjs';
import {redactBugReportText} from '@testcenter-rewrite-app/contracts';
class BrowserHttpError {constructor(value){Object.assign(this,value);this.headers=value.headers??{get:()=>null};this.message='Owned HTTP transport failure';}}
const tokens=new Map(),names=new Map();let bindings;
class HttpError extends Error {constructor(status){super('Owned private server detail');this.status=status;}}
const imports=new Proxy({}, {get:(_,name)=>{if(name==='then')return undefined;if(!tokens.has(name)){const token=class{};tokens.set(name,token);names.set(token,name);}return tokens.get(name);}});
function load(relative){
 const source=readFileSync(new URL('../apps/web/src/app/'+relative,import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
 const exports={};new Function('exports','require',code)(exports,spec=>{
  if(spec==='@angular/core')return {...core,Component:()=>value=>value,effect:callback=>callback(),inject:key=>{const name=names.get(key)??key.name;assert.ok(bindings.has(name),'Missing dependency '+name);return bindings.get(name);}};
  if(spec==='rxjs')return rx;
  if(spec==='@angular/common/http')return {HttpErrorResponse:BrowserHttpError,HttpHeaders:class{constructor(values){this.get=key=>values[key]??null;}}};
  if(spec==='@testcenter-rewrite-app/contracts')return {redactBugReportText};
  if(spec.endsWith('native-http-policy'))return load('native-participant/native-http-policy.ts');
  if(spec.endsWith('app.interfaces'))return load('native-participant/app.interfaces.ts');
  if(spec.endsWith('native-login-problem'))return load('native-login-problem.ts');
  if(spec.endsWith('native-session.service'))return {NativeMonitorSessionService:imports.NativeMonitorSessionService,NativeMonitorHttpError:HttpError};
  return imports;
 });return exports;
}
const entries=[['monitor',load('native-monitor/native-monitor-entry.component.ts').NativeMonitorEntryComponent],['participant',load('native-participant/native-participant-entry.component.ts').NativeParticipantEntryComponent]];
function fixture(Entry){
 const scope=new AbortController(),problem$=new rx.BehaviorSubject('');
 const failures=[];
 const session={access:core.signal(null),busy:core.signal(false),problem:core.signal(''),accessSignal:scope.signal};
 bindings=new Map(Object.entries({NativeMonitorSessionService:session,ApplicationSettingsService:{settings:()=>({appTitle:'Owned'})},HeaderService:{},BackendService:{problem$},ChangeDetectorRef:{markForCheck(){}},Router:{events:new rx.Subject(),navigate:async()=>true},ActivatedRoute:{firstChild:null},MatDialog:{},InterfaceModeService:{select(){}},MainDataService:{appTitle$:new rx.BehaviorSubject('')},CustomtextService:{restoreDefault(){},addCustomTexts(){}},NativeTerminalCompletionService:{},NativeLoginFailureService:{show:async(error,owner)=>failures.push({error,owner})}}));
 const component=new Entry();component.name='owned-login';return {component,session,failures};
}
for(const [entry,Entry]of entries){
 for(const [status,message]of [[400,'Anmeldedaten sind nicht gültig. Bitte noch einmal versuchen!'],[401,'Anmeldung abgelehnt. Anmeldedaten sind noch nicht freigeben.'],[204,'Anmeldedaten sind gültig, aber es sind keine Arbeitsbereiche oder Tests freigegeben.'],[410,'Anmeldedaten sind abgelaufen'],[429,'Zu viele Fehlversuche! Probieren Sie es zu einem späteren Zeitpunkt noch einmal.']])test(entry+': final credential rejection '+status+' resets both fields and reports only the Original inline message',async()=>{
  const {component:c,session:s}=fixture(Entry);c.passwordStep.set(true);c.password='owned bad password';let credentials;
  s.login=s.loginParticipant=async(name,password)=>{credentials={name,password};s.problem.set('private detail');throw new HttpError(status);};
  await c.submit();assert.deepEqual(credentials,{name:'owned-login',password:'owned bad password'});assert.equal(c.passwordStep(),false);assert.equal(c.name,'');assert.equal(c.password,'');assert.equal(c.loginProblem(),message);assert.equal(c.loginProblemCode(),status);assert.equal(c.loginProblemLevel(),'error');assert.equal(c.problem(),'');assert.equal(s.problem(),'');c.ngOnDestroy();
 });
 test(entry+': first-factor HTTP rejection still asks for the password and retains the login name',async()=>{
  const {component:c,session:s}=fixture(Entry);let supplied;
  s.login=s.loginParticipant=async(name,password)=>{supplied={name,password};throw new HttpError(429);};
  await c.submit();assert.deepEqual(supplied,{name:'owned-login',password:''});assert.equal(c.passwordStep(),true);assert.equal(c.name,'owned-login');assert.equal(c.loginProblem(),'');assert.equal(c.loginProblemCode(),429);assert.equal(c.problem(),'');c.ngOnDestroy();
 });
 test(entry+': late final credential error cannot reset a retired form or expose an alert',async()=>{
  const {component:c,session:s}=fixture(Entry);c.passwordStep.set(true);c.password='owned retained password';let reject,owner;
  s.login=s.loginParticipant=(_name,_password,signal)=>{owner=signal;return new Promise((_resolve,r)=>{reject=r;});};
  const pending=c.submit();c.ngOnDestroy();reject(new HttpError(400));await pending;assert.equal(owner.aborted,true);assert.equal(c.passwordStep(),true);assert.equal(c.name,'owned-login');assert.equal(c.password,'owned retained password');assert.equal(c.loginProblem(),'');assert.equal(c.problem(),'');
 });
 test(entry+': password keyup clears the old error and follows CapsLock state without requiring getModifierState',()=>{
  const {component:c}=fixture(Entry);c.loginProblemCode.set(400);c.passwordKeyUp({getModifierState:key=>key==='CapsLock'});assert.equal(c.loginProblem(),'Feststelltaste ist aktiviert!');assert.equal(c.loginProblemLevel(),'warning');assert.equal(c.loginProblemCode(),0);c.passwordKeyUp({});assert.equal(c.loginProblem(),'');assert.equal(c.loginProblemLevel(),'error');c.ngOnDestroy();
 });
}

for(const [entry,Entry]of entries){
 test(entry+': unexpected final HTTP500 retains credentials and opens the owned Source error dialog',async()=>{
  const {component:c,session:s,failures}=fixture(Entry);c.passwordStep.set(true);c.password='Owned retained password';
  const error=new HttpError(500);s.login=s.loginParticipant=async()=>{s.problem.set('Owned private server detail');throw error;};
  await c.submit();assert.equal(c.passwordStep(),true);assert.equal(c.name,'owned-login');assert.equal(c.password,'Owned retained password');
  assert.equal(c.loginProblem(),'Problem bei der Anmeldung.');assert.equal(c.loginProblemCode(),500);assert.equal(c.loginProblemLevel(),'error');
  assert.equal(c.problem(),'');assert.equal(s.problem(),'');assert.equal(failures.length,1);assert.equal(failures[0].error,error);assert.equal(failures[0].owner.aborted,false);c.ngOnDestroy();assert.equal(failures[0].owner.aborted,true);
 });
 test(entry+': retired unexpected HTTP500 cannot open an error dialog',async()=>{
  const {component:c,session:s,failures}=fixture(Entry);c.passwordStep.set(true);c.password='Owned retained password';let reject;
  s.login=s.loginParticipant=()=>new Promise((_resolve,r)=>{reject=r;});
  const pending=c.submit();c.ngOnDestroy();reject(new HttpError(500));await pending;
  assert.deepEqual(failures,[]);assert.equal(c.loginProblem(),'');assert.equal(c.problem(),'');assert.equal(c.password,'Owned retained password');
 });
 test(entry+': security worker failure retains its actionable existing message',async()=>{
  const {component:c,session:s,failures}=fixture(Entry);c.passwordStep.set(true);c.password='Owned password';
  s.login=s.loginParticipant=async()=>{throw Error('Die Sicherheitsprüfung konnte nicht geladen werden. Bitte erneut versuchen.');};
  await c.submit();assert.equal(c.problem(),'Die Sicherheitsprüfung konnte nicht geladen werden. Bitte erneut versuchen.');assert.deepEqual(failures,[]);assert.equal(c.passwordStep(),true);c.ngOnDestroy();
 });
}

const {NativeLoginFailureService}=load('native-login-failure.service.ts');
function dialogFixture(t){
 let scope=new AbortController();const view=new AbortController(),opens=[],closed=new rx.Subject();let removed=0,closes=0,reloads=0,clears=0;
 const previousWindow=globalThis.window;globalThis.window={location:{href:'http://owned.invalid/app/native-start',reload(){reloads++;}}};t.after(()=>{if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;});
 const session={get accessSignal(){return scope.signal;},clear(){clears++;}},dialogs={open(component,config){const ref={componentRef:{location:{nativeElement:{remove(){removed++;}}}},close(){closes++;closed.next();closed.complete();},afterClosed:()=>closed};opens.push({component,config,ref});return ref;}};
 bindings=new Map(Object.entries({MatDialog:dialogs,NativeMonitorSessionService:session}));const service=new NativeLoginFailureService();
 return {service,view,opens,replace(){const old=scope;scope=new AbortController();old.abort();},get removed(){return removed;},get closes(){return closes;},get reloads(){return reloads;},get clears(){return clears;}};
}
test('unexpected login dialog uses the Source status mapping and only a live owner can reload',async t=>{
 const f=dialogFixture(t);await f.service.show(new HttpError(500),f.view.signal);assert.equal(f.opens.length,1);
 const {config}=f.opens[0];assert.equal(config.disableClose,true);assert.equal(config.autoFocus,'dialog');assert.equal(config.data.error.label,'Allgemeines Server-Problem.');assert.equal(config.data.error.type,'backend');
 config.data.reload();config.data.reload();assert.equal(f.reloads,1);assert.equal(f.clears,0);assert.equal(f.closes,1);assert.equal(f.removed,1);f.service.ngOnDestroy();
});
for(const retirement of ['view','session','service'])test('a pending login error import cannot open after '+retirement+' retirement',async t=>{
 const f=dialogFixture(t),pending=f.service.show(new HttpError(500),f.view.signal);
 if(retirement==='view')f.view.abort();else if(retirement==='session')f.replace();else f.service.ngOnDestroy();
 await pending;assert.deepEqual(f.opens,[]);assert.equal(f.reloads,0);f.service.ngOnDestroy();
});
for(const retirement of ['view','session','service'])test('a visible login error closes and its old reload is inert after '+retirement+' retirement',async t=>{
 const f=dialogFixture(t);await f.service.show(new HttpError(500),f.view.signal);const reload=f.opens[0].config.data.reload;
 if(retirement==='view')f.view.abort();else if(retirement==='session')f.replace();else f.service.ngOnDestroy();
 reload();assert.equal(f.closes,1);assert.equal(f.removed,1);assert.equal(f.reloads,0);assert.equal(f.clears,0);f.service.ngOnDestroy();
});
test('Source session-type error resets the native access only on an authorized reload action',async t=>{
 const f=dialogFixture(t);await f.service.show(new HttpError(403),f.view.signal);assert.equal(f.clears,0);assert.equal(f.opens[0].config.data.error.type,'session');f.opens[0].config.data.reload();assert.equal(f.clears,1);assert.equal(f.reloads,1);f.service.ngOnDestroy();
});
test('a newer pending login failure supersedes the retired lazy import without opening two dialogs',async t=>{
 const f=dialogFixture(t),old=f.service.show(new HttpError(500),f.view.signal),current=f.service.show(new HttpError(503),f.view.signal);await Promise.all([old,current]);assert.equal(f.opens.length,1);assert.equal(f.opens[0].config.data.error.label,'Der Server ist augenblicklich nicht erreichbar');assert.equal(f.opens[0].config.data.error.type,'network_temporally');f.service.ngOnDestroy();
});

test('destroyed login error presenter cannot be reactivated by a later callback',async t=>{
 const f=dialogFixture(t);f.service.ngOnDestroy();await f.service.show(new HttpError(500),f.view.signal);assert.deepEqual(f.opens,[]);
});
