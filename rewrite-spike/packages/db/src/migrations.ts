import type { Pool } from "pg";

export interface DatabaseMigration {
  version: string;
  name: string;
  sql: string;
}

export interface MigrationRunResult {
  appliedVersions: string[];
  pendingVersions: string[];
}

const schemaMigrationsTableSql = `
CREATE TABLE IF NOT EXISTS schema_migrations (
  version TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
`;

export const databaseMigrations: DatabaseMigration[] = [
  {
    version: "0001",
    name: "initial-platform-schema",
    sql: `
CREATE TABLE IF NOT EXISTS tenants (
  tenant_id TEXT PRIMARY KEY,
  tenant_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workspaces (
  workspace_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  workspace_key TEXT NOT NULL,
  display_name TEXT NOT NULL,
  status TEXT NOT NULL,
  active_content_release_id TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (tenant_id, workspace_key)
);

CREATE TABLE IF NOT EXISTS source_packages (
  source_package_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  file_name TEXT NOT NULL,
  manifest_hash TEXT NOT NULL,
  format TEXT NOT NULL,
  status TEXT NOT NULL,
  uploaded_at TIMESTAMPTZ NOT NULL,
  uploaded_by TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS import_jobs (
  import_job_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  source_package_id TEXT NOT NULL REFERENCES source_packages(source_package_id) ON DELETE CASCADE,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NULL,
  failure_message TEXT NULL
);

CREATE TABLE IF NOT EXISTS content_releases (
  content_release_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  source_package_id TEXT NOT NULL REFERENCES source_packages(source_package_id) ON DELETE CASCADE,
  import_job_id TEXT NOT NULL REFERENCES import_jobs(import_job_id) ON DELETE CASCADE,
  fixture_key TEXT NOT NULL,
  release_label TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  activated_at TIMESTAMPTZ NULL,
  canonical_payload JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS participant_sessions (
  participant_session_id TEXT PRIMARY KEY,
  session_token TEXT NOT NULL UNIQUE,
  tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  content_release_id TEXT NOT NULL REFERENCES content_releases(content_release_id) ON DELETE CASCADE,
  login_key TEXT NOT NULL,
  group_key TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE TABLE IF NOT EXISTS test_runs (
  test_run_id TEXT PRIMARY KEY,
  participant_session_id TEXT NOT NULL REFERENCES participant_sessions(participant_session_id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  content_release_id TEXT NOT NULL REFERENCES content_releases(content_release_id) ON DELETE CASCADE,
  login_key TEXT NOT NULL,
  group_key TEXT NOT NULL,
  assignment_key TEXT NOT NULL,
  attempt_number INTEGER NOT NULL,
  booklet_key TEXT NOT NULL,
  booklet_title TEXT NOT NULL,
  status TEXT NOT NULL,
  unit_sequence JSONB NOT NULL,
  current_unit_index INTEGER NOT NULL,
  current_unit_key TEXT NOT NULL,
  initial_state_overrides JSONB NOT NULL,
  unit_responses JSONB NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL,
  completed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_workspaces_tenant_id ON workspaces(tenant_id);
CREATE INDEX IF NOT EXISTS idx_source_packages_workspace ON source_packages(tenant_id, workspace_id, uploaded_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_jobs_workspace ON import_jobs(tenant_id, workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_import_jobs_status ON import_jobs(status, created_at);
CREATE INDEX IF NOT EXISTS idx_content_releases_workspace ON content_releases(tenant_id, workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_participant_sessions_token ON participant_sessions(session_token);
CREATE INDEX IF NOT EXISTS idx_test_runs_session_assignment ON test_runs(participant_session_id, assignment_key, created_at DESC);
`
  },
  {
    version: "0002",
    name: "test-run-runtime-policy-controls",
    sql: `
ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS navigation_locked BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS time_limit_seconds INTEGER NULL;
ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS pause_accumulated_ms INTEGER NOT NULL DEFAULT 0;
ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ NULL;
`
  },
  {
    version: "0003",
    name: "workspace-audit-events",
    sql: `
CREATE TABLE IF NOT EXISTS audit_events (
  audit_event_id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  tenant_id TEXT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  workspace_id TEXT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  participant_session_id TEXT NULL REFERENCES participant_sessions(participant_session_id) ON DELETE SET NULL,
  test_run_id TEXT NULL REFERENCES test_runs(test_run_id) ON DELETE SET NULL,
  login_key TEXT NULL,
  group_key TEXT NULL,
  assignment_key TEXT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload JSONB NOT NULL,
  occurred_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_audit_events_workspace_occurred_at
  ON audit_events(tenant_id, workspace_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS idx_audit_events_request_id
  ON audit_events(request_id);
`
  },
  {
    version: "0004",
    name: "monitor-commands",
    sql: `
CREATE TABLE IF NOT EXISTS monitor_commands (
  command_id TEXT PRIMARY KEY,
  request_id TEXT NOT NULL,
  tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  test_run_id TEXT NOT NULL REFERENCES test_runs(test_run_id) ON DELETE CASCADE,
  participant_session_id TEXT NOT NULL REFERENCES participant_sessions(participant_session_id) ON DELETE CASCADE,
  login_key TEXT NOT NULL,
  group_key TEXT NOT NULL,
  assignment_key TEXT NOT NULL,
  attempt_number INTEGER NOT NULL,
  command_type TEXT NOT NULL,
  ack_state TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL,
  delivered_at TIMESTAMPTZ NULL,
  resolved_at TIMESTAMPTZ NULL,
  rejection_reason TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_monitor_commands_workspace_issued_at
  ON monitor_commands(tenant_id, workspace_id, issued_at DESC);

CREATE INDEX IF NOT EXISTS idx_monitor_commands_test_run_issued_at
  ON monitor_commands(test_run_id, issued_at DESC);
`
  },
  {
    version: "0005",
    name: "runtime-maintenance-indexes",
    sql: `
CREATE INDEX IF NOT EXISTS idx_test_runs_active_timeout_candidates
  ON test_runs(created_at ASC)
  WHERE status = 'active' AND time_limit_seconds IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_monitor_commands_expiry_candidates
  ON monitor_commands(COALESCE(delivered_at, issued_at), issued_at ASC)
  WHERE resolved_at IS NULL AND ack_state IN ('pending_delivery', 'delivered');
`
  },
  {
    version: "0006",
    name: "monitor-command-dispatch-queue-index",
    sql: `
CREATE INDEX IF NOT EXISTS idx_monitor_commands_pending_delivery
  ON monitor_commands(issued_at ASC)
  WHERE ack_state = 'pending_delivery' AND resolved_at IS NULL;
`
  },
  {
    version: "0007",
    name: "monitor-command-dispatch-queue-table",
    sql: `
CREATE TABLE IF NOT EXISTS monitor_command_dispatch_queue (
  dispatch_queue_id TEXT PRIMARY KEY,
  command_id TEXT NOT NULL UNIQUE REFERENCES monitor_commands(command_id) ON DELETE CASCADE,
  queue_status TEXT NOT NULL,
  claimed_by TEXT NULL,
  attempt_count INTEGER NOT NULL DEFAULT 0,
  enqueued_at TIMESTAMPTZ NOT NULL,
  claimed_at TIMESTAMPTZ NULL,
  lease_expires_at TIMESTAMPTZ NULL,
  completed_at TIMESTAMPTZ NULL,
  last_error TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_monitor_command_dispatch_queue_pending
  ON monitor_command_dispatch_queue(enqueued_at ASC)
  WHERE queue_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_monitor_command_dispatch_queue_claimed_lease
  ON monitor_command_dispatch_queue(lease_expires_at ASC)
  WHERE queue_status = 'claimed';
`
  },
  {
    version: "0008",
    name: "workspace-activation-policy",
    sql: `
ALTER TABLE workspaces
ADD COLUMN IF NOT EXISTS activation_policy JSONB NOT NULL DEFAULT '{
  "blockIncompatibleRoutingChangesWithActiveSessions": true,
  "warnOnActiveSessions": true,
  "warnOnHighRiskReleaseChange": true
}'::jsonb;
`
  },
  {
    version: "0009",
    name: "tenant-default-activation-policy",
    sql: `
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS default_activation_policy JSONB NOT NULL DEFAULT '{
  "blockIncompatibleRoutingChangesWithActiveSessions": true,
  "warnOnActiveSessions": true,
  "warnOnHighRiskReleaseChange": true
}'::jsonb;
`
  },
  {
    version: "0010",
    name: "workspace-activation-policy-live-inheritance",
    sql: `
ALTER TABLE workspaces
RENAME COLUMN activation_policy TO activation_policy_override;

ALTER TABLE workspaces
ALTER COLUMN activation_policy_override DROP NOT NULL;

ALTER TABLE workspaces
ALTER COLUMN activation_policy_override DROP DEFAULT;
`
  },
  {
    version: "0011",
    name: "workspace-operational-policy-live-inheritance",
    sql: `
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS default_operational_policy JSONB NOT NULL DEFAULT '{
  "monitorCommandTtlSeconds": 30,
  "monitorCommandLeaseSeconds": 15,
  "timedRunMaintenanceGraceSeconds": 0
}'::jsonb;

ALTER TABLE workspaces
ADD COLUMN IF NOT EXISTS operational_policy_override JSONB NULL;
`
  },
  {
    version: "0012",
    name: "timed-run-maintenance-grace-policy",
    sql: `
ALTER TABLE tenants
ALTER COLUMN default_operational_policy SET DEFAULT '{
  "monitorCommandTtlSeconds": 30,
  "monitorCommandLeaseSeconds": 15,
  "timedRunMaintenanceGraceSeconds": 0
}'::jsonb;

UPDATE tenants
SET default_operational_policy = default_operational_policy || '{
  "timedRunMaintenanceGraceSeconds": 0
}'::jsonb
WHERE NOT (default_operational_policy ? 'timedRunMaintenanceGraceSeconds');
`
  },
  {
    version: "0013",
    name: "operational-policy-override-records",
    sql: `
UPDATE workspaces
SET operational_policy_override = jsonb_strip_nulls(
  jsonb_build_object(
    'monitorCommandTtlSeconds',
    CASE
      WHEN operational_policy_override ? 'monitorCommandTtlSeconds' THEN
        CASE
          WHEN jsonb_typeof(operational_policy_override->'monitorCommandTtlSeconds') = 'number' THEN
            jsonb_build_object(
              'value', (operational_policy_override->>'monitorCommandTtlSeconds')::integer,
              'updatedAt', to_jsonb(NOW()),
              'updatedByRequestId', to_jsonb('migration-0013-operational-policy-override-records'::text),
              'updatedByActorType', to_jsonb('platform_api'::text),
              'updatedByActorId', to_jsonb('migration-0013'::text)
            )
          ELSE operational_policy_override->'monitorCommandTtlSeconds'
        END
      ELSE NULL
    END,
    'monitorCommandLeaseSeconds',
    CASE
      WHEN operational_policy_override ? 'monitorCommandLeaseSeconds' THEN
        CASE
          WHEN jsonb_typeof(operational_policy_override->'monitorCommandLeaseSeconds') = 'number' THEN
            jsonb_build_object(
              'value', (operational_policy_override->>'monitorCommandLeaseSeconds')::integer,
              'updatedAt', to_jsonb(NOW()),
              'updatedByRequestId', to_jsonb('migration-0013-operational-policy-override-records'::text),
              'updatedByActorType', to_jsonb('platform_api'::text),
              'updatedByActorId', to_jsonb('migration-0013'::text)
            )
          ELSE operational_policy_override->'monitorCommandLeaseSeconds'
        END
      ELSE NULL
    END,
    'timedRunMaintenanceGraceSeconds',
    CASE
      WHEN operational_policy_override ? 'timedRunMaintenanceGraceSeconds' THEN
        CASE
          WHEN jsonb_typeof(operational_policy_override->'timedRunMaintenanceGraceSeconds') = 'number' THEN
            jsonb_build_object(
              'value', (operational_policy_override->>'timedRunMaintenanceGraceSeconds')::integer,
              'updatedAt', to_jsonb(NOW()),
              'updatedByRequestId', to_jsonb('migration-0013-operational-policy-override-records'::text),
              'updatedByActorType', to_jsonb('platform_api'::text),
              'updatedByActorId', to_jsonb('migration-0013'::text)
            )
          ELSE operational_policy_override->'timedRunMaintenanceGraceSeconds'
        END
      ELSE NULL
    END
  )
)
WHERE operational_policy_override IS NOT NULL;
`
  },
  {
    version: "0014",
    name: "activation-policy-override-records",
    sql: `
UPDATE workspaces
SET activation_policy_override = jsonb_strip_nulls(
  jsonb_build_object(
    'blockIncompatibleRoutingChangesWithActiveSessions',
    CASE
      WHEN activation_policy_override ? 'blockIncompatibleRoutingChangesWithActiveSessions' THEN
        CASE
          WHEN jsonb_typeof(activation_policy_override->'blockIncompatibleRoutingChangesWithActiveSessions') = 'boolean' THEN
            jsonb_build_object(
              'value', activation_policy_override->'blockIncompatibleRoutingChangesWithActiveSessions',
              'updatedAt', to_jsonb(NOW()),
              'updatedByRequestId', to_jsonb('migration-0014-activation-policy-override-records'::text),
              'updatedByActorType', to_jsonb('platform_api'::text),
              'updatedByActorId', to_jsonb('migration-0014'::text)
            )
          ELSE activation_policy_override->'blockIncompatibleRoutingChangesWithActiveSessions'
        END
      ELSE NULL
    END,
    'warnOnActiveSessions',
    CASE
      WHEN activation_policy_override ? 'warnOnActiveSessions' THEN
        CASE
          WHEN jsonb_typeof(activation_policy_override->'warnOnActiveSessions') = 'boolean' THEN
            jsonb_build_object(
              'value', activation_policy_override->'warnOnActiveSessions',
              'updatedAt', to_jsonb(NOW()),
              'updatedByRequestId', to_jsonb('migration-0014-activation-policy-override-records'::text),
              'updatedByActorType', to_jsonb('platform_api'::text),
              'updatedByActorId', to_jsonb('migration-0014'::text)
            )
          ELSE activation_policy_override->'warnOnActiveSessions'
        END
      ELSE NULL
    END,
    'warnOnHighRiskReleaseChange',
    CASE
      WHEN activation_policy_override ? 'warnOnHighRiskReleaseChange' THEN
        CASE
          WHEN jsonb_typeof(activation_policy_override->'warnOnHighRiskReleaseChange') = 'boolean' THEN
            jsonb_build_object(
              'value', activation_policy_override->'warnOnHighRiskReleaseChange',
              'updatedAt', to_jsonb(NOW()),
              'updatedByRequestId', to_jsonb('migration-0014-activation-policy-override-records'::text),
              'updatedByActorType', to_jsonb('platform_api'::text),
              'updatedByActorId', to_jsonb('migration-0014'::text)
            )
          ELSE activation_policy_override->'warnOnHighRiskReleaseChange'
        END
      ELSE NULL
    END
  )
)
WHERE activation_policy_override IS NOT NULL;
`
  },
  {
    version: "0015",
    name: "system-check-submissions",
    sql: `
CREATE TABLE IF NOT EXISTS system_check_submissions (
  system_check_submission_id TEXT PRIMARY KEY,
  participant_session_id TEXT NOT NULL REFERENCES participant_sessions(participant_session_id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  content_release_id TEXT NOT NULL REFERENCES content_releases(content_release_id) ON DELETE CASCADE,
  login_key TEXT NOT NULL,
  group_key TEXT NOT NULL,
  system_check_key TEXT NOT NULL,
  status TEXT NOT NULL,
  check_results JSONB NOT NULL,
  submitted_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_system_check_submissions_workspace_submitted_at
  ON system_check_submissions(tenant_id, workspace_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_check_submissions_session_submitted_at
  ON system_check_submissions(participant_session_id, submitted_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_check_submissions_workspace_group_status
  ON system_check_submissions(tenant_id, workspace_id, group_key, status, submitted_at DESC);
`
  },
  {
    version: "0016",
    name: "system-check-review-state",
    sql: `
ALTER TABLE system_check_submissions
ADD COLUMN IF NOT EXISTS review_status TEXT NOT NULL DEFAULT 'pending';

ALTER TABLE system_check_submissions
ADD COLUMN IF NOT EXISTS review_note TEXT NULL;

ALTER TABLE system_check_submissions
ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ NULL;

ALTER TABLE system_check_submissions
ADD COLUMN IF NOT EXISTS reviewed_by_actor_type TEXT NULL;

ALTER TABLE system_check_submissions
ADD COLUMN IF NOT EXISTS reviewed_by_actor_id TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_system_check_submissions_workspace_review_status
  ON system_check_submissions(tenant_id, workspace_id, review_status, submitted_at DESC);
`
  },
  {
    version: "0017",
    name: "system-check-evidence",
    sql: `
CREATE TABLE IF NOT EXISTS system_check_evidence (
  evidence_key TEXT PRIMARY KEY,
  participant_session_id TEXT NOT NULL REFERENCES participant_sessions(participant_session_id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  content_release_id TEXT NOT NULL REFERENCES content_releases(content_release_id) ON DELETE CASCADE,
  login_key TEXT NOT NULL,
  group_key TEXT NOT NULL,
  system_check_key TEXT NOT NULL,
  check_key TEXT NOT NULL,
  file_name TEXT NOT NULL,
  content_type TEXT NOT NULL,
  byte_size INTEGER NOT NULL,
  sha256 TEXT NOT NULL,
  payload_base64 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_system_check_evidence_session_created_at
  ON system_check_evidence(participant_session_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_check_evidence_workspace_created_at
  ON system_check_evidence(tenant_id, workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_check_evidence_workspace_system_check
  ON system_check_evidence(tenant_id, workspace_id, system_check_key, check_key, created_at DESC);
`
  },
  {
    version: "0018",
    name: "system-check-launch-approvals",
    sql: `
CREATE TABLE IF NOT EXISTS system_check_launch_approvals (
  launch_approval_id TEXT PRIMARY KEY,
  participant_session_id TEXT NOT NULL REFERENCES participant_sessions(participant_session_id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  content_release_id TEXT NOT NULL REFERENCES content_releases(content_release_id) ON DELETE CASCADE,
  login_key TEXT NOT NULL,
  group_key TEXT NOT NULL,
  assignment_key TEXT NOT NULL,
  readiness_status TEXT NOT NULL,
  warning_reason_codes JSONB NOT NULL,
  approval_scope TEXT NOT NULL,
  status TEXT NOT NULL,
  approved_at TIMESTAMPTZ NOT NULL,
  approved_by_supervisor_id TEXT NOT NULL,
  approval_note TEXT NOT NULL,
  consumed_at TIMESTAMPTZ NULL,
  consumed_by_test_run_id TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_system_check_launch_approvals_workspace_approved_at
  ON system_check_launch_approvals(tenant_id, workspace_id, approved_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_check_launch_approvals_session_assignment_status
  ON system_check_launch_approvals(participant_session_id, assignment_key, status, approved_at DESC);

ALTER TABLE test_runs
ADD COLUMN IF NOT EXISTS launch_approval_id TEXT NULL;

ALTER TABLE test_runs
ADD COLUMN IF NOT EXISTS launch_approval_scope TEXT NULL;

ALTER TABLE test_runs
ADD COLUMN IF NOT EXISTS launch_approved_by_supervisor_id TEXT NULL;

ALTER TABLE test_runs
ADD COLUMN IF NOT EXISTS launch_approval_note TEXT NULL;

ALTER TABLE test_runs
ADD COLUMN IF NOT EXISTS launch_approved_at TIMESTAMPTZ NULL;
`
  },
  {
    version: "0019",
    name: "system-check-launch-approval-lifecycle",
    sql: `
ALTER TABLE system_check_launch_approvals
ADD COLUMN IF NOT EXISTS invalidated_at TIMESTAMPTZ NULL;

ALTER TABLE system_check_launch_approvals
ADD COLUMN IF NOT EXISTS invalidation_reason_code TEXT NULL;

ALTER TABLE system_check_launch_approvals
ADD COLUMN IF NOT EXISTS invalidation_reason_detail TEXT NULL;

ALTER TABLE system_check_launch_approvals
ADD COLUMN IF NOT EXISTS revoked_at TIMESTAMPTZ NULL;

ALTER TABLE system_check_launch_approvals
ADD COLUMN IF NOT EXISTS revoked_by_supervisor_id TEXT NULL;

ALTER TABLE system_check_launch_approvals
ADD COLUMN IF NOT EXISTS revocation_note TEXT NULL;
`
  },
  {
    version: "0020",
    name: "system-check-launch-approval-expiry",
    sql: `
ALTER TABLE system_check_launch_approvals
ADD COLUMN IF NOT EXISTS expires_at TIMESTAMPTZ NULL;

ALTER TABLE system_check_launch_approvals
ADD COLUMN IF NOT EXISTS expired_at TIMESTAMPTZ NULL;

ALTER TABLE system_check_launch_approvals
ADD COLUMN IF NOT EXISTS expiration_reason_code TEXT NULL;
`
  },
  {
    version: "0021",
    name: "operational-policy-launch-approval-ttl",
    sql: `
ALTER TABLE tenants
ALTER COLUMN default_operational_policy SET DEFAULT '{
  "monitorCommandTtlSeconds": 30,
  "monitorCommandLeaseSeconds": 15,
  "timedRunMaintenanceGraceSeconds": 0,
  "systemCheckLaunchApprovalTtlSeconds": 0
}'::jsonb;

UPDATE tenants
SET default_operational_policy = default_operational_policy || '{
  "systemCheckLaunchApprovalTtlSeconds": 0
}'::jsonb
WHERE NOT (default_operational_policy ? 'systemCheckLaunchApprovalTtlSeconds');

UPDATE workspaces
SET operational_policy_override = jsonb_strip_nulls(
  operational_policy_override || '{
    "systemCheckLaunchApprovalTtlSeconds": null
  }'::jsonb
)
WHERE operational_policy_override IS NOT NULL
  AND NOT (operational_policy_override ? 'systemCheckLaunchApprovalTtlSeconds');
`
  },
  {
    version: "0022",
    name: "launch-approval-policy-family",
    sql: `
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS default_launch_approval_policy JSONB NOT NULL DEFAULT '{
  "systemCheckLaunchApprovalTtlSeconds": 0
}'::jsonb;

ALTER TABLE workspaces
ADD COLUMN IF NOT EXISTS launch_approval_policy_override JSONB NULL;

UPDATE tenants
SET default_launch_approval_policy = jsonb_build_object(
  'systemCheckLaunchApprovalTtlSeconds',
  COALESCE((default_operational_policy->>'systemCheckLaunchApprovalTtlSeconds')::integer, 0)
)
WHERE default_operational_policy ? 'systemCheckLaunchApprovalTtlSeconds'
   OR default_launch_approval_policy = '{}'::jsonb;

UPDATE workspaces
SET launch_approval_policy_override = jsonb_strip_nulls(
  jsonb_build_object(
    'systemCheckLaunchApprovalTtlSeconds',
    CASE
      WHEN operational_policy_override ? 'systemCheckLaunchApprovalTtlSeconds' THEN
        CASE
          WHEN jsonb_typeof(operational_policy_override->'systemCheckLaunchApprovalTtlSeconds') = 'number' THEN
            jsonb_build_object(
              'value', (operational_policy_override->>'systemCheckLaunchApprovalTtlSeconds')::integer,
              'updatedAt', to_jsonb(NOW()),
              'updatedByRequestId', to_jsonb('migration-0022-launch-approval-policy-family'::text),
              'updatedByActorType', to_jsonb('platform_api'::text),
              'updatedByActorId', to_jsonb('migration-0022'::text)
            )
          ELSE operational_policy_override->'systemCheckLaunchApprovalTtlSeconds'
        END
      ELSE NULL
    END
  )
)
WHERE launch_approval_policy_override IS NULL
  AND operational_policy_override IS NOT NULL
  AND operational_policy_override ? 'systemCheckLaunchApprovalTtlSeconds';

ALTER TABLE tenants
ALTER COLUMN default_operational_policy SET DEFAULT '{
  "monitorCommandTtlSeconds": 30,
  "monitorCommandLeaseSeconds": 15,
  "timedRunMaintenanceGraceSeconds": 0
}'::jsonb;

UPDATE tenants
SET default_operational_policy = default_operational_policy - 'systemCheckLaunchApprovalTtlSeconds'
WHERE default_operational_policy ? 'systemCheckLaunchApprovalTtlSeconds';

UPDATE workspaces
SET operational_policy_override = operational_policy_override - 'systemCheckLaunchApprovalTtlSeconds'
WHERE operational_policy_override ? 'systemCheckLaunchApprovalTtlSeconds';
`
  },
  {
    version: "0023",
    name: "system-check-evidence-storage-boundary",
    sql: `
ALTER TABLE system_check_evidence
ADD COLUMN IF NOT EXISTS storage_backend TEXT NOT NULL DEFAULT 'postgres_inline_spike';

ALTER TABLE system_check_evidence
ADD COLUMN IF NOT EXISTS retention_class TEXT NOT NULL DEFAULT 'workspace_review';

ALTER TABLE system_check_evidence
ADD COLUMN IF NOT EXISTS retention_policy_key TEXT NOT NULL DEFAULT 'spike_workspace_review';

ALTER TABLE system_check_evidence
ADD COLUMN IF NOT EXISTS retention_expires_at TIMESTAMPTZ NULL;

CREATE TABLE IF NOT EXISTS system_check_evidence_access_grants (
  access_grant_id TEXT PRIMARY KEY,
  access_token TEXT NOT NULL UNIQUE,
  evidence_key TEXT NOT NULL REFERENCES system_check_evidence(evidence_key) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  participant_session_id TEXT NOT NULL REFERENCES participant_sessions(participant_session_id) ON DELETE CASCADE,
  issued_for TEXT NOT NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT NOT NULL,
  issued_at TIMESTAMPTZ NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  last_accessed_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_system_check_evidence_access_grants_expires_at
  ON system_check_evidence_access_grants(expires_at ASC);

CREATE INDEX IF NOT EXISTS idx_system_check_evidence_access_grants_evidence_key
  ON system_check_evidence_access_grants(evidence_key, issued_at DESC);
`
  },
  {
    version: "0024",
    name: "filesystem-system-check-evidence-blobs",
    sql: `
ALTER TABLE system_check_evidence
ADD COLUMN IF NOT EXISTS payload_preview_text TEXT NULL;

ALTER TABLE system_check_evidence
ADD COLUMN IF NOT EXISTS storage_locator TEXT NULL;

ALTER TABLE system_check_evidence
ALTER COLUMN payload_base64 DROP NOT NULL;
`
  },
  {
    version: "0025",
    name: "system-check-evidence-retention-purge-state",
    sql: `
ALTER TABLE system_check_evidence
ADD COLUMN IF NOT EXISTS purged_at TIMESTAMPTZ NULL;

ALTER TABLE system_check_evidence
ADD COLUMN IF NOT EXISTS purge_reason_code TEXT NULL;

CREATE INDEX IF NOT EXISTS idx_system_check_evidence_retention_purge_candidates
  ON system_check_evidence(retention_expires_at ASC, created_at ASC)
  WHERE retention_expires_at IS NOT NULL AND purged_at IS NULL;
`
  },
  {
    version: "0026",
    name: "evidence-retention-policy-family",
    sql: `
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS default_evidence_retention_policy JSONB NOT NULL DEFAULT '{
  "systemCheckEvidenceRetentionTtlSeconds": 604800
}'::jsonb;

ALTER TABLE workspaces
ADD COLUMN IF NOT EXISTS evidence_retention_policy_override JSONB NULL;

UPDATE tenants
SET default_evidence_retention_policy = jsonb_build_object(
  'systemCheckEvidenceRetentionTtlSeconds',
  604800
)
WHERE default_evidence_retention_policy IS NULL
   OR default_evidence_retention_policy = '{}'::jsonb;
`
  },
  {
    version: "0027",
    name: "system-check-evidence-retention-holds",
    sql: `
ALTER TABLE system_check_evidence
ADD COLUMN IF NOT EXISTS retention_hold JSONB NULL;

CREATE INDEX IF NOT EXISTS idx_system_check_evidence_retention_purge_candidates_unheld
  ON system_check_evidence(retention_expires_at ASC, created_at ASC)
  WHERE retention_expires_at IS NOT NULL
    AND retention_hold IS NULL
    AND purged_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_audit_events_workspace_evidence_key_occurred_at
  ON audit_events(tenant_id, workspace_id, ((payload->>'evidenceKey')), occurred_at DESC)
  WHERE payload ? 'evidenceKey';
`
  },
  {
    version: "0028",
    name: "evidence-retention-investigation-class-defaults",
    sql: `
ALTER TABLE tenants
ALTER COLUMN default_evidence_retention_policy SET DEFAULT '{
  "systemCheckEvidenceRetentionTtlSeconds": 604800,
  "systemCheckEvidenceInvestigationRetentionTtlSeconds": 2592000
}'::jsonb;

UPDATE tenants
SET default_evidence_retention_policy = jsonb_build_object(
  'systemCheckEvidenceRetentionTtlSeconds',
  COALESCE(
    (default_evidence_retention_policy->>'systemCheckEvidenceRetentionTtlSeconds')::integer,
    604800
  ),
  'systemCheckEvidenceInvestigationRetentionTtlSeconds',
  COALESCE(
    (default_evidence_retention_policy->>'systemCheckEvidenceInvestigationRetentionTtlSeconds')::integer,
    2592000
  )
)
WHERE
  default_evidence_retention_policy IS NULL
  OR default_evidence_retention_policy = '{}'::jsonb
  OR NOT (default_evidence_retention_policy ? 'systemCheckEvidenceInvestigationRetentionTtlSeconds');
`
  },
  {
    version: "0029",
    name: "evidence-retention-class-policy-family",
    sql: `
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS default_evidence_retention_class_policy JSONB NOT NULL DEFAULT '{
  "defaultCaptureRetentionClass": "workspace_review",
  "classes": [
    {
      "retentionClass": "workspace_review",
      "retentionPolicyKey": "spike_workspace_review",
      "ttlFieldKey": "systemCheckEvidenceRetentionTtlSeconds",
      "manualHoldAllowed": true,
      "payloadAccessGrantsAllowed": true,
      "holdTransitions": [
        {
          "holdReasonCode": "workspace_review",
          "targetRetentionClass": "workspace_review"
        },
        {
          "holdReasonCode": "operator_investigation",
          "targetRetentionClass": "operator_investigation"
        }
      ]
    },
    {
      "retentionClass": "operator_investigation",
      "retentionPolicyKey": "spike_operator_investigation",
      "ttlFieldKey": "systemCheckEvidenceInvestigationRetentionTtlSeconds",
      "manualHoldAllowed": true,
      "payloadAccessGrantsAllowed": true,
      "holdTransitions": [
        {
          "holdReasonCode": "operator_investigation",
          "targetRetentionClass": "operator_investigation"
        }
      ]
    }
  ]
}'::jsonb;

ALTER TABLE workspaces
ADD COLUMN IF NOT EXISTS evidence_retention_class_policy_override JSONB NULL;
`
  },
  {
    version: "0030",
    name: "system-check-evidence-breach-notifications",
    sql: `
CREATE TABLE IF NOT EXISTS system_check_evidence_breach_notifications (
  notification_id TEXT PRIMARY KEY,
  evidence_key TEXT NOT NULL UNIQUE REFERENCES system_check_evidence(evidence_key) ON DELETE CASCADE,
  participant_session_id TEXT NOT NULL REFERENCES participant_sessions(participant_session_id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  content_release_id TEXT NOT NULL REFERENCES content_releases(content_release_id) ON DELETE CASCADE,
  login_key TEXT NOT NULL,
  group_key TEXT NOT NULL,
  system_check_key TEXT NOT NULL,
  check_key TEXT NOT NULL,
  hold_reason_code TEXT NOT NULL,
  escalation_target TEXT NULL,
  assigned_to_actor_id TEXT NULL,
  notification_channel TEXT NOT NULL,
  status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  created_by_actor_type TEXT NOT NULL,
  created_by_actor_id TEXT NOT NULL,
  source_request_id TEXT NULL,
  acknowledged_at TIMESTAMPTZ NULL,
  acknowledged_by_actor_id TEXT NULL,
  acknowledgement_note TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_system_check_evidence_breach_notifications_workspace_created_at
  ON system_check_evidence_breach_notifications(tenant_id, workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_check_evidence_breach_notifications_workspace_status
  ON system_check_evidence_breach_notifications(tenant_id, workspace_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_system_check_evidence_breach_notifications_escalation_target
  ON system_check_evidence_breach_notifications(tenant_id, workspace_id, escalation_target, created_at DESC);
`
  },
  {
    version: "0031",
    name: "system-check-evidence-breach-notification-delivery-state",
    sql: `
ALTER TABLE system_check_evidence_breach_notifications
ADD COLUMN IF NOT EXISTS delivery_channel TEXT NOT NULL DEFAULT 'webhook_spike';

ALTER TABLE system_check_evidence_breach_notifications
ADD COLUMN IF NOT EXISTS delivery_status TEXT NOT NULL DEFAULT 'pending_delivery';

ALTER TABLE system_check_evidence_breach_notifications
ADD COLUMN IF NOT EXISTS delivery_target TEXT NULL;

ALTER TABLE system_check_evidence_breach_notifications
ADD COLUMN IF NOT EXISTS delivery_attempt_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE system_check_evidence_breach_notifications
ADD COLUMN IF NOT EXISTS last_delivery_attempt_at TIMESTAMPTZ NULL;

ALTER TABLE system_check_evidence_breach_notifications
ADD COLUMN IF NOT EXISTS delivered_at TIMESTAMPTZ NULL;

ALTER TABLE system_check_evidence_breach_notifications
ADD COLUMN IF NOT EXISTS last_delivery_error TEXT NULL;

UPDATE system_check_evidence_breach_notifications
SET delivery_target = escalation_target
WHERE delivery_target IS NULL AND escalation_target IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_system_check_evidence_breach_notifications_delivery_status
  ON system_check_evidence_breach_notifications(tenant_id, workspace_id, delivery_status, created_at DESC);
`
  },
  {
    version: "0032",
    name: "system-check-evidence-breach-notification-retry-state",
    sql: `
ALTER TABLE system_check_evidence_breach_notifications
ADD COLUMN IF NOT EXISTS max_delivery_attempts INTEGER NOT NULL DEFAULT 3;

ALTER TABLE system_check_evidence_breach_notifications
ADD COLUMN IF NOT EXISTS next_delivery_attempt_at TIMESTAMPTZ NULL;

UPDATE system_check_evidence_breach_notifications
SET next_delivery_attempt_at = created_at
WHERE next_delivery_attempt_at IS NULL AND delivery_status = 'pending_delivery';

CREATE INDEX IF NOT EXISTS idx_system_check_evidence_breach_notifications_next_delivery_attempt
  ON system_check_evidence_breach_notifications(delivery_status, next_delivery_attempt_at ASC, created_at ASC);
`
  },
  {
    version: "0033",
    name: "notification-policy-family",
    sql: `
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS default_notification_policy JSONB NOT NULL DEFAULT '{
  "breachNotificationDeliverySelectionMode": "infer_from_target",
  "webhookSpikeRetryDelaySeconds": 0,
  "webhookSpikeMaxDeliveryAttempts": 3,
  "emailSpikeRetryDelaySeconds": 0,
  "emailSpikeMaxDeliveryAttempts": 3
}'::jsonb;

ALTER TABLE workspaces
ADD COLUMN IF NOT EXISTS notification_policy_override JSONB NULL;

UPDATE tenants
SET default_notification_policy = jsonb_build_object(
  'breachNotificationDeliverySelectionMode',
  COALESCE(
    default_notification_policy->>'breachNotificationDeliverySelectionMode',
    'infer_from_target'
  ),
  'webhookSpikeRetryDelaySeconds',
  COALESCE(
    (default_notification_policy->>'webhookSpikeRetryDelaySeconds')::integer,
    0
  ),
  'webhookSpikeMaxDeliveryAttempts',
  COALESCE(
    (default_notification_policy->>'webhookSpikeMaxDeliveryAttempts')::integer,
    3
  ),
  'emailSpikeRetryDelaySeconds',
  COALESCE(
    (default_notification_policy->>'emailSpikeRetryDelaySeconds')::integer,
    0
  ),
  'emailSpikeMaxDeliveryAttempts',
  COALESCE(
    (default_notification_policy->>'emailSpikeMaxDeliveryAttempts')::integer,
    3
  )
)
WHERE
  default_notification_policy IS NULL
  OR default_notification_policy = '{}'::jsonb
  OR NOT (default_notification_policy ? 'breachNotificationDeliverySelectionMode')
  OR NOT (default_notification_policy ? 'webhookSpikeRetryDelaySeconds')
  OR NOT (default_notification_policy ? 'webhookSpikeMaxDeliveryAttempts')
  OR NOT (default_notification_policy ? 'emailSpikeRetryDelaySeconds')
  OR NOT (default_notification_policy ? 'emailSpikeMaxDeliveryAttempts');
`
  },
  {
    version: "0034",
    name: "notification-policy-provider-rules",
    sql: `
UPDATE tenants
SET default_notification_policy = jsonb_build_object(
  'breachNotificationDeliverySelectionMode',
  COALESCE(
    default_notification_policy->>'breachNotificationDeliverySelectionMode',
    'infer_from_target'
  ),
  'webhookSpikeRetryDelaySeconds',
  COALESCE(
    (default_notification_policy->>'webhookSpikeRetryDelaySeconds')::integer,
    (default_notification_policy->>'breachNotificationRetryDelaySeconds')::integer,
    0
  ),
  'webhookSpikeMaxDeliveryAttempts',
  COALESCE(
    (default_notification_policy->>'webhookSpikeMaxDeliveryAttempts')::integer,
    (default_notification_policy->>'breachNotificationMaxDeliveryAttempts')::integer,
    3
  ),
  'emailSpikeRetryDelaySeconds',
  COALESCE(
    (default_notification_policy->>'emailSpikeRetryDelaySeconds')::integer,
    (default_notification_policy->>'breachNotificationRetryDelaySeconds')::integer,
    0
  ),
  'emailSpikeMaxDeliveryAttempts',
  COALESCE(
    (default_notification_policy->>'emailSpikeMaxDeliveryAttempts')::integer,
    (default_notification_policy->>'breachNotificationMaxDeliveryAttempts')::integer,
    3
  )
)
WHERE
  default_notification_policy ? 'breachNotificationRetryDelaySeconds'
  OR default_notification_policy ? 'breachNotificationMaxDeliveryAttempts'
  OR NOT (default_notification_policy ? 'webhookSpikeRetryDelaySeconds')
  OR NOT (default_notification_policy ? 'webhookSpikeMaxDeliveryAttempts')
  OR NOT (default_notification_policy ? 'emailSpikeRetryDelaySeconds')
  OR NOT (default_notification_policy ? 'emailSpikeMaxDeliveryAttempts');

UPDATE workspaces
SET notification_policy_override = jsonb_build_object(
  'breachNotificationDeliverySelectionMode',
  notification_policy_override->'breachNotificationDeliverySelectionMode',
  'webhookSpikeRetryDelaySeconds',
  COALESCE(
    notification_policy_override->'webhookSpikeRetryDelaySeconds',
    notification_policy_override->'breachNotificationRetryDelaySeconds'
  ),
  'webhookSpikeMaxDeliveryAttempts',
  COALESCE(
    notification_policy_override->'webhookSpikeMaxDeliveryAttempts',
    notification_policy_override->'breachNotificationMaxDeliveryAttempts'
  ),
  'emailSpikeRetryDelaySeconds',
  COALESCE(
    notification_policy_override->'emailSpikeRetryDelaySeconds',
    notification_policy_override->'breachNotificationRetryDelaySeconds'
  ),
  'emailSpikeMaxDeliveryAttempts',
  COALESCE(
    notification_policy_override->'emailSpikeMaxDeliveryAttempts',
    notification_policy_override->'breachNotificationMaxDeliveryAttempts'
  )
)
WHERE notification_policy_override IS NOT NULL
  AND (
    notification_policy_override ? 'breachNotificationRetryDelaySeconds'
    OR notification_policy_override ? 'breachNotificationMaxDeliveryAttempts'
  );
`
  },
  {
    version: "0035",
    name: "breach-notification-provider-receipts",
    sql: `
ALTER TABLE system_check_evidence_breach_notifications
ADD COLUMN IF NOT EXISTS last_delivery_receipt_id TEXT NULL;

ALTER TABLE system_check_evidence_breach_notifications
ADD COLUMN IF NOT EXISTS last_delivery_receipt_issued_at TIMESTAMPTZ NULL;
`
  },
  {
    version: "0036",
    name: "notification-provider-profiles",
    sql: `
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS default_notification_provider_profiles JSONB NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE system_check_evidence_breach_notifications
ADD COLUMN IF NOT EXISTS delivery_profile_key TEXT NULL;
`
  },
  {
    version: "0037",
    name: "workspace-notification-provider-profile-overrides",
    sql: `
ALTER TABLE workspaces
ADD COLUMN IF NOT EXISTS notification_provider_profile_override JSONB NULL;
`
  },
  {
    version: "0038",
    name: "notification-provider-promotion-policy-family",
    sql: `
ALTER TABLE tenants
ADD COLUMN IF NOT EXISTS default_notification_provider_promotion_policy JSONB NOT NULL DEFAULT '{
  "evaluationWindowHours": 24,
  "minimumRequestedCount": 1,
  "minimumDirectSelectionCount": 1,
  "minimumDeliveredCount": 1,
  "maximumDeliveryFailedCount": 0
}'::jsonb;

ALTER TABLE workspaces
ADD COLUMN IF NOT EXISTS notification_provider_promotion_policy_override JSONB NULL;
`
  },
  {
    version: "0039",
    name: "notification-provider-promotion-policy-automation-flags",
    sql: `
UPDATE tenants
SET default_notification_provider_promotion_policy =
  COALESCE(default_notification_provider_promotion_policy, '{}'::jsonb)
  || jsonb_build_object(
    'autoPromoteEnabled',
    COALESCE(
      (default_notification_provider_promotion_policy->>'autoPromoteEnabled')::boolean,
      false
    ),
    'autoRollbackOnFailureEnabled',
    COALESCE(
      (default_notification_provider_promotion_policy->>'autoRollbackOnFailureEnabled')::boolean,
      false
    )
  );

UPDATE workspaces
SET notification_provider_promotion_policy_override =
  notification_provider_promotion_policy_override
  || jsonb_build_object(
    'autoPromoteEnabled',
    COALESCE(
      notification_provider_promotion_policy_override->'autoPromoteEnabled',
      'false'::jsonb
    ),
    'autoRollbackOnFailureEnabled',
    COALESCE(
      notification_provider_promotion_policy_override->'autoRollbackOnFailureEnabled',
      'false'::jsonb
    )
  )
WHERE notification_provider_promotion_policy_override IS NOT NULL
  AND (
    NOT (notification_provider_promotion_policy_override ? 'autoPromoteEnabled')
    OR NOT (notification_provider_promotion_policy_override ? 'autoRollbackOnFailureEnabled')
  );
`
  },
  {
    version: "0040",
    name: "notification-provider-promotion-policy-suppression-seconds",
    sql: `
UPDATE tenants
SET default_notification_provider_promotion_policy =
  COALESCE(default_notification_provider_promotion_policy, '{}'::jsonb)
  || jsonb_build_object(
    'autoPromotionSuppressionSeconds',
    COALESCE(
      (default_notification_provider_promotion_policy->>'autoPromotionSuppressionSeconds')::integer,
      0
    )
  );

UPDATE workspaces
SET notification_provider_promotion_policy_override =
  notification_provider_promotion_policy_override
  || jsonb_build_object(
    'autoPromotionSuppressionSeconds',
    COALESCE(
      notification_provider_promotion_policy_override->'autoPromotionSuppressionSeconds',
      '0'::jsonb
    )
  )
WHERE notification_provider_promotion_policy_override IS NOT NULL
  AND NOT (notification_provider_promotion_policy_override ? 'autoPromotionSuppressionSeconds');
`
  },
  {
    version: "0041",
    name: "notification-provider-profile-incidents",
    sql: `
CREATE TABLE IF NOT EXISTS notification_provider_profile_incidents (
  incident_id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  profile_key TEXT NOT NULL,
  incident_type TEXT NOT NULL,
  status TEXT NOT NULL,
  opened_at TIMESTAMPTZ NOT NULL,
  opened_by_actor_type TEXT NOT NULL,
  opened_by_actor_id TEXT NOT NULL,
  reason_code TEXT NOT NULL,
  delivery_failed_count INTEGER NOT NULL,
  suppression_until TIMESTAMPTZ NULL,
  source_request_id TEXT NULL,
  acknowledged_at TIMESTAMPTZ NULL,
  acknowledged_by_actor_id TEXT NULL,
  acknowledgement_note TEXT NULL,
  resolved_at TIMESTAMPTZ NULL,
  resolution_code TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_notification_provider_profile_incidents_workspace_opened_at
  ON notification_provider_profile_incidents(tenant_id, workspace_id, opened_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_provider_profile_incidents_workspace_status
  ON notification_provider_profile_incidents(workspace_id, status, opened_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_provider_profile_incidents_workspace_profile_status
  ON notification_provider_profile_incidents(workspace_id, profile_key, status, opened_at DESC);
`
  },
  {
    version: "0042",
    name: "notification-provider-profile-governance-alerts",
    sql: `
CREATE TABLE IF NOT EXISTS notification_provider_profile_governance_alerts (
  alert_id TEXT PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES notification_provider_profile_incidents(incident_id) ON DELETE CASCADE,
  tenant_id TEXT NOT NULL REFERENCES tenants(tenant_id) ON DELETE CASCADE,
  workspace_id TEXT NOT NULL REFERENCES workspaces(workspace_id) ON DELETE CASCADE,
  profile_key TEXT NOT NULL,
  status TEXT NOT NULL,
  governance_status TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL,
  created_by_actor_type TEXT NOT NULL,
  created_by_actor_id TEXT NOT NULL,
  source_request_id TEXT NULL,
  delivery_profile_key TEXT NULL,
  delivery_channel TEXT NOT NULL,
  delivery_status TEXT NOT NULL,
  delivery_target TEXT NULL,
  delivery_attempt_count INTEGER NOT NULL DEFAULT 0,
  max_delivery_attempts INTEGER NOT NULL DEFAULT 3,
  next_delivery_attempt_at TIMESTAMPTZ NULL,
  last_delivery_attempt_at TIMESTAMPTZ NULL,
  last_delivery_receipt_id TEXT NULL,
  last_delivery_receipt_issued_at TIMESTAMPTZ NULL,
  delivered_at TIMESTAMPTZ NULL,
  last_delivery_error TEXT NULL,
  acknowledged_at TIMESTAMPTZ NULL,
  acknowledged_by_actor_id TEXT NULL,
  acknowledgement_note TEXT NULL
);

CREATE INDEX IF NOT EXISTS idx_notification_provider_profile_governance_alerts_workspace_created_at
  ON notification_provider_profile_governance_alerts(tenant_id, workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notification_provider_profile_governance_alerts_pending_delivery
  ON notification_provider_profile_governance_alerts(delivery_status, next_delivery_attempt_at ASC, created_at ASC);
`
  },
  {
    version: "0043",
    name: "governance-notification-policy",
    sql: `
ALTER TABLE tenants
  ADD COLUMN IF NOT EXISTS default_governance_notification_policy JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS governance_notification_policy_override JSONB NULL;

UPDATE tenants
SET default_governance_notification_policy =
  COALESCE(default_governance_notification_policy, '{}'::jsonb)
  || jsonb_build_object(
    'breachNotificationDeliverySelectionMode',
    COALESCE(
      default_governance_notification_policy->>'breachNotificationDeliverySelectionMode',
      default_notification_policy->>'breachNotificationDeliverySelectionMode',
      'infer_from_target'
    ),
    'webhookSpikeRetryDelaySeconds',
    COALESCE(
      (default_governance_notification_policy->>'webhookSpikeRetryDelaySeconds')::integer,
      (default_governance_notification_policy->>'breachNotificationRetryDelaySeconds')::integer,
      (default_notification_policy->>'webhookSpikeRetryDelaySeconds')::integer,
      (default_notification_policy->>'breachNotificationRetryDelaySeconds')::integer,
      30
    ),
    'webhookSpikeMaxDeliveryAttempts',
    COALESCE(
      (default_governance_notification_policy->>'webhookSpikeMaxDeliveryAttempts')::integer,
      (default_governance_notification_policy->>'breachNotificationMaxDeliveryAttempts')::integer,
      (default_notification_policy->>'webhookSpikeMaxDeliveryAttempts')::integer,
      (default_notification_policy->>'breachNotificationMaxDeliveryAttempts')::integer,
      3
    ),
    'emailSpikeRetryDelaySeconds',
    COALESCE(
      (default_governance_notification_policy->>'emailSpikeRetryDelaySeconds')::integer,
      (default_governance_notification_policy->>'breachNotificationRetryDelaySeconds')::integer,
      (default_notification_policy->>'emailSpikeRetryDelaySeconds')::integer,
      (default_notification_policy->>'breachNotificationRetryDelaySeconds')::integer,
      60
    ),
    'emailSpikeMaxDeliveryAttempts',
    COALESCE(
      (default_governance_notification_policy->>'emailSpikeMaxDeliveryAttempts')::integer,
      (default_governance_notification_policy->>'breachNotificationMaxDeliveryAttempts')::integer,
      (default_notification_policy->>'emailSpikeMaxDeliveryAttempts')::integer,
      (default_notification_policy->>'breachNotificationMaxDeliveryAttempts')::integer,
      2
    )
  );
`
  }
];

export const runMigrations = async (pool: Pool): Promise<MigrationRunResult> => {
  await pool.query(schemaMigrationsTableSql);

  const appliedResult = await pool.query<{ version: string }>(
    `
      SELECT version
      FROM schema_migrations
      ORDER BY version
    `
  );

  const appliedVersions = new Set(appliedResult.rows.map(row => row.version));
  const executedVersions: string[] = [];

  for (const migration of databaseMigrations) {
    if (appliedVersions.has(migration.version)) {
      continue;
    }

    const client = await pool.connect();

    try {
      await client.query("BEGIN");
      await client.query(schemaMigrationsTableSql);
      await client.query(migration.sql);
      await client.query(
        `
          INSERT INTO schema_migrations (version, name)
          VALUES ($1, $2)
        `,
        [migration.version, migration.name]
      );
      await client.query("COMMIT");
      executedVersions.push(migration.version);
      appliedVersions.add(migration.version);
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  return {
    appliedVersions: executedVersions,
    pendingVersions: databaseMigrations
      .map(migration => migration.version)
      .filter(version => !appliedVersions.has(version))
  };
};
