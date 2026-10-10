import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import { resolveParticipantCustomText } from "@testcenter-rewrite-app/contracts";

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
const Facade=new Function(`${facadeSource}\nreturn ParticipantViewFacade;`)();
const parentSource=await executableClass("participant-view.component.ts","ParticipantViewComponent",["resolveOriginalConfirmation"]);
const Parent=new Function(`${parentSource}\nreturn ParticipantViewComponent;`)();
const launcherSource=await executableClass("original-participant-confirmation-dialog.component.ts","OriginalParticipantConfirmationLauncherComponent");
const signal=initial=>{let value=initial;const result=()=>value;result.set=next=>{value=next;};return result;};
function facadeFixture({saving=true,force=true,timer=null,lock=null,customTexts={}}={}) {
  const facade=new Facade(),returns=[];
  let state={testRun:{testRunId:"run-a"},executionMode:{saveResponses:saving,forceTimeRestrictions:force}};
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
  const f=facadeFixture();const cancelled=f.facade.returnToStarterWithConfirmation();
  const first=f.facade.confirmationDialog();assert.equal(first.title,"Return to test selection?");
  assert.deepEqual(first.original,{title:"Sicher, dass du den Test beenden möchtest?",message:"",cancelLabel:"Abbrechen",confirmLabel:"Bestätigen",confirmMeansContinue:true});
  f.parent.resolveOriginalConfirmation(first,false);await cancelled;assert.deepEqual(f.returns,[]);
  const confirmed=f.facade.returnToStarterWithConfirmation(),second=f.facade.confirmationDialog();
  f.parent.resolveOriginalConfirmation(second,true);f.parent.resolveOriginalConfirmation(second,true);
  await confirmed;assert.deepEqual(f.returns,[[false,false]]);
});
for(const scope of ["unit","testlet"])test(`Source ${scope} leave warning shares a single saved exit confirmation`,async()=>{
  const f=facadeFixture({lock:{scope,confirm:true}}),pending=f.facade.returnToStarterWithConfirmation();
  const request=f.facade.confirmationDialog();
  assert.equal(request.original.message,resolveParticipantCustomText({},`booklet_warningLeaveTextPrompt-${scope}`));
  assert.equal(request.original.confirmMeansContinue,false);
  f.parent.resolveOriginalConfirmation(request,true);await pending;assert.deepEqual(f.returns,[[false,true]]);
});
test("forced timed exit uses scoped Original copy and one confirmation for both actions",async()=>{
  const f=facadeFixture({timer:{leave:"confirm",displayLabel:"Own block"},lock:{scope:"unit",confirm:true},
    customTexts:{booklet_warningLeaveTimerBlockTextPrompt:"Own timer warning Ω"}});
  const pending=f.facade.returnToStarterWithConfirmation(),request=f.facade.confirmationDialog();
  assert.deepEqual(request.original,{title:"Sicher, dass du den Test beenden möchtest?",message:"Own timer warning Ω",
    cancelLabel:"Trotzdem weiter",confirmLabel:"Hier bleiben",confirmMeansContinue:false});
  f.parent.resolveOriginalConfirmation(request,true);await pending;assert.deepEqual(f.returns,[[true,true]]);
});
test("non-saving timed confirmation keeps its scoped Source title",async()=>{
  const f=facadeFixture({saving:false,timer:{leave:"confirm"},customTexts:{booklet_warningLeaveTimerBlockTitle:"Own title"}});
  const pending=f.facade.returnToStarterWithConfirmation(),request=f.facade.confirmationDialog();
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
  const f=facadeFixture(),pending=f.facade.returnToStarterWithConfirmation(),request=f.facade.confirmationDialog();
  if(changed==="run")f.replaceRun();else f.facade.viewLifecycleSequence++;
  f.parent.resolveOriginalConfirmation(request,true);await pending;assert.deepEqual(f.returns,[]);
});
test("a replaced confirmation cancels its old promise and rejects old overlay results",async()=>{
  const f=facadeFixture(),first=f.facade.returnToStarterWithConfirmation(),old=f.facade.confirmationDialog();
  const second=f.facade.returnToStarterWithConfirmation(),live=f.facade.confirmationDialog();
  f.parent.resolveOriginalConfirmation(old,true);assert.equal(f.facade.confirmationDialog(),live);
  await first;assert.deepEqual(f.returns,[]);f.parent.resolveOriginalConfirmation(live,true);await second;
  assert.deepEqual(f.returns,[[false,false]]);
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
