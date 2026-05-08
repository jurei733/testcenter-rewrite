import { type QueryResultRow } from "pg";

import {
  defaultEvidenceRetentionClassPolicy,
  defaultGovernanceCasePolicy,
  defaultGovernanceNotificationPolicy,
  defaultRecoveryGovernanceNotificationPolicy,
  defaultNotificationPolicy,
  defaultNotificationProviderPromotionPolicy
} from "@testcenter-rewrite/domain";
import type {
  AuditEvent,
  ContentRelease,
  ImportJob,
  MonitorCommand,
  NotificationProviderProfileGovernanceAlert,
  NotificationProviderProfileIncident,
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

import {
  mapGovernanceCasePolicy,
  mapGovernanceCasePolicyOverrideRecords
} from "./governance-case-policy-mappers.js";
import {
  mapActivationPolicyOverrideRecords,
  mapEvidenceRetentionClassPolicy,
  mapEvidenceRetentionClassPolicyOverrideRecords,
  mapEvidenceRetentionPolicyOverrideRecords,
  mapLaunchApprovalPolicyOverrideRecords,
  mapNotificationPolicyOverrideRecords,
  mapNotificationProviderProfileOverrideRecords,
  mapNotificationProviderProfiles,
  mapNotificationProviderPromotionPolicy,
  mapNotificationProviderPromotionPolicyOverrideRecords,
  mapOperationalPolicyOverrideRecords
} from "./policy-mappers.js";

export const mapTenant = (row: QueryResultRow): Tenant => ({
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
  defaultGovernanceNotificationPolicy: row.default_governance_notification_policy
    ? {
        breachNotificationDeliverySelectionMode:
          row.default_governance_notification_policy.breachNotificationDeliverySelectionMode ??
          defaultGovernanceNotificationPolicy.breachNotificationDeliverySelectionMode,
        webhookSpikeRetryDelaySeconds:
          row.default_governance_notification_policy.webhookSpikeRetryDelaySeconds ??
          row.default_governance_notification_policy.breachNotificationRetryDelaySeconds ??
          defaultGovernanceNotificationPolicy.webhookSpikeRetryDelaySeconds,
        webhookSpikeMaxDeliveryAttempts:
          row.default_governance_notification_policy.webhookSpikeMaxDeliveryAttempts ??
          row.default_governance_notification_policy.breachNotificationMaxDeliveryAttempts ??
          defaultGovernanceNotificationPolicy.webhookSpikeMaxDeliveryAttempts,
        emailSpikeRetryDelaySeconds:
          row.default_governance_notification_policy.emailSpikeRetryDelaySeconds ??
          row.default_governance_notification_policy.breachNotificationRetryDelaySeconds ??
          defaultGovernanceNotificationPolicy.emailSpikeRetryDelaySeconds,
        emailSpikeMaxDeliveryAttempts:
          row.default_governance_notification_policy.emailSpikeMaxDeliveryAttempts ??
          row.default_governance_notification_policy.breachNotificationMaxDeliveryAttempts ??
          defaultGovernanceNotificationPolicy.emailSpikeMaxDeliveryAttempts
      }
    : defaultGovernanceNotificationPolicy,
  defaultRecoveryGovernanceNotificationPolicy: row.default_recovery_governance_notification_policy
    ? {
        breachNotificationDeliverySelectionMode:
          row.default_recovery_governance_notification_policy.breachNotificationDeliverySelectionMode ??
          defaultRecoveryGovernanceNotificationPolicy.breachNotificationDeliverySelectionMode,
        webhookSpikeRetryDelaySeconds:
          row.default_recovery_governance_notification_policy.webhookSpikeRetryDelaySeconds ??
          row.default_recovery_governance_notification_policy.breachNotificationRetryDelaySeconds ??
          defaultRecoveryGovernanceNotificationPolicy.webhookSpikeRetryDelaySeconds,
        webhookSpikeMaxDeliveryAttempts:
          row.default_recovery_governance_notification_policy.webhookSpikeMaxDeliveryAttempts ??
          row.default_recovery_governance_notification_policy.breachNotificationMaxDeliveryAttempts ??
          defaultRecoveryGovernanceNotificationPolicy.webhookSpikeMaxDeliveryAttempts,
        emailSpikeRetryDelaySeconds:
          row.default_recovery_governance_notification_policy.emailSpikeRetryDelaySeconds ??
          row.default_recovery_governance_notification_policy.breachNotificationRetryDelaySeconds ??
          defaultRecoveryGovernanceNotificationPolicy.emailSpikeRetryDelaySeconds,
        emailSpikeMaxDeliveryAttempts:
          row.default_recovery_governance_notification_policy.emailSpikeMaxDeliveryAttempts ??
          row.default_recovery_governance_notification_policy.breachNotificationMaxDeliveryAttempts ??
          defaultRecoveryGovernanceNotificationPolicy.emailSpikeMaxDeliveryAttempts
      }
    : defaultRecoveryGovernanceNotificationPolicy,
  defaultGovernanceCasePolicy:
    mapGovernanceCasePolicy(row.default_governance_case_policy) ??
    defaultGovernanceCasePolicy,
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

export const mapWorkspace = (row: QueryResultRow): Workspace => ({
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
  governanceNotificationPolicyOverrideRecords:
    mapNotificationPolicyOverrideRecords(row.governance_notification_policy_override),
  recoveryGovernanceNotificationPolicyOverrideRecords:
    mapNotificationPolicyOverrideRecords(row.recovery_governance_notification_policy_override),
  governanceCasePolicyOverrideRecords:
    mapGovernanceCasePolicyOverrideRecords(row.governance_case_policy_override),
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

export const mapSourcePackage = (row: QueryResultRow): SourcePackage => ({
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

export const mapImportJob = (row: QueryResultRow): ImportJob => ({
  importJobId: row.import_job_id,
  tenantId: row.tenant_id,
  workspaceId: row.workspace_id,
  sourcePackageId: row.source_package_id,
  status: row.status,
  createdAt: row.created_at.toISOString(),
  completedAt: row.completed_at ? row.completed_at.toISOString() : null,
  failureMessage: row.failure_message ?? null
});

export const mapContentRelease = (row: QueryResultRow): ContentRelease => ({
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

export const mapParticipantSession = (row: QueryResultRow): ParticipantSession => ({
  participantSessionId: row.participant_session_id,
  sessionToken: row.session_token,
  tenantId: row.tenant_id,
  workspaceId: row.workspace_id,
  contentReleaseId: row.content_release_id,
  loginKey: row.login_key,
  groupKey: row.group_key,
  createdAt: row.created_at.toISOString()
});

export const mapTestRun = (row: QueryResultRow): TestRun => ({
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

export const mapSystemCheckSubmission = (row: QueryResultRow): SystemCheckSubmission => ({
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

export const mapSystemCheckEvidence = (row: QueryResultRow): SystemCheckEvidence => ({
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

export const mapSystemCheckEvidenceAccessGrant = (
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

export const mapSystemCheckEvidenceBreachNotification = (
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

export const mapNotificationProviderProfileIncident = (
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

export const mapNotificationProviderProfileGovernanceAlert = (
  row: QueryResultRow
): NotificationProviderProfileGovernanceAlert => ({
  alertId: row.alert_id,
  incidentId: row.incident_id,
  tenantId: row.tenant_id,
  workspaceId: row.workspace_id,
  profileKey: row.profile_key,
  alertClass: row.alert_class ?? "incident_open",
  status: row.status,
  governanceStatus: row.governance_status,
  createdAt: row.created_at.toISOString(),
  createdByActorType: row.created_by_actor_type,
  createdByActorId: row.created_by_actor_id,
  sourceRequestId: row.source_request_id ?? null,
  deliveryProfileKey: row.delivery_profile_key ?? null,
  deliveryChannel: row.delivery_channel,
  deliveryStatus: row.delivery_status,
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

export const mapSystemCheckLaunchApproval = (row: QueryResultRow): SystemCheckLaunchApproval => ({
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

export const mapAuditEvent = (row: QueryResultRow): AuditEvent => ({
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

export const mapMonitorCommand = (row: QueryResultRow): MonitorCommand => ({
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
