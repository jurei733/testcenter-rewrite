export type TenantStatus = "active" | "suspended";
export type WorkspaceStatus = "active" | "archived";
export type SourcePackageStatus = "uploaded" | "accepted" | "rejected";
export type ImportJobStatus = "queued" | "running" | "failed" | "completed";
export type ContentReleaseStatus = "staged" | "active" | "superseded";
export type ParticipantSessionStatus = "signed_in" | "launched" | "closed";
export type TestRunStatus = "created" | "running" | "paused" | "completed";

export type Tenant = {
  tenantId: string;
  tenantKey: string;
  displayName: string;
  status: TenantStatus;
  createdAt: string;
};

export type Workspace = {
  workspaceId: string;
  tenantId: string;
  workspaceKey: string;
  displayName: string;
  status: WorkspaceStatus;
  createdAt: string;
};

export type SourcePackage = {
  sourcePackageId: string;
  tenantId: string;
  workspaceId: string;
  fileName: string;
  mediaType: string;
  status: SourcePackageStatus;
  uploadedAt: string;
};

export type ImportJob = {
  importJobId: string;
  tenantId: string;
  workspaceId: string;
  sourcePackageId: string;
  status: ImportJobStatus;
  createdAt: string;
};

export type ContentRelease = {
  contentReleaseId: string;
  tenantId: string;
  workspaceId: string;
  importJobId: string;
  releaseLabel: string;
  status: ContentReleaseStatus;
  createdAt: string;
  activatedAt: string | null;
};

export type ParticipantSession = {
  participantSessionId: string;
  tenantId: string;
  workspaceId: string;
  contentReleaseId: string;
  loginKey: string;
  groupKey: string;
  status: ParticipantSessionStatus;
  createdAt: string;
};

export type TestRun = {
  testRunId: string;
  participantSessionId: string;
  tenantId: string;
  workspaceId: string;
  contentReleaseId: string;
  bookletKey: string;
  status: TestRunStatus;
  currentUnitKey: string | null;
  createdAt: string;
  updatedAt: string;
};

export type OpenMonitorRun = {
  testRunId: string;
  loginKey: string;
  groupKey: string;
  bookletKey: string;
  status: TestRunStatus;
  currentUnitKey: string | null;
  updatedAt: string;
};

export type FirstSliceCapability =
  | "tenant_lifecycle"
  | "workspace_lifecycle"
  | "source_package_intake"
  | "import_job_intake"
  | "content_release_activation"
  | "participant_sign_in"
  | "participant_launch"
  | "test_run_lifecycle"
  | "monitor_open_runs";

export const firstProductionSliceCapabilities: FirstSliceCapability[] = [
  "tenant_lifecycle",
  "workspace_lifecycle",
  "source_package_intake",
  "import_job_intake",
  "content_release_activation",
  "participant_sign_in",
  "participant_launch",
  "test_run_lifecycle",
  "monitor_open_runs"
];
