import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const ast = ts.createSourceFile("manager.ts", readFileSync(new URL("../apps/web/src/app/attachment-manager.component.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
const declaration = ast.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "AttachmentManagerComponent");
const members = declaration.members.filter(node => ts.isMethodDeclaration(node) || ts.isGetAccessor(node)).map(node => node.getText(ast)).join("\n");
const exports = {};
const downloads = [], urls = [];
const clipboard = { async writeText() {} };
new Function("exports", "URL", "downloadBlobFile", "attachmentTextValue", "navigator", ts.transpileModule(`export class Actual { ${members} }`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText)(exports, { createObjectURL: blob => { urls.push(blob); return "blob:owned"; }, revokeObjectURL() {} }, value => downloads.push(value),
  (global, local, key) => local?.[key] ?? global?.[key] ?? "", { clipboard });
const deferred = () => {
  let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const attachment = { attachmentId: "owned-first", attachmentType: "capture-image", attachmentFileIds: ["own-file"], loginKey: "own-login", variableId: "own-photo" };
const fixture = () => {
  const response = deferred(), encoding = deferred(), calls = [], renders = [];
  const value = Object.assign(new exports.Actual(), {
    requestVersion: 0, destroyed: false, sessionToken: "owned-token", tenantKey: "owned-tenant", workspaceKey: "workspace-a",
    attachments: [{ ...attachment }], selectedAttachmentId: attachment.attachmentId, previewUrl: null, status: "initial", busy: false, readOnly: false,
    labelTemplateOverride: null, interfaceMode: { mode: () => "original" }, applicationSettings: { settings: () => ({ customTexts: {} }) }, operatorAccess: { customTexts: {} },
    changeDetectorRef: { detectChanges() { renders.push(true); } },
    manager: Object.fromEntries(["list", "download", "downloadPage", "downloadPages", "upload", "delete"].map(method => [method, (...args) => {
      calls.push({ method, args }); return response.promise;
    }]))
  });
  value.manager.describeError = error => error.message;
  const file = { name: "owned.png", type: "image/png", size: 3, arrayBuffer: () => encoding.promise };
  const event = { target: { files: [file], value: "owned.png" } };
  return { value, response, encoding, calls, renders, event };
};
const methods = {
  load: value => value.load(), preview: value => value.preview(attachment, "own-file"),
  downloadPage: value => value.downloadSelectedPage(attachment), downloadPages: value => value.downloadPages(),
  delete: value => value.deleteFile(attachment, "own-file")
};
const result = method => method === "load" ? [{ ...attachment, attachmentId: "late-from-workspace-a" }]
  : method === "delete" ? { ...attachment, attachmentFileIds: [] }
    : { blob: new Blob(["owned image or PDF"]), filename: "owned.pdf" };
for (const [method, run] of Object.entries(methods)) for (const change of ["operator", "tenant", "workspace", "destroy"]) {
  test(`late ${method} cannot mutate the view or download after ${change}`, async () => {
    const f = fixture(), { value } = f;
    const pending = run(value), downloadCount = downloads.length, urlCount = urls.length;
    assert.equal(f.calls.length, 1);
    assert.deepEqual(f.calls[0].args[0], { sessionToken: "owned-token", tenantKey: "owned-tenant", workspaceKey: "workspace-a" });
    if (change === "destroy") value.ngOnDestroy();
    else { value[change === "operator" ? "sessionToken" : change === "tenant" ? "tenantKey" : "workspaceKey"] = "owned-replacement"; value.ngOnChanges(); }
    const snapshot = structuredClone({ attachments: value.attachments, status: value.status });
    f.response.resolve(result(method)); await pending;
    assert.deepEqual({ attachments: value.attachments, status: value.status }, snapshot);
    assert.equal(value.previewUrl, null); assert.equal(downloads.length, downloadCount); assert.equal(urls.length, urlCount);
    assert.equal(f.renders.length, 0); assert.equal(value.busy, false);
  });
}
for (const change of ["operator", "tenant", "workspace", "destroy", "read-only"]) test(`file encoding cannot send an upload after ${change}`, async () => {
  const f = fixture(), { value } = f; const pending = value.uploadSelected(f.event);
  assert.equal(f.event.target.value, ""); assert.equal(f.calls.length, 0);
  if (change === "destroy") value.ngOnDestroy();
  else { value[change === "operator" ? "sessionToken" : change === "tenant" ? "tenantKey" : change === "read-only" ? "readOnly" : "workspaceKey"] = change === "read-only" ? true : "own-replacement"; value.ngOnChanges(); }
  f.encoding.resolve(new Uint8Array([1, 2, 3]).buffer);
  f.response.resolve({ ...attachment, attachmentFileIds: ["unexpected-late-upload"] });
  await pending;
  assert.equal(f.calls.length, 0); assert.equal(f.renders.length, 0);
});
test("late upload completion cannot replace the new workspace inventory", async () => {
  const f = fixture(), { value } = f; const pending = value.uploadSelected(f.event);
  f.encoding.resolve(new Uint8Array([1, 2, 3]).buffer); await Promise.resolve(); await Promise.resolve();
  assert.equal(f.calls[0].method, "upload"); assert.equal(f.calls[0].args[2].dataBase64, "AQID");
  value.workspaceKey = "workspace-b"; value.ngOnChanges(); value.attachments = [{ ...attachment, attachmentId: "workspace-b-owned" }];
  f.response.resolve({ ...attachment, attachmentFileIds: ["new-a-file"] }); await pending;
  assert.equal(value.attachments[0].attachmentId, "workspace-b-owned"); assert.equal(f.renders.length, 0);
});
test("the current scoped load still installs its exact result and releases busy state", async () => {
  const f = fixture(); const pending = f.value.load(); f.response.resolve(result("load")); await pending;
  assert.deepEqual(f.value.attachments, result("load")); assert.equal(f.value.busy, false); assert.equal(f.renders.length, 1);
});
test("an older finally cannot release the replacement workspace's pending request", async () => {
  const f = fixture(), { value } = f, next = deferred(); const first = value.load();
  value.workspaceKey = "workspace-b"; value.ngOnChanges(); value.manager.list = () => next.promise;
  const second = value.load(); assert.equal(value.busy, true);
  f.response.resolve(result("load")); await first; assert.equal(value.busy, true); assert.equal(f.renders.length, 0);
  next.resolve([{ attachmentId: "current-b" }]); await second;
  assert.equal(value.busy, false); assert.equal(value.attachments[0].attachmentId, "current-b"); assert.equal(f.renders.length, 1);
});
test("late failures cannot replace the new workspace status", async () => {
  const f = fixture(), pending = f.value.load(); f.value.workspaceKey = "workspace-b"; f.value.ngOnChanges();
  const status = f.value.status; f.response.reject(Error("old workspace failure")); await pending;
  assert.equal(f.value.status, status); assert.equal(f.renders.length, 0);
});
test("a preview cannot appear under a different selected attachment", async () => {
  const f = fixture(), before = urls.length, pending = f.value.preview(attachment, "own-file");
  f.value.select({ ...attachment, attachmentId: "owned-second" }); f.response.resolve(result("preview")); await pending;
  assert.equal(f.value.previewUrl, null); assert.equal(urls.length, before); assert.equal(f.value.busy, false);
});
test("a completed deletion retains a different selected attachment's preview", async () => {
  const f = fixture(), pending = f.value.deleteFile(attachment, "own-file");
  f.value.select({ ...attachment, attachmentId: "owned-second" }); f.value.previewUrl = "blob:owned-second";
  f.response.resolve(result("delete")); await pending;
  assert.equal(f.value.previewUrl, "blob:owned-second"); assert.deepEqual(f.value.attachments[0].attachmentFileIds, []);
});
test("duplicate direct actions and destroyed views cannot start another request", async () => {
  const f = fixture(), pending = f.value.load(); await f.value.load(); assert.equal(f.calls.length, 1);
  f.value.ngOnDestroy(); f.response.resolve(result("load"));
  await f.value.downloadSelectedPage(attachment); assert.equal(f.calls.length, 1);
  await pending;
});
for (const failed of [false, true]) test(`a late clipboard ${failed ? "failure" : "success"} cannot report into another context`, async () => {
  const f = fixture(), operation = deferred(); let copied;
  clipboard.writeText = value => { copied = value; return operation.promise; };
  const pending = f.value.copyCode(attachment.attachmentId); assert.equal(copied, attachment.attachmentId);
  f.value.sessionToken = "new-owned-session"; f.value.ngOnChanges(); const status = f.value.status;
  if (failed) operation.reject(Error("owned clipboard failure")); else operation.resolve();
  await pending; assert.equal(f.value.status, status);
});
