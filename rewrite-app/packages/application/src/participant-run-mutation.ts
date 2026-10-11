import type { ParticipantSession, ParticipantRunCommandEffect, ParticipantRunCommandInput, TestRun } from "@testcenter-rewrite-app/domain";
import { matchesParticipantRunCommandScope } from "./participant-run-commands.js";

export type ParticipantRunMutationInput = Pick<TestRun,
  "testRunId" | "participantSessionId" | "tenantId" | "workspaceId" | "contentReleaseId">;
export type ParticipantRunMutationContext = {
  testRun: TestRun;
  participantSession: ParticipantSession;
  testRuns: TestRun[];
};
export type ParticipantRunMutationEffect = ParticipantRunCommandEffect & {
  /** Queue an intent in the same transaction as its Run projection and audit. */
  commandInput?: ParticipantRunCommandInput;
};
export type ParticipantRunMutationResult = {
  testRun: TestRun;
  participantSession: ParticipantSession;
  applied: boolean;
};

/** Pure projection called only after the store has locked and read the current parent/Run. */
export const prepareParticipantRunMutation = (
  input: ParticipantRunMutationInput,
  context: ParticipantRunMutationContext | null,
  transform: (context: ParticipantRunMutationContext) => ParticipantRunMutationEffect | null
): { result: ParticipantRunMutationResult; effect: ParticipantRunMutationEffect | null } | null => {
  for (const key of ["testRunId", "participantSessionId", "tenantId", "workspaceId", "contentReleaseId"] as const) {
    const value = input[key];
    if (typeof value !== "string" || !value.trim()) throw new Error("Participant Run mutations require non-empty scoped identifiers.");
  }
  if (!context || !matchesParticipantRunCommandScope(context.testRun, input) ||
    context.testRun.contentReleaseId !== input.contentReleaseId ||
    context.participantSession.participantSessionId !== input.participantSessionId ||
    context.participantSession.tenantId !== input.tenantId || context.participantSession.workspaceId !== input.workspaceId ||
    context.participantSession.contentReleaseId !== input.contentReleaseId) return null;
  const { testRun, participantSession } = context;
  const effect = structuredClone(transform(structuredClone(context)));
  if (effect && (!matchesParticipantRunCommandScope(effect.testRun, input) ||
    effect.testRun.contentReleaseId !== testRun.contentReleaseId || effect.testRun.bookletKey !== testRun.bookletKey ||
    effect.testRun.bookletAssignmentKey !== testRun.bookletAssignmentKey || effect.testRun.executionMode !== testRun.executionMode ||
    effect.testRun.createdAt !== testRun.createdAt || effect.testLogs.some(log => !matchesParticipantRunCommandScope(log, input)) ||
    effect.activityEvents.some(event => event.tenantId !== input.tenantId || event.workspaceId !== input.workspaceId) ||
    effect.commandInput && !matchesParticipantRunCommandScope(effect.commandInput, input) ||
    effect.participantSession && Object.keys({ ...participantSession, ...effect.participantSession }).some(key => key !== "status" &&
      effect.participantSession![key as keyof ParticipantSession] !== participantSession[key as keyof ParticipantSession]))) {
    throw new Error("A participant Run mutation cannot cross its immutable parent scope.");
  }
  return { result: structuredClone({ testRun: effect?.testRun ?? testRun,
    participantSession: effect?.participantSession ?? participantSession, applied: effect !== null }), effect };
};
