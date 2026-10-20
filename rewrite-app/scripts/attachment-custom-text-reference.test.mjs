import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import test from "node:test";
import { BehaviorSubject, firstValueFrom, of } from "rxjs";
import { map, switchMap } from "rxjs/operators";
import ts from "typescript";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const fixture = JSON.parse(read("../test-fixtures/original-testcenter/current-attachment-text-reference.json"));
const shared = JSON.parse(read("../test-fixtures/original-testcenter/current-custom-text-value-reference.json"));
assert.equal(fixture.originalCommit, shared.originalCommit);
for (const file of [...fixture.files, ...shared.files]) assert.equal(createHash("sha256").update(file.source).digest("hex"), file.sha256);
const classMembers = (source, name, names) => {
  const ast = ts.createSourceFile("source.ts", source, ts.ScriptTarget.Latest, true);
  const declaration = ast.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === name);
  assert.ok(declaration, name);
  return declaration.members.filter(node => names.includes(node.name?.getText(ast)) || names.includes("constructor") && ts.isConstructorDeclaration(node)).map(node => node.getText(ast)).join("\n");
};
const originalMembers = (suffix, name, names) => classMembers(shared.files.find(file => file.path.endsWith(suffix)).source, name, names);
const reference = {};
new Function("exports", "BehaviorSubject", "of", "map", "switchMap", "environment", ts.transpileModule(`
export class Service { ${originalMembers("customtext.service.ts", "CustomtextService", ["customTexts", "addCustomTexts", "addCustomText", "getCustomText$", "getCustomText"])} }
export class Pipe { ${originalMembers("customtext.pipe.ts", "CustomtextPipe", ["constructor", "transform"])} }`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }
}).outputText)(reference, BehaviorSubject, of, map, switchMap, { production: true });
const url = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
}).outputText).toString("base64")}`;
const helpers = await import(url(read("../apps/web/src/app/attachment-custom-texts.ts")));
const fallbacks = {};
for (const file of fixture.files.filter(file => file.path.endsWith(".html"))) {
  for (const [, fallback, key] of file.source.matchAll(/'([^']*)'\s*\|\s*customtext\s*:\s*'([^']+)'/g)) fallbacks[key] = fallback;
  for (const [, key, fallback] of file.source.matchAll(/customtext="([^"]+)"\s+text="([^"]+)"/g)) fallbacks[key] = fallback;
}
for (const [key, fallback] of Object.entries(helpers.originalAttachmentTextFallbacks)) {
  test(`attachment fallback is authored in the pinned Original template: ${key}`, () => assert.equal(fallback, fallbacks[key]));
}
const scopes = [
  { name: "missing", global: undefined, local: undefined },
  { name: "global", global: "Global", local: undefined },
  { name: "login", global: "Global", local: "Login" },
  { name: "empty login", global: "Global", local: "" },
  { name: "authored whitespace", global: "Global", local: " \t\n " },
  { name: "padded multiline", global: "Global", local: "  Eine\nSeite Ω  " },
  { name: "literal replacement tokens", global: "Global", local: "$& $` $' $$ %s %GROUP%" }
];
const actual = {};
for (const [name, file, members] of [
  ["Manager", "attachment-manager.component.ts", ["customText", "originalInterface", "labelTemplate", "setLabelTemplate", "ngOnChanges"]],
  ["Capture", "attachment-capture.component.ts", ["customText"]],
  ["Transport", "attachment-manager.service.ts", ["withQuery"]]
]) {
  new Function("exports", "resolveAttachmentText", "attachmentTextValue", ts.transpileModule(`export class ${name} {
    ${classMembers(read(`../apps/web/src/app/${file}`), name === "Manager" ? "AttachmentManagerComponent" : name === "Capture" ? "AttachmentCaptureComponent" : "AttachmentManagerService", members)}
  }`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS } }).outputText)(actual, helpers.resolveAttachmentText, helpers.attachmentTextValue);
}
for (const item of scopes) for (const key of Object.keys(helpers.originalAttachmentTextFallbacks)) {
  const global = item.global === undefined ? {} : { [key]: item.global };
  const local = item.local === undefined ? {} : { [key]: item.local };
  test(`actual manager/camera match the Original service and pipe: ${key}/${item.name}`, async () => {
    const service = new reference.Service(); service.addCustomTexts(global); service.addCustomTexts(local);
    const expected = await firstValueFrom(new reference.Pipe(service).transform(fallbacks[key], key));
    for (const Component of [actual.Manager, actual.Capture]) {
      const view = Object.assign(new Component(), { interfaceMode: { mode: () => "original" },
        applicationSettings: { settings: () => ({ customTexts: global }) }, operatorAccess: { customTexts: local } });
      assert.equal(view.customText(key, "Rewrite fallback"), expected);
    }
  });
}
for (const item of scopes) test(`actual PDF template and query preserve direct Original values: ${item.name}`, () => {
  const key = "am_page_template_label";
  const global = item.global === undefined ? {} : { [key]: item.global };
  const local = item.local === undefined ? {} : { [key]: item.local };
  const service = new reference.Service(); service.addCustomTexts(global); service.addCustomTexts(local);
  const view = Object.assign(new actual.Manager(), { interfaceMode: { mode: () => "original" }, labelTemplateOverride: null,
    applicationSettings: { settings: () => ({ customTexts: global }) }, operatorAccess: { customTexts: local }, clearPreview() {} });
  assert.equal(view.labelTemplate, service.getCustomText(key));
  const transport = new actual.Transport();
  const query = new URL(transport.withQuery("/pages", { labelTemplate: view.labelTemplate, layout: "original" }), "http://owned.invalid").searchParams;
  assert.equal(query.get("labelTemplate"), service.getCustomText(key) || null);
  view.setLabelTemplate({ target: { value: "  Local edit\n " } });
  assert.equal(view.labelTemplate, "  Local edit\n ");
  view.ngOnChanges();
  assert.equal(view.labelTemplate, service.getCustomText(key), "changing operator/scope discards the prior editor override");
});
