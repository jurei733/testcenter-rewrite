import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { compileBookletRuntimePolicy, parseVeronaUnitResponse, productionApiRoutes, resolveRoutePath, resolveParticipantCustomText, serializeVeronaUnitResponse } from "@testcenter-rewrite-app/contracts";
import { bookletStarterExitDeniedReasons } from "@testcenter-rewrite-app/contracts/booklet-completeness";
import { participantStarterExitPreparationRoute } from "@testcenter-rewrite-app/contracts/participant-starter-exit";
import { completenessCases } from "./exit-completeness-fixture.mjs";

async function executableClass(file,name,selected) {
  const source=await readFile(new URL(`../apps/web/src/app/${file}`,import.meta.url),"utf8");
  const ast=ts.createSourceFile(file,source,ts.ScriptTarget.Latest,true);
  const declaration=ast.statements.find(node=>ts.isClassDeclaration(node)&&node.name?.text===name);
  assert.ok(declaration);
  const transformed=ts.transform(declaration,[context=>{
    const visit=node=>{
      const clean=ts.visitEachChild(node,visit,context);
      if(clean.modifiers)clean.modifiers=ts.factory.createNodeArray(clean.modifiers.filter(modifier=>!ts.isDecorator(modifier)));
      return clean;
    };return visit;
  }]);
  const cleaned=transformed.transformed[0];
  if(selected)cleaned.members=ts.factory.createNodeArray(cleaned.members.filter(node=>selected.includes(node.name?.getText(ast))));
  const text=ts.createPrinter().printNode(ts.EmitHint.Unspecified,cleaned,ast);transformed.dispose();
  return ts.transpileModule(text.replace("export class ","class "),{compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
}
const facadeSource=await executableClass("participant-view.facade.ts","ParticipantViewFacade",[
  "returnToStarterWithConfirmation","requestConfirmation","resolveConfirmation","clearNavigationAdvisory"]);
const policySource=ts.transpileModule(await readFile(new URL("../apps/web/src/app/participant-exit-policy.ts",import.meta.url),"utf8"),
  {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/^(?:import .*|export \{.*\} from .*);$/gm,"").replace("export function ","function ");
const planParticipantStarterExit=new Function("bookletStarterExitDeniedReasons","parseVeronaUnitResponse",`${policySource}\nreturn planParticipantStarterExit;`)(bookletStarterExitDeniedReasons,parseVeronaUnitResponse);
// Only module transport is supplied; the actual shipped policy is executed.
const Facade=new Function("exitPolicy",`${facadeSource.replace('import("./participant-exit-policy")','Promise.resolve(exitPolicy)')}\nreturn ParticipantViewFacade;`)({planParticipantStarterExit,participantStarterExitPreparationRoute});
const parentSource=await executableClass("participant-view.component.ts","ParticipantViewComponent",["resolveOriginalConfirmation"]);
const Parent=new Function(`${parentSource}\nreturn ParticipantViewComponent;`)();
const launcherSource=await executableClass("original-participant-confirmation-dialog.component.ts","OriginalParticipantConfirmationLauncherComponent");
const signal=initial=>{let value=initial;const result=()=>value;result.set=next=>{value=next;};return result;};
function facadeFixture({saving=true,force=true,timer=null,lock=null,customTexts={},progress={presentation:"complete",response:"complete"},required=false,unlocked=false,forceNavigation=true,status="running",silent=false}={}) {
  const facade=new Facade(),returns=[],preparations=[];
  let state={testRun:{testRunId:"run-a",status,monitorNavigationUnlocked:unlocked},executionMode:{saveResponses:saving,forceTimeRestrictions:force,forceNaviRestrictions:forceNavigation},
    currentUnit:{unitKey:"own-unit"},booklet:{policy:compileBookletRuntimePolicy({...(required?{force_presentation_complete:"ALWAYS",force_response_complete:"ALWAYS"}:{}),silent_mode:silent?"TRUE":"FALSE"})}};
  facade.runtime={currentUnitResponse:serializeVeronaUnitResponse({unitState:{presentationProgress:progress.presentation,responseProgress:progress.response}})};
  facade.viewLifecycleSequence=1;facade.player={testletTimer:timer,leaveLock:lock};
  facade.readCurrentRunState=()=>state;facade.confirmationDialog=signal(null);
  facade.originalNavigationToast=signal(null);facade.navigationAdvisory=signal(null);
  facade.customText=(key,fallback)=>resolveParticipantCustomText(customTexts,key,fallback);
  facade.leaveLockConfirmationTitle=()=>"Rewrite lock title";
  facade.leaveLockConfirmationText=()=>"Rewrite lock message";
  facade.returnToStarterInternal=async(...args)=>returns.push(args);
  facade.prepareStarterExitTimer=async route=>{preparations.push(route);facade.player.testletTimer={...timer,status:timer?.leave==="allowed"?"cancelled":"paused"};return true;};
  const parent=new Parent();parent.view=facade;
  return{facade,parent,returns,preparations,replaceRun(){state={...state,testRun:{testRunId:"run-b"}};},replaceUnit(){state={...state,currentUnit:{unitKey:"new-unit"}};},replaceStatus(){state={...state,testRun:{...state.testRun,status:"paused"}};}};
}
test("saved logo exit asks once, cancellation preserves the Run, and confirmation returns once",async()=>{
  const f=facadeFixture();const cancelled=f.facade.returnToStarterWithConfirmation();await Promise.resolve();
  const first=f.facade.confirmationDialog();assert.equal(first.title,"Return to test selection?");
  assert.deepEqual(first.original,{title:"Sicher, dass du den Test beenden möchtest?",message:"",cancelLabel:"Abbrechen",confirmLabel:"Bestätigen",confirmMeansContinue:true});
  f.parent.resolveOriginalConfirmation(first,false);await cancelled;assert.deepEqual(f.returns,[]);
  const confirmed=f.facade.returnToStarterWithConfirmation();await Promise.resolve();const second=f.facade.confirmationDialog();
  f.parent.resolveOriginalConfirmation(second,true);f.parent.resolveOriginalConfirmation(second,true);
  await confirmed;assert.deepEqual(f.returns,[[false,false]]);
});
for(const scope of ["unit","testlet"])test(`Source ${scope} leave warning shares a single saved exit confirmation`,async()=>{
  const f=facadeFixture({lock:{scope,confirm:true}}),pending=f.facade.returnToStarterWithConfirmation();await Promise.resolve();
  const request=f.facade.confirmationDialog();
  assert.equal(request.original.message,resolveParticipantCustomText({},`booklet_warningLeaveTextPrompt-${scope}`));
  assert.equal(request.original.confirmMeansContinue,false);
  f.parent.resolveOriginalConfirmation(request,true);await pending;assert.deepEqual(f.returns,[[false,true]]);
});
test("forced timed exit uses scoped Original copy and short-circuits the later lock check",async()=>{
  const f=facadeFixture({timer:{leave:"confirm",displayLabel:"Own block"},lock:{scope:"unit",confirm:true},
    customTexts:{booklet_warningLeaveTimerBlockTextPrompt:"Own timer warning Ω"}});
  const pending=f.facade.returnToStarterWithConfirmation();await Promise.resolve();const request=f.facade.confirmationDialog();
  assert.deepEqual(request.original,{title:"Sicher, dass du den Test beenden möchtest?",message:"Own timer warning Ω",
    cancelLabel:"Trotzdem weiter",confirmLabel:"Hier bleiben",confirmMeansContinue:false});
  f.parent.resolveOriginalConfirmation(request,true);await pending;assert.deepEqual(f.returns,[[true,false]]);assert.deepEqual(f.preparations,[]);
});
test("non-saving timed confirmation keeps its scoped Source title",async()=>{
  const f=facadeFixture({saving:false,timer:{leave:"confirm"},customTexts:{booklet_warningLeaveTimerBlockTitle:"Own title"}});
  const pending=f.facade.returnToStarterWithConfirmation();await Promise.resolve();const request=f.facade.confirmationDialog();
  assert.equal(request.original.title,"Own title");f.parent.resolveOriginalConfirmation(request,false);
  await pending;assert.deepEqual(f.returns,[]);
});
test("enforced forbidden timer reports every attempt and cannot ask or return",async()=>{
  const f=facadeFixture({timer:{leave:"forbidden",displayLabel:"Own block"}});
  await f.facade.returnToStarterWithConfirmation();const first=f.facade.originalNavigationToast();
  await f.facade.returnToStarterWithConfirmation();assert.notEqual(f.facade.originalNavigationToast(),first);
  assert.equal(first.text,"Es darf erst weiter geblättert werden, wenn die Zeit abgelaufen ist.");
  assert.equal(f.facade.confirmationDialog(),null);assert.deepEqual(f.returns,[]);
  f.facade.clearNavigationAdvisory();assert.equal(f.facade.originalNavigationToast(),null);
});
for(const leave of ["confirm","forbidden"])test(`unenforced non-saving ${leave} timer can leave without a saving dialog`,async()=>{
  const f=facadeFixture({saving:false,force:false,timer:{leave}});
  await f.facade.returnToStarterWithConfirmation();assert.equal(f.facade.confirmationDialog(),null);
  assert.equal(f.facade.originalNavigationToast().text,leave==="confirm"?"Im normalen Testablauf wird beim Verlassen des zeitbegrenzten Blocks eine Warnung angezeigt.":"Im Testmodus wäre die Navigation vor Ablauf der Zeit nicht möglich.");
  assert.deepEqual(f.preparations,[participantStarterExitPreparationRoute]);assert.deepEqual(f.returns,[[false,false]]);
});
for(const changed of ["run","lifecycle","unit","status"])test(`late ${changed} change cannot return a different live Run`,async()=>{
  const f=facadeFixture(),pending=f.facade.returnToStarterWithConfirmation();await Promise.resolve();const request=f.facade.confirmationDialog();
  if(changed==="run")f.replaceRun();else if(changed==="unit")f.replaceUnit();else if(changed==="status")f.replaceStatus();else f.facade.viewLifecycleSequence++;
  f.parent.resolveOriginalConfirmation(request,true);await pending;assert.deepEqual(f.returns,[]);
});
test("a replaced confirmation cancels its old promise and rejects old overlay results",async()=>{
  const f=facadeFixture(),first=f.facade.returnToStarterWithConfirmation();await Promise.resolve();const old=f.facade.confirmationDialog();
  const second=f.facade.returnToStarterWithConfirmation();await Promise.resolve();const live=f.facade.confirmationDialog();
  f.parent.resolveOriginalConfirmation(old,true);assert.equal(f.facade.confirmationDialog(),live);
  await first;assert.deepEqual(f.returns,[]);f.parent.resolveOriginalConfirmation(live,true);await second;
  assert.deepEqual(f.returns,[[false,false]]);
});
for(const [name,progress] of Object.entries(completenessCases)) for(const leave of ["none","confirm","forbidden"]) test(`${name}/${leave}: local incomplete report opens only scoped information before timer/lock`,async()=>{
  const f=facadeFixture({required:true,progress,timer:leave==="none"?null:{leave},lock:{scope:"unit",confirm:true},
    customTexts:{booklet_msgNavigationDeniedTitle:"Own denial Ω",booklet_msgNavigationDeniedText_presentationIncomplete:"Own unseen",booklet_msgNavigationDeniedText_responsesIncomplete:"Own missing"}});
  const pending=f.facade.returnToStarterWithConfirmation();await Promise.resolve();const request=f.facade.confirmationDialog();
  assert.equal(request.kind,"information");assert.equal(request.original.title,"Own denial Ω");
  assert.equal(request.original.message,progress.reasons.map(reason=>reason==="presentation_incomplete"?"Own unseen":"Own missing").join(" "));
  assert.equal(f.facade.originalNavigationToast(),null);
  // Even a malformed/obsolete positive overlay result cannot turn information
  // into an approved exit. The production method always returns after it.
  f.parent.resolveOriginalConfirmation(request,true);await pending;assert.deepEqual(f.returns,[]);
});
test("a locally complete report does not repeat an obsolete completeness denial",async()=>{
  const f=facadeFixture({required:true});const pending=f.facade.returnToStarterWithConfirmation();await Promise.resolve();
  const request=f.facade.confirmationDialog();assert.equal(request.kind,undefined);
  f.parent.resolveOriginalConfirmation(request,true);await pending;assert.deepEqual(f.returns,[[false,false]]);
});
for(const forceNavigation of [false,true])test(`${forceNavigation?"monitor override":"advisory mode"}: incomplete report can exit without information`,async()=>{
  const f=facadeFixture({required:true,progress:completenessCases.both,forceNavigation,unlocked:forceNavigation});
  const pending=f.facade.returnToStarterWithConfirmation();await Promise.resolve();const request=f.facade.confirmationDialog();
  assert.equal(request.kind,undefined);
  if(!forceNavigation)assert.match(f.facade.originalNavigationToast().text,/Es wurde nicht alles gesehen oder abgespielt\. Es wurde nicht alles bearbeitet\./);
  f.parent.resolveOriginalConfirmation(request,true);await pending;assert.deepEqual(f.returns,[[false,false]]);
});
for(const changed of ["run","lifecycle","unit","status"])test(`lazy policy boundary: changed ${changed} cannot open or return an obsolete Run`,async()=>{
  const f=facadeFixture();const pending=f.facade.returnToStarterWithConfirmation();
  if(changed==="run")f.replaceRun();else if(changed==="unit")f.replaceUnit();else if(changed==="status")f.replaceStatus();else f.facade.viewLifecycleSequence++;
  await pending;assert.equal(f.facade.confirmationDialog(),null);assert.deepEqual(f.returns,[]);
});
test("missing structured presentation is incomplete, while absent response progress does not fabricate a denial",async()=>{
  const f=facadeFixture({required:true});
  f.facade.runtime.currentUnitResponse=serializeVeronaUnitResponse({unitState:{responseProgress:"complete"}});
  let pending=f.facade.returnToStarterWithConfirmation();await Promise.resolve();let request=f.facade.confirmationDialog();
  assert.equal(request.kind,"information");assert.equal(request.message,resolveParticipantCustomText({},"booklet_msgNavigationDeniedText_presentationIncomplete"));
  f.parent.resolveOriginalConfirmation(request,false);await pending;
  f.facade.runtime.currentUnitResponse=serializeVeronaUnitResponse({unitState:{presentationProgress:"complete"}});
  pending=f.facade.returnToStarterWithConfirmation();await Promise.resolve();request=f.facade.confirmationDialog();
  assert.equal(request.kind,undefined);f.parent.resolveOriginalConfirmation(request,false);await pending;
});
test("a fresh unreported Player denies required presentation without fabricating a response reason",async()=>{
  const f=facadeFixture({required:true});f.facade.runtime.currentUnitResponse="";
  const pending=f.facade.returnToStarterWithConfirmation();await Promise.resolve();const request=f.facade.confirmationDialog();
  assert.equal(request.kind,"information");assert.equal(request.message,resolveParticipantCustomText({},"booklet_msgNavigationDeniedText_presentationIncomplete"));
  f.parent.resolveOriginalConfirmation(request,false);await pending;
});
const internalSource=await executableClass("participant-view.facade.ts","ParticipantViewFacade",["returnToStarterInternal"]);
const InternalFacade=new Function("productionApiRoutes","resolveRoutePath",`${internalSource}\nreturn ParticipantViewFacade;`)(productionApiRoutes,resolveRoutePath);
for(const stage of ["settle","save"])for(const changed of ["run","lifecycle","unit","status"])test(`foreground ${stage}: late ${changed} cannot save or return a replacement Run`,async()=>{
  const facade=new InternalFacade(),calls=[];
  let state={testRun:{testRunId:"run-a"},currentUnit:{unitKey:"unit-a"},executionMode:{saveResponses:true}},release;
  const gate=new Promise(done=>{release=done;});
  facade.viewLifecycleSequence=1;facade.runtime={testRunId:"run-a"};facade.readCurrentRunState=()=>state;
  facade.settleVeronaAutoSaveBeforeForegroundAction=async()=>{if(stage==="settle")await gate;return null;};
  facade.saveCurrentDraftBeforeCompleteInternal=async()=>{calls.push("save");if(stage==="save")await gate;};
  facade.requestState={request(){throw Error("An obsolete foreground action must never send a return request.");}};
  const pending=facade.returnToStarterInternal(false,false);await Promise.resolve();
  if(changed==="run"){state={...state,testRun:{testRunId:"run-b"}};facade.runtime.testRunId="run-b";}else if(changed==="unit")state={...state,currentUnit:{unitKey:"unit-b"}};else if(changed==="status")state={...state,testRun:{...state.testRun,status:"paused"}};else facade.viewLifecycleSequence++;
  release();await pending;assert.deepEqual(calls,stage==="settle"?[]:["save"]);
});
for(const changed of ["run","lifecycle","unit","status"])test(`late return response: changed ${changed} cannot clear a replacement view`,async()=>{
  const facade=new InternalFacade();let state={testRun:{testRunId:"run-a"},currentUnit:{unitKey:"unit-a"},executionMode:{saveResponses:true}},release,path;
  const gate=new Promise(done=>{release=done;});
  facade.viewLifecycleSequence=1;facade.runtime={testRunId:"run-a"};facade.readCurrentRunState=()=>state;
  facade.settleVeronaAutoSaveBeforeForegroundAction=async()=>null;facade.saveCurrentDraftBeforeCompleteInternal=async()=>{};
  facade.requestState={request:async(label,method,url)=>{path=url;await gate;return{testRun:{testRunId:"run-a"}};}};
  facade.participantEvents={stop(){throw Error("An obsolete response must not stop the new Run's stream.");}};
  const pending=facade.returnToStarterInternal(false,false);await Promise.resolve();await Promise.resolve();
  assert.ok(path.endsWith("/run-a/return-to-starter"));
  if(changed==="run"){state={...state,testRun:{testRunId:"run-b"}};facade.runtime.testRunId="run-b";}else if(changed==="unit")state={...state,currentUnit:{unitKey:"unit-b"}};else if(changed==="status")state={...state,testRun:{...state.testRun,status:"paused"}};else facade.viewLifecycleSequence++;
  release();await pending;
});
function launcherFixture(confirmMeansContinue,theme="Primar") {
  const events=[],options=[],subscriptions=[];let closeCalls=0,focused=0;
  const opener={isConnected:true,closest:()=>null,focus(){focused++;}};
  const document={activeElement:opener,documentElement:{dataset:{applicationTheme:theme}}};
  class EventEmitter{emit(value){events.push(value);}}
  class MatDialog{}
  class OriginalParticipantConfirmationDialogComponent{}
  const dialogs={openDialogs:[],open(component,config){assert.equal(component,OriginalParticipantConfirmationDialogComponent);options.push(config);
    return{afterClosed(){return{subscribe(callback){const sub={active:true,callback,unsubscribe(){this.active=false;}};subscriptions.push(sub);return sub;}};},close(){closeCalls++;}};}};
  const Launcher=new Function("inject","MatDialog","OriginalParticipantConfirmationDialogComponent","EventEmitter","document",`${launcherSource}\nreturn OriginalParticipantConfirmationLauncherComponent;`)(
    token=>{assert.equal(token,MatDialog);return dialogs;},MatDialog,OriginalParticipantConfirmationDialogComponent,EventEmitter,document);
  const launcher=new Launcher();launcher.confirmation={original:{title:"Own",message:"Own",cancelLabel:"Cancel",confirmLabel:"Confirm",confirmMeansContinue}};
  launcher.ngOnInit();return{launcher,events,options,opener,dialogs,get focused(){return focused;},get closeCalls(){return closeCalls;},
    replacement(){document.activeElement={isConnected:true,closest:()=>({}),focus(){throw new Error("The old dialog must never receive restored focus.");}};
      const next=new Launcher();next.confirmation=launcher.confirmation;next.ngOnInit();return next;},
    emit(value){for(const s of subscriptions)if(s.active)s.callback(value);}};
}
for(const confirmMeansContinue of [true,false])for(const result of [true,false,undefined,null])test(`native ${String(result)} result maps to the requested ${confirmMeansContinue?"normal":"restriction"} action`,()=>{
  const f=launcherFixture(confirmMeansContinue);f.emit(result);
  assert.deepEqual(f.events,[typeof result==="boolean"&&result===confirmMeansContinue]);
});
for(const theme of ["Primar","Sekundar","Erwachsene"])test(`${theme}: native overlay follows Source safe mode and cannot emit after destruction`,()=>{
  const f=launcherFixture(true,theme);assert.equal(f.options[0].data.safeMode,theme==="Primar");
  assert.equal(f.options[0].autoFocus,"dialog");assert.equal(f.options[0].id,undefined,"Material must own IDs while an old dialog closes.");
  f.launcher.ngOnDestroy();f.emit(true);assert.deepEqual(f.events,[]);assert.equal(f.closeCalls,1);assert.equal(f.focused,0);
});
test("a replacement restores its live original trigger only once",()=>{
  const f=launcherFixture(true);f.launcher.ngOnDestroy();f.replacement();f.emit(false);
  assert.equal(f.focused,1);assert.deepEqual(f.events,[false]);
});
test("closing cannot focus a detached trigger or steal focus from another native dialog",()=>{
  const detached=launcherFixture(true);detached.opener.isConnected=false;detached.emit(false);assert.equal(detached.focused,0);
  const foreground=launcherFixture(true);foreground.dialogs.openDialogs.push({});foreground.emit(false);assert.equal(foreground.focused,0);
});

test("legacy Verona 2 completion on exit distinguishes presentation from response",async()=>{
  const f=facadeFixture({required:true,progress:{presentation:"complete-and-valid",response:"complete-and-valid"}});
  const pending=f.facade.returnToStarterWithConfirmation();await Promise.resolve();
  assert.equal(f.facade.confirmationDialog().kind,"information");
  assert.equal(f.facade.confirmationDialog().message,f.facade.customText("booklet_msgNavigationDeniedText_presentationIncomplete"));
  f.facade.resolveConfirmation(false);await pending;assert.deepEqual(f.returns,[]);
});

for(const scope of ["unit","testlet"]) for(const saving of [false,true]) test(`${scope}/${saving}: advisory timer is interrupted before lock consent and lock notice follows only approval`,async()=>{
  const f=facadeFixture({saving,force:false,forceNavigation:false,required:true,progress:completenessCases.both,
    timer:{leave:"confirm",status:"running"},lock:{scope,confirm:true}});
  let pending=f.facade.returnToStarterWithConfirmation();await Promise.resolve();await Promise.resolve();
  assert.deepEqual(f.preparations,[participantStarterExitPreparationRoute]);
  assert.equal(f.facade.player.testletTimer.status,"paused");
  assert.equal(f.facade.originalNavigationToast().text,"Im normalen Testablauf wird beim Verlassen des zeitbegrenzten Blocks eine Warnung angezeigt.");
  assert.deepEqual(f.facade.originalNavigationToast().additionalTexts,[]);
  const request=f.facade.confirmationDialog();assert.ok(request);
  f.parent.resolveOriginalConfirmation(request,false);await pending;assert.deepEqual(f.returns,[]);
  pending=f.facade.returnToStarterWithConfirmation();await Promise.resolve();
  assert.equal(f.preparations.length,1);
  assert.match(f.facade.originalNavigationToast().text,/Im Testmodus dürfte/);
  f.parent.resolveOriginalConfirmation(f.facade.confirmationDialog(),true);await pending;
  assert.equal(f.facade.originalNavigationToast().text,`${scope} würde im Testmodus nun gesperrt werden.`);
  assert.deepEqual(f.returns,[[false,true]]);
});
for(const changed of ["run","lifecycle","unit","status"]) test(`preparation boundary rejects changed ${changed} before publishing or opening a dialog`,async()=>{
  const f=facadeFixture({force:false,timer:{leave:"confirm"},lock:{scope:"unit",confirm:true}});
  f.facade.prepareStarterExitTimer=async()=>{if(changed==="run")f.replaceRun();else if(changed==="unit")f.replaceUnit();else if(changed==="status")f.replaceStatus();else f.facade.viewLifecycleSequence++;return true;};
  await f.facade.returnToStarterWithConfirmation();assert.equal(f.facade.confirmationDialog(),null);
  assert.equal(f.facade.originalNavigationToast(),null);assert.deepEqual(f.returns,[]);
});
const prepareSource=await executableClass("participant-view.facade.ts","ParticipantViewFacade",["prepareStarterExitTimer"]);
const PrepareFacade=new Function("resolveRoutePath",`${prepareSource}\nreturn ParticipantViewFacade;`)(resolveRoutePath);
for(const phase of ["autosave","draft","request","refresh"]) for(const changed of ["run","lifecycle","unit","status"]) test(`production preparation ${phase}/${changed}: stale response cannot sync the replacement view`,async()=>{
  const facade=new PrepareFacade(),calls=[];
  let state={testRun:{testRunId:"a"},currentUnit:{unitKey:"u"},executionMode:{saveResponses:false}};
  facade.viewLifecycleSequence=1;facade.runtime={testRunId:"a",currentUnitResponse:"Exact Ω"};facade.player={testletTimer:{testletKey:"t"}};
  facade.readCurrentRunState=()=>state;facade.ephemeralUnitResponseRecord=()=>({u:"Exact Ω"});
  const change=()=>{if(changed==="run")state={...state,testRun:{testRunId:"b"}};else if(changed==="unit")state={...state,currentUnit:{unitKey:"v"}};else if(changed==="status")state={...state,testRun:{...state.testRun,status:"paused"}};else facade.viewLifecycleSequence++;};
  facade.settleVeronaAutoSaveBeforeForegroundAction=async()=>{calls.push("autosave");if(phase==="autosave")change();return null;};
  facade.saveCurrentDraftBeforeCompleteInternal=async()=>{calls.push("draft");if(phase==="draft")change();};
  facade.requestState={request:async(name,method,url,body)=>{calls.push("request");assert.equal(url,"/api/v1/participant/test-runs/a/prepare-starter-exit");assert.deepEqual(body,{currentUnitKey:"u",responseUnitKey:"u",unitResponse:"Exact Ω",transientUnitResponses:{u:"Exact Ω"}});if(phase==="request")change();return{testRun:state.testRun,timerEffect:"cancelled"};}};
  facade.syncRun=()=>calls.push("sync");facade.refreshCurrentStateInternal=async()=>{calls.push("refresh");if(phase==="refresh")change();};
  facade.showTimerLifecycleEvent=()=>calls.push("notice");
  assert.equal(await facade.prepareStarterExitTimer(participantStarterExitPreparationRoute),false);
  const stages=["autosave","draft","request","sync","refresh"];
  assert.deepEqual(calls,stages.slice(0,stages.indexOf(phase)+1));
});
test("production preparation retains the prior timer for the cancellation notice after refreshing",async()=>{
  const facade=new PrepareFacade(),timer={testletKey:"t",startedAt:"now",durationSeconds:300},calls=[];
  const state={testRun:{testRunId:"a"},currentUnit:{unitKey:"u"},executionMode:{saveResponses:true},activeTestletTimer:timer};
  facade.viewLifecycleSequence=1;facade.runtime={testRunId:"a"};facade.player={testletTimer:timer};facade.readCurrentRunState=()=>state;
  facade.settleVeronaAutoSaveBeforeForegroundAction=async()=>null;facade.saveCurrentDraftBeforeCompleteInternal=async()=>{};
  facade.requestState={request:async()=>({testRun:state.testRun,timerEffect:"cancelled"})};facade.syncRun=()=>{};
  facade.refreshCurrentStateInternal=async()=>{facade.player={testletTimer:null};};facade.showTimerLifecycleEvent=(...args)=>calls.push(args);
  assert.equal(await facade.prepareStarterExitTimer(participantStarterExitPreparationRoute),true);
  assert.deepEqual(calls,[["a","cancelled",timer]]);
});

for(const leave of ["allowed","confirm","forbidden"]) for(const saving of [false,true]) for(const silent of [false,true])
test(`paused ${leave}/${saving}/${silent}: status exit skips incomplete unit, timer and leave-lock guards`,async()=>{
  const f=facadeFixture({status:"paused",silent,saving,required:true,progress:completenessCases.both,
    timer:{leave,status:"paused"},lock:{scope:"unit",confirm:true}});
  let pending=f.facade.returnToStarterWithConfirmation();await Promise.resolve();
  if(saving&&silent) {
    let request=f.facade.confirmationDialog();assert.equal(request.original.title,"Sicher, dass du den Test beenden möchtest?");
    assert.equal(request.original.message,"");assert.equal(request.original.confirmMeansContinue,true);
    f.parent.resolveOriginalConfirmation(request,false);await pending;assert.deepEqual(f.returns,[]);
    pending=f.facade.returnToStarterWithConfirmation();await Promise.resolve();request=f.facade.confirmationDialog();
    f.parent.resolveOriginalConfirmation(request,true);
  }
  await pending;assert.deepEqual(f.returns,[[false,false]]);assert.deepEqual(f.preparations,[]);assert.equal(f.facade.originalNavigationToast(),null);
});
test("a silent pause without forced time or navigation restrictions needs no termination confirmation",async()=>{
  const f=facadeFixture({status:"paused",silent:true,force:false,forceNavigation:false});
  await f.facade.returnToStarterWithConfirmation();assert.equal(f.facade.confirmationDialog(),null);assert.deepEqual(f.returns,[[false,false]]);
});

for(const remoteIsNewer of [false,true]) test(`late own return response ${remoteIsNewer?"cannot clear a newer remote pause":"accepts its exact SSE status before HTTP"}`,async()=>{
  const facade=new InternalFacade();
  let state={testRun:{testRunId:"run-a",status:"running",updatedAt:"before"},currentUnit:{unitKey:"unit-a"},executionMode:{saveResponses:true}};
  facade.viewLifecycleSequence=1;facade.runtime={testRunId:"run-a"};facade.readCurrentRunState=()=>state;
  facade.settleVeronaAutoSaveBeforeForegroundAction=async()=>null;facade.saveCurrentDraftBeforeCompleteInternal=async()=>{};
  facade.requestState={request:async()=>{
    state={...state,testRun:{...state.testRun,status:"paused",updatedAt:remoteIsNewer?"remote-after-return":"own-return"}};
    return{testRun:{testRunId:"run-a",status:"paused",updatedAt:"own-return"}};
  }};
  const reachedOwnResult=new Error("own stored response accepted");
  facade.participantEvents={stop(){throw reachedOwnResult;}};
  if(remoteIsNewer)await facade.returnToStarterInternal(false,false);
  else await assert.rejects(facade.returnToStarterInternal(false,false),error=>error===reachedOwnResult);
});
