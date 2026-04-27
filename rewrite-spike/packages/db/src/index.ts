import { Pool, type QueryResultRow } from "pg";

import {
  defaultEvidenceRetentionClassPolicy,
  defaultNotificationPolicy,
  defaultNotificationProviderPromotionPolicy,
  defaultNotificationProviderProfiles
} from "@testcenter-rewrite/domain";
import type {
  ActivationPolicyOverrideRecords,
  AuditEvent,
  ContentRelease,
  EvidenceRetentionClassPolicy,
  EvidenceRetentionClassPolicyEntry,
  EvidenceRetentionHoldReasonDefinition,
  EvidenceRetentionHoldReasonCode,
  EvidenceRetentionHoldReasonSeverity,
  EvidenceRetentionClassPolicyOverrideRecords,
  EvidenceRetentionPolicyOverrideRecords,
  ImportJob,
  LaunchApprovalPolicyOverrideRecords,
  MonitorCommand,
  NotificationProviderProfileIncident,
  NotificationProviderPromotionPolicy,
  NotificationProviderPromotionPolicyOverrideRecords,
  NotificationPolicyOverrideRecords,
  OperationalPolicyOverrideRecords,
  PolicyOverrideRecord,
  ParticipantSession,
  SourcePackage,
  SystemCheckEvidence,
  SystemCheckEvidenceAccessGrant,
  SystemCheckEvidenceBreachNotification,
  SystemCheckLaunchApproval,
  SystemCheckSubmission,
  Tenant,
  TestRun,
  Workspace
} from "@testcenter-rewrite/domain";

export { runMigrations, type MigrationRunResult, type DatabaseMigration } from "./migrations.js";

import { runMigrations } from "./migrations.js";

export const defaultDatabaseUrl = "postgresql://postgres:postgres@127.0.0.1:55432/testcenter_rewrite_spike";
export const monitorCommandDispatchQueueChannel = "monitor_command_dispatch_queue";
export const breachNotificationDispatchQueueChannel = "system_check_evidence_breach_notification_queue";

const legacyOperationalPolicyOverrideMetadata = {
  updatedAt: new Date(0).toISOString(),
  updatedByRequestId: "legacy-operational-policy-override",
  updatedByActorType: "platform_api" as const,
  updatedByActorId: "legacy-operational-policy-override"
};

const legacyLaunchApprovalPolicyOverrideMetadata = {
  updatedAt: new Date(0).toISOString(),
  updatedByRequestId: "legacy-launch-approval-policy-override",
  updatedByActorType: "platform_api" as const,
  updatedByActorId: "legacy-launch-approval-policy-override"
};

const legacyNotificationProviderPromotionPolicyOverrideMetadata = {
  updatedAt: new Date(0).toISOString(),
  updatedByRequestId: "legacy-notification-provider-promotion-policy-override",
  updatedByActorType: "platform_api" as const,
  updatedByActorId: "legacy-notification-provider-promotion-policy-override"
};

const legacyNotificationPolicyOverrideMetadata = {
  updatedAt: new Date(0).toISOString(),
  updatedByRequestId: "legacy-notification-policy-override",
  updatedByActorType: "platform_api" as const,
  updatedByActorId: "legacy-notification-policy-override"
};

const legacyNotificationProviderProfileOverrideMetadata = {
  updatedAt: new Date(0).toISOString(),
  updatedByRequestId: "legacy-notification-provider-profile-override",
  updatedByActorType: "platform_api" as const,
  updatedByActorId: "legacy-notification-provider-profile-override"
};

const legacyEvidenceRetentionPolicyOverrideMetadata = {
  updatedAt: new Date(0).toISOString(),
  updatedByRequestId: "legacy-evidence-retention-policy-override",
  updatedByActorType: "platform_api" as const,
  updatedByActorId: "legacy-evidence-retention-policy-override"
};

const legacyEvidenceRetentionClassPolicyOverrideMetadata = {
  updatedAt: new Date(0).toISOString(),
  updatedByRequestId: "legacy-evidence-retention-class-policy-override",
  updatedByActorType: "platform_api" as const,
  updatedByActorId: "legacy-evidence-retention-class-policy-override"
};

const legacyActivationPolicyOverrideMetadata = {
  updatedAt: new Date(0).toISOString(),
  updatedByRequestId: "legacy-activation-policy-override",
  updatedByActorType: "platform_api" as const,
  updatedByActorId: "legacy-activation-policy-override"
};

const mapActivationPolicyOverrideRecords = (value: unknown): ActivationPolicyOverrideRecords | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;
  const records: ActivationPolicyOverrideRecords = {};

  for (const fieldKey of [
    "blockIncompatibleRoutingChangesWithActiveSessions",
    "warnOnActiveSessions",
    "warnOnHighRiskReleaseChange"
  ] as const) {
    const fieldValue = source[fieldKey];

    if (typeof fieldValue === "boolean") {
      records[fieldKey] = {
        value: fieldValue,
        ...legacyActivationPolicyOverrideMetadata
      };
      continue;
    }

    if (!fieldValue || typeof fieldValue !== "object") {
      continue;
    }

    const recordValue = fieldValue as Record<string, unknown>;

    if (
      typeof recordValue.value === "boolean" &&
      typeof recordValue.updatedAt === "string" &&
      typeof recordValue.updatedByRequestId === "string" &&
      typeof recordValue.updatedByActorType === "string" &&
      typeof recordValue.updatedByActorId === "string"
    ) {
      records[fieldKey] = {
        value: recordValue.value,
        updatedAt: recordValue.updatedAt,
        updatedByRequestId: recordValue.updatedByRequestId,
        updatedByActorType: recordValue.updatedByActorType as "platform_api" | "participant" | "monitor" | "worker" | "dispatcher",
        updatedByActorId: recordValue.updatedByActorId
      };
    }
  }

  return Object.keys(records).length > 0 ? records : null;
};

const mapOperationalPolicyOverrideRecords = (value: unknown): OperationalPolicyOverrideRecords | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;
  const records: OperationalPolicyOverrideRecords = {};

  for (const fieldKey of [
    "monitorCommandTtlSeconds",
    "monitorCommandLeaseSeconds",
    "timedRunMaintenanceGraceSeconds"
  ] as const) {
    const fieldValue = source[fieldKey];

    if (typeof fieldValue === "number" && Number.isInteger(fieldValue)) {
      records[fieldKey] = {
        value: fieldValue,
        ...legacyOperationalPolicyOverrideMetadata
      };
      continue;
    }

    if (!fieldValue || typeof fieldValue !== "object") {
      continue;
    }

    const recordValue = fieldValue as Record<string, unknown>;

    if (
      typeof recordValue.value === "number" &&
      Number.isInteger(recordValue.value) &&
      typeof recordValue.updatedAt === "string" &&
      typeof recordValue.updatedByRequestId === "string" &&
      typeof recordValue.updatedByActorType === "string" &&
      typeof recordValue.updatedByActorId === "string"
    ) {
      records[fieldKey] = {
        value: recordValue.value,
        updatedAt: recordValue.updatedAt,
        updatedByRequestId: recordValue.updatedByRequestId,
        updatedByActorType: recordValue.updatedByActorType as "platform_api" | "participant" | "monitor" | "worker" | "dispatcher",
        updatedByActorId: recordValue.updatedByActorId
      };
    }
  }

  return Object.keys(records).length > 0 ? records : null;
};

const mapLaunchApprovalPolicyOverrideRecords = (
  value: unknown
): LaunchApprovalPolicyOverrideRecords | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;
  const records: LaunchApprovalPolicyOverrideRecords = {};

  for (const fieldKey of [
    "systemCheckLaunchApprovalTtlSeconds"
  ] as const) {
    const fieldValue = source[fieldKey];

    if (typeof fieldValue === "number" && Number.isInteger(fieldValue)) {
      records[fieldKey] = {
        value: fieldValue,
        ...legacyLaunchApprovalPolicyOverrideMetadata
      };
      continue;
    }

    if (!fieldValue || typeof fieldValue !== "object") {
      continue;
    }

    const recordValue = fieldValue as Record<string, unknown>;

    if (
      typeof recordValue.value === "number" &&
      Number.isInteger(recordValue.value) &&
      typeof recordValue.updatedAt === "string" &&
      typeof recordValue.updatedByRequestId === "string" &&
      typeof recordValue.updatedByActorType === "string" &&
      typeof recordValue.updatedByActorId === "string"
    ) {
      records[fieldKey] = {
        value: recordValue.value,
        updatedAt: recordValue.updatedAt,
        updatedByRequestId: recordValue.updatedByRequestId,
        updatedByActorType: recordValue.updatedByActorType as
          "platform_api" | "participant" | "monitor" | "worker" | "dispatcher",
        updatedByActorId: recordValue.updatedByActorId
      };
    }
  }

  return Object.keys(records).length > 0 ? records : null;
};

const mapNotificationPolicyOverrideRecords = (
  value: unknown
): NotificationPolicyOverrideRecords | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;
  const records: NotificationPolicyOverrideRecords = {};

  const selectionMode = source.breachNotificationDeliverySelectionMode;

  if (typeof selectionMode === "string") {
    if (
      selectionMode === "infer_from_target" ||
      selectionMode === "force_webhook_spike" ||
      selectionMode === "force_email_spike"
    ) {
      records.breachNotificationDeliverySelectionMode = {
        value: selectionMode,
        ...legacyNotificationPolicyOverrideMetadata
      };
    }
  } else if (selectionMode && typeof selectionMode === "object") {
    const recordValue = selectionMode as Record<string, unknown>;

    if (
      typeof recordValue.value === "string" &&
      (recordValue.value === "infer_from_target" ||
        recordValue.value === "force_webhook_spike" ||
        recordValue.value === "force_email_spike") &&
      typeof recordValue.updatedAt === "string" &&
      typeof recordValue.updatedByRequestId === "string" &&
      typeof recordValue.updatedByActorType === "string" &&
      typeof recordValue.updatedByActorId === "string"
    ) {
      records.breachNotificationDeliverySelectionMode = {
        value: recordValue.value,
        updatedAt: recordValue.updatedAt,
        updatedByRequestId: recordValue.updatedByRequestId,
        updatedByActorType: recordValue.updatedByActorType as
          "platform_api" | "participant" | "monitor" | "worker" | "dispatcher",
        updatedByActorId: recordValue.updatedByActorId
      };
    }
  }

  const legacyRetryDelay = source.breachNotificationRetryDelaySeconds;
  const legacyMaxAttempts = source.breachNotificationMaxDeliveryAttempts;

  for (const fieldKey of [
    "webhookSpikeRetryDelaySeconds",
    "webhookSpikeMaxDeliveryAttempts",
    "emailSpikeRetryDelaySeconds",
    "emailSpikeMaxDeliveryAttempts"
  ] as const) {
    const fallbackLegacyValue =
      fieldKey === "webhookSpikeRetryDelaySeconds" || fieldKey === "emailSpikeRetryDelaySeconds"
        ? legacyRetryDelay
        : legacyMaxAttempts;
    const fieldValue = source[fieldKey];

    if (typeof fieldValue === "number" && Number.isFinite(fieldValue)) {
      records[fieldKey] = {
        value: fieldValue,
        ...legacyNotificationPolicyOverrideMetadata
      };
      continue;
    }

    if (typeof fallbackLegacyValue === "number" && Number.isFinite(fallbackLegacyValue)) {
      records[fieldKey] = {
        value: fallbackLegacyValue,
        ...legacyNotificationPolicyOverrideMetadata
      };
      continue;
    }

    if (!fieldValue || typeof fieldValue !== "object") {
      continue;
    }

    const recordValue = fieldValue as Record<string, unknown>;

    if (
      typeof recordValue.value === "number" &&
      Number.isFinite(recordValue.value) &&
      typeof recordValue.updatedAt === "string" &&
      typeof recordValue.updatedByRequestId === "string" &&
      typeof recordValue.updatedByActorType === "string" &&
      typeof recordValue.updatedByActorId === "string"
    ) {
      records[fieldKey] = {
        value: recordValue.value,
        updatedAt: recordValue.updatedAt,
        updatedByRequestId: recordValue.updatedByRequestId,
        updatedByActorType: recordValue.updatedByActorType as
          "platform_api" | "participant" | "monitor" | "worker" | "dispatcher",
        updatedByActorId: recordValue.updatedByActorId
      };
    }
  }

  return Object.keys(records).length > 0 ? records : null;
};

const mapNotificationProviderPromotionPolicy = (
  value: unknown
): NotificationProviderPromotionPolicy | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;

  if (
    typeof source.evaluationWindowHours !== "number" ||
    !Number.isInteger(source.evaluationWindowHours) ||
    source.evaluationWindowHours <= 0 ||
    typeof source.minimumRequestedCount !== "number" ||
    !Number.isInteger(source.minimumRequestedCount) ||
    source.minimumRequestedCount < 0 ||
    typeof source.minimumDirectSelectionCount !== "number" ||
    !Number.isInteger(source.minimumDirectSelectionCount) ||
    source.minimumDirectSelectionCount < 0 ||
    typeof source.minimumDeliveredCount !== "number" ||
    !Number.isInteger(source.minimumDeliveredCount) ||
    source.minimumDeliveredCount < 0 ||
    typeof source.maximumDeliveryFailedCount !== "number" ||
    !Number.isInteger(source.maximumDeliveryFailedCount) ||
    source.maximumDeliveryFailedCount < 0
  ) {
    return null;
  }

  return {
    evaluationWindowHours: source.evaluationWindowHours,
    minimumRequestedCount: source.minimumRequestedCount,
    minimumDirectSelectionCount: source.minimumDirectSelectionCount,
    minimumDeliveredCount: source.minimumDeliveredCount,
    maximumDeliveryFailedCount: source.maximumDeliveryFailedCount,
    autoPromoteEnabled:
      typeof source.autoPromoteEnabled === "boolean"
        ? source.autoPromoteEnabled
        : defaultNotificationProviderPromotionPolicy.autoPromoteEnabled,
    autoRollbackOnFailureEnabled:
      typeof source.autoRollbackOnFailureEnabled === "boolean"
        ? source.autoRollbackOnFailureEnabled
        : defaultNotificationProviderPromotionPolicy.autoRollbackOnFailureEnabled,
    autoPromotionSuppressionSeconds:
      typeof source.autoPromotionSuppressionSeconds === "number" &&
      Number.isInteger(source.autoPromotionSuppressionSeconds) &&
      source.autoPromotionSuppressionSeconds >= 0
        ? source.autoPromotionSuppressionSeconds
        : defaultNotificationProviderPromotionPolicy.autoPromotionSuppressionSeconds
  };
};

const mapNotificationProviderPromotionPolicyOverrideRecords = (
  value: unknown
): NotificationProviderPromotionPolicyOverrideRecords | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;
  const records: NotificationProviderPromotionPolicyOverrideRecords = {};

  for (const fieldKey of [
    "evaluationWindowHours",
    "minimumRequestedCount",
    "minimumDirectSelectionCount",
    "minimumDeliveredCount",
    "maximumDeliveryFailedCount",
    "autoPromotionSuppressionSeconds"
  ] as const) {
    const fieldValue = source[fieldKey];

    if (typeof fieldValue === "number" && Number.isInteger(fieldValue)) {
      if ((fieldKey === "evaluationWindowHours" && fieldValue <= 0) || fieldValue < 0) {
        continue;
      }

      records[fieldKey] = {
        value: fieldValue,
        ...legacyNotificationProviderPromotionPolicyOverrideMetadata
      };
      continue;
    }

    if (!fieldValue || typeof fieldValue !== "object") {
      continue;
    }

    const recordValue = fieldValue as Record<string, unknown>;

    if (
      typeof recordValue.value === "number" &&
      Number.isInteger(recordValue.value) &&
      (fieldKey === "evaluationWindowHours" ? recordValue.value > 0 : recordValue.value >= 0) &&
      typeof recordValue.updatedAt === "string" &&
      typeof recordValue.updatedByRequestId === "string" &&
      typeof recordValue.updatedByActorType === "string" &&
      typeof recordValue.updatedByActorId === "string"
    ) {
      records[fieldKey] = {
        value: recordValue.value,
        updatedAt: recordValue.updatedAt,
        updatedByRequestId: recordValue.updatedByRequestId,
        updatedByActorType: recordValue.updatedByActorType as
          | "platform_api"
          | "participant"
          | "monitor"
          | "worker"
          | "dispatcher"
          | "notification_service",
        updatedByActorId: recordValue.updatedByActorId
      };
    }
  }

  for (const fieldKey of [
    "autoPromoteEnabled",
    "autoRollbackOnFailureEnabled"
  ] as const) {
    const fieldValue = source[fieldKey];

    if (typeof fieldValue === "boolean") {
      records[fieldKey] = {
        value: fieldValue,
        ...legacyNotificationProviderPromotionPolicyOverrideMetadata
      };
      continue;
    }

    if (!fieldValue || typeof fieldValue !== "object") {
      continue;
    }

    const recordValue = fieldValue as Record<string, unknown>;

    if (
      typeof recordValue.value === "boolean" &&
      typeof recordValue.updatedAt === "string" &&
      typeof recordValue.updatedByRequestId === "string" &&
      typeof recordValue.updatedByActorType === "string" &&
      typeof recordValue.updatedByActorId === "string"
    ) {
      records[fieldKey] = {
        value: recordValue.value,
        updatedAt: recordValue.updatedAt,
        updatedByRequestId: recordValue.updatedByRequestId,
        updatedByActorType: recordValue.updatedByActorType as
          "platform_api" | "participant" | "monitor" | "worker" | "dispatcher",
        updatedByActorId: recordValue.updatedByActorId
      };
    }
  }

  return Object.keys(records).length > 0 ? records : null;
};

const mapNotificationProviderProfileOverrideRecords = (
  value: unknown
): Workspace["notificationProviderProfileOverrideRecords"] => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }

  const source = value as Record<string, unknown>;
  const records: NonNullable<Workspace["notificationProviderProfileOverrideRecords"]> = {};

  for (const [profileKey, fieldValue] of Object.entries(source)) {
    if (!fieldValue || typeof fieldValue !== "object" || Array.isArray(fieldValue)) {
      continue;
    }

    const recordValue = fieldValue as Record<string, unknown>;

    if (
      "value" in recordValue &&
      recordValue.value === null &&
      typeof recordValue.updatedAt === "string" &&
      typeof recordValue.updatedByRequestId === "string" &&
      typeof recordValue.updatedByActorType === "string" &&
      typeof recordValue.updatedByActorId === "string"
    ) {
      records[profileKey] = {
        value: null,
        updatedAt: recordValue.updatedAt,
        updatedByRequestId: recordValue.updatedByRequestId,
        updatedByActorType: recordValue.updatedByActorType as
          "platform_api" | "participant" | "monitor" | "worker" | "dispatcher" | "notification_service",
        updatedByActorId: recordValue.updatedByActorId
      };
      continue;
    }

    const candidateProfileValue =
      "value" in recordValue && recordValue.value && typeof recordValue.value === "object"
        ? (recordValue.value as Record<string, unknown>)
        : recordValue;

    if (
      typeof candidateProfileValue.profileKey !== "string" ||
      candidateProfileValue.profileKey.trim().length === 0 ||
      typeof candidateProfileValue.displayLabel !== "string" ||
      candidateProfileValue.displayLabel.trim().length === 0 ||
      !(
        typeof candidateProfileValue.enabled === "boolean" ||
        typeof candidateProfileValue.enabled === "undefined"
      ) ||
      !(
        candidateProfileValue.rolloutState === "active" ||
        candidateProfileValue.rolloutState === "paused" ||
        candidateProfileValue.rolloutState === "canary" ||
        typeof candidateProfileValue.rolloutState === "undefined"
      ) ||
      !(
        (
          typeof candidateProfileValue.rolloutPercentage === "number" &&
          Number.isInteger(candidateProfileValue.rolloutPercentage) &&
          candidateProfileValue.rolloutPercentage >= 0 &&
          candidateProfileValue.rolloutPercentage <= 100
        ) ||
        typeof candidateProfileValue.rolloutPercentage === "undefined"
      ) ||
      !(
        typeof candidateProfileValue.rolloutFallbackProfileKey === "string" ||
        candidateProfileValue.rolloutFallbackProfileKey === null ||
        typeof candidateProfileValue.rolloutFallbackProfileKey === "undefined"
      ) ||
      !(
        candidateProfileValue.targetProbeMode === "active" ||
        candidateProfileValue.targetProbeMode === "skip" ||
        typeof candidateProfileValue.targetProbeMode === "undefined"
      ) ||
      (candidateProfileValue.deliveryChannel !== "webhook_spike" &&
        candidateProfileValue.deliveryChannel !== "email_spike") ||
      typeof candidateProfileValue.target !== "string" ||
      candidateProfileValue.target.trim().length === 0 ||
      !(
        typeof candidateProfileValue.credentialsRef === "string" ||
        candidateProfileValue.credentialsRef === null ||
        typeof candidateProfileValue.credentialsRef === "undefined"
      )
    ) {
      continue;
    }

    const operationalStateCandidate =
      candidateProfileValue.operationalState &&
      typeof candidateProfileValue.operationalState === "object" &&
      !Array.isArray(candidateProfileValue.operationalState)
        ? (candidateProfileValue.operationalState as Record<string, unknown>)
        : null;
    const incidentStateCandidate =
      candidateProfileValue.incidentState &&
      typeof candidateProfileValue.incidentState === "object" &&
      !Array.isArray(candidateProfileValue.incidentState)
        ? (candidateProfileValue.incidentState as Record<string, unknown>)
        : null;

    const normalizedProfile = {
      profileKey: candidateProfileValue.profileKey.trim(),
      displayLabel: candidateProfileValue.displayLabel.trim(),
      enabled:
        typeof candidateProfileValue.enabled === "boolean" ? candidateProfileValue.enabled : true,
      rolloutState:
        candidateProfileValue.rolloutState === "active" ||
        candidateProfileValue.rolloutState === "paused" ||
        candidateProfileValue.rolloutState === "canary"
          ? candidateProfileValue.rolloutState
          : "active",
      rolloutPercentage:
        typeof candidateProfileValue.rolloutPercentage === "number" &&
        Number.isInteger(candidateProfileValue.rolloutPercentage) &&
        candidateProfileValue.rolloutPercentage >= 0 &&
        candidateProfileValue.rolloutPercentage <= 100
          ? candidateProfileValue.rolloutPercentage
          : 100,
      rolloutFallbackProfileKey:
        typeof candidateProfileValue.rolloutFallbackProfileKey === "string" &&
        candidateProfileValue.rolloutFallbackProfileKey.trim().length > 0
          ? candidateProfileValue.rolloutFallbackProfileKey.trim()
          : null,
      targetProbeMode:
        candidateProfileValue.targetProbeMode === "skip"
          ? "skip"
          : "active",
      deliveryChannel: candidateProfileValue.deliveryChannel,
      target: candidateProfileValue.target.trim(),
      credentialsRef:
        typeof candidateProfileValue.credentialsRef === "string"
          ? candidateProfileValue.credentialsRef
          : null,
      incidentState:
        incidentStateCandidate &&
        incidentStateCandidate.incidentType === "auto_rollback_failure" &&
        typeof incidentStateCandidate.openedAt === "string" &&
        (
          incidentStateCandidate.openedByActorType === "worker" ||
          incidentStateCandidate.openedByActorType === "notification_service" ||
          incidentStateCandidate.openedByActorType === "platform_api"
        ) &&
        typeof incidentStateCandidate.openedByActorId === "string" &&
        incidentStateCandidate.reasonCode === "delivery_failures_present" &&
        typeof incidentStateCandidate.deliveryFailedCount === "number" &&
        Number.isInteger(incidentStateCandidate.deliveryFailedCount) &&
        incidentStateCandidate.deliveryFailedCount >= 0 &&
        (
          typeof incidentStateCandidate.suppressionUntil === "string" ||
          incidentStateCandidate.suppressionUntil === null
        ) &&
        (
          typeof incidentStateCandidate.resolvedAt === "string" ||
          incidentStateCandidate.resolvedAt === null
        ) &&
        (
          incidentStateCandidate.resolutionCode === "auto_promoted" ||
          incidentStateCandidate.resolutionCode === "manually_promoted" ||
          incidentStateCandidate.resolutionCode === null
        )
          ? {
              incidentType: "auto_rollback_failure" as const,
              openedAt: incidentStateCandidate.openedAt as string,
              openedByActorType: incidentStateCandidate.openedByActorType as
                "worker" | "notification_service" | "platform_api",
              openedByActorId: incidentStateCandidate.openedByActorId as string,
              reasonCode: "delivery_failures_present" as const,
              deliveryFailedCount: incidentStateCandidate.deliveryFailedCount as number,
              suppressionUntil: incidentStateCandidate.suppressionUntil as string | null,
              resolvedAt: incidentStateCandidate.resolvedAt as string | null,
              resolutionCode: incidentStateCandidate.resolutionCode as
                "auto_promoted" | "manually_promoted" | null
            }
          : null,
      operationalState:
        operationalStateCandidate &&
        typeof operationalStateCandidate.lastCheckedAt === "string" &&
        (
          operationalStateCandidate.lastCheckedByActorType === "worker" ||
          operationalStateCandidate.lastCheckedByActorType === "notification_service" ||
          operationalStateCandidate.lastCheckedByActorType === "platform_api"
        ) &&
        typeof operationalStateCandidate.lastCheckedByActorId === "string" &&
        (
          operationalStateCandidate.credentialsStatus === "not_configured" ||
          operationalStateCandidate.credentialsStatus === "reachable" ||
          operationalStateCandidate.credentialsStatus === "unreachable"
        ) &&
        (
          operationalStateCandidate.healthStatus === "ready" ||
          operationalStateCandidate.healthStatus === "paused" ||
          operationalStateCandidate.healthStatus === "disabled" ||
          operationalStateCandidate.healthStatus === "credentials_unreachable" ||
          operationalStateCandidate.healthStatus === "target_unreachable"
        ) &&
        (
          operationalStateCandidate.rolloutStatus === "active_ready" ||
          operationalStateCandidate.rolloutStatus === "active_blocked" ||
          operationalStateCandidate.rolloutStatus === "paused" ||
          operationalStateCandidate.rolloutStatus === "disabled" ||
          operationalStateCandidate.rolloutStatus === "canary_ready" ||
          operationalStateCandidate.rolloutStatus === "canary_blocked"
        ) &&
        (
          operationalStateCandidate.probeStatus === "succeeded" ||
          operationalStateCandidate.probeStatus === "skipped_paused" ||
          operationalStateCandidate.probeStatus === "skipped_disabled" ||
          operationalStateCandidate.probeStatus === "skipped_by_policy" ||
          operationalStateCandidate.probeStatus === "credentials_unreachable" ||
          operationalStateCandidate.probeStatus === "target_unreachable"
        ) &&
        (
          typeof operationalStateCandidate.probeTarget === "string" ||
          operationalStateCandidate.probeTarget === null
        ) &&
        (
          (
            typeof operationalStateCandidate.probeLatencyMs === "number" &&
            Number.isInteger(operationalStateCandidate.probeLatencyMs) &&
            operationalStateCandidate.probeLatencyMs >= 0
          ) ||
          operationalStateCandidate.probeLatencyMs === null
        ) &&
        (
          typeof operationalStateCandidate.lastCheckError === "string" ||
          operationalStateCandidate.lastCheckError === null
        )
          ? {
              lastCheckedAt: operationalStateCandidate.lastCheckedAt as string,
              lastCheckedByActorType: operationalStateCandidate.lastCheckedByActorType as
                "worker" | "notification_service" | "platform_api",
              lastCheckedByActorId: operationalStateCandidate.lastCheckedByActorId as string,
              credentialsStatus: operationalStateCandidate.credentialsStatus as
                "not_configured" | "reachable" | "unreachable",
              healthStatus: operationalStateCandidate.healthStatus as
                "ready" | "paused" | "disabled" | "credentials_unreachable" | "target_unreachable",
              rolloutStatus: operationalStateCandidate.rolloutStatus as
                "active_ready" | "active_blocked" | "paused" | "disabled" | "canary_ready" | "canary_blocked",
              probeStatus: operationalStateCandidate.probeStatus as
                "succeeded" | "skipped_paused" | "skipped_disabled" | "skipped_by_policy" | "credentials_unreachable" | "target_unreachable",
              probeTarget: operationalStateCandidate.probeTarget as string | null,
              probeLatencyMs: operationalStateCandidate.probeLatencyMs as number | null,
              lastCheckError: operationalStateCandidate.lastCheckError as
                string | null
            }
          : null
    } as const;

    if (
      typeof recordValue.updatedAt === "string" &&
      typeof recordValue.updatedByRequestId === "string" &&
      typeof recordValue.updatedByActorType === "string" &&
      typeof recordValue.updatedByActorId === "string" &&
      "value" in recordValue
    ) {
      records[profileKey] = {
        value: normalizedProfile,
        updatedAt: recordValue.updatedAt,
        updatedByRequestId: recordValue.updatedByRequestId,
        updatedByActorType: recordValue.updatedByActorType as
          "platform_api" | "participant" | "monitor" | "worker" | "dispatcher" | "notification_service",
        updatedByActorId: recordValue.updatedByActorId
      };
      continue;
    }

    records[profileKey] = {
      value: normalizedProfile,
      ...legacyNotificationProviderProfileOverrideMetadata
    };
  }

  return Object.keys(records).length > 0 ? records : null;
};

const mapNotificationProviderProfiles = (
  value: unknown
): Tenant["defaultNotificationProviderProfiles"] => {
  if (!Array.isArray(value)) {
    return defaultNotificationProviderProfiles;
  }

  const mappedProfiles = mapNotificationProviderProfileOverrideRecords(
    Object.fromEntries(
      value
        .filter(candidate => candidate && typeof candidate === "object" && !Array.isArray(candidate))
        .map(candidate => {
          const candidateRecord = candidate as Record<string, unknown>;
          const profileKey =
            typeof candidateRecord.profileKey === "string" ? candidateRecord.profileKey.trim() : "";

          return [profileKey, candidate];
        })
        .filter(([profileKey]) => profileKey.length > 0)
    )
  );

  return mappedProfiles
    ? Object.values(mappedProfiles)
        .map(record => record.value)
        .filter((profile): profile is NonNullable<typeof profile> => profile !== null)
    : defaultNotificationProviderProfiles;
};

const mapEvidenceRetentionPolicyOverrideRecords = (
  value: unknown
): EvidenceRetentionPolicyOverrideRecords | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;
  const records: EvidenceRetentionPolicyOverrideRecords = {};

  for (const fieldKey of [
    "systemCheckEvidenceRetentionTtlSeconds",
    "systemCheckEvidenceInvestigationRetentionTtlSeconds"
  ] as const) {
    const fieldValue = source[fieldKey];

    if (typeof fieldValue === "number" && Number.isInteger(fieldValue)) {
      records[fieldKey] = {
        value: fieldValue,
        ...legacyEvidenceRetentionPolicyOverrideMetadata
      };
      continue;
    }

    if (!fieldValue || typeof fieldValue !== "object") {
      continue;
    }

    const recordValue = fieldValue as Record<string, unknown>;

    if (
      typeof recordValue.value === "number" &&
      Number.isInteger(recordValue.value) &&
      typeof recordValue.updatedAt === "string" &&
      typeof recordValue.updatedByRequestId === "string" &&
      typeof recordValue.updatedByActorType === "string" &&
      typeof recordValue.updatedByActorId === "string"
    ) {
      records[fieldKey] = {
        value: recordValue.value,
        updatedAt: recordValue.updatedAt,
        updatedByRequestId: recordValue.updatedByRequestId,
        updatedByActorType: recordValue.updatedByActorType as
          "platform_api" | "participant" | "monitor" | "worker" | "dispatcher",
        updatedByActorId: recordValue.updatedByActorId
      };
    }
  }

  return Object.keys(records).length > 0 ? records : null;
};

const deriveLegacyHoldReasonDisplayLabel = (holdReasonCode: string): string =>
  holdReasonCode
    .split("_")
    .filter(Boolean)
    .map(segment => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");

const isEvidenceRetentionHoldReasonSeverity = (
  value: unknown
): value is EvidenceRetentionHoldReasonSeverity =>
  value === "low" || value === "medium" || value === "high";

const normalizeEvidenceRetentionHoldReasonDefinitions = (
  value: unknown
): EvidenceRetentionHoldReasonDefinition[] | null => {
  if (!Array.isArray(value) || value.length === 0) {
    return null;
  }

  const holdReasons: EvidenceRetentionHoldReasonDefinition[] = [];

  for (const entry of value) {
    if (typeof entry === "string" && entry.trim().length > 0) {
      const holdReasonCode = entry.trim();

      holdReasons.push({
        holdReasonCode,
        displayLabel: deriveLegacyHoldReasonDisplayLabel(holdReasonCode),
        workflowHint: null,
        severity: "medium",
        escalationTarget: null,
        uiGroup: null,
        acknowledgementRequired: false,
        defaultAssigneeTarget: null,
        slaSeconds: null
      });
      continue;
    }

    if (!entry || typeof entry !== "object") {
      return null;
    }

    const candidate = entry as Record<string, unknown>;
    const holdReasonCode =
      typeof candidate.holdReasonCode === "string" && candidate.holdReasonCode.trim().length > 0
        ? candidate.holdReasonCode.trim()
        : null;
    const displayLabel =
      typeof candidate.displayLabel === "string" && candidate.displayLabel.trim().length > 0
        ? candidate.displayLabel.trim()
        : null;
    const workflowHint =
      typeof candidate.workflowHint === "string"
        ? candidate.workflowHint.trim() || null
        : candidate.workflowHint === null || candidate.workflowHint === undefined
          ? null
          : undefined;
    const severity = isEvidenceRetentionHoldReasonSeverity(candidate.severity)
      ? candidate.severity
      : candidate.severity === undefined
        ? "medium"
        : null;
    const escalationTarget =
      typeof candidate.escalationTarget === "string"
        ? candidate.escalationTarget.trim() || null
        : candidate.escalationTarget === null || candidate.escalationTarget === undefined
          ? null
          : undefined;
    const uiGroup =
      typeof candidate.uiGroup === "string"
        ? candidate.uiGroup.trim() || null
        : candidate.uiGroup === null || candidate.uiGroup === undefined
          ? null
          : undefined;
    const acknowledgementRequired =
      typeof candidate.acknowledgementRequired === "boolean"
        ? candidate.acknowledgementRequired
        : candidate.acknowledgementRequired === undefined
          ? false
          : null;
    const defaultAssigneeTarget =
      typeof candidate.defaultAssigneeTarget === "string"
        ? candidate.defaultAssigneeTarget.trim() || null
        : candidate.defaultAssigneeTarget === null || candidate.defaultAssigneeTarget === undefined
          ? null
          : undefined;
    const slaSeconds =
      typeof candidate.slaSeconds === "number" &&
      Number.isInteger(candidate.slaSeconds) &&
      candidate.slaSeconds >= 0
        ? candidate.slaSeconds
        : candidate.slaSeconds === null || candidate.slaSeconds === undefined
          ? null
          : undefined;

    if (
      !holdReasonCode ||
      !displayLabel ||
      workflowHint === undefined ||
      !severity ||
      escalationTarget === undefined ||
      uiGroup === undefined ||
      acknowledgementRequired === null ||
      defaultAssigneeTarget === undefined ||
      slaSeconds === undefined
    ) {
      return null;
    }

    holdReasons.push({
      holdReasonCode,
      displayLabel,
      workflowHint,
      severity,
      escalationTarget,
      uiGroup,
      acknowledgementRequired,
      defaultAssigneeTarget,
      slaSeconds
    });
  }

  if (
    holdReasons.length !== value.length ||
    new Set(holdReasons.map(entry => entry.holdReasonCode)).size !== holdReasons.length
  ) {
    return null;
  }

  return holdReasons;
};

const mapEvidenceRetentionClassPolicyEntry = (
  value: unknown
): EvidenceRetentionClassPolicyEntry | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;

  if (
    typeof source.retentionClass !== "string" ||
    typeof source.retentionPolicyKey !== "string" ||
    (source.ttlFieldKey !== "systemCheckEvidenceRetentionTtlSeconds" &&
      source.ttlFieldKey !== "systemCheckEvidenceInvestigationRetentionTtlSeconds") ||
    typeof source.manualHoldAllowed !== "boolean" ||
    typeof source.payloadAccessGrantsAllowed !== "boolean" ||
    !Array.isArray(source.holdTransitions)
  ) {
    return null;
  }

  const holdTransitions = source.holdTransitions.flatMap(transition => {
    if (!transition || typeof transition !== "object") {
      return [];
    }

    const transitionValue = transition as Record<string, unknown>;

    if (
      typeof transitionValue.holdReasonCode === "string" &&
      transitionValue.holdReasonCode.trim().length > 0 &&
      typeof transitionValue.targetRetentionClass === "string"
    ) {
      const holdReasonCode = transitionValue.holdReasonCode.trim() as EvidenceRetentionHoldReasonCode;

      return [
        {
          holdReasonCode,
          targetRetentionClass: transitionValue.targetRetentionClass
        }
      ];
    }

    return [];
  });

  if (holdTransitions.length !== source.holdTransitions.length) {
    return null;
  }

  return {
    retentionClass: source.retentionClass,
    retentionPolicyKey: source.retentionPolicyKey,
    ttlFieldKey: source.ttlFieldKey,
    manualHoldAllowed: source.manualHoldAllowed,
    payloadAccessGrantsAllowed: source.payloadAccessGrantsAllowed,
    holdTransitions
  };
};

const mapEvidenceRetentionClassPolicy = (value: unknown): EvidenceRetentionClassPolicy | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;

  if (typeof source.defaultCaptureRetentionClass !== "string" || !Array.isArray(source.classes)) {
    return null;
  }

  const classes = source.classes.map(mapEvidenceRetentionClassPolicyEntry);

  if (classes.some(entry => !entry)) {
    return null;
  }

  const normalizedClasses = classes as EvidenceRetentionClassPolicyEntry[];
  const holdReasons =
    normalizeEvidenceRetentionHoldReasonDefinitions(source.holdReasons) ??
    normalizeEvidenceRetentionHoldReasonDefinitions(source.holdReasonCodes) ??
    Array.from(
      new Set(
        normalizedClasses.flatMap(entry =>
          entry.holdTransitions.map(transition => transition.holdReasonCode)
        )
      )
    ).map(holdReasonCode => ({
      holdReasonCode,
      displayLabel: deriveLegacyHoldReasonDisplayLabel(holdReasonCode),
      workflowHint: null,
      severity: "medium",
      escalationTarget: null,
      uiGroup: null,
      acknowledgementRequired: false,
      defaultAssigneeTarget: null,
      slaSeconds: null
    }));

  if (
    holdReasons.length === 0 ||
    new Set(normalizedClasses.map(entry => entry.retentionClass)).size !== normalizedClasses.length ||
    new Set(normalizedClasses.map(entry => entry.retentionPolicyKey)).size !== normalizedClasses.length ||
    !normalizedClasses.some(entry => entry.retentionClass === source.defaultCaptureRetentionClass) ||
    normalizedClasses.some(entry =>
      entry.holdTransitions.some(
        transition =>
          !holdReasons.some(entry => entry.holdReasonCode === transition.holdReasonCode) ||
          !normalizedClasses.some(
            candidate => candidate.retentionClass === transition.targetRetentionClass
          )
      )
    )
  ) {
    return null;
  }

  return {
    holdReasons,
    defaultCaptureRetentionClass: source.defaultCaptureRetentionClass,
    classes: normalizedClasses
  };
};

const isEvidenceRetentionClassPolicy = (value: unknown): value is EvidenceRetentionClassPolicy =>
  Boolean(mapEvidenceRetentionClassPolicy(value));

const mapEvidenceRetentionClassPolicyOverrideRecords = (
  value: unknown
): EvidenceRetentionClassPolicyOverrideRecords | null => {
  if (!value || typeof value !== "object") {
    return null;
  }

  const source = value as Record<string, unknown>;
  const createLegacyRecords = (
    policy: EvidenceRetentionClassPolicy,
    metadata: Omit<PolicyOverrideRecord<string>, "value">
  ): EvidenceRetentionClassPolicyOverrideRecords => ({
    defaultCaptureRetentionClass: {
      value: policy.defaultCaptureRetentionClass,
      ...metadata
    },
    classEntries: Object.fromEntries(
      policy.classes.map(classEntry => [
        classEntry.retentionClass,
        {
          value: classEntry,
          ...metadata
        }
      ])
    )
  });

  if (isEvidenceRetentionClassPolicy(source)) {
    return createLegacyRecords(source, legacyEvidenceRetentionClassPolicyOverrideMetadata);
  }

  if (
    isEvidenceRetentionClassPolicy(source.value) &&
    typeof source.updatedAt === "string" &&
    typeof source.updatedByRequestId === "string" &&
    typeof source.updatedByActorType === "string" &&
    typeof source.updatedByActorId === "string"
  ) {
    return createLegacyRecords(source.value, {
      updatedAt: source.updatedAt,
      updatedByRequestId: source.updatedByRequestId,
      updatedByActorType: source.updatedByActorType as
        "platform_api" | "participant" | "monitor" | "worker" | "dispatcher",
      updatedByActorId: source.updatedByActorId
    });
  }

  const records: EvidenceRetentionClassPolicyOverrideRecords = {};
  const defaultCaptureSource = source.defaultCaptureRetentionClass;

  if (typeof defaultCaptureSource === "string") {
    records.defaultCaptureRetentionClass = {
      value: defaultCaptureSource,
      ...legacyEvidenceRetentionClassPolicyOverrideMetadata
    };
  } else if (defaultCaptureSource && typeof defaultCaptureSource === "object") {
    const defaultCaptureRecord = defaultCaptureSource as Record<string, unknown>;

    if (
      typeof defaultCaptureRecord.value === "string" &&
      typeof defaultCaptureRecord.updatedAt === "string" &&
      typeof defaultCaptureRecord.updatedByRequestId === "string" &&
      typeof defaultCaptureRecord.updatedByActorType === "string" &&
      typeof defaultCaptureRecord.updatedByActorId === "string"
    ) {
      records.defaultCaptureRetentionClass = {
        value: defaultCaptureRecord.value,
        updatedAt: defaultCaptureRecord.updatedAt,
        updatedByRequestId: defaultCaptureRecord.updatedByRequestId,
        updatedByActorType: defaultCaptureRecord.updatedByActorType as
          "platform_api" | "participant" | "monitor" | "worker" | "dispatcher",
        updatedByActorId: defaultCaptureRecord.updatedByActorId
      };
    }
  }

  const classEntriesSource = source.classEntries;

  if (classEntriesSource && typeof classEntriesSource === "object") {
    const classEntryRecords: Record<string, PolicyOverrideRecord<EvidenceRetentionClassPolicyEntry>> = {};
    const entries = Array.isArray(classEntriesSource)
      ? classEntriesSource.entries()
      : Object.entries(classEntriesSource);

    for (const [entryKey, entryValue] of entries) {
      const resolvedEntry = mapEvidenceRetentionClassPolicyEntry(entryValue);

      if (resolvedEntry) {
        classEntryRecords[resolvedEntry.retentionClass] = {
          value: resolvedEntry,
          ...legacyEvidenceRetentionClassPolicyOverrideMetadata
        };
        continue;
      }

      if (!entryValue || typeof entryValue !== "object") {
        continue;
      }

      const entryRecord = entryValue as Record<string, unknown>;
      const recordValue = mapEvidenceRetentionClassPolicyEntry(entryRecord.value);

      if (
        recordValue &&
        typeof entryRecord.updatedAt === "string" &&
        typeof entryRecord.updatedByRequestId === "string" &&
        typeof entryRecord.updatedByActorType === "string" &&
        typeof entryRecord.updatedByActorId === "string"
      ) {
        classEntryRecords[recordValue.retentionClass || String(entryKey)] = {
          value: recordValue,
          updatedAt: entryRecord.updatedAt,
          updatedByRequestId: entryRecord.updatedByRequestId,
          updatedByActorType: entryRecord.updatedByActorType as
            "platform_api" | "participant" | "monitor" | "worker" | "dispatcher",
          updatedByActorId: entryRecord.updatedByActorId
        };
      }
    }

    if (Object.keys(classEntryRecords).length > 0) {
      records.classEntries = classEntryRecords;
    }
  }

  return Object.keys(records).length > 0 ? records : null;
};

const mapTenant = (row: QueryResultRow): Tenant => ({
  tenantId: row.tenant_id,
  tenantKey: row.tenant_key,
  displayName: row.display_name,
  status: row.status,
  defaultActivationPolicy: row.default_activation_policy,
  defaultOperationalPolicy: {
    monitorCommandTtlSeconds: row.default_operational_policy.monitorCommandTtlSeconds,
    monitorCommandLeaseSeconds: row.default_operational_policy.monitorCommandLeaseSeconds,
    timedRunMaintenanceGraceSeconds: row.default_operational_policy.timedRunMaintenanceGraceSeconds
  },
  defaultLaunchApprovalPolicy: row.default_launch_approval_policy,
  defaultNotificationProviderPromotionPolicy:
    mapNotificationProviderPromotionPolicy(
      row.default_notification_provider_promotion_policy
    ) ?? defaultNotificationProviderPromotionPolicy,
  defaultNotificationPolicy: row.default_notification_policy
    ? {
        breachNotificationDeliverySelectionMode:
          row.default_notification_policy.breachNotificationDeliverySelectionMode ??
          defaultNotificationPolicy.breachNotificationDeliverySelectionMode,
        webhookSpikeRetryDelaySeconds:
          row.default_notification_policy.webhookSpikeRetryDelaySeconds ??
          row.default_notification_policy.breachNotificationRetryDelaySeconds ??
          defaultNotificationPolicy.webhookSpikeRetryDelaySeconds,
        webhookSpikeMaxDeliveryAttempts:
          row.default_notification_policy.webhookSpikeMaxDeliveryAttempts ??
          row.default_notification_policy.breachNotificationMaxDeliveryAttempts ??
          defaultNotificationPolicy.webhookSpikeMaxDeliveryAttempts,
        emailSpikeRetryDelaySeconds:
          row.default_notification_policy.emailSpikeRetryDelaySeconds ??
          row.default_notification_policy.breachNotificationRetryDelaySeconds ??
          defaultNotificationPolicy.emailSpikeRetryDelaySeconds,
        emailSpikeMaxDeliveryAttempts:
          row.default_notification_policy.emailSpikeMaxDeliveryAttempts ??
          row.default_notification_policy.breachNotificationMaxDeliveryAttempts ??
          defaultNotificationPolicy.emailSpikeMaxDeliveryAttempts
      }
    : defaultNotificationPolicy,
  defaultNotificationProviderProfiles: mapNotificationProviderProfiles(
    row.default_notification_provider_profiles
  ),
  defaultEvidenceRetentionPolicy: {
    systemCheckEvidenceRetentionTtlSeconds:
      row.default_evidence_retention_policy.systemCheckEvidenceRetentionTtlSeconds,
    systemCheckEvidenceInvestigationRetentionTtlSeconds:
      row.default_evidence_retention_policy.systemCheckEvidenceInvestigationRetentionTtlSeconds
  },
  defaultEvidenceRetentionClassPolicy:
    mapEvidenceRetentionClassPolicy(row.default_evidence_retention_class_policy) ??
    defaultEvidenceRetentionClassPolicy
});

const mapWorkspace = (row: QueryResultRow): Workspace => ({
  workspaceId: row.workspace_id,
  tenantId: row.tenant_id,
  workspaceKey: row.workspace_key,
  displayName: row.display_name,
  status: row.status,
  activationPolicyOverrideRecords: mapActivationPolicyOverrideRecords(row.activation_policy_override),
  operationalPolicyOverrideRecords: mapOperationalPolicyOverrideRecords(row.operational_policy_override),
  launchApprovalPolicyOverrideRecords: mapLaunchApprovalPolicyOverrideRecords(
    row.launch_approval_policy_override
  ),
  notificationProviderPromotionPolicyOverrideRecords:
    mapNotificationProviderPromotionPolicyOverrideRecords(
      row.notification_provider_promotion_policy_override
    ),
  notificationPolicyOverrideRecords: mapNotificationPolicyOverrideRecords(row.notification_policy_override),
  notificationProviderProfileOverrideRecords: mapNotificationProviderProfileOverrideRecords(
    row.notification_provider_profile_override
  ),
  evidenceRetentionPolicyOverrideRecords: mapEvidenceRetentionPolicyOverrideRecords(
    row.evidence_retention_policy_override
  ),
  evidenceRetentionClassPolicyOverrideRecords: mapEvidenceRetentionClassPolicyOverrideRecords(
    row.evidence_retention_class_policy_override
  )
});

const mapSourcePackage = (row: QueryResultRow): SourcePackage => ({
  sourcePackageId: row.source_package_id,
  tenantId: row.tenant_id,
  workspaceId: row.workspace_id,
  fileName: row.file_name,
  manifestHash: row.manifest_hash,
  format: row.format,
  status: row.status,
  uploadedAt: row.uploaded_at.toISOString(),
  uploadedBy: row.uploaded_by
});

const mapImportJob = (row: QueryResultRow): ImportJob => ({
  importJobId: row.import_job_id,
  tenantId: row.tenant_id,
  workspaceId: row.workspace_id,
  sourcePackageId: row.source_package_id,
  status: row.status,
  createdAt: row.created_at.toISOString(),
  completedAt: row.completed_at ? row.completed_at.toISOString() : null,
  failureMessage: row.failure_message ?? null
});

const mapContentRelease = (row: QueryResultRow): ContentRelease => ({
  contentReleaseId: row.content_release_id,
  tenantId: row.tenant_id,
  workspaceId: row.workspace_id,
  sourcePackageId: row.source_package_id,
  importJobId: row.import_job_id,
  fixtureKey: row.fixture_key,
  releaseLabel: row.release_label,
  status: row.status,
  createdAt: row.created_at.toISOString(),
  activatedAt: row.activated_at ? row.activated_at.toISOString() : null,
  canonicalSnapshot: row.canonical_payload
});

const mapParticipantSession = (row: QueryResultRow): ParticipantSession => ({
  participantSessionId: row.participant_session_id,
  sessionToken: row.session_token,
  tenantId: row.tenant_id,
  workspaceId: row.workspace_id,
  contentReleaseId: row.content_release_id,
  loginKey: row.login_key,
  groupKey: row.group_key,
  createdAt: row.created_at.toISOString()
});

const mapTestRun = (row: QueryResultRow): TestRun => ({
  testRunId: row.test_run_id,
  participantSessionId: row.participant_session_id,
  tenantId: row.tenant_id,
  workspaceId: row.workspace_id,
  contentReleaseId: row.content_release_id,
  loginKey: row.login_key,
  groupKey: row.group_key,
  assignmentKey: row.assignment_key,
  attemptNumber: row.attempt_number,
  bookletKey: row.booklet_key,
  bookletTitle: row.booklet_title,
  status: row.status,
  unitSequence: row.unit_sequence,
  currentUnitIndex: row.current_unit_index,
  currentUnitKey: row.current_unit_key,
  navigationLocked: row.navigation_locked,
  timeLimitSeconds: row.time_limit_seconds,
  pauseAccumulatedMs: row.pause_accumulated_ms,
  pausedAt: row.paused_at ? row.paused_at.toISOString() : null,
  launchApprovalId: row.launch_approval_id ?? null,
  launchApprovalScope: row.launch_approval_scope ?? null,
  launchApprovedBySupervisorId: row.launch_approved_by_supervisor_id ?? null,
  launchApprovalNote: row.launch_approval_note ?? null,
  launchApprovedAt: row.launch_approved_at ? row.launch_approved_at.toISOString() : null,
  initialStateOverrides: row.initial_state_overrides,
  unitResponses: row.unit_responses,
  createdAt: row.created_at.toISOString(),
  updatedAt: row.updated_at.toISOString(),
  completedAt: row.completed_at ? row.completed_at.toISOString() : null
});

const mapSystemCheckSubmission = (row: QueryResultRow): SystemCheckSubmission => ({
  systemCheckSubmissionId: row.system_check_submission_id,
  participantSessionId: row.participant_session_id,
  tenantId: row.tenant_id,
  workspaceId: row.workspace_id,
  contentReleaseId: row.content_release_id,
  loginKey: row.login_key,
  groupKey: row.group_key,
  systemCheckKey: row.system_check_key,
  status: row.status,
  checkResults: row.check_results,
  reviewStatus: row.review_status,
  reviewNote: row.review_note ?? null,
  reviewedAt: row.reviewed_at ? row.reviewed_at.toISOString() : null,
  reviewedByActorType: row.reviewed_by_actor_type ?? null,
  reviewedByActorId: row.reviewed_by_actor_id ?? null,
  submittedAt: row.submitted_at.toISOString()
});

const mapSystemCheckEvidence = (row: QueryResultRow): SystemCheckEvidence => ({
  evidenceKey: row.evidence_key,
  participantSessionId: row.participant_session_id,
  tenantId: row.tenant_id,
  workspaceId: row.workspace_id,
  contentReleaseId: row.content_release_id,
  loginKey: row.login_key,
  groupKey: row.group_key,
  systemCheckKey: row.system_check_key,
  checkKey: row.check_key,
  fileName: row.file_name,
  contentType: row.content_type,
  byteSize: row.byte_size,
  sha256: row.sha256,
  payloadBase64: row.payload_base64 ?? null,
  payloadPreviewText: row.payload_preview_text ?? null,
  storageBackend: row.storage_backend,
  storageLocator: row.storage_locator ?? null,
  retentionClass: row.retention_class,
  retentionPolicyKey: row.retention_policy_key,
  retentionExpiresAt: row.retention_expires_at ? row.retention_expires_at.toISOString() : null,
  retentionHold:
    row.retention_hold &&
    typeof row.retention_hold.heldAt === "string" &&
    typeof row.retention_hold.holdReasonCode === "string" &&
    typeof row.retention_hold.holdNote === "string" &&
    typeof row.retention_hold.heldByActorType === "string" &&
    typeof row.retention_hold.heldByActorId === "string"
      ? {
          heldAt: row.retention_hold.heldAt,
          holdReasonCode: row.retention_hold.holdReasonCode,
          holdNote: row.retention_hold.holdNote,
          heldByActorType: row.retention_hold.heldByActorType,
          heldByActorId: row.retention_hold.heldByActorId,
          acknowledgementRequired:
            typeof row.retention_hold.acknowledgementRequired === "boolean"
              ? row.retention_hold.acknowledgementRequired
              : false,
          acknowledgedAt:
            typeof row.retention_hold.acknowledgedAt === "string"
              ? row.retention_hold.acknowledgedAt
              : null,
          acknowledgedByActorId:
            typeof row.retention_hold.acknowledgedByActorId === "string"
              ? row.retention_hold.acknowledgedByActorId
              : null,
          acknowledgementNote:
            typeof row.retention_hold.acknowledgementNote === "string"
              ? row.retention_hold.acknowledgementNote
              : null,
          defaultAssigneeTarget:
            typeof row.retention_hold.defaultAssigneeTarget === "string"
              ? row.retention_hold.defaultAssigneeTarget
              : null,
          assignedToActorId:
            typeof row.retention_hold.assignedToActorId === "string"
              ? row.retention_hold.assignedToActorId
              : null,
          assignedByActorId:
            typeof row.retention_hold.assignedByActorId === "string"
              ? row.retention_hold.assignedByActorId
              : null,
          assignedAt:
            typeof row.retention_hold.assignedAt === "string"
              ? row.retention_hold.assignedAt
              : null,
          assignmentNote:
            typeof row.retention_hold.assignmentNote === "string"
              ? row.retention_hold.assignmentNote
              : null,
          slaSeconds:
            typeof row.retention_hold.slaSeconds === "number" &&
            Number.isInteger(row.retention_hold.slaSeconds) &&
            row.retention_hold.slaSeconds >= 0
              ? row.retention_hold.slaSeconds
              : null,
          slaDueAt:
            typeof row.retention_hold.slaDueAt === "string"
              ? row.retention_hold.slaDueAt
              : null,
          escalationTarget:
            typeof row.retention_hold.escalationTarget === "string"
              ? row.retention_hold.escalationTarget
              : null,
          escalatedAt:
            typeof row.retention_hold.escalatedAt === "string"
              ? row.retention_hold.escalatedAt
              : null,
          escalatedByActorId:
            typeof row.retention_hold.escalatedByActorId === "string"
              ? row.retention_hold.escalatedByActorId
              : null,
          escalationNote:
            typeof row.retention_hold.escalationNote === "string"
              ? row.retention_hold.escalationNote
              : null
        }
      : null,
  purgedAt: row.purged_at ? row.purged_at.toISOString() : null,
  purgeReasonCode: row.purge_reason_code ?? null,
  createdAt: row.created_at.toISOString()
});

const mapSystemCheckEvidenceAccessGrant = (
  row: QueryResultRow
): SystemCheckEvidenceAccessGrant => ({
  accessGrantId: row.access_grant_id,
  accessToken: row.access_token,
  evidenceKey: row.evidence_key,
  tenantId: row.tenant_id,
  workspaceId: row.workspace_id,
  participantSessionId: row.participant_session_id,
  issuedFor: row.issued_for,
  actorType: row.actor_type,
  actorId: row.actor_id,
  issuedAt: row.issued_at.toISOString(),
  expiresAt: row.expires_at.toISOString(),
  lastAccessedAt: row.last_accessed_at ? row.last_accessed_at.toISOString() : null
});

const mapSystemCheckEvidenceBreachNotification = (
  row: QueryResultRow
): SystemCheckEvidenceBreachNotification => ({
  notificationId: row.notification_id,
  evidenceKey: row.evidence_key,
  participantSessionId: row.participant_session_id,
  tenantId: row.tenant_id,
  workspaceId: row.workspace_id,
  contentReleaseId: row.content_release_id,
  loginKey: row.login_key,
  groupKey: row.group_key,
  systemCheckKey: row.system_check_key,
  checkKey: row.check_key,
  holdReasonCode: row.hold_reason_code,
  escalationTarget: row.escalation_target ?? null,
  assignedToActorId: row.assigned_to_actor_id ?? null,
  notificationChannel: row.notification_channel,
  status: row.status,
  createdAt: row.created_at.toISOString(),
  createdByActorType: row.created_by_actor_type,
  createdByActorId: row.created_by_actor_id,
  sourceRequestId: row.source_request_id ?? null,
  deliveryProfileKey: row.delivery_profile_key ?? null,
  deliveryChannel: row.delivery_channel ?? "webhook_spike",
  deliveryStatus: row.delivery_status ?? "pending_delivery",
  deliveryTarget: row.delivery_target ?? null,
  deliveryAttemptCount: row.delivery_attempt_count ?? 0,
  maxDeliveryAttempts: row.max_delivery_attempts ?? 3,
  nextDeliveryAttemptAt: row.next_delivery_attempt_at ? row.next_delivery_attempt_at.toISOString() : null,
  lastDeliveryAttemptAt: row.last_delivery_attempt_at ? row.last_delivery_attempt_at.toISOString() : null,
  lastDeliveryReceiptId: row.last_delivery_receipt_id ?? null,
  lastDeliveryReceiptIssuedAt: row.last_delivery_receipt_issued_at
    ? row.last_delivery_receipt_issued_at.toISOString()
    : null,
  deliveredAt: row.delivered_at ? row.delivered_at.toISOString() : null,
  lastDeliveryError: row.last_delivery_error ?? null,
  acknowledgedAt: row.acknowledged_at ? row.acknowledged_at.toISOString() : null,
  acknowledgedByActorId: row.acknowledged_by_actor_id ?? null,
  acknowledgementNote: row.acknowledgement_note ?? null
});

const mapNotificationProviderProfileIncident = (
  row: QueryResultRow
): NotificationProviderProfileIncident => ({
  incidentId: row.incident_id,
  tenantId: row.tenant_id,
  workspaceId: row.workspace_id,
  profileKey: row.profile_key,
  incidentType: row.incident_type,
  status: row.status,
  openedAt: row.opened_at.toISOString(),
  openedByActorType: row.opened_by_actor_type,
  openedByActorId: row.opened_by_actor_id,
  reasonCode: row.reason_code,
  deliveryFailedCount: row.delivery_failed_count,
  suppressionUntil: row.suppression_until ? row.suppression_until.toISOString() : null,
  sourceRequestId: row.source_request_id ?? null,
  acknowledgedAt: row.acknowledged_at ? row.acknowledged_at.toISOString() : null,
  acknowledgedByActorId: row.acknowledged_by_actor_id ?? null,
  acknowledgementNote: row.acknowledgement_note ?? null,
  resolvedAt: row.resolved_at ? row.resolved_at.toISOString() : null,
  resolutionCode: row.resolution_code ?? null
});

const mapSystemCheckLaunchApproval = (row: QueryResultRow): SystemCheckLaunchApproval => ({
  launchApprovalId: row.launch_approval_id,
  participantSessionId: row.participant_session_id,
  tenantId: row.tenant_id,
  workspaceId: row.workspace_id,
  contentReleaseId: row.content_release_id,
  loginKey: row.login_key,
  groupKey: row.group_key,
  assignmentKey: row.assignment_key,
  readinessStatus: row.readiness_status,
  warningReasonCodes: row.warning_reason_codes,
  approvalScope: row.approval_scope,
  status: row.status,
  approvedAt: row.approved_at.toISOString(),
  approvedBySupervisorId: row.approved_by_supervisor_id,
  approvalNote: row.approval_note,
  expiresAt: row.expires_at ? row.expires_at.toISOString() : null,
  consumedAt: row.consumed_at ? row.consumed_at.toISOString() : null,
  consumedByTestRunId: row.consumed_by_test_run_id ?? null,
  invalidatedAt: row.invalidated_at ? row.invalidated_at.toISOString() : null,
  invalidationReasonCode: row.invalidation_reason_code ?? null,
  invalidationReasonDetail: row.invalidation_reason_detail ?? null,
  expiredAt: row.expired_at ? row.expired_at.toISOString() : null,
  expirationReasonCode: row.expiration_reason_code ?? null,
  revokedAt: row.revoked_at ? row.revoked_at.toISOString() : null,
  revokedBySupervisorId: row.revoked_by_supervisor_id ?? null,
  revocationNote: row.revocation_note ?? null
});

const mapAuditEvent = (row: QueryResultRow): AuditEvent => ({
  auditEventId: row.audit_event_id,
  requestId: row.request_id,
  tenantId: row.tenant_id ?? null,
  workspaceId: row.workspace_id ?? null,
  participantSessionId: row.participant_session_id ?? null,
  testRunId: row.test_run_id ?? null,
  loginKey: row.login_key ?? null,
  groupKey: row.group_key ?? null,
  assignmentKey: row.assignment_key ?? null,
  actorType: row.actor_type,
  actorId: row.actor_id,
  eventType: row.event_type,
  payload: row.payload,
  occurredAt: row.occurred_at.toISOString()
});

const mapMonitorCommand = (row: QueryResultRow): MonitorCommand => ({
  commandId: row.command_id,
  requestId: row.request_id,
  tenantId: row.tenant_id,
  workspaceId: row.workspace_id,
  testRunId: row.test_run_id,
  participantSessionId: row.participant_session_id,
  loginKey: row.login_key,
  groupKey: row.group_key,
  assignmentKey: row.assignment_key,
  attemptNumber: row.attempt_number,
  commandType: row.command_type,
  ackState: row.ack_state,
  actorId: row.actor_id,
  issuedAt: row.issued_at.toISOString(),
  deliveredAt: row.delivered_at ? row.delivered_at.toISOString() : null,
  resolvedAt: row.resolved_at ? row.resolved_at.toISOString() : null,
  rejectionReason: row.rejection_reason ?? null
});

const resolveWorkspace = async (
  pool: Pool,
  tenantKey: string,
  workspaceKey: string
): Promise<Workspace | undefined> => {
  const result = await pool.query(
    `
      SELECT
        w.workspace_id,
        w.tenant_id,
        w.workspace_key,
        w.display_name,
        w.status,
        w.activation_policy_override,
        w.operational_policy_override,
        w.launch_approval_policy_override,
        w.notification_provider_promotion_policy_override,
        w.notification_policy_override,
        w.notification_provider_profile_override,
        w.evidence_retention_policy_override,
        w.evidence_retention_class_policy_override
      FROM workspaces w
      JOIN tenants t ON t.tenant_id = w.tenant_id
      WHERE t.tenant_key = $1 AND w.workspace_key = $2
    `,
    [tenantKey, workspaceKey]
  );

  return result.rows[0] ? mapWorkspace(result.rows[0]) : undefined;
};

export interface PlatformStore {
  close: () => Promise<void>;
  saveTenant: (tenant: Tenant) => Promise<void>;
  saveWorkspace: (workspace: Workspace) => Promise<void>;
  saveSourcePackage: (sourcePackage: SourcePackage) => Promise<void>;
  saveImportJob: (importJob: ImportJob) => Promise<void>;
  saveContentRelease: (contentRelease: ContentRelease) => Promise<void>;
  saveParticipantSession: (participantSession: ParticipantSession) => Promise<void>;
  saveTestRun: (testRun: TestRun) => Promise<void>;
  saveSystemCheckEvidence: (systemCheckEvidence: SystemCheckEvidence) => Promise<void>;
  saveSystemCheckEvidenceAccessGrant: (accessGrant: SystemCheckEvidenceAccessGrant) => Promise<void>;
  saveSystemCheckEvidenceBreachNotification: (
    notification: SystemCheckEvidenceBreachNotification
  ) => Promise<void>;
  saveNotificationProviderProfileIncident: (
    incident: NotificationProviderProfileIncident
  ) => Promise<void>;
  saveSystemCheckLaunchApproval: (launchApproval: SystemCheckLaunchApproval) => Promise<void>;
  saveSystemCheckSubmission: (systemCheckSubmission: SystemCheckSubmission) => Promise<void>;
  updateSystemCheckEvidence: (systemCheckEvidence: SystemCheckEvidence) => Promise<void>;
  updateSystemCheckEvidenceAccessGrant: (accessGrant: SystemCheckEvidenceAccessGrant) => Promise<void>;
  updateSystemCheckEvidenceBreachNotification: (
    notification: SystemCheckEvidenceBreachNotification
  ) => Promise<void>;
  updateNotificationProviderProfileIncident: (
    incident: NotificationProviderProfileIncident
  ) => Promise<void>;
  updateSystemCheckLaunchApproval: (launchApproval: SystemCheckLaunchApproval) => Promise<void>;
  updateSystemCheckSubmissionReview: (systemCheckSubmission: SystemCheckSubmission) => Promise<void>;
  saveAuditEvent: (auditEvent: AuditEvent) => Promise<void>;
  saveMonitorCommand: (monitorCommand: MonitorCommand) => Promise<void>;
  updateMonitorCommand: (monitorCommand: MonitorCommand) => Promise<void>;
  updateTestRun: (testRun: TestRun) => Promise<void>;
  getTenantById: (tenantId: string) => Promise<Tenant | undefined>;
  getTenantByKey: (tenantKey: string) => Promise<Tenant | undefined>;
  getWorkspaceById: (workspaceId: string) => Promise<Workspace | undefined>;
  getWorkspaceByKey: (tenantKey: string, workspaceKey: string) => Promise<Workspace | undefined>;
  getSourcePackageById: (sourcePackageId: string) => Promise<SourcePackage | undefined>;
  getImportJobById: (importJobId: string) => Promise<ImportJob | undefined>;
  getContentReleaseById: (contentReleaseId: string) => Promise<ContentRelease | undefined>;
  getContentReleaseByImportJobId: (importJobId: string) => Promise<ContentRelease | undefined>;
  getActiveContentReleaseByWorkspace: (tenantKey: string, workspaceKey: string) => Promise<ContentRelease | undefined>;
  getParticipantSessionByToken: (sessionToken: string) => Promise<ParticipantSession | undefined>;
  getParticipantSessionById: (participantSessionId: string) => Promise<ParticipantSession | undefined>;
  getTestRunById: (testRunId: string) => Promise<TestRun | undefined>;
  getSystemCheckEvidenceByKey: (evidenceKey: string) => Promise<SystemCheckEvidence | undefined>;
  getSystemCheckEvidenceAccessGrantByToken: (
    accessToken: string
  ) => Promise<SystemCheckEvidenceAccessGrant | undefined>;
  getSystemCheckEvidenceBreachNotificationById: (
    notificationId: string
  ) => Promise<SystemCheckEvidenceBreachNotification | undefined>;
  getNotificationProviderProfileIncidentById: (
    incidentId: string
  ) => Promise<NotificationProviderProfileIncident | undefined>;
  getLatestUnresolvedNotificationProviderProfileIncident: (
    workspaceId: string,
    profileKey: string
  ) => Promise<NotificationProviderProfileIncident | undefined>;
  getSystemCheckLaunchApprovalById: (launchApprovalId: string) => Promise<SystemCheckLaunchApproval | undefined>;
  getSystemCheckSubmissionById: (systemCheckSubmissionId: string) => Promise<SystemCheckSubmission | undefined>;
  getOpenTestRunForSessionAssignment: (
    participantSessionId: string,
    assignmentKey: string
  ) => Promise<TestRun | undefined>;
  getLatestTestRunForSessionAssignment: (
    participantSessionId: string,
    assignmentKey: string
  ) => Promise<TestRun | undefined>;
  listParticipantSessionsByWorkspace: (
    tenantKey: string,
    workspaceKey: string,
    options?: {
      groupKey?: string;
      limit?: number;
    }
  ) => Promise<ParticipantSession[]>;
  listMonitorTestRunsByWorkspace: (
    tenantKey: string,
    workspaceKey: string,
    options?: {
      groupKey?: string;
    }
  ) => Promise<TestRun[]>;
  listSystemCheckSubmissionsByParticipantSession: (
    participantSessionId: string
  ) => Promise<SystemCheckSubmission[]>;
  listSystemCheckEvidenceByParticipantSession: (
    participantSessionId: string
  ) => Promise<SystemCheckEvidence[]>;
  listSystemCheckEvidenceByWorkspace: (
    tenantKey: string,
    workspaceKey: string,
    options?: {
      groupKey?: string;
      heldOnly?: boolean;
      limit?: number;
    }
  ) => Promise<SystemCheckEvidence[]>;
  listSystemCheckEvidenceByKeys: (
    evidenceKeys: string[]
  ) => Promise<SystemCheckEvidence[]>;
  listSystemCheckEvidenceBreachNotificationsByWorkspace: (
    tenantKey: string,
    workspaceKey: string,
    options?: {
      groupKey?: string;
      escalationTarget?: string;
      assignedToActorId?: string;
      status?: SystemCheckEvidenceBreachNotification["status"];
      deliveryChannel?: SystemCheckEvidenceBreachNotification["deliveryChannel"];
      deliveryStatus?: SystemCheckEvidenceBreachNotification["deliveryStatus"];
      limit?: number;
    }
  ) => Promise<SystemCheckEvidenceBreachNotification[]>;
  listNotificationProviderProfileIncidentsByWorkspace: (
    tenantKey: string,
    workspaceKey: string,
    options?: {
      profileKey?: string;
      incidentType?: NotificationProviderProfileIncident["incidentType"];
      status?: NotificationProviderProfileIncident["status"];
      limit?: number;
    }
  ) => Promise<NotificationProviderProfileIncident[]>;
  listPendingSystemCheckEvidenceBreachNotificationDeliveries: (
    limit: number
  ) => Promise<SystemCheckEvidenceBreachNotification[]>;
  listSystemCheckLaunchApprovalsByWorkspace: (
    tenantKey: string,
    workspaceKey: string,
    options?: {
      participantSessionId?: string;
      assignmentKey?: string;
      status?: SystemCheckLaunchApproval["status"];
      approvalScope?: SystemCheckLaunchApproval["approvalScope"];
      limit?: number;
    }
  ) => Promise<SystemCheckLaunchApproval[]>;
  listSystemCheckLaunchApprovalsByParticipantSession: (
    participantSessionId: string,
    options?: {
      status?: SystemCheckLaunchApproval["status"];
      limit?: number;
    }
  ) => Promise<SystemCheckLaunchApproval[]>;
  listSystemCheckSubmissionsByWorkspace: (
    tenantKey: string,
    workspaceKey: string,
    options?: {
      groupKey?: string;
      status?: SystemCheckSubmission["status"];
      reviewStatus?: SystemCheckSubmission["reviewStatus"];
      limit?: number;
    }
  ) => Promise<SystemCheckSubmission[]>;
  listSystemCheckEvidenceRetentionPurgeCandidates: (limit: number) => Promise<SystemCheckEvidence[]>;
  listSystemCheckEvidenceHoldEscalationCandidates: (limit: number) => Promise<SystemCheckEvidence[]>;
  listActiveTimedTestRuns: (limit: number) => Promise<TestRun[]>;
  listAuditEventsByTenant: (
    tenantKey: string,
    options: {
      limit: number;
      eventTypes?: string[];
    }
  ) => Promise<AuditEvent[]>;
  listAuditEventsByWorkspace: (
    tenantKey: string,
    workspaceKey: string,
    options: {
      limit: number;
      eventTypes?: string[];
    }
  ) => Promise<AuditEvent[]>;
  listAuditEventsBySystemCheckEvidence: (
    tenantKey: string,
    workspaceKey: string,
    evidenceKey: string,
    options: {
      limit: number;
      eventTypes?: string[];
    }
  ) => Promise<AuditEvent[]>;
  listMonitorCommandsByWorkspace: (
    tenantKey: string,
    workspaceKey: string,
    options?: {
      testRunId?: string;
      ackState?: MonitorCommand["ackState"];
      limit?: number;
    }
  ) => Promise<MonitorCommand[]>;
  claimNextPendingMonitorCommand: (
    consumerId: string
  ) => Promise<MonitorCommand | undefined>;
  completeMonitorCommandDispatch: (
    commandId: string,
    finalStatus: "applied" | "rejected" | "expired",
    lastError?: string | null
  ) => Promise<void>;
  listExpirableMonitorCommands: (limit: number) => Promise<MonitorCommand[]>;
  listTenants: () => Promise<Tenant[]>;
  listWorkspacesByTenant: (tenantKey: string) => Promise<Workspace[]>;
  listSourcePackagesByWorkspace: (tenantKey: string, workspaceKey: string) => Promise<SourcePackage[]>;
  listImportJobsByWorkspace: (tenantKey: string, workspaceKey: string) => Promise<ImportJob[]>;
  listContentReleasesByWorkspace: (tenantKey: string, workspaceKey: string) => Promise<ContentRelease[]>;
  claimNextQueuedImportJob: () => Promise<ImportJob | undefined>;
  markImportJobCompleted: (importJobId: string) => Promise<void>;
  markImportJobFailed: (importJobId: string, failureMessage: string) => Promise<void>;
  activateContentRelease: (contentReleaseId: string) => Promise<ContentRelease | undefined>;
}

export const createDatabasePool = (connectionString = process.env.DATABASE_URL ?? defaultDatabaseUrl): Pool =>
  new Pool({
    connectionString
  });

export const initializeDatabase = async (pool: Pool): Promise<void> => {
  await runMigrations(pool);
};

export const createPostgresPlatformStore = (pool: Pool): PlatformStore => ({
  close: async () => {
    await pool.end();
  },
  saveTenant: async tenant => {
    await pool.query(
      `
        INSERT INTO tenants (
          tenant_id, tenant_key, display_name, status, default_activation_policy,
          default_operational_policy, default_launch_approval_policy,
          default_notification_provider_promotion_policy, default_notification_policy,
          default_notification_provider_profiles, default_evidence_retention_policy,
          default_evidence_retention_class_policy
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb)
        ON CONFLICT (tenant_key) DO UPDATE
        SET display_name = EXCLUDED.display_name,
            status = EXCLUDED.status,
            default_activation_policy = EXCLUDED.default_activation_policy,
            default_operational_policy = EXCLUDED.default_operational_policy,
            default_launch_approval_policy = EXCLUDED.default_launch_approval_policy,
            default_notification_provider_promotion_policy = EXCLUDED.default_notification_provider_promotion_policy,
            default_notification_policy = EXCLUDED.default_notification_policy,
            default_notification_provider_profiles = EXCLUDED.default_notification_provider_profiles,
            default_evidence_retention_policy = EXCLUDED.default_evidence_retention_policy,
            default_evidence_retention_class_policy = EXCLUDED.default_evidence_retention_class_policy
      `,
      [
        tenant.tenantId,
        tenant.tenantKey,
        tenant.displayName,
        tenant.status,
        JSON.stringify(tenant.defaultActivationPolicy),
        JSON.stringify(tenant.defaultOperationalPolicy),
        JSON.stringify(tenant.defaultLaunchApprovalPolicy),
        JSON.stringify(tenant.defaultNotificationProviderPromotionPolicy),
        JSON.stringify(tenant.defaultNotificationPolicy),
        JSON.stringify(tenant.defaultNotificationProviderProfiles),
        JSON.stringify(tenant.defaultEvidenceRetentionPolicy),
        JSON.stringify(tenant.defaultEvidenceRetentionClassPolicy)
      ]
    );
  },
  saveWorkspace: async workspace => {
    await pool.query(
      `
        INSERT INTO workspaces (
          workspace_id, tenant_id, workspace_key, display_name, status,
          activation_policy_override, operational_policy_override, launch_approval_policy_override,
          notification_provider_promotion_policy_override, notification_policy_override,
          notification_provider_profile_override, evidence_retention_policy_override,
          evidence_retention_class_policy_override
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb)
        ON CONFLICT (tenant_id, workspace_key) DO UPDATE
        SET display_name = EXCLUDED.display_name,
            status = EXCLUDED.status,
            activation_policy_override = EXCLUDED.activation_policy_override,
            operational_policy_override = EXCLUDED.operational_policy_override,
            launch_approval_policy_override = EXCLUDED.launch_approval_policy_override,
            notification_provider_promotion_policy_override = EXCLUDED.notification_provider_promotion_policy_override,
            notification_policy_override = EXCLUDED.notification_policy_override,
            notification_provider_profile_override = EXCLUDED.notification_provider_profile_override,
            evidence_retention_policy_override = EXCLUDED.evidence_retention_policy_override,
            evidence_retention_class_policy_override = EXCLUDED.evidence_retention_class_policy_override
      `,
      [
        workspace.workspaceId,
        workspace.tenantId,
        workspace.workspaceKey,
        workspace.displayName,
        workspace.status,
        workspace.activationPolicyOverrideRecords ? JSON.stringify(workspace.activationPolicyOverrideRecords) : null,
        workspace.operationalPolicyOverrideRecords ? JSON.stringify(workspace.operationalPolicyOverrideRecords) : null,
        workspace.launchApprovalPolicyOverrideRecords
          ? JSON.stringify(workspace.launchApprovalPolicyOverrideRecords)
          : null,
        workspace.notificationProviderPromotionPolicyOverrideRecords
          ? JSON.stringify(workspace.notificationProviderPromotionPolicyOverrideRecords)
          : null,
        workspace.notificationPolicyOverrideRecords
          ? JSON.stringify(workspace.notificationPolicyOverrideRecords)
          : null,
        workspace.notificationProviderProfileOverrideRecords
          ? JSON.stringify(workspace.notificationProviderProfileOverrideRecords)
          : null,
        workspace.evidenceRetentionPolicyOverrideRecords
          ? JSON.stringify(workspace.evidenceRetentionPolicyOverrideRecords)
          : null,
        workspace.evidenceRetentionClassPolicyOverrideRecords
          ? JSON.stringify(workspace.evidenceRetentionClassPolicyOverrideRecords)
          : null
      ]
    );
  },
  saveSourcePackage: async sourcePackage => {
    await pool.query(
      `
        INSERT INTO source_packages (
          source_package_id, tenant_id, workspace_id, file_name, manifest_hash, format, status, uploaded_at, uploaded_by
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      `,
      [
        sourcePackage.sourcePackageId,
        sourcePackage.tenantId,
        sourcePackage.workspaceId,
        sourcePackage.fileName,
        sourcePackage.manifestHash,
        sourcePackage.format,
        sourcePackage.status,
        sourcePackage.uploadedAt,
        sourcePackage.uploadedBy
      ]
    );
  },
  saveImportJob: async importJob => {
    await pool.query(
      `
        INSERT INTO import_jobs (
          import_job_id, tenant_id, workspace_id, source_package_id, status, created_at, completed_at, failure_message
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        importJob.importJobId,
        importJob.tenantId,
        importJob.workspaceId,
        importJob.sourcePackageId,
        importJob.status,
        importJob.createdAt,
        importJob.completedAt,
        importJob.failureMessage
      ]
    );
  },
  saveContentRelease: async contentRelease => {
    await pool.query(
      `
        INSERT INTO content_releases (
          content_release_id, tenant_id, workspace_id, source_package_id, import_job_id,
          fixture_key, release_label, status, created_at, activated_at, canonical_payload
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11::jsonb)
      `,
      [
        contentRelease.contentReleaseId,
        contentRelease.tenantId,
        contentRelease.workspaceId,
        contentRelease.sourcePackageId,
        contentRelease.importJobId,
        contentRelease.fixtureKey,
        contentRelease.releaseLabel,
        contentRelease.status,
        contentRelease.createdAt,
        contentRelease.activatedAt,
        JSON.stringify(contentRelease.canonicalSnapshot)
      ]
    );
  },
  saveParticipantSession: async participantSession => {
    await pool.query(
      `
        INSERT INTO participant_sessions (
          participant_session_id, session_token, tenant_id, workspace_id, content_release_id, login_key, group_key, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
      `,
      [
        participantSession.participantSessionId,
        participantSession.sessionToken,
        participantSession.tenantId,
        participantSession.workspaceId,
        participantSession.contentReleaseId,
        participantSession.loginKey,
        participantSession.groupKey,
        participantSession.createdAt
      ]
    );
  },
  saveSystemCheckEvidence: async systemCheckEvidence => {
    await pool.query(
      `
        INSERT INTO system_check_evidence (
          evidence_key, participant_session_id, tenant_id, workspace_id, content_release_id,
          login_key, group_key, system_check_key, check_key, file_name, content_type,
          byte_size, sha256, payload_base64, payload_preview_text, storage_backend, storage_locator,
          retention_class, retention_policy_key, retention_expires_at, retention_hold, purged_at, purge_reason_code, created_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24)
      `,
      [
        systemCheckEvidence.evidenceKey,
        systemCheckEvidence.participantSessionId,
        systemCheckEvidence.tenantId,
        systemCheckEvidence.workspaceId,
        systemCheckEvidence.contentReleaseId,
        systemCheckEvidence.loginKey,
        systemCheckEvidence.groupKey,
        systemCheckEvidence.systemCheckKey,
        systemCheckEvidence.checkKey,
        systemCheckEvidence.fileName,
        systemCheckEvidence.contentType,
        systemCheckEvidence.byteSize,
        systemCheckEvidence.sha256,
        systemCheckEvidence.payloadBase64,
        systemCheckEvidence.payloadPreviewText,
        systemCheckEvidence.storageBackend,
        systemCheckEvidence.storageLocator,
        systemCheckEvidence.retentionClass,
        systemCheckEvidence.retentionPolicyKey,
        systemCheckEvidence.retentionExpiresAt,
        systemCheckEvidence.retentionHold ? JSON.stringify(systemCheckEvidence.retentionHold) : null,
        systemCheckEvidence.purgedAt,
        systemCheckEvidence.purgeReasonCode,
        systemCheckEvidence.createdAt
      ]
    );
  },
  saveSystemCheckEvidenceAccessGrant: async accessGrant => {
    await pool.query(
      `
        INSERT INTO system_check_evidence_access_grants (
          access_grant_id, access_token, evidence_key, tenant_id, workspace_id, participant_session_id,
          issued_for, actor_type, actor_id, issued_at, expires_at, last_accessed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      `,
      [
        accessGrant.accessGrantId,
        accessGrant.accessToken,
        accessGrant.evidenceKey,
        accessGrant.tenantId,
        accessGrant.workspaceId,
        accessGrant.participantSessionId,
        accessGrant.issuedFor,
        accessGrant.actorType,
        accessGrant.actorId,
        accessGrant.issuedAt,
        accessGrant.expiresAt,
        accessGrant.lastAccessedAt
      ]
    );
  },
  saveSystemCheckEvidenceBreachNotification: async notification => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query(
        `
          INSERT INTO system_check_evidence_breach_notifications (
            notification_id, evidence_key, participant_session_id, tenant_id, workspace_id,
            content_release_id, login_key, group_key, system_check_key, check_key,
            hold_reason_code, escalation_target, assigned_to_actor_id, notification_channel, status,
            created_at, created_by_actor_type, created_by_actor_id, source_request_id, delivery_profile_key,
            delivery_channel, delivery_status, delivery_target, delivery_attempt_count,
            max_delivery_attempts, next_delivery_attempt_at, last_delivery_attempt_at, last_delivery_receipt_id,
            last_delivery_receipt_issued_at, delivered_at, last_delivery_error, acknowledged_at,
            acknowledged_by_actor_id, acknowledgement_note
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31, $32, $33, $34)
        `,
        [
          notification.notificationId,
          notification.evidenceKey,
          notification.participantSessionId,
          notification.tenantId,
          notification.workspaceId,
          notification.contentReleaseId,
          notification.loginKey,
          notification.groupKey,
          notification.systemCheckKey,
          notification.checkKey,
          notification.holdReasonCode,
          notification.escalationTarget,
          notification.assignedToActorId,
          notification.notificationChannel,
          notification.status,
          notification.createdAt,
          notification.createdByActorType,
          notification.createdByActorId,
          notification.sourceRequestId,
          notification.deliveryProfileKey,
          notification.deliveryChannel,
          notification.deliveryStatus,
          notification.deliveryTarget,
          notification.deliveryAttemptCount,
          notification.maxDeliveryAttempts,
          notification.nextDeliveryAttemptAt,
          notification.lastDeliveryAttemptAt,
          notification.lastDeliveryReceiptId,
          notification.lastDeliveryReceiptIssuedAt,
          notification.deliveredAt,
          notification.lastDeliveryError,
          notification.acknowledgedAt,
          notification.acknowledgedByActorId,
          notification.acknowledgementNote
        ]
      );

      if (notification.deliveryStatus === "pending_delivery") {
        await client.query(
          "SELECT pg_notify($1, $2)",
          [breachNotificationDispatchQueueChannel, notification.notificationId]
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
  saveNotificationProviderProfileIncident: async incident => {
    await pool.query(
      `
        INSERT INTO notification_provider_profile_incidents (
          incident_id, tenant_id, workspace_id, profile_key, incident_type, status,
          opened_at, opened_by_actor_type, opened_by_actor_id, reason_code,
          delivery_failed_count, suppression_until, source_request_id,
          acknowledged_at, acknowledged_by_actor_id, acknowledgement_note,
          resolved_at, resolution_code
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
      `,
      [
        incident.incidentId,
        incident.tenantId,
        incident.workspaceId,
        incident.profileKey,
        incident.incidentType,
        incident.status,
        incident.openedAt,
        incident.openedByActorType,
        incident.openedByActorId,
        incident.reasonCode,
        incident.deliveryFailedCount,
        incident.suppressionUntil,
        incident.sourceRequestId,
        incident.acknowledgedAt,
        incident.acknowledgedByActorId,
        incident.acknowledgementNote,
        incident.resolvedAt,
        incident.resolutionCode
      ]
    );
  },
  saveSystemCheckLaunchApproval: async launchApproval => {
    await pool.query(
      `
        INSERT INTO system_check_launch_approvals (
          launch_approval_id, participant_session_id, tenant_id, workspace_id, content_release_id,
          login_key, group_key, assignment_key, readiness_status, warning_reason_codes, approval_scope,
          status, approved_at, approved_by_supervisor_id, approval_note, expires_at,
          consumed_at, consumed_by_test_run_id, invalidated_at, invalidation_reason_code,
          invalidation_reason_detail, expired_at, expiration_reason_code,
          revoked_at, revoked_by_supervisor_id, revocation_note
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26)
      `,
      [
        launchApproval.launchApprovalId,
        launchApproval.participantSessionId,
        launchApproval.tenantId,
        launchApproval.workspaceId,
        launchApproval.contentReleaseId,
        launchApproval.loginKey,
        launchApproval.groupKey,
        launchApproval.assignmentKey,
        launchApproval.readinessStatus,
        JSON.stringify(launchApproval.warningReasonCodes),
        launchApproval.approvalScope,
        launchApproval.status,
        launchApproval.approvedAt,
        launchApproval.approvedBySupervisorId,
        launchApproval.approvalNote,
        launchApproval.expiresAt,
        launchApproval.consumedAt,
        launchApproval.consumedByTestRunId,
        launchApproval.invalidatedAt,
        launchApproval.invalidationReasonCode,
        launchApproval.invalidationReasonDetail,
        launchApproval.expiredAt,
        launchApproval.expirationReasonCode,
        launchApproval.revokedAt,
        launchApproval.revokedBySupervisorId,
        launchApproval.revocationNote
      ]
    );
  },
  saveSystemCheckSubmission: async systemCheckSubmission => {
    await pool.query(
      `
        INSERT INTO system_check_submissions (
          system_check_submission_id, participant_session_id, tenant_id, workspace_id, content_release_id,
          login_key, group_key, system_check_key, status, check_results, review_status, review_note,
          reviewed_at, reviewed_by_actor_type, reviewed_by_actor_id, submitted_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb, $11, $12, $13, $14, $15, $16)
      `,
      [
        systemCheckSubmission.systemCheckSubmissionId,
        systemCheckSubmission.participantSessionId,
        systemCheckSubmission.tenantId,
        systemCheckSubmission.workspaceId,
        systemCheckSubmission.contentReleaseId,
        systemCheckSubmission.loginKey,
        systemCheckSubmission.groupKey,
        systemCheckSubmission.systemCheckKey,
        systemCheckSubmission.status,
        JSON.stringify(systemCheckSubmission.checkResults),
        systemCheckSubmission.reviewStatus,
        systemCheckSubmission.reviewNote,
        systemCheckSubmission.reviewedAt,
        systemCheckSubmission.reviewedByActorType,
        systemCheckSubmission.reviewedByActorId,
        systemCheckSubmission.submittedAt
      ]
    );
  },
  updateSystemCheckSubmissionReview: async systemCheckSubmission => {
    await pool.query(
      `
        UPDATE system_check_submissions
        SET review_status = $2,
            review_note = $3,
            reviewed_at = $4,
            reviewed_by_actor_type = $5,
            reviewed_by_actor_id = $6
        WHERE system_check_submission_id = $1
      `,
      [
        systemCheckSubmission.systemCheckSubmissionId,
        systemCheckSubmission.reviewStatus,
        systemCheckSubmission.reviewNote,
        systemCheckSubmission.reviewedAt,
        systemCheckSubmission.reviewedByActorType,
        systemCheckSubmission.reviewedByActorId
      ]
    );
  },
  updateSystemCheckEvidence: async systemCheckEvidence => {
    await pool.query(
      `
        UPDATE system_check_evidence
        SET
          payload_base64 = $2,
          payload_preview_text = $3,
          storage_backend = $4,
          storage_locator = $5,
          retention_class = $6,
          retention_policy_key = $7,
          retention_expires_at = $8,
          retention_hold = $9,
          purged_at = $10,
          purge_reason_code = $11
        WHERE evidence_key = $1
      `,
      [
        systemCheckEvidence.evidenceKey,
        systemCheckEvidence.payloadBase64,
        systemCheckEvidence.payloadPreviewText,
        systemCheckEvidence.storageBackend,
        systemCheckEvidence.storageLocator,
        systemCheckEvidence.retentionClass,
        systemCheckEvidence.retentionPolicyKey,
        systemCheckEvidence.retentionExpiresAt,
        systemCheckEvidence.retentionHold ? JSON.stringify(systemCheckEvidence.retentionHold) : null,
        systemCheckEvidence.purgedAt,
        systemCheckEvidence.purgeReasonCode
      ]
    );
  },
  updateSystemCheckEvidenceAccessGrant: async accessGrant => {
    await pool.query(
      `
        UPDATE system_check_evidence_access_grants
        SET last_accessed_at = $2
        WHERE access_grant_id = $1
      `,
      [
        accessGrant.accessGrantId,
        accessGrant.lastAccessedAt
      ]
    );
  },
  updateSystemCheckEvidenceBreachNotification: async notification => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query(
        `
          UPDATE system_check_evidence_breach_notifications
          SET status = $2,
              delivery_profile_key = $3,
              delivery_channel = $4,
              delivery_status = $5,
              delivery_target = $6,
              delivery_attempt_count = $7,
              max_delivery_attempts = $8,
              next_delivery_attempt_at = $9,
              last_delivery_attempt_at = $10,
              last_delivery_receipt_id = $11,
              last_delivery_receipt_issued_at = $12,
              delivered_at = $13,
              last_delivery_error = $14,
              acknowledged_at = $15,
              acknowledged_by_actor_id = $16,
              acknowledgement_note = $17,
              source_request_id = $18
          WHERE notification_id = $1
        `,
        [
          notification.notificationId,
          notification.status,
          notification.deliveryProfileKey,
          notification.deliveryChannel,
          notification.deliveryStatus,
          notification.deliveryTarget,
          notification.deliveryAttemptCount,
          notification.maxDeliveryAttempts,
          notification.nextDeliveryAttemptAt,
          notification.lastDeliveryAttemptAt,
          notification.lastDeliveryReceiptId,
          notification.lastDeliveryReceiptIssuedAt,
          notification.deliveredAt,
          notification.lastDeliveryError,
          notification.acknowledgedAt,
          notification.acknowledgedByActorId,
          notification.acknowledgementNote,
          notification.sourceRequestId
        ]
      );

      if (notification.deliveryStatus === "pending_delivery") {
        await client.query(
          "SELECT pg_notify($1, $2)",
          [breachNotificationDispatchQueueChannel, notification.notificationId]
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
  updateNotificationProviderProfileIncident: async incident => {
    await pool.query(
      `
        UPDATE notification_provider_profile_incidents
        SET status = $2,
            delivery_failed_count = $3,
            suppression_until = $4,
            source_request_id = $5,
            acknowledged_at = $6,
            acknowledged_by_actor_id = $7,
            acknowledgement_note = $8,
            resolved_at = $9,
            resolution_code = $10
        WHERE incident_id = $1
      `,
      [
        incident.incidentId,
        incident.status,
        incident.deliveryFailedCount,
        incident.suppressionUntil,
        incident.sourceRequestId,
        incident.acknowledgedAt,
        incident.acknowledgedByActorId,
        incident.acknowledgementNote,
        incident.resolvedAt,
        incident.resolutionCode
      ]
    );
  },
  updateSystemCheckLaunchApproval: async launchApproval => {
    await pool.query(
      `
        UPDATE system_check_launch_approvals
        SET status = $2,
            expires_at = $3,
            consumed_at = $4,
            consumed_by_test_run_id = $5,
            invalidated_at = $6,
            invalidation_reason_code = $7,
            invalidation_reason_detail = $8,
            expired_at = $9,
            expiration_reason_code = $10,
            revoked_at = $11,
            revoked_by_supervisor_id = $12,
            revocation_note = $13
        WHERE launch_approval_id = $1
      `,
      [
        launchApproval.launchApprovalId,
        launchApproval.status,
        launchApproval.expiresAt,
        launchApproval.consumedAt,
        launchApproval.consumedByTestRunId,
        launchApproval.invalidatedAt,
        launchApproval.invalidationReasonCode,
        launchApproval.invalidationReasonDetail,
        launchApproval.expiredAt,
        launchApproval.expirationReasonCode,
        launchApproval.revokedAt,
        launchApproval.revokedBySupervisorId,
        launchApproval.revocationNote
      ]
    );
  },
  saveAuditEvent: async auditEvent => {
    await pool.query(
      `
        INSERT INTO audit_events (
          audit_event_id, request_id, tenant_id, workspace_id, participant_session_id, test_run_id,
          login_key, group_key, assignment_key, actor_type, actor_id, event_type, payload, occurred_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14)
      `,
      [
        auditEvent.auditEventId,
        auditEvent.requestId,
        auditEvent.tenantId,
        auditEvent.workspaceId,
        auditEvent.participantSessionId,
        auditEvent.testRunId,
        auditEvent.loginKey,
        auditEvent.groupKey,
        auditEvent.assignmentKey,
        auditEvent.actorType,
        auditEvent.actorId,
        auditEvent.eventType,
        JSON.stringify(auditEvent.payload),
        auditEvent.occurredAt
      ]
    );
  },
  saveMonitorCommand: async monitorCommand => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query(
        `
          INSERT INTO monitor_commands (
            command_id, request_id, tenant_id, workspace_id, test_run_id, participant_session_id,
            login_key, group_key, assignment_key, attempt_number, command_type, ack_state, actor_id,
            issued_at, delivered_at, resolved_at, rejection_reason
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        `,
        [
          monitorCommand.commandId,
          monitorCommand.requestId,
          monitorCommand.tenantId,
          monitorCommand.workspaceId,
          monitorCommand.testRunId,
          monitorCommand.participantSessionId,
          monitorCommand.loginKey,
          monitorCommand.groupKey,
          monitorCommand.assignmentKey,
          monitorCommand.attemptNumber,
          monitorCommand.commandType,
          monitorCommand.ackState,
          monitorCommand.actorId,
          monitorCommand.issuedAt,
          monitorCommand.deliveredAt,
          monitorCommand.resolvedAt,
          monitorCommand.rejectionReason
        ]
      );

      if (monitorCommand.ackState === "pending_delivery" && monitorCommand.resolvedAt === null) {
        await client.query(
          `
            INSERT INTO monitor_command_dispatch_queue (
              dispatch_queue_id, command_id, queue_status, claimed_by, attempt_count,
              enqueued_at, claimed_at, lease_expires_at, completed_at, last_error
            )
            VALUES ($1, $2, 'pending', NULL, 0, $3, NULL, NULL, NULL, NULL)
          `,
          [`dispatch-${monitorCommand.commandId}`, monitorCommand.commandId, monitorCommand.issuedAt]
        );

        await client.query(
          "SELECT pg_notify($1, $2)",
          [monitorCommandDispatchQueueChannel, monitorCommand.commandId]
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
  updateMonitorCommand: async monitorCommand => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query(
        `
          UPDATE monitor_commands
          SET ack_state = $2,
              delivered_at = $3,
              resolved_at = $4,
              rejection_reason = $5
          WHERE command_id = $1
        `,
        [
          monitorCommand.commandId,
          monitorCommand.ackState,
          monitorCommand.deliveredAt,
          monitorCommand.resolvedAt,
          monitorCommand.rejectionReason
        ]
      );

      if (["applied", "rejected", "expired"].includes(monitorCommand.ackState)) {
        await client.query(
          `
            UPDATE monitor_command_dispatch_queue
            SET queue_status = $2,
                completed_at = COALESCE($3, NOW()),
                lease_expires_at = NULL,
                last_error = $4
            WHERE command_id = $1
          `,
          [
            monitorCommand.commandId,
            monitorCommand.ackState,
            monitorCommand.resolvedAt,
            monitorCommand.rejectionReason
          ]
        );
      }

      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
  saveTestRun: async testRun => {
    await pool.query(
      `
        INSERT INTO test_runs (
          test_run_id, participant_session_id, tenant_id, workspace_id, content_release_id,
          login_key, group_key, assignment_key, attempt_number, booklet_key, booklet_title, status,
          unit_sequence, current_unit_index, current_unit_key, navigation_locked, time_limit_seconds,
          pause_accumulated_ms, paused_at, launch_approval_id, launch_approval_scope,
          launch_approved_by_supervisor_id, launch_approval_note, launch_approved_at,
          initial_state_overrides, unit_responses, created_at, updated_at, completed_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25::jsonb, $26::jsonb, $27, $28, $29)
      `,
      [
        testRun.testRunId,
        testRun.participantSessionId,
        testRun.tenantId,
        testRun.workspaceId,
        testRun.contentReleaseId,
        testRun.loginKey,
        testRun.groupKey,
        testRun.assignmentKey,
        testRun.attemptNumber,
        testRun.bookletKey,
        testRun.bookletTitle,
        testRun.status,
        JSON.stringify(testRun.unitSequence),
        testRun.currentUnitIndex,
        testRun.currentUnitKey,
        testRun.navigationLocked,
        testRun.timeLimitSeconds,
        testRun.pauseAccumulatedMs,
        testRun.pausedAt,
        testRun.launchApprovalId,
        testRun.launchApprovalScope,
        testRun.launchApprovedBySupervisorId,
        testRun.launchApprovalNote,
        testRun.launchApprovedAt,
        JSON.stringify(testRun.initialStateOverrides),
        JSON.stringify(testRun.unitResponses),
        testRun.createdAt,
        testRun.updatedAt,
        testRun.completedAt
      ]
    );
  },
  updateTestRun: async testRun => {
    await pool.query(
      `
        UPDATE test_runs
        SET status = $2,
            current_unit_index = $3,
            current_unit_key = $4,
            navigation_locked = $5,
            time_limit_seconds = $6,
            pause_accumulated_ms = $7,
            paused_at = $8,
            launch_approval_id = $9,
            launch_approval_scope = $10,
            launch_approved_by_supervisor_id = $11,
            launch_approval_note = $12,
            launch_approved_at = $13,
            initial_state_overrides = $14::jsonb,
            unit_responses = $15::jsonb,
            updated_at = $16,
            completed_at = $17
        WHERE test_run_id = $1
      `,
      [
        testRun.testRunId,
        testRun.status,
        testRun.currentUnitIndex,
        testRun.currentUnitKey,
        testRun.navigationLocked,
        testRun.timeLimitSeconds,
        testRun.pauseAccumulatedMs,
        testRun.pausedAt,
        testRun.launchApprovalId,
        testRun.launchApprovalScope,
        testRun.launchApprovedBySupervisorId,
        testRun.launchApprovalNote,
        testRun.launchApprovedAt,
        JSON.stringify(testRun.initialStateOverrides),
        JSON.stringify(testRun.unitResponses),
        testRun.updatedAt,
        testRun.completedAt
      ]
    );
  },
  getTenantById: async tenantId => {
    const result = await pool.query(
      `
        SELECT
          tenant_id, tenant_key, display_name, status, default_activation_policy,
          default_operational_policy, default_launch_approval_policy,
          default_notification_provider_promotion_policy, default_notification_policy,
          default_notification_provider_profiles, default_evidence_retention_policy,
          default_evidence_retention_class_policy
        FROM tenants
        WHERE tenant_id = $1
      `,
      [tenantId]
    );

    return result.rows[0] ? mapTenant(result.rows[0]) : undefined;
  },
  getTenantByKey: async tenantKey => {
    const result = await pool.query(
      `
        SELECT
          tenant_id, tenant_key, display_name, status, default_activation_policy,
          default_operational_policy, default_launch_approval_policy,
          default_notification_provider_promotion_policy, default_notification_policy,
          default_notification_provider_profiles, default_evidence_retention_policy,
          default_evidence_retention_class_policy
        FROM tenants
        WHERE tenant_key = $1
      `,
      [tenantKey]
    );

    return result.rows[0] ? mapTenant(result.rows[0]) : undefined;
  },
  getWorkspaceById: async workspaceId => {
    const result = await pool.query(
      `
        SELECT
          workspace_id, tenant_id, workspace_key, display_name, status,
          activation_policy_override, operational_policy_override, launch_approval_policy_override,
          notification_provider_promotion_policy_override, notification_policy_override,
          notification_provider_profile_override, evidence_retention_policy_override,
          evidence_retention_class_policy_override
        FROM workspaces
        WHERE workspace_id = $1
      `,
      [workspaceId]
    );

    return result.rows[0] ? mapWorkspace(result.rows[0]) : undefined;
  },
  getWorkspaceByKey: async (tenantKey, workspaceKey) => resolveWorkspace(pool, tenantKey, workspaceKey),
  getSourcePackageById: async sourcePackageId => {
    const result = await pool.query(
      `
        SELECT source_package_id, tenant_id, workspace_id, file_name, manifest_hash, format, status, uploaded_at, uploaded_by
        FROM source_packages
        WHERE source_package_id = $1
      `,
      [sourcePackageId]
    );

    return result.rows[0] ? mapSourcePackage(result.rows[0]) : undefined;
  },
  getImportJobById: async importJobId => {
    const result = await pool.query(
      `
        SELECT import_job_id, tenant_id, workspace_id, source_package_id, status, created_at, completed_at, failure_message
        FROM import_jobs
        WHERE import_job_id = $1
      `,
      [importJobId]
    );

    return result.rows[0] ? mapImportJob(result.rows[0]) : undefined;
  },
  getContentReleaseById: async contentReleaseId => {
    const result = await pool.query(
      `
        SELECT
          content_release_id, tenant_id, workspace_id, source_package_id, import_job_id,
          fixture_key, release_label, status, created_at, activated_at, canonical_payload
        FROM content_releases
        WHERE content_release_id = $1
      `,
      [contentReleaseId]
    );

    return result.rows[0] ? mapContentRelease(result.rows[0]) : undefined;
  },
  getContentReleaseByImportJobId: async importJobId => {
    const result = await pool.query(
      `
        SELECT
          content_release_id, tenant_id, workspace_id, source_package_id, import_job_id,
          fixture_key, release_label, status, created_at, activated_at, canonical_payload
        FROM content_releases
        WHERE import_job_id = $1
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [importJobId]
    );

    return result.rows[0] ? mapContentRelease(result.rows[0]) : undefined;
  },
  getActiveContentReleaseByWorkspace: async (tenantKey, workspaceKey) => {
    const result = await pool.query(
      `
        SELECT
          cr.content_release_id, cr.tenant_id, cr.workspace_id, cr.source_package_id, cr.import_job_id,
          cr.fixture_key, cr.release_label, cr.status, cr.created_at, cr.activated_at, cr.canonical_payload
        FROM content_releases cr
        JOIN workspaces w ON w.active_content_release_id = cr.content_release_id
        JOIN tenants t ON t.tenant_id = w.tenant_id
        WHERE t.tenant_key = $1 AND w.workspace_key = $2
      `,
      [tenantKey, workspaceKey]
    );

    return result.rows[0] ? mapContentRelease(result.rows[0]) : undefined;
  },
  getParticipantSessionByToken: async sessionToken => {
    const result = await pool.query(
      `
        SELECT
          participant_session_id, session_token, tenant_id, workspace_id,
          content_release_id, login_key, group_key, created_at
        FROM participant_sessions
        WHERE session_token = $1
      `,
      [sessionToken]
    );

    return result.rows[0] ? mapParticipantSession(result.rows[0]) : undefined;
  },
  getParticipantSessionById: async participantSessionId => {
    const result = await pool.query(
      `
        SELECT
          participant_session_id, session_token, tenant_id, workspace_id,
          content_release_id, login_key, group_key, created_at
        FROM participant_sessions
        WHERE participant_session_id = $1
      `,
      [participantSessionId]
    );

    return result.rows[0] ? mapParticipantSession(result.rows[0]) : undefined;
  },
  getSystemCheckEvidenceByKey: async evidenceKey => {
    const result = await pool.query(
      `
        SELECT
          evidence_key, participant_session_id, tenant_id, workspace_id, content_release_id,
          login_key, group_key, system_check_key, check_key, file_name, content_type,
          byte_size, sha256, payload_base64, payload_preview_text, storage_backend, storage_locator,
          retention_class, retention_policy_key, retention_expires_at, retention_hold, purged_at, purge_reason_code, created_at
        FROM system_check_evidence
        WHERE evidence_key = $1
      `,
      [evidenceKey]
    );

    return result.rows[0] ? mapSystemCheckEvidence(result.rows[0]) : undefined;
  },
  getSystemCheckEvidenceAccessGrantByToken: async accessToken => {
    const result = await pool.query(
      `
        SELECT
          access_grant_id, access_token, evidence_key, tenant_id, workspace_id, participant_session_id,
          issued_for, actor_type, actor_id, issued_at, expires_at, last_accessed_at
        FROM system_check_evidence_access_grants
        WHERE access_token = $1
      `,
      [accessToken]
    );

    return result.rows[0] ? mapSystemCheckEvidenceAccessGrant(result.rows[0]) : undefined;
  },
  getSystemCheckEvidenceBreachNotificationById: async notificationId => {
    const result = await pool.query(
      `
        SELECT
          notification_id, evidence_key, participant_session_id, tenant_id, workspace_id,
          content_release_id, login_key, group_key, system_check_key, check_key,
          hold_reason_code, escalation_target, assigned_to_actor_id, notification_channel, status,
          created_at, created_by_actor_type, created_by_actor_id, source_request_id, delivery_profile_key,
          delivery_channel, delivery_status, delivery_target, delivery_attempt_count,
          max_delivery_attempts, next_delivery_attempt_at, last_delivery_attempt_at,
          last_delivery_receipt_id, last_delivery_receipt_issued_at, delivered_at,
          last_delivery_error, acknowledged_at, acknowledged_by_actor_id, acknowledgement_note
        FROM system_check_evidence_breach_notifications
        WHERE notification_id = $1
      `,
      [notificationId]
    );

    return result.rows[0] ? mapSystemCheckEvidenceBreachNotification(result.rows[0]) : undefined;
  },
  getNotificationProviderProfileIncidentById: async incidentId => {
    const result = await pool.query(
      `
        SELECT
          incident_id, tenant_id, workspace_id, profile_key, incident_type, status,
          opened_at, opened_by_actor_type, opened_by_actor_id, reason_code,
          delivery_failed_count, suppression_until, source_request_id,
          acknowledged_at, acknowledged_by_actor_id, acknowledgement_note,
          resolved_at, resolution_code
        FROM notification_provider_profile_incidents
        WHERE incident_id = $1
      `,
      [incidentId]
    );

    return result.rows[0] ? mapNotificationProviderProfileIncident(result.rows[0]) : undefined;
  },
  getLatestUnresolvedNotificationProviderProfileIncident: async (workspaceId, profileKey) => {
    const result = await pool.query(
      `
        SELECT
          incident_id, tenant_id, workspace_id, profile_key, incident_type, status,
          opened_at, opened_by_actor_type, opened_by_actor_id, reason_code,
          delivery_failed_count, suppression_until, source_request_id,
          acknowledged_at, acknowledged_by_actor_id, acknowledgement_note,
          resolved_at, resolution_code
        FROM notification_provider_profile_incidents
        WHERE workspace_id = $1
          AND profile_key = $2
          AND status IN ('open', 'acknowledged')
        ORDER BY opened_at DESC
        LIMIT 1
      `,
      [workspaceId, profileKey]
    );

    return result.rows[0] ? mapNotificationProviderProfileIncident(result.rows[0]) : undefined;
  },
  getSystemCheckLaunchApprovalById: async launchApprovalId => {
    const result = await pool.query(
      `
        SELECT
          launch_approval_id, participant_session_id, tenant_id, workspace_id, content_release_id,
          login_key, group_key, assignment_key, readiness_status, warning_reason_codes, approval_scope,
          status, approved_at, approved_by_supervisor_id, approval_note, expires_at,
          consumed_at, consumed_by_test_run_id, invalidated_at, invalidation_reason_code, invalidation_reason_detail,
          expired_at, expiration_reason_code,
          revoked_at, revoked_by_supervisor_id, revocation_note
        FROM system_check_launch_approvals
        WHERE launch_approval_id = $1
      `,
      [launchApprovalId]
    );

    return result.rows[0] ? mapSystemCheckLaunchApproval(result.rows[0]) : undefined;
  },
  getSystemCheckSubmissionById: async systemCheckSubmissionId => {
    const result = await pool.query(
      `
        SELECT
          system_check_submission_id, participant_session_id, tenant_id, workspace_id, content_release_id,
          login_key, group_key, system_check_key, status, check_results, review_status, review_note,
          reviewed_at, reviewed_by_actor_type, reviewed_by_actor_id, submitted_at
        FROM system_check_submissions
        WHERE system_check_submission_id = $1
      `,
      [systemCheckSubmissionId]
    );

    return result.rows[0] ? mapSystemCheckSubmission(result.rows[0]) : undefined;
  },
  getTestRunById: async testRunId => {
    const result = await pool.query(
      `
        SELECT
          test_run_id, participant_session_id, tenant_id, workspace_id, content_release_id,
          login_key, group_key, assignment_key, attempt_number, booklet_key, booklet_title, status,
          unit_sequence, current_unit_index, current_unit_key, navigation_locked, time_limit_seconds,
          pause_accumulated_ms, paused_at, launch_approval_id, launch_approval_scope,
          launch_approved_by_supervisor_id, launch_approval_note, launch_approved_at,
          initial_state_overrides, unit_responses, created_at, updated_at, completed_at
        FROM test_runs
        WHERE test_run_id = $1
      `,
      [testRunId]
    );

    return result.rows[0] ? mapTestRun(result.rows[0]) : undefined;
  },
  getOpenTestRunForSessionAssignment: async (participantSessionId, assignmentKey) => {
    const result = await pool.query(
      `
        SELECT
          test_run_id, participant_session_id, tenant_id, workspace_id, content_release_id,
          login_key, group_key, assignment_key, attempt_number, booklet_key, booklet_title, status,
          unit_sequence, current_unit_index, current_unit_key, navigation_locked, time_limit_seconds,
          pause_accumulated_ms, paused_at, launch_approval_id, launch_approval_scope,
          launch_approved_by_supervisor_id, launch_approval_note, launch_approved_at,
          initial_state_overrides, unit_responses, created_at, updated_at, completed_at
        FROM test_runs
        WHERE participant_session_id = $1 AND assignment_key = $2 AND status IN ('active', 'paused')
        ORDER BY created_at DESC
        LIMIT 1
      `,
      [participantSessionId, assignmentKey]
    );

    return result.rows[0] ? mapTestRun(result.rows[0]) : undefined;
  },
  getLatestTestRunForSessionAssignment: async (participantSessionId, assignmentKey) => {
    const result = await pool.query(
      `
        SELECT
          test_run_id, participant_session_id, tenant_id, workspace_id, content_release_id,
          login_key, group_key, assignment_key, attempt_number, booklet_key, booklet_title, status,
          unit_sequence, current_unit_index, current_unit_key, navigation_locked, time_limit_seconds,
          pause_accumulated_ms, paused_at, launch_approval_id, launch_approval_scope,
          launch_approved_by_supervisor_id, launch_approval_note, launch_approved_at,
          initial_state_overrides, unit_responses, created_at, updated_at, completed_at
        FROM test_runs
        WHERE participant_session_id = $1 AND assignment_key = $2
        ORDER BY attempt_number DESC, created_at DESC
        LIMIT 1
      `,
      [participantSessionId, assignmentKey]
    );

    return result.rows[0] ? mapTestRun(result.rows[0]) : undefined;
  },
  listParticipantSessionsByWorkspace: async (tenantKey, workspaceKey, options = {}) => {
    const workspace = await resolveWorkspace(pool, tenantKey, workspaceKey);

    if (!workspace) {
      return [];
    }

    const filters: Array<string | number> = [workspace.tenantId, workspace.workspaceId];
    const whereClauses = [
      "tenant_id = $1",
      "workspace_id = $2"
    ];

    if (options.groupKey) {
      filters.push(options.groupKey);
      whereClauses.push(`group_key = $${filters.length}`);
    }

    filters.push(options.limit ?? 50);

    const result = await pool.query(
      `
        SELECT
          participant_session_id, session_token, tenant_id, workspace_id,
          content_release_id, login_key, group_key, created_at
        FROM participant_sessions
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY created_at DESC
        LIMIT $${filters.length}
      `,
      filters
    );

    return result.rows.map(mapParticipantSession);
  },
  listMonitorTestRunsByWorkspace: async (tenantKey, workspaceKey, options = {}) => {
    const workspace = await resolveWorkspace(pool, tenantKey, workspaceKey);

    if (!workspace) {
      return [];
    }

    const filters: Array<string | null> = [workspace.tenantId, workspace.workspaceId];
    let groupFilterSql = "";

    if (options.groupKey) {
      filters.push(options.groupKey);
      groupFilterSql = ` AND group_key = $${filters.length}`;
    }

    const result = await pool.query(
      `
        SELECT
          test_run_id, participant_session_id, tenant_id, workspace_id, content_release_id,
          login_key, group_key, assignment_key, attempt_number, booklet_key, booklet_title, status,
          unit_sequence, current_unit_index, current_unit_key, navigation_locked, time_limit_seconds,
          pause_accumulated_ms, paused_at, launch_approval_id, launch_approval_scope,
          launch_approved_by_supervisor_id, launch_approval_note, launch_approved_at,
          initial_state_overrides, unit_responses, created_at, updated_at, completed_at
        FROM test_runs
        WHERE tenant_id = $1
          AND workspace_id = $2
          AND status IN ('active', 'paused')
          ${groupFilterSql}
        ORDER BY group_key ASC, login_key ASC, created_at ASC
      `,
      filters
    );

    return result.rows.map(mapTestRun);
  },
  listSystemCheckSubmissionsByParticipantSession: async participantSessionId => {
    const result = await pool.query(
      `
        SELECT
          system_check_submission_id, participant_session_id, tenant_id, workspace_id, content_release_id,
          login_key, group_key, system_check_key, status, check_results, review_status, review_note,
          reviewed_at, reviewed_by_actor_type, reviewed_by_actor_id, submitted_at
        FROM system_check_submissions
        WHERE participant_session_id = $1
        ORDER BY submitted_at DESC
      `,
      [participantSessionId]
    );

    return result.rows.map(mapSystemCheckSubmission);
  },
  listSystemCheckEvidenceByParticipantSession: async participantSessionId => {
    const result = await pool.query(
      `
        SELECT
          evidence_key, participant_session_id, tenant_id, workspace_id, content_release_id,
          login_key, group_key, system_check_key, check_key, file_name, content_type,
          byte_size, sha256, payload_base64, payload_preview_text, storage_backend, storage_locator,
          retention_class, retention_policy_key, retention_expires_at, retention_hold, purged_at, purge_reason_code, created_at
        FROM system_check_evidence
        WHERE participant_session_id = $1
        ORDER BY created_at DESC
      `,
      [participantSessionId]
    );

    return result.rows.map(mapSystemCheckEvidence);
  },
  listSystemCheckEvidenceByWorkspace: async (tenantKey, workspaceKey, options = {}) => {
    const workspace = await resolveWorkspace(pool, tenantKey, workspaceKey);

    if (!workspace) {
      return [];
    }

    const filters: Array<string | number> = [workspace.tenantId, workspace.workspaceId];
    const whereClauses = [
      "tenant_id = $1",
      "workspace_id = $2"
    ];

    if (options.groupKey) {
      filters.push(options.groupKey);
      whereClauses.push(`group_key = $${filters.length}`);
    }

    if (options.heldOnly) {
      whereClauses.push("retention_hold IS NOT NULL");
      whereClauses.push("purged_at IS NULL");
    }

    filters.push(options.limit ?? 200);

    const result = await pool.query(
      `
        SELECT
          evidence_key, participant_session_id, tenant_id, workspace_id, content_release_id,
          login_key, group_key, system_check_key, check_key, file_name, content_type,
          byte_size, sha256, payload_base64, payload_preview_text, storage_backend, storage_locator,
          retention_class, retention_policy_key, retention_expires_at, retention_hold, purged_at, purge_reason_code, created_at
        FROM system_check_evidence
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY created_at DESC
        LIMIT $${filters.length}
      `,
      filters
    );

    return result.rows.map(mapSystemCheckEvidence);
  },
  listSystemCheckEvidenceByKeys: async evidenceKeys => {
    if (evidenceKeys.length === 0) {
      return [];
    }

    const result = await pool.query(
      `
        SELECT
          evidence_key, participant_session_id, tenant_id, workspace_id, content_release_id,
          login_key, group_key, system_check_key, check_key, file_name, content_type,
          byte_size, sha256, payload_base64, payload_preview_text, storage_backend, storage_locator,
          retention_class, retention_policy_key, retention_expires_at, retention_hold, purged_at, purge_reason_code, created_at
        FROM system_check_evidence
        WHERE evidence_key = ANY($1::text[])
      `,
      [evidenceKeys]
    );

    return result.rows.map(mapSystemCheckEvidence);
  },
  listSystemCheckEvidenceBreachNotificationsByWorkspace: async (
    tenantKey,
    workspaceKey,
    options = {}
  ) => {
    const workspace = await resolveWorkspace(pool, tenantKey, workspaceKey);

    if (!workspace) {
      return [];
    }

    const filters: Array<string | number> = [workspace.tenantId, workspace.workspaceId];
    const whereClauses = [
      "tenant_id = $1",
      "workspace_id = $2"
    ];

    if (options.groupKey) {
      filters.push(options.groupKey);
      whereClauses.push(`group_key = $${filters.length}`);
    }

    if (options.escalationTarget) {
      filters.push(options.escalationTarget);
      whereClauses.push(`escalation_target = $${filters.length}`);
    }

    if (options.assignedToActorId) {
      filters.push(options.assignedToActorId);
      whereClauses.push(`assigned_to_actor_id = $${filters.length}`);
    }

    if (options.status) {
      filters.push(options.status);
      whereClauses.push(`status = $${filters.length}`);
    }

    if (options.deliveryChannel) {
      filters.push(options.deliveryChannel);
      whereClauses.push(`delivery_channel = $${filters.length}`);
    }

    if (options.deliveryStatus) {
      filters.push(options.deliveryStatus);
      whereClauses.push(`delivery_status = $${filters.length}`);
    }

    filters.push(options.limit ?? 50);

    const result = await pool.query(
      `
        SELECT
          notification_id, evidence_key, participant_session_id, tenant_id, workspace_id,
          content_release_id, login_key, group_key, system_check_key, check_key,
          hold_reason_code, escalation_target, assigned_to_actor_id, notification_channel, status,
          created_at, created_by_actor_type, created_by_actor_id, source_request_id, delivery_profile_key,
          delivery_channel, delivery_status, delivery_target, delivery_attempt_count,
          max_delivery_attempts, next_delivery_attempt_at, last_delivery_attempt_at,
          last_delivery_receipt_id, last_delivery_receipt_issued_at, delivered_at,
          last_delivery_error, acknowledged_at, acknowledged_by_actor_id, acknowledgement_note
        FROM system_check_evidence_breach_notifications
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY created_at DESC
        LIMIT $${filters.length}
      `,
      filters
    );

    return result.rows.map(mapSystemCheckEvidenceBreachNotification);
  },
  listNotificationProviderProfileIncidentsByWorkspace: async (
    tenantKey,
    workspaceKey,
    options = {}
  ) => {
    const workspace = await resolveWorkspace(pool, tenantKey, workspaceKey);

    if (!workspace) {
      return [];
    }

    const filters: Array<string | number> = [workspace.tenantId, workspace.workspaceId];
    const whereClauses = [
      "tenant_id = $1",
      "workspace_id = $2"
    ];

    if (options.profileKey) {
      filters.push(options.profileKey);
      whereClauses.push(`profile_key = $${filters.length}`);
    }

    if (options.incidentType) {
      filters.push(options.incidentType);
      whereClauses.push(`incident_type = $${filters.length}`);
    }

    if (options.status) {
      filters.push(options.status);
      whereClauses.push(`status = $${filters.length}`);
    }

    filters.push(options.limit ?? 50);

    const result = await pool.query(
      `
        SELECT
          incident_id, tenant_id, workspace_id, profile_key, incident_type, status,
          opened_at, opened_by_actor_type, opened_by_actor_id, reason_code,
          delivery_failed_count, suppression_until, source_request_id,
          acknowledged_at, acknowledged_by_actor_id, acknowledgement_note,
          resolved_at, resolution_code
        FROM notification_provider_profile_incidents
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY opened_at DESC
        LIMIT $${filters.length}
      `,
      filters
    );

    return result.rows.map(mapNotificationProviderProfileIncident);
  },
  listPendingSystemCheckEvidenceBreachNotificationDeliveries: async limit => {
    const result = await pool.query(
      `
        SELECT
          notification_id, evidence_key, participant_session_id, tenant_id, workspace_id,
          content_release_id, login_key, group_key, system_check_key, check_key,
          hold_reason_code, escalation_target, assigned_to_actor_id, notification_channel, status,
          created_at, created_by_actor_type, created_by_actor_id, source_request_id, delivery_profile_key,
          delivery_channel, delivery_status, delivery_target, delivery_attempt_count,
          max_delivery_attempts, next_delivery_attempt_at, last_delivery_attempt_at,
          last_delivery_receipt_id, last_delivery_receipt_issued_at, delivered_at,
          last_delivery_error, acknowledged_at, acknowledged_by_actor_id, acknowledgement_note
        FROM system_check_evidence_breach_notifications
        WHERE delivery_status = 'pending_delivery'
          AND COALESCE(next_delivery_attempt_at, created_at) <= NOW()
        ORDER BY COALESCE(next_delivery_attempt_at, created_at) ASC, created_at ASC
        LIMIT $1
      `,
      [limit]
    );

    return result.rows.map(mapSystemCheckEvidenceBreachNotification);
  },
  listSystemCheckEvidenceRetentionPurgeCandidates: async limit => {
    const result = await pool.query(
      `
        SELECT
          evidence_key, participant_session_id, tenant_id, workspace_id, content_release_id,
          login_key, group_key, system_check_key, check_key, file_name, content_type,
          byte_size, sha256, payload_base64, payload_preview_text, storage_backend, storage_locator,
          retention_class, retention_policy_key, retention_expires_at, retention_hold, purged_at, purge_reason_code, created_at
        FROM system_check_evidence
        WHERE retention_expires_at IS NOT NULL
          AND retention_hold IS NULL
          AND purged_at IS NULL
          AND retention_expires_at <= NOW()
        ORDER BY retention_expires_at ASC, created_at ASC
        LIMIT $1
      `,
      [limit]
    );

    return result.rows.map(mapSystemCheckEvidence);
  },
  listSystemCheckEvidenceHoldEscalationCandidates: async limit => {
    const result = await pool.query(
      `
        SELECT
          evidence_key, participant_session_id, tenant_id, workspace_id, content_release_id,
          login_key, group_key, system_check_key, check_key, file_name, content_type,
          byte_size, sha256, payload_base64, payload_preview_text, storage_backend, storage_locator,
          retention_class, retention_policy_key, retention_expires_at, retention_hold, purged_at, purge_reason_code, created_at
        FROM system_check_evidence
        WHERE retention_hold IS NOT NULL
          AND purged_at IS NULL
          AND COALESCE(retention_hold ->> 'acknowledgedAt', '') = ''
          AND COALESCE(retention_hold ->> 'escalatedAt', '') = ''
          AND COALESCE(retention_hold ->> 'escalationTarget', '') <> ''
          AND COALESCE(retention_hold ->> 'slaDueAt', '') <> ''
          AND ((retention_hold ->> 'slaDueAt')::timestamptz) <= NOW()
        ORDER BY ((retention_hold ->> 'slaDueAt')::timestamptz) ASC, created_at ASC
        LIMIT $1
      `,
      [limit]
    );

    return result.rows.map(mapSystemCheckEvidence);
  },
  listSystemCheckLaunchApprovalsByParticipantSession: async (participantSessionId, options = {}) => {
    const filters: Array<string | number> = [participantSessionId];
    const whereClauses = ["participant_session_id = $1"];

    if (options.status) {
      filters.push(options.status);
      whereClauses.push(`status = $${filters.length}`);
    }

    filters.push(options.limit ?? 50);

    const result = await pool.query(
      `
        SELECT
          launch_approval_id, participant_session_id, tenant_id, workspace_id, content_release_id,
          login_key, group_key, assignment_key, readiness_status, warning_reason_codes, approval_scope,
          status, approved_at, approved_by_supervisor_id, approval_note, expires_at,
          consumed_at, consumed_by_test_run_id, invalidated_at, invalidation_reason_code, invalidation_reason_detail,
          expired_at, expiration_reason_code,
          revoked_at, revoked_by_supervisor_id, revocation_note
        FROM system_check_launch_approvals
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY approved_at DESC
        LIMIT $${filters.length}
      `,
      filters
    );

    return result.rows.map(mapSystemCheckLaunchApproval);
  },
  listSystemCheckLaunchApprovalsByWorkspace: async (tenantKey, workspaceKey, options = {}) => {
    const workspace = await resolveWorkspace(pool, tenantKey, workspaceKey);

    if (!workspace) {
      return [];
    }

    const filters: Array<string | number> = [workspace.tenantId, workspace.workspaceId];
    const whereClauses = [
      "tenant_id = $1",
      "workspace_id = $2"
    ];

    if (options.participantSessionId) {
      filters.push(options.participantSessionId);
      whereClauses.push(`participant_session_id = $${filters.length}`);
    }

    if (options.assignmentKey) {
      filters.push(options.assignmentKey);
      whereClauses.push(`assignment_key = $${filters.length}`);
    }

    if (options.status) {
      filters.push(options.status);
      whereClauses.push(`status = $${filters.length}`);
    }

    if (options.approvalScope) {
      filters.push(options.approvalScope);
      whereClauses.push(`approval_scope = $${filters.length}`);
    }

    filters.push(options.limit ?? 50);

    const result = await pool.query(
      `
        SELECT
          launch_approval_id, participant_session_id, tenant_id, workspace_id, content_release_id,
          login_key, group_key, assignment_key, readiness_status, warning_reason_codes, approval_scope,
          status, approved_at, approved_by_supervisor_id, approval_note, expires_at,
          consumed_at, consumed_by_test_run_id, invalidated_at, invalidation_reason_code, invalidation_reason_detail,
          expired_at, expiration_reason_code,
          revoked_at, revoked_by_supervisor_id, revocation_note
        FROM system_check_launch_approvals
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY approved_at DESC
        LIMIT $${filters.length}
      `,
      filters
    );

    return result.rows.map(mapSystemCheckLaunchApproval);
  },
  listSystemCheckSubmissionsByWorkspace: async (tenantKey, workspaceKey, options = {}) => {
    const workspace = await resolveWorkspace(pool, tenantKey, workspaceKey);

    if (!workspace) {
      return [];
    }

    const filters: Array<string | number> = [workspace.tenantId, workspace.workspaceId];
    const whereClauses = [
      "tenant_id = $1",
      "workspace_id = $2"
    ];

    if (options.groupKey) {
      filters.push(options.groupKey);
      whereClauses.push(`group_key = $${filters.length}`);
    }

    if (options.status) {
      filters.push(options.status);
      whereClauses.push(`status = $${filters.length}`);
    }

    if (options.reviewStatus) {
      filters.push(options.reviewStatus);
      whereClauses.push(`review_status = $${filters.length}`);
    }

    filters.push(options.limit ?? 50);

    const result = await pool.query(
      `
        SELECT
          system_check_submission_id, participant_session_id, tenant_id, workspace_id, content_release_id,
          login_key, group_key, system_check_key, status, check_results, review_status, review_note,
          reviewed_at, reviewed_by_actor_type, reviewed_by_actor_id, submitted_at
        FROM system_check_submissions
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY submitted_at DESC
        LIMIT $${filters.length}
      `,
      filters
    );

    return result.rows.map(mapSystemCheckSubmission);
  },
  listActiveTimedTestRuns: async limit => {
    const result = await pool.query(
      `
        SELECT
          test_run_id, participant_session_id, tenant_id, workspace_id, content_release_id,
          login_key, group_key, assignment_key, attempt_number, booklet_key, booklet_title, status,
          unit_sequence, current_unit_index, current_unit_key, navigation_locked, time_limit_seconds,
          pause_accumulated_ms, paused_at, launch_approval_id, launch_approval_scope,
          launch_approved_by_supervisor_id, launch_approval_note, launch_approved_at,
          initial_state_overrides, unit_responses, created_at, updated_at, completed_at
        FROM test_runs
        WHERE status = 'active'
          AND time_limit_seconds IS NOT NULL
        ORDER BY created_at ASC
        LIMIT $1
      `,
      [limit]
    );

    return result.rows.map(mapTestRun);
  },
  listAuditEventsByTenant: async (tenantKey, options) => {
    const filters: Array<string | number | string[]> = [tenantKey];
    const whereClauses = [
      "t.tenant_key = $1"
    ];

    if (options.eventTypes && options.eventTypes.length > 0) {
      filters.push(options.eventTypes);
      whereClauses.push(`a.event_type = ANY($${filters.length})`);
    }

    filters.push(options.limit);

    const result = await pool.query(
      `
        SELECT
          a.audit_event_id, a.request_id, a.tenant_id, a.workspace_id, a.participant_session_id, a.test_run_id,
          a.login_key, a.group_key, a.assignment_key, a.actor_type, a.actor_id, a.event_type, a.payload, a.occurred_at
        FROM audit_events a
        JOIN tenants t ON t.tenant_id = a.tenant_id
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY a.occurred_at DESC
        LIMIT $${filters.length}
      `,
      filters
    );

    return result.rows.map(mapAuditEvent);
  },
  listAuditEventsByWorkspace: async (tenantKey, workspaceKey, options) => {
    const workspace = await resolveWorkspace(pool, tenantKey, workspaceKey);

    if (!workspace) {
      return [];
    }

    const filters: Array<string | number | string[]> = [workspace.tenantId, workspace.workspaceId];
    const whereClauses = [
      "tenant_id = $1",
      "workspace_id = $2"
    ];

    if (options.eventTypes && options.eventTypes.length > 0) {
      filters.push(options.eventTypes);
      whereClauses.push(`event_type = ANY($${filters.length})`);
    }

    filters.push(options.limit);

    const result = await pool.query(
      `
        SELECT
          audit_event_id, request_id, tenant_id, workspace_id, participant_session_id, test_run_id,
          login_key, group_key, assignment_key, actor_type, actor_id, event_type, payload, occurred_at
        FROM audit_events
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY occurred_at DESC
        LIMIT $${filters.length}
      `,
      filters
    );

    return result.rows.map(mapAuditEvent);
  },
  listAuditEventsBySystemCheckEvidence: async (tenantKey, workspaceKey, evidenceKey, options) => {
    const workspace = await resolveWorkspace(pool, tenantKey, workspaceKey);

    if (!workspace) {
      return [];
    }

    const filters: Array<string | number | string[]> = [workspace.tenantId, workspace.workspaceId, evidenceKey];
    const whereClauses = [
      "tenant_id = $1",
      "workspace_id = $2",
      "payload->>'evidenceKey' = $3"
    ];

    if (options.eventTypes && options.eventTypes.length > 0) {
      filters.push(options.eventTypes);
      whereClauses.push(`event_type = ANY($${filters.length})`);
    }

    filters.push(options.limit);

    const result = await pool.query(
      `
        SELECT
          audit_event_id, request_id, tenant_id, workspace_id, participant_session_id, test_run_id,
          login_key, group_key, assignment_key, actor_type, actor_id, event_type, payload, occurred_at
        FROM audit_events
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY occurred_at DESC
        LIMIT $${filters.length}
      `,
      filters
    );

    return result.rows.map(mapAuditEvent);
  },
  listMonitorCommandsByWorkspace: async (tenantKey, workspaceKey, options = {}) => {
    const workspace = await resolveWorkspace(pool, tenantKey, workspaceKey);

    if (!workspace) {
      return [];
    }

    const filters: Array<string | number> = [workspace.tenantId, workspace.workspaceId];
    const whereClauses = [
      "tenant_id = $1",
      "workspace_id = $2"
    ];

    if (options.testRunId) {
      filters.push(options.testRunId);
      whereClauses.push(`test_run_id = $${filters.length}`);
    }

    if (options.ackState) {
      filters.push(options.ackState);
      whereClauses.push(`ack_state = $${filters.length}`);
    }

    const limit = options.limit ?? 50;
    filters.push(limit);

    const result = await pool.query(
      `
        SELECT
          command_id, request_id, tenant_id, workspace_id, test_run_id, participant_session_id,
          login_key, group_key, assignment_key, attempt_number, command_type, ack_state, actor_id,
          issued_at, delivered_at, resolved_at, rejection_reason
        FROM monitor_commands
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY issued_at DESC
        LIMIT $${filters.length}
      `,
      filters
    );

    return result.rows.map(mapMonitorCommand);
  },
  claimNextPendingMonitorCommand: async consumerId => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const queuedResult = await client.query(
        `
          WITH candidate_queue AS (
            SELECT
              q.dispatch_queue_id,
              q.command_id,
              COALESCE(
                CAST(w.operational_policy_override->'monitorCommandLeaseSeconds'->>'value' AS INTEGER),
                CAST(t.default_operational_policy->>'monitorCommandLeaseSeconds' AS INTEGER)
              ) AS lease_seconds
            FROM monitor_command_dispatch_queue q
            JOIN monitor_commands c ON c.command_id = q.command_id
            JOIN workspaces w ON w.workspace_id = c.workspace_id
            JOIN tenants t ON t.tenant_id = c.tenant_id
            WHERE (
                q.queue_status = 'pending'
                OR (
                  q.queue_status = 'claimed'
                  AND q.lease_expires_at IS NOT NULL
                  AND q.lease_expires_at <= NOW()
                )
              )
              AND c.resolved_at IS NULL
              AND c.ack_state IN ('pending_delivery', 'delivered')
            ORDER BY q.enqueued_at ASC
            LIMIT 1
            FOR UPDATE OF q SKIP LOCKED
          )
          UPDATE monitor_command_dispatch_queue q
          SET queue_status = 'claimed',
              claimed_by = $1,
              claimed_at = NOW(),
              lease_expires_at = NOW() + make_interval(secs => candidate_queue.lease_seconds),
              attempt_count = q.attempt_count + 1
          FROM candidate_queue
          WHERE q.command_id = candidate_queue.command_id
          RETURNING
            q.dispatch_queue_id,
            q.command_id
        `,
        [consumerId]
      );

      if (!queuedResult.rows[0]) {
        await client.query("COMMIT");
        return undefined;
      }

      const commandId = queuedResult.rows[0].command_id as string;

      const deliveredResult = await client.query(
        `
          UPDATE monitor_commands
          SET ack_state = CASE
                WHEN ack_state = 'pending_delivery' THEN 'delivered'
                ELSE ack_state
              END,
              delivered_at = COALESCE(delivered_at, NOW())
          WHERE command_id = $1
          RETURNING
            command_id, request_id, tenant_id, workspace_id, test_run_id, participant_session_id,
            login_key, group_key, assignment_key, attempt_number, command_type, ack_state, actor_id,
            issued_at, delivered_at, resolved_at, rejection_reason
        `,
        [commandId]
      );

      await client.query("COMMIT");
      return deliveredResult.rows[0] ? mapMonitorCommand(deliveredResult.rows[0]) : undefined;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
  completeMonitorCommandDispatch: async (commandId, finalStatus, lastError = null) => {
    await pool.query(
      `
        UPDATE monitor_command_dispatch_queue
        SET queue_status = $2,
            lease_expires_at = NULL,
            completed_at = NOW(),
            last_error = $3
        WHERE command_id = $1
      `,
      [commandId, finalStatus, lastError]
    );
  },
  listExpirableMonitorCommands: async limit => {
    const result = await pool.query(
      `
        SELECT
          c.command_id, c.request_id, c.tenant_id, c.workspace_id, c.test_run_id, c.participant_session_id,
          c.login_key, c.group_key, c.assignment_key, c.attempt_number, c.command_type, c.ack_state, c.actor_id,
          c.issued_at, c.delivered_at, c.resolved_at, c.rejection_reason
        FROM monitor_commands c
        JOIN workspaces w ON w.workspace_id = c.workspace_id
        JOIN tenants t ON t.tenant_id = c.tenant_id
        WHERE c.ack_state IN ('pending_delivery', 'delivered')
          AND c.resolved_at IS NULL
          AND COALESCE(c.delivered_at, c.issued_at) <= (
            NOW() - make_interval(
              secs => COALESCE(
                CAST(w.operational_policy_override->'monitorCommandTtlSeconds'->>'value' AS INTEGER),
                CAST(t.default_operational_policy->>'monitorCommandTtlSeconds' AS INTEGER)
              )
            )
          )
        ORDER BY COALESCE(c.delivered_at, c.issued_at) ASC
        LIMIT $1
      `,
      [limit]
    );

    return result.rows.map(mapMonitorCommand);
  },
  listTenants: async () => {
    const result = await pool.query(
      `
        SELECT
          tenant_id, tenant_key, display_name, status, default_activation_policy,
          default_operational_policy, default_launch_approval_policy,
          default_notification_provider_promotion_policy, default_notification_policy,
          default_notification_provider_profiles, default_evidence_retention_policy,
          default_evidence_retention_class_policy
        FROM tenants
        ORDER BY tenant_key
      `
    );

    return result.rows.map(mapTenant);
  },
  listWorkspacesByTenant: async tenantKey => {
    const result = await pool.query(
      `
        SELECT
          w.workspace_id,
          w.tenant_id,
          w.workspace_key,
          w.display_name,
          w.status,
          w.activation_policy_override,
          w.operational_policy_override,
          w.launch_approval_policy_override,
          w.notification_provider_promotion_policy_override,
          w.notification_policy_override,
          w.notification_provider_profile_override,
          w.evidence_retention_policy_override,
          w.evidence_retention_class_policy_override
        FROM workspaces w
        JOIN tenants t ON t.tenant_id = w.tenant_id
        WHERE t.tenant_key = $1
        ORDER BY w.workspace_key
      `,
      [tenantKey]
    );

    return result.rows.map(mapWorkspace);
  },
  listSourcePackagesByWorkspace: async (tenantKey, workspaceKey) => {
    const workspace = await resolveWorkspace(pool, tenantKey, workspaceKey);

    if (!workspace) {
      return [];
    }

    const result = await pool.query(
      `
        SELECT source_package_id, tenant_id, workspace_id, file_name, manifest_hash, format, status, uploaded_at, uploaded_by
        FROM source_packages
        WHERE tenant_id = $1 AND workspace_id = $2
        ORDER BY uploaded_at DESC
      `,
      [workspace.tenantId, workspace.workspaceId]
    );

    return result.rows.map(mapSourcePackage);
  },
  listImportJobsByWorkspace: async (tenantKey, workspaceKey) => {
    const workspace = await resolveWorkspace(pool, tenantKey, workspaceKey);

    if (!workspace) {
      return [];
    }

    const result = await pool.query(
      `
        SELECT import_job_id, tenant_id, workspace_id, source_package_id, status, created_at, completed_at, failure_message
        FROM import_jobs
        WHERE tenant_id = $1 AND workspace_id = $2
        ORDER BY created_at DESC
      `,
      [workspace.tenantId, workspace.workspaceId]
    );

    return result.rows.map(mapImportJob);
  },
  listContentReleasesByWorkspace: async (tenantKey, workspaceKey) => {
    const workspace = await resolveWorkspace(pool, tenantKey, workspaceKey);

    if (!workspace) {
      return [];
    }

    const result = await pool.query(
      `
        SELECT
          content_release_id, tenant_id, workspace_id, source_package_id, import_job_id,
          fixture_key, release_label, status, created_at, activated_at, canonical_payload
        FROM content_releases
        WHERE tenant_id = $1 AND workspace_id = $2
        ORDER BY created_at DESC
      `,
      [workspace.tenantId, workspace.workspaceId]
    );

    return result.rows.map(mapContentRelease);
  },
  claimNextQueuedImportJob: async () => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const queuedResult = await client.query(
        `
          SELECT import_job_id, tenant_id, workspace_id, source_package_id, status, created_at, completed_at, failure_message
          FROM import_jobs
          WHERE status = 'queued'
          ORDER BY created_at ASC
          LIMIT 1
          FOR UPDATE SKIP LOCKED
        `
      );

      if (!queuedResult.rows[0]) {
        await client.query("COMMIT");
        return undefined;
      }

      const importJobId = queuedResult.rows[0].import_job_id as string;

      const runningResult = await client.query(
        `
          UPDATE import_jobs
          SET status = 'running',
              failure_message = NULL
          WHERE import_job_id = $1
          RETURNING import_job_id, tenant_id, workspace_id, source_package_id, status, created_at, completed_at, failure_message
        `,
        [importJobId]
      );

      await client.query("COMMIT");
      return runningResult.rows[0] ? mapImportJob(runningResult.rows[0]) : undefined;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  },
  markImportJobCompleted: async importJobId => {
    await pool.query(
      `
        UPDATE import_jobs
        SET status = 'completed',
            completed_at = NOW(),
            failure_message = NULL
        WHERE import_job_id = $1
      `,
      [importJobId]
    );
  },
  markImportJobFailed: async (importJobId, failureMessage) => {
    await pool.query(
      `
        UPDATE import_jobs
        SET status = 'failed',
            completed_at = NOW(),
            failure_message = $2
        WHERE import_job_id = $1
      `,
      [importJobId, failureMessage]
    );
  },
  activateContentRelease: async contentReleaseId => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");

      const targetResult = await client.query(
        `
          SELECT
            content_release_id, tenant_id, workspace_id, source_package_id, import_job_id,
            fixture_key, release_label, status, created_at, activated_at, canonical_payload
          FROM content_releases
          WHERE content_release_id = $1
          FOR UPDATE
        `,
        [contentReleaseId]
      );

      if (!targetResult.rows[0]) {
        await client.query("COMMIT");
        return undefined;
      }

      const workspaceId = targetResult.rows[0].workspace_id as string;

      await client.query(
        `
          UPDATE content_releases
          SET status = 'draft',
              activated_at = NULL
          WHERE workspace_id = $1 AND status = 'active'
        `,
        [workspaceId]
      );

      const activatedResult = await client.query(
        `
          UPDATE content_releases
          SET status = 'active',
              activated_at = NOW()
          WHERE content_release_id = $1
          RETURNING
            content_release_id, tenant_id, workspace_id, source_package_id, import_job_id,
            fixture_key, release_label, status, created_at, activated_at, canonical_payload
        `,
        [contentReleaseId]
      );

      await client.query(
        `
          UPDATE workspaces
          SET active_content_release_id = $1
          WHERE workspace_id = $2
        `,
        [contentReleaseId, workspaceId]
      );

      await client.query("COMMIT");
      return activatedResult.rows[0] ? mapContentRelease(activatedResult.rows[0]) : undefined;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
});
