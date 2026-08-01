import type { ApplicationRef, WritableSignal } from "@angular/core";

import type { ApiErrorLike } from "./rewrite-app-api.service";
import type { ShellLifecycleHost } from "./rewrite-app-shell.lifecycle";
import type { ShellRequestStateHost } from "./rewrite-app-shell.request-state";
import type {
  ShellContentState,
  ShellOpsState,
  ShellRuntimeState,
  ShellWorkspaceState
} from "./rewrite-app-shell.state";
import type { ShellPersistenceTarget } from "./rewrite-app-shell.storage";
import type { AppView } from "./rewrite-app-shell.types";

export function createShellLifecycleStateHost(args: {
  workspaceState: ShellWorkspaceState;
  contentState: ShellContentState;
  runtimeState: ShellRuntimeState;
  opsState: ShellOpsState;
  getActiveView(): AppView;
  setActiveView(nextValue: AppView): void;
  getAutoRefreshHandle(): number | null;
  setAutoRefreshHandle(nextValue: number | null): void;
  refreshWorkspaceOverview(quiet?: boolean): Promise<void>;
  refreshContentReads(quiet?: boolean): Promise<void>;
  refreshRuntimeReads(quiet?: boolean): Promise<void>;
  refreshOperationalDiagnostics(quiet?: boolean): Promise<void>;
}): ShellLifecycleHost {
  return {
    get activeView() {
      return args.getActiveView();
    },
    set activeView(nextValue) {
      args.setActiveView(nextValue);
    },
    get workspaceLoaded() {
      return args.workspaceState.workspaceLoaded;
    },
    set workspaceLoaded(nextValue) {
      args.workspaceState.workspaceLoaded = nextValue;
    },
    get contentLoaded() {
      return args.contentState.contentLoaded;
    },
    set contentLoaded(nextValue) {
      args.contentState.contentLoaded = nextValue;
    },
    get runtimeLoaded() {
      return args.runtimeState.runtimeLoaded;
    },
    set runtimeLoaded(nextValue) {
      args.runtimeState.runtimeLoaded = nextValue;
    },
    get monitorConnectionStatus() {
      return args.runtimeState.monitorConnectionStatus;
    },
    get diagnosticsLoaded() {
      return args.opsState.diagnosticsLoaded;
    },
    set diagnosticsLoaded(nextValue) {
      args.opsState.diagnosticsLoaded = nextValue;
    },
    get autoRefreshEnabled() {
      return args.workspaceState.autoRefreshEnabled;
    },
    set autoRefreshEnabled(nextValue) {
      args.workspaceState.autoRefreshEnabled = nextValue;
    },
    get autoRefreshSeconds() {
      return args.workspaceState.autoRefreshSeconds;
    },
    set autoRefreshSeconds(nextValue) {
      args.workspaceState.autoRefreshSeconds = nextValue;
    },
    get autoRefreshHandle() {
      return args.getAutoRefreshHandle();
    },
    set autoRefreshHandle(nextValue) {
      args.setAutoRefreshHandle(nextValue);
    },
    refreshWorkspaceOverview: args.refreshWorkspaceOverview,
    refreshContentReads: args.refreshContentReads,
    refreshRuntimeReads: args.refreshRuntimeReads,
    refreshOperationalDiagnostics: args.refreshOperationalDiagnostics
  };
}

export function createShellPersistenceStateHost(args: {
  workspaceState: ShellWorkspaceState;
  contentState: ShellContentState;
  runtimeState: ShellRuntimeState;
  opsState: ShellOpsState;
  getActiveView(): AppView;
  setActiveView(nextValue: AppView): void;
  getShowRawDebug(): boolean;
  setShowRawDebug(nextValue: boolean): void;
}): ShellPersistenceTarget {
  return {
    get tenantKey() {
      return args.workspaceState.tenantKey;
    },
    set tenantKey(nextValue) {
      args.workspaceState.tenantKey = nextValue;
    },
    get workspaceKey() {
      return args.workspaceState.workspaceKey;
    },
    set workspaceKey(nextValue) {
      args.workspaceState.workspaceKey = nextValue;
    },
    get sourceFileName() {
      return args.contentState.sourceFileName;
    },
    set sourceFileName(nextValue) {
      args.contentState.sourceFileName = nextValue;
    },
    get sourceMediaType() {
      return args.contentState.sourceMediaType;
    },
    set sourceMediaType(nextValue) {
      args.contentState.sourceMediaType = nextValue;
    },
    get sourceDocument() {
      return args.contentState.sourceDocument;
    },
    set sourceDocument(nextValue) {
      args.contentState.sourceDocument = nextValue;
    },
    get sourcePackageId() {
      return args.contentState.sourcePackageId;
    },
    set sourcePackageId(nextValue) {
      args.contentState.sourcePackageId = nextValue;
    },
    get importJobId() {
      return args.contentState.importJobId;
    },
    set importJobId(nextValue) {
      args.contentState.importJobId = nextValue;
    },
    get contentReleaseId() {
      return args.contentState.contentReleaseId;
    },
    set contentReleaseId(nextValue) {
      args.contentState.contentReleaseId = nextValue;
    },
    get sourcePackageStatusFilter() {
      return args.contentState.sourcePackageStatusFilter;
    },
    set sourcePackageStatusFilter(nextValue) {
      args.contentState.sourcePackageStatusFilter = nextValue;
    },
    get sourcePackageMediaTypeFilter() {
      return args.contentState.sourcePackageMediaTypeFilter;
    },
    set sourcePackageMediaTypeFilter(nextValue) {
      args.contentState.sourcePackageMediaTypeFilter = nextValue;
    },
    get sourcePackageFileNameFilter() {
      return args.contentState.sourcePackageFileNameFilter;
    },
    set sourcePackageFileNameFilter(nextValue) {
      args.contentState.sourcePackageFileNameFilter = nextValue;
    },
    get sourcePackageLatestImportStatusFilter() {
      return args.contentState.sourcePackageLatestImportStatusFilter;
    },
    set sourcePackageLatestImportStatusFilter(nextValue) {
      args.contentState.sourcePackageLatestImportStatusFilter = nextValue;
    },
    get sourcePackageLimit() {
      return args.contentState.sourcePackageLimit;
    },
    set sourcePackageLimit(nextValue) {
      args.contentState.sourcePackageLimit = nextValue;
    },
    get importJobStatusFilter() {
      return args.contentState.importJobStatusFilter;
    },
    set importJobStatusFilter(nextValue) {
      args.contentState.importJobStatusFilter = nextValue;
    },
    get importJobSourcePackageFilter() {
      return args.contentState.importJobSourcePackageFilter;
    },
    set importJobSourcePackageFilter(nextValue) {
      args.contentState.importJobSourcePackageFilter = nextValue;
    },
    get importJobLimit() {
      return args.contentState.importJobLimit;
    },
    set importJobLimit(nextValue) {
      args.contentState.importJobLimit = nextValue;
    },
    get contentReleaseStatusFilter() {
      return args.contentState.contentReleaseStatusFilter;
    },
    set contentReleaseStatusFilter(nextValue) {
      args.contentState.contentReleaseStatusFilter = nextValue;
    },
    get contentReleaseImportJobFilter() {
      return args.contentState.contentReleaseImportJobFilter;
    },
    set contentReleaseImportJobFilter(nextValue) {
      args.contentState.contentReleaseImportJobFilter = nextValue;
    },
    get contentReleaseSourcePackageFilter() {
      return args.contentState.contentReleaseSourcePackageFilter;
    },
    set contentReleaseSourcePackageFilter(nextValue) {
      args.contentState.contentReleaseSourcePackageFilter = nextValue;
    },
    get contentReleaseLimit() {
      return args.contentState.contentReleaseLimit;
    },
    set contentReleaseLimit(nextValue) {
      args.contentState.contentReleaseLimit = nextValue;
    },
    get participantSessionId() {
      return args.runtimeState.participantSessionId;
    },
    set participantSessionId(nextValue) {
      args.runtimeState.participantSessionId = nextValue;
    },
    get testRunId() {
      return args.runtimeState.testRunId;
    },
    set testRunId(nextValue) {
      args.runtimeState.testRunId = nextValue;
    },
    get currentUnitKey() {
      return args.runtimeState.currentUnitKey;
    },
    set currentUnitKey(nextValue) {
      args.runtimeState.currentUnitKey = nextValue;
    },
    get monitorTimeSeconds() {
      return args.runtimeState.monitorTimeSeconds;
    },
    set monitorTimeSeconds(nextValue) {
      args.runtimeState.monitorTimeSeconds = nextValue;
    },
    get loginKey() {
      return args.runtimeState.loginKey;
    },
    set loginKey(nextValue) {
      args.runtimeState.loginKey = nextValue;
    },
    get groupKey() {
      return args.runtimeState.groupKey;
    },
    set groupKey(nextValue) {
      args.runtimeState.groupKey = nextValue;
    },
    get bookletKey() {
      return args.runtimeState.bookletKey;
    },
    set bookletKey(nextValue) {
      args.runtimeState.bookletKey = nextValue;
    },
    get participantSessionStatusFilter() {
      return args.runtimeState.participantSessionStatusFilter;
    },
    set participantSessionStatusFilter(nextValue) {
      args.runtimeState.participantSessionStatusFilter = nextValue;
    },
    get participantSessionGroupFilter() {
      return args.runtimeState.participantSessionGroupFilter;
    },
    set participantSessionGroupFilter(nextValue) {
      args.runtimeState.participantSessionGroupFilter = nextValue;
    },
    get participantSessionLoginFilter() {
      return args.runtimeState.participantSessionLoginFilter;
    },
    set participantSessionLoginFilter(nextValue) {
      args.runtimeState.participantSessionLoginFilter = nextValue;
    },
    get participantSessionBookletFilter() {
      return args.runtimeState.participantSessionBookletFilter;
    },
    set participantSessionBookletFilter(nextValue) {
      args.runtimeState.participantSessionBookletFilter = nextValue;
    },
    get participantSessionReleaseFilter() {
      return args.runtimeState.participantSessionReleaseFilter;
    },
    set participantSessionReleaseFilter(nextValue) {
      args.runtimeState.participantSessionReleaseFilter = nextValue;
    },
    get participantSessionLimit() {
      return args.runtimeState.participantSessionLimit;
    },
    set participantSessionLimit(nextValue) {
      args.runtimeState.participantSessionLimit = nextValue;
    },
    get detailedResponseLoginFilter() {
      return args.runtimeState.detailedResponseLoginFilter;
    },
    set detailedResponseLoginFilter(nextValue) {
      args.runtimeState.detailedResponseLoginFilter = nextValue;
    },
    get detailedResponseGroupFilter() {
      return args.runtimeState.detailedResponseGroupFilter;
    },
    set detailedResponseGroupFilter(nextValue) {
      args.runtimeState.detailedResponseGroupFilter = nextValue;
    },
    get detailedResponseBookletFilter() {
      return args.runtimeState.detailedResponseBookletFilter;
    },
    set detailedResponseBookletFilter(nextValue) {
      args.runtimeState.detailedResponseBookletFilter = nextValue;
    },
    get detailedResponseSessionFilter() {
      return args.runtimeState.detailedResponseSessionFilter;
    },
    set detailedResponseSessionFilter(nextValue) {
      args.runtimeState.detailedResponseSessionFilter = nextValue;
    },
    get detailedResponseRunFilter() {
      return args.runtimeState.detailedResponseRunFilter;
    },
    set detailedResponseRunFilter(nextValue) {
      args.runtimeState.detailedResponseRunFilter = nextValue;
    },
    get detailedResponseUnitFilter() {
      return args.runtimeState.detailedResponseUnitFilter;
    },
    set detailedResponseUnitFilter(nextValue) {
      args.runtimeState.detailedResponseUnitFilter = nextValue;
    },
    get detailedResponseStatusFilter() {
      return args.runtimeState.detailedResponseStatusFilter;
    },
    set detailedResponseStatusFilter(nextValue) {
      args.runtimeState.detailedResponseStatusFilter = nextValue;
    },
    get detailedResponseLimit() {
      return args.runtimeState.detailedResponseLimit;
    },
    set detailedResponseLimit(nextValue) {
      args.runtimeState.detailedResponseLimit = nextValue;
    },
    get reviewLoginFilter() {
      return args.runtimeState.reviewLoginFilter;
    },
    set reviewLoginFilter(nextValue) {
      args.runtimeState.reviewLoginFilter = nextValue;
    },
    get reviewGroupFilter() {
      return args.runtimeState.reviewGroupFilter;
    },
    set reviewGroupFilter(nextValue) {
      args.runtimeState.reviewGroupFilter = nextValue;
    },
    get reviewBookletFilter() {
      return args.runtimeState.reviewBookletFilter;
    },
    set reviewBookletFilter(nextValue) {
      args.runtimeState.reviewBookletFilter = nextValue;
    },
    get reviewSessionFilter() {
      return args.runtimeState.reviewSessionFilter;
    },
    set reviewSessionFilter(nextValue) {
      args.runtimeState.reviewSessionFilter = nextValue;
    },
    get reviewRunFilter() {
      return args.runtimeState.reviewRunFilter;
    },
    set reviewRunFilter(nextValue) {
      args.runtimeState.reviewRunFilter = nextValue;
    },
    get reviewUnitFilter() {
      return args.runtimeState.reviewUnitFilter;
    },
    set reviewUnitFilter(nextValue) {
      args.runtimeState.reviewUnitFilter = nextValue;
    },
    get reviewReviewerFilter() {
      return args.runtimeState.reviewReviewerFilter;
    },
    set reviewReviewerFilter(nextValue) {
      args.runtimeState.reviewReviewerFilter = nextValue;
    },
    get reviewCategoryFilter() {
      return args.runtimeState.reviewCategoryFilter;
    },
    set reviewCategoryFilter(nextValue) {
      args.runtimeState.reviewCategoryFilter = nextValue;
    },
    get reviewLimit() {
      return args.runtimeState.reviewLimit;
    },
    set reviewLimit(nextValue) {
      args.runtimeState.reviewLimit = nextValue;
    },
    get openRunLoginFilter() {
      return args.runtimeState.openRunLoginFilter;
    },
    set openRunLoginFilter(nextValue) {
      args.runtimeState.openRunLoginFilter = nextValue;
    },
    get openRunGroupFilter() {
      return args.runtimeState.openRunGroupFilter;
    },
    set openRunGroupFilter(nextValue) {
      args.runtimeState.openRunGroupFilter = nextValue;
    },
    get openRunBookletFilter() {
      return args.runtimeState.openRunBookletFilter;
    },
    set openRunBookletFilter(nextValue) {
      args.runtimeState.openRunBookletFilter = nextValue;
    },
    get openRunSessionFilter() {
      return args.runtimeState.openRunSessionFilter;
    },
    set openRunSessionFilter(nextValue) {
      args.runtimeState.openRunSessionFilter = nextValue;
    },
    get openRunRunFilter() {
      return args.runtimeState.openRunRunFilter;
    },
    set openRunRunFilter(nextValue) {
      args.runtimeState.openRunRunFilter = nextValue;
    },
    get openRunUnitFilter() {
      return args.runtimeState.openRunUnitFilter;
    },
    set openRunUnitFilter(nextValue) {
      args.runtimeState.openRunUnitFilter = nextValue;
    },
    get openRunStatusFilter() {
      return args.runtimeState.openRunStatusFilter;
    },
    set openRunStatusFilter(nextValue) {
      args.runtimeState.openRunStatusFilter = nextValue;
    },
    get openRunLimit() {
      return args.runtimeState.openRunLimit;
    },
    set openRunLimit(nextValue) {
      args.runtimeState.openRunLimit = nextValue;
    },
    get monitorProfileId() {
      return args.runtimeState.monitorProfileId;
    },
    set monitorProfileId(nextValue) {
      args.runtimeState.monitorProfileId = nextValue;
    },
    get monitorCommandHistoryRunFilter() {
      return args.runtimeState.monitorCommandHistoryRunFilter;
    },
    set monitorCommandHistoryRunFilter(nextValue) {
      args.runtimeState.monitorCommandHistoryRunFilter = nextValue;
    },
    get monitorCommandHistoryLimit() {
      return args.runtimeState.monitorCommandHistoryLimit;
    },
    set monitorCommandHistoryLimit(nextValue) {
      args.runtimeState.monitorCommandHistoryLimit = nextValue;
    },
    get entryRosterText() {
      return args.runtimeState.entryRosterText;
    },
    set entryRosterText(nextValue) {
      args.runtimeState.entryRosterText = nextValue;
    },
    get entryLinksView() {
      return args.runtimeState.entryLinksView;
    },
    set entryLinksView(nextValue) {
      args.runtimeState.entryLinksView = nextValue;
    },
    get participantRosterView() {
      return args.runtimeState.participantRosterView;
    },
    set participantRosterView(nextValue) {
      args.runtimeState.participantRosterView = nextValue;
    },
    get participantRosterExportView() {
      return args.runtimeState.participantRosterExportView;
    },
    set participantRosterExportView(nextValue) {
      args.runtimeState.participantRosterExportView = nextValue;
    },
    get autoRefreshEnabled() {
      return args.workspaceState.autoRefreshEnabled;
    },
    set autoRefreshEnabled(nextValue) {
      args.workspaceState.autoRefreshEnabled = nextValue;
    },
    get autoRefreshSeconds() {
      return args.workspaceState.autoRefreshSeconds;
    },
    set autoRefreshSeconds(nextValue) {
      args.workspaceState.autoRefreshSeconds = nextValue;
    },
    get workspaceActivityEventType() {
      return args.workspaceState.workspaceActivityEventType;
    },
    set workspaceActivityEventType(nextValue) {
      args.workspaceState.workspaceActivityEventType = nextValue;
    },
    get workspaceActivitySubjectType() {
      return args.workspaceState.workspaceActivitySubjectType;
    },
    set workspaceActivitySubjectType(nextValue) {
      args.workspaceState.workspaceActivitySubjectType = nextValue;
    },
    get workspaceActivitySubjectId() {
      return args.workspaceState.workspaceActivitySubjectId;
    },
    set workspaceActivitySubjectId(nextValue) {
      args.workspaceState.workspaceActivitySubjectId = nextValue;
    },
    get workspaceActivityLimit() {
      return args.workspaceState.workspaceActivityLimit;
    },
    set workspaceActivityLimit(nextValue) {
      args.workspaceState.workspaceActivityLimit = nextValue;
    },
    get studyMonitorMatrixLoginFilter() {
      return args.workspaceState.studyMonitorMatrixLoginFilter;
    },
    set studyMonitorMatrixLoginFilter(nextValue) {
      args.workspaceState.studyMonitorMatrixLoginFilter = nextValue;
    },
    get studyMonitorMatrixGroupFilter() {
      return args.workspaceState.studyMonitorMatrixGroupFilter;
    },
    set studyMonitorMatrixGroupFilter(nextValue) {
      args.workspaceState.studyMonitorMatrixGroupFilter = nextValue;
    },
    get studyMonitorMatrixBookletFilter() {
      return args.workspaceState.studyMonitorMatrixBookletFilter;
    },
    set studyMonitorMatrixBookletFilter(nextValue) {
      args.workspaceState.studyMonitorMatrixBookletFilter = nextValue;
    },
    get studyMonitorMatrixUnitFilter() {
      return args.workspaceState.studyMonitorMatrixUnitFilter;
    },
    set studyMonitorMatrixUnitFilter(nextValue) {
      args.workspaceState.studyMonitorMatrixUnitFilter = nextValue;
    },
    get studyMonitorMatrixStatusFilter() {
      return args.workspaceState.studyMonitorMatrixStatusFilter;
    },
    set studyMonitorMatrixStatusFilter(nextValue) {
      args.workspaceState.studyMonitorMatrixStatusFilter = nextValue;
    },
    get studyMonitorMatrixAnswerFilter() {
      return args.workspaceState.studyMonitorMatrixAnswerFilter;
    },
    set studyMonitorMatrixAnswerFilter(nextValue) {
      args.workspaceState.studyMonitorMatrixAnswerFilter = nextValue;
    },
    get studyMonitorMatrixLimit() {
      return args.workspaceState.studyMonitorMatrixLimit;
    },
    set studyMonitorMatrixLimit(nextValue) {
      args.workspaceState.studyMonitorMatrixLimit = nextValue;
    },
    get forceActivation() {
      return args.contentState.forceActivation;
    },
    set forceActivation(nextValue) {
      args.contentState.forceActivation = nextValue;
    },
    get adminUsername() {
      return args.opsState.adminUsername;
    },
    set adminUsername(nextValue) {
      args.opsState.adminUsername = nextValue;
    },
    get adminDisplayName() {
      return args.opsState.adminDisplayName;
    },
    set adminDisplayName(nextValue) {
      args.opsState.adminDisplayName = nextValue;
    },
    get adminSessionToken() {
      return args.opsState.adminSessionToken;
    },
    set adminSessionToken(nextValue) {
      args.opsState.adminSessionToken = nextValue;
    },
    get adminSessionUserFilter() {
      return args.opsState.adminSessionUserFilter;
    },
    set adminSessionUserFilter(nextValue) {
      args.opsState.adminSessionUserFilter = nextValue;
    },
    get adminSessionStatusFilter() {
      return args.opsState.adminSessionStatusFilter;
    },
    set adminSessionStatusFilter(nextValue) {
      args.opsState.adminSessionStatusFilter = nextValue;
    },
    get adminSessionLimit() {
      return args.opsState.adminSessionLimit;
    },
    set adminSessionLimit(nextValue) {
      args.opsState.adminSessionLimit = nextValue;
    },
    get adminSessionRevokeTargetId() {
      return args.opsState.adminSessionRevokeTargetId;
    },
    set adminSessionRevokeTargetId(nextValue) {
      args.opsState.adminSessionRevokeTargetId = nextValue;
    },
    get adminUserUsernameFilter() {
      return args.opsState.adminUserUsernameFilter;
    },
    set adminUserUsernameFilter(nextValue) {
      args.opsState.adminUserUsernameFilter = nextValue;
    },
    get adminUserStatusFilter() {
      return args.opsState.adminUserStatusFilter;
    },
    set adminUserStatusFilter(nextValue) {
      args.opsState.adminUserStatusFilter = nextValue;
    },
    get adminUserRoleFilter() {
      return args.opsState.adminUserRoleFilter;
    },
    set adminUserRoleFilter(nextValue) {
      args.opsState.adminUserRoleFilter = nextValue;
    },
    get adminUserTenantFilter() {
      return args.opsState.adminUserTenantFilter;
    },
    set adminUserTenantFilter(nextValue) {
      args.opsState.adminUserTenantFilter = nextValue;
    },
    get adminUserWorkspaceFilter() {
      return args.opsState.adminUserWorkspaceFilter;
    },
    set adminUserWorkspaceFilter(nextValue) {
      args.opsState.adminUserWorkspaceFilter = nextValue;
    },
    get adminUserLimit() {
      return args.opsState.adminUserLimit;
    },
    set adminUserLimit(nextValue) {
      args.opsState.adminUserLimit = nextValue;
    },
    get adminAuditEventTypeFilter() {
      return args.opsState.adminAuditEventTypeFilter;
    },
    set adminAuditEventTypeFilter(nextValue) {
      args.opsState.adminAuditEventTypeFilter = nextValue;
    },
    get adminAuditActorFilter() {
      return args.opsState.adminAuditActorFilter;
    },
    set adminAuditActorFilter(nextValue) {
      args.opsState.adminAuditActorFilter = nextValue;
    },
    get adminAuditSubjectFilter() {
      return args.opsState.adminAuditSubjectFilter;
    },
    set adminAuditSubjectFilter(nextValue) {
      args.opsState.adminAuditSubjectFilter = nextValue;
    },
    get adminAuditLimit() {
      return args.opsState.adminAuditLimit;
    },
    set adminAuditLimit(nextValue) {
      args.opsState.adminAuditLimit = nextValue;
    },
    get adminCreateUsername() {
      return args.opsState.adminCreateUsername;
    },
    set adminCreateUsername(nextValue) {
      args.opsState.adminCreateUsername = nextValue;
    },
    get adminCreateDisplayName() {
      return args.opsState.adminCreateDisplayName;
    },
    set adminCreateDisplayName(nextValue) {
      args.opsState.adminCreateDisplayName = nextValue;
    },
    get adminCreateRole() {
      return args.opsState.adminCreateRole;
    },
    set adminCreateRole(nextValue) {
      args.opsState.adminCreateRole = nextValue;
    },
    get adminCreateTenantKey() {
      return args.opsState.adminCreateTenantKey;
    },
    set adminCreateTenantKey(nextValue) {
      args.opsState.adminCreateTenantKey = nextValue;
    },
    get adminCreateWorkspaceKey() {
      return args.opsState.adminCreateWorkspaceKey;
    },
    set adminCreateWorkspaceKey(nextValue) {
      args.opsState.adminCreateWorkspaceKey = nextValue;
    },
    get adminCreateGroupKey() {
      return args.opsState.adminCreateGroupKey;
    },
    set adminCreateGroupKey(nextValue) {
      args.opsState.adminCreateGroupKey = nextValue;
    },
    get adminCreateMonitorProfilesJson() {
      return args.opsState.adminCreateMonitorProfilesJson;
    },
    set adminCreateMonitorProfilesJson(nextValue) {
      args.opsState.adminCreateMonitorProfilesJson = nextValue;
    },
    get adminCreateValidFrom() {
      return args.opsState.adminCreateValidFrom;
    },
    set adminCreateValidFrom(nextValue) {
      args.opsState.adminCreateValidFrom = nextValue;
    },
    get adminCreateValidTo() {
      return args.opsState.adminCreateValidTo;
    },
    set adminCreateValidTo(nextValue) {
      args.opsState.adminCreateValidTo = nextValue;
    },
    get adminCreateValidForMinutes() {
      return args.opsState.adminCreateValidForMinutes;
    },
    set adminCreateValidForMinutes(nextValue) {
      args.opsState.adminCreateValidForMinutes = nextValue;
    },
    get adminRoleTargetUserId() {
      return args.opsState.adminRoleTargetUserId;
    },
    set adminRoleTargetUserId(nextValue) {
      args.opsState.adminRoleTargetUserId = nextValue;
    },
    get adminRoleRole() {
      return args.opsState.adminRoleRole;
    },
    set adminRoleRole(nextValue) {
      args.opsState.adminRoleRole = nextValue;
    },
    get adminRoleTenantKey() {
      return args.opsState.adminRoleTenantKey;
    },
    set adminRoleTenantKey(nextValue) {
      args.opsState.adminRoleTenantKey = nextValue;
    },
    get adminRoleWorkspaceKey() {
      return args.opsState.adminRoleWorkspaceKey;
    },
    set adminRoleWorkspaceKey(nextValue) {
      args.opsState.adminRoleWorkspaceKey = nextValue;
    },
    get adminRoleGroupKey() {
      return args.opsState.adminRoleGroupKey;
    },
    set adminRoleGroupKey(nextValue) {
      args.opsState.adminRoleGroupKey = nextValue;
    },
    get adminRevokeTargetUserId() {
      return args.opsState.adminRevokeTargetUserId;
    },
    set adminRevokeTargetUserId(nextValue) {
      args.opsState.adminRevokeTargetUserId = nextValue;
    },
    get adminRevokeRoleAssignmentId() {
      return args.opsState.adminRevokeRoleAssignmentId;
    },
    set adminRevokeRoleAssignmentId(nextValue) {
      args.opsState.adminRevokeRoleAssignmentId = nextValue;
    },
    get adminStatusTargetUserId() {
      return args.opsState.adminStatusTargetUserId;
    },
    set adminStatusTargetUserId(nextValue) {
      args.opsState.adminStatusTargetUserId = nextValue;
    },
    get adminStatusValue() {
      return args.opsState.adminStatusValue;
    },
    set adminStatusValue(nextValue) {
      args.opsState.adminStatusValue = nextValue;
    },
    get adminResetTargetUserId() {
      return args.opsState.adminResetTargetUserId;
    },
    set adminResetTargetUserId(nextValue) {
      args.opsState.adminResetTargetUserId = nextValue;
    },
    get showRawDebug() {
      return args.getShowRawDebug();
    },
    set showRawDebug(nextValue) {
      args.setShowRawDebug(nextValue);
    },
    get activeView() {
      return args.getActiveView();
    },
    set activeView(nextValue) {
      args.setActiveView(nextValue);
    }
  };
}

export function createShellRequestStateHost(args: {
  getForegroundRequestDepth(): number;
  setForegroundRequestDepth(nextValue: number): void;
  activeRequestLabel: WritableSignal<string | null>;
  errorMessage: WritableSignal<string | null>;
  lastApiError: WritableSignal<ApiErrorLike | null>;
  responseMeta: WritableSignal<string>;
  lastResponse: WritableSignal<string>;
  renderVersion: WritableSignal<number>;
  applicationRef: ApplicationRef;
}): ShellRequestStateHost {
  return {
    get foregroundRequestDepth() {
      return args.getForegroundRequestDepth();
    },
    set foregroundRequestDepth(nextValue) {
      args.setForegroundRequestDepth(nextValue);
    },
    activeRequestLabel: args.activeRequestLabel,
    errorMessage: args.errorMessage,
    lastApiError: args.lastApiError,
    responseMeta: args.responseMeta,
    lastResponse: args.lastResponse,
    renderVersion: args.renderVersion,
    applicationRef: args.applicationRef
  };
}
