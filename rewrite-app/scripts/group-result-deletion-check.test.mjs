import assert from "node:assert/strict";
import test from "node:test";
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
