import {
  monitorRunCommandTypes,
  type ParticipantRunCommand,
  type ParticipantRunCommandInput,
  type ParticipantRunCommandScope,
  type TestRun
} from "@testcenter-rewrite-app/domain";

export const matchesParticipantRunCommandScope = (
  value: ParticipantRunCommandScope | null | undefined,
  scope: ParticipantRunCommandScope
): boolean => Boolean(value && value.testRunId === scope.testRunId &&
  value.participantSessionId === scope.participantSessionId &&
  value.tenantId === scope.tenantId && value.workspaceId === scope.workspaceId);

const timestamp = (value: string): string => {
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new Error("Participant commands require a valid server timestamp.");
  }
  return new Date(value).toISOString();
};

/** Called inside the store's serialized write/Run lock. */
export const appendParticipantRunCommand = (
  input: ParticipantRunCommandInput,
  run: TestRun | null,
  history: { existing: ParticipantRunCommand | null; lastSequence: number }
): ParticipantRunCommand | null => {
  for (const key of ["tenantId", "workspaceId", "participantSessionId", "testRunId", "commandId"] as const) {
    if (typeof input[key] !== "string" || !input[key].trim()) {
      throw new Error("Participant commands require non-empty scoped identifiers.");
    }
  }
  if (!monitorRunCommandTypes.includes(input.commandType) ||
    (input.targetUnitKey !== null && (typeof input.targetUnitKey !== "string" || !input.targetUnitKey.trim())) ||
    (input.remainingSeconds !== null && (!Number.isSafeInteger(input.remainingSeconds) || input.remainingSeconds <= 0)) ||
    (input.actorId !== null && typeof input.actorId !== "string")) {
    throw new Error("Participant commands require valid command parameters.");
  }
  const normalized: ParticipantRunCommandInput = {
    tenantId: input.tenantId, workspaceId: input.workspaceId,
    participantSessionId: input.participantSessionId, testRunId: input.testRunId,
    commandId: input.commandId, commandType: input.commandType,
    targetUnitKey: input.targetUnitKey, remainingSeconds: input.remainingSeconds,
    actorId: input.actorId, issuedAt: timestamp(input.issuedAt)
  };
  if (!matchesParticipantRunCommandScope(run, input)) return null;
  const existing = history.existing;
  if (existing) {
    for (const key of Object.keys(normalized) as Array<keyof ParticipantRunCommandInput>) {
      if (existing[key] !== normalized[key]) {
        throw new Error("Participant command identity cannot be reused for another command.");
      }
    }
    return structuredClone(existing);
  }
  if (run!.status === "completed") return null;
  const sequence = history.lastSequence + 1;
  if (!Number.isSafeInteger(sequence) || sequence <= 0) throw new Error("Participant command sequence is exhausted.");
  return { ...normalized, sequence, acknowledgedAt: null };
};

/** Idempotent receipt under the same scope and store lock as enqueueing. */
export const acknowledgeParticipantRunCommand = (
  input: ParticipantRunCommandScope & { commandId: string; acknowledgedAt: string },
  run: TestRun | null,
  command: ParticipantRunCommand | null
): ParticipantRunCommand | null => {
  const acknowledgedAt = timestamp(input.acknowledgedAt);
  if (!matchesParticipantRunCommandScope(run, input) ||
    !matchesParticipantRunCommandScope(command, input) || command?.commandId !== input.commandId) return null;
  return structuredClone(command!.acknowledgedAt ? command! : { ...command!, acknowledgedAt });
};
