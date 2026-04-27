import { createHash, randomUUID } from "node:crypto";
import {
  resolveOutboundNotificationDestination,
  resolveOutboundNotificationDeliveryChannel,
  resolveOutboundNotificationMaxAttempts,
  type OutboundNotificationDeliveryChannel,
  type OutboundNotificationProviderProfile
} from "@testcenter-rewrite/outbound-messaging";

import type { ContentRelease, SystemCheckDefinition } from "./content.js";
import type {
  EvidenceRetentionClassPolicy,
  EvidenceRetentionHoldReasonDefinition,
  EvidenceRetentionHoldReasonCode,
  NotificationPolicy,
  NotificationProviderProfile,
  EvidenceRetentionPolicy,
  EvidenceRetentionTtlFieldKey
} from "./platform.js";

export type SystemCheckResultStatus = "passed" | "warning" | "failed";
export type SystemCheckReviewStatus = "pending" | "accepted" | "needs_follow_up" | "rejected";
export type SystemCheckLaunchReadinessStatus = "ready" | "warning" | "blocked";
export type SystemCheckLaunchReadinessCode =
  | "missing_submission"
  | "pending_review"
  | "requires_follow_up"
  | "rejected"
  | "accepted_with_warning"
  | "accepted_with_failure";
export type SystemCheckLaunchApprovalScope = "single_launch" | "session_assignment";
export type SystemCheckLaunchApprovalStatus =
  | "active"
  | "consumed"
  | "revoked"
  | "invalidated"
  | "expired";
export type SystemCheckLaunchApprovalInvalidationReasonCode =
  | "readiness_no_longer_warning"
  | "warning_reason_codes_changed";
export type SystemCheckLaunchApprovalExpirationReasonCode = "time_elapsed";
export type SystemCheckEvidenceStorageBackend =
  | "postgres_inline_spike"
  | "filesystem_spike"
  | "s3_compatible_spike";
export type SystemCheckEvidenceRetentionClass = string;
export type SystemCheckEvidenceHoldReasonCode = EvidenceRetentionHoldReasonCode;
export type SystemCheckEvidenceRetentionState = "retained" | "held" | "purged";
export type SystemCheckEvidencePayloadAvailability = "available" | "purged";
export type SystemCheckEvidencePurgeReasonCode = "retention_elapsed";
export type SystemCheckEvidenceAccessGrantIssuedFor = "participant_capture" | "workspace_review";
export type SystemCheckEvidenceHoldAcknowledgementStatus =
  | "not_required"
  | "pending"
  | "acknowledged";
export type SystemCheckEvidenceHoldAssignmentStatus = "unassigned" | "assigned";
export type SystemCheckEvidenceHoldSlaStatus =
  | "not_applicable"
  | "on_track"
  | "breached"
  | "acknowledged";
export type SystemCheckEvidenceHoldEscalationStatus =
  | "not_applicable"
  | "pending"
  | "breached"
  | "acknowledged"
  | "escalated";
export type SystemCheckEvidenceBreachQueueStatus =
  | "pending_breach"
  | "breached"
  | "acknowledged"
  | "escalated";
export type SystemCheckEvidenceBreachNotificationChannel = "workspace_queue";
export type SystemCheckEvidenceBreachNotificationStatus =
  | "pending_acknowledgement"
  | "acknowledged";
export type SystemCheckEvidenceBreachNotificationDeliveryChannel =
  OutboundNotificationDeliveryChannel;
export type SystemCheckEvidenceBreachNotificationDeliveryStatus =
  | "pending_delivery"
  | "delivered"
  | "delivery_failed";

export interface SystemCheckEvidenceRetentionClassTransition {
  holdReasonCode: SystemCheckEvidenceHoldReasonCode;
  holdReason: EvidenceRetentionHoldReasonDefinition | null;
  targetRetentionClass: SystemCheckEvidenceRetentionClass;
  targetRetentionPolicyKey: SystemCheckEvidenceRetentionPolicyKey;
}

export interface SystemCheckEvidenceRetentionClassRule {
  retentionClass: SystemCheckEvidenceRetentionClass;
  retentionPolicyKey: string;
  ttlSeconds: number;
  manualHoldAllowed: boolean;
  payloadAccessGrantsAllowed: boolean;
  holdTransitions: SystemCheckEvidenceRetentionClassTransition[];
}
export type SystemCheckEvidenceRetentionPolicyKey = string;

export interface SystemCheckCheckResult {
  status: SystemCheckResultStatus;
  detailMessage: string | null;
  observedValue: string | null;
  evidenceKeys: string[];
}

export interface SystemCheckEvidence {
  evidenceKey: string;
  participantSessionId: string;
  tenantId: string;
  workspaceId: string;
  contentReleaseId: string;
  loginKey: string;
  groupKey: string;
  systemCheckKey: string;
  checkKey: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  sha256: string;
  payloadBase64: string | null;
  payloadPreviewText: string | null;
  storageBackend: SystemCheckEvidenceStorageBackend;
  storageLocator: string | null;
  retentionClass: SystemCheckEvidenceRetentionClass;
  retentionPolicyKey: SystemCheckEvidenceRetentionPolicyKey;
  retentionExpiresAt: string | null;
  retentionHold: SystemCheckEvidenceRetentionHold | null;
  purgedAt: string | null;
  purgeReasonCode: SystemCheckEvidencePurgeReasonCode | null;
  createdAt: string;
}

export interface SystemCheckEvidenceRetentionHold {
  heldAt: string;
  holdReasonCode: SystemCheckEvidenceHoldReasonCode;
  holdNote: string;
  heldByActorType: "platform_api" | "participant" | "monitor" | "worker" | "dispatcher";
  heldByActorId: string;
  acknowledgementRequired: boolean;
  acknowledgedAt: string | null;
  acknowledgedByActorId: string | null;
  acknowledgementNote: string | null;
  defaultAssigneeTarget: string | null;
  assignedToActorId: string | null;
  assignedByActorId: string | null;
  assignedAt: string | null;
  assignmentNote: string | null;
  slaSeconds: number | null;
  slaDueAt: string | null;
  escalationTarget: string | null;
  escalatedAt: string | null;
  escalatedByActorId: string | null;
  escalationNote: string | null;
}

export interface SystemCheckEvidenceAccessGrant {
  accessGrantId: string;
  accessToken: string;
  evidenceKey: string;
  tenantId: string;
  workspaceId: string;
  participantSessionId: string;
  issuedFor: SystemCheckEvidenceAccessGrantIssuedFor;
  actorType: "platform_api" | "participant" | "monitor" | "worker" | "dispatcher";
  actorId: string;
  issuedAt: string;
  expiresAt: string;
  lastAccessedAt: string | null;
}

export interface SystemCheckEvidenceBreachNotification {
  notificationId: string;
  evidenceKey: string;
  participantSessionId: string;
  tenantId: string;
  workspaceId: string;
  contentReleaseId: string;
  loginKey: string;
  groupKey: string;
  systemCheckKey: string;
  checkKey: string;
  holdReasonCode: SystemCheckEvidenceHoldReasonCode;
  escalationTarget: string | null;
  assignedToActorId: string | null;
  notificationChannel: SystemCheckEvidenceBreachNotificationChannel;
  status: SystemCheckEvidenceBreachNotificationStatus;
  createdAt: string;
  createdByActorType: "platform_api" | "participant" | "monitor" | "worker" | "dispatcher";
  createdByActorId: string;
  sourceRequestId: string | null;
  deliveryProfileKey: string | null;
  deliveryChannel: SystemCheckEvidenceBreachNotificationDeliveryChannel;
  deliveryStatus: SystemCheckEvidenceBreachNotificationDeliveryStatus;
  deliveryTarget: string | null;
  deliveryAttemptCount: number;
  maxDeliveryAttempts: number;
  nextDeliveryAttemptAt: string | null;
  lastDeliveryAttemptAt: string | null;
  lastDeliveryReceiptId: string | null;
  lastDeliveryReceiptIssuedAt: string | null;
  deliveredAt: string | null;
  lastDeliveryError: string | null;
  acknowledgedAt: string | null;
  acknowledgedByActorId: string | null;
  acknowledgementNote: string | null;
}

export interface SystemCheckSubmission {
  systemCheckSubmissionId: string;
  participantSessionId: string;
  tenantId: string;
  workspaceId: string;
  contentReleaseId: string;
  loginKey: string;
  groupKey: string;
  systemCheckKey: string;
  status: SystemCheckResultStatus;
  checkResults: Record<string, SystemCheckCheckResult>;
  reviewStatus: SystemCheckReviewStatus;
  reviewNote: string | null;
  reviewedAt: string | null;
  reviewedByActorType: "platform_api" | "participant" | "monitor" | "worker" | "dispatcher" | null;
  reviewedByActorId: string | null;
  submittedAt: string;
}

export interface SystemCheckSubmissionSummary {
  status: SystemCheckResultStatus;
  totalChecks: number;
  passedChecks: number;
  warningChecks: number;
  failedChecks: number;
}

export interface SystemCheckLaunchCheckReadiness {
  systemCheckKey: string;
  readinessStatus: SystemCheckLaunchReadinessStatus;
  reasonCodes: SystemCheckLaunchReadinessCode[];
  submission: SystemCheckSubmission | null;
}

export interface SystemCheckLaunchReadiness {
  status: SystemCheckLaunchReadinessStatus;
  blockingReasonCodes: SystemCheckLaunchReadinessCode[];
  warningReasonCodes: SystemCheckLaunchReadinessCode[];
  checks: SystemCheckLaunchCheckReadiness[];
}

export interface SystemCheckLaunchApproval {
  launchApprovalId: string;
  participantSessionId: string;
  tenantId: string;
  workspaceId: string;
  contentReleaseId: string;
  loginKey: string;
  groupKey: string;
  assignmentKey: string;
  readinessStatus: "warning";
  warningReasonCodes: SystemCheckLaunchReadinessCode[];
  approvalScope: SystemCheckLaunchApprovalScope;
  status: SystemCheckLaunchApprovalStatus;
  approvedAt: string;
  approvedBySupervisorId: string;
  approvalNote: string;
  expiresAt: string | null;
  consumedAt: string | null;
  consumedByTestRunId: string | null;
  invalidatedAt: string | null;
  invalidationReasonCode: SystemCheckLaunchApprovalInvalidationReasonCode | null;
  invalidationReasonDetail: string | null;
  expiredAt: string | null;
  expirationReasonCode: SystemCheckLaunchApprovalExpirationReasonCode | null;
  revokedAt: string | null;
  revokedBySupervisorId: string | null;
  revocationNote: string | null;
}

export const summarizeSystemCheckResults = (
  checkResults: Record<string, SystemCheckCheckResult>
): SystemCheckSubmissionSummary => {
  const resultValues = Object.values(checkResults).map(result => result.status);
  const passedChecks = resultValues.filter(value => value === "passed").length;
  const warningChecks = resultValues.filter(value => value === "warning").length;
  const failedChecks = resultValues.filter(value => value === "failed").length;

  return {
    status: failedChecks > 0 ? "failed" : warningChecks > 0 ? "warning" : "passed",
    totalChecks: resultValues.length,
    passedChecks,
    warningChecks,
    failedChecks
  };
};

export const createSystemCheckSubmission = (input: {
  participantSessionId: string;
  tenantId: string;
  workspaceId: string;
  contentReleaseId: string;
  loginKey: string;
  groupKey: string;
  systemCheckKey: string;
  checkResults: Record<string, SystemCheckCheckResult>;
  submittedAt?: string;
}): SystemCheckSubmission => {
  const submittedAt = input.submittedAt ?? new Date().toISOString();
  const summary = summarizeSystemCheckResults(input.checkResults);

  return {
    systemCheckSubmissionId: `system-check-submission-${randomUUID()}`,
    participantSessionId: input.participantSessionId,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    contentReleaseId: input.contentReleaseId,
    loginKey: input.loginKey,
    groupKey: input.groupKey,
    systemCheckKey: input.systemCheckKey,
    status: summary.status,
    checkResults: input.checkResults,
    reviewStatus: "pending",
    reviewNote: null,
    reviewedAt: null,
    reviewedByActorType: null,
    reviewedByActorId: null,
    submittedAt
  };
};

export const createSystemCheckEvidence = (input: {
  participantSessionId: string;
  tenantId: string;
  workspaceId: string;
  contentReleaseId: string;
  loginKey: string;
  groupKey: string;
  systemCheckKey: string;
  checkKey: string;
  fileName: string;
  contentType: string;
  payloadBase64: string;
  persistedPayloadBase64?: string | null;
  payloadPreviewText?: string | null;
  storageBackend?: SystemCheckEvidenceStorageBackend;
  storageLocator?: string | null;
  retentionClass?: SystemCheckEvidenceRetentionClass;
  retentionPolicyKey?: SystemCheckEvidenceRetentionPolicyKey;
  retentionExpiresAt?: string | null;
  purgedAt?: string | null;
  purgeReasonCode?: SystemCheckEvidencePurgeReasonCode | null;
  createdAt?: string;
}): SystemCheckEvidence => {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const payloadBuffer = Buffer.from(input.payloadBase64, "base64");

  return {
    evidenceKey: `system-check-evidence-${randomUUID()}`,
    participantSessionId: input.participantSessionId,
    tenantId: input.tenantId,
    workspaceId: input.workspaceId,
    contentReleaseId: input.contentReleaseId,
    loginKey: input.loginKey,
    groupKey: input.groupKey,
    systemCheckKey: input.systemCheckKey,
    checkKey: input.checkKey,
    fileName: input.fileName,
    contentType: input.contentType,
    byteSize: payloadBuffer.byteLength,
    sha256: createHash("sha256").update(payloadBuffer).digest("hex"),
    payloadBase64: input.persistedPayloadBase64 ?? input.payloadBase64,
    payloadPreviewText:
      input.payloadPreviewText ??
      getSystemCheckEvidencePreviewText({
        evidenceKey: "preview-only",
        participantSessionId: input.participantSessionId,
        tenantId: input.tenantId,
        workspaceId: input.workspaceId,
        contentReleaseId: input.contentReleaseId,
        loginKey: input.loginKey,
        groupKey: input.groupKey,
        systemCheckKey: input.systemCheckKey,
        checkKey: input.checkKey,
        fileName: input.fileName,
        contentType: input.contentType,
        byteSize: payloadBuffer.byteLength,
        sha256: "",
        payloadBase64: input.payloadBase64,
        payloadPreviewText: null,
        storageBackend: "postgres_inline_spike",
        storageLocator: null,
        retentionClass: input.retentionClass ?? "workspace_review",
        retentionPolicyKey: input.retentionPolicyKey ?? "spike_workspace_review",
        retentionExpiresAt: null,
        retentionHold: null,
        purgedAt: null,
        purgeReasonCode: null,
        createdAt
      }),
    storageBackend: input.storageBackend ?? "filesystem_spike",
    storageLocator: input.storageLocator ?? null,
    retentionClass: input.retentionClass ?? "workspace_review",
    retentionPolicyKey: input.retentionPolicyKey ?? "spike_workspace_review",
    retentionExpiresAt: input.retentionExpiresAt ?? null,
    retentionHold: null,
    purgedAt: input.purgedAt ?? null,
    purgeReasonCode: input.purgeReasonCode ?? null,
    createdAt
  };
};

export const createSystemCheckEvidenceAccessGrant = (input: {
  evidenceKey: string;
  tenantId: string;
  workspaceId: string;
  participantSessionId: string;
  issuedFor: SystemCheckEvidenceAccessGrantIssuedFor;
  actorType: "platform_api" | "participant" | "monitor" | "worker" | "dispatcher";
  actorId: string;
  issuedAt?: string;
  expiresAt: string;
}): SystemCheckEvidenceAccessGrant => ({
  accessGrantId: `system-check-evidence-access-grant-${randomUUID()}`,
  accessToken: `system-check-evidence-access-${randomUUID()}`,
  evidenceKey: input.evidenceKey,
  tenantId: input.tenantId,
  workspaceId: input.workspaceId,
  participantSessionId: input.participantSessionId,
  issuedFor: input.issuedFor,
  actorType: input.actorType,
  actorId: input.actorId,
  issuedAt: input.issuedAt ?? new Date().toISOString(),
  expiresAt: input.expiresAt,
  lastAccessedAt: null
});

export const isSystemCheckEvidenceAccessGrantExpired = (
  accessGrant: SystemCheckEvidenceAccessGrant,
  now: string = new Date().toISOString()
): boolean => Date.parse(accessGrant.expiresAt) <= Date.parse(now);

export const getSystemCheckEvidencePayloadAvailability = (
  systemCheckEvidence: SystemCheckEvidence
): SystemCheckEvidencePayloadAvailability =>
  systemCheckEvidence.purgedAt ? "purged" : "available";

export const getSystemCheckEvidenceRetentionState = (
  systemCheckEvidence: SystemCheckEvidence
): SystemCheckEvidenceRetentionState => {
  if (systemCheckEvidence.purgedAt) {
    return "purged";
  }

  if (systemCheckEvidence.retentionHold) {
    return "held";
  }

  return "retained";
};

export const isSystemCheckEvidenceHeld = (
  systemCheckEvidence: SystemCheckEvidence
): boolean => Boolean(systemCheckEvidence.retentionHold);

export const getSystemCheckEvidenceHoldAcknowledgementStatus = (
  retentionHold: SystemCheckEvidenceRetentionHold
): SystemCheckEvidenceHoldAcknowledgementStatus => {
  if (!retentionHold.acknowledgementRequired) {
    return "not_required";
  }

  return retentionHold.acknowledgedAt ? "acknowledged" : "pending";
};

export const getSystemCheckEvidenceHoldAssignmentStatus = (
  retentionHold: SystemCheckEvidenceRetentionHold
): SystemCheckEvidenceHoldAssignmentStatus =>
  retentionHold.assignedToActorId ? "assigned" : "unassigned";

export const getSystemCheckEvidenceHoldSlaStatus = (
  retentionHold: SystemCheckEvidenceRetentionHold,
  now: string = new Date().toISOString()
): SystemCheckEvidenceHoldSlaStatus => {
  if (!retentionHold.slaDueAt) {
    return "not_applicable";
  }

  if (retentionHold.acknowledgedAt) {
    return "acknowledged";
  }

  return Date.parse(retentionHold.slaDueAt) <= Date.parse(now) ? "breached" : "on_track";
};

export const getSystemCheckEvidenceHoldEscalationStatus = (
  retentionHold: SystemCheckEvidenceRetentionHold,
  now: string = new Date().toISOString()
): SystemCheckEvidenceHoldEscalationStatus => {
  if (!retentionHold.escalationTarget) {
    return "not_applicable";
  }

  if (retentionHold.escalatedAt) {
    return "escalated";
  }

  if (retentionHold.acknowledgedAt) {
    return "acknowledged";
  }

  return getSystemCheckEvidenceHoldSlaStatus(retentionHold, now) === "breached"
    ? "breached"
    : "pending";
};

export const getSystemCheckEvidenceBreachQueueStatus = (
  retentionHold: SystemCheckEvidenceRetentionHold,
  now: string = new Date().toISOString()
): SystemCheckEvidenceBreachQueueStatus | null => {
  const escalationStatus = getSystemCheckEvidenceHoldEscalationStatus(retentionHold, now);

  if (escalationStatus === "not_applicable") {
    return null;
  }

  if (escalationStatus === "escalated") {
    return "escalated";
  }

  if (escalationStatus === "acknowledged") {
    return "acknowledged";
  }

  if (escalationStatus === "breached") {
    return "breached";
  }

  return "pending_breach";
};

export const isSystemCheckEvidenceRetentionExpired = (
  systemCheckEvidence: SystemCheckEvidence,
  now: string = new Date().toISOString()
): boolean =>
  Boolean(
    systemCheckEvidence.retentionExpiresAt &&
    Date.parse(systemCheckEvidence.retentionExpiresAt) <= Date.parse(now)
  );

export const applySystemCheckEvidenceRetentionHold = (input: {
  systemCheckEvidence: SystemCheckEvidence;
  holdReasonCode: SystemCheckEvidenceHoldReasonCode;
  holdNote: string;
  heldByActorType: "platform_api" | "participant" | "monitor" | "worker" | "dispatcher";
  heldByActorId: string;
  acknowledgementRequired?: boolean;
  defaultAssigneeTarget?: string | null;
  slaSeconds?: number | null;
  slaDueAt?: string | null;
  escalationTarget?: string | null;
  retentionClass?: SystemCheckEvidenceRetentionClass;
  retentionPolicyKey?: SystemCheckEvidenceRetentionPolicyKey;
  retentionExpiresAt?: string | null;
  heldAt?: string;
}): SystemCheckEvidence => {
  const heldAt = input.heldAt ?? new Date().toISOString();

  return {
    ...input.systemCheckEvidence,
    retentionClass: input.retentionClass ?? input.systemCheckEvidence.retentionClass,
    retentionPolicyKey: input.retentionPolicyKey ?? input.systemCheckEvidence.retentionPolicyKey,
    retentionExpiresAt:
      input.retentionExpiresAt === undefined
        ? input.systemCheckEvidence.retentionExpiresAt
        : input.retentionExpiresAt,
    retentionHold: {
      heldAt,
      holdReasonCode: input.holdReasonCode,
      holdNote: input.holdNote,
      heldByActorType: input.heldByActorType,
      heldByActorId: input.heldByActorId,
      acknowledgementRequired: input.acknowledgementRequired ?? false,
      acknowledgedAt: null,
      acknowledgedByActorId: null,
      acknowledgementNote: null,
      defaultAssigneeTarget: input.defaultAssigneeTarget ?? null,
      assignedToActorId: input.defaultAssigneeTarget ?? null,
      assignedByActorId:
        input.defaultAssigneeTarget ? "policy-default-assignment" : null,
      assignedAt: input.defaultAssigneeTarget ? heldAt : null,
      assignmentNote: input.defaultAssigneeTarget
        ? "Assigned automatically from hold-reason default assignee target."
        : null,
      slaSeconds: input.slaSeconds ?? null,
      slaDueAt: input.slaDueAt ?? null,
      escalationTarget: input.escalationTarget ?? null,
      escalatedAt: null,
      escalatedByActorId: null,
      escalationNote: null
    }
  };
};

export const createSystemCheckEvidenceBreachNotification = (input: {
  systemCheckEvidence: SystemCheckEvidence;
  notificationChannel?: SystemCheckEvidenceBreachNotificationChannel;
  createdAt?: string;
  createdByActorType: "platform_api" | "participant" | "monitor" | "worker" | "dispatcher";
  createdByActorId: string;
  sourceRequestId?: string | null;
  notificationPolicy?: NotificationPolicy;
  notificationProviderProfiles?: NotificationProviderProfile[];
  maxDeliveryAttempts?: number;
}): SystemCheckEvidenceBreachNotification => {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const retentionHold = input.systemCheckEvidence.retentionHold;
  const notificationId = `system-check-evidence-breach-notification-${randomUUID()}`;

  if (!retentionHold) {
    throw new Error("Cannot create a breach notification for system-check evidence without a retention hold.");
  }

  const resolvedDestination = resolveOutboundNotificationDestination({
    target: retentionHold.escalationTarget,
    selectionMode: input.notificationPolicy?.breachNotificationDeliverySelectionMode,
    providerProfiles: input.notificationProviderProfiles,
    rolloutSubjectKey: notificationId
  });
  const resolvedDeliveryChannel = resolvedDestination.deliveryChannel;

  return {
    notificationId,
    evidenceKey: input.systemCheckEvidence.evidenceKey,
    participantSessionId: input.systemCheckEvidence.participantSessionId,
    tenantId: input.systemCheckEvidence.tenantId,
    workspaceId: input.systemCheckEvidence.workspaceId,
    contentReleaseId: input.systemCheckEvidence.contentReleaseId,
    loginKey: input.systemCheckEvidence.loginKey,
    groupKey: input.systemCheckEvidence.groupKey,
    systemCheckKey: input.systemCheckEvidence.systemCheckKey,
    checkKey: input.systemCheckEvidence.checkKey,
    holdReasonCode: retentionHold.holdReasonCode,
    escalationTarget: retentionHold.escalationTarget,
    assignedToActorId: retentionHold.assignedToActorId,
    notificationChannel: input.notificationChannel ?? "workspace_queue",
    status: "pending_acknowledgement",
    createdAt,
    createdByActorType: input.createdByActorType,
    createdByActorId: input.createdByActorId,
    sourceRequestId: input.sourceRequestId ?? null,
    deliveryProfileKey: resolvedDestination.deliveryProfileKey,
    deliveryChannel: resolvedDeliveryChannel,
    deliveryStatus: "pending_delivery",
    deliveryTarget: resolvedDestination.deliveryTarget,
    deliveryAttemptCount: 0,
    maxDeliveryAttempts:
      input.maxDeliveryAttempts ??
      resolveOutboundNotificationMaxAttempts({
        notificationPolicy: input.notificationPolicy,
        deliveryChannel: resolvedDeliveryChannel
      }),
    nextDeliveryAttemptAt: createdAt,
    lastDeliveryAttemptAt: null,
    lastDeliveryReceiptId: null,
    lastDeliveryReceiptIssuedAt: null,
    deliveredAt: null,
    lastDeliveryError: null,
    acknowledgedAt: null,
    acknowledgedByActorId: null,
    acknowledgementNote: null
  };
};

export const resolveSystemCheckEvidenceBreachNotificationDeliveryChannel = (input: {
  escalationTarget: string | null;
  selectionMode?: NotificationPolicy["breachNotificationDeliverySelectionMode"];
}): SystemCheckEvidenceBreachNotificationDeliveryChannel => {
  return resolveOutboundNotificationDeliveryChannel({
    target: input.escalationTarget,
    selectionMode: input.selectionMode
  });
};

export const markSystemCheckEvidenceBreachNotificationDelivered = (input: {
  notification: SystemCheckEvidenceBreachNotification;
  deliveredAt?: string;
  receiptId?: string | null;
  receiptIssuedAt?: string | null;
}): SystemCheckEvidenceBreachNotification => {
  const deliveredAt = input.deliveredAt ?? new Date().toISOString();

  return {
    ...input.notification,
    deliveryStatus: "delivered",
    deliveryAttemptCount: input.notification.deliveryAttemptCount + 1,
    nextDeliveryAttemptAt: null,
    lastDeliveryAttemptAt: deliveredAt,
    lastDeliveryReceiptId: input.receiptId ?? null,
    lastDeliveryReceiptIssuedAt: input.receiptIssuedAt ?? deliveredAt,
    deliveredAt,
    lastDeliveryError: null
  };
};

export const scheduleSystemCheckEvidenceBreachNotificationDeliveryRetry = (input: {
  notification: SystemCheckEvidenceBreachNotification;
  failureReason: string;
  attemptedAt?: string;
  retryAt?: string;
  receiptId?: string | null;
  receiptIssuedAt?: string | null;
}): SystemCheckEvidenceBreachNotification => {
  const attemptedAt = input.attemptedAt ?? new Date().toISOString();

  return {
    ...input.notification,
    deliveryStatus: "pending_delivery",
    deliveryAttemptCount: input.notification.deliveryAttemptCount + 1,
    nextDeliveryAttemptAt: input.retryAt ?? attemptedAt,
    lastDeliveryAttemptAt: attemptedAt,
    lastDeliveryReceiptId: input.receiptId ?? null,
    lastDeliveryReceiptIssuedAt: input.receiptIssuedAt ?? attemptedAt,
    lastDeliveryError: input.failureReason
  };
};

export const markSystemCheckEvidenceBreachNotificationDeliveryFailed = (input: {
  notification: SystemCheckEvidenceBreachNotification;
  failureReason: string;
  attemptedAt?: string;
  receiptId?: string | null;
  receiptIssuedAt?: string | null;
}): SystemCheckEvidenceBreachNotification => {
  const attemptedAt = input.attemptedAt ?? new Date().toISOString();

  return {
    ...input.notification,
    deliveryStatus: "delivery_failed",
    deliveryAttemptCount: input.notification.deliveryAttemptCount + 1,
    nextDeliveryAttemptAt: null,
    lastDeliveryAttemptAt: attemptedAt,
    lastDeliveryReceiptId: input.receiptId ?? null,
    lastDeliveryReceiptIssuedAt: input.receiptIssuedAt ?? attemptedAt,
    lastDeliveryError: input.failureReason
  };
};

export const redriveSystemCheckEvidenceBreachNotification = (input: {
  notification: SystemCheckEvidenceBreachNotification;
  notificationPolicy?: NotificationPolicy;
  deliveryTarget?: string | null;
  redrivenAt?: string;
  sourceRequestId?: string | null;
}): SystemCheckEvidenceBreachNotification => {
  const redrivenAt = input.redrivenAt ?? new Date().toISOString();
  const resolvedDeliveryTarget = input.deliveryTarget?.trim()
    ? input.deliveryTarget.trim()
    : input.notification.deliveryTarget;
  const resolvedDeliveryChannel = resolveOutboundNotificationDeliveryChannel({
    target: resolvedDeliveryTarget ?? input.notification.escalationTarget,
    selectionMode: input.notificationPolicy?.breachNotificationDeliverySelectionMode
  });

  return {
    ...input.notification,
    sourceRequestId: input.sourceRequestId ?? input.notification.sourceRequestId,
    deliveryProfileKey: null,
    deliveryChannel: resolvedDeliveryChannel,
    deliveryStatus: "pending_delivery",
    deliveryTarget: resolvedDeliveryTarget ?? null,
    deliveryAttemptCount: 0,
    maxDeliveryAttempts: resolveOutboundNotificationMaxAttempts({
      notificationPolicy: input.notificationPolicy,
      deliveryChannel: resolvedDeliveryChannel
    }),
    nextDeliveryAttemptAt: redrivenAt,
    lastDeliveryAttemptAt: null,
    lastDeliveryReceiptId: null,
    lastDeliveryReceiptIssuedAt: null,
    deliveredAt: null,
    lastDeliveryError: null
  };
};

export const acknowledgeSystemCheckEvidenceBreachNotification = (input: {
  notification: SystemCheckEvidenceBreachNotification;
  acknowledgedByActorId: string;
  acknowledgementNote: string;
  acknowledgedAt?: string;
}): SystemCheckEvidenceBreachNotification => ({
  ...input.notification,
  status: "acknowledged",
  acknowledgedAt: input.acknowledgedAt ?? new Date().toISOString(),
  acknowledgedByActorId: input.acknowledgedByActorId,
  acknowledgementNote: input.acknowledgementNote
});

export const acknowledgeSystemCheckEvidenceRetentionHold = (input: {
  systemCheckEvidence: SystemCheckEvidence;
  acknowledgedByActorId: string;
  acknowledgementNote: string;
  acknowledgedAt?: string;
}): SystemCheckEvidence => ({
  ...input.systemCheckEvidence,
  retentionHold: input.systemCheckEvidence.retentionHold
    ? {
        ...input.systemCheckEvidence.retentionHold,
        acknowledgedAt: input.acknowledgedAt ?? new Date().toISOString(),
        acknowledgedByActorId: input.acknowledgedByActorId,
        acknowledgementNote: input.acknowledgementNote
      }
    : null
});

export const assignSystemCheckEvidenceRetentionHold = (input: {
  systemCheckEvidence: SystemCheckEvidence;
  assignedByActorId: string;
  assignedToActorId: string;
  assignmentNote?: string | null;
  assignedAt?: string;
}): SystemCheckEvidence => ({
  ...input.systemCheckEvidence,
  retentionHold: input.systemCheckEvidence.retentionHold
    ? {
        ...input.systemCheckEvidence.retentionHold,
        assignedToActorId: input.assignedToActorId,
        assignedByActorId: input.assignedByActorId,
        assignedAt: input.assignedAt ?? new Date().toISOString(),
        assignmentNote: input.assignmentNote ?? null
      }
    : null
});

export const escalateSystemCheckEvidenceRetentionHold = (input: {
  systemCheckEvidence: SystemCheckEvidence;
  escalatedByActorId: string;
  escalationNote: string;
  escalatedAt?: string;
}): SystemCheckEvidence => ({
  ...input.systemCheckEvidence,
  retentionHold: input.systemCheckEvidence.retentionHold
    ? {
        ...input.systemCheckEvidence.retentionHold,
        escalatedAt: input.escalatedAt ?? new Date().toISOString(),
        escalatedByActorId: input.escalatedByActorId,
        escalationNote: input.escalationNote
      }
    : null
});

export const buildSystemCheckEvidenceRetentionClassRules = (
  policy: EvidenceRetentionPolicy,
  classPolicy: EvidenceRetentionClassPolicy
): SystemCheckEvidenceRetentionClassRule[] =>
  classPolicy.classes.map(entry => ({
    retentionClass: entry.retentionClass,
    retentionPolicyKey: entry.retentionPolicyKey,
    ttlSeconds: policy[entry.ttlFieldKey],
    manualHoldAllowed: entry.manualHoldAllowed,
    payloadAccessGrantsAllowed: entry.payloadAccessGrantsAllowed,
    holdTransitions: entry.holdTransitions.map(transition => ({
      holdReasonCode: transition.holdReasonCode,
      holdReason:
        classPolicy.holdReasons.find(
          candidate => candidate.holdReasonCode === transition.holdReasonCode
        ) ?? null,
      targetRetentionClass: transition.targetRetentionClass,
      targetRetentionPolicyKey:
        classPolicy.classes.find(candidate => candidate.retentionClass === transition.targetRetentionClass)
          ?.retentionPolicyKey ?? entry.retentionPolicyKey
    }))
  }));

const getRetentionTtlSeconds = (
  policy: EvidenceRetentionPolicy,
  ttlFieldKey: EvidenceRetentionTtlFieldKey
): number => policy[ttlFieldKey];

export const resolveSystemCheckEvidenceRetentionClassRule = (
  policy: EvidenceRetentionPolicy,
  classPolicy: EvidenceRetentionClassPolicy,
  retentionClass: SystemCheckEvidenceRetentionClass
): SystemCheckEvidenceRetentionClassRule =>
  buildSystemCheckEvidenceRetentionClassRules(policy, classPolicy).find(
    rule => rule.retentionClass === retentionClass
  ) ??
  (() => {
    const fallbackEntry =
      classPolicy.classes.find(entry => entry.retentionClass === classPolicy.defaultCaptureRetentionClass) ??
      classPolicy.classes[0];

    if (!fallbackEntry) {
      return {
        retentionClass,
        retentionPolicyKey: retentionClass,
        ttlSeconds: 0,
        manualHoldAllowed: false,
        payloadAccessGrantsAllowed: true,
        holdTransitions: []
      };
    }

    return {
      retentionClass: fallbackEntry.retentionClass,
      retentionPolicyKey: fallbackEntry.retentionPolicyKey,
      ttlSeconds: getRetentionTtlSeconds(policy, fallbackEntry.ttlFieldKey),
      manualHoldAllowed: fallbackEntry.manualHoldAllowed,
      payloadAccessGrantsAllowed: fallbackEntry.payloadAccessGrantsAllowed,
      holdTransitions: fallbackEntry.holdTransitions.map(transition => ({
        holdReasonCode: transition.holdReasonCode,
        holdReason:
          classPolicy.holdReasons.find(
            candidate => candidate.holdReasonCode === transition.holdReasonCode
          ) ?? null,
        targetRetentionClass: transition.targetRetentionClass,
        targetRetentionPolicyKey:
          classPolicy.classes.find(candidate => candidate.retentionClass === transition.targetRetentionClass)
            ?.retentionPolicyKey ?? fallbackEntry.retentionPolicyKey
      }))
    };
  })();

export const resolveSystemCheckEvidenceHoldTargetRule = (input: {
  policy: EvidenceRetentionPolicy;
  classPolicy: EvidenceRetentionClassPolicy;
  currentRetentionClass: SystemCheckEvidenceRetentionClass;
  holdReasonCode: SystemCheckEvidenceHoldReasonCode;
}): SystemCheckEvidenceRetentionClassRule => {
  const currentRule = resolveSystemCheckEvidenceRetentionClassRule(
    input.policy,
    input.classPolicy,
    input.currentRetentionClass
  );
  const transition = currentRule.holdTransitions.find(
    entry => entry.holdReasonCode === input.holdReasonCode
  );

  if (!transition) {
    return currentRule;
  }

  return resolveSystemCheckEvidenceRetentionClassRule(
    input.policy,
    input.classPolicy,
    transition.targetRetentionClass
  );
};

export const releaseSystemCheckEvidenceRetentionHold = (
  systemCheckEvidence: SystemCheckEvidence
): SystemCheckEvidence => ({
  ...systemCheckEvidence,
  retentionHold: null
});

export const markSystemCheckEvidencePurged = (
  systemCheckEvidence: SystemCheckEvidence,
  input: {
    purgedAt?: string;
    purgeReasonCode?: SystemCheckEvidencePurgeReasonCode;
  } = {}
): SystemCheckEvidence => ({
  ...systemCheckEvidence,
  payloadBase64: null,
  payloadPreviewText: null,
  storageLocator: null,
  retentionHold: null,
  purgedAt: input.purgedAt ?? new Date().toISOString(),
  purgeReasonCode: input.purgeReasonCode ?? "retention_elapsed"
});

export const markSystemCheckEvidenceAccessGrantAccessed = (
  accessGrant: SystemCheckEvidenceAccessGrant,
  accessedAt: string = new Date().toISOString()
): SystemCheckEvidenceAccessGrant => ({
  ...accessGrant,
  lastAccessedAt: accessedAt
});

export const getSystemCheckEvidencePreviewText = (
  systemCheckEvidence: SystemCheckEvidence
): string | null => {
  if (typeof systemCheckEvidence.payloadPreviewText === "string") {
    return systemCheckEvidence.payloadPreviewText;
  }

  const normalizedContentType = systemCheckEvidence.contentType.toLowerCase();
  const shouldPreview =
    normalizedContentType.startsWith("text/") ||
    normalizedContentType.includes("json") ||
    normalizedContentType.includes("xml") ||
    /\.(json|log|txt|csv)$/i.test(systemCheckEvidence.fileName);

  if (!shouldPreview || !systemCheckEvidence.payloadBase64) {
    return null;
  }

  const decodedPayload = Buffer.from(systemCheckEvidence.payloadBase64, "base64").toString("utf-8").trim();
  return decodedPayload.length > 0 ? decodedPayload.slice(0, 500) : null;
};

export const createSystemCheckLaunchApproval = (input: {
  participantSessionId: string;
  tenantId: string;
  workspaceId: string;
  contentReleaseId: string;
  loginKey: string;
  groupKey: string;
  assignmentKey: string;
  warningReasonCodes: SystemCheckLaunchReadinessCode[];
  approvalScope: SystemCheckLaunchApprovalScope;
  approvedBySupervisorId: string;
  approvalNote: string;
  expiresAt?: string | null;
  approvedAt?: string;
}): SystemCheckLaunchApproval => ({
  launchApprovalId: `system-check-launch-approval-${randomUUID()}`,
  participantSessionId: input.participantSessionId,
  tenantId: input.tenantId,
  workspaceId: input.workspaceId,
  contentReleaseId: input.contentReleaseId,
  loginKey: input.loginKey,
  groupKey: input.groupKey,
  assignmentKey: input.assignmentKey,
  readinessStatus: "warning",
  warningReasonCodes: [...new Set(input.warningReasonCodes)],
  approvalScope: input.approvalScope,
  status: "active",
  approvedAt: input.approvedAt ?? new Date().toISOString(),
  approvedBySupervisorId: input.approvedBySupervisorId,
  approvalNote: input.approvalNote,
  expiresAt: input.expiresAt ?? null,
  consumedAt: null,
  consumedByTestRunId: null,
  invalidatedAt: null,
  invalidationReasonCode: null,
  invalidationReasonDetail: null,
  expiredAt: null,
  expirationReasonCode: null,
  revokedAt: null,
  revokedBySupervisorId: null,
  revocationNote: null
});

export const consumeSystemCheckLaunchApproval = (input: {
  launchApproval: SystemCheckLaunchApproval;
  testRunId: string;
  consumedAt?: string;
}): SystemCheckLaunchApproval => ({
  ...input.launchApproval,
  status: "consumed",
  consumedAt: input.consumedAt ?? new Date().toISOString(),
  consumedByTestRunId: input.testRunId
});

export const invalidateSystemCheckLaunchApproval = (input: {
  launchApproval: SystemCheckLaunchApproval;
  reasonCode: SystemCheckLaunchApprovalInvalidationReasonCode;
  reasonDetail: string;
  invalidatedAt?: string;
}): SystemCheckLaunchApproval => ({
  ...input.launchApproval,
  status: "invalidated",
  invalidatedAt: input.invalidatedAt ?? new Date().toISOString(),
  invalidationReasonCode: input.reasonCode,
  invalidationReasonDetail: input.reasonDetail
});

export const expireSystemCheckLaunchApproval = (input: {
  launchApproval: SystemCheckLaunchApproval;
  expiredAt?: string;
  reasonCode?: SystemCheckLaunchApprovalExpirationReasonCode;
}): SystemCheckLaunchApproval => ({
  ...input.launchApproval,
  status: "expired",
  expiredAt: input.expiredAt ?? new Date().toISOString(),
  expirationReasonCode: input.reasonCode ?? "time_elapsed"
});

export const revokeSystemCheckLaunchApproval = (input: {
  launchApproval: SystemCheckLaunchApproval;
  revokedBySupervisorId: string;
  revocationNote: string;
  revokedAt?: string;
}): SystemCheckLaunchApproval => ({
  ...input.launchApproval,
  status: "revoked",
  revokedAt: input.revokedAt ?? new Date().toISOString(),
  revokedBySupervisorId: input.revokedBySupervisorId,
  revocationNote: input.revocationNote
});

const compareSubmittedAtDescending = (
  left: SystemCheckSubmission,
  right: SystemCheckSubmission
): number =>
  Date.parse(right.submittedAt) - Date.parse(left.submittedAt);

export const evaluateSystemCheckLaunchReadiness = (input: {
  contentRelease: ContentRelease;
  submissions: SystemCheckSubmission[];
}): SystemCheckLaunchReadiness => {
  const latestSubmissionBySystemCheckKey = new Map<string, SystemCheckSubmission>();

  for (const submission of [...input.submissions].sort(compareSubmittedAtDescending)) {
    if (!latestSubmissionBySystemCheckKey.has(submission.systemCheckKey)) {
      latestSubmissionBySystemCheckKey.set(submission.systemCheckKey, submission);
    }
  }

  const checks = input.contentRelease.canonicalSnapshot.systemCheckDefinitions.map(systemCheckDefinition => {
    const submission = latestSubmissionBySystemCheckKey.get(systemCheckDefinition.systemCheckKey) ?? null;

    if (!submission) {
      return {
        systemCheckKey: systemCheckDefinition.systemCheckKey,
        readinessStatus: "blocked",
        reasonCodes: ["missing_submission"],
        submission: null
      } satisfies SystemCheckLaunchCheckReadiness;
    }

    if (submission.reviewStatus === "rejected") {
      return {
        systemCheckKey: systemCheckDefinition.systemCheckKey,
        readinessStatus: "blocked",
        reasonCodes: ["rejected"],
        submission
      } satisfies SystemCheckLaunchCheckReadiness;
    }

    if (submission.reviewStatus === "needs_follow_up") {
      return {
        systemCheckKey: systemCheckDefinition.systemCheckKey,
        readinessStatus: "blocked",
        reasonCodes: ["requires_follow_up"],
        submission
      } satisfies SystemCheckLaunchCheckReadiness;
    }

    if (submission.reviewStatus === "accepted" && submission.status === "failed") {
      return {
        systemCheckKey: systemCheckDefinition.systemCheckKey,
        readinessStatus: "warning",
        reasonCodes: ["accepted_with_failure"],
        submission
      } satisfies SystemCheckLaunchCheckReadiness;
    }

    if (submission.reviewStatus === "accepted" && submission.status === "warning") {
      return {
        systemCheckKey: systemCheckDefinition.systemCheckKey,
        readinessStatus: "warning",
        reasonCodes: ["accepted_with_warning"],
        submission
      } satisfies SystemCheckLaunchCheckReadiness;
    }

    if (submission.reviewStatus === "pending" && submission.status !== "passed") {
      return {
        systemCheckKey: systemCheckDefinition.systemCheckKey,
        readinessStatus: "blocked",
        reasonCodes: ["pending_review"],
        submission
      } satisfies SystemCheckLaunchCheckReadiness;
    }

    return {
      systemCheckKey: systemCheckDefinition.systemCheckKey,
      readinessStatus: "ready",
      reasonCodes: [],
      submission
    } satisfies SystemCheckLaunchCheckReadiness;
  });

  const blockingReasonCodes = [
    ...new Set(
      checks
        .filter(check => check.readinessStatus === "blocked")
        .flatMap(check => check.reasonCodes)
    )
  ];
  const warningReasonCodes = [
    ...new Set(
      checks
        .filter(check => check.readinessStatus === "warning")
        .flatMap(check => check.reasonCodes)
    )
  ];

  return {
    status: blockingReasonCodes.length > 0 ? "blocked" : warningReasonCodes.length > 0 ? "warning" : "ready",
    blockingReasonCodes,
    warningReasonCodes,
    checks
  };
};

export const reviewSystemCheckSubmission = (input: {
  submission: SystemCheckSubmission;
  reviewStatus: Exclude<SystemCheckReviewStatus, "pending">;
  reviewNote: string | null;
  reviewedAt?: string;
  reviewedByActorType: "platform_api" | "participant" | "monitor" | "worker" | "dispatcher";
  reviewedByActorId: string;
}): SystemCheckSubmission => ({
  ...input.submission,
  reviewStatus: input.reviewStatus,
  reviewNote: input.reviewNote,
  reviewedAt: input.reviewedAt ?? new Date().toISOString(),
  reviewedByActorType: input.reviewedByActorType,
  reviewedByActorId: input.reviewedByActorId
});

export const getSystemCheckDefinition = (
  contentRelease: ContentRelease,
  systemCheckKey: string
): SystemCheckDefinition | undefined =>
  contentRelease.canonicalSnapshot.systemCheckDefinitions.find(
    systemCheckDefinition => systemCheckDefinition.systemCheckKey === systemCheckKey
  );
