import assert from "node:assert/strict";
import test from "node:test";

import type { TestRun } from "@testcenter-rewrite-app/domain";

import { createSqliteFirstSliceRepository } from "./index.js";

test("SQLite preserves whole-test locks through every run lookup", async () => {
  const repository = createSqliteFirstSliceRepository(":memory:");
  const testRun: TestRun = {
    testRunId: "run-locked",
    participantSessionId: "session-locked",
    tenantId: "tenant-locked",
    workspaceId: "workspace-locked",
    contentReleaseId: "release-locked",
    bookletKey: "booklet-locked",
    executionMode: "run-hot-return",
    bookletAssignmentKey: "booklet-locked",
    status: "paused",
    locked: true,
    currentUnitKey: "unit-locked",
    unitResponses: {},
    presetBookletStates: {},
    bookletStates: {},
    bookletStateOverrides: {},
    unlockedTestletKeys: [],
    monitorNavigationUnlocked: false,
    testletTimers: {},
    lockedTestletKeys: [],
    lockedUnitKeys: [],
    createdAt: "2026-08-03T00:00:00.000Z",
    updatedAt: "2026-08-03T00:00:00.000Z",
    completedAt: null
  };

  await repository.saveTestRun(testRun);

  assert.equal((await repository.getTestRunById(testRun.testRunId))?.locked, true);
  assert.equal(
    (await repository.listTestRunsByParticipantSessionId(testRun.participantSessionId))[0]
      ?.locked,
    true
  );
  assert.equal(
    (await repository.getOpenTestRunByParticipantSessionId(testRun.participantSessionId))
      ?.locked,
    true
  );
  assert.equal(
    (await repository.listTestRunsByWorkspace(testRun.tenantId, testRun.workspaceId))[0]
      ?.locked,
    true
  );
});
