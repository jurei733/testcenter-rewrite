import type { ParticipantControllerDispatch, ParticipantRunCommandScope, ParticipantSession, TestRun } from "@testcenter-rewrite-app/domain";

export const isParticipantControllerDispatch = (value: unknown): value is ParticipantControllerDispatch => {
  const dispatch = value as ParticipantControllerDispatch | null;
  return Boolean(dispatch && typeof dispatch.controllerId === "string" && /^[A-Za-z0-9_-]{1,160}$/.test(dispatch.controllerId) &&
    Number.isSafeInteger(dispatch.sequence) && dispatch.sequence >= 1);
};
export const isParticipantControllerDispatches = (value: unknown): value is Record<string, number> => Boolean(value &&
  typeof value === "object" && !Array.isArray(value) && Object.entries(value).every(([controllerId, sequence]) =>
    isParticipantControllerDispatch({ controllerId, sequence })));

export const participantNativeCommandRoute = "/api/v1/participant/sessions/:participantSessionId/native-commands";
export const participantControllerContextRoute = "/api/v1/participant/sessions/:participantSessionId/controller-context";
export const participantCommandCompletionRoute = "/api/v1/participant/sessions/:participantSessionId/command-completions";
export type ParticipantCommandCompletionRequest = {
  testRunId: string;
  contentReleaseId: string;
  bookletKey: string;
  timeStamp: number;
  command: { kind: "native"; request: ParticipantNativeCommandRequest } | { kind: "remote"; commandId: string };
};
export type ParticipantCommandCompletionResult = ParticipantCommandCompletionRequest & {
  scope: ParticipantRunCommandScope & { contentReleaseId: string; bookletKey: string };
  acceptedAt: string;
  applied: boolean;
};
export const isParticipantCommandCompletionRequest = (value: unknown): value is ParticipantCommandCompletionRequest => {
  const packet = value as ParticipantCommandCompletionRequest | null;
  if (!packet || typeof packet !== "object" || Array.isArray(packet) ||
    Object.keys(packet).some(key => !["testRunId", "contentReleaseId", "bookletKey", "timeStamp", "command"].includes(key)) ||
    !["testRunId", "contentReleaseId", "bookletKey"].every(key => typeof packet[key as "testRunId"] === "string" && Boolean(packet[key as "testRunId"].trim())) ||
    !Number.isSafeInteger(packet.timeStamp) || packet.timeStamp < 0 || !Number.isFinite(new Date(packet.timeStamp).getTime())) return false;
  const command = packet.command;
  if (command?.kind === "remote") return Object.keys(command).every(key => ["kind", "commandId"].includes(key)) &&
    typeof command.commandId === "string" && Boolean(command.commandId.trim()) && command.commandId.length <= 160;
  if (command?.kind !== "native") return false;
  const request = command.request;
  return Boolean(request && request.commandCompletion === "browser-v1" &&
    Object.keys(command).every(key => ["kind", "request"].includes(key)) &&
    Object.keys(request).every(key => ["commandCompletion", "terminationNoop", "controllerDispatch", "testRunId", "contentReleaseId", "bookletKey", "deliveryId", "keyword", "arguments", "controllerStatus", "timeStamp"].includes(key)) &&
    ["testRunId", "contentReleaseId", "bookletKey"].every(key => request[key as "testRunId"] === packet[key as "testRunId"]) &&
    typeof request.deliveryId === "string" && /^[A-Za-z0-9_-]{1,160}$/.test(request.deliveryId) &&
    participantNativeCommandKeywords.includes(request.keyword) && Array.isArray(request.arguments) && request.arguments.every(value => typeof value === "string") &&
    Number.isSafeInteger(request.timeStamp) && request.timeStamp >= 0 &&
    ["LOADING", "RUNNING", "PAUSED", "ERROR", "TERMINATED", "TERMINATED_PAUSED"].includes(request.controllerStatus) &&
    (request.controllerDispatch === undefined || isParticipantControllerDispatch(request.controllerDispatch)) &&
    (request.terminationNoop === undefined || request.terminationNoop === true && request.keyword === "terminate" && request.controllerStatus === "TERMINATED"));
};
export const participantControllerTimerInterruptionRoute = "/api/v1/participant/sessions/:participantSessionId/controller-timer-interruptions";
export type ParticipantControllerTimerInterruptionRequest = {
  testRunId: string;
  contentReleaseId: string;
  bookletKey: string;
  deliveryId: string;
  controllerDispatch: ParticipantControllerDispatch;
  keyword: "pause" | "terminate";
  controllerStatus: "LOADING" | "RUNNING" | "PAUSED" | "ERROR" | "TERMINATED" | "TERMINATED_PAUSED";
  unitKey: string;
  testletKey: string;
  startedAt: string;
  expiresAt: string;
  remainingSeconds: number;
  observedAt?: number;
  legacyCommand?: ParticipantNativeCommandRequest;
};
export const isParticipantControllerTimerInterruptionRequest = (value: unknown): value is ParticipantControllerTimerInterruptionRequest => {
  const request = value as ParticipantControllerTimerInterruptionRequest | null;
  const legacy = request?.legacyCommand;
  const observedAt = request?.observedAt;
  const validLegacy = legacy === undefined ? observedAt === undefined : Boolean(legacy &&
    typeof legacy === "object" && !Array.isArray(legacy) && legacy.controllerDispatch === undefined && legacy.terminationNoop === undefined &&
    ["goto", "resume"].includes(legacy.keyword) && Array.isArray(legacy.arguments) && legacy.arguments.every(arg => typeof arg === "string") &&
    ["LOADING", "RUNNING", "PAUSED", "ERROR"].includes(legacy.controllerStatus) && Number.isSafeInteger(legacy.timeStamp) && legacy.timeStamp >= 0 &&
    typeof legacy.deliveryId === "string" && /^[A-Za-z0-9_-]{1,160}$/.test(legacy.deliveryId) && legacy.deliveryId !== request?.deliveryId &&
    ["testRunId", "contentReleaseId", "bookletKey"].every(key => legacy[key as "testRunId"] === request?.[key as "testRunId"]) &&
    typeof observedAt === "number" && Number.isSafeInteger(observedAt) && observedAt >= 0 && Number.isFinite(new Date(observedAt).getTime()));
  return Boolean(request && typeof request === "object" && !Array.isArray(request) &&
    validLegacy &&
    ["testRunId", "contentReleaseId", "bookletKey", "unitKey", "testletKey"].every(key =>
      typeof request[key as keyof typeof request] === "string" && Boolean(String(request[key as keyof typeof request]).trim())) &&
    typeof request.deliveryId === "string" && /^[A-Za-z0-9_-]{1,160}$/.test(request.deliveryId) &&
    isParticipantControllerDispatch(request.controllerDispatch) &&
    ["LOADING", "RUNNING", "PAUSED", "ERROR", "TERMINATED", "TERMINATED_PAUSED"].includes(request.controllerStatus) &&
    (request.keyword === "pause" || request.keyword === "terminate" && request.controllerStatus !== "ERROR" && request.controllerStatus !== "TERMINATED") &&
    typeof request.startedAt === "string" && Number.isFinite(Date.parse(request.startedAt)) &&
    typeof request.expiresAt === "string" && Number.isFinite(Date.parse(request.expiresAt)) &&
    Number.isSafeInteger(request.remainingSeconds) && request.remainingSeconds >= 0);
};
export type ParticipantControllerTimerInterruptionResult = ParticipantControllerTimerInterruptionRequest & {
  scope: ParticipantRunCommandScope & { contentReleaseId: string; bookletKey: string };
  acceptedAt: string;
  applied: boolean;
};
export type ParticipantControllerContext = { participantSession: ParticipantSession; testRun: TestRun };
export const participantNativeCommandKeywords = ["pause", "resume", "terminate", "goto"] as const;
export type ParticipantNativeCommandKeyword = typeof participantNativeCommandKeywords[number];
export type ParticipantNativeCommandRequest = {
  commandCompletion?: "browser-v1";
  terminationNoop?: true;
  controllerDispatch?: ParticipantControllerDispatch;
  testRunId: string;
  contentReleaseId: string;
  bookletKey: string;
  deliveryId: string;
  keyword: ParticipantNativeCommandKeyword;
  arguments: string[];
  controllerStatus: "LOADING" | "RUNNING" | "PAUSED" | "ERROR" | "TERMINATED" | "TERMINATED_PAUSED";
  timeStamp: number;
};
export type ParticipantNativeCommandResult = {
  commandCompletion?: "browser-v1";
  terminationNoop?: true;
  superseded?: true;
  controllerDispatch?: ParticipantControllerDispatch;
  scope: ParticipantRunCommandScope & { contentReleaseId: string; bookletKey: string };
  deliveryId: string;
  keyword: ParticipantNativeCommandKeyword;
  arguments: string[];
  controllerStatus: ParticipantNativeCommandRequest["controllerStatus"];
  timeStamp: number;
  executedAt: string;
  applied: boolean;
  testRun: TestRun;
  participantSession: ParticipantSession;
};
export type ParticipantNativeCommandResponse = { application: ParticipantNativeCommandResult };
