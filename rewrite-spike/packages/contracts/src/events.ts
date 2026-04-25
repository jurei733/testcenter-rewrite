export const importJobStatuses = [
  "queued",
  "running",
  "completed",
  "failed",
  "cancelled"
] as const;

export type ImportJobStatus = (typeof importJobStatuses)[number];

export const monitorCommandAckStates = [
  "pending_delivery",
  "delivered",
  "applied",
  "rejected",
  "expired"
] as const;

export type MonitorCommandAckState = (typeof monitorCommandAckStates)[number];

export const auditActorTypes = [
  "platform_api",
  "participant",
  "monitor",
  "worker",
  "dispatcher",
  "notification_service"
] as const;

export type AuditActorType = (typeof auditActorTypes)[number];
