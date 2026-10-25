import {originalParticipantGroupKeysEqual} from './original-participant-group.js';
import type { ContentRelease, ParticipantSession, TestRun } from "@testcenter-rewrite-app/domain";
import {withOriginalTestRunMode} from './original-person-identity.js';
import { prepareParticipantRunMutation, type ParticipantRunMutationContext,
  type ParticipantRunMutationEffect } from "./participant-run-mutation.js";

export type ParticipantAssignmentRunCreationEffect = Pick<ParticipantRunMutationEffect,
  "testRun" | "participantSession" | "testLogs" | "activityEvents" | "controllerEntryActive" | "originalResultOpenedAt" | "originalResultTestStateAt" | "originalResultModifiedAt">;
export type ParticipantAssignmentRunInitializer = (
  context: ParticipantRunMutationContext
) => ParticipantAssignmentRunCreationEffect;

const assignmentKey = (run: TestRun): string =>
  run.bookletAssignmentKey?.trim() || run.bookletKey.trim();

export type ParticipantInitialContentRelease = Pick<ContentRelease, 'contentReleaseId' | 'tenantId' | 'workspaceId' | 'status'>;

/** Bind only a genuinely unbound native person, under the same writer as its
 * first Test and initial artifacts. Existing/canonical parent scopes stay strict. */
export function bindOriginalPersonContentForFirstTest(candidate: TestRun, session: ParticipantSession | null,
  runs: TestRun[], release?: ParticipantInitialContentRelease | null): ParticipantSession | null {
  if (session?.contentReleaseId !== null) return session;
  if (session.originalLoginKey === undefined || session.originalNameSuffix === undefined || session.status !== 'signed_in' ||
    runs.some(run => run.participantSessionId === session.participantSessionId) || !release || release.status !== 'active' ||
    release.contentReleaseId !== candidate.contentReleaseId || release.tenantId !== session.tenantId || release.workspaceId !== session.workspaceId ||
    candidate.participantSessionId !== session.participantSessionId || candidate.tenantId !== session.tenantId || candidate.workspaceId !== session.workspaceId) {
    throw new Error('A native person can bind content only with its first scoped Test from an active release.');
  }
  return {...session, contentReleaseId: release.contentReleaseId};
}

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
    run.contentReleaseId === candidate.contentReleaseId && (session.originalLoginKey !== undefined &&
      run.originalResultState?.bookletName !== undefined && candidate.originalResultState?.bookletName !== undefined
      ? originalParticipantGroupKeysEqual(run.originalResultState.bookletName, candidate.originalResultState.bookletName)
      : assignmentKey(run) === assignmentKey(candidate));
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
  initialize?: ParticipantAssignmentRunInitializer,
  initialRelease?: ParticipantInitialContentRelease | null
): { testRun: TestRun; created: boolean; effect: ParticipantAssignmentRunCreationEffect | null } => {
  const previousSession = session;
  session = bindOriginalPersonContentForFirstTest(candidate, session, runs, initialRelease);
  candidate=withOriginalTestRunMode(candidate,session);
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
  if (previousSession?.contentReleaseId === null) effect.participantSession = effect.participantSession ?? session!;
  return { testRun: structuredClone(effect.testRun), created: true, effect };
};
