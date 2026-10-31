import assert from 'node:assert/strict';
import test from 'node:test';
import {readFileSync} from 'node:fs';
import ts from 'typescript';
import * as core from '@angular/core';
import * as rx from 'rxjs';
const tokens=new Map(),names=new Map();let bindings;
class HttpError extends Error {constructor(status){super('Owned private server detail');this.status=status;}}
const imports=new Proxy({}, {get:(_,name)=>{if(!tokens.has(name)){const token=class{};tokens.set(name,token);names.set(token,name);}return tokens.get(name);}});
function load(relative){
 const source=readFileSync(new URL('../apps/web/src/app/'+relative,import.meta.url),'utf8');
 const code=ts.transpileModule(source,{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.CommonJS,experimentalDecorators:true}}).outputText;
 const exports={};new Function('exports','require',code)(exports,spec=>{
  if(spec==='@angular/core')return {...core,Component:()=>value=>value,effect:callback=>callback(),inject:key=>{const name=names.get(key)??key.name;assert.ok(bindings.has(name),'Missing dependency '+name);return bindings.get(name);}};
  if(spec==='rxjs')return rx;
  if(spec.endsWith('native-login-problem'))return load('native-login-problem.ts');
  if(spec.endsWith('native-session.service'))return {NativeMonitorSessionService:imports.NativeMonitorSessionService,NativeMonitorHttpError:HttpError};
  return imports;
 });return exports;
}
const entries=[['monitor',load('native-monitor/native-monitor-entry.component.ts').NativeMonitorEntryComponent],['participant',load('native-participant/native-participant-entry.component.ts').NativeParticipantEntryComponent]];
function fixture(Entry){
 const scope=new AbortController(),problem$=new rx.BehaviorSubject('');
 const session={access:core.signal(null),busy:core.signal(false),problem:core.signal(''),accessSignal:scope.signal};
 bindings=new Map(Object.entries({NativeMonitorSessionService:session,ApplicationSettingsService:{settings:()=>({appTitle:'Owned'})},HeaderService:{},BackendService:{problem$},ChangeDetectorRef:{markForCheck(){}},Router:{events:new rx.Subject(),navigate:async()=>true},ActivatedRoute:{firstChild:null},MatDialog:{},InterfaceModeService:{select(){}},MainDataService:{appTitle$:new rx.BehaviorSubject('')},CustomtextService:{restoreDefault(){},addCustomTexts(){}},NativeTerminalCompletionService:{}}));
 const component=new Entry();component.name='owned-login';return {component,session};
}
for(const [entry,Entry]of entries){
 for(const [status,message]of [[400,'Anmeldedaten sind nicht gültig. Bitte noch einmal versuchen!'],[429,'Zu viele Fehlversuche! Probieren Sie es zu einem späteren Zeitpunkt noch einmal.']])test(entry+': final credential rejection '+status+' resets both fields and reports only the Original inline message',async()=>{
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
