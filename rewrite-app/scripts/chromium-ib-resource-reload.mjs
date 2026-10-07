import assert from "node:assert/strict";

// Observe an actual reload of the already authorized native runtime. Starting
// after its first commit avoids missing an opaque OOPIF's initial Network
// events. No request is fetched, intercepted, fulfilled or injected here.
export async function reloadChromiumIbResources(session, runtime, reload, timeoutMs = 30_000) {
  assert.ok(runtime?.id && runtime.loaderId && runtime.url, "A bound runtime and loader are required.");
  assert.ok(Number.isFinite(timeoutMs) && timeoutMs > 0, "A bounded resource deadline is required.");
  const documentUrl = new URL(runtime.url);
  assert.ok(documentUrl.pathname.endsWith("/IB_SAMPLE_2025/runtimes/ib-runtime.9.9.0.html"),
    "The exact pinned runtime document is required.");
  const specs = new Map([
    [documentUrl.href, { key: "document", type: "Document", contentType: "text/html; charset=utf-8" }],
    [new URL("9.9.0/main.220e1b93.js", documentUrl).href,
      { key: "script", type: "Script", contentType: "text/javascript; charset=utf-8" }]
  ]);
  const deadline = Date.now() + timeoutMs;
  const requests = new Map(), complete = new Map();
  let disposed = false, newLoader;
  let resolveResources, rejectResources;
  const resources = new Promise((resolve, reject) => {
    resolveResources = resolve; rejectResources = reject;
  });
  // A failed response can arrive while the reload command is still finishing.
  // Keep the rejection handled until the bounded operation awaits it below.
  resources.catch(() => undefined);
  const bounded = async operation => {
    assert.ok(!disposed && deadline > Date.now(), "The browser resource deadline expired.");
    let timer;
    try {
      return await Promise.race([Promise.resolve().then(operation), new Promise((_, reject) => {
        timer = setTimeout(() => reject(new Error("The browser resource deadline expired.")), deadline - Date.now());
      })]);
    } finally { clearTimeout(timer); }
  };
  const onResponse = event => {
    if (disposed || event.frameId !== runtime.id || event.loaderId === runtime.loaderId) return;
    const spec = specs.get(event.response?.url);
    if (!spec) return;
    try {
      assert.ok(event.loaderId && event.requestId, "The browser response must identify its load and request.");
      assert.equal(event.type, spec.type, "The browser must load the correct resource type.");
      assert.equal(event.response.status, 200, "The actual runtime browser download must return HTTP 200.");
      newLoader ??= event.loaderId;
      assert.equal(event.loaderId, newLoader, "Both resources must belong to the same new runtime load.");
      assert.ok(requests.size < 16, "The resource observation must remain bounded.");
      const headers = Object.create(null);
      for (const [name, value] of Object.entries(event.response.headers || {})) {
        const key = name.toLowerCase();
        assert.ok(!(key in headers), "Ambiguous browser response headers are forbidden.");
        headers[key] = value;
      }
      assert.equal(headers["content-type"], spec.contentType, "The actual browser content type must match.");
      assert.equal(headers["x-frame-options"], undefined, "The participant runtime must not be frame-blocked.");
      requests.set(event.requestId, Object.freeze({ key: spec.key, requestId: event.requestId,
        frameId: event.frameId, loaderId: event.loaderId, url: event.response.url,
        status: event.response.status, type: event.type, headers: Object.freeze(headers),
        fromDiskCache: event.response.fromDiskCache === true,
        fromServiceWorker: event.response.fromServiceWorker === true }));
    } catch (error) { rejectResources(error); }
  };
  const onFinished = ({ requestId }) => {
    if (disposed) return;
    const response = requests.get(requestId);
    if (!response) return;
    complete.set(response.key, response);
    if (complete.size === 2) resolveResources(Object.freeze({
      document: complete.get("document"), script: complete.get("script")
    }));
  };
  const onFailed = ({ requestId }) => {
    if (!disposed && requests.has(requestId)) rejectResources(new Error("The actual runtime browser download failed."));
  };
  session.on("Network.responseReceived", onResponse);
  session.on("Network.loadingFinished", onFinished);
  session.on("Network.loadingFailed", onFailed);
  try {
    await bounded(() => session.send("Network.enable"));
    await bounded(() => reload());
    return await bounded(() => resources);
  } finally {
    disposed = true;
    session.off("Network.responseReceived", onResponse);
    session.off("Network.loadingFinished", onFinished);
    session.off("Network.loadingFailed", onFailed);
  }
}
