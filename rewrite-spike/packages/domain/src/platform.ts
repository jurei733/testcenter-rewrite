import {
  defaultContentReleaseActivationPolicy,
  type ContentReleaseActivationPolicy
} from "./content.js";
import type { AuditActorType } from "./audit.js";
import {
  defaultOutboundNotificationPolicy,
  resolveOutboundNotificationDeliveryChannel,
  resolveOutboundNotificationDestination,
  resolveOutboundNotificationMaxAttempts,
  type OutboundNotificationDeliveryChannel,
  type OutboundNotificationProviderProfile,
  type OutboundNotificationProviderProfileIncidentReasonCode,
  type OutboundNotificationProviderProfileIncidentResolutionCode,
  type OutboundNotificationProviderProfileIncidentState,
  type OutboundNotificationProviderProfileIncidentType,
  type OutboundNotificationDeliverySelectionMode,
  type OutboundNotificationPolicy
} from "@testcenter-rewrite/outbound-messaging";

export type TenantStatus = "active" | "suspended";
export type WorkspaceStatus = "active" | "archived";

export interface OperationalPolicy {
  monitorCommandTtlSeconds: number;
  monitorCommandLeaseSeconds: number;
  timedRunMaintenanceGraceSeconds: number;
}

export interface LaunchApprovalPolicy {
  systemCheckLaunchApprovalTtlSeconds: number;
}

export interface NotificationProviderPromotionPolicy {
  evaluationWindowHours: number;
  minimumRequestedCount: number;
  minimumDirectSelectionCount: number;
  minimumDeliveredCount: number;
  maximumDeliveryFailedCount: number;
  autoPromoteEnabled: boolean;
  autoRollbackOnFailureEnabled: boolean;
  autoPromotionSuppressionSeconds: number;
}

export type NotificationDeliverySelectionMode = OutboundNotificationDeliverySelectionMode;
export type NotificationPolicy = OutboundNotificationPolicy;
export type GovernanceNotificationPolicy = OutboundNotificationPolicy;
export type RecoveryGovernanceNotificationPolicy = OutboundNotificationPolicy;
export type NotificationProviderProfile = OutboundNotificationProviderProfile;
export type NotificationProviderProfileIncidentType =
  OutboundNotificationProviderProfileIncidentType;
export type NotificationProviderProfileIncidentReasonCode =
  OutboundNotificationProviderProfileIncidentReasonCode;
export type NotificationProviderProfileIncidentResolutionCode =
  OutboundNotificationProviderProfileIncidentResolutionCode;
export type NotificationProviderProfileIncidentState =
  OutboundNotificationProviderProfileIncidentState;
export type NotificationProviderProfileOverride = NotificationProviderProfile[];
export type NotificationProviderProfileOverrideRecords = Record<
  string,
  PolicyOverrideRecord<NotificationProviderProfile | null>
>;
export type NotificationProviderProfileIncidentStatus =
  | "open"
  | "acknowledged"
  | "resolved";

export interface NotificationProviderProfileIncident {
  incidentId: string;
  tenantId: string;
  workspaceId: string;
  profileKey: string;
  incidentType: NotificationProviderProfileIncidentType;
  status: NotificationProviderProfileIncidentStatus;
  openedAt: string;
  openedByActorType: "worker" | "notification_service" | "platform_api";
  openedByActorId: string;
  reasonCode: NotificationProviderProfileIncidentReasonCode;
  deliveryFailedCount: number;
  suppressionUntil: string | null;
  sourceRequestId: string | null;
  acknowledgedAt: string | null;
  acknowledgedByActorId: string | null;
  acknowledgementNote: string | null;
  resolvedAt: string | null;
  resolutionCode: NotificationProviderProfileIncidentResolutionCode | null;
}

export type NotificationProviderProfileGovernanceAlertStatus =
  | "pending_acknowledgement"
  | "acknowledged";

export type NotificationProviderProfileGovernanceAlertDeliveryStatus =
  | "pending_delivery"
  | "delivered"
  | "delivery_failed";

export interface NotificationProviderProfileGovernanceAlert {
  alertId: string;
  incidentId: string;
  tenantId: string;
  workspaceId: string;
  profileKey: string;
  alertClass: "incident_open" | "incident_resolved";
  status: NotificationProviderProfileGovernanceAlertStatus;
  governanceStatus:
    | "needs_acknowledgement"
    | "suppressed"
    | "ready_for_manual_recovery"
    | "recovery_blocked"
    | "resolved_recovery";
  createdAt: string;
  createdByActorType: "worker" | "notification_service" | "platform_api";
  createdByActorId: string;
  sourceRequestId: string | null;
  deliveryProfileKey: string | null;
  deliveryChannel: OutboundNotificationDeliveryChannel;
  deliveryStatus: NotificationProviderProfileGovernanceAlertDeliveryStatus;
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

export interface EvidenceRetentionPolicy {
  systemCheckEvidenceRetentionTtlSeconds: number;
  systemCheckEvidenceInvestigationRetentionTtlSeconds: number;
}

export type EvidenceRetentionTtlFieldKey =
  | "systemCheckEvidenceRetentionTtlSeconds"
  | "systemCheckEvidenceInvestigationRetentionTtlSeconds";

export type EvidenceRetentionHoldReasonCode = string;
export type EvidenceRetentionHoldReasonSeverity = "low" | "medium" | "high";

export interface EvidenceRetentionHoldReasonDefinition {
  holdReasonCode: EvidenceRetentionHoldReasonCode;
  displayLabel: string;
  workflowHint: string | null;
  severity: EvidenceRetentionHoldReasonSeverity;
  escalationTarget: string | null;
  uiGroup: string | null;
  acknowledgementRequired: boolean;
  defaultAssigneeTarget: string | null;
  slaSeconds: number | null;
}

export interface EvidenceRetentionClassTransitionPolicy {
  holdReasonCode: EvidenceRetentionHoldReasonCode;
  targetRetentionClass: string;
}

export interface EvidenceRetentionClassPolicyEntry {
  retentionClass: string;
  retentionPolicyKey: string;
  ttlFieldKey: EvidenceRetentionTtlFieldKey;
  manualHoldAllowed: boolean;
  payloadAccessGrantsAllowed: boolean;
  holdTransitions: EvidenceRetentionClassTransitionPolicy[];
}

export interface EvidenceRetentionClassPolicy {
  holdReasons: EvidenceRetentionHoldReasonDefinition[];
  defaultCaptureRetentionClass: string;
  classes: EvidenceRetentionClassPolicyEntry[];
}

export interface EvidenceRetentionClassPolicyOverride {
  defaultCaptureRetentionClass?: string;
  classEntries?: EvidenceRetentionClassPolicyEntry[];
}

export interface EvidenceRetentionClassPolicyOverrideRecords {
  defaultCaptureRetentionClass?: PolicyOverrideRecord<string>;
  classEntries?: Record<string, PolicyOverrideRecord<EvidenceRetentionClassPolicyEntry>>;
}

export interface PolicyOverrideRecord<Value> {
  value: Value;
  updatedAt: string;
  updatedByRequestId: string;
  updatedByActorType: AuditActorType;
  updatedByActorId: string;
}

export const defaultOperationalPolicy: OperationalPolicy = {
  monitorCommandTtlSeconds: 30,
  monitorCommandLeaseSeconds: 15,
  timedRunMaintenanceGraceSeconds: 0
};

export const defaultLaunchApprovalPolicy: LaunchApprovalPolicy = {
  systemCheckLaunchApprovalTtlSeconds: 0
};

export const defaultNotificationProviderPromotionPolicy: NotificationProviderPromotionPolicy = {
  evaluationWindowHours: 24,
  minimumRequestedCount: 1,
  minimumDirectSelectionCount: 1,
  minimumDeliveredCount: 1,
  maximumDeliveryFailedCount: 0,
  autoPromoteEnabled: false,
  autoRollbackOnFailureEnabled: false,
  autoPromotionSuppressionSeconds: 0
};

export const defaultNotificationPolicy: NotificationPolicy = defaultOutboundNotificationPolicy;
export const defaultGovernanceNotificationPolicy: GovernanceNotificationPolicy =
  defaultOutboundNotificationPolicy;
export const defaultRecoveryGovernanceNotificationPolicy: RecoveryGovernanceNotificationPolicy =
  defaultOutboundNotificationPolicy;
export const defaultNotificationProviderProfiles: NotificationProviderProfile[] = [];

export const defaultEvidenceRetentionPolicy: EvidenceRetentionPolicy = {
  systemCheckEvidenceRetentionTtlSeconds: 604800,
  systemCheckEvidenceInvestigationRetentionTtlSeconds: 2592000
};

export const defaultEvidenceRetentionClassPolicy: EvidenceRetentionClassPolicy = {
  holdReasons: [
    {
      holdReasonCode: "workspace_review",
      displayLabel: "Workspace Review",
      workflowHint: "Keep evidence available while a workspace reviewer inspects the submission.",
      severity: "low",
      escalationTarget: null,
      uiGroup: "review",
      acknowledgementRequired: false,
      defaultAssigneeTarget: "workspace-reviewers",
      slaSeconds: 86400
    },
    {
      holdReasonCode: "operator_investigation",
      displayLabel: "Operator Investigation",
      workflowHint: "Escalate evidence into the longer investigation workflow for operator follow-up.",
      severity: "high",
      escalationTarget: "ops-investigation",
      uiGroup: "investigation",
      acknowledgementRequired: true,
      defaultAssigneeTarget: "ops-investigation-primary",
      slaSeconds: 14400
    }
  ],
  defaultCaptureRetentionClass: "workspace_review",
  classes: [
    {
      retentionClass: "workspace_review",
      retentionPolicyKey: "spike_workspace_review",
      ttlFieldKey: "systemCheckEvidenceRetentionTtlSeconds",
      manualHoldAllowed: true,
      payloadAccessGrantsAllowed: true,
      holdTransitions: [
        {
          holdReasonCode: "workspace_review",
          targetRetentionClass: "workspace_review"
        },
        {
          holdReasonCode: "operator_investigation",
          targetRetentionClass: "operator_investigation"
        }
      ]
    },
    {
      retentionClass: "operator_investigation",
      retentionPolicyKey: "spike_operator_investigation",
      ttlFieldKey: "systemCheckEvidenceInvestigationRetentionTtlSeconds",
      manualHoldAllowed: true,
      payloadAccessGrantsAllowed: true,
      holdTransitions: [
        {
          holdReasonCode: "operator_investigation",
          targetRetentionClass: "operator_investigation"
        }
      ]
    }
  ]
};

export interface Tenant {
  tenantId: string;
  tenantKey: string;
  displayName: string;
  status: TenantStatus;
  defaultActivationPolicy: ContentReleaseActivationPolicy;
  defaultOperationalPolicy: OperationalPolicy;
  defaultLaunchApprovalPolicy: LaunchApprovalPolicy;
  defaultNotificationProviderPromotionPolicy: NotificationProviderPromotionPolicy;
  defaultNotificationPolicy: NotificationPolicy;
  defaultGovernanceNotificationPolicy: GovernanceNotificationPolicy;
  defaultRecoveryGovernanceNotificationPolicy: RecoveryGovernanceNotificationPolicy;
  defaultNotificationProviderProfiles: NotificationProviderProfile[];
  defaultEvidenceRetentionPolicy: EvidenceRetentionPolicy;
  defaultEvidenceRetentionClassPolicy: EvidenceRetentionClassPolicy;
}

export type ContentReleaseActivationPolicyOverride = Partial<ContentReleaseActivationPolicy>;
export type OperationalPolicyOverride = Partial<OperationalPolicy>;
export type LaunchApprovalPolicyOverride = Partial<LaunchApprovalPolicy>;
export type NotificationProviderPromotionPolicyOverride = Partial<NotificationProviderPromotionPolicy>;
export type NotificationPolicyOverride = Partial<NotificationPolicy>;
export type GovernanceNotificationPolicyOverride = Partial<GovernanceNotificationPolicy>;
export type RecoveryGovernanceNotificationPolicyOverride = Partial<RecoveryGovernanceNotificationPolicy>;
export type EvidenceRetentionPolicyOverride = Partial<EvidenceRetentionPolicy>;

export interface ActivationPolicyOverrideRecords {
  blockIncompatibleRoutingChangesWithActiveSessions?: PolicyOverrideRecord<boolean>;
  warnOnActiveSessions?: PolicyOverrideRecord<boolean>;
  warnOnHighRiskReleaseChange?: PolicyOverrideRecord<boolean>;
}

export interface OperationalPolicyOverrideRecords {
  monitorCommandTtlSeconds?: PolicyOverrideRecord<number>;
  monitorCommandLeaseSeconds?: PolicyOverrideRecord<number>;
  timedRunMaintenanceGraceSeconds?: PolicyOverrideRecord<number>;
}

export interface LaunchApprovalPolicyOverrideRecords {
  systemCheckLaunchApprovalTtlSeconds?: PolicyOverrideRecord<number>;
}

export interface NotificationProviderPromotionPolicyOverrideRecords {
  evaluationWindowHours?: PolicyOverrideRecord<number>;
  minimumRequestedCount?: PolicyOverrideRecord<number>;
  minimumDirectSelectionCount?: PolicyOverrideRecord<number>;
  minimumDeliveredCount?: PolicyOverrideRecord<number>;
  maximumDeliveryFailedCount?: PolicyOverrideRecord<number>;
  autoPromoteEnabled?: PolicyOverrideRecord<boolean>;
  autoRollbackOnFailureEnabled?: PolicyOverrideRecord<boolean>;
  autoPromotionSuppressionSeconds?: PolicyOverrideRecord<number>;
}

export interface NotificationPolicyOverrideRecords {
  breachNotificationDeliverySelectionMode?: PolicyOverrideRecord<NotificationDeliverySelectionMode>;
  webhookSpikeRetryDelaySeconds?: PolicyOverrideRecord<number>;
  webhookSpikeMaxDeliveryAttempts?: PolicyOverrideRecord<number>;
  emailSpikeRetryDelaySeconds?: PolicyOverrideRecord<number>;
  emailSpikeMaxDeliveryAttempts?: PolicyOverrideRecord<number>;
}

export type GovernanceNotificationPolicyOverrideRecords = NotificationPolicyOverrideRecords;
export type RecoveryGovernanceNotificationPolicyOverrideRecords = NotificationPolicyOverrideRecords;

export interface EvidenceRetentionPolicyOverrideRecords {
  systemCheckEvidenceRetentionTtlSeconds?: PolicyOverrideRecord<number>;
  systemCheckEvidenceInvestigationRetentionTtlSeconds?: PolicyOverrideRecord<number>;
}

export interface Workspace {
  workspaceId: string;
  tenantId: string;
  workspaceKey: string;
  displayName: string;
  status: WorkspaceStatus;
  activationPolicyOverrideRecords: ActivationPolicyOverrideRecords | null;
  operationalPolicyOverrideRecords: OperationalPolicyOverrideRecords | null;
  launchApprovalPolicyOverrideRecords: LaunchApprovalPolicyOverrideRecords | null;
  notificationProviderPromotionPolicyOverrideRecords: NotificationProviderPromotionPolicyOverrideRecords | null;
  notificationPolicyOverrideRecords: NotificationPolicyOverrideRecords | null;
  governanceNotificationPolicyOverrideRecords: GovernanceNotificationPolicyOverrideRecords | null;
  recoveryGovernanceNotificationPolicyOverrideRecords: RecoveryGovernanceNotificationPolicyOverrideRecords | null;
  notificationProviderProfileOverrideRecords: NotificationProviderProfileOverrideRecords | null;
  evidenceRetentionPolicyOverrideRecords: EvidenceRetentionPolicyOverrideRecords | null;
  evidenceRetentionClassPolicyOverrideRecords: EvidenceRetentionClassPolicyOverrideRecords | null;
}

const createStableId = (prefix: string, businessKey: string): string => `${prefix}-${businessKey}`;

export const createTenant = (input: {
  tenantKey: string;
  displayName: string;
}): Tenant => ({
  tenantId: createStableId("tenant", input.tenantKey),
  tenantKey: input.tenantKey,
  displayName: input.displayName,
  status: "active",
  defaultActivationPolicy: defaultContentReleaseActivationPolicy,
  defaultOperationalPolicy,
  defaultLaunchApprovalPolicy,
  defaultNotificationProviderPromotionPolicy,
  defaultNotificationPolicy,
  defaultGovernanceNotificationPolicy,
  defaultRecoveryGovernanceNotificationPolicy,
  defaultNotificationProviderProfiles,
  defaultEvidenceRetentionPolicy,
  defaultEvidenceRetentionClassPolicy
});

export const createWorkspace = (input: {
  tenantId: string;
  workspaceKey: string;
  displayName: string;
  activationPolicyOverrideRecords?: ActivationPolicyOverrideRecords | null;
  operationalPolicyOverrideRecords?: OperationalPolicyOverrideRecords | null;
  launchApprovalPolicyOverrideRecords?: LaunchApprovalPolicyOverrideRecords | null;
  notificationProviderPromotionPolicyOverrideRecords?: NotificationProviderPromotionPolicyOverrideRecords | null;
  notificationPolicyOverrideRecords?: NotificationPolicyOverrideRecords | null;
  governanceNotificationPolicyOverrideRecords?: GovernanceNotificationPolicyOverrideRecords | null;
  recoveryGovernanceNotificationPolicyOverrideRecords?: RecoveryGovernanceNotificationPolicyOverrideRecords | null;
  notificationProviderProfileOverrideRecords?: NotificationProviderProfileOverrideRecords | null;
  evidenceRetentionPolicyOverrideRecords?: EvidenceRetentionPolicyOverrideRecords | null;
  evidenceRetentionClassPolicyOverrideRecords?: EvidenceRetentionClassPolicyOverrideRecords | null;
}): Workspace => ({
  workspaceId: createStableId("workspace", `${input.tenantId}-${input.workspaceKey}`),
  tenantId: input.tenantId,
  workspaceKey: input.workspaceKey,
  displayName: input.displayName,
  status: "active",
  activationPolicyOverrideRecords: input.activationPolicyOverrideRecords ?? null,
  operationalPolicyOverrideRecords: input.operationalPolicyOverrideRecords ?? null,
  launchApprovalPolicyOverrideRecords: input.launchApprovalPolicyOverrideRecords ?? null,
  notificationProviderPromotionPolicyOverrideRecords:
    input.notificationProviderPromotionPolicyOverrideRecords ?? null,
  notificationPolicyOverrideRecords: input.notificationPolicyOverrideRecords ?? null,
  governanceNotificationPolicyOverrideRecords:
    input.governanceNotificationPolicyOverrideRecords ?? null,
  recoveryGovernanceNotificationPolicyOverrideRecords:
    input.recoveryGovernanceNotificationPolicyOverrideRecords ?? null,
  notificationProviderProfileOverrideRecords: input.notificationProviderProfileOverrideRecords ?? null,
  evidenceRetentionPolicyOverrideRecords: input.evidenceRetentionPolicyOverrideRecords ?? null,
  evidenceRetentionClassPolicyOverrideRecords: input.evidenceRetentionClassPolicyOverrideRecords ?? null
});

export const createNotificationProviderProfileIncident = (input: {
  tenantId: string;
  workspaceId: string;
  profileKey: string;
  incidentType: NotificationProviderProfileIncidentType;
  openedAt: string;
  openedByActorType: "worker" | "notification_service" | "platform_api";
  openedByActorId: string;
  reasonCode: NotificationProviderProfileIncidentReasonCode;
  deliveryFailedCount: number;
  suppressionUntil: string | null;
  sourceRequestId?: string | null;
}): NotificationProviderProfileIncident => ({
  incidentId: createStableId(
    "notification-provider-profile-incident",
    `${input.workspaceId}-${input.profileKey}-${input.openedAt}-${input.incidentType}`
  ),
  tenantId: input.tenantId,
  workspaceId: input.workspaceId,
  profileKey: input.profileKey,
  incidentType: input.incidentType,
  status: "open",
  openedAt: input.openedAt,
  openedByActorType: input.openedByActorType,
  openedByActorId: input.openedByActorId,
  reasonCode: input.reasonCode,
  deliveryFailedCount: input.deliveryFailedCount,
  suppressionUntil: input.suppressionUntil,
  sourceRequestId: input.sourceRequestId ?? null,
  acknowledgedAt: null,
  acknowledgedByActorId: null,
  acknowledgementNote: null,
  resolvedAt: null,
  resolutionCode: null
});

export const createNotificationProviderProfileGovernanceAlert = (input: {
  incident: NotificationProviderProfileIncident;
  profile: NotificationProviderProfile;
  notificationPolicy?: NotificationPolicy;
  notificationProviderProfiles?: NotificationProviderProfile[];
  routingTarget?: string | null;
  createdAt?: string;
  createdByActorType: "worker" | "notification_service" | "platform_api";
  createdByActorId: string;
  sourceRequestId?: string | null;
  alertClass?: "incident_open" | "incident_resolved";
  governanceStatus?:
    | "needs_acknowledgement"
    | "suppressed"
    | "ready_for_manual_recovery"
    | "recovery_blocked"
    | "resolved_recovery";
}): NotificationProviderProfileGovernanceAlert => {
  const createdAt = input.createdAt ?? new Date().toISOString();
  const alertClass = input.alertClass ?? "incident_open";
  const governanceStatus =
    input.governanceStatus ??
    (alertClass === "incident_resolved"
      ? "resolved_recovery"
      : input.incident.status === "open"
        ? "needs_acknowledgement"
        : input.incident.suppressionUntil && input.incident.suppressionUntil > createdAt
          ? "suppressed"
          : "recovery_blocked");
  const routingTarget =
    input.routingTarget ??
    (input.profile.rolloutFallbackProfileKey
      ? `profile:${input.profile.rolloutFallbackProfileKey}`
      : null);
  const resolvedDestination = resolveOutboundNotificationDestination({
    target: routingTarget,
    selectionMode: input.notificationPolicy?.breachNotificationDeliverySelectionMode,
    providerProfiles: input.notificationProviderProfiles ?? [],
    rolloutSubjectKey: input.incident.incidentId
  });

  return {
    alertId: createStableId(
      "notification-provider-profile-governance-alert",
      `${input.incident.incidentId}-${alertClass}`
    ),
    incidentId: input.incident.incidentId,
    tenantId: input.incident.tenantId,
    workspaceId: input.incident.workspaceId,
    profileKey: input.incident.profileKey,
    alertClass,
    status: "pending_acknowledgement",
    governanceStatus,
    createdAt,
    createdByActorType: input.createdByActorType,
    createdByActorId: input.createdByActorId,
    sourceRequestId: input.sourceRequestId ?? null,
    deliveryProfileKey: resolvedDestination.deliveryProfileKey,
    deliveryChannel: resolvedDestination.deliveryChannel,
    deliveryStatus: "pending_delivery",
    deliveryTarget: resolvedDestination.deliveryTarget,
    deliveryAttemptCount: 0,
    maxDeliveryAttempts: resolveOutboundNotificationMaxAttempts({
      notificationPolicy: input.notificationPolicy,
      deliveryChannel: resolvedDestination.deliveryChannel
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

export const createNotificationProviderProfileGovernanceRecoveryAlert = (input: {
  incident: NotificationProviderProfileIncident;
  profile: NotificationProviderProfile;
  notificationPolicy?: NotificationPolicy;
  notificationProviderProfiles?: NotificationProviderProfile[];
  routingTarget?: string | null;
  createdAt?: string;
  createdByActorType: "worker" | "notification_service" | "platform_api";
  createdByActorId: string;
  sourceRequestId?: string | null;
}): NotificationProviderProfileGovernanceAlert =>
  createNotificationProviderProfileGovernanceAlert({
    ...input,
    alertClass: "incident_resolved",
    governanceStatus: "resolved_recovery"
  });

export const markNotificationProviderProfileGovernanceAlertDelivered = (input: {
  alert: NotificationProviderProfileGovernanceAlert;
  deliveredAt?: string;
  receiptId?: string | null;
  receiptIssuedAt?: string | null;
}): NotificationProviderProfileGovernanceAlert => {
  const deliveredAt = input.deliveredAt ?? new Date().toISOString();

  return {
    ...input.alert,
    deliveryStatus: "delivered",
    deliveryAttemptCount: input.alert.deliveryAttemptCount + 1,
    nextDeliveryAttemptAt: null,
    lastDeliveryAttemptAt: deliveredAt,
    lastDeliveryReceiptId: input.receiptId ?? null,
    lastDeliveryReceiptIssuedAt: input.receiptIssuedAt ?? deliveredAt,
    deliveredAt,
    lastDeliveryError: null
  };
};

export const scheduleNotificationProviderProfileGovernanceAlertDeliveryRetry = (input: {
  alert: NotificationProviderProfileGovernanceAlert;
  failureReason: string;
  attemptedAt?: string;
  retryAt?: string;
  receiptId?: string | null;
  receiptIssuedAt?: string | null;
}): NotificationProviderProfileGovernanceAlert => {
  const attemptedAt = input.attemptedAt ?? new Date().toISOString();

  return {
    ...input.alert,
    deliveryStatus: "pending_delivery",
    deliveryAttemptCount: input.alert.deliveryAttemptCount + 1,
    nextDeliveryAttemptAt: input.retryAt ?? attemptedAt,
    lastDeliveryAttemptAt: attemptedAt,
    lastDeliveryReceiptId: input.receiptId ?? null,
    lastDeliveryReceiptIssuedAt: input.receiptIssuedAt ?? attemptedAt,
    lastDeliveryError: input.failureReason
  };
};

export const markNotificationProviderProfileGovernanceAlertDeliveryFailed = (input: {
  alert: NotificationProviderProfileGovernanceAlert;
  failureReason: string;
  attemptedAt?: string;
  receiptId?: string | null;
  receiptIssuedAt?: string | null;
}): NotificationProviderProfileGovernanceAlert => {
  const attemptedAt = input.attemptedAt ?? new Date().toISOString();

  return {
    ...input.alert,
    deliveryStatus: "delivery_failed",
    deliveryAttemptCount: input.alert.deliveryAttemptCount + 1,
    nextDeliveryAttemptAt: null,
    lastDeliveryAttemptAt: attemptedAt,
    lastDeliveryReceiptId: input.receiptId ?? null,
    lastDeliveryReceiptIssuedAt: input.receiptIssuedAt ?? attemptedAt,
    lastDeliveryError: input.failureReason
  };
};

export const acknowledgeNotificationProviderProfileGovernanceAlert = (input: {
  alert: NotificationProviderProfileGovernanceAlert;
  acknowledgedByActorId: string;
  acknowledgementNote: string;
  acknowledgedAt?: string;
}): NotificationProviderProfileGovernanceAlert => {
  const acknowledgedAt = input.acknowledgedAt ?? new Date().toISOString();

  return {
    ...input.alert,
    status: "acknowledged",
    acknowledgedAt,
    acknowledgedByActorId: input.acknowledgedByActorId,
    acknowledgementNote: input.acknowledgementNote
  };
};

export const redriveNotificationProviderProfileGovernanceAlert = (input: {
  alert: NotificationProviderProfileGovernanceAlert;
  notificationPolicy?: NotificationPolicy;
  deliveryTarget?: string | null;
  redrivenAt?: string;
  sourceRequestId?: string | null;
}): NotificationProviderProfileGovernanceAlert => {
  const redrivenAt = input.redrivenAt ?? new Date().toISOString();
  const explicitDeliveryTarget = input.deliveryTarget?.trim()
    ? input.deliveryTarget.trim()
    : null;
  const resolvedDeliveryTarget = explicitDeliveryTarget ?? input.alert.deliveryTarget;
  const resolvedDeliveryChannel = resolveOutboundNotificationDeliveryChannel({
    target: resolvedDeliveryTarget,
    selectionMode: input.notificationPolicy?.breachNotificationDeliverySelectionMode
  });

  return {
    ...input.alert,
    sourceRequestId: input.sourceRequestId ?? input.alert.sourceRequestId,
    deliveryProfileKey: explicitDeliveryTarget ? null : input.alert.deliveryProfileKey,
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

const sortNotificationProviderProfiles = (
  notificationProviderProfiles: NotificationProviderProfile[]
): NotificationProviderProfile[] =>
  [...notificationProviderProfiles].sort((left, right) =>
    left.profileKey.localeCompare(right.profileKey)
  );

export const resolveWorkspaceActivationPolicy = (
  workspace: Workspace,
  tenant: Tenant
): ContentReleaseActivationPolicy =>
  ({
    ...tenant.defaultActivationPolicy,
    ...(flattenActivationPolicyOverrideRecords(workspace.activationPolicyOverrideRecords) ?? {})
  });

export const flattenActivationPolicyOverrideRecords = (
  records: ActivationPolicyOverrideRecords | null
): ContentReleaseActivationPolicyOverride | null => {
  if (!records) {
    return null;
  }

  const flattened: ContentReleaseActivationPolicyOverride = {};

  if (records.blockIncompatibleRoutingChangesWithActiveSessions) {
    flattened.blockIncompatibleRoutingChangesWithActiveSessions =
      records.blockIncompatibleRoutingChangesWithActiveSessions.value;
  }

  if (records.warnOnActiveSessions) {
    flattened.warnOnActiveSessions = records.warnOnActiveSessions.value;
  }

  if (records.warnOnHighRiskReleaseChange) {
    flattened.warnOnHighRiskReleaseChange = records.warnOnHighRiskReleaseChange.value;
  }

  return Object.keys(flattened).length > 0 ? flattened : null;
};

export const createActivationPolicyOverrideRecords = (input: {
  override: ContentReleaseActivationPolicyOverride;
  updatedByRequestId: string;
  updatedByActorType: AuditActorType;
  updatedByActorId: string;
  updatedAt?: string;
}): ActivationPolicyOverrideRecords | null => {
  const updatedAt = input.updatedAt ?? new Date().toISOString();
  const records: ActivationPolicyOverrideRecords = {};

  if (typeof input.override.blockIncompatibleRoutingChangesWithActiveSessions === "boolean") {
    records.blockIncompatibleRoutingChangesWithActiveSessions = {
      value: input.override.blockIncompatibleRoutingChangesWithActiveSessions,
      updatedAt,
      updatedByRequestId: input.updatedByRequestId,
      updatedByActorType: input.updatedByActorType,
      updatedByActorId: input.updatedByActorId
    };
  }

  if (typeof input.override.warnOnActiveSessions === "boolean") {
    records.warnOnActiveSessions = {
      value: input.override.warnOnActiveSessions,
      updatedAt,
      updatedByRequestId: input.updatedByRequestId,
      updatedByActorType: input.updatedByActorType,
      updatedByActorId: input.updatedByActorId
    };
  }

  if (typeof input.override.warnOnHighRiskReleaseChange === "boolean") {
    records.warnOnHighRiskReleaseChange = {
      value: input.override.warnOnHighRiskReleaseChange,
      updatedAt,
      updatedByRequestId: input.updatedByRequestId,
      updatedByActorType: input.updatedByActorType,
      updatedByActorId: input.updatedByActorId
    };
  }

  return Object.keys(records).length > 0 ? records : null;
};

export const resolveWorkspaceOperationalPolicy = (
  workspace: Workspace,
  tenant: Tenant
): OperationalPolicy =>
  ({
    ...tenant.defaultOperationalPolicy,
    ...(flattenOperationalPolicyOverrideRecords(workspace.operationalPolicyOverrideRecords) ?? {})
  });

export const flattenOperationalPolicyOverrideRecords = (
  records: OperationalPolicyOverrideRecords | null
): OperationalPolicyOverride | null => {
  if (!records) {
    return null;
  }

  const flattened: OperationalPolicyOverride = {};

  if (records.monitorCommandTtlSeconds) {
    flattened.monitorCommandTtlSeconds = records.monitorCommandTtlSeconds.value;
  }

  if (records.monitorCommandLeaseSeconds) {
    flattened.monitorCommandLeaseSeconds = records.monitorCommandLeaseSeconds.value;
  }

  if (records.timedRunMaintenanceGraceSeconds) {
    flattened.timedRunMaintenanceGraceSeconds = records.timedRunMaintenanceGraceSeconds.value;
  }

  return Object.keys(flattened).length > 0 ? flattened : null;
};

export const createOperationalPolicyOverrideRecords = (input: {
  override: OperationalPolicyOverride;
  updatedByRequestId: string;
  updatedByActorType: AuditActorType;
  updatedByActorId: string;
  updatedAt?: string;
}): OperationalPolicyOverrideRecords | null => {
  const updatedAt = input.updatedAt ?? new Date().toISOString();
  const records: OperationalPolicyOverrideRecords = {};

  if (typeof input.override.monitorCommandTtlSeconds === "number") {
    records.monitorCommandTtlSeconds = {
      value: input.override.monitorCommandTtlSeconds,
      updatedAt,
      updatedByRequestId: input.updatedByRequestId,
      updatedByActorType: input.updatedByActorType,
      updatedByActorId: input.updatedByActorId
    };
  }

  if (typeof input.override.monitorCommandLeaseSeconds === "number") {
    records.monitorCommandLeaseSeconds = {
      value: input.override.monitorCommandLeaseSeconds,
      updatedAt,
      updatedByRequestId: input.updatedByRequestId,
      updatedByActorType: input.updatedByActorType,
      updatedByActorId: input.updatedByActorId
    };
  }

  if (typeof input.override.timedRunMaintenanceGraceSeconds === "number") {
    records.timedRunMaintenanceGraceSeconds = {
      value: input.override.timedRunMaintenanceGraceSeconds,
      updatedAt,
      updatedByRequestId: input.updatedByRequestId,
      updatedByActorType: input.updatedByActorType,
      updatedByActorId: input.updatedByActorId
    };
  }

  return Object.keys(records).length > 0 ? records : null;
};

export const resolveWorkspaceLaunchApprovalPolicy = (
  workspace: Workspace,
  tenant: Tenant
): LaunchApprovalPolicy =>
  ({
    ...tenant.defaultLaunchApprovalPolicy,
    ...(flattenLaunchApprovalPolicyOverrideRecords(workspace.launchApprovalPolicyOverrideRecords) ?? {})
  });

export const resolveWorkspaceNotificationProviderPromotionPolicy = (
  workspace: Workspace,
  tenant: Tenant
): NotificationProviderPromotionPolicy =>
  ({
    ...tenant.defaultNotificationProviderPromotionPolicy,
    ...(flattenNotificationProviderPromotionPolicyOverrideRecords(
      workspace.notificationProviderPromotionPolicyOverrideRecords
    ) ?? {})
  });

export const resolveWorkspaceNotificationPolicy = (
  workspace: Workspace,
  tenant: Tenant
): NotificationPolicy =>
  ({
    ...tenant.defaultNotificationPolicy,
    ...(flattenNotificationPolicyOverrideRecords(workspace.notificationPolicyOverrideRecords) ?? {})
  });

export const resolveWorkspaceGovernanceNotificationPolicy = (
  workspace: Workspace,
  tenant: Tenant
): GovernanceNotificationPolicy =>
  ({
    ...tenant.defaultGovernanceNotificationPolicy,
    ...(flattenNotificationPolicyOverrideRecords(workspace.governanceNotificationPolicyOverrideRecords) ?? {})
  });

export const resolveWorkspaceRecoveryGovernanceNotificationPolicy = (
  workspace: Workspace,
  tenant: Tenant
): RecoveryGovernanceNotificationPolicy =>
  ({
    ...tenant.defaultRecoveryGovernanceNotificationPolicy,
    ...(flattenNotificationPolicyOverrideRecords(
      workspace.recoveryGovernanceNotificationPolicyOverrideRecords
    ) ?? {})
  });

export const resolveWorkspaceNotificationProviderProfiles = (
  workspace: Workspace,
  tenant: Tenant
): NotificationProviderProfile[] => {
  const mergedProfiles = new Map(
    tenant.defaultNotificationProviderProfiles.map(profile => [profile.profileKey, profile])
  );
  if (!workspace.notificationProviderProfileOverrideRecords) {
    return sortNotificationProviderProfiles(tenant.defaultNotificationProviderProfiles);
  }

  for (const [profileKey, record] of Object.entries(
    workspace.notificationProviderProfileOverrideRecords
  )) {
    if (record.value === null) {
      mergedProfiles.delete(profileKey);
      continue;
    }

    mergedProfiles.set(profileKey, record.value);
  }

  return sortNotificationProviderProfiles(Array.from(mergedProfiles.values()));
};

export const flattenNotificationProviderProfileOverrideRecords = (
  records: NotificationProviderProfileOverrideRecords | null
): NotificationProviderProfileOverride | null => {
  if (!records) {
    return null;
  }

  const flattenedProfiles = Object.values(records)
    .map(record => record.value)
    .filter(
      (recordValue): recordValue is NotificationProviderProfile => recordValue !== null
    );

  return flattenedProfiles.length > 0
    ? sortNotificationProviderProfiles(flattenedProfiles)
    : null;
};

export const flattenRemovedNotificationProviderProfileKeys = (
  records: NotificationProviderProfileOverrideRecords | null
): string[] | null => {
  if (!records) {
    return null;
  }

  const removedProfileKeys = Object.entries(records)
    .filter(([, record]) => record.value === null)
    .map(([profileKey]) => profileKey)
    .sort((left, right) => left.localeCompare(right));

  return removedProfileKeys.length > 0 ? removedProfileKeys : null;
};

export const createNotificationProviderProfileOverrideRecords = (input: {
  override: NotificationProviderProfileOverride;
  removedProfileKeys?: string[];
  updatedByRequestId: string;
  updatedByActorType: AuditActorType;
  updatedByActorId: string;
  updatedAt?: string;
}): NotificationProviderProfileOverrideRecords | null => {
  const removedProfileKeys = [...new Set(input.removedProfileKeys ?? [])].sort((left, right) =>
    left.localeCompare(right)
  );

  if (input.override.length === 0 && removedProfileKeys.length === 0) {
    return null;
  }

  const updatedAt = input.updatedAt ?? new Date().toISOString();

  const overrideEntries = sortNotificationProviderProfiles(input.override).map(profile => [
    profile.profileKey,
    {
      value: profile,
      updatedAt,
      updatedByRequestId: input.updatedByRequestId,
      updatedByActorType: input.updatedByActorType,
      updatedByActorId: input.updatedByActorId
    }
  ]);
  const removedEntries = removedProfileKeys.map(profileKey => [
    profileKey,
    {
      value: null,
      updatedAt,
      updatedByRequestId: input.updatedByRequestId,
      updatedByActorType: input.updatedByActorType,
      updatedByActorId: input.updatedByActorId
    }
  ]);

  return Object.fromEntries(
    [...overrideEntries, ...removedEntries].map(([profileKey, value]) => [
      profileKey,
      value
    ])
  );
};

export const flattenLaunchApprovalPolicyOverrideRecords = (
  records: LaunchApprovalPolicyOverrideRecords | null
): LaunchApprovalPolicyOverride | null => {
  if (!records) {
    return null;
  }

  const flattened: LaunchApprovalPolicyOverride = {};

  if (records.systemCheckLaunchApprovalTtlSeconds) {
    flattened.systemCheckLaunchApprovalTtlSeconds = records.systemCheckLaunchApprovalTtlSeconds.value;
  }

  return Object.keys(flattened).length > 0 ? flattened : null;
};

export const flattenNotificationProviderPromotionPolicyOverrideRecords = (
  records: NotificationProviderPromotionPolicyOverrideRecords | null
): NotificationProviderPromotionPolicyOverride | null => {
  if (!records) {
    return null;
  }

  const flattened: NotificationProviderPromotionPolicyOverride = {};

  if (records.evaluationWindowHours) {
    flattened.evaluationWindowHours = records.evaluationWindowHours.value;
  }

  if (records.minimumRequestedCount) {
    flattened.minimumRequestedCount = records.minimumRequestedCount.value;
  }

  if (records.minimumDirectSelectionCount) {
    flattened.minimumDirectSelectionCount = records.minimumDirectSelectionCount.value;
  }

  if (records.minimumDeliveredCount) {
    flattened.minimumDeliveredCount = records.minimumDeliveredCount.value;
  }

  if (records.maximumDeliveryFailedCount) {
    flattened.maximumDeliveryFailedCount = records.maximumDeliveryFailedCount.value;
  }

  if (records.autoPromoteEnabled) {
    flattened.autoPromoteEnabled = records.autoPromoteEnabled.value;
  }

  if (records.autoRollbackOnFailureEnabled) {
    flattened.autoRollbackOnFailureEnabled =
      records.autoRollbackOnFailureEnabled.value;
  }

  if (records.autoPromotionSuppressionSeconds) {
    flattened.autoPromotionSuppressionSeconds =
      records.autoPromotionSuppressionSeconds.value;
  }

  return Object.keys(flattened).length > 0 ? flattened : null;
};

export const createLaunchApprovalPolicyOverrideRecords = (input: {
  override: LaunchApprovalPolicyOverride;
  updatedByRequestId: string;
  updatedByActorType: AuditActorType;
  updatedByActorId: string;
  updatedAt?: string;
}): LaunchApprovalPolicyOverrideRecords | null => {
  const updatedAt = input.updatedAt ?? new Date().toISOString();
  const records: LaunchApprovalPolicyOverrideRecords = {};

  if (typeof input.override.systemCheckLaunchApprovalTtlSeconds === "number") {
    records.systemCheckLaunchApprovalTtlSeconds = {
      value: input.override.systemCheckLaunchApprovalTtlSeconds,
      updatedAt,
      updatedByRequestId: input.updatedByRequestId,
      updatedByActorType: input.updatedByActorType,
      updatedByActorId: input.updatedByActorId
    };
  }

  return Object.keys(records).length > 0 ? records : null;
};

export const createNotificationProviderPromotionPolicyOverrideRecords = (input: {
  override: NotificationProviderPromotionPolicyOverride;
  updatedByRequestId: string;
  updatedByActorType: AuditActorType;
  updatedByActorId: string;
  updatedAt?: string;
}): NotificationProviderPromotionPolicyOverrideRecords | null => {
  const updatedAt = input.updatedAt ?? new Date().toISOString();
  const records: NotificationProviderPromotionPolicyOverrideRecords = {};

  if (typeof input.override.evaluationWindowHours === "number") {
    records.evaluationWindowHours = {
      value: input.override.evaluationWindowHours,
      updatedAt,
      updatedByRequestId: input.updatedByRequestId,
      updatedByActorType: input.updatedByActorType,
      updatedByActorId: input.updatedByActorId
    };
  }

  if (typeof input.override.minimumRequestedCount === "number") {
    records.minimumRequestedCount = {
      value: input.override.minimumRequestedCount,
      updatedAt,
      updatedByRequestId: input.updatedByRequestId,
      updatedByActorType: input.updatedByActorType,
      updatedByActorId: input.updatedByActorId
    };
  }

  if (typeof input.override.minimumDirectSelectionCount === "number") {
    records.minimumDirectSelectionCount = {
      value: input.override.minimumDirectSelectionCount,
      updatedAt,
      updatedByRequestId: input.updatedByRequestId,
      updatedByActorType: input.updatedByActorType,
      updatedByActorId: input.updatedByActorId
    };
  }

  if (typeof input.override.minimumDeliveredCount === "number") {
    records.minimumDeliveredCount = {
      value: input.override.minimumDeliveredCount,
      updatedAt,
      updatedByRequestId: input.updatedByRequestId,
      updatedByActorType: input.updatedByActorType,
      updatedByActorId: input.updatedByActorId
    };
  }

  if (typeof input.override.maximumDeliveryFailedCount === "number") {
    records.maximumDeliveryFailedCount = {
      value: input.override.maximumDeliveryFailedCount,
      updatedAt,
      updatedByRequestId: input.updatedByRequestId,
      updatedByActorType: input.updatedByActorType,
      updatedByActorId: input.updatedByActorId
    };
  }

  if (typeof input.override.autoPromoteEnabled === "boolean") {
    records.autoPromoteEnabled = {
      value: input.override.autoPromoteEnabled,
      updatedAt,
      updatedByRequestId: input.updatedByRequestId,
      updatedByActorType: input.updatedByActorType,
      updatedByActorId: input.updatedByActorId
    };
  }

  if (typeof input.override.autoRollbackOnFailureEnabled === "boolean") {
    records.autoRollbackOnFailureEnabled = {
      value: input.override.autoRollbackOnFailureEnabled,
      updatedAt,
      updatedByRequestId: input.updatedByRequestId,
      updatedByActorType: input.updatedByActorType,
      updatedByActorId: input.updatedByActorId
    };
  }

  if (typeof input.override.autoPromotionSuppressionSeconds === "number") {
    records.autoPromotionSuppressionSeconds = {
      value: input.override.autoPromotionSuppressionSeconds,
      updatedAt,
      updatedByRequestId: input.updatedByRequestId,
      updatedByActorType: input.updatedByActorType,
      updatedByActorId: input.updatedByActorId
    };
  }

  return Object.keys(records).length > 0 ? records : null;
};

export const flattenNotificationPolicyOverrideRecords = (
  records: NotificationPolicyOverrideRecords | null
): NotificationPolicyOverride | null => {
  if (!records) {
    return null;
  }

  const flattened: NotificationPolicyOverride = {};

  if (records.breachNotificationDeliverySelectionMode) {
    flattened.breachNotificationDeliverySelectionMode =
      records.breachNotificationDeliverySelectionMode.value;
  }

  if (records.webhookSpikeRetryDelaySeconds) {
    flattened.webhookSpikeRetryDelaySeconds = records.webhookSpikeRetryDelaySeconds.value;
  }

  if (records.webhookSpikeMaxDeliveryAttempts) {
    flattened.webhookSpikeMaxDeliveryAttempts = records.webhookSpikeMaxDeliveryAttempts.value;
  }

  if (records.emailSpikeRetryDelaySeconds) {
    flattened.emailSpikeRetryDelaySeconds = records.emailSpikeRetryDelaySeconds.value;
  }

  if (records.emailSpikeMaxDeliveryAttempts) {
    flattened.emailSpikeMaxDeliveryAttempts = records.emailSpikeMaxDeliveryAttempts.value;
  }

  return Object.keys(flattened).length > 0 ? flattened : null;
};

export const createNotificationPolicyOverrideRecords = (input: {
  override: NotificationPolicyOverride;
  updatedByRequestId: string;
  updatedByActorType: AuditActorType;
  updatedByActorId: string;
  updatedAt?: string;
}): NotificationPolicyOverrideRecords | null => {
  const updatedAt = input.updatedAt ?? new Date().toISOString();
  const records: NotificationPolicyOverrideRecords = {};

  if (typeof input.override.breachNotificationDeliverySelectionMode === "string") {
    records.breachNotificationDeliverySelectionMode = {
      value: input.override.breachNotificationDeliverySelectionMode,
      updatedAt,
      updatedByRequestId: input.updatedByRequestId,
      updatedByActorType: input.updatedByActorType,
      updatedByActorId: input.updatedByActorId
    };
  }

  if (typeof input.override.webhookSpikeRetryDelaySeconds === "number") {
    records.webhookSpikeRetryDelaySeconds = {
      value: input.override.webhookSpikeRetryDelaySeconds,
      updatedAt,
      updatedByRequestId: input.updatedByRequestId,
      updatedByActorType: input.updatedByActorType,
      updatedByActorId: input.updatedByActorId
    };
  }

  if (typeof input.override.webhookSpikeMaxDeliveryAttempts === "number") {
    records.webhookSpikeMaxDeliveryAttempts = {
      value: input.override.webhookSpikeMaxDeliveryAttempts,
      updatedAt,
      updatedByRequestId: input.updatedByRequestId,
      updatedByActorType: input.updatedByActorType,
      updatedByActorId: input.updatedByActorId
    };
  }

  if (typeof input.override.emailSpikeRetryDelaySeconds === "number") {
    records.emailSpikeRetryDelaySeconds = {
      value: input.override.emailSpikeRetryDelaySeconds,
      updatedAt,
      updatedByRequestId: input.updatedByRequestId,
      updatedByActorType: input.updatedByActorType,
      updatedByActorId: input.updatedByActorId
    };
  }

  if (typeof input.override.emailSpikeMaxDeliveryAttempts === "number") {
    records.emailSpikeMaxDeliveryAttempts = {
      value: input.override.emailSpikeMaxDeliveryAttempts,
      updatedAt,
      updatedByRequestId: input.updatedByRequestId,
      updatedByActorType: input.updatedByActorType,
      updatedByActorId: input.updatedByActorId
    };
  }

  return Object.keys(records).length > 0 ? records : null;
};

export const resolveWorkspaceEvidenceRetentionPolicy = (
  workspace: Workspace,
  tenant: Tenant
): EvidenceRetentionPolicy =>
  ({
    ...tenant.defaultEvidenceRetentionPolicy,
    ...(flattenEvidenceRetentionPolicyOverrideRecords(workspace.evidenceRetentionPolicyOverrideRecords) ?? {})
  });

export const resolveWorkspaceEvidenceRetentionClassPolicy = (
  workspace: Workspace,
  tenant: Tenant
): EvidenceRetentionClassPolicy => {
  const override = flattenEvidenceRetentionClassPolicyOverrideRecords(
    workspace.evidenceRetentionClassPolicyOverrideRecords
  );

  if (!override) {
    return tenant.defaultEvidenceRetentionClassPolicy;
  }

  const overrideClassEntries = new Map(
    (override.classEntries ?? []).map(entry => [entry.retentionClass, entry])
  );
  const effectiveClasses = tenant.defaultEvidenceRetentionClassPolicy.classes.map(
    classEntry => overrideClassEntries.get(classEntry.retentionClass) ?? classEntry
  );
  const defaultCaptureRetentionClass = override.defaultCaptureRetentionClass;

  return {
    holdReasons: tenant.defaultEvidenceRetentionClassPolicy.holdReasons,
    defaultCaptureRetentionClass:
      typeof defaultCaptureRetentionClass === "string" &&
      effectiveClasses.some(entry => entry.retentionClass === defaultCaptureRetentionClass)
        ? defaultCaptureRetentionClass
        : tenant.defaultEvidenceRetentionClassPolicy.defaultCaptureRetentionClass,
    classes: effectiveClasses
  };
};

export const flattenEvidenceRetentionClassPolicyOverrideRecords = (
  records: EvidenceRetentionClassPolicyOverrideRecords | null
): EvidenceRetentionClassPolicyOverride | null => {
  if (!records) {
    return null;
  }

  const flattened: EvidenceRetentionClassPolicyOverride = {};

  if (records.defaultCaptureRetentionClass) {
    flattened.defaultCaptureRetentionClass = records.defaultCaptureRetentionClass.value;
  }

  if (records.classEntries) {
    const classEntries = Object.values(records.classEntries)
      .map(record => record.value)
      .sort((left, right) => left.retentionClass.localeCompare(right.retentionClass));

    if (classEntries.length > 0) {
      flattened.classEntries = classEntries;
    }
  }

  return Object.keys(flattened).length > 0 ? flattened : null;
};

export const flattenEvidenceRetentionPolicyOverrideRecords = (
  records: EvidenceRetentionPolicyOverrideRecords | null
): EvidenceRetentionPolicyOverride | null => {
  if (!records) {
    return null;
  }

  const flattened: EvidenceRetentionPolicyOverride = {};

  if (records.systemCheckEvidenceRetentionTtlSeconds) {
    flattened.systemCheckEvidenceRetentionTtlSeconds = records.systemCheckEvidenceRetentionTtlSeconds.value;
  }

  if (records.systemCheckEvidenceInvestigationRetentionTtlSeconds) {
    flattened.systemCheckEvidenceInvestigationRetentionTtlSeconds =
      records.systemCheckEvidenceInvestigationRetentionTtlSeconds.value;
  }

  return Object.keys(flattened).length > 0 ? flattened : null;
};

export const createEvidenceRetentionPolicyOverrideRecords = (input: {
  override: EvidenceRetentionPolicyOverride;
  updatedByRequestId: string;
  updatedByActorType: AuditActorType;
  updatedByActorId: string;
  updatedAt?: string;
}): EvidenceRetentionPolicyOverrideRecords | null => {
  const updatedAt = input.updatedAt ?? new Date().toISOString();
  const records: EvidenceRetentionPolicyOverrideRecords = {};

  if (typeof input.override.systemCheckEvidenceRetentionTtlSeconds === "number") {
    records.systemCheckEvidenceRetentionTtlSeconds = {
      value: input.override.systemCheckEvidenceRetentionTtlSeconds,
      updatedAt,
      updatedByRequestId: input.updatedByRequestId,
      updatedByActorType: input.updatedByActorType,
      updatedByActorId: input.updatedByActorId
    };
  }

  if (typeof input.override.systemCheckEvidenceInvestigationRetentionTtlSeconds === "number") {
    records.systemCheckEvidenceInvestigationRetentionTtlSeconds = {
      value: input.override.systemCheckEvidenceInvestigationRetentionTtlSeconds,
      updatedAt,
      updatedByRequestId: input.updatedByRequestId,
      updatedByActorType: input.updatedByActorType,
      updatedByActorId: input.updatedByActorId
    };
  }

  return Object.keys(records).length > 0 ? records : null;
};

export const createEvidenceRetentionClassPolicyOverrideRecords = (input: {
  override: EvidenceRetentionClassPolicyOverride;
  updatedByRequestId: string;
  updatedByActorType: AuditActorType;
  updatedByActorId: string;
  updatedAt?: string;
}): EvidenceRetentionClassPolicyOverrideRecords | null => {
  const updatedAt = input.updatedAt ?? new Date().toISOString();
  const records: EvidenceRetentionClassPolicyOverrideRecords = {};

  if (typeof input.override.defaultCaptureRetentionClass === "string") {
    records.defaultCaptureRetentionClass = {
      value: input.override.defaultCaptureRetentionClass,
      updatedAt,
      updatedByRequestId: input.updatedByRequestId,
      updatedByActorType: input.updatedByActorType,
      updatedByActorId: input.updatedByActorId
    };
  }

  if (input.override.classEntries && input.override.classEntries.length > 0) {
    records.classEntries = Object.fromEntries(
      input.override.classEntries.map(classEntry => [
        classEntry.retentionClass,
        {
          value: classEntry,
          updatedAt,
          updatedByRequestId: input.updatedByRequestId,
          updatedByActorType: input.updatedByActorType,
          updatedByActorId: input.updatedByActorId
        }
      ])
    );
  }

  return Object.keys(records).length > 0 ? records : null;
};
