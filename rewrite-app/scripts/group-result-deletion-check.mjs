import assert from "node:assert/strict";

const ordered = rows => [...rows].sort((left, right) =>
  JSON.stringify(left).localeCompare(JSON.stringify(right))
);

// Use all Runs from each authorized Session detail, not only the latest Run
// or saved-response rows. Zero-response and historical Runs must count too.
export async function captureResultGroupSnapshot(readJson, workspaceUrl, groupKey) {
  const inventory = await readJson(`${workspaceUrl}/results/groups`);
  const summary = inventory.items.find(item => item.groupKey === groupKey);
  assert.ok(summary, `Expected result inventory for group ${groupKey}.`);
  const query = new URLSearchParams({ groupKey, limit: "500" });
  const sessions = (await readJson(`${workspaceUrl}/participant-sessions?${query}`)).items;
  assert.ok(sessions.length < 500, "Fixture Session inventory must not reach its read limit.");
  const sessionIds = [];
  const testRuns = [];
  const reviews = [];
  for (const item of sessions) {
    const session = item.participantSession;
    assert.equal(session.groupKey, groupKey);
    const detail = (await readJson(
      `${workspaceUrl}/participant-sessions/${encodeURIComponent(session.participantSessionId)}`
    )).participantSessionDetail;
    assert.equal(detail.participantSession.participantSessionId, session.participantSessionId);
    assert.equal(detail.participantSession.groupKey, groupKey);
    sessionIds.push(session.participantSessionId);
    for (const run of detail.testRuns) {
      assert.equal(run.participantSessionId, session.participantSessionId);
      testRuns.push(run);
    }
    reviews.push(...detail.reviews);
  }
  const testRunIds = testRuns.map(run => run.testRunId).sort();
  assert.equal(new Set(testRunIds).size, testRunIds.length, "Duplicate fixture Run IDs.");
  assert.equal(testRuns.length, summary.bookletsStarted, "Incomplete group Run inventory.");
  assert.equal(testRuns.reduce((count, run) => count + Object.keys(run.unitResponses).length, 0),
    summary.responseCount, "Incomplete group response inventory.");
  assert.equal(reviews.length, summary.reviewCount, "Incomplete group review inventory.");
  for (const review of reviews)
    assert.ok(testRunIds.includes(review.testRunId), "Review belongs to an unselected Run.");
  const logs = (await readJson(`${workspaceUrl}/test-logs?${query}`)).items;
  assert.ok(logs.length < 500, "Fixture log inventory must not reach its read limit.");
  assert.equal(logs.length, summary.testLogCount, "Incomplete group log inventory.");
  for (const log of logs) {
    assert.equal(log.groupKey, groupKey);
    assert.ok(testRunIds.includes(log.testLog.testRunId), "Log belongs to an unselected Run.");
  }
  return { workspaceUrl, groupKey, summary, sessionIds: sessionIds.sort(), testRunIds,
    testRuns: ordered(testRuns), reviews: ordered(reviews), logs: ordered(logs) };
}

export function assertGroupDeletionMatchesSnapshot(deletion, snapshot) {
  assert.deepEqual(deletion.groupKeys, [snapshot.groupKey]);
  assert.deepEqual([...deletion.deletedTestRunIds].sort(), snapshot.testRunIds,
    "DELETE must remove exactly the selected group's Runs.");
  assert.equal(deletion.deletedTestRunCount, snapshot.summary.bookletsStarted);
  assert.equal(deletion.deletedResponseCount, snapshot.summary.responseCount);
  assert.equal(deletion.deletedReviewCount, snapshot.summary.reviewCount);
  assert.equal(deletion.deletedTestLogCount, snapshot.summary.testLogCount);
}

export async function assertResultGroupRemoved(readJson, snapshot) {
  const inventory = await readJson(`${snapshot.workspaceUrl}/results/groups`);
  assert.ok(!inventory.items.some(item => item.groupKey === snapshot.groupKey));
  // No unrelated Run filter: intersecting the selected group with a foreign
  // Run could return an empty report even before any deletion happened.
  const query = new URLSearchParams({ groupKey: snapshot.groupKey, limit: "1" });
  for (const report of ["responses/detailed", "reviews", "test-logs"]) {
    assert.deepEqual((await readJson(`${snapshot.workspaceUrl}/${report}?${query}`)).items, []);
  }
  for (const sessionId of snapshot.sessionIds) {
    const detail = (await readJson(
      `${snapshot.workspaceUrl}/participant-sessions/${encodeURIComponent(sessionId)}`
    )).participantSessionDetail;
    assert.deepEqual(detail.testRuns, []);
    assert.deepEqual(detail.reviews, []);
    assert.equal(detail.responseCount, 0);
    assert.equal(detail.reviewCount, 0);
  }
}

export async function assertResultGroupRetained(readJson, snapshot) {
  assert.deepEqual(await captureResultGroupSnapshot(
    readJson, snapshot.workspaceUrl, snapshot.groupKey
  ), snapshot, "Unselected group's exact Runs, answers, reviews and logs must survive.");
}
