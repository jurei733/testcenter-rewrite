import { monitorRunCommandTypes, type ParticipantRunCommand } from "@testcenter-rewrite-app/domain";

const identifier = (value: unknown): value is string => typeof value === "string" && Boolean(value.trim());
const timestamp = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));

export const parseParticipantRunCommand = (value: unknown): ParticipantRunCommand | null => {
  if (!value || typeof value !== "object") return null;
  const item = value as Record<string, unknown>;
  if (!["tenantId", "workspaceId", "participantSessionId", "testRunId", "commandId"].every(key => identifier(item[key])) ||
      !monitorRunCommandTypes.includes(item.commandType as ParticipantRunCommand["commandType"]) ||
      !Number.isSafeInteger(item.sequence) || Number(item.sequence) < 1 || !timestamp(item.issuedAt) ||
      !(item.acknowledgedAt === null || timestamp(item.acknowledgedAt)) ||
      !(item.targetUnitKey === null || identifier(item.targetUnitKey)) ||
      !(item.remainingSeconds === null || Number.isSafeInteger(item.remainingSeconds) && Number(item.remainingSeconds) > 0) ||
      !(item.actorId === null || typeof item.actorId === "string")) return null;
  return {
    tenantId: item.tenantId as string, workspaceId: item.workspaceId as string,
    participantSessionId: item.participantSessionId as string, testRunId: item.testRunId as string,
    commandId: item.commandId as string, commandType: item.commandType as ParticipantRunCommand["commandType"],
    sequence: item.sequence as number, targetUnitKey: item.targetUnitKey as string | null,
    remainingSeconds: item.remainingSeconds as number | null, actorId: item.actorId as string | null,
    issuedAt: item.issuedAt, acknowledgedAt: item.acknowledgedAt
  };
};

export type ListParticipantRunCommandsResponse = { commands: ParticipantRunCommand[] };
export type AcknowledgeParticipantRunCommandRequest = { testRunId: string };
export type AcknowledgeParticipantRunCommandResponse = { command: ParticipantRunCommand };
