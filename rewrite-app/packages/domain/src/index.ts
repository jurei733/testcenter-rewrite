export type TenantStatus = "active" | "suspended";
export type WorkspaceStatus = "active" | "archived";
export type AdminUserStatus = "active" | "disabled";
export type AdminRole = "platform_admin" | "tenant_admin" | "workspace_admin";
export type SourcePackageStatus = "uploaded" | "accepted" | "rejected";
export type ImportJobStatus = "queued" | "running" | "failed" | "completed";
export type ContentReleaseStatus = "staged" | "active" | "superseded";
export type ParticipantSessionStatus = "signed_in" | "launched" | "closed";
export type TestRunStatus = "created" | "running" | "paused" | "completed";
export type WorkspaceActivityEventType =
  | "workspace_created"
  | "source_package_created"
  | "import_job_completed"
  | "import_job_failed"
  | "source_package_import_retried"
  | "content_release_activated"
  | "content_release_activation_blocked"
  | "participant_signed_in"
  | "participant_session_resumed"
  | "test_run_progress_saved"
  | "test_run_resumed"
  | "test_run_completed";
export type WorkspaceActivitySubjectType =
  | "workspace"
  | "source_package"
  | "import_job"
  | "content_release"
  | "participant_session"
  | "test_run";

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

export type AdminUser = {
  adminUserId: string;
  username: string;
  displayName: string;
  passwordHash: string;
  status: AdminUserStatus;
  createdAt: string;
};

export type AdminSession = {
  adminSessionId: string;
  adminUserId: string;
  token: string;
  createdAt: string;
  expiresAt: string;
  revokedAt: string | null;
};

export type AdminRoleAssignment = {
  roleAssignmentId: string;
  adminUserId: string;
  role: AdminRole;
  tenantId: string | null;
  workspaceId: string | null;
  createdAt: string;
};

export type SourcePackage = {
  sourcePackageId: string;
  tenantId: string;
  workspaceId: string;
  fileName: string;
  mediaType: string;
  contentStructure: SourcePackageContentStructure | null;
  sourceDocument: string | null;
  status: SourcePackageStatus;
  uploadedAt: string;
};

export type SourcePackageContentStructure = {
  bookletEntries: SourcePackageBookletEntry[];
};

export type SourcePackageBookletEntry = {
  bookletKey: string;
  displayLabel: string;
  unitEntries: SourcePackageUnitEntry[];
};

export type SourcePackageUnitEntry = {
  unitKey: string;
  displayLabel: string;
};

export type ImportJob = {
  importJobId: string;
  tenantId: string;
  workspaceId: string;
  sourcePackageId: string;
  status: ImportJobStatus;
  createdAt: string;
  finishedAt: string | null;
  diagnostics: ImportJobDiagnostic[];
};

export type ImportJobDiagnostic = {
  severity: "error" | "warning";
  code: string;
  message: string;
};

export type ContentRelease = {
  contentReleaseId: string;
  tenantId: string;
  workspaceId: string;
  importJobId: string;
  releaseLabel: string;
  runtimeSnapshot: ContentReleaseRuntimeSnapshot;
  status: ContentReleaseStatus;
  createdAt: string;
  activatedAt: string | null;
};

export type ContentReleaseRuntimeSnapshot = {
  bookletEntries: ContentReleaseBookletEntry[];
};

export type ContentReleaseBookletEntry = {
  bookletKey: string;
  displayLabel: string;
  unitEntries: ContentReleaseUnitEntry[];
};

export type ContentReleaseUnitEntry = {
  unitKey: string;
  displayLabel: string;
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
  completedAt: string | null;
};

export type WorkspaceActivityEvent = {
  activityEventId: string;
  tenantId: string;
  workspaceId: string;
  eventType: WorkspaceActivityEventType;
  actorId: string | null;
  subjectType: WorkspaceActivitySubjectType;
  subjectId: string;
  occurredAt: string;
  summary: string;
  details: Record<string, unknown>;
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

export type ParticipantRuntimeStateStatus =
  | "ready_to_launch"
  | "in_progress"
  | "completed";

export type ParticipantRuntimeState = {
  participantSession: ParticipantSession;
  latestTestRun: TestRun | null;
  runtimeStatus: ParticipantRuntimeStateStatus;
  availableAction: "launch" | "resume" | "none";
};

export type ParticipantCurrentRunState = {
  participantSession: ParticipantSession;
  testRun: TestRun;
  booklet: {
    bookletKey: string;
    displayLabel: string;
  };
  currentUnit: {
    unitKey: string | null;
    displayLabel: string | null;
  };
  availableActions: Array<"save_progress" | "resume" | "complete">;
};

export type WorkspaceOverview = {
  tenant: Tenant;
  workspace: Workspace;
  sourcePackageCount: number;
  importJobCount: number;
  contentReleaseCount: number;
  activeContentReleaseId: string | null;
  latestImportJobAt: string | null;
  participantSessionCount: number;
  openTestRunCount: number;
};

export type WorkspaceContentReleaseListItem = {
  contentRelease: ContentRelease;
  importJob: ImportJob | null;
  sourcePackage: SourcePackage | null;
  participantSessionCount: number;
  openTestRunCount: number;
};

export type WorkspaceContentReleaseDetail = {
  contentRelease: ContentRelease;
  importJob: ImportJob | null;
  sourcePackage: SourcePackage | null;
  participantSessions: ParticipantSession[];
  testRuns: TestRun[];
  previousActivatedContentReleaseId: string | null;
  nextActivatedContentReleaseId: string | null;
  workspaceReleaseHistory: WorkspaceContentReleaseListItem[];
};

export type WorkspaceSourcePackageListItem = {
  sourcePackage: SourcePackage;
  latestImportJob: ImportJob | null;
};

export type WorkspaceImportJobListItem = {
  importJob: ImportJob;
  sourcePackage: SourcePackage | null;
};

export type WorkspaceImportJobDetail = {
  importJob: ImportJob;
  sourcePackage: SourcePackage | null;
  contentRelease: ContentRelease | null;
};

export type WorkspaceParticipantSessionListItem = {
  participantSession: ParticipantSession;
  latestTestRun: TestRun | null;
  contentRelease: ContentRelease | null;
};

export type WorkspaceParticipantSessionDetail = {
  participantSession: ParticipantSession;
  contentRelease: ContentRelease | null;
  testRuns: TestRun[];
};

export type WorkspaceActivityEventListItem = {
  activityEvent: WorkspaceActivityEvent;
};

export type ContentReleaseActivationReadiness = {
  contentRelease: ContentRelease;
  activeContentReleaseId: string | null;
  canActivate: boolean;
  blockingOpenRuns: OpenMonitorRun[];
};

export type WorkspaceSourcePackageDetail = {
  sourcePackage: SourcePackage;
  importJobs: ImportJob[];
  contentReleases: ContentRelease[];
};

export type FirstSliceCapability =
  | "admin_bootstrap"
  | "admin_authentication"
  | "admin_session_lifecycle"
  | "admin_role_assignment"
  | "tenant_lifecycle"
  | "workspace_lifecycle"
  | "workspace_admin_read"
  | "workspace_activity_read"
  | "source_package_intake"
  | "import_job_intake"
  | "content_release_activation"
  | "participant_sign_in"
  | "participant_launch"
  | "participant_runtime_state"
  | "participant_current_run_state"
  | "test_run_progress"
  | "test_run_lifecycle"
  | "monitor_open_runs";

export const firstProductionSliceCapabilities: FirstSliceCapability[] = [
  "admin_bootstrap",
  "admin_authentication",
  "admin_session_lifecycle",
  "admin_role_assignment",
  "tenant_lifecycle",
  "workspace_lifecycle",
  "workspace_admin_read",
  "workspace_activity_read",
  "source_package_intake",
  "import_job_intake",
  "content_release_activation",
  "participant_sign_in",
  "participant_launch",
  "participant_runtime_state",
  "participant_current_run_state",
  "test_run_progress",
  "test_run_lifecycle",
  "monitor_open_runs"
];
