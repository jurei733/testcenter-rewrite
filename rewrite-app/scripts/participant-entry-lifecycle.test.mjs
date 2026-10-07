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
const methodNames = ["resumeEntrySessionInternal", "replaceSelectedRunEntryLink", "reloadPage", "reloadAfterControllerError",
  "starterLaunchInternal", "resumeSessionInternal"];
const methods = methodNames.map(name => {
  const method = declaration?.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(ast) === name);
  assert.ok(method, `The production ${name} method must exist.`);
  return method.getText(ast);
});
const { outputText } = ts.transpileModule(`export const createEntryHost = (productionApiRoutes, resolveRoutePath, prettyPrintJson) => class EntryHost { ${methods.join("\n")} };`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
});
const { createEntryHost } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const EntryHost = createEntryHost(productionApiRoutes, resolveRoutePath, value => JSON.stringify(value));

const parameters = testRunId => ({ bookletKey: "BOOKLET#level:beginner", testRunId });
const state = (mode, overrides = {}) => ({
  executionMode: { mode, saveResponses: !["run-demo", "run-review", "run-simulation"].includes(mode) },
  testRun: { testRunId: "selected/A", bookletKey: "BOOKLET", bookletAssignmentKey: "BOOKLET#level:advanced",
    status: "running", locked: false, currentUnitKey: "active-unit", ...overrides }
});
const host = currentState => {
  const entry = new EntryHost();
  entry.viewLifecycleSequence = 1;
  entry.runtime = { testRunId: "selected/A", bookletKey: "stale-browser-assignment" };
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
  const calls = { nativeWrites: 0, reloads: 0, persisted: 0, routed: [], actions: [] };
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
  entry.hasControllerError = true;
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

for (const method of ["reloadPage", "reloadAfterControllerError"]) {
  test(`${method} waits for the exact Router URL before reloading the page`, async () => {
    await withRouter("original", async ({ entry, calls, resolveNavigation }) => {
      entry[method]();
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
      entry.hasControllerError = false;
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
  test(`${method} awaits the selected Run's Router update after current-state refresh`, async () => {
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
    assert.equal(calls.refreshed, 1);
    assert.equal(entry.runtime.testRunId, "selected-run");
    finishRoute();
    await result;
    assert.equal(calls.routed, 1);
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
    test(`${method} does not route a superseded ${change} after refresh`, async () => {
      const { entry, calls } = launchHost();
      entry.refreshCurrentStateInternal = async () => {
        calls.refreshed++;
        if (change === "view") entry.viewLifecycleSequence++;
        else entry.runtime.testRunId = "newer-selection";
      };
      await entry[method]();
      assert.equal(calls.refreshed, 1);
      assert.equal(calls.routed, 0);
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
