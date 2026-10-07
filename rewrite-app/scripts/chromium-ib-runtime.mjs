import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";

const runtimeSuffix = "/IB_SAMPLE_2025/runtimes/ib-runtime.9.9.0.html";

// Chrome can commit an opaque srcdoc and its nested document before Playwright
// attaches renderer listeners. Use public CDP reads, not patched test-library
// internals, and keep all actual input on the browser's mouse/keyboard path.
export function findAuthorizedIbRuntime(frameTree, pageUrl, participantSessionId) {
  if (frameTree.frame.url === "about:blank") return null;
  assert.equal(frameTree.frame.url, "about:srcdoc", "The Player must remain srcdoc-hosted.");
  const children = (frameTree.childFrames || []).filter(
    child => child.frame.name === "ib-runtime-host"
  );
  assert.ok(children.length <= 1, "The runtime frame identity must be unambiguous.");
  if (!children.length || !children[0].frame.url || children[0].frame.url === "about:blank") return null;
  const frame = children[0].frame;
  assert.equal(frame.parentId, frameTree.frame.id, "The runtime must be a direct Player child.");
  const url = new URL(frame.url);
  assert.equal(url.origin, new URL(pageUrl).origin, "The runtime must use the current API origin.");
  const prefix = `/api/v1/participant/sessions/${encodeURIComponent(participantSessionId)}/resources/.access/`;
  assert.ok(url.pathname.startsWith(prefix), "The runtime must belong to the selected participant Session.");
  assert.ok(url.pathname.endsWith(runtimeSuffix), "The exact pinned ItemBuilder runtime is required.");
  const capability = url.pathname.slice(prefix.length, -runtimeSuffix.length);
  assert.ok(capability && !capability.includes("/"), "Exactly one resource capability is required.");
  assert.equal(url.search, "", "Unexpected runtime query parameters are forbidden.");
  assert.equal(url.hash, "", "Unexpected runtime fragments are forbidden.");
  return frame;
}

export function ibPointerPoint(host, inner, target, viewport) {
  for (const rect of [host, inner, target]) {
    assert.ok(rect && [rect.x, rect.y, rect.width, rect.height].every(Number.isFinite),
      "Pointer geometry must be finite.");
    assert.ok(rect.width > 0 && rect.height > 0, "Every pointer surface must have visible dimensions.");
  }
  assert.ok(Math.abs(host.width - host.offsetWidth) < 1 &&
    Math.abs(host.height - host.offsetHeight) < 1, "Transformed fixture geometry is unsupported.");
  assert.equal(inner.hit, true, "The nested runtime must not be covered inside its Player.");
  assert.equal(target.hit, true, "The input must not be covered inside its runtime.");
  assert.equal(target.disabled, false, "The input must be enabled.");
  assert.equal(target.pointer, "auto", "The input must accept pointer events.");
  const x = host.x + host.clientLeft + inner.x + inner.clientLeft + target.x + target.width / 2;
  const y = host.y + host.clientTop + inner.y + inner.clientTop + target.y + target.height / 2;
  assert.ok(x > 0 && y > 0 && x < viewport.width && y < viewport.height,
    "The actual input point must be inside the browser viewport.");
  assert.ok(x > host.x && y > host.y && x < host.x + host.width && y < host.y + host.height,
    "The actual input point must be inside the visible Player.");
  return { x, y };
}

export async function withChromiumIbRuntime(context, page, participantSessionId, verify, timeoutMs = 60_000) {
  assert.ok(participantSessionId, "A selected participant Session is required.");
  assert.ok(Number.isFinite(timeoutMs) && timeoutMs > 0, "A bounded runtime deadline is required.");
  const deadline = Date.now() + timeoutMs;
  let session;
  let element;
  let disposed = false;
  const bounded = async operation => {
    const remaining = deadline - Date.now();
    assert.ok(!disposed && remaining > 0, "The native runtime deadline expired.");
    let timer;
    try {
      return await Promise.race([operation(), new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("The native runtime deadline expired.")), remaining);
      })]);
    } finally { clearTimeout(timer); }
  };
  const send = (method, params) => bounded(() => session.send(method, params));
  try {
    await bounded(() => page.bringToFront());
    const host = page.locator("#participantVeronaPlayerFrame");
    await bounded(() => host.waitFor({ state: "visible", timeout: timeoutMs }));
    assert.equal(await bounded(() => host.count()), 1, "Exactly one active Player is required.");
    await bounded(() => host.scrollIntoViewIfNeeded());
    const sandbox = (await bounded(() => host.getAttribute("sandbox")))?.split(/\s+/u) || [];
    assert.ok(sandbox.includes("allow-scripts"), "The actual Player script sandbox is required.");
    assert.equal(sandbox.includes("allow-same-origin"), false, "The opaque-origin sandbox must remain intact.");
    element = await bounded(() => host.elementHandle());
    const outer = await bounded(() => element.contentFrame());
    assert.ok(outer, "The active Player must own an actual browser frame.");
    await bounded(async () => {
      const attached = await context.newCDPSession(outer);
      if (disposed || Date.now() >= deadline) { await attached.detach(); return; }
      session = attached;
    });
    assert.ok(session, "The active Player CDP attachment must complete before its deadline.");
    const executions = new Map();
    session.on("Runtime.executionContextCreated", ({ context: execution }) => executions.set(execution.id, execution));
    session.on("Runtime.executionContextDestroyed", ({ executionContextId }) => executions.delete(executionContextId));
    session.on("Runtime.executionContextsCleared", () => executions.clear());
    await send("Page.enable");
    await send("Runtime.enable");
    let runtime, execution, outerExecution;
    while (Date.now() < deadline) {
      const { frameTree } = await send("Page.getFrameTree");
      runtime = findAuthorizedIbRuntime(frameTree, page.url(), participantSessionId);
      if (runtime) {
        execution = [...executions.values()].find(item => item.auxData?.isDefault && item.auxData.frameId === runtime.id);
        outerExecution = [...executions.values()].find(item => item.auxData?.isDefault && item.auxData.frameId === frameTree.frame.id);
        if (execution && outerExecution) break;
      }
      await bounded(() => delay(100));
    }
    assert.ok(runtime && execution?.uniqueId && outerExecution?.uniqueId,
      "The exact authorized runtime and both native execution contexts must load.");
    const evaluate = async (expression, selected = execution) => {
      const { frameTree } = await send("Page.getFrameTree");
      const current = findAuthorizedIbRuntime(frameTree, page.url(), participantSessionId);
      assert.ok(current?.id === runtime.id && current.loaderId === runtime.loaderId,
        "A stale or replaced runtime cannot receive assertions or mouse input.");
      assert.equal(executions.get(selected.id)?.uniqueId, selected.uniqueId,
        "The original execution context must still exist.");
      assert.equal(await bounded(() => element.evaluate(node => node.isConnected)), true,
        "The originally selected Player element must still be connected.");
      const result = await send("Runtime.evaluate", { uniqueContextId: selected.uniqueId,
        returnByValue: true, expression });
      assert.equal(result.exceptionDetails, undefined, "The native DOM read must succeed.");
      return result.result.value;
    };
    assert.equal(await evaluate("globalThis.origin"), "null");
    assert.equal(await evaluate("globalThis.origin", outerExecution), "null");
    assert.ok(await evaluate("location.href") === runtime.url, "The exact authorized runtime document is required.");
    assert.equal(await evaluate(`!!document.querySelector('script[data-testcenter-compatibility="dipf-opaque-parent-origin"]')`), true);
    const proofKey = `__testcenterIbInputProof_${Date.now()}`;
    await evaluate(`(() => {const key=${JSON.stringify(proofKey)};window[key]=[];
      for(const type of ['click','input','change'])document.addEventListener(type,event=>{
        window[key].push({type,trusted:event.isTrusted,target:event.target.tagName,inputType:event.target.type});
        if(window[key].length>64)window[key].shift();},true);return true;})()`);
    const waitVisible = async selector => {
      while (Date.now() < deadline) {
        const visible = await evaluate(`(() => {const elements=[...document.querySelectorAll(${JSON.stringify(selector)})];
          return elements.length>0 && elements.every(element=>{const r=element.getBoundingClientRect(),s=getComputedStyle(element);
            return s.visibility==='visible' && s.display!=='none' && Number(s.opacity)>0 && r.width>0 && r.height>0 &&
              r.x<innerWidth && r.y<innerHeight && r.right>0 && r.bottom>0;});})()`);
        if (visible) return;
        await bounded(() => delay(100));
      }
      throw new Error("Visible native runtime controls did not appear.");
    };
    const click = async selector => {
      await waitVisible(selector);
      const target = await evaluate(`(() => {const elements=[...document.querySelectorAll(${JSON.stringify(selector)})];
        if(elements.length!==1)return null;const e=elements[0],r=e.getBoundingClientRect(),hit=document.elementFromPoint(r.x+r.width/2,r.y+r.height/2);
        return {...r.toJSON(),disabled:!!e.disabled,pointer:getComputedStyle(e).pointerEvents,hit:hit===e||e.contains(hit)};})()`);
      assert.ok(target, "The mouse target must be unique.");
      const inner = await evaluate(`(() => {const e=document.querySelector('#ib-runtime-host'),r=e.getBoundingClientRect();
        const hit=document.elementFromPoint(r.x+e.clientLeft+${target.x + target.width / 2},r.y+e.clientTop+${target.y + target.height / 2});
        return {...r.toJSON(),clientLeft:e.clientLeft,clientTop:e.clientTop,hit:hit===e};})()`, outerExecution);
      const geometry = await bounded(() => host.evaluate(element => ({ ...element.getBoundingClientRect().toJSON(),
        clientLeft: element.clientLeft, clientTop: element.clientTop, offsetWidth: element.offsetWidth, offsetHeight: element.offsetHeight })));
      const viewport = await bounded(() => page.evaluate(() => ({ width: innerWidth, height: innerHeight })));
      const point = ibPointerPoint(geometry, inner, target, viewport);
      assert.equal(await bounded(() => page.evaluate(({ x, y }) => document.elementFromPoint(x, y)?.id, point)),
        "participantVeronaPlayerFrame", "The Player must not be covered at the input point.");
      await bounded(() => page.mouse.click(point.x, point.y));
    };
    await bounded(() => verify({ evaluate, waitVisible, click,
      inputEvents: () => evaluate(`window[${JSON.stringify(proofKey)}]`) }));
  } finally {
    disposed = true;
    await session?.detach().catch(() => undefined);
    await element?.dispose().catch(() => undefined);
  }
}
