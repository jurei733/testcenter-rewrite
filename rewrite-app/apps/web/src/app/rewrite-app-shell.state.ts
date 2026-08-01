import type {
  AdminRole,
  AdminSessionStatus,
  AdminUserStatus
} from "@testcenter-rewrite-app/domain";

import type { ActivityFeedItem, SummaryCard } from "./rewrite-app-shell.types";

export interface ShellOpsState {
  storageKind: string;
  storageSchemaVersion: string;
  readinessBadge: string;
  routeCount: string;
  runtimePort: string;
  operatorAuthMode: string;
  buildRef: string;
  runtimeHealthView: string;
  runtimeMetricsView: string;
  runtimeDiagnosticsView: string;
  runtimeConfigView: string;
  diagnosticsLoaded: boolean;
  adminUsername: string;
  adminDisplayName: string;
  adminPassword: string;
  adminSessionToken: string;
  adminSessionView: string;
  adminSessionsView: string;
  adminSessionsExportView: string;
  adminSessionUserFilter: string;
  adminSessionStatusFilter: "" | AdminSessionStatus;
  adminSessionLimit: string;
  adminSessionRevokeTargetId: string;
  adminUsersView: string;
  adminUsersExportView: string;
  adminAuditView: string;
  adminAuditExportView: string;
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
  adminCreatePassword: string;
  adminCreateRole: AdminRole;
  adminCreateTenantKey: string;
  adminCreateWorkspaceKey: string;
  adminCreateGroupKey: string;
  adminCreateMonitorProfilesJson: string;
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
  adminResetPassword: string;
}

export interface ShellRuntimeState {
  monitorConnectionStatus:
    | "idle"
    | "connecting"
    | "live"
    | "reconnecting"
    | "polling"
    | "offline";
  monitorConnectionDetail: string;
  monitorConnectionLastEventAt: string;
  monitorConnectionOpenRunCount: number;
  participantDisplayName: string;
  loginKey: string;
  participantPassword: string;
  participantCode: string;
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
  monitorCommandHistoryRunFilter: string;
  monitorCommandHistoryLimit: string;
  entryRosterText: string;
  entryLinksView: string;
  participantRosterView: string;
  operationalLoginCandidatesView: string;
  participantSessionId: string;
  testRunId: string;
  currentUnitKey: string;
  monitorTargetUnitKey: string;
  monitorTimeSeconds: string;
  currentUnitResponse: string;
  reviewId: string;
  reviewerId: string;
  reviewCategory: string;
  reviewComment: string;
  participantSessionsView: string;
  participantSessionsExportView: string;
  participantSessionDetailView: string;
  runtimeStateView: string;
  currentRunStateView: string;
  openRunLoginFilter: string;
  openRunGroupFilter: string;
  openRunBookletFilter: string;
  openRunSessionFilter: string;
  openRunRunFilter: string;
  openRunUnitFilter: string;
  openRunStatusFilter: string;
  openRunLimit: string;
  monitorProfileId: string;
  openRunsView: string;
  openRunsExportView: string;
  monitorCommandHistoryView: string;
  detailedResponsesView: string;
  reviewsView: string;
  participantRosterExportView: string;
  responseExportView: string;
  reviewExportView: string;
  runtimeMonitorView: string;
  runtimeLoaded: boolean;
}

export interface ShellContentState {
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
  forceActivation: boolean;
  sourcePackagesView: string;
  importJobsView: string;
  contentReleasesView: string;
  sourcePackageDetailView: string;
  sourcePackageDeletionReadinessView: string;
  importJobDetailView: string;
  contentReleaseActivationReadinessView: string;
  contentReleaseDetailView: string;
  activationGuardView: string;
  sourcePackagesExportView: string;
  importJobsExportView: string;
  contentReleasesExportView: string;
  contentLoaded: boolean;
}

export interface ShellWorkspaceState {
  tenantKey: string;
  workspaceKey: string;
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
  tenantsView: string;
  workspacesView: string;
  tenantDirectoryExportView: string;
  workspaceDirectoryExportView: string;
  workspaceOverviewView: string;
  workspaceOverviewExportView: string;
  workspaceActivityView: string;
  participantTestLogsView: string;
  studyMonitorView: string;
  studyMonitorParticipantMatrixView: string;
  studyMonitorParticipantView: string;
  studyMonitorGroupView: string;
  studyMonitorBookletView: string;
  studyMonitorUnitView: string;
  studyMonitorRunView: string;
  studyMonitorExportView: string;
  studyMonitorParticipantMatrixExportView: string;
  studyMonitorRunExportView: string;
  workspaceLogExportView: string;
  workspaceActivityExportView: string;
  workspaceLoaded: boolean;
}

export interface ShellFeedbackState {
  summaryCards: SummaryCard[];
  activityFeed: ActivityFeedItem[];
}

export function createInitialShellOpsState(): ShellOpsState {
  return {
    storageKind: "unknown",
    storageSchemaVersion: "n/a",
    readinessBadge: "unknown",
    routeCount: "n/a",
    runtimePort: "n/a",
    operatorAuthMode: "unknown",
    buildRef: "local",
    runtimeHealthView: 'Use "Refresh Diagnostics".',
    runtimeMetricsView: 'Use "Refresh Diagnostics".',
    runtimeDiagnosticsView: 'Use "Refresh Diagnostics".',
    runtimeConfigView: 'Use "Refresh Diagnostics".',
    diagnosticsLoaded: false,
    adminUsername: "admin",
    adminDisplayName: "Platform Admin",
    adminPassword: "",
    adminSessionToken: "",
    adminSessionView: "Use admin bootstrap or sign-in.",
    adminSessionsView: 'Use "Admin Sessions".',
    adminSessionsExportView: "Export admin sessions CSV to preview it here.",
    adminSessionUserFilter: "",
    adminSessionStatusFilter: "",
    adminSessionLimit: "100",
    adminSessionRevokeTargetId: "",
    adminUsersView: 'Use "Admin Users".',
    adminUsersExportView: "Export admin users CSV to preview it here.",
    adminAuditView: 'Use "Admin Audit Events".',
    adminAuditExportView: "Export admin audit CSV to preview it here.",
    adminUserUsernameFilter: "",
    adminUserStatusFilter: "",
    adminUserRoleFilter: "",
    adminUserTenantFilter: "",
    adminUserWorkspaceFilter: "",
    adminUserLimit: "100",
    adminAuditEventTypeFilter: "",
    adminAuditActorFilter: "",
    adminAuditSubjectFilter: "",
    adminAuditLimit: "100",
    adminCreateUsername: "workspace-admin",
    adminCreateDisplayName: "Workspace Admin",
    adminCreatePassword: "",
    adminCreateRole: "workspace_admin",
    adminCreateTenantKey: "demo-tenant",
    adminCreateWorkspaceKey: "demo-workspace",
    adminCreateGroupKey: "group:student-demo",
    adminCreateMonitorProfilesJson: "[]",
    adminCreateValidFrom: "",
    adminCreateValidTo: "",
    adminCreateValidForMinutes: "",
    adminRoleTargetUserId: "",
    adminRoleRole: "workspace_admin",
    adminRoleTenantKey: "demo-tenant",
    adminRoleWorkspaceKey: "demo-workspace",
    adminRoleGroupKey: "group:student-demo",
    adminRevokeTargetUserId: "",
    adminRevokeRoleAssignmentId: "",
    adminStatusTargetUserId: "",
    adminStatusValue: "active",
    adminResetTargetUserId: "",
    adminResetPassword: ""
  };
}

export function createInitialShellRuntimeState(): ShellRuntimeState {
  return {
    monitorConnectionStatus: "idle",
    monitorConnectionDetail: "Live monitor is not connected yet.",
    monitorConnectionLastEventAt: "",
    monitorConnectionOpenRunCount: 0,
    participantDisplayName: "",
    loginKey: "student-ui",
    participantPassword: "",
    participantCode: "",
    groupKey: "group:student-ui",
    bookletKey: "",
    participantSessionStatusFilter: "",
    participantSessionGroupFilter: "",
    participantSessionLoginFilter: "",
    participantSessionBookletFilter: "",
    participantSessionReleaseFilter: "",
    participantSessionLimit: "100",
    detailedResponseLoginFilter: "",
    detailedResponseGroupFilter: "",
    detailedResponseBookletFilter: "",
    detailedResponseSessionFilter: "",
    detailedResponseRunFilter: "",
    detailedResponseUnitFilter: "",
    detailedResponseStatusFilter: "",
    detailedResponseLimit: "100",
    reviewLoginFilter: "",
    reviewGroupFilter: "",
    reviewBookletFilter: "",
    reviewSessionFilter: "",
    reviewRunFilter: "",
    reviewUnitFilter: "",
    reviewReviewerFilter: "",
    reviewCategoryFilter: "",
    reviewLimit: "100",
    monitorCommandHistoryRunFilter: "",
    monitorCommandHistoryLimit: "25",
    entryRosterText: [
      "login,group,booklet,name",
      "student-a,group:demo-a,booklet:demo,Ada Demo",
      "student-b,group:demo-a,booklet:demo,Ben Demo",
      "student-c,group:demo-b,booklet:demo,Cara Demo"
    ].join("\n"),
    entryLinksView: "",
    participantRosterView: 'Use "Load Saved Roster".',
    operationalLoginCandidatesView: "No operational login candidates classified yet.",
    participantSessionId: "",
    testRunId: "",
    currentUnitKey: "unit-1",
    monitorTargetUnitKey: "unit-1",
    monitorTimeSeconds: "300",
    currentUnitResponse: "",
    reviewId: "",
    reviewerId: "operator-ui",
    reviewCategory: "note",
    reviewComment: "",
    participantSessionsView: 'Use "Refresh Runtime Reads".',
    participantSessionsExportView: 'Use "Export Sessions CSV".',
    participantSessionDetailView: 'Use "Participant Session Detail".',
    runtimeStateView: 'Use "Refresh Runtime Reads".',
    currentRunStateView: 'Use "Refresh Runtime Reads".',
    openRunLoginFilter: "",
    openRunGroupFilter: "",
    openRunBookletFilter: "",
    openRunSessionFilter: "",
    openRunRunFilter: "",
    openRunUnitFilter: "",
    openRunStatusFilter: "",
    openRunLimit: "100",
    monitorProfileId: "",
    openRunsView: 'Use "Refresh Runtime Reads".',
    openRunsExportView: 'Use "Export Open Runs CSV".',
    monitorCommandHistoryView: 'Use "Refresh Runtime Reads".',
    detailedResponsesView: 'Use "Detailed Responses".',
    reviewsView: 'Use "Load Reviews".',
    participantRosterExportView: 'Use "Export Saved Roster CSV".',
    responseExportView: 'Use "Export Responses CSV".',
    reviewExportView: 'Use "Export Review CSV".',
    runtimeMonitorView: "Use runtime actions to populate the latest action result.",
    runtimeLoaded: false
  };
}

export function createInitialShellContentState(
  defaultSourceDocument: string
): ShellContentState {
  return {
    sourceFileName: "frontend-starter.xml",
    sourceMediaType: "application/xml",
    sourceDocument: defaultSourceDocument,
    sourcePackageId: "",
    importJobId: "",
    contentReleaseId: "",
    sourcePackageStatusFilter: "",
    sourcePackageMediaTypeFilter: "",
    sourcePackageFileNameFilter: "",
    sourcePackageLatestImportStatusFilter: "",
    sourcePackageLimit: "100",
    importJobStatusFilter: "",
    importJobSourcePackageFilter: "",
    importJobLimit: "100",
    contentReleaseStatusFilter: "",
    contentReleaseImportJobFilter: "",
    contentReleaseSourcePackageFilter: "",
    contentReleaseLimit: "100",
    forceActivation: false,
    sourcePackagesView: 'Use "Refresh Content Reads".',
    importJobsView: 'Use "Refresh Content Reads".',
    contentReleasesView: 'Use "Refresh Content Reads".',
    sourcePackageDetailView: 'Use "Source Package Detail".',
    sourcePackageDeletionReadinessView: 'Use "Deletion Readiness".',
    importJobDetailView: 'Use "Import Job Detail".',
    contentReleaseActivationReadinessView: 'Use "Release Readiness".',
    contentReleaseDetailView: 'Use "Release Detail".',
    activationGuardView:
      "Activation guard details appear here when readiness or activation reports open-run blockers.",
    sourcePackagesExportView: 'Use "Export Source Packages CSV".',
    importJobsExportView: 'Use "Export Import Jobs CSV".',
    contentReleasesExportView: 'Use "Export Content Releases CSV".',
    contentLoaded: false
  };
}

export function createInitialShellWorkspaceState(): ShellWorkspaceState {
  return {
    tenantKey: "demo-tenant",
    workspaceKey: "demo-workspace",
    autoRefreshEnabled: true,
    autoRefreshSeconds: 8,
    workspaceActivityEventType: "",
    workspaceActivitySubjectType: "",
    workspaceActivitySubjectId: "",
    workspaceActivityLimit: "100",
    studyMonitorMatrixLoginFilter: "",
    studyMonitorMatrixGroupFilter: "",
    studyMonitorMatrixBookletFilter: "",
    studyMonitorMatrixUnitFilter: "",
    studyMonitorMatrixStatusFilter: "",
    studyMonitorMatrixAnswerFilter: "",
    studyMonitorMatrixLimit: "25",
    tenantsView: 'Use "Refresh Tenant Directory".',
    workspacesView: 'Use "Refresh Workspace Directory".',
    tenantDirectoryExportView: 'Use "Export Tenant Directory CSV".',
    workspaceDirectoryExportView: 'Use "Export Workspace Directory CSV".',
    workspaceOverviewView: 'Use "Refresh Workspace Overview".',
    workspaceOverviewExportView: 'Use "Export Workspace Overview CSV".',
    workspaceActivityView: 'Use "Refresh Content Reads".',
    participantTestLogsView: 'Use "Refresh Participant Test Logs".',
    studyMonitorView: 'Use "Refresh Study Monitor".',
    studyMonitorParticipantMatrixView: 'Use "Refresh Study Monitor".',
    studyMonitorParticipantView: "Select a participant from the study monitor.",
    studyMonitorGroupView: "Select a group from the study monitor.",
    studyMonitorBookletView: "Select a booklet from the study monitor.",
    studyMonitorUnitView: "Select a unit from the study monitor.",
    studyMonitorRunView: "Select a run from the study monitor.",
    studyMonitorExportView: 'Use "Export Study Monitor CSV".',
    studyMonitorParticipantMatrixExportView:
      'Use "Export Participant Matrix CSV".',
    studyMonitorRunExportView: 'Open a run, then use "Export Run Detail CSV".',
    workspaceLogExportView: 'Use "Export Participant Test Logs CSV".',
    workspaceActivityExportView: 'Use "Export Activity CSV".',
    workspaceLoaded: false
  };
}

export function createInitialShellFeedbackState(
  createSummaryCards: () => SummaryCard[]
): ShellFeedbackState {
  return {
    summaryCards: createSummaryCards(),
    activityFeed: [
      {
        title: "Ready",
        detail: "The Angular shell is waiting for the first API action."
      }
    ]
  };
}
