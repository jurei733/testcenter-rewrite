import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { reloadChromiumIbResources } from "./chromium-ib-resource-reload.mjs";

const runtime = { id: "runtime-a", loaderId: "old-load",
  url: "http://127.0.0.1:4311/api/v1/participant/sessions/session-a/resources/.access/capability/IB_SAMPLE_2025/runtimes/ib-runtime.9.9.0.html" };
function response(key, changes = {}) {
  return { requestId: key, frameId: runtime.id, loaderId: "new-load",
    type: key === "document" ? "Document" : "Script",
    response: { url: key === "document" ? runtime.url : new URL("9.9.0/main.220e1b93.js", runtime.url).href,
      status: 200, headers: { "Content-Type": key === "document" ? "text/html; charset=utf-8" : "text/javascript; charset=utf-8" } },
    ...changes };
}
function fixture() {
  const session = new EventEmitter(); let enabled = false;
  session.send = async method => { assert.equal(method, "Network.enable"); enabled = true; };
  const emit = (event, finish = true) => {
    assert.equal(enabled, true, "Observation must start before the actual reload.");
    session.emit("Network.responseReceived", event);
    if (finish) session.emit("Network.loadingFinished", { requestId: event.requestId });
  };
  return { session, emit };
}
function assertClean(session) {
  for (const event of ["Network.responseReceived", "Network.loadingFinished", "Network.loadingFailed"])
    assert.equal(session.listenerCount(event), 0);
}

test("native resource proof requires completed actual Document and Script responses from one new load", async () => {
  const { session, emit } = fixture();
  const result = await reloadChromiumIbResources(session, runtime, () => {
    emit(response("document")); emit(response("script"));
  });
  assert.equal(result.document.frameId, runtime.id);
  assert.equal(result.script.loaderId, "new-load");
  assert.equal(result.script.headers["content-type"], "text/javascript; charset=utf-8");
  assert.ok(Object.isFrozen(result.script.headers)); assertClean(session);
});

test("native resource proof cannot accept another Frame, Session, capability, origin, resource or old loader", async () => {
  for (const change of [
    e => { e.frameId = "foreign-frame"; }, e => { e.loaderId = runtime.loaderId; },
    e => { e.response.url = e.response.url.replace("session-a", "session-b"); },
    e => { e.response.url = e.response.url.replace("capability/", "other-capability/"); },
    e => { e.response.url = e.response.url.replace("4311", "9999"); },
    e => { e.response.url += "?foreign=true"; },
    e => { e.response.url = e.response.url.replace("220e1b93", "other"); }
  ]) {
    const { session, emit } = fixture();
    await assert.rejects(reloadChromiumIbResources(session, runtime, () => {
      emit(response("document")); const script = response("script"); change(script); emit(script);
    }, 20), /deadline expired/u);
    assertClean(session);
  }
});

test("native resource proof rejects failed, mismatched or frame-blocked browser responses", async () => {
  for (const change of [
    e => { e.response.status = 404; }, e => { e.type = "Fetch"; },
    e => { e.loaderId = "different-new-load"; }, e => { delete e.requestId; },
    e => { delete e.loaderId; }, e => { e.response.headers["Content-Type"] = "text/plain"; },
    e => { e.response.headers["X-Frame-Options"] = "DENY"; },
    e => { e.response.headers["content-type"] = "text/javascript; charset=utf-8"; }
  ]) {
    const { session, emit } = fixture();
    await assert.rejects(reloadChromiumIbResources(session, runtime, () => {
      emit(response("document")); const script = response("script"); change(script); emit(script);
    }));
    assertClean(session);
  }
});

test("response headers alone cannot prove an unfinished or failed browser download", async () => {
  for (const fail of [false, true]) {
    const { session, emit } = fixture();
    await assert.rejects(reloadChromiumIbResources(session, runtime, () => {
      emit(response("document")); emit(response("script"), false);
      if (fail) session.emit("Network.loadingFailed", { requestId: "script" });
    }, 20), fail ? /download failed/u : /deadline expired/u);
    assertClean(session);
  }
});

test("native resource deadlines clean up a failed or hung attachment without triggering a late reload", async () => {
  for (const hang of [false, true]) {
    const { session } = fixture(); let reloaded = false;
    session.send = () => hang ? new Promise(() => {}) : Promise.reject(new Error("enable failed"));
    await assert.rejects(reloadChromiumIbResources(session, runtime, () => { reloaded = true; }, 20),
      hang ? /deadline expired/u : /enable failed/u);
    assert.equal(reloaded, false); assertClean(session);
  }
});

test("native resource observation cleans up a rejected reload and never accepts an unpinned runtime", async () => {
  const { session } = fixture();
  await assert.rejects(reloadChromiumIbResources(session, runtime, () => { throw new Error("reload denied"); }), /reload denied/u);
  assertClean(session);
  await assert.rejects(reloadChromiumIbResources(session, { ...runtime, url: runtime.url.replace("9.9.0", "9.8.0") }, () => {}), /pinned/u);
  await assert.rejects(reloadChromiumIbResources(session, runtime, () => {}, Infinity), /bounded/u);
  assertClean(session);
});
