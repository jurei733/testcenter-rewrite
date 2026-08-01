import type {
  AdminRole,
  AdminSessionStatus,
  AdminUserStatus
} from "@testcenter-rewrite-app/domain";

export type AppView =
  | "workspace"
  | "content"
  | "runtime"
  | "participant"
  | "system-check"
  | "ops";

export type SummaryCard = {
  label: string;
  headline: string;
  detail: string;
};

export type ActivityFeedItem = {
  title: string;
  detail: string;
};

export type PersistedShellState = {
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

export const SHELL_STORAGE_KEY = "testcenter-rewrite-app-shell";
export const DEFAULT_SOURCE_DOCUMENT =
  '<assessment><booklet key="booklet:starter" label="Starter"><unit key="unit-1" label="Entry" /><unit key="unit-participant-route" label="Participant Route" /><unit key="unit-paused" label="Paused Work" /></booklet></assessment>';

export const createInitialSummaryCards = (): SummaryCard[] => [
  {
    label: "Workspace",
    headline: "Idle",
    detail: "Run setup or refresh the workspace overview to build the first summary snapshot."
  },
  {
    label: "Content",
    headline: "Waiting",
    detail: "Create and import a source package to surface activation and diagnostics state here."
  },
  {
    label: "Runtime",
    headline: "No Session",
    detail: "Sign in a participant to see current runtime status, current unit, and available actions."
  },
  {
    label: "Monitor",
    headline: "No Signal",
    detail: "Open the monitor view to track whether active runs are blocking a new release activation."
  }
];
