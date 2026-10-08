import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import ts from "typescript";

const moduleUrl = code => `data:text/javascript;base64,${Buffer.from(code).toString("base64")}`;
const compile = code => ts.transpileModule(code, {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
}).outputText;
const source = file => readFileSync(new URL(`../apps/web/src/app/${file}.ts`, import.meta.url), "utf8");
const readers = moduleUrl(compile(source("rewrite-app-shell.readers")));
const links = moduleUrl(compile(source("participant-session-links")));

// Execute the real getters and their real helpers. Only unrelated Angular
// injection/field initialization is excluded; no card/link algorithm is copied.
async function loadFacade(file, name) {
  const ast = ts.createSourceFile(file, source(file), ts.ScriptTarget.ES2022, true);
  const declaration = ast.statements.find(node => ts.isClassDeclaration(node) && node.name?.text === name);
  assert.ok(declaration, `${name} must exist`);
  const members = declaration.members.filter(node =>
    ts.isMethodDeclaration(node) || ts.isGetAccessorDeclaration(node) || ts.isSetAccessorDeclaration(node) ||
    (ts.isPropertyDeclaration(node) && node.initializer && ts.isArrowFunction(node.initializer))
  ).map(node => node.getText(ast)).join("\n");
  return (await import(moduleUrl(compile(`
    import { parseJsonDocument, readStringValue, readNumberValue, readUnknownValue } from ${JSON.stringify(readers)};
    import { participantSessionLinkRows as buildParticipantSessionLinkRows,
      buildParticipantEntryUrl as buildParticipantEntryLinkUrl } from ${JSON.stringify(links)};
    export class ${name} { ${members} }
  `))))[name];
}
const WorkspaceViewFacade = await loadFacade("workspace-view.facade", "WorkspaceViewFacade");
const ContentViewFacade = await loadFacade("content-view.facade", "ContentViewFacade");
const date = "2026-10-07T06:00:00.000Z";
const participantSession = {
  participantSessionId: "owned/session:ä", loginKey: "owned-login", groupKey: "owned-group",
  status: "running", createdAt: date
};
const run = (id, assignment) => ({
  testRunId: id, participantSessionId: participantSession.participantSessionId,
  bookletKey: "BOOKLET", ...(assignment ? { bookletAssignmentKey: assignment } : {}),
  status: "running", currentUnitKey: "unit-a", unitResponses: {}, createdAt: date, updatedAt: date
});
const runA = run("run/A:ä", "BOOKLET#level:advanced");
const runB = run("run/B", "BOOKLET#level:beginner");
const runItem = testRun => ({
  testRun, participantSession, participantRosterEntry: null,
  responseCount: 1, reviewCount: 0, responseLength: 5, answered: true, expected: true
});
const detail = overrides => ({
  tenantKey: "owned-tenant", workspaceKey: "owned-workspace", loginKey: "owned-login", groupKey: "owned-group",
  generatedAt: date, unitProgress: [], bookletProgress: [], rosterEntries: [], sessions: [], unitRows: [],
  testRuns: [runItem(runA), runItem(runB)], ...overrides
});
const createFacade = (Type, workspace = {}, content = {}) => {
  const facade = new Type();
  facade.uiState = {
    workspace: { tenantKey: "owned-tenant", workspaceKey: "owned-workspace", ...workspace },
    content: { sourcePackageId: "", importJobId: "", contentReleaseId: "", ...content },
    runtime: { participantSessionId: "", testRunId: "", loginKey: "" }
  };
  facade.workspace = facade.uiState.workspace;
  facade.content = facade.uiState.content;
  return facade;
};
const linkRows = items => items.flatMap(item => item.rows ?? []).filter(row => row.label === "Participant Link");
const assertLink = (row, testRun, bookletKey = testRun?.bookletAssignmentKey ?? testRun?.bookletKey) => {
  assert.equal(row.value, row.href);
  const url = new URL(row.href, "https://owned.example");
  assert.equal(url.pathname, "/participant");
  assert.deepEqual(Object.fromEntries(url.searchParams), {
    participantSessionId: participantSession.participantSessionId,
    ...(testRun ? { testRunId: testRun.testRunId } : {}),
    tenantKey: "owned-tenant", workspaceKey: "owned-workspace", loginKey: "owned-login", groupKey: "owned-group",
    ...(bookletKey ? { bookletKey } : {})
  });
};

for (const [getter, field, payloadKey] of [
  ["studyMonitorParticipantItems", "studyMonitorParticipantView", "studyMonitorParticipant"],
  ["studyMonitorBookletItems", "studyMonitorBookletView", "studyMonitorBooklet"],
  ["studyMonitorGroupItems", "studyMonitorGroupView", "studyMonitorGroup"],
  ["studyMonitorUnitItems", "studyMonitorUnitView", "studyMonitorUnit"]
]) {
  test(`${getter} keeps each represented run and exact preset assignment`, () => {
    const facade = createFacade(WorkspaceViewFacade, { [field]: JSON.stringify({ [payloadKey]: detail() }) });
    const rows = linkRows(facade[getter]);
    assert.equal(rows.length, 2);
    assertLink(rows[0], runA);
    assertLink(rows[1], runB);
  });
}

test("participant unit cards bind their row's run, assignment and group", () => {
  const unitRows = [runA, runB].map(testRun => ({
    participantSessionId: participantSession.participantSessionId, testRunId: testRun.testRunId,
    loginKey: "owned-login", groupKey: "owned-group", bookletKey: "BOOKLET", unitKey: "unit-a"
  }));
  const facade = createFacade(WorkspaceViewFacade, {
    studyMonitorParticipantView: JSON.stringify({ studyMonitorParticipant: detail({ unitRows, testRuns: [runItem(runA), runItem(runB)] }) })
  });
  const rows = linkRows(facade.studyMonitorParticipantItems);
  assert.equal(rows.length, 4);
  assertLink(rows[0], runA);
  assertLink(rows[1], runB);
});

test("group session cards use the represented latest run before an unrelated first roster assignment", () => {
  const facade = createFacade(WorkspaceViewFacade, {
    studyMonitorGroupView: JSON.stringify({ studyMonitorGroup: detail({
      testRuns: [], sessions: [{ participantSession, latestTestRun: runB,
        participantRosterEntry: { bookletKey: "UNRELATED-FIRST", displayName: "Owned" } }]
    }) })
  });
  assertLink(linkRows(facade.studyMonitorGroupItems)[0], runB);
});

test("a group session without a run remains a legitimate session-only entry", () => {
  const facade = createFacade(WorkspaceViewFacade, {
    studyMonitorGroupView: JSON.stringify({ studyMonitorGroup: detail({
      testRuns: [], sessions: [{ participantSession, latestTestRun: null,
        participantRosterEntry: { bookletKey: "ROSTER-BOOKLET" } }]
    }) })
  });
  assertLink(linkRows(facade.studyMonitorGroupItems)[0], null, "ROSTER-BOOKLET");
});

for (const getter of ["workspaceActivityItems", "workspaceActivityDetailItems"]) {
  test(`${getter} binds historical run subjects and explicit run details, never an unrelated subject`, () => {
    const events = [
      { subjectType: "test_run", subjectId: runA.testRunId, details: { testRunId: "stale-detail" } },
      { subjectType: "participant_session", subjectId: participantSession.participantSessionId, details: { testRunId: runA.testRunId } },
      { subjectType: "participant_session", subjectId: participantSession.participantSessionId, details: {} }
    ].map((event, index) => ({ activityEvent: {
      activityEventId: `event-${index}`, summary: "Owned historical event", occurredAt: date,
      eventType: "test_run_created", ...event,
      details: { participantSessionId: participantSession.participantSessionId, loginKey: "owned-login", groupKey: "owned-group",
        bookletKey: "BOOKLET", bookletAssignmentKey: runA.bookletAssignmentKey, sessionToken: "never-export-this", ...event.details }
    } }));
    const facade = createFacade(WorkspaceViewFacade, { workspaceActivityView: JSON.stringify({ items: events }) });
    const rows = linkRows(facade[getter]);
    assert.equal(rows.length, 3);
    assertLink(rows[0], runA);
    assertLink(rows[1], runA);
    assertLink(rows[2], null, runA.bookletAssignmentKey);
    assert.equal(JSON.stringify(rows).includes("never-export-this"), false);
  });
}

test("activation blockers bind the actual blocking run rather than the session fallback", () => {
  const facade = createFacade(ContentViewFacade, {}, { contentReleaseActivationReadinessView: JSON.stringify({ activationReadiness: {
    blockingOpenRuns: [{ ...runA, loginKey: "owned-login", groupKey: "owned-group", participantRosterEntry: null }]
  } }) });
  // OpenMonitorRun exposes the source Booklet, not the preset-assignment field.
  assertLink(linkRows(facade.activationBlockingRunItems)[0], runA, "BOOKLET");
});

test("content release run cards keep separate runs and preset assignments in one session", () => {
  const facade = createFacade(ContentViewFacade, {}, { contentReleaseDetailView: JSON.stringify({ contentReleaseDetail: {
    contentRelease: { releaseLabel: "Owned" }, participantRosterEntries: [], participantSessions: [participantSession], testRuns: [runA, runB]
  } }) });
  const rows = linkRows(facade.contentReleaseTestRunItems);
  assert.equal(rows.length, 2);
  assertLink(rows[0], runA);
  assertLink(rows[1], runB);
});

test("content session cards do not invent a run selection when they represent only a session", () => {
  const facade = createFacade(ContentViewFacade, {}, { contentReleaseDetailView: JSON.stringify({ contentReleaseDetail: {
    contentRelease: { releaseLabel: "Owned" }, participantRosterEntries: [], participantSessions: [participantSession], testRuns: [runA, runB]
  } }) });
  assertLink(linkRows(facade.contentReleaseParticipantSessionItems)[0], null);
});

test("a run card without a known owning session never emits a participant re-entry link", () => {
  const facade = createFacade(WorkspaceViewFacade, { studyMonitorParticipantView: JSON.stringify({ studyMonitorParticipant: detail({
    testRuns: [{ ...runItem(runA), participantSession: null }]
  }) }) });
  assert.deepEqual(linkRows(facade.studyMonitorParticipantItems), []);
});
