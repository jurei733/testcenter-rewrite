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
  participantSessionId: string;
  testRunId: string;
  currentUnitKey: string;
  loginKey: string;
  autoRefreshEnabled: boolean;
  autoRefreshSeconds: number;
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
  participantSessionId: target.participantSessionId,
  testRunId: target.testRunId,
  currentUnitKey: target.currentUnitKey,
  loginKey: target.loginKey,
  autoRefreshEnabled: target.autoRefreshEnabled,
  autoRefreshSeconds: target.autoRefreshSeconds,
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
  target.participantSessionId = snapshot.participantSessionId ?? target.participantSessionId;
  target.testRunId = snapshot.testRunId ?? target.testRunId;
  target.currentUnitKey = snapshot.currentUnitKey ?? target.currentUnitKey;
  target.loginKey = snapshot.loginKey ?? target.loginKey;
  target.autoRefreshEnabled = snapshot.autoRefreshEnabled ?? target.autoRefreshEnabled;
  target.autoRefreshSeconds = snapshot.autoRefreshSeconds ?? target.autoRefreshSeconds;
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
