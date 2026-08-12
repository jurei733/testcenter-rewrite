export type TenantStatus = "active" | "suspended";
export type WorkspaceStatus = "active" | "archived";
export type AdminUserStatus = "active" | "disabled";
export type AdminRole =
  | "platform_admin"
  | "tenant_admin"
  | "workspace_admin"
  | "study_monitor"
  | "group_monitor"
  | "system_check";
export type AdminRoleAccessMode = "read_write" | "read_only";
export type AdminAuditEventType =
  | "admin_user_bootstrapped"
  | "admin_sign_in_failed"
  | "admin_sign_in_succeeded"
  | "admin_sign_out"
  | "admin_session_revoked"
  | "admin_user_created"
  | "admin_user_updated"
  | "admin_user_deleted"
  | "admin_password_reset"
  | "admin_password_changed"
  | "admin_role_assigned"
  | "admin_role_revoked"
  | "workspace_deleted"
  | "application_asset_uploaded"
  | "application_asset_deleted"
  | "application_settings_updated";
export type SourcePackageStatus = "uploaded" | "accepted" | "rejected";
export const sourcePackageStatuses = [
  "uploaded",
  "accepted",
  "rejected"
] as const satisfies readonly SourcePackageStatus[];
export type WorkspaceFileType =
  | "Testtakers"
  | "Booklet"
  | "SysCheck"
  | "Unit"
  | "Resource"
  | "Package";
export const workspaceFileTypes = [
  "Testtakers",
  "Booklet",
  "SysCheck",
  "Unit",
  "Resource",
  "Package"
] as const satisfies readonly WorkspaceFileType[];
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
export type TestRunPauseSource = "participant" | "monitor";
export const testRunStatuses = [
  "created",
  "running",
  "paused",
  "completed"
] as const satisfies readonly TestRunStatus[];

export type ParticipantExecutionMode =
  | "run-demo"
  | "run-hot-return"
  | "run-hot-restart"
  | "run-review"
  | "run-trial"
  | "run-simulation";

export type ParticipantExecutionModeDefinition = {
  mode: ParticipantExecutionMode;
  label: string;
  alwaysNewSession: boolean;
  monitorable: boolean;
  canReview: boolean;
  saveResponses: boolean;
  forceTimeRestrictions: boolean;
  forceNaviRestrictions: boolean;
  presetCode: boolean;
  showTimeLeft: boolean;
  showUnitMenu: boolean;
  receiveRemoteCommands: boolean;
  canChangeStateOptions: boolean;
};

export const participantExecutionModes = [
  "run-demo",
  "run-hot-return",
  "run-hot-restart",
  "run-review",
  "run-trial",
  "run-simulation"
] as const satisfies readonly ParticipantExecutionMode[];

export const defaultParticipantExecutionMode = "run-hot-return" as const;

export const participantExecutionModeDefinitions: Record<
  ParticipantExecutionMode,
  ParticipantExecutionModeDefinition
> = {
  "run-demo": {
    mode: "run-demo",
    label: "Nur Ansicht (Demo)",
    alwaysNewSession: false,
    monitorable: false,
    canReview: false,
    saveResponses: false,
    forceTimeRestrictions: false,
    forceNaviRestrictions: false,
    presetCode: true,
    showTimeLeft: false,
    showUnitMenu: false,
    receiveRemoteCommands: false,
    canChangeStateOptions: true
  },
  "run-hot-return": {
    mode: "run-hot-return",
    label: "Durchführung Test/Befragung",
    alwaysNewSession: false,
    monitorable: true,
    canReview: false,
    saveResponses: true,
    forceTimeRestrictions: true,
    forceNaviRestrictions: true,
    presetCode: false,
    showTimeLeft: false,
    showUnitMenu: false,
    receiveRemoteCommands: true,
    canChangeStateOptions: false
  },
  "run-hot-restart": {
    mode: "run-hot-restart",
    label: "Durchführung Test/Befragung",
    alwaysNewSession: true,
    monitorable: true,
    canReview: false,
    saveResponses: true,
    forceTimeRestrictions: true,
    forceNaviRestrictions: true,
    presetCode: false,
    showTimeLeft: false,
    showUnitMenu: false,
    receiveRemoteCommands: true,
    canChangeStateOptions: false
  },
  "run-review": {
    mode: "run-review",
    label: "Prüfdurchgang ohne Speichern",
    alwaysNewSession: false,
    monitorable: false,
    canReview: true,
    saveResponses: false,
    forceTimeRestrictions: false,
    forceNaviRestrictions: false,
    presetCode: true,
    showTimeLeft: true,
    showUnitMenu: true,
    receiveRemoteCommands: false,
    canChangeStateOptions: true
  },
  "run-trial": {
    mode: "run-trial",
    label: "Prüfdurchgang mit Speichern und Reviewfunktionalität",
    alwaysNewSession: false,
    monitorable: true,
    canReview: true,
    saveResponses: true,
    forceTimeRestrictions: false,
    forceNaviRestrictions: false,
    presetCode: true,
    showTimeLeft: true,
    showUnitMenu: true,
    receiveRemoteCommands: false,
    canChangeStateOptions: true
  },
  "run-simulation": {
    mode: "run-simulation",
    label:
      "Prüfdurchgang ohne Speichern, ohne Reviewfunktionalität aber mit Beschränkungen",
    alwaysNewSession: false,
    monitorable: false,
    canReview: false,
    saveResponses: false,
    forceTimeRestrictions: true,
    forceNaviRestrictions: true,
    presetCode: false,
    showTimeLeft: false,
    showUnitMenu: false,
    receiveRemoteCommands: false,
    canChangeStateOptions: false
  }
};
export type MonitorRunCommandType =
  | "pause"
  | "resume"
  | "complete"
  | "complete_and_lock"
  | "goto"
  | "lock_test"
  | "unlock_test"
  | "unlock_navigation"
  | "lock_navigation"
  | "set_testlet_time";
export const monitorRunCommandTypes = [
  "pause",
  "resume",
  "complete",
  "complete_and_lock",
  "goto",
  "lock_test",
  "unlock_test",
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
  "admin_user_deleted",
  "admin_password_reset",
  "admin_password_changed",
  "admin_role_assigned",
  "admin_role_revoked",
  "workspace_deleted",
  "application_asset_uploaded",
  "application_asset_deleted",
  "application_settings_updated"
] as const satisfies readonly AdminAuditEventType[];
export type WorkspaceActivityEventType =
  | "workspace_created"
  | "workspace_updated"
  | "source_package_created"
  | "source_package_assembled"
  | "source_package_replaced"
  | "source_package_deleted"
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
  | "test_run_locked"
  | "test_run_completed"
  | "monitor_run_command_issued"
  | "group_results_deleted"
  | "review_created"
  | "review_updated"
  | "review_deleted"
  | "attachment_file_uploaded"
  | "attachment_file_deleted"
  | "system_check_report_saved"
  | "system_check_reports_deleted";
export const workspaceActivityEventTypes = [
  "workspace_created",
  "workspace_updated",
  "source_package_created",
  "source_package_assembled",
  "source_package_replaced",
  "source_package_deleted",
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
  "test_run_locked",
  "test_run_completed",
  "monitor_run_command_issued",
  "group_results_deleted",
  "review_created",
  "review_updated",
  "review_deleted",
  "attachment_file_uploaded",
  "attachment_file_deleted",
  "system_check_report_saved",
  "system_check_reports_deleted"
] as const satisfies readonly WorkspaceActivityEventType[];
export type WorkspaceActivitySubjectType =
  | "workspace"
  | "source_package"
  | "import_job"
  | "content_release"
  | "participant_session"
  | "test_run"
  | "system_check_report";
export const workspaceActivitySubjectTypes = [
  "workspace",
  "source_package",
  "import_job",
  "content_release",
  "participant_session",
  "test_run",
  "system_check_report"
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

export type WorkspaceDirectoryItem = Workspace & {
  latestFileModificationAt: string | null;
};

export const participantCodeInputTypes = [
  "text-field",
  "keypad-symbols",
  "keypad-symbols-alt",
  "keypad-numbers"
] as const;

export type ParticipantCodeInputType =
  (typeof participantCodeInputTypes)[number];

export type ParticipantViewSettings = {
  theme?: string;
  codeInput?: {
    type: ParticipantCodeInputType;
    length?: number;
  };
};

export type ParticipantRosterEntry = {
  participantRosterEntryId: string;
  tenantId: string;
  workspaceId: string;
  loginKey: string;
  executionMode?: ParticipantExecutionMode;
  groupKey: string;
  /** Authored Original Testtakers Group/@label; the key remains the stable scope. */
  groupLabel?: string | null;
  bookletKey: string | null;
  bookletKeys?: string[];
  bookletStatePresets?: Record<string, Record<string, string>>;
  bookletAssignments?: ParticipantBookletAssignment[];
  displayName: string | null;
  passwordRequired: boolean;
  validFrom?: string | null;
  validTo?: string | null;
  validForMinutes?: number | null;
  customTexts?: Record<string, string>;
  viewSettings?: ParticipantViewSettings;
  /** Original application asset filenames keyed by the Testtakers slot name. */
  assetAssignments?: Record<string, string>;
  importedAt: string;
};

export type ParticipantLoginAttempt = {
  tenantId: string;
  workspaceId: string;
  loginKey: string;
  failedAttempts: number;
  expiresAt: string;
  updatedAt: string;
};

export type AdminLoginAttempt = {
  username: string;
  failedAttempts: number;
  expiresAt: string;
  updatedAt: string;
};

export type ParticipantBookletAssignment = {
  assignmentKey: string;
  bookletKey: string;
  statePreset: Record<string, string>;
  accessCodes?: string[];
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
  passwordChangeRequired: boolean;
  status: AdminUserStatus;
  customTexts: Record<string, string>;
  validFrom: string | null;
  validTo: string | null;
  validForMinutes: number | null;
  firstSignedInAt: string | null;
  createdAt: string;
};

export const applicationThemeNames = [
  "Primar",
  "Sekundar",
  "Erwachsene"
] as const;

export type ApplicationThemeName = (typeof applicationThemeNames)[number];

export type ApplicationAssetMediaType =
  | "image/png"
  | "image/jpeg"
  | "image/webp";

export type ApplicationAsset = {
  applicationAssetId: string;
  originalName: string;
  mediaType: ApplicationAssetMediaType;
  dataBase64: string;
  byteLength: number;
  createdAt: string;
  updatedAt: string;
};

export const applicationAssetSlotNames = [
  "logo",
  "loginIllustration",
  "codeInputIllustration",
  "codeInputCompanion",
  "starterCompanion",
  "starterCardDone",
  "loadingProgress",
  "confirmDialog"
] as const;

export type ApplicationAssetSlotName =
  (typeof applicationAssetSlotNames)[number];

export type ApplicationSettings = {
  appTitle: string;
  mainLogo: string;
  themeName: ApplicationThemeName;
  /** Original instance Startseite HTML, rendered through the frontend sanitizer. */
  introHtml: string;
  /** Original public Impressum/Datenschutz HTML, rendered through the frontend sanitizer. */
  legalNoticeHtml: string;
  customTexts: Record<string, string>;
  assetAssignments: Partial<Record<ApplicationAssetSlotName, string>>;
  globalWarningText: string | null;
  globalWarningExpiresAt: string | null;
  updatedAt: string | null;
  updatedByAdminUserId: string | null;
};

export const defaultApplicationSettings: ApplicationSettings = {
  appTitle: "IQB-Testcenter",
  mainLogo: "app-icon.svg",
  themeName: "Primar",
  introHtml: "",
  legalNoticeHtml: "",
  customTexts: {},
  assetAssignments: {},
  globalWarningText: null,
  globalWarningExpiresAt: null,
  updatedAt: null,
  updatedByAdminUserId: null
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

export type MonitorViewProfileFilter = {
  target: string;
  value: string | string[];
  subValue: string | null;
  label: string;
  type: string;
  not: boolean;
};

export type MonitorViewProfile = {
  profileId: string;
  label: string;
  settings: {
    blockColumn: string;
    unitColumn: string;
    view: string;
    groupColumn: string;
    bookletColumn: string;
    bookletStatesColumns: string;
    autoselectNextBlock: "yes" | "no";
  };
  filters: MonitorViewProfileFilter[];
  filtersEnabled: {
    pending: string;
    locked: string;
  };
};

export type MonitorBookletVisibility = "visible" | "collapsed" | "hidden";

export type OperationalLoginMigrationCandidate = {
  loginKey: string;
  loginMode: "monitor-group" | "monitor-study" | "sys-check-login";
  groupKey: string | null;
  /** Authored label for the candidate's Original Testtakers group. */
  groupLabel?: string | null;
  passwordRequired: boolean;
  profileIds: string[];
  monitorProfiles: MonitorViewProfile[];
  monitorBookletVisibility: MonitorBookletVisibility;
  customTexts: Record<string, string>;
  /** Original application asset filenames keyed by the Testtakers slot name. */
  assetAssignments?: Record<string, string>;
  unresolvedProfileIds: string[];
  validFrom?: string | null;
  validTo?: string | null;
  validForMinutes?: number | null;
};

export type AdminRoleAssignment = {
  roleAssignmentId: string;
  adminUserId: string;
  role: AdminRole;
  accessMode: AdminRoleAccessMode;
  tenantId: string | null;
  workspaceId: string | null;
  groupKey: string | null;
  monitorProfiles: MonitorViewProfile[];
  monitorBookletVisibility: MonitorBookletVisibility;
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

export type WorkspaceAggregateDeletionCounts = {
  deletedWorkspaceCount: number;
  deletedAdminRoleAssignmentCount: number;
  deletedAttachmentFileCount: number;
  deletedActivityEventCount: number;
  deletedReviewCount: number;
  deletedSourcePackageCount: number;
  deletedImportJobCount: number;
  deletedContentReleaseCount: number;
  deletedParticipantSessionCount: number;
  deletedRosterEntryCount: number;
  deletedLoginAttemptCount: number;
  deletedTestRunCount: number;
  deletedTestLogCount: number;
};

export type WorkspaceDeletion = {
  workspace: Workspace;
  counts: WorkspaceAggregateDeletionCounts;
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
  systemCheckEntries?: SourcePackageSystemCheckEntry[];
};

export type SystemCheckQuestionType =
  | "string"
  | "select"
  | "header"
  | "check"
  | "text"
  | "radio";

export type SystemCheckSpeedParameters = {
  min: number;
  good: number;
  maxDevianceBytesPerSecond: number;
  maxErrorsPerSequence: number;
  maxSequenceRepetitions: number;
  sequenceSizes: number[];
};

export type SystemCheckQuestion = {
  id: string;
  type: SystemCheckQuestionType;
  prompt: string;
  required: boolean;
  options: string[];
};

export type SourcePackageSystemCheckEntry = {
  checkId: string;
  displayLabel: string;
  description?: string;
  unitKey?: string;
  unitEntry?: SourcePackageUnitEntry;
  saveKey?: string;
  skipNetwork: boolean;
  uploadSpeed: SystemCheckSpeedParameters;
  downloadSpeed: SystemCheckSpeedParameters;
  customTexts: Record<string, string>;
  questions: SystemCheckQuestion[];
};

export type SourcePackagePlayerEntry = {
  playerKey: string;
  html: string;
};

export type SourcePackageBookletEntry = {
  bookletKey: string;
  displayLabel: string;
  customTexts?: Record<string, string>;
  config?: Record<string, string>;
  rootRestrictions?: BookletRootRestrictions;
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

export type BookletRootRestrictions = Pick<
  NonNullable<SourcePackageTestletEntry["restrictions"]>,
  "timeMax" | "denyNavigationOnIncomplete"
>;

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
  /** Authored Unit/@id when `unitKey` is an Original Testcenter alias. */
  originalUnitId?: string;
  displayLabel: string;
  /** Authored Booklet Unit/@labelshort used by the legacy FULL navigation bar. */
  shortLabel?: string;
  testletPath?: string[];
  description?: string;
  content?: string;
  playerKey?: string;
  unitDefinition?: string;
  unitDefinitionType?: string;
  codingScheme?: UnitCodingScheme;
  requestedAttachments?: UnitAttachmentRequest[];
};

/** Serializable IQB variable-coding definition retained with a content release. */
export type UnitCodingScheme = {
  version?: string;
  variableCodings: Array<Record<string, unknown>>;
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
  systemCheckEntries?: SourcePackageSystemCheckEntry[];
};

export type WorkspaceSystemCheck = Omit<
  SourcePackageSystemCheckEntry,
  "saveKey" | "unitEntry"
> & {
  sourcePackageId: string;
  canSave: boolean;
  unit: {
    unitKey: string;
    displayLabel: string;
    playerKey?: string;
    playerHtml?: string;
    unitDefinition?: string;
    unitDefinitionType?: string;
  } | null;
};

export type SystemCheckReportEntry = {
  id: string;
  type: string;
  label: string;
  value: string | number | boolean | null;
  warning: boolean;
};

export type SystemCheckReport = {
  systemCheckReportId: string;
  tenantId: string;
  workspaceId: string;
  sourcePackageId: string;
  /** Original report filename when migrated from a file-based Testcenter workspace. */
  originalFileName?: string;
  /** Filesystem modification timestamp used by the legacy DatumTS/Datum export columns. */
  fileModifiedAt?: string;
  /** The report's original, human-readable `date` field. */
  sourceDate?: string;
  /** Stable semantic digest used to make legacy file migration resumable. */
  sourceDigest?: string;
  checkId: string;
  checkLabel: string;
  title: string;
  responses: unknown;
  environment: SystemCheckReportEntry[];
  network: SystemCheckReportEntry[];
  questionnaire: SystemCheckReportEntry[];
  unit: SystemCheckReportEntry[];
  createdAt: string;
};

export type SystemCheckReportBreakdown = {
  value: string;
  count: number;
};

export type SystemCheckReportStatistics = {
  checkId: string;
  checkLabel: string;
  reportCount: number;
  latestReportAt: string;
  operatingSystems: SystemCheckReportBreakdown[];
  browsers: SystemCheckReportBreakdown[];
  overallRatings: SystemCheckReportBreakdown[];
};

export type SystemCheckReportDeletion = {
  checkIds: string[];
  deletedReportIds: string[];
  deletedCount: number;
  deletedAt: string;
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
  customTexts?: Record<string, string>;
  policy?: BookletRuntimePolicy;
  rootRestrictions?: BookletRootRestrictions;
  stateEntries?: SourcePackageBookletStateEntry[];
  testletEntries?: ContentReleaseTestletEntry[];
  unitEntries: ContentReleaseUnitEntry[];
};

export type ContentReleaseTestletEntry = SourcePackageTestletEntry;

export type BookletLeaveRestriction = "off" | "forward" | "always";
export type BookletPlayerEndPolicy = "never" | "last_unit" | "always";
export type BookletUnitNavigationControls = "hidden" | "forward_only" | "both";
export type BookletUnitNavigationLabel = "hidden" | "index" | "label";
export type BookletPageNavigationLabel = "hidden" | "index" | "label" | "list";
export type BookletGlobalNavigationMode =
  | "hidden"
  | "dynamic"
  | "units"
  | "pages";
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
    /** Optional so runtime snapshots created before browser navigation policy remain readable. */
    browserNavigation?: "standard" | "prevent";
    unitMenuEnabled: boolean;
    unitControls: BookletUnitNavigationControls;
    /** Optional so runtime snapshots created before unit navigation labels remain readable. */
    unitLabel?: BookletUnitNavigationLabel;
    /** Optional so runtime snapshots created before the legacy FULL Unit bar remain readable. */
    unitListEnabled?: boolean;
    /** Optional so runtime snapshots created before separate global navigation buttons remain readable. */
    backwardButton?: BookletGlobalNavigationMode;
    /** Optional so runtime snapshots created before separate global navigation buttons remain readable. */
    forwardButton?: BookletGlobalNavigationMode;
    playerEnd: BookletPlayerEndPolicy;
  };
  player: {
    /** Optional so runtime snapshots created before booklet preloading remain readable. */
    loadingMode?: "lazy" | "eager";
    logPolicy: "disabled" | "lean" | "rich" | "debug";
    pagingMode: "separate" | "concat-scroll" | "concat-scroll-snap" | "buttons";
    restoreCurrentPageOnReturn: boolean;
    /** Optional so runtime snapshots created before host page navigation remain readable. */
    pageNavigation?: {
      labelMode: BookletPageNavigationLabel;
      controlsHidden: boolean;
    };
  };
  completion: {
    lockOnTermination: boolean;
  };
  display: {
    /** Optional so runtime snapshots created before global header visibility policy remain readable. */
    headerHidden?: boolean;
    headerContent: "none" | "booklet" | "block" | "unit";
    unitTitle: boolean;
    fullscreenPrompt: boolean;
    fullscreenButton: boolean;
    reloadButton: boolean;
    silentMode: boolean;
  };
  timing: {
    showTimeLeft: boolean;
    warningMinutes: number[];
  };
  persistence: {
    unitResponsesBufferMs: number;
    unitStateBufferMs: number;
    testStateBufferMs: number;
  };
};

export type ContentReleaseUnitEntry = {
  unitKey: string;
  /** Authored Unit/@id when `unitKey` is an Original Testcenter alias. */
  originalUnitId?: string;
  displayLabel: string;
  /** Authored Booklet Unit/@labelshort used by the legacy FULL navigation bar. */
  shortLabel?: string;
  testletPath?: string[];
  description?: string;
  content?: string;
  playerKey?: string;
  unitDefinition?: string;
  unitDefinitionType?: string;
  codingScheme?: UnitCodingScheme;
  requestedAttachments?: UnitAttachmentRequest[];
};

export type UnitAttachmentRequest = {
  variableId: string;
  /** Authored Original Testcenter Variable/@format; empty when omitted. */
  attachmentType: string;
};

export type AttachmentFile = {
  attachmentFileId: string;
  attachmentId: string;
  tenantId: string;
  workspaceId: string;
  fileName: string;
  mediaType: "image/jpeg" | "image/png";
  dataBase64: string;
  createdAt: string;
};

export type WorkspaceAttachment = {
  attachmentId: string;
  tenantId: string;
  workspaceId: string;
  participantSessionId: string;
  testRunId: string;
  groupKey: string;
  loginKey: string;
  personLabel: string;
  bookletKey: string;
  testLabel: string;
  unitKey: string;
  unitLabel: string;
  variableId: string;
  attachmentType: UnitAttachmentRequest["attachmentType"];
  dataType: "image" | "missing";
  attachmentFileIds: string[];
  lastModified: number | null;
};

export type ParticipantSession = {
  participantSessionId: string;
  tenantId: string;
  workspaceId: string;
  contentReleaseId: string;
  loginKey: string;
  groupKey: string;
  participantCode?: string | null;
  executionMode?: ParticipantExecutionMode;
  status: ParticipantSessionStatus;
  validUntil?: string | null;
  createdAt: string;
};

export type TestRun = {
  testRunId: string;
  participantSessionId: string;
  tenantId: string;
  workspaceId: string;
  contentReleaseId: string;
  bookletKey: string;
  executionMode?: ParticipantExecutionMode;
  bookletAssignmentKey?: string;
  presetBookletStates?: Record<string, string>;
  /** Server-authoritative equivalent of the original persisted BOOKLET_STATES test state. */
  bookletStates?: Record<string, string>;
  /** Participant-selected state options that take precedence over automatic evaluation. */
  bookletStateOverrides?: Record<string, string>;
  status: TestRunStatus;
  /** Identifies who may release a paused run; omitted for non-paused runs. */
  pauseSource?: TestRunPauseSource;
  /** Whole-test lock from the original monitor protocol; independent of progress status. */
  locked?: boolean;
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

export type ParticipantTestLog = {
  participantTestLogId: string;
  tenantId: string;
  workspaceId: string;
  participantSessionId: string;
  testRunId: string;
  unitKey: string | null;
  originalUnitId: string | null;
  logKey: string;
  logContent: string;
  timestamp: number;
  recordedAt: string;
};

export const selectLatestParticipantTestStateLogs = (
  testLogs: ParticipantTestLog[],
  logKeys: readonly string[]
): ParticipantTestLog[] => {
  const allowedLogKeys = new Set(logKeys);
  const latestLogs = new Map<string, ParticipantTestLog>();
  for (const testLog of testLogs) {
    if (testLog.unitKey !== null || !allowedLogKeys.has(testLog.logKey)) {
      continue;
    }
    const stateKey = `${testLog.testRunId}\u0000${testLog.logKey}`;
    const current = latestLogs.get(stateKey);
    if (
      !current ||
      testLog.timestamp > current.timestamp ||
      (testLog.timestamp === current.timestamp &&
        (testLog.recordedAt > current.recordedAt ||
          (testLog.recordedAt === current.recordedAt &&
            testLog.participantTestLogId > current.participantTestLogId)))
    ) {
      latestLogs.set(stateKey, testLog);
    }
  }
  return [...latestLogs.values()];
};

export type ParticipantTestLogEntryInput = {
  key: string;
  content?: string;
  timeStamp: number;
};

export type WorkspaceParticipantTestLogListItem = {
  testLog: ParticipantTestLog;
  loginKey: string;
  groupKey: string;
  participantCode: string;
  bookletKey: string;
  bookletAssignmentKey: string;
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

export type MonitorTestletTimer = TestletTimerState & {
  displayLabel: string;
  current: boolean;
  leave: TestletTimeMaxLeavePolicy | null;
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

export const monitorBookletErrors = [
  "missing-id",
  "missing-file",
  "xml",
  "general"
] as const;

export type MonitorBookletError = (typeof monitorBookletErrors)[number];

export type MonitorCurrentUnitState = {
  presentationProgress:
    | "none"
    | "some"
    | "complete"
    | "complete-and-valid"
    | null;
  responseProgress:
    | "none"
    | "some"
    | "complete"
    | "complete-and-valid"
    | null;
  currentPageId: string | null;
  currentPageLabel: string | null;
  /** Zero-based index in the Player's current valid-page list. */
  currentPageIndex: number | null;
  pageCount: number | null;
};

export type OpenMonitorRun = {
  testRunId: string;
  participantSessionId: string;
  loginKey: string;
  groupKey: string;
  executionMode: ParticipantExecutionMode;
  participantRosterEntry: ParticipantRosterEntry | null;
  bookletKey: string;
  bookletLabel?: string;
  bookletSpecies: string | null;
  /** Original group-monitor booklet load failure, retained for corrupt legacy data. */
  bookletError: MonitorBookletError | null;
  bookletAssignmentKey: string;
  bookletStates: Record<string, string>;
  /** Latest original-compatible, test-wide state values for monitor presentation. */
  testState: Record<string, string>;
  status: TestRunStatus;
  locked?: boolean;
  currentUnitKey: string | null;
  currentUnitLabel?: string | null;
  /** Latest structured Verona progress for the current Unit, when available. */
  currentUnitState: MonitorCurrentUnitState | null;
  /** Adaptive-visible Unit order used by the original monitor progress strip. */
  unitPath: Array<{
    unitKey: string;
    unitLabel: string;
    blockKey: string | null;
    blockLabel: string | null;
    current: boolean;
    answered: boolean;
  }>;
  currentBlockKey?: string | null;
  currentBlockLabel?: string | null;
  blockNavigationTargets?: Array<{
    blockKey: string;
    blockLabel: string;
    targetUnitKey: string;
    unitKeys: string[];
    /** Authored limit for the timed testlet reached by this block target. */
    timeMaxMinutes?: number | null;
    /** Persisted timer state, including expired/cancelled targets, when started before. */
    timer?: MonitorTestletTimer | null;
  }>;
  activeTestletTimer: MonitorTestletTimer | null;
  updatedAt: string;
};

export type MonitorRunCommandResult = {
  commandId: string;
  commandType: MonitorRunCommandType;
  actorId: string | null;
  issuedAt: string;
  previousStatus: TestRunStatus;
  previousLocked: boolean;
  testRun: TestRun;
  participantSession: ParticipantSession;
};

export type ParticipantRuntimeStateStatus =
  | "ready_to_launch"
  | "in_progress"
  | "locked"
  | "completed";

export type ParticipantSessionScope = {
  tenantKey: string;
  workspaceKey: string;
};

export type ParticipantRuntimeState = {
  participantSession: ParticipantSession;
  participantRosterEntry: ParticipantRosterEntry | null;
  scope: ParticipantSessionScope;
  executionMode: ParticipantExecutionModeDefinition;
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
  customTexts?: Record<string, string>;
  status: "available" | "in_progress" | "locked" | "completed";
};

export type ParticipantCurrentRunState = {
  participantSession: ParticipantSession;
  participantRosterEntry: ParticipantRosterEntry | null;
  scope: ParticipantSessionScope;
  executionMode: ParticipantExecutionModeDefinition;
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
  bookletAssets?: {
    units: Array<{
      unitKey: string;
      playerKey: string;
      unitDefinition: string;
      unitDefinitionType: string;
    }>;
    players: ContentReleasePlayerEntry[];
  };
  resourceBasePath?: string;
  bookletUnits: Array<{
    unitKey: string;
    displayLabel: string;
    shortLabel?: string;
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
    automaticOptionKey: string;
    automaticOptionLabel: string;
    overrideOptionKey: string | null;
    options: Array<{
      optionKey: string;
      displayLabel: string;
    }>;
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
    backwardAdvisoryReasons: BookletNavigationDeniedReason[];
    forwardAdvisoryReasons: BookletNavigationDeniedReason[];
    nextTestletGate: {
      testletKey: string;
      displayLabel: string;
      prompt: string;
    } | null;
  };
  availableActions: Array<
    "save_progress" | "resume" | "complete" | "review" | "change_state_options"
  >;
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
  groupLabel: string;
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
  testletTimers: MonitorTestletTimer[];
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
  groupLabel: string;
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
  groupLabel: string | null;
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
  groupLabel: string;
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
  fileType: WorkspaceFileType;
  latestImportJob: ImportJob | null;
  fileSizeBytes: number | null;
  downloadAvailable: boolean;
  importJobCount: number;
  contentReleaseCount: number;
  canDelete: boolean;
  blockingDependencyCount: number;
};

export type WorkspaceSourcePackageStatusSummary = {
  totalCount: number;
  validCount: number;
  pendingCount: number;
  invalidCount: number;
  warningFileCount: number;
};

export type WorkspaceSourcePackageTypeSummary =
  WorkspaceSourcePackageStatusSummary & {
    fileType: WorkspaceFileType;
  };

export type WorkspaceSourcePackageListSummary =
  WorkspaceSourcePackageStatusSummary & {
    fileTypes: WorkspaceSourcePackageTypeSummary[];
  };

export type WorkspaceSourcePackageListResult = {
  items: WorkspaceSourcePackageListItem[];
  filteredCount: number;
  workspaceSummary: WorkspaceSourcePackageListSummary;
};

export type WorkspaceFileDependencyNodeType =
  | "source_package"
  | "booklet"
  | "system_check"
  | "unit"
  | "player"
  | "definition"
  | "coding_scheme"
  | "resource";

export type WorkspaceFileDependencyRelationshipType =
  | "assembled_from"
  | "contains_booklet"
  | "contains_system_check"
  | "contains_unit"
  | "uses_unit"
  | "uses_player"
  | "uses_definition"
  | "uses_coding_scheme"
  | "contains_resource";

export type WorkspaceFileDependencyNode = {
  nodeId: string;
  nodeType: WorkspaceFileDependencyNodeType;
  key: string;
  label: string;
  sourcePackageId: string;
  fileType?: WorkspaceFileType;
  status?: SourcePackageStatus;
};

export type WorkspaceFileDependencyEdge = {
  fromNodeId: string;
  toNodeId: string;
  relationshipType: WorkspaceFileDependencyRelationshipType;
};

export type WorkspaceSourcePackageDependencyGraph = {
  rootNodeId: string;
  nodes: WorkspaceFileDependencyNode[];
  edges: WorkspaceFileDependencyEdge[];
  directDependencyNodeIds: string[];
  transitiveDependencyNodeIds: string[];
  directDependentNodeIds: string[];
  transitiveDependentNodeIds: string[];
};

export type WorkspaceImportJobListItem = {
  importJob: ImportJob;
  sourcePackage: SourcePackage | null;
};

export type ParticipantRosterImportSummary = {
  sourceFileNames: string[];
  importedCount: number;
  updatedCount: number;
  operationalLoginCandidateCount: number;
};

export type WorkspaceImportJobDetail = {
  importJob: ImportJob;
  sourcePackage: SourcePackage | null;
  contentRelease: ContentRelease | null;
  participantRosterImport: ParticipantRosterImportSummary | null;
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

/**
 * Operator-facing result inventory compatible with the Original Testcenter's
 * group result table. Unit statistics count distinct saved unit responses per
 * started test run, including zero-response runs.
 */
export type WorkspaceGroupResultSummary = {
  tenantKey: string;
  workspaceKey: string;
  groupKey: string;
  groupLabel: string;
  bookletsStarted: number;
  numUnitsMin: number;
  numUnitsMax: number;
  numUnitsTotal: number;
  numUnitsAvg: number;
  responseCount: number;
  reviewCount: number;
  testLogCount: number;
  lastChangeAt: string;
};

export type WorkspaceReview = {
  reviewId: string;
  tenantId: string;
  workspaceId: string;
  participantSessionId: string;
  testRunId: string;
  unitKey: string | null;
  /** Authored unit identity captured when the review was created. */
  originalUnitId: string | null;
  /** Original task-page index; null for whole-test/unit reviews or non-numeric player pages. */
  page: number | null;
  /** Participant-authored task/page label from the Original Testcenter review dialog. */
  pageLabel: string | null;
  /** Browser provenance captured when the review was created. */
  userAgent: string | null;
  reviewerId: string;
  /** Space-separated compatibility projection of `categories`. */
  category: string;
  categories: string[];
  /** Original Testcenter priority: 0 unset, 1 critical, 2 medium, 3 optional. */
  priority: 0 | 1 | 2 | 3;
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
  deletedTestLogCount: number;
  affectedParticipantSessionIds: string[];
  deletedTestRunIds: string[];
};

export type WorkspaceGroupResultsDeletion = {
  tenantKey: string;
  workspaceKey: string;
  groupKeys: string[];
  deletedTestRunCount: number;
  deletedResponseCount: number;
  deletedReviewCount: number;
  deletedTestLogCount: number;
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
  dependencyGraph: WorkspaceSourcePackageDependencyGraph;
};

export type WorkspaceSourcePackageDownload = {
  fileName: string;
  mediaType: string;
  sizeBytes: number;
  dataBase64: string;
};

export type WorkspaceSourcePackageDeletionBlocker = {
  dependencyType:
    | "active_import_job"
    | "active_content_release"
    | "participant_session"
    | "test_run";
  dependencyId: string;
  status: string;
};

export type WorkspaceSourcePackageDeletionReadiness = {
  sourcePackage: SourcePackage;
  canDelete: boolean;
  importJobs: ImportJob[];
  contentReleases: ContentRelease[];
  blockingDependencies: WorkspaceSourcePackageDeletionBlocker[];
};

export type WorkspaceSourcePackageDeletion = {
  sourcePackageId: string;
  fileName: string;
  deletedImportJobCount: number;
  deletedContentReleaseCount: number;
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
  | "application_settings_read"
  | "application_settings_update"
  | "attachment_management"
  | "tenant_lifecycle"
  | "tenant_directory_csv_export"
  | "workspace_lifecycle"
  | "workspace_admin_read"
  | "workspace_directory_csv_export"
  | "workspace_overview_csv_export"
  | "workspace_activity_read"
  | "source_package_intake"
  | "source_package_read"
  | "source_package_download"
  | "source_package_delete"
  | "source_package_replace"
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
  | "original_result_archive_export"
  | "result_group_read"
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
  | "monitor_event_stream"
  | "monitor_run_control"
  | "monitor_bulk_control"
  | "participant_sign_in"
  | "participant_login_protection"
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
  "application_settings_read",
  "application_settings_update",
  "attachment_management",
  "tenant_lifecycle",
  "tenant_directory_csv_export",
  "workspace_lifecycle",
  "workspace_admin_read",
  "workspace_directory_csv_export",
  "workspace_overview_csv_export",
  "workspace_activity_read",
  "source_package_intake",
  "source_package_read",
  "source_package_download",
  "source_package_delete",
  "source_package_replace",
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
  "original_result_archive_export",
  "result_group_read",
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
  "monitor_event_stream",
  "monitor_run_control",
  "monitor_bulk_control",
  "participant_sign_in",
  "participant_login_protection",
  "participant_launch",
  "participant_runtime_state",
  "participant_current_run_state",
  "test_run_progress",
  "test_run_lifecycle",
  "monitor_open_runs",
  "system_diagnostics",
  "frontend_shell"
];
