import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const moduleUrl = source => `data:text/javascript;base64,${Buffer.from(ts.transpileModule(source, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
}).outputText).toString("base64")}`;
const policyUrl = moduleUrl(readFileSync(new URL("../packages/contracts/src/booklet-policy.ts", import.meta.url), "utf8"));
const { compileBookletRuntimePolicy } = await import(policyUrl);
const astFor = file => ts.createSourceFile(file, readFileSync(new URL(file, import.meta.url), "utf8"), ts.ScriptTarget.ES2022, true);
const facadeAst = astFor("../apps/web/src/app/participant-view.facade.ts");
const declaration = facadeAst.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "ParticipantViewFacade");
const names = ["showUnitTitle", "shortUnitLabel", "unitToolbarLabel", "unitNavigationLabel", "screenHeaderLabel", "unitNavigationLabelMode", "veronaPlayer"];
const getters = declaration.members.filter(node => ts.isGetAccessorDeclaration(node) && names.includes(node.name.getText(facadeAst)));
assert.equal(getters.length, names.length, "Execute all actual presentation getters, not a copied label implementation.");
const { LabelFacade } = await import(moduleUrl(`
  import { isBookletPlayerEndAllowed } from ${JSON.stringify(policyUrl)};
  export class LabelFacade { ${getters.map(node => node.getText(facadeAst)).join("\n")} }
`));
const applicationAst = astFor("../packages/application/src/index.ts");
const resolvers = [];
const visit = node => {
  if (ts.isVariableDeclaration(node) && node.name.getText(applicationAst) === "resolveRuntimeBooklet") resolvers.push(node.initializer);
  ts.forEachChild(node, visit);
};
visit(applicationAst);
assert.equal(resolvers.length, 1);
const { resolveRuntimeBooklet } = await import(moduleUrl(`
  import { compileBookletRuntimePolicy } from ${JSON.stringify(policyUrl)};
  export const resolveRuntimeBooklet = ${resolvers[0].getText(applicationAst)};
`));

const fixture = config => {
  const state = {
    testRun: { testRunId: "owned-run", status: "running", unitResponses: { a: "exact saved answer ä/β" } },
    booklet: { displayLabel: "Booklet title", policy: compileBookletRuntimePolicy(config), testlets: [{ testletKey: "block", displayLabel: "Block title" }] },
    currentUnit: { unitKey: "a", displayLabel: "Full Unit title ä/β", testletPath: ["block"] },
    bookletUnits: [{ unitKey: "a", displayLabel: "Full Unit title ä/β", shortLabel: "Kurz ä/β" },
      { unitKey: "b", displayLabel: "Other Unit", shortLabel: "Not the selected Unit" }],
    availableActions: ["save_progress"], navigation: { backwardDeniedReasons: [], forwardDeniedReasons: [] }
  };
  const facade = Object.assign(new LabelFacade(), {
    readCurrentRunState: () => state, hasControllerError: false, eagerBookletLoading: false,
    effectiveUnitResponse: (value, key) => value.testRun.unitResponses[key] ?? "",
    player: { canGoPreviousUnit: false, canGoNextUnit: true, canComplete: false }
  });
  return { state, facade };
};

test("the persistent native browser corpus covers current independent config and defaults", () => {
  const { referenceRevision, cases } = JSON.parse(readFileSync(new URL(
    "../test-fixtures/original-testcenter/current-unit-label-cases.json", import.meta.url
  ), "utf8"));
  assert.equal(referenceRevision, "ee2ab9ab64bd91209ef8534bbe6005838024e46d");
  assert.equal(new Set(cases.map(item => item.key)).size, 8);
  const headers = { short: "unit_short", full: "unit", booklet: "booklet" };
  const labels = { short: "label_short", full: "label", hidden: "hidden", index: "index" };
  for (const item of cases) {
    const policy = compileBookletRuntimePolicy(item.config);
    assert.equal(policy.display.headerContent, headers[item.header], item.key);
    assert.equal(policy.navigation.unitLabel, labels[item.nav], item.key);
    assert.equal(policy.display.toolbarUnitLabel, labels[item.toolbar], item.key);
  }
});

test("current upstream initial short-header fallback keeps default navigation and saved responses", () => {
  const { cases } = JSON.parse(readFileSync(new URL(
    "../test-fixtures/original-testcenter/current-unit-label-cases.json", import.meta.url
  ), "utf8"));
  const entry = cases.find(item => item.key === "initial-short-fallback");
  assert.equal(entry.firstUnitWithoutShortLabel, true);
  const { state, facade } = fixture(entry.config);
  delete state.bookletUnits[0].shortLabel;
  const before = structuredClone(state);
  assert.equal(facade.screenHeaderLabel, "Full Unit title ä/β");
  assert.equal(facade.unitToolbarLabel, "Full Unit title ä/β");
  assert.equal(facade.unitNavigationLabel, "Unit 1 / 2");
  assert.deepEqual(state, before);
});

test("all three short-label surfaces use only the selected Unit and preserve saved state", () => {
  const { state, facade } = fixture({ header_content: "UNIT_LABEL_SHORT", navbar_unit_label: "LABEL_SHORT", toolbar_unit_label: "LABEL_SHORT" });
  const before = structuredClone(state);
  assert.equal(facade.screenHeaderLabel, "Kurz ä/β");
  assert.equal(facade.unitNavigationLabel, "Kurz ä/β");
  assert.equal(facade.unitToolbarLabel, "Kurz ä/β");
  assert.equal(facade.showUnitTitle, true);
  state.currentUnit = { unitKey: "b", displayLabel: "Other Unit", testletPath: ["block"] };
  assert.equal(facade.screenHeaderLabel, "Not the selected Unit");
  assert.equal(facade.unitNavigationLabel, "Not the selected Unit");
  assert.equal(facade.unitToolbarLabel, "Not the selected Unit");
  state.currentUnit = before.currentUnit;
  assert.deepEqual(state, before);
});

test("absent or empty short labels fall back to the full Unit title on every short surface", () => {
  for (const shortLabel of [undefined, ""]) {
    const { state, facade } = fixture({ header_content: "UNIT_LABEL_SHORT", navbar_unit_label: "LABEL_SHORT", toolbar_unit_label: "LABEL_SHORT" });
    state.bookletUnits[0].shortLabel = shortLabel;
    assert.equal(facade.screenHeaderLabel, state.currentUnit.displayLabel);
    assert.equal(facade.unitNavigationLabel, state.currentUnit.displayLabel);
    assert.equal(facade.unitToolbarLabel, state.currentUnit.displayLabel);
  }
});

test("header, navbar and toolbar modes remain independent", () => {
  const { facade } = fixture({ header_content: "UNIT_LABEL", navbar_unit_label: "LABEL_SHORT", toolbar_unit_label: "HIDDEN" });
  assert.equal(facade.screenHeaderLabel, "Full Unit title ä/β");
  assert.equal(facade.unitNavigationLabel, "Kurz ä/β");
  assert.equal(facade.showUnitTitle, false);
  const independent = fixture({ header_content: "UNIT_LABEL_SHORT", navbar_unit_label: "HIDDEN", toolbar_unit_label: "LABEL" }).facade;
  assert.equal(independent.screenHeaderLabel, "Kurz ä/β");
  assert.equal(independent.unitNavigationLabel, "");
  assert.equal(independent.unitToolbarLabel, "Full Unit title ä/β");
});

test("existing full, index, Booklet and Block label modes retain their meaning", () => {
  assert.equal(fixture({ navbar_unit_label: "INDEX" }).facade.unitNavigationLabel, "Unit 1 / 2");
  assert.equal(fixture({ navbar_unit_label: "LABEL" }).facade.unitNavigationLabel, "Full Unit title ä/β");
  assert.equal(fixture({ header_content: "BOOKLET_LABEL" }).facade.screenHeaderLabel, "Booklet title");
  assert.equal(fixture({ header_content: "BLOCK_LABEL" }).facade.screenHeaderLabel, "Block title");
  assert.equal(fixture({ header_content: "NONE" }).facade.screenHeaderLabel, "");
});

test("short headers retain completed, controller-error and hidden-header guards", () => {
  for (const guard of ["completed", "error", "hidden"]) {
    const { state, facade } = fixture({ header_content: "UNIT_LABEL_SHORT" });
    if (guard === "completed") state.testRun.status = "completed";
    if (guard === "error") facade.hasControllerError = true;
    if (guard === "hidden") state.booklet.policy.display.headerHidden = true;
    assert.equal(facade.screenHeaderLabel, "");
  }
});

test("pre-short-label snapshots keep the existing toolbar visibility", () => {
  const { state, facade } = fixture({});
  delete state.booklet.policy.display.toolbarUnitLabel;
  state.booklet.policy.display.unitTitle = false;
  assert.equal(facade.showUnitTitle, false);
  state.booklet.policy.display.unitTitle = true;
  assert.equal(facade.showUnitTitle, true);
  assert.equal(facade.unitToolbarLabel, "Full Unit title ä/β");
});

test("short UI labels never replace the full Verona unitTitle or saved answer", () => {
  const { state, facade } = fixture({ header_content: "UNIT_LABEL_SHORT", navbar_unit_label: "LABEL_SHORT", toolbar_unit_label: "LABEL_SHORT" });
  state.currentUnit.player = { playerKey: "owned-player", html: "<html>owned Player</html>" };
  state.currentUnit.unitDefinition = "owned definition";
  const player = facade.veronaPlayer;
  assert.equal(player.unitTitle, "Full Unit title ä/β");
  assert.equal(player.savedResponse, "exact saved answer ä/β");
  assert.equal(player.testRunId, "owned-run");
  assert.equal(player.unitKey, "a");
});

test("read projection upgrades unsupported short-label keys in old snapshots without mutation", () => {
  const config = { header_content: "UNIT_LABEL_SHORT", navbar_unit_label: "LABEL_SHORT", toolbar_unit_label: "LABEL_SHORT" };
  const policy = compileBookletRuntimePolicy(config);
  delete policy.display.toolbarUnitLabel;
  policy.display.headerContent = "none";
  policy.navigation.unitLabel = "index";
  const release = { runtimeSnapshot: { bookletEntries: [{ bookletKey: "owned-booklet", displayLabel: "Booklet", policy }] } };
  const before = structuredClone(release);
  const result = resolveRuntimeBooklet(release, "owned-booklet");
  assert.equal(result.policy.display.headerContent, "unit_short");
  assert.equal(result.policy.navigation.unitLabel, "label_short");
  assert.equal(result.policy.display.toolbarUnitLabel, "label_short");
  assert.deepEqual(release, before);
});

test("old source-config-less snapshots retain explicit hidden titles and header selection", () => {
  const policy = compileBookletRuntimePolicy({});
  delete policy.display.toolbarUnitLabel;
  policy.display.unitTitle = false;
  policy.display.headerContent = "none";
  const result = resolveRuntimeBooklet({ runtimeSnapshot: { bookletEntries: [{ bookletKey: "booklet", displayLabel: "Booklet", policy }] } }, "booklet");
  assert.equal(result.policy.display.toolbarUnitLabel, "hidden");
  assert.equal(result.policy.display.unitTitle, false);
  assert.equal(result.policy.display.headerContent, "none");
});

test("new HIDDEN toolbar config in an old snapshot wins over its obsolete visible boolean", () => {
  const policy = compileBookletRuntimePolicy({ toolbar_unit_label: "HIDDEN", unit_title: "ON" });
  delete policy.display.toolbarUnitLabel;
  policy.display.unitTitle = true;
  const result = resolveRuntimeBooklet({ runtimeSnapshot: { bookletEntries: [{ bookletKey: "booklet", displayLabel: "Booklet", policy }] } }, "booklet");
  assert.equal(result.policy.display.toolbarUnitLabel, "hidden");
  assert.equal(result.policy.display.unitTitle, false);
});

test("changing only the host's visual navigation label neither restarts nor reconfigures the Player", async () => {
  const ast = astFor("../apps/web/src/app/verona-player-host.component.ts");
  const type = ast.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "VeronaPlayerHostComponent");
  const method = type.members.find(node => ts.isMethodDeclaration(node) && node.name.getText(ast) === "ngOnChanges");
  const { Host } = await import(moduleUrl(`export class Host { ${method.getText(ast)} }`));
  const host = Object.assign(new Host(), { viewReady: true, mountPlayer: () => assert.fail("visual label must not restart"), updatePlayerConfig: () => assert.fail("visual label must not replace metadata") });
  host.ngOnChanges({ unitNavigationLabel: {}, unitNavigationLabelMode: {} });
});
