import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const relative = "rewrite-app/apps/web/src/app/app.component.ts";
const source = process.env.APP_INITIAL_ROUTE_REFERENCE
  ? execFileSync("git", ["show", `${process.env.APP_INITIAL_ROUTE_REFERENCE}:${relative}`], { encoding: "utf8" })
  : readFileSync(new URL("../apps/web/src/app/app.component.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("app.ts", source, ts.ScriptTarget.ES2022, true);
const component = ast.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "AppComponent");
const routes = ast.statements.find(node => ts.isVariableStatement(node) && node.declarationList.declarations.some(declaration => declaration.name.getText(ast) === "routeViews"));
const names = ["ngOnInit", "getInitialViewFromLocation", "getLegacyParticipantLoginFromHash"];
const methods = names.map(name => component.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(ast) === name));
assert.ok(routes && methods.every(Boolean));
const module = ts.transpileModule(`${routes.getText(ast)} export class InitialRoute { ${methods.map(method => method.getText(ast)).join("\n")} }`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
}).outputText;
const { InitialRoute } = await import(`data:text/javascript;base64,${Buffer.from(module).toString("base64")}`);

for (const routerUrl of ["/", ""]) for (const [pathname, expected] of [
  ["/", "home"], ["/app", "home"], ["/app/", "home"],
  ["/app/attachment-capture", null], ["/app/legal-notice", null],
  ["/app/privacy", null], ["/app/accessibility", null],
  ["/app/ops", "ops"], ["/app/participant", "participant"]
]) test(`initial ${pathname} survives transient router URL ${JSON.stringify(routerUrl)}`, async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    location: { pathname, hash: "" }, addEventListener() {}
  } });
  const host = new InitialRoute(), initialized = [], navigations = [];
  Object.assign(host, { applicationSettings: { load: async () => {} },
    app: { init: view => initialized.push(view) },
    router: { url: routerUrl, navigateByUrl: async (...args) => navigations.push(args) } });
  try {
    await host.ngOnInit();
    assert.deepEqual(initialized, [expected]);
    assert.deepEqual(navigations, expected === "home" ? [["/home", { replaceUrl: true }]] : []);
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else delete globalThis.window;
  }
});

test("initial legacy hash login retains its participant route and scoped handoff", async () => {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "window");
  Object.defineProperty(globalThis, "window", { configurable: true, value: {
    location: { pathname: "/app/", hash: "#/owned%20login" }, addEventListener() {}
  } });
  const host = new InitialRoute(), initialized = [], navigations = [];
  Object.assign(host, { applicationSettings: { load: async () => {} },
    app: { init: view => initialized.push(view) },
    router: { url: "/", navigate: async (...args) => navigations.push(args), navigateByUrl: async () => assert.fail("No home redirect") } });
  try {
    await host.ngOnInit();
    assert.deepEqual(initialized, ["participant"]);
    assert.deepEqual(navigations, [[["/participant"], { queryParams: { tenantKey: "", workspaceKey: "", loginKey: "owned login", legacyShortLink: "true" }, replaceUrl: true }]]);
  } finally {
    if (previous) Object.defineProperty(globalThis, "window", previous);
    else delete globalThis.window;
  }
});
