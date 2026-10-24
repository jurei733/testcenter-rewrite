import assert from "node:assert/strict";
import test from "node:test";
import type { TestRun } from "@testcenter-rewrite-app/domain";
import { withParticipantRunRevision } from "./participant-run-revision.js";

const run: TestRun = { testRunId: "owned", participantSessionId: "session", tenantId: "tenant", workspaceId: "workspace",
  contentReleaseId: "release", bookletKey: "booklet", status: "running", currentUnitKey: "unit", unitResponses: { unit: "Exact answer Ω" },
  createdAt: "2026-10-13T00:00:00.000Z", updatedAt: "2026-10-13T00:00:00.000Z", completedAt: null };
test("only a changed Run snapshot advances the locked revision; projected revisions are never authority", () => {
  assert.deepEqual(withParticipantRunRevision(run, { ...run, stateRevision: 999 }), run);
  const first = withParticipantRunRevision(run, { ...run, status: "paused" });
  assert.equal(first.stateRevision, 1);
  const { unitResponses, ...rest } = first;
  assert.deepEqual(withParticipantRunRevision(first, { unitResponses, ...rest, pauseSource: undefined }), first);
  const second = withParticipantRunRevision(first, { ...first, stateRevision: 999, unitResponses: { unit: "New answer β" } });
  assert.equal(second.stateRevision, 2);assert.equal(first.unitResponses.unit, run.unitResponses.unit);
});
test("invalid or exhausted persisted revisions reject a changed snapshot", () => {
  for (const revision of [0, -1, NaN, Infinity, 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    assert.throws(() => withParticipantRunRevision({ ...run, stateRevision: revision }, { ...run, status: "paused" }), /revision is invalid/);
  }
  const last = { ...run, stateRevision: Number.MAX_SAFE_INTEGER };
  assert.deepEqual(withParticipantRunRevision(last, last), last);
  assert.throws(() => withParticipantRunRevision(last, { ...last, status: "paused" }), /revision is exhausted/);
});
