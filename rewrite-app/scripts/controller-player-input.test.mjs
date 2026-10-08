import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

// Execute the actual repository smoke helper. Its browser and backend behavior
// is verified separately with the original Controller corpus, not mocked here.
const source = readFileSync(new URL("./smoke-ui.mjs", import.meta.url), "utf8");
const ast = ts.createSourceFile("smoke-ui.mjs", source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
const candidates = [];
const visit = node => {
  if (ts.isVariableDeclaration(node) && node.name.getText(ast) === "completeOriginalControllerUnit") {
    candidates.push(node.initializer);
  }
  ts.forEachChild(node, visit);
};
visit(ast);
assert.equal(candidates.length, 1, "The real Controller completion helper must be unambiguous.");
assert.ok(candidates[0]);
const moduleSource = `export const createControllerHelper = page => (${candidates[0].getText(ast)});`;
const { createControllerHelper } = await import(`data:text/javascript;base64,${Buffer.from(moduleSource).toString("base64")}`);

const fixture = ({ prepare, paint, check, next } = {}) => {
  const calls = [];
  const page = { locator: selector => {
    assert.equal(selector, "#participantVeronaPlayerFrame");
    return { scrollIntoViewIfNeeded: async (...options) => {
      assert.deepEqual(options, [], "Viewport preparation must not force or synthesize input.");
      calls.push("prepare-start");
      await prepare?.();
      calls.push("prepare-done");
    }, screenshot: async (...options) => {
      assert.deepEqual(options, [], "Render confirmation must not supply style or input overrides.");
      calls.push("paint-start");
      await paint?.();
      calls.push("paint-done");
    } };
  } };
  const frame = {
    locator: selector => {
      if (selector === '[data-cy="TestController-radio1-Aufg1"]') return {
        check: async (...options) => {
          assert.deepEqual(options, [], "Keep the native checked-state assertion without force or bypass options.");
          calls.push("native-radio-check");
          await check?.();
        }
      };
      assert.equal(selector, "#next-page");
      return { click: async (...options) => {
        assert.deepEqual(options, []);
        calls.push("native-next-page-click");
        await next?.();
      } };
    },
    getByText: (text, options) => {
      assert.equal(text, "Presentation complete");
      assert.deepEqual(options, { exact: true });
      return { waitFor: async options => {
        assert.deepEqual(options, { timeout: 15_000 });
        calls.push("presentation-complete");
      } };
    }
  };
  return { calls, run: () => createControllerHelper(page)(frame) };
};

test("Controller input waits for the exact frame's viewport render before the unchanged native check", async () => {
  let finishPreparation, finishPaint, beginPaint;
  const preparation = new Promise(resolve => { finishPreparation = resolve; });
  const painting = new Promise(resolve => { finishPaint = resolve; });
  const paintStarted = new Promise(resolve => { beginPaint = resolve; });
  const { calls, run } = fixture({ prepare: () => preparation, paint: () => { beginPaint(); return painting; } });
  const completing = run();
  assert.deepEqual(calls, ["prepare-start"]);
  finishPreparation();
  await Promise.race([paintStarted, completing.then(() => {
    throw new Error("Native input completed without waiting for the viewport render.");
  })]);
  assert.deepEqual(calls, ["prepare-start", "prepare-done", "paint-start"]);
  finishPaint();
  await completing;
  assert.deepEqual(calls, ["prepare-start", "prepare-done", "paint-start", "paint-done", "native-radio-check",
    "native-next-page-click", "presentation-complete"]);
});

test("an unavailable browser render fails before native input instead of falling back to a blind click", async () => {
  const error = new Error("frame cannot be rendered");
  const { calls, run } = fixture({ paint: () => { throw error; } });
  await assert.rejects(run(), value => value === error);
  assert.deepEqual(calls, ["prepare-start", "prepare-done", "paint-start"]);
});

test("a missing or unscrollable Controller frame fails before any native input", async () => {
  const error = new Error("frame unavailable");
  const { calls, run } = fixture({ prepare: () => { throw error; } });
  await assert.rejects(run(), value => value === error);
  assert.deepEqual(calls, ["prepare-start"]);
});

test("a failed native radio check remains a failure without retry, bypass or page advancement", async () => {
  const error = new Error("Clicking the checkbox did not change its state");
  const { calls, run } = fixture({ check: () => { throw error; } });
  await assert.rejects(run(), value => value === error);
  assert.deepEqual(calls, ["prepare-start", "prepare-done", "paint-start", "paint-done", "native-radio-check"]);
});

test("a failed native page click cannot claim completed presentation", async () => {
  const error = new Error("next page is blocked");
  const { calls, run } = fixture({ next: () => { throw error; } });
  await assert.rejects(run(), value => value === error);
  assert.deepEqual(calls, ["prepare-start", "prepare-done", "paint-start", "paint-done", "native-radio-check", "native-next-page-click"]);
});
