import type { AppView, PersistedShellState } from "./rewrite-app-shell.types";
import type {
  AdminRole,
  AdminSessionStatus,
  AdminUserStatus
} from "@testcenter-rewrite-app/domain";

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
  monitorTimeSeconds: string;
  loginKey: string;
  groupKey: string;
  bookletKey: string;
  participantSessionStatusFilter: string;
  participantSessionGroupFilter: string;
  participantSessionLoginFilter: string;
  participantSessionBookletFilter: string;
  participantSessionReleaseFilter: string;
  participantSessionLimit: string;
  detailedResponseLoginFilter: string;
  detailedResponseGroupFilter: string;
  detailedResponseBookletFilter: string;
  detailedResponseSessionFilter: string;
  detailedResponseRunFilter: string;
  detailedResponseUnitFilter: string;
  detailedResponseStatusFilter: string;
  detailedResponseLimit: string;
  reviewLoginFilter: string;
  reviewGroupFilter: string;
  reviewBookletFilter: string;
  reviewSessionFilter: string;
  reviewRunFilter: string;
  reviewUnitFilter: string;
  reviewReviewerFilter: string;
  reviewCategoryFilter: string;
  reviewLimit: string;
  openRunLoginFilter: string;
  openRunGroupFilter: string;
  openRunBookletFilter: string;
  openRunSessionFilter: string;
  openRunRunFilter: string;
  openRunUnitFilter: string;
  openRunStatusFilter: string;
  openRunLimit: string;
  monitorCommandHistoryRunFilter: string;
  monitorCommandHistoryLimit: string;
  entryRosterText: string;
  entryLinksView: string;
  participantRosterView: string;
  participantRosterExportView: string;
  autoRefreshEnabled: boolean;
  autoRefreshSeconds: number;
  workspaceActivityEventType: string;
  workspaceActivitySubjectType: string;
  workspaceActivitySubjectId: string;
  workspaceActivityLimit: string;
  studyMonitorMatrixLoginFilter: string;
  studyMonitorMatrixGroupFilter: string;
  studyMonitorMatrixBookletFilter: string;
  studyMonitorMatrixUnitFilter: string;
  studyMonitorMatrixStatusFilter: string;
  studyMonitorMatrixAnswerFilter: string;
  studyMonitorMatrixLimit: string;
  forceActivation: boolean;
  adminUsername: string;
  adminDisplayName: string;
  adminSessionToken: string;
  adminSessionUserFilter: string;
  adminSessionStatusFilter: "" | AdminSessionStatus;
  adminSessionLimit: string;
  adminSessionRevokeTargetId: string;
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
  adminCreateGroupKey: string;
  adminCreateValidFrom: string;
  adminCreateValidTo: string;
  adminCreateValidForMinutes: string;
  adminRoleTargetUserId: string;
  adminRoleRole: AdminRole;
  adminRoleTenantKey: string;
  adminRoleWorkspaceKey: string;
  adminRoleGroupKey: string;
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
  monitorTimeSeconds: target.monitorTimeSeconds,
  loginKey: target.loginKey,
  groupKey: target.groupKey,
  bookletKey: target.bookletKey,
  participantSessionStatusFilter: target.participantSessionStatusFilter,
  participantSessionGroupFilter: target.participantSessionGroupFilter,
  participantSessionLoginFilter: target.participantSessionLoginFilter,
  participantSessionBookletFilter: target.participantSessionBookletFilter,
  participantSessionReleaseFilter: target.participantSessionReleaseFilter,
  participantSessionLimit: target.participantSessionLimit,
  detailedResponseLoginFilter: target.detailedResponseLoginFilter,
  detailedResponseGroupFilter: target.detailedResponseGroupFilter,
  detailedResponseBookletFilter: target.detailedResponseBookletFilter,
  detailedResponseSessionFilter: target.detailedResponseSessionFilter,
  detailedResponseRunFilter: target.detailedResponseRunFilter,
  detailedResponseUnitFilter: target.detailedResponseUnitFilter,
  detailedResponseStatusFilter: target.detailedResponseStatusFilter,
  detailedResponseLimit: target.detailedResponseLimit,
  reviewLoginFilter: target.reviewLoginFilter,
  reviewGroupFilter: target.reviewGroupFilter,
  reviewBookletFilter: target.reviewBookletFilter,
  reviewSessionFilter: target.reviewSessionFilter,
  reviewRunFilter: target.reviewRunFilter,
  reviewUnitFilter: target.reviewUnitFilter,
  reviewReviewerFilter: target.reviewReviewerFilter,
  reviewCategoryFilter: target.reviewCategoryFilter,
  reviewLimit: target.reviewLimit,
  openRunLoginFilter: target.openRunLoginFilter,
  openRunGroupFilter: target.openRunGroupFilter,
  openRunBookletFilter: target.openRunBookletFilter,
  openRunSessionFilter: target.openRunSessionFilter,
  openRunRunFilter: target.openRunRunFilter,
  openRunUnitFilter: target.openRunUnitFilter,
  openRunStatusFilter: target.openRunStatusFilter,
  openRunLimit: target.openRunLimit,
  monitorCommandHistoryRunFilter: target.monitorCommandHistoryRunFilter,
  monitorCommandHistoryLimit: target.monitorCommandHistoryLimit,
  entryRosterText: target.entryRosterText,
  entryLinksView: target.entryLinksView,
  participantRosterView: target.participantRosterView,
  participantRosterExportView: target.participantRosterExportView,
  autoRefreshEnabled: target.autoRefreshEnabled,
  autoRefreshSeconds: target.autoRefreshSeconds,
  workspaceActivityEventType: target.workspaceActivityEventType,
  workspaceActivitySubjectType: target.workspaceActivitySubjectType,
  workspaceActivitySubjectId: target.workspaceActivitySubjectId,
  workspaceActivityLimit: target.workspaceActivityLimit,
  studyMonitorMatrixLoginFilter: target.studyMonitorMatrixLoginFilter,
  studyMonitorMatrixGroupFilter: target.studyMonitorMatrixGroupFilter,
  studyMonitorMatrixBookletFilter: target.studyMonitorMatrixBookletFilter,
  studyMonitorMatrixUnitFilter: target.studyMonitorMatrixUnitFilter,
  studyMonitorMatrixStatusFilter: target.studyMonitorMatrixStatusFilter,
  studyMonitorMatrixAnswerFilter: target.studyMonitorMatrixAnswerFilter,
  studyMonitorMatrixLimit: target.studyMonitorMatrixLimit,
  forceActivation: target.forceActivation,
  adminUsername: target.adminUsername,
  adminDisplayName: target.adminDisplayName,
  adminSessionToken: target.adminSessionToken,
  adminSessionUserFilter: target.adminSessionUserFilter,
  adminSessionStatusFilter: target.adminSessionStatusFilter,
  adminSessionLimit: target.adminSessionLimit,
  adminSessionRevokeTargetId: target.adminSessionRevokeTargetId,
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
  adminCreateGroupKey: target.adminCreateGroupKey,
  adminCreateValidFrom: target.adminCreateValidFrom,
  adminCreateValidTo: target.adminCreateValidTo,
  adminCreateValidForMinutes: target.adminCreateValidForMinutes,
  adminRoleTargetUserId: target.adminRoleTargetUserId,
  adminRoleRole: target.adminRoleRole,
  adminRoleTenantKey: target.adminRoleTenantKey,
  adminRoleWorkspaceKey: target.adminRoleWorkspaceKey,
  adminRoleGroupKey: target.adminRoleGroupKey,
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
  target.monitorTimeSeconds = hydrateString(
    snapshot.monitorTimeSeconds,
    target.monitorTimeSeconds
  );
  target.loginKey = hydrateString(snapshot.loginKey, target.loginKey);
  target.groupKey = hydrateString(snapshot.groupKey, target.groupKey);
  target.bookletKey = hydrateString(snapshot.bookletKey, target.bookletKey);
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
  target.participantSessionBookletFilter =
    hydrateString(
      snapshot.participantSessionBookletFilter,
      target.participantSessionBookletFilter
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
  target.detailedResponseLoginFilter = hydrateString(
    snapshot.detailedResponseLoginFilter,
    target.detailedResponseLoginFilter
  );
  target.detailedResponseGroupFilter = hydrateString(
    snapshot.detailedResponseGroupFilter,
    target.detailedResponseGroupFilter
  );
  target.detailedResponseBookletFilter = hydrateString(
    snapshot.detailedResponseBookletFilter,
    target.detailedResponseBookletFilter
  );
  target.detailedResponseSessionFilter = hydrateString(
    snapshot.detailedResponseSessionFilter,
    target.detailedResponseSessionFilter
  );
  target.detailedResponseRunFilter = hydrateString(
    snapshot.detailedResponseRunFilter,
    target.detailedResponseRunFilter
  );
  target.detailedResponseUnitFilter = hydrateString(
    snapshot.detailedResponseUnitFilter,
    target.detailedResponseUnitFilter
  );
  target.detailedResponseStatusFilter = hydrateString(
    snapshot.detailedResponseStatusFilter,
    target.detailedResponseStatusFilter
  );
  target.detailedResponseLimit = hydrateString(
    snapshot.detailedResponseLimit,
    target.detailedResponseLimit
  );
  target.reviewLoginFilter = hydrateString(
    snapshot.reviewLoginFilter,
    target.reviewLoginFilter
  );
  target.reviewGroupFilter = hydrateString(
    snapshot.reviewGroupFilter,
    target.reviewGroupFilter
  );
  target.reviewBookletFilter = hydrateString(
    snapshot.reviewBookletFilter,
    target.reviewBookletFilter
  );
  target.reviewSessionFilter = hydrateString(
    snapshot.reviewSessionFilter,
    target.reviewSessionFilter
  );
  target.reviewRunFilter = hydrateString(
    snapshot.reviewRunFilter,
    target.reviewRunFilter
  );
  target.reviewUnitFilter = hydrateString(
    snapshot.reviewUnitFilter,
    target.reviewUnitFilter
  );
  target.reviewReviewerFilter = hydrateString(
    snapshot.reviewReviewerFilter,
    target.reviewReviewerFilter
  );
  target.reviewCategoryFilter = hydrateString(
    snapshot.reviewCategoryFilter,
    target.reviewCategoryFilter
  );
  target.reviewLimit = hydrateString(snapshot.reviewLimit, target.reviewLimit);
  target.openRunLoginFilter = hydrateString(
    snapshot.openRunLoginFilter,
    target.openRunLoginFilter
  );
  target.openRunGroupFilter = hydrateString(
    snapshot.openRunGroupFilter,
    target.openRunGroupFilter
  );
  target.openRunBookletFilter = hydrateString(
    snapshot.openRunBookletFilter,
    target.openRunBookletFilter
  );
  target.openRunSessionFilter = hydrateString(
    snapshot.openRunSessionFilter,
    target.openRunSessionFilter
  );
  target.openRunRunFilter = hydrateString(
    snapshot.openRunRunFilter,
    target.openRunRunFilter
  );
  target.openRunUnitFilter = hydrateString(
    snapshot.openRunUnitFilter,
    target.openRunUnitFilter
  );
  target.openRunStatusFilter = hydrateString(
    snapshot.openRunStatusFilter,
    target.openRunStatusFilter
  );
  target.openRunLimit = hydrateString(snapshot.openRunLimit, target.openRunLimit);
  target.monitorCommandHistoryRunFilter = hydrateString(
    snapshot.monitorCommandHistoryRunFilter,
    target.monitorCommandHistoryRunFilter
  );
  target.monitorCommandHistoryLimit = hydrateString(
    snapshot.monitorCommandHistoryLimit,
    target.monitorCommandHistoryLimit
  );
  target.entryRosterText = hydrateString(
    snapshot.entryRosterText,
    target.entryRosterText
  );
  target.entryLinksView = hydrateString(
    snapshot.entryLinksView,
    target.entryLinksView
  );
  target.participantRosterView = hydrateString(
    snapshot.participantRosterView,
    target.participantRosterView
  );
  target.participantRosterExportView = hydrateString(
    snapshot.participantRosterExportView,
    target.participantRosterExportView
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
  target.studyMonitorMatrixLoginFilter = hydrateString(
    snapshot.studyMonitorMatrixLoginFilter,
    target.studyMonitorMatrixLoginFilter
  );
  target.studyMonitorMatrixGroupFilter = hydrateString(
    snapshot.studyMonitorMatrixGroupFilter,
    target.studyMonitorMatrixGroupFilter
  );
  target.studyMonitorMatrixBookletFilter = hydrateString(
    snapshot.studyMonitorMatrixBookletFilter,
    target.studyMonitorMatrixBookletFilter
  );
  target.studyMonitorMatrixUnitFilter = hydrateString(
    snapshot.studyMonitorMatrixUnitFilter,
    target.studyMonitorMatrixUnitFilter
  );
  target.studyMonitorMatrixStatusFilter = hydrateString(
    snapshot.studyMonitorMatrixStatusFilter,
    target.studyMonitorMatrixStatusFilter
  );
  target.studyMonitorMatrixAnswerFilter = hydrateString(
    snapshot.studyMonitorMatrixAnswerFilter,
    target.studyMonitorMatrixAnswerFilter
  );
  target.studyMonitorMatrixLimit = hydrateString(
    snapshot.studyMonitorMatrixLimit,
    target.studyMonitorMatrixLimit
  );
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
  target.adminSessionUserFilter = hydrateString(
    snapshot.adminSessionUserFilter,
    target.adminSessionUserFilter
  );
  target.adminSessionStatusFilter =
    snapshot.adminSessionStatusFilter ?? target.adminSessionStatusFilter;
  target.adminSessionLimit = hydrateString(
    snapshot.adminSessionLimit,
    target.adminSessionLimit
  );
  target.adminSessionRevokeTargetId = hydrateString(
    snapshot.adminSessionRevokeTargetId,
    target.adminSessionRevokeTargetId
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
  target.adminCreateGroupKey =
    hydrateString(snapshot.adminCreateGroupKey, target.adminCreateGroupKey);
  target.adminCreateValidFrom = hydrateString(
    snapshot.adminCreateValidFrom,
    target.adminCreateValidFrom
  );
  target.adminCreateValidTo = hydrateString(
    snapshot.adminCreateValidTo,
    target.adminCreateValidTo
  );
  target.adminCreateValidForMinutes = hydrateString(
    snapshot.adminCreateValidForMinutes,
    target.adminCreateValidForMinutes
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
  target.adminRoleGroupKey =
    hydrateString(snapshot.adminRoleGroupKey, target.adminRoleGroupKey);
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
