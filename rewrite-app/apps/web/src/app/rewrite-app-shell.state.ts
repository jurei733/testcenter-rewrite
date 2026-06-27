import type { AdminRole, AdminUserStatus } from "@testcenter-rewrite-app/domain";

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
  adminUsersView: string;
  adminAuditView: string;
  adminCreateUsername: string;
  adminCreateDisplayName: string;
  adminCreatePassword: string;
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
  adminResetPassword: string;
}

export interface ShellRuntimeState {
  loginKey: string;
  groupKey: string;
  participantSessionId: string;
  testRunId: string;
  currentUnitKey: string;
  currentUnitResponse: string;
  participantSessionsView: string;
  participantSessionDetailView: string;
  runtimeStateView: string;
  currentRunStateView: string;
  openRunsView: string;
  detailedResponsesView: string;
  responseExportView: string;
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
  forceActivation: boolean;
  sourcePackagesView: string;
  importJobsView: string;
  contentReleasesView: string;
  sourcePackageDetailView: string;
  importJobDetailView: string;
  contentReleaseActivationReadinessView: string;
  contentReleaseDetailView: string;
  activationGuardView: string;
  contentLoaded: boolean;
}

export interface ShellWorkspaceState {
  tenantKey: string;
  workspaceKey: string;
  autoRefreshEnabled: boolean;
  autoRefreshSeconds: number;
  tenantsView: string;
  workspacesView: string;
  workspaceOverviewView: string;
  workspaceActivityView: string;
  workspaceLogExportView: string;
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
    adminUsersView: 'Use "Admin Users".',
    adminAuditView: 'Use "Admin Audit Events".',
    adminCreateUsername: "workspace-admin",
    adminCreateDisplayName: "Workspace Admin",
    adminCreatePassword: "",
    adminCreateRole: "workspace_admin",
    adminCreateTenantKey: "demo-tenant",
    adminCreateWorkspaceKey: "demo-workspace",
    adminRoleTargetUserId: "",
    adminRoleRole: "workspace_admin",
    adminRoleTenantKey: "demo-tenant",
    adminRoleWorkspaceKey: "demo-workspace",
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
    loginKey: "student-ui",
    groupKey: "group:student-ui",
    participantSessionId: "",
    testRunId: "",
    currentUnitKey: "unit-1",
    currentUnitResponse: "",
    participantSessionsView: 'Use "Refresh Runtime Reads".',
    participantSessionDetailView: 'Use "Participant Session Detail".',
    runtimeStateView: 'Use "Refresh Runtime Reads".',
    currentRunStateView: 'Use "Refresh Runtime Reads".',
    openRunsView: 'Use "Refresh Runtime Reads".',
    detailedResponsesView: 'Use "Detailed Responses".',
    responseExportView: 'Use "Export Responses CSV".',
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
    forceActivation: false,
    sourcePackagesView: 'Use "Refresh Content Reads".',
    importJobsView: 'Use "Refresh Content Reads".',
    contentReleasesView: 'Use "Refresh Content Reads".',
    sourcePackageDetailView: 'Use "Source Package Detail".',
    importJobDetailView: 'Use "Import Job Detail".',
    contentReleaseActivationReadinessView: 'Use "Release Readiness".',
    contentReleaseDetailView: 'Use "Release Detail".',
    activationGuardView:
      "Activation guard details appear here when readiness or activation reports open-run blockers.",
    contentLoaded: false
  };
}

export function createInitialShellWorkspaceState(): ShellWorkspaceState {
  return {
    tenantKey: "demo-tenant",
    workspaceKey: "demo-workspace",
    autoRefreshEnabled: true,
    autoRefreshSeconds: 8,
    tenantsView: 'Use "Refresh Tenant Directory".',
    workspacesView: 'Use "Refresh Workspace Directory".',
    workspaceOverviewView: 'Use "Refresh Workspace Overview".',
    workspaceActivityView: 'Use "Refresh Content Reads".',
    workspaceLogExportView: 'Use "Export Workspace Logs CSV".',
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
