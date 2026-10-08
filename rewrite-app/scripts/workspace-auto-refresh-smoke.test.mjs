import assert from "node:assert/strict";
import test from "node:test";
import { setWorkspaceAutoRefreshEnabled, workspaceAutoRefreshMatchesStorage }
  from "./workspace-auto-refresh-smoke.mjs";

const fixture = ({ enabled = true, scroll, render, readiness, native, persisted, checked = enabled } = {}) => {
  const calls = [];
  const checkbox = {
    async scrollIntoViewIfNeeded(...options) {
      assert.deepEqual(options, []);
      calls.push("scroll");
      await scroll?.();
    },
    async screenshot(...options) {
      assert.deepEqual(options, [], "Rendering cannot supply CSS or input overrides.");
      calls.push("render");
      await render?.();
    },
    async check(...options) {
      assert.deepEqual(options, [], "Keep native input without force or retry.");
      calls.push("check");
      await native?.();
    },
    async uncheck(...options) {
      assert.deepEqual(options, [], "Keep native input without force or retry.");
      calls.push("uncheck");
      await native?.();
    },
    async isChecked() { calls.push("checked"); return checked; }
  };
  const page = {
    locator(selector) { assert.equal(selector, "#autoRefreshEnabled"); return checkbox; },
    async waitForFunction(predicate, expected) {
      assert.equal(predicate, workspaceAutoRefreshMatchesStorage);
      if (expected === null) { calls.push("ready"); await readiness?.(); }
      else { assert.equal(expected, enabled); calls.push("persisted"); await persisted?.(); }
    }
  };
  return { calls, run: () => setWorkspaceAutoRefreshEnabled(page, enabled) };
};

for (const enabled of [true, false]) {
  test(`actual workspace helper renders and awaits bound state before native ${enabled ? "check" : "uncheck"}`, async () => {
    let finishReadiness, startedReadiness;
    const readiness = new Promise(resolve => { finishReadiness = resolve; });
    const started = new Promise(resolve => { startedReadiness = resolve; });
    const { calls, run } = fixture({ enabled, readiness: () => { startedReadiness(); return readiness; } });
    const operation = run();
    await started;
    assert.deepEqual(calls, ["scroll", "render", "ready"]);
    finishReadiness();
    await operation;
    assert.deepEqual(calls, ["scroll", "render", "ready", enabled ? "check" : "uncheck", "persisted", "checked"]);
  });
}

for (const [stage, expectedCalls] of [
  ["scroll", ["scroll"]],
  ["render", ["scroll", "render"]],
  ["readiness", ["scroll", "render", "ready"]],
  ["native", ["scroll", "render", "ready", "check"]],
  ["persisted", ["scroll", "render", "ready", "check", "persisted"]]
]) {
  test(`actual workspace helper preserves ${stage} failure without retry or fallback`, async () => {
    const failure = new Error(`${stage} failed`);
    const { calls, run } = fixture({ [stage]: () => { throw failure; } });
    await assert.rejects(run(), error => error === failure);
    assert.deepEqual(calls, expectedCalls);
  });
}

test("actual workspace helper rejects native state loss even after persistence succeeds", async () => {
  const { run } = fixture({ checked: false });
  await assert.rejects(run(), /native workspace checkbox/);
});

test("actual browser predicate requires native and persisted booleans to agree", () => {
  const previousDocument = Object.getOwnPropertyDescriptor(globalThis, "document");
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  let input = { checked: false };
  let stored = '{"autoRefreshEnabled":true}';
  Object.defineProperty(globalThis, "document", { configurable: true, value: {
    querySelector(selector) { assert.equal(selector, "#autoRefreshEnabled"); return input; }
  } });
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem(key) { assert.equal(key, "testcenter-rewrite-app-shell"); return stored; }
  } });
  try {
    assert.equal(workspaceAutoRefreshMatchesStorage(null), false);
    input.checked = true;
    assert.equal(workspaceAutoRefreshMatchesStorage(null), true);
    assert.equal(workspaceAutoRefreshMatchesStorage(true), true);
    assert.equal(workspaceAutoRefreshMatchesStorage(false), false);
    input.checked = false;
    stored = '{"autoRefreshEnabled":false}';
    assert.equal(workspaceAutoRefreshMatchesStorage(false), true);
    assert.equal(workspaceAutoRefreshMatchesStorage(true), false);
    for (stored of [null, "{}", '{"autoRefreshEnabled":"false"}', "null", "broken JSON"]) {
      assert.equal(workspaceAutoRefreshMatchesStorage(null), false);
    }
    stored = '{"autoRefreshEnabled":false}';
    input = null;
    assert.equal(workspaceAutoRefreshMatchesStorage(null), false);
  } finally {
    if (previousDocument) Object.defineProperty(globalThis, "document", previousDocument);
    else delete globalThis.document;
    if (previousStorage) Object.defineProperty(globalThis, "localStorage", previousStorage);
    else delete globalThis.localStorage;
  }
});
