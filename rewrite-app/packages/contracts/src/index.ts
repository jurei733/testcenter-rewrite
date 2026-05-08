import type {
  ContentRelease,
  ImportJob,
  OpenMonitorRun,
  ParticipantSession,
  SourcePackage,
  Tenant,
  TestRun,
  Workspace
} from "@testcenter-rewrite-app/domain";

export const productionApiRoutes = {
  platform: {
    createTenant: "/api/v1/platform/tenants"
  },
  workspace: {
    createWorkspace: "/api/v1/tenants/:tenantKey/workspaces",
    createSourcePackage: "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/source-packages",
    createImportJob: "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/import-jobs",
    activateContentRelease:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/content-releases/:contentReleaseId:activate"
  },
  participant: {
    signIn: "/api/v1/participant/auth/sign-in",
    launch: "/api/v1/participant/starter:launch"
  },
  monitor: {
    openRuns: "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/monitor/open-runs"
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
};

export type CreateImportJobRequest = {
  sourcePackageId: string;
};

export type ActivateContentReleaseRequest = {
  activatedByActorId: string;
};

export type ParticipantSignInRequest = {
  workspaceKey: string;
  loginKey: string;
};

export type ParticipantLaunchRequest = {
  participantSessionId: string;
};

export type CreateTenantResponse = {
  tenant: Tenant;
};

export type CreateWorkspaceResponse = {
  workspace: Workspace;
};

export type CreateSourcePackageResponse = {
  sourcePackage: SourcePackage;
};

export type CreateImportJobResponse = {
  importJob: ImportJob;
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

export type MonitorOpenRunsResponse = {
  items: OpenMonitorRun[];
};
