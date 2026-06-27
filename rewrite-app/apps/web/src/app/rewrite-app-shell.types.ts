import type { AdminRole, AdminUserStatus } from "@testcenter-rewrite-app/domain";

export type AppView = "workspace" | "content" | "runtime" | "participant" | "ops";

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

export const SHELL_STORAGE_KEY = "testcenter-rewrite-app-shell";
export const DEFAULT_SOURCE_DOCUMENT =
  '<assessment><booklet key="booklet:starter" label="Starter"><unit key="unit-1" label="Entry" /></booklet></assessment>';

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
