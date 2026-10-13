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
};
export const isParticipantControllerTimerInterruptionRequest = (value: unknown): value is ParticipantControllerTimerInterruptionRequest => {
  const request = value as ParticipantControllerTimerInterruptionRequest | null;
  return Boolean(request && typeof request === "object" && !Array.isArray(request) &&
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
