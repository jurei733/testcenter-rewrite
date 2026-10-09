import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";
import { hasMeaningfulVeronaResponse, parseVeronaUnitResponse, serializeVeronaUnitResponse } from "@testcenter-rewrite-app/contracts";

// Exercise the shipped host actions with the same local completion report that
// already enables the Player's navigation target. A delayed current-state read
// must not make that enabled target silently reject its native host action.
const source = readFileSync(new URL("../apps/web/src/app/participant-view.facade.ts", import.meta.url), "utf8");
const ast = ts.createSourceFile("participant-view.facade.ts", source, ts.ScriptTarget.ES2022, true);
const declaration = ast.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === "ParticipantViewFacade");
const methods = ["player", "goToPreviousUnit", "goToNextUnit", "effectiveNavigationDeniedReasons", "canRequestUnitNavigation"].map(name => {
  const member = declaration?.members.find(node => (ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node)) && node.name.getText(ast) === name);
  assert.ok(member, `The production ${name} method must exist.`);
  return member.getText(ast);
});
const { outputText } = ts.transpileModule(`export const createNavigationHost = (parseVeronaUnitResponse, hasMeaningfulVeronaResponse) => class NavigationHost { ${methods.join("\n")} };`, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
});
const { createNavigationHost } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);
const NavigationHost = createNavigationHost(parseVeronaUnitResponse, hasMeaningfulVeronaResponse);
const completeResponse = serializeVeronaUnitResponse({
  unitState: { presentationProgress: "complete", responseProgress: "complete", dataParts: { answer: "Own answer\n ä🙂\u0000 " } },
  playerState: { currentPage: "last" }
});

function fixture(direction, { reasons, response = completeResponse, canRequest = true }) {
  const host = new NavigationHost();
  const calls = [];
  const currentState = {
    testRun: { testRunId: "own-selected-run", status:"running", unitResponses:{} },
    participantSession: { participantSessionId:"own-session", loginKey:"own-login", groupKey:"own-group" },
    currentUnit: {unitKey:"own-unit"},
    bookletUnits: ["previous-unit","own-unit","next-unit"].map(unitKey=>({unitKey,displayLabel:unitKey,isLocked:false})),
    booklet: {displayLabel:"Own booklet",policy:{navigation:{unitControls:"both"},display:{silentMode:false}}},
    executionMode: {mode:"run-hot-return",saveResponses:true},
    availableActions:canRequest?["save_progress"]:[],
    navigation: {previousUnitKey:"previous-unit",nextUnitKey:"next-unit",forwardDeniedReasons:[],backwardDeniedReasons:[],[`${direction}DeniedReasons`]:reasons}
  };
  host.runtime = { testRunId: "own-selected-run", currentUnitKey: "own-unit", currentUnitResponse: response };
  host.readCurrentRunState = () => currentState;
  // Only unrelated presentation helpers are supplied; navigation permissions
  // are calculated by the actual shipped Player getter, not preselected here.
  host.hasControllerError=false;
  host.hasSavedResponse=()=>false;
  host.effectiveUnitResponse=()=>"";
  host.getEffectiveCompletionState=()=>({label:"",detail:"",state:"incomplete"});
  for(const name of ["getDraftStateLabel","getDraftStateDetail","createParticipantSessionEntryLink","getNextStepLabel","getNextStepDetail","describeNavigationDenial"])
    host[name]=()=>"";
  host.getTimerLifecycleEvent=()=>null;
  host.navigationAdvisory=()=>null;
  host.presentNavigationDenial = value => calls.push(["denied", value]);
  host.presentNavigationAdvisory = value => calls.push(["advisory", value]);
  host.goToPlayerUnitInternal = value => calls.push(["navigate", value]);
  host.viewState = { onActionAsync: action => action() };
  return { host, calls, run: () => direction === "forward" ? host.goToNextUnit() : host.goToPreviousUnit() };
}

for (const direction of ["forward", "backward"]) {
  const target = direction === "forward" ? "next" : "previous";
  for (const reasons of [["presentation_incomplete"], ["response_incomplete"], ["presentation_incomplete", "response_incomplete"]]) {
    test(`${direction}: a completed local Player report can navigate despite a stale ${reasons.join(" and ")} read`, () => {
      const { host, calls, run } = fixture(direction, { reasons });
      assert.equal(direction==="forward"?host.player.canGoNextUnit:host.player.canGoPreviousUnit,true);
      run();
      assert.deepEqual(calls, [["advisory", direction], ["navigate", target]]);
      assert.equal(host.runtime.currentUnitResponse, completeResponse);
      assert.equal(host.runtime.testRunId, "own-selected-run");
    });
  }
  test(`${direction}: incomplete local presentation still explains denial without navigation`, () => {
    const response = serializeVeronaUnitResponse({ unitState: { presentationProgress: "some", responseProgress: "complete" } });
    const { calls, run } = fixture(direction, { reasons: ["presentation_incomplete"], response });
    run();
    assert.deepEqual(calls, [["denied", direction]]);
  });
  test(`${direction}: incomplete local response still explains denial without navigation`, () => {
    const response = serializeVeronaUnitResponse({ unitState: { presentationProgress: "complete", responseProgress: "none" } });
    const { calls, run } = fixture(direction, { reasons: ["response_incomplete"], response });
    run();
    assert.deepEqual(calls, [["denied", direction]]);
  });
  test(`${direction}: completion cannot remove an enforced timed-block restriction`, () => {
    const { calls, run } = fixture(direction, { reasons: ["presentation_incomplete", "testlet_time_leave_forbidden"] });
    run();
    assert.deepEqual(calls, [["denied", direction]]);
  });
  test(`${direction}: an unavailable action cannot navigate even with completed local answers`, () => {
    const { calls, run } = fixture(direction, { reasons: [], canRequest: false });
    run();
    assert.deepEqual(calls, []);
  });
}
