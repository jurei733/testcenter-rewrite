import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import { findAuthorizedIbRuntime, findBoundIbPlayerTree, ibPointerPoint, withChromiumIbRuntime } from "./chromium-ib-runtime.mjs";

const pageUrl = "http://127.0.0.1:4311/app/participant";
const runtimeUrl = "http://127.0.0.1:4311/api/v1/participant/sessions/session-a/resources/.access/capability/IB_SAMPLE_2025/runtimes/ib-runtime.9.9.0.html";
const tree = () => ({ frame: { id: "outer", url: "about:srcdoc" }, childFrames: [{ frame: {
  id: "runtime", parentId: "outer", name: "ib-runtime-host", loaderId: "load-a", url: runtimeUrl
} }] });
const pageTree = () => {
  const player = tree(); player.frame.parentId = "page";
  return { frame: { id: "page", url: pageUrl }, childFrames: [player] };
};

test("shared-target selection binds the exact native DOM owner instead of searching runtime URLs", () => {
  const root = pageTree(); const unrelated = tree(); unrelated.frame.id = "unrelated";
  unrelated.frame.parentId = "page"; root.childFrames.unshift(unrelated);
  assert.equal(findBoundIbPlayerTree(root, "outer", pageUrl), root.childFrames[1]);
  assert.equal(findAuthorizedIbRuntime(findBoundIbPlayerTree(root, "outer", pageUrl), pageUrl, "session-a").id, "runtime");
  for (const mutate of [
    candidate => { candidate.frame.url = `${pageUrl}?foreign=1`; },
    candidate => { candidate.childFrames = []; },
    candidate => { candidate.childFrames.push(candidate.childFrames[0]); },
    candidate => { candidate.childFrames[0].frame.parentId = "other-page"; },
    candidate => { candidate.childFrames = [{ frame: { id: "wrapper" }, childFrames: candidate.childFrames }]; }
  ]) {
    const candidate = pageTree(); mutate(candidate);
    assert.throws(() => findBoundIbPlayerTree(candidate, "outer", pageUrl));
  }
  assert.throws(() => findBoundIbPlayerTree(pageTree(), "", pageUrl), /DOM owner/u);
});

test("native IB selection requires the exact direct, authorized pinned runtime", () => {
  assert.equal(findAuthorizedIbRuntime(tree(), pageUrl, "session-a").id, "runtime");
  assert.equal(findAuthorizedIbRuntime({ frame: { url: "about:blank" } }, pageUrl, "session-a"), null);
  const pending = tree(); pending.childFrames[0].frame.url = "about:blank";
  assert.equal(findAuthorizedIbRuntime(pending, pageUrl, "session-a"), null);
  assert.equal(findAuthorizedIbRuntime({ frame: tree().frame }, pageUrl, "session-a"), null);
});

test("native IB selection rejects foreign Sessions, origins and unpinned resources", () => {
  assert.throws(() => findAuthorizedIbRuntime(tree(), pageUrl, "session-b"), /selected participant Session/u);
  for (const replacement of [
    runtimeUrl.replace("127.0.0.1:4311", "127.0.0.1:9999"),
    runtimeUrl.replace("9.9.0.html", "9.8.0.html"),
    runtimeUrl.replace("capability/", "capability/extra/"),
    runtimeUrl.replace("capability/", ""),
    `${runtimeUrl}?test=1`, `${runtimeUrl}#test`
  ]) {
    const candidate = tree(); candidate.childFrames[0].frame.url = replacement;
    assert.throws(() => findAuthorizedIbRuntime(candidate, pageUrl, "session-a"));
  }
});

test("native IB selection rejects ambiguous, unrelated and non-srcdoc frames", () => {
  const duplicate = tree(); duplicate.childFrames.push(duplicate.childFrames[0]);
  assert.throws(() => findAuthorizedIbRuntime(duplicate, pageUrl, "session-a"), /unambiguous/u);
  const unrelated = tree(); unrelated.childFrames[0].frame.parentId = "different";
  assert.throws(() => findAuthorizedIbRuntime(unrelated, pageUrl, "session-a"), /direct Player child/u);
  const wrongHost = tree(); wrongHost.frame.url = pageUrl;
  assert.throws(() => findAuthorizedIbRuntime(wrongHost, pageUrl, "session-a"), /srcdoc/u);
});

const geometry = () => ({
  host: { x: 210, y: 140, width: 858, height: 446, offsetWidth: 858, offsetHeight: 446, clientLeft: 1, clientTop: 1 },
  inner: { x: 0, y: 0, width: 856, height: 444, clientLeft: 1, clientTop: 1, hit: true },
  target: { x: 40, y: 15, width: 170, height: 25, hit: true, disabled: false, pointer: "auto" },
  viewport: { width: 1280, height: 720 }
});
const point = ({ host, inner, target, viewport }) => ibPointerPoint(host, inner, target, viewport);

test("real pointer coordinates include both iframe borders", () => {
  assert.deepEqual(point(geometry()), { x: 337, y: 169.5 });
});

test("real pointer checks fail closed for covered, disabled or non-pointer controls", () => {
  for (const mutate of [g => { g.inner.hit = false; }, g => { g.target.hit = false; },
    g => { g.target.disabled = true; }, g => { g.target.pointer = "none"; },
    g => { g.target.width = 0; }, g => { g.target.x = NaN; },
    g => { g.host.offsetWidth = 400; }, g => { g.viewport.width = 300; },
    g => { g.target.x = 1000; }]) {
    const g = geometry(); mutate(g); assert.throws(() => point(g));
  }
});

function runtimeFixture({ replaceLoader = false, attachDelay = 0, parentTarget = false } = {}) {
  const session = new EventEmitter(); let detached = 0, treeReads = 0;
  session.detach = async () => { detached += 1; };
  session.send = async method => {
    if (method === "Runtime.enable") {
      for (const [id, frameId] of [[1, "outer"], [2, "runtime"]]) session.emit("Runtime.executionContextCreated",
        { context: { id, uniqueId: `execution-${id}`, auxData: { isDefault: true, frameId } } });
    }
    if (method === "Page.getFrameTree") {
      const frameTree = tree(); if (replaceLoader && treeReads++ > 0) frameTree.childFrames[0].frame.loaderId = "load-b";
      if (!parentTarget) return { frameTree };
      frameTree.frame.parentId = "page";
      return { frameTree: { frame: { id: "page", url: pageUrl }, childFrames: [frameTree] } };
    }
    if (method === "DOM.getDocument") return { root: { nodeId: 1 } };
    if (method === "DOM.querySelector") return { nodeId: 2 };
    if (method === "DOM.describeNode") return { node: { localName: "iframe", frameId: "outer" } };
    if (method === "Runtime.evaluate") throw new Error("This rejected fixture must never evaluate a DOM.");
    return {};
  };
  const element = { contentFrame: async () => ({}), evaluate: async () => true, dispose: async () => {} };
  const host = { waitFor: async () => {}, count: async () => 1, scrollIntoViewIfNeeded: async () => {},
    getAttribute: async () => "allow-scripts allow-forms", elementHandle: async () => element };
  const page = { bringToFront: async () => {}, locator: () => host, url: () => pageUrl };
  const attachments = [];
  const context = { newCDPSession: async target => {
    attachments.push(target);
    if (attachDelay) await new Promise(resolve => setTimeout(resolve, attachDelay));
    if (parentTarget && target !== page) throw new Error("This frame does not have a separate CDP session, it is a part of the parent frame's session");
    return session;
  } };
  return { page, context, host, element, session, attachments, detached: () => detached };
}

test("a shared-target runtime uses only the current page target and retains all native identity checks", async () => {
  for (const participantSessionId of ["session-a", "session-b"]) {
    const fixture = runtimeFixture({ parentTarget: true }); const originalSend = fixture.session.send;
    let verified = false;
    fixture.session.send = async (method, params) => {
      if (method !== "Runtime.evaluate") return originalSend(method, params);
      const value = params.expression === "globalThis.origin" ? "null" :
        params.expression === "location.href" ? runtimeUrl :
        params.expression === "document.readyState" ? "complete" : true;
      return { result: { value } };
    };
    const verify = withChromiumIbRuntime(fixture.context, fixture.page, participantSessionId, async runtime => {
      assert.deepEqual(runtime.identity, { frameId: "runtime", loaderId: "load-a" }); verified = true;
    });
    if (participantSessionId === "session-a") await verify;
    else await assert.rejects(verify, /selected participant Session/u);
    assert.equal(verified, participantSessionId === "session-a");
    assert.equal(fixture.attachments.length, 2);
    assert.equal(fixture.attachments[1], fixture.page); assert.equal(fixture.detached(), 1);
  }
});

test("shared-target attachment rejects a missing native owner and never masks other attachment failures", async () => {
  const missing = runtimeFixture({ parentTarget: true }); const originalSend = missing.session.send;
  missing.session.send = async (method, params) => method === "DOM.describeNode" ?
    { node: { localName: "iframe" } } : originalSend(method, params);
  await assert.rejects(withChromiumIbRuntime(missing.context, missing.page, "session-a", async () => {
    assert.fail("An unbound owner cannot be verified.");
  }), /exact frame identity/u);
  assert.equal(missing.detached(), 1);
  const failed = runtimeFixture(); let attachments = 0;
  failed.context.newCDPSession = async () => { attachments += 1; throw new Error("Target closed"); };
  await assert.rejects(withChromiumIbRuntime(failed.context, failed.page, "session-a", async () => {}), /Target closed/u);
  assert.equal(attachments, 1); assert.equal(failed.detached(), 0);
});

test("an expired per-frame attachment cannot start a later shared-target attachment", async () => {
  const fixture = runtimeFixture({ parentTarget: true, attachDelay: 100 });
  await assert.rejects(withChromiumIbRuntime(fixture.context, fixture.page, "session-a", async () => {}, 50), /deadline expired/u);
  await new Promise(resolve => setTimeout(resolve, 120));
  assert.equal(fixture.attachments.length, 1); assert.equal(fixture.detached(), 0);
});

test("native runtime rejection detaches and cannot invoke the verification callback", async () => {
  for (const [participantSessionId, options, message] of [
    ["session-b", {}, /selected participant Session/u],
    ["session-a", { replaceLoader: true }, /stale or replaced/u]
  ]) {
    const fixture = runtimeFixture(options); let verified = false;
    await assert.rejects(withChromiumIbRuntime(fixture.context, fixture.page, participantSessionId,
      async () => { verified = true; }), message);
    assert.equal(verified, false); assert.equal(fixture.detached(), 1);
  }
});

test("native runtime refuses a same-origin sandbox before attachment", async () => {
  const fixture = runtimeFixture(); fixture.host.getAttribute = async () => "allow-scripts allow-same-origin";
  await assert.rejects(withChromiumIbRuntime(fixture.context, fixture.page, "session-a", async () => {}), /opaque-origin/u);
  assert.equal(fixture.detached(), 0);
});

test("native runtime rejects a detached Player before reading or interacting", async () => {
  const fixture = runtimeFixture(); fixture.element.evaluate = async () => false;
  await assert.rejects(withChromiumIbRuntime(fixture.context, fixture.page, "session-a", async () => {}), /still be connected/u);
  assert.equal(fixture.detached(), 1);
});

test("late native attachment is detached after a bounded timeout", async () => {
  const fixture = runtimeFixture({ attachDelay: 100 }); let verified = false;
  await assert.rejects(withChromiumIbRuntime(fixture.context, fixture.page, "session-a",
    async () => { verified = true; }, 50), /deadline expired/u);
  await new Promise(resolve => setTimeout(resolve, 120));
  assert.equal(verified, false); assert.equal(fixture.detached(), 1);
});

test("a genuine resource reload invalidates the old native driver before further DOM reads", async () => {
  const fixture = runtimeFixture(); let reloaded = false;
  const originalSend = fixture.session.send;
  fixture.session.send = async (method, params) => {
    if (method === "Page.getFrameTree") {
      const frameTree = tree();
      if (reloaded) frameTree.childFrames[0].frame.loaderId = "new-load";
      return { frameTree };
    }
    if (method !== "Runtime.evaluate") return originalSend(method, params);
    if (params.expression.includes("setTimeout(() => location.reload()")) {
      reloaded = true;
      for (const [type, url, contentType] of [
        ["Document", runtimeUrl, "text/html; charset=utf-8"],
        ["Script", new URL("9.9.0/main.220e1b93.js", runtimeUrl).href, "text/javascript; charset=utf-8"]
      ]) {
        fixture.session.emit("Network.responseReceived", { type, requestId: type,
          frameId: "runtime", loaderId: "new-load", response: { url, status: 200, headers: { "Content-Type": contentType } } });
        fixture.session.emit("Network.loadingFinished", { requestId: type });
      }
    }
    const value = params.expression === "globalThis.origin" ? "null" :
      params.expression === "location.href" ? runtimeUrl :
      params.expression === "document.readyState" ? "complete" : true;
    return { result: { value } };
  };
  const newLoader = await withChromiumIbRuntime(fixture.context, fixture.page, "session-a", async runtime => {
    assert.deepEqual(runtime.identity, { frameId: "runtime", loaderId: "load-a" });
    assert.ok(Object.isFrozen(runtime.identity));
    const resources = await runtime.reloadResources();
    assert.equal(resources.script.loaderId, "new-load");
    await assert.rejects(runtime.evaluate("document.title"), /stale or replaced/u);
    return resources.script.loaderId;
  });
  assert.equal(newLoader, "new-load");
  assert.equal(reloaded, true); assert.equal(fixture.detached(), 1);
  assert.equal(fixture.session.listenerCount("Network.responseReceived"), 0);
});

test("native runtime waits for the real document parser but still rejects a missing parsed adapter", async () => {
  for (const adapterPresent of [false, true]) {
    const fixture = runtimeFixture(); const originalSend = fixture.session.send;
    let readinessReads = 0, adapterReads = 0, verified = false;
    fixture.session.send = async (method, params) => {
      if (method !== "Runtime.evaluate") return originalSend(method, params);
      let value = true;
      if (params.expression === "globalThis.origin") value = "null";
      if (params.expression === "location.href") value = runtimeUrl;
      if (params.expression === "document.readyState") value = ++readinessReads < 3 ? "loading" : "interactive";
      if (params.expression.includes("dipf-opaque-parent-origin")) {
        assert.equal(readinessReads, 3); adapterReads += 1; value = adapterPresent;
      }
      return { result: { value } };
    };
    const verify = withChromiumIbRuntime(fixture.context, fixture.page, "session-a", async () => { verified = true; });
    if (adapterPresent) await verify;
    else await assert.rejects(verify, /parsed authorized runtime must include/u);
    assert.equal(verified, adapterPresent); assert.equal(adapterReads, 1); assert.equal(fixture.detached(), 1);
  }
});
