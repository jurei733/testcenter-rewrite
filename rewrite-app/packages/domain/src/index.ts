export type TenantStatus = "active" | "suspended";
export type WorkspaceStatus = "active" | "archived";
export type AdminUserStatus = "active" | "disabled";
export type AdminRole = "platform_admin" | "tenant_admin" | "workspace_admin";
export type AdminAuditEventType =
  | "admin_user_bootstrapped"
  | "admin_sign_in_failed"
  | "admin_sign_in_succeeded"
  | "admin_sign_out"
  | "admin_user_created"
  | "admin_user_updated"
  | "admin_password_reset"
  | "admin_role_assigned"
  | "admin_role_revoked";
export type SourcePackageStatus = "uploaded" | "accepted" | "rejected";
export const sourcePackageStatuses = [
  "uploaded",
  "accepted",
  "rejected"
] as const satisfies readonly SourcePackageStatus[];
export type ImportJobStatus = "queued" | "running" | "failed" | "completed";
export const importJobStatuses = [
  "queued",
  "running",
  "failed",
  "completed"
] as const satisfies readonly ImportJobStatus[];
export type ContentReleaseStatus = "staged" | "active" | "superseded";
export const contentReleaseStatuses = [
  "staged",
  "active",
  "superseded"
] as const satisfies readonly ContentReleaseStatus[];
export type ParticipantSessionStatus = "signed_in" | "launched" | "closed";
export const participantSessionStatuses = [
  "signed_in",
  "launched",
  "closed"
] as const satisfies readonly ParticipantSessionStatus[];
export type TestRunStatus = "created" | "running" | "paused" | "completed";
export const testRunStatuses = [
  "created",
  "running",
  "paused",
  "completed"
] as const satisfies readonly TestRunStatus[];
export const adminAuditEventTypes = [
  "admin_user_bootstrapped",
  "admin_sign_in_failed",
  "admin_sign_in_succeeded",
  "admin_sign_out",
  "admin_user_created",
  "admin_user_updated",
  "admin_password_reset",
  "admin_role_assigned",
  "admin_role_revoked"
] as const satisfies readonly AdminAuditEventType[];
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
  | "participant_roster_imported"
  | "test_run_progress_saved"
  | "test_run_resumed"
  | "test_run_completed"
  | "group_results_deleted"
  | "review_created"
  | "review_updated"
  | "review_deleted";
export const workspaceActivityEventTypes = [
  "workspace_created",
  "source_package_created",
  "import_job_completed",
  "import_job_failed",
  "source_package_import_retried",
  "content_release_activated",
  "content_release_activation_blocked",
  "participant_signed_in",
  "participant_session_resumed",
  "participant_roster_imported",
  "test_run_progress_saved",
  "test_run_resumed",
  "test_run_completed",
  "group_results_deleted",
  "review_created",
  "review_updated",
  "review_deleted"
] as const satisfies readonly WorkspaceActivityEventType[];
export type WorkspaceActivitySubjectType =
  | "workspace"
  | "source_package"
  | "import_job"
  | "content_release"
  | "participant_session"
  | "test_run";
export const workspaceActivitySubjectTypes = [
  "workspace",
  "source_package",
  "import_job",
  "content_release",
  "participant_session",
  "test_run"
] as const satisfies readonly WorkspaceActivitySubjectType[];

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

export type ParticipantRosterEntry = {
  participantRosterEntryId: string;
  tenantId: string;
  workspaceId: string;
  loginKey: string;
  groupKey: string;
  bookletKey: string | null;
  displayName: string | null;
  importedAt: string;
};

export type ParticipantRosterValidationWarning = {
  code: "active_content_release_missing" | "booklet_not_found_in_active_release";
  message: string;
};

export type WorkspaceParticipantRosterItem = ParticipantRosterEntry & {
  validationWarnings: ParticipantRosterValidationWarning[];
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

export type AdminAuditEvent = {
  adminAuditEventId: string;
  eventType: AdminAuditEventType;
  actorAdminUserId: string | null;
  subjectAdminUserId: string | null;
  occurredAt: string;
  summary: string;
  details: Record<string, unknown>;
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
  unitResponses: Record<string, string>;
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
  bookletUnits: Array<{
    unitKey: string;
    displayLabel: string;
  }>;
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

export type WorkspaceStudyMonitorGroup = {
  groupKey: string;
  participantSessionCount: number;
  testRunCount: number;
  notStartedCount: number;
  runningCount: number;
  pausedCount: number;
  completedCount: number;
  responseCount: number;
  reviewCount: number;
  latestActivityAt: string | null;
};

export type WorkspaceStudyMonitorUnitProgress = {
  unitKey: string;
  displayLabel: string;
  expectedRunCount: number;
  responseCount: number;
  missingResponseCount: number;
  unexpectedResponseCount: number;
  completedRunCount: number;
  latestActivityAt: string | null;
};

export type WorkspaceStudyMonitorBookletProgress = {
  bookletKey: string;
  displayLabel: string;
  participantSessionCount: number;
  testRunCount: number;
  createdCount: number;
  runningCount: number;
  pausedCount: number;
  completedCount: number;
  responseCount: number;
  reviewCount: number;
  unitCount: number;
  latestActivityAt: string | null;
};

export type WorkspaceStudyMonitorGroupSession = {
  participantSession: ParticipantSession;
  latestTestRun: TestRun | null;
  testRunCount: number;
  responseCount: number;
  reviewCount: number;
  latestActivityAt: string | null;
};

export type WorkspaceStudyMonitorGroupRun = {
  testRun: TestRun;
  participantSession: ParticipantSession | null;
  responseCount: number;
  reviewCount: number;
};

export type WorkspaceStudyMonitorUnitRun = {
  testRun: TestRun;
  participantSession: ParticipantSession | null;
  expected: boolean;
  answered: boolean;
  response: string | null;
  responseLength: number;
  reviewCount: number;
};

export type WorkspaceStudyMonitorBookletRun = {
  testRun: TestRun;
  participantSession: ParticipantSession | null;
  responseCount: number;
  reviewCount: number;
};

export type WorkspaceStudyMonitorGroupDetail = {
  tenantKey: string;
  workspaceKey: string;
  groupKey: string;
  generatedAt: string;
  participantSessionCount: number;
  testRunCount: number;
  notStartedCount: number;
  runningCount: number;
  pausedCount: number;
  completedCount: number;
  responseCount: number;
  reviewCount: number;
  sessions: WorkspaceStudyMonitorGroupSession[];
  testRuns: WorkspaceStudyMonitorGroupRun[];
  unitProgress: WorkspaceStudyMonitorUnitProgress[];
};

export type WorkspaceStudyMonitorUnitDetail = {
  tenantKey: string;
  workspaceKey: string;
  unitKey: string;
  displayLabel: string;
  generatedAt: string;
  expectedRunCount: number;
  responseCount: number;
  missingResponseCount: number;
  unexpectedResponseCount: number;
  completedRunCount: number;
  reviewCount: number;
  testRuns: WorkspaceStudyMonitorUnitRun[];
};

export type WorkspaceStudyMonitorBookletDetail = {
  tenantKey: string;
  workspaceKey: string;
  bookletKey: string;
  displayLabel: string;
  generatedAt: string;
  participantSessionCount: number;
  testRunCount: number;
  createdCount: number;
  runningCount: number;
  pausedCount: number;
  completedCount: number;
  responseCount: number;
  reviewCount: number;
  unitCount: number;
  testRuns: WorkspaceStudyMonitorBookletRun[];
  unitProgress: WorkspaceStudyMonitorUnitProgress[];
};

export type WorkspaceStudyMonitorSummary = {
  tenantKey: string;
  workspaceKey: string;
  generatedAt: string;
  participantSessionCount: number;
  testRunCount: number;
  notStartedCount: number;
  runningCount: number;
  pausedCount: number;
  completedCount: number;
  responseCount: number;
  reviewCount: number;
  groups: WorkspaceStudyMonitorGroup[];
  bookletProgress: WorkspaceStudyMonitorBookletProgress[];
  unitProgress: WorkspaceStudyMonitorUnitProgress[];
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

export type WorkspaceParticipantSessionRunSummary = {
  testRun: TestRun;
  responseCount: number;
  reviewCount: number;
};

export type WorkspaceParticipantSessionDetail = {
  participantSession: ParticipantSession;
  contentRelease: ContentRelease | null;
  testRuns: TestRun[];
  runSummaries: WorkspaceParticipantSessionRunSummary[];
  responseCount: number;
  reviewCount: number;
  reviews: WorkspaceReview[];
};

export type WorkspaceDetailedResponse = {
  tenantKey: string;
  workspaceKey: string;
  loginKey: string;
  groupKey: string;
  participantSessionId: string;
  testRunId: string;
  bookletKey: string;
  unitKey: string;
  response: string;
  responseLength: number;
  status: TestRun["status"];
  updatedAt: string;
  completedAt: string | null;
};

export type WorkspaceReview = {
  reviewId: string;
  tenantId: string;
  workspaceId: string;
  participantSessionId: string;
  testRunId: string;
  unitKey: string | null;
  reviewerId: string;
  category: string;
  comment: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceReviewListItem = {
  review: WorkspaceReview;
  participantSession: ParticipantSession | null;
  testRun: TestRun | null;
};

export type WorkspaceGroupResultDeletion = {
  tenantKey: string;
  workspaceKey: string;
  groupKey: string;
  deletedTestRunCount: number;
  deletedResponseCount: number;
  deletedReviewCount: number;
  affectedParticipantSessionIds: string[];
  deletedTestRunIds: string[];
};

export type WorkspaceActivityEventListItem = {
  activityEvent: WorkspaceActivityEvent;
};

export type ContentReleaseActivationReadiness = {
  contentRelease: ContentRelease;
  activeContentReleaseId: string | null;
  canActivate: boolean;
  blockingOpenRuns: OpenMonitorRun[];
  participantRosterWarnings: WorkspaceParticipantRosterItem[];
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
