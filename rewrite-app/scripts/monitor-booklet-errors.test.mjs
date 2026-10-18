import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const reference = JSON.parse(readFileSync(new URL("../test-fixtures/original-testcenter/current-monitor-text-reference.json", import.meta.url), "utf8"));
assert.equal(reference.originalCommit, "eedae41840cbe90e5547c0211da818bdf620f5aa");
for (const file of reference.files) assert.equal(createHash("sha256").update(file.source).digest("hex"), file.sha256);
const catalog = JSON.parse(reference.files.find(file => file.path.endsWith("custom-texts.json")).source);
const template = reference.files.find(file => file.path.endsWith("test-session.component.html")).source;
const originalErrors = Object.fromEntries([...template.matchAll(/testSession\.booklet\.error == '([^']+)'[^>]*>([\s\S]*?)<\/span>/g)]
  .map(([, error, text]) => [error, text.trim().replace(/\s+/g, " ")]));
assert.equal(Object.keys(originalErrors).length, 4);
const load = async source => import(`data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
}).outputText).toString("base64")}`);
const monitorSource = readFileSync(new URL("../packages/contracts/src/monitor-custom-texts.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("monitor.ts", monitorSource, ts.ScriptTarget.Latest, true);
const defaults = ast.statements.flatMap(node => ts.isVariableStatement(node) ? [...node.declarationList.declarations] : [])
  .find(node => node.name.getText(ast) === "originalMonitorCustomTextDefaults");
assert.ok(defaults?.initializer);
const { actualDefaults } = await load(`export const actualDefaults = ${defaults.initializer.getText(ast)};`);
const { originalMonitorBookletErrorText } = await load(readFileSync(new URL("../apps/web/src/app/original-monitor-booklet-errors.ts", import.meta.url), "utf8"));

test("the current monitor catalog matches every key and default in the pinned actual Original JSON", () => {
  const expected = Object.fromEntries(Object.entries(catalog).filter(([key]) => key.startsWith("gm_")).map(([key, value]) => [key, value.defaultvalue]));
  assert.equal(Object.keys(expected).length, 54);
  assert.deepEqual(actualDefaults, expected);
  assert.ok(!Object.keys(actualDefaults).some(key => key.startsWith("gm_booklet_error_")));
});
for (const [error, expected] of Object.entries(originalErrors)) test(`actual monitor ${error} copy matches the fixed Original template`, () => {
  assert.equal(originalMonitorBookletErrorText(error), expected);
});
test("healthy and unknown booklet errors do not invent a diagnostic", () => {
  for (const value of [undefined, null, "", "future-error", "constructor"]) assert.equal(originalMonitorBookletErrorText(value), null);
});
