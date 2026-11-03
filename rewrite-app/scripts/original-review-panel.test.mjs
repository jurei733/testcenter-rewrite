import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";
import {productionApiRoutes, resolveRoutePath} from "@testcenter-rewrite-app/contracts";

// Execute the actual production class. Only Angular rendering/injection and
// the authorized facade boundary are replaced; no second panel implementation.
const source = await readFile(new URL("../apps/web/src/app/original-review-panel.component.ts",import.meta.url),"utf8");
const ast = ts.createSourceFile("panel.ts",source,ts.ScriptTarget.Latest,true);
const declaration = ast.statements.find(node=>ts.isClassDeclaration(node) && node.name?.text==="OriginalReviewPanelComponent");
assert.ok(declaration);
const transformed = ts.transform(declaration,[context=>{
  const visit = node => {
    const clean = ts.visitEachChild(node,visit,context);
    if(clean.modifiers) clean.modifiers=ts.factory.createNodeArray(clean.modifiers.filter(modifier=>!ts.isDecorator(modifier)));
    return clean;
  };
  return visit;
}]);
const classSource = ts.createPrinter().printNode(ts.EmitHint.Unspecified,transformed.transformed[0],ast);
transformed.dispose();
const executable = ts.transpileModule(classSource.replace("export class ","class "),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}
}).outputText;

function fixture() {
  const render = [], disposers = [];
  const view = {runtime:{testRunId:"run-a"},player:{unitKey:"unit-a"},participantReviews:[],
    editingReviewId:"",reviewerId:"",reviewComment:"",reviewPageLabel:"",reviewTarget:"unit",
    reviewPriority:0,reviewCategories:[],canSubmitReview:true};
  const destroy = {destroyed:false,onDestroy:callback=>disposers.push(callback)};
  let focused=0,dirty=false,cancelled=0;
  view.cancelReviewEdit=()=>{cancelled++;Object.assign(view,{editingReviewId:"",reviewComment:"",reviewTarget:"unit",reviewPageLabel:"",reviewerId:"",reviewPriority:0,reviewCategories:[]})};
  const form = {get dirty(){return dirty},form:{markAsDirty(){dirty=true},markAsPristine(){dirty=false}}};
  const signal = initial => {let current=initial;const result=()=>current;result.set=value=>{current=value};return result};
  class DestroyRef {}
  class ElementRef {}
  class ParticipantViewFacade {}
  class EventEmitter { count=0;emit(){this.count++} }
  const inject = token=>token===ParticipantViewFacade?view:token===DestroyRef?destroy:
    {nativeElement:{querySelector:()=>({focus(){focused++}})}};
  const Panel = new Function("inject","DestroyRef","ElementRef","ParticipantViewFacade","signal","afterNextRender","EventEmitter",
    `${executable}\nreturn OriginalReviewPanelComponent;`)(inject,DestroyRef,ElementRef,ParticipantViewFacade,signal,callback=>render.push(callback),EventEmitter);
  const create = () => {const panel=new Panel();panel.form=form;for(const callback of render.splice(0))callback();return panel};
  const close = () => {for(const callback of disposers.splice(0))callback()};
  return {view,destroy,form,create,close,disposers,get focused(){return focused},get cancelled(){return cancelled}};
}

test("Original Review restores a real unsaved draft without mutating its content",()=>{
  const f=fixture();f.view.reviewComment="Ω\n  exact draft";
  const first=f.create();assert.equal(f.form.dirty,true);f.close();
  const reopened=f.create();assert.equal(reopened.activeView(),"form");assert.equal(f.form.dirty,true);
  assert.equal(f.view.reviewComment,"Ω\n  exact draft");assert.equal(first.close.count,0);
});

test("Original Review distinguishes a pristine edit from restored changed fields",()=>{
  const f=fixture();const review={reviewId:"review-a",unitKey:"unit-a",page:null,pageLabel:null,
    reviewerId:"Person",priority:1,categories:["tech","content"],comment:"saved"};
  f.view.participantReviews=[review];Object.assign(f.view,{editingReviewId:review.reviewId,reviewerId:review.reviewerId,
    reviewPriority:1,reviewCategories:["content","tech"],reviewComment:"saved"});
  f.create();assert.equal(f.form.dirty,false);f.close();f.view.reviewPageLabel="changed label";
  f.create();assert.equal(f.form.dirty,true);
});

test("Original Review retains the list on reopen without focusing the hidden form",()=>{
  const f=fixture();f.create().activeView.set("list");f.close();const focused=f.focused;
  assert.equal(f.create().activeView(),"list");assert.equal(f.focused,focused);
});

for(const [field,value] of [["Run","run-b"],["Unit","unit-b"]]) test(`Original Review cannot restore another ${field}'s pane state`,()=>{
  const f=fixture();f.create().activeView.set("list");f.close();
  if(field==="Run")f.view.runtime.testRunId=value;else f.view.player.unitKey=value;
  assert.equal(f.create().activeView(),"form");assert.equal(f.form.dirty,false);
});

test("Original Review rejects duplicate saving and a late result from a different Run",()=>{
  const f=fixture();f.view.reviewComment="draft";let calls=0,saved,settled;
  f.view.saveReview=(done,finish)=>{calls++;saved=done;settled=finish};const panel=f.create();
  panel.save(f.form);panel.save(f.form);assert.equal(calls,1);assert.equal(panel.pending(),true);
  f.view.runtime.testRunId="run-b";saved();settled();assert.equal(panel.close.count,0);assert.equal(panel.pending(),false);
});

test("Original Review closes only for its live successful save",()=>{
  const f=fixture();f.view.reviewComment="draft";let saved,settled;
  f.view.saveReview=(done,finish)=>{saved=done;settled=finish};const panel=f.create();panel.save(f.form);
  saved();settled();assert.equal(panel.close.count,1);assert.equal(panel.pending(),false);
  panel.save(f.form);f.destroy.destroyed=true;saved();settled();assert.equal(panel.close.count,1);
});

test("Original Review cancellation releases deletion and a foreign Run cannot change its view",()=>{
  const f=fixture();f.view.participantReviews=[{reviewId:"review-a"}];f.view.editingReviewId="review-a";
  let deleted,settled,calls=0;f.view.deleteReview=(review,done,finish)=>{calls++;deleted=done;settled=finish};
  const panel=f.create();panel.delete();panel.delete();assert.equal(calls,1);
  settled();assert.equal(panel.pending(),false);assert.equal(panel.activeView(),"form");
  panel.delete();f.view.runtime.testRunId="run-b";deleted();settled();assert.equal(panel.activeView(),"form");
});


for (const field of ['Run', 'Unit']) test(`Original live Review closes once without altering a newer draft when ${field} changes`, async () => {
  const f=fixture();f.view.reviewComment='owned previous draft';const panel=f.create();
  if(field==='Run')f.view.runtime.testRunId='run-b';else f.view.player.unitKey='unit-b';
  f.view.reviewComment='owned new scope draft';panel.ngDoCheck?.();panel.ngDoCheck?.();await Promise.resolve();
  assert.equal(panel.close.count,1);assert.equal(f.view.reviewComment,'owned new scope draft');assert.equal(f.cancelled,0);
});

test('Original Review save from a retired Unit cannot close a later Unit drawer',()=>{
  const f=fixture();f.view.reviewComment='owned draft';let saved;
  f.view.saveReview=done=>{saved=done};const panel=f.create();panel.save(f.form);
  f.view.player.unitKey='unit-b';saved();assert.equal(panel.close.count,0);
});

test('Original Review delete from a retired Unit cannot switch a later Unit view',()=>{
  const f=fixture();f.view.participantReviews=[{reviewId:'review-a'}];f.view.editingReviewId='review-a';let deleted;
  f.view.deleteReview=(review,done)=>{deleted=done};const panel=f.create();panel.delete();
  f.view.player.unitKey='unit-b';deleted();assert.equal(panel.activeView(),'form');
});

test('Review ownership handoff preserves the live list and ignores the replaced drawer result',()=>{
  const f=fixture();f.view.reviewComment='owned draft';let saved;
  f.view.saveReview=done=>{saved=done};const first=f.create();first.activeView.set('list');first.save(f.form);
  const replacement=f.create();assert.equal(replacement.activeView(),'list');
  saved();assert.equal(first.close.count,0);assert.equal(replacement.close.count,0);
});

test('Destroying an older Review owner cannot erase a newer Unit pane or draft',()=>{
  const f=fixture();f.create();f.view.player.unitKey='unit-b';const current=f.create();
  f.view.reviewComment='owned new unit draft';current.activeView.set('list');f.disposers[1]();f.disposers[0]();
  assert.equal(f.create().activeView(),'list');assert.equal(f.view.reviewComment,'owned new unit draft');
});

// Execute the actual facade methods around the HTTP boundary. Deferred replies
// model a real save/refresh or confirmation that completes after navigation.
const facadeSource=await readFile(new URL('../apps/web/src/app/participant-view.facade.ts',import.meta.url),'utf8');
const facadeAst=ts.createSourceFile('facade.ts',facadeSource,ts.ScriptTarget.Latest,true);
const facadeDeclaration=facadeAst.statements.find(node=>ts.isClassDeclaration(node)&&node.name?.text==='ParticipantViewFacade');
const methodNames=['saveReview','deleteReview','saveReviewInternal','deleteReviewInternal','refreshParticipantReviewsInternal','syncCurrentRunState','participantReviewReadSequence'];
const facadeClass=ts.factory.updateClassDeclaration(facadeDeclaration,undefined,'ActualReviewActions',undefined,undefined,
  facadeDeclaration.members.filter(member=>methodNames.includes(member.name?.getText(facadeAst))));
const facadeExecutable=ts.transpileModule(ts.createPrinter().printNode(ts.EmitHint.Unspecified,facadeClass,facadeAst),{
  compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022}}).outputText;
const ActualReviewActions=new Function('productionApiRoutes','resolveRoutePath',facadeExecutable+'\nreturn ActualReviewActions;')(productionApiRoutes,resolveRoutePath);
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done});return{promise,resolve}};
function actionFixture(){
 const write=deferred(),read=deferred(),confirmation=deferred(),tasks=[],calls=[];
 const f=Object.assign(new ActualReviewActions(),{runtime:{testRunId:'run-a'},player:{unitKey:'unit-a',canReview:true},canSubmitReview:true,
  reviewTarget:'unit',editingReviewId:'',editingReviewUnitKey:null,editingReviewPage:null,reviewPageLabel:'',reviewerId:'Owner',reviewPriority:1,reviewCategories:['tech'],reviewComment:'old draft',participantReviews:[],reviewFeedback:'',
  readCurrentRunState(){return{testRun:{testRunId:this.runtime.testRunId},currentUnit:{unitKey:this.player.unitKey},executionMode:{canReview:true}}},
  resetReviewEditor(){this.reviewComment='';this.editingReviewId=''},
  requestConfirmation:()=>confirmation.promise,
  viewState:{onActionAsync:action=>tasks.push(action())},
  requestState:{request(label,method,path,body){calls.push({method,path,body});return method==='GET'?read.promise:write.promise}}
 });
 return{f,write,read,confirmation,tasks,calls};
}

test('Late Review save preserves the new Unit draft and never refreshes the old Unit into it',async()=>{
 const {f,write,read,tasks,calls}=actionFixture();let saved=0;f.saveReview(()=>saved++);
 f.player.unitKey='unit-b';f.reviewComment='new unit draft';f.participantReviews=[{reviewId:'new-unit-review'}];
 write.resolve({});read.resolve({items:[{reviewId:'old-unit-review'}]});await Promise.all(tasks);
 assert.equal(f.reviewComment,'new unit draft');assert.deepEqual(f.participantReviews,[{reviewId:'new-unit-review'}]);assert.equal(saved,0);
 assert.equal(calls.filter(call=>call.method==='GET').length,0);assert.equal(calls[0].body.unitKey,'unit-a');
});

test('Late Review list after a successful save cannot replace a newer Unit list',async()=>{
 const {f,write,read,tasks,calls}=actionFixture();let saved=0;f.saveReview(()=>saved++);write.resolve({});
 for(let n=0;n<8&&!calls.some(call=>call.method==='GET');n++)await Promise.resolve();assert.ok(calls.some(call=>call.method==='GET'));
 f.player.unitKey='unit-b';f.reviewComment='new unit draft';f.participantReviews=[{reviewId:'new-unit-review'}];
 read.resolve({items:[{reviewId:'old-unit-review'}]});await Promise.all(tasks);
 assert.equal(f.reviewComment,'new unit draft');assert.deepEqual(f.participantReviews,[{reviewId:'new-unit-review'}]);assert.equal(saved,0);
});

test('A Review delete confirmed after Unit navigation sends no stale deletion',async()=>{
 const {f,write,read,confirmation,tasks,calls}=actionFixture();let deleted=0;
 const pending=f.deleteReview({reviewId:'old-review'},()=>deleted++);f.player.unitKey='unit-b';f.reviewComment='new unit draft';
 confirmation.resolve(true);write.resolve({});read.resolve({items:[]});await pending;await Promise.all(tasks);
 assert.equal(calls.length,0);assert.equal(deleted,0);assert.equal(f.reviewComment,'new unit draft');
});


function stateFixture(){
 const {f}=actionFixture();const assets=()=>({testRunId:'run-a'});assets.set=()=>{};
 Object.assign(f,{currentRunState:{testRun:{testRunId:'run-a'},currentUnit:{unitKey:'unit-a'}},activeControllerError:()=>null,loadedBookletAssets:assets,
  captureTimerLifecycleTransitions(){},syncParticipantHeaderVisibility(){},workspace:{},syncParticipantSessionFields(){},syncParticipantRosterEntry(){},syncRun(){},syncRuntimeBooklets(){}});
 return f;
}
for(const field of ['Run','Unit'])test(`An accepted changed ${field} resets the shared Review draft before either interface opens it`,()=>{
 const f=stateFixture();const next={testRun:{testRunId:field==='Run'?'run-b':'run-a'},currentUnit:{unitKey:field==='Unit'?'unit-b':'unit-a'},scope:{tenantKey:'owned',workspaceKey:'owned'}};
 f.syncCurrentRunState(next);assert.equal(f.reviewComment,'');assert.equal(f.currentRunState,next);
});
test('A same-Unit state refresh preserves the current Review draft across interface changes',()=>{
 const f=stateFixture();const next={testRun:{testRunId:'run-a'},currentUnit:{unitKey:'unit-a'},scope:{tenantKey:'owned',workspaceKey:'owned'}};
 f.syncCurrentRunState(next);assert.equal(f.reviewComment,'old draft');assert.equal(f.currentRunState,next);
});


test('An older same-Unit Review response cannot replace a newer accepted list',async()=>{
 const {f}=actionFixture(),old=deferred(),latest=deferred();let calls=0;
 f.requestState.request=()=>++calls===1?old.promise:latest.promise;
 const state=f.readCurrentRunState(),first=f.refreshParticipantReviewsInternal(state,true,()=>true),second=f.refreshParticipantReviewsInternal(state,true,()=>true);
 latest.resolve({items:[{reviewId:'latest'}]});await second;old.resolve({items:[{reviewId:'older'}]});await first;
 assert.deepEqual(f.participantReviews,[{reviewId:'latest'}]);
});
