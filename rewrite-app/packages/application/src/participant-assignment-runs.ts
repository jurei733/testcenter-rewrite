import type { ParticipantSession, TestRun } from "@testcenter-rewrite-app/domain";
import { prepareParticipantRunMutation, type ParticipantRunMutationContext,
  type ParticipantRunMutationEffect } from "./participant-run-mutation.js";

export type ParticipantAssignmentRunCreationEffect = Pick<ParticipantRunMutationEffect,
  "testRun" | "participantSession" | "testLogs" | "activityEvents" | "controllerEntryActive">;
export type ParticipantAssignmentRunInitializer = (
  context: ParticipantRunMutationContext
) => ParticipantAssignmentRunCreationEffect;

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

/** Initialize only the reservation winner, against the current locked parent. */
export const prepareParticipantAssignmentRunCreation = (
  candidate: TestRun,
  session: ParticipantSession | null,
  runs: TestRun[],
  initialize?: ParticipantAssignmentRunInitializer
): { testRun: TestRun; created: boolean; effect: ParticipantAssignmentRunCreationEffect | null } => {
  const existing = selectParticipantAssignmentRun(candidate, session, runs);
  if (existing) return { testRun: structuredClone(existing), created: false, effect: null };
  const prepared = prepareParticipantRunMutation(candidate, {
    testRun: candidate, participantSession: session!,
    testRuns: [...runs.filter(run => run.participantSessionId === candidate.participantSessionId &&
      run.tenantId === candidate.tenantId && run.workspaceId === candidate.workspaceId &&
      run.contentReleaseId === candidate.contentReleaseId), candidate]
  }, context => initialize ? initialize(context) : { testRun: context.testRun, testLogs: [], activityEvents: [] });
  const effect = prepared?.effect;
  if (!effect || effect.commandInput !== undefined || effect.progressDelivery !== undefined ||
    new Set(effect.testLogs.map(log => log.participantTestLogId)).size !== effect.testLogs.length ||
    new Set(effect.activityEvents.map(event => event.activityEventId)).size !== effect.activityEvents.length ||
    effect.activityEvents.some(event => event.subjectType !== "test_run" || event.subjectId !== candidate.testRunId)) {
    throw new Error("A participant assignment initializer requires scoped, unique initial artifacts without commands or deliveries.");
  }
  return { testRun: structuredClone(effect.testRun), created: true, effect };
};
