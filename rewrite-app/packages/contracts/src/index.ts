import type {
  AdminAuditEvent,
  AdminAuditEventType,
  AdminRole,
  AdminRoleAssignment,
  AdminSession,
  AdminUser,
  AdminUserStatus,
  ContentReleaseActivationReadiness,
  ContentRelease,
  ImportJob,
  OpenMonitorRun,
  ParticipantCurrentRunState,
  ParticipantSession,
  ParticipantRuntimeState,
  SourcePackage,
  SourcePackageContentStructure,
  Tenant,
  TestRun,
  Workspace,
  WorkspaceContentReleaseListItem,
  WorkspaceContentReleaseDetail,
  WorkspaceActivityEventListItem,
  WorkspaceImportJobDetail,
  WorkspaceImportJobListItem,
  WorkspaceParticipantSessionDetail,
  WorkspaceParticipantSessionListItem,
  WorkspaceActivityEventType,
  WorkspaceSourcePackageDetail,
  WorkspaceSourcePackageListItem,
  WorkspaceOverview
} from "@testcenter-rewrite-app/domain";

export const productionApiRoutes = {
  admin: {
    bootstrap: "/api/v1/admin/auth/bootstrap",
    signIn: "/api/v1/admin/auth/sign-in",
    signOut: "/api/v1/admin/auth/sign-out",
    currentSession: "/api/v1/admin/auth/current-session",
    listUsers: "/api/v1/admin/users",
    createUser: "/api/v1/admin/users",
    updateUser: "/api/v1/admin/users/:adminUserId",
    resetPassword: "/api/v1/admin/users/:adminUserId/password",
    assignRole: "/api/v1/admin/users/:adminUserId/role-assignments",
    revokeRole:
      "/api/v1/admin/users/:adminUserId/role-assignments/:roleAssignmentId",
    listAuditEvents: "/api/v1/admin/audit-events"
  },
  platform: {
    listTenants: "/api/v1/platform/tenants",
    createTenant: "/api/v1/platform/tenants"
  },
  workspace: {
    createWorkspace: "/api/v1/tenants/:tenantKey/workspaces",
    listWorkspaces: "/api/v1/tenants/:tenantKey/workspaces",
    getWorkspaceOverview: "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey",
    listWorkspaceActivityEvents:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/activity-events",
    createSourcePackage: "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/source-packages",
    listSourcePackages: "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/source-packages",
    getSourcePackage:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/source-packages/:sourcePackageId",
    retrySourcePackageImport:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/source-packages/:sourcePackageId/retry-import",
    createImportJob: "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/import-jobs",
    listImportJobs: "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/import-jobs",
    getImportJob:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/import-jobs/:importJobId",
    listParticipantSessions:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/participant-sessions",
    getParticipantSession:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/participant-sessions/:participantSessionId",
    listContentReleases:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/content-releases",
    getContentRelease:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/content-releases/:contentReleaseId",
    getContentReleaseActivationReadiness:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/content-releases/:contentReleaseId/activation-readiness",
    activateContentRelease:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/content-releases/:contentReleaseId/activate"
  },
  participant: {
    signIn: "/api/v1/participant/auth/sign-in",
    launch: "/api/v1/participant/starter:launch",
    getRuntimeState: "/api/v1/participant/sessions/:participantSessionId/runtime-state",
    getCurrentRunState:
      "/api/v1/participant/sessions/:participantSessionId/current-state",
    saveProgress: "/api/v1/participant/test-runs/:testRunId/save-progress",
    resumeSession: "/api/v1/participant/sessions/:participantSessionId/resume",
    resumeRun: "/api/v1/participant/test-runs/:testRunId/resume",
    completeRun: "/api/v1/participant/test-runs/:testRunId/complete"
  },
  monitor: {
    openRuns: "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/monitor/open-runs"
  },
  system: {
    getRuntimeDiagnostics: "/diagnostics/runtime",
    getRuntimeConfig: "/diagnostics/config"
  }
} as const;

export type CreateTenantRequest = {
  tenantKey: string;
  displayName: string;
};

export type CreateWorkspaceRequest = {
  workspaceKey: string;
  displayName: string;
};

export type CreateSourcePackageRequest = {
  fileName: string;
  mediaType: string;
  contentStructure?: SourcePackageContentStructure;
  sourceDocument?: string;
};

export type CreateImportJobRequest = {
  sourcePackageId: string;
};

export type RetrySourcePackageImportRequest = {
  fileName?: string;
  mediaType?: string;
  contentStructure?: SourcePackageContentStructure | null;
  sourceDocument?: string | null;
};

export type ActivateContentReleaseRequest = {
  activatedByActorId: string;
  forceActivation?: boolean;
};

export type ApiErrorResponse = {
  error: string;
  message: string;
  details?: unknown;
};

export type ActivateContentReleaseBlockedErrorDetails = {
  activeContentReleaseId: string;
  openRuns: OpenMonitorRun[];
};

export type WorkspaceActivityEventListQuery = {
  eventType?: WorkspaceActivityEventType;
};

export type AdminAuditEventListQuery = {
  eventType?: AdminAuditEventType;
  actorAdminUserId?: string;
  subjectAdminUserId?: string;
  limit?: number;
};

export type ParticipantSignInRequest = {
  workspaceKey: string;
  loginKey: string;
};

export type PublicAdminUser = Omit<AdminUser, "passwordHash">;

export type PublicAdminSession = Omit<AdminSession, "token">;

export type PublicAdminRoleAssignment = AdminRoleAssignment;

export type BootstrapAdminUserRequest = {
  username: string;
  displayName?: string;
  password: string;
};

export type AdminSignInRequest = {
  username: string;
  password: string;
};

export type AdminRoleAssignmentRequest = {
  role: AdminRole;
  tenantKey?: string | null;
  workspaceKey?: string | null;
};

export type CreateAdminUserRequest = {
  username: string;
  displayName?: string;
  password: string;
  roleAssignments?: AdminRoleAssignmentRequest[];
};

export type UpdateAdminUserRequest = {
  displayName?: string;
  status?: AdminUserStatus;
};

export type ResetAdminUserPasswordRequest = {
  password: string;
};

export type AssignAdminRoleRequest = AdminRoleAssignmentRequest;

export type ParticipantLaunchRequest = {
  participantSessionId: string;
};

export type SaveTestRunProgressRequest = {
  currentUnitKey: string | null;
  status: Extract<TestRun["status"], "running" | "paused">;
};

export type CreateTenantResponse = {
  tenant: Tenant;
};

export type ListTenantsResponse = {
  items: Tenant[];
};

export type CreateWorkspaceResponse = {
  workspace: Workspace;
};

export type ListWorkspacesResponse = {
  items: Workspace[];
};

export type BootstrapAdminUserResponse = {
  adminUser: PublicAdminUser;
  roleAssignments: PublicAdminRoleAssignment[];
};

export type AdminSignInResponse = {
  adminUser: PublicAdminUser;
  adminSession: PublicAdminSession;
  roleAssignments: PublicAdminRoleAssignment[];
  sessionToken: string;
};

export type GetAdminCurrentSessionResponse = {
  adminUser: PublicAdminUser;
  adminSession: PublicAdminSession;
  roleAssignments: PublicAdminRoleAssignment[];
};

export type AdminSignOutResponse = {
  adminSession: PublicAdminSession;
};

export type AdminUserDirectoryItem = {
  adminUser: PublicAdminUser;
  roleAssignments: PublicAdminRoleAssignment[];
};

export type ListAdminUsersResponse = {
  items: AdminUserDirectoryItem[];
};

export type CreateAdminUserResponse = AdminUserDirectoryItem;

export type UpdateAdminUserResponse = AdminUserDirectoryItem;

export type ResetAdminUserPasswordResponse = AdminUserDirectoryItem;

export type AssignAdminRoleResponse = AdminUserDirectoryItem;

export type RevokeAdminRoleResponse = AdminUserDirectoryItem;

export type ListAdminAuditEventsResponse = {
  items: AdminAuditEvent[];
};

export type GetWorkspaceOverviewResponse = {
  workspaceOverview: WorkspaceOverview;
};

export type ListWorkspaceActivityEventsResponse = {
  items: WorkspaceActivityEventListItem[];
};

export type CreateSourcePackageResponse = {
  sourcePackage: SourcePackage;
};

export type CreateImportJobResponse = {
  importJob: ImportJob;
  stagedContentRelease: ContentRelease | null;
};

export type RetrySourcePackageImportResponse = {
  sourcePackage: SourcePackage;
  importJob: ImportJob;
  stagedContentRelease: ContentRelease | null;
};

export type ListSourcePackagesResponse = {
  items: WorkspaceSourcePackageListItem[];
};

export type GetSourcePackageResponse = {
  sourcePackageDetail: WorkspaceSourcePackageDetail;
};

export type ListImportJobsResponse = {
  items: WorkspaceImportJobListItem[];
};

export type GetImportJobResponse = {
  importJobDetail: WorkspaceImportJobDetail;
};

export type ListParticipantSessionsResponse = {
  items: WorkspaceParticipantSessionListItem[];
};

export type GetParticipantSessionResponse = {
  participantSessionDetail: WorkspaceParticipantSessionDetail;
};

export type ListContentReleasesResponse = {
  items: WorkspaceContentReleaseListItem[];
};

export type GetContentReleaseResponse = {
  contentReleaseDetail: WorkspaceContentReleaseDetail;
};

export type GetContentReleaseActivationReadinessResponse = {
  activationReadiness: ContentReleaseActivationReadiness;
};

export type ActivateContentReleaseResponse = {
  contentRelease: ContentRelease;
};

export type ParticipantSignInResponse = {
  participantSession: ParticipantSession;
};

export type ParticipantLaunchResponse = {
  testRun: TestRun;
};

export type ParticipantRuntimeStateResponse = {
  runtimeState: ParticipantRuntimeState;
};

export type ParticipantCurrentRunStateResponse = {
  currentRunState: ParticipantCurrentRunState;
};

export type SaveTestRunProgressResponse = {
  testRun: TestRun;
};

export type ResumeParticipantSessionResponse = {
  testRun: TestRun;
};

export type ResumeTestRunResponse = {
  testRun: TestRun;
};

export type CompleteTestRunResponse = {
  testRun: TestRun;
};

export type MonitorOpenRunsResponse = {
  items: OpenMonitorRun[];
};

export type RuntimeOperationalEvent = {
  occurredAt: string;
  level: "info" | "error";
  event: string;
  details: Record<string, unknown>;
};

export type GetRuntimeDiagnosticsResponse = {
  phase: string;
  build: {
    commitSha: string | null;
    builtAt: string | null;
  };
  runtime: {
    startedAt: string;
    uptimeSeconds: number;
    lifecycle: {
      phase: "running" | "draining";
      shutdownRequestedAt: string | null;
    };
    activeRequests: number;
    totalRequests: number;
    completedRequests: number;
  };
  memory: {
    rssBytes: number;
    heapTotalBytes: number;
    heapUsedBytes: number;
    externalBytes: number;
    arrayBuffersBytes: number;
  };
  storage: {
    kind: string;
    schemaVersion: number | null;
    location: string | null;
  };
  recentEvents: RuntimeOperationalEvent[];
};

export type GetRuntimeConfigResponse = {
  phase: string;
  build: {
    commitSha: string | null;
    builtAt: string | null;
  };
  runtimeConfig: {
    port: number;
    shutdownDrainDelayMs: number;
    operatorAuthRequired: boolean;
    storage: {
      kind: "memory" | "file" | "sqlite" | "postgres";
      location: string | null;
      schemaVersion: number | null;
    };
    environment: {
      firstSliceStore: string;
      firstSliceFilePresent: boolean;
      firstSliceSqliteFilePresent: boolean;
      firstSlicePostgresUrlPresent: boolean;
      firstSliceOperatorAuthRequired: boolean;
      appBuildShaPresent: boolean;
      appBuildTimestampPresent: boolean;
    };
  };
};

export const resolveRoutePath = (
  template: string,
  params: Record<string, string>
): string => {
  let path = template;

  for (const [key, value] of Object.entries(params)) {
    path = path.replace(`:${key}`, encodeURIComponent(value));
  }

  return path;
};
