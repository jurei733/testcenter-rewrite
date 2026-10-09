import assert from "node:assert/strict";
import test from "node:test";
import { randomUUID } from "node:crypto";
import { mkdtemp, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createFirstSliceServices } from "@testcenter-rewrite-app/application";
import { createInMemoryFirstSliceRepository } from "@testcenter-rewrite-app/memory-store";
import { createFileFirstSliceRepository } from "@testcenter-rewrite-app/file-store";
import { createSqliteFirstSliceRepository } from "@testcenter-rewrite-app/sqlite-store";
import { createPostgresFirstSliceStorage } from "@testcenter-rewrite-app/postgres-store";
import { captureResultGroupSnapshot, assertGroupDeletionMatchesSnapshot,
  assertResultGroupRemoved, assertResultGroupRetained } from "./group-result-deletion-check.mjs";

const workspaceUrl = "http://127.0.0.1:4312/api/v1/tenants/t/workspaces/w";
const groupKey = "selected:Ä/β";
const sessionId = "selected/session";
const runs = [
  { testRunId: "older-empty", participantSessionId: sessionId, unitResponses: {} },
  { testRunId: "latest", participantSessionId: sessionId, unitResponses: { unit: "Ä/β 🧪\nanswer" } }
];
const summary = { groupKey, bookletsStarted: 2, responseCount: 1, reviewCount: 1, testLogCount: 1 };
const review = { reviewId: "review", testRunId: "latest", comment: "Exact comment" };
const log = { groupKey, testLog: { testLogId: "log", testRunId: "older-empty", content: "Exact log" } };

function fixture({ removed = false, changeAnswer = false, incomplete = false, wrongGroup = false,
  cappedSessions = false, cappedLogs = false, retainedLog = false, foreignLog = false,
  changedReview = false, changedLog = false } = {}) {
  const reads = [];
  return { reads, readJson: async url => {
    reads.push(url);
    const parsed = new URL(url);
    const path = parsed.pathname.slice(new URL(workspaceUrl).pathname.length);
    if (path === "/results/groups") return { items: removed ? [] : [summary] };
    if (path === "/participant-sessions") {
      assert.equal(parsed.searchParams.get("groupKey"), groupKey);
      const item = { participantSession: { participantSessionId: sessionId,
        groupKey: wrongGroup ? "foreign" : groupKey }, latestTestRun: runs[1] };
      return { items: cappedSessions ? Array(500).fill(item) : [item] };
    }
    if (path === `/participant-sessions/${encodeURIComponent(sessionId)}`) {
      const testRuns = removed ? [] : structuredClone(incomplete ? [runs[1]] : runs);
      if (changeAnswer) testRuns[1].unitResponses.unit = "Changed answer";
      return { participantSessionDetail: { participantSession: { participantSessionId: sessionId, groupKey },
        testRuns, reviews: removed ? [] : [{ ...review, comment: changedReview ? "Changed review" : review.comment }],
        responseCount: removed ? 0 : 1, reviewCount: removed ? 0 : 1 } };
    }
    if (["/responses/detailed", "/reviews", "/test-logs"].includes(path)) {
      assert.equal(parsed.searchParams.get("groupKey"), groupKey);
      assert.equal(parsed.searchParams.has("testRunId"), false);
      const fixtureLog = { ...log, groupKey: foreignLog ? "foreign" : groupKey,
        testLog: { ...log.testLog, content: changedLog ? "Changed log" : log.testLog.content } };
      return { items: removed ? (retainedLog && path === "/test-logs" ? [log] : [])
        : path === "/test-logs" ? (cappedLogs ? Array(500).fill(fixtureLog) : [fixtureLog]) : [review] };
    }
    throw new Error(`Unexpected fixture URL ${url}`);
  } };
}
const deletion = { groupKeys: [groupKey], deletedTestRunIds: ["latest", "older-empty"],
  deletedTestRunCount: 2, deletedResponseCount: 1, deletedReviewCount: 1, deletedTestLogCount: 1 };

test("snapshot includes historical zero-answer Runs, not only latest/response rows", async () => {
  const snapshot = await captureResultGroupSnapshot(fixture().readJson, workspaceUrl, groupKey);
  assert.deepEqual(snapshot.testRunIds, ["latest", "older-empty"]);
  assert.equal(snapshot.testRuns.find(run => run.testRunId === "latest").unitResponses.unit, "Ä/β 🧪\nanswer");
  assertGroupDeletionMatchesSnapshot(deletion, snapshot);
});
test("deletion rejects omitted, foreign, duplicate Runs and every inaccurate count", async () => {
  const snapshot = await captureResultGroupSnapshot(fixture().readJson, workspaceUrl, groupKey);
  for (const deletedTestRunIds of [["latest"], ["latest", "monitor-command"], ["latest", "latest"]])
    assert.throws(() => assertGroupDeletionMatchesSnapshot({ ...deletion, deletedTestRunIds }, snapshot));
  for (const field of ["deletedTestRunCount", "deletedResponseCount", "deletedReviewCount", "deletedTestLogCount"])
    assert.throws(() => assertGroupDeletionMatchesSnapshot({ ...deletion, [field]: 0 }, snapshot));
  assert.throws(() => assertGroupDeletionMatchesSnapshot({ ...deletion, groupKeys: ["foreign"] }, snapshot));
});
test("snapshot rejects incomplete or foreign Session/Run inventories", async () => {
  for (const options of [{ incomplete: true }, { wrongGroup: true }, { cappedSessions: true }, { cappedLogs: true }, { foreignLog: true }])
    await assert.rejects(captureResultGroupSnapshot(fixture(options).readJson, workspaceUrl, groupKey));
});
test("removal verifies group-only reports and all Sessions independently", async () => {
  const snapshot = await captureResultGroupSnapshot(fixture().readJson, workspaceUrl, groupKey);
  const after = fixture({ removed: true });
  await assertResultGroupRemoved(after.readJson, snapshot);
  assert.ok(after.reads.some(url => url.endsWith(encodeURIComponent(sessionId))));
  await assert.rejects(assertResultGroupRemoved(fixture().readJson, snapshot));
  await assert.rejects(assertResultGroupRemoved(fixture({ removed: true, retainedLog: true }).readJson, snapshot));
});
test("unselected group retains its exact Unicode answer and historical Run", async () => {
  const snapshot = await captureResultGroupSnapshot(fixture().readJson, workspaceUrl, groupKey);
  await assertResultGroupRetained(fixture().readJson, snapshot);
  for (const options of [{ changeAnswer: true }, { changedReview: true }, { changedLog: true }])
    await assert.rejects(assertResultGroupRetained(fixture(options).readJson, snapshot));
  await assert.rejects(assertResultGroupRetained(fixture({ removed: true }).readJson, snapshot));
});

const snapshotStores = ["memory", "file", "sqlite"];
if (process.env.FIRST_SLICE_STORE === "postgres") {
  assert.ok(process.env.FIRST_SLICE_POSTGRES_URL);
  snapshotStores.push("postgres");
}
for (const {kind,timing} of snapshotStores.flatMap(kind =>
  ["initialized","expired","paused"].map(timing => ({kind,timing})))) {
  const description = {initialized:"follows monitor timer initialization",
    expired:"detects expiry after completed preparation",paused:"holds the owned Run across later timer reads"}[timing];
  test(`${kind}: deletion snapshot ${description}`, async () => {
    const directory = await mkdtemp(join(tmpdir(), "testcenter-deletion-snapshot-"));
    let storage;
    const repository = kind === "memory" ? createInMemoryFirstSliceRepository()
      : kind === "file" ? createFileFirstSliceRepository(join(directory, "own.json"))
      : kind === "sqlite" ? createSqliteFirstSliceRepository(join(directory, "own.sqlite"))
      : (storage = await createPostgresFirstSliceStorage(process.env.FIRST_SLICE_POSTGRES_URL)).repository;
    const createdAt = "2026-10-08T00:00:00.000Z";
    let currentTime = createdAt;
    const services = createFirstSliceServices({ repository, now: () => currentTime });
    const scope = { tenantKey: `snapshot-${randomUUID()}`, workspaceKey: "own-snapshot" };
    const ownUrl = `http://127.0.0.1:4312/api/v1/tenants/${scope.tenantKey}/workspaces/${scope.workspaceKey}`;
    const runIds = [];
    try {
      const tenant = await services.platform.createTenant({ tenantKey: scope.tenantKey, displayName: "Own snapshot" });
      const workspace = await services.platform.createWorkspace({ ...scope, displayName: "Own snapshot" });
      const base = { tenantId: tenant.tenantId, workspaceId: workspace.workspaceId, createdAt };
      const contentReleaseId = randomUUID();
      await repository.saveContentRelease({ ...base, contentReleaseId, importJobId: randomUUID(),
        releaseLabel: "Own timer snapshot", status: "active", activatedAt: createdAt,
        runtimeSnapshot: { bookletEntries: [{ bookletKey: "own-booklet", displayLabel: "Own booklet",
          testletEntries: [{ testletKey: "own-timer", displayLabel: "Own timer",
            restrictions: { timeMax: { minutes: 2, leave: "allowed" } } }],
          unitEntries: [{ unitKey: "unit", displayLabel: "Own Unit", testletPath: ["own-timer"] }] }] } });
      for (const groupKey of ["selected", "retained"]) {
        const participantSessionId = randomUUID();
        const testRunId = randomUUID();
        runIds.push(testRunId);
        await repository.saveParticipantSession({ ...base, contentReleaseId, participantSessionId,
          loginKey: groupKey, groupKey, status: "launched" });
        await repository.saveTestRun({ ...base, contentReleaseId, participantSessionId, testRunId,
          bookletKey: "own-booklet", executionMode: "run-hot-return",
          status: groupKey === "selected" ? "running" : "paused", currentUnitKey: "unit",
          testletTimers: {}, unitResponses: { unit: `Exact ${groupKey} answer: Ä/β 🧪\n\";` },
          updatedAt: createdAt, completedAt: null });
        await repository.saveParticipantTestLogs([{ ...base, participantSessionId, testRunId,
          participantTestLogId: randomUUID(), unitKey: "unit", originalUnitId: "unit",
          logKey: "CURRENT_UNIT", logContent: "unit", timestamp: Date.parse(createdAt), recordedAt: createdAt }]);
      }
      const readJson = async url => {
        const parsed = new URL(url);
        const path = parsed.pathname.slice(new URL(ownUrl).pathname.length);
        const input = { ...scope, groupKey: parsed.searchParams.get("groupKey") ?? undefined,
          limit: Number(parsed.searchParams.get("limit") ?? 100) };
        if (path === "/results/groups") return { items: await services.workspaceAdminRead.listGroupResults(scope) };
        if (path === "/participant-sessions") return { items: await services.workspaceAdminRead.listParticipantSessions(input) };
        if (path.startsWith("/participant-sessions/")) return { participantSessionDetail:
          await services.workspaceAdminRead.getParticipantSessionDetail({ ...scope,
            participantSessionId: decodeURIComponent(path.slice("/participant-sessions/".length)) }) };
        if (path === "/test-logs") return { items: await services.workspaceAdminRead.listParticipantTestLogs(input) };
        if (path === "/responses/detailed") return { items: await services.workspaceAdminRead.listDetailedResponses(input) };
        if (path === "/reviews") return { items: await services.workspaceReview.listReviews(input) };
        throw new Error(`Unexpected own snapshot URL ${url}`);
      };
      const before = await captureResultGroupSnapshot(readJson, ownUrl, "selected");
      const retained = await captureResultGroupSnapshot(readJson, ownUrl, "retained");
      assert.equal(before.logs.length, 1);
      // A real monitor read starts this Run's timed block and appends its log.
      // The earlier snapshot is stale even though no participant wrote an answer.
      await services.monitorRead.listOpenRuns(scope);
      let ready = await captureResultGroupSnapshot(readJson, ownUrl, "selected");
      assert.equal(ready.logs.length, 2);
      const added = ready.logs.filter(row => !before.logs.some(old =>
        old.testLog.participantTestLogId === row.testLog.participantTestLogId));
      assert.equal(added.length, 1);
      assert.equal(added[0].testLog.logKey, "TESTLETS_TIMELEFT");
      assert.equal(ready.testRuns[0].unitResponses.unit, before.testRuns[0].unitResponses.unit);
      const prepared = ready;
      if (timing === "expired") {
        currentTime = "2026-10-08T00:10:00.000Z";
        await services.monitorRead.listOpenRuns(scope);
        ready = await captureResultGroupSnapshot(readJson,ownUrl,"selected");
        assert.equal(ready.logs.length,3,"Later timer expiry adds one real log after preparation.");
        const late = ready.logs.filter(row=>!prepared.logs.some(old=>
          old.testLog.participantTestLogId===row.testLog.participantTestLogId));
        assert.equal(late.length,1);
        assert.equal(late[0].testLog.logKey,"TESTLETS_TIMELEFT");
      }
      if (timing === "paused") {
        const held = await services.monitorControl.issueRunCommand({ ...scope,
          testRunId:runIds[0],commandType:"pause",actorId:"owned-snapshot-operator" });
        assert.equal(held.testRun.testRunId,runIds[0]);
        assert.equal(held.testRun.status,"paused");
        ready = await captureResultGroupSnapshot(readJson,ownUrl,"selected");
        assert.equal(ready.testRuns[0].testletTimers["own-timer"].status,"paused");
        // Advance beyond the original active deadline. A real later monitor
        // read must leave every held log, timer and byte-exact answer intact.
        currentTime = "2026-10-08T00:10:00.000Z";
        await services.monitorRead.listOpenRuns(scope);
        assert.deepEqual(await captureResultGroupSnapshot(readJson,ownUrl,"selected"),ready);
      }
      const removed = await services.workspaceResults.deleteGroupResultsBulk({ ...scope,
        groupKeys: ["selected"], confirmation: scope.workspaceKey });
      assert.throws(() => assertGroupDeletionMatchesSnapshot(removed, before), assert.AssertionError);
      if (timing === "expired") {
        assert.throws(() => assertGroupDeletionMatchesSnapshot(removed,prepared),assert.AssertionError);
      }
      assertGroupDeletionMatchesSnapshot(removed, ready);
      await assertResultGroupRemoved(readJson, ready);
      await assertResultGroupRetained(readJson, retained);
      assert.deepEqual((await repository.listParticipantTestLogsByWorkspace(tenant.tenantId, workspace.workspaceId))
        .filter(log => log.testRunId === runIds[0]), [], "Selected raw logs must all be removed.");
    } finally {
      await repository.deleteTestRunsByIds(runIds);
      await repository.deleteParticipantTestLogsByTestRunIds(runIds);
      await storage?.shutdown();
      await rm(directory, { recursive: true, force: true });
    }
  });
}
