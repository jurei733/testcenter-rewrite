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
export type MonitorRunCommandType =
  | "pause"
  | "resume"
  | "complete"
  | "goto"
  | "unlock_navigation"
  | "lock_navigation"
  | "set_testlet_time";
export const monitorRunCommandTypes = [
  "pause",
  "resume",
  "complete",
  "goto",
  "unlock_navigation",
  "lock_navigation",
  "set_testlet_time"
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
  | "testlet_unlocked"
  | "testlet_timer_started"
  | "testlet_timer_expired"
  | "testlet_leave_lock_activated"
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
  "testlet_unlocked",
  "testlet_timer_started",
  "testlet_timer_expired",
  "testlet_leave_lock_activated",
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
  bookletKeys?: string[];
  bookletStatePresets?: Record<string, Record<string, string>>;
  bookletAssignments?: ParticipantBookletAssignment[];
  displayName: string | null;
  passwordRequired: boolean;
  importedAt: string;
};

export type ParticipantBookletAssignment = {
  assignmentKey: string;
  bookletKey: string;
  statePreset: Record<string, string>;
};

export type ParticipantRosterValidationWarning = {
  code:
    | "active_content_release_missing"
    | "booklet_not_found_in_active_release"
    | "booklet_state_not_found_in_active_release"
    | "booklet_state_option_not_found_in_active_release";
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
  playerEntries?: SourcePackagePlayerEntry[];
};

export type SourcePackagePlayerEntry = {
  playerKey: string;
  html: string;
};

export type SourcePackageBookletEntry = {
  bookletKey: string;
  displayLabel: string;
  config?: Record<string, string>;
  stateEntries?: SourcePackageBookletStateEntry[];
  testletEntries?: SourcePackageTestletEntry[];
  unitEntries: SourcePackageUnitEntry[];
};

export type BookletStateVariableSourceType =
  | "Code"
  | "Value"
  | "Status"
  | "Score";

export type BookletStateVariableSource = {
  type: BookletStateVariableSourceType;
  variableKey: string;
  unitKey: string;
  defaultValue: string;
};

export type BookletStateConditionSource =
  | BookletStateVariableSource
  | {
      type: "Sum" | "Median" | "Mean";
      sources: BookletStateVariableSource[];
    }
  | {
      type: "Count";
      conditions: BookletStateCondition[];
    };

export type BookletStateCondition = {
  source: BookletStateConditionSource;
  expression: {
    type: "equal" | "notEqual" | "greaterThan" | "lowerThan";
    value: string;
  };
};

export type SourcePackageBookletStateEntry = {
  stateKey: string;
  displayLabel: string;
  options: Array<{
    optionKey: string;
    displayLabel: string;
    conditions: BookletStateCondition[];
  }>;
};

export type TestletTimeMaxLeavePolicy = "forbidden" | "confirm" | "allowed";

export type SourcePackageTestletEntry = {
  testletKey: string;
  displayLabel: string;
  parentTestletKey?: string | null;
  restrictions?: {
    show?: {
      stateKey: string;
      optionKey: string;
    };
    codeToEnter?: {
      code: string;
      prompt: string;
    };
    timeMax?: {
      minutes: number;
      leave: TestletTimeMaxLeavePolicy;
    };
    denyNavigationOnIncomplete?: {
      presentation?: BookletLeaveRestriction;
      response?: BookletLeaveRestriction;
    };
    lockAfterLeaving?: {
      confirm: boolean;
      scope: "unit" | "testlet";
    };
  };
};

export type SourcePackageUnitEntry = {
  unitKey: string;
  displayLabel: string;
  testletPath?: string[];
  description?: string;
  content?: string;
  playerKey?: string;
  unitDefinition?: string;
  unitDefinitionType?: string;
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
  playerEntries?: ContentReleasePlayerEntry[];
  resourceEntries?: ContentReleaseResourceEntry[];
};

export type ContentReleasePlayerEntry = {
  playerKey: string;
  html: string;
};

export type ContentReleaseResourceEntry = {
  resourcePath: string;
  mediaType: string;
  dataBase64: string;
};

export type ContentReleaseBookletEntry = {
  bookletKey: string;
  displayLabel: string;
  policy?: BookletRuntimePolicy;
  stateEntries?: SourcePackageBookletStateEntry[];
  testletEntries?: ContentReleaseTestletEntry[];
  unitEntries: ContentReleaseUnitEntry[];
};

export type ContentReleaseTestletEntry = SourcePackageTestletEntry;

export type BookletLeaveRestriction = "off" | "forward" | "always";
export type BookletPlayerEndPolicy = "never" | "last_unit" | "always";
export type BookletUnitNavigationControls = "hidden" | "forward_only" | "both";
export type BookletNavigationDeniedReason =
  | "presentation_incomplete"
  | "response_incomplete"
  | "testlet_code_required"
  | "testlet_time_leave_forbidden"
  | "testlet_time_leave_confirmation_required"
  | "testlet_time_closed"
  | "testlet_leave_confirmation_required"
  | "testlet_leave_locked"
  | "adaptive_unit_hidden";

export type BookletRuntimePolicy = {
  version: 1;
  sourceConfig: Record<string, string>;
  navigation: {
    requirePresentationComplete: BookletLeaveRestriction;
    requireResponseComplete: BookletLeaveRestriction;
    unitMenuEnabled: boolean;
    unitControls: BookletUnitNavigationControls;
    playerEnd: BookletPlayerEndPolicy;
  };
  player: {
    logPolicy: "disabled" | "lean" | "rich" | "debug";
    pagingMode: "separate" | "concat-scroll" | "concat-scroll-snap";
    restoreCurrentPageOnReturn: boolean;
  };
  completion: {
    lockOnTermination: boolean;
  };
  display: {
    headerContent: "none" | "booklet" | "block" | "unit";
    unitTitle: boolean;
    fullscreenPrompt: boolean;
    fullscreenButton: boolean;
  };
  timing: {
    showTimeLeft: boolean;
    warningMinutes: number[];
  };
};

export type ContentReleaseUnitEntry = {
  unitKey: string;
  displayLabel: string;
  testletPath?: string[];
  description?: string;
  content?: string;
  playerKey?: string;
  unitDefinition?: string;
  unitDefinitionType?: string;
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
  bookletAssignmentKey?: string;
  presetBookletStates?: Record<string, string>;
  /** Server-authoritative equivalent of the original persisted BOOKLET_STATES test state. */
  bookletStates?: Record<string, string>;
  status: TestRunStatus;
  currentUnitKey: string | null;
  unitResponses: Record<string, string>;
  unlockedTestletKeys?: string[];
  monitorNavigationUnlocked?: boolean;
  testletTimers?: Record<string, TestletTimerState>;
  lockedTestletKeys?: string[];
  lockedUnitKeys?: string[];
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
};

export type TestletTimerStatus =
  | "running"
  | "paused"
  | "expired"
  | "cancelled";

export type TestletTimerState = {
  testletKey: string;
  status: TestletTimerStatus;
  durationSeconds: number;
  remainingSeconds: number;
  startedAt: string;
  expiresAt: string | null;
  updatedAt: string;
  endedAt: string | null;
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
  bookletAssignmentKey: string;
  bookletStates: Record<string, string>;
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

export type ParticipantSessionScope = {
  tenantKey: string;
  workspaceKey: string;
};

export type ParticipantRuntimeState = {
  participantSession: ParticipantSession;
  participantRosterEntry: ParticipantRosterEntry | null;
  scope: ParticipantSessionScope;
  latestTestRun: TestRun | null;
  booklets: ParticipantRuntimeBooklet[];
  runtimeStatus: ParticipantRuntimeStateStatus;
  availableAction: "launch" | "resume" | "none";
};

export type ParticipantRuntimeBooklet = {
  /** Stable assignment identity; equals bookletKey when no state preset exists. */
  bookletKey: string;
  sourceBookletKey: string;
  statePreset: Record<string, string>;
  displayLabel: string;
  status: "available" | "in_progress" | "completed";
};

export type ParticipantCurrentRunState = {
  participantSession: ParticipantSession;
  participantRosterEntry: ParticipantRosterEntry | null;
  scope: ParticipantSessionScope;
  testRun: TestRun;
  booklet: {
    bookletKey: string;
    displayLabel: string;
    policy: BookletRuntimePolicy;
    testlets: Array<{
      testletKey: string;
      displayLabel: string;
      parentTestletKey: string | null;
      requiresCode: boolean;
      codePrompt: string | null;
      timeMax: {
        minutes: number;
        leave: TestletTimeMaxLeavePolicy;
      } | null;
      lockAfterLeaving: {
        confirm: boolean;
        scope: "unit" | "testlet";
      } | null;
    }>;
  };
  currentUnit: {
    unitKey: string | null;
    displayLabel: string | null;
    description?: string | null;
    content?: string | null;
    player?: ContentReleasePlayerEntry | null;
    unitDefinition?: string | null;
    unitDefinitionType?: string | null;
    testletPath: string[];
  };
  resourceBasePath?: string;
  bookletUnits: Array<{
    unitKey: string;
    displayLabel: string;
    description?: string;
    content?: string;
    testletPath: string[];
    isLocked: boolean;
  }>;
  adaptiveStates: Array<{
    stateKey: string;
    displayLabel: string;
    optionKey: string;
    optionLabel: string;
  }>;
  activeTestletTimer: {
    testletKey: string;
    displayLabel: string;
    status: Extract<TestletTimerStatus, "running" | "paused">;
    durationSeconds: number;
    remainingSeconds: number;
    startedAt: string;
    expiresAt: string | null;
    leave: TestletTimeMaxLeavePolicy;
    showTimeLeft: boolean;
    warningMinutes: number[];
  } | null;
  activeLeaveLock: {
    testletKey: string;
    displayLabel: string;
    unitKey: string;
    unitDisplayLabel: string;
    scope: "unit" | "testlet";
    confirm: boolean;
  } | null;
  booklets: ParticipantRuntimeBooklet[];
  navigation: {
    previousUnitKey: string | null;
    nextUnitKey: string | null;
    canGoPrevious: boolean;
    canGoNext: boolean;
    canComplete: boolean;
    canPlayerEnd: boolean;
    backwardDeniedReasons: BookletNavigationDeniedReason[];
    forwardDeniedReasons: BookletNavigationDeniedReason[];
    nextTestletGate: {
      testletKey: string;
      displayLabel: string;
      prompt: string;
    } | null;
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

export type WorkspaceStudyMonitorRunUnit = {
  unitKey: string;
  displayLabel: string;
  expected: boolean;
  answered: boolean;
  response: string | null;
  responseLength: number;
  reviewCount: number;
  current: boolean;
};

export type WorkspaceStudyMonitorRunDetail = {
  tenantKey: string;
  workspaceKey: string;
  generatedAt: string;
  testRun: TestRun;
  participantSession: ParticipantSession | null;
  participantRosterEntry: ParticipantRosterEntry | null;
  bookletKey: string;
  bookletLabel: string;
  adaptiveStates: ParticipantCurrentRunState["adaptiveStates"];
  responseCount: number;
  reviewCount: number;
  expectedUnitCount: number;
  answeredExpectedUnitCount: number;
  missingExpectedUnitCount: number;
  unexpectedResponseCount: number;
  units: WorkspaceStudyMonitorRunUnit[];
  reviews: WorkspaceReview[];
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
  | "tenant_directory_csv_export"
  | "workspace_lifecycle"
  | "workspace_admin_read"
  | "workspace_directory_csv_export"
  | "workspace_overview_csv_export"
  | "workspace_activity_read"
  | "source_package_intake"
  | "source_package_read"
  | "source_package_csv_export"
  | "source_package_retry"
  | "import_job_intake"
  | "import_job_read"
  | "import_job_csv_export"
  | "content_release_read"
  | "content_release_csv_export"
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
  | "study_monitor_run_csv_export"
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
  "tenant_directory_csv_export",
  "workspace_lifecycle",
  "workspace_admin_read",
  "workspace_directory_csv_export",
  "workspace_overview_csv_export",
  "workspace_activity_read",
  "source_package_intake",
  "source_package_read",
  "source_package_csv_export",
  "source_package_retry",
  "import_job_intake",
  "import_job_read",
  "import_job_csv_export",
  "content_release_read",
  "content_release_csv_export",
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
  "study_monitor_run_csv_export",
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
