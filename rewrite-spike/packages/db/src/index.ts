import { Pool, type QueryResultRow } from "pg";

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

export { runMigrations, type MigrationRunResult, type DatabaseMigration } from "./migrations.js";

import {
  mapGovernanceCasePolicy,
  mapGovernanceCasePolicyOverrideRecords
} from "./governance-case-policy-mappers.js";
import { runMigrations } from "./migrations.js";
import {
  mapAuditEvent,
  mapContentRelease,
  mapImportJob,
  mapMonitorCommand,
  mapNotificationProviderProfileGovernanceAlert,
  mapNotificationProviderProfileIncident,
  mapParticipantSession,
  mapSourcePackage,
  mapSystemCheckEvidence,
  mapSystemCheckEvidenceAccessGrant,
  mapSystemCheckEvidenceBreachNotification,
  mapSystemCheckLaunchApproval,
  mapSystemCheckSubmission,
  mapTenant,
  mapTestRun,
  mapWorkspace
} from "./row-mappers.js";

export const defaultDatabaseUrl = "postgresql://postgres:postgres@127.0.0.1:55432/testcenter_rewrite_spike";
export const monitorCommandDispatchQueueChannel = "monitor_command_dispatch_queue";
export const breachNotificationDispatchQueueChannel = "system_check_evidence_breach_notification_queue";

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
        w.governance_notification_policy_override,
        w.recovery_governance_notification_policy_override,
        w.governance_case_policy_override,
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
  saveNotificationProviderProfileGovernanceAlert: (
    alert: NotificationProviderProfileGovernanceAlert
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
  updateNotificationProviderProfileGovernanceAlert: (
    alert: NotificationProviderProfileGovernanceAlert
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
  getNotificationProviderProfileGovernanceAlertById: (
    alertId: string
  ) => Promise<NotificationProviderProfileGovernanceAlert | undefined>;
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
  listNotificationProviderProfileGovernanceAlertsByWorkspace: (
    tenantKey: string,
    workspaceKey: string,
    options?: {
      profileKey?: string;
      status?: NotificationProviderProfileGovernanceAlert["status"];
      deliveryStatus?: NotificationProviderProfileGovernanceAlert["deliveryStatus"];
      deliveryChannel?: NotificationProviderProfileGovernanceAlert["deliveryChannel"];
      limit?: number;
    }
  ) => Promise<NotificationProviderProfileGovernanceAlert[]>;
  listPendingNotificationProviderProfileGovernanceAlertDeliveries: (
    limit: number
  ) => Promise<NotificationProviderProfileGovernanceAlert[]>;
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
          default_governance_notification_policy, default_recovery_governance_notification_policy,
          default_governance_case_policy, default_notification_provider_profiles,
          default_evidence_retention_policy, default_evidence_retention_class_policy
        )
        VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb, $14::jsonb, $15::jsonb)
        ON CONFLICT (tenant_key) DO UPDATE
        SET display_name = EXCLUDED.display_name,
            status = EXCLUDED.status,
            default_activation_policy = EXCLUDED.default_activation_policy,
            default_operational_policy = EXCLUDED.default_operational_policy,
            default_launch_approval_policy = EXCLUDED.default_launch_approval_policy,
            default_notification_provider_promotion_policy = EXCLUDED.default_notification_provider_promotion_policy,
            default_notification_policy = EXCLUDED.default_notification_policy,
            default_governance_notification_policy = EXCLUDED.default_governance_notification_policy,
            default_recovery_governance_notification_policy = EXCLUDED.default_recovery_governance_notification_policy,
            default_governance_case_policy = EXCLUDED.default_governance_case_policy,
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
        JSON.stringify(tenant.defaultGovernanceNotificationPolicy),
        JSON.stringify(tenant.defaultRecoveryGovernanceNotificationPolicy),
        JSON.stringify(tenant.defaultGovernanceCasePolicy),
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
          governance_notification_policy_override, recovery_governance_notification_policy_override,
          governance_case_policy_override, notification_provider_profile_override,
          evidence_retention_policy_override, evidence_retention_class_policy_override
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8::jsonb, $9::jsonb, $10::jsonb, $11::jsonb, $12::jsonb, $13::jsonb, $14::jsonb, $15::jsonb, $16::jsonb)
        ON CONFLICT (tenant_id, workspace_key) DO UPDATE
        SET display_name = EXCLUDED.display_name,
            status = EXCLUDED.status,
            activation_policy_override = EXCLUDED.activation_policy_override,
            operational_policy_override = EXCLUDED.operational_policy_override,
            launch_approval_policy_override = EXCLUDED.launch_approval_policy_override,
            notification_provider_promotion_policy_override = EXCLUDED.notification_provider_promotion_policy_override,
            notification_policy_override = EXCLUDED.notification_policy_override,
            governance_notification_policy_override = EXCLUDED.governance_notification_policy_override,
            recovery_governance_notification_policy_override = EXCLUDED.recovery_governance_notification_policy_override,
            governance_case_policy_override = EXCLUDED.governance_case_policy_override,
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
        workspace.governanceNotificationPolicyOverrideRecords
          ? JSON.stringify(workspace.governanceNotificationPolicyOverrideRecords)
          : null,
        workspace.recoveryGovernanceNotificationPolicyOverrideRecords
          ? JSON.stringify(workspace.recoveryGovernanceNotificationPolicyOverrideRecords)
          : null,
        workspace.governanceCasePolicyOverrideRecords
          ? JSON.stringify(workspace.governanceCasePolicyOverrideRecords)
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
  saveNotificationProviderProfileGovernanceAlert: async alert => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query(
        `
          INSERT INTO notification_provider_profile_governance_alerts (
            alert_id, incident_id, tenant_id, workspace_id, profile_key, alert_class, status, governance_status,
            created_at, created_by_actor_type, created_by_actor_id, source_request_id,
            delivery_profile_key, delivery_channel, delivery_status, delivery_target,
            delivery_attempt_count, max_delivery_attempts, next_delivery_attempt_at,
            last_delivery_attempt_at, last_delivery_receipt_id, last_delivery_receipt_issued_at,
            delivered_at, last_delivery_error, acknowledged_at, acknowledged_by_actor_id,
            acknowledgement_note
          )
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27)
        `,
        [
          alert.alertId,
          alert.incidentId,
          alert.tenantId,
          alert.workspaceId,
          alert.profileKey,
          alert.alertClass,
          alert.status,
          alert.governanceStatus,
          alert.createdAt,
          alert.createdByActorType,
          alert.createdByActorId,
          alert.sourceRequestId,
          alert.deliveryProfileKey,
          alert.deliveryChannel,
          alert.deliveryStatus,
          alert.deliveryTarget,
          alert.deliveryAttemptCount,
          alert.maxDeliveryAttempts,
          alert.nextDeliveryAttemptAt,
          alert.lastDeliveryAttemptAt,
          alert.lastDeliveryReceiptId,
          alert.lastDeliveryReceiptIssuedAt,
          alert.deliveredAt,
          alert.lastDeliveryError,
          alert.acknowledgedAt,
          alert.acknowledgedByActorId,
          alert.acknowledgementNote
        ]
      );
      await client.query(`NOTIFY ${breachNotificationDispatchQueueChannel}`);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
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
  updateNotificationProviderProfileGovernanceAlert: async alert => {
    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query(
        `
          UPDATE notification_provider_profile_governance_alerts
          SET alert_class = $2,
              status = $3,
              governance_status = $4,
              source_request_id = $5,
              delivery_profile_key = $6,
              delivery_channel = $7,
              delivery_status = $8,
              delivery_target = $9,
              delivery_attempt_count = $10,
              max_delivery_attempts = $11,
              next_delivery_attempt_at = $12,
              last_delivery_attempt_at = $13,
              last_delivery_receipt_id = $14,
              last_delivery_receipt_issued_at = $15,
              delivered_at = $16,
              last_delivery_error = $17,
              acknowledged_at = $18,
              acknowledged_by_actor_id = $19,
              acknowledgement_note = $20
          WHERE alert_id = $1
        `,
        [
          alert.alertId,
          alert.alertClass,
          alert.status,
          alert.governanceStatus,
          alert.sourceRequestId,
          alert.deliveryProfileKey,
          alert.deliveryChannel,
          alert.deliveryStatus,
          alert.deliveryTarget,
          alert.deliveryAttemptCount,
          alert.maxDeliveryAttempts,
          alert.nextDeliveryAttemptAt,
          alert.lastDeliveryAttemptAt,
          alert.lastDeliveryReceiptId,
          alert.lastDeliveryReceiptIssuedAt,
          alert.deliveredAt,
          alert.lastDeliveryError,
          alert.acknowledgedAt,
          alert.acknowledgedByActorId,
          alert.acknowledgementNote
        ]
      );

      if (alert.deliveryStatus === "pending_delivery") {
        await client.query(
          "SELECT pg_notify($1, $2)",
          [breachNotificationDispatchQueueChannel, alert.alertId]
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
          default_governance_notification_policy, default_recovery_governance_notification_policy,
          default_governance_case_policy, default_notification_provider_profiles,
          default_evidence_retention_policy, default_evidence_retention_class_policy
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
          default_governance_notification_policy, default_recovery_governance_notification_policy,
          default_governance_case_policy, default_notification_provider_profiles,
          default_evidence_retention_policy, default_evidence_retention_class_policy
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
          governance_notification_policy_override, recovery_governance_notification_policy_override,
          governance_case_policy_override, notification_provider_profile_override,
          evidence_retention_policy_override, evidence_retention_class_policy_override
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
  getNotificationProviderProfileGovernanceAlertById: async alertId => {
    const result = await pool.query(
      `
        SELECT
          alert_id, incident_id, tenant_id, workspace_id, profile_key, alert_class, status, governance_status,
          created_at, created_by_actor_type, created_by_actor_id, source_request_id,
          delivery_profile_key, delivery_channel, delivery_status, delivery_target,
          delivery_attempt_count, max_delivery_attempts, next_delivery_attempt_at,
          last_delivery_attempt_at, last_delivery_receipt_id, last_delivery_receipt_issued_at,
          delivered_at, last_delivery_error, acknowledged_at, acknowledged_by_actor_id,
          acknowledgement_note
        FROM notification_provider_profile_governance_alerts
        WHERE alert_id = $1
      `,
      [alertId]
    );

    return result.rows[0] ? mapNotificationProviderProfileGovernanceAlert(result.rows[0]) : undefined;
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
  listNotificationProviderProfileGovernanceAlertsByWorkspace: async (
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

    if (options.status) {
      filters.push(options.status);
      whereClauses.push(`status = $${filters.length}`);
    }

    if (options.deliveryStatus) {
      filters.push(options.deliveryStatus);
      whereClauses.push(`delivery_status = $${filters.length}`);
    }

    if (options.deliveryChannel) {
      filters.push(options.deliveryChannel);
      whereClauses.push(`delivery_channel = $${filters.length}`);
    }

    filters.push(options.limit ?? 50);

    const result = await pool.query(
      `
        SELECT
          alert_id, incident_id, tenant_id, workspace_id, profile_key, alert_class, status, governance_status,
          created_at, created_by_actor_type, created_by_actor_id, source_request_id,
          delivery_profile_key, delivery_channel, delivery_status, delivery_target,
          delivery_attempt_count, max_delivery_attempts, next_delivery_attempt_at,
          last_delivery_attempt_at, last_delivery_receipt_id, last_delivery_receipt_issued_at,
          delivered_at, last_delivery_error, acknowledged_at, acknowledged_by_actor_id,
          acknowledgement_note
        FROM notification_provider_profile_governance_alerts
        WHERE ${whereClauses.join(" AND ")}
        ORDER BY created_at DESC
        LIMIT $${filters.length}
      `,
      filters
    );

    return result.rows.map(mapNotificationProviderProfileGovernanceAlert);
  },
  listPendingNotificationProviderProfileGovernanceAlertDeliveries: async limit => {
    const result = await pool.query(
      `
        SELECT
          alert_id, incident_id, tenant_id, workspace_id, profile_key, alert_class, status, governance_status,
          created_at, created_by_actor_type, created_by_actor_id, source_request_id,
          delivery_profile_key, delivery_channel, delivery_status, delivery_target,
          delivery_attempt_count, max_delivery_attempts, next_delivery_attempt_at,
          last_delivery_attempt_at, last_delivery_receipt_id, last_delivery_receipt_issued_at,
          delivered_at, last_delivery_error, acknowledged_at, acknowledged_by_actor_id,
          acknowledgement_note
        FROM notification_provider_profile_governance_alerts
        WHERE delivery_status = 'pending_delivery'
          AND COALESCE(next_delivery_attempt_at, created_at) <= NOW()
        ORDER BY COALESCE(next_delivery_attempt_at, created_at) ASC, created_at ASC
        LIMIT $1
      `,
      [limit]
    );

    return result.rows.map(mapNotificationProviderProfileGovernanceAlert);
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
          default_governance_notification_policy, default_recovery_governance_notification_policy,
          default_governance_case_policy, default_notification_provider_profiles,
          default_evidence_retention_policy, default_evidence_retention_class_policy
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
          w.governance_notification_policy_override,
          w.recovery_governance_notification_policy_override,
          w.governance_case_policy_override,
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
