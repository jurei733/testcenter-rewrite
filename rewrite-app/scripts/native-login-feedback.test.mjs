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
const {NativePublicHeaderService}=load('native-public-header.service.ts');
const {isExplicitOriginalAdminLogin,originalMissingRouteBookmark,originalParticipantBookmark,originalParticipantReturnPath,
 originalResultsHashDestination,prepareOriginalResultsEntry,rememberOriginalOperatorTab,takeOriginalResultsEntryFromOperatorTab
}=load('native-participant/original-participant-bookmark.ts');
test('Original participant bookmarks distinguish direct logins, explicit returns and reserved routes',()=>{
 assert.equal(originalParticipantBookmark('#/r/login'),'/native-start/login');
 assert.equal(originalParticipantBookmark('#/r/login/%2Fr%2Fstarter'),'/native-start/login?returnTo=%2Fr%2Fstarter');
 assert.equal(originalParticipantBookmark('#/Owned.Name'),'/native-start/direct?name=Owned.Name');
 for(const bookmark of ['#/admin','#/person/child','#/a%2Fb','#/a%5Cb','#/a%3Bb','#/%2e%2e','#/%FF']){
  assert.equal(originalParticipantBookmark(bookmark),null,bookmark);
 }
});
test('Original return destinations stay inside the existing guarded application routes',()=>{
 for(const [source,destination]of [
  ['/r/starter','/native-start/starter'],['/r/code-input','/native-start/dispatch'],['/r/login','/native-start/login'],
  ['/t/9/u/2?ui=original','/native-test/9/u/2?ui=original'],
  ['/gm/group.one/full','/group-monitor/group.one/full'],['/check/1/hardware','/check/1/hardware'],
  ['/privacy','/native-info/privacy']
 ])assert.equal(originalParticipantReturnPath(source),destination);
 for(const destination of ['https://owned.invalid','//owned.invalid','/gm/../login','/api/session','/t/123/(aux:other)','/gm/a\\b']){
  assert.equal(originalParticipantReturnPath(destination),'/native-start',destination);
 }
});
test('Direct Original test and monitor bookmarks select guarded destinations',()=>{
 for(const [source,destination]of [
  ['t/status','/native-test/status'],['t/9','/native-test/9'],['t/9/u/2?other=1','/native-test/9/u/2'],['t/9/status/','/native-test/9/status'],
  ['sm/2','/study-monitor/2'],['sm/002','/study-monitor/2'],
  ['am/experimental-one','/attachment-manager/experimental-one'],
  ['am/experimental-one/capture-image','/attachment-manager/experimental-one/capture-image'],
  ['gm/group.one','/group-monitor/group.one'],['gm/group%20one/full','/group-monitor/group%20one/full']
 ])assert.equal(originalParticipantBookmark('#/'+source),destination+'?legacyBookmark=1',source);
 for(const source of ['t/0','t/9/u/0','t/9/unknown','gm/a//b','gm/a%2Fb/full','gm/group/%2e%2e','gm/group/%5Cfull']){
  assert.equal(originalParticipantBookmark('#/'+source),null,source);
 }
});
test('Original administrative bookmarks retain targets for role and workspace checks',()=>{
 for(const path of ['admin/2/files','admin/2/tests','admin/2/unknown/extra','superadmin','superadmin/settings','superadmin/workspaces','superadmin/unknown/extra']){
  assert.equal(originalParticipantBookmark('#/'+path+'/?demoAdmin=sign-in'),'/'+path+'?legacyBookmark=1',path);
 }
 for(const path of ['admin/2%2F3/files','admin/2/%2e%2e','superadmin/%5Csettings','superadmin/(outside)']){
  assert.equal(originalParticipantBookmark('#/'+path),null,path);
 }
});
test('only the Results bookmark uses the presentation of an already open operator tab',()=>{
 const values=new Map(),history={length:1};
 const tab={history,sessionStorage:{getItem:key=>values.get(key),setItem:(key,value)=>values.set(key,value),removeItem:key=>values.delete(key)}};
 const results=originalResultsHashDestination('#/admin/2/results?returnUrl=https://owned.invalid');
 assert.equal(results,'/admin/2/results?legacyBookmark=1&ui=original');
 for(const hash of ['#/admin/2/files','#/admin/2/results/extra','#/admin/2%2F3/results','#/admin/name/results','#/gm/2/results']){
  assert.equal(originalResultsHashDestination(hash),null);
 }
 rememberOriginalOperatorTab(tab,true);
 prepareOriginalResultsEntry(results,tab);
 assert.equal(takeOriginalResultsEntryFromOperatorTab(),false,'a fresh tab may have copied storage from its opener');
 history.length=2;
 prepareOriginalResultsEntry('/admin/2/files?legacyBookmark=1',tab);
 assert.equal(takeOriginalResultsEntryFromOperatorTab(),false);
 prepareOriginalResultsEntry(results,tab);
 assert.equal(takeOriginalResultsEntryFromOperatorTab(),true);
 assert.equal(takeOriginalResultsEntryFromOperatorTab(),false,'reloading the normalized route does not reuse the presentation flag');
 rememberOriginalOperatorTab(tab,false);
 prepareOriginalResultsEntry(results,tab);
 assert.equal(takeOriginalResultsEntryFromOperatorTab(),false);
});
test('Original public and Systemcheck bookmarks select their cold entry screens',()=>{
 for(const notice of ['legal-notice','privacy','accessibility']){
  assert.equal(originalParticipantBookmark('#/'+notice+'/?name=unrelated'),'/native-info/'+notice);
 }
 for(const source of ['check/2/Check.A','check/02/Check.A/w/','check/%32/Check.A?irrelevant=1']){
  assert.equal(originalParticipantBookmark('#/'+source),'/check/2/Check.A/w',source);
 }
 for(const step of ['n','u','q','r']){
  assert.equal(originalParticipantBookmark('#/check/2/Check.A/'+step),'/native-start/dispatch');
 }
 for(const source of ['check/0/Check.A','check/2x/Check.A','check/2/Check%2FA','check/2/%2e%2e','check/2/Check.A/invalid']){
  assert.equal(originalParticipantBookmark('#/'+source),null,source);
 }
});
test('Recognized Original root bookmarks choose the same guarded entry without importing operator query hooks',()=>{
 const admin='/ops?ui=original&legacyLogin=1';
 const entries=[
  ['', '/native-start/dispatch'],['r','/native-start/dispatch'],['r/route-dispatcher','/native-start/dispatch'],
  ['r/code-input','/native-start/dispatch'],['r/starter','/native-start/starter'],
  ['r/check-starter','/r/check-starter'],['r/admin-login',admin]
 ];
 for(const [source,destination]of entries){
  assert.equal(originalParticipantBookmark('#/'+source),destination,source);
  assert.equal(originalParticipantBookmark('#/'+(source?source+'/':'')+'?demoAdmin=sign-in'),destination,source);
  assert.equal(originalMissingRouteBookmark('#/'+source),null,source);
 }
 assert.equal(originalParticipantReturnPath('/r/admin-login?demoAdmin=sign-in&returnUrl=%2Fhome'),admin);
 assert.equal(originalParticipantBookmark('#/%72/admin-login'),admin);
 assert.equal(originalParticipantBookmark('#/r%2Fadmin-login'),null);
 assert.equal(originalParticipantBookmark('#//'),null);
 assert.equal(isExplicitOriginalAdminLogin(admin),true);
 assert.equal(isExplicitOriginalAdminLogin('/ops?ui=original'),false);
 assert.equal(isExplicitOriginalAdminLogin('/home?legacyLogin=1'),false);
});
test('Unknown nested Original bookmarks display their full path without turning it into credentials',()=>{
 const hash='#/archiv/fehlt?seite=1', destination=originalMissingRouteBookmark(hash);
 assert.equal(originalParticipantBookmark(hash),null);
 assert.equal(destination,'/native-start/not-found?path=%2Farchiv%2Ffehlt%3Fseite%3D1');
 assert.equal(originalMissingRouteBookmark('#/r/fehlt'),'/native-start/not-found?path=%2Fr%2Ffehlt');
 for(const known of ['#/owned-user','#/r/login','#/r/check-starter','#/admin/2/files','#/t/2/u/1','#/gm/group/one','#/check/1/check/w','#/sm/study','#/am/section','#/bad/%FF']){
  assert.equal(originalMissingRouteBookmark(known),null,known);
 }
});
const entries=[['monitor',load('native-monitor/native-monitor-entry.component.ts').NativeMonitorEntryComponent],['participant',load('native-participant/native-participant-entry.component.ts').NativeParticipantEntryComponent]];
function fixture(Entry,snapshot){
 const scope=new AbortController(),problem$=new rx.BehaviorSubject('');
 const failures=[];
 const session={access:core.signal(null),busy:core.signal(false),restoring:core.signal(false),problem:core.signal(''),accessSignal:scope.signal};
 bindings=new Map(Object.entries({NativeMonitorSessionService:session,NativeAssetContext:{activate:owner=>owner.throwIfAborted()},NativeThemeContext:{activate:owner=>owner.throwIfAborted()},ApplicationSettingsService:{settings:()=>({appTitle:'Owned'})},HeaderService:{},BackendService:{problem$},ChangeDetectorRef:{markForCheck(){}},Router:{events:new rx.Subject(),getCurrentNavigation:()=>null,navigate:async()=>true},ActivatedRoute:{firstChild:null,snapshot},MatDialog:{},InterfaceModeService:{select(){}},MainDataService:{appTitle$:new rx.BehaviorSubject('')},CustomtextService:{restoreDefault(){},addCustomTexts(){}},NativeTerminalCompletionService:{},NativeLoginFailureService:{show:async(error,owner)=>failures.push({error,owner})}}));
 bindings.set('NativePublicHeaderService',new NativePublicHeaderService());
 bindings.set('NativeBackgroundService',{});
 bindings.set('NativeTestStarterService',{});
 const component=new Entry();component.name='owned-login';return {component,session,failures};
}
test('Going home from an unknown Original bookmark preserves the awaiting person-code session',()=>{
 const Entry=entries.find(([kind])=>kind==='participant')[1];
 const snapshot={data:{notFound:true},queryParamMap:{get:()=>'/archiv/fehlt'}};
 const {component,session}=fixture(Entry,snapshot);
 let logoutCalls=0;
 session.access.set({flags:['codeRequired']});
 session.logout=async()=>{logoutCalls++;};
 component.logoClick();
 assert.equal(component.missingRoute,'/archiv/fehlt');
 assert.equal(logoutCalls,0);
 component.ngOnDestroy();
});
test('An explicit Original participant login can replace a restored session and continue to the code step',async()=>{
 const Entry=entries.find(([kind])=>kind==='participant')[1];
 const snapshot={data:{explicitLogin:true},queryParamMap:{get:()=>null}};
 const {component,session}=fixture(Entry,snapshot);
 session.access.set({token:'restored',claims:{test:[]},flags:[]});
 const fresh={token:'fresh',claims:{},flags:['codeRequired'],customTexts:{}};
 session.loginParticipant=async()=>{session.access.set(fresh);return fresh;};
 const navigations=[];
 bindings.get('Router').navigate=async(commands,extras)=>{navigations.push({commands,extras});return true;};
 await component.submit();
 assert.equal(component.explicitLogin,true);
 assert.equal(session.access(),fresh);
 assert.deepEqual(navigations,[{commands:['/native-start'],extras:{replaceUrl:true}}]);
 component.ngOnDestroy();
});
test('The logo on an explicit Original Starter preserves the pending-code session',()=>{
 const Entry=entries.find(([kind])=>kind==='participant')[1];
 const {component,session}=fixture(Entry,{data:{legacyEntry:'starter'}});
 const pending={token:'pending',flags:['codeRequired']};
 session.access.set(pending);
 let calls=0;
 session.logout=async()=>{calls++;};
 component.logoClick();
 assert.equal(component.showCode,false);
 assert.equal(component.logoDestination,'/native-start/starter');
 assert.equal(session.access(),pending);
 assert.equal(calls,0);
 component.ngOnDestroy();
});
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
 const previousWindow=globalThis.window,previousDocument=globalThis.document;let location='http://owned.invalid/app/native-start';globalThis.window={location:{get href(){return location;},set href(value){location=value;reloads++;}}};globalThis.document={baseURI:'http://owned.invalid/app/'};t.after(()=>{if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;if(previousDocument===undefined)delete globalThis.document;else globalThis.document=previousDocument;});
 const session={get accessSignal(){return scope.signal;},clear(){clears++;}},dialogs={open(component,config){const ref={componentRef:{location:{nativeElement:{remove(){removed++;}}}},close(){closes++;closed.next();closed.complete();},afterClosed:()=>closed};opens.push({component,config,ref});return ref;}};
 bindings=new Map(Object.entries({MatDialog:dialogs,NativeMonitorSessionService:session,NativeErrorPresenterService:{register(){}}}));const service=new NativeLoginFailureService();
 return {service,view,opens,replace(){const old=scope;scope=new AbortController();old.abort();},get removed(){return removed;},get closes(){return closes;},get reloads(){return reloads;},get clears(){return clears;}};
}
test('unexpected login dialog uses the Source status mapping and only a live owner can reload',async t=>{
 const f=dialogFixture(t);await f.service.show(new HttpError(500),f.view.signal);assert.equal(f.opens.length,1);
 const {config}=f.opens[0];assert.equal(config.disableClose,true);assert.equal(config.autoFocus,'dialog');assert.equal(config.data.error.label,'Allgemeines Server-Problem.');assert.equal(config.data.error.type,'backend');
 config.data.reload();config.data.reload();assert.equal(f.reloads,1);assert.equal(f.clears,0);assert.equal(f.closes,1);assert.equal(f.removed,1);f.service.ngOnDestroy();
});
for(const retirement of ['view','session','service'])test('a pending login error presentation cannot open after '+retirement+' retirement',async t=>{
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
test('a newer pending login failure supersedes the retired presentation without opening two dialogs',async t=>{
 const f=dialogFixture(t),old=f.service.show(new HttpError(500),f.view.signal),current=f.service.show(new HttpError(503),f.view.signal);await Promise.all([old,current]);assert.equal(f.opens.length,1);assert.equal(f.opens[0].config.data.error.label,'Der Server ist augenblicklich nicht erreichbar');assert.equal(f.opens[0].config.data.error.type,'network_temporally');f.service.ngOnDestroy();
});

test('destroyed login error presenter cannot be reactivated by a later callback',async t=>{
 const f=dialogFixture(t);f.service.ngOnDestroy();await f.service.show(new HttpError(500),f.view.signal);assert.deepEqual(f.opens,[]);
});

for(const [globalTheme,effectiveTheme]of [['Erwachsene','Primar'],['Primar','Sekundar']])test('participant logout follows authored '+effectiveTheme+' rather than global '+globalTheme,()=>{
 const Entry=entries.find(([name])=>name==='participant')[1],f=fixture(Entry),options=[],closed=new rx.Subject();
 Object.assign(bindings.get('ApplicationSettingsService'),{settings:()=>({themeName:globalTheme}),effectiveThemeName:()=>effectiveTheme});
 bindings.get('MatDialog').open=(_component,config)=>{options.push(config);return {afterClosed:()=>closed,close(){}};};
 f.component.logout();assert.equal(options[0].panelClass,'original-participant-logout-dialog');assert.equal(options[0].data.safeMode,effectiveTheme==='Primar');f.component.ngOnDestroy();assert.equal(closed.observed,false);
});
for(const replacement of ['actor','view',null])test('code-login logo logout cannot expose a late error after '+String(replacement)+' retirement',async()=>{
 const Entry=entries.find(([name])=>name==='participant')[1],f=fixture(Entry);let reject,calls=0;
 f.session.access.set({token:'actor-A',flags:['codeRequired']});
 f.session.logout=()=>{calls++;f.session.access.set(null);f.session.accessSignal=new AbortController().signal;return new Promise((_done,fail)=>{reject=fail;});};
 f.component.logoClick();assert.equal(calls,1);assert.equal(f.session.access(),null);
 if(replacement==='actor'){f.session.accessSignal=new AbortController().signal;f.session.access.set({token:'actor-B',flags:[]});}else if(replacement==='view')f.component.ngOnDestroy();
 reject(Error('Owned logout failure'));await new Promise(done=>setImmediate(done));assert.equal(f.component.problem(),replacement===null?'Owned logout failure':'');f.component.ngOnDestroy();
});
test('the logo preserves a verified Starter session and a retired code view cannot log out',()=>{
 const Entry=entries.find(([name])=>name==='participant')[1],f=fixture(Entry);let calls=0;f.session.logout=async()=>{calls++;};
 f.session.access.set({token:'actor-A',flags:[]});f.component.logoClick();assert.equal(calls,0);
 f.component.ngOnDestroy();f.session.access.set({token:'actor-A',flags:['codeRequired']});f.component.logoClick();assert.equal(calls,0);
});

for(const role of ['testGroupMonitor','workspaceAdmin','superAdmin'])test('general native entry preserves Source adult confirmation for a Primar '+role+' claim',()=>{
 const Entry=entries.find(([name])=>name==='participant')[1],f=fixture(Entry),options=[],closed=new rx.Subject();
 Object.assign(bindings.get('ApplicationSettingsService'),{settings:()=>({themeName:'Erwachsene'}),effectiveThemeName:()=> 'Primar'});
 f.session.access.set({token:'owned-monitor',flags:[],claims:{[role]:[]}});
 bindings.get('MatDialog').open=(_component,config)=>{options.push(config);return {afterClosed:()=>closed,close(){}};};
 f.component.logout();assert.equal(options[0].data.safeMode,false);assert.equal(options[0].panelClass,'original-participant-logout-dialog');f.component.ngOnDestroy();assert.equal(closed.observed,false);
});
