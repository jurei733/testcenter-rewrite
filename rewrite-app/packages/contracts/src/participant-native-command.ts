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
