import { Pool, type PoolClient, type QueryResultRow } from "pg";

import {
  originalParticipantGroupKeysEqual,
  prepareOriginalParticipantGroup,
  prepareOriginalLoginBinding,
  createContentReleaseActivationRevision,
  prepareContentReleaseActivation,
  prepareWorkspaceFilePublication,
  prepareApplicationAssetDeletion,
  validateApplicationAssetReferences,
  createWorkspaceSourcePackageReferenceRevision,
  hasActiveSourcePackageReplacement,
  transitionParticipantPresence,
  prepareParticipantAssignmentRunCreation,
  prepareParticipantControllerActivation,
  prepareParticipantRunMutation,
  appendParticipantRunCommand,
  acknowledgeParticipantRunCommand,
  prepareParticipantRunCommandApplication,
  type ParticipantPresence,
  type FirstSliceRepository
} from "@testcenter-rewrite-app/application";
import type {
  AdminLoginAttempt,
  AdminAuditEvent,
  AdminRoleAssignment,
  AdminSession,
  AdminUser,
  ApplicationAsset,
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
  OriginalParticipantGroup,
  OriginalLoginBinding,
  ParticipantTestLog,
  ParticipantRunCommand,
  ParticipantProgressDelivery,
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

const mapOriginalParticipantGroup = (row: Record<string, unknown>): OriginalParticipantGroup => ({
  tenantId: String(row.tenant_id), workspaceId: String(row.workspace_id),
  groupKey: String(row.group_key), groupLabel: String(row.group_label),
  createdAt: String(row.created_at), lastModifiedAt: String(row.last_modified_at)
});

const mapOriginalLoginBinding = (row: Record<string, unknown>): OriginalLoginBinding => ({
  tenantId:String(row.tenant_id),workspaceId:String(row.workspace_id),loginKey:String(row.login_key),
  groupKey:String(row.group_key),groupSnapshotKey:String(row.group_snapshot_key),
  createdAt:String(row.created_at),lastAuthenticatedAt:String(row.last_authenticated_at)
});

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
            const value = row.custom_texts_json;
            const parsed =
              typeof value === "string" ? JSON.parse(value) : (value ?? {});
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

const mapAdminRoleAssignment = (
  row: Row | undefined
): AdminRoleAssignment | null => {
  if (!row) {
    return null;
  }
  const monitorRoleSettings = parseMonitorRoleSettings(
    row.monitor_profiles_json
  );
  return {
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
        monitorProfiles: monitorRoleSettings.monitorProfiles,
        monitorBookletVisibility: monitorRoleSettings.monitorBookletVisibility,
        createdAt: String(row.created_at)
      };
};

const parseMonitorRoleSettings = (
  value: unknown
): Pick<AdminRoleAssignment, "monitorProfiles" | "monitorBookletVisibility"> => {
  if (Array.isArray(value)) {
    return {
      monitorProfiles: value as AdminRoleAssignment["monitorProfiles"],
      monitorBookletVisibility: "visible"
    };
  }
  if (typeof value !== "string" || !value) {
    if (value && typeof value === "object") {
      const settings = value as Record<string, unknown>;
      return {
        monitorProfiles: Array.isArray(settings.monitorProfiles)
          ? (settings.monitorProfiles as AdminRoleAssignment["monitorProfiles"])
          : [],
        monitorBookletVisibility:
          settings.monitorBookletVisibility === "collapsed" ||
          settings.monitorBookletVisibility === "hidden"
            ? settings.monitorBookletVisibility
            : "visible"
      };
    }
    return { monitorProfiles: [], monitorBookletVisibility: "visible" };
  }
  try {
    const parsed = JSON.parse(value) as unknown;
    return parseMonitorRoleSettings(parsed);
  } catch {
    return { monitorProfiles: [], monitorBookletVisibility: "visible" };
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
        privacyNotice:
          row.privacy_notice == null ? "" : String(row.privacy_notice),
        accessibilityNotice:
          row.accessibility_notice == null
            ? ""
            : String(row.accessibility_notice),
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
        assetAssignments: (() => {
          try {
            const parsed =
              typeof row.asset_assignments_json === "string"
                ? JSON.parse(row.asset_assignments_json)
                : row.asset_assignments_json ?? {};
            return parsed && typeof parsed === "object" && !Array.isArray(parsed)
              ? parsed as ApplicationSettings["assetAssignments"]
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

const mapApplicationAsset = (row: Row | undefined): ApplicationAsset | null =>
  row
    ? {
        applicationAssetId: String(row.application_asset_id),
        originalName: String(row.original_name),
        mediaType: row.media_type as ApplicationAsset["mediaType"],
        dataBase64: String(row.data_base64),
        byteLength: Number(row.byte_length),
        createdAt: String(row.created_at),
        updatedAt: String(row.updated_at)
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
        ...(row.original_login_key === null || row.original_login_key === undefined ? {} : {originalLoginKey:String(row.original_login_key)}),
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
        const viewSettings = (() => {
          try {
            const parsed =
              typeof row.view_settings_json === "string"
                ? JSON.parse(row.view_settings_json)
                : row.view_settings_json ?? {};
            return parsed && typeof parsed === "object" && !Array.isArray(parsed)
              ? (parsed as NonNullable<ParticipantRosterEntry["viewSettings"]>)
              : {};
          } catch {
            return {};
          }
        })();
        const assetAssignments = (() => {
          try {
            const parsed =
              typeof row.asset_assignments_json === "string"
                ? JSON.parse(row.asset_assignments_json)
                : row.asset_assignments_json ?? {};
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
          ...(row.original_login_identity ? {originalLoginIdentity:true as const} : {}),
          ...(row.group_label === null || row.group_label === undefined
            ? {}
            : { groupLabel: String(row.group_label) }),
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
          viewSettings,
          ...(Object.keys(assetAssignments).length > 0
            ? { assetAssignments }
            : {}),
          importedAt: String(row.imported_at)
        };
      })()
    : null;

// Cast optional JSON metadata to text so JSON null remains distinct from SQL NULL.
const testRunProjection = `test_runs.*, controller_entry_json::text AS controller_entry_json, controller_dispatches_json::text AS controller_dispatches_json, original_result_state_json::text AS original_result_state_json`;

const mapTestRun = (row: Row | undefined): TestRun | null =>
  row
    ? {
        ...(row.controller_entry_json == null ? {} : { controllerEntry: typeof row.controller_entry_json === "string" ? JSON.parse(row.controller_entry_json) : row.controller_entry_json as TestRun["controllerEntry"] }),
        ...(row.original_result_state_json == null ? {} : { originalResultState: (typeof row.original_result_state_json === "string" ? JSON.parse(row.original_result_state_json) : row.original_result_state_json) as TestRun["originalResultState"] }),
        ...(row.state_revision == null ? {} : { stateRevision: Number(row.state_revision) }),
        ...(row.controller_dispatches_json == null ? {} : { controllerDispatches: (typeof row.controller_dispatches_json === "string" ? JSON.parse(row.controller_dispatches_json) : row.controller_dispatches_json) as TestRun["controllerDispatches"] }),
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
        pauseSource:
          row.pause_source === "monitor" || row.pause_source === "participant"
            ? row.pause_source
            : undefined,
        locked:
          row.locked === true || String(row.locked ?? "false") === "true",
        currentUnitKey:
          row.current_unit_key === null || row.current_unit_key === undefined
            ? null
            : String(row.current_unit_key),
        unitResponses: JSON.parse(
          String(row.unit_responses_json ?? "{}")
        ) as Record<string, string>,
        ...(() => {
          const fields = JSON.parse(String(row.response_field_timestamps_json ?? "{}")) as NonNullable<TestRun["unitResponseFieldTimestamps"]>;
          return Object.keys(fields).length ? { unitResponseFieldTimestamps: fields } : {};
        })(),
        ...(() => {
          const fields = JSON.parse(String(row.shared_parameter_timestamps_json ?? "{}")) as NonNullable<TestRun["sharedParameterTimestamps"]>;
          return Object.keys(fields).length ? { sharedParameterTimestamps: fields } : {};
        })(),
        sharedParameters: (() => {
          try {
            const value = row.shared_parameters_json;
            const parsed =
              typeof value === "string" ? JSON.parse(value) : (value ?? []);
            return Array.isArray(parsed)
              ? (parsed as NonNullable<TestRun["sharedParameters"]>)
              : [];
          } catch {
            return [];
          }
        })(),
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
        ...(row.original_timestamp === 0 ? { originalTimestamp: 0 as const } : {}),
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
  },
  {
    version: 42,
    name: "add_test_run_pause_source",
    sql: `
      ALTER TABLE test_runs ADD COLUMN IF NOT EXISTS pause_source TEXT;
    `
  },
  {
    version: 43,
    name: "add_participant_view_settings",
    sql: `
      ALTER TABLE participant_roster_entries
        ADD COLUMN IF NOT EXISTS view_settings_json JSONB NOT NULL DEFAULT '{}'::jsonb;
    `
  },
  {
    version: 44,
    name: "add_participant_asset_assignments",
    sql: `
      ALTER TABLE participant_roster_entries
        ADD COLUMN IF NOT EXISTS asset_assignments_json JSONB NOT NULL DEFAULT '{}'::jsonb;
    `
  },
  {
    version: 45,
    name: "add_application_assets",
    sql: `
      CREATE TABLE IF NOT EXISTS application_assets (
        application_asset_id TEXT PRIMARY KEY,
        original_name TEXT NOT NULL UNIQUE,
        media_type TEXT NOT NULL,
        data_base64 TEXT NOT NULL,
        byte_length INTEGER NOT NULL,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL
      );
    `
  },
  {
    version: 46,
    name: "add_application_asset_assignments",
    sql: `
      ALTER TABLE application_settings
        ADD COLUMN IF NOT EXISTS asset_assignments_json JSONB NOT NULL DEFAULT '{}'::jsonb;
    `
  },
  {
    version: 47,
    name: "add_participant_group_labels",
    sql: `
      ALTER TABLE participant_roster_entries
        ADD COLUMN IF NOT EXISTS group_label TEXT;
    `
  },
  {
    version: 48,
    name: "add_separate_public_notices",
    sql: `
      ALTER TABLE application_settings
        ADD COLUMN IF NOT EXISTS privacy_notice TEXT NOT NULL DEFAULT '';
      ALTER TABLE application_settings
        ADD COLUMN IF NOT EXISTS accessibility_notice TEXT NOT NULL DEFAULT '';
    `
  },
  {
    version: 49,
    name: "persist_test_run_shared_parameters",
    sql: `
      ALTER TABLE test_runs
        ADD COLUMN IF NOT EXISTS shared_parameters_json JSONB NOT NULL DEFAULT '[]'::jsonb;
    `
  },
  {
    version: 50,
    name: "add_consumed_proof_of_work_challenges",
    sql: `
      CREATE TABLE IF NOT EXISTS consumed_proof_of_work_challenges (
        challenge_id TEXT PRIMARY KEY,
        consumed_at TEXT NOT NULL,
        expires_at TEXT NOT NULL
      );
      CREATE INDEX IF NOT EXISTS idx_consumed_proof_of_work_challenges_expiry
        ON consumed_proof_of_work_challenges (expires_at);
    `
  },
  {
    version: 51,
    name: "add_participant_access_credentials",
    sql: `
      CREATE TABLE IF NOT EXISTS participant_access_credentials (
        participant_session_id TEXT PRIMARY KEY REFERENCES participant_sessions(participant_session_id) ON DELETE CASCADE,
        token_hash TEXT,
        updated_at TEXT NOT NULL
      );
    `
  },
  {
    version: 52,
    name: "add_participant_connection_presence",
    sql: `
      ALTER TABLE participant_test_logs ADD COLUMN original_timestamp INTEGER
        CHECK (original_timestamp IS NULL OR original_timestamp = 0);
      CREATE TABLE participant_connection_presence (
        test_run_id TEXT PRIMARY KEY REFERENCES test_runs(test_run_id) ON DELETE CASCADE,
        participant_session_id TEXT NOT NULL,
        presence_json JSONB NOT NULL,
        next_expiry BIGINT
      );
      CREATE INDEX idx_participant_connection_presence_expiry
        ON participant_connection_presence(next_expiry) WHERE next_expiry IS NOT NULL;
    `
  },
  {
    version: 53,
    name: "add_participant_run_commands",
    sql: `
      CREATE TABLE participant_run_commands (
        test_run_id TEXT NOT NULL REFERENCES test_runs(test_run_id) ON DELETE CASCADE,
        command_id TEXT NOT NULL,
        sequence BIGINT NOT NULL CHECK (sequence > 0 AND sequence <= 9007199254740991),
        tenant_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        participant_session_id TEXT NOT NULL,
        command_json JSONB NOT NULL,
        acknowledged_at TEXT,
        PRIMARY KEY (test_run_id, command_id),
        UNIQUE (test_run_id, sequence)
      );
      CREATE INDEX idx_participant_run_commands_pending
        ON participant_run_commands(test_run_id, sequence) WHERE acknowledged_at IS NULL;
    `
  },
  {
    version: 54,
    name: "index_participant_command_application_order",
    sql: `
      CREATE UNIQUE INDEX idx_participant_run_commands_execution
        ON participant_run_commands(test_run_id, ((command_json->>'executionSequence')::bigint))
        WHERE command_json->>'executionSequence' IS NOT NULL;
    `
  },
  {
    version: 55,
    name: "index_pending_participant_command_effects",
    sql: `
      DROP INDEX idx_participant_run_commands_pending;
      CREATE INDEX idx_participant_run_commands_pending
        ON participant_run_commands(test_run_id, sequence) WHERE acknowledged_at IS NULL OR (command_json->>'effectsDeferred' = 'true' AND command_json->>'executedAt' IS NULL);
    `
  },
  {
    version: 56,
    name: "index_unacknowledged_participant_commands",
    sql: `
      DROP INDEX idx_participant_run_commands_pending;
      CREATE INDEX idx_participant_run_commands_pending
        ON participant_run_commands(test_run_id, sequence) WHERE acknowledged_at IS NULL;
    `
  },
  {
    version: 57,
    name: "participant_progress_delivery_and_field_ordering",
    sql: `
      ALTER TABLE test_runs ADD COLUMN response_field_timestamps_json TEXT NOT NULL DEFAULT '{}';
      ALTER TABLE test_runs ADD COLUMN shared_parameter_timestamps_json TEXT NOT NULL DEFAULT '{}';
      CREATE TABLE participant_progress_deliveries (
        test_run_id TEXT NOT NULL REFERENCES test_runs(test_run_id) ON DELETE CASCADE,
        delivery_id TEXT NOT NULL,
        tenant_id TEXT NOT NULL,
        workspace_id TEXT NOT NULL,
        participant_session_id TEXT NOT NULL,
        content_release_id TEXT NOT NULL,
        delivery_json JSONB NOT NULL,
        PRIMARY KEY (test_run_id, delivery_id)
      );
      CREATE INDEX idx_participant_progress_deliveries_workspace
        ON participant_progress_deliveries(tenant_id, workspace_id);
    `
  },
  {
    version: 58,
    name: "participant_run_controller_entry",
    sql: `ALTER TABLE test_runs ADD COLUMN controller_entry_json JSONB;`
  },
  {
    version: 59,
    name: "participant_run_state_revision",
    sql: `ALTER TABLE test_runs ADD COLUMN state_revision BIGINT; ALTER TABLE test_runs ADD COLUMN controller_dispatches_json JSONB;`
  },
  {
    version: 60,
    name: "original_test_result_state",
    sql: `ALTER TABLE test_runs ADD COLUMN original_result_state_json JSONB;`
  },
  {
    version: 61,
    name: "original_participant_groups",
    sql: `CREATE TABLE IF NOT EXISTS original_participant_groups (
      tenant_id TEXT NOT NULL, workspace_id TEXT NOT NULL, group_key TEXT NOT NULL,
      group_label TEXT NOT NULL, created_at TEXT NOT NULL, last_modified_at TEXT NOT NULL,
      PRIMARY KEY (tenant_id, workspace_id, group_key)
    );`
  },
  {
    version: 62,
    name: "original_login_bindings",
    sql: `CREATE TABLE IF NOT EXISTS original_login_bindings (
      tenant_id TEXT NOT NULL, workspace_id TEXT NOT NULL, login_key TEXT NOT NULL,
      group_key TEXT NOT NULL, group_snapshot_key TEXT NOT NULL,
      created_at TEXT NOT NULL, last_authenticated_at TEXT NOT NULL,
      PRIMARY KEY (tenant_id, workspace_id, login_key),
      FOREIGN KEY (tenant_id, workspace_id, group_snapshot_key)
        REFERENCES original_participant_groups(tenant_id, workspace_id, group_key) ON DELETE CASCADE
    );
    ALTER TABLE participant_sessions ADD COLUMN original_login_key TEXT;
    ALTER TABLE participant_roster_entries ADD COLUMN original_login_identity BOOLEAN;
    CREATE INDEX IF NOT EXISTS participant_sessions_original_login
      ON participant_sessions(tenant_id, workspace_id, original_login_key);`
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

const persistTestRun = async (connection: Pick<Pool, "query">, testRun: TestRun, updateExisting = true): Promise<boolean> => {
  const result = await connection.query(
    `INSERT INTO test_runs (
      test_run_id, participant_session_id, tenant_id, workspace_id, content_release_id, booklet_key, execution_mode, booklet_assignment_key, preset_booklet_states_json, booklet_states_json, booklet_state_overrides_json, status, locked, current_unit_key, unit_responses_json, shared_parameters_json, unlocked_testlet_keys_json, monitor_navigation_unlocked, testlet_timers_json, locked_testlet_keys_json, locked_unit_keys_json, created_at, updated_at, completed_at, pause_source, response_field_timestamps_json, shared_parameter_timestamps_json, controller_entry_json, state_revision, controller_dispatches_json, original_result_state_json
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21, $22, $23, $24, $25, $26, $27, $28, $29, $30, $31)
    ${updateExisting ? `ON CONFLICT(test_run_id) DO UPDATE SET
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
      shared_parameters_json = EXCLUDED.shared_parameters_json,
      unlocked_testlet_keys_json = EXCLUDED.unlocked_testlet_keys_json,
      monitor_navigation_unlocked = EXCLUDED.monitor_navigation_unlocked,
      testlet_timers_json = EXCLUDED.testlet_timers_json,
      locked_testlet_keys_json = EXCLUDED.locked_testlet_keys_json,
      locked_unit_keys_json = EXCLUDED.locked_unit_keys_json,
      created_at = EXCLUDED.created_at,
      updated_at = EXCLUDED.updated_at,
      completed_at = EXCLUDED.completed_at,
      pause_source = EXCLUDED.pause_source,
        response_field_timestamps_json = EXCLUDED.response_field_timestamps_json,
        shared_parameter_timestamps_json = EXCLUDED.shared_parameter_timestamps_json,
        controller_entry_json = EXCLUDED.controller_entry_json,
        state_revision = EXCLUDED.state_revision,
        controller_dispatches_json = EXCLUDED.controller_dispatches_json,
        original_result_state_json = EXCLUDED.original_result_state_json` : "ON CONFLICT(test_run_id) DO NOTHING"}`,
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
      JSON.stringify(testRun.sharedParameters ?? []),
      JSON.stringify(testRun.unlockedTestletKeys ?? []),
      testRun.monitorNavigationUnlocked === true,
      JSON.stringify(testRun.testletTimers ?? {}),
      JSON.stringify(testRun.lockedTestletKeys ?? []),
      JSON.stringify(testRun.lockedUnitKeys ?? []),
      testRun.createdAt,
      testRun.updatedAt,
      testRun.completedAt,
      testRun.status === "paused" ? testRun.pauseSource ?? null : null,
      JSON.stringify(testRun.unitResponseFieldTimestamps ?? {}),
      JSON.stringify(testRun.sharedParameterTimestamps ?? {}),
      testRun.controllerEntry === undefined ? null : JSON.stringify(testRun.controllerEntry),
      testRun.stateRevision ?? null,
      testRun.controllerDispatches === undefined ? null : JSON.stringify(testRun.controllerDispatches),
      testRun.originalResultState === undefined ? null : JSON.stringify(testRun.originalResultState)
    ]
  );
  return result.rowCount === 1;
};

const createRepositoryFromPool = (pool: Pool): FirstSliceRepository => {
  const readActivationState=async(client:Pool|PoolClient,tenantId:string,workspaceId:string,lock=false)=>{
    const scope=[tenantId,workspaceId],suffix=lock?" ORDER BY participant_session_id FOR UPDATE":"";
    // Parent first, matching Run creation/mutation; lock rows before reading
    // the state used to reject stale open-run checks.
    const participantSessions=(await client.query("SELECT * FROM participant_sessions WHERE tenant_id=$1 AND workspace_id=$2"+suffix,scope)).rows.map(row=>mapParticipantSession(row as Row)).filter((value):value is ParticipantSession=>value!==null);
    const testRuns=(await client.query(`SELECT ${testRunProjection} FROM test_runs WHERE tenant_id=$1 AND workspace_id=$2`+(lock?" ORDER BY test_run_id FOR UPDATE":""),scope)).rows.map(row=>mapTestRun(row as Row)).filter((value):value is TestRun=>value!==null);
    const contentReleases=(await client.query("SELECT * FROM content_releases WHERE tenant_id=$1 AND workspace_id=$2",scope)).rows.map(row=>mapContentRelease(row as Row)).filter((value):value is ContentRelease=>value!==null);
    return {contentReleases,participantSessions,testRuns};
  };

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

  const withWorkspaceMutationLock = async <Result>(
    tenantId: string,
    workspaceId: string,
    mutation: (client: PoolClient) => Promise<Result>
  ): Promise<Result> => {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const workspace = await client.query(
        `SELECT workspace_id
         FROM workspaces
         WHERE tenant_id = $1 AND workspace_id = $2
         FOR UPDATE`,
        [tenantId, workspaceId]
      );
      if (workspace.rowCount !== 1) {
        throw new Error(
          `Workspace '${workspaceId}' is unavailable for a source-package reference mutation.`
        );
      }
      const result = await mutation(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  };

  const withAssetWrite=async<Result>(mutation:(client:PoolClient)=>Promise<Result>):Promise<Result>=>{
    const client=await pool.connect();
    try{await client.query("BEGIN");
      // Shared by catalog and assignment writers across every process.
      await client.query("SELECT pg_advisory_xact_lock(1413693779, hashtext(current_schema()))");
      const result=await mutation(client);await client.query("COMMIT");return result;
    }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
  };
  const assetNames=async(client:PoolClient)=> (await client.query<{original_name:string}>("SELECT original_name FROM application_assets")).rows.map(row=>({originalName:row.original_name}));

  const writeSettings=async(client:PoolClient,settings:ApplicationSettings):Promise<void>=>{
      await client.query(
        `INSERT INTO application_settings (
          settings_key, app_title, main_logo, theme_name, intro_html,
          legal_notice_html, privacy_notice, accessibility_notice,
          custom_texts_json, asset_assignments_json,
          global_warning_text, global_warning_expires_at,
          updated_at, updated_by_admin_user_id
        ) VALUES ('global', $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
        ON CONFLICT(settings_key) DO UPDATE SET
          app_title = EXCLUDED.app_title,
          main_logo = EXCLUDED.main_logo,
          theme_name = EXCLUDED.theme_name,
          intro_html = EXCLUDED.intro_html,
          legal_notice_html = EXCLUDED.legal_notice_html,
          privacy_notice = EXCLUDED.privacy_notice,
          accessibility_notice = EXCLUDED.accessibility_notice,
          custom_texts_json = EXCLUDED.custom_texts_json,
          asset_assignments_json = EXCLUDED.asset_assignments_json,
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
          settings.privacyNotice,
          settings.accessibilityNotice,
          JSON.stringify(settings.customTexts),
          JSON.stringify(settings.assetAssignments),
          settings.globalWarningText,
          settings.globalWarningExpiresAt,
          settings.updatedAt,
          settings.updatedByAdminUserId
        ]
      );

  };

  const reserveSourcePackageWithActivity = async (input: Parameters<FirstSliceRepository['reserveSourcePackageAssembly']>[0],
    requiredEventType: 'source_package_assembled' | 'source_package_created'): Promise<boolean> => {
    const { assembledSourcePackage, assemblyActivityEvent } = input;
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      const workspace = await client.query(
        `SELECT workspace_id
         FROM workspaces
         WHERE tenant_id = $1 AND workspace_id = $2
         FOR UPDATE`,
        [assembledSourcePackage.tenantId, assembledSourcePackage.workspaceId]
      );
      const sourcePackages = (
        await client.query(
          `SELECT source_package_id, tenant_id, workspace_id, file_name, media_type,
                  content_structure_json, source_document_text, status, uploaded_at
           FROM source_packages
           WHERE tenant_id = $1 AND workspace_id = $2`,
          [assembledSourcePackage.tenantId, assembledSourcePackage.workspaceId]
        )
      ).rows
        .map(row => mapSourcePackage(row as Row))
        .filter(Boolean) as SourcePackage[];
      const activityEvents = (
        await client.query(
          `SELECT activity_event_id, tenant_id, workspace_id, event_type, actor_id,
                  subject_type, subject_id, occurred_at, summary, details_json
           FROM workspace_activity_events
           WHERE tenant_id = $1 AND workspace_id = $2`,
          [assembledSourcePackage.tenantId, assembledSourcePackage.workspaceId]
        )
      ).rows
        .map(row => mapWorkspaceActivityEvent(row as Row))
        .filter(Boolean) as WorkspaceActivityEvent[];
      if (
        workspace.rowCount !== 1 ||
        assemblyActivityEvent.tenantId !== assembledSourcePackage.tenantId ||
        assemblyActivityEvent.workspaceId !==
          assembledSourcePackage.workspaceId ||
        assemblyActivityEvent.eventType !== requiredEventType ||
        assemblyActivityEvent.subjectId !==
          assembledSourcePackage.sourcePackageId ||
        createWorkspaceSourcePackageReferenceRevision({
          sourcePackages,
          activityEvents
        }) !== input.expectedWorkspaceSourcePackageReferenceRevision
      ) {
        await client.query("ROLLBACK");
        return false;
      }
      await client.query(
        `INSERT INTO source_packages (
          source_package_id, tenant_id, workspace_id, file_name, media_type, content_structure_json, source_document_text, status, uploaded_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [
          assembledSourcePackage.sourcePackageId,
          assembledSourcePackage.tenantId,
          assembledSourcePackage.workspaceId,
          assembledSourcePackage.fileName,
          assembledSourcePackage.mediaType,
          assembledSourcePackage.contentStructure
            ? JSON.stringify(assembledSourcePackage.contentStructure)
            : null,
          assembledSourcePackage.sourceDocument,
          assembledSourcePackage.status,
          assembledSourcePackage.uploadedAt
        ]
      );
      await client.query(
        `INSERT INTO workspace_activity_events (
          activity_event_id, tenant_id, workspace_id, event_type, actor_id, subject_type, subject_id, occurred_at, summary, details_json
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
        [
          assemblyActivityEvent.activityEventId,
          assemblyActivityEvent.tenantId,
          assemblyActivityEvent.workspaceId,
          assemblyActivityEvent.eventType,
          assemblyActivityEvent.actorId,
          assemblyActivityEvent.subjectType,
          assemblyActivityEvent.subjectId,
          assemblyActivityEvent.occurredAt,
          assemblyActivityEvent.summary,
          JSON.stringify(assemblyActivityEvent.details)
        ]
      );
      await client.query("COMMIT");
      return true;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  };

  return {
    async getApplicationSettings() {
      return one(
        `SELECT app_title, main_logo, theme_name, intro_html,
                legal_notice_html, privacy_notice, accessibility_notice,
                custom_texts_json, asset_assignments_json,
                global_warning_text, global_warning_expires_at,
                updated_at, updated_by_admin_user_id
         FROM application_settings
         WHERE settings_key = 'global'`,
        [],
        mapApplicationSettings
      );
    },
    async saveApplicationSettings(settings) {
      return withAssetWrite(async client=>{validateApplicationAssetReferences(settings.assetAssignments,await assetNames(client));await writeSettings(client,settings);});
    },
    async mutateApplicationSettings(transform) {
      return withAssetWrite(async client=>{
        const previous=mapApplicationSettings((await client.query("SELECT * FROM application_settings WHERE settings_key='global'")).rows[0]);
        const effect=transform(structuredClone(previous));
        validateApplicationAssetReferences(effect.settings.assetAssignments,await assetNames(client));
        await writeSettings(client,effect.settings);
        const audit=effect.auditEvent;
        await client.query("INSERT INTO admin_audit_events(admin_audit_event_id,event_type,actor_admin_user_id,subject_admin_user_id,occurred_at,summary,details_json) VALUES($1,$2,$3,$4,$5,$6,$7)",[audit.adminAuditEventId,audit.eventType,audit.actorAdminUserId,audit.subjectAdminUserId,audit.occurredAt,audit.summary,JSON.stringify(audit.details)]);
        return structuredClone(effect.settings);
      });
    },
    async listApplicationAssets() {
      return many(
        `SELECT application_asset_id, original_name, media_type, data_base64,
                byte_length, created_at, updated_at
         FROM application_assets
         ORDER BY original_name ASC`,
        [],
        mapApplicationAsset
      );
    },
    async getApplicationAssetById(applicationAssetId) {
      return one(
        `SELECT application_asset_id, original_name, media_type, data_base64,
                byte_length, created_at, updated_at
         FROM application_assets
         WHERE application_asset_id = $1`,
        [applicationAssetId],
        mapApplicationAsset
      );
    },
    async getApplicationAssetByOriginalName(originalName) {
      return one(
        `SELECT application_asset_id, original_name, media_type, data_base64,
                byte_length, created_at, updated_at
         FROM application_assets
         WHERE original_name = $1`,
        [originalName],
        mapApplicationAsset
      );
    },
    async saveApplicationAsset(applicationAsset, replaceByOriginalName=false) {
      return withAssetWrite(async client=>{
        const existing=replaceByOriginalName?mapApplicationAsset((await client.query("SELECT * FROM application_assets WHERE original_name=$1",[applicationAsset.originalName])).rows[0]):null;
        if(existing)applicationAsset={...applicationAsset,applicationAssetId:existing.applicationAssetId,createdAt:existing.createdAt};

      await client.query(
        `INSERT INTO application_assets (
          application_asset_id, original_name, media_type, data_base64,
          byte_length, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7)
        ON CONFLICT (application_asset_id) DO UPDATE SET
          original_name = EXCLUDED.original_name,
          media_type = EXCLUDED.media_type,
          data_base64 = EXCLUDED.data_base64,
          byte_length = EXCLUDED.byte_length,
          updated_at = EXCLUDED.updated_at`,
        [
          applicationAsset.applicationAssetId,
          applicationAsset.originalName,
          applicationAsset.mediaType,
          applicationAsset.dataBase64,
          applicationAsset.byteLength,
          applicationAsset.createdAt,
          applicationAsset.updatedAt
        ]
      );
        return { applicationAsset, replaced: Boolean(existing) };
      });
    },
    async mutateApplicationAssetDeletion(input) {
      return withAssetWrite(async client=>{
        const asset=mapApplicationAsset((await client.query("SELECT * FROM application_assets WHERE application_asset_id=$1",[input.applicationAssetId])).rows[0]);
        const settings=mapApplicationSettings((await client.query("SELECT * FROM application_settings WHERE settings_key='global'")).rows[0]);
        const roster=(await client.query("SELECT * FROM participant_roster_entries")).rows.map(row=>mapParticipantRosterEntry(row)!).map(row=>({...row,assetAssignments:row.assetAssignments??{}}));
        const operational=(await client.query("SELECT tenant_id,workspace_id,candidates_json FROM operational_login_migration_candidates")).rows.map(row=>({tenantId:String(row.tenant_id),workspaceId:String(row.workspace_id),candidates:row.candidates_json as OperationalLoginMigrationCandidate[]}));
        const scopes=(await client.query("SELECT w.tenant_id,w.workspace_id,w.workspace_key,t.tenant_key FROM workspaces w JOIN tenants t ON t.tenant_id=w.tenant_id")).rows.map(row=>({tenantId:String(row.tenant_id),workspaceId:String(row.workspace_id),tenantKey:String(row.tenant_key),workspaceKey:String(row.workspace_key)}));
        const effect=prepareApplicationAssetDeletion(input,{asset,settings,roster,operational,scopes});if(!effect)return null;
        if(effect.settings)await client.query("UPDATE application_settings SET asset_assignments_json=$1,updated_at=$2,updated_by_admin_user_id=$3 WHERE settings_key='global'",[JSON.stringify(effect.settings.assetAssignments),effect.settings.updatedAt,effect.settings.updatedByAdminUserId]);
        for(const row of effect.roster)await client.query("UPDATE participant_roster_entries SET asset_assignments_json=$1 WHERE participant_roster_entry_id=$2",[JSON.stringify(row.assetAssignments),row.participantRosterEntryId]);
        for(const group of effect.operational)await client.query("UPDATE operational_login_migration_candidates SET candidates_json=$1 WHERE tenant_id=$2 AND workspace_id=$3",[JSON.stringify(group.candidates),group.tenantId,group.workspaceId]);
        await client.query("DELETE FROM application_assets WHERE application_asset_id=$1",[effect.asset.applicationAssetId]);
        const audit=effect.auditEvent;
        await client.query("INSERT INTO admin_audit_events(admin_audit_event_id,event_type,actor_admin_user_id,subject_admin_user_id,occurred_at,summary,details_json) VALUES($1,$2,$3,$4,$5,$6,$7) ON CONFLICT(admin_audit_event_id) DO UPDATE SET details_json=excluded.details_json",[audit.adminAuditEventId,audit.eventType,audit.actorAdminUserId,audit.subjectAdminUserId,audit.occurredAt,audit.summary,JSON.stringify(audit.details)]);
        return effect.asset;
      });
    },
    async deleteApplicationAsset(applicationAssetId) {
      return withAssetWrite(async client=>{

      const result = await client.query(
        "DELETE FROM application_assets WHERE application_asset_id = $1",
        [applicationAssetId]
      );
      return (result.rowCount ?? 0) > 0;
      });
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
    async consumeProofOfWorkChallenge(input) {
      await pool.query(
        `DELETE FROM consumed_proof_of_work_challenges
         WHERE expires_at <= $1`,
        [input.consumedAt]
      );
      const result = await pool.query<{ challenge_id: string }>(
        `INSERT INTO consumed_proof_of_work_challenges (
          challenge_id, consumed_at, expires_at
        ) VALUES ($1, $2, $3)
        ON CONFLICT (challenge_id) DO NOTHING
        RETURNING challenge_id`,
        [input.challengeId, input.consumedAt, input.expiresAt]
      );
      return result.rowCount === 1;
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
          JSON.stringify({
            monitorProfiles: roleAssignment.monitorProfiles,
            monitorBookletVisibility:
              roleAssignment.monitorBookletVisibility ?? "visible"
          }),
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
        await deleteScoped("original_login_bindings");
        await deleteScoped("original_participant_groups");
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
    async listWorkspaceActivityEventsByWorkspace(tenantId, workspaceId, eventTypes) {
      if (eventTypes?.length === 0) return [];
      return many(
        `SELECT activity_event_id, tenant_id, workspace_id, event_type, actor_id, subject_type, subject_id, occurred_at, summary, details_json
         FROM workspace_activity_events
         WHERE tenant_id = $1 AND workspace_id = $2
           AND ($3::text[] IS NULL OR event_type = ANY($3::text[]))`,
        [tenantId, workspaceId, eventTypes ?? null],
        mapWorkspaceActivityEvent
      );
    },
    async saveWorkspaceActivityEvent(activityEvent) {
      await withWorkspaceMutationLock(
        activityEvent.tenantId,
        activityEvent.workspaceId,
        client =>
          client.query(
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
          )
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
      await withWorkspaceMutationLock(
        sourcePackage.tenantId,
        sourcePackage.workspaceId,
        client =>
          client.query(
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
          )
      );
    },
    reserveSourcePackageAssembly: input => reserveSourcePackageWithActivity(input, 'source_package_assembled'),
    async publishWorkspaceFiles(input) {
      input=structuredClone(input);
      const source=input.sourcePackage,job=input.importJob,release=input.contentRelease;
      const client=await pool.connect();
      try {
        await client.query("BEGIN");
        const scope=[source.tenantId,source.workspaceId];
        const workspace=(await client.query(`SELECT workspace_id FROM workspaces WHERE tenant_id=$1 AND workspace_id=$2 FOR UPDATE`,scope)).rows[0];
        const sourcePackages=((await client.query(`SELECT * FROM source_packages WHERE tenant_id=$1 AND workspace_id=$2`,scope)).rows).map(row=>mapSourcePackage(row as Row)).filter(Boolean) as SourcePackage[];
        const activityEvents=((await client.query(`SELECT * FROM workspace_activity_events WHERE tenant_id=$1 AND workspace_id=$2`,scope)).rows).map(row=>mapWorkspaceActivityEvent(row as Row)).filter(Boolean) as WorkspaceActivityEvent[];
        const contentReleases=((await client.query(`SELECT * FROM content_releases WHERE tenant_id=$1 AND workspace_id=$2`,scope)).rows).map(row=>mapContentRelease(row as Row)).filter(Boolean) as ContentRelease[];
        const occupiedSource=(await client.query(`SELECT source_package_id FROM source_packages WHERE source_package_id=$1`,[source.sourcePackageId])).rows[0];
        const occupiedJob=(await client.query(`SELECT import_job_id FROM import_jobs WHERE import_job_id=$1`,[job.importJobId])).rows[0];
        const occupiedRelease=release ? (await client.query(`SELECT content_release_id FROM content_releases WHERE content_release_id=$1`,[release.contentReleaseId])).rows[0] : null;
        let occupiedEvent=false;
        for(const event of input.activityEvents)if((await client.query(`SELECT activity_event_id FROM workspace_activity_events WHERE activity_event_id=$1`,[event.activityEventId])).rows[0])occupiedEvent=true;
        const superseded=prepareWorkspaceFilePublication(input,{workspaceExists:!!workspace,
          identitiesAvailable:!occupiedSource && !occupiedJob && !occupiedRelease && !occupiedEvent,
          sourcePackages,activityEvents,contentReleases});
        if(!superseded){await client.query("ROLLBACK");return false;}
        await client.query(`INSERT INTO source_packages (source_package_id,tenant_id,workspace_id,file_name,media_type,content_structure_json,source_document_text,status,uploaded_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[source.sourcePackageId,source.tenantId,source.workspaceId,source.fileName,source.mediaType,source.contentStructure?JSON.stringify(source.contentStructure):null,source.sourceDocument,source.status,source.uploadedAt]);
        await client.query(`INSERT INTO import_jobs (import_job_id,tenant_id,workspace_id,source_package_id,status,created_at,finished_at,diagnostics_json) VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,[job.importJobId,job.tenantId,job.workspaceId,job.sourcePackageId,job.status,job.createdAt,job.finishedAt,JSON.stringify(job.diagnostics)]);
        for(const previous of superseded){await client.query(`UPDATE content_releases SET status='superseded' WHERE content_release_id=$1`,[previous.contentReleaseId]);}
        if(release){await client.query(`INSERT INTO content_releases (content_release_id,tenant_id,workspace_id,import_job_id,release_label,runtime_snapshot_json,status,created_at,activated_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,[release.contentReleaseId,release.tenantId,release.workspaceId,release.importJobId,release.releaseLabel,JSON.stringify(release.runtimeSnapshot),release.status,release.createdAt,release.activatedAt]);}
        for(const event of input.activityEvents){await client.query(`INSERT INTO workspace_activity_events (activity_event_id,tenant_id,workspace_id,event_type,actor_id,subject_type,subject_id,occurred_at,summary,details_json) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,[event.activityEventId,event.tenantId,event.workspaceId,event.eventType,event.actorId,event.subjectType,event.subjectId,event.occurredAt,event.summary,JSON.stringify(event.details)]);}
        await client.query("COMMIT");
        return true;
      }catch(error){await client.query("ROLLBACK");throw error;}finally{client.release();}
    },
    reserveWorkspaceFileUpload: input => reserveSourcePackageWithActivity({assembledSourcePackage:input.sourcePackage,
      assemblyActivityEvent:input.createdActivityEvent,
      expectedWorkspaceSourcePackageReferenceRevision:input.expectedWorkspaceSourcePackageReferenceRevision}, 'source_package_created'),
    async reserveSourcePackageReplacement(input) {
      const { replacementSourcePackage, replacementActivityEvent } = input;
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const workspace = await client.query(
          `SELECT workspace_id
           FROM workspaces
           WHERE tenant_id = $1 AND workspace_id = $2
           FOR UPDATE`,
          [replacementSourcePackage.tenantId, replacementSourcePackage.workspaceId]
        );
        const replacedSourcePackage = await client.query(
          `SELECT source_package_id
           FROM source_packages
           WHERE source_package_id = $1 AND tenant_id = $2 AND workspace_id = $3`,
          [
            input.replacedSourcePackageId,
            replacementSourcePackage.tenantId,
            replacementSourcePackage.workspaceId
          ]
        );
        const sourcePackages = (
          await client.query(
            `SELECT source_package_id, tenant_id, workspace_id, file_name, media_type,
                    content_structure_json, source_document_text, status, uploaded_at
             FROM source_packages
             WHERE tenant_id = $1 AND workspace_id = $2`,
            [replacementSourcePackage.tenantId, replacementSourcePackage.workspaceId]
          )
        ).rows
          .map(row => mapSourcePackage(row as Row))
          .filter(Boolean) as SourcePackage[];
        const activityEvents = (
          await client.query(
            `SELECT activity_event_id, tenant_id, workspace_id, event_type, actor_id,
                    subject_type, subject_id, occurred_at, summary, details_json
             FROM workspace_activity_events
             WHERE tenant_id = $1 AND workspace_id = $2`,
            [replacementSourcePackage.tenantId, replacementSourcePackage.workspaceId]
          )
        ).rows
          .map(row => mapWorkspaceActivityEvent(row as Row))
          .filter(Boolean) as WorkspaceActivityEvent[];
        if (
          workspace.rowCount !== 1 ||
          replacedSourcePackage.rowCount !== 1 ||
          replacementActivityEvent.tenantId !== replacementSourcePackage.tenantId ||
          replacementActivityEvent.workspaceId !== replacementSourcePackage.workspaceId ||
          replacementActivityEvent.subjectId !== input.replacedSourcePackageId ||
          createWorkspaceSourcePackageReferenceRevision({
            sourcePackages,
            activityEvents
          }) !== input.expectedWorkspaceSourcePackageReferenceRevision ||
          hasActiveSourcePackageReplacement({
            sourcePackageId: input.replacedSourcePackageId,
            sourcePackages,
            activityEvents
          })
        ) {
          await client.query("ROLLBACK");
          return false;
        }
        await client.query(
          `INSERT INTO source_packages (
            source_package_id, tenant_id, workspace_id, file_name, media_type, content_structure_json, source_document_text, status, uploaded_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
          [
            replacementSourcePackage.sourcePackageId,
            replacementSourcePackage.tenantId,
            replacementSourcePackage.workspaceId,
            replacementSourcePackage.fileName,
            replacementSourcePackage.mediaType,
            replacementSourcePackage.contentStructure
              ? JSON.stringify(replacementSourcePackage.contentStructure)
              : null,
            replacementSourcePackage.sourceDocument,
            replacementSourcePackage.status,
            replacementSourcePackage.uploadedAt
          ]
        );
        await client.query(
          `INSERT INTO workspace_activity_events (
            activity_event_id, tenant_id, workspace_id, event_type, actor_id, subject_type, subject_id, occurred_at, summary, details_json
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
          [
            replacementActivityEvent.activityEventId,
            replacementActivityEvent.tenantId,
            replacementActivityEvent.workspaceId,
            replacementActivityEvent.eventType,
            replacementActivityEvent.actorId,
            replacementActivityEvent.subjectType,
            replacementActivityEvent.subjectId,
            replacementActivityEvent.occurredAt,
            replacementActivityEvent.summary,
            JSON.stringify(replacementActivityEvent.details)
          ]
        );
        await client.query("COMMIT");
        return true;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async deleteSourcePackageAggregate(input) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const workspace = await client.query(
          `SELECT workspace_id
           FROM workspaces
           WHERE tenant_id = $1 AND workspace_id = $2
           FOR UPDATE`,
          [input.tenantId, input.workspaceId]
        );
        if (workspace.rowCount !== 1) {
          await client.query("ROLLBACK");
          return false;
        }
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
        const workspaceSourcePackages = (
          await client.query(
            `SELECT source_package_id, tenant_id, workspace_id, file_name, media_type,
                    content_structure_json, source_document_text, status, uploaded_at
             FROM source_packages
             WHERE tenant_id = $1 AND workspace_id = $2`,
            [input.tenantId, input.workspaceId]
          )
        ).rows
          .map(row => mapSourcePackage(row as Row))
          .filter(Boolean) as SourcePackage[];
        const workspaceActivityEvents = (
          await client.query(
            `SELECT activity_event_id, tenant_id, workspace_id, event_type, actor_id,
                    subject_type, subject_id, occurred_at, summary, details_json
             FROM workspace_activity_events
             WHERE tenant_id = $1 AND workspace_id = $2`,
            [input.tenantId, input.workspaceId]
          )
        ).rows
          .map(row => mapWorkspaceActivityEvent(row as Row))
          .filter(Boolean) as WorkspaceActivityEvent[];
        const workspaceSourcePackageReferenceRevision =
          createWorkspaceSourcePackageReferenceRevision({
            sourcePackages: workspaceSourcePackages,
            activityEvents: workspaceActivityEvents
          });
        const isBlocked =
          importJobs.rows.some(
            row => row.status === "queued" || row.status === "running"
          ) ||
          contentReleases.rows.some(row => row.status === "active") ||
          Number(references.rows[0]?.reference_count ?? 0) > 0;
        if (
          isBlocked ||
          !idsMatch(importJobIds, input.expectedImportJobIds) ||
          !idsMatch(contentReleaseIds, input.expectedContentReleaseIds) ||
          workspaceSourcePackageReferenceRevision !==
            input.expectedWorkspaceSourcePackageReferenceRevision
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
    async getContentReleaseActivationRevision(tenantId,workspaceId) {
      return createContentReleaseActivationRevision(await readActivationState(pool,tenantId,workspaceId));
    },
    async commitContentReleaseActivation(input) {
      const client=await pool.connect();
      try{
        await client.query("BEGIN");
        const workspace=(await client.query("SELECT workspace_id FROM workspaces WHERE tenant_id=$1 AND workspace_id=$2 FOR UPDATE",[input.tenantId,input.workspaceId])).rows[0];
        const occupied=(await client.query("SELECT activity_event_id FROM workspace_activity_events WHERE activity_event_id=$1",[input.activityEvent.activityEventId])).rows[0];
        const prepared=prepareContentReleaseActivation(input,{...await readActivationState(client,input.tenantId,input.workspaceId,true),workspaceExists:!!workspace,eventIdAvailable:!occupied});
        if(!prepared){await client.query("ROLLBACK");return false;}
        for(const release of prepared.contentReleases)await client.query("UPDATE content_releases SET status=$1,activated_at=$2 WHERE content_release_id=$3",[release.status,release.activatedAt,release.contentReleaseId]);
        const event=prepared.activityEvent;
        await client.query("INSERT INTO workspace_activity_events (activity_event_id,tenant_id,workspace_id,event_type,actor_id,subject_type,subject_id,occurred_at,summary,details_json) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)",[event.activityEventId,event.tenantId,event.workspaceId,event.eventType,event.actorId,event.subjectType,event.subjectId,event.occurredAt,event.summary,JSON.stringify(event.details)]);
        await client.query("COMMIT");return true;
      }catch(error){await client.query("ROLLBACK");throw error;}
      finally{client.release();}
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
        `SELECT participant_session_id, tenant_id, workspace_id, content_release_id, login_key, group_key, participant_code, execution_mode, status, valid_until, created_at, original_login_key
         FROM participant_sessions
         WHERE participant_session_id = $1`,
        [participantSessionId],
        mapParticipantSession
      );
    },
    async getParticipantAccessCredential(participantSessionId) {
      const result = await pool.query("SELECT token_hash, updated_at FROM participant_access_credentials WHERE participant_session_id = $1", [participantSessionId]);
      const row = result.rows[0];
      return row ? {
        participantSessionId, tokenHash: row.token_hash === null ? null : String(row.token_hash), updatedAt: String(row.updated_at)
      } : null;
    },
    async saveParticipantAccessCredential(credential) {
      await pool.query(`INSERT INTO participant_access_credentials (participant_session_id, token_hash, updated_at)
        VALUES ($1, $2, $3) ON CONFLICT(participant_session_id) DO UPDATE SET token_hash = excluded.token_hash, updated_at = excluded.updated_at`,
        [credential.participantSessionId, credential.tokenHash, credential.updatedAt]);
    },
    async revokeParticipantAccessCredential(input) {
      if (input.expectedTokenHash !== null) {
        const result = await pool.query(`UPDATE participant_access_credentials SET token_hash = NULL, updated_at = $1
          WHERE participant_session_id = $2 AND token_hash = $3`,
          [input.updatedAt, input.participantSessionId, input.expectedTokenHash]);
        return (result.rowCount ?? 0) > 0;
      }
      const result = await pool.query(`INSERT INTO participant_access_credentials (participant_session_id, token_hash, updated_at)
        VALUES ($1, NULL, $2) ON CONFLICT(participant_session_id) DO UPDATE SET token_hash = NULL, updated_at = excluded.updated_at
        WHERE participant_access_credentials.token_hash IS NOT DISTINCT FROM $3::text`,
        [input.participantSessionId, input.updatedAt, input.expectedTokenHash]);
      return (result.rowCount ?? 0) > 0;
    },
    async listParticipantSessionsByWorkspace(tenantId, workspaceId) {
      return many(
        `SELECT participant_session_id, tenant_id, workspace_id, content_release_id, login_key, group_key, participant_code, execution_mode, status, valid_until, created_at, original_login_key
         FROM participant_sessions
         WHERE tenant_id = $1 AND workspace_id = $2`,
        [tenantId, workspaceId],
        mapParticipantSession
      );
    },
    async getOrCreateOriginalParticipantGroup(input) {
      const candidate = prepareOriginalParticipantGroup(input);
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        // Serialize absent-row creation, including collator-equivalent spellings,
        // with other workspace mutations and deletion.
        const workspace = await client.query("SELECT workspace_id FROM workspaces WHERE tenant_id = $1 AND workspace_id = $2 FOR UPDATE", [candidate.tenantId, candidate.workspaceId]);
        if (!workspace.rowCount) { await client.query("ROLLBACK"); return null; }
        const groups = (await client.query("SELECT * FROM original_participant_groups WHERE tenant_id = $1 AND workspace_id = $2", [candidate.tenantId, candidate.workspaceId])).rows.map(mapOriginalParticipantGroup);
        const existing = groups.find(group => originalParticipantGroupKeysEqual(group.groupKey, candidate.groupKey));
        if (!existing) await client.query("INSERT INTO original_participant_groups (tenant_id, workspace_id, group_key, group_label, created_at, last_modified_at) VALUES ($1, $2, $3, $4, $5, $6)",
          [candidate.tenantId, candidate.workspaceId, candidate.groupKey, candidate.groupLabel, candidate.createdAt, candidate.lastModifiedAt]);
        await client.query("COMMIT");
        return existing ?? candidate;
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
    },
    async listOriginalParticipantGroupsByWorkspace(tenantId, workspaceId) {
      return (await pool.query("SELECT * FROM original_participant_groups WHERE tenant_id = $1 AND workspace_id = $2 ORDER BY group_key", [tenantId, workspaceId])).rows.map(mapOriginalParticipantGroup);
    },
    async bindOriginalLoginGroup(input) {
      const validated = prepareOriginalLoginBinding(input), client = await pool.connect();
      try {
        await client.query("BEGIN");
        const parent = await client.query("SELECT workspace_id FROM workspaces WHERE tenant_id=$1 AND workspace_id=$2 FOR UPDATE",[input.tenantId,input.workspaceId]);
        const group = await client.query("SELECT group_key FROM original_participant_groups WHERE tenant_id=$1 AND workspace_id=$2 AND group_key=$3",[input.tenantId,input.workspaceId,input.groupSnapshotKey]);
        if (!parent.rowCount || !group.rowCount) { await client.query("ROLLBACK"); return null; }
        const bindings = (await client.query("SELECT * FROM original_login_bindings WHERE tenant_id=$1 AND workspace_id=$2",[input.tenantId,input.workspaceId])).rows.map(mapOriginalLoginBinding);
        const binding = prepareOriginalLoginBinding(input,bindings.find(row=>originalParticipantGroupKeysEqual(row.loginKey,validated.loginKey)));
        await client.query(`INSERT INTO original_login_bindings (tenant_id,workspace_id,login_key,group_key,group_snapshot_key,created_at,last_authenticated_at)
          VALUES ($1,$2,$3,$4,$5,$6,$7) ON CONFLICT (tenant_id,workspace_id,login_key) DO UPDATE SET
          group_key=EXCLUDED.group_key,group_snapshot_key=EXCLUDED.group_snapshot_key,last_authenticated_at=EXCLUDED.last_authenticated_at`,
          [binding.tenantId,binding.workspaceId,binding.loginKey,binding.groupKey,binding.groupSnapshotKey,binding.createdAt,binding.lastAuthenticatedAt]);
        await client.query("UPDATE participant_sessions SET group_key=$1 WHERE tenant_id=$2 AND workspace_id=$3 AND original_login_key=$4",[binding.groupKey,binding.tenantId,binding.workspaceId,binding.loginKey]);
        await client.query("COMMIT"); return binding;
      } catch (error) { await client.query("ROLLBACK"); throw error; } finally { client.release(); }
    },
    async listOriginalLoginBindingsByWorkspace(tenantId,workspaceId) {
      return (await pool.query("SELECT * FROM original_login_bindings WHERE tenant_id=$1 AND workspace_id=$2 ORDER BY login_key",[tenantId,workspaceId])).rows.map(mapOriginalLoginBinding);
    },
    async saveParticipantSession(participantSession) {
      const previous = mapParticipantSession((await pool.query("SELECT * FROM participant_sessions WHERE participant_session_id=$1",[participantSession.participantSessionId])).rows[0]);
      const originalLoginKey = previous?.originalLoginKey ?? participantSession.originalLoginKey;
      const native = originalLoginKey !== undefined, client = native ? await pool.connect() : null;
      try {
        if (native) {
          await client!.query("BEGIN");
          if (previous?.originalLoginKey && (previous.tenantId !== participantSession.tenantId || previous.workspaceId !== participantSession.workspaceId || previous.originalLoginKey !== (participantSession.originalLoginKey ?? originalLoginKey) || previous.loginKey !== participantSession.loginKey)) throw new TypeError('Native person cannot change its login identity.');
          const parent = await client!.query("SELECT workspace_id FROM workspaces WHERE tenant_id=$1 AND workspace_id=$2 FOR UPDATE",[participantSession.tenantId,participantSession.workspaceId]);
          const binding = (await client!.query("SELECT * FROM original_login_bindings WHERE tenant_id=$1 AND workspace_id=$2 AND login_key=$3",[participantSession.tenantId,participantSession.workspaceId,originalLoginKey])).rows[0];
          if (!parent.rowCount || !binding || participantSession.loginKey !== binding.login_key) throw new TypeError('Native person requires its current scoped login binding.');
          participantSession = {...participantSession,originalLoginKey,groupKey:String(binding.group_key)};
        }
        await (client ?? pool).query(
        `INSERT INTO participant_sessions (
          participant_session_id, tenant_id, workspace_id, content_release_id, login_key, group_key, participant_code, execution_mode, status, valid_until, created_at, original_login_key
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
          created_at = EXCLUDED.created_at,
          original_login_key = EXCLUDED.original_login_key`,
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
          participantSession.createdAt,
          participantSession.originalLoginKey ?? null
        ]
      );
        if (native) await client!.query("COMMIT");
      } catch (error) { if (native) await client!.query("ROLLBACK"); throw error; }
      finally { client?.release(); }
    },
    async listParticipantRosterEntriesByWorkspace(tenantId, workspaceId) {
      return many(
        `SELECT participant_roster_entry_id, tenant_id, workspace_id, login_key, execution_mode, group_key, group_label, booklet_key, booklet_keys_json, booklet_state_presets_json, booklet_assignments_json, display_name, password_hash, valid_from, valid_to, valid_for_minutes, custom_texts_json, view_settings_json, asset_assignments_json, imported_at, original_login_identity
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
      return withAssetWrite(async client=>{
        const assets=await assetNames(client);
        for(const candidate of candidates)validateApplicationAssetReferences(candidate.assetAssignments,assets);
      await client.query(
        `INSERT INTO operational_login_migration_candidates (
          tenant_id, workspace_id, candidates_json, updated_at
        ) VALUES ($1, $2, $3::jsonb, $4)
        ON CONFLICT (tenant_id, workspace_id) DO UPDATE SET
          candidates_json = EXCLUDED.candidates_json,
          updated_at = EXCLUDED.updated_at`,
        [tenantId, workspaceId, JSON.stringify(candidates), new Date().toISOString()]
      );
      });
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
      return withAssetWrite(async client=>{
        validateApplicationAssetReferences(participantRosterEntry.assetAssignments,await assetNames(client));
      await client.query(
        `INSERT INTO participant_roster_entries (
          participant_roster_entry_id, tenant_id, workspace_id, login_key, execution_mode, group_key, group_label, booklet_key, booklet_keys_json, booklet_state_presets_json, booklet_assignments_json, display_name, password_hash, valid_from, valid_to, valid_for_minutes, custom_texts_json, view_settings_json, asset_assignments_json, imported_at, original_login_identity
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        ON CONFLICT (tenant_id, workspace_id, login_key) DO UPDATE SET
          participant_roster_entry_id = EXCLUDED.participant_roster_entry_id,
          execution_mode = EXCLUDED.execution_mode,
          group_key = EXCLUDED.group_key,
          group_label = EXCLUDED.group_label,
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
          view_settings_json = EXCLUDED.view_settings_json,
          asset_assignments_json = EXCLUDED.asset_assignments_json,
          imported_at = EXCLUDED.imported_at,
          original_login_identity = EXCLUDED.original_login_identity`,
        [
          participantRosterEntry.participantRosterEntryId,
          participantRosterEntry.tenantId,
          participantRosterEntry.workspaceId,
          participantRosterEntry.loginKey,
          participantRosterEntry.executionMode ?? null,
          participantRosterEntry.groupKey,
          participantRosterEntry.groupLabel ?? null,
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
          JSON.stringify(participantRosterEntry.viewSettings ?? {}),
          JSON.stringify(participantRosterEntry.assetAssignments ?? {}),
          participantRosterEntry.importedAt,
          participantRosterEntry.originalLoginIdentity ?? null
        ]
      );
      });
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
    async resetParticipantLoginAttempts(tenantId, workspaceId, loginKey) {
      await pool.query(
        `DELETE FROM participant_login_attempts
         WHERE tenant_id = $1 AND workspace_id = $2 AND login_key = $3`,
        [tenantId, workspaceId, loginKey]
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
        `SELECT ${testRunProjection}
         FROM test_runs
         WHERE test_run_id = $1`,
        [testRunId],
        mapTestRun
      );
    },
    async listTestRunsByParticipantSessionId(participantSessionId) {
      return many(
        `SELECT ${testRunProjection}
         FROM test_runs
         WHERE participant_session_id = $1`,
        [participantSessionId],
        mapTestRun
      );
    },
    async getOpenTestRunByParticipantSessionId(participantSessionId) {
      return one(
        `SELECT ${testRunProjection}
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
        `SELECT ${testRunProjection}
         FROM test_runs
         WHERE tenant_id = $1 AND workspace_id = $2`,
        [tenantId, workspaceId],
        mapTestRun
      );
    },
    async getOrCreateTestRunForAssignment(candidate, initialize) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        // Lock the existing parent, even when no child Run exists yet. All
        // reservation reads/writes use this client, never a second pool slot.
        const session = mapParticipantSession((await client.query(
          "SELECT * FROM participant_sessions WHERE participant_session_id = $1 FOR UPDATE",
          [candidate.participantSessionId]
        )).rows[0]);
        const runs = (await client.query(
          `SELECT ${testRunProjection} FROM test_runs WHERE participant_session_id = $1 OR test_run_id = $2`,
          [candidate.participantSessionId, candidate.testRunId]
        )).rows.map(mapTestRun).filter((run): run is TestRun => run !== null);
        const prepared = prepareParticipantAssignmentRunCreation(candidate, session, runs, initialize);
        if (!prepared.created) {
          await client.query("COMMIT");
          return { testRun: prepared.testRun, created: false };
        }
        if (!await persistTestRun(client, prepared.testRun, false)) {
          throw new Error("Run ID already exists outside the participant assignment reservation.");
        }
        const effect = prepared.effect!;
        for (const log of effect.testLogs) await client.query(`INSERT INTO participant_test_logs
          (participant_test_log_id, tenant_id, workspace_id, participant_session_id, test_run_id, unit_key, original_unit_id, log_key, log_content, timestamp, recorded_at, original_timestamp)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`, [log.participantTestLogId, log.tenantId,
            log.workspaceId, log.participantSessionId, log.testRunId, log.unitKey, log.originalUnitId, log.logKey, log.logContent,
            log.timestamp, log.recordedAt, log.originalTimestamp ?? null]);
        for (const event of effect.activityEvents) await client.query(`INSERT INTO workspace_activity_events
          (activity_event_id, tenant_id, workspace_id, event_type, actor_id, subject_type, subject_id, occurred_at, summary, details_json)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`, [event.activityEventId, event.tenantId, event.workspaceId,
            event.eventType, event.actorId, event.subjectType, event.subjectId, event.occurredAt, event.summary, JSON.stringify(event.details)]);
        if (effect.participantSession) await client.query("UPDATE participant_sessions SET status = $1 WHERE participant_session_id = $2",
          [effect.participantSession.status, candidate.participantSessionId]);
        const stored = mapTestRun((await client.query(
          `SELECT ${testRunProjection} FROM test_runs WHERE test_run_id = $1`, [candidate.testRunId]
        )).rows[0]);
        if (!stored) throw new Error("Participant assignment reservation was not persisted.");
        await client.query("COMMIT");
        return { testRun: stored, created: true };
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally {
        client.release();
      }
    },
    async saveTestRun(testRun) {
      await persistTestRun(pool, testRun);
    },
    async activateParticipantController(input) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const session = mapParticipantSession((await client.query(
          "SELECT * FROM participant_sessions WHERE participant_session_id = $1 FOR UPDATE", [input.participantSessionId])).rows[0]);
        const run = mapTestRun((await client.query(
          `SELECT ${testRunProjection} FROM test_runs WHERE test_run_id = $1 FOR UPDATE`, [input.testRunId])).rows[0]);
        const result = prepareParticipantControllerActivation(input, session, run);
        if (result?.activated) await client.query("UPDATE participant_sessions SET status = 'launched' WHERE participant_session_id = $1", [input.participantSessionId]);
        if (result?.entryChanged) await persistTestRun(client, result.testRun);
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally { client.release(); }
    },
    async appendParticipantRunCommand(input) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const runResult = await client.query(`SELECT ${testRunProjection} FROM test_runs WHERE test_run_id = $1 FOR UPDATE`, [input.testRunId]);
        const existing = await client.query("SELECT command_json FROM participant_run_commands WHERE test_run_id = $1 AND command_id = $2", [input.testRunId, input.commandId]);
        const last = await client.query("SELECT sequence FROM participant_run_commands WHERE test_run_id = $1 ORDER BY sequence DESC LIMIT 1", [input.testRunId]);
        const command = appendParticipantRunCommand(input, mapTestRun(runResult.rows[0]), {
          existing: existing.rows[0]?.command_json ?? null,
          lastSequence: Number(last.rows[0]?.sequence ?? 0)
        });
        if (command) await client.query(`INSERT INTO participant_run_commands
          (test_run_id, command_id, sequence, tenant_id, workspace_id, participant_session_id, command_json, acknowledged_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8) ON CONFLICT(test_run_id, command_id) DO NOTHING`,
          [command.testRunId, command.commandId, command.sequence, command.tenantId, command.workspaceId,
            command.participantSessionId, JSON.stringify(command), command.acknowledgedAt]);
        await client.query("COMMIT");return command;
      } catch (error) { await client.query("ROLLBACK");throw error; }
      finally { client.release(); }
    },
    async listPendingParticipantRunCommands(scope) {
      const result = await pool.query(`SELECT command.command_json FROM participant_run_commands AS command
        JOIN test_runs AS run ON run.test_run_id = command.test_run_id
        WHERE command.test_run_id = $1 AND command.tenant_id = $2 AND command.workspace_id = $3
          AND command.participant_session_id = $4 AND command.acknowledged_at IS NULL
          AND run.tenant_id = $2 AND run.workspace_id = $3 AND run.participant_session_id = $4
        ORDER BY command.sequence`, [scope.testRunId, scope.tenantId, scope.workspaceId, scope.participantSessionId]);
      return result.rows.map(row => row.command_json as ParticipantRunCommand);
    },
    async acknowledgeParticipantRunCommand(input) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        const runResult = await client.query(`SELECT ${testRunProjection} FROM test_runs WHERE test_run_id = $1 FOR UPDATE`, [input.testRunId]);
        const row = await client.query("SELECT command_json FROM participant_run_commands WHERE test_run_id = $1 AND command_id = $2", [input.testRunId, input.commandId]);
        const command = acknowledgeParticipantRunCommand(input, mapTestRun(runResult.rows[0]), row.rows[0]?.command_json ?? null);
        if (command) await client.query(`UPDATE participant_run_commands SET command_json = $1::jsonb, acknowledged_at = $2
          WHERE test_run_id = $3 AND command_id = $4`, [JSON.stringify(command), command.acknowledgedAt, input.testRunId, input.commandId]);
        await client.query("COMMIT");return command;
      } catch (error) { await client.query("ROLLBACK");throw error; }
      finally { client.release(); }
    },
    async mutateParticipantRun(input, transform) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        // Parent first, matching assignment reservation and parent deletion.
        const participantSession = mapParticipantSession((await client.query(
          "SELECT * FROM participant_sessions WHERE participant_session_id = $1 FOR UPDATE", [input.participantSessionId])).rows[0]);
        const testRun = mapTestRun((await client.query(`SELECT ${testRunProjection} FROM test_runs WHERE test_run_id = $1 FOR UPDATE`, [input.testRunId])).rows[0]);
        const testRuns = (await client.query(`SELECT ${testRunProjection} FROM test_runs WHERE participant_session_id = $1`, [input.participantSessionId]))
          .rows.map(mapTestRun).filter((run): run is TestRun => run !== null);
        const deliveryRow = input.deliveryId ? await client.query("SELECT delivery_json FROM participant_progress_deliveries WHERE test_run_id = $1 AND delivery_id = $2", [input.testRunId, input.deliveryId]) : null;
        const progressDelivery = (deliveryRow?.rows[0]?.delivery_json ?? null) as ParticipantProgressDelivery | null;
        const prepared = prepareParticipantRunMutation(input,
          testRun && participantSession ? { testRun, participantSession, testRuns, progressDelivery } : null, transform);
        if (prepared?.effect) {
          const effect = prepared.effect;
          if (effect.progressDelivery) {
            const receipt = effect.progressDelivery;
            await client.query(`INSERT INTO participant_progress_deliveries
              (test_run_id, delivery_id, tenant_id, workspace_id, participant_session_id, content_release_id, delivery_json)
              VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb) ON CONFLICT(test_run_id, delivery_id) DO NOTHING`,
              [receipt.testRunId, receipt.deliveryId, receipt.tenantId, receipt.workspaceId, receipt.participantSessionId,
                receipt.contentReleaseId, JSON.stringify(receipt)]);
          }
          if (effect.commandInput) {
            const existing = await client.query("SELECT command_json FROM participant_run_commands WHERE test_run_id = $1 AND command_id = $2", [input.testRunId, effect.commandInput.commandId]);
            const last = await client.query("SELECT sequence FROM participant_run_commands WHERE test_run_id = $1 ORDER BY sequence DESC LIMIT 1", [input.testRunId]);
            const command = appendParticipantRunCommand(effect.commandInput, effect.testRun, {
              existing: existing.rows[0]?.command_json ?? null,
              lastSequence: Number(last.rows[0]?.sequence ?? 0)
          });
        if (!command) throw new Error("The Run no longer accepts the projected command.");
        if (command) await client.query(`INSERT INTO participant_run_commands
          (test_run_id, command_id, sequence, tenant_id, workspace_id, participant_session_id, command_json, acknowledged_at)
          VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8) ON CONFLICT(test_run_id, command_id) DO NOTHING`,
          [command.testRunId, command.commandId, command.sequence, command.tenantId, command.workspaceId,
            command.participantSessionId, JSON.stringify(command), command.acknowledgedAt]);
        }
          await persistTestRun(client, effect.testRun);
          for (const log of effect.testLogs) await client.query(`INSERT INTO participant_test_logs
            (participant_test_log_id, tenant_id, workspace_id, participant_session_id, test_run_id, unit_key, original_unit_id, log_key, log_content, timestamp, recorded_at, original_timestamp)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) ON CONFLICT(participant_test_log_id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, workspace_id = EXCLUDED.workspace_id, participant_session_id = EXCLUDED.participant_session_id, test_run_id = EXCLUDED.test_run_id, unit_key = EXCLUDED.unit_key, original_unit_id = EXCLUDED.original_unit_id, log_key = EXCLUDED.log_key, log_content = EXCLUDED.log_content, timestamp = EXCLUDED.timestamp, recorded_at = EXCLUDED.recorded_at, original_timestamp = EXCLUDED.original_timestamp`, [log.participantTestLogId, log.tenantId,
              log.workspaceId, log.participantSessionId, log.testRunId, log.unitKey, log.originalUnitId, log.logKey, log.logContent,
              log.timestamp, log.recordedAt, log.originalTimestamp ?? null]);
          for (const event of effect.activityEvents) await client.query(`INSERT INTO workspace_activity_events
            (activity_event_id, tenant_id, workspace_id, event_type, actor_id, subject_type, subject_id, occurred_at, summary, details_json)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb) ON CONFLICT(activity_event_id) DO UPDATE SET tenant_id = EXCLUDED.tenant_id, workspace_id = EXCLUDED.workspace_id, event_type = EXCLUDED.event_type, actor_id = EXCLUDED.actor_id, subject_type = EXCLUDED.subject_type, subject_id = EXCLUDED.subject_id, occurred_at = EXCLUDED.occurred_at, summary = EXCLUDED.summary, details_json = EXCLUDED.details_json`, [event.activityEventId, event.tenantId, event.workspaceId,
              event.eventType, event.actorId, event.subjectType, event.subjectId, event.occurredAt, event.summary, JSON.stringify(event.details)]);
          if (effect.participantSession) await client.query("UPDATE participant_sessions SET status = $1 WHERE participant_session_id = $2",
            [effect.participantSession.status, input.participantSessionId]);
        }
        await client.query("COMMIT");
        return prepared?.result ?? null;
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
    },
    async applyParticipantRunCommand(input, transform) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        // Parent first, matching assignment reservation and parent deletion.
        const participantSession = mapParticipantSession((await client.query(
          "SELECT * FROM participant_sessions WHERE participant_session_id = $1 FOR UPDATE", [input.participantSessionId])).rows[0]);
        const testRun = mapTestRun((await client.query(`SELECT ${testRunProjection} FROM test_runs WHERE test_run_id = $1 FOR UPDATE`, [input.testRunId])).rows[0]);
        const command = (await client.query("SELECT command_json FROM participant_run_commands WHERE test_run_id = $1 AND command_id = $2",
          [input.testRunId, input.commandId])).rows[0]?.command_json as ParticipantRunCommand | undefined;
        const terminal = command?.commandType === "complete" || command?.commandType === "complete_and_lock";
        const testRuns = terminal ? (await client.query(`SELECT ${testRunProjection} FROM test_runs WHERE participant_session_id = $1`, [input.participantSessionId]))
          .rows.map(mapTestRun).filter((run): run is TestRun => run !== null) : testRun ? [testRun] : [];
        const last = await client.query(`SELECT (command_json->>'executionSequence')::bigint AS sequence
          FROM participant_run_commands WHERE test_run_id = $1 AND command_json->>'executionSequence' IS NOT NULL
          ORDER BY (command_json->>'executionSequence')::bigint DESC LIMIT 1`, [input.testRunId]);
        const prepared = prepareParticipantRunCommandApplication(input,
          command && testRun && participantSession ? { command, testRun, participantSession, testRuns } : null,
          Number(last.rows[0]?.sequence ?? 0), transform);
        if (prepared?.effect) {
          const effect = prepared.effect;
          await persistTestRun(client, effect.testRun);
          for (const log of effect.testLogs) await client.query(`INSERT INTO participant_test_logs
            (participant_test_log_id, tenant_id, workspace_id, participant_session_id, test_run_id, unit_key, original_unit_id, log_key, log_content, timestamp, recorded_at, original_timestamp)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)`, [log.participantTestLogId, log.tenantId,
              log.workspaceId, log.participantSessionId, log.testRunId, log.unitKey, log.originalUnitId, log.logKey, log.logContent,
              log.timestamp, log.recordedAt, log.originalTimestamp ?? null]);
          for (const event of effect.activityEvents) await client.query(`INSERT INTO workspace_activity_events
            (activity_event_id, tenant_id, workspace_id, event_type, actor_id, subject_type, subject_id, occurred_at, summary, details_json)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10::jsonb)`, [event.activityEventId, event.tenantId, event.workspaceId,
              event.eventType, event.actorId, event.subjectType, event.subjectId, event.occurredAt, event.summary, JSON.stringify(event.details)]);
          if (effect.participantSession) await client.query("UPDATE participant_sessions SET status = $1 WHERE participant_session_id = $2",
            [effect.participantSession.status, input.participantSessionId]);
          await client.query("UPDATE participant_run_commands SET command_json = $1::jsonb WHERE test_run_id = $2 AND command_id = $3",
            [JSON.stringify(prepared.result.command), input.testRunId, input.commandId]);
        }
        await client.query("COMMIT");
        return prepared?.result ?? null;
      } catch (error) { await client.query("ROLLBACK"); throw error; }
      finally { client.release(); }
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
        `SELECT participant_test_log_id, tenant_id, workspace_id, participant_session_id, test_run_id, unit_key, original_unit_id, log_key, log_content, timestamp, recorded_at, original_timestamp
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
                participant_test_log_id, tenant_id, workspace_id, participant_session_id, test_run_id, unit_key, original_unit_id, log_key, log_content, timestamp, recorded_at, original_timestamp
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
              participant_test_log_id, tenant_id, workspace_id, participant_session_id, test_run_id, unit_key, original_unit_id, log_key, log_content, timestamp, recorded_at, original_timestamp
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
              recorded_at = EXCLUDED.recorded_at,
              original_timestamp = EXCLUDED.original_timestamp
            WHERE substr(participant_test_logs.participant_test_log_id, 1, 9) <> 'delivery:'`,
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
              testLog.recordedAt,
              testLog.originalTimestamp ?? null
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
    async updateParticipantPresence(input) {
      const client = await pool.connect();
      try {
        await client.query("BEGIN");
        // Lock the existing parent, including the first transition with no presence row.
        // Independent processes therefore cannot both register or log one revision.
        const run = mapTestRun((await client.query(
          `SELECT ${testRunProjection} FROM test_runs WHERE test_run_id = $1 FOR UPDATE`, [input.testRunId])).rows[0]);
        const session = mapParticipantSession((await client.query(
          "SELECT * FROM participant_sessions WHERE participant_session_id = $1", [input.participantSessionId])).rows[0]);
        const row = (await client.query(
          "SELECT presence_json FROM participant_connection_presence WHERE test_run_id = $1", [input.testRunId])).rows[0];
        const latest = (await client.query(`SELECT MAX(timestamp) AS timestamp FROM participant_test_logs
          WHERE test_run_id = $1 AND unit_key IS NULL AND log_key = 'CONNECTION'`, [input.testRunId])).rows[0];
        const result = transitionParticipantPresence(input,
          row ? row.presence_json as ParticipantPresence : null, run, session, Number(latest?.timestamp ?? 0));
        if (result.presence) {
          await client.query(`INSERT INTO participant_connection_presence
            (test_run_id, participant_session_id, presence_json, next_expiry) VALUES ($1, $2, $3::jsonb, $4)
            ON CONFLICT(test_run_id) DO UPDATE SET presence_json = EXCLUDED.presence_json,
              next_expiry = EXCLUDED.next_expiry`, [input.testRunId,
            result.presence.participantSessionId, JSON.stringify(result.presence), result.presence.nextExpiry]);
        } else await client.query("DELETE FROM participant_connection_presence WHERE test_run_id = $1", [input.testRunId]);
        if (result.testLog) {
          const log = result.testLog;
          await client.query(`INSERT INTO participant_test_logs
            (participant_test_log_id, tenant_id, workspace_id, participant_session_id, test_run_id,
             unit_key, original_unit_id, log_key, log_content, timestamp, recorded_at, original_timestamp)
            VALUES ($1, $2, $3, $4, $5, NULL, NULL, 'CONNECTION', $6, $7, $8, $9)`,
            [log.participantTestLogId, log.tenantId, log.workspaceId, log.participantSessionId,
             log.testRunId, log.logContent, log.timestamp, log.recordedAt, log.originalTimestamp ?? null]);
        }
        await client.query("COMMIT");
        return result;
      } catch (error) {
        await client.query("ROLLBACK");
        throw error;
      } finally { client.release(); }
    },
    async listExpiredParticipantPresence(timestamp, limit) {
      const result = await pool.query(`SELECT test_run_id, participant_session_id FROM participant_connection_presence
        WHERE next_expiry <= $1 ORDER BY next_expiry, test_run_id LIMIT $2`, [timestamp, limit]);
      return result.rows.map(row => ({
        testRunId: String(row.test_run_id), participantSessionId: String(row.participant_session_id)
      }));
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
