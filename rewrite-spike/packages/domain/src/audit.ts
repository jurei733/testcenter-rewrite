import { randomUUID } from "node:crypto";

export type AuditActorType =
  | "platform_api"
  | "participant"
  | "monitor"
  | "worker"
  | "dispatcher"
  | "notification_service";

export interface AuditEvent {
  auditEventId: string;
  requestId: string;
  tenantId: string | null;
  workspaceId: string | null;
  participantSessionId: string | null;
  testRunId: string | null;
  loginKey: string | null;
  groupKey: string | null;
  assignmentKey: string | null;
  actorType: AuditActorType;
  actorId: string;
  eventType: string;
  payload: Record<string, unknown>;
  occurredAt: string;
}

export const createAuditEvent = (input: {
  requestId: string;
  tenantId?: string | null;
  workspaceId?: string | null;
  participantSessionId?: string | null;
  testRunId?: string | null;
  loginKey?: string | null;
  groupKey?: string | null;
  assignmentKey?: string | null;
  actorType: AuditActorType;
  actorId: string;
  eventType: string;
  payload?: Record<string, unknown>;
}): AuditEvent => ({
  auditEventId: `audit-event-${randomUUID()}`,
  requestId: input.requestId,
  tenantId: input.tenantId ?? null,
  workspaceId: input.workspaceId ?? null,
  participantSessionId: input.participantSessionId ?? null,
  testRunId: input.testRunId ?? null,
  loginKey: input.loginKey ?? null,
  groupKey: input.groupKey ?? null,
  assignmentKey: input.assignmentKey ?? null,
  actorType: input.actorType,
  actorId: input.actorId,
  eventType: input.eventType,
  payload: input.payload ?? {},
  occurredAt: new Date().toISOString()
});
