import { randomUUID } from "node:crypto";

import type { BookletAssignment, BookletDefinition, ContentRelease } from "./content.js";
import type { ParticipantSession } from "./participant.js";

export type TestRunStatus = "active" | "paused" | "completed" | "timed_out";

const openTestRunStatuses: TestRunStatus[] = ["active", "paused"];

export interface TestRun {
  testRunId: string;
  participantSessionId: string;
  tenantId: string;
  workspaceId: string;
  contentReleaseId: string;
  loginKey: string;
  groupKey: string;
  assignmentKey: string;
  attemptNumber: number;
  bookletKey: string;
  bookletTitle: string;
  status: TestRunStatus;
  unitSequence: string[];
  currentUnitIndex: number;
  currentUnitKey: string;
  navigationLocked: boolean;
  timeLimitSeconds: number | null;
  pauseAccumulatedMs: number;
  pausedAt: string | null;
  launchApprovalId: string | null;
  launchApprovalScope: "single_launch" | "session_assignment" | null;
  launchApprovedBySupervisorId: string | null;
  launchApprovalNote: string | null;
  launchApprovedAt: string | null;
  initialStateOverrides: Record<string, string>;
  unitResponses: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

const resolveAssignment = (
  contentRelease: ContentRelease,
  loginKey: string,
  assignmentKey: string
): BookletAssignment | undefined =>
  contentRelease.canonicalSnapshot.bookletAssignments.find(assignment =>
    assignment.loginKey === loginKey &&
    assignment.assignmentKey === assignmentKey
  );

const resolveBooklet = (
  contentRelease: ContentRelease,
  bookletKey: string
): BookletDefinition | undefined =>
  contentRelease.canonicalSnapshot.bookletDefinitions.find(booklet => booklet.bookletKey === bookletKey);

export const createTestRun = (input: {
  participantSession: ParticipantSession;
  contentRelease: ContentRelease;
  assignmentKey: string;
  attemptNumber: number;
  launchApproval?: {
    launchApprovalId: string;
    approvalScope: "single_launch" | "session_assignment";
    approvedBySupervisorId: string;
    approvalNote: string;
    approvedAt: string;
  };
}): TestRun | undefined => {
  const assignment = resolveAssignment(input.contentRelease, input.participantSession.loginKey, input.assignmentKey);

  if (!assignment) {
    return undefined;
  }

  const booklet = resolveBooklet(input.contentRelease, assignment.bookletKey);

  if (!booklet || booklet.unitKeys.length === 0) {
    return undefined;
  }

  return {
    testRunId: `test-run-${randomUUID()}`,
    participantSessionId: input.participantSession.participantSessionId,
    tenantId: input.participantSession.tenantId,
    workspaceId: input.participantSession.workspaceId,
    contentReleaseId: input.participantSession.contentReleaseId,
    loginKey: input.participantSession.loginKey,
    groupKey: input.participantSession.groupKey,
    assignmentKey: assignment.assignmentKey,
    attemptNumber: input.attemptNumber,
    bookletKey: booklet.bookletKey,
    bookletTitle: booklet.title,
    status: "active",
    unitSequence: booklet.unitKeys,
    currentUnitIndex: 0,
    currentUnitKey: booklet.unitKeys[0],
    navigationLocked: booklet.runPolicy.navigationLocked,
    timeLimitSeconds: booklet.runPolicy.timeLimitSeconds,
    pauseAccumulatedMs: 0,
    pausedAt: null,
    launchApprovalId: input.launchApproval?.launchApprovalId ?? null,
    launchApprovalScope: input.launchApproval?.approvalScope ?? null,
    launchApprovedBySupervisorId: input.launchApproval?.approvedBySupervisorId ?? null,
    launchApprovalNote: input.launchApproval?.approvalNote ?? null,
    launchApprovedAt: input.launchApproval?.approvedAt ?? null,
    initialStateOverrides: assignment.initialStateOverrides,
    unitResponses: {},
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completedAt: null
  };
};

export const isOpenTestRun = (testRun: TestRun): boolean => openTestRunStatuses.includes(testRun.status);

const getElapsedActiveMs = (testRun: TestRun, now = Date.now()): number => {
  const createdAtMs = Date.parse(testRun.createdAt);
  const pausedAtMs = testRun.pausedAt ? Date.parse(testRun.pausedAt) : null;
  const currentPauseMs = testRun.status === "paused" && pausedAtMs ? Math.max(0, now - pausedAtMs) : 0;

  return Math.max(0, now - createdAtMs - testRun.pauseAccumulatedMs - currentPauseMs);
};

export const getTimeRemainingSeconds = (testRun: TestRun, now = Date.now()): number | null => {
  if (testRun.timeLimitSeconds === null) {
    return null;
  }

  const remainingMs = (testRun.timeLimitSeconds * 1000) - getElapsedActiveMs(testRun, now);
  return Math.max(0, Math.ceil(remainingMs / 1000));
};

export const expireTestRunIfNeeded = (testRun: TestRun, now = Date.now()): TestRun => {
  if (testRun.status !== "active" || testRun.timeLimitSeconds === null) {
    return testRun;
  }

  if (getTimeRemainingSeconds(testRun, now) !== 0) {
    return testRun;
  }

  const timedOutAt = new Date(now).toISOString();

  return {
    ...testRun,
    status: "timed_out",
    updatedAt: timedOutAt,
    completedAt: timedOutAt
  };
};

export const saveTestRunUnitResponse = (input: {
  testRun: TestRun;
  unitKey: string;
  response: unknown;
}): TestRun | undefined => {
  if (input.testRun.status !== "active") {
    return undefined;
  }

  if (input.unitKey !== input.testRun.currentUnitKey) {
    return undefined;
  }

  if (!input.testRun.unitSequence.includes(input.unitKey)) {
    return undefined;
  }

  return {
    ...input.testRun,
    unitResponses: {
      ...input.testRun.unitResponses,
      [input.unitKey]: input.response
    },
    updatedAt: new Date().toISOString()
  };
};

const resolveMaxReachableUnitIndex = (testRun: TestRun): number => {
  let contiguousSavedPrefixLength = 0;

  for (const unitKey of testRun.unitSequence) {
    if (!(unitKey in testRun.unitResponses)) {
      break;
    }

    contiguousSavedPrefixLength += 1;
  }

  return Math.min(
    testRun.unitSequence.length - 1,
    Math.max(testRun.currentUnitIndex, contiguousSavedPrefixLength)
  );
};

export const navigateTestRunToUnit = (
  testRun: TestRun,
  targetUnitKey: string
): TestRun | undefined => {
  if (testRun.status !== "active" || testRun.navigationLocked) {
    return undefined;
  }

  const targetIndex = testRun.unitSequence.indexOf(targetUnitKey);

  if (targetIndex === -1 || targetIndex > resolveMaxReachableUnitIndex(testRun)) {
    return undefined;
  }

  return {
    ...testRun,
    currentUnitIndex: targetIndex,
    currentUnitKey: targetUnitKey,
    updatedAt: new Date().toISOString()
  };
};

export const advanceTestRunToNextUnit = (testRun: TestRun): TestRun | undefined => {
  if (testRun.status !== "active") {
    return undefined;
  }

  if (!(testRun.currentUnitKey in testRun.unitResponses)) {
    return undefined;
  }

  const nextIndex = testRun.currentUnitIndex + 1;

  if (nextIndex >= testRun.unitSequence.length) {
    const completedAt = new Date().toISOString();

    return {
      ...testRun,
      status: "completed",
      updatedAt: completedAt,
      completedAt
    };
  }

  return {
    ...testRun,
    currentUnitIndex: nextIndex,
    currentUnitKey: testRun.unitSequence[nextIndex],
    updatedAt: new Date().toISOString()
  };
};

export const pauseTestRun = (testRun: TestRun, now = new Date().toISOString()): TestRun | undefined => {
  if (testRun.status !== "active") {
    return undefined;
  }

  return {
    ...testRun,
    status: "paused",
    pausedAt: now,
    updatedAt: now
  };
};

export const resumeTestRun = (testRun: TestRun, now = Date.now()): TestRun | undefined => {
  if (testRun.status !== "paused" || !testRun.pausedAt) {
    return undefined;
  }

  const resumedAt = new Date(now).toISOString();
  const pausedAtMs = Date.parse(testRun.pausedAt);

  return {
    ...testRun,
    status: "active",
    pauseAccumulatedMs: testRun.pauseAccumulatedMs + Math.max(0, now - pausedAtMs),
    pausedAt: null,
    updatedAt: resumedAt
  };
};

export const unlockTestRunNavigation = (testRun: TestRun): TestRun | undefined => {
  if (!isOpenTestRun(testRun) || !testRun.navigationLocked) {
    return undefined;
  }

  return {
    ...testRun,
    navigationLocked: false,
    updatedAt: new Date().toISOString()
  };
};
