import { Pool, type QueryResultRow } from "pg";

import type { FirstSliceRepository } from "@testcenter-rewrite-app/application";
import type {
  AdminLoginAttempt,
  AdminAuditEvent,
  AdminRoleAssignment,
  AdminSession,
  AdminUser,
  ApplicationSettings,
  AttachmentFile,
  ContentRelease,
  ContentReleaseRuntimeSnapshot,
  ImportJob,
  ImportJobDiagnostic,
  OperationalLoginMigrationCandidate,
  ParticipantLoginAttempt,
  ParticipantRosterEntry,
  ParticipantSession,
  ParticipantTestLog,
  SourcePackage,
  SourcePackageContentStructure,
  Tenant,
  TestRun,
  Workspace,
  WorkspaceActivityEvent,
  WorkspaceReview
} from "@testcenter-rewrite-app/domain";

type Row = QueryResultRow & Record<string, unknown>;

type PostgresMigration = {
  version: number;
  name: string;
  sql: string;
};

const mapTenant = (row: Row | undefined): Tenant | null =>
  row
    ? {
        tenantId: String(row.tenant_id),
        tenantKey: String(row.tenant_key),
        displayName: String(row.display_name),
        status: row.status as Tenant["status"],
        createdAt: String(row.created_at)
      }
    : null;

const mapWorkspace = (row: Row | undefined): Workspace | null =>
  row
    ? {
        workspaceId: String(row.workspace_id),
        tenantId: String(row.tenant_id),
        workspaceKey: String(row.workspace_key),
        displayName: String(row.display_name),
        status: row.status as Workspace["status"],
        createdAt: String(row.created_at)
      }
    : null;

const mapAdminUser = (row: Row | undefined): AdminUser | null =>
  row
    ? {
        adminUserId: String(row.admin_user_id),
        username: String(row.username),
        displayName: String(row.display_name),
        passwordHash: String(row.password_hash),
        passwordChangeRequired: Boolean(row.password_change_required ?? false),
        status: row.status as AdminUser["status"],
        customTexts: (() => {
          try {
            const parsed = JSON.parse(String(row.custom_texts_json ?? "{}"));
            return parsed && typeof parsed === "object" && !Array.isArray(parsed)
              ? Object.fromEntries(
                  Object.entries(parsed).filter(
                    (entry): entry is [string, string] =>
                      typeof entry[1] === "string"
                  )
                )
              : {};
          } catch {
            return {};
          }
        })(),
        validFrom: row.valid_from == null ? null : String(row.valid_from),
        validTo: row.valid_to == null ? null : String(row.valid_to),
        validForMinutes:
          row.valid_for_minutes == null ? null : Number(row.valid_for_minutes),
        firstSignedInAt:
          row.first_signed_in_at == null ? null : String(row.first_signed_in_at),
        createdAt: String(row.created_at)
      }
    : null;

const mapAdminSession = (row: Row | undefined): AdminSession | null =>
  row
    ? {
        adminSessionId: String(row.admin_session_id),
        adminUserId: String(row.admin_user_id),
        token: String(row.session_token),
        createdAt: String(row.created_at),
        expiresAt: String(row.expires_at),
        revokedAt:
          row.revoked_at === null || row.revoked_at === undefined
            ? null
            : String(row.revoked_at)
      }
    : null;

const mapAdminRoleAssignment = (row: Row | undefined): AdminRoleAssignment | null =>
  row
    ? {
        roleAssignmentId: String(row.role_assignment_id),
        adminUserId: String(row.admin_user_id),
        role: row.role as AdminRoleAssignment["role"],
        accessMode:
          row.access_mode === "read_only" ? "read_only" : "read_write",
        tenantId:
          row.tenant_id === null || row.tenant_id === undefined
            ? null
            : String(row.tenant_id),
        workspaceId:
          row.workspace_id === null || row.workspace_id === undefined
            ? null
            : String(row.workspace_id),
        groupKey:
          row.group_key === null || row.group_key === undefined
            ? null
            : String(row.group_key),
        monitorProfiles: parseMonitorProfiles(row.monitor_profiles_json),
        createdAt: String(row.created_at)
      }
    : null;

const parseMonitorProfiles = (
  value: unknown
): AdminRoleAssignment["monitorProfiles"] => {
  if (Array.isArray(value)) {
    return value as AdminRoleAssignment["monitorProfiles"];
  }
  if (typeof value !== "string" || !value) {
    return [];
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return Array.isArray(parsed)
      ? (parsed as AdminRoleAssignment["monitorProfiles"])
      : [];
  } catch {
    return [];
  }
};

const mapAdminAuditEvent = (row: Row | undefined): AdminAuditEvent | null =>
  row
    ? {
        adminAuditEventId: String(row.admin_audit_event_id),
        eventType: row.event_type as AdminAuditEvent["eventType"],
        actorAdminUserId:
          row.actor_admin_user_id === null || row.actor_admin_user_id === undefined
            ? null
            : String(row.actor_admin_user_id),
        subjectAdminUserId:
          row.subject_admin_user_id === null ||
          row.subject_admin_user_id === undefined
            ? null
            : String(row.subject_admin_user_id),
        occurredAt: String(row.occurred_at),
        summary: String(row.summary),
        details: JSON.parse(String(row.details_json ?? "{}")) as Record<string, unknown>
      }
    : null;

const mapApplicationSettings = (
  row: Row | undefined
): ApplicationSettings | null =>
  row
    ? {
        appTitle: String(row.app_title),
        mainLogo:
          row.main_logo == null ? "app-icon.svg" : String(row.main_logo),
        themeName:
          row.theme_name === "Sekundar" || row.theme_name === "Erwachsene"
            ? row.theme_name
            : "Primar",
        introHtml: row.intro_html == null ? "" : String(row.intro_html),
        legalNoticeHtml:
          row.legal_notice_html == null
            ? ""
            : String(row.legal_notice_html),
        customTexts: (() => {
          try {
            const parsed = JSON.parse(String(row.custom_texts_json ?? "{}"));
            return parsed && typeof parsed === "object" && !Array.isArray(parsed)
              ? Object.fromEntries(
                  Object.entries(parsed).filter(
                    (entry): entry is [string, string] =>
                      typeof entry[1] === "string"
                  )
                )
              : {};
          } catch {
            return {};
          }
        })(),
        globalWarningText:
          row.global_warning_text == null
            ? null
            : String(row.global_warning_text),
        globalWarningExpiresAt:
          row.global_warning_expires_at == null
            ? null
            : String(row.global_warning_expires_at),
        updatedAt: row.updated_at == null ? null : String(row.updated_at),
        updatedByAdminUserId:
          row.updated_by_admin_user_id == null
            ? null
            : String(row.updated_by_admin_user_id)
      }
    : null;

const mapAttachmentFile = (row: Row | undefined): AttachmentFile | null =>
  row
    ? {
        attachmentFileId: String(row.attachment_file_id),
        attachmentId: String(row.attachment_id),
        tenantId: String(row.tenant_id),
        workspaceId: String(row.workspace_id),
        fileName: String(row.file_name),
        mediaType: row.media_type as AttachmentFile["mediaType"],
        dataBase64: String(row.data_base64),
        createdAt: String(row.created_at)
      }
    : null;

const mapSourcePackage = (row: Row | undefined): SourcePackage | null =>
  row
    ? {
        sourcePackageId: String(row.source_package_id),
        tenantId: String(row.tenant_id),
        workspaceId: String(row.workspace_id),
        fileName: String(row.file_name),
        mediaType: String(row.media_type),
        contentStructure:
          row.content_structure_json === null || row.content_structure_json === undefined
            ? null
            : (JSON.parse(
                String(row.content_structure_json)
              ) as SourcePackageContentStructure),
        sourceDocument:
          row.source_document_text === null || row.source_document_text === undefined
            ? null
            : String(row.source_document_text),
        status: row.status as SourcePackage["status"],
        uploadedAt: String(row.uploaded_at)
      }
    : null;

const mapImportJob = (row: Row | undefined): ImportJob | null =>
  row
    ? {
        importJobId: String(row.import_job_id),
        tenantId: String(row.tenant_id),
        workspaceId: String(row.workspace_id),
        sourcePackageId: String(row.source_package_id),
        status: row.status as ImportJob["status"],
        createdAt: String(row.created_at),
        finishedAt:
          row.finished_at === null || row.finished_at === undefined
            ? null
            : String(row.finished_at),
        diagnostics: JSON.parse(
          String(row.diagnostics_json ?? "[]")
        ) as ImportJobDiagnostic[]
      }
    : null;

const mapContentRelease = (row: Row | undefined): ContentRelease | null =>
  row
    ? {
        contentReleaseId: String(row.content_release_id),
        tenantId: String(row.tenant_id),
        workspaceId: String(row.workspace_id),
        importJobId: String(row.import_job_id),
        releaseLabel: String(row.release_label),
        runtimeSnapshot: JSON.parse(
          String(row.runtime_snapshot_json ?? "{\"bookletEntries\":[]}")
        ) as ContentReleaseRuntimeSnapshot,
        status: row.status as ContentRelease["status"],
        createdAt: String(row.created_at),
        activatedAt:
          row.activated_at === null || row.activated_at === undefined
            ? null
            : String(row.activated_at)
      }
    : null;

const mapParticipantSession = (row: Row | undefined): ParticipantSession | null =>
  row
    ? {
        participantSessionId: String(row.participant_session_id),
        tenantId: String(row.tenant_id),
        workspaceId: String(row.workspace_id),
        contentReleaseId: String(row.content_release_id),
        loginKey: String(row.login_key),
        groupKey: String(row.group_key),
        participantCode:
          row.participant_code === null || row.participant_code === undefined
            ? null
            : String(row.participant_code),
        executionMode:
          row.execution_mode === null || row.execution_mode === undefined
            ? undefined
            : (String(row.execution_mode) as ParticipantSession["executionMode"]),
        status: row.status as ParticipantSession["status"],
        validUntil:
          row.valid_until === null || row.valid_until === undefined
            ? null
            : String(row.valid_until),
        createdAt: String(row.created_at)
      }
    : null;

const mapParticipantRosterEntry = (
  row: Row | undefined
): ParticipantRosterEntry | null =>
  row
    ? (() => {
        const parsedBookletKeys = (() => {
          try {
            const parsed = JSON.parse(String(row.booklet_keys_json ?? "[]"));
            return Array.isArray(parsed)
              ? [...new Set(parsed.filter(value => typeof value === "string" && value.trim()))]
              : [];
          } catch {
            return [];
          }
        })() as string[];
        const bookletStatePresets = (() => {
          try {
            const parsed = JSON.parse(
              String(row.booklet_state_presets_json ?? "{}")
            );
            return parsed && typeof parsed === "object" && !Array.isArray(parsed)
              ? (parsed as NonNullable<ParticipantRosterEntry["bookletStatePresets"]>)
              : {};
          } catch {
            return {};
          }
        })();
        const bookletAssignments = (() => {
          try {
            const parsed = JSON.parse(
              String(row.booklet_assignments_json ?? "[]")
            );
            return Array.isArray(parsed)
              ? (parsed as NonNullable<ParticipantRosterEntry["bookletAssignments"]>)
              : [];
          } catch {
            return [];
          }
        })();
        const customTexts = (() => {
          try {
            const parsed =
              typeof row.custom_texts_json === "string"
                ? JSON.parse(row.custom_texts_json)
                : row.custom_texts_json ?? {};
            return parsed && typeof parsed === "object" && !Array.isArray(parsed)
              ? Object.fromEntries(
                  Object.entries(parsed).filter(
                    (entry): entry is [string, string] => typeof entry[1] === "string"
                  )
                )
              : {};
          } catch {
            return {};
          }
        })();
        return {
          participantRosterEntryId: String(row.participant_roster_entry_id),
          tenantId: String(row.tenant_id),
          workspaceId: String(row.workspace_id),
          loginKey: String(row.login_key),
          executionMode:
            row.execution_mode === null || row.execution_mode === undefined
              ? undefined
              : (String(row.execution_mode) as ParticipantRosterEntry["executionMode"]),
          groupKey: String(row.group_key),
          bookletKey:
            row.booklet_key === null || row.booklet_key === undefined
              ? null
              : String(row.booklet_key),
          ...(parsedBookletKeys.length > 1
            ? { bookletKeys: parsedBookletKeys }
            : {}),
          ...(Object.keys(bookletStatePresets).length > 0
            ? { bookletStatePresets }
            : {}),
          ...(bookletAssignments.length > 0 ? { bookletAssignments } : {}),
          displayName:
            row.display_name === null || row.display_name === undefined
              ? null
              : String(row.display_name),
          passwordRequired:
            row.password_hash !== null && row.password_hash !== undefined,
          validFrom:
            row.valid_from === null || row.valid_from === undefined
              ? null
              : String(row.valid_from),
          validTo:
            row.valid_to === null || row.valid_to === undefined
              ? null
              : String(row.valid_to),
          validForMinutes:
            row.valid_for_minutes === null || row.valid_for_minutes === undefined
              ? null
              : Number(row.valid_for_minutes),
          customTexts,
          importedAt: String(row.imported_at)
        };
      })()
    : null;

const mapTestRun = (row: Row | undefined): TestRun | null =>
  row
    ? {
        testRunId: String(row.test_run_id),
        participantSessionId: String(row.participant_session_id),
        tenantId: String(row.tenant_id),
        workspaceId: String(row.workspace_id),
        contentReleaseId: String(row.content_release_id),
        bookletKey: String(row.booklet_key),
        executionMode:
          row.execution_mode === null || row.execution_mode === undefined
            ? undefined
            : (String(row.execution_mode) as TestRun["executionMode"]),
        bookletAssignmentKey:
          row.booklet_assignment_key === null ||
          row.booklet_assignment_key === undefined
            ? String(row.booklet_key)
            : String(row.booklet_assignment_key),
        status: row.status as TestRun["status"],
        locked:
          row.locked === true || String(row.locked ?? "false") === "true",
        currentUnitKey:
          row.current_unit_key === null || row.current_unit_key === undefined
            ? null
            : String(row.current_unit_key),
        unitResponses: JSON.parse(
          String(row.unit_responses_json ?? "{}")
        ) as Record<string, string>,
        presetBookletStates: (() => {
          try {
            const parsed = JSON.parse(
              String(row.preset_booklet_states_json ?? "{}")
            );
            return parsed && typeof parsed === "object" && !Array.isArray(parsed)
              ? (parsed as NonNullable<TestRun["presetBookletStates"]>)
              : {};
          } catch {
            return {};
          }
        })(),
        bookletStates: (() => {
          try {
            const parsed = JSON.parse(String(row.booklet_states_json ?? "{}"));
            return parsed && typeof parsed === "object" && !Array.isArray(parsed)
              ? (parsed as NonNullable<TestRun["bookletStates"]>)
              : {};
          } catch {
            return {};
          }
        })(),
        bookletStateOverrides: (() => {
          try {
            const parsed = JSON.parse(
              String(row.booklet_state_overrides_json ?? "{}")
            );
            return parsed && typeof parsed === "object" && !Array.isArray(parsed)
              ? (parsed as NonNullable<TestRun["bookletStateOverrides"]>)
              : {};
          } catch {
            return {};
          }
        })(),
        unlockedTestletKeys: (() => {
          try {
            const parsed = JSON.parse(
              String(row.unlocked_testlet_keys_json ?? "[]")
            );
            return Array.isArray(parsed)
              ? parsed.filter(value => typeof value === "string")
              : [];
          } catch {
            return [];
          }
        })(),
        monitorNavigationUnlocked:
          row.monitor_navigation_unlocked === true ||
          String(row.monitor_navigation_unlocked ?? "false") === "true",
        testletTimers: (() => {
          try {
            const parsed = JSON.parse(String(row.testlet_timers_json ?? "{}"));
            return parsed && typeof parsed === "object" && !Array.isArray(parsed)
              ? (parsed as NonNullable<TestRun["testletTimers"]>)
              : {};
          } catch {
            return {};
          }
        })(),
        lockedTestletKeys: (() => {
          try {
            const parsed = JSON.parse(
              String(row.locked_testlet_keys_json ?? "[]")
            );
            return Array.isArray(parsed)
              ? parsed.filter(value => typeof value === "string")
              : [];
          } catch {
            return [];
          }
        })(),
        lockedUnitKeys: (() => {
          try {
            const parsed = JSON.parse(String(row.locked_unit_keys_json ?? "[]"));
            return Array.isArray(parsed)
              ? parsed.filter(value => typeof value === "string")
              : [];
          } catch {
            return [];
          }
        })(),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at),
        completedAt:
          row.completed_at === null || row.completed_at === undefined
            ? null
            : String(row.completed_at)
      }
    : null;

const mapParticipantLoginAttempt = (
  row: Row | undefined
): ParticipantLoginAttempt | null =>
  row
    ? {
        tenantId: String(row.tenant_id),
        workspaceId: String(row.workspace_id),
        loginKey: String(row.login_key),
        failedAttempts: Number(row.failed_attempts),
        expiresAt: String(row.expires_at),
        updatedAt: String(row.updated_at)
      }
    : null;

const mapAdminLoginAttempt = (row: Row | undefined): AdminLoginAttempt | null =>
  row
    ? {
        username: String(row.username),
        failedAttempts: Number(row.failed_attempts),
        expiresAt: String(row.expires_at),
        updatedAt: String(row.updated_at)
      }
    : null;

const mapWorkspaceActivityEvent = (
  row: Row | undefined
): WorkspaceActivityEvent | null =>
  row
    ? {
        activityEventId: String(row.activity_event_id),
        tenantId: String(row.tenant_id),
        workspaceId: String(row.workspace_id),
        eventType: row.event_type as WorkspaceActivityEvent["eventType"],
        actorId:
          row.actor_id === null || row.actor_id === undefined
            ? null
            : String(row.actor_id),
        subjectType: row.subject_type as WorkspaceActivityEvent["subjectType"],
        subjectId: String(row.subject_id),
        occurredAt: String(row.occurred_at),
        summary: String(row.summary),
        details: JSON.parse(String(row.details_json ?? "{}")) as Record<string, unknown>
      }
    : null;

const mapWorkspaceReview = (row: Row | undefined): WorkspaceReview | null =>
  row
    ? {
        reviewId: String(row.review_id),
        tenantId: String(row.tenant_id),
        workspaceId: String(row.workspace_id),
        participantSessionId: String(row.participant_session_id),
        testRunId: String(row.test_run_id),
        unitKey:
          row.unit_key === null || row.unit_key === undefined
            ? null
            : String(row.unit_key),
        originalUnitId:
          row.original_unit_id === null || row.original_unit_id === undefined
            ? null
            : String(row.original_unit_id),
        page:
          row.page === null || row.page === undefined ? null : Number(row.page),
        pageLabel:
          row.page_label === null || row.page_label === undefined
            ? null
            : String(row.page_label),
        userAgent:
          row.user_agent === null || row.user_agent === undefined
            ? null
            : String(row.user_agent),
        reviewerId: String(row.reviewer_id),
        category: String(row.category),
        categories: String(row.category ?? "")
          .split(/[\s,]+/)
          .map(category => category.trim().toLowerCase())
          .filter(Boolean),
        priority: ([0, 1, 2, 3].includes(Number(row.priority))
          ? Number(row.priority)
          : 0) as WorkspaceReview["priority"],
        comment: String(row.comment_text),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at)
      }
    : null;

const mapParticipantTestLog = (row: Row | undefined): ParticipantTestLog | null =>
  row
    ? {
        participantTestLogId: String(row.participant_test_log_id),
        tenantId: String(row.tenant_id),
        workspaceId: String(row.workspace_id),
        participantSessionId: String(row.participant_session_id),
        testRunId: String(row.test_run_id),
        unitKey: row.unit_key == null ? null : String(row.unit_key),
        originalUnitId:
          row.original_unit_id == null ? null : String(row.original_unit_id),
        logKey: String(row.log_key),
        logContent: String(row.log_content),
        timestamp: Number(row.timestamp),
        recordedAt: String(row.recorded_at)
      }
    : null;

const migrations: PostgresMigration[] = [
  {
    version: 1,
    name: "initial_first_slice_schema",
    sql: `
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS tenants (
        tenant_id TEXT PRIMARY KEY,
        tenant_key TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS workspaces (
        workspace_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        tenant_key TEXT NOT NULL,
        workspace_key TEXT NOT NULL,
        display_name TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        UNIQUE (tenant_key, workspace_key)
      );

      CREATE TABLE IF NOT EXISTS workspace_activity_events (
        activity_event_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        event_type TEXT NOT NULL,
        actor_id TEXT,
        subject_type TEXT NOT NULL,
        subject_id TEXT NOT NULL,
        occurred_at TEXT NOT NULL,
        summary TEXT NOT NULL,
        details_json TEXT NOT NULL DEFAULT '{}'
      );

      CREATE TABLE IF NOT EXISTS source_packages (
        source_package_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        media_type TEXT NOT NULL,
        content_structure_json TEXT,
        source_document_text TEXT,
        status TEXT NOT NULL,
        uploaded_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS import_jobs (
        import_job_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        source_package_id TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        finished_at TEXT,
        diagnostics_json TEXT NOT NULL DEFAULT '[]'
      );

      CREATE TABLE IF NOT EXISTS content_releases (
        content_release_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        import_job_id TEXT NOT NULL,
        release_label TEXT NOT NULL,
        runtime_snapshot_json TEXT NOT NULL DEFAULT '{"bookletEntries":[]}',
        status TEXT NOT NULL,
        created_at TEXT NOT NULL,
        activated_at TEXT
      );

      CREATE TABLE IF NOT EXISTS participant_sessions (
        participant_session_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        content_release_id TEXT NOT NULL,
        login_key TEXT NOT NULL,
        group_key TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS test_runs (
        test_run_id TEXT PRIMARY KEY,
        participant_session_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        content_release_id TEXT NOT NULL,
        booklet_key TEXT NOT NULL,
        status TEXT NOT NULL,
        current_unit_key TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        completed_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_workspaces_workspace_key
        ON workspaces (workspace_key);
      CREATE INDEX IF NOT EXISTS idx_workspace_activity_events_workspace
        ON workspace_activity_events (tenant_id, workspace_id, occurred_at);
      CREATE INDEX IF NOT EXISTS idx_source_packages_workspace
        ON source_packages (tenant_id, workspace_id);
      CREATE INDEX IF NOT EXISTS idx_import_jobs_workspace
        ON import_jobs (tenant_id, workspace_id);
      CREATE INDEX IF NOT EXISTS idx_content_releases_workspace
        ON content_releases (tenant_id, workspace_id);
      CREATE INDEX IF NOT EXISTS idx_participant_sessions_workspace
        ON participant_sessions (tenant_id, workspace_id);
      CREATE INDEX IF NOT EXISTS idx_test_runs_workspace
        ON test_runs (tenant_id, workspace_id);
      CREATE INDEX IF NOT EXISTS idx_test_runs_participant_session
        ON test_runs (participant_session_id);
    `
  },
  {
    version: 2,
    name: "add_admin_auth",
    sql: `
      CREATE TABLE IF NOT EXISTS admin_users (
        admin_user_id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS admin_sessions (
        admin_session_id TEXT PRIMARY KEY,
        admin_user_id TEXT NOT NULL,
        session_token TEXT NOT NULL UNIQUE,
        created_at TEXT NOT NULL,
        expires_at TEXT NOT NULL,
        revoked_at TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_admin_sessions_user
        ON admin_sessions (admin_user_id);
    `
  },
  {
    version: 3,
    name: "add_admin_role_assignments",
    sql: `
      CREATE TABLE IF NOT EXISTS admin_role_assignments (
        role_assignment_id TEXT PRIMARY KEY,
        admin_user_id TEXT NOT NULL,
        role TEXT NOT NULL,
        tenant_id TEXT,
        workspace_id TEXT,
        created_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_admin_role_assignments_user
        ON admin_role_assignments (admin_user_id);
    `
  },
  {
    version: 4,
    name: "add_admin_audit_events",
    sql: `
      CREATE TABLE IF NOT EXISTS admin_audit_events (
        admin_audit_event_id TEXT PRIMARY KEY,
        event_type TEXT NOT NULL,
        actor_admin_user_id TEXT,
        subject_admin_user_id TEXT,
        occurred_at TEXT NOT NULL,
        summary TEXT NOT NULL,
        details_json TEXT NOT NULL DEFAULT '{}'
      );

      CREATE INDEX IF NOT EXISTS idx_admin_audit_events_occurred_at
        ON admin_audit_events (occurred_at);
      CREATE INDEX IF NOT EXISTS idx_admin_audit_events_subject
        ON admin_audit_events (subject_admin_user_id, occurred_at);
      CREATE INDEX IF NOT EXISTS idx_admin_audit_events_actor
        ON admin_audit_events (actor_admin_user_id, occurred_at);
    `
  },
  {
    version: 5,
    name: "add_test_run_unit_responses",
    sql: `
      ALTER TABLE test_runs
      ADD COLUMN unit_responses_json TEXT NOT NULL DEFAULT '{}';
    `
  },
  {
    version: 6,
    name: "add_workspace_reviews",
    sql: `
      CREATE TABLE IF NOT EXISTS workspace_reviews (
        review_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        participant_session_id TEXT NOT NULL,
        test_run_id TEXT NOT NULL,
        unit_key TEXT,
        reviewer_id TEXT NOT NULL,
        category TEXT NOT NULL,
        comment_text TEXT NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_workspace_reviews_workspace
        ON workspace_reviews (tenant_id, workspace_id, updated_at);
      CREATE INDEX IF NOT EXISTS idx_workspace_reviews_test_run
        ON workspace_reviews (test_run_id);
    `
  },
  {
    version: 7,
    name: "add_participant_roster_entries",
    sql: `
      CREATE TABLE IF NOT EXISTS participant_roster_entries (
        participant_roster_entry_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        login_key TEXT NOT NULL,
        group_key TEXT NOT NULL,
        booklet_key TEXT,
        display_name TEXT,
        imported_at TEXT NOT NULL,
        UNIQUE (tenant_id, workspace_id, login_key)
      );

      CREATE INDEX IF NOT EXISTS idx_participant_roster_entries_workspace
        ON participant_roster_entries (tenant_id, workspace_id, login_key);
    `
  },
  {
    version: 8,
    name: "add_participant_roster_password_hash",
    sql: `
      ALTER TABLE participant_roster_entries
        ADD COLUMN IF NOT EXISTS password_hash TEXT;
    `
  },
  {
    version: 9,
    name: "add_participant_roster_booklet_keys",
    sql: `
      ALTER TABLE participant_roster_entries
        ADD COLUMN IF NOT EXISTS booklet_keys_json TEXT;
    `
  },
  {
    version: 10,
    name: "add_test_run_unlocked_testlets",
    sql: `
      ALTER TABLE test_runs
        ADD COLUMN IF NOT EXISTS unlocked_testlet_keys_json TEXT NOT NULL DEFAULT '[]';
    `
  },
  {
    version: 11,
    name: "add_test_run_testlet_timers",
    sql: `
      ALTER TABLE test_runs
        ADD COLUMN IF NOT EXISTS testlet_timers_json TEXT NOT NULL DEFAULT '{}';
    `
  },
  {
    version: 12,
    name: "add_test_run_leave_locks",
    sql: `
      ALTER TABLE test_runs
        ADD COLUMN IF NOT EXISTS locked_testlet_keys_json TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE test_runs
        ADD COLUMN IF NOT EXISTS locked_unit_keys_json TEXT NOT NULL DEFAULT '[]';
    `
  },
  {
    version: 13,
    name: "add_test_run_monitor_navigation_unlock",
    sql: `
      ALTER TABLE test_runs
        ADD COLUMN IF NOT EXISTS monitor_navigation_unlocked BOOLEAN NOT NULL DEFAULT FALSE;
    `
  },
  {
    version: 14,
    name: "add_participant_booklet_state_presets",
    sql: `
      ALTER TABLE participant_roster_entries
        ADD COLUMN IF NOT EXISTS booklet_state_presets_json TEXT;
      ALTER TABLE test_runs
        ADD COLUMN IF NOT EXISTS preset_booklet_states_json TEXT NOT NULL DEFAULT '{}';
    `
  },
  {
    version: 15,
    name: "add_participant_booklet_assignment_variants",
    sql: `
      ALTER TABLE participant_roster_entries
        ADD COLUMN IF NOT EXISTS booklet_assignments_json TEXT;
      ALTER TABLE test_runs
        ADD COLUMN IF NOT EXISTS booklet_assignment_key TEXT;
    `
  },
  {
    version: 16,
    name: "persist_booklet_states_snapshot",
    sql: `
      ALTER TABLE test_runs
        ADD COLUMN IF NOT EXISTS booklet_states_json TEXT NOT NULL DEFAULT '{}';
    `
  },
  {
    version: 17,
    name: "add_participant_access_windows",
    sql: `
      ALTER TABLE participant_roster_entries ADD COLUMN IF NOT EXISTS valid_from TEXT;
      ALTER TABLE participant_roster_entries ADD COLUMN IF NOT EXISTS valid_to TEXT;
      ALTER TABLE participant_roster_entries ADD COLUMN IF NOT EXISTS valid_for_minutes INTEGER;
      ALTER TABLE participant_sessions ADD COLUMN IF NOT EXISTS valid_until TEXT;
    `
  },
  {
    version: 18,
    name: "add_participant_login_attempts",
    sql: `
      CREATE TABLE IF NOT EXISTS participant_login_attempts (
        tenant_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        login_key TEXT NOT NULL,
        failed_attempts INTEGER NOT NULL,
        expires_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (tenant_id, workspace_id, login_key)
      );
      CREATE INDEX IF NOT EXISTS idx_participant_login_attempts_expiry
        ON participant_login_attempts (expires_at);
    `
  },
  {
    version: 19,
    name: "add_participant_code",
    sql: `
      ALTER TABLE participant_sessions ADD COLUMN IF NOT EXISTS participant_code TEXT;
    `
  },
  {
    version: 20,
    name: "add_participant_test_logs",
    sql: `
      CREATE TABLE IF NOT EXISTS participant_test_logs (
        participant_test_log_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        participant_session_id TEXT NOT NULL,
        test_run_id TEXT NOT NULL,
        unit_key TEXT,
        original_unit_id TEXT,
        log_key TEXT NOT NULL,
        log_content TEXT NOT NULL,
        timestamp BIGINT NOT NULL,
        recorded_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_participant_test_logs_workspace
        ON participant_test_logs (tenant_id, workspace_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_participant_test_logs_test_run
        ON participant_test_logs (test_run_id, timestamp);
    `
  },
  {
    version: 21,
    name: "add_participant_execution_modes",
    sql: `
      ALTER TABLE participant_roster_entries ADD COLUMN IF NOT EXISTS execution_mode TEXT;
      ALTER TABLE participant_sessions ADD COLUMN IF NOT EXISTS execution_mode TEXT;
      ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS execution_mode TEXT;
    `
  },
  {
    version: 22,
    name: "persist_booklet_state_overrides",
    sql: `
      ALTER TABLE test_runs
        ADD COLUMN IF NOT EXISTS booklet_state_overrides_json TEXT NOT NULL DEFAULT '{}';
    `
  },
  {
    version: 23,
    name: "add_review_priorities",
    sql: `
      ALTER TABLE workspace_reviews
        ADD COLUMN IF NOT EXISTS priority INTEGER NOT NULL DEFAULT 0;
    `
  },
  {
    version: 24,
    name: "add_review_task_pages",
    sql: `
      ALTER TABLE workspace_reviews ADD COLUMN IF NOT EXISTS page INTEGER;
      ALTER TABLE workspace_reviews ADD COLUMN IF NOT EXISTS page_label TEXT;
    `
  },
  {
    version: 25,
    name: "add_review_provenance",
    sql: `
      ALTER TABLE workspace_reviews ADD COLUMN IF NOT EXISTS original_unit_id TEXT;
      ALTER TABLE workspace_reviews ADD COLUMN IF NOT EXISTS user_agent TEXT;
    `
  },
  {
    version: 26,
    name: "add_admin_role_group_scope",
    sql: `
      ALTER TABLE admin_role_assignments ADD COLUMN IF NOT EXISTS group_key TEXT;
    `
  },
  {
    version: 27,
    name: "add_admin_access_windows",
    sql: `
      ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS valid_from TEXT;
      ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS valid_to TEXT;
      ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS valid_for_minutes INTEGER;
      ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS first_signed_in_at TEXT;
    `
  },
  {
    version: 28,
    name: "add_admin_role_monitor_profiles",
    sql: `
      ALTER TABLE admin_role_assignments ADD COLUMN IF NOT EXISTS monitor_profiles_json JSONB NOT NULL DEFAULT '[]'::jsonb;
    `
  },
  {
    version: 29,
    name: "add_participant_custom_texts",
    sql: `
      ALTER TABLE participant_roster_entries ADD COLUMN IF NOT EXISTS custom_texts_json JSONB NOT NULL DEFAULT '{}'::jsonb;
    `
  },
  {
    version: 30,
    name: "add_test_run_lock",
    sql: `
      ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS locked BOOLEAN NOT NULL DEFAULT FALSE;
    `
  },
  {
    version: 31,
    name: "add_admin_role_access_mode",
    sql: `
      ALTER TABLE admin_role_assignments ADD COLUMN IF NOT EXISTS access_mode TEXT NOT NULL DEFAULT 'read_write';
    `
  },
  {
    version: 32,
    name: "add_application_settings",
    sql: `
      CREATE TABLE IF NOT EXISTS application_settings (
        settings_key TEXT PRIMARY KEY,
        app_title TEXT NOT NULL,
        global_warning_text TEXT,
        global_warning_expires_at TEXT,
        updated_at TEXT,
        updated_by_admin_user_id TEXT
      );
    `
  },
  {
    version: 33,
    name: "add_attachment_files",
    sql: `
      CREATE TABLE IF NOT EXISTS attachment_files (
        attachment_file_id TEXT PRIMARY KEY,
        attachment_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        media_type TEXT NOT NULL,
        data_base64 TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS attachment_files_workspace_attachment_idx
        ON attachment_files (tenant_id, workspace_id, attachment_id, created_at);
    `
  },
  {
    version: 34,
    name: "add_application_branding",
    sql: `
      ALTER TABLE application_settings ADD COLUMN IF NOT EXISTS main_logo TEXT NOT NULL DEFAULT 'app-icon.svg';
      ALTER TABLE application_settings ADD COLUMN IF NOT EXISTS theme_name TEXT NOT NULL DEFAULT 'Primar';
    `
  },
  {
    version: 35,
    name: "add_application_custom_texts",
    sql: `
      ALTER TABLE application_settings ADD COLUMN IF NOT EXISTS custom_texts_json TEXT NOT NULL DEFAULT '{}';
    `
  },
  {
    version: 36,
    name: "add_admin_custom_texts",
    sql: `
      ALTER TABLE admin_users ADD COLUMN IF NOT EXISTS custom_texts_json JSONB NOT NULL DEFAULT '{}'::jsonb;
    `
  },
  {
    version: 37,
    name: "add_application_content",
    sql: `
      ALTER TABLE application_settings ADD COLUMN IF NOT EXISTS intro_html TEXT NOT NULL DEFAULT '';
      ALTER TABLE application_settings ADD COLUMN IF NOT EXISTS legal_notice_html TEXT NOT NULL DEFAULT '';
    `
  },
  {
    version: 38,
    name: "add_operational_login_migration_candidates",
    sql: `
      CREATE TABLE IF NOT EXISTS operational_login_migration_candidates (
        tenant_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        candidates_json JSONB NOT NULL DEFAULT '[]'::jsonb,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (tenant_id, workspace_id)
      );
    `
  },
  {
    version: 39,
    name: "add_admin_login_attempts",
    sql: `
      CREATE TABLE IF NOT EXISTS admin_login_attempts (
        username TEXT PRIMARY KEY,
        failed_attempts INTEGER NOT NULL,
        expires_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_admin_login_attempts_expiry
        ON admin_login_attempts (expires_at);
    `
  },
  {
    version: 40,
    name: "add_admin_password_change_required",
    sql: `
      ALTER TABLE admin_users
        ADD COLUMN IF NOT EXISTS password_change_required BOOLEAN NOT NULL DEFAULT FALSE;
    `
  },
  {
    version: 41,
    name: "index_participant_test_state_monitor_reads",
    sql: `
      CREATE TABLE IF NOT EXISTS participant_test_logs (
        participant_test_log_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        participant_session_id TEXT NOT NULL,
        test_run_id TEXT NOT NULL,
        unit_key TEXT,
        original_unit_id TEXT,
        log_key TEXT NOT NULL,
        log_content TEXT NOT NULL,
        timestamp BIGINT NOT NULL,
        recorded_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_participant_test_logs_monitor_state
        ON participant_test_logs (
          tenant_id,
          workspace_id,
          log_key,
          test_run_id,
          timestamp DESC,
          recorded_at DESC
        )
        WHERE unit_key IS NULL;
    `
  }
];

export const POSTGRES_FIRST_SLICE_SCHEMA_VERSION =
  migrations[migrations.length - 1]?.version ?? 0;

const applyMigrations = async (pool: Pool): Promise<void> => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      version INTEGER PRIMARY KEY,
      name TEXT NOT NULL,
      applied_at TEXT NOT NULL
    )
  `);
  const result = await pool.query<{ version: number }>(
    `SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations`
  );
  const currentVersion = Number(result.rows[0]?.version ?? 0);
  const pending = migrations.filter(migration => migration.version > currentVersion);

  for (const migration of pending) {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(migration.sql);
      await client.query(
        `INSERT INTO schema_migrations (version, name, applied_at) VALUES ($1, $2, $3)`,
        [migration.version, migration.name, new Date().toISOString()]
      );
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
};

export type PostgresFirstSliceStorageDiagnostics = {
  currentSchemaVersion: number;
  targetSchemaVersion: number;
};

export const inspectPostgresFirstSliceStorage = async (
  connectionString: string
): Promise<PostgresFirstSliceStorageDiagnostics> => {
  const pool = new Pool({ connectionString });

  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version INTEGER PRIMARY KEY,
        name TEXT NOT NULL,
        applied_at TEXT NOT NULL
      )
    `);
    const result = await pool.query<{ version: number }>(
      `SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations`
    );
    return {
      currentSchemaVersion: Number(result.rows[0]?.version ?? 0),
      targetSchemaVersion: POSTGRES_FIRST_SLICE_SCHEMA_VERSION
    };
  } finally {
    await pool.end();
  }
};

export const migratePostgresFirstSliceStorage = async (
  connectionString: string
): Promise<PostgresFirstSliceStorageDiagnostics> => {
  const pool = new Pool({ connectionString });

  try {
    await applyMigrations(pool);
    const result = await pool.query<{ version: number }>(
      `SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations`
    );
    return {
      currentSchemaVersion: Number(result.rows[0]?.version ?? 0),
      targetSchemaVersion: POSTGRES_FIRST_SLICE_SCHEMA_VERSION
    };
  } finally {
    await pool.end();
  }
};

export const checkPostgresFirstSliceReadiness = async (
  connectionString: string
): Promise<void> => {
  const pool = new Pool({ connectionString });

  try {
    await pool.query("SELECT 1");
  } finally {
    await pool.end();
  }
};

const createRepositoryFromPool = (pool: Pool): FirstSliceRepository => {
  const one = async <T>(
    sql: string,
    values: unknown[],
    map: (row: Row | undefined) => T | null
  ): Promise<T | null> => {
    const result = await pool.query(sql, values);
    return map(result.rows[0] as Row | undefined);
  };

  const many = async <T>(
    sql: string,
    values: unknown[],
    map: (row: Row | undefined) => T | null
  ): Promise<T[]> => {
    const result = await pool.query(sql, values);
    return result.rows.map(row => map(row as Row)).filter(Boolean) as T[];
  };

  return {
    async getApplicationSettings() {
      return one(
        `SELECT app_title, main_logo, theme_name, intro_html,
                legal_notice_html, custom_texts_json,
                global_warning_text, global_warning_expires_at,
                updated_at, updated_by_admin_user_id
         FROM application_settings
         WHERE settings_key = 'global'`,
        [],
        mapApplicationSettings
      );
    },
    async saveApplicationSettings(settings) {
      await pool.query(
        `INSERT INTO application_settings (
          settings_key, app_title, main_logo, theme_name, intro_html,
          legal_notice_html, custom_texts_json,
          global_warning_text, global_warning_expires_at,
          updated_at, updated_by_admin_user_id
        ) VALUES ('global', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT(settings_key) DO UPDATE SET
          app_title = EXCLUDED.app_title,
          main_logo = EXCLUDED.main_logo,
          theme_name = EXCLUDED.theme_name,
          intro_html = EXCLUDED.intro_html,
          legal_notice_html = EXCLUDED.legal_notice_html,
          custom_texts_json = EXCLUDED.custom_texts_json,
          global_warning_text = EXCLUDED.global_warning_text,
          global_warning_expires_at = EXCLUDED.global_warning_expires_at,
          updated_at = EXCLUDED.updated_at,
          updated_by_admin_user_id = EXCLUDED.updated_by_admin_user_id`,
        [
          settings.appTitle,
          settings.mainLogo,
          settings.themeName,
          settings.introHtml,
          settings.legalNoticeHtml,
          JSON.stringify(settings.customTexts),
          settings.globalWarningText,
          settings.globalWarningExpiresAt,
          settings.updatedAt,
          settings.updatedByAdminUserId
        ]
      );
    },
    async listAttachmentFilesByWorkspace(tenantId, workspaceId) {
      return many(
        `SELECT attachment_file_id, attachment_id, tenant_id, workspace_id,
                file_name, media_type, data_base64, created_at
         FROM attachment_files
         WHERE tenant_id = $1 AND workspace_id = $2
         ORDER BY created_at ASC, attachment_file_id ASC`,
        [tenantId, workspaceId],
        mapAttachmentFile
      );
    },
    async getAttachmentFileById(attachmentFileId) {
      return one(
        `SELECT attachment_file_id, attachment_id, tenant_id, workspace_id,
                file_name, media_type, data_base64, created_at
         FROM attachment_files
         WHERE attachment_file_id = $1`,
        [attachmentFileId],
        mapAttachmentFile
      );
    },
    async saveAttachmentFile(attachmentFile) {
      await pool.query(
        `INSERT INTO attachment_files (
          attachment_file_id, attachment_id, tenant_id, workspace_id,
          file_name, media_type, data_base64, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT(attachment_file_id) DO UPDATE SET
          attachment_id = EXCLUDED.attachment_id,
          tenant_id = EXCLUDED.tenant_id,
          workspace_id = EXCLUDED.workspace_id,
          file_name = EXCLUDED.file_name,
          media_type = EXCLUDED.media_type,
          data_base64 = EXCLUDED.data_base64,
          created_at = EXCLUDED.created_at`,
        [
          attachmentFile.attachmentFileId,
          attachmentFile.attachmentId,
          attachmentFile.tenantId,
          attachmentFile.workspaceId,
          attachmentFile.fileName,
          attachmentFile.mediaType,
          attachmentFile.dataBase64,
          attachmentFile.createdAt
        ]
      );
    },
    async deleteAttachmentFile(attachmentFileId) {
      const result = await pool.query(
        `DELETE FROM attachment_files WHERE attachment_file_id = $1`,
        [attachmentFileId]
      );
      return (result.rowCount ?? 0) > 0;
    },
    async listAdminUsers() {
      return many(
        `SELECT admin_user_id, username, display_name, password_hash, password_change_required, status, custom_texts_json, valid_from, valid_to, valid_for_minutes, first_signed_in_at, created_at
         FROM admin_users
         ORDER BY created_at ASC`,
        [],
        mapAdminUser
      );
    },
    async getAdminUserById(adminUserId) {
      return one(
        `SELECT admin_user_id, username, display_name, password_hash, password_change_required, status, custom_texts_json, valid_from, valid_to, valid_for_minutes, first_signed_in_at, created_at
         FROM admin_users
         WHERE admin_user_id = $1`,
        [adminUserId],
        mapAdminUser
      );
    },
    async getAdminUserByUsername(username) {
      return one(
        `SELECT admin_user_id, username, display_name, password_hash, password_change_required, status, custom_texts_json, valid_from, valid_to, valid_for_minutes, first_signed_in_at, created_at
         FROM admin_users
         WHERE username = $1`,
        [username],
        mapAdminUser
      );
    },
    async getAdminLoginAttempt(username) {
      return one(
        `SELECT username, failed_attempts, expires_at, updated_at
         FROM admin_login_attempts
         WHERE username = $1`,
        [username],
        mapAdminLoginAttempt
      );
    },
    async recordAdminLoginFailure(input) {
      const result = await pool.query<Row>(
        `INSERT INTO admin_login_attempts (
          username, failed_attempts, expires_at, updated_at
        ) VALUES ($1, 1, $2, $3)
        ON CONFLICT (username) DO UPDATE SET
          failed_attempts = CASE
            WHEN admin_login_attempts.expires_at <= EXCLUDED.updated_at THEN 1
            ELSE admin_login_attempts.failed_attempts + 1
          END,
          expires_at = EXCLUDED.expires_at,
          updated_at = EXCLUDED.updated_at
        RETURNING username, failed_attempts, expires_at, updated_at`,
        [input.username, input.expiresAt, input.attemptedAt]
      );
      const loginAttempt = mapAdminLoginAttempt(result.rows[0]);
      if (!loginAttempt) {
        throw new Error("Admin login failure could not be persisted.");
      }
      return loginAttempt;
    },
    async saveAdminUser(adminUser) {
      await pool.query(
        `INSERT INTO admin_users (
          admin_user_id, username, display_name, password_hash, password_change_required, status, custom_texts_json, valid_from, valid_to, valid_for_minutes, first_signed_in_at, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10, $11, $12)
        ON CONFLICT(admin_user_id) DO UPDATE SET
          username = EXCLUDED.username,
          display_name = EXCLUDED.display_name,
          password_hash = EXCLUDED.password_hash,
          password_change_required = EXCLUDED.password_change_required,
          status = EXCLUDED.status,
          custom_texts_json = EXCLUDED.custom_texts_json,
          valid_from = EXCLUDED.valid_from,
          valid_to = EXCLUDED.valid_to,
          valid_for_minutes = EXCLUDED.valid_for_minutes,
          first_signed_in_at = EXCLUDED.first_signed_in_at,
          created_at = EXCLUDED.created_at`,
        [
          adminUser.adminUserId,
          adminUser.username,
          adminUser.displayName,
          adminUser.passwordHash,
          adminUser.passwordChangeRequired,
          adminUser.status,
          JSON.stringify(adminUser.customTexts),
          adminUser.validFrom,
          adminUser.validTo,
          adminUser.validForMinutes,
          adminUser.firstSignedInAt,
          adminUser.createdAt
        ]
      );
    },
    async deleteAdminUser(adminUserId) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const deletedRoleAssignments = await client.query(
          `DELETE FROM admin_role_assignments WHERE admin_user_id = $1`,
          [adminUserId]
        );
        const deletedSessions = await client.query(
          `DELETE FROM admin_sessions WHERE admin_user_id = $1`,
          [adminUserId]
        );
        await client.query(`DELETE FROM admin_users WHERE admin_user_id = $1`, [
          adminUserId
        ]);
        await client.query("COMMIT");
        return {
          deletedRoleAssignmentCount: deletedRoleAssignments.rowCount ?? 0,
          deletedSessionCount: deletedSessions.rowCount ?? 0
        };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async listAdminRoleAssignmentsByUserId(adminUserId) {
      return many(
        `SELECT role_assignment_id, admin_user_id, role, access_mode, tenant_id, workspace_id, group_key, monitor_profiles_json, created_at
         FROM admin_role_assignments
         WHERE admin_user_id = $1`,
        [adminUserId],
        mapAdminRoleAssignment
      );
    },
    async saveAdminRoleAssignment(roleAssignment) {
      await pool.query(
        `INSERT INTO admin_role_assignments (
          role_assignment_id, admin_user_id, role, access_mode, tenant_id, workspace_id, group_key, monitor_profiles_json, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8::jsonb, $9)
        ON CONFLICT(role_assignment_id) DO UPDATE SET
          admin_user_id = EXCLUDED.admin_user_id,
          role = EXCLUDED.role,
          access_mode = EXCLUDED.access_mode,
          tenant_id = EXCLUDED.tenant_id,
          workspace_id = EXCLUDED.workspace_id,
          group_key = EXCLUDED.group_key,
          monitor_profiles_json = EXCLUDED.monitor_profiles_json,
          created_at = EXCLUDED.created_at`,
        [
          roleAssignment.roleAssignmentId,
          roleAssignment.adminUserId,
          roleAssignment.role,
          roleAssignment.accessMode,
          roleAssignment.tenantId,
          roleAssignment.workspaceId,
          roleAssignment.groupKey,
          JSON.stringify(roleAssignment.monitorProfiles),
          roleAssignment.createdAt
        ]
      );
    },
    async deleteAdminRoleAssignment(roleAssignmentId) {
      await pool.query(
        `DELETE FROM admin_role_assignments WHERE role_assignment_id = $1`,
        [roleAssignmentId]
      );
    },
    async listAdminAuditEvents() {
      return many(
        `SELECT admin_audit_event_id, event_type, actor_admin_user_id, subject_admin_user_id, occurred_at, summary, details_json
         FROM admin_audit_events`,
        [],
        mapAdminAuditEvent
      );
    },
    async saveAdminAuditEvent(auditEvent) {
      await pool.query(
        `INSERT INTO admin_audit_events (
          admin_audit_event_id, event_type, actor_admin_user_id, subject_admin_user_id, occurred_at, summary, details_json
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT(admin_audit_event_id) DO UPDATE SET
          event_type = EXCLUDED.event_type,
          actor_admin_user_id = EXCLUDED.actor_admin_user_id,
          subject_admin_user_id = EXCLUDED.subject_admin_user_id,
          occurred_at = EXCLUDED.occurred_at,
          summary = EXCLUDED.summary,
          details_json = EXCLUDED.details_json`,
        [
          auditEvent.adminAuditEventId,
          auditEvent.eventType,
          auditEvent.actorAdminUserId,
          auditEvent.subjectAdminUserId,
          auditEvent.occurredAt,
          auditEvent.summary,
          JSON.stringify(auditEvent.details)
        ]
      );
    },
    async listAdminSessions() {
      const { rows } = await pool.query(
        `SELECT admin_session_id, admin_user_id, session_token, created_at, expires_at, revoked_at
         FROM admin_sessions`
      );
      return rows.flatMap(row => {
        const adminSession = mapAdminSession(row);
        return adminSession ? [adminSession] : [];
      });
    },
    async getAdminSessionByToken(token) {
      return one(
        `SELECT admin_session_id, admin_user_id, session_token, created_at, expires_at, revoked_at
         FROM admin_sessions
         WHERE session_token = $1`,
        [token],
        mapAdminSession
      );
    },
    async saveAdminSession(adminSession) {
      await pool.query(
        `INSERT INTO admin_sessions (
          admin_session_id, admin_user_id, session_token, created_at, expires_at, revoked_at
        ) VALUES ($1, $2, $3, $4, $5, $6)
        ON CONFLICT(admin_session_id) DO UPDATE SET
          admin_user_id = EXCLUDED.admin_user_id,
          session_token = EXCLUDED.session_token,
          created_at = EXCLUDED.created_at,
          expires_at = EXCLUDED.expires_at,
          revoked_at = EXCLUDED.revoked_at`,
        [
          adminSession.adminSessionId,
          adminSession.adminUserId,
          adminSession.token,
          adminSession.createdAt,
          adminSession.expiresAt,
          adminSession.revokedAt
        ]
      );
    },
    async getTenantByKey(tenantKey) {
      return one(
        `SELECT tenant_id, tenant_key, display_name, status, created_at
         FROM tenants
         WHERE tenant_key = $1`,
        [tenantKey],
        mapTenant
      );
    },
    async listTenants() {
      return many(
        `SELECT tenant_id, tenant_key, display_name, status, created_at
         FROM tenants`,
        [],
        mapTenant
      );
    },
    async saveTenant(tenant) {
      await pool.query(
        `INSERT INTO tenants (
          tenant_id, tenant_key, display_name, status, created_at
        ) VALUES ($1, $2, $3, $4, $5)
        ON CONFLICT(tenant_id) DO UPDATE SET
          tenant_key = EXCLUDED.tenant_key,
          display_name = EXCLUDED.display_name,
          status = EXCLUDED.status,
          created_at = EXCLUDED.created_at`,
        [
          tenant.tenantId,
          tenant.tenantKey,
          tenant.displayName,
          tenant.status,
          tenant.createdAt
        ]
      );
    },
    async getWorkspaceByScope(tenantKey, workspaceKey) {
      return one(
        `SELECT workspace_id, tenant_id, workspace_key, display_name, status, created_at
         FROM workspaces
         WHERE tenant_key = $1 AND workspace_key = $2`,
        [tenantKey, workspaceKey],
        mapWorkspace
      );
    },
    async getWorkspaceByWorkspaceKey(workspaceKey) {
      return one(
        `SELECT workspace_id, tenant_id, workspace_key, display_name, status, created_at
         FROM workspaces
         WHERE workspace_key = $1
         ORDER BY created_at ASC
         LIMIT 1`,
        [workspaceKey],
        mapWorkspace
      );
    },
    async listWorkspacesByTenantId(tenantId) {
      return many(
        `SELECT workspace_id, tenant_id, workspace_key, display_name, status, created_at
         FROM workspaces
         WHERE tenant_id = $1`,
        [tenantId],
        mapWorkspace
      );
    },
    async saveWorkspace(scope) {
      await pool.query(
        `INSERT INTO workspaces (
          workspace_id, tenant_id, tenant_key, workspace_key, display_name, status, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT(workspace_id) DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          tenant_key = EXCLUDED.tenant_key,
          workspace_key = EXCLUDED.workspace_key,
          display_name = EXCLUDED.display_name,
          status = EXCLUDED.status,
          created_at = EXCLUDED.created_at`,
        [
          scope.workspace.workspaceId,
          scope.workspace.tenantId,
          scope.tenantKey,
          scope.workspace.workspaceKey,
          scope.workspace.displayName,
          scope.workspace.status,
          scope.workspace.createdAt
        ]
      );
    },
    async deleteWorkspaceAggregate(input) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const current = await client.query(
          `SELECT workspace_id
           FROM workspaces
           WHERE tenant_key = $1 AND workspace_key = $2 AND tenant_id = $3 AND workspace_id = $4
           FOR UPDATE`,
          [input.tenantKey, input.workspaceKey, input.tenantId, input.workspaceId]
        );
        if ((current.rowCount ?? 0) !== 1) {
          await client.query("ROLLBACK");
          return null;
        }
        const deleteScoped = async (tableName: string): Promise<number> => {
          const result = await client.query(
            `DELETE FROM ${tableName} WHERE tenant_id = $1 AND workspace_id = $2`,
            [input.tenantId, input.workspaceId]
          );
          return result.rowCount ?? 0;
        };
        const roleAssignments = await client.query(
          "DELETE FROM admin_role_assignments WHERE workspace_id = $1",
          [input.workspaceId]
        );
        const deletedAttachmentFileCount = await deleteScoped("attachment_files");
        const deletedActivityEventCount = await deleteScoped(
          "workspace_activity_events"
        );
        const deletedReviewCount = await deleteScoped("workspace_reviews");
        const deletedSourcePackageCount = await deleteScoped("source_packages");
        const deletedImportJobCount = await deleteScoped("import_jobs");
        const deletedContentReleaseCount = await deleteScoped("content_releases");
        const deletedParticipantSessionCount = await deleteScoped(
          "participant_sessions"
        );
        const deletedRosterEntryCount = await deleteScoped(
          "participant_roster_entries"
        );
        await deleteScoped("operational_login_migration_candidates");
        const deletedLoginAttemptCount = await deleteScoped(
          "participant_login_attempts"
        );
        const deletedTestRunCount = await deleteScoped("test_runs");
        const deletedTestLogCount = await deleteScoped("participant_test_logs");
        const deletedWorkspace = await client.query(
          `DELETE FROM workspaces
           WHERE tenant_id = $1 AND workspace_id = $2 AND workspace_key = $3`,
          [input.tenantId, input.workspaceId, input.workspaceKey]
        );
        if ((deletedWorkspace.rowCount ?? 0) !== 1) {
          await client.query("ROLLBACK");
          return null;
        }
        await client.query(
          `INSERT INTO admin_audit_events (
            admin_audit_event_id, event_type, actor_admin_user_id,
            subject_admin_user_id, occurred_at, summary, details_json
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            input.auditEvent.adminAuditEventId,
            input.auditEvent.eventType,
            input.auditEvent.actorAdminUserId,
            input.auditEvent.subjectAdminUserId,
            input.auditEvent.occurredAt,
            input.auditEvent.summary,
            JSON.stringify(input.auditEvent.details)
          ]
        );
        await client.query("COMMIT");
        return {
          deletedWorkspaceCount: 1,
          deletedAdminRoleAssignmentCount: roleAssignments.rowCount ?? 0,
          deletedAttachmentFileCount,
          deletedActivityEventCount,
          deletedReviewCount,
          deletedSourcePackageCount,
          deletedImportJobCount,
          deletedContentReleaseCount,
          deletedParticipantSessionCount,
          deletedRosterEntryCount,
          deletedLoginAttemptCount,
          deletedTestRunCount,
          deletedTestLogCount
        };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async listWorkspaceActivityEventsByWorkspace(tenantId, workspaceId) {
      return many(
        `SELECT activity_event_id, tenant_id, workspace_id, event_type, actor_id, subject_type, subject_id, occurred_at, summary, details_json
         FROM workspace_activity_events
         WHERE tenant_id = $1 AND workspace_id = $2`,
        [tenantId, workspaceId],
        mapWorkspaceActivityEvent
      );
    },
    async saveWorkspaceActivityEvent(activityEvent) {
      await pool.query(
        `INSERT INTO workspace_activity_events (
          activity_event_id, tenant_id, workspace_id, event_type, actor_id, subject_type, subject_id, occurred_at, summary, details_json
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
        ON CONFLICT(activity_event_id) DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          workspace_id = EXCLUDED.workspace_id,
          event_type = EXCLUDED.event_type,
          actor_id = EXCLUDED.actor_id,
          subject_type = EXCLUDED.subject_type,
          subject_id = EXCLUDED.subject_id,
          occurred_at = EXCLUDED.occurred_at,
          summary = EXCLUDED.summary,
          details_json = EXCLUDED.details_json`,
        [
          activityEvent.activityEventId,
          activityEvent.tenantId,
          activityEvent.workspaceId,
          activityEvent.eventType,
          activityEvent.actorId,
          activityEvent.subjectType,
          activityEvent.subjectId,
          activityEvent.occurredAt,
          activityEvent.summary,
          JSON.stringify(activityEvent.details)
        ]
      );
    },
    async deleteWorkspaceActivityEventsByIds(activityEventIds) {
      if (activityEventIds.length === 0) {
        return 0;
      }
      const result = await pool.query(
        "DELETE FROM workspace_activity_events WHERE activity_event_id = ANY($1::text[])",
        [activityEventIds]
      );
      return result.rowCount ?? 0;
    },
    async getSourcePackageById(sourcePackageId) {
      return one(
        `SELECT source_package_id, tenant_id, workspace_id, file_name, media_type, content_structure_json, source_document_text, status, uploaded_at
         FROM source_packages
         WHERE source_package_id = $1`,
        [sourcePackageId],
        mapSourcePackage
      );
    },
    async listSourcePackagesByWorkspace(tenantId, workspaceId) {
      return many(
        `SELECT source_package_id, tenant_id, workspace_id, file_name, media_type, content_structure_json, source_document_text, status, uploaded_at
         FROM source_packages
         WHERE tenant_id = $1 AND workspace_id = $2`,
        [tenantId, workspaceId],
        mapSourcePackage
      );
    },
    async saveSourcePackage(sourcePackage) {
      await pool.query(
        `INSERT INTO source_packages (
          source_package_id, tenant_id, workspace_id, file_name, media_type, content_structure_json, source_document_text, status, uploaded_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT(source_package_id) DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          workspace_id = EXCLUDED.workspace_id,
          file_name = EXCLUDED.file_name,
          media_type = EXCLUDED.media_type,
          content_structure_json = EXCLUDED.content_structure_json,
          source_document_text = EXCLUDED.source_document_text,
          status = EXCLUDED.status,
          uploaded_at = EXCLUDED.uploaded_at`,
        [
          sourcePackage.sourcePackageId,
          sourcePackage.tenantId,
          sourcePackage.workspaceId,
          sourcePackage.fileName,
          sourcePackage.mediaType,
          sourcePackage.contentStructure
            ? JSON.stringify(sourcePackage.contentStructure)
            : null,
          sourcePackage.sourceDocument,
          sourcePackage.status,
          sourcePackage.uploadedAt
        ]
      );
    },
    async deleteSourcePackageAggregate(input) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const sourcePackage = await client.query<{ source_package_id: string }>(
          `SELECT source_package_id
           FROM source_packages
           WHERE source_package_id = $1 AND tenant_id = $2 AND workspace_id = $3
           FOR UPDATE`,
          [input.sourcePackageId, input.tenantId, input.workspaceId]
        );
        if (sourcePackage.rowCount !== 1) {
          await client.query("ROLLBACK");
          return false;
        }
        const importJobs = await client.query<{
          import_job_id: string;
          status: string;
        }>(
          `SELECT import_job_id, status
           FROM import_jobs
           WHERE tenant_id = $1 AND workspace_id = $2 AND source_package_id = $3
           FOR UPDATE`,
          [input.tenantId, input.workspaceId, input.sourcePackageId]
        );
        const importJobIds = importJobs.rows.map(row => row.import_job_id);
        const contentReleases = await client.query<{
          content_release_id: string;
          status: string;
        }>(
          `SELECT content_release_id, status
           FROM content_releases
           WHERE tenant_id = $1 AND workspace_id = $2
             AND import_job_id = ANY($3::text[])
           FOR UPDATE`,
          [input.tenantId, input.workspaceId, importJobIds]
        );
        const contentReleaseIds = contentReleases.rows.map(
          row => row.content_release_id
        );
        const references = await client.query<{ reference_count: string }>(
          `SELECT
             (SELECT COUNT(*) FROM participant_sessions
              WHERE content_release_id = ANY($1::text[])) +
             (SELECT COUNT(*) FROM test_runs
              WHERE content_release_id = ANY($1::text[])) AS reference_count`,
          [contentReleaseIds]
        );
        const idsMatch = (actual: string[], expected: string[]): boolean =>
          JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
        const isBlocked =
          importJobs.rows.some(
            row => row.status === "queued" || row.status === "running"
          ) ||
          contentReleases.rows.some(row => row.status === "active") ||
          Number(references.rows[0]?.reference_count ?? 0) > 0;
        if (
          isBlocked ||
          !idsMatch(importJobIds, input.expectedImportJobIds) ||
          !idsMatch(contentReleaseIds, input.expectedContentReleaseIds)
        ) {
          await client.query("ROLLBACK");
          return false;
        }

        await client.query(
          `DELETE FROM content_releases
           WHERE content_release_id = ANY($1::text[])`,
          [contentReleaseIds]
        );
        await client.query(
          `DELETE FROM import_jobs WHERE import_job_id = ANY($1::text[])`,
          [importJobIds]
        );
        const deletion = await client.query(
          `DELETE FROM source_packages
           WHERE source_package_id = $1 AND tenant_id = $2 AND workspace_id = $3`,
          [input.sourcePackageId, input.tenantId, input.workspaceId]
        );
        await client.query("COMMIT");
        return deletion.rowCount === 1;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async getImportJobById(importJobId) {
      return one(
        `SELECT import_job_id, tenant_id, workspace_id, source_package_id, status, created_at, finished_at, diagnostics_json
         FROM import_jobs
         WHERE import_job_id = $1`,
        [importJobId],
        mapImportJob
      );
    },
    async listImportJobsByWorkspace(tenantId, workspaceId) {
      return many(
        `SELECT import_job_id, tenant_id, workspace_id, source_package_id, status, created_at, finished_at, diagnostics_json
         FROM import_jobs
         WHERE tenant_id = $1 AND workspace_id = $2`,
        [tenantId, workspaceId],
        mapImportJob
      );
    },
    async saveImportJob(importJob) {
      await pool.query(
        `INSERT INTO import_jobs (
          import_job_id, tenant_id, workspace_id, source_package_id, status, created_at, finished_at, diagnostics_json
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
        ON CONFLICT(import_job_id) DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          workspace_id = EXCLUDED.workspace_id,
          source_package_id = EXCLUDED.source_package_id,
          status = EXCLUDED.status,
          created_at = EXCLUDED.created_at,
          finished_at = EXCLUDED.finished_at,
          diagnostics_json = EXCLUDED.diagnostics_json`,
        [
          importJob.importJobId,
          importJob.tenantId,
          importJob.workspaceId,
          importJob.sourcePackageId,
          importJob.status,
          importJob.createdAt,
          importJob.finishedAt,
          JSON.stringify(importJob.diagnostics)
        ]
      );
    },
    async getContentReleaseById(contentReleaseId) {
      return one(
        `SELECT content_release_id, tenant_id, workspace_id, import_job_id, release_label, runtime_snapshot_json, status, created_at, activated_at
         FROM content_releases
         WHERE content_release_id = $1`,
        [contentReleaseId],
        mapContentRelease
      );
    },
    async listContentReleasesByWorkspace(tenantId, workspaceId) {
      return many(
        `SELECT content_release_id, tenant_id, workspace_id, import_job_id, release_label, runtime_snapshot_json, status, created_at, activated_at
         FROM content_releases
         WHERE tenant_id = $1 AND workspace_id = $2`,
        [tenantId, workspaceId],
        mapContentRelease
      );
    },
    async saveContentRelease(contentRelease) {
      await pool.query(
        `INSERT INTO content_releases (
          content_release_id, tenant_id, workspace_id, import_job_id, release_label, runtime_snapshot_json, status, created_at, activated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        ON CONFLICT(content_release_id) DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          workspace_id = EXCLUDED.workspace_id,
          import_job_id = EXCLUDED.import_job_id,
          release_label = EXCLUDED.release_label,
          runtime_snapshot_json = EXCLUDED.runtime_snapshot_json,
          status = EXCLUDED.status,
          created_at = EXCLUDED.created_at,
          activated_at = EXCLUDED.activated_at`,
        [
          contentRelease.contentReleaseId,
          contentRelease.tenantId,
          contentRelease.workspaceId,
          contentRelease.importJobId,
          contentRelease.releaseLabel,
          JSON.stringify(contentRelease.runtimeSnapshot),
          contentRelease.status,
          contentRelease.createdAt,
          contentRelease.activatedAt
        ]
      );
    },
    async getParticipantSessionById(participantSessionId) {
      return one(
        `SELECT participant_session_id, tenant_id, workspace_id, content_release_id, login_key, group_key, participant_code, execution_mode, status, valid_until, created_at
         FROM participant_sessions
         WHERE participant_session_id = $1`,
        [participantSessionId],
        mapParticipantSession
      );
    },
    async listParticipantSessionsByWorkspace(tenantId, workspaceId) {
      return many(
        `SELECT participant_session_id, tenant_id, workspace_id, content_release_id, login_key, group_key, participant_code, execution_mode, status, valid_until, created_at
         FROM participant_sessions
         WHERE tenant_id = $1 AND workspace_id = $2`,
        [tenantId, workspaceId],
        mapParticipantSession
      );
    },
    async saveParticipantSession(participantSession) {
      await pool.query(
        `INSERT INTO participant_sessions (
          participant_session_id, tenant_id, workspace_id, content_release_id, login_key, group_key, participant_code, execution_mode, status, valid_until, created_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        ON CONFLICT(participant_session_id) DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          workspace_id = EXCLUDED.workspace_id,
          content_release_id = EXCLUDED.content_release_id,
          login_key = EXCLUDED.login_key,
          group_key = EXCLUDED.group_key,
          participant_code = EXCLUDED.participant_code,
          execution_mode = EXCLUDED.execution_mode,
          status = EXCLUDED.status,
          valid_until = EXCLUDED.valid_until,
          created_at = EXCLUDED.created_at`,
        [
          participantSession.participantSessionId,
          participantSession.tenantId,
          participantSession.workspaceId,
          participantSession.contentReleaseId,
          participantSession.loginKey,
          participantSession.groupKey,
          participantSession.participantCode ?? null,
          participantSession.executionMode ?? null,
          participantSession.status,
          participantSession.validUntil ?? null,
          participantSession.createdAt
        ]
      );
    },
    async listParticipantRosterEntriesByWorkspace(tenantId, workspaceId) {
      return many(
        `SELECT participant_roster_entry_id, tenant_id, workspace_id, login_key, execution_mode, group_key, booklet_key, booklet_keys_json, booklet_state_presets_json, booklet_assignments_json, display_name, password_hash, valid_from, valid_to, valid_for_minutes, custom_texts_json, imported_at
         FROM participant_roster_entries
         WHERE tenant_id = $1 AND workspace_id = $2`,
        [tenantId, workspaceId],
        mapParticipantRosterEntry
      );
    },
    async listOperationalLoginMigrationCandidatesByWorkspace(
      tenantId,
      workspaceId
    ) {
      const result = await pool.query<{ candidates_json: unknown }>(
        `SELECT candidates_json
         FROM operational_login_migration_candidates
         WHERE tenant_id = $1 AND workspace_id = $2`,
        [tenantId, workspaceId]
      );
      const candidates = result.rows[0]?.candidates_json;
      return Array.isArray(candidates)
        ? (candidates as OperationalLoginMigrationCandidate[])
        : [];
    },
    async replaceOperationalLoginMigrationCandidatesByWorkspace(
      tenantId,
      workspaceId,
      candidates
    ) {
      await pool.query(
        `INSERT INTO operational_login_migration_candidates (
          tenant_id, workspace_id, candidates_json, updated_at
        ) VALUES ($1, $2, $3::jsonb, $4)
        ON CONFLICT (tenant_id, workspace_id) DO UPDATE SET
          candidates_json = EXCLUDED.candidates_json,
          updated_at = EXCLUDED.updated_at`,
        [tenantId, workspaceId, JSON.stringify(candidates), new Date().toISOString()]
      );
    },
    async getParticipantRosterPasswordHash(tenantId, workspaceId, loginKey) {
      const result = await pool.query<{ password_hash: string | null }>(
        `SELECT password_hash
         FROM participant_roster_entries
         WHERE tenant_id = $1 AND workspace_id = $2 AND login_key = $3`,
        [tenantId, workspaceId, loginKey]
      );
      return result.rows[0]?.password_hash ?? null;
    },
    async saveParticipantRosterEntry(participantRosterEntry, passwordHash) {
      await pool.query(
        `INSERT INTO participant_roster_entries (
          participant_roster_entry_id, tenant_id, workspace_id, login_key, execution_mode, group_key, booklet_key, booklet_keys_json, booklet_state_presets_json, booklet_assignments_json, display_name, password_hash, valid_from, valid_to, valid_for_minutes, custom_texts_json, imported_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17)
        ON CONFLICT (tenant_id, workspace_id, login_key) DO UPDATE SET
          participant_roster_entry_id = EXCLUDED.participant_roster_entry_id,
          execution_mode = EXCLUDED.execution_mode,
          group_key = EXCLUDED.group_key,
          booklet_key = EXCLUDED.booklet_key,
          booklet_keys_json = EXCLUDED.booklet_keys_json,
          booklet_state_presets_json = EXCLUDED.booklet_state_presets_json,
          booklet_assignments_json = EXCLUDED.booklet_assignments_json,
          display_name = EXCLUDED.display_name,
          password_hash = EXCLUDED.password_hash,
          valid_from = EXCLUDED.valid_from,
          valid_to = EXCLUDED.valid_to,
          valid_for_minutes = EXCLUDED.valid_for_minutes,
          custom_texts_json = EXCLUDED.custom_texts_json,
          imported_at = EXCLUDED.imported_at`,
        [
          participantRosterEntry.participantRosterEntryId,
          participantRosterEntry.tenantId,
          participantRosterEntry.workspaceId,
          participantRosterEntry.loginKey,
          participantRosterEntry.executionMode ?? null,
          participantRosterEntry.groupKey,
          participantRosterEntry.bookletKey,
          participantRosterEntry.bookletKeys?.length
            ? JSON.stringify(participantRosterEntry.bookletKeys)
            : null,
          participantRosterEntry.bookletStatePresets
            ? JSON.stringify(participantRosterEntry.bookletStatePresets)
            : null,
          participantRosterEntry.bookletAssignments?.length
            ? JSON.stringify(participantRosterEntry.bookletAssignments)
            : null,
          participantRosterEntry.displayName,
          passwordHash,
          participantRosterEntry.validFrom ?? null,
          participantRosterEntry.validTo ?? null,
          participantRosterEntry.validForMinutes ?? null,
          JSON.stringify(participantRosterEntry.customTexts ?? {}),
          participantRosterEntry.importedAt
        ]
      );
    },
    async getParticipantLoginAttempt(tenantId, workspaceId, loginKey) {
      return one(
        `SELECT tenant_id, workspace_id, login_key, failed_attempts, expires_at, updated_at
         FROM participant_login_attempts
         WHERE tenant_id = $1 AND workspace_id = $2 AND login_key = $3`,
        [tenantId, workspaceId, loginKey],
        mapParticipantLoginAttempt
      );
    },
    async recordParticipantLoginFailure(input) {
      const result = await pool.query<Row>(
        `INSERT INTO participant_login_attempts (
          tenant_id, workspace_id, login_key, failed_attempts, expires_at, updated_at
        ) VALUES ($1, $2, $3, 1, $4, $5)
        ON CONFLICT (tenant_id, workspace_id, login_key) DO UPDATE SET
          failed_attempts = CASE
            WHEN participant_login_attempts.expires_at <= EXCLUDED.updated_at THEN 1
            ELSE participant_login_attempts.failed_attempts + 1
          END,
          expires_at = EXCLUDED.expires_at,
          updated_at = EXCLUDED.updated_at
        RETURNING tenant_id, workspace_id, login_key, failed_attempts, expires_at, updated_at`,
        [
          input.tenantId,
          input.workspaceId,
          input.loginKey,
          input.expiresAt,
          input.attemptedAt
        ]
      );
      const loginAttempt = mapParticipantLoginAttempt(result.rows[0]);
      if (!loginAttempt) {
        throw new Error("Participant login failure could not be persisted.");
      }
      return loginAttempt;
    },
    async getTestRunById(testRunId) {
      return one(
        `SELECT test_run_id, participant_session_id, tenant_id, workspace_id, content_release_id, booklet_key, execution_mode, booklet_assignment_key, preset_booklet_states_json, booklet_states_json, booklet_state_overrides_json, status, locked, current_unit_key, unit_responses_json, unlocked_testlet_keys_json, monitor_navigation_unlocked, testlet_timers_json, locked_testlet_keys_json, locked_unit_keys_json, created_at, updated_at, completed_at
         FROM test_runs
         WHERE test_run_id = $1`,
        [testRunId],
        mapTestRun
      );
    },
    async listTestRunsByParticipantSessionId(participantSessionId) {
      return many(
        `SELECT test_run_id, participant_session_id, tenant_id, workspace_id, content_release_id, booklet_key, execution_mode, booklet_assignment_key, preset_booklet_states_json, booklet_states_json, booklet_state_overrides_json, status, locked, current_unit_key, unit_responses_json, unlocked_testlet_keys_json, monitor_navigation_unlocked, testlet_timers_json, locked_testlet_keys_json, locked_unit_keys_json, created_at, updated_at, completed_at
         FROM test_runs
         WHERE participant_session_id = $1`,
        [participantSessionId],
        mapTestRun
      );
    },
    async getOpenTestRunByParticipantSessionId(participantSessionId) {
      return one(
        `SELECT test_run_id, participant_session_id, tenant_id, workspace_id, content_release_id, booklet_key, execution_mode, booklet_assignment_key, preset_booklet_states_json, booklet_states_json, booklet_state_overrides_json, status, locked, current_unit_key, unit_responses_json, unlocked_testlet_keys_json, monitor_navigation_unlocked, testlet_timers_json, locked_testlet_keys_json, locked_unit_keys_json, created_at, updated_at, completed_at
         FROM test_runs
         WHERE participant_session_id = $1 AND status != 'completed'
         ORDER BY updated_at ASC
         LIMIT 1`,
        [participantSessionId],
        mapTestRun
      );
    },
    async listTestRunsByWorkspace(tenantId, workspaceId) {
      return many(
        `SELECT test_run_id, participant_session_id, tenant_id, workspace_id, content_release_id, booklet_key, execution_mode, booklet_assignment_key, preset_booklet_states_json, booklet_states_json, booklet_state_overrides_json, status, locked, current_unit_key, unit_responses_json, unlocked_testlet_keys_json, monitor_navigation_unlocked, testlet_timers_json, locked_testlet_keys_json, locked_unit_keys_json, created_at, updated_at, completed_at
         FROM test_runs
         WHERE tenant_id = $1 AND workspace_id = $2`,
        [tenantId, workspaceId],
        mapTestRun
      );
    },
    async saveTestRun(testRun) {
      await pool.query(
        `INSERT INTO test_runs (
          test_run_id, participant_session_id, tenant_id, workspace_id, content_release_id, booklet_key, execution_mode, booklet_assignment_key, preset_booklet_states_json, booklet_states_json, booklet_state_overrides_json, status, locked, current_unit_key, unit_responses_json, unlocked_testlet_keys_json, monitor_navigation_unlocked, testlet_timers_json, locked_testlet_keys_json, locked_unit_keys_json, created_at, updated_at, completed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23)
        ON CONFLICT(test_run_id) DO UPDATE SET
          participant_session_id = EXCLUDED.participant_session_id,
          tenant_id = EXCLUDED.tenant_id,
          workspace_id = EXCLUDED.workspace_id,
          content_release_id = EXCLUDED.content_release_id,
          booklet_key = EXCLUDED.booklet_key,
          execution_mode = EXCLUDED.execution_mode,
          booklet_assignment_key = EXCLUDED.booklet_assignment_key,
          preset_booklet_states_json = EXCLUDED.preset_booklet_states_json,
          booklet_states_json = EXCLUDED.booklet_states_json,
          booklet_state_overrides_json = EXCLUDED.booklet_state_overrides_json,
          status = EXCLUDED.status,
          locked = EXCLUDED.locked,
          current_unit_key = EXCLUDED.current_unit_key,
          unit_responses_json = EXCLUDED.unit_responses_json,
          unlocked_testlet_keys_json = EXCLUDED.unlocked_testlet_keys_json,
          monitor_navigation_unlocked = EXCLUDED.monitor_navigation_unlocked,
          testlet_timers_json = EXCLUDED.testlet_timers_json,
          locked_testlet_keys_json = EXCLUDED.locked_testlet_keys_json,
          locked_unit_keys_json = EXCLUDED.locked_unit_keys_json,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at,
          completed_at = EXCLUDED.completed_at`,
        [
          testRun.testRunId,
          testRun.participantSessionId,
          testRun.tenantId,
          testRun.workspaceId,
          testRun.contentReleaseId,
          testRun.bookletKey,
          testRun.executionMode ?? null,
          testRun.bookletAssignmentKey ?? testRun.bookletKey,
          JSON.stringify(testRun.presetBookletStates ?? {}),
          JSON.stringify(testRun.bookletStates ?? {}),
          JSON.stringify(testRun.bookletStateOverrides ?? {}),
          testRun.status,
          testRun.locked === true,
          testRun.currentUnitKey,
          JSON.stringify(testRun.unitResponses),
          JSON.stringify(testRun.unlockedTestletKeys ?? []),
          testRun.monitorNavigationUnlocked === true,
          JSON.stringify(testRun.testletTimers ?? {}),
          JSON.stringify(testRun.lockedTestletKeys ?? []),
          JSON.stringify(testRun.lockedUnitKeys ?? []),
          testRun.createdAt,
          testRun.updatedAt,
          testRun.completedAt
        ]
      );
    },
    async deleteTestRunsByIds(testRunIds) {
      if (testRunIds.length === 0) {
        return 0;
      }
      const result = await pool.query(
        "DELETE FROM test_runs WHERE test_run_id = ANY($1::text[])",
        [testRunIds]
      );
      return result.rowCount ?? 0;
    },
    async listParticipantTestLogsByWorkspace(tenantId, workspaceId) {
      return many(
        `SELECT participant_test_log_id, tenant_id, workspace_id, participant_session_id, test_run_id, unit_key, original_unit_id, log_key, log_content, timestamp, recorded_at
         FROM participant_test_logs
         WHERE tenant_id = $1 AND workspace_id = $2
         ORDER BY timestamp DESC, recorded_at DESC`,
        [tenantId, workspaceId],
        mapParticipantTestLog
      );
    },
    async listLatestParticipantTestStateLogsByWorkspace(
      tenantId,
      workspaceId,
      logKeys
    ) {
      if (logKeys.length === 0) {
        return [];
      }
      return many(
        `SELECT DISTINCT ON (test_run_id, log_key)
                participant_test_log_id, tenant_id, workspace_id, participant_session_id, test_run_id, unit_key, original_unit_id, log_key, log_content, timestamp, recorded_at
         FROM participant_test_logs
         WHERE tenant_id = $1
           AND workspace_id = $2
           AND unit_key IS NULL
           AND log_key = ANY($3::text[])
         ORDER BY test_run_id, log_key, timestamp DESC, recorded_at DESC, participant_test_log_id DESC`,
        [tenantId, workspaceId, logKeys],
        mapParticipantTestLog
      );
    },
    async saveParticipantTestLogs(testLogs) {
      if (testLogs.length === 0) {
        return;
      }
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        for (const testLog of testLogs) {
          await client.query(
            `INSERT INTO participant_test_logs (
              participant_test_log_id, tenant_id, workspace_id, participant_session_id, test_run_id, unit_key, original_unit_id, log_key, log_content, timestamp, recorded_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
            ON CONFLICT(participant_test_log_id) DO UPDATE SET
              tenant_id = EXCLUDED.tenant_id,
              workspace_id = EXCLUDED.workspace_id,
              participant_session_id = EXCLUDED.participant_session_id,
              test_run_id = EXCLUDED.test_run_id,
              unit_key = EXCLUDED.unit_key,
              original_unit_id = EXCLUDED.original_unit_id,
              log_key = EXCLUDED.log_key,
              log_content = EXCLUDED.log_content,
              timestamp = EXCLUDED.timestamp,
              recorded_at = EXCLUDED.recorded_at`,
            [
              testLog.participantTestLogId,
              testLog.tenantId,
              testLog.workspaceId,
              testLog.participantSessionId,
              testLog.testRunId,
              testLog.unitKey,
              testLog.originalUnitId,
              testLog.logKey,
              testLog.logContent,
              testLog.timestamp,
              testLog.recordedAt
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
    async deleteParticipantTestLogsByTestRunIds(testRunIds) {
      if (testRunIds.length === 0) {
        return 0;
      }
      const result = await pool.query(
        "DELETE FROM participant_test_logs WHERE test_run_id = ANY($1::text[])",
        [testRunIds]
      );
      return result.rowCount ?? 0;
    },
    async getWorkspaceReviewById(reviewId) {
      return one(
        `SELECT review_id, tenant_id, workspace_id, participant_session_id, test_run_id, unit_key, original_unit_id, page, page_label, user_agent, reviewer_id, category, priority, comment_text, created_at, updated_at
         FROM workspace_reviews
         WHERE review_id = $1`,
        [reviewId],
        mapWorkspaceReview
      );
    },
    async listWorkspaceReviewsByWorkspace(tenantId, workspaceId) {
      return many(
        `SELECT review_id, tenant_id, workspace_id, participant_session_id, test_run_id, unit_key, original_unit_id, page, page_label, user_agent, reviewer_id, category, priority, comment_text, created_at, updated_at
         FROM workspace_reviews
         WHERE tenant_id = $1 AND workspace_id = $2
         ORDER BY updated_at DESC, created_at DESC`,
        [tenantId, workspaceId],
        mapWorkspaceReview
      );
    },
    async saveWorkspaceReview(review) {
      await pool.query(
        `INSERT INTO workspace_reviews (
          review_id, tenant_id, workspace_id, participant_session_id, test_run_id, unit_key, original_unit_id, page, page_label, user_agent, reviewer_id, category, priority, comment_text, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
        ON CONFLICT(review_id) DO UPDATE SET
          tenant_id = EXCLUDED.tenant_id,
          workspace_id = EXCLUDED.workspace_id,
          participant_session_id = EXCLUDED.participant_session_id,
          test_run_id = EXCLUDED.test_run_id,
          unit_key = EXCLUDED.unit_key,
          original_unit_id = EXCLUDED.original_unit_id,
          page = EXCLUDED.page,
          page_label = EXCLUDED.page_label,
          user_agent = EXCLUDED.user_agent,
          reviewer_id = EXCLUDED.reviewer_id,
          category = EXCLUDED.category,
          priority = EXCLUDED.priority,
          comment_text = EXCLUDED.comment_text,
          created_at = EXCLUDED.created_at,
          updated_at = EXCLUDED.updated_at`,
        [
          review.reviewId,
          review.tenantId,
          review.workspaceId,
          review.participantSessionId,
          review.testRunId,
          review.unitKey,
          review.originalUnitId,
          review.page,
          review.pageLabel,
          review.userAgent,
          review.reviewerId,
          review.category,
          review.priority,
          review.comment,
          review.createdAt,
          review.updatedAt
        ]
      );
    },
    async deleteWorkspaceReview(reviewId) {
      const result = await pool.query(
        `DELETE FROM workspace_reviews WHERE review_id = $1`,
        [reviewId]
      );
      return (result.rowCount ?? 0) > 0;
    },
    async deleteWorkspaceReviewsByTestRunIds(testRunIds) {
      if (testRunIds.length === 0) {
        return 0;
      }
      const result = await pool.query(
        "DELETE FROM workspace_reviews WHERE test_run_id = ANY($1::text[])",
        [testRunIds]
      );
      return result.rowCount ?? 0;
    }
  };
};

export const createPostgresFirstSliceStorage = async (connectionString: string) => {
  const pool = new Pool({ connectionString });
  await applyMigrations(pool);

  return {
    repository: createRepositoryFromPool(pool),
    readinessCheck: async (): Promise<void> => {
      await pool.query("SELECT 1");
    },
    shutdown: async (): Promise<void> => {
      await pool.end();
    }
  };
};

export const createPostgresFirstSliceRepository = async (
  connectionString: string
): Promise<FirstSliceRepository> => {
  const storage = await createPostgresFirstSliceStorage(connectionString);
  return storage.repository;
};
