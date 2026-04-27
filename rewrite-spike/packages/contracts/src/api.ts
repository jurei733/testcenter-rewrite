import type { MonitorCommandAckState } from "./events.js";

export const apiRoutes = {
  platformHealth: "/api/v1/platform/health",
  platformTenants: "/api/v1/platform/tenants",
  tenantActivationPolicy: (tenantKey: string): string => `/api/v1/platform/tenants/${tenantKey}/activation-policy`,
  tenantOperationalPolicy: (tenantKey: string): string => `/api/v1/platform/tenants/${tenantKey}/operational-policy`,
  tenantLaunchApprovalPolicy: (tenantKey: string): string =>
    `/api/v1/platform/tenants/${tenantKey}/launch-approval-policy`,
  tenantNotificationProviderPromotionPolicy: (tenantKey: string): string =>
    `/api/v1/platform/tenants/${tenantKey}/notification-provider-promotion-policy`,
  tenantNotificationPolicy: (tenantKey: string): string =>
    `/api/v1/platform/tenants/${tenantKey}/notification-policy`,
  tenantNotificationProviderProfiles: (tenantKey: string): string =>
    `/api/v1/platform/tenants/${tenantKey}/notification-provider-profiles`,
  tenantEvidenceRetentionPolicy: (tenantKey: string): string =>
    `/api/v1/platform/tenants/${tenantKey}/evidence-retention-policy`,
  tenantEvidenceRetentionClassPolicy: (tenantKey: string): string =>
    `/api/v1/platform/tenants/${tenantKey}/evidence-retention-class-policy`,
  tenantPolicyHistory: (tenantKey: string): string => `/api/v1/platform/tenants/${tenantKey}/policy-history`,
  tenantWorkspaces: (tenantKey: string): string => `/api/v1/tenants/${tenantKey}/workspaces`,
  workspaceActivationPolicy: (tenantKey: string, workspaceKey: string): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/activation-policy`,
  workspaceOperationalPolicy: (tenantKey: string, workspaceKey: string): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/operational-policy`,
  workspaceLaunchApprovalPolicy: (tenantKey: string, workspaceKey: string): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/launch-approval-policy`,
  workspaceNotificationProviderPromotionPolicy: (tenantKey: string, workspaceKey: string): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/notification-provider-promotion-policy`,
  workspaceNotificationPolicy: (tenantKey: string, workspaceKey: string): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/notification-policy`,
  workspaceNotificationProviderProfiles: (tenantKey: string, workspaceKey: string): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/notification-provider-profiles`,
  workspaceNotificationProviderProfileRolloutMetrics: (tenantKey: string, workspaceKey: string): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/notification-provider-profile-rollout-metrics`,
  workspaceNotificationProviderProfilePromote: (
    tenantKey: string,
    workspaceKey: string,
    profileKey: string
  ): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/notification-provider-profiles/${profileKey}:promote`,
  workspaceEvidenceRetentionPolicy: (tenantKey: string, workspaceKey: string): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/evidence-retention-policy`,
  workspaceEvidenceRetentionClassPolicy: (tenantKey: string, workspaceKey: string): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/evidence-retention-class-policy`,
  workspaceEvidenceRetentionClasses: (tenantKey: string, workspaceKey: string): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/evidence-retention-classes`,
  workspacePolicyHistory: (tenantKey: string, workspaceKey: string): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/policy-history`,
  workspaceSystemCheckResults: (tenantKey: string, workspaceKey: string): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/system-check-results`,
  workspaceSystemCheckReadiness: (tenantKey: string, workspaceKey: string): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/system-check-readiness`,
  workspaceSystemCheckEvidenceHoldQueue: (tenantKey: string, workspaceKey: string): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/system-check-evidence-hold-queue`,
  workspaceSystemCheckEvidenceBreachQueue: (tenantKey: string, workspaceKey: string): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/system-check-evidence-breach-queue`,
  workspaceSystemCheckEvidenceBreachDeadLetterQueue: (tenantKey: string, workspaceKey: string): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/system-check-evidence-breach-dead-letter-queue`,
  workspaceSystemCheckEvidenceBreachNotifications: (tenantKey: string, workspaceKey: string): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/system-check-evidence-breach-notifications`,
  workspaceSystemCheckEvidenceBreachNotificationAcknowledge: (
    tenantKey: string,
    workspaceKey: string,
    notificationId: string
  ): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/system-check-evidence-breach-notifications/${notificationId}:acknowledge`,
  workspaceSystemCheckEvidenceBreachNotificationRedrive: (
    tenantKey: string,
    workspaceKey: string,
    notificationId: string
  ): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/system-check-evidence-breach-notifications/${notificationId}:redrive`,
  workspaceSystemCheckLaunchApprovals: (tenantKey: string, workspaceKey: string): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/system-check-launch-approvals`,
  workspaceSystemCheckLaunchApprovalRevoke: (
    tenantKey: string,
    workspaceKey: string,
    launchApprovalId: string
  ): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/system-check-launch-approvals/${launchApprovalId}:revoke`,
  workspaceSystemCheckEvidenceHold: (tenantKey: string, workspaceKey: string, evidenceKey: string): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/system-check-evidence/${evidenceKey}:hold`,
  workspaceSystemCheckEvidenceAcknowledgeHold: (
    tenantKey: string,
    workspaceKey: string,
    evidenceKey: string
  ): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/system-check-evidence/${evidenceKey}:acknowledge-hold`,
  workspaceSystemCheckEvidenceAssignHold: (
    tenantKey: string,
    workspaceKey: string,
    evidenceKey: string
  ): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/system-check-evidence/${evidenceKey}:assign-hold`,
  workspaceSystemCheckEvidenceReleaseHold: (
    tenantKey: string,
    workspaceKey: string,
    evidenceKey: string
  ): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/system-check-evidence/${evidenceKey}:release-hold`,
  workspaceSystemCheckEvidenceRetentionHistory: (
    tenantKey: string,
    workspaceKey: string,
    evidenceKey: string
  ): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/system-check-evidence/${evidenceKey}/retention-history`,
  workspaceSystemCheckEvidence: (tenantKey: string, workspaceKey: string, evidenceKey: string): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/system-check-evidence/${evidenceKey}`,
  systemCheckEvidenceAccess: (accessToken: string): string =>
    `/api/v1/system-check-evidence-access/${accessToken}`,
  workspaceSystemCheckResultReview: (tenantKey: string, workspaceKey: string, systemCheckSubmissionId: string): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/system-check-results/${systemCheckSubmissionId}:review`,
  workspaceAuditEvents: (tenantKey: string, workspaceKey: string): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/audit-events`,
  workspaceMonitorCommands: (tenantKey: string, workspaceKey: string): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/monitor/commands`,
  workspaceMonitorTestRuns: (tenantKey: string, workspaceKey: string): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/monitor/test-runs`,
  workspaceMonitorTestRunPause: (tenantKey: string, workspaceKey: string, testRunId: string): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/monitor/test-runs/${testRunId}:pause`,
  workspaceMonitorTestRunResume: (tenantKey: string, workspaceKey: string, testRunId: string): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/monitor/test-runs/${testRunId}:resume`,
  workspaceMonitorTestRunUnlock: (tenantKey: string, workspaceKey: string, testRunId: string): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/monitor/test-runs/${testRunId}:unlock`,
  workspaceSourcePackages: (tenantKey: string, workspaceKey: string): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`,
  workspaceImportJobs: (tenantKey: string, workspaceKey: string): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`,
  workspaceImportJob: (tenantKey: string, workspaceKey: string, importJobId: string): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs/${importJobId}`,
  workspaceContentReleases: (tenantKey: string, workspaceKey: string): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases`,
  workspaceContentRelease: (tenantKey: string, workspaceKey: string, contentReleaseId: string): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${contentReleaseId}`,
  workspaceContentReleaseMonitorProjection: (tenantKey: string, workspaceKey: string, contentReleaseId: string): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${contentReleaseId}/monitor-projection`,
  workspaceContentReleaseSystemCheckProjection: (tenantKey: string, workspaceKey: string, contentReleaseId: string): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${contentReleaseId}/system-check-projection`,
  contentReleaseActivate: (tenantKey: string, workspaceKey: string, contentReleaseId: string): string =>
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${contentReleaseId}:activate`,
  participantAuthSignIn: "/api/v1/participant/auth/sign-in",
  participantStarter: "/api/v1/participant/starter",
  participantSystemCheck: "/api/v1/participant/system-check",
  participantSystemCheckEvidenceCapture: "/api/v1/participant/system-check-evidence",
  participantSystemCheckSubmit: "/api/v1/participant/system-check:submit",
  participantStarterLaunch: "/api/v1/participant/starter:launch",
  participantTestRun: (testRunId: string): string => `/api/v1/participant/test-runs/${testRunId}`,
  participantTestRunSave: (testRunId: string): string => `/api/v1/participant/test-runs/${testRunId}:save`,
  participantTestRunNextUnit: (testRunId: string): string => `/api/v1/participant/test-runs/${testRunId}:request-next-unit`,
  participantTestRunNavigate: (testRunId: string): string =>
    `/api/v1/participant/test-runs/${testRunId}:request-unit-navigation`
} as const;

export interface HealthResponse {
  status: "ok";
  service: "api" | "worker" | "web";
}

export interface ErrorResponse {
  error: {
    code: string;
    message: string;
    details?: Record<string, unknown>;
  };
}

export interface CreateTenantRequest {
  tenantKey: string;
  displayName: string;
}

export interface TenantSummaryDto {
  tenantKey: string;
  displayName: string;
  status: "active" | "suspended";
}

export interface CreateWorkspaceRequest {
  workspaceKey: string;
  displayName: string;
}

export interface WorkspaceSummaryDto {
  workspaceKey: string;
  displayName: string;
  status: "active" | "archived";
}

export interface CreateSourcePackageRequest {
  fileName: string;
  manifestHash: string;
  format: "xml-archive" | "xml-manifest";
  uploadedBy: string;
}

export interface SourcePackageSummaryDto {
  sourcePackageId: string;
  fileName: string;
  manifestHash: string;
  format: "xml-archive" | "xml-manifest";
  status: "uploaded";
  uploadedAt: string;
  uploadedBy: string;
}

export interface CreateImportJobRequest {
  sourcePackageId: string;
}

export interface ImportJobSummaryDto {
  importJobId: string;
  sourcePackageId: string;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  createdAt: string;
  completedAt: string | null;
  failureMessage: string | null;
}

export interface BookletRunPolicyDto {
  navigationLocked: boolean;
  timeLimitSeconds: number | null;
}

export interface ContentReleaseActivationPolicyDto {
  blockIncompatibleRoutingChangesWithActiveSessions: boolean;
  warnOnActiveSessions: boolean;
  warnOnHighRiskReleaseChange: boolean;
}

export interface ContentReleaseActivationPolicyOverrideDto {
  blockIncompatibleRoutingChangesWithActiveSessions?: boolean;
  warnOnActiveSessions?: boolean;
  warnOnHighRiskReleaseChange?: boolean;
}

export interface BooleanPolicyOverrideRecordDto {
  value: boolean;
  updatedAt: string;
  updatedByRequestId: string;
  updatedByActorType:
    | "platform_api"
    | "participant"
    | "monitor"
    | "worker"
    | "dispatcher"
    | "notification_service";
  updatedByActorId: string;
}

export interface ActivationPolicyOverrideRecordsDto {
  blockIncompatibleRoutingChangesWithActiveSessions?: BooleanPolicyOverrideRecordDto;
  warnOnActiveSessions?: BooleanPolicyOverrideRecordDto;
  warnOnHighRiskReleaseChange?: BooleanPolicyOverrideRecordDto;
}

export interface OperationalPolicyDto {
  monitorCommandTtlSeconds: number;
  monitorCommandLeaseSeconds: number;
  timedRunMaintenanceGraceSeconds: number;
}

export interface OperationalPolicyOverrideDto {
  monitorCommandTtlSeconds?: number;
  monitorCommandLeaseSeconds?: number;
  timedRunMaintenanceGraceSeconds?: number;
}

export interface LaunchApprovalPolicyDto {
  systemCheckLaunchApprovalTtlSeconds: number;
}

export interface LaunchApprovalPolicyOverrideDto {
  systemCheckLaunchApprovalTtlSeconds?: number;
}

export interface NotificationProviderPromotionPolicyDto {
  evaluationWindowHours: number;
  minimumRequestedCount: number;
  minimumDirectSelectionCount: number;
  minimumDeliveredCount: number;
  maximumDeliveryFailedCount: number;
}

export interface NotificationProviderPromotionPolicyOverrideDto {
  evaluationWindowHours?: number;
  minimumRequestedCount?: number;
  minimumDirectSelectionCount?: number;
  minimumDeliveredCount?: number;
  maximumDeliveryFailedCount?: number;
}

export type NotificationDeliverySelectionModeDto =
  | "infer_from_target"
  | "force_webhook_spike"
  | "force_email_spike";

export type NotificationProviderProfileRolloutStateDto =
  | "active"
  | "paused"
  | "canary";

export type NotificationProviderProfileTargetProbeModeDto =
  | "active"
  | "skip";

export type NotificationProviderProfileCredentialsStatusDto =
  | "not_configured"
  | "reachable"
  | "unreachable";

export type NotificationProviderProfileHealthStatusDto =
  | "ready"
  | "paused"
  | "disabled"
  | "credentials_unreachable"
  | "target_unreachable";

export type NotificationProviderProfileOperationalRolloutStatusDto =
  | "active_ready"
  | "active_blocked"
  | "paused"
  | "disabled"
  | "canary_ready"
  | "canary_blocked";

export type NotificationProviderProfileProbeStatusDto =
  | "succeeded"
  | "skipped_paused"
  | "skipped_disabled"
  | "skipped_by_policy"
  | "credentials_unreachable"
  | "target_unreachable";

export interface NotificationProviderProfileOperationalStateDto {
  lastCheckedAt: string;
  lastCheckedByActorType: "worker" | "notification_service" | "platform_api";
  lastCheckedByActorId: string;
  credentialsStatus: NotificationProviderProfileCredentialsStatusDto;
  healthStatus: NotificationProviderProfileHealthStatusDto;
  rolloutStatus: NotificationProviderProfileOperationalRolloutStatusDto;
  probeStatus: NotificationProviderProfileProbeStatusDto;
  probeTarget: string | null;
  probeLatencyMs: number | null;
  lastCheckError: string | null;
}

export interface NotificationPolicyDto {
  breachNotificationDeliverySelectionMode: NotificationDeliverySelectionModeDto;
  webhookSpikeRetryDelaySeconds: number;
  webhookSpikeMaxDeliveryAttempts: number;
  emailSpikeRetryDelaySeconds: number;
  emailSpikeMaxDeliveryAttempts: number;
}

export interface NotificationPolicyOverrideDto {
  breachNotificationDeliverySelectionMode?: NotificationDeliverySelectionModeDto;
  webhookSpikeRetryDelaySeconds?: number;
  webhookSpikeMaxDeliveryAttempts?: number;
  emailSpikeRetryDelaySeconds?: number;
  emailSpikeMaxDeliveryAttempts?: number;
}

export interface NotificationProviderProfileInputDto {
  profileKey: string;
  displayLabel: string;
  enabled?: boolean;
  rolloutState?: NotificationProviderProfileRolloutStateDto;
  rolloutPercentage?: number;
  rolloutFallbackProfileKey?: string | null;
  targetProbeMode?: NotificationProviderProfileTargetProbeModeDto;
  deliveryChannel: SystemCheckEvidenceBreachNotificationDeliveryChannelDto;
  target: string;
  credentialsRef: string | null;
}

export interface NotificationProviderProfileDto {
  profileKey: string;
  displayLabel: string;
  enabled: boolean;
  rolloutState: NotificationProviderProfileRolloutStateDto;
  rolloutPercentage: number;
  rolloutFallbackProfileKey: string | null;
  targetProbeMode: NotificationProviderProfileTargetProbeModeDto;
  deliveryChannel: SystemCheckEvidenceBreachNotificationDeliveryChannelDto;
  target: string;
  credentialsRefPresent: boolean;
  credentialsRefMasked: string | null;
  credentialsStatus: NotificationProviderProfileCredentialsStatusDto;
  healthStatus: NotificationProviderProfileHealthStatusDto;
  operationalState: NotificationProviderProfileOperationalStateDto | null;
}

export interface NotificationProviderProfileOverrideRecordDto {
  profileKey: string;
  value: NotificationProviderProfileDto | null;
  updatedAt: string;
  updatedByRequestId: string;
  updatedByActorType:
    | "platform_api"
    | "participant"
    | "monitor"
    | "worker"
    | "dispatcher"
    | "notification_service";
  updatedByActorId: string;
}

export interface EvidenceRetentionPolicyDto {
  systemCheckEvidenceRetentionTtlSeconds: number;
  systemCheckEvidenceInvestigationRetentionTtlSeconds: number;
}

export type EvidenceRetentionTtlFieldKeyDto =
  | "systemCheckEvidenceRetentionTtlSeconds"
  | "systemCheckEvidenceInvestigationRetentionTtlSeconds";
export type EvidenceRetentionHoldReasonSeverityDto = "low" | "medium" | "high";

export interface EvidenceRetentionHoldReasonDefinitionDto {
  holdReasonCode: string;
  displayLabel: string;
  workflowHint: string | null;
  severity: EvidenceRetentionHoldReasonSeverityDto;
  escalationTarget: string | null;
  uiGroup: string | null;
  acknowledgementRequired: boolean;
  defaultAssigneeTarget: string | null;
  slaSeconds: number | null;
}

export interface EvidenceRetentionClassTransitionPolicyDto {
  holdReasonCode: string;
  targetRetentionClass: string;
}

export interface EvidenceRetentionClassPolicyEntryDto {
  retentionClass: string;
  retentionPolicyKey: string;
  ttlFieldKey: EvidenceRetentionTtlFieldKeyDto;
  manualHoldAllowed: boolean;
  payloadAccessGrantsAllowed: boolean;
  holdTransitions: EvidenceRetentionClassTransitionPolicyDto[];
}

export interface EvidenceRetentionClassPolicyDto {
  holdReasons: EvidenceRetentionHoldReasonDefinitionDto[];
  defaultCaptureRetentionClass: string;
  classes: EvidenceRetentionClassPolicyEntryDto[];
}

export interface EvidenceRetentionClassPolicyOverrideDto {
  defaultCaptureRetentionClass?: string;
  classEntries?: EvidenceRetentionClassPolicyEntryDto[];
}

export interface EvidenceRetentionPolicyOverrideDto {
  systemCheckEvidenceRetentionTtlSeconds?: number;
  systemCheckEvidenceInvestigationRetentionTtlSeconds?: number;
}

export interface NumericPolicyOverrideRecordDto {
  value: number;
  updatedAt: string;
  updatedByRequestId: string;
  updatedByActorType:
    | "platform_api"
    | "participant"
    | "monitor"
    | "worker"
    | "dispatcher"
    | "notification_service";
  updatedByActorId: string;
}

export interface OperationalPolicyOverrideRecordsDto {
  monitorCommandTtlSeconds?: NumericPolicyOverrideRecordDto;
  monitorCommandLeaseSeconds?: NumericPolicyOverrideRecordDto;
  timedRunMaintenanceGraceSeconds?: NumericPolicyOverrideRecordDto;
}

export interface LaunchApprovalPolicyOverrideRecordsDto {
  systemCheckLaunchApprovalTtlSeconds?: NumericPolicyOverrideRecordDto;
}

export interface NotificationProviderPromotionPolicyOverrideRecordsDto {
  evaluationWindowHours?: NumericPolicyOverrideRecordDto;
  minimumRequestedCount?: NumericPolicyOverrideRecordDto;
  minimumDirectSelectionCount?: NumericPolicyOverrideRecordDto;
  minimumDeliveredCount?: NumericPolicyOverrideRecordDto;
  maximumDeliveryFailedCount?: NumericPolicyOverrideRecordDto;
}

export interface NotificationPolicyOverrideRecordsDto {
  breachNotificationDeliverySelectionMode?: {
    value: NotificationDeliverySelectionModeDto;
    updatedAt: string;
    updatedByRequestId: string;
    updatedByActorType:
      | "platform_api"
      | "participant"
      | "monitor"
      | "worker"
      | "dispatcher"
      | "notification_service";
    updatedByActorId: string;
  };
  webhookSpikeRetryDelaySeconds?: NumericPolicyOverrideRecordDto;
  webhookSpikeMaxDeliveryAttempts?: NumericPolicyOverrideRecordDto;
  emailSpikeRetryDelaySeconds?: NumericPolicyOverrideRecordDto;
  emailSpikeMaxDeliveryAttempts?: NumericPolicyOverrideRecordDto;
}

export interface EvidenceRetentionPolicyOverrideRecordsDto {
  systemCheckEvidenceRetentionTtlSeconds?: NumericPolicyOverrideRecordDto;
  systemCheckEvidenceInvestigationRetentionTtlSeconds?: NumericPolicyOverrideRecordDto;
}

export interface EvidenceRetentionClassPolicyOverrideRecordDto {
  value: string;
  updatedAt: string;
  updatedByRequestId: string;
  updatedByActorType:
    | "platform_api"
    | "participant"
    | "monitor"
    | "worker"
    | "dispatcher"
    | "notification_service";
  updatedByActorId: string;
}

export interface EvidenceRetentionClassPolicyEntryOverrideRecordDto {
  value: EvidenceRetentionClassPolicyEntryDto;
  updatedAt: string;
  updatedByRequestId: string;
  updatedByActorType:
    | "platform_api"
    | "participant"
    | "monitor"
    | "worker"
    | "dispatcher"
    | "notification_service";
  updatedByActorId: string;
}

export interface EvidenceRetentionClassPolicyOverrideRecordsDto {
  defaultCaptureRetentionClass?: EvidenceRetentionClassPolicyOverrideRecordDto;
  classEntries?: EvidenceRetentionClassPolicyEntryOverrideRecordDto[];
}

export type WorkspaceActivationPolicyModeDto = "inherit" | "override";
export type WorkspaceOperationalPolicyModeDto = "inherit" | "override";
export type WorkspaceLaunchApprovalPolicyModeDto = "inherit" | "override";
export type WorkspaceNotificationProviderPromotionPolicyModeDto = "inherit" | "override";
export type WorkspaceNotificationPolicyModeDto = "inherit" | "override";
export type WorkspaceNotificationProviderProfilesModeDto = "inherit" | "override";
export type WorkspaceEvidenceRetentionPolicyModeDto = "inherit" | "override";
export type WorkspaceEvidenceRetentionClassPolicyModeDto = "inherit" | "override";

export interface UpdateWorkspaceActivationPolicyRequest {
  mode: WorkspaceActivationPolicyModeDto;
  activationPolicyOverride?: ContentReleaseActivationPolicyOverrideDto | null;
}

export interface UpdateTenantActivationPolicyRequest {
  defaultActivationPolicy: ContentReleaseActivationPolicyDto;
}

export interface UpdateWorkspaceOperationalPolicyRequest {
  mode: WorkspaceOperationalPolicyModeDto;
  operationalPolicyOverride?: OperationalPolicyOverrideDto | null;
}

export interface UpdateTenantOperationalPolicyRequest {
  defaultOperationalPolicy: OperationalPolicyDto;
}

export interface UpdateWorkspaceLaunchApprovalPolicyRequest {
  mode: WorkspaceLaunchApprovalPolicyModeDto;
  launchApprovalPolicyOverride?: LaunchApprovalPolicyOverrideDto | null;
}

export interface UpdateTenantLaunchApprovalPolicyRequest {
  defaultLaunchApprovalPolicy: LaunchApprovalPolicyDto;
}

export interface UpdateWorkspaceNotificationProviderPromotionPolicyRequest {
  mode: WorkspaceNotificationProviderPromotionPolicyModeDto;
  notificationProviderPromotionPolicyOverride?: NotificationProviderPromotionPolicyOverrideDto | null;
}

export interface UpdateTenantNotificationProviderPromotionPolicyRequest {
  defaultNotificationProviderPromotionPolicy: NotificationProviderPromotionPolicyDto;
}

export interface UpdateWorkspaceNotificationPolicyRequest {
  mode: WorkspaceNotificationPolicyModeDto;
  notificationPolicyOverride?: NotificationPolicyOverrideDto | null;
}

export interface UpdateTenantNotificationPolicyRequest {
  defaultNotificationPolicy: NotificationPolicyDto;
}

export interface UpdateTenantNotificationProviderProfilesRequest {
  defaultNotificationProviderProfiles: NotificationProviderProfileInputDto[];
}

export interface UpdateWorkspaceNotificationProviderProfilesRequest {
  mode: WorkspaceNotificationProviderProfilesModeDto;
  notificationProviderProfileOverride?: NotificationProviderProfileInputDto[] | null;
  removedNotificationProviderProfileKeys?: string[] | null;
}

export interface UpdateWorkspaceEvidenceRetentionPolicyRequest {
  mode: WorkspaceEvidenceRetentionPolicyModeDto;
  evidenceRetentionPolicyOverride?: EvidenceRetentionPolicyOverrideDto | null;
}

export interface UpdateTenantEvidenceRetentionPolicyRequest {
  defaultEvidenceRetentionPolicy: EvidenceRetentionPolicyDto;
}

export interface UpdateWorkspaceEvidenceRetentionClassPolicyRequest {
  mode: WorkspaceEvidenceRetentionClassPolicyModeDto;
  evidenceRetentionClassPolicyOverride?: EvidenceRetentionClassPolicyOverrideDto | null;
}

export interface UpdateTenantEvidenceRetentionClassPolicyRequest {
  defaultEvidenceRetentionClassPolicy: EvidenceRetentionClassPolicyDto;
}

export interface TenantActivationPolicyResponse {
  tenantKey: string;
  defaultActivationPolicy: ContentReleaseActivationPolicyDto;
}

export interface TenantOperationalPolicyResponse {
  tenantKey: string;
  defaultOperationalPolicy: OperationalPolicyDto;
}

export interface TenantLaunchApprovalPolicyResponse {
  tenantKey: string;
  defaultLaunchApprovalPolicy: LaunchApprovalPolicyDto;
}

export interface TenantNotificationProviderPromotionPolicyResponse {
  tenantKey: string;
  defaultNotificationProviderPromotionPolicy: NotificationProviderPromotionPolicyDto;
}

export interface TenantNotificationPolicyResponse {
  tenantKey: string;
  defaultNotificationPolicy: NotificationPolicyDto;
}

export interface TenantNotificationProviderProfilesResponse {
  tenantKey: string;
  defaultNotificationProviderProfiles: NotificationProviderProfileDto[];
}

export interface TenantEvidenceRetentionPolicyResponse {
  tenantKey: string;
  defaultEvidenceRetentionPolicy: EvidenceRetentionPolicyDto;
}

export interface TenantEvidenceRetentionClassPolicyResponse {
  tenantKey: string;
  defaultEvidenceRetentionClassPolicy: EvidenceRetentionClassPolicyDto;
}

export interface WorkspaceActivationPolicyResponse {
  tenantKey: string;
  workspaceKey: string;
  mode: WorkspaceActivationPolicyModeDto;
  defaultActivationPolicy: ContentReleaseActivationPolicyDto;
  activationPolicyOverride: ContentReleaseActivationPolicyOverrideDto | null;
  activationPolicyOverrideRecords: ActivationPolicyOverrideRecordsDto | null;
  effectiveActivationPolicy: ContentReleaseActivationPolicyDto;
}

export interface WorkspaceOperationalPolicyResponse {
  tenantKey: string;
  workspaceKey: string;
  mode: WorkspaceOperationalPolicyModeDto;
  defaultOperationalPolicy: OperationalPolicyDto;
  operationalPolicyOverride: OperationalPolicyOverrideDto | null;
  operationalPolicyOverrideRecords: OperationalPolicyOverrideRecordsDto | null;
  effectiveOperationalPolicy: OperationalPolicyDto;
}

export interface WorkspaceLaunchApprovalPolicyResponse {
  tenantKey: string;
  workspaceKey: string;
  mode: WorkspaceLaunchApprovalPolicyModeDto;
  defaultLaunchApprovalPolicy: LaunchApprovalPolicyDto;
  launchApprovalPolicyOverride: LaunchApprovalPolicyOverrideDto | null;
  launchApprovalPolicyOverrideRecords: LaunchApprovalPolicyOverrideRecordsDto | null;
  effectiveLaunchApprovalPolicy: LaunchApprovalPolicyDto;
}

export interface WorkspaceNotificationProviderPromotionPolicyResponse {
  tenantKey: string;
  workspaceKey: string;
  mode: WorkspaceNotificationProviderPromotionPolicyModeDto;
  defaultNotificationProviderPromotionPolicy: NotificationProviderPromotionPolicyDto;
  notificationProviderPromotionPolicyOverride: NotificationProviderPromotionPolicyOverrideDto | null;
  notificationProviderPromotionPolicyOverrideRecords: NotificationProviderPromotionPolicyOverrideRecordsDto | null;
  effectiveNotificationProviderPromotionPolicy: NotificationProviderPromotionPolicyDto;
}

export interface WorkspaceNotificationPolicyResponse {
  tenantKey: string;
  workspaceKey: string;
  mode: WorkspaceNotificationPolicyModeDto;
  defaultNotificationPolicy: NotificationPolicyDto;
  notificationPolicyOverride: NotificationPolicyOverrideDto | null;
  notificationPolicyOverrideRecords: NotificationPolicyOverrideRecordsDto | null;
  effectiveNotificationPolicy: NotificationPolicyDto;
}

export interface WorkspaceNotificationProviderProfilesResponse {
  tenantKey: string;
  workspaceKey: string;
  mode: WorkspaceNotificationProviderProfilesModeDto;
  defaultNotificationProviderProfiles: NotificationProviderProfileDto[];
  notificationProviderProfileOverride: NotificationProviderProfileDto[] | null;
  removedNotificationProviderProfileKeys: string[] | null;
  notificationProviderProfileOverrideRecords: NotificationProviderProfileOverrideRecordDto[] | null;
  effectiveNotificationProviderProfiles: NotificationProviderProfileDto[];
}

export interface NotificationProviderProfileRolloutMetricsItemDto {
  profileKey: string;
  displayLabel: string;
  rolloutState: NotificationProviderProfileRolloutStateDto;
  rolloutPercentage: number;
  rolloutFallbackProfileKey: string | null;
  targetProbeMode: NotificationProviderProfileTargetProbeModeDto;
  healthStatus: NotificationProviderProfileHealthStatusDto;
  requestedCount: number;
  directSelectionCount: number;
  fallbackRoutedCount: number;
  fallbackRecipientCount: number;
  rolloutBlockedCount: number;
  deliveredCount: number;
  pendingDeliveryCount: number;
  deliveryFailedCount: number;
  lastDeliveredAt: string | null;
  lastDeliveryFailedAt: string | null;
  promotionReadiness: {
    status: "ready" | "blocked";
    evaluationWindowHours: number;
    reasons: string[];
  };
}

export interface WorkspaceNotificationProviderProfileRolloutMetricsResponse {
  tenantKey: string;
  workspaceKey: string;
  evaluationWindowHours: number;
  items: NotificationProviderProfileRolloutMetricsItemDto[];
}

export interface PromoteWorkspaceNotificationProviderProfileRequest {
  promotedByActorId: string;
  promotionNote?: string | null;
  clearRolloutFallbackProfile?: boolean;
  forcePromotion?: boolean;
  evaluationWindowHours?: number;
}

export interface PromoteWorkspaceNotificationProviderProfileResponse {
  profileKey: string;
  workspace: WorkspaceNotificationProviderProfilesResponse;
}

export interface WorkspaceEvidenceRetentionPolicyResponse {
  tenantKey: string;
  workspaceKey: string;
  mode: WorkspaceEvidenceRetentionPolicyModeDto;
  defaultEvidenceRetentionPolicy: EvidenceRetentionPolicyDto;
  evidenceRetentionPolicyOverride: EvidenceRetentionPolicyOverrideDto | null;
  evidenceRetentionPolicyOverrideRecords: EvidenceRetentionPolicyOverrideRecordsDto | null;
  effectiveEvidenceRetentionPolicy: EvidenceRetentionPolicyDto;
}

export interface WorkspaceEvidenceRetentionClassPolicyResponse {
  tenantKey: string;
  workspaceKey: string;
  mode: WorkspaceEvidenceRetentionClassPolicyModeDto;
  defaultEvidenceRetentionClassPolicy: EvidenceRetentionClassPolicyDto;
  evidenceRetentionClassPolicyOverride: EvidenceRetentionClassPolicyOverrideDto | null;
  evidenceRetentionClassPolicyOverrideRecords: EvidenceRetentionClassPolicyOverrideRecordsDto | null;
  effectiveEvidenceRetentionClassPolicy: EvidenceRetentionClassPolicyDto;
}

export interface SystemCheckEvidenceRetentionClassTransitionDto {
  holdReasonCode: SystemCheckEvidenceHoldReasonCodeDto;
  holdReasonDisplayLabel: string | null;
  holdReasonWorkflowHint: string | null;
  holdReasonSeverity: EvidenceRetentionHoldReasonSeverityDto | null;
  holdReasonEscalationTarget: string | null;
  holdReasonUiGroup: string | null;
  holdReasonAcknowledgementRequired: boolean | null;
  holdReasonDefaultAssigneeTarget: string | null;
  holdReasonSlaSeconds: number | null;
  targetRetentionClass: string;
  targetRetentionPolicyKey: string;
}

export interface SystemCheckEvidenceRetentionClassRuleDto {
  retentionClass: string;
  retentionPolicyKey: string;
  ttlSeconds: number;
  manualHoldAllowed: boolean;
  payloadAccessGrantsAllowed: boolean;
  holdTransitions: SystemCheckEvidenceRetentionClassTransitionDto[];
}

export interface WorkspaceEvidenceRetentionClassesResponse {
  tenantKey: string;
  workspaceKey: string;
  classes: SystemCheckEvidenceRetentionClassRuleDto[];
}

export interface ContentReleaseSummaryDto {
  contentReleaseId: string;
  releaseLabel: string;
  fixtureKey: string;
  status: "draft" | "active";
  createdAt: string;
  activatedAt: string | null;
  bookletCount: number;
  loginCount: number;
  assignmentCount: number;
  comparisonToPrevious: ContentReleaseDiffSummaryDto;
  activationGuardrail: ContentReleaseActivationGuardrailDto;
}

export interface ContentReleaseEntityDiffDto {
  addedKeys: string[];
  removedKeys: string[];
  changedKeys: string[];
  unchangedKeys: string[];
}

export type ContentReleaseFieldValueDto =
  | string
  | number
  | boolean
  | null
  | string[]
  | Record<string, string>;

export interface ContentReleaseFieldChangeDto {
  fieldKey: string;
  message: string;
  before: ContentReleaseFieldValueDto;
  after: ContentReleaseFieldValueDto;
}

export interface ContentReleaseEntityChangeDetailDto {
  entityKey: string;
  changes: ContentReleaseFieldChangeDto[];
}

export type ContentReleaseImpactAreaDto =
  | "initial_import"
  | "units"
  | "booklets"
  | "run_policy"
  | "login_collections"
  | "assignment_routing"
  | "initial_state";

export type ContentReleaseImpactRiskLevelDto = "none" | "low" | "medium" | "high";

export interface ContentReleaseActivationImpactDto {
  riskLevel: ContentReleaseImpactRiskLevelDto;
  changedAreas: ContentReleaseImpactAreaDto[];
  affectedLoginCount: number;
  affectedLoginKeys: string[];
  affectedGroupKeys: string[];
  affectedBookletKeys: string[];
  affectedAssignmentKeys: string[];
  highlights: string[];
}

export type ContentReleaseActivationGuardrailStatusDto = "ready" | "warning" | "blocked";

export type ContentReleaseActivationGuardrailComparisonModeDto =
  | "no_active_release"
  | "already_active"
  | "switch_from_active_release";

export type ContentReleaseActivationGuardrailCodeDto =
  | "no_active_release"
  | "already_active"
  | "active_sessions_present"
  | "high_risk_release_change"
  | "active_sessions_incompatible_routing_change";

export interface ContentReleaseActivationGuardrailDto {
  status: ContentReleaseActivationGuardrailStatusDto;
  comparisonMode: ContentReleaseActivationGuardrailComparisonModeDto;
  comparedToActiveContentReleaseId: string | null;
  comparedToActiveReleaseLabel: string | null;
  activeSessionCount: number;
  activeTestRunIds: string[];
  activeLoginKeys: string[];
  activeGroupKeys: string[];
  blockingReasonCodes: ContentReleaseActivationGuardrailCodeDto[];
  warningReasonCodes: ContentReleaseActivationGuardrailCodeDto[];
  highlights: string[];
}

export interface ContentReleaseDiffSummaryDto {
  baselineContentReleaseId: string | null;
  baselineReleaseLabel: string | null;
  comparisonType: "initial_import" | "successive_import";
  changed: boolean;
  totalChanges: number;
  units: ContentReleaseEntityDiffDto;
  booklets: ContentReleaseEntityDiffDto;
  loginCollections: ContentReleaseEntityDiffDto;
  bookletAssignments: ContentReleaseEntityDiffDto;
  bookletChangeDetails: ContentReleaseEntityChangeDetailDto[];
  loginCollectionChangeDetails: ContentReleaseEntityChangeDetailDto[];
  bookletAssignmentChangeDetails: ContentReleaseEntityChangeDetailDto[];
  runPoliciesChangedBookletKeys: string[];
  activationImpact: ContentReleaseActivationImpactDto;
}

export interface ContentReleaseCanonicalBookletDto {
  bookletKey: string;
  title: string;
  unitKeys: string[];
  unitCount: number;
  runPolicy: BookletRunPolicyDto;
}

export interface ContentReleaseCanonicalLoginCollectionDto {
  collectionKey: string;
  groupKey: string;
  loginKeys: string[];
}

export interface ContentReleaseCanonicalAssignmentDto {
  assignmentKey: string;
  loginKey: string;
  bookletKey: string;
  initialStateOverrides: Record<string, string>;
}

export interface SystemCheckDefinitionDto {
  systemCheckKey: string;
  title: string;
  checkKeys: string[];
}

export type SystemCheckResultStatusDto = "passed" | "warning" | "failed";
export type SystemCheckReviewStatusDto = "pending" | "accepted" | "needs_follow_up" | "rejected";
export type SystemCheckLaunchReadinessStatusDto = "ready" | "warning" | "blocked";
export type SystemCheckLaunchReadinessCodeDto =
  | "missing_submission"
  | "pending_review"
  | "requires_follow_up"
  | "rejected"
  | "accepted_with_warning"
  | "accepted_with_failure";
export type SystemCheckLaunchApprovalScopeDto = "single_launch" | "session_assignment";
export type SystemCheckLaunchApprovalStatusDto =
  | "active"
  | "consumed"
  | "revoked"
  | "invalidated"
  | "expired";
export type SystemCheckLaunchApprovalInvalidationReasonCodeDto =
  | "readiness_no_longer_warning"
  | "warning_reason_codes_changed";
export type SystemCheckLaunchApprovalExpirationReasonCodeDto = "time_elapsed";
export type SystemCheckEvidenceHoldReasonCodeDto = string;
export type SystemCheckEvidenceRetentionStateDto = "retained" | "held" | "purged";
export type SystemCheckEvidenceHoldAcknowledgementStatusDto =
  | "not_required"
  | "pending"
  | "acknowledged";
export type SystemCheckEvidenceHoldAssignmentStatusDto = "unassigned" | "assigned";
export type SystemCheckEvidenceHoldSlaStatusDto =
  | "not_applicable"
  | "on_track"
  | "breached"
  | "acknowledged";
export type SystemCheckEvidenceHoldEscalationStatusDto =
  | "not_applicable"
  | "pending"
  | "breached"
  | "acknowledged"
  | "escalated";
export type SystemCheckEvidenceBreachQueueStatusDto =
  | "pending_breach"
  | "breached"
  | "acknowledged"
  | "escalated";
export type SystemCheckEvidenceBreachNotificationChannelDto = "workspace_queue";
export type SystemCheckEvidenceBreachNotificationStatusDto =
  | "pending_acknowledgement"
  | "acknowledged";
export type SystemCheckEvidenceBreachNotificationDeliveryChannelDto =
  | "webhook_spike"
  | "email_spike";
export type SystemCheckEvidenceBreachNotificationDeliveryStatusDto =
  | "pending_delivery"
  | "delivered"
  | "delivery_failed";
export type SystemCheckEvidenceRetentionHistoryEventTypeDto =
  | "captured"
  | "hold_applied"
  | "hold_assigned"
  | "hold_acknowledged"
  | "hold_escalated"
  | "hold_released"
  | "purged";

export interface SystemCheckEvidenceHoldDto {
  heldAt: string;
  holdReasonCode: SystemCheckEvidenceHoldReasonCodeDto;
  holdNote: string;
  heldByActorType: "platform_api" | "participant" | "monitor" | "worker" | "dispatcher";
  heldByActorId: string;
  acknowledgementRequired: boolean;
  acknowledgementStatus: SystemCheckEvidenceHoldAcknowledgementStatusDto;
  acknowledgedAt: string | null;
  acknowledgedByActorId: string | null;
  acknowledgementNote: string | null;
  defaultAssigneeTarget: string | null;
  assignmentStatus: SystemCheckEvidenceHoldAssignmentStatusDto;
  assignedToActorId: string | null;
  assignedByActorId: string | null;
  assignedAt: string | null;
  assignmentNote: string | null;
  slaSeconds: number | null;
  slaDueAt: string | null;
  slaStatus: SystemCheckEvidenceHoldSlaStatusDto;
  escalationTarget: string | null;
  escalationStatus: SystemCheckEvidenceHoldEscalationStatusDto;
  escalatedAt: string | null;
  escalatedByActorId: string | null;
  escalationNote: string | null;
}

export interface SystemCheckEvidenceSummaryDto {
  evidenceKey: string;
  systemCheckKey: string;
  checkKey: string;
  fileName: string;
  contentType: string;
  byteSize: number;
  sha256: string;
  createdAt: string;
  storage: {
    storageBackend: "postgres_inline_spike" | "filesystem_spike" | "s3_compatible_spike";
    retrievalMode: "access_grant_required";
    inlinePayloadAvailable: boolean;
    payloadAvailability: "available" | "purged";
  };
  retention: {
    state: SystemCheckEvidenceRetentionStateDto;
    retentionClass: string;
    retentionPolicyKey: string;
    expiresAt: string | null;
    hold: SystemCheckEvidenceHoldDto | null;
    purgedAt: string | null;
    purgeReasonCode: "retention_elapsed" | null;
  };
}

export interface SystemCheckEvidenceDetailDto extends SystemCheckEvidenceSummaryDto {
  payloadPreviewText: string | null;
}

export interface SystemCheckEvidenceAccessGrantDto {
  accessToken: string;
  evidenceKey: string;
  issuedFor: "participant_capture" | "workspace_review";
  issuedAt: string;
  expiresAt: string;
  retrievalUrl: string;
}

export interface SystemCheckCheckResultInputDto {
  status: SystemCheckResultStatusDto;
  detailMessage: string | null;
  observedValue: string | null;
  evidenceKeys: string[];
}

export interface SystemCheckCheckResultDto extends SystemCheckCheckResultInputDto {
  evidenceItems: SystemCheckEvidenceSummaryDto[];
}

export interface SystemCheckSubmissionSummaryDto {
  totalChecks: number;
  passedChecks: number;
  warningChecks: number;
  failedChecks: number;
}

export interface SystemCheckLaunchCheckReadinessDto {
  systemCheckKey: string;
  systemCheckTitle: string | null;
  readinessStatus: SystemCheckLaunchReadinessStatusDto;
  reasonCodes: SystemCheckLaunchReadinessCodeDto[];
  submissionId: string | null;
  submissionStatus: SystemCheckResultStatusDto | null;
  reviewStatus: SystemCheckReviewStatusDto | null;
  submittedAt: string | null;
  reviewedAt: string | null;
}

export interface SystemCheckLaunchReadinessDto {
  status: SystemCheckLaunchReadinessStatusDto;
  blockingReasonCodes: SystemCheckLaunchReadinessCodeDto[];
  warningReasonCodes: SystemCheckLaunchReadinessCodeDto[];
  checks: SystemCheckLaunchCheckReadinessDto[];
}

export interface SystemCheckSubmissionDto {
  systemCheckSubmissionId: string;
  participantSessionId: string;
  contentReleaseId: string;
  loginKey: string;
  groupKey: string;
  systemCheckKey: string;
  systemCheckTitle: string | null;
  status: SystemCheckResultStatusDto;
  checkResults: Record<string, SystemCheckCheckResultDto>;
  review: {
    reviewStatus: SystemCheckReviewStatusDto;
    reviewNote: string | null;
    reviewedAt: string | null;
    reviewedByActorType: "platform_api" | "participant" | "monitor" | "worker" | "dispatcher" | null;
    reviewedByActorId: string | null;
  };
  summary: SystemCheckSubmissionSummaryDto;
  submittedAt: string;
}

export interface ContentReleaseCanonicalSnapshotDto {
  fixtureKey: string;
  unitKeys: string[];
  bookletDefinitions: ContentReleaseCanonicalBookletDto[];
  loginCollections: ContentReleaseCanonicalLoginCollectionDto[];
  bookletAssignments: ContentReleaseCanonicalAssignmentDto[];
  systemCheckDefinitions: SystemCheckDefinitionDto[];
}

export interface ContentReleaseDetailDto extends ContentReleaseSummaryDto {
  sourcePackageId: string;
  importJobId: string;
  unitCount: number;
}

export interface ContentReleaseDetailResponse {
  contentRelease: ContentReleaseDetailDto;
  sourcePackage: SourcePackageSummaryDto | null;
  importJob: ImportJobSummaryDto | null;
  canonicalSnapshot: ContentReleaseCanonicalSnapshotDto;
}

export interface ContentReleaseMonitorProjectionAssignmentDto {
  assignmentKey: string;
  loginKey: string;
  bookletKey: string;
  bookletTitle: string;
  unitCount: number;
  initialStateOverrides: Record<string, string>;
}

export interface ContentReleaseMonitorProjectionGroupDto {
  collectionKey: string;
  groupKey: string;
  loginKeys: string[];
  assignments: ContentReleaseMonitorProjectionAssignmentDto[];
}

export interface ContentReleaseMonitorProjectionBookletDto {
  bookletKey: string;
  title: string;
  runPolicy: BookletRunPolicyDto;
  unitKeys: string[];
  groupKeys: string[];
  loginKeys: string[];
  assignmentKeys: string[];
}

export interface ContentReleaseMonitorProjectionResponse {
  contentRelease: ContentReleaseDetailDto;
  projection: {
    groups: ContentReleaseMonitorProjectionGroupDto[];
    booklets: ContentReleaseMonitorProjectionBookletDto[];
  };
}

export interface ContentReleaseSystemCheckProjectionResponse {
  contentRelease: ContentReleaseDetailDto;
  projection: {
    systemChecks: SystemCheckDefinitionDto[];
    groupKeys: string[];
    loginKeys: string[];
    loginCount: number;
  };
}

export interface ParticipantAuthSignInRequest {
  tenantKey: string;
  workspaceKey: string;
  loginKey: string;
}

export interface ParticipantAuthSignInResponse {
  loginFlow: {
    state: "authenticated";
    participantSessionToken: string;
    starterContextId: string;
  };
}

export interface ParticipantStarterAssignmentDto {
  assignmentKey: string;
  bookletKey: string;
  bookletTitle: string;
  unitCount: number;
  initialStateOverrides: Record<string, string>;
}

export interface ParticipantStarterResponse {
  participantSessionToken: string;
  starterContextId: string;
  tenantKey: string;
  workspaceKey: string;
  loginKey: string;
  groupKey: string;
  contentReleaseId: string;
  releaseLabel: string;
  systemCheckReadiness: SystemCheckLaunchReadinessDto;
  assignments: ParticipantStarterAssignmentDto[];
}

export interface ParticipantSystemCheckResponse {
  participantSessionToken: string;
  tenantKey: string;
  workspaceKey: string;
  loginKey: string;
  groupKey: string;
  contentReleaseId: string;
  releaseLabel: string;
  systemChecks: SystemCheckDefinitionDto[];
  systemCheckReadiness: SystemCheckLaunchReadinessDto;
  submissions: SystemCheckSubmissionDto[];
}

export interface ParticipantSystemCheckSubmitRequest {
  participantSessionToken: string;
  systemCheckKey: string;
  checkResults: Record<string, SystemCheckCheckResultInputDto>;
}

export interface ParticipantSystemCheckSubmitResponse {
  submission: SystemCheckSubmissionDto;
}

export interface ParticipantSystemCheckEvidenceCaptureRequest {
  participantSessionToken: string;
  systemCheckKey: string;
  checkKey: string;
  fileName: string;
  contentType: string;
  payloadBase64: string;
}

export interface ParticipantSystemCheckEvidenceCaptureResponse {
  evidence: SystemCheckEvidenceDetailDto;
  accessGrant: SystemCheckEvidenceAccessGrantDto;
}

export interface HoldSystemCheckEvidenceRequest {
  heldByActorId: string;
  holdReasonCode: SystemCheckEvidenceHoldReasonCodeDto;
  holdNote: string;
}

export interface HoldSystemCheckEvidenceResponse {
  evidence: SystemCheckEvidenceDetailDto;
}

export interface AcknowledgeSystemCheckEvidenceHoldRequest {
  acknowledgedByActorId: string;
  acknowledgementNote: string;
}

export interface AcknowledgeSystemCheckEvidenceHoldResponse {
  evidence: SystemCheckEvidenceDetailDto;
}

export interface AssignSystemCheckEvidenceHoldRequest {
  assignedByActorId: string;
  assignedToActorId: string;
  assignmentNote?: string | null;
}

export interface AssignSystemCheckEvidenceHoldResponse {
  evidence: SystemCheckEvidenceDetailDto;
}

export interface ReleaseSystemCheckEvidenceHoldRequest {
  releasedByActorId: string;
  releaseNote: string;
}

export interface ReleaseSystemCheckEvidenceHoldResponse {
  evidence: SystemCheckEvidenceDetailDto;
}

export interface ReviewSystemCheckSubmissionRequest {
  reviewStatus: Exclude<SystemCheckReviewStatusDto, "pending">;
  reviewNote?: string | null;
}

export interface ReviewSystemCheckSubmissionResponse {
  submission: SystemCheckSubmissionDto;
}

export interface WorkspaceSystemCheckEvidenceResponse {
  evidence: SystemCheckEvidenceDetailDto;
  accessGrant: SystemCheckEvidenceAccessGrantDto | null;
}

export interface WorkspaceSystemCheckEvidenceHoldQueueItemDto {
  participantSessionId: string;
  contentReleaseId: string;
  loginKey: string;
  groupKey: string;
  evidence: SystemCheckEvidenceSummaryDto;
}

export interface WorkspaceSystemCheckEvidenceHoldQueueResponse {
  items: WorkspaceSystemCheckEvidenceHoldQueueItemDto[];
  filters: {
    groupKey: string | null;
    holdReasonCode: SystemCheckEvidenceHoldReasonCodeDto | null;
    acknowledgementStatus: SystemCheckEvidenceHoldAcknowledgementStatusDto | null;
    assignmentStatus: SystemCheckEvidenceHoldAssignmentStatusDto | null;
    escalationStatus: SystemCheckEvidenceHoldEscalationStatusDto | null;
  };
}

export interface WorkspaceSystemCheckEvidenceBreachQueueItemDto {
  participantSessionId: string;
  contentReleaseId: string;
  loginKey: string;
  groupKey: string;
  breachQueueStatus: SystemCheckEvidenceBreachQueueStatusDto;
  evidence: SystemCheckEvidenceSummaryDto;
}

export interface WorkspaceSystemCheckEvidenceBreachQueueResponse {
  items: WorkspaceSystemCheckEvidenceBreachQueueItemDto[];
  filters: {
    groupKey: string | null;
    escalationTarget: string | null;
    breachQueueStatus: SystemCheckEvidenceBreachQueueStatusDto | null;
    assignedToActorId: string | null;
  };
}

export interface SystemCheckEvidenceBreachNotificationDto {
  notificationId: string;
  participantSessionId: string;
  contentReleaseId: string;
  loginKey: string;
  groupKey: string;
  holdReasonCode: SystemCheckEvidenceHoldReasonCodeDto;
  escalationTarget: string | null;
  assignedToActorId: string | null;
  notificationChannel: SystemCheckEvidenceBreachNotificationChannelDto;
  status: SystemCheckEvidenceBreachNotificationStatusDto;
  createdAt: string;
  createdByActorType: "platform_api" | "participant" | "monitor" | "worker" | "dispatcher";
  createdByActorId: string;
  sourceRequestId: string | null;
  deliveryProfileKey: string | null;
  delivery: {
    channel: SystemCheckEvidenceBreachNotificationDeliveryChannelDto;
    status: SystemCheckEvidenceBreachNotificationDeliveryStatusDto;
    target: string | null;
    attemptCount: number;
    maxAttempts: number;
    nextAttemptAt: string | null;
    lastAttemptAt: string | null;
    receiptId: string | null;
    receiptIssuedAt: string | null;
    deliveredAt: string | null;
    lastError: string | null;
  };
  acknowledgedAt: string | null;
  acknowledgedByActorId: string | null;
  acknowledgementNote: string | null;
  evidence: SystemCheckEvidenceSummaryDto;
}

export interface WorkspaceSystemCheckEvidenceBreachNotificationsResponse {
  items: SystemCheckEvidenceBreachNotificationDto[];
  filters: {
    groupKey: string | null;
    escalationTarget: string | null;
    status: SystemCheckEvidenceBreachNotificationStatusDto | null;
    deliveryStatus: SystemCheckEvidenceBreachNotificationDeliveryStatusDto | null;
    assignedToActorId: string | null;
  };
}

export interface WorkspaceSystemCheckEvidenceBreachDeadLetterQueueResponse {
  items: SystemCheckEvidenceBreachNotificationDto[];
  filters: {
    groupKey: string | null;
    escalationTarget: string | null;
    status: SystemCheckEvidenceBreachNotificationStatusDto | null;
    deliveryChannel: SystemCheckEvidenceBreachNotificationDeliveryChannelDto | null;
    assignedToActorId: string | null;
  };
}

export interface AcknowledgeSystemCheckEvidenceBreachNotificationRequest {
  acknowledgedByActorId: string;
  acknowledgementNote: string;
}

export interface AcknowledgeSystemCheckEvidenceBreachNotificationResponse {
  notification: SystemCheckEvidenceBreachNotificationDto;
}

export interface RedriveSystemCheckEvidenceBreachNotificationRequest {
  redrivenByActorId: string;
  redriveNote: string;
  deliveryTarget?: string | null;
}

export interface RedriveSystemCheckEvidenceBreachNotificationResponse {
  notification: SystemCheckEvidenceBreachNotificationDto;
}

export interface SystemCheckEvidenceRetentionHistoryEntryDto {
  auditEventId: string;
  requestId: string;
  eventType: SystemCheckEvidenceRetentionHistoryEventTypeDto;
  actorType: "platform_api" | "participant" | "monitor" | "worker" | "dispatcher" | "notification_service";
  actorId: string;
  occurredAt: string;
  stateAfter: SystemCheckEvidenceRetentionStateDto;
  details: {
    retentionClass: string | null;
    retentionPolicyKey: string | null;
    retentionExpiresAt: string | null;
    holdReasonCode: SystemCheckEvidenceHoldReasonCodeDto | null;
    holdNote: string | null;
    acknowledgementRequired: boolean | null;
    acknowledgementStatus: SystemCheckEvidenceHoldAcknowledgementStatusDto | null;
    acknowledgedAt: string | null;
    acknowledgedByActorId: string | null;
    acknowledgementNote: string | null;
    defaultAssigneeTarget: string | null;
    assignmentStatus: SystemCheckEvidenceHoldAssignmentStatusDto | null;
    assignedToActorId: string | null;
    assignedByActorId: string | null;
    assignedAt: string | null;
    assignmentNote: string | null;
    slaSeconds: number | null;
    slaDueAt: string | null;
    slaStatus: SystemCheckEvidenceHoldSlaStatusDto | null;
    escalationTarget: string | null;
    escalationStatus: SystemCheckEvidenceHoldEscalationStatusDto | null;
    escalatedAt: string | null;
    escalatedByActorId: string | null;
    escalationNote: string | null;
    purgeReasonCode: "retention_elapsed" | null;
    releaseNote: string | null;
  };
}

export interface WorkspaceSystemCheckEvidenceRetentionHistoryResponse {
  items: SystemCheckEvidenceRetentionHistoryEntryDto[];
}

export interface SystemCheckEvidenceAccessResponse {
  evidence: SystemCheckEvidenceDetailDto;
  accessGrant: SystemCheckEvidenceAccessGrantDto;
  content: {
    payloadBase64: string;
    payloadPreviewText: string | null;
  };
}

export interface WorkspaceSystemCheckResultsResponse {
  items: SystemCheckSubmissionDto[];
  filters: {
    groupKey: string | null;
    status: SystemCheckResultStatusDto | null;
    reviewStatus: SystemCheckReviewStatusDto | null;
  };
}

export interface WorkspaceSystemCheckReadinessItemDto {
  participantSessionId: string;
  contentReleaseId: string;
  loginKey: string;
  groupKey: string;
  releaseLabel: string | null;
  readiness: SystemCheckLaunchReadinessDto;
}

export interface WorkspaceSystemCheckReadinessResponse {
  items: WorkspaceSystemCheckReadinessItemDto[];
  filters: {
    groupKey: string | null;
    readinessStatus: SystemCheckLaunchReadinessStatusDto | null;
  };
}

export interface SystemCheckLaunchApprovalDto {
  launchApprovalId: string;
  participantSessionId: string;
  contentReleaseId: string;
  loginKey: string;
  groupKey: string;
  assignmentKey: string;
  readinessStatus: "warning";
  warningReasonCodes: SystemCheckLaunchReadinessCodeDto[];
  approvalScope: SystemCheckLaunchApprovalScopeDto;
  status: SystemCheckLaunchApprovalStatusDto;
  approvedAt: string;
  approvedBySupervisorId: string;
  approvalNote: string;
  expiresAt: string | null;
  consumedAt: string | null;
  consumedByTestRunId: string | null;
  invalidatedAt: string | null;
  invalidationReasonCode: SystemCheckLaunchApprovalInvalidationReasonCodeDto | null;
  invalidationReasonDetail: string | null;
  expiredAt: string | null;
  expirationReasonCode: SystemCheckLaunchApprovalExpirationReasonCodeDto | null;
  revokedAt: string | null;
  revokedBySupervisorId: string | null;
  revocationNote: string | null;
}

export interface CreateSystemCheckLaunchApprovalRequest {
  participantSessionId: string;
  assignmentKey: string;
  approvalScope: SystemCheckLaunchApprovalScopeDto;
  approvedBySupervisorId: string;
  approvalNote: string;
  expiresAt?: string | null;
}

export interface CreateSystemCheckLaunchApprovalResponse {
  approval: SystemCheckLaunchApprovalDto;
}

export interface RevokeSystemCheckLaunchApprovalRequest {
  revokedBySupervisorId: string;
  revocationNote: string;
}

export interface RevokeSystemCheckLaunchApprovalResponse {
  approval: SystemCheckLaunchApprovalDto;
}

export interface WorkspaceSystemCheckLaunchApprovalsResponse {
  items: SystemCheckLaunchApprovalDto[];
  filters: {
    participantSessionId: string | null;
    assignmentKey: string | null;
    status: SystemCheckLaunchApprovalStatusDto | null;
    approvalScope: SystemCheckLaunchApprovalScopeDto | null;
  };
}

export interface ParticipantStarterLaunchRequest {
  participantSessionToken: string;
  assignmentKey: string;
  resumeBehavior: "resume_or_create" | "create_new";
  launchApprovalId?: string;
}

export interface TestRunPolicyDto {
  navigationLocked: boolean;
  timeLimitSeconds: number | null;
  timeRemainingSeconds: number | null;
  pausedAt: string | null;
}

export interface WorkspaceMonitorTestRunDto {
  testRunId: string;
  participantSessionId: string;
  loginKey: string;
  groupKey: string;
  assignmentKey: string;
  attemptNumber: number;
  bookletKey: string;
  bookletTitle: string;
  status: "active" | "paused" | "completed" | "timed_out";
  currentUnitKey: string;
  currentUnitIndex: number;
  totalUnits: number;
  runPolicy: TestRunPolicyDto;
  createdAt: string;
  updatedAt: string;
}

export interface WorkspaceMonitorTestRunsResponse {
  items: WorkspaceMonitorTestRunDto[];
  filters: {
    groupKey: string | null;
  };
}

export interface WorkspaceAuditEventDto {
  auditEventId: string;
  requestId: string;
  actorType: "platform_api" | "participant" | "monitor" | "worker" | "dispatcher" | "notification_service";
  actorId: string;
  eventType: string;
  participantSessionId: string | null;
  testRunId: string | null;
  loginKey: string | null;
  groupKey: string | null;
  assignmentKey: string | null;
  occurredAt: string;
  payload: Record<string, unknown>;
}

export interface WorkspaceAuditEventsResponse {
  items: WorkspaceAuditEventDto[];
}

export type PolicyHistoryFamilyDto =
  | "activation"
  | "operational"
  | "launch_approval"
  | "notification_provider_promotion"
  | "notification"
  | "notification_provider_profiles"
  | "evidence_retention"
  | "evidence_retention_class";
export type PolicyHistoryScopeDto = "tenant_default" | "workspace_override";
export type PolicyHistoryModeDto = "default" | "inherit" | "override";

export interface PolicyHistoryEntryDto {
  auditEventId: string;
  requestId: string;
  tenantKey: string;
  workspaceKey: string | null;
  actorType: "platform_api" | "participant" | "monitor" | "worker" | "dispatcher" | "notification_service";
  actorId: string;
  eventType: string;
  policyFamily: PolicyHistoryFamilyDto;
  scope: PolicyHistoryScopeDto;
  mode: PolicyHistoryModeDto;
  changedFields: string[];
  clearedFields: string[];
  occurredAt: string;
  defaultActivationPolicy: ContentReleaseActivationPolicyDto | null;
  activationPolicyOverride: ContentReleaseActivationPolicyOverrideDto | null;
  activationPolicyOverrideRecords: ActivationPolicyOverrideRecordsDto | null;
  effectiveActivationPolicy: ContentReleaseActivationPolicyDto | null;
  defaultOperationalPolicy: OperationalPolicyDto | null;
  operationalPolicyOverride: OperationalPolicyOverrideDto | null;
  operationalPolicyOverrideRecords: OperationalPolicyOverrideRecordsDto | null;
  effectiveOperationalPolicy: OperationalPolicyDto | null;
  defaultLaunchApprovalPolicy: LaunchApprovalPolicyDto | null;
  launchApprovalPolicyOverride: LaunchApprovalPolicyOverrideDto | null;
  launchApprovalPolicyOverrideRecords: LaunchApprovalPolicyOverrideRecordsDto | null;
  effectiveLaunchApprovalPolicy: LaunchApprovalPolicyDto | null;
  defaultNotificationProviderPromotionPolicy: NotificationProviderPromotionPolicyDto | null;
  notificationProviderPromotionPolicyOverride: NotificationProviderPromotionPolicyOverrideDto | null;
  notificationProviderPromotionPolicyOverrideRecords: NotificationProviderPromotionPolicyOverrideRecordsDto | null;
  effectiveNotificationProviderPromotionPolicy: NotificationProviderPromotionPolicyDto | null;
  defaultNotificationPolicy: NotificationPolicyDto | null;
  notificationPolicyOverride: NotificationPolicyOverrideDto | null;
  notificationPolicyOverrideRecords: NotificationPolicyOverrideRecordsDto | null;
  effectiveNotificationPolicy: NotificationPolicyDto | null;
  defaultNotificationProviderProfiles: NotificationProviderProfileDto[] | null;
  notificationProviderProfileOverride: NotificationProviderProfileDto[] | null;
  removedNotificationProviderProfileKeys: string[] | null;
  notificationProviderProfileOverrideRecords: NotificationProviderProfileOverrideRecordDto[] | null;
  effectiveNotificationProviderProfiles: NotificationProviderProfileDto[] | null;
  defaultEvidenceRetentionPolicy: EvidenceRetentionPolicyDto | null;
  evidenceRetentionPolicyOverride: EvidenceRetentionPolicyOverrideDto | null;
  evidenceRetentionPolicyOverrideRecords: EvidenceRetentionPolicyOverrideRecordsDto | null;
  effectiveEvidenceRetentionPolicy: EvidenceRetentionPolicyDto | null;
  defaultEvidenceRetentionClassPolicy: EvidenceRetentionClassPolicyDto | null;
  evidenceRetentionClassPolicyOverride: EvidenceRetentionClassPolicyOverrideDto | null;
  evidenceRetentionClassPolicyOverrideRecords: EvidenceRetentionClassPolicyOverrideRecordsDto | null;
  effectiveEvidenceRetentionClassPolicy: EvidenceRetentionClassPolicyDto | null;
}

export interface PolicyHistoryResponse {
  items: PolicyHistoryEntryDto[];
}

export interface ImportJobDiagnosticStageDto {
  stageKey: string;
  status: "completed" | "failed";
  eventType: string;
  occurredAt: string;
  message: string;
}

export interface ImportJobDiagnosticSourceManifestDto {
  importerKey: string;
  formatFamily: string;
  sourceSchemaVersion: string;
  fileName: string;
  manifestHash: string;
  declaredUnitKeys: string[];
  declaredBookletKeys: string[];
  declaredGroupKeys: string[];
  declaredLoginCount: number;
}

export interface ImportJobDiagnosticSourceModelDto {
  importerKey: string;
  fixtureKey: string;
  releaseLabel: string;
  unitCount: number;
  bookletCount: number;
  loginCollectionCount: number;
  groupCount: number;
  loginCount: number;
  assignmentCount: number;
  bookletKeys: string[];
  groupKeys: string[];
  assignmentKeys: string[];
}

export interface ImportJobDiagnosticCanonicalSummaryDto {
  fixtureKey: string;
  unitCount: number;
  bookletCount: number;
  loginCount: number;
  assignmentCount: number;
}

export interface ImportJobEntityReferenceDto {
  entityKind: "unit" | "booklet" | "login_collection" | "booklet_assignment";
  identifier: string;
  path: string | null;
}

export interface ImportJobReferenceMappingDto {
  mappingKey: string;
  source: ImportJobEntityReferenceDto;
  canonical: ImportJobEntityReferenceDto | null;
}

export interface ImportJobValidationIssueDto {
  code: string;
  severity: "error" | "warning";
  scope: "source_package" | "source_model" | "canonical_snapshot";
  path: string | null;
  message: string;
  mappingKeys: string[];
}

export interface ImportJobDiagnosticFailureDto {
  failedStage: string;
  failureMessage: string;
  validationIssues: ImportJobValidationIssueDto[];
  eventType: string;
  occurredAt: string;
}

export interface ImportJobDetailResponse {
  importJob: ImportJobSummaryDto;
  sourcePackage: SourcePackageSummaryDto | null;
  contentRelease: ContentReleaseSummaryDto | null;
  diagnostics: {
    stages: ImportJobDiagnosticStageDto[];
    artifacts: {
      importerKey: string | null;
      sourceManifest: ImportJobDiagnosticSourceManifestDto | null;
      sourceModel: ImportJobDiagnosticSourceModelDto | null;
      canonicalSummary: ImportJobDiagnosticCanonicalSummaryDto | null;
      referenceMappings: ImportJobReferenceMappingDto[];
    };
    failure: ImportJobDiagnosticFailureDto | null;
  };
  auditTrail: WorkspaceAuditEventDto[];
}

export interface MonitorCommandDto {
  commandId: string;
  requestId: string;
  commandType: "pause" | "resume" | "unlock_navigation";
  ackState: MonitorCommandAckState;
  actorId: string;
  testRunId: string;
  participantSessionId: string;
  loginKey: string;
  groupKey: string;
  assignmentKey: string;
  attemptNumber: number;
  issuedAt: string;
  deliveredAt: string | null;
  resolvedAt: string | null;
  rejectionReason: string | null;
}

export interface WorkspaceMonitorCommandsResponse {
  items: MonitorCommandDto[];
  filters: {
    testRunId: string | null;
    ackState: MonitorCommandAckState | null;
  };
}

export interface ParticipantStarterLaunchResponse {
  testRunId: string;
  launchDisposition: "created" | "resumed";
  attemptNumber: number;
  status: "active" | "paused" | "completed" | "timed_out";
  participantSessionToken: string;
  assignmentKey: string;
  bookletKey: string;
  bookletTitle: string;
  currentUnitKey: string;
  currentUnitIndex: number;
  totalUnits: number;
  runPolicy: TestRunPolicyDto;
  systemCheckReadiness: SystemCheckLaunchReadinessDto;
  launchAuthorization: {
    launchApprovalId: string | null;
    approvalScope: SystemCheckLaunchApprovalScopeDto | null;
    approvalApplied: boolean;
    approvedBySupervisorId: string | null;
    approvalNote: string | null;
    approvedAt: string | null;
  };
}

export interface ParticipantTestRunResponse {
  testRunId: string;
  attemptNumber: number;
  participantSessionToken: string;
  contentReleaseId: string;
  loginKey: string;
  groupKey: string;
  assignmentKey: string;
  bookletKey: string;
  bookletTitle: string;
  status: "active" | "paused" | "completed" | "timed_out";
  currentUnitKey: string;
  currentUnitIndex: number;
  totalUnits: number;
  unitSequence: string[];
  initialStateOverrides: Record<string, string>;
  unitResponses: Record<string, unknown>;
  runPolicy: TestRunPolicyDto;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

export interface ParticipantTestRunSaveRequest {
  participantSessionToken: string;
  unitKey: string;
  response: unknown;
}

export interface ParticipantTestRunNextUnitRequest {
  participantSessionToken: string;
}

export interface ParticipantTestRunNavigationRequest {
  participantSessionToken: string;
  targetUnitKey: string;
}

export interface MonitorTestRunCommandResponse {
  command: MonitorCommandDto;
  testRun: WorkspaceMonitorTestRunDto;
}

export const createHealthResponse = (
  service: HealthResponse["service"]
): HealthResponse => ({
  status: "ok",
  service
});
