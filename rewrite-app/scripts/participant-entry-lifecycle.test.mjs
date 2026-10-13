import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { productionApiRoutes, resolveRoutePath } from "@testcenter-rewrite-app/contracts";

// Execute the production entry method, not a copied decision algorithm.
// Angular initialization and HTTP/rendering are supplied by the test host;
// the real built UI is verified separately by the mandatory browser gate.
const source = readFileSync(new URL("../apps/web/src/app/participant-view.facade.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("participant-view.facade.ts", source, ts.ScriptTarget.ES2022, true);
const declaration = ast.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "ParticipantViewFacade");
const methodNames = ["pendingControllerStatus","resumeEntrySessionInternal", "replaceSelectedRunEntryLink", "reloadPage", "reloadAfterControllerError",
  "starterLaunchInternal", "resumeSessionInternal", "readCurrentRunState", "hasControllerError", "controllerError"];
const methods = methodNames.map(name => {
  const method = declaration?.members.find(node => (ts.isMethodDeclaration(node) || ts.isGetAccessor(node)) && node.name.getText(ast) === name);
  assert.ok(method, `The production ${name} method must exist.`);
  return method.getText(ast);
});
const { outputText } = ts.transpileModule(`export const createEntryHost = (productionApiRoutes, resolveRoutePath, prettyPrintJson) => class EntryHost { controllerTimerInterruption=Object.assign(()=>null,{set(){}}); controllerCommandPhase=Object.assign(()=>null,{set(){}}); ${methods.join("\n")} };`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
});
const { createEntryHost } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const EntryHost = createEntryHost(productionApiRoutes, resolveRoutePath, value => JSON.stringify(value));

const parameters = testRunId => ({ bookletKey: "BOOKLET#level:beginner", testRunId });
const state = (mode, overrides = {}) => ({
  executionMode: { mode, saveResponses: !["run-demo", "run-review", "run-simulation"].includes(mode) },
  testRun: { participantSessionId: "own-session", testRunId: "selected/A", bookletKey: "BOOKLET", bookletAssignmentKey: "BOOKLET#level:advanced",
    status: "running", locked: false, currentUnitKey: "active-unit", ...overrides }
});
const host = currentState => {
  const entry = new EntryHost();
  entry.viewLifecycleSequence = 1;
  entry.runtime = { participantSessionId: "own-session", testRunId: "selected/A", bookletKey: "stale-browser-assignment" };
  entry.currentRunState = null;
  const calls = { resumed: 0, applied: 0, refreshed: 0 };
  entry.refreshCurrentStateInternal = async quiet => {
    assert.equal(quiet, true);
    calls.refreshed++;
    entry.currentRunState = currentState;
    if (currentState) {
      // The actual refresh synchronizes the server-authorized selection.
      entry.runtime.testRunId = currentState.testRun.testRunId;
      entry.runtime.bookletKey = currentState.testRun.bookletAssignmentKey;
    }
  };
  entry.resumeSessionInternal = async options => {
    assert.deepEqual(options, { quiet: true });
    if (currentState) {
      assert.equal(entry.runtime.testRunId, currentState.testRun.testRunId);
      assert.equal(entry.runtime.bookletKey, currentState.testRun.bookletAssignmentKey);
    }
    calls.resumed++;
  };
  entry.applyEntryDraftAfterResume = async () => { calls.applied++; };
  entry.isParticipantSessionNoLongerResumable = () => false;
  return { entry, calls };
};

for (const mode of ["run-demo", "run-review", "run-simulation"]) {
  for (const testRunId of ["selected/A", ""]) {
    test(`${mode}: ${testRunId ? "run-bound" : "legacy session-only"} re-entry resets through the authorized resume use case`, async () => {
      const { entry, calls } = host(state(mode));
      await entry.resumeEntrySessionInternal(parameters(testRunId));
      assert.equal(calls.resumed, 1, "Non-saving re-entry must reset transient navigation and timers.");
      assert.equal(calls.applied, 1);
    });
  }
}

for (const status of ["running", "paused", "completed"]) {
  test(`saving re-entry reads ${status} without resuming, resetting or changing its exact assignment`, async () => {
    const currentState = state("run-hot-return", { status, pauseSource: status === "paused" ? "monitor" : undefined });
    const { entry, calls } = host(currentState);
    await entry.resumeEntrySessionInternal(parameters("selected/A"));
    assert.equal(calls.resumed, 0);
    assert.equal(entry.currentRunState, currentState);
    assert.equal(entry.runtime.bookletKey, currentState.testRun.bookletAssignmentKey);
  });
}

for (const mode of ["run-hot-return", "run-demo", "run-review", "run-simulation"]) {
  for (const hasRun of [false, true]) {
    test(`${mode}: native Starter entry reads its authorized roster without starting or resetting a Run (${hasRun ? "existing" : "none"})`, async () => {
      const { entry, calls } = host(hasRun ? state(mode) : null);
      const presentation = { stopped: 0, invalidated: 0, synchronized: 0, persisted: 0, assets: "old" };
      const roster = { participantSession: { participantSessionId: "own-session" }, participantRosterEntry: { displayName: "Own person" },
        scope: {tenantKey:"own-tenant",workspaceKey:"own-workspace"}, booklets:[{bookletKey:"own-assignment"}] };
      const requests = [];
      entry.runtime.participantSessionId = "own-session"; entry.workspace = {};
      entry.requestState = { request: async (...args) => { requests.push(args); return { runtimeState: roster }; } };
      entry.syncParticipantSessionFields = value => assert.equal(value, roster.participantSession);
      entry.syncParticipantRosterEntry = value => assert.equal(value, roster.participantRosterEntry);
      entry.syncRuntimeBooklets = value => assert.equal(value, roster.booklets);
      entry.participantEvents = { stop() { presentation.stopped++; } };
      entry.invalidateCurrentStateRefreshes = () => { presentation.invalidated++; };
      entry.loadedBookletAssets = { set(value) { presentation.assets = value; } };
      entry.activeControllerError = { set(value) { assert.equal(value, null); } };
      entry.syncParticipantHeaderVisibility = () => { presentation.synchronized++; };
      entry.persistState = () => { presentation.persisted++; };
      entry.runtime.currentUnitKey = "previous-unit";
      entry.runtime.currentUnitResponse = "previous-view";
      entry.runtime.currentRunStateView = JSON.stringify({ currentRunState: state(mode) });
      await entry.resumeEntrySessionInternal({ ...parameters(""), openStarter: true });
      assert.deepEqual(calls, { resumed: 0, applied: 0, refreshed: 0 });
      assert.deepEqual(requests, [["Participant Starter", "GET", "/api/v1/participant/sessions/own-session/runtime-state", undefined, {quiet:true}]]);
      assert.deepEqual(entry.workspace, roster.scope);
      assert.equal(entry.currentRunState, null);
      assert.equal(entry.runtime.testRunId, ""); assert.equal(entry.runtime.currentUnitKey, ""); assert.equal(entry.runtime.currentUnitResponse, "");
      assert.deepEqual(presentation, { stopped: 1, invalidated: 1, synchronized: 1, persisted: 1, assets: null });
      assert.equal(entry.readCurrentRunState(), null, "The render cache must not resurrect the Run in Starter presentation.");
    });
  }
}

test("a denied or stale native Starter read cannot clear another view or start a sibling Run", async () => {
  for (const stale of [false, true]) {
    const { entry, calls } = host(state("run-hot-return"));
    entry.runtime.participantSessionId = "own-session";
    const denied = new Error("participant_session_access_required");
    entry.requestState = { request: async () => {
      if (stale) { entry.viewLifecycleSequence++; return {}; }
      throw denied;
    } };
    const action = entry.resumeEntrySessionInternal({ ...parameters(""), openStarter: true });
    if (stale) await action;
    else await assert.rejects(action, error => error === denied);
    assert.deepEqual(calls, { resumed: 0, applied: 0, refreshed: 0 });
    assert.equal(entry.runtime.testRunId, "selected/A");
  }
});

for (const protectedState of [{ status: "completed" }, { locked: true }, { status: "paused", pauseSource: "monitor" }]) {
  test(`non-saving re-entry respects ${JSON.stringify(protectedState)} instead of resetting it`, async () => {
    const currentState = state("run-simulation", protectedState);
    const { entry, calls } = host(currentState);
    await entry.resumeEntrySessionInternal(parameters("selected/A"));
    assert.equal(calls.resumed, 0);
    assert.equal(entry.currentRunState, currentState);
  });
}

test("a session with no current Run still starts through the regular authorized resume use case", async () => {
  const { entry, calls } = host(null);
  await entry.resumeEntrySessionInternal(parameters(""));
  assert.equal(calls.resumed, 1);
  assert.equal(entry.runtime.bookletKey, "BOOKLET#level:beginner");
});

test("a late current-state read cannot reset or apply an entry draft after leaving the view", async () => {
  const { entry, calls } = host(state("run-simulation"));
  const refresh = entry.refreshCurrentStateInternal;
  entry.refreshCurrentStateInternal = async quiet => { await refresh(quiet); entry.viewLifecycleSequence++; };
  await entry.resumeEntrySessionInternal(parameters("selected/A"));
  assert.equal(calls.resumed, 0);
  assert.equal(calls.applied, 0);
});

test("a denied explicit Run read never falls back to starting or resetting a sibling", async () => {
  const { entry, calls } = host(state("run-simulation"));
  const denied = new Error("test_run_not_found");
  entry.refreshCurrentStateInternal = async () => { throw denied; };
  await assert.rejects(entry.resumeEntrySessionInternal(parameters("another-participant/run")), error => error === denied);
  assert.equal(calls.resumed, 0);
  assert.equal(calls.applied, 0);
});

const withRouter = async (ui, action) => {
  const previousWindow = globalThis.window;
  let resolveNavigation, rejectNavigation;
  const navigation = new Promise((done, fail) => { resolveNavigation = done; rejectNavigation = fail; });
  const calls = { nativeWrites: 0, reloads: 0, persisted: 0, settled: 0, routed: [], actions: [] };
  const link = "https://owned.example/participant?participantSessionId=session%2F%C3%A4&testRunId=run%2FA&bookletKey=BOOKLET%23level%3Aadvanced";
  globalThis.window = {
    location: { origin: "https://owned.example", search: `?ui=${ui ?? ""}&password=must-not-persist&unknown=ignored`, reload() { calls.reloads++; } },
    history: { replaceState() { calls.nativeWrites++; } }
  };
  const entry = new EntryHost();
  entry.createParticipantSessionEntryLink = () => link;
  entry.router = { url: "/participant?old=1", parseUrl: url => url, serializeUrl: url => url,
    navigateByUrl(url, options) { calls.routed.push({ url, options }); return navigation; } };
  entry.viewState = { onActionAsync(fn) { calls.actions.push(fn()); } };
  entry.persistState = () => { calls.persisted++; };
  entry.showReloadButton = true;
  entry.viewLifecycleSequence = 1;
  entry.runtime = {participantSessionId:"session/ä",testRunId:"run/A"};
  entry.currentRunState = {testRun:{participantSessionId:"session/ä",testRunId:"run/A",status:"running"},currentUnit:{unitKey:"active-unit"}};
  entry.activeControllerError = () => error;
  const error = {testRunId:"run/A",unitKey:"active-unit",message:"Owned error"};
  entry.settleVeronaAutoSaveBeforeForegroundAction = async () => { calls.settled++; };
  try { await action({ entry, calls, resolveNavigation, rejectNavigation }); }
  finally {
    resolveNavigation(true);
    if (previousWindow === undefined) delete globalThis.window;
    else globalThis.window = previousWindow;
  }
};

for (const ui of ["original", "rewrite", null, "unknown"]) {
  test(`Run-bound URL synchronization uses Router replacement with only allowed interface selection: ${ui}`, async () => {
    await withRouter(ui, async ({ entry, calls, resolveNavigation }) => {
      const result = entry.replaceSelectedRunEntryLink();
      assert.equal(calls.nativeWrites, 0, "Native history must not diverge from Router state.");
      assert.equal(calls.routed.length, 1);
      assert.deepEqual(calls.routed[0].options, { replaceUrl: true });
      const target = new URL(calls.routed[0].url, "https://owned.example");
      assert.equal(target.pathname, "/participant", "Router applies the configured /app/ base itself.");
      assert.deepEqual(Object.fromEntries(target.searchParams), {
        participantSessionId: "session/ä", testRunId: "run/A", bookletKey: "BOOKLET#level:advanced",
        ...(["original", "rewrite"].includes(ui) ? { ui } : {})
      });
      resolveNavigation(true);
      await result;
    });
  });
}

test("a terminated controller synchronizes the starter address before reload; a resumed controller clears it", async () => {
  for (const starter of [true, false]) await withRouter("original", async ({ entry, calls, resolveNavigation }) => {
    entry.isParticipantStarter = starter;
    entry.createParticipantSessionEntryLink = () => `https://owned.example/participant?participantSessionId=session${starter ? '' : '&testRunId=run'}`;
    const result = entry.replaceSelectedRunEntryLink();
    const target = new URL(calls.routed[0].url, "https://owned.example");
    assert.equal(target.searchParams.get("view"), starter ? "starter" : null);
    assert.equal(target.searchParams.get("testRunId"), starter ? null : "run");
    assert.equal(target.searchParams.get("ui"), "original");
    resolveNavigation(true); await result;
  });
});

for (const method of ["reloadPage", "reloadAfterControllerError"]) {
  test(`${method} waits for the exact Router URL before reloading the page`, async () => {
    await withRouter("original", async ({ entry, calls, resolveNavigation }) => {
      entry[method]();
      await Promise.resolve();
      assert.equal(calls.persisted, 1);
      assert.equal(calls.reloads, 0, "Reloading early could reopen a stale assignment.");
      assert.equal(calls.routed.length, 1);
      resolveNavigation(true);
      await Promise.all(calls.actions);
      assert.equal(calls.reloads, 1);
    });
  });
  test(`${method} retains its availability guard`, async () => {
    await withRouter("original", async ({ entry, calls }) => {
      entry.showReloadButton = false;
      entry.activeControllerError = () => null;
      entry[method]();
      assert.equal(calls.routed.length, 0);
      assert.equal(calls.reloads, 0);
      assert.equal(calls.persisted, 0);
    });
  });
}

test("a failed Router replacement cannot reload into the stale address", async () => {
  await withRouter("original", async ({ entry, calls, rejectNavigation }) => {
    entry.reloadPage();
    assert.equal(calls.actions.length, 1);
    const error = new Error("owned_router_failure");
    rejectNavigation(error);
    await assert.rejects(calls.actions[0], value => value === error);
    assert.equal(calls.reloads, 0);
  });
});

test("an entry without a session link does not invent a Router destination", async () => {
  await withRouter("original", async ({ entry, calls }) => {
    entry.createParticipantSessionEntryLink = () => "";
    await entry.replaceSelectedRunEntryLink();
    assert.equal(calls.routed.length, 0);
    assert.equal(calls.nativeWrites, 0);
  });
});

test("an already synchronized Router URL permits reload without a false cancellation", async () => {
  await withRouter("original", async ({ entry, calls }) => {
    entry.router.url = "/participant?participantSessionId=session%2F%C3%A4&testRunId=run%2FA&bookletKey=BOOKLET%23level%3Aadvanced&ui=original";
    entry.reloadPage();
    await Promise.all(calls.actions);
    assert.equal(calls.routed.length, 0);
    assert.equal(calls.reloads, 1);
  });
});

test("a cancelled Router replacement cannot reload into the old assignment", async () => {
  await withRouter("original", async ({ entry, calls, resolveNavigation }) => {
    entry.reloadPage();
    resolveNavigation(false);
    await assert.rejects(calls.actions[0], /entry URL update was cancelled/u);
    assert.equal(calls.reloads, 0);
  });
});

test("entry synchronization requires a browser and never writes native history without one", async () => {
  await withRouter("original", async ({ entry, calls }) => {
    delete globalThis.window;
    await entry.replaceSelectedRunEntryLink();
    assert.equal(calls.routed.length, 0);
    assert.equal(calls.nativeWrites, 0);
  });
});

const launchHost = () => {
  const entry = new EntryHost();
  entry.viewLifecycleSequence = 1;
  entry.workspace = { tenantKey: "tenant", workspaceKey: "workspace" };
  entry.ephemeralUnitResponses = new Map();
  entry.runtime = { participantSessionId: "session", loginKey: "login", groupKey: "group",
    participantPassword: "", participantCode: "", bookletKey: "BOOKLET#level:advanced", testRunId: "old-run" };
  const payload = { participantSession: { participantSessionId: "session" }, participantRosterEntry: {},
    testRun: { testRunId: "selected-run" }, booklets: [] };
  const calls = { requests: 0, synchronized: 0, refreshed: 0, persisted: 0, routed: 0, challenges: 0 };
  entry.proofOfWork = { protectParticipant: async credentials => credentials };
  entry.requestState = { request: async () => { calls.requests++; return payload; } };
  entry.syncParticipantSessionFields = () => { calls.synchronized++; };
  entry.syncParticipantRosterEntry = () => { calls.synchronized++; };
  entry.syncRun = run => { calls.synchronized++; entry.runtime.testRunId = run.testRunId; };
  entry.syncRuntimeBooklets = () => { calls.synchronized++; };
  entry.persistState = () => { calls.persisted++; };
  entry.refreshCurrentStateInternal = async () => { calls.refreshed++; };
  entry.replaceSelectedRunEntryLink = async () => { calls.routed++; };
  entry.handleParticipantCodeChallenge = () => { calls.challenges++; return true; };
  return { entry, calls, payload };
};

for (const method of ["starterLaunchInternal", "resumeSessionInternal"]) {
  test(`${method} awaits the authorized Run's Router update before loading current-state`, async () => {
    const { entry, calls } = launchHost();
    let finishRoute;
    let enterRoute;
    const routing = new Promise(done => { finishRoute = done; });
    const startedRouting = new Promise(done => { enterRoute = done; });
    entry.replaceSelectedRunEntryLink = () => { calls.routed++; enterRoute(); return routing; };
    let settled = false;
    const result = entry[method]().then(() => { settled = true; });
    await startedRouting;
    assert.equal(settled, false);
    assert.equal(calls.refreshed, 0);
    assert.equal(entry.runtime.testRunId, "selected-run");
    finishRoute();
    await result;
    assert.equal(calls.routed, 1);
    assert.equal(calls.refreshed, 1);
  });

  test(`${method} does not apply a late response after leaving the participant view`, async () => {
    const { entry, calls, payload } = launchHost();
    entry.requestState.request = async () => { calls.requests++; entry.viewLifecycleSequence++; return payload; };
    await entry[method]();
    assert.equal(calls.synchronized, 0);
    assert.equal(calls.persisted, 0);
    assert.equal(calls.refreshed, 0);
    assert.equal(calls.routed, 0);
  });

  for (const change of ["view", "run"]) {
    test(`${method} does not reroute a superseded ${change} after refresh`, async () => {
      const { entry, calls } = launchHost();
      entry.refreshCurrentStateInternal = async () => {
        calls.refreshed++;
        if (change === "view") entry.viewLifecycleSequence++;
        else entry.runtime.testRunId = "newer-selection";
      };
      await entry[method]();
      assert.equal(calls.refreshed, 1);
      assert.equal(calls.routed, 1, "Only the early authorized URL update is allowed.");
    });
  }
}

test("a late participant proof of work does not launch after leaving the view", async () => {
  const { entry, calls } = launchHost();
  entry.proofOfWork.protectParticipant = async credentials => { entry.viewLifecycleSequence++; return credentials; };
  await entry.starterLaunchInternal();
  assert.equal(calls.requests, 0);
  assert.equal(calls.synchronized, 0);
  assert.equal(calls.routed, 0);
});

test("a late launch code challenge cannot change the next participant view", async () => {
  const { entry, calls } = launchHost();
  entry.requestState.request = async () => { entry.viewLifecycleSequence++; throw new Error("participant_code_required"); };
  await entry.starterLaunchInternal();
  assert.equal(calls.challenges, 0);
  assert.equal(calls.synchronized, 0);
  assert.equal(calls.routed, 0);
});

for (const phase of ["save", "router"]) {
  for (const changed of ["view", "run", "unit", "error"]) {
    test(`controller-error reload cannot reload after ${changed} changes during ${phase}`, async () => {
      await withRouter("original", async ({entry, calls, resolveNavigation}) => {
        let settle;
        entry.settleVeronaAutoSaveBeforeForegroundAction = () => new Promise(done => { settle = done; });
        entry.reloadAfterControllerError(entry.controllerError);
        assert.equal(calls.persisted, 0); assert.equal(calls.routed.length, 0);
        if (phase === "router") { settle(); await Promise.resolve(); assert.equal(calls.routed.length, 1); }
        if (changed === "view") entry.viewLifecycleSequence++;
        if (changed === "run") entry.currentRunState.testRun.testRunId = "other-run";
        if (changed === "unit") entry.currentRunState.currentUnit.unitKey = "other-unit";
        if (changed === "error") entry.activeControllerError = () => ({testRunId:"run/A",unitKey:"active-unit",message:"new error"});
        if (phase === "save") settle();
        resolveNavigation(true); await Promise.all(calls.actions);
        assert.equal(calls.reloads, 0);
        assert.equal(calls.persisted, phase === "save" ? 0 : 1);
      });
    });
  }
}

test("controller-error reload retains a failed save and never reloads or changes the URL", async () => {
  await withRouter("original", async ({entry, calls}) => {
    const failure = Error("owned_save_failure");
    entry.settleVeronaAutoSaveBeforeForegroundAction = async () => { throw failure; };
    entry.reloadAfterControllerError(entry.controllerError);
    await assert.rejects(calls.actions[0], error => error === failure);
    assert.equal(calls.persisted, 0); assert.equal(calls.routed.length, 0); assert.equal(calls.reloads, 0);
  });
});

test("a stale error dialog cannot reload a different active error", async () => {
  await withRouter("original", async ({entry, calls}) => {
    entry.reloadAfterControllerError({...entry.controllerError});
    assert.equal(calls.actions.length, 0); assert.equal(calls.settled, 0);
  });
});
