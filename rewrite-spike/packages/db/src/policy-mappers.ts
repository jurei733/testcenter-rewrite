import {
  defaultEvidenceRetentionClassPolicy,
  defaultGovernanceNotificationPolicy,
  defaultRecoveryGovernanceNotificationPolicy,
  defaultNotificationPolicy,
  defaultNotificationProviderPromotionPolicy,
  defaultNotificationProviderProfiles
} from "@testcenter-rewrite/domain";
import type {
  ActivationPolicyOverrideRecords,
  EvidenceRetentionClassPolicy,
  EvidenceRetentionClassPolicyEntry,
  EvidenceRetentionClassPolicyOverrideRecords,
  EvidenceRetentionHoldReasonCode,
  EvidenceRetentionHoldReasonDefinition,
  EvidenceRetentionHoldReasonSeverity,
  EvidenceRetentionPolicyOverrideRecords,
  LaunchApprovalPolicyOverrideRecords,
  NotificationProviderPromotionPolicy,
  NotificationProviderPromotionPolicyOverrideRecords,
  NotificationPolicyOverrideRecords,
  OperationalPolicyOverrideRecords,
  PolicyOverrideRecord,
  Tenant,
  Workspace
} from "@testcenter-rewrite/domain";

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

export const mapActivationPolicyOverrideRecords = (value: unknown): ActivationPolicyOverrideRecords | null => {
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

export const mapOperationalPolicyOverrideRecords = (value: unknown): OperationalPolicyOverrideRecords | null => {
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

export const mapLaunchApprovalPolicyOverrideRecords = (
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

export const mapNotificationPolicyOverrideRecords = (
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

export const mapNotificationProviderPromotionPolicy = (
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

export const mapNotificationProviderPromotionPolicyOverrideRecords = (
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

export const mapNotificationProviderProfileOverrideRecords = (
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

export const mapNotificationProviderProfiles = (
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

export const mapEvidenceRetentionPolicyOverrideRecords = (
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

export const mapEvidenceRetentionClassPolicy = (value: unknown): EvidenceRetentionClassPolicy | null => {
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

export const mapEvidenceRetentionClassPolicyOverrideRecords = (
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
