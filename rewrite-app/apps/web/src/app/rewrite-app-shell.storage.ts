import type { AppView, PersistedShellState } from "./rewrite-app-shell.types";
import type { AdminRole, AdminUserStatus } from "@testcenter-rewrite-app/domain";

export type ShellPersistenceTarget = {
  tenantKey: string;
  workspaceKey: string;
  sourceFileName: string;
  sourceMediaType: string;
  sourceDocument: string;
  sourcePackageId: string;
  importJobId: string;
  contentReleaseId: string;
  sourcePackageStatusFilter: string;
  sourcePackageMediaTypeFilter: string;
  sourcePackageFileNameFilter: string;
  sourcePackageLatestImportStatusFilter: string;
  sourcePackageLimit: string;
  importJobStatusFilter: string;
  importJobSourcePackageFilter: string;
  importJobLimit: string;
  contentReleaseStatusFilter: string;
  contentReleaseImportJobFilter: string;
  contentReleaseSourcePackageFilter: string;
  contentReleaseLimit: string;
  participantSessionId: string;
  testRunId: string;
  currentUnitKey: string;
  loginKey: string;
  groupKey: string;
  participantSessionStatusFilter: string;
  participantSessionGroupFilter: string;
  participantSessionLoginFilter: string;
  participantSessionReleaseFilter: string;
  participantSessionLimit: string;
  autoRefreshEnabled: boolean;
  autoRefreshSeconds: number;
  workspaceActivityEventType: string;
  workspaceActivitySubjectType: string;
  workspaceActivitySubjectId: string;
  workspaceActivityLimit: string;
  forceActivation: boolean;
  adminUsername: string;
  adminDisplayName: string;
  adminSessionToken: string;
  adminUserUsernameFilter: string;
  adminUserStatusFilter: string;
  adminUserRoleFilter: string;
  adminUserTenantFilter: string;
  adminUserWorkspaceFilter: string;
  adminUserLimit: string;
  adminAuditEventTypeFilter: string;
  adminAuditActorFilter: string;
  adminAuditSubjectFilter: string;
  adminAuditLimit: string;
  adminCreateUsername: string;
  adminCreateDisplayName: string;
  adminCreateRole: AdminRole;
  adminCreateTenantKey: string;
  adminCreateWorkspaceKey: string;
  adminRoleTargetUserId: string;
  adminRoleRole: AdminRole;
  adminRoleTenantKey: string;
  adminRoleWorkspaceKey: string;
  adminRevokeTargetUserId: string;
  adminRevokeRoleAssignmentId: string;
  adminStatusTargetUserId: string;
  adminStatusValue: AdminUserStatus;
  adminResetTargetUserId: string;
  showRawDebug: boolean;
  activeView: AppView;
};

export const createPersistedShellState = (
  target: ShellPersistenceTarget
): PersistedShellState => ({
  tenantKey: target.tenantKey,
  workspaceKey: target.workspaceKey,
  sourceFileName: target.sourceFileName,
  sourceMediaType: target.sourceMediaType,
  sourceDocument: target.sourceDocument,
  sourcePackageId: target.sourcePackageId,
  importJobId: target.importJobId,
  contentReleaseId: target.contentReleaseId,
  sourcePackageStatusFilter: target.sourcePackageStatusFilter,
  sourcePackageMediaTypeFilter: target.sourcePackageMediaTypeFilter,
  sourcePackageFileNameFilter: target.sourcePackageFileNameFilter,
  sourcePackageLatestImportStatusFilter:
    target.sourcePackageLatestImportStatusFilter,
  sourcePackageLimit: target.sourcePackageLimit,
  importJobStatusFilter: target.importJobStatusFilter,
  importJobSourcePackageFilter: target.importJobSourcePackageFilter,
  importJobLimit: target.importJobLimit,
  contentReleaseStatusFilter: target.contentReleaseStatusFilter,
  contentReleaseImportJobFilter: target.contentReleaseImportJobFilter,
  contentReleaseSourcePackageFilter: target.contentReleaseSourcePackageFilter,
  contentReleaseLimit: target.contentReleaseLimit,
  participantSessionId: target.participantSessionId,
  testRunId: target.testRunId,
  currentUnitKey: target.currentUnitKey,
  loginKey: target.loginKey,
  groupKey: target.groupKey,
  participantSessionStatusFilter: target.participantSessionStatusFilter,
  participantSessionGroupFilter: target.participantSessionGroupFilter,
  participantSessionLoginFilter: target.participantSessionLoginFilter,
  participantSessionReleaseFilter: target.participantSessionReleaseFilter,
  participantSessionLimit: target.participantSessionLimit,
  autoRefreshEnabled: target.autoRefreshEnabled,
  autoRefreshSeconds: target.autoRefreshSeconds,
  workspaceActivityEventType: target.workspaceActivityEventType,
  workspaceActivitySubjectType: target.workspaceActivitySubjectType,
  workspaceActivitySubjectId: target.workspaceActivitySubjectId,
  workspaceActivityLimit: target.workspaceActivityLimit,
  forceActivation: target.forceActivation,
  adminUsername: target.adminUsername,
  adminDisplayName: target.adminDisplayName,
  adminSessionToken: target.adminSessionToken,
  adminUserUsernameFilter: target.adminUserUsernameFilter,
  adminUserStatusFilter: target.adminUserStatusFilter,
  adminUserRoleFilter: target.adminUserRoleFilter,
  adminUserTenantFilter: target.adminUserTenantFilter,
  adminUserWorkspaceFilter: target.adminUserWorkspaceFilter,
  adminUserLimit: target.adminUserLimit,
  adminAuditEventTypeFilter: target.adminAuditEventTypeFilter,
  adminAuditActorFilter: target.adminAuditActorFilter,
  adminAuditSubjectFilter: target.adminAuditSubjectFilter,
  adminAuditLimit: target.adminAuditLimit,
  adminCreateUsername: target.adminCreateUsername,
  adminCreateDisplayName: target.adminCreateDisplayName,
  adminCreateRole: target.adminCreateRole,
  adminCreateTenantKey: target.adminCreateTenantKey,
  adminCreateWorkspaceKey: target.adminCreateWorkspaceKey,
  adminRoleTargetUserId: target.adminRoleTargetUserId,
  adminRoleRole: target.adminRoleRole,
  adminRoleTenantKey: target.adminRoleTenantKey,
  adminRoleWorkspaceKey: target.adminRoleWorkspaceKey,
  adminRevokeTargetUserId: target.adminRevokeTargetUserId,
  adminRevokeRoleAssignmentId: target.adminRevokeRoleAssignmentId,
  adminStatusTargetUserId: target.adminStatusTargetUserId,
  adminStatusValue: target.adminStatusValue,
  adminResetTargetUserId: target.adminResetTargetUserId,
  showRawDebug: target.showRawDebug,
  activeView: target.activeView
});

const hydrateString = (value: unknown, fallback: string): string => {
  if (typeof value === "string") {
    return value;
  }

  if (typeof value === "number" || typeof value === "boolean") {
    return String(value);
  }

  return fallback;
};

export const applyHydratedShellState = (
  target: ShellPersistenceTarget,
  snapshot: Partial<PersistedShellState>
): void => {
  target.tenantKey = hydrateString(snapshot.tenantKey, target.tenantKey);
  target.workspaceKey = hydrateString(snapshot.workspaceKey, target.workspaceKey);
  target.sourceFileName = hydrateString(
    snapshot.sourceFileName,
    target.sourceFileName
  );
  target.sourceMediaType = hydrateString(
    snapshot.sourceMediaType,
    target.sourceMediaType
  );
  target.sourceDocument = hydrateString(
    snapshot.sourceDocument,
    target.sourceDocument
  );
  target.sourcePackageId = hydrateString(
    snapshot.sourcePackageId,
    target.sourcePackageId
  );
  target.importJobId = hydrateString(snapshot.importJobId, target.importJobId);
  target.contentReleaseId = hydrateString(
    snapshot.contentReleaseId,
    target.contentReleaseId
  );
  target.sourcePackageStatusFilter =
    hydrateString(
      snapshot.sourcePackageStatusFilter,
      target.sourcePackageStatusFilter
    );
  target.sourcePackageMediaTypeFilter =
    hydrateString(
      snapshot.sourcePackageMediaTypeFilter,
      target.sourcePackageMediaTypeFilter
    );
  target.sourcePackageFileNameFilter =
    hydrateString(
      snapshot.sourcePackageFileNameFilter,
      target.sourcePackageFileNameFilter
    );
  target.sourcePackageLatestImportStatusFilter =
    hydrateString(
      snapshot.sourcePackageLatestImportStatusFilter,
      target.sourcePackageLatestImportStatusFilter
    );
  target.sourcePackageLimit =
    hydrateString(snapshot.sourcePackageLimit, target.sourcePackageLimit);
  target.importJobStatusFilter =
    hydrateString(snapshot.importJobStatusFilter, target.importJobStatusFilter);
  target.importJobSourcePackageFilter =
    hydrateString(
      snapshot.importJobSourcePackageFilter,
      target.importJobSourcePackageFilter
    );
  target.importJobLimit = hydrateString(
    snapshot.importJobLimit,
    target.importJobLimit
  );
  target.contentReleaseStatusFilter =
    hydrateString(
      snapshot.contentReleaseStatusFilter,
      target.contentReleaseStatusFilter
    );
  target.contentReleaseImportJobFilter =
    hydrateString(
      snapshot.contentReleaseImportJobFilter,
      target.contentReleaseImportJobFilter
    );
  target.contentReleaseSourcePackageFilter =
    hydrateString(
      snapshot.contentReleaseSourcePackageFilter,
      target.contentReleaseSourcePackageFilter
    );
  target.contentReleaseLimit =
    hydrateString(snapshot.contentReleaseLimit, target.contentReleaseLimit);
  target.participantSessionId = hydrateString(
    snapshot.participantSessionId,
    target.participantSessionId
  );
  target.testRunId = hydrateString(snapshot.testRunId, target.testRunId);
  target.currentUnitKey = hydrateString(
    snapshot.currentUnitKey,
    target.currentUnitKey
  );
  target.loginKey = hydrateString(snapshot.loginKey, target.loginKey);
  target.groupKey = hydrateString(snapshot.groupKey, target.groupKey);
  target.participantSessionStatusFilter =
    hydrateString(
      snapshot.participantSessionStatusFilter,
      target.participantSessionStatusFilter
    );
  target.participantSessionGroupFilter =
    hydrateString(
      snapshot.participantSessionGroupFilter,
      target.participantSessionGroupFilter
    );
  target.participantSessionLoginFilter =
    hydrateString(
      snapshot.participantSessionLoginFilter,
      target.participantSessionLoginFilter
    );
  target.participantSessionReleaseFilter =
    hydrateString(
      snapshot.participantSessionReleaseFilter,
      target.participantSessionReleaseFilter
    );
  target.participantSessionLimit =
    hydrateString(
      snapshot.participantSessionLimit,
      target.participantSessionLimit
    );
  target.autoRefreshEnabled = snapshot.autoRefreshEnabled ?? target.autoRefreshEnabled;
  target.autoRefreshSeconds = snapshot.autoRefreshSeconds ?? target.autoRefreshSeconds;
  target.workspaceActivityEventType =
    hydrateString(
      snapshot.workspaceActivityEventType,
      target.workspaceActivityEventType
    );
  target.workspaceActivitySubjectType =
    hydrateString(
      snapshot.workspaceActivitySubjectType,
      target.workspaceActivitySubjectType
    );
  target.workspaceActivitySubjectId =
    hydrateString(
      snapshot.workspaceActivitySubjectId,
      target.workspaceActivitySubjectId
    );
  target.workspaceActivityLimit =
    hydrateString(snapshot.workspaceActivityLimit, target.workspaceActivityLimit);
  target.forceActivation = snapshot.forceActivation ?? target.forceActivation;
  target.adminUsername = hydrateString(
    snapshot.adminUsername,
    target.adminUsername
  );
  target.adminDisplayName = hydrateString(
    snapshot.adminDisplayName,
    target.adminDisplayName
  );
  target.adminSessionToken = hydrateString(
    snapshot.adminSessionToken,
    target.adminSessionToken
  );
  target.adminUserUsernameFilter = hydrateString(
    snapshot.adminUserUsernameFilter,
    target.adminUserUsernameFilter
  );
  target.adminUserStatusFilter = hydrateString(
    snapshot.adminUserStatusFilter,
    target.adminUserStatusFilter
  );
  target.adminUserRoleFilter = hydrateString(
    snapshot.adminUserRoleFilter,
    target.adminUserRoleFilter
  );
  target.adminUserTenantFilter = hydrateString(
    snapshot.adminUserTenantFilter,
    target.adminUserTenantFilter
  );
  target.adminUserWorkspaceFilter = hydrateString(
    snapshot.adminUserWorkspaceFilter,
    target.adminUserWorkspaceFilter
  );
  target.adminUserLimit = hydrateString(
    snapshot.adminUserLimit,
    target.adminUserLimit
  );
  target.adminAuditEventTypeFilter = hydrateString(
    snapshot.adminAuditEventTypeFilter,
    target.adminAuditEventTypeFilter
  );
  target.adminAuditActorFilter = hydrateString(
    snapshot.adminAuditActorFilter,
    target.adminAuditActorFilter
  );
  target.adminAuditSubjectFilter = hydrateString(
    snapshot.adminAuditSubjectFilter,
    target.adminAuditSubjectFilter
  );
  target.adminAuditLimit = hydrateString(
    snapshot.adminAuditLimit,
    target.adminAuditLimit
  );
  target.adminCreateUsername =
    hydrateString(snapshot.adminCreateUsername, target.adminCreateUsername);
  target.adminCreateDisplayName =
    hydrateString(
      snapshot.adminCreateDisplayName,
      target.adminCreateDisplayName
    );
  target.adminCreateRole = snapshot.adminCreateRole ?? target.adminCreateRole;
  target.adminCreateTenantKey =
    hydrateString(snapshot.adminCreateTenantKey, target.adminCreateTenantKey);
  target.adminCreateWorkspaceKey =
    hydrateString(
      snapshot.adminCreateWorkspaceKey,
      target.adminCreateWorkspaceKey
    );
  target.adminRoleTargetUserId =
    hydrateString(snapshot.adminRoleTargetUserId, target.adminRoleTargetUserId);
  target.adminRoleRole = snapshot.adminRoleRole ?? target.adminRoleRole;
  target.adminRoleTenantKey =
    hydrateString(snapshot.adminRoleTenantKey, target.adminRoleTenantKey);
  target.adminRoleWorkspaceKey =
    hydrateString(
      snapshot.adminRoleWorkspaceKey,
      target.adminRoleWorkspaceKey
    );
  target.adminRevokeTargetUserId =
    hydrateString(
      snapshot.adminRevokeTargetUserId,
      target.adminRevokeTargetUserId
    );
  target.adminRevokeRoleAssignmentId =
    hydrateString(
      snapshot.adminRevokeRoleAssignmentId,
      target.adminRevokeRoleAssignmentId
    );
  target.adminStatusTargetUserId =
    hydrateString(
      snapshot.adminStatusTargetUserId,
      target.adminStatusTargetUserId
    );
  target.adminStatusValue = snapshot.adminStatusValue ?? target.adminStatusValue;
  target.adminResetTargetUserId =
    hydrateString(snapshot.adminResetTargetUserId, target.adminResetTargetUserId);
  target.showRawDebug = snapshot.showRawDebug ?? target.showRawDebug;
  target.activeView = snapshot.activeView ?? target.activeView;
};
