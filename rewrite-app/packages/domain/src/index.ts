export type TenantStatus = "active" | "suspended";
export type WorkspaceStatus = "active" | "archived";
export type AdminUserStatus = "active" | "disabled";
export type AdminRole = "platform_admin" | "tenant_admin" | "workspace_admin";
export type AdminAuditEventType =
  | "admin_user_bootstrapped"
  | "admin_sign_in_failed"
  | "admin_sign_in_succeeded"
  | "admin_sign_out"
  | "admin_session_revoked"
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
export type MonitorRunCommandType = "pause" | "resume" | "complete";
export const monitorRunCommandTypes = [
  "pause",
  "resume",
  "complete"
] as const satisfies readonly MonitorRunCommandType[];
export const adminAuditEventTypes = [
  "admin_user_bootstrapped",
  "admin_sign_in_failed",
  "admin_sign_in_succeeded",
  "admin_sign_out",
  "admin_session_revoked",
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
  | "monitor_run_command_issued"
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
  "monitor_run_command_issued",
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

export type AdminSessionStatus = "active" | "expired" | "revoked";

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
  description?: string;
  content?: string;
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
  description?: string;
  content?: string;
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
  participantSessionId: string;
  loginKey: string;
  groupKey: string;
  participantRosterEntry: ParticipantRosterEntry | null;
  bookletKey: string;
  status: TestRunStatus;
  currentUnitKey: string | null;
  updatedAt: string;
};

export type MonitorRunCommandResult = {
  commandId: string;
  commandType: MonitorRunCommandType;
  actorId: string | null;
  issuedAt: string;
  previousStatus: TestRunStatus;
  testRun: TestRun;
  participantSession: ParticipantSession;
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
    description?: string | null;
    content?: string | null;
  };
  bookletUnits: Array<{
    unitKey: string;
    displayLabel: string;
    description?: string;
    content?: string;
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
  expectedParticipantCount: number;
  rosterEntryCount: number;
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
  rosterExpectedCount: number;
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
  expectedParticipantCount: number;
  rosterEntryCount: number;
  participantSessionCount: number;
  testRunCount: number;
  notStartedCount: number;
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
  participantRosterEntry: ParticipantRosterEntry | null;
  latestTestRun: TestRun | null;
  testRunCount: number;
  responseCount: number;
  reviewCount: number;
  latestActivityAt: string | null;
};

export type WorkspaceStudyMonitorGroupRun = {
  testRun: TestRun;
  participantSession: ParticipantSession | null;
  participantRosterEntry: ParticipantRosterEntry | null;
  responseCount: number;
  reviewCount: number;
};

export type WorkspaceStudyMonitorUnitRun = {
  testRun: TestRun;
  participantSession: ParticipantSession | null;
  participantRosterEntry: ParticipantRosterEntry | null;
  expected: boolean;
  answered: boolean;
  response: string | null;
  responseLength: number;
  reviewCount: number;
};

export type WorkspaceStudyMonitorBookletRun = {
  testRun: TestRun;
  participantSession: ParticipantSession | null;
  participantRosterEntry: ParticipantRosterEntry | null;
  responseCount: number;
  reviewCount: number;
};

export type WorkspaceStudyMonitorParticipantMatrixRow = {
  tenantKey: string;
  workspaceKey: string;
  loginKey: string;
  groupKey: string;
  displayName: string | null;
  rosterBookletKey: string | null;
  participantSessionId: string | null;
  participantSessionStatus: ParticipantSessionStatus | "not_started";
  testRunId: string | null;
  testRunStatus: TestRunStatus | "not_started";
  bookletKey: string | null;
  unitKey: string;
  unitLabel: string;
  expected: boolean;
  answered: boolean;
  responseLength: number;
  reviewCount: number;
  latestActivityAt: string | null;
};

export type WorkspaceStudyMonitorParticipantMatrix = {
  tenantKey: string;
  workspaceKey: string;
  generatedAt: string;
  rows: WorkspaceStudyMonitorParticipantMatrixRow[];
};

export type WorkspaceStudyMonitorParticipantRun = {
  testRun: TestRun;
  participantSession: ParticipantSession | null;
  responseCount: number;
  reviewCount: number;
};

export type WorkspaceStudyMonitorParticipantDetail = {
  tenantKey: string;
  workspaceKey: string;
  loginKey: string;
  groupKey: string | null;
  displayName: string | null;
  rosterBookletKey: string | null;
  generatedAt: string;
  rosterEntry: ParticipantRosterEntry | null;
  participantSessionCount: number;
  testRunCount: number;
  responseCount: number;
  reviewCount: number;
  latestActivityAt: string | null;
  sessions: ParticipantSession[];
  testRuns: WorkspaceStudyMonitorParticipantRun[];
  unitRows: WorkspaceStudyMonitorParticipantMatrixRow[];
};

export type WorkspaceStudyMonitorGroupDetail = {
  tenantKey: string;
  workspaceKey: string;
  groupKey: string;
  generatedAt: string;
  expectedParticipantCount: number;
  rosterEntryCount: number;
  participantSessionCount: number;
  testRunCount: number;
  notStartedCount: number;
  runningCount: number;
  pausedCount: number;
  completedCount: number;
  responseCount: number;
  reviewCount: number;
  rosterEntries: ParticipantRosterEntry[];
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
  rosterExpectedCount: number;
  expectedRunCount: number;
  responseCount: number;
  missingResponseCount: number;
  unexpectedResponseCount: number;
  completedRunCount: number;
  reviewCount: number;
  rosterEntries: ParticipantRosterEntry[];
  testRuns: WorkspaceStudyMonitorUnitRun[];
};

export type WorkspaceStudyMonitorBookletDetail = {
  tenantKey: string;
  workspaceKey: string;
  bookletKey: string;
  displayLabel: string;
  generatedAt: string;
  expectedParticipantCount: number;
  rosterEntryCount: number;
  participantSessionCount: number;
  testRunCount: number;
  notStartedCount: number;
  createdCount: number;
  runningCount: number;
  pausedCount: number;
  completedCount: number;
  responseCount: number;
  reviewCount: number;
  unitCount: number;
  rosterEntries: ParticipantRosterEntry[];
  testRuns: WorkspaceStudyMonitorBookletRun[];
  unitProgress: WorkspaceStudyMonitorUnitProgress[];
};

export type WorkspaceStudyMonitorAttentionItem = {
  subjectType: "unit" | "group" | "booklet";
  key: string;
  label: string;
  score: number;
  missingResponseCount: number;
  unexpectedResponseCount: number;
  notStartedCount: number;
  runningCount: number;
  pausedCount: number;
  responseCount: number;
  reviewCount: number;
  latestActivityAt: string | null;
};

export type WorkspaceStudyMonitorSummary = {
  tenantKey: string;
  workspaceKey: string;
  generatedAt: string;
  expectedParticipantCount: number;
  rosterEntryCount: number;
  participantSessionCount: number;
  testRunCount: number;
  notStartedCount: number;
  runningCount: number;
  pausedCount: number;
  completedCount: number;
  responseCount: number;
  reviewCount: number;
  notStartedParticipants: ParticipantRosterEntry[];
  groups: WorkspaceStudyMonitorGroup[];
  bookletProgress: WorkspaceStudyMonitorBookletProgress[];
  unitProgress: WorkspaceStudyMonitorUnitProgress[];
  attentionItems: WorkspaceStudyMonitorAttentionItem[];
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
  participantRosterEntries: ParticipantRosterEntry[];
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
  participantRosterEntry: ParticipantRosterEntry | null;
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
  participantRosterEntry: ParticipantRosterEntry | null;
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
  participantRosterEntry: ParticipantRosterEntry | null;
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
  participantRosterEntry: ParticipantRosterEntry | null;
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
  | "admin_session_read"
  | "admin_session_revoke"
  | "admin_session_csv_export"
  | "admin_role_assignment"
  | "admin_user_directory"
  | "admin_user_csv_export"
  | "admin_audit_read"
  | "admin_audit_csv_export"
  | "tenant_lifecycle"
  | "workspace_lifecycle"
  | "workspace_admin_read"
  | "workspace_activity_read"
  | "source_package_intake"
  | "source_package_read"
  | "source_package_retry"
  | "import_job_intake"
  | "import_job_read"
  | "content_release_read"
  | "content_release_readiness"
  | "content_release_activation"
  | "participant_roster_import"
  | "participant_roster_read"
  | "participant_roster_csv_export"
  | "participant_session_read"
  | "participant_session_csv_export"
  | "detailed_response_read"
  | "response_csv_export"
  | "review_workflow"
  | "review_csv_export"
  | "log_csv_export"
  | "study_monitor_csv_export"
  | "study_monitor_participant_matrix_csv_export"
  | "result_deletion"
  | "study_monitor_read"
  | "study_monitor_attention"
  | "monitor_open_runs_csv_export"
  | "monitor_run_control"
  | "participant_sign_in"
  | "participant_launch"
  | "participant_runtime_state"
  | "participant_current_run_state"
  | "test_run_progress"
  | "test_run_lifecycle"
  | "monitor_open_runs"
  | "system_diagnostics"
  | "frontend_shell";

export const firstProductionSliceCapabilities: FirstSliceCapability[] = [
  "admin_bootstrap",
  "admin_authentication",
  "admin_session_lifecycle",
  "admin_session_read",
  "admin_session_revoke",
  "admin_session_csv_export",
  "admin_role_assignment",
  "admin_user_directory",
  "admin_user_csv_export",
  "admin_audit_read",
  "admin_audit_csv_export",
  "tenant_lifecycle",
  "workspace_lifecycle",
  "workspace_admin_read",
  "workspace_activity_read",
  "source_package_intake",
  "source_package_read",
  "source_package_retry",
  "import_job_intake",
  "import_job_read",
  "content_release_read",
  "content_release_readiness",
  "content_release_activation",
  "participant_roster_import",
  "participant_roster_read",
  "participant_roster_csv_export",
  "participant_session_read",
  "participant_session_csv_export",
  "detailed_response_read",
  "response_csv_export",
  "review_workflow",
  "review_csv_export",
  "log_csv_export",
  "study_monitor_csv_export",
  "study_monitor_participant_matrix_csv_export",
  "result_deletion",
  "study_monitor_read",
  "study_monitor_attention",
  "monitor_open_runs_csv_export",
  "monitor_run_control",
  "participant_sign_in",
  "participant_launch",
  "participant_runtime_state",
  "participant_current_run_state",
  "test_run_progress",
  "test_run_lifecycle",
  "monitor_open_runs",
  "system_diagnostics",
  "frontend_shell"
];
