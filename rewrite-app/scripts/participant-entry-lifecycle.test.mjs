import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

// Execute the production entry method, not a copied decision algorithm.
// Angular initialization and HTTP/rendering are supplied by the test host;
// the real built UI is verified separately by the mandatory browser gate.
const source = readFileSync(new URL("../apps/web/src/app/participant-view.facade.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("participant-view.facade.ts", source, ts.ScriptTarget.ES2022, true);
const declaration = ast.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "ParticipantViewFacade");
const entryMethod = declaration?.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(ast) === "resumeEntrySessionInternal");
assert.ok(entryMethod, "The production participant entry method must exist.");
const { outputText } = ts.transpileModule(`export class EntryHost { ${entryMethod.getText(ast)} }`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
});
const { EntryHost } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

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
