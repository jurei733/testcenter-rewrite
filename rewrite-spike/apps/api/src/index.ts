import { randomUUID } from "node:crypto";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";

import {
  apiRoutes,
  type ActivationPolicyOverrideRecordsDto,
  type BooleanPolicyOverrideRecordDto,
  type BookletRunPolicyDto,
  type ContentReleaseActivationPolicyDto,
  type ContentReleaseActivationPolicyOverrideDto,
  type ContentReleaseDetailDto,
  type ContentReleaseDetailResponse,
  type ContentReleaseMonitorProjectionResponse,
  type ContentReleaseSystemCheckProjectionResponse,
  createHealthResponse,
  type ContentReleaseSummaryDto,
  type CreateImportJobRequest,
  type EvidenceRetentionClassPolicyDto,
  type EvidenceRetentionClassPolicyEntryDto,
  type EvidenceRetentionClassPolicyEntryOverrideRecordDto,
  type EvidenceRetentionClassPolicyOverrideDto,
  type EvidenceRetentionClassPolicyOverrideRecordDto,
  type EvidenceRetentionClassPolicyOverrideRecordsDto,
  type EvidenceRetentionPolicyDto,
  type EvidenceRetentionPolicyOverrideDto,
  type EvidenceRetentionPolicyOverrideRecordsDto,
  type AssignSystemCheckEvidenceHoldRequest,
  type AssignSystemCheckEvidenceHoldResponse,
  type AcknowledgeSystemCheckEvidenceHoldRequest,
  type AcknowledgeSystemCheckEvidenceHoldResponse,
  type AcknowledgeSystemCheckEvidenceBreachNotificationRequest,
  type AcknowledgeSystemCheckEvidenceBreachNotificationResponse,
  type AcknowledgeNotificationProviderProfileIncidentRequest,
  type AcknowledgeNotificationProviderProfileIncidentResponse,
  type AcknowledgeNotificationProviderProfileGovernanceAlertRequest,
  type AcknowledgeNotificationProviderProfileGovernanceAlertResponse,
  type RedriveNotificationProviderProfileGovernanceAlertRequest,
  type RedriveNotificationProviderProfileGovernanceAlertResponse,
  type RedriveSystemCheckEvidenceBreachNotificationRequest,
  type RedriveSystemCheckEvidenceBreachNotificationResponse,
  type HoldSystemCheckEvidenceRequest,
  type HoldSystemCheckEvidenceResponse,
  type CreateSourcePackageRequest,
  type CreateTenantRequest,
  type CreateWorkspaceRequest,
  type ErrorResponse,
  type HealthResponse,
  type ImportJobDetailResponse,
  type ImportJobSummaryDto,
  type LaunchApprovalPolicyDto,
  type LaunchApprovalPolicyOverrideDto,
  type LaunchApprovalPolicyOverrideRecordsDto,
  monitorCommandAckStates,
  type MonitorTestRunCommandResponse,
  type MonitorCommandDto,
  type NotificationProviderPromotionPolicyDto,
  type NotificationProviderPromotionPolicyOverrideDto,
  type NotificationProviderPromotionPolicyOverrideRecordsDto,
  type NotificationPolicyDto,
  type NotificationPolicyOverrideDto,
  type NotificationPolicyOverrideRecordsDto,
  type NotificationProviderProfileInputDto,
  type NotificationProviderProfileDto,
  type NotificationProviderProfileGovernanceQueueItemDto,
  type NotificationProviderProfileGovernanceAlertDto,
  type NotificationProviderProfileGovernanceAlertStatusDto,
  type NotificationProviderProfileGovernanceStatusDto,
  type NotificationProviderProfileIncidentDto,
  type NotificationProviderProfileIncidentStatusDto,
  type NotificationProviderProfileOverrideRecordDto,
  type NotificationProviderProfileRolloutMetricsItemDto,
  type PromoteWorkspaceNotificationProviderProfileRequest,
  type PromoteWorkspaceNotificationProviderProfileResponse,
  type NumericPolicyOverrideRecordDto,
  type OperationalPolicyDto,
  type OperationalPolicyOverrideDto,
  type OperationalPolicyOverrideRecordsDto,
  type ParticipantAuthSignInRequest,
  type ParticipantAuthSignInResponse,
  type ParticipantStarterAssignmentDto,
  type ParticipantSystemCheckEvidenceCaptureRequest,
  type ParticipantSystemCheckEvidenceCaptureResponse,
  type CreateSystemCheckLaunchApprovalRequest,
  type CreateSystemCheckLaunchApprovalResponse,
  type RevokeSystemCheckLaunchApprovalRequest,
  type RevokeSystemCheckLaunchApprovalResponse,
  type ReleaseSystemCheckEvidenceHoldRequest,
  type ReleaseSystemCheckEvidenceHoldResponse,
  type ParticipantStarterLaunchRequest,
  type ParticipantStarterLaunchResponse,
  type ReviewSystemCheckSubmissionRequest,
  type ReviewSystemCheckSubmissionResponse,
  type SystemCheckCheckResultDto,
  type SystemCheckCheckResultInputDto,
  type SystemCheckEvidenceAccessGrantDto,
  type SystemCheckEvidenceAccessResponse,
  type SystemCheckEvidenceBreachNotificationDeliveryChannelDto,
  type SystemCheckEvidenceBreachNotificationDeliveryStatusDto,
  type SystemCheckEvidenceBreachNotificationDto,
  type SystemCheckEvidenceBreachNotificationStatusDto,
  type SystemCheckEvidenceBreachQueueStatusDto,
  type SystemCheckEvidenceHoldAcknowledgementStatusDto,
  type SystemCheckEvidenceHoldAssignmentStatusDto,
  type SystemCheckEvidenceRetentionClassRuleDto,
  type SystemCheckEvidenceDetailDto,
  type SystemCheckEvidenceHoldEscalationStatusDto,
  type SystemCheckEvidenceHoldDto,
  type SystemCheckEvidenceRetentionHistoryEntryDto,
  type SystemCheckEvidenceRetentionHistoryEventTypeDto,
  type SystemCheckEvidenceSummaryDto,
  type SystemCheckLaunchApprovalDto,
  type SystemCheckLaunchApprovalInvalidationReasonCodeDto,
  type SystemCheckLaunchApprovalScopeDto,
  type SystemCheckLaunchApprovalStatusDto,
  type SystemCheckLaunchCheckReadinessDto,
  type SystemCheckLaunchReadinessDto,
  type SystemCheckLaunchReadinessStatusDto,
  type ParticipantSystemCheckSubmitRequest,
  type ParticipantSystemCheckSubmitResponse,
  type ParticipantSystemCheckResponse,
  type ParticipantTestRunNavigationRequest,
  type PolicyHistoryEntryDto,
  type PolicyHistoryResponse,
  type ParticipantStarterResponse,
  type ParticipantTestRunNextUnitRequest,
  type ParticipantTestRunSaveRequest,
  type ParticipantTestRunResponse,
  type SourcePackageSummaryDto,
  type SystemCheckDefinitionDto,
  type SystemCheckReviewStatusDto,
  type SystemCheckSubmissionDto,
  type SystemCheckResultStatusDto,
  type TenantSummaryDto,
  type TenantActivationPolicyResponse,
  type TenantEvidenceRetentionClassPolicyResponse,
  type TenantEvidenceRetentionPolicyResponse,
  type TenantLaunchApprovalPolicyResponse,
  type TenantGovernanceNotificationPolicyResponse,
  type TenantRecoveryGovernanceNotificationPolicyResponse,
  type TenantNotificationProviderPromotionPolicyResponse,
  type TenantNotificationPolicyResponse,
  type TenantNotificationProviderProfilesResponse,
  type TenantOperationalPolicyResponse,
  type TestRunPolicyDto,
  type UpdateTenantActivationPolicyRequest,
  type UpdateTenantEvidenceRetentionClassPolicyRequest,
  type UpdateTenantEvidenceRetentionPolicyRequest,
  type UpdateTenantLaunchApprovalPolicyRequest,
  type UpdateTenantGovernanceNotificationPolicyRequest,
  type UpdateTenantRecoveryGovernanceNotificationPolicyRequest,
  type UpdateTenantNotificationProviderPromotionPolicyRequest,
  type UpdateTenantNotificationPolicyRequest,
  type UpdateTenantNotificationProviderProfilesRequest,
  type UpdateTenantOperationalPolicyRequest,
  type UpdateWorkspaceActivationPolicyRequest,
  type UpdateWorkspaceEvidenceRetentionClassPolicyRequest,
  type UpdateWorkspaceEvidenceRetentionPolicyRequest,
  type UpdateWorkspaceLaunchApprovalPolicyRequest,
  type UpdateWorkspaceGovernanceNotificationPolicyRequest,
  type UpdateWorkspaceRecoveryGovernanceNotificationPolicyRequest,
  type UpdateWorkspaceNotificationProviderPromotionPolicyRequest,
  type UpdateWorkspaceNotificationPolicyRequest,
  type UpdateWorkspaceNotificationProviderProfilesRequest,
  type UpdateWorkspaceOperationalPolicyRequest,
  type WorkspaceAuditEventDto,
  type WorkspaceAuditEventsResponse,
  type WorkspaceActivationPolicyResponse,
  type WorkspaceActivationPolicyModeDto,
  type WorkspaceEvidenceRetentionPolicyModeDto,
  type WorkspaceEvidenceRetentionPolicyResponse,
  type WorkspaceEvidenceRetentionClassesResponse,
  type WorkspaceEvidenceRetentionClassPolicyModeDto,
  type WorkspaceEvidenceRetentionClassPolicyResponse,
  type WorkspaceLaunchApprovalPolicyModeDto,
  type WorkspaceLaunchApprovalPolicyResponse,
  type WorkspaceGovernanceNotificationPolicyModeDto,
  type WorkspaceGovernanceNotificationPolicyResponse,
  type WorkspaceRecoveryGovernanceNotificationPolicyModeDto,
  type WorkspaceRecoveryGovernanceNotificationPolicyResponse,
  type WorkspaceNotificationProviderPromotionPolicyModeDto,
  type WorkspaceNotificationProviderPromotionPolicyResponse,
  type WorkspaceMonitorCommandsResponse,
  type WorkspaceMonitorTestRunDto,
  type WorkspaceMonitorTestRunsResponse,
  type WorkspaceOperationalPolicyModeDto,
  type WorkspaceOperationalPolicyResponse,
  type WorkspaceNotificationPolicyModeDto,
  type WorkspaceNotificationPolicyResponse,
  type WorkspaceNotificationProviderProfileRolloutMetricsResponse,
  type WorkspaceNotificationProviderProfileIncidentsResponse,
  type WorkspaceNotificationProviderProfileGovernanceQueueResponse,
  type WorkspaceNotificationProviderProfileGovernanceAlertsResponse,
  type WorkspaceNotificationProviderProfileGovernanceAlertMetricsResponse,
  type WorkspaceNotificationProviderProfileGovernanceAlertTrendsResponse,
  type WorkspaceNotificationProviderProfileGovernanceCorrelationsResponse,
  type WorkspaceNotificationProviderProfileGovernanceCasesResponse,
  type WorkspaceNotificationProviderProfileGovernanceCaseQueueResponse,
  type NotificationProviderProfileGovernanceCaseStatusDto,
  type NotificationProviderProfileGovernanceCaseSlaStatusDto,
  type AssignNotificationProviderProfileGovernanceCaseRequest,
  type AssignNotificationProviderProfileGovernanceCaseResponse,
  type EscalateNotificationProviderProfileGovernanceCaseRequest,
  type EscalateNotificationProviderProfileGovernanceCaseResponse,
  type WorkspaceNotificationProviderProfileGovernanceAlertDeadLetterQueueResponse,
  type WorkspaceNotificationProviderProfilesModeDto,
  type WorkspaceNotificationProviderProfilesResponse,
  type WorkspaceSystemCheckEvidenceResponse,
  type WorkspaceSystemCheckEvidenceBreachQueueItemDto,
  type WorkspaceSystemCheckEvidenceBreachQueueResponse,
  type WorkspaceSystemCheckEvidenceBreachDeadLetterQueueResponse,
  type WorkspaceSystemCheckEvidenceBreachNotificationsResponse,
  type WorkspaceSystemCheckEvidenceHoldQueueItemDto,
  type WorkspaceSystemCheckEvidenceHoldQueueResponse,
  type WorkspaceSystemCheckEvidenceRetentionHistoryResponse,
  type WorkspaceSystemCheckLaunchApprovalsResponse,
  type WorkspaceSystemCheckReadinessResponse,
  type WorkspaceSystemCheckResultsResponse,
  type WorkspaceSummaryDto
} from "@testcenter-rewrite/contracts";
import {
  createDatabasePool,
  createPostgresPlatformStore,
  defaultDatabaseUrl,
  type PlatformStore
} from "@testcenter-rewrite/db";
import {
  persistSystemCheckEvidencePayload,
  readSystemCheckEvidenceBlob
} from "@testcenter-rewrite/evidence-storage";
import {
  haveSameOutboundNotificationProviderProfileConfiguration,
  isOutboundNotificationProviderProfilePromotionSuppressed,
  isValidOutboundNotificationCredentialsRef,
  maskOutboundNotificationCredentialsRef,
  resolveOutboundNotificationProviderProfileCredentialsStatus,
  resolveOutboundNotificationProviderProfileHealthStatus
} from "@testcenter-rewrite/outbound-messaging";
import {
  createAuditEvent,
  createActivationPolicyOverrideRecords,
  createEvidenceRetentionClassPolicyOverrideRecords,
  createEvidenceRetentionPolicyOverrideRecords,
  createImportJob,
  createLaunchApprovalPolicyOverrideRecords,
  createMonitorCommand,
  createNotificationProviderPromotionPolicyOverrideRecords,
  createNotificationProviderProfileIncident,
  createNotificationProviderProfileGovernanceRecoveryAlert,
  createNotificationPolicyOverrideRecords,
  createNotificationProviderProfileOverrideRecords,
  createOperationalPolicyOverrideRecords,
  createParticipantSession,
  createSourcePackage,
  createSystemCheckEvidenceAccessGrant,
  createSystemCheckEvidenceBreachNotification,
  createSystemCheckEvidence,
  createSystemCheckLaunchApproval,
  createSystemCheckSubmission,
  createTenant,
  createTestRun,
  createWorkspace,
  assignSystemCheckEvidenceRetentionHold,
  acknowledgeSystemCheckEvidenceBreachNotification,
  acknowledgeSystemCheckEvidenceRetentionHold,
  advanceTestRunToNextUnit,
  applySystemCheckEvidenceRetentionHold,
  buildSystemCheckEvidenceRetentionClassRules,
  buildContentReleaseMonitorProjection,
  buildContentReleaseSystemCheckProjection,
  compareContentReleaseToPrevious,
  escalateSystemCheckEvidenceRetentionHold,
  expireSystemCheckLaunchApproval,
  evaluateContentReleaseActivationGuardrail,
  flattenEvidenceRetentionClassPolicyOverrideRecords,
  flattenEvidenceRetentionPolicyOverrideRecords,
  flattenActivationPolicyOverrideRecords,
  flattenLaunchApprovalPolicyOverrideRecords,
  flattenNotificationProviderPromotionPolicyOverrideRecords,
  flattenRemovedNotificationProviderProfileKeys,
  flattenNotificationPolicyOverrideRecords,
  flattenNotificationProviderProfileOverrideRecords,
  flattenOperationalPolicyOverrideRecords,
  type ContentRelease,
  evaluateSystemCheckLaunchReadiness,
  expireTestRunIfNeeded,
  type EvidenceRetentionClassPolicyEntry,
  getSystemCheckEvidencePayloadAvailability,
  getSystemCheckEvidencePreviewText,
  getSystemCheckEvidenceBreachQueueStatus,
  getSystemCheckEvidenceHoldAcknowledgementStatus,
  getSystemCheckEvidenceHoldAssignmentStatus,
  getSystemCheckEvidenceHoldEscalationStatus,
  getSystemCheckEvidenceHoldSlaStatus,
  getSystemCheckEvidenceRetentionState,
  getTimeRemainingSeconds,
  getSystemCheckDefinition,
  type ImportJob,
  isSystemCheckEvidenceAccessGrantExpired,
  isSystemCheckEvidenceHeld,
  isOpenTestRun,
  markSystemCheckEvidenceAccessGrantAccessed,
  acknowledgeNotificationProviderProfileGovernanceAlert,
  navigateTestRunToUnit,
  consumeSystemCheckLaunchApproval,
  invalidateSystemCheckLaunchApproval,
  revokeSystemCheckLaunchApproval,
  reviewSystemCheckSubmission,
  releaseSystemCheckEvidenceRetentionHold,
  resolveSystemCheckEvidenceRetentionClassRule,
  resolveSystemCheckEvidenceHoldTargetRule,
  resolveWorkspaceEvidenceRetentionClassPolicy,
  resolveWorkspaceEvidenceRetentionPolicy,
  redriveSystemCheckEvidenceBreachNotification,
  redriveNotificationProviderProfileGovernanceAlert,
  resolveWorkspaceNotificationProviderPromotionPolicy,
  resolveWorkspaceGovernanceNotificationPolicy,
  resolveWorkspaceRecoveryGovernanceNotificationPolicy,
  resolveWorkspaceNotificationPolicy,
  resolveWorkspaceNotificationProviderProfiles,
  resolveWorkspaceOperationalPolicy,
  resolveWorkspaceActivationPolicy,
  resolveWorkspaceLaunchApprovalPolicy,
  resolveParticipantStarterContext,
  saveTestRunUnitResponse,
  type EvidenceRetentionClassPolicy,
  type EvidenceRetentionPolicy,
  type LaunchApprovalPolicy,
  type NotificationProviderPromotionPolicy,
  type NotificationPolicy,
  type NotificationProviderProfile,
  type NotificationProviderProfileGovernanceAlert,
  type NotificationProviderProfileIncident,
  type StarterAssignment,
  type SourcePackage,
  type SystemCheckEvidence,
  type SystemCheckEvidenceAccessGrant,
  type SystemCheckLaunchApproval,
  type SystemCheckLaunchApprovalExpirationReasonCode,
  type SystemCheckLaunchApprovalInvalidationReasonCode,
  summarizeSystemCheckResults,
  type SystemCheckSubmission,
  type OperationalPolicy,
  type PolicyOverrideRecord,
  type Tenant,
  type TestRun,
  type MonitorCommand,
  type Workspace
} from "@testcenter-rewrite/domain";

const jsonContentType = {
  "content-type": "application/json; charset=utf-8"
};
const maxSystemCheckEvidenceBytes = 256 * 1024;
const systemCheckEvidenceAccessGrantTtlSeconds = 300;

const tenantWorkspaceRoutePattern = /^\/api\/v1\/tenants\/([^/]+)\/workspaces$/;
const workspaceActivationPolicyRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/activation-policy$/;
const workspaceOperationalPolicyRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/operational-policy$/;
const workspaceLaunchApprovalPolicyRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/launch-approval-policy$/;
const workspaceNotificationProviderPromotionPolicyRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/notification-provider-promotion-policy$/;
const workspaceNotificationPolicyRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/notification-policy$/;
const workspaceGovernanceNotificationPolicyRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/governance-notification-policy$/;
const workspaceRecoveryGovernanceNotificationPolicyRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/recovery-governance-notification-policy$/;
const workspaceNotificationProviderProfilesRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/notification-provider-profiles$/;
const workspaceNotificationProviderProfileRolloutMetricsRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/notification-provider-profile-rollout-metrics$/;
const workspaceNotificationProviderProfilePromoteRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/notification-provider-profiles\/([^/]+):promote$/;
const workspaceNotificationProviderProfileIncidentsRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/notification-provider-profile-incidents$/;
const workspaceNotificationProviderProfileGovernanceQueueRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/notification-provider-profile-governance-queue$/;
const workspaceNotificationProviderProfileGovernanceAlertsRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/notification-provider-profile-governance-alerts$/;
const workspaceNotificationProviderProfileGovernanceAlertMetricsRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/notification-provider-profile-governance-alert-metrics$/;
const workspaceNotificationProviderProfileGovernanceAlertTrendsRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/notification-provider-profile-governance-alert-trends$/;
const workspaceNotificationProviderProfileGovernanceCorrelationsRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/notification-provider-profile-governance-correlations$/;
const workspaceNotificationProviderProfileGovernanceCasesRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/notification-provider-profile-governance-cases$/;
const workspaceNotificationProviderProfileGovernanceCaseQueueRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/notification-provider-profile-governance-case-queue$/;
const workspaceNotificationProviderProfileGovernanceCaseAssignRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/notification-provider-profile-governance-cases\/([^/]+):assign$/;
const workspaceNotificationProviderProfileGovernanceCaseEscalateRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/notification-provider-profile-governance-cases\/([^/]+):escalate$/;
const workspaceNotificationProviderProfileGovernanceAlertDeadLetterQueueRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/notification-provider-profile-governance-alert-dead-letter-queue$/;
const workspaceNotificationProviderProfileIncidentAcknowledgeRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/notification-provider-profile-incidents\/([^/]+):acknowledge$/;
const workspaceNotificationProviderProfileGovernanceAlertAcknowledgeRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/notification-provider-profile-governance-alerts\/([^/]+):acknowledge$/;
const workspaceNotificationProviderProfileGovernanceAlertRedriveRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/notification-provider-profile-governance-alerts\/([^/]+):redrive$/;
const workspaceEvidenceRetentionPolicyRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/evidence-retention-policy$/;
const workspaceEvidenceRetentionClassPolicyRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/evidence-retention-class-policy$/;
const workspaceEvidenceRetentionClassesRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/evidence-retention-classes$/;
const workspacePolicyHistoryRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/policy-history$/;
const workspaceSystemCheckResultsRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/system-check-results$/;
const workspaceSystemCheckReadinessRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/system-check-readiness$/;
const workspaceSystemCheckEvidenceHoldQueueRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/system-check-evidence-hold-queue$/;
const workspaceSystemCheckEvidenceBreachQueueRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/system-check-evidence-breach-queue$/;
const workspaceSystemCheckEvidenceBreachDeadLetterQueueRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/system-check-evidence-breach-dead-letter-queue$/;
const workspaceSystemCheckEvidenceBreachNotificationsRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/system-check-evidence-breach-notifications$/;
const workspaceSystemCheckLaunchApprovalsRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/system-check-launch-approvals$/;
const workspaceSystemCheckLaunchApprovalRevokeRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/system-check-launch-approvals\/([^/]+):revoke$/;
const workspaceSystemCheckEvidenceHoldRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/system-check-evidence\/([^/]+):hold$/;
const workspaceSystemCheckEvidenceAcknowledgeHoldRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/system-check-evidence\/([^/]+):acknowledge-hold$/;
const workspaceSystemCheckEvidenceBreachNotificationAcknowledgeRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/system-check-evidence-breach-notifications\/([^/]+):acknowledge$/;
const workspaceSystemCheckEvidenceBreachNotificationRedriveRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/system-check-evidence-breach-notifications\/([^/]+):redrive$/;
const workspaceSystemCheckEvidenceAssignHoldRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/system-check-evidence\/([^/]+):assign-hold$/;
const workspaceSystemCheckEvidenceReleaseHoldRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/system-check-evidence\/([^/]+):release-hold$/;
const workspaceSystemCheckEvidenceRetentionHistoryRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/system-check-evidence\/([^/]+)\/retention-history$/;
const workspaceSystemCheckEvidenceRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/system-check-evidence\/([^/]+)$/;
const workspaceSystemCheckResultReviewRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/system-check-results\/([^/]+):review$/;
const workspaceAuditEventsRoutePattern = /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/audit-events$/;
const workspaceMonitorCommandsRoutePattern = /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/monitor\/commands$/;
const workspaceMonitorTestRunsRoutePattern = /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/monitor\/test-runs$/;
const monitorTestRunPauseRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/monitor\/test-runs\/([^/]+):pause$/;
const monitorTestRunResumeRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/monitor\/test-runs\/([^/]+):resume$/;
const monitorTestRunUnlockRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/monitor\/test-runs\/([^/]+):unlock$/;
const sourcePackagesRoutePattern = /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/source-packages$/;
const importJobsRoutePattern = /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/import-jobs$/;
const importJobRoutePattern = /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/import-jobs\/([^/:]+)$/;
const contentReleasesRoutePattern = /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/content-releases$/;
const contentReleaseRoutePattern = /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/content-releases\/([^/:]+)$/;
const contentReleaseMonitorProjectionRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/content-releases\/([^/]+)\/monitor-projection$/;
const contentReleaseSystemCheckProjectionRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/content-releases\/([^/]+)\/system-check-projection$/;

const resolveSystemCheckEvidenceRetentionExpiresAt = (
  workspace: Workspace,
  tenant: Tenant,
  retentionClass: SystemCheckEvidence["retentionClass"],
  createdAt: string
): string | null => {
  const policy = resolveWorkspaceEvidenceRetentionPolicy(workspace, tenant);
  const classPolicy = resolveWorkspaceEvidenceRetentionClassPolicy(workspace, tenant);
  const ttlSeconds = resolveSystemCheckEvidenceRetentionClassRule(
    policy,
    classPolicy,
    retentionClass
  ).ttlSeconds;

  return ttlSeconds > 0
    ? new Date(
        Date.parse(createdAt) + ttlSeconds * 1000
      ).toISOString()
    : null;
};

const resolveSystemCheckEvidenceHoldSlaDueAt = (
  heldAt: string,
  slaSeconds: number | null
): string | null =>
  typeof slaSeconds === "number" && slaSeconds > 0
    ? new Date(Date.parse(heldAt) + slaSeconds * 1000).toISOString()
    : null;

const toSystemCheckEvidenceHoldAuditPayload = (
  retentionHold: SystemCheckEvidence["retentionHold"]
): Record<string, unknown> => ({
  holdReasonCode: retentionHold?.holdReasonCode ?? null,
  holdNote: retentionHold?.holdNote ?? null,
  acknowledgementRequired: retentionHold?.acknowledgementRequired ?? null,
  acknowledgementStatus: retentionHold
    ? getSystemCheckEvidenceHoldAcknowledgementStatus(retentionHold)
    : null,
  acknowledgedAt: retentionHold?.acknowledgedAt ?? null,
  acknowledgedByActorId: retentionHold?.acknowledgedByActorId ?? null,
  acknowledgementNote: retentionHold?.acknowledgementNote ?? null,
  defaultAssigneeTarget: retentionHold?.defaultAssigneeTarget ?? null,
  assignmentStatus: retentionHold
    ? getSystemCheckEvidenceHoldAssignmentStatus(retentionHold)
    : null,
  assignedToActorId: retentionHold?.assignedToActorId ?? null,
  assignedByActorId: retentionHold?.assignedByActorId ?? null,
  assignedAt: retentionHold?.assignedAt ?? null,
  assignmentNote: retentionHold?.assignmentNote ?? null,
  slaSeconds: retentionHold?.slaSeconds ?? null,
  slaDueAt: retentionHold?.slaDueAt ?? null,
  slaStatus: retentionHold ? getSystemCheckEvidenceHoldSlaStatus(retentionHold) : null,
  escalationTarget: retentionHold?.escalationTarget ?? null,
  escalationStatus: retentionHold
    ? getSystemCheckEvidenceHoldEscalationStatus(retentionHold)
    : null,
  escalatedAt: retentionHold?.escalatedAt ?? null,
  escalatedByActorId: retentionHold?.escalatedByActorId ?? null,
  escalationNote: retentionHold?.escalationNote ?? null
});
const contentReleaseActivateRoutePattern =
  /^\/api\/v1\/tenants\/([^/]+)\/workspaces\/([^/]+)\/content-releases\/([^/]+):activate$/;
const participantSystemCheckRoutePattern = /^\/api\/v1\/participant\/system-check$/;
const participantSystemCheckEvidenceCaptureRoutePattern = /^\/api\/v1\/participant\/system-check-evidence$/;
const participantSystemCheckSubmitRoutePattern = /^\/api\/v1\/participant\/system-check:submit$/;
const systemCheckEvidenceAccessRoutePattern = /^\/api\/v1\/system-check-evidence-access\/([^/]+)$/;
const participantTestRunRoutePattern = /^\/api\/v1\/participant\/test-runs\/([^/]+)$/;
const participantTestRunSaveRoutePattern = /^\/api\/v1\/participant\/test-runs\/([^/]+):save$/;
const participantTestRunNextUnitRoutePattern = /^\/api\/v1\/participant\/test-runs\/([^/]+):request-next-unit$/;
const participantTestRunNavigateRoutePattern =
  /^\/api\/v1\/participant\/test-runs\/([^/]+):request-unit-navigation$/;
const tenantActivationPolicyRoutePattern = /^\/api\/v1\/platform\/tenants\/([^/]+)\/activation-policy$/;
const tenantOperationalPolicyRoutePattern = /^\/api\/v1\/platform\/tenants\/([^/]+)\/operational-policy$/;
const tenantLaunchApprovalPolicyRoutePattern =
  /^\/api\/v1\/platform\/tenants\/([^/]+)\/launch-approval-policy$/;
const tenantNotificationProviderPromotionPolicyRoutePattern =
  /^\/api\/v1\/platform\/tenants\/([^/]+)\/notification-provider-promotion-policy$/;
const tenantNotificationPolicyRoutePattern =
  /^\/api\/v1\/platform\/tenants\/([^/]+)\/notification-policy$/;
const tenantGovernanceNotificationPolicyRoutePattern =
  /^\/api\/v1\/platform\/tenants\/([^/]+)\/governance-notification-policy$/;
const tenantRecoveryGovernanceNotificationPolicyRoutePattern =
  /^\/api\/v1\/platform\/tenants\/([^/]+)\/recovery-governance-notification-policy$/;
const tenantNotificationProviderProfilesRoutePattern =
  /^\/api\/v1\/platform\/tenants\/([^/]+)\/notification-provider-profiles$/;
const tenantEvidenceRetentionPolicyRoutePattern =
  /^\/api\/v1\/platform\/tenants\/([^/]+)\/evidence-retention-policy$/;
const tenantEvidenceRetentionClassPolicyRoutePattern =
  /^\/api\/v1\/platform\/tenants\/([^/]+)\/evidence-retention-class-policy$/;
const tenantPolicyHistoryRoutePattern = /^\/api\/v1\/platform\/tenants\/([^/]+)\/policy-history$/;

const tenantPolicyAuditEventTypes = [
  "tenant.activation_policy.updated",
  "tenant.operational_policy.updated",
  "tenant.launch_approval_policy.updated",
  "tenant.notification_provider_promotion_policy.updated",
  "tenant.notification_policy.updated",
  "tenant.governance_notification_policy.updated",
  "tenant.recovery_governance_notification_policy.updated",
  "tenant.notification_provider_profiles.updated",
  "tenant.evidence_retention_policy.updated",
  "tenant.evidence_retention_class_policy.updated"
] as const;

const workspacePolicyAuditEventTypes = [
  "workspace.activation_policy.updated",
  "workspace.operational_policy.updated",
  "workspace.launch_approval_policy.updated",
  "workspace.notification_provider_promotion_policy.updated",
  "workspace.notification_policy.updated",
  "workspace.governance_notification_policy.updated",
  "workspace.recovery_governance_notification_policy.updated",
  "workspace.notification_provider_profiles.updated",
  "workspace.evidence_retention_policy.updated",
  "workspace.evidence_retention_class_policy.updated"
] as const;

const systemCheckEvidenceRetentionAuditEventTypes = [
  "participant.system_check.evidence_captured",
  "workspace.system_check.evidence_hold.applied",
  "workspace.system_check.evidence_hold.assigned",
  "workspace.system_check.evidence_hold.acknowledged",
  "workspace.system_check.evidence_hold.escalated",
  "workspace.system_check.evidence_hold.released",
  "worker.system_check_evidence.hold_escalated",
  "worker.system_check_evidence.purged"
] as const;

const readBody = async <T>(request: IncomingMessage): Promise<T> => {
  const chunks: Buffer[] = [];

  for await (const chunk of request) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }

  const rawBody = Buffer.concat(chunks).toString("utf-8").trim();

  if (!rawBody) {
    throw new Error("Request body is required.");
  }

  return JSON.parse(rawBody) as T;
};

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null;

const sendJson = <T>(response: ServerResponse, statusCode: number, body: T): void => {
  response.writeHead(statusCode, jsonContentType);
  response.end(JSON.stringify(body, null, 2));
};

const sendError = (
  response: ServerResponse,
  statusCode: number,
  code: string,
  message: string,
  details?: Record<string, unknown>
): void => {
  sendJson<ErrorResponse>(response, statusCode, {
    error: {
      code,
      message,
      ...(details ? { details } : {})
    }
  });
};

const getTrimmedString = (value: unknown): string | undefined => {
  if (typeof value !== "string") {
    return undefined;
  }

  const trimmedValue = value.trim();
  return trimmedValue.length > 0 ? trimmedValue : undefined;
};

const isTrimmedString = (value: unknown): value is string => typeof getTrimmedString(value) === "string";

const parseUniqueTrimmedStringArray = (value: unknown): string[] | undefined => {
  if (!Array.isArray(value) || value.length === 0) {
    return undefined;
  }

  const normalizedValues = value.map(entry => getTrimmedString(entry));

  if (
    normalizedValues.some(entry => !entry) ||
    new Set(normalizedValues).size !== normalizedValues.length
  ) {
    return undefined;
  }

  return normalizedValues as string[];
};

const isContentReleaseActivationPolicy = (
  value: unknown
): value is ContentReleaseActivationPolicyDto =>
  isRecord(value) &&
  typeof value.blockIncompatibleRoutingChangesWithActiveSessions === "boolean" &&
  typeof value.warnOnActiveSessions === "boolean" &&
  typeof value.warnOnHighRiskReleaseChange === "boolean";

const isPositiveInteger = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value > 0;

const isNonNegativeInteger = (value: unknown): value is number =>
  typeof value === "number" &&
  Number.isInteger(value) &&
  value >= 0;

const isPercentageInteger = (value: unknown): value is number =>
  isNonNegativeInteger(value) &&
  value <= 100;

const activationPolicyOverrideKeys = [
  "blockIncompatibleRoutingChangesWithActiveSessions",
  "warnOnActiveSessions",
  "warnOnHighRiskReleaseChange"
] as const satisfies ReadonlyArray<keyof ContentReleaseActivationPolicyOverrideDto>;

const isContentReleaseActivationPolicyOverride = (
  value: unknown
): value is ContentReleaseActivationPolicyOverrideDto => {
  if (!isRecord(value)) {
    return false;
  }

  const keys = Object.keys(value);

  if (keys.length === 0) {
    return false;
  }

  return keys.every(key =>
    activationPolicyOverrideKeys.includes(key as typeof activationPolicyOverrideKeys[number]) &&
    typeof value[key] === "boolean"
  );
};

const isWorkspaceActivationPolicyMode = (
  value: unknown
): value is WorkspaceActivationPolicyModeDto =>
  value === "inherit" || value === "override";

const isBooleanPolicyOverrideRecord = (
  value: unknown
): value is BooleanPolicyOverrideRecordDto =>
  isRecord(value) &&
  typeof value.value === "boolean" &&
  typeof value.updatedAt === "string" &&
  typeof value.updatedByRequestId === "string" &&
  (
    value.updatedByActorType === "platform_api" ||
    value.updatedByActorType === "participant" ||
    value.updatedByActorType === "monitor" ||
    value.updatedByActorType === "worker" ||
    value.updatedByActorType === "dispatcher"
  ) &&
  typeof value.updatedByActorId === "string";

const isActivationPolicyOverrideRecords = (
  value: unknown
): value is ActivationPolicyOverrideRecordsDto => {
  if (!isRecord(value)) {
    return false;
  }

  const keys = Object.keys(value);

  return keys.every(key =>
    activationPolicyOverrideKeys.includes(key as typeof activationPolicyOverrideKeys[number]) &&
    isBooleanPolicyOverrideRecord(value[key])
  );
};

const isOperationalPolicy = (value: unknown): value is OperationalPolicyDto =>
  isRecord(value) &&
  isPositiveInteger(value.monitorCommandTtlSeconds) &&
  isPositiveInteger(value.monitorCommandLeaseSeconds) &&
  isNonNegativeInteger(value.timedRunMaintenanceGraceSeconds);

const operationalPolicyOverrideKeys = [
  "monitorCommandTtlSeconds",
  "monitorCommandLeaseSeconds",
  "timedRunMaintenanceGraceSeconds"
] as const satisfies ReadonlyArray<keyof OperationalPolicyOverrideDto>;

const isOperationalPolicyOverride = (
  value: unknown
): value is OperationalPolicyOverrideDto => {
  if (!isRecord(value)) {
    return false;
  }

  const keys = Object.keys(value);

  if (keys.length === 0) {
    return false;
  }

  return keys.every(key =>
    operationalPolicyOverrideKeys.includes(key as typeof operationalPolicyOverrideKeys[number]) &&
    (key === "timedRunMaintenanceGraceSeconds"
      ? isNonNegativeInteger(value[key])
      : isPositiveInteger(value[key]))
  );
};

const isWorkspaceOperationalPolicyMode = (
  value: unknown
): value is WorkspaceOperationalPolicyModeDto =>
  value === "inherit" || value === "override";

const isLaunchApprovalPolicy = (value: unknown): value is LaunchApprovalPolicyDto =>
  isRecord(value) &&
  isNonNegativeInteger(value.systemCheckLaunchApprovalTtlSeconds);

const isNotificationProviderPromotionPolicy = (
  value: unknown
): value is NotificationProviderPromotionPolicyDto =>
  isRecord(value) &&
  isPositiveInteger(value.evaluationWindowHours) &&
  isNonNegativeInteger(value.minimumRequestedCount) &&
  isNonNegativeInteger(value.minimumDirectSelectionCount) &&
  isNonNegativeInteger(value.minimumDeliveredCount) &&
  isNonNegativeInteger(value.maximumDeliveryFailedCount) &&
  typeof value.autoPromoteEnabled === "boolean" &&
  typeof value.autoRollbackOnFailureEnabled === "boolean" &&
  isNonNegativeInteger(value.autoPromotionSuppressionSeconds);

const isNotificationDeliverySelectionMode = (
  value: unknown
): value is NotificationPolicyDto["breachNotificationDeliverySelectionMode"] =>
  value === "infer_from_target" ||
  value === "force_webhook_spike" ||
  value === "force_email_spike";

const isNotificationPolicy = (value: unknown): value is NotificationPolicyDto =>
  isRecord(value) &&
  isNotificationDeliverySelectionMode(value.breachNotificationDeliverySelectionMode) &&
  isNonNegativeInteger(value.webhookSpikeRetryDelaySeconds) &&
  isPositiveInteger(value.webhookSpikeMaxDeliveryAttempts) &&
  isNonNegativeInteger(value.emailSpikeRetryDelaySeconds) &&
  isPositiveInteger(value.emailSpikeMaxDeliveryAttempts);

const isNotificationProviderProfileOperationalState = (
  value: unknown
): value is NotificationProviderProfileDto["operationalState"] =>
  isRecord(value) &&
  typeof value.lastCheckedAt === "string" &&
  (
    value.lastCheckedByActorType === "worker" ||
    value.lastCheckedByActorType === "notification_service" ||
    value.lastCheckedByActorType === "platform_api"
  ) &&
  typeof value.lastCheckedByActorId === "string" &&
  (
    value.credentialsStatus === "not_configured" ||
    value.credentialsStatus === "reachable" ||
    value.credentialsStatus === "unreachable"
  ) &&
  (
    value.healthStatus === "ready" ||
    value.healthStatus === "paused" ||
    value.healthStatus === "disabled" ||
    value.healthStatus === "credentials_unreachable" ||
    value.healthStatus === "target_unreachable"
  ) &&
  (
    value.rolloutStatus === "active_ready" ||
    value.rolloutStatus === "active_blocked" ||
    value.rolloutStatus === "paused" ||
    value.rolloutStatus === "disabled" ||
    value.rolloutStatus === "canary_ready" ||
    value.rolloutStatus === "canary_blocked"
  ) &&
  (
    value.probeStatus === "succeeded" ||
    value.probeStatus === "skipped_paused" ||
    value.probeStatus === "skipped_disabled" ||
    value.probeStatus === "skipped_by_policy" ||
    value.probeStatus === "credentials_unreachable" ||
    value.probeStatus === "target_unreachable"
  ) &&
  (
    typeof value.probeTarget === "string" ||
    value.probeTarget === null
  ) &&
  (
    isNonNegativeInteger(value.probeLatencyMs) ||
    value.probeLatencyMs === null
  ) &&
  (typeof value.lastCheckError === "string" || value.lastCheckError === null);

const isNotificationProviderProfile = (
  value: unknown
): value is NotificationProviderProfileDto =>
  isRecord(value) &&
  isTrimmedString(value.profileKey) &&
  isTrimmedString(value.displayLabel) &&
  typeof value.enabled === "boolean" &&
  (
    value.rolloutState === "active" ||
    value.rolloutState === "paused" ||
    value.rolloutState === "canary"
  ) &&
  isPercentageInteger(value.rolloutPercentage) &&
  (
    typeof value.rolloutFallbackProfileKey === "string" ||
    value.rolloutFallbackProfileKey === null
  ) &&
  (
    value.targetProbeMode === "active" ||
    value.targetProbeMode === "skip"
  ) &&
  isSystemCheckEvidenceBreachNotificationDeliveryChannel(value.deliveryChannel) &&
  isTrimmedString(value.target) &&
  typeof value.credentialsRefPresent === "boolean" &&
  (typeof value.credentialsRefMasked === "string" || value.credentialsRefMasked === null) &&
  (
    value.credentialsStatus === "not_configured" ||
    value.credentialsStatus === "reachable" ||
    value.credentialsStatus === "unreachable"
  ) &&
  (
    value.healthStatus === "ready" ||
    value.healthStatus === "paused" ||
    value.healthStatus === "disabled" ||
    value.healthStatus === "credentials_unreachable" ||
    value.healthStatus === "target_unreachable"
  ) &&
  (
    typeof value.incidentState === "undefined" ||
    value.incidentState === null ||
    (
      isRecord(value.incidentState) &&
      value.incidentState.incidentType === "auto_rollback_failure" &&
      typeof value.incidentState.openedAt === "string" &&
      (
        value.incidentState.openedByActorType === "worker" ||
        value.incidentState.openedByActorType === "notification_service" ||
        value.incidentState.openedByActorType === "platform_api"
      ) &&
      typeof value.incidentState.openedByActorId === "string" &&
      value.incidentState.reasonCode === "delivery_failures_present" &&
      isNonNegativeInteger(value.incidentState.deliveryFailedCount) &&
      (typeof value.incidentState.suppressionUntil === "string" ||
        value.incidentState.suppressionUntil === null) &&
      (typeof value.incidentState.resolvedAt === "string" ||
        value.incidentState.resolvedAt === null) &&
      (
        value.incidentState.resolutionCode === "auto_promoted" ||
        value.incidentState.resolutionCode === "manually_promoted" ||
        value.incidentState.resolutionCode === null
      )
    )
  ) &&
  (
    typeof value.operationalState === "undefined" ||
    value.operationalState === null ||
    isNotificationProviderProfileOperationalState(value.operationalState)
  );

const isNotificationProviderProfileInput = (
  value: unknown
): value is NotificationProviderProfileInputDto =>
  isRecord(value) &&
  isTrimmedString(value.profileKey) &&
  isTrimmedString(value.displayLabel) &&
  (typeof value.enabled === "boolean" || typeof value.enabled === "undefined") &&
  (
    typeof value.rolloutState === "undefined" ||
    value.rolloutState === "active" ||
    value.rolloutState === "paused" ||
    value.rolloutState === "canary"
  ) &&
  (
    typeof value.rolloutPercentage === "undefined" ||
    isPercentageInteger(value.rolloutPercentage)
  ) &&
  (
    typeof value.rolloutFallbackProfileKey === "undefined" ||
    value.rolloutFallbackProfileKey === null ||
    isTrimmedString(value.rolloutFallbackProfileKey)
  ) &&
  (
    typeof value.targetProbeMode === "undefined" ||
    value.targetProbeMode === "active" ||
    value.targetProbeMode === "skip"
  ) &&
  isSystemCheckEvidenceBreachNotificationDeliveryChannel(value.deliveryChannel) &&
  isTrimmedString(value.target) &&
  (
    value.credentialsRef === null ||
    (typeof value.credentialsRef === "string" &&
      isValidOutboundNotificationCredentialsRef(value.credentialsRef))
  );

const isNotificationProviderProfileIncidentStatus = (
  value: unknown
): value is NotificationProviderProfileIncidentStatusDto =>
  value === "open" || value === "acknowledged" || value === "resolved";

const isNotificationProviderProfileGovernanceAlertStatus = (
  value: unknown
): value is NotificationProviderProfileGovernanceAlertStatusDto =>
  value === "pending_acknowledgement" || value === "acknowledged";

const isNotificationProviderProfileGovernanceAlertClass = (
  value: unknown
): value is "incident_open" | "incident_resolved" =>
  value === "incident_open" || value === "incident_resolved";

const isNotificationProviderProfileGovernanceStatus = (
  value: unknown
): value is NotificationProviderProfileGovernanceStatusDto =>
  value === "needs_acknowledgement" ||
  value === "suppressed" ||
  value === "ready_for_manual_recovery" ||
  value === "recovery_blocked" ||
  value === "resolved_recovery";

const isNotificationProviderProfileGovernanceCaseStatus = (
  value: unknown
): value is NotificationProviderProfileGovernanceCaseStatusDto =>
  value === "awaiting_incident_acknowledgement" ||
  value === "suppressed_monitoring" ||
  value === "awaiting_redrive" ||
  value === "awaiting_alert_acknowledgement" ||
  value === "recovered" ||
  value === "closed";

const isNotificationProviderProfileGovernanceCaseSlaStatus = (
  value: unknown
): value is NotificationProviderProfileGovernanceCaseSlaStatusDto =>
  value === "not_applicable" ||
  value === "on_track" ||
  value === "breached" ||
  value === "escalated";

const isNotificationProviderProfiles = (
  value: unknown
): value is NotificationProviderProfileDto[] => {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }

  if (!value.every(isNotificationProviderProfile)) {
    return false;
  }

  return new Set(value.map(profile => profile.profileKey)).size === value.length;
};

const isNotificationProviderProfileInputs = (
  value: unknown
): value is NotificationProviderProfileInputDto[] => {
  if (!Array.isArray(value) || value.length === 0) {
    return false;
  }

  if (!value.every(isNotificationProviderProfileInput)) {
    return false;
  }

  return new Set(value.map(profile => profile.profileKey)).size === value.length;
};

const isNotificationProviderProfileOverrideRecord = (
  value: unknown
): value is NotificationProviderProfileOverrideRecordDto =>
  isRecord(value) &&
  isTrimmedString(value.profileKey) &&
  (value.value === null || isNotificationProviderProfile(value.value)) &&
  typeof value.updatedAt === "string" &&
  typeof value.updatedByRequestId === "string" &&
  (
    value.updatedByActorType === "platform_api" ||
    value.updatedByActorType === "participant" ||
    value.updatedByActorType === "monitor" ||
    value.updatedByActorType === "worker" ||
    value.updatedByActorType === "dispatcher" ||
    value.updatedByActorType === "notification_service"
  ) &&
  typeof value.updatedByActorId === "string";

const isNotificationProviderProfileOverrideRecords = (
  value: unknown
): value is NotificationProviderProfileOverrideRecordDto[] =>
  Array.isArray(value) &&
  value.every(isNotificationProviderProfileOverrideRecord) &&
  new Set(value.map(record => record.profileKey)).size === value.length;

const isWorkspaceNotificationProviderProfilesMode = (
  value: unknown
): value is WorkspaceNotificationProviderProfilesModeDto =>
  value === "inherit" || value === "override";

const isPromoteWorkspaceNotificationProviderProfileRequest = (
  value: unknown
): value is PromoteWorkspaceNotificationProviderProfileRequest =>
  isRecord(value) &&
  isTrimmedString(value.promotedByActorId) &&
  (
    typeof value.promotionNote === "undefined" ||
    value.promotionNote === null ||
    typeof value.promotionNote === "string"
  ) &&
  (
    typeof value.clearRolloutFallbackProfile === "undefined" ||
    typeof value.clearRolloutFallbackProfile === "boolean"
  ) &&
  (
    typeof value.forcePromotion === "undefined" ||
    typeof value.forcePromotion === "boolean"
  ) &&
  (
    typeof value.evaluationWindowHours === "undefined" ||
    isPositiveInteger(value.evaluationWindowHours)
  );

const isEvidenceRetentionPolicy = (value: unknown): value is EvidenceRetentionPolicyDto =>
  isRecord(value) &&
  isNonNegativeInteger(value.systemCheckEvidenceRetentionTtlSeconds) &&
  isNonNegativeInteger(value.systemCheckEvidenceInvestigationRetentionTtlSeconds);

const isEvidenceRetentionTtlFieldKey = (
  value: unknown
): value is EvidenceRetentionClassPolicyEntryDto["ttlFieldKey"] =>
  value === "systemCheckEvidenceRetentionTtlSeconds" ||
  value === "systemCheckEvidenceInvestigationRetentionTtlSeconds";

const isEvidenceRetentionHoldReasonDefinition = (
  value: unknown
): value is EvidenceRetentionClassPolicyDto["holdReasons"][number] =>
  isRecord(value) &&
  isTrimmedString(value.holdReasonCode) &&
  isTrimmedString(value.displayLabel) &&
  (typeof value.workflowHint === "string" || value.workflowHint === null) &&
  (value.severity === "low" || value.severity === "medium" || value.severity === "high") &&
  (typeof value.escalationTarget === "string" || value.escalationTarget === null) &&
  (typeof value.uiGroup === "string" || value.uiGroup === null) &&
  typeof value.acknowledgementRequired === "boolean" &&
  (typeof value.defaultAssigneeTarget === "string" || value.defaultAssigneeTarget === null) &&
  (
    (typeof value.slaSeconds === "number" &&
      Number.isInteger(value.slaSeconds) &&
      value.slaSeconds >= 0) ||
    value.slaSeconds === null
  );

const isEvidenceRetentionClassPolicyEntry = (
  value: unknown
): value is EvidenceRetentionClassPolicyEntryDto => {
  if (!isRecord(value)) {
    return false;
  }

  const holdTransitions = value.holdTransitions;

  return (
    isTrimmedString(value.retentionClass) &&
    isTrimmedString(value.retentionPolicyKey) &&
    isEvidenceRetentionTtlFieldKey(value.ttlFieldKey) &&
    typeof value.manualHoldAllowed === "boolean" &&
    typeof value.payloadAccessGrantsAllowed === "boolean" &&
    Array.isArray(holdTransitions) &&
    holdTransitions.every(transition =>
      isRecord(transition) &&
      isTrimmedString(transition.holdReasonCode) &&
      isTrimmedString(transition.targetRetentionClass)
    )
  );
};

const isEvidenceRetentionClassPolicy = (value: unknown): value is EvidenceRetentionClassPolicyDto =>
  (() => {
    if (!isRecord(value) || typeof value.defaultCaptureRetentionClass !== "string") {
      return false;
    }

    const holdReasons = Array.isArray(value.holdReasons) ? value.holdReasons : null;
    const classes = value.classes;

    if (!holdReasons || holdReasons.length === 0 || !Array.isArray(classes) || classes.length === 0) {
      return false;
    }

    if (
      !holdReasons.every(isEvidenceRetentionHoldReasonDefinition) ||
      new Set(
        holdReasons.map(entry => (entry as EvidenceRetentionClassPolicyDto["holdReasons"][number]).holdReasonCode)
      ).size !== holdReasons.length
    ) {
      return false;
    }

    const holdReasonCodes = holdReasons.map(
      entry => (entry as EvidenceRetentionClassPolicyDto["holdReasons"][number]).holdReasonCode
    );

    const normalizedClasses = classes.filter(isRecord);

    if (normalizedClasses.length !== classes.length) {
      return false;
    }

    const isEntryValid = normalizedClasses.every(isEvidenceRetentionClassPolicyEntry);

    if (!isEntryValid) {
      return false;
    }

    return (
      new Set(normalizedClasses.map(entry => entry.retentionClass)).size === normalizedClasses.length &&
      new Set(normalizedClasses.map(entry => entry.retentionPolicyKey)).size === normalizedClasses.length &&
      normalizedClasses.some(entry => entry.retentionClass === value.defaultCaptureRetentionClass) &&
      normalizedClasses.every(entry =>
        (entry.holdTransitions as Array<Record<string, unknown>>).every(transition =>
          holdReasonCodes.includes(transition.holdReasonCode as string) &&
          normalizedClasses.some(
            candidate => candidate.retentionClass === transition.targetRetentionClass
          )
        )
      )
    );
  })();

const launchApprovalPolicyOverrideKeys = [
  "systemCheckLaunchApprovalTtlSeconds"
] as const satisfies ReadonlyArray<keyof LaunchApprovalPolicyOverrideDto>;

const notificationProviderPromotionPolicyOverrideKeys = [
  "evaluationWindowHours",
  "minimumRequestedCount",
  "minimumDirectSelectionCount",
  "minimumDeliveredCount",
  "maximumDeliveryFailedCount",
  "autoPromoteEnabled",
  "autoRollbackOnFailureEnabled",
  "autoPromotionSuppressionSeconds"
] as const satisfies ReadonlyArray<keyof NotificationProviderPromotionPolicyOverrideDto>;

const notificationPolicyOverrideKeys = [
  "breachNotificationDeliverySelectionMode",
  "webhookSpikeRetryDelaySeconds",
  "webhookSpikeMaxDeliveryAttempts",
  "emailSpikeRetryDelaySeconds",
  "emailSpikeMaxDeliveryAttempts"
] as const satisfies ReadonlyArray<keyof NotificationPolicyOverrideDto>;

const evidenceRetentionPolicyOverrideKeys = [
  "systemCheckEvidenceRetentionTtlSeconds",
  "systemCheckEvidenceInvestigationRetentionTtlSeconds"
] as const satisfies ReadonlyArray<keyof EvidenceRetentionPolicyOverrideDto>;

const evidenceRetentionClassPolicyKeys = [
  "holdReasons",
  "defaultCaptureRetentionClass",
  "classes"
] as const satisfies ReadonlyArray<keyof EvidenceRetentionClassPolicyDto>;

const evidenceRetentionClassPolicyOverrideKeys = [
  "defaultCaptureRetentionClass",
  "classEntries"
] as const satisfies ReadonlyArray<keyof EvidenceRetentionClassPolicyOverrideDto>;

const isLaunchApprovalPolicyOverride = (
  value: unknown
): value is LaunchApprovalPolicyOverrideDto => {
  if (!isRecord(value)) {
    return false;
  }

  const keys = Object.keys(value);

  if (keys.length === 0) {
    return false;
  }

  return keys.every(key =>
    launchApprovalPolicyOverrideKeys.includes(key as typeof launchApprovalPolicyOverrideKeys[number]) &&
    isNonNegativeInteger(value[key])
  );
};

const isWorkspaceLaunchApprovalPolicyMode = (
  value: unknown
): value is WorkspaceLaunchApprovalPolicyModeDto =>
  value === "inherit" || value === "override";

const isNotificationProviderPromotionPolicyOverride = (
  value: unknown
): value is NotificationProviderPromotionPolicyOverrideDto => {
  if (!isRecord(value)) {
    return false;
  }

  const keys = Object.keys(value);

  if (keys.length === 0) {
    return false;
  }

  return keys.every(key =>
    notificationProviderPromotionPolicyOverrideKeys.includes(
      key as typeof notificationProviderPromotionPolicyOverrideKeys[number]
    ) &&
    (key === "autoPromoteEnabled" || key === "autoRollbackOnFailureEnabled"
      ? typeof value[key] === "boolean"
      : key === "evaluationWindowHours"
      ? isPositiveInteger(value[key])
      : isNonNegativeInteger(value[key]))
  );
};

const isWorkspaceNotificationProviderPromotionPolicyMode = (
  value: unknown
): value is WorkspaceNotificationProviderPromotionPolicyModeDto =>
  value === "inherit" || value === "override";

const isNotificationPolicyOverride = (
  value: unknown
): value is NotificationPolicyOverrideDto => {
  if (!isRecord(value)) {
    return false;
  }

  const keys = Object.keys(value);

  if (keys.length === 0) {
    return false;
  }

  return keys.every(key => {
    if (!notificationPolicyOverrideKeys.includes(key as typeof notificationPolicyOverrideKeys[number])) {
      return false;
    }

    if (key === "breachNotificationDeliverySelectionMode") {
      return isNotificationDeliverySelectionMode(value[key]);
    }

    return key === "webhookSpikeRetryDelaySeconds" || key === "emailSpikeRetryDelaySeconds"
      ? isNonNegativeInteger(value[key])
      : isPositiveInteger(value[key]);
  });
};

const isWorkspaceNotificationPolicyMode = (
  value: unknown
): value is WorkspaceNotificationPolicyModeDto =>
  value === "inherit" || value === "override";

const isWorkspaceGovernanceNotificationPolicyMode = (
  value: unknown
): value is WorkspaceGovernanceNotificationPolicyModeDto =>
  value === "inherit" || value === "override";

const isWorkspaceRecoveryGovernanceNotificationPolicyMode = (
  value: unknown
): value is WorkspaceRecoveryGovernanceNotificationPolicyModeDto =>
  value === "inherit" || value === "override";

const isEvidenceRetentionPolicyOverride = (
  value: unknown
): value is EvidenceRetentionPolicyOverrideDto => {
  if (!isRecord(value)) {
    return false;
  }

  const keys = Object.keys(value);

  if (keys.length === 0) {
    return false;
  }

  return keys.every(key =>
    evidenceRetentionPolicyOverrideKeys.includes(key as typeof evidenceRetentionPolicyOverrideKeys[number]) &&
    isNonNegativeInteger(value[key])
  );
};

const isWorkspaceEvidenceRetentionPolicyMode = (
  value: unknown
): value is WorkspaceEvidenceRetentionPolicyModeDto =>
  value === "inherit" || value === "override";

const isEvidenceRetentionClassPolicyOverride = (
  value: unknown
): value is EvidenceRetentionClassPolicyOverrideDto => {
  if (!isRecord(value)) {
    return false;
  }

  const keys = Object.keys(value);

  if (keys.length === 0) {
    return false;
  }

  if (
    !keys.every(key =>
      evidenceRetentionClassPolicyOverrideKeys.includes(
        key as typeof evidenceRetentionClassPolicyOverrideKeys[number]
      )
    )
  ) {
    return false;
  }

  if (
    "defaultCaptureRetentionClass" in value &&
    typeof value.defaultCaptureRetentionClass !== "string"
  ) {
    return false;
  }

  if (!("classEntries" in value)) {
    return true;
  }

  if (!Array.isArray(value.classEntries) || value.classEntries.length === 0) {
    return false;
  }

  if (!value.classEntries.every(isEvidenceRetentionClassPolicyEntry)) {
    return false;
  }

  return new Set(value.classEntries.map(entry => entry.retentionClass)).size === value.classEntries.length;
};

const isWorkspaceEvidenceRetentionClassPolicyMode = (
  value: unknown
): value is WorkspaceEvidenceRetentionClassPolicyModeDto =>
  value === "inherit" || value === "override";

const systemCheckResultStatusValues = [
  "passed",
  "warning",
  "failed"
] as const satisfies ReadonlyArray<SystemCheckResultStatusDto>;

const isSystemCheckResultStatus = (
  value: unknown
): value is SystemCheckResultStatusDto =>
  systemCheckResultStatusValues.includes(value as SystemCheckResultStatusDto);

const systemCheckReviewStatusValues = [
  "pending",
  "accepted",
  "needs_follow_up",
  "rejected"
] as const satisfies ReadonlyArray<SystemCheckReviewStatusDto>;

const isSystemCheckReviewStatus = (
  value: unknown
): value is SystemCheckReviewStatusDto =>
  systemCheckReviewStatusValues.includes(value as SystemCheckReviewStatusDto);

const isSystemCheckReviewDecisionStatus = (
  value: unknown
): value is Exclude<SystemCheckReviewStatusDto, "pending"> =>
  value === "accepted" || value === "needs_follow_up" || value === "rejected";

const systemCheckLaunchReadinessStatusValues = [
  "ready",
  "warning",
  "blocked"
] as const satisfies ReadonlyArray<SystemCheckLaunchReadinessStatusDto>;

const isSystemCheckLaunchReadinessStatus = (
  value: unknown
): value is SystemCheckLaunchReadinessStatusDto =>
  systemCheckLaunchReadinessStatusValues.includes(value as SystemCheckLaunchReadinessStatusDto);

const systemCheckLaunchApprovalScopeValues = [
  "single_launch",
  "session_assignment"
] as const satisfies ReadonlyArray<SystemCheckLaunchApprovalScopeDto>;

const isSystemCheckLaunchApprovalScope = (
  value: unknown
): value is SystemCheckLaunchApprovalScopeDto =>
  systemCheckLaunchApprovalScopeValues.includes(value as SystemCheckLaunchApprovalScopeDto);

const systemCheckLaunchApprovalStatusValues = [
  "active",
  "consumed",
  "revoked",
  "invalidated",
  "expired"
] as const satisfies ReadonlyArray<SystemCheckLaunchApprovalStatusDto>;

const isSystemCheckLaunchApprovalStatus = (
  value: unknown
): value is SystemCheckLaunchApprovalStatusDto =>
  systemCheckLaunchApprovalStatusValues.includes(value as SystemCheckLaunchApprovalStatusDto);

const systemCheckEvidenceHoldAcknowledgementStatusValues = [
  "not_required",
  "pending",
  "acknowledged"
] as const satisfies ReadonlyArray<SystemCheckEvidenceHoldAcknowledgementStatusDto>;

const isSystemCheckEvidenceHoldAcknowledgementStatus = (
  value: unknown
): value is SystemCheckEvidenceHoldAcknowledgementStatusDto =>
  systemCheckEvidenceHoldAcknowledgementStatusValues.includes(
    value as SystemCheckEvidenceHoldAcknowledgementStatusDto
  );

const systemCheckEvidenceHoldAssignmentStatusValues = [
  "unassigned",
  "assigned"
] as const satisfies ReadonlyArray<SystemCheckEvidenceHoldAssignmentStatusDto>;

const isSystemCheckEvidenceHoldAssignmentStatus = (
  value: unknown
): value is SystemCheckEvidenceHoldAssignmentStatusDto =>
  systemCheckEvidenceHoldAssignmentStatusValues.includes(
    value as SystemCheckEvidenceHoldAssignmentStatusDto
  );

const systemCheckEvidenceHoldEscalationStatusValues = [
  "not_applicable",
  "pending",
  "breached",
  "acknowledged",
  "escalated"
] as const satisfies ReadonlyArray<SystemCheckEvidenceHoldEscalationStatusDto>;

const isSystemCheckEvidenceHoldEscalationStatus = (
  value: unknown
): value is SystemCheckEvidenceHoldEscalationStatusDto =>
  systemCheckEvidenceHoldEscalationStatusValues.includes(
    value as SystemCheckEvidenceHoldEscalationStatusDto
  );

const systemCheckEvidenceBreachQueueStatusValues = [
  "pending_breach",
  "breached",
  "acknowledged",
  "escalated"
] as const satisfies ReadonlyArray<SystemCheckEvidenceBreachQueueStatusDto>;

const systemCheckEvidenceBreachNotificationStatusValues = [
  "pending_acknowledgement",
  "acknowledged"
] as const satisfies ReadonlyArray<SystemCheckEvidenceBreachNotificationStatusDto>;
const systemCheckEvidenceBreachNotificationDeliveryChannelValues = [
  "webhook_spike",
  "email_spike"
] as const satisfies ReadonlyArray<SystemCheckEvidenceBreachNotificationDeliveryChannelDto>;
const systemCheckEvidenceBreachNotificationDeliveryStatusValues = [
  "pending_delivery",
  "delivered",
  "delivery_failed"
] as const satisfies ReadonlyArray<SystemCheckEvidenceBreachNotificationDeliveryStatusDto>;

const isSystemCheckEvidenceBreachQueueStatus = (
  value: unknown
): value is SystemCheckEvidenceBreachQueueStatusDto =>
  systemCheckEvidenceBreachQueueStatusValues.includes(
    value as SystemCheckEvidenceBreachQueueStatusDto
  );

const isSystemCheckEvidenceBreachNotificationStatus = (
  value: unknown
): value is SystemCheckEvidenceBreachNotificationStatusDto =>
  systemCheckEvidenceBreachNotificationStatusValues.includes(
    value as SystemCheckEvidenceBreachNotificationStatusDto
  );

const isSystemCheckEvidenceBreachNotificationDeliveryChannel = (
  value: unknown
): value is SystemCheckEvidenceBreachNotificationDeliveryChannelDto =>
  systemCheckEvidenceBreachNotificationDeliveryChannelValues.includes(
    value as SystemCheckEvidenceBreachNotificationDeliveryChannelDto
  );

const isSystemCheckEvidenceBreachNotificationDeliveryStatus = (
  value: unknown
): value is SystemCheckEvidenceBreachNotificationDeliveryStatusDto =>
  systemCheckEvidenceBreachNotificationDeliveryStatusValues.includes(
    value as SystemCheckEvidenceBreachNotificationDeliveryStatusDto
  );

const parseBase64Payload = (value: unknown): string | undefined => {
  const trimmedValue = getTrimmedString(value);

  if (!trimmedValue) {
    return undefined;
  }

  const normalizedValue = trimmedValue.replace(/\s+/g, "");

  if (
    normalizedValue.length === 0 ||
    normalizedValue.length % 4 !== 0 ||
    !/^[A-Za-z0-9+/]*={0,2}$/.test(normalizedValue)
  ) {
    return undefined;
  }

  try {
    const decoded = Buffer.from(normalizedValue, "base64");

    if (decoded.byteLength === 0 || decoded.toString("base64") !== normalizedValue) {
      return undefined;
    }

    return normalizedValue;
  } catch {
    return undefined;
  }
};

const parseOptionalIsoTimestamp = (value: unknown): string | undefined => {
  const trimmedValue = getTrimmedString(value);

  if (!trimmedValue) {
    return undefined;
  }

  const parsedTimestamp = Date.parse(trimmedValue);

  if (Number.isNaN(parsedTimestamp)) {
    return undefined;
  }

  return new Date(parsedTimestamp).toISOString();
};

const parseSystemCheckResults = (
  value: unknown,
  expectedCheckKeys: string[]
): Record<string, SystemCheckCheckResultInputDto> | undefined => {
  if (!isRecord(value)) {
    return undefined;
  }

  const providedKeys = Object.keys(value);

  if (
    providedKeys.length !== expectedCheckKeys.length ||
    expectedCheckKeys.some(checkKey => !providedKeys.includes(checkKey))
  ) {
    return undefined;
  }

  const parsedEntries: Array<readonly [string, SystemCheckCheckResultInputDto]> = [];

  for (const checkKey of expectedCheckKeys) {
    const rawCheckResult = value[checkKey];

    if (!isRecord(rawCheckResult) || !isSystemCheckResultStatus(rawCheckResult.status)) {
      return undefined;
    }

    const evidenceKeys = rawCheckResult.evidenceKeys;

    if (!Array.isArray(evidenceKeys) && evidenceKeys !== undefined) {
      return undefined;
    }

    const normalizedEvidenceKeys = (evidenceKeys ?? []).map(entry => {
      if (typeof entry !== "string") {
        return null;
      }

      return getTrimmedString(entry) ?? null;
    });

    if (
      normalizedEvidenceKeys.some(entry => entry === null) ||
      new Set(normalizedEvidenceKeys).size !== normalizedEvidenceKeys.length
    ) {
      return undefined;
    }

    parsedEntries.push([checkKey, {
      status: rawCheckResult.status,
      detailMessage: getTrimmedString(rawCheckResult.detailMessage) ?? null,
      observedValue: getTrimmedString(rawCheckResult.observedValue) ?? null,
      evidenceKeys: normalizedEvidenceKeys as string[]
    }] as const);
  }

  return Object.fromEntries(parsedEntries);
};

const isNumericPolicyOverrideRecord = (
  value: unknown
): value is NumericPolicyOverrideRecordDto =>
  isRecord(value) &&
  typeof value.value === "number" &&
  Number.isInteger(value.value) &&
  typeof value.updatedAt === "string" &&
  typeof value.updatedByRequestId === "string" &&
  (
    value.updatedByActorType === "platform_api" ||
    value.updatedByActorType === "participant" ||
    value.updatedByActorType === "monitor" ||
    value.updatedByActorType === "worker" ||
    value.updatedByActorType === "dispatcher"
  ) &&
  typeof value.updatedByActorId === "string";

const isOperationalPolicyOverrideRecords = (
  value: unknown
): value is OperationalPolicyOverrideRecordsDto => {
  if (!isRecord(value)) {
    return false;
  }

  const keys = Object.keys(value);

  return keys.every(key =>
    operationalPolicyOverrideKeys.includes(key as typeof operationalPolicyOverrideKeys[number]) &&
    isNumericPolicyOverrideRecord(value[key])
  );
};

const isLaunchApprovalPolicyOverrideRecords = (
  value: unknown
): value is LaunchApprovalPolicyOverrideRecordsDto => {
  if (!isRecord(value)) {
    return false;
  }

  const keys = Object.keys(value);

  return keys.every(key =>
    launchApprovalPolicyOverrideKeys.includes(key as typeof launchApprovalPolicyOverrideKeys[number]) &&
    isNumericPolicyOverrideRecord(value[key])
  );
};

const isNotificationProviderPromotionPolicyOverrideRecords = (
  value: unknown
): value is NotificationProviderPromotionPolicyOverrideRecordsDto => {
  if (!isRecord(value)) {
    return false;
  }

  const keys = Object.keys(value);

  return keys.every(key =>
    notificationProviderPromotionPolicyOverrideKeys.includes(
      key as typeof notificationProviderPromotionPolicyOverrideKeys[number]
    ) &&
    (
      key === "autoPromoteEnabled" || key === "autoRollbackOnFailureEnabled"
        ? isBooleanPolicyOverrideRecord(value[key])
        : isNumericPolicyOverrideRecord(value[key])
    )
  );
};

const isNotificationPolicyOverrideRecords = (
  value: unknown
): value is NotificationPolicyOverrideRecordsDto => {
  if (!isRecord(value)) {
    return false;
  }

  const keys = Object.keys(value);

  return keys.every(key => {
    if (!notificationPolicyOverrideKeys.includes(key as typeof notificationPolicyOverrideKeys[number])) {
      return false;
    }

    if (key === "breachNotificationDeliverySelectionMode") {
      const record = value[key];

      return (
        isRecord(record) &&
        isNotificationDeliverySelectionMode(record.value) &&
        typeof record.updatedAt === "string" &&
        typeof record.updatedByRequestId === "string" &&
        (
          record.updatedByActorType === "platform_api" ||
          record.updatedByActorType === "participant" ||
          record.updatedByActorType === "monitor" ||
          record.updatedByActorType === "worker" ||
          record.updatedByActorType === "dispatcher"
        ) &&
        typeof record.updatedByActorId === "string"
      );
    }

    return isNumericPolicyOverrideRecord(value[key]);
  });
};

const isEvidenceRetentionPolicyOverrideRecords = (
  value: unknown
): value is EvidenceRetentionPolicyOverrideRecordsDto => {
  if (!isRecord(value)) {
    return false;
  }

  const keys = Object.keys(value);

  return keys.every(key =>
    evidenceRetentionPolicyOverrideKeys.includes(key as typeof evidenceRetentionPolicyOverrideKeys[number]) &&
    isNumericPolicyOverrideRecord(value[key])
  );
};

const isEvidenceRetentionClassPolicyOverrideRecord = (
  value: unknown
): value is EvidenceRetentionClassPolicyOverrideRecordDto =>
  isRecord(value) &&
  typeof value.value === "string" &&
  typeof value.updatedAt === "string" &&
  typeof value.updatedByRequestId === "string" &&
  (
    value.updatedByActorType === "platform_api" ||
    value.updatedByActorType === "participant" ||
    value.updatedByActorType === "monitor" ||
    value.updatedByActorType === "worker" ||
    value.updatedByActorType === "dispatcher"
  ) &&
  typeof value.updatedByActorId === "string";

const isEvidenceRetentionClassPolicyEntryOverrideRecord = (
  value: unknown
): value is EvidenceRetentionClassPolicyEntryOverrideRecordDto =>
  isRecord(value) &&
  isEvidenceRetentionClassPolicyEntry(value.value) &&
  typeof value.updatedAt === "string" &&
  typeof value.updatedByRequestId === "string" &&
  (
    value.updatedByActorType === "platform_api" ||
    value.updatedByActorType === "participant" ||
    value.updatedByActorType === "monitor" ||
    value.updatedByActorType === "worker" ||
    value.updatedByActorType === "dispatcher"
  ) &&
  typeof value.updatedByActorId === "string";

const isEvidenceRetentionClassPolicyOverrideRecords = (
  value: unknown
): value is EvidenceRetentionClassPolicyOverrideRecordsDto => {
  if (!isRecord(value)) {
    return false;
  }

  const keys = Object.keys(value);

  if (
    !keys.every(key =>
      evidenceRetentionClassPolicyOverrideKeys.includes(
        key as typeof evidenceRetentionClassPolicyOverrideKeys[number]
      )
    )
  ) {
    return false;
  }

  if (
    "defaultCaptureRetentionClass" in value &&
    !isEvidenceRetentionClassPolicyOverrideRecord(value.defaultCaptureRetentionClass)
  ) {
    return false;
  }

  if (!("classEntries" in value)) {
    return true;
  }

  if (!Array.isArray(value.classEntries) || value.classEntries.length === 0) {
    return false;
  }

  if (!value.classEntries.every(isEvidenceRetentionClassPolicyEntryOverrideRecord)) {
    return false;
  }

  return (
    new Set(value.classEntries.map(entry => entry.value.retentionClass)).size ===
    value.classEntries.length
  );
};

interface RequestContext {
  requestId: string;
}

interface ContentReleaseGuardrailContext {
  activeContentRelease: ContentRelease | null;
  activationPolicy: ContentReleaseActivationPolicyDto;
  activeSessions: Array<{
    testRunId: string;
    loginKey: string;
    groupKey: string;
    bookletKey: string;
    assignmentKey: string;
  }>;
}

const toContentReleaseActivationPolicyDto = (
  activationPolicy: ContentReleaseActivationPolicyDto
): ContentReleaseActivationPolicyDto => ({
  blockIncompatibleRoutingChangesWithActiveSessions:
    activationPolicy.blockIncompatibleRoutingChangesWithActiveSessions,
  warnOnActiveSessions: activationPolicy.warnOnActiveSessions,
  warnOnHighRiskReleaseChange: activationPolicy.warnOnHighRiskReleaseChange
});

const toBooleanPolicyOverrideRecordDto = (
  record: {
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
): BooleanPolicyOverrideRecordDto => ({
  value: record.value,
  updatedAt: record.updatedAt,
  updatedByRequestId: record.updatedByRequestId,
  updatedByActorType: record.updatedByActorType,
  updatedByActorId: record.updatedByActorId
});

const toContentReleaseActivationPolicyOverrideDto = (
  activationPolicyOverride: ContentReleaseActivationPolicyOverrideDto
): ContentReleaseActivationPolicyOverrideDto => ({
  ...(typeof activationPolicyOverride.blockIncompatibleRoutingChangesWithActiveSessions === "boolean"
    ? {
        blockIncompatibleRoutingChangesWithActiveSessions:
          activationPolicyOverride.blockIncompatibleRoutingChangesWithActiveSessions
      }
    : {}),
  ...(typeof activationPolicyOverride.warnOnActiveSessions === "boolean"
    ? {
        warnOnActiveSessions: activationPolicyOverride.warnOnActiveSessions
      }
    : {}),
  ...(typeof activationPolicyOverride.warnOnHighRiskReleaseChange === "boolean"
    ? {
        warnOnHighRiskReleaseChange: activationPolicyOverride.warnOnHighRiskReleaseChange
      }
    : {})
});

const toActivationPolicyOverrideRecordsDto = (
  activationPolicyOverrideRecords: Workspace["activationPolicyOverrideRecords"]
): ActivationPolicyOverrideRecordsDto | null => {
  if (!activationPolicyOverrideRecords) {
    return null;
  }

  return {
    ...(activationPolicyOverrideRecords.blockIncompatibleRoutingChangesWithActiveSessions
      ? {
          blockIncompatibleRoutingChangesWithActiveSessions: toBooleanPolicyOverrideRecordDto(
            activationPolicyOverrideRecords.blockIncompatibleRoutingChangesWithActiveSessions
          )
        }
      : {}),
    ...(activationPolicyOverrideRecords.warnOnActiveSessions
      ? {
          warnOnActiveSessions: toBooleanPolicyOverrideRecordDto(
            activationPolicyOverrideRecords.warnOnActiveSessions
          )
        }
      : {}),
    ...(activationPolicyOverrideRecords.warnOnHighRiskReleaseChange
      ? {
          warnOnHighRiskReleaseChange: toBooleanPolicyOverrideRecordDto(
            activationPolicyOverrideRecords.warnOnHighRiskReleaseChange
          )
        }
      : {})
  };
};

const toOperationalPolicyDto = (
  operationalPolicy: OperationalPolicy
): OperationalPolicyDto => ({
  monitorCommandTtlSeconds: operationalPolicy.monitorCommandTtlSeconds,
  monitorCommandLeaseSeconds: operationalPolicy.monitorCommandLeaseSeconds,
  timedRunMaintenanceGraceSeconds: operationalPolicy.timedRunMaintenanceGraceSeconds
});

const toLaunchApprovalPolicyDto = (
  launchApprovalPolicy: LaunchApprovalPolicy
): LaunchApprovalPolicyDto => ({
  systemCheckLaunchApprovalTtlSeconds: launchApprovalPolicy.systemCheckLaunchApprovalTtlSeconds
});

const toNotificationProviderPromotionPolicyDto = (
  notificationProviderPromotionPolicy: NotificationProviderPromotionPolicy
): NotificationProviderPromotionPolicyDto => ({
  evaluationWindowHours: notificationProviderPromotionPolicy.evaluationWindowHours,
  minimumRequestedCount: notificationProviderPromotionPolicy.minimumRequestedCount,
  minimumDirectSelectionCount:
    notificationProviderPromotionPolicy.minimumDirectSelectionCount,
  minimumDeliveredCount: notificationProviderPromotionPolicy.minimumDeliveredCount,
  maximumDeliveryFailedCount:
    notificationProviderPromotionPolicy.maximumDeliveryFailedCount,
  autoPromoteEnabled: notificationProviderPromotionPolicy.autoPromoteEnabled,
  autoRollbackOnFailureEnabled:
    notificationProviderPromotionPolicy.autoRollbackOnFailureEnabled,
  autoPromotionSuppressionSeconds:
    notificationProviderPromotionPolicy.autoPromotionSuppressionSeconds
});

const toNotificationPolicyDto = (
  notificationPolicy: NotificationPolicy
): NotificationPolicyDto => ({
  breachNotificationDeliverySelectionMode:
    notificationPolicy.breachNotificationDeliverySelectionMode,
  webhookSpikeRetryDelaySeconds: notificationPolicy.webhookSpikeRetryDelaySeconds,
  webhookSpikeMaxDeliveryAttempts: notificationPolicy.webhookSpikeMaxDeliveryAttempts,
  emailSpikeRetryDelaySeconds: notificationPolicy.emailSpikeRetryDelaySeconds,
  emailSpikeMaxDeliveryAttempts: notificationPolicy.emailSpikeMaxDeliveryAttempts
});

const toNotificationProviderProfileDto = (
  notificationProviderProfile: NotificationProviderProfile
): NotificationProviderProfileDto => ({
  profileKey: notificationProviderProfile.profileKey,
  displayLabel: notificationProviderProfile.displayLabel,
  enabled: notificationProviderProfile.enabled,
  rolloutState: notificationProviderProfile.rolloutState,
  rolloutPercentage: notificationProviderProfile.rolloutPercentage,
  rolloutFallbackProfileKey: notificationProviderProfile.rolloutFallbackProfileKey,
  targetProbeMode: notificationProviderProfile.targetProbeMode,
  deliveryChannel: notificationProviderProfile.deliveryChannel,
  target: notificationProviderProfile.target,
  credentialsRefPresent: notificationProviderProfile.credentialsRef !== null,
  credentialsRefMasked: maskOutboundNotificationCredentialsRef(notificationProviderProfile.credentialsRef),
  credentialsStatus: resolveOutboundNotificationProviderProfileCredentialsStatus(
    notificationProviderProfile
  ),
  healthStatus: resolveOutboundNotificationProviderProfileHealthStatus(
    notificationProviderProfile
  ),
  incidentState: notificationProviderProfile.incidentState
    ? {
        incidentType: notificationProviderProfile.incidentState.incidentType,
        openedAt: notificationProviderProfile.incidentState.openedAt,
        openedByActorType: notificationProviderProfile.incidentState.openedByActorType,
        openedByActorId: notificationProviderProfile.incidentState.openedByActorId,
        reasonCode: notificationProviderProfile.incidentState.reasonCode,
        deliveryFailedCount: notificationProviderProfile.incidentState.deliveryFailedCount,
        suppressionUntil: notificationProviderProfile.incidentState.suppressionUntil,
        resolvedAt: notificationProviderProfile.incidentState.resolvedAt,
        resolutionCode: notificationProviderProfile.incidentState.resolutionCode
      }
    : null,
  operationalState: notificationProviderProfile.operationalState
      ? {
        lastCheckedAt: notificationProviderProfile.operationalState.lastCheckedAt,
        lastCheckedByActorType: notificationProviderProfile.operationalState.lastCheckedByActorType,
        lastCheckedByActorId: notificationProviderProfile.operationalState.lastCheckedByActorId,
        credentialsStatus: notificationProviderProfile.operationalState.credentialsStatus,
        healthStatus: notificationProviderProfile.operationalState.healthStatus,
        rolloutStatus: notificationProviderProfile.operationalState.rolloutStatus,
        probeStatus: notificationProviderProfile.operationalState.probeStatus,
        probeTarget: notificationProviderProfile.operationalState.probeTarget,
        probeLatencyMs: notificationProviderProfile.operationalState.probeLatencyMs,
        lastCheckError: notificationProviderProfile.operationalState.lastCheckError
      }
    : null
});

const toNotificationProviderProfileIncidentDto = (
  incident: NotificationProviderProfileIncident
): NotificationProviderProfileIncidentDto => ({
  incidentId: incident.incidentId,
  profileKey: incident.profileKey,
  incidentType: incident.incidentType,
  status: incident.status,
  openedAt: incident.openedAt,
  openedByActorType: incident.openedByActorType,
  openedByActorId: incident.openedByActorId,
  reasonCode: incident.reasonCode,
  deliveryFailedCount: incident.deliveryFailedCount,
  suppressionUntil: incident.suppressionUntil,
  sourceRequestId: incident.sourceRequestId,
  acknowledgedAt: incident.acknowledgedAt,
  acknowledgedByActorId: incident.acknowledgedByActorId,
  acknowledgementNote: incident.acknowledgementNote,
  resolvedAt: incident.resolvedAt,
  resolutionCode: incident.resolutionCode
});

const toNotificationProviderProfileGovernanceAlertDto = (
  alert: NotificationProviderProfileGovernanceAlert
): NotificationProviderProfileGovernanceAlertDto => ({
  alertId: alert.alertId,
  incidentId: alert.incidentId,
  profileKey: alert.profileKey,
  alertClass: alert.alertClass,
  status: alert.status,
  governanceStatus: alert.governanceStatus,
  createdAt: alert.createdAt,
  createdByActorType: alert.createdByActorType,
  createdByActorId: alert.createdByActorId,
  sourceRequestId: alert.sourceRequestId,
  deliveryProfileKey: alert.deliveryProfileKey,
  delivery: {
    channel: alert.deliveryChannel,
    status: alert.deliveryStatus,
    target: alert.deliveryTarget,
    attemptCount: alert.deliveryAttemptCount,
    maxAttempts: alert.maxDeliveryAttempts,
    nextAttemptAt: alert.nextDeliveryAttemptAt,
    lastAttemptAt: alert.lastDeliveryAttemptAt,
    receiptId: alert.lastDeliveryReceiptId,
    receiptIssuedAt: alert.lastDeliveryReceiptIssuedAt,
    deliveredAt: alert.deliveredAt,
    lastError: alert.lastDeliveryError
  },
  acknowledgedAt: alert.acknowledgedAt,
  acknowledgedByActorId: alert.acknowledgedByActorId,
  acknowledgementNote: alert.acknowledgementNote
});

const getAuditEventRelatedIncidentId = (
  auditEvent: import("@testcenter-rewrite/domain").AuditEvent
): string | null => {
  const directIncidentId = getAuditPayloadString(auditEvent.payload, "incidentId");
  if (directIncidentId) {
    return directIncidentId;
  }

  const incidentRecord = getAuditPayloadRecord(auditEvent.payload, "incident");
  return incidentRecord ? (getTrimmedString(incidentRecord.incidentId) ?? null) : null;
};

const getAuditEventRelatedAlertIds = (
  auditEvent: import("@testcenter-rewrite/domain").AuditEvent
): string[] => {
  const relatedAlertIds = new Set<string>();
  const directAlertId = getAuditPayloadString(auditEvent.payload, "alertId");
  if (directAlertId) {
    relatedAlertIds.add(directAlertId);
  }

  const recoveryGovernanceAlertId = getAuditPayloadString(
    auditEvent.payload,
    "recoveryGovernanceAlertId"
  );
  if (recoveryGovernanceAlertId) {
    relatedAlertIds.add(recoveryGovernanceAlertId);
  }

  const alertRecord = getAuditPayloadRecord(auditEvent.payload, "alert");
  const nestedAlertId = alertRecord ? getTrimmedString(alertRecord.alertId) : null;
  if (nestedAlertId) {
    relatedAlertIds.add(nestedAlertId);
  }

  return Array.from(relatedAlertIds);
};

const toNotificationProviderProfileGovernanceCorrelationTimelineEventDto = (
  auditEvent: import("@testcenter-rewrite/domain").AuditEvent
) => ({
  occurredAt: auditEvent.occurredAt,
  eventType: auditEvent.eventType,
  requestId: auditEvent.requestId,
  actorType: auditEvent.actorType,
  actorId: auditEvent.actorId,
  relatedIncidentId: getAuditEventRelatedIncidentId(auditEvent),
  relatedAlertId: getAuditEventRelatedAlertIds(auditEvent)[0] ?? null
});

const getLatestNotificationProviderProfileGovernanceCaseAssignment = (
  auditEvents: import("@testcenter-rewrite/domain").AuditEvent[],
  incidentId: string
) => {
  const matchingEvent = auditEvents
    .filter(
      auditEvent =>
        auditEvent.eventType ===
          "workspace.notification_provider_profile_governance_case.assigned" &&
        getAuditEventRelatedIncidentId(auditEvent) === incidentId
    )
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];

  if (!matchingEvent) {
    return null;
  }

  return {
    assignedToActorId:
      getAuditPayloadString(matchingEvent.payload, "assignedToActorId") ?? null,
    assignedByActorId:
      getAuditPayloadString(matchingEvent.payload, "assignedByActorId") ?? null,
    assignedAt: getAuditPayloadString(matchingEvent.payload, "assignedAt") ?? null,
    assignmentNote:
      getAuditPayloadString(matchingEvent.payload, "assignmentNote") ?? null,
    slaSeconds: getAuditPayloadNumber(matchingEvent.payload, "slaSeconds") ?? null
  };
};

const getLatestNotificationProviderProfileGovernanceCaseEscalation = (
  auditEvents: import("@testcenter-rewrite/domain").AuditEvent[],
  incidentId: string
) => {
  const matchingEvent = auditEvents
    .filter(
      auditEvent =>
        auditEvent.eventType ===
          "workspace.notification_provider_profile_governance_case.escalated" &&
        getAuditEventRelatedIncidentId(auditEvent) === incidentId
    )
    .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))[0];

  if (!matchingEvent) {
    return null;
  }

  return {
    escalatedAt:
      getAuditPayloadString(matchingEvent.payload, "escalatedAt") ?? matchingEvent.occurredAt,
    escalatedByActorId:
      getAuditPayloadString(matchingEvent.payload, "escalatedByActorId") ?? null,
    escalationNote:
      getAuditPayloadString(matchingEvent.payload, "escalationNote") ?? null
  };
};

const toNotificationProviderProfileGovernanceCaseDto = (input: {
  profileKey: string;
  incident: NotificationProviderProfileIncident;
  alerts: NotificationProviderProfileGovernanceAlert[];
  timeline: ReturnType<typeof toNotificationProviderProfileGovernanceCorrelationTimelineEventDto>[];
  assignment: {
    assignedToActorId: string | null;
    assignedByActorId: string | null;
    assignedAt: string | null;
    assignmentNote: string | null;
    slaSeconds: number | null;
  } | null;
  escalation: {
    escalatedAt: string | null;
    escalatedByActorId: string | null;
    escalationNote: string | null;
  } | null;
}): WorkspaceNotificationProviderProfileGovernanceCasesResponse["items"][number] => {
  const nowIso = new Date().toISOString();
  const openAlertCount = input.alerts.filter(alert => alert.alertClass === "incident_open").length;
  const failedAlertCount = input.alerts.filter(
    alert => alert.deliveryStatus === "delivery_failed"
  ).length;
  const pendingAlertAcknowledgementCount = input.alerts.filter(
    alert => alert.status === "pending_acknowledgement"
  ).length;
  const suppressionActive =
    input.incident.suppressionUntil !== null &&
    input.incident.suppressionUntil > nowIso;
  const allAlertsAcknowledged =
    input.alerts.length > 0 &&
    input.alerts.every(alert => alert.status === "acknowledged");
  const hasDeliveredRecoveryAlert = input.alerts.some(
    alert =>
      alert.alertClass === "incident_resolved" &&
      alert.deliveryStatus === "delivered"
  );
  const slaDueAt =
    input.assignment?.assignedAt &&
    typeof input.assignment.slaSeconds === "number" &&
    input.assignment.slaSeconds > 0
      ? new Date(
          Date.parse(input.assignment.assignedAt) + input.assignment.slaSeconds * 1000
        ).toISOString()
      : null;
  const slaStatus: NotificationProviderProfileGovernanceCaseSlaStatusDto =
    input.escalation !== null
      ? "escalated"
      : slaDueAt === null
        ? "not_applicable"
        : slaDueAt < nowIso
          ? "breached"
          : "on_track";

  let caseStatus: NotificationProviderProfileGovernanceCaseStatusDto;
  let recommendedActions: WorkspaceNotificationProviderProfileGovernanceCasesResponse["items"][number]["recommendedActions"];

  if (failedAlertCount > 0) {
    caseStatus = "awaiting_redrive";
    recommendedActions = ["redrive_governance_alert"];
  } else if (input.incident.status === "open") {
    caseStatus = "awaiting_incident_acknowledgement";
    recommendedActions = ["acknowledge_incident"];
  } else if (suppressionActive) {
    caseStatus = "suppressed_monitoring";
    recommendedActions = ["wait_for_suppression_expiry"];
  } else if (pendingAlertAcknowledgementCount > 0) {
    caseStatus = "awaiting_alert_acknowledgement";
    recommendedActions = ["acknowledge_governance_alert"];
  } else if (hasDeliveredRecoveryAlert) {
    caseStatus = "recovered";
    recommendedActions = ["review_recovery_state"];
  } else if (allAlertsAcknowledged || input.incident.status === "resolved") {
    caseStatus = "closed";
    recommendedActions = ["no_action_required"];
  } else {
    caseStatus = "closed";
    recommendedActions = ["no_action_required"];
  }

  if (slaStatus === "breached") {
    recommendedActions = ["escalate_case", ...recommendedActions];
  }

  if (
    input.assignment === null &&
    recommendedActions[0] !== "no_action_required" &&
    recommendedActions[0] !== "assign_case"
  ) {
    recommendedActions = ["assign_case", ...recommendedActions];
  }

  const latestActivityAt = [
    input.incident.openedAt,
    input.incident.acknowledgedAt,
    input.incident.resolvedAt,
    input.assignment?.assignedAt,
    slaDueAt,
    input.escalation?.escalatedAt,
    ...input.alerts.flatMap(alert => [
      alert.createdAt,
      alert.acknowledgedAt,
      alert.deliveredAt,
      alert.lastDeliveryAttemptAt
    ]),
    ...input.timeline.map(item => item.occurredAt)
  ]
    .filter((value): value is string => typeof value === "string" && value.length > 0)
    .sort((left, right) => right.localeCompare(left))[0] ?? input.incident.openedAt;

  return {
    profileKey: input.profileKey,
    caseStatus,
    assignmentStatus: input.assignment ? "assigned" : "unassigned",
    assignedToActorId: input.assignment?.assignedToActorId ?? null,
    assignedByActorId: input.assignment?.assignedByActorId ?? null,
    assignedAt: input.assignment?.assignedAt ?? null,
    assignmentNote: input.assignment?.assignmentNote ?? null,
    slaSeconds: input.assignment?.slaSeconds ?? null,
    slaDueAt,
    slaStatus,
    escalatedAt: input.escalation?.escalatedAt ?? null,
    escalatedByActorId: input.escalation?.escalatedByActorId ?? null,
    escalationNote: input.escalation?.escalationNote ?? null,
    latestActivityAt,
    openAlertCount,
    failedAlertCount,
    pendingAlertAcknowledgementCount,
    recommendedActions,
    incident: toNotificationProviderProfileIncidentDto(input.incident),
    alerts: input.alerts.map(toNotificationProviderProfileGovernanceAlertDto),
    timeline: input.timeline
  };
};

const toNotificationProviderProfileGovernanceCaseQueueItemDto = (
  caseItem: WorkspaceNotificationProviderProfileGovernanceCasesResponse["items"][number]
): WorkspaceNotificationProviderProfileGovernanceCaseQueueResponse["items"][number] => {
  let priorityRank = 999;
  let priorityReason = "closed_or_inactive";

  if (caseItem.slaStatus === "escalated") {
    priorityRank = 10;
    priorityReason = "case_escalated";
  } else if (caseItem.slaStatus === "breached") {
    priorityRank = 20;
    priorityReason = "sla_breached";
  } else if (caseItem.caseStatus === "awaiting_redrive") {
    priorityRank = 30;
    priorityReason = "delivery_failed";
  } else if (caseItem.caseStatus === "awaiting_alert_acknowledgement") {
    priorityRank = 40;
    priorityReason = "alert_acknowledgement_pending";
  } else if (caseItem.caseStatus === "awaiting_incident_acknowledgement") {
    priorityRank = 50;
    priorityReason = "incident_acknowledgement_pending";
  } else if (caseItem.caseStatus === "suppressed_monitoring") {
    priorityRank = 60;
    priorityReason = "suppression_monitoring";
  } else if (caseItem.caseStatus === "recovered") {
    priorityRank = 70;
    priorityReason = "recovered_review";
  }

  return {
    priorityRank,
    priorityReason,
    caseItem
  };
};

const toNotificationProviderProfileGovernanceQueueItemDto = (input: {
  incident: NotificationProviderProfileIncident;
  rolloutMetrics: NotificationProviderProfileRolloutMetricsItemDto;
  evaluatedAt: string;
}): NotificationProviderProfileGovernanceQueueItemDto => {
  const suppressionActive =
    input.incident.suppressionUntil !== null &&
    input.incident.suppressionUntil > input.evaluatedAt;

  let governanceStatus: NotificationProviderProfileGovernanceStatusDto;
  let recommendedActions: NotificationProviderProfileGovernanceQueueItemDto["recommendedActions"];

  if (input.incident.status === "open") {
    governanceStatus = "needs_acknowledgement";
    recommendedActions = [
      "acknowledge_incident",
      "investigate_delivery_failures"
    ];
  } else if (suppressionActive) {
    governanceStatus = "suppressed";
    recommendedActions = [
      "wait_for_suppression_expiry",
      "investigate_delivery_failures"
    ];
  } else if (input.rolloutMetrics.promotionReadiness.status === "ready") {
    governanceStatus = "ready_for_manual_recovery";
    recommendedActions = ["force_promote_if_approved"];
  } else {
    governanceStatus = "recovery_blocked";
    recommendedActions = [
      "investigate_delivery_failures",
      "review_promotion_readiness"
    ];
  }

  return {
    profileKey: input.incident.profileKey,
    governanceStatus,
    suppressionUntil: input.incident.suppressionUntil,
    incident: toNotificationProviderProfileIncidentDto(input.incident),
    rolloutMetrics: input.rolloutMetrics,
    recommendedActions
  };
};

const toNotificationProviderProfile = (
  notificationProviderProfile: NotificationProviderProfileInputDto,
  previousNotificationProviderProfile?: NotificationProviderProfile
): NotificationProviderProfile => ({
  profileKey: notificationProviderProfile.profileKey,
  displayLabel: notificationProviderProfile.displayLabel,
  enabled: notificationProviderProfile.enabled ?? true,
  rolloutState: notificationProviderProfile.rolloutState ?? "active",
  rolloutPercentage: notificationProviderProfile.rolloutPercentage ?? 100,
  rolloutFallbackProfileKey: notificationProviderProfile.rolloutFallbackProfileKey ?? null,
  targetProbeMode: notificationProviderProfile.targetProbeMode ?? "active",
  deliveryChannel: notificationProviderProfile.deliveryChannel,
  target: notificationProviderProfile.target,
  credentialsRef: notificationProviderProfile.credentialsRef,
  incidentState:
    previousNotificationProviderProfile &&
    haveSameOutboundNotificationProviderProfileConfiguration(
      previousNotificationProviderProfile,
      {
        profileKey: notificationProviderProfile.profileKey,
        displayLabel: notificationProviderProfile.displayLabel,
        enabled: notificationProviderProfile.enabled ?? true,
        rolloutState: notificationProviderProfile.rolloutState ?? "active",
        rolloutPercentage: notificationProviderProfile.rolloutPercentage ?? 100,
        rolloutFallbackProfileKey: notificationProviderProfile.rolloutFallbackProfileKey ?? null,
        targetProbeMode: notificationProviderProfile.targetProbeMode ?? "active",
        deliveryChannel: notificationProviderProfile.deliveryChannel,
        target: notificationProviderProfile.target,
        credentialsRef: notificationProviderProfile.credentialsRef,
        incidentState: null,
        operationalState: null
      }
    )
      ? previousNotificationProviderProfile.incidentState ?? null
      : null,
  operationalState:
    previousNotificationProviderProfile &&
    haveSameOutboundNotificationProviderProfileConfiguration(
      previousNotificationProviderProfile,
      {
        profileKey: notificationProviderProfile.profileKey,
        displayLabel: notificationProviderProfile.displayLabel,
        enabled: notificationProviderProfile.enabled ?? true,
        rolloutState: notificationProviderProfile.rolloutState ?? "active",
        rolloutPercentage: notificationProviderProfile.rolloutPercentage ?? 100,
        rolloutFallbackProfileKey: notificationProviderProfile.rolloutFallbackProfileKey ?? null,
        targetProbeMode: notificationProviderProfile.targetProbeMode ?? "active",
        deliveryChannel: notificationProviderProfile.deliveryChannel,
        target: notificationProviderProfile.target,
        credentialsRef: notificationProviderProfile.credentialsRef,
        incidentState: null,
        operationalState: null
      }
    )
      ? previousNotificationProviderProfile.operationalState ?? null
      : null
});

const toNotificationProviderProfileOverrideRecordDto = (
  profileKey: string,
  notificationProviderProfileOverrideRecord: PolicyOverrideRecord<NotificationProviderProfile | null>
): NotificationProviderProfileOverrideRecordDto => ({
  profileKey,
  value:
    notificationProviderProfileOverrideRecord.value === null
      ? null
      : toNotificationProviderProfileDto(notificationProviderProfileOverrideRecord.value),
  updatedAt: notificationProviderProfileOverrideRecord.updatedAt,
  updatedByRequestId: notificationProviderProfileOverrideRecord.updatedByRequestId,
  updatedByActorType: notificationProviderProfileOverrideRecord.updatedByActorType,
  updatedByActorId: notificationProviderProfileOverrideRecord.updatedByActorId
});

const validateNotificationProviderProfileFallbacks = (input: {
  profiles: NotificationProviderProfile[];
  availableProfileKeys: Set<string>;
}): string | null => {
  for (const profile of input.profiles) {
    if (
      profile.rolloutFallbackProfileKey &&
      profile.rolloutFallbackProfileKey === profile.profileKey
    ) {
      return `Profile '${profile.profileKey}' must not reference itself as rolloutFallbackProfileKey.`;
    }

    if (
      profile.rolloutFallbackProfileKey &&
      !input.availableProfileKeys.has(profile.rolloutFallbackProfileKey)
    ) {
      return `Profile '${profile.profileKey}' references unknown rolloutFallbackProfileKey '${profile.rolloutFallbackProfileKey}'.`;
    }
  }

  return null;
};

const toNotificationProviderProfileOverrideRecordDtos = (
  notificationProviderProfileOverrideRecords: Workspace["notificationProviderProfileOverrideRecords"]
): NotificationProviderProfileOverrideRecordDto[] | null => {
  if (!notificationProviderProfileOverrideRecords) {
    return null;
  }

  return Object.entries(notificationProviderProfileOverrideRecords)
    .sort(([leftKey], [rightKey]) => leftKey.localeCompare(rightKey))
    .map(([profileKey, record]) =>
      toNotificationProviderProfileOverrideRecordDto(profileKey, record)
    );
};

const toEvidenceRetentionPolicyDto = (
  evidenceRetentionPolicy: EvidenceRetentionPolicy
): EvidenceRetentionPolicyDto => ({
  systemCheckEvidenceRetentionTtlSeconds: evidenceRetentionPolicy.systemCheckEvidenceRetentionTtlSeconds,
  systemCheckEvidenceInvestigationRetentionTtlSeconds:
    evidenceRetentionPolicy.systemCheckEvidenceInvestigationRetentionTtlSeconds
});

const toEvidenceRetentionClassPolicyDto = (
  evidenceRetentionClassPolicy: EvidenceRetentionClassPolicy
): EvidenceRetentionClassPolicyDto => ({
  holdReasons: evidenceRetentionClassPolicy.holdReasons.map(holdReason => ({
    holdReasonCode: holdReason.holdReasonCode,
    displayLabel: holdReason.displayLabel,
    workflowHint: holdReason.workflowHint,
    severity: holdReason.severity,
    escalationTarget: holdReason.escalationTarget,
    uiGroup: holdReason.uiGroup,
    acknowledgementRequired: holdReason.acknowledgementRequired,
    defaultAssigneeTarget: holdReason.defaultAssigneeTarget,
    slaSeconds: holdReason.slaSeconds
  })),
  defaultCaptureRetentionClass: evidenceRetentionClassPolicy.defaultCaptureRetentionClass,
  classes: evidenceRetentionClassPolicy.classes.map(entry => ({
    retentionClass: entry.retentionClass,
    retentionPolicyKey: entry.retentionPolicyKey,
    ttlFieldKey: entry.ttlFieldKey,
    manualHoldAllowed: entry.manualHoldAllowed,
    payloadAccessGrantsAllowed: entry.payloadAccessGrantsAllowed,
    holdTransitions: entry.holdTransitions.map(transition => ({
      holdReasonCode: transition.holdReasonCode,
      targetRetentionClass: transition.targetRetentionClass
    }))
  }))
});

const toEvidenceRetentionClassPolicyOverrideDto = (
  evidenceRetentionClassPolicyOverride: EvidenceRetentionClassPolicyOverrideDto
): EvidenceRetentionClassPolicyOverrideDto => ({
  ...(typeof evidenceRetentionClassPolicyOverride.defaultCaptureRetentionClass === "string"
    ? {
        defaultCaptureRetentionClass:
          evidenceRetentionClassPolicyOverride.defaultCaptureRetentionClass
      }
    : {}),
  ...(Array.isArray(evidenceRetentionClassPolicyOverride.classEntries) &&
  evidenceRetentionClassPolicyOverride.classEntries.length > 0
    ? {
        classEntries: evidenceRetentionClassPolicyOverride.classEntries.map(classEntry => ({
          retentionClass: classEntry.retentionClass,
          retentionPolicyKey: classEntry.retentionPolicyKey,
          ttlFieldKey: classEntry.ttlFieldKey,
          manualHoldAllowed: classEntry.manualHoldAllowed,
          payloadAccessGrantsAllowed: classEntry.payloadAccessGrantsAllowed,
          holdTransitions: classEntry.holdTransitions.map(transition => ({
            holdReasonCode: transition.holdReasonCode,
            targetRetentionClass: transition.targetRetentionClass
          }))
        }))
      }
    : {})
});

const toSystemCheckEvidenceRetentionClassRuleDto = (
  rule: ReturnType<typeof buildSystemCheckEvidenceRetentionClassRules>[number]
): SystemCheckEvidenceRetentionClassRuleDto => ({
  retentionClass: rule.retentionClass,
  retentionPolicyKey: rule.retentionPolicyKey,
  ttlSeconds: rule.ttlSeconds,
  manualHoldAllowed: rule.manualHoldAllowed,
  payloadAccessGrantsAllowed: rule.payloadAccessGrantsAllowed,
  holdTransitions: rule.holdTransitions.map(transition => ({
    holdReasonCode: transition.holdReasonCode,
    holdReasonDisplayLabel: transition.holdReason?.displayLabel ?? null,
    holdReasonWorkflowHint: transition.holdReason?.workflowHint ?? null,
    holdReasonSeverity: transition.holdReason?.severity ?? null,
    holdReasonEscalationTarget: transition.holdReason?.escalationTarget ?? null,
    holdReasonUiGroup: transition.holdReason?.uiGroup ?? null,
    holdReasonAcknowledgementRequired: transition.holdReason?.acknowledgementRequired ?? null,
    holdReasonDefaultAssigneeTarget: transition.holdReason?.defaultAssigneeTarget ?? null,
    holdReasonSlaSeconds: transition.holdReason?.slaSeconds ?? null,
    targetRetentionClass: transition.targetRetentionClass,
    targetRetentionPolicyKey: transition.targetRetentionPolicyKey
  }))
});

const toEvidenceRetentionClassPolicyOverrideRecordDto = (
  evidenceRetentionClassPolicyOverrideRecord: PolicyOverrideRecord<string>
): EvidenceRetentionClassPolicyOverrideRecordDto => {
  return {
    value: evidenceRetentionClassPolicyOverrideRecord.value,
    updatedAt: evidenceRetentionClassPolicyOverrideRecord.updatedAt,
    updatedByRequestId: evidenceRetentionClassPolicyOverrideRecord.updatedByRequestId,
    updatedByActorType: evidenceRetentionClassPolicyOverrideRecord.updatedByActorType,
    updatedByActorId: evidenceRetentionClassPolicyOverrideRecord.updatedByActorId
  };
};

const toEvidenceRetentionClassPolicyEntryOverrideRecordDto = (
  evidenceRetentionClassPolicyEntryOverrideRecord: PolicyOverrideRecord<EvidenceRetentionClassPolicyEntry>
): EvidenceRetentionClassPolicyEntryOverrideRecordDto => ({
  value: {
    retentionClass: evidenceRetentionClassPolicyEntryOverrideRecord.value.retentionClass,
    retentionPolicyKey: evidenceRetentionClassPolicyEntryOverrideRecord.value.retentionPolicyKey,
    ttlFieldKey: evidenceRetentionClassPolicyEntryOverrideRecord.value.ttlFieldKey,
    manualHoldAllowed: evidenceRetentionClassPolicyEntryOverrideRecord.value.manualHoldAllowed,
    payloadAccessGrantsAllowed:
      evidenceRetentionClassPolicyEntryOverrideRecord.value.payloadAccessGrantsAllowed,
    holdTransitions: evidenceRetentionClassPolicyEntryOverrideRecord.value.holdTransitions.map(
      transition => ({
        holdReasonCode: transition.holdReasonCode,
        targetRetentionClass: transition.targetRetentionClass
      })
    )
  },
  updatedAt: evidenceRetentionClassPolicyEntryOverrideRecord.updatedAt,
  updatedByRequestId: evidenceRetentionClassPolicyEntryOverrideRecord.updatedByRequestId,
  updatedByActorType: evidenceRetentionClassPolicyEntryOverrideRecord.updatedByActorType,
  updatedByActorId: evidenceRetentionClassPolicyEntryOverrideRecord.updatedByActorId
});

const toEvidenceRetentionClassPolicyOverrideRecordsDto = (
  evidenceRetentionClassPolicyOverrideRecords: Workspace["evidenceRetentionClassPolicyOverrideRecords"]
): EvidenceRetentionClassPolicyOverrideRecordsDto | null => {
  if (!evidenceRetentionClassPolicyOverrideRecords) {
    return null;
  }

  return {
    ...(evidenceRetentionClassPolicyOverrideRecords.defaultCaptureRetentionClass
      ? {
          defaultCaptureRetentionClass: toEvidenceRetentionClassPolicyOverrideRecordDto(
            evidenceRetentionClassPolicyOverrideRecords.defaultCaptureRetentionClass
          )
        }
      : {}),
    ...(evidenceRetentionClassPolicyOverrideRecords.classEntries &&
    Object.keys(evidenceRetentionClassPolicyOverrideRecords.classEntries).length > 0
      ? {
          classEntries: Object.values(evidenceRetentionClassPolicyOverrideRecords.classEntries)
            .map(toEvidenceRetentionClassPolicyEntryOverrideRecordDto)
            .sort((left, right) =>
              left.value.retentionClass.localeCompare(right.value.retentionClass)
            )
        }
      : {})
  };
};

const toNumericPolicyOverrideRecordDto = (
  record: {
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
): NumericPolicyOverrideRecordDto => ({
  value: record.value,
  updatedAt: record.updatedAt,
  updatedByRequestId: record.updatedByRequestId,
  updatedByActorType: record.updatedByActorType,
  updatedByActorId: record.updatedByActorId
});

const toOperationalPolicyOverrideDto = (
  operationalPolicyOverride: OperationalPolicyOverrideDto
): OperationalPolicyOverrideDto => ({
  ...(isPositiveInteger(operationalPolicyOverride.monitorCommandTtlSeconds)
    ? { monitorCommandTtlSeconds: operationalPolicyOverride.monitorCommandTtlSeconds }
    : {}),
  ...(isPositiveInteger(operationalPolicyOverride.monitorCommandLeaseSeconds)
    ? { monitorCommandLeaseSeconds: operationalPolicyOverride.monitorCommandLeaseSeconds }
    : {}),
  ...(isNonNegativeInteger(operationalPolicyOverride.timedRunMaintenanceGraceSeconds)
    ? { timedRunMaintenanceGraceSeconds: operationalPolicyOverride.timedRunMaintenanceGraceSeconds }
    : {})
});

const toLaunchApprovalPolicyOverrideDto = (
  launchApprovalPolicyOverride: LaunchApprovalPolicyOverrideDto
): LaunchApprovalPolicyOverrideDto => ({
  ...(isNonNegativeInteger(launchApprovalPolicyOverride.systemCheckLaunchApprovalTtlSeconds)
    ? {
        systemCheckLaunchApprovalTtlSeconds:
          launchApprovalPolicyOverride.systemCheckLaunchApprovalTtlSeconds
      }
    : {})
});

const toNotificationProviderPromotionPolicyOverrideDto = (
  notificationProviderPromotionPolicyOverride: NotificationProviderPromotionPolicyOverrideDto
): NotificationProviderPromotionPolicyOverrideDto => ({
  ...(isPositiveInteger(notificationProviderPromotionPolicyOverride.evaluationWindowHours)
    ? {
        evaluationWindowHours:
          notificationProviderPromotionPolicyOverride.evaluationWindowHours
      }
    : {}),
  ...(isNonNegativeInteger(notificationProviderPromotionPolicyOverride.minimumRequestedCount)
    ? {
        minimumRequestedCount:
          notificationProviderPromotionPolicyOverride.minimumRequestedCount
      }
    : {}),
  ...(isNonNegativeInteger(
    notificationProviderPromotionPolicyOverride.minimumDirectSelectionCount
  )
    ? {
        minimumDirectSelectionCount:
          notificationProviderPromotionPolicyOverride.minimumDirectSelectionCount
      }
    : {}),
  ...(isNonNegativeInteger(notificationProviderPromotionPolicyOverride.minimumDeliveredCount)
    ? {
        minimumDeliveredCount:
          notificationProviderPromotionPolicyOverride.minimumDeliveredCount
      }
    : {}),
  ...(isNonNegativeInteger(
    notificationProviderPromotionPolicyOverride.maximumDeliveryFailedCount
  )
    ? {
        maximumDeliveryFailedCount:
          notificationProviderPromotionPolicyOverride.maximumDeliveryFailedCount
      }
    : {}),
  ...(typeof notificationProviderPromotionPolicyOverride.autoPromoteEnabled === "boolean"
    ? {
        autoPromoteEnabled:
          notificationProviderPromotionPolicyOverride.autoPromoteEnabled
      }
    : {}),
  ...(typeof notificationProviderPromotionPolicyOverride.autoRollbackOnFailureEnabled === "boolean"
    ? {
        autoRollbackOnFailureEnabled:
          notificationProviderPromotionPolicyOverride.autoRollbackOnFailureEnabled
      }
    : {}),
  ...(isNonNegativeInteger(notificationProviderPromotionPolicyOverride.autoPromotionSuppressionSeconds)
    ? {
        autoPromotionSuppressionSeconds:
          notificationProviderPromotionPolicyOverride.autoPromotionSuppressionSeconds
      }
    : {})
});

const toNotificationPolicyOverrideDto = (
  notificationPolicyOverride: NotificationPolicyOverrideDto
): NotificationPolicyOverrideDto => ({
  ...(isNotificationDeliverySelectionMode(
    notificationPolicyOverride.breachNotificationDeliverySelectionMode
  )
    ? {
        breachNotificationDeliverySelectionMode:
          notificationPolicyOverride.breachNotificationDeliverySelectionMode
      }
    : {}),
  ...(isNonNegativeInteger(notificationPolicyOverride.webhookSpikeRetryDelaySeconds)
    ? {
        webhookSpikeRetryDelaySeconds:
          notificationPolicyOverride.webhookSpikeRetryDelaySeconds
      }
    : {}),
  ...(isPositiveInteger(notificationPolicyOverride.webhookSpikeMaxDeliveryAttempts)
    ? {
        webhookSpikeMaxDeliveryAttempts:
          notificationPolicyOverride.webhookSpikeMaxDeliveryAttempts
      }
    : {}),
  ...(isNonNegativeInteger(notificationPolicyOverride.emailSpikeRetryDelaySeconds)
    ? {
        emailSpikeRetryDelaySeconds:
          notificationPolicyOverride.emailSpikeRetryDelaySeconds
      }
    : {}),
  ...(isPositiveInteger(notificationPolicyOverride.emailSpikeMaxDeliveryAttempts)
    ? {
        emailSpikeMaxDeliveryAttempts:
          notificationPolicyOverride.emailSpikeMaxDeliveryAttempts
      }
    : {})
});

const toEvidenceRetentionPolicyOverrideDto = (
  evidenceRetentionPolicyOverride: EvidenceRetentionPolicyOverrideDto
): EvidenceRetentionPolicyOverrideDto => ({
  ...(isNonNegativeInteger(evidenceRetentionPolicyOverride.systemCheckEvidenceRetentionTtlSeconds)
    ? {
        systemCheckEvidenceRetentionTtlSeconds:
          evidenceRetentionPolicyOverride.systemCheckEvidenceRetentionTtlSeconds
      }
    : {}),
  ...(isNonNegativeInteger(
    evidenceRetentionPolicyOverride.systemCheckEvidenceInvestigationRetentionTtlSeconds
  )
    ? {
        systemCheckEvidenceInvestigationRetentionTtlSeconds:
          evidenceRetentionPolicyOverride.systemCheckEvidenceInvestigationRetentionTtlSeconds
      }
    : {})
});

const toOperationalPolicyOverrideRecordsDto = (
  operationalPolicyOverrideRecords: Workspace["operationalPolicyOverrideRecords"]
): OperationalPolicyOverrideRecordsDto | null => {
  if (!operationalPolicyOverrideRecords) {
    return null;
  }

  return {
    ...(operationalPolicyOverrideRecords.monitorCommandTtlSeconds
      ? {
          monitorCommandTtlSeconds: toNumericPolicyOverrideRecordDto(
            operationalPolicyOverrideRecords.monitorCommandTtlSeconds
          )
        }
      : {}),
    ...(operationalPolicyOverrideRecords.monitorCommandLeaseSeconds
      ? {
          monitorCommandLeaseSeconds: toNumericPolicyOverrideRecordDto(
            operationalPolicyOverrideRecords.monitorCommandLeaseSeconds
          )
        }
      : {}),
    ...(operationalPolicyOverrideRecords.timedRunMaintenanceGraceSeconds
      ? {
          timedRunMaintenanceGraceSeconds: toNumericPolicyOverrideRecordDto(
            operationalPolicyOverrideRecords.timedRunMaintenanceGraceSeconds
          )
        }
      : {})
  };
};

const toLaunchApprovalPolicyOverrideRecordsDto = (
  launchApprovalPolicyOverrideRecords: Workspace["launchApprovalPolicyOverrideRecords"]
): LaunchApprovalPolicyOverrideRecordsDto | null => {
  if (!launchApprovalPolicyOverrideRecords) {
    return null;
  }

  return {
    ...(launchApprovalPolicyOverrideRecords.systemCheckLaunchApprovalTtlSeconds
      ? {
          systemCheckLaunchApprovalTtlSeconds: toNumericPolicyOverrideRecordDto(
            launchApprovalPolicyOverrideRecords.systemCheckLaunchApprovalTtlSeconds
          )
        }
      : {})
  };
};

const toNotificationProviderPromotionPolicyOverrideRecordsDto = (
  notificationProviderPromotionPolicyOverrideRecords: Workspace["notificationProviderPromotionPolicyOverrideRecords"]
): NotificationProviderPromotionPolicyOverrideRecordsDto | null => {
  if (!notificationProviderPromotionPolicyOverrideRecords) {
    return null;
  }

  return {
    ...(notificationProviderPromotionPolicyOverrideRecords.evaluationWindowHours
      ? {
          evaluationWindowHours: toNumericPolicyOverrideRecordDto(
            notificationProviderPromotionPolicyOverrideRecords.evaluationWindowHours
          )
        }
      : {}),
    ...(notificationProviderPromotionPolicyOverrideRecords.minimumRequestedCount
      ? {
          minimumRequestedCount: toNumericPolicyOverrideRecordDto(
            notificationProviderPromotionPolicyOverrideRecords.minimumRequestedCount
          )
        }
      : {}),
    ...(notificationProviderPromotionPolicyOverrideRecords.minimumDirectSelectionCount
      ? {
          minimumDirectSelectionCount: toNumericPolicyOverrideRecordDto(
            notificationProviderPromotionPolicyOverrideRecords.minimumDirectSelectionCount
          )
        }
      : {}),
    ...(notificationProviderPromotionPolicyOverrideRecords.minimumDeliveredCount
      ? {
          minimumDeliveredCount: toNumericPolicyOverrideRecordDto(
            notificationProviderPromotionPolicyOverrideRecords.minimumDeliveredCount
          )
        }
      : {}),
    ...(notificationProviderPromotionPolicyOverrideRecords.maximumDeliveryFailedCount
      ? {
          maximumDeliveryFailedCount: toNumericPolicyOverrideRecordDto(
            notificationProviderPromotionPolicyOverrideRecords.maximumDeliveryFailedCount
          )
        }
      : {}),
    ...(notificationProviderPromotionPolicyOverrideRecords.autoPromoteEnabled
      ? {
          autoPromoteEnabled: toBooleanPolicyOverrideRecordDto(
            notificationProviderPromotionPolicyOverrideRecords.autoPromoteEnabled
          )
        }
      : {}),
    ...(notificationProviderPromotionPolicyOverrideRecords.autoRollbackOnFailureEnabled
      ? {
          autoRollbackOnFailureEnabled: toBooleanPolicyOverrideRecordDto(
            notificationProviderPromotionPolicyOverrideRecords.autoRollbackOnFailureEnabled
          )
        }
      : {}),
    ...(notificationProviderPromotionPolicyOverrideRecords.autoPromotionSuppressionSeconds
      ? {
          autoPromotionSuppressionSeconds: toNumericPolicyOverrideRecordDto(
            notificationProviderPromotionPolicyOverrideRecords.autoPromotionSuppressionSeconds
          )
        }
      : {})
  };
};

const toNotificationPolicyOverrideRecordsDto = (
  notificationPolicyOverrideRecords: Workspace["notificationPolicyOverrideRecords"]
): NotificationPolicyOverrideRecordsDto | null => {
  if (!notificationPolicyOverrideRecords) {
    return null;
  }

  return {
    ...(notificationPolicyOverrideRecords.breachNotificationDeliverySelectionMode
      ? {
          breachNotificationDeliverySelectionMode: {
            value: notificationPolicyOverrideRecords.breachNotificationDeliverySelectionMode.value,
            updatedAt: notificationPolicyOverrideRecords.breachNotificationDeliverySelectionMode.updatedAt,
            updatedByRequestId:
              notificationPolicyOverrideRecords.breachNotificationDeliverySelectionMode.updatedByRequestId,
            updatedByActorType:
              notificationPolicyOverrideRecords.breachNotificationDeliverySelectionMode.updatedByActorType,
            updatedByActorId:
              notificationPolicyOverrideRecords.breachNotificationDeliverySelectionMode.updatedByActorId
          }
        }
      : {}),
    ...(notificationPolicyOverrideRecords.webhookSpikeRetryDelaySeconds
      ? {
          webhookSpikeRetryDelaySeconds: toNumericPolicyOverrideRecordDto(
            notificationPolicyOverrideRecords.webhookSpikeRetryDelaySeconds
          )
        }
      : {}),
    ...(notificationPolicyOverrideRecords.webhookSpikeMaxDeliveryAttempts
      ? {
          webhookSpikeMaxDeliveryAttempts: toNumericPolicyOverrideRecordDto(
            notificationPolicyOverrideRecords.webhookSpikeMaxDeliveryAttempts
          )
        }
      : {}),
    ...(notificationPolicyOverrideRecords.emailSpikeRetryDelaySeconds
      ? {
          emailSpikeRetryDelaySeconds: toNumericPolicyOverrideRecordDto(
            notificationPolicyOverrideRecords.emailSpikeRetryDelaySeconds
          )
        }
      : {}),
    ...(notificationPolicyOverrideRecords.emailSpikeMaxDeliveryAttempts
      ? {
          emailSpikeMaxDeliveryAttempts: toNumericPolicyOverrideRecordDto(
            notificationPolicyOverrideRecords.emailSpikeMaxDeliveryAttempts
          )
        }
      : {})
  };
};

const toEvidenceRetentionPolicyOverrideRecordsDto = (
  evidenceRetentionPolicyOverrideRecords: Workspace["evidenceRetentionPolicyOverrideRecords"]
): EvidenceRetentionPolicyOverrideRecordsDto | null => {
  if (!evidenceRetentionPolicyOverrideRecords) {
    return null;
  }

  return {
    ...(evidenceRetentionPolicyOverrideRecords.systemCheckEvidenceRetentionTtlSeconds
      ? {
          systemCheckEvidenceRetentionTtlSeconds: toNumericPolicyOverrideRecordDto(
            evidenceRetentionPolicyOverrideRecords.systemCheckEvidenceRetentionTtlSeconds
          )
        }
      : {}),
    ...(evidenceRetentionPolicyOverrideRecords.systemCheckEvidenceInvestigationRetentionTtlSeconds
      ? {
          systemCheckEvidenceInvestigationRetentionTtlSeconds: toNumericPolicyOverrideRecordDto(
            evidenceRetentionPolicyOverrideRecords.systemCheckEvidenceInvestigationRetentionTtlSeconds
          )
        }
      : {})
  };
};

const getAuditPayloadString = (payload: Record<string, unknown>, key: string): string | undefined =>
  getTrimmedString(payload[key]);

const getAuditPayloadRecord = (payload: Record<string, unknown>, key: string): Record<string, unknown> | undefined => {
  const value = payload[key];
  return isRecord(value) ? value : undefined;
};

const getAuditPayloadNumber = (payload: Record<string, unknown>, key: string): number | undefined => {
  const value = payload[key];
  return typeof value === "number" && Number.isFinite(value) ? value : undefined;
};

const getAuditPayloadStringArray = (payload: Record<string, unknown>, key: string): string[] | undefined => {
  const value = payload[key];

  if (!Array.isArray(value)) {
    return undefined;
  }

  const stringValues = value.filter((item): item is string => typeof item === "string");
  return stringValues.length === value.length ? stringValues : undefined;
};

const getAuditPayloadRecordArray = (
  payload: Record<string, unknown>,
  key: string
): Record<string, unknown>[] | undefined => {
  const value = payload[key];

  if (!Array.isArray(value)) {
    return undefined;
  }

  const recordValues = value.filter((item): item is Record<string, unknown> => isRecord(item));
  return recordValues.length === value.length ? recordValues : undefined;
};

const getLatestAuditEventByType = (
  auditTrail: WorkspaceAuditEventDto[],
  eventType: string
): WorkspaceAuditEventDto | undefined =>
  [...auditTrail]
    .filter(auditEvent => auditEvent.eventType === eventType)
    .sort((left, right) => Date.parse(right.occurredAt) - Date.parse(left.occurredAt))[0];

const toImportJobValidationIssues = (
  payload: Record<string, unknown>,
  failedStage: string
): NonNullable<ImportJobDetailResponse["diagnostics"]["failure"]>["validationIssues"] => {
  const structuredIssues = getAuditPayloadRecordArray(payload, "validationIssues");

  if (structuredIssues) {
    return structuredIssues.flatMap(issue => {
      const code = getAuditPayloadString(issue, "code");
      const severity = getAuditPayloadString(issue, "severity");
      const scope = getAuditPayloadString(issue, "scope");
      const message = getAuditPayloadString(issue, "message");
      const path = getAuditPayloadString(issue, "path") ?? null;
      const mappingKeys = getAuditPayloadStringArray(issue, "mappingKeys") ?? [];

      if (
        !code ||
        !message ||
        (severity !== "error" && severity !== "warning") ||
        (scope !== "source_package" && scope !== "source_model" && scope !== "canonical_snapshot")
      ) {
        return [];
      }

      return [{
        code,
        severity,
        scope,
        path,
        message,
        mappingKeys
      }];
    });
  }

  const legacyIssues = getAuditPayloadStringArray(payload, "validationIssues");

  if (!legacyIssues) {
    return [];
  }

  const inferredScope =
    failedStage === "validate_source_model"
      ? "source_model"
      : failedStage === "validate_canonical_snapshot"
        ? "canonical_snapshot"
        : "source_package";

  return legacyIssues.map((message, index) => ({
    code: `legacy.${failedStage}.${index + 1}`,
    severity: "error" as const,
    scope: inferredScope,
    path: null,
    message,
    mappingKeys: []
  }));
};

const toImportJobEntityReference = (
  payload: Record<string, unknown>
): ImportJobDetailResponse["diagnostics"]["artifacts"]["referenceMappings"][number]["source"] | null => {
  const entityKind = getAuditPayloadString(payload, "entityKind");
  const identifier = getAuditPayloadString(payload, "identifier");
  const path = getAuditPayloadString(payload, "path") ?? null;

  if (
    !identifier ||
    (entityKind !== "unit" &&
      entityKind !== "booklet" &&
      entityKind !== "login_collection" &&
      entityKind !== "booklet_assignment")
  ) {
    return null;
  }

  return {
    entityKind,
    identifier,
    path
  };
};

const toImportJobReferenceMappings = (
  payload: Record<string, unknown>
): ImportJobDetailResponse["diagnostics"]["artifacts"]["referenceMappings"] => {
  const mappings = getAuditPayloadRecordArray(payload, "referenceMappings");

  if (!mappings) {
    return [];
  }

  return mappings.flatMap(mapping => {
    const mappingKey = getAuditPayloadString(mapping, "mappingKey");
    const source = isRecord(mapping.source) ? toImportJobEntityReference(mapping.source) : null;
    const canonical = isRecord(mapping.canonical) ? toImportJobEntityReference(mapping.canonical) : null;

    if (!mappingKey || !source) {
      return [];
    }

    return [{
      mappingKey,
      source,
      canonical
    }];
  });
};

const toTenantSummaryDto = (tenant: Tenant): TenantSummaryDto => ({
  tenantKey: tenant.tenantKey,
  displayName: tenant.displayName,
  status: tenant.status
});

const toWorkspaceSummaryDto = (workspace: Workspace): WorkspaceSummaryDto => ({
  workspaceKey: workspace.workspaceKey,
  displayName: workspace.displayName,
  status: workspace.status
});

const toSourcePackageSummaryDto = (sourcePackage: SourcePackage): SourcePackageSummaryDto => ({
  sourcePackageId: sourcePackage.sourcePackageId,
  fileName: sourcePackage.fileName,
  manifestHash: sourcePackage.manifestHash,
  format: sourcePackage.format,
  status: sourcePackage.status,
  uploadedAt: sourcePackage.uploadedAt,
  uploadedBy: sourcePackage.uploadedBy
});

const toImportJobSummaryDto = (importJob: ImportJob): ImportJobSummaryDto => ({
  importJobId: importJob.importJobId,
  sourcePackageId: importJob.sourcePackageId,
  status: importJob.status,
  createdAt: importJob.createdAt,
  completedAt: importJob.completedAt,
  failureMessage: importJob.failureMessage
});

const getContentReleaseSummaryMetrics = (contentRelease: ContentRelease): {
  bookletCount: number;
  loginCount: number;
  assignmentCount: number;
} => ({
  bookletCount: contentRelease.canonicalSnapshot.bookletDefinitions.length,
  loginCount: contentRelease.canonicalSnapshot.loginCollections.reduce(
    (count, collection) => count + collection.loginKeys.length,
    0
  ),
  assignmentCount: contentRelease.canonicalSnapshot.bookletAssignments.length
});

const emptyContentReleaseGuardrailContext: ContentReleaseGuardrailContext = {
  activeContentRelease: null,
  activationPolicy: {
    blockIncompatibleRoutingChangesWithActiveSessions: true,
    warnOnActiveSessions: true,
    warnOnHighRiskReleaseChange: true
  },
  activeSessions: []
};

const toContentReleaseDiffSummaryDto = (
  currentContentRelease: ContentRelease,
  previousContentRelease: ContentRelease | null
): ContentReleaseSummaryDto["comparisonToPrevious"] =>
  compareContentReleaseToPrevious(currentContentRelease, previousContentRelease);

const toContentReleaseActivationGuardrailDto = (
  contentRelease: ContentRelease,
  guardrailContext: ContentReleaseGuardrailContext
): ContentReleaseSummaryDto["activationGuardrail"] =>
  evaluateContentReleaseActivationGuardrail({
    target: contentRelease,
    active: guardrailContext.activeContentRelease,
    activeSessions: guardrailContext.activeSessions,
    policy: guardrailContext.activationPolicy
  });

const toContentReleaseSummaryDto = (
  contentRelease: ContentRelease,
  previousContentRelease: ContentRelease | null,
  guardrailContext: ContentReleaseGuardrailContext
): ContentReleaseSummaryDto => ({
  contentReleaseId: contentRelease.contentReleaseId,
  releaseLabel: contentRelease.releaseLabel,
  fixtureKey: contentRelease.fixtureKey,
  status: contentRelease.status,
  createdAt: contentRelease.createdAt,
  activatedAt: contentRelease.activatedAt,
  ...getContentReleaseSummaryMetrics(contentRelease),
  comparisonToPrevious: toContentReleaseDiffSummaryDto(contentRelease, previousContentRelease),
  activationGuardrail: toContentReleaseActivationGuardrailDto(contentRelease, guardrailContext)
});

const toBookletRunPolicyDto = (
  runPolicy: ContentRelease["canonicalSnapshot"]["bookletDefinitions"][number]["runPolicy"]
): BookletRunPolicyDto => ({
  navigationLocked: runPolicy.navigationLocked,
  timeLimitSeconds: runPolicy.timeLimitSeconds
});

const toSystemCheckDefinitionDto = (
  systemCheckDefinition: ContentRelease["canonicalSnapshot"]["systemCheckDefinitions"][number]
): SystemCheckDefinitionDto => ({
  systemCheckKey: systemCheckDefinition.systemCheckKey,
  title: systemCheckDefinition.title,
  checkKeys: systemCheckDefinition.checkKeys
});

const toSystemCheckEvidenceHoldDto = (
  retentionHold: SystemCheckEvidence["retentionHold"]
): SystemCheckEvidenceHoldDto | null =>
  retentionHold
    ? {
        heldAt: retentionHold.heldAt,
        holdReasonCode: retentionHold.holdReasonCode,
        holdNote: retentionHold.holdNote,
        heldByActorType: retentionHold.heldByActorType,
        heldByActorId: retentionHold.heldByActorId,
        acknowledgementRequired: retentionHold.acknowledgementRequired,
        acknowledgementStatus: getSystemCheckEvidenceHoldAcknowledgementStatus(retentionHold),
        acknowledgedAt: retentionHold.acknowledgedAt,
        acknowledgedByActorId: retentionHold.acknowledgedByActorId,
        acknowledgementNote: retentionHold.acknowledgementNote,
        defaultAssigneeTarget: retentionHold.defaultAssigneeTarget,
        assignmentStatus: getSystemCheckEvidenceHoldAssignmentStatus(retentionHold),
        assignedToActorId: retentionHold.assignedToActorId,
        assignedByActorId: retentionHold.assignedByActorId,
        assignedAt: retentionHold.assignedAt,
        assignmentNote: retentionHold.assignmentNote,
        slaSeconds: retentionHold.slaSeconds,
        slaDueAt: retentionHold.slaDueAt,
        slaStatus: getSystemCheckEvidenceHoldSlaStatus(retentionHold),
        escalationTarget: retentionHold.escalationTarget,
        escalationStatus: getSystemCheckEvidenceHoldEscalationStatus(retentionHold),
        escalatedAt: retentionHold.escalatedAt,
        escalatedByActorId: retentionHold.escalatedByActorId,
        escalationNote: retentionHold.escalationNote
      }
    : null;

const toSystemCheckEvidenceSummaryDto = (
  systemCheckEvidence: SystemCheckEvidence
): SystemCheckEvidenceSummaryDto => ({
  evidenceKey: systemCheckEvidence.evidenceKey,
  systemCheckKey: systemCheckEvidence.systemCheckKey,
  checkKey: systemCheckEvidence.checkKey,
  fileName: systemCheckEvidence.fileName,
  contentType: systemCheckEvidence.contentType,
  byteSize: systemCheckEvidence.byteSize,
  sha256: systemCheckEvidence.sha256,
  createdAt: systemCheckEvidence.createdAt,
  storage: {
    storageBackend: systemCheckEvidence.storageBackend,
    retrievalMode: "access_grant_required",
    inlinePayloadAvailable: false,
    payloadAvailability: getSystemCheckEvidencePayloadAvailability(systemCheckEvidence)
  },
  retention: {
    state: getSystemCheckEvidenceRetentionState(systemCheckEvidence),
    retentionClass: systemCheckEvidence.retentionClass,
    retentionPolicyKey: systemCheckEvidence.retentionPolicyKey,
    expiresAt: systemCheckEvidence.retentionExpiresAt,
    hold: toSystemCheckEvidenceHoldDto(systemCheckEvidence.retentionHold),
    purgedAt: systemCheckEvidence.purgedAt,
    purgeReasonCode: systemCheckEvidence.purgeReasonCode
  }
});

const toSystemCheckEvidenceDetailDto = (
  systemCheckEvidence: SystemCheckEvidence
): SystemCheckEvidenceDetailDto => ({
  ...toSystemCheckEvidenceSummaryDto(systemCheckEvidence),
  payloadPreviewText: getSystemCheckEvidencePreviewText(systemCheckEvidence)
});

const toWorkspaceSystemCheckEvidenceHoldQueueItemDto = (
  systemCheckEvidence: SystemCheckEvidence
): WorkspaceSystemCheckEvidenceHoldQueueItemDto => ({
  participantSessionId: systemCheckEvidence.participantSessionId,
  contentReleaseId: systemCheckEvidence.contentReleaseId,
  loginKey: systemCheckEvidence.loginKey,
  groupKey: systemCheckEvidence.groupKey,
  evidence: toSystemCheckEvidenceSummaryDto(systemCheckEvidence)
});

const toWorkspaceSystemCheckEvidenceBreachQueueItemDto = (
  systemCheckEvidence: SystemCheckEvidence,
  breachQueueStatus: SystemCheckEvidenceBreachQueueStatusDto
): WorkspaceSystemCheckEvidenceBreachQueueItemDto => ({
  participantSessionId: systemCheckEvidence.participantSessionId,
  contentReleaseId: systemCheckEvidence.contentReleaseId,
  loginKey: systemCheckEvidence.loginKey,
  groupKey: systemCheckEvidence.groupKey,
  breachQueueStatus,
  evidence: toSystemCheckEvidenceSummaryDto(systemCheckEvidence)
});

const toSystemCheckEvidenceBreachNotificationDto = (input: {
  notification: import("@testcenter-rewrite/domain").SystemCheckEvidenceBreachNotification;
  systemCheckEvidence: SystemCheckEvidence;
}): SystemCheckEvidenceBreachNotificationDto => ({
  notificationId: input.notification.notificationId,
  participantSessionId: input.notification.participantSessionId,
  contentReleaseId: input.notification.contentReleaseId,
  loginKey: input.notification.loginKey,
  groupKey: input.notification.groupKey,
  holdReasonCode: input.notification.holdReasonCode,
  escalationTarget: input.notification.escalationTarget,
  assignedToActorId: input.notification.assignedToActorId,
  notificationChannel: input.notification.notificationChannel,
  status: input.notification.status,
  createdAt: input.notification.createdAt,
  createdByActorType: input.notification.createdByActorType,
  createdByActorId: input.notification.createdByActorId,
  sourceRequestId: input.notification.sourceRequestId,
  deliveryProfileKey: input.notification.deliveryProfileKey,
  delivery: {
    channel: input.notification.deliveryChannel,
    status: input.notification.deliveryStatus,
    target: input.notification.deliveryTarget,
    attemptCount: input.notification.deliveryAttemptCount,
    maxAttempts: input.notification.maxDeliveryAttempts,
    nextAttemptAt: input.notification.nextDeliveryAttemptAt,
    lastAttemptAt: input.notification.lastDeliveryAttemptAt,
    receiptId: input.notification.lastDeliveryReceiptId,
    receiptIssuedAt: input.notification.lastDeliveryReceiptIssuedAt,
    deliveredAt: input.notification.deliveredAt,
    lastError: input.notification.lastDeliveryError
  },
  acknowledgedAt: input.notification.acknowledgedAt,
  acknowledgedByActorId: input.notification.acknowledgedByActorId,
  acknowledgementNote: input.notification.acknowledgementNote,
  evidence: toSystemCheckEvidenceSummaryDto(input.systemCheckEvidence)
});

const toSystemCheckEvidenceAccessGrantDto = (
  accessGrant: SystemCheckEvidenceAccessGrant
): SystemCheckEvidenceAccessGrantDto => ({
  accessToken: accessGrant.accessToken,
  evidenceKey: accessGrant.evidenceKey,
  issuedFor: accessGrant.issuedFor,
  issuedAt: accessGrant.issuedAt,
  expiresAt: accessGrant.expiresAt,
  retrievalUrl: apiRoutes.systemCheckEvidenceAccess(accessGrant.accessToken)
});

const toSystemCheckLaunchApprovalDto = (
  launchApproval: SystemCheckLaunchApproval
): SystemCheckLaunchApprovalDto => ({
  launchApprovalId: launchApproval.launchApprovalId,
  participantSessionId: launchApproval.participantSessionId,
  contentReleaseId: launchApproval.contentReleaseId,
  loginKey: launchApproval.loginKey,
  groupKey: launchApproval.groupKey,
  assignmentKey: launchApproval.assignmentKey,
  readinessStatus: launchApproval.readinessStatus,
  warningReasonCodes: launchApproval.warningReasonCodes,
  approvalScope: launchApproval.approvalScope,
  status: launchApproval.status,
  approvedAt: launchApproval.approvedAt,
  approvedBySupervisorId: launchApproval.approvedBySupervisorId,
  approvalNote: launchApproval.approvalNote,
  expiresAt: launchApproval.expiresAt,
  consumedAt: launchApproval.consumedAt,
  consumedByTestRunId: launchApproval.consumedByTestRunId,
  invalidatedAt: launchApproval.invalidatedAt,
  invalidationReasonCode: launchApproval.invalidationReasonCode,
  invalidationReasonDetail: launchApproval.invalidationReasonDetail,
  expiredAt: launchApproval.expiredAt,
  expirationReasonCode: launchApproval.expirationReasonCode,
  revokedAt: launchApproval.revokedAt,
  revokedBySupervisorId: launchApproval.revokedBySupervisorId,
  revocationNote: launchApproval.revocationNote
});

const toSystemCheckLaunchCheckReadinessDto = (
  checkReadiness: ReturnType<typeof evaluateSystemCheckLaunchReadiness>["checks"][number],
  contentRelease: ContentRelease
): SystemCheckLaunchCheckReadinessDto => ({
  systemCheckKey: checkReadiness.systemCheckKey,
  systemCheckTitle: getSystemCheckDefinition(contentRelease, checkReadiness.systemCheckKey)?.title ?? null,
  readinessStatus: checkReadiness.readinessStatus,
  reasonCodes: checkReadiness.reasonCodes,
  submissionId: checkReadiness.submission?.systemCheckSubmissionId ?? null,
  submissionStatus: checkReadiness.submission?.status ?? null,
  reviewStatus: checkReadiness.submission?.reviewStatus ?? null,
  submittedAt: checkReadiness.submission?.submittedAt ?? null,
  reviewedAt: checkReadiness.submission?.reviewedAt ?? null
});

const toSystemCheckLaunchReadinessDto = (
  contentRelease: ContentRelease,
  submissions: SystemCheckSubmission[]
): SystemCheckLaunchReadinessDto => {
  const launchReadiness = evaluateSystemCheckLaunchReadiness({
    contentRelease,
    submissions
  });

  return {
    status: launchReadiness.status,
    blockingReasonCodes: launchReadiness.blockingReasonCodes,
    warningReasonCodes: launchReadiness.warningReasonCodes,
    checks: launchReadiness.checks.map(checkReadiness =>
      toSystemCheckLaunchCheckReadinessDto(checkReadiness, contentRelease)
    )
  };
};

const collectSystemCheckEvidenceKeys = (
  checkResults: Record<string, {
    evidenceKeys: string[];
  }>
): string[] =>
  [...new Set(
    Object.values(checkResults).flatMap(checkResult => checkResult.evidenceKeys)
  )];

const loadSystemCheckEvidenceMap = async (
  store: PlatformStore,
  checkResultsCollection: Array<Record<string, {
    evidenceKeys: string[];
  }>>
): Promise<Map<string, SystemCheckEvidence>> => {
  const evidenceKeys = [...new Set(
    checkResultsCollection.flatMap(checkResults => collectSystemCheckEvidenceKeys(checkResults))
  )];
  const evidenceItems = await store.listSystemCheckEvidenceByKeys(evidenceKeys);

  return new Map(evidenceItems.map(systemCheckEvidence => [systemCheckEvidence.evidenceKey, systemCheckEvidence]));
};

const toSystemCheckSubmissionDto = (
  systemCheckSubmission: SystemCheckSubmission,
  options: {
    systemCheckTitle: string | null;
    evidenceByKey?: Map<string, SystemCheckEvidence>;
  }
): SystemCheckSubmissionDto => {
  const summary = summarizeSystemCheckResults(systemCheckSubmission.checkResults);
  const evidenceByKey = options.evidenceByKey ?? new Map<string, SystemCheckEvidence>();
  const checkResults = Object.fromEntries(
    Object.entries(systemCheckSubmission.checkResults).map(([checkKey, checkResult]) => [
      checkKey,
      {
        status: checkResult.status,
        detailMessage: checkResult.detailMessage,
        observedValue: checkResult.observedValue,
        evidenceKeys: checkResult.evidenceKeys,
        evidenceItems: checkResult.evidenceKeys
          .map(evidenceKey => evidenceByKey.get(evidenceKey))
          .filter((systemCheckEvidence): systemCheckEvidence is SystemCheckEvidence => Boolean(systemCheckEvidence))
          .map(toSystemCheckEvidenceSummaryDto)
      }
    ])
  );

  return {
    systemCheckSubmissionId: systemCheckSubmission.systemCheckSubmissionId,
    participantSessionId: systemCheckSubmission.participantSessionId,
    contentReleaseId: systemCheckSubmission.contentReleaseId,
    loginKey: systemCheckSubmission.loginKey,
    groupKey: systemCheckSubmission.groupKey,
    systemCheckKey: systemCheckSubmission.systemCheckKey,
    systemCheckTitle: options.systemCheckTitle,
    status: systemCheckSubmission.status,
    checkResults,
    review: {
      reviewStatus: systemCheckSubmission.reviewStatus,
      reviewNote: systemCheckSubmission.reviewNote,
      reviewedAt: systemCheckSubmission.reviewedAt,
      reviewedByActorType: systemCheckSubmission.reviewedByActorType,
      reviewedByActorId: systemCheckSubmission.reviewedByActorId
    },
    summary: {
      totalChecks: summary.totalChecks,
      passedChecks: summary.passedChecks,
      warningChecks: summary.warningChecks,
      failedChecks: summary.failedChecks
    },
    submittedAt: systemCheckSubmission.submittedAt
  };
};

const toContentReleaseDetailDto = (
  contentRelease: ContentRelease,
  previousContentRelease: ContentRelease | null,
  guardrailContext: ContentReleaseGuardrailContext
): ContentReleaseDetailDto => ({
  ...toContentReleaseSummaryDto(contentRelease, previousContentRelease, guardrailContext),
  sourcePackageId: contentRelease.sourcePackageId,
  importJobId: contentRelease.importJobId,
  unitCount: contentRelease.canonicalSnapshot.unitKeys.length
});

const toContentReleaseCanonicalSnapshotDto = (
  canonicalSnapshot: ContentRelease["canonicalSnapshot"]
): ContentReleaseDetailResponse["canonicalSnapshot"] => ({
  fixtureKey: canonicalSnapshot.fixtureKey,
  unitKeys: canonicalSnapshot.unitKeys,
  bookletDefinitions: canonicalSnapshot.bookletDefinitions.map(booklet => ({
    bookletKey: booklet.bookletKey,
    title: booklet.title,
    unitKeys: booklet.unitKeys,
    unitCount: booklet.unitKeys.length,
    runPolicy: toBookletRunPolicyDto(booklet.runPolicy)
  })),
  loginCollections: canonicalSnapshot.loginCollections.map(collection => ({
    collectionKey: collection.collectionKey,
    groupKey: collection.groupKey,
    loginKeys: collection.loginKeys
  })),
  bookletAssignments: canonicalSnapshot.bookletAssignments.map(assignment => ({
    assignmentKey: assignment.assignmentKey,
    loginKey: assignment.loginKey,
    bookletKey: assignment.bookletKey,
    initialStateOverrides: assignment.initialStateOverrides
  })),
  systemCheckDefinitions: canonicalSnapshot.systemCheckDefinitions.map(toSystemCheckDefinitionDto)
});

const toContentReleaseMonitorProjectionDto = (
  contentRelease: ContentRelease
): ContentReleaseMonitorProjectionResponse["projection"] => {
  const projection = buildContentReleaseMonitorProjection(contentRelease);

  return {
    groups: projection.groups.map(group => ({
      collectionKey: group.collectionKey,
      groupKey: group.groupKey,
      loginKeys: group.loginKeys,
      assignments: group.assignments.map(assignment => ({
        assignmentKey: assignment.assignmentKey,
        loginKey: assignment.loginKey,
        bookletKey: assignment.bookletKey,
        bookletTitle: assignment.bookletTitle,
        unitCount: assignment.unitCount,
        initialStateOverrides: assignment.initialStateOverrides
      }))
    })),
    booklets: projection.booklets.map(booklet => ({
      bookletKey: booklet.bookletKey,
      title: booklet.title,
      runPolicy: toBookletRunPolicyDto(booklet.runPolicy),
      unitKeys: booklet.unitKeys,
      groupKeys: booklet.groupKeys,
      loginKeys: booklet.loginKeys,
      assignmentKeys: booklet.assignmentKeys
    }))
  };
};

const toContentReleaseSystemCheckProjectionDto = (
  contentRelease: ContentRelease
): ContentReleaseSystemCheckProjectionResponse["projection"] => {
  const projection = buildContentReleaseSystemCheckProjection(contentRelease);

  return {
    systemChecks: projection.systemChecks.map(toSystemCheckDefinitionDto),
    groupKeys: projection.groupKeys,
    loginKeys: projection.loginKeys,
    loginCount: projection.loginCount
  };
};

const toContentReleaseSummaryDtos = (
  contentReleases: ContentRelease[],
  guardrailContext: ContentReleaseGuardrailContext
): ContentReleaseSummaryDto[] =>
  contentReleases.map((contentRelease, index) =>
    toContentReleaseSummaryDto(contentRelease, contentReleases[index + 1] ?? null, guardrailContext)
  );

const getPreviousContentRelease = (
  contentReleases: ContentRelease[],
  contentReleaseId: string
): ContentRelease | null => {
  const currentIndex = contentReleases.findIndex(contentRelease => contentRelease.contentReleaseId === contentReleaseId);
  return currentIndex >= 0 ? contentReleases[currentIndex + 1] ?? null : null;
};

const toParticipantStarterAssignmentDto = (assignment: StarterAssignment): ParticipantStarterAssignmentDto => ({
  assignmentKey: assignment.assignmentKey,
  bookletKey: assignment.bookletKey,
  bookletTitle: assignment.bookletTitle,
  unitCount: assignment.unitCount,
  initialStateOverrides: assignment.initialStateOverrides
});

const toTestRunPolicyDto = (testRun: TestRun): TestRunPolicyDto => ({
  navigationLocked: testRun.navigationLocked,
  timeLimitSeconds: testRun.timeLimitSeconds,
  timeRemainingSeconds: getTimeRemainingSeconds(testRun),
  pausedAt: testRun.pausedAt
});

const toWorkspaceMonitorTestRunDto = (testRun: TestRun): WorkspaceMonitorTestRunDto => ({
  testRunId: testRun.testRunId,
  participantSessionId: testRun.participantSessionId,
  loginKey: testRun.loginKey,
  groupKey: testRun.groupKey,
  assignmentKey: testRun.assignmentKey,
  attemptNumber: testRun.attemptNumber,
  bookletKey: testRun.bookletKey,
  bookletTitle: testRun.bookletTitle,
  status: testRun.status,
  currentUnitKey: testRun.currentUnitKey,
  currentUnitIndex: testRun.currentUnitIndex,
  totalUnits: testRun.unitSequence.length,
  runPolicy: toTestRunPolicyDto(testRun),
  createdAt: testRun.createdAt,
  updatedAt: testRun.updatedAt
});

const toWorkspaceAuditEventDto = (
  auditEvent: import("@testcenter-rewrite/domain").AuditEvent
): WorkspaceAuditEventDto => ({
  auditEventId: auditEvent.auditEventId,
  requestId: auditEvent.requestId,
  actorType: auditEvent.actorType,
  actorId: auditEvent.actorId,
  eventType: auditEvent.eventType,
  participantSessionId: auditEvent.participantSessionId,
  testRunId: auditEvent.testRunId,
  loginKey: auditEvent.loginKey,
  groupKey: auditEvent.groupKey,
  assignmentKey: auditEvent.assignmentKey,
  occurredAt: auditEvent.occurredAt,
  payload: auditEvent.payload
});

const getSystemCheckEvidenceRetentionHistoryEventType = (
  auditEventType: string
): SystemCheckEvidenceRetentionHistoryEventTypeDto | undefined => {
  if (auditEventType === "participant.system_check.evidence_captured") {
    return "captured";
  }

  if (auditEventType === "workspace.system_check.evidence_hold.applied") {
    return "hold_applied";
  }

  if (auditEventType === "workspace.system_check.evidence_hold.assigned") {
    return "hold_assigned";
  }

  if (auditEventType === "workspace.system_check.evidence_hold.acknowledged") {
    return "hold_acknowledged";
  }

  if (auditEventType === "workspace.system_check.evidence_hold.escalated") {
    return "hold_escalated";
  }

  if (auditEventType === "worker.system_check_evidence.hold_escalated") {
    return "hold_escalated";
  }

  if (auditEventType === "workspace.system_check.evidence_hold.released") {
    return "hold_released";
  }

  if (auditEventType === "worker.system_check_evidence.purged") {
    return "purged";
  }

  return undefined;
};

const toSystemCheckEvidenceRetentionHistoryEntryDto = (
  auditEvent: import("@testcenter-rewrite/domain").AuditEvent
): SystemCheckEvidenceRetentionHistoryEntryDto | undefined => {
  const eventType = getSystemCheckEvidenceRetentionHistoryEventType(auditEvent.eventType);

  if (!eventType) {
    return undefined;
  }

  const holdReasonCode = getAuditPayloadString(auditEvent.payload, "holdReasonCode");
  const holdNote = getAuditPayloadString(auditEvent.payload, "holdNote");
  const releaseNote = getAuditPayloadString(auditEvent.payload, "releaseNote");
  const retentionExpiresAt = getAuditPayloadString(auditEvent.payload, "retentionExpiresAt") ?? null;
  const purgeReasonCode = getAuditPayloadString(auditEvent.payload, "purgeReasonCode");
  const retentionClass = getAuditPayloadString(auditEvent.payload, "retentionClass");
  const retentionPolicyKey = getAuditPayloadString(auditEvent.payload, "retentionPolicyKey");
  const acknowledgementRequired =
    typeof auditEvent.payload.acknowledgementRequired === "boolean"
      ? auditEvent.payload.acknowledgementRequired
      : null;
  const acknowledgementStatus = getAuditPayloadString(auditEvent.payload, "acknowledgementStatus");
  const acknowledgedAt = getAuditPayloadString(auditEvent.payload, "acknowledgedAt") ?? null;
  const acknowledgedByActorId = getAuditPayloadString(auditEvent.payload, "acknowledgedByActorId") ?? null;
  const acknowledgementNote = getAuditPayloadString(auditEvent.payload, "acknowledgementNote") ?? null;
  const defaultAssigneeTarget =
    getAuditPayloadString(auditEvent.payload, "defaultAssigneeTarget") ?? null;
  const assignmentStatus = getAuditPayloadString(auditEvent.payload, "assignmentStatus");
  const assignedToActorId = getAuditPayloadString(auditEvent.payload, "assignedToActorId") ?? null;
  const assignedByActorId = getAuditPayloadString(auditEvent.payload, "assignedByActorId") ?? null;
  const assignedAt = getAuditPayloadString(auditEvent.payload, "assignedAt") ?? null;
  const assignmentNote = getAuditPayloadString(auditEvent.payload, "assignmentNote") ?? null;
  const slaSeconds = getAuditPayloadNumber(auditEvent.payload, "slaSeconds") ?? null;
  const slaDueAt = getAuditPayloadString(auditEvent.payload, "slaDueAt") ?? null;
  const slaStatus = getAuditPayloadString(auditEvent.payload, "slaStatus");
  const escalationTarget = getAuditPayloadString(auditEvent.payload, "escalationTarget") ?? null;
  const escalationStatus = getAuditPayloadString(auditEvent.payload, "escalationStatus");
  const escalatedAt = getAuditPayloadString(auditEvent.payload, "escalatedAt") ?? null;
  const escalatedByActorId = getAuditPayloadString(auditEvent.payload, "escalatedByActorId") ?? null;
  const escalationNote = getAuditPayloadString(auditEvent.payload, "escalationNote") ?? null;

  return {
    auditEventId: auditEvent.auditEventId,
    requestId: auditEvent.requestId,
    eventType,
    actorType: auditEvent.actorType,
    actorId: auditEvent.actorId,
    occurredAt: auditEvent.occurredAt,
    stateAfter:
      eventType === "captured" || eventType === "hold_released"
        ? "retained"
        : eventType === "hold_applied" ||
            eventType === "hold_assigned" ||
            eventType === "hold_acknowledged" ||
            eventType === "hold_escalated"
          ? "held"
          : "purged",
    details: {
      retentionClass: retentionClass ?? null,
      retentionPolicyKey: retentionPolicyKey ?? null,
      retentionExpiresAt,
      holdReasonCode: holdReasonCode ?? null,
      holdNote: holdNote ?? null,
      acknowledgementRequired,
      acknowledgementStatus:
        acknowledgementStatus === "not_required" ||
        acknowledgementStatus === "pending" ||
        acknowledgementStatus === "acknowledged"
          ? acknowledgementStatus
          : null,
      acknowledgedAt,
      acknowledgedByActorId,
      acknowledgementNote,
      defaultAssigneeTarget,
      assignmentStatus:
        assignmentStatus === "unassigned" || assignmentStatus === "assigned"
          ? assignmentStatus
          : null,
      assignedToActorId,
      assignedByActorId,
      assignedAt,
      assignmentNote,
      slaSeconds,
      slaDueAt,
      slaStatus:
        slaStatus === "not_applicable" ||
        slaStatus === "on_track" ||
        slaStatus === "breached" ||
        slaStatus === "acknowledged"
          ? slaStatus
          : null,
      escalationTarget,
      escalationStatus:
        escalationStatus === "not_applicable" ||
        escalationStatus === "pending" ||
        escalationStatus === "breached" ||
        escalationStatus === "acknowledged" ||
        escalationStatus === "escalated"
          ? escalationStatus
          : null,
      escalatedAt,
      escalatedByActorId,
      escalationNote,
      purgeReasonCode: purgeReasonCode === "retention_elapsed" ? purgeReasonCode : null,
      releaseNote: releaseNote ?? null
    }
  };
};

const toPolicyHistoryEntryDto = (
  auditEvent: import("@testcenter-rewrite/domain").AuditEvent,
  context: {
    tenantKey: string;
    workspaceKey?: string | null;
  }
): PolicyHistoryEntryDto | undefined => {
  const baseEntry = {
    auditEventId: auditEvent.auditEventId,
    requestId: auditEvent.requestId,
    tenantKey: context.tenantKey,
    workspaceKey: context.workspaceKey ?? null,
    actorType: auditEvent.actorType,
    actorId: auditEvent.actorId,
    eventType: auditEvent.eventType,
    occurredAt: auditEvent.occurredAt
  };

  const emptyPolicyState = {
    defaultActivationPolicy: null,
    activationPolicyOverride: null,
    activationPolicyOverrideRecords: null,
    effectiveActivationPolicy: null,
    defaultOperationalPolicy: null,
    operationalPolicyOverride: null,
    operationalPolicyOverrideRecords: null,
    effectiveOperationalPolicy: null,
    defaultLaunchApprovalPolicy: null,
    launchApprovalPolicyOverride: null,
    launchApprovalPolicyOverrideRecords: null,
    effectiveLaunchApprovalPolicy: null,
    defaultNotificationProviderPromotionPolicy: null,
    notificationProviderPromotionPolicyOverride: null,
    notificationProviderPromotionPolicyOverrideRecords: null,
    effectiveNotificationProviderPromotionPolicy: null,
    defaultNotificationPolicy: null,
    notificationPolicyOverride: null,
    notificationPolicyOverrideRecords: null,
    effectiveNotificationPolicy: null,
    defaultGovernanceNotificationPolicy: null,
    governanceNotificationPolicyOverride: null,
    governanceNotificationPolicyOverrideRecords: null,
    effectiveGovernanceNotificationPolicy: null,
    defaultRecoveryGovernanceNotificationPolicy: null,
    recoveryGovernanceNotificationPolicyOverride: null,
    recoveryGovernanceNotificationPolicyOverrideRecords: null,
    effectiveRecoveryGovernanceNotificationPolicy: null,
    defaultNotificationProviderProfiles: null,
    notificationProviderProfileOverride: null,
    removedNotificationProviderProfileKeys: null,
    notificationProviderProfileOverrideRecords: null,
    effectiveNotificationProviderProfiles: null,
    defaultEvidenceRetentionPolicy: null,
    evidenceRetentionPolicyOverride: null,
    evidenceRetentionPolicyOverrideRecords: null,
    effectiveEvidenceRetentionPolicy: null,
    defaultEvidenceRetentionClassPolicy: null,
    evidenceRetentionClassPolicyOverride: null,
    evidenceRetentionClassPolicyOverrideRecords: null,
    effectiveEvidenceRetentionClassPolicy: null
  };

  if (auditEvent.eventType === "tenant.activation_policy.updated") {
    const defaultActivationPolicy = getAuditPayloadRecord(auditEvent.payload, "defaultActivationPolicy");

    if (!isContentReleaseActivationPolicy(defaultActivationPolicy)) {
      return undefined;
    }

    return {
      ...baseEntry,
      ...emptyPolicyState,
      policyFamily: "activation",
      scope: "tenant_default",
      mode: "default",
      changedFields: [...activationPolicyOverrideKeys],
      clearedFields: [],
      defaultActivationPolicy,
      activationPolicyOverride: null,
      activationPolicyOverrideRecords: null,
      effectiveActivationPolicy: defaultActivationPolicy,
      defaultOperationalPolicy: null,
      operationalPolicyOverride: null,
      operationalPolicyOverrideRecords: null,
      effectiveOperationalPolicy: null,
      defaultLaunchApprovalPolicy: null,
      launchApprovalPolicyOverride: null,
      launchApprovalPolicyOverrideRecords: null,
      effectiveLaunchApprovalPolicy: null,
      defaultNotificationPolicy: null,
      notificationPolicyOverride: null,
      notificationPolicyOverrideRecords: null,
      effectiveNotificationPolicy: null
    };
  }

  if (auditEvent.eventType === "workspace.activation_policy.updated") {
    const defaultActivationPolicyRecord = getAuditPayloadRecord(auditEvent.payload, "defaultActivationPolicy");
    const activationPolicyOverrideRecord = getAuditPayloadRecord(auditEvent.payload, "activationPolicyOverride");
    const activationPolicyOverrideRecordsRecord = getAuditPayloadRecord(auditEvent.payload, "activationPolicyOverrideRecords");
    const effectiveActivationPolicyRecord = getAuditPayloadRecord(auditEvent.payload, "effectiveActivationPolicy");
    const mode = isWorkspaceActivationPolicyMode(auditEvent.payload.mode) ? auditEvent.payload.mode : "override";

    return {
      ...baseEntry,
      ...emptyPolicyState,
      policyFamily: "activation",
      scope: "workspace_override",
      mode,
      changedFields: getAuditPayloadStringArray(auditEvent.payload, "changedFields") ?? [],
      clearedFields: getAuditPayloadStringArray(auditEvent.payload, "clearedFields") ?? [],
      defaultActivationPolicy: isContentReleaseActivationPolicy(defaultActivationPolicyRecord)
        ? defaultActivationPolicyRecord
        : null,
      activationPolicyOverride: isContentReleaseActivationPolicyOverride(activationPolicyOverrideRecord)
        ? activationPolicyOverrideRecord
        : null,
      activationPolicyOverrideRecords: isActivationPolicyOverrideRecords(activationPolicyOverrideRecordsRecord)
        ? activationPolicyOverrideRecordsRecord
        : null,
      effectiveActivationPolicy: isContentReleaseActivationPolicy(effectiveActivationPolicyRecord)
        ? effectiveActivationPolicyRecord
        : null,
      defaultOperationalPolicy: null,
      operationalPolicyOverride: null,
      operationalPolicyOverrideRecords: null,
      effectiveOperationalPolicy: null,
      defaultLaunchApprovalPolicy: null,
      launchApprovalPolicyOverride: null,
      launchApprovalPolicyOverrideRecords: null,
      effectiveLaunchApprovalPolicy: null,
      defaultNotificationPolicy: null,
      notificationPolicyOverride: null,
      notificationPolicyOverrideRecords: null,
      effectiveNotificationPolicy: null
    };
  }

  if (auditEvent.eventType === "tenant.operational_policy.updated") {
    const defaultOperationalPolicy = getAuditPayloadRecord(auditEvent.payload, "defaultOperationalPolicy");

    if (!isOperationalPolicy(defaultOperationalPolicy)) {
      return undefined;
    }

    return {
      ...baseEntry,
      ...emptyPolicyState,
      policyFamily: "operational",
      scope: "tenant_default",
      mode: "default",
      changedFields: [...operationalPolicyOverrideKeys],
      clearedFields: [],
      defaultActivationPolicy: null,
      activationPolicyOverride: null,
      activationPolicyOverrideRecords: null,
      effectiveActivationPolicy: null,
      defaultOperationalPolicy,
      operationalPolicyOverride: null,
      operationalPolicyOverrideRecords: null,
      effectiveOperationalPolicy: defaultOperationalPolicy,
      defaultLaunchApprovalPolicy: null,
      launchApprovalPolicyOverride: null,
      launchApprovalPolicyOverrideRecords: null,
      effectiveLaunchApprovalPolicy: null,
      defaultNotificationPolicy: null,
      notificationPolicyOverride: null,
      notificationPolicyOverrideRecords: null,
      effectiveNotificationPolicy: null
    };
  }

  if (auditEvent.eventType === "workspace.operational_policy.updated") {
    const defaultOperationalPolicyRecord = getAuditPayloadRecord(auditEvent.payload, "defaultOperationalPolicy");
    const operationalPolicyOverrideRecord = getAuditPayloadRecord(auditEvent.payload, "operationalPolicyOverride");
    const operationalPolicyOverrideRecordsRecord = getAuditPayloadRecord(auditEvent.payload, "operationalPolicyOverrideRecords");
    const effectiveOperationalPolicyRecord = getAuditPayloadRecord(auditEvent.payload, "effectiveOperationalPolicy");
    const mode = isWorkspaceOperationalPolicyMode(auditEvent.payload.mode) ? auditEvent.payload.mode : "override";

    return {
      ...baseEntry,
      ...emptyPolicyState,
      policyFamily: "operational",
      scope: "workspace_override",
      mode,
      changedFields: getAuditPayloadStringArray(auditEvent.payload, "changedFields") ?? [],
      clearedFields: getAuditPayloadStringArray(auditEvent.payload, "clearedFields") ?? [],
      defaultActivationPolicy: null,
      activationPolicyOverride: null,
      activationPolicyOverrideRecords: null,
      effectiveActivationPolicy: null,
      defaultOperationalPolicy: isOperationalPolicy(defaultOperationalPolicyRecord)
        ? defaultOperationalPolicyRecord
        : null,
      operationalPolicyOverride: isOperationalPolicyOverride(operationalPolicyOverrideRecord)
        ? operationalPolicyOverrideRecord
        : null,
      operationalPolicyOverrideRecords: isOperationalPolicyOverrideRecords(operationalPolicyOverrideRecordsRecord)
        ? operationalPolicyOverrideRecordsRecord
        : null,
      effectiveOperationalPolicy: isOperationalPolicy(effectiveOperationalPolicyRecord)
        ? effectiveOperationalPolicyRecord
        : null,
      defaultLaunchApprovalPolicy: null,
      launchApprovalPolicyOverride: null,
      launchApprovalPolicyOverrideRecords: null,
      effectiveLaunchApprovalPolicy: null,
      defaultNotificationPolicy: null,
      notificationPolicyOverride: null,
      notificationPolicyOverrideRecords: null,
      effectiveNotificationPolicy: null
    };
  }

  if (auditEvent.eventType === "tenant.launch_approval_policy.updated") {
    const defaultLaunchApprovalPolicy = getAuditPayloadRecord(auditEvent.payload, "defaultLaunchApprovalPolicy");

    if (!isLaunchApprovalPolicy(defaultLaunchApprovalPolicy)) {
      return undefined;
    }

    return {
      ...baseEntry,
      ...emptyPolicyState,
      policyFamily: "launch_approval",
      scope: "tenant_default",
      mode: "default",
      changedFields: [...launchApprovalPolicyOverrideKeys],
      clearedFields: [],
      defaultActivationPolicy: null,
      activationPolicyOverride: null,
      activationPolicyOverrideRecords: null,
      effectiveActivationPolicy: null,
      defaultOperationalPolicy: null,
      operationalPolicyOverride: null,
      operationalPolicyOverrideRecords: null,
      effectiveOperationalPolicy: null,
      defaultLaunchApprovalPolicy,
      launchApprovalPolicyOverride: null,
      launchApprovalPolicyOverrideRecords: null,
      effectiveLaunchApprovalPolicy: defaultLaunchApprovalPolicy
    };
  }

  if (auditEvent.eventType === "workspace.launch_approval_policy.updated") {
    const defaultLaunchApprovalPolicyRecord = getAuditPayloadRecord(auditEvent.payload, "defaultLaunchApprovalPolicy");
    const launchApprovalPolicyOverrideRecord = getAuditPayloadRecord(auditEvent.payload, "launchApprovalPolicyOverride");
    const launchApprovalPolicyOverrideRecordsRecord = getAuditPayloadRecord(
      auditEvent.payload,
      "launchApprovalPolicyOverrideRecords"
    );
    const effectiveLaunchApprovalPolicyRecord = getAuditPayloadRecord(
      auditEvent.payload,
      "effectiveLaunchApprovalPolicy"
    );
    const mode = isWorkspaceLaunchApprovalPolicyMode(auditEvent.payload.mode)
      ? auditEvent.payload.mode
      : "override";

    return {
      ...baseEntry,
      ...emptyPolicyState,
      policyFamily: "launch_approval",
      scope: "workspace_override",
      mode,
      changedFields: getAuditPayloadStringArray(auditEvent.payload, "changedFields") ?? [],
      clearedFields: getAuditPayloadStringArray(auditEvent.payload, "clearedFields") ?? [],
      defaultActivationPolicy: null,
      activationPolicyOverride: null,
      activationPolicyOverrideRecords: null,
      effectiveActivationPolicy: null,
      defaultOperationalPolicy: null,
      operationalPolicyOverride: null,
      operationalPolicyOverrideRecords: null,
      effectiveOperationalPolicy: null,
      defaultLaunchApprovalPolicy: isLaunchApprovalPolicy(defaultLaunchApprovalPolicyRecord)
        ? defaultLaunchApprovalPolicyRecord
        : null,
      launchApprovalPolicyOverride: isLaunchApprovalPolicyOverride(launchApprovalPolicyOverrideRecord)
        ? launchApprovalPolicyOverrideRecord
        : null,
      launchApprovalPolicyOverrideRecords:
        isLaunchApprovalPolicyOverrideRecords(launchApprovalPolicyOverrideRecordsRecord)
          ? launchApprovalPolicyOverrideRecordsRecord
          : null,
      effectiveLaunchApprovalPolicy: isLaunchApprovalPolicy(effectiveLaunchApprovalPolicyRecord)
        ? effectiveLaunchApprovalPolicyRecord
        : null,
      defaultNotificationPolicy: null,
      notificationPolicyOverride: null,
      notificationPolicyOverrideRecords: null,
      effectiveNotificationPolicy: null
    };
  }

  if (auditEvent.eventType === "tenant.notification_policy.updated") {
    const defaultNotificationPolicy = getAuditPayloadRecord(auditEvent.payload, "defaultNotificationPolicy");

    if (!isNotificationPolicy(defaultNotificationPolicy)) {
      return undefined;
    }

    return {
      ...baseEntry,
      ...emptyPolicyState,
      policyFamily: "notification",
      scope: "tenant_default",
      mode: "default",
      changedFields: [...notificationPolicyOverrideKeys],
      clearedFields: [],
      defaultNotificationPolicy,
      notificationPolicyOverride: null,
      notificationPolicyOverrideRecords: null,
      effectiveNotificationPolicy: defaultNotificationPolicy
    };
  }

  if (auditEvent.eventType === "tenant.governance_notification_policy.updated") {
    const defaultGovernanceNotificationPolicy = getAuditPayloadRecord(
      auditEvent.payload,
      "defaultGovernanceNotificationPolicy"
    );

    if (!isNotificationPolicy(defaultGovernanceNotificationPolicy)) {
      return undefined;
    }

    return {
      ...baseEntry,
      ...emptyPolicyState,
      policyFamily: "governance_notification",
      scope: "tenant_default",
      mode: "default",
      changedFields: [...notificationPolicyOverrideKeys],
      clearedFields: [],
      defaultGovernanceNotificationPolicy,
      governanceNotificationPolicyOverride: null,
      governanceNotificationPolicyOverrideRecords: null,
      effectiveGovernanceNotificationPolicy: defaultGovernanceNotificationPolicy
    };
  }

  if (auditEvent.eventType === "tenant.recovery_governance_notification_policy.updated") {
    const defaultRecoveryGovernanceNotificationPolicy = getAuditPayloadRecord(
      auditEvent.payload,
      "defaultRecoveryGovernanceNotificationPolicy"
    );

    if (!isNotificationPolicy(defaultRecoveryGovernanceNotificationPolicy)) {
      return undefined;
    }

    return {
      ...baseEntry,
      ...emptyPolicyState,
      policyFamily: "recovery_governance_notification",
      scope: "tenant_default",
      mode: "default",
      changedFields: [...notificationPolicyOverrideKeys],
      clearedFields: [],
      defaultRecoveryGovernanceNotificationPolicy,
      recoveryGovernanceNotificationPolicyOverride: null,
      recoveryGovernanceNotificationPolicyOverrideRecords: null,
      effectiveRecoveryGovernanceNotificationPolicy:
        defaultRecoveryGovernanceNotificationPolicy
    };
  }

  if (auditEvent.eventType === "tenant.notification_provider_promotion_policy.updated") {
    const defaultNotificationProviderPromotionPolicy = getAuditPayloadRecord(
      auditEvent.payload,
      "defaultNotificationProviderPromotionPolicy"
    );

    if (!isNotificationProviderPromotionPolicy(defaultNotificationProviderPromotionPolicy)) {
      return undefined;
    }

    return {
      ...baseEntry,
      ...emptyPolicyState,
      policyFamily: "notification_provider_promotion",
      scope: "tenant_default",
      mode: "default",
      changedFields: [...notificationProviderPromotionPolicyOverrideKeys],
      clearedFields: [],
      defaultNotificationProviderPromotionPolicy,
      notificationProviderPromotionPolicyOverride: null,
      notificationProviderPromotionPolicyOverrideRecords: null,
      effectiveNotificationProviderPromotionPolicy: defaultNotificationProviderPromotionPolicy
    };
  }

  if (auditEvent.eventType === "tenant.notification_provider_profiles.updated") {
    const defaultNotificationProviderProfilesRecord = getAuditPayloadRecord(
      auditEvent.payload,
      "defaultNotificationProviderProfiles"
    );

    if (!isNotificationProviderProfiles(defaultNotificationProviderProfilesRecord)) {
      return undefined;
    }

    return {
      ...baseEntry,
      ...emptyPolicyState,
      policyFamily: "notification_provider_profiles",
      scope: "tenant_default",
      mode: "default",
      changedFields: defaultNotificationProviderProfilesRecord.map(profile => profile.profileKey),
      clearedFields: [],
      defaultNotificationProviderProfiles: defaultNotificationProviderProfilesRecord,
      notificationProviderProfileOverride: null,
      removedNotificationProviderProfileKeys: null,
      notificationProviderProfileOverrideRecords: null,
      effectiveNotificationProviderProfiles: defaultNotificationProviderProfilesRecord
    };
  }

  if (auditEvent.eventType === "workspace.notification_provider_profiles.updated") {
    const defaultNotificationProviderProfilesRecord = getAuditPayloadRecord(
      auditEvent.payload,
      "defaultNotificationProviderProfiles"
    );
    const notificationProviderProfileOverrideRecord = getAuditPayloadRecord(
      auditEvent.payload,
      "notificationProviderProfileOverride"
    );
    const notificationProviderProfileOverrideRecordsRecord = getAuditPayloadRecord(
      auditEvent.payload,
      "notificationProviderProfileOverrideRecords"
    );
    const effectiveNotificationProviderProfilesRecord = getAuditPayloadRecord(
      auditEvent.payload,
      "effectiveNotificationProviderProfiles"
    );
    const mode = isWorkspaceNotificationProviderProfilesMode(auditEvent.payload.mode)
      ? auditEvent.payload.mode
      : "override";

    return {
      ...baseEntry,
      ...emptyPolicyState,
      policyFamily: "notification_provider_profiles",
      scope: "workspace_override",
      mode,
      changedFields: getAuditPayloadStringArray(auditEvent.payload, "changedProfileKeys") ?? [],
      clearedFields: getAuditPayloadStringArray(auditEvent.payload, "clearedProfileKeys") ?? [],
      defaultNotificationProviderProfiles: isNotificationProviderProfiles(
        defaultNotificationProviderProfilesRecord
      )
        ? defaultNotificationProviderProfilesRecord
        : null,
      notificationProviderProfileOverride: isNotificationProviderProfiles(
        notificationProviderProfileOverrideRecord
      )
        ? notificationProviderProfileOverrideRecord
        : null,
      removedNotificationProviderProfileKeys:
        getAuditPayloadStringArray(auditEvent.payload, "removedNotificationProviderProfileKeys") ??
        null,
      notificationProviderProfileOverrideRecords: isNotificationProviderProfileOverrideRecords(
        notificationProviderProfileOverrideRecordsRecord
      )
        ? notificationProviderProfileOverrideRecordsRecord
        : null,
      effectiveNotificationProviderProfiles: isNotificationProviderProfiles(
        effectiveNotificationProviderProfilesRecord
      )
        ? effectiveNotificationProviderProfilesRecord
        : null
    };
  }

  if (auditEvent.eventType === "workspace.notification_policy.updated") {
    const defaultNotificationPolicyRecord = getAuditPayloadRecord(auditEvent.payload, "defaultNotificationPolicy");
    const notificationPolicyOverrideRecord = getAuditPayloadRecord(
      auditEvent.payload,
      "notificationPolicyOverride"
    );
    const notificationPolicyOverrideRecordsRecord = getAuditPayloadRecord(
      auditEvent.payload,
      "notificationPolicyOverrideRecords"
    );
    const effectiveNotificationPolicyRecord = getAuditPayloadRecord(
      auditEvent.payload,
      "effectiveNotificationPolicy"
    );
    const mode = isWorkspaceNotificationPolicyMode(auditEvent.payload.mode)
      ? auditEvent.payload.mode
      : "override";

    return {
      ...baseEntry,
      ...emptyPolicyState,
      policyFamily: "notification",
      scope: "workspace_override",
      mode,
      changedFields: getAuditPayloadStringArray(auditEvent.payload, "changedFields") ?? [],
      clearedFields: getAuditPayloadStringArray(auditEvent.payload, "clearedFields") ?? [],
      defaultNotificationPolicy: isNotificationPolicy(defaultNotificationPolicyRecord)
        ? defaultNotificationPolicyRecord
        : null,
      notificationPolicyOverride: isNotificationPolicyOverride(notificationPolicyOverrideRecord)
        ? notificationPolicyOverrideRecord
        : null,
      notificationPolicyOverrideRecords:
        isNotificationPolicyOverrideRecords(notificationPolicyOverrideRecordsRecord)
          ? notificationPolicyOverrideRecordsRecord
          : null,
      effectiveNotificationPolicy: isNotificationPolicy(effectiveNotificationPolicyRecord)
        ? effectiveNotificationPolicyRecord
        : null
    };
  }

  if (auditEvent.eventType === "workspace.governance_notification_policy.updated") {
    const defaultGovernanceNotificationPolicyRecord = getAuditPayloadRecord(
      auditEvent.payload,
      "defaultGovernanceNotificationPolicy"
    );
    const governanceNotificationPolicyOverrideRecord = getAuditPayloadRecord(
      auditEvent.payload,
      "governanceNotificationPolicyOverride"
    );
    const governanceNotificationPolicyOverrideRecordsRecord = getAuditPayloadRecord(
      auditEvent.payload,
      "governanceNotificationPolicyOverrideRecords"
    );
    const effectiveGovernanceNotificationPolicyRecord = getAuditPayloadRecord(
      auditEvent.payload,
      "effectiveGovernanceNotificationPolicy"
    );
    const mode = isWorkspaceGovernanceNotificationPolicyMode(auditEvent.payload.mode)
      ? auditEvent.payload.mode
      : "override";

    return {
      ...baseEntry,
      ...emptyPolicyState,
      policyFamily: "governance_notification",
      scope: "workspace_override",
      mode,
      changedFields: getAuditPayloadStringArray(auditEvent.payload, "changedFields") ?? [],
      clearedFields: getAuditPayloadStringArray(auditEvent.payload, "clearedFields") ?? [],
      defaultGovernanceNotificationPolicy: isNotificationPolicy(
        defaultGovernanceNotificationPolicyRecord
      )
        ? defaultGovernanceNotificationPolicyRecord
        : null,
      governanceNotificationPolicyOverride: isNotificationPolicyOverride(
        governanceNotificationPolicyOverrideRecord
      )
        ? governanceNotificationPolicyOverrideRecord
        : null,
      governanceNotificationPolicyOverrideRecords: isNotificationPolicyOverrideRecords(
        governanceNotificationPolicyOverrideRecordsRecord
      )
        ? governanceNotificationPolicyOverrideRecordsRecord
        : null,
      effectiveGovernanceNotificationPolicy: isNotificationPolicy(
        effectiveGovernanceNotificationPolicyRecord
      )
        ? effectiveGovernanceNotificationPolicyRecord
        : null
    };
  }

  if (auditEvent.eventType === "workspace.recovery_governance_notification_policy.updated") {
    const defaultRecoveryGovernanceNotificationPolicyRecord = getAuditPayloadRecord(
      auditEvent.payload,
      "defaultRecoveryGovernanceNotificationPolicy"
    );
    const recoveryGovernanceNotificationPolicyOverrideRecord = getAuditPayloadRecord(
      auditEvent.payload,
      "recoveryGovernanceNotificationPolicyOverride"
    );
    const recoveryGovernanceNotificationPolicyOverrideRecordsRecord = getAuditPayloadRecord(
      auditEvent.payload,
      "recoveryGovernanceNotificationPolicyOverrideRecords"
    );
    const effectiveRecoveryGovernanceNotificationPolicyRecord = getAuditPayloadRecord(
      auditEvent.payload,
      "effectiveRecoveryGovernanceNotificationPolicy"
    );
    const mode = isWorkspaceRecoveryGovernanceNotificationPolicyMode(auditEvent.payload.mode)
      ? auditEvent.payload.mode
      : "override";

    return {
      ...baseEntry,
      ...emptyPolicyState,
      policyFamily: "recovery_governance_notification",
      scope: "workspace_override",
      mode,
      changedFields: getAuditPayloadStringArray(auditEvent.payload, "changedFields") ?? [],
      clearedFields: getAuditPayloadStringArray(auditEvent.payload, "clearedFields") ?? [],
      defaultRecoveryGovernanceNotificationPolicy: isNotificationPolicy(
        defaultRecoveryGovernanceNotificationPolicyRecord
      )
        ? defaultRecoveryGovernanceNotificationPolicyRecord
        : null,
      recoveryGovernanceNotificationPolicyOverride: isNotificationPolicyOverride(
        recoveryGovernanceNotificationPolicyOverrideRecord
      )
        ? recoveryGovernanceNotificationPolicyOverrideRecord
        : null,
      recoveryGovernanceNotificationPolicyOverrideRecords:
        isNotificationPolicyOverrideRecords(
          recoveryGovernanceNotificationPolicyOverrideRecordsRecord
        )
          ? recoveryGovernanceNotificationPolicyOverrideRecordsRecord
          : null,
      effectiveRecoveryGovernanceNotificationPolicy: isNotificationPolicy(
        effectiveRecoveryGovernanceNotificationPolicyRecord
      )
        ? effectiveRecoveryGovernanceNotificationPolicyRecord
        : null
    };
  }

  if (auditEvent.eventType === "workspace.notification_provider_promotion_policy.updated") {
    const defaultNotificationProviderPromotionPolicyRecord = getAuditPayloadRecord(
      auditEvent.payload,
      "defaultNotificationProviderPromotionPolicy"
    );
    const notificationProviderPromotionPolicyOverrideRecord = getAuditPayloadRecord(
      auditEvent.payload,
      "notificationProviderPromotionPolicyOverride"
    );
    const notificationProviderPromotionPolicyOverrideRecordsRecord = getAuditPayloadRecord(
      auditEvent.payload,
      "notificationProviderPromotionPolicyOverrideRecords"
    );
    const effectiveNotificationProviderPromotionPolicyRecord = getAuditPayloadRecord(
      auditEvent.payload,
      "effectiveNotificationProviderPromotionPolicy"
    );
    const mode = isWorkspaceNotificationProviderPromotionPolicyMode(auditEvent.payload.mode)
      ? auditEvent.payload.mode
      : "override";

    return {
      ...baseEntry,
      ...emptyPolicyState,
      policyFamily: "notification_provider_promotion",
      scope: "workspace_override",
      mode,
      changedFields: getAuditPayloadStringArray(auditEvent.payload, "changedFields") ?? [],
      clearedFields: getAuditPayloadStringArray(auditEvent.payload, "clearedFields") ?? [],
      defaultNotificationProviderPromotionPolicy: isNotificationProviderPromotionPolicy(
        defaultNotificationProviderPromotionPolicyRecord
      )
        ? defaultNotificationProviderPromotionPolicyRecord
        : null,
      notificationProviderPromotionPolicyOverride: isNotificationProviderPromotionPolicyOverride(
        notificationProviderPromotionPolicyOverrideRecord
      )
        ? notificationProviderPromotionPolicyOverrideRecord
        : null,
      notificationProviderPromotionPolicyOverrideRecords:
        isNotificationProviderPromotionPolicyOverrideRecords(
          notificationProviderPromotionPolicyOverrideRecordsRecord
        )
          ? notificationProviderPromotionPolicyOverrideRecordsRecord
          : null,
      effectiveNotificationProviderPromotionPolicy: isNotificationProviderPromotionPolicy(
        effectiveNotificationProviderPromotionPolicyRecord
      )
        ? effectiveNotificationProviderPromotionPolicyRecord
        : null
    };
  }

  if (auditEvent.eventType === "tenant.evidence_retention_policy.updated") {
    const defaultEvidenceRetentionPolicy = getAuditPayloadRecord(
      auditEvent.payload,
      "defaultEvidenceRetentionPolicy"
    );

    if (!isEvidenceRetentionPolicy(defaultEvidenceRetentionPolicy)) {
      return undefined;
    }

    return {
      ...baseEntry,
      ...emptyPolicyState,
      policyFamily: "evidence_retention",
      scope: "tenant_default",
      mode: "default",
      changedFields: [...evidenceRetentionPolicyOverrideKeys],
      clearedFields: [],
      defaultActivationPolicy: null,
      activationPolicyOverride: null,
      activationPolicyOverrideRecords: null,
      effectiveActivationPolicy: null,
      defaultOperationalPolicy: null,
      operationalPolicyOverride: null,
      operationalPolicyOverrideRecords: null,
      effectiveOperationalPolicy: null,
      defaultLaunchApprovalPolicy: null,
      launchApprovalPolicyOverride: null,
      launchApprovalPolicyOverrideRecords: null,
      effectiveLaunchApprovalPolicy: null,
      defaultEvidenceRetentionPolicy,
      evidenceRetentionPolicyOverride: null,
      evidenceRetentionPolicyOverrideRecords: null,
      effectiveEvidenceRetentionPolicy: defaultEvidenceRetentionPolicy
    };
  }

  if (auditEvent.eventType === "workspace.evidence_retention_policy.updated") {
    const defaultEvidenceRetentionPolicyRecord = getAuditPayloadRecord(
      auditEvent.payload,
      "defaultEvidenceRetentionPolicy"
    );
    const evidenceRetentionPolicyOverrideRecord = getAuditPayloadRecord(
      auditEvent.payload,
      "evidenceRetentionPolicyOverride"
    );
    const evidenceRetentionPolicyOverrideRecordsRecord = getAuditPayloadRecord(
      auditEvent.payload,
      "evidenceRetentionPolicyOverrideRecords"
    );
    const effectiveEvidenceRetentionPolicyRecord = getAuditPayloadRecord(
      auditEvent.payload,
      "effectiveEvidenceRetentionPolicy"
    );
    const mode = isWorkspaceEvidenceRetentionPolicyMode(auditEvent.payload.mode)
      ? auditEvent.payload.mode
      : "override";

    return {
      ...baseEntry,
      ...emptyPolicyState,
      policyFamily: "evidence_retention",
      scope: "workspace_override",
      mode,
      changedFields: getAuditPayloadStringArray(auditEvent.payload, "changedFields") ?? [],
      clearedFields: getAuditPayloadStringArray(auditEvent.payload, "clearedFields") ?? [],
      defaultActivationPolicy: null,
      activationPolicyOverride: null,
      activationPolicyOverrideRecords: null,
      effectiveActivationPolicy: null,
      defaultOperationalPolicy: null,
      operationalPolicyOverride: null,
      operationalPolicyOverrideRecords: null,
      effectiveOperationalPolicy: null,
      defaultLaunchApprovalPolicy: null,
      launchApprovalPolicyOverride: null,
      launchApprovalPolicyOverrideRecords: null,
      effectiveLaunchApprovalPolicy: null,
      defaultEvidenceRetentionPolicy: isEvidenceRetentionPolicy(defaultEvidenceRetentionPolicyRecord)
        ? defaultEvidenceRetentionPolicyRecord
        : null,
      evidenceRetentionPolicyOverride: isEvidenceRetentionPolicyOverride(evidenceRetentionPolicyOverrideRecord)
        ? evidenceRetentionPolicyOverrideRecord
        : null,
      evidenceRetentionPolicyOverrideRecords:
        isEvidenceRetentionPolicyOverrideRecords(evidenceRetentionPolicyOverrideRecordsRecord)
          ? evidenceRetentionPolicyOverrideRecordsRecord
          : null,
      effectiveEvidenceRetentionPolicy: isEvidenceRetentionPolicy(effectiveEvidenceRetentionPolicyRecord)
        ? effectiveEvidenceRetentionPolicyRecord
        : null
    };
  }

  if (auditEvent.eventType === "tenant.evidence_retention_class_policy.updated") {
    const defaultEvidenceRetentionClassPolicy = getAuditPayloadRecord(
      auditEvent.payload,
      "defaultEvidenceRetentionClassPolicy"
    );

    if (!isEvidenceRetentionClassPolicy(defaultEvidenceRetentionClassPolicy)) {
      return undefined;
    }

    return {
      ...baseEntry,
      ...emptyPolicyState,
      policyFamily: "evidence_retention_class",
      scope: "tenant_default",
      mode: "default",
      changedFields: [...evidenceRetentionClassPolicyKeys],
      clearedFields: [],
      defaultEvidenceRetentionClassPolicy,
      effectiveEvidenceRetentionClassPolicy: defaultEvidenceRetentionClassPolicy
    };
  }

  if (auditEvent.eventType === "workspace.evidence_retention_class_policy.updated") {
    const defaultEvidenceRetentionClassPolicyRecord = getAuditPayloadRecord(
      auditEvent.payload,
      "defaultEvidenceRetentionClassPolicy"
    );
    const evidenceRetentionClassPolicyOverrideRecord = getAuditPayloadRecord(
      auditEvent.payload,
      "evidenceRetentionClassPolicyOverride"
    );
    const evidenceRetentionClassPolicyOverrideRecordsRecord = getAuditPayloadRecord(
      auditEvent.payload,
      "evidenceRetentionClassPolicyOverrideRecords"
    );
    const effectiveEvidenceRetentionClassPolicyRecord = getAuditPayloadRecord(
      auditEvent.payload,
      "effectiveEvidenceRetentionClassPolicy"
    );
    const mode = isWorkspaceEvidenceRetentionClassPolicyMode(auditEvent.payload.mode)
      ? auditEvent.payload.mode
      : "override";

    return {
      ...baseEntry,
      ...emptyPolicyState,
      policyFamily: "evidence_retention_class",
      scope: "workspace_override",
      mode,
      changedFields: getAuditPayloadStringArray(auditEvent.payload, "changedFields") ?? [],
      clearedFields: getAuditPayloadStringArray(auditEvent.payload, "clearedFields") ?? [],
      defaultEvidenceRetentionClassPolicy: isEvidenceRetentionClassPolicy(
        defaultEvidenceRetentionClassPolicyRecord
      )
        ? defaultEvidenceRetentionClassPolicyRecord
        : null,
      evidenceRetentionClassPolicyOverride: isEvidenceRetentionClassPolicyOverride(
        evidenceRetentionClassPolicyOverrideRecord
      )
        ? evidenceRetentionClassPolicyOverrideRecord
        : null,
      evidenceRetentionClassPolicyOverrideRecords:
        isEvidenceRetentionClassPolicyOverrideRecords(
          evidenceRetentionClassPolicyOverrideRecordsRecord
        )
          ? evidenceRetentionClassPolicyOverrideRecordsRecord
          : null,
      effectiveEvidenceRetentionClassPolicy: isEvidenceRetentionClassPolicy(
        effectiveEvidenceRetentionClassPolicyRecord
      )
        ? effectiveEvidenceRetentionClassPolicyRecord
        : null
    };
  }

  return undefined;
};

const toMonitorCommandDto = (monitorCommand: MonitorCommand): MonitorCommandDto => ({
  commandId: monitorCommand.commandId,
  requestId: monitorCommand.requestId,
  commandType: monitorCommand.commandType,
  ackState: monitorCommand.ackState,
  actorId: monitorCommand.actorId,
  testRunId: monitorCommand.testRunId,
  participantSessionId: monitorCommand.participantSessionId,
  loginKey: monitorCommand.loginKey,
  groupKey: monitorCommand.groupKey,
  assignmentKey: monitorCommand.assignmentKey,
  attemptNumber: monitorCommand.attemptNumber,
  issuedAt: monitorCommand.issuedAt,
  deliveredAt: monitorCommand.deliveredAt,
  resolvedAt: monitorCommand.resolvedAt,
  rejectionReason: monitorCommand.rejectionReason
});

const toParticipantStarterLaunchResponse = (
  testRun: TestRun,
  participantSessionToken: string,
  launchDisposition: "created" | "resumed",
  systemCheckReadiness: SystemCheckLaunchReadinessDto
): ParticipantStarterLaunchResponse => ({
  testRunId: testRun.testRunId,
  launchDisposition,
  attemptNumber: testRun.attemptNumber,
  status: testRun.status,
  participantSessionToken,
  assignmentKey: testRun.assignmentKey,
  bookletKey: testRun.bookletKey,
  bookletTitle: testRun.bookletTitle,
  currentUnitKey: testRun.currentUnitKey,
  currentUnitIndex: testRun.currentUnitIndex,
  totalUnits: testRun.unitSequence.length,
  runPolicy: toTestRunPolicyDto(testRun),
  systemCheckReadiness,
  launchAuthorization: {
    launchApprovalId: testRun.launchApprovalId,
    approvalScope: testRun.launchApprovalScope,
    approvalApplied: Boolean(testRun.launchApprovalId),
    approvedBySupervisorId: testRun.launchApprovedBySupervisorId,
    approvalNote: testRun.launchApprovalNote,
    approvedAt: testRun.launchApprovedAt
  }
});

const toParticipantTestRunResponse = (
  testRun: TestRun,
  participantSessionToken: string
): ParticipantTestRunResponse => ({
  testRunId: testRun.testRunId,
  attemptNumber: testRun.attemptNumber,
  participantSessionToken,
  contentReleaseId: testRun.contentReleaseId,
  loginKey: testRun.loginKey,
  groupKey: testRun.groupKey,
  assignmentKey: testRun.assignmentKey,
  bookletKey: testRun.bookletKey,
  bookletTitle: testRun.bookletTitle,
  status: testRun.status,
  currentUnitKey: testRun.currentUnitKey,
  currentUnitIndex: testRun.currentUnitIndex,
  totalUnits: testRun.unitSequence.length,
  unitSequence: testRun.unitSequence,
  initialStateOverrides: testRun.initialStateOverrides,
  unitResponses: testRun.unitResponses,
  runPolicy: toTestRunPolicyDto(testRun),
  createdAt: testRun.createdAt,
  updatedAt: testRun.updatedAt,
  completedAt: testRun.completedAt
});

const toMonitorTestRunCommandResponse = (
  command: MonitorCommand,
  testRun: TestRun
): MonitorTestRunCommandResponse => ({
  command: toMonitorCommandDto(command),
  testRun: toWorkspaceMonitorTestRunDto(testRun)
});

const synchronizeTestRunRuntimeState = async (
  store: PlatformStore,
  testRun: TestRun
): Promise<TestRun> => {
  const synchronizedTestRun = expireTestRunIfNeeded(testRun);

  if (synchronizedTestRun !== testRun) {
    await store.updateTestRun(synchronizedTestRun);
  }

  return synchronizedTestRun;
};

const synchronizeTestRunsRuntimeState = async (
  store: PlatformStore,
  testRuns: TestRun[]
): Promise<TestRun[]> => Promise.all(testRuns.map(testRun => synchronizeTestRunRuntimeState(store, testRun)));

const toContentReleaseActivationSession = (
  testRun: TestRun
): ContentReleaseGuardrailContext["activeSessions"][number] => ({
  testRunId: testRun.testRunId,
  loginKey: testRun.loginKey,
  groupKey: testRun.groupKey,
  bookletKey: testRun.bookletKey,
  assignmentKey: testRun.assignmentKey
});

const buildContentReleaseGuardrailContext = async (
  store: PlatformStore,
  tenantKey: string,
  workspaceKey: string
): Promise<ContentReleaseGuardrailContext> => {
  const [tenant, workspace, activeContentRelease, activeTestRuns] = await Promise.all([
    store.getTenantByKey(tenantKey),
    store.getWorkspaceByKey(tenantKey, workspaceKey),
    store.getActiveContentReleaseByWorkspace(tenantKey, workspaceKey),
    store.listMonitorTestRunsByWorkspace(tenantKey, workspaceKey)
  ]);
  const synchronizedActiveTestRuns = await synchronizeTestRunsRuntimeState(store, activeTestRuns);

  return {
    activeContentRelease: activeContentRelease ?? null,
    activationPolicy: tenant && workspace
      ? toContentReleaseActivationPolicyDto(resolveWorkspaceActivationPolicy(workspace, tenant))
      : emptyContentReleaseGuardrailContext.activationPolicy,
    activeSessions: synchronizedActiveTestRuns.filter(isOpenTestRun).map(toContentReleaseActivationSession)
  };
};

const recordAuditEvent = async (
  store: PlatformStore,
  input: Parameters<typeof createAuditEvent>[0]
): Promise<void> => {
  await store.saveAuditEvent(createAuditEvent(input));
};

const recordParticipantSessionAuditEvent = async (input: {
  store: PlatformStore;
  requestContext: RequestContext;
  participantSession: import("@testcenter-rewrite/domain").ParticipantSession;
  actorType: "participant" | "monitor" | "platform_api" | "worker" | "dispatcher";
  actorId: string;
  eventType: string;
  payload?: Record<string, unknown>;
}): Promise<void> => {
  await recordAuditEvent(input.store, {
    requestId: input.requestContext.requestId,
    tenantId: input.participantSession.tenantId,
    workspaceId: input.participantSession.workspaceId,
    participantSessionId: input.participantSession.participantSessionId,
    loginKey: input.participantSession.loginKey,
    groupKey: input.participantSession.groupKey,
    actorType: input.actorType,
    actorId: input.actorId,
    eventType: input.eventType,
    payload: input.payload
  });
};

const recordTestRunAuditEvent = async (input: {
  store: PlatformStore;
  requestContext: RequestContext;
  testRun: TestRun;
  actorType: "participant" | "monitor" | "platform_api" | "worker" | "dispatcher";
  actorId: string;
  eventType: string;
  payload?: Record<string, unknown>;
}): Promise<void> => {
  await recordAuditEvent(input.store, {
    requestId: input.requestContext.requestId,
    tenantId: input.testRun.tenantId,
    workspaceId: input.testRun.workspaceId,
    participantSessionId: input.testRun.participantSessionId,
    testRunId: input.testRun.testRunId,
    loginKey: input.testRun.loginKey,
    groupKey: input.testRun.groupKey,
    assignmentKey: input.testRun.assignmentKey,
    actorType: input.actorType,
    actorId: input.actorId,
    eventType: input.eventType,
    payload: input.payload
  });
};

const enqueueMonitorCommand = async (input: {
  store: PlatformStore;
  requestContext: RequestContext;
  testRun: TestRun;
  commandType: MonitorCommand["commandType"];
}): Promise<{
  command: MonitorCommand;
  testRun: TestRun;
}> => {
  const issuedCommand = createMonitorCommand({
    requestId: input.requestContext.requestId,
    tenantId: input.testRun.tenantId,
    workspaceId: input.testRun.workspaceId,
    testRunId: input.testRun.testRunId,
    participantSessionId: input.testRun.participantSessionId,
    loginKey: input.testRun.loginKey,
    groupKey: input.testRun.groupKey,
    assignmentKey: input.testRun.assignmentKey,
    attemptNumber: input.testRun.attemptNumber,
    commandType: input.commandType,
    actorId: "workspace-monitor"
  });

  await input.store.saveMonitorCommand(issuedCommand);
  await recordTestRunAuditEvent({
    store: input.store,
    requestContext: input.requestContext,
    testRun: input.testRun,
    actorType: "monitor",
    actorId: "workspace-monitor",
    eventType: "monitor.command.issued",
    payload: {
      commandId: issuedCommand.commandId,
      commandType: issuedCommand.commandType,
      ackState: issuedCommand.ackState
    }
  });

  return {
    command: issuedCommand,
    testRun: input.testRun
  };
};

const resolveParticipantSessionBoundTestRun = async (
  store: PlatformStore,
  participantSessionToken: string,
  testRunId: string
): Promise<{
  participantSession: import("@testcenter-rewrite/domain").ParticipantSession;
  testRun: TestRun;
} | undefined> => {
  const participantSession = await store.getParticipantSessionByToken(participantSessionToken);

  if (!participantSession) {
    return undefined;
  }

  const testRun = await store.getTestRunById(testRunId);

  if (!testRun || testRun.participantSessionId !== participantSession.participantSessionId) {
    return undefined;
  }

  return {
    participantSession,
    testRun: await synchronizeTestRunRuntimeState(store, testRun)
  };
};

const resolveWorkspaceScopedTestRun = async (
  store: PlatformStore,
  tenantKey: string,
  workspaceKey: string,
  testRunId: string
): Promise<{
  workspace: Workspace;
  testRun: TestRun;
} | undefined> => {
  const workspace = await store.getWorkspaceByKey(tenantKey, workspaceKey);

  if (!workspace) {
    return undefined;
  }

  const testRun = await store.getTestRunById(testRunId);

  if (!testRun ||
    testRun.tenantId !== workspace.tenantId ||
    testRun.workspaceId !== workspace.workspaceId) {
    return undefined;
  }

  return {
    workspace,
    testRun: await synchronizeTestRunRuntimeState(store, testRun)
  };
};

const resolveWorkspaceScopedImportJob = async (
  store: PlatformStore,
  tenantKey: string,
  workspaceKey: string,
  importJobId: string
): Promise<{
  workspace: Workspace;
  importJob: ImportJob;
} | undefined> => {
  const workspace = await store.getWorkspaceByKey(tenantKey, workspaceKey);

  if (!workspace) {
    return undefined;
  }

  const importJob = await store.getImportJobById(importJobId);

  if (!importJob ||
    importJob.tenantId !== workspace.tenantId ||
    importJob.workspaceId !== workspace.workspaceId) {
    return undefined;
  }

  return {
    workspace,
    importJob
  };
};

const resolveWorkspaceScopedContentRelease = async (
  store: PlatformStore,
  tenantKey: string,
  workspaceKey: string,
  contentReleaseId: string
): Promise<{
  workspace: Workspace;
  contentRelease: ContentRelease;
} | undefined> => {
  const workspace = await store.getWorkspaceByKey(tenantKey, workspaceKey);

  if (!workspace) {
    return undefined;
  }

  const contentRelease = await store.getContentReleaseById(contentReleaseId);

  if (!contentRelease ||
    contentRelease.tenantId !== workspace.tenantId ||
    contentRelease.workspaceId !== workspace.workspaceId) {
    return undefined;
  }

  return {
    workspace,
    contentRelease
  };
};

const resolveWorkspaceScopedSystemCheckSubmission = async (
  store: PlatformStore,
  tenantKey: string,
  workspaceKey: string,
  systemCheckSubmissionId: string
): Promise<{
  workspace: Workspace;
  systemCheckSubmission: SystemCheckSubmission;
} | undefined> => {
  const workspace = await store.getWorkspaceByKey(tenantKey, workspaceKey);

  if (!workspace) {
    return undefined;
  }

  const systemCheckSubmission = await store.getSystemCheckSubmissionById(systemCheckSubmissionId);

  if (
    !systemCheckSubmission ||
    systemCheckSubmission.tenantId !== workspace.tenantId ||
    systemCheckSubmission.workspaceId !== workspace.workspaceId
  ) {
    return undefined;
  }

  return {
    workspace,
    systemCheckSubmission
  };
};

const resolveWorkspaceScopedSystemCheckEvidence = async (
  store: PlatformStore,
  tenantKey: string,
  workspaceKey: string,
  evidenceKey: string
): Promise<{
  workspace: Workspace;
  systemCheckEvidence: SystemCheckEvidence;
} | undefined> => {
  const workspace = await store.getWorkspaceByKey(tenantKey, workspaceKey);

  if (!workspace) {
    return undefined;
  }

  const systemCheckEvidence = await store.getSystemCheckEvidenceByKey(evidenceKey);

  if (
    !systemCheckEvidence ||
    systemCheckEvidence.tenantId !== workspace.tenantId ||
    systemCheckEvidence.workspaceId !== workspace.workspaceId
  ) {
    return undefined;
  }

  return {
    workspace,
    systemCheckEvidence
  };
};

const resolveWorkspaceScopedSystemCheckEvidenceBreachNotification = async (
  store: PlatformStore,
  tenantKey: string,
  workspaceKey: string,
  notificationId: string
): Promise<{
  workspace: Workspace;
  notification: import("@testcenter-rewrite/domain").SystemCheckEvidenceBreachNotification;
} | undefined> => {
  const workspace = await store.getWorkspaceByKey(tenantKey, workspaceKey);

  if (!workspace) {
    return undefined;
  }

  const notification = await store.getSystemCheckEvidenceBreachNotificationById(notificationId);

  if (
    !notification ||
    notification.tenantId !== workspace.tenantId ||
    notification.workspaceId !== workspace.workspaceId
  ) {
    return undefined;
  }

  return {
    workspace,
    notification
  };
};

const synchronizeSystemCheckEvidenceHoldEscalationIfNeeded = async (input: {
  store: PlatformStore;
  workspace: Workspace;
  systemCheckEvidence: SystemCheckEvidence;
  requestContext: RequestContext;
}): Promise<SystemCheckEvidence> => {
  const retentionHold = input.systemCheckEvidence.retentionHold;

  if (
    !retentionHold ||
    retentionHold.escalatedAt ||
    retentionHold.acknowledgedAt ||
    !retentionHold.escalationTarget ||
    getSystemCheckEvidenceHoldSlaStatus(retentionHold) !== "breached"
  ) {
    return input.systemCheckEvidence;
  }

  const escalatedEvidence = escalateSystemCheckEvidenceRetentionHold({
    systemCheckEvidence: input.systemCheckEvidence,
    escalatedByActorId: "policy-sla-escalation",
    escalationNote: `Escalated automatically to '${retentionHold.escalationTarget}' because the hold SLA elapsed without acknowledgement.`
  });

  await input.store.updateSystemCheckEvidence(escalatedEvidence);
  await recordAuditEvent(input.store, {
    requestId: input.requestContext.requestId,
    tenantId: escalatedEvidence.tenantId,
    workspaceId: escalatedEvidence.workspaceId,
    participantSessionId: escalatedEvidence.participantSessionId,
    loginKey: escalatedEvidence.loginKey,
    groupKey: escalatedEvidence.groupKey,
    actorType: "platform_api",
    actorId: "platform-api",
    eventType: "workspace.system_check.evidence_hold.escalated",
    payload: {
      evidenceKey: escalatedEvidence.evidenceKey,
      systemCheckKey: escalatedEvidence.systemCheckKey,
      checkKey: escalatedEvidence.checkKey,
      retentionClass: escalatedEvidence.retentionClass,
      retentionPolicyKey: escalatedEvidence.retentionPolicyKey,
      retentionExpiresAt: escalatedEvidence.retentionExpiresAt,
      ...toSystemCheckEvidenceHoldAuditPayload(escalatedEvidence.retentionHold)
    }
  });

  return escalatedEvidence;
};

const issueSystemCheckEvidenceAccessGrant = async (input: {
  store: PlatformStore;
  systemCheckEvidence: SystemCheckEvidence;
  issuedFor: "participant_capture" | "workspace_review";
  actorType: "platform_api" | "participant" | "monitor" | "worker" | "dispatcher";
  actorId: string;
  issuedAt?: string;
}): Promise<SystemCheckEvidenceAccessGrant> => {
  if (getSystemCheckEvidencePayloadAvailability(input.systemCheckEvidence) === "purged") {
    throw new Error(
      `System-check evidence '${input.systemCheckEvidence.evidenceKey}' payload has been purged.`
    );
  }

  const issuedAt = input.issuedAt ?? new Date().toISOString();
  const expiresAt = new Date(
    Date.parse(issuedAt) + systemCheckEvidenceAccessGrantTtlSeconds * 1000
  ).toISOString();
  const accessGrant = createSystemCheckEvidenceAccessGrant({
    evidenceKey: input.systemCheckEvidence.evidenceKey,
    tenantId: input.systemCheckEvidence.tenantId,
    workspaceId: input.systemCheckEvidence.workspaceId,
    participantSessionId: input.systemCheckEvidence.participantSessionId,
    issuedFor: input.issuedFor,
    actorType: input.actorType,
    actorId: input.actorId,
    issuedAt,
    expiresAt
  });

  await input.store.saveSystemCheckEvidenceAccessGrant(accessGrant);
  return accessGrant;
};

const resolveWorkspaceScopedSystemCheckLaunchApproval = async (
  store: PlatformStore,
  tenantKey: string,
  workspaceKey: string,
  launchApprovalId: string
): Promise<{
  workspace: Workspace;
  launchApproval: SystemCheckLaunchApproval;
} | undefined> => {
  const workspace = await store.getWorkspaceByKey(tenantKey, workspaceKey);

  if (!workspace) {
    return undefined;
  }

  const launchApproval = await store.getSystemCheckLaunchApprovalById(launchApprovalId);

  if (
    !launchApproval ||
    launchApproval.tenantId !== workspace.tenantId ||
    launchApproval.workspaceId !== workspace.workspaceId
  ) {
    return undefined;
  }

  return {
    workspace,
    launchApproval
  };
};

const resolveParticipantSystemCheckState = async (
  store: PlatformStore,
  participantSession: {
    participantSessionId: string;
    contentReleaseId: string;
  }
): Promise<{
  contentRelease: ContentRelease;
  submissions: SystemCheckSubmission[];
  systemCheckReadiness: SystemCheckLaunchReadinessDto;
} | undefined> => {
  const [contentRelease, submissions] = await Promise.all([
    store.getContentReleaseById(participantSession.contentReleaseId),
    store.listSystemCheckSubmissionsByParticipantSession(participantSession.participantSessionId)
  ]);

  if (!contentRelease) {
    return undefined;
  }

  return {
    contentRelease,
    submissions,
    systemCheckReadiness: toSystemCheckLaunchReadinessDto(contentRelease, submissions)
  };
};

const normalizeLaunchApprovalWarningReasonCodes = (
  warningReasonCodes: readonly string[]
): string[] => [...new Set(warningReasonCodes)].sort();

const getSystemCheckLaunchApprovalInvalidation = (input: {
  launchApproval: SystemCheckLaunchApproval;
  systemCheckReadiness: SystemCheckLaunchReadinessDto;
}): {
  reasonCode: SystemCheckLaunchApprovalInvalidationReasonCode;
  reasonDetail: string;
} | null => {
  if (input.systemCheckReadiness.status !== "warning") {
    return {
      reasonCode: "readiness_no_longer_warning",
      reasonDetail: `Current system-check readiness is '${input.systemCheckReadiness.status}', so warning-level launch approval '${input.launchApproval.launchApprovalId}' is no longer applicable.`
    };
  }

  const normalizedCurrentReasonCodes = normalizeLaunchApprovalWarningReasonCodes(
    input.systemCheckReadiness.warningReasonCodes
  );
  const normalizedApprovedReasonCodes = normalizeLaunchApprovalWarningReasonCodes(
    input.launchApproval.warningReasonCodes
  );

  if (
    normalizedCurrentReasonCodes.length !== normalizedApprovedReasonCodes.length ||
    normalizedCurrentReasonCodes.some((reasonCode, index) => reasonCode !== normalizedApprovedReasonCodes[index])
  ) {
    return {
      reasonCode: "warning_reason_codes_changed",
      reasonDetail: `Current warning reason codes are '${normalizedCurrentReasonCodes.join(", ") || "none"}', which no longer match the approved codes '${normalizedApprovedReasonCodes.join(", ") || "none"}'.`
    };
  }

  return null;
};

const getSystemCheckLaunchApprovalExpiration = (
  launchApproval: SystemCheckLaunchApproval
): {
  reasonCode: SystemCheckLaunchApprovalExpirationReasonCode;
} | null => {
  if (!launchApproval.expiresAt || launchApproval.status !== "active") {
    return null;
  }

  if (Date.parse(launchApproval.expiresAt) > Date.now()) {
    return null;
  }

  return {
    reasonCode: "time_elapsed"
  };
};

const expireSystemCheckLaunchApprovalIfNeeded = async (input: {
  store: PlatformStore;
  launchApproval: SystemCheckLaunchApproval;
  requestContext: RequestContext;
  actorType: "platform_api" | "participant";
  actorId: string;
}): Promise<SystemCheckLaunchApproval> => {
  const expiration = getSystemCheckLaunchApprovalExpiration(input.launchApproval);

  if (!expiration) {
    return input.launchApproval;
  }

  const expiredLaunchApproval = expireSystemCheckLaunchApproval({
    launchApproval: input.launchApproval,
    reasonCode: expiration.reasonCode
  });

  await input.store.updateSystemCheckLaunchApproval(expiredLaunchApproval);
  await recordAuditEvent(input.store, {
    requestId: input.requestContext.requestId,
    tenantId: expiredLaunchApproval.tenantId,
    workspaceId: expiredLaunchApproval.workspaceId,
    participantSessionId: expiredLaunchApproval.participantSessionId,
    loginKey: expiredLaunchApproval.loginKey,
    groupKey: expiredLaunchApproval.groupKey,
    assignmentKey: expiredLaunchApproval.assignmentKey,
    actorType: input.actorType,
    actorId: input.actorId,
    eventType: "workspace.system_check.launch_approval.expired",
    payload: {
      launchApprovalId: expiredLaunchApproval.launchApprovalId,
      approvalScope: expiredLaunchApproval.approvalScope,
      expiresAt: expiredLaunchApproval.expiresAt,
      expiredAt: expiredLaunchApproval.expiredAt,
      expirationReasonCode: expiredLaunchApproval.expirationReasonCode
    }
  });

  return expiredLaunchApproval;
};

const synchronizeExpiredSystemCheckLaunchApprovalsByWorkspace = async (input: {
  store: PlatformStore;
  tenantKey: string;
  workspaceKey: string;
  requestContext: RequestContext;
}): Promise<void> => {
  const activeLaunchApprovals = await input.store.listSystemCheckLaunchApprovalsByWorkspace(
    input.tenantKey,
    input.workspaceKey,
    {
      status: "active",
      limit: 200
    }
  );

  for (const launchApproval of activeLaunchApprovals) {
    await expireSystemCheckLaunchApprovalIfNeeded({
      store: input.store,
      launchApproval,
      requestContext: input.requestContext,
      actorType: "platform_api",
      actorId: "platform-api"
    });
  }
};

const synchronizeSystemCheckLaunchApprovalsForParticipantSession = async (input: {
  store: PlatformStore;
  participantSession: {
    participantSessionId: string;
    tenantId: string;
    workspaceId: string;
    loginKey: string;
    groupKey: string;
  };
  systemCheckReadiness: SystemCheckLaunchReadinessDto;
  requestContext: RequestContext;
  actorType: "platform_api" | "participant";
  actorId: string;
}): Promise<SystemCheckLaunchApproval[]> => {
  const activeLaunchApprovals = await input.store.listSystemCheckLaunchApprovalsByParticipantSession(
    input.participantSession.participantSessionId,
    {
      status: "active",
      limit: 200
    }
  );

  const invalidatedApprovals: SystemCheckLaunchApproval[] = [];

  for (const launchApproval of activeLaunchApprovals) {
    const invalidation = getSystemCheckLaunchApprovalInvalidation({
      launchApproval,
      systemCheckReadiness: input.systemCheckReadiness
    });

    if (!invalidation) {
      continue;
    }

    const invalidatedLaunchApproval = invalidateSystemCheckLaunchApproval({
      launchApproval,
      reasonCode: invalidation.reasonCode,
      reasonDetail: invalidation.reasonDetail
    });

    await input.store.updateSystemCheckLaunchApproval(invalidatedLaunchApproval);
    await recordAuditEvent(input.store, {
      requestId: input.requestContext.requestId,
      tenantId: invalidatedLaunchApproval.tenantId,
      workspaceId: invalidatedLaunchApproval.workspaceId,
      participantSessionId: invalidatedLaunchApproval.participantSessionId,
      loginKey: invalidatedLaunchApproval.loginKey,
      groupKey: invalidatedLaunchApproval.groupKey,
      assignmentKey: invalidatedLaunchApproval.assignmentKey,
      actorType: input.actorType,
      actorId: input.actorId,
      eventType: "workspace.system_check.launch_approval.invalidated",
      payload: {
        launchApprovalId: invalidatedLaunchApproval.launchApprovalId,
        approvalScope: invalidatedLaunchApproval.approvalScope,
        previousWarningReasonCodes: launchApproval.warningReasonCodes,
        currentReadinessStatus: input.systemCheckReadiness.status,
        currentWarningReasonCodes: input.systemCheckReadiness.warningReasonCodes,
        invalidationReasonCode: invalidatedLaunchApproval.invalidationReasonCode,
        invalidationReasonDetail: invalidatedLaunchApproval.invalidationReasonDetail
      }
    });
    invalidatedApprovals.push(invalidatedLaunchApproval);
  }

  return invalidatedApprovals;
};

const getImportDiagnosticsAuditTrail = async (input: {
  store: PlatformStore;
  tenantKey: string;
  workspaceKey: string;
  importJobId: string;
  sourcePackageId: string;
  contentReleaseId?: string;
}): Promise<WorkspaceAuditEventDto[]> => {
  const relatedIds = new Set([input.importJobId, input.sourcePackageId]);

  if (input.contentReleaseId) {
    relatedIds.add(input.contentReleaseId);
  }

  const auditEvents = await input.store.listAuditEventsByWorkspace(input.tenantKey, input.workspaceKey, {
    limit: 200
  });

  return auditEvents
    .filter(auditEvent => {
      const importJobId = getAuditPayloadString(auditEvent.payload, "importJobId");
      const sourcePackageId = getAuditPayloadString(auditEvent.payload, "sourcePackageId");
      const contentReleaseId = getAuditPayloadString(auditEvent.payload, "contentReleaseId");

      return [importJobId, sourcePackageId, contentReleaseId].some(
        value => value !== undefined && relatedIds.has(value)
      );
    })
    .map(toWorkspaceAuditEventDto);
};

const toImportJobDiagnosticStages = (
  auditTrail: WorkspaceAuditEventDto[]
): ImportJobDetailResponse["diagnostics"]["stages"] => {
  const importStageOrder = [
    "queued",
    "worker_started",
    "load_source_package",
    "select_importer",
    "extract_source_manifest",
    "build_source_model",
    "validate_source_model",
    "transform_to_canonical",
    "validate_canonical_snapshot",
    "materialize_content_release",
    "complete"
  ] as const;
  const importStageOrderLookup: Readonly<Record<string, number>> = Object.fromEntries(
    importStageOrder.map((stageKey, index) => [stageKey, index])
  );
  const stages: ImportJobDetailResponse["diagnostics"]["stages"] = [];

  for (const auditEvent of [...auditTrail].sort(
    (left, right) => Date.parse(left.occurredAt) - Date.parse(right.occurredAt)
  )) {
    const defaultMessage = auditEvent.eventType.replaceAll(".", " ");

    if (auditEvent.eventType === "workspace.import_job.queued") {
      stages.push({
        stageKey: "queued",
        status: "completed",
        eventType: auditEvent.eventType,
        occurredAt: auditEvent.occurredAt,
        message: "Import job queued"
      });
      continue;
    }

    if (auditEvent.eventType === "worker.import_job.started") {
      stages.push({
        stageKey: getAuditPayloadString(auditEvent.payload, "stage") ?? "worker_started",
        status: "completed",
        eventType: auditEvent.eventType,
        occurredAt: auditEvent.occurredAt,
        message: "Worker started import processing"
      });
      continue;
    }

    if (auditEvent.eventType === "worker.import_job.source_package.loaded") {
      stages.push({
        stageKey: getAuditPayloadString(auditEvent.payload, "stage") ?? "load_source_package",
        status: "completed",
        eventType: auditEvent.eventType,
        occurredAt: auditEvent.occurredAt,
        message: `Loaded source package '${getAuditPayloadString(auditEvent.payload, "fileName") ?? "unknown"}'`
      });
      continue;
    }

    if (auditEvent.eventType === "worker.import_job.importer.selected") {
      stages.push({
        stageKey: getAuditPayloadString(auditEvent.payload, "stage") ?? "select_importer",
        status: "completed",
        eventType: auditEvent.eventType,
        occurredAt: auditEvent.occurredAt,
        message: `Selected importer '${getAuditPayloadString(auditEvent.payload, "importerKey") ?? "unknown"}'`
      });
      continue;
    }

    if (auditEvent.eventType === "worker.import_job.source_manifest.extracted") {
      stages.push({
        stageKey: getAuditPayloadString(auditEvent.payload, "stage") ?? "extract_source_manifest",
        status: "completed",
        eventType: auditEvent.eventType,
        occurredAt: auditEvent.occurredAt,
        message: `Extracted source manifest '${getAuditPayloadString(auditEvent.payload, "manifestHash") ?? "unknown"}'`
      });
      continue;
    }

    if (auditEvent.eventType === "worker.import_job.source_model.built") {
      stages.push({
        stageKey: getAuditPayloadString(auditEvent.payload, "stage") ?? "build_source_model",
        status: "completed",
        eventType: auditEvent.eventType,
        occurredAt: auditEvent.occurredAt,
        message: `Built source model for fixture '${getAuditPayloadString(auditEvent.payload, "fixtureKey") ?? "unknown"}'`
      });
      continue;
    }

    if (auditEvent.eventType === "worker.import_job.source_model.validated") {
      stages.push({
        stageKey: getAuditPayloadString(auditEvent.payload, "stage") ?? "validate_source_model",
        status: "completed",
        eventType: auditEvent.eventType,
        occurredAt: auditEvent.occurredAt,
        message: `Validated source model for fixture '${getAuditPayloadString(auditEvent.payload, "fixtureKey") ?? "unknown"}'`
      });
      continue;
    }

    if (auditEvent.eventType === "worker.import_job.canonical_snapshot.transformed") {
      stages.push({
        stageKey: getAuditPayloadString(auditEvent.payload, "stage") ?? "transform_to_canonical",
        status: "completed",
        eventType: auditEvent.eventType,
        occurredAt: auditEvent.occurredAt,
        message: `Transformed source model into canonical snapshot '${getAuditPayloadString(auditEvent.payload, "fixtureKey") ?? "unknown"}'`
      });
      continue;
    }

    if (auditEvent.eventType === "worker.import_job.canonical_snapshot.validated") {
      stages.push({
        stageKey: getAuditPayloadString(auditEvent.payload, "stage") ?? "validate_canonical_snapshot",
        status: "completed",
        eventType: auditEvent.eventType,
        occurredAt: auditEvent.occurredAt,
        message: `Validated canonical snapshot '${getAuditPayloadString(auditEvent.payload, "fixtureKey") ?? "unknown"}'`
      });
      continue;
    }

    if (auditEvent.eventType === "worker.import_job.canonical_snapshot.materialized") {
      stages.push({
        stageKey: getAuditPayloadString(auditEvent.payload, "stage") ?? "materialize_content_release",
        status: "completed",
        eventType: auditEvent.eventType,
        occurredAt: auditEvent.occurredAt,
        message: `Materialized canonical snapshot for release '${getAuditPayloadString(auditEvent.payload, "contentReleaseId") ?? "unknown"}'`
      });
      continue;
    }

    if (auditEvent.eventType === "worker.import_job.completed") {
      stages.push({
        stageKey: getAuditPayloadString(auditEvent.payload, "stage") ?? "complete",
        status: "completed",
        eventType: auditEvent.eventType,
        occurredAt: auditEvent.occurredAt,
        message: "Completed import job"
      });
      continue;
    }

    if (auditEvent.eventType === "worker.import_job.failed") {
      stages.push({
        stageKey: getAuditPayloadString(auditEvent.payload, "failedStage") ?? "failed",
        status: "failed",
        eventType: auditEvent.eventType,
        occurredAt: auditEvent.occurredAt,
        message: getAuditPayloadString(auditEvent.payload, "failureMessage") ?? defaultMessage
      });
    }
  }

  return stages
    .map((stage, index) => ({ stage, index }))
    .sort((left, right) => {
      const leftOrder = importStageOrderLookup[left.stage.stageKey];
      const rightOrder = importStageOrderLookup[right.stage.stageKey];

      if (leftOrder !== undefined || rightOrder !== undefined) {
        if (leftOrder === undefined) {
          return 1;
        }

        if (rightOrder === undefined) {
          return -1;
        }

        if (leftOrder !== rightOrder) {
          return leftOrder - rightOrder;
        }
      }

      const occurredAtComparison =
        Date.parse(left.stage.occurredAt) - Date.parse(right.stage.occurredAt);

      if (occurredAtComparison !== 0) {
        return occurredAtComparison;
      }

      if (left.stage.status !== right.stage.status) {
        return left.stage.status === "completed" ? -1 : 1;
      }

      return left.index - right.index;
    })
    .map(item => item.stage);
};

const toImportJobDiagnosticArtifacts = (
  auditTrail: WorkspaceAuditEventDto[]
): ImportJobDetailResponse["diagnostics"]["artifacts"] => {
  const importerSelectedEvent = getLatestAuditEventByType(auditTrail, "worker.import_job.importer.selected");
  const sourceManifestEvent = getLatestAuditEventByType(auditTrail, "worker.import_job.source_manifest.extracted");
  const sourceModelEvent = getLatestAuditEventByType(auditTrail, "worker.import_job.source_model.built");
  const referenceMapEvent = getLatestAuditEventByType(auditTrail, "worker.import_job.reference_map.built");
  const failedImportEvent = getLatestAuditEventByType(auditTrail, "worker.import_job.failed");
  const canonicalSummaryEvent =
    getLatestAuditEventByType(auditTrail, "worker.import_job.canonical_snapshot.validated") ??
    getLatestAuditEventByType(auditTrail, "worker.import_job.canonical_snapshot.materialized") ??
    getLatestAuditEventByType(auditTrail, "worker.import_job.canonical_snapshot.transformed") ??
    (
      getAuditPayloadString(failedImportEvent?.payload ?? {}, "failedStage") === "validate_canonical_snapshot"
        ? failedImportEvent
        : undefined
    );

  return {
    importerKey: getAuditPayloadString(importerSelectedEvent?.payload ?? {}, "importerKey") ?? null,
    sourceManifest: sourceManifestEvent ? {
      importerKey: getAuditPayloadString(sourceManifestEvent.payload, "importerKey") ?? "unknown",
      formatFamily: getAuditPayloadString(sourceManifestEvent.payload, "formatFamily") ?? "unknown",
      sourceSchemaVersion: getAuditPayloadString(sourceManifestEvent.payload, "sourceSchemaVersion") ?? "unknown",
      fileName: getAuditPayloadString(sourceManifestEvent.payload, "fileName") ?? "unknown",
      manifestHash: getAuditPayloadString(sourceManifestEvent.payload, "manifestHash") ?? "unknown",
      declaredUnitKeys: getAuditPayloadStringArray(sourceManifestEvent.payload, "declaredUnitKeys") ?? [],
      declaredBookletKeys: getAuditPayloadStringArray(sourceManifestEvent.payload, "declaredBookletKeys") ?? [],
      declaredGroupKeys: getAuditPayloadStringArray(sourceManifestEvent.payload, "declaredGroupKeys") ?? [],
      declaredLoginCount: getAuditPayloadNumber(sourceManifestEvent.payload, "declaredLoginCount") ?? 0
    } : null,
    sourceModel: sourceModelEvent ? {
      importerKey: getAuditPayloadString(sourceModelEvent.payload, "importerKey") ?? "unknown",
      fixtureKey: getAuditPayloadString(sourceModelEvent.payload, "fixtureKey") ?? "unknown",
      releaseLabel: getAuditPayloadString(sourceModelEvent.payload, "releaseLabel") ?? "unknown",
      unitCount: getAuditPayloadNumber(sourceModelEvent.payload, "unitCount") ?? 0,
      bookletCount: getAuditPayloadNumber(sourceModelEvent.payload, "bookletCount") ?? 0,
      loginCollectionCount: getAuditPayloadNumber(sourceModelEvent.payload, "loginCollectionCount") ?? 0,
      groupCount: getAuditPayloadNumber(sourceModelEvent.payload, "groupCount") ?? 0,
      loginCount: getAuditPayloadNumber(sourceModelEvent.payload, "loginCount") ?? 0,
      assignmentCount: getAuditPayloadNumber(sourceModelEvent.payload, "assignmentCount") ?? 0,
      bookletKeys: getAuditPayloadStringArray(sourceModelEvent.payload, "bookletKeys") ?? [],
      groupKeys: getAuditPayloadStringArray(sourceModelEvent.payload, "groupKeys") ?? [],
      assignmentKeys: getAuditPayloadStringArray(sourceModelEvent.payload, "assignmentKeys") ?? []
    } : null,
    canonicalSummary: canonicalSummaryEvent ? {
      fixtureKey: getAuditPayloadString(canonicalSummaryEvent.payload, "fixtureKey") ?? "unknown",
      unitCount: getAuditPayloadNumber(canonicalSummaryEvent.payload, "unitCount") ?? 0,
      bookletCount: getAuditPayloadNumber(canonicalSummaryEvent.payload, "bookletCount") ?? 0,
      loginCount: getAuditPayloadNumber(canonicalSummaryEvent.payload, "loginCount") ?? 0,
      assignmentCount: getAuditPayloadNumber(canonicalSummaryEvent.payload, "assignmentCount") ?? 0
    } : null,
    referenceMappings: referenceMapEvent
      ? toImportJobReferenceMappings(referenceMapEvent.payload)
      : failedImportEvent
        ? toImportJobReferenceMappings(failedImportEvent.payload)
        : []
  };
};

const toImportJobDiagnosticFailure = (
  auditTrail: WorkspaceAuditEventDto[]
): ImportJobDetailResponse["diagnostics"]["failure"] => {
  const failedImportEvent = getLatestAuditEventByType(auditTrail, "worker.import_job.failed");

  if (!failedImportEvent) {
    return null;
  }

  const failedStage = getAuditPayloadString(failedImportEvent.payload, "failedStage") ?? "failed";

  return {
    failedStage,
    failureMessage: getAuditPayloadString(failedImportEvent.payload, "failureMessage") ?? "Import job failed.",
    validationIssues: toImportJobValidationIssues(failedImportEvent.payload, failedStage),
    eventType: failedImportEvent.eventType,
    occurredAt: failedImportEvent.occurredAt
  };
};

const ensureSeedData = async (store: PlatformStore): Promise<void> => {
  const tenantKey = "demo-tenant";
  const workspaceKey = "demo-workspace";

  let tenant = await store.getTenantByKey(tenantKey);

  if (!tenant) {
    tenant = createTenant({
      tenantKey,
      displayName: "Demo Tenant"
    });
    await store.saveTenant(tenant);
  }

  const workspace = await store.getWorkspaceByKey(tenantKey, workspaceKey);

  if (!workspace) {
    await store.saveWorkspace(createWorkspace({
      tenantId: tenant.tenantId,
      workspaceKey,
      displayName: "Demo Workspace"
    }));
  }
};

const handlePlatformTenantsGet = async (store: PlatformStore, response: ServerResponse): Promise<void> => {
  sendJson(response, 200, {
    items: (await store.listTenants()).map(toTenantSummaryDto)
  });
};

const handlePlatformTenantsPost = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  requestContext: RequestContext
): Promise<void> => {
  const body = await readBody<CreateTenantRequest>(request);
  const tenantKey = getTrimmedString(body.tenantKey);
  const displayName = getTrimmedString(body.displayName);

  if (!tenantKey || !displayName) {
    sendError(response, 400, "invalid_tenant_payload", "tenantKey and displayName are required.");
    return;
  }

  if (await store.getTenantByKey(tenantKey)) {
    sendError(response, 409, "tenant_exists", `Tenant '${tenantKey}' already exists.`);
    return;
  }

  const tenant = createTenant({
    tenantKey,
    displayName
  });

  await store.saveTenant(tenant);
  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: tenant.tenantId,
    actorType: "platform_api",
    actorId: "platform-api",
    eventType: "tenant.created",
    payload: {
      tenantKey: tenant.tenantKey,
      displayName: tenant.displayName
    }
  });
  sendJson(response, 201, toTenantSummaryDto(tenant));
};

const toTenantActivationPolicyResponse = (tenant: Tenant): TenantActivationPolicyResponse => ({
  tenantKey: tenant.tenantKey,
  defaultActivationPolicy: toContentReleaseActivationPolicyDto(tenant.defaultActivationPolicy)
});

const toTenantOperationalPolicyResponse = (tenant: Tenant): TenantOperationalPolicyResponse => ({
  tenantKey: tenant.tenantKey,
  defaultOperationalPolicy: toOperationalPolicyDto(tenant.defaultOperationalPolicy)
});

const toTenantLaunchApprovalPolicyResponse = (
  tenant: Tenant
): TenantLaunchApprovalPolicyResponse => ({
  tenantKey: tenant.tenantKey,
  defaultLaunchApprovalPolicy: toLaunchApprovalPolicyDto(tenant.defaultLaunchApprovalPolicy)
});

const toTenantNotificationProviderPromotionPolicyResponse = (
  tenant: Tenant
): TenantNotificationProviderPromotionPolicyResponse => ({
  tenantKey: tenant.tenantKey,
  defaultNotificationProviderPromotionPolicy: toNotificationProviderPromotionPolicyDto(
    tenant.defaultNotificationProviderPromotionPolicy
  )
});

const toTenantNotificationPolicyResponse = (
  tenant: Tenant
): TenantNotificationPolicyResponse => ({
  tenantKey: tenant.tenantKey,
  defaultNotificationPolicy: toNotificationPolicyDto(tenant.defaultNotificationPolicy)
});

const toTenantGovernanceNotificationPolicyResponse = (
  tenant: Tenant
): TenantGovernanceNotificationPolicyResponse => ({
  tenantKey: tenant.tenantKey,
  defaultGovernanceNotificationPolicy: toNotificationPolicyDto(
    tenant.defaultGovernanceNotificationPolicy
  )
});

const toTenantRecoveryGovernanceNotificationPolicyResponse = (
  tenant: Tenant
): TenantRecoveryGovernanceNotificationPolicyResponse => ({
  tenantKey: tenant.tenantKey,
  defaultRecoveryGovernanceNotificationPolicy: toNotificationPolicyDto(
    tenant.defaultRecoveryGovernanceNotificationPolicy
  )
});

const toTenantNotificationProviderProfilesResponse = (
  tenant: Tenant
): TenantNotificationProviderProfilesResponse => ({
  tenantKey: tenant.tenantKey,
  defaultNotificationProviderProfiles: tenant.defaultNotificationProviderProfiles.map(
    toNotificationProviderProfileDto
  )
});

const toTenantEvidenceRetentionPolicyResponse = (
  tenant: Tenant
): TenantEvidenceRetentionPolicyResponse => ({
  tenantKey: tenant.tenantKey,
  defaultEvidenceRetentionPolicy: toEvidenceRetentionPolicyDto(tenant.defaultEvidenceRetentionPolicy)
});

const toTenantEvidenceRetentionClassPolicyResponse = (
  tenant: Tenant
): TenantEvidenceRetentionClassPolicyResponse => ({
  tenantKey: tenant.tenantKey,
  defaultEvidenceRetentionClassPolicy: toEvidenceRetentionClassPolicyDto(
    tenant.defaultEvidenceRetentionClassPolicy
  )
});

const handleTenantActivationPolicyGet = async (
  store: PlatformStore,
  response: ServerResponse,
  tenantKey: string
): Promise<void> => {
  const tenant = await store.getTenantByKey(tenantKey);

  if (!tenant) {
    sendError(response, 404, "tenant_not_found", `Tenant '${tenantKey}' was not found.`);
    return;
  }

  sendJson<TenantActivationPolicyResponse>(response, 200, toTenantActivationPolicyResponse(tenant));
};

const handleTenantActivationPolicyPatch = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  tenantKey: string,
  requestContext: RequestContext
): Promise<void> => {
  const tenant = await store.getTenantByKey(tenantKey);

  if (!tenant) {
    sendError(response, 404, "tenant_not_found", `Tenant '${tenantKey}' was not found.`);
    return;
  }

  const body = await readBody<UpdateTenantActivationPolicyRequest>(request);

  if (!isContentReleaseActivationPolicy(body.defaultActivationPolicy)) {
    sendError(
      response,
      400,
      "invalid_tenant_activation_policy_payload",
      "defaultActivationPolicy must provide all activation-policy boolean flags."
    );
    return;
  }

  const updatedTenant: Tenant = {
    ...tenant,
    defaultActivationPolicy: body.defaultActivationPolicy
  };

  await store.saveTenant(updatedTenant);
  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: updatedTenant.tenantId,
    actorType: "platform_api",
    actorId: "platform-api",
    eventType: "tenant.activation_policy.updated",
    payload: {
      tenantKey: updatedTenant.tenantKey,
      defaultActivationPolicy: updatedTenant.defaultActivationPolicy
    }
  });

  sendJson<TenantActivationPolicyResponse>(response, 200, toTenantActivationPolicyResponse(updatedTenant));
};

const handleTenantOperationalPolicyGet = async (
  store: PlatformStore,
  response: ServerResponse,
  tenantKey: string
): Promise<void> => {
  const tenant = await store.getTenantByKey(tenantKey);

  if (!tenant) {
    sendError(response, 404, "tenant_not_found", `Tenant '${tenantKey}' was not found.`);
    return;
  }

  sendJson<TenantOperationalPolicyResponse>(response, 200, toTenantOperationalPolicyResponse(tenant));
};

const handleTenantOperationalPolicyPatch = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  tenantKey: string,
  requestContext: RequestContext
): Promise<void> => {
  const tenant = await store.getTenantByKey(tenantKey);

  if (!tenant) {
    sendError(response, 404, "tenant_not_found", `Tenant '${tenantKey}' was not found.`);
    return;
  }

  const body = await readBody<UpdateTenantOperationalPolicyRequest>(request);

  if (!isOperationalPolicy(body.defaultOperationalPolicy)) {
    sendError(
      response,
      400,
      "invalid_tenant_operational_policy_payload",
      "defaultOperationalPolicy must provide all operational-policy integer fields."
    );
    return;
  }

  const updatedTenant: Tenant = {
    ...tenant,
    defaultOperationalPolicy: body.defaultOperationalPolicy
  };

  await store.saveTenant(updatedTenant);
  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: updatedTenant.tenantId,
    actorType: "platform_api",
    actorId: "platform-api",
    eventType: "tenant.operational_policy.updated",
    payload: {
      tenantKey: updatedTenant.tenantKey,
      defaultOperationalPolicy: updatedTenant.defaultOperationalPolicy
    }
  });

  sendJson<TenantOperationalPolicyResponse>(response, 200, toTenantOperationalPolicyResponse(updatedTenant));
};

const handleTenantLaunchApprovalPolicyGet = async (
  store: PlatformStore,
  response: ServerResponse,
  tenantKey: string
): Promise<void> => {
  const tenant = await store.getTenantByKey(tenantKey);

  if (!tenant) {
    sendError(response, 404, "tenant_not_found", `Tenant '${tenantKey}' was not found.`);
    return;
  }

  sendJson<TenantLaunchApprovalPolicyResponse>(
    response,
    200,
    toTenantLaunchApprovalPolicyResponse(tenant)
  );
};

const handleTenantLaunchApprovalPolicyPatch = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  tenantKey: string,
  requestContext: RequestContext
): Promise<void> => {
  const tenant = await store.getTenantByKey(tenantKey);

  if (!tenant) {
    sendError(response, 404, "tenant_not_found", `Tenant '${tenantKey}' was not found.`);
    return;
  }

  const body = await readBody<UpdateTenantLaunchApprovalPolicyRequest>(request);

  if (!isLaunchApprovalPolicy(body.defaultLaunchApprovalPolicy)) {
    sendError(
      response,
      400,
      "invalid_tenant_launch_approval_policy_payload",
      "defaultLaunchApprovalPolicy must provide all launch-approval policy integer fields."
    );
    return;
  }

  const updatedTenant: Tenant = {
    ...tenant,
    defaultLaunchApprovalPolicy: body.defaultLaunchApprovalPolicy
  };

  await store.saveTenant(updatedTenant);
  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: updatedTenant.tenantId,
    actorType: "platform_api",
    actorId: "platform-api",
    eventType: "tenant.launch_approval_policy.updated",
    payload: {
      tenantKey: updatedTenant.tenantKey,
      defaultLaunchApprovalPolicy: updatedTenant.defaultLaunchApprovalPolicy
    }
  });

  sendJson<TenantLaunchApprovalPolicyResponse>(
    response,
    200,
    toTenantLaunchApprovalPolicyResponse(updatedTenant)
  );
};

const handleTenantNotificationProviderPromotionPolicyGet = async (
  store: PlatformStore,
  response: ServerResponse,
  tenantKey: string
): Promise<void> => {
  const tenant = await store.getTenantByKey(tenantKey);

  if (!tenant) {
    sendError(response, 404, "tenant_not_found", `Tenant '${tenantKey}' was not found.`);
    return;
  }

  sendJson<TenantNotificationProviderPromotionPolicyResponse>(
    response,
    200,
    toTenantNotificationProviderPromotionPolicyResponse(tenant)
  );
};

const handleTenantNotificationProviderPromotionPolicyPatch = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  tenantKey: string,
  requestContext: RequestContext
): Promise<void> => {
  const tenant = await store.getTenantByKey(tenantKey);

  if (!tenant) {
    sendError(response, 404, "tenant_not_found", `Tenant '${tenantKey}' was not found.`);
    return;
  }

  const body = await readBody<UpdateTenantNotificationProviderPromotionPolicyRequest>(request);

  if (!isNotificationProviderPromotionPolicy(body.defaultNotificationProviderPromotionPolicy)) {
    sendError(
      response,
      400,
      "invalid_tenant_notification_provider_promotion_policy_payload",
      "defaultNotificationProviderPromotionPolicy must provide a valid promotion policy."
    );
    return;
  }

  const updatedTenant: Tenant = {
    ...tenant,
    defaultNotificationProviderPromotionPolicy:
      body.defaultNotificationProviderPromotionPolicy
  };

  await store.saveTenant(updatedTenant);
  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: updatedTenant.tenantId,
    actorType: "platform_api",
    actorId: "platform-api",
    eventType: "tenant.notification_provider_promotion_policy.updated",
    payload: {
      tenantKey: updatedTenant.tenantKey,
      defaultNotificationProviderPromotionPolicy:
        updatedTenant.defaultNotificationProviderPromotionPolicy
    }
  });

  sendJson<TenantNotificationProviderPromotionPolicyResponse>(
    response,
    200,
    toTenantNotificationProviderPromotionPolicyResponse(updatedTenant)
  );
};

const handleTenantNotificationPolicyGet = async (
  store: PlatformStore,
  response: ServerResponse,
  tenantKey: string
): Promise<void> => {
  const tenant = await store.getTenantByKey(tenantKey);

  if (!tenant) {
    sendError(response, 404, "tenant_not_found", `Tenant '${tenantKey}' was not found.`);
    return;
  }

  sendJson<TenantNotificationPolicyResponse>(
    response,
    200,
    toTenantNotificationPolicyResponse(tenant)
  );
};

const handleTenantNotificationPolicyPatch = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  tenantKey: string,
  requestContext: RequestContext
): Promise<void> => {
  const tenant = await store.getTenantByKey(tenantKey);

  if (!tenant) {
    sendError(response, 404, "tenant_not_found", `Tenant '${tenantKey}' was not found.`);
    return;
  }

  const body = await readBody<UpdateTenantNotificationPolicyRequest>(request);

  if (!isNotificationPolicy(body.defaultNotificationPolicy)) {
    sendError(
      response,
      400,
      "invalid_tenant_notification_policy_payload",
      "defaultNotificationPolicy must provide a valid notification policy."
    );
    return;
  }

  const updatedTenant: Tenant = {
    ...tenant,
    defaultNotificationPolicy: body.defaultNotificationPolicy
  };

  await store.saveTenant(updatedTenant);
  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: updatedTenant.tenantId,
    actorType: "platform_api",
    actorId: "platform-api",
    eventType: "tenant.notification_policy.updated",
    payload: {
      tenantKey: updatedTenant.tenantKey,
      defaultNotificationPolicy: updatedTenant.defaultNotificationPolicy
    }
  });

  sendJson<TenantNotificationPolicyResponse>(
    response,
    200,
    toTenantNotificationPolicyResponse(updatedTenant)
  );
};

const handleTenantGovernanceNotificationPolicyGet = async (
  store: PlatformStore,
  response: ServerResponse,
  tenantKey: string
): Promise<void> => {
  const tenant = await store.getTenantByKey(tenantKey);

  if (!tenant) {
    sendError(response, 404, "tenant_not_found", `Tenant '${tenantKey}' was not found.`);
    return;
  }

  sendJson<TenantGovernanceNotificationPolicyResponse>(
    response,
    200,
    toTenantGovernanceNotificationPolicyResponse(tenant)
  );
};

const handleTenantGovernanceNotificationPolicyPatch = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  tenantKey: string,
  requestContext: RequestContext
): Promise<void> => {
  const tenant = await store.getTenantByKey(tenantKey);

  if (!tenant) {
    sendError(response, 404, "tenant_not_found", `Tenant '${tenantKey}' was not found.`);
    return;
  }

  const body = await readBody<UpdateTenantGovernanceNotificationPolicyRequest>(request);

  if (!isNotificationPolicy(body.defaultGovernanceNotificationPolicy)) {
    sendError(
      response,
      400,
      "invalid_tenant_governance_notification_policy_payload",
      "defaultGovernanceNotificationPolicy must provide a valid notification policy."
    );
    return;
  }

  const updatedTenant: Tenant = {
    ...tenant,
    defaultGovernanceNotificationPolicy: body.defaultGovernanceNotificationPolicy
  };

  await store.saveTenant(updatedTenant);
  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: updatedTenant.tenantId,
    actorType: "platform_api",
    actorId: "platform-api",
    eventType: "tenant.governance_notification_policy.updated",
    payload: {
      tenantKey: updatedTenant.tenantKey,
      defaultGovernanceNotificationPolicy: updatedTenant.defaultGovernanceNotificationPolicy
    }
  });

  sendJson<TenantGovernanceNotificationPolicyResponse>(
    response,
    200,
    toTenantGovernanceNotificationPolicyResponse(updatedTenant)
  );
};

const handleTenantRecoveryGovernanceNotificationPolicyGet = async (
  store: PlatformStore,
  response: ServerResponse,
  tenantKey: string
): Promise<void> => {
  const tenant = await store.getTenantByKey(tenantKey);

  if (!tenant) {
    sendError(response, 404, "tenant_not_found", `Tenant '${tenantKey}' was not found.`);
    return;
  }

  sendJson<TenantRecoveryGovernanceNotificationPolicyResponse>(
    response,
    200,
    toTenantRecoveryGovernanceNotificationPolicyResponse(tenant)
  );
};

const handleTenantRecoveryGovernanceNotificationPolicyPatch = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  tenantKey: string,
  requestContext: RequestContext
): Promise<void> => {
  const tenant = await store.getTenantByKey(tenantKey);

  if (!tenant) {
    sendError(response, 404, "tenant_not_found", `Tenant '${tenantKey}' was not found.`);
    return;
  }

  const body = await readBody<UpdateTenantRecoveryGovernanceNotificationPolicyRequest>(request);

  if (!isNotificationPolicy(body.defaultRecoveryGovernanceNotificationPolicy)) {
    sendError(
      response,
      400,
      "invalid_tenant_recovery_governance_notification_policy_payload",
      "defaultRecoveryGovernanceNotificationPolicy must provide a valid notification policy."
    );
    return;
  }

  const updatedTenant: Tenant = {
    ...tenant,
    defaultRecoveryGovernanceNotificationPolicy: body.defaultRecoveryGovernanceNotificationPolicy
  };

  await store.saveTenant(updatedTenant);
  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: updatedTenant.tenantId,
    actorType: "platform_api",
    actorId: "platform-api",
    eventType: "tenant.recovery_governance_notification_policy.updated",
    payload: {
      tenantKey: updatedTenant.tenantKey,
      defaultRecoveryGovernanceNotificationPolicy:
        updatedTenant.defaultRecoveryGovernanceNotificationPolicy
    }
  });

  sendJson<TenantRecoveryGovernanceNotificationPolicyResponse>(
    response,
    200,
    toTenantRecoveryGovernanceNotificationPolicyResponse(updatedTenant)
  );
};

const handleTenantNotificationProviderProfilesGet = async (
  store: PlatformStore,
  response: ServerResponse,
  tenantKey: string
): Promise<void> => {
  const tenant = await store.getTenantByKey(tenantKey);

  if (!tenant) {
    sendError(response, 404, "tenant_not_found", `Tenant '${tenantKey}' was not found.`);
    return;
  }

  sendJson<TenantNotificationProviderProfilesResponse>(
    response,
    200,
    toTenantNotificationProviderProfilesResponse(tenant)
  );
};

const handleTenantNotificationProviderProfilesPatch = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  tenantKey: string,
  requestContext: RequestContext
): Promise<void> => {
  const tenant = await store.getTenantByKey(tenantKey);

  if (!tenant) {
    sendError(response, 404, "tenant_not_found", `Tenant '${tenantKey}' was not found.`);
    return;
  }

  const body = await readBody<UpdateTenantNotificationProviderProfilesRequest>(request);

  if (!isNotificationProviderProfileInputs(body.defaultNotificationProviderProfiles)) {
    sendError(
      response,
      400,
      "invalid_tenant_notification_provider_profiles_payload",
      "defaultNotificationProviderProfiles must provide a non-empty set of unique provider profiles."
    );
    return;
  }

  const previousProfilesByKey = new Map(
    tenant.defaultNotificationProviderProfiles.map(profile => [profile.profileKey, profile])
  );
  const nextTenantNotificationProviderProfiles = body.defaultNotificationProviderProfiles.map(
    profile => toNotificationProviderProfile(profile, previousProfilesByKey.get(profile.profileKey))
  );
  const tenantFallbackValidationError = validateNotificationProviderProfileFallbacks({
    profiles: nextTenantNotificationProviderProfiles,
    availableProfileKeys: new Set(
      nextTenantNotificationProviderProfiles.map(profile => profile.profileKey)
    )
  });

  if (tenantFallbackValidationError) {
    sendError(
      response,
      400,
      "invalid_tenant_notification_provider_profiles_payload",
      tenantFallbackValidationError
    );
    return;
  }

  const updatedTenant: Tenant = {
    ...tenant,
    defaultNotificationProviderProfiles: nextTenantNotificationProviderProfiles
  };

  await store.saveTenant(updatedTenant);
  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: updatedTenant.tenantId,
    actorType: "platform_api",
    actorId: "platform-api",
    eventType: "tenant.notification_provider_profiles.updated",
    payload: {
      tenantKey: updatedTenant.tenantKey,
      defaultNotificationProviderProfiles: updatedTenant.defaultNotificationProviderProfiles.map(
        toNotificationProviderProfileDto
      )
    }
  });

  sendJson<TenantNotificationProviderProfilesResponse>(
    response,
    200,
    toTenantNotificationProviderProfilesResponse(updatedTenant)
  );
};

const handleTenantEvidenceRetentionPolicyGet = async (
  store: PlatformStore,
  response: ServerResponse,
  tenantKey: string
): Promise<void> => {
  const tenant = await store.getTenantByKey(tenantKey);

  if (!tenant) {
    sendError(response, 404, "tenant_not_found", `Tenant '${tenantKey}' was not found.`);
    return;
  }

  sendJson<TenantEvidenceRetentionPolicyResponse>(
    response,
    200,
    toTenantEvidenceRetentionPolicyResponse(tenant)
  );
};

const handleTenantEvidenceRetentionPolicyPatch = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  tenantKey: string,
  requestContext: RequestContext
): Promise<void> => {
  const tenant = await store.getTenantByKey(tenantKey);

  if (!tenant) {
    sendError(response, 404, "tenant_not_found", `Tenant '${tenantKey}' was not found.`);
    return;
  }

  const body = await readBody<UpdateTenantEvidenceRetentionPolicyRequest>(request);

  if (!isEvidenceRetentionPolicy(body.defaultEvidenceRetentionPolicy)) {
    sendError(
      response,
      400,
      "invalid_tenant_evidence_retention_policy_payload",
      "defaultEvidenceRetentionPolicy must provide all evidence-retention policy integer fields."
    );
    return;
  }

  const updatedTenant: Tenant = {
    ...tenant,
    defaultEvidenceRetentionPolicy: body.defaultEvidenceRetentionPolicy
  };

  await store.saveTenant(updatedTenant);
  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: updatedTenant.tenantId,
    actorType: "platform_api",
    actorId: "platform-api",
    eventType: "tenant.evidence_retention_policy.updated",
    payload: {
      tenantKey: updatedTenant.tenantKey,
      defaultEvidenceRetentionPolicy: updatedTenant.defaultEvidenceRetentionPolicy
    }
  });

  sendJson<TenantEvidenceRetentionPolicyResponse>(
    response,
    200,
    toTenantEvidenceRetentionPolicyResponse(updatedTenant)
  );
};

const handleTenantEvidenceRetentionClassPolicyGet = async (
  store: PlatformStore,
  response: ServerResponse,
  tenantKey: string
): Promise<void> => {
  const tenant = await store.getTenantByKey(tenantKey);

  if (!tenant) {
    sendError(response, 404, "tenant_not_found", `Tenant '${tenantKey}' was not found.`);
    return;
  }

  sendJson<TenantEvidenceRetentionClassPolicyResponse>(
    response,
    200,
    toTenantEvidenceRetentionClassPolicyResponse(tenant)
  );
};

const handleTenantEvidenceRetentionClassPolicyPatch = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  tenantKey: string,
  requestContext: RequestContext
): Promise<void> => {
  const tenant = await store.getTenantByKey(tenantKey);

  if (!tenant) {
    sendError(response, 404, "tenant_not_found", `Tenant '${tenantKey}' was not found.`);
    return;
  }

  const body = await readBody<UpdateTenantEvidenceRetentionClassPolicyRequest>(request);

  if (!isEvidenceRetentionClassPolicy(body.defaultEvidenceRetentionClassPolicy)) {
    sendError(
      response,
      400,
      "invalid_tenant_evidence_retention_class_policy_payload",
      "defaultEvidenceRetentionClassPolicy must provide a valid class registry."
    );
    return;
  }

  const updatedTenant: Tenant = {
    ...tenant,
    defaultEvidenceRetentionClassPolicy: body.defaultEvidenceRetentionClassPolicy
  };

  await store.saveTenant(updatedTenant);
  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: updatedTenant.tenantId,
    actorType: "platform_api",
    actorId: "platform-api",
    eventType: "tenant.evidence_retention_class_policy.updated",
    payload: {
      tenantKey: updatedTenant.tenantKey,
      defaultEvidenceRetentionClassPolicy: updatedTenant.defaultEvidenceRetentionClassPolicy
    }
  });

  sendJson<TenantEvidenceRetentionClassPolicyResponse>(
    response,
    200,
    toTenantEvidenceRetentionClassPolicyResponse(updatedTenant)
  );
};

const handleTenantPolicyHistoryGet = async (
  store: PlatformStore,
  response: ServerResponse,
  url: URL,
  tenantKey: string
): Promise<void> => {
  const tenant = await store.getTenantByKey(tenantKey);

  if (!tenant) {
    sendError(response, 404, "tenant_not_found", `Tenant '${tenantKey}' was not found.`);
    return;
  }

  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit ? Number.parseInt(rawLimit, 10) : 50;

  if (!Number.isInteger(limit) || limit <= 0 || limit > 200) {
    sendError(response, 400, "invalid_policy_history_limit", "limit must be an integer between 1 and 200.");
    return;
  }

  sendJson<PolicyHistoryResponse>(response, 200, {
    items: (
      await store.listAuditEventsByTenant(tenantKey, {
        limit,
        eventTypes: [...tenantPolicyAuditEventTypes]
      })
    )
      .flatMap(auditEvent => {
        const historyEntry = toPolicyHistoryEntryDto(auditEvent, {
          tenantKey
        });

        return historyEntry ? [historyEntry] : [];
      })
  });
};

const handleTenantWorkspacesGet = async (
  store: PlatformStore,
  response: ServerResponse,
  tenantKey: string
): Promise<void> => {
  if (!(await store.getTenantByKey(tenantKey))) {
    sendError(response, 404, "tenant_not_found", `Tenant '${tenantKey}' was not found.`);
    return;
  }

  sendJson(response, 200, {
    items: (await store.listWorkspacesByTenant(tenantKey)).map(toWorkspaceSummaryDto)
  });
};

const handleTenantWorkspacesPost = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  tenantKey: string,
  requestContext: RequestContext
): Promise<void> => {
  const tenant = await store.getTenantByKey(tenantKey);

  if (!tenant) {
    sendError(response, 404, "tenant_not_found", `Tenant '${tenantKey}' was not found.`);
    return;
  }

  const body = await readBody<CreateWorkspaceRequest>(request);
  const workspaceKey = getTrimmedString(body.workspaceKey);
  const displayName = getTrimmedString(body.displayName);

  if (!workspaceKey || !displayName) {
    sendError(response, 400, "invalid_workspace_payload", "workspaceKey and displayName are required.");
    return;
  }

  if (await store.getWorkspaceByKey(tenantKey, workspaceKey)) {
    sendError(
      response,
      409,
      "workspace_exists",
      `Workspace '${workspaceKey}' already exists in tenant '${tenantKey}'.`
    );
    return;
  }

  const workspace = createWorkspace({
    tenantId: tenant.tenantId,
    workspaceKey,
    displayName
  });

  await store.saveWorkspace(workspace);
  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: tenant.tenantId,
    workspaceId: workspace.workspaceId,
    actorType: "platform_api",
    actorId: "platform-api",
    eventType: "workspace.created",
    payload: {
      workspaceKey: workspace.workspaceKey,
      displayName: workspace.displayName
    }
  });
  sendJson(response, 201, toWorkspaceSummaryDto(workspace));
};

const toWorkspaceActivationPolicyResponse = (
  tenant: Tenant,
  workspace: Workspace
): WorkspaceActivationPolicyResponse => {
  const flattenedOverride = flattenActivationPolicyOverrideRecords(workspace.activationPolicyOverrideRecords);

  return {
    tenantKey: tenant.tenantKey,
    workspaceKey: workspace.workspaceKey,
    mode: workspace.activationPolicyOverrideRecords ? "override" : "inherit",
    defaultActivationPolicy: toContentReleaseActivationPolicyDto(tenant.defaultActivationPolicy),
    activationPolicyOverride: flattenedOverride
      ? toContentReleaseActivationPolicyOverrideDto(flattenedOverride)
      : null,
    activationPolicyOverrideRecords: toActivationPolicyOverrideRecordsDto(workspace.activationPolicyOverrideRecords),
    effectiveActivationPolicy: toContentReleaseActivationPolicyDto(resolveWorkspaceActivationPolicy(workspace, tenant))
  };
};

const toWorkspaceOperationalPolicyResponse = (
  tenant: Tenant,
  workspace: Workspace
): WorkspaceOperationalPolicyResponse => {
  const flattenedOverride = flattenOperationalPolicyOverrideRecords(workspace.operationalPolicyOverrideRecords);

  return {
    tenantKey: tenant.tenantKey,
    workspaceKey: workspace.workspaceKey,
    mode: workspace.operationalPolicyOverrideRecords ? "override" : "inherit",
    defaultOperationalPolicy: toOperationalPolicyDto(tenant.defaultOperationalPolicy),
    operationalPolicyOverride: flattenedOverride
      ? toOperationalPolicyOverrideDto(flattenedOverride)
      : null,
    operationalPolicyOverrideRecords: toOperationalPolicyOverrideRecordsDto(workspace.operationalPolicyOverrideRecords),
    effectiveOperationalPolicy: toOperationalPolicyDto(resolveWorkspaceOperationalPolicy(workspace, tenant))
  };
};

const toWorkspaceLaunchApprovalPolicyResponse = (
  tenant: Tenant,
  workspace: Workspace
): WorkspaceLaunchApprovalPolicyResponse => {
  const flattenedOverride = flattenLaunchApprovalPolicyOverrideRecords(
    workspace.launchApprovalPolicyOverrideRecords
  );

  return {
    tenantKey: tenant.tenantKey,
    workspaceKey: workspace.workspaceKey,
    mode: workspace.launchApprovalPolicyOverrideRecords ? "override" : "inherit",
    defaultLaunchApprovalPolicy: toLaunchApprovalPolicyDto(tenant.defaultLaunchApprovalPolicy),
    launchApprovalPolicyOverride: flattenedOverride
      ? toLaunchApprovalPolicyOverrideDto(flattenedOverride)
      : null,
    launchApprovalPolicyOverrideRecords: toLaunchApprovalPolicyOverrideRecordsDto(
      workspace.launchApprovalPolicyOverrideRecords
    ),
    effectiveLaunchApprovalPolicy: toLaunchApprovalPolicyDto(
      resolveWorkspaceLaunchApprovalPolicy(workspace, tenant)
    )
  };
};

const toWorkspaceNotificationProviderPromotionPolicyResponse = (
  tenant: Tenant,
  workspace: Workspace
): WorkspaceNotificationProviderPromotionPolicyResponse => {
  const flattenedOverride = flattenNotificationProviderPromotionPolicyOverrideRecords(
    workspace.notificationProviderPromotionPolicyOverrideRecords
  );

  return {
    tenantKey: tenant.tenantKey,
    workspaceKey: workspace.workspaceKey,
    mode: workspace.notificationProviderPromotionPolicyOverrideRecords ? "override" : "inherit",
    defaultNotificationProviderPromotionPolicy: toNotificationProviderPromotionPolicyDto(
      tenant.defaultNotificationProviderPromotionPolicy
    ),
    notificationProviderPromotionPolicyOverride: flattenedOverride
      ? toNotificationProviderPromotionPolicyOverrideDto(flattenedOverride)
      : null,
    notificationProviderPromotionPolicyOverrideRecords:
      toNotificationProviderPromotionPolicyOverrideRecordsDto(
        workspace.notificationProviderPromotionPolicyOverrideRecords
      ),
    effectiveNotificationProviderPromotionPolicy: toNotificationProviderPromotionPolicyDto(
      resolveWorkspaceNotificationProviderPromotionPolicy(workspace, tenant)
    )
  };
};

const toWorkspaceNotificationPolicyResponse = (
  tenant: Tenant,
  workspace: Workspace
): WorkspaceNotificationPolicyResponse => {
  const flattenedOverride = flattenNotificationPolicyOverrideRecords(
    workspace.notificationPolicyOverrideRecords
  );

  return {
    tenantKey: tenant.tenantKey,
    workspaceKey: workspace.workspaceKey,
    mode: workspace.notificationPolicyOverrideRecords ? "override" : "inherit",
    defaultNotificationPolicy: toNotificationPolicyDto(tenant.defaultNotificationPolicy),
    notificationPolicyOverride: flattenedOverride
      ? toNotificationPolicyOverrideDto(flattenedOverride)
      : null,
    notificationPolicyOverrideRecords: toNotificationPolicyOverrideRecordsDto(
      workspace.notificationPolicyOverrideRecords
    ),
    effectiveNotificationPolicy: toNotificationPolicyDto(
      resolveWorkspaceNotificationPolicy(workspace, tenant)
    )
  };
};

const toWorkspaceGovernanceNotificationPolicyResponse = (
  tenant: Tenant,
  workspace: Workspace
): WorkspaceGovernanceNotificationPolicyResponse => {
  const flattenedOverride = flattenNotificationPolicyOverrideRecords(
    workspace.governanceNotificationPolicyOverrideRecords
  );

  return {
    tenantKey: tenant.tenantKey,
    workspaceKey: workspace.workspaceKey,
    mode: workspace.governanceNotificationPolicyOverrideRecords ? "override" : "inherit",
    defaultGovernanceNotificationPolicy: toNotificationPolicyDto(
      tenant.defaultGovernanceNotificationPolicy
    ),
    governanceNotificationPolicyOverride: flattenedOverride
      ? toNotificationPolicyOverrideDto(flattenedOverride)
      : null,
    governanceNotificationPolicyOverrideRecords: toNotificationPolicyOverrideRecordsDto(
      workspace.governanceNotificationPolicyOverrideRecords
    ),
    effectiveGovernanceNotificationPolicy: toNotificationPolicyDto(
      resolveWorkspaceGovernanceNotificationPolicy(workspace, tenant)
    )
  };
};

const toWorkspaceRecoveryGovernanceNotificationPolicyResponse = (
  tenant: Tenant,
  workspace: Workspace
): WorkspaceRecoveryGovernanceNotificationPolicyResponse => {
  const flattenedOverride = flattenNotificationPolicyOverrideRecords(
    workspace.recoveryGovernanceNotificationPolicyOverrideRecords
  );

  return {
    tenantKey: tenant.tenantKey,
    workspaceKey: workspace.workspaceKey,
    mode: workspace.recoveryGovernanceNotificationPolicyOverrideRecords ? "override" : "inherit",
    defaultRecoveryGovernanceNotificationPolicy: toNotificationPolicyDto(
      tenant.defaultRecoveryGovernanceNotificationPolicy
    ),
    recoveryGovernanceNotificationPolicyOverride: flattenedOverride
      ? toNotificationPolicyOverrideDto(flattenedOverride)
      : null,
    recoveryGovernanceNotificationPolicyOverrideRecords: toNotificationPolicyOverrideRecordsDto(
      workspace.recoveryGovernanceNotificationPolicyOverrideRecords
    ),
    effectiveRecoveryGovernanceNotificationPolicy: toNotificationPolicyDto(
      resolveWorkspaceRecoveryGovernanceNotificationPolicy(workspace, tenant)
    )
  };
};

const toWorkspaceNotificationProviderProfilesResponse = (
  tenant: Tenant,
  workspace: Workspace
): WorkspaceNotificationProviderProfilesResponse => ({
  tenantKey: tenant.tenantKey,
  workspaceKey: workspace.workspaceKey,
  mode: workspace.notificationProviderProfileOverrideRecords ? "override" : "inherit",
  defaultNotificationProviderProfiles: tenant.defaultNotificationProviderProfiles.map(
    toNotificationProviderProfileDto
  ),
  notificationProviderProfileOverride: flattenNotificationProviderProfileOverrideRecords(
    workspace.notificationProviderProfileOverrideRecords
  )?.map(toNotificationProviderProfileDto) ?? null,
  removedNotificationProviderProfileKeys: flattenRemovedNotificationProviderProfileKeys(
    workspace.notificationProviderProfileOverrideRecords
  ),
  notificationProviderProfileOverrideRecords: toNotificationProviderProfileOverrideRecordDtos(
    workspace.notificationProviderProfileOverrideRecords
  ),
  effectiveNotificationProviderProfiles: resolveWorkspaceNotificationProviderProfiles(
    workspace,
    tenant
  ).map(toNotificationProviderProfileDto)
});

const tryExtractRequestedNotificationProviderProfileKey = (
  escalationTarget: string | null
): string | null => {
  const trimmedEscalationTarget = escalationTarget?.trim() ?? "";

  if (!trimmedEscalationTarget.startsWith("profile:")) {
    return null;
  }

  const requestedProfileKey = trimmedEscalationTarget.slice("profile:".length).trim();

  return requestedProfileKey.length > 0 ? requestedProfileKey : null;
};

const toNotificationProviderProfilePromotionReadiness = (input: {
  profile: NotificationProviderProfile;
  requestedCount: number;
  directSelectionCount: number;
  deliveredCount: number;
  deliveryFailedCount: number;
  promotionPolicy: NotificationProviderPromotionPolicy;
}): NotificationProviderProfileRolloutMetricsItemDto["promotionReadiness"] => {
  const reasons: string[] = [];

  if (input.profile.rolloutState !== "canary") {
    reasons.push("profile_is_not_canary");
  }

  if (resolveOutboundNotificationProviderProfileHealthStatus(input.profile) !== "ready") {
    reasons.push("profile_is_not_ready");
  }

  if (input.requestedCount < input.promotionPolicy.minimumRequestedCount) {
    reasons.push("insufficient_requested_volume");
  }

  if (input.directSelectionCount < input.promotionPolicy.minimumDirectSelectionCount) {
    reasons.push("insufficient_direct_selection_volume");
  }

  if (input.deliveredCount < input.promotionPolicy.minimumDeliveredCount) {
    reasons.push("insufficient_successful_deliveries");
  }

  if (input.deliveryFailedCount > input.promotionPolicy.maximumDeliveryFailedCount) {
    reasons.push("delivery_failures_present");
  }

  if (isOutboundNotificationProviderProfilePromotionSuppressed(input.profile)) {
    reasons.push("promotion_suppressed_after_auto_rollback");
  }

  return {
    status: reasons.length === 0 ? "ready" : "blocked",
    evaluationWindowHours: input.promotionPolicy.evaluationWindowHours,
    reasons
  };
};

const toWorkspaceNotificationProviderProfileRolloutMetricsResponse = (input: {
  tenant: Tenant;
  workspace: Workspace;
  notifications: import("@testcenter-rewrite/domain").SystemCheckEvidenceBreachNotification[];
  evaluationWindowHours?: number;
}): WorkspaceNotificationProviderProfileRolloutMetricsResponse => {
  const effectiveProfiles = resolveWorkspaceNotificationProviderProfiles(
    input.workspace,
    input.tenant
  );
  const effectivePromotionPolicy = resolveWorkspaceNotificationProviderPromotionPolicy(
    input.workspace,
    input.tenant
  );
  const evaluationWindowHours =
    input.evaluationWindowHours ?? effectivePromotionPolicy.evaluationWindowHours;
  const evaluationWindowStart = new Date(
    Date.now() - evaluationWindowHours * 60 * 60 * 1000
  ).toISOString();

  return {
    tenantKey: input.tenant.tenantKey,
    workspaceKey: input.workspace.workspaceKey,
    evaluationWindowHours,
    items: effectiveProfiles.map(profile => {
      let requestedCount = 0;
      let directSelectionCount = 0;
      let fallbackRoutedCount = 0;
      let fallbackRecipientCount = 0;
      let rolloutBlockedCount = 0;
      let deliveredCount = 0;
      let pendingDeliveryCount = 0;
      let deliveryFailedCount = 0;
      let lastDeliveredAt: string | null = null;
      let lastDeliveryFailedAt: string | null = null;

      for (const notification of input.notifications) {
        if (notification.createdAt < evaluationWindowStart) {
          continue;
        }

        const requestedProfileKey = tryExtractRequestedNotificationProviderProfileKey(
          notification.escalationTarget
        );

        if (requestedProfileKey === profile.profileKey) {
          requestedCount += 1;

          if (notification.deliveryProfileKey === profile.profileKey) {
            directSelectionCount += 1;
          } else if (notification.deliveryProfileKey) {
            fallbackRoutedCount += 1;
          } else if (notification.deliveryTarget === null) {
            rolloutBlockedCount += 1;
          }
        }

        if (
          notification.deliveryProfileKey === profile.profileKey &&
          requestedProfileKey !== null &&
          requestedProfileKey !== profile.profileKey
        ) {
          fallbackRecipientCount += 1;
        }

        if (notification.deliveryProfileKey !== profile.profileKey) {
          continue;
        }

        if (notification.deliveryStatus === "delivered") {
          deliveredCount += 1;

          if (
            notification.deliveredAt &&
            (lastDeliveredAt === null || notification.deliveredAt > lastDeliveredAt)
          ) {
            lastDeliveredAt = notification.deliveredAt;
          }
        } else if (notification.deliveryStatus === "pending_delivery") {
          pendingDeliveryCount += 1;
        } else if (notification.deliveryStatus === "delivery_failed") {
          deliveryFailedCount += 1;

          if (
            notification.lastDeliveryAttemptAt &&
            (lastDeliveryFailedAt === null ||
              notification.lastDeliveryAttemptAt > lastDeliveryFailedAt)
          ) {
            lastDeliveryFailedAt = notification.lastDeliveryAttemptAt;
          }
        }
      }

      return {
        profileKey: profile.profileKey,
        displayLabel: profile.displayLabel,
        rolloutState: profile.rolloutState,
        rolloutPercentage: profile.rolloutPercentage,
        rolloutFallbackProfileKey: profile.rolloutFallbackProfileKey,
        targetProbeMode: profile.targetProbeMode,
        healthStatus: resolveOutboundNotificationProviderProfileHealthStatus(profile),
        requestedCount,
        directSelectionCount,
        fallbackRoutedCount,
        fallbackRecipientCount,
        rolloutBlockedCount,
        deliveredCount,
        pendingDeliveryCount,
        deliveryFailedCount,
        lastDeliveredAt,
        lastDeliveryFailedAt,
        promotionReadiness: toNotificationProviderProfilePromotionReadiness({
          profile,
          requestedCount,
          directSelectionCount,
          deliveredCount,
          deliveryFailedCount,
          promotionPolicy: {
            ...effectivePromotionPolicy,
            evaluationWindowHours
          }
        })
      };
    })
  };
};

const toWorkspaceNotificationProviderProfileGovernanceAlertMetricsResponse = (input: {
  alerts: NotificationProviderProfileGovernanceAlert[];
  profileKey: string | null;
  alertClass: "incident_open" | "incident_resolved" | null;
  deliveryChannel: SystemCheckEvidenceBreachNotificationDeliveryChannelDto | null;
}): WorkspaceNotificationProviderProfileGovernanceAlertMetricsResponse => {
  const buckets = new Map<
    string,
    WorkspaceNotificationProviderProfileGovernanceAlertMetricsResponse["items"][number]
  >();

  for (const alert of input.alerts) {
    if (input.alertClass && alert.alertClass !== input.alertClass) {
      continue;
    }

    if (input.deliveryChannel && alert.deliveryChannel !== input.deliveryChannel) {
      continue;
    }

    const bucketKey = `${alert.profileKey}:${alert.alertClass}`;
    const existingBucket = buckets.get(bucketKey);

    if (existingBucket) {
      existingBucket.totalCount += 1;

      if (alert.status === "pending_acknowledgement") {
        existingBucket.pendingAcknowledgementCount += 1;
      } else {
        existingBucket.acknowledgedCount += 1;
      }

      if (alert.deliveryStatus === "pending_delivery") {
        existingBucket.pendingDeliveryCount += 1;
      } else if (alert.deliveryStatus === "delivered") {
        existingBucket.deliveredCount += 1;
      } else {
        existingBucket.deliveryFailedCount += 1;
      }

      if (alert.createdAt > existingBucket.latestCreatedAt) {
        existingBucket.latestCreatedAt = alert.createdAt;
      }

      if (
        alert.deliveredAt &&
        (existingBucket.latestDeliveredAt === null ||
          alert.deliveredAt > existingBucket.latestDeliveredAt)
      ) {
        existingBucket.latestDeliveredAt = alert.deliveredAt;
      }

      if (
        alert.acknowledgedAt &&
        (existingBucket.latestAcknowledgedAt === null ||
          alert.acknowledgedAt > existingBucket.latestAcknowledgedAt)
      ) {
        existingBucket.latestAcknowledgedAt = alert.acknowledgedAt;
      }

      if (
        alert.deliveryStatus === "delivery_failed" &&
        alert.lastDeliveryAttemptAt &&
        (existingBucket.latestDeliveryFailedAt === null ||
          alert.lastDeliveryAttemptAt > existingBucket.latestDeliveryFailedAt)
      ) {
        existingBucket.latestDeliveryFailedAt = alert.lastDeliveryAttemptAt;
      }

      continue;
    }

    buckets.set(bucketKey, {
      profileKey: alert.profileKey,
      alertClass: alert.alertClass,
      totalCount: 1,
      pendingAcknowledgementCount: alert.status === "pending_acknowledgement" ? 1 : 0,
      acknowledgedCount: alert.status === "acknowledged" ? 1 : 0,
      pendingDeliveryCount: alert.deliveryStatus === "pending_delivery" ? 1 : 0,
      deliveredCount: alert.deliveryStatus === "delivered" ? 1 : 0,
      deliveryFailedCount: alert.deliveryStatus === "delivery_failed" ? 1 : 0,
      latestCreatedAt: alert.createdAt,
      latestDeliveredAt: alert.deliveredAt,
      latestAcknowledgedAt: alert.acknowledgedAt,
      latestDeliveryFailedAt:
        alert.deliveryStatus === "delivery_failed" ? alert.lastDeliveryAttemptAt : null
    });
  }

  return {
    items: Array.from(buckets.values()).sort((left, right) =>
      right.latestCreatedAt.localeCompare(left.latestCreatedAt)
    ),
    filters: {
      profileKey: input.profileKey,
      alertClass: input.alertClass,
      deliveryChannel: input.deliveryChannel
    }
  };
};

const toWorkspaceNotificationProviderProfileGovernanceAlertTrendsResponse = (input: {
  alerts: NotificationProviderProfileGovernanceAlert[];
  profileKey: string | null;
  alertClass: "incident_open" | "incident_resolved" | null;
  deliveryChannel: SystemCheckEvidenceBreachNotificationDeliveryChannelDto | null;
  windowHours: number;
  bucketHours: number;
}): WorkspaceNotificationProviderProfileGovernanceAlertTrendsResponse => {
  const now = Date.now();
  const windowStartMs = now - input.windowHours * 60 * 60 * 1000;
  const bucketMs = input.bucketHours * 60 * 60 * 1000;
  const itemBuckets = new Map<
    string,
    {
      profileKey: string;
      alertClass: "incident_open" | "incident_resolved";
      totalCount: number;
      buckets: Map<
        string,
        {
          bucketStart: string;
          bucketEnd: string;
          totalCount: number;
          pendingAcknowledgementCount: number;
          acknowledgedCount: number;
          pendingDeliveryCount: number;
          deliveredCount: number;
          deliveryFailedCount: number;
        }
      >;
    }
  >();

  for (const alert of input.alerts) {
    if (input.alertClass && alert.alertClass !== input.alertClass) {
      continue;
    }

    if (input.deliveryChannel && alert.deliveryChannel !== input.deliveryChannel) {
      continue;
    }

    const createdAtMs = Date.parse(alert.createdAt);
    if (Number.isNaN(createdAtMs) || createdAtMs < windowStartMs) {
      continue;
    }

    const itemKey = `${alert.profileKey}:${alert.alertClass}`;
    const bucketStartMs =
      windowStartMs + Math.floor((createdAtMs - windowStartMs) / bucketMs) * bucketMs;
    const bucketStart = new Date(bucketStartMs).toISOString();
    const bucketEnd = new Date(bucketStartMs + bucketMs).toISOString();
    let item = itemBuckets.get(itemKey);

    if (!item) {
      item = {
        profileKey: alert.profileKey,
        alertClass: alert.alertClass,
        totalCount: 0,
        buckets: new Map()
      };
      itemBuckets.set(itemKey, item);
    }

    item.totalCount += 1;

    let bucket = item.buckets.get(bucketStart);
    if (!bucket) {
      bucket = {
        bucketStart,
        bucketEnd,
        totalCount: 0,
        pendingAcknowledgementCount: 0,
        acknowledgedCount: 0,
        pendingDeliveryCount: 0,
        deliveredCount: 0,
        deliveryFailedCount: 0
      };
      item.buckets.set(bucketStart, bucket);
    }

    bucket.totalCount += 1;
    if (alert.status === "pending_acknowledgement") {
      bucket.pendingAcknowledgementCount += 1;
    } else {
      bucket.acknowledgedCount += 1;
    }

    if (alert.deliveryStatus === "pending_delivery") {
      bucket.pendingDeliveryCount += 1;
    } else if (alert.deliveryStatus === "delivered") {
      bucket.deliveredCount += 1;
    } else {
      bucket.deliveryFailedCount += 1;
    }
  }

  return {
    windowHours: input.windowHours,
    bucketHours: input.bucketHours,
    items: Array.from(itemBuckets.values())
      .map(item => ({
        profileKey: item.profileKey,
        alertClass: item.alertClass,
        totalCount: item.totalCount,
        buckets: Array.from(item.buckets.values()).sort((left, right) =>
          left.bucketStart.localeCompare(right.bucketStart)
        )
      }))
      .sort((left, right) =>
        right.totalCount - left.totalCount || left.profileKey.localeCompare(right.profileKey)
      ),
    filters: {
      profileKey: input.profileKey,
      alertClass: input.alertClass,
      deliveryChannel: input.deliveryChannel
    }
  };
};

const toWorkspaceEvidenceRetentionPolicyResponse = (
  tenant: Tenant,
  workspace: Workspace
): WorkspaceEvidenceRetentionPolicyResponse => {
  const flattenedOverride = flattenEvidenceRetentionPolicyOverrideRecords(
    workspace.evidenceRetentionPolicyOverrideRecords
  );

  return {
    tenantKey: tenant.tenantKey,
    workspaceKey: workspace.workspaceKey,
    mode: workspace.evidenceRetentionPolicyOverrideRecords ? "override" : "inherit",
    defaultEvidenceRetentionPolicy: toEvidenceRetentionPolicyDto(tenant.defaultEvidenceRetentionPolicy),
    evidenceRetentionPolicyOverride: flattenedOverride
      ? toEvidenceRetentionPolicyOverrideDto(flattenedOverride)
      : null,
    evidenceRetentionPolicyOverrideRecords: toEvidenceRetentionPolicyOverrideRecordsDto(
      workspace.evidenceRetentionPolicyOverrideRecords
    ),
    effectiveEvidenceRetentionPolicy: toEvidenceRetentionPolicyDto(
      resolveWorkspaceEvidenceRetentionPolicy(workspace, tenant)
    )
  };
};

const toWorkspaceEvidenceRetentionClassPolicyResponse = (
  tenant: Tenant,
  workspace: Workspace
): WorkspaceEvidenceRetentionClassPolicyResponse => ({
  tenantKey: tenant.tenantKey,
  workspaceKey: workspace.workspaceKey,
  mode: workspace.evidenceRetentionClassPolicyOverrideRecords ? "override" : "inherit",
  defaultEvidenceRetentionClassPolicy: toEvidenceRetentionClassPolicyDto(
    tenant.defaultEvidenceRetentionClassPolicy
  ),
  evidenceRetentionClassPolicyOverride: workspace.evidenceRetentionClassPolicyOverrideRecords
    ? toEvidenceRetentionClassPolicyOverrideDto(
        flattenEvidenceRetentionClassPolicyOverrideRecords(
          workspace.evidenceRetentionClassPolicyOverrideRecords
        ) ?? {}
      )
    : null,
  evidenceRetentionClassPolicyOverrideRecords: toEvidenceRetentionClassPolicyOverrideRecordsDto(
    workspace.evidenceRetentionClassPolicyOverrideRecords
  ),
  effectiveEvidenceRetentionClassPolicy: toEvidenceRetentionClassPolicyDto(
    resolveWorkspaceEvidenceRetentionClassPolicy(workspace, tenant)
  )
});

const toWorkspaceEvidenceRetentionClassesResponse = (
  tenant: Tenant,
  workspace: Workspace
): WorkspaceEvidenceRetentionClassesResponse => ({
  tenantKey: tenant.tenantKey,
  workspaceKey: workspace.workspaceKey,
  classes: buildSystemCheckEvidenceRetentionClassRules(
    resolveWorkspaceEvidenceRetentionPolicy(workspace, tenant),
    resolveWorkspaceEvidenceRetentionClassPolicy(workspace, tenant)
  ).map(toSystemCheckEvidenceRetentionClassRuleDto)
});

const handleWorkspaceActivationPolicyGet = async (
  store: PlatformStore,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string
): Promise<void> => {
  const [tenant, workspace] = await Promise.all([
    store.getTenantByKey(tenantKey),
    store.getWorkspaceByKey(tenantKey, workspaceKey)
  ]);

  if (!tenant || !workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  sendJson<WorkspaceActivationPolicyResponse>(
    response,
    200,
    toWorkspaceActivationPolicyResponse(tenant, workspace)
  );
};

const handleWorkspaceActivationPolicyPatch = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string,
  requestContext: RequestContext
): Promise<void> => {
  const [tenant, workspace] = await Promise.all([
    store.getTenantByKey(tenantKey),
    store.getWorkspaceByKey(tenantKey, workspaceKey)
  ]);

  if (!tenant || !workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const body = await readBody<UpdateWorkspaceActivationPolicyRequest>(request);

  if (!isWorkspaceActivationPolicyMode(body.mode)) {
    sendError(
      response,
      400,
      "invalid_workspace_activation_policy_payload",
      "mode must be either 'inherit' or 'override'."
    );
    return;
  }

  if (body.mode === "override" && !isContentReleaseActivationPolicyOverride(body.activationPolicyOverride)) {
    sendError(
      response,
      400,
      "invalid_workspace_activation_policy_payload",
      "activationPolicyOverride must provide at least one activation-policy boolean flag when mode is 'override'."
    );
    return;
  }

  const activationPolicyOverride =
    body.mode === "override"
      ? toContentReleaseActivationPolicyOverrideDto(
          body.activationPolicyOverride as ContentReleaseActivationPolicyOverrideDto
        )
      : null;
  const previousActivationPolicyOverride = flattenActivationPolicyOverrideRecords(
    workspace.activationPolicyOverrideRecords
  );
  const changedActivationPolicyFields = activationPolicyOverride ? Object.keys(activationPolicyOverride) : [];
  const clearedActivationPolicyFields = previousActivationPolicyOverride
    ? Object.keys(previousActivationPolicyOverride).filter(fieldKey =>
        !activationPolicyOverride || !(fieldKey in activationPolicyOverride)
      )
    : [];
  const activationPolicyOverrideRecords =
    activationPolicyOverride
      ? createActivationPolicyOverrideRecords({
          override: activationPolicyOverride,
          updatedByRequestId: requestContext.requestId,
          updatedByActorType: "platform_api",
          updatedByActorId: "platform-api"
        })
      : null;

  const updatedWorkspace: Workspace = {
    ...workspace,
    activationPolicyOverrideRecords
  };

  await store.saveWorkspace(updatedWorkspace);
  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: updatedWorkspace.tenantId,
    workspaceId: updatedWorkspace.workspaceId,
    actorType: "platform_api",
    actorId: "platform-api",
    eventType: "workspace.activation_policy.updated",
    payload: {
      workspaceKey: updatedWorkspace.workspaceKey,
      mode: body.mode,
      defaultActivationPolicy: tenant.defaultActivationPolicy,
      activationPolicyOverride,
      activationPolicyOverrideRecords: toActivationPolicyOverrideRecordsDto(updatedWorkspace.activationPolicyOverrideRecords),
      changedFields: changedActivationPolicyFields,
      clearedFields: clearedActivationPolicyFields,
      effectiveActivationPolicy: resolveWorkspaceActivationPolicy(updatedWorkspace, tenant)
    }
  });

  sendJson<WorkspaceActivationPolicyResponse>(
    response,
    200,
    toWorkspaceActivationPolicyResponse(tenant, updatedWorkspace)
  );
};

const handleWorkspaceOperationalPolicyGet = async (
  store: PlatformStore,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string
): Promise<void> => {
  const [tenant, workspace] = await Promise.all([
    store.getTenantByKey(tenantKey),
    store.getWorkspaceByKey(tenantKey, workspaceKey)
  ]);

  if (!tenant || !workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  sendJson<WorkspaceOperationalPolicyResponse>(
    response,
    200,
    toWorkspaceOperationalPolicyResponse(tenant, workspace)
  );
};

const handleWorkspaceOperationalPolicyPatch = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string,
  requestContext: RequestContext
): Promise<void> => {
  const [tenant, workspace] = await Promise.all([
    store.getTenantByKey(tenantKey),
    store.getWorkspaceByKey(tenantKey, workspaceKey)
  ]);

  if (!tenant || !workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const body = await readBody<UpdateWorkspaceOperationalPolicyRequest>(request);

  if (!isWorkspaceOperationalPolicyMode(body.mode)) {
    sendError(
      response,
      400,
      "invalid_workspace_operational_policy_payload",
      "mode must be either 'inherit' or 'override'."
    );
    return;
  }

  if (body.mode === "override" && !isOperationalPolicyOverride(body.operationalPolicyOverride)) {
    sendError(
      response,
      400,
      "invalid_workspace_operational_policy_payload",
      "operationalPolicyOverride must provide at least one operational-policy integer field when mode is 'override'."
    );
    return;
  }

  const operationalPolicyOverride =
    body.mode === "override"
      ? toOperationalPolicyOverrideDto(
          body.operationalPolicyOverride as OperationalPolicyOverrideDto
        )
      : null;
  const previousOperationalPolicyOverride = flattenOperationalPolicyOverrideRecords(
    workspace.operationalPolicyOverrideRecords
  );
  const changedOperationalPolicyFields = operationalPolicyOverride ? Object.keys(operationalPolicyOverride) : [];
  const clearedOperationalPolicyFields = previousOperationalPolicyOverride
    ? Object.keys(previousOperationalPolicyOverride).filter(fieldKey =>
        !operationalPolicyOverride || !(fieldKey in operationalPolicyOverride)
      )
    : [];
  const operationalPolicyOverrideRecords =
    operationalPolicyOverride
      ? createOperationalPolicyOverrideRecords({
          override: operationalPolicyOverride,
          updatedByRequestId: requestContext.requestId,
          updatedByActorType: "platform_api",
          updatedByActorId: "platform-api"
        })
      : null;

  const updatedWorkspace: Workspace = {
    ...workspace,
    operationalPolicyOverrideRecords
  };

  await store.saveWorkspace(updatedWorkspace);
  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: updatedWorkspace.tenantId,
    workspaceId: updatedWorkspace.workspaceId,
    actorType: "platform_api",
    actorId: "platform-api",
    eventType: "workspace.operational_policy.updated",
    payload: {
      workspaceKey: updatedWorkspace.workspaceKey,
      mode: body.mode,
      defaultOperationalPolicy: tenant.defaultOperationalPolicy,
      operationalPolicyOverride,
      operationalPolicyOverrideRecords: toOperationalPolicyOverrideRecordsDto(updatedWorkspace.operationalPolicyOverrideRecords),
      changedFields: changedOperationalPolicyFields,
      clearedFields: clearedOperationalPolicyFields,
      effectiveOperationalPolicy: resolveWorkspaceOperationalPolicy(updatedWorkspace, tenant)
    }
  });

  sendJson<WorkspaceOperationalPolicyResponse>(
    response,
    200,
    toWorkspaceOperationalPolicyResponse(tenant, updatedWorkspace)
  );
};

const handleWorkspaceLaunchApprovalPolicyGet = async (
  store: PlatformStore,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string
): Promise<void> => {
  const [tenant, workspace] = await Promise.all([
    store.getTenantByKey(tenantKey),
    store.getWorkspaceByKey(tenantKey, workspaceKey)
  ]);

  if (!tenant || !workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  sendJson<WorkspaceLaunchApprovalPolicyResponse>(
    response,
    200,
    toWorkspaceLaunchApprovalPolicyResponse(tenant, workspace)
  );
};

const handleWorkspaceLaunchApprovalPolicyPatch = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string,
  requestContext: RequestContext
): Promise<void> => {
  const [tenant, workspace] = await Promise.all([
    store.getTenantByKey(tenantKey),
    store.getWorkspaceByKey(tenantKey, workspaceKey)
  ]);

  if (!tenant || !workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const body = await readBody<UpdateWorkspaceLaunchApprovalPolicyRequest>(request);

  if (!isWorkspaceLaunchApprovalPolicyMode(body.mode)) {
    sendError(
      response,
      400,
      "invalid_workspace_launch_approval_policy_payload",
      "mode must be either 'inherit' or 'override'."
    );
    return;
  }

  if (body.mode === "override" && !isLaunchApprovalPolicyOverride(body.launchApprovalPolicyOverride)) {
    sendError(
      response,
      400,
      "invalid_workspace_launch_approval_policy_payload",
      "launchApprovalPolicyOverride must provide at least one launch-approval policy integer field when mode is 'override'."
    );
    return;
  }

  const launchApprovalPolicyOverride =
    body.mode === "override"
      ? toLaunchApprovalPolicyOverrideDto(
          body.launchApprovalPolicyOverride as LaunchApprovalPolicyOverrideDto
        )
      : null;
  const previousLaunchApprovalPolicyOverride = flattenLaunchApprovalPolicyOverrideRecords(
    workspace.launchApprovalPolicyOverrideRecords
  );
  const changedLaunchApprovalPolicyFields = launchApprovalPolicyOverride
    ? Object.keys(launchApprovalPolicyOverride)
    : [];
  const clearedLaunchApprovalPolicyFields = previousLaunchApprovalPolicyOverride
    ? Object.keys(previousLaunchApprovalPolicyOverride).filter(fieldKey =>
        !launchApprovalPolicyOverride || !(fieldKey in launchApprovalPolicyOverride)
      )
    : [];
  const launchApprovalPolicyOverrideRecords = launchApprovalPolicyOverride
    ? createLaunchApprovalPolicyOverrideRecords({
        override: launchApprovalPolicyOverride,
        updatedByRequestId: requestContext.requestId,
        updatedByActorType: "platform_api",
        updatedByActorId: "platform-api"
      })
    : null;

  const updatedWorkspace: Workspace = {
    ...workspace,
    launchApprovalPolicyOverrideRecords
  };

  await store.saveWorkspace(updatedWorkspace);
  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: updatedWorkspace.tenantId,
    workspaceId: updatedWorkspace.workspaceId,
    actorType: "platform_api",
    actorId: "platform-api",
    eventType: "workspace.launch_approval_policy.updated",
    payload: {
      workspaceKey: updatedWorkspace.workspaceKey,
      mode: body.mode,
      defaultLaunchApprovalPolicy: tenant.defaultLaunchApprovalPolicy,
      launchApprovalPolicyOverride,
      launchApprovalPolicyOverrideRecords: toLaunchApprovalPolicyOverrideRecordsDto(
        updatedWorkspace.launchApprovalPolicyOverrideRecords
      ),
      changedFields: changedLaunchApprovalPolicyFields,
      clearedFields: clearedLaunchApprovalPolicyFields,
      effectiveLaunchApprovalPolicy: resolveWorkspaceLaunchApprovalPolicy(updatedWorkspace, tenant)
    }
  });

  sendJson<WorkspaceLaunchApprovalPolicyResponse>(
    response,
    200,
    toWorkspaceLaunchApprovalPolicyResponse(tenant, updatedWorkspace)
  );
};

const handleWorkspaceNotificationProviderPromotionPolicyGet = async (
  store: PlatformStore,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string
): Promise<void> => {
  const [tenant, workspace] = await Promise.all([
    store.getTenantByKey(tenantKey),
    store.getWorkspaceByKey(tenantKey, workspaceKey)
  ]);

  if (!tenant || !workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  sendJson<WorkspaceNotificationProviderPromotionPolicyResponse>(
    response,
    200,
    toWorkspaceNotificationProviderPromotionPolicyResponse(tenant, workspace)
  );
};

const handleWorkspaceNotificationProviderPromotionPolicyPatch = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string,
  requestContext: RequestContext
): Promise<void> => {
  const [tenant, workspace] = await Promise.all([
    store.getTenantByKey(tenantKey),
    store.getWorkspaceByKey(tenantKey, workspaceKey)
  ]);

  if (!tenant || !workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const body = await readBody<UpdateWorkspaceNotificationProviderPromotionPolicyRequest>(request);

  if (!isWorkspaceNotificationProviderPromotionPolicyMode(body.mode)) {
    sendError(
      response,
      400,
      "invalid_workspace_notification_provider_promotion_policy_payload",
      "mode must be either 'inherit' or 'override'."
    );
    return;
  }

  if (
    body.mode === "override" &&
    !isNotificationProviderPromotionPolicyOverride(
      body.notificationProviderPromotionPolicyOverride
    )
  ) {
    sendError(
      response,
      400,
      "invalid_workspace_notification_provider_promotion_policy_payload",
      "notificationProviderPromotionPolicyOverride must provide at least one valid promotion-policy field when mode is 'override'."
    );
    return;
  }

  const notificationProviderPromotionPolicyOverride =
    body.mode === "override"
      ? toNotificationProviderPromotionPolicyOverrideDto(
          body.notificationProviderPromotionPolicyOverride as NotificationProviderPromotionPolicyOverrideDto
        )
      : null;
  const previousNotificationProviderPromotionPolicyOverride =
    flattenNotificationProviderPromotionPolicyOverrideRecords(
      workspace.notificationProviderPromotionPolicyOverrideRecords
    );
  const changedFields = notificationProviderPromotionPolicyOverride
    ? Object.keys(notificationProviderPromotionPolicyOverride)
    : [];
  const clearedFields = previousNotificationProviderPromotionPolicyOverride
    ? Object.keys(previousNotificationProviderPromotionPolicyOverride).filter(
        fieldKey =>
          !notificationProviderPromotionPolicyOverride ||
          !(fieldKey in notificationProviderPromotionPolicyOverride)
      )
    : [];
  const notificationProviderPromotionPolicyOverrideRecords =
    notificationProviderPromotionPolicyOverride
      ? createNotificationProviderPromotionPolicyOverrideRecords({
          override: notificationProviderPromotionPolicyOverride,
          updatedByRequestId: requestContext.requestId,
          updatedByActorType: "platform_api",
          updatedByActorId: "platform-api"
        })
      : null;

  const updatedWorkspace: Workspace = {
    ...workspace,
    notificationProviderPromotionPolicyOverrideRecords
  };

  await store.saveWorkspace(updatedWorkspace);
  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: updatedWorkspace.tenantId,
    workspaceId: updatedWorkspace.workspaceId,
    actorType: "platform_api",
    actorId: "platform-api",
    eventType: "workspace.notification_provider_promotion_policy.updated",
    payload: {
      workspaceKey: updatedWorkspace.workspaceKey,
      mode: body.mode,
      defaultNotificationProviderPromotionPolicy:
        tenant.defaultNotificationProviderPromotionPolicy,
      notificationProviderPromotionPolicyOverride,
      notificationProviderPromotionPolicyOverrideRecords:
        toNotificationProviderPromotionPolicyOverrideRecordsDto(
          updatedWorkspace.notificationProviderPromotionPolicyOverrideRecords
        ),
      changedFields,
      clearedFields,
      effectiveNotificationProviderPromotionPolicy:
        resolveWorkspaceNotificationProviderPromotionPolicy(updatedWorkspace, tenant)
    }
  });

  sendJson<WorkspaceNotificationProviderPromotionPolicyResponse>(
    response,
    200,
    toWorkspaceNotificationProviderPromotionPolicyResponse(tenant, updatedWorkspace)
  );
};

const handleWorkspaceNotificationPolicyGet = async (
  store: PlatformStore,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string
): Promise<void> => {
  const [tenant, workspace] = await Promise.all([
    store.getTenantByKey(tenantKey),
    store.getWorkspaceByKey(tenantKey, workspaceKey)
  ]);

  if (!tenant || !workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  sendJson<WorkspaceNotificationPolicyResponse>(
    response,
    200,
    toWorkspaceNotificationPolicyResponse(tenant, workspace)
  );
};

const handleWorkspaceNotificationPolicyPatch = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string,
  requestContext: RequestContext
): Promise<void> => {
  const [tenant, workspace] = await Promise.all([
    store.getTenantByKey(tenantKey),
    store.getWorkspaceByKey(tenantKey, workspaceKey)
  ]);

  if (!tenant || !workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const body = await readBody<UpdateWorkspaceNotificationPolicyRequest>(request);

  if (!isWorkspaceNotificationPolicyMode(body.mode)) {
    sendError(
      response,
      400,
      "invalid_workspace_notification_policy_payload",
      "mode must be either 'inherit' or 'override'."
    );
    return;
  }

  if (body.mode === "override" && !isNotificationPolicyOverride(body.notificationPolicyOverride)) {
    sendError(
      response,
      400,
      "invalid_workspace_notification_policy_payload",
      "notificationPolicyOverride must provide at least one valid notification-policy field when mode is 'override'."
    );
    return;
  }

  const notificationPolicyOverride =
    body.mode === "override"
      ? toNotificationPolicyOverrideDto(
          body.notificationPolicyOverride as NotificationPolicyOverrideDto
        )
      : null;
  const previousNotificationPolicyOverride = flattenNotificationPolicyOverrideRecords(
    workspace.notificationPolicyOverrideRecords
  );
  const changedNotificationPolicyFields = notificationPolicyOverride
    ? Object.keys(notificationPolicyOverride)
    : [];
  const clearedNotificationPolicyFields = previousNotificationPolicyOverride
    ? Object.keys(previousNotificationPolicyOverride).filter(
        fieldKey => !notificationPolicyOverride || !(fieldKey in notificationPolicyOverride)
      )
    : [];
  const notificationPolicyOverrideRecords = notificationPolicyOverride
    ? createNotificationPolicyOverrideRecords({
        override: notificationPolicyOverride,
        updatedByRequestId: requestContext.requestId,
        updatedByActorType: "platform_api",
        updatedByActorId: "platform-api"
      })
    : null;

  const updatedWorkspace: Workspace = {
    ...workspace,
    notificationPolicyOverrideRecords
  };

  await store.saveWorkspace(updatedWorkspace);
  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: updatedWorkspace.tenantId,
    workspaceId: updatedWorkspace.workspaceId,
    actorType: "platform_api",
    actorId: "platform-api",
    eventType: "workspace.notification_policy.updated",
    payload: {
      workspaceKey: updatedWorkspace.workspaceKey,
      mode: body.mode,
      defaultNotificationPolicy: tenant.defaultNotificationPolicy,
      notificationPolicyOverride,
      notificationPolicyOverrideRecords: toNotificationPolicyOverrideRecordsDto(
        updatedWorkspace.notificationPolicyOverrideRecords
      ),
      changedFields: changedNotificationPolicyFields,
      clearedFields: clearedNotificationPolicyFields,
      effectiveNotificationPolicy: resolveWorkspaceNotificationPolicy(updatedWorkspace, tenant)
    }
  });

  sendJson<WorkspaceNotificationPolicyResponse>(
    response,
    200,
    toWorkspaceNotificationPolicyResponse(tenant, updatedWorkspace)
  );
};

const handleWorkspaceGovernanceNotificationPolicyGet = async (
  store: PlatformStore,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string
): Promise<void> => {
  const [tenant, workspace] = await Promise.all([
    store.getTenantByKey(tenantKey),
    store.getWorkspaceByKey(tenantKey, workspaceKey)
  ]);

  if (!tenant || !workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  sendJson<WorkspaceGovernanceNotificationPolicyResponse>(
    response,
    200,
    toWorkspaceGovernanceNotificationPolicyResponse(tenant, workspace)
  );
};

const handleWorkspaceGovernanceNotificationPolicyPatch = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string,
  requestContext: RequestContext
): Promise<void> => {
  const [tenant, workspace] = await Promise.all([
    store.getTenantByKey(tenantKey),
    store.getWorkspaceByKey(tenantKey, workspaceKey)
  ]);

  if (!tenant || !workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const body = await readBody<UpdateWorkspaceGovernanceNotificationPolicyRequest>(request);

  if (!isWorkspaceGovernanceNotificationPolicyMode(body.mode)) {
    sendError(
      response,
      400,
      "invalid_workspace_governance_notification_policy_payload",
      "mode must be either 'inherit' or 'override'."
    );
    return;
  }

  if (
    body.mode === "override" &&
    !isNotificationPolicyOverride(body.governanceNotificationPolicyOverride)
  ) {
    sendError(
      response,
      400,
      "invalid_workspace_governance_notification_policy_payload",
      "governanceNotificationPolicyOverride must provide at least one valid notification-policy field when mode is 'override'."
    );
    return;
  }

  const governanceNotificationPolicyOverride =
    body.mode === "override"
      ? toNotificationPolicyOverrideDto(
          body.governanceNotificationPolicyOverride as NotificationPolicyOverrideDto
        )
      : null;
  const previousGovernanceNotificationPolicyOverride = flattenNotificationPolicyOverrideRecords(
    workspace.governanceNotificationPolicyOverrideRecords
  );
  const changedGovernanceNotificationPolicyFields = governanceNotificationPolicyOverride
    ? Object.keys(governanceNotificationPolicyOverride)
    : [];
  const clearedGovernanceNotificationPolicyFields =
    previousGovernanceNotificationPolicyOverride
      ? Object.keys(previousGovernanceNotificationPolicyOverride).filter(
          fieldKey =>
            !governanceNotificationPolicyOverride ||
            !(fieldKey in governanceNotificationPolicyOverride)
        )
      : [];
  const governanceNotificationPolicyOverrideRecords = governanceNotificationPolicyOverride
    ? createNotificationPolicyOverrideRecords({
        override: governanceNotificationPolicyOverride,
        updatedByRequestId: requestContext.requestId,
        updatedByActorType: "platform_api",
        updatedByActorId: "platform-api"
      })
    : null;

  const updatedWorkspace: Workspace = {
    ...workspace,
    governanceNotificationPolicyOverrideRecords
  };

  await store.saveWorkspace(updatedWorkspace);
  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: updatedWorkspace.tenantId,
    workspaceId: updatedWorkspace.workspaceId,
    actorType: "platform_api",
    actorId: "platform-api",
    eventType: "workspace.governance_notification_policy.updated",
    payload: {
      workspaceKey: updatedWorkspace.workspaceKey,
      mode: body.mode,
      defaultGovernanceNotificationPolicy: tenant.defaultGovernanceNotificationPolicy,
      governanceNotificationPolicyOverride,
      governanceNotificationPolicyOverrideRecords: toNotificationPolicyOverrideRecordsDto(
        updatedWorkspace.governanceNotificationPolicyOverrideRecords
      ),
      changedFields: changedGovernanceNotificationPolicyFields,
      clearedFields: clearedGovernanceNotificationPolicyFields,
      effectiveGovernanceNotificationPolicy: resolveWorkspaceGovernanceNotificationPolicy(
        updatedWorkspace,
        tenant
      )
    }
  });

  sendJson<WorkspaceGovernanceNotificationPolicyResponse>(
    response,
    200,
    toWorkspaceGovernanceNotificationPolicyResponse(tenant, updatedWorkspace)
  );
};

const handleWorkspaceRecoveryGovernanceNotificationPolicyGet = async (
  store: PlatformStore,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string
): Promise<void> => {
  const [tenant, workspace] = await Promise.all([
    store.getTenantByKey(tenantKey),
    store.getWorkspaceByKey(tenantKey, workspaceKey)
  ]);

  if (!tenant || !workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  sendJson<WorkspaceRecoveryGovernanceNotificationPolicyResponse>(
    response,
    200,
    toWorkspaceRecoveryGovernanceNotificationPolicyResponse(tenant, workspace)
  );
};

const handleWorkspaceRecoveryGovernanceNotificationPolicyPatch = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string,
  requestContext: RequestContext
): Promise<void> => {
  const [tenant, workspace] = await Promise.all([
    store.getTenantByKey(tenantKey),
    store.getWorkspaceByKey(tenantKey, workspaceKey)
  ]);

  if (!tenant || !workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const body = await readBody<UpdateWorkspaceRecoveryGovernanceNotificationPolicyRequest>(request);

  if (!isWorkspaceRecoveryGovernanceNotificationPolicyMode(body.mode)) {
    sendError(
      response,
      400,
      "invalid_workspace_recovery_governance_notification_policy_payload",
      "mode must be either 'inherit' or 'override'."
    );
    return;
  }

  if (
    body.mode === "override" &&
    !isNotificationPolicyOverride(body.recoveryGovernanceNotificationPolicyOverride)
  ) {
    sendError(
      response,
      400,
      "invalid_workspace_recovery_governance_notification_policy_payload",
      "recoveryGovernanceNotificationPolicyOverride must provide at least one valid notification-policy field when mode is 'override'."
    );
    return;
  }

  const recoveryGovernanceNotificationPolicyOverride =
    body.mode === "override"
      ? toNotificationPolicyOverrideDto(
          body.recoveryGovernanceNotificationPolicyOverride as NotificationPolicyOverrideDto
        )
      : null;
  const previousRecoveryGovernanceNotificationPolicyOverride =
    flattenNotificationPolicyOverrideRecords(
      workspace.recoveryGovernanceNotificationPolicyOverrideRecords
    );
  const changedRecoveryGovernanceNotificationPolicyFields =
    recoveryGovernanceNotificationPolicyOverride
      ? Object.keys(recoveryGovernanceNotificationPolicyOverride)
      : [];
  const clearedRecoveryGovernanceNotificationPolicyFields =
    previousRecoveryGovernanceNotificationPolicyOverride
      ? Object.keys(previousRecoveryGovernanceNotificationPolicyOverride).filter(
          fieldKey =>
            !recoveryGovernanceNotificationPolicyOverride ||
            !(fieldKey in recoveryGovernanceNotificationPolicyOverride)
        )
      : [];
  const recoveryGovernanceNotificationPolicyOverrideRecords =
    recoveryGovernanceNotificationPolicyOverride
      ? createNotificationPolicyOverrideRecords({
          override: recoveryGovernanceNotificationPolicyOverride,
          updatedByRequestId: requestContext.requestId,
          updatedByActorType: "platform_api",
          updatedByActorId: "platform-api"
        })
      : null;

  const updatedWorkspace: Workspace = {
    ...workspace,
    recoveryGovernanceNotificationPolicyOverrideRecords
  };

  await store.saveWorkspace(updatedWorkspace);
  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: updatedWorkspace.tenantId,
    workspaceId: updatedWorkspace.workspaceId,
    actorType: "platform_api",
    actorId: "platform-api",
    eventType: "workspace.recovery_governance_notification_policy.updated",
    payload: {
      workspaceKey: updatedWorkspace.workspaceKey,
      mode: body.mode,
      defaultRecoveryGovernanceNotificationPolicy:
        tenant.defaultRecoveryGovernanceNotificationPolicy,
      recoveryGovernanceNotificationPolicyOverride,
      recoveryGovernanceNotificationPolicyOverrideRecords:
        toNotificationPolicyOverrideRecordsDto(
          updatedWorkspace.recoveryGovernanceNotificationPolicyOverrideRecords
        ),
      changedFields: changedRecoveryGovernanceNotificationPolicyFields,
      clearedFields: clearedRecoveryGovernanceNotificationPolicyFields,
      effectiveRecoveryGovernanceNotificationPolicy:
        resolveWorkspaceRecoveryGovernanceNotificationPolicy(updatedWorkspace, tenant)
    }
  });

  sendJson<WorkspaceRecoveryGovernanceNotificationPolicyResponse>(
    response,
    200,
    toWorkspaceRecoveryGovernanceNotificationPolicyResponse(tenant, updatedWorkspace)
  );
};

const handleWorkspaceNotificationProviderProfilesGet = async (
  store: PlatformStore,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string
): Promise<void> => {
  const [tenant, workspace] = await Promise.all([
    store.getTenantByKey(tenantKey),
    store.getWorkspaceByKey(tenantKey, workspaceKey)
  ]);

  if (!tenant || !workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  sendJson<WorkspaceNotificationProviderProfilesResponse>(
    response,
    200,
    toWorkspaceNotificationProviderProfilesResponse(tenant, workspace)
  );
};

const handleWorkspaceNotificationProviderProfileRolloutMetricsGet = async (
  store: PlatformStore,
  response: ServerResponse,
  url: URL,
  tenantKey: string,
  workspaceKey: string
): Promise<void> => {
  const [tenant, workspace] = await Promise.all([
    store.getTenantByKey(tenantKey),
    store.getWorkspaceByKey(tenantKey, workspaceKey)
  ]);

  if (!tenant || !workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const requestedWindowHours = url.searchParams.get("windowHours");
  const effectivePromotionPolicy = resolveWorkspaceNotificationProviderPromotionPolicy(
    workspace,
    tenant
  );
  const evaluationWindowHours =
    requestedWindowHours && isPositiveInteger(Number(requestedWindowHours))
      ? Number(requestedWindowHours)
      : effectivePromotionPolicy.evaluationWindowHours;

  const notifications = await store.listSystemCheckEvidenceBreachNotificationsByWorkspace(
    tenantKey,
    workspaceKey,
    {
      limit: 500
    }
  );

  sendJson<WorkspaceNotificationProviderProfileRolloutMetricsResponse>(
    response,
    200,
    toWorkspaceNotificationProviderProfileRolloutMetricsResponse({
      tenant,
      workspace,
      notifications,
      evaluationWindowHours
    })
  );
};

const handleWorkspaceNotificationProviderProfilesPatch = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string,
  requestContext: RequestContext
): Promise<void> => {
  const [tenant, workspace] = await Promise.all([
    store.getTenantByKey(tenantKey),
    store.getWorkspaceByKey(tenantKey, workspaceKey)
  ]);

  if (!tenant || !workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const body = await readBody<UpdateWorkspaceNotificationProviderProfilesRequest>(request);

  if (!isWorkspaceNotificationProviderProfilesMode(body.mode)) {
    sendError(
      response,
      400,
      "invalid_workspace_notification_provider_profiles_payload",
      "mode must be either 'inherit' or 'override'."
    );
    return;
  }

  if (
    body.mode === "override" &&
    !(
      isNotificationProviderProfileInputs(body.notificationProviderProfileOverride) ||
      parseUniqueTrimmedStringArray(body.removedNotificationProviderProfileKeys)
    )
  ) {
    sendError(
      response,
      400,
      "invalid_workspace_notification_provider_profiles_payload",
      "mode 'override' must provide a non-empty set of unique provider profiles, explicit removedNotificationProviderProfileKeys, or both."
    );
    return;
  }

  const notificationProviderProfileOverride =
    body.mode === "override"
      ? isNotificationProviderProfileInputs(body.notificationProviderProfileOverride)
        ? (body.notificationProviderProfileOverride as NotificationProviderProfileInputDto[]).map(
            profile =>
              toNotificationProviderProfile(
                profile,
                workspace.notificationProviderProfileOverrideRecords?.[profile.profileKey]?.value ?? undefined
              )
          )
        : null
      : null;
  const removedNotificationProviderProfileKeys =
    body.mode === "override"
      ? parseUniqueTrimmedStringArray(body.removedNotificationProviderProfileKeys) ?? null
      : null;

  if (
    notificationProviderProfileOverride &&
    removedNotificationProviderProfileKeys &&
    notificationProviderProfileOverride.some(profile =>
      removedNotificationProviderProfileKeys.includes(profile.profileKey)
    )
  ) {
    sendError(
      response,
      400,
      "invalid_workspace_notification_provider_profiles_payload",
      "removedNotificationProviderProfileKeys must not overlap notificationProviderProfileOverride profile keys."
    );
    return;
  }

  const workspaceFallbackCandidateKeys = new Set<string>([
    ...tenant.defaultNotificationProviderProfiles.map(profile => profile.profileKey),
    ...(notificationProviderProfileOverride?.map(profile => profile.profileKey) ?? [])
  ]);

  for (const removedProfileKey of removedNotificationProviderProfileKeys ?? []) {
    workspaceFallbackCandidateKeys.delete(removedProfileKey);
  }

  const workspaceFallbackValidationError = validateNotificationProviderProfileFallbacks({
    profiles: notificationProviderProfileOverride ?? [],
    availableProfileKeys: workspaceFallbackCandidateKeys
  });

  if (workspaceFallbackValidationError) {
    sendError(
      response,
      400,
      "invalid_workspace_notification_provider_profiles_payload",
      workspaceFallbackValidationError
    );
    return;
  }

  const previousNotificationProviderProfileOverride =
    flattenNotificationProviderProfileOverrideRecords(
      workspace.notificationProviderProfileOverrideRecords
    );
  const previousRemovedNotificationProviderProfileKeys = flattenRemovedNotificationProviderProfileKeys(
    workspace.notificationProviderProfileOverrideRecords
  );
  const changedProfileKeys = notificationProviderProfileOverride
    ? notificationProviderProfileOverride.map(profile => profile.profileKey)
    : [];
  const nextWorkspaceProfileKeys = new Set([
    ...(notificationProviderProfileOverride?.map(profile => profile.profileKey) ?? []),
    ...(removedNotificationProviderProfileKeys ?? [])
  ]);
  const previousWorkspaceProfileKeys = new Set([
    ...(previousNotificationProviderProfileOverride?.map(profile => profile.profileKey) ?? []),
    ...(previousRemovedNotificationProviderProfileKeys ?? [])
  ]);
  const clearedProfileKeys = previousWorkspaceProfileKeys.size > 0
    ? [...previousWorkspaceProfileKeys]
        .filter(profileKey => !nextWorkspaceProfileKeys.has(profileKey))
        .sort((left, right) => left.localeCompare(right))
    : [];
  const notificationProviderProfileOverrideRecords =
    notificationProviderProfileOverride || removedNotificationProviderProfileKeys
    ? createNotificationProviderProfileOverrideRecords({
        override: notificationProviderProfileOverride ?? [],
        removedProfileKeys: removedNotificationProviderProfileKeys ?? [],
        updatedByRequestId: requestContext.requestId,
        updatedByActorType: "platform_api",
        updatedByActorId: "platform-api"
      })
    : null;

  const updatedWorkspace: Workspace = {
    ...workspace,
    notificationProviderProfileOverrideRecords
  };

  await store.saveWorkspace(updatedWorkspace);
  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: updatedWorkspace.tenantId,
    workspaceId: updatedWorkspace.workspaceId,
    actorType: "platform_api",
    actorId: "platform-api",
    eventType: "workspace.notification_provider_profiles.updated",
    payload: {
      workspaceKey: updatedWorkspace.workspaceKey,
      mode: body.mode,
      defaultNotificationProviderProfiles: tenant.defaultNotificationProviderProfiles.map(
        toNotificationProviderProfileDto
      ),
      notificationProviderProfileOverride: notificationProviderProfileOverride?.map(
        toNotificationProviderProfileDto
      ) ?? null,
      removedNotificationProviderProfileKeys,
      notificationProviderProfileOverrideRecords: toNotificationProviderProfileOverrideRecordDtos(
        updatedWorkspace.notificationProviderProfileOverrideRecords
      ),
      changedProfileKeys,
      clearedProfileKeys,
      effectiveNotificationProviderProfiles: resolveWorkspaceNotificationProviderProfiles(
        updatedWorkspace,
        tenant
      ).map(toNotificationProviderProfileDto)
    }
  });

  sendJson<WorkspaceNotificationProviderProfilesResponse>(
    response,
    200,
    toWorkspaceNotificationProviderProfilesResponse(tenant, updatedWorkspace)
  );
};

const handleWorkspaceNotificationProviderProfilePromote = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string,
  profileKey: string,
  requestContext: RequestContext
): Promise<void> => {
  const [tenant, workspace] = await Promise.all([
    store.getTenantByKey(tenantKey),
    store.getWorkspaceByKey(tenantKey, workspaceKey)
  ]);

  if (!tenant || !workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const body = await readBody<PromoteWorkspaceNotificationProviderProfileRequest>(request);

  if (!isPromoteWorkspaceNotificationProviderProfileRequest(body)) {
    sendError(
      response,
      400,
      "invalid_workspace_notification_provider_profile_promotion_payload",
      "promotedByActorId is required; promotionNote must be a string when provided; clearRolloutFallbackProfile and forcePromotion must be booleans when provided; evaluationWindowHours must be a positive integer when provided."
    );
    return;
  }

  const effectiveProfiles = resolveWorkspaceNotificationProviderProfiles(workspace, tenant);
  const currentProfile = effectiveProfiles.find(profile => profile.profileKey === profileKey);

  if (!currentProfile) {
    sendError(
      response,
      404,
      "notification_provider_profile_not_found",
      `Notification provider profile '${profileKey}' was not found in workspace '${workspaceKey}'.`
    );
    return;
  }

  const effectivePromotionPolicy = resolveWorkspaceNotificationProviderPromotionPolicy(
    workspace,
    tenant
  );
  const evaluationWindowHours =
    body.evaluationWindowHours ?? effectivePromotionPolicy.evaluationWindowHours;
  const notifications = await store.listSystemCheckEvidenceBreachNotificationsByWorkspace(
    tenantKey,
    workspaceKey,
    {
      limit: 500
    }
  );
  const rolloutMetricsResponse = toWorkspaceNotificationProviderProfileRolloutMetricsResponse({
    tenant,
    workspace,
    notifications,
    evaluationWindowHours
  });
  const currentProfileRolloutMetrics = rolloutMetricsResponse.items.find(
    item => item.profileKey === profileKey
  );

  if (
    currentProfileRolloutMetrics &&
    currentProfileRolloutMetrics.promotionReadiness.status !== "ready" &&
    !body.forcePromotion
  ) {
    sendError(
      response,
      409,
      "notification_provider_profile_promotion_blocked",
      `Notification provider profile '${profileKey}' is not ready for promotion: ${currentProfileRolloutMetrics.promotionReadiness.reasons.join(", ")}.`
    );
    return;
  }

  const updatedAt = new Date().toISOString();
  const promotedProfile: NotificationProviderProfile = {
    ...currentProfile,
    rolloutState: "active",
    rolloutPercentage: 100,
    rolloutFallbackProfileKey:
      body.clearRolloutFallbackProfile === false
        ? currentProfile.rolloutFallbackProfileKey
        : null,
    incidentState: currentProfile.incidentState
      ? {
          ...currentProfile.incidentState,
          suppressionUntil: null,
          resolvedAt: updatedAt,
          resolutionCode: "manually_promoted"
        }
      : null,
    operationalState: null
  };
  const updatedNotificationProviderProfileOverrideRecords = {
    ...(workspace.notificationProviderProfileOverrideRecords ?? {}),
    [profileKey]: {
      value: promotedProfile,
      updatedAt,
      updatedByRequestId: requestContext.requestId,
      updatedByActorType: "platform_api" as const,
      updatedByActorId: body.promotedByActorId
    }
  };
  const updatedWorkspace: Workspace = {
    ...workspace,
    notificationProviderProfileOverrideRecords: updatedNotificationProviderProfileOverrideRecords
  };

  await store.saveWorkspace(updatedWorkspace);
  const unresolvedIncident = await store.getLatestUnresolvedNotificationProviderProfileIncident(
    updatedWorkspace.workspaceId,
    profileKey
  );
  let recoveryGovernanceAlert: NotificationProviderProfileGovernanceAlert | null = null;

  if (unresolvedIncident) {
    const priorGovernanceAlerts =
      await store.listNotificationProviderProfileGovernanceAlertsByWorkspace(
        tenantKey,
        workspaceKey,
        {
          profileKey,
          limit: 50
        }
      );
    const priorIncidentAlert = priorGovernanceAlerts.find(
      alert =>
        alert.incidentId === unresolvedIncident.incidentId &&
        alert.alertClass === "incident_open"
    );
    const recoveryRoutingTarget = priorIncidentAlert?.deliveryProfileKey
      ? `profile:${priorIncidentAlert.deliveryProfileKey}`
      : (priorIncidentAlert?.deliveryTarget ?? null);
    const resolvedIncident: NotificationProviderProfileIncident = {
      ...unresolvedIncident,
      status: "resolved",
      suppressionUntil: null,
      resolvedAt: updatedAt,
      resolutionCode: "manually_promoted",
      sourceRequestId: requestContext.requestId
    };
    await store.updateNotificationProviderProfileIncident(resolvedIncident);
    recoveryGovernanceAlert = createNotificationProviderProfileGovernanceRecoveryAlert({
      incident: resolvedIncident,
      profile: promotedProfile,
      notificationPolicy: resolveWorkspaceRecoveryGovernanceNotificationPolicy(
        updatedWorkspace,
        tenant
      ),
      notificationProviderProfiles: resolveWorkspaceNotificationProviderProfiles(
        updatedWorkspace,
        tenant
      ),
      routingTarget: recoveryRoutingTarget,
      createdAt: updatedAt,
      createdByActorType: "platform_api",
      createdByActorId: body.promotedByActorId,
      sourceRequestId: requestContext.requestId
    });
    await store.saveNotificationProviderProfileGovernanceAlert(recoveryGovernanceAlert);
  }

  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: updatedWorkspace.tenantId,
    workspaceId: updatedWorkspace.workspaceId,
    actorType: "platform_api",
    actorId: body.promotedByActorId,
    eventType: "workspace.notification_provider_profile.promoted",
    payload: {
      workspaceKey: updatedWorkspace.workspaceKey,
      profileKey,
      promotionNote: body.promotionNote ?? null,
      forcePromotion: body.forcePromotion ?? false,
      evaluationWindowHours,
      promotionReadiness: currentProfileRolloutMetrics?.promotionReadiness ?? null,
      recoveryGovernanceAlertId: recoveryGovernanceAlert?.alertId ?? null,
      previousProfile: toNotificationProviderProfileDto(currentProfile),
      promotedProfile: toNotificationProviderProfileDto(promotedProfile),
      effectiveNotificationProviderProfiles: resolveWorkspaceNotificationProviderProfiles(
        updatedWorkspace,
        tenant
      ).map(toNotificationProviderProfileDto)
    }
  });

  sendJson<PromoteWorkspaceNotificationProviderProfileResponse>(response, 200, {
    profileKey,
    workspace: toWorkspaceNotificationProviderProfilesResponse(tenant, updatedWorkspace)
  });
};

const handleWorkspaceNotificationProviderProfileIncidentsGet = async (
  store: PlatformStore,
  response: ServerResponse,
  url: URL,
  tenantKey: string,
  workspaceKey: string
): Promise<void> => {
  const workspace = await store.getWorkspaceByKey(tenantKey, workspaceKey);

  if (!workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const profileKey = getTrimmedString(url.searchParams.get("profileKey")) ?? null;
  const rawIncidentType = getTrimmedString(url.searchParams.get("incidentType"));
  const incidentType = rawIncidentType ?? null;
  const rawStatus = getTrimmedString(url.searchParams.get("status"));
  const status = rawStatus ?? null;
  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit ? Number.parseInt(rawLimit, 10) : 50;

  if (incidentType !== null && incidentType !== "auto_rollback_failure") {
    sendError(
      response,
      400,
      "invalid_notification_provider_profile_incident_type_filter",
      "incidentType must be auto_rollback_failure."
    );
    return;
  }

  if (status !== null && !isNotificationProviderProfileIncidentStatus(status)) {
    sendError(
      response,
      400,
      "invalid_notification_provider_profile_incident_status_filter",
      "status must be one of open, acknowledged, or resolved."
    );
    return;
  }

  if (!Number.isInteger(limit) || limit <= 0 || limit > 200) {
    sendError(
      response,
      400,
      "invalid_notification_provider_profile_incident_limit",
      "limit must be an integer between 1 and 200."
    );
    return;
  }

  const incidents = await store.listNotificationProviderProfileIncidentsByWorkspace(
    tenantKey,
    workspaceKey,
    {
      profileKey: profileKey ?? undefined,
      incidentType: incidentType ?? undefined,
      status: status ?? undefined,
      limit
    }
  );

  sendJson<WorkspaceNotificationProviderProfileIncidentsResponse>(response, 200, {
    items: incidents.map(toNotificationProviderProfileIncidentDto),
    filters: {
      profileKey,
      incidentType,
      status
    }
  });
};

const handleWorkspaceNotificationProviderProfileGovernanceQueueGet = async (
  store: PlatformStore,
  response: ServerResponse,
  url: URL,
  tenantKey: string,
  workspaceKey: string
): Promise<void> => {
  const [tenant, workspace] = await Promise.all([
    store.getTenantByKey(tenantKey),
    store.getWorkspaceByKey(tenantKey, workspaceKey)
  ]);

  if (!tenant || !workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const profileKey = getTrimmedString(url.searchParams.get("profileKey")) ?? null;
  const rawStatus = getTrimmedString(url.searchParams.get("status"));
  const status = rawStatus ?? null;
  const rawGovernanceStatus = getTrimmedString(url.searchParams.get("governanceStatus"));
  const governanceStatus = rawGovernanceStatus ?? null;
  const requestedWindowHours = url.searchParams.get("windowHours");
  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit ? Number.parseInt(rawLimit, 10) : 50;

  if (status !== null && !isNotificationProviderProfileIncidentStatus(status)) {
    sendError(
      response,
      400,
      "invalid_notification_provider_profile_governance_status_filter",
      "status must be one of open or acknowledged for the governance queue."
    );
    return;
  }

  if (status === "resolved") {
    sendError(
      response,
      400,
      "invalid_notification_provider_profile_governance_status_filter",
      "status must be open or acknowledged for the governance queue."
    );
    return;
  }

  if (
    governanceStatus !== null &&
    !isNotificationProviderProfileGovernanceStatus(governanceStatus)
  ) {
    sendError(
      response,
      400,
      "invalid_notification_provider_profile_governance_queue_filter",
      "governanceStatus must be one of needs_acknowledgement, suppressed, ready_for_manual_recovery, recovery_blocked, or resolved_recovery."
    );
    return;
  }

  if (!Number.isInteger(limit) || limit <= 0 || limit > 200) {
    sendError(
      response,
      400,
      "invalid_notification_provider_profile_governance_queue_limit",
      "limit must be an integer between 1 and 200."
    );
    return;
  }

  const effectivePromotionPolicy = resolveWorkspaceNotificationProviderPromotionPolicy(
    workspace,
    tenant
  );
  const evaluationWindowHours =
    requestedWindowHours && isPositiveInteger(Number(requestedWindowHours))
      ? Number(requestedWindowHours)
      : effectivePromotionPolicy.evaluationWindowHours;

  const [incidents, notifications] = await Promise.all([
    store.listNotificationProviderProfileIncidentsByWorkspace(tenantKey, workspaceKey, {
      profileKey: profileKey ?? undefined,
      status: status ?? undefined,
      limit: 200
    }),
    store.listSystemCheckEvidenceBreachNotificationsByWorkspace(tenantKey, workspaceKey, {
      limit: 500
    })
  ]);

  const rolloutMetricsByProfileKey = new Map(
    toWorkspaceNotificationProviderProfileRolloutMetricsResponse({
      tenant,
      workspace,
      notifications,
      evaluationWindowHours
    }).items.map(item => [item.profileKey, item] as const)
  );

  const latestUnresolvedIncidentsByProfileKey = new Map<string, NotificationProviderProfileIncident>();
  for (const incident of incidents) {
    if (incident.status === "resolved") {
      continue;
    }

    if (!latestUnresolvedIncidentsByProfileKey.has(incident.profileKey)) {
      latestUnresolvedIncidentsByProfileKey.set(incident.profileKey, incident);
    }
  }

  const items = Array.from(latestUnresolvedIncidentsByProfileKey.values())
    .flatMap(incident => {
      const rolloutMetrics = rolloutMetricsByProfileKey.get(incident.profileKey);

      if (!rolloutMetrics) {
        return [];
      }

      const queueItem = toNotificationProviderProfileGovernanceQueueItemDto({
        incident,
        rolloutMetrics,
        evaluatedAt: new Date().toISOString()
      });

      if (governanceStatus && queueItem.governanceStatus !== governanceStatus) {
        return [];
      }

      return [queueItem];
    })
    .slice(0, limit);

  sendJson<WorkspaceNotificationProviderProfileGovernanceQueueResponse>(response, 200, {
    tenantKey,
    workspaceKey,
    evaluationWindowHours,
    items,
    filters: {
      profileKey,
      status,
      governanceStatus
    }
  });
};

const handleWorkspaceNotificationProviderProfileGovernanceAlertsGet = async (
  store: PlatformStore,
  response: ServerResponse,
  url: URL,
  tenantKey: string,
  workspaceKey: string
): Promise<void> => {
  const workspace = await store.getWorkspaceByKey(tenantKey, workspaceKey);

  if (!workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const profileKey = getTrimmedString(url.searchParams.get("profileKey")) ?? null;
  const rawStatus = getTrimmedString(url.searchParams.get("status"));
  const status = rawStatus ?? null;
  const rawDeliveryStatus = getTrimmedString(url.searchParams.get("deliveryStatus"));
  const deliveryStatus = rawDeliveryStatus ?? null;
  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit ? Number.parseInt(rawLimit, 10) : 50;

  if (status !== null && !isNotificationProviderProfileGovernanceAlertStatus(status)) {
    sendError(
      response,
      400,
      "invalid_notification_provider_profile_governance_alert_status_filter",
      "status must be one of pending_acknowledgement or acknowledged."
    );
    return;
  }

  if (
    deliveryStatus !== null &&
    !isSystemCheckEvidenceBreachNotificationDeliveryStatus(deliveryStatus)
  ) {
    sendError(
      response,
      400,
      "invalid_notification_provider_profile_governance_alert_delivery_status_filter",
      "deliveryStatus must be one of pending_delivery, delivered, or delivery_failed."
    );
    return;
  }

  if (!Number.isInteger(limit) || limit <= 0 || limit > 200) {
    sendError(
      response,
      400,
      "invalid_notification_provider_profile_governance_alert_limit",
      "limit must be an integer between 1 and 200."
    );
    return;
  }

  const alerts = await store.listNotificationProviderProfileGovernanceAlertsByWorkspace(
    tenantKey,
    workspaceKey,
    {
      profileKey: profileKey ?? undefined,
      status: status ?? undefined,
      deliveryStatus: deliveryStatus ?? undefined,
      limit
    }
  );

  sendJson<WorkspaceNotificationProviderProfileGovernanceAlertsResponse>(response, 200, {
    items: alerts.map(toNotificationProviderProfileGovernanceAlertDto),
    filters: {
      profileKey,
      status,
      deliveryStatus
    }
  });
};

const handleWorkspaceNotificationProviderProfileGovernanceAlertMetricsGet = async (
  store: PlatformStore,
  response: ServerResponse,
  url: URL,
  tenantKey: string,
  workspaceKey: string
): Promise<void> => {
  const workspace = await store.getWorkspaceByKey(tenantKey, workspaceKey);

  if (!workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const profileKey = getTrimmedString(url.searchParams.get("profileKey")) ?? null;
  const rawAlertClass = getTrimmedString(url.searchParams.get("alertClass"));
  const alertClass = rawAlertClass ?? null;
  const rawDeliveryChannel = getTrimmedString(url.searchParams.get("deliveryChannel"));
  const deliveryChannel = rawDeliveryChannel ?? null;

  if (
    alertClass !== null &&
    !isNotificationProviderProfileGovernanceAlertClass(alertClass)
  ) {
    sendError(
      response,
      400,
      "invalid_notification_provider_profile_governance_alert_metrics_alert_class_filter",
      "alertClass must be one of incident_open or incident_resolved."
    );
    return;
  }

  if (
    deliveryChannel !== null &&
    !isSystemCheckEvidenceBreachNotificationDeliveryChannel(deliveryChannel)
  ) {
    sendError(
      response,
      400,
      "invalid_notification_provider_profile_governance_alert_metrics_delivery_channel_filter",
      "deliveryChannel must be one of webhook_spike or email_spike."
    );
    return;
  }

  const alerts = await store.listNotificationProviderProfileGovernanceAlertsByWorkspace(
    tenantKey,
    workspaceKey,
    {
      profileKey: profileKey ?? undefined,
      deliveryChannel: deliveryChannel ?? undefined,
      limit: 500
    }
  );

  sendJson<WorkspaceNotificationProviderProfileGovernanceAlertMetricsResponse>(
    response,
    200,
    toWorkspaceNotificationProviderProfileGovernanceAlertMetricsResponse({
      alerts,
      profileKey,
      alertClass,
      deliveryChannel
    })
  );
};

const handleWorkspaceNotificationProviderProfileGovernanceAlertTrendsGet = async (
  store: PlatformStore,
  response: ServerResponse,
  url: URL,
  tenantKey: string,
  workspaceKey: string
): Promise<void> => {
  const workspace = await store.getWorkspaceByKey(tenantKey, workspaceKey);

  if (!workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const profileKey = getTrimmedString(url.searchParams.get("profileKey")) ?? null;
  const rawAlertClass = getTrimmedString(url.searchParams.get("alertClass"));
  const alertClass = rawAlertClass ?? null;
  const rawDeliveryChannel = getTrimmedString(url.searchParams.get("deliveryChannel"));
  const deliveryChannel = rawDeliveryChannel ?? null;
  const rawWindowHours = url.searchParams.get("windowHours");
  const rawBucketHours = url.searchParams.get("bucketHours");
  const windowHours = rawWindowHours ? Number.parseInt(rawWindowHours, 10) : 24;
  const bucketHours = rawBucketHours ? Number.parseInt(rawBucketHours, 10) : 24;

  if (
    alertClass !== null &&
    !isNotificationProviderProfileGovernanceAlertClass(alertClass)
  ) {
    sendError(
      response,
      400,
      "invalid_notification_provider_profile_governance_alert_trends_alert_class_filter",
      "alertClass must be one of incident_open or incident_resolved."
    );
    return;
  }

  if (
    deliveryChannel !== null &&
    !isSystemCheckEvidenceBreachNotificationDeliveryChannel(deliveryChannel)
  ) {
    sendError(
      response,
      400,
      "invalid_notification_provider_profile_governance_alert_trends_delivery_channel_filter",
      "deliveryChannel must be one of webhook_spike or email_spike."
    );
    return;
  }

  if (!Number.isInteger(windowHours) || windowHours <= 0 || windowHours > 24 * 30) {
    sendError(
      response,
      400,
      "invalid_notification_provider_profile_governance_alert_trends_window_hours",
      "windowHours must be an integer between 1 and 720."
    );
    return;
  }

  if (
    !Number.isInteger(bucketHours) ||
    bucketHours <= 0 ||
    bucketHours > windowHours
  ) {
    sendError(
      response,
      400,
      "invalid_notification_provider_profile_governance_alert_trends_bucket_hours",
      "bucketHours must be an integer between 1 and windowHours."
    );
    return;
  }

  const alerts = await store.listNotificationProviderProfileGovernanceAlertsByWorkspace(
    tenantKey,
    workspaceKey,
    {
      profileKey: profileKey ?? undefined,
      deliveryChannel: deliveryChannel ?? undefined,
      limit: 500
    }
  );

  sendJson<WorkspaceNotificationProviderProfileGovernanceAlertTrendsResponse>(
    response,
    200,
    toWorkspaceNotificationProviderProfileGovernanceAlertTrendsResponse({
      alerts,
      profileKey,
      alertClass,
      deliveryChannel,
      windowHours,
      bucketHours
    })
  );
};

const handleWorkspaceNotificationProviderProfileGovernanceCorrelationsGet = async (
  store: PlatformStore,
  response: ServerResponse,
  url: URL,
  tenantKey: string,
  workspaceKey: string
): Promise<void> => {
  const workspace = await store.getWorkspaceByKey(tenantKey, workspaceKey);

  if (!workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const profileKey = getTrimmedString(url.searchParams.get("profileKey")) ?? null;
  const rawStatus = getTrimmedString(url.searchParams.get("status"));
  const status = rawStatus ?? null;
  const rawLimit = url.searchParams.get("limit");
  const rawAuditLimit = url.searchParams.get("auditLimit");
  const limit = rawLimit ? Number.parseInt(rawLimit, 10) : 50;
  const auditLimit = rawAuditLimit ? Number.parseInt(rawAuditLimit, 10) : 500;

  if (status !== null && !isNotificationProviderProfileIncidentStatus(status)) {
    sendError(
      response,
      400,
      "invalid_notification_provider_profile_governance_correlation_status_filter",
      "status must be open, acknowledged, or resolved."
    );
    return;
  }

  if (!Number.isInteger(limit) || limit <= 0 || limit > 200) {
    sendError(
      response,
      400,
      "invalid_notification_provider_profile_governance_correlation_limit",
      "limit must be an integer between 1 and 200."
    );
    return;
  }

  if (!Number.isInteger(auditLimit) || auditLimit <= 0 || auditLimit > 1000) {
    sendError(
      response,
      400,
      "invalid_notification_provider_profile_governance_correlation_audit_limit",
      "auditLimit must be an integer between 1 and 1000."
    );
    return;
  }

  const [incidents, alerts, auditEvents] = await Promise.all([
    store.listNotificationProviderProfileIncidentsByWorkspace(tenantKey, workspaceKey, {
      profileKey: profileKey ?? undefined,
      status: status ?? undefined,
      limit
    }),
    store.listNotificationProviderProfileGovernanceAlertsByWorkspace(tenantKey, workspaceKey, {
      profileKey: profileKey ?? undefined,
      limit: 500
    }),
    store.listAuditEventsByWorkspace(tenantKey, workspaceKey, {
      limit: auditLimit
    })
  ]);

  const items = incidents.map(incident => {
    const incidentAlerts = alerts
      .filter(alert => alert.incidentId === incident.incidentId)
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    const requestIds = new Set<string>();

    if (incident.sourceRequestId) {
      requestIds.add(incident.sourceRequestId);
    }
    for (const alert of incidentAlerts) {
      if (alert.sourceRequestId) {
        requestIds.add(alert.sourceRequestId);
      }
    }

    const alertIds = new Set(incidentAlerts.map(alert => alert.alertId));
    const timeline = auditEvents
      .filter(auditEvent => {
        if (requestIds.has(auditEvent.requestId)) {
          return true;
        }

        const relatedIncidentId = getAuditEventRelatedIncidentId(auditEvent);
        if (relatedIncidentId === incident.incidentId) {
          return true;
        }

        const relatedAlertIds = getAuditEventRelatedAlertIds(auditEvent);
        return relatedAlertIds.some(alertId => alertIds.has(alertId));
      })
      .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))
      .map(toNotificationProviderProfileGovernanceCorrelationTimelineEventDto);

    return {
      profileKey: incident.profileKey,
      incident: toNotificationProviderProfileIncidentDto(incident),
      alerts: incidentAlerts.map(toNotificationProviderProfileGovernanceAlertDto),
      timeline
    };
  });

  sendJson<WorkspaceNotificationProviderProfileGovernanceCorrelationsResponse>(
    response,
    200,
    {
      items,
      filters: {
        profileKey,
        status
      }
    }
  );
};

const handleWorkspaceNotificationProviderProfileGovernanceCasesGet = async (
  store: PlatformStore,
  response: ServerResponse,
  url: URL,
  tenantKey: string,
  workspaceKey: string
): Promise<void> => {
  const workspace = await store.getWorkspaceByKey(tenantKey, workspaceKey);

  if (!workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const profileKey = getTrimmedString(url.searchParams.get("profileKey")) ?? null;
  const rawStatus = getTrimmedString(url.searchParams.get("status"));
  const status = rawStatus ?? null;
  const rawCaseStatus = getTrimmedString(url.searchParams.get("caseStatus"));
  const caseStatus = rawCaseStatus ?? null;
  const rawSlaStatus = getTrimmedString(url.searchParams.get("slaStatus"));
  const slaStatus = rawSlaStatus ?? null;
  const rawLimit = url.searchParams.get("limit");
  const rawAuditLimit = url.searchParams.get("auditLimit");
  const limit = rawLimit ? Number.parseInt(rawLimit, 10) : 50;
  const auditLimit = rawAuditLimit ? Number.parseInt(rawAuditLimit, 10) : 500;

  if (status !== null && !isNotificationProviderProfileIncidentStatus(status)) {
    sendError(
      response,
      400,
      "invalid_notification_provider_profile_governance_case_status_filter",
      "status must be open, acknowledged, or resolved."
    );
    return;
  }

  if (
    caseStatus !== null &&
    !isNotificationProviderProfileGovernanceCaseStatus(caseStatus)
  ) {
    sendError(
      response,
      400,
      "invalid_notification_provider_profile_governance_case_case_status_filter",
      "caseStatus must be one of awaiting_incident_acknowledgement, suppressed_monitoring, awaiting_redrive, awaiting_alert_acknowledgement, recovered, or closed."
    );
    return;
  }

  if (slaStatus !== null && !isNotificationProviderProfileGovernanceCaseSlaStatus(slaStatus)) {
    sendError(
      response,
      400,
      "invalid_notification_provider_profile_governance_case_sla_status_filter",
      "slaStatus must be one of not_applicable, on_track, breached, or escalated."
    );
    return;
  }

  if (!Number.isInteger(limit) || limit <= 0 || limit > 200) {
    sendError(
      response,
      400,
      "invalid_notification_provider_profile_governance_case_limit",
      "limit must be an integer between 1 and 200."
    );
    return;
  }

  if (!Number.isInteger(auditLimit) || auditLimit <= 0 || auditLimit > 1000) {
    sendError(
      response,
      400,
      "invalid_notification_provider_profile_governance_case_audit_limit",
      "auditLimit must be an integer between 1 and 1000."
    );
    return;
  }

  const [incidents, alerts, auditEvents] = await Promise.all([
    store.listNotificationProviderProfileIncidentsByWorkspace(tenantKey, workspaceKey, {
      profileKey: profileKey ?? undefined,
      status: status ?? undefined,
      limit
    }),
    store.listNotificationProviderProfileGovernanceAlertsByWorkspace(tenantKey, workspaceKey, {
      profileKey: profileKey ?? undefined,
      limit: 500
    }),
    store.listAuditEventsByWorkspace(tenantKey, workspaceKey, {
      limit: auditLimit
    })
  ]);

  const items = incidents
    .map(incident => {
      const incidentAlerts = alerts
        .filter(alert => alert.incidentId === incident.incidentId)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
      const requestIds = new Set<string>();

      if (incident.sourceRequestId) {
        requestIds.add(incident.sourceRequestId);
      }
      for (const alert of incidentAlerts) {
        if (alert.sourceRequestId) {
          requestIds.add(alert.sourceRequestId);
        }
      }

      const alertIds = new Set(incidentAlerts.map(alert => alert.alertId));
      const timeline = auditEvents
        .filter(auditEvent => {
          if (requestIds.has(auditEvent.requestId)) {
            return true;
          }

          const relatedIncidentId = getAuditEventRelatedIncidentId(auditEvent);
          if (relatedIncidentId === incident.incidentId) {
            return true;
          }

          const relatedAlertIds = getAuditEventRelatedAlertIds(auditEvent);
          return relatedAlertIds.some(alertId => alertIds.has(alertId));
        })
        .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))
        .map(toNotificationProviderProfileGovernanceCorrelationTimelineEventDto);
      const assignment = getLatestNotificationProviderProfileGovernanceCaseAssignment(
        auditEvents,
        incident.incidentId
      );

      return toNotificationProviderProfileGovernanceCaseDto({
        profileKey: incident.profileKey,
        incident,
        alerts: incidentAlerts,
        timeline,
        assignment,
        escalation: getLatestNotificationProviderProfileGovernanceCaseEscalation(
          auditEvents,
          incident.incidentId
        )
      });
    })
    .filter(item => (caseStatus ? item.caseStatus === caseStatus : true))
    .filter(item => (slaStatus ? item.slaStatus === slaStatus : true));

  sendJson<WorkspaceNotificationProviderProfileGovernanceCasesResponse>(response, 200, {
    items,
    filters: {
      profileKey,
      status,
      caseStatus,
      slaStatus
    }
  });
};

const handleWorkspaceNotificationProviderProfileGovernanceCaseQueueGet = async (
  store: PlatformStore,
  response: ServerResponse,
  url: URL,
  tenantKey: string,
  workspaceKey: string
): Promise<void> => {
  const workspace = await store.getWorkspaceByKey(tenantKey, workspaceKey);

  if (!workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const profileKey = getTrimmedString(url.searchParams.get("profileKey")) ?? null;
  const rawCaseStatus = getTrimmedString(url.searchParams.get("caseStatus"));
  const caseStatus = rawCaseStatus ?? null;
  const rawSlaStatus = getTrimmedString(url.searchParams.get("slaStatus"));
  const slaStatus = rawSlaStatus ?? null;
  const rawAssignmentStatus = getTrimmedString(url.searchParams.get("assignmentStatus"));
  const assignmentStatus = rawAssignmentStatus ?? null;
  const rawLimit = url.searchParams.get("limit");
  const rawAuditLimit = url.searchParams.get("auditLimit");
  const limit = rawLimit ? Number.parseInt(rawLimit, 10) : 50;
  const auditLimit = rawAuditLimit ? Number.parseInt(rawAuditLimit, 10) : 500;

  if (
    caseStatus !== null &&
    !isNotificationProviderProfileGovernanceCaseStatus(caseStatus)
  ) {
    sendError(
      response,
      400,
      "invalid_notification_provider_profile_governance_case_queue_case_status_filter",
      "caseStatus must be one of awaiting_incident_acknowledgement, suppressed_monitoring, awaiting_redrive, awaiting_alert_acknowledgement, recovered, or closed."
    );
    return;
  }

  if (slaStatus !== null && !isNotificationProviderProfileGovernanceCaseSlaStatus(slaStatus)) {
    sendError(
      response,
      400,
      "invalid_notification_provider_profile_governance_case_queue_sla_status_filter",
      "slaStatus must be one of not_applicable, on_track, breached, or escalated."
    );
    return;
  }

  if (
    assignmentStatus !== null &&
    assignmentStatus !== "unassigned" &&
    assignmentStatus !== "assigned"
  ) {
    sendError(
      response,
      400,
      "invalid_notification_provider_profile_governance_case_queue_assignment_status_filter",
      "assignmentStatus must be one of unassigned or assigned."
    );
    return;
  }

  if (!Number.isInteger(limit) || limit <= 0 || limit > 200) {
    sendError(
      response,
      400,
      "invalid_notification_provider_profile_governance_case_queue_limit",
      "limit must be an integer between 1 and 200."
    );
    return;
  }

  if (!Number.isInteger(auditLimit) || auditLimit <= 0 || auditLimit > 1000) {
    sendError(
      response,
      400,
      "invalid_notification_provider_profile_governance_case_queue_audit_limit",
      "auditLimit must be an integer between 1 and 1000."
    );
    return;
  }

  const [incidents, alerts, auditEvents] = await Promise.all([
    store.listNotificationProviderProfileIncidentsByWorkspace(tenantKey, workspaceKey, {
      profileKey: profileKey ?? undefined,
      limit: 200
    }),
    store.listNotificationProviderProfileGovernanceAlertsByWorkspace(tenantKey, workspaceKey, {
      profileKey: profileKey ?? undefined,
      limit: 500
    }),
    store.listAuditEventsByWorkspace(tenantKey, workspaceKey, {
      limit: auditLimit
    })
  ]);

  const items = incidents
    .map(incident => {
      const incidentAlerts = alerts
        .filter(alert => alert.incidentId === incident.incidentId)
        .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
      const requestIds = new Set<string>();
      if (incident.sourceRequestId) {
        requestIds.add(incident.sourceRequestId);
      }
      for (const alert of incidentAlerts) {
        if (alert.sourceRequestId) {
          requestIds.add(alert.sourceRequestId);
        }
      }
      const alertIds = new Set(incidentAlerts.map(alert => alert.alertId));
      const timeline = auditEvents
        .filter(auditEvent => {
          if (requestIds.has(auditEvent.requestId)) {
            return true;
          }
          const relatedIncidentId = getAuditEventRelatedIncidentId(auditEvent);
          if (relatedIncidentId === incident.incidentId) {
            return true;
          }
          const relatedAlertIds = getAuditEventRelatedAlertIds(auditEvent);
          return relatedAlertIds.some(alertId => alertIds.has(alertId));
        })
        .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))
        .map(toNotificationProviderProfileGovernanceCorrelationTimelineEventDto);
      const caseItem = toNotificationProviderProfileGovernanceCaseDto({
        profileKey: incident.profileKey,
        incident,
        alerts: incidentAlerts,
        timeline,
        assignment: getLatestNotificationProviderProfileGovernanceCaseAssignment(
          auditEvents,
          incident.incidentId
        ),
        escalation: getLatestNotificationProviderProfileGovernanceCaseEscalation(
          auditEvents,
          incident.incidentId
        )
      });

      return toNotificationProviderProfileGovernanceCaseQueueItemDto(caseItem);
    })
    .filter(item => (caseStatus ? item.caseItem.caseStatus === caseStatus : true))
    .filter(item => (caseStatus === null ? item.caseItem.caseStatus !== "closed" : true))
    .filter(item => (slaStatus ? item.caseItem.slaStatus === slaStatus : true))
    .filter(item =>
      assignmentStatus ? item.caseItem.assignmentStatus === assignmentStatus : true
    )
    .sort((left, right) =>
      left.priorityRank - right.priorityRank ||
      right.caseItem.latestActivityAt.localeCompare(left.caseItem.latestActivityAt) ||
      left.caseItem.profileKey.localeCompare(right.caseItem.profileKey) ||
      left.caseItem.incident.incidentId.localeCompare(right.caseItem.incident.incidentId)
    )
    .slice(0, limit);

  sendJson<WorkspaceNotificationProviderProfileGovernanceCaseQueueResponse>(response, 200, {
    items,
    filters: {
      profileKey,
      caseStatus,
      slaStatus,
      assignmentStatus
    }
  });
};

const handleWorkspaceNotificationProviderProfileGovernanceCaseAssign = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string,
  incidentId: string,
  requestContext: RequestContext
): Promise<void> => {
  const workspace = await store.getWorkspaceByKey(tenantKey, workspaceKey);

  if (!workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const incident = await store.getNotificationProviderProfileIncidentById(incidentId);
  if (!incident || incident.workspaceId !== workspace.workspaceId) {
    sendError(
      response,
      404,
      "notification_provider_profile_incident_not_found",
      `Notification provider profile incident '${incidentId}' was not found in workspace '${workspaceKey}'.`
    );
    return;
  }

  const body = await readBody<AssignNotificationProviderProfileGovernanceCaseRequest>(request);
  const assignedByActorId = getTrimmedString(body.assignedByActorId);
  const assignedToActorId = getTrimmedString(body.assignedToActorId);
  const assignmentNote = getTrimmedString(body.assignmentNote);
  const slaSeconds =
    typeof body.slaSeconds === "number" && Number.isInteger(body.slaSeconds)
      ? body.slaSeconds
      : body.slaSeconds === null || typeof body.slaSeconds === "undefined"
        ? null
        : Number.NaN;

  if (!assignedByActorId || !assignedToActorId || !assignmentNote) {
    sendError(
      response,
      400,
      "invalid_notification_provider_profile_governance_case_assignment_payload",
      "assignedByActorId, assignedToActorId, and assignmentNote are required."
    );
    return;
  }

  if (Number.isNaN(slaSeconds) || (typeof slaSeconds === "number" && slaSeconds < 0)) {
    sendError(
      response,
      400,
      "invalid_notification_provider_profile_governance_case_assignment_sla",
      "slaSeconds must be a non-negative integer when provided."
    );
    return;
  }

  const assignedAt = new Date().toISOString();
  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: workspace.tenantId,
    workspaceId: workspace.workspaceId,
    actorType: "platform_api",
    actorId: assignedByActorId,
    eventType: "workspace.notification_provider_profile_governance_case.assigned",
    payload: {
      workspaceKey,
      profileKey: incident.profileKey,
      incidentId: incident.incidentId,
      assignedByActorId,
      assignedToActorId,
      assignedAt,
      assignmentNote,
      slaSeconds
    }
  });

  const [alerts, auditEvents] = await Promise.all([
    store.listNotificationProviderProfileGovernanceAlertsByWorkspace(tenantKey, workspaceKey, {
      profileKey: incident.profileKey,
      limit: 500
    }),
    store.listAuditEventsByWorkspace(tenantKey, workspaceKey, {
      limit: 500
    })
  ]);
  const incidentAlerts = alerts
    .filter(alert => alert.incidentId === incident.incidentId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const requestIds = new Set<string>();
  if (incident.sourceRequestId) {
    requestIds.add(incident.sourceRequestId);
  }
  for (const alert of incidentAlerts) {
    if (alert.sourceRequestId) {
      requestIds.add(alert.sourceRequestId);
    }
  }
  requestIds.add(requestContext.requestId);
  const alertIds = new Set(incidentAlerts.map(alert => alert.alertId));
  const timeline = auditEvents
    .filter(auditEvent => {
      if (requestIds.has(auditEvent.requestId)) {
        return true;
      }
      const relatedIncidentId = getAuditEventRelatedIncidentId(auditEvent);
      if (relatedIncidentId === incident.incidentId) {
        return true;
      }
      const relatedAlertIds = getAuditEventRelatedAlertIds(auditEvent);
      return relatedAlertIds.some(alertId => alertIds.has(alertId));
    })
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))
    .map(toNotificationProviderProfileGovernanceCorrelationTimelineEventDto);

  const caseItem = toNotificationProviderProfileGovernanceCaseDto({
    profileKey: incident.profileKey,
    incident,
    alerts: incidentAlerts,
    timeline,
    assignment: getLatestNotificationProviderProfileGovernanceCaseAssignment(
      auditEvents,
      incident.incidentId
    ),
    escalation: getLatestNotificationProviderProfileGovernanceCaseEscalation(
      auditEvents,
      incident.incidentId
    )
  });

  sendJson<AssignNotificationProviderProfileGovernanceCaseResponse>(response, 200, {
    caseItem
  });
};

const handleWorkspaceNotificationProviderProfileGovernanceCaseEscalate = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string,
  incidentId: string,
  requestContext: RequestContext
): Promise<void> => {
  const workspace = await store.getWorkspaceByKey(tenantKey, workspaceKey);

  if (!workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const incident = await store.getNotificationProviderProfileIncidentById(incidentId);
  if (!incident || incident.workspaceId !== workspace.workspaceId) {
    sendError(
      response,
      404,
      "notification_provider_profile_incident_not_found",
      `Notification provider profile incident '${incidentId}' was not found in workspace '${workspaceKey}'.`
    );
    return;
  }

  const body = await readBody<EscalateNotificationProviderProfileGovernanceCaseRequest>(request);
  const escalatedByActorId = getTrimmedString(body.escalatedByActorId);
  const escalationNote = getTrimmedString(body.escalationNote);

  if (!escalatedByActorId || !escalationNote) {
    sendError(
      response,
      400,
      "invalid_notification_provider_profile_governance_case_escalation_payload",
      "escalatedByActorId and escalationNote are required."
    );
    return;
  }

  const escalatedAt = new Date().toISOString();
  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: workspace.tenantId,
    workspaceId: workspace.workspaceId,
    actorType: "platform_api",
    actorId: escalatedByActorId,
    eventType: "workspace.notification_provider_profile_governance_case.escalated",
    payload: {
      workspaceKey,
      profileKey: incident.profileKey,
      incidentId: incident.incidentId,
      escalatedByActorId,
      escalatedAt,
      escalationNote
    }
  });

  const [alerts, auditEvents] = await Promise.all([
    store.listNotificationProviderProfileGovernanceAlertsByWorkspace(tenantKey, workspaceKey, {
      profileKey: incident.profileKey,
      limit: 500
    }),
    store.listAuditEventsByWorkspace(tenantKey, workspaceKey, {
      limit: 500
    })
  ]);
  const incidentAlerts = alerts
    .filter(alert => alert.incidentId === incident.incidentId)
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
  const requestIds = new Set<string>();
  if (incident.sourceRequestId) {
    requestIds.add(incident.sourceRequestId);
  }
  for (const alert of incidentAlerts) {
    if (alert.sourceRequestId) {
      requestIds.add(alert.sourceRequestId);
    }
  }
  requestIds.add(requestContext.requestId);
  const alertIds = new Set(incidentAlerts.map(alert => alert.alertId));
  const timeline = auditEvents
    .filter(auditEvent => {
      if (requestIds.has(auditEvent.requestId)) {
        return true;
      }
      const relatedIncidentId = getAuditEventRelatedIncidentId(auditEvent);
      if (relatedIncidentId === incident.incidentId) {
        return true;
      }
      const relatedAlertIds = getAuditEventRelatedAlertIds(auditEvent);
      return relatedAlertIds.some(alertId => alertIds.has(alertId));
    })
    .sort((left, right) => left.occurredAt.localeCompare(right.occurredAt))
    .map(toNotificationProviderProfileGovernanceCorrelationTimelineEventDto);

  const caseItem = toNotificationProviderProfileGovernanceCaseDto({
    profileKey: incident.profileKey,
    incident,
    alerts: incidentAlerts,
    timeline,
    assignment: getLatestNotificationProviderProfileGovernanceCaseAssignment(
      auditEvents,
      incident.incidentId
    ),
    escalation: getLatestNotificationProviderProfileGovernanceCaseEscalation(
      auditEvents,
      incident.incidentId
    )
  });

  sendJson<EscalateNotificationProviderProfileGovernanceCaseResponse>(response, 200, {
    caseItem
  });
};

const handleWorkspaceNotificationProviderProfileGovernanceAlertDeadLetterQueueGet = async (
  store: PlatformStore,
  response: ServerResponse,
  url: URL,
  tenantKey: string,
  workspaceKey: string
): Promise<void> => {
  const workspace = await store.getWorkspaceByKey(tenantKey, workspaceKey);

  if (!workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const profileKey = getTrimmedString(url.searchParams.get("profileKey")) ?? null;
  const rawStatus = getTrimmedString(url.searchParams.get("status"));
  const status = rawStatus ?? null;
  const rawDeliveryChannel = getTrimmedString(url.searchParams.get("deliveryChannel"));
  const deliveryChannel = rawDeliveryChannel ?? null;
  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit ? Number.parseInt(rawLimit, 10) : 50;

  if (status !== null && !isNotificationProviderProfileGovernanceAlertStatus(status)) {
    sendError(
      response,
      400,
      "invalid_notification_provider_profile_governance_alert_dead_letter_status_filter",
      "status must be one of pending_acknowledgement or acknowledged."
    );
    return;
  }

  if (
    deliveryChannel !== null &&
    !isSystemCheckEvidenceBreachNotificationDeliveryChannel(deliveryChannel)
  ) {
    sendError(
      response,
      400,
      "invalid_notification_provider_profile_governance_alert_dead_letter_delivery_channel_filter",
      "deliveryChannel must be one of webhook_spike or email_spike."
    );
    return;
  }

  if (!Number.isInteger(limit) || limit <= 0 || limit > 200) {
    sendError(
      response,
      400,
      "invalid_notification_provider_profile_governance_alert_dead_letter_limit",
      "limit must be an integer between 1 and 200."
    );
    return;
  }

  const alerts = await store.listNotificationProviderProfileGovernanceAlertsByWorkspace(
    tenantKey,
    workspaceKey,
    {
      profileKey: profileKey ?? undefined,
      status: status ?? undefined,
      deliveryStatus: "delivery_failed",
      deliveryChannel: deliveryChannel ?? undefined,
      limit
    }
  );

  sendJson<WorkspaceNotificationProviderProfileGovernanceAlertDeadLetterQueueResponse>(response, 200, {
    items: alerts.map(toNotificationProviderProfileGovernanceAlertDto),
    filters: {
      profileKey,
      status,
      deliveryChannel
    }
  });
};

const handleWorkspaceNotificationProviderProfileIncidentAcknowledge = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string,
  incidentId: string,
  requestContext: RequestContext
): Promise<void> => {
  const workspace = await store.getWorkspaceByKey(tenantKey, workspaceKey);

  if (!workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const incident = await store.getNotificationProviderProfileIncidentById(incidentId);

  if (!incident || incident.workspaceId !== workspace.workspaceId) {
    sendError(
      response,
      404,
      "notification_provider_profile_incident_not_found",
      `Notification provider profile incident '${incidentId}' was not found in workspace '${workspaceKey}'.`
    );
    return;
  }

  if (incident.status === "resolved") {
    sendError(
      response,
      409,
      "notification_provider_profile_incident_already_resolved",
      `Notification provider profile incident '${incidentId}' is already resolved.`
    );
    return;
  }

  const body = await readBody<AcknowledgeNotificationProviderProfileIncidentRequest>(request);
  const acknowledgedByActorId = getTrimmedString(body.acknowledgedByActorId);
  const acknowledgementNote = getTrimmedString(body.acknowledgementNote);

  if (!acknowledgedByActorId || !acknowledgementNote) {
    sendError(
      response,
      400,
      "invalid_notification_provider_profile_incident_acknowledgement_payload",
      "acknowledgedByActorId and acknowledgementNote are required."
    );
    return;
  }

  const acknowledgedAt = new Date().toISOString();
  const acknowledgedIncident: NotificationProviderProfileIncident = {
    ...incident,
    status: "acknowledged",
    acknowledgedAt,
    acknowledgedByActorId,
    acknowledgementNote,
    sourceRequestId: requestContext.requestId
  };

  await store.updateNotificationProviderProfileIncident(acknowledgedIncident);
  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: workspace.tenantId,
    workspaceId: workspace.workspaceId,
    actorType: "platform_api",
    actorId: acknowledgedByActorId,
    eventType: "workspace.notification_provider_profile_incident.acknowledged",
    payload: {
      workspaceKey,
      incident: toNotificationProviderProfileIncidentDto(acknowledgedIncident)
    }
  });

  sendJson<AcknowledgeNotificationProviderProfileIncidentResponse>(response, 200, {
    incident: toNotificationProviderProfileIncidentDto(acknowledgedIncident)
  });
};

const handleWorkspaceNotificationProviderProfileGovernanceAlertAcknowledge = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string,
  alertId: string,
  requestContext: RequestContext
): Promise<void> => {
  const workspace = await store.getWorkspaceByKey(tenantKey, workspaceKey);

  if (!workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const alert = await store.getNotificationProviderProfileGovernanceAlertById(alertId);

  if (!alert || alert.workspaceId !== workspace.workspaceId) {
    sendError(
      response,
      404,
      "notification_provider_profile_governance_alert_not_found",
      `Notification provider profile governance alert '${alertId}' was not found in workspace '${workspaceKey}'.`
    );
    return;
  }

  if (alert.status === "acknowledged") {
    sendError(
      response,
      409,
      "notification_provider_profile_governance_alert_already_acknowledged",
      `Notification provider profile governance alert '${alertId}' has already been acknowledged.`
    );
    return;
  }

  const body = await readBody<AcknowledgeNotificationProviderProfileGovernanceAlertRequest>(request);
  const acknowledgedByActorId = getTrimmedString(body.acknowledgedByActorId);
  const acknowledgementNote = getTrimmedString(body.acknowledgementNote);

  if (!acknowledgedByActorId || !acknowledgementNote) {
    sendError(
      response,
      400,
      "invalid_notification_provider_profile_governance_alert_acknowledgement_payload",
      "acknowledgedByActorId and acknowledgementNote are required."
    );
    return;
  }

  const acknowledgedAlert = acknowledgeNotificationProviderProfileGovernanceAlert({
    alert,
    acknowledgedByActorId,
    acknowledgementNote
  });

  await store.updateNotificationProviderProfileGovernanceAlert(acknowledgedAlert);
  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: workspace.tenantId,
    workspaceId: workspace.workspaceId,
    actorType: "platform_api",
    actorId: acknowledgedByActorId,
    eventType: "workspace.notification_provider_profile_governance_alert.acknowledged",
    payload: {
      workspaceKey,
      alert: toNotificationProviderProfileGovernanceAlertDto(acknowledgedAlert)
    }
  });

  sendJson<AcknowledgeNotificationProviderProfileGovernanceAlertResponse>(response, 200, {
    alert: toNotificationProviderProfileGovernanceAlertDto(acknowledgedAlert)
  });
};

const handleWorkspaceNotificationProviderProfileGovernanceAlertRedrive = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string,
  alertId: string,
  requestContext: RequestContext
): Promise<void> => {
  const workspace = await store.getWorkspaceByKey(tenantKey, workspaceKey);

  if (!workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const alert = await store.getNotificationProviderProfileGovernanceAlertById(alertId);

  if (!alert || alert.workspaceId !== workspace.workspaceId) {
    sendError(
      response,
      404,
      "notification_provider_profile_governance_alert_not_found",
      `Notification provider profile governance alert '${alertId}' was not found in workspace '${workspaceKey}'.`
    );
    return;
  }

  if (alert.deliveryStatus !== "delivery_failed") {
    sendError(
      response,
      409,
      "notification_provider_profile_governance_alert_not_in_dead_letter_queue",
      `Notification provider profile governance alert '${alertId}' is not currently in the dead-letter queue.`,
      {
        deliveryStatus: alert.deliveryStatus
      }
    );
    return;
  }

  if (alert.status === "acknowledged") {
    sendError(
      response,
      409,
      "notification_provider_profile_governance_alert_already_acknowledged",
      `Notification provider profile governance alert '${alertId}' has already been acknowledged.`
    );
    return;
  }

  const body = await readBody<RedriveNotificationProviderProfileGovernanceAlertRequest>(request);
  const redrivenByActorId = getTrimmedString(body.redrivenByActorId);
  const redriveNote = getTrimmedString(body.redriveNote);
  const deliveryTarget = getTrimmedString(body.deliveryTarget) ?? null;

  if (!redrivenByActorId || !redriveNote) {
    sendError(
      response,
      400,
      "invalid_notification_provider_profile_governance_alert_redrive_payload",
      "redrivenByActorId and redriveNote are required."
    );
    return;
  }

  const effectiveDeliveryTarget = deliveryTarget ?? alert.deliveryTarget;

  if (!effectiveDeliveryTarget) {
    sendError(
      response,
      400,
      "notification_provider_profile_governance_alert_redrive_target_required",
      "deliveryTarget is required when the failed governance alert has no existing delivery target."
    );
    return;
  }

  const tenant = await store.getTenantById(workspace.tenantId);

  if (!tenant) {
    sendError(
      response,
      500,
      "tenant_not_found",
      `Tenant for workspace '${workspaceKey}' could not be resolved.`
    );
    return;
  }

  const effectiveNotificationPolicy = resolveWorkspaceGovernanceNotificationPolicy(workspace, tenant);
  const redrivenAlert = redriveNotificationProviderProfileGovernanceAlert({
    alert,
    notificationPolicy: effectiveNotificationPolicy,
    deliveryTarget: effectiveDeliveryTarget,
    sourceRequestId: requestContext.requestId
  });

  await store.updateNotificationProviderProfileGovernanceAlert(redrivenAlert);
  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: redrivenAlert.tenantId,
    workspaceId: redrivenAlert.workspaceId,
    actorType: "platform_api",
    actorId: redrivenByActorId,
    eventType: "workspace.notification_provider_profile_governance_alert.redriven",
    payload: {
      alertId: redrivenAlert.alertId,
      incidentId: redrivenAlert.incidentId,
      profileKey: redrivenAlert.profileKey,
      governanceStatus: redrivenAlert.governanceStatus,
      previousSourceRequestId: alert.sourceRequestId,
      sourceRequestId: redrivenAlert.sourceRequestId,
      redriveNote,
      previousDeliveryProfileKey: alert.deliveryProfileKey,
      previousDeliveryChannel: alert.deliveryChannel,
      previousDeliveryStatus: alert.deliveryStatus,
      previousDeliveryAttemptCount: alert.deliveryAttemptCount,
      previousLastDeliveryError: alert.lastDeliveryError,
      deliveryProfileKey: redrivenAlert.deliveryProfileKey,
      deliveryChannel: redrivenAlert.deliveryChannel,
      deliveryTarget: redrivenAlert.deliveryTarget,
      maxDeliveryAttempts: redrivenAlert.maxDeliveryAttempts,
      nextDeliveryAttemptAt: redrivenAlert.nextDeliveryAttemptAt
    }
  });

  sendJson<RedriveNotificationProviderProfileGovernanceAlertResponse>(response, 200, {
    alert: toNotificationProviderProfileGovernanceAlertDto(redrivenAlert)
  });
};

const handleWorkspaceEvidenceRetentionPolicyGet = async (
  store: PlatformStore,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string
): Promise<void> => {
  const [tenant, workspace] = await Promise.all([
    store.getTenantByKey(tenantKey),
    store.getWorkspaceByKey(tenantKey, workspaceKey)
  ]);

  if (!tenant || !workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  sendJson<WorkspaceEvidenceRetentionPolicyResponse>(
    response,
    200,
    toWorkspaceEvidenceRetentionPolicyResponse(tenant, workspace)
  );
};

const handleWorkspaceEvidenceRetentionClassesGet = async (
  store: PlatformStore,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string
): Promise<void> => {
  const [tenant, workspace] = await Promise.all([
    store.getTenantByKey(tenantKey),
    store.getWorkspaceByKey(tenantKey, workspaceKey)
  ]);

  if (!tenant || !workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  sendJson<WorkspaceEvidenceRetentionClassesResponse>(
    response,
    200,
    toWorkspaceEvidenceRetentionClassesResponse(tenant, workspace)
  );
};

const handleWorkspaceEvidenceRetentionPolicyPatch = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string,
  requestContext: RequestContext
): Promise<void> => {
  const [tenant, workspace] = await Promise.all([
    store.getTenantByKey(tenantKey),
    store.getWorkspaceByKey(tenantKey, workspaceKey)
  ]);

  if (!tenant || !workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const body = await readBody<UpdateWorkspaceEvidenceRetentionPolicyRequest>(request);

  if (!isWorkspaceEvidenceRetentionPolicyMode(body.mode)) {
    sendError(
      response,
      400,
      "invalid_workspace_evidence_retention_policy_payload",
      "mode must be either 'inherit' or 'override'."
    );
    return;
  }

  if (body.mode === "override" && !isEvidenceRetentionPolicyOverride(body.evidenceRetentionPolicyOverride)) {
    sendError(
      response,
      400,
      "invalid_workspace_evidence_retention_policy_payload",
      "evidenceRetentionPolicyOverride must provide at least one evidence-retention policy integer field when mode is 'override'."
    );
    return;
  }

  const evidenceRetentionPolicyOverride =
    body.mode === "override"
      ? toEvidenceRetentionPolicyOverrideDto(
          body.evidenceRetentionPolicyOverride as EvidenceRetentionPolicyOverrideDto
        )
      : null;
  const previousEvidenceRetentionPolicyOverride = flattenEvidenceRetentionPolicyOverrideRecords(
    workspace.evidenceRetentionPolicyOverrideRecords
  );
  const changedEvidenceRetentionPolicyFields = evidenceRetentionPolicyOverride
    ? Object.keys(evidenceRetentionPolicyOverride)
    : [];
  const clearedEvidenceRetentionPolicyFields = previousEvidenceRetentionPolicyOverride
    ? Object.keys(previousEvidenceRetentionPolicyOverride).filter(fieldKey =>
        !evidenceRetentionPolicyOverride || !(fieldKey in evidenceRetentionPolicyOverride)
      )
    : [];
  const evidenceRetentionPolicyOverrideRecords = evidenceRetentionPolicyOverride
    ? createEvidenceRetentionPolicyOverrideRecords({
        override: evidenceRetentionPolicyOverride,
        updatedByRequestId: requestContext.requestId,
        updatedByActorType: "platform_api",
        updatedByActorId: "platform-api"
      })
    : null;

  const updatedWorkspace: Workspace = {
    ...workspace,
    evidenceRetentionPolicyOverrideRecords
  };

  await store.saveWorkspace(updatedWorkspace);
  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: updatedWorkspace.tenantId,
    workspaceId: updatedWorkspace.workspaceId,
    actorType: "platform_api",
    actorId: "platform-api",
    eventType: "workspace.evidence_retention_policy.updated",
    payload: {
      workspaceKey: updatedWorkspace.workspaceKey,
      mode: body.mode,
      defaultEvidenceRetentionPolicy: tenant.defaultEvidenceRetentionPolicy,
      evidenceRetentionPolicyOverride,
      evidenceRetentionPolicyOverrideRecords: toEvidenceRetentionPolicyOverrideRecordsDto(
        updatedWorkspace.evidenceRetentionPolicyOverrideRecords
      ),
      changedFields: changedEvidenceRetentionPolicyFields,
      clearedFields: clearedEvidenceRetentionPolicyFields,
      effectiveEvidenceRetentionPolicy: resolveWorkspaceEvidenceRetentionPolicy(updatedWorkspace, tenant)
    }
  });

  sendJson<WorkspaceEvidenceRetentionPolicyResponse>(
    response,
    200,
    toWorkspaceEvidenceRetentionPolicyResponse(tenant, updatedWorkspace)
  );
};

const handleWorkspaceEvidenceRetentionClassPolicyGet = async (
  store: PlatformStore,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string
): Promise<void> => {
  const [tenant, workspace] = await Promise.all([
    store.getTenantByKey(tenantKey),
    store.getWorkspaceByKey(tenantKey, workspaceKey)
  ]);

  if (!tenant || !workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  sendJson<WorkspaceEvidenceRetentionClassPolicyResponse>(
    response,
    200,
    toWorkspaceEvidenceRetentionClassPolicyResponse(tenant, workspace)
  );
};

const handleWorkspaceEvidenceRetentionClassPolicyPatch = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string,
  requestContext: RequestContext
): Promise<void> => {
  const [tenant, workspace] = await Promise.all([
    store.getTenantByKey(tenantKey),
    store.getWorkspaceByKey(tenantKey, workspaceKey)
  ]);

  if (!tenant || !workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const body = await readBody<UpdateWorkspaceEvidenceRetentionClassPolicyRequest>(request);

  if (!isWorkspaceEvidenceRetentionClassPolicyMode(body.mode)) {
    sendError(
      response,
      400,
      "invalid_workspace_evidence_retention_class_policy_payload",
      "mode must be either 'inherit' or 'override'."
    );
    return;
  }

  if (
    body.mode === "override" &&
    !isEvidenceRetentionClassPolicyOverride(body.evidenceRetentionClassPolicyOverride)
  ) {
    sendError(
      response,
      400,
      "invalid_workspace_evidence_retention_class_policy_payload",
      "evidenceRetentionClassPolicyOverride must provide at least one valid class-policy override when mode is 'override'."
    );
    return;
  }

  const evidenceRetentionClassPolicyOverride =
    body.mode === "override"
      ? toEvidenceRetentionClassPolicyOverrideDto(
          body.evidenceRetentionClassPolicyOverride as EvidenceRetentionClassPolicyOverrideDto
        )
      : null;
  const tenantClassKeys = new Set(
    tenant.defaultEvidenceRetentionClassPolicy.classes.map(classEntry => classEntry.retentionClass)
  );

  if (
    evidenceRetentionClassPolicyOverride?.defaultCaptureRetentionClass &&
    !tenantClassKeys.has(evidenceRetentionClassPolicyOverride.defaultCaptureRetentionClass)
  ) {
    sendError(
      response,
      400,
      "invalid_workspace_evidence_retention_class_policy_payload",
      "defaultCaptureRetentionClass must reference a tenant-defined retention class."
    );
    return;
  }

  if (
    evidenceRetentionClassPolicyOverride?.classEntries?.some(
        classEntry =>
          !tenantClassKeys.has(classEntry.retentionClass) ||
        classEntry.holdTransitions.some(
          transition =>
            !tenant.defaultEvidenceRetentionClassPolicy.holdReasons.some(
              holdReason => holdReason.holdReasonCode === transition.holdReasonCode
            ) || !tenantClassKeys.has(transition.targetRetentionClass)
        )
    )
  ) {
    sendError(
      response,
      400,
      "invalid_workspace_evidence_retention_class_policy_payload",
      "Workspace class-policy overrides may only target tenant-defined hold reasons, retention classes, and transitions."
    );
    return;
  }

  const previousEvidenceRetentionClassPolicyOverride = flattenEvidenceRetentionClassPolicyOverrideRecords(
    workspace.evidenceRetentionClassPolicyOverrideRecords
  );
  const previousOverrideClassKeys = new Set(
    previousEvidenceRetentionClassPolicyOverride?.classEntries?.map(classEntry => classEntry.retentionClass) ?? []
  );
  const nextOverrideClassKeys = new Set(
    evidenceRetentionClassPolicyOverride?.classEntries?.map(classEntry => classEntry.retentionClass) ?? []
  );
  const changedEvidenceRetentionClassPolicyFields = [
    ...(typeof evidenceRetentionClassPolicyOverride?.defaultCaptureRetentionClass === "string"
      ? ["defaultCaptureRetentionClass"]
      : []),
    ...Array.from(nextOverrideClassKeys)
      .sort((left, right) => left.localeCompare(right))
      .map(classKey => `classEntries.${classKey}`)
  ];
  const clearedEvidenceRetentionClassPolicyFields = [
    ...(previousEvidenceRetentionClassPolicyOverride?.defaultCaptureRetentionClass &&
    typeof evidenceRetentionClassPolicyOverride?.defaultCaptureRetentionClass !== "string"
      ? ["defaultCaptureRetentionClass"]
      : []),
    ...Array.from(previousOverrideClassKeys)
      .filter(classKey => !nextOverrideClassKeys.has(classKey))
      .sort((left, right) => left.localeCompare(right))
      .map(classKey => `classEntries.${classKey}`)
  ];
  const evidenceRetentionClassPolicyOverrideRecords = evidenceRetentionClassPolicyOverride
    ? createEvidenceRetentionClassPolicyOverrideRecords({
        override: evidenceRetentionClassPolicyOverride,
        updatedByRequestId: requestContext.requestId,
        updatedByActorType: "platform_api",
        updatedByActorId: "platform-api"
      })
    : null;

  const updatedWorkspace: Workspace = {
    ...workspace,
    evidenceRetentionClassPolicyOverrideRecords
  };

  await store.saveWorkspace(updatedWorkspace);
  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: updatedWorkspace.tenantId,
    workspaceId: updatedWorkspace.workspaceId,
    actorType: "platform_api",
    actorId: "platform-api",
    eventType: "workspace.evidence_retention_class_policy.updated",
    payload: {
      workspaceKey: updatedWorkspace.workspaceKey,
      mode: body.mode,
      defaultEvidenceRetentionClassPolicy: tenant.defaultEvidenceRetentionClassPolicy,
      evidenceRetentionClassPolicyOverride,
      evidenceRetentionClassPolicyOverrideRecords: toEvidenceRetentionClassPolicyOverrideRecordsDto(
        updatedWorkspace.evidenceRetentionClassPolicyOverrideRecords
      ),
      changedFields: changedEvidenceRetentionClassPolicyFields,
      clearedFields: clearedEvidenceRetentionClassPolicyFields,
      effectiveEvidenceRetentionClassPolicy: resolveWorkspaceEvidenceRetentionClassPolicy(
        updatedWorkspace,
        tenant
      )
    }
  });

  sendJson<WorkspaceEvidenceRetentionClassPolicyResponse>(
    response,
    200,
    toWorkspaceEvidenceRetentionClassPolicyResponse(tenant, updatedWorkspace)
  );
};

const handleWorkspacePolicyHistoryGet = async (
  store: PlatformStore,
  response: ServerResponse,
  url: URL,
  tenantKey: string,
  workspaceKey: string
): Promise<void> => {
  const workspace = await store.getWorkspaceByKey(tenantKey, workspaceKey);

  if (!workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit ? Number.parseInt(rawLimit, 10) : 50;

  if (!Number.isInteger(limit) || limit <= 0 || limit > 200) {
    sendError(response, 400, "invalid_policy_history_limit", "limit must be an integer between 1 and 200.");
    return;
  }

  sendJson<PolicyHistoryResponse>(response, 200, {
    items: (
      await store.listAuditEventsByWorkspace(tenantKey, workspaceKey, {
        limit,
        eventTypes: [...workspacePolicyAuditEventTypes]
      })
    )
      .flatMap(auditEvent => {
        const historyEntry = toPolicyHistoryEntryDto(auditEvent, {
          tenantKey,
          workspaceKey
        });

        return historyEntry ? [historyEntry] : [];
      })
  });
};

const handleWorkspaceSystemCheckResultsGet = async (
  store: PlatformStore,
  response: ServerResponse,
  url: URL,
  tenantKey: string,
  workspaceKey: string
): Promise<void> => {
  const workspace = await store.getWorkspaceByKey(tenantKey, workspaceKey);

  if (!workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const groupKey = getTrimmedString(url.searchParams.get("groupKey")) ?? null;
  const rawStatus = getTrimmedString(url.searchParams.get("status"));
  const status = rawStatus ?? null;
  const rawReviewStatus = getTrimmedString(url.searchParams.get("reviewStatus"));
  const reviewStatus = rawReviewStatus ?? null;
  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit ? Number.parseInt(rawLimit, 10) : 50;

  if (status !== null && !isSystemCheckResultStatus(status)) {
    sendError(
      response,
      400,
      "invalid_system_check_status_filter",
      "status must be one of passed, warning, or failed."
    );
    return;
  }

  if (reviewStatus !== null && !isSystemCheckReviewStatus(reviewStatus)) {
    sendError(
      response,
      400,
      "invalid_system_check_review_status_filter",
      "reviewStatus must be one of pending, accepted, needs_follow_up, or rejected."
    );
    return;
  }

  if (!Number.isInteger(limit) || limit <= 0 || limit > 200) {
    sendError(response, 400, "invalid_system_check_result_limit", "limit must be an integer between 1 and 200.");
    return;
  }

  const submissions = await store.listSystemCheckSubmissionsByWorkspace(tenantKey, workspaceKey, {
    groupKey: groupKey ?? undefined,
    status: status ?? undefined,
    reviewStatus: reviewStatus ?? undefined,
    limit
  });

  const uniqueContentReleaseIds = [...new Set(submissions.map(submission => submission.contentReleaseId))];
  const contentReleaseEntries = await Promise.all(
    uniqueContentReleaseIds.map(async contentReleaseId => [
      contentReleaseId,
      await store.getContentReleaseById(contentReleaseId)
    ] as const)
  );
  const contentReleaseById = new Map(contentReleaseEntries);
  const evidenceByKey = await loadSystemCheckEvidenceMap(
    store,
    submissions.map(submission => submission.checkResults)
  );

  sendJson<WorkspaceSystemCheckResultsResponse>(response, 200, {
    items: submissions.map(submission => {
      const contentRelease = contentReleaseById.get(submission.contentReleaseId);

      return toSystemCheckSubmissionDto(submission, {
        systemCheckTitle: contentRelease
          ? getSystemCheckDefinition(contentRelease, submission.systemCheckKey)?.title ?? null
          : null,
        evidenceByKey
      });
    }),
    filters: {
      groupKey,
      status,
      reviewStatus
    }
  });
};

const handleWorkspaceSystemCheckReadinessGet = async (
  store: PlatformStore,
  response: ServerResponse,
  url: URL,
  tenantKey: string,
  workspaceKey: string
): Promise<void> => {
  const workspace = await store.getWorkspaceByKey(tenantKey, workspaceKey);

  if (!workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const groupKey = getTrimmedString(url.searchParams.get("groupKey")) ?? null;
  const rawReadinessStatus = getTrimmedString(url.searchParams.get("readinessStatus"));
  const readinessStatus = rawReadinessStatus ?? null;
  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit ? Number.parseInt(rawLimit, 10) : 50;

  if (readinessStatus !== null && !isSystemCheckLaunchReadinessStatus(readinessStatus)) {
    sendError(
      response,
      400,
      "invalid_system_check_readiness_filter",
      "readinessStatus must be one of ready, warning, or blocked."
    );
    return;
  }

  if (!Number.isInteger(limit) || limit <= 0 || limit > 200) {
    sendError(response, 400, "invalid_system_check_readiness_limit", "limit must be an integer between 1 and 200.");
    return;
  }

  const participantSessions = await store.listParticipantSessionsByWorkspace(tenantKey, workspaceKey, {
    groupKey: groupKey ?? undefined,
    limit
  });
  const readinessItems = await Promise.all(
    participantSessions.map(async participantSession => {
      const resolvedSystemCheckState = await resolveParticipantSystemCheckState(store, participantSession);

      if (!resolvedSystemCheckState) {
        return null;
      }

      return {
        participantSessionId: participantSession.participantSessionId,
        contentReleaseId: participantSession.contentReleaseId,
        loginKey: participantSession.loginKey,
        groupKey: participantSession.groupKey,
        releaseLabel: resolvedSystemCheckState.contentRelease.releaseLabel,
        readiness: resolvedSystemCheckState.systemCheckReadiness
      };
    })
  );
  const items = readinessItems
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .filter(item => readinessStatus === null || item.readiness.status === readinessStatus);

  sendJson<WorkspaceSystemCheckReadinessResponse>(response, 200, {
    items,
    filters: {
      groupKey,
      readinessStatus
    }
  });
};

const handleWorkspaceSystemCheckEvidenceHoldQueueGet = async (
  store: PlatformStore,
  response: ServerResponse,
  url: URL,
  tenantKey: string,
  workspaceKey: string
): Promise<void> => {
  const workspace = await store.getWorkspaceByKey(tenantKey, workspaceKey);

  if (!workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const groupKey = getTrimmedString(url.searchParams.get("groupKey")) ?? null;
  const holdReasonCode = getTrimmedString(url.searchParams.get("holdReasonCode")) ?? null;
  const rawAcknowledgementStatus = getTrimmedString(url.searchParams.get("acknowledgementStatus"));
  const acknowledgementStatus = rawAcknowledgementStatus ?? null;
  const rawAssignmentStatus = getTrimmedString(url.searchParams.get("assignmentStatus"));
  const assignmentStatus = rawAssignmentStatus ?? null;
  const rawEscalationStatus = getTrimmedString(url.searchParams.get("escalationStatus"));
  const escalationStatus = rawEscalationStatus ?? null;
  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit ? Number.parseInt(rawLimit, 10) : 50;

  if (
    acknowledgementStatus !== null &&
    !isSystemCheckEvidenceHoldAcknowledgementStatus(acknowledgementStatus)
  ) {
    sendError(
      response,
      400,
      "invalid_system_check_evidence_hold_acknowledgement_status_filter",
      "acknowledgementStatus must be one of not_required, pending, or acknowledged."
    );
    return;
  }

  if (assignmentStatus !== null && !isSystemCheckEvidenceHoldAssignmentStatus(assignmentStatus)) {
    sendError(
      response,
      400,
      "invalid_system_check_evidence_hold_assignment_status_filter",
      "assignmentStatus must be one of unassigned or assigned."
    );
    return;
  }

  if (escalationStatus !== null && !isSystemCheckEvidenceHoldEscalationStatus(escalationStatus)) {
    sendError(
      response,
      400,
      "invalid_system_check_evidence_hold_escalation_status_filter",
      "escalationStatus must be one of not_applicable, pending, breached, acknowledged, or escalated."
    );
    return;
  }

  if (!Number.isInteger(limit) || limit <= 0 || limit > 200) {
    sendError(
      response,
      400,
      "invalid_system_check_evidence_hold_queue_limit",
      "limit must be an integer between 1 and 200."
    );
    return;
  }

  const heldEvidenceItems = await store.listSystemCheckEvidenceByWorkspace(tenantKey, workspaceKey, {
    groupKey: groupKey ?? undefined,
    heldOnly: true,
    limit: 200
  });
  const items = heldEvidenceItems
    .filter(systemCheckEvidence => {
      const hold = systemCheckEvidence.retentionHold;

      if (!hold) {
        return false;
      }

      if (holdReasonCode !== null && hold.holdReasonCode !== holdReasonCode) {
        return false;
      }

      if (
        acknowledgementStatus !== null &&
        getSystemCheckEvidenceHoldAcknowledgementStatus(hold) !== acknowledgementStatus
      ) {
        return false;
      }

      if (
        assignmentStatus !== null &&
        getSystemCheckEvidenceHoldAssignmentStatus(hold) !== assignmentStatus
      ) {
        return false;
      }

      if (
        escalationStatus !== null &&
        getSystemCheckEvidenceHoldEscalationStatus(hold) !== escalationStatus
      ) {
        return false;
      }

      return true;
    })
    .slice(0, limit)
    .map(toWorkspaceSystemCheckEvidenceHoldQueueItemDto);

  sendJson<WorkspaceSystemCheckEvidenceHoldQueueResponse>(response, 200, {
    items,
    filters: {
      groupKey,
      holdReasonCode,
      acknowledgementStatus,
      assignmentStatus,
      escalationStatus
    }
  });
};

const handleWorkspaceSystemCheckEvidenceBreachQueueGet = async (
  store: PlatformStore,
  response: ServerResponse,
  url: URL,
  tenantKey: string,
  workspaceKey: string
): Promise<void> => {
  const workspace = await store.getWorkspaceByKey(tenantKey, workspaceKey);

  if (!workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const groupKey = getTrimmedString(url.searchParams.get("groupKey")) ?? null;
  const escalationTarget = getTrimmedString(url.searchParams.get("escalationTarget")) ?? null;
  const assignedToActorId = getTrimmedString(url.searchParams.get("assignedToActorId")) ?? null;
  const rawBreachQueueStatus = getTrimmedString(url.searchParams.get("breachQueueStatus"));
  const breachQueueStatus = rawBreachQueueStatus ?? null;
  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit ? Number.parseInt(rawLimit, 10) : 50;

  if (breachQueueStatus !== null && !isSystemCheckEvidenceBreachQueueStatus(breachQueueStatus)) {
    sendError(
      response,
      400,
      "invalid_system_check_evidence_breach_queue_status_filter",
      "breachQueueStatus must be one of pending_breach, breached, acknowledged, or escalated."
    );
    return;
  }

  if (!Number.isInteger(limit) || limit <= 0 || limit > 200) {
    sendError(
      response,
      400,
      "invalid_system_check_evidence_breach_queue_limit",
      "limit must be an integer between 1 and 200."
    );
    return;
  }

  const heldEvidenceItems = await store.listSystemCheckEvidenceByWorkspace(tenantKey, workspaceKey, {
    groupKey: groupKey ?? undefined,
    heldOnly: true,
    limit: 200
  });
  const items = heldEvidenceItems
    .map(systemCheckEvidence => {
      const hold = systemCheckEvidence.retentionHold;

      if (!hold) {
        return null;
      }

      const derivedBreachQueueStatus = getSystemCheckEvidenceBreachQueueStatus(hold);

      if (!derivedBreachQueueStatus) {
        return null;
      }

      if (escalationTarget !== null && hold.escalationTarget !== escalationTarget) {
        return null;
      }

      if (assignedToActorId !== null && hold.assignedToActorId !== assignedToActorId) {
        return null;
      }

      if (breachQueueStatus !== null && derivedBreachQueueStatus !== breachQueueStatus) {
        return null;
      }

      return toWorkspaceSystemCheckEvidenceBreachQueueItemDto(
        systemCheckEvidence,
        derivedBreachQueueStatus
      );
    })
    .filter((item): item is WorkspaceSystemCheckEvidenceBreachQueueItemDto => Boolean(item))
    .slice(0, limit);

  sendJson<WorkspaceSystemCheckEvidenceBreachQueueResponse>(response, 200, {
    items,
    filters: {
      groupKey,
      escalationTarget,
      breachQueueStatus,
      assignedToActorId
    }
  });
};

const handleWorkspaceSystemCheckEvidenceBreachNotificationsGet = async (
  store: PlatformStore,
  response: ServerResponse,
  url: URL,
  tenantKey: string,
  workspaceKey: string
): Promise<void> => {
  const workspace = await store.getWorkspaceByKey(tenantKey, workspaceKey);

  if (!workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const groupKey = getTrimmedString(url.searchParams.get("groupKey")) ?? null;
  const escalationTarget = getTrimmedString(url.searchParams.get("escalationTarget")) ?? null;
  const assignedToActorId = getTrimmedString(url.searchParams.get("assignedToActorId")) ?? null;
  const rawStatus = getTrimmedString(url.searchParams.get("status"));
  const status = rawStatus ?? null;
  const rawDeliveryStatus = getTrimmedString(url.searchParams.get("deliveryStatus"));
  const deliveryStatus = rawDeliveryStatus ?? null;
  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit ? Number.parseInt(rawLimit, 10) : 50;

  if (status !== null && !isSystemCheckEvidenceBreachNotificationStatus(status)) {
    sendError(
      response,
      400,
      "invalid_system_check_evidence_breach_notification_status_filter",
      "status must be one of pending_acknowledgement or acknowledged."
    );
    return;
  }

  if (
    deliveryStatus !== null &&
    !isSystemCheckEvidenceBreachNotificationDeliveryStatus(deliveryStatus)
  ) {
    sendError(
      response,
      400,
      "invalid_system_check_evidence_breach_notification_delivery_status_filter",
      "deliveryStatus must be one of pending_delivery, delivered, or delivery_failed."
    );
    return;
  }

  if (!Number.isInteger(limit) || limit <= 0 || limit > 200) {
    sendError(
      response,
      400,
      "invalid_system_check_evidence_breach_notification_limit",
      "limit must be an integer between 1 and 200."
    );
    return;
  }

  const notifications = await store.listSystemCheckEvidenceBreachNotificationsByWorkspace(
    tenantKey,
    workspaceKey,
    {
      groupKey: groupKey ?? undefined,
      escalationTarget: escalationTarget ?? undefined,
      assignedToActorId: assignedToActorId ?? undefined,
      status: status ?? undefined,
      deliveryStatus: deliveryStatus ?? undefined,
      limit
    }
  );
  const evidenceByKey = new Map(
    (await store.listSystemCheckEvidenceByKeys(notifications.map(notification => notification.evidenceKey)))
      .map(systemCheckEvidence => [systemCheckEvidence.evidenceKey, systemCheckEvidence] as const)
  );
  const items = notifications.flatMap(notification => {
    const systemCheckEvidence = evidenceByKey.get(notification.evidenceKey);

    if (!systemCheckEvidence) {
      return [];
    }

    return [toSystemCheckEvidenceBreachNotificationDto({
      notification,
      systemCheckEvidence
    })];
  });

  sendJson<WorkspaceSystemCheckEvidenceBreachNotificationsResponse>(response, 200, {
    items,
    filters: {
      groupKey,
      escalationTarget,
      status,
      deliveryStatus,
      assignedToActorId
    }
  });
};

const handleWorkspaceSystemCheckEvidenceBreachDeadLetterQueueGet = async (
  store: PlatformStore,
  response: ServerResponse,
  url: URL,
  tenantKey: string,
  workspaceKey: string
): Promise<void> => {
  const workspace = await store.getWorkspaceByKey(tenantKey, workspaceKey);

  if (!workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const groupKey = getTrimmedString(url.searchParams.get("groupKey")) ?? null;
  const escalationTarget = getTrimmedString(url.searchParams.get("escalationTarget")) ?? null;
  const assignedToActorId = getTrimmedString(url.searchParams.get("assignedToActorId")) ?? null;
  const rawStatus = getTrimmedString(url.searchParams.get("status"));
  const status = rawStatus ?? null;
  const rawDeliveryChannel = getTrimmedString(url.searchParams.get("deliveryChannel"));
  const deliveryChannel = rawDeliveryChannel ?? null;
  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit ? Number.parseInt(rawLimit, 10) : 50;

  if (status !== null && !isSystemCheckEvidenceBreachNotificationStatus(status)) {
    sendError(
      response,
      400,
      "invalid_system_check_evidence_breach_notification_status_filter",
      "status must be one of pending_acknowledgement or acknowledged."
    );
    return;
  }

  if (
    deliveryChannel !== null &&
    !isSystemCheckEvidenceBreachNotificationDeliveryChannel(deliveryChannel)
  ) {
    sendError(
      response,
      400,
      "invalid_system_check_evidence_breach_notification_delivery_channel_filter",
      "deliveryChannel must be one of webhook_spike or email_spike."
    );
    return;
  }

  if (!Number.isInteger(limit) || limit <= 0 || limit > 200) {
    sendError(
      response,
      400,
      "invalid_system_check_evidence_breach_dead_letter_limit",
      "limit must be an integer between 1 and 200."
    );
    return;
  }

  const notifications = await store.listSystemCheckEvidenceBreachNotificationsByWorkspace(
    tenantKey,
    workspaceKey,
    {
      groupKey: groupKey ?? undefined,
      escalationTarget: escalationTarget ?? undefined,
      assignedToActorId: assignedToActorId ?? undefined,
      status: status ?? undefined,
      deliveryChannel: deliveryChannel ?? undefined,
      deliveryStatus: "delivery_failed",
      limit
    }
  );
  const evidenceByKey = new Map(
    (await store.listSystemCheckEvidenceByKeys(notifications.map(notification => notification.evidenceKey)))
      .map(systemCheckEvidence => [systemCheckEvidence.evidenceKey, systemCheckEvidence] as const)
  );
  const items = notifications.flatMap(notification => {
    const systemCheckEvidence = evidenceByKey.get(notification.evidenceKey);

    if (!systemCheckEvidence) {
      return [];
    }

    return [toSystemCheckEvidenceBreachNotificationDto({
      notification,
      systemCheckEvidence
    })];
  });

  sendJson<WorkspaceSystemCheckEvidenceBreachDeadLetterQueueResponse>(response, 200, {
    items,
    filters: {
      groupKey,
      escalationTarget,
      status,
      deliveryChannel,
      assignedToActorId
    }
  });
};

const handleWorkspaceSystemCheckLaunchApprovalsGet = async (
  store: PlatformStore,
  response: ServerResponse,
  url: URL,
  tenantKey: string,
  workspaceKey: string,
  requestContext: RequestContext
): Promise<void> => {
  if (!(await store.getWorkspaceByKey(tenantKey, workspaceKey))) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const participantSessionId = getTrimmedString(url.searchParams.get("participantSessionId")) ?? null;
  const assignmentKey = getTrimmedString(url.searchParams.get("assignmentKey")) ?? null;
  const rawStatus = getTrimmedString(url.searchParams.get("status"));
  const rawApprovalScope = getTrimmedString(url.searchParams.get("approvalScope"));
  const status = rawStatus ?? null;
  const approvalScope = rawApprovalScope ?? null;
  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit ? Number.parseInt(rawLimit, 10) : 50;

  if (status !== null && !isSystemCheckLaunchApprovalStatus(status)) {
    sendError(
      response,
      400,
      "invalid_system_check_launch_approval_status_filter",
      "status must be one of active, consumed, revoked, invalidated, or expired."
    );
    return;
  }

  if (approvalScope !== null && !isSystemCheckLaunchApprovalScope(approvalScope)) {
    sendError(
      response,
      400,
      "invalid_system_check_launch_approval_scope_filter",
      "approvalScope must be one of single_launch or session_assignment."
    );
    return;
  }

  if (!Number.isInteger(limit) || limit <= 0 || limit > 200) {
    sendError(
      response,
      400,
      "invalid_system_check_launch_approval_limit",
      "limit must be an integer between 1 and 200."
    );
    return;
  }

  await synchronizeExpiredSystemCheckLaunchApprovalsByWorkspace({
    store,
    tenantKey,
    workspaceKey,
    requestContext
  });

  const approvals = await store.listSystemCheckLaunchApprovalsByWorkspace(tenantKey, workspaceKey, {
    participantSessionId: participantSessionId ?? undefined,
    assignmentKey: assignmentKey ?? undefined,
    status: status ?? undefined,
    approvalScope: approvalScope ?? undefined,
    limit
  });

  sendJson<WorkspaceSystemCheckLaunchApprovalsResponse>(response, 200, {
    items: approvals.map(toSystemCheckLaunchApprovalDto),
    filters: {
      participantSessionId,
      assignmentKey,
      status,
      approvalScope
    }
  });
};

const handleWorkspaceSystemCheckLaunchApprovalsPost = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string,
  requestContext: RequestContext
): Promise<void> => {
  const workspace = await store.getWorkspaceByKey(tenantKey, workspaceKey);

  if (!workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const body = await readBody<CreateSystemCheckLaunchApprovalRequest>(request);
  const participantSessionId = getTrimmedString(body.participantSessionId);
  const assignmentKey = getTrimmedString(body.assignmentKey);
  const approvedBySupervisorId = getTrimmedString(body.approvedBySupervisorId);
  const approvalNote = getTrimmedString(body.approvalNote);
  const expiresAt = body.expiresAt === null ? null : parseOptionalIsoTimestamp(body.expiresAt);
  const approvalScope = body.approvalScope;

  if (!participantSessionId || !assignmentKey || !approvedBySupervisorId || !approvalNote || !isSystemCheckLaunchApprovalScope(approvalScope)) {
    sendError(
      response,
      400,
      "invalid_system_check_launch_approval_payload",
      "participantSessionId, assignmentKey, approvedBySupervisorId, approvalNote, and a valid approvalScope are required."
    );
    return;
  }

  if (body.expiresAt !== undefined && body.expiresAt !== null && !expiresAt) {
    sendError(
      response,
      400,
      "invalid_system_check_launch_approval_expiry",
      "expiresAt must be a valid ISO-8601 timestamp when provided."
    );
    return;
  }

  if (expiresAt && Date.parse(expiresAt) <= Date.now()) {
    sendError(
      response,
      400,
      "invalid_system_check_launch_approval_expiry",
      "expiresAt must be in the future when provided."
    );
    return;
  }

  const participantSession = await store.getParticipantSessionById(participantSessionId);

  if (
    !participantSession ||
    participantSession.tenantId !== workspace.tenantId ||
    participantSession.workspaceId !== workspace.workspaceId
  ) {
    sendError(
      response,
      404,
      "participant_session_not_found",
      `Participant session '${participantSessionId}' was not found in workspace '${workspaceKey}'.`
    );
    return;
  }

  const resolvedSystemCheckState = await resolveParticipantSystemCheckState(store, participantSession);

  if (!resolvedSystemCheckState) {
    sendError(
      response,
      409,
      "participant_system_check_context_unavailable",
      "The participant system-check context could not be resolved."
    );
    return;
  }

  const starterContext = resolveParticipantStarterContext(
    resolvedSystemCheckState.contentRelease,
    participantSession.loginKey
  );

  if (!starterContext?.assignments.find(assignment => assignment.assignmentKey === assignmentKey)) {
    sendError(
      response,
      404,
      "starter_assignment_not_found",
      `Assignment '${assignmentKey}' is not available for participant session '${participantSessionId}'.`
    );
    return;
  }

  if (resolvedSystemCheckState.systemCheckReadiness.status !== "warning") {
    sendError(
      response,
      409,
      "system_check_launch_approval_not_applicable",
      "Launch approvals can only be created when the participant session is in warning-level system-check readiness.",
      {
        systemCheckReadiness: resolvedSystemCheckState.systemCheckReadiness
      }
    );
    return;
  }

  const tenant = await store.getTenantById(participantSession.tenantId);

  if (!tenant) {
    sendError(
      response,
      409,
      "tenant_not_found",
      `Tenant '${tenantKey}' could not be resolved for workspace '${workspaceKey}'.`
    );
    return;
  }

  const effectiveLaunchApprovalPolicy = resolveWorkspaceLaunchApprovalPolicy(workspace, tenant);
  const approvedAt = new Date().toISOString();
  const effectiveExpiresAt = expiresAt ??
    (
      effectiveLaunchApprovalPolicy.systemCheckLaunchApprovalTtlSeconds > 0
        ? new Date(
            Date.parse(approvedAt) + effectiveLaunchApprovalPolicy.systemCheckLaunchApprovalTtlSeconds * 1000
          ).toISOString()
        : null
    );

  const launchApproval = createSystemCheckLaunchApproval({
    participantSessionId: participantSession.participantSessionId,
    tenantId: participantSession.tenantId,
    workspaceId: participantSession.workspaceId,
    contentReleaseId: participantSession.contentReleaseId,
    loginKey: participantSession.loginKey,
    groupKey: participantSession.groupKey,
    assignmentKey,
    warningReasonCodes: resolvedSystemCheckState.systemCheckReadiness.warningReasonCodes,
    approvalScope,
    approvedBySupervisorId,
    approvalNote,
    expiresAt: effectiveExpiresAt,
    approvedAt
  });

  await store.saveSystemCheckLaunchApproval(launchApproval);
  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: launchApproval.tenantId,
    workspaceId: launchApproval.workspaceId,
    participantSessionId: launchApproval.participantSessionId,
    loginKey: launchApproval.loginKey,
    groupKey: launchApproval.groupKey,
    assignmentKey: launchApproval.assignmentKey,
    actorType: "platform_api",
    actorId: launchApproval.approvedBySupervisorId,
    eventType: "workspace.system_check.launch_approval.created",
    payload: {
      launchApprovalId: launchApproval.launchApprovalId,
      approvalScope: launchApproval.approvalScope,
      readinessStatus: launchApproval.readinessStatus,
      warningReasonCodes: launchApproval.warningReasonCodes,
      approvalNote: launchApproval.approvalNote,
      expiresAt: launchApproval.expiresAt,
      launchApprovalPolicyTtlSeconds: effectiveLaunchApprovalPolicy.systemCheckLaunchApprovalTtlSeconds
    }
  });

  sendJson<CreateSystemCheckLaunchApprovalResponse>(response, 201, {
    approval: toSystemCheckLaunchApprovalDto(launchApproval)
  });
};

const handleWorkspaceSystemCheckLaunchApprovalRevoke = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string,
  launchApprovalId: string,
  requestContext: RequestContext
): Promise<void> => {
  const resolvedLaunchApproval = await resolveWorkspaceScopedSystemCheckLaunchApproval(
    store,
    tenantKey,
    workspaceKey,
    launchApprovalId
  );

  if (!resolvedLaunchApproval) {
    sendError(
      response,
      404,
      "system_check_launch_approval_not_found",
      `System-check launch approval '${launchApprovalId}' was not found in workspace '${workspaceKey}'.`
    );
    return;
  }

  const currentLaunchApproval = await expireSystemCheckLaunchApprovalIfNeeded({
    store,
    launchApproval: resolvedLaunchApproval.launchApproval,
    requestContext,
    actorType: "platform_api",
    actorId: "platform-api"
  });

  if (currentLaunchApproval.status !== "active") {
    sendError(
      response,
      409,
      "system_check_launch_approval_not_active",
      `System-check launch approval '${launchApprovalId}' is no longer active.`,
      {
        status: currentLaunchApproval.status
      }
    );
    return;
  }

  const body = await readBody<RevokeSystemCheckLaunchApprovalRequest>(request);
  const revokedBySupervisorId = getTrimmedString(body.revokedBySupervisorId);
  const revocationNote = getTrimmedString(body.revocationNote);

  if (!revokedBySupervisorId || !revocationNote) {
    sendError(
      response,
      400,
      "invalid_system_check_launch_approval_revocation_payload",
      "revokedBySupervisorId and revocationNote are required."
    );
    return;
  }

  const revokedLaunchApproval = revokeSystemCheckLaunchApproval({
    launchApproval: currentLaunchApproval,
    revokedBySupervisorId,
    revocationNote
  });

  await store.updateSystemCheckLaunchApproval(revokedLaunchApproval);
  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: revokedLaunchApproval.tenantId,
    workspaceId: revokedLaunchApproval.workspaceId,
    participantSessionId: revokedLaunchApproval.participantSessionId,
    loginKey: revokedLaunchApproval.loginKey,
    groupKey: revokedLaunchApproval.groupKey,
    assignmentKey: revokedLaunchApproval.assignmentKey,
    actorType: "platform_api",
    actorId: revokedBySupervisorId,
    eventType: "workspace.system_check.launch_approval.revoked",
    payload: {
      launchApprovalId: revokedLaunchApproval.launchApprovalId,
      approvalScope: revokedLaunchApproval.approvalScope,
      readinessStatus: revokedLaunchApproval.readinessStatus,
      warningReasonCodes: revokedLaunchApproval.warningReasonCodes,
      revocationNote: revokedLaunchApproval.revocationNote
    }
  });

  sendJson<RevokeSystemCheckLaunchApprovalResponse>(response, 200, {
    approval: toSystemCheckLaunchApprovalDto(revokedLaunchApproval)
  });
};

const handleWorkspaceSystemCheckResultReview = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string,
  systemCheckSubmissionId: string,
  requestContext: RequestContext
): Promise<void> => {
  const resolvedSubmission = await resolveWorkspaceScopedSystemCheckSubmission(
    store,
    tenantKey,
    workspaceKey,
    systemCheckSubmissionId
  );

  if (!resolvedSubmission) {
    sendError(
      response,
      404,
      "system_check_submission_not_found",
      `System-check submission '${systemCheckSubmissionId}' was not found in workspace '${workspaceKey}'.`
    );
    return;
  }

  const body = await readBody<ReviewSystemCheckSubmissionRequest>(request);
  const reviewNote = getTrimmedString(body.reviewNote) ?? null;

  if (!isSystemCheckReviewDecisionStatus(body.reviewStatus)) {
    sendError(
      response,
      400,
      "invalid_system_check_review_payload",
      "reviewStatus must be one of accepted, needs_follow_up, or rejected."
    );
    return;
  }

  const reviewedSubmission = reviewSystemCheckSubmission({
    submission: resolvedSubmission.systemCheckSubmission,
    reviewStatus: body.reviewStatus,
    reviewNote,
    reviewedByActorType: "platform_api",
    reviewedByActorId: "platform-api"
  });

  await store.updateSystemCheckSubmissionReview(reviewedSubmission);
  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: reviewedSubmission.tenantId,
    workspaceId: reviewedSubmission.workspaceId,
    participantSessionId: reviewedSubmission.participantSessionId,
    loginKey: reviewedSubmission.loginKey,
    groupKey: reviewedSubmission.groupKey,
    actorType: "platform_api",
    actorId: "platform-api",
    eventType: "workspace.system_check.reviewed",
    payload: {
      systemCheckSubmissionId: reviewedSubmission.systemCheckSubmissionId,
      contentReleaseId: reviewedSubmission.contentReleaseId,
      systemCheckKey: reviewedSubmission.systemCheckKey,
      reviewStatus: reviewedSubmission.reviewStatus,
      reviewNote: reviewedSubmission.reviewNote
    }
  });

  const reviewedSystemCheckState = await resolveParticipantSystemCheckState(store, reviewedSubmission);

  if (reviewedSystemCheckState) {
    await synchronizeSystemCheckLaunchApprovalsForParticipantSession({
      store,
      participantSession: reviewedSubmission,
      systemCheckReadiness: reviewedSystemCheckState.systemCheckReadiness,
      requestContext,
      actorType: "platform_api",
      actorId: "platform-api"
    });
  }

  const contentRelease = await store.getContentReleaseById(reviewedSubmission.contentReleaseId);
  const evidenceByKey = await loadSystemCheckEvidenceMap(store, [reviewedSubmission.checkResults]);

  sendJson<ReviewSystemCheckSubmissionResponse>(response, 200, {
    submission: toSystemCheckSubmissionDto(reviewedSubmission, {
      systemCheckTitle: contentRelease
        ? getSystemCheckDefinition(contentRelease, reviewedSubmission.systemCheckKey)?.title ?? null
        : null,
      evidenceByKey
    })
  });
};

const handleWorkspaceSystemCheckEvidenceHold = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string,
  evidenceKey: string,
  requestContext: RequestContext
): Promise<void> => {
  const resolvedEvidence = await resolveWorkspaceScopedSystemCheckEvidence(
    store,
    tenantKey,
    workspaceKey,
    evidenceKey
  );

  if (!resolvedEvidence) {
    sendError(
      response,
      404,
      "system_check_evidence_not_found",
      `System-check evidence '${evidenceKey}' was not found in workspace '${workspaceKey}'.`
    );
    return;
  }

  const body = await readBody<HoldSystemCheckEvidenceRequest>(request);
  const heldByActorId = getTrimmedString(body.heldByActorId);
  const holdNote = getTrimmedString(body.holdNote);
  const holdReasonCode = getTrimmedString(body.holdReasonCode);

  if (!heldByActorId || !holdNote || !holdReasonCode) {
    sendError(
      response,
      400,
      "invalid_system_check_evidence_hold_payload",
      "heldByActorId, holdNote, and holdReasonCode are required."
    );
    return;
  }

  if (resolvedEvidence.systemCheckEvidence.purgedAt) {
    sendError(
      response,
      409,
      "system_check_evidence_already_purged",
      `System-check evidence '${evidenceKey}' payload has already been purged.`
    );
    return;
  }

  if (isSystemCheckEvidenceHeld(resolvedEvidence.systemCheckEvidence)) {
    sendError(
      response,
      409,
      "system_check_evidence_already_held",
      `System-check evidence '${evidenceKey}' is already under a retention hold.`
    );
    return;
  }

  const tenant = await store.getTenantById(resolvedEvidence.workspace.tenantId);

  if (!tenant) {
    sendError(
      response,
      500,
      "tenant_not_found",
      `Tenant for workspace '${workspaceKey}' could not be resolved.`
    );
    return;
  }

  const effectiveEvidenceRetentionPolicy = resolveWorkspaceEvidenceRetentionPolicy(
    resolvedEvidence.workspace,
    tenant
  );
  const effectiveEvidenceRetentionClassPolicy = resolveWorkspaceEvidenceRetentionClassPolicy(
    resolvedEvidence.workspace,
    tenant
  );
  const holdReasonDefinition =
    effectiveEvidenceRetentionClassPolicy.holdReasons.find(
      holdReason => holdReason.holdReasonCode === holdReasonCode
    ) ?? null;

  if (!holdReasonDefinition) {
    sendError(
      response,
      400,
      "invalid_system_check_evidence_hold_reason",
      `Hold reason '${holdReasonCode}' is not allowed by the effective evidence-retention class policy.`
    );
    return;
  }

  const targetRetentionRule = resolveSystemCheckEvidenceHoldTargetRule({
    policy: effectiveEvidenceRetentionPolicy,
    classPolicy: effectiveEvidenceRetentionClassPolicy,
    currentRetentionClass: resolvedEvidence.systemCheckEvidence.retentionClass,
    holdReasonCode
  });
  const heldAt = new Date().toISOString();
  const heldEvidence = applySystemCheckEvidenceRetentionHold({
    systemCheckEvidence: resolvedEvidence.systemCheckEvidence,
    holdReasonCode,
    holdNote,
    heldByActorType: "platform_api",
    heldByActorId,
    acknowledgementRequired: holdReasonDefinition.acknowledgementRequired,
    defaultAssigneeTarget: holdReasonDefinition.defaultAssigneeTarget,
    slaSeconds: holdReasonDefinition.slaSeconds,
    slaDueAt: resolveSystemCheckEvidenceHoldSlaDueAt(heldAt, holdReasonDefinition.slaSeconds),
    escalationTarget: holdReasonDefinition.escalationTarget,
    retentionClass: targetRetentionRule.retentionClass,
    retentionPolicyKey: targetRetentionRule.retentionPolicyKey,
    retentionExpiresAt:
      targetRetentionRule.retentionClass !== resolvedEvidence.systemCheckEvidence.retentionClass
        ? resolveSystemCheckEvidenceRetentionExpiresAt(
            resolvedEvidence.workspace,
            tenant,
            targetRetentionRule.retentionClass,
            heldAt
          )
        : resolvedEvidence.systemCheckEvidence.retentionExpiresAt,
    heldAt
  });

  await store.updateSystemCheckEvidence(heldEvidence);
  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: heldEvidence.tenantId,
    workspaceId: heldEvidence.workspaceId,
    participantSessionId: heldEvidence.participantSessionId,
    loginKey: heldEvidence.loginKey,
    groupKey: heldEvidence.groupKey,
    actorType: "platform_api",
    actorId: heldByActorId,
    eventType: "workspace.system_check.evidence_hold.applied",
    payload: {
      evidenceKey: heldEvidence.evidenceKey,
      systemCheckKey: heldEvidence.systemCheckKey,
      checkKey: heldEvidence.checkKey,
      retentionClass: heldEvidence.retentionClass,
      retentionPolicyKey: heldEvidence.retentionPolicyKey,
      retentionExpiresAt: heldEvidence.retentionExpiresAt,
      ...toSystemCheckEvidenceHoldAuditPayload(heldEvidence.retentionHold)
    }
  });

  sendJson<HoldSystemCheckEvidenceResponse>(response, 200, {
    evidence: toSystemCheckEvidenceDetailDto(heldEvidence)
  });
};

const handleWorkspaceSystemCheckEvidenceAcknowledgeHold = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string,
  evidenceKey: string,
  requestContext: RequestContext
): Promise<void> => {
  const resolvedEvidence = await resolveWorkspaceScopedSystemCheckEvidence(
    store,
    tenantKey,
    workspaceKey,
    evidenceKey
  );

  if (!resolvedEvidence) {
    sendError(
      response,
      404,
      "system_check_evidence_not_found",
      `System-check evidence '${evidenceKey}' was not found in workspace '${workspaceKey}'.`
    );
    return;
  }

  const currentEvidence = await synchronizeSystemCheckEvidenceHoldEscalationIfNeeded({
    store,
    workspace: resolvedEvidence.workspace,
    systemCheckEvidence: resolvedEvidence.systemCheckEvidence,
    requestContext
  });

  if (!currentEvidence.retentionHold) {
    sendError(
      response,
      409,
      "system_check_evidence_not_held",
      `System-check evidence '${evidenceKey}' does not currently have a retention hold.`
    );
    return;
  }

  if (!currentEvidence.retentionHold.acknowledgementRequired) {
    sendError(
      response,
      409,
      "system_check_evidence_hold_acknowledgement_not_required",
      `System-check evidence '${evidenceKey}' does not require hold acknowledgement.`
    );
    return;
  }

  if (currentEvidence.retentionHold.acknowledgedAt) {
    sendError(
      response,
      409,
      "system_check_evidence_hold_already_acknowledged",
      `System-check evidence '${evidenceKey}' hold has already been acknowledged.`
    );
    return;
  }

  const body = await readBody<AcknowledgeSystemCheckEvidenceHoldRequest>(request);
  const acknowledgedByActorId = getTrimmedString(body.acknowledgedByActorId);
  const acknowledgementNote = getTrimmedString(body.acknowledgementNote);

  if (!acknowledgedByActorId || !acknowledgementNote) {
    sendError(
      response,
      400,
      "invalid_system_check_evidence_acknowledge_hold_payload",
      "acknowledgedByActorId and acknowledgementNote are required."
    );
    return;
  }

  const acknowledgedEvidence = acknowledgeSystemCheckEvidenceRetentionHold({
    systemCheckEvidence: currentEvidence,
    acknowledgedByActorId,
    acknowledgementNote
  });

  await store.updateSystemCheckEvidence(acknowledgedEvidence);
  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: acknowledgedEvidence.tenantId,
    workspaceId: acknowledgedEvidence.workspaceId,
    participantSessionId: acknowledgedEvidence.participantSessionId,
    loginKey: acknowledgedEvidence.loginKey,
    groupKey: acknowledgedEvidence.groupKey,
    actorType: "platform_api",
    actorId: acknowledgedByActorId,
    eventType: "workspace.system_check.evidence_hold.acknowledged",
    payload: {
      evidenceKey: acknowledgedEvidence.evidenceKey,
      systemCheckKey: acknowledgedEvidence.systemCheckKey,
      checkKey: acknowledgedEvidence.checkKey,
      retentionClass: acknowledgedEvidence.retentionClass,
      retentionPolicyKey: acknowledgedEvidence.retentionPolicyKey,
      retentionExpiresAt: acknowledgedEvidence.retentionExpiresAt,
      ...toSystemCheckEvidenceHoldAuditPayload(acknowledgedEvidence.retentionHold)
    }
  });

  sendJson<AcknowledgeSystemCheckEvidenceHoldResponse>(response, 200, {
    evidence: toSystemCheckEvidenceDetailDto(acknowledgedEvidence)
  });
};

const handleWorkspaceSystemCheckEvidenceBreachNotificationAcknowledge = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string,
  notificationId: string,
  requestContext: RequestContext
): Promise<void> => {
  const workspace = await store.getWorkspaceByKey(tenantKey, workspaceKey);

  if (!workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const notification = await store.getSystemCheckEvidenceBreachNotificationById(notificationId);

  if (!notification || notification.tenantId !== workspace.tenantId || notification.workspaceId !== workspace.workspaceId) {
    sendError(
      response,
      404,
      "system_check_evidence_breach_notification_not_found",
      `System-check evidence breach notification '${notificationId}' was not found in workspace '${workspaceKey}'.`
    );
    return;
  }

  if (notification.status === "acknowledged") {
    sendError(
      response,
      409,
      "system_check_evidence_breach_notification_already_acknowledged",
      `System-check evidence breach notification '${notificationId}' has already been acknowledged.`
    );
    return;
  }

  const body = await readBody<AcknowledgeSystemCheckEvidenceBreachNotificationRequest>(request);
  const acknowledgedByActorId = getTrimmedString(body.acknowledgedByActorId);
  const acknowledgementNote = getTrimmedString(body.acknowledgementNote);

  if (!acknowledgedByActorId || !acknowledgementNote) {
    sendError(
      response,
      400,
      "invalid_system_check_evidence_breach_notification_acknowledge_payload",
      "acknowledgedByActorId and acknowledgementNote are required."
    );
    return;
  }

  const acknowledgedNotification = acknowledgeSystemCheckEvidenceBreachNotification({
    notification,
    acknowledgedByActorId,
    acknowledgementNote
  });
  await store.updateSystemCheckEvidenceBreachNotification(acknowledgedNotification);

  const systemCheckEvidence = await store.getSystemCheckEvidenceByKey(acknowledgedNotification.evidenceKey);

  if (!systemCheckEvidence) {
    sendError(
      response,
      404,
      "system_check_evidence_not_found",
      `System-check evidence '${acknowledgedNotification.evidenceKey}' could not be loaded for notification '${notificationId}'.`
    );
    return;
  }

  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: acknowledgedNotification.tenantId,
    workspaceId: acknowledgedNotification.workspaceId,
    participantSessionId: acknowledgedNotification.participantSessionId,
    loginKey: acknowledgedNotification.loginKey,
    groupKey: acknowledgedNotification.groupKey,
    actorType: "platform_api",
    actorId: acknowledgedByActorId,
    eventType: "workspace.system_check.evidence_breach_notification.acknowledged",
    payload: {
      notificationId: acknowledgedNotification.notificationId,
      evidenceKey: acknowledgedNotification.evidenceKey,
      systemCheckKey: acknowledgedNotification.systemCheckKey,
      checkKey: acknowledgedNotification.checkKey,
      holdReasonCode: acknowledgedNotification.holdReasonCode,
      escalationTarget: acknowledgedNotification.escalationTarget,
      assignedToActorId: acknowledgedNotification.assignedToActorId,
      notificationChannel: acknowledgedNotification.notificationChannel,
      status: acknowledgedNotification.status,
      sourceRequestId: acknowledgedNotification.sourceRequestId,
      acknowledgedAt: acknowledgedNotification.acknowledgedAt,
      acknowledgedByActorId: acknowledgedNotification.acknowledgedByActorId,
      acknowledgementNote: acknowledgedNotification.acknowledgementNote
    }
  });

  sendJson<AcknowledgeSystemCheckEvidenceBreachNotificationResponse>(response, 200, {
    notification: toSystemCheckEvidenceBreachNotificationDto({
      notification: acknowledgedNotification,
      systemCheckEvidence
    })
  });
};

const handleWorkspaceSystemCheckEvidenceBreachNotificationRedrive = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string,
  notificationId: string,
  requestContext: RequestContext
): Promise<void> => {
  const resolvedNotification = await resolveWorkspaceScopedSystemCheckEvidenceBreachNotification(
    store,
    tenantKey,
    workspaceKey,
    notificationId
  );

  if (!resolvedNotification) {
    sendError(
      response,
      404,
      "system_check_evidence_breach_notification_not_found",
      `System-check evidence breach notification '${notificationId}' was not found in workspace '${workspaceKey}'.`
    );
    return;
  }

  if (resolvedNotification.notification.deliveryStatus !== "delivery_failed") {
    sendError(
      response,
      409,
      "system_check_evidence_breach_notification_not_in_dead_letter_queue",
      `System-check evidence breach notification '${notificationId}' is not currently in the dead-letter queue.`,
      {
        deliveryStatus: resolvedNotification.notification.deliveryStatus
      }
    );
    return;
  }

  if (resolvedNotification.notification.status === "acknowledged") {
    sendError(
      response,
      409,
      "system_check_evidence_breach_notification_already_acknowledged",
      `System-check evidence breach notification '${notificationId}' has already been acknowledged.`
    );
    return;
  }

  const body = await readBody<RedriveSystemCheckEvidenceBreachNotificationRequest>(request);
  const redrivenByActorId = getTrimmedString(body.redrivenByActorId);
  const redriveNote = getTrimmedString(body.redriveNote);
  const deliveryTarget = getTrimmedString(body.deliveryTarget) ?? null;

  if (!redrivenByActorId || !redriveNote) {
    sendError(
      response,
      400,
      "invalid_system_check_evidence_breach_notification_redrive_payload",
      "redrivenByActorId and redriveNote are required."
    );
    return;
  }

  const effectiveDeliveryTarget = deliveryTarget ?? resolvedNotification.notification.deliveryTarget;

  if (!effectiveDeliveryTarget) {
    sendError(
      response,
      400,
      "system_check_evidence_breach_notification_redrive_target_required",
      "deliveryTarget is required when the failed notification has no existing delivery target."
    );
    return;
  }

  const tenant = await store.getTenantById(resolvedNotification.workspace.tenantId);

  if (!tenant) {
    sendError(
      response,
      500,
      "tenant_not_found",
      `Tenant for workspace '${workspaceKey}' could not be resolved.`
    );
    return;
  }

  const systemCheckEvidence = await store.getSystemCheckEvidenceByKey(resolvedNotification.notification.evidenceKey);

  if (!systemCheckEvidence) {
    sendError(
      response,
      404,
      "system_check_evidence_not_found",
      `System-check evidence '${resolvedNotification.notification.evidenceKey}' could not be loaded for notification '${notificationId}'.`
    );
    return;
  }

  const effectiveNotificationPolicy = resolveWorkspaceNotificationPolicy(
    resolvedNotification.workspace,
    tenant
  );
  const redrivenNotification = redriveSystemCheckEvidenceBreachNotification({
    notification: resolvedNotification.notification,
    notificationPolicy: effectiveNotificationPolicy,
    deliveryTarget: effectiveDeliveryTarget,
    sourceRequestId: requestContext.requestId
  });

  await store.updateSystemCheckEvidenceBreachNotification(redrivenNotification);
  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: redrivenNotification.tenantId,
    workspaceId: redrivenNotification.workspaceId,
    participantSessionId: redrivenNotification.participantSessionId,
    loginKey: redrivenNotification.loginKey,
    groupKey: redrivenNotification.groupKey,
    actorType: "platform_api",
    actorId: redrivenByActorId,
    eventType: "workspace.system_check.evidence_breach_notification.redriven",
    payload: {
      notificationId: redrivenNotification.notificationId,
      evidenceKey: redrivenNotification.evidenceKey,
      systemCheckKey: redrivenNotification.systemCheckKey,
      checkKey: redrivenNotification.checkKey,
      holdReasonCode: redrivenNotification.holdReasonCode,
      escalationTarget: redrivenNotification.escalationTarget,
      assignedToActorId: redrivenNotification.assignedToActorId,
      notificationChannel: redrivenNotification.notificationChannel,
      status: redrivenNotification.status,
      previousSourceRequestId: resolvedNotification.notification.sourceRequestId,
      sourceRequestId: redrivenNotification.sourceRequestId,
      redriveNote,
      previousDeliveryChannel: resolvedNotification.notification.deliveryChannel,
      previousDeliveryStatus: resolvedNotification.notification.deliveryStatus,
      previousDeliveryAttemptCount: resolvedNotification.notification.deliveryAttemptCount,
      previousLastDeliveryError: resolvedNotification.notification.lastDeliveryError,
      deliveryChannel: redrivenNotification.deliveryChannel,
      deliveryTarget: redrivenNotification.deliveryTarget,
      maxDeliveryAttempts: redrivenNotification.maxDeliveryAttempts,
      nextDeliveryAttemptAt: redrivenNotification.nextDeliveryAttemptAt
    }
  });

  sendJson<RedriveSystemCheckEvidenceBreachNotificationResponse>(response, 200, {
    notification: toSystemCheckEvidenceBreachNotificationDto({
      notification: redrivenNotification,
      systemCheckEvidence
    })
  });
};

const handleWorkspaceSystemCheckEvidenceAssignHold = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string,
  evidenceKey: string,
  requestContext: RequestContext
): Promise<void> => {
  const resolvedEvidence = await resolveWorkspaceScopedSystemCheckEvidence(
    store,
    tenantKey,
    workspaceKey,
    evidenceKey
  );

  if (!resolvedEvidence) {
    sendError(
      response,
      404,
      "system_check_evidence_not_found",
      `System-check evidence '${evidenceKey}' was not found in workspace '${workspaceKey}'.`
    );
    return;
  }

  const currentEvidence = await synchronizeSystemCheckEvidenceHoldEscalationIfNeeded({
    store,
    workspace: resolvedEvidence.workspace,
    systemCheckEvidence: resolvedEvidence.systemCheckEvidence,
    requestContext
  });

  if (!currentEvidence.retentionHold) {
    sendError(
      response,
      409,
      "system_check_evidence_not_held",
      `System-check evidence '${evidenceKey}' does not currently have a retention hold.`
    );
    return;
  }

  const body = await readBody<AssignSystemCheckEvidenceHoldRequest>(request);
  const assignedByActorId = getTrimmedString(body.assignedByActorId);
  const assignedToActorId = getTrimmedString(body.assignedToActorId);
  const assignmentNote = getTrimmedString(body.assignmentNote);

  if (!assignedByActorId || !assignedToActorId) {
    sendError(
      response,
      400,
      "invalid_system_check_evidence_assign_hold_payload",
      "assignedByActorId and assignedToActorId are required."
    );
    return;
  }

  const assignedEvidence = assignSystemCheckEvidenceRetentionHold({
    systemCheckEvidence: currentEvidence,
    assignedByActorId,
    assignedToActorId,
    assignmentNote
  });

  await store.updateSystemCheckEvidence(assignedEvidence);
  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: assignedEvidence.tenantId,
    workspaceId: assignedEvidence.workspaceId,
    participantSessionId: assignedEvidence.participantSessionId,
    loginKey: assignedEvidence.loginKey,
    groupKey: assignedEvidence.groupKey,
    actorType: "platform_api",
    actorId: assignedByActorId,
    eventType: "workspace.system_check.evidence_hold.assigned",
    payload: {
      evidenceKey: assignedEvidence.evidenceKey,
      systemCheckKey: assignedEvidence.systemCheckKey,
      checkKey: assignedEvidence.checkKey,
      retentionClass: assignedEvidence.retentionClass,
      retentionPolicyKey: assignedEvidence.retentionPolicyKey,
      retentionExpiresAt: assignedEvidence.retentionExpiresAt,
      ...toSystemCheckEvidenceHoldAuditPayload(assignedEvidence.retentionHold)
    }
  });

  sendJson<AssignSystemCheckEvidenceHoldResponse>(response, 200, {
    evidence: toSystemCheckEvidenceDetailDto(assignedEvidence)
  });
};

const handleWorkspaceSystemCheckEvidenceReleaseHold = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string,
  evidenceKey: string,
  requestContext: RequestContext
): Promise<void> => {
  const resolvedEvidence = await resolveWorkspaceScopedSystemCheckEvidence(
    store,
    tenantKey,
    workspaceKey,
    evidenceKey
  );

  if (!resolvedEvidence) {
    sendError(
      response,
      404,
      "system_check_evidence_not_found",
      `System-check evidence '${evidenceKey}' was not found in workspace '${workspaceKey}'.`
    );
    return;
  }

  const currentEvidence = await synchronizeSystemCheckEvidenceHoldEscalationIfNeeded({
    store,
    workspace: resolvedEvidence.workspace,
    systemCheckEvidence: resolvedEvidence.systemCheckEvidence,
    requestContext
  });

  const body = await readBody<ReleaseSystemCheckEvidenceHoldRequest>(request);
  const releasedByActorId = getTrimmedString(body.releasedByActorId);
  const releaseNote = getTrimmedString(body.releaseNote);

  if (!releasedByActorId || !releaseNote) {
    sendError(
      response,
      400,
      "invalid_system_check_evidence_release_hold_payload",
      "releasedByActorId and releaseNote are required."
    );
    return;
  }

  if (!currentEvidence.retentionHold) {
    sendError(
      response,
      409,
      "system_check_evidence_not_held",
      `System-check evidence '${evidenceKey}' does not currently have a retention hold.`
    );
    return;
  }
  const existingHold = currentEvidence.retentionHold;

  const releasedEvidence = releaseSystemCheckEvidenceRetentionHold(currentEvidence);
  await store.updateSystemCheckEvidence(releasedEvidence);
  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: releasedEvidence.tenantId,
    workspaceId: releasedEvidence.workspaceId,
    participantSessionId: releasedEvidence.participantSessionId,
    loginKey: releasedEvidence.loginKey,
    groupKey: releasedEvidence.groupKey,
    actorType: "platform_api",
    actorId: releasedByActorId,
    eventType: "workspace.system_check.evidence_hold.released",
    payload: {
      evidenceKey: releasedEvidence.evidenceKey,
      systemCheckKey: releasedEvidence.systemCheckKey,
      checkKey: releasedEvidence.checkKey,
      retentionClass: releasedEvidence.retentionClass,
      retentionPolicyKey: releasedEvidence.retentionPolicyKey,
      releaseNote,
      retentionExpiresAt: releasedEvidence.retentionExpiresAt,
      ...toSystemCheckEvidenceHoldAuditPayload(existingHold)
    }
  });

  sendJson<ReleaseSystemCheckEvidenceHoldResponse>(response, 200, {
    evidence: toSystemCheckEvidenceDetailDto(releasedEvidence)
  });
};

const handleWorkspaceSystemCheckEvidenceGet = async (
  store: PlatformStore,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string,
  evidenceKey: string,
  requestContext: RequestContext
): Promise<void> => {
  const resolvedEvidence = await resolveWorkspaceScopedSystemCheckEvidence(
    store,
    tenantKey,
    workspaceKey,
    evidenceKey
  );

  if (!resolvedEvidence) {
    sendError(
      response,
      404,
      "system_check_evidence_not_found",
      `System-check evidence '${evidenceKey}' was not found in workspace '${workspaceKey}'.`
    );
    return;
  }

  const currentEvidence = await synchronizeSystemCheckEvidenceHoldEscalationIfNeeded({
    store,
    workspace: resolvedEvidence.workspace,
    systemCheckEvidence: resolvedEvidence.systemCheckEvidence,
    requestContext
  });

  const accessGrant =
    getSystemCheckEvidencePayloadAvailability(currentEvidence) === "available"
      ? await issueSystemCheckEvidenceAccessGrant({
          store,
          systemCheckEvidence: currentEvidence,
          issuedFor: "workspace_review",
          actorType: "platform_api",
          actorId: "platform-api"
        })
      : null;

  sendJson<WorkspaceSystemCheckEvidenceResponse>(response, 200, {
    evidence: toSystemCheckEvidenceDetailDto(currentEvidence),
    accessGrant: accessGrant ? toSystemCheckEvidenceAccessGrantDto(accessGrant) : null
  });
};

const handleWorkspaceSystemCheckEvidenceRetentionHistoryGet = async (
  store: PlatformStore,
  response: ServerResponse,
  url: URL,
  tenantKey: string,
  workspaceKey: string,
  evidenceKey: string,
  requestContext: RequestContext
): Promise<void> => {
  const resolvedEvidence = await resolveWorkspaceScopedSystemCheckEvidence(
    store,
    tenantKey,
    workspaceKey,
    evidenceKey
  );

  if (!resolvedEvidence) {
    sendError(
      response,
      404,
      "system_check_evidence_not_found",
      `System-check evidence '${evidenceKey}' was not found in workspace '${workspaceKey}'.`
    );
    return;
  }

  await synchronizeSystemCheckEvidenceHoldEscalationIfNeeded({
    store,
    workspace: resolvedEvidence.workspace,
    systemCheckEvidence: resolvedEvidence.systemCheckEvidence,
    requestContext
  });

  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit ? Number.parseInt(rawLimit, 10) : 50;

  if (!Number.isInteger(limit) || limit <= 0 || limit > 200) {
    sendError(response, 400, "invalid_evidence_retention_history_limit", "limit must be an integer between 1 and 200.");
    return;
  }

  const auditEvents = await store.listAuditEventsBySystemCheckEvidence(
    tenantKey,
    workspaceKey,
    evidenceKey,
    {
      limit,
      eventTypes: [...systemCheckEvidenceRetentionAuditEventTypes]
    }
  );

  sendJson<WorkspaceSystemCheckEvidenceRetentionHistoryResponse>(response, 200, {
    items: auditEvents
      .map(toSystemCheckEvidenceRetentionHistoryEntryDto)
      .filter((item): item is SystemCheckEvidenceRetentionHistoryEntryDto => Boolean(item))
  });
};

const handleSystemCheckEvidenceAccessGet = async (
  store: PlatformStore,
  response: ServerResponse,
  accessToken: string
): Promise<void> => {
  const accessGrant = await store.getSystemCheckEvidenceAccessGrantByToken(accessToken);

  if (!accessGrant) {
    sendError(
      response,
      404,
      "system_check_evidence_access_not_found",
      "The system-check evidence access token could not be resolved."
    );
    return;
  }

  if (isSystemCheckEvidenceAccessGrantExpired(accessGrant)) {
    sendError(
      response,
      410,
      "system_check_evidence_access_expired",
      "The system-check evidence access token has expired.",
      {
        expiresAt: accessGrant.expiresAt
      }
    );
    return;
  }

  const systemCheckEvidence = await store.getSystemCheckEvidenceByKey(accessGrant.evidenceKey);

  if (!systemCheckEvidence) {
    sendError(
      response,
      404,
      "system_check_evidence_not_found",
      `System-check evidence '${accessGrant.evidenceKey}' could not be resolved for this access token.`
    );
    return;
  }

  if (getSystemCheckEvidencePayloadAvailability(systemCheckEvidence) === "purged") {
    sendError(
      response,
      410,
      "system_check_evidence_purged",
      `System-check evidence '${accessGrant.evidenceKey}' payload has already been purged.`,
      {
        purgedAt: systemCheckEvidence.purgedAt,
        purgeReasonCode: systemCheckEvidence.purgeReasonCode
      }
    );
    return;
  }

  const accessedGrant = markSystemCheckEvidenceAccessGrantAccessed(accessGrant);
  await store.updateSystemCheckEvidenceAccessGrant(accessedGrant);
  const payloadBase64 = await readSystemCheckEvidenceBlob(systemCheckEvidence);

  sendJson<SystemCheckEvidenceAccessResponse>(response, 200, {
    evidence: toSystemCheckEvidenceDetailDto(systemCheckEvidence),
    accessGrant: toSystemCheckEvidenceAccessGrantDto(accessedGrant),
    content: {
      payloadBase64,
      payloadPreviewText: getSystemCheckEvidencePreviewText(systemCheckEvidence)
    }
  });
};

const handleSourcePackagesGet = async (
  store: PlatformStore,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string
): Promise<void> => {
  if (!(await store.getWorkspaceByKey(tenantKey, workspaceKey))) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  sendJson(response, 200, {
    items: (await store.listSourcePackagesByWorkspace(tenantKey, workspaceKey)).map(toSourcePackageSummaryDto)
  });
};

const handleSourcePackagesPost = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string,
  requestContext: RequestContext
): Promise<void> => {
  const tenant = await store.getTenantByKey(tenantKey);
  const workspace = await store.getWorkspaceByKey(tenantKey, workspaceKey);

  if (!tenant || !workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const body = await readBody<CreateSourcePackageRequest>(request);
  const fileName = getTrimmedString(body.fileName);
  const manifestHash = getTrimmedString(body.manifestHash);
  const uploadedBy = getTrimmedString(body.uploadedBy);
  const format = body.format;

  if (!fileName || !manifestHash || !uploadedBy || (format !== "xml-archive" && format !== "xml-manifest")) {
    sendError(
      response,
      400,
      "invalid_source_package_payload",
      "fileName, manifestHash, uploadedBy, and a valid format are required."
    );
    return;
  }

  const sourcePackage = createSourcePackage({
    tenantId: tenant.tenantId,
    workspaceId: workspace.workspaceId,
    fileName,
    manifestHash,
    format,
    uploadedBy
  });

  await store.saveSourcePackage(sourcePackage);
  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: tenant.tenantId,
    workspaceId: workspace.workspaceId,
    actorType: "platform_api",
    actorId: uploadedBy,
    eventType: "workspace.source_package.uploaded",
    payload: {
      sourcePackageId: sourcePackage.sourcePackageId,
      fileName: sourcePackage.fileName,
      manifestHash: sourcePackage.manifestHash,
      format: sourcePackage.format
    }
  });
  sendJson(response, 201, toSourcePackageSummaryDto(sourcePackage));
};

const handleImportJobsGet = async (
  store: PlatformStore,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string
): Promise<void> => {
  if (!(await store.getWorkspaceByKey(tenantKey, workspaceKey))) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  sendJson(response, 200, {
    items: (await store.listImportJobsByWorkspace(tenantKey, workspaceKey)).map(toImportJobSummaryDto)
  });
};

const handleImportJobGet = async (
  store: PlatformStore,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string,
  importJobId: string
): Promise<void> => {
  const resolvedImportJob = await resolveWorkspaceScopedImportJob(store, tenantKey, workspaceKey, importJobId);

  if (!resolvedImportJob) {
    sendError(
      response,
      404,
      "import_job_not_found",
      `Import job '${importJobId}' was not found in workspace '${workspaceKey}'.`
    );
    return;
  }

  const sourcePackage = await store.getSourcePackageById(resolvedImportJob.importJob.sourcePackageId);
  const contentRelease = await store.getContentReleaseByImportJobId(importJobId);
  const scopedSourcePackage = sourcePackage &&
    sourcePackage.tenantId === resolvedImportJob.workspace.tenantId &&
    sourcePackage.workspaceId === resolvedImportJob.workspace.workspaceId
    ? sourcePackage
    : null;
  const scopedContentRelease = contentRelease &&
    contentRelease.tenantId === resolvedImportJob.workspace.tenantId &&
    contentRelease.workspaceId === resolvedImportJob.workspace.workspaceId
    ? contentRelease
    : null;
  const auditTrail = await getImportDiagnosticsAuditTrail({
    store,
    tenantKey,
    workspaceKey,
    importJobId: resolvedImportJob.importJob.importJobId,
    sourcePackageId: resolvedImportJob.importJob.sourcePackageId,
    contentReleaseId: scopedContentRelease?.contentReleaseId
  });
  const workspaceContentReleases = scopedContentRelease
    ? await store.listContentReleasesByWorkspace(tenantKey, workspaceKey)
    : [];
  const previousContentRelease = scopedContentRelease
    ? getPreviousContentRelease(workspaceContentReleases, scopedContentRelease.contentReleaseId)
    : null;
  const guardrailContext = scopedContentRelease
    ? await buildContentReleaseGuardrailContext(store, tenantKey, workspaceKey)
    : emptyContentReleaseGuardrailContext;

  sendJson<ImportJobDetailResponse>(response, 200, {
    importJob: toImportJobSummaryDto(resolvedImportJob.importJob),
    sourcePackage: scopedSourcePackage ? toSourcePackageSummaryDto(scopedSourcePackage) : null,
    contentRelease: scopedContentRelease
      ? toContentReleaseSummaryDto(scopedContentRelease, previousContentRelease, guardrailContext)
      : null,
    diagnostics: {
      stages: toImportJobDiagnosticStages(auditTrail),
      artifacts: toImportJobDiagnosticArtifacts(auditTrail),
      failure: toImportJobDiagnosticFailure(auditTrail)
    },
    auditTrail
  });
};

const handleImportJobsPost = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string,
  requestContext: RequestContext
): Promise<void> => {
  const tenant = await store.getTenantByKey(tenantKey);
  const workspace = await store.getWorkspaceByKey(tenantKey, workspaceKey);

  if (!tenant || !workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const body = await readBody<CreateImportJobRequest>(request);
  const sourcePackageId = getTrimmedString(body.sourcePackageId);

  if (!sourcePackageId) {
    sendError(response, 400, "invalid_import_job_payload", "sourcePackageId is required.");
    return;
  }

  const sourcePackage = await store.getSourcePackageById(sourcePackageId);

  if (!sourcePackage ||
    sourcePackage.tenantId !== tenant.tenantId ||
    sourcePackage.workspaceId !== workspace.workspaceId) {
    sendError(
      response,
      404,
      "source_package_not_found",
      `Source package '${sourcePackageId}' was not found in workspace '${workspaceKey}'.`
    );
    return;
  }

  const importJob = createImportJob({
    tenantId: tenant.tenantId,
    workspaceId: workspace.workspaceId,
    sourcePackageId
  });

  await store.saveImportJob(importJob);
  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: tenant.tenantId,
    workspaceId: workspace.workspaceId,
    actorType: "platform_api",
    actorId: "platform-api",
    eventType: "workspace.import_job.queued",
    payload: {
      importJobId: importJob.importJobId,
      sourcePackageId: importJob.sourcePackageId
    }
  });
  sendJson(response, 201, toImportJobSummaryDto(importJob));
};

const handleContentReleasesGet = async (
  store: PlatformStore,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string
): Promise<void> => {
  if (!(await store.getWorkspaceByKey(tenantKey, workspaceKey))) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const [contentReleases, guardrailContext] = await Promise.all([
    store.listContentReleasesByWorkspace(tenantKey, workspaceKey),
    buildContentReleaseGuardrailContext(store, tenantKey, workspaceKey)
  ]);

  sendJson(response, 200, {
    items: toContentReleaseSummaryDtos(contentReleases, guardrailContext)
  });
};

const handleContentReleaseGet = async (
  store: PlatformStore,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string,
  contentReleaseId: string
): Promise<void> => {
  const resolvedContentRelease = await resolveWorkspaceScopedContentRelease(
    store,
    tenantKey,
    workspaceKey,
    contentReleaseId
  );

  if (!resolvedContentRelease) {
    sendError(
      response,
      404,
      "content_release_not_found",
      `Content release '${contentReleaseId}' was not found in workspace '${workspaceKey}'.`
    );
    return;
  }

  const sourcePackage = await store.getSourcePackageById(resolvedContentRelease.contentRelease.sourcePackageId);
  const importJob = await store.getImportJobById(resolvedContentRelease.contentRelease.importJobId);
  const scopedSourcePackage = sourcePackage &&
    sourcePackage.tenantId === resolvedContentRelease.workspace.tenantId &&
    sourcePackage.workspaceId === resolvedContentRelease.workspace.workspaceId
    ? sourcePackage
    : null;
  const scopedImportJob = importJob &&
    importJob.tenantId === resolvedContentRelease.workspace.tenantId &&
    importJob.workspaceId === resolvedContentRelease.workspace.workspaceId
    ? importJob
    : null;
  const workspaceContentReleases = await store.listContentReleasesByWorkspace(tenantKey, workspaceKey);
  const previousContentRelease = getPreviousContentRelease(
    workspaceContentReleases,
    resolvedContentRelease.contentRelease.contentReleaseId
  );
  const guardrailContext = await buildContentReleaseGuardrailContext(store, tenantKey, workspaceKey);

  sendJson<ContentReleaseDetailResponse>(response, 200, {
    contentRelease: toContentReleaseDetailDto(
      resolvedContentRelease.contentRelease,
      previousContentRelease,
      guardrailContext
    ),
    sourcePackage: scopedSourcePackage ? toSourcePackageSummaryDto(scopedSourcePackage) : null,
    importJob: scopedImportJob ? toImportJobSummaryDto(scopedImportJob) : null,
    canonicalSnapshot: toContentReleaseCanonicalSnapshotDto(resolvedContentRelease.contentRelease.canonicalSnapshot)
  });
};

const handleContentReleaseMonitorProjectionGet = async (
  store: PlatformStore,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string,
  contentReleaseId: string
): Promise<void> => {
  const resolvedContentRelease = await resolveWorkspaceScopedContentRelease(
    store,
    tenantKey,
    workspaceKey,
    contentReleaseId
  );

  if (!resolvedContentRelease) {
    sendError(
      response,
      404,
      "content_release_not_found",
      `Content release '${contentReleaseId}' was not found in workspace '${workspaceKey}'.`
    );
    return;
  }

  const workspaceContentReleases = await store.listContentReleasesByWorkspace(tenantKey, workspaceKey);
  const previousContentRelease = getPreviousContentRelease(
    workspaceContentReleases,
    resolvedContentRelease.contentRelease.contentReleaseId
  );
  const guardrailContext = await buildContentReleaseGuardrailContext(store, tenantKey, workspaceKey);

  sendJson<ContentReleaseMonitorProjectionResponse>(response, 200, {
    contentRelease: toContentReleaseDetailDto(
      resolvedContentRelease.contentRelease,
      previousContentRelease,
      guardrailContext
    ),
    projection: toContentReleaseMonitorProjectionDto(resolvedContentRelease.contentRelease)
  });
};

const handleContentReleaseSystemCheckProjectionGet = async (
  store: PlatformStore,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string,
  contentReleaseId: string
): Promise<void> => {
  const resolvedContentRelease = await resolveWorkspaceScopedContentRelease(
    store,
    tenantKey,
    workspaceKey,
    contentReleaseId
  );

  if (!resolvedContentRelease) {
    sendError(
      response,
      404,
      "content_release_not_found",
      `Content release '${contentReleaseId}' was not found in workspace '${workspaceKey}'.`
    );
    return;
  }

  const workspaceContentReleases = await store.listContentReleasesByWorkspace(tenantKey, workspaceKey);
  const previousContentRelease = getPreviousContentRelease(
    workspaceContentReleases,
    resolvedContentRelease.contentRelease.contentReleaseId
  );
  const guardrailContext = await buildContentReleaseGuardrailContext(store, tenantKey, workspaceKey);

  sendJson<ContentReleaseSystemCheckProjectionResponse>(response, 200, {
    contentRelease: toContentReleaseDetailDto(
      resolvedContentRelease.contentRelease,
      previousContentRelease,
      guardrailContext
    ),
    projection: toContentReleaseSystemCheckProjectionDto(resolvedContentRelease.contentRelease)
  });
};

const handleWorkspaceAuditEventsGet = async (
  store: PlatformStore,
  response: ServerResponse,
  url: URL,
  tenantKey: string,
  workspaceKey: string
): Promise<void> => {
  const workspace = await store.getWorkspaceByKey(tenantKey, workspaceKey);

  if (!workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit ? Number.parseInt(rawLimit, 10) : 50;

  if (!Number.isInteger(limit) || limit <= 0 || limit > 200) {
    sendError(response, 400, "invalid_audit_limit", "limit must be an integer between 1 and 200.");
    return;
  }

  sendJson<WorkspaceAuditEventsResponse>(response, 200, {
    items: (await store.listAuditEventsByWorkspace(tenantKey, workspaceKey, {
      limit
    })).map(toWorkspaceAuditEventDto)
  });
};

const handleWorkspaceMonitorTestRunsGet = async (
  store: PlatformStore,
  response: ServerResponse,
  url: URL,
  tenantKey: string,
  workspaceKey: string
): Promise<void> => {
  const workspace = await store.getWorkspaceByKey(tenantKey, workspaceKey);

  if (!workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const groupKey = getTrimmedString(url.searchParams.get("groupKey"));
  const testRuns = await store.listMonitorTestRunsByWorkspace(tenantKey, workspaceKey, {
    groupKey
  });
  const synchronizedTestRuns = await synchronizeTestRunsRuntimeState(store, testRuns);

  sendJson<WorkspaceMonitorTestRunsResponse>(response, 200, {
    items: synchronizedTestRuns.map(toWorkspaceMonitorTestRunDto),
    filters: {
      groupKey: groupKey ?? null
    }
  });
};

const handleWorkspaceMonitorCommandsGet = async (
  store: PlatformStore,
  response: ServerResponse,
  url: URL,
  tenantKey: string,
  workspaceKey: string
): Promise<void> => {
  const workspace = await store.getWorkspaceByKey(tenantKey, workspaceKey);

  if (!workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  const rawLimit = url.searchParams.get("limit");
  const limit = rawLimit ? Number.parseInt(rawLimit, 10) : 50;
  const testRunId = getTrimmedString(url.searchParams.get("testRunId"));
  const ackState = getTrimmedString(url.searchParams.get("ackState"));

  if (!Number.isInteger(limit) || limit <= 0 || limit > 200) {
    sendError(response, 400, "invalid_monitor_command_limit", "limit must be an integer between 1 and 200.");
    return;
  }

  if (ackState && !monitorCommandAckStates.includes(ackState as typeof monitorCommandAckStates[number])) {
    sendError(
      response,
      400,
      "invalid_monitor_command_ack_state",
      `ackState must be one of: ${monitorCommandAckStates.join(", ")}.`
    );
    return;
  }

  sendJson<WorkspaceMonitorCommandsResponse>(response, 200, {
    items: (await store.listMonitorCommandsByWorkspace(tenantKey, workspaceKey, {
      testRunId,
      ackState: ackState as MonitorCommand["ackState"] | undefined,
      limit
    })).map(toMonitorCommandDto),
    filters: {
      testRunId: testRunId ?? null,
      ackState: (ackState as MonitorCommand["ackState"] | undefined) ?? null
    }
  });
};

const handleContentReleaseActivate = async (
  store: PlatformStore,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string,
  contentReleaseId: string,
  requestContext: RequestContext
): Promise<void> => {
  const workspace = await store.getWorkspaceByKey(tenantKey, workspaceKey);
  const contentRelease = await store.getContentReleaseById(contentReleaseId);

  if (!workspace || !contentRelease ||
    contentRelease.tenantId !== workspace.tenantId ||
    contentRelease.workspaceId !== workspace.workspaceId) {
    sendError(
      response,
      404,
      "content_release_not_found",
      `Content release '${contentReleaseId}' was not found in workspace '${workspaceKey}'.`
    );
    return;
  }

  const preActivationGuardrailContext = await buildContentReleaseGuardrailContext(store, tenantKey, workspaceKey);
  const activationGuardrail = toContentReleaseActivationGuardrailDto(contentRelease, preActivationGuardrailContext);

  if (activationGuardrail.status === "blocked") {
    await recordAuditEvent(store, {
      requestId: requestContext.requestId,
      tenantId: contentRelease.tenantId,
      workspaceId: contentRelease.workspaceId,
      actorType: "platform_api",
      actorId: "platform-api",
      eventType: "workspace.content_release.activation_blocked",
      payload: {
        contentReleaseId: contentRelease.contentReleaseId,
        releaseLabel: contentRelease.releaseLabel,
        activationGuardrail
      }
    });
    sendError(
      response,
      409,
      "activation_guardrail_blocked",
      `Content release '${contentReleaseId}' cannot be activated while incompatible active sessions remain open.`,
      {
        activationGuardrail
      }
    );
    return;
  }

  const activatedRelease = await store.activateContentRelease(contentReleaseId);

  if (!activatedRelease) {
    sendError(
      response,
      404,
      "content_release_not_found",
      `Content release '${contentReleaseId}' was not found in workspace '${workspaceKey}'.`
    );
    return;
  }

  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: activatedRelease.tenantId,
    workspaceId: activatedRelease.workspaceId,
    actorType: "platform_api",
    actorId: "platform-api",
    eventType: "workspace.content_release.activated",
    payload: {
      contentReleaseId: activatedRelease.contentReleaseId,
      releaseLabel: activatedRelease.releaseLabel,
      activationGuardrailStatus: activationGuardrail.status,
      activationGuardrailWarningReasonCodes: activationGuardrail.warningReasonCodes,
      activationGuardrailBlockingReasonCodes: activationGuardrail.blockingReasonCodes
    }
  });
  const workspaceContentReleases = await store.listContentReleasesByWorkspace(tenantKey, workspaceKey);
  const postActivationGuardrailContext: ContentReleaseGuardrailContext = {
    activeContentRelease: activatedRelease,
    activationPolicy: preActivationGuardrailContext.activationPolicy,
    activeSessions: preActivationGuardrailContext.activeSessions
  };
  sendJson(
    response,
    200,
    toContentReleaseSummaryDto(
      activatedRelease,
      getPreviousContentRelease(workspaceContentReleases, activatedRelease.contentReleaseId),
      postActivationGuardrailContext
    )
  );
};

const handleParticipantAuthSignIn = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  requestContext: RequestContext
): Promise<void> => {
  const body = await readBody<ParticipantAuthSignInRequest>(request);
  const tenantKey = getTrimmedString(body.tenantKey);
  const workspaceKey = getTrimmedString(body.workspaceKey);
  const loginKey = getTrimmedString(body.loginKey);

  if (!tenantKey || !workspaceKey || !loginKey) {
    sendError(
      response,
      400,
      "invalid_participant_sign_in_payload",
      "tenantKey, workspaceKey, and loginKey are required."
    );
    return;
  }

  const workspace = await store.getWorkspaceByKey(tenantKey, workspaceKey);
  const contentRelease = await store.getActiveContentReleaseByWorkspace(tenantKey, workspaceKey);

  if (!workspace) {
    sendError(
      response,
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
    return;
  }

  if (!contentRelease || contentRelease.status !== "active") {
    sendError(
      response,
      409,
      "no_active_content_release",
      `Workspace '${workspaceKey}' does not have an active content release for participant sign-in.`
    );
    return;
  }

  const starterContext = resolveParticipantStarterContext(contentRelease, loginKey);

  if (!starterContext) {
    sendError(
      response,
      404,
      "participant_login_not_found",
      `Login '${loginKey}' is not available in the active content release.`
    );
    return;
  }

  const participantSession = createParticipantSession({
    tenantId: workspace.tenantId,
    workspaceId: workspace.workspaceId,
    contentReleaseId: contentRelease.contentReleaseId,
    loginKey,
    groupKey: starterContext.groupKey
  });

  await store.saveParticipantSession(participantSession);
  await recordParticipantSessionAuditEvent({
    store,
    requestContext,
    participantSession,
    actorType: "participant",
    actorId: loginKey,
    eventType: "participant.signed_in",
    payload: {
      contentReleaseId: contentRelease.contentReleaseId
    }
  });

  sendJson<ParticipantAuthSignInResponse>(response, 200, {
    loginFlow: {
      state: "authenticated",
      participantSessionToken: participantSession.sessionToken,
      starterContextId: participantSession.participantSessionId
    }
  });
};

const handleParticipantStarterGet = async (
  store: PlatformStore,
  response: ServerResponse,
  url: URL
): Promise<void> => {
  const participantSessionToken = getTrimmedString(url.searchParams.get("participantSessionToken"));

  if (!participantSessionToken) {
    sendError(
      response,
      400,
      "participant_session_token_required",
      "participantSessionToken is required."
    );
    return;
  }

  const participantSession = await store.getParticipantSessionByToken(participantSessionToken);

  if (!participantSession) {
    sendError(
      response,
      404,
      "participant_session_not_found",
      "The participant session token could not be resolved."
    );
    return;
  }

  const resolvedSystemCheckState = await resolveParticipantSystemCheckState(store, participantSession);

  if (!resolvedSystemCheckState || resolvedSystemCheckState.contentRelease.status !== "active") {
    sendError(
      response,
      409,
      "starter_release_not_active",
      "The participant session is not attached to an active content release."
    );
    return;
  }

  const { contentRelease, systemCheckReadiness } = resolvedSystemCheckState;
  const starterContext = resolveParticipantStarterContext(contentRelease, participantSession.loginKey);

  if (!starterContext) {
    sendError(
      response,
      404,
      "starter_context_not_found",
      "No starter context could be resolved for this participant session."
    );
    return;
  }

  const workspace = await store.getWorkspaceById(participantSession.workspaceId);
  const tenant = await store.getTenantById(participantSession.tenantId);

  if (!workspace || !tenant) {
    sendError(
      response,
      404,
      "participant_session_scope_not_found",
      "The participant session scope could not be resolved."
    );
    return;
  }

  sendJson<ParticipantStarterResponse>(response, 200, {
    participantSessionToken,
    starterContextId: participantSession.participantSessionId,
    tenantKey: tenant.tenantKey,
    workspaceKey: workspace.workspaceKey,
    loginKey: participantSession.loginKey,
    groupKey: starterContext.groupKey,
    contentReleaseId: contentRelease.contentReleaseId,
    releaseLabel: contentRelease.releaseLabel,
    systemCheckReadiness,
    assignments: starterContext.assignments.map(toParticipantStarterAssignmentDto)
  });
};

const handleParticipantSystemCheckGet = async (
  store: PlatformStore,
  response: ServerResponse,
  url: URL
): Promise<void> => {
  const participantSessionToken = getTrimmedString(url.searchParams.get("participantSessionToken"));

  if (!participantSessionToken) {
    sendError(
      response,
      400,
      "participant_session_token_required",
      "participantSessionToken is required."
    );
    return;
  }

  const participantSession = await store.getParticipantSessionByToken(participantSessionToken);

  if (!participantSession) {
    sendError(
      response,
      404,
      "participant_session_not_found",
      "The participant session token could not be resolved."
    );
    return;
  }

  const [tenant, workspace, resolvedSystemCheckState] = await Promise.all([
    store.getTenantById(participantSession.tenantId),
    store.getWorkspaceById(participantSession.workspaceId),
    resolveParticipantSystemCheckState(store, participantSession)
  ]);

  if (!tenant || !workspace || !resolvedSystemCheckState) {
    sendError(
      response,
      409,
      "participant_system_check_context_unavailable",
      "The participant system-check context could not be resolved."
    );
    return;
  }

  const { contentRelease, submissions, systemCheckReadiness } = resolvedSystemCheckState;
  const evidenceByKey = await loadSystemCheckEvidenceMap(
    store,
    submissions.map(submission => submission.checkResults)
  );

  sendJson<ParticipantSystemCheckResponse>(response, 200, {
    participantSessionToken,
    tenantKey: tenant.tenantKey,
    workspaceKey: workspace.workspaceKey,
    loginKey: participantSession.loginKey,
    groupKey: participantSession.groupKey,
    contentReleaseId: contentRelease.contentReleaseId,
    releaseLabel: contentRelease.releaseLabel,
    systemChecks: contentRelease.canonicalSnapshot.systemCheckDefinitions.map(toSystemCheckDefinitionDto),
    systemCheckReadiness,
    submissions: submissions.map(submission =>
      toSystemCheckSubmissionDto(submission, {
        systemCheckTitle: getSystemCheckDefinition(contentRelease, submission.systemCheckKey)?.title ?? null,
        evidenceByKey
      })
    )
  });
};

const handleParticipantSystemCheckEvidenceCapture = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  requestContext: RequestContext
): Promise<void> => {
  const body = await readBody<ParticipantSystemCheckEvidenceCaptureRequest>(request);
  const participantSessionToken = getTrimmedString(body.participantSessionToken);
  const systemCheckKey = getTrimmedString(body.systemCheckKey);
  const checkKey = getTrimmedString(body.checkKey);
  const fileName = getTrimmedString(body.fileName);
  const contentType = getTrimmedString(body.contentType);
  const payloadBase64 = parseBase64Payload(body.payloadBase64);

  if (!participantSessionToken || !systemCheckKey || !checkKey || !fileName || !contentType || !payloadBase64) {
    sendError(
      response,
      400,
      "invalid_system_check_evidence_payload",
      "participantSessionToken, systemCheckKey, checkKey, fileName, contentType, and payloadBase64 are required."
    );
    return;
  }

  const participantSession = await store.getParticipantSessionByToken(participantSessionToken);

  if (!participantSession) {
    sendError(
      response,
      404,
      "participant_session_not_found",
      "The participant session token could not be resolved."
    );
    return;
  }

  const contentRelease = await store.getContentReleaseById(participantSession.contentReleaseId);

  if (!contentRelease) {
    sendError(
      response,
      409,
      "participant_system_check_context_unavailable",
      "The participant system-check content release could not be resolved."
    );
    return;
  }

  const systemCheckDefinition = getSystemCheckDefinition(contentRelease, systemCheckKey);

  if (!systemCheckDefinition) {
    sendError(
      response,
      404,
      "system_check_not_found",
      `System check '${systemCheckKey}' is not available for this participant session.`
    );
    return;
  }

  if (!systemCheckDefinition.checkKeys.includes(checkKey)) {
    sendError(
      response,
      400,
      "system_check_check_not_found",
      `Check '${checkKey}' is not defined for system check '${systemCheckKey}'.`
    );
    return;
  }

  const payloadByteSize = Buffer.from(payloadBase64, "base64").byteLength;

  if (payloadByteSize > maxSystemCheckEvidenceBytes) {
    sendError(
      response,
      400,
      "system_check_evidence_too_large",
      `payloadBase64 exceeds the ${maxSystemCheckEvidenceBytes}-byte limit.`,
      {
        maxBytes: maxSystemCheckEvidenceBytes,
        actualBytes: payloadByteSize
      }
    );
    return;
  }

  const [tenant, workspace] = await Promise.all([
    store.getTenantById(participantSession.tenantId),
    store.getWorkspaceById(participantSession.workspaceId)
  ]);

  if (!tenant || !workspace) {
    sendError(
      response,
      500,
      "participant_session_scope_not_found",
      "The participant session could not be resolved to a valid tenant and workspace."
    );
    return;
  }

  const evidenceCreatedAt = new Date().toISOString();
  const evidenceRetentionPolicy = resolveWorkspaceEvidenceRetentionPolicy(workspace, tenant);
  const evidenceRetentionClassPolicy = resolveWorkspaceEvidenceRetentionClassPolicy(workspace, tenant);
  const captureRetentionRule = resolveSystemCheckEvidenceRetentionClassRule(
    evidenceRetentionPolicy,
    evidenceRetentionClassPolicy,
    evidenceRetentionClassPolicy.defaultCaptureRetentionClass
  );
  const draftSystemCheckEvidence = createSystemCheckEvidence({
    participantSessionId: participantSession.participantSessionId,
    tenantId: participantSession.tenantId,
    workspaceId: participantSession.workspaceId,
    contentReleaseId: participantSession.contentReleaseId,
    loginKey: participantSession.loginKey,
    groupKey: participantSession.groupKey,
    systemCheckKey,
    checkKey,
    fileName,
    contentType,
    payloadBase64,
    persistedPayloadBase64: null,
    retentionClass: captureRetentionRule.retentionClass,
    retentionPolicyKey: captureRetentionRule.retentionPolicyKey,
    retentionExpiresAt: resolveSystemCheckEvidenceRetentionExpiresAt(
      workspace,
      tenant,
      captureRetentionRule.retentionClass,
      evidenceCreatedAt
    ),
    createdAt: evidenceCreatedAt
  });
  const persistedEvidencePayload = await persistSystemCheckEvidencePayload({
    evidenceKey: draftSystemCheckEvidence.evidenceKey,
    payloadBase64
  });
  const systemCheckEvidence = {
    ...draftSystemCheckEvidence,
    payloadBase64: persistedEvidencePayload.persistedPayloadBase64,
    storageBackend: persistedEvidencePayload.storageBackend,
    storageLocator: persistedEvidencePayload.storageLocator
  };

  await store.saveSystemCheckEvidence(systemCheckEvidence);
  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: systemCheckEvidence.tenantId,
    workspaceId: systemCheckEvidence.workspaceId,
    participantSessionId: systemCheckEvidence.participantSessionId,
    loginKey: systemCheckEvidence.loginKey,
    groupKey: systemCheckEvidence.groupKey,
    actorType: "participant",
    actorId: systemCheckEvidence.loginKey,
    eventType: "participant.system_check.evidence_captured",
    payload: {
      evidenceKey: systemCheckEvidence.evidenceKey,
      contentReleaseId: systemCheckEvidence.contentReleaseId,
      systemCheckKey: systemCheckEvidence.systemCheckKey,
      checkKey: systemCheckEvidence.checkKey,
      retentionClass: systemCheckEvidence.retentionClass,
      retentionPolicyKey: systemCheckEvidence.retentionPolicyKey,
      retentionExpiresAt: systemCheckEvidence.retentionExpiresAt,
      fileName: systemCheckEvidence.fileName,
      contentType: systemCheckEvidence.contentType,
      byteSize: systemCheckEvidence.byteSize,
      sha256: systemCheckEvidence.sha256
    }
  });

  const accessGrant = await issueSystemCheckEvidenceAccessGrant({
    store,
    systemCheckEvidence,
    issuedFor: "participant_capture",
    actorType: "participant",
    actorId: systemCheckEvidence.loginKey
  });

  sendJson<ParticipantSystemCheckEvidenceCaptureResponse>(response, 201, {
    evidence: toSystemCheckEvidenceDetailDto(systemCheckEvidence),
    accessGrant: toSystemCheckEvidenceAccessGrantDto(accessGrant)
  });
};

const handleParticipantSystemCheckSubmit = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  requestContext: RequestContext
): Promise<void> => {
  const body = await readBody<ParticipantSystemCheckSubmitRequest>(request);
  const participantSessionToken = getTrimmedString(body.participantSessionToken);
  const systemCheckKey = getTrimmedString(body.systemCheckKey);

  if (!participantSessionToken || !systemCheckKey) {
    sendError(
      response,
      400,
      "invalid_system_check_submission_payload",
      "participantSessionToken and systemCheckKey are required."
    );
    return;
  }

  const participantSession = await store.getParticipantSessionByToken(participantSessionToken);

  if (!participantSession) {
    sendError(
      response,
      404,
      "participant_session_not_found",
      "The participant session token could not be resolved."
    );
    return;
  }

  const contentRelease = await store.getContentReleaseById(participantSession.contentReleaseId);

  if (!contentRelease) {
    sendError(
      response,
      409,
      "participant_system_check_context_unavailable",
      "The participant system-check content release could not be resolved."
    );
    return;
  }

  const systemCheckDefinition = getSystemCheckDefinition(contentRelease, systemCheckKey);

  if (!systemCheckDefinition) {
    sendError(
      response,
      404,
      "system_check_not_found",
      `System check '${systemCheckKey}' is not available for this participant session.`
    );
    return;
  }

  const checkResults = parseSystemCheckResults(body.checkResults, systemCheckDefinition.checkKeys);

  if (!checkResults) {
    sendError(
      response,
      400,
      "invalid_system_check_submission_payload",
      "checkResults must provide exactly one passed, warning, or failed value for each expected check key."
    );
    return;
  }

  const evidenceByKey = await loadSystemCheckEvidenceMap(store, [checkResults]);
  const expectedEvidenceKeys = collectSystemCheckEvidenceKeys(checkResults);

  if (evidenceByKey.size !== expectedEvidenceKeys.length) {
    sendError(
      response,
      400,
      "invalid_system_check_submission_evidence",
      "Every evidenceKey must reference an existing captured system-check evidence item for this participant session."
    );
    return;
  }

  for (const [checkKey, checkResult] of Object.entries(checkResults)) {
    for (const evidenceKey of checkResult.evidenceKeys) {
      const systemCheckEvidence = evidenceByKey.get(evidenceKey);

      if (
        !systemCheckEvidence ||
        systemCheckEvidence.participantSessionId !== participantSession.participantSessionId ||
        systemCheckEvidence.systemCheckKey !== systemCheckKey ||
        systemCheckEvidence.checkKey !== checkKey
      ) {
        sendError(
          response,
          400,
          "invalid_system_check_submission_evidence",
          "Every evidenceKey must belong to the same participant session, system check, and check key as the submission."
        );
        return;
      }
    }
  }

  const submission = createSystemCheckSubmission({
    participantSessionId: participantSession.participantSessionId,
    tenantId: participantSession.tenantId,
    workspaceId: participantSession.workspaceId,
    contentReleaseId: participantSession.contentReleaseId,
    loginKey: participantSession.loginKey,
    groupKey: participantSession.groupKey,
    systemCheckKey,
    checkResults
  });

  await store.saveSystemCheckSubmission(submission);
  await recordAuditEvent(store, {
    requestId: requestContext.requestId,
    tenantId: submission.tenantId,
    workspaceId: submission.workspaceId,
    participantSessionId: submission.participantSessionId,
    loginKey: submission.loginKey,
    groupKey: submission.groupKey,
    actorType: "participant",
    actorId: submission.loginKey,
    eventType: "participant.system_check.submitted",
    payload: {
      systemCheckSubmissionId: submission.systemCheckSubmissionId,
      contentReleaseId: submission.contentReleaseId,
      systemCheckKey: submission.systemCheckKey,
      status: submission.status,
      summary: summarizeSystemCheckResults(submission.checkResults)
    }
  });

  const submittedSystemCheckState = await resolveParticipantSystemCheckState(store, submission);

  if (submittedSystemCheckState) {
    await synchronizeSystemCheckLaunchApprovalsForParticipantSession({
      store,
      participantSession: submission,
      systemCheckReadiness: submittedSystemCheckState.systemCheckReadiness,
      requestContext,
      actorType: "participant",
      actorId: submission.loginKey
    });
  }

  sendJson<ParticipantSystemCheckSubmitResponse>(response, 201, {
    submission: toSystemCheckSubmissionDto(submission, {
      systemCheckTitle: systemCheckDefinition.title,
      evidenceByKey
    })
  });
};

const handleParticipantStarterLaunch = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  requestContext: RequestContext
): Promise<void> => {
  const body = await readBody<ParticipantStarterLaunchRequest>(request);
  const participantSessionToken = getTrimmedString(body.participantSessionToken);
  const assignmentKey = getTrimmedString(body.assignmentKey);
  const resumeBehavior = body.resumeBehavior;
  const launchApprovalId = getTrimmedString(body.launchApprovalId);

  if (!participantSessionToken || !assignmentKey ||
    (resumeBehavior !== "resume_or_create" && resumeBehavior !== "create_new")) {
    sendError(
      response,
      400,
      "invalid_starter_launch_payload",
      "participantSessionToken, assignmentKey, and a valid resumeBehavior are required."
    );
    return;
  }

  const participantSession = await store.getParticipantSessionByToken(participantSessionToken);

  if (!participantSession) {
    sendError(
      response,
      404,
      "participant_session_not_found",
      "The participant session token could not be resolved."
    );
    return;
  }

  const resolvedSystemCheckState = await resolveParticipantSystemCheckState(store, participantSession);

  if (!resolvedSystemCheckState || resolvedSystemCheckState.contentRelease.status !== "active") {
    sendError(
      response,
      409,
      "starter_release_not_active",
      "The participant session is not attached to an active content release."
    );
    return;
  }

  const { contentRelease, systemCheckReadiness } = resolvedSystemCheckState;
  const starterContext = resolveParticipantStarterContext(contentRelease, participantSession.loginKey);

  if (!starterContext || !starterContext.assignments.find(assignment => assignment.assignmentKey === assignmentKey)) {
    sendError(
      response,
      404,
      "starter_assignment_not_found",
      `Assignment '${assignmentKey}' is not available for this participant session.`
    );
    return;
  }

  const existingTestRun = resumeBehavior === "resume_or_create"
    ? await store.getOpenTestRunForSessionAssignment(
        participantSession.participantSessionId,
        assignmentKey
      )
    : undefined;

  if (existingTestRun) {
    const synchronizedTestRun = await synchronizeTestRunRuntimeState(store, existingTestRun);

    if (isOpenTestRun(synchronizedTestRun)) {
      await recordTestRunAuditEvent({
        store,
        requestContext,
        testRun: synchronizedTestRun,
        actorType: "participant",
        actorId: participantSession.loginKey,
        eventType: "participant.test_run.resumed",
        payload: {
          resumeBehavior
        }
      });
      sendJson<ParticipantStarterLaunchResponse>(
        response,
        200,
        toParticipantStarterLaunchResponse(
          synchronizedTestRun,
          participantSessionToken,
          "resumed",
          systemCheckReadiness
        )
      );
      return;
    }
  }

  if (systemCheckReadiness.status === "blocked") {
    await recordAuditEvent(store, {
      requestId: requestContext.requestId,
      tenantId: participantSession.tenantId,
      workspaceId: participantSession.workspaceId,
      participantSessionId: participantSession.participantSessionId,
      loginKey: participantSession.loginKey,
      groupKey: participantSession.groupKey,
      actorType: "participant",
      actorId: participantSession.loginKey,
      eventType: "participant.starter.launch_blocked_by_system_check",
      payload: {
        assignmentKey,
        readinessStatus: systemCheckReadiness.status,
        blockingReasonCodes: systemCheckReadiness.blockingReasonCodes
      }
    });
    sendError(
      response,
      409,
      "starter_launch_blocked_by_system_check",
      "The participant cannot launch until system-check requirements are satisfied.",
      {
        systemCheckReadiness
      }
    );
    return;
  }

  let appliedLaunchApproval: SystemCheckLaunchApproval | undefined;

  if (systemCheckReadiness.status === "warning") {
    if (!launchApprovalId) {
      await recordAuditEvent(store, {
        requestId: requestContext.requestId,
        tenantId: participantSession.tenantId,
        workspaceId: participantSession.workspaceId,
        participantSessionId: participantSession.participantSessionId,
        loginKey: participantSession.loginKey,
        groupKey: participantSession.groupKey,
        actorType: "participant",
        actorId: participantSession.loginKey,
        eventType: "participant.starter.launch_requires_launch_approval",
        payload: {
          assignmentKey,
          readinessStatus: systemCheckReadiness.status,
          warningReasonCodes: systemCheckReadiness.warningReasonCodes
        }
      });
      sendError(
        response,
        409,
        "starter_launch_requires_launch_approval",
        "A stored launch approval is required before launch can continue with warning-level system-check readiness.",
        {
          systemCheckReadiness
        }
      );
      return;
    }

    const storedLaunchApproval = await store.getSystemCheckLaunchApprovalById(launchApprovalId);
    const launchApproval = storedLaunchApproval
      ? await expireSystemCheckLaunchApprovalIfNeeded({
          store,
          launchApproval: storedLaunchApproval,
          requestContext,
          actorType: "participant",
          actorId: participantSession.loginKey
        })
      : undefined;
    const normalizedCurrentWarningCodes = [...systemCheckReadiness.warningReasonCodes].sort();
    const normalizedApprovedWarningCodes = [...(launchApproval?.warningReasonCodes ?? [])].sort();

    if (
      !launchApproval ||
      launchApproval.status !== "active" ||
      launchApproval.participantSessionId !== participantSession.participantSessionId ||
      launchApproval.assignmentKey !== assignmentKey ||
      launchApproval.tenantId !== participantSession.tenantId ||
      launchApproval.workspaceId !== participantSession.workspaceId ||
      launchApproval.readinessStatus !== "warning" ||
      normalizedCurrentWarningCodes.length !== normalizedApprovedWarningCodes.length ||
      normalizedCurrentWarningCodes.some((code, index) => code !== normalizedApprovedWarningCodes[index])
    ) {
      sendError(
        response,
        409,
        "starter_launch_invalid_launch_approval",
        "The provided launchApprovalId is not valid for this participant session, assignment, and current warning-level system-check readiness."
      );
      return;
    }

    appliedLaunchApproval = launchApproval;
  }

  const latestTestRun = await store.getLatestTestRunForSessionAssignment(
    participantSession.participantSessionId,
    assignmentKey
  );

  const testRun = createTestRun({
    participantSession,
    contentRelease,
    assignmentKey,
    attemptNumber: latestTestRun ? latestTestRun.attemptNumber + 1 : 1,
    launchApproval: appliedLaunchApproval
      ? {
          launchApprovalId: appliedLaunchApproval.launchApprovalId,
          approvalScope: appliedLaunchApproval.approvalScope,
          approvedBySupervisorId: appliedLaunchApproval.approvedBySupervisorId,
          approvalNote: appliedLaunchApproval.approvalNote,
          approvedAt: appliedLaunchApproval.approvedAt
        }
      : undefined
  });

  if (!testRun) {
    sendError(
      response,
      409,
      "test_run_creation_failed",
      `A test run could not be created for assignment '${assignmentKey}'.`
    );
    return;
  }

  await store.saveTestRun(testRun);

  if (appliedLaunchApproval?.approvalScope === "single_launch") {
    appliedLaunchApproval = consumeSystemCheckLaunchApproval({
      launchApproval: appliedLaunchApproval,
      testRunId: testRun.testRunId
    });
    await store.updateSystemCheckLaunchApproval(appliedLaunchApproval);
  }

  if (appliedLaunchApproval) {
    await recordAuditEvent(store, {
      requestId: requestContext.requestId,
      tenantId: participantSession.tenantId,
      workspaceId: participantSession.workspaceId,
      participantSessionId: participantSession.participantSessionId,
      loginKey: participantSession.loginKey,
      groupKey: participantSession.groupKey,
      assignmentKey,
      actorType: "platform_api",
      actorId: appliedLaunchApproval.approvedBySupervisorId,
      eventType: "participant.starter.launch_approval_applied",
      payload: {
        launchApprovalId: appliedLaunchApproval.launchApprovalId,
        approvalScope: appliedLaunchApproval.approvalScope,
        readinessStatus: systemCheckReadiness.status,
        warningReasonCodes: systemCheckReadiness.warningReasonCodes,
        approvalNote: appliedLaunchApproval.approvalNote,
        approvalStatus: appliedLaunchApproval.status
      }
    });
  }
  await recordTestRunAuditEvent({
    store,
    requestContext,
    testRun,
    actorType: "participant",
    actorId: participantSession.loginKey,
    eventType: "participant.test_run.created",
    payload: {
      resumeBehavior
    }
  });
  sendJson<ParticipantStarterLaunchResponse>(
    response,
    201,
    toParticipantStarterLaunchResponse(
      testRun,
      participantSessionToken,
      "created",
      systemCheckReadiness
    )
  );
};

const handleParticipantTestRunGet = async (
  store: PlatformStore,
  response: ServerResponse,
  url: URL,
  testRunId: string
): Promise<void> => {
  const participantSessionToken = getTrimmedString(url.searchParams.get("participantSessionToken"));

  if (!participantSessionToken) {
    sendError(
      response,
      400,
      "participant_session_token_required",
      "participantSessionToken is required."
    );
    return;
  }

  const resolvedRun = await resolveParticipantSessionBoundTestRun(store, participantSessionToken, testRunId);

  if (!resolvedRun) {
    sendError(
      response,
      404,
      "test_run_not_found",
      `Test run '${testRunId}' was not found for this participant session.`
    );
    return;
  }

  sendJson<ParticipantTestRunResponse>(
    response,
    200,
    toParticipantTestRunResponse(resolvedRun.testRun, participantSessionToken)
  );
};

const handleParticipantTestRunSave = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  testRunId: string,
  requestContext: RequestContext
): Promise<void> => {
  const body = await readBody<ParticipantTestRunSaveRequest>(request);
  const participantSessionToken = getTrimmedString(body.participantSessionToken);
  const unitKey = getTrimmedString(body.unitKey);

  if (!participantSessionToken || !unitKey) {
    sendError(
      response,
      400,
      "invalid_test_run_save_payload",
      "participantSessionToken and unitKey are required."
    );
    return;
  }

  const resolvedRun = await resolveParticipantSessionBoundTestRun(store, participantSessionToken, testRunId);

  if (!resolvedRun) {
    sendError(
      response,
      404,
      "test_run_not_found",
      `Test run '${testRunId}' was not found for this participant session.`
    );
    return;
  }

  const updatedTestRun = saveTestRunUnitResponse({
    testRun: resolvedRun.testRun,
    unitKey,
    response: body.response
  });

  if (!updatedTestRun) {
    sendError(
      response,
      409,
      "test_run_save_rejected",
      `The test run could not save unit '${unitKey}' in its current state.`
    );
    return;
  }

  await store.updateTestRun(updatedTestRun);
  await recordTestRunAuditEvent({
    store,
    requestContext,
    testRun: updatedTestRun,
    actorType: "participant",
    actorId: resolvedRun.participantSession.loginKey,
    eventType: "participant.test_run.saved",
    payload: {
      unitKey
    }
  });
  sendJson<ParticipantTestRunResponse>(
    response,
    200,
    toParticipantTestRunResponse(updatedTestRun, participantSessionToken)
  );
};

const handleParticipantTestRunNextUnit = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  testRunId: string,
  requestContext: RequestContext
): Promise<void> => {
  const body = await readBody<ParticipantTestRunNextUnitRequest>(request);
  const participantSessionToken = getTrimmedString(body.participantSessionToken);

  if (!participantSessionToken) {
    sendError(
      response,
      400,
      "invalid_test_run_progress_payload",
      "participantSessionToken is required."
    );
    return;
  }

  const resolvedRun = await resolveParticipantSessionBoundTestRun(store, participantSessionToken, testRunId);

  if (!resolvedRun) {
    sendError(
      response,
      404,
      "test_run_not_found",
      `Test run '${testRunId}' was not found for this participant session.`
    );
    return;
  }

  const updatedTestRun = advanceTestRunToNextUnit(resolvedRun.testRun);

  if (!updatedTestRun) {
    sendError(
      response,
      409,
      "test_run_progress_rejected",
      "The test run could not advance because the current unit has not been saved or the run is not active."
    );
    return;
  }

  await store.updateTestRun(updatedTestRun);
  await recordTestRunAuditEvent({
    store,
    requestContext,
    testRun: updatedTestRun,
    actorType: "participant",
    actorId: resolvedRun.participantSession.loginKey,
    eventType: updatedTestRun.status === "completed"
      ? "participant.test_run.completed"
      : "participant.test_run.advanced",
    payload: updatedTestRun.status === "completed"
      ? {
          completedAt: updatedTestRun.completedAt,
          lastUnitKey: resolvedRun.testRun.currentUnitKey
        }
      : {
          fromUnitKey: resolvedRun.testRun.currentUnitKey,
          toUnitKey: updatedTestRun.currentUnitKey
        }
  });
  sendJson<ParticipantTestRunResponse>(
    response,
    200,
    toParticipantTestRunResponse(updatedTestRun, participantSessionToken)
  );
};

const handleParticipantTestRunNavigate = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse,
  testRunId: string,
  requestContext: RequestContext
): Promise<void> => {
  const body = await readBody<ParticipantTestRunNavigationRequest>(request);
  const participantSessionToken = getTrimmedString(body.participantSessionToken);
  const targetUnitKey = getTrimmedString(body.targetUnitKey);

  if (!participantSessionToken || !targetUnitKey) {
    sendError(
      response,
      400,
      "invalid_test_run_navigation_payload",
      "participantSessionToken and targetUnitKey are required."
    );
    return;
  }

  const resolvedRun = await resolveParticipantSessionBoundTestRun(store, participantSessionToken, testRunId);

  if (!resolvedRun) {
    sendError(
      response,
      404,
      "test_run_not_found",
      `Test run '${testRunId}' was not found for this participant session.`
    );
    return;
  }

  const updatedTestRun = navigateTestRunToUnit(resolvedRun.testRun, targetUnitKey);

  if (!updatedTestRun) {
    sendError(
      response,
      409,
      "test_run_navigation_rejected",
      `The test run could not navigate to unit '${targetUnitKey}' in its current state.`
    );
    return;
  }

  await store.updateTestRun(updatedTestRun);
  await recordTestRunAuditEvent({
    store,
    requestContext,
    testRun: updatedTestRun,
    actorType: "participant",
    actorId: resolvedRun.participantSession.loginKey,
    eventType: "participant.test_run.navigated",
    payload: {
      targetUnitKey
    }
  });
  sendJson<ParticipantTestRunResponse>(
    response,
    200,
    toParticipantTestRunResponse(updatedTestRun, participantSessionToken)
  );
};

const handleMonitorTestRunPause = async (
  store: PlatformStore,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string,
  testRunId: string,
  requestContext: RequestContext
): Promise<void> => {
  const resolvedRun = await resolveWorkspaceScopedTestRun(store, tenantKey, workspaceKey, testRunId);

  if (!resolvedRun) {
    sendError(
      response,
      404,
      "monitor_test_run_not_found",
      `Test run '${testRunId}' was not found in workspace '${workspaceKey}'.`
    );
    return;
  }

  const commandResult = await enqueueMonitorCommand({
    store,
    requestContext,
    testRun: resolvedRun.testRun,
    commandType: "pause"
  });

  sendJson<MonitorTestRunCommandResponse>(
    response,
    200,
    toMonitorTestRunCommandResponse(commandResult.command, commandResult.testRun)
  );
};

const handleMonitorTestRunResume = async (
  store: PlatformStore,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string,
  testRunId: string,
  requestContext: RequestContext
): Promise<void> => {
  const resolvedRun = await resolveWorkspaceScopedTestRun(store, tenantKey, workspaceKey, testRunId);

  if (!resolvedRun) {
    sendError(
      response,
      404,
      "monitor_test_run_not_found",
      `Test run '${testRunId}' was not found in workspace '${workspaceKey}'.`
    );
    return;
  }

  const commandResult = await enqueueMonitorCommand({
    store,
    requestContext,
    testRun: resolvedRun.testRun,
    commandType: "resume"
  });

  sendJson<MonitorTestRunCommandResponse>(
    response,
    200,
    toMonitorTestRunCommandResponse(commandResult.command, commandResult.testRun)
  );
};

const handleMonitorTestRunUnlock = async (
  store: PlatformStore,
  response: ServerResponse,
  tenantKey: string,
  workspaceKey: string,
  testRunId: string,
  requestContext: RequestContext
): Promise<void> => {
  const resolvedRun = await resolveWorkspaceScopedTestRun(store, tenantKey, workspaceKey, testRunId);

  if (!resolvedRun) {
    sendError(
      response,
      404,
      "monitor_test_run_not_found",
      `Test run '${testRunId}' was not found in workspace '${workspaceKey}'.`
    );
    return;
  }

  const commandResult = await enqueueMonitorCommand({
    store,
    requestContext,
    testRun: resolvedRun.testRun,
    commandType: "unlock_navigation"
  });

  sendJson<MonitorTestRunCommandResponse>(
    response,
    200,
    toMonitorTestRunCommandResponse(commandResult.command, commandResult.testRun)
  );
};

const handleRequest = async (
  store: PlatformStore,
  request: IncomingMessage,
  response: ServerResponse
): Promise<void> => {
  const requestContext: RequestContext = {
    requestId: `request-${randomUUID()}`
  };
  const url = new URL(request.url ?? "/", "http://localhost");
  const pathname = url.pathname;
  const method = request.method ?? "GET";

  response.setHeader("x-request-id", requestContext.requestId);

  if (method === "GET" && pathname === apiRoutes.platformHealth) {
    sendJson<HealthResponse>(response, 200, createHealthResponse("api"));
    return;
  }

  if (pathname === apiRoutes.participantAuthSignIn && method === "POST") {
    await handleParticipantAuthSignIn(store, request, response, requestContext);
    return;
  }

  if (pathname === apiRoutes.participantStarter && method === "GET") {
    await handleParticipantStarterGet(store, response, url);
    return;
  }

  if (pathname.match(participantSystemCheckRoutePattern) && method === "GET") {
    await handleParticipantSystemCheckGet(store, response, url);
    return;
  }

  if (pathname.match(participantSystemCheckEvidenceCaptureRoutePattern) && method === "POST") {
    await handleParticipantSystemCheckEvidenceCapture(store, request, response, requestContext);
    return;
  }

  if (pathname.match(participantSystemCheckSubmitRoutePattern) && method === "POST") {
    await handleParticipantSystemCheckSubmit(store, request, response, requestContext);
    return;
  }

  const systemCheckEvidenceAccessRouteMatch = pathname.match(systemCheckEvidenceAccessRoutePattern);

  if (systemCheckEvidenceAccessRouteMatch) {
    const [, accessToken] = systemCheckEvidenceAccessRouteMatch;

    if (method === "GET") {
      await handleSystemCheckEvidenceAccessGet(store, response, accessToken);
      return;
    }
  }

  if (pathname === apiRoutes.participantStarterLaunch && method === "POST") {
    await handleParticipantStarterLaunch(store, request, response, requestContext);
    return;
  }

  if (pathname === apiRoutes.platformTenants) {
    if (method === "GET") {
      await handlePlatformTenantsGet(store, response);
      return;
    }

    if (method === "POST") {
      await handlePlatformTenantsPost(store, request, response, requestContext);
      return;
    }
  }

  const tenantActivationPolicyRouteMatch = pathname.match(tenantActivationPolicyRoutePattern);

  if (tenantActivationPolicyRouteMatch) {
    const [, tenantKey] = tenantActivationPolicyRouteMatch;

    if (method === "GET") {
      await handleTenantActivationPolicyGet(store, response, tenantKey);
      return;
    }

    if (method === "PATCH") {
      await handleTenantActivationPolicyPatch(store, request, response, tenantKey, requestContext);
      return;
    }
  }

  const tenantOperationalPolicyRouteMatch = pathname.match(tenantOperationalPolicyRoutePattern);

  if (tenantOperationalPolicyRouteMatch) {
    const [, tenantKey] = tenantOperationalPolicyRouteMatch;

    if (method === "GET") {
      await handleTenantOperationalPolicyGet(store, response, tenantKey);
      return;
    }

    if (method === "PATCH") {
      await handleTenantOperationalPolicyPatch(store, request, response, tenantKey, requestContext);
      return;
    }
  }

  const tenantLaunchApprovalPolicyRouteMatch = pathname.match(tenantLaunchApprovalPolicyRoutePattern);

  if (tenantLaunchApprovalPolicyRouteMatch) {
    const [, tenantKey] = tenantLaunchApprovalPolicyRouteMatch;

    if (method === "GET") {
      await handleTenantLaunchApprovalPolicyGet(store, response, tenantKey);
      return;
    }

    if (method === "PATCH") {
      await handleTenantLaunchApprovalPolicyPatch(store, request, response, tenantKey, requestContext);
      return;
    }
  }

  const tenantNotificationProviderPromotionPolicyRouteMatch = pathname.match(
    tenantNotificationProviderPromotionPolicyRoutePattern
  );

  if (tenantNotificationProviderPromotionPolicyRouteMatch) {
    const [, tenantKey] = tenantNotificationProviderPromotionPolicyRouteMatch;

    if (method === "GET") {
      await handleTenantNotificationProviderPromotionPolicyGet(store, response, tenantKey);
      return;
    }

    if (method === "PATCH") {
      await handleTenantNotificationProviderPromotionPolicyPatch(
        store,
        request,
        response,
        tenantKey,
        requestContext
      );
      return;
    }
  }

  const tenantNotificationPolicyRouteMatch = pathname.match(tenantNotificationPolicyRoutePattern);

  if (tenantNotificationPolicyRouteMatch) {
    const [, tenantKey] = tenantNotificationPolicyRouteMatch;

    if (method === "GET") {
      await handleTenantNotificationPolicyGet(store, response, tenantKey);
      return;
    }

    if (method === "PATCH") {
      await handleTenantNotificationPolicyPatch(store, request, response, tenantKey, requestContext);
      return;
    }
  }

  const tenantGovernanceNotificationPolicyRouteMatch = pathname.match(
    tenantGovernanceNotificationPolicyRoutePattern
  );

  if (tenantGovernanceNotificationPolicyRouteMatch) {
    const [, tenantKey] = tenantGovernanceNotificationPolicyRouteMatch;

    if (method === "GET") {
      await handleTenantGovernanceNotificationPolicyGet(store, response, tenantKey);
      return;
    }

    if (method === "PATCH") {
      await handleTenantGovernanceNotificationPolicyPatch(
        store,
        request,
        response,
        tenantKey,
        requestContext
      );
      return;
    }
  }

  const tenantRecoveryGovernanceNotificationPolicyRouteMatch = pathname.match(
    tenantRecoveryGovernanceNotificationPolicyRoutePattern
  );

  if (tenantRecoveryGovernanceNotificationPolicyRouteMatch) {
    const [, tenantKey] = tenantRecoveryGovernanceNotificationPolicyRouteMatch;

    if (method === "GET") {
      await handleTenantRecoveryGovernanceNotificationPolicyGet(store, response, tenantKey);
      return;
    }

    if (method === "PATCH") {
      await handleTenantRecoveryGovernanceNotificationPolicyPatch(
        store,
        request,
        response,
        tenantKey,
        requestContext
      );
      return;
    }
  }

  const tenantNotificationProviderProfilesRouteMatch = pathname.match(
    tenantNotificationProviderProfilesRoutePattern
  );

  if (tenantNotificationProviderProfilesRouteMatch) {
    const [, tenantKey] = tenantNotificationProviderProfilesRouteMatch;

    if (method === "GET") {
      await handleTenantNotificationProviderProfilesGet(store, response, tenantKey);
      return;
    }

    if (method === "PATCH") {
      await handleTenantNotificationProviderProfilesPatch(
        store,
        request,
        response,
        tenantKey,
        requestContext
      );
      return;
    }
  }

  const tenantEvidenceRetentionPolicyRouteMatch = pathname.match(tenantEvidenceRetentionPolicyRoutePattern);

  if (tenantEvidenceRetentionPolicyRouteMatch) {
    const [, tenantKey] = tenantEvidenceRetentionPolicyRouteMatch;

    if (method === "GET") {
      await handleTenantEvidenceRetentionPolicyGet(store, response, tenantKey);
      return;
    }

    if (method === "PATCH") {
      await handleTenantEvidenceRetentionPolicyPatch(store, request, response, tenantKey, requestContext);
      return;
    }
  }

  const tenantEvidenceRetentionClassPolicyRouteMatch = pathname.match(
    tenantEvidenceRetentionClassPolicyRoutePattern
  );

  if (tenantEvidenceRetentionClassPolicyRouteMatch) {
    const [, tenantKey] = tenantEvidenceRetentionClassPolicyRouteMatch;

    if (method === "GET") {
      await handleTenantEvidenceRetentionClassPolicyGet(store, response, tenantKey);
      return;
    }

    if (method === "PATCH") {
      await handleTenantEvidenceRetentionClassPolicyPatch(
        store,
        request,
        response,
        tenantKey,
        requestContext
      );
      return;
    }
  }

  const tenantPolicyHistoryRouteMatch = pathname.match(tenantPolicyHistoryRoutePattern);

  if (tenantPolicyHistoryRouteMatch) {
    const [, tenantKey] = tenantPolicyHistoryRouteMatch;

    if (method === "GET") {
      await handleTenantPolicyHistoryGet(store, response, url, tenantKey);
      return;
    }
  }

  const workspacesRouteMatch = pathname.match(tenantWorkspaceRoutePattern);

  if (workspacesRouteMatch) {
    const [, tenantKey] = workspacesRouteMatch;

    if (method === "GET") {
      await handleTenantWorkspacesGet(store, response, tenantKey);
      return;
    }

    if (method === "POST") {
      await handleTenantWorkspacesPost(store, request, response, tenantKey, requestContext);
      return;
    }
  }

  const workspaceActivationPolicyRouteMatch = pathname.match(workspaceActivationPolicyRoutePattern);

  if (workspaceActivationPolicyRouteMatch) {
    const [, tenantKey, workspaceKey] = workspaceActivationPolicyRouteMatch;

    if (method === "GET") {
      await handleWorkspaceActivationPolicyGet(store, response, tenantKey, workspaceKey);
      return;
    }

    if (method === "PATCH") {
      await handleWorkspaceActivationPolicyPatch(store, request, response, tenantKey, workspaceKey, requestContext);
      return;
    }
  }

  const workspaceOperationalPolicyRouteMatch = pathname.match(workspaceOperationalPolicyRoutePattern);

  if (workspaceOperationalPolicyRouteMatch) {
    const [, tenantKey, workspaceKey] = workspaceOperationalPolicyRouteMatch;

    if (method === "GET") {
      await handleWorkspaceOperationalPolicyGet(store, response, tenantKey, workspaceKey);
      return;
    }

    if (method === "PATCH") {
      await handleWorkspaceOperationalPolicyPatch(store, request, response, tenantKey, workspaceKey, requestContext);
      return;
    }
  }

  const workspaceLaunchApprovalPolicyRouteMatch = pathname.match(workspaceLaunchApprovalPolicyRoutePattern);

  if (workspaceLaunchApprovalPolicyRouteMatch) {
    const [, tenantKey, workspaceKey] = workspaceLaunchApprovalPolicyRouteMatch;

    if (method === "GET") {
      await handleWorkspaceLaunchApprovalPolicyGet(store, response, tenantKey, workspaceKey);
      return;
    }

    if (method === "PATCH") {
      await handleWorkspaceLaunchApprovalPolicyPatch(
        store,
        request,
        response,
        tenantKey,
        workspaceKey,
        requestContext
      );
      return;
    }
  }

  const workspaceNotificationProviderPromotionPolicyRouteMatch = pathname.match(
    workspaceNotificationProviderPromotionPolicyRoutePattern
  );

  if (workspaceNotificationProviderPromotionPolicyRouteMatch) {
    const [, tenantKey, workspaceKey] = workspaceNotificationProviderPromotionPolicyRouteMatch;

    if (method === "GET") {
      await handleWorkspaceNotificationProviderPromotionPolicyGet(
        store,
        response,
        tenantKey,
        workspaceKey
      );
      return;
    }

    if (method === "PATCH") {
      await handleWorkspaceNotificationProviderPromotionPolicyPatch(
        store,
        request,
        response,
        tenantKey,
        workspaceKey,
        requestContext
      );
      return;
    }
  }

  const workspaceNotificationPolicyRouteMatch = pathname.match(workspaceNotificationPolicyRoutePattern);

  if (workspaceNotificationPolicyRouteMatch) {
    const [, tenantKey, workspaceKey] = workspaceNotificationPolicyRouteMatch;

    if (method === "GET") {
      await handleWorkspaceNotificationPolicyGet(store, response, tenantKey, workspaceKey);
      return;
    }

    if (method === "PATCH") {
      await handleWorkspaceNotificationPolicyPatch(
        store,
        request,
        response,
        tenantKey,
        workspaceKey,
        requestContext
      );
      return;
    }
  }

  const workspaceGovernanceNotificationPolicyRouteMatch = pathname.match(
    workspaceGovernanceNotificationPolicyRoutePattern
  );

  if (workspaceGovernanceNotificationPolicyRouteMatch) {
    const [, tenantKey, workspaceKey] = workspaceGovernanceNotificationPolicyRouteMatch;

    if (method === "GET") {
      await handleWorkspaceGovernanceNotificationPolicyGet(
        store,
        response,
        tenantKey,
        workspaceKey
      );
      return;
    }

    if (method === "PATCH") {
      await handleWorkspaceGovernanceNotificationPolicyPatch(
        store,
        request,
        response,
        tenantKey,
        workspaceKey,
        requestContext
      );
      return;
    }
  }

  const workspaceRecoveryGovernanceNotificationPolicyRouteMatch = pathname.match(
    workspaceRecoveryGovernanceNotificationPolicyRoutePattern
  );

  if (workspaceRecoveryGovernanceNotificationPolicyRouteMatch) {
    const [, tenantKey, workspaceKey] = workspaceRecoveryGovernanceNotificationPolicyRouteMatch;

    if (method === "GET") {
      await handleWorkspaceRecoveryGovernanceNotificationPolicyGet(
        store,
        response,
        tenantKey,
        workspaceKey
      );
      return;
    }

    if (method === "PATCH") {
      await handleWorkspaceRecoveryGovernanceNotificationPolicyPatch(
        store,
        request,
        response,
        tenantKey,
        workspaceKey,
        requestContext
      );
      return;
    }
  }

  const workspaceNotificationProviderProfilesRouteMatch = pathname.match(
    workspaceNotificationProviderProfilesRoutePattern
  );

  if (workspaceNotificationProviderProfilesRouteMatch) {
    const [, tenantKey, workspaceKey] = workspaceNotificationProviderProfilesRouteMatch;

    if (method === "GET") {
      await handleWorkspaceNotificationProviderProfilesGet(
        store,
        response,
        tenantKey,
        workspaceKey
      );
      return;
    }

    if (method === "PATCH") {
      await handleWorkspaceNotificationProviderProfilesPatch(
        store,
        request,
        response,
        tenantKey,
        workspaceKey,
        requestContext
      );
      return;
    }
  }

  const workspaceNotificationProviderProfileRolloutMetricsRouteMatch = pathname.match(
    workspaceNotificationProviderProfileRolloutMetricsRoutePattern
  );

  if (workspaceNotificationProviderProfileRolloutMetricsRouteMatch) {
    const [, tenantKey, workspaceKey] = workspaceNotificationProviderProfileRolloutMetricsRouteMatch;

    if (method === "GET") {
      await handleWorkspaceNotificationProviderProfileRolloutMetricsGet(
        store,
        response,
        url,
        tenantKey,
        workspaceKey
      );
      return;
    }
  }

  const workspaceNotificationProviderProfilePromoteRouteMatch = pathname.match(
    workspaceNotificationProviderProfilePromoteRoutePattern
  );

  if (workspaceNotificationProviderProfilePromoteRouteMatch) {
    const [, tenantKey, workspaceKey, profileKey] = workspaceNotificationProviderProfilePromoteRouteMatch;

    if (method === "POST") {
      await handleWorkspaceNotificationProviderProfilePromote(
        store,
        request,
        response,
        tenantKey,
        workspaceKey,
        profileKey,
        requestContext
      );
      return;
    }
  }

  const workspaceNotificationProviderProfileIncidentsRouteMatch = pathname.match(
    workspaceNotificationProviderProfileIncidentsRoutePattern
  );

  if (workspaceNotificationProviderProfileIncidentsRouteMatch) {
    const [, tenantKey, workspaceKey] = workspaceNotificationProviderProfileIncidentsRouteMatch;

    if (method === "GET") {
      await handleWorkspaceNotificationProviderProfileIncidentsGet(
        store,
        response,
        url,
        tenantKey,
        workspaceKey
      );
      return;
    }
  }

  const workspaceNotificationProviderProfileGovernanceQueueRouteMatch = pathname.match(
    workspaceNotificationProviderProfileGovernanceQueueRoutePattern
  );

  if (workspaceNotificationProviderProfileGovernanceQueueRouteMatch) {
    const [, tenantKey, workspaceKey] = workspaceNotificationProviderProfileGovernanceQueueRouteMatch;

    if (method === "GET") {
      await handleWorkspaceNotificationProviderProfileGovernanceQueueGet(
        store,
        response,
        url,
        tenantKey,
        workspaceKey
      );
      return;
    }
  }

  const workspaceNotificationProviderProfileGovernanceAlertsRouteMatch = pathname.match(
    workspaceNotificationProviderProfileGovernanceAlertsRoutePattern
  );

  if (workspaceNotificationProviderProfileGovernanceAlertsRouteMatch) {
    const [, tenantKey, workspaceKey] = workspaceNotificationProviderProfileGovernanceAlertsRouteMatch;

    if (method === "GET") {
      await handleWorkspaceNotificationProviderProfileGovernanceAlertsGet(
        store,
        response,
        url,
        tenantKey,
        workspaceKey
      );
      return;
    }
  }

  const workspaceNotificationProviderProfileGovernanceAlertMetricsRouteMatch = pathname.match(
    workspaceNotificationProviderProfileGovernanceAlertMetricsRoutePattern
  );

  if (workspaceNotificationProviderProfileGovernanceAlertMetricsRouteMatch) {
    const [, tenantKey, workspaceKey] =
      workspaceNotificationProviderProfileGovernanceAlertMetricsRouteMatch;

    if (method === "GET") {
      await handleWorkspaceNotificationProviderProfileGovernanceAlertMetricsGet(
        store,
        response,
        url,
        tenantKey,
        workspaceKey
      );
      return;
    }
  }

  const workspaceNotificationProviderProfileGovernanceAlertTrendsRouteMatch = pathname.match(
    workspaceNotificationProviderProfileGovernanceAlertTrendsRoutePattern
  );

  if (workspaceNotificationProviderProfileGovernanceAlertTrendsRouteMatch) {
    const [, tenantKey, workspaceKey] =
      workspaceNotificationProviderProfileGovernanceAlertTrendsRouteMatch;

    if (method === "GET") {
      await handleWorkspaceNotificationProviderProfileGovernanceAlertTrendsGet(
        store,
        response,
        url,
        tenantKey,
        workspaceKey
      );
      return;
    }
  }

  const workspaceNotificationProviderProfileGovernanceCorrelationsRouteMatch = pathname.match(
    workspaceNotificationProviderProfileGovernanceCorrelationsRoutePattern
  );

  if (workspaceNotificationProviderProfileGovernanceCorrelationsRouteMatch) {
    const [, tenantKey, workspaceKey] =
      workspaceNotificationProviderProfileGovernanceCorrelationsRouteMatch;

    if (method === "GET") {
      await handleWorkspaceNotificationProviderProfileGovernanceCorrelationsGet(
        store,
        response,
        url,
        tenantKey,
        workspaceKey
      );
      return;
    }
  }

  const workspaceNotificationProviderProfileGovernanceCasesRouteMatch = pathname.match(
    workspaceNotificationProviderProfileGovernanceCasesRoutePattern
  );

  if (workspaceNotificationProviderProfileGovernanceCasesRouteMatch) {
    const [, tenantKey, workspaceKey] =
      workspaceNotificationProviderProfileGovernanceCasesRouteMatch;

    if (method === "GET") {
      await handleWorkspaceNotificationProviderProfileGovernanceCasesGet(
        store,
        response,
        url,
        tenantKey,
        workspaceKey
      );
      return;
    }
  }

  const workspaceNotificationProviderProfileGovernanceCaseQueueRouteMatch = pathname.match(
    workspaceNotificationProviderProfileGovernanceCaseQueueRoutePattern
  );

  if (workspaceNotificationProviderProfileGovernanceCaseQueueRouteMatch) {
    const [, tenantKey, workspaceKey] =
      workspaceNotificationProviderProfileGovernanceCaseQueueRouteMatch;

    if (method === "GET") {
      await handleWorkspaceNotificationProviderProfileGovernanceCaseQueueGet(
        store,
        response,
        url,
        tenantKey,
        workspaceKey
      );
      return;
    }
  }

  const workspaceNotificationProviderProfileGovernanceCaseAssignRouteMatch = pathname.match(
    workspaceNotificationProviderProfileGovernanceCaseAssignRoutePattern
  );

  if (workspaceNotificationProviderProfileGovernanceCaseAssignRouteMatch) {
    const [, tenantKey, workspaceKey, incidentId] =
      workspaceNotificationProviderProfileGovernanceCaseAssignRouteMatch;

    if (method === "POST") {
      await handleWorkspaceNotificationProviderProfileGovernanceCaseAssign(
        store,
        request,
        response,
        tenantKey,
        workspaceKey,
        incidentId,
        requestContext
      );
      return;
    }
  }

  const workspaceNotificationProviderProfileGovernanceCaseEscalateRouteMatch = pathname.match(
    workspaceNotificationProviderProfileGovernanceCaseEscalateRoutePattern
  );

  if (workspaceNotificationProviderProfileGovernanceCaseEscalateRouteMatch) {
    const [, tenantKey, workspaceKey, incidentId] =
      workspaceNotificationProviderProfileGovernanceCaseEscalateRouteMatch;

    if (method === "POST") {
      await handleWorkspaceNotificationProviderProfileGovernanceCaseEscalate(
        store,
        request,
        response,
        tenantKey,
        workspaceKey,
        incidentId,
        requestContext
      );
      return;
    }
  }

  const workspaceNotificationProviderProfileGovernanceAlertDeadLetterQueueRouteMatch = pathname.match(
    workspaceNotificationProviderProfileGovernanceAlertDeadLetterQueueRoutePattern
  );

  if (workspaceNotificationProviderProfileGovernanceAlertDeadLetterQueueRouteMatch) {
    const [, tenantKey, workspaceKey] =
      workspaceNotificationProviderProfileGovernanceAlertDeadLetterQueueRouteMatch;

    if (method === "GET") {
      await handleWorkspaceNotificationProviderProfileGovernanceAlertDeadLetterQueueGet(
        store,
        response,
        url,
        tenantKey,
        workspaceKey
      );
      return;
    }
  }

  const workspaceNotificationProviderProfileIncidentAcknowledgeRouteMatch = pathname.match(
    workspaceNotificationProviderProfileIncidentAcknowledgeRoutePattern
  );

  if (workspaceNotificationProviderProfileIncidentAcknowledgeRouteMatch) {
    const [, tenantKey, workspaceKey, incidentId] =
      workspaceNotificationProviderProfileIncidentAcknowledgeRouteMatch;

    if (method === "POST") {
      await handleWorkspaceNotificationProviderProfileIncidentAcknowledge(
        store,
        request,
        response,
        tenantKey,
        workspaceKey,
        incidentId,
        requestContext
      );
      return;
    }
  }

  const workspaceNotificationProviderProfileGovernanceAlertAcknowledgeRouteMatch = pathname.match(
    workspaceNotificationProviderProfileGovernanceAlertAcknowledgeRoutePattern
  );

  if (workspaceNotificationProviderProfileGovernanceAlertAcknowledgeRouteMatch) {
    const [, tenantKey, workspaceKey, alertId] =
      workspaceNotificationProviderProfileGovernanceAlertAcknowledgeRouteMatch;

    if (method === "POST") {
      await handleWorkspaceNotificationProviderProfileGovernanceAlertAcknowledge(
        store,
        request,
        response,
        tenantKey,
        workspaceKey,
        alertId,
        requestContext
      );
      return;
    }
  }

  const workspaceNotificationProviderProfileGovernanceAlertRedriveRouteMatch = pathname.match(
    workspaceNotificationProviderProfileGovernanceAlertRedriveRoutePattern
  );

  if (workspaceNotificationProviderProfileGovernanceAlertRedriveRouteMatch) {
    const [, tenantKey, workspaceKey, alertId] =
      workspaceNotificationProviderProfileGovernanceAlertRedriveRouteMatch;

    if (method === "POST") {
      await handleWorkspaceNotificationProviderProfileGovernanceAlertRedrive(
        store,
        request,
        response,
        tenantKey,
        workspaceKey,
        alertId,
        requestContext
      );
      return;
    }
  }

  const workspaceEvidenceRetentionPolicyRouteMatch = pathname.match(workspaceEvidenceRetentionPolicyRoutePattern);

  if (workspaceEvidenceRetentionPolicyRouteMatch) {
    const [, tenantKey, workspaceKey] = workspaceEvidenceRetentionPolicyRouteMatch;

    if (method === "GET") {
      await handleWorkspaceEvidenceRetentionPolicyGet(store, response, tenantKey, workspaceKey);
      return;
    }

    if (method === "PATCH") {
      await handleWorkspaceEvidenceRetentionPolicyPatch(
        store,
        request,
        response,
        tenantKey,
        workspaceKey,
        requestContext
      );
      return;
    }
  }

  const workspaceEvidenceRetentionClassPolicyRouteMatch = pathname.match(
    workspaceEvidenceRetentionClassPolicyRoutePattern
  );

  if (workspaceEvidenceRetentionClassPolicyRouteMatch) {
    const [, tenantKey, workspaceKey] = workspaceEvidenceRetentionClassPolicyRouteMatch;

    if (method === "GET") {
      await handleWorkspaceEvidenceRetentionClassPolicyGet(store, response, tenantKey, workspaceKey);
      return;
    }

    if (method === "PATCH") {
      await handleWorkspaceEvidenceRetentionClassPolicyPatch(
        store,
        request,
        response,
        tenantKey,
        workspaceKey,
        requestContext
      );
      return;
    }
  }

  const workspaceEvidenceRetentionClassesRouteMatch = pathname.match(
    workspaceEvidenceRetentionClassesRoutePattern
  );

  if (workspaceEvidenceRetentionClassesRouteMatch) {
    const [, tenantKey, workspaceKey] = workspaceEvidenceRetentionClassesRouteMatch;

    if (method === "GET") {
      await handleWorkspaceEvidenceRetentionClassesGet(store, response, tenantKey, workspaceKey);
      return;
    }
  }

  const workspacePolicyHistoryRouteMatch = pathname.match(workspacePolicyHistoryRoutePattern);

  if (workspacePolicyHistoryRouteMatch) {
    const [, tenantKey, workspaceKey] = workspacePolicyHistoryRouteMatch;

    if (method === "GET") {
      await handleWorkspacePolicyHistoryGet(store, response, url, tenantKey, workspaceKey);
      return;
    }
  }

  const workspaceSystemCheckResultsRouteMatch = pathname.match(workspaceSystemCheckResultsRoutePattern);

  if (workspaceSystemCheckResultsRouteMatch) {
    const [, tenantKey, workspaceKey] = workspaceSystemCheckResultsRouteMatch;

    if (method === "GET") {
      await handleWorkspaceSystemCheckResultsGet(store, response, url, tenantKey, workspaceKey);
      return;
    }
  }

  const workspaceSystemCheckReadinessRouteMatch = pathname.match(workspaceSystemCheckReadinessRoutePattern);

  if (workspaceSystemCheckReadinessRouteMatch) {
    const [, tenantKey, workspaceKey] = workspaceSystemCheckReadinessRouteMatch;

    if (method === "GET") {
      await handleWorkspaceSystemCheckReadinessGet(store, response, url, tenantKey, workspaceKey);
      return;
    }
  }

  const workspaceSystemCheckEvidenceHoldQueueRouteMatch = pathname.match(
    workspaceSystemCheckEvidenceHoldQueueRoutePattern
  );

  if (workspaceSystemCheckEvidenceHoldQueueRouteMatch) {
    const [, tenantKey, workspaceKey] = workspaceSystemCheckEvidenceHoldQueueRouteMatch;

    if (method === "GET") {
      await handleWorkspaceSystemCheckEvidenceHoldQueueGet(
        store,
        response,
        url,
        tenantKey,
        workspaceKey
      );
      return;
    }
  }

  const workspaceSystemCheckEvidenceBreachQueueRouteMatch = pathname.match(
    workspaceSystemCheckEvidenceBreachQueueRoutePattern
  );

  if (workspaceSystemCheckEvidenceBreachQueueRouteMatch) {
    const [, tenantKey, workspaceKey] = workspaceSystemCheckEvidenceBreachQueueRouteMatch;

    if (method === "GET") {
      await handleWorkspaceSystemCheckEvidenceBreachQueueGet(
        store,
        response,
        url,
        tenantKey,
        workspaceKey
      );
      return;
    }
  }

  const workspaceSystemCheckEvidenceBreachDeadLetterQueueRouteMatch = pathname.match(
    workspaceSystemCheckEvidenceBreachDeadLetterQueueRoutePattern
  );

  if (workspaceSystemCheckEvidenceBreachDeadLetterQueueRouteMatch) {
    const [, tenantKey, workspaceKey] = workspaceSystemCheckEvidenceBreachDeadLetterQueueRouteMatch;

    if (method === "GET") {
      await handleWorkspaceSystemCheckEvidenceBreachDeadLetterQueueGet(
        store,
        response,
        url,
        tenantKey,
        workspaceKey
      );
      return;
    }
  }

  const workspaceSystemCheckEvidenceBreachNotificationsRouteMatch = pathname.match(
    workspaceSystemCheckEvidenceBreachNotificationsRoutePattern
  );

  if (workspaceSystemCheckEvidenceBreachNotificationsRouteMatch) {
    const [, tenantKey, workspaceKey] = workspaceSystemCheckEvidenceBreachNotificationsRouteMatch;

    if (method === "GET") {
      await handleWorkspaceSystemCheckEvidenceBreachNotificationsGet(
        store,
        response,
        url,
        tenantKey,
        workspaceKey
      );
      return;
    }
  }

  const workspaceSystemCheckLaunchApprovalRevokeRouteMatch =
    pathname.match(workspaceSystemCheckLaunchApprovalRevokeRoutePattern);

  if (workspaceSystemCheckLaunchApprovalRevokeRouteMatch) {
    const [, tenantKey, workspaceKey, launchApprovalId] = workspaceSystemCheckLaunchApprovalRevokeRouteMatch;

    if (method === "POST") {
      await handleWorkspaceSystemCheckLaunchApprovalRevoke(
        store,
        request,
        response,
        tenantKey,
        workspaceKey,
        launchApprovalId,
        requestContext
      );
      return;
    }
  }

  const workspaceSystemCheckLaunchApprovalsRouteMatch = pathname.match(workspaceSystemCheckLaunchApprovalsRoutePattern);

  if (workspaceSystemCheckLaunchApprovalsRouteMatch) {
    const [, tenantKey, workspaceKey] = workspaceSystemCheckLaunchApprovalsRouteMatch;

    if (method === "GET") {
      await handleWorkspaceSystemCheckLaunchApprovalsGet(
        store,
        response,
        url,
        tenantKey,
        workspaceKey,
        requestContext
      );
      return;
    }

    if (method === "POST") {
      await handleWorkspaceSystemCheckLaunchApprovalsPost(
        store,
        request,
        response,
        tenantKey,
        workspaceKey,
        requestContext
      );
      return;
    }
  }

  const workspaceSystemCheckEvidenceRouteMatch = pathname.match(workspaceSystemCheckEvidenceRoutePattern);

  const workspaceSystemCheckEvidenceHoldRouteMatch = pathname.match(
    workspaceSystemCheckEvidenceHoldRoutePattern
  );

  if (workspaceSystemCheckEvidenceHoldRouteMatch) {
    const [, tenantKey, workspaceKey, evidenceKey] = workspaceSystemCheckEvidenceHoldRouteMatch;

    if (method === "POST") {
      await handleWorkspaceSystemCheckEvidenceHold(
        store,
        request,
        response,
        tenantKey,
        workspaceKey,
        evidenceKey,
        requestContext
      );
      return;
    }
  }

  const workspaceSystemCheckEvidenceAcknowledgeHoldRouteMatch = pathname.match(
    workspaceSystemCheckEvidenceAcknowledgeHoldRoutePattern
  );

  if (workspaceSystemCheckEvidenceAcknowledgeHoldRouteMatch) {
    const [, tenantKey, workspaceKey, evidenceKey] =
      workspaceSystemCheckEvidenceAcknowledgeHoldRouteMatch;

    if (method === "POST") {
      await handleWorkspaceSystemCheckEvidenceAcknowledgeHold(
        store,
        request,
        response,
        tenantKey,
        workspaceKey,
        evidenceKey,
        requestContext
      );
      return;
    }
  }

  const workspaceSystemCheckEvidenceBreachNotificationAcknowledgeRouteMatch = pathname.match(
    workspaceSystemCheckEvidenceBreachNotificationAcknowledgeRoutePattern
  );

  if (workspaceSystemCheckEvidenceBreachNotificationAcknowledgeRouteMatch) {
    const [, tenantKey, workspaceKey, notificationId] =
      workspaceSystemCheckEvidenceBreachNotificationAcknowledgeRouteMatch;

    if (method === "POST") {
      await handleWorkspaceSystemCheckEvidenceBreachNotificationAcknowledge(
        store,
        request,
        response,
        tenantKey,
        workspaceKey,
        notificationId,
        requestContext
      );
      return;
    }
  }

  const workspaceSystemCheckEvidenceBreachNotificationRedriveRouteMatch = pathname.match(
    workspaceSystemCheckEvidenceBreachNotificationRedriveRoutePattern
  );

  if (workspaceSystemCheckEvidenceBreachNotificationRedriveRouteMatch) {
    const [, tenantKey, workspaceKey, notificationId] =
      workspaceSystemCheckEvidenceBreachNotificationRedriveRouteMatch;

    if (method === "POST") {
      await handleWorkspaceSystemCheckEvidenceBreachNotificationRedrive(
        store,
        request,
        response,
        tenantKey,
        workspaceKey,
        notificationId,
        requestContext
      );
      return;
    }
  }

  const workspaceSystemCheckEvidenceAssignHoldRouteMatch = pathname.match(
    workspaceSystemCheckEvidenceAssignHoldRoutePattern
  );

  if (workspaceSystemCheckEvidenceAssignHoldRouteMatch) {
    const [, tenantKey, workspaceKey, evidenceKey] = workspaceSystemCheckEvidenceAssignHoldRouteMatch;

    if (method === "POST") {
      await handleWorkspaceSystemCheckEvidenceAssignHold(
        store,
        request,
        response,
        tenantKey,
        workspaceKey,
        evidenceKey,
        requestContext
      );
      return;
    }
  }

  const workspaceSystemCheckEvidenceReleaseHoldRouteMatch = pathname.match(
    workspaceSystemCheckEvidenceReleaseHoldRoutePattern
  );

  if (workspaceSystemCheckEvidenceReleaseHoldRouteMatch) {
    const [, tenantKey, workspaceKey, evidenceKey] = workspaceSystemCheckEvidenceReleaseHoldRouteMatch;

    if (method === "POST") {
      await handleWorkspaceSystemCheckEvidenceReleaseHold(
        store,
        request,
        response,
        tenantKey,
        workspaceKey,
        evidenceKey,
        requestContext
      );
      return;
    }
  }

  const workspaceSystemCheckEvidenceRetentionHistoryRouteMatch = pathname.match(
    workspaceSystemCheckEvidenceRetentionHistoryRoutePattern
  );

  if (workspaceSystemCheckEvidenceRetentionHistoryRouteMatch) {
    const [, tenantKey, workspaceKey, evidenceKey] = workspaceSystemCheckEvidenceRetentionHistoryRouteMatch;

    if (method === "GET") {
      await handleWorkspaceSystemCheckEvidenceRetentionHistoryGet(
        store,
        response,
        url,
        tenantKey,
        workspaceKey,
        evidenceKey,
        requestContext
      );
      return;
    }
  }

  if (workspaceSystemCheckEvidenceRouteMatch) {
    const [, tenantKey, workspaceKey, evidenceKey] = workspaceSystemCheckEvidenceRouteMatch;

    if (method === "GET") {
      await handleWorkspaceSystemCheckEvidenceGet(
        store,
        response,
        tenantKey,
        workspaceKey,
        evidenceKey,
        requestContext
      );
      return;
    }
  }

  const workspaceSystemCheckResultReviewRouteMatch = pathname.match(workspaceSystemCheckResultReviewRoutePattern);

  if (workspaceSystemCheckResultReviewRouteMatch) {
    const [, tenantKey, workspaceKey, systemCheckSubmissionId] = workspaceSystemCheckResultReviewRouteMatch;

    if (method === "POST") {
      await handleWorkspaceSystemCheckResultReview(
        store,
        request,
        response,
        tenantKey,
        workspaceKey,
        systemCheckSubmissionId,
        requestContext
      );
      return;
    }
  }

  const workspaceAuditEventsRouteMatch = pathname.match(workspaceAuditEventsRoutePattern);

  if (workspaceAuditEventsRouteMatch) {
    const [, tenantKey, workspaceKey] = workspaceAuditEventsRouteMatch;

    if (method === "GET") {
      await handleWorkspaceAuditEventsGet(store, response, url, tenantKey, workspaceKey);
      return;
    }
  }

  const workspaceMonitorCommandsRouteMatch = pathname.match(workspaceMonitorCommandsRoutePattern);

  if (workspaceMonitorCommandsRouteMatch) {
    const [, tenantKey, workspaceKey] = workspaceMonitorCommandsRouteMatch;

    if (method === "GET") {
      await handleWorkspaceMonitorCommandsGet(store, response, url, tenantKey, workspaceKey);
      return;
    }
  }

  const workspaceMonitorTestRunsRouteMatch = pathname.match(workspaceMonitorTestRunsRoutePattern);

  if (workspaceMonitorTestRunsRouteMatch) {
    const [, tenantKey, workspaceKey] = workspaceMonitorTestRunsRouteMatch;

    if (method === "GET") {
      await handleWorkspaceMonitorTestRunsGet(store, response, url, tenantKey, workspaceKey);
      return;
    }
  }

  const monitorTestRunPauseRouteMatch = pathname.match(monitorTestRunPauseRoutePattern);

  if (monitorTestRunPauseRouteMatch) {
    const [, tenantKey, workspaceKey, testRunId] = monitorTestRunPauseRouteMatch;

    if (method === "POST") {
      await handleMonitorTestRunPause(store, response, tenantKey, workspaceKey, testRunId, requestContext);
      return;
    }
  }

  const monitorTestRunResumeRouteMatch = pathname.match(monitorTestRunResumeRoutePattern);

  if (monitorTestRunResumeRouteMatch) {
    const [, tenantKey, workspaceKey, testRunId] = monitorTestRunResumeRouteMatch;

    if (method === "POST") {
      await handleMonitorTestRunResume(store, response, tenantKey, workspaceKey, testRunId, requestContext);
      return;
    }
  }

  const monitorTestRunUnlockRouteMatch = pathname.match(monitorTestRunUnlockRoutePattern);

  if (monitorTestRunUnlockRouteMatch) {
    const [, tenantKey, workspaceKey, testRunId] = monitorTestRunUnlockRouteMatch;

    if (method === "POST") {
      await handleMonitorTestRunUnlock(store, response, tenantKey, workspaceKey, testRunId, requestContext);
      return;
    }
  }

  const sourcePackagesRouteMatch = pathname.match(sourcePackagesRoutePattern);

  if (sourcePackagesRouteMatch) {
    const [, tenantKey, workspaceKey] = sourcePackagesRouteMatch;

    if (method === "GET") {
      await handleSourcePackagesGet(store, response, tenantKey, workspaceKey);
      return;
    }

    if (method === "POST") {
      await handleSourcePackagesPost(store, request, response, tenantKey, workspaceKey, requestContext);
      return;
    }
  }

  const importJobsRouteMatch = pathname.match(importJobsRoutePattern);

  if (importJobsRouteMatch) {
    const [, tenantKey, workspaceKey] = importJobsRouteMatch;

    if (method === "GET") {
      await handleImportJobsGet(store, response, tenantKey, workspaceKey);
      return;
    }

    if (method === "POST") {
      await handleImportJobsPost(store, request, response, tenantKey, workspaceKey, requestContext);
      return;
    }
  }

  const importJobRouteMatch = pathname.match(importJobRoutePattern);

  if (importJobRouteMatch) {
    const [, tenantKey, workspaceKey, importJobId] = importJobRouteMatch;

    if (method === "GET") {
      await handleImportJobGet(store, response, tenantKey, workspaceKey, importJobId);
      return;
    }
  }

  const contentReleasesRouteMatch = pathname.match(contentReleasesRoutePattern);

  if (contentReleasesRouteMatch) {
    const [, tenantKey, workspaceKey] = contentReleasesRouteMatch;

    if (method === "GET") {
      await handleContentReleasesGet(store, response, tenantKey, workspaceKey);
      return;
    }
  }

  const contentReleaseRouteMatch = pathname.match(contentReleaseRoutePattern);

  if (contentReleaseRouteMatch) {
    const [, tenantKey, workspaceKey, contentReleaseId] = contentReleaseRouteMatch;

    if (method === "GET") {
      await handleContentReleaseGet(store, response, tenantKey, workspaceKey, contentReleaseId);
      return;
    }
  }

  const contentReleaseMonitorProjectionRouteMatch = pathname.match(contentReleaseMonitorProjectionRoutePattern);

  if (contentReleaseMonitorProjectionRouteMatch) {
    const [, tenantKey, workspaceKey, contentReleaseId] = contentReleaseMonitorProjectionRouteMatch;

    if (method === "GET") {
      await handleContentReleaseMonitorProjectionGet(store, response, tenantKey, workspaceKey, contentReleaseId);
      return;
    }
  }

  const contentReleaseSystemCheckProjectionRouteMatch = pathname.match(contentReleaseSystemCheckProjectionRoutePattern);

  if (contentReleaseSystemCheckProjectionRouteMatch) {
    const [, tenantKey, workspaceKey, contentReleaseId] = contentReleaseSystemCheckProjectionRouteMatch;

    if (method === "GET") {
      await handleContentReleaseSystemCheckProjectionGet(store, response, tenantKey, workspaceKey, contentReleaseId);
      return;
    }
  }

  const contentReleaseActivateRouteMatch = pathname.match(contentReleaseActivateRoutePattern);

  if (contentReleaseActivateRouteMatch) {
    const [, tenantKey, workspaceKey, contentReleaseId] = contentReleaseActivateRouteMatch;

    if (method === "POST") {
      await handleContentReleaseActivate(store, response, tenantKey, workspaceKey, contentReleaseId, requestContext);
      return;
    }
  }

  const participantTestRunRouteMatch = pathname.match(participantTestRunRoutePattern);

  if (participantTestRunRouteMatch) {
    const [, testRunId] = participantTestRunRouteMatch;

    if (method === "GET") {
      await handleParticipantTestRunGet(store, response, url, testRunId);
      return;
    }
  }

  const participantTestRunSaveRouteMatch = pathname.match(participantTestRunSaveRoutePattern);

  if (participantTestRunSaveRouteMatch) {
    const [, testRunId] = participantTestRunSaveRouteMatch;

    if (method === "POST") {
      await handleParticipantTestRunSave(store, request, response, testRunId, requestContext);
      return;
    }
  }

  const participantTestRunNextUnitRouteMatch = pathname.match(participantTestRunNextUnitRoutePattern);

  if (participantTestRunNextUnitRouteMatch) {
    const [, testRunId] = participantTestRunNextUnitRouteMatch;

    if (method === "POST") {
      await handleParticipantTestRunNextUnit(store, request, response, testRunId, requestContext);
      return;
    }
  }

  const participantTestRunNavigateRouteMatch = pathname.match(participantTestRunNavigateRoutePattern);

  if (participantTestRunNavigateRouteMatch) {
    const [, testRunId] = participantTestRunNavigateRouteMatch;

    if (method === "POST") {
      await handleParticipantTestRunNavigate(store, request, response, testRunId, requestContext);
      return;
    }
  }

  sendError(response, 404, "route_not_found", `No route matched ${method} ${pathname}`);
};

const main = async (): Promise<void> => {
  const pool = createDatabasePool();
  const store = createPostgresPlatformStore(pool);

  await ensureSeedData(store);

  const server = createServer((request, response) => {
    handleRequest(store, request, response).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : "Unexpected server error.";
      sendError(response, 500, "internal_error", message);
    });
  });

  const port = Number(process.env.PORT ?? 4100);

  server.listen(port, () => {
    console.log(`rewrite-spike api listening on http://localhost:${port}`);
    console.log(`rewrite-spike api using database ${process.env.DATABASE_URL ?? defaultDatabaseUrl}`);
  });

  const shutdown = async (): Promise<void> => {
    await new Promise<void>(resolve => {
      server.close(() => resolve());
    });
    await store.close();
  };

  process.on("SIGINT", () => {
    shutdown().finally(() => process.exit(0));
  });

  process.on("SIGTERM", () => {
    shutdown().finally(() => process.exit(0));
  });
};

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  console.error(message);
  process.exit(1);
});
