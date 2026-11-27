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

for (const [action, expectedPath] of [
  ["sign-out", "/api/v1/admin/auth/sign-out"],
  ["password change", "/api/v1/admin/auth/password"]
]) {
  test(`a delayed administrator ${action} cannot clear the replacement login`, async () => {
    const source = readFileSync(new URL("../apps/web/src/app/admin-password-change.service.ts", import.meta.url), "utf8");
    const {outputText} = ts.transpileModule(source, {
      compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true}
    });
    const reply = deferred();
    const ops = {adminSessionToken: "first-session", adminSessionView: "Current account"};
    const request = async (_label, method, path, _body, options) => {
      assert.equal(method, "POST");
      assert.equal(path, expectedPath);
      assert.equal(options.headers.authorization, "Bearer first-session");
      return reply.promise;
    };
    const unexpectedUpdate = () => assert.fail("A superseded administrator request must leave the live account intact.");
    const modules = {
      "@angular/core": {Injectable: () => target => target, inject: value => value},
      "@testcenter-rewrite-app/contracts": {productionApiRoutes: {admin: {signOut: expectedPath, changeOwnPassword: expectedPath}}},
      "./rewrite-app-shell-feedback.service": {RewriteAppShellFeedbackService: {rememberActivity: unexpectedUpdate}},
      "./rewrite-app-shell-persistence.service": {RewriteAppShellPersistenceService: {persistShellState: unexpectedUpdate}},
      "./rewrite-app-shell-request.service": {RewriteAppShellRequestService: {request}},
      "./rewrite-app-shell.readers": {prettyPrintJson: unexpectedUpdate},
      "./rewrite-app-ui-state.service": {RewriteAppUiStateService: {ops, setAdminSessionToken: unexpectedUpdate}}
    };
    const exports = {};
    new Function("exports", "require", outputText)(exports, name => modules[name]);
    const service = new exports.AdminPasswordChangeService();
    const pending = action === "sign-out" ? service.signOut() : service.changePassword({password: "fixture-replacement"});
    ops.adminSessionToken = "replacement-session";
    reply.resolve({adminSession: {adminSessionId: "revoked-first"}});
    await pending;
    assert.deepEqual(ops, {adminSessionToken: "replacement-session", adminSessionView: "Current account"});
  });
}

test("the native forced password dialog tracks the reactive owner number without rendering a credential", async () => {
  const {parseTemplate, TmplAstIfBlock, TmplAstDeferredBlock, TmplAstForLoopBlock} = await import("@angular/compiler");
  const template = readFileSync(new URL("../apps/web/src/app/app.component.html", import.meta.url), "utf8");
  const {nodes, errors} = parseTemplate(template, "app.component.html");
  assert.equal(errors, null);
  const branch = nodes[0].children
    .find(node => node instanceof TmplAstIfBlock && node.branches[0].expression.source.includes("requiresOriginalWorkspacePasswordFlow"))
    .branches[0];
  const body = branch.children.find(node => node instanceof TmplAstDeferredBlock);
  const keyed = body.children.find(node => node instanceof TmplAstForLoopBlock);
  assert.ok(keyed);
  assert.equal(keyed.expression.source, "[adminSessionOwnerGeneration()]");
  assert.equal(keyed.trackBy.source, keyed.item.name);
  const [flow] = keyed.children;
  assert.equal(flow.name, "app-original-required-password-flow");
  assert.deepEqual(flow.attributes, []);
  assert.deepEqual(flow.inputs, []);
});

test("admin owner generations publish token replacement and restored state without a route or activity change", async () => {
  const {computed, signal} = await import("@angular/core");
  const source = readFileSync(new URL("../apps/web/src/app/rewrite-app-ui-state.service.ts", import.meta.url), "utf8");
  const {outputText} = ts.transpileModule(source, {
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true}
  });
  const exports = {};
  const empty = () => ({});
  const modules = {
    "@angular/core": {Injectable: () => target => target, signal},
    "./rewrite-app-shell.state": {
      createInitialShellOpsState: () => ({adminSessionToken: ""}),
      createInitialShellContentState: empty,
      createInitialShellFeedbackState: empty,
      createInitialShellRuntimeState: empty,
      createInitialShellWorkspaceState: empty
    }
  };
  new Function("exports", "require", outputText)(exports, name => modules[name] ?? {});
  const state = new exports.RewriteAppUiStateService();
  const viewKey = computed(() => [state.adminSessionOwnerGeneration()]);
  assert.deepEqual(viewKey(), [0]);
  state.setAdminSessionToken("fixture-old");
  assert.deepEqual(viewKey(), [1]);
  state.setAdminSessionToken("fixture-new");
  const replacement = viewKey();
  assert.deepEqual(replacement, [2]);
  assert.equal(state.adminSessionActive(), true);
  state.setAdminSessionToken("fixture-new");
  assert.equal(viewKey(), replacement);
  state.ops.adminSessionToken = "fixture-restored";
  state.syncAdminSessionToken();
  assert.deepEqual(viewKey(), [3]);
  state.setAdminSessionToken("");
  assert.deepEqual(viewKey(), [4]);
  assert.equal(state.renderVersion(), 0);
});

test("retiring the native forced password dialog clears the old form before closing and revokes only its own renewal", () => {
  const source = readFileSync(new URL("../apps/web/src/app/original-required-password-flow.component.ts", import.meta.url), "utf8");
  const {outputText} = ts.transpileModule(source, {
    compilerOptions: {target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, experimentalDecorators: true}
  });
  const ops = {adminSessionToken: "fixture-old"};
  let generation = 1;
  const effects = [];
  const exports = {};
  const modules = {
    "@angular/core": {Component: () => target => target, inject: value => value},
    "./app-shell.facade": {AppShellFacade: {operatorAccountUsername: "Synthetic actor"}},
    "./rewrite-app-ui-state.service": {RewriteAppUiStateService: {ops, adminSessionOwnerGeneration: () => generation}},
    "./original-administration-http": {
      createOriginalAdministrationTransport: () => async (method, path, body, token) => {
        effects.push([method, path, body, token]);
      }
    }
  };
  new Function("exports", "require", outputText)(exports, name => modules[name] ?? {});
  const flow = new exports.OriginalRequiredPasswordFlowComponent();
  assert.equal(flow.current, true);
  // Even if an earlier token is restored before the next render, its previous
  // generation cannot run a dialog callback while Angular schedules teardown.
  generation += 2;
  assert.equal(flow.current, false);
  const previousDialog = Object.create(exports.OriginalRequiredPasswordDialogComponent.prototype);
  previousDialog.form = {reset: () => effects.push("Cleared form")};
  flow.dialog = {componentInstance: previousDialog, close: () => effects.push("Closed dialog")};
  flow.renewedToken = "fixture-retired-renewal";
  ops.adminSessionToken = "fixture-replacement";
  flow.ngOnDestroy();
  assert.equal(flow.owner.signal.aborted, true);
  assert.equal(ops.adminSessionToken, "fixture-replacement");
  assert.deepEqual(effects, [
    "Cleared form", "Closed dialog", ["DELETE", "/session", undefined, "fixture-retired-renewal"]
  ]);
});
