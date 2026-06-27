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

export const applyHydratedShellState = (
  target: ShellPersistenceTarget,
  snapshot: Partial<PersistedShellState>
): void => {
  target.tenantKey = snapshot.tenantKey ?? target.tenantKey;
  target.workspaceKey = snapshot.workspaceKey ?? target.workspaceKey;
  target.sourceFileName = snapshot.sourceFileName ?? target.sourceFileName;
  target.sourceMediaType = snapshot.sourceMediaType ?? target.sourceMediaType;
  target.sourceDocument = snapshot.sourceDocument ?? target.sourceDocument;
  target.sourcePackageId = snapshot.sourcePackageId ?? target.sourcePackageId;
  target.importJobId = snapshot.importJobId ?? target.importJobId;
  target.contentReleaseId = snapshot.contentReleaseId ?? target.contentReleaseId;
  target.sourcePackageStatusFilter =
    snapshot.sourcePackageStatusFilter ?? target.sourcePackageStatusFilter;
  target.sourcePackageMediaTypeFilter =
    snapshot.sourcePackageMediaTypeFilter ?? target.sourcePackageMediaTypeFilter;
  target.sourcePackageFileNameFilter =
    snapshot.sourcePackageFileNameFilter ?? target.sourcePackageFileNameFilter;
  target.sourcePackageLatestImportStatusFilter =
    snapshot.sourcePackageLatestImportStatusFilter ??
    target.sourcePackageLatestImportStatusFilter;
  target.sourcePackageLimit =
    snapshot.sourcePackageLimit ?? target.sourcePackageLimit;
  target.importJobStatusFilter =
    snapshot.importJobStatusFilter ?? target.importJobStatusFilter;
  target.importJobSourcePackageFilter =
    snapshot.importJobSourcePackageFilter ?? target.importJobSourcePackageFilter;
  target.importJobLimit = snapshot.importJobLimit ?? target.importJobLimit;
  target.contentReleaseStatusFilter =
    snapshot.contentReleaseStatusFilter ?? target.contentReleaseStatusFilter;
  target.contentReleaseImportJobFilter =
    snapshot.contentReleaseImportJobFilter ?? target.contentReleaseImportJobFilter;
  target.contentReleaseSourcePackageFilter =
    snapshot.contentReleaseSourcePackageFilter ??
    target.contentReleaseSourcePackageFilter;
  target.contentReleaseLimit =
    snapshot.contentReleaseLimit ?? target.contentReleaseLimit;
  target.participantSessionId = snapshot.participantSessionId ?? target.participantSessionId;
  target.testRunId = snapshot.testRunId ?? target.testRunId;
  target.currentUnitKey = snapshot.currentUnitKey ?? target.currentUnitKey;
  target.loginKey = snapshot.loginKey ?? target.loginKey;
  target.groupKey = snapshot.groupKey ?? target.groupKey;
  target.participantSessionStatusFilter =
    snapshot.participantSessionStatusFilter ??
    target.participantSessionStatusFilter;
  target.participantSessionGroupFilter =
    snapshot.participantSessionGroupFilter ?? target.participantSessionGroupFilter;
  target.participantSessionLoginFilter =
    snapshot.participantSessionLoginFilter ?? target.participantSessionLoginFilter;
  target.participantSessionReleaseFilter =
    snapshot.participantSessionReleaseFilter ??
    target.participantSessionReleaseFilter;
  target.participantSessionLimit =
    snapshot.participantSessionLimit ?? target.participantSessionLimit;
  target.autoRefreshEnabled = snapshot.autoRefreshEnabled ?? target.autoRefreshEnabled;
  target.autoRefreshSeconds = snapshot.autoRefreshSeconds ?? target.autoRefreshSeconds;
  target.workspaceActivityEventType =
    snapshot.workspaceActivityEventType ?? target.workspaceActivityEventType;
  target.workspaceActivitySubjectType =
    snapshot.workspaceActivitySubjectType ?? target.workspaceActivitySubjectType;
  target.workspaceActivitySubjectId =
    snapshot.workspaceActivitySubjectId ?? target.workspaceActivitySubjectId;
  target.workspaceActivityLimit =
    snapshot.workspaceActivityLimit ?? target.workspaceActivityLimit;
  target.forceActivation = snapshot.forceActivation ?? target.forceActivation;
  target.adminUsername = snapshot.adminUsername ?? target.adminUsername;
  target.adminDisplayName = snapshot.adminDisplayName ?? target.adminDisplayName;
  target.adminSessionToken = snapshot.adminSessionToken ?? target.adminSessionToken;
  target.adminCreateUsername =
    snapshot.adminCreateUsername ?? target.adminCreateUsername;
  target.adminCreateDisplayName =
    snapshot.adminCreateDisplayName ?? target.adminCreateDisplayName;
  target.adminCreateRole = snapshot.adminCreateRole ?? target.adminCreateRole;
  target.adminCreateTenantKey =
    snapshot.adminCreateTenantKey ?? target.adminCreateTenantKey;
  target.adminCreateWorkspaceKey =
    snapshot.adminCreateWorkspaceKey ?? target.adminCreateWorkspaceKey;
  target.adminRoleTargetUserId =
    snapshot.adminRoleTargetUserId ?? target.adminRoleTargetUserId;
  target.adminRoleRole = snapshot.adminRoleRole ?? target.adminRoleRole;
  target.adminRoleTenantKey =
    snapshot.adminRoleTenantKey ?? target.adminRoleTenantKey;
  target.adminRoleWorkspaceKey =
    snapshot.adminRoleWorkspaceKey ?? target.adminRoleWorkspaceKey;
  target.adminRevokeTargetUserId =
    snapshot.adminRevokeTargetUserId ?? target.adminRevokeTargetUserId;
  target.adminRevokeRoleAssignmentId =
    snapshot.adminRevokeRoleAssignmentId ?? target.adminRevokeRoleAssignmentId;
  target.adminStatusTargetUserId =
    snapshot.adminStatusTargetUserId ?? target.adminStatusTargetUserId;
  target.adminStatusValue = snapshot.adminStatusValue ?? target.adminStatusValue;
  target.adminResetTargetUserId =
    snapshot.adminResetTargetUserId ?? target.adminResetTargetUserId;
  target.showRawDebug = snapshot.showRawDebug ?? target.showRawDebug;
  target.activeView = snapshot.activeView ?? target.activeView;
};
