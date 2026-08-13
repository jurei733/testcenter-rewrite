import type {
  AdminAuditEvent,
  AdminAuditEventType,
  AdminRole,
  AdminRoleAssignment,
  AdminSession,
  AdminSessionStatus,
  AdminUser,
  AdminUserStatus,
  ApplicationAsset,
  ApplicationSettings,
  ContentReleaseActivationReadiness,
  ContentRelease,
  ContentReleaseStatus,
  ImportJob,
  ImportJobStatus,
  MonitorRunCommandResult,
  MonitorRunCommandType,
  MonitorViewProfile,
  MonitorViewProfileFilter,
  OpenMonitorRun,
  ParticipantRuntimeBooklet,
  ParticipantTestLogEntryInput,
  ParticipantCurrentRunState,
  ParticipantRosterEntry,
  ParticipantSession,
  ParticipantSessionStatus,
  ParticipantRuntimeState,
  SourcePackage,
  SourcePackageStatus,
  SourcePackageContentStructure,
  WorkspaceFileType,
  SystemCheckReport,
  SystemCheckReportDeletion,
  SystemCheckReportEntry,
  SystemCheckReportStatistics,
  Tenant,
  TestRun,
  Workspace,
  WorkspaceDirectoryItem,
  WorkspaceDeletion,
  WorkspaceAttachment,
  WorkspaceContentReleaseListItem,
  WorkspaceContentReleaseDetail,
  WorkspaceActivityEventListItem,
  WorkspaceImportJobDetail,
  WorkspaceImportJobListItem,
  WorkspaceDetailedResponse,
  WorkspaceGroupResultsDeletion,
  WorkspaceGroupResultSummary,
  WorkspaceGroupResultDeletion,
  WorkspaceParticipantSessionDetail,
  WorkspaceParticipantRosterItem,
  WorkspaceParticipantSessionListItem,
  WorkspaceParticipantTestLogListItem,
  WorkspaceReviewListItem,
  WorkspaceReview,
  WorkspaceActivityEventType,
  WorkspaceActivitySubjectType,
  WorkspaceSourcePackageDetail,
  WorkspaceSourcePackageDeletion,
  WorkspaceSourcePackageDeletionReadiness,
  WorkspaceSourcePackageListItem,
  WorkspaceSourcePackageListSummary,
  WorkspaceSystemCheck,
  WorkspaceStudyMonitorBookletDetail,
  WorkspaceStudyMonitorGroupDetail,
  WorkspaceStudyMonitorParticipantDetail,
  WorkspaceStudyMonitorParticipantMatrix,
  WorkspaceStudyMonitorRunDetail,
  WorkspaceStudyMonitorUnitDetail,
  WorkspaceStudyMonitorSummary,
  WorkspaceOverview
} from "@testcenter-rewrite-app/domain";

export * from "./verona-player.js";
export * from "./booklet-policy.js";
export * from "./browser-compatibility.js";
export * from "./monitor-event-stream.js";
export * from "./participant-event-stream.js";
export * from "./monitor-custom-texts.js";
export * from "./participant-custom-texts.js";
import type {
  OriginalTestcenterOperationalLoginCandidate,
  ParticipantRosterSource
} from "./participant-roster.js";
export type {
  OriginalTestcenterMonitorProfile,
  OriginalTestcenterMonitorProfileFilter,
  OriginalTestcenterMonitorRoleDraft,
  OriginalTestcenterOperationalLoginCandidate,
  OriginalTestcenterOperationalLoginMode,
  OriginalTestcenterOperationalRoleDraft,
  ParsedParticipantRosterEntry,
  ParticipantRosterSource
} from "./participant-roster.js";
export {
  BUG_REPORT_MAX_REPORT_LENGTH,
  BUG_REPORT_MAX_TAG_LENGTH,
  BUG_REPORT_MAX_TITLE_LENGTH,
  buildBugReportText,
  redactBugReportText
} from "./bug-report.js";
export type {
  BugReportConfigResponse,
  BugReportContext,
  SubmitBugReportRequest,
  SubmitBugReportResponse
} from "./bug-report.js";

export const productionApiRoutes = {
  admin: {
    bootstrap: "/api/v1/admin/auth/bootstrap",
    signIn: "/api/v1/admin/auth/sign-in",
    signOut: "/api/v1/admin/auth/sign-out",
    changeOwnPassword: "/api/v1/admin/auth/password",
    currentSession: "/api/v1/admin/auth/current-session",
    listSessions: "/api/v1/admin/auth/sessions",
    revokeSessions: "/api/v1/admin/auth/sessions:revoke",
    revokeSession: "/api/v1/admin/auth/sessions/:adminSessionId",
    exportSessionsCsv: "/api/v1/admin/auth/sessions.csv",
    listUsers: "/api/v1/admin/users",
    createUser: "/api/v1/admin/users",
    updateUser: "/api/v1/admin/users/:adminUserId",
    deleteUser: "/api/v1/admin/users/:adminUserId",
    resetPassword: "/api/v1/admin/users/:adminUserId/password",
    assignRole: "/api/v1/admin/users/:adminUserId/role-assignments",
    revokeRole:
      "/api/v1/admin/users/:adminUserId/role-assignments/:roleAssignmentId",
    exportUsersCsv: "/api/v1/admin/users.csv",
    listAuditEvents: "/api/v1/admin/audit-events",
    exportAuditEventsCsv: "/api/v1/admin/audit-events.csv",
    updateApplicationSettings: "/api/v1/admin/application-settings",
    applicationAssets: "/api/v1/admin/application-assets"
  },
  platform: {
    listTenants: "/api/v1/platform/tenants",
    exportTenantsCsv: "/api/v1/platform/tenants.csv",
    createTenant: "/api/v1/platform/tenants"
  },
  workspace: {
    createWorkspace: "/api/v1/tenants/:tenantKey/workspaces",
    listWorkspaces: "/api/v1/tenants/:tenantKey/workspaces",
    exportWorkspacesCsv: "/api/v1/tenants/:tenantKey/workspaces.csv",
    getWorkspaceOverview: "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey",
    updateWorkspace: "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey",
    deleteWorkspace: "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey",
    exportWorkspaceOverviewCsv:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/workspace-overview.csv",
    getStudyMonitorSummary:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/study-monitor/summary",
    getStudyMonitorParticipantMatrix:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/study-monitor/participants",
    getStudyMonitorParticipant:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/study-monitor/participants/:loginKey",
    getStudyMonitorGroup:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/study-monitor/groups/:groupKey",
    getStudyMonitorBooklet:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/study-monitor/booklets/:bookletKey",
    getStudyMonitorUnit:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/study-monitor/units/:unitKey",
    getStudyMonitorRun:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/study-monitor/runs/:testRunId",
    listWorkspaceActivityEvents:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/activity-events",
    listAttachments:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/attachments",
    downloadAttachmentPagesPdf:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/attachments/pages.pdf",
    getAttachment:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/attachments/:attachmentId",
    downloadAttachmentPagePdf:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/attachments/:attachmentId/page.pdf",
    uploadAttachmentFile:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/attachments/:attachmentId/files",
    getAttachmentFile:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/attachments/:attachmentId/files/:attachmentFileId",
    deleteAttachmentFile:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/attachments/:attachmentId/files/:attachmentFileId",
    createSourcePackage: "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/source-packages",
    assembleSourcePackages:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/source-package-assemblies",
    listSourcePackages: "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/source-packages",
    getSourcePackage:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/source-packages/:sourcePackageId",
    downloadSourcePackage:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/source-packages/:sourcePackageId/download",
    getSourcePackageDeletionReadiness:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/source-packages/:sourcePackageId/deletion-readiness",
    deleteSourcePackage:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/source-packages/:sourcePackageId",
    deleteSourcePackages:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/source-package-deletions",
    replaceSourcePackage:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/source-packages/:sourcePackageId/replacements",
    exportSourcePackagesCsv:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/source-packages.csv",
    retrySourcePackageImport:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/source-packages/:sourcePackageId/retry-import",
    createImportJob: "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/import-jobs",
    listImportJobs: "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/import-jobs",
    getImportJob:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/import-jobs/:importJobId",
    exportImportJobsCsv:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/import-jobs.csv",
    listParticipantSessions:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/participant-sessions",
    getParticipantSession:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/participant-sessions/:participantSessionId",
    exportParticipantSessionsCsv:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/participant-sessions.csv",
    importParticipantRoster:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/participant-roster",
    listParticipantRoster:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/participant-roster",
    exportParticipantRosterCsv:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/participant-roster.csv",
    exportStudyMonitorCsv:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/study-monitor.csv",
    exportStudyMonitorParticipantMatrixCsv:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/study-monitor-participants.csv",
    exportStudyMonitorRunCsv:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/study-monitor-runs/:testRunId.csv",
    exportOpenRunsCsv:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/open-runs.csv",
    exportResponseCsv:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/responses.csv",
    exportOriginalResultArchive:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/original-results.zip",
    exportLogCsv:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/logs.csv",
    exportActivityCsv:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/activity-events.csv",
    listParticipantTestLogs:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/test-logs",
    exportReviewCsv:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/reviews.csv",
    listDetailedResponses:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/responses/detailed",
    listGroupResults:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/results/groups",
    listReviews:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/reviews",
    createReview:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/reviews",
    updateReview:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/reviews/:reviewId",
    deleteReview:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/reviews/:reviewId",
    deleteGroupResults:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/results/groups/:groupKey",
    deleteGroupResultsBulk:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/results/groups",
    listContentReleases:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/content-releases",
    exportContentReleasesCsv:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/content-releases.csv",
    listSystemChecks:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/system-checks",
    getSystemCheck:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/system-checks/:checkId",
    saveSystemCheckReport:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/system-checks/:checkId/reports",
    listSystemCheckReports:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/system-check-reports",
    getSystemCheckReportStatistics:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/system-check-reports/statistics",
    deleteSystemCheckReports:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/system-check-reports",
    importSystemCheckReport:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/system-check-reports/import",
    exportSystemCheckReportsCsv:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/system-check-reports.csv",
    exportSystemCheckReportsJson:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/system-check-reports.json",
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
    eventStream:
      "/api/v1/participant/sessions/:participantSessionId/events",
    getResource:
      "/api/v1/participant/sessions/:participantSessionId/resources/:resourcePath",
    saveProgress: "/api/v1/participant/test-runs/:testRunId/save-progress",
    saveTestLogs: "/api/v1/participant/test-runs/:testRunId/test-logs",
    selectAdaptiveState:
      "/api/v1/participant/test-runs/:testRunId/adaptive-states/:stateKey",
    listReviews: "/api/v1/participant/test-runs/:testRunId/reviews",
    exportReviewsCsv:
      "/api/v1/participant/sessions/:participantSessionId/exports/reviews.csv",
    createReview: "/api/v1/participant/test-runs/:testRunId/reviews",
    updateReview:
      "/api/v1/participant/test-runs/:testRunId/reviews/:reviewId",
    deleteReview:
      "/api/v1/participant/test-runs/:testRunId/reviews/:reviewId",
    unlockTestlet:
      "/api/v1/participant/test-runs/:testRunId/testlets/:testletKey/unlock",
    resumeSession: "/api/v1/participant/sessions/:participantSessionId/resume",
    resumeRun: "/api/v1/participant/test-runs/:testRunId/resume",
    completeRun: "/api/v1/participant/test-runs/:testRunId/complete"
  },
  monitor: {
    openRuns: "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/monitor/open-runs",
    eventStream:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/monitor/events",
    issueRunCommands:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/monitor/open-runs/commands",
    issueRunCommand:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/monitor/open-runs/:testRunId/commands"
  },
  system: {
    getBugReportConfig: "/api/v1/system/bug-report",
    submitBugReport: "/api/v1/system/bug-reports",
    getApplicationSettings: "/api/v1/system/application-settings",
    getApplicationAsset: "/api/v1/system/application-assets",
    getRuntimeDiagnostics: "/diagnostics/runtime",
    getRuntimeConfig: "/diagnostics/config",
    getSystemCheckAccess: "/api/v1/system-check/access",
    downloadSpeedTestPackage: "/speed-test/random-package/:size",
    uploadSpeedTestPackage: "/speed-test/random-package"
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

export type UpdateWorkspaceRequest = {
  displayName: string;
};

export type DeleteWorkspaceRequest = {
  confirmation: string;
};

export type SourceDocumentSource =
  | string
  | Record<string, unknown>
  | unknown[];

export type CreateSourcePackageRequest = {
  fileName: string;
  mediaType: string;
  contentStructure?: SourcePackageContentStructure;
  sourceDocument?: SourceDocumentSource;
};

export type AssembleSourcePackagesRequest = {
  fileName: string;
  sourcePackageIds: string[];
};

export type CreateImportJobRequest = {
  sourcePackageId: string;
};

export type RetrySourcePackageImportRequest = {
  fileName?: string;
  mediaType?: string;
  contentStructure?: SourcePackageContentStructure | null;
  sourceDocument?: SourceDocumentSource | null;
};

export type DeleteSourcePackageRequest = {
  confirmation: string;
};

export type DeleteSourcePackagesRequest = {
  items: Array<{
    sourcePackageId: string;
    confirmation: string;
  }>;
};

export type SourcePackageBatchDeletionIssue = {
  sourcePackageId: string;
  fileName: string | null;
  error: string;
  message: string;
  details?: unknown;
};

export type ReplaceSourcePackageRequest = CreateSourcePackageRequest;

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
  subjectType?: WorkspaceActivitySubjectType;
  subjectId?: string;
  limit?: number;
};

export type ParticipantSessionListQuery = {
  status?: ParticipantSessionStatus;
  groupKey?: string;
  loginKey?: string;
  bookletKey?: string;
  contentReleaseId?: string;
  limit?: number;
};

export type DetailedResponseListQuery = {
  loginKey?: string;
  groupKey?: string;
  groupKeys?: string[];
  bookletKey?: string;
  participantSessionId?: string;
  testRunId?: string;
  unitKey?: string;
  status?: TestRun["status"];
  limit?: number;
};

export type WorkspaceReviewListQuery = {
  loginKey?: string;
  groupKey?: string;
  groupKeys?: string[];
  bookletKey?: string;
  participantSessionId?: string;
  testRunId?: string;
  unitKey?: string;
  reviewerId?: string;
  category?: string;
  limit?: number;
};

export type SourcePackageListQuery = {
  status?: SourcePackageStatus;
  fileType?: WorkspaceFileType;
  mediaType?: string;
  fileName?: string;
  latestImportStatus?: ImportJobStatus;
  sortBy?: "fileName" | "fileSize" | "uploadedAt";
  sortDirection?: "asc" | "desc";
  limit?: number;
};

export type ImportJobListQuery = {
  status?: ImportJobStatus;
  sourcePackageId?: string;
  limit?: number;
};

export type ContentReleaseListQuery = {
  status?: ContentReleaseStatus;
  importJobId?: string;
  sourcePackageId?: string;
  limit?: number;
};

export type SystemCheckReportListQuery = {
  checkId?: string;
  limit?: number;
};

export type SystemCheckSpeedTestUploadResponse = {
  requestTime: number;
  packageReceivedSize: number;
};

export type SaveSystemCheckReportRequest = {
  keyPhrase?: string;
  title?: string;
  responses?: unknown;
  environment: SystemCheckReportEntry[];
  network: SystemCheckReportEntry[];
  questionnaire: SystemCheckReportEntry[];
  unit: SystemCheckReportEntry[];
};

export type DeleteSystemCheckReportsRequest = {
  checkIds: string[];
  confirmation: string;
};

export type ImportSystemCheckReportRequest = {
  fileName: string;
  modifiedAt?: string;
  report: unknown;
};

export type AdminUserListQuery = {
  username?: string;
  status?: AdminUserStatus;
  accessStatus?: AdminUserAccessStatus;
  passwordChangeRequired?: boolean;
  role?: AdminRole;
  tenantKey?: string;
  workspaceKey?: string;
  limit?: number;
};

export type AdminUserAccessStatus = "available" | "scheduled" | "expired";

export type AdminSessionListQuery = {
  adminUserId?: string;
  status?: AdminSessionStatus;
  limit?: number;
};

export type AdminAuditEventListQuery = {
  eventType?: AdminAuditEventType;
  actorAdminUserId?: string;
  subjectAdminUserId?: string;
  limit?: number;
};

export type ParticipantSignInRequest = {
  tenantKey?: string;
  workspaceKey?: string;
  loginKey: string;
  groupKey?: string;
  password?: string;
  participantCode?: string;
};

export type PublicAdminUser = Omit<AdminUser, "passwordHash">;

export type PublicAdminSession = Omit<AdminSession, "token">;

export type PublicAdminRoleAssignment = AdminRoleAssignment;

export type OperatorAccessMode =
  | "admin"
  | "admin_read_only"
  | "study_monitor"
  | "group_monitor"
  | "system_check"
  | "unassigned";

const isEnabledMonitorProfileFlag = (value: string): boolean =>
  ["1", "true", "on", "yes"].includes(value.trim().toLowerCase());

export type OpenMonitorRunSuperState =
  | "pending"
  | "locked"
  | "error"
  | "controller_terminated"
  | "connection_lost"
  | "paused"
  | "focus_lost"
  | "idle"
  | "connection_websocket"
  | "connection_polling"
  | "ok";

export const resolveOpenMonitorRunSuperState = (
  openRun: OpenMonitorRun,
  currentTimestamp = Date.now()
): OpenMonitorRunSuperState => {
  const testState = openRun.testState;
  if (testState.status === "pending" || openRun.status === "created") {
    return "pending";
  }
  if (testState.status === "locked" || openRun.locked) {
    return "locked";
  }
  if (testState.CONTROLLER === "ERROR") {
    return "error";
  }
  if (
    testState.CONTROLLER === "TERMINATED" ||
    testState.CONTROLLER === "TERMINATED_PAUSED"
  ) {
    return "controller_terminated";
  }
  if (testState.CONNECTION === "LOST") {
    return "connection_lost";
  }
  if (testState.CONTROLLER === "PAUSED" || openRun.status === "paused") {
    return "paused";
  }
  if (testState.FOCUS === "HAS_NOT") {
    return "focus_lost";
  }
  const lastActivityTimestamp = Date.parse(openRun.updatedAt);
  if (
    Number.isFinite(lastActivityTimestamp) &&
    currentTimestamp - lastActivityTimestamp > 5 * 60 * 1_000
  ) {
    return "idle";
  }
  if (testState.CONNECTION === "WEBSOCKET") {
    return "connection_websocket";
  }
  if (testState.CONNECTION === "POLLING") {
    return "connection_polling";
  }
  return "ok";
};

const monitorProfileFilterExcludesRun = (
  openRun: OpenMonitorRun,
  filter: MonitorViewProfileFilter,
  currentTimestamp: number
): boolean => {
  const scalarValue = Array.isArray(filter.value) ? "" : filter.value;
  const expected = filter.subValue || scalarValue;
  let subject: string;
  switch (filter.target) {
    case "groupName":
      subject = openRun.groupKey;
      break;
    case "personLabel":
      subject = openRun.participantRosterEntry?.displayName ?? openRun.loginKey;
      break;
    case "mode":
      subject = openRun.executionMode;
      break;
    case "bookletId":
      subject = openRun.bookletKey;
      break;
    case "bookletLabel":
      subject = openRun.bookletLabel ?? openRun.bookletKey;
      break;
    case "bookletSpecies":
      subject = openRun.bookletSpecies ?? "";
      break;
    case "unitId":
      subject = openRun.currentUnitKey ?? "";
      break;
    case "unitLabel":
      subject = openRun.currentUnitLabel ?? openRun.currentUnitKey ?? "";
      break;
    case "blockId":
      subject = openRun.currentBlockKey ?? "";
      break;
    case "blockLabel":
      subject = openRun.currentBlockLabel ?? openRun.currentBlockKey ?? "";
      break;
    case "state":
      subject = resolveOpenMonitorRunSuperState(openRun, currentTimestamp);
      break;
    case "testState":
      subject = openRun.testState[scalarValue] ?? "";
      break;
    case "bookletStates":
      subject = openRun.bookletStates[scalarValue] ?? "";
      break;
    default:
      return false;
  }

  let matches = false;
  if (Array.isArray(filter.value)) {
    matches = filter.value.includes(subject);
  } else if (filter.type === "substring") {
    matches = subject.includes(expected);
  } else if (filter.type === "regex") {
    try {
      matches = new RegExp(expected).test(subject);
    } catch {
      matches = false;
    }
  } else if (filter.type === "equal" || filter.type === "equals") {
    matches = subject === expected;
  }
  return filter.not ? !matches : matches;
};

export const filterOpenMonitorRunsByProfile = (
  openRuns: OpenMonitorRun[],
  profile: MonitorViewProfile | null,
  currentTimestamp = Date.now()
): OpenMonitorRun[] => {
  if (!profile) {
    return openRuns;
  }
  return openRuns.filter(openRun => {
    const superState = resolveOpenMonitorRunSuperState(
      openRun,
      currentTimestamp
    );
    if (
      isEnabledMonitorProfileFlag(profile.filtersEnabled.pending) &&
      superState === "pending"
    ) {
      return false;
    }
    if (
      isEnabledMonitorProfileFlag(profile.filtersEnabled.locked) &&
      superState === "locked"
    ) {
      return false;
    }
    return !profile.filters.some(filter =>
      monitorProfileFilterExcludesRun(openRun, filter, currentTimestamp)
    );
  });
};

export const resolveOperatorAccessMode = (
  roleAssignments: ReadonlyArray<
    Pick<AdminRoleAssignment, "role"> &
      Partial<Pick<AdminRoleAssignment, "accessMode">>
  >
): OperatorAccessMode => {
  if (
    roleAssignments.some(
      ({ role, accessMode }) =>
        role === "platform_admin" ||
        role === "tenant_admin" ||
        (role === "workspace_admin" && accessMode !== "read_only")
    )
  ) {
    return "admin";
  }
  if (roleAssignments.some(({ role }) => role === "workspace_admin")) {
    return "admin_read_only";
  }
  if (roleAssignments.some(({ role }) => role === "study_monitor")) {
    return "study_monitor";
  }
  if (roleAssignments.some(({ role }) => role === "group_monitor")) {
    return "group_monitor";
  }
  if (roleAssignments.some(({ role }) => role === "system_check")) {
    return "system_check";
  }
  return "unassigned";
};

export type BootstrapAdminUserRequest = {
  username: string;
  displayName?: string;
  password: string;
};

export type AdminSignInRequest = {
  username: string;
  password: string;
};

export const adminPasswordPolicy = {
  minimumLength: 8,
  maximumLength: 60
} as const;

export type ChangeAdminPasswordRequest = {
  currentPassword?: string;
  password: string;
};

export type AdminAccessWindowErrorDetails = {
  accessStatus: "scheduled" | "expired";
  accessAt: string;
  customTexts: Record<string, string>;
};

export type AdminRoleAssignmentRequest = {
  role: AdminRole;
  accessMode?: AdminRoleAssignment["accessMode"] | "RW" | "RO";
  tenantKey?: string | null;
  workspaceKey?: string | null;
  groupKey?: string | null;
  monitorProfiles?: MonitorViewProfile[];
  monitorBookletVisibility?: AdminRoleAssignment["monitorBookletVisibility"];
};

export type CreateAdminUserRequest = {
  username: string;
  displayName?: string;
  password: string;
  confirmationPassword?: string;
  customTexts?: Record<string, string>;
  validFrom?: string | null;
  validTo?: string | null;
  validForMinutes?: number | null;
  roleAssignments?: AdminRoleAssignmentRequest[];
};

export type UpdateAdminUserRequest = {
  displayName?: string;
  status?: AdminUserStatus;
  customTexts?: Record<string, string>;
  validFrom?: string | null;
  validTo?: string | null;
  validForMinutes?: number | null;
};

export type ResetAdminUserPasswordRequest = {
  password: string;
};

export type AssignAdminRoleRequest = AdminRoleAssignmentRequest & {
  confirmationPassword?: string;
};

export type RevokeAdminRoleRequest = {
  confirmationPassword?: string;
};

export type UpdateApplicationSettingsRequest = {
  appTitle: string;
  mainLogo?: string;
  themeName?: ApplicationSettings["themeName"];
  introHtml?: string;
  legalNoticeHtml?: string;
  privacyNotice?: string;
  accessibilityNotice?: string;
  customTexts?: Record<string, string>;
  assetAssignments?: ApplicationSettings["assetAssignments"];
  globalWarningText?: string | null;
  globalWarningExpiresAt?: string | null;
};

export type UploadApplicationAssetRequest = {
  originalName: string;
  mediaType: string;
  dataBase64: string;
};

export type ApplicationAssetSummary = Omit<ApplicationAsset, "dataBase64">;

export type ParticipantLaunchRequest = {
  participantSessionId?: string;
  tenantKey?: string | null;
  workspaceKey?: string;
  loginKey?: string;
  groupKey?: string;
  bookletKey?: string;
  password?: string;
  participantCode?: string;
};

export type ImportParticipantRosterRequest = {
  rosterText: ParticipantRosterSource;
};

export type ResumeParticipantSessionRequest = {
  bookletKey?: string;
};

export type SaveTestRunProgressRequest = {
  deliveryId?: string;
  currentUnitKey?: string | null;
  /** Unit receiving `unitResponse`; defaults to `currentUnitKey` for compatibility. */
  responseUnitKey?: string | null;
  /** In-memory response context for non-saving execution modes only. */
  transientUnitResponses?: Record<string, string>;
  status: Extract<TestRun["status"], "running" | "paused">;
  unitResponse?: string | null;
  confirmTestletTimeLeave?: boolean;
  confirmTestletLeaveLock?: boolean;
  logs?: Array<{
    unitKey?: string | null;
    originalUnitId?: string | null;
    entries: ParticipantTestLogEntryInput[];
  }>;
};

export type SaveParticipantTestLogsRequest = {
  deliveryId?: string;
  logs: Array<{
    unitKey?: string | null;
    originalUnitId?: string | null;
    entries: ParticipantTestLogEntryInput[];
  }>;
};

export type SelectParticipantAdaptiveStateRequest = {
  optionKey: string;
};

export type CreateParticipantReviewRequest = {
  unitKey?: string | null;
  page?: number | null;
  pageLabel?: string | null;
  reviewerId?: string;
  category?: string;
  categories?: string[];
  priority?: 0 | 1 | 2 | 3;
  comment: string;
};

export type UpdateParticipantReviewRequest = {
  unitKey?: string | null;
  page?: number | null;
  pageLabel?: string | null;
  reviewerId?: string;
  category?: string;
  categories?: string[];
  priority?: 0 | 1 | 2 | 3;
  comment?: string;
};

export type ParticipantTestLogListQuery = {
  loginKey?: string;
  groupKey?: string;
  bookletKey?: string;
  testRunId?: string;
  unitKey?: string;
  logKey?: string;
  limit?: number;
};

export type UnlockParticipantTestletRequest = {
  code: string;
};

export type CompleteTestRunRequest = {
  responseUnitKey?: string | null;
  unitResponse?: string | null;
  transientUnitResponses?: Record<string, string>;
  confirmTestletTimeLeave?: boolean;
  confirmTestletLeaveLock?: boolean;
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

export type UpdateWorkspaceResponse = {
  workspace: Workspace;
};

export type DeleteWorkspaceResponse = {
  deletion: WorkspaceDeletion;
};

export type ListWorkspacesResponse = {
  items: WorkspaceDirectoryItem[];
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

export type ChangeAdminPasswordResponse = {
  adminUser: PublicAdminUser;
  revokedAdminSessionIds: string[];
};

export type AdminSessionDirectoryItem = {
  adminSession: PublicAdminSession;
  adminUser: PublicAdminUser;
  status: AdminSessionStatus;
};

export type ListAdminSessionsResponse = {
  items: AdminSessionDirectoryItem[];
};

export type RevokeAdminSessionResponse = {
  adminSession: PublicAdminSession;
};

export type RevokeAdminSessionsRequest = {
  adminSessionIds: string[];
};

export type RevokeAdminSessionsResponse = {
  requestedCount: number;
  adminSessions: PublicAdminSession[];
  failures: Array<{
    adminSessionId: string;
    statusCode: number;
    error: string;
    message: string;
    details: unknown;
  }>;
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

export type DeleteAdminUserResponse = {
  adminUserId: string;
  username: string;
  deletedRoleAssignmentCount: number;
  deletedSessionCount: number;
};

export type ResetAdminUserPasswordResponse = AdminUserDirectoryItem;

export type AssignAdminRoleResponse = AdminUserDirectoryItem;

export type RevokeAdminRoleResponse = AdminUserDirectoryItem;

export type ListAdminAuditEventsResponse = {
  items: AdminAuditEvent[];
};

export type GetApplicationSettingsResponse = {
  applicationSettings: ApplicationSettings;
};

export type UpdateApplicationSettingsResponse = GetApplicationSettingsResponse;

export type ListApplicationAssetsResponse = {
  items: ApplicationAssetSummary[];
};

export type UploadApplicationAssetResponse = {
  applicationAsset: ApplicationAssetSummary;
};

export type DeleteApplicationAssetResponse = UploadApplicationAssetResponse;

export type ListAttachmentsResponse = {
  items: WorkspaceAttachment[];
};

export type GetAttachmentResponse = {
  attachment: WorkspaceAttachment;
};

export type UploadAttachmentFileRequest = {
  fileName: string;
  mediaType: string;
  dataBase64: string;
};

export type UploadAttachmentFileResponse = GetAttachmentResponse;

export type DeleteAttachmentFileResponse = GetAttachmentResponse;

export type GetWorkspaceOverviewResponse = {
  workspaceOverview: WorkspaceOverview;
};

export type GetStudyMonitorSummaryResponse = {
  studyMonitorSummary: WorkspaceStudyMonitorSummary;
};

export type GetStudyMonitorParticipantMatrixResponse = {
  studyMonitorParticipantMatrix: WorkspaceStudyMonitorParticipantMatrix;
};

export type GetStudyMonitorParticipantResponse = {
  studyMonitorParticipant: WorkspaceStudyMonitorParticipantDetail;
};

export type GetStudyMonitorGroupResponse = {
  studyMonitorGroup: WorkspaceStudyMonitorGroupDetail;
};

export type GetStudyMonitorBookletResponse = {
  studyMonitorBooklet: WorkspaceStudyMonitorBookletDetail;
};

export type GetStudyMonitorUnitResponse = {
  studyMonitorUnit: WorkspaceStudyMonitorUnitDetail;
};

export type GetStudyMonitorRunResponse = {
  studyMonitorRun: WorkspaceStudyMonitorRunDetail;
};

export type ListWorkspaceActivityEventsResponse = {
  items: WorkspaceActivityEventListItem[];
};

export type CreateSourcePackageResponse = {
  sourcePackage: SourcePackage;
};

export type ParticipantRosterImportSummary = {
  sourceFileNames: string[];
  importedCount: number;
  updatedCount: number;
  operationalLoginCandidateCount: number;
};

export type AssembleSourcePackagesResponse = {
  sourcePackage: SourcePackage;
  assembledFrom: Array<{
    sourcePackageId: string;
    fileName: string;
    sizeBytes: number;
  }>;
  importJob: ImportJob;
  stagedContentRelease: ContentRelease | null;
  participantRosterImport?: ParticipantRosterImportSummary;
};

export type CreateImportJobResponse = {
  importJob: ImportJob;
  stagedContentRelease: ContentRelease | null;
  participantRosterImport?: ParticipantRosterImportSummary;
};

export type RetrySourcePackageImportResponse = {
  sourcePackage: SourcePackage;
  importJob: ImportJob;
  stagedContentRelease: ContentRelease | null;
  participantRosterImport?: ParticipantRosterImportSummary;
};

export type GetSourcePackageDeletionReadinessResponse = {
  deletionReadiness: WorkspaceSourcePackageDeletionReadiness;
};

export type DeleteSourcePackageResponse = {
  deletion: WorkspaceSourcePackageDeletion;
};

export type DeleteSourcePackagesResponse = {
  report: {
    requestedCount: number;
    deleted: WorkspaceSourcePackageDeletion[];
    didNotExist: SourcePackageBatchDeletionIssue[];
    notAllowed: SourcePackageBatchDeletionIssue[];
    wasUsed: SourcePackageBatchDeletionIssue[];
    errors: SourcePackageBatchDeletionIssue[];
  };
};

export type ReplaceSourcePackageResponse = {
  replacedSourcePackage: SourcePackage;
  replacementSourcePackage: SourcePackage;
  importJob: ImportJob;
  stagedContentRelease: ContentRelease | null;
  participantRosterImport?: ParticipantRosterImportSummary;
};

export type ListSourcePackagesResponse = {
  items: WorkspaceSourcePackageListItem[];
  filteredCount: number;
  workspaceSummary: WorkspaceSourcePackageListSummary;
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

export type ImportParticipantRosterResponse = {
  importedCount: number;
  updatedCount: number;
  operationalLoginCandidates: OriginalTestcenterOperationalLoginCandidate[];
  items: WorkspaceParticipantRosterItem[];
};

export type ListParticipantRosterResponse = {
  items: WorkspaceParticipantRosterItem[];
  operationalLoginCandidates: OriginalTestcenterOperationalLoginCandidate[];
};

export type ListDetailedResponsesResponse = {
  items: WorkspaceDetailedResponse[];
};

export type ListGroupResultsResponse = {
  items: WorkspaceGroupResultSummary[];
};

export type CreateReviewRequest = {
  participantSessionId: string;
  testRunId: string;
  unitKey?: string | null;
  page?: number | null;
  pageLabel?: string | null;
  reviewerId: string;
  category?: string;
  categories?: string[];
  priority?: 0 | 1 | 2 | 3;
  comment: string;
};

export type UpdateReviewRequest = {
  unitKey?: string | null;
  page?: number | null;
  pageLabel?: string | null;
  reviewerId?: string;
  category?: string;
  categories?: string[];
  priority?: 0 | 1 | 2 | 3;
  comment?: string;
};

export type ListReviewsResponse = {
  items: WorkspaceReviewListItem[];
};

export type ReviewResponse = {
  item: WorkspaceReviewListItem;
};

export type DeleteReviewResponse = {
  deletedReviewId: string;
};

export type DeleteGroupResultsResponse = {
  deletion: WorkspaceGroupResultDeletion;
};

export type DeleteGroupResultsBulkRequest = {
  groupKeys: string[];
  confirmation: string;
};

export type DeleteGroupResultsBulkResponse = {
  deletion: WorkspaceGroupResultsDeletion;
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

export type ContentReleaseActivationSummary = {
  forced: boolean;
  previousActiveContentReleaseId: string | null;
  supersededOpenRunCount: number;
  supersededOpenRuns: OpenMonitorRun[];
};

export type ActivateContentReleaseResponse = {
  contentRelease: ContentRelease;
  activation: ContentReleaseActivationSummary;
};

export type ListSystemChecksResponse = {
  items: WorkspaceSystemCheck[];
};

export type SystemCheckAccessMode = "anonymous_key" | "login_required";

export type SystemCheckAuthorizedScope = {
  tenantKey: string;
  workspaceKey: string;
};

export type GetSystemCheckAccessResponse = {
  accessMode: SystemCheckAccessMode;
  authorizedScopes: SystemCheckAuthorizedScope[];
};

export type GetSystemCheckResponse = {
  systemCheck: WorkspaceSystemCheck;
};

export type SaveSystemCheckReportResponse = {
  report: SystemCheckReport;
};

export type ListSystemCheckReportsResponse = {
  items: SystemCheckReport[];
};

export type ListParticipantTestLogsResponse = {
  items: WorkspaceParticipantTestLogListItem[];
};

export type GetSystemCheckReportStatisticsResponse = {
  items: SystemCheckReportStatistics[];
};

export type DeleteSystemCheckReportsResponse = {
  deletion: SystemCheckReportDeletion;
};

export type ImportSystemCheckReportResponse = {
  report: SystemCheckReport;
  disposition: "imported" | "already_imported";
};

export type ParticipantSignInResponse = {
  participantSession: ParticipantSession;
  participantRosterEntry: ParticipantRosterEntry | null;
  booklets: ParticipantRuntimeBooklet[];
};

export type ParticipantLaunchResponse = {
  participantSession: ParticipantSession;
  participantRosterEntry: ParticipantRosterEntry | null;
  booklets: ParticipantRuntimeBooklet[];
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

export type SaveParticipantTestLogsResponse = {
  savedCount: number;
};

export type SelectParticipantAdaptiveStateResponse = {
  testRun: TestRun;
};

export type ListParticipantReviewsResponse = {
  items: WorkspaceReview[];
};

export type ParticipantReviewResponse = {
  review: WorkspaceReview;
};

export type DeleteParticipantReviewResponse = {
  deletedReviewId: string;
};

export type UnlockParticipantTestletResponse = {
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

export type MonitorOpenRunsQuery = {
  loginKey?: string;
  groupKey?: string;
  bookletKey?: string;
  bookletSpecies?: string;
  participantSessionId?: string;
  testRunId?: string;
  unitKey?: string;
  status?: TestRun["status"];
  limit?: number;
};

export type IssueMonitorRunCommandRequest = {
  commandType: MonitorRunCommandType;
  actorId?: string | null;
  targetUnitKey?: string | null;
  remainingSeconds?: number | null;
};

export type IssueMonitorRunCommandResponse = {
  command: MonitorRunCommandResult;
};

export type IssueMonitorRunCommandsRequest = IssueMonitorRunCommandRequest &
  (
    | {
        testRunIds: string[];
        scope?: never;
      }
    | {
        testRunIds?: never;
        scope: "all_unlocked_open_runs";
      }
  );

export type MonitorRunCommandFailure = {
  testRunId: string;
  statusCode: number;
  error: string;
  message: string;
  details: unknown;
};

export type IssueMonitorRunCommandsResponse = {
  requestedCount: number;
  succeededCount: number;
  failedCount: number;
  commands: MonitorRunCommandResult[];
  failures: MonitorRunCommandFailure[];
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
    maxJsonBodyBytes: number;
    maxSourcePackageJsonBodyBytes: number;
    httpTimeouts: {
      headersTimeoutMs: number;
      requestTimeoutMs: number;
      keepAliveTimeoutMs: number;
    };
    operatorAuthRequired: boolean;
    adminLoginProtection: {
      maxFailures: number;
      failureWindowMs: number;
    };
    participantLoginProtection: {
      maxFailures: number;
      failureWindowMs: number;
    };
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
      firstSliceMaxJsonBodyBytesPresent: boolean;
      firstSliceMaxSourcePackageJsonBodyBytesPresent: boolean;
      firstSliceOperatorAuthRequired: boolean;
      firstSliceAdminLoginMaxFailuresPresent: boolean;
      firstSliceAdminLoginFailureWindowMsPresent: boolean;
      firstSliceParticipantLoginMaxFailuresPresent: boolean;
      firstSliceParticipantLoginFailureWindowMsPresent: boolean;
      firstSliceBootstrapDemo: boolean;
      httpHeadersTimeoutMsPresent: boolean;
      httpRequestTimeoutMsPresent: boolean;
      httpKeepAliveTimeoutMsPresent: boolean;
      appBuildShaPresent: boolean;
      appBuildTimestampPresent: boolean;
      bugReportGithubRepositoryPresent: boolean;
      bugReportGithubTokenPresent: boolean;
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
