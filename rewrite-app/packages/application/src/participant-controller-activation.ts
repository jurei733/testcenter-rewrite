import type { ParticipantSession, TestRun } from "@testcenter-rewrite-app/domain";

export type ParticipantControllerActivationInput = Pick<TestRun,
  "testRunId" | "participantSessionId" | "tenantId" | "workspaceId" | "contentReleaseId"> & {
  activatedAt: string;
};

export type ParticipantControllerActivationResult = {
  participantSession: ParticipantSession;
  activated: boolean;
};

export class ParticipantControllerActivationError extends Error {
  constructor(readonly statusCode: number, readonly errorCode: string, message: string) {
    super(message);
  }
}

/** Decide under the store's parent/Run lock; never trust an earlier entry snapshot. */
export const prepareParticipantControllerActivation = (
  input: ParticipantControllerActivationInput,
  participantSession: ParticipantSession | null,
  testRun: TestRun | null
): ParticipantControllerActivationResult | null => {
  const timestamp = Date.parse(input.activatedAt);
  if (!Number.isFinite(timestamp)) throw new Error("Controller activation requires a server timestamp.");
  for (const key of ["testRunId", "participantSessionId", "tenantId", "workspaceId", "contentReleaseId"] as const) {
    if (typeof input[key] !== "string" || !input[key].trim()) throw new Error("Controller activation requires scoped identifiers.");
    if (testRun?.[key] !== input[key]) return null;
    if (key !== "testRunId" && participantSession?.[key] !== input[key]) return null;
  }
  if (!participantSession || !testRun) return null;
  if (participantSession.status === "closed") throw new ParticipantControllerActivationError(
    409, "participant_session_closed", "A closed participant session cannot open a controller.");
  if (participantSession.validUntil) {
    const validUntil = Date.parse(participantSession.validUntil);
    if (!Number.isFinite(validUntil)) throw new Error("The persisted participant expiry is invalid.");
    if (validUntil < timestamp) throw new ParticipantControllerActivationError(
      410, "participant_access_expired", "Participant access expired before controller activation.");
  }
  if (testRun.locked) throw new ParticipantControllerActivationError(
    423, "test_run_locked", "A locked Run cannot open a controller.");
  if (testRun.status === "completed") throw new ParticipantControllerActivationError(
    409, "booklet_already_completed", "A completed Run cannot open a controller.");
  return { participantSession: structuredClone({ ...participantSession, status: "launched" }),
    activated: participantSession.status !== "launched" };
};
