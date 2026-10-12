import type { ParticipantRunCommandScope, ParticipantSession, TestRun } from "@testcenter-rewrite-app/domain";

export const participantNativeCommandRoute = "/api/v1/participant/sessions/:participantSessionId/native-commands";
export const participantControllerContextRoute = "/api/v1/participant/sessions/:participantSessionId/controller-context";
export type ParticipantControllerContext = { participantSession: ParticipantSession; testRun: TestRun };
export const participantNativeCommandKeywords = ["pause", "resume", "terminate", "goto"] as const;
export type ParticipantNativeCommandKeyword = typeof participantNativeCommandKeywords[number];
export type ParticipantNativeCommandRequest = {
  testRunId: string;
  contentReleaseId: string;
  bookletKey: string;
  deliveryId: string;
  keyword: ParticipantNativeCommandKeyword;
  arguments: string[];
  controllerStatus: "RUNNING" | "PAUSED" | "ERROR";
  timeStamp: number;
};
export type ParticipantNativeCommandResult = {
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
