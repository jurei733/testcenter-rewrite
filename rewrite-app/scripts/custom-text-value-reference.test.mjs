import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BehaviorSubject, firstValueFrom, of } from "rxjs";
import { map, switchMap } from "rxjs/operators";
import ts from "typescript";

const fixtureRoot = new URL("../test-fixtures/original-testcenter/", import.meta.url);
const reference = JSON.parse(readFileSync(new URL("current-custom-text-value-reference.json", fixtureRoot), "utf8"));
assert.equal(reference.originalCommit, "eedae41840cbe90e5547c0211da818bdf620f5aa");
for (const file of reference.files) assert.equal(createHash("sha256").update(file.source).digest("hex"), file.sha256);
const catalogFixture = JSON.parse(readFileSync(new URL(reference.catalogFixture, fixtureRoot), "utf8"));
const catalog = JSON.parse(catalogFixture.files.find(file => file.path.endsWith("custom-texts.json")).source);
function members(suffix, className, names) {
  const file = reference.files.find(file => file.path.endsWith(suffix));
  const ast = ts.createSourceFile(suffix, file.source, ts.ScriptTarget.Latest, true);
  const declaration = ast.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === className);
  assert.ok(declaration);
  return declaration.members.filter(node => names.includes(node.name?.getText(ast)) || names.includes("constructor") && ts.isConstructorDeclaration(node)).map(node => node.getText(ast)).join("\n");
}
const actualSource = `export class ReferenceService { ${members("customtext.service.ts", "CustomtextService", ["customTexts", "addCustomTexts", "addCustomTextsFromDefs", "addCustomText", "getCustomText$", "getCustomText"])} }
export class ReferencePipe { ${members("customtext.pipe.ts", "CustomtextPipe", ["constructor", "transform"])} }
export class ReferenceConfig { constructor(private cts: any) {} ${members("app.config.ts", "AppConfig", ["setCustomTexts"])} }`;
const exports = {};
new Function("exports", "BehaviorSubject", "of", "map", "switchMap", "environment", "customTextsDefault", ts.transpileModule(actualSource, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText)(exports, BehaviorSubject, of, map, switchMap, { production: true }, catalog);
const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
}).outputText).toString("base64")}`;
const participantUrl = moduleUrl(readFileSync(new URL("../packages/contracts/src/participant-custom-texts.ts", import.meta.url), "utf8"));
const participant = await import(participantUrl);
const monitor = await import(moduleUrl(readFileSync(new URL("../packages/contracts/src/monitor-custom-texts.ts", import.meta.url), "utf8")
  .replace('"./participant-custom-texts.js"', JSON.stringify(participantUrl))));
const cases = [
  { name: "defaults precede a template fallback", scopes: [{}] },
  { name: "configured global text", scopes: [{ value: "Global" }] },
  { name: "empty login overrides configured global text", scopes: [{ value: "Global" }, { value: "" }] },
  { name: "whitespace is authored text", scopes: [{ value: " \t " }] },
  { name: "surrounding spaces and line breaks survive", scopes: [{ value: "  Authored\ntext  " }] },
  { name: "zero is text", scopes: [{ value: "0" }] },
  { name: "latest scope remains exact", scopes: [{ value: "Global" }, { value: "Login" }, { value: "\n Booklet\t" }] }
];
for (const [label, key, helpers] of [["participant", "login_subtitle", participant], ["monitor", "gm_headline", monitor]]) for (const item of cases) {
  const scopes = item.scopes.map(scope => Object.hasOwn(scope, "value") ? { [key]: scope.value } : {});
  const effective = Object.assign({}, ...scopes);
  const service = new exports.ReferenceService(); new exports.ReferenceConfig(service).setCustomTexts(scopes[0]);
  for (const scope of scopes.slice(1)) service.addCustomTexts(scope);
  const resolve = label === "participant" ? helpers.resolveParticipantCustomText : helpers.resolveMonitorCustomText;
  const value = label === "participant" ? helpers.resolveParticipantCustomTextValue : helpers.resolveMonitorCustomTextValue;
  test(`${label} template resolution matches actual Original: ${item.name}`, async () => {
    const expected = await firstValueFrom(new exports.ReferencePipe(service).transform("Template fallback", key));
    assert.equal(resolve(effective, key, "Template fallback"), expected);
  });
  test(`${label} direct value matches actual Original: ${item.name}`, () => {
    // Earlier consumers used the template resolver for direct reads as well.
    assert.equal((value ?? resolve)(effective, key), service.getCustomText(key));
  });
}

assert.equal(createHash("sha256").update(reference.timer.getter).digest("hex"), reference.timer.getterSha256);
assert.equal(createHash("sha256").update(reference.timer.expression).digest("hex"), reference.timer.expressionSha256);
const participantFacadeSource = readFileSync(new URL("../apps/web/src/app/participant-view.facade.ts", import.meta.url), "utf8");
const participantAst = ts.createSourceFile("facade.ts", participantFacadeSource, ts.ScriptTarget.Latest, true);
const facade = participantAst.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "ParticipantViewFacade");
const lifecycleMethod = facade.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(participantAst) === "getTimerLifecycleEvent");
assert.ok(lifecycleMethod);
const timerExports = {};
new Function("exports", ts.transpileModule(`export class ActualLifecycle { ${lifecycleMethod.getText(participantAst)} }
export class OriginalTimer { timeLeftSeconds = 0; ${reference.timer.getter} }
export class OriginalNotice { constructor(private cts: any) {} message(timer: any) { return ${reference.timer.expression}; } }`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText)(timerExports);
for (const prefix of ["", "  Started  ", "\nReady:\t"]) for (const duration of [3, 29, 30, 62, 90, 125]) test(`actual timer notice matches Original prefix and minute formatter: ${JSON.stringify(prefix)}/${duration}s`, () => {
  const key = "booklet_msgTimerStarted", customTexts = { [key]: prefix };
  const service = new exports.ReferenceService(); new exports.ReferenceConfig(service).setCustomTexts(customTexts);
  const originalTimer = Object.assign(new timerExports.OriginalTimer(), { timeLeftSeconds: duration });
  const expected = new timerExports.OriginalNotice(service).message(originalTimer);
  const view = Object.assign(new timerExports.ActualLifecycle(), {
    activeTimerLifecycleEvent: () => ({ kind: "started", durationSeconds: duration, visibleUntilMs: 10000 }), timerTick: () => 0,
    customTextValue: field => participant.resolveParticipantCustomTextValue(customTexts, field)
  });
  assert.equal(view.getTimerLifecycleEvent().message, expected);
});
