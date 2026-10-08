import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import QrScanner from "qr-scanner";

const dataModule = source => `data:text/javascript;base64,${Buffer.from(source).toString("base64")}`;
const productionSource = name => ts.transpileModule(readFileSync(new URL(
  `../apps/web/src/app/${name}.ts`, import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
}).outputText.replaceAll('"qr-scanner"', JSON.stringify(import.meta.resolve("qr-scanner")));
const decoderModule = dataModule(productionSource("attachment-qr-decoder"));
const { AttachmentQrDecoder, createAttachmentQrWorker } = await import(decoderModule);
const { AttachmentCameraScanner } = await import(dataModule(productionSource("attachment-camera-scanner")
  .replace('"./attachment-qr-decoder"', JSON.stringify(decoderModule))));
const deferred = () => {
  let resolve, reject;
  const promise = new Promise((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
};
const abort = error => error.name === "AbortError";

test("actual worker factory preserves normal and inverted image decoding through the pinned transport", async () => {
  const messages = [];
  const worker = { postMessage(message) { messages.push(message); } };
  assert.equal(await createAttachmentQrWorker(async () => ({ createWorker: () => worker })), worker);
  assert.deepEqual(messages, [{ type: "inversionMode", data: "both" }]);
});

test("worker configuration failure releases the created worker and stays explicit", async () => {
  const failure = new Error("worker configuration failed"); let releases = 0;
  await assert.rejects(createAttachmentQrWorker(async () => ({ createWorker: () => ({
    postMessage() { throw failure; }, terminate() { releases++; }
  }) })), error => error === failure);
  assert.equal(releases, 1);
});

test("actual decoder supplies one owned worker through the public SDK option and preserves exact results", async () => {
  const calls = [];
  const worker = { terminate() { calls.push("terminate"); } };
  const image = new Blob(["owned image"]);
  const result = { data: "att-exact-ä", cornerPoints: [{ x: 1, y: 2 }] };
  const decoder = new AttachmentQrDecoder({
    async createWorker() { calls.push("create"); return worker; },
    async scanImage(received, options) {
      assert.equal(received, image);
      assert.deepEqual(options, { qrEngine: worker, alsoTryWithoutScanRegion: true, returnDetailedScanResult: true });
      calls.push("scan"); return result;
    }
  });
  assert.equal(await decoder.decode(image), result);
  assert.equal(await decoder.decode(image), result);
  decoder.dispose(); decoder.dispose();
  await Promise.resolve();
  assert.deepEqual(calls, ["create", "scan", "scan", "terminate"]);
  await assert.rejects(decoder.decode(image), abort);
});

test("actual decoder serializes pending requests instead of overlapping worker work", async () => {
  const first = deferred(), began = deferred();
  const images = [new Blob(["1"]), new Blob(["2"])];
  const received = [];
  const decoder = new AttachmentQrDecoder({ async createWorker() { return { terminate() {} }; },
    async scanImage(image) {
      received.push(image);
      if (image === images[0]) { began.resolve(); await first.promise; }
      return { data: image === images[0] ? "one" : "two", cornerPoints: [] };
    }
  });
  const operations = images.map(image => decoder.decode(image));
  await began.promise;
  assert.deepEqual(received, [images[0]]);
  first.resolve();
  assert.deepEqual((await Promise.all(operations)).map(result => result.data), ["one", "two"]);
  decoder.dispose();
});

for (const failure of [QrScanner.NO_QR_CODE_FOUND, new Error("invalid image")]) {
  test(`actual decoder propagates ${String(failure)} and permits a later separate image`, async () => {
    let calls = 0;
    const decoder = new AttachmentQrDecoder({ async createWorker() { return { terminate() {} }; },
      async scanImage() { if (!calls++) throw failure; return { data: "next", cornerPoints: [] }; }
    });
    await assert.rejects(decoder.decode(new Blob()), error => error === failure);
    assert.equal((await decoder.decode(new Blob())).data, "next");
    decoder.dispose();
  });
}

test("disposing during worker load terminates the late worker without decoding", async () => {
  const loading = deferred(), began = deferred(); let terminations = 0, scans = 0;
  const decoder = new AttachmentQrDecoder({ createWorker() { began.resolve(); return loading.promise; },
    async scanImage() { scans++; }
  });
  const operation = decoder.decode(new Blob());
  await began.promise;
  decoder.dispose();
  loading.resolve({ terminate() { terminations++; } });
  await assert.rejects(operation, abort);
  assert.equal(scans, 0); assert.equal(terminations, 1);
});

test("disposing drops an in-flight result and queued requests, without starting further scans", async () => {
  const pending = deferred(), began = deferred(); let scans = 0;
  const decoder = new AttachmentQrDecoder({ async createWorker() { return { terminate() {} }; },
    scanImage() { scans++; began.resolve(); return pending.promise; }
  });
  const first = decoder.decode(new Blob());
  const second = decoder.decode(new Blob());
  const assertions = [assert.rejects(first, abort), assert.rejects(second, abort)];
  await began.promise;
  decoder.dispose(); pending.resolve({ data: "late", cornerPoints: [] });
  await Promise.all(assertions);
  assert.equal(scans, 1);
});

test("failed worker creation stays an explicit failure and disposal has no unhandled rejection", async () => {
  const failure = new Error("worker unavailable"); let scans = 0;
  const decoder = new AttachmentQrDecoder({ async createWorker() { throw failure; }, async scanImage() { scans++; } });
  await assert.rejects(decoder.decode(new Blob()), error => error === failure);
  decoder.dispose(); await Promise.resolve();
  assert.equal(scans, 0);
});

const cameraFixture = ({ media, play, decode, onDecode, visibility, settings = {}, torch = true } = {}) => {
  const events = [], timers = new Map(); let handle = 0;
  const constraints = [];
  const track = { label: "owned camera", stop() { events.push("track-stop"); },
    getSettings() { return settings; }, getCapabilities() { return { torch }; },
    async applyConstraints(value) { events.push(["flash", value]); }
  };
  const stream = { getTracks: () => [track], getVideoTracks: () => [track] };
  const video = { srcObject: null, style: {}, readyState: 2, videoWidth: 640, videoHeight: 480,
    async play() { events.push("play"); await play?.(); }, pause() { events.push("pause"); }
  };
  const errors = [], results = [];
  const scanner = new AttachmentCameraScanner(video, async result => {
    results.push(result); await onDecode?.(result);
  }, error => errors.push(error), "environment", {
    async getUserMedia(value) { constraints.push(value); return media ? media(value) : stream; },
    createDecoder() { events.push("decoder-create"); return {
      async decode(received) { assert.equal(received, video); events.push("decode");
        return decode ? decode() : { data: "att-camera", cornerPoints: [] }; },
      dispose() { events.push("decoder-dispose"); }
    }; },
    schedule(callback, milliseconds) { const key = ++handle; timers.set(key, callback); events.push(["schedule", milliseconds]); return key; },
    cancel(key) { events.push("cancel"); timers.delete(key); }, visibility
  }, active => events.push(["activity", active]));
  const tick = async () => {
    const [key, callback] = [...timers.entries()][0] ?? [];
    assert.ok(callback, "The actual camera must have scheduled a frame.");
    timers.delete(key); callback();
    for (let i = 0; i < 8; i++) await Promise.resolve();
  };
  return { scanner, video, stream, track, events, errors, results, timers, constraints, tick };
};

test("actual camera owns the media stream and decodes video through the worker without native detector", async () => {
  const f = cameraFixture();
  await f.scanner.start();
  assert.deepEqual(f.constraints[0], { audio: false, video: { facingMode: { ideal: "environment" },
    width: { ideal: 1280 }, height: { ideal: 720 } } });
  assert.equal(f.video.srcObject, f.stream); assert.equal(f.video.playsInline, true); assert.equal(f.video.muted, true);
  await f.tick();
  assert.equal(f.results[0].data, "att-camera");
  assert.deepEqual(f.events.at(-1), ["schedule", 125]);
  f.scanner.destroy();
  assert.equal(f.video.srcObject, null); assert.equal(f.timers.size, 0);
  assert.equal(f.events.filter(value => value === "track-stop").length, 1);
  assert.equal(f.events.filter(value => value === "decoder-dispose").length, 1);
});

test("ordinary frames without a QR code keep scanning without an error or stale target", async () => {
  const f = cameraFixture({ decode: () => { throw QrScanner.NO_QR_CODE_FOUND; } });
  await f.scanner.start(); await f.tick(); await f.tick();
  assert.deepEqual(f.errors, []); assert.deepEqual(f.results, []); assert.equal(f.timers.size, 1);
  f.scanner.destroy();
});

test("unready video frames do not enter the worker", async () => {
  const f = cameraFixture(); f.video.readyState = 0; f.video.videoWidth = 0;
  await f.scanner.start(); await f.tick();
  assert.equal(f.events.includes("decode"), false); assert.equal(f.timers.size, 1);
  f.scanner.destroy();
});

test("camera worker failure stops the owned stream and reports exactly one error", async () => {
  const failure = new Error("worker failed");
  const f = cameraFixture({ decode: () => { throw failure; } });
  await f.scanner.start(); await f.tick();
  assert.deepEqual(f.errors, [failure]); assert.equal(f.timers.size, 0); assert.equal(f.video.srcObject, null);
  f.scanner.destroy();
  assert.equal(f.events.filter(value => value === "track-stop").length, 1);
});

test("stop while a frame is decoding drops the late QR and cannot rearm the loop", async () => {
  const pending = deferred(); const f = cameraFixture({ decode: () => pending.promise });
  await f.scanner.start(); await f.tick();
  f.scanner.stop(); pending.resolve({ data: "late", cornerPoints: [] });
  for (let i = 0; i < 8; i++) await Promise.resolve();
  assert.deepEqual(f.results, []); assert.deepEqual(f.errors, []); assert.equal(f.timers.size, 0);
});

test("async target/capture confirmation holds the loop until the actual callback finishes", async () => {
  const pending = deferred(); const f = cameraFixture({ onDecode: () => pending.promise });
  await f.scanner.start(); await f.tick(); assert.equal(f.timers.size, 0);
  pending.resolve(); for (let i = 0; i < 8; i++) await Promise.resolve();
  assert.equal(f.timers.size, 1); f.scanner.destroy();
});

test("destroy during a camera permission request stops its late stream and never starts decoding", async () => {
  const permission = deferred(); const f = cameraFixture({ media: () => permission.promise });
  const starting = f.scanner.start(); f.scanner.destroy(); permission.resolve(f.stream);
  await assert.rejects(starting, abort);
  assert.equal(f.events.includes("play"), false); assert.equal(f.events.includes("decoder-create"), false);
  assert.equal(f.events.filter(value => value === "track-stop").length, 1);
  await assert.rejects(f.scanner.start(), abort);
});

test("camera permission denial stays explicit and never creates a worker", async () => {
  const denied = new DOMException("permission denied", "NotAllowedError");
  const f = cameraFixture({ media: () => { throw denied; } });
  await assert.rejects(f.scanner.start(), error => error === denied);
  assert.equal(f.events.includes("decoder-create"), false); assert.equal(f.timers.size, 0);
});

test("failed video play releases the owned media stream", async () => {
  const failure = new Error("video play failed"); const f = cameraFixture({ play: () => { throw failure; } });
  await assert.rejects(f.scanner.start(), error => error === failure);
  assert.equal(f.video.srcObject, null); assert.equal(f.events.includes("decoder-create"), false);
  assert.equal(f.events.filter(value => value === "track-stop").length, 1);
});

test("camera replacement releases the prior stream and uses an exact device preference", async () => {
  const f = cameraFixture(); await f.scanner.start(); await f.scanner.setCamera("rear-device");
  assert.deepEqual(f.constraints[1].video.deviceId, { exact: "rear-device" });
  assert.equal(f.constraints[1].video.facingMode, undefined);
  assert.equal(f.events.filter(value => value === "decoder-dispose").length, 1);
  assert.equal(f.timers.size, 1); f.scanner.destroy();
});

test("a late old permission result cannot stop a replacement stream", async () => {
  const old = deferred(), replacement = deferred(); let request = 0;
  const f = cameraFixture({ media: () => request++ ? replacement.promise : old.promise });
  const first = f.scanner.start(); const second = f.scanner.setCamera("new-device");
  replacement.resolve(f.stream); await second;
  let oldStops = 0; const oldStream = { getTracks: () => [{ stop() { oldStops++; } }] };
  old.resolve(oldStream); await assert.rejects(first, abort);
  assert.equal(oldStops, 1); assert.equal(f.video.srcObject, f.stream);
  assert.equal(f.events.includes("track-stop"), false); assert.equal(f.timers.size, 1);
  f.scanner.destroy();
});

test("front camera mirror presentation follows actual facing mode", async () => {
  const f = cameraFixture({ settings: { facingMode: "user" } });
  await f.scanner.start(); assert.equal(f.video.style.transform, "scaleX(-1)"); f.scanner.destroy();
});

test("actual torch controls apply constraints on the active track and clear state on stop", async () => {
  const f = cameraFixture(); await f.scanner.start(); assert.equal(await f.scanner.hasFlash(), true);
  await f.scanner.toggleFlash(); assert.equal(f.scanner.isFlashOn(), true);
  assert.deepEqual(f.events.find(event => Array.isArray(event) && event[0] === "flash"), ["flash", { advanced: [{ torch: true }] }]);
  f.scanner.stop(); assert.equal(f.scanner.isFlashOn(), false); assert.equal(await f.scanner.hasFlash(), false);
});

test("unsupported torch stays disabled rather than requesting a second camera", async () => {
  const f = cameraFixture({ torch: false }); await f.scanner.start();
  assert.equal(await f.scanner.hasFlash(), false); await assert.rejects(f.scanner.toggleFlash(), /no flash/);
  assert.equal(f.constraints.length, 1); f.scanner.destroy();
});

const visibilityFixture = () => {
  let hidden = false, listener, removals = 0;
  return { hidden: () => hidden, subscribe(callback) { listener = callback; return () => { removals++; listener = null; }; },
    change(value) { hidden = value; listener?.(); }, removals: () => removals };
};
test("hidden tabs release their camera and worker, then resume only the requested camera", async () => {
  const visibility = visibilityFixture(), f = cameraFixture({ visibility });
  await f.scanner.start(); visibility.change(true);
  assert.equal(f.scanner.isActive(), false); assert.equal(f.video.srcObject, null);
  assert.equal(f.timers.size, 0); assert.equal(f.events.filter(value => value === "decoder-dispose").length, 1);
  visibility.change(false); for (let i = 0; i < 8; i++) await Promise.resolve();
  assert.equal(f.scanner.isActive(), true); assert.equal(f.constraints.length, 2);
  assert.equal(f.timers.size, 1); f.scanner.destroy();
  f.scanner.destroy();
  assert.equal(visibility.removals(), 1);
});
test("manual Stop while hidden prevents a later visibility event from reopening the camera", async () => {
  const visibility = visibilityFixture(), f = cameraFixture({ visibility });
  await f.scanner.start(); visibility.change(true); f.scanner.stop(); visibility.change(false);
  await Promise.resolve(); assert.equal(f.constraints.length, 1); assert.equal(f.scanner.isActive(), false);
  f.scanner.destroy();
});
test("Start on a hidden tab waits for visibility without requesting permission or creating a worker", async () => {
  const visibility = visibilityFixture(); visibility.change(true);
  const f = cameraFixture({ visibility }); await f.scanner.start();
  assert.equal(f.constraints.length, 0); assert.equal(f.events.includes("decoder-create"), false);
  visibility.change(false); for (let i = 0; i < 8; i++) await Promise.resolve();
  assert.equal(f.scanner.isActive(), true); assert.equal(f.constraints.length, 1); f.scanner.destroy();
});
test("permission finishing after a tab is hidden releases that stream but retains the requested resume", async () => {
  const permission = deferred(), visibility = visibilityFixture(); let request = 0;
  const f = cameraFixture({ visibility, media: () => request++ ? f.stream : permission.promise });
  const starting = f.scanner.start(); visibility.change(true); permission.resolve(f.stream); await starting;
  assert.equal(f.events.includes("play"), false); assert.equal(f.scanner.isActive(), false);
  visibility.change(false); for (let i = 0; i < 8; i++) await Promise.resolve();
  assert.equal(f.scanner.isActive(), true); f.scanner.destroy();
});
test("failed visibility resume stays explicit and never rearms another media request", async () => {
  const visibility = visibilityFixture(); let requests = 0;
  const failure = new Error("resume denied");
  const f = cameraFixture({ visibility, media: () => { if (requests++) throw failure; return f.stream; } });
  await f.scanner.start(); visibility.change(true); visibility.change(false);
  for (let i = 0; i < 8; i++) await Promise.resolve();
  assert.deepEqual(f.errors, [failure]); assert.equal(f.scanner.isActive(), false);
  assert.equal(f.timers.size, 0); f.scanner.destroy();
});
test("a visibility resume that wins before old permission completion cannot be stopped by that old start", async () => {
  const old = deferred(), visibility = visibilityFixture(); let request = 0;
  const f = cameraFixture({ visibility, media: () => request++ ? f.stream : old.promise });
  const first = f.scanner.start(); visibility.change(true); visibility.change(false);
  for (let i = 0; i < 8; i++) await Promise.resolve();
  assert.equal(f.scanner.isActive(), true);
  let oldStops = 0; old.resolve({ getTracks: () => [{ stop() { oldStops++; } }] }); await first;
  assert.equal(oldStops, 1); assert.equal(f.scanner.isActive(), true); assert.equal(f.video.srcObject, f.stream);
  f.scanner.destroy();
});
test("hiding during pending video play cancels that start without a camera error or leaked stream", async () => {
  const play = deferred(), visibility = visibilityFixture(), f = cameraFixture({ visibility, play: () => play.promise });
  const first = f.scanner.start(); for (let i = 0; i < 8; i++) await Promise.resolve();
  visibility.change(true); play.reject(new DOMException("play interrupted", "AbortError")); await first;
  assert.equal(f.video.srcObject, null); assert.equal(f.scanner.isActive(), false); assert.deepEqual(f.errors, []);
  f.scanner.destroy();
});

// Execute the actual component methods with only Angular injection/metadata
// and browser-resource boundaries supplied by this harness.
const componentHost = dataModule(`
  export const Component = () => target => target, ViewChild = () => () => {};
  export const inject = token => globalThis.__attachmentCaptureHost[token.name];
  export class ChangeDetectorRef {} export class DestroyRef {} export class ElementRef {}
  export class AttachmentManagerService {} export class RewriteAppUiStateService {}
  export class RewriteAppOperatorAccessService {} export class ActivatedRoute {}
  export const CommonModule = {}, FormsModule = {}, RouterLink = {};
`);
const componentSource = ts.transpileModule(readFileSync(new URL(
  "../apps/web/src/app/attachment-capture.component.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext, experimentalDecorators: true }
}).outputText.replace(/"(?:@angular\/(?:common|core|forms|router)|\.\/(?:attachment-manager.service|rewrite-app-ui-state.service|rewrite-app-operator-access.service))"/g,
  JSON.stringify(componentHost))
  .replace('"qr-scanner"', JSON.stringify(import.meta.resolve("qr-scanner")))
  .replace('"./attachment-qr-decoder"', JSON.stringify(decoderModule))
  .replace('"./attachment-camera-scanner"', JSON.stringify(dataModule(productionSource("attachment-camera-scanner")
    .replace('"./attachment-qr-decoder"', JSON.stringify(decoderModule)))));
const { AttachmentCaptureComponent } = await import(dataModule(componentSource));
const withCapture = async action => {
  const previous = globalThis.__attachmentCaptureHost;
  const destroy = { destroyed: false }; let lookups = 0, blobCallback;
  const stream = {}, video = { srcObject: stream, videoWidth: 640, videoHeight: 480 };
  globalThis.__attachmentCaptureHost = {
    AttachmentManagerService: { async get() { lookups++; }, describeError: error => error.message },
    RewriteAppUiStateService: { workspace: { tenantKey: "owned", workspaceKey: "owned" }, ops: { adminSessionToken: "owned" } },
    RewriteAppOperatorAccessService: {}, ActivatedRoute: {}, DestroyRef: destroy,
    ChangeDetectorRef: { markForCheck() {} }
  };
  const component = new AttachmentCaptureComponent();
  component.cameraActive = true;
  component.cameraVideo = { nativeElement: video };
  component.captureCanvas = { nativeElement: { getContext: () => ({ drawImage() {} }),
    toBlob(callback) { blobCallback = callback; } } };
  try { await action({ component, destroy, video, lookups: () => lookups,
    finishBlob: () => blobCallback(new Blob(["owned frame"], { type: "image/png" })) }); }
  finally {
    destroy.destroyed = true; component.ngOnDestroy();
    if (previous === undefined) delete globalThis.__attachmentCaptureHost;
    else globalThis.__attachmentCaptureHost = previous;
  }
};

test("late image encoding after route destruction cannot retain a preview or lookup a target", async () => {
  await withCapture(async ({ component, destroy, finishBlob, lookups }) => {
    const capture = component.handleScannedCode("att-late");
    destroy.destroyed = true; component.ngOnDestroy(); finishBlob(); await capture;
    assert.equal(component.captureBlob, null); assert.equal(component.capturePreviewUrl, null);
    assert.equal(lookups(), 0);
  });
});

test("stop during image encoding cannot retain the late frame or lookup its QR target", async () => {
  await withCapture(async ({ component, finishBlob, lookups }) => {
    const capture = component.handleScannedCode("att-stopped");
    component.stopCamera(); finishBlob(); await capture;
    assert.equal(component.captureBlob, null); assert.equal(lookups(), 0);
  });
});

test("changing a stopped camera selection does not restart a media request", async () => {
  await withCapture(async ({ component }) => {
    let requests = 0;
    component.scanner = { async setCamera() { requests++; }, destroy() {} };
    component.cameraActive = false; component.selectedCameraId = "next-device";
    await component.selectCamera(); assert.equal(requests, 0);
    assert.equal(component.selectedCameraId, "next-device");
  });
});

test("failed camera selection clears the active and flash indicators", async () => {
  await withCapture(async ({ component }) => {
    component.scanner = { async setCamera() { throw new Error("device unavailable"); }, destroy() {} };
    component.selectedCameraId = "missing-device"; component.hasFlash = true; component.flashOn = true;
    await component.selectCamera();
    assert.equal(component.cameraActive, false); assert.equal(component.hasFlash, false);
    assert.equal(component.flashOn, false); assert.equal(component.status, "device unavailable");
    assert.equal(component.statusIsError, true);
  });
});

test("late selection failure after Stop cannot overwrite the stopped-camera state", async () => {
  await withCapture(async ({ component }) => {
    const pending = deferred();
    component.scanner = { setCamera: () => pending.promise, stop() {}, destroy() {} };
    component.selectedCameraId = "pending-device";
    const changing = component.selectCamera(); component.stopCamera();
    const stoppedStatus = component.status;
    pending.reject(new Error("late device failure")); await changing;
    assert.equal(component.status, stoppedStatus); assert.equal(component.statusIsError, false);
    assert.equal(component.cameraActive, false);
  });
});
