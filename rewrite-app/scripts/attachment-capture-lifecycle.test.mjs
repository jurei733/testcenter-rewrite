import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

// Execute the component's actual methods; only Angular, canvas timing and HTTP
// are supplied by this host. All images, targets and credentials are synthetic.
const file = new URL("../apps/web/src/app/attachment-capture.component.ts", import.meta.url);
const ast = ts.createSourceFile(file.pathname, readFileSync(file, "utf8"), ts.ScriptTarget.ES2022, true);
const declaration = ast.statements.find(node => ts.isClassDeclaration(node)
  && node.name?.text === "AttachmentCaptureComponent");
const members = declaration.members.filter(node => ts.isMethodDeclaration(node)
  || ts.isGetAccessor(node)).map(node => node.getText(ast)).join("\n");
const geometrySource = ts.transpileModule(readFileSync(new URL("../apps/web/src/app/attachment-page-geometry.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
}).outputText;
const { outputText } = ts.transpileModule(`export const create = (AttachmentQrDecoder, QrScanner) => class Host {
  captureVersion = 0; targetVersion = 0; operationVersion = 0;
  ${members}
}`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } });
const { create } = await import(`data:text/javascript;base64,${Buffer.from(geometrySource.replace(/export /g, "") + outputText).toString("base64")}`);
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const target = id => ({ attachmentId: id, attachmentType: "capture-image", personLabel: `Own ${id}` });
const image = text => new Blob([text], { type: "image/png" });
const fixture = () => {
  const qr = deferred(), disposed = [];
  const Host = create(class {
    decode() { return qr.promise; }
    dispose() { disposed.push(true); }
  }, { NO_QR_CODE_FOUND: "No QR code found" });
  const component = new Host();
  const callbacks = [], uploads = [], lookups = [], lookup = deferred(), upload = deferred();
  const video = { videoWidth: 640, videoHeight: 480, srcObject: { getVideoTracks: () => [] } };
  const drawCalls = [];
  const canvas = { getContext: () => ({ drawImage(...args) { drawCalls.push(args); } }), toBlob(callback) { callbacks.push(callback); } };
  Object.assign(component, {
    uiState: { ops: { adminSessionToken: "own-token" }, workspace: { tenantKey: "own-tenant", workspaceKey: "own-workspace" } },
    operatorAccess: { isReadOnlyAdmin: false, isSystemCheckOnly: false },
    destroyRef: { destroyed: false }, changeDetectorRef: { markForCheck() {} },
    cameraVideo: { nativeElement: video }, captureCanvas: { nativeElement: canvas },
    cameraActive: true, busy: false, attachment: target("first"), attachmentCode: "first",
    captureBlob: null, capturePreviewUrl: null, captureFileName: "", status: "initial", statusIsError: false,
    cameraSelectionVersion: 0, scanner: null, imageDecoder: null,
    manager: {
      async get(scope, id) { lookups.push({ scope, id }); return lookup.promise; },
      async upload(scope, id, payload) { uploads.push({ scope, id, payload }); return upload.promise; },
      describeError: error => error.message
    }
  });
  return { component, video, canvas, drawCalls, callbacks, uploads, lookups, lookup, upload, qr, disposed };
};
const finish = async (f, pending, value = image("own-photo")) => {
  f.callbacks.at(-1)(value); await pending;
};

for (const front of [false, true]) test(`the actual capture draws the ${front ? "front" : "rear"} camera's framed A4 page with positive image dimensions`, async () => {
  const f = fixture();
  f.video.videoWidth = 1000; f.video.videoHeight = 500;
  f.video.srcObject = { getVideoTracks: () => [{ label: front ? "front camera" : "rear camera", getSettings: () => ({}) }] };
  await finish(f, f.component.captureCurrentFrame());
  const [video, x, y, width, height, outX, outY, outWidth, outHeight] = f.drawCalls[0];
  assert.equal(video, f.video); assert.equal(y, 0); assert.equal(height, 500);
  assert.ok(Math.abs(width - 500 * 210 / 297) < 1e-8);
  assert.ok(Math.abs(x - (front ? 1000 - width : 0)) < 1e-8);
  assert.equal(outX, 0); assert.equal(outY, 0);
  assert.equal(outWidth, Math.round(width)); assert.equal(outHeight, 500);
  assert.ok(f.component.captureBlob); f.component.clearCapture();
});

for (const change of ["reset", "retake", "replacement photo", "target", "operator", "workspace", "tenant", "destroy", "camera"]) {
  test(`late camera encoding cannot replace the capture after ${change}`, async () => {
    const f = fixture(), c = f.component;
    const pending = c.captureCurrentFrame();
    if (change === "reset") { c.startCamera = async () => {}; c.resetTarget(); }
    if (change === "retake") c.clearCapture();
    if (change === "replacement photo") c.setCapture(image("replacement"), "replacement.png");
    if (change === "target") c.attachment = target("second");
    if (change === "operator") c.uiState.ops.adminSessionToken = "other-own-token";
    if (change === "workspace") c.uiState.workspace.workspaceKey = "other-own-workspace";
    if (change === "tenant") c.uiState.workspace.tenantKey = "other-own-tenant";
    if (change === "destroy") c.destroyRef.destroyed = true;
    if (change === "camera") f.video.srcObject = {};
    const expected = { blob: c.captureBlob, preview: c.capturePreviewUrl, status: c.status };
    await finish(f, pending);
    assert.equal(c.captureBlob, expected.blob);
    assert.equal(c.capturePreviewUrl, expected.preview);
    assert.equal(c.status, expected.status);
    c.clearCapture();
  });
}

test("a later camera capture wins even when an earlier encoding completes last", async () => {
  const f = fixture(), c = f.component;
  const first = c.captureCurrentFrame(), second = c.captureCurrentFrame();
  const newer = image("newer"); f.callbacks[1](newer); await second;
  f.callbacks[0](image("older")); await first;
  assert.equal(c.captureBlob, newer); c.clearCapture();
});

test("an unchanged capture preserves the actual encoded image", async () => {
  const f = fixture(), blob = image("own-exact-photo"), pending = f.component.captureCurrentFrame();
  await finish(f, pending, blob);
  assert.equal(f.component.captureBlob, blob);
  assert.equal(f.component.statusIsError, false); f.component.clearCapture();
});

test("a failed encoding does not stop the camera or resolve a scanned target", async () => {
  const f = fixture(), c = f.component;
  c.attachment = null; c.attachmentCode = "";
  const pending = c.handleScannedCode("second");
  f.lookup.resolve(target("second"));
  await finish(f, pending, null);
  assert.equal(c.cameraActive, true);
  assert.equal(c.attachmentCode, ""); assert.equal(f.lookups.length, 0);
});

for (const change of ["code", "operator", "workspace", "tenant", "destroy"]) {
  for (const failure of [false, true]) {
    test(`late ${failure ? "failed" : "successful"} target lookup cannot update changed ${change}`, async () => {
      const f = fixture(), c = f.component;
      c.attachmentCode = "second";
      const pending = c.resolveCode();
      if (change === "code") c.attachmentCode = "third";
      if (change === "operator") c.uiState.ops.adminSessionToken = "other-own-token";
      if (change === "workspace") c.uiState.workspace.workspaceKey = "other-own-workspace";
      if (change === "tenant") c.uiState.workspace.tenantKey = "other-own-tenant";
      if (change === "destroy") c.destroyRef.destroyed = true;
      const expected = { attachment: c.attachment, status: c.status, code: c.attachmentCode };
      if (failure) f.lookup.reject(new Error("old lookup failed")); else f.lookup.resolve(target("second"));
      await pending;
      assert.deepEqual({ attachment: c.attachment, status: c.status, code: c.attachmentCode }, expected);
    });
  }
}

test("manual target replacement discards a photo associated with the earlier target", async () => {
  const f = fixture(), c = f.component;
  c.setCapture(image("first-target-photo"), "first.png"); c.attachmentCode = "second";
  const pending = c.resolveCode(); f.lookup.resolve(target("second")); await pending;
  assert.equal(c.attachment.attachmentId, "second"); assert.equal(c.captureBlob, null);
});

test("automatic QR lookup keeps its newly captured photo for the resolved target", async () => {
  const f = fixture(), c = f.component;
  c.attachment = null; c.attachmentCode = "";
  const pending = c.handleScannedCode("second"), blob = image("second-page");
  f.callbacks[0](blob);
  for (let i = 0; i < 12; i++) await Promise.resolve();
  f.lookup.resolve(target("second")); await pending;
  assert.equal(c.attachment.attachmentId, "second"); assert.equal(c.captureBlob, blob);
  c.clearCapture();
});

for (const change of ["target", "operator", "workspace", "tenant", "destroy", "retake"]) {
  test(`upload does not begin after ${change} while reading the photo bytes`, async () => {
    const f = fixture(), c = f.component, bytes = deferred();
    c.captureBlob = { type: "image/png", arrayBuffer: () => bytes.promise }; c.captureFileName = "first.png";
    const pending = c.uploadCapture();
    if (change === "target") c.attachment = target("second");
    if (change === "operator") c.uiState.ops.adminSessionToken = "other-own-token";
    if (change === "workspace") c.uiState.workspace.workspaceKey = "other-own-workspace";
    if (change === "tenant") c.uiState.workspace.tenantKey = "other-own-tenant";
    if (change === "destroy") c.destroyRef.destroyed = true;
    if (change === "retake") c.clearCapture();
    f.upload.resolve(target("first")); bytes.resolve(new Uint8Array([1, 2, 3]).buffer); await pending;
    assert.equal(f.uploads.length, 0);
  });
}

test("a late upload result cannot replace another target or clear its new photo", async () => {
  const f = fixture(), c = f.component;
  c.setCapture(image("first"), "first.png"); const pending = c.uploadCapture();
  for (let i = 0; i < 12; i++) await Promise.resolve();
  assert.equal(f.uploads.length, 1);
  c.attachment = target("second"); const newPhoto = image("second"); c.setCapture(newPhoto, "second.png");
  f.upload.resolve(target("first")); await pending;
  assert.equal(c.attachment.attachmentId, "second"); assert.equal(c.captureBlob, newPhoto); c.clearCapture();
});

for (const change of ["operator", "workspace", "tenant", "destroy", "retake"]) {
  for (const failure of [false, true]) {
    test(`late ${failure ? "failed" : "successful"} upload cannot update changed ${change}`, async () => {
      const f = fixture(), c = f.component;
      c.setCapture(image("first"), "first.png"); const pending = c.uploadCapture();
      for (let i = 0; i < 12; i++) await Promise.resolve();
      assert.equal(f.uploads.length, 1);
      if (change === "operator") c.uiState.ops.adminSessionToken = "other-own-token";
      if (change === "workspace") c.uiState.workspace.workspaceKey = "other-own-workspace";
      if (change === "tenant") c.uiState.workspace.tenantKey = "other-own-tenant";
      if (change === "destroy") c.destroyRef.destroyed = true;
      if (change === "retake") c.clearCapture();
      const expected = { attachment: c.attachment, blob: c.captureBlob, status: c.status };
      if (failure) f.upload.reject(new Error("old upload failed")); else f.upload.resolve(target("first"));
      await pending;
      assert.deepEqual({ attachment: c.attachment, blob: c.captureBlob, status: c.status }, expected);
      c.clearCapture();
    });
  }
}

test("a reset lookup cannot clear the busy state of a newer lookup", async () => {
  const f = fixture(), c = f.component, secondLookup = deferred();
  c.attachmentCode = "second";
  const old = c.resolveCode();
  c.resetTarget(); c.attachmentCode = "third";
  c.manager.get = async () => secondLookup.promise;
  const newer = c.resolveCode();
  f.lookup.resolve(target("second")); await old;
  assert.equal(c.busy, true); assert.equal(c.attachment, null);
  secondLookup.resolve(target("third")); await newer;
  assert.equal(c.busy, false); assert.equal(c.attachment.attachmentId, "third");
});

test("an unchanged failed upload retains its photo for an authorized retry", async () => {
  const f = fixture(), c = f.component, blob = image("own-retry");
  c.setCapture(blob, "own.png"); const pending = c.uploadCapture();
  f.upload.reject(new Error("own-upload-failure")); await pending;
  assert.equal(c.captureBlob, blob); assert.equal(c.status, "own-upload-failure");
  assert.equal(c.statusIsError, true); assert.equal(c.busy, false); c.clearCapture();
});

for (const change of ["reset", "operator", "workspace", "tenant", "destroy"]) {
  for (const failure of [false, true]) {
    test(`late ${failure ? "failed" : "successful"} QR image decoding cannot update changed ${change}`, async () => {
      const f = fixture(), c = f.component;
      const pending = c.scanQrImage({ target: { files: [image("own-qr")], value: "own.png" } });
      if (change === "reset") c.resetTarget();
      if (change === "operator") c.uiState.ops.adminSessionToken = "other-own-token";
      if (change === "workspace") c.uiState.workspace.workspaceKey = "other-own-workspace";
      if (change === "tenant") c.uiState.workspace.tenantKey = "other-own-tenant";
      if (change === "destroy") c.destroyRef.destroyed = true;
      const expected = { attachment: c.attachment, status: c.status, code: c.attachmentCode };
      f.lookup.resolve(target("second"));
      if (failure) f.qr.reject(new Error("old-qr-failure")); else f.qr.resolve({ data: "second" });
      await pending;
      assert.deepEqual({ attachment: c.attachment, status: c.status, code: c.attachmentCode }, expected);
      assert.equal(f.lookups.length, 0); assert.equal(f.disposed.length, 1);
    });
  }
}

test("unchanged authorized upload sends exact bytes and clears its own capture", async () => {
  const f = fixture(), c = f.component;
  c.setCapture(image("own-exact-Ä"), "own.png"); const pending = c.uploadCapture();
  f.upload.resolve(target("first")); await pending;
  assert.equal(f.uploads.length, 1);
  assert.equal(Buffer.from(f.uploads[0].payload.dataBase64, "base64").toString(), "own-exact-Ä");
  assert.deepEqual(f.uploads[0].scope, { sessionToken: "own-token", tenantKey: "own-tenant", workspaceKey: "own-workspace" });
  assert.equal(f.uploads[0].payload.fileName, "own.png"); assert.equal(c.captureBlob, null);
});
