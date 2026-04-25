import { randomUUID } from "node:crypto";

export type MonitorCommandAckState = "pending_delivery" | "delivered" | "applied" | "rejected" | "expired";
export type MonitorCommandType = "pause" | "resume" | "unlock_navigation";

export interface MonitorCommand {
  commandId: string;
  requestId: string;
  tenantId: string;
  workspaceId: string;
  testRunId: string;
  participantSessionId: string;
  loginKey: string;
  groupKey: string;
  assignmentKey: string;
  attemptNumber: number;
  commandType: MonitorCommandType;
  ackState: MonitorCommandAckState;
  actorId: string;
  issuedAt: string;
  deliveredAt: string | null;
  resolvedAt: string | null;
  rejectionReason: string | null;
}

export const createMonitorCommand = (input: {
  requestId: string;
  tenantId: string;
  workspaceId: string;
  testRunId: string;
  participantSessionId: string;
  loginKey: string;
  groupKey: string;
  assignmentKey: string;
  attemptNumber: number;
  commandType: MonitorCommandType;
  actorId: string;
}): MonitorCommand => ({
  commandId: `monitor-command-${randomUUID()}`,
  requestId: input.requestId,
  tenantId: input.tenantId,
  workspaceId: input.workspaceId,
  testRunId: input.testRunId,
  participantSessionId: input.participantSessionId,
  loginKey: input.loginKey,
  groupKey: input.groupKey,
  assignmentKey: input.assignmentKey,
  attemptNumber: input.attemptNumber,
  commandType: input.commandType,
  ackState: "pending_delivery",
  actorId: input.actorId,
  issuedAt: new Date().toISOString(),
  deliveredAt: null,
  resolvedAt: null,
  rejectionReason: null
});

export const markMonitorCommandDelivered = (command: MonitorCommand): MonitorCommand => ({
  ...command,
  ackState: "delivered",
  deliveredAt: new Date().toISOString()
});

export const markMonitorCommandApplied = (command: MonitorCommand): MonitorCommand => ({
  ...command,
  ackState: "applied",
  deliveredAt: command.deliveredAt ?? new Date().toISOString(),
  resolvedAt: new Date().toISOString(),
  rejectionReason: null
});

export const markMonitorCommandRejected = (
  command: MonitorCommand,
  rejectionReason: string
): MonitorCommand => ({
  ...command,
  ackState: "rejected",
  deliveredAt: command.deliveredAt ?? new Date().toISOString(),
  resolvedAt: new Date().toISOString(),
  rejectionReason
});

export const markMonitorCommandExpired = (
  command: MonitorCommand,
  rejectionReason: string
): MonitorCommand => ({
  ...command,
  ackState: "expired",
  resolvedAt: new Date().toISOString(),
  rejectionReason
});
