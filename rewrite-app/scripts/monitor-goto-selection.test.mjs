import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const file = "../apps/web/src/app/runtime-view.facade.ts";
const ast = ts.createSourceFile(file, readFileSync(new URL(file, import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
const facade = ast.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "RuntimeViewFacade");
assert.ok(facade);
const names = ["issueMonitorGoto", "issueMonitorBatchCommand", "selectNextMonitorBlockAfterGoto",
  "findMonitorTarget", "monitorGotoRestoration", "monitorBatchNavigationPlan", "clearMonitorUnitFilterBeforeGoto"];
const methods = names.map(name => {
  const method = facade.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(ast) === name);
  assert.ok(method, `Execute actual production method ${name}`);
  return method.getText(ast);
});
const readers = ts.createSourceFile("readers.ts", readFileSync(new URL("../apps/web/src/app/rewrite-app-shell.readers.ts", import.meta.url), "utf8"), ts.ScriptTarget.Latest, true);
const parser = readers.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => declaration.name.getText(readers) === "parseJsonDocument"));
assert.ok(parser);
const compiled = ts.transpileModule(`${parser.getText(readers)}\nexport class SelectionFacade { ${methods.join("\n")} }`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
}).outputText;
const { SelectionFacade } = await import(`data:text/javascript;base64,${Buffer.from(compiled).toString("base64")}`);

const targets = prefix => ["first", "second"].map(blockKey => ({ blockKey, blockLabel: blockKey,
  targetUnitKey: `${prefix}-${blockKey}`, unitKeys: [`${prefix}-${blockKey}`, `${prefix}-${blockKey}-alias`] }));
const run = prefix => ({ testRunId: prefix, currentUnitKey: `${prefix}-second`, status: "running", blockNavigationTargets: targets(prefix) });
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };

function fixture({ automatic = true, accepted = ["a", "b"] } = {}) {
  const runs = [run("a"), run("b")], pending = deferred(), requests = [], actions = [];
  const view = Object.assign(new SelectionFacade(), {
    runtime: { monitorTargetUnitKey: "a-first", monitorTimeSeconds: "120", openRunUnitFilter: "a-second",
      openRunsView: JSON.stringify({ items: runs }) },
    activeMonitorProfile: { settings: { autoselectNextBlock: automatic ? "yes" : "no" } },
    selectedOpenMonitorRun: runs[0], monitorBlockNavigationTargets: targets("a"),
    monitorBatchRunIds: ["a", "b"], monitorBatchSelection: new Set(["a", "b"]),
    canIssueMonitorGoto: true, canIssueMonitorBatchGoto: true, isMonitorOnlySession: true,
    confirmation: { confirm: async () => true }, persistState() {}, monitorText: value => value,
    uiState: { renderVersion: { update() {} } }, viewState: { onActionAsync: action => { actions.push(action()); } },
    runtimeService: {
      issueMonitorRunCommand: async commandType => {
        requests.push({ commandType, targetUnitKey: view.runtime.monitorTargetUnitKey });
        await pending.promise;
        return { command: { testRun: runs[0] } };
      },
      issueMonitorRunCommands: async (testRunIds, commandType, options) => {
        requests.push({ commandType, testRunIds, ...options });
        await pending.promise;
        const commands = testRunIds.filter(id => accepted.includes(id)).map(id => ({ testRun: runs.find(run => run.testRunId === id) }));
        return { requestedCount: testRunIds.length, succeededCount: commands.length,
          failedCount: testRunIds.length - commands.length, commands,
          failures: testRunIds.filter(id => !accepted.includes(id)).map(testRunId => ({ testRunId })) };
      }
    }
  });
  return { view, pending, requests, actions };
}

test("single Goto advances from the requested block while its receipt still reports the old last Unit", async () => {
  const f = fixture();
  await f.view.issueMonitorGoto();
  assert.equal(f.view.runtime.monitorTargetUnitKey, "a-first");
  assert.deepEqual(f.requests, [{ commandType: "goto", targetUnitKey: "a-first" }]);
  f.pending.resolve(); await Promise.all(f.actions);
  assert.equal(f.view.runtime.monitorTargetUnitKey, "a-second");
  assert.equal(f.view.runtime.openRunUnitFilter, "");
});

test("single Goto to the last block clears the suggestion even if the receipt reports the first Unit", async () => {
  const f = fixture();
  f.view.runtime.monitorTargetUnitKey = "a-second";
  f.view.selectedOpenMonitorRun.currentUnitKey = "a-first";
  await f.view.issueMonitorGoto(); f.pending.resolve(); await Promise.all(f.actions);
  assert.equal(f.view.runtime.monitorTargetUnitKey, "");
});

test("manual next-block mode retains the requested selection after a deferred single receipt", async () => {
  const f = fixture({ automatic: false });
  await f.view.issueMonitorGoto(); f.pending.resolve(); await Promise.all(f.actions);
  assert.equal(f.view.runtime.monitorTargetUnitKey, "a-first");
});

test("batch Goto maps a successful variant to its requested block instead of its stale current Unit", async () => {
  const f = fixture({ accepted: ["b"] });
  await f.view.issueMonitorBatchCommand("goto");
  assert.deepEqual(f.requests.map(request => [request.testRunIds, request.targetUnitKey]), [[["a"], "a-first"], [["b"], "b-first"]]);
  assert.equal(f.view.runtime.monitorTargetUnitKey, "a-first");
  f.pending.resolve(); await Promise.all(f.actions);
  assert.equal(f.view.runtime.monitorTargetUnitKey, "b-second");
  assert.deepEqual([...f.view.monitorBatchSelection], ["a"]);
});

test("a fully failed batch leaves its selection intact", async () => {
  const f = fixture({ accepted: [] });
  await f.view.issueMonitorBatchCommand("goto"); f.pending.resolve(); await Promise.all(f.actions);
  assert.equal(f.view.runtime.monitorTargetUnitKey, "a-first");
  assert.deepEqual([...f.view.monitorBatchSelection], ["a", "b"]);
});

test("manual next-block mode retains the common selection after variant batch receipts", async () => {
  const f = fixture({ automatic: false });
  await f.view.issueMonitorBatchCommand("goto"); f.pending.resolve(); await Promise.all(f.actions);
  assert.equal(f.view.runtime.monitorTargetUnitKey, "a-first");
  assert.deepEqual([...f.view.monitorBatchSelection], []);
});
