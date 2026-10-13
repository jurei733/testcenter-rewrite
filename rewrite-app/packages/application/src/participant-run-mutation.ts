import type { ParticipantSession, ParticipantRunCommandEffect, ParticipantRunCommandInput,
  ParticipantProgressDelivery, TestRun } from "@testcenter-rewrite-app/domain";
import { matchesParticipantRunCommandScope } from "./participant-run-commands.js";
import { withParticipantControllerEntry } from "./participant-controller-entry.js";
import { withParticipantRunRevision } from "./participant-run-revision.js";
import { withParticipantControllerDispatch, participantControllerDispatchSuperseded } from "./participant-controller-dispatch.js";

export type ParticipantRunMutationInput = Pick<TestRun,
  "testRunId" | "participantSessionId" | "tenantId" | "workspaceId" | "contentReleaseId"> & { deliveryId?: string };
export type ParticipantRunMutationContext = {
  testRun: TestRun;
  participantSession: ParticipantSession;
  testRuns: TestRun[];
  progressDelivery?: ParticipantProgressDelivery | null;
};
export type ParticipantRunMutationEffect = ParticipantRunCommandEffect & {
  /** Queue an intent in the same transaction as its Run projection and audit. */
  commandInput?: ParticipantRunCommandInput;
  progressDelivery?: ParticipantProgressDelivery;
};
export type ParticipantRunMutationResult = {
  superseded?: true;
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
  if (input.deliveryId !== undefined && (typeof input.deliveryId !== "string" || !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(input.deliveryId))) {
    throw new Error("Participant progress mutations require a valid scoped delivery identifier.");
  }
  if (!context || !matchesParticipantRunCommandScope(context.testRun, input) ||
    context.testRun.contentReleaseId !== input.contentReleaseId ||
    context.participantSession.participantSessionId !== input.participantSessionId ||
    context.participantSession.tenantId !== input.tenantId || context.participantSession.workspaceId !== input.workspaceId ||
    context.participantSession.contentReleaseId !== input.contentReleaseId ||
    context.progressDelivery && (!matchesParticipantRunCommandScope(context.progressDelivery, input) ||
      context.progressDelivery.contentReleaseId !== input.contentReleaseId || context.progressDelivery.deliveryId !== input.deliveryId)) return null;
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
  const receipt = effect?.progressDelivery;
  if (receipt && (!matchesParticipantRunCommandScope(receipt, input) || receipt.contentReleaseId !== input.contentReleaseId ||
    receipt.deliveryId !== input.deliveryId || typeof receipt.payloadSha256 !== "string" || !/^[a-f0-9]{64}$/.test(receipt.payloadSha256) ||
    typeof receipt.acceptedAt !== "string" || !Number.isFinite(Date.parse(receipt.acceptedAt)) || context.progressDelivery &&
      Object.keys({ ...context.progressDelivery, ...receipt }).some(key =>
        receipt[key as keyof ParticipantProgressDelivery] !== context.progressDelivery![key as keyof ParticipantProgressDelivery]))) {
    throw new Error("A progress delivery cannot change its accepted identity or cross its immutable parent scope.");
  }
  if (effect && participantControllerDispatchSuperseded(testRun, effect.controllerDispatch)) {
    effect.testRun = testRun; delete effect.participantSession; delete effect.controllerEntryActive;
    effect.testLogs = effect.testLogs.filter(log => log.logKey === "command executed"); effect.activityEvents = []; effect.superseded = true;
  }
  if (effect) effect.testRun = withParticipantRunRevision(testRun,
    withParticipantControllerDispatch(testRun, withParticipantControllerEntry(testRun, effect.testRun, effect.controllerEntryActive), effect.controllerDispatch));
  return { result: structuredClone({ testRun: effect?.testRun ?? testRun,
    participantSession: effect?.participantSession ?? participantSession, applied: effect !== null,
    ...(effect?.superseded ? { superseded: true as const } : {}) }), effect };
};
