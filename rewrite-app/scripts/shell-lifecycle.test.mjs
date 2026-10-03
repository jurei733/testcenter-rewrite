import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import ts from "typescript";

// Exercise the production pure lifecycle module, not a reimplementation.
// Angular's app compilation continues to typecheck it independently.
const source = readFileSync(new URL("../apps/web/src/app/rewrite-app-shell.lifecycle.ts", import.meta.url), "utf8");
const { outputText } = ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
});
const { scheduleShellAutoRefresh, clearShellAutoRefresh, ensureShellDataForView } =
  await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

const flush = () => new Promise(resolve => setImmediate(resolve));
const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((ok, fail) => { resolve = ok; reject = fail; });
  return { promise, resolve, reject };
};
const withTimers = async action => {
  const previousWindow = globalThis.window;
  const timers = new Map();
  let nextId = 1;
  globalThis.window = {
    setInterval: callback => { const id = nextId++; timers.set(id, callback); return id; },
    clearInterval: id => timers.delete(id)
  };
  const host = {
    activeView: "content", workspaceLoaded: false, contentLoaded: false,
    runtimeLoaded: false, diagnosticsLoaded: false, monitorConnectionStatus: "polling",
    autoRefreshEnabled: true, autoRefreshSeconds: 3, autoRefreshHandle: null,
    autoRefreshInFlight: false, foregroundRequestActive: false,
    refreshWorkspaceOverview: async () => {}, refreshContentReads: async () => {},
    refreshRuntimeReads: async () => {}, refreshOperationalDiagnostics: async () => {}
  };
  const tick = () => { assert.equal(timers.size, 1); [...timers.values()][0](); };
  try { await action(host, tick, timers); }
  finally {
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
};

test("shell polling does not overlap slow refreshes, including after timer rescheduling", async () => {
  await withTimers(async (host, tick) => {
    const first = deferred();
    let requests = 0;
    host.refreshContentReads = async quiet => {
      assert.equal(quiet, true);
      requests += 1;
      if (requests === 1) await first.promise;
    };
    scheduleShellAutoRefresh(host);
    tick(); tick(); tick();
    assert.equal(requests, 1);
    assert.equal(host.autoRefreshInFlight, true);
    scheduleShellAutoRefresh(host);
    tick();
    assert.equal(requests, 1, "Rescheduling must not forget an in-flight batch.");
    first.resolve();
    await flush();
    assert.equal(host.autoRefreshInFlight, false);
    tick();
    await flush();
    assert.equal(requests, 2);
  });
});

test("shell polling yields to foreground actions and disabling clears its timer", async () => {
  await withTimers(async (host, tick, timers) => {
    let requests = 0;
    host.refreshContentReads = async () => { requests += 1; };
    host.foregroundRequestActive = true;
    scheduleShellAutoRefresh(host);
    tick();
    await flush();
    assert.equal(requests, 0);
    host.foregroundRequestActive = false;
    tick();
    await flush();
    assert.equal(requests, 1);
    host.autoRefreshEnabled = false;
    scheduleShellAutoRefresh(host);
    assert.equal(timers.size, 0);
    assert.equal(host.autoRefreshHandle, null);
    clearShellAutoRefresh(host);
  });
});

test("shell polling recovers after rejection and follows the current route", async () => {
  await withTimers(async (host, tick) => {
    let contentCalls = 0;
    let runtimeCalls = 0;
    host.refreshContentReads = async () => { contentCalls += 1; throw new Error("offline"); };
    host.refreshRuntimeReads = async () => { runtimeCalls += 1; };
    scheduleShellAutoRefresh(host);
    tick();
    await flush();
    assert.equal(host.autoRefreshInFlight, false);
    tick();
    await flush();
    assert.equal(contentCalls, 2);
    host.activeView = "runtime";
    host.monitorConnectionStatus = "live";
    tick(); await flush();
    assert.equal(runtimeCalls, 0);
    host.monitorConnectionStatus = "polling";
    tick(); await flush();
    assert.equal(runtimeCalls, 1);
    for (const view of ["participant", "system-check", "home"]) {
      host.activeView = view;
      tick(); await flush();
    }
    assert.equal(contentCalls, 2);
    assert.equal(runtimeCalls, 1);
    host.activeView = "content";
    await ensureShellDataForView(host, "content");
    assert.equal(contentCalls, 3, "Explicit first loading is not suppressed by polling rules.");
  });
});
