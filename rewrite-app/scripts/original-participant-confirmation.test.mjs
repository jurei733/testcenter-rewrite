import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { compileBookletRuntimePolicy, parseVeronaUnitResponse, productionApiRoutes, resolveRoutePath, resolveParticipantCustomText, serializeVeronaUnitResponse } from "@testcenter-rewrite-app/contracts";
import { bookletStarterExitDeniedReasons } from "@testcenter-rewrite-app/contracts/booklet-completeness";
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
  {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText.replace(/^import .*;$/gm,"").replace("export function ","function ");
const planParticipantStarterExit=new Function("bookletStarterExitDeniedReasons","parseVeronaUnitResponse",`${policySource}\nreturn planParticipantStarterExit;`)(bookletStarterExitDeniedReasons,parseVeronaUnitResponse);
// Only module transport is supplied; the actual shipped policy is executed.
const Facade=new Function("exitPolicy",`${facadeSource.replace('import("./participant-exit-policy")','Promise.resolve(exitPolicy)')}\nreturn ParticipantViewFacade;`)({planParticipantStarterExit});
const parentSource=await executableClass("participant-view.component.ts","ParticipantViewComponent",["resolveOriginalConfirmation"]);
const Parent=new Function(`${parentSource}\nreturn ParticipantViewComponent;`)();
const launcherSource=await executableClass("original-participant-confirmation-dialog.component.ts","OriginalParticipantConfirmationLauncherComponent");
const signal=initial=>{let value=initial;const result=()=>value;result.set=next=>{value=next;};return result;};
function facadeFixture({saving=true,force=true,timer=null,lock=null,customTexts={},progress={presentation:"complete",response:"complete"},required=false,unlocked=false,forceNavigation=true}={}) {
  const facade=new Facade(),returns=[];
  let state={testRun:{testRunId:"run-a",monitorNavigationUnlocked:unlocked},executionMode:{saveResponses:saving,forceTimeRestrictions:force,forceNaviRestrictions:forceNavigation},
    currentUnit:{unitKey:"own-unit"},booklet:{policy:compileBookletRuntimePolicy(required?{force_presentation_complete:"ALWAYS",force_response_complete:"ALWAYS"}:{})}};
  facade.runtime={currentUnitResponse:serializeVeronaUnitResponse({unitState:{presentationProgress:progress.presentation,responseProgress:progress.response}})};
  facade.viewLifecycleSequence=1;facade.player={testletTimer:timer,leaveLock:lock};
  facade.readCurrentRunState=()=>state;facade.confirmationDialog=signal(null);
  facade.originalNavigationToast=signal(null);facade.navigationAdvisory=signal(null);
  facade.customText=(key,fallback)=>resolveParticipantCustomText(customTexts,key,fallback);
  facade.leaveLockConfirmationTitle=()=>"Rewrite lock title";
  facade.leaveLockConfirmationText=()=>"Rewrite lock message";
  facade.returnToStarterInternal=async(...args)=>returns.push(args);
  const parent=new Parent();parent.view=facade;
  return{facade,parent,returns,replaceRun(){state={...state,testRun:{testRunId:"run-b"}};}};
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
test("forced timed exit uses scoped Original copy and one confirmation for both actions",async()=>{
  const f=facadeFixture({timer:{leave:"confirm",displayLabel:"Own block"},lock:{scope:"unit",confirm:true},
    customTexts:{booklet_warningLeaveTimerBlockTextPrompt:"Own timer warning Ω"}});
  const pending=f.facade.returnToStarterWithConfirmation();await Promise.resolve();const request=f.facade.confirmationDialog();
  assert.deepEqual(request.original,{title:"Sicher, dass du den Test beenden möchtest?",message:"Own timer warning Ω",
    cancelLabel:"Trotzdem weiter",confirmLabel:"Hier bleiben",confirmMeansContinue:false});
  f.parent.resolveOriginalConfirmation(request,true);await pending;assert.deepEqual(f.returns,[[true,true]]);
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
  assert.equal(f.facade.originalNavigationToast(),null);assert.deepEqual(f.returns,[[false,false]]);
});
for(const changed of ["run","lifecycle"])test(`late ${changed} change cannot return a different live Run`,async()=>{
  const f=facadeFixture(),pending=f.facade.returnToStarterWithConfirmation();await Promise.resolve();const request=f.facade.confirmationDialog();
  if(changed==="run")f.replaceRun();else f.facade.viewLifecycleSequence++;
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
for(const changed of ["run","lifecycle"])test(`lazy policy boundary: changed ${changed} cannot open or return an obsolete Run`,async()=>{
  const f=facadeFixture();const pending=f.facade.returnToStarterWithConfirmation();
  if(changed==="run")f.replaceRun();else f.facade.viewLifecycleSequence++;
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
for(const stage of ["settle","save"])for(const changed of ["run","lifecycle"])test(`foreground ${stage}: late ${changed} cannot save or return a replacement Run`,async()=>{
  const facade=new InternalFacade(),calls=[];
  let state={testRun:{testRunId:"run-a"},executionMode:{saveResponses:true}},release;
  const gate=new Promise(done=>{release=done;});
  facade.viewLifecycleSequence=1;facade.runtime={testRunId:"run-a"};facade.readCurrentRunState=()=>state;
  facade.settleVeronaAutoSaveBeforeForegroundAction=async()=>{if(stage==="settle")await gate;return null;};
  facade.saveCurrentDraftBeforeCompleteInternal=async()=>{calls.push("save");if(stage==="save")await gate;};
  facade.requestState={request(){throw Error("An obsolete foreground action must never send a return request.");}};
  const pending=facade.returnToStarterInternal(false,false);await Promise.resolve();
  if(changed==="run"){state={...state,testRun:{testRunId:"run-b"}};facade.runtime.testRunId="run-b";}else facade.viewLifecycleSequence++;
  release();await pending;assert.deepEqual(calls,stage==="settle"?[]:["save"]);
});
for(const changed of ["run","lifecycle"])test(`late return response: changed ${changed} cannot clear a replacement view`,async()=>{
  const facade=new InternalFacade();let state={testRun:{testRunId:"run-a"},executionMode:{saveResponses:true}},release,path;
  const gate=new Promise(done=>{release=done;});
  facade.viewLifecycleSequence=1;facade.runtime={testRunId:"run-a"};facade.readCurrentRunState=()=>state;
  facade.settleVeronaAutoSaveBeforeForegroundAction=async()=>null;facade.saveCurrentDraftBeforeCompleteInternal=async()=>{};
  facade.requestState={request:async(label,method,url)=>{path=url;await gate;return{testRun:{testRunId:"run-a"}};}};
  facade.participantEvents={stop(){throw Error("An obsolete response must not stop the new Run's stream.");}};
  const pending=facade.returnToStarterInternal(false,false);await Promise.resolve();await Promise.resolve();
  assert.ok(path.endsWith("/run-a/return-to-starter"));
  if(changed==="run"){state={...state,testRun:{testRunId:"run-b"}};facade.runtime.testRunId="run-b";}else facade.viewLifecycleSequence++;
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
