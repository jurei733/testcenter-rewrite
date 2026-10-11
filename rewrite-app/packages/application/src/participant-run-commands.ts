import {
  monitorRunCommandTypes,
  type ParticipantRunCommand,
  type ParticipantRunCommandInput,
  type ParticipantRunCommandScope,
  type ParticipantRunCommandApplicationInput,
  type ParticipantRunCommandApplicationContext,
  type ParticipantRunCommandApplicationResult,
  type ParticipantRunCommandEffect,
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

export class ParticipantRunCommandApplicationError extends Error {
  constructor(readonly errorCode: "participant_command_not_acknowledged" | "test_run_already_completed", message: string) {
    super(message);
  }
}

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
    actorId: input.actorId, issuedAt: timestamp(input.issuedAt),
    ...(input.effectsDeferred === true ? { effectsDeferred: true as const } : {})
  };
  if (!matchesParticipantRunCommandScope(run, input)) return null;
  const existing = history.existing;
  if (existing) {
    if (Boolean(existing.effectsDeferred) !== Boolean(normalized.effectsDeferred)) {
      throw new Error("Participant command identity cannot be reused for another command.");
    }
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
  return { ...normalized, sequence, acknowledgedAt: null, executedAt: null, executionSequence: null };
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

/** Prepare one application under the store's parent/Run lock; never write here. */
export const prepareParticipantRunCommandApplication = (
  input: ParticipantRunCommandApplicationInput,
  context: ParticipantRunCommandApplicationContext | null,
  lastExecutionSequence: number,
  transform: (context: ParticipantRunCommandApplicationContext) => ParticipantRunCommandEffect
): { result: ParticipantRunCommandApplicationResult; effect: ParticipantRunCommandEffect | null } | null => {
  const executedAt = timestamp(input.executedAt);
  if (!context || !matchesParticipantRunCommandScope(context.testRun, input) ||
      !matchesParticipantRunCommandScope(context.command, input) || context.command.commandId !== input.commandId ||
      context.participantSession.participantSessionId !== input.participantSessionId ||
      context.participantSession.tenantId !== input.tenantId || context.participantSession.workspaceId !== input.workspaceId) return null;
  const { command, testRun, participantSession } = context;
  if (!command.acknowledgedAt) throw new ParticipantRunCommandApplicationError("participant_command_not_acknowledged", "Only an acknowledged participant command may be applied.");
  if (command.executedAt) {
    if (!Number.isSafeInteger(command.executionSequence) || Number(command.executionSequence) < 1) {
      throw new Error("The persisted command application receipt is invalid.");
    }
    return { result: structuredClone({ command, testRun, participantSession, applied: false }), effect: null };
  }
  if (command.executionSequence != null) throw new Error("The persisted command application receipt is invalid.");
  if (testRun.status === "completed") throw new ParticipantRunCommandApplicationError("test_run_already_completed", "A completed Run cannot apply another command.");
  const executionSequence = lastExecutionSequence + 1;
  if (!Number.isSafeInteger(executionSequence) || executionSequence < 1) throw new Error("Participant command application sequence is exhausted.");
  const effect = structuredClone(transform(structuredClone(context)));
  if (new Set(effect.testLogs.map(log => log.participantTestLogId)).size !== effect.testLogs.length ||
      new Set(effect.activityEvents.map(event => event.activityEventId)).size !== effect.activityEvents.length) {
    throw new Error("A participant command effect contains duplicate artifact identities.");
  }
  if (!matchesParticipantRunCommandScope(effect.testRun, input) ||
      effect.testRun.contentReleaseId !== testRun.contentReleaseId || effect.testRun.bookletKey !== testRun.bookletKey ||
      effect.testRun.bookletAssignmentKey !== testRun.bookletAssignmentKey || effect.testRun.createdAt !== testRun.createdAt ||
      effect.testRun.executionMode !== testRun.executionMode ||
      effect.testLogs.some(log => !matchesParticipantRunCommandScope(log, input)) ||
      effect.activityEvents.some(event => event.tenantId !== input.tenantId || event.workspaceId !== input.workspaceId) ||
      effect.participantSession && (effect.participantSession.participantSessionId !== input.participantSessionId ||
        effect.participantSession.tenantId !== input.tenantId || effect.participantSession.workspaceId !== input.workspaceId ||
        Object.keys({ ...participantSession, ...effect.participantSession }).some(key => key !== "status" &&
          effect.participantSession![key as keyof typeof participantSession] !== participantSession[key as keyof typeof participantSession]))) {
    throw new Error("A participant command effect cannot cross its immutable parent scope.");
  }
  const appliedCommand = { ...command, executedAt, executionSequence };
  return { result: structuredClone({ command: appliedCommand, testRun: effect.testRun,
    participantSession: effect.participantSession ?? participantSession, applied: true }), effect };
};
