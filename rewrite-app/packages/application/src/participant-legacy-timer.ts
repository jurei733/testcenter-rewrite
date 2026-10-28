import type { TestRun, TestletTimerState } from "@testcenter-rewrite-app/domain";
import type { ParticipantControllerTimerInterruptionRequest, ParticipantNativeCommandRequest } from "@testcenter-rewrite-app/contracts/participant-native-command";

const scopeOf = (run: TestRun) => ({ testRunId: run.testRunId, participantSessionId: run.participantSessionId,
  tenantId: run.tenantId, workspaceId: run.workspaceId, contentReleaseId: run.contentReleaseId,
  bookletKey: run.bookletKey, assignmentKey: run.bookletAssignmentKey || run.bookletKey });
const validDate = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));

/** Keep a causal witness only while its exact resulting timer still exists. */
export const retainedLegacyTimerPreparation = (run: TestRun, timer: TestletTimerState): TestletTimerState["legacyPreparation"] => {
  const witness = timer.legacyPreparation, scope = scopeOf(run);
  if (!witness || typeof witness !== "object" || !witness.scope ||
      !Object.entries(scope).every(([key, value]) => witness.scope[key as keyof typeof scope] === value) ||
      typeof witness.deliveryId !== "string" || !/^[A-Za-z0-9_-]{1,160}$/.test(witness.deliveryId) ||
      typeof witness.payloadSha256 !== "string" || !/^[a-f0-9]{64}$/.test(witness.payloadSha256) ||
      typeof witness.unitKey !== "string" || !witness.unitKey || !witness.before || !witness.after ||
      !validDate(witness.before.startedAt) || !validDate(witness.before.expiresAt) ||
      !validDate(witness.after.startedAt) || !validDate(witness.after.expiresAt) || !validDate(witness.after.updatedAt) ||
      !Number.isSafeInteger(witness.after.durationSeconds) || witness.after.durationSeconds <= 0 ||
      !Number.isSafeInteger(witness.after.remainingSeconds) || witness.after.remainingSeconds < 0 || witness.after.remainingSeconds > witness.after.durationSeconds ||
      timer.status !== "running" || !["startedAt", "expiresAt", "updatedAt", "remainingSeconds", "durationSeconds"].every(key =>
        witness.after[key as keyof typeof witness.after] === timer[key as keyof TestletTimerState])) return undefined;
  return structuredClone(witness);
};

/** A legacy packet remains byte-identical; its server effect supplies the witness. */
export const withLegacyTimerPreparation = (input: { before: TestRun; after: TestRun; request: ParticipantNativeCommandRequest;
  payloadSha256: string; testletKey: string | null }): TestRun => {
  const { before, after, request, payloadSha256, testletKey } = input;
  if (request.controllerDispatch || !["goto", "resume"].includes(request.keyword) || !testletKey ||
      !before.currentUnitKey || before.currentUnitKey !== after.currentUnitKey) return after;
  const previous = before.testletTimers?.[testletKey], current = after.testletTimers?.[testletKey];
  if (!previous || previous.status !== "running" || !current || current.status !== "running" ||
      !validDate(previous.startedAt) || !validDate(previous.expiresAt) || !validDate(current.startedAt) || !validDate(current.expiresAt) ||
      !validDate(current.updatedAt) || JSON.stringify(previous) === JSON.stringify(current)) return after;
  return { ...after, testletTimers: { ...after.testletTimers, [testletKey]: { ...current, legacyPreparation: {
    scope: scopeOf(after), deliveryId: request.deliveryId, payloadSha256, unitKey: after.currentUnitKey!,
    before: { startedAt: previous.startedAt, expiresAt: previous.expiresAt },
    after: { startedAt: current.startedAt, expiresAt: current.expiresAt, updatedAt: current.updatedAt,
      remainingSeconds: current.remainingSeconds, durationSeconds: current.durationSeconds }
  } } } };
};

/** Rebase only a known earlier same-Unit legacy effect, never an arbitrary newer timer. */
export const legacyTimerInterruptionBalance = (input: { run: TestRun; timer: TestletTimerState;
  request: ParticipantControllerTimerInterruptionRequest; payloadSha256: string | undefined; timestamp: string }): number | undefined => {
  const { run, timer, request, payloadSha256, timestamp } = input;
  const witness = retainedLegacyTimerPreparation(run, timer), observedAt = request.observedAt;
  if (!witness || !request.legacyCommand || observedAt === undefined || witness.deliveryId !== request.legacyCommand.deliveryId ||
      witness.payloadSha256 !== payloadSha256 || witness.unitKey !== request.unitKey || run.currentUnitKey !== request.unitKey ||
      witness.before.startedAt !== request.startedAt || witness.before.expiresAt !== request.expiresAt ||
      observedAt < Date.parse(witness.after.updatedAt) || observedAt >= Date.parse(witness.after.expiresAt) || observedAt > Date.parse(timestamp)) return undefined;
  // The real Worker emits its first STEP immediately, including at an exact second.
  return Math.max(0, Math.min(timer.durationSeconds, timer.remainingSeconds,
    Math.ceil((Date.parse(witness.after.expiresAt) - observedAt) / 1_000) - 1));
};
