import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { productionApiRoutes, resolveRoutePath } from "@testcenter-rewrite-app/contracts";

// Execute production methods/classes; the host supplies Angular and HTTP only.
const members = (file, className, names) => {
  const ast = ts.createSourceFile(file, readFileSync(new URL(file, import.meta.url), "utf8"), ts.ScriptTarget.ES2022, true);
  const declaration = ast.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === className);
  assert.ok(declaration, className);
  return declaration.members.filter(node => !names || names.includes(node.name?.getText(ast))).map(node => node.getText(ast)).join("\n");
};
const loadClass = async (body, dependencies) => {
  const code = `export const create = (${dependencies}) => class Host { ${body} };`;
  const { outputText } = ts.transpileModule(code, { compilerOptions: {
    target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext
  }});
  return (await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`)).create;
};
const createDownload = await loadClass(members("../apps/web/src/app/participant-view.facade.ts", "ParticipantViewFacade",
  ["downloadParticipantReviews", "downloadParticipantReviewsInternal"]), "productionApiRoutes, resolveRoutePath, downloadBlobFile");
const createAction = await loadClass(members("../apps/web/src/app/rewrite-app-view-state.service.ts", "RewriteAppViewStateService",
  ["runActionAsync"]), "");
const createStarter = await loadClass(members("../apps/web/src/app/original-participant-starter.component.ts", "OriginalParticipantStarterComponent",
  ["downloadReviews", "ngOnDestroy"]), "");
const createToast = await loadClass(members("../apps/web/src/app/original-toast.service.ts", "OriginalToastService"), "signal, setTimeout, clearTimeout");

const host = () => {
  const downloads = [], requests = [];
  const Download = createDownload(productionApiRoutes, resolveRoutePath, download => downloads.push(download));
  const view = Object.assign(new Download(), { canDownloadParticipantReviews:true,
    runtime:{participantSessionId:"owned-session"},viewLifecycleSequence:1,reviewDownloadFeedback:"Retained feedback" });
  const action = new (createAction())();
  action.uiState = {renderVersion:{update:fn => fn(0)}};
  view.viewState = action;
  view.requestState = {requestDownload: async (...args) => {
    requests.push(args);
    return {statusCode:204,blob:new Blob([])};
  }};
  return {view,requests,downloads};
};

for (const statusCode of [204,200]) {
  test(`empty ${statusCode} export returns explicit presentation result and retains Rewrite feedback`, async () => {
    const {view,requests,downloads} = host();
    view.requestState.requestDownload = async (...args) => {
      requests.push(args); return {statusCode,blob:new Blob([])};
    };
    assert.equal(await view.downloadParticipantReviews(),"empty");
    assert.equal(view.reviewDownloadFeedback,"Keine Kommentare verfügbar.");
    assert.equal(requests[0][1],"/api/v1/participant/sessions/owned-session/exports/reviews.csv");
    assert.deepEqual(downloads,[]);
  });
}

test("populated authorized export preserves exact CSV and produces no empty result", async () => {
  const {view,downloads} = host();
  const bytes = 'comment\n"Eigener Review: Ω\n zweite Zeile"\n';
  view.requestState.requestDownload = async () => ({statusCode:200,blob:new Blob([bytes]),filename:"owned-reviews.csv"});
  assert.equal(await view.downloadParticipantReviews(),"downloaded");
  assert.equal(downloads.length,1);
  assert.equal(downloads[0].filename,"owned-reviews.csv");
  assert.equal(await downloads[0].blob.text(),bytes);
  assert.equal(view.reviewDownloadFeedback,"Reviews downloaded as owned-reviews.csv.");
});

test("forbidden presentation capability issues no export request", async () => {
  const {view,requests,downloads} = host(); view.canDownloadParticipantReviews = false;
  assert.equal(await view.downloadParticipantReviews(),undefined);
  assert.deepEqual(requests,[]); assert.deepEqual(downloads,[]);
});

test("a failed export cannot report an old empty result", async () => {
  const {view,downloads} = host(); view.reviewDownloadFeedback = "Keine Kommentare verfügbar.";
  view.requestState.requestDownload = async () => {throw new Error("Owned denied export");};
  assert.equal(await view.downloadParticipantReviews(),undefined);
  assert.deepEqual(downloads,[]);
});

for (const boundary of ["Session","view lifecycle"]) {
  for (const statusCode of [204,200]) {
    test(`late ${statusCode} export after changed ${boundary} has no presentation or download`, async () => {
      const {view,downloads} = host();
      let finish;
      view.requestState.requestDownload = () => new Promise(done => {finish=done;});
      const pending = view.downloadParticipantReviews();
      if (boundary === "Session") view.runtime.participantSessionId = "other-owned-session";
      else view.viewLifecycleSequence++;
      finish({statusCode,blob:new Blob(statusCode===200 ? ["Owned CSV"] : [])});
      assert.equal(await pending,undefined);
      assert.equal(view.reviewDownloadFeedback,"Retained feedback");
      assert.deepEqual(downloads,[]);
    });
  }
}

for (const result of ["empty","downloaded",undefined]) {
  test(`Original Starter ${String(result)} completion emits only the Source empty message`, async () => {
    const messages = [];
    const starter = Object.assign(new (createStarter())(), {destroyed:false,
      view:{downloadParticipantReviews:async()=>result},messages:{show:text=>messages.push(text)}});
    await starter.downloadReviews();
    assert.deepEqual(messages,result === "empty" ? ["Keine Kommentare verfügbar."] : []);
  });
}

test("destroyed Starter ignores a late empty completion", async () => {
  let finish;
  const messages = [];
  const starter = Object.assign(new (createStarter())(), {destroyed:false,observer:null,
    view:{downloadParticipantReviews:()=>new Promise(done=>{finish=done;})},messages:{show:text=>messages.push(text)}});
  const pending = starter.downloadReviews(); starter.ngOnDestroy(); finish("empty"); await pending;
  assert.deepEqual(messages,[]);
});

const toastHost = () => {
  const callbacks = new Map(), delays = [], canceled = [];
  let id = 0;
  const signal = initial => {
    let value = initial; const read = () => value;
    read.set = next => {value=next;}; read.update = update => {value=update(value);};
    return read;
  };
  const Toast = createToast(signal,(callback,delay)=>{delays.push(delay);callbacks.set(++id,callback);return id;},
    timer=>{canceled.push(timer);callbacks.delete(timer);});
  return {toast:new Toast(),callbacks,delays,canceled};
};

test("Source toast stack dismisses each occurrence independently after exactly five seconds", () => {
  const {toast,callbacks,delays} = toastHost();
  toast.show("Keine Kommentare verfügbar."); toast.show("Keine Kommentare verfügbar.");
  assert.deepEqual(delays,[5000,5000]); assert.deepEqual(toast.toasts().map(item=>item.id),[1,2]);
  const stale = callbacks.get(1); toast.dismiss(1); stale();
  assert.deepEqual(toast.toasts().map(item=>item.id),[2]); callbacks.get(2)();
  assert.deepEqual(toast.toasts(),[]); assert.equal(callbacks.size,0);
});

test("toast disposal cancels all remaining timers", () => {
  const {toast,callbacks,canceled} = toastHost();
  toast.show("First"); toast.show("Second"); toast.ngOnDestroy();
  assert.deepEqual(canceled,[1,2]); assert.equal(callbacks.size,0); assert.deepEqual(toast.toasts(),[]);
});
