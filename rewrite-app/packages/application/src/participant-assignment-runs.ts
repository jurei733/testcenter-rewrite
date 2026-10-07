import type { ParticipantSession, TestRun } from "@testcenter-rewrite-app/domain";

const assignmentKey = (run: TestRun): string =>
  run.bookletAssignmentKey?.trim() || run.bookletKey.trim();

/** Pure reservation decision, executed inside each store's atomic boundary. */
export const selectParticipantAssignmentRun = (
  candidate: TestRun,
  session: ParticipantSession | null,
  runs: TestRun[]
): TestRun | null => {
  if (!session || session.participantSessionId !== candidate.participantSessionId ||
      session.tenantId !== candidate.tenantId || session.workspaceId !== candidate.workspaceId ||
      session.contentReleaseId !== candidate.contentReleaseId || !assignmentKey(candidate)) {
    throw new Error("Participant session scope does not match the assignment reservation.");
  }
  const ownsAssignment = (run: TestRun): boolean =>
    run.participantSessionId === candidate.participantSessionId &&
    run.tenantId === candidate.tenantId && run.workspaceId === candidate.workspaceId &&
    run.contentReleaseId === candidate.contentReleaseId && assignmentKey(run) === assignmentKey(candidate);
  if (runs.some(run => run.testRunId === candidate.testRunId && !ownsAssignment(run))) {
    throw new Error("Run ID already exists outside the participant assignment reservation.");
  }
  // Retain completed/locked/paused runs as-is. Choosing/resuming an authorized
  // run and enforcing its lifecycle remain application-controller decisions.
  return runs.filter(ownsAssignment).sort((left, right) =>
    right.updatedAt.localeCompare(left.updatedAt) || right.testRunId.localeCompare(left.testRunId)
  )[0] ?? null;
};
