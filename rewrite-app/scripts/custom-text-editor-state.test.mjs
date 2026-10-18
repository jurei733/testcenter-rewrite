import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { originalParticipantCustomTextDefaults, originalMonitorCustomTextDefaults } from "@testcenter-rewrite-app/contracts";
const source = readFileSync(new URL("../apps/web/src/app/ops-view.facade.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("ops.ts", source, ts.ScriptTarget.Latest, true);
const declaration = ast.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "OpsViewFacade");
assert.ok(declaration);
const names = ["normalizeAdminCustomTextsDraft", "normalizedApplicationCustomTexts", "applicationCustomTextsValid", "applicationCustomTextDefault", "hasApplicationCustomTextOverride", "canAddApplicationCustomText", "addApplicationCustomText", "removeApplicationCustomText"];
const members = names.map(name => { const member = declaration.members.find(node => node.name?.getText(ast) === name); assert.ok(member, name); return member.getText(ast); });
const exports = {};
new Function("exports", "originalParticipantCustomTextDefaults", "originalMonitorCustomTextDefaults", "parseJsonDocument", ts.transpileModule(`export class Editor { ${members.join("\n")} }`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText)(exports, originalParticipantCustomTextDefaults, originalMonitorCustomTextDefaults, value => { try { return JSON.parse(value); } catch { return null; } });
const fixture = () => Object.assign(new exports.Editor(), { applicationCustomTextDrafts: {}, applicationCustomTextNewKey: "", applicationCustomTextNewValue: "" });
test("actual custom-text editors retain empty, whitespace and surrounding text exactly", () => {
  const view = fixture(), raw = { gm_headline: "", gm_control_pause: "  Pause\n ", gm_menu_filter: " \t " };
  assert.deepEqual(view.normalizeAdminCustomTextsDraft(JSON.stringify(raw)), raw);
  view.applicationCustomTextDrafts = raw;
  assert.deepEqual(view.normalizedApplicationCustomTexts(), raw);
  assert.equal(view.applicationCustomTextsValid, true);
});
test("raw whitespace counts toward the same value-byte limit in both editors", () => {
  const view = fixture();
  for (const length of [10000, 10001]) {
    const raw = { gm_headline: " ".repeat(length) };
    view.applicationCustomTextDrafts = raw;
    assert.equal(view.applicationCustomTextsValid, length === 10000);
    assert.equal(view.normalizeAdminCustomTextsDraft(JSON.stringify(raw)) !== null, length === 10000);
  }
});
test("an explicit empty override can be inherited only by removing its key", () => {
  const view = fixture(); view.applicationCustomTextNewKey = "gm_headline";
  assert.equal(view.canAddApplicationCustomText, true); view.addApplicationCustomText();
  assert.equal(view.hasApplicationCustomTextOverride("gm_headline"), true);
  assert.equal(view.applicationCustomTextDrafts.gm_headline, "");
  view.removeApplicationCustomText("gm_headline");
  assert.equal(view.hasApplicationCustomTextOverride("gm_headline"), false);
});
test("prototype-named custom keys never become inherited default functions", () => {
  const view = fixture(), raw = JSON.parse('{"constructor":"value","__proto__":"","toString":"  value  "}');
  assert.deepEqual(view.normalizeAdminCustomTextsDraft(JSON.stringify(raw)), raw);
  for (const key of Object.keys(raw)) assert.equal(view.applicationCustomTextDefault(key), "");
});

test("primitive JSON drafts cannot silently become an empty replacement map", () => {
  const view = fixture();
  for (const text of ["true", "1", "null", "[]", '"text"']) assert.equal(view.normalizeAdminCustomTextsDraft(text), null, text);
});
