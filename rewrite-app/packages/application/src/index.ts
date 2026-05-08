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

export type PlatformPort = {
  createTenant(input: { tenantKey: string; displayName: string }): Promise<Tenant>;
  createWorkspace(input: {
    tenantKey: string;
    workspaceKey: string;
    displayName: string;
  }): Promise<Workspace>;
};

export type ContentIntakePort = {
  createSourcePackage(input: {
    tenantKey: string;
    workspaceKey: string;
    fileName: string;
    mediaType: string;
  }): Promise<SourcePackage>;
  createImportJob(input: {
    tenantKey: string;
    workspaceKey: string;
    sourcePackageId: string;
  }): Promise<ImportJob>;
  activateContentRelease(input: {
    tenantKey: string;
    workspaceKey: string;
    contentReleaseId: string;
    activatedByActorId: string;
  }): Promise<ContentRelease>;
};

export type ParticipantRuntimePort = {
  signIn(input: {
    workspaceKey: string;
    loginKey: string;
  }): Promise<ParticipantSession>;
  launch(input: { participantSessionId: string }): Promise<TestRun>;
};

export type MonitorReadPort = {
  listOpenRuns(input: {
    tenantKey: string;
    workspaceKey: string;
  }): Promise<OpenMonitorRun[]>;
};

export type FirstSlicePorts = {
  platform: PlatformPort;
  contentIntake: ContentIntakePort;
  participantRuntime: ParticipantRuntimePort;
  monitorRead: MonitorReadPort;
};

export const firstSliceUseCases = {
  createTenant: "CreateTenant",
  createWorkspace: "CreateWorkspace",
  createSourcePackage: "CreateSourcePackage",
  createImportJob: "CreateImportJob",
  activateContentRelease: "ActivateContentRelease",
  participantSignIn: "ParticipantSignIn",
  participantLaunch: "ParticipantLaunch",
  listOpenMonitorRuns: "ListOpenMonitorRuns"
} as const;
