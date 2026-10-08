import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import ts from "typescript";

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
  let focused=0,dirty=false;
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
  return {view,destroy,form,create,close,get focused(){return focused}};
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
