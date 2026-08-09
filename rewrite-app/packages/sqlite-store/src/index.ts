import { mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { DatabaseSync } from "node:sqlite";

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
  WorkspaceActivityEvent,
  WorkspaceReview,
  Workspace
} from "@testcenter-rewrite-app/domain";

type SqliteMigration = {
  version: number;
  name: string;
  sql: string;
};

type WorkspaceRow = Workspace & {
  tenant_key: string;
};

const mapTenant = (row: Record<string, unknown> | undefined): Tenant | null =>
  row
    ? {
        tenantId: String(row.tenant_id),
        tenantKey: String(row.tenant_key),
        displayName: String(row.display_name),
        status: row.status as Tenant["status"],
        createdAt: String(row.created_at)
      }
    : null;

const mapWorkspace = (
  row: Record<string, unknown> | undefined
): WorkspaceRow | null =>
  row
    ? {
        workspaceId: String(row.workspace_id),
        tenantId: String(row.tenant_id),
        workspaceKey: String(row.workspace_key),
        displayName: String(row.display_name),
        status: row.status as Workspace["status"],
        createdAt: String(row.created_at),
        tenant_key: String(row.tenant_key)
      }
    : null;

const mapAdminUser = (row: Record<string, unknown> | undefined): AdminUser | null =>
  row
    ? {
        adminUserId: String(row.admin_user_id),
        username: String(row.username),
        displayName: String(row.display_name),
        passwordHash: String(row.password_hash),
        passwordChangeRequired: Number(row.password_change_required ?? 0) === 1,
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

const mapAdminSession = (
  row: Record<string, unknown> | undefined
): AdminSession | null =>
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

const mapAdminRoleAssignment = (
  row: Record<string, unknown> | undefined
): AdminRoleAssignment | null =>
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

const mapAdminAuditEvent = (
  row: Record<string, unknown> | undefined
): AdminAuditEvent | null =>
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
  row: Record<string, unknown> | undefined
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

const mapAttachmentFile = (
  row: Record<string, unknown> | undefined
): AttachmentFile | null =>
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

const mapSourcePackage = (
  row: Record<string, unknown> | undefined
): SourcePackage | null =>
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

const mapImportJob = (row: Record<string, unknown> | undefined): ImportJob | null =>
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

const mapContentRelease = (
  row: Record<string, unknown> | undefined
): ContentRelease | null =>
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

const mapParticipantSession = (
  row: Record<string, unknown> | undefined
): ParticipantSession | null =>
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
  row: Record<string, unknown> | undefined
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
            const parsed = JSON.parse(String(row.custom_texts_json ?? "{}"));
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

const mapTestRun = (row: Record<string, unknown> | undefined): TestRun | null =>
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
        locked: Number(row.locked ?? 0) === 1,
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
          Number(row.monitor_navigation_unlocked ?? 0) === 1,
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
  row: Record<string, unknown> | undefined
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

const mapAdminLoginAttempt = (
  row: Record<string, unknown> | undefined
): AdminLoginAttempt | null =>
  row
    ? {
        username: String(row.username),
        failedAttempts: Number(row.failed_attempts),
        expiresAt: String(row.expires_at),
        updatedAt: String(row.updated_at)
      }
    : null;

const mapWorkspaceActivityEvent = (
  row: Record<string, unknown> | undefined
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

const mapWorkspaceReview = (
  row: Record<string, unknown> | undefined
): WorkspaceReview | null =>
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

const mapParticipantTestLog = (
  row: Record<string, unknown> | undefined
): ParticipantTestLog | null =>
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

const sqliteMigrations: SqliteMigration[] = [
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

      CREATE TABLE IF NOT EXISTS source_packages (
        source_package_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        media_type TEXT NOT NULL,
        status TEXT NOT NULL,
        uploaded_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS import_jobs (
        import_job_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        source_package_id TEXT NOT NULL,
        status TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS content_releases (
        content_release_id TEXT PRIMARY KEY,
        tenant_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        import_job_id TEXT NOT NULL,
        release_label TEXT NOT NULL,
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
        updated_at TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_workspaces_workspace_key
        ON workspaces (workspace_key);
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
    name: "add_test_run_completed_at",
    sql: `
      ALTER TABLE test_runs
      ADD COLUMN completed_at TEXT;
    `
  },
  {
    version: 3,
    name: "add_content_release_runtime_snapshot",
    sql: `
      ALTER TABLE content_releases
      ADD COLUMN runtime_snapshot_json TEXT NOT NULL DEFAULT '{"bookletEntries":[]}';
    `
  },
  {
    version: 4,
    name: "add_source_package_content_structure",
    sql: `
      ALTER TABLE source_packages
      ADD COLUMN content_structure_json TEXT;
    `
  },
  {
    version: 5,
    name: "add_source_package_source_document",
    sql: `
      ALTER TABLE source_packages
      ADD COLUMN source_document_text TEXT;
    `
  },
  {
    version: 6,
    name: "add_import_job_diagnostics",
    sql: `
      ALTER TABLE import_jobs
      ADD COLUMN finished_at TEXT;

      ALTER TABLE import_jobs
      ADD COLUMN diagnostics_json TEXT NOT NULL DEFAULT '[]';
    `
  },
  {
    version: 7,
    name: "add_workspace_activity_events",
    sql: `
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

      CREATE INDEX IF NOT EXISTS idx_workspace_activity_events_workspace
        ON workspace_activity_events (tenant_id, workspace_id, occurred_at);
    `
  },
  {
    version: 8,
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
    version: 9,
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
    version: 10,
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
    version: 11,
    name: "add_test_run_unit_responses",
    sql: `
      ALTER TABLE test_runs
      ADD COLUMN unit_responses_json TEXT NOT NULL DEFAULT '{}';
    `
  },
  {
    version: 12,
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
    version: 13,
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
    version: 14,
    name: "add_participant_roster_password_hash",
    sql: `
      ALTER TABLE participant_roster_entries
        ADD COLUMN password_hash TEXT;
    `
  },
  {
    version: 15,
    name: "add_participant_roster_booklet_keys",
    sql: `
      ALTER TABLE participant_roster_entries
        ADD COLUMN booklet_keys_json TEXT;
    `
  },
  {
    version: 16,
    name: "add_test_run_unlocked_testlets",
    sql: `
      ALTER TABLE test_runs
        ADD COLUMN unlocked_testlet_keys_json TEXT NOT NULL DEFAULT '[]';
    `
  },
  {
    version: 17,
    name: "add_test_run_testlet_timers",
    sql: `
      ALTER TABLE test_runs
        ADD COLUMN testlet_timers_json TEXT NOT NULL DEFAULT '{}';
    `
  },
  {
    version: 18,
    name: "add_test_run_leave_locks",
    sql: `
      ALTER TABLE test_runs
        ADD COLUMN locked_testlet_keys_json TEXT NOT NULL DEFAULT '[]';
      ALTER TABLE test_runs
        ADD COLUMN locked_unit_keys_json TEXT NOT NULL DEFAULT '[]';
    `
  },
  {
    version: 19,
    name: "add_test_run_monitor_navigation_unlock",
    sql: `
      ALTER TABLE test_runs
        ADD COLUMN monitor_navigation_unlocked INTEGER NOT NULL DEFAULT 0;
    `
  },
  {
    version: 20,
    name: "add_participant_booklet_state_presets",
    sql: `
      ALTER TABLE participant_roster_entries
        ADD COLUMN booklet_state_presets_json TEXT;
      ALTER TABLE test_runs
        ADD COLUMN preset_booklet_states_json TEXT NOT NULL DEFAULT '{}';
    `
  },
  {
    version: 21,
    name: "add_participant_booklet_assignment_variants",
    sql: `
      ALTER TABLE participant_roster_entries
        ADD COLUMN booklet_assignments_json TEXT;
      ALTER TABLE test_runs
        ADD COLUMN booklet_assignment_key TEXT;
    `
  },
  {
    version: 22,
    name: "persist_booklet_states_snapshot",
    sql: `
      ALTER TABLE test_runs
        ADD COLUMN booklet_states_json TEXT NOT NULL DEFAULT '{}';
    `
  },
  {
    version: 23,
    name: "add_participant_access_windows",
    sql: `
      ALTER TABLE participant_roster_entries ADD COLUMN valid_from TEXT;
      ALTER TABLE participant_roster_entries ADD COLUMN valid_to TEXT;
      ALTER TABLE participant_roster_entries ADD COLUMN valid_for_minutes INTEGER;
      ALTER TABLE participant_sessions ADD COLUMN valid_until TEXT;
    `
  },
  {
    version: 24,
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
    version: 25,
    name: "add_participant_code",
    sql: `
      ALTER TABLE participant_sessions ADD COLUMN participant_code TEXT;
    `
  },
  {
    version: 26,
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
        timestamp INTEGER NOT NULL,
        recorded_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_participant_test_logs_workspace
        ON participant_test_logs (tenant_id, workspace_id, timestamp);
      CREATE INDEX IF NOT EXISTS idx_participant_test_logs_test_run
        ON participant_test_logs (test_run_id, timestamp);
    `
  },
  {
    version: 27,
    name: "add_participant_execution_modes",
    sql: `
      ALTER TABLE participant_roster_entries ADD COLUMN execution_mode TEXT;
      ALTER TABLE participant_sessions ADD COLUMN execution_mode TEXT;
      ALTER TABLE test_runs ADD COLUMN execution_mode TEXT;
    `
  },
  {
    version: 28,
    name: "persist_booklet_state_overrides",
    sql: `
      ALTER TABLE test_runs
        ADD COLUMN booklet_state_overrides_json TEXT NOT NULL DEFAULT '{}';
    `
  },
  {
    version: 29,
    name: "add_review_priorities",
    sql: `
      ALTER TABLE workspace_reviews
        ADD COLUMN priority INTEGER NOT NULL DEFAULT 0;
    `
  },
  {
    version: 30,
    name: "add_review_task_pages",
    sql: `
      ALTER TABLE workspace_reviews ADD COLUMN page INTEGER;
      ALTER TABLE workspace_reviews ADD COLUMN page_label TEXT;
    `
  },
  {
    version: 31,
    name: "add_review_provenance",
    sql: `
      ALTER TABLE workspace_reviews ADD COLUMN original_unit_id TEXT;
      ALTER TABLE workspace_reviews ADD COLUMN user_agent TEXT;
    `
  },
  {
    version: 32,
    name: "add_admin_role_group_scope",
    sql: `
      ALTER TABLE admin_role_assignments ADD COLUMN group_key TEXT;
    `
  },
  {
    version: 33,
    name: "add_admin_access_windows",
    sql: `
      ALTER TABLE admin_users ADD COLUMN valid_from TEXT;
      ALTER TABLE admin_users ADD COLUMN valid_to TEXT;
      ALTER TABLE admin_users ADD COLUMN valid_for_minutes INTEGER;
      ALTER TABLE admin_users ADD COLUMN first_signed_in_at TEXT;
    `
  },
  {
    version: 34,
    name: "add_admin_role_monitor_profiles",
    sql: `
      ALTER TABLE admin_role_assignments ADD COLUMN monitor_profiles_json TEXT NOT NULL DEFAULT '[]';
    `
  },
  {
    version: 35,
    name: "add_participant_custom_texts",
    sql: `
      ALTER TABLE participant_roster_entries ADD COLUMN custom_texts_json TEXT NOT NULL DEFAULT '{}';
    `
  },
  {
    version: 36,
    name: "add_test_run_lock",
    sql: `
      ALTER TABLE test_runs ADD COLUMN locked INTEGER NOT NULL DEFAULT 0;
    `
  },
  {
    version: 37,
    name: "add_admin_role_access_mode",
    sql: `
      ALTER TABLE admin_role_assignments ADD COLUMN access_mode TEXT NOT NULL DEFAULT 'read_write';
    `
  },
  {
    version: 38,
    name: "add_application_settings",
    sql: `
      CREATE TABLE application_settings (
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
    version: 39,
    name: "add_attachment_files",
    sql: `
      CREATE TABLE attachment_files (
        attachment_file_id TEXT PRIMARY KEY,
        attachment_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        file_name TEXT NOT NULL,
        media_type TEXT NOT NULL,
        data_base64 TEXT NOT NULL,
        created_at TEXT NOT NULL
      );
      CREATE INDEX attachment_files_workspace_attachment_idx
        ON attachment_files (tenant_id, workspace_id, attachment_id, created_at);
    `
  },
  {
    version: 40,
    name: "add_application_branding",
    sql: `
      ALTER TABLE application_settings ADD COLUMN main_logo TEXT NOT NULL DEFAULT 'app-icon.svg';
      ALTER TABLE application_settings ADD COLUMN theme_name TEXT NOT NULL DEFAULT 'Primar';
    `
  },
  {
    version: 41,
    name: "add_application_custom_texts",
    sql: `
      ALTER TABLE application_settings ADD COLUMN custom_texts_json TEXT NOT NULL DEFAULT '{}';
    `
  },
  {
    version: 42,
    name: "add_admin_custom_texts",
    sql: `
      CREATE TABLE IF NOT EXISTS admin_users (
        admin_user_id TEXT PRIMARY KEY,
        username TEXT NOT NULL UNIQUE,
        display_name TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        status TEXT NOT NULL,
        valid_from TEXT,
        valid_to TEXT,
        valid_for_minutes INTEGER,
        first_signed_in_at TEXT,
        created_at TEXT NOT NULL
      );
      ALTER TABLE admin_users ADD COLUMN custom_texts_json TEXT NOT NULL DEFAULT '{}';
    `
  },
  {
    version: 43,
    name: "add_application_content",
    sql: `
      ALTER TABLE application_settings ADD COLUMN intro_html TEXT NOT NULL DEFAULT '';
      ALTER TABLE application_settings ADD COLUMN legal_notice_html TEXT NOT NULL DEFAULT '';
    `
  },
  {
    version: 44,
    name: "add_operational_login_migration_candidates",
    sql: `
      CREATE TABLE operational_login_migration_candidates (
        tenant_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        candidates_json TEXT NOT NULL DEFAULT '[]',
        updated_at TEXT NOT NULL,
        PRIMARY KEY (tenant_id, workspace_id)
      );
    `
  },
  {
    version: 45,
    name: "add_admin_login_attempts",
    sql: `
      CREATE TABLE admin_login_attempts (
        username TEXT PRIMARY KEY,
        failed_attempts INTEGER NOT NULL,
        expires_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
      CREATE INDEX idx_admin_login_attempts_expiry
        ON admin_login_attempts (expires_at);
    `
  },
  {
    version: 46,
    name: "add_admin_password_change_required",
    sql: `
      ALTER TABLE admin_users
        ADD COLUMN password_change_required INTEGER NOT NULL DEFAULT 0;
    `
  }
];

export const SQLITE_FIRST_SLICE_SCHEMA_VERSION =
  sqliteMigrations[sqliteMigrations.length - 1]?.version ?? 0;

const getCurrentSchemaVersion = (database: DatabaseSync): number => {
  const migrationTable = database
    .prepare(
      `SELECT name
       FROM sqlite_master
       WHERE type = 'table' AND name = 'schema_migrations'`
    )
    .get() as Record<string, unknown> | undefined;

  if (!migrationTable) {
    return 0;
  }

  const row = database
    .prepare(`SELECT COALESCE(MAX(version), 0) AS version FROM schema_migrations`)
    .get() as Record<string, unknown> | undefined;

  return row ? Number(row.version) : 0;
};

const applyMigrations = (database: DatabaseSync): void => {
  database.exec("PRAGMA foreign_keys = ON;");

  const currentVersion = getCurrentSchemaVersion(database);
  const pendingMigrations = sqliteMigrations.filter(
    migration => migration.version > currentVersion
  );

  for (const migration of pendingMigrations) {
    database.exec("BEGIN");

    try {
      database.exec(migration.sql);
      database
        .prepare(
          `INSERT INTO schema_migrations (version, name, applied_at)
           VALUES (?, ?, ?)`
        )
        .run(migration.version, migration.name, new Date().toISOString());
      database.exec("COMMIT");
    } catch (error) {
      database.exec("ROLLBACK");
      throw error;
    }
  }
};

export type SqliteFirstSliceStorageDiagnostics = {
  currentSchemaVersion: number;
  targetSchemaVersion: number;
};

export const inspectSqliteFirstSliceStorage = async (
  filePath: string
): Promise<SqliteFirstSliceStorageDiagnostics> => {
  mkdirSync(dirname(filePath), { recursive: true });
  const database = new DatabaseSync(filePath);

  try {
    return {
      currentSchemaVersion: getCurrentSchemaVersion(database),
      targetSchemaVersion: SQLITE_FIRST_SLICE_SCHEMA_VERSION
    };
  } finally {
    database.close();
  }
};

export const migrateSqliteFirstSliceStorage = async (
  filePath: string
): Promise<SqliteFirstSliceStorageDiagnostics> => {
  mkdirSync(dirname(filePath), { recursive: true });
  const database = new DatabaseSync(filePath);

  try {
    applyMigrations(database);
    return {
      currentSchemaVersion: getCurrentSchemaVersion(database),
      targetSchemaVersion: SQLITE_FIRST_SLICE_SCHEMA_VERSION
    };
  } finally {
    database.close();
  }
};

export const checkSqliteFirstSliceReadiness = async (
  filePath: string
): Promise<void> => {
  mkdirSync(dirname(filePath), { recursive: true });
  const database = new DatabaseSync(filePath);

  try {
    database.prepare("SELECT 1").get();
  } finally {
    database.close();
  }
};

export const createSqliteFirstSliceRepository = (
  filePath: string
): FirstSliceRepository => {
  mkdirSync(dirname(filePath), { recursive: true });
  const database = new DatabaseSync(filePath);
  applyMigrations(database);

  return {
    async getApplicationSettings() {
      const row = database
        .prepare(
          `SELECT app_title, main_logo, theme_name, intro_html,
                  legal_notice_html, custom_texts_json,
                  global_warning_text, global_warning_expires_at,
                  updated_at, updated_by_admin_user_id
           FROM application_settings
           WHERE settings_key = 'global'`
        )
        .get() as Record<string, unknown> | undefined;
      return mapApplicationSettings(row);
    },
    async saveApplicationSettings(settings) {
      database
        .prepare(
          `INSERT INTO application_settings (
            settings_key, app_title, main_logo, theme_name, intro_html,
            legal_notice_html, custom_texts_json,
            global_warning_text, global_warning_expires_at,
            updated_at, updated_by_admin_user_id
          ) VALUES ('global', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(settings_key) DO UPDATE SET
            app_title = excluded.app_title,
            main_logo = excluded.main_logo,
            theme_name = excluded.theme_name,
            intro_html = excluded.intro_html,
            legal_notice_html = excluded.legal_notice_html,
            custom_texts_json = excluded.custom_texts_json,
            global_warning_text = excluded.global_warning_text,
            global_warning_expires_at = excluded.global_warning_expires_at,
            updated_at = excluded.updated_at,
            updated_by_admin_user_id = excluded.updated_by_admin_user_id`
        )
        .run(
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
        );
    },
    async listAttachmentFilesByWorkspace(tenantId, workspaceId) {
      const rows = database
        .prepare(
          `SELECT attachment_file_id, attachment_id, tenant_id, workspace_id,
                  file_name, media_type, data_base64, created_at
           FROM attachment_files
           WHERE tenant_id = ? AND workspace_id = ?
           ORDER BY created_at ASC, attachment_file_id ASC`
        )
        .all(tenantId, workspaceId) as Record<string, unknown>[];
      return rows
        .map(row => mapAttachmentFile(row))
        .filter(Boolean) as AttachmentFile[];
    },
    async getAttachmentFileById(attachmentFileId) {
      const row = database
        .prepare(
          `SELECT attachment_file_id, attachment_id, tenant_id, workspace_id,
                  file_name, media_type, data_base64, created_at
           FROM attachment_files
           WHERE attachment_file_id = ?`
        )
        .get(attachmentFileId) as Record<string, unknown> | undefined;
      return mapAttachmentFile(row);
    },
    async saveAttachmentFile(attachmentFile) {
      database
        .prepare(
          `INSERT INTO attachment_files (
            attachment_file_id, attachment_id, tenant_id, workspace_id,
            file_name, media_type, data_base64, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(attachment_file_id) DO UPDATE SET
            attachment_id = excluded.attachment_id,
            tenant_id = excluded.tenant_id,
            workspace_id = excluded.workspace_id,
            file_name = excluded.file_name,
            media_type = excluded.media_type,
            data_base64 = excluded.data_base64,
            created_at = excluded.created_at`
        )
        .run(
          attachmentFile.attachmentFileId,
          attachmentFile.attachmentId,
          attachmentFile.tenantId,
          attachmentFile.workspaceId,
          attachmentFile.fileName,
          attachmentFile.mediaType,
          attachmentFile.dataBase64,
          attachmentFile.createdAt
        );
    },
    async deleteAttachmentFile(attachmentFileId) {
      return (
        database
          .prepare(`DELETE FROM attachment_files WHERE attachment_file_id = ?`)
          .run(attachmentFileId).changes > 0
      );
    },
    async listAdminUsers() {
      const rows = database
        .prepare(
          `SELECT admin_user_id, username, display_name, password_hash, password_change_required, status, custom_texts_json, valid_from, valid_to, valid_for_minutes, first_signed_in_at, created_at
           FROM admin_users
           ORDER BY created_at ASC`
        )
        .all() as Record<string, unknown>[];
      return rows.map(row => mapAdminUser(row)).filter(Boolean) as AdminUser[];
    },
    async getAdminUserById(adminUserId) {
      const row = database
        .prepare(
          `SELECT admin_user_id, username, display_name, password_hash, password_change_required, status, custom_texts_json, valid_from, valid_to, valid_for_minutes, first_signed_in_at, created_at
           FROM admin_users
           WHERE admin_user_id = ?`
        )
        .get(adminUserId) as Record<string, unknown> | undefined;
      return mapAdminUser(row);
    },
    async getAdminUserByUsername(username) {
      const row = database
        .prepare(
          `SELECT admin_user_id, username, display_name, password_hash, password_change_required, status, custom_texts_json, valid_from, valid_to, valid_for_minutes, first_signed_in_at, created_at
           FROM admin_users
           WHERE username = ?`
        )
        .get(username) as Record<string, unknown> | undefined;
      return mapAdminUser(row);
    },
    async getAdminLoginAttempt(username) {
      return mapAdminLoginAttempt(
        database
          .prepare(
            `SELECT username, failed_attempts, expires_at, updated_at
             FROM admin_login_attempts
             WHERE username = ?`
          )
          .get(username) as Record<string, unknown> | undefined
      );
    },
    async recordAdminLoginFailure(input) {
      const row = database
        .prepare(
          `INSERT INTO admin_login_attempts (
            username, failed_attempts, expires_at, updated_at
          ) VALUES (?, 1, ?, ?)
          ON CONFLICT(username) DO UPDATE SET
            failed_attempts = CASE
              WHEN admin_login_attempts.expires_at <= excluded.updated_at THEN 1
              ELSE admin_login_attempts.failed_attempts + 1
            END,
            expires_at = excluded.expires_at,
            updated_at = excluded.updated_at
          RETURNING username, failed_attempts, expires_at, updated_at`
        )
        .get(input.username, input.expiresAt, input.attemptedAt) as
        | Record<string, unknown>
        | undefined;
      const result = mapAdminLoginAttempt(row);
      if (!result) {
        throw new Error("Admin login failure could not be persisted.");
      }
      return result;
    },
    async saveAdminUser(adminUser) {
      database
        .prepare(
          `INSERT INTO admin_users (
            admin_user_id, username, display_name, password_hash, password_change_required, status, custom_texts_json, valid_from, valid_to, valid_for_minutes, first_signed_in_at, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(admin_user_id) DO UPDATE SET
            username = excluded.username,
            display_name = excluded.display_name,
            password_hash = excluded.password_hash,
            password_change_required = excluded.password_change_required,
            status = excluded.status,
            custom_texts_json = excluded.custom_texts_json,
            valid_from = excluded.valid_from,
            valid_to = excluded.valid_to,
            valid_for_minutes = excluded.valid_for_minutes,
            first_signed_in_at = excluded.first_signed_in_at,
            created_at = excluded.created_at`
        )
        .run(
          adminUser.adminUserId,
          adminUser.username,
          adminUser.displayName,
          adminUser.passwordHash,
          adminUser.passwordChangeRequired ? 1 : 0,
          adminUser.status,
          JSON.stringify(adminUser.customTexts),
          adminUser.validFrom,
          adminUser.validTo,
          adminUser.validForMinutes,
          adminUser.firstSignedInAt,
          adminUser.createdAt
        );
    },
    async deleteAdminUser(adminUserId) {
      database.exec("BEGIN IMMEDIATE");
      try {
        const deletedRoleAssignmentCount = Number(
          database
            .prepare(
              `DELETE FROM admin_role_assignments WHERE admin_user_id = ?`
            )
            .run(adminUserId).changes
        );
        const deletedSessionCount = Number(
          database
            .prepare(`DELETE FROM admin_sessions WHERE admin_user_id = ?`)
            .run(adminUserId).changes
        );
        database
          .prepare(`DELETE FROM admin_users WHERE admin_user_id = ?`)
          .run(adminUserId);
        database.exec("COMMIT");
        return { deletedRoleAssignmentCount, deletedSessionCount };
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },
    async listAdminRoleAssignmentsByUserId(adminUserId) {
      const rows = database
        .prepare(
          `SELECT role_assignment_id, admin_user_id, role, access_mode, tenant_id, workspace_id, group_key, monitor_profiles_json, created_at
           FROM admin_role_assignments
           WHERE admin_user_id = ?`
        )
        .all(adminUserId) as Record<string, unknown>[];
      return rows
        .map(row => mapAdminRoleAssignment(row))
        .filter(Boolean) as AdminRoleAssignment[];
    },
    async saveAdminRoleAssignment(roleAssignment) {
      database
        .prepare(
          `INSERT INTO admin_role_assignments (
            role_assignment_id, admin_user_id, role, access_mode, tenant_id, workspace_id, group_key, monitor_profiles_json, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(role_assignment_id) DO UPDATE SET
            admin_user_id = excluded.admin_user_id,
            role = excluded.role,
            access_mode = excluded.access_mode,
            tenant_id = excluded.tenant_id,
            workspace_id = excluded.workspace_id,
            group_key = excluded.group_key,
            monitor_profiles_json = excluded.monitor_profiles_json,
            created_at = excluded.created_at`
        )
        .run(
          roleAssignment.roleAssignmentId,
          roleAssignment.adminUserId,
          roleAssignment.role,
          roleAssignment.accessMode,
          roleAssignment.tenantId,
          roleAssignment.workspaceId,
          roleAssignment.groupKey,
          JSON.stringify(roleAssignment.monitorProfiles),
          roleAssignment.createdAt
        );
    },
    async deleteAdminRoleAssignment(roleAssignmentId) {
      database
        .prepare(`DELETE FROM admin_role_assignments WHERE role_assignment_id = ?`)
        .run(roleAssignmentId);
    },
    async listAdminAuditEvents() {
      const rows = database
        .prepare(
          `SELECT admin_audit_event_id, event_type, actor_admin_user_id, subject_admin_user_id, occurred_at, summary, details_json
           FROM admin_audit_events`
        )
        .all() as Record<string, unknown>[];
      return rows
        .map(row => mapAdminAuditEvent(row))
        .filter(Boolean) as AdminAuditEvent[];
    },
    async saveAdminAuditEvent(auditEvent) {
      database
        .prepare(
          `INSERT INTO admin_audit_events (
            admin_audit_event_id, event_type, actor_admin_user_id, subject_admin_user_id, occurred_at, summary, details_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(admin_audit_event_id) DO UPDATE SET
            event_type = excluded.event_type,
            actor_admin_user_id = excluded.actor_admin_user_id,
            subject_admin_user_id = excluded.subject_admin_user_id,
            occurred_at = excluded.occurred_at,
            summary = excluded.summary,
            details_json = excluded.details_json`
        )
        .run(
          auditEvent.adminAuditEventId,
          auditEvent.eventType,
          auditEvent.actorAdminUserId,
          auditEvent.subjectAdminUserId,
          auditEvent.occurredAt,
          auditEvent.summary,
          JSON.stringify(auditEvent.details)
        );
    },
    async listAdminSessions() {
      const rows = database
        .prepare(
          `SELECT admin_session_id, admin_user_id, session_token, created_at, expires_at, revoked_at
           FROM admin_sessions`
        )
        .all() as Record<string, unknown>[];
      return rows.flatMap(row => {
        const adminSession = mapAdminSession(row);
        return adminSession ? [adminSession] : [];
      });
    },
    async getAdminSessionByToken(token) {
      const row = database
        .prepare(
          `SELECT admin_session_id, admin_user_id, session_token, created_at, expires_at, revoked_at
           FROM admin_sessions
           WHERE session_token = ?`
        )
        .get(token) as Record<string, unknown> | undefined;
      return mapAdminSession(row);
    },
    async saveAdminSession(adminSession) {
      database
        .prepare(
          `INSERT INTO admin_sessions (
            admin_session_id, admin_user_id, session_token, created_at, expires_at, revoked_at
          ) VALUES (?, ?, ?, ?, ?, ?)
          ON CONFLICT(admin_session_id) DO UPDATE SET
            admin_user_id = excluded.admin_user_id,
            session_token = excluded.session_token,
            created_at = excluded.created_at,
            expires_at = excluded.expires_at,
            revoked_at = excluded.revoked_at`
        )
        .run(
          adminSession.adminSessionId,
          adminSession.adminUserId,
          adminSession.token,
          adminSession.createdAt,
          adminSession.expiresAt,
          adminSession.revokedAt
        );
    },
    async getTenantByKey(tenantKey) {
      const row = database
        .prepare(
          `SELECT tenant_id, tenant_key, display_name, status, created_at
           FROM tenants
           WHERE tenant_key = ?`
        )
        .get(tenantKey) as Record<string, unknown> | undefined;
      return mapTenant(row);
    },
    async listTenants() {
      const rows = database
        .prepare(
          `SELECT tenant_id, tenant_key, display_name, status, created_at
           FROM tenants`
        )
        .all() as Record<string, unknown>[];
      return rows
        .map(row => mapTenant(row))
        .filter((tenant): tenant is Tenant => tenant !== null);
    },
    async saveTenant(tenant) {
      database
        .prepare(
          `INSERT INTO tenants (
            tenant_id, tenant_key, display_name, status, created_at
          ) VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(tenant_id) DO UPDATE SET
            tenant_key = excluded.tenant_key,
            display_name = excluded.display_name,
            status = excluded.status,
            created_at = excluded.created_at`
        )
        .run(
          tenant.tenantId,
          tenant.tenantKey,
          tenant.displayName,
          tenant.status,
          tenant.createdAt
        );
    },
    async getWorkspaceByScope(tenantKey, workspaceKey) {
      const row = database
        .prepare(
          `SELECT workspace_id, tenant_id, tenant_key, workspace_key, display_name, status, created_at
           FROM workspaces
           WHERE tenant_key = ? AND workspace_key = ?`
        )
        .get(tenantKey, workspaceKey) as Record<string, unknown> | undefined;
      const workspace = mapWorkspace(row);
      return workspace
        ? {
            workspaceId: workspace.workspaceId,
            tenantId: workspace.tenantId,
            workspaceKey: workspace.workspaceKey,
            displayName: workspace.displayName,
            status: workspace.status,
            createdAt: workspace.createdAt
          }
        : null;
    },
    async getWorkspaceByWorkspaceKey(workspaceKey) {
      const row = database
        .prepare(
          `SELECT workspace_id, tenant_id, tenant_key, workspace_key, display_name, status, created_at
           FROM workspaces
           WHERE workspace_key = ?
           ORDER BY created_at ASC
           LIMIT 1`
        )
        .get(workspaceKey) as Record<string, unknown> | undefined;
      const workspace = mapWorkspace(row);
      return workspace
        ? {
            workspaceId: workspace.workspaceId,
            tenantId: workspace.tenantId,
            workspaceKey: workspace.workspaceKey,
            displayName: workspace.displayName,
            status: workspace.status,
            createdAt: workspace.createdAt
          }
        : null;
    },
    async listWorkspacesByTenantId(tenantId) {
      const rows = database
        .prepare(
          `SELECT workspace_id, tenant_id, tenant_key, workspace_key, display_name, status, created_at
           FROM workspaces
           WHERE tenant_id = ?`
        )
        .all(tenantId) as Record<string, unknown>[];
      return rows
        .map(row => mapWorkspace(row))
        .filter((workspace): workspace is WorkspaceRow => workspace !== null)
        .map(workspace => ({
          workspaceId: workspace.workspaceId,
          tenantId: workspace.tenantId,
          workspaceKey: workspace.workspaceKey,
          displayName: workspace.displayName,
          status: workspace.status,
          createdAt: workspace.createdAt
        }));
    },
    async saveWorkspace(scope) {
      database
        .prepare(
          `INSERT INTO workspaces (
            workspace_id, tenant_id, tenant_key, workspace_key, display_name, status, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(workspace_id) DO UPDATE SET
            tenant_id = excluded.tenant_id,
            tenant_key = excluded.tenant_key,
            workspace_key = excluded.workspace_key,
            display_name = excluded.display_name,
            status = excluded.status,
            created_at = excluded.created_at`
        )
        .run(
          scope.workspace.workspaceId,
          scope.workspace.tenantId,
          scope.tenantKey,
          scope.workspace.workspaceKey,
          scope.workspace.displayName,
          scope.workspace.status,
          scope.workspace.createdAt
        );
    },
    async deleteWorkspaceAggregate(input) {
      database.exec("BEGIN IMMEDIATE");
      try {
        const current = database
          .prepare(
            `SELECT workspace_id
             FROM workspaces
             WHERE tenant_key = ? AND workspace_key = ? AND tenant_id = ? AND workspace_id = ?`
          )
          .get(
            input.tenantKey,
            input.workspaceKey,
            input.tenantId,
            input.workspaceId
          );
        if (!current) {
          database.exec("ROLLBACK");
          return null;
        }
        const deleteScoped = (tableName: string): number =>
          Number(
            database
              .prepare(
                `DELETE FROM ${tableName} WHERE tenant_id = ? AND workspace_id = ?`
              )
              .run(input.tenantId, input.workspaceId).changes
          );
        const counts = {
          deletedWorkspaceCount: 0,
          deletedAdminRoleAssignmentCount: Number(
            database
              .prepare(`DELETE FROM admin_role_assignments WHERE workspace_id = ?`)
              .run(input.workspaceId).changes
          ),
          deletedAttachmentFileCount: deleteScoped("attachment_files"),
          deletedActivityEventCount: deleteScoped("workspace_activity_events"),
          deletedReviewCount: deleteScoped("workspace_reviews"),
          deletedSourcePackageCount: deleteScoped("source_packages"),
          deletedImportJobCount: deleteScoped("import_jobs"),
          deletedContentReleaseCount: deleteScoped("content_releases"),
          deletedParticipantSessionCount: deleteScoped("participant_sessions"),
          deletedRosterEntryCount: deleteScoped("participant_roster_entries"),
          deletedLoginAttemptCount: deleteScoped("participant_login_attempts"),
          deletedTestRunCount: deleteScoped("test_runs"),
          deletedTestLogCount: deleteScoped("participant_test_logs")
        };
        deleteScoped("operational_login_migration_candidates");
        counts.deletedWorkspaceCount = Number(
          database
            .prepare(
              `DELETE FROM workspaces
               WHERE tenant_id = ? AND workspace_id = ? AND workspace_key = ?`
            )
            .run(input.tenantId, input.workspaceId, input.workspaceKey).changes
        );
        if (counts.deletedWorkspaceCount !== 1) {
          database.exec("ROLLBACK");
          return null;
        }
        database
          .prepare(
            `INSERT INTO admin_audit_events (
              admin_audit_event_id, event_type, actor_admin_user_id,
              subject_admin_user_id, occurred_at, summary, details_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?)`
          )
          .run(
            input.auditEvent.adminAuditEventId,
            input.auditEvent.eventType,
            input.auditEvent.actorAdminUserId,
            input.auditEvent.subjectAdminUserId,
            input.auditEvent.occurredAt,
            input.auditEvent.summary,
            JSON.stringify(input.auditEvent.details)
          );
        database.exec("COMMIT");
        return counts;
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },
    async listWorkspaceActivityEventsByWorkspace(tenantId, workspaceId) {
      const rows = database
        .prepare(
          `SELECT activity_event_id, tenant_id, workspace_id, event_type, actor_id, subject_type, subject_id, occurred_at, summary, details_json
           FROM workspace_activity_events
           WHERE tenant_id = ? AND workspace_id = ?`
        )
        .all(tenantId, workspaceId) as Record<string, unknown>[];
      return rows
        .map(row => mapWorkspaceActivityEvent(row))
        .filter(Boolean) as WorkspaceActivityEvent[];
    },
    async saveWorkspaceActivityEvent(activityEvent) {
      database
        .prepare(
          `INSERT INTO workspace_activity_events (
            activity_event_id, tenant_id, workspace_id, event_type, actor_id, subject_type, subject_id, occurred_at, summary, details_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(activity_event_id) DO UPDATE SET
            tenant_id = excluded.tenant_id,
            workspace_id = excluded.workspace_id,
            event_type = excluded.event_type,
            actor_id = excluded.actor_id,
            subject_type = excluded.subject_type,
            subject_id = excluded.subject_id,
            occurred_at = excluded.occurred_at,
            summary = excluded.summary,
            details_json = excluded.details_json`
        )
        .run(
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
        );
    },
    async deleteWorkspaceActivityEventsByIds(activityEventIds) {
      if (activityEventIds.length === 0) {
        return 0;
      }
      const placeholders = activityEventIds.map(() => "?").join(", ");
      const result = database
        .prepare(
          `DELETE FROM workspace_activity_events WHERE activity_event_id IN (${placeholders})`
        )
        .run(...activityEventIds);
      return Number(result.changes);
    },
    async getSourcePackageById(sourcePackageId) {
      const row = database
        .prepare(
          `SELECT source_package_id, tenant_id, workspace_id, file_name, media_type, content_structure_json, source_document_text, status, uploaded_at
           FROM source_packages
           WHERE source_package_id = ?`
        )
        .get(sourcePackageId) as Record<string, unknown> | undefined;
      return mapSourcePackage(row);
    },
    async listSourcePackagesByWorkspace(tenantId, workspaceId) {
      const rows = database
        .prepare(
          `SELECT source_package_id, tenant_id, workspace_id, file_name, media_type, content_structure_json, source_document_text, status, uploaded_at
           FROM source_packages
           WHERE tenant_id = ? AND workspace_id = ?`
        )
        .all(tenantId, workspaceId) as Record<string, unknown>[];
      return rows.map(row => mapSourcePackage(row)).filter(Boolean) as SourcePackage[];
    },
    async saveSourcePackage(sourcePackage) {
      database
        .prepare(
          `INSERT INTO source_packages (
            source_package_id, tenant_id, workspace_id, file_name, media_type, content_structure_json, source_document_text, status, uploaded_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(source_package_id) DO UPDATE SET
            tenant_id = excluded.tenant_id,
            workspace_id = excluded.workspace_id,
            file_name = excluded.file_name,
            media_type = excluded.media_type,
            content_structure_json = excluded.content_structure_json,
            source_document_text = excluded.source_document_text,
            status = excluded.status,
            uploaded_at = excluded.uploaded_at`
        )
        .run(
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
        );
    },
    async deleteSourcePackageAggregate(input) {
      database.exec("BEGIN IMMEDIATE");
      try {
        const sourcePackage = database
          .prepare(
            `SELECT source_package_id
             FROM source_packages
             WHERE source_package_id = ? AND tenant_id = ? AND workspace_id = ?`
          )
          .get(
            input.sourcePackageId,
            input.tenantId,
            input.workspaceId
          ) as Record<string, unknown> | undefined;
        if (!sourcePackage) {
          database.exec("ROLLBACK");
          return false;
        }
        const importJobs = database
          .prepare(
            `SELECT import_job_id, status
             FROM import_jobs
             WHERE tenant_id = ? AND workspace_id = ? AND source_package_id = ?`
          )
          .all(
            input.tenantId,
            input.workspaceId,
            input.sourcePackageId
          ) as Record<string, unknown>[];
        const importJobIds = importJobs.map(row => String(row.import_job_id));
        const contentReleases = importJobIds.length
          ? (database
              .prepare(
                `SELECT content_release_id, status
                 FROM content_releases
                 WHERE tenant_id = ? AND workspace_id = ?
                   AND import_job_id IN (${importJobIds.map(() => "?").join(", ")})`
              )
              .all(
                input.tenantId,
                input.workspaceId,
                ...importJobIds
              ) as Record<string, unknown>[])
          : [];
        const contentReleaseIds = contentReleases.map(row =>
          String(row.content_release_id)
        );
        const idsMatch = (actual: string[], expected: string[]): boolean =>
          JSON.stringify([...actual].sort()) === JSON.stringify([...expected].sort());
        const referenceCount = contentReleaseIds.length
          ? Number(
              (
                database
                  .prepare(
                    `SELECT
                       (SELECT COUNT(*) FROM participant_sessions
                        WHERE content_release_id IN (${contentReleaseIds
                          .map(() => "?")
                          .join(", ")})) +
                       (SELECT COUNT(*) FROM test_runs
                        WHERE content_release_id IN (${contentReleaseIds
                          .map(() => "?")
                          .join(", ")})) AS reference_count`
                  )
                  .get(...contentReleaseIds, ...contentReleaseIds) as Record<
                  string,
                  unknown
                >
              ).reference_count
            )
          : 0;
        const isBlocked =
          importJobs.some(row => row.status === "queued" || row.status === "running") ||
          contentReleases.some(row => row.status === "active") ||
          referenceCount > 0;
        if (
          isBlocked ||
          !idsMatch(importJobIds, input.expectedImportJobIds) ||
          !idsMatch(contentReleaseIds, input.expectedContentReleaseIds)
        ) {
          database.exec("ROLLBACK");
          return false;
        }

        for (const contentReleaseId of contentReleaseIds) {
          database
            .prepare(`DELETE FROM content_releases WHERE content_release_id = ?`)
            .run(contentReleaseId);
        }
        for (const importJobId of importJobIds) {
          database.prepare(`DELETE FROM import_jobs WHERE import_job_id = ?`).run(
            importJobId
          );
        }
        const deletion = database
          .prepare(
            `DELETE FROM source_packages
             WHERE source_package_id = ? AND tenant_id = ? AND workspace_id = ?`
          )
          .run(input.sourcePackageId, input.tenantId, input.workspaceId);
        database.exec("COMMIT");
        return Number(deletion.changes) === 1;
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },
    async getImportJobById(importJobId) {
      const row = database
        .prepare(
          `SELECT import_job_id, tenant_id, workspace_id, source_package_id, status, created_at, finished_at, diagnostics_json
           FROM import_jobs
           WHERE import_job_id = ?`
        )
        .get(importJobId) as Record<string, unknown> | undefined;
      return mapImportJob(row);
    },
    async listImportJobsByWorkspace(tenantId, workspaceId) {
      const rows = database
        .prepare(
          `SELECT import_job_id, tenant_id, workspace_id, source_package_id, status, created_at, finished_at, diagnostics_json
           FROM import_jobs
           WHERE tenant_id = ? AND workspace_id = ?`
        )
        .all(tenantId, workspaceId) as Record<string, unknown>[];
      return rows.map(row => mapImportJob(row)).filter(Boolean) as ImportJob[];
    },
    async saveImportJob(importJob) {
      database
        .prepare(
          `INSERT INTO import_jobs (
            import_job_id, tenant_id, workspace_id, source_package_id, status, created_at, finished_at, diagnostics_json
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(import_job_id) DO UPDATE SET
            tenant_id = excluded.tenant_id,
            workspace_id = excluded.workspace_id,
            source_package_id = excluded.source_package_id,
            status = excluded.status,
            created_at = excluded.created_at,
            finished_at = excluded.finished_at,
            diagnostics_json = excluded.diagnostics_json`
        )
        .run(
          importJob.importJobId,
          importJob.tenantId,
          importJob.workspaceId,
          importJob.sourcePackageId,
          importJob.status,
          importJob.createdAt,
          importJob.finishedAt,
          JSON.stringify(importJob.diagnostics)
        );
    },
    async getContentReleaseById(contentReleaseId) {
      const row = database
        .prepare(
          `SELECT content_release_id, tenant_id, workspace_id, import_job_id, release_label, runtime_snapshot_json, status, created_at, activated_at
           FROM content_releases
           WHERE content_release_id = ?`
        )
        .get(contentReleaseId) as Record<string, unknown> | undefined;
      return mapContentRelease(row);
    },
    async listContentReleasesByWorkspace(tenantId, workspaceId) {
      const rows = database
        .prepare(
          `SELECT content_release_id, tenant_id, workspace_id, import_job_id, release_label, runtime_snapshot_json, status, created_at, activated_at
           FROM content_releases
           WHERE tenant_id = ? AND workspace_id = ?`
        )
        .all(tenantId, workspaceId) as Record<string, unknown>[];
      return rows
        .map(row => mapContentRelease(row))
        .filter(Boolean) as ContentRelease[];
    },
    async saveContentRelease(contentRelease) {
      database
        .prepare(
          `INSERT INTO content_releases (
            content_release_id, tenant_id, workspace_id, import_job_id, release_label, runtime_snapshot_json, status, created_at, activated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(content_release_id) DO UPDATE SET
            tenant_id = excluded.tenant_id,
            workspace_id = excluded.workspace_id,
            import_job_id = excluded.import_job_id,
            release_label = excluded.release_label,
            runtime_snapshot_json = excluded.runtime_snapshot_json,
            status = excluded.status,
            created_at = excluded.created_at,
            activated_at = excluded.activated_at`
        )
        .run(
          contentRelease.contentReleaseId,
          contentRelease.tenantId,
          contentRelease.workspaceId,
          contentRelease.importJobId,
          contentRelease.releaseLabel,
          JSON.stringify(contentRelease.runtimeSnapshot),
          contentRelease.status,
          contentRelease.createdAt,
          contentRelease.activatedAt
        );
    },
    async getParticipantSessionById(participantSessionId) {
      const row = database
        .prepare(
          `SELECT participant_session_id, tenant_id, workspace_id, content_release_id, login_key, group_key, participant_code, execution_mode, status, valid_until, created_at
           FROM participant_sessions
           WHERE participant_session_id = ?`
        )
        .get(participantSessionId) as Record<string, unknown> | undefined;
      return mapParticipantSession(row);
    },
    async listParticipantSessionsByWorkspace(tenantId, workspaceId) {
      const rows = database
        .prepare(
          `SELECT participant_session_id, tenant_id, workspace_id, content_release_id, login_key, group_key, participant_code, execution_mode, status, valid_until, created_at
           FROM participant_sessions
           WHERE tenant_id = ? AND workspace_id = ?`
        )
        .all(tenantId, workspaceId) as Record<string, unknown>[];
      return rows
        .map(row => mapParticipantSession(row))
        .filter(Boolean) as ParticipantSession[];
    },
    async saveParticipantSession(participantSession) {
      database
        .prepare(
          `INSERT INTO participant_sessions (
            participant_session_id, tenant_id, workspace_id, content_release_id, login_key, group_key, participant_code, execution_mode, status, valid_until, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(participant_session_id) DO UPDATE SET
            tenant_id = excluded.tenant_id,
            workspace_id = excluded.workspace_id,
            content_release_id = excluded.content_release_id,
            login_key = excluded.login_key,
            group_key = excluded.group_key,
            participant_code = excluded.participant_code,
            execution_mode = excluded.execution_mode,
            status = excluded.status,
            valid_until = excluded.valid_until,
            created_at = excluded.created_at`
        )
        .run(
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
        );
    },
    async listParticipantRosterEntriesByWorkspace(tenantId, workspaceId) {
      const rows = database
        .prepare(
          `SELECT participant_roster_entry_id, tenant_id, workspace_id, login_key, execution_mode, group_key, booklet_key, booklet_keys_json, booklet_state_presets_json, booklet_assignments_json, display_name, password_hash, valid_from, valid_to, valid_for_minutes, custom_texts_json, imported_at
           FROM participant_roster_entries
           WHERE tenant_id = ? AND workspace_id = ?`
        )
        .all(tenantId, workspaceId) as Record<string, unknown>[];
      return rows
        .map(row => mapParticipantRosterEntry(row))
        .filter(Boolean) as ParticipantRosterEntry[];
    },
    async listOperationalLoginMigrationCandidatesByWorkspace(
      tenantId,
      workspaceId
    ) {
      const row = database
        .prepare(
          `SELECT candidates_json
           FROM operational_login_migration_candidates
           WHERE tenant_id = ? AND workspace_id = ?`
        )
        .get(tenantId, workspaceId) as
        | { candidates_json?: unknown }
        | undefined;
      if (row?.candidates_json == null) {
        return [];
      }
      try {
        const candidates = JSON.parse(String(row.candidates_json)) as unknown;
        return Array.isArray(candidates)
          ? (candidates as OperationalLoginMigrationCandidate[])
          : [];
      } catch {
        return [];
      }
    },
    async replaceOperationalLoginMigrationCandidatesByWorkspace(
      tenantId,
      workspaceId,
      candidates
    ) {
      database
        .prepare(
          `INSERT INTO operational_login_migration_candidates (
            tenant_id, workspace_id, candidates_json, updated_at
          ) VALUES (?, ?, ?, ?)
          ON CONFLICT(tenant_id, workspace_id) DO UPDATE SET
            candidates_json = excluded.candidates_json,
            updated_at = excluded.updated_at`
        )
        .run(tenantId, workspaceId, JSON.stringify(candidates), new Date().toISOString());
    },
    async getParticipantRosterPasswordHash(tenantId, workspaceId, loginKey) {
      const row = database
        .prepare(
          `SELECT password_hash
           FROM participant_roster_entries
           WHERE tenant_id = ? AND workspace_id = ? AND login_key = ?`
        )
        .get(tenantId, workspaceId, loginKey) as
        | { password_hash?: unknown }
        | undefined;
      return row?.password_hash === null || row?.password_hash === undefined
        ? null
        : String(row.password_hash);
    },
    async saveParticipantRosterEntry(participantRosterEntry, passwordHash) {
      database
        .prepare(
          `INSERT INTO participant_roster_entries (
            participant_roster_entry_id, tenant_id, workspace_id, login_key, execution_mode, group_key, booklet_key, booklet_keys_json, booklet_state_presets_json, booklet_assignments_json, display_name, password_hash, valid_from, valid_to, valid_for_minutes, custom_texts_json, imported_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(tenant_id, workspace_id, login_key) DO UPDATE SET
            participant_roster_entry_id = excluded.participant_roster_entry_id,
            execution_mode = excluded.execution_mode,
            group_key = excluded.group_key,
            booklet_key = excluded.booklet_key,
            booklet_keys_json = excluded.booklet_keys_json,
            booklet_state_presets_json = excluded.booklet_state_presets_json,
            booklet_assignments_json = excluded.booklet_assignments_json,
            display_name = excluded.display_name,
            password_hash = excluded.password_hash,
            valid_from = excluded.valid_from,
            valid_to = excluded.valid_to,
            valid_for_minutes = excluded.valid_for_minutes,
            custom_texts_json = excluded.custom_texts_json,
            imported_at = excluded.imported_at`
        )
        .run(
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
        );
    },
    async getParticipantLoginAttempt(tenantId, workspaceId, loginKey) {
      return mapParticipantLoginAttempt(
        database
          .prepare(
            `SELECT tenant_id, workspace_id, login_key, failed_attempts, expires_at, updated_at
             FROM participant_login_attempts
             WHERE tenant_id = ? AND workspace_id = ? AND login_key = ?`
          )
          .get(tenantId, workspaceId, loginKey) as
          | Record<string, unknown>
          | undefined
      );
    },
    async recordParticipantLoginFailure(input) {
      const row = database
        .prepare(
          `INSERT INTO participant_login_attempts (
            tenant_id, workspace_id, login_key, failed_attempts, expires_at, updated_at
          ) VALUES (?, ?, ?, 1, ?, ?)
          ON CONFLICT(tenant_id, workspace_id, login_key) DO UPDATE SET
            failed_attempts = CASE
              WHEN participant_login_attempts.expires_at <= excluded.updated_at THEN 1
              ELSE participant_login_attempts.failed_attempts + 1
            END,
            expires_at = excluded.expires_at,
            updated_at = excluded.updated_at
          RETURNING tenant_id, workspace_id, login_key, failed_attempts, expires_at, updated_at`
        )
        .get(
          input.tenantId,
          input.workspaceId,
          input.loginKey,
          input.expiresAt,
          input.attemptedAt
        ) as Record<string, unknown> | undefined;
      const result = mapParticipantLoginAttempt(row);
      if (!result) {
        throw new Error("Participant login failure could not be persisted.");
      }
      return result;
    },
    async getTestRunById(testRunId) {
      const row = database
        .prepare(
          `SELECT test_run_id, participant_session_id, tenant_id, workspace_id, content_release_id, booklet_key, execution_mode, booklet_assignment_key, preset_booklet_states_json, booklet_states_json, booklet_state_overrides_json, status, locked, current_unit_key, unit_responses_json, unlocked_testlet_keys_json, monitor_navigation_unlocked, testlet_timers_json, locked_testlet_keys_json, locked_unit_keys_json, created_at, updated_at, completed_at
           FROM test_runs
           WHERE test_run_id = ?`
        )
        .get(testRunId) as Record<string, unknown> | undefined;
      return mapTestRun(row);
    },
    async listTestRunsByParticipantSessionId(participantSessionId) {
      const rows = database
        .prepare(
          `SELECT test_run_id, participant_session_id, tenant_id, workspace_id, content_release_id, booklet_key, execution_mode, booklet_assignment_key, preset_booklet_states_json, booklet_states_json, booklet_state_overrides_json, status, locked, current_unit_key, unit_responses_json, unlocked_testlet_keys_json, monitor_navigation_unlocked, testlet_timers_json, locked_testlet_keys_json, locked_unit_keys_json, created_at, updated_at, completed_at
           FROM test_runs
           WHERE participant_session_id = ?`
        )
        .all(participantSessionId) as Record<string, unknown>[];
      return rows.map(row => mapTestRun(row)).filter(Boolean) as TestRun[];
    },
    async getOpenTestRunByParticipantSessionId(participantSessionId) {
      const row = database
        .prepare(
          `SELECT test_run_id, participant_session_id, tenant_id, workspace_id, content_release_id, booklet_key, execution_mode, booklet_assignment_key, preset_booklet_states_json, booklet_states_json, booklet_state_overrides_json, status, locked, current_unit_key, unit_responses_json, unlocked_testlet_keys_json, monitor_navigation_unlocked, testlet_timers_json, locked_testlet_keys_json, locked_unit_keys_json, created_at, updated_at, completed_at
           FROM test_runs
           WHERE participant_session_id = ? AND status != 'completed'
           ORDER BY updated_at ASC
           LIMIT 1`
        )
        .get(participantSessionId) as Record<string, unknown> | undefined;
      return mapTestRun(row);
    },
    async listTestRunsByWorkspace(tenantId, workspaceId) {
      const rows = database
        .prepare(
          `SELECT test_run_id, participant_session_id, tenant_id, workspace_id, content_release_id, booklet_key, execution_mode, booklet_assignment_key, preset_booklet_states_json, booklet_states_json, booklet_state_overrides_json, status, locked, current_unit_key, unit_responses_json, unlocked_testlet_keys_json, monitor_navigation_unlocked, testlet_timers_json, locked_testlet_keys_json, locked_unit_keys_json, created_at, updated_at, completed_at
           FROM test_runs
           WHERE tenant_id = ? AND workspace_id = ?`
        )
        .all(tenantId, workspaceId) as Record<string, unknown>[];
      return rows.map(row => mapTestRun(row)).filter(Boolean) as TestRun[];
    },
    async saveTestRun(testRun) {
      database
        .prepare(
          `INSERT INTO test_runs (
            test_run_id, participant_session_id, tenant_id, workspace_id, content_release_id, booklet_key, execution_mode, booklet_assignment_key, preset_booklet_states_json, booklet_states_json, booklet_state_overrides_json, status, locked, current_unit_key, unit_responses_json, unlocked_testlet_keys_json, monitor_navigation_unlocked, testlet_timers_json, locked_testlet_keys_json, locked_unit_keys_json, created_at, updated_at, completed_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(test_run_id) DO UPDATE SET
            participant_session_id = excluded.participant_session_id,
            tenant_id = excluded.tenant_id,
            workspace_id = excluded.workspace_id,
            content_release_id = excluded.content_release_id,
            booklet_key = excluded.booklet_key,
            execution_mode = excluded.execution_mode,
            booklet_assignment_key = excluded.booklet_assignment_key,
            preset_booklet_states_json = excluded.preset_booklet_states_json,
            booklet_states_json = excluded.booklet_states_json,
            booklet_state_overrides_json = excluded.booklet_state_overrides_json,
            status = excluded.status,
            locked = excluded.locked,
            current_unit_key = excluded.current_unit_key,
            unit_responses_json = excluded.unit_responses_json,
            unlocked_testlet_keys_json = excluded.unlocked_testlet_keys_json,
            monitor_navigation_unlocked = excluded.monitor_navigation_unlocked,
            testlet_timers_json = excluded.testlet_timers_json,
            locked_testlet_keys_json = excluded.locked_testlet_keys_json,
            locked_unit_keys_json = excluded.locked_unit_keys_json,
            created_at = excluded.created_at,
            updated_at = excluded.updated_at,
            completed_at = excluded.completed_at`
        )
        .run(
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
          testRun.locked ? 1 : 0,
          testRun.currentUnitKey,
          JSON.stringify(testRun.unitResponses),
          JSON.stringify(testRun.unlockedTestletKeys ?? []),
          testRun.monitorNavigationUnlocked ? 1 : 0,
          JSON.stringify(testRun.testletTimers ?? {}),
          JSON.stringify(testRun.lockedTestletKeys ?? []),
          JSON.stringify(testRun.lockedUnitKeys ?? []),
          testRun.createdAt,
          testRun.updatedAt,
          testRun.completedAt
        );
    },
    async deleteTestRunsByIds(testRunIds) {
      if (testRunIds.length === 0) {
        return 0;
      }
      const placeholders = testRunIds.map(() => "?").join(", ");
      const result = database
        .prepare(`DELETE FROM test_runs WHERE test_run_id IN (${placeholders})`)
        .run(...testRunIds);
      return Number(result.changes);
    },
    async listParticipantTestLogsByWorkspace(tenantId, workspaceId) {
      const rows = database
        .prepare(
          `SELECT participant_test_log_id, tenant_id, workspace_id, participant_session_id, test_run_id, unit_key, original_unit_id, log_key, log_content, timestamp, recorded_at
           FROM participant_test_logs
           WHERE tenant_id = ? AND workspace_id = ?
           ORDER BY timestamp DESC, recorded_at DESC`
        )
        .all(tenantId, workspaceId) as Record<string, unknown>[];
      return rows
        .map(row => mapParticipantTestLog(row))
        .filter(Boolean) as ParticipantTestLog[];
    },
    async saveParticipantTestLogs(testLogs) {
      if (testLogs.length === 0) {
        return;
      }
      const statement = database.prepare(
        `INSERT INTO participant_test_logs (
          participant_test_log_id, tenant_id, workspace_id, participant_session_id, test_run_id, unit_key, original_unit_id, log_key, log_content, timestamp, recorded_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(participant_test_log_id) DO UPDATE SET
          tenant_id = excluded.tenant_id,
          workspace_id = excluded.workspace_id,
          participant_session_id = excluded.participant_session_id,
          test_run_id = excluded.test_run_id,
          unit_key = excluded.unit_key,
          original_unit_id = excluded.original_unit_id,
          log_key = excluded.log_key,
          log_content = excluded.log_content,
          timestamp = excluded.timestamp,
          recorded_at = excluded.recorded_at`
      );
      database.exec("BEGIN");
      try {
        for (const testLog of testLogs) {
          statement.run(
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
          );
        }
        database.exec("COMMIT");
      } catch (error) {
        database.exec("ROLLBACK");
        throw error;
      }
    },
    async deleteParticipantTestLogsByTestRunIds(testRunIds) {
      if (testRunIds.length === 0) {
        return 0;
      }
      const placeholders = testRunIds.map(() => "?").join(", ");
      const result = database
        .prepare(
          `DELETE FROM participant_test_logs WHERE test_run_id IN (${placeholders})`
        )
        .run(...testRunIds);
      return Number(result.changes);
    },
    async getWorkspaceReviewById(reviewId) {
      const row = database
        .prepare(
          `SELECT review_id, tenant_id, workspace_id, participant_session_id, test_run_id, unit_key, original_unit_id, page, page_label, user_agent, reviewer_id, category, priority, comment_text, created_at, updated_at
           FROM workspace_reviews
           WHERE review_id = ?`
        )
        .get(reviewId) as Record<string, unknown> | undefined;
      return mapWorkspaceReview(row);
    },
    async listWorkspaceReviewsByWorkspace(tenantId, workspaceId) {
      const rows = database
        .prepare(
          `SELECT review_id, tenant_id, workspace_id, participant_session_id, test_run_id, unit_key, original_unit_id, page, page_label, user_agent, reviewer_id, category, priority, comment_text, created_at, updated_at
           FROM workspace_reviews
           WHERE tenant_id = ? AND workspace_id = ?
           ORDER BY updated_at DESC, created_at DESC`
        )
        .all(tenantId, workspaceId) as Record<string, unknown>[];
      return rows.map(row => mapWorkspaceReview(row)).filter(Boolean) as WorkspaceReview[];
    },
    async saveWorkspaceReview(review) {
      database
        .prepare(
          `INSERT INTO workspace_reviews (
            review_id, tenant_id, workspace_id, participant_session_id, test_run_id, unit_key, original_unit_id, page, page_label, user_agent, reviewer_id, category, priority, comment_text, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON CONFLICT(review_id) DO UPDATE SET
            tenant_id = excluded.tenant_id,
            workspace_id = excluded.workspace_id,
            participant_session_id = excluded.participant_session_id,
            test_run_id = excluded.test_run_id,
            unit_key = excluded.unit_key,
            original_unit_id = excluded.original_unit_id,
            page = excluded.page,
            page_label = excluded.page_label,
            user_agent = excluded.user_agent,
            reviewer_id = excluded.reviewer_id,
            category = excluded.category,
            priority = excluded.priority,
            comment_text = excluded.comment_text,
            created_at = excluded.created_at,
            updated_at = excluded.updated_at`
        )
        .run(
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
        );
    },
    async deleteWorkspaceReview(reviewId) {
      const result = database
        .prepare(`DELETE FROM workspace_reviews WHERE review_id = ?`)
        .run(reviewId);
      return Number(result.changes) > 0;
    },
    async deleteWorkspaceReviewsByTestRunIds(testRunIds) {
      if (testRunIds.length === 0) {
        return 0;
      }
      const placeholders = testRunIds.map(() => "?").join(", ");
      const result = database
        .prepare(
          `DELETE FROM workspace_reviews WHERE test_run_id IN (${placeholders})`
        )
        .run(...testRunIds);
      return Number(result.changes);
    }
  };
};
