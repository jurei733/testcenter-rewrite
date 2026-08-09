import {
  createHash,
  randomBytes,
  randomUUID,
  scryptSync,
  timingSafeEqual
} from "node:crypto";
import { inflateRawSync } from "node:zlib";

import { DOMParser } from "@xmldom/xmldom";
import type {
  Document as XmlDocument,
  Element as XmlElement
} from "@xmldom/xmldom";
import { CodingScheme } from "@iqb/responses";
import type { Response as IqbResponse } from "@iqb/responses";

import {
  adminPasswordPolicy,
  bookletNavigationDeniedReasons,
  compileBookletRuntimePolicy,
  isSupportedVeronaPlayerApiVersion,
  parseOriginalTestcenterOperationalLogins,
  parseParticipantRosterText,
  parseVeronaUnitResponse,
  readBookletConfigValues
} from "@testcenter-rewrite-app/contracts";
import type {
  AdminAccessWindowErrorDetails,
  AdminUserAccessStatus,
  OriginalTestcenterOperationalLoginCandidate,
  ParticipantRosterSource,
  SourceDocumentSource
} from "@testcenter-rewrite-app/contracts";
import {
  defaultApplicationSettings,
  defaultParticipantExecutionMode,
  monitorRunCommandTypes,
  participantExecutionModeDefinitions,
  participantExecutionModes
} from "@testcenter-rewrite-app/domain";
import type {
  AdminLoginAttempt,
  AdminAuditEvent,
  AdminAuditEventType,
  AdminRole,
  AdminRoleAccessMode,
  AdminRoleAssignment,
  AdminSession,
  AdminSessionStatus,
  AdminUser,
  AdminUserStatus,
  ApplicationSettings,
  AttachmentFile,
  BookletStateCondition,
  BookletStateVariableSource,
  BookletLeaveRestriction,
  BookletRootRestrictions,
  BookletRuntimePolicy,
  ContentReleaseActivationReadiness,
  ContentRelease,
  ContentReleaseBookletEntry,
  ContentReleasePlayerEntry,
  ContentReleaseStatus,
  ContentReleaseRuntimeSnapshot,
  ImportJob,
  ImportJobStatus,
  ImportJobDiagnostic,
  MonitorBookletError,
  MonitorTestletTimer,
  MonitorRunCommandResult,
  MonitorRunCommandType,
  MonitorViewProfile,
  OpenMonitorRun,
  ParticipantCurrentRunState,
  ParticipantExecutionMode,
  ParticipantExecutionModeDefinition,
  ParticipantLoginAttempt,
  ParticipantTestLog,
  ParticipantTestLogEntryInput,
  ParticipantRosterImportSummary,
  ParticipantRosterEntry,
  ParticipantRuntimeBooklet,
  ParticipantSession,
  ParticipantSessionScope,
  ParticipantSessionStatus,
  ParticipantRuntimeState,
  SourcePackage,
  SourcePackageStatus,
  SourcePackageContentStructure,
  SourcePackageBookletStateEntry,
  SourcePackageSystemCheckEntry,
  SourcePackageTestletEntry,
  SourcePackageUnitEntry,
  SystemCheckReport,
  SystemCheckReportDeletion,
  SystemCheckReportEntry,
  SystemCheckReportStatistics,
  Tenant,
  TestRun,
  TestRunStatus,
  UnitCodingScheme,
  UnitAttachmentRequest,
  Workspace,
  WorkspaceAttachment,
  WorkspaceContentReleaseListItem,
  WorkspaceContentReleaseDetail,
  WorkspaceActivityEvent,
  WorkspaceActivityEventListItem,
  WorkspaceActivitySubjectType,
  WorkspaceImportJobDetail,
  WorkspaceImportJobListItem,
  WorkspaceDetailedResponse,
  WorkspaceGroupResultSummary,
  WorkspaceGroupResultDeletion,
  WorkspaceGroupResultsDeletion,
  WorkspaceParticipantSessionDetail,
  WorkspaceParticipantSessionListItem,
  WorkspaceParticipantRosterItem,
  WorkspaceParticipantTestLogListItem,
  WorkspaceReview,
  WorkspaceReviewListItem,
  WorkspaceSourcePackageDetail,
  WorkspaceSourcePackageDeletion,
  WorkspaceSourcePackageDeletionReadiness,
  WorkspaceAggregateDeletionCounts,
  WorkspaceDeletion,
  WorkspaceSourcePackageDownload,
  WorkspaceSourcePackageListItem,
  WorkspaceFileDependencyEdge,
  WorkspaceFileDependencyNode,
  WorkspaceFileType,
  WorkspaceSourcePackageDependencyGraph,
  WorkspaceSystemCheck,
  WorkspaceStudyMonitorBookletDetail,
  WorkspaceStudyMonitorBookletProgress,
  WorkspaceStudyMonitorAttentionItem,
  WorkspaceStudyMonitorGroupDetail,
  WorkspaceStudyMonitorParticipantDetail,
  WorkspaceStudyMonitorParticipantMatrix,
  WorkspaceStudyMonitorRunDetail,
  WorkspaceStudyMonitorUnitDetail,
  WorkspaceStudyMonitorUnitProgress,
  WorkspaceStudyMonitorSummary,
  WorkspaceOverview
} from "@testcenter-rewrite-app/domain";

export type PlatformPort = {
  listTenants(): Promise<Tenant[]>;
  exportTenantsCsv(): Promise<string>;
  createTenant(input: { tenantKey: string; displayName: string }): Promise<Tenant>;
  listWorkspaces(input: { tenantKey: string }): Promise<Workspace[]>;
  exportWorkspacesCsv(input: { tenantKey: string }): Promise<string>;
  createWorkspace(input: {
    tenantKey: string;
    workspaceKey: string;
    displayName: string;
  }): Promise<Workspace>;
  updateWorkspace(input: {
    tenantKey: string;
    workspaceKey: string;
    displayName: string;
    actorId?: string | null;
  }): Promise<Workspace>;
  deleteWorkspace(input: {
    tenantKey: string;
    workspaceKey: string;
    confirmation: string;
    actorId?: string | null;
  }): Promise<WorkspaceDeletion>;
};

export type ContentIntakePort = {
  createSourcePackage(input: {
    tenantKey: string;
    workspaceKey: string;
    fileName: string;
    mediaType: string;
    contentStructure?: SourcePackageContentStructure;
    sourceDocument?: SourceDocumentSource;
  }): Promise<SourcePackage>;
  assembleSourcePackages(input: {
    tenantKey: string;
    workspaceKey: string;
    fileName: string;
    sourcePackageIds: string[];
  }): Promise<
    CreateImportJobResult & {
      sourcePackage: SourcePackage;
      assembledFrom: Array<{
        sourcePackageId: string;
        fileName: string;
        sizeBytes: number;
      }>;
    }
  >;
  createImportJob(input: {
    tenantKey: string;
    workspaceKey: string;
    sourcePackageId: string;
  }): Promise<ImportJob>;
  retrySourcePackageImport(input: {
    tenantKey: string;
    workspaceKey: string;
    sourcePackageId: string;
    fileName?: string;
    mediaType?: string;
    contentStructure?: SourcePackageContentStructure | null;
    sourceDocument?: SourceDocumentSource | null;
  }): Promise<CreateImportJobResult & { sourcePackage: SourcePackage }>;
  replaceSourcePackage(input: {
    tenantKey: string;
    workspaceKey: string;
    sourcePackageId: string;
    fileName: string;
    mediaType: string;
    contentStructure?: SourcePackageContentStructure;
    sourceDocument?: SourceDocumentSource;
  }): Promise<
    CreateImportJobResult & {
      replacedSourcePackage: SourcePackage;
      replacementSourcePackage: SourcePackage;
    }
  >;
  deleteSourcePackage(input: {
    tenantKey: string;
    workspaceKey: string;
    sourcePackageId: string;
    confirmation: string;
  }): Promise<WorkspaceSourcePackageDeletion>;
  activateContentRelease(input: {
    tenantKey: string;
    workspaceKey: string;
    contentReleaseId: string;
    activatedByActorId: string;
    forceActivation?: boolean;
  }): Promise<ActivateContentReleaseResult>;
};

export type WorkspaceAdminReadPort = {
  getWorkspaceOverview(input: {
    tenantKey: string;
    workspaceKey: string;
  }): Promise<WorkspaceOverview>;
  exportWorkspaceOverviewCsv(input: {
    tenantKey: string;
    workspaceKey: string;
  }): Promise<string>;
  getStudyMonitorSummary(input: {
    tenantKey: string;
    workspaceKey: string;
  }): Promise<WorkspaceStudyMonitorSummary>;
  getStudyMonitorParticipantMatrix(input: {
    tenantKey: string;
    workspaceKey: string;
    loginKey?: string;
    groupKey?: string;
    bookletKey?: string;
    unitKey?: string;
    testRunStatus?: TestRunStatus | "not_started";
    answerState?: "answered" | "missing";
    limit?: number;
  }): Promise<WorkspaceStudyMonitorParticipantMatrix>;
  getStudyMonitorParticipantDetail(input: {
    tenantKey: string;
    workspaceKey: string;
    loginKey: string;
  }): Promise<WorkspaceStudyMonitorParticipantDetail>;
  getStudyMonitorGroupDetail(input: {
    tenantKey: string;
    workspaceKey: string;
    groupKey: string;
  }): Promise<WorkspaceStudyMonitorGroupDetail>;
  getStudyMonitorBookletDetail(input: {
    tenantKey: string;
    workspaceKey: string;
    bookletKey: string;
  }): Promise<WorkspaceStudyMonitorBookletDetail>;
  getStudyMonitorUnitDetail(input: {
    tenantKey: string;
    workspaceKey: string;
    unitKey: string;
  }): Promise<WorkspaceStudyMonitorUnitDetail>;
  getStudyMonitorRunDetail(input: {
    tenantKey: string;
    workspaceKey: string;
    testRunId: string;
  }): Promise<WorkspaceStudyMonitorRunDetail>;
  listWorkspaceActivityEvents(input: {
    tenantKey: string;
    workspaceKey: string;
    eventType?: WorkspaceActivityEvent["eventType"];
    subjectType?: WorkspaceActivitySubjectType;
    subjectId?: string;
    limit?: number;
  }): Promise<WorkspaceActivityEventListItem[]>;
  exportLogCsv(input: {
    tenantKey: string;
    workspaceKey: string;
    loginKey?: string;
    groupKey?: string;
    groupKeys?: string[];
    bookletKey?: string;
    testRunId?: string;
    unitKey?: string;
    logKey?: string;
    limit?: number;
  }): Promise<string>;
  exportActivityCsv(input: {
    tenantKey: string;
    workspaceKey: string;
  }): Promise<string>;
  listParticipantTestLogs(input: {
    tenantKey: string;
    workspaceKey: string;
    loginKey?: string;
    groupKey?: string;
    groupKeys?: string[];
    bookletKey?: string;
    testRunId?: string;
    unitKey?: string;
    logKey?: string;
    limit?: number;
  }): Promise<WorkspaceParticipantTestLogListItem[]>;
  exportStudyMonitorCsv(input: {
    tenantKey: string;
    workspaceKey: string;
  }): Promise<string>;
  exportStudyMonitorParticipantMatrixCsv(input: {
    tenantKey: string;
    workspaceKey: string;
    loginKey?: string;
    groupKey?: string;
    bookletKey?: string;
    unitKey?: string;
    testRunStatus?: TestRunStatus | "not_started";
    answerState?: "answered" | "missing";
    limit?: number;
  }): Promise<string>;
  exportStudyMonitorRunCsv(input: {
    tenantKey: string;
    workspaceKey: string;
    testRunId: string;
  }): Promise<string>;
  getSourcePackageDetail(input: {
    tenantKey: string;
    workspaceKey: string;
    sourcePackageId: string;
  }): Promise<WorkspaceSourcePackageDetail>;
  downloadSourcePackage(input: {
    tenantKey: string;
    workspaceKey: string;
    sourcePackageId: string;
  }): Promise<WorkspaceSourcePackageDownload>;
  getSourcePackageDeletionReadiness(input: {
    tenantKey: string;
    workspaceKey: string;
    sourcePackageId: string;
  }): Promise<WorkspaceSourcePackageDeletionReadiness>;
  listSourcePackages(input: {
    tenantKey: string;
    workspaceKey: string;
    status?: SourcePackageStatus;
    fileType?: WorkspaceFileType;
    mediaType?: string;
    fileName?: string;
    latestImportStatus?: ImportJobStatus;
    limit?: number;
  }): Promise<WorkspaceSourcePackageListItem[]>;
  exportSourcePackagesCsv(input: {
    tenantKey: string;
    workspaceKey: string;
    status?: SourcePackageStatus;
    fileType?: WorkspaceFileType;
    mediaType?: string;
    fileName?: string;
    latestImportStatus?: ImportJobStatus;
    limit?: number;
  }): Promise<string>;
  getImportJobDetail(input: {
    tenantKey: string;
    workspaceKey: string;
    importJobId: string;
  }): Promise<WorkspaceImportJobDetail>;
  listParticipantSessions(input: {
    tenantKey: string;
    workspaceKey: string;
    status?: ParticipantSessionStatus;
    groupKey?: string;
    loginKey?: string;
    bookletKey?: string;
    contentReleaseId?: string;
    limit?: number;
  }): Promise<WorkspaceParticipantSessionListItem[]>;
  exportParticipantSessionsCsv(input: {
    tenantKey: string;
    workspaceKey: string;
    status?: ParticipantSessionStatus;
    groupKey?: string;
    loginKey?: string;
    bookletKey?: string;
    contentReleaseId?: string;
    limit?: number;
  }): Promise<string>;
  importParticipantRoster(input: {
    tenantKey: string;
    workspaceKey: string;
    rosterText: ParticipantRosterSource;
  }): Promise<{
    importedCount: number;
    updatedCount: number;
    operationalLoginCandidates: OriginalTestcenterOperationalLoginCandidate[];
    items: WorkspaceParticipantRosterItem[];
  }>;
  listParticipantRoster(input: {
    tenantKey: string;
    workspaceKey: string;
  }): Promise<{
    items: WorkspaceParticipantRosterItem[];
    operationalLoginCandidates: OriginalTestcenterOperationalLoginCandidate[];
  }>;
  exportParticipantRosterCsv(input: {
    tenantKey: string;
    workspaceKey: string;
  }): Promise<string>;
  getParticipantSessionDetail(input: {
    tenantKey: string;
    workspaceKey: string;
    participantSessionId: string;
  }): Promise<WorkspaceParticipantSessionDetail>;
  listDetailedResponses(input: {
    tenantKey: string;
    workspaceKey: string;
    loginKey?: string;
    groupKey?: string;
    groupKeys?: string[];
    bookletKey?: string;
    participantSessionId?: string;
    testRunId?: string;
    unitKey?: string;
    status?: TestRun["status"];
    limit?: number;
  }): Promise<WorkspaceDetailedResponse[]>;
  listGroupResults(input: {
    tenantKey: string;
    workspaceKey: string;
  }): Promise<WorkspaceGroupResultSummary[]>;
  exportResponseCsv(input: {
    tenantKey: string;
    workspaceKey: string;
    loginKey?: string;
    groupKey?: string;
    groupKeys?: string[];
    bookletKey?: string;
    participantSessionId?: string;
    testRunId?: string;
    unitKey?: string;
    status?: TestRun["status"];
    limit?: number;
  }): Promise<string>;
  exportOriginalResultArchive(input: {
    tenantKey: string;
    workspaceKey: string;
    groupKeys: string[];
  }): Promise<WorkspaceOriginalResultArchive>;
  getContentReleaseActivationReadiness(input: {
    tenantKey: string;
    workspaceKey: string;
    contentReleaseId: string;
  }): Promise<ContentReleaseActivationReadiness>;
  getContentReleaseDetail(input: {
    tenantKey: string;
    workspaceKey: string;
    contentReleaseId: string;
  }): Promise<WorkspaceContentReleaseDetail>;
  listImportJobs(input: {
    tenantKey: string;
    workspaceKey: string;
    status?: ImportJobStatus;
    sourcePackageId?: string;
    limit?: number;
  }): Promise<WorkspaceImportJobListItem[]>;
  exportImportJobsCsv(input: {
    tenantKey: string;
    workspaceKey: string;
    status?: ImportJobStatus;
    sourcePackageId?: string;
    limit?: number;
  }): Promise<string>;
  listContentReleases(input: {
    tenantKey: string;
    workspaceKey: string;
    status?: ContentReleaseStatus;
    importJobId?: string;
    sourcePackageId?: string;
    limit?: number;
  }): Promise<WorkspaceContentReleaseListItem[]>;
  exportContentReleasesCsv(input: {
    tenantKey: string;
    workspaceKey: string;
    status?: ContentReleaseStatus;
    importJobId?: string;
    sourcePackageId?: string;
    limit?: number;
  }): Promise<string>;
  listSystemCheckReports(input: {
    tenantKey: string;
    workspaceKey: string;
    checkId?: string;
    limit?: number;
  }): Promise<SystemCheckReport[]>;
  exportSystemCheckReportsCsv(input: {
    tenantKey: string;
    workspaceKey: string;
    checkId?: string;
    limit?: number;
  }): Promise<string>;
  exportSystemCheckReportsJson(input: {
    tenantKey: string;
    workspaceKey: string;
    checkId?: string;
    limit?: number;
  }): Promise<string>;
  getSystemCheckReportStatistics(input: {
    tenantKey: string;
    workspaceKey: string;
    checkId?: string;
  }): Promise<SystemCheckReportStatistics[]>;
};

export type WorkspaceOriginalResultArchive = {
  fileName: string;
  mediaType: "application/zip";
  body: Buffer;
};

export type SystemCheckPort = {
  listSystemChecks(input: {
    tenantKey: string;
    workspaceKey: string;
  }): Promise<WorkspaceSystemCheck[]>;
  getSystemCheck(input: {
    tenantKey: string;
    workspaceKey: string;
    checkId: string;
  }): Promise<WorkspaceSystemCheck>;
  saveSystemCheckReport(input: {
    tenantKey: string;
    workspaceKey: string;
    checkId: string;
    keyPhrase?: string;
    authenticatedLoginName?: string;
    title?: string;
    responses?: unknown;
    environment: SystemCheckReportEntry[];
    network: SystemCheckReportEntry[];
    questionnaire: SystemCheckReportEntry[];
    unit: SystemCheckReportEntry[];
  }): Promise<SystemCheckReport>;
};

export type WorkspaceResultsPort = {
  deleteGroupResults(input: {
    tenantKey: string;
    workspaceKey: string;
    groupKey: string;
  }): Promise<WorkspaceGroupResultDeletion>;
  deleteGroupResultsBulk(input: {
    tenantKey: string;
    workspaceKey: string;
    groupKeys: string[];
    confirmation: string;
  }): Promise<WorkspaceGroupResultsDeletion>;
  deleteSystemCheckReports(input: {
    tenantKey: string;
    workspaceKey: string;
    checkIds: string[];
    confirmation: string;
  }): Promise<SystemCheckReportDeletion>;
  importSystemCheckReport(input: {
    tenantKey: string;
    workspaceKey: string;
    fileName: string;
    modifiedAt?: string;
    report: unknown;
  }): Promise<{
    report: SystemCheckReport;
    disposition: "imported" | "already_imported";
  }>;
};

export type WorkspaceReviewPort = {
  listReviews(input: {
    tenantKey: string;
    workspaceKey: string;
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
  }): Promise<WorkspaceReviewListItem[]>;
  createReview(input: {
    tenantKey: string;
    workspaceKey: string;
    participantSessionId: string;
    testRunId: string;
    unitKey?: string | null;
    page?: number | null;
    pageLabel?: string | null;
    reviewerId: string;
    category?: string;
    categories?: string[];
    priority?: number;
    comment: string;
    userAgent?: string | null;
  }): Promise<WorkspaceReviewListItem>;
  updateReview(input: {
    tenantKey: string;
    workspaceKey: string;
    reviewId: string;
    unitKey?: string | null;
    page?: number | null;
    pageLabel?: string | null;
    reviewerId?: string;
    category?: string;
    categories?: string[];
    priority?: number;
    comment?: string;
  }): Promise<WorkspaceReviewListItem>;
  deleteReview(input: {
    tenantKey: string;
    workspaceKey: string;
    reviewId: string;
  }): Promise<string>;
  exportReviewCsv(input: {
    tenantKey: string;
    workspaceKey: string;
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
  }): Promise<string>;
};

export type ParticipantRuntimePort = {
  signIn(input: {
    tenantKey?: string | null;
    workspaceKey: string;
    loginKey: string;
    groupKey?: string;
    password?: string;
    participantCode?: string;
  }): Promise<ParticipantSession>;
  getRuntimeState(input: {
    participantSessionId: string;
  }): Promise<ParticipantRuntimeState>;
  getCurrentRunState(input: {
    participantSessionId: string;
    includeBookletAssets?: boolean;
  }): Promise<ParticipantCurrentRunState>;
  getResource(input: {
    participantSessionId: string;
    resourcePath: string;
  }): Promise<NonNullable<ContentReleaseRuntimeSnapshot["resourceEntries"]>[number]>;
  launch(input: { participantSessionId: string; bookletKey?: string }): Promise<TestRun>;
  resumeSession(input: {
    participantSessionId: string;
    bookletKey?: string;
  }): Promise<TestRun>;
  saveProgress(input: {
    testRunId: string;
    deliveryId?: string;
    currentUnitKey?: string | null;
    responseUnitKey?: string | null;
    status: Extract<TestRun["status"], "running" | "paused">;
    unitResponse?: string | null;
    confirmTestletTimeLeave?: boolean;
    confirmTestletLeaveLock?: boolean;
    logs?: Array<{
      unitKey?: string | null;
      originalUnitId?: string | null;
      entries: ParticipantTestLogEntryInput[];
    }>;
  }): Promise<TestRun>;
  saveTestLogs(input: {
    testRunId: string;
    deliveryId?: string;
    logs: Array<{
      unitKey?: string | null;
      originalUnitId?: string | null;
      entries: ParticipantTestLogEntryInput[];
    }>;
  }): Promise<number>;
  selectAdaptiveState(input: {
    testRunId: string;
    stateKey: string;
    optionKey: string;
  }): Promise<TestRun>;
  listReviews(input: { testRunId: string }): Promise<WorkspaceReview[]>;
  createReview(input: {
    testRunId: string;
    unitKey?: string | null;
    page?: number | null;
    pageLabel?: string | null;
    reviewerId?: string;
    category?: string;
    categories?: string[];
    priority?: number;
    comment: string;
    userAgent?: string | null;
  }): Promise<WorkspaceReview>;
  updateReview(input: {
    testRunId: string;
    reviewId: string;
    unitKey?: string | null;
    page?: number | null;
    pageLabel?: string | null;
    reviewerId?: string;
    category?: string;
    categories?: string[];
    priority?: number;
    comment?: string;
  }): Promise<WorkspaceReview>;
  deleteReview(input: {
    testRunId: string;
    reviewId: string;
  }): Promise<string>;
  unlockTestlet(input: {
    testRunId: string;
    testletKey: string;
    code: string;
  }): Promise<TestRun>;
  resumeRun(input: { testRunId: string }): Promise<TestRun>;
  completeRun(input: {
    testRunId: string;
    confirmTestletTimeLeave?: boolean;
    confirmTestletLeaveLock?: boolean;
  }): Promise<TestRun>;
};

export type MonitorReadPort = {
  listOpenRuns(input: {
    tenantKey: string;
    workspaceKey: string;
    loginKey?: string;
    groupKey?: string;
    groupKeys?: string[];
    bookletKey?: string;
    bookletSpecies?: string;
    participantSessionId?: string;
    testRunId?: string;
    unitKey?: string;
    status?: TestRun["status"];
    limit?: number;
  }): Promise<OpenMonitorRun[]>;
  exportOpenRunsCsv(input: {
    tenantKey: string;
    workspaceKey: string;
    loginKey?: string;
    groupKey?: string;
    groupKeys?: string[];
    bookletKey?: string;
    bookletSpecies?: string;
    participantSessionId?: string;
    testRunId?: string;
    unitKey?: string;
    status?: TestRun["status"];
    limit?: number;
  }): Promise<string>;
};

export type MonitorControlPort = {
  issueRunCommand(input: {
    tenantKey: string;
    workspaceKey: string;
    testRunId: string;
    commandType: MonitorRunCommandType;
    actorId?: string | null;
    targetUnitKey?: string | null;
    remainingSeconds?: number | null;
  }): Promise<MonitorRunCommandResult>;
  issueRunCommands(input: {
    tenantKey: string;
    workspaceKey: string;
    testRunIds: string[];
    commandType: MonitorRunCommandType;
    actorId?: string | null;
    targetUnitKey?: string | null;
    remainingSeconds?: number | null;
  }): Promise<{
    commands: MonitorRunCommandResult[];
    failures: Array<{
      testRunId: string;
      statusCode: number;
      error: string;
      message: string;
      details: unknown;
    }>;
  }>;
};

export type AttachmentPort = {
  listAttachments(input: {
    sessionToken: string;
    tenantKey: string;
    workspaceKey: string;
    groupKey?: string;
  }): Promise<WorkspaceAttachment[]>;
  getAttachment(input: {
    sessionToken: string;
    tenantKey: string;
    workspaceKey: string;
    attachmentId: string;
  }): Promise<WorkspaceAttachment>;
  uploadAttachmentFile(input: {
    sessionToken: string;
    tenantKey: string;
    workspaceKey: string;
    attachmentId: string;
    fileName: string;
    mediaType: string;
    dataBase64: string;
  }): Promise<WorkspaceAttachment>;
  getAttachmentFile(input: {
    sessionToken: string;
    tenantKey: string;
    workspaceKey: string;
    attachmentId: string;
    attachmentFileId: string;
  }): Promise<AttachmentFile>;
  deleteAttachmentFile(input: {
    sessionToken: string;
    tenantKey: string;
    workspaceKey: string;
    attachmentId: string;
    attachmentFileId: string;
  }): Promise<WorkspaceAttachment>;
};

export type AdminAuthPort = {
  bootstrapAdminUser(input: {
    username: string;
    displayName?: string;
    password: string;
  }): Promise<{ adminUser: AdminUser; roleAssignments: AdminRoleAssignment[] }>;
  signIn(input: {
    username: string;
    password: string;
  }): Promise<{
    adminUser: AdminUser;
    adminSession: AdminSession;
    roleAssignments: AdminRoleAssignment[];
  }>;
  getCurrentSession(input: {
    sessionToken: string;
  }): Promise<{
    adminUser: AdminUser;
    adminSession: AdminSession;
    roleAssignments: AdminRoleAssignment[];
  }>;
  changeOwnPassword(input: {
    sessionToken: string;
    password: string;
  }): Promise<{
    adminUser: AdminUser;
    revokedAdminSessionIds: string[];
  }>;
  listAdminSessions(input: {
    sessionToken: string;
    adminUserId?: string;
    status?: AdminSessionStatus;
    limit?: number;
  }): Promise<
    Array<{
      adminSession: AdminSession;
      adminUser: AdminUser;
      status: AdminSessionStatus;
    }>
  >;
  revokeAdminSession(input: {
    sessionToken: string;
    adminSessionId: string;
  }): Promise<AdminSession>;
  revokeAdminSessions(input: {
    sessionToken: string;
    adminSessionIds: string[];
  }): Promise<{
    requestedCount: number;
    adminSessions: AdminSession[];
    failures: Array<{
      adminSessionId: string;
      statusCode: number;
      error: string;
      message: string;
      details: unknown;
    }>;
  }>;
  signOut(input: { sessionToken: string }): Promise<AdminSession>;
};

export type AdminDirectoryPort = {
  listAdminUsers(input: {
    sessionToken: string;
    username?: string;
    status?: AdminUserStatus;
    accessStatus?: AdminUserAccessStatus;
    passwordChangeRequired?: boolean;
    role?: AdminRole;
    tenantKey?: string;
    workspaceKey?: string;
    limit?: number;
  }): Promise<
    Array<{
      adminUser: AdminUser;
      roleAssignments: AdminRoleAssignment[];
    }>
  >;
  createAdminUser(input: {
    sessionToken: string;
    username: string;
    displayName?: string;
    password: string;
    confirmationPassword?: string;
    customTexts?: Record<string, string>;
    validFrom?: string | null;
    validTo?: string | null;
    validForMinutes?: number | null;
    roleAssignments?: Array<{
      role: AdminRole;
      accessMode?: AdminRoleAccessMode | "RW" | "RO";
      tenantKey?: string | null;
      workspaceKey?: string | null;
      groupKey?: string | null;
      monitorProfiles?: MonitorViewProfile[];
      monitorBookletVisibility?: AdminRoleAssignment["monitorBookletVisibility"];
    }>;
  }): Promise<{ adminUser: AdminUser; roleAssignments: AdminRoleAssignment[] }>;
  updateAdminUser(input: {
    sessionToken: string;
    adminUserId: string;
    displayName?: string;
    status?: AdminUserStatus;
    customTexts?: Record<string, string>;
    validFrom?: string | null;
    validTo?: string | null;
    validForMinutes?: number | null;
  }): Promise<{ adminUser: AdminUser; roleAssignments: AdminRoleAssignment[] }>;
  deleteAdminUser(input: {
    sessionToken: string;
    adminUserId: string;
  }): Promise<{
    adminUserId: string;
    username: string;
    deletedRoleAssignmentCount: number;
    deletedSessionCount: number;
  }>;
  resetAdminUserPassword(input: {
    sessionToken: string;
    adminUserId: string;
    password: string;
  }): Promise<{ adminUser: AdminUser; roleAssignments: AdminRoleAssignment[] }>;
  assignAdminRole(input: {
    sessionToken: string;
    adminUserId: string;
    role: AdminRole;
    confirmationPassword?: string;
    accessMode?: AdminRoleAccessMode | "RW" | "RO";
    tenantKey?: string | null;
    workspaceKey?: string | null;
    groupKey?: string | null;
    monitorProfiles?: MonitorViewProfile[];
    monitorBookletVisibility?: AdminRoleAssignment["monitorBookletVisibility"];
  }): Promise<{ adminUser: AdminUser; roleAssignments: AdminRoleAssignment[] }>;
  revokeAdminRole(input: {
    sessionToken: string;
    adminUserId: string;
    roleAssignmentId: string;
    confirmationPassword?: string;
  }): Promise<{ adminUser: AdminUser; roleAssignments: AdminRoleAssignment[] }>;
  listAdminAuditEvents(input: {
    sessionToken: string;
    eventType?: AdminAuditEventType;
    actorAdminUserId?: string;
    subjectAdminUserId?: string;
    limit?: number;
  }): Promise<AdminAuditEvent[]>;
};

export type ApplicationSettingsPort = {
  getApplicationSettings(): Promise<ApplicationSettings>;
  updateApplicationSettings(input: {
    sessionToken: string;
    appTitle: string;
    mainLogo?: string;
    themeName?: ApplicationSettings["themeName"];
    introHtml?: string;
    legalNoticeHtml?: string;
    customTexts?: Record<string, string>;
    globalWarningText?: string | null;
    globalWarningExpiresAt?: string | null;
  }): Promise<ApplicationSettings>;
};

export type FirstSlicePorts = {
  applicationSettings: ApplicationSettingsPort;
  attachments: AttachmentPort;
  adminAuth: AdminAuthPort;
  adminDirectory: AdminDirectoryPort;
  platform: PlatformPort;
  contentIntake: ContentIntakePort;
  workspaceAdminRead: WorkspaceAdminReadPort;
  workspaceResults: WorkspaceResultsPort;
  workspaceReview: WorkspaceReviewPort;
  participantRuntime: ParticipantRuntimePort;
  monitorRead: MonitorReadPort;
  monitorControl: MonitorControlPort;
  systemCheck: SystemCheckPort;
};

export class FirstSliceError extends Error {
  readonly statusCode: number;
  readonly errorCode: string;
  readonly details: unknown;

  constructor(
    statusCode: number,
    errorCode: string,
    message: string,
    details?: unknown
  ) {
    super(message);
    this.statusCode = statusCode;
    this.errorCode = errorCode;
    this.details = details ?? null;
  }
}

export const firstSliceUseCases = {
  getApplicationSettings: "GetApplicationSettings",
  updateApplicationSettings: "UpdateApplicationSettings",
  listAttachments: "ListAttachments",
  getAttachment: "GetAttachment",
  uploadAttachmentFile: "UploadAttachmentFile",
  getAttachmentFile: "GetAttachmentFile",
  deleteAttachmentFile: "DeleteAttachmentFile",
  bootstrapAdminUser: "BootstrapAdminUser",
  adminSignIn: "AdminSignIn",
  getAdminCurrentSession: "GetAdminCurrentSession",
  listAdminSessions: "ListAdminSessions",
  revokeAdminSession: "RevokeAdminSession",
  revokeAdminSessions: "RevokeAdminSessions",
  adminSignOut: "AdminSignOut",
  changeAdminPassword: "ChangeAdminPassword",
  listAdminUsers: "ListAdminUsers",
  createAdminUser: "CreateAdminUser",
  updateAdminUser: "UpdateAdminUser",
  resetAdminUserPassword: "ResetAdminUserPassword",
  assignAdminRole: "AssignAdminRole",
  revokeAdminRole: "RevokeAdminRole",
  listAdminAuditEvents: "ListAdminAuditEvents",
  listTenants: "ListTenants",
  exportTenantsCsv: "ExportTenantsCsv",
  createTenant: "CreateTenant",
  listWorkspaces: "ListWorkspaces",
  exportWorkspacesCsv: "ExportWorkspacesCsv",
  createWorkspace: "CreateWorkspace",
  updateWorkspace: "UpdateWorkspace",
  getWorkspaceOverview: "GetWorkspaceOverview",
  exportWorkspaceOverviewCsv: "ExportWorkspaceOverviewCsv",
  getStudyMonitorSummary: "GetStudyMonitorSummary",
  getStudyMonitorParticipantMatrix: "GetStudyMonitorParticipantMatrix",
  getStudyMonitorParticipantDetail: "GetStudyMonitorParticipantDetail",
  getStudyMonitorGroupDetail: "GetStudyMonitorGroupDetail",
  getStudyMonitorBookletDetail: "GetStudyMonitorBookletDetail",
  getStudyMonitorUnitDetail: "GetStudyMonitorUnitDetail",
  getStudyMonitorRunDetail: "GetStudyMonitorRunDetail",
  listWorkspaceActivityEvents: "ListWorkspaceActivityEvents",
  exportLogCsv: "ExportLogCsv",
  exportStudyMonitorCsv: "ExportStudyMonitorCsv",
  exportStudyMonitorParticipantMatrixCsv: "ExportStudyMonitorParticipantMatrixCsv",
  exportStudyMonitorRunCsv: "ExportStudyMonitorRunCsv",
  exportOpenRunsCsv: "ExportOpenRunsCsv",
  exportParticipantRosterCsv: "ExportParticipantRosterCsv",
  getSourcePackageDetail: "GetSourcePackageDetail",
  getSourcePackageDeletionReadiness: "GetSourcePackageDeletionReadiness",
  listSourcePackages: "ListSourcePackages",
  exportSourcePackagesCsv: "ExportSourcePackagesCsv",
  createSourcePackage: "CreateSourcePackage",
  assembleSourcePackages: "AssembleSourcePackages",
  createImportJob: "CreateImportJob",
  retrySourcePackageImport: "RetrySourcePackageImport",
  replaceSourcePackage: "ReplaceSourcePackage",
  deleteSourcePackage: "DeleteSourcePackage",
  getImportJobDetail: "GetImportJobDetail",
  listParticipantSessions: "ListParticipantSessions",
  getParticipantSessionDetail: "GetParticipantSessionDetail",
  listDetailedResponses: "ListDetailedResponses",
  listReviews: "ListReviews",
  createReview: "CreateReview",
  updateReview: "UpdateReview",
  deleteReview: "DeleteReview",
  exportReviewCsv: "ExportReviewCsv",
  deleteGroupResults: "DeleteGroupResults",
  exportResponseCsv: "ExportResponseCsv",
  exportOriginalResultArchive: "ExportOriginalResultArchive",
  getContentReleaseActivationReadiness: "GetContentReleaseActivationReadiness",
  listImportJobs: "ListImportJobs",
  exportImportJobsCsv: "ExportImportJobsCsv",
  listContentReleases: "ListContentReleases",
  exportContentReleasesCsv: "ExportContentReleasesCsv",
  getContentReleaseDetail: "GetContentReleaseDetail",
  activateContentRelease: "ActivateContentRelease",
  participantSignIn: "ParticipantSignIn",
  getParticipantRuntimeState: "GetParticipantRuntimeState",
  getParticipantCurrentRunState: "GetParticipantCurrentRunState",
  participantLaunch: "ParticipantLaunch",
  resumeParticipantSession: "ResumeParticipantSession",
  saveTestRunProgress: "SaveTestRunProgress",
  listParticipantReviews: "ListParticipantReviews",
  createParticipantReview: "CreateParticipantReview",
  updateParticipantReview: "UpdateParticipantReview",
  deleteParticipantReview: "DeleteParticipantReview",
  resumeTestRun: "ResumeTestRun",
  completeTestRun: "CompleteTestRun",
  listOpenMonitorRuns: "ListOpenMonitorRuns",
  issueMonitorRunCommand: "IssueMonitorRunCommand"
} as const;

export type CreateImportJobResult = {
  importJob: ImportJob;
  stagedContentRelease: ContentRelease | null;
  participantRosterImport?: ParticipantRosterImportSummary;
};

export type ContentReleaseActivationSummary = {
  forced: boolean;
  previousActiveContentReleaseId: string | null;
  supersededOpenRunCount: number;
  supersededOpenRuns: OpenMonitorRun[];
};

export type ActivateContentReleaseResult = {
  contentRelease: ContentRelease;
  activation: ContentReleaseActivationSummary;
};

export type ActivateContentReleaseBlockedDetails = {
  activeContentReleaseId: string;
  openRuns: OpenMonitorRun[];
};

export type FirstSliceServices = FirstSlicePorts & {
  createImportJobWithRelease(input: {
    tenantKey: string;
    workspaceKey: string;
    sourcePackageId: string;
  }): Promise<CreateImportJobResult>;
};

export type FirstSliceRepository = {
  getApplicationSettings(): Promise<ApplicationSettings | null>;
  saveApplicationSettings(settings: ApplicationSettings): Promise<void>;
  listAttachmentFilesByWorkspace(
    tenantId: string,
    workspaceId: string
  ): Promise<AttachmentFile[]>;
  getAttachmentFileById(attachmentFileId: string): Promise<AttachmentFile | null>;
  saveAttachmentFile(attachmentFile: AttachmentFile): Promise<void>;
  deleteAttachmentFile(attachmentFileId: string): Promise<boolean>;
  listAdminUsers(): Promise<AdminUser[]>;
  getAdminUserById(adminUserId: string): Promise<AdminUser | null>;
  getAdminUserByUsername(username: string): Promise<AdminUser | null>;
  getAdminLoginAttempt(username: string): Promise<AdminLoginAttempt | null>;
  recordAdminLoginFailure(input: {
    username: string;
    attemptedAt: string;
    expiresAt: string;
  }): Promise<AdminLoginAttempt>;
  saveAdminUser(adminUser: AdminUser): Promise<void>;
  deleteAdminUser(adminUserId: string): Promise<{
    deletedRoleAssignmentCount: number;
    deletedSessionCount: number;
  }>;
  listAdminRoleAssignmentsByUserId(
    adminUserId: string
  ): Promise<AdminRoleAssignment[]>;
  saveAdminRoleAssignment(roleAssignment: AdminRoleAssignment): Promise<void>;
  deleteAdminRoleAssignment(roleAssignmentId: string): Promise<void>;
  listAdminAuditEvents(): Promise<AdminAuditEvent[]>;
  saveAdminAuditEvent(auditEvent: AdminAuditEvent): Promise<void>;
  listAdminSessions(): Promise<AdminSession[]>;
  getAdminSessionByToken(token: string): Promise<AdminSession | null>;
  saveAdminSession(adminSession: AdminSession): Promise<void>;
  getTenantByKey(tenantKey: string): Promise<Tenant | null>;
  listTenants(): Promise<Tenant[]>;
  saveTenant(tenant: Tenant): Promise<void>;
  getWorkspaceByScope(
    tenantKey: string,
    workspaceKey: string
  ): Promise<Workspace | null>;
  getWorkspaceByWorkspaceKey(workspaceKey: string): Promise<Workspace | null>;
  listWorkspacesByTenantId(tenantId: string): Promise<Workspace[]>;
  saveWorkspace(scope: {
    tenantKey: string;
    workspaceKey: string;
    workspace: Workspace;
  }): Promise<void>;
  deleteWorkspaceAggregate(input: {
    tenantKey: string;
    workspaceKey: string;
    tenantId: string;
    workspaceId: string;
    auditEvent: AdminAuditEvent;
  }): Promise<WorkspaceAggregateDeletionCounts | null>;
  listWorkspaceActivityEventsByWorkspace(
    tenantId: string,
    workspaceId: string
  ): Promise<WorkspaceActivityEvent[]>;
  saveWorkspaceActivityEvent(
    activityEvent: WorkspaceActivityEvent
  ): Promise<void>;
  deleteWorkspaceActivityEventsByIds(activityEventIds: string[]): Promise<number>;
  getSourcePackageById(sourcePackageId: string): Promise<SourcePackage | null>;
  listSourcePackagesByWorkspace(
    tenantId: string,
    workspaceId: string
  ): Promise<SourcePackage[]>;
  saveSourcePackage(sourcePackage: SourcePackage): Promise<void>;
  deleteSourcePackageAggregate(input: {
    tenantId: string;
    workspaceId: string;
    sourcePackageId: string;
    expectedImportJobIds: string[];
    expectedContentReleaseIds: string[];
  }): Promise<boolean>;
  getImportJobById(importJobId: string): Promise<ImportJob | null>;
  listImportJobsByWorkspace(
    tenantId: string,
    workspaceId: string
  ): Promise<ImportJob[]>;
  saveImportJob(importJob: ImportJob): Promise<void>;
  getContentReleaseById(contentReleaseId: string): Promise<ContentRelease | null>;
  listContentReleasesByWorkspace(
    tenantId: string,
    workspaceId: string
  ): Promise<ContentRelease[]>;
  saveContentRelease(contentRelease: ContentRelease): Promise<void>;
  getParticipantSessionById(
    participantSessionId: string
  ): Promise<ParticipantSession | null>;
  listParticipantSessionsByWorkspace(
    tenantId: string,
    workspaceId: string
  ): Promise<ParticipantSession[]>;
  saveParticipantSession(participantSession: ParticipantSession): Promise<void>;
  listParticipantRosterEntriesByWorkspace(
    tenantId: string,
    workspaceId: string
  ): Promise<ParticipantRosterEntry[]>;
  listOperationalLoginMigrationCandidatesByWorkspace(
    tenantId: string,
    workspaceId: string
  ): Promise<OriginalTestcenterOperationalLoginCandidate[]>;
  replaceOperationalLoginMigrationCandidatesByWorkspace(
    tenantId: string,
    workspaceId: string,
    candidates: OriginalTestcenterOperationalLoginCandidate[]
  ): Promise<void>;
  getParticipantRosterPasswordHash(
    tenantId: string,
    workspaceId: string,
    loginKey: string
  ): Promise<string | null>;
  saveParticipantRosterEntry(
    participantRosterEntry: ParticipantRosterEntry,
    passwordHash: string | null
  ): Promise<void>;
  getParticipantLoginAttempt(
    tenantId: string,
    workspaceId: string,
    loginKey: string
  ): Promise<ParticipantLoginAttempt | null>;
  recordParticipantLoginFailure(input: {
    tenantId: string;
    workspaceId: string;
    loginKey: string;
    attemptedAt: string;
    expiresAt: string;
  }): Promise<ParticipantLoginAttempt>;
  getTestRunById(testRunId: string): Promise<TestRun | null>;
  listTestRunsByParticipantSessionId(
    participantSessionId: string
  ): Promise<TestRun[]>;
  getOpenTestRunByParticipantSessionId(
    participantSessionId: string
  ): Promise<TestRun | null>;
  listTestRunsByWorkspace(tenantId: string, workspaceId: string): Promise<TestRun[]>;
  saveTestRun(testRun: TestRun): Promise<void>;
  deleteTestRunsByIds(testRunIds: string[]): Promise<number>;
  listParticipantTestLogsByWorkspace(
    tenantId: string,
    workspaceId: string
  ): Promise<ParticipantTestLog[]>;
  listLatestParticipantTestStateLogsByWorkspace(
    tenantId: string,
    workspaceId: string,
    logKeys: string[]
  ): Promise<ParticipantTestLog[]>;
  saveParticipantTestLogs(testLogs: ParticipantTestLog[]): Promise<void>;
  deleteParticipantTestLogsByTestRunIds(testRunIds: string[]): Promise<number>;
  getWorkspaceReviewById(reviewId: string): Promise<WorkspaceReview | null>;
  listWorkspaceReviewsByWorkspace(
    tenantId: string,
    workspaceId: string
  ): Promise<WorkspaceReview[]>;
  saveWorkspaceReview(review: WorkspaceReview): Promise<void>;
  deleteWorkspaceReview(reviewId: string): Promise<boolean>;
  deleteWorkspaceReviewsByTestRunIds(testRunIds: string[]): Promise<number>;
};

export type FirstSliceDependencies = {
  repository: FirstSliceRepository;
  idGenerator?: () => string;
  now?: () => string;
  adminSessionTtlMs?: number;
  adminLoginMaxFailures?: number;
  adminLoginFailureWindowMs?: number;
  participantAccessTimeZone?: string;
  participantLoginMaxFailures?: number;
  participantLoginFailureWindowMs?: number;
};

const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1_000;
const DEFAULT_ADMIN_LOGIN_MAX_FAILURES = 5;
const DEFAULT_ADMIN_LOGIN_FAILURE_WINDOW_MS = 30 * 60 * 1_000;
const PASSWORD_HASH_KEY_LENGTH = 64;
const ADMIN_ROLES: AdminRole[] = [
  "platform_admin",
  "tenant_admin",
  "workspace_admin",
  "study_monitor",
  "group_monitor",
  "system_check"
];
const ADMIN_USER_STATUSES: AdminUserStatus[] = ["active", "disabled"];
const TEST_RUN_PROGRESS_STATUSES: Array<
  Extract<TestRunStatus, "running" | "paused">
> = ["running", "paused"];
const DEFAULT_PARTICIPANT_ACCESS_TIME_ZONE = "Europe/Berlin";
const DEFAULT_PARTICIPANT_LOGIN_MAX_FAILURES = 5;
const DEFAULT_PARTICIPANT_LOGIN_FAILURE_WINDOW_MS = 30 * 60 * 1_000;

const readTimeZoneParts = (
  timestampMs: number,
  timeZone: string
): [number, number, number, number, number, number] => {
  const parts = new Intl.DateTimeFormat("en-US-u-ca-gregory-nu-latn", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23"
  }).formatToParts(new Date(timestampMs));
  const valueByType = new Map(parts.map(part => [part.type, part.value]));
  return [
    Number(valueByType.get("year")),
    Number(valueByType.get("month")),
    Number(valueByType.get("day")),
    Number(valueByType.get("hour")),
    Number(valueByType.get("minute")),
    Number(valueByType.get("second"))
  ];
};

const localDateTimeToIso = (
  parts: [number, number, number, number, number, number],
  timeZone: string
): string | null => {
  const targetWallClockMs = Date.UTC(
    parts[0],
    parts[1] - 1,
    parts[2],
    parts[3],
    parts[4],
    parts[5]
  );
  let timestampMs = targetWallClockMs;
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const currentParts = readTimeZoneParts(timestampMs, timeZone);
    const currentWallClockMs = Date.UTC(
      currentParts[0],
      currentParts[1] - 1,
      currentParts[2],
      currentParts[3],
      currentParts[4],
      currentParts[5]
    );
    timestampMs += targetWallClockMs - currentWallClockMs;
  }
  return readTimeZoneParts(timestampMs, timeZone).every(
    (value, index) => value === parts[index]
  )
    ? new Date(timestampMs).toISOString()
    : null;
};

export const normalizeParticipantAccessBoundary = (
  value: string | null | undefined,
  timeZone = DEFAULT_PARTICIPANT_ACCESS_TIME_ZONE
): string | null => {
  const normalizedValue = value?.trim();
  if (!normalizedValue) {
    return null;
  }
  if (/(?:z|[+-]\d{2}:?\d{2})$/i.test(normalizedValue)) {
    const timestampMs = Date.parse(normalizedValue);
    return Number.isFinite(timestampMs) ? new Date(timestampMs).toISOString() : null;
  }

  const originalMatch = normalizedValue.match(
    /^(\d{1,2})\/(\d{1,2})\/(\d{2}|\d{4})\D+(\d{1,2}):(\d{2})$/
  );
  const localIsoMatch = normalizedValue.match(
    /^(\d{4})-(\d{2})-(\d{2})[t ](\d{2}):(\d{2})(?::(\d{2}))?$/i
  );
  const parts: [number, number, number, number, number, number] | null =
    originalMatch
      ? [
          Number(originalMatch[3]) < 100
            ? Number(originalMatch[3]) + (Number(originalMatch[3]) <= 69 ? 2000 : 1900)
            : Number(originalMatch[3]),
          Number(originalMatch[2]),
          Number(originalMatch[1]),
          Number(originalMatch[4]),
          Number(originalMatch[5]),
          0
        ]
      : localIsoMatch
        ? [
            Number(localIsoMatch[1]),
            Number(localIsoMatch[2]),
            Number(localIsoMatch[3]),
            Number(localIsoMatch[4]),
            Number(localIsoMatch[5]),
            Number(localIsoMatch[6] ?? 0)
          ]
        : null;
  if (!parts) {
    return null;
  }
  try {
    return localDateTimeToIso(parts, timeZone);
  } catch {
    return null;
  }
};

export const resolveParticipantSessionValidUntil = (
  rosterEntry: Pick<ParticipantRosterEntry, "validTo" | "validForMinutes"> | null,
  createdAt: string
): string | null => {
  if (!rosterEntry) {
    return null;
  }
  const candidates = [
    rosterEntry.validTo ? Date.parse(rosterEntry.validTo) : Number.NaN,
    rosterEntry.validForMinutes
      ? Date.parse(createdAt) + rosterEntry.validForMinutes * 60_000
      : Number.NaN
  ].filter(Number.isFinite);
  return candidates.length > 0
    ? new Date(Math.min(...candidates)).toISOString()
    : null;
};

const assertParticipantAccessWindow = (
  rosterEntry: Pick<ParticipantRosterEntry, "validFrom" | "validTo"> | null,
  timestamp: string,
  sessionValidUntil?: string | null
): void => {
  const timestampMs = Date.parse(timestamp);
  const validTo = rosterEntry?.validTo ?? null;
  const effectiveValidUntil = [validTo, sessionValidUntil]
    .filter((value): value is string => Boolean(value))
    .sort()[0] ?? null;
  if (
    effectiveValidUntil &&
    Number.isFinite(timestampMs) &&
    Date.parse(effectiveValidUntil) < timestampMs
  ) {
    throw new FirstSliceError(
      410,
      "participant_access_expired",
      `Participant access expired at '${effectiveValidUntil}'.`,
      { validUntil: effectiveValidUntil }
    );
  }
  const validFrom = rosterEntry?.validFrom ?? null;
  if (
    validFrom &&
    Number.isFinite(timestampMs) &&
    Date.parse(validFrom) > timestampMs
  ) {
    throw new FirstSliceError(
      401,
      "participant_access_not_started",
      `Participant access starts at '${validFrom}'.`,
      { validFrom }
    );
  }
};

type AdminRoleAssignmentInput = {
  role: AdminRole;
  accessMode?: AdminRoleAccessMode | "RW" | "RO";
  tenantKey?: string | null;
  workspaceKey?: string | null;
  groupKey?: string | null;
  monitorProfiles?: MonitorViewProfile[];
  monitorBookletVisibility?: AdminRoleAssignment["monitorBookletVisibility"];
};

type ResolvedAdminRoleScope = {
  role: AdminRole;
  accessMode: AdminRoleAccessMode;
  tenantId: string | null;
  workspaceId: string | null;
  groupKey: string | null;
  monitorProfiles: MonitorViewProfile[];
  monitorBookletVisibility: AdminRoleAssignment["monitorBookletVisibility"];
};

const normalizeAdminUsername = (value: unknown): string => {
  if (typeof value !== "string" || value.trim() === "") {
    throw new FirstSliceError(
      400,
      "admin_username_required",
      "Admin username is required."
    );
  }

  return value.trim().toLowerCase();
};

const requireAdminPassword = (value: unknown): string => {
  if (
    typeof value !== "string" ||
    value.length < adminPasswordPolicy.minimumLength ||
    value.length > adminPasswordPolicy.maximumLength
  ) {
    throw new FirstSliceError(
      400,
      "admin_password_policy_violation",
      `Admin password must contain ${adminPasswordPolicy.minimumLength} through ${adminPasswordPolicy.maximumLength} characters.`
    );
  }

  return value;
};

const normalizeAdminDisplayName = (
  value: unknown,
  fallbackDisplayName: string
): string => {
  if (value === undefined || value === null) {
    return fallbackDisplayName;
  }

  if (typeof value !== "string") {
    throw new FirstSliceError(
      400,
      "admin_display_name_invalid",
      "Admin display name must be a string."
    );
  }

  return value.trim() || fallbackDisplayName;
};

const normalizeWorkspaceDisplayName = (value: unknown): string => {
  if (typeof value !== "string") {
    throw new FirstSliceError(
      400,
      "workspace_display_name_invalid",
      "Workspace display name must be a string between 3 and 200 characters."
    );
  }

  const displayName = value.trim();
  const characterCount = Array.from(displayName).length;
  if (
    characterCount < 3 ||
    characterCount > 200 ||
    /[\u0000-\u001F\u007F]/u.test(displayName)
  ) {
    throw new FirstSliceError(
      400,
      "workspace_display_name_invalid",
      "Workspace display name must be between 3 and 200 characters and cannot contain control characters."
    );
  }

  return displayName;
};

const normalizeAdminCustomTexts = (value: unknown): Record<string, string> => {
  if (value === undefined || value === null) {
    return {};
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new FirstSliceError(
      400,
      "admin_custom_texts_invalid",
      "Admin custom texts must be a key-value object."
    );
  }
  const entries = Object.entries(value);
  if (entries.length > 250) {
    throw new FirstSliceError(
      400,
      "admin_custom_texts_too_large",
      "Admin custom texts must not contain more than 250 keys."
    );
  }
  const customTexts: Record<string, string> = {};
  let totalBytes = 0;
  for (const [rawKey, rawValue] of entries) {
    const key = rawKey.trim();
    if (
      !/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(key) ||
      key.length > 120 ||
      typeof rawValue !== "string"
    ) {
      throw new FirstSliceError(
        400,
        "admin_custom_texts_invalid",
        `Admin custom text key '${rawKey || "missing"}' or its value is invalid.`
      );
    }
    const text = rawValue.trim();
    if (!text) {
      continue;
    }
    const valueBytes = Buffer.byteLength(text, "utf8");
    totalBytes += Buffer.byteLength(key, "utf8") + valueBytes;
    if (valueBytes > 10_000 || totalBytes > 250_000) {
      throw new FirstSliceError(
        400,
        "admin_custom_texts_too_large",
        "Admin custom texts exceed the supported size limit."
      );
    }
    customTexts[key] = text;
  }
  return customTexts;
};

const normalizeAdminUserStatus = (value: unknown): AdminUserStatus => {
  if (
    typeof value !== "string" ||
    !ADMIN_USER_STATUSES.includes(value as AdminUserStatus)
  ) {
    throw new FirstSliceError(
      400,
      "admin_user_status_invalid",
      "Admin user status must be 'active' or 'disabled'."
    );
  }

  return value as AdminUserStatus;
};

const normalizeTestRunProgressStatus = (
  value: unknown
): Extract<TestRunStatus, "running" | "paused"> => {
  if (
    typeof value !== "string" ||
    !TEST_RUN_PROGRESS_STATUSES.includes(
      value as Extract<TestRunStatus, "running" | "paused">
    )
  ) {
    throw new FirstSliceError(
      400,
      "test_run_progress_status_invalid",
      "Test run progress status must be 'running' or 'paused'."
    );
  }

  return value as Extract<TestRunStatus, "running" | "paused">;
};

const normalizeMonitorRunCommandType = (value: unknown): MonitorRunCommandType => {
  if (
    typeof value !== "string" ||
    !monitorRunCommandTypes.includes(value as MonitorRunCommandType)
  ) {
    throw new FirstSliceError(
      400,
      "monitor_run_command_type_invalid",
      "Monitor run command type must be 'pause', 'resume', 'complete', 'complete_and_lock', 'goto', 'lock_test', 'unlock_test', 'unlock_navigation', 'lock_navigation', or 'set_testlet_time'."
    );
  }

  return value as MonitorRunCommandType;
};

const normalizeMonitorGotoTargetUnitKey = (value: unknown): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw new FirstSliceError(
      400,
      "monitor_goto_target_unit_required",
      "targetUnitKey is required for a monitor goto command."
    );
  }
  return value.trim();
};

const normalizeMonitorTimeTargetUnitKey = (value: unknown): string => {
  if (typeof value !== "string" || !value.trim()) {
    throw new FirstSliceError(
      400,
      "monitor_time_target_unit_required",
      "targetUnitKey is required for a monitor set-testlet-time command."
    );
  }
  return value.trim();
};

const normalizeMonitorTimeRemainingSeconds = (value: unknown): number => {
  const remainingSeconds = Number(value);
  if (
    !Number.isInteger(remainingSeconds) ||
    remainingSeconds < 1 ||
    remainingSeconds > 86_400
  ) {
    throw new FirstSliceError(
      400,
      "monitor_time_remaining_seconds_invalid",
      "remainingSeconds must be an integer from 1 through 86400."
    );
  }
  return remainingSeconds;
};

const normalizeParticipantLoginKey = (value: unknown): string => {
  const loginKey = String(value ?? "").trim();
  if (!loginKey) {
    throw new FirstSliceError(
      400,
      "participant_login_key_required",
      "Participant loginKey is required."
    );
  }

  return loginKey;
};

const normalizeParticipantWorkspaceKey = (value: unknown): string => {
  const workspaceKey = String(value ?? "").trim();
  if (!workspaceKey) {
    throw new FirstSliceError(
      400,
      "participant_workspace_key_required",
      "Participant workspaceKey is required."
    );
  }

  return workspaceKey;
};

const normalizeOptionalParticipantTenantKey = (value: unknown): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new FirstSliceError(
      400,
      "participant_tenant_key_invalid",
      "Participant tenantKey must be a string when provided."
    );
  }

  return value.trim() || null;
};

const normalizeParticipantSessionId = (value: unknown): string => {
  if (typeof value !== "string" || value.trim() === "") {
    throw new FirstSliceError(
      400,
      "participant_session_id_required",
      "participantSessionId is required."
    );
  }

  return value.trim();
};

const normalizeTestRunId = (value: unknown): string => {
  if (typeof value !== "string" || value.trim() === "") {
    throw new FirstSliceError(
      400,
      "test_run_id_required",
      "testRunId is required."
    );
  }

  return value.trim();
};

const normalizeOptionalParticipantDeliveryId = (
  value: unknown
): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }
  if (
    typeof value !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._:-]{0,199}$/.test(value.trim())
  ) {
    throw new FirstSliceError(
      400,
      "participant_delivery_id_invalid",
      "deliveryId must contain 1–200 URL-safe identifier characters when provided."
    );
  }
  return value.trim();
};

const normalizeOptionalRuntimeBookletKey = (value: unknown): string | undefined => {
  if (value === undefined || value === null) {
    return undefined;
  }

  if (typeof value !== "string") {
    throw new FirstSliceError(
      400,
      "booklet_key_invalid",
      "bookletKey must be a string when provided."
    );
  }

  return value.trim() || undefined;
};

const normalizeOptionalCurrentUnitKey = (value: unknown): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new FirstSliceError(
      400,
      "current_unit_key_invalid",
      "currentUnitKey must be a string when provided."
    );
  }

  return value.trim() || null;
};

const normalizeOptionalResponseUnitKey = (value: unknown): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new FirstSliceError(
      400,
      "response_unit_key_invalid",
      "responseUnitKey must be a string when provided."
    );
  }

  return value.trim() || null;
};

const normalizeOptionalUnitResponse = (value: unknown): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new FirstSliceError(
      400,
      "unit_response_invalid",
      "unitResponse must be a string when provided."
    );
  }

  return value;
};

const normalizeAdminRole = (value: unknown): AdminRole => {
  if (typeof value !== "string" || !ADMIN_ROLES.includes(value as AdminRole)) {
    throw new FirstSliceError(
      400,
      "admin_role_invalid",
      "Admin role must be a supported role."
    );
  }

  return value as AdminRole;
};

const normalizeAdminRoleAccessMode = (
  value: unknown,
  role: AdminRole
): AdminRoleAccessMode => {
  const normalized = value === undefined ? "read_write" : value;
  const accessMode =
    normalized === "RW"
      ? "read_write"
      : normalized === "RO"
        ? "read_only"
        : normalized;
  if (accessMode !== "read_write" && accessMode !== "read_only") {
    throw new FirstSliceError(
      400,
      "admin_role_access_mode_invalid",
      "Admin role accessMode must be 'read_write', 'read_only', 'RW', or 'RO'."
    );
  }
  if (accessMode === "read_only" && role !== "workspace_admin") {
    throw new FirstSliceError(
      400,
      "admin_role_access_mode_invalid",
      "Read-only access is only supported for workspace admin role assignments."
    );
  }
  return accessMode;
};

const normalizeOptionalScopeKey = (value: unknown, fieldName: string): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new FirstSliceError(
      400,
      "admin_role_scope_invalid",
      `${fieldName} must be a string when provided.`
    );
  }

  return value.trim() || null;
};

const normalizeGroupKey = (value: unknown): string => {
  if (typeof value !== "string" || value.trim() === "") {
    throw new FirstSliceError(
      400,
      "group_key_required",
      "groupKey is required."
    );
  }

  return value.trim();
};

const normalizeSourcePackageText = (
  value: unknown,
  fieldName: string,
  errorCode: string
): string => {
  if (typeof value !== "string" || value.trim() === "") {
    throw new FirstSliceError(400, errorCode, `${fieldName} is required.`);
  }

  return value.trim();
};

const normalizeOptionalSourcePackageText = (
  value: unknown,
  fieldName: string,
  errorCode: string
): string | undefined => {
  if (value === undefined) {
    return undefined;
  }

  return normalizeSourcePackageText(value, fieldName, errorCode);
};

const normalizeOptionalSourceDocument = (
  value: unknown
): string | null | undefined => {
  if (value === undefined) {
    return undefined;
  }

  if (value === null) {
    return null;
  }

  if (typeof value === "object") {
    return JSON.stringify(value, null, 2);
  }

  if (typeof value !== "string") {
    throw new FirstSliceError(
      400,
      "source_document_invalid",
      "sourceDocument must be a string, JSON object, or JSON array when provided."
    );
  }

  return value.trim() === "" ? null : value;
};

const decodePersistedSourceDocument = (
  sourcePackage: SourcePackage
): { mediaType: string; bytes: Buffer } | null => {
  const sourceDocument = sourcePackage.sourceDocument;
  if (sourceDocument === null) {
    return null;
  }

  const dataUrlMatch = sourceDocument.match(
    /^data:([^,]*?)(;base64)?,([\s\S]*)$/i
  );
  if (!dataUrlMatch) {
    return {
      mediaType: sourcePackage.mediaType,
      bytes: Buffer.from(sourceDocument, "utf8")
    };
  }

  const mediaType = dataUrlMatch[1]?.trim() || sourcePackage.mediaType;
  const payload = dataUrlMatch[3] ?? "";
  if (dataUrlMatch[2]) {
    const normalizedPayload = payload
      .replace(/\s+/g, "")
      .replace(/-/g, "+")
      .replace(/_/g, "/");
    if (
      !/^[A-Za-z0-9+/]*={0,2}$/.test(normalizedPayload) ||
      normalizedPayload.length % 4 === 1
    ) {
      return null;
    }
    return {
      mediaType,
      bytes: Buffer.from(normalizedPayload, "base64")
    };
  }

  try {
    return {
      mediaType,
      bytes: Buffer.from(decodeURIComponent(payload), "utf8")
    };
  } catch {
    return null;
  }
};

type TestcenterXmlFileIdentity = {
  fileType: "Booklet" | "Unit" | "SysCheck" | "Testtakers";
  id: string;
  source: "metadata" | "roster";
};

type TesttakersRosterStructure = {
  groups: Array<{
    groupId: string;
    loginNames: string[];
  }>;
};

const readTesttakersRosterStructure = (
  sourceDocument: string
): TesttakersRosterStructure | null => {
  const parserErrors: string[] = [];
  let document: XmlDocument | null = null;
  try {
    document = new DOMParser({
      onError(level, message) {
        if (level === "error" || level === "fatalError") {
          parserErrors.push(message);
        }
      }
    }).parseFromString(sourceDocument, "application/xml");
  } catch {
    return null;
  }
  const root = document?.documentElement;
  if (
    parserErrors.length > 0 ||
    !root ||
    xmlElementLocalName(root).toLowerCase() !== "testtakers"
  ) {
    return null;
  }

  const groups = xmlChildrenNamed(root, "Group").map(group => {
    const groupId = group.getAttribute("id")?.trim() ?? "";
    const loginNames = xmlChildrenNamed(group, "Login")
      .map(login => login.getAttribute("name")?.trim() ?? "");
    return { groupId, loginNames };
  });
  if (
    groups.length === 0 ||
    groups.some(
      group =>
        !group.groupId ||
        group.loginNames.length === 0 ||
        group.loginNames.some(loginName => !loginName)
    )
  ) {
    return null;
  }
  return { groups };
};

const readTesttakersRosterIdentity = (
  sourceDocument: string
): TestcenterXmlFileIdentity | null => {
  const rosterStructure = readTesttakersRosterStructure(sourceDocument);
  if (!rosterStructure) {
    return null;
  }
  const groupIdentities = rosterStructure.groups.map(group => ({
    groupId: group.groupId.toLowerCase(),
    loginNames: group.loginNames.map(loginName => loginName.toLowerCase()).sort()
  }));
  groupIdentities.sort((left, right) =>
    left.groupId.localeCompare(right.groupId)
  );
  const rosterDigest = createHash("sha256")
    .update(JSON.stringify(groupIdentities))
    .digest("hex");
  return {
    fileType: "Testtakers",
    id: `roster:${rosterDigest}`,
    source: "roster"
  };
};

const readTestcenterXmlFileIdentity = (
  sourceDocument: string
): TestcenterXmlFileIdentity | null => {
  const documentHead = sourceDocument.slice(0, 256 * 1024);
  if (/<!DOCTYPE\b/i.test(documentHead)) {
    return null;
  }
  const rootName = documentHead
    .replace(/^\uFEFF/, "")
    .match(
      /^\s*(?:(?:<\?[^?]*\?>|<!--[\s\S]*?-->)\s*)*<(?:(?:[A-Za-z_][\w.-]*):)?([A-Za-z_][\w.-]*)\b/i
    )?.[1];
  const fileType = (["Booklet", "Unit", "SysCheck", "Testtakers"] as const).find(
    candidate => candidate.toLowerCase() === rootName?.toLowerCase()
  );
  if (!fileType) {
    return null;
  }
  const metadataContent = documentHead
    .replace(/<!--[\s\S]*?-->/g, "")
    .match(
      /<((?:[A-Za-z_][\w.-]*:)?Metadata)\b[^>]*>([\s\S]*?)<\/\1>/i
    )?.[2];
  const encodedId = metadataContent?.match(
    /<((?:[A-Za-z_][\w.-]*:)?Id)\b[^>]*>([\s\S]*?)<\/\1>/i
  )?.[2];
  const id = encodedId ? decodeXmlTextContent(encodedId).trim() : "";
  if (id) {
    return { fileType, id, source: "metadata" };
  }
  return fileType === "Testtakers"
    ? readTesttakersRosterIdentity(sourceDocument)
    : null;
};

const readStandaloneTestcenterXmlFileIdentity = (
  sourcePackage: SourcePackage
): TestcenterXmlFileIdentity | null => {
  const normalizedFileName = sourcePackage.fileName.trim().toLowerCase();
  const normalizedMediaType = sourcePackage.mediaType.trim().toLowerCase();
  if (
    normalizedFileName.endsWith(".zip") ||
    normalizedMediaType.includes("zip")
  ) {
    return null;
  }
  const persistedDocument = sourcePackage.sourceDocument;
  if (!persistedDocument) {
    return null;
  }
  const isDataUrl = /^data:/i.test(persistedDocument);
  const decodedDocument = isDataUrl
    ? decodePersistedSourceDocument(sourcePackage)
    : null;
  if (isDataUrl && !decodedDocument) {
    return null;
  }
  const sourceDocument = decodedDocument
    ? decodedDocument.bytes.toString("utf8")
    : persistedDocument;
  return readTestcenterXmlFileIdentity(sourceDocument);
};

const inferVeronaPlayerResourceIdFromFileName = (
  fileName: string
): string | null => {
  const baseName = fileName.split(/[\\/]/).at(-1) ?? fileName;
  const stem = baseName.replace(/\.html?$/i, "");
  const versionedName = stem.match(
    /^(.+?)[@-](\d+)\.(\d+)(?:\.\d+)?(?:[-+][0-9A-Za-z.-]+)?$/
  );
  if (!versionedName?.[1]) {
    return null;
  }
  return `${versionedName[1]}-${Number.parseInt(versionedName[2] ?? "", 10)}.${Number.parseInt(versionedName[3] ?? "", 10)}`;
};

const readVeronaPlayerResourceId = (
  playerHtml: string,
  fileName: string
): string | null => {
  const metadata = validateVeronaPlayerMetadata(playerHtml);
  if (metadata.status === "valid") {
    const moduleVersion = normalizeVeronaMajorMinorVersion(metadata.version);
    return moduleVersion ? `${metadata.id}-${moduleVersion}` : null;
  }
  return inferVeronaPlayerResourceIdFromFileName(fileName);
};

const readStandaloneVeronaPlayerResourceId = (
  sourcePackage: SourcePackage
): string | null => {
  const normalizedFileName = sourcePackage.fileName.trim().toLowerCase();
  if (
    (!normalizedFileName.endsWith(".html") &&
      !normalizedFileName.endsWith(".htm")) ||
    normalizedFileName.endsWith(".zip") ||
    !sourcePackage.sourceDocument
  ) {
    return null;
  }
  const persistedDocument = sourcePackage.sourceDocument;
  const decodedDocument = decodePersistedSourceDocument(sourcePackage);
  const playerHtml = decodedDocument
    ? decodedDocument.bytes.toString("utf8")
    : persistedDocument;
  return readVeronaPlayerResourceId(playerHtml, sourcePackage.fileName);
};

const classifyWorkspaceSourcePackage = (
  sourcePackage: SourcePackage,
  decodedDocument: { mediaType: string; bytes: Buffer } | null
): WorkspaceFileType => {
  const normalizedFileName = sourcePackage.fileName.trim().toLowerCase();
  const normalizedMediaType = (
    decodedDocument?.mediaType ?? sourcePackage.mediaType
  ).toLowerCase();

  if (
    normalizedFileName.endsWith(".itcr.zip") ||
    normalizedMediaType.includes("verona-resource")
  ) {
    return "Resource";
  }
  if (normalizedFileName.endsWith(".zip") || normalizedMediaType.includes("zip")) {
    return "Package";
  }

  const structure = sourcePackage.contentStructure;
  if (
    structure?.systemCheckEntries?.length &&
    structure.bookletEntries.length === 0
  ) {
    return "SysCheck";
  }

  const documentText = decodedDocument?.bytes
    .subarray(0, 64 * 1024)
    .toString("utf8")
    .replace(/^\uFEFF/, "")
    .trimStart();
  const looksLikeXml =
    normalizedMediaType.includes("xml") ||
    normalizedFileName.endsWith(".xml") ||
    normalizedFileName.endsWith(".manifest") ||
    normalizedFileName.endsWith(".imsmanifest") ||
    documentText?.startsWith("<");

  if (documentText && looksLikeXml) {
    const rootName = documentText
      .match(
        /^(?:(?:<\?[^?]*\?>|<!--[\s\S]*?-->|<!DOCTYPE[^>]*>)\s*)*<(?:(?:[A-Za-z_][\w.-]*):)?([A-Za-z_][\w.-]*)\b/i
      )?.[1]
      ?.toLowerCase();
    if (rootName === "testtakers") {
      return "Testtakers";
    }
    if (rootName === "booklet") {
      return "Booklet";
    }
    if (rootName === "syscheck") {
      return "SysCheck";
    }
    if (rootName === "unit") {
      return "Unit";
    }
    if (rootName === "manifest") {
      return "Package";
    }
  }

  if (
    structure?.bookletEntries.length ||
    (documentText &&
      /["'](?:booklets|bookletEntries)["']\s*:/i.test(documentText))
  ) {
    return "Package";
  }

  return "Resource";
};

const buildWorkspaceSourcePackageDependencyGraph = (input: {
  rootSourcePackage: SourcePackage;
  sourcePackages: SourcePackage[];
  importJobs: ImportJob[];
  contentReleases: ContentRelease[];
  activityEvents: WorkspaceActivityEvent[];
}): WorkspaceSourcePackageDependencyGraph => {
  const nodes = new Map<string, WorkspaceFileDependencyNode>();
  const edges = new Map<string, WorkspaceFileDependencyEdge>();
  const sourceNodeId = (sourcePackageId: string): string =>
    `source-package:${sourcePackageId}`;
  const assetNodeId = (
    sourcePackageId: string,
    nodeType: WorkspaceFileDependencyNode["nodeType"],
    key: string
  ): string =>
    `source-package:${sourcePackageId}:${nodeType}:${encodeURIComponent(key)}`;
  const addNode = (node: WorkspaceFileDependencyNode): string => {
    if (!nodes.has(node.nodeId)) {
      nodes.set(node.nodeId, node);
    }
    return node.nodeId;
  };
  const addEdge = (edge: WorkspaceFileDependencyEdge): void => {
    if (edge.fromNodeId === edge.toNodeId) {
      return;
    }
    edges.set(
      `${edge.fromNodeId}\u0000${edge.relationshipType}\u0000${edge.toNodeId}`,
      edge
    );
  };

  const knownSourcePackageIds = new Set(
    input.sourcePackages.map(sourcePackage => sourcePackage.sourcePackageId)
  );
  for (const event of input.activityEvents) {
    if (
      event.eventType !== "source_package_assembled" ||
      !knownSourcePackageIds.has(event.subjectId)
    ) {
      continue;
    }
    const members = event.details.sourcePackages;
    if (!Array.isArray(members)) {
      continue;
    }
    for (const member of members) {
      if (
        !member ||
        typeof member !== "object" ||
        !("sourcePackageId" in member) ||
        typeof member.sourcePackageId !== "string" ||
        !knownSourcePackageIds.has(member.sourcePackageId)
      ) {
        continue;
      }
      addEdge({
        fromNodeId: sourceNodeId(event.subjectId),
        toNodeId: sourceNodeId(member.sourcePackageId),
        relationshipType: "assembled_from"
      });
    }
  }

  const relatedSourceNodeIds = new Set<string>([
    sourceNodeId(input.rootSourcePackage.sourcePackageId)
  ]);
  const pendingSourceNodeIds = [...relatedSourceNodeIds];
  const assemblyEdges = [...edges.values()];
  while (pendingSourceNodeIds.length > 0) {
    const currentNodeId = pendingSourceNodeIds.shift();
    if (!currentNodeId) {
      continue;
    }
    for (const edge of assemblyEdges) {
      const relatedNodeId =
        edge.fromNodeId === currentNodeId
          ? edge.toNodeId
          : edge.toNodeId === currentNodeId
            ? edge.fromNodeId
            : null;
      if (relatedNodeId && !relatedSourceNodeIds.has(relatedNodeId)) {
        relatedSourceNodeIds.add(relatedNodeId);
        pendingSourceNodeIds.push(relatedNodeId);
      }
    }
  }

  const sourcePackageIdByImportJobId = new Map(
    input.importJobs.map(importJob => [
      importJob.importJobId,
      importJob.sourcePackageId
    ])
  );
  const releasesBySourcePackageId = new Map<string, ContentRelease[]>();
  for (const release of input.contentReleases) {
    const sourcePackageId = sourcePackageIdByImportJobId.get(release.importJobId);
    if (!sourcePackageId) {
      continue;
    }
    const releases = releasesBySourcePackageId.get(sourcePackageId) ?? [];
    releases.push(release);
    releasesBySourcePackageId.set(sourcePackageId, releases);
  }

  for (const sourcePackage of input.sourcePackages) {
    if (!relatedSourceNodeIds.has(sourceNodeId(sourcePackage.sourcePackageId))) {
      continue;
    }
    addNode({
      nodeId: sourceNodeId(sourcePackage.sourcePackageId),
      nodeType: "source_package",
      key: sourcePackage.sourcePackageId,
      label: sourcePackage.fileName,
      sourcePackageId: sourcePackage.sourcePackageId,
      fileType: classifyWorkspaceSourcePackage(
        sourcePackage,
        decodePersistedSourceDocument(sourcePackage)
      ),
      status: sourcePackage.status
    });
    const latestRelease = (releasesBySourcePackageId.get(
      sourcePackage.sourcePackageId
    ) ?? [])
      .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];
    const runtimeSnapshot = latestRelease?.runtimeSnapshot;
    const bookletEntries =
      runtimeSnapshot?.bookletEntries ??
      sourcePackage.contentStructure?.bookletEntries ??
      [];
    const playerEntries =
      runtimeSnapshot?.playerEntries ??
      sourcePackage.contentStructure?.playerEntries ??
      [];
    const systemCheckEntries =
      runtimeSnapshot?.systemCheckEntries ??
      sourcePackage.contentStructure?.systemCheckEntries ??
      [];
    const rootId = sourceNodeId(sourcePackage.sourcePackageId);
    const playerNodeIds = new Map<string, string>();
    for (const player of playerEntries) {
      const nodeId = addNode({
        nodeId: assetNodeId(
          sourcePackage.sourcePackageId,
          "player",
          player.playerKey
        ),
        nodeType: "player",
        key: player.playerKey,
        label: player.playerKey,
        sourcePackageId: sourcePackage.sourcePackageId
      });
      playerNodeIds.set(player.playerKey.toLowerCase(), nodeId);
      addEdge({
        fromNodeId: rootId,
        toNodeId: nodeId,
        relationshipType: "contains_resource"
      });
    }

    const unitNodeIds = new Map<string, string>();
    const ensureUnitNode = (unit: {
      unitKey: string;
      originalUnitId?: string;
      displayLabel: string;
      playerKey?: string;
      unitDefinition?: string;
      unitDefinitionType?: string;
      codingScheme?: UnitCodingScheme;
    }): string => {
      const unitIdentity = unit.originalUnitId || unit.unitKey;
      const normalizedUnitIdentity = unitIdentity.toLowerCase();
      const existingNodeId = unitNodeIds.get(normalizedUnitIdentity);
      if (existingNodeId) {
        return existingNodeId;
      }
      const unitNodeId = addNode({
        nodeId: assetNodeId(
          sourcePackage.sourcePackageId,
          "unit",
          unitIdentity
        ),
        nodeType: "unit",
        key: unitIdentity,
        label: unit.displayLabel || unit.unitKey,
        sourcePackageId: sourcePackage.sourcePackageId
      });
      unitNodeIds.set(normalizedUnitIdentity, unitNodeId);
      if (unit.playerKey) {
        const playerNodeId =
          playerNodeIds.get(unit.playerKey.toLowerCase()) ??
          addNode({
            nodeId: assetNodeId(
              sourcePackage.sourcePackageId,
              "player",
              unit.playerKey
            ),
            nodeType: "player",
            key: unit.playerKey,
            label: unit.playerKey,
            sourcePackageId: sourcePackage.sourcePackageId
          });
        playerNodeIds.set(unit.playerKey.toLowerCase(), playerNodeId);
        addEdge({
          fromNodeId: unitNodeId,
          toNodeId: playerNodeId,
          relationshipType: "uses_player"
        });
      }
      if (unit.unitDefinition) {
        const definitionNodeId = addNode({
          nodeId: assetNodeId(
            sourcePackage.sourcePackageId,
            "definition",
            unitIdentity
          ),
          nodeType: "definition",
          key: unitIdentity,
          label: unit.unitDefinitionType || `${unit.displayLabel} definition`,
          sourcePackageId: sourcePackage.sourcePackageId
        });
        addEdge({
          fromNodeId: unitNodeId,
          toNodeId: definitionNodeId,
          relationshipType: "uses_definition"
        });
      }
      if (unit.codingScheme) {
        const codingSchemeNodeId = addNode({
          nodeId: assetNodeId(
            sourcePackage.sourcePackageId,
            "coding_scheme",
            unitIdentity
          ),
          nodeType: "coding_scheme",
          key: unitIdentity,
          label: `${unit.displayLabel} coding scheme${
            unit.codingScheme.version ? ` ${unit.codingScheme.version}` : ""
          }`,
          sourcePackageId: sourcePackage.sourcePackageId
        });
        addEdge({
          fromNodeId: unitNodeId,
          toNodeId: codingSchemeNodeId,
          relationshipType: "uses_coding_scheme"
        });
      }
      return unitNodeId;
    };

    for (const booklet of bookletEntries) {
      const bookletNodeId = addNode({
        nodeId: assetNodeId(
          sourcePackage.sourcePackageId,
          "booklet",
          booklet.bookletKey
        ),
        nodeType: "booklet",
        key: booklet.bookletKey,
        label: booklet.displayLabel,
        sourcePackageId: sourcePackage.sourcePackageId
      });
      addEdge({
        fromNodeId: rootId,
        toNodeId: bookletNodeId,
        relationshipType: "contains_booklet"
      });
      for (const unit of booklet.unitEntries) {
        addEdge({
          fromNodeId: bookletNodeId,
          toNodeId: ensureUnitNode(unit),
          relationshipType: "contains_unit"
        });
      }
    }

    for (const systemCheck of systemCheckEntries) {
      const systemCheckNodeId = addNode({
        nodeId: assetNodeId(
          sourcePackage.sourcePackageId,
          "system_check",
          systemCheck.checkId
        ),
        nodeType: "system_check",
        key: systemCheck.checkId,
        label: systemCheck.displayLabel,
        sourcePackageId: sourcePackage.sourcePackageId
      });
      addEdge({
        fromNodeId: rootId,
        toNodeId: systemCheckNodeId,
        relationshipType: "contains_system_check"
      });
      if (systemCheck.unitKey) {
        const resolvedUnit =
          systemCheck.unitEntry?.unitKey.toLowerCase() ===
          systemCheck.unitKey.toLowerCase()
            ? systemCheck.unitEntry
            : {
                unitKey: systemCheck.unitKey,
                displayLabel: systemCheck.unitKey
              };
        const unitNodeId =
          unitNodeIds.get(systemCheck.unitKey.toLowerCase()) ??
          ensureUnitNode(resolvedUnit);
        addEdge({
          fromNodeId: systemCheckNodeId,
          toNodeId: unitNodeId,
          relationshipType: "uses_unit"
        });
      }
    }

    for (const resource of runtimeSnapshot?.resourceEntries ?? []) {
      const resourceNodeId = addNode({
        nodeId: assetNodeId(
          sourcePackage.sourcePackageId,
          "resource",
          resource.resourcePath
        ),
        nodeType: "resource",
        key: resource.resourcePath,
        label: resource.resourcePath,
        sourcePackageId: sourcePackage.sourcePackageId
      });
      addEdge({
        fromNodeId: rootId,
        toNodeId: resourceNodeId,
        relationshipType: "contains_resource"
      });
    }
  }

  const rootNodeId = sourceNodeId(input.rootSourcePackage.sourcePackageId);
  const allEdges = [...edges.values()];
  const outgoingNodeIds = new Map<string, Set<string>>();
  const incomingNodeIds = new Map<string, Set<string>>();
  const connectedNodeIdsByNodeId = new Map<string, Set<string>>();
  const addAdjacentNode = (
    adjacency: Map<string, Set<string>>,
    nodeId: string,
    adjacentNodeId: string
  ): void => {
    const adjacentNodeIds = adjacency.get(nodeId) ?? new Set<string>();
    adjacentNodeIds.add(adjacentNodeId);
    adjacency.set(nodeId, adjacentNodeIds);
  };
  for (const edge of allEdges) {
    addAdjacentNode(outgoingNodeIds, edge.fromNodeId, edge.toNodeId);
    addAdjacentNode(incomingNodeIds, edge.toNodeId, edge.fromNodeId);
    addAdjacentNode(connectedNodeIdsByNodeId, edge.fromNodeId, edge.toNodeId);
    addAdjacentNode(connectedNodeIdsByNodeId, edge.toNodeId, edge.fromNodeId);
  }
  const walk = (direction: "outgoing" | "incoming"): Set<string> => {
    const visited = new Set<string>();
    const pending = [rootNodeId];
    while (pending.length > 0) {
      const currentNodeId = pending.shift();
      if (!currentNodeId) {
        continue;
      }
      const adjacentNodeIds =
        direction === "outgoing"
          ? outgoingNodeIds.get(currentNodeId)
          : incomingNodeIds.get(currentNodeId);
      for (const nextNodeId of adjacentNodeIds ?? []) {
        if (nextNodeId !== rootNodeId && !visited.has(nextNodeId)) {
          visited.add(nextNodeId);
          pending.push(nextNodeId);
        }
      }
    }
    return visited;
  };
  const connectedNodeIds = new Set<string>([rootNodeId]);
  const pendingConnected = [rootNodeId];
  while (pendingConnected.length > 0) {
    const currentNodeId = pendingConnected.shift();
    if (!currentNodeId) {
      continue;
    }
    for (const nextNodeId of connectedNodeIdsByNodeId.get(currentNodeId) ?? []) {
      if (!connectedNodeIds.has(nextNodeId)) {
        connectedNodeIds.add(nextNodeId);
        pendingConnected.push(nextNodeId);
      }
    }
  }
  const directDependencyNodeIds = allEdges
    .filter(edge => edge.fromNodeId === rootNodeId)
    .map(edge => edge.toNodeId);
  const directDependentNodeIds = allEdges
    .filter(edge => edge.toNodeId === rootNodeId)
    .map(edge => edge.fromNodeId);
  const compareNodeIds = (left: string, right: string): number =>
    (nodes.get(left)?.label ?? left).localeCompare(nodes.get(right)?.label ?? right);

  return {
    rootNodeId,
    nodes: [...nodes.values()]
      .filter(node => connectedNodeIds.has(node.nodeId))
      .sort((left, right) =>
        left.nodeId === rootNodeId
          ? -1
          : right.nodeId === rootNodeId
            ? 1
            : left.nodeType.localeCompare(right.nodeType) ||
              left.label.localeCompare(right.label)
      ),
    edges: allEdges
      .filter(
        edge =>
          connectedNodeIds.has(edge.fromNodeId) &&
          connectedNodeIds.has(edge.toNodeId)
      )
      .sort((left, right) =>
        left.relationshipType.localeCompare(right.relationshipType) ||
        left.fromNodeId.localeCompare(right.fromNodeId) ||
        left.toNodeId.localeCompare(right.toNodeId)
      ),
    directDependencyNodeIds: [...new Set(directDependencyNodeIds)].sort(
      compareNodeIds
    ),
    transitiveDependencyNodeIds: [...walk("outgoing")].sort(compareNodeIds),
    directDependentNodeIds: [...new Set(directDependentNodeIds)].sort(
      compareNodeIds
    ),
    transitiveDependentNodeIds: [...walk("incoming")].sort(compareNodeIds)
  };
};

const normalizeReviewText = (
  value: unknown,
  fieldName: string,
  errorCode: string
): string => {
  if (typeof value !== "string" || value.trim() === "") {
    throw new FirstSliceError(
      400,
      errorCode,
      `${fieldName} is required.`
    );
  }

  return value.trim();
};

const parseReviewCategoryText = (value: string): string[] =>
  Array.from(
    new Set(
      value
        .split(/[\s,]+/)
        .map(category => category.trim().toLowerCase())
        .filter(Boolean)
    )
  );

const normalizeReviewCategories = (
  categories: unknown,
  legacyCategory: unknown
): string[] => {
  const values =
    categories === undefined
      ? typeof legacyCategory === "string"
        ? parseReviewCategoryText(legacyCategory)
        : []
      : Array.isArray(categories)
        ? categories
        : null;
  if (!values) {
    throw new FirstSliceError(
      400,
      "review_categories_invalid",
      "categories must be an array when provided."
    );
  }
  if (values.some(value => typeof value !== "string")) {
    throw new FirstSliceError(
      400,
      "review_categories_invalid",
      "Every review category must be a string."
    );
  }
  const normalized = Array.from(
    new Set(
      values.map(value => String(value).trim().toLowerCase())
    )
  ).filter(Boolean);
  if (
    normalized.length > 10 ||
    normalized.some(category => category.length > 64)
  ) {
    throw new FirstSliceError(
      400,
      "review_categories_invalid",
      "At most 10 categories with up to 64 characters each are allowed."
    );
  }
  return normalized;
};

const normalizeReviewPriority = (value: unknown): 0 | 1 | 2 | 3 => {
  const priority = value === undefined ? 0 : value;
  if (
    typeof priority !== "number" ||
    !Number.isInteger(priority) ||
    priority < 0 ||
    priority > 3
  ) {
    throw new FirstSliceError(
      400,
      "review_priority_invalid",
      "priority must be one of 0, 1, 2, or 3."
    );
  }
  return priority as 0 | 1 | 2 | 3;
};

const normalizeWorkspaceReview = (review: WorkspaceReview): WorkspaceReview => {
  const categories = Array.isArray(review.categories)
    ? Array.from(
        new Set(
          review.categories
            .filter(category => typeof category === "string")
            .map(category => category.trim().toLowerCase())
            .filter(Boolean)
        )
      )
    : parseReviewCategoryText(String(review.category ?? ""));
  const priority = Number(review.priority);
  return {
    ...review,
    originalUnitId:
      typeof review.originalUnitId === "string" && review.originalUnitId.trim()
        ? review.originalUnitId.trim()
        : null,
    page:
      review.page !== null &&
      review.page !== undefined &&
      Number.isInteger(Number(review.page)) &&
      Number(review.page) >= 0
        ? Number(review.page)
        : null,
    pageLabel:
      typeof review.pageLabel === "string" && review.pageLabel.trim()
        ? review.pageLabel.trim()
        : null,
    userAgent:
      typeof review.userAgent === "string" && review.userAgent.trim()
        ? review.userAgent.trim()
        : null,
    category: categories.join(" "),
    categories,
    priority:
      Number.isInteger(priority) && priority >= 0 && priority <= 3
        ? (priority as 0 | 1 | 2 | 3)
        : 0
  };
};

const normalizeReviewUserAgent = (value: unknown): string | null =>
  typeof value === "string" && value.trim()
    ? value.trim().slice(0, 1024)
    : null;

const normalizeOptionalUnitKey = (value: unknown): string | null => {
  if (value === undefined || value === null) {
    return null;
  }

  if (typeof value !== "string") {
    throw new FirstSliceError(
      400,
      "review_unit_key_invalid",
      "unitKey must be a string when provided."
    );
  }

  return value.trim() || null;
};

const normalizeOptionalReviewPage = (value: unknown): number | null => {
  if (value === undefined || value === null) {
    return null;
  }
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 0 ||
    value > 100_000
  ) {
    throw new FirstSliceError(
      400,
      "review_page_invalid",
      "page must be a non-negative integer when provided."
    );
  }
  return value;
};

const normalizeOptionalReviewPageLabel = (value: unknown): string | null => {
  if (value === undefined || value === null) {
    return null;
  }
  if (typeof value !== "string" || value.trim().length > 256) {
    throw new FirstSliceError(
      400,
      "review_page_label_invalid",
      "pageLabel must be a string with up to 256 characters when provided."
    );
  }
  return value.trim() || null;
};

const normalizeMonitorProfileText = (
  value: unknown,
  fieldName: string,
  maximumLength: number,
  fallback = ""
): string => {
  if (value === undefined || value === null) {
    return fallback;
  }
  if (typeof value !== "string" || value.length > maximumLength) {
    throw new FirstSliceError(
      400,
      "admin_monitor_profiles_invalid",
      `${fieldName} must be a string with up to ${maximumLength} characters.`
    );
  }
  return value.trim();
};

const normalizeMonitorProfileEnum = <const AllowedValues extends readonly string[]>(
  value: unknown,
  fieldName: string,
  allowedValues: AllowedValues,
  fallback: AllowedValues[number]
): AllowedValues[number] => {
  const normalized = normalizeMonitorProfileText(
    value,
    fieldName,
    Math.max(...allowedValues.map(candidate => candidate.length)),
    fallback
  );
  if (!allowedValues.includes(normalized)) {
    throw new FirstSliceError(
      400,
      "admin_monitor_profiles_invalid",
      `${fieldName} must be one of: ${allowedValues.join(", ")}.`
    );
  }
  return normalized as AllowedValues[number];
};

const originalMonitorProfileSuperStates = [
  "monitor_group",
  "demo",
  "pending",
  "locked",
  "error",
  "controller_terminated",
  "connection_lost",
  "paused",
  "focus_lost",
  "idle",
  "connection_websocket",
  "connection_polling",
  "ok"
] as const;

const normalizeMonitorProfileFilterValue = (
  value: unknown,
  target: string,
  fieldName: string
): string | string[] => {
  if (!Array.isArray(value)) {
    return normalizeMonitorProfileText(value, fieldName, 2_048);
  }
  if (target !== "state" || value.length === 0 || value.length > 13) {
    throw new FirstSliceError(
      400,
      "admin_monitor_profiles_invalid",
      `${fieldName} may only be a non-empty array of up to 13 values for state filters.`
    );
  }
  const normalized = value.map((entry, stateIndex) => {
    if (typeof entry !== "string") {
      throw new FirstSliceError(
        400,
        "admin_monitor_profiles_invalid",
        `${fieldName}[${stateIndex}] must be an original monitor super-state.`
      );
    }
    return normalizeMonitorProfileEnum(
      entry,
      `${fieldName}[${stateIndex}]`,
      originalMonitorProfileSuperStates,
      "ok"
    );
  });
  if (new Set(normalized).size !== normalized.length) {
    throw new FirstSliceError(
      400,
      "admin_monitor_profiles_invalid",
      `${fieldName} must not contain duplicate states.`
    );
  }
  return normalized;
};

const normalizeMonitorViewProfiles = (value: unknown): MonitorViewProfile[] => {
  if (value === undefined || value === null) {
    return [];
  }
  if (!Array.isArray(value) || value.length > 20) {
    throw new FirstSliceError(
      400,
      "admin_monitor_profiles_invalid",
      "Monitor profiles must be an array with at most 20 entries."
    );
  }

  const profileIds = new Set<string>();
  return value.map((candidate, profileIndex) => {
    if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) {
      throw new FirstSliceError(
        400,
        "admin_monitor_profiles_invalid",
        `Monitor profile ${profileIndex + 1} must be an object.`
      );
    }
    const input = candidate as Record<string, unknown>;
    const profileId = normalizeMonitorProfileText(
      input.profileId,
      `monitorProfiles[${profileIndex}].profileId`,
      128
    );
    if (!profileId || profileIds.has(profileId)) {
      throw new FirstSliceError(
        400,
        "admin_monitor_profiles_invalid",
        "Monitor profile IDs must be non-empty and unique."
      );
    }
    profileIds.add(profileId);
    const settingsInput = input.settings;
    if (!settingsInput || typeof settingsInput !== "object" || Array.isArray(settingsInput)) {
      throw new FirstSliceError(
        400,
        "admin_monitor_profiles_invalid",
        `monitorProfiles[${profileIndex}].settings must be an object.`
      );
    }
    const settings = settingsInput as Record<string, unknown>;
    const autoselectNextBlock = normalizeMonitorProfileEnum(
      settings.autoselectNextBlock,
      `monitorProfiles[${profileIndex}].settings.autoselectNextBlock`,
      ["yes", "no"],
      "yes"
    );
    if (!Array.isArray(input.filters) || input.filters.length > 50) {
      throw new FirstSliceError(
        400,
        "admin_monitor_profiles_invalid",
        `monitorProfiles[${profileIndex}].filters must contain at most 50 entries.`
      );
    }
    const filters = input.filters.map((filterCandidate, filterIndex) => {
      if (
        !filterCandidate ||
        typeof filterCandidate !== "object" ||
        Array.isArray(filterCandidate)
      ) {
        throw new FirstSliceError(
          400,
          "admin_monitor_profiles_invalid",
          `Monitor filter ${filterIndex + 1} must be an object.`
        );
      }
      const filter = filterCandidate as Record<string, unknown>;
      if (typeof filter.not !== "boolean") {
        throw new FirstSliceError(
          400,
          "admin_monitor_profiles_invalid",
          `monitorProfiles[${profileIndex}].filters[${filterIndex}].not must be boolean.`
        );
      }
      const target = normalizeMonitorProfileEnum(
        filter.target,
        "filter.target",
        [
          "bookletLabel",
          "personLabel",
          "state",
          "blockLabel",
          "groupName",
          "bookletId",
          "unitId",
          "unitLabel",
          "blockId",
          "testState",
          "mode",
          "bookletSpecies",
          "bookletStates"
        ],
        "personLabel"
      );
      const filterValue = normalizeMonitorProfileFilterValue(
        filter.value,
        target,
        "filter.value"
      );
      const subValue =
        filter.subValue === undefined || filter.subValue === null
          ? null
          : normalizeMonitorProfileText(filter.subValue, "filter.subValue", 2_048);
      const filterType = normalizeMonitorProfileEnum(
        filter.type,
        "filter.type",
        ["equal", "substring", "regex"],
        "equal"
      );
      if (Array.isArray(filterValue) && (subValue !== null || filterType !== "equal")) {
        throw new FirstSliceError(
          400,
          "admin_monitor_profiles_invalid",
          "State-array filters must use equal comparison without a subValue."
        );
      }
      return {
        target,
        value: filterValue,
        subValue,
        label: normalizeMonitorProfileText(filter.label, "filter.label", 256),
        type: filterType,
        not: filter.not
      };
    });
    const filtersEnabledInput = input.filtersEnabled;
    if (
      !filtersEnabledInput ||
      typeof filtersEnabledInput !== "object" ||
      Array.isArray(filtersEnabledInput)
    ) {
      throw new FirstSliceError(
        400,
        "admin_monitor_profiles_invalid",
        `monitorProfiles[${profileIndex}].filtersEnabled must be an object.`
      );
    }
    const filtersEnabled = filtersEnabledInput as Record<string, unknown>;
    return {
      profileId,
      label: normalizeMonitorProfileText(input.label, "monitor profile label", 256),
      settings: {
        blockColumn: normalizeMonitorProfileEnum(
          settings.blockColumn,
          "blockColumn",
          ["show", "hide"],
          "show"
        ),
        unitColumn: normalizeMonitorProfileEnum(
          settings.unitColumn,
          "unitColumn",
          ["show", "hide"],
          "show"
        ),
        view: normalizeMonitorProfileEnum(
          settings.view === "middle"
            ? "medium"
            : settings.view === "large"
              ? "full"
              : settings.view,
          "view",
          ["full", "medium", "small"],
          "medium"
        ),
        groupColumn: normalizeMonitorProfileEnum(
          settings.groupColumn,
          "groupColumn",
          ["show", "hide"],
          "hide"
        ),
        bookletColumn: normalizeMonitorProfileEnum(
          settings.bookletColumn,
          "bookletColumn",
          ["show", "hide"],
          "show"
        ),
        bookletStatesColumns: normalizeMonitorProfileText(
          settings.bookletStatesColumns,
          "bookletStatesColumns",
          1_024
        ),
        autoselectNextBlock
      },
      filters,
      filtersEnabled: {
        pending: normalizeMonitorProfileEnum(
          filtersEnabled.pending,
          "filterPending",
          ["yes", "no"],
          "no"
        ),
        locked: normalizeMonitorProfileEnum(
          filtersEnabled.locked,
          "filterLocked",
          ["yes", "no"],
          "no"
        )
      }
    };
  });
};

const normalizeAdminRoleAssignmentInputs = (
  value: AdminRoleAssignmentInput[] | undefined
): AdminRoleAssignmentInput[] => {
  if (value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw new FirstSliceError(
      400,
      "admin_role_assignments_invalid",
      "Admin role assignments must be an array."
    );
  }

  return value;
};

const requireAdminCredentialsPassword = (value: unknown): string => {
  if (typeof value !== "string" || value === "") {
    throw new FirstSliceError(
      401,
      "admin_credentials_invalid",
      "Admin credentials are invalid."
    );
  }

  return value;
};

const normalizeOptionalAdminAccessTimestamp = (
  value: unknown,
  fieldName: "validFrom" | "validTo"
): string | null => {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (typeof value !== "string" || !Number.isFinite(Date.parse(value))) {
    throw new FirstSliceError(
      400,
      "admin_access_window_invalid",
      `${fieldName} must be a valid ISO timestamp when provided.`
    );
  }
  return new Date(Date.parse(value)).toISOString();
};

const normalizeOptionalAdminValidForMinutes = (value: unknown): number | null => {
  if (value === undefined || value === null || value === "") {
    return null;
  }
  if (
    typeof value !== "number" ||
    !Number.isInteger(value) ||
    value < 1 ||
    value > 5_256_000
  ) {
    throw new FirstSliceError(
      400,
      "admin_access_window_invalid",
      "validForMinutes must be an integer from 1 through 5256000 when provided."
    );
  }
  return value;
};

const normalizeAdminAccessWindow = (input: {
  validFrom?: unknown;
  validTo?: unknown;
  validForMinutes?: unknown;
}): Pick<AdminUser, "validFrom" | "validTo" | "validForMinutes"> => {
  const validFrom = normalizeOptionalAdminAccessTimestamp(
    input.validFrom,
    "validFrom"
  );
  const validTo = normalizeOptionalAdminAccessTimestamp(input.validTo, "validTo");
  if (validFrom && validTo && Date.parse(validFrom) > Date.parse(validTo)) {
    throw new FirstSliceError(
      400,
      "admin_access_window_invalid",
      "validFrom must not be later than validTo."
    );
  }
  return {
    validFrom,
    validTo,
    validForMinutes: normalizeOptionalAdminValidForMinutes(
      input.validForMinutes
    )
  };
};

const resolveAdminAccessValidUntil = (adminUser: AdminUser): string | null => {
  const candidates = [
    adminUser.validTo ? Date.parse(adminUser.validTo) : Number.NaN,
    adminUser.validForMinutes && adminUser.firstSignedInAt
      ? Date.parse(adminUser.firstSignedInAt) +
        adminUser.validForMinutes * 60_000
      : Number.NaN
  ].filter(Number.isFinite);
  return candidates.length > 0
    ? new Date(Math.min(...candidates)).toISOString()
    : null;
};

const resolveAdminAccessFailureReason = (
  adminUser: AdminUser,
  timestamp: string
): "admin_access_not_started" | "admin_access_expired" | null => {
  const timestampMs = Date.parse(timestamp);
  if (
    adminUser.validFrom &&
    Number.isFinite(timestampMs) &&
    Date.parse(adminUser.validFrom) > timestampMs
  ) {
    return "admin_access_not_started";
  }
  const validUntil = resolveAdminAccessValidUntil(adminUser);
  return validUntil && Date.parse(validUntil) <= timestampMs
    ? "admin_access_expired"
    : null;
};

const resolveAdminUserAccessStatus = (
  adminUser: AdminUser,
  timestamp: string
): AdminUserAccessStatus => {
  const failureReason = resolveAdminAccessFailureReason(adminUser, timestamp);
  if (failureReason === "admin_access_not_started") {
    return "scheduled";
  }
  return failureReason === "admin_access_expired" ? "expired" : "available";
};

const hashPassword = (password: string): string => {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, PASSWORD_HASH_KEY_LENGTH);
  return `scrypt$${salt}$${derivedKey.toString("hex")}`;
};

const verifyPassword = (password: string, passwordHash: string): boolean => {
  const [scheme, salt, expectedHash] = passwordHash.split("$");
  if (scheme !== "scrypt" || !salt || !expectedHash) {
    return false;
  }

  const expected = Buffer.from(expectedHash, "hex");
  const actual = scryptSync(password, salt, expected.length);
  if (actual.length !== expected.length) {
    return false;
  }

  return timingSafeEqual(actual, expected);
};

const hashAdminPassword = hashPassword;
const verifyAdminPassword = verifyPassword;

const requireAdminPasswordConfirmation = (
  adminUser: AdminUser,
  value: unknown
): void => {
  if (typeof value !== "string" || value === "") {
    throw new FirstSliceError(
      400,
      "admin_password_confirmation_required",
      "The acting administrator password is required for platform admin role changes."
    );
  }
  if (
    value.length > adminPasswordPolicy.maximumLength ||
    !verifyAdminPassword(value, adminUser.passwordHash)
  ) {
    throw new FirstSliceError(
      403,
      "admin_password_confirmation_invalid",
      "The acting administrator password is invalid."
    );
  }
};

const createAdminSessionToken = (): string => randomBytes(32).toString("base64url");

const calculateAdminSessionExpiry = (
  createdAt: string,
  sessionTtlMs: number,
  accessValidUntil: string | null = null
): string => {
  const sessionExpiryMs = Date.parse(createdAt) + sessionTtlMs;
  const accessExpiryMs = accessValidUntil
    ? Date.parse(accessValidUntil)
    : Number.NaN;
  return new Date(
    Number.isFinite(accessExpiryMs)
      ? Math.min(sessionExpiryMs, accessExpiryMs)
      : sessionExpiryMs
  ).toISOString();
};

const resolveAdminSessionStatus = (
  adminSession: AdminSession,
  nowIso: string
): AdminSessionStatus => {
  if (adminSession.revokedAt !== null) {
    return "revoked";
  }

  return Date.parse(adminSession.expiresAt) <= Date.parse(nowIso)
    ? "expired"
    : "active";
};

const listAdminRoleAssignmentsForUser = async (
  repository: FirstSliceRepository,
  adminUserId: string
): Promise<AdminRoleAssignment[]> =>
  (await repository.listAdminRoleAssignmentsByUserId(adminUserId))
    .map(roleAssignment => ({
      ...roleAssignment,
      accessMode: roleAssignment.accessMode ?? "read_write",
      monitorBookletVisibility:
        roleAssignment.monitorBookletVisibility ?? "visible"
    }))
    .sort((left, right) => left.createdAt.localeCompare(right.createdAt));

const requireActiveAdminSession = async (
  repository: FirstSliceRepository,
  sessionToken: string,
  nowIso: string,
  options: { allowPasswordChangeRequired?: boolean } = {}
): Promise<{
  adminUser: AdminUser;
  adminSession: AdminSession;
  roleAssignments: AdminRoleAssignment[];
}> => {
  if (!sessionToken.trim()) {
    throw new FirstSliceError(
      401,
      "admin_session_missing",
      "Admin bearer session is required."
    );
  }

  const adminSession = await repository.getAdminSessionByToken(sessionToken);
  if (
    !adminSession ||
    adminSession.revokedAt !== null ||
    Date.parse(adminSession.expiresAt) <= Date.parse(nowIso)
  ) {
    throw new FirstSliceError(
      401,
      "admin_session_invalid",
      "Admin session is invalid or expired."
    );
  }

  const adminUser = await repository.getAdminUserById(adminSession.adminUserId);
  if (!adminUser || adminUser.status !== "active") {
    throw new FirstSliceError(
      401,
      "admin_session_invalid",
      "Admin session is invalid or expired."
    );
  }

  const roleAssignments = await listAdminRoleAssignmentsForUser(
    repository,
    adminUser.adminUserId
  );

  if (
    adminUser.passwordChangeRequired &&
    !options.allowPasswordChangeRequired &&
    !roleAssignments.some(
      roleAssignment => roleAssignment.role === "platform_admin"
    ) &&
    roleAssignments.some(
      roleAssignment =>
        roleAssignment.role === "tenant_admin" ||
        roleAssignment.role === "workspace_admin"
    )
  ) {
    throw new FirstSliceError(
      403,
      "admin_password_change_required",
      "The administrator-set password must be changed before continuing.",
      {
        adminUserId: adminUser.adminUserId,
        username: adminUser.username
      }
    );
  }

  return { adminUser, adminSession, roleAssignments };
};

const requireAdminRole = (
  roleAssignments: AdminRoleAssignment[],
  requiredRoles: AdminRole[]
): void => {
  if (!roleAssignments.some(roleAssignment => requiredRoles.includes(roleAssignment.role))) {
    throw new FirstSliceError(
      403,
      "admin_role_required",
      "The admin session does not have the required role.",
      { requiredRoles }
    );
  }
};

const normalizeApplicationTitle = (value: unknown): string => {
  const title = String(value ?? "").trim() || defaultApplicationSettings.appTitle;
  if (title.length > 120) {
    throw new FirstSliceError(
      400,
      "application_title_invalid",
      "Application title must not exceed 120 characters."
    );
  }
  return title;
};

const MAX_APPLICATION_LOGO_BYTES = 20 * 1024 * 1024;
const allowedApplicationLogoMediaTypes = new Set([
  "image/png",
  "image/jpeg",
  "image/gif",
  "image/webp",
  "image/svg+xml"
]);

const normalizeApplicationLogo = (value: unknown): string => {
  const logo = String(value ?? "").trim();
  if (!logo || logo === defaultApplicationSettings.mainLogo) {
    return defaultApplicationSettings.mainLogo;
  }
  const match = /^data:([^;,]+);base64,([a-z\d+/]*={0,2})$/i.exec(logo);
  const mediaType = match?.[1]?.toLowerCase();
  const dataBase64 = match?.[2] ?? "";
  if (!mediaType || !allowedApplicationLogoMediaTypes.has(mediaType) || !dataBase64) {
    throw new FirstSliceError(
      400,
      "application_logo_invalid",
      "Application logo must be the default asset or a base64 PNG, JPEG, GIF, WebP, or SVG data URL."
    );
  }
  const bytes = Buffer.from(dataBase64, "base64");
  if (
    bytes.length === 0 ||
    bytes.toString("base64").replace(/=+$/, "") !==
      dataBase64.replace(/=+$/, "")
  ) {
    throw new FirstSliceError(
      400,
      "application_logo_invalid",
      "Application logo contains invalid base64 image data."
    );
  }
  if (bytes.length > MAX_APPLICATION_LOGO_BYTES) {
    throw new FirstSliceError(
      400,
      "application_logo_too_large",
      "Application logo must not exceed 20 MiB.",
      { maxBytes: MAX_APPLICATION_LOGO_BYTES }
    );
  }
  const isExpectedImage =
    (mediaType === "image/png" &&
      bytes.length >= 8 &&
      bytes.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex"))) ||
    (mediaType === "image/jpeg" &&
      bytes.length >= 3 &&
      bytes[0] === 0xff &&
      bytes[1] === 0xd8 &&
      bytes[2] === 0xff) ||
    (mediaType === "image/gif" &&
      (bytes.subarray(0, 6).toString("ascii") === "GIF87a" ||
        bytes.subarray(0, 6).toString("ascii") === "GIF89a")) ||
    (mediaType === "image/webp" &&
      bytes.subarray(0, 4).toString("ascii") === "RIFF" &&
      bytes.subarray(8, 12).toString("ascii") === "WEBP") ||
    (mediaType === "image/svg+xml" &&
      /^(?:<\?xml[^>]*>\s*)?<svg\b/i.test(bytes.toString("utf8").trim()) &&
      !/<script\b|\son[a-z]+\s*=|javascript:/i.test(bytes.toString("utf8")));
  if (!isExpectedImage) {
    throw new FirstSliceError(
      400,
      "application_logo_invalid",
      "Application logo data does not match its declared safe image type."
    );
  }
  return `data:${mediaType};base64,${bytes.toString("base64")}`;
};

const normalizeApplicationTheme = (
  value: unknown
): ApplicationSettings["themeName"] => {
  if (value === "Primar" || value === "Sekundar" || value === "Erwachsene") {
    return value;
  }
  throw new FirstSliceError(
    400,
    "application_theme_invalid",
    "Application theme must be Primar, Sekundar, or Erwachsene."
  );
};

const MAX_APPLICATION_CONTENT_HTML_BYTES = 100_000;

const normalizeApplicationContentHtml = (
  value: unknown,
  field: "intro" | "legal_notice"
): string => {
  const html = String(value ?? "").trim();
  if (Buffer.byteLength(html, "utf8") > MAX_APPLICATION_CONTENT_HTML_BYTES) {
    throw new FirstSliceError(
      400,
      `application_${field}_html_too_large`,
      `Application ${field === "intro" ? "intro" : "legal notice"} HTML must not exceed ${MAX_APPLICATION_CONTENT_HTML_BYTES} UTF-8 bytes.`,
      { maxBytes: MAX_APPLICATION_CONTENT_HTML_BYTES }
    );
  }
  return html;
};

const MAX_APPLICATION_CUSTOM_TEXT_COUNT = 250;
const MAX_APPLICATION_CUSTOM_TEXT_BYTES = 250_000;
const MAX_APPLICATION_CUSTOM_TEXT_VALUE_BYTES = 10_000;

const normalizeApplicationCustomTexts = (
  value: unknown
): Record<string, string> => {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new FirstSliceError(
      400,
      "application_custom_texts_invalid",
      "Application custom texts must be a key-value object."
    );
  }
  const entries = Object.entries(value);
  if (entries.length > MAX_APPLICATION_CUSTOM_TEXT_COUNT) {
    throw new FirstSliceError(
      400,
      "application_custom_texts_too_large",
      `Application custom texts must not contain more than ${MAX_APPLICATION_CUSTOM_TEXT_COUNT} keys.`
    );
  }
  const customTexts: Record<string, string> = {};
  let totalBytes = 0;
  for (const [rawKey, rawValue] of entries) {
    const key = rawKey.trim();
    if (
      !/^[A-Za-z_][A-Za-z0-9_.-]*$/.test(key) ||
      key.length > 120 ||
      typeof rawValue !== "string"
    ) {
      throw new FirstSliceError(
        400,
        "application_custom_texts_invalid",
        `Application custom text key '${rawKey || "missing"}' or its value is invalid.`
      );
    }
    const text = rawValue.trim();
    if (!text) {
      continue;
    }
    const valueBytes = Buffer.byteLength(text, "utf8");
    totalBytes += Buffer.byteLength(key, "utf8") + valueBytes;
    if (
      valueBytes > MAX_APPLICATION_CUSTOM_TEXT_VALUE_BYTES ||
      totalBytes > MAX_APPLICATION_CUSTOM_TEXT_BYTES
    ) {
      throw new FirstSliceError(
        400,
        "application_custom_texts_too_large",
        "Application custom texts exceed the supported size limit."
      );
    }
    customTexts[key] = text;
  }
  return customTexts;
};

const normalizeGlobalWarningText = (value: unknown): string | null => {
  const text = String(value ?? "").trim();
  if (!text) {
    return null;
  }
  if (text.length > 4_000) {
    throw new FirstSliceError(
      400,
      "application_warning_text_invalid",
      "Global warning text must not exceed 4,000 characters."
    );
  }
  return text;
};

const normalizeGlobalWarningExpiration = (value: unknown): string | null => {
  const expiration = String(value ?? "").trim();
  if (!expiration) {
    return null;
  }
  const timestamp = Date.parse(expiration);
  if (!Number.isFinite(timestamp)) {
    throw new FirstSliceError(
      400,
      "application_warning_expiration_invalid",
      "Global warning expiration must be a valid ISO timestamp."
    );
  }
  return new Date(timestamp).toISOString();
};

const hasAdminManagementRole = (
  roleAssignments: AdminRoleAssignment[]
): boolean =>
  roleAssignments.some(
    roleAssignment =>
      roleAssignment.role === "platform_admin" ||
      roleAssignment.role === "tenant_admin" ||
      (roleAssignment.role === "workspace_admin" &&
        (roleAssignment.accessMode ?? "read_write") === "read_write")
  );

const requireAdminManagementRole = (
  roleAssignments: AdminRoleAssignment[]
): void => {
  if (!hasAdminManagementRole(roleAssignments)) {
    throw new FirstSliceError(
      403,
      "admin_role_required",
      "The admin session does not have an administrative delegation role.",
      {
        requiredRoles: ["platform_admin", "tenant_admin", "workspace_admin"]
      }
    );
  }
};

type AdminDelegationScope = Pick<
  AdminRoleAssignment,
  "role" | "tenantId" | "workspaceId"
>;

const canDelegateAdminRoleScope = (
  actorRoleAssignments: AdminRoleAssignment[],
  targetScope: AdminDelegationScope
): boolean => {
  if (
    actorRoleAssignments.some(
      roleAssignment => roleAssignment.role === "platform_admin"
    )
  ) {
    return true;
  }

  if (
    targetScope.role !== "platform_admin" &&
    targetScope.tenantId !== null &&
    actorRoleAssignments.some(
      roleAssignment =>
        roleAssignment.role === "tenant_admin" &&
        roleAssignment.tenantId === targetScope.tenantId
    )
  ) {
    return true;
  }

  return (
    targetScope.tenantId !== null &&
    targetScope.workspaceId !== null &&
    ["study_monitor", "group_monitor", "system_check"].includes(
      targetScope.role
    ) &&
    actorRoleAssignments.some(
      roleAssignment =>
        roleAssignment.role === "workspace_admin" &&
        (roleAssignment.accessMode ?? "read_write") === "read_write" &&
        roleAssignment.tenantId === targetScope.tenantId &&
        roleAssignment.workspaceId === targetScope.workspaceId
    )
  );
};

const requireAdminDelegationScope = (
  actorRoleAssignments: AdminRoleAssignment[],
  targetScope: AdminDelegationScope
): void => {
  if (!canDelegateAdminRoleScope(actorRoleAssignments, targetScope)) {
    throw new FirstSliceError(
      403,
      "admin_delegation_scope_required",
      "The admin session cannot manage the requested admin scope.",
      {
        role: targetScope.role,
        tenantId: targetScope.tenantId,
        workspaceId: targetScope.workspaceId
      }
    );
  }
};

const canManageAdminUser = (
  actorRoleAssignments: AdminRoleAssignment[],
  targetRoleAssignments: AdminRoleAssignment[]
): boolean =>
  actorRoleAssignments.some(
    roleAssignment => roleAssignment.role === "platform_admin"
  ) ||
  (targetRoleAssignments.length > 0 &&
    targetRoleAssignments.every(roleAssignment =>
      canDelegateAdminRoleScope(actorRoleAssignments, roleAssignment)
    ));

const requireManageableAdminUser = (
  actorRoleAssignments: AdminRoleAssignment[],
  targetRoleAssignments: AdminRoleAssignment[]
): void => {
  if (!canManageAdminUser(actorRoleAssignments, targetRoleAssignments)) {
    throw new FirstSliceError(
      403,
      "admin_delegation_scope_required",
      "The admin session cannot manage the requested admin user."
    );
  }
};

const requireAdminUser = async (
  repository: FirstSliceRepository,
  adminUserId: string
): Promise<AdminUser> => {
  const adminUser = await repository.getAdminUserById(adminUserId);
  if (!adminUser) {
    throw new FirstSliceError(
      404,
      "admin_user_not_found",
      `Admin user '${adminUserId}' was not found.`
    );
  }

  return adminUser;
};

const requireTenant = async (
  repository: FirstSliceRepository,
  tenantKey: string
): Promise<Tenant> => {
  const tenant = await repository.getTenantByKey(tenantKey);

  if (!tenant) {
    throw new FirstSliceError(
      404,
      "tenant_not_found",
      `Tenant '${tenantKey}' was not found.`
    );
  }

  return tenant;
};

const requireWorkspace = async (
  repository: FirstSliceRepository,
  tenantKey: string,
  workspaceKey: string
): Promise<Workspace> => {
  await requireTenant(repository, tenantKey);
  const workspace = await repository.getWorkspaceByScope(tenantKey, workspaceKey);

  if (!workspace) {
    throw new FirstSliceError(
      404,
      "workspace_not_found",
      `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
    );
  }

  return workspace;
};

const resolveUniqueWorkspaceByWorkspaceKey = async (
  repository: FirstSliceRepository,
  workspaceKey: string
): Promise<Workspace | null> => {
  const tenants = await repository.listTenants();
  const workspaces = (
    await Promise.all(
      tenants.map(tenant => repository.listWorkspacesByTenantId(tenant.tenantId))
    )
  )
    .flat()
    .filter(workspace => workspace.workspaceKey === workspaceKey);

  if (workspaces.length > 1) {
    throw new FirstSliceError(
      409,
      "participant_workspace_ambiguous",
      `Workspace key '${workspaceKey}' exists in multiple tenants. Provide tenantKey when signing in as a participant.`,
      {
        workspaceKey,
        matchingWorkspaceCount: workspaces.length
      }
    );
  }

  return workspaces[0] ?? null;
};

const findParticipantRosterEntryByLoginKey = async (
  repository: FirstSliceRepository,
  tenantId: string,
  workspaceId: string,
  loginKey: string
): Promise<ParticipantRosterEntry | null> => {
  const entries = await repository.listParticipantRosterEntriesByWorkspace(
    tenantId,
    workspaceId
  );
  return entries.find(entry => entry.loginKey === loginKey) ?? null;
};

const getParticipantRosterBookletKeys = (
  entry: ParticipantRosterEntry | null | undefined
): string[] => [
  ...new Set(
    (entry?.bookletAssignments?.length
      ? entry.bookletAssignments.map(assignment => assignment.bookletKey)
      : entry?.bookletKeys?.length
      ? entry.bookletKeys
      : entry?.bookletKey
        ? [entry.bookletKey]
        : []
    )
      .map(bookletKey => bookletKey.trim())
      .filter(Boolean)
  )
];

const getParticipantRosterBookletAssignments = (
  entry: ParticipantRosterEntry | null | undefined
): NonNullable<ParticipantRosterEntry["bookletAssignments"]> => {
  const assignments: NonNullable<ParticipantRosterEntry["bookletAssignments"]> =
    entry?.bookletAssignments?.length
    ? entry.bookletAssignments
    : getParticipantRosterBookletKeys(entry).map(bookletKey => {
        const statePreset = entry?.bookletStatePresets?.[bookletKey] ?? {};
        const stateSuffix = Object.entries(statePreset)
          .map(([stateKey, optionKey]) => `${stateKey}:${optionKey}`)
          .join(";");
        return {
          assignmentKey: stateSuffix ? `${bookletKey}#${stateSuffix}` : bookletKey,
          bookletKey,
          statePreset
        };
      });
  return assignments
    .flatMap(assignment => {
      const bookletKey = String(assignment.bookletKey ?? "").trim();
      const assignmentKey = String(assignment.assignmentKey ?? "").trim();
      if (!bookletKey || !assignmentKey) {
        return [];
      }
      return [
        {
          assignmentKey,
          bookletKey,
          statePreset: Object.fromEntries(
            Object.entries(assignment.statePreset ?? {}).flatMap(
              ([stateKey, optionKey]) => {
                const normalizedStateKey = stateKey.trim();
                const normalizedOptionKey = String(optionKey ?? "").trim();
                return normalizedStateKey && normalizedOptionKey
                  ? [[normalizedStateKey, normalizedOptionKey]]
                  : [];
              }
            )
          ),
          ...(() => {
            const accessCodes = [
              ...new Set(
                (assignment.accessCodes ?? [])
                  .map(code => String(code ?? "").trim())
                  .filter(Boolean)
              )
            ];
            return accessCodes.length > 0 ? { accessCodes } : {};
          })()
        }
      ];
    })
    .filter(
      (assignment, index, allAssignments) =>
        allAssignments.findIndex(
          candidate => candidate.assignmentKey === assignment.assignmentKey
        ) === index
    );
};

const participantRosterRequiresCode = (
  entry: ParticipantRosterEntry | null | undefined
): boolean =>
  getParticipantRosterBookletAssignments(entry).some(
    assignment => (assignment.accessCodes?.length ?? 0) > 0
  );

const getParticipantCodeBookletAssignments = (
  entry: ParticipantRosterEntry | null | undefined,
  participantCode: string | null | undefined
): NonNullable<ParticipantRosterEntry["bookletAssignments"]> => {
  const assignments = getParticipantRosterBookletAssignments(entry);
  if (!assignments.some(assignment => (assignment.accessCodes?.length ?? 0) > 0)) {
    return assignments;
  }
  const normalizedCode = String(participantCode ?? "").trim();
  if (!normalizedCode) {
    return [];
  }
  return assignments.filter(
    assignment =>
      !assignment.accessCodes?.length ||
      assignment.accessCodes.includes(normalizedCode)
  );
};

const sanitizeParticipantRosterEntryForSession = (
  entry: ParticipantRosterEntry | null,
  participantCode: string | null | undefined
): ParticipantRosterEntry | null => {
  if (!entry) {
    return null;
  }
  const bookletAssignments = getParticipantCodeBookletAssignments(
    entry,
    participantCode
  ).map(({ accessCodes: _accessCodes, ...assignment }) => assignment);
  const bookletKeys = [
    ...new Set(bookletAssignments.map(assignment => assignment.bookletKey))
  ];
  return {
    ...entry,
    bookletKey: bookletKeys[0] ?? null,
    bookletKeys,
    bookletAssignments,
    bookletStatePresets: Object.fromEntries(
      Object.entries(entry.bookletStatePresets ?? {}).filter(([bookletKey]) =>
        bookletKeys.includes(bookletKey)
      )
    )
  };
};

const buildParticipantRuntimeBooklets = (input: {
  contentRelease: ContentRelease;
  participantRosterEntry: ParticipantRosterEntry | null;
  participantCode?: string | null;
  testRuns: TestRun[];
}): ParticipantRuntimeBooklet[] => {
  const assignedBooklets = getParticipantCodeBookletAssignments(
    input.participantRosterEntry,
    input.participantCode
  );
  const releaseBooklets = new Map(
    input.contentRelease.runtimeSnapshot.bookletEntries.map(booklet => [
      booklet.bookletKey,
      booklet
    ])
  );
  const runtimeAssignments =
    assignedBooklets.length > 0
      ? assignedBooklets
      : input.contentRelease.runtimeSnapshot.bookletEntries.map(booklet => ({
          assignmentKey: booklet.bookletKey,
          bookletKey: booklet.bookletKey,
          statePreset: {}
        }));

  return runtimeAssignments.flatMap(assignment => {
    const booklet = releaseBooklets.get(assignment.bookletKey);
    if (!booklet) {
      return [];
    }
    const bookletRuns = input.testRuns.filter(
      testRun =>
        (testRun.bookletAssignmentKey ?? testRun.bookletKey) ===
        assignment.assignmentKey
    );
    const hasLockedRun = bookletRuns.some(
      testRun => testRun.status !== "completed" && testRun.locked === true
    );
    const hasOpenRun = bookletRuns.some(testRun => testRun.status !== "completed");
    const hasCompletedRun = bookletRuns.some(
      testRun => testRun.status === "completed"
    );
    return [
      {
        bookletKey: assignment.assignmentKey,
        sourceBookletKey: booklet.bookletKey,
        statePreset: assignment.statePreset,
        displayLabel: booklet.displayLabel,
        customTexts: { ...(booklet.customTexts ?? {}) },
        status: hasLockedRun
          ? ("locked" as const)
          : hasOpenRun
          ? ("in_progress" as const)
          : hasCompletedRun
            ? ("completed" as const)
            : ("available" as const)
      }
    ];
  });
};

const resolveParticipantSessionStatusAfterCompletion = async (
  repository: FirstSliceRepository,
  participantSession: ParticipantSession
): Promise<ParticipantSessionStatus> => {
  const [contentRelease, participantRosterEntry, testRuns] = await Promise.all([
    requireContentRelease(repository, participantSession.contentReleaseId),
    findParticipantRosterEntryByLoginKey(
      repository,
      participantSession.tenantId,
      participantSession.workspaceId,
      participantSession.loginKey
    ),
    repository.listTestRunsByParticipantSessionId(
      participantSession.participantSessionId
    )
  ]);
  const hasAvailableBooklet = buildParticipantRuntimeBooklets({
    contentRelease,
    participantRosterEntry,
    participantCode: participantSession.participantCode,
    testRuns: testRuns.map(normalizeTestRun)
  }).some(booklet => booklet.status === "available");
  return hasAvailableBooklet ? "signed_in" : "closed";
};

const buildParticipantRosterReadItems = (
  entries: ParticipantRosterEntry[],
  activeContentRelease: ContentRelease | undefined
): WorkspaceParticipantRosterItem[] => {
  const activeBookletKeys = new Set(
    activeContentRelease?.runtimeSnapshot.bookletEntries.map(
      booklet => booklet.bookletKey
    ) ?? []
  );

  return entries
    .map(entry => {
      const validationWarnings: WorkspaceParticipantRosterItem["validationWarnings"] =
        [];

      const bookletKeys = getParticipantRosterBookletKeys(entry);
      if (bookletKeys.length > 0 && !activeContentRelease) {
        validationWarnings.push({
          code: "active_content_release_missing",
          message:
            "Booklet assignment cannot be validated because the workspace has no active content release."
        });
      } else {
        for (const bookletKey of bookletKeys) {
          if (!activeBookletKeys.has(bookletKey)) {
            validationWarnings.push({
              code: "booklet_not_found_in_active_release",
              message: `Booklet '${bookletKey}' is not part of the active content release.`
            });
            continue;
          }
          const booklet = activeContentRelease?.runtimeSnapshot.bookletEntries.find(
            candidate => candidate.bookletKey === bookletKey
          );
          const assignmentPresets = getParticipantRosterBookletAssignments(entry)
            .filter(assignment => assignment.bookletKey === bookletKey)
            .map(assignment => assignment.statePreset);
          for (const [stateKey, optionKey] of assignmentPresets.flatMap(
            statePreset => Object.entries(statePreset)
          )) {
            const state = booklet?.stateEntries?.find(
              candidate => candidate.stateKey === stateKey
            );
            if (!state) {
              validationWarnings.push({
                code: "booklet_state_not_found_in_active_release",
                message: `State '${stateKey}' preset for booklet '${bookletKey}' is not part of the active content release.`
              });
            } else if (!state.options.some(option => option.optionKey === optionKey)) {
              validationWarnings.push({
                code: "booklet_state_option_not_found_in_active_release",
                message: `Option '${optionKey}' for state '${stateKey}' preset for booklet '${bookletKey}' is not part of the active content release.`
              });
            }
          }
        }
      }

      return {
        ...entry,
        validationWarnings
      };
    })
    .sort((left, right) => left.loginKey.localeCompare(right.loginKey));
};

const resolveAdminRoleScope = async (
  repository: FirstSliceRepository,
  input: AdminRoleAssignmentInput
): Promise<ResolvedAdminRoleScope> => {
  const role = normalizeAdminRole(input.role);
  const accessMode = normalizeAdminRoleAccessMode(input.accessMode, role);
  const tenantKey = normalizeOptionalScopeKey(input.tenantKey, "tenantKey");
  const workspaceKey = normalizeOptionalScopeKey(input.workspaceKey, "workspaceKey");
  const groupKey = normalizeOptionalScopeKey(input.groupKey, "groupKey");
  const monitorProfiles = normalizeMonitorViewProfiles(input.monitorProfiles);
  const monitorBookletVisibility =
    input.monitorBookletVisibility === "collapsed" ||
    input.monitorBookletVisibility === "hidden"
      ? input.monitorBookletVisibility
      : "visible";

  if (
    input.monitorBookletVisibility !== undefined &&
    input.monitorBookletVisibility !== "visible" &&
    input.monitorBookletVisibility !== "collapsed" &&
    input.monitorBookletVisibility !== "hidden"
  ) {
    throw new FirstSliceError(
      400,
      "admin_monitor_booklet_visibility_invalid",
      "Monitor booklet visibility must be 'visible', 'collapsed', or 'hidden'."
    );
  }

  if (
    input.monitorBookletVisibility !== undefined &&
    role !== "group_monitor" &&
    role !== "study_monitor"
  ) {
    throw new FirstSliceError(
      400,
      "admin_monitor_booklet_visibility_invalid",
      "Monitor booklet visibility may only be assigned to group or study monitor roles."
    );
  }

  if (
    monitorProfiles.length > 0 &&
    role !== "group_monitor" &&
    role !== "study_monitor"
  ) {
    throw new FirstSliceError(
      400,
      "admin_monitor_profiles_invalid",
      "Monitor profiles may only be assigned to group or study monitor roles."
    );
  }

  if (role === "platform_admin") {
    if (tenantKey || workspaceKey || groupKey) {
      throw new FirstSliceError(
        400,
        "admin_role_scope_invalid",
        "Platform admin role assignments must not include tenant, workspace, or group scope."
      );
    }

    return {
      role,
      accessMode,
      tenantId: null,
      workspaceId: null,
      groupKey: null,
      monitorProfiles,
      monitorBookletVisibility
    };
  }

  if (!tenantKey) {
    throw new FirstSliceError(
      400,
      "admin_role_scope_invalid",
      "Tenant-scoped admin roles require tenantKey."
    );
  }

  if (role === "tenant_admin") {
    if (workspaceKey || groupKey) {
      throw new FirstSliceError(
        400,
        "admin_role_scope_invalid",
        "Tenant admin role assignments must not include workspaceKey or groupKey."
      );
    }

    const tenant = await requireTenant(repository, tenantKey);
    return {
      role,
      accessMode,
      tenantId: tenant.tenantId,
      workspaceId: null,
      groupKey: null,
      monitorProfiles,
      monitorBookletVisibility
    };
  }

  if (!workspaceKey) {
    throw new FirstSliceError(
      400,
      "admin_role_scope_invalid",
      "Workspace-scoped role assignments require tenantKey and workspaceKey."
    );
  }

  const workspace = await requireWorkspace(repository, tenantKey, workspaceKey);
  if (role === "group_monitor" && !groupKey) {
    throw new FirstSliceError(
      400,
      "admin_role_scope_invalid",
      "Group monitor role assignments require groupKey."
    );
  }
  if (role !== "group_monitor" && groupKey) {
    throw new FirstSliceError(
      400,
      "admin_role_scope_invalid",
      "Only group monitor role assignments may include groupKey."
    );
  }
  return {
    role,
    accessMode,
    tenantId: workspace.tenantId,
    workspaceId: workspace.workspaceId,
    groupKey: role === "group_monitor" ? groupKey : null,
    monitorProfiles,
    monitorBookletVisibility
  };
};

const isSameAdminRoleScope = (
  roleAssignment: AdminRoleAssignment,
  scope: ResolvedAdminRoleScope
): boolean =>
  roleAssignment.role === scope.role &&
  roleAssignment.tenantId === scope.tenantId &&
  roleAssignment.workspaceId === scope.workspaceId &&
  roleAssignment.groupKey === scope.groupKey;

const summarizeAdminRoleAssignment = (
  roleAssignment: AdminRoleAssignment
): Record<string, string | null> => ({
  roleAssignmentId: roleAssignment.roleAssignmentId,
  role: roleAssignment.role,
  accessMode: roleAssignment.accessMode,
  tenantId: roleAssignment.tenantId,
  workspaceId: roleAssignment.workspaceId,
  groupKey: roleAssignment.groupKey,
  monitorProfileIds: roleAssignment.monitorProfiles
    .map(profile => profile.profileId)
    .join(",")
});

const createAdminUserDirectoryItem = async (
  repository: FirstSliceRepository,
  adminUser: AdminUser
): Promise<{ adminUser: AdminUser; roleAssignments: AdminRoleAssignment[] }> => ({
  adminUser,
  roleAssignments: await listAdminRoleAssignmentsForUser(
    repository,
    adminUser.adminUserId
  )
});

const requireSourcePackage = async (
  repository: FirstSliceRepository,
  sourcePackageId: string
): Promise<SourcePackage> => {
  const sourcePackage = await repository.getSourcePackageById(sourcePackageId);

  if (!sourcePackage) {
    throw new FirstSliceError(
      404,
      "source_package_not_found",
      `Source package '${sourcePackageId}' was not found.`
    );
  }

  return sourcePackage;
};

const buildSourcePackageDeletionReadiness = (input: {
  sourcePackage: SourcePackage;
  importJobs: ImportJob[];
  contentReleases: ContentRelease[];
  participantSessions: ParticipantSession[];
  testRuns: TestRun[];
}): WorkspaceSourcePackageDeletionReadiness => {
  const importJobs = input.importJobs
    .filter(
      importJob => importJob.sourcePackageId === input.sourcePackage.sourcePackageId
    )
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const importJobIds = new Set(importJobs.map(importJob => importJob.importJobId));
  const contentReleases = input.contentReleases
    .filter(contentRelease => importJobIds.has(contentRelease.importJobId))
    .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
  const contentReleaseIds = new Set(
    contentReleases.map(contentRelease => contentRelease.contentReleaseId)
  );
  const blockingDependencies: WorkspaceSourcePackageDeletionReadiness["blockingDependencies"] = [
    ...importJobs
      .filter(importJob => importJob.status === "queued" || importJob.status === "running")
      .map(importJob => ({
        dependencyType: "active_import_job" as const,
        dependencyId: importJob.importJobId,
        status: importJob.status
      })),
    ...contentReleases
      .filter(contentRelease => contentRelease.status === "active")
      .map(contentRelease => ({
        dependencyType: "active_content_release" as const,
        dependencyId: contentRelease.contentReleaseId,
        status: contentRelease.status
      })),
    ...input.participantSessions
      .filter(participantSession =>
        contentReleaseIds.has(participantSession.contentReleaseId)
      )
      .map(participantSession => ({
        dependencyType: "participant_session" as const,
        dependencyId: participantSession.participantSessionId,
        status: participantSession.status
      })),
    ...input.testRuns
      .filter(testRun => contentReleaseIds.has(testRun.contentReleaseId))
      .map(testRun => ({
        dependencyType: "test_run" as const,
        dependencyId: testRun.testRunId,
        status: testRun.status
      }))
  ].sort((left, right) =>
    `${left.dependencyType}:${left.dependencyId}`.localeCompare(
      `${right.dependencyType}:${right.dependencyId}`
    )
  );

  return {
    sourcePackage: {
      ...input.sourcePackage,
      sourceDocument: null
    },
    canDelete: blockingDependencies.length === 0,
    importJobs,
    contentReleases,
    blockingDependencies
  };
};

const requireContentRelease = async (
  repository: FirstSliceRepository,
  contentReleaseId: string
): Promise<ContentRelease> => {
  const contentRelease = await repository.getContentReleaseById(contentReleaseId);

  if (!contentRelease) {
    throw new FirstSliceError(
      404,
      "content_release_not_found",
      `Content release '${contentReleaseId}' was not found.`
    );
  }

  return contentRelease;
};

const requireParticipantSession = async (
  repository: FirstSliceRepository,
  participantSessionId: string
): Promise<ParticipantSession> => {
  const participantSession = await repository.getParticipantSessionById(
    participantSessionId
  );

  if (!participantSession) {
    throw new FirstSliceError(
      404,
      "participant_session_not_found",
      `Participant session '${participantSessionId}' was not found.`
    );
  }

  return participantSession;
};

const resolveParticipantSessionScope = async (
  repository: FirstSliceRepository,
  participantSession: ParticipantSession
): Promise<ParticipantSessionScope> => {
  const tenant = (await repository.listTenants()).find(
    item => item.tenantId === participantSession.tenantId
  );
  const workspace = (
    await repository.listWorkspacesByTenantId(participantSession.tenantId)
  ).find(item => item.workspaceId === participantSession.workspaceId);

  if (!tenant || !workspace) {
    throw new FirstSliceError(
      500,
      "participant_session_scope_not_found",
      `Scope for participant session '${participantSession.participantSessionId}' could not be resolved.`
    );
  }

  return {
    tenantKey: tenant.tenantKey,
    workspaceKey: workspace.workspaceKey
  };
};

const getActiveWorkspaceRelease = async (
  repository: FirstSliceRepository,
  tenantId: string,
  workspaceId: string
): Promise<ContentRelease | undefined> =>
  (
    await repository.listContentReleasesByWorkspace(tenantId, workspaceId)
  ).find(release => release.status === "active");

const listOpenMonitorRunsForActiveRelease = async (input: {
  repository: FirstSliceRepository;
  tenantId: string;
  workspaceId: string;
  activeContentRelease: ContentRelease;
  timestamp: string;
}): Promise<OpenMonitorRun[]> => {
  const [
    participantSessions,
    participantRosterEntries,
    participantTestLogs
  ] = await Promise.all([
    input.repository.listParticipantSessionsByWorkspace(
      input.tenantId,
      input.workspaceId
    ),
    input.repository.listParticipantRosterEntriesByWorkspace(
      input.tenantId,
      input.workspaceId
    ),
    input.repository.listLatestParticipantTestStateLogsByWorkspace(
      input.tenantId,
      input.workspaceId,
      [...originalMonitorTestStateKeys]
    )
  ]);
  const latestTestStates = buildLatestMonitorTestStates(participantTestLogs);
  const activeSessionIds = new Set(
    participantSessions
      .filter(
        participantSession =>
          participantSession.contentReleaseId ===
          input.activeContentRelease.contentReleaseId
      )
      .map(participantSession => participantSession.participantSessionId)
  );
  const openRuns = (
    await input.repository.listTestRunsByWorkspace(input.tenantId, input.workspaceId)
  ).filter(
    testRun =>
      activeSessionIds.has(testRun.participantSessionId) &&
      testRun.status !== "completed"
  );

  return openRuns
    .filter(
      testRun =>
        resolveParticipantExecutionMode(testRun.executionMode).monitorable
    )
    .map(testRun => {
      const normalizedTestRun = normalizeTestRun(testRun);
      const bookletError = resolveOpenMonitorBookletError(
        input.activeContentRelease,
        normalizedTestRun
      );
      const testletTimers = bookletError
        ? []
        : buildMonitorTestletTimers(
            input.activeContentRelease,
            normalizedTestRun,
            input.timestamp
          );
      const location = resolveOpenMonitorRunLocation(
        input.activeContentRelease,
        normalizedTestRun,
        testletTimers
      );
      const participantSession =
        participantSessions.find(
          currentParticipantSession =>
            currentParticipantSession.participantSessionId ===
            testRun.participantSessionId
        ) ?? null;

      return {
        testRunId: testRun.testRunId,
        participantSessionId: testRun.participantSessionId,
        loginKey: participantSession?.loginKey ?? "unknown",
        groupKey: participantSession?.groupKey ?? "unknown",
        executionMode: normalizeParticipantExecutionMode(
          normalizedTestRun.executionMode
        ),
        participantRosterEntry: participantSession
          ? participantRosterEntries.find(
              entry => entry.loginKey === participantSession.loginKey
            ) ?? null
          : null,
        bookletKey: testRun.bookletKey,
        bookletLabel: location.bookletLabel,
        bookletSpecies: location.bookletSpecies,
        bookletError: location.bookletError,
        bookletAssignmentKey:
          testRun.bookletAssignmentKey ?? testRun.bookletKey,
        bookletStates: normalizedTestRun.bookletStates ?? {},
        testState: buildOpenMonitorRunTestState(
          normalizedTestRun,
          latestTestStates
        ),
        status: normalizedTestRun.status,
        locked: normalizedTestRun.locked === true,
        currentUnitKey: normalizedTestRun.currentUnitKey,
        currentUnitLabel: location.currentUnitLabel,
        currentBlockKey: location.currentBlockKey,
        currentBlockLabel: location.currentBlockLabel,
        blockNavigationTargets: location.blockNavigationTargets,
        activeTestletTimer:
          testletTimers.find(
            timer =>
              timer.current &&
              (timer.status === "running" || timer.status === "paused")
          ) ?? null,
        updatedAt: resolveOpenMonitorRunUpdatedAt(
          normalizedTestRun,
          latestTestStates
        )
      };
    });
};

const originalMonitorTestStateKeys = [
  "CURRENT_UNIT_ID",
  "TESTLETS_TIMELEFT",
  "TESTLETS_CLEARED_CODE",
  "TESTLETS_LOCKED_AFTER_LEAVE",
  "BOOKLET_STATES",
  "UNITS_LOCKED_AFTER_LEAVE",
  "FOCUS",
  "CONTROLLER",
  "CONNECTION"
] as const;
const originalMonitorTestStateKeySet = new Set<string>(
  originalMonitorTestStateKeys
);

const isLaterParticipantTestLog = (
  candidate: ParticipantTestLog,
  current: ParticipantTestLog
): boolean =>
  candidate.timestamp > current.timestamp ||
  (candidate.timestamp === current.timestamp &&
    (candidate.recordedAt > current.recordedAt ||
      (candidate.recordedAt === current.recordedAt &&
        candidate.participantTestLogId > current.participantTestLogId)));

type LatestMonitorTestState = {
  values: Record<string, string>;
  latestRecordedAt: string | null;
};

const buildLatestMonitorTestStates = (
  testLogs: ParticipantTestLog[]
): Map<string, LatestMonitorTestState> => {
  const latestLogs = new Map<string, Map<string, ParticipantTestLog>>();
  for (const testLog of testLogs) {
    if (
      testLog.unitKey !== null ||
      !originalMonitorTestStateKeySet.has(testLog.logKey)
    ) {
      continue;
    }
    const runLogs = latestLogs.get(testLog.testRunId) ?? new Map();
    const current = runLogs.get(testLog.logKey);
    if (!current || isLaterParticipantTestLog(testLog, current)) {
      runLogs.set(testLog.logKey, testLog);
    }
    latestLogs.set(testLog.testRunId, runLogs);
  }

  return new Map(
    [...latestLogs].map(([testRunId, logs]) => [
      testRunId,
      {
        values: Object.fromEntries(
          [...logs].map(([logKey, testLog]) => [logKey, testLog.logContent])
        ),
        latestRecordedAt:
          [...logs.values()]
            .map(testLog => testLog.recordedAt)
            .sort()
            .at(-1) ?? null
      }
    ])
  );
};

const buildOpenMonitorRunTestState = (
  testRun: TestRun,
  latestTestStates: Map<string, LatestMonitorTestState>
): Record<string, string> => ({
  ...(latestTestStates.get(testRun.testRunId)?.values ?? {}),
  ...(testRun.locked
    ? { status: "locked" }
    : testRun.status === "created"
      ? { status: "pending" }
      : {})
});

const resolveOpenMonitorRunUpdatedAt = (
  testRun: TestRun,
  latestTestStates: Map<string, LatestMonitorTestState>
): string => {
  const latestRecordedAt = latestTestStates.get(
    testRun.testRunId
  )?.latestRecordedAt;
  return latestRecordedAt && latestRecordedAt > testRun.updatedAt
    ? latestRecordedAt
    : testRun.updatedAt;
};

type OpenMonitorBookletResolution = {
  booklet: ContentReleaseBookletEntry | undefined;
  error: MonitorBookletError | null;
};

const isOpenMonitorRecord = (
  value: unknown
): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const isOpenMonitorOptionalRecordArray = (value: unknown): boolean =>
  value === undefined ||
  (Array.isArray(value) && value.every(entry => isOpenMonitorRecord(entry)));

const isStructurallyReadableMonitorBooklet = (
  value: Record<string, unknown>
): boolean =>
  typeof value.bookletKey === "string" &&
  value.bookletKey.trim().length > 0 &&
  typeof value.displayLabel === "string" &&
  Array.isArray(value.unitEntries) &&
  value.unitEntries.every(
    unit =>
      isOpenMonitorRecord(unit) &&
      typeof unit.unitKey === "string" &&
      typeof unit.displayLabel === "string" &&
      (unit.testletPath === undefined ||
        (Array.isArray(unit.testletPath) &&
          unit.testletPath.every(testletKey => typeof testletKey === "string")))
  ) &&
  isOpenMonitorOptionalRecordArray(value.testletEntries) &&
  (value.testletEntries === undefined ||
    (value.testletEntries as Array<Record<string, unknown>>).every(
      testlet =>
        typeof testlet.testletKey === "string" &&
        typeof testlet.displayLabel === "string"
    )) &&
  isOpenMonitorOptionalRecordArray(value.stateEntries) &&
  (value.stateEntries === undefined ||
    (value.stateEntries as Array<Record<string, unknown>>).every(
      state =>
        typeof state.stateKey === "string" &&
        typeof state.displayLabel === "string" &&
        Array.isArray(state.options) &&
        state.options.length > 0 &&
        state.options.every(
          option =>
            isOpenMonitorRecord(option) &&
            typeof option.optionKey === "string" &&
            typeof option.displayLabel === "string" &&
            Array.isArray(option.conditions)
        )
    ));

const resolveOpenMonitorBooklet = (
  contentRelease: ContentRelease | null,
  testRun: TestRun
): OpenMonitorBookletResolution => {
  const bookletKey = String(testRun.bookletKey ?? "").trim();
  if (!bookletKey) {
    return { booklet: undefined, error: "missing-id" };
  }
  if (!contentRelease) {
    return { booklet: undefined, error: "general" };
  }
  const runtimeSnapshot = (contentRelease as { runtimeSnapshot?: unknown })
    .runtimeSnapshot;
  if (!isOpenMonitorRecord(runtimeSnapshot)) {
    return { booklet: undefined, error: "general" };
  }
  const bookletEntries = runtimeSnapshot.bookletEntries;
  if (!Array.isArray(bookletEntries)) {
    return { booklet: undefined, error: "general" };
  }
  const rawBooklet = bookletEntries.find(
    entry =>
      isOpenMonitorRecord(entry) && entry.bookletKey === bookletKey
  );
  if (!rawBooklet) {
    return { booklet: undefined, error: "missing-file" };
  }
  if (
    !isOpenMonitorRecord(rawBooklet) ||
    !isStructurallyReadableMonitorBooklet(rawBooklet)
  ) {
    return { booklet: undefined, error: "xml" };
  }
  return {
    booklet: rawBooklet as ContentReleaseBookletEntry,
    error: null
  };
};

/** Classifies the original group-monitor booklet load failures without hiding the run. */
export const resolveOpenMonitorBookletError = (
  contentRelease: ContentRelease | null,
  testRun: TestRun
): MonitorBookletError | null =>
  resolveOpenMonitorBooklet(contentRelease, testRun).error;

const resolveOpenMonitorRunLocation = (
  contentRelease: ContentRelease | null,
  testRun: TestRun,
  testletTimers: readonly MonitorTestletTimer[]
): Pick<
  OpenMonitorRun,
  | "bookletLabel"
  | "bookletSpecies"
  | "bookletError"
  | "currentUnitLabel"
  | "currentBlockKey"
  | "currentBlockLabel"
  | "blockNavigationTargets"
> => {
  const bookletResolution = resolveOpenMonitorBooklet(contentRelease, testRun);
  const booklet = bookletResolution.booklet;
  if (bookletResolution.error) {
    return {
      bookletLabel: testRun.bookletKey || undefined,
      bookletSpecies: null,
      bookletError: bookletResolution.error,
      currentUnitLabel: testRun.currentUnitKey,
      currentBlockKey: null,
      currentBlockLabel: null,
      blockNavigationTargets: []
    };
  }
  try {
    const unit = booklet?.unitEntries.find(
      entry => entry.unitKey === testRun.currentUnitKey
    );
    const currentBlockKey = unit?.testletPath?.at(-1) ?? null;
    const currentBlock = currentBlockKey
      ? booklet?.testletEntries?.find(
          entry => entry.testletKey === currentBlockKey
        )
      : null;
    const visibleUnits = resolveVisibleBookletUnits(booklet, testRun);
    const testletsByKey = new Map(
      (booklet?.testletEntries ?? []).map(testlet => [
        testlet.testletKey,
        testlet
      ])
    );
    const blockNavigationTargets: NonNullable<
      OpenMonitorRun["blockNavigationTargets"]
    > = [];
    const navigationTargetsByBlock = new Map(
      blockNavigationTargets.map(target => [target.blockKey, target])
    );
    for (const visibleUnit of visibleUnits) {
      const blockKey = visibleUnit.testletPath?.[0];
      if (!blockKey) {
        continue;
      }
      const existingTarget = navigationTargetsByBlock.get(blockKey);
      if (existingTarget) {
        existingTarget.unitKeys.push(visibleUnit.unitKey);
        continue;
      }
      const timedTestlet = resolveTimedTestletForUnit(
        booklet,
        visibleUnit.unitKey
      );
      const target = {
        blockKey,
        blockLabel: testletsByKey.get(blockKey)?.displayLabel ?? blockKey,
        targetUnitKey: visibleUnit.unitKey,
        unitKeys: [visibleUnit.unitKey],
        timeMaxMinutes: timedTestlet?.restrictions?.timeMax?.minutes ?? null,
        timer: timedTestlet
          ? testletTimers.find(
              candidate => candidate.testletKey === timedTestlet.testletKey
            ) ?? null
          : null
      };
      blockNavigationTargets.push(target);
      navigationTargetsByBlock.set(blockKey, target);
    }
    return {
      bookletLabel: booklet?.displayLabel ?? testRun.bookletKey,
      bookletSpecies: booklet
        ? `species: ${(booklet.testletEntries ?? []).filter(
            entry => !entry.parentTestletKey
          ).length}`
        : null,
      bookletError: null,
      currentUnitLabel: unit?.displayLabel ?? testRun.currentUnitKey,
      currentBlockKey,
      currentBlockLabel: currentBlock?.displayLabel ?? currentBlockKey,
      blockNavigationTargets
    };
  } catch {
    return {
      bookletLabel: testRun.bookletKey || undefined,
      bookletSpecies: null,
      bookletError: "xml",
      currentUnitLabel: testRun.currentUnitKey,
      currentBlockKey: null,
      currentBlockLabel: null,
      blockNavigationTargets: []
    };
  }
};

const getLatestParticipantSessionRun = async (
  repository: FirstSliceRepository,
  participantSessionId: string
): Promise<TestRun | null> => {
  const testRuns = await repository.listTestRunsByParticipantSessionId(
    participantSessionId
  );

  if (testRuns.length === 0) {
    return null;
  }

  return normalizeTestRun(
    testRuns.sort((left, right) => right.updatedAt.localeCompare(left.updatedAt))[0]!
  );
};

const normalizeTestRun = (testRun: TestRun): TestRun => {
  const testletTimers = Object.fromEntries(
    Object.entries(testRun.testletTimers ?? {}).flatMap(([testletKey, timer]) => {
      const normalizedTestletKey = String(timer?.testletKey ?? testletKey).trim();
      const status =
        timer?.status === "running" ||
        timer?.status === "paused" ||
        timer?.status === "expired" ||
        timer?.status === "cancelled"
          ? timer.status
          : null;
      const durationSeconds = Number(timer?.durationSeconds);
      const remainingSeconds = Number(timer?.remainingSeconds);
      if (
        !normalizedTestletKey ||
        !status ||
        !Number.isFinite(durationSeconds) ||
        durationSeconds <= 0
      ) {
        return [];
      }
      return [
        [
          normalizedTestletKey,
          {
            testletKey: normalizedTestletKey,
            status,
            durationSeconds: Math.max(1, Math.ceil(durationSeconds)),
            remainingSeconds: Number.isFinite(remainingSeconds)
              ? Math.max(0, Math.ceil(remainingSeconds))
              : Math.max(1, Math.ceil(durationSeconds)),
            startedAt: timer.startedAt || testRun.createdAt,
            expiresAt: timer.expiresAt ?? null,
            updatedAt: timer.updatedAt || testRun.updatedAt,
            endedAt: timer.endedAt ?? null
          }
        ]
      ];
    })
  ) as NonNullable<TestRun["testletTimers"]>;

  return {
    ...testRun,
    locked: testRun.locked === true,
    executionMode: normalizeParticipantExecutionMode(testRun.executionMode),
    bookletAssignmentKey:
      String(testRun.bookletAssignmentKey ?? "").trim() || testRun.bookletKey,
    presetBookletStates: Object.fromEntries(
      Object.entries(testRun.presetBookletStates ?? {}).flatMap(
        ([stateKey, optionKey]) => {
          const normalizedStateKey = stateKey.trim();
          const normalizedOptionKey = String(optionKey ?? "").trim();
          return normalizedStateKey && normalizedOptionKey
            ? [[normalizedStateKey, normalizedOptionKey]]
            : [];
        }
      )
    ),
    bookletStates: Object.fromEntries(
      Object.entries(testRun.bookletStates ?? {}).flatMap(
        ([stateKey, optionKey]) => {
          const normalizedStateKey = stateKey.trim();
          const normalizedOptionKey = String(optionKey ?? "").trim();
          return normalizedStateKey && normalizedOptionKey
            ? [[normalizedStateKey, normalizedOptionKey]]
            : [];
        }
      )
    ),
    bookletStateOverrides: Object.fromEntries(
      Object.entries(testRun.bookletStateOverrides ?? {}).flatMap(
        ([stateKey, optionKey]) => {
          const normalizedStateKey = stateKey.trim();
          const normalizedOptionKey = String(optionKey ?? "").trim();
          return normalizedStateKey && normalizedOptionKey
            ? [[normalizedStateKey, normalizedOptionKey]]
            : [];
        }
      )
    ),
    unitResponses: testRun.unitResponses ?? {},
    unlockedTestletKeys: Array.isArray(testRun.unlockedTestletKeys)
      ? [...new Set(testRun.unlockedTestletKeys.filter(Boolean))]
      : [],
    monitorNavigationUnlocked: testRun.monitorNavigationUnlocked === true,
    testletTimers,
    lockedTestletKeys: Array.isArray(testRun.lockedTestletKeys)
      ? [...new Set(testRun.lockedTestletKeys.filter(Boolean))]
      : [],
    lockedUnitKeys: Array.isArray(testRun.lockedUnitKeys)
      ? [...new Set(testRun.lockedUnitKeys.filter(Boolean))]
      : []
  };
};

const requireParticipantTestRunUnlocked = (testRun: TestRun): void => {
  if (testRun.locked === true) {
    throw new FirstSliceError(
      423,
      "test_run_locked",
      `Test run '${testRun.testRunId}' is locked and must be unlocked by a monitor.`,
      { testRunId: testRun.testRunId }
    );
  }
};

const normalizeParticipantExecutionMode = (
  value: unknown
): ParticipantExecutionMode =>
  typeof value === "string" &&
  participantExecutionModes.includes(value as ParticipantExecutionMode)
    ? (value as ParticipantExecutionMode)
    : defaultParticipantExecutionMode;

const resolveParticipantExecutionMode = (
  value: unknown
): ParticipantExecutionModeDefinition =>
  participantExecutionModeDefinitions[normalizeParticipantExecutionMode(value)];

const applyParticipantExecutionModeToBookletPolicy = (
  policy: BookletRuntimePolicy,
  executionMode: ParticipantExecutionModeDefinition
): BookletRuntimePolicy => ({
  ...policy,
  navigation: {
    ...policy.navigation,
    unitMenuEnabled:
      policy.navigation.unitMenuEnabled || executionMode.showUnitMenu
  },
  timing: {
    ...policy.timing,
    showTimeLeft: policy.timing.showTimeLeft || executionMode.showTimeLeft
  }
});

const escapeCsvCell = (value: string | null | undefined): string => {
  const normalizedValue = value ?? "";
  return `"${normalizedValue.replace(/"/g, "\"\"")}"`;
};

type DetailedResponseFilters = {
  loginKey?: string;
  groupKey?: string;
  groupKeys?: string[];
  bookletKey?: string;
  participantSessionId?: string;
  testRunId?: string;
  unitKey?: string;
  status?: TestRun["status"];
  limit?: number;
  limitMaximum?: number;
};

type WorkspaceReviewFilters = {
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
  limitMaximum?: number;
};

type OpenMonitorRunFilters = {
  loginKey?: string;
  groupKey?: string;
  groupKeys?: string[];
  bookletKey?: string;
  bookletSpecies?: string;
  participantSessionId?: string;
  testRunId?: string;
  unitKey?: string;
  status?: TestRun["status"];
  limit?: number;
};

const normalizeExactFilter = (value: string | undefined): string | undefined => {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : undefined;
};

const resolveOperatorReadLimit = (
  limit: number | undefined,
  maximum = 500
): number => Math.max(1, Math.min(limit ?? maximum, maximum));

const filterOpenMonitorRuns = (
  items: OpenMonitorRun[],
  input: OpenMonitorRunFilters
): OpenMonitorRun[] => {
  const filters = {
    loginKey: normalizeExactFilter(input.loginKey),
    groupKey: normalizeExactFilter(input.groupKey),
    groupKeys: input.groupKeys
      ?.map(groupKey => normalizeExactFilter(groupKey))
      .filter((groupKey): groupKey is string => Boolean(groupKey)),
    bookletKey: normalizeExactFilter(input.bookletKey),
    bookletSpecies: normalizeExactFilter(input.bookletSpecies),
    participantSessionId: normalizeExactFilter(input.participantSessionId),
    testRunId: normalizeExactFilter(input.testRunId),
    unitKey: normalizeExactFilter(input.unitKey),
    status: input.status
  };

  return items
    .filter(
      item =>
        (!filters.loginKey || item.loginKey === filters.loginKey) &&
        (!filters.groupKey || item.groupKey === filters.groupKey) &&
        (!filters.groupKeys?.length || filters.groupKeys.includes(item.groupKey)) &&
        (!filters.bookletKey ||
          item.bookletKey === filters.bookletKey ||
          item.bookletAssignmentKey === filters.bookletKey ||
          item.participantRosterEntry?.bookletKey === filters.bookletKey) &&
        (!filters.bookletSpecies ||
          item.bookletSpecies === filters.bookletSpecies) &&
        (!filters.participantSessionId ||
          item.participantSessionId === filters.participantSessionId) &&
        (!filters.testRunId || item.testRunId === filters.testRunId) &&
        (!filters.unitKey || item.currentUnitKey === filters.unitKey) &&
        (!filters.status || item.status === filters.status)
    )
    .slice(0, resolveOperatorReadLimit(input.limit));
};

const listDetailedResponsesForWorkspace = (input: {
  tenantKey: string;
  workspaceKey: string;
  participantSessions: ParticipantSession[];
  participantRosterEntries?: ParticipantRosterEntry[];
  testRuns: TestRun[];
} & DetailedResponseFilters): WorkspaceDetailedResponse[] => {
  const participantSessionsById = new Map(
    input.participantSessions.map(participantSession => [
      participantSession.participantSessionId,
      participantSession
    ])
  );
  const participantRosterEntriesByLoginKey = new Map(
    (input.participantRosterEntries ?? []).map(entry => [entry.loginKey, entry])
  );
  const filters = {
    loginKey: normalizeExactFilter(input.loginKey),
    groupKey: normalizeExactFilter(input.groupKey),
    groupKeys: input.groupKeys
      ?.map(groupKey => normalizeExactFilter(groupKey))
      .filter((groupKey): groupKey is string => Boolean(groupKey)),
    bookletKey: normalizeExactFilter(input.bookletKey),
    participantSessionId: normalizeExactFilter(input.participantSessionId),
    testRunId: normalizeExactFilter(input.testRunId),
    unitKey: normalizeExactFilter(input.unitKey),
    status: input.status
  };

  return input.testRuns
    .flatMap(testRun => {
      const normalizedTestRun = normalizeTestRun(testRun);
      const participantSession =
        participantSessionsById.get(normalizedTestRun.participantSessionId) ?? null;

      return Object.entries(normalizedTestRun.unitResponses).map(
        ([unitKey, response]) => ({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          loginKey: participantSession?.loginKey ?? "",
          groupKey: participantSession?.groupKey ?? "",
          participantRosterEntry: participantSession
            ? participantRosterEntriesByLoginKey.get(participantSession.loginKey) ??
              null
            : null,
          participantSessionId: normalizedTestRun.participantSessionId,
          testRunId: normalizedTestRun.testRunId,
          bookletKey: normalizedTestRun.bookletKey,
          unitKey,
          response,
          responseLength: response.length,
          status: normalizedTestRun.status,
          updatedAt: normalizedTestRun.updatedAt,
          completedAt: normalizedTestRun.completedAt
        })
      );
    })
    .filter(
      row =>
        (!filters.loginKey || row.loginKey === filters.loginKey) &&
        (!filters.groupKey || row.groupKey === filters.groupKey) &&
        (!filters.groupKeys?.length || filters.groupKeys.includes(row.groupKey)) &&
        (!filters.bookletKey ||
          row.bookletKey === filters.bookletKey ||
          row.participantRosterEntry?.bookletKey === filters.bookletKey) &&
        (!filters.participantSessionId ||
          row.participantSessionId === filters.participantSessionId) &&
        (!filters.testRunId || row.testRunId === filters.testRunId) &&
        (!filters.unitKey || row.unitKey === filters.unitKey) &&
        (!filters.status || row.status === filters.status)
    )
    .sort(
      (left, right) =>
        left.loginKey.localeCompare(right.loginKey) ||
        left.participantSessionId.localeCompare(right.participantSessionId) ||
        left.testRunId.localeCompare(right.testRunId) ||
        left.unitKey.localeCompare(right.unitKey)
    )
    .slice(0, resolveOperatorReadLimit(input.limit, input.limitMaximum));
};

const listGroupResultsForWorkspace = (input: {
  tenantKey: string;
  workspaceKey: string;
  participantSessions: ParticipantSession[];
  testRuns: TestRun[];
  reviews: WorkspaceReview[];
  testLogs: ParticipantTestLog[];
}): WorkspaceGroupResultSummary[] => {
  const participantSessionsById = new Map(
    input.participantSessions.map(participantSession => [
      participantSession.participantSessionId,
      participantSession
    ])
  );
  const reviewsByTestRunId = new Map<string, number>();
  for (const review of input.reviews) {
    reviewsByTestRunId.set(
      review.testRunId,
      (reviewsByTestRunId.get(review.testRunId) ?? 0) + 1
    );
  }
  const testLogsByTestRunId = new Map<string, number>();
  for (const testLog of input.testLogs) {
    testLogsByTestRunId.set(
      testLog.testRunId,
      (testLogsByTestRunId.get(testLog.testRunId) ?? 0) + 1
    );
  }

  const groupRuns = new Map<
    string,
    Array<{
      testRun: TestRun;
      responseCount: number;
      reviewCount: number;
      testLogCount: number;
    }>
  >();
  for (const rawTestRun of input.testRuns) {
    const testRun = normalizeTestRun(rawTestRun);
    const participantSession = participantSessionsById.get(
      testRun.participantSessionId
    );
    if (!participantSession?.groupKey) {
      continue;
    }
    const rows = groupRuns.get(participantSession.groupKey) ?? [];
    rows.push({
      testRun,
      responseCount: Object.keys(testRun.unitResponses).length,
      reviewCount: reviewsByTestRunId.get(testRun.testRunId) ?? 0,
      testLogCount: testLogsByTestRunId.get(testRun.testRunId) ?? 0
    });
    groupRuns.set(participantSession.groupKey, rows);
  }

  return [...groupRuns.entries()]
    .map(([groupKey, rows]) => {
      const responseCounts = rows.map(row => row.responseCount);
      const responseCount = responseCounts.reduce((total, count) => total + count, 0);
      const lastChangeAt = rows.reduce(
        (latest, row) =>
          row.testRun.updatedAt.localeCompare(latest) > 0
            ? row.testRun.updatedAt
            : latest,
        rows[0]?.testRun.updatedAt ?? ""
      );

      return {
        tenantKey: input.tenantKey,
        workspaceKey: input.workspaceKey,
        groupKey,
        // The rewrite roster currently stores a stable group key but no separate
        // group label, so use the key as the lossless operator-facing fallback.
        groupLabel: groupKey,
        bookletsStarted: rows.length,
        numUnitsMin: Math.min(...responseCounts),
        numUnitsMax: Math.max(...responseCounts),
        numUnitsTotal: responseCount,
        numUnitsAvg: responseCount / rows.length,
        responseCount,
        reviewCount: rows.reduce((total, row) => total + row.reviewCount, 0),
        testLogCount: rows.reduce((total, row) => total + row.testLogCount, 0),
        lastChangeAt
      };
    })
    .sort(
      (left, right) =>
        right.lastChangeAt.localeCompare(left.lastChangeAt) ||
        left.groupKey.localeCompare(right.groupKey)
    );
};

const formatResponseCsv = (input: {
  tenantKey: string;
  workspaceKey: string;
  participantSessions: ParticipantSession[];
  participantRosterEntries?: ParticipantRosterEntry[];
  testRuns: TestRun[];
} & DetailedResponseFilters): string => {
  const rows = listDetailedResponsesForWorkspace(input);

  const header = [
    "tenantKey",
    "workspaceKey",
    "loginKey",
    "groupKey",
    "participantSessionId",
    "testRunId",
    "bookletKey",
    "unitKey",
    "response",
    "status",
    "updatedAt",
    "completedAt",
    "participantDisplayName",
    "rosterGroupKey",
    "rosterBookletKey"
  ];

  return [
    header.join(","),
    ...rows.map(row =>
      [
        row.tenantKey,
        row.workspaceKey,
        row.loginKey,
        row.groupKey,
        row.participantSessionId,
        row.testRunId,
        row.bookletKey,
        row.unitKey,
        row.response,
        row.status,
        row.updatedAt,
        row.completedAt,
        row.participantRosterEntry?.displayName ?? "",
        row.participantRosterEntry?.groupKey ?? "",
        row.participantRosterEntry?.bookletKey ?? ""
      ]
        .map(escapeCsvCell)
        .join(",")
    )
  ].join("\n") + "\n";
};

const formatWorkspaceActivityCsv = (input: {
  tenantKey: string;
  workspaceKey: string;
  activityEvents: WorkspaceActivityEvent[];
}): string => {
  const header = [
    "tenantKey",
    "workspaceKey",
    "activityEventId",
    "eventType",
    "actorId",
    "subjectType",
    "subjectId",
    "occurredAt",
    "summary",
    "detailsJson"
  ];
  const rows = [...input.activityEvents].sort(
    (left, right) =>
      left.occurredAt.localeCompare(right.occurredAt) ||
      left.activityEventId.localeCompare(right.activityEventId)
  );

  return [
    header.join(","),
    ...rows.map(activityEvent =>
      [
        input.tenantKey,
        input.workspaceKey,
        activityEvent.activityEventId,
        activityEvent.eventType,
        activityEvent.actorId ?? "",
        activityEvent.subjectType,
        activityEvent.subjectId,
        activityEvent.occurredAt,
        activityEvent.summary,
        JSON.stringify(activityEvent.details)
      ]
        .map(escapeCsvCell)
        .join(",")
    )
  ].join("\n") + "\n";
};

const listParticipantTestLogsForWorkspace = (input: {
  tenantKey: string;
  workspaceKey: string;
  testLogs: ParticipantTestLog[];
  participantSessions: ParticipantSession[];
  testRuns: TestRun[];
  loginKey?: string;
  groupKey?: string;
  groupKeys?: string[];
  bookletKey?: string;
  testRunId?: string;
  unitKey?: string;
  logKey?: string;
  limit: number;
}): WorkspaceParticipantTestLogListItem[] => {
  const sessionsById = new Map(
    input.participantSessions.map(session => [session.participantSessionId, session])
  );
  const runsById = new Map(input.testRuns.map(testRun => [testRun.testRunId, testRun]));
  return input.testLogs
    .flatMap(testLog => {
      const participantSession = sessionsById.get(testLog.participantSessionId);
      const testRun = runsById.get(testLog.testRunId);
      if (!participantSession || !testRun) {
        return [];
      }
      return [{
        testLog,
        loginKey: participantSession.loginKey,
        groupKey: participantSession.groupKey,
        participantCode: participantSession.participantCode ?? "",
        bookletKey: testRun.bookletKey,
        bookletAssignmentKey:
          testRun.bookletAssignmentKey ?? testRun.bookletKey
      } satisfies WorkspaceParticipantTestLogListItem];
    })
    .filter(item =>
      (!input.loginKey || item.loginKey === input.loginKey) &&
      (!input.groupKey || item.groupKey === input.groupKey) &&
      (!input.groupKeys?.length || input.groupKeys.includes(item.groupKey)) &&
      (!input.bookletKey || item.bookletKey === input.bookletKey) &&
      (!input.testRunId || item.testLog.testRunId === input.testRunId) &&
      (!input.unitKey || item.testLog.unitKey === input.unitKey) &&
      (!input.logKey || item.testLog.logKey === input.logKey)
    )
    .sort((left, right) =>
      right.testLog.timestamp - left.testLog.timestamp ||
      right.testLog.recordedAt.localeCompare(left.testLog.recordedAt) ||
      right.testLog.participantTestLogId.localeCompare(
        left.testLog.participantTestLogId
      )
    )
    .slice(0, input.limit);
};

const formatParticipantTestLogCsv = (
  items: WorkspaceParticipantTestLogListItem[]
): string => {
  const columns = [
    "groupname",
    "loginname",
    "code",
    "bookletname",
    "unitname",
    "originalUnitId",
    "timestamp",
    "logentry"
  ];
  const escapeSemicolonCsvCell = (value: unknown): string =>
    `"${String(value ?? "").replace(/"/g, '""')}"`;
  const chronologicalItems = [...items].sort((left, right) =>
    left.testLog.timestamp - right.testLog.timestamp ||
    left.testLog.recordedAt.localeCompare(right.testLog.recordedAt) ||
    left.testLog.participantTestLogId.localeCompare(
      right.testLog.participantTestLogId
    )
  );
  return `\uFEFF${[
    columns.join(";"),
    ...chronologicalItems.map(item => {
      const separator = item.testLog.unitKey ? " = " : " : ";
      const logEntry = item.testLog.logContent
        ? `${item.testLog.logKey}${separator}${JSON.stringify(item.testLog.logContent)}`
        : item.testLog.logKey;
      return [
        item.groupKey,
        item.loginKey,
        item.participantCode,
        item.bookletAssignmentKey,
        item.testLog.unitKey ?? "",
        item.testLog.originalUnitId ?? "",
        item.testLog.timestamp,
        logEntry
      ].map(escapeSemicolonCsvCell).join(";");
    })
  ].join("\n")}\n`;
};

const formatSourcePackagesCsv = (input: {
  tenantKey: string;
  workspaceKey: string;
  items: WorkspaceSourcePackageListItem[];
}): string => {
  const header = [
    "tenantKey",
    "workspaceKey",
    "sourcePackageId",
    "fileName",
    "fileType",
    "mediaType",
    "status",
    "uploadedAt",
    "bookletCount",
    "unitCount",
    "hasSourceDocument",
    "fileSizeBytes",
    "downloadAvailable",
    "importJobCount",
    "contentReleaseCount",
    "canDelete",
    "blockingDependencyCount",
    "latestImportJobId",
    "latestImportStatus",
    "latestImportCreatedAt",
    "latestImportFinishedAt",
    "latestImportDiagnosticCount"
  ];

  return [
    header.join(","),
    ...input.items.map(item => {
      const sourcePackage = item.sourcePackage;
      const bookletEntries = sourcePackage.contentStructure?.bookletEntries ?? [];
      const unitCount = bookletEntries.reduce(
        (total, booklet) => total + booklet.unitEntries.length,
        0
      );

      return [
        input.tenantKey,
        input.workspaceKey,
        sourcePackage.sourcePackageId,
        sourcePackage.fileName,
        item.fileType,
        sourcePackage.mediaType,
        sourcePackage.status,
        sourcePackage.uploadedAt,
        String(bookletEntries.length),
        String(unitCount),
        String(item.downloadAvailable),
        item.fileSizeBytes === null ? "" : String(item.fileSizeBytes),
        String(item.downloadAvailable),
        String(item.importJobCount),
        String(item.contentReleaseCount),
        String(item.canDelete),
        String(item.blockingDependencyCount),
        item.latestImportJob?.importJobId ?? "",
        item.latestImportJob?.status ?? "",
        item.latestImportJob?.createdAt ?? "",
        item.latestImportJob?.finishedAt ?? "",
        String(item.latestImportJob?.diagnostics.length ?? 0)
      ]
        .map(escapeCsvCell)
        .join(",");
    })
  ].join("\n") + "\n";
};

const formatTenantsCsv = (items: Tenant[]): string => {
  const header = ["tenantKey", "displayName", "status", "tenantId", "createdAt"];

  return [
    header.join(","),
    ...items.map(tenant =>
      [
        tenant.tenantKey,
        tenant.displayName,
        tenant.status,
        tenant.tenantId,
        tenant.createdAt
      ]
        .map(escapeCsvCell)
        .join(",")
    )
  ].join("\n") + "\n";
};

const formatWorkspacesCsv = (input: {
  tenantKey: string;
  items: Workspace[];
}): string => {
  const header = [
    "tenantKey",
    "workspaceKey",
    "displayName",
    "status",
    "workspaceId",
    "createdAt"
  ];

  return [
    header.join(","),
    ...input.items.map(workspace =>
      [
        input.tenantKey,
        workspace.workspaceKey,
        workspace.displayName,
        workspace.status,
        workspace.workspaceId,
        workspace.createdAt
      ]
        .map(escapeCsvCell)
        .join(",")
    )
  ].join("\n") + "\n";
};

const formatWorkspaceOverviewCsv = (input: {
  tenantKey: string;
  workspaceKey: string;
  overview: WorkspaceOverview;
}): string => {
  const header = [
    "tenantKey",
    "workspaceKey",
    "tenantDisplayName",
    "workspaceDisplayName",
    "sourcePackageCount",
    "importJobCount",
    "contentReleaseCount",
    "activeContentReleaseId",
    "latestImportJobAt",
    "participantSessionCount",
    "openTestRunCount"
  ];

  return [
    header.join(","),
    [
      input.tenantKey,
      input.workspaceKey,
      input.overview.tenant.displayName,
      input.overview.workspace.displayName,
      String(input.overview.sourcePackageCount),
      String(input.overview.importJobCount),
      String(input.overview.contentReleaseCount),
      input.overview.activeContentReleaseId ?? "",
      input.overview.latestImportJobAt ?? "",
      String(input.overview.participantSessionCount),
      String(input.overview.openTestRunCount)
    ]
      .map(escapeCsvCell)
      .join(",")
  ].join("\n") + "\n";
};

const formatImportJobsCsv = (input: {
  tenantKey: string;
  workspaceKey: string;
  items: WorkspaceImportJobListItem[];
}): string => {
  const header = [
    "tenantKey",
    "workspaceKey",
    "importJobId",
    "sourcePackageId",
    "sourceFileName",
    "sourceMediaType",
    "status",
    "createdAt",
    "finishedAt",
    "diagnosticCount",
    "diagnosticSeverities",
    "diagnosticCodes",
    "diagnosticMessages"
  ];

  return [
    header.join(","),
    ...input.items.map(item =>
      [
        input.tenantKey,
        input.workspaceKey,
        item.importJob.importJobId,
        item.importJob.sourcePackageId,
        item.sourcePackage?.fileName ?? "",
        item.sourcePackage?.mediaType ?? "",
        item.importJob.status,
        item.importJob.createdAt,
        item.importJob.finishedAt ?? "",
        String(item.importJob.diagnostics.length),
        item.importJob.diagnostics.map(diagnostic => diagnostic.severity).join("|"),
        item.importJob.diagnostics.map(diagnostic => diagnostic.code).join("|"),
        item.importJob.diagnostics.map(diagnostic => diagnostic.message).join("|")
      ]
        .map(escapeCsvCell)
        .join(",")
    )
  ].join("\n") + "\n";
};

const formatContentReleasesCsv = (input: {
  tenantKey: string;
  workspaceKey: string;
  items: WorkspaceContentReleaseListItem[];
}): string => {
  const header = [
    "tenantKey",
    "workspaceKey",
    "contentReleaseId",
    "releaseLabel",
    "status",
    "createdAt",
    "activatedAt",
    "importJobId",
    "importJobStatus",
    "sourcePackageId",
    "sourceFileName",
    "sourceMediaType",
    "bookletCount",
    "unitCount",
    "participantSessionCount",
    "openTestRunCount"
  ];

  return [
    header.join(","),
    ...input.items.map(item => {
      const bookletCount = item.contentRelease.runtimeSnapshot.bookletEntries.length;
      const unitCount = item.contentRelease.runtimeSnapshot.bookletEntries.reduce(
        (sum, booklet) => sum + booklet.unitEntries.length,
        0
      );

      return [
        input.tenantKey,
        input.workspaceKey,
        item.contentRelease.contentReleaseId,
        item.contentRelease.releaseLabel,
        item.contentRelease.status,
        item.contentRelease.createdAt,
        item.contentRelease.activatedAt ?? "",
        item.contentRelease.importJobId,
        item.importJob?.status ?? "",
        item.sourcePackage?.sourcePackageId ?? "",
        item.sourcePackage?.fileName ?? "",
        item.sourcePackage?.mediaType ?? "",
        String(bookletCount),
        String(unitCount),
        String(item.participantSessionCount),
        String(item.openTestRunCount)
      ]
        .map(escapeCsvCell)
        .join(",");
    })
  ].join("\n") + "\n";
};

const formatParticipantRosterCsv = (input: {
  tenantKey: string;
  workspaceKey: string;
  items: WorkspaceParticipantRosterItem[];
}): string => {
  const header = [
    "tenantKey",
    "workspaceKey",
    "participantRosterEntryId",
    "loginKey",
    "executionMode",
    "groupKey",
    "bookletKey",
    "displayName",
    "passwordRequired",
    "importedAt",
    "validationWarningCodes",
    "validationWarningMessages",
    "bookletKeys",
    "bookletStatePresets",
    "bookletAssignments",
    "validFrom",
    "validTo",
    "validForMinutes"
  ];
  const rows = [...input.items].sort(
    (left, right) =>
      left.loginKey.localeCompare(right.loginKey) ||
      left.participantRosterEntryId.localeCompare(right.participantRosterEntryId)
  );

  return [
    header.join(","),
    ...rows.map(item =>
      [
        input.tenantKey,
        input.workspaceKey,
        item.participantRosterEntryId,
        item.loginKey,
        normalizeParticipantExecutionMode(item.executionMode),
        item.groupKey,
        item.bookletKey ?? "",
        item.displayName ?? "",
        item.passwordRequired ? "true" : "false",
        item.importedAt,
        item.validationWarnings.map(warning => warning.code).join("|"),
        item.validationWarnings.map(warning => warning.message).join("|"),
        getParticipantRosterBookletKeys(item).join("|"),
        JSON.stringify(item.bookletStatePresets ?? {}),
        JSON.stringify(getParticipantRosterBookletAssignments(item)),
        item.validFrom ?? "",
        item.validTo ?? "",
        item.validForMinutes?.toString() ?? ""
      ]
        .map(escapeCsvCell)
        .join(",")
    )
  ].join("\n") + "\n";
};

const formatParticipantSessionsCsv = (input: {
  tenantKey: string;
  workspaceKey: string;
  items: WorkspaceParticipantSessionListItem[];
}): string => {
  const header = [
    "tenantKey",
    "workspaceKey",
    "participantSessionId",
    "loginKey",
    "groupKey",
    "executionMode",
    "sessionStatus",
    "createdAt",
    "contentReleaseId",
    "releaseLabel",
    "latestTestRunId",
    "latestBookletKey",
    "latestRunStatus",
    "latestCurrentUnitKey",
    "latestRunUpdatedAt",
    "rosterBookletKey",
    "rosterDisplayName",
    "validUntil"
  ];

  return [
    header.join(","),
    ...input.items.map(item =>
      [
        input.tenantKey,
        input.workspaceKey,
        item.participantSession.participantSessionId,
        item.participantSession.loginKey,
        item.participantSession.groupKey,
        normalizeParticipantExecutionMode(
          item.latestTestRun?.executionMode ??
            item.participantSession.executionMode ??
            item.participantRosterEntry?.executionMode
        ),
        item.participantSession.status,
        item.participantSession.createdAt,
        item.participantSession.contentReleaseId,
        item.contentRelease?.releaseLabel ?? "",
        item.latestTestRun?.testRunId ?? "",
        item.latestTestRun?.bookletKey ?? "",
        item.latestTestRun?.status ?? "",
        item.latestTestRun?.currentUnitKey ?? "",
        item.latestTestRun?.updatedAt ?? "",
        item.participantRosterEntry?.bookletKey ?? "",
        item.participantRosterEntry?.displayName ?? "",
        item.participantSession.validUntil ?? ""
      ]
        .map(escapeCsvCell)
        .join(",")
    )
  ].join("\n") + "\n";
};

const formatStudyMonitorCsv = (
  summary: WorkspaceStudyMonitorSummary
): string => {
  const header = [
    "tenantKey",
    "workspaceKey",
    "section",
    "key",
    "label",
    "groupKey",
    "bookletKey",
    "unitKey",
    "loginKey",
    "expectedParticipantCount",
    "rosterEntryCount",
    "participantSessionCount",
    "testRunCount",
    "notStartedCount",
    "runningCount",
    "pausedCount",
    "completedCount",
    "responseCount",
    "reviewCount",
    "unitCount",
    "expectedRunCount",
    "rosterExpectedCount",
    "missingResponseCount",
    "unexpectedResponseCount",
    "completedRunCount",
    "latestActivityAt",
    "generatedAt"
  ];
  const rows: Array<Record<string, string | number | null | undefined>> = [
    {
      section: "workspace",
      key: summary.workspaceKey,
      label: `${summary.workspaceKey} monitor`,
      expectedParticipantCount: summary.expectedParticipantCount,
      rosterEntryCount: summary.rosterEntryCount,
      participantSessionCount: summary.participantSessionCount,
      testRunCount: summary.testRunCount,
      notStartedCount: summary.notStartedCount,
      runningCount: summary.runningCount,
      pausedCount: summary.pausedCount,
      completedCount: summary.completedCount,
      responseCount: summary.responseCount,
      reviewCount: summary.reviewCount
    },
    ...summary.groups.map(group => ({
      section: "group",
      key: group.groupKey,
      label: group.groupKey,
      groupKey: group.groupKey,
      expectedParticipantCount: group.expectedParticipantCount,
      rosterEntryCount: group.rosterEntryCount,
      participantSessionCount: group.participantSessionCount,
      testRunCount: group.testRunCount,
      notStartedCount: group.notStartedCount,
      runningCount: group.runningCount,
      pausedCount: group.pausedCount,
      completedCount: group.completedCount,
      responseCount: group.responseCount,
      reviewCount: group.reviewCount,
      latestActivityAt: group.latestActivityAt
    })),
    ...summary.bookletProgress.map(booklet => ({
      section: "booklet",
      key: booklet.bookletKey,
      label: booklet.displayLabel,
      bookletKey: booklet.bookletKey,
      expectedParticipantCount: booklet.expectedParticipantCount,
      rosterEntryCount: booklet.rosterEntryCount,
      participantSessionCount: booklet.participantSessionCount,
      testRunCount: booklet.testRunCount,
      notStartedCount: booklet.notStartedCount,
      runningCount: booklet.runningCount,
      pausedCount: booklet.pausedCount,
      completedCount: booklet.completedCount,
      responseCount: booklet.responseCount,
      reviewCount: booklet.reviewCount,
      unitCount: booklet.unitCount,
      latestActivityAt: booklet.latestActivityAt
    })),
    ...summary.unitProgress.map(unit => ({
      section: "unit",
      key: unit.unitKey,
      label: unit.displayLabel,
      unitKey: unit.unitKey,
      responseCount: unit.responseCount,
      expectedRunCount: unit.expectedRunCount,
      rosterExpectedCount: unit.rosterExpectedCount,
      missingResponseCount: unit.missingResponseCount,
      unexpectedResponseCount: unit.unexpectedResponseCount,
      completedRunCount: unit.completedRunCount,
      latestActivityAt: unit.latestActivityAt
    })),
    ...summary.notStartedParticipants.map(participant => ({
      section: "not_started_participant",
      key: participant.loginKey,
      label: participant.displayName ?? participant.loginKey,
      groupKey: participant.groupKey,
      bookletKey: participant.bookletKey,
      loginKey: participant.loginKey,
      notStartedCount: 1
    }))
  ];

  return [
    header.join(","),
    ...rows.map(row =>
      header
        .map(column =>
          escapeCsvCell(
            column === "tenantKey"
              ? summary.tenantKey
              : column === "workspaceKey"
                ? summary.workspaceKey
                : column === "generatedAt"
                  ? summary.generatedAt
                  : row[column] == null
                    ? ""
                    : String(row[column])
          )
        )
        .join(",")
    )
  ].join("\n") + "\n";
};

const formatStudyMonitorParticipantMatrixCsv = (
  matrix: WorkspaceStudyMonitorParticipantMatrix
): string => {
  const header = [
    "tenantKey",
    "workspaceKey",
    "generatedAt",
    "loginKey",
    "groupKey",
    "displayName",
    "rosterBookletKey",
    "participantSessionId",
    "participantSessionStatus",
    "testRunId",
    "testRunStatus",
    "bookletKey",
    "unitKey",
    "unitLabel",
    "expected",
    "answered",
    "responseLength",
    "reviewCount",
    "latestActivityAt"
  ];

  return [
    header.join(","),
    ...matrix.rows.map(row =>
      [
        row.tenantKey,
        row.workspaceKey,
        matrix.generatedAt,
        row.loginKey,
        row.groupKey,
        row.displayName ?? "",
        row.rosterBookletKey ?? "",
        row.participantSessionId ?? "",
        row.participantSessionStatus,
        row.testRunId ?? "",
        row.testRunStatus,
        row.bookletKey ?? "",
        row.unitKey,
        row.unitLabel,
        String(row.expected),
        String(row.answered),
        String(row.responseLength),
        String(row.reviewCount),
        row.latestActivityAt ?? ""
      ]
        .map(escapeCsvCell)
        .join(",")
    )
  ].join("\n") + "\n";
};

const formatStudyMonitorRunCsv = (
  detail: WorkspaceStudyMonitorRunDetail
): string => {
  const header = [
    "tenantKey",
    "workspaceKey",
    "generatedAt",
    "testRunId",
    "participantSessionId",
    "loginKey",
    "groupKey",
    "displayName",
    "bookletKey",
    "bookletLabel",
    "testRunStatus",
    "currentUnitKey",
    "adaptiveStates",
    "testletTimers",
    "unitKey",
    "unitLabel",
    "expected",
    "current",
    "answered",
    "responseLength",
    "reviewCount",
    "response"
  ];

  return [
    header.join(","),
    ...detail.units.map(unit =>
      [
        detail.tenantKey,
        detail.workspaceKey,
        detail.generatedAt,
        detail.testRun.testRunId,
        detail.participantSession?.participantSessionId ?? "",
        detail.participantSession?.loginKey ?? "",
        detail.participantSession?.groupKey ?? "",
        detail.participantRosterEntry?.displayName ?? "",
        detail.bookletKey,
        detail.bookletLabel,
        detail.testRun.status,
        detail.testRun.currentUnitKey ?? "",
        JSON.stringify(
          Object.fromEntries(
            detail.adaptiveStates.map(state => [state.stateKey, state.optionKey])
          )
        ),
        JSON.stringify(detail.testletTimers),
        unit.unitKey,
        unit.displayLabel,
        String(unit.expected),
        String(unit.current),
        String(unit.answered),
        String(unit.responseLength),
        String(unit.reviewCount),
        unit.response ?? ""
      ]
        .map(escapeCsvCell)
        .join(",")
    )
  ].join("\n") + "\n";
};

const filterStudyMonitorParticipantMatrix = (
  matrix: WorkspaceStudyMonitorParticipantMatrix,
  input: {
    loginKey?: string;
    groupKey?: string;
    bookletKey?: string;
    unitKey?: string;
    testRunStatus?: TestRunStatus | "not_started";
    answerState?: "answered" | "missing";
    limit?: number;
  }
): WorkspaceStudyMonitorParticipantMatrix => {
  const loginKey = input.loginKey?.trim().toLowerCase() ?? "";
  const groupKey = input.groupKey?.trim().toLowerCase() ?? "";
  const bookletKey = input.bookletKey?.trim().toLowerCase() ?? "";
  const unitKey = input.unitKey?.trim().toLowerCase() ?? "";
  const filteredRows = matrix.rows.filter(row => {
    if (
      loginKey &&
      !`${row.loginKey} ${row.displayName ?? ""}`.toLowerCase().includes(loginKey)
    ) {
      return false;
    }
    if (groupKey && !row.groupKey.toLowerCase().includes(groupKey)) {
      return false;
    }
    if (
      bookletKey &&
      !`${row.bookletKey ?? ""} ${row.rosterBookletKey ?? ""}`
        .toLowerCase()
        .includes(bookletKey)
    ) {
      return false;
    }
    if (
      unitKey &&
      !`${row.unitKey} ${row.unitLabel}`.toLowerCase().includes(unitKey)
    ) {
      return false;
    }
    if (input.testRunStatus && row.testRunStatus !== input.testRunStatus) {
      return false;
    }
    if (input.answerState === "answered" && !row.answered) {
      return false;
    }
    if (input.answerState === "missing" && row.answered) {
      return false;
    }
    return true;
  });

  return {
    ...matrix,
    rows: input.limit ? filteredRows.slice(0, input.limit) : filteredRows
  };
};

const formatOpenMonitorRunsCsv = (input: {
  tenantKey: string;
  workspaceKey: string;
  items: OpenMonitorRun[];
}): string => {
  const header = [
    "tenantKey",
    "workspaceKey",
    "participantSessionId",
    "testRunId",
    "loginKey",
    "groupKey",
    "executionMode",
    "bookletKey",
    "bookletLabel",
    "bookletSpecies",
    "bookletError",
    "bookletAssignmentKey",
    "bookletStates",
    "testState",
    "status",
    "locked",
    "currentUnitKey",
    "currentUnitLabel",
    "currentBlockKey",
    "currentBlockLabel",
    "activeTestletTimer",
    "updatedAt",
    "rosterBookletKey",
    "rosterDisplayName"
  ];

  return [
    header.join(","),
    ...input.items.map(item =>
      [
        input.tenantKey,
        input.workspaceKey,
        item.participantSessionId,
        item.testRunId,
        item.loginKey,
        item.groupKey,
        item.executionMode,
        item.bookletKey,
        item.bookletLabel ?? item.bookletKey,
        item.bookletSpecies ?? "",
        item.bookletError ?? "",
        item.bookletAssignmentKey,
        JSON.stringify(item.bookletStates),
        JSON.stringify(item.testState),
        item.status,
        item.locked ? "true" : "false",
        item.currentUnitKey ?? "",
        item.currentUnitLabel ?? "",
        item.currentBlockKey ?? "",
        item.currentBlockLabel ?? "",
        item.activeTestletTimer
          ? JSON.stringify(item.activeTestletTimer)
          : "",
        item.updatedAt,
        item.participantRosterEntry?.bookletKey ?? "",
        item.participantRosterEntry?.displayName ?? ""
      ]
        .map(escapeCsvCell)
        .join(",")
    )
  ].join("\n") + "\n";
};

const buildWorkspaceReviewListItems = (input: {
  reviews: WorkspaceReview[];
  participantSessions: ParticipantSession[];
  participantRosterEntries?: ParticipantRosterEntry[];
  testRuns: TestRun[];
} & WorkspaceReviewFilters): WorkspaceReviewListItem[] => {
  const participantSessionsById = new Map(
    input.participantSessions.map(participantSession => [
      participantSession.participantSessionId,
      participantSession
    ])
  );
  const testRunsById = new Map(
    input.testRuns.map(testRun => [testRun.testRunId, normalizeTestRun(testRun)])
  );
  const participantRosterEntriesByLoginKey = new Map(
    (input.participantRosterEntries ?? []).map(entry => [entry.loginKey, entry])
  );
  const filters = {
    loginKey: normalizeExactFilter(input.loginKey),
    groupKey: normalizeExactFilter(input.groupKey),
    groupKeys: input.groupKeys
      ?.map(groupKey => normalizeExactFilter(groupKey))
      .filter((groupKey): groupKey is string => Boolean(groupKey)),
    bookletKey: normalizeExactFilter(input.bookletKey),
    participantSessionId: normalizeExactFilter(input.participantSessionId),
    testRunId: normalizeExactFilter(input.testRunId),
    unitKey: normalizeExactFilter(input.unitKey),
    reviewerId: normalizeExactFilter(input.reviewerId),
    category: normalizeExactFilter(input.category)
  };

  return [...input.reviews]
    .map(normalizeWorkspaceReview)
    .map(review => {
      const participantSession =
        participantSessionsById.get(review.participantSessionId) ?? null;

      return {
        review,
        participantSession,
        participantRosterEntry: participantSession
          ? participantRosterEntriesByLoginKey.get(participantSession.loginKey) ??
            null
          : null,
        testRun: testRunsById.get(review.testRunId) ?? null
      };
    })
    .filter(
      item =>
        (!filters.loginKey ||
          item.participantSession?.loginKey === filters.loginKey) &&
        (!filters.groupKey ||
          item.participantSession?.groupKey === filters.groupKey) &&
        (!filters.groupKeys?.length ||
          (item.participantSession !== null &&
            filters.groupKeys.includes(item.participantSession.groupKey))) &&
        (!filters.bookletKey ||
          item.testRun?.bookletKey === filters.bookletKey ||
          item.participantRosterEntry?.bookletKey === filters.bookletKey) &&
        (!filters.participantSessionId ||
          item.review.participantSessionId === filters.participantSessionId) &&
        (!filters.testRunId || item.review.testRunId === filters.testRunId) &&
        (!filters.unitKey || item.review.unitKey === filters.unitKey) &&
        (!filters.reviewerId || item.review.reviewerId === filters.reviewerId) &&
        (!filters.category ||
          item.review.categories.includes(filters.category.toLowerCase()))
    )
    .sort(
      (left, right) =>
        right.review.updatedAt.localeCompare(left.review.updatedAt) ||
        right.review.createdAt.localeCompare(left.review.createdAt) ||
        left.review.reviewId.localeCompare(right.review.reviewId)
    )
    .slice(0, resolveOperatorReadLimit(input.limit, input.limitMaximum));
};

const formatReviewCsv = (input: {
  tenantKey: string;
  workspaceKey: string;
  reviews: WorkspaceReview[];
  participantSessions: ParticipantSession[];
  participantRosterEntries?: ParticipantRosterEntry[];
  testRuns: TestRun[];
} & WorkspaceReviewFilters): string => {
  const items = buildWorkspaceReviewListItems({
    reviews: input.reviews,
    participantSessions: input.participantSessions,
    participantRosterEntries: input.participantRosterEntries,
    testRuns: input.testRuns,
    loginKey: input.loginKey,
    groupKey: input.groupKey,
    bookletKey: input.bookletKey,
    participantSessionId: input.participantSessionId,
    testRunId: input.testRunId,
    unitKey: input.unitKey,
    reviewerId: input.reviewerId,
    category: input.category,
    limit: input.limit,
    limitMaximum: input.limitMaximum
  });
  const header = [
    "tenantKey",
    "workspaceKey",
    "reviewId",
    "loginKey",
    "groupKey",
    "participantSessionId",
    "testRunId",
    "bookletKey",
    "unitKey",
    "originalUnitId",
    "page",
    "pageLabel",
    "userAgent",
    "reviewerId",
    "priority",
    "categories",
    "category",
    "comment",
    "createdAt",
    "updatedAt",
    "participantDisplayName",
    "rosterGroupKey",
    "rosterBookletKey"
  ];

  return [
    header.join(","),
    ...items.map(item =>
      [
        input.tenantKey,
        input.workspaceKey,
        item.review.reviewId,
        item.participantSession?.loginKey ?? "",
        item.participantSession?.groupKey ?? "",
        item.review.participantSessionId,
        item.review.testRunId,
        item.testRun?.bookletKey ?? "",
        item.review.unitKey ?? "",
        item.review.originalUnitId ?? "",
        item.review.page === null ? "" : String(item.review.page),
        item.review.pageLabel ?? "",
        item.review.userAgent ?? "",
        item.review.reviewerId,
        String(item.review.priority),
        item.review.categories.join(" "),
        item.review.category,
        item.review.comment,
        item.review.createdAt,
        item.review.updatedAt,
        item.participantRosterEntry?.displayName ?? "",
        item.participantRosterEntry?.groupKey ?? "",
        item.participantRosterEntry?.bookletKey ?? ""
      ]
        .map(escapeCsvCell)
        .join(",")
    )
  ].join("\n") + "\n";
};

const toDisplayLabel = (prefix: string, key: string | null): string | null => {
  if (!key) {
    return null;
  }

  const normalized = key.replace(/[-_:]/g, " ");
  return `${prefix} ${normalized}`;
};

const createImportDiagnostic = (
  code: string,
  message: string,
  severity: ImportJobDiagnostic["severity"] = "error"
): ImportJobDiagnostic => ({
  severity,
  code,
  message
});

const hasStructuredContent = (
  contentStructure: SourcePackageContentStructure | null | undefined
): contentStructure is SourcePackageContentStructure =>
  Boolean(
    contentStructure &&
      ((Array.isArray(contentStructure.bookletEntries) &&
        contentStructure.bookletEntries.length > 0) ||
        (Array.isArray(contentStructure.systemCheckEntries) &&
          contentStructure.systemCheckEntries.length > 0))
  );

const normalizeManifestToken = (value: unknown): string =>
  String(value ?? "").trim();

const normalizeManifestLabel = (
  value: unknown,
  fallbackPrefix: string,
  key: string
): string => {
  const label = normalizeManifestToken(value);
  return label || toDisplayLabel(fallbackPrefix, key) || key;
};

const normalizeUnitContent = (value: unknown): string | undefined => {
  const content = String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
  return content || undefined;
};

const normalizeRuntimeDocument = (value: unknown): string | undefined => {
  const document = typeof value === "string" ? value.trim() : "";
  return document || undefined;
};

const normalizeUnitCodingScheme = (value: unknown): UnitCodingScheme | null => {
  const rawScheme = Array.isArray(value)
    ? { variableCodings: value }
    : typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : null;
  if (
    !rawScheme ||
    !Array.isArray(rawScheme.variableCodings) ||
    !rawScheme.variableCodings.every(
      variableCoding =>
        typeof variableCoding === "object" &&
        variableCoding !== null &&
        !Array.isArray(variableCoding)
    )
  ) {
    return null;
  }
  const version =
    typeof rawScheme.version === "string" ? rawScheme.version.trim() : "";
  return {
    ...(version ? { version } : {}),
    variableCodings: rawScheme.variableCodings as Array<Record<string, unknown>>
  };
};

const normalizeUnitAttachmentRequests = (
  value: unknown
): UnitAttachmentRequest[] => {
  if (!Array.isArray(value)) {
    return [];
  }
  const requests = new Map<string, UnitAttachmentRequest>();
  for (const candidate of value) {
    if (typeof candidate !== "object" || candidate === null) {
      continue;
    }
    const record = candidate as Record<string, unknown>;
    const variableId = normalizeManifestToken(record.variableId);
    const attachmentType = normalizeManifestToken(record.attachmentType);
    if (!variableId || attachmentType !== "capture-image") {
      continue;
    }
    requests.set(variableId.toLowerCase(), {
      variableId,
      attachmentType: "capture-image"
    });
  }
  return [...requests.values()];
};

const normalizeSourcePackageUnitEntry = (
  unitEntry: SourcePackageUnitEntry
): SourcePackageUnitEntry | null => {
  const unitKey = normalizeManifestToken(unitEntry.unitKey);
  if (!unitKey) {
    return null;
  }
  const description = normalizeUnitContent(unitEntry.description);
  const originalUnitId = normalizeManifestToken(unitEntry.originalUnitId);
  const shortLabel = normalizeManifestToken(unitEntry.shortLabel);
  const content = normalizeUnitContent(unitEntry.content);
  const playerKey = normalizeManifestToken(unitEntry.playerKey);
  const unitDefinition = normalizeRuntimeDocument(unitEntry.unitDefinition);
  const unitDefinitionType = normalizeManifestToken(
    unitEntry.unitDefinitionType
  );
  const codingScheme = normalizeUnitCodingScheme(unitEntry.codingScheme);
  const requestedAttachments = normalizeUnitAttachmentRequests(
    unitEntry.requestedAttachments
  );
  return {
    unitKey,
    ...(originalUnitId && originalUnitId !== unitKey
      ? { originalUnitId }
      : {}),
    displayLabel: normalizeManifestLabel(
      unitEntry.displayLabel,
      "Unit",
      unitKey
    ),
    ...(shortLabel ? { shortLabel } : {}),
    ...(Array.isArray(unitEntry.testletPath) && unitEntry.testletPath.length > 0
      ? {
          testletPath: unitEntry.testletPath
            .map(normalizeManifestToken)
            .filter(Boolean)
        }
      : {}),
    ...(description ? { description } : {}),
    ...(content ? { content } : {}),
    ...(playerKey ? { playerKey } : {}),
    ...(unitDefinition ? { unitDefinition } : {}),
    ...(unitDefinitionType ? { unitDefinitionType } : {}),
    ...(codingScheme ? { codingScheme } : {}),
    ...(requestedAttachments.length > 0 ? { requestedAttachments } : {})
  };
};

const normalizeContentStructure = (
  contentStructure: SourcePackageContentStructure
): ContentReleaseRuntimeSnapshot | null => {
  const systemCheckEntriesById = new Map<string, SourcePackageSystemCheckEntry>();
  for (const entry of contentStructure.systemCheckEntries ?? []) {
    const checkId = normalizeManifestToken(entry.checkId);
    if (!checkId || systemCheckEntriesById.has(checkId.toUpperCase())) {
      continue;
    }
    const normalizeSpeed = (
      speed: SourcePackageSystemCheckEntry["uploadSpeed"] | undefined
    ): SourcePackageSystemCheckEntry["uploadSpeed"] => ({
      min: Math.max(0, Number(speed?.min) || 0),
      good: Math.max(0, Number(speed?.good) || 0),
      maxDevianceBytesPerSecond: Math.max(
        0,
        Number(speed?.maxDevianceBytesPerSecond) || 0
      ),
      maxErrorsPerSequence: Math.max(
        0,
        Number(speed?.maxErrorsPerSequence) || 0
      ),
      maxSequenceRepetitions: Math.max(
        0,
        Number(speed?.maxSequenceRepetitions) || 0
      ),
      sequenceSizes: (speed?.sequenceSizes ?? []).flatMap(value => {
        const size = Number(value);
        return Number.isFinite(size) && size > 0 ? [size] : [];
      })
    });
    const validQuestionTypes = new Set([
      "string",
      "select",
      "header",
      "check",
      "text",
      "radio"
    ]);
    const questionIds = new Set<string>();
    const questions = (entry.questions ?? []).flatMap(question => {
      const id = normalizeManifestToken(question.id);
      const type = normalizeManifestToken(question.type).toLowerCase();
      if (!id || questionIds.has(id) || !validQuestionTypes.has(type)) {
        return [];
      }
      questionIds.add(id);
      return [{
        id,
        type: type as SourcePackageSystemCheckEntry["questions"][number]["type"],
        prompt: normalizeUnitContent(question.prompt) ?? "",
        required: Boolean(question.required),
        options: (question.options ?? [])
          .map(option => String(option).trim())
          .filter(Boolean)
      }];
    });
    const unitEntry = entry.unitEntry
      ? normalizeSourcePackageUnitEntry(entry.unitEntry)
      : null;
    systemCheckEntriesById.set(checkId.toUpperCase(), {
      checkId,
      displayLabel: normalizeManifestLabel(
        entry.displayLabel,
        "System Check",
        checkId
      ),
      ...(normalizeUnitContent(entry.description)
        ? { description: normalizeUnitContent(entry.description) }
        : {}),
      ...(normalizeManifestToken(entry.unitKey)
        ? { unitKey: normalizeManifestToken(entry.unitKey) }
        : {}),
      ...(unitEntry ? { unitEntry } : {}),
      ...(normalizeManifestToken(entry.saveKey)
        ? { saveKey: normalizeManifestToken(entry.saveKey) }
        : {}),
      skipNetwork: Boolean(entry.skipNetwork),
      uploadSpeed: normalizeSpeed(entry.uploadSpeed),
      downloadSpeed: normalizeSpeed(entry.downloadSpeed),
      customTexts: Object.fromEntries(
        Object.entries(entry.customTexts ?? {})
          .map(([key, value]) => [key.trim(), String(value).trim()] as const)
          .filter(([key]) => Boolean(key))
      ),
      questions
    });
  }
  const playerEntriesByKey = new Map<
    string,
    NonNullable<ContentReleaseRuntimeSnapshot["playerEntries"]>[number]
  >();
  for (const playerEntry of contentStructure.playerEntries ?? []) {
    const playerKey = normalizeManifestToken(playerEntry.playerKey);
    const html = normalizeRuntimeDocument(playerEntry.html);
    if (playerKey && html && !playerEntriesByKey.has(playerKey)) {
      playerEntriesByKey.set(playerKey, { playerKey, html });
    }
  }
  const bookletEntriesByKey = new Map<
    string,
    ContentReleaseRuntimeSnapshot["bookletEntries"][number]
  >();
  const unitKeysByBookletKey = new Map<string, Set<string>>();

  for (const bookletEntry of contentStructure.bookletEntries) {
    const bookletKey = normalizeManifestToken(bookletEntry.bookletKey);
    if (!bookletKey) {
      continue;
    }

    const normalizedBooklet: ContentReleaseRuntimeSnapshot["bookletEntries"][number] =
      bookletEntriesByKey.get(bookletKey) ??
      {
        bookletKey,
        displayLabel: normalizeManifestLabel(
          bookletEntry.displayLabel,
          "Booklet",
          bookletKey
        ),
        unitEntries: []
      };
    const customTexts = Object.fromEntries(
      Object.entries(bookletEntry.customTexts ?? {})
        .map(([key, value]) => [key.trim(), String(value).trim()] as const)
        .filter(([key, value]) => Boolean(key && value))
    );
    if (Object.keys(customTexts).length > 0) {
      normalizedBooklet.customTexts = {
        ...(normalizedBooklet.customTexts ?? {}),
        ...customTexts
      };
    }
    if (bookletEntry.config && Object.keys(bookletEntry.config).length > 0) {
      normalizedBooklet.policy = compileBookletRuntimePolicy(bookletEntry.config);
    }
    const normalizeLeaveRestriction = (
      value: unknown
    ): BookletLeaveRestriction | undefined => {
      switch (String(value ?? "").trim().toLowerCase()) {
        case "always":
          return "always";
        case "on":
        case "forward":
          return "forward";
        case "off":
          return "off";
        default:
          return undefined;
      }
    };
    const rootTimeMaxMinutes = Number(
      bookletEntry.rootRestrictions?.timeMax?.minutes
    );
    const rootTimeMaxLeave = bookletEntry.rootRestrictions?.timeMax?.leave;
    const rootDenyPresentation = normalizeLeaveRestriction(
      bookletEntry.rootRestrictions?.denyNavigationOnIncomplete?.presentation
    );
    const rootDenyResponse = normalizeLeaveRestriction(
      bookletEntry.rootRestrictions?.denyNavigationOnIncomplete?.response
    );
    const rootRestrictions: BookletRootRestrictions = {
      ...(Number.isFinite(rootTimeMaxMinutes) && rootTimeMaxMinutes > 0
        ? {
            timeMax: {
              minutes: rootTimeMaxMinutes,
              leave:
                rootTimeMaxLeave === "forbidden" ||
                rootTimeMaxLeave === "allowed"
                  ? rootTimeMaxLeave
                  : "confirm"
            }
          }
        : {}),
      ...(rootDenyPresentation || rootDenyResponse
        ? {
            denyNavigationOnIncomplete: {
              ...(rootDenyPresentation
                ? { presentation: rootDenyPresentation }
                : {}),
              ...(rootDenyResponse ? { response: rootDenyResponse } : {})
            }
          }
        : {})
    };
    if (Object.keys(rootRestrictions).length > 0) {
      normalizedBooklet.rootRestrictions = rootRestrictions;
    }
    const normalizeVariableSource = (
      source: BookletStateVariableSource
    ): BookletStateVariableSource | null => {
      const type = source?.type;
      const variableKey = normalizeManifestToken(source?.variableKey);
      const unitKey = normalizeManifestToken(source?.unitKey);
      return (type === "Code" ||
        type === "Value" ||
        type === "Status" ||
        type === "Score") &&
        variableKey &&
        unitKey
        ? {
            type,
            variableKey,
            unitKey,
            defaultValue: String(source.defaultValue ?? "0")
          }
        : null;
    };
    const normalizeCondition = (
      condition: BookletStateCondition
    ): BookletStateCondition | null => {
      const expressionType = condition?.expression?.type;
      if (
        expressionType !== "equal" &&
        expressionType !== "notEqual" &&
        expressionType !== "greaterThan" &&
        expressionType !== "lowerThan"
      ) {
        return null;
      }
      const source = condition?.source;
      let normalizedSource: BookletStateCondition["source"] | null = null;
      if (
        source?.type === "Code" ||
        source?.type === "Value" ||
        source?.type === "Status" ||
        source?.type === "Score"
      ) {
        normalizedSource = normalizeVariableSource(source);
      } else if (
        source?.type === "Sum" ||
        source?.type === "Median" ||
        source?.type === "Mean"
      ) {
        const sources = (source.sources ?? []).flatMap(item => {
          const normalized = normalizeVariableSource(item);
          return normalized ? [normalized] : [];
        });
        normalizedSource = { type: source.type, sources };
      } else if (source?.type === "Count") {
        normalizedSource = {
          type: "Count",
          conditions: (source.conditions ?? []).flatMap(item => {
            const normalized = normalizeCondition(item);
            return normalized ? [normalized] : [];
          })
        };
      }
      return normalizedSource
        ? {
            source: normalizedSource,
            expression: {
              type: expressionType,
              value: String(condition.expression.value ?? "")
            }
          }
        : null;
    };
    const stateKeys = new Set<string>();
    const stateEntries = (bookletEntry.stateEntries ?? []).flatMap(stateEntry => {
      const stateKey = normalizeManifestToken(stateEntry.stateKey);
      if (!stateKey || stateKeys.has(stateKey)) {
        return [];
      }
      const optionKeys = new Set<string>();
      const options = (stateEntry.options ?? []).flatMap(option => {
        const optionKey = normalizeManifestToken(option.optionKey);
        if (!optionKey || optionKeys.has(optionKey)) {
          return [];
        }
        optionKeys.add(optionKey);
        return [{
          optionKey,
          displayLabel: normalizeManifestLabel(
            option.displayLabel,
            "Option",
            optionKey
          ),
          conditions: (option.conditions ?? []).flatMap(condition => {
            const normalized = normalizeCondition(condition);
            return normalized ? [normalized] : [];
          })
        }];
      });
      if (options.length === 0) {
        return [];
      }
      stateKeys.add(stateKey);
      return [{
        stateKey,
        displayLabel: normalizeManifestLabel(
          stateEntry.displayLabel,
          "State",
          stateKey
        ),
        options
      }];
    });
    if (stateEntries.length > 0) {
      normalizedBooklet.stateEntries = stateEntries;
    }
    const testletEntriesByKey = new Map(
      (normalizedBooklet.testletEntries ?? []).map(testletEntry => [
        testletEntry.testletKey,
        testletEntry
      ])
    );
    for (const testletEntry of bookletEntry.testletEntries ?? []) {
      const testletKey = normalizeManifestToken(testletEntry.testletKey);
      if (!testletKey || testletEntriesByKey.has(testletKey)) {
        continue;
      }
      const displayLabel = normalizeManifestLabel(
        testletEntry.displayLabel,
        "Block",
        testletKey
      );
      const parentTestletKey = normalizeManifestToken(
        testletEntry.parentTestletKey
      );
      const code = normalizeManifestToken(
        testletEntry.restrictions?.codeToEnter?.code
      );
      const showStateKey = normalizeManifestToken(
        testletEntry.restrictions?.show?.stateKey
      );
      const showOptionKey = normalizeManifestToken(
        testletEntry.restrictions?.show?.optionKey
      );
      const prompt = normalizeUnitContent(
        testletEntry.restrictions?.codeToEnter?.prompt
      );
      const timeMaxMinutes = Number(
        testletEntry.restrictions?.timeMax?.minutes
      );
      const timeMaxLeave = testletEntry.restrictions?.timeMax?.leave;
      const denyPresentation = normalizeLeaveRestriction(
        testletEntry.restrictions?.denyNavigationOnIncomplete?.presentation
      );
      const denyResponse = normalizeLeaveRestriction(
        testletEntry.restrictions?.denyNavigationOnIncomplete?.response
      );
      const restrictions: NonNullable<
        SourcePackageTestletEntry["restrictions"]
      > = {
        ...(showStateKey && showOptionKey
          ? {
              show: {
                stateKey: showStateKey,
                optionKey: showOptionKey
              }
            }
          : {}),
        ...(code
          ? {
              codeToEnter: {
                code,
                prompt: prompt || "Enter the block code."
              }
            }
          : {}),
        ...(Number.isFinite(timeMaxMinutes) && timeMaxMinutes > 0
          ? {
              timeMax: {
                minutes: timeMaxMinutes,
                leave:
                  timeMaxLeave === "forbidden" || timeMaxLeave === "allowed"
                    ? timeMaxLeave
                    : "confirm"
              }
            }
          : {}),
        ...(denyPresentation || denyResponse
          ? {
              denyNavigationOnIncomplete: {
                ...(denyPresentation ? { presentation: denyPresentation } : {}),
                ...(denyResponse ? { response: denyResponse } : {})
              }
            }
          : {}),
        ...(testletEntry.restrictions?.lockAfterLeaving
          ? { lockAfterLeaving: testletEntry.restrictions.lockAfterLeaving }
          : {})
      };
      testletEntriesByKey.set(testletKey, {
        testletKey,
        displayLabel,
        parentTestletKey: parentTestletKey || null,
        ...(Object.keys(restrictions).length > 0 ? { restrictions } : {})
      });
    }
    if (testletEntriesByKey.size > 0) {
      normalizedBooklet.testletEntries = Array.from(testletEntriesByKey.values());
    }
    const unitKeys =
      unitKeysByBookletKey.get(bookletKey) ?? new Set<string>();

    const rawUnitEntries = Array.isArray(bookletEntry.unitEntries)
      ? bookletEntry.unitEntries
      : [];
    for (const unitEntry of rawUnitEntries) {
      const normalizedUnitEntry = normalizeSourcePackageUnitEntry(unitEntry);
      if (!normalizedUnitEntry || unitKeys.has(normalizedUnitEntry.unitKey)) {
        continue;
      }
      normalizedBooklet.unitEntries.push(normalizedUnitEntry);
      unitKeys.add(normalizedUnitEntry.unitKey);
    }

    if (normalizedBooklet.unitEntries.length > 0) {
      bookletEntriesByKey.set(bookletKey, normalizedBooklet);
      unitKeysByBookletKey.set(bookletKey, unitKeys);
    }
  }

  const bookletEntries = Array.from(bookletEntriesByKey.values());

  const systemCheckEntries = Array.from(systemCheckEntriesById.values());
  if (bookletEntries.length === 0 && systemCheckEntries.length === 0) {
    return null;
  }

  const playerEntries = Array.from(playerEntriesByKey.values());
  return {
    bookletEntries,
    ...(playerEntries.length > 0 ? { playerEntries } : {}),
    ...(systemCheckEntries.length > 0 ? { systemCheckEntries } : {})
  };
};

const collectJsonPlayerEntries = (
  parsed: unknown
): NonNullable<SourcePackageContentStructure["playerEntries"]> => {
  const asPlayerObject = (value: unknown): Record<string, unknown> | null =>
    typeof value === "object" && value !== null
      ? (value as Record<string, unknown>)
      : null;
  const root = asPlayerObject(parsed);
  if (!root) {
    return [];
  }
  const rawPlayers = root.playerEntries ?? root.players ?? root.playerResources;
  const entries = Array.isArray(rawPlayers)
    ? rawPlayers.map((value, index) => [String(index), value] as const)
    : Object.entries(asPlayerObject(rawPlayers) ?? {});

  return entries.flatMap(([fallbackKey, rawPlayer]) => {
    if (typeof rawPlayer === "string") {
      return rawPlayer.trim()
        ? [{ playerKey: fallbackKey, html: rawPlayer }]
        : [];
    }
    const player = asPlayerObject(rawPlayer);
    if (!player) {
      return [];
    }
    const playerKey = String(
      player.playerKey ??
        player.playerId ??
        player.identifier ??
        player.key ??
        player.id ??
        fallbackKey
    ).trim();
    const html = normalizeRuntimeDocument(
      player.html ?? player.srcDoc ?? player.sourceDocument ?? player.content
    );
    return playerKey && html ? [{ playerKey, html }] : [];
  });
};

const normalizeParsedJsonContentStructure = (
  parsed: unknown
): ContentReleaseRuntimeSnapshot | null => {
  if (
    !Array.isArray(parsed) &&
    (typeof parsed !== "object" || parsed === null)
  ) {
    return null;
  }

  const asObject = (value: unknown): Record<string, unknown> | null =>
    typeof value === "object" && value !== null && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  const splitManifestListText = (value: string): string[] =>
    value
      .split(/[,\n;]+/)
      .map(item => item.trim())
      .filter(Boolean);
  const readEntries = (...values: unknown[]): unknown[] => {
    for (const value of values) {
      if (Array.isArray(value)) {
        return value;
      }
      if (typeof value === "string") {
        const entries = splitManifestListText(value);
        if (entries.length > 0) {
          return entries;
        }
      }
      if (asObject(value)) {
        return [value];
      }
    }
    return [];
  };
  const hasAnyField = (
    value: Record<string, unknown>,
    candidateNames: string[]
  ): boolean => {
    const normalizedKeys = new Set(
      Object.keys(value).map(key => key.toLowerCase())
    );
    return candidateNames.some(candidateName =>
      normalizedKeys.has(candidateName.toLowerCase())
    );
  };
  const readKeyedMapEntries = (
    value: unknown,
    options: {
      keyFieldName: string;
      listFieldName?: string;
      singleEntryFieldNames: string[];
    }
  ): unknown[] => {
    if (Array.isArray(value)) {
      return value;
    }

    if (typeof value === "string") {
      return splitManifestListText(value);
    }

    const objectValue = asObject(value);
    if (!objectValue) {
      return [];
    }

    if (hasAnyField(objectValue, options.singleEntryFieldNames)) {
      return [objectValue];
    }

    return Object.entries(objectValue).map(([entryKey, entryValue]) => {
      const entryObject = asObject(entryValue);
      if (entryObject) {
        return { [options.keyFieldName]: entryKey, ...entryObject };
      }

      if (Array.isArray(entryValue)) {
        return {
          [options.keyFieldName]: entryKey,
          [options.listFieldName ?? "items"]: entryValue
        };
      }

      if (typeof entryValue === "string") {
        return {
          [options.keyFieldName]: entryKey,
          displayLabel: entryValue
        };
      }

      return { [options.keyFieldName]: entryKey };
    });
  };
  const readBookletEntries = (...values: unknown[]): unknown[] => {
    for (const value of values) {
      const entries = readKeyedMapEntries(value, {
        keyFieldName: "bookletKey",
        listFieldName: "unitEntries",
        singleEntryFieldNames: [
          "bookletKey",
          "bookletId",
          "testletKey",
          "testletId",
          "assessmentTestKey",
          "assessmentTestId",
          "assessmentSectionKey",
          "assessmentSectionId",
          "sectionKey",
          "sectionId",
          "identifier",
          "key",
          "id",
          "alias",
          "code",
          "displayLabel",
          "label",
          "title",
          "name",
          "displayName",
          "unitEntries",
          "units",
          "unitRefs",
          "items",
          "resources",
          "assessmentItemRefs",
          "assessmentItems"
        ]
      });
      if (entries.length > 0) {
        return entries;
      }
    }
    return [];
  };
  const readUnitEntries = (value: unknown): unknown[] =>
    readKeyedMapEntries(value, {
      keyFieldName: "unitKey",
      singleEntryFieldNames: [
        "unitKey",
        "unitId",
        "identifier",
        "key",
        "id",
        "unitRef",
        "ref",
        "identifierref",
        "identifierRef",
        "alias",
        "code",
        "path",
        "src",
        "uri",
        "file",
        "fileName",
        "filename",
        "resourceId",
        "moduleId",
        "taskId",
        "href",
        "name",
        "displayLabel",
        "label",
        "title",
        "displayName",
        "description",
        "summary",
        "instructions",
        "content",
        "prompt",
        "question",
        "body",
        "itemBody",
        "item-body",
        "definition",
        "codingScheme",
        "codingSchemeDefinition",
        "text",
        "stimulus",
        "markdown",
        "html"
      ]
    });
  const readExplicitBookletEntries = (value: Record<string, unknown>): unknown[] =>
    readBookletEntries(
      value.bookletEntries,
      value.booklets,
      value.testlets,
      value.booklet,
      value.testlet
    );
  const readAssessmentTestEntries = (value: Record<string, unknown>): unknown[] =>
    readBookletEntries(
      value.assessmentTests,
      value.assessmentTest,
      value["assessment-tests"],
      value["assessment-test"]
    );
  const readAssessmentSectionEntries = (
    value: Record<string, unknown>
  ): unknown[] =>
    readBookletEntries(
      value.assessmentSections,
      value.assessmentSection,
      value["assessment-sections"],
      value["assessment-section"],
      value.sections,
      value.section
    );
  const readStringValue = (
    value: Record<string, unknown>,
    ...candidateNames: string[]
  ): string => {
    for (const candidateName of candidateNames) {
      const candidateValue = value[candidateName];
      if (candidateValue !== undefined) {
        return normalizeManifestToken(candidateValue);
      }
    }

    const normalizedEntries = Object.entries(value).map(([key, entryValue]) => [
      key.toLowerCase(),
      entryValue
    ] as const);
    for (const candidateName of candidateNames) {
      const normalizedName = candidateName.toLowerCase();
      const match = normalizedEntries.find(([key]) => key === normalizedName);
      if (match) {
        return normalizeManifestToken(match[1]);
      }
    }

    return "";
  };
  const readStringRecord = (value: unknown): Record<string, string> => {
    const record = asObject(value);
    if (!record) {
      return {};
    }
    return Object.fromEntries(
      Object.entries(record).flatMap(([key, entryValue]) =>
        typeof entryValue === "string" && key.trim()
          ? [[key.trim(), entryValue.trim()] as const]
          : []
      )
    );
  };
  type JsonManifestResource = {
    key: string;
    displayLabel: string;
    dependencyReferences: string[];
  };
  const readResourceEntries = (value: unknown): unknown[] =>
    readKeyedMapEntries(value, {
      keyFieldName: "identifier",
      listFieldName: "files",
      singleEntryFieldNames: [
        "identifier",
        "id",
        "key",
        "resourceId",
        "resourceIdentifier",
        "href",
        "path",
        "src",
        "uri",
        "file",
        "fileName",
        "filename",
        "files",
        "dependencies",
        "dependency",
        "dependencyReferences",
        "dependencyReference",
        "displayLabel",
        "label",
        "title",
        "name",
        "displayName"
      ]
    });
  const readOrganizationEntries = (value: unknown): unknown[] =>
    readKeyedMapEntries(value, {
      keyFieldName: "identifier",
      listFieldName: "items",
      singleEntryFieldNames: [
        "identifier",
        "id",
        "key",
        "items",
        "item",
        "children",
        "childItems",
        "displayLabel",
        "label",
        "title",
        "name",
        "displayName"
      ]
    });
  const readDependencyEntries = (value: unknown): unknown[] =>
    readKeyedMapEntries(value, {
      keyFieldName: "identifierref",
      singleEntryFieldNames: [
        "identifierref",
        "identifierRef",
        "ref",
        "resourceId",
        "resourceIdentifier",
        "identifier",
        "id",
        "key"
      ]
    });
  const collectJsonManifestResources = (
    value: unknown
  ): Map<string, JsonManifestResource> => {
    const resources = new Map<string, JsonManifestResource>();
    const visit = (candidate: unknown, inheritedBasePath = ""): void => {
      if (Array.isArray(candidate)) {
        candidate.forEach(item => visit(item, inheritedBasePath));
        return;
      }

      const objectValue = asObject(candidate);
      if (!objectValue) {
        return;
      }
      const manifestBasePath = resolveXmlManifestPath(
        inheritedBasePath,
        readStringValue(objectValue, "xml:base", "base")
      );

      for (const rawResource of [
        ...readResourceEntries(objectValue.resources),
        ...readResourceEntries(objectValue.resource)
      ]) {
        const resource = asObject(rawResource);
        if (!resource) {
          continue;
        }

        const identifier = readStringValue(
          resource,
          "identifier",
          "id",
          "key",
          "resourceId",
          "resourceIdentifier"
        );
        if (!identifier) {
          continue;
        }

        const fileCandidates = readEntries(resource.files, resource.file);
        const firstFile =
          fileCandidates.find(file => typeof file === "string" || asObject(file)) ??
          null;
        const firstFileObject = asObject(firstFile);
        const fileKey =
          typeof firstFile === "string"
            ? normalizeManifestToken(firstFile)
            : firstFileObject
              ? readStringValue(
                  firstFileObject,
                  "href",
                  "path",
                  "src",
                  "uri",
                  "fileName",
                  "filename",
                  "name"
                )
              : "";
        const rawKey =
          readStringValue(
            resource,
            "href",
            "path",
            "src",
            "uri",
            "file",
            "fileName",
            "filename"
          ) ||
          fileKey ||
          identifier;
        const resourceBasePath = readStringValue(resource, "xml:base", "base");
        const fileBasePath = firstFileObject
          ? readStringValue(firstFileObject, "xml:base", "base")
          : "";
        const key = resolveXmlManifestPath(
          manifestBasePath,
          resourceBasePath,
          fileBasePath,
          rawKey
        );
        const displayLabel = normalizeManifestLabel(
          readStringValue(
            resource,
            "displayLabel",
            "label",
            "title",
            "name",
            "displayName"
          ),
          "Resource",
          key
        );
        const dependencyReferences = [
          ...readDependencyEntries(resource.dependencies),
          ...readDependencyEntries(resource.dependency),
          ...readDependencyEntries(resource.dependencyReferences),
          ...readDependencyEntries(resource.dependencyReference)
        ]
          .map(rawDependency => {
            if (typeof rawDependency === "string") {
              return normalizeManifestToken(rawDependency);
            }

            const dependency = asObject(rawDependency);
            if (!dependency) {
              return "";
            }

            return readStringValue(
              dependency,
              "identifierref",
              "identifierRef",
              "ref",
              "resourceId",
              "resourceIdentifier",
              "identifier",
              "id"
            );
          })
          .filter((dependencyReference): dependencyReference is string =>
            Boolean(dependencyReference)
          );

        resources.set(identifier, { key, displayLabel, dependencyReferences });
      }

      for (const container of readNestedManifestContainers(objectValue)) {
        visit(container, manifestBasePath);
      }
    };

    visit(value);
    return resources;
  };
  const readJsonOrganizationItems = (
    value: Record<string, unknown>
  ): unknown[] => {
    const items: unknown[] = [];
    const defaultOrganizationKey = readStringValue(
      value,
      "defaultOrganization",
      "defaultOrganisation",
      "defaultOrganizationId",
      "defaultOrganisationId",
      "defaultOrg",
      "default"
    );
    const organizationEntries = [
      ...readOrganizationEntries(value.organizations),
      ...readOrganizationEntries(value.organization),
      ...readOrganizationEntries(value.orgs),
      ...readOrganizationEntries(value.org)
    ];
    const selectedOrganizationEntries = defaultOrganizationKey
      ? organizationEntries.filter(organization => {
          const organizationObject = asObject(organization);
          return (
            organizationObject &&
            readStringValue(
              organizationObject,
              "identifier",
              "id",
              "key",
              "organizationId",
              "organisationId"
            ) === defaultOrganizationKey
          );
        })
      : [];

    for (const organization of selectedOrganizationEntries.length > 0
      ? selectedOrganizationEntries
      : organizationEntries) {
      const organizationObject = asObject(organization);
      if (organizationObject) {
        items.push(...readEntries(organizationObject.items, organizationObject.item));
      }
    }
    items.push(...readEntries(value.organizationItems, value.organizationItem));
    return items;
  };
  const collectJsonOrganizationItems = (value: unknown): unknown[] => {
    if (Array.isArray(value)) {
      return value.flatMap(item => collectJsonOrganizationItems(item));
    }

    const objectValue = asObject(value);
    if (!objectValue) {
      return [];
    }

    const directItems = readJsonOrganizationItems(objectValue);
    if (directItems.length > 0) {
      return directItems;
    }

    return readNestedManifestContainers(objectValue).flatMap(container =>
      collectJsonOrganizationItems(container)
    );
  };
  const collectJsonOrganizationBookletEntries = (
    value: unknown
  ): SourcePackageContentStructure["bookletEntries"] => {
    const resources = collectJsonManifestResources(value);
    if (resources.size === 0) {
      return [];
    }

    return collectJsonOrganizationItems(value)
      .map(rawItem => {
        const item = asObject(rawItem);
        if (!item) {
          return null;
        }

        const bookletReference = readStringValue(
          item,
          "identifierref",
          "identifierRef",
          "ref",
          "resourceId",
          "resourceIdentifier"
        );
        const bookletResource = resources.get(bookletReference);
        const rawUnitItems = readEntries(
          item.items,
          item.item,
          item.children,
          item.childItems
        );
        if (!bookletReference || !bookletResource || rawUnitItems.length === 0) {
          return null;
        }

        return {
          bookletKey: bookletResource.key,
          displayLabel: normalizeManifestLabel(
            readStringValue(
              item,
              "displayLabel",
              "label",
              "title",
              "name",
              "displayName"
            ) || bookletResource.displayLabel,
            "Booklet",
            bookletResource.key
          ),
          unitEntries: rawUnitItems
            .map(rawUnitItem => {
              const unitItem = asObject(rawUnitItem);
              if (!unitItem) {
                return null;
              }

              const unitReference = readStringValue(
                unitItem,
                "identifierref",
                "identifierRef",
                "ref",
                "resourceId",
                "resourceIdentifier"
              );
              const unitResource = resources.get(unitReference);
              if (!unitReference || !unitResource) {
                return null;
              }

              return {
                unitKey: unitResource.key,
                displayLabel: normalizeManifestLabel(
                  readStringValue(
                    unitItem,
                    "displayLabel",
                    "label",
                    "title",
                    "name",
                    "displayName"
                  ) || unitResource.displayLabel,
                  "Unit",
                  unitResource.key
                )
              };
            })
            .filter(Boolean) as SourcePackageContentStructure["bookletEntries"][number]["unitEntries"]
        };
      })
      .filter(Boolean) as SourcePackageContentStructure["bookletEntries"];
  };
  const collectJsonResourceDependencyBookletEntries = (
    value: unknown
  ): SourcePackageContentStructure["bookletEntries"] => {
    const resources = collectJsonManifestResources(value);
    if (resources.size === 0) {
      return [];
    }

    return [...resources.values()]
      .map(resource => {
        const unitEntries = resource.dependencyReferences
          .map(dependencyReference => resources.get(dependencyReference))
          .filter(
            (dependencyResource): dependencyResource is JsonManifestResource =>
              Boolean(dependencyResource)
          )
          .map(dependencyResource => ({
            unitKey: dependencyResource.key,
            displayLabel: dependencyResource.displayLabel
          }));

        if (unitEntries.length === 0) {
          return null;
        }

        return {
          bookletKey: resource.key,
          displayLabel: resource.displayLabel,
          unitEntries
        };
      })
      .filter(Boolean) as SourcePackageContentStructure["bookletEntries"];
  };
  const readNestedManifestContainers = (
    value: Record<string, unknown>
  ): unknown[] =>
    readEntries(
      value.contentStructure,
      value.manifest,
      value.assessment,
      value.assessments,
      value.testcenter,
      value.packageManifest,
      value.contentPackage,
      value.package,
      value.packages,
      value.tests,
      value.test,
      value.testSuites,
      value.testSuite
    );
  const collectBookletEntries = (value: unknown, isRoot = false): unknown[] => {
    if (Array.isArray(value)) {
      if (isRoot) {
        return value;
      }
      return value.flatMap(item => collectBookletEntries(item));
    }

    const objectValue = asObject(value);
    if (!objectValue) {
      return [];
    }

    const explicitBooklets = readExplicitBookletEntries(objectValue);
    const assessmentTests = readAssessmentTestEntries(objectValue);
    if (explicitBooklets.length > 0) {
      return [...explicitBooklets, ...assessmentTests];
    }

    const assessmentSections = readAssessmentSectionEntries(objectValue);
    if (assessmentSections.length > 0) {
      return assessmentSections;
    }

    if (assessmentTests.length > 0) {
      const sectionBooklets = assessmentTests.flatMap(assessmentTest =>
        collectBookletEntries(assessmentTest)
      );
      return sectionBooklets.length > 0 ? sectionBooklets : assessmentTests;
    }

    return readNestedManifestContainers(objectValue).flatMap(container =>
      collectBookletEntries(container)
    );
  };

  const rawBooklets = collectBookletEntries(parsed, true);
  if (rawBooklets.length === 0) {
    const organizationBookletEntries =
      collectJsonOrganizationBookletEntries(parsed);
    if (organizationBookletEntries.length > 0) {
      return normalizeContentStructure({
        bookletEntries: organizationBookletEntries
      });
    }

    const dependencyBookletEntries =
      collectJsonResourceDependencyBookletEntries(parsed);
    if (dependencyBookletEntries.length > 0) {
      return normalizeContentStructure({
        bookletEntries: dependencyBookletEntries
      });
    }

    return null;
  }

  const contentStructure: SourcePackageContentStructure = {
    playerEntries: collectJsonPlayerEntries(parsed),
    bookletEntries: rawBooklets
      .map(rawBooklet => {
        if (typeof rawBooklet !== "object" || rawBooklet === null) {
          return null;
        }

        const booklet = rawBooklet as Record<string, unknown>;
        const rawUnits = [
          ...readUnitEntries(booklet.unitEntries),
          ...readUnitEntries(booklet.units),
          ...readUnitEntries(booklet.unitRefs),
          ...readUnitEntries(booklet.unitReferences),
          ...readUnitEntries(booklet.unitFiles),
          ...readUnitEntries(booklet.items),
          ...readUnitEntries(booklet.resources),
          ...readUnitEntries(booklet.files),
          ...readUnitEntries(booklet.modules),
          ...readUnitEntries(booklet.tasks),
          ...readUnitEntries(booklet.assessmentItemRefs),
          ...readUnitEntries(booklet.assessmentItemRef),
          ...readUnitEntries(booklet.assessmentItems),
          ...readUnitEntries(booklet.assessmentItem),
          ...readUnitEntries(booklet["assessment-items"]),
          ...readUnitEntries(booklet["assessment-item"]),
          ...readUnitEntries(booklet["assessment-item-refs"]),
          ...readUnitEntries(booklet["assessment-item-ref"]),
          ...readUnitEntries(booklet.itemRefs),
          ...readUnitEntries(booklet.itemRef),
          ...readUnitEntries(booklet["item-refs"]),
          ...readUnitEntries(booklet["item-ref"]),
          ...readUnitEntries(booklet.unit),
          ...readUnitEntries(booklet.unitRef),
          ...readUnitEntries(booklet.unitReference),
          ...readUnitEntries(booklet.unitFile),
          ...readUnitEntries(booklet.item),
          ...readUnitEntries(booklet.resource),
          ...readUnitEntries(booklet.file),
          ...readUnitEntries(booklet.module),
          ...readUnitEntries(booklet.task)
        ];

        return {
          bookletKey: String(
            booklet.bookletKey ??
              booklet.bookletId ??
              booklet.testletKey ??
              booklet.testletId ??
              booklet.assessmentTestKey ??
              booklet.assessmentTestId ??
              booklet.assessmentSectionKey ??
              booklet.assessmentSectionId ??
              booklet.sectionKey ??
              booklet.sectionId ??
              booklet.identifier ??
              booklet.key ??
              booklet.id ??
              booklet.alias ??
              booklet.code ??
              booklet.name ??
              booklet.title ??
              ""
          ).trim(),
          displayLabel: String(
            booklet.displayLabel ??
              booklet.label ??
              booklet.title ??
              booklet.name ??
              booklet.displayName ??
              ""
          ).trim(),
          customTexts: readStringRecord(
            booklet.customTexts ?? booklet.CustomTexts
          ),
          config: readBookletConfigValues(
            booklet.bookletConfig ??
              booklet.BookletConfig ??
              booklet.config ??
              booklet.settings
          ),
          ...(Array.isArray(booklet.stateEntries)
            ? {
                stateEntries:
                  booklet.stateEntries as SourcePackageBookletStateEntry[]
              }
            : {}),
          ...(Array.isArray(booklet.testletEntries)
            ? {
                testletEntries:
                  booklet.testletEntries as SourcePackageTestletEntry[]
              }
            : {}),
          unitEntries: rawUnits
            .map(rawUnit => {
              if (typeof rawUnit === "string") {
                return {
                  unitKey: rawUnit.trim(),
                  displayLabel: ""
                };
              }

              if (typeof rawUnit !== "object" || rawUnit === null) {
                return null;
              }

              const unit = rawUnit as Record<string, unknown>;
              const description = normalizeUnitContent(
                unit.description ?? unit.summary ?? unit.instructions
              );
              const content = normalizeUnitContent(
                unit.content ??
                  unit.prompt ??
                  unit.question ??
                  unit.body ??
                  unit.itemBody ??
                  unit["item-body"] ??
                  unit.definition ??
                  unit.Definition ??
                  unit.text ??
                  unit.stimulus ??
                  unit.markdown ??
                  unit.html
              );
              const playerKey = String(
                unit.playerKey ??
                  unit.playerId ??
                  unit.player ??
                  unit.playerRef ??
                  unit.playerReference ??
                  ""
              ).trim();
              const unitDefinition = normalizeRuntimeDocument(
                unit.unitDefinition ??
                  unit.definitionDocument ??
                  unit.definitionContent
              );
              const unitDefinitionType = String(
                unit.unitDefinitionType ??
                  unit.definitionType ??
                  unit.playerType ??
                  playerKey
              ).trim();
              const codingScheme = normalizeUnitCodingScheme(
                unit.codingScheme ??
                  unit.codingSchemeDefinition ??
                  unit.scheme
              );
              const testletPath = Array.isArray(unit.testletPath)
                ? unit.testletPath
                    .map(testletKey => String(testletKey).trim())
                    .filter(Boolean)
                : [];
              const unitKey = String(
                unit.unitKey ??
                  unit.unitId ??
                  unit.identifier ??
                  unit.key ??
                  unit.id ??
                  unit.unitRef ??
                  unit.ref ??
                  unit.identifierref ??
                  unit.identifierRef ??
                  unit.alias ??
                  unit.code ??
                  unit.path ??
                  unit.src ??
                  unit.uri ??
                  unit.file ??
                  unit.fileName ??
                  unit.filename ??
                  unit.resourceId ??
                  unit.moduleId ??
                  unit.taskId ??
                  unit.href ??
                  unit.name ??
                  ""
              ).trim();
              const originalUnitId = String(
                unit.originalUnitId ??
                  unit.originalUnitKey ??
                  unit.unitId ??
                  unit.id ??
                  ""
              ).trim();
              return {
                unitKey,
                ...(originalUnitId && originalUnitId !== unitKey
                  ? { originalUnitId }
                  : {}),
                displayLabel: String(
                  unit.displayLabel ??
                    unit.label ??
                    unit.title ??
                    unit.name ??
                    unit.displayName ??
                    ""
                ).trim(),
                ...(testletPath.length > 0 ? { testletPath } : {}),
                ...(description ? { description } : {}),
                ...(content ? { content } : {}),
                ...(playerKey ? { playerKey } : {}),
                ...(unitDefinition ? { unitDefinition } : {}),
                ...(unitDefinitionType ? { unitDefinitionType } : {}),
                ...(codingScheme ? { codingScheme } : {})
              };
            })
            .filter(Boolean) as SourcePackageContentStructure["bookletEntries"][number]["unitEntries"]
        };
      })
      .filter(Boolean) as SourcePackageContentStructure["bookletEntries"]
  };

  return normalizeContentStructure(contentStructure);
};

const decodeXmlAttributeValue = (value: string): string =>
  value
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");

const decodeXmlTextContent = (value: string): string =>
  decodeXmlAttributeValue(
    value
      .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
  );

const parseXmlAttributes = (rawAttributes: string): Record<string, string> => {
  const attributes: Record<string, string> = {};

  for (const match of rawAttributes.matchAll(
    /([a-zA-Z_:][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/g
  )) {
    attributes[match[1]] = decodeXmlAttributeValue(match[2] ?? match[3] ?? "");
  }

  return attributes;
};

const readXmlAttribute = (
  attributes: Record<string, string>,
  ...candidateNames: string[]
): string | undefined => {
  for (const candidateName of candidateNames) {
    const exactValue = attributes[candidateName];
    if (exactValue !== undefined) {
      return exactValue;
    }
  }

  const normalizedEntries = Object.entries(attributes).map(([key, value]) => [
    key.toLowerCase(),
    value
  ]);
  for (const candidateName of candidateNames) {
    const normalizedName = candidateName.toLowerCase();
    const match = normalizedEntries.find(([key]) => {
      const localName = key.split(":").at(-1) ?? key;
      return key === normalizedName || localName === normalizedName;
    });
    if (match) {
      return match[1];
    }
  }

  return undefined;
};

const readXmlChildText = (
  content: string,
  ...candidateTagNames: string[]
): string | undefined => {
  for (const tagName of candidateTagNames) {
    const match = content.match(
      new RegExp(
        `<((?:[a-zA-Z_][\\w.-]*:)?${tagName})\\b[^>]*>([\\s\\S]*?)<\\/\\1>`,
        "i"
      )
    );
    const value =
      match?.[2] === undefined ? undefined : decodeXmlTextContent(match[2]);
    if (value) {
      return value;
    }
  }
  return undefined;
};

const xmlElementLocalName = (element: XmlElement): string =>
  element.localName || element.nodeName.split(":").at(-1) || element.nodeName;

const xmlChildElements = (element: XmlElement): XmlElement[] => {
  const children: XmlElement[] = [];
  for (let index = 0; index < element.childNodes.length; index += 1) {
    const child = element.childNodes.item(index);
    if (child?.nodeType === 1) {
      children.push(child as XmlElement);
    }
  }
  return children;
};

const xmlChildrenNamed = (element: XmlElement, name: string): XmlElement[] =>
  xmlChildElements(element).filter(child => xmlElementLocalName(child) === name);

const xmlUnsupportedAttributeNames = (
  element: XmlElement,
  allowedAttributeNames: ReadonlySet<string>
): string[] => {
  const unsupportedAttributeNames: string[] = [];
  for (let index = 0; index < element.attributes.length; index += 1) {
    const attribute = element.attributes.item(index);
    if (
      !attribute ||
      attribute.name === "xmlns" ||
      attribute.name.startsWith("xmlns:")
    ) {
      continue;
    }
    if (!allowedAttributeNames.has(attribute.name)) {
      unsupportedAttributeNames.push(attribute.name);
    }
  }
  return unsupportedAttributeNames;
};

const xmlUnsupportedTestcenterRootAttributeNames = (
  element: XmlElement
): string[] => {
  const unsupportedAttributeNames: string[] = [];
  for (let index = 0; index < element.attributes.length; index += 1) {
    const attribute = element.attributes.item(index);
    if (
      !attribute ||
      attribute.name === "xmlns" ||
      attribute.name.startsWith("xmlns:") ||
      (attribute.namespaceURI ===
        "http://www.w3.org/2001/XMLSchema-instance" &&
        attribute.localName === "noNamespaceSchemaLocation")
    ) {
      continue;
    }
    unsupportedAttributeNames.push(attribute.name);
  }
  return unsupportedAttributeNames;
};

const xmlFirstUnsupportedTestcenterElementNamespace = (
  root: XmlElement,
  canonicalRootName: string
): XmlElement | undefined => {
  const findUnsupportedElement = (
    element: XmlElement,
    insideUntypedUnitPayload: boolean
  ): XmlElement | undefined => {
    for (const child of xmlChildElements(element)) {
      if (child.namespaceURI && !insideUntypedUnitPayload) {
        return child;
      }
      const childName = xmlElementLocalName(child);
      const parentName = xmlElementLocalName(element);
      const childStartsUntypedUnitPayload =
        canonicalRootName === "Unit" &&
        !child.namespaceURI &&
        ((parentName === "Value" && ["label", "value"].includes(childName)) ||
          (parentName === "ValuePositionLabels" &&
            childName === "ValuePositionLabel"));
      const unsupportedDescendant = findUnsupportedElement(
        child,
        insideUntypedUnitPayload || childStartsUntypedUnitPayload
      );
      if (unsupportedDescendant) {
        return unsupportedDescendant;
      }
    }
    return undefined;
  };
  return findUnsupportedElement(root, false);
};

const xmlDescendantsNamed = (element: XmlElement, name: string): XmlElement[] => {
  const matches: XmlElement[] = [];
  const descendants = element.getElementsByTagName("*");
  for (let index = 0; index < descendants.length; index += 1) {
    const descendant = descendants.item(index);
    if (descendant && xmlElementLocalName(descendant) === name) {
      matches.push(descendant);
    }
  }
  return matches;
};

const xmlElementText = (element: XmlElement | undefined): string =>
  String(element?.textContent ?? "").trim();

const parseTestcenterXmlBoolean = (value: string | null): boolean | null => {
  switch (value?.trim()) {
    case "true":
    case "1":
      return true;
    case "false":
    case "0":
      return false;
    default:
      return null;
  }
};

const isTestcenterXmlNumber = (value: string): boolean =>
  /^[+-]?(?:(?:\d+(?:\.\d*)?)|(?:\.\d+))(?:[eE][+-]?\d+)?$/.test(
    value.trim()
  );

const isPositiveTestcenterXmlNumber = (value: string): boolean =>
  isTestcenterXmlNumber(value) && Number(value) > 0;

const isTestcenterXmlInteger = (value: string): boolean =>
  /^[+-]?\d+$/.test(value.trim());

const isTestcenterXmlDateTime = (value: string): boolean => {
  const match = value.trim().match(
    /^(-?\d{4,})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2}(?:\.\d+)?)(?:(Z)|([+-])(\d{2}):(\d{2}))?$/
  );
  if (!match) {
    return false;
  }
  const year = Number(match[1]);
  const month = Number(match[2]);
  const day = Number(match[3]);
  const hour = Number(match[4]);
  const minute = Number(match[5]);
  const second = Number(match[6]);
  const timezoneHour = Number(match[9] ?? 0);
  const timezoneMinute = Number(match[10] ?? 0);
  if (
    year === 0 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    hour > 24 ||
    minute > 59 ||
    second >= 60 ||
    timezoneHour > 14 ||
    timezoneMinute > 59 ||
    (timezoneHour === 14 && timezoneMinute !== 0) ||
    (hour === 24 && (minute !== 0 || second !== 0))
  ) {
    return false;
  }
  const leapYear = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const daysInMonth = [
    31,
    leapYear ? 29 : 28,
    31,
    30,
    31,
    30,
    31,
    31,
    30,
    31,
    30,
    31
  ];
  return day <= daysInMonth[month - 1]!;
};

const parseTestcenterSchemaVersion = (
  schemaLocation: string
): { major: number; minor: number } | null => {
  const match = schemaLocation.match(
    /(?:^|\/)(\d+)\.(\d+)(?:\.\d+)?\/definitions\//i
  );
  if (!match) {
    return null;
  }
  return {
    major: Number(match[1]),
    minor: Number(match[2])
  };
};

const validateUniqueTestcenterXmlValues = (
  values: Array<{ value: string; label: string }>,
  code: string,
  sourceFileName: string
): ImportJobDiagnostic[] => {
  const seen = new Set<string>();
  const diagnostics: ImportJobDiagnostic[] = [];
  for (const item of values) {
    if (!item.value || !seen.has(item.value)) {
      if (item.value) {
        seen.add(item.value);
      }
      continue;
    }
    diagnostics.push(
      createImportDiagnostic(
        code,
        `Original Testcenter XML '${sourceFileName}' contains duplicate ${item.label} '${item.value}'.`
      )
    );
  }
  return diagnostics;
};

const testcenterXmlIdPattern =
  /^[_A-Za-z\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u02FF\u0370-\u037D\u037F-\u1FFF\u200C-\u200D\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u{10000}-\u{EFFFF}][-._A-Za-z0-9\u00B7\u00C0-\u00D6\u00D8-\u00F6\u00F8-\u037D\u037F-\u1FFF\u200C-\u200D\u203F-\u2040\u2070-\u218F\u2C00-\u2FEF\u3001-\uD7FF\uF900-\uFDCF\uFDF0-\uFFFD\u0300-\u036F\u{10000}-\u{EFFFF}]*$/u;

const isTestcenterXmlId = (value: string): boolean =>
  testcenterXmlIdPattern.test(value);

const testcenterBookletStateIdPattern = /^[a-z\d-]+$/;

const testcenterBookletVariableSourceNames = [
  "Code",
  "Value",
  "Status",
  "Score"
] as const;

const validateTestcenterBookletCondition = (
  condition: XmlElement,
  sourceFileName: string,
  stateKey: string,
  optionKey: string
): ImportJobDiagnostic[] => {
  const diagnostics: ImportJobDiagnostic[] = [];
  const context = `Option '${optionKey || "unknown"}' in State '${stateKey || "unknown"}'`;
  const validateAttributes = (
    element: XmlElement,
    allowedAttributeNames: readonly string[],
    elementContext: string
  ): void => {
    for (const attributeName of xmlUnsupportedAttributeNames(
      element,
      new Set(allowedAttributeNames)
    )) {
      diagnostics.push(
        createImportDiagnostic(
          "testcenter_xml_booklet_attribute_invalid",
          `Original Testcenter booklet '${sourceFileName}' contains unsupported attribute '${attributeName}' on ${elementContext} for ${context}.`
        )
      );
    }
  };
  validateAttributes(condition, [], "If");
  const children = xmlChildElements(condition);
  const sourceNames = [
    ...testcenterBookletVariableSourceNames,
    "Sum",
    "Median",
    "Mean",
    "Count"
  ];
  const sourceElements = children.filter(child =>
    sourceNames.includes(xmlElementLocalName(child) as typeof sourceNames[number])
  );
  const expressionElements = children.filter(
    child => xmlElementLocalName(child) === "Is"
  );
  const sourceElement = sourceElements[0];
  const expressionElement = expressionElements[0];
  if (
    children.length !== 2 ||
    sourceElements.length !== 1 ||
    expressionElements.length !== 1 ||
    children[0] !== sourceElement ||
    children[1] !== expressionElement
  ) {
    diagnostics.push(
      createImportDiagnostic(
        "testcenter_xml_state_condition_structure_invalid",
        `Original Testcenter booklet '${sourceFileName}' contains an invalid If structure for ${context}; exactly one source followed by one Is expression is required.`
      )
    );
  }

  const validateVariableSource = (variableSource: XmlElement): void => {
    const sourceName = xmlElementLocalName(variableSource);
    validateAttributes(
      variableSource,
      sourceName === "Score" ? ["of", "from", "or"] : ["of", "from"],
      sourceName
    );
    if (xmlChildElements(variableSource).length > 0) {
      diagnostics.push(
        createImportDiagnostic(
          "testcenter_xml_state_condition_structure_invalid",
          `Original Testcenter booklet '${sourceFileName}' contains nested elements in ${sourceName} for ${context}.`
        )
      );
    }
    const variableKey = variableSource.getAttribute("of")?.trim() ?? "";
    const unitKey = variableSource.getAttribute("from")?.trim() ?? "";
    if (!variableKey || !unitKey) {
      diagnostics.push(
        createImportDiagnostic(
          "testcenter_xml_state_condition_variable_reference_invalid",
          `Original Testcenter booklet '${sourceFileName}' contains a ${xmlElementLocalName(variableSource)} source without both 'of' and 'from' for ${context}.`
        )
      );
    }
    const defaultValue = variableSource.getAttribute("or");
    if (defaultValue !== null && !isTestcenterXmlNumber(defaultValue)) {
      diagnostics.push(
        createImportDiagnostic(
          "testcenter_xml_state_condition_number_invalid",
          `Original Testcenter booklet '${sourceFileName}' contains invalid numeric fallback '${defaultValue}' for ${context}.`
        )
      );
    }
  };

  if (sourceElement) {
    const sourceName = xmlElementLocalName(sourceElement);
    if ((testcenterBookletVariableSourceNames as readonly string[]).includes(sourceName)) {
      validateVariableSource(sourceElement);
    } else if (["Sum", "Median", "Mean"].includes(sourceName)) {
      validateAttributes(sourceElement, [], sourceName);
      const aggregateSources = xmlChildElements(sourceElement);
      const aggregateSourceNames = new Set(
        aggregateSources.map(xmlElementLocalName)
      );
      if (
        aggregateSources.length < 2 ||
        aggregateSourceNames.size !== 1 ||
        !aggregateSources.every(source =>
          (testcenterBookletVariableSourceNames as readonly string[]).includes(
            xmlElementLocalName(source)
          )
        )
      ) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_state_condition_aggregation_invalid",
            `Original Testcenter booklet '${sourceFileName}' requires ${sourceName} in ${context} to contain at least two variable sources of one type.`
          )
        );
      }
      aggregateSources
        .filter(source =>
          (testcenterBookletVariableSourceNames as readonly string[]).includes(
            xmlElementLocalName(source)
          )
        )
        .forEach(validateVariableSource);
    } else if (sourceName === "Count") {
      validateAttributes(sourceElement, [], sourceName);
      const nestedChildren = xmlChildElements(sourceElement);
      if (
        nestedChildren.length < 2 ||
        nestedChildren.some(child => xmlElementLocalName(child) !== "If")
      ) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_state_condition_aggregation_invalid",
            `Original Testcenter booklet '${sourceFileName}' requires Count in ${context} to contain at least two If conditions.`
          )
        );
      }
      for (const nestedCondition of nestedChildren.filter(
        child => xmlElementLocalName(child) === "If"
      )) {
        diagnostics.push(
          ...validateTestcenterBookletCondition(
            nestedCondition,
            sourceFileName,
            stateKey,
            optionKey
          )
        );
      }
    }
  }

  if (expressionElement) {
    const comparisonNames = [
      "equal",
      "notEqual",
      "greaterThan",
      "lowerThan"
    ] as const;
    validateAttributes(expressionElement, comparisonNames, "Is");
    if (xmlChildElements(expressionElement).length > 0) {
      diagnostics.push(
        createImportDiagnostic(
          "testcenter_xml_state_condition_structure_invalid",
          `Original Testcenter booklet '${sourceFileName}' contains nested elements in Is for ${context}.`
        )
      );
    }
    const presentComparisons = comparisonNames.filter(
      comparisonName => expressionElement.getAttribute(comparisonName) !== null
    );
    if (presentComparisons.length === 0) {
      diagnostics.push(
        createImportDiagnostic(
          "testcenter_xml_state_condition_expression_invalid",
          `Original Testcenter booklet '${sourceFileName}' contains an Is expression without a comparison for ${context}.`
        )
      );
    }
    for (const comparisonName of ["greaterThan", "lowerThan"] as const) {
      const comparisonValue = expressionElement.getAttribute(comparisonName);
      if (
        comparisonValue !== null &&
        !isTestcenterXmlNumber(comparisonValue)
      ) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_state_condition_number_invalid",
            `Original Testcenter booklet '${sourceFileName}' contains invalid numeric comparison '${comparisonValue}' for ${context}.`
          )
        );
      }
    }
  }
  return diagnostics;
};

const validateTestcenterXmlSourceDocument = (
  sourceDocument: string,
  sourceFileName: string
): ImportJobDiagnostic[] => {
  if (/<!DOCTYPE\b/i.test(sourceDocument)) {
    return [
      createImportDiagnostic(
        "source_document_xml_doctype_unsupported",
        `Source package '${sourceFileName}' contains a DOCTYPE declaration, which is not accepted for import.`
      )
    ];
  }

  const parserErrors: string[] = [];
  let document: XmlDocument | null = null;
  try {
    document = new DOMParser({
      onError(level, message) {
        parserErrors.push(`${level}: ${message}`);
      }
    }).parseFromString(sourceDocument, "application/xml");
  } catch (error) {
    parserErrors.push(error instanceof Error ? error.message : String(error));
  }

  if (parserErrors.length > 0 || !document?.documentElement) {
    return [
      createImportDiagnostic(
        "source_document_xml_malformed",
        `Source package '${sourceFileName}' contained malformed XML${
          parserErrors[0] ? `: ${parserErrors[0]}` : "."
        }`
      )
    ];
  }

  const root = document.documentElement;
  const rootName = xmlElementLocalName(root);
  const canonicalRootName = ["Booklet", "Unit", "Testtakers", "SysCheck"].find(
    candidate => candidate.toLowerCase() === rootName.toLowerCase()
  );
  if (!canonicalRootName) {
    return [];
  }

  const schemaLocation =
    root.getAttributeNS(
      "http://www.w3.org/2001/XMLSchema-instance",
      "noNamespaceSchemaLocation"
    ) || root.getAttribute("xsi:noNamespaceSchemaLocation");
  if (!schemaLocation) {
    return [];
  }

  const diagnostics: ImportJobDiagnostic[] = [];
  if (rootName !== canonicalRootName) {
    diagnostics.push(
      createImportDiagnostic(
        "testcenter_xml_root_invalid",
        `Original Testcenter XML '${sourceFileName}' must use root element '${canonicalRootName}' with matching case.`
      )
    );
  }
  if (root.namespaceURI) {
    diagnostics.push(
      createImportDiagnostic(
        "testcenter_xml_root_namespace_invalid",
        `Original Testcenter XML '${sourceFileName}' must use root element '${canonicalRootName}' without a namespace, but found '${root.namespaceURI}'.`
      )
    );
  }
  const namespacedSchemaElement = root.namespaceURI
    ? undefined
    : xmlFirstUnsupportedTestcenterElementNamespace(root, canonicalRootName);
  if (namespacedSchemaElement) {
    diagnostics.push(
      createImportDiagnostic(
        "testcenter_xml_element_namespace_invalid",
        `Original Testcenter ${canonicalRootName} '${sourceFileName}' contains schema element '${namespacedSchemaElement.nodeName}' in unsupported namespace '${namespacedSchemaElement.namespaceURI}'.`
      )
    );
  }
  if (
    !new RegExp(
      `(?:^|/)definitions/v?o?_?${canonicalRootName}\\.xsd(?:[?#].*)?$`
    ).test(schemaLocation)
  ) {
    diagnostics.push(
      createImportDiagnostic(
        "testcenter_xml_schema_reference_invalid",
        `Original Testcenter XML '${sourceFileName}' references schema '${schemaLocation}', which does not match '${canonicalRootName}'.`
      )
    );
  }

  for (const attributeName of xmlUnsupportedTestcenterRootAttributeNames(root)) {
    diagnostics.push(
      createImportDiagnostic(
        "testcenter_xml_root_attribute_invalid",
        `Original Testcenter ${canonicalRootName} '${sourceFileName}' contains unsupported root attribute '${attributeName}'.`
      )
    );
  }

  const metadata = xmlChildrenNamed(root, "Metadata")[0];
  if (!metadata) {
    diagnostics.push(
      createImportDiagnostic(
        "testcenter_xml_metadata_missing",
        `Original Testcenter XML '${sourceFileName}' requires a direct Metadata element.`
      )
    );
  }
  if (metadata && canonicalRootName !== "Testtakers") {
    const metadataId = xmlElementText(xmlChildrenNamed(metadata, "Id")[0]);
    if (metadataId && !isTestcenterXmlId(metadataId)) {
      diagnostics.push(
        createImportDiagnostic(
          "testcenter_xml_metadata_id_invalid",
          `Original Testcenter ${canonicalRootName} '${sourceFileName}' contains Metadata/Id '${metadataId}', which is not a valid XML ID.`
        )
      );
    }
  }

  if (canonicalRootName === "Booklet") {
    const bookletSchemaVersion = parseTestcenterSchemaVersion(schemaLocation);
    const usesAdaptiveBookletSchema =
      bookletSchemaVersion === null || bookletSchemaVersion.major >= 17;
    const validateAttributes = (
      element: XmlElement,
      allowedAttributeNames: readonly string[],
      context: string
    ): void => {
      for (const attributeName of xmlUnsupportedAttributeNames(
        element,
        new Set(allowedAttributeNames)
      )) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_booklet_attribute_invalid",
            `Original Testcenter booklet '${sourceFileName}' contains unsupported attribute '${attributeName}' on ${context}.`
          )
        );
      }
    };
    const validateSimpleContent = (
      element: XmlElement,
      context: string
    ): void => {
      const nestedChildren = xmlChildElements(element);
      if (nestedChildren.length > 0) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_booklet_simple_content_invalid",
            `Original Testcenter booklet '${sourceFileName}' contains nested element '${xmlElementLocalName(nestedChildren[0])}' in text-only ${context}.`
          )
        );
      }
    };
    if (metadata && !xmlElementText(xmlChildrenNamed(metadata, "Id")[0])) {
      diagnostics.push(
        createImportDiagnostic(
          "testcenter_xml_metadata_id_missing",
          `Original Testcenter booklet '${sourceFileName}' requires Metadata/Id.`
        )
      );
    }
    if (metadata && !xmlElementText(xmlChildrenNamed(metadata, "Label")[0])) {
      diagnostics.push(
        createImportDiagnostic(
          "testcenter_xml_metadata_label_missing",
          `Original Testcenter booklet '${sourceFileName}' requires Metadata/Label.`
        )
      );
    }

    const allowedDirectChildNames = new Set([
      "Metadata",
      "CustomTexts",
      "BookletConfig",
      ...(usesAdaptiveBookletSchema ? ["States"] : []),
      "Units"
    ]);
    for (const child of xmlChildElements(root)) {
      const childName = xmlElementLocalName(child);
      if (!allowedDirectChildNames.has(childName)) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_booklet_child_invalid",
            `Original Testcenter booklet '${sourceFileName}' contains unsupported direct child '${childName}'.`
          )
        );
      }
    }
    const metadataContainers = xmlChildrenNamed(root, "Metadata");
    const customTextContainers = xmlChildrenNamed(root, "CustomTexts");
    const bookletConfigContainers = xmlChildrenNamed(root, "BookletConfig");
    const unitsContainers = xmlChildrenNamed(root, "Units");
    if (
      metadataContainers.length > 1 ||
      customTextContainers.length > 1 ||
      bookletConfigContainers.length > 1 ||
      unitsContainers.length > 1
    ) {
      diagnostics.push(
        createImportDiagnostic(
          "testcenter_xml_booklet_child_cardinality_invalid",
          `Original Testcenter booklet '${sourceFileName}' contains repeated Metadata, CustomTexts, BookletConfig, or Units elements.`
        )
      );
    }
    for (const metadataContainer of metadataContainers) {
      validateAttributes(metadataContainer, [], "Metadata");
      const metadataChildren = xmlChildElements(metadataContainer);
      const metadataChildRanks = new Map([
        ["Id", 0],
        ["Label", 1],
        ["Description", 2]
      ]);
      let previousMetadataChildRank = -1;
      for (const child of metadataChildren) {
        const childName = xmlElementLocalName(child);
        const rank = metadataChildRanks.get(childName);
        if (rank === undefined) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_booklet_metadata_child_invalid",
              `Original Testcenter booklet '${sourceFileName}' contains unsupported Metadata child '${childName}'.`
            )
          );
          continue;
        }
        validateAttributes(child, [], `Metadata/${childName}`);
        validateSimpleContent(child, `Metadata/${childName}`);
        if (rank < previousMetadataChildRank) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_booklet_metadata_sequence_invalid",
              `Original Testcenter booklet '${sourceFileName}' contains Metadata children outside schema order.`
            )
          );
          break;
        }
        previousMetadataChildRank = rank;
      }
      if (
        xmlChildrenNamed(metadataContainer, "Id").length !== 1 ||
        xmlChildrenNamed(metadataContainer, "Label").length !== 1 ||
        xmlChildrenNamed(metadataContainer, "Description").length > 1
      ) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_booklet_metadata_cardinality_invalid",
            `Original Testcenter booklet '${sourceFileName}' requires one Metadata/Id, one Metadata/Label, and at most one Metadata/Description.`
          )
        );
      }
    }
    for (const customTextContainer of customTextContainers) {
      validateAttributes(customTextContainer, [], "CustomTexts");
      const children = xmlChildElements(customTextContainer);
      if (
        children.length === 0 ||
        children.some(child => xmlElementLocalName(child) !== "CustomText")
      ) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_booklet_custom_text_structure_invalid",
            `Original Testcenter booklet '${sourceFileName}' requires CustomTexts to contain one or more CustomText elements only.`
          )
        );
      }
      for (const customText of children.filter(
        child => xmlElementLocalName(child) === "CustomText"
      )) {
        const key = customText.getAttribute("key")?.trim() ?? "";
        validateAttributes(customText, ["key"], "CustomText");
        validateSimpleContent(customText, "CustomText");
        if (!key || !isTestcenterXmlId(key)) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_booklet_custom_text_key_invalid",
              `Original Testcenter booklet '${sourceFileName}' contains CustomText key '${key || "missing"}', which is not a valid XML ID.`
            )
          );
        }
      }
    }
    for (const bookletConfigContainer of bookletConfigContainers) {
      validateAttributes(bookletConfigContainer, [], "BookletConfig");
      for (const child of xmlChildElements(bookletConfigContainer)) {
        const childName = xmlElementLocalName(child);
        if (childName !== "Config") {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_booklet_config_child_invalid",
              `Original Testcenter booklet '${sourceFileName}' contains unsupported BookletConfig child '${childName}'.`
            )
          );
          continue;
        }
        const key = child.getAttribute("key")?.trim() ?? "";
        validateAttributes(child, ["key"], "BookletConfig/Config");
        validateSimpleContent(child, "BookletConfig/Config");
        if (!key || !isTestcenterXmlId(key)) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_booklet_config_key_invalid",
              `Original Testcenter booklet '${sourceFileName}' contains Config key '${key || "missing"}', which is not a valid XML ID.`
            )
          );
        }
      }
    }

    const statesContainers = xmlChildrenNamed(root, "States");
    if (statesContainers.length > 1) {
      diagnostics.push(
        createImportDiagnostic(
          "testcenter_xml_states_cardinality_invalid",
          `Original Testcenter booklet '${sourceFileName}' contains multiple States elements.`
        )
      );
    }
    const stateEntries = statesContainers[0]
      ? xmlChildrenNamed(statesContainers[0], "State")
      : [];
    for (const statesContainer of statesContainers) {
      validateAttributes(statesContainer, [], "States");
      const unsupportedStateChild = xmlChildElements(statesContainer).find(
        child => xmlElementLocalName(child) !== "State"
      );
      if (unsupportedStateChild) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_state_structure_invalid",
            `Original Testcenter booklet '${sourceFileName}' contains unsupported States child '${xmlElementLocalName(unsupportedStateChild)}'.`
          )
        );
      }
    }
    const stateOptions = new Map<string, Set<string>>();
    for (const state of stateEntries) {
      const rawStateKey = state.getAttribute("id") ?? "";
      const stateKey = rawStateKey.trim();
      validateAttributes(state, ["id", "label"], `State '${stateKey || "unknown"}'`);
      if (!stateKey) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_state_id_missing",
            `Original Testcenter booklet '${sourceFileName}' contains a State without an id.`
          )
        );
      } else if (
        rawStateKey !== stateKey ||
        !testcenterBookletStateIdPattern.test(stateKey)
      ) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_state_id_invalid",
            `Original Testcenter booklet '${sourceFileName}' contains invalid State id '${rawStateKey}'.`
          )
        );
      }

      const stateChildren = xmlChildElements(state);
      const options = stateChildren.filter(option =>
        ["Option", "DefaultOption"].includes(xmlElementLocalName(option))
      );
      const unsupportedOptionChild = stateChildren.find(
        option => !["Option", "DefaultOption"].includes(xmlElementLocalName(option))
      );
      if (unsupportedOptionChild) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_state_structure_invalid",
            `Original Testcenter booklet '${sourceFileName}' contains unsupported State child '${xmlElementLocalName(unsupportedOptionChild)}' in State '${stateKey || "unknown"}'.`
          )
        );
      }
      if (options.length === 0) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_state_options_missing",
            `Original Testcenter booklet '${sourceFileName}' requires State '${stateKey || "unknown"}' to contain at least one Option.`
          )
        );
      }
      const optionKeys = new Set<string>();
      for (const option of options) {
        const optionElementName = xmlElementLocalName(option);
        const rawOptionKey = option.getAttribute("id") ?? "";
        const optionKey = rawOptionKey.trim();
        validateAttributes(
          option,
          ["id", "label"],
          `${optionElementName} '${optionKey || "unknown"}' in State '${stateKey || "unknown"}'`
        );
        if (!optionKey) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_state_option_id_missing",
              `Original Testcenter booklet '${sourceFileName}' contains an Option without an id in State '${stateKey || "unknown"}'.`
            )
          );
          continue;
        }
        if (
          rawOptionKey !== optionKey ||
          !testcenterBookletStateIdPattern.test(optionKey)
        ) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_state_option_id_invalid",
              `Original Testcenter booklet '${sourceFileName}' contains invalid Option id '${rawOptionKey}' in State '${stateKey || "unknown"}'.`
            )
          );
        }
        optionKeys.add(optionKey);
        const optionChildren = xmlChildElements(option);
        if (
          optionChildren.some(child => xmlElementLocalName(child) !== "If") ||
          (optionElementName === "DefaultOption" && optionChildren.length > 0)
        ) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_state_condition_structure_invalid",
              `Original Testcenter booklet '${sourceFileName}' contains an unsupported child in ${optionElementName} '${optionKey || "unknown"}' of State '${stateKey || "unknown"}'.`
            )
          );
        }
        for (const condition of optionChildren.filter(
          child => xmlElementLocalName(child) === "If"
        )) {
          diagnostics.push(
            ...validateTestcenterBookletCondition(
              condition,
              sourceFileName,
              stateKey,
              optionKey
            )
          );
        }
      }
      if (
        options.length > 0 &&
        !options.some(option => xmlChildrenNamed(option, "If").length === 0)
      ) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_state_fallback_option_missing",
            `Original Testcenter booklet '${sourceFileName}' requires State '${stateKey || "unknown"}' to contain at least one Option without conditions.`
          )
        );
      }
      if (stateKey && !stateOptions.has(stateKey)) {
        stateOptions.set(stateKey, optionKeys);
      }
      diagnostics.push(
        ...validateUniqueTestcenterXmlValues(
          options.map(option => ({
            value: option.getAttribute("id")?.trim() ?? "",
            label: `option id in State '${stateKey || "unknown"}'`
          })),
          "testcenter_xml_state_option_id_duplicate",
          sourceFileName
        )
      );
    }
    diagnostics.push(
      ...validateUniqueTestcenterXmlValues(
        stateEntries.map(state => ({
          value: state.getAttribute("id")?.trim() ?? "",
          label: "state id"
        })),
        "testcenter_xml_state_id_duplicate",
        sourceFileName
      )
    );

    const units = unitsContainers[0];
    const validateRestrictions = (
      restriction: XmlElement,
      context: string,
      isRoot: boolean
    ): void => {
      validateAttributes(restriction, [], `Restrictions for ${context}`);
      const allowedChildNames = isRoot
        ? ["TimeMax", "DenyNavigationOnIncomplete"]
        : [
            "CodeToEnter",
            "TimeMax",
            ...(usesAdaptiveBookletSchema ? ["Show"] : []),
            "DenyNavigationOnIncomplete",
            ...(usesAdaptiveBookletSchema ? ["LockAfterLeaving"] : [])
          ];
      const childRanks = new Map(
        allowedChildNames.map((childName, index) => [childName, index])
      );
      const children = xmlChildElements(restriction);
      let previousRank = -1;
      for (const child of children) {
        const childName = xmlElementLocalName(child);
        const rank = childRanks.get(childName);
        if (rank === undefined) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_testlet_restrictions_structure_invalid",
              `Original Testcenter booklet '${sourceFileName}' contains unsupported restriction '${childName}' for ${context}.`
            )
          );
          continue;
        }
        if (!isRoot && rank < previousRank) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_testlet_restrictions_structure_invalid",
              `Original Testcenter booklet '${sourceFileName}' contains restrictions outside schema order for ${context}.`
            )
          );
        }
        previousRank = Math.max(previousRank, rank);
      }
      for (const childName of allowedChildNames.filter(
        childName => childName !== "Show"
      )) {
        if (xmlChildrenNamed(restriction, childName).length > 1) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_testlet_restrictions_structure_invalid",
              `Original Testcenter booklet '${sourceFileName}' contains multiple ${childName} restrictions for ${context}.`
            )
          );
        }
      }

      for (const codeToEnter of xmlChildrenNamed(restriction, "CodeToEnter")) {
        validateAttributes(codeToEnter, ["code"], `CodeToEnter for ${context}`);
        validateSimpleContent(codeToEnter, `CodeToEnter for ${context}`);
      }
      for (const show of xmlChildrenNamed(restriction, "Show")) {
        validateAttributes(show, ["if", "is"], `Show for ${context}`);
        validateSimpleContent(show, `Show for ${context}`);
        const stateKey = show.getAttribute("if")?.trim() ?? "";
        const optionKey = show.getAttribute("is")?.trim() ?? "";
        if (!stateKey || !stateOptions.has(stateKey)) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_show_state_invalid",
              `Original Testcenter booklet '${sourceFileName}' contains Show state reference '${stateKey || "missing"}' for ${context}, but that State is not defined.`
            )
          );
          continue;
        }
        if (!optionKey || !stateOptions.get(stateKey)?.has(optionKey)) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_show_option_invalid",
              `Original Testcenter booklet '${sourceFileName}' contains Show option reference '${optionKey || "missing"}' for State '${stateKey}' and ${context}, but that Option is not defined.`
            )
          );
        }
      }
      for (const timeMax of xmlChildrenNamed(restriction, "TimeMax")) {
        validateAttributes(
          timeMax,
          usesAdaptiveBookletSchema ? ["minutes", "leave"] : ["minutes"],
          `TimeMax for ${context}`
        );
        validateSimpleContent(timeMax, `TimeMax for ${context}`);
        const minutes = timeMax.getAttribute("minutes");
        const leave = timeMax.getAttribute("leave");
        const validMinutes =
          minutes === null ||
          (usesAdaptiveBookletSchema
            ? isPositiveTestcenterXmlNumber(minutes)
            : isTestcenterXmlInteger(minutes) && Number(minutes) > 0);
        if (!validMinutes) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_time_max_invalid",
              `Original Testcenter booklet '${sourceFileName}' contains invalid TimeMax minutes '${minutes}' for ${context}.`
            )
          );
        }
        if (
          leave !== null &&
          !["forbidden", "confirm", "allowed"].includes(leave.trim())
        ) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_time_max_leave_invalid",
              `Original Testcenter booklet '${sourceFileName}' contains invalid TimeMax leave policy '${leave}' for ${context}.`
            )
          );
        }
      }
      for (const denyNavigation of xmlChildrenNamed(
        restriction,
        "DenyNavigationOnIncomplete"
      )) {
        validateAttributes(
          denyNavigation,
          ["presentation", "response"],
          `DenyNavigationOnIncomplete for ${context}`
        );
        validateSimpleContent(
          denyNavigation,
          `DenyNavigationOnIncomplete for ${context}`
        );
        for (const attributeName of ["presentation", "response"] as const) {
          const value = denyNavigation.getAttribute(attributeName);
          if (value !== null && !["ON", "OFF", "ALWAYS"].includes(value.trim())) {
            diagnostics.push(
              createImportDiagnostic(
                "testcenter_xml_navigation_restriction_invalid",
                `Original Testcenter booklet '${sourceFileName}' contains invalid ${attributeName} completion policy '${value}' for ${context}.`
              )
            );
          }
        }
      }
      for (const lockAfterLeaving of xmlChildrenNamed(
        restriction,
        "LockAfterLeaving"
      )) {
        validateAttributes(
          lockAfterLeaving,
          ["confirm", "scope"],
          `LockAfterLeaving for ${context}`
        );
        validateSimpleContent(lockAfterLeaving, `LockAfterLeaving for ${context}`);
        const confirm = lockAfterLeaving.getAttribute("confirm");
        const scope = lockAfterLeaving.getAttribute("scope");
        if (confirm !== null && parseTestcenterXmlBoolean(confirm) === null) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_lock_after_leaving_confirm_invalid",
              `Original Testcenter booklet '${sourceFileName}' contains invalid LockAfterLeaving confirm value '${confirm}' for ${context}.`
            )
          );
        }
        if (scope !== null && !["unit", "testlet"].includes(scope.trim())) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_lock_after_leaving_scope_invalid",
              `Original Testcenter booklet '${sourceFileName}' contains invalid LockAfterLeaving scope '${scope}' for ${context}.`
            )
          );
        }
      }
    };
    const validateUnitTree = (
      container: XmlElement,
      context: string,
      isRoot: boolean
    ): void => {
      validateAttributes(
        container,
        isRoot ? [] : ["id", "label"],
        context
      );
      const children = xmlChildElements(container);
      const restrictions = children.filter(
        child => xmlElementLocalName(child) === "Restrictions"
      );
      if (
        restrictions.length > 1 ||
        (restrictions.length === 1 && children[0] !== restrictions[0])
      ) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_booklet_units_structure_invalid",
            `Original Testcenter booklet '${sourceFileName}' requires the optional Restrictions block to appear once and before content in ${context}.`
          )
        );
      }
      const contentChildren = children.filter(child =>
        ["Unit", "Testlet"].includes(xmlElementLocalName(child))
      );
      const unsupportedChild = children.find(
        child =>
          !["Restrictions", "Unit", "Testlet"].includes(
            xmlElementLocalName(child)
          )
      );
      if (unsupportedChild || contentChildren.length === 0) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_booklet_units_structure_invalid",
            `Original Testcenter booklet '${sourceFileName}' requires ${context} to contain one or more Unit or Testlet elements${unsupportedChild ? ` and does not support child '${xmlElementLocalName(unsupportedChild)}'` : ""}.`
          )
        );
      }
      restrictions.forEach(restriction =>
        validateRestrictions(restriction, context, isRoot)
      );
      for (const child of contentChildren) {
        const childName = xmlElementLocalName(child);
        if (childName === "Unit") {
          const unitKey = child.getAttribute("alias")?.trim() ||
            child.getAttribute("id")?.trim() ||
            "unknown";
          validateAttributes(
            child,
            ["id", "label", "labelshort", "alias"],
            `Unit '${unitKey}'`
          );
          if (xmlChildElements(child).length > 0) {
            diagnostics.push(
              createImportDiagnostic(
                "testcenter_xml_booklet_units_structure_invalid",
                `Original Testcenter booklet '${sourceFileName}' contains nested elements in Unit '${unitKey}'.`
              )
            );
          }
          continue;
        }
        const testletKey = child.getAttribute("id")?.trim() || "unknown";
        validateUnitTree(child, `Testlet '${testletKey}'`, false);
      }
    };
    if (units) {
      validateUnitTree(units, "Units", true);
    }
    const unitEntries = units ? xmlDescendantsNamed(units, "Unit") : [];
    if (!units || unitEntries.length === 0) {
      diagnostics.push(
        createImportDiagnostic(
          "testcenter_xml_units_missing",
          `Original Testcenter booklet '${sourceFileName}' requires Units with at least one Unit.`
        )
      );
    }
    for (const unit of unitEntries) {
      if (!unit.getAttribute("id")?.trim()) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_unit_id_missing",
            `Original Testcenter booklet '${sourceFileName}' contains a Unit without an id.`
          )
        );
      }
      if (!unit.getAttribute("label")?.trim()) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_unit_label_missing",
            `Original Testcenter booklet '${sourceFileName}' contains a Unit without a label.`
          )
        );
      }
    }
    const unitRuntimeKeys = new Set(
      unitEntries.flatMap(unit => {
        const unitId = unit.getAttribute("id")?.trim() ?? "";
        const unitAlias = unit.getAttribute("alias")?.trim() ?? "";
        const runtimeKey = unitAlias || unitId;
        return runtimeKey ? [runtimeKey] : [];
      })
    );
    const adaptiveVariableSources = stateEntries.flatMap(state =>
      testcenterBookletVariableSourceNames.flatMap(sourceName =>
        xmlDescendantsNamed(state, sourceName)
      )
    );
    for (const variableSource of adaptiveVariableSources) {
      const unitKey = variableSource.getAttribute("from")?.trim() ?? "";
      if (unitKey && !unitRuntimeKeys.has(unitKey)) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_state_condition_unit_reference_invalid",
            `Original Testcenter booklet '${sourceFileName}' contains adaptive ${xmlElementLocalName(variableSource)} source '${variableSource.getAttribute("of")?.trim() || "unknown"}' whose Unit runtime key '${unitKey}' is not declared in Units.`
          )
        );
      }
    }
    const testletEntries = units ? xmlDescendantsNamed(units, "Testlet") : [];
    for (const testlet of testletEntries) {
      const testletKey = testlet.getAttribute("id")?.trim() ?? "";
      if (!testletKey) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_testlet_id_missing",
            `Original Testcenter booklet '${sourceFileName}' contains a Testlet without an id.`
          )
        );
      }
      const restrictions = xmlChildrenNamed(testlet, "Restrictions");
      if (restrictions.length > 1) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_testlet_restrictions_invalid",
            `Original Testcenter booklet '${sourceFileName}' contains multiple Restrictions blocks for Testlet '${testletKey || "unknown"}'.`
          )
        );
      }
      const restriction = restrictions[0];
      if (!restriction) {
        continue;
      }
    }
    diagnostics.push(
      ...validateUniqueTestcenterXmlValues(
        unitEntries.map(unit => {
          const id = unit.getAttribute("id")?.trim() ?? "";
          const alias = unit.getAttribute("alias")?.trim() ?? "";
          return { value: alias || id, label: "unit runtime key" };
        }),
        "testcenter_xml_unit_key_duplicate",
        sourceFileName
      ),
      ...validateUniqueTestcenterXmlValues(
        testletEntries.map(testlet => ({
          value: testlet.getAttribute("id")?.trim() ?? "",
          label: "testlet id"
        })),
        "testcenter_xml_testlet_id_duplicate",
        sourceFileName
      )
    );
  }

  if (canonicalRootName === "Unit") {
    const schemaVersion = parseTestcenterSchemaVersion(schemaLocation);
    const usesPre15UnitSchema =
      schemaVersion !== null && schemaVersion.major < 15;
    const usesPre16UnitSchema =
      schemaVersion !== null && schemaVersion.major < 16;
    const validateAttributes = (
      element: XmlElement,
      allowedAttributeNames: readonly string[],
      context: string
    ): void => {
      for (const attributeName of xmlUnsupportedAttributeNames(
        element,
        new Set(allowedAttributeNames)
      )) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_unit_attribute_invalid",
            `Original Testcenter unit '${sourceFileName}' contains unsupported attribute '${attributeName}' on ${context}.`
          )
        );
      }
    };
    const validateSimpleContent = (
      element: XmlElement,
      context: string
    ): void => {
      const nestedChildren = xmlChildElements(element);
      if (nestedChildren.length > 0) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_unit_simple_content_invalid",
            `Original Testcenter unit '${sourceFileName}' contains nested element '${xmlElementLocalName(nestedChildren[0])}' in text-only ${context}.`
          )
        );
      }
    };
    if (metadata && !xmlElementText(xmlChildrenNamed(metadata, "Id")[0])) {
      diagnostics.push(
        createImportDiagnostic(
          "testcenter_xml_metadata_id_missing",
          `Original Testcenter unit '${sourceFileName}' requires Metadata/Id.`
        )
      );
    }
    if (metadata && !xmlElementText(xmlChildrenNamed(metadata, "Label")[0])) {
      diagnostics.push(
        createImportDiagnostic(
          "testcenter_xml_metadata_label_missing",
          `Original Testcenter unit '${sourceFileName}' requires Metadata/Label.`
        )
      );
    }
    const metadataContainers = xmlChildrenNamed(root, "Metadata");
    for (const metadataContainer of metadataContainers) {
      validateAttributes(metadataContainer, ["lastChange"], "Metadata");
      const metadataChildRanks = new Map([
        ["Id", 0],
        ["Label", 1],
        ["Description", 2],
        ...(!usesPre15UnitSchema
          ? ([
              ["Transcript", 3],
              ["Reference", 4]
            ] as Array<[string, number]>)
          : []),
        ["Lastchange", 5]
      ]);
      let previousMetadataChildRank = -1;
      for (const child of xmlChildElements(metadataContainer)) {
        const childName = xmlElementLocalName(child);
        const rank = metadataChildRanks.get(childName);
        if (rank === undefined) {
          diagnostics.push(
            createImportDiagnostic(
              ["Transcript", "Reference"].includes(childName)
                ? "testcenter_xml_unit_metadata_child_version_invalid"
                : "testcenter_xml_unit_metadata_child_invalid",
              ["Transcript", "Reference"].includes(childName)
                ? `Original Testcenter unit '${sourceFileName}' contains Metadata/${childName}, which is not supported by schema ${schemaVersion?.major}.${schemaVersion?.minor}.`
                : `Original Testcenter unit '${sourceFileName}' contains unsupported Metadata child '${childName}'.`
            )
          );
          continue;
        }
        validateAttributes(child, [], `Metadata/${childName}`);
        validateSimpleContent(child, `Metadata/${childName}`);
        if (rank < previousMetadataChildRank) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_unit_metadata_sequence_invalid",
              `Original Testcenter unit '${sourceFileName}' contains Metadata children outside schema order.`
            )
          );
          break;
        }
        previousMetadataChildRank = rank;
        if (
          childName === "Lastchange" &&
          !isTestcenterXmlDateTime(xmlElementText(child))
        ) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_unit_last_change_invalid",
              `Original Testcenter unit '${sourceFileName}' contains invalid Metadata/Lastchange '${xmlElementText(child)}'.`
            )
          );
        }
      }
      const optionalMetadataChildNames = [
        "Description",
        "Transcript",
        "Reference",
        "Lastchange"
      ];
      if (
        xmlChildrenNamed(metadataContainer, "Id").length !== 1 ||
        xmlChildrenNamed(metadataContainer, "Label").length !== 1 ||
        optionalMetadataChildNames.some(
          childName => xmlChildrenNamed(metadataContainer, childName).length > 1
        )
      ) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_unit_metadata_cardinality_invalid",
            `Original Testcenter unit '${sourceFileName}' requires one Metadata/Id, one Metadata/Label, and at most one optional Metadata field of each supported type.`
          )
        );
      }
    }
    const definitions = [
      ...xmlChildrenNamed(root, "Definition"),
      ...xmlChildrenNamed(root, "DefinitionRef")
    ];
    if (definitions.length !== 1 || !definitions[0]?.getAttribute("player")?.trim()) {
      diagnostics.push(
        createImportDiagnostic(
          "testcenter_xml_definition_invalid",
          `Original Testcenter unit '${sourceFileName}' requires exactly one Definition or DefinitionRef with a player attribute.`
        )
      );
    }
    for (const definition of definitions) {
      validateAttributes(
        definition,
        ["player", "editor", "type", "lastChange"],
        xmlElementLocalName(definition)
      );
      validateSimpleContent(definition, xmlElementLocalName(definition));
    }
    const allowedUnitChildren = new Set([
      "Metadata",
      "Definition",
      "DefinitionRef",
      "CodingSchemeRef",
      "Dependencies",
      "BaseVariables",
      "DerivedVariables"
    ]);
    if (!usesPre15UnitSchema) {
      allowedUnitChildren.add("VariablesRef");
    }
    for (const child of xmlChildElements(root)) {
      const childName = xmlElementLocalName(child);
      if (!allowedUnitChildren.has(childName)) {
        diagnostics.push(
          createImportDiagnostic(
            childName === "VariablesRef"
              ? "testcenter_xml_unit_child_version_invalid"
              : "testcenter_xml_unit_child_invalid",
            childName === "VariablesRef"
              ? `Original Testcenter unit '${sourceFileName}' contains VariablesRef, which is not supported by schema ${schemaVersion?.major}.${schemaVersion?.minor}.`
              : `Original Testcenter unit '${sourceFileName}' contains unsupported direct child '${childName}'.`
          )
        );
      }
    }
    for (const childName of [
      "Metadata",
      "CodingSchemeRef",
      "Dependencies",
      "VariablesRef",
      "BaseVariables",
      "DerivedVariables"
    ]) {
      if (xmlChildrenNamed(root, childName).length > 1) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_unit_child_cardinality_invalid",
            `Original Testcenter unit '${sourceFileName}' contains multiple ${childName} elements.`
          )
        );
      }
    }
    const validateLastChange = (
      element: XmlElement | undefined,
      label: string
    ): void => {
      const lastChange = element?.getAttribute("lastChange");
      if (lastChange !== null && lastChange !== undefined && !isTestcenterXmlDateTime(lastChange)) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_unit_last_change_invalid",
            `Original Testcenter unit '${sourceFileName}' contains invalid ${label} lastChange '${lastChange}'.`
          )
        );
      }
    };
    validateLastChange(metadata, "Metadata");
    validateLastChange(definitions[0], xmlElementLocalName(definitions[0] ?? root));

    const codingSchemeReference = xmlChildrenNamed(root, "CodingSchemeRef")[0];
    if (codingSchemeReference) {
      validateAttributes(
        codingSchemeReference,
        ["schemer", "schemeType", "lastChange"],
        "CodingSchemeRef"
      );
      validateSimpleContent(codingSchemeReference, "CodingSchemeRef");
      if (!codingSchemeReference.getAttribute("schemer")?.trim()) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_coding_scheme_schemer_missing",
            `Original Testcenter unit '${sourceFileName}' requires CodingSchemeRef/@schemer.`
          )
        );
      }
      validateLastChange(codingSchemeReference, "CodingSchemeRef");
    }
    const variablesReference = xmlChildrenNamed(root, "VariablesRef")[0];
    if (variablesReference) {
      validateAttributes(variablesReference, ["lastChange"], "VariablesRef");
      validateSimpleContent(variablesReference, "VariablesRef");
    }
    validateLastChange(variablesReference, "VariablesRef");
    if (variablesReference && !xmlElementText(variablesReference)) {
      diagnostics.push(
        createImportDiagnostic(
          "source_document_variables_reference_invalid",
          `Original Testcenter unit '${sourceFileName}' contains a VariablesRef without a resource path.`
        )
      );
    }

    const dependencies = xmlChildrenNamed(root, "Dependencies")[0];
    if (dependencies) {
      validateAttributes(dependencies, [], "Dependencies");
    }
    for (const dependency of dependencies ? xmlChildElements(dependencies) : []) {
      const dependencyName = xmlElementLocalName(dependency);
      if (!["File", "file", "Service"].includes(dependencyName)) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_dependency_element_invalid",
            `Original Testcenter unit '${sourceFileName}' contains unsupported dependency element '${dependencyName}'.`
          )
        );
        continue;
      }
      validateAttributes(dependency, ["for"], dependencyName);
      validateSimpleContent(dependency, dependencyName);
      const target = dependency.getAttribute("for");
      if (
        target !== null &&
        !["player", "editor", "schemer", "coder"].includes(target.trim())
      ) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_dependency_target_invalid",
            `Original Testcenter unit '${sourceFileName}' contains invalid dependency target '${target}'.`
          )
        );
      }
    }

    const variableContainers = [
      ...xmlChildrenNamed(root, "BaseVariables"),
      ...xmlChildrenNamed(root, "DerivedVariables")
    ];
    for (const container of variableContainers) {
      validateAttributes(container, [], xmlElementLocalName(container));
      for (const child of xmlChildElements(container)) {
        if (xmlElementLocalName(child) !== "Variable") {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_variable_container_child_invalid",
              `Original Testcenter unit '${sourceFileName}' contains unsupported ${xmlElementLocalName(container)} child '${xmlElementLocalName(child)}'.`
            )
          );
        }
      }
    }
    const variables = variableContainers.flatMap(container =>
      xmlChildrenNamed(container, "Variable")
    );
    const baseAttachmentVariables = new Set(
      xmlChildrenNamed(root, "BaseVariables").flatMap(container =>
        xmlChildrenNamed(container, "Variable")
      )
    );
    const variableTypes = new Set([
      "string",
      "integer",
      "number",
      "boolean",
      "attachment"
    ]);
    if (!usesPre16UnitSchema) {
      variableTypes.add("json");
      variableTypes.add("no-value");
    }
    const maximumVariableIdLength = usesPre15UnitSchema ? 20 : 50;
    for (const variable of variables) {
      const variableId = variable.getAttribute("id") ?? "";
      validateAttributes(
        variable,
        [
          "id",
          "type",
          "format",
          "multiple",
          "nullable",
          ...(!usesPre15UnitSchema ? ["page"] : []),
          ...(!usesPre16UnitSchema ? ["alias"] : [])
        ],
        `Variable '${variableId || "unknown"}'`
      );
      if (
        !variableId.trim() ||
        variableId.length > maximumVariableIdLength ||
        (usesPre15UnitSchema && !isTestcenterXmlId(variableId))
      ) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_variable_id_invalid",
            `Original Testcenter unit '${sourceFileName}' contains a Variable with an id outside the 1–${maximumVariableIdLength} character range for its schema.`
          )
        );
      }
      const variableType = variable.getAttribute("type")?.trim() ?? "";
      if (!variableTypes.has(variableType)) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_variable_type_invalid",
            `Original Testcenter unit '${sourceFileName}' contains invalid Variable type '${variableType || "missing"}' for '${variableId || "unknown"}'.`
          )
        );
      }
      const format = variable.getAttribute("format");
      if (format !== null && !/^[a-z\d-]*$/.test(format)) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_variable_format_invalid",
            `Original Testcenter unit '${sourceFileName}' contains invalid Variable format '${format}' for '${variableId || "unknown"}'.`
          )
        );
      }
      if (
        variableType === "attachment" &&
        (format !== "capture-image" || !baseAttachmentVariables.has(variable))
      ) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_attachment_variable_invalid",
            `Original Testcenter unit '${sourceFileName}' attachment Variable '${variableId || "unknown"}' must be a BaseVariable with format 'capture-image'.`
          )
        );
      }
      for (const booleanAttribute of ["multiple", "nullable"]) {
        const value = variable.getAttribute(booleanAttribute);
        if (value !== null && parseTestcenterXmlBoolean(value) === null) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_variable_boolean_invalid",
              `Original Testcenter unit '${sourceFileName}' contains invalid Variable ${booleanAttribute} value '${value}' for '${variableId || "unknown"}'.`
            )
          );
        }
      }
      const page = variable.getAttribute("page");
      if (page !== null && usesPre15UnitSchema) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_variable_attribute_version_invalid",
            `Original Testcenter unit '${sourceFileName}' contains Variable/@page for '${variableId || "unknown"}', which is not supported by schema ${schemaVersion?.major}.${schemaVersion?.minor}.`
          )
        );
      } else if (page !== null && !/^[0-9A-Za-z_]*$/.test(page)) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_variable_page_invalid",
            `Original Testcenter unit '${sourceFileName}' contains invalid Variable page '${page}' for '${variableId || "unknown"}'.`
          )
        );
      }
      if (variable.getAttribute("alias") !== null && usesPre16UnitSchema) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_variable_attribute_version_invalid",
            `Original Testcenter unit '${sourceFileName}' contains Variable/@alias for '${variableId || "unknown"}', which is not supported by schema ${schemaVersion?.major}.${schemaVersion?.minor}.`
          )
        );
      }
      const valuesElements = xmlChildrenNamed(variable, "Values");
      const positionLabelElements = xmlChildrenNamed(
        variable,
        "ValuePositionLabels"
      );
      if (valuesElements.length > 1 || positionLabelElements.length > 1) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_variable_children_invalid",
            `Original Testcenter unit '${sourceFileName}' contains repeated Variable value metadata for '${variableId || "unknown"}'.`
          )
        );
      }
      const variableChildren = xmlChildElements(variable);
      const allowedVariableChildren = new Set(["Values"]);
      if (!usesPre15UnitSchema) {
        allowedVariableChildren.add("ValuePositionLabels");
      }
      let previousVariableChildRank = -1;
      for (const child of variableChildren) {
        const childName = xmlElementLocalName(child);
        if (!allowedVariableChildren.has(childName)) {
          diagnostics.push(
            createImportDiagnostic(
              childName === "ValuePositionLabels"
                ? "testcenter_xml_variable_child_version_invalid"
                : "testcenter_xml_variable_child_invalid",
              childName === "ValuePositionLabels"
                ? `Original Testcenter unit '${sourceFileName}' contains ValuePositionLabels for '${variableId || "unknown"}', which is not supported by schema ${schemaVersion?.major}.${schemaVersion?.minor}.`
                : `Original Testcenter unit '${sourceFileName}' contains unsupported Variable child '${childName}' for '${variableId || "unknown"}'.`
            )
          );
          continue;
        }
        const rank = childName === "Values" ? 0 : 1;
        if (rank < previousVariableChildRank) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_variable_children_invalid",
              `Original Testcenter unit '${sourceFileName}' contains Variable value metadata outside schema order for '${variableId || "unknown"}'.`
            )
          );
          break;
        }
        previousVariableChildRank = rank;
      }
      const complete = valuesElements[0]?.getAttribute("complete");
      if (complete !== null && complete !== undefined && parseTestcenterXmlBoolean(complete) === null) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_variable_values_complete_invalid",
            `Original Testcenter unit '${sourceFileName}' contains invalid Values/@complete '${complete}' for '${variableId || "unknown"}'.`
          )
        );
      }
      for (const values of valuesElements) {
        validateAttributes(values, ["complete"], `Values for '${variableId || "unknown"}'`);
        const valueElements = xmlChildElements(values);
        if (
          valueElements.length === 0 ||
          valueElements.some(value => xmlElementLocalName(value) !== "Value")
        ) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_variable_value_structure_invalid",
              `Original Testcenter unit '${sourceFileName}' contains invalid Values children for '${variableId || "unknown"}'.`
            )
          );
        }
        for (const value of valueElements.filter(
          item => xmlElementLocalName(item) === "Value"
        )) {
          validateAttributes(value, [], `Value for '${variableId || "unknown"}'`);
          const valueChildElements = xmlChildElements(value);
          const valueChildren = valueChildElements.map(xmlElementLocalName);
          if (
            valueChildren.length !== 2 ||
            valueChildren[0] !== "label" ||
            valueChildren[1] !== "value"
          ) {
            diagnostics.push(
              createImportDiagnostic(
                "testcenter_xml_variable_value_structure_invalid",
                `Original Testcenter unit '${sourceFileName}' contains a Value without the required label/value sequence for '${variableId || "unknown"}'.`
              )
            );
          }
        }
      }
      for (const positionLabels of positionLabelElements) {
        validateAttributes(
          positionLabels,
          [],
          `ValuePositionLabels for '${variableId || "unknown"}'`
        );
        const labelChildren = xmlChildElements(positionLabels);
        if (
          labelChildren.length === 0 ||
          labelChildren.some(
            label => xmlElementLocalName(label) !== "ValuePositionLabel"
          )
        ) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_variable_value_structure_invalid",
              `Original Testcenter unit '${sourceFileName}' contains invalid ValuePositionLabels children for '${variableId || "unknown"}'.`
            )
          );
        }
      }
    }
    diagnostics.push(
      ...validateUniqueTestcenterXmlValues(
        variables.map(variable => ({
          value: variable.getAttribute("id") ?? "",
          label: "variable id"
        })),
        "testcenter_xml_variable_id_duplicate",
        sourceFileName
      )
    );
  }

  if (canonicalRootName === "SysCheck") {
    const validateAttributes = (
      element: XmlElement,
      allowedAttributeNames: readonly string[],
      context: string
    ): void => {
      for (const attributeName of xmlUnsupportedAttributeNames(
        element,
        new Set(allowedAttributeNames)
      )) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_syscheck_attribute_invalid",
            `Original Testcenter system check '${sourceFileName}' contains unsupported attribute '${attributeName}' on ${context}.`
          )
        );
      }
    };
    const validateSimpleContent = (
      element: XmlElement,
      context: string
    ): void => {
      const nestedChildren = xmlChildElements(element);
      if (nestedChildren.length > 0) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_syscheck_simple_content_invalid",
            `Original Testcenter system check '${sourceFileName}' contains nested element '${xmlElementLocalName(nestedChildren[0])}' in text-only ${context}.`
          )
        );
      }
    };
    if (metadata && !xmlElementText(xmlChildrenNamed(metadata, "Id")[0])) {
      diagnostics.push(
        createImportDiagnostic(
          "testcenter_xml_metadata_id_missing",
          `Original Testcenter system check '${sourceFileName}' requires Metadata/Id.`
        )
      );
    }
    if (metadata && !xmlElementText(xmlChildrenNamed(metadata, "Label")[0])) {
      diagnostics.push(
        createImportDiagnostic(
          "testcenter_xml_metadata_label_missing",
          `Original Testcenter system check '${sourceFileName}' requires Metadata/Label.`
        )
      );
    }
    const directChildren = xmlChildElements(root);
    let previousDirectChildRank = -1;
    for (const child of directChildren) {
      const childName = xmlElementLocalName(child);
      if (!["Metadata", "Config"].includes(childName)) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_syscheck_child_invalid",
            `Original Testcenter system check '${sourceFileName}' contains unsupported direct child '${childName}'.`
          )
        );
        continue;
      }
      const rank = childName === "Metadata" ? 0 : 1;
      if (rank < previousDirectChildRank) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_syscheck_sequence_invalid",
            `Original Testcenter system check '${sourceFileName}' contains direct children outside schema order.`
          )
        );
        break;
      }
      previousDirectChildRank = rank;
    }
    const metadataContainers = xmlChildrenNamed(root, "Metadata");
    const configs = xmlChildrenNamed(root, "Config");
    if (metadataContainers.length > 1 || configs.length > 1) {
      diagnostics.push(
        createImportDiagnostic(
          "testcenter_xml_syscheck_child_cardinality_invalid",
          `Original Testcenter system check '${sourceFileName}' contains repeated Metadata or Config elements.`
        )
      );
    }
    for (const metadataContainer of metadataContainers) {
      validateAttributes(metadataContainer, [], "Metadata");
      const metadataChildren = xmlChildElements(metadataContainer);
      const metadataChildRanks = new Map([
        ["Id", 0],
        ["Label", 1],
        ["Description", 2]
      ]);
      let previousMetadataChildRank = -1;
      for (const child of metadataChildren) {
        const childName = xmlElementLocalName(child);
        const rank = metadataChildRanks.get(childName);
        if (rank === undefined) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_syscheck_metadata_child_invalid",
              `Original Testcenter system check '${sourceFileName}' contains unsupported Metadata child '${childName}'.`
            )
          );
          continue;
        }
        validateAttributes(child, [], `Metadata/${childName}`);
        validateSimpleContent(child, `Metadata/${childName}`);
        if (rank < previousMetadataChildRank) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_syscheck_metadata_sequence_invalid",
              `Original Testcenter system check '${sourceFileName}' contains Metadata children outside schema order.`
            )
          );
          break;
        }
        previousMetadataChildRank = rank;
      }
      if (
        xmlChildrenNamed(metadataContainer, "Id").length !== 1 ||
        xmlChildrenNamed(metadataContainer, "Label").length !== 1 ||
        xmlChildrenNamed(metadataContainer, "Description").length > 1
      ) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_syscheck_metadata_cardinality_invalid",
            `Original Testcenter system check '${sourceFileName}' requires one Metadata/Id, one Metadata/Label, and at most one Metadata/Description.`
          )
        );
      }
    }
    const config = configs[0];
    if (config) {
      validateAttributes(config, ["unit", "savekey", "skipnetwork"], "Config");
      const skipNetwork = config.getAttribute("skipnetwork");
      if (
        skipNetwork !== null &&
        parseTestcenterXmlBoolean(skipNetwork) === null
      ) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_syscheck_skip_network_invalid",
            `Original Testcenter system check '${sourceFileName}' contains invalid Config/@skipnetwork '${skipNetwork}'.`
          )
        );
      }
      const configChildren = xmlChildElements(config);
      const configChildRanks = new Map([
        ["UploadSpeed", 0],
        ["DownloadSpeed", 1],
        ["CustomText", 2],
        ["Q", 3]
      ]);
      let previousRank = -1;
      for (const child of configChildren) {
        const childName = xmlElementLocalName(child);
        const rank = configChildRanks.get(childName);
        if (rank === undefined) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_syscheck_config_child_invalid",
              `Original Testcenter system check '${sourceFileName}' contains unsupported Config child '${childName}'.`
            )
          );
          continue;
        }
        if (rank < previousRank) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_syscheck_config_sequence_invalid",
              `Original Testcenter system check '${sourceFileName}' contains Config children outside schema order.`
            )
          );
          break;
        }
        previousRank = rank;
      }
      for (const speedName of ["UploadSpeed", "DownloadSpeed"]) {
        const speeds = xmlChildrenNamed(config, speedName);
        if (speeds.length > 1) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_syscheck_speed_cardinality_invalid",
              `Original Testcenter system check '${sourceFileName}' contains multiple ${speedName} elements.`
            )
          );
        }
        for (const speed of speeds) {
          validateAttributes(
            speed,
            [
              "min",
              "good",
              "maxDevianceBytesPerSecond",
              "maxErrorsPerSequence",
              "maxSequenceRepetitions"
            ],
            speedName
          );
          validateSimpleContent(speed, speedName);
          for (const attributeName of [
            "min",
            "good",
            "maxDevianceBytesPerSecond",
            "maxErrorsPerSequence",
            "maxSequenceRepetitions"
          ]) {
            const value = speed.getAttribute(attributeName);
            if (
              (attributeName === "min" && value === null) ||
              (value !== null &&
                (!isTestcenterXmlInteger(value) ||
                  !Number.isSafeInteger(Number(value))))
            ) {
              diagnostics.push(
                createImportDiagnostic(
                  "testcenter_xml_syscheck_speed_integer_invalid",
                  `Original Testcenter system check '${sourceFileName}' contains invalid ${speedName}/@${attributeName} '${value ?? "missing"}'.`
                )
              );
            }
          }
        }
      }
      const questions = xmlChildrenNamed(config, "Q");
      const questionTypes = new Set([
        "string",
        "select",
        "header",
        "check",
        "text",
        "radio"
      ]);
      for (const question of questions) {
        const questionId = question.getAttribute("id")?.trim() ?? "";
        validateAttributes(
          question,
          ["type", "prompt", "id", "required"],
          `question '${questionId || "unknown"}'`
        );
        validateSimpleContent(question, `question '${questionId || "unknown"}'`);
        if (!questionId) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_syscheck_question_id_missing",
              `Original Testcenter system check '${sourceFileName}' contains a question without an id.`
            )
          );
        }
        const questionType = question.getAttribute("type")?.trim() ?? "";
        if (!questionTypes.has(questionType)) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_syscheck_question_type_invalid",
              `Original Testcenter system check '${sourceFileName}' contains invalid question type '${questionType || "missing"}' for '${questionId || "unknown"}'.`
            )
          );
        }
        const required = question.getAttribute("required");
        if (required !== null && parseTestcenterXmlBoolean(required) === null) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_syscheck_question_required_invalid",
              `Original Testcenter system check '${sourceFileName}' contains invalid question required value '${required}' for '${questionId || "unknown"}'.`
            )
          );
        }
      }
      diagnostics.push(
        ...validateUniqueTestcenterXmlValues(
          questions.map(question => ({
            value: question.getAttribute("id")?.trim() ?? "",
            label: "question id"
          })),
          "testcenter_xml_syscheck_question_id_duplicate",
          sourceFileName
        )
      );
      const customTexts = xmlChildrenNamed(config, "CustomText");
      for (const customText of customTexts) {
        const customTextKey = customText.getAttribute("key")?.trim() ?? "";
        validateAttributes(customText, ["key"], "CustomText");
        validateSimpleContent(customText, "CustomText");
        if (!customTextKey) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_syscheck_custom_text_key_missing",
              `Original Testcenter system check '${sourceFileName}' contains CustomText without a key.`
            )
          );
        } else if (!isTestcenterXmlId(customTextKey)) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_syscheck_custom_text_key_invalid",
              `Original Testcenter system check '${sourceFileName}' contains CustomText key '${customTextKey}', which is not a valid XML ID.`
            )
          );
        }
      }
      diagnostics.push(
        ...validateUniqueTestcenterXmlValues(
          customTexts.map(customText => ({
            value: customText.getAttribute("key")?.trim() ?? "",
            label: "custom text key"
          })),
          "testcenter_xml_syscheck_custom_text_key_duplicate",
          sourceFileName
        )
      );
    }
  }

  if (canonicalRootName === "Testtakers") {
    const rosterSchemaVersion = parseTestcenterSchemaVersion(schemaLocation);
    const rosterSchemaSupports = (major: number, minor: number): boolean =>
      rosterSchemaVersion === null ||
      rosterSchemaVersion.major > major ||
      (rosterSchemaVersion.major === major &&
        rosterSchemaVersion.minor >= minor);
    const supportsMonitorProfiles = rosterSchemaSupports(15, 3);
    const supportsBookletStatePresets = rosterSchemaSupports(15, 4);
    const supportsExtendedMonitorProfiles = rosterSchemaSupports(15, 4);
    const supportsLoginViewSettings = rosterSchemaSupports(17, 6);
    const rosterSchemaLabel = rosterSchemaVersion
      ? `${rosterSchemaVersion.major}.${rosterSchemaVersion.minor}`
      : "unknown";
    const supportedLoginModes = new Set([
      "run-hot-return",
      "run-hot-restart",
      "run-trial",
      "run-review",
      "run-demo",
      "run-simulation",
      "monitor-group",
      "monitor-study",
      "sys-check-login"
    ]);
    const validateAttributes = (
      element: XmlElement,
      allowedAttributeNames: readonly string[],
      context: string
    ): void => {
      for (const attributeName of xmlUnsupportedAttributeNames(
        element,
        new Set(allowedAttributeNames)
      )) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_testtakers_attribute_invalid",
            `Original Testcenter roster '${sourceFileName}' contains unsupported attribute '${attributeName}' on ${context}.`
          )
        );
      }
    };
    const validateSimpleContent = (
      element: XmlElement,
      context: string
    ): void => {
      const nestedChildren = xmlChildElements(element);
      if (nestedChildren.length > 0) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_testtakers_simple_content_invalid",
            `Original Testcenter roster '${sourceFileName}' contains nested element '${xmlElementLocalName(nestedChildren[0])}' in text-only ${context}.`
          )
        );
      }
    };
    const directChildren = xmlChildElements(root);
    const directChildRanks = new Map([
      ["Metadata", 0],
      ["CustomTexts", 1],
      ["Profiles", 2],
      ["Group", 3]
    ]);
    let previousDirectChildRank = -1;
    for (const child of directChildren) {
      const childName = xmlElementLocalName(child);
      const rank = directChildRanks.get(childName);
      if (rank === undefined) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_testtakers_child_invalid",
            `Original Testcenter roster '${sourceFileName}' contains unsupported direct child '${childName}'.`
          )
        );
        continue;
      }
      if (rank < previousDirectChildRank) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_testtakers_sequence_invalid",
            `Original Testcenter roster '${sourceFileName}' contains direct children outside schema order.`
          )
        );
        break;
      }
      previousDirectChildRank = rank;
    }
    const metadataContainers = xmlChildrenNamed(root, "Metadata");
    const customTextContainers = xmlChildrenNamed(root, "CustomTexts");
    const profileContainers = xmlChildrenNamed(root, "Profiles");
    if (!supportsMonitorProfiles && profileContainers.length > 0) {
      diagnostics.push(
        createImportDiagnostic(
          "testcenter_xml_monitor_profiles_version_invalid",
          `Original Testcenter roster '${sourceFileName}' contains Profiles, which are not supported by schema ${rosterSchemaLabel}.`
        )
      );
    }
    if (
      metadataContainers.length > 1 ||
      customTextContainers.length > 1 ||
      profileContainers.length > 1
    ) {
      diagnostics.push(
        createImportDiagnostic(
          "testcenter_xml_testtakers_child_cardinality_invalid",
          `Original Testcenter roster '${sourceFileName}' contains repeated Metadata, CustomTexts, or Profiles elements.`
        )
      );
    }
    for (const metadataContainer of metadataContainers) {
      validateAttributes(metadataContainer, [], "Metadata");
      const metadataChildren = xmlChildElements(metadataContainer);
      for (const child of metadataChildren) {
        const childName = xmlElementLocalName(child);
        if (childName !== "Description") {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_metadata_child_invalid",
              `Original Testcenter roster '${sourceFileName}' contains unsupported Metadata child '${childName}'.`
            )
          );
          continue;
        }
        validateAttributes(child, [], "Metadata/Description");
        validateSimpleContent(child, "Metadata/Description");
      }
      if (xmlChildrenNamed(metadataContainer, "Description").length > 1) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_metadata_description_cardinality_invalid",
            `Original Testcenter roster '${sourceFileName}' contains repeated Metadata/Description elements.`
          )
        );
      }
    }
    for (const customTextContainer of customTextContainers) {
      validateAttributes(customTextContainer, [], "CustomTexts");
      const children = xmlChildElements(customTextContainer);
      if (children.length === 0) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_custom_texts_cardinality_invalid",
            `Original Testcenter roster '${sourceFileName}' contains CustomTexts without a CustomText.`
          )
        );
      }
      for (const child of children) {
        const childName = xmlElementLocalName(child);
        if (childName !== "CustomText") {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_custom_texts_child_invalid",
              `Original Testcenter roster '${sourceFileName}' contains unsupported CustomTexts child '${childName}'.`
            )
          );
          continue;
        }
        validateAttributes(child, ["key"], "CustomTexts/CustomText");
        validateSimpleContent(child, "CustomTexts/CustomText");
      }
    }
    for (const profileContainer of profileContainers) {
      validateAttributes(profileContainer, [], "Profiles");
      const children = xmlChildElements(profileContainer);
      for (const child of children) {
        const childName = xmlElementLocalName(child);
        if (childName !== "GroupMonitor") {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_profiles_child_invalid",
              `Original Testcenter roster '${sourceFileName}' contains unsupported Profiles child '${childName}'.`
            )
          );
        }
      }
      if (xmlChildrenNamed(profileContainer, "GroupMonitor").length > 1) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_profiles_child_cardinality_invalid",
            `Original Testcenter roster '${sourceFileName}' contains multiple Profiles/GroupMonitor elements.`
          )
        );
      }
    }
    const groups = xmlChildrenNamed(root, "Group");
    const customTexts = customTextContainers.flatMap(container =>
      xmlChildrenNamed(container, "CustomText")
    );
    for (const customText of customTexts) {
      if (!customText.getAttribute("key")?.trim()) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_custom_text_key_missing",
            `Original Testcenter roster '${sourceFileName}' contains CustomText without a key.`
          )
        );
      }
    }
    diagnostics.push(
      ...validateUniqueTestcenterXmlValues(
        customTexts.map(customText => ({
          value: customText.getAttribute("key")?.trim() ?? "",
          label: "custom text key"
        })),
        "testcenter_xml_custom_text_key_duplicate",
        sourceFileName
      )
    );

    const groupMonitorContainers = profileContainers.flatMap(container =>
      xmlChildrenNamed(container, "GroupMonitor")
    );
    for (const groupMonitorContainer of groupMonitorContainers) {
      validateAttributes(groupMonitorContainer, [], "Profiles/GroupMonitor");
      for (const child of xmlChildElements(groupMonitorContainer)) {
        const childName = xmlElementLocalName(child);
        if (childName !== "Profile") {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_group_monitor_child_invalid",
              `Original Testcenter roster '${sourceFileName}' contains unsupported GroupMonitor child '${childName}'.`
            )
          );
        }
      }
    }
    const monitorProfiles = groupMonitorContainers.flatMap(container =>
      xmlChildrenNamed(container, "Profile")
    );
    const monitorProfileIds = new Set(
      monitorProfiles
        .map(profile => profile.getAttribute("id")?.trim() ?? "")
        .filter(Boolean)
    );
    const monitorColumnAttributes = [
      "blockColumn",
      "unitColumn",
      "groupColumn",
      "bookletColumn"
    ];
    const monitorFilterFields = new Set([
      "bookletLabel",
      "personLabel",
      "state",
      "blockLabel",
      "groupName",
      "bookletId",
      "unitId",
      "unitLabel",
      "blockId",
      "testState",
      "mode",
      "bookletSpecies",
      "bookletStates"
    ]);
    for (const profile of monitorProfiles) {
      const profileId = profile.getAttribute("id")?.trim() ?? "";
      validateAttributes(
        profile,
        [
          "id",
          "label",
          "blockColumn",
          "unitColumn",
          "groupColumn",
          "bookletColumn",
          "bookletStatesColumns",
          "view",
          "filterPending",
          "filterLocked",
          "autoselectNextBlock"
        ],
        `monitor Profile '${profileId || "unknown"}'`
      );
      if (
        !supportsExtendedMonitorProfiles &&
        ["bookletStatesColumns", "autoselectNextBlock"].some(
          attributeName => profile.getAttribute(attributeName) !== null
        )
      ) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_monitor_profile_version_invalid",
            `Original Testcenter roster '${sourceFileName}' contains extended monitor Profile settings for '${profileId || "unknown"}', which are not supported by schema ${rosterSchemaLabel}.`
          )
        );
      }
      if (!profileId) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_monitor_profile_id_missing",
            `Original Testcenter roster '${sourceFileName}' contains a monitor Profile without an id.`
          )
        );
      }
      for (const attributeName of monitorColumnAttributes) {
        const value = profile.getAttribute(attributeName);
        if (value !== null && value !== "show" && value !== "hide") {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_monitor_profile_setting_invalid",
              `Original Testcenter roster '${sourceFileName}' contains invalid Profile/@${attributeName} '${value}' for '${profileId || "unknown"}'.`
            )
          );
        }
      }
      const view = profile.getAttribute("view");
      if (view !== null && !["full", "medium", "small"].includes(view)) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_monitor_profile_setting_invalid",
            `Original Testcenter roster '${sourceFileName}' contains invalid Profile/@view '${view}' for '${profileId || "unknown"}'.`
          )
        );
      }
      for (const attributeName of [
        "filterPending",
        "filterLocked",
        "autoselectNextBlock"
      ]) {
        const value = profile.getAttribute(attributeName);
        if (value !== null && value !== "yes" && value !== "no") {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_monitor_profile_setting_invalid",
              `Original Testcenter roster '${sourceFileName}' contains invalid Profile/@${attributeName} '${value}' for '${profileId || "unknown"}'.`
            )
          );
        }
      }
      const profileChildren = xmlChildElements(profile);
      for (const child of profileChildren) {
        const childName = xmlElementLocalName(child);
        if (childName !== "Filter") {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_monitor_profile_child_invalid",
              `Original Testcenter roster '${sourceFileName}' contains unsupported monitor Profile child '${childName}' for '${profileId || "unknown"}'.`
            )
          );
        }
      }
      for (const filter of profileChildren.filter(
        child => xmlElementLocalName(child) === "Filter"
      )) {
        validateAttributes(
          filter,
          ["label", "field", "type", "value", "subValue", "not"],
          `monitor Filter in Profile '${profileId || "unknown"}'`
        );
        validateSimpleContent(
          filter,
          `monitor Filter in Profile '${profileId || "unknown"}'`
        );
        const field = filter.getAttribute("field");
        if (
          !supportsExtendedMonitorProfiles &&
          (filter.getAttribute("subValue") !== null ||
            field === "bookletStates")
        ) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_monitor_filter_version_invalid",
              `Original Testcenter roster '${sourceFileName}' contains extended monitor Filter settings for '${profileId || "unknown"}', which are not supported by schema ${rosterSchemaLabel}.`
            )
          );
        }
        if (field !== null && !monitorFilterFields.has(field)) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_monitor_filter_field_invalid",
              `Original Testcenter roster '${sourceFileName}' contains invalid monitor Filter/@field '${field}' for '${profileId || "unknown"}'.`
            )
          );
        }
        const type = filter.getAttribute("type");
        if (type !== null && !["equal", "substring", "regex"].includes(type)) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_monitor_filter_type_invalid",
              `Original Testcenter roster '${sourceFileName}' contains invalid monitor Filter/@type '${type}' for '${profileId || "unknown"}'.`
            )
          );
        }
        const not = filter.getAttribute("not");
        if (not !== null && parseTestcenterXmlBoolean(not) === null) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_monitor_filter_not_invalid",
              `Original Testcenter roster '${sourceFileName}' contains invalid monitor Filter/@not '${not}' for '${profileId || "unknown"}'.`
            )
          );
        }
      }
    }
    diagnostics.push(
      ...validateUniqueTestcenterXmlValues(
        monitorProfiles.map(profile => ({
          value: profile.getAttribute("id")?.trim() ?? "",
          label: "monitor profile id"
        })),
        "testcenter_xml_monitor_profile_id_duplicate",
        sourceFileName
      )
    );

    if (groups.length === 0) {
      diagnostics.push(
        createImportDiagnostic(
          "testcenter_xml_groups_missing",
          `Original Testcenter roster '${sourceFileName}' requires at least one Group.`
        )
      );
    }
    const logins = groups.flatMap(group => xmlChildrenNamed(group, "Login"));
    for (const group of groups) {
      validateAttributes(
        group,
        ["id", "label", "validFrom", "validTo", "validFor"],
        `Group '${group.getAttribute("id")?.trim() || "unknown"}'`
      );
      const groupChildren = xmlChildElements(group);
      for (const child of groupChildren) {
        const childName = xmlElementLocalName(child);
        if (childName !== "Login") {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_group_child_invalid",
              `Original Testcenter roster '${sourceFileName}' contains unsupported Group child '${childName}' for '${group.getAttribute("id")?.trim() || "unknown"}'.`
            )
          );
        }
      }
      if (xmlChildrenNamed(group, "Login").length === 0) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_group_logins_missing",
            `Original Testcenter roster '${sourceFileName}' requires Group '${group.getAttribute("id")?.trim() || "unknown"}' to contain at least one Login.`
          )
        );
      }
      if (!group.getAttribute("id")?.trim()) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_group_id_missing",
            `Original Testcenter roster '${sourceFileName}' contains a Group without an id.`
          )
        );
      }
      if (!group.getAttribute("label")?.trim()) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_group_label_missing",
            `Original Testcenter roster '${sourceFileName}' contains a Group without a label.`
          )
        );
      }
      const normalizedAccessBoundaries = new Map<string, string>();
      for (const attributeName of ["validFrom", "validTo"]) {
        const value = group.getAttribute(attributeName);
        if (value === null) {
          continue;
        }
        const normalized = normalizeParticipantAccessBoundary(value);
        if (
          !/^\d{1,2}\/\d{1,2}\/\d{2,4}\W\d{1,2}:\d{2}$/.test(value) ||
          !normalized
        ) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_group_access_boundary_invalid",
              `Original Testcenter roster '${sourceFileName}' contains invalid Group/@${attributeName} '${value}' for '${group.getAttribute("id")?.trim() || "unknown"}'.`
            )
          );
        } else {
          normalizedAccessBoundaries.set(attributeName, normalized);
        }
      }
      const validFrom = normalizedAccessBoundaries.get("validFrom");
      const validTo = normalizedAccessBoundaries.get("validTo");
      if (validFrom && validTo && Date.parse(validFrom) > Date.parse(validTo)) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_group_access_window_invalid",
            `Original Testcenter roster '${sourceFileName}' contains Group/@validFrom after Group/@validTo for '${group.getAttribute("id")?.trim() || "unknown"}'.`
          )
        );
      }
      const validFor = group.getAttribute("validFor");
      if (
        validFor !== null &&
        (!isTestcenterXmlInteger(validFor) ||
          !Number.isSafeInteger(Number(validFor)) ||
          Number(validFor) <= 0)
      ) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_group_valid_for_invalid",
            `Original Testcenter roster '${sourceFileName}' contains invalid Group/@validFor '${validFor}' for '${group.getAttribute("id")?.trim() || "unknown"}'.`
          )
        );
      }
    }
    for (const login of logins) {
      const loginName = login.getAttribute("name")?.trim() || "unknown";
      validateAttributes(
        login,
        ["name", "pw", "mode", "monitorcode"],
        `Login '${loginName}'`
      );
      const loginChildren = xmlChildElements(login);
      let viewSettingsSeen = false;
      for (const child of loginChildren) {
        const childName = xmlElementLocalName(child);
        if (!["Booklet", "Profile", "ViewSettings"].includes(childName)) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_login_child_invalid",
              `Original Testcenter roster '${sourceFileName}' contains unsupported Login child '${childName}' for '${login.getAttribute("name")?.trim() || "unknown"}'.`
            )
          );
          continue;
        }
        if (childName === "ViewSettings") {
          viewSettingsSeen = true;
        } else if (viewSettingsSeen) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_login_sequence_invalid",
              `Original Testcenter roster '${sourceFileName}' contains an assignment after ViewSettings for login '${login.getAttribute("name")?.trim() || "unknown"}'.`
            )
          );
          break;
        }
      }
      if (!login.getAttribute("name")?.trim()) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_login_name_missing",
            `Original Testcenter roster '${sourceFileName}' contains a Login without a name.`
          )
        );
      }
      const mode = login.getAttribute("mode")?.trim();
      if (mode && !supportedLoginModes.has(mode)) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_login_mode_invalid",
            `Original Testcenter roster '${sourceFileName}' contains unsupported login mode '${mode}'.`
          )
        );
      }
      const loginBooklets = xmlChildrenNamed(login, "Booklet");
      const loginProfiles = xmlChildrenNamed(login, "Profile");
      if (!supportsMonitorProfiles && loginProfiles.length > 0) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_monitor_profiles_version_invalid",
            `Original Testcenter roster '${sourceFileName}' assigns monitor Profiles to login '${loginName}', which is not supported by schema ${rosterSchemaLabel}.`
          )
        );
      }
      if (loginBooklets.length > 0 && loginProfiles.length > 0) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_login_assignment_choice_invalid",
            `Original Testcenter roster '${sourceFileName}' mixes Booklet and Profile assignments for login '${login.getAttribute("name")?.trim() || "unknown"}'.`
          )
        );
      }
      for (const booklet of loginBooklets) {
        validateAttributes(
          booklet,
          ["codes", "state"],
          `Booklet assignment for login '${loginName}'`
        );
        validateSimpleContent(
          booklet,
          `Booklet assignment for login '${loginName}'`
        );
        const state = booklet.getAttribute("state");
        if (state !== null && !supportsBookletStatePresets) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_booklet_state_version_invalid",
              `Original Testcenter roster '${sourceFileName}' contains Booklet/@state for login '${loginName}', which is not supported by schema ${rosterSchemaLabel}.`
            )
          );
        }
        if (
          state !== null &&
          !/^[a-z\d-]+:[a-z\d-]+(?:\s*,\s*[a-z\d-]+:[a-z\d-]+)*$/.test(
            state.trim()
          )
        ) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_booklet_state_preset_invalid",
              `Original Testcenter roster '${sourceFileName}' contains invalid Booklet/@state '${state}' for login '${login.getAttribute("name")?.trim() || "unknown"}'.`
            )
          );
        }
      }
      for (const profileReference of loginProfiles) {
        validateAttributes(
          profileReference,
          ["id"],
          `Profile assignment for login '${loginName}'`
        );
        validateSimpleContent(
          profileReference,
          `Profile assignment for login '${loginName}'`
        );
        const profileId = profileReference.getAttribute("id")?.trim() ?? "";
        if (!profileId) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_monitor_profile_reference_id_missing",
              `Original Testcenter roster '${sourceFileName}' contains a Profile reference without an id for login '${login.getAttribute("name")?.trim() || "unknown"}'.`
            )
          );
        } else if (!monitorProfileIds.has(profileId)) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_monitor_profile_reference_missing",
              `Original Testcenter roster '${sourceFileName}' references unknown monitor Profile '${profileId}' for login '${login.getAttribute("name")?.trim() || "unknown"}'.`
            )
          );
        }
      }
      const viewSettings = xmlChildrenNamed(login, "ViewSettings");
      if (viewSettings.length > 1) {
        diagnostics.push(
          createImportDiagnostic(
            "testcenter_xml_login_view_settings_cardinality_invalid",
            `Original Testcenter roster '${sourceFileName}' contains repeated ViewSettings for login '${login.getAttribute("name")?.trim() || "unknown"}'.`
          )
        );
      }
      for (const viewSetting of viewSettings) {
        if (!supportsLoginViewSettings) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_login_view_settings_version_invalid",
              `Original Testcenter roster '${sourceFileName}' contains ViewSettings for login '${loginName}', which are not supported by schema ${rosterSchemaLabel}.`
            )
          );
        }
        validateAttributes(
          viewSetting,
          ["monitorBookletVisibility"],
          `ViewSettings for login '${loginName}'`
        );
        if (xmlChildElements(viewSetting).length > 0) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_login_view_settings_child_invalid",
              `Original Testcenter roster '${sourceFileName}' contains nested elements in ViewSettings for login '${loginName}'.`
            )
          );
        }
        const visibility = viewSetting.getAttribute("monitorBookletVisibility");
        if (
          visibility !== null &&
          !["visible", "collapsed", "hidden"].includes(visibility)
        ) {
          diagnostics.push(
            createImportDiagnostic(
              "testcenter_xml_login_booklet_visibility_invalid",
              `Original Testcenter roster '${sourceFileName}' contains invalid ViewSettings/@monitorBookletVisibility '${visibility}' for login '${login.getAttribute("name")?.trim() || "unknown"}'.`
            )
          );
        }
      }
    }
    diagnostics.push(
      ...validateUniqueTestcenterXmlValues(
        groups.map(group => ({
          value: group.getAttribute("id")?.trim() ?? "",
          label: "group id"
        })),
        "testcenter_xml_group_id_duplicate",
        sourceFileName
      ),
      ...validateUniqueTestcenterXmlValues(
        logins.map(login => ({
          value: login.getAttribute("name")?.trim() ?? "",
          label: "login name"
        })),
        "testcenter_xml_login_name_duplicate",
        sourceFileName
      )
    );
  }

  return diagnostics;
};

const resolveXmlManifestPath = (...segments: Array<string | undefined>): string => {
  let resolvedPath = "";

  for (const segment of segments) {
    const normalizedSegment = normalizeManifestToken(segment);
    if (!normalizedSegment) {
      continue;
    }

    if (/^[a-z][a-z0-9+.-]*:/i.test(normalizedSegment)) {
      resolvedPath = normalizedSegment;
      continue;
    }

    resolvedPath = resolvedPath
      ? `${resolvedPath.replace(/\/+$/, "")}/${normalizedSegment.replace(/^\/+/, "")}`
      : normalizedSegment;
  }

  if (/^[a-z][a-z0-9+.-]*:/i.test(resolvedPath)) {
    return resolvedPath;
  }

  const pathSegments: string[] = [];
  for (const pathSegment of resolvedPath.replace(/\\/g, "/").split("/")) {
    if (!pathSegment || pathSegment === ".") {
      continue;
    }

    if (pathSegment === "..") {
      pathSegments.pop();
      continue;
    }

    pathSegments.push(pathSegment);
  }

  return pathSegments.join("/");
};

type XmlManifestResource = {
  key: string;
  displayLabel: string;
  dependencyReferences: string[];
};

const xmlManifestResourcePattern =
  /<((?:[a-zA-Z_][\w.-]*:)?resource)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/gi;

const collectXmlManifestResourceIdentifiers = (
  sourceDocument: string
): string[] =>
  [...sourceDocument.matchAll(xmlManifestResourcePattern)]
    .map(resourceMatch =>
      normalizeManifestToken(
        readXmlAttribute(
          parseXmlAttributes(resourceMatch[2] ?? ""),
          "identifier",
          "id",
          "key",
          "resourceId",
          "resourceIdentifier"
        )
      )
    )
    .filter((identifier): identifier is string => Boolean(identifier));

const collectXmlManifestResources = (
  sourceDocument: string
): Map<string, XmlManifestResource> => {
  const resources = new Map<string, XmlManifestResource>();
  const manifestAttributes = parseXmlAttributes(
    sourceDocument.match(
      /<((?:[a-zA-Z_][\w.-]*:)?manifest)\b([^>]*?)(?:\/>|>)/i
    )?.[2] ?? ""
  );
  const manifestBasePath = readXmlAttribute(
    manifestAttributes,
    "xml:base",
    "base"
  );

  for (const resourceMatch of sourceDocument.matchAll(
    xmlManifestResourcePattern
  )) {
    const resourceAttributes = parseXmlAttributes(resourceMatch[2] ?? "");
    const identifier = normalizeManifestToken(
      readXmlAttribute(
        resourceAttributes,
        "identifier",
        "id",
        "key",
        "resourceId",
        "resourceIdentifier"
      )
    );
    if (!identifier) {
      continue;
    }

    const resourceContent = resourceMatch[3] ?? "";
    const fileMatch = resourceContent.match(
      /<((?:[a-zA-Z_][\w.-]*:)?file)\b([^>]*?)(?:\/>|>[\s\S]*?<\/\1>)/i
    );
    const fileAttributes = fileMatch ? parseXmlAttributes(fileMatch[2] ?? "") : {};
    const resourceBasePath = readXmlAttribute(
      resourceAttributes,
      "xml:base",
      "base"
    );
    const fileBasePath = readXmlAttribute(fileAttributes, "xml:base", "base");
    const rawHref =
      readXmlAttribute(
        resourceAttributes,
        "href",
        "path",
        "src",
        "uri",
        "file",
        "fileName",
        "filename"
      ) ??
        readXmlAttribute(
          fileAttributes,
          "href",
          "path",
          "src",
          "uri",
          "file",
          "fileName",
          "filename"
        ) ??
        identifier;
    const key = resolveXmlManifestPath(
      manifestBasePath,
      resourceBasePath,
      fileBasePath,
      rawHref
    );
    const displayLabel = normalizeManifestLabel(
      readXmlAttribute(
        resourceAttributes,
        "displayLabel",
        "label",
        "title",
        "name",
        "displayName"
      ) ?? readXmlChildText(resourceContent, "title", "label"),
      "Resource",
      key
    );
    const dependencyReferences = [
      ...resourceContent.matchAll(
        /<((?:[a-zA-Z_][\w.-]*:)?dependency)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/gi
      )
    ]
      .map(dependencyMatch =>
        normalizeManifestToken(
          readXmlAttribute(
            parseXmlAttributes(dependencyMatch[2] ?? ""),
            "identifierref",
            "identifierRef",
            "ref",
            "resourceId",
            "resourceIdentifier",
            "identifier",
            "id"
          ) ??
            readXmlChildText(
              dependencyMatch[3] ?? "",
              "identifierref",
              "identifierRef",
              "ref",
              "resourceId",
              "resourceIdentifier",
              "identifier",
              "id"
            )
        )
      )
      .filter((dependencyReference): dependencyReference is string =>
        Boolean(dependencyReference)
      );

    resources.set(identifier, { key, displayLabel, dependencyReferences });
  }

  return resources;
};

type XmlManifestItemNode = {
  attributes: Record<string, string>;
  children: XmlManifestItemNode[];
  contentStart: number;
  contentEnd: number;
};

const collectXmlManifestItems = (sourceDocument: string): XmlManifestItemNode[] => {
  const root: XmlManifestItemNode = {
    attributes: {},
    children: [],
    contentStart: 0,
    contentEnd: sourceDocument.length
  };
  const stack: XmlManifestItemNode[] = [root];

  for (const match of sourceDocument.matchAll(
    /<(\/)?((?:[a-zA-Z_][\w.-]*:)?item)\b([^>]*?)(\/?)>/gi
  )) {
    if (match[1]) {
      const current = stack.pop();
      if (current && current !== root) {
        current.contentEnd = match.index ?? current.contentEnd;
      }
      if (stack.length === 0) {
        stack.push(root);
      }
      continue;
    }

    const node: XmlManifestItemNode = {
      attributes: parseXmlAttributes(match[3] ?? ""),
      children: [],
      contentStart: (match.index ?? 0) + match[0].length,
      contentEnd: (match.index ?? 0) + match[0].length
    };
    stack.at(-1)?.children.push(node);

    if (!match[4]) {
      stack.push(node);
    }
  }

  return root.children;
};

const collectXmlOrganizationItemSourceDocuments = (
  sourceDocument: string
): string[] => {
  const organizationItemSourceDocuments: string[] = [];

  for (const organizationsMatch of sourceDocument.matchAll(
    /<((?:[a-zA-Z_][\w.-]*:)?organizations)\b([^>]*?)>([\s\S]*?)<\/\1>/gi
  )) {
    const organizationsAttributes = parseXmlAttributes(
      organizationsMatch[2] ?? ""
    );
    const defaultOrganizationKey = normalizeManifestToken(
      readXmlAttribute(
        organizationsAttributes,
        "default",
        "defaultOrganization",
        "defaultOrganisation",
        "defaultOrganizationId",
        "defaultOrganisationId",
        "defaultOrg"
      )
    );
    const organizationMatches = [
      ...(organizationsMatch[3] ?? "").matchAll(
        /<((?:[a-zA-Z_][\w.-]*:)?organization)\b([^>]*?)>([\s\S]*?)<\/\1>/gi
      )
    ];
    if (organizationMatches.length === 0) {
      continue;
    }

    const selectedOrganizationMatches = defaultOrganizationKey
      ? organizationMatches.filter(organizationMatch => {
          const organizationAttributes = parseXmlAttributes(
            organizationMatch[2] ?? ""
          );
          return (
            normalizeManifestToken(
              readXmlAttribute(
                organizationAttributes,
                "identifier",
                "id",
                "key",
                "organizationId",
                "organisationId"
              )
            ) === defaultOrganizationKey
          );
        })
      : organizationMatches;

    organizationItemSourceDocuments.push(
      ...selectedOrganizationMatches.map(
        organizationMatch => organizationMatch[3] ?? ""
      )
    );
  }

  return organizationItemSourceDocuments;
};

const collectXmlOrganizationBookletEntries = (
  sourceDocument: string
): SourcePackageContentStructure["bookletEntries"] => {
  const resources = collectXmlManifestResources(sourceDocument);
  if (resources.size === 0) {
    return [];
  }

  const organizationItemSourceDocuments =
    collectXmlOrganizationItemSourceDocuments(sourceDocument);
  const itemSourceDocuments =
    organizationItemSourceDocuments.length > 0
      ? organizationItemSourceDocuments
      : [sourceDocument];

  return itemSourceDocuments
    .flatMap(itemSourceDocument =>
      collectXmlManifestItems(itemSourceDocument).map(item => ({
        item,
        itemSourceDocument
      }))
    )
    .map(item => {
      const bookletReference = normalizeManifestToken(
        readXmlAttribute(
          item.item.attributes,
          "identifierref",
          "identifierRef",
          "ref"
        )
      );
      const bookletResource = resources.get(bookletReference);
      if (
        !bookletReference ||
        !bookletResource ||
        item.item.children.length === 0
      ) {
        return null;
      }

      const bookletContent = item.itemSourceDocument.slice(
        item.item.contentStart,
        item.item.contentEnd
      );
      return {
        bookletKey: bookletResource.key,
        displayLabel: normalizeManifestToken(
          readXmlChildText(bookletContent, "title", "label") ??
            readXmlAttribute(
              item.item.attributes,
              "displayLabel",
              "label",
              "title",
              "name",
              "displayName"
            ) ??
            bookletResource.displayLabel
        ),
        unitEntries: item.item.children
          .map(unitItem => {
            const unitReference = normalizeManifestToken(
              readXmlAttribute(
                unitItem.attributes,
                "identifierref",
                "identifierRef",
                "ref"
              )
            );
            const unitResource = resources.get(unitReference);
            if (!unitReference || !unitResource) {
              return null;
            }

            const unitContent = item.itemSourceDocument.slice(
              unitItem.contentStart,
              unitItem.contentEnd
            );
            return {
              unitKey: unitResource.key,
              displayLabel: normalizeManifestToken(
                readXmlChildText(unitContent, "title", "label") ??
                  readXmlAttribute(
                    unitItem.attributes,
                    "displayLabel",
                    "label",
                    "title",
                    "name",
                    "displayName"
                  ) ??
                  unitResource.displayLabel
              )
            };
          })
          .filter(Boolean) as SourcePackageContentStructure["bookletEntries"][number]["unitEntries"]
      };
    })
    .filter(Boolean) as SourcePackageContentStructure["bookletEntries"];
};

const collectXmlResourceDependencyBookletEntries = (
  sourceDocument: string
): SourcePackageContentStructure["bookletEntries"] => {
  const resources = collectXmlManifestResources(sourceDocument);
  if (resources.size === 0) {
    return [];
  }

  return [...resources.values()]
    .map(resource => {
      const unitEntries = resource.dependencyReferences
        .map(dependencyReference => resources.get(dependencyReference))
        .filter((dependencyResource): dependencyResource is XmlManifestResource =>
          Boolean(dependencyResource)
        )
        .map(dependencyResource => ({
          unitKey: dependencyResource.key,
          displayLabel: dependencyResource.displayLabel
        }));

      if (unitEntries.length === 0) {
        return null;
      }

      return {
        bookletKey: resource.key,
        displayLabel: resource.displayLabel,
        unitEntries
      };
    })
    .filter(Boolean) as SourcePackageContentStructure["bookletEntries"];
};

const collectXmlManifestResourceContentPathCandidates = (
  sourceDocument: string
): Map<string, string[]> => {
  const resources = collectXmlManifestResources(sourceDocument);
  const candidatesByResourceKey = new Map<string, string[]>();
  const collectResourceCandidates = (
    resource: XmlManifestResource,
    visitedResourceIdentifiers: Set<string>
  ): string[] => {
    const candidates = [resource.key];

    for (const dependencyReference of resource.dependencyReferences) {
      if (visitedResourceIdentifiers.has(dependencyReference)) {
        continue;
      }

      const dependencyResource = resources.get(dependencyReference);
      if (!dependencyResource) {
        continue;
      }

      visitedResourceIdentifiers.add(dependencyReference);
      candidates.push(
        ...collectResourceCandidates(
          dependencyResource,
          visitedResourceIdentifiers
        )
      );
    }

    return candidates;
  };

  for (const [resourceIdentifier, resource] of resources) {
    const candidates = [
      ...new Set(
        collectResourceCandidates(resource, new Set([resourceIdentifier]))
      )
    ];
    candidatesByResourceKey.set(resource.key, candidates);
    candidatesByResourceKey.set(resourceIdentifier, candidates);
  }

  return candidatesByResourceKey;
};

const readXmlUnitEntryKey = (
  unitAttributes: Record<string, string>,
  unitContent: string
): string =>
  String(
    readXmlAttribute(
      unitAttributes,
      "unitKey",
      "alias",
      "unitId",
      "identifier",
      "key",
      "id",
      "ref",
      "identifierref",
      "identifierRef",
      "code",
      "path",
      "src",
      "uri",
      "file",
      "fileName",
      "filename",
      "resourceId",
      "moduleId",
      "taskId",
      "href",
      "name"
    ) ??
      readXmlChildText(
        unitContent,
        "unitKey",
        "alias",
        "unitId",
        "identifier",
        "key",
        "id",
        "ref",
        "identifierref",
        "identifierRef",
        "code",
        "path",
        "src",
        "uri",
        "file",
        "fileName",
        "filename",
        "resourceId",
        "moduleId",
        "taskId",
        "href",
        "name"
      ) ??
      ""
  ).trim();

const readXmlUnitEntryIdentity = (
  unitAttributes: Record<string, string>,
  unitContent: string
): string =>
  String(
    readXmlAttribute(
      unitAttributes,
      "unitId",
      "identifier",
      "key",
      "id",
      "ref",
      "identifierref",
      "identifierRef",
      "resourceId",
      "moduleId",
      "taskId"
    ) ??
      readXmlChildText(
        unitContent,
        "unitId",
        "identifier",
        "key",
        "id",
        "ref",
        "identifierref",
        "identifierRef",
        "resourceId",
        "moduleId",
        "taskId"
      ) ??
      ""
  ).trim();

type XmlBookletHierarchy = {
  customTexts: Record<string, string>;
  rootRestrictions?: BookletRootRestrictions;
  stateEntries: SourcePackageBookletStateEntry[];
  testletEntries: SourcePackageTestletEntry[];
  unitTestletPaths: Map<string, string[]>;
};

const collectXmlBookletHierarchies = (
  sourceDocument: string
): Map<string, XmlBookletHierarchy> => {
  const hierarchies = new Map<string, XmlBookletHierarchy>();
  let document: XmlDocument | null = null;
  try {
    document = new DOMParser({
      onError() {
        // Package payloads can contain non-XML resource files. They are ignored here
        // and validated by their own import path instead of leaking parser diagnostics.
      }
    }).parseFromString(sourceDocument, "application/xml");
  } catch {
    return hierarchies;
  }
  const root = document?.documentElement;
  if (!root) {
    return hierarchies;
  }
  const bookletElements = [
    ...(xmlElementLocalName(root).toLowerCase() === "booklet" ? [root] : []),
    ...xmlDescendantsNamed(root, "Booklet")
  ];

  for (const booklet of bookletElements) {
    const metadata = xmlChildrenNamed(booklet, "Metadata")[0];
    const bookletKey =
      booklet.getAttribute("id")?.trim() ||
      (metadata ? xmlElementText(xmlChildrenNamed(metadata, "Id")[0]) : "");
    const units = xmlChildrenNamed(booklet, "Units")[0];
    if (!bookletKey || !units) {
      continue;
    }
    const customTextContainer = xmlChildrenNamed(booklet, "CustomTexts")[0];
    const customTexts = Object.fromEntries(
      (customTextContainer
        ? xmlChildrenNamed(customTextContainer, "CustomText")
        : []
      ).flatMap(customText => {
        const key = customText.getAttribute("key")?.trim() ?? "";
        return key ? [[key, xmlElementText(customText).trim()] as const] : [];
      })
    );
    const testletEntries: SourcePackageTestletEntry[] = [];
    const unitTestletPaths = new Map<string, string[]>();
    const normalizeLeaveRestriction = (
      value: string | null
    ): BookletLeaveRestriction | undefined => {
      switch (value?.trim().toUpperCase()) {
        case "ALWAYS":
          return "always";
        case "ON":
          return "forward";
        case "OFF":
          return "off";
        default:
          return undefined;
      }
    };

    const parseVariableSource = (
      sourceElement: XmlElement
    ): BookletStateVariableSource | null => {
      const type = xmlElementLocalName(sourceElement);
      if (
        type !== "Code" &&
        type !== "Value" &&
        type !== "Status" &&
        type !== "Score"
      ) {
        return null;
      }
      const variableKey = sourceElement.getAttribute("of")?.trim() || "";
      const unitKey = sourceElement.getAttribute("from")?.trim() || "";
      if (!variableKey || !unitKey) {
        return null;
      }
      return {
        type,
        variableKey,
        unitKey,
        defaultValue: sourceElement.getAttribute("or")?.trim() || "0"
      };
    };
    const parseCondition = (ifElement: XmlElement): BookletStateCondition[] => {
      const expressionElement = xmlChildrenNamed(ifElement, "Is")[0];
      if (!expressionElement) {
        return [];
      }
      const sourceElement = [...xmlChildElements(ifElement)].reverse().find(child =>
        [
          "Code",
          "Value",
          "Status",
          "Score",
          "Sum",
          "Median",
          "Mean",
          "Count"
        ].includes(xmlElementLocalName(child))
      );
      if (!sourceElement) {
        return [];
      }
      const sourceType = xmlElementLocalName(sourceElement);
      let source: BookletStateCondition["source"] | null =
        parseVariableSource(sourceElement);
      if (sourceType === "Sum" || sourceType === "Median" || sourceType === "Mean") {
        const sources = xmlChildElements(sourceElement).flatMap(child => {
          const parsed = parseVariableSource(child);
          return parsed ? [parsed] : [];
        });
        source = { type: sourceType, sources };
      } else if (sourceType === "Count") {
        source = {
          type: "Count",
          conditions: xmlChildrenNamed(sourceElement, "If").flatMap(parseCondition)
        };
      }
      if (!source) {
        return [];
      }
      return (["equal", "notEqual", "greaterThan", "lowerThan"] as const)
        .flatMap(expressionType => {
          const value = expressionElement.getAttribute(expressionType);
          return value == null
            ? []
            : [{ source, expression: { type: expressionType, value } }];
        });
    };
    const statesElement = xmlChildrenNamed(booklet, "States")[0];
    const stateEntries: SourcePackageBookletStateEntry[] = statesElement
      ? xmlChildrenNamed(statesElement, "State").flatMap(stateElement => {
          const stateKey = stateElement.getAttribute("id")?.trim() || "";
          if (!stateKey) {
            return [];
          }
          const options = xmlChildElements(stateElement).flatMap(optionElement => {
            const optionElementName = xmlElementLocalName(optionElement);
            if (optionElementName !== "Option" && optionElementName !== "DefaultOption") {
              return [];
            }
            const optionKey = optionElement.getAttribute("id")?.trim() || "";
            return optionKey
              ? [{
                  optionKey,
                  displayLabel:
                    optionElement.getAttribute("label")?.trim() || optionKey,
                  conditions: xmlChildrenNamed(optionElement, "If").flatMap(parseCondition)
                }]
              : [];
          });
          return options.length > 0
            ? [{
                stateKey,
                displayLabel: stateElement.getAttribute("label")?.trim() || stateKey,
                options
              }]
            : [];
        })
      : [];
    const rootRestrictionsElement = xmlChildrenNamed(units, "Restrictions")[0];
    const rootTimeMaxElement = rootRestrictionsElement
      ? xmlChildrenNamed(rootRestrictionsElement, "TimeMax")[0]
      : undefined;
    const rootDenyNavigationElement = rootRestrictionsElement
      ? xmlChildrenNamed(
          rootRestrictionsElement,
          "DenyNavigationOnIncomplete"
        )[0]
      : undefined;
    const rootTimeMaxMinutes = Number(
      rootTimeMaxElement?.getAttribute("minutes")?.trim() ?? ""
    );
    const rootTimeMaxLeave = rootTimeMaxElement?.getAttribute("leave")?.trim();
    const rootDenyPresentation = normalizeLeaveRestriction(
      rootDenyNavigationElement?.getAttribute("presentation") ?? null
    );
    const rootDenyResponse = normalizeLeaveRestriction(
      rootDenyNavigationElement?.getAttribute("response") ?? null
    );
    const rootRestrictions: BookletRootRestrictions = {
      ...(Number.isFinite(rootTimeMaxMinutes) && rootTimeMaxMinutes > 0
        ? {
            timeMax: {
              minutes: rootTimeMaxMinutes,
              leave:
                rootTimeMaxLeave === "forbidden" ||
                rootTimeMaxLeave === "allowed"
                  ? rootTimeMaxLeave
                  : "confirm"
            }
          }
        : {}),
      ...(rootDenyPresentation || rootDenyResponse
        ? {
            denyNavigationOnIncomplete: {
              ...(rootDenyPresentation
                ? { presentation: rootDenyPresentation }
                : {}),
              ...(rootDenyResponse ? { response: rootDenyResponse } : {})
            }
          }
        : {})
    };

    const visitContainer = (
      container: XmlElement,
      testletPath: string[]
    ): void => {
      for (let index = 0; index < container.childNodes.length; index += 1) {
        const node = container.childNodes.item(index);
        if (!node || node.nodeType !== 1) {
          continue;
        }
        const element = node as XmlElement;
        const elementName = xmlElementLocalName(element).toLowerCase();
        if (elementName === "unit") {
          const unitKey =
            element.getAttribute("alias")?.trim() ||
            element.getAttribute("id")?.trim() ||
            "";
          if (unitKey && testletPath.length > 0) {
            unitTestletPaths.set(unitKey, [...testletPath]);
          }
          continue;
        }
        if (elementName !== "testlet") {
          continue;
        }

        const testletKey = element.getAttribute("id")?.trim() || "";
        if (!testletKey) {
          continue;
        }
        const restrictionsElement = xmlChildrenNamed(element, "Restrictions")[0];
        const codeElement = restrictionsElement
          ? xmlChildrenNamed(restrictionsElement, "CodeToEnter")[0]
          : undefined;
        const showElement = restrictionsElement
          ? xmlChildrenNamed(restrictionsElement, "Show")[0]
          : undefined;
        const timeMaxElement = restrictionsElement
          ? xmlChildrenNamed(restrictionsElement, "TimeMax")[0]
          : undefined;
        const denyNavigationElement = restrictionsElement
          ? xmlChildrenNamed(restrictionsElement, "DenyNavigationOnIncomplete")[0]
          : undefined;
        const lockAfterLeavingElement = restrictionsElement
          ? xmlChildrenNamed(restrictionsElement, "LockAfterLeaving")[0]
          : undefined;
        const code = codeElement?.getAttribute("code")?.trim() || "";
        const timeMaxMinutes = Number(
          timeMaxElement?.getAttribute("minutes")?.trim() ?? ""
        );
        const timeMaxLeave = timeMaxElement?.getAttribute("leave")?.trim();
        const denyPresentation = normalizeLeaveRestriction(
          denyNavigationElement?.getAttribute("presentation") ?? null
        );
        const denyResponse = normalizeLeaveRestriction(
          denyNavigationElement?.getAttribute("response") ?? null
        );
        const lockScope = lockAfterLeavingElement?.getAttribute("scope")?.trim();
        const restrictions: NonNullable<
          SourcePackageTestletEntry["restrictions"]
        > = {
          ...(showElement?.getAttribute("if")?.trim() &&
          showElement.getAttribute("is")?.trim()
            ? {
                show: {
                  stateKey: showElement.getAttribute("if")!.trim(),
                  optionKey: showElement.getAttribute("is")!.trim()
                }
              }
            : {}),
          ...(code
            ? {
                codeToEnter: {
                  code,
                  prompt:
                    xmlElementText(codeElement) || "Enter the block code."
                }
              }
            : {}),
          ...(Number.isFinite(timeMaxMinutes) && timeMaxMinutes > 0
            ? {
                timeMax: {
                  minutes: timeMaxMinutes,
                  leave:
                    timeMaxLeave === "forbidden" || timeMaxLeave === "allowed"
                      ? timeMaxLeave
                      : "confirm"
                }
              }
            : {}),
          ...(denyPresentation || denyResponse
            ? {
                denyNavigationOnIncomplete: {
                  ...(denyPresentation
                    ? { presentation: denyPresentation }
                    : {}),
                  ...(denyResponse ? { response: denyResponse } : {})
                }
              }
            : {}),
          ...(lockAfterLeavingElement
            ? {
                lockAfterLeaving: {
                  confirm:
                    parseTestcenterXmlBoolean(
                      lockAfterLeavingElement.getAttribute("confirm")
                    ) ?? false,
                  scope: lockScope === "unit" ? "unit" : "testlet"
                }
              }
            : {})
        };
        testletEntries.push({
          testletKey,
          displayLabel:
            element.getAttribute("label")?.trim() ||
            toDisplayLabel("Block", testletKey) ||
            testletKey,
          parentTestletKey: testletPath.at(-1) ?? null,
          ...(Object.keys(restrictions).length > 0 ? { restrictions } : {})
        });
        visitContainer(element, [...testletPath, testletKey]);
      }
    };

    visitContainer(units, []);
    hierarchies.set(bookletKey, {
      customTexts,
      ...(Object.keys(rootRestrictions).length > 0 ? { rootRestrictions } : {}),
      stateEntries,
      testletEntries,
      unitTestletPaths
    });
  }

  return hierarchies;
};

const collectXmlBookletEntries = (
  sourceDocument: string,
  bookletTagNames: string
): SourcePackageContentStructure["bookletEntries"] => {
  const bookletEntries: SourcePackageContentStructure["bookletEntries"] = [];
  const hierarchies = collectXmlBookletHierarchies(sourceDocument);

  const readBookletConfig = (bookletContent: string): Record<string, string> => {
    const configContent = bookletContent.match(
      /<((?:[a-zA-Z_][\w.-]*:)?BookletConfig)\b[^>]*>([\s\S]*?)<\/\1>/i
    )?.[2];
    if (!configContent) {
      return {};
    }
    return Object.fromEntries(
      [...configContent.matchAll(
        /<((?:[a-zA-Z_][\w.-]*:)?Config)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/gi
      )].flatMap(configMatch => {
        const attributes = parseXmlAttributes(configMatch[2] ?? "");
        const key = normalizeManifestToken(
          readXmlAttribute(attributes, "key", "name", "id")
        );
        const value = normalizeManifestToken(
          readXmlAttribute(attributes, "value") ??
            decodeXmlTextContent(configMatch[3] ?? "")
        );
        return key ? [[key, value] as const] : [];
      })
    );
  };

  for (const bookletMatch of sourceDocument.matchAll(
    new RegExp(
      `<((?:[a-zA-Z_][\\w.-]*:)?(?:${bookletTagNames}))\\b([^>]*)>([\\s\\S]*?)<\\/\\1>`,
      "gi"
    )
  )) {
    const bookletAttributes = parseXmlAttributes(bookletMatch[2] ?? "");
    const unitEntries: SourcePackageContentStructure["bookletEntries"][number]["unitEntries"] = [];

    for (const unitMatch of (bookletMatch[3] ?? "").matchAll(
      /<((?:[a-zA-Z_][\w.-]*:)?(?:unit|unitRef|unit-ref|unitReference|unitDefinition|assessmentItem|assessment-item|assessmentItemRef|assessment-item-ref|itemRef|item-ref|unitFile|unit-file|resource|file|item|task|module))\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/gi
    )) {
      const unitAttributes = parseXmlAttributes(unitMatch[2] ?? "");
      const unitContent = unitMatch[3] ?? "";
      const unitKey = readXmlUnitEntryKey(unitAttributes, unitContent);
      const originalUnitId = String(
        readXmlAttribute(
          unitAttributes,
          "originalUnitId",
          "originalUnitKey",
          "id"
        ) ?? ""
      ).trim();
      const description = normalizeUnitContent(
        readXmlAttribute(
          unitAttributes,
          "description",
          "summary",
          "instructions"
        ) ?? readXmlChildText(unitContent, "description", "summary", "instructions")
      );
      const content = normalizeUnitContent(
        readXmlAttribute(
          unitAttributes,
          "content",
          "prompt",
          "question",
          "body",
          "itemBody",
          "item-body",
          "definition",
          "text",
          "stimulus",
          "markdown",
          "html"
        ) ??
          readXmlChildText(
            unitContent,
            "content",
            "prompt",
            "question",
            "body",
            "itemBody",
            "item-body",
            "definition",
            "text",
            "stimulus",
            "markdown",
            "html"
          )
      );
      const shortLabel = String(
        readXmlAttribute(unitAttributes, "labelshort", "labelShort") ??
          readXmlChildText(unitContent, "labelshort", "labelShort") ??
          ""
      ).trim();
      unitEntries.push({
        unitKey,
        ...(originalUnitId && originalUnitId !== unitKey
          ? { originalUnitId }
          : {}),
        displayLabel: String(
          readXmlAttribute(
            unitAttributes,
            "displayLabel",
            "label",
            "title",
            "name",
            "displayName"
          ) ??
            readXmlChildText(
              unitContent,
              "title",
              "label",
              "name",
              "displayName"
            ) ??
            shortLabel
        ).trim(),
        ...(shortLabel ? { shortLabel } : {}),
        ...(description ? { description } : {}),
        ...(content ? { content } : {})
      });
    }

    const bookletKey = String(
        readXmlAttribute(
          bookletAttributes,
          "bookletKey",
          "bookletId",
          "testletKey",
          "testletId",
          "assessmentTestKey",
          "assessmentTestId",
          "identifier",
          "key",
          "id",
          "alias",
          "code"
        ) ??
          readXmlChildText(
            bookletMatch[3] ?? "",
            "bookletKey",
            "bookletId",
            "testletKey",
            "testletId",
            "assessmentTestKey",
            "assessmentTestId",
            "assessmentSectionKey",
            "assessmentSectionId",
            "sectionKey",
            "sectionId",
            "identifier",
            "key",
            "id",
            "alias",
            "code"
          ) ??
          ""
      ).trim();
    const hierarchy = hierarchies.get(bookletKey);
    bookletEntries.push({
      bookletKey,
      displayLabel: String(
        readXmlAttribute(
          bookletAttributes,
          "displayLabel",
          "label",
          "title",
          "name",
          "displayName"
        ) ??
          readXmlChildText(
            bookletMatch[3] ?? "",
            "title",
            "label",
            "name",
            "displayName"
          ) ??
          ""
      ).trim(),
      ...(hierarchy && Object.keys(hierarchy.customTexts).length > 0
        ? { customTexts: hierarchy.customTexts }
        : {}),
      config: readBookletConfig(bookletMatch[3] ?? ""),
      ...(hierarchy?.rootRestrictions
        ? { rootRestrictions: hierarchy.rootRestrictions }
        : {}),
      ...(hierarchy?.stateEntries.length
        ? { stateEntries: hierarchy.stateEntries }
        : {}),
      ...(hierarchy?.testletEntries.length
        ? { testletEntries: hierarchy.testletEntries }
        : {}),
      unitEntries: unitEntries.map(unitEntry => {
        const testletPath = hierarchy?.unitTestletPaths.get(unitEntry.unitKey);
        return testletPath?.length
          ? { ...unitEntry, testletPath }
          : unitEntry;
      })
    });
  }

  return bookletEntries;
};

const collectXmlBookletUnitContentPathCandidates = (
  sourceDocument: string
): Map<string, string[]> => {
  const candidatesByUnitKey = new Map<string, string[]>();

  for (const bookletMatch of sourceDocument.matchAll(
    /<((?:[a-zA-Z_][\w.-]*:)?(?:booklet|testlet|assessmentTest|assessment-test|assessmentSection|assessment-section|section))\b([^>]*)>([\s\S]*?)<\/\1>/gi
  )) {
    for (const unitMatch of (bookletMatch[3] ?? "").matchAll(
      /<((?:[a-zA-Z_][\w.-]*:)?(?:unit|unitRef|unit-ref|unitReference|unitDefinition|assessmentItem|assessment-item|assessmentItemRef|assessment-item-ref|itemRef|item-ref|unitFile|unit-file|resource|file|item|task|module))\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/gi
    )) {
      const unitAttributes = parseXmlAttributes(unitMatch[2] ?? "");
      const unitContent = unitMatch[3] ?? "";
      const unitKey = readXmlUnitEntryKey(unitAttributes, unitContent);
      const unitIdentity = readXmlUnitEntryIdentity(unitAttributes, unitContent);
      const contentPath = String(
        readXmlAttribute(
          unitAttributes,
          "href",
          "path",
          "src",
          "uri",
          "file",
          "fileName",
          "filename"
        ) ??
          readXmlChildText(
            unitContent,
            "href",
            "path",
            "src",
            "uri",
            "file",
            "fileName",
            "filename"
          ) ??
          (unitIdentity && unitIdentity !== unitKey ? unitIdentity : "")
      ).trim();

      if (!unitKey || !contentPath || unitKey === contentPath) {
        continue;
      }

      const existingCandidates = candidatesByUnitKey.get(unitKey) ?? [];
      candidatesByUnitKey.set(unitKey, [
        ...new Set([...existingCandidates, contentPath])
      ]);
    }
  }

  return candidatesByUnitKey;
};

const parseSystemCheckSourceDocument = (
  sourceDocument: string
): SourcePackageSystemCheckEntry[] => {
  if (
    !/^\uFEFF?\s*(?:<\?xml\b[^?]*\?>\s*)?<SysCheck(?:\s|>)/i.test(
      sourceDocument
    )
  ) {
    return [];
  }
  let document: XmlDocument | null = null;
  try {
    document = new DOMParser({
      onError() {
        // Malformed SysCheck candidates are handled as non-matches here and by
        // the dedicated XML validation path without leaking parser diagnostics.
      }
    }).parseFromString(sourceDocument, "application/xml");
  } catch {
    return [];
  }
  const root = document?.documentElement;
  if (!root || xmlElementLocalName(root).toLowerCase() !== "syscheck") {
    return [];
  }
  const metadata = xmlChildrenNamed(root, "Metadata")[0];
  const config = xmlChildrenNamed(root, "Config")[0];
  const checkId = xmlElementText(xmlChildrenNamed(metadata ?? root, "Id")[0]);
  if (!checkId) {
    return [];
  }
  const readAttribute = (element: XmlElement | undefined, name: string): string => {
    if (!element) {
      return "";
    }
    const exact = element.getAttribute(name);
    if (exact !== null) {
      return exact.trim();
    }
    for (let index = 0; index < element.attributes.length; index += 1) {
      const attribute = element.attributes.item(index);
      if (attribute && attribute.name.toLowerCase() === name.toLowerCase()) {
        return attribute.value.trim();
      }
    }
    return "";
  };
  const readNonNegativeInteger = (
    element: XmlElement | undefined,
    name: string
  ): number => {
    const value = Number.parseInt(readAttribute(element, name), 10);
    return Number.isFinite(value) && value >= 0 ? value : 0;
  };
  const readSpeed = (
    name: "UploadSpeed" | "DownloadSpeed"
  ): SourcePackageSystemCheckEntry["uploadSpeed"] => {
    const element = config ? xmlChildrenNamed(config, name)[0] : undefined;
    return {
      min: readNonNegativeInteger(element, "min"),
      good: readNonNegativeInteger(element, "good"),
      maxDevianceBytesPerSecond: readNonNegativeInteger(
        element,
        "maxDevianceBytesPerSecond"
      ),
      maxErrorsPerSequence: readNonNegativeInteger(
        element,
        "maxErrorsPerSequence"
      ),
      maxSequenceRepetitions: readNonNegativeInteger(
        element,
        "maxSequenceRepetitions"
      ),
      sequenceSizes: xmlElementText(element)
        .split(",")
        .flatMap(value => {
          const parsed = Number.parseInt(value.trim(), 10);
          return Number.isFinite(parsed) && parsed > 0 ? [parsed] : [];
        })
    };
  };
  const validQuestionTypes = new Set([
    "string",
    "select",
    "header",
    "check",
    "text",
    "radio"
  ]);
  const questions: SourcePackageSystemCheckEntry["questions"] = config
    ? xmlChildrenNamed(config, "Q").flatMap(question => {
        const id = readAttribute(question, "id");
        const type = readAttribute(question, "type").toLowerCase();
        if (!id || !validQuestionTypes.has(type)) {
          return [];
        }
        return [{
          id,
          type: type as SourcePackageSystemCheckEntry["questions"][number]["type"],
          prompt: readAttribute(question, "prompt"),
          required:
            parseTestcenterXmlBoolean(readAttribute(question, "required")) ===
            true,
          options: xmlElementText(question)
            .split("#")
            .map(value => value.trim())
            .filter(Boolean)
        }];
      })
    : [];
  const customTexts = Object.fromEntries(
    (config ? xmlChildrenNamed(config, "CustomText") : []).flatMap(element => {
      const key = readAttribute(element, "key");
      return key ? [[key, xmlElementText(element)]] : [];
    })
  );
  const unitKey = readAttribute(config, "unit");
  const saveKey = readAttribute(config, "savekey");
  return [{
    checkId,
    displayLabel:
      xmlElementText(xmlChildrenNamed(metadata ?? root, "Label")[0]) || checkId,
    ...(xmlElementText(xmlChildrenNamed(metadata ?? root, "Description")[0])
      ? {
          description: xmlElementText(
            xmlChildrenNamed(metadata ?? root, "Description")[0]
          )
        }
      : {}),
    ...(unitKey ? { unitKey } : {}),
    ...(saveKey ? { saveKey } : {}),
    skipNetwork:
      parseTestcenterXmlBoolean(readAttribute(config, "skipnetwork")) === true,
    uploadSpeed: readSpeed("UploadSpeed"),
    downloadSpeed: readSpeed("DownloadSpeed"),
    customTexts,
    questions
  }];
};

const normalizeParsedXmlContentStructure = (
  sourceDocument: string
): ContentReleaseRuntimeSnapshot | null => {
  const systemCheckEntries = parseSystemCheckSourceDocument(sourceDocument);
  if (systemCheckEntries.length > 0) {
    return normalizeContentStructure({ bookletEntries: [], systemCheckEntries });
  }
  const explicitBookletEntries = collectXmlBookletEntries(
    sourceDocument,
    "booklet|testlet"
  );
  const assessmentTestBookletEntries = collectXmlBookletEntries(
    sourceDocument,
    "assessmentTest|assessment-test"
  );

  if (explicitBookletEntries.length > 0) {
    return normalizeContentStructure({
      bookletEntries: [
        ...explicitBookletEntries,
        ...assessmentTestBookletEntries
      ]
    });
  }

  const sectionBookletEntries = collectXmlBookletEntries(
    sourceDocument,
    "assessmentSection|assessment-section|section"
  );

  if (sectionBookletEntries.length > 0) {
    return normalizeContentStructure({ bookletEntries: sectionBookletEntries });
  }

  if (assessmentTestBookletEntries.length > 0) {
    return normalizeContentStructure({
      bookletEntries: assessmentTestBookletEntries
    });
  }

  const organizationBookletEntries =
    collectXmlOrganizationBookletEntries(sourceDocument);
  if (organizationBookletEntries.length > 0) {
    return normalizeContentStructure({
      bookletEntries: organizationBookletEntries
    });
  }

  const dependencyBookletEntries =
    collectXmlResourceDependencyBookletEntries(sourceDocument);
  if (dependencyBookletEntries.length > 0) {
    return normalizeContentStructure({
      bookletEntries: dependencyBookletEntries
    });
  }

  return normalizeContentStructure({
    bookletEntries: collectXmlBookletEntries(sourceDocument, "test")
  });
};

type ZipEntry = {
  fileName: string;
  rawFileName: Buffer;
  generalPurposeBitFlag: number;
  compressionMethod: number;
  checksum: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

type ZipManifestExtractionResult =
  | {
      status: "found";
      manifestText: string;
      manifestFileName: string;
      zipBuffer: Buffer;
      entries: ZipEntry[];
    }
  | { status: "invalid_zip" }
  | { status: "manifest_unreadable" }
  | { status: "manifest_missing" };

const MAX_EXTRACTED_MANIFEST_BYTES = 5 * 1024 * 1024;
const MAX_EXTRACTED_RESOURCE_BYTES = 20 * 1024 * 1024;
const MAX_EXTRACTED_RESOURCE_TOTAL_BYTES = 50 * 1024 * 1024;

const findZipEndOfCentralDirectoryOffset = (zipBuffer: Buffer): number => {
  const minimumOffset = Math.max(0, zipBuffer.length - 65557);
  for (let offset = zipBuffer.length - 22; offset >= minimumOffset; offset -= 1) {
    if (
      zipBuffer.readUInt32LE(offset) === 0x06054b50 &&
      offset + 22 + zipBuffer.readUInt16LE(offset + 20) === zipBuffer.length
    ) {
      return offset;
    }
  }
  return -1;
};

const readZipSafeUInt64LE = (buffer: Buffer, offset: number): number | null => {
  if (offset < 0 || offset + 8 > buffer.length) {
    return null;
  }
  const value = buffer.readBigUInt64LE(offset);
  return value <= BigInt(Number.MAX_SAFE_INTEGER) ? Number(value) : null;
};

const readZip64DirectoryMetadata = (
  zipBuffer: Buffer,
  endOfCentralDirectoryOffset: number
): {
  entryCount: number;
  centralDirectorySize: number;
  centralDirectoryOffset: number;
  centralDirectoryEnd: number;
} | null => {
  const locatorOffset = endOfCentralDirectoryOffset - 20;
  if (
    locatorOffset < 0 ||
    zipBuffer.readUInt32LE(locatorOffset) !== 0x07064b50 ||
    zipBuffer.readUInt32LE(locatorOffset + 4) !== 0 ||
    zipBuffer.readUInt32LE(locatorOffset + 16) !== 1
  ) {
    return null;
  }
  const recordOffset = readZipSafeUInt64LE(zipBuffer, locatorOffset + 8);
  if (
    recordOffset == null ||
    recordOffset + 56 > locatorOffset ||
    zipBuffer.readUInt32LE(recordOffset) !== 0x06064b50
  ) {
    return null;
  }
  const recordSize = readZipSafeUInt64LE(zipBuffer, recordOffset + 4);
  if (
    recordSize == null ||
    recordSize < 44 ||
    recordOffset + 12 + recordSize !== locatorOffset ||
    zipBuffer.readUInt32LE(recordOffset + 16) !== 0 ||
    zipBuffer.readUInt32LE(recordOffset + 20) !== 0
  ) {
    return null;
  }
  const diskEntryCount = readZipSafeUInt64LE(zipBuffer, recordOffset + 24);
  const entryCount = readZipSafeUInt64LE(zipBuffer, recordOffset + 32);
  const centralDirectorySize = readZipSafeUInt64LE(zipBuffer, recordOffset + 40);
  const centralDirectoryOffset = readZipSafeUInt64LE(zipBuffer, recordOffset + 48);
  if (
    diskEntryCount == null ||
    entryCount == null ||
    centralDirectorySize == null ||
    centralDirectoryOffset == null ||
    diskEntryCount !== entryCount ||
    entryCount > 0xffff ||
    centralDirectoryOffset + centralDirectorySize !== recordOffset
  ) {
    return null;
  }
  return {
    entryCount,
    centralDirectorySize,
    centralDirectoryOffset,
    centralDirectoryEnd: recordOffset
  };
};

const readZip64EntryValues = (
  extraFields: Buffer,
  fields: {
    uncompressedSize: boolean;
    compressedSize: boolean;
    localHeaderOffset: boolean;
    diskNumber: boolean;
  }
): {
  uncompressedSize?: number;
  compressedSize?: number;
  localHeaderOffset?: number;
  diskNumber?: number;
} | null => {
  let offset = 0;
  while (offset + 4 <= extraFields.length) {
    const headerId = extraFields.readUInt16LE(offset);
    const dataSize = extraFields.readUInt16LE(offset + 2);
    const dataStart = offset + 4;
    const dataEnd = dataStart + dataSize;
    if (dataEnd > extraFields.length) {
      return null;
    }
    if (headerId !== 0x0001) {
      offset = dataEnd;
      continue;
    }
    let valueOffset = dataStart;
    const values: {
      uncompressedSize?: number;
      compressedSize?: number;
      localHeaderOffset?: number;
      diskNumber?: number;
    } = {};
    for (const [fieldName, required, byteLength] of [
      ["uncompressedSize", fields.uncompressedSize, 8],
      ["compressedSize", fields.compressedSize, 8],
      ["localHeaderOffset", fields.localHeaderOffset, 8],
      ["diskNumber", fields.diskNumber, 4]
    ] as const) {
      if (!required) {
        continue;
      }
      if (valueOffset + byteLength > dataEnd) {
        return null;
      }
      const value = byteLength === 8
        ? readZipSafeUInt64LE(extraFields, valueOffset)
        : extraFields.readUInt32LE(valueOffset);
      if (value == null) {
        return null;
      }
      values[fieldName] = value;
      valueOffset += byteLength;
    }
    return values;
  }
  return Object.values(fields).some(Boolean) ? null : {};
};

const ZIP_CP437_EXTENDED_CHARACTERS = [
  "ÇüéâäàåçêëèïîìÄÅÉæÆôöòûùÿÖÜ¢£¥₧ƒ",
  "áíóúñÑªº¿⌐¬½¼¡«»░▒▓│┤╡╢╖╕╣║╗╝╜╛┐",
  "└┴┬├─┼╞╟╚╔╩╦╠═╬╧╨╤╥╙╘╒╓╫╪┘┌█▄▌▐▀",
  "αßΓπΣσµτΦΘΩδ∞φε∩≡±≥≤⌠⌡÷≈°∙·√ⁿ²■ "
].join("");

const readZipUnicodePathExtraField = (
  fileNameBytes: Buffer,
  extraFields: Buffer
): string | null => {
  let offset = 0;
  while (offset + 4 <= extraFields.length) {
    const headerId = extraFields.readUInt16LE(offset);
    const dataSize = extraFields.readUInt16LE(offset + 2);
    const dataStart = offset + 4;
    const dataEnd = dataStart + dataSize;
    if (dataEnd > extraFields.length) {
      return null;
    }

    if (
      headerId === 0x7075 &&
      dataSize >= 5 &&
      extraFields[dataStart] === 1 &&
      extraFields.readUInt32LE(dataStart + 1) === crc32(fileNameBytes)
    ) {
      try {
        return new TextDecoder("utf-8", { fatal: true }).decode(
          extraFields.subarray(dataStart + 5, dataEnd)
        );
      } catch {
        return null;
      }
    }

    offset = dataEnd;
  }

  return null;
};

const decodeZipFileName = (
  fileNameBytes: Buffer,
  generalPurposeBitFlag: number,
  extraFields: Buffer = Buffer.alloc(0)
): string => {
  if ((generalPurposeBitFlag & 0x0800) !== 0) {
    return fileNameBytes.toString("utf8");
  }

  const unicodePath = readZipUnicodePathExtraField(
    fileNameBytes,
    extraFields
  );
  if (unicodePath != null) {
    return unicodePath;
  }

  let fileName = "";
  for (const byte of fileNameBytes) {
    fileName +=
      byte < 0x80
        ? String.fromCharCode(byte)
        : ZIP_CP437_EXTENDED_CHARACTERS.charAt(byte - 0x80);
  }
  return fileName;
};

const readZipEntries = (zipBuffer: Buffer): ZipEntry[] | null => {
  const endOfCentralDirectoryOffset =
    findZipEndOfCentralDirectoryOffset(zipBuffer);
  if (endOfCentralDirectoryOffset < 0) {
    return null;
  }

  const diskNumber = zipBuffer.readUInt16LE(endOfCentralDirectoryOffset + 4);
  const centralDirectoryDisk = zipBuffer.readUInt16LE(
    endOfCentralDirectoryOffset + 6
  );
  const diskEntryCount = zipBuffer.readUInt16LE(
    endOfCentralDirectoryOffset + 8
  );
  const entryCount = zipBuffer.readUInt16LE(endOfCentralDirectoryOffset + 10);
  const centralDirectorySize = zipBuffer.readUInt32LE(
    endOfCentralDirectoryOffset + 12
  );
  const centralDirectoryOffset = zipBuffer.readUInt32LE(
    endOfCentralDirectoryOffset + 16
  );
  const zip64LocatorPresent =
    endOfCentralDirectoryOffset >= 20 &&
    zipBuffer.readUInt32LE(endOfCentralDirectoryOffset - 20) === 0x07064b50;
  const usesZip64 =
    zip64LocatorPresent ||
    diskEntryCount === 0xffff ||
    entryCount === 0xffff ||
    centralDirectorySize === 0xffffffff ||
    centralDirectoryOffset === 0xffffffff;
  const zip64Metadata = usesZip64
    ? readZip64DirectoryMetadata(zipBuffer, endOfCentralDirectoryOffset)
    : null;
  const resolvedEntryCount = zip64Metadata?.entryCount ?? entryCount;
  const resolvedCentralDirectorySize =
    zip64Metadata?.centralDirectorySize ?? centralDirectorySize;
  const resolvedCentralDirectoryOffset =
    zip64Metadata?.centralDirectoryOffset ?? centralDirectoryOffset;
  const centralDirectoryEnd =
    zip64Metadata?.centralDirectoryEnd ??
    resolvedCentralDirectoryOffset + resolvedCentralDirectorySize;
  if (
    diskNumber !== 0 ||
    centralDirectoryDisk !== 0 ||
    (usesZip64 && !zip64Metadata) ||
    (!usesZip64 && diskEntryCount !== entryCount) ||
    (zip64Metadata &&
      ((diskEntryCount !== 0xffff && diskEntryCount !== resolvedEntryCount) ||
        (entryCount !== 0xffff && entryCount !== resolvedEntryCount) ||
        (centralDirectorySize !== 0xffffffff &&
          centralDirectorySize !== resolvedCentralDirectorySize) ||
        (centralDirectoryOffset !== 0xffffffff &&
          centralDirectoryOffset !== resolvedCentralDirectoryOffset))) ||
    centralDirectoryEnd > zipBuffer.length ||
    (!zip64Metadata && centralDirectoryEnd !== endOfCentralDirectoryOffset)
  ) {
    return null;
  }

  const entries: ZipEntry[] = [];
  let offset = resolvedCentralDirectoryOffset;

  for (let index = 0; index < resolvedEntryCount; index += 1) {
    if (
      offset + 46 > centralDirectoryEnd ||
      zipBuffer.readUInt32LE(offset) !== 0x02014b50
    ) {
      return null;
    }

    const generalPurposeBitFlag = zipBuffer.readUInt16LE(offset + 8);
    const compressionMethod = zipBuffer.readUInt16LE(offset + 10);
    const checksum = zipBuffer.readUInt32LE(offset + 16);
    const compressedSize32 = zipBuffer.readUInt32LE(offset + 20);
    const uncompressedSize32 = zipBuffer.readUInt32LE(offset + 24);
    const fileNameLength = zipBuffer.readUInt16LE(offset + 28);
    const extraLength = zipBuffer.readUInt16LE(offset + 30);
    const commentLength = zipBuffer.readUInt16LE(offset + 32);
    const diskNumberStart = zipBuffer.readUInt16LE(offset + 34);
    const localHeaderOffset32 = zipBuffer.readUInt32LE(offset + 42);
    const fileNameStart = offset + 46;
    const fileNameEnd = fileNameStart + fileNameLength;
    const extraEnd = fileNameEnd + extraLength;
    const commentEnd = extraEnd + commentLength;

    if (commentEnd > centralDirectoryEnd) {
      return null;
    }

    const zip64Values = readZip64EntryValues(
      zipBuffer.subarray(fileNameEnd, extraEnd),
      {
        uncompressedSize: uncompressedSize32 === 0xffffffff,
        compressedSize: compressedSize32 === 0xffffffff,
        localHeaderOffset: localHeaderOffset32 === 0xffffffff,
        diskNumber: diskNumberStart === 0xffff
      }
    );
    const compressedSize =
      compressedSize32 === 0xffffffff
        ? zip64Values?.compressedSize
        : compressedSize32;
    const uncompressedSize =
      uncompressedSize32 === 0xffffffff
        ? zip64Values?.uncompressedSize
        : uncompressedSize32;
    const localHeaderOffset =
      localHeaderOffset32 === 0xffffffff
        ? zip64Values?.localHeaderOffset
        : localHeaderOffset32;
    const resolvedDiskNumber =
      diskNumberStart === 0xffff
        ? zip64Values?.diskNumber
        : diskNumberStart;
    if (
      zip64Values == null ||
      compressedSize == null ||
      uncompressedSize == null ||
      localHeaderOffset == null ||
      resolvedDiskNumber !== 0
    ) {
      return null;
    }

    const rawFileName = Buffer.from(
      zipBuffer.subarray(fileNameStart, fileNameEnd)
    );

    entries.push({
      fileName: decodeZipFileName(
        rawFileName,
        generalPurposeBitFlag,
        zipBuffer.subarray(fileNameEnd, extraEnd)
      ),
      rawFileName,
      generalPurposeBitFlag,
      compressionMethod,
      checksum,
      compressedSize,
      uncompressedSize,
      localHeaderOffset
    });
    offset = commentEnd;
  }

  if (offset !== centralDirectoryEnd) {
    if (
      offset + 6 > centralDirectoryEnd ||
      zipBuffer.readUInt32LE(offset) !== 0x05054b50 ||
      offset + 6 + zipBuffer.readUInt16LE(offset + 4) !== centralDirectoryEnd
    ) {
      return null;
    }
  }

  return entries;
};

const readZipEntryBuffer = (
  zipBuffer: Buffer,
  entry: ZipEntry,
  maxOutputBytes: number
): Buffer | null => {
  if (
    entry.uncompressedSize > maxOutputBytes ||
    entry.localHeaderOffset + 30 > zipBuffer.length ||
    zipBuffer.readUInt32LE(entry.localHeaderOffset) !== 0x04034b50 ||
    (entry.generalPurposeBitFlag & 0x0001) !== 0
  ) {
    return null;
  }

  const localGeneralPurposeBitFlag = zipBuffer.readUInt16LE(
    entry.localHeaderOffset + 6
  );
  const localCompressionMethod = zipBuffer.readUInt16LE(
    entry.localHeaderOffset + 8
  );
  const localChecksum = zipBuffer.readUInt32LE(entry.localHeaderOffset + 14);
  const localCompressedSize = zipBuffer.readUInt32LE(
    entry.localHeaderOffset + 18
  );
  const localUncompressedSize = zipBuffer.readUInt32LE(
    entry.localHeaderOffset + 22
  );
  const fileNameLength = zipBuffer.readUInt16LE(entry.localHeaderOffset + 26);
  const extraLength = zipBuffer.readUInt16LE(entry.localHeaderOffset + 28);
  const fileNameStart = entry.localHeaderOffset + 30;
  const fileNameEnd = fileNameStart + fileNameLength;
  const extraEnd = fileNameEnd + extraLength;
  if (extraEnd > zipBuffer.length) {
    return null;
  }
  const localZip64Values = readZip64EntryValues(
    zipBuffer.subarray(fileNameEnd, extraEnd),
    {
      uncompressedSize: localUncompressedSize === 0xffffffff,
      compressedSize: localCompressedSize === 0xffffffff,
      localHeaderOffset: false,
      diskNumber: false
    }
  );
  const resolvedLocalCompressedSize =
    localCompressedSize === 0xffffffff
      ? localZip64Values?.compressedSize
      : localCompressedSize;
  const resolvedLocalUncompressedSize =
    localUncompressedSize === 0xffffffff
      ? localZip64Values?.uncompressedSize
      : localUncompressedSize;
  const localRawFileName = zipBuffer.subarray(fileNameStart, fileNameEnd);
  const localUnicodePath =
    (localGeneralPurposeBitFlag & 0x0800) === 0 && extraEnd <= zipBuffer.length
      ? readZipUnicodePathExtraField(
          localRawFileName,
          zipBuffer.subarray(fileNameEnd, extraEnd)
        )
      : null;
  const usesDataDescriptor = (entry.generalPurposeBitFlag & 0x0008) !== 0;
  if (
    localGeneralPurposeBitFlag !== entry.generalPurposeBitFlag ||
    localCompressionMethod !== entry.compressionMethod ||
    (!usesDataDescriptor &&
      (localChecksum !== entry.checksum ||
        resolvedLocalCompressedSize !== entry.compressedSize ||
        resolvedLocalUncompressedSize !== entry.uncompressedSize)) ||
    localZip64Values == null ||
    !localRawFileName.equals(entry.rawFileName) ||
    (localUnicodePath != null && localUnicodePath !== entry.fileName)
  ) {
    return null;
  }
  const dataStart = extraEnd;
  const dataEnd = dataStart + entry.compressedSize;
  if (dataEnd > zipBuffer.length) {
    return null;
  }

  const compressedData = zipBuffer.subarray(dataStart, dataEnd);
  let data: Buffer | null = null;
  try {
    data =
      entry.compressionMethod === 0
        ? compressedData
        : entry.compressionMethod === 8
          ? inflateRawSync(compressedData, {
              maxOutputLength: maxOutputBytes + 1
            })
          : null;
  } catch {
    return null;
  }

  if (
    !data ||
    data.length > maxOutputBytes ||
    data.length !== entry.uncompressedSize ||
    crc32(data) !== entry.checksum
  ) {
    return null;
  }

  return data;
};

const readZipEntryText = (
  zipBuffer: Buffer,
  entry: ZipEntry,
  maxOutputBytes = MAX_EXTRACTED_RESOURCE_BYTES
): string | null =>
  readZipEntryBuffer(zipBuffer, entry, maxOutputBytes)?.toString("utf8") ?? null;

const normalizeZipEntryPath = (path: string): string => {
  const segments: string[] = [];
  for (const segment of path.replace(/\\/g, "/").split("/")) {
    if (!segment || segment === ".") {
      continue;
    }

    if (segment === "..") {
      if (segments.length === 0) {
        return "";
      }
      segments.pop();
      continue;
    }

    segments.push(segment);
  }

  return segments.join("/");
};

const isSafeRelativeArchivePath = (
  fileName: string,
  allowDirectory: boolean
): boolean => {
  const pathSegments = fileName.split("/");
  const normalizedPath = normalizeZipEntryPath(fileName);
  return (
    Boolean(normalizedPath) &&
    normalizedPath.length <= 512 &&
    !fileName.includes("\\") &&
    !/[\u0000-\u001F\u007F]/.test(fileName) &&
    !fileName.startsWith("/") &&
    !/^[a-z]:\//i.test(fileName) &&
    !/^[a-z][a-z0-9+.-]*:/i.test(fileName) &&
    !pathSegments.some(segment => segment === "..") &&
    (allowDirectory || !fileName.endsWith("/"))
  );
};

type SourcePackageAssemblyEntry = {
  sourcePackageId: string;
  fileName: string;
  bytes: Buffer;
};

const crc32Table = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

const crc32 = (content: Buffer): number => {
  let crc = 0xffffffff;
  for (const byte of content) {
    crc = crc32Table[(crc ^ byte) & 0xff]! ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const createStoredZipArchive = (
  entries: Array<{ fileName: string; bytes: Buffer }>
): Buffer => {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let localOffset = 0;

  for (const entry of entries) {
    const fileName = Buffer.from(entry.fileName, "utf8");
    const checksum = crc32(entry.bytes);
    const localHeader = Buffer.alloc(30 + fileName.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt32LE(checksum, 14);
    localHeader.writeUInt32LE(entry.bytes.length, 18);
    localHeader.writeUInt32LE(entry.bytes.length, 22);
    localHeader.writeUInt16LE(fileName.length, 26);
    fileName.copy(localHeader, 30);
    localParts.push(localHeader, entry.bytes);

    const centralHeader = Buffer.alloc(46 + fileName.length);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0x0800, 8);
    centralHeader.writeUInt16LE(0, 10);
    centralHeader.writeUInt32LE(checksum, 16);
    centralHeader.writeUInt32LE(entry.bytes.length, 20);
    centralHeader.writeUInt32LE(entry.bytes.length, 24);
    centralHeader.writeUInt16LE(fileName.length, 28);
    centralHeader.writeUInt32LE(localOffset, 42);
    fileName.copy(centralHeader, 46);
    centralParts.push(centralHeader);
    localOffset += localHeader.length + entry.bytes.length;
  }

  const centralDirectory = Buffer.concat(centralParts);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(entries.length, 8);
  endOfCentralDirectory.writeUInt16LE(entries.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(localOffset, 16);

  return Buffer.concat([...localParts, centralDirectory, endOfCentralDirectory]);
};

type OriginalResponseReportRow = {
  groupname: string;
  loginname: string;
  code: string;
  bookletname: string;
  unitname: string;
  originalUnitId: string;
  responses: Array<{
    id: string;
    content: string;
    ts: number;
    responseType: string;
  }>;
  laststate: string;
};

type OriginalLogReportRow = {
  groupname: string;
  loginname: string;
  code: string;
  bookletname: string;
  unitname: string;
  originalUnitId: string;
  timestamp: string;
  logentry: string;
};

type OriginalReviewReportRow = Record<string, string | number | boolean | null>;

const escapeOriginalCsvCell = (value: unknown): string =>
  `"${String(value ?? "").replace(/"/g, '""')}"`;

const formatOriginalReportCsv = (
  columns: string[],
  rows: Array<Record<string, unknown>>
): string =>
  `\uFEFF${[
    columns.join(";"),
    ...rows.map(row =>
      columns.map(column => escapeOriginalCsvCell(row[column])).join(";")
    )
  ].join("\n")}`;

const formatOriginalLogReportCsv = (
  columns: string[],
  rows: OriginalLogReportRow[]
): string =>
  `\uFEFF${[
    columns.join(";"),
    ...rows.map(row =>
      columns
        .map(column =>
          column === "logentry"
            ? row.logentry.replace(/\\"/g, '""')
            : escapeOriginalCsvCell(row[column as keyof OriginalLogReportRow])
        )
        .join(";")
    )
  ].join("\n")}`;

const formatOriginalReviewReportCsv = (
  columns: string[],
  rows: Array<Record<string, unknown>>
): string =>
  `\uFEFF${[
    columns.join(";"),
    ...rows.map(row =>
      columns
        .map(column =>
          row[column] == null ? "" : escapeOriginalCsvCell(row[column])
        )
        .join(";")
    )
  ].join("\n")}`;

const toOriginalReportDateTime = (value: string): string => {
  const timestamp = Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return value;
  }
  return new Date(timestamp).toISOString().replace("T", " ").slice(0, 19);
};

const resolveOriginalReportUnit = (input: {
  contentReleasesById: Map<string, ContentRelease>;
  testRun: TestRun;
  unitKey: string | null;
}): { originalUnitId: string; unitLabel: string; bookletLabel: string } => {
  const release = input.contentReleasesById.get(input.testRun.contentReleaseId);
  const booklet = release?.runtimeSnapshot.bookletEntries.find(
    entry => entry.bookletKey === input.testRun.bookletKey
  );
  const unit = input.unitKey
    ? booklet?.unitEntries.find(entry => entry.unitKey === input.unitKey)
    : undefined;
  return {
    originalUnitId: input.unitKey
      ? unit?.originalUnitId ?? input.unitKey
      : "",
    unitLabel: unit?.displayLabel ?? "",
    bookletLabel: booklet?.displayLabel ?? ""
  };
};

const buildOriginalResponseReportRows = (input: {
  participantSessions: ParticipantSession[];
  testRuns: TestRun[];
  contentReleases: ContentRelease[];
  groupKeys: string[];
}): OriginalResponseReportRow[] => {
  const sessionsById = new Map(
    input.participantSessions.map(session => [session.participantSessionId, session])
  );
  const contentReleasesById = new Map(
    input.contentReleases.map(release => [release.contentReleaseId, release])
  );
  const groupKeys = new Set(input.groupKeys);

  return input.testRuns
    .flatMap(rawTestRun => {
      const testRun = normalizeTestRun(rawTestRun);
      const participantSession = sessionsById.get(testRun.participantSessionId);
      if (!participantSession || !groupKeys.has(participantSession.groupKey)) {
        return [];
      }
      const responseTimestamp = Date.parse(testRun.updatedAt);
      const timestamp = Number.isFinite(responseTimestamp) ? responseTimestamp : 0;
      return Object.entries(testRun.unitResponses).map(([unitKey, response]) => {
        const unit = resolveOriginalReportUnit({
          contentReleasesById,
          testRun,
          unitKey
        });
        const veronaResponse = parseVeronaUnitResponse(response);
        const responseType = String(
          veronaResponse?.unitState.unitStateDataType ?? ""
        );
        const responses = veronaResponse?.unitState.dataParts
          ? Object.entries(veronaResponse.unitState.dataParts).map(
              ([id, content]) => ({ id, content, ts: timestamp, responseType })
            )
          : [{ id: "all", content: response, ts: timestamp, responseType: "" }];
        const lastState = veronaResponse
          ? Object.fromEntries(
              Object.entries(veronaResponse.unitState).filter(
                ([key]) => key !== "dataParts"
              )
            )
          : null;
        return {
          groupname: participantSession.groupKey,
          loginname: participantSession.loginKey,
          code: participantSession.participantCode ?? "",
          bookletname: testRun.bookletAssignmentKey ?? testRun.bookletKey,
          unitname: unitKey,
          originalUnitId: unit.originalUnitId,
          responses,
          laststate:
            lastState && Object.keys(lastState).length > 0
              ? JSON.stringify(lastState)
              : ""
        };
      });
    })
    .sort(
      (left, right) =>
        left.groupname.localeCompare(right.groupname) ||
        left.loginname.localeCompare(right.loginname) ||
        left.bookletname.localeCompare(right.bookletname) ||
        left.unitname.localeCompare(right.unitname)
    );
};

const buildOriginalLogReportRows = (input: {
  participantSessions: ParticipantSession[];
  testRuns: TestRun[];
  testLogs: ParticipantTestLog[];
  groupKeys: string[];
}): OriginalLogReportRow[] =>
  listParticipantTestLogsForWorkspace({
    tenantKey: "",
    workspaceKey: "",
    participantSessions: input.participantSessions,
    testRuns: input.testRuns,
    testLogs: input.testLogs,
    groupKeys: input.groupKeys,
    limit: 50_001
  })
    .map(item => ({
      groupname: item.groupKey,
      loginname: item.loginKey,
      code: item.participantCode,
      bookletname: item.bookletAssignmentKey,
      unitname: item.testLog.unitKey ?? "",
      originalUnitId: item.testLog.originalUnitId ?? "",
      timestamp: String(item.testLog.timestamp),
      logentry: item.testLog.logContent
        ? `${item.testLog.logKey}${item.testLog.unitKey ? " = " : " : "}${JSON.stringify(item.testLog.logContent)}`
        : item.testLog.logKey
    }))
    .sort(
      (left, right) =>
        Number(left.timestamp) - Number(right.timestamp) ||
        left.groupname.localeCompare(right.groupname) ||
        left.loginname.localeCompare(right.loginname)
    );

const buildOriginalReviewReportRows = (input: {
  participantSessions: ParticipantSession[];
  participantRosterEntries: ParticipantRosterEntry[];
  testRuns: TestRun[];
  reviews: WorkspaceReview[];
  contentReleases: ContentRelease[];
  groupKeys: string[];
}): { rows: OriginalReviewReportRow[]; categoryColumns: string[] } => {
  const contentReleasesById = new Map(
    input.contentReleases.map(release => [release.contentReleaseId, release])
  );
  const items = buildWorkspaceReviewListItems({
    participantSessions: input.participantSessions,
    participantRosterEntries: input.participantRosterEntries,
    testRuns: input.testRuns,
    reviews: input.reviews,
    groupKeys: input.groupKeys,
    limit: 50_001,
    limitMaximum: 50_001
  });
  const categories = Array.from(
    new Set(items.flatMap(item => item.review.categories))
  ).sort();
  const categoryColumns = categories.map(category => `category_${category}`);
  const rows = items.map(item => {
    const testRun = item.testRun ? normalizeTestRun(item.testRun) : null;
    const unit = testRun
      ? resolveOriginalReportUnit({
          contentReleasesById,
          testRun,
          unitKey: item.review.unitKey
        })
      : {
          originalUnitId: item.review.originalUnitId ?? item.review.unitKey ?? "",
          unitLabel: "",
          bookletLabel: ""
        };
    return {
      groupname: item.participantSession?.groupKey ?? "",
      loginname: item.participantSession?.loginKey ?? "",
      code: item.participantSession?.participantCode ?? "",
      bookletname: testRun
        ? testRun.bookletAssignmentKey ?? testRun.bookletKey
        : "",
      unitname: item.review.unitKey ?? "",
      priority: String(item.review.priority),
      ...Object.fromEntries(
        categories.map(category => [
          `category_${category}`,
          item.review.categories.includes(category)
        ])
      ),
      reviewtime: toOriginalReportDateTime(item.review.createdAt),
      page: item.review.page,
      pagelabel: item.review.pageLabel,
      originalUnitId: item.review.originalUnitId ?? unit.originalUnitId,
      userAgent: item.review.userAgent,
      reviewer: item.review.reviewerId,
      entry: item.review.comment,
      unitlabel: unit.unitLabel,
      bookletlabel: unit.bookletLabel
    } satisfies OriginalReviewReportRow;
  });
  return { rows, categoryColumns };
};

const createOriginalResultArchive = (input: {
  tenantKey: string;
  workspaceKey: string;
  groupKeys: string[];
  generatedAt: string;
  participantSessions: ParticipantSession[];
  participantRosterEntries: ParticipantRosterEntry[];
  testRuns: TestRun[];
  reviews: WorkspaceReview[];
  testLogs: ParticipantTestLog[];
  contentReleases: ContentRelease[];
}): WorkspaceOriginalResultArchive => {
  const responseRows = buildOriginalResponseReportRows(input);
  const logRows = buildOriginalLogReportRows(input);
  const reviewReport = buildOriginalReviewReportRows(input);
  const counts = {
    responses: responseRows.length,
    logs: logRows.length,
    reviews: reviewReport.rows.length
  };
  if (Object.values(counts).some(count => count > 50_000)) {
    throw new FirstSliceError(
      413,
      "result_archive_too_large",
      "The selected result archive exceeds the 50,000-row per report limit. Select fewer groups."
    );
  }

  const responseColumns = [
    "groupname",
    "loginname",
    "code",
    "bookletname",
    "unitname",
    "originalUnitId",
    "responses",
    "laststate"
  ];
  const logColumns = [
    "groupname",
    "loginname",
    "code",
    "bookletname",
    "unitname",
    "originalUnitId",
    "timestamp",
    "logentry"
  ];
  const reviewColumns = [
    "groupname",
    "loginname",
    "code",
    "bookletname",
    "unitname",
    "priority",
    ...reviewReport.categoryColumns,
    "reviewtime",
    "page",
    "pagelabel",
    "originalUnitId",
    "userAgent",
    "reviewer",
    "entry",
    "unitlabel",
    "bookletlabel"
  ];
  const responsesCsvRows = responseRows.map(row => ({
    ...row,
    responses: JSON.stringify(row.responses)
  }));
  const reviewCsvRows = reviewReport.rows.map(row =>
    Object.fromEntries(
      Object.entries(row).map(([key, value]) => [
        key,
        key.startsWith("category_") ? (value ? "TRUE" : "FALSE") : value
      ])
    )
  );
  const manifest = {
    format: "testcenter-original-result-archive",
    version: 1,
    tenantKey: input.tenantKey,
    workspaceKey: input.workspaceKey,
    generatedAt: input.generatedAt,
    groupKeys: input.groupKeys,
    counts,
    reports: [
      { type: "response", csv: "responses.csv", json: "responses.json" },
      { type: "log", csv: "logs.csv", json: "logs.json" },
      { type: "review", csv: "reviews.csv", json: "reviews.json", version: 2 }
    ],
    compatibility: {
      source: "IQB Testcenter workspace reports",
      responseProjection:
        "Verona dataParts are emitted as response entries; remaining unit state is emitted as laststate."
    }
  };
  const textEntries = [
    ["manifest.json", `${JSON.stringify(manifest, null, 2)}\n`],
    ["responses.json", JSON.stringify(responseRows)],
    ["responses.csv", formatOriginalReportCsv(responseColumns, responsesCsvRows)],
    ["logs.json", JSON.stringify(logRows)],
    ["logs.csv", formatOriginalLogReportCsv(logColumns, logRows)],
    ["reviews.json", JSON.stringify(reviewReport.rows)],
    ["reviews.csv", formatOriginalReviewReportCsv(reviewColumns, reviewCsvRows)]
  ] as const;
  return {
    fileName: `${input.workspaceKey}-original-results.zip`,
    mediaType: "application/zip",
    body: createStoredZipArchive(
      textEntries.map(([fileName, content]) => ({
        fileName,
        bytes: Buffer.from(content, "utf8")
      }))
    )
  };
};

const normalizeSourcePackageAssemblyPath = (fileName: string): string => {
  const trimmedFileName = fileName.trim();
  const normalizedPath = normalizeZipEntryPath(trimmedFileName);
  if (!isSafeRelativeArchivePath(trimmedFileName, false)) {
    throw new FirstSliceError(
      400,
      "source_package_assembly_path_invalid",
      `Source package file name '${fileName}' is not a safe relative archive path.`
    );
  }
  return normalizedPath;
};

const xmlAttribute = (value: string): string =>
  value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

const collectAssemblyResourceIdentifiers = (
  entry: SourcePackageAssemblyEntry
): string[] => {
  const fileName = entry.fileName;
  const baseName = fileName.split("/").at(-1) ?? fileName;
  const stem = baseName.replace(/\.(?:html?|xml|json)$/i, "");
  const identifiers = new Set([fileName, baseName, stem].filter(Boolean));
  const text = entry.bytes.toString("utf8");
  if (/^\s*(?:<\?xml[^>]*>\s*)?<(?:Booklet|Unit|SysCheck)\b/i.test(text)) {
    const metadataId = text.match(
      /<Metadata\b[^>]*>[\s\S]*?<Id\b[^>]*>([^<]+)<\/Id>/i
    )?.[1]?.trim();
    if (metadataId) {
      identifiers.add(metadataId);
    }
  }
  let hasJsonLdMetadata = false;
  for (const metadataMatch of text.matchAll(
    /<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi
  )) {
    hasJsonLdMetadata = true;
    try {
      const metadata = JSON.parse(metadataMatch[1] ?? "") as {
        id?: unknown;
        "@id"?: unknown;
        version?: unknown;
      };
      const rawId = metadata.id ?? metadata["@id"];
      const id = typeof rawId === "string" ? rawId.trim() : "";
      const moduleVersion =
        typeof metadata.version === "string"
          ? normalizeVeronaMajorMinorVersion(metadata.version)
          : null;
      if (id) {
        identifiers.add(id);
        if (moduleVersion) {
          identifiers.add(`${id}@${moduleVersion}`);
          identifiers.add(`${id}-${moduleVersion}`);
        }
      }
    } catch {
      // Player metadata validation reports malformed JSON during the normal import.
    }
  }
  if (!hasJsonLdMetadata && /\.html?$/i.test(baseName)) {
    // Historical Testcenter players use names such as
    // IQBVisualUnitPlayerV2.99.2.html while Units reference the unversioned stem.
    const legacyVersionedPlayerName = stem.match(
      /^(.+)\.(\d+)\.(\d+)(?:\.(\d+))?(?:[-+][0-9A-Za-z.-]+)?$/
    );
    if (legacyVersionedPlayerName?.[1]) {
      identifiers.add(legacyVersionedPlayerName[1]);
    }
  }
  return [...identifiers];
};

const createAssemblyManifest = (
  entries: SourcePackageAssemblyEntry[]
): string => {
  const resources: string[] = [];
  const identifiers = new Map<string, string>();
  for (const entry of entries) {
    for (const identifier of collectAssemblyResourceIdentifiers(entry)) {
      const normalizedIdentifier = identifier.toLowerCase();
      if (identifiers.has(normalizedIdentifier)) {
        continue;
      }
      identifiers.set(normalizedIdentifier, entry.fileName);
      resources.push(
        `    <resource identifier="${xmlAttribute(identifier)}" href="${xmlAttribute(entry.fileName)}" />`
      );
    }
  }
  return [
    '<?xml version="1.0" encoding="utf-8"?>',
    '<manifest identifier="testcenter-rewrite-assembly">',
    "  <resources>",
    ...resources,
    "  </resources>",
    "</manifest>"
  ].join("\n");
};

const assembleSourcePackageArchive = (
  sourcePackages: SourcePackage[]
): { archive: Buffer; members: SourcePackageAssemblyEntry[] } => {
  const members = sourcePackages.map(sourcePackage => {
    const decodedDocument = decodePersistedSourceDocument(sourcePackage);
    if (!decodedDocument) {
      throw new FirstSliceError(
        409,
        "source_package_assembly_document_missing",
        `Source package '${sourcePackage.sourcePackageId}' has no readable source document.`
      );
    }
    if (decodedDocument.bytes.length > MAX_EXTRACTED_RESOURCE_BYTES) {
      throw new FirstSliceError(
        413,
        "source_package_assembly_member_too_large",
        `Source package '${sourcePackage.fileName}' exceeds the 20 MiB assembly member limit.`
      );
    }
    return {
      sourcePackageId: sourcePackage.sourcePackageId,
      fileName: normalizeSourcePackageAssemblyPath(sourcePackage.fileName),
      bytes: decodedDocument.bytes
    };
  });
  const duplicateFileNames = members.filter(
    (member, index) =>
      members.findIndex(
        candidate => candidate.fileName.toLowerCase() === member.fileName.toLowerCase()
      ) !== index
  );
  if (duplicateFileNames.length > 0) {
    throw new FirstSliceError(
      409,
      "source_package_assembly_file_name_duplicate",
      `Assembly contains duplicate archive path '${duplicateFileNames[0]!.fileName}'.`
    );
  }
  const totalBytes = members.reduce((total, member) => total + member.bytes.length, 0);
  if (totalBytes > MAX_EXTRACTED_RESOURCE_TOTAL_BYTES) {
    throw new FirstSliceError(
      413,
      "source_package_assembly_too_large",
      "Selected source packages exceed the 50 MiB assembly limit."
    );
  }
  const hasManifest = members.some(member =>
    /(?:^|\/)(?:imsmanifest|manifest)\.xml$/i.test(member.fileName)
  );
  const archiveEntries = [
    ...(hasManifest
      ? []
      : [
          {
            fileName: "imsmanifest.xml",
            bytes: Buffer.from(createAssemblyManifest(members), "utf8")
          }
        ]),
    ...members.map(member => ({ fileName: member.fileName, bytes: member.bytes }))
  ];
  return { archive: createStoredZipArchive(archiveEntries), members };
};

const collectLooseSourcePackageDependencyReferences = (
  sourcePackage: SourcePackage
): string[] => {
  const decodedDocument = decodePersistedSourceDocument(sourcePackage);
  if (
    !decodedDocument ||
    sourcePackage.fileName.toLowerCase().endsWith(".zip") ||
    sourcePackage.mediaType.toLowerCase().includes("zip")
  ) {
    return [];
  }

  const sourceDocument = decodedDocument.bytes.toString("utf8");
  if (
    !sourceDocument.trimStart().startsWith("<") ||
    /<!DOCTYPE\b/i.test(sourceDocument)
  ) {
    return [];
  }

  const parserErrors: string[] = [];
  let document: XmlDocument | null = null;
  try {
    document = new DOMParser({
      onError(_level, message) {
        parserErrors.push(message);
      }
    }).parseFromString(sourceDocument, "application/xml");
  } catch {
    return [];
  }
  if (parserErrors.length > 0 || !document?.documentElement) {
    return [];
  }

  const root = document.documentElement;
  const rootName = xmlElementLocalName(root).toLowerCase();
  const references = new Set<string>();
  const addReference = (value: string | null | undefined): void => {
    const normalizedValue = value?.trim();
    if (normalizedValue) {
      references.add(normalizedValue);
    }
  };

  if (rootName === "booklet") {
    const units = xmlChildrenNamed(root, "Units")[0];
    for (const unit of units ? xmlDescendantsNamed(units, "Unit") : []) {
      addReference(unit.getAttribute("id"));
    }
  }

  if (rootName === "unit") {
    const metadata = xmlChildrenNamed(root, "Metadata")[0];
    addReference(xmlElementText(xmlChildrenNamed(metadata, "Reference")[0]));
    const definition =
      xmlChildrenNamed(root, "DefinitionRef")[0] ??
      xmlChildrenNamed(root, "Definition")[0];
    addReference(definition?.getAttribute("player"));
    if (definition && xmlElementLocalName(definition) === "DefinitionRef") {
      addReference(
        ["href", "path", "src", "uri", "file", "fileName", "filename"]
          .map(attributeName => definition.getAttribute(attributeName))
          .find(Boolean) ?? xmlElementText(definition)
      );
    }
    addReference(xmlElementText(xmlChildrenNamed(root, "VariablesRef")[0]));
    const codingSchemeReference = xmlChildrenNamed(root, "CodingSchemeRef")[0];
    addReference(
      codingSchemeReference
        ? ["href", "path", "src", "uri", "file", "fileName", "filename"]
            .map(attributeName => codingSchemeReference.getAttribute(attributeName))
            .find(Boolean) ?? xmlElementText(codingSchemeReference)
        : null
    );
    const dependencies = xmlChildrenNamed(root, "Dependencies")[0];
    for (const dependency of dependencies
      ? xmlChildElements(dependencies)
      : []) {
      if (xmlElementLocalName(dependency).toLowerCase() === "file") {
        addReference(xmlElementText(dependency));
      }
    }
  }

  if (rootName === "syscheck") {
    addReference(xmlChildrenNamed(root, "Config")[0]?.getAttribute("unit"));
  }

  return [...references];
};

const workspaceDependencyReferenceKeys = (reference: string): string[] => {
  const normalizedReference = reference.trim().replace(/\\/g, "/");
  const normalizedPath = normalizeZipEntryPath(normalizedReference);
  const baseName = normalizedReference.split("/").at(-1) ?? normalizedReference;
  return [normalizedReference, normalizedPath, baseName]
    .map(value => value.trim().toLowerCase())
    .filter((value, index, values) => value && values.indexOf(value) === index);
};

type WorkspaceDependencySourceResolution =
  | { status: "not_applicable" }
  | { status: "resolved"; sourcePackages: SourcePackage[] }
  | { status: "blocked"; diagnostic: ImportJobDiagnostic };

const resolveWorkspaceDependencySourcePackages = (input: {
  rootSourcePackage: SourcePackage;
  workspaceSourcePackages: SourcePackage[];
}): WorkspaceDependencySourceResolution => {
  const rootReferences = collectLooseSourcePackageDependencyReferences(
    input.rootSourcePackage
  );
  if (rootReferences.length === 0) {
    return { status: "not_applicable" };
  }

  const candidates = input.workspaceSourcePackages
    .filter(
      sourcePackage =>
        sourcePackage.sourcePackageId !== input.rootSourcePackage.sourcePackageId &&
        sourcePackage.sourceDocument
    )
    .map(sourcePackage => {
      const decodedDocument = decodePersistedSourceDocument(sourcePackage);
      if (!decodedDocument) {
        return null;
      }
      const assemblyEntry: SourcePackageAssemblyEntry = {
        sourcePackageId: sourcePackage.sourcePackageId,
        fileName: sourcePackage.fileName.trim().replace(/\\/g, "/"),
        bytes: decodedDocument.bytes
      };
      const normalizedFileName = normalizeZipEntryPath(
        assemblyEntry.fileName
      ).toLowerCase();
      const normalizedMediaType = sourcePackage.mediaType.toLowerCase();
      const metadataReadable =
        normalizedMediaType.startsWith("text/") ||
        normalizedMediaType.includes("json") ||
        normalizedMediaType.includes("xml") ||
        /\.(?:html?|json|xml|manifest|imsmanifest)$/i.test(normalizedFileName);
      const fileBaseName =
        assemblyEntry.fileName.split("/").at(-1) ?? assemblyEntry.fileName;
      const identifierKeys = new Set(
        (metadataReadable
          ? collectAssemblyResourceIdentifiers(assemblyEntry)
          : [assemblyEntry.fileName, fileBaseName]
        ).flatMap(workspaceDependencyReferenceKeys)
      );
      return {
        sourcePackage,
        identifierKeys,
        normalizedFileName,
        normalizedFileBaseName:
          normalizedFileName.split("/").at(-1) ?? normalizedFileName
      };
    })
    .filter(Boolean) as Array<{
      sourcePackage: SourcePackage;
      identifierKeys: Set<string>;
      normalizedFileName: string;
      normalizedFileBaseName: string;
    }>;

  const selected = new Map<string, SourcePackage>([
    [input.rootSourcePackage.sourcePackageId, input.rootSourcePackage]
  ]);
  const pending = [input.rootSourcePackage];
  const missingReferences = new Set<string>();
  while (pending.length > 0) {
    const currentSourcePackage = pending.shift();
    if (!currentSourcePackage) {
      continue;
    }
    for (const reference of collectLooseSourcePackageDependencyReferences(
      currentSourcePackage
    )) {
      const referenceKeys = workspaceDependencyReferenceKeys(reference);
      const exactReferenceKey = reference.trim().toLowerCase();
      const normalizedReferencePath = normalizeZipEntryPath(
        reference.trim().replace(/\\/g, "/")
      ).toLowerCase();
      const normalizedReferenceBaseName =
        normalizedReferencePath.split("/").at(-1) ?? normalizedReferencePath;
      const exactFileMatches = candidates.filter(
        candidate => candidate.normalizedFileName === normalizedReferencePath
      );
      const baseFileMatches = candidates.filter(
        candidate =>
          candidate.normalizedFileBaseName === normalizedReferenceBaseName
      );
      const exactIdentifierMatches = candidates.filter(
        candidate => candidate.identifierKeys.has(exactReferenceKey)
      );
      const matches =
        exactFileMatches.length > 0
          ? exactFileMatches
          : baseFileMatches.length > 0
            ? baseFileMatches
            : exactIdentifierMatches.length > 0
              ? exactIdentifierMatches
              : candidates.filter(candidate =>
                  referenceKeys.some(key => candidate.identifierKeys.has(key))
                );
      if (matches.length > 1) {
        const matchingFiles = matches
          .map(
            candidate =>
              `'${candidate.sourcePackage.fileName}' (${candidate.sourcePackage.sourcePackageId})`
          )
          .sort((left, right) => left.localeCompare(right))
          .join(", ");
        return {
          status: "blocked",
          diagnostic: createImportDiagnostic(
            "source_document_workspace_dependency_ambiguous",
            `Workspace dependency '${reference}' referenced by '${currentSourcePackage.fileName}' matches multiple uploaded files: ${matchingFiles}. Use explicit loose-file assembly to select the intended immutable dependency set.`
          )
        };
      }
      if (matches.length === 0) {
        missingReferences.add(reference);
        continue;
      }
      const dependency = matches[0]!.sourcePackage;
      if (selected.has(dependency.sourcePackageId)) {
        continue;
      }
      selected.set(dependency.sourcePackageId, dependency);
      pending.push(dependency);
    }
  }

  if (missingReferences.size > 0) {
    return selected.size > 1
      ? {
          status: "blocked",
          diagnostic: createImportDiagnostic(
            "source_document_workspace_dependency_incomplete",
            `Workspace dependency resolution for '${input.rootSourcePackage.fileName}' found a partial chain but could not resolve: ${[...missingReferences].join(", ")}. Upload the missing files or use explicit loose-file assembly.`
          )
        }
      : { status: "not_applicable" };
  }

  return selected.size > 1
    ? { status: "resolved", sourcePackages: [...selected.values()] }
    : { status: "not_applicable" };
};

const resolveZipResourcePathCandidates = (
  manifestFileName: string,
  resourcePath: string
): string[] => {
  const directPath = normalizeZipEntryPath(resourcePath);
  const manifestPath = normalizeZipEntryPath(manifestFileName);
  const manifestDirectory = manifestPath.includes("/")
    ? manifestPath.slice(0, manifestPath.lastIndexOf("/"))
    : "";
  const relativePath = normalizeZipEntryPath(
    manifestDirectory ? `${manifestDirectory}/${resourcePath}` : resourcePath
  );

  return [...new Set([directPath, relativePath].filter(Boolean))];
};

const findZipEntryByPath = (
  entries: ZipEntry[],
  candidatePaths: string[]
): ZipEntry | null => {
  const entriesByPath = new Map(
    entries.map(entry => [normalizeZipEntryPath(entry.fileName), entry])
  );
  const entriesByLowercasePath = new Map(
    entries.map(entry => [normalizeZipEntryPath(entry.fileName).toLowerCase(), entry])
  );

  for (const candidatePath of candidatePaths) {
    const normalizedCandidatePath = normalizeZipEntryPath(candidatePath);
    const entry =
      entriesByPath.get(normalizedCandidatePath) ??
      entriesByLowercasePath.get(normalizedCandidatePath.toLowerCase());
    if (entry) {
      return entry;
    }
  }

  return null;
};

type ZipResourcePathCandidate = {
  baseFileName: string;
  resourcePath: string;
};

const extractZipUnitContent = (sourceDocument: string): string | null => {
  const hasDefinitionReference =
    /<((?:[a-zA-Z_][\w.-]*:)?DefinitionRef)\b/i.test(sourceDocument);
  const content = normalizeUnitContent(
    readXmlChildText(
      sourceDocument,
      "itemBody",
      "item-body",
      "body",
      "content",
      "prompt",
      "question",
      "text",
      "stimulus",
      "markdown",
      "html",
      "Definition",
      "definition"
    ) ?? (hasDefinitionReference ? "" : sourceDocument)
  );
  return content || null;
};

type ZipUnitDefinition = {
  playerKey: string | null;
  reference: string | null;
  unitDefinition: string | null;
  unitDefinitionType: string | null;
};

type VeronaPlayerMetadataValidation =
  | { status: "missing" }
  | { status: "invalid"; reason: string }
  | {
      status: "unsupported";
      metadataVersion: string;
      reason: string;
    }
  | {
      status: "valid";
      id: string;
      version: string;
      specVersion: string;
      metadataVersion: string;
    };

const veronaMetadataIdentifierPattern = /^[A-Za-z][A-Za-z0-9_-]*$/;
const veronaMetadataSemverPattern =
  /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*)(?:\.(?:0|[1-9]\d*|\d*[a-zA-Z-][0-9a-zA-Z-]*))*))?(?:\+([0-9a-zA-Z-]+(?:\.[0-9a-zA-Z-]+)*))?$/;
const veronaMetadataMajorMinorPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)$/;

const asVeronaMetadataRecord = (
  value: unknown
): Record<string, unknown> | null =>
  typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;

const findUnexpectedVeronaMetadataProperty = (
  value: Record<string, unknown>,
  allowedProperties: ReadonlySet<string>
): string | null =>
  Object.keys(value).find(property => !allowedProperties.has(property)) ?? null;

const validateVeronaLanguageTaggedStrings = (
  value: unknown,
  fieldName: string,
  strict: boolean
): string | null => {
  if (!Array.isArray(value) || value.length === 0) {
    return `player metadata field '${fieldName}' must be a non-empty language-tagged array`;
  }
  for (const [index, entry] of value.entries()) {
    const item = asVeronaMetadataRecord(entry);
    if (!item) {
      return `player metadata field '${fieldName}[${index}]' must be an object`;
    }
    if (strict) {
      const unexpectedProperty = findUnexpectedVeronaMetadataProperty(
        item,
        new Set(["lang", "value"])
      );
      if (unexpectedProperty) {
        return `player metadata field '${fieldName}[${index}]' contains unsupported property '${unexpectedProperty}'`;
      }
    }
    if (typeof item.value !== "string" || item.value.length === 0) {
      return `player metadata field '${fieldName}[${index}].value' must be a non-empty string`;
    }
    if (
      (strict || item.lang !== undefined) &&
      (typeof item.lang !== "string" || !/^[a-z]{2}$/.test(item.lang))
    ) {
      return `player metadata field '${fieldName}[${index}].lang' must be a two-letter lowercase language code`;
    }
  }
  return null;
};

const isVeronaMetadataUri = (value: unknown): value is string => {
  if (typeof value !== "string" || value.length === 0) {
    return false;
  }
  try {
    return Boolean(new URL(value).protocol);
  } catch {
    return false;
  }
};

const validateVeronaMetadataMaintainer = (
  value: unknown,
  strict: boolean
): string | null => {
  if (value === undefined) {
    return null;
  }
  const maintainer = asVeronaMetadataRecord(value);
  if (!maintainer) {
    return "player metadata field 'maintainer' must be an object";
  }
  if (strict) {
    const unexpectedProperty = findUnexpectedVeronaMetadataProperty(
      maintainer,
      new Set(["name", "url", "email"])
    );
    if (unexpectedProperty) {
      return `player metadata field 'maintainer' contains unsupported property '${unexpectedProperty}'`;
    }
  }
  if (maintainer.name !== undefined) {
    const nameError = validateVeronaLanguageTaggedStrings(
      maintainer.name,
      "maintainer.name",
      strict
    );
    if (nameError) {
      return nameError;
    }
  }
  if (maintainer.url !== undefined && !isVeronaMetadataUri(maintainer.url)) {
    return "player metadata field 'maintainer.url' must be an absolute URI";
  }
  if (
    maintainer.email !== undefined &&
    (typeof maintainer.email !== "string" ||
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(maintainer.email))
  ) {
    return "player metadata field 'maintainer.email' must be an email address";
  }
  return null;
};

const validateVeronaMetadataCode = (
  value: unknown,
  strict: boolean
): string | null => {
  if (value === undefined) {
    return null;
  }
  const code = asVeronaMetadataRecord(value);
  if (!code) {
    return "player metadata field 'code' must be an object";
  }
  const codeProperties = [
    "repositoryType",
    "repositoryUrl",
    "licenseType",
    "licenseUrl"
  ];
  if (strict) {
    const unexpectedProperty = findUnexpectedVeronaMetadataProperty(
      code,
      new Set(codeProperties)
    );
    if (unexpectedProperty) {
      return `player metadata field 'code' contains unsupported property '${unexpectedProperty}'`;
    }
  }
  for (const property of ["repositoryType", "licenseType"] as const) {
    if (code[property] !== undefined && typeof code[property] !== "string") {
      return `player metadata field 'code.${property}' must be a string`;
    }
  }
  for (const property of ["repositoryUrl", "licenseUrl"] as const) {
    if (code[property] !== undefined && !isVeronaMetadataUri(code[property])) {
      return `player metadata field 'code.${property}' must be an absolute URI`;
    }
  }
  return null;
};

const validateVeronaMetadataDependencies = (
  value: unknown,
  metadataMajor: number
): string | null => {
  if (value === undefined) {
    return null;
  }
  if (!Array.isArray(value)) {
    return "player metadata field 'dependencies' must be an array";
  }
  if (metadataMajor === 1 && value.length === 0) {
    return "player metadata field 'dependencies' must not be empty for metadataVersion 1.x";
  }
  for (const [index, entry] of value.entries()) {
    const dependency = asVeronaMetadataRecord(entry);
    if (!dependency) {
      return `player metadata field 'dependencies[${index}]' must be an object`;
    }
    if (metadataMajor === 3) {
      const unexpectedProperty = findUnexpectedVeronaMetadataProperty(
        dependency,
        new Set(["id", "description", "type", "required"])
      );
      if (unexpectedProperty) {
        return `player metadata field 'dependencies[${index}]' contains unsupported property '${unexpectedProperty}'`;
      }
    }
    if (typeof dependency.id !== "string") {
      return `player metadata field 'dependencies[${index}].id' must be a string`;
    }
    if (
      metadataMajor === 1 &&
      !veronaMetadataIdentifierPattern.test(dependency.id)
    ) {
      return `player metadata field 'dependencies[${index}].id' must be a Verona identifier for metadataVersion 1.x`;
    }
    if (
      dependency.description !== undefined &&
      typeof dependency.description !== "string"
    ) {
      return `player metadata field 'dependencies[${index}].description' must be a string`;
    }
    if (metadataMajor >= 2) {
      const supportedTypes =
        metadataMajor === 3
          ? new Set(["FILE", "WIDGET", "SERVICE"])
          : new Set(["file", "service"]);
      if (
        typeof dependency.type !== "string" ||
        !supportedTypes.has(dependency.type)
      ) {
        return `player metadata field 'dependencies[${index}].type' must use a supported dependency type`;
      }
    }
    if (
      (metadataMajor < 3 && typeof dependency.required !== "boolean") ||
      (metadataMajor === 3 &&
        dependency.required !== undefined &&
        typeof dependency.required !== "boolean")
    ) {
      return `player metadata field 'dependencies[${index}].required' must be boolean${metadataMajor === 3 ? " when provided" : ""}`;
    }
  }
  return null;
};

const validateVeronaPlayerMetadataDocument = (
  metadata: Record<string, unknown>
): VeronaPlayerMetadataValidation => {
  const metadataVersion =
    typeof metadata.metadataVersion === "string"
      ? metadata.metadataVersion
      : "";
  const metadataVersionMatch = metadataVersion.match(
    veronaMetadataMajorMinorPattern
  );
  if (!metadataVersionMatch) {
    return {
      status: "invalid",
      reason: "player metadata must declare metadataVersion as MAJOR.MINOR"
    };
  }
  const metadataMajor = Number.parseInt(metadataVersionMatch[1] ?? "", 10);
  const metadataMinor = Number.parseInt(metadataVersionMatch[2] ?? "", 10);
  if (
    metadataMajor < 1 ||
    metadataMajor > 3 ||
    (metadataMajor === 3 && metadataMinor > 1)
  ) {
    return {
      status: "unsupported",
      metadataVersion,
      reason: `declares unsupported metadataVersion '${metadataVersion}'`
    };
  }

  const strict = metadataMajor === 3;
  if (strict) {
    const allowedProperties = new Set([
      "id",
      "name",
      "type",
      ...(metadataMinor >= 1 ? ["model"] : []),
      "description",
      "version",
      "specVersion",
      "metadataVersion",
      "dependencies",
      "maintainer",
      "code"
    ]);
    const unexpectedProperty = findUnexpectedVeronaMetadataProperty(
      metadata,
      allowedProperties
    );
    if (unexpectedProperty) {
      return {
        status: "invalid",
        reason: `player metadata contains unsupported property '${unexpectedProperty}' for metadataVersion '${metadataVersion}'`
      };
    }
  }

  const expectedType = strict ? "PLAYER" : "player";
  if (metadata.type !== expectedType) {
    return {
      status: "invalid",
      reason: `player metadata field 'type' must be '${expectedType}' for metadataVersion '${metadataVersion}'`
    };
  }
  const id = typeof metadata.id === "string" ? metadata.id : "";
  if (!veronaMetadataIdentifierPattern.test(id)) {
    return {
      status: "invalid",
      reason: "player metadata field 'id' must start with a letter and contain only letters, digits, underscores, or hyphens"
    };
  }
  const nameError = validateVeronaLanguageTaggedStrings(
    metadata.name,
    "name",
    strict
  );
  if (nameError) {
    return { status: "invalid", reason: nameError };
  }
  if (metadata.description !== undefined) {
    const descriptionError = validateVeronaLanguageTaggedStrings(
      metadata.description,
      "description",
      strict
    );
    if (descriptionError) {
      return { status: "invalid", reason: descriptionError };
    }
  }
  const version = typeof metadata.version === "string" ? metadata.version : "";
  if (!veronaMetadataSemverPattern.test(version)) {
    return {
      status: "invalid",
      reason: "player metadata field 'version' must use SemVer MAJOR.MINOR.PATCH notation"
    };
  }
  const specVersion =
    typeof metadata.specVersion === "string"
      ? metadata.specVersion
      : "";
  if (!veronaMetadataMajorMinorPattern.test(specVersion)) {
    return {
      status: "invalid",
      reason: "player metadata field 'specVersion' must use MAJOR.MINOR notation"
    };
  }
  if (metadata.model !== undefined && typeof metadata.model !== "string") {
    return {
      status: "invalid",
      reason: "player metadata field 'model' must be a string"
    };
  }
  if (!strict && metadata.notSupportedFeatures !== undefined) {
    const features = metadata.notSupportedFeatures;
    const supportedFeatures = new Set([
      "focus-notify",
      "log-policy",
      "paging-mode",
      "navigation-denied",
      "variable-data"
    ]);
    if (
      !Array.isArray(features) ||
      features.length === 0 ||
      new Set(features).size !== features.length ||
      features.some(
        feature => typeof feature !== "string" || !supportedFeatures.has(feature)
      )
    ) {
      return {
        status: "invalid",
        reason: "player metadata field 'notSupportedFeatures' must be a non-empty unique list of known feature keys"
      };
    }
  }
  const dependenciesError = validateVeronaMetadataDependencies(
    metadata.dependencies,
    metadataMajor
  );
  if (dependenciesError) {
    return { status: "invalid", reason: dependenciesError };
  }
  const maintainerError = validateVeronaMetadataMaintainer(
    metadata.maintainer,
    strict
  );
  if (maintainerError) {
    return { status: "invalid", reason: maintainerError };
  }
  const codeError = validateVeronaMetadataCode(metadata.code, strict);
  if (codeError) {
    return { status: "invalid", reason: codeError };
  }

  return {
    status: "valid",
    id,
    version,
    specVersion,
    metadataVersion
  };
};

const validateExperimentalVeronaPlayerMetadataDocument = (
  metadata: Record<string, unknown>
): VeronaPlayerMetadataValidation => {
  if (metadata.type !== "player") {
    return {
      status: "invalid",
      reason: "experimental player metadata field 'type' must be 'player'"
    };
  }
  if (!isVeronaMetadataUri(metadata["$schema"])) {
    return {
      status: "invalid",
      reason: "experimental player metadata field '$schema' must be an absolute URI"
    };
  }

  const id = typeof metadata.id === "string" ? metadata.id : "";
  if (!veronaMetadataIdentifierPattern.test(id)) {
    return {
      status: "invalid",
      reason: "experimental player metadata field 'id' must start with a letter and contain only letters, digits, underscores, or hyphens"
    };
  }
  const nameError = validateVeronaLanguageTaggedStrings(
    metadata.name,
    "name",
    false
  );
  if (nameError) {
    return { status: "invalid", reason: nameError };
  }
  if (metadata.description !== undefined) {
    const descriptionError = validateVeronaLanguageTaggedStrings(
      metadata.description,
      "description",
      false
    );
    if (descriptionError) {
      return { status: "invalid", reason: descriptionError };
    }
  }

  const version = typeof metadata.version === "string" ? metadata.version : "";
  if (!veronaMetadataSemverPattern.test(version)) {
    return {
      status: "invalid",
      reason: "experimental player metadata field 'version' must use SemVer MAJOR.MINOR.PATCH notation"
    };
  }
  const specVersion =
    typeof metadata.specVersion === "string" ? metadata.specVersion : "";
  if (!veronaMetadataMajorMinorPattern.test(specVersion)) {
    return {
      status: "invalid",
      reason: "experimental player metadata field 'specVersion' must use MAJOR.MINOR notation"
    };
  }

  if (metadata.notSupportedFeatures !== undefined) {
    const features = metadata.notSupportedFeatures;
    if (
      !Array.isArray(features) ||
      new Set(features).size !== features.length ||
      features.some(feature => typeof feature !== "string")
    ) {
      return {
        status: "invalid",
        reason: "experimental player metadata field 'notSupportedFeatures' must be a unique string list"
      };
    }
  }
  const dependenciesError = validateVeronaMetadataDependencies(
    metadata.dependencies,
    2
  );
  if (dependenciesError) {
    return { status: "invalid", reason: dependenciesError };
  }
  const maintainerError = validateVeronaMetadataMaintainer(
    metadata.maintainer,
    false
  );
  if (maintainerError) {
    return { status: "invalid", reason: maintainerError };
  }
  const codeError = validateVeronaMetadataCode(metadata.code, false);
  if (codeError) {
    return { status: "invalid", reason: codeError };
  }

  return {
    status: "valid",
    id,
    version,
    specVersion,
    metadataVersion: "experimental-jsonld"
  };
};

const validateLegacyVeronaPlayerMetadataDocument = (
  metadata: Record<string, unknown>
): VeronaPlayerMetadataValidation => {
  if (
    typeof metadata["@type"] !== "string" ||
    metadata["@type"].toLowerCase() !== "player"
  ) {
    return {
      status: "invalid",
      reason: "legacy player metadata field '@type' must be 'player'"
    };
  }
  if (
    metadata["@context"] !== undefined &&
    !isVeronaMetadataUri(metadata["@context"])
  ) {
    return {
      status: "invalid",
      reason: "legacy player metadata field '@context' must be an absolute URI"
    };
  }

  const id = typeof metadata["@id"] === "string" ? metadata["@id"] : "";
  if (!veronaMetadataIdentifierPattern.test(id)) {
    return {
      status: "invalid",
      reason: "legacy player metadata field '@id' must start with a letter and contain only letters, digits, underscores, or hyphens"
    };
  }
  const version = typeof metadata.version === "string" ? metadata.version : "";
  if (!veronaMetadataSemverPattern.test(version)) {
    return {
      status: "invalid",
      reason: "legacy player metadata field 'version' must use SemVer MAJOR.MINOR.PATCH notation"
    };
  }
  const apiVersion =
    typeof metadata.apiVersion === "string" ? metadata.apiVersion : "";
  const normalizedSpecVersion = normalizeVeronaMajorMinorVersion(apiVersion);
  if (!normalizedSpecVersion) {
    return {
      status: "invalid",
      reason: "legacy player metadata field 'apiVersion' must use a numeric Verona version"
    };
  }

  for (const fieldName of ["name", "description"] as const) {
    if (metadata[fieldName] === undefined) {
      if (fieldName === "name") {
        return {
          status: "invalid",
          reason: "legacy player metadata field 'name' must be a language map"
        };
      }
      continue;
    }
    const languageMap = asVeronaMetadataRecord(metadata[fieldName]);
    if (
      !languageMap ||
      Object.keys(languageMap).length === 0 ||
      Object.entries(languageMap).some(
        ([language, value]) =>
          !/^[a-z]{2}$/i.test(language) ||
          typeof value !== "string" ||
          value.length === 0
      )
    ) {
      return {
        status: "invalid",
        reason: `legacy player metadata field '${fieldName}' must be a non-empty language map`
      };
    }
  }

  if (metadata.notSupportedFeatures !== undefined) {
    const features = metadata.notSupportedFeatures;
    if (
      !Array.isArray(features) ||
      features.some(feature => typeof feature !== "string")
    ) {
      return {
        status: "invalid",
        reason: "legacy player metadata field 'notSupportedFeatures' must be a string list"
      };
    }
  }

  return {
    status: "valid",
    id,
    version,
    specVersion: normalizedSpecVersion,
    metadataVersion: "legacy-jsonld"
  };
};

const parseVeronaPlayerReference = (
  playerKey: string
): { id: string; moduleVersion: string | null } => {
  const versionSeparator = playerKey.lastIndexOf("@");
  if (versionSeparator <= 0) {
    return { id: playerKey.trim(), moduleVersion: null };
  }
  const moduleVersion = playerKey.slice(versionSeparator + 1).trim();
  return {
    id: playerKey.slice(0, versionSeparator).trim(),
    moduleVersion: moduleVersion || null
  };
};

const normalizeVeronaMajorMinorVersion = (version: string): string | null => {
  const match = version.match(
    /^(\d+)(?:\.(\d+))?(?:\.\d+)?(?:[-+][0-9A-Za-z.-]+)?$/
  );
  return match
    ? `${Number.parseInt(match[1] ?? "", 10)}.${Number.parseInt(match[2] ?? "0", 10)}`
    : null;
};

const parseVeronaPlayerReferenceForMetadata = (
  playerKey: string,
  declaredPlayerId: string
): { id: string; moduleVersion: string | null } => {
  const reference = parseVeronaPlayerReference(playerKey);
  if (
    reference.moduleVersion ||
    reference.id.toLowerCase() === declaredPlayerId.toLowerCase()
  ) {
    return reference;
  }
  const legacyPrefix = `${declaredPlayerId}-`;
  if (!reference.id.toLowerCase().startsWith(legacyPrefix.toLowerCase())) {
    return reference;
  }
  const legacyModuleVersion = reference.id.slice(legacyPrefix.length);
  return normalizeVeronaMajorMinorVersion(legacyModuleVersion)
    ? { id: declaredPlayerId, moduleVersion: legacyModuleVersion }
    : reference;
};

const validateVeronaPlayerMetadata = (
  playerHtml: string
): VeronaPlayerMetadataValidation => {
  const metadataScripts = [...playerHtml.matchAll(/<script\b([^>]*)>([\s\S]*?)<\/script>/gi)]
    .filter(scriptMatch => {
      const attributes = parseXmlAttributes(scriptMatch[1] ?? "");
      return (
        readXmlAttribute(attributes, "type")?.trim().toLowerCase() ===
        "application/ld+json"
      );
    });
  if (metadataScripts.length === 0) {
    return { status: "missing" };
  }

  let invalidJson = false;
  for (const scriptMatch of metadataScripts) {
    try {
      const parsed = JSON.parse((scriptMatch[2] ?? "").trim()) as unknown;
      if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
        continue;
      }
      const metadata = parsed as Record<string, unknown>;
      const metadataType = metadata.type ?? metadata["@type"];
      if (
        typeof metadataType !== "string" ||
        metadataType.toLowerCase() !== "player"
      ) {
        continue;
      }
      if (metadata.type === undefined && metadata["@type"] !== undefined) {
        return validateLegacyVeronaPlayerMetadataDocument(metadata);
      }
      if (
        metadata.metadataVersion === undefined &&
        metadata["$schema"] !== undefined
      ) {
        return validateExperimentalVeronaPlayerMetadataDocument(metadata);
      }
      return validateVeronaPlayerMetadataDocument(metadata);
    } catch {
      invalidJson = true;
    }
  }

  return {
    status: "invalid",
    reason: invalidJson
      ? "application/ld+json metadata is not valid JSON"
      : "application/ld+json metadata does not describe a Verona player"
  };
};

const extractZipUnitDefinition = (
  sourceDocument: string
): ZipUnitDefinition => {
  const definitionMatch = sourceDocument.match(
    /<((?:[a-zA-Z_][\w.-]*:)?(DefinitionRef|Definition))\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/i
  );
  if (!definitionMatch) {
    return {
      playerKey: null,
      reference: null,
      unitDefinition: null,
      unitDefinitionType: null
    };
  }

  const attributes = parseXmlAttributes(definitionMatch[3] ?? "");
  const playerKey = normalizeManifestToken(
    readXmlAttribute(attributes, "player", "playerId", "playerKey", "type")
  );
  const rawContent = definitionMatch[4] ?? "";
  const reference =
    definitionMatch[2]?.toLowerCase() === "definitionref"
      ? normalizeManifestToken(
          readXmlAttribute(
            attributes,
            "href",
            "path",
            "src",
            "uri",
            "file",
            "fileName",
            "filename"
          ) ?? decodeXmlTextContent(rawContent)
        )
      : "";
  const cdata = rawContent.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/i)?.[1];
  const inlineDefinition =
    definitionMatch[2]?.toLowerCase() === "definition"
      ? normalizeRuntimeDocument(cdata ?? decodeXmlAttributeValue(rawContent.trim()))
      : undefined;

  return {
    playerKey: playerKey || null,
    reference: reference || null,
    unitDefinition: inlineDefinition ?? null,
    unitDefinitionType: playerKey || null
  };
};

type DeclaredTestcenterUnitCrossReferences = {
  playerKey: string | null;
  definitionReference: string | null;
  variablesReference: string | null;
  playerResourceReferences: string[];
};

const extractDeclaredTestcenterUnitCrossReferences = (
  sourceDocument: string
): DeclaredTestcenterUnitCrossReferences | null => {
  const parserErrors: string[] = [];
  let document: XmlDocument | null = null;
  try {
    document = new DOMParser({
      onError(_level, message) {
        parserErrors.push(message);
      }
    }).parseFromString(sourceDocument, "application/xml");
  } catch {
    return null;
  }
  if (parserErrors.length > 0 || !document?.documentElement) {
    return null;
  }

  const root = document.documentElement;
  const schemaLocation =
    root.getAttributeNS(
      "http://www.w3.org/2001/XMLSchema-instance",
      "noNamespaceSchemaLocation"
    ) || root.getAttribute("xsi:noNamespaceSchemaLocation");
  if (
    xmlElementLocalName(root) !== "Unit" ||
    !/(?:^|\/)definitions\/vo_Unit\.xsd(?:[?#].*)?$/i.test(schemaLocation ?? "")
  ) {
    return null;
  }

  const definition =
    xmlChildrenNamed(root, "DefinitionRef")[0] ??
    xmlChildrenNamed(root, "Definition")[0];
  const playerKey = definition?.getAttribute("player")?.trim() || null;
  const definitionReferenceAttribute = definition
    ? ["href", "path", "src", "uri", "file", "fileName", "filename"]
        .map(attributeName => definition.getAttribute(attributeName)?.trim())
        .find(Boolean)
    : undefined;
  const definitionReference =
    definition && xmlElementLocalName(definition) === "DefinitionRef"
      ? definitionReferenceAttribute || xmlElementText(definition) || null
      : null;
  const variablesReference =
    xmlElementText(xmlChildrenNamed(root, "VariablesRef")[0]) || null;
  const dependencies = xmlChildrenNamed(root, "Dependencies")[0];
  const playerResourceReferences = dependencies
    ? xmlChildElements(dependencies)
        .filter(dependency => {
          const dependencyName = xmlElementLocalName(dependency);
          const target = dependency.getAttribute("for")?.trim();
          return (
            ["File", "file"].includes(dependencyName) &&
            (!target || target === "player")
          );
        })
        .map(xmlElementText)
        .filter(Boolean)
    : [];

  return {
    playerKey,
    definitionReference: definitionReference || null,
    variablesReference,
    playerResourceReferences: [...new Set(playerResourceReferences)]
  };
};

type ZipUnitCodingSchemeReference = {
  reference: string;
  schemer: string | null;
  schemeType: string | null;
};

const extractZipUnitCodingSchemeReference = (
  sourceDocument: string
): ZipUnitCodingSchemeReference | null => {
  const referenceMatch = sourceDocument.match(
    /<((?:[a-zA-Z_][\w.-]*:)?CodingSchemeRef)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/i
  );
  if (!referenceMatch) {
    return null;
  }
  const attributes = parseXmlAttributes(referenceMatch[2] ?? "");
  const reference = normalizeManifestToken(
    readXmlAttribute(
      attributes,
      "href",
      "path",
      "src",
      "uri",
      "file",
      "fileName",
      "filename"
    ) ?? decodeXmlTextContent(referenceMatch[3] ?? "")
  );
  return {
    reference,
    schemer:
      normalizeManifestToken(readXmlAttribute(attributes, "schemer")) || null,
    schemeType:
      normalizeManifestToken(
        readXmlAttribute(attributes, "schemeType", "type")
      ) || null
  };
};

const parseUnitCodingSchemeDocument = (
  sourceDocument: string
):
  | { status: "valid"; codingScheme: UnitCodingScheme }
  | { status: "invalid" | "unsupported" } => {
  try {
    const codingScheme = normalizeUnitCodingScheme(JSON.parse(sourceDocument));
    if (!codingScheme) {
      return { status: "invalid" };
    }
    if (codingScheme.version && !/^\d+\.\d+$/.test(codingScheme.version)) {
      return { status: "invalid" };
    }
    if (CodingScheme.checkVersion(codingScheme) === "MAJOR_GREATER") {
      return { status: "unsupported" };
    }
    const normalizedScheme = new CodingScheme(codingScheme);
    const structurallyUsable = normalizedScheme.variableCodings.every(
      variableCoding =>
        typeof variableCoding.id === "string" &&
        typeof variableCoding.alias === "string" &&
        typeof variableCoding.sourceType === "string" &&
        typeof variableCoding.sourceParameters === "object" &&
        variableCoding.sourceParameters !== null &&
        Array.isArray(variableCoding.deriveSources) &&
        Array.isArray(variableCoding.codes)
    );
    return structurallyUsable
      ? { status: "valid", codingScheme }
      : { status: "invalid" };
  } catch {
    return { status: "invalid" };
  }
};

const findZipUnitCodingSchemeEntry = (
  manifestExtraction: Extract<ZipManifestExtractionResult, { status: "found" }>,
  unitEntry: ZipEntry,
  reference: string,
  manifestResources = collectXmlManifestResources(
    manifestExtraction.manifestText
  )
): ZipEntry | null => {
  const manifestResource = findXmlManifestResource(manifestResources, reference);
  return findZipEntryByPath(manifestExtraction.entries, [
    ...resolveZipResourcePathCandidates(unitEntry.fileName, reference),
    ...resolveZipResourcePathCandidates(
      manifestExtraction.manifestFileName,
      manifestResource?.key ?? reference
    )
  ]);
};

const findXmlManifestResource = (
  resources: Map<string, XmlManifestResource>,
  reference: string | null
): XmlManifestResource | null => {
  if (!reference) {
    return null;
  }
  const direct = resources.get(reference);
  if (direct) {
    return direct;
  }
  const normalizedReference = reference.toLowerCase();
  return (
    [...resources.entries()].find(
      ([identifier]) => identifier.toLowerCase() === normalizedReference
    )?.[1] ?? null
  );
};

const findZipUnitReferencedEntry = (
  manifestExtraction: Extract<ZipManifestExtractionResult, { status: "found" }>,
  unitEntry: ZipEntry,
  reference: string,
  manifestResources: Map<string, XmlManifestResource>
): ZipEntry | null => {
  const manifestResource = findXmlManifestResource(manifestResources, reference);
  const directEntry = findZipEntryByPath(manifestExtraction.entries, [
    ...resolveZipResourcePathCandidates(unitEntry.fileName, reference),
    ...(manifestResource
      ? resolveZipResourcePathCandidates(
          manifestExtraction.manifestFileName,
          manifestResource.key
        )
      : [])
  ]);
  if (directEntry) {
    return directEntry;
  }

  const referenceFileName = normalizeZipEntryPath(reference)
    .split("/")
    .at(-1)
    ?.toLowerCase();
  if (!referenceFileName) {
    return null;
  }
  const basenameMatches = manifestExtraction.entries.filter(
    entry =>
      normalizeZipEntryPath(entry.fileName).split("/").at(-1)?.toLowerCase() ===
      referenceFileName
  );
  return basenameMatches.length === 1 ? basenameMatches[0]! : null;
};

const findZipUnitPlayerEntry = (
  manifestExtraction: Extract<ZipManifestExtractionResult, { status: "found" }>,
  unitEntry: ZipEntry,
  playerKey: string,
  manifestResources: Map<string, XmlManifestResource>
): ZipEntry | null => {
  return (
    findZipUnitReferencedEntry(
      manifestExtraction,
      unitEntry,
      playerKey,
      manifestResources
    ) ??
    findZipUnitReferencedEntry(
      manifestExtraction,
      unitEntry,
      `${playerKey}.html`,
      manifestResources
    )
  );
};

const extractZipUnitDescription = (sourceDocument: string): string | null => {
  const description = normalizeUnitContent(
    readXmlChildText(
      sourceDocument,
      "description",
      "summary",
      "instructions",
      "title",
      "label"
    )
  );
  return description || null;
};

const extractZipUnitAttachmentRequests = (
  sourceDocument: string
): UnitAttachmentRequest[] => {
  const parserErrors: string[] = [];
  let document: XmlDocument | null = null;
  try {
    document = new DOMParser({
      onError(_level, message) {
        parserErrors.push(message);
      }
    }).parseFromString(sourceDocument, "application/xml");
  } catch {
    return [];
  }
  const root = document?.documentElement;
  if (
    parserErrors.length > 0 ||
    !root ||
    xmlElementLocalName(root).toLowerCase() !== "unit"
  ) {
    return [];
  }
  const baseVariables = xmlChildrenNamed(root, "BaseVariables")[0];
  if (!baseVariables) {
    return [];
  }
  return normalizeUnitAttachmentRequests(
    xmlChildrenNamed(baseVariables, "Variable").map(variable => ({
      variableId: variable.getAttribute("id"),
      attachmentType: variable.getAttribute("format")
    }))
  );
};

const parseStandaloneZipUnitEntry = (
  sourceDocument: string
): SourcePackageUnitEntry | null => {
  const parserErrors: string[] = [];
  let document: XmlDocument | null = null;
  try {
    document = new DOMParser({
      onError(_level, message) {
        parserErrors.push(message);
      }
    }).parseFromString(sourceDocument, "application/xml");
  } catch {
    return null;
  }
  const root = document?.documentElement;
  if (
    parserErrors.length > 0 ||
    !root ||
    xmlElementLocalName(root).toLowerCase() !== "unit"
  ) {
    return null;
  }
  const metadata = xmlChildrenNamed(root, "Metadata")[0];
  const unitKey = xmlElementText(xmlChildrenNamed(metadata ?? root, "Id")[0]);
  if (!unitKey) {
    return null;
  }
  const unitDefinition = extractZipUnitDefinition(sourceDocument);
  const description = extractZipUnitDescription(sourceDocument);
  const content = extractZipUnitContent(sourceDocument);
  const requestedAttachments =
    extractZipUnitAttachmentRequests(sourceDocument);
  return normalizeSourcePackageUnitEntry({
    unitKey,
    displayLabel:
      xmlElementText(xmlChildrenNamed(metadata ?? root, "Label")[0]) || unitKey,
    ...(description ? { description } : {}),
    ...(content ? { content } : {}),
    ...(unitDefinition.playerKey
      ? { playerKey: unitDefinition.playerKey }
      : {}),
    ...(unitDefinition.unitDefinition
      ? { unitDefinition: unitDefinition.unitDefinition }
      : {}),
    ...(unitDefinition.unitDefinitionType
      ? { unitDefinitionType: unitDefinition.unitDefinitionType }
      : {}),
    ...(requestedAttachments.length > 0 ? { requestedAttachments } : {})
  });
};

const hydrateZipUnitEntry = (input: {
  unitEntry: SourcePackageUnitEntry;
  sourceDocument: string;
  referencedEntry: ZipEntry;
  manifestExtraction: Extract<ZipManifestExtractionResult, { status: "found" }>;
  manifestResources: Map<string, XmlManifestResource>;
  playerEntriesByKey: Map<string, ContentReleasePlayerEntry>;
}): SourcePackageUnitEntry => {
  const unitDefinition = extractZipUnitDefinition(input.sourceDocument);
  const codingSchemeReference =
    extractZipUnitCodingSchemeReference(input.sourceDocument);
  const codingSchemeEntry = codingSchemeReference?.reference
    ? findZipUnitCodingSchemeEntry(
        input.manifestExtraction,
        input.referencedEntry,
        codingSchemeReference.reference,
        input.manifestResources
      )
    : null;
  const codingSchemeDocument = codingSchemeEntry
    ? readZipEntryText(input.manifestExtraction.zipBuffer, codingSchemeEntry)
    : null;
  const codingSchemeResult = codingSchemeDocument
    ? parseUnitCodingSchemeDocument(codingSchemeDocument)
    : null;
  const definitionEntry = unitDefinition.reference
    ? findZipUnitReferencedEntry(
        input.manifestExtraction,
        input.referencedEntry,
        unitDefinition.reference,
        input.manifestResources
      )
    : null;
  const definitionDocument = definitionEntry
    ? readZipEntryText(input.manifestExtraction.zipBuffer, definitionEntry)
    : null;
  const runtimeUnitDefinition = normalizeRuntimeDocument(
    definitionDocument ?? unitDefinition.unitDefinition
  );
  const definitionContent = definitionDocument
    ? normalizeUnitContent(decodeXmlTextContent(definitionDocument))
    : null;
  const content =
    input.unitEntry.content ??
    definitionContent ??
    extractZipUnitContent(input.sourceDocument);
  const description = input.unitEntry.description
    ? null
    : extractZipUnitDescription(input.sourceDocument);
  const requestedAttachments = extractZipUnitAttachmentRequests(
    input.sourceDocument
  );
  const playerEntry = unitDefinition.playerKey
    ? findZipUnitPlayerEntry(
        input.manifestExtraction,
        input.referencedEntry,
        unitDefinition.playerKey,
        input.manifestResources
      )
    : null;
  const playerHtml = playerEntry
    ? readZipEntryText(input.manifestExtraction.zipBuffer, playerEntry)
    : null;
  if (unitDefinition.playerKey && playerHtml) {
    input.playerEntriesByKey.set(unitDefinition.playerKey, {
      playerKey: unitDefinition.playerKey,
      html: playerHtml
    });
  }
  return {
    ...input.unitEntry,
    ...(description ? { description } : {}),
    ...(content ? { content } : {}),
    ...(unitDefinition.playerKey ? { playerKey: unitDefinition.playerKey } : {}),
    ...(runtimeUnitDefinition ? { unitDefinition: runtimeUnitDefinition } : {}),
    ...(unitDefinition.unitDefinitionType
      ? { unitDefinitionType: unitDefinition.unitDefinitionType }
      : {}),
    ...(codingSchemeResult?.status === "valid"
      ? { codingScheme: codingSchemeResult.codingScheme }
      : {}),
    ...(requestedAttachments.length > 0 ? { requestedAttachments } : {})
  };
};

const decodeBase64ZipSourceDocument = (sourceDocument: string): Buffer | null => {
  const trimmedSourceDocument = sourceDocument.trim();
  const dataUrlMatch = trimmedSourceDocument.match(
    /^data:[^,]*;base64,([\s\S]+)$/i
  );
  const base64Payload = (dataUrlMatch?.[1] ?? trimmedSourceDocument)
    .replace(/\s+/g, "")
    .replace(/-/g, "+")
    .replace(/_/g, "/");

  if (!/^[A-Za-z0-9+/=]+$/.test(base64Payload)) {
    return null;
  }

  const zipBuffer = Buffer.from(base64Payload, "base64");
  return findZipEndOfCentralDirectoryOffset(zipBuffer) >= 0 ? zipBuffer : null;
};

type ParticipantRosterDocument = {
  sourceFileName: string;
  rosterText: ParticipantRosterSource;
};

const extractTesttakersRosterDocumentsFromZipSourcePackage = (
  sourcePackage: SourcePackage
): ParticipantRosterDocument[] => {
  if (
    !sourcePackage.sourceDocument ||
    (!sourcePackage.fileName.toLowerCase().endsWith(".zip") &&
      !sourcePackage.mediaType.toLowerCase().includes("zip"))
  ) {
    return [];
  }

  const zipBuffer = decodeBase64ZipSourceDocument(sourcePackage.sourceDocument);
  const entries = zipBuffer ? readZipEntries(zipBuffer) : null;
  if (!zipBuffer || !entries) {
    return [];
  }

  const rosterDocuments: ParticipantRosterDocument[] = [];
  for (const entry of entries) {
    if (
      entry.fileName.endsWith("/") ||
      !entry.fileName.toLowerCase().endsWith(".xml")
    ) {
      continue;
    }
    const rosterText = readZipEntryText(zipBuffer, entry);
    if (
      rosterText &&
      readTestcenterXmlFileIdentity(rosterText)?.fileType === "Testtakers"
    ) {
      rosterDocuments.push({
        sourceFileName: entry.fileName,
        rosterText
      });
    }
  }
  return rosterDocuments;
};

const createManifestlessZipAssemblyManifest = (
  zipBuffer: Buffer,
  entries: ZipEntry[]
): string | null => {
  let hasTestcenterRuntimeRoot = false;
  const members: SourcePackageAssemblyEntry[] = entries.map((entry, index) => {
    const shouldInspectText = /\.(?:html?|xml)$/i.test(entry.fileName);
    const bytes = shouldInspectText
      ? readZipEntryBuffer(zipBuffer, entry, MAX_EXTRACTED_RESOURCE_BYTES)
      : null;
    if (
      bytes &&
      /\.xml$/i.test(entry.fileName) &&
      /^\uFEFF?\s*(?:(?:<\?[^?]*\?>|<!--[\s\S]*?-->)\s*)*<(?:(?:[A-Za-z_][\w.-]*):)?(?:Booklet|SysCheck)\b/i.test(
        bytes.toString("utf8")
      )
    ) {
      hasTestcenterRuntimeRoot = true;
    }
    return {
      sourcePackageId: `archive-entry-${index + 1}`,
      fileName: entry.fileName,
      bytes: bytes ?? Buffer.alloc(0)
    };
  });

  return hasTestcenterRuntimeRoot ? createAssemblyManifest(members) : null;
};

const extractXmlManifestFromZipSourceDocument = (
  sourceDocument: string
): ZipManifestExtractionResult => {
  const zipBuffer = decodeBase64ZipSourceDocument(sourceDocument);
  if (!zipBuffer) {
    return { status: "invalid_zip" };
  }

  const zipEntries = readZipEntries(zipBuffer);
  if (!zipEntries) {
    return { status: "invalid_zip" };
  }
  const entries = zipEntries.filter(
    entry => !entry.fileName.endsWith("/")
  );
  const isNamedManifestEntry = (entry: ZipEntry): boolean =>
    /(?:^|\/)(?:imsmanifest|manifest)\.xml$/i.test(entry.fileName);
  const candidates = entries
    .filter(entry => entry.fileName.toLowerCase().endsWith(".xml"))
    .sort(
      (left, right) =>
        Number(isNamedManifestEntry(right)) -
        Number(isNamedManifestEntry(left))
    );

  let foundUnreadableCandidate = false;
  let foundUnreadableNamedManifest = false;
  for (const entry of candidates) {
    const text = readZipEntryText(
      zipBuffer,
      entry,
      MAX_EXTRACTED_MANIFEST_BYTES
    );
    if (!text) {
      foundUnreadableCandidate = true;
      foundUnreadableNamedManifest ||= isNamedManifestEntry(entry);
      continue;
    }
    if (text?.trimStart().startsWith("<") && /<[^>]*manifest\b/i.test(text)) {
      return {
        status: "found",
        manifestText: text,
        manifestFileName: entry.fileName,
        zipBuffer,
        entries
      };
    }
  }

  if (!foundUnreadableNamedManifest) {
    const syntheticManifest = createManifestlessZipAssemblyManifest(
      zipBuffer,
      entries
    );
    if (syntheticManifest) {
      return {
        status: "found",
        manifestText: syntheticManifest,
        manifestFileName: "",
        zipBuffer,
        entries
      };
    }
  }

  return {
    status: foundUnreadableCandidate ? "manifest_unreadable" : "manifest_missing"
  };
};

const normalizeParsedZipXmlContentStructure = (
  manifestExtraction: Extract<ZipManifestExtractionResult, { status: "found" }>
): ContentReleaseRuntimeSnapshot | null => {
  const manifestResources = collectXmlManifestResources(
    manifestExtraction.manifestText
  );
  const playerEntriesByKey = new Map<
    string,
    NonNullable<ContentReleaseRuntimeSnapshot["playerEntries"]>[number]
  >();
  const bookletUnitContentPathCandidatesByUnitKey = new Map<
    string,
    ZipResourcePathCandidate[]
  >();
  const addBookletUnitContentPathCandidates = (
    baseFileName: string,
    candidatesByUnitKey: Map<string, string[]>
  ): void => {
    for (const [unitKey, resourcePaths] of candidatesByUnitKey) {
      const existingCandidates =
        bookletUnitContentPathCandidatesByUnitKey.get(unitKey) ?? [];
      bookletUnitContentPathCandidatesByUnitKey.set(unitKey, [
        ...existingCandidates,
        ...resourcePaths.map(resourcePath => ({ baseFileName, resourcePath }))
      ]);
    }
  };

  let runtimeSnapshot = normalizeParsedXmlContentStructure(
    manifestExtraction.manifestText
  );
  const visitedReferencedEntryPaths = new Set<string>();
  const referencedRuntimeSnapshots = [...manifestResources.values()].flatMap(resource => {
    const referencedEntry = findZipEntryByPath(
      manifestExtraction.entries,
      resolveZipResourcePathCandidates(
        manifestExtraction.manifestFileName,
        resource.key
      )
    );
    if (!referencedEntry) {
      return [];
    }
    const normalizedReferencedEntryPath = normalizeZipEntryPath(
      referencedEntry.fileName
    ).toLowerCase();
    if (visitedReferencedEntryPaths.has(normalizedReferencedEntryPath)) {
      return [];
    }
    visitedReferencedEntryPaths.add(normalizedReferencedEntryPath);

    const sourceDocument = readZipEntryText(
      manifestExtraction.zipBuffer,
      referencedEntry
    );
    if (!sourceDocument) {
      return [];
    }

    addBookletUnitContentPathCandidates(
      referencedEntry.fileName,
      collectXmlBookletUnitContentPathCandidates(sourceDocument)
    );

    const referencedSnapshot = normalizeParsedXmlContentStructure(sourceDocument);
    return referencedSnapshot ? [referencedSnapshot] : [];
  });
  const referencedBookletEntries = referencedRuntimeSnapshots.flatMap(
    snapshot => snapshot.bookletEntries
  );
  const referencedSystemCheckEntries = referencedRuntimeSnapshots.flatMap(
    snapshot => snapshot.systemCheckEntries ?? []
  );
  // These entries already are normalized runtime structures. Normalizing them
  // as source entries again would discard compiled booklet policies.
  const referencedRuntimeSnapshot: ContentReleaseRuntimeSnapshot | null =
    referencedBookletEntries.length > 0 || referencedSystemCheckEntries.length > 0
      ? {
          bookletEntries: referencedBookletEntries,
          ...(referencedSystemCheckEntries.length > 0
            ? { systemCheckEntries: referencedSystemCheckEntries }
            : {})
        }
      : null;

  if (referencedRuntimeSnapshot) {
    runtimeSnapshot = {
      bookletEntries:
        referencedRuntimeSnapshot.bookletEntries.length > 0
          ? referencedRuntimeSnapshot.bookletEntries
          : runtimeSnapshot?.bookletEntries ?? [],
      ...(referencedRuntimeSnapshot.systemCheckEntries?.length
        ? {
            systemCheckEntries: referencedRuntimeSnapshot.systemCheckEntries
          }
        : runtimeSnapshot?.systemCheckEntries?.length
          ? { systemCheckEntries: runtimeSnapshot.systemCheckEntries }
          : {})
    };
  }

  if (!runtimeSnapshot) {
    runtimeSnapshot = referencedRuntimeSnapshot;
    if (!runtimeSnapshot) {
      return null;
    }
  }
  const contentPathCandidatesByResourceKey =
    collectXmlManifestResourceContentPathCandidates(
      manifestExtraction.manifestText
    );

  return {
    bookletEntries: runtimeSnapshot.bookletEntries.map(bookletEntry => ({
      ...bookletEntry,
      unitEntries: bookletEntry.unitEntries.map(unitEntry => {
        const manifestResourcePathCandidates = (
          contentPathCandidatesByResourceKey.get(unitEntry.unitKey) ?? []
        ).map(resourcePath => ({
          baseFileName: manifestExtraction.manifestFileName,
          resourcePath
        }));
        const bookletResourcePathCandidates =
          bookletUnitContentPathCandidatesByUnitKey.get(unitEntry.unitKey) ??
          [];
        const resourcePathCandidates: ZipResourcePathCandidate[] = [
          ...manifestResourcePathCandidates,
          ...bookletResourcePathCandidates,
          {
            baseFileName: manifestExtraction.manifestFileName,
            resourcePath: unitEntry.unitKey
          }
        ];
        const referencedEntry = findZipEntryByPath(
          manifestExtraction.entries,
          resourcePathCandidates.flatMap(candidate => {
            const manifestResource = findXmlManifestResource(
              manifestResources,
              candidate.resourcePath
            );
            return [
              ...resolveZipResourcePathCandidates(
                candidate.baseFileName,
                candidate.resourcePath
              ),
              ...(manifestResource
                ? resolveZipResourcePathCandidates(
                    manifestExtraction.manifestFileName,
                    manifestResource.key
                  )
                : [])
            ];
          })
        );
        if (!referencedEntry) {
          return unitEntry;
        }

        const sourceDocument = readZipEntryText(
          manifestExtraction.zipBuffer,
          referencedEntry
        );
        if (!sourceDocument) {
          return unitEntry;
        }

        return hydrateZipUnitEntry({
          unitEntry,
          sourceDocument,
          referencedEntry,
          manifestExtraction,
          manifestResources,
          playerEntriesByKey
        });
      })
    })),
    ...(runtimeSnapshot.systemCheckEntries?.length
      ? {
          systemCheckEntries: runtimeSnapshot.systemCheckEntries.map(
            systemCheck => {
              if (!systemCheck.unitKey) {
                return systemCheck;
              }
              const unitResource = findXmlManifestResource(
                manifestResources,
                systemCheck.unitKey
              );
              const referencedEntry = unitResource
                ? findZipEntryByPath(
                    manifestExtraction.entries,
                    resolveZipResourcePathCandidates(
                      manifestExtraction.manifestFileName,
                      unitResource.key
                    )
                  )
                : null;
              if (!referencedEntry) {
                return systemCheck;
              }
              const sourceDocument = readZipEntryText(
                manifestExtraction.zipBuffer,
                referencedEntry
              );
              const unitEntry = sourceDocument
                ? parseStandaloneZipUnitEntry(sourceDocument)
                : null;
              if (!sourceDocument || !unitEntry) {
                return systemCheck;
              }
              return {
                ...systemCheck,
                unitEntry: hydrateZipUnitEntry({
                  unitEntry,
                  sourceDocument,
                  referencedEntry,
                  manifestExtraction,
                  manifestResources,
                  playerEntriesByKey
                })
              };
            }
          )
        }
      : {}),
    ...(playerEntriesByKey.size > 0
      ? { playerEntries: [...playerEntriesByKey.values()] }
      : {})
  };
};

const parseTestcenterXmlRoot = (sourceDocument: string): XmlElement | null => {
  const parserErrors: string[] = [];
  try {
    const document = new DOMParser({
      onError(_level, message) {
        parserErrors.push(message);
      }
    }).parseFromString(sourceDocument, "application/xml");
    return parserErrors.length === 0 ? document?.documentElement ?? null : null;
  } catch {
    return null;
  }
};

const collectTestcenterVariableIds = (root: XmlElement): Set<string> => {
  const variableIds = new Set<string>();
  for (const containerName of ["BaseVariables", "DerivedVariables"]) {
    const containers = [
      ...(xmlElementLocalName(root) === containerName ? [root] : []),
      ...xmlDescendantsNamed(root, containerName)
    ];
    for (const container of containers) {
      for (const variable of xmlDescendantsNamed(container, "Variable")) {
        const variableId = variable.getAttribute("id")?.trim() ?? "";
        if (variableId) {
          variableIds.add(variableId);
        }
      }
    }
  }
  return variableIds;
};

type TestcenterAdaptiveVariableReference = {
  bookletFileName: string;
  bookletId: string;
  unitRuntimeKey: string;
  unitId: string;
  variableId: string;
  sourceType: string;
};

const collectTestcenterAdaptiveVariableReferences = (
  sourceDocument: string,
  bookletFileName: string
): TestcenterAdaptiveVariableReference[] => {
  const root = parseTestcenterXmlRoot(sourceDocument);
  if (!root || xmlElementLocalName(root) !== "Booklet") {
    return [];
  }
  const metadata = xmlChildrenNamed(root, "Metadata")[0];
  const bookletId = xmlElementText(xmlChildrenNamed(metadata ?? root, "Id")[0]);
  const units = xmlChildrenNamed(root, "Units")[0];
  const unitIdByRuntimeKey = new Map<string, string>();
  for (const unit of units ? xmlDescendantsNamed(units, "Unit") : []) {
    const unitId = unit.getAttribute("id")?.trim() ?? "";
    const unitRuntimeKey = unit.getAttribute("alias")?.trim() || unitId;
    if (unitId && unitRuntimeKey && !unitIdByRuntimeKey.has(unitRuntimeKey)) {
      unitIdByRuntimeKey.set(unitRuntimeKey, unitId);
    }
  }
  const states = xmlChildrenNamed(root, "States")[0];
  if (!states) {
    return [];
  }
  return testcenterBookletVariableSourceNames.flatMap(sourceType =>
    xmlDescendantsNamed(states, sourceType).flatMap(source => {
      const unitRuntimeKey = source.getAttribute("from")?.trim() ?? "";
      const variableId = source.getAttribute("of")?.trim() ?? "";
      const unitId = unitIdByRuntimeKey.get(unitRuntimeKey) ?? "";
      return unitRuntimeKey && variableId && unitId
        ? [{
            bookletFileName,
            bookletId,
            unitRuntimeKey,
            unitId,
            variableId,
            sourceType
          }]
        : [];
    })
  );
};

const validateZipXmlEntries = (
  manifestExtraction: Extract<ZipManifestExtractionResult, { status: "found" }>
): ImportJobDiagnostic[] => {
  const diagnostics: ImportJobDiagnostic[] = [];
  const validatedPlayerKeys = new Set<string>();
  const xmlIdentitySourceFileByKey = new Map<string, string>();
  const rosterGroupSourceByKey = new Map<
    string,
    { value: string; sourceFileName: string }
  >();
  const rosterLoginSourceByKey = new Map<
    string,
    { value: string; sourceFileName: string }
  >();
  const zipEntrySourceFileByPath = new Map<string, string>();
  for (const entry of manifestExtraction.entries) {
    if (!isSafeRelativeArchivePath(entry.fileName, entry.fileName.endsWith("/"))) {
      diagnostics.push(
        createImportDiagnostic(
          "source_document_zip_entry_path_invalid",
          `Source package ZIP entry '${entry.fileName}' is not a safe relative archive path.`
        )
      );
      continue;
    }
    if (entry.fileName.endsWith("/")) {
      continue;
    }
    const normalizedPath = normalizeZipEntryPath(entry.fileName);
    const identityKey = normalizedPath.toLowerCase();
    const existingSourceFile = zipEntrySourceFileByPath.get(identityKey);
    if (existingSourceFile) {
      diagnostics.push(
        createImportDiagnostic(
          "source_document_zip_entry_name_duplicate",
          `Source package ZIP entries '${existingSourceFile}' and '${entry.fileName}' use the same case-insensitive archive path.`
        )
      );
    } else {
      zipEntrySourceFileByPath.set(identityKey, entry.fileName);
    }
  }
  const manifestResources = collectXmlManifestResources(
    manifestExtraction.manifestText
  );
  const manifestResourceIdentifierByKey = new Map<string, string>();
  for (const resourceIdentifier of collectXmlManifestResourceIdentifiers(
    manifestExtraction.manifestText
  )) {
    const identityKey = resourceIdentifier.toLowerCase();
    const existingIdentifier = manifestResourceIdentifierByKey.get(identityKey);
    if (existingIdentifier) {
      diagnostics.push(
        createImportDiagnostic(
          "source_document_manifest_resource_id_duplicate",
          `Source package manifest '${manifestExtraction.manifestFileName}' declares duplicate case-insensitive resource identifiers '${existingIdentifier}' and '${resourceIdentifier}'.`
        )
      );
    } else {
      manifestResourceIdentifierByKey.set(identityKey, resourceIdentifier);
    }
  }
  const unitVariablesById = new Map<
    string,
    { sourceFileName: string; variableIds: Set<string> }
  >();
  const adaptiveVariableReferences: TestcenterAdaptiveVariableReference[] = [];
  for (const entry of manifestExtraction.entries) {
    if (
      entry.fileName.endsWith("/") ||
      !entry.fileName.toLowerCase().endsWith(".xml")
    ) {
      continue;
    }
    const sourceDocument = readZipEntryText(
      manifestExtraction.zipBuffer,
      entry
    );
    if (sourceDocument === null) {
      continue;
    }
    adaptiveVariableReferences.push(
      ...collectTestcenterAdaptiveVariableReferences(
        sourceDocument,
        entry.fileName
      )
    );
    const root = parseTestcenterXmlRoot(sourceDocument);
    if (!root || xmlElementLocalName(root) !== "Unit") {
      continue;
    }
    const metadata = xmlChildrenNamed(root, "Metadata")[0];
    const unitId = xmlElementText(xmlChildrenNamed(metadata ?? root, "Id")[0]);
    if (!unitId) {
      continue;
    }
    const variableIds = collectTestcenterVariableIds(root);
    const declaredUnitReferences =
      extractDeclaredTestcenterUnitCrossReferences(sourceDocument);
    if (declaredUnitReferences?.variablesReference) {
      const variablesEntry = findZipUnitReferencedEntry(
        manifestExtraction,
        entry,
        declaredUnitReferences.variablesReference,
        manifestResources
      );
      const variablesDocument = variablesEntry
        ? readZipEntryText(manifestExtraction.zipBuffer, variablesEntry)
        : null;
      const variablesRoot = variablesDocument
        ? parseTestcenterXmlRoot(variablesDocument)
        : null;
      if (variablesRoot) {
        for (const variableId of collectTestcenterVariableIds(variablesRoot)) {
          variableIds.add(variableId);
        }
      }
    }
    if (!unitVariablesById.has(unitId.toLowerCase())) {
      unitVariablesById.set(unitId.toLowerCase(), {
        sourceFileName: entry.fileName,
        variableIds
      });
    }
  }
  for (const reference of adaptiveVariableReferences) {
    const unitVariables = unitVariablesById.get(reference.unitId.toLowerCase());
    if (
      unitVariables &&
      !unitVariables.variableIds.has(reference.variableId)
    ) {
      diagnostics.push(
        createImportDiagnostic(
          "source_document_adaptive_variable_missing",
          `Adaptive ${reference.sourceType} source '${reference.variableId}' in booklet ZIP entry '${reference.bookletFileName}' (` +
            `${reference.bookletId || "unknown"}) uses Unit runtime key '${reference.unitRuntimeKey}', but Unit '${reference.unitId}' ` +
            `in '${unitVariables.sourceFileName}' does not declare that variable.`
        )
      );
    }
  }
  for (const entry of manifestExtraction.entries) {
    if (
      entry.fileName.endsWith("/") ||
      !entry.fileName.toLowerCase().endsWith(".xml")
    ) {
      continue;
    }

    const sourceDocument = readZipEntryText(
      manifestExtraction.zipBuffer,
      entry
    );
    if (sourceDocument === null) {
      diagnostics.push(
        createImportDiagnostic(
          "source_document_zip_xml_unreadable",
          `Source package ZIP XML entry '${entry.fileName}' failed its compression, size, or checksum integrity check.`
        )
      );
      continue;
    }
    diagnostics.push(
      ...validateTestcenterXmlSourceDocument(sourceDocument, entry.fileName)
    );
    const xmlFileIdentity = readTestcenterXmlFileIdentity(sourceDocument);
    let hasDuplicateXmlIdentity = false;
    if (xmlFileIdentity) {
      const identityKey =
        `${xmlFileIdentity.fileType}:${xmlFileIdentity.id}`.toUpperCase();
      const existingIdentitySourceFile =
        xmlIdentitySourceFileByKey.get(identityKey);
      if (existingIdentitySourceFile) {
        hasDuplicateXmlIdentity = true;
        const identityDescription =
          xmlFileIdentity.source === "roster"
            ? "the same case-insensitive group and login assignments"
            : `duplicate ${xmlFileIdentity.fileType} id '${xmlFileIdentity.id}'`;
        diagnostics.push(
          createImportDiagnostic(
            `testcenter_xml_${xmlFileIdentity.fileType.toLowerCase()}_id_duplicate`,
            `Original Testcenter ZIP entries '${existingIdentitySourceFile}' and '${entry.fileName}' contain ${identityDescription}.`
          )
        );
      } else {
        xmlIdentitySourceFileByKey.set(identityKey, entry.fileName);
      }
    }
    if (
      xmlFileIdentity?.fileType === "Testtakers" &&
      !hasDuplicateXmlIdentity
    ) {
      const rosterStructure = readTesttakersRosterStructure(sourceDocument);
      const registerRosterValues = (
        values: string[],
        valueLabel: "group id" | "login name",
        diagnosticCode:
          | "testcenter_xml_group_id_cross_file_duplicate"
          | "testcenter_xml_login_name_cross_file_duplicate",
        sourceByKey: Map<
          string,
          { value: string; sourceFileName: string }
        >
      ): void => {
        const valuesInCurrentFile = new Set<string>();
        for (const value of values) {
          const identityKey = value.toLowerCase();
          if (!identityKey || valuesInCurrentFile.has(identityKey)) {
            continue;
          }
          valuesInCurrentFile.add(identityKey);
          const existingSource = sourceByKey.get(identityKey);
          if (existingSource) {
            diagnostics.push(
              createImportDiagnostic(
                diagnosticCode,
                `Original Testcenter ZIP entries '${existingSource.sourceFileName}' and '${entry.fileName}' reuse Testtakers ${valueLabel} '${value}' (first declared as '${existingSource.value}'), which must be unique case-insensitively across files.`
              )
            );
          } else {
            sourceByKey.set(identityKey, {
              value,
              sourceFileName: entry.fileName
            });
          }
        }
      };
      if (rosterStructure) {
        registerRosterValues(
          rosterStructure.groups.map(group => group.groupId),
          "group id",
          "testcenter_xml_group_id_cross_file_duplicate",
          rosterGroupSourceByKey
        );
        registerRosterValues(
          rosterStructure.groups.flatMap(group => group.loginNames),
          "login name",
          "testcenter_xml_login_name_cross_file_duplicate",
          rosterLoginSourceByKey
        );
      }
    }
    for (const systemCheck of parseSystemCheckSourceDocument(sourceDocument)) {
      if (!systemCheck.unitKey) {
        continue;
      }
      const unitResource = findXmlManifestResource(
        manifestResources,
        systemCheck.unitKey
      );
      const unitEntry = unitResource
        ? findZipEntryByPath(
            manifestExtraction.entries,
            resolveZipResourcePathCandidates(
              manifestExtraction.manifestFileName,
              unitResource.key
            )
          )
        : null;
      if (!unitEntry) {
        diagnostics.push(
          createImportDiagnostic(
            "source_document_system_check_unit_missing",
            `System-check ZIP entry '${entry.fileName}' references missing unit '${systemCheck.unitKey}'.`
          )
        );
      }
    }
    const unitDefinition = extractZipUnitDefinition(sourceDocument);
    const declaredUnitReferences =
      extractDeclaredTestcenterUnitCrossReferences(sourceDocument);
    const playerEntry = unitDefinition.playerKey
      ? findZipUnitPlayerEntry(
          manifestExtraction,
          entry,
          unitDefinition.playerKey,
          manifestResources
        )
      : null;
    if (declaredUnitReferences?.playerKey && !playerEntry) {
      diagnostics.push(
        createImportDiagnostic(
          "source_document_unit_player_missing",
          `Unit ZIP entry '${entry.fileName}' references missing player '${declaredUnitReferences.playerKey}'.`
        )
      );
    }
    if (declaredUnitReferences?.definitionReference) {
      const definitionEntry = findZipUnitReferencedEntry(
        manifestExtraction,
        entry,
        declaredUnitReferences.definitionReference,
        manifestResources
      );
      if (!definitionEntry) {
        diagnostics.push(
          createImportDiagnostic(
            "source_document_unit_definition_missing",
            `Unit ZIP entry '${entry.fileName}' references missing definition '${declaredUnitReferences.definitionReference}'.`
          )
        );
      } else if (
        readZipEntryText(manifestExtraction.zipBuffer, definitionEntry) === null
      ) {
        diagnostics.push(
          createImportDiagnostic(
            "source_document_unit_definition_unreadable",
            `Unit definition ZIP entry '${definitionEntry.fileName}' could not be read.`
          )
        );
      }
    }
    if (declaredUnitReferences?.variablesReference) {
      const variablesEntry = findZipUnitReferencedEntry(
        manifestExtraction,
        entry,
        declaredUnitReferences.variablesReference,
        manifestResources
      );
      if (!variablesEntry) {
        diagnostics.push(
          createImportDiagnostic(
            "source_document_unit_variables_missing",
            `Unit ZIP entry '${entry.fileName}' references missing variables resource '${declaredUnitReferences.variablesReference}'.`
          )
        );
      } else if (
        readZipEntryText(manifestExtraction.zipBuffer, variablesEntry) === null
      ) {
        diagnostics.push(
          createImportDiagnostic(
            "source_document_unit_variables_unreadable",
            `Unit variables ZIP entry '${variablesEntry.fileName}' could not be read.`
          )
        );
      }
    }
    for (const resourceReference of
      declaredUnitReferences?.playerResourceReferences ?? []) {
      if (
        !findZipUnitReferencedEntry(
          manifestExtraction,
          entry,
          resourceReference,
          manifestResources
        )
      ) {
        diagnostics.push(
          createImportDiagnostic(
            "source_document_unit_player_resource_missing",
            `Unit ZIP entry '${entry.fileName}' references missing player resource '${resourceReference}'.`
          )
        );
      }
    }
    if (
      unitDefinition.playerKey &&
      !validatedPlayerKeys.has(unitDefinition.playerKey.toLowerCase())
    ) {
      validatedPlayerKeys.add(unitDefinition.playerKey.toLowerCase());
      if (playerEntry) {
        const playerHtml = readZipEntryText(
          manifestExtraction.zipBuffer,
          playerEntry
        );
        if (playerHtml === null) {
          diagnostics.push(
            createImportDiagnostic(
              "source_document_player_unreadable",
              `Verona player ZIP entry '${playerEntry.fileName}' could not be read.`
            )
          );
        } else {
          const metadata = validateVeronaPlayerMetadata(playerHtml);
          if (metadata.status === "invalid") {
            diagnostics.push(
              createImportDiagnostic(
                "source_document_player_metadata_invalid",
                `Verona player ZIP entry '${playerEntry.fileName}' ${metadata.reason}.`
              )
            );
          } else if (metadata.status === "unsupported") {
            diagnostics.push(
              createImportDiagnostic(
                "source_document_player_metadata_version_unsupported",
                `Verona player ZIP entry '${playerEntry.fileName}' ${metadata.reason}.`
              )
            );
          } else if (metadata.status === "missing") {
            diagnostics.push(
              createImportDiagnostic(
                "source_document_player_metadata_missing",
                `Verona player ZIP entry '${playerEntry.fileName}' has no application/ld+json metadata; unit reference '${unitDefinition.playerKey}' may identify a module version but cannot prove Verona API compatibility, so the runtime ready handshake remains authoritative.`,
                "warning"
              )
            );
          } else if (
            metadata.status === "valid" &&
            !isSupportedVeronaPlayerApiVersion(metadata.specVersion)
          ) {
            diagnostics.push(
              createImportDiagnostic(
                "source_document_player_api_version_unsupported",
                `Verona player ZIP entry '${playerEntry.fileName}' declares unsupported API version '${metadata.specVersion}'.`
              )
            );
          } else if (metadata.status === "valid") {
            const playerReference = parseVeronaPlayerReferenceForMetadata(
              unitDefinition.playerKey,
              metadata.id
            );
            const referencedModuleVersion = playerReference.moduleVersion
              ? normalizeVeronaMajorMinorVersion(playerReference.moduleVersion)
              : null;
            const declaredModuleVersion = normalizeVeronaMajorMinorVersion(
              metadata.version
            );
            if (
              referencedModuleVersion &&
              declaredModuleVersion &&
              referencedModuleVersion !== declaredModuleVersion
            ) {
              diagnostics.push(
                createImportDiagnostic(
                  "source_document_player_version_mismatch",
                  `Unit ZIP entry '${entry.fileName}' references player module version '${playerReference.moduleVersion}', but '${playerEntry.fileName}' declares module version '${metadata.version}'.`
                )
              );
            } else if (
              metadata.id &&
              playerReference.id &&
              playerReference.id.toLowerCase() !== metadata.id.toLowerCase()
            ) {
              diagnostics.push(
                createImportDiagnostic(
                  "source_document_player_identity_mismatch",
                  `Unit ZIP entry '${entry.fileName}' references player '${unitDefinition.playerKey}', but '${playerEntry.fileName}' declares id '${metadata.id}'.`
                )
              );
            }
          }
        }
      }
    }
    const codingSchemeReference =
      extractZipUnitCodingSchemeReference(sourceDocument);
    if (!codingSchemeReference) {
      continue;
    }
    if (!codingSchemeReference.reference) {
      // Original Unit 17.6 permits a schemer-only CodingSchemeRef. It selects
      // the external/default schemer without declaring a packaged scheme.
      continue;
    }
    const codingSchemeEntry = findZipUnitCodingSchemeEntry(
      manifestExtraction,
      entry,
      codingSchemeReference.reference,
      manifestResources
    );
    if (!codingSchemeEntry) {
      diagnostics.push(
        createImportDiagnostic(
          "source_document_coding_scheme_missing",
          `Unit ZIP entry '${entry.fileName}' references missing coding scheme '${codingSchemeReference.reference}'.`
        )
      );
      continue;
    }
    const codingSchemeDocument = readZipEntryText(
      manifestExtraction.zipBuffer,
      codingSchemeEntry
    );
    if (codingSchemeDocument === null) {
      diagnostics.push(
        createImportDiagnostic(
          "source_document_coding_scheme_unreadable",
          `Coding scheme ZIP entry '${codingSchemeEntry.fileName}' could not be read.`
        )
      );
      continue;
    }
    const parsedCodingScheme = parseUnitCodingSchemeDocument(
      codingSchemeDocument
    );
    if (parsedCodingScheme.status !== "valid") {
      diagnostics.push(
        createImportDiagnostic(
          parsedCodingScheme.status === "unsupported"
            ? "source_document_coding_scheme_version_unsupported"
            : "source_document_coding_scheme_invalid",
          parsedCodingScheme.status === "unsupported"
            ? `Coding scheme ZIP entry '${codingSchemeEntry.fileName}' uses a newer unsupported major version.`
            : `Coding scheme ZIP entry '${codingSchemeEntry.fileName}' is not a valid IQB coding scheme.`
        )
      );
    }
  }
  const playerSourceFileByResourceId = new Map<string, string>();
  for (const entry of manifestExtraction.entries) {
    if (
      entry.fileName.endsWith("/") ||
      !/\.html?$/i.test(entry.fileName)
    ) {
      continue;
    }
    const playerHtml = readZipEntryText(
      manifestExtraction.zipBuffer,
      entry
    );
    if (playerHtml === null) {
      continue;
    }
    const playerResourceId = readVeronaPlayerResourceId(
      playerHtml,
      entry.fileName
    );
    if (!playerResourceId) {
      continue;
    }
    const identityKey = playerResourceId.toUpperCase();
    const existingSourceFile = playerSourceFileByResourceId.get(identityKey);
    if (existingSourceFile) {
      diagnostics.push(
        createImportDiagnostic(
          "testcenter_resource_id_duplicate",
          `Original Testcenter ZIP entries '${existingSourceFile}' and '${entry.fileName}' contain duplicate Verona player resource id '${playerResourceId}'.`
        )
      );
    } else {
      playerSourceFileByResourceId.set(identityKey, entry.fileName);
    }
  }
  return diagnostics;
};

const resourceMediaTypeForPath = (resourcePath: string): string => {
  const extension = resourcePath.toLowerCase().split(".").at(-1) ?? "";
  return (
    {
      css: "text/css; charset=utf-8",
      gif: "image/gif",
      htm: "text/html; charset=utf-8",
      html: "text/html; charset=utf-8",
      jpeg: "image/jpeg",
      jpg: "image/jpeg",
      js: "text/javascript; charset=utf-8",
      json: "application/json; charset=utf-8",
      mp3: "audio/mpeg",
      mp4: "video/mp4",
      pdf: "application/pdf",
      png: "image/png",
      svg: "image/svg+xml",
      text: "text/plain; charset=utf-8",
      txt: "text/plain; charset=utf-8",
      webm: "video/webm",
      xml: "application/xml; charset=utf-8"
    }[extension] ?? "application/octet-stream"
  );
};

const extractNestedResourcePackages = (
  manifestExtraction: Extract<ZipManifestExtractionResult, { status: "found" }>
): {
  resourceEntries: NonNullable<ContentReleaseRuntimeSnapshot["resourceEntries"]>;
  diagnostics: ImportJobDiagnostic[];
} => {
  const resourceEntries: NonNullable<
    ContentReleaseRuntimeSnapshot["resourceEntries"]
  > = [];
  const diagnostics: ImportJobDiagnostic[] = [];
  const seenPaths = new Set<string>();
  let extractedBytes = 0;

  for (const packageEntry of manifestExtraction.entries.filter(entry =>
    entry.fileName.toLowerCase().endsWith(".itcr.zip")
  )) {
    const packageBuffer = readZipEntryBuffer(
      manifestExtraction.zipBuffer,
      packageEntry,
      MAX_EXTRACTED_RESOURCE_TOTAL_BYTES
    );
    if (!packageBuffer || findZipEndOfCentralDirectoryOffset(packageBuffer) < 0) {
      diagnostics.push(
        createImportDiagnostic(
          "source_document_resource_package_invalid",
          `Resource package ZIP entry '${packageEntry.fileName}' could not be read.`
        )
      );
      continue;
    }

    const normalizedPackagePath = normalizeZipEntryPath(packageEntry.fileName);
    const packageFileName = normalizedPackagePath.split("/").at(-1) ?? "";
    const packageKey = packageFileName.slice(0, -".itcr.zip".length);
    const nestedZipEntries = readZipEntries(packageBuffer);
    if (!nestedZipEntries) {
      diagnostics.push(
        createImportDiagnostic(
          "source_document_resource_package_invalid",
          `Resource package ZIP entry '${packageEntry.fileName}' contains an invalid central directory.`
        )
      );
      continue;
    }
    const nestedEntries = nestedZipEntries.filter(
      entry => !entry.fileName.endsWith("/")
    );
    for (const nestedEntry of nestedEntries) {
      if (!isSafeRelativeArchivePath(nestedEntry.fileName, false)) {
        diagnostics.push(
          createImportDiagnostic(
            "source_document_resource_path_invalid",
            `Resource package '${packageEntry.fileName}' contains an unsafe or duplicate entry '${nestedEntry.fileName}'.`
          )
        );
        continue;
      }
      const nestedPath = normalizeZipEntryPath(nestedEntry.fileName);
      const resourcePath = normalizeZipEntryPath(`${packageKey}/${nestedPath}`);
      const normalizedLookupPath = resourcePath.toLowerCase();
      if (!nestedPath || !resourcePath || seenPaths.has(normalizedLookupPath)) {
        diagnostics.push(
          createImportDiagnostic(
            "source_document_resource_path_invalid",
            `Resource package '${packageEntry.fileName}' contains an unsafe or duplicate entry '${nestedEntry.fileName}'.`
          )
        );
        continue;
      }

      const data = readZipEntryBuffer(
        packageBuffer,
        nestedEntry,
        MAX_EXTRACTED_RESOURCE_BYTES
      );
      if (
        !data ||
        extractedBytes + data.length > MAX_EXTRACTED_RESOURCE_TOTAL_BYTES
      ) {
        diagnostics.push(
          createImportDiagnostic(
            "source_document_resource_entry_oversized",
            `Resource package entry '${resourcePath}' exceeds the bounded extraction limit.`
          )
        );
        continue;
      }

      extractedBytes += data.length;
      seenPaths.add(normalizedLookupPath);
      resourceEntries.push({
        resourcePath,
        mediaType: resourceMediaTypeForPath(resourcePath),
        dataBase64: data.toString("base64")
      });
    }
  }

  return { resourceEntries, diagnostics };
};

const deriveRuntimeSnapshotFromSourceDocument = (
  sourcePackage: SourcePackage
): {
  runtimeSnapshot: ContentReleaseRuntimeSnapshot | null;
  diagnostics: ImportJobDiagnostic[];
} => {
  if (!sourcePackage.sourceDocument) {
    return {
      runtimeSnapshot: null,
      diagnostics: []
    };
  }

  const normalizedMediaType = sourcePackage.mediaType.toLowerCase();
  const normalizedFileName = sourcePackage.fileName.toLowerCase();
  const sourceDocumentText = sourcePackage.sourceDocument.trimStart();
  const looksLikeJsonDocument =
    sourceDocumentText.startsWith("{") || sourceDocumentText.startsWith("[");
  const looksLikeXmlDocument = sourceDocumentText.startsWith("<");
  const looksLikeZipPackage =
    normalizedMediaType.includes("zip") || normalizedFileName.endsWith(".zip");

  if (
    normalizedMediaType.includes("json") ||
    normalizedFileName.endsWith(".json") ||
    looksLikeJsonDocument
  ) {
    try {
      return {
        runtimeSnapshot: normalizeParsedJsonContentStructure(
          JSON.parse(sourcePackage.sourceDocument)
        ),
        diagnostics: []
      };
    } catch {
      return {
        runtimeSnapshot: null,
        diagnostics: [
          createImportDiagnostic(
            "source_document_json_invalid",
            `Source package '${sourcePackage.fileName}' contained invalid JSON in sourceDocument.`
          )
        ]
      };
    }
  }

  if (
    normalizedMediaType.includes("xml") ||
    normalizedFileName.endsWith(".xml") ||
    normalizedFileName.endsWith(".imsmanifest") ||
    normalizedFileName.endsWith(".manifest") ||
    looksLikeXmlDocument
  ) {
    const diagnostics = validateTestcenterXmlSourceDocument(
      sourcePackage.sourceDocument,
      sourcePackage.fileName
    );
    if (diagnostics.some(diagnostic => diagnostic.severity === "error")) {
      return { runtimeSnapshot: null, diagnostics };
    }
    return {
      runtimeSnapshot: normalizeParsedXmlContentStructure(sourcePackage.sourceDocument),
      diagnostics
    };
  }

  if (looksLikeZipPackage) {
    const manifestExtraction = extractXmlManifestFromZipSourceDocument(
      sourcePackage.sourceDocument
    );
    if (manifestExtraction.status === "found") {
      const resourceExtraction = extractNestedResourcePackages(manifestExtraction);
      const diagnostics = [
        ...validateZipXmlEntries(manifestExtraction),
        ...resourceExtraction.diagnostics
      ];
      if (diagnostics.some(diagnostic => diagnostic.severity === "error")) {
        return { runtimeSnapshot: null, diagnostics };
      }
      const runtimeSnapshot = normalizeParsedZipXmlContentStructure(
        manifestExtraction
      );
      return {
        runtimeSnapshot:
          runtimeSnapshot && resourceExtraction.resourceEntries.length > 0
            ? {
                ...runtimeSnapshot,
                resourceEntries: resourceExtraction.resourceEntries
              }
            : runtimeSnapshot,
        diagnostics
      };
    }

    return {
      runtimeSnapshot: null,
      diagnostics: [
        manifestExtraction.status === "invalid_zip"
          ? createImportDiagnostic(
              "source_document_zip_invalid",
              `Source package '${sourcePackage.fileName}' did not contain a readable ZIP sourceDocument.`
            )
          : manifestExtraction.status === "manifest_unreadable"
            ? createImportDiagnostic(
                "source_document_zip_manifest_unreadable",
                `Source package '${sourcePackage.fileName}' contained an XML manifest candidate that could not be read from its ZIP sourceDocument.`
              )
          : createImportDiagnostic(
              "source_document_zip_manifest_missing",
              `Source package '${sourcePackage.fileName}' did not contain a readable XML manifest in its ZIP sourceDocument.`
            )
      ]
    };
  }

  return {
    runtimeSnapshot: null,
    diagnostics: [
      createImportDiagnostic(
        "source_document_media_type_unsupported",
        `Source package '${sourcePackage.fileName}' provided sourceDocument for unsupported mediaType '${sourcePackage.mediaType}'.`
      )
    ]
  };
};

const buildRuntimeSnapshot = (
  sourcePackage: SourcePackage
): {
  runtimeSnapshot: ContentReleaseRuntimeSnapshot | null;
  diagnostics: ImportJobDiagnostic[];
} => {
  if (hasStructuredContent(sourcePackage.contentStructure)) {
    const normalized = normalizeContentStructure(sourcePackage.contentStructure);
    if (normalized) {
      return {
        runtimeSnapshot: normalized,
        diagnostics: []
      };
    }

    return {
      runtimeSnapshot: null,
      diagnostics: [
        createImportDiagnostic(
          "source_package_content_structure_invalid",
          `Source package '${sourcePackage.fileName}' provided contentStructure, but it did not contain at least one valid booklet with units.`
        )
      ]
    };
  }

  if (sourcePackage.sourceDocument) {
    const derivedFromSourceDocument = deriveRuntimeSnapshotFromSourceDocument(
      sourcePackage
    );
    if (derivedFromSourceDocument.runtimeSnapshot) {
      return {
        runtimeSnapshot: derivedFromSourceDocument.runtimeSnapshot,
        diagnostics: derivedFromSourceDocument.diagnostics
      };
    }

    return {
      runtimeSnapshot: null,
      diagnostics:
        derivedFromSourceDocument.diagnostics.length > 0
          ? derivedFromSourceDocument.diagnostics
          : [
              createImportDiagnostic(
                "source_document_runtime_structure_invalid",
                `Source package '${sourcePackage.fileName}' contained a sourceDocument, but no valid booklet/unit runtime structure could be derived from it.`
              )
            ]
    };
  }

  const baseLabel = sourcePackage.fileName.replace(/\.[^.]+$/, "");

  return {
    runtimeSnapshot: {
      bookletEntries: [
        {
          bookletKey: `booklet:${baseLabel}`,
          displayLabel: `${baseLabel} Booklet`,
          unitEntries: [
            {
              unitKey: "unit-1",
              displayLabel: "Introduction Unit",
              content: "Read the introduction and confirm that you are ready to begin."
            },
            {
              unitKey: "unit-2",
              displayLabel: "Practice Unit",
              content: "Use this practice unit to check that responses can be saved."
            },
            {
              unitKey: "unit-3",
              displayLabel: "Assessment Unit",
              content: "Enter the response for the assessment unit."
            },
            {
              unitKey: "unit-4",
              displayLabel: "Wrap-Up Unit",
              content: "Review your work and complete the test when you are finished."
            }
          ]
        }
      ]
    },
    diagnostics: []
  };
};

const resolveRuntimeBooklet = (
  contentRelease: ContentRelease,
  bookletKey: string
): ParticipantCurrentRunState["booklet"] => {
  const bookletEntry =
    contentRelease.runtimeSnapshot.bookletEntries.find(
      candidate => candidate.bookletKey === bookletKey
    ) ??
    contentRelease.runtimeSnapshot.bookletEntries[0] ??
    null;

  if (!bookletEntry) {
    return {
      bookletKey,
      displayLabel: toDisplayLabel("Booklet", bookletKey) ?? bookletKey,
      policy: compileBookletRuntimePolicy({}),
      testlets: []
    };
  }

  const policyDefaults = compileBookletRuntimePolicy(
    bookletEntry.policy?.sourceConfig ?? {}
  );

  return {
    bookletKey: bookletEntry.bookletKey,
    displayLabel: bookletEntry.displayLabel,
    policy: bookletEntry.policy
      ? {
          ...bookletEntry.policy,
          navigation: {
            ...bookletEntry.policy.navigation,
            unitLabel:
              bookletEntry.policy.navigation.unitLabel ??
              policyDefaults.navigation.unitLabel,
            unitListEnabled:
              bookletEntry.policy.navigation.unitListEnabled ??
              policyDefaults.navigation.unitListEnabled
          },
          player: {
            ...bookletEntry.policy.player,
            loadingMode:
              bookletEntry.policy.player.loadingMode ??
              policyDefaults.player.loadingMode
          },
          persistence:
            bookletEntry.policy.persistence ?? policyDefaults.persistence
        }
      : policyDefaults,
    testlets: (bookletEntry.testletEntries ?? []).map(testletEntry => ({
      testletKey: testletEntry.testletKey,
      displayLabel: testletEntry.displayLabel,
      parentTestletKey: testletEntry.parentTestletKey ?? null,
      requiresCode: Boolean(testletEntry.restrictions?.codeToEnter?.code),
      codePrompt: testletEntry.restrictions?.codeToEnter?.prompt ?? null,
      timeMax: testletEntry.restrictions?.timeMax ?? null,
      lockAfterLeaving:
        testletEntry.restrictions?.lockAfterLeaving ?? null
    }))
  };
};

type AdaptiveResponseVariable = {
  id: string;
  status: string;
  value: unknown;
  code?: number;
  score?: number;
};

const adaptiveStatusOrder = [
  "UNSET",
  "NOT_REACHED",
  "DISPLAYED",
  "VALUE_CHANGED",
  "SOURCE_MISSING",
  "DERIVE_ERROR",
  "VALUE_DERIVED",
  "NO_CODING",
  "INVALID",
  "CODING_INCOMPLETE",
  "CODING_ERROR",
  "CODING_COMPLETE"
];

const adaptiveValueAsNumber = (value: unknown): number => {
  const truncate = (numberValue: number): number =>
    Math.floor(numberValue * 1_000_000) / 1_000_000;
  if (value === undefined || value === null) {
    return 0;
  }
  if (typeof value === "boolean") {
    return value ? 1 : 0;
  }
  if (Array.isArray(value)) {
    return value.length;
  }
  return truncate(Number(value));
};

const adaptiveValueAsComparable = (value: unknown): string | number => {
  if (value === null) {
    return "null";
  }
  if (Array.isArray(value)) {
    return JSON.stringify([...value].sort());
  }
  if (typeof value === "boolean") {
    return value ? "true" : "false";
  }
  return typeof value === "number" || typeof value === "string" ? value : "";
};

const collectAdaptiveVariableKeys = (
  booklet: ContentReleaseBookletEntry
): Map<string, Set<string>> => {
  const variableKeysByUnitKey = new Map<string, Set<string>>();
  const registerVariable = (source: BookletStateVariableSource): void => {
    const variableKeys = variableKeysByUnitKey.get(source.unitKey) ?? new Set();
    variableKeys.add(source.variableKey);
    variableKeysByUnitKey.set(source.unitKey, variableKeys);
  };
  const registerCondition = (condition: BookletStateCondition): void => {
    const source = condition.source;
    if (
      source.type === "Code" ||
      source.type === "Value" ||
      source.type === "Status" ||
      source.type === "Score"
    ) {
      registerVariable(source);
    } else if (source.type === "Count") {
      source.conditions.forEach(registerCondition);
    } else if ("sources" in source) {
      source.sources.forEach(registerVariable);
    }
  };
  booklet.stateEntries?.forEach(state =>
    state.options.forEach(option => option.conditions.forEach(registerCondition))
  );
  return variableKeysByUnitKey;
};

const resolveAdaptiveVariables = (
  booklet: ContentReleaseBookletEntry,
  testRun: TestRun
): Map<string, Map<string, AdaptiveResponseVariable>> => {
  const trackedVariablesByUnitKey = collectAdaptiveVariableKeys(booklet);
  const variablesByUnitKey = new Map(
    [...trackedVariablesByUnitKey].map(([unitKey, variableKeys]) => [
      unitKey,
      new Map(
        [...variableKeys].map(variableKey => [
          variableKey,
          {
            id: variableKey,
            status: "UNSET",
            value: null
          } satisfies AdaptiveResponseVariable
        ])
      )
    ])
  );
  const suppliedResponsesByUnitKey = new Map<string, IqbResponse[]>();
  for (const [unitKey, response] of Object.entries(testRun.unitResponses)) {
    const parsedResponse = parseVeronaUnitResponse(response);
    if (
      !parsedResponse?.unitState.unitStateDataType?.match(
        /^iqb-standard@\d+(?:\.\d+)*$/i
      )
    ) {
      continue;
    }
    const variables = variablesByUnitKey.get(unitKey) ?? new Map();
    const suppliedResponses = suppliedResponsesByUnitKey.get(unitKey) ?? [];
    for (const dataPart of Object.values(
      parsedResponse.unitState.dataParts ?? {}
    )) {
      try {
        const values = JSON.parse(dataPart);
        if (!Array.isArray(values)) {
          continue;
        }
        for (const value of values) {
          if (
            typeof value !== "object" ||
            value === null ||
            typeof value.id !== "string" ||
            typeof value.status !== "string" ||
            !("value" in value)
          ) {
            continue;
          }
          // Original Testcenter tracks adaptive responses by variable ID, not by
          // subform. Preserve its data-part order: a later repeated ID replaces
          // the earlier subform value before server-side coding and routing.
          const suppliedResponse = {
            id: value.id,
            status: value.status as IqbResponse["status"],
            value: value.value as IqbResponse["value"],
            ...(typeof value.subform === "string"
              ? { subform: value.subform }
              : {}),
            ...(typeof value.code === "number" ? { code: value.code } : {}),
            ...(typeof value.score === "number" ? { score: value.score } : {})
          } satisfies IqbResponse;
          suppliedResponses.push(suppliedResponse);
          variables.set(value.id, {
            id: suppliedResponse.id,
            status: suppliedResponse.status,
            value: suppliedResponse.value,
            ...(suppliedResponse.code === undefined
              ? {}
              : { code: suppliedResponse.code }),
            ...(suppliedResponse.score === undefined
              ? {}
              : { score: suppliedResponse.score })
          });
        }
      } catch {
        // Invalid data parts remain persisted for player restoration, but cannot
        // participate in server-side adaptive decisions.
      }
    }
    variablesByUnitKey.set(unitKey, variables);
    suppliedResponsesByUnitKey.set(unitKey, suppliedResponses);
  }

  for (const unitEntry of booklet.unitEntries) {
    const trackedVariableKeys = trackedVariablesByUnitKey.get(unitEntry.unitKey);
    if (!unitEntry.codingScheme || !trackedVariableKeys?.size) {
      continue;
    }
    const variables = variablesByUnitKey.get(unitEntry.unitKey) ?? new Map();
    try {
      const codingScheme = new CodingScheme(unitEntry.codingScheme);
      const baseVariableKeys = codingScheme.getBaseVarsList([
        ...trackedVariableKeys
      ]);
      const baseVariableKeySet = new Set(baseVariableKeys);
      const suppliedResponses =
        suppliedResponsesByUnitKey.get(unitEntry.unitKey) ?? [];
      const suppliedBaseResponses = suppliedResponses.filter(response =>
        baseVariableKeySet.has(response.id)
      );
      const suppliedBaseVariableKeys = new Set(
        suppliedBaseResponses.map(response => response.id)
      );
      // Keep every ordered subform response for the IQB coding engine. The
      // adaptive read model remains ID-only and is populated from the coded
      // output below in its original last-write-wins order.
      const baseResponses = [
        ...suppliedBaseResponses,
        ...baseVariableKeys
          .filter(variableKey => !suppliedBaseVariableKeys.has(variableKey))
          .map(
            variableKey =>
              ({
                id: variableKey,
                status: "UNSET",
                value: null
              }) satisfies IqbResponse
          )
      ];
      const injectableVariableKeys = new Set(
        codingScheme.variableCodings
          .filter(
            variableCoding =>
              variableCoding.sourceType !== "BASE" &&
              variableCoding.sourceType !== "BASE_NO_VALUE"
          )
          .flatMap(variableCoding => [
            variableCoding.id,
            variableCoding.alias || variableCoding.id
          ])
      );
      // IQB-standard Player state may already contain a manually coded or
      // externally injected derived response. Keep only values that were
      // actually supplied by the Player and belong to this coding scheme;
      // launch-time UNSET placeholders must not suppress normal derivation.
      const injectedResponses = suppliedResponses.filter(
        response =>
          !baseVariableKeySet.has(response.id) &&
          injectableVariableKeys.has(response.id)
      );
      for (const codedVariable of codingScheme.code([
        ...baseResponses,
        ...injectedResponses
      ])) {
        if (!trackedVariableKeys.has(codedVariable.id)) {
          continue;
        }
        variables.set(codedVariable.id, {
          id: codedVariable.id,
          status: codedVariable.status,
          value: codedVariable.value,
          ...(codedVariable.code === undefined
            ? {}
            : { code: codedVariable.code }),
          ...(codedVariable.score === undefined
            ? {}
            : { score: codedVariable.score })
        });
      }
      variablesByUnitKey.set(unitEntry.unitKey, variables);
    } catch {
      // Keep the player's raw variables available when a staged legacy scheme
      // cannot code an individual response payload.
    }
  }
  return variablesByUnitKey;
};

const evaluateAdaptiveStates = (
  booklet: ContentReleaseBookletEntry | undefined,
  testRun: TestRun
): ParticipantCurrentRunState["adaptiveStates"] => {
  if (!booklet?.stateEntries?.length) {
    return [];
  }
  const variablesByUnitKey = resolveAdaptiveVariables(booklet, testRun);
  const readVariable = (
    source: BookletStateVariableSource
  ): AdaptiveResponseVariable | undefined =>
    variablesByUnitKey.get(source.unitKey)?.get(source.variableKey);
  const sourceAsNumber = (source: BookletStateVariableSource): number => {
    const variable = readVariable(source);
    if (!variable) {
      return Number.NaN;
    }
    switch (source.type) {
      case "Code":
        return variable.code ?? adaptiveValueAsNumber(source.defaultValue);
      case "Value":
        return adaptiveValueAsNumber(variable.value);
      case "Status":
        return Math.max(adaptiveStatusOrder.indexOf(variable.status), 0);
      case "Score":
        return variable.score ?? adaptiveValueAsNumber(source.defaultValue);
    }
  };
  const conditionSatisfied = (condition: BookletStateCondition): boolean => {
    const source = condition.source;
    let value: string | number;
    if (
      source.type === "Code" ||
      source.type === "Value" ||
      source.type === "Status" ||
      source.type === "Score"
    ) {
      const variable = readVariable(source);
      if (!variable) {
        return false;
      }
      if (condition.expression.type === "greaterThan" ||
          condition.expression.type === "lowerThan") {
        value = sourceAsNumber(source);
      } else if (source.type === "Code") {
        value = variable.code ?? adaptiveValueAsNumber(source.defaultValue);
      } else if (source.type === "Value") {
        value = adaptiveValueAsComparable(variable.value);
      } else if (source.type === "Status") {
        value = variable.status || source.defaultValue || "UNSET";
      } else {
        value = variable.score ?? adaptiveValueAsNumber(source.defaultValue);
      }
    } else if (source.type === "Count") {
      value = source.conditions.filter(conditionSatisfied).length;
    } else {
      const aggregation = source as Extract<
        BookletStateCondition["source"],
        { type: "Sum" | "Median" | "Mean" }
      >;
      const values = aggregation.sources.map(sourceAsNumber);
      if (aggregation.type === "Sum") {
        value = values.reduce((sum: number, item: number) => sum + item, 0);
      } else if (aggregation.type === "Mean") {
        value = values.length > 0
          ? values.reduce((sum: number, item: number) => sum + item, 0) / values.length
          : Number.NaN;
      } else {
        const sorted = [...values].sort((left, right) => left - right);
        const middle = Math.floor(sorted.length / 2);
        value = sorted.length === 0
          ? Number.NaN
          : sorted.length % 2 === 0
            ? ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2
            : sorted[middle] ?? Number.NaN;
      }
    }
    let expected: string | number = condition.expression.value;
    if (typeof value === "number") {
      value = adaptiveValueAsNumber(value);
      expected = adaptiveValueAsNumber(expected);
    }
    switch (condition.expression.type) {
      case "equal":
        return value === expected ||
          (Number.isNaN(value) && Number.isNaN(expected));
      case "notEqual":
        return value !== expected;
      case "greaterThan":
        return adaptiveValueAsNumber(value) > adaptiveValueAsNumber(expected);
      case "lowerThan":
        return adaptiveValueAsNumber(value) < adaptiveValueAsNumber(expected);
    }
  };

  return booklet.stateEntries.map(state => {
    const selected = state.options.find(option =>
      option.conditions.every(conditionSatisfied)
    ) ?? state.options.at(-1)!;
    const presetOptionKey = testRun.presetBookletStates?.[state.stateKey];
    const presetOption = presetOptionKey
      ? state.options.find(option => option.optionKey === presetOptionKey)
      : undefined;
    const overrideOptionKey = testRun.bookletStateOverrides?.[state.stateKey];
    const overrideOption = overrideOptionKey
      ? state.options.find(option => option.optionKey === overrideOptionKey)
      : undefined;
    const effectiveOption = overrideOption ?? presetOption ?? selected;
    return {
      stateKey: state.stateKey,
      displayLabel: state.displayLabel,
      optionKey: effectiveOption.optionKey,
      optionLabel: effectiveOption.displayLabel,
      automaticOptionKey: selected.optionKey,
      automaticOptionLabel: selected.displayLabel,
      overrideOptionKey: overrideOption?.optionKey ?? null,
      options: state.options.map(option => ({
        optionKey: option.optionKey,
        displayLabel: option.displayLabel
      }))
    };
  });
};

const resolveAdaptiveStates = (
  booklet: ContentReleaseBookletEntry | undefined,
  testRun: TestRun
): ParticipantCurrentRunState["adaptiveStates"] => {
  const evaluatedStates = evaluateAdaptiveStates(booklet, testRun);
  if (!testRun.bookletStates) {
    return evaluatedStates;
  }
  return evaluatedStates.map(evaluatedState => {
    const persistedOptionKey = testRun.bookletStates?.[evaluatedState.stateKey];
    const persistedOption = booklet?.stateEntries
      ?.find(state => state.stateKey === evaluatedState.stateKey)
      ?.options.find(option => option.optionKey === persistedOptionKey);
    return persistedOption
      ? {
          ...evaluatedState,
          optionKey: persistedOption.optionKey,
          optionLabel: persistedOption.displayLabel
        }
      : evaluatedState;
  });
};

const evaluateTestRunBookletStates = (
  booklet: ContentReleaseBookletEntry | undefined,
  testRun: TestRun
): Record<string, string> =>
  Object.fromEntries(
    evaluateAdaptiveStates(booklet, testRun).map(state => [
      state.stateKey,
      state.optionKey
    ])
  );

const withEvaluatedBookletStates = (
  booklet: ContentReleaseBookletEntry | undefined,
  testRun: TestRun
): TestRun => ({
  ...testRun,
  bookletStates: evaluateTestRunBookletStates(booklet, testRun)
});

const buildBookletStatesTestStateEntry = (
  testRun: TestRun,
  timestamp: string
): ParticipantTestLogEntryInput => ({
  key: "BOOKLET_STATES",
  timeStamp: Date.parse(timestamp),
  content: JSON.stringify(testRun.bookletStates ?? {})
});

const hasCompleteBookletStatesSnapshot = (
  booklet: ContentReleaseBookletEntry | undefined,
  testRun: TestRun
): boolean =>
  !booklet?.stateEntries?.length ||
  booklet.stateEntries.every(state =>
    state.options.some(
      option => option.optionKey === testRun.bookletStates?.[state.stateKey]
    )
  );

const resolveVisibleBookletUnits = (
  booklet: ContentReleaseBookletEntry | undefined,
  testRun: TestRun
): ContentReleaseBookletEntry["unitEntries"] => {
  if (!booklet) {
    return [];
  }
  const states = new Map(
    resolveAdaptiveStates(booklet, testRun).map(state => [
      state.stateKey,
      state.optionKey
    ])
  );
  const testletsByKey = new Map(
    (booklet.testletEntries ?? []).map(testlet => [testlet.testletKey, testlet])
  );
  return booklet.unitEntries.filter(unit =>
    (unit.testletPath ?? []).every(testletKey => {
      const show = testletsByKey.get(testletKey)?.restrictions?.show;
      return !show || states.get(show.stateKey) === show.optionKey;
    })
  );
};

const isUnitLeaveLocked = (
  booklet: ContentReleaseBookletEntry | undefined,
  testRun: TestRun,
  unitKey: string | null
): boolean => {
  if (!booklet || !unitKey || testRun.monitorNavigationUnlocked) {
    return false;
  }
  if ((testRun.lockedUnitKeys ?? []).includes(unitKey)) {
    return true;
  }
  const unit = booklet.unitEntries.find(candidate => candidate.unitKey === unitKey);
  const lockedTestlets = new Set(testRun.lockedTestletKeys ?? []);
  return (unit?.testletPath ?? []).some(testletKey =>
    lockedTestlets.has(testletKey)
  );
};

const resolveCurrentLeaveLock = (
  booklet: ContentReleaseBookletEntry | undefined,
  testRun: TestRun,
  targetUnitKey: string | null
): {
  testlet: SourcePackageTestletEntry;
  unit: NonNullable<ContentReleaseBookletEntry["unitEntries"][number]>;
  scope: "unit" | "testlet";
  confirm: boolean;
} | null => {
  if (!booklet || !testRun.currentUnitKey || testRun.monitorNavigationUnlocked) {
    return null;
  }
  const currentUnit = booklet.unitEntries.find(
    candidate => candidate.unitKey === testRun.currentUnitKey
  );
  const parentTestletKey = currentUnit?.testletPath?.at(-1);
  const testlet = booklet.testletEntries?.find(
    candidate => candidate.testletKey === parentTestletKey
  );
  const restriction = testlet?.restrictions?.lockAfterLeaving;
  if (!currentUnit || !testlet || !restriction) {
    return null;
  }
  if (!targetUnitKey) {
    return {
      testlet,
      unit: currentUnit,
      scope: restriction.scope,
      confirm: restriction.confirm
    };
  }
  if (targetUnitKey === currentUnit.unitKey) {
    return null;
  }
  if (restriction.scope === "testlet") {
    const targetUnit = booklet.unitEntries.find(
      candidate => candidate.unitKey === targetUnitKey
    );
    if (targetUnit?.testletPath?.at(-1) === testlet.testletKey) {
      return null;
    }
  }
  return {
    testlet,
    unit: currentUnit,
    scope: restriction.scope,
    confirm: restriction.confirm
  };
};

const activateCurrentLeaveLock = (
  testRun: TestRun,
  leaveLock: NonNullable<ReturnType<typeof resolveCurrentLeaveLock>>
): TestRun =>
  normalizeTestRun({
    ...testRun,
    ...(leaveLock.scope === "testlet"
      ? {
          lockedTestletKeys: [
            ...(testRun.lockedTestletKeys ?? []),
            leaveLock.testlet.testletKey
          ]
        }
      : {
          lockedUnitKeys: [
            ...(testRun.lockedUnitKeys ?? []),
            leaveLock.unit.unitKey
          ]
        })
  });

const buildLeaveLockTestStateEntry = (input: {
  booklet: ContentReleaseBookletEntry | undefined;
  testRun: TestRun;
  leaveLock: NonNullable<ReturnType<typeof resolveCurrentLeaveLock>>;
  timestamp: number;
}): ParticipantTestLogEntryInput => ({
  key:
    input.leaveLock.scope === "testlet"
      ? "TESTLETS_LOCKED_AFTER_LEAVE"
      : "UNITS_LOCKED_AFTER_LEAVE",
  timeStamp: input.timestamp,
  content: JSON.stringify(
    input.leaveLock.scope === "testlet"
      ? input.testRun.lockedTestletKeys ?? []
      : (input.testRun.lockedUnitKeys ?? [])
          .map(unitKey =>
            (input.booklet?.unitEntries.findIndex(
              candidate => candidate.unitKey === unitKey
            ) ?? -1) + 1
          )
          .filter(sequenceId => sequenceId > 0)
  )
});

const resolveActiveLeaveLock = (
  contentRelease: ContentRelease,
  testRun: TestRun
): ParticipantCurrentRunState["activeLeaveLock"] => {
  const booklet = contentRelease.runtimeSnapshot.bookletEntries.find(
    candidate => candidate.bookletKey === testRun.bookletKey
  );
  const leaveLock = resolveCurrentLeaveLock(booklet, testRun, null);
  return leaveLock
    ? {
        testletKey: leaveLock.testlet.testletKey,
        displayLabel: leaveLock.testlet.displayLabel,
        unitKey: leaveLock.unit.unitKey,
        unitDisplayLabel: leaveLock.unit.displayLabel,
        scope: leaveLock.scope,
        confirm: leaveLock.confirm
      }
    : null;
};

const findTestletCodeGate = (input: {
  booklet: ContentReleaseBookletEntry | undefined;
  testRun: TestRun;
  firstUnitIndex: number;
  lastUnitIndex: number;
}): NonNullable<ParticipantCurrentRunState["navigation"]["nextTestletGate"]> | null => {
  if (
    !input.booklet ||
    input.testRun.monitorNavigationUnlocked ||
    input.lastUnitIndex < input.firstUnitIndex
  ) {
    return null;
  }
  const unlocked = new Set(input.testRun.unlockedTestletKeys ?? []);
  const visibleUnitKeys = new Set(
    resolveVisibleBookletUnits(input.booklet, input.testRun).map(
      unit => unit.unitKey
    )
  );
  for (
    let unitIndex = Math.max(0, input.firstUnitIndex);
    unitIndex <= Math.min(input.lastUnitIndex, input.booklet.unitEntries.length - 1);
    unitIndex += 1
  ) {
    const unit = input.booklet.unitEntries[unitIndex];
    if (!unit || !visibleUnitKeys.has(unit.unitKey)) {
      continue;
    }
    if (isUnitLeaveLocked(input.booklet, input.testRun, unit?.unitKey ?? null)) {
      continue;
    }
    for (const testletKey of unit?.testletPath ?? []) {
      const testlet = input.booklet.testletEntries?.find(
        candidate => candidate.testletKey === testletKey
      );
      if (
        testlet?.restrictions?.codeToEnter?.code &&
        !unlocked.has(testlet.testletKey)
      ) {
        return {
          testletKey: testlet.testletKey,
          displayLabel: testlet.displayLabel,
          prompt: testlet.restrictions.codeToEnter.prompt
        };
      }
    }
  }
  return null;
};

const originalBookletRootTestletKey = "[0]";

const resolveBookletRootTestlet = (
  booklet: ContentReleaseBookletEntry | undefined
): SourcePackageTestletEntry | null =>
  booklet?.rootRestrictions
    ? {
        testletKey: originalBookletRootTestletKey,
        displayLabel: booklet.displayLabel,
        parentTestletKey: null,
        restrictions: booklet.rootRestrictions
      }
    : null;

const resolveBookletTestletEntry = (
  booklet: ContentReleaseBookletEntry | undefined,
  testletKey: string
): SourcePackageTestletEntry | null =>
  (testletKey === originalBookletRootTestletKey
    ? resolveBookletRootTestlet(booklet)
    : booklet?.testletEntries?.find(
        candidate => candidate.testletKey === testletKey
      )) ?? null;

const unitBelongsToTestlet = (
  booklet: ContentReleaseBookletEntry,
  unit: ContentReleaseBookletEntry["unitEntries"][number] | undefined,
  testletKey: string
): boolean =>
  testletKey === originalBookletRootTestletKey
    ? Boolean(booklet.rootRestrictions?.timeMax)
    : Boolean(unit?.testletPath?.includes(testletKey));

const resolveTimedTestletForUnit = (
  booklet: ContentReleaseBookletEntry | undefined,
  unitKey: string | null
): SourcePackageTestletEntry | null => {
  if (!booklet || !unitKey) {
    return null;
  }
  const rootTestlet = resolveBookletRootTestlet(booklet);
  if (rootTestlet?.restrictions?.timeMax?.minutes) {
    return rootTestlet;
  }
  const unit = booklet.unitEntries.find(candidate => candidate.unitKey === unitKey);
  for (const testletKey of unit?.testletPath ?? []) {
    const testlet = booklet.testletEntries?.find(
      candidate => candidate.testletKey === testletKey
    );
    if (testlet?.restrictions?.timeMax?.minutes) {
      return testlet;
    }
  }
  return null;
};

const getTestletTimerRemainingSeconds = (
  timer: NonNullable<TestRun["testletTimers"]>[string],
  timestamp: string
): number => {
  if (timer.status !== "running" || !timer.expiresAt) {
    return Math.max(0, Math.ceil(timer.remainingSeconds));
  }
  const expiresAtMs = Date.parse(timer.expiresAt);
  const timestampMs = Date.parse(timestamp);
  if (!Number.isFinite(expiresAtMs) || !Number.isFinite(timestampMs)) {
    return Math.max(0, Math.ceil(timer.remainingSeconds));
  }
  return Math.max(0, Math.ceil((expiresAtMs - timestampMs) / 1_000));
};

const buildTestletTimeLeftTestStateEntry = (
  testRun: TestRun,
  timestamp: string
): ParticipantTestLogEntryInput => ({
  key: "TESTLETS_TIMELEFT",
  timeStamp: Date.parse(timestamp),
  content: JSON.stringify(
    Object.fromEntries(
      Object.entries(testRun.testletTimers ?? {}).map(([testletKey, timer]) => [
        testletKey,
        getTestletTimerRemainingSeconds(timer, timestamp) / 60
      ])
    )
  )
});

const testletTimerStateChanged = (
  previousRun: TestRun,
  nextRun: TestRun
): boolean =>
  JSON.stringify(previousRun.testletTimers ?? {}) !==
  JSON.stringify(nextRun.testletTimers ?? {});

const activateCurrentTestletTimer = (
  contentRelease: ContentRelease,
  testRun: TestRun,
  timestamp: string
): { testRun: TestRun; startedTestletKey: string | null } => {
  if (testRun.status !== "running" || !testRun.currentUnitKey) {
    return { testRun, startedTestletKey: null };
  }
  const booklet = contentRelease.runtimeSnapshot.bookletEntries.find(
    candidate => candidate.bookletKey === testRun.bookletKey
  );
  const timedTestlet = resolveTimedTestletForUnit(
    booklet,
    testRun.currentUnitKey
  );
  const timeMax = timedTestlet?.restrictions?.timeMax;
  if (!timedTestlet || !timeMax) {
    return { testRun, startedTestletKey: null };
  }
  const existingTimer = testRun.testletTimers?.[timedTestlet.testletKey];
  if (existingTimer?.status === "running") {
    return { testRun, startedTestletKey: null };
  }
  if (existingTimer?.status === "expired" || existingTimer?.status === "cancelled") {
    return { testRun, startedTestletKey: null };
  }
  const timestampMs = Date.parse(timestamp);
  const durationSeconds = existingTimer
    ? Math.max(1, existingTimer.durationSeconds)
    : Math.max(1, Math.ceil(timeMax.minutes * 60));
  const remainingSeconds = existingTimer
    ? Math.max(1, existingTimer.remainingSeconds)
    : durationSeconds;
  const expiresAt = Number.isFinite(timestampMs)
    ? new Date(timestampMs + remainingSeconds * 1_000).toISOString()
    : timestamp;
  return {
    testRun: normalizeTestRun({
      ...testRun,
      testletTimers: {
        ...(testRun.testletTimers ?? {}),
        [timedTestlet.testletKey]: {
          testletKey: timedTestlet.testletKey,
          status: "running",
          durationSeconds,
          remainingSeconds,
          startedAt: existingTimer?.startedAt ?? timestamp,
          expiresAt,
          updatedAt: timestamp,
          endedAt: null
        }
      },
      updatedAt: timestamp
    }),
    startedTestletKey: existingTimer ? null : timedTestlet.testletKey
  };
};

const transitionTestletTimersForRunStatus = (
  testRun: TestRun,
  nextStatus: Extract<TestRun["status"], "running" | "paused">,
  timestamp: string
): TestRun => {
  if (testRun.status === nextStatus) {
    return testRun;
  }
  const timestampMs = Date.parse(timestamp);
  const testletTimers = Object.fromEntries(
    Object.entries(testRun.testletTimers ?? {}).map(([testletKey, timer]) => {
      if (nextStatus === "paused" && timer.status === "running") {
        const remainingSeconds = getTestletTimerRemainingSeconds(timer, timestamp);
        return [
          testletKey,
          {
            ...timer,
            status: "paused",
            remainingSeconds,
            expiresAt: null,
            updatedAt: timestamp
          }
        ];
      }
      if (
        nextStatus === "running" &&
        timer.status === "paused" &&
        remainingSecondsForTimer(timer) > 0
      ) {
        const remainingSeconds = remainingSecondsForTimer(timer);
        return [
          testletKey,
          {
            ...timer,
            status: "running",
            remainingSeconds,
            expiresAt: Number.isFinite(timestampMs)
              ? new Date(timestampMs + remainingSeconds * 1_000).toISOString()
              : timestamp,
            updatedAt: timestamp
          }
        ];
      }
      return [testletKey, timer];
    })
  );
  return normalizeTestRun({
    ...testRun,
    status: nextStatus,
    testletTimers,
    updatedAt: timestamp
  });
};

const closeRunningTestletTimers = (
  testRun: TestRun,
  timestamp: string
): TestRun => {
  const testletTimers = Object.fromEntries(
    Object.entries(testRun.testletTimers ?? {}).map(([testletKey, timer]) => [
      testletKey,
      timer.status === "running" || timer.status === "paused"
        ? {
            ...timer,
            status: "cancelled",
            remainingSeconds: 0,
            expiresAt: null,
            updatedAt: timestamp,
            endedAt: timestamp
          }
        : timer
    ])
  ) as NonNullable<TestRun["testletTimers"]>;
  return normalizeTestRun({ ...testRun, testletTimers });
};

const remainingSecondsForTimer = (
  timer: NonNullable<TestRun["testletTimers"]>[string]
): number => Math.max(0, Math.ceil(timer.remainingSeconds));

const reconcileExpiredTestletTimers = (
  contentRelease: ContentRelease,
  testRun: TestRun,
  timestamp: string
): { testRun: TestRun; expiredTestletKeys: string[] } => {
  if (testRun.status !== "running") {
    return { testRun, expiredTestletKeys: [] };
  }
  const booklet = contentRelease.runtimeSnapshot.bookletEntries.find(
    candidate => candidate.bookletKey === testRun.bookletKey
  );
  if (!booklet) {
    return { testRun, expiredTestletKeys: [] };
  }
  const expiredTestletKeys = Object.values(testRun.testletTimers ?? {})
    .filter(
      timer =>
        timer.status === "running" &&
        getTestletTimerRemainingSeconds(timer, timestamp) === 0
    )
    .map(timer => timer.testletKey);
  if (expiredTestletKeys.length === 0) {
    return { testRun, expiredTestletKeys };
  }
  const testletTimers = { ...(testRun.testletTimers ?? {}) };
  for (const testletKey of expiredTestletKeys) {
    const timer = testletTimers[testletKey];
    if (!timer) {
      continue;
    }
    testletTimers[testletKey] = {
      ...timer,
      status: "expired",
      remainingSeconds: 0,
      expiresAt: null,
      updatedAt: timestamp,
      endedAt: timestamp
    };
  }

  let currentUnitKey = testRun.currentUnitKey;
  let status: TestRun["status"] = testRun.status;
  let completedAt = testRun.completedAt;
  const activeExpiredTestletKey = expiredTestletKeys.find(testletKey =>
    unitBelongsToTestlet(
      booklet,
      booklet.unitEntries.find(unit => unit.unitKey === testRun.currentUnitKey),
      testletKey
    )
  );
  if (activeExpiredTestletKey) {
    const lastTimedUnitIndex = booklet.unitEntries.reduce(
      (lastIndex, unit, index) =>
        unitBelongsToTestlet(booklet, unit, activeExpiredTestletKey)
          ? index
          : lastIndex,
      -1
    );
    const visibleUnitKeys = new Set(
      resolveVisibleBookletUnits(booklet, testRun).map(unit => unit.unitKey)
    );
    const nextUnit = booklet.unitEntries
      .slice(lastTimedUnitIndex + 1)
      .find(unit => visibleUnitKeys.has(unit.unitKey)) ?? null;
    if (nextUnit) {
      const nextUnitIndex = booklet.unitEntries.findIndex(
        unit => unit.unitKey === nextUnit.unitKey
      );
      const nextGate = findTestletCodeGate({
        booklet,
        testRun: { ...testRun, testletTimers },
        firstUnitIndex: lastTimedUnitIndex + 1,
        lastUnitIndex: nextUnitIndex
      });
      currentUnitKey = nextGate
        ? booklet.unitEntries[lastTimedUnitIndex]?.unitKey ?? null
        : nextUnit.unitKey;
    } else {
      currentUnitKey = null;
      status = "completed";
      completedAt = timestamp;
    }
  }
  return {
    testRun: normalizeTestRun({
      ...testRun,
      status,
      currentUnitKey,
      testletTimers,
      updatedAt: timestamp,
      completedAt
    }),
    expiredTestletKeys
  };
};

const findClosedTimedTestlet = (
  booklet: ContentReleaseBookletEntry | undefined,
  testRun: TestRun,
  unitKey: string | null
): SourcePackageTestletEntry | null => {
  if (!booklet || !unitKey) {
    return null;
  }
  const unit = booklet.unitEntries.find(candidate => candidate.unitKey === unitKey);
  const rootTimer = testRun.testletTimers?.[originalBookletRootTestletKey];
  if (
    booklet.rootRestrictions?.timeMax &&
    (rootTimer?.status === "expired" || rootTimer?.status === "cancelled")
  ) {
    return resolveBookletRootTestlet(booklet);
  }
  for (const testletKey of unit?.testletPath ?? []) {
    const timer = testRun.testletTimers?.[testletKey];
    if (timer?.status === "expired" || timer?.status === "cancelled") {
      return (
        booklet.testletEntries?.find(
          candidate => candidate.testletKey === testletKey
        ) ?? null
      );
    }
  }
  return null;
};

const resolveLeavingTimedTestlet = (
  booklet: ContentReleaseBookletEntry | undefined,
  testRun: TestRun,
  targetUnitKey: string | null
): SourcePackageTestletEntry | null => {
  const timedTestlet = resolveTimedTestletForUnit(
    booklet,
    testRun.currentUnitKey
  );
  const timer = timedTestlet
    ? testRun.testletTimers?.[timedTestlet.testletKey]
    : null;
  if (
    !timedTestlet ||
    !timer ||
    (timer.status !== "running" && timer.status !== "paused")
  ) {
    return null;
  }
  if (!targetUnitKey) {
    return timedTestlet;
  }
  const targetUnit = booklet?.unitEntries.find(
    candidate => candidate.unitKey === targetUnitKey
  );
  return targetUnit &&
    booklet &&
    unitBelongsToTestlet(booklet, targetUnit, timedTestlet.testletKey)
    ? null
    : timedTestlet;
};

const isLeavingForbiddenTimedTestlet = (
  booklet: ContentReleaseBookletEntry | undefined,
  testRun: TestRun,
  targetUnitKey: string | null
): boolean =>
  resolveLeavingTimedTestlet(booklet, testRun, targetUnitKey)?.restrictions
    ?.timeMax?.leave === "forbidden";

const cancelTestletTimerAfterLeave = (
  testRun: TestRun,
  testletKey: string,
  timestamp: string
): TestRun => {
  const timer = testRun.testletTimers?.[testletKey];
  if (!timer || (timer.status !== "running" && timer.status !== "paused")) {
    return testRun;
  }
  return normalizeTestRun({
    ...testRun,
    testletTimers: {
      ...(testRun.testletTimers ?? {}),
      [testletKey]: {
        ...timer,
        status: "cancelled",
        remainingSeconds: 0,
        expiresAt: null,
        updatedAt: timestamp,
        endedAt: timestamp
      }
    },
    updatedAt: timestamp
  });
};

const applyMonitorGoto = (input: {
  contentRelease: ContentRelease;
  testRun: TestRun;
  targetUnitKey: string;
  remainingSeconds?: number | null;
  timestamp: string;
}): {
  testRun: TestRun;
  restoredTestletKey: string | null;
  previousTimer: NonNullable<TestRun["testletTimers"]>[string] | null;
} => {
  const booklet = input.contentRelease.runtimeSnapshot.bookletEntries.find(
    candidate => candidate.bookletKey === input.testRun.bookletKey
  );
  const targetUnit = booklet?.unitEntries.find(
    candidate => candidate.unitKey === input.targetUnitKey
  );
  if (!targetUnit) {
    throw new FirstSliceError(
      400,
      "monitor_goto_target_unit_invalid",
      `Unit '${input.targetUnitKey}' does not belong to booklet '${input.testRun.bookletKey}'.`
    );
  }
  if (
    !resolveVisibleBookletUnits(booklet, input.testRun).some(
      unit => unit.unitKey === input.targetUnitKey
    )
  ) {
    throw new FirstSliceError(
      409,
      "monitor_goto_target_unit_hidden",
      `Unit '${input.targetUnitKey}' is not part of the run's active adaptive route.`
    );
  }

  let nextRun = transitionTestletTimersForRunStatus(
    input.testRun,
    "running",
    input.timestamp
  );
  const currentTimedTestlet = resolveTimedTestletForUnit(
    booklet,
    nextRun.currentUnitKey
  );
  const targetTimedTestlet = resolveTimedTestletForUnit(
    booklet,
    input.targetUnitKey
  );
  if (input.remainingSeconds != null && !targetTimedTestlet) {
    throw new FirstSliceError(
      400,
      "monitor_goto_time_target_not_timed",
      `Unit '${input.targetUnitKey}' does not belong to a timed testlet.`
    );
  }
  const previousTargetTimer = targetTimedTestlet
    ? nextRun.testletTimers?.[targetTimedTestlet.testletKey] ?? null
    : null;
  if (
    currentTimedTestlet &&
    currentTimedTestlet.testletKey !== targetTimedTestlet?.testletKey
  ) {
    nextRun = cancelTestletTimerAfterLeave(
      nextRun,
      currentTimedTestlet.testletKey,
      input.timestamp
    );
  }
  if (
    targetTimedTestlet &&
    targetTimedTestlet.testletKey !== currentTimedTestlet?.testletKey
  ) {
    const testletTimers = { ...(nextRun.testletTimers ?? {}) };
    if (input.remainingSeconds != null) {
      testletTimers[targetTimedTestlet.testletKey] = {
        testletKey: targetTimedTestlet.testletKey,
        status: "paused",
        durationSeconds: input.remainingSeconds,
        remainingSeconds: input.remainingSeconds,
        startedAt: previousTargetTimer?.startedAt ?? input.timestamp,
        expiresAt: null,
        updatedAt: input.timestamp,
        endedAt: null
      };
    } else {
      delete testletTimers[targetTimedTestlet.testletKey];
    }
    nextRun = normalizeTestRun({
      ...nextRun,
      testletTimers,
      updatedAt: input.timestamp
    });
  } else if (targetTimedTestlet && input.remainingSeconds != null) {
    nextRun = normalizeTestRun({
      ...nextRun,
      testletTimers: {
        ...(nextRun.testletTimers ?? {}),
        [targetTimedTestlet.testletKey]: {
          testletKey: targetTimedTestlet.testletKey,
          status: "paused",
          durationSeconds: input.remainingSeconds,
          remainingSeconds: input.remainingSeconds,
          startedAt: previousTargetTimer?.startedAt ?? input.timestamp,
          expiresAt: null,
          updatedAt: input.timestamp,
          endedAt: null
        }
      },
      updatedAt: input.timestamp
    });
  }

  const targetTestletKeys = targetUnit.testletPath ?? [];
  return {
    testRun: normalizeTestRun({
      ...nextRun,
      status: "running",
      currentUnitKey: input.targetUnitKey,
      unlockedTestletKeys: Array.from(
        new Set([...(nextRun.unlockedTestletKeys ?? []), ...targetTestletKeys])
      ),
      lockedTestletKeys: (nextRun.lockedTestletKeys ?? []).filter(
        testletKey => !targetTestletKeys.includes(testletKey)
      ),
      lockedUnitKeys: (nextRun.lockedUnitKeys ?? []).filter(
        unitKey => unitKey !== input.targetUnitKey
      ),
      updatedAt: input.timestamp
    }),
    restoredTestletKey:
      input.remainingSeconds != null ? targetTimedTestlet?.testletKey ?? null : null,
    previousTimer:
      input.remainingSeconds != null ? previousTargetTimer : null
  };
};

const applyMonitorNavigationUnlock = (input: {
  contentRelease: ContentRelease;
  testRun: TestRun;
  timestamp: string;
}): TestRun => {
  const booklet = input.contentRelease.runtimeSnapshot.bookletEntries.find(
    candidate => candidate.bookletKey === input.testRun.bookletKey
  );
  const codeProtectedTestletKeys =
    booklet?.testletEntries
      ?.filter(testlet => Boolean(testlet.restrictions?.codeToEnter?.code))
      .map(testlet => testlet.testletKey) ?? [];

  return normalizeTestRun({
    ...input.testRun,
    monitorNavigationUnlocked: true,
    unlockedTestletKeys: Array.from(
      new Set([
        ...(input.testRun.unlockedTestletKeys ?? []),
        ...codeProtectedTestletKeys
      ])
    ),
    lockedTestletKeys: [],
    lockedUnitKeys: [],
    updatedAt: input.timestamp
  });
};

const applyMonitorNavigationLock = (input: {
  testRun: TestRun;
  timestamp: string;
}): TestRun =>
  normalizeTestRun({
    ...input.testRun,
    monitorNavigationUnlocked: false,
    updatedAt: input.timestamp
  });

const applyMonitorSetTestletTime = (input: {
  contentRelease: ContentRelease;
  testRun: TestRun;
  targetUnitKey: string;
  remainingSeconds: number;
  timestamp: string;
}): {
  testRun: TestRun;
  testletKey: string;
  previousTimer: NonNullable<TestRun["testletTimers"]>[string] | null;
} => {
  const booklet = input.contentRelease.runtimeSnapshot.bookletEntries.find(
    candidate => candidate.bookletKey === input.testRun.bookletKey
  );
  const targetUnit = booklet?.unitEntries.find(
    candidate => candidate.unitKey === input.targetUnitKey
  );
  if (!targetUnit) {
    throw new FirstSliceError(
      400,
      "monitor_time_target_unit_invalid",
      `Unit '${input.targetUnitKey}' does not belong to booklet '${input.testRun.bookletKey}'.`
    );
  }
  const timedTestlet = resolveTimedTestletForUnit(booklet, input.targetUnitKey);
  if (!timedTestlet) {
    throw new FirstSliceError(
      400,
      "monitor_time_target_not_timed",
      `Unit '${input.targetUnitKey}' does not belong to a timed testlet.`
    );
  }

  const previousTimer =
    input.testRun.testletTimers?.[timedTestlet.testletKey] ?? null;
  const currentUnit = booklet?.unitEntries.find(
    candidate => candidate.unitKey === input.testRun.currentUnitKey
  );
  const targetIsCurrent = Boolean(
    booklet &&
      unitBelongsToTestlet(booklet, currentUnit, timedTestlet.testletKey)
  );
  const status =
    input.testRun.status === "running" && targetIsCurrent ? "running" : "paused";
  const timestampMs = Date.parse(input.timestamp);
  const expiresAt =
    status === "running" && Number.isFinite(timestampMs)
      ? new Date(timestampMs + input.remainingSeconds * 1_000).toISOString()
      : null;
  return {
    testRun: normalizeTestRun({
      ...input.testRun,
      testletTimers: {
        ...(input.testRun.testletTimers ?? {}),
        [timedTestlet.testletKey]: {
          testletKey: timedTestlet.testletKey,
          status,
          durationSeconds: input.remainingSeconds,
          remainingSeconds: input.remainingSeconds,
          startedAt: input.timestamp,
          expiresAt,
          updatedAt: input.timestamp,
          endedAt: null
        }
      },
      updatedAt: input.timestamp
    }),
    testletKey: timedTestlet.testletKey,
    previousTimer
  };
};

const resolveActiveTestletTimer = (
  contentRelease: ContentRelease,
  testRun: TestRun,
  timestamp: string
): ParticipantCurrentRunState["activeTestletTimer"] => {
  const booklet = contentRelease.runtimeSnapshot.bookletEntries.find(
    candidate => candidate.bookletKey === testRun.bookletKey
  );
  const testlet = resolveTimedTestletForUnit(booklet, testRun.currentUnitKey);
  const timer = testlet ? testRun.testletTimers?.[testlet.testletKey] : null;
  const timeMax = testlet?.restrictions?.timeMax;
  const timingPolicy = (
    booklet?.policy ?? compileBookletRuntimePolicy({})
  ).timing;
  const executionMode = resolveParticipantExecutionMode(testRun.executionMode);
  if (
    !testlet ||
    !timer ||
    !timeMax ||
    (timer.status !== "running" && timer.status !== "paused")
  ) {
    return null;
  }
  return {
    testletKey: testlet.testletKey,
    displayLabel: testlet.displayLabel,
    status: timer.status,
    durationSeconds: timer.durationSeconds,
    remainingSeconds: getTestletTimerRemainingSeconds(timer, timestamp),
    startedAt: timer.startedAt,
    expiresAt: timer.expiresAt,
    leave: timeMax.leave,
    showTimeLeft: timingPolicy.showTimeLeft || executionMode.showTimeLeft,
    warningMinutes: timingPolicy.warningMinutes
  };
};

const buildMonitorTestletTimers = (
  contentRelease: ContentRelease | null,
  testRun: TestRun,
  timestamp: string
): MonitorTestletTimer[] => {
  const normalizedTestRun = normalizeTestRun(testRun);
  const booklet = contentRelease?.runtimeSnapshot.bookletEntries.find(
    candidate => candidate.bookletKey === normalizedTestRun.bookletKey
  );
  const activeTimedTestlet = resolveTimedTestletForUnit(
    booklet,
    normalizedTestRun.currentUnitKey
  );
  const testletOrder = new Map(
    (booklet?.testletEntries ?? []).map((testlet, index) => [
      testlet.testletKey,
      index
    ])
  );

  return Object.values(normalizedTestRun.testletTimers ?? {})
    .map(timer => {
      const testlet = resolveBookletTestletEntry(booklet, timer.testletKey);
      return {
        ...timer,
        displayLabel: testlet?.displayLabel ?? timer.testletKey,
        remainingSeconds: getTestletTimerRemainingSeconds(timer, timestamp),
        current: activeTimedTestlet?.testletKey === timer.testletKey,
        leave: testlet?.restrictions?.timeMax?.leave ?? null
      };
    })
    .sort(
      (left, right) =>
        (testletOrder.get(left.testletKey) ?? Number.MAX_SAFE_INTEGER) -
          (testletOrder.get(right.testletKey) ?? Number.MAX_SAFE_INTEGER) ||
        left.testletKey.localeCompare(right.testletKey)
    );
};

const resolveTestletCompletenessPolicy = (
  booklet: ContentReleaseBookletEntry | undefined,
  currentUnitKey: string | null,
  policy: BookletRuntimePolicy
): BookletRuntimePolicy => {
  const currentUnit = booklet?.unitEntries.find(
    unit => unit.unitKey === currentUnitKey
  );
  const testletPath = currentUnit?.testletPath ?? [];
  const resolveRestriction = (
    field: "presentation" | "response",
    fallback: BookletLeaveRestriction
  ): BookletLeaveRestriction => {
    for (let index = testletPath.length - 1; index >= 0; index -= 1) {
      const testlet = booklet?.testletEntries?.find(
        entry => entry.testletKey === testletPath[index]
      );
      const restriction =
        testlet?.restrictions?.denyNavigationOnIncomplete?.[field];
      if (restriction) {
        return restriction;
      }
    }
    return (
      booklet?.rootRestrictions?.denyNavigationOnIncomplete?.[field] ?? fallback
    );
  };

  return {
    ...policy,
    navigation: {
      ...policy.navigation,
      requirePresentationComplete: resolveRestriction(
        "presentation",
        policy.navigation.requirePresentationComplete
      ),
      requireResponseComplete: resolveRestriction(
        "response",
        policy.navigation.requireResponseComplete
      )
    }
  };
};

const resolveBookletNavigationState = (
  contentRelease: ContentRelease,
  testRun: TestRun
): ParticipantCurrentRunState["navigation"] => {
  const booklet = contentRelease.runtimeSnapshot.bookletEntries.find(
    candidate => candidate.bookletKey === testRun.bookletKey
  );
  const policy = booklet?.policy ?? compileBookletRuntimePolicy({});
  const executionMode = resolveParticipantExecutionMode(testRun.executionMode);
  const completenessPolicy = resolveTestletCompletenessPolicy(
    booklet,
    testRun.currentUnitKey,
    policy
  );
  const units = resolveVisibleBookletUnits(booklet, testRun);
  const currentIndex = units.findIndex(
    unit => unit.unitKey === testRun.currentUnitKey
  );
  const currentResponse = testRun.currentUnitKey
    ? testRun.unitResponses[testRun.currentUnitKey] ?? ""
    : "";
  const veronaResponse = parseVeronaUnitResponse(currentResponse);
  const presentationProgress =
    currentIndex < 0
      ? "complete"
      : veronaResponse
        ? veronaResponse.unitState.presentationProgress
        : "complete";
  const responseProgress =
    currentIndex < 0
      ? "complete"
      : veronaResponse
        ? veronaResponse.unitState.responseProgress
        : currentResponse.trim()
          ? "complete"
          : "none";
  const restrictionsBypassed =
    testRun.monitorNavigationUnlocked || !executionMode.forceNaviRestrictions;
  const backwardCompletenessReasons = bookletNavigationDeniedReasons({
    policy: completenessPolicy,
    direction: "backward",
    presentationProgress,
    responseProgress
  });
  const forwardCompletenessReasons = bookletNavigationDeniedReasons({
    policy: completenessPolicy,
    direction: "forward",
    presentationProgress,
    responseProgress
  });
  const backwardDeniedReasons = restrictionsBypassed
    ? []
    : [...backwardCompletenessReasons];
  const forwardDeniedReasons = restrictionsBypassed
    ? []
    : [...forwardCompletenessReasons];
  const backwardAdvisoryReasons = executionMode.forceNaviRestrictions
    ? []
    : backwardCompletenessReasons;
  const forwardAdvisoryReasons = executionMode.forceNaviRestrictions
    ? []
    : forwardCompletenessReasons;
  const isUnitInaccessible = (unitKey: string | null): boolean =>
    executionMode.forceNaviRestrictions &&
    (isUnitLeaveLocked(booklet, testRun, unitKey) ||
      Boolean(findClosedTimedTestlet(booklet, testRun, unitKey)));
  let previousUnitIndex = -1;
  for (let index = currentIndex - 1; index >= 0; index -= 1) {
    if (!isUnitInaccessible(units[index]?.unitKey ?? null)) {
      previousUnitIndex = index;
      break;
    }
  }
  let nextUnitIndex = -1;
  for (
    let index = Math.max(currentIndex + 1, 0);
    index < units.length;
    index += 1
  ) {
    if (!isUnitInaccessible(units[index]?.unitKey ?? null)) {
      nextUnitIndex = index;
      break;
    }
  }
  const previousUnitKey =
    previousUnitIndex >= 0 ? units[previousUnitIndex]?.unitKey ?? null : null;
  const nextUnitKey =
    nextUnitIndex >= 0 ? units[nextUnitIndex]?.unitKey ?? null : null;
  const nextTestletGate = restrictionsBypassed
    ? null
    : findTestletCodeGate({
        booklet,
        testRun,
        firstUnitIndex:
          (booklet?.unitEntries.findIndex(
            unit => unit.unitKey === testRun.currentUnitKey
          ) ?? -1) + 1,
        lastUnitIndex:
          booklet?.unitEntries.findIndex(
            unit => unit.unitKey === nextUnitKey
          ) ?? -1
      });
  if (nextTestletGate) {
    forwardDeniedReasons.push("testlet_code_required");
  }
  if (
    executionMode.forceTimeRestrictions &&
    isLeavingForbiddenTimedTestlet(booklet, testRun, nextUnitKey) &&
    !forwardDeniedReasons.includes("testlet_time_leave_forbidden")
  ) {
    forwardDeniedReasons.push("testlet_time_leave_forbidden");
  }
  if (
    executionMode.forceTimeRestrictions &&
    isLeavingForbiddenTimedTestlet(booklet, testRun, previousUnitKey) &&
    !backwardDeniedReasons.includes("testlet_time_leave_forbidden")
  ) {
    backwardDeniedReasons.push("testlet_time_leave_forbidden");
  }
  const remainingTestletGate = restrictionsBypassed
    ? null
    : findTestletCodeGate({
        booklet,
        testRun,
        firstUnitIndex:
          (booklet?.unitEntries.findIndex(
            unit => unit.unitKey === testRun.currentUnitKey
          ) ?? -1) + 1,
        lastUnitIndex: (booklet?.unitEntries.length ?? 0) - 1
      });
  const isLastUnit = currentIndex >= 0 && currentIndex === units.length - 1;
  const canComplete =
    currentIndex >= 0 &&
    testRun.status !== "completed" &&
    forwardDeniedReasons.length === 0 &&
    remainingTestletGate == null &&
    (!executionMode.forceTimeRestrictions ||
      !isLeavingForbiddenTimedTestlet(booklet, testRun, null));
  const canPlayerEnd =
    canComplete &&
    (policy.navigation.playerEnd === "always" ||
      (policy.navigation.playerEnd === "last_unit" && isLastUnit));

  return {
    previousUnitKey,
    nextUnitKey,
    canGoPrevious:
      testRun.status === "running" &&
      previousUnitKey != null &&
      backwardDeniedReasons.length === 0,
    canGoNext:
      testRun.status === "running" &&
      nextUnitKey != null &&
      forwardDeniedReasons.length === 0,
    canComplete,
    canPlayerEnd,
    backwardDeniedReasons,
    forwardDeniedReasons,
    backwardAdvisoryReasons,
    forwardAdvisoryReasons,
    nextTestletGate
  };
};

const requireBookletNavigationAllowed = (input: {
  contentRelease: ContentRelease;
  testRun: TestRun;
  targetUnitKey: string | null;
  confirmTestletTimeLeave?: boolean;
  confirmTestletLeaveLock?: boolean;
}): void => {
  const currentUnitKey = input.testRun.currentUnitKey;
  if (!input.targetUnitKey || currentUnitKey === input.targetUnitKey) {
    return;
  }
  const booklet = input.contentRelease.runtimeSnapshot.bookletEntries.find(
    candidate => candidate.bookletKey === input.testRun.bookletKey
  );
  const executionMode = resolveParticipantExecutionMode(
    input.testRun.executionMode
  );
  const units = booklet?.unitEntries ?? [];
  const currentIndex = currentUnitKey
    ? units.findIndex(unit => unit.unitKey === currentUnitKey)
    : -1;
  const targetIndex = units.findIndex(unit => unit.unitKey === input.targetUnitKey);
  if ((currentUnitKey && currentIndex < 0) || targetIndex < 0) {
    return;
  }
  const navigation = resolveBookletNavigationState(
    input.contentRelease,
    input.testRun
  );
  const direction = targetIndex > currentIndex ? "forward" : "backward";
  const deniedReasons =
    direction === "forward"
      ? navigation.forwardDeniedReasons
      : navigation.backwardDeniedReasons;
  const targetIsVisible = resolveVisibleBookletUnits(
    booklet,
    input.testRun
  ).some(unit => unit.unitKey === input.targetUnitKey);
  if (!targetIsVisible) {
    deniedReasons.push("adaptive_unit_hidden");
  }
  if (!executionMode.forceNaviRestrictions) {
    if (deniedReasons.length > 0) {
      throw new FirstSliceError(
        409,
        "booklet_navigation_denied",
        `Unit '${input.targetUnitKey}' is not part of the active booklet route.`,
        {
          currentUnitKey,
          targetUnitKey: input.targetUnitKey,
          direction,
          deniedReasons
        }
      );
    }
    return;
  }
  const directTestletGate =
    direction === "forward"
      ? findTestletCodeGate({
          booklet,
          testRun: input.testRun,
          firstUnitIndex: currentIndex + 1,
          lastUnitIndex: targetIndex
        })
      : null;
  if (
    directTestletGate &&
    !deniedReasons.includes("testlet_code_required")
  ) {
    deniedReasons.push("testlet_code_required");
  }
  const closedTimedTestlet = findClosedTimedTestlet(
    booklet,
    input.testRun,
    input.targetUnitKey
  );
  if (
    closedTimedTestlet &&
    !deniedReasons.includes("testlet_time_closed")
  ) {
    deniedReasons.push("testlet_time_closed");
  }
  if (
    isUnitLeaveLocked(booklet, input.testRun, input.targetUnitKey) &&
    !deniedReasons.includes("testlet_leave_locked")
  ) {
    deniedReasons.push("testlet_leave_locked");
  }
  if (
    isLeavingForbiddenTimedTestlet(
      booklet,
      input.testRun,
      input.targetUnitKey
    ) &&
    !deniedReasons.includes("testlet_time_leave_forbidden")
  ) {
    deniedReasons.push("testlet_time_leave_forbidden");
  }
  const leavingTimedTestlet = resolveLeavingTimedTestlet(
    booklet,
    input.testRun,
    input.targetUnitKey
  );
  if (
    leavingTimedTestlet?.restrictions?.timeMax?.leave === "confirm" &&
    !input.confirmTestletTimeLeave &&
    !deniedReasons.includes("testlet_time_leave_confirmation_required")
  ) {
    deniedReasons.push("testlet_time_leave_confirmation_required");
  }
  const leavingLock = resolveCurrentLeaveLock(
    booklet,
    input.testRun,
    input.targetUnitKey
  );
  if (
    leavingLock?.confirm &&
    !input.confirmTestletLeaveLock &&
    deniedReasons.length === 0 &&
    !deniedReasons.includes("testlet_leave_confirmation_required")
  ) {
    deniedReasons.push("testlet_leave_confirmation_required");
  }
  if (deniedReasons.length > 0) {
    throw new FirstSliceError(
      409,
      "booklet_navigation_denied",
      `Unit '${currentUnitKey}' cannot be left ${direction} because the booklet completion policy is not satisfied.`,
      {
        currentUnitKey,
        targetUnitKey: input.targetUnitKey,
        direction,
        deniedReasons,
        ...(directTestletGate ? { testletGate: directTestletGate } : {})
      }
    );
  }
};

const resolveRuntimeUnit = (
  contentRelease: ContentRelease,
  bookletKey: string,
  unitKey: string | null
): {
  unitKey: string | null;
  displayLabel: string | null;
  description?: string | null;
  content?: string | null;
  player?: NonNullable<ContentReleaseRuntimeSnapshot["playerEntries"]>[number] | null;
  unitDefinition?: string | null;
  unitDefinitionType?: string | null;
  testletPath: string[];
} => {
  if (!unitKey) {
    return {
      unitKey: null,
      displayLabel: null,
      description: null,
      content: null,
      player: null,
      unitDefinition: null,
      unitDefinitionType: null,
      testletPath: []
    };
  }

  const bookletEntry =
    contentRelease.runtimeSnapshot.bookletEntries.find(
      candidate => candidate.bookletKey === bookletKey
    ) ?? contentRelease.runtimeSnapshot.bookletEntries[0];

  const unitEntry =
    bookletEntry?.unitEntries.find(candidate => candidate.unitKey === unitKey) ?? null;

  return {
    unitKey,
    displayLabel: unitEntry?.displayLabel ?? toDisplayLabel("Unit", unitKey),
    description: unitEntry?.description ?? null,
    content: unitEntry?.content ?? null,
    player:
      contentRelease.runtimeSnapshot.playerEntries?.find(
        player => player.playerKey === unitEntry?.playerKey
      ) ?? null,
    unitDefinition: unitEntry?.unitDefinition ?? null,
    unitDefinitionType: unitEntry?.unitDefinitionType ?? null,
    testletPath: unitEntry?.testletPath ?? []
  };
};

const resolveRuntimeBookletAssets = (
  contentRelease: ContentRelease,
  bookletKey: string
): NonNullable<ParticipantCurrentRunState["bookletAssets"]> => {
  const bookletEntry =
    contentRelease.runtimeSnapshot.bookletEntries.find(
      candidate => candidate.bookletKey === bookletKey
    ) ?? contentRelease.runtimeSnapshot.bookletEntries[0];
  const units = (bookletEntry?.unitEntries ?? []).flatMap(unitEntry => {
    const unitDefinition = unitEntry.unitDefinition;
    const playerKey = unitEntry.playerKey?.trim();
    if (!unitDefinition?.trim() || !playerKey) {
      return [];
    }
    return [
      {
        unitKey: unitEntry.unitKey,
        playerKey,
        unitDefinition,
        unitDefinitionType:
          unitEntry.unitDefinitionType?.trim() || playerKey
      }
    ];
  });
  const playerKeys = new Set(units.map(unit => unit.playerKey));
  const players = (contentRelease.runtimeSnapshot.playerEntries ?? []).filter(
    player => playerKeys.has(player.playerKey)
  );
  return { units, players };
};

const resolveRuntimeBookletUnits = (
  contentRelease: ContentRelease,
  bookletKey: string,
  testRun: TestRun
): Array<{
  unitKey: string;
  displayLabel: string;
  shortLabel?: string;
  description?: string;
  content?: string;
  testletPath: string[];
  isLocked: boolean;
}> => {
  const bookletEntry =
    contentRelease.runtimeSnapshot.bookletEntries.find(
      candidate => candidate.bookletKey === bookletKey
    ) ?? contentRelease.runtimeSnapshot.bookletEntries[0];

  return (
    resolveVisibleBookletUnits(bookletEntry, testRun).map(unitEntry => ({
      unitKey: unitEntry.unitKey,
      displayLabel: unitEntry.displayLabel,
      ...(unitEntry.shortLabel ? { shortLabel: unitEntry.shortLabel } : {}),
      testletPath: unitEntry.testletPath ?? [],
      isLocked: isUnitLeaveLocked(bookletEntry, testRun, unitEntry.unitKey),
      ...(unitEntry.description ? { description: unitEntry.description } : {}),
      ...(unitEntry.content ? { content: unitEntry.content } : {})
    })) ?? []
  );
};

const requireRuntimeUnitForBooklet = (
  contentRelease: ContentRelease,
  bookletKey: string,
  unitKey: string
): ContentRelease["runtimeSnapshot"]["bookletEntries"][number]["unitEntries"][number] => {
  const bookletEntry =
    contentRelease.runtimeSnapshot.bookletEntries.find(
      candidate => candidate.bookletKey === bookletKey
    ) ?? null;

  if (!bookletEntry) {
    throw new FirstSliceError(
      409,
      "test_run_booklet_not_found",
      `Booklet '${bookletKey}' from the test run was not found in content release '${contentRelease.contentReleaseId}'.`
    );
  }

  const unitEntry = bookletEntry.unitEntries.find(
    candidate => candidate.unitKey === unitKey
  );
  if (!unitEntry) {
    throw new FirstSliceError(
      404,
      "unit_not_found",
      `Unit '${unitKey}' was not found in booklet '${bookletKey}'.`
    );
  }
  return unitEntry;
};

const sortWorkspaceContentReleases = (
  releases: ContentRelease[]
): ContentRelease[] =>
  [...releases].sort((left, right) => {
    const rank = (release: ContentRelease): number => {
      if (release.status === "active") {
        return 0;
      }
      if (release.status === "staged") {
        return 1;
      }
      return 2;
    };

    const rankDelta = rank(left) - rank(right);
    if (rankDelta !== 0) {
      return rankDelta;
    }

    const leftTimestamp = left.activatedAt ?? left.createdAt;
    const rightTimestamp = right.activatedAt ?? right.createdAt;
    return rightTimestamp.localeCompare(leftTimestamp);
  });

const buildWorkspaceContentReleaseListItems = (input: {
  contentReleases: ContentRelease[];
  importJobs: ImportJob[];
  sourcePackages: SourcePackage[];
  participantSessions: ParticipantSession[];
  testRuns: TestRun[];
}): WorkspaceContentReleaseListItem[] =>
  sortWorkspaceContentReleases(input.contentReleases).map<WorkspaceContentReleaseListItem>(
    contentRelease => {
      const importJob =
        input.importJobs.find(
          candidate => candidate.importJobId === contentRelease.importJobId
        ) ?? null;
      const sourcePackage =
        importJob
          ? input.sourcePackages.find(
              candidate => candidate.sourcePackageId === importJob.sourcePackageId
            ) ?? null
          : null;

      return {
        contentRelease,
        importJob,
        sourcePackage,
        participantSessionCount: input.participantSessions.filter(
          participantSession =>
            participantSession.contentReleaseId === contentRelease.contentReleaseId
        ).length,
        openTestRunCount: input.testRuns.filter(
          testRun =>
            testRun.contentReleaseId === contentRelease.contentReleaseId &&
            testRun.status !== "completed"
        ).length
      };
    }
  );

const getLatestTestRunByParticipantSessionId = (
  testRuns: TestRun[]
): Map<string, TestRun> => {
  const latestBySessionId = new Map<string, TestRun>();
  for (const testRun of testRuns) {
    const currentLatest = latestBySessionId.get(testRun.participantSessionId);
    if (!currentLatest || testRun.updatedAt.localeCompare(currentLatest.updatedAt) > 0) {
      latestBySessionId.set(testRun.participantSessionId, normalizeTestRun(testRun));
    }
  }
  return latestBySessionId;
};

const scopeStudyMonitorDataToMonitorableModes = (input: {
  participantSessions: ParticipantSession[];
  participantRosterEntries: ParticipantRosterEntry[];
  testRuns: TestRun[];
  reviews: WorkspaceReview[];
}): {
  participantSessions: ParticipantSession[];
  participantRosterEntries: ParticipantRosterEntry[];
  testRuns: TestRun[];
  reviews: WorkspaceReview[];
} => {
  const rosterEntriesByLoginKey = new Map(
    input.participantRosterEntries.map(rosterEntry => [
      rosterEntry.loginKey,
      rosterEntry
    ])
  );
  const modeByParticipantSessionId = new Map<
    string,
    ParticipantExecutionMode
  >();
  for (const testRun of input.testRuns) {
    if (testRun.executionMode) {
      modeByParticipantSessionId.set(
        testRun.participantSessionId,
        testRun.executionMode
      );
    }
  }
  const participantSessions = input.participantSessions.filter(
    participantSession =>
      resolveParticipantExecutionMode(
        participantSession.executionMode ??
          modeByParticipantSessionId.get(
            participantSession.participantSessionId
          ) ??
          rosterEntriesByLoginKey.get(participantSession.loginKey)?.executionMode
      ).monitorable
  );
  const participantSessionsById = new Map(
    participantSessions.map(participantSession => [
      participantSession.participantSessionId,
      participantSession
    ])
  );
  const monitorableParticipantSessionIds = new Set(
    participantSessionsById.keys()
  );
  const testRuns = input.testRuns.filter(testRun => {
    const participantSession = participantSessionsById.get(
      testRun.participantSessionId
    );
    return (
      monitorableParticipantSessionIds.has(testRun.participantSessionId) &&
      resolveParticipantExecutionMode(
        testRun.executionMode ??
          participantSession?.executionMode ??
          (participantSession
            ? rosterEntriesByLoginKey.get(participantSession.loginKey)?.executionMode
            : undefined)
      ).monitorable
    );
  });
  const monitorableTestRunIds = new Set(
    testRuns.map(testRun => testRun.testRunId)
  );

  return {
    participantSessions,
    participantRosterEntries: input.participantRosterEntries.filter(
      rosterEntry =>
        resolveParticipantExecutionMode(rosterEntry.executionMode).monitorable
    ),
    testRuns,
    reviews: input.reviews
      .map(normalizeWorkspaceReview)
      .filter(review => monitorableTestRunIds.has(review.testRunId))
  };
};

const buildStudyMonitorUnitProgress = (input: {
  participantSessions: ParticipantSession[];
  participantRosterEntries?: ParticipantRosterEntry[];
  testRuns: TestRun[];
  contentReleases: ContentRelease[];
}): WorkspaceStudyMonitorUnitProgress[] => {
  const contentReleasesById = new Map(
    input.contentReleases.map(contentRelease => [
      contentRelease.contentReleaseId,
      contentRelease
    ])
  );
  const sessionsById = new Map(
    input.participantSessions.map(participantSession => [
      participantSession.participantSessionId,
      participantSession
    ])
  );
  const progressByUnitKey = new Map<string, WorkspaceStudyMonitorUnitProgress>();

  const ensureProgress = (
    unitKey: string,
    displayLabel: string
  ): WorkspaceStudyMonitorUnitProgress => {
    const existing = progressByUnitKey.get(unitKey);
    if (existing) {
      return existing;
    }

    const created: WorkspaceStudyMonitorUnitProgress = {
      unitKey,
      displayLabel,
      rosterExpectedCount: 0,
      expectedRunCount: 0,
      responseCount: 0,
      missingResponseCount: 0,
      unexpectedResponseCount: 0,
      completedRunCount: 0,
      latestActivityAt: null
    };
    progressByUnitKey.set(unitKey, created);
    return created;
  };

  const runLoginKeysByBookletKey = new Map<string, Set<string>>();
  for (const testRun of input.testRuns.map(normalizeTestRun)) {
    const participantSession = sessionsById.get(testRun.participantSessionId);
    const contentRelease = participantSession
      ? contentReleasesById.get(participantSession.contentReleaseId)
      : null;
    const booklet = contentRelease?.runtimeSnapshot.bookletEntries.find(
      bookletEntry => bookletEntry.bookletKey === testRun.bookletKey
    );
    if (participantSession) {
      const runLoginKeys =
        runLoginKeysByBookletKey.get(testRun.bookletKey) ?? new Set<string>();
      runLoginKeys.add(participantSession.loginKey);
      runLoginKeysByBookletKey.set(testRun.bookletKey, runLoginKeys);
    }
    const responseUnitKeys = new Set(Object.keys(testRun.unitResponses));
    const expectedUnitKeys = new Set<string>();

    for (const unitEntry of resolveVisibleBookletUnits(booklet, testRun)) {
      expectedUnitKeys.add(unitEntry.unitKey);
      const progress = ensureProgress(unitEntry.unitKey, unitEntry.displayLabel);
      progress.expectedRunCount += 1;
      if (responseUnitKeys.has(unitEntry.unitKey)) {
        progress.responseCount += 1;
      } else {
        progress.missingResponseCount += 1;
      }
      if (testRun.status === "completed") {
        progress.completedRunCount += 1;
      }
      if (
        !progress.latestActivityAt ||
        testRun.updatedAt.localeCompare(progress.latestActivityAt) > 0
      ) {
        progress.latestActivityAt = testRun.updatedAt;
      }
    }

    for (const unitKey of responseUnitKeys) {
      if (expectedUnitKeys.has(unitKey)) {
        continue;
      }

      const progress = ensureProgress(unitKey, unitKey);
      progress.responseCount += 1;
      progress.unexpectedResponseCount += 1;
      if (testRun.status === "completed") {
        progress.completedRunCount += 1;
      }
      if (
        !progress.latestActivityAt ||
        testRun.updatedAt.localeCompare(progress.latestActivityAt) > 0
      ) {
        progress.latestActivityAt = testRun.updatedAt;
      }
    }
  }
  for (const rosterEntry of input.participantRosterEntries ?? []) {
    for (const bookletKey of getParticipantRosterBookletKeys(rosterEntry)) {
      if (runLoginKeysByBookletKey.get(bookletKey)?.has(rosterEntry.loginKey)) {
        continue;
      }
      const booklet = input.contentReleases
        .flatMap(contentRelease => contentRelease.runtimeSnapshot.bookletEntries)
        .find(bookletEntry => bookletEntry.bookletKey === bookletKey);
      if (!booklet) {
        continue;
      }
      for (const unitEntry of booklet.unitEntries) {
        const progress = ensureProgress(unitEntry.unitKey, unitEntry.displayLabel);
        progress.rosterExpectedCount += 1;
        progress.expectedRunCount += 1;
        progress.missingResponseCount += 1;
        if (
          !progress.latestActivityAt ||
          rosterEntry.importedAt.localeCompare(progress.latestActivityAt) > 0
        ) {
          progress.latestActivityAt = rosterEntry.importedAt;
        }
      }
    }
  }

  return Array.from(progressByUnitKey.values()).sort((left, right) =>
    left.unitKey.localeCompare(right.unitKey)
  );
};

const buildStudyMonitorBookletProgress = (input: {
  participantSessions: ParticipantSession[];
  participantRosterEntries: ParticipantRosterEntry[];
  testRuns: TestRun[];
  contentReleases: ContentRelease[];
  reviews: WorkspaceReview[];
}): WorkspaceStudyMonitorBookletProgress[] => {
  type MutableBookletProgress = WorkspaceStudyMonitorBookletProgress & {
    participantSessionIds: Set<string>;
  };
  const contentReleasesById = new Map(
    input.contentReleases.map(contentRelease => [
      contentRelease.contentReleaseId,
      contentRelease
    ])
  );
  const sessionsById = new Map(
    input.participantSessions.map(participantSession => [
      participantSession.participantSessionId,
      participantSession
    ])
  );
  const reviewsByTestRunId = new Map<string, number>();
  for (const review of input.reviews) {
    reviewsByTestRunId.set(
      review.testRunId,
      (reviewsByTestRunId.get(review.testRunId) ?? 0) + 1
    );
  }
  const progressByBookletKey = new Map<string, MutableBookletProgress>();

  const findBooklet = (
    bookletKey: string,
    preferredContentRelease?: ContentRelease
  ): ContentReleaseRuntimeSnapshot["bookletEntries"][number] | undefined =>
    preferredContentRelease?.runtimeSnapshot.bookletEntries.find(
      bookletEntry => bookletEntry.bookletKey === bookletKey
    ) ??
    input.contentReleases
      .flatMap(contentRelease => contentRelease.runtimeSnapshot.bookletEntries)
      .find(bookletEntry => bookletEntry.bookletKey === bookletKey);

  const findBookletDisplayLabel = (
    bookletKey: string,
    preferredContentRelease?: ContentRelease
  ): string => {
    const booklet = findBooklet(bookletKey, preferredContentRelease);
    return booklet?.displayLabel ?? bookletKey;
  };

  const ensureProgress = (
    bookletKey: string,
    contentRelease?: ContentRelease
  ): MutableBookletProgress => {
    const booklet = findBooklet(bookletKey, contentRelease);
    const existing = progressByBookletKey.get(bookletKey);
    if (existing) {
      if (existing.unitCount === 0 && booklet) {
        existing.unitCount = booklet.unitEntries.length;
      }
      if (existing.displayLabel === bookletKey && booklet?.displayLabel) {
        existing.displayLabel = booklet.displayLabel;
      }
      return existing;
    }

    const created: MutableBookletProgress = {
      bookletKey,
      displayLabel: booklet?.displayLabel ?? findBookletDisplayLabel(bookletKey),
      expectedParticipantCount: 0,
      rosterEntryCount: 0,
      participantSessionCount: 0,
      participantSessionIds: new Set<string>(),
      testRunCount: 0,
      notStartedCount: 0,
      createdCount: 0,
      runningCount: 0,
      pausedCount: 0,
      completedCount: 0,
      responseCount: 0,
      reviewCount: 0,
      unitCount: booklet?.unitEntries.length ?? 0,
      latestActivityAt: null
    };
    progressByBookletKey.set(bookletKey, created);
    return created;
  };

  const sessionLoginKeysByBookletKey = new Map<string, Set<string>>();
  for (const testRun of input.testRuns.map(normalizeTestRun)) {
    const participantSession = sessionsById.get(testRun.participantSessionId);
    const contentRelease =
      contentReleasesById.get(testRun.contentReleaseId) ??
      (participantSession
        ? contentReleasesById.get(participantSession.contentReleaseId)
        : undefined);
    const progress = ensureProgress(testRun.bookletKey, contentRelease);
    const previousParticipantSessionCount = progress.participantSessionIds.size;
    progress.participantSessionIds.add(testRun.participantSessionId);
    progress.participantSessionCount = progress.participantSessionIds.size;
    if (progress.participantSessionCount > previousParticipantSessionCount) {
      progress.expectedParticipantCount += 1;
    }
    if (participantSession) {
      const sessionLoginKeys =
        sessionLoginKeysByBookletKey.get(testRun.bookletKey) ?? new Set<string>();
      sessionLoginKeys.add(participantSession.loginKey);
      sessionLoginKeysByBookletKey.set(testRun.bookletKey, sessionLoginKeys);
    }
    progress.testRunCount += 1;
    progress.responseCount += Object.keys(testRun.unitResponses).length;
    progress.reviewCount += reviewsByTestRunId.get(testRun.testRunId) ?? 0;
    if (testRun.status === "created") {
      progress.createdCount += 1;
    } else if (testRun.status === "running") {
      progress.runningCount += 1;
    } else if (testRun.status === "paused") {
      progress.pausedCount += 1;
    } else if (testRun.status === "completed") {
      progress.completedCount += 1;
    }
    if (
      !progress.latestActivityAt ||
      testRun.updatedAt.localeCompare(progress.latestActivityAt) > 0
    ) {
      progress.latestActivityAt = testRun.updatedAt;
    }
  }
  for (const rosterEntry of input.participantRosterEntries) {
    for (const bookletKey of getParticipantRosterBookletKeys(rosterEntry)) {
      const progress = ensureProgress(bookletKey);
      progress.rosterEntryCount += 1;
      const sessionLoginKeys =
        sessionLoginKeysByBookletKey.get(bookletKey) ?? new Set<string>();
      if (!sessionLoginKeys.has(rosterEntry.loginKey)) {
        progress.expectedParticipantCount += 1;
        progress.notStartedCount += 1;
      }
      if (
        !progress.latestActivityAt ||
        rosterEntry.importedAt.localeCompare(progress.latestActivityAt) > 0
      ) {
        progress.latestActivityAt = rosterEntry.importedAt;
      }
    }
  }

  return Array.from(progressByBookletKey.values())
    .map(({ participantSessionIds: _participantSessionIds, ...progress }) => progress)
    .sort((left, right) => left.bookletKey.localeCompare(right.bookletKey));
};

const studyMonitorAttentionSubjectRank: Record<
  WorkspaceStudyMonitorAttentionItem["subjectType"],
  number
> = {
  unit: 0,
  group: 1,
  booklet: 2
};

const buildStudyMonitorAttentionItems = (input: {
  groups: WorkspaceStudyMonitorSummary["groups"];
  bookletProgress: WorkspaceStudyMonitorBookletProgress[];
  unitProgress: WorkspaceStudyMonitorUnitProgress[];
}): WorkspaceStudyMonitorAttentionItem[] => {
  const items: WorkspaceStudyMonitorAttentionItem[] = [];

  for (const unit of input.unitProgress) {
    const score =
      unit.missingResponseCount * 100 + unit.unexpectedResponseCount * 50;
    if (score <= 0) {
      continue;
    }
    items.push({
      subjectType: "unit",
      key: unit.unitKey,
      label: unit.displayLabel,
      score,
      missingResponseCount: unit.missingResponseCount,
      unexpectedResponseCount: unit.unexpectedResponseCount,
      notStartedCount: 0,
      runningCount: 0,
      pausedCount: 0,
      responseCount: unit.responseCount,
      reviewCount: 0,
      latestActivityAt: unit.latestActivityAt
    });
  }

  for (const group of input.groups) {
    const score =
      group.notStartedCount * 30 +
      group.pausedCount * 20 +
      group.runningCount * 10;
    if (score <= 0) {
      continue;
    }
    items.push({
      subjectType: "group",
      key: group.groupKey,
      label: group.groupKey,
      score,
      missingResponseCount: 0,
      unexpectedResponseCount: 0,
      notStartedCount: group.notStartedCount,
      runningCount: group.runningCount,
      pausedCount: group.pausedCount,
      responseCount: group.responseCount,
      reviewCount: group.reviewCount,
      latestActivityAt: group.latestActivityAt
    });
  }

  for (const booklet of input.bookletProgress) {
    const score =
      booklet.notStartedCount * 25 +
      booklet.pausedCount * 20 +
      booklet.runningCount * 10;
    if (score <= 0) {
      continue;
    }
    items.push({
      subjectType: "booklet",
      key: booklet.bookletKey,
      label: booklet.displayLabel,
      score,
      missingResponseCount: 0,
      unexpectedResponseCount: 0,
      notStartedCount: booklet.notStartedCount,
      runningCount: booklet.runningCount,
      pausedCount: booklet.pausedCount,
      responseCount: booklet.responseCount,
      reviewCount: booklet.reviewCount,
      latestActivityAt: booklet.latestActivityAt
    });
  }

  return items
    .sort(
      (left, right) =>
        right.score - left.score ||
        (right.latestActivityAt ?? "").localeCompare(left.latestActivityAt ?? "") ||
        studyMonitorAttentionSubjectRank[left.subjectType] -
          studyMonitorAttentionSubjectRank[right.subjectType] ||
        left.label.localeCompare(right.label) ||
        left.key.localeCompare(right.key)
    )
    .slice(0, 8);
};

const buildStudyMonitorSummary = (input: {
  tenantKey: string;
  workspaceKey: string;
  generatedAt: string;
  participantSessions: ParticipantSession[];
  participantRosterEntries: ParticipantRosterEntry[];
  testRuns: TestRun[];
  contentReleases: ContentRelease[];
  reviews: WorkspaceReview[];
}): WorkspaceStudyMonitorSummary => {
  const latestRunsBySessionId = getLatestTestRunByParticipantSessionId(input.testRuns);
  const testRunsBySessionId = new Map<string, TestRun[]>();
  for (const testRun of input.testRuns) {
    const sessionRuns = testRunsBySessionId.get(testRun.participantSessionId) ?? [];
    sessionRuns.push(normalizeTestRun(testRun));
    testRunsBySessionId.set(testRun.participantSessionId, sessionRuns);
  }

  const groupsByKey = new Map<string, WorkspaceStudyMonitorSummary["groups"][number]>();
  for (const participantSession of input.participantSessions) {
    const groupKey = participantSession.groupKey || "unknown-group";
    const latestRun = latestRunsBySessionId.get(
      participantSession.participantSessionId
    );
    const sessionRuns =
      testRunsBySessionId.get(participantSession.participantSessionId) ?? [];
    const group = groupsByKey.get(groupKey) ?? {
      groupKey,
      expectedParticipantCount: 0,
      rosterEntryCount: 0,
      participantSessionCount: 0,
      testRunCount: 0,
      notStartedCount: 0,
      runningCount: 0,
      pausedCount: 0,
      completedCount: 0,
      responseCount: 0,
      reviewCount: 0,
      latestActivityAt: null
    };

    group.expectedParticipantCount += 1;
    group.participantSessionCount += 1;
    group.testRunCount += sessionRuns.length;
    group.responseCount += sessionRuns.reduce(
      (total, testRun) => total + Object.keys(testRun.unitResponses).length,
      0
    );
    const sessionTestRunIds = new Set(
      sessionRuns.map(testRun => testRun.testRunId)
    );
    group.reviewCount += input.reviews.filter(review =>
      sessionTestRunIds.has(review.testRunId)
    ).length;
    if (!latestRun) {
      group.notStartedCount += 1;
    } else if (latestRun.status === "running") {
      group.runningCount += 1;
    } else if (latestRun.status === "paused") {
      group.pausedCount += 1;
    } else if (latestRun.status === "completed") {
      group.completedCount += 1;
    } else {
      group.notStartedCount += 1;
    }

    const latestSessionActivity =
      sessionRuns.map(testRun => testRun.updatedAt).sort().at(-1) ??
      participantSession.createdAt;
    if (
      !group.latestActivityAt ||
      latestSessionActivity.localeCompare(group.latestActivityAt) > 0
    ) {
      group.latestActivityAt = latestSessionActivity;
    }
    groupsByKey.set(groupKey, group);
  }
  const sessionLoginKeys = new Set(
    input.participantSessions.map(participantSession => participantSession.loginKey)
  );
  const sessionsByLoginKey = new Map<string, ParticipantSession[]>();
  for (const participantSession of input.participantSessions) {
    const sessions = sessionsByLoginKey.get(participantSession.loginKey) ?? [];
    sessions.push(participantSession);
    sessionsByLoginKey.set(participantSession.loginKey, sessions);
  }
  for (const rosterEntry of input.participantRosterEntries) {
    const groupKey = rosterEntry.groupKey || "unknown-group";
    const group = groupsByKey.get(groupKey) ?? {
      groupKey,
      expectedParticipantCount: 0,
      rosterEntryCount: 0,
      participantSessionCount: 0,
      testRunCount: 0,
      notStartedCount: 0,
      runningCount: 0,
      pausedCount: 0,
      completedCount: 0,
      responseCount: 0,
      reviewCount: 0,
      latestActivityAt: null
    };

    group.rosterEntryCount += 1;
    if (!sessionLoginKeys.has(rosterEntry.loginKey)) {
      group.expectedParticipantCount += 1;
      group.notStartedCount += 1;
    }
    if (
      !group.latestActivityAt ||
      rosterEntry.importedAt.localeCompare(group.latestActivityAt) > 0
    ) {
      group.latestActivityAt = rosterEntry.importedAt;
    }
    groupsByKey.set(groupKey, group);
  }

  const groups = Array.from(groupsByKey.values()).sort((left, right) =>
    left.groupKey.localeCompare(right.groupKey)
  );
  const notStartedParticipants = input.participantRosterEntries
    .filter(rosterEntry => {
      const sessions = sessionsByLoginKey.get(rosterEntry.loginKey) ?? [];
      return (
        sessions.length === 0 ||
        sessions.every(
          session => !latestRunsBySessionId.has(session.participantSessionId)
        )
      );
    })
    .sort(
      (left, right) =>
        left.groupKey.localeCompare(right.groupKey) ||
        (left.bookletKey ?? "").localeCompare(right.bookletKey ?? "") ||
        left.loginKey.localeCompare(right.loginKey)
    );

  const bookletProgress = buildStudyMonitorBookletProgress({
    participantSessions: input.participantSessions,
    participantRosterEntries: input.participantRosterEntries,
    testRuns: input.testRuns,
    contentReleases: input.contentReleases,
    reviews: input.reviews
  });
  const unitProgress = buildStudyMonitorUnitProgress({
    participantSessions: input.participantSessions,
    participantRosterEntries: input.participantRosterEntries,
    testRuns: input.testRuns,
    contentReleases: input.contentReleases
  });

  return {
    tenantKey: input.tenantKey,
    workspaceKey: input.workspaceKey,
    generatedAt: input.generatedAt,
    expectedParticipantCount: groups.reduce(
      (total, group) => total + group.expectedParticipantCount,
      0
    ),
    rosterEntryCount: input.participantRosterEntries.length,
    participantSessionCount: input.participantSessions.length,
    testRunCount: input.testRuns.length,
    notStartedCount: groups.reduce((total, group) => total + group.notStartedCount, 0),
    runningCount: groups.reduce((total, group) => total + group.runningCount, 0),
    pausedCount: groups.reduce((total, group) => total + group.pausedCount, 0),
    completedCount: groups.reduce((total, group) => total + group.completedCount, 0),
    responseCount: groups.reduce((total, group) => total + group.responseCount, 0),
    reviewCount: groups.reduce((total, group) => total + group.reviewCount, 0),
    notStartedParticipants,
    groups,
    bookletProgress,
    unitProgress,
    attentionItems: buildStudyMonitorAttentionItems({
      groups,
      bookletProgress,
      unitProgress
    })
  };
};

const buildStudyMonitorParticipantMatrix = (input: {
  tenantKey: string;
  workspaceKey: string;
  generatedAt: string;
  participantSessions: ParticipantSession[];
  participantRosterEntries: ParticipantRosterEntry[];
  testRuns: TestRun[];
  contentReleases: ContentRelease[];
  reviews: WorkspaceReview[];
}): WorkspaceStudyMonitorParticipantMatrix => {
  const latestRunsBySessionId = getLatestTestRunByParticipantSessionId(input.testRuns);
  const rosterEntriesByLoginKey = new Map(
    input.participantRosterEntries.map(rosterEntry => [
      rosterEntry.loginKey,
      rosterEntry
    ])
  );
  const contentReleasesById = new Map(
    input.contentReleases.map(contentRelease => [
      contentRelease.contentReleaseId,
      contentRelease
    ])
  );
  const reviewsByRunAndUnit = new Map<string, number>();
  for (const review of input.reviews) {
    const key = `${review.testRunId}\u0000${review.unitKey ?? ""}`;
    reviewsByRunAndUnit.set(key, (reviewsByRunAndUnit.get(key) ?? 0) + 1);
  }

  const findBooklet = (
    bookletKey: string | null | undefined,
    preferredContentRelease?: ContentRelease | null
  ): ContentReleaseRuntimeSnapshot["bookletEntries"][number] | null => {
    const normalizedBookletKey = bookletKey?.trim();
    if (!normalizedBookletKey) {
      return null;
    }

    return (
      preferredContentRelease?.runtimeSnapshot.bookletEntries.find(
        bookletEntry => bookletEntry.bookletKey === normalizedBookletKey
      ) ??
      input.contentReleases
        .flatMap(contentRelease => contentRelease.runtimeSnapshot.bookletEntries)
        .find(bookletEntry => bookletEntry.bookletKey === normalizedBookletKey) ??
      null
    );
  };

  const createRows = (inputRow: {
    loginKey: string;
    groupKey: string;
    displayName: string | null;
    rosterBookletKey: string | null;
    participantSession: ParticipantSession | null;
    testRun: TestRun | null;
    booklet: ContentReleaseRuntimeSnapshot["bookletEntries"][number] | null;
    latestActivityAt: string | null;
  }): WorkspaceStudyMonitorParticipantMatrix["rows"] => {
    const expectedUnits = inputRow.testRun
      ? resolveVisibleBookletUnits(inputRow.booklet ?? undefined, inputRow.testRun)
      : inputRow.booklet?.unitEntries ?? [];
    const responseUnitKeys = Object.keys(inputRow.testRun?.unitResponses ?? {});
    const unitEntries =
      expectedUnits.length > 0
        ? expectedUnits
        : responseUnitKeys.map(unitKey => ({
            unitKey,
            displayLabel: unitKey
          }));
    const expectedUnitKeys = new Set(expectedUnits.map(unit => unit.unitKey));
    const units =
      unitEntries.length > 0
        ? unitEntries
        : [
            {
              unitKey: "",
              displayLabel: ""
            }
          ];

    return units.map(unit => {
      const response =
        inputRow.testRun?.unitResponses[unit.unitKey] ?? null;
      const reviewCount = inputRow.testRun
        ? reviewsByRunAndUnit.get(`${inputRow.testRun.testRunId}\u0000${unit.unitKey}`) ??
          0
        : 0;

      return {
        tenantKey: input.tenantKey,
        workspaceKey: input.workspaceKey,
        loginKey: inputRow.loginKey,
        groupKey: inputRow.groupKey,
        displayName: inputRow.displayName,
        rosterBookletKey: inputRow.rosterBookletKey,
        participantSessionId:
          inputRow.participantSession?.participantSessionId ?? null,
        participantSessionStatus:
          inputRow.participantSession?.status ?? "not_started",
        testRunId: inputRow.testRun?.testRunId ?? null,
        testRunStatus: inputRow.testRun?.status ?? "not_started",
        bookletKey:
          inputRow.testRun?.bookletKey ??
          inputRow.rosterBookletKey ??
          inputRow.booklet?.bookletKey ??
          null,
        unitKey: unit.unitKey,
        unitLabel: unit.displayLabel,
        expected:
          expectedUnitKeys.size === 0 ? inputRow.booklet == null : expectedUnitKeys.has(unit.unitKey),
        answered: response != null,
        responseLength: response?.length ?? 0,
        reviewCount,
        latestActivityAt: inputRow.latestActivityAt
      };
    });
  };

  const sessionRows = input.participantSessions.flatMap(participantSession => {
    const rosterEntry = rosterEntriesByLoginKey.get(participantSession.loginKey) ?? null;
    const latestRun =
      latestRunsBySessionId.get(participantSession.participantSessionId) ?? null;
    const contentRelease =
      (latestRun ? contentReleasesById.get(latestRun.contentReleaseId) : null) ??
      contentReleasesById.get(participantSession.contentReleaseId) ??
      null;
    const booklet = findBooklet(
      latestRun?.bookletKey ?? rosterEntry?.bookletKey,
      contentRelease
    );

    return createRows({
      loginKey: participantSession.loginKey,
      groupKey: participantSession.groupKey,
      displayName: rosterEntry?.displayName ?? null,
      rosterBookletKey: rosterEntry?.bookletKey ?? null,
      participantSession,
      testRun: latestRun,
      booklet,
      latestActivityAt: latestRun?.updatedAt ?? participantSession.createdAt
    });
  });
  const sessionLoginKeys = new Set(
    input.participantSessions.map(participantSession => participantSession.loginKey)
  );
  const rosterOnlyRows = input.participantRosterEntries
    .filter(rosterEntry => !sessionLoginKeys.has(rosterEntry.loginKey))
    .flatMap(rosterEntry => {
      const booklet = findBooklet(rosterEntry.bookletKey, null);
      return createRows({
        loginKey: rosterEntry.loginKey,
        groupKey: rosterEntry.groupKey,
        displayName: rosterEntry.displayName,
        rosterBookletKey: rosterEntry.bookletKey,
        participantSession: null,
        testRun: null,
        booklet,
        latestActivityAt: rosterEntry.importedAt
      });
    });

  const rows = [...sessionRows, ...rosterOnlyRows].sort(
    (left, right) =>
      left.groupKey.localeCompare(right.groupKey) ||
      left.loginKey.localeCompare(right.loginKey) ||
      (left.bookletKey ?? "").localeCompare(right.bookletKey ?? "") ||
      left.unitKey.localeCompare(right.unitKey)
  );

  return {
    tenantKey: input.tenantKey,
    workspaceKey: input.workspaceKey,
    generatedAt: input.generatedAt,
    rows
  };
};

const buildStudyMonitorParticipantDetail = (input: {
  tenantKey: string;
  workspaceKey: string;
  loginKey: string;
  generatedAt: string;
  participantSessions: ParticipantSession[];
  participantRosterEntries: ParticipantRosterEntry[];
  testRuns: TestRun[];
  contentReleases: ContentRelease[];
  reviews: WorkspaceReview[];
}): WorkspaceStudyMonitorParticipantDetail => {
  const loginKey = input.loginKey.trim();
  const rosterEntry =
    input.participantRosterEntries.find(entry => entry.loginKey === loginKey) ??
    null;
  const sessions = input.participantSessions
    .filter(participantSession => participantSession.loginKey === loginKey)
    .sort(
      (left, right) =>
        right.createdAt.localeCompare(left.createdAt) ||
        right.participantSessionId.localeCompare(left.participantSessionId)
    );
  const participantSessionIds = new Set(
    sessions.map(participantSession => participantSession.participantSessionId)
  );
  const testRuns = input.testRuns
    .map(normalizeTestRun)
    .filter(testRun => participantSessionIds.has(testRun.participantSessionId))
    .sort(
      (left, right) =>
        right.updatedAt.localeCompare(left.updatedAt) ||
        right.testRunId.localeCompare(left.testRunId)
    );
  const testRunIds = new Set(testRuns.map(testRun => testRun.testRunId));
  const reviews = input.reviews.filter(review => testRunIds.has(review.testRunId));
  const sessionsById = new Map(
    sessions.map(participantSession => [
      participantSession.participantSessionId,
      participantSession
    ])
  );
  const matrix = buildStudyMonitorParticipantMatrix({
    tenantKey: input.tenantKey,
    workspaceKey: input.workspaceKey,
    generatedAt: input.generatedAt,
    participantSessions: sessions,
    participantRosterEntries: rosterEntry ? [rosterEntry] : [],
    testRuns,
    contentReleases: input.contentReleases,
    reviews
  });
  const latestActivityAt =
    testRuns.map(testRun => testRun.updatedAt).sort().at(-1) ??
    sessions.map(participantSession => participantSession.createdAt).sort().at(-1) ??
    rosterEntry?.importedAt ??
    null;

  return {
    tenantKey: input.tenantKey,
    workspaceKey: input.workspaceKey,
    loginKey,
    groupKey: rosterEntry?.groupKey ?? sessions[0]?.groupKey ?? null,
    displayName: rosterEntry?.displayName ?? null,
    rosterBookletKey: rosterEntry?.bookletKey ?? null,
    generatedAt: input.generatedAt,
    rosterEntry,
    participantSessionCount: sessions.length,
    testRunCount: testRuns.length,
    responseCount: testRuns.reduce(
      (total, testRun) => total + Object.keys(testRun.unitResponses).length,
      0
    ),
    reviewCount: reviews.length,
    latestActivityAt,
    sessions,
    testRuns: testRuns.map(testRun => ({
      testRun,
      participantSession:
        sessionsById.get(testRun.participantSessionId) ?? null,
      responseCount: Object.keys(testRun.unitResponses).length,
      reviewCount: reviews.filter(review => review.testRunId === testRun.testRunId)
        .length
    })),
    unitRows: matrix.rows
  };
};

const buildStudyMonitorGroupDetail = (input: {
  tenantKey: string;
  workspaceKey: string;
  groupKey: string;
  generatedAt: string;
  participantSessions: ParticipantSession[];
  participantRosterEntries: ParticipantRosterEntry[];
  testRuns: TestRun[];
  contentReleases: ContentRelease[];
  reviews: WorkspaceReview[];
}): WorkspaceStudyMonitorGroupDetail => {
  const groupRosterEntries = input.participantRosterEntries
    .filter(rosterEntry => rosterEntry.groupKey === input.groupKey)
    .sort((left, right) => left.loginKey.localeCompare(right.loginKey));
  const groupParticipantSessions = input.participantSessions
    .filter(participantSession => participantSession.groupKey === input.groupKey)
    .sort((left, right) => left.loginKey.localeCompare(right.loginKey));
  const groupRosterEntriesByLoginKey = new Map(
    groupRosterEntries.map(rosterEntry => [rosterEntry.loginKey, rosterEntry])
  );
  const groupParticipantSessionsById = new Map(
    groupParticipantSessions.map(participantSession => [
      participantSession.participantSessionId,
      participantSession
    ])
  );
  const groupParticipantSessionIds = new Set(
    groupParticipantSessions.map(
      participantSession => participantSession.participantSessionId
    )
  );
  const groupTestRuns = input.testRuns
    .filter(testRun => groupParticipantSessionIds.has(testRun.participantSessionId))
    .map(normalizeTestRun)
    .sort(
      (left, right) =>
        right.updatedAt.localeCompare(left.updatedAt) ||
        right.testRunId.localeCompare(left.testRunId)
    );
  const groupTestRunIds = new Set(groupTestRuns.map(testRun => testRun.testRunId));
  const groupReviews = input.reviews.filter(review =>
    groupTestRunIds.has(review.testRunId)
  );
  const latestRunsBySessionId =
    getLatestTestRunByParticipantSessionId(groupTestRuns);
  const testRunsBySessionId = new Map<string, TestRun[]>();
  for (const testRun of groupTestRuns) {
    const sessionRuns = testRunsBySessionId.get(testRun.participantSessionId) ?? [];
    sessionRuns.push(testRun);
    testRunsBySessionId.set(testRun.participantSessionId, sessionRuns);
  }

  const countResponses = (testRuns: TestRun[]): number =>
    testRuns.reduce(
      (total, testRun) => total + Object.keys(testRun.unitResponses).length,
      0
    );
  const countReviews = (testRunIds: Set<string>): number =>
    groupReviews.filter(review => testRunIds.has(review.testRunId)).length;
  const sessions = groupParticipantSessions.map(participantSession => {
    const sessionRuns =
      testRunsBySessionId.get(participantSession.participantSessionId) ?? [];
    const sessionTestRunIds = new Set(sessionRuns.map(testRun => testRun.testRunId));
    const latestActivityAt =
      sessionRuns.map(testRun => testRun.updatedAt).sort().at(-1) ??
      participantSession.createdAt;

    return {
      participantSession,
      participantRosterEntry:
        groupRosterEntriesByLoginKey.get(participantSession.loginKey) ?? null,
      latestTestRun:
        latestRunsBySessionId.get(participantSession.participantSessionId) ??
        null,
      testRunCount: sessionRuns.length,
      responseCount: countResponses(sessionRuns),
      reviewCount: countReviews(sessionTestRunIds),
      latestActivityAt
    };
  });
  const notStartedCount = sessions.filter(
    session =>
      !session.latestTestRun || session.latestTestRun.status === "created"
  ).length;
  const runningCount = sessions.filter(
    session => session.latestTestRun?.status === "running"
  ).length;
  const pausedCount = sessions.filter(
    session => session.latestTestRun?.status === "paused"
  ).length;
  const completedCount = sessions.filter(
    session => session.latestTestRun?.status === "completed"
  ).length;
  const sessionLoginKeys = new Set(
    groupParticipantSessions.map(participantSession => participantSession.loginKey)
  );
  const rosterOnlyCount = groupRosterEntries.filter(
    rosterEntry => !sessionLoginKeys.has(rosterEntry.loginKey)
  ).length;

  return {
    tenantKey: input.tenantKey,
    workspaceKey: input.workspaceKey,
    groupKey: input.groupKey,
    generatedAt: input.generatedAt,
    expectedParticipantCount: groupParticipantSessions.length + rosterOnlyCount,
    rosterEntryCount: groupRosterEntries.length,
    participantSessionCount: groupParticipantSessions.length,
    testRunCount: groupTestRuns.length,
    notStartedCount: notStartedCount + rosterOnlyCount,
    runningCount,
    pausedCount,
    completedCount,
    responseCount: countResponses(groupTestRuns),
    reviewCount: groupReviews.length,
    rosterEntries: groupRosterEntries,
    sessions,
    testRuns: groupTestRuns.map(testRun => {
      const participantSession =
        groupParticipantSessionsById.get(testRun.participantSessionId) ?? null;

      return {
        testRun,
        participantSession,
        participantRosterEntry: participantSession
          ? groupRosterEntriesByLoginKey.get(participantSession.loginKey) ?? null
          : null,
        responseCount: Object.keys(testRun.unitResponses).length,
        reviewCount: groupReviews.filter(
          review => review.testRunId === testRun.testRunId
        ).length
      };
    }),
    unitProgress: buildStudyMonitorUnitProgress({
      participantSessions: groupParticipantSessions,
      participantRosterEntries: groupRosterEntries,
      testRuns: groupTestRuns,
      contentReleases: input.contentReleases
    })
  };
};

const buildStudyMonitorBookletDetail = (input: {
  tenantKey: string;
  workspaceKey: string;
  bookletKey: string;
  generatedAt: string;
  participantSessions: ParticipantSession[];
  participantRosterEntries: ParticipantRosterEntry[];
  testRuns: TestRun[];
  contentReleases: ContentRelease[];
  reviews: WorkspaceReview[];
}): WorkspaceStudyMonitorBookletDetail => {
  const bookletKey = input.bookletKey.trim();
  const participantSessionsById = new Map(
    input.participantSessions.map(participantSession => [
      participantSession.participantSessionId,
      participantSession
    ])
  );
  const contentReleasesById = new Map(
    input.contentReleases.map(contentRelease => [
      contentRelease.contentReleaseId,
      contentRelease
    ])
  );
  const bookletTestRuns = input.testRuns
    .map(normalizeTestRun)
    .filter(testRun => testRun.bookletKey === bookletKey)
    .sort(
      (left, right) =>
        right.updatedAt.localeCompare(left.updatedAt) ||
        right.testRunId.localeCompare(left.testRunId)
    );
  const participantSessionIds = new Set(
    bookletTestRuns.map(testRun => testRun.participantSessionId)
  );
  const sessionLoginKeys = new Set(
    bookletTestRuns
      .map(testRun => participantSessionsById.get(testRun.participantSessionId))
      .filter((participantSession): participantSession is ParticipantSession =>
        Boolean(participantSession)
      )
      .map(participantSession => participantSession.loginKey)
  );
  const bookletRosterEntries = input.participantRosterEntries
    .filter(rosterEntry => rosterEntry.bookletKey?.trim() === bookletKey)
    .sort(
      (left, right) =>
        left.loginKey.localeCompare(right.loginKey) ||
        left.participantRosterEntryId.localeCompare(right.participantRosterEntryId)
    );
  const bookletRosterEntriesByLoginKey = new Map(
    bookletRosterEntries.map(rosterEntry => [rosterEntry.loginKey, rosterEntry])
  );
  const rosterOnlyCount = bookletRosterEntries.filter(
    rosterEntry => !sessionLoginKeys.has(rosterEntry.loginKey)
  ).length;
  const bookletReviews = input.reviews.filter(review =>
    bookletTestRuns.some(testRun => testRun.testRunId === review.testRunId)
  );
  const booklet =
    bookletTestRuns
      .map(testRun => {
        const participantSession = participantSessionsById.get(
          testRun.participantSessionId
        );
        const contentRelease =
          contentReleasesById.get(testRun.contentReleaseId) ??
          (participantSession
            ? contentReleasesById.get(participantSession.contentReleaseId)
            : undefined);
        return contentRelease?.runtimeSnapshot.bookletEntries.find(
          bookletEntry => bookletEntry.bookletKey === bookletKey
        );
      })
      .find(Boolean) ??
    input.contentReleases
      .flatMap(contentRelease => contentRelease.runtimeSnapshot.bookletEntries)
      .find(bookletEntry => bookletEntry.bookletKey === bookletKey) ??
    null;

  return {
    tenantKey: input.tenantKey,
    workspaceKey: input.workspaceKey,
    bookletKey,
    displayLabel: booklet?.displayLabel ?? bookletKey,
    generatedAt: input.generatedAt,
    expectedParticipantCount: participantSessionIds.size + rosterOnlyCount,
    rosterEntryCount: bookletRosterEntries.length,
    participantSessionCount: participantSessionIds.size,
    testRunCount: bookletTestRuns.length,
    notStartedCount: rosterOnlyCount,
    createdCount: bookletTestRuns.filter(testRun => testRun.status === "created")
      .length,
    runningCount: bookletTestRuns.filter(testRun => testRun.status === "running")
      .length,
    pausedCount: bookletTestRuns.filter(testRun => testRun.status === "paused").length,
    completedCount: bookletTestRuns.filter(testRun => testRun.status === "completed")
      .length,
    responseCount: bookletTestRuns.reduce(
      (total, testRun) => total + Object.keys(testRun.unitResponses).length,
      0
    ),
    reviewCount: bookletReviews.length,
    unitCount: booklet?.unitEntries.length ?? 0,
    rosterEntries: bookletRosterEntries,
    testRuns: bookletTestRuns.map(testRun => {
      const participantSession =
        participantSessionsById.get(testRun.participantSessionId) ?? null;

      return {
        testRun,
        participantSession,
        participantRosterEntry: participantSession
          ? bookletRosterEntriesByLoginKey.get(participantSession.loginKey) ?? null
          : null,
        responseCount: Object.keys(testRun.unitResponses).length,
        reviewCount: bookletReviews.filter(
          review => review.testRunId === testRun.testRunId
        ).length
      };
    }),
    unitProgress: buildStudyMonitorUnitProgress({
      participantSessions: input.participantSessions,
      participantRosterEntries: bookletRosterEntries,
      testRuns: bookletTestRuns,
      contentReleases: input.contentReleases
    })
  };
};

const buildStudyMonitorUnitDetail = (input: {
  tenantKey: string;
  workspaceKey: string;
  unitKey: string;
  generatedAt: string;
  participantSessions: ParticipantSession[];
  participantRosterEntries: ParticipantRosterEntry[];
  testRuns: TestRun[];
  contentReleases: ContentRelease[];
  reviews: WorkspaceReview[];
}): WorkspaceStudyMonitorUnitDetail => {
  const normalizedUnitKey = input.unitKey.trim();
  const participantSessionsById = new Map(
    input.participantSessions.map(participantSession => [
      participantSession.participantSessionId,
      participantSession
    ])
  );
  const rosterEntriesByLoginKey = new Map(
    input.participantRosterEntries.map(rosterEntry => [
      rosterEntry.loginKey,
      rosterEntry
    ])
  );
  const contentReleasesById = new Map(
    input.contentReleases.map(contentRelease => [
      contentRelease.contentReleaseId,
      contentRelease
    ])
  );
  const runLoginKeysByBookletKey = new Map<string, Set<string>>();
  for (const testRun of input.testRuns.map(normalizeTestRun)) {
    const participantSession = participantSessionsById.get(
      testRun.participantSessionId
    );
    if (!participantSession) {
      continue;
    }
    const runLoginKeys =
      runLoginKeysByBookletKey.get(testRun.bookletKey) ?? new Set<string>();
    runLoginKeys.add(participantSession.loginKey);
    runLoginKeysByBookletKey.set(testRun.bookletKey, runLoginKeys);
  }
  const displayLabel =
    input.contentReleases
      .flatMap(contentRelease => contentRelease.runtimeSnapshot.bookletEntries)
      .flatMap(booklet => booklet.unitEntries)
      .find(unit => unit.unitKey === normalizedUnitKey)?.displayLabel ??
    normalizedUnitKey;

  const testRuns = input.testRuns
    .map(normalizeTestRun)
    .flatMap(testRun => {
      const participantSession =
        participantSessionsById.get(testRun.participantSessionId) ?? null;
      const contentRelease =
        contentReleasesById.get(testRun.contentReleaseId) ??
        (participantSession
          ? contentReleasesById.get(participantSession.contentReleaseId)
          : undefined);
      const booklet = contentRelease?.runtimeSnapshot.bookletEntries.find(
        bookletEntry => bookletEntry.bookletKey === testRun.bookletKey
      );
      const expected = resolveVisibleBookletUnits(booklet, testRun).some(
        unitEntry => unitEntry.unitKey === normalizedUnitKey
      );
      const response = testRun.unitResponses[normalizedUnitKey] ?? null;
      const answered = response != null;

      if (!expected && !answered) {
        return [];
      }

      return [
        {
          testRun,
          participantSession,
          participantRosterEntry: participantSession
            ? rosterEntriesByLoginKey.get(participantSession.loginKey) ?? null
            : null,
          expected,
          answered,
          response,
          responseLength: response?.length ?? 0,
          reviewCount: input.reviews.filter(
            review =>
              review.testRunId === testRun.testRunId &&
              review.unitKey === normalizedUnitKey
          ).length
        }
      ];
    })
    .sort(
      (left, right) =>
        right.testRun.updatedAt.localeCompare(left.testRun.updatedAt) ||
        (left.participantSession?.loginKey ?? "").localeCompare(
          right.participantSession?.loginKey ?? ""
      )
    );

  const rosterEntries = input.participantRosterEntries
    .filter(rosterEntry => {
      const bookletKey = rosterEntry.bookletKey?.trim();
      if (
        !bookletKey ||
        runLoginKeysByBookletKey.get(bookletKey)?.has(rosterEntry.loginKey)
      ) {
        return false;
      }
      return input.contentReleases
        .flatMap(contentRelease => contentRelease.runtimeSnapshot.bookletEntries)
        .some(
          bookletEntry =>
            bookletEntry.bookletKey === bookletKey &&
            bookletEntry.unitEntries.some(
              unitEntry => unitEntry.unitKey === normalizedUnitKey
            )
        );
    })
    .sort(
      (left, right) =>
        left.loginKey.localeCompare(right.loginKey) ||
        left.participantRosterEntryId.localeCompare(right.participantRosterEntryId)
    );
  const rosterExpectedCount = rosterEntries.length;
  const runExpectedCount = testRuns.filter(item => item.expected).length;
  const runMissingResponseCount = testRuns.filter(
    item => item.expected && !item.answered
  ).length;

  return {
    tenantKey: input.tenantKey,
    workspaceKey: input.workspaceKey,
    unitKey: normalizedUnitKey,
    displayLabel,
    generatedAt: input.generatedAt,
    rosterExpectedCount,
    expectedRunCount: runExpectedCount + rosterExpectedCount,
    responseCount: testRuns.filter(item => item.answered).length,
    missingResponseCount: runMissingResponseCount + rosterExpectedCount,
    unexpectedResponseCount: testRuns.filter(
      item => !item.expected && item.answered
    ).length,
    completedRunCount: testRuns.filter(
      item => item.testRun.status === "completed"
    ).length,
    reviewCount: testRuns.reduce((total, item) => total + item.reviewCount, 0),
    rosterEntries,
    testRuns
  };
};

const buildStudyMonitorRunDetail = (input: {
  tenantKey: string;
  workspaceKey: string;
  testRunId: string;
  generatedAt: string;
  participantSessions: ParticipantSession[];
  participantRosterEntries: ParticipantRosterEntry[];
  testRuns: TestRun[];
  contentReleases: ContentRelease[];
  reviews: WorkspaceReview[];
}): WorkspaceStudyMonitorRunDetail | null => {
  const testRun =
    input.testRuns
      .map(normalizeTestRun)
      .find(candidate => candidate.testRunId === input.testRunId.trim()) ?? null;
  if (!testRun) {
    return null;
  }

  const participantSession =
    input.participantSessions.find(
      candidate =>
        candidate.participantSessionId === testRun.participantSessionId
    ) ?? null;
  const participantRosterEntry = participantSession
    ? input.participantRosterEntries.find(
        candidate => candidate.loginKey === participantSession.loginKey
      ) ?? null
    : null;
  const contentRelease =
    input.contentReleases.find(
      candidate => candidate.contentReleaseId === testRun.contentReleaseId
    ) ??
    (participantSession
      ? input.contentReleases.find(
          candidate =>
            candidate.contentReleaseId === participantSession.contentReleaseId
        )
      : null) ??
    null;
  const booklet =
    contentRelease?.runtimeSnapshot.bookletEntries.find(
      candidate => candidate.bookletKey === testRun.bookletKey
    ) ??
    input.contentReleases
      .flatMap(candidate => candidate.runtimeSnapshot.bookletEntries)
      .find(candidate => candidate.bookletKey === testRun.bookletKey) ??
    null;
  const expectedUnits = resolveVisibleBookletUnits(booklet ?? undefined, testRun);
  const expectedUnitKeys = new Set(expectedUnits.map(unit => unit.unitKey));
  const responseUnitKeys = Object.keys(testRun.unitResponses);
  const unexpectedUnitKeys = responseUnitKeys.filter(
    unitKey => !expectedUnitKeys.has(unitKey)
  );
  const unitEntries = [
    ...expectedUnits,
    ...unexpectedUnitKeys.map(unitKey => ({
      unitKey,
      displayLabel: unitKey
    }))
  ];
  const runReviews = input.reviews
    .filter(review => review.testRunId === testRun.testRunId)
    .sort(
      (left, right) =>
        right.updatedAt.localeCompare(left.updatedAt) ||
        right.reviewId.localeCompare(left.reviewId)
    );
  const reviewCountByUnitKey = new Map<string, number>();
  for (const review of runReviews) {
    const unitKey = review.unitKey ?? "";
    reviewCountByUnitKey.set(unitKey, (reviewCountByUnitKey.get(unitKey) ?? 0) + 1);
  }
  const units = unitEntries.map(unit => {
    const response = testRun.unitResponses[unit.unitKey] ?? null;

    return {
      unitKey: unit.unitKey,
      displayLabel: unit.displayLabel,
      expected: expectedUnitKeys.has(unit.unitKey),
      answered: response != null,
      response,
      responseLength: response?.length ?? 0,
      reviewCount: reviewCountByUnitKey.get(unit.unitKey) ?? 0,
      current: testRun.currentUnitKey === unit.unitKey
    };
  });
  const answeredExpectedUnitCount = units.filter(
    unit => unit.expected && unit.answered
  ).length;

  return {
    tenantKey: input.tenantKey,
    workspaceKey: input.workspaceKey,
    generatedAt: input.generatedAt,
    testRun,
    participantSession,
    participantRosterEntry,
    bookletKey: testRun.bookletKey,
    bookletLabel: booklet?.displayLabel ?? testRun.bookletKey,
    adaptiveStates: resolveAdaptiveStates(booklet ?? undefined, testRun),
    testletTimers: buildMonitorTestletTimers(
      contentRelease,
      testRun,
      input.generatedAt
    ),
    responseCount: responseUnitKeys.length,
    reviewCount: runReviews.length,
    expectedUnitCount: expectedUnits.length,
    answeredExpectedUnitCount,
    missingExpectedUnitCount: Math.max(
      expectedUnits.length - answeredExpectedUnitCount,
      0
    ),
    unexpectedResponseCount: unexpectedUnitKeys.length,
    units,
    reviews: runReviews
  };
};

export const createFirstSliceServices = (
  dependencies: FirstSliceDependencies
): FirstSliceServices => {
  const repository = dependencies.repository;
  const idGenerator = dependencies.idGenerator ?? randomUUID;
  const rawNow = dependencies.now ?? (() => new Date().toISOString());
  let lastTimestampMs = 0;
  const now = (): string => {
    const rawTimestamp = rawNow();
    const timestampMs = Date.parse(rawTimestamp);
    if (!Number.isFinite(timestampMs)) {
      return rawTimestamp;
    }

    const nextTimestampMs = Math.max(timestampMs, lastTimestampMs + 1);
    lastTimestampMs = nextTimestampMs;
    return new Date(nextTimestampMs).toISOString();
  };
  const adminSessionTtlMs = dependencies.adminSessionTtlMs ?? ADMIN_SESSION_TTL_MS;
  const adminLoginMaxFailures =
    dependencies.adminLoginMaxFailures ?? DEFAULT_ADMIN_LOGIN_MAX_FAILURES;
  const adminLoginFailureWindowMs =
    dependencies.adminLoginFailureWindowMs ??
    DEFAULT_ADMIN_LOGIN_FAILURE_WINDOW_MS;
  const participantAccessTimeZone =
    dependencies.participantAccessTimeZone ??
    DEFAULT_PARTICIPANT_ACCESS_TIME_ZONE;
  const participantLoginMaxFailures =
    dependencies.participantLoginMaxFailures ??
    DEFAULT_PARTICIPANT_LOGIN_MAX_FAILURES;
  const participantLoginFailureWindowMs =
    dependencies.participantLoginFailureWindowMs ??
    DEFAULT_PARTICIPANT_LOGIN_FAILURE_WINDOW_MS;
  if (!Number.isInteger(adminLoginMaxFailures) || adminLoginMaxFailures <= 0) {
    throw new Error("adminLoginMaxFailures must be a positive integer.");
  }
  if (
    !Number.isInteger(adminLoginFailureWindowMs) ||
    adminLoginFailureWindowMs <= 0
  ) {
    throw new Error("adminLoginFailureWindowMs must be a positive integer.");
  }
  if (
    !Number.isInteger(participantLoginMaxFailures) ||
    participantLoginMaxFailures <= 0
  ) {
    throw new Error("participantLoginMaxFailures must be a positive integer.");
  }
  if (
    !Number.isInteger(participantLoginFailureWindowMs) ||
    participantLoginFailureWindowMs <= 0
  ) {
    throw new Error("participantLoginFailureWindowMs must be a positive integer.");
  }
  try {
    readTimeZoneParts(Date.now(), participantAccessTimeZone);
  } catch {
    throw new Error(
      `Invalid participant access timezone '${participantAccessTimeZone}'.`
    );
  }

  const recordWorkspaceActivity = async (input: {
    activityEventId?: string;
    tenantId: string;
    workspaceId: string;
    eventType: WorkspaceActivityEvent["eventType"];
    actorId?: string | null;
    subjectType: WorkspaceActivityEvent["subjectType"];
    subjectId: string;
    summary: string;
    details?: Record<string, unknown>;
  }): Promise<void> => {
    await repository.saveWorkspaceActivityEvent({
      activityEventId: input.activityEventId ?? idGenerator(),
      tenantId: input.tenantId,
      workspaceId: input.workspaceId,
      eventType: input.eventType,
      actorId: input.actorId ?? null,
      subjectType: input.subjectType,
      subjectId: input.subjectId,
      occurredAt: now(),
      summary: input.summary,
      details: input.details ?? {}
    });
  };

  const requireAttachmentAccess = async (input: {
    sessionToken: string;
    tenantKey: string;
    workspaceKey: string;
    write: boolean;
  }): Promise<{
    workspace: Workspace;
    actorAdminUserId: string;
    groupKeys: string[] | null;
  }> => {
    const currentSession = await requireActiveAdminSession(
      repository,
      input.sessionToken,
      now()
    );
    const workspace = await requireWorkspace(
      repository,
      input.tenantKey,
      input.workspaceKey
    );
    const fullScopeAssignments = currentSession.roleAssignments.filter(
      roleAssignment =>
        roleAssignment.role === "platform_admin" ||
        (roleAssignment.role === "tenant_admin" &&
          roleAssignment.tenantId === workspace.tenantId) ||
        ((roleAssignment.role === "workspace_admin" ||
          roleAssignment.role === "study_monitor") &&
          roleAssignment.workspaceId === workspace.workspaceId)
    );
    const groupScopeAssignments = currentSession.roleAssignments.filter(
      roleAssignment =>
        roleAssignment.role === "group_monitor" &&
        roleAssignment.workspaceId === workspace.workspaceId &&
        Boolean(roleAssignment.groupKey)
    );
    const applicableAssignments =
      fullScopeAssignments.length > 0
        ? fullScopeAssignments
        : groupScopeAssignments;

    if (applicableAssignments.length === 0) {
      throw new FirstSliceError(
        403,
        "attachment_management_role_required",
        "Attachment management requires administration or monitor access to the workspace."
      );
    }
    if (
      input.write &&
      !applicableAssignments.some(
        roleAssignment => roleAssignment.accessMode === "read_write"
      )
    ) {
      throw new FirstSliceError(
        403,
        "attachment_management_write_role_required",
        "Uploading or deleting attachment files requires read-write workspace access."
      );
    }

    return {
      workspace,
      actorAdminUserId: currentSession.adminUser.adminUserId,
      groupKeys:
        fullScopeAssignments.length > 0
          ? null
          : [
              ...new Set(
                groupScopeAssignments.flatMap(roleAssignment =>
                  roleAssignment.groupKey ? [roleAssignment.groupKey] : []
                )
              )
            ].sort()
    };
  };

  const buildWorkspaceAttachments = async (
    workspace: Workspace
  ): Promise<WorkspaceAttachment[]> => {
    const [attachmentFiles, testRuns, participantSessions, rosterEntries, releases] =
      await Promise.all([
        repository.listAttachmentFilesByWorkspace(
          workspace.tenantId,
          workspace.workspaceId
        ),
        repository.listTestRunsByWorkspace(
          workspace.tenantId,
          workspace.workspaceId
        ),
        repository.listParticipantSessionsByWorkspace(
          workspace.tenantId,
          workspace.workspaceId
        ),
        repository.listParticipantRosterEntriesByWorkspace(
          workspace.tenantId,
          workspace.workspaceId
        ),
        repository.listContentReleasesByWorkspace(
          workspace.tenantId,
          workspace.workspaceId
        )
      ]);
    const sessionsById = new Map(
      participantSessions.map(session => [session.participantSessionId, session])
    );
    const releasesById = new Map(
      releases.map(release => [release.contentReleaseId, release])
    );
    const filesByAttachmentId = new Map<string, AttachmentFile[]>();
    for (const attachmentFile of attachmentFiles) {
      const files = filesByAttachmentId.get(attachmentFile.attachmentId) ?? [];
      files.push(attachmentFile);
      filesByAttachmentId.set(attachmentFile.attachmentId, files);
    }

    return testRuns
      .flatMap(testRun => {
        const participantSession = sessionsById.get(testRun.participantSessionId);
        const contentRelease = releasesById.get(testRun.contentReleaseId);
        const booklet = contentRelease?.runtimeSnapshot.bookletEntries.find(
          candidate => candidate.bookletKey === testRun.bookletKey
        );
        if (!participantSession || !booklet) {
          return [];
        }
        const rosterEntry = rosterEntries.find(
          candidate =>
            candidate.loginKey === participantSession.loginKey &&
            candidate.groupKey === participantSession.groupKey
        );

        return booklet.unitEntries.flatMap(unitEntry =>
          (unitEntry.requestedAttachments ?? []).map(request => {
            const attachmentId = `att-${Buffer.from(
              JSON.stringify([
                testRun.testRunId,
                unitEntry.unitKey,
                request.variableId
              ]),
              "utf8"
            ).toString("base64url")}`;
            const files = (filesByAttachmentId.get(attachmentId) ?? []).sort(
              (left, right) =>
                left.createdAt.localeCompare(right.createdAt) ||
                left.attachmentFileId.localeCompare(right.attachmentFileId)
            );
            const latestFile = files.at(-1);
            const lastModified = latestFile
              ? Date.parse(latestFile.createdAt)
              : null;

            return {
              attachmentId,
              tenantId: workspace.tenantId,
              workspaceId: workspace.workspaceId,
              participantSessionId: participantSession.participantSessionId,
              testRunId: testRun.testRunId,
              groupKey: participantSession.groupKey,
              loginKey: participantSession.loginKey,
              personLabel:
                rosterEntry?.displayName?.trim() || participantSession.loginKey,
              bookletKey: booklet.bookletKey,
              testLabel: booklet.displayLabel,
              unitKey: unitEntry.unitKey,
              unitLabel: unitEntry.displayLabel,
              variableId: request.variableId,
              attachmentType: request.attachmentType,
              dataType: files.length > 0 ? "image" : "missing",
              attachmentFileIds: files.map(file => file.attachmentFileId),
              lastModified:
                lastModified !== null && Number.isFinite(lastModified)
                  ? lastModified
                  : null
            } satisfies WorkspaceAttachment;
          })
        );
      })
      .sort(
        (left, right) =>
          left.groupKey.localeCompare(right.groupKey) ||
          left.loginKey.localeCompare(right.loginKey) ||
          left.bookletKey.localeCompare(right.bookletKey) ||
          left.unitKey.localeCompare(right.unitKey) ||
          left.variableId.localeCompare(right.variableId) ||
          left.attachmentId.localeCompare(right.attachmentId)
      );
  };

  const requireScopedAttachment = async (input: {
    workspace: Workspace;
    groupKeys: string[] | null;
    attachmentId: string;
  }): Promise<WorkspaceAttachment> => {
    const attachment = (await buildWorkspaceAttachments(input.workspace)).find(
      candidate => candidate.attachmentId === input.attachmentId.trim()
    );
    if (!attachment) {
      throw new FirstSliceError(
        404,
        "attachment_not_found",
        "The requested attachment was not found."
      );
    }
    if (input.groupKeys && !input.groupKeys.includes(attachment.groupKey)) {
      throw new FirstSliceError(
        403,
        "attachment_group_scope_forbidden",
        "The attachment is outside the monitor's assigned groups."
      );
    }
    return attachment;
  };

  const normalizeAttachmentFileInput = (input: {
    fileName: string;
    mediaType: string;
    dataBase64: string;
  }): {
    fileName: string;
    mediaType: AttachmentFile["mediaType"];
    dataBase64: string;
    extension: "jpg" | "png";
  } => {
    const mediaType = input.mediaType.trim().toLowerCase();
    if (mediaType !== "image/jpeg" && mediaType !== "image/png") {
      throw new FirstSliceError(
        400,
        "attachment_media_type_invalid",
        "Attachment files must be PNG or JPEG images."
      );
    }
    const dataBase64 = input.dataBase64.replace(/\s+/g, "");
    if (
      !dataBase64 ||
      !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(
        dataBase64
      )
    ) {
      throw new FirstSliceError(
        400,
        "attachment_data_invalid",
        "Attachment image data must be valid base64."
      );
    }
    const bytes = Buffer.from(dataBase64, "base64");
    if (bytes.length > 10 * 1024 * 1024) {
      throw new FirstSliceError(
        413,
        "attachment_file_too_large",
        "Attachment images must not exceed 10 MiB."
      );
    }
    const validSignature =
      mediaType === "image/png"
        ? bytes.length >= 8 &&
          bytes.subarray(0, 8).equals(
            Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
          )
        : bytes.length >= 3 &&
          bytes[0] === 0xff &&
          bytes[1] === 0xd8 &&
          bytes[2] === 0xff;
    if (!validSignature) {
      throw new FirstSliceError(
        400,
        "attachment_image_signature_invalid",
        "Attachment image data does not match its declared media type."
      );
    }
    const fileName = input.fileName.trim().split(/[\\/]/).at(-1)?.trim() ?? "";
    if (!fileName || fileName.length > 255) {
      throw new FirstSliceError(
        400,
        "attachment_file_name_invalid",
        "Attachment filenames must contain between 1 and 255 characters."
      );
    }

    return {
      fileName,
      mediaType,
      dataBase64,
      extension: mediaType === "image/png" ? "png" : "jpg"
    };
  };

  const buildParticipantTestLogs = (input: {
    testRun: TestRun;
    deliveryId?: string;
    batches: Array<{
      unitKey?: string | null;
      originalUnitId?: string | null;
      entries: ParticipantTestLogEntryInput[];
    }>;
  }): ParticipantTestLog[] => {
    if (!Array.isArray(input.batches) || input.batches.length > 20) {
      throw new FirstSliceError(
        400,
        "participant_test_logs_invalid",
        "At most 20 participant test-log batches may be saved at once."
      );
    }
    const entryCount = input.batches.reduce(
      (count, batch) => count + (Array.isArray(batch.entries) ? batch.entries.length : 201),
      0
    );
    if (entryCount > 200) {
      throw new FirstSliceError(
        400,
        "participant_test_logs_invalid",
        "At most 200 participant test-log entries may be saved at once."
      );
    }
    let entryIndex = 0;
    return input.batches.flatMap(batch => {
      if (!Array.isArray(batch.entries)) {
        throw new FirstSliceError(
          400,
          "participant_test_logs_invalid",
          "Participant test-log entries must be an array."
        );
      }
      const unitKey =
        batch.unitKey == null ? null : String(batch.unitKey).trim() || null;
      const originalUnitId =
        batch.originalUnitId == null
          ? unitKey
          : String(batch.originalUnitId).trim() || unitKey;
      return batch.entries.map(entry => {
        const logKey = typeof entry?.key === "string" ? entry.key.trim() : "";
        const logContent =
          entry?.content == null ? "" : String(entry.content);
        if (!logKey || logKey.length > 200) {
          throw new FirstSliceError(
            400,
            "participant_test_log_key_invalid",
            "Participant test-log keys must contain between 1 and 200 characters."
          );
        }
        if (logContent.length > 32_768) {
          throw new FirstSliceError(
            400,
            "participant_test_log_content_too_large",
            "Participant test-log content must not exceed 32768 characters."
          );
        }
        if (
          !Number.isSafeInteger(entry.timeStamp) ||
          entry.timeStamp < 0 ||
          entry.timeStamp > 8_640_000_000_000_000
        ) {
          throw new FirstSliceError(
            400,
            "participant_test_log_timestamp_invalid",
            "Participant test-log timestamps must be valid non-negative Unix millisecond values."
          );
        }
        return {
          participantTestLogId: input.deliveryId
            ? `delivery:${input.testRun.testRunId}:${input.deliveryId}:log:${entryIndex++}`
            : idGenerator(),
          tenantId: input.testRun.tenantId,
          workspaceId: input.testRun.workspaceId,
          participantSessionId: input.testRun.participantSessionId,
          testRunId: input.testRun.testRunId,
          unitKey,
          originalUnitId,
          logKey,
          logContent,
          timestamp: entry.timeStamp,
          recordedAt: now()
        } satisfies ParticipantTestLog;
      });
    });
  };

  const requireAccessibleParticipantSession = async (
    participantSessionId: string
  ): Promise<ParticipantSession> => {
    const participantSession = await requireParticipantSession(
      repository,
      participantSessionId
    );
    const rosterEntry = await findParticipantRosterEntryByLoginKey(
      repository,
      participantSession.tenantId,
      participantSession.workspaceId,
      participantSession.loginKey
    );
    assertParticipantAccessWindow(
      rosterEntry,
      now(),
      participantSession.validUntil
    );
    return participantSession;
  };

  const requireParticipantReviewContext = async (
    rawTestRunId: string
  ): Promise<{
    participantSession: ParticipantSession;
    testRun: TestRun;
    contentRelease: ContentRelease;
  }> => {
    const testRunId = normalizeTestRunId(rawTestRunId);
    const storedTestRun = await repository.getTestRunById(testRunId);
    if (!storedTestRun) {
      throw new FirstSliceError(
        404,
        "test_run_not_found",
        `Test run '${testRunId}' was not found.`
      );
    }
    const testRun = normalizeTestRun(storedTestRun);
    requireParticipantTestRunUnlocked(testRun);
    const participantSession = await requireAccessibleParticipantSession(
      testRun.participantSessionId
    );
    const executionMode = resolveParticipantExecutionMode(
      testRun.executionMode ?? participantSession.executionMode
    );
    if (!executionMode.canReview) {
      throw new FirstSliceError(
        403,
        "participant_review_not_allowed",
        `Execution mode '${executionMode.mode}' does not allow participant reviews.`
      );
    }
    const contentRelease = await requireContentRelease(
      repository,
      testRun.contentReleaseId
    );
    return { participantSession, testRun, contentRelease };
  };

  const requireParticipantOwnedReview = async (input: {
    testRun: TestRun;
    reviewId: string;
  }): Promise<WorkspaceReview> => {
    const reviewId = String(input.reviewId ?? "").trim();
    const review = reviewId
      ? await repository.getWorkspaceReviewById(reviewId)
      : null;
    if (
      !review ||
      review.testRunId !== input.testRun.testRunId ||
      review.participantSessionId !== input.testRun.participantSessionId
    ) {
      throw new FirstSliceError(
        404,
        "participant_review_not_found",
        `Participant review '${reviewId}' was not found for test run '${input.testRun.testRunId}'.`
      );
    }
    return review;
  };

  const resolveParticipantReviewReviewerId = (
    value: unknown,
    fallbackLoginKey: string
  ): string => {
    if (value == null || (typeof value === "string" && !value.trim())) {
      return fallbackLoginKey;
    }
    return normalizeReviewText(
      value,
      "reviewerId",
      "review_reviewer_required"
    );
  };

  const persistEffectiveTestletTimerState = async (input: {
    contentRelease: ContentRelease;
    testRun: TestRun;
    timestamp: string;
  }): Promise<TestRun> => {
    const normalizedRun = normalizeTestRun(input.testRun);
    if (
      !resolveParticipantExecutionMode(normalizedRun.executionMode)
        .forceTimeRestrictions
    ) {
      return normalizedRun;
    }
    const reconciled = reconcileExpiredTestletTimers(
      input.contentRelease,
      normalizedRun,
      input.timestamp
    );
    const activated = activateCurrentTestletTimer(
      input.contentRelease,
      reconciled.testRun,
      input.timestamp
    );
    const effectiveRun = activated.testRun;
    const changed =
      effectiveRun !== normalizedRun ||
      reconciled.expiredTestletKeys.length > 0 ||
      activated.startedTestletKey != null;
    if (changed) {
      await repository.saveTestRun(effectiveRun);
    }
    if (
      resolveParticipantExecutionMode(effectiveRun.executionMode).saveResponses &&
      (reconciled.expiredTestletKeys.length > 0 || activated.startedTestletKey)
    ) {
      const timerStateEntries: ParticipantTestLogEntryInput[] = [];
      if (reconciled.expiredTestletKeys.length > 0) {
        timerStateEntries.push(
          buildTestletTimeLeftTestStateEntry(
            reconciled.testRun,
            input.timestamp
          )
        );
      }
      if (activated.startedTestletKey) {
        timerStateEntries.push(
          buildTestletTimeLeftTestStateEntry(effectiveRun, input.timestamp)
        );
      }
      await repository.saveParticipantTestLogs(
        buildParticipantTestLogs({
          testRun: effectiveRun,
          batches: [{ entries: timerStateEntries }]
        })
      );
    }
    if (activated.startedTestletKey) {
      const timer = effectiveRun.testletTimers?.[activated.startedTestletKey];
      await recordWorkspaceActivity({
        tenantId: effectiveRun.tenantId,
        workspaceId: effectiveRun.workspaceId,
        eventType: "testlet_timer_started",
        subjectType: "test_run",
        subjectId: effectiveRun.testRunId,
        summary: `Timed block '${activated.startedTestletKey}' started for run '${effectiveRun.testRunId}'.`,
        details: {
          testletKey: activated.startedTestletKey,
          durationSeconds: timer?.durationSeconds ?? null,
          expiresAt: timer?.expiresAt ?? null,
          currentUnitKey: effectiveRun.currentUnitKey
        }
      });
    }
    for (const testletKey of reconciled.expiredTestletKeys) {
      await recordWorkspaceActivity({
        tenantId: effectiveRun.tenantId,
        workspaceId: effectiveRun.workspaceId,
        eventType: "testlet_timer_expired",
        subjectType: "test_run",
        subjectId: effectiveRun.testRunId,
        summary: `Timed block '${testletKey}' expired for run '${effectiveRun.testRunId}'.`,
        details: {
          testletKey,
          currentUnitKey: effectiveRun.currentUnitKey,
          runStatus: effectiveRun.status
        }
      });
    }
    if (
      input.testRun.status !== "completed" &&
      effectiveRun.status === "completed"
    ) {
      const participantSession = await repository.getParticipantSessionById(
        effectiveRun.participantSessionId
      );
      if (participantSession) {
        await repository.saveParticipantSession({
          ...participantSession,
          status: await resolveParticipantSessionStatusAfterCompletion(
            repository,
            participantSession
          )
        });
      }
      await recordWorkspaceActivity({
        tenantId: effectiveRun.tenantId,
        workspaceId: effectiveRun.workspaceId,
        eventType: "test_run_completed",
        subjectType: "test_run",
        subjectId: effectiveRun.testRunId,
        summary: `Run '${effectiveRun.testRunId}' completed after its final timed block expired.`,
        details: {
          completedAt: effectiveRun.completedAt,
          reason: "testlet_timer_expired"
        }
      });
    }
    return effectiveRun;
  };

  const importParticipantRosterDocumentsForWorkspace = async (input: {
    tenantKey: string;
    workspaceKey: string;
    rosterDocuments: ParticipantRosterDocument[];
    sourcePackageId?: string;
    importJobId?: string;
  }) => {
    const workspace = await requireWorkspace(
      repository,
      input.tenantKey,
      input.workspaceKey
    );
    const parsedEntries = [] as ReturnType<typeof parseParticipantRosterText>;
    const operationalLoginCandidates = [] as OriginalTestcenterOperationalLoginCandidate[];

    for (const rosterDocument of input.rosterDocuments) {
      if (
        typeof rosterDocument.rosterText === "string" &&
        rosterDocument.rosterText.trimStart().startsWith("<")
      ) {
        const xmlDiagnostics = validateTestcenterXmlSourceDocument(
          rosterDocument.rosterText,
          rosterDocument.sourceFileName
        );
        if (xmlDiagnostics.some(diagnostic => diagnostic.severity === "error")) {
          throw new FirstSliceError(
            400,
            "participant_roster_xml_invalid",
            `Participant roster '${rosterDocument.sourceFileName}' failed Original Testcenter compatibility validation.`,
            { diagnostics: xmlDiagnostics }
          );
        }
      }
      parsedEntries.push(
        ...parseParticipantRosterText(rosterDocument.rosterText)
      );
      operationalLoginCandidates.push(
        ...parseOriginalTestcenterOperationalLogins(rosterDocument.rosterText)
      );
    }

    if (parsedEntries.length === 0 && operationalLoginCandidates.length === 0) {
      throw new FirstSliceError(
        400,
        "participant_roster_empty",
        "Participant roster did not contain any participant login entries."
      );
    }

    const seenLoginKeys = new Set<string>();
    for (const loginKey of [
      ...parsedEntries.map(entry => entry.loginKey),
      ...operationalLoginCandidates.map(candidate => candidate.loginKey)
    ]) {
      const normalizedLoginKey = loginKey.toLocaleLowerCase("en-US");
      if (seenLoginKeys.has(normalizedLoginKey)) {
        throw new FirstSliceError(
          400,
          "participant_roster_login_duplicate",
          `Participant roster contains duplicate login '${loginKey}'.`
        );
      }
      seenLoginKeys.add(normalizedLoginKey);
    }

    const normalizedParsedEntries = parsedEntries.map(parsedEntry => {
      const validFrom = normalizeParticipantAccessBoundary(
        parsedEntry.validFrom,
        participantAccessTimeZone
      );
      const validTo = normalizeParticipantAccessBoundary(
        parsedEntry.validTo,
        participantAccessTimeZone
      );
      if (parsedEntry.validFrom && !validFrom) {
        throw new FirstSliceError(
          400,
          "participant_roster_valid_from_invalid",
          `Participant '${parsedEntry.loginKey}' has an invalid valid-from timestamp.`
        );
      }
      if (parsedEntry.validTo && !validTo) {
        throw new FirstSliceError(
          400,
          "participant_roster_valid_to_invalid",
          `Participant '${parsedEntry.loginKey}' has an invalid valid-to timestamp.`
        );
      }
      if (validFrom && validTo && Date.parse(validFrom) > Date.parse(validTo)) {
        throw new FirstSliceError(
          400,
          "participant_roster_access_window_invalid",
          `Participant '${parsedEntry.loginKey}' has a valid-from timestamp after valid-to.`
        );
      }
      return { parsedEntry, validFrom, validTo };
    });

    const existingEntries =
      await repository.listParticipantRosterEntriesByWorkspace(
        workspace.tenantId,
        workspace.workspaceId
      );
    const entriesByLoginKey = new Map(
      existingEntries.map(entry => [entry.loginKey, entry])
    );
    let importedCount = 0;
    let updatedCount = 0;

    for (const { parsedEntry, validFrom, validTo } of normalizedParsedEntries) {
      const existingEntry = entriesByLoginKey.get(parsedEntry.loginKey);
      const participantRosterEntry: ParticipantRosterEntry = {
        participantRosterEntryId:
          existingEntry?.participantRosterEntryId ?? idGenerator(),
        tenantId: workspace.tenantId,
        workspaceId: workspace.workspaceId,
        loginKey: parsedEntry.loginKey,
        executionMode:
          parsedEntry.executionMode ??
          existingEntry?.executionMode ??
          defaultParticipantExecutionMode,
        groupKey: parsedEntry.groupKey,
        bookletKey: parsedEntry.bookletKey,
        ...(parsedEntry.bookletKeys?.length
          ? { bookletKeys: parsedEntry.bookletKeys }
          : {}),
        ...(parsedEntry.bookletStatePresets
          ? { bookletStatePresets: parsedEntry.bookletStatePresets }
          : {}),
        ...(parsedEntry.bookletAssignments?.length
          ? { bookletAssignments: parsedEntry.bookletAssignments }
          : {}),
        displayName: parsedEntry.displayName,
        passwordRequired: Boolean(parsedEntry.password),
        validFrom,
        validTo,
        validForMinutes: parsedEntry.validForMinutes ?? null,
        customTexts: parsedEntry.customTexts ?? {},
        importedAt: now()
      };

      await repository.saveParticipantRosterEntry(
        participantRosterEntry,
        parsedEntry.password ? hashPassword(parsedEntry.password) : null
      );
      entriesByLoginKey.set(parsedEntry.loginKey, participantRosterEntry);
      if (existingEntry) {
        updatedCount += 1;
      } else {
        importedCount += 1;
      }
    }

    const participantSessions =
      await repository.listParticipantSessionsByWorkspace(
        workspace.tenantId,
        workspace.workspaceId
      );
    const accessStartedAtByLoginAndCode = new Map<string, string>();
    for (const participantSession of participantSessions) {
      const accessKey = `${participantSession.loginKey}\u0000${participantSession.participantCode ?? ""}`;
      const currentStartedAt = accessStartedAtByLoginAndCode.get(accessKey);
      if (
        !currentStartedAt ||
        participantSession.createdAt.localeCompare(currentStartedAt) < 0
      ) {
        accessStartedAtByLoginAndCode.set(accessKey, participantSession.createdAt);
      }
    }
    for (const participantSession of participantSessions) {
      const rosterEntry = entriesByLoginKey.get(participantSession.loginKey);
      if (!rosterEntry) {
        continue;
      }
      const validUntil = resolveParticipantSessionValidUntil(
        rosterEntry,
        accessStartedAtByLoginAndCode.get(
          `${participantSession.loginKey}\u0000${participantSession.participantCode ?? ""}`
        ) ?? participantSession.createdAt
      );
      if (validUntil !== participantSession.validUntil) {
        await repository.saveParticipantSession({
          ...participantSession,
          validUntil
        });
      }
    }

    await repository.replaceOperationalLoginMigrationCandidatesByWorkspace(
      workspace.tenantId,
      workspace.workspaceId,
      operationalLoginCandidates
    );

    const migrationOnly = parsedEntries.length === 0;
    await recordWorkspaceActivity({
      tenantId: workspace.tenantId,
      workspaceId: workspace.workspaceId,
      eventType: "participant_roster_imported",
      subjectType: "workspace",
      subjectId: workspace.workspaceId,
      summary: migrationOnly
        ? `Classified ${operationalLoginCandidates.length} operational login candidate${operationalLoginCandidates.length === 1 ? "" : "s"} for explicit account migration.`
        : `Imported ${importedCount} and updated ${updatedCount} participant roster entries.`,
      details: {
        importedCount,
        updatedCount,
        parsedCount: parsedEntries.length,
        migrationOnly,
        operationalLoginCandidateCount: operationalLoginCandidates.length,
        ...(input.sourcePackageId
          ? {
              sourcePackageId: input.sourcePackageId,
              importJobId: input.importJobId ?? null,
              sourceFileNames: input.rosterDocuments.map(
                rosterDocument => rosterDocument.sourceFileName
              )
            }
          : {})
      }
    });

    return {
      importedCount,
      updatedCount,
      operationalLoginCandidates,
      items: buildParticipantRosterReadItems(
        Array.from(entriesByLoginKey.values()),
        await getActiveWorkspaceRelease(
          repository,
          workspace.tenantId,
          workspace.workspaceId
        )
      )
    };
  };

  const recordAdminAuditEvent = async (input: {
    eventType: AdminAuditEvent["eventType"];
    actorAdminUserId?: string | null;
    subjectAdminUserId?: string | null;
    summary: string;
    details?: Record<string, unknown>;
  }): Promise<void> => {
    await repository.saveAdminAuditEvent({
      adminAuditEventId: idGenerator(),
      eventType: input.eventType,
      actorAdminUserId: input.actorAdminUserId ?? null,
      subjectAdminUserId: input.subjectAdminUserId ?? null,
      occurredAt: now(),
      summary: input.summary,
      details: input.details ?? {}
    });
  };

  const createImportJobWithRelease = async (input: {
    tenantKey: string;
    workspaceKey: string;
    sourcePackageId: string;
  }, options: {
    resolveWorkspaceDependencies?: boolean;
  } = {}): Promise<CreateImportJobResult> => {
    const workspace = await requireWorkspace(
      repository,
      input.tenantKey,
      input.workspaceKey
    );
    const sourcePackage = await requireSourcePackage(repository, input.sourcePackageId);

    if (
      sourcePackage.tenantId !== workspace.tenantId ||
      sourcePackage.workspaceId !== workspace.workspaceId
    ) {
      throw new FirstSliceError(
        409,
        "source_package_workspace_mismatch",
        `Source package '${input.sourcePackageId}' does not belong to workspace '${input.workspaceKey}'.`
      );
    }

    const standaloneImportResolution = buildRuntimeSnapshot(sourcePackage);
    let workspaceDependencyDiagnostic: ImportJobDiagnostic | null = null;
    if (
      options.resolveWorkspaceDependencies !== false &&
      standaloneImportResolution.runtimeSnapshot
    ) {
      const workspaceSourcePackages =
        await repository.listSourcePackagesByWorkspace(
          workspace.tenantId,
          workspace.workspaceId
        );
      const workspaceDependencyResolution =
        resolveWorkspaceDependencySourcePackages({
          rootSourcePackage: sourcePackage,
          workspaceSourcePackages
        });
      if (workspaceDependencyResolution.status === "blocked") {
        workspaceDependencyDiagnostic = workspaceDependencyResolution.diagnostic;
      }
      if (workspaceDependencyResolution.status === "resolved") {
        const { archive, members } = assembleSourcePackageArchive(
          workspaceDependencyResolution.sourcePackages
        );
        const sourceBaseName = (sourcePackage.fileName
          .replace(/\\/g, "/")
          .split("/")
          .at(-1) ?? sourcePackage.fileName)
          .replace(/\.[^.]+$/, "")
          .trim() || "workspace-source";
        const dependencySnapshot: SourcePackage = {
          sourcePackageId: idGenerator(),
          tenantId: workspace.tenantId,
          workspaceId: workspace.workspaceId,
          fileName: `${sourceBaseName}.workspace-dependencies.zip`,
          mediaType: "application/zip",
          contentStructure: null,
          sourceDocument: `data:application/zip;base64,${archive.toString("base64")}`,
          status: "uploaded",
          uploadedAt: now()
        };
        await repository.saveSourcePackage(dependencySnapshot);
        await recordWorkspaceActivity({
          tenantId: workspace.tenantId,
          workspaceId: workspace.workspaceId,
          eventType: "source_package_assembled",
          subjectType: "source_package",
          subjectId: dependencySnapshot.sourcePackageId,
          summary: `Workspace dependencies for '${sourcePackage.fileName}' resolved into immutable package '${dependencySnapshot.fileName}'.`,
          details: {
            fileName: dependencySnapshot.fileName,
            sizeBytes: archive.length,
            assemblyMode: "workspace_dependencies",
            rootSourcePackageId: sourcePackage.sourcePackageId,
            sourcePackages: members.map(member => ({
              sourcePackageId: member.sourcePackageId,
              fileName: member.fileName,
              sizeBytes: member.bytes.length
            }))
          }
        });
        return createImportJobWithRelease(
          {
            tenantKey: input.tenantKey,
            workspaceKey: input.workspaceKey,
            sourcePackageId: dependencySnapshot.sourcePackageId
          },
          { resolveWorkspaceDependencies: false }
        );
      }
    }

    const timestamp = now();
    const importJob: ImportJob = {
      importJobId: idGenerator(),
      tenantId: workspace.tenantId,
      workspaceId: workspace.workspaceId,
      sourcePackageId: sourcePackage.sourcePackageId,
      status: "completed",
      createdAt: timestamp,
      finishedAt: null,
      diagnostics: []
    };
    const importResolution = workspaceDependencyDiagnostic
      ? {
          runtimeSnapshot: null,
          diagnostics: [workspaceDependencyDiagnostic]
        }
      : standaloneImportResolution;

    const failImport = async (
      diagnostics: ImportJobDiagnostic[]
    ): Promise<CreateImportJobResult> => {
      const failedImportJob: ImportJob = {
        ...importJob,
        status: "failed",
        finishedAt: timestamp,
        diagnostics
      };

      await repository.saveImportJob(failedImportJob);
      await repository.saveSourcePackage({
        ...sourcePackage,
        status: "rejected"
      });
      await recordWorkspaceActivity({
        tenantId: workspace.tenantId,
        workspaceId: workspace.workspaceId,
        eventType: "import_job_failed",
        subjectType: "import_job",
        subjectId: failedImportJob.importJobId,
        summary: `Import failed for '${sourcePackage.fileName}'.`,
        details: {
          sourcePackageId: sourcePackage.sourcePackageId,
          diagnostics: failedImportJob.diagnostics
        }
      });

      return {
        importJob: failedImportJob,
        stagedContentRelease: null
      };
    };

    if (!importResolution.runtimeSnapshot) {
      return failImport(importResolution.diagnostics);
    }

    const rosterDocuments =
      extractTesttakersRosterDocumentsFromZipSourcePackage(sourcePackage);
    let participantRosterImport: ParticipantRosterImportSummary | undefined;
    if (rosterDocuments.length > 0) {
      try {
        const rosterImport =
          await importParticipantRosterDocumentsForWorkspace({
            tenantKey: input.tenantKey,
            workspaceKey: input.workspaceKey,
            rosterDocuments,
            sourcePackageId: sourcePackage.sourcePackageId,
            importJobId: importJob.importJobId
          });
        participantRosterImport = {
          sourceFileNames: rosterDocuments.map(
            rosterDocument => rosterDocument.sourceFileName
          ),
          importedCount: rosterImport.importedCount,
          updatedCount: rosterImport.updatedCount,
          operationalLoginCandidateCount:
            rosterImport.operationalLoginCandidates.length
        };
      } catch (error) {
        if (!(error instanceof FirstSliceError)) {
          throw error;
        }
        return failImport([
          createImportDiagnostic(
            "source_document_testtakers_import_failed",
            `Testtakers import failed compatibility validation (${error.errorCode}).`
          )
        ]);
      }
    }

    const completedImportJob: ImportJob = {
      ...importJob,
      status: "completed",
      finishedAt: timestamp,
      diagnostics: importResolution.diagnostics
    };
    if (importResolution.runtimeSnapshot.bookletEntries.length === 0) {
      await repository.saveImportJob(completedImportJob);
      await repository.saveSourcePackage({
        ...sourcePackage,
        contentStructure: {
          bookletEntries: [],
          ...(importResolution.runtimeSnapshot.playerEntries?.length
            ? {
                playerEntries: importResolution.runtimeSnapshot.playerEntries
              }
            : {}),
          systemCheckEntries:
            importResolution.runtimeSnapshot.systemCheckEntries ?? []
        },
        status: "accepted"
      });
      await recordWorkspaceActivity({
        tenantId: workspace.tenantId,
        workspaceId: workspace.workspaceId,
        eventType: "import_job_completed",
        subjectType: "import_job",
        subjectId: completedImportJob.importJobId,
        summary: `System-check definition import completed for '${sourcePackage.fileName}'.`,
        details: {
          sourcePackageId: sourcePackage.sourcePackageId,
          contentReleaseId: null,
          systemCheckCount:
            importResolution.runtimeSnapshot.systemCheckEntries?.length ?? 0,
          diagnostics: completedImportJob.diagnostics
        }
      });
      return {
        importJob: completedImportJob,
        stagedContentRelease: null,
        ...(participantRosterImport ? { participantRosterImport } : {})
      };
    }
    const stagedContentRelease: ContentRelease = {
      contentReleaseId: idGenerator(),
      tenantId: workspace.tenantId,
      workspaceId: workspace.workspaceId,
      importJobId: completedImportJob.importJobId,
      releaseLabel: `${sourcePackage.fileName} import`,
      runtimeSnapshot: importResolution.runtimeSnapshot,
      status: "staged",
      createdAt: timestamp,
      activatedAt: null
    };

    await repository.saveImportJob(completedImportJob);
    await repository.saveContentRelease(stagedContentRelease);
    await repository.saveSourcePackage({
      ...sourcePackage,
      status: "accepted"
    });
    await recordWorkspaceActivity({
      tenantId: workspace.tenantId,
      workspaceId: workspace.workspaceId,
      eventType: "import_job_completed",
      subjectType: "import_job",
      subjectId: completedImportJob.importJobId,
      summary: `Import completed for '${sourcePackage.fileName}'.`,
      details: {
        sourcePackageId: sourcePackage.sourcePackageId,
        contentReleaseId: stagedContentRelease.contentReleaseId,
        participantRosterImport: participantRosterImport ?? null,
        diagnostics: completedImportJob.diagnostics
      }
    });

    return {
      importJob: completedImportJob,
      stagedContentRelease,
      ...(participantRosterImport ? { participantRosterImport } : {})
    };
  };

  const listWorkspaceSystemChecks = async (input: {
    tenantKey: string;
    workspaceKey: string;
  }): Promise<WorkspaceSystemCheck[]> => {
    const workspace = await requireWorkspace(
      repository,
      input.tenantKey,
      input.workspaceKey
    );
    const sourcePackages = (
      await repository.listSourcePackagesByWorkspace(
        workspace.tenantId,
        workspace.workspaceId
      )
    )
      .filter(sourcePackage => sourcePackage.status === "accepted")
      .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt));
    const releases = (
      await repository.listContentReleasesByWorkspace(
        workspace.tenantId,
        workspace.workspaceId
      )
    ).sort((left, right) =>
      (right.activatedAt ?? right.createdAt).localeCompare(
        left.activatedAt ?? left.createdAt
      )
    );
    const resolveUnit = (
      systemCheck: SourcePackageSystemCheckEntry,
      sourcePackage: SourcePackage
    ): WorkspaceSystemCheck["unit"] => {
      if (!systemCheck.unitKey) {
        return null;
      }
      if (
        systemCheck.unitEntry &&
        systemCheck.unitEntry.unitKey.toUpperCase() ===
          systemCheck.unitKey.toUpperCase()
      ) {
        const player = sourcePackage.contentStructure?.playerEntries?.find(
          entry => entry.playerKey === systemCheck.unitEntry?.playerKey
        );
        return {
          unitKey: systemCheck.unitEntry.unitKey,
          displayLabel: systemCheck.unitEntry.displayLabel,
          ...(systemCheck.unitEntry.playerKey
            ? { playerKey: systemCheck.unitEntry.playerKey }
            : {}),
          ...(player?.html ? { playerHtml: player.html } : {}),
          ...(systemCheck.unitEntry.unitDefinition
            ? { unitDefinition: systemCheck.unitEntry.unitDefinition }
            : {}),
          ...(systemCheck.unitEntry.unitDefinitionType
            ? {
                unitDefinitionType:
                  systemCheck.unitEntry.unitDefinitionType
              }
            : {})
        };
      }
      for (const release of releases) {
        for (const booklet of release.runtimeSnapshot.bookletEntries) {
          const unit = booklet.unitEntries.find(
            entry => entry.unitKey.toUpperCase() === systemCheck.unitKey?.toUpperCase()
          );
          if (unit) {
            const player = release.runtimeSnapshot.playerEntries?.find(
              entry => entry.playerKey === unit.playerKey
            );
            return {
              unitKey: unit.unitKey,
              displayLabel: unit.displayLabel,
              ...(unit.playerKey ? { playerKey: unit.playerKey } : {}),
              ...(player?.html ? { playerHtml: player.html } : {}),
              ...(unit.unitDefinition
                ? { unitDefinition: unit.unitDefinition }
                : {}),
              ...(unit.unitDefinitionType
                ? { unitDefinitionType: unit.unitDefinitionType }
                : {})
            };
          }
        }
      }
      const orderedPackages = [
        sourcePackage,
        ...sourcePackages.filter(
          candidate => candidate.sourcePackageId !== sourcePackage.sourcePackageId
        )
      ];
      for (const candidate of orderedPackages) {
        for (const booklet of candidate.contentStructure?.bookletEntries ?? []) {
          const unit = booklet.unitEntries.find(
            entry => entry.unitKey.toUpperCase() === systemCheck.unitKey?.toUpperCase()
          );
          if (unit) {
            const player = candidate.contentStructure?.playerEntries?.find(
              entry => entry.playerKey === unit.playerKey
            );
            return {
              unitKey: unit.unitKey,
              displayLabel: unit.displayLabel,
              ...(unit.playerKey ? { playerKey: unit.playerKey } : {}),
              ...(player?.html ? { playerHtml: player.html } : {}),
              ...(unit.unitDefinition
                ? { unitDefinition: unit.unitDefinition }
                : {}),
              ...(unit.unitDefinitionType
                ? { unitDefinitionType: unit.unitDefinitionType }
                : {})
            };
          }
        }
      }
      return {
        unitKey: systemCheck.unitKey,
        displayLabel: systemCheck.unitKey
      };
    };
    const byCheckId = new Map<string, WorkspaceSystemCheck>();
    for (const sourcePackage of sourcePackages) {
      for (const systemCheck of sourcePackage.contentStructure?.systemCheckEntries ?? []) {
        const normalizedId = systemCheck.checkId.toUpperCase();
        if (byCheckId.has(normalizedId)) {
          continue;
        }
        const {
          saveKey: _saveKey,
          unitEntry: _unitEntry,
          ...publicDefinition
        } = systemCheck;
        byCheckId.set(normalizedId, {
          ...publicDefinition,
          sourcePackageId: sourcePackage.sourcePackageId,
          canSave: Boolean(systemCheck.saveKey),
          unit: resolveUnit(systemCheck, sourcePackage)
        });
      }
    }
    return Array.from(byCheckId.values()).sort((left, right) =>
      left.checkId.localeCompare(right.checkId)
    );
  };

  const requireWorkspaceSystemCheck = async (input: {
    tenantKey: string;
    workspaceKey: string;
    checkId: string;
  }): Promise<WorkspaceSystemCheck> => {
    const systemCheck = (await listWorkspaceSystemChecks(input)).find(
      item => item.checkId.toUpperCase() === input.checkId.trim().toUpperCase()
    );
    if (!systemCheck) {
      throw new FirstSliceError(
        404,
        "system_check_not_found",
        `System check '${input.checkId}' was not found in workspace '${input.workspaceKey}'.`
      );
    }
    return systemCheck;
  };

  const normalizeSystemCheckReportEntries = (
    section: string,
    entries: unknown
  ): SystemCheckReportEntry[] => {
    if (!Array.isArray(entries) || entries.length > 200) {
      throw new FirstSliceError(
        400,
        "system_check_report_invalid",
        `System-check report section '${section}' must contain at most 200 entries.`
      );
    }
    return entries.map((candidate, index) => {
      if (
        !candidate ||
        typeof candidate !== "object" ||
        Array.isArray(candidate)
      ) {
        throw new FirstSliceError(
          400,
          "system_check_report_invalid",
          `System-check report section '${section}' contains an invalid entry at index ${index}.`
        );
      }
      const entry = candidate as Record<string, unknown>;
      const label = String(entry.label ?? "").trim();
      if (!label) {
        throw new FirstSliceError(
          400,
          "system_check_report_invalid",
          `System-check report section '${section}' contains an invalid entry at index ${index}.`
        );
      }
      const value = entry.value;
      if (
        value !== null &&
        typeof value !== "string" &&
        typeof value !== "number" &&
        typeof value !== "boolean"
      ) {
        throw new FirstSliceError(
          400,
          "system_check_report_invalid",
          `System-check report value '${label}' must be scalar.`
        );
      }
      return {
        id: String(entry.id ?? index).trim() || String(index),
        type: String(entry.type ?? section).trim() || section,
        label,
        value,
        warning: Boolean(entry.warning)
      };
    });
  };

  const formatLegacySystemCheckDate = (timestamp: string): string => {
    const timestampMs = Date.parse(timestamp);
    if (!Number.isFinite(timestampMs)) {
      return timestamp;
    }
    const [year, month, day, hour, minute, second] = readTimeZoneParts(
      timestampMs,
      participantAccessTimeZone
    );
    const pad = (value: number): string => String(value).padStart(2, "0");
    return `${year}-${pad(month)}-${pad(day)} ${pad(hour)}:${pad(minute)}:${pad(second)}`;
  };

  const parseLegacySystemCheckDate = (value: string): string | null => {
    const normalized = value.trim();
    const localMatch =
      /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2}):(\d{2})$/.exec(
        normalized
      );
    if (localMatch) {
      return localDateTimeToIso(
        [
          Number(localMatch[1]),
          Number(localMatch[2]),
          Number(localMatch[3]),
          Number(localMatch[4]),
          Number(localMatch[5]),
          Number(localMatch[6])
        ],
        participantAccessTimeZone
      );
    }
    const timestampMs = Date.parse(normalized);
    return Number.isFinite(timestampMs) ? new Date(timestampMs).toISOString() : null;
  };

  const normalizeStoredSystemCheckReport = (
    report: SystemCheckReport
  ): SystemCheckReport => {
    const createdAt =
      String(report.createdAt ?? "").trim() || "1970-01-01T00:00:00.000Z";
    const systemCheckReportId = String(report.systemCheckReportId ?? "").trim();
    return {
      ...report,
      sourceDate:
        String(report.sourceDate ?? "").trim() ||
        formatLegacySystemCheckDate(createdAt),
      originalFileName:
        String(report.originalFileName ?? "").trim() ||
        `report_${systemCheckReportId || "unknown"}.json`,
      fileModifiedAt:
        String(report.fileModifiedAt ?? "").trim() || createdAt,
      createdAt
    };
  };

  const legacySystemCheckFileData = (
    report: SystemCheckReport
  ): Array<{ id: string; label: string; value: string }> => {
    const fileModifiedAt = report.fileModifiedAt ?? report.createdAt;
    const timestampMs = Date.parse(fileModifiedAt);
    return [
      {
        id: "date",
        label: "DatumTS",
        value: Number.isFinite(timestampMs)
          ? String(Math.floor(timestampMs / 1_000))
          : ""
      },
      {
        id: "datestr",
        label: "Datum",
        value: formatLegacySystemCheckDate(fileModifiedAt)
      },
      {
        id: "filename",
        label: "FileName",
        value:
          report.originalFileName ??
          `report_${report.systemCheckReportId}.json`
      }
    ];
  };

  const legacySystemCheckReportDocument = (report: SystemCheckReport) => ({
    date: report.sourceDate ?? formatLegacySystemCheckDate(report.createdAt),
    checkId: report.checkId,
    checkLabel: report.checkLabel,
    title: report.title,
    responses: report.responses,
    environment: report.environment,
    network: report.network,
    questionnaire: report.questionnaire,
    unit: report.unit,
    fileData: legacySystemCheckFileData(report)
  });

  const systemCheckReportMigrationDigest = (
    report: SystemCheckReport
  ): string =>
    createHash("sha256")
      .update(
        JSON.stringify({
          date: report.sourceDate ?? formatLegacySystemCheckDate(report.createdAt),
          checkId: report.checkId.toUpperCase(),
          checkLabel: report.checkLabel,
          title: report.title,
          responses: report.responses,
          environment: report.environment,
          network: report.network,
          questionnaire: report.questionnaire,
          unit: report.unit
        })
      )
      .digest("hex");

  const readSystemCheckReportRecords = async (input: {
    tenantKey: string;
    workspaceKey: string;
    checkId?: string;
    limit?: number;
  }): Promise<Array<{ activityEventId: string; report: SystemCheckReport }>> => {
    const workspace = await requireWorkspace(
      repository,
      input.tenantKey,
      input.workspaceKey
    );
    const limit = Math.max(1, Math.min(input.limit ?? 100, 500));
    const normalizedCheckId = input.checkId?.trim().toUpperCase();
    const events = await repository.listWorkspaceActivityEventsByWorkspace(
      workspace.tenantId,
      workspace.workspaceId
    );
    const records = events
      .filter(event => event.eventType === "system_check_report_saved")
      .flatMap(event => {
        const report = event.details.report;
        return report && typeof report === "object" && !Array.isArray(report)
          ? [{
              activityEventId: event.activityEventId,
              report: normalizeStoredSystemCheckReport(report as SystemCheckReport)
            }]
          : [];
      })
      .filter(
        record =>
          !normalizedCheckId ||
          record.report.checkId.toUpperCase() === normalizedCheckId
      )
      .sort((left, right) =>
        right.report.createdAt.localeCompare(left.report.createdAt)
      );
    return input.limit == null ? records : records.slice(0, limit);
  };

  const readSystemCheckReports = async (input: {
    tenantKey: string;
    workspaceKey: string;
    checkId?: string;
    limit?: number;
  }): Promise<SystemCheckReport[]> => {
    const records = await readSystemCheckReportRecords({
      ...input,
      limit: input.limit ?? 100
    });
    return records.map(record => record.report);
  };

  const buildSystemCheckReportStatistics = async (input: {
    tenantKey: string;
    workspaceKey: string;
    checkId?: string;
  }): Promise<SystemCheckReportStatistics[]> => {
    const reports = (await readSystemCheckReportRecords(input)).map(
      record => record.report
    );
    const breakdown = (values: string[]): Array<{ value: string; count: number }> => {
      const counts = new Map<string, number>();
      for (const rawValue of values) {
        const value = rawValue.trim() || "unknown";
        counts.set(value, (counts.get(value) ?? 0) + 1);
      }
      return Array.from(counts, ([value, count]) => ({ value, count })).sort(
        (left, right) => right.count - left.count || left.value.localeCompare(right.value)
      );
    };
    const entryValue = (
      report: SystemCheckReport,
      section: "environment" | "network",
      ids: string[],
      labels: string[]
    ): string => {
      const entry = report[section].find(
        candidate =>
          ids.includes(candidate.id.toLowerCase()) ||
          labels.includes(candidate.label.toLowerCase())
      );
      return String(entry?.value ?? "unknown");
    };
    const byCheckId = new Map<string, SystemCheckReport[]>();
    for (const report of reports) {
      const key = report.checkId.toUpperCase();
      byCheckId.set(key, [...(byCheckId.get(key) ?? []), report]);
    }
    return Array.from(byCheckId.values())
      .map(group => ({
        checkId: group[0].checkId,
        checkLabel: group[0].checkLabel,
        reportCount: group.length,
        latestReportAt: group[0].createdAt,
        operatingSystems: breakdown(
          group.map(report =>
            entryValue(report, "environment", ["os"], ["betriebssystem", "betriebsystem"])
          )
        ),
        browsers: breakdown(
          group.map(report => entryValue(report, "environment", ["browser"], ["browser"]))
        ),
        overallRatings: breakdown(
          group.map(report =>
            entryValue(report, "network", ["nw-overall"], ["gesamtbewertung"])
          )
        )
      }))
      .sort((left, right) => left.checkId.localeCompare(right.checkId));
  };

  const exportSystemCheckReportsCsv = async (input: {
    tenantKey: string;
    workspaceKey: string;
    checkId?: string;
    limit?: number;
  }): Promise<string> => {
    const reports = await readSystemCheckReports(input);
    const baseHeaders = [
      "Titel",
      "SysCheck-Id",
      "SysCheck",
      "Responses",
      "DatumTS",
      "Datum",
      "FileName"
    ];
    const dynamicHeaders: string[] = [];
    const rows = reports.map(report => {
      const values = new Map<string, unknown>([
        ["Titel", report.title],
        ["SysCheck-Id", report.checkId],
        ["SysCheck", report.checkLabel],
        [
          "Responses",
          report.responses == null ||
          report.responses === "" ||
          report.responses === false ||
          report.responses === 0 ||
          (Array.isArray(report.responses) && report.responses.length === 0)
            ? ""
            : JSON.stringify(report.responses)
        ],
        ...legacySystemCheckFileData(report).map(entry => [entry.label, entry.value] as const)
      ]);
      for (const entry of [
        ...report.environment,
        ...report.network,
        ...report.questionnaire,
        ...report.unit
      ]) {
        values.set(entry.label, entry.value);
        if (!baseHeaders.includes(entry.label) && !dynamicHeaders.includes(entry.label)) {
          dynamicHeaders.push(entry.label);
        }
      }
      return values;
    });
    const headers = [...baseHeaders, ...dynamicHeaders];
    const escapeSemicolonCsvCell = (value: unknown): string => {
      const text =
        typeof value === "boolean" ? (value ? "1" : "") : String(value ?? "");
      return `"${text.replace(/"/g, '""')}"`;
    };
    return `\uFEFF${[
      headers.map(escapeSemicolonCsvCell).join(";"),
      ...rows.map(row =>
        headers.map(header => escapeSemicolonCsvCell(row.get(header))).join(";")
      )
    ].join("\n")}`;
  };

  const exportSystemCheckReportsJson = async (input: {
    tenantKey: string;
    workspaceKey: string;
    checkId?: string;
    limit?: number;
  }): Promise<string> => {
    const reports = await readSystemCheckReports(input);
    return `${JSON.stringify(
      reports.map(legacySystemCheckReportDocument),
      null,
      2
    )}\n`;
  };

  const deleteWorkspaceGroupResults = async (input: {
    tenantKey: string;
    workspaceKey: string;
    groupKeys: string[];
    legacySingleGroupActivity?: boolean;
  }): Promise<WorkspaceGroupResultsDeletion> => {
    const workspace = await requireWorkspace(
      repository,
      input.tenantKey,
      input.workspaceKey
    );
    const groupKeys = Array.from(
      new Set(input.groupKeys.map(groupKey => normalizeGroupKey(groupKey)))
    ).sort();
    if (groupKeys.length === 0 || groupKeys.length > 100) {
      throw new FirstSliceError(
        400,
        "group_result_group_keys_invalid",
        "Between 1 and 100 distinct group keys are required."
      );
    }

    const groupKeySet = new Set(groupKeys);
    const [participantSessions, testRuns] = await Promise.all([
      repository.listParticipantSessionsByWorkspace(
        workspace.tenantId,
        workspace.workspaceId
      ),
      repository.listTestRunsByWorkspace(workspace.tenantId, workspace.workspaceId)
    ]);
    const affectedParticipantSessionIds = participantSessions
      .filter(participantSession => groupKeySet.has(participantSession.groupKey))
      .map(participantSession => participantSession.participantSessionId)
      .sort();
    const affectedParticipantSessionIdSet = new Set(
      affectedParticipantSessionIds
    );
    const deletedTestRuns = testRuns
      .filter(testRun =>
        affectedParticipantSessionIdSet.has(testRun.participantSessionId)
      )
      .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
    const deletedTestRunIds = deletedTestRuns.map(testRun => testRun.testRunId);
    const deletedResponseCount = deletedTestRuns.reduce(
      (total, testRun) =>
        total + Object.keys(normalizeTestRun(testRun).unitResponses).length,
      0
    );
    const deletedTestRunIdSet = new Set(deletedTestRunIds);
    const deletedAttachmentIds = new Set(
      (await buildWorkspaceAttachments(workspace))
        .filter(attachment => deletedTestRunIdSet.has(attachment.testRunId))
        .map(attachment => attachment.attachmentId)
    );
    const deletedAttachmentFiles = (
      await repository.listAttachmentFilesByWorkspace(
        workspace.tenantId,
        workspace.workspaceId
      )
    ).filter(attachmentFile =>
      deletedAttachmentIds.has(attachmentFile.attachmentId)
    );
    for (const attachmentFile of deletedAttachmentFiles) {
      await repository.deleteAttachmentFile(attachmentFile.attachmentFileId);
    }
    const deletedAttachmentFileCount = deletedAttachmentFiles.length;
    const deletedReviewCount =
      await repository.deleteWorkspaceReviewsByTestRunIds(deletedTestRunIds);
    const deletedTestLogCount =
      await repository.deleteParticipantTestLogsByTestRunIds(deletedTestRunIds);
    const deletedTestRunCount = await repository.deleteTestRunsByIds(
      deletedTestRunIds
    );
    const legacyGroupKey = groupKeys[0];

    await recordWorkspaceActivity({
      tenantId: workspace.tenantId,
      workspaceId: workspace.workspaceId,
      eventType: "group_results_deleted",
      subjectType: "workspace",
      subjectId: workspace.workspaceId,
      summary: input.legacySingleGroupActivity
        ? `Deleted ${deletedTestRunCount} test run(s) for group '${legacyGroupKey}'.`
        : `Deleted ${deletedTestRunCount} test run(s) for ${groupKeys.length} selected group(s).`,
      details: input.legacySingleGroupActivity
        ? {
            groupKey: legacyGroupKey,
            deletedTestRunCount,
            deletedResponseCount,
            deletedReviewCount,
            deletedTestLogCount,
            deletedAttachmentFileCount,
            affectedParticipantSessionIds,
            deletedTestRunIds
          }
        : {
            groupKeys,
            deletedTestRunCount,
            deletedResponseCount,
            deletedReviewCount,
            deletedTestLogCount,
            deletedAttachmentFileCount,
            affectedParticipantSessionIds,
            deletedTestRunIds
          }
    });

    return {
      tenantKey: input.tenantKey,
      workspaceKey: input.workspaceKey,
      groupKeys,
      deletedTestRunCount,
      deletedResponseCount,
      deletedReviewCount,
      deletedTestLogCount,
      affectedParticipantSessionIds,
      deletedTestRunIds
    };
  };

  return {
    applicationSettings: {
      async getApplicationSettings() {
        return (
          (await repository.getApplicationSettings()) ?? {
            ...defaultApplicationSettings
          }
        );
      },
      async updateApplicationSettings(input) {
        const currentSession = await requireActiveAdminSession(
          repository,
          input.sessionToken,
          now()
        );
        requireAdminRole(currentSession.roleAssignments, ["platform_admin"]);
        const previousSettings =
          (await repository.getApplicationSettings()) ?? defaultApplicationSettings;
        const updatedSettings: ApplicationSettings = {
          appTitle: normalizeApplicationTitle(input.appTitle),
          mainLogo:
            input.mainLogo === undefined
              ? previousSettings.mainLogo
              : normalizeApplicationLogo(input.mainLogo),
          themeName:
            input.themeName === undefined
              ? previousSettings.themeName
              : normalizeApplicationTheme(input.themeName),
          introHtml:
            input.introHtml === undefined
              ? previousSettings.introHtml
              : normalizeApplicationContentHtml(input.introHtml, "intro"),
          legalNoticeHtml:
            input.legalNoticeHtml === undefined
              ? previousSettings.legalNoticeHtml
              : normalizeApplicationContentHtml(
                  input.legalNoticeHtml,
                  "legal_notice"
                ),
          customTexts:
            input.customTexts === undefined
              ? previousSettings.customTexts
              : normalizeApplicationCustomTexts(input.customTexts),
          globalWarningText: normalizeGlobalWarningText(
            input.globalWarningText
          ),
          globalWarningExpiresAt: normalizeGlobalWarningExpiration(
            input.globalWarningExpiresAt
          ),
          updatedAt: now(),
          updatedByAdminUserId: currentSession.adminUser.adminUserId
        };
        await repository.saveApplicationSettings(updatedSettings);
        const changedCustomTextKeys = [
          ...new Set([
            ...Object.keys(previousSettings.customTexts),
            ...Object.keys(updatedSettings.customTexts)
          ])
        ].filter(
          key =>
            previousSettings.customTexts[key] !== updatedSettings.customTexts[key]
        );
        await recordAdminAuditEvent({
          eventType: "application_settings_updated",
          actorAdminUserId: currentSession.adminUser.adminUserId,
          summary: `Platform admin '${currentSession.adminUser.username}' updated application settings.`,
          details: {
            previousAppTitle: previousSettings.appTitle,
            nextAppTitle: updatedSettings.appTitle,
            previousThemeName: previousSettings.themeName,
            nextThemeName: updatedSettings.themeName,
            introHtmlChanged:
              previousSettings.introHtml !== updatedSettings.introHtml,
            previousIntroHtmlBytes: Buffer.byteLength(
              previousSettings.introHtml,
              "utf8"
            ),
            nextIntroHtmlBytes: Buffer.byteLength(
              updatedSettings.introHtml,
              "utf8"
            ),
            legalNoticeHtmlChanged:
              previousSettings.legalNoticeHtml !==
              updatedSettings.legalNoticeHtml,
            previousLegalNoticeHtmlBytes: Buffer.byteLength(
              previousSettings.legalNoticeHtml,
              "utf8"
            ),
            nextLegalNoticeHtmlBytes: Buffer.byteLength(
              updatedSettings.legalNoticeHtml,
              "utf8"
            ),
            previousCustomLogo:
              previousSettings.mainLogo !== defaultApplicationSettings.mainLogo,
            nextCustomLogo:
              updatedSettings.mainLogo !== defaultApplicationSettings.mainLogo,
            previousCustomTextCount: Object.keys(previousSettings.customTexts).length,
            nextCustomTextCount: Object.keys(updatedSettings.customTexts).length,
            changedCustomTextKeys,
            previousGlobalWarningText: previousSettings.globalWarningText,
            nextGlobalWarningText: updatedSettings.globalWarningText,
            previousGlobalWarningExpiresAt:
              previousSettings.globalWarningExpiresAt,
            nextGlobalWarningExpiresAt:
              updatedSettings.globalWarningExpiresAt
          }
        });
        return updatedSettings;
      }
    },
    attachments: {
      async listAttachments(input) {
        const access = await requireAttachmentAccess({
          ...input,
          write: false
        });
        const requestedGroupKey = input.groupKey?.trim();
        if (
          requestedGroupKey &&
          access.groupKeys &&
          !access.groupKeys.includes(requestedGroupKey)
        ) {
          throw new FirstSliceError(
            403,
            "attachment_group_scope_forbidden",
            "The requested group is outside the monitor's assigned groups."
          );
        }
        return (await buildWorkspaceAttachments(access.workspace)).filter(
          attachment =>
            (!access.groupKeys || access.groupKeys.includes(attachment.groupKey)) &&
            (!requestedGroupKey || attachment.groupKey === requestedGroupKey)
        );
      },
      async getAttachment(input) {
        const access = await requireAttachmentAccess({
          ...input,
          write: false
        });
        return requireScopedAttachment({
          workspace: access.workspace,
          groupKeys: access.groupKeys,
          attachmentId: input.attachmentId
        });
      },
      async uploadAttachmentFile(input) {
        const access = await requireAttachmentAccess({
          ...input,
          write: true
        });
        const attachment = await requireScopedAttachment({
          workspace: access.workspace,
          groupKeys: access.groupKeys,
          attachmentId: input.attachmentId
        });
        const normalizedFile = normalizeAttachmentFileInput(input);
        const attachmentFile: AttachmentFile = {
          attachmentFileId: `image:${idGenerator()}.${normalizedFile.extension}`,
          attachmentId: attachment.attachmentId,
          tenantId: access.workspace.tenantId,
          workspaceId: access.workspace.workspaceId,
          fileName: normalizedFile.fileName,
          mediaType: normalizedFile.mediaType,
          dataBase64: normalizedFile.dataBase64,
          createdAt: now()
        };
        await repository.saveAttachmentFile(attachmentFile);
        await recordWorkspaceActivity({
          tenantId: access.workspace.tenantId,
          workspaceId: access.workspace.workspaceId,
          eventType: "attachment_file_uploaded",
          actorId: access.actorAdminUserId,
          subjectType: "test_run",
          subjectId: attachment.testRunId,
          summary: `Uploaded attachment image '${attachmentFile.fileName}' for '${attachment.loginKey}'.`,
          details: {
            attachmentId: attachment.attachmentId,
            attachmentFileId: attachmentFile.attachmentFileId,
            groupKey: attachment.groupKey,
            loginKey: attachment.loginKey,
            bookletKey: attachment.bookletKey,
            unitKey: attachment.unitKey,
            variableId: attachment.variableId,
            mediaType: attachmentFile.mediaType
          }
        });
        return requireScopedAttachment({
          workspace: access.workspace,
          groupKeys: access.groupKeys,
          attachmentId: attachment.attachmentId
        });
      },
      async getAttachmentFile(input) {
        const access = await requireAttachmentAccess({
          ...input,
          write: false
        });
        const attachment = await requireScopedAttachment({
          workspace: access.workspace,
          groupKeys: access.groupKeys,
          attachmentId: input.attachmentId
        });
        const attachmentFile = await repository.getAttachmentFileById(
          input.attachmentFileId.trim()
        );
        if (
          !attachmentFile ||
          attachmentFile.attachmentId !== attachment.attachmentId ||
          attachmentFile.tenantId !== access.workspace.tenantId ||
          attachmentFile.workspaceId !== access.workspace.workspaceId
        ) {
          throw new FirstSliceError(
            404,
            "attachment_file_not_found",
            "The requested attachment file was not found."
          );
        }
        return attachmentFile;
      },
      async deleteAttachmentFile(input) {
        const access = await requireAttachmentAccess({
          ...input,
          write: true
        });
        const attachment = await requireScopedAttachment({
          workspace: access.workspace,
          groupKeys: access.groupKeys,
          attachmentId: input.attachmentId
        });
        const attachmentFile = await repository.getAttachmentFileById(
          input.attachmentFileId.trim()
        );
        if (
          !attachmentFile ||
          attachmentFile.attachmentId !== attachment.attachmentId ||
          attachmentFile.tenantId !== access.workspace.tenantId ||
          attachmentFile.workspaceId !== access.workspace.workspaceId
        ) {
          throw new FirstSliceError(
            404,
            "attachment_file_not_found",
            "The requested attachment file was not found."
          );
        }
        await repository.deleteAttachmentFile(attachmentFile.attachmentFileId);
        await recordWorkspaceActivity({
          tenantId: access.workspace.tenantId,
          workspaceId: access.workspace.workspaceId,
          eventType: "attachment_file_deleted",
          actorId: access.actorAdminUserId,
          subjectType: "test_run",
          subjectId: attachment.testRunId,
          summary: `Deleted attachment image '${attachmentFile.fileName}' for '${attachment.loginKey}'.`,
          details: {
            attachmentId: attachment.attachmentId,
            attachmentFileId: attachmentFile.attachmentFileId,
            groupKey: attachment.groupKey,
            loginKey: attachment.loginKey,
            bookletKey: attachment.bookletKey,
            unitKey: attachment.unitKey,
            variableId: attachment.variableId
          }
        });
        return requireScopedAttachment({
          workspace: access.workspace,
          groupKeys: access.groupKeys,
          attachmentId: attachment.attachmentId
        });
      }
    },
    adminAuth: {
      async bootstrapAdminUser(input) {
        const existingAdminUsers = await repository.listAdminUsers();
        if (existingAdminUsers.length > 0) {
          throw new FirstSliceError(
            409,
            "admin_bootstrap_already_completed",
            "Admin bootstrap can only be completed before the first admin user exists."
          );
        }

        const username = normalizeAdminUsername(input.username);
        const password = requireAdminPassword(input.password);
        const displayName = input.displayName?.trim() || username;
        const timestamp = now();
        const adminUser: AdminUser = {
          adminUserId: idGenerator(),
          username,
          displayName,
          passwordHash: hashAdminPassword(password),
          passwordChangeRequired: false,
          status: "active",
          customTexts: {},
          validFrom: null,
          validTo: null,
          validForMinutes: null,
          firstSignedInAt: null,
          createdAt: timestamp
        };
        const platformAdminRoleAssignment: AdminRoleAssignment = {
          roleAssignmentId: idGenerator(),
          adminUserId: adminUser.adminUserId,
          role: "platform_admin",
          accessMode: "read_write",
          tenantId: null,
          workspaceId: null,
          groupKey: null,
          monitorProfiles: [],
          monitorBookletVisibility: "visible",
          createdAt: timestamp
        };

        await repository.saveAdminUser(adminUser);
        await repository.saveAdminRoleAssignment(platformAdminRoleAssignment);
        await recordAdminAuditEvent({
          eventType: "admin_user_bootstrapped",
          subjectAdminUserId: adminUser.adminUserId,
          summary: `Bootstrapped platform admin '${adminUser.username}'.`,
          details: {
            username: adminUser.username,
            roleAssignment: summarizeAdminRoleAssignment(platformAdminRoleAssignment)
          }
        });
        return {
          adminUser,
          roleAssignments: [platformAdminRoleAssignment]
        };
      },
      async signIn(input) {
        const username = normalizeAdminUsername(input.username);
        const password = requireAdminCredentialsPassword(input.password);
        const timestamp = now();
        const loginAttempt = await repository.getAdminLoginAttempt(username);
        const loginAttemptExpiresAtMs = Date.parse(loginAttempt?.expiresAt ?? "");
        const timestampMs = Date.parse(timestamp);
        if (
          loginAttempt &&
          loginAttempt.failedAttempts >= adminLoginMaxFailures &&
          Number.isFinite(loginAttemptExpiresAtMs) &&
          loginAttemptExpiresAtMs > timestampMs
        ) {
          const retryAfterSeconds = Math.max(
            1,
            Math.ceil((loginAttemptExpiresAtMs - timestampMs) / 1_000)
          );
          const adminUser = await repository.getAdminUserByUsername(username);
          await recordAdminAuditEvent({
            eventType: "admin_sign_in_failed",
            subjectAdminUserId: adminUser?.adminUserId ?? null,
            summary: `Admin sign-in rate limited for '${username}'.`,
            details: {
              username,
              reason: "admin_login_rate_limited",
              failedAttempts: loginAttempt.failedAttempts,
              retryAfterSeconds
            }
          });
          throw new FirstSliceError(
            429,
            "admin_login_rate_limited",
            "Too many failed admin login attempts. Try again later.",
            {
              retryAfterSeconds,
              maxFailures: adminLoginMaxFailures
            }
          );
        }

        const adminUser = await repository.getAdminUserByUsername(username);
        const signInFailureReason = !adminUser
          ? "admin_user_not_found"
          : adminUser.status !== "active"
            ? "admin_user_not_active"
            : !verifyAdminPassword(password, adminUser.passwordHash)
              ? "password_mismatch"
              : null;
        if (
          !adminUser ||
          adminUser.status !== "active" ||
          signInFailureReason !== null
        ) {
          const failedLoginAttempt = await repository.recordAdminLoginFailure({
            username,
            attemptedAt: timestamp,
            expiresAt: new Date(
              timestampMs + adminLoginFailureWindowMs
            ).toISOString()
          });
          await recordAdminAuditEvent({
            eventType: "admin_sign_in_failed",
            subjectAdminUserId: adminUser?.adminUserId ?? null,
            summary: `Admin sign-in failed for '${username}'.`,
            details: {
              username,
              reason: signInFailureReason,
              adminUserStatus: adminUser?.status ?? null,
              failedAttempts: failedLoginAttempt.failedAttempts,
              loginAttemptExpiresAt: failedLoginAttempt.expiresAt
            }
          });
          throw new FirstSliceError(
            401,
            "admin_credentials_invalid",
            "Admin credentials are invalid."
          );
        }

        const accessFailureReason = resolveAdminAccessFailureReason(
          adminUser,
          timestamp
        );
        if (accessFailureReason) {
          await recordAdminAuditEvent({
            eventType: "admin_sign_in_failed",
            subjectAdminUserId: adminUser.adminUserId,
            summary: `Admin sign-in failed for '${username}'.`,
            details: {
              username,
              reason: accessFailureReason,
              adminUserStatus: adminUser.status
            }
          });
          const expired = accessFailureReason === "admin_access_expired";
          const accessAt = expired
            ? resolveAdminAccessValidUntil(adminUser)
            : adminUser.validFrom;
          throw new FirstSliceError(
            expired ? 410 : 403,
            accessFailureReason,
            expired
              ? "Admin access has expired."
              : "Admin access has not started.",
            {
              accessStatus: expired ? "expired" : "scheduled",
              accessAt: accessAt ?? timestamp,
              customTexts: { ...adminUser.customTexts }
            } satisfies AdminAccessWindowErrorDetails
          );
        }

        const signedInAdminUser =
          adminUser.validForMinutes && !adminUser.firstSignedInAt
            ? { ...adminUser, firstSignedInAt: timestamp }
            : adminUser;
        if (signedInAdminUser !== adminUser) {
          await repository.saveAdminUser(signedInAdminUser);
        }
        const accessValidUntil = resolveAdminAccessValidUntil(signedInAdminUser);
        const adminSession: AdminSession = {
          adminSessionId: idGenerator(),
          adminUserId: signedInAdminUser.adminUserId,
          token: createAdminSessionToken(),
          createdAt: timestamp,
          expiresAt: calculateAdminSessionExpiry(
            timestamp,
            adminSessionTtlMs,
            accessValidUntil
          ),
          revokedAt: null
        };

        await repository.saveAdminSession(adminSession);
        const roleAssignments = await listAdminRoleAssignmentsForUser(
          repository,
          signedInAdminUser.adminUserId
        );
        await recordAdminAuditEvent({
          eventType: "admin_sign_in_succeeded",
          actorAdminUserId: signedInAdminUser.adminUserId,
          subjectAdminUserId: signedInAdminUser.adminUserId,
          summary: `Admin '${signedInAdminUser.username}' signed in.`,
          details: {
            username: signedInAdminUser.username,
            adminSessionId: adminSession.adminSessionId,
            accessValidUntil
          }
        });
        return {
          adminUser: signedInAdminUser,
          adminSession,
          roleAssignments
        };
      },
      async getCurrentSession(input) {
        return requireActiveAdminSession(repository, input.sessionToken, now(), {
          allowPasswordChangeRequired: true
        });
      },
      async listAdminSessions(input) {
        const currentSession = await requireActiveAdminSession(
          repository,
          input.sessionToken,
          now()
        );
        requireAdminManagementRole(currentSession.roleAssignments);

        const nowIso = now();
        const limit = Math.max(1, Math.min(input.limit ?? 100, 500));
        const adminUserIdFilter = input.adminUserId?.trim() || undefined;
        const sessions = (await repository.listAdminSessions()).sort(
          (left, right) =>
            right.createdAt.localeCompare(left.createdAt) ||
            left.adminSessionId.localeCompare(right.adminSessionId)
        );
        const items: Array<{
          adminSession: AdminSession;
          adminUser: AdminUser;
          status: AdminSessionStatus;
        }> = [];

        for (const adminSession of sessions) {
          const status = resolveAdminSessionStatus(adminSession, nowIso);
          if (adminUserIdFilter && adminSession.adminUserId !== adminUserIdFilter) {
            continue;
          }
          if (input.status && status !== input.status) {
            continue;
          }

          const adminUser = await repository.getAdminUserById(
            adminSession.adminUserId
          );
          if (!adminUser) {
            continue;
          }
          const targetRoleAssignments =
            adminUser.adminUserId === currentSession.adminUser.adminUserId
              ? currentSession.roleAssignments
              : await listAdminRoleAssignmentsForUser(
                  repository,
                  adminUser.adminUserId
                );
          if (
            adminUser.adminUserId !== currentSession.adminUser.adminUserId &&
            !canManageAdminUser(
              currentSession.roleAssignments,
              targetRoleAssignments
            )
          ) {
            continue;
          }

          items.push({ adminSession, adminUser, status });
          if (items.length >= limit) {
            break;
          }
        }

        return items;
      },
      async revokeAdminSession(input) {
        const currentSession = await requireActiveAdminSession(
          repository,
          input.sessionToken,
          now()
        );
        requireAdminManagementRole(currentSession.roleAssignments);

        const adminSessionId = input.adminSessionId.trim();
        const targetSession = (await repository.listAdminSessions()).find(
          adminSession => adminSession.adminSessionId === adminSessionId
        );
        if (!targetSession) {
          throw new FirstSliceError(
            404,
            "admin_session_not_found",
            "Admin session was not found."
          );
        }
        if (targetSession.adminSessionId === currentSession.adminSession.adminSessionId) {
          throw new FirstSliceError(
            409,
            "admin_self_session_revoke_forbidden",
            "Use sign-out for the active admin session."
          );
        }
        if (targetSession.adminUserId !== currentSession.adminUser.adminUserId) {
          const targetRoleAssignments = await listAdminRoleAssignmentsForUser(
            repository,
            targetSession.adminUserId
          );
          requireManageableAdminUser(
            currentSession.roleAssignments,
            targetRoleAssignments
          );
        }
        if (targetSession.revokedAt !== null) {
          return targetSession;
        }

        const revokedSession: AdminSession = {
          ...targetSession,
          revokedAt: now()
        };
        const targetAdminUser = await repository.getAdminUserById(
          targetSession.adminUserId
        );

        await repository.saveAdminSession(revokedSession);
        await recordAdminAuditEvent({
          eventType: "admin_session_revoked",
          actorAdminUserId: currentSession.adminUser.adminUserId,
          subjectAdminUserId: targetSession.adminUserId,
          summary: `Admin '${currentSession.adminUser.username}' revoked session '${targetSession.adminSessionId}'.`,
          details: {
            targetAdminSessionId: targetSession.adminSessionId,
            targetAdminUserId: targetSession.adminUserId,
            targetUsername: targetAdminUser?.username ?? null,
            actorAdminSessionId: currentSession.adminSession.adminSessionId
          }
        });
        return revokedSession;
      },
      async revokeAdminSessions(input) {
        if (
          !Array.isArray(input.adminSessionIds) ||
          input.adminSessionIds.length < 1 ||
          input.adminSessionIds.length > 50 ||
          input.adminSessionIds.some(
            adminSessionId => typeof adminSessionId !== "string"
          )
        ) {
          throw new FirstSliceError(
            400,
            "admin_session_ids_invalid",
            "adminSessionIds must contain between 1 and 50 session ids."
          );
        }
        const adminSessionIds = Array.from(
          new Set(input.adminSessionIds.map(adminSessionId => adminSessionId.trim()))
        );
        if (
          adminSessionIds.length === 0 ||
          adminSessionIds.length > 50 ||
          adminSessionIds.some(
            adminSessionId => !adminSessionId || adminSessionId.length > 200
          )
        ) {
          throw new FirstSliceError(
            400,
            "admin_session_ids_invalid",
            "adminSessionIds must contain between 1 and 50 distinct non-empty session ids."
          );
        }

        const adminSessions: AdminSession[] = [];
        const failures: Array<{
          adminSessionId: string;
          statusCode: number;
          error: string;
          message: string;
          details: unknown;
        }> = [];
        for (const adminSessionId of adminSessionIds) {
          try {
            adminSessions.push(
              await this.revokeAdminSession({
                sessionToken: input.sessionToken,
                adminSessionId
              })
            );
          } catch (error) {
            if (!(error instanceof FirstSliceError)) {
              throw error;
            }
            failures.push({
              adminSessionId,
              statusCode: error.statusCode,
              error: error.errorCode,
              message: error.message,
              details: error.details
            });
          }
        }
        return {
          requestedCount: adminSessionIds.length,
          adminSessions,
          failures
        };
      },
      async signOut(input) {
        const { adminUser, adminSession } = await requireActiveAdminSession(
          repository,
          input.sessionToken,
          now(),
          { allowPasswordChangeRequired: true }
        );
        const revokedSession: AdminSession = {
          ...adminSession,
          revokedAt: now()
        };

        await repository.saveAdminSession(revokedSession);
        await recordAdminAuditEvent({
          eventType: "admin_sign_out",
          actorAdminUserId: adminUser.adminUserId,
          subjectAdminUserId: adminUser.adminUserId,
          summary: `Admin '${adminUser.username}' signed out.`,
          details: {
            username: adminUser.username,
            adminSessionId: adminSession.adminSessionId
          }
        });
        return revokedSession;
      },
      async changeOwnPassword(input) {
        const currentSession = await requireActiveAdminSession(
          repository,
          input.sessionToken,
          now(),
          { allowPasswordChangeRequired: true }
        );
        const password = requireAdminPassword(input.password);
        const updatedAdminUser: AdminUser = {
          ...currentSession.adminUser,
          passwordHash: hashAdminPassword(password),
          passwordChangeRequired: false
        };
        await repository.saveAdminUser(updatedAdminUser);

        const revokedAt = now();
        const revokedAdminSessionIds: string[] = [];
        for (const adminSession of await repository.listAdminSessions()) {
          if (
            adminSession.adminUserId !== updatedAdminUser.adminUserId ||
            resolveAdminSessionStatus(adminSession, revokedAt) !== "active"
          ) {
            continue;
          }
          await repository.saveAdminSession({
            ...adminSession,
            revokedAt
          });
          revokedAdminSessionIds.push(adminSession.adminSessionId);
        }

        await recordAdminAuditEvent({
          eventType: "admin_password_changed",
          actorAdminUserId: updatedAdminUser.adminUserId,
          subjectAdminUserId: updatedAdminUser.adminUserId,
          summary: `Admin '${updatedAdminUser.username}' changed their password.`,
          details: {
            username: updatedAdminUser.username,
            revokedSessionCount: revokedAdminSessionIds.length,
            revokedAdminSessionIds
          }
        });

        return {
          adminUser: updatedAdminUser,
          revokedAdminSessionIds
        };
      }
    },
    adminDirectory: {
      async listAdminUsers(input) {
        const currentSession = await requireActiveAdminSession(
          repository,
          input.sessionToken,
          now()
        );
        requireAdminManagementRole(currentSession.roleAssignments);
        const usernameFilter = input.username?.trim().toLowerCase() || undefined;
        const accessStatusTimestamp = now();
        const limit = Math.max(1, Math.min(input.limit ?? 100, 500));
        const tenantFilterKey = input.tenantKey?.trim() || undefined;
        const workspaceFilterKey = input.workspaceKey?.trim() || undefined;
        const tenantFilter = tenantFilterKey
          ? await repository.getTenantByKey(tenantFilterKey)
          : null;
        if (tenantFilterKey && !tenantFilter) {
          return [];
        }
        const workspaceFilter = workspaceFilterKey
          ? tenantFilterKey
            ? await repository.getWorkspaceByScope(
                tenantFilterKey,
                workspaceFilterKey
              )
            : await repository.getWorkspaceByWorkspaceKey(workspaceFilterKey)
          : null;
        if (workspaceFilterKey && !workspaceFilter) {
          return [];
        }

        const adminUsers = (await repository.listAdminUsers()).sort(
          (left, right) =>
            left.createdAt.localeCompare(right.createdAt) ||
            left.username.localeCompare(right.username)
        );

        const directoryItems = await Promise.all(
          adminUsers.map(async adminUser => ({
            adminUser,
            roleAssignments: await listAdminRoleAssignmentsForUser(
              repository,
              adminUser.adminUserId
            )
          }))
        );

        return directoryItems
          .filter(item => {
            const accessStatus = resolveAdminUserAccessStatus(
              item.adminUser,
              accessStatusTimestamp
            );
            return (
              (item.adminUser.adminUserId ===
                currentSession.adminUser.adminUserId ||
                canManageAdminUser(
                  currentSession.roleAssignments,
                  item.roleAssignments
                )) &&
              (!usernameFilter || item.adminUser.username.includes(usernameFilter)) &&
              (!input.status || item.adminUser.status === input.status) &&
              (!input.accessStatus || accessStatus === input.accessStatus) &&
              (input.passwordChangeRequired === undefined ||
                item.adminUser.passwordChangeRequired ===
                  input.passwordChangeRequired) &&
              (!input.role ||
                item.roleAssignments.some(
                  roleAssignment => roleAssignment.role === input.role
                )) &&
              (!tenantFilter ||
                item.roleAssignments.some(
                  roleAssignment => roleAssignment.tenantId === tenantFilter.tenantId
                )) &&
              (!workspaceFilter ||
                item.roleAssignments.some(
                  roleAssignment =>
                    roleAssignment.workspaceId === workspaceFilter.workspaceId
                ))
            );
          })
          .slice(0, limit);
      },
      async createAdminUser(input) {
        const currentSession = await requireActiveAdminSession(
          repository,
          input.sessionToken,
          now()
        );
        requireAdminManagementRole(currentSession.roleAssignments);

        const username = normalizeAdminUsername(input.username);
        const existingAdminUser = await repository.getAdminUserByUsername(username);
        if (existingAdminUser) {
          throw new FirstSliceError(
            409,
            "admin_username_conflict",
            `Admin username '${username}' already exists.`
          );
        }

        const password = requireAdminPassword(input.password);
        const timestamp = now();
        const accessWindow = normalizeAdminAccessWindow(input);
        const adminUser: AdminUser = {
          adminUserId: idGenerator(),
          username,
          displayName: normalizeAdminDisplayName(input.displayName, username),
          passwordHash: hashAdminPassword(password),
          passwordChangeRequired: true,
          status: "active",
          customTexts: normalizeAdminCustomTexts(input.customTexts),
          ...accessWindow,
          firstSignedInAt: null,
          createdAt: timestamp
        };
        const requestedRoleAssignments = normalizeAdminRoleAssignmentInputs(
          input.roleAssignments
        );
        if (
          requestedRoleAssignments.length === 0 &&
          !currentSession.roleAssignments.some(
            roleAssignment => roleAssignment.role === "platform_admin"
          )
        ) {
          throw new FirstSliceError(
            403,
            "admin_delegation_scope_required",
            "Delegated admins must create users with at least one manageable role assignment."
          );
        }

        const resolvedRoleScopes: ResolvedAdminRoleScope[] = [];
        for (const requestedRoleAssignment of requestedRoleAssignments) {
          const scope = await resolveAdminRoleScope(repository, requestedRoleAssignment);
          requireAdminDelegationScope(currentSession.roleAssignments, scope);
          if (
            resolvedRoleScopes.some(existingScope =>
              existingScope.role === scope.role &&
              existingScope.tenantId === scope.tenantId &&
              existingScope.workspaceId === scope.workspaceId &&
              existingScope.groupKey === scope.groupKey
            )
          ) {
            continue;
          }
          resolvedRoleScopes.push(scope);
        }

        if (
          resolvedRoleScopes.some(scope => scope.role === "platform_admin")
        ) {
          requireAdminPasswordConfirmation(
            currentSession.adminUser,
            input.confirmationPassword
          );
        }

        await repository.saveAdminUser(adminUser);

        const savedRoleAssignments: AdminRoleAssignment[] = [];
        for (const scope of resolvedRoleScopes) {
          const roleAssignment: AdminRoleAssignment = {
            roleAssignmentId: idGenerator(),
            adminUserId: adminUser.adminUserId,
            role: scope.role,
            accessMode: scope.accessMode,
            tenantId: scope.tenantId,
            workspaceId: scope.workspaceId,
            groupKey: scope.groupKey,
            monitorProfiles: scope.monitorProfiles,
            monitorBookletVisibility: scope.monitorBookletVisibility,
            createdAt: timestamp
          };
          await repository.saveAdminRoleAssignment(roleAssignment);
          savedRoleAssignments.push(roleAssignment);
        }

        const directoryItem = await createAdminUserDirectoryItem(repository, adminUser);
        await recordAdminAuditEvent({
          eventType: "admin_user_created",
          actorAdminUserId: currentSession.adminUser.adminUserId,
          subjectAdminUserId: adminUser.adminUserId,
          summary: `Admin '${currentSession.adminUser.username}' created user '${adminUser.username}'.`,
          details: {
            username: adminUser.username,
            displayName: adminUser.displayName,
            status: adminUser.status,
            validFrom: adminUser.validFrom,
            validTo: adminUser.validTo,
            validForMinutes: adminUser.validForMinutes,
            customTextCount: Object.keys(adminUser.customTexts).length,
            platformRoleStepUpConfirmed: resolvedRoleScopes.some(
              scope => scope.role === "platform_admin"
            ),
            roleAssignments: savedRoleAssignments.map(summarizeAdminRoleAssignment)
          }
        });

        return directoryItem;
      },
      async updateAdminUser(input) {
        const currentSession = await requireActiveAdminSession(
          repository,
          input.sessionToken,
          now()
        );
        requireAdminManagementRole(currentSession.roleAssignments);

        const adminUser = await requireAdminUser(repository, input.adminUserId);
        const targetRoleAssignments = await listAdminRoleAssignmentsForUser(
          repository,
          adminUser.adminUserId
        );
        if (adminUser.adminUserId !== currentSession.adminUser.adminUserId) {
          requireManageableAdminUser(
            currentSession.roleAssignments,
            targetRoleAssignments
          );
        }
        const nextStatus =
          input.status === undefined
            ? adminUser.status
            : normalizeAdminUserStatus(input.status);
        const accessWindowUpdateRequested =
          input.validFrom !== undefined ||
          input.validTo !== undefined ||
          input.validForMinutes !== undefined;
        const nextAccessWindow = accessWindowUpdateRequested
          ? normalizeAdminAccessWindow({
              validFrom:
                input.validFrom === undefined
                  ? adminUser.validFrom
                  : input.validFrom,
              validTo:
                input.validTo === undefined ? adminUser.validTo : input.validTo,
              validForMinutes:
                input.validForMinutes === undefined
                  ? adminUser.validForMinutes
                  : input.validForMinutes
            })
          : {
              validFrom: adminUser.validFrom,
              validTo: adminUser.validTo,
              validForMinutes: adminUser.validForMinutes
            };
        if (
          nextStatus === "disabled" &&
          adminUser.adminUserId === currentSession.adminUser.adminUserId
        ) {
          throw new FirstSliceError(
            409,
            "admin_self_disable_forbidden",
            "The active admin user cannot disable their own account."
          );
        }

        const updatedAdminUser: AdminUser = {
          ...adminUser,
          displayName:
            input.displayName === undefined
              ? adminUser.displayName
              : normalizeAdminDisplayName(input.displayName, adminUser.username),
          status: nextStatus,
          customTexts:
            input.customTexts === undefined
              ? adminUser.customTexts
              : normalizeAdminCustomTexts(input.customTexts),
          ...nextAccessWindow
        };
        const changedCustomTextKeys = [
          ...new Set([
            ...Object.keys(adminUser.customTexts),
            ...Object.keys(updatedAdminUser.customTexts)
          ])
        ].filter(
          key =>
            adminUser.customTexts[key] !== updatedAdminUser.customTexts[key]
        );
        await repository.saveAdminUser(updatedAdminUser);

        const revokedSessionIds: string[] = [];
        const shortenedSessionIds: string[] = [];
        const accessWindowChanged =
          adminUser.validFrom !== updatedAdminUser.validFrom ||
          adminUser.validTo !== updatedAdminUser.validTo ||
          adminUser.validForMinutes !== updatedAdminUser.validForMinutes;
        if (nextStatus === "disabled" || accessWindowChanged) {
          const sessionBoundaryTimestamp = now();
          const accessFailureReason = accessWindowChanged
            ? resolveAdminAccessFailureReason(
                updatedAdminUser,
                sessionBoundaryTimestamp
              )
            : null;
          const accessValidUntil = accessWindowChanged
            ? resolveAdminAccessValidUntil(updatedAdminUser)
            : null;
          for (const adminSession of await repository.listAdminSessions()) {
            if (
              adminSession.adminUserId !== updatedAdminUser.adminUserId ||
              resolveAdminSessionStatus(
                adminSession,
                sessionBoundaryTimestamp
              ) !== "active"
            ) {
              continue;
            }
            if (nextStatus !== "disabled" && !accessFailureReason) {
              if (
                !accessValidUntil ||
                Date.parse(accessValidUntil) >= Date.parse(adminSession.expiresAt)
              ) {
                continue;
              }
              await repository.saveAdminSession({
                ...adminSession,
                expiresAt: accessValidUntil
              });
              shortenedSessionIds.push(adminSession.adminSessionId);
              continue;
            }
            await repository.saveAdminSession({
              ...adminSession,
              revokedAt: sessionBoundaryTimestamp
            });
            revokedSessionIds.push(adminSession.adminSessionId);
          }
        }

        const directoryItem = await createAdminUserDirectoryItem(
          repository,
          updatedAdminUser
        );
        await recordAdminAuditEvent({
          eventType: "admin_user_updated",
          actorAdminUserId: currentSession.adminUser.adminUserId,
          subjectAdminUserId: updatedAdminUser.adminUserId,
          summary: `Admin '${currentSession.adminUser.username}' updated user '${updatedAdminUser.username}'.`,
          details: {
            username: updatedAdminUser.username,
            previousDisplayName: adminUser.displayName,
            nextDisplayName: updatedAdminUser.displayName,
            previousStatus: adminUser.status,
            nextStatus: updatedAdminUser.status,
            previousCustomTextCount: Object.keys(adminUser.customTexts).length,
            nextCustomTextCount: Object.keys(updatedAdminUser.customTexts)
              .length,
            changedCustomTextKeys,
            previousValidFrom: adminUser.validFrom,
            nextValidFrom: updatedAdminUser.validFrom,
            previousValidTo: adminUser.validTo,
            nextValidTo: updatedAdminUser.validTo,
            previousValidForMinutes: adminUser.validForMinutes,
            nextValidForMinutes: updatedAdminUser.validForMinutes,
            revokedSessionCount: revokedSessionIds.length,
            revokedSessionIds,
            shortenedSessionCount: shortenedSessionIds.length,
            shortenedSessionIds
          }
        });

        return directoryItem;
      },
      async deleteAdminUser(input) {
        const currentSession = await requireActiveAdminSession(
          repository,
          input.sessionToken,
          now()
        );
        requireAdminManagementRole(currentSession.roleAssignments);

        const adminUser = await requireAdminUser(repository, input.adminUserId);
        if (adminUser.adminUserId === currentSession.adminUser.adminUserId) {
          throw new FirstSliceError(
            409,
            "admin_self_delete_forbidden",
            "The active admin user cannot delete their own account."
          );
        }
        const targetRoleAssignments = await listAdminRoleAssignmentsForUser(
          repository,
          adminUser.adminUserId
        );
        requireManageableAdminUser(
          currentSession.roleAssignments,
          targetRoleAssignments
        );

        const deletion = await repository.deleteAdminUser(adminUser.adminUserId);
        await recordAdminAuditEvent({
          eventType: "admin_user_deleted",
          actorAdminUserId: currentSession.adminUser.adminUserId,
          subjectAdminUserId: adminUser.adminUserId,
          summary: `Admin '${currentSession.adminUser.username}' deleted user '${adminUser.username}'.`,
          details: {
            username: adminUser.username,
            displayName: adminUser.displayName,
            status: adminUser.status,
            roleAssignments: targetRoleAssignments.map(
              summarizeAdminRoleAssignment
            ),
            ...deletion
          }
        });

        return {
          adminUserId: adminUser.adminUserId,
          username: adminUser.username,
          ...deletion
        };
      },
      async resetAdminUserPassword(input) {
        const currentSession = await requireActiveAdminSession(
          repository,
          input.sessionToken,
          now()
        );
        requireAdminManagementRole(currentSession.roleAssignments);

        const adminUser = await requireAdminUser(repository, input.adminUserId);
        const targetRoleAssignments = await listAdminRoleAssignmentsForUser(
          repository,
          adminUser.adminUserId
        );
        if (adminUser.adminUserId !== currentSession.adminUser.adminUserId) {
          requireManageableAdminUser(
            currentSession.roleAssignments,
            targetRoleAssignments
          );
        }
        const password = requireAdminPassword(input.password);
        const updatedAdminUser: AdminUser = {
          ...adminUser,
          passwordHash: hashAdminPassword(password),
          passwordChangeRequired:
            adminUser.adminUserId === currentSession.adminUser.adminUserId
              ? false
              : true
        };
        await repository.saveAdminUser(updatedAdminUser);

        const directoryItem = await createAdminUserDirectoryItem(
          repository,
          updatedAdminUser
        );
        await recordAdminAuditEvent({
          eventType: "admin_password_reset",
          actorAdminUserId: currentSession.adminUser.adminUserId,
          subjectAdminUserId: updatedAdminUser.adminUserId,
          summary: `Admin '${currentSession.adminUser.username}' reset password for '${updatedAdminUser.username}'.`,
          details: {
            username: updatedAdminUser.username,
            passwordChangeRequired: updatedAdminUser.passwordChangeRequired
          }
        });

        return directoryItem;
      },
      async assignAdminRole(input) {
        const currentSession = await requireActiveAdminSession(
          repository,
          input.sessionToken,
          now()
        );
        requireAdminManagementRole(currentSession.roleAssignments);

        const adminUser = await requireAdminUser(repository, input.adminUserId);
        const scope = await resolveAdminRoleScope(repository, input);
        const existingRoleAssignments = await listAdminRoleAssignmentsForUser(
          repository,
          adminUser.adminUserId
        );
        requireManageableAdminUser(
          currentSession.roleAssignments,
          existingRoleAssignments
        );
        requireAdminDelegationScope(currentSession.roleAssignments, scope);
        if (scope.role === "platform_admin") {
          requireAdminPasswordConfirmation(
            currentSession.adminUser,
            input.confirmationPassword
          );
        }
        const existingRoleAssignment = existingRoleAssignments.find(roleAssignment =>
          isSameAdminRoleScope(roleAssignment, scope)
        );
        if (
          existingRoleAssignment &&
          input.monitorProfiles === undefined &&
          input.monitorBookletVisibility === undefined &&
          input.accessMode === undefined
        ) {
          return { adminUser, roleAssignments: existingRoleAssignments };
        }

        if (existingRoleAssignment) {
          const updatedRoleAssignment: AdminRoleAssignment = {
            ...existingRoleAssignment,
            accessMode: scope.accessMode,
            monitorProfiles:
              input.monitorProfiles === undefined
                ? existingRoleAssignment.monitorProfiles
                : scope.monitorProfiles,
            monitorBookletVisibility:
              input.monitorBookletVisibility === undefined
                ? existingRoleAssignment.monitorBookletVisibility
                : scope.monitorBookletVisibility
          };
          await repository.saveAdminRoleAssignment(updatedRoleAssignment);
          const directoryItem = await createAdminUserDirectoryItem(repository, adminUser);
          await recordAdminAuditEvent({
            eventType: "admin_role_assigned",
            actorAdminUserId: currentSession.adminUser.adminUserId,
            subjectAdminUserId: adminUser.adminUserId,
            summary: `Admin '${currentSession.adminUser.username}' updated '${updatedRoleAssignment.role}' for '${adminUser.username}'.`,
            details: {
              username: adminUser.username,
              platformRoleStepUpConfirmed:
                updatedRoleAssignment.role === "platform_admin",
              roleAssignment: summarizeAdminRoleAssignment(updatedRoleAssignment)
            }
          });
          return directoryItem;
        }

        const roleAssignment: AdminRoleAssignment = {
          roleAssignmentId: idGenerator(),
          adminUserId: adminUser.adminUserId,
          role: scope.role,
          accessMode: scope.accessMode,
          tenantId: scope.tenantId,
          workspaceId: scope.workspaceId,
          groupKey: scope.groupKey,
          monitorProfiles: scope.monitorProfiles,
          monitorBookletVisibility: scope.monitorBookletVisibility,
          createdAt: now()
        };
        await repository.saveAdminRoleAssignment(roleAssignment);

        const directoryItem = await createAdminUserDirectoryItem(repository, adminUser);
        await recordAdminAuditEvent({
          eventType: "admin_role_assigned",
          actorAdminUserId: currentSession.adminUser.adminUserId,
          subjectAdminUserId: adminUser.adminUserId,
          summary: `Admin '${currentSession.adminUser.username}' assigned '${roleAssignment.role}' to '${adminUser.username}'.`,
          details: {
            username: adminUser.username,
            platformRoleStepUpConfirmed: roleAssignment.role === "platform_admin",
            roleAssignment: summarizeAdminRoleAssignment(roleAssignment)
          }
        });

        return directoryItem;
      },
      async revokeAdminRole(input) {
        const currentSession = await requireActiveAdminSession(
          repository,
          input.sessionToken,
          now()
        );
        requireAdminManagementRole(currentSession.roleAssignments);

        const adminUser = await requireAdminUser(repository, input.adminUserId);
        const existingRoleAssignments = await listAdminRoleAssignmentsForUser(
          repository,
          adminUser.adminUserId
        );
        const roleAssignment = existingRoleAssignments.find(
          candidate => candidate.roleAssignmentId === input.roleAssignmentId
        );
        if (!roleAssignment) {
          throw new FirstSliceError(
            404,
            "admin_role_assignment_not_found",
            `Role assignment '${input.roleAssignmentId}' was not found for admin user '${adminUser.adminUserId}'.`
          );
        }
        if (
          adminUser.adminUserId === currentSession.adminUser.adminUserId &&
          roleAssignment.role === "platform_admin"
        ) {
          throw new FirstSliceError(
            409,
            "admin_self_revoke_platform_role_forbidden",
            "The active admin user cannot revoke their own platform admin role."
          );
        }
        if (adminUser.adminUserId === currentSession.adminUser.adminUserId) {
          throw new FirstSliceError(
            409,
            "admin_self_role_revoke_forbidden",
            "The active admin user cannot revoke their own admin role."
          );
        }
        requireManageableAdminUser(
          currentSession.roleAssignments,
          existingRoleAssignments
        );
        requireAdminDelegationScope(
          currentSession.roleAssignments,
          roleAssignment
        );
        if (roleAssignment.role === "platform_admin") {
          requireAdminPasswordConfirmation(
            currentSession.adminUser,
            input.confirmationPassword
          );
        }

        await repository.deleteAdminRoleAssignment(roleAssignment.roleAssignmentId);

        const directoryItem = await createAdminUserDirectoryItem(repository, adminUser);
        await recordAdminAuditEvent({
          eventType: "admin_role_revoked",
          actorAdminUserId: currentSession.adminUser.adminUserId,
          subjectAdminUserId: adminUser.adminUserId,
          summary: `Admin '${currentSession.adminUser.username}' revoked '${roleAssignment.role}' from '${adminUser.username}'.`,
          details: {
            username: adminUser.username,
            platformRoleStepUpConfirmed: roleAssignment.role === "platform_admin",
            roleAssignment: summarizeAdminRoleAssignment(roleAssignment)
          }
        });

        return directoryItem;
      },
      async listAdminAuditEvents(input) {
        const currentSession = await requireActiveAdminSession(
          repository,
          input.sessionToken,
          now()
        );
        requireAdminManagementRole(currentSession.roleAssignments);
        const limit = Math.max(1, Math.min(input.limit ?? 100, 500));

        const visibleAdminUserIds = new Set<string>([
          currentSession.adminUser.adminUserId
        ]);
        if (
          !currentSession.roleAssignments.some(
            roleAssignment => roleAssignment.role === "platform_admin"
          )
        ) {
          for (const adminUser of await repository.listAdminUsers()) {
            const targetRoleAssignments = await listAdminRoleAssignmentsForUser(
              repository,
              adminUser.adminUserId
            );
            if (
              canManageAdminUser(
                currentSession.roleAssignments,
                targetRoleAssignments
              )
            ) {
              visibleAdminUserIds.add(adminUser.adminUserId);
            }
          }
        }
        const canViewAllAuditEvents = currentSession.roleAssignments.some(
          roleAssignment => roleAssignment.role === "platform_admin"
        );

        return (await repository.listAdminAuditEvents())
          .filter(
            auditEvent =>
              (canViewAllAuditEvents ||
                (auditEvent.actorAdminUserId !== null &&
                  visibleAdminUserIds.has(auditEvent.actorAdminUserId)) ||
                (auditEvent.subjectAdminUserId !== null &&
                  visibleAdminUserIds.has(auditEvent.subjectAdminUserId))) &&
              (!input.eventType || auditEvent.eventType === input.eventType) &&
              (!input.actorAdminUserId ||
                auditEvent.actorAdminUserId === input.actorAdminUserId) &&
              (!input.subjectAdminUserId ||
                auditEvent.subjectAdminUserId === input.subjectAdminUserId)
          )
          .sort(
            (left, right) =>
              right.occurredAt.localeCompare(left.occurredAt) ||
              right.adminAuditEventId.localeCompare(left.adminAuditEventId)
          )
          .slice(0, limit);
      }
    },
    platform: {
      async listTenants() {
        return (await repository.listTenants()).sort(
          (left, right) =>
            left.createdAt.localeCompare(right.createdAt) ||
            left.tenantKey.localeCompare(right.tenantKey)
        );
      },
      async exportTenantsCsv() {
        const tenants = await this.listTenants();

        return formatTenantsCsv(tenants);
      },
      async createTenant(input) {
        const existingTenant = await repository.getTenantByKey(input.tenantKey);
        if (existingTenant) {
          throw new FirstSliceError(
            409,
            "tenant_key_conflict",
            `Tenant '${input.tenantKey}' already exists.`
          );
        }

        const tenant: Tenant = {
          tenantId: idGenerator(),
          tenantKey: input.tenantKey,
          displayName: input.displayName,
          status: "active",
          createdAt: now()
        };
        await repository.saveTenant(tenant);
        return tenant;
      },
      async listWorkspaces(input) {
        const tenant = await requireTenant(repository, input.tenantKey);
        return (await repository.listWorkspacesByTenantId(tenant.tenantId)).sort(
          (left, right) =>
            left.createdAt.localeCompare(right.createdAt) ||
            left.workspaceKey.localeCompare(right.workspaceKey)
        );
      },
      async exportWorkspacesCsv(input) {
        const workspaces = await this.listWorkspaces(input);

        return formatWorkspacesCsv({
          tenantKey: input.tenantKey,
          items: workspaces
        });
      },
      async createWorkspace(input) {
        const tenant = await requireTenant(repository, input.tenantKey);
        const existingWorkspace = await repository.getWorkspaceByScope(
          input.tenantKey,
          input.workspaceKey
        );

        if (existingWorkspace) {
          throw new FirstSliceError(
            409,
            "workspace_key_conflict",
            `Workspace '${input.workspaceKey}' already exists in tenant '${input.tenantKey}'.`
          );
        }

        const workspace: Workspace = {
          workspaceId: idGenerator(),
          tenantId: tenant.tenantId,
          workspaceKey: input.workspaceKey,
          displayName: normalizeWorkspaceDisplayName(input.displayName),
          status: "active",
          createdAt: now()
        };
        await repository.saveWorkspace({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          workspace
        });
        await recordWorkspaceActivity({
          tenantId: tenant.tenantId,
          workspaceId: workspace.workspaceId,
          eventType: "workspace_created",
          subjectType: "workspace",
          subjectId: workspace.workspaceId,
          summary: `Workspace '${workspace.workspaceKey}' created.`,
          details: {
            workspaceKey: workspace.workspaceKey,
            displayName: workspace.displayName
          }
        });
        return workspace;
      },
      async updateWorkspace(input) {
        const tenant = await requireTenant(repository, input.tenantKey);
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const displayName = normalizeWorkspaceDisplayName(input.displayName);

        const conflictingWorkspace = (
          await repository.listWorkspacesByTenantId(tenant.tenantId)
        ).find(
          candidate =>
            candidate.workspaceId !== workspace.workspaceId &&
            candidate.displayName.toLowerCase() === displayName.toLowerCase()
        );
        if (conflictingWorkspace) {
          throw new FirstSliceError(
            409,
            "workspace_display_name_conflict",
            `Workspace display name '${displayName}' already exists in tenant '${input.tenantKey}'.`
          );
        }

        if (workspace.displayName === displayName) {
          return workspace;
        }

        const updatedWorkspace: Workspace = {
          ...workspace,
          displayName
        };
        await repository.saveWorkspace({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          workspace: updatedWorkspace
        });
        await recordWorkspaceActivity({
          tenantId: tenant.tenantId,
          workspaceId: workspace.workspaceId,
          eventType: "workspace_updated",
          actorId: input.actorId,
          subjectType: "workspace",
          subjectId: workspace.workspaceId,
          summary: `Workspace '${workspace.workspaceKey}' renamed.`,
          details: {
            workspaceKey: workspace.workspaceKey,
            previousDisplayName: workspace.displayName,
            nextDisplayName: displayName
          }
        });
        return updatedWorkspace;
      },
      async deleteWorkspace(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        if (input.confirmation !== workspace.workspaceKey) {
          throw new FirstSliceError(
            400,
            "workspace_delete_confirmation_mismatch",
            "Workspace deletion confirmation must exactly match the workspace key."
          );
        }
        const occurredAt = now();
        const auditEvent: AdminAuditEvent = {
          adminAuditEventId: idGenerator(),
          eventType: "workspace_deleted",
          actorAdminUserId: input.actorId ?? null,
          subjectAdminUserId: null,
          occurredAt,
          summary: `Workspace '${workspace.workspaceKey}' permanently deleted.`,
          details: {
            tenantKey: input.tenantKey,
            workspaceKey: workspace.workspaceKey,
            workspaceId: workspace.workspaceId,
            displayName: workspace.displayName
          }
        };
        const counts = await repository.deleteWorkspaceAggregate({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          tenantId: workspace.tenantId,
          workspaceId: workspace.workspaceId,
          auditEvent
        });
        if (!counts) {
          throw new FirstSliceError(
            409,
            "workspace_delete_conflict",
            `Workspace '${input.workspaceKey}' changed before it could be deleted.`
          );
        }
        return { workspace, counts };
      }
    },
    workspaceAdminRead: {
      async getWorkspaceOverview(input) {
        const tenant = await requireTenant(repository, input.tenantKey);
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const sourcePackages = await repository.listSourcePackagesByWorkspace(
          workspace.tenantId,
          workspace.workspaceId
        );
        const importJobs = await repository.listImportJobsByWorkspace(
          workspace.tenantId,
          workspace.workspaceId
        );
        const contentReleases = await repository.listContentReleasesByWorkspace(
          workspace.tenantId,
          workspace.workspaceId
        );
        const participantSessions =
          await repository.listParticipantSessionsByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          );
        const storedTestRuns = await repository.listTestRunsByWorkspace(
          workspace.tenantId,
          workspace.workspaceId
        );
        const timestamp = now();
        const testRuns: TestRun[] = [];
        for (const storedTestRun of storedTestRuns) {
          const contentRelease = contentReleases.find(
            candidate =>
              candidate.contentReleaseId === storedTestRun.contentReleaseId
          );
          testRuns.push(
            contentRelease &&
              storedTestRun.status !== "completed" &&
              !resolveOpenMonitorBookletError(contentRelease, storedTestRun)
              ? await persistEffectiveTestletTimerState({
                  contentRelease,
                  testRun: storedTestRun,
                  timestamp
                })
              : normalizeTestRun(storedTestRun)
          );
        }
        const latestImportJobAt =
          importJobs
            .map(importJob => importJob.createdAt)
            .sort((left, right) => right.localeCompare(left))[0] ?? null;
        const activeContentRelease =
          contentReleases.find(release => release.status === "active") ?? null;

        return {
          tenant,
          workspace,
          sourcePackageCount: sourcePackages.length,
          importJobCount: importJobs.length,
          contentReleaseCount: contentReleases.length,
          activeContentReleaseId: activeContentRelease?.contentReleaseId ?? null,
          latestImportJobAt,
          participantSessionCount: participantSessions.length,
          openTestRunCount: testRuns.filter(testRun => testRun.status !== "completed")
            .length
        };
      },
      async exportWorkspaceOverviewCsv(input) {
        const overview = await this.getWorkspaceOverview(input);

        return formatWorkspaceOverviewCsv({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          overview
        });
      },
      async getStudyMonitorSummary(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const [
          participantSessions,
          participantRosterEntries,
          testRuns,
          contentReleases,
          reviews
        ] =
          await Promise.all([
            repository.listParticipantSessionsByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listParticipantRosterEntriesByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listTestRunsByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listContentReleasesByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listWorkspaceReviewsByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            )
          ]);
        const studyMonitorData = scopeStudyMonitorDataToMonitorableModes({
          participantSessions,
          participantRosterEntries,
          testRuns,
          reviews
        });

        return buildStudyMonitorSummary({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          generatedAt: now(),
          ...studyMonitorData,
          contentReleases,
        });
      },
      async getStudyMonitorParticipantMatrix(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const [
          participantSessions,
          participantRosterEntries,
          testRuns,
          contentReleases,
          reviews
        ] =
          await Promise.all([
            repository.listParticipantSessionsByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listParticipantRosterEntriesByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listTestRunsByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listContentReleasesByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listWorkspaceReviewsByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            )
          ]);
        const studyMonitorData = scopeStudyMonitorDataToMonitorableModes({
          participantSessions,
          participantRosterEntries,
          testRuns,
          reviews
        });

        const matrix = buildStudyMonitorParticipantMatrix({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          generatedAt: now(),
          ...studyMonitorData,
          contentReleases,
        });

        return filterStudyMonitorParticipantMatrix(matrix, input);
      },
      async getStudyMonitorParticipantDetail(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const loginKey = input.loginKey.trim();
        if (!loginKey) {
          throw new FirstSliceError(
            400,
            "login_key_required",
            "loginKey is required."
          );
        }
        const [
          participantSessions,
          participantRosterEntries,
          testRuns,
          contentReleases,
          reviews
        ] =
          await Promise.all([
            repository.listParticipantSessionsByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listParticipantRosterEntriesByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listTestRunsByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listContentReleasesByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listWorkspaceReviewsByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            )
          ]);
        const studyMonitorData = scopeStudyMonitorDataToMonitorableModes({
          participantSessions,
          participantRosterEntries,
          testRuns,
          reviews
        });
        const detail = buildStudyMonitorParticipantDetail({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          loginKey,
          generatedAt: now(),
          ...studyMonitorData,
          contentReleases,
        });

        if (!detail.rosterEntry && detail.participantSessionCount === 0) {
          throw new FirstSliceError(
            404,
            "study_monitor_participant_not_found",
            `Study monitor participant '${loginKey}' was not found in workspace '${input.workspaceKey}'.`
          );
        }

        return detail;
      },
      async getStudyMonitorGroupDetail(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const groupKey = normalizeGroupKey(input.groupKey);
        const [
          participantSessions,
          participantRosterEntries,
          testRuns,
          contentReleases,
          reviews
        ] =
          await Promise.all([
            repository.listParticipantSessionsByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listParticipantRosterEntriesByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listTestRunsByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listContentReleasesByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listWorkspaceReviewsByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            )
          ]);
        const studyMonitorData = scopeStudyMonitorDataToMonitorableModes({
          participantSessions,
          participantRosterEntries,
          testRuns,
          reviews
        });
        const detail = buildStudyMonitorGroupDetail({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          groupKey,
          generatedAt: now(),
          ...studyMonitorData,
          contentReleases,
        });

        if (detail.expectedParticipantCount === 0) {
          throw new FirstSliceError(
            404,
            "study_monitor_group_not_found",
            `Study monitor group '${groupKey}' was not found in workspace '${input.workspaceKey}'.`
          );
        }

        return detail;
      },
      async getStudyMonitorBookletDetail(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const bookletKey = input.bookletKey.trim();
        const [participantSessions, participantRosterEntries, testRuns, contentReleases, reviews] =
          await Promise.all([
            repository.listParticipantSessionsByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listParticipantRosterEntriesByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listTestRunsByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listContentReleasesByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listWorkspaceReviewsByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            )
          ]);
        const studyMonitorData = scopeStudyMonitorDataToMonitorableModes({
          participantSessions,
          participantRosterEntries,
          testRuns,
          reviews
        });
        const detail = buildStudyMonitorBookletDetail({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          bookletKey,
          generatedAt: now(),
          ...studyMonitorData,
          contentReleases,
        });

        if (detail.expectedParticipantCount === 0) {
          throw new FirstSliceError(
            404,
            "study_monitor_booklet_not_found",
            `Study monitor booklet '${bookletKey}' was not found in workspace '${input.workspaceKey}'.`
          );
        }

        return detail;
      },
      async getStudyMonitorUnitDetail(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const unitKey = input.unitKey.trim();
        const [participantSessions, participantRosterEntries, testRuns, contentReleases, reviews] =
          await Promise.all([
            repository.listParticipantSessionsByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listParticipantRosterEntriesByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listTestRunsByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listContentReleasesByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listWorkspaceReviewsByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            )
          ]);
        const studyMonitorData = scopeStudyMonitorDataToMonitorableModes({
          participantSessions,
          participantRosterEntries,
          testRuns,
          reviews
        });
        const detail = buildStudyMonitorUnitDetail({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          unitKey,
          generatedAt: now(),
          ...studyMonitorData,
          contentReleases,
        });

        if (detail.expectedRunCount === 0 && detail.responseCount === 0) {
          throw new FirstSliceError(
            404,
            "study_monitor_unit_not_found",
            `Study monitor unit '${unitKey}' was not found in workspace '${input.workspaceKey}'.`
          );
        }

        return detail;
      },
      async getStudyMonitorRunDetail(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const testRunId = input.testRunId.trim();
        if (!testRunId) {
          throw new FirstSliceError(
            400,
            "test_run_id_required",
            "testRunId is required."
          );
        }
        const [
          participantSessions,
          participantRosterEntries,
          testRuns,
          contentReleases,
          reviews
        ] =
          await Promise.all([
            repository.listParticipantSessionsByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listParticipantRosterEntriesByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listTestRunsByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listContentReleasesByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listWorkspaceReviewsByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            )
          ]);
        const studyMonitorData = scopeStudyMonitorDataToMonitorableModes({
          participantSessions,
          participantRosterEntries,
          testRuns,
          reviews
        });
        const generatedAt = now();
        const storedTestRun = studyMonitorData.testRuns.find(
          candidate => candidate.testRunId === testRunId
        );
        const testRunContentRelease = storedTestRun
          ? contentReleases.find(
              candidate =>
                candidate.contentReleaseId === storedTestRun.contentReleaseId
            ) ?? null
          : null;
        const effectiveTestRun =
          storedTestRun &&
          testRunContentRelease &&
          storedTestRun.status !== "completed"
            ? await persistEffectiveTestletTimerState({
                contentRelease: testRunContentRelease,
                testRun: storedTestRun,
                timestamp: generatedAt
              })
            : storedTestRun;
        const detail = buildStudyMonitorRunDetail({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          testRunId,
          generatedAt,
          participantSessions: studyMonitorData.participantSessions,
          participantRosterEntries:
            studyMonitorData.participantRosterEntries,
          testRuns: effectiveTestRun
            ? studyMonitorData.testRuns.map(candidate =>
                candidate.testRunId === testRunId
                  ? effectiveTestRun
                  : candidate
              )
            : studyMonitorData.testRuns,
          contentReleases,
          reviews: studyMonitorData.reviews
        });

        if (!detail) {
          throw new FirstSliceError(
            404,
            "study_monitor_run_not_found",
            `Study monitor run '${testRunId}' was not found in workspace '${input.workspaceKey}'.`
          );
        }

        return detail;
      },
      async listWorkspaceActivityEvents(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const activityEvents =
          await repository.listWorkspaceActivityEventsByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          );
        const limit = Math.max(1, Math.min(input.limit ?? 100, 500));

        return activityEvents
          .filter(
            activityEvent =>
              (!input.eventType || activityEvent.eventType === input.eventType) &&
              (!input.subjectType ||
                activityEvent.subjectType === input.subjectType) &&
              (!input.subjectId || activityEvent.subjectId === input.subjectId)
          )
          .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
          .slice(0, limit)
          .map(activityEvent => ({ activityEvent }));
      },
      async listParticipantTestLogs(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const [testLogs, participantSessions, testRuns] = await Promise.all([
          repository.listParticipantTestLogsByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          ),
          repository.listParticipantSessionsByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          ),
          repository.listTestRunsByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          )
        ]);

        return listParticipantTestLogsForWorkspace({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          testLogs,
          participantSessions,
          testRuns,
          loginKey: input.loginKey,
          groupKey: input.groupKey,
          groupKeys: input.groupKeys,
          bookletKey: input.bookletKey,
          testRunId: input.testRunId,
          unitKey: input.unitKey,
          logKey: input.logKey,
          limit: Math.max(1, Math.min(input.limit ?? 100, 50_000))
        });
      },
      async exportLogCsv(input) {
        const items = await this.listParticipantTestLogs({
          ...input,
          limit: input.limit ?? 50_000
        });
        return formatParticipantTestLogCsv(items);
      },
      async exportActivityCsv(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const activityEvents =
          await repository.listWorkspaceActivityEventsByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          );

        return formatWorkspaceActivityCsv({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          activityEvents
        });
      },
      async exportStudyMonitorCsv(input) {
        const summary = await this.getStudyMonitorSummary(input);

        return formatStudyMonitorCsv(summary);
      },
      async exportStudyMonitorParticipantMatrixCsv(input) {
        const matrix = await this.getStudyMonitorParticipantMatrix(input);

        return formatStudyMonitorParticipantMatrixCsv(matrix);
      },
      async exportStudyMonitorRunCsv(input) {
        const detail = await this.getStudyMonitorRunDetail(input);

        return formatStudyMonitorRunCsv(detail);
      },
      async getSourcePackageDetail(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const sourcePackage = await requireSourcePackage(repository, input.sourcePackageId);

        if (
          sourcePackage.tenantId !== workspace.tenantId ||
          sourcePackage.workspaceId !== workspace.workspaceId
        ) {
          throw new FirstSliceError(
            404,
            "source_package_not_found",
            `Source package '${input.sourcePackageId}' was not found in workspace '${input.workspaceKey}'.`
          );
        }

        const [
          allSourcePackages,
          allImportJobs,
          allContentReleases,
          activityEvents
        ] = await Promise.all([
          repository.listSourcePackagesByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          ),
          repository.listImportJobsByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          ),
          repository.listContentReleasesByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          ),
          repository.listWorkspaceActivityEventsByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          )
        ]);
        const importJobs = allImportJobs
          .filter(importJob => importJob.sourcePackageId === sourcePackage.sourcePackageId)
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
        const importJobIds = new Set(importJobs.map(importJob => importJob.importJobId));
        const contentReleases = allContentReleases
          .filter(contentRelease => importJobIds.has(contentRelease.importJobId))
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

        return {
          sourcePackage,
          importJobs,
          contentReleases,
          dependencyGraph: buildWorkspaceSourcePackageDependencyGraph({
            rootSourcePackage: sourcePackage,
            sourcePackages: allSourcePackages,
            importJobs: allImportJobs,
            contentReleases: allContentReleases,
            activityEvents
          })
        };
      },
      async downloadSourcePackage(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const sourcePackage = await requireSourcePackage(repository, input.sourcePackageId);
        if (
          sourcePackage.tenantId !== workspace.tenantId ||
          sourcePackage.workspaceId !== workspace.workspaceId
        ) {
          throw new FirstSliceError(
            404,
            "source_package_not_found",
            `Source package '${input.sourcePackageId}' was not found in workspace '${input.workspaceKey}'.`
          );
        }

        const decodedDocument = decodePersistedSourceDocument(sourcePackage);
        if (!decodedDocument) {
          throw new FirstSliceError(
            409,
            "source_package_download_unavailable",
            `Source package '${input.sourcePackageId}' has no downloadable source document.`
          );
        }

        return {
          fileName: sourcePackage.fileName,
          mediaType: decodedDocument.mediaType,
          sizeBytes: decodedDocument.bytes.byteLength,
          dataBase64: decodedDocument.bytes.toString("base64")
        };
      },
      async getSourcePackageDeletionReadiness(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const sourcePackage = await requireSourcePackage(repository, input.sourcePackageId);
        if (
          sourcePackage.tenantId !== workspace.tenantId ||
          sourcePackage.workspaceId !== workspace.workspaceId
        ) {
          throw new FirstSliceError(
            404,
            "source_package_not_found",
            `Source package '${input.sourcePackageId}' was not found in workspace '${input.workspaceKey}'.`
          );
        }

        const [importJobs, contentReleases, participantSessions, testRuns] =
          await Promise.all([
            repository.listImportJobsByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listContentReleasesByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listParticipantSessionsByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listTestRunsByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            )
          ]);

        return buildSourcePackageDeletionReadiness({
          sourcePackage,
          importJobs,
          contentReleases,
          participantSessions,
          testRuns
        });
      },
      async listSourcePackages(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const sourcePackages = await repository.listSourcePackagesByWorkspace(
          workspace.tenantId,
          workspace.workspaceId
        );
        const [importJobs, contentReleases, participantSessions, testRuns] =
          await Promise.all([
          repository.listImportJobsByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          ),
          repository.listContentReleasesByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          ),
          repository.listParticipantSessionsByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          ),
          repository.listTestRunsByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          )
        ]);

        const limit = Math.max(1, Math.min(input.limit ?? 100, 500));

        return sourcePackages
          .map<WorkspaceSourcePackageListItem>(sourcePackage => {
            const sourcePackageImportJobs = importJobs
              .filter(
                importJob => importJob.sourcePackageId === sourcePackage.sourcePackageId
              )
              .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
            const latestImportJob = sourcePackageImportJobs[0] ?? null;
            const importJobIds = new Set(
              sourcePackageImportJobs.map(importJob => importJob.importJobId)
            );
            const decodedDocument = decodePersistedSourceDocument(sourcePackage);
            const deletionReadiness = buildSourcePackageDeletionReadiness({
              sourcePackage,
              importJobs: sourcePackageImportJobs,
              contentReleases,
              participantSessions,
              testRuns
            });

            return {
              sourcePackage: {
                ...sourcePackage,
                sourceDocument: null
              },
              fileType: classifyWorkspaceSourcePackage(
                sourcePackage,
                decodedDocument
              ),
              latestImportJob,
              fileSizeBytes: decodedDocument?.bytes.byteLength ?? null,
              downloadAvailable: decodedDocument !== null,
              importJobCount: sourcePackageImportJobs.length,
              contentReleaseCount: contentReleases.filter(contentRelease =>
                importJobIds.has(contentRelease.importJobId)
              ).length,
              canDelete: deletionReadiness.canDelete,
              blockingDependencyCount:
                deletionReadiness.blockingDependencies.length
            };
          })
          .filter(
            item =>
              (!input.status || item.sourcePackage.status === input.status) &&
              (!input.fileType || item.fileType === input.fileType) &&
              (!input.mediaType || item.sourcePackage.mediaType === input.mediaType) &&
              (!input.fileName || item.sourcePackage.fileName === input.fileName) &&
              (!input.latestImportStatus ||
                item.latestImportJob?.status === input.latestImportStatus)
          )
          .sort((left, right) =>
            right.sourcePackage.uploadedAt.localeCompare(
              left.sourcePackage.uploadedAt
            )
          )
          .slice(0, limit);
      },
      async exportSourcePackagesCsv(input) {
        const items = await this.listSourcePackages(input);

        return formatSourcePackagesCsv({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          items
        });
      },
      async getImportJobDetail(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const importJob = await repository.getImportJobById(input.importJobId);

        if (
          !importJob ||
          importJob.tenantId !== workspace.tenantId ||
          importJob.workspaceId !== workspace.workspaceId
        ) {
          throw new FirstSliceError(
            404,
            "import_job_not_found",
            `Import job '${input.importJobId}' was not found in workspace '${input.workspaceKey}'.`
          );
        }

        const sourcePackage = await repository.getSourcePackageById(
          importJob.sourcePackageId
        );
        const [contentReleases, activityEvents] = await Promise.all([
          repository.listContentReleasesByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          ),
          repository.listWorkspaceActivityEventsByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          )
        ]);
        const contentRelease =
          contentReleases.find(
            candidate => candidate.importJobId === importJob.importJobId
          ) ?? null;
        const rosterImportDetails = activityEvents.find(
          activityEvent =>
            activityEvent.eventType === "participant_roster_imported" &&
            activityEvent.details.importJobId === importJob.importJobId
        )?.details;
        const participantRosterImport =
          rosterImportDetails &&
          Array.isArray(rosterImportDetails.sourceFileNames) &&
          rosterImportDetails.sourceFileNames.every(
            fileName => typeof fileName === "string"
          ) &&
          typeof rosterImportDetails.importedCount === "number" &&
          Number.isSafeInteger(rosterImportDetails.importedCount) &&
          typeof rosterImportDetails.updatedCount === "number" &&
          Number.isSafeInteger(rosterImportDetails.updatedCount) &&
          typeof rosterImportDetails.operationalLoginCandidateCount === "number" &&
          Number.isSafeInteger(
            rosterImportDetails.operationalLoginCandidateCount
          )
            ? {
                sourceFileNames: rosterImportDetails.sourceFileNames,
                importedCount: rosterImportDetails.importedCount,
                updatedCount: rosterImportDetails.updatedCount,
                operationalLoginCandidateCount:
                  rosterImportDetails.operationalLoginCandidateCount
              }
            : null;

        return {
          importJob,
          sourcePackage,
          contentRelease,
          participantRosterImport
        };
      },
      async listImportJobs(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const sourcePackages = await repository.listSourcePackagesByWorkspace(
          workspace.tenantId,
          workspace.workspaceId
        );
        const importJobs = await repository.listImportJobsByWorkspace(
          workspace.tenantId,
          workspace.workspaceId
        );

        const limit = Math.max(1, Math.min(input.limit ?? 100, 500));

        return importJobs
          .filter(
            importJob =>
              (!input.status || importJob.status === input.status) &&
              (!input.sourcePackageId ||
                importJob.sourcePackageId === input.sourcePackageId)
          )
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
          .slice(0, limit)
          .map<WorkspaceImportJobListItem>(importJob => ({
            importJob,
            sourcePackage:
              sourcePackages.find(
                sourcePackage =>
                  sourcePackage.sourcePackageId === importJob.sourcePackageId
              ) ?? null
          }));
      },
      async exportImportJobsCsv(input) {
        const items = await this.listImportJobs(input);

        return formatImportJobsCsv({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          items
        });
      },
      async getContentReleaseDetail(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const contentRelease = await requireContentRelease(
          repository,
          input.contentReleaseId
        );

        if (
          contentRelease.tenantId !== workspace.tenantId ||
          contentRelease.workspaceId !== workspace.workspaceId
        ) {
          throw new FirstSliceError(
            404,
            "content_release_not_found",
            `Content release '${input.contentReleaseId}' was not found in workspace '${input.workspaceKey}'.`
          );
        }

        const importJob = await repository.getImportJobById(contentRelease.importJobId);
        const sourcePackage = importJob
          ? await repository.getSourcePackageById(importJob.sourcePackageId)
          : null;
        const allParticipantSessions = (
          await repository.listParticipantSessionsByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          )
        );
        const participantSessions = allParticipantSessions
          .filter(
            participantSession =>
              participantSession.contentReleaseId === contentRelease.contentReleaseId
          )
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
        const participantRosterEntries =
          await repository.listParticipantRosterEntriesByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          );
        const sessionIds = new Set(
          participantSessions.map(
            participantSession => participantSession.participantSessionId
          )
        );
        const testRuns = (
          await repository.listTestRunsByWorkspace(workspace.tenantId, workspace.workspaceId)
        )
          .filter(testRun => sessionIds.has(testRun.participantSessionId))
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
        const allTestRuns = await repository.listTestRunsByWorkspace(
          workspace.tenantId,
          workspace.workspaceId
        );
        const allImportJobs = await repository.listImportJobsByWorkspace(
          workspace.tenantId,
          workspace.workspaceId
        );
        const allSourcePackages = await repository.listSourcePackagesByWorkspace(
          workspace.tenantId,
          workspace.workspaceId
        );
        const allContentReleases = await repository.listContentReleasesByWorkspace(
          workspace.tenantId,
          workspace.workspaceId
        );
        const activatedReleases = [...allContentReleases]
          .filter(candidate => candidate.activatedAt !== null)
          .sort((left, right) =>
            (left.activatedAt ?? left.createdAt).localeCompare(
              right.activatedAt ?? right.createdAt
            )
          );
        const activatedIndex = activatedReleases.findIndex(
          candidate =>
            candidate.contentReleaseId === contentRelease.contentReleaseId
        );
        const previousActivatedContentReleaseId =
          activatedIndex > 0
            ? activatedReleases[activatedIndex - 1]?.contentReleaseId ?? null
            : null;
        const nextActivatedContentReleaseId =
          activatedIndex >= 0 &&
          activatedIndex < activatedReleases.length - 1
            ? activatedReleases[activatedIndex + 1]?.contentReleaseId ?? null
            : null;

        return {
          contentRelease,
          importJob,
          sourcePackage,
          participantSessions,
          participantRosterEntries,
          testRuns,
          previousActivatedContentReleaseId,
          nextActivatedContentReleaseId,
          workspaceReleaseHistory: buildWorkspaceContentReleaseListItems({
            contentReleases: allContentReleases,
            importJobs: allImportJobs,
            sourcePackages: allSourcePackages,
            participantSessions: allParticipantSessions,
            testRuns: allTestRuns
          })
        };
      },
      async listParticipantSessions(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const participantSessions =
          await repository.listParticipantSessionsByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          );
        const participantRosterEntries =
          await repository.listParticipantRosterEntriesByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          );
        const testRuns = await repository.listTestRunsByWorkspace(
          workspace.tenantId,
          workspace.workspaceId
        );
        const contentReleases = await repository.listContentReleasesByWorkspace(
          workspace.tenantId,
          workspace.workspaceId
        );
        const participantRosterEntriesByLoginKey = new Map(
          participantRosterEntries.map(entry => [entry.loginKey, entry])
        );

        const limit = Math.max(1, Math.min(input.limit ?? 100, 500));

        return participantSessions
          .map<WorkspaceParticipantSessionListItem>(participantSession => {
            const sessionRuns = testRuns
              .filter(
                testRun =>
                  testRun.participantSessionId ===
                  participantSession.participantSessionId
              )
              .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

            return {
              participantSession,
              participantRosterEntry:
                participantRosterEntriesByLoginKey.get(
                  participantSession.loginKey
                ) ?? null,
              latestTestRun: sessionRuns[0] ?? null,
              contentRelease:
                contentReleases.find(
                  contentRelease =>
                    contentRelease.contentReleaseId ===
                    participantSession.contentReleaseId
                ) ?? null
            };
          })
          .filter(item => {
            const participantSession = item.participantSession;
            if (input.status && participantSession.status !== input.status) {
              return false;
            }
            if (input.groupKey && participantSession.groupKey !== input.groupKey) {
              return false;
            }
            if (input.loginKey && participantSession.loginKey !== input.loginKey) {
              return false;
            }
            if (
              input.bookletKey &&
              item.latestTestRun?.bookletKey !== input.bookletKey &&
              item.participantRosterEntry?.bookletKey !== input.bookletKey
            ) {
              return false;
            }
            if (
              input.contentReleaseId &&
              participantSession.contentReleaseId !== input.contentReleaseId
            ) {
              return false;
            }
            return true;
          })
          .sort((left, right) =>
            right.participantSession.createdAt.localeCompare(
              left.participantSession.createdAt
            )
          )
          .slice(0, limit);
      },
      async exportParticipantSessionsCsv(input) {
        const items = await this.listParticipantSessions(input);
        return formatParticipantSessionsCsv({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          items
        });
      },
      async importParticipantRoster(input) {
        return importParticipantRosterDocumentsForWorkspace({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          rosterDocuments: [
            {
              sourceFileName: "participant-roster.xml",
              rosterText: input.rosterText
            }
          ]
        });
      },
      async listParticipantRoster(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const entries = await repository.listParticipantRosterEntriesByWorkspace(
          workspace.tenantId,
          workspace.workspaceId
        );
        const [activeRelease, operationalLoginCandidates] = await Promise.all([
          getActiveWorkspaceRelease(
            repository,
            workspace.tenantId,
            workspace.workspaceId
          ),
          repository.listOperationalLoginMigrationCandidatesByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          )
        ]);
        return {
          items: buildParticipantRosterReadItems(entries, activeRelease),
          operationalLoginCandidates
        };
      },
      async exportParticipantRosterCsv(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const entries = await repository.listParticipantRosterEntriesByWorkspace(
          workspace.tenantId,
          workspace.workspaceId
        );
        const items = buildParticipantRosterReadItems(
          entries,
          await getActiveWorkspaceRelease(
            repository,
            workspace.tenantId,
            workspace.workspaceId
          )
        );
        return formatParticipantRosterCsv({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          items
        });
      },
      async getParticipantSessionDetail(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const participantSession = await requireParticipantSession(
          repository,
          input.participantSessionId
        );

        if (
          participantSession.tenantId !== workspace.tenantId ||
          participantSession.workspaceId !== workspace.workspaceId
        ) {
          throw new FirstSliceError(
            404,
            "participant_session_not_found",
            `Participant session '${input.participantSessionId}' was not found in workspace '${input.workspaceKey}'.`
          );
        }

        const [
          contentRelease,
          rawTestRuns,
          workspaceReviews,
          participantRosterEntries
        ] = await Promise.all([
          repository.getContentReleaseById(participantSession.contentReleaseId),
          repository.listTestRunsByParticipantSessionId(
            participantSession.participantSessionId
          ),
          repository.listWorkspaceReviewsByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          ),
          repository.listParticipantRosterEntriesByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          )
        ]);
        const testRuns = rawTestRuns
          .map(normalizeTestRun)
          .sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));
        const testRunIds = new Set(testRuns.map(testRun => testRun.testRunId));
        const reviews = workspaceReviews
          .map(normalizeWorkspaceReview)
          .filter(
            review =>
              review.participantSessionId ===
                participantSession.participantSessionId &&
              testRunIds.has(review.testRunId)
          )
          .sort(
            (left, right) =>
              right.updatedAt.localeCompare(left.updatedAt) ||
              right.reviewId.localeCompare(left.reviewId)
          );

        return {
          participantSession,
          participantRosterEntry:
            participantRosterEntries.find(
              entry => entry.loginKey === participantSession.loginKey
            ) ?? null,
          contentRelease: contentRelease ?? null,
          testRuns,
          runSummaries: testRuns.map(testRun => ({
            testRun,
            responseCount: Object.keys(testRun.unitResponses).length,
            reviewCount: reviews.filter(
              review => review.testRunId === testRun.testRunId
            ).length
          })),
          responseCount: testRuns.reduce(
            (total, testRun) => total + Object.keys(testRun.unitResponses).length,
            0
          ),
          reviewCount: reviews.length,
          reviews
        };
      },
      async listDetailedResponses(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const [participantSessions, participantRosterEntries, testRuns] =
          await Promise.all([
            repository.listParticipantSessionsByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listParticipantRosterEntriesByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listTestRunsByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            )
          ]);

        return listDetailedResponsesForWorkspace({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          participantSessions,
          participantRosterEntries,
          testRuns,
          loginKey: input.loginKey,
          groupKey: input.groupKey,
          groupKeys: input.groupKeys,
          bookletKey: input.bookletKey,
          participantSessionId: input.participantSessionId,
          testRunId: input.testRunId,
          unitKey: input.unitKey,
          status: input.status,
          limit: input.limit
        });
      },
      async listGroupResults(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const [
          participantSessions,
          testRuns,
          reviews,
          testLogs
        ] = await Promise.all([
          repository.listParticipantSessionsByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          ),
          repository.listTestRunsByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          ),
          repository.listWorkspaceReviewsByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          ),
          repository.listParticipantTestLogsByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          )
        ]);

        return listGroupResultsForWorkspace({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          participantSessions,
          testRuns,
          reviews,
          testLogs
        });
      },
      async exportResponseCsv(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const [participantSessions, participantRosterEntries, testRuns] =
          await Promise.all([
            repository.listParticipantSessionsByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listParticipantRosterEntriesByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listTestRunsByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            )
          ]);

        return formatResponseCsv({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          participantSessions,
          participantRosterEntries,
          testRuns,
          loginKey: input.loginKey,
          groupKey: input.groupKey,
          groupKeys: input.groupKeys,
          bookletKey: input.bookletKey,
          participantSessionId: input.participantSessionId,
          testRunId: input.testRunId,
          unitKey: input.unitKey,
          status: input.status,
          limit: input.limit ?? 50_000,
          limitMaximum: 50_000
        });
      },
      async exportOriginalResultArchive(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const groupKeys = Array.from(
          new Set(input.groupKeys.map(groupKey => groupKey.trim()).filter(Boolean))
        ).sort();
        if (groupKeys.length === 0) {
          throw new FirstSliceError(
            400,
            "result_archive_group_required",
            "At least one result group must be selected."
          );
        }
        if (groupKeys.length > 100) {
          throw new FirstSliceError(
            400,
            "result_archive_group_limit_exceeded",
            "At most 100 result groups can be exported at once."
          );
        }
        const [
          participantSessions,
          participantRosterEntries,
          testRuns,
          reviews,
          testLogs,
          contentReleases
        ] = await Promise.all([
          repository.listParticipantSessionsByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          ),
          repository.listParticipantRosterEntriesByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          ),
          repository.listTestRunsByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          ),
          repository.listWorkspaceReviewsByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          ),
          repository.listParticipantTestLogsByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          ),
          repository.listContentReleasesByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          )
        ]);
        return createOriginalResultArchive({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          groupKeys,
          generatedAt: now(),
          participantSessions,
          participantRosterEntries,
          testRuns,
          reviews,
          testLogs,
          contentReleases
        });
      },
      async getContentReleaseActivationReadiness(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const contentRelease = await requireContentRelease(
          repository,
          input.contentReleaseId
        );

        if (
          contentRelease.tenantId !== workspace.tenantId ||
          contentRelease.workspaceId !== workspace.workspaceId
        ) {
          throw new FirstSliceError(
            404,
            "content_release_not_found",
            `Content release '${input.contentReleaseId}' was not found in workspace '${input.workspaceKey}'.`
          );
        }

        const activeRelease = await getActiveWorkspaceRelease(
          repository,
          workspace.tenantId,
          workspace.workspaceId
        );
        const blockingOpenRuns =
          activeRelease &&
          activeRelease.contentReleaseId !== contentRelease.contentReleaseId
            ? await listOpenMonitorRunsForActiveRelease({
                repository,
                tenantId: workspace.tenantId,
                workspaceId: workspace.workspaceId,
                activeContentRelease: activeRelease,
                timestamp: now()
              })
            : [];
        const participantRosterEntries =
          await repository.listParticipantRosterEntriesByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          );
        const participantRosterWarnings = buildParticipantRosterReadItems(
          participantRosterEntries,
          contentRelease
        ).filter(item => item.validationWarnings.length > 0);

        return {
          contentRelease,
          activeContentReleaseId: activeRelease?.contentReleaseId ?? null,
          canActivate: blockingOpenRuns.length === 0,
          blockingOpenRuns,
          participantRosterWarnings
        };
      },
      async listContentReleases(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const importJobs = await repository.listImportJobsByWorkspace(
          workspace.tenantId,
          workspace.workspaceId
        );
        const sourcePackages = await repository.listSourcePackagesByWorkspace(
          workspace.tenantId,
          workspace.workspaceId
        );
        const participantSessions =
          await repository.listParticipantSessionsByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          );
        const testRuns = await repository.listTestRunsByWorkspace(
          workspace.tenantId,
          workspace.workspaceId
        );
        const contentReleases = await repository.listContentReleasesByWorkspace(
          workspace.tenantId,
          workspace.workspaceId
        );
        const matchingImportJobIds = input.sourcePackageId
          ? new Set(
              importJobs
                .filter(
                  importJob => importJob.sourcePackageId === input.sourcePackageId
                )
                .map(importJob => importJob.importJobId)
            )
          : null;
        const limit = Math.max(1, Math.min(input.limit ?? 100, 500));

        return buildWorkspaceContentReleaseListItems({
          contentReleases: contentReleases.filter(
            contentRelease =>
              (!input.status || contentRelease.status === input.status) &&
              (!input.importJobId ||
                contentRelease.importJobId === input.importJobId) &&
              (!matchingImportJobIds ||
                matchingImportJobIds.has(contentRelease.importJobId))
          ),
          importJobs,
          sourcePackages,
          participantSessions,
          testRuns
        }).slice(0, limit);
      },
      async exportContentReleasesCsv(input) {
        const items = await this.listContentReleases(input);

        return formatContentReleasesCsv({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          items
        });
      },
      async listSystemCheckReports(input) {
        return readSystemCheckReports(input);
      },
      async exportSystemCheckReportsCsv(input) {
        return exportSystemCheckReportsCsv(input);
      },
      async exportSystemCheckReportsJson(input) {
        return exportSystemCheckReportsJson(input);
      },
      async getSystemCheckReportStatistics(input) {
        return buildSystemCheckReportStatistics(input);
      }
    },
    workspaceResults: {
      async importSystemCheckReport(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const originalFileName = String(input.fileName ?? "").trim();
        if (
          !originalFileName ||
          originalFileName.length > 255 ||
          /[/\\]/.test(originalFileName) ||
          !/\.json$/i.test(originalFileName)
        ) {
          throw new FirstSliceError(
            400,
            "system_check_report_file_name_invalid",
            "A plain JSON report filename with at most 255 characters is required."
          );
        }
        if (
          !input.report ||
          typeof input.report !== "object" ||
          Array.isArray(input.report)
        ) {
          throw new FirstSliceError(
            400,
            "system_check_report_invalid",
            "The imported system-check report must be a JSON object."
          );
        }
        const source = input.report as Record<string, unknown>;
        const checkId = String(source.checkId ?? "").trim();
        if (!checkId || checkId.length > 200) {
          throw new FirstSliceError(
            400,
            "system_check_report_invalid",
            "The imported system-check report must contain a valid checkId."
          );
        }
        const systemCheck = await requireWorkspaceSystemCheck({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          checkId
        });
        const importedAt = now();
        const requestedModifiedAt = String(input.modifiedAt ?? "").trim();
        const fileModifiedAt = requestedModifiedAt
          ? parseLegacySystemCheckDate(requestedModifiedAt)
          : importedAt;
        if (!fileModifiedAt) {
          throw new FirstSliceError(
            400,
            "system_check_report_modified_at_invalid",
            "The system-check report file modification timestamp is invalid."
          );
        }
        const sourceDate = String(source.date ?? "").trim();
        if (sourceDate.length > 100) {
          throw new FirstSliceError(
            400,
            "system_check_report_invalid",
            "The imported system-check report date is too long."
          );
        }
        const createdAt =
          (sourceDate ? parseLegacySystemCheckDate(sourceDate) : null) ??
          fileModifiedAt;
        const sourceCheckLabel = String(source.checkLabel ?? "").trim();
        const sourceTitle = String(source.title ?? "").trim();
        if (sourceCheckLabel.length > 500 || sourceTitle.length > 500) {
          throw new FirstSliceError(
            400,
            "system_check_report_invalid",
            "The imported system-check report label or title is too long."
          );
        }
        const section = (current: string, deprecated: string): unknown =>
          source[current] !== undefined
            ? source[current]
            : source[deprecated] ?? [];
        const report: SystemCheckReport = {
          systemCheckReportId: idGenerator(),
          tenantId: workspace.tenantId,
          workspaceId: workspace.workspaceId,
          sourcePackageId: systemCheck.sourcePackageId,
          originalFileName,
          fileModifiedAt,
          sourceDate: sourceDate || formatLegacySystemCheckDate(createdAt),
          checkId,
          checkLabel: sourceCheckLabel || systemCheck.displayLabel,
          title:
            sourceTitle ||
            sourceCheckLabel ||
            systemCheck.displayLabel,
          responses: source.responses ?? "",
          environment: normalizeSystemCheckReportEntries(
            "environment",
            section("environment", "envData")
          ),
          network: normalizeSystemCheckReportEntries(
            "network",
            section("network", "netData")
          ),
          questionnaire: normalizeSystemCheckReportEntries(
            "questionnaire",
            section("questionnaire", "questData")
          ),
          unit: normalizeSystemCheckReportEntries(
            "unit",
            section("unit", "unitData")
          ),
          createdAt
        };
        report.sourceDigest = systemCheckReportMigrationDigest(report);
        const existingReport = (
          await readSystemCheckReportRecords({
            tenantKey: input.tenantKey,
            workspaceKey: input.workspaceKey
          })
        )
          .map(record => record.report)
          .find(
            candidate =>
              candidate.originalFileName?.toUpperCase() ===
                originalFileName.toUpperCase() &&
              (candidate.sourceDigest ??
                systemCheckReportMigrationDigest(candidate)) ===
                report.sourceDigest
          );
        if (existingReport) {
          return {
            report: existingReport,
            disposition: "already_imported"
          };
        }
        await recordWorkspaceActivity({
          tenantId: workspace.tenantId,
          workspaceId: workspace.workspaceId,
          eventType: "system_check_report_saved",
          subjectType: "system_check_report",
          subjectId: report.systemCheckReportId,
          summary: `Imported legacy system-check report '${originalFileName}' for '${report.checkId}'.`,
          details: {
            report,
            importFormat: "original_testcenter_json",
            importedAt
          }
        });
        return { report, disposition: "imported" };
      },
      async deleteGroupResults(input) {
        const groupKey = normalizeGroupKey(input.groupKey);
        const deletion = await deleteWorkspaceGroupResults({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          groupKeys: [groupKey],
          legacySingleGroupActivity: true
        });

        return {
          tenantKey: deletion.tenantKey,
          workspaceKey: deletion.workspaceKey,
          groupKey,
          deletedTestRunCount: deletion.deletedTestRunCount,
          deletedResponseCount: deletion.deletedResponseCount,
          deletedReviewCount: deletion.deletedReviewCount,
          deletedTestLogCount: deletion.deletedTestLogCount,
          affectedParticipantSessionIds: deletion.affectedParticipantSessionIds,
          deletedTestRunIds: deletion.deletedTestRunIds
        };
      },
      async deleteGroupResultsBulk(input) {
        if (input.confirmation !== input.workspaceKey) {
          throw new FirstSliceError(
            400,
            "group_result_delete_confirmation_mismatch",
            "The workspace key confirmation does not match."
          );
        }
        if (!Array.isArray(input.groupKeys) || input.groupKeys.length === 0) {
          throw new FirstSliceError(
            400,
            "group_result_group_keys_required",
            "At least one group key is required."
          );
        }
        return deleteWorkspaceGroupResults({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          groupKeys: input.groupKeys
        });
      },
      async deleteSystemCheckReports(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        if (input.confirmation !== input.workspaceKey) {
          throw new FirstSliceError(
            400,
            "system_check_report_delete_confirmation_mismatch",
            "The workspace key confirmation does not match."
          );
        }
        if (!Array.isArray(input.checkIds) || input.checkIds.length === 0) {
          throw new FirstSliceError(
            400,
            "system_check_report_check_ids_required",
            "At least one system-check ID is required."
          );
        }
        const checkIds = Array.from(
          new Set(input.checkIds.map(checkId => String(checkId).trim()).filter(Boolean))
        );
        if (checkIds.length === 0 || checkIds.length > 100) {
          throw new FirstSliceError(
            400,
            "system_check_report_check_ids_invalid",
            "Between 1 and 100 distinct system-check IDs are required."
          );
        }
        const normalizedCheckIds = new Set(checkIds.map(checkId => checkId.toUpperCase()));
        const records = (await readSystemCheckReportRecords({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey
        })).filter(record => normalizedCheckIds.has(record.report.checkId.toUpperCase()));
        const deletedReportIds = records.map(record => record.report.systemCheckReportId);
        const deletedCount = await repository.deleteWorkspaceActivityEventsByIds(
          records.map(record => record.activityEventId)
        );
        const deletedAt = now();
        await recordWorkspaceActivity({
          tenantId: workspace.tenantId,
          workspaceId: workspace.workspaceId,
          eventType: "system_check_reports_deleted",
          subjectType: "workspace",
          subjectId: workspace.workspaceId,
          summary: `Deleted ${deletedCount} system-check report(s) for ${checkIds.join(", ")}.`,
          details: { checkIds, deletedReportIds, deletedCount }
        });
        return { checkIds, deletedReportIds, deletedCount, deletedAt };
      }
    },
    workspaceReview: {
      async listReviews(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const [reviews, participantSessions, participantRosterEntries, testRuns] =
          await Promise.all([
            repository.listWorkspaceReviewsByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listParticipantSessionsByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listParticipantRosterEntriesByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listTestRunsByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            )
          ]);

        return buildWorkspaceReviewListItems({
          reviews,
          participantSessions,
          participantRosterEntries,
          testRuns,
          loginKey: input.loginKey,
          groupKey: input.groupKey,
          groupKeys: input.groupKeys,
          bookletKey: input.bookletKey,
          participantSessionId: input.participantSessionId,
          testRunId: input.testRunId,
          unitKey: input.unitKey,
          reviewerId: input.reviewerId,
          category: input.category,
          limit: input.limit
        });
      },
      async createReview(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const participantSession = await requireParticipantSession(
          repository,
          input.participantSessionId
        );
        const testRun = await repository.getTestRunById(input.testRunId);

        if (
          participantSession.tenantId !== workspace.tenantId ||
          participantSession.workspaceId !== workspace.workspaceId
        ) {
          throw new FirstSliceError(
            404,
            "participant_session_not_found",
            `Participant session '${input.participantSessionId}' was not found in workspace '${input.workspaceKey}'.`
          );
        }

        if (
          !testRun ||
          testRun.tenantId !== workspace.tenantId ||
          testRun.workspaceId !== workspace.workspaceId ||
          testRun.participantSessionId !== participantSession.participantSessionId
        ) {
          throw new FirstSliceError(
            404,
            "test_run_not_found",
            `Test run '${input.testRunId}' was not found in workspace '${input.workspaceKey}'.`
          );
        }

        const normalizedUnitKey = normalizeOptionalUnitKey(input.unitKey);
        let originalUnitId: string | null = null;
        if (normalizedUnitKey) {
          const contentRelease = await requireContentRelease(
            repository,
            testRun.contentReleaseId
          );
          const unitEntry = requireRuntimeUnitForBooklet(
            contentRelease,
            testRun.bookletKey,
            normalizedUnitKey
          );
          originalUnitId = unitEntry.originalUnitId ?? unitEntry.unitKey;
        }

        const categories = normalizeReviewCategories(
          input.categories,
          input.category
        );
        const page = normalizeOptionalReviewPage(input.page);
        const pageLabel = normalizeOptionalReviewPageLabel(input.pageLabel);
        if (!normalizedUnitKey && (page !== null || pageLabel !== null)) {
          throw new FirstSliceError(
            400,
            "review_page_requires_unit",
            "Task-page metadata requires a unitKey."
          );
        }
        const timestamp = now();
        const review: WorkspaceReview = {
          reviewId: idGenerator(),
          tenantId: workspace.tenantId,
          workspaceId: workspace.workspaceId,
          participantSessionId: participantSession.participantSessionId,
          testRunId: testRun.testRunId,
          unitKey: normalizedUnitKey,
          originalUnitId,
          page,
          pageLabel,
          userAgent: normalizeReviewUserAgent(input.userAgent),
          reviewerId: normalizeReviewText(
            input.reviewerId,
            "reviewerId",
            "review_reviewer_required"
          ),
          category: categories.join(" "),
          categories,
          priority: normalizeReviewPriority(input.priority),
          comment: normalizeReviewText(
            input.comment,
            "comment",
            "review_comment_required"
          ),
          createdAt: timestamp,
          updatedAt: timestamp
        };

        await repository.saveWorkspaceReview(review);
        await recordWorkspaceActivity({
          tenantId: workspace.tenantId,
          workspaceId: workspace.workspaceId,
          eventType: "review_created",
          actorId: review.reviewerId,
          subjectType: "test_run",
          subjectId: review.testRunId,
          summary: `Review '${review.reviewId}' created for test run '${review.testRunId}'.`,
          details: {
            reviewId: review.reviewId,
            participantSessionId: review.participantSessionId,
            unitKey: review.unitKey,
            originalUnitId: review.originalUnitId,
            page: review.page,
            pageLabel: review.pageLabel,
            userAgent: review.userAgent,
            category: review.category,
            categories: review.categories,
            priority: review.priority
          }
        });
        const participantRosterEntries =
          await repository.listParticipantRosterEntriesByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          );

        return {
          review,
          participantSession,
          participantRosterEntry:
            participantRosterEntries.find(
              entry => entry.loginKey === participantSession.loginKey
            ) ?? null,
          testRun: normalizeTestRun(testRun)
        };
      },
      async updateReview(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const storedExistingReview = await repository.getWorkspaceReviewById(
          input.reviewId
        );

        if (
          !storedExistingReview ||
          storedExistingReview.tenantId !== workspace.tenantId ||
          storedExistingReview.workspaceId !== workspace.workspaceId
        ) {
          throw new FirstSliceError(
            404,
            "review_not_found",
            `Review '${input.reviewId}' was not found in workspace '${input.workspaceKey}'.`
          );
        }
        const existingReview = normalizeWorkspaceReview(storedExistingReview);

        const nextUnitKey =
          input.unitKey === undefined
            ? existingReview.unitKey
            : normalizeOptionalUnitKey(input.unitKey);

        if (nextUnitKey) {
          const testRun = await repository.getTestRunById(existingReview.testRunId);

          if (
            !testRun ||
            testRun.tenantId !== workspace.tenantId ||
            testRun.workspaceId !== workspace.workspaceId
          ) {
            throw new FirstSliceError(
              404,
              "test_run_not_found",
              `Test run '${existingReview.testRunId}' was not found in workspace '${input.workspaceKey}'.`
            );
          }

          const contentRelease = await requireContentRelease(
            repository,
            testRun.contentReleaseId
          );
          requireRuntimeUnitForBooklet(
            contentRelease,
            testRun.bookletKey,
            nextUnitKey
          );
        }

        const categories =
          input.categories === undefined && input.category === undefined
            ? existingReview.categories
            : normalizeReviewCategories(input.categories, input.category);
        const page = nextUnitKey
          ? input.page === undefined
            ? existingReview.page
            : normalizeOptionalReviewPage(input.page)
          : null;
        const pageLabel = nextUnitKey
          ? input.pageLabel === undefined
            ? existingReview.pageLabel
            : normalizeOptionalReviewPageLabel(input.pageLabel)
          : null;
        const review: WorkspaceReview = {
          ...existingReview,
          unitKey: nextUnitKey,
          page,
          pageLabel,
          reviewerId:
            input.reviewerId === undefined
              ? existingReview.reviewerId
              : normalizeReviewText(
                  input.reviewerId,
                  "reviewerId",
                  "review_reviewer_required"
                ),
          category: categories.join(" "),
          categories,
          priority:
            input.priority === undefined
              ? existingReview.priority
              : normalizeReviewPriority(input.priority),
          comment:
            input.comment === undefined
              ? existingReview.comment
              : normalizeReviewText(
                  input.comment,
                  "comment",
                  "review_comment_required"
                ),
          updatedAt: now()
        };

        await repository.saveWorkspaceReview(review);
        await recordWorkspaceActivity({
          tenantId: workspace.tenantId,
          workspaceId: workspace.workspaceId,
          eventType: "review_updated",
          actorId: review.reviewerId,
          subjectType: "test_run",
          subjectId: review.testRunId,
          summary: `Review '${review.reviewId}' updated.`,
          details: {
            reviewId: review.reviewId,
            participantSessionId: review.participantSessionId,
            unitKey: review.unitKey,
            page: review.page,
            pageLabel: review.pageLabel,
            category: review.category,
            categories: review.categories,
            priority: review.priority
          }
        });

        const [participantSession, testRun, participantRosterEntries] =
          await Promise.all([
            repository.getParticipantSessionById(review.participantSessionId),
            repository.getTestRunById(review.testRunId),
            repository.listParticipantRosterEntriesByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            )
          ]);

        return {
          review,
          participantSession,
          participantRosterEntry: participantSession
            ? participantRosterEntries.find(
                entry => entry.loginKey === participantSession.loginKey
              ) ?? null
            : null,
          testRun: testRun ? normalizeTestRun(testRun) : null
        };
      },
      async deleteReview(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const review = await repository.getWorkspaceReviewById(input.reviewId);

        if (
          !review ||
          review.tenantId !== workspace.tenantId ||
          review.workspaceId !== workspace.workspaceId
        ) {
          throw new FirstSliceError(
            404,
            "review_not_found",
            `Review '${input.reviewId}' was not found in workspace '${input.workspaceKey}'.`
          );
        }

        await repository.deleteWorkspaceReview(review.reviewId);
        await recordWorkspaceActivity({
          tenantId: workspace.tenantId,
          workspaceId: workspace.workspaceId,
          eventType: "review_deleted",
          actorId: review.reviewerId,
          subjectType: "test_run",
          subjectId: review.testRunId,
          summary: `Review '${review.reviewId}' deleted.`,
          details: {
            reviewId: review.reviewId,
            participantSessionId: review.participantSessionId,
            unitKey: review.unitKey,
            page: review.page,
            pageLabel: review.pageLabel,
            category: review.category,
            categories: review.categories,
            priority: review.priority
          }
        });

        return review.reviewId;
      },
      async exportReviewCsv(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const [reviews, participantSessions, participantRosterEntries, testRuns] =
          await Promise.all([
            repository.listWorkspaceReviewsByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listParticipantSessionsByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listParticipantRosterEntriesByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listTestRunsByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            )
          ]);

        return formatReviewCsv({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          reviews,
          participantSessions,
          participantRosterEntries,
          testRuns,
          loginKey: input.loginKey,
          groupKey: input.groupKey,
          groupKeys: input.groupKeys,
          bookletKey: input.bookletKey,
          participantSessionId: input.participantSessionId,
          testRunId: input.testRunId,
          unitKey: input.unitKey,
          reviewerId: input.reviewerId,
          category: input.category,
          limit: input.limit ?? 50_000,
          limitMaximum: 50_000
        });
      }
    },
    contentIntake: {
      async createSourcePackage(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const sourceDocument = normalizeOptionalSourceDocument(
          input.sourceDocument
        );
        const sourcePackage: SourcePackage = {
          sourcePackageId: idGenerator(),
          tenantId: workspace.tenantId,
          workspaceId: workspace.workspaceId,
          fileName: normalizeSourcePackageText(
            input.fileName,
            "fileName",
            "source_package_file_name_required"
          ),
          mediaType: normalizeSourcePackageText(
            input.mediaType,
            "mediaType",
            "source_package_media_type_required"
          ),
          contentStructure: input.contentStructure ?? null,
          sourceDocument: sourceDocument ?? null,
          status: "uploaded",
          uploadedAt: now()
        };
        const existingSourcePackages =
          await repository.listSourcePackagesByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          );
        const duplicateFileName = existingSourcePackages.find(
          existingSourcePackage =>
            existingSourcePackage.fileName.trim().toLowerCase() ===
            sourcePackage.fileName.toLowerCase()
        );
        if (duplicateFileName) {
          throw new FirstSliceError(
            409,
            "source_package_file_name_duplicate",
            `Source package file name '${sourcePackage.fileName}' already exists. Create a replacement for source package '${duplicateFileName.sourcePackageId}' to preserve its version history.`
          );
        }
        const xmlFileIdentity =
          readStandaloneTestcenterXmlFileIdentity(sourcePackage);
        const duplicateIdentity = xmlFileIdentity
          ? existingSourcePackages.find(existingSourcePackage => {
              const existingIdentity =
                readStandaloneTestcenterXmlFileIdentity(existingSourcePackage);
              return (
                existingIdentity?.fileType === xmlFileIdentity.fileType &&
                existingIdentity.id.toUpperCase() ===
                  xmlFileIdentity.id.toUpperCase()
              );
            })
          : null;
        if (xmlFileIdentity && duplicateIdentity) {
          const normalizedFileType = xmlFileIdentity.fileType.toLowerCase();
          const identityConflict =
            xmlFileIdentity.source === "roster"
              ? "A Testtakers roster with the same case-insensitive group and login assignments already exists"
              : `${xmlFileIdentity.fileType} id '${xmlFileIdentity.id}' already exists`;
          throw new FirstSliceError(
            409,
            `source_package_${normalizedFileType}_id_duplicate`,
            `${identityConflict} in source package '${duplicateIdentity.fileName}'. Create a replacement for source package '${duplicateIdentity.sourcePackageId}' to preserve its version history.`
          );
        }
        const veronaPlayerResourceId =
          readStandaloneVeronaPlayerResourceId(sourcePackage);
        const duplicateVeronaPlayer = veronaPlayerResourceId
          ? existingSourcePackages.find(existingSourcePackage => {
              const existingResourceId =
                readStandaloneVeronaPlayerResourceId(existingSourcePackage);
              return (
                existingResourceId?.toUpperCase() ===
                veronaPlayerResourceId.toUpperCase()
              );
            })
          : null;
        if (veronaPlayerResourceId && duplicateVeronaPlayer) {
          throw new FirstSliceError(
            409,
            "source_package_resource_id_duplicate",
            `Verona player resource id '${veronaPlayerResourceId}' already exists in source package '${duplicateVeronaPlayer.fileName}'. Create a replacement for source package '${duplicateVeronaPlayer.sourcePackageId}' to preserve its version history.`
          );
        }
        await repository.saveSourcePackage(sourcePackage);
        await recordWorkspaceActivity({
          tenantId: workspace.tenantId,
          workspaceId: workspace.workspaceId,
          eventType: "source_package_created",
          subjectType: "source_package",
          subjectId: sourcePackage.sourcePackageId,
          summary: `Source package '${sourcePackage.fileName}' uploaded.`,
          details: {
            fileName: sourcePackage.fileName,
            mediaType: sourcePackage.mediaType
          }
        });
        return sourcePackage;
      },
      async assembleSourcePackages(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        if (
          !Array.isArray(input.sourcePackageIds) ||
          input.sourcePackageIds.length < 2 ||
          input.sourcePackageIds.length > 100 ||
          input.sourcePackageIds.some(
            sourcePackageId =>
              typeof sourcePackageId !== "string" || !sourcePackageId.trim()
          )
        ) {
          throw new FirstSliceError(
            400,
            "source_package_assembly_selection_invalid",
            "sourcePackageIds must contain between 2 and 100 source package ids."
          );
        }
        const sourcePackageIds = input.sourcePackageIds.map(sourcePackageId =>
          sourcePackageId.trim()
        );
        if (new Set(sourcePackageIds).size !== sourcePackageIds.length) {
          throw new FirstSliceError(
            400,
            "source_package_assembly_selection_duplicate",
            "sourcePackageIds must not contain duplicates."
          );
        }
        const sourcePackages = await Promise.all(
          sourcePackageIds.map(sourcePackageId =>
            requireSourcePackage(repository, sourcePackageId)
          )
        );
        for (const sourcePackage of sourcePackages) {
          if (
            sourcePackage.tenantId !== workspace.tenantId ||
            sourcePackage.workspaceId !== workspace.workspaceId
          ) {
            throw new FirstSliceError(
              404,
              "source_package_not_found",
              `Source package '${sourcePackage.sourcePackageId}' was not found in workspace '${input.workspaceKey}'.`
            );
          }
        }
        const fileNameInput = normalizeSourcePackageText(
          input.fileName,
          "fileName",
          "source_package_file_name_required"
        );
        const fileName = fileNameInput.toLowerCase().endsWith(".zip")
          ? fileNameInput
          : `${fileNameInput}.zip`;
        const { archive, members } = assembleSourcePackageArchive(sourcePackages);
        const assembledSourcePackage: SourcePackage = {
          sourcePackageId: idGenerator(),
          tenantId: workspace.tenantId,
          workspaceId: workspace.workspaceId,
          fileName,
          mediaType: "application/zip",
          contentStructure: null,
          sourceDocument: `data:application/zip;base64,${archive.toString("base64")}`,
          status: "uploaded",
          uploadedAt: now()
        };
        await repository.saveSourcePackage(assembledSourcePackage);
        await recordWorkspaceActivity({
          tenantId: workspace.tenantId,
          workspaceId: workspace.workspaceId,
          eventType: "source_package_assembled",
          subjectType: "source_package",
          subjectId: assembledSourcePackage.sourcePackageId,
          summary: `Source package '${assembledSourcePackage.fileName}' assembled from ${members.length} uploaded files.`,
          details: {
            fileName: assembledSourcePackage.fileName,
            sizeBytes: archive.length,
            sourcePackages: members.map(member => ({
              sourcePackageId: member.sourcePackageId,
              fileName: member.fileName,
              sizeBytes: member.bytes.length
            }))
          }
        });
        const importResult = await createImportJobWithRelease({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          sourcePackageId: assembledSourcePackage.sourcePackageId
        });
        return {
          sourcePackage:
            (await repository.getSourcePackageById(
              assembledSourcePackage.sourcePackageId
            )) ?? assembledSourcePackage,
          assembledFrom: members.map(member => ({
            sourcePackageId: member.sourcePackageId,
            fileName: member.fileName,
            sizeBytes: member.bytes.length
          })),
          ...importResult
        };
      },
      async createImportJob(input) {
        const result = await createImportJobWithRelease(input);
        return result.importJob;
      },
      async retrySourcePackageImport(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const sourcePackage = await requireSourcePackage(repository, input.sourcePackageId);

        if (
          sourcePackage.tenantId !== workspace.tenantId ||
          sourcePackage.workspaceId !== workspace.workspaceId
        ) {
          throw new FirstSliceError(
            409,
            "source_package_workspace_mismatch",
            `Source package '${input.sourcePackageId}' does not belong to workspace '${input.workspaceKey}'.`
          );
        }
        if (sourcePackage.status === "accepted") {
          throw new FirstSliceError(
            409,
            "source_package_retry_not_allowed",
            `Source package '${sourcePackage.fileName}' was already imported successfully. Create a replacement to preserve the imported version.`
          );
        }

        const fileName = normalizeOptionalSourcePackageText(
          input.fileName,
          "fileName",
          "source_package_file_name_required"
        );
        const mediaType = normalizeOptionalSourcePackageText(
          input.mediaType,
          "mediaType",
          "source_package_media_type_required"
        );
        const sourceDocument = normalizeOptionalSourceDocument(
          input.sourceDocument
        );
        const updatedSourcePackage: SourcePackage = {
          ...sourcePackage,
          fileName: fileName ?? sourcePackage.fileName,
          mediaType: mediaType ?? sourcePackage.mediaType,
          contentStructure:
            input.contentStructure !== undefined
              ? input.contentStructure
              : sourcePackage.contentStructure,
          sourceDocument:
            sourceDocument !== undefined
              ? sourceDocument
              : sourcePackage.sourceDocument,
          status: "uploaded"
        };

        await repository.saveSourcePackage(updatedSourcePackage);
        const result = await createImportJobWithRelease({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          sourcePackageId: updatedSourcePackage.sourcePackageId
        });
        await recordWorkspaceActivity({
          tenantId: workspace.tenantId,
          workspaceId: workspace.workspaceId,
          eventType: "source_package_import_retried",
          subjectType: "source_package",
          subjectId: updatedSourcePackage.sourcePackageId,
          summary: `Import retried for '${updatedSourcePackage.fileName}'.`,
          details: {
            importJobId: result.importJob.importJobId,
            stagedContentReleaseId: result.stagedContentRelease?.contentReleaseId ?? null
          }
        });

        return {
          sourcePackage:
            (await repository.getSourcePackageById(updatedSourcePackage.sourcePackageId)) ??
            updatedSourcePackage,
          importJob: result.importJob,
          stagedContentRelease: result.stagedContentRelease,
          ...(result.participantRosterImport
            ? { participantRosterImport: result.participantRosterImport }
            : {})
        };
      },
      async replaceSourcePackage(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const replacedSourcePackage = await requireSourcePackage(
          repository,
          input.sourcePackageId
        );
        if (
          replacedSourcePackage.tenantId !== workspace.tenantId ||
          replacedSourcePackage.workspaceId !== workspace.workspaceId
        ) {
          throw new FirstSliceError(
            404,
            "source_package_not_found",
            `Source package '${input.sourcePackageId}' was not found in workspace '${input.workspaceKey}'.`
          );
        }

        const replacementSourcePackage: SourcePackage = {
          sourcePackageId: idGenerator(),
          tenantId: workspace.tenantId,
          workspaceId: workspace.workspaceId,
          fileName: normalizeSourcePackageText(
            input.fileName,
            "fileName",
            "source_package_file_name_required"
          ),
          mediaType: normalizeSourcePackageText(
            input.mediaType,
            "mediaType",
            "source_package_media_type_required"
          ),
          contentStructure: input.contentStructure ?? null,
          sourceDocument: normalizeOptionalSourceDocument(input.sourceDocument) ?? null,
          status: "uploaded",
          uploadedAt: now()
        };
        await repository.saveSourcePackage(replacementSourcePackage);
        const result = await createImportJobWithRelease({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          sourcePackageId: replacementSourcePackage.sourcePackageId
        });
        const persistedReplacement =
          (await repository.getSourcePackageById(
            replacementSourcePackage.sourcePackageId
          )) ?? replacementSourcePackage;

        await recordWorkspaceActivity({
          tenantId: workspace.tenantId,
          workspaceId: workspace.workspaceId,
          eventType: "source_package_replaced",
          subjectType: "source_package",
          subjectId: replacedSourcePackage.sourcePackageId,
          summary: `Source package '${replacedSourcePackage.fileName}' replaced by '${persistedReplacement.fileName}'.`,
          details: {
            replacedSourcePackageId: replacedSourcePackage.sourcePackageId,
            replacementSourcePackageId: persistedReplacement.sourcePackageId,
            importJobId: result.importJob.importJobId,
            stagedContentReleaseId: result.stagedContentRelease?.contentReleaseId ?? null
          }
        });

        return {
          replacedSourcePackage,
          replacementSourcePackage: persistedReplacement,
          importJob: result.importJob,
          stagedContentRelease: result.stagedContentRelease,
          ...(result.participantRosterImport
            ? { participantRosterImport: result.participantRosterImport }
            : {})
        };
      },
      async deleteSourcePackage(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const sourcePackage = await requireSourcePackage(repository, input.sourcePackageId);
        if (
          sourcePackage.tenantId !== workspace.tenantId ||
          sourcePackage.workspaceId !== workspace.workspaceId
        ) {
          throw new FirstSliceError(
            404,
            "source_package_not_found",
            `Source package '${input.sourcePackageId}' was not found in workspace '${input.workspaceKey}'.`
          );
        }
        if (input.confirmation !== sourcePackage.fileName) {
          throw new FirstSliceError(
            400,
            "source_package_delete_confirmation_mismatch",
            `Confirm deletion by sending the exact file name '${sourcePackage.fileName}'.`
          );
        }

        const [importJobs, contentReleases, participantSessions, testRuns] =
          await Promise.all([
            repository.listImportJobsByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listContentReleasesByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listParticipantSessionsByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            ),
            repository.listTestRunsByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            )
          ]);
        const readiness = buildSourcePackageDeletionReadiness({
          sourcePackage,
          importJobs,
          contentReleases,
          participantSessions,
          testRuns
        });
        if (!readiness.canDelete) {
          throw new FirstSliceError(
            409,
            "source_package_delete_blocked",
            `Source package '${sourcePackage.fileName}' is still used and was not deleted.`,
            readiness
          );
        }

        const deleted = await repository.deleteSourcePackageAggregate({
          tenantId: workspace.tenantId,
          workspaceId: workspace.workspaceId,
          sourcePackageId: sourcePackage.sourcePackageId,
          expectedImportJobIds: readiness.importJobs.map(
            importJob => importJob.importJobId
          ),
          expectedContentReleaseIds: readiness.contentReleases.map(
            contentRelease => contentRelease.contentReleaseId
          )
        });
        if (!deleted) {
          throw new FirstSliceError(
            409,
            "source_package_delete_conflict",
            "Source package dependencies changed while deletion was being confirmed. Refresh deletion readiness and try again."
          );
        }

        const deletion: WorkspaceSourcePackageDeletion = {
          sourcePackageId: sourcePackage.sourcePackageId,
          fileName: sourcePackage.fileName,
          deletedImportJobCount: readiness.importJobs.length,
          deletedContentReleaseCount: readiness.contentReleases.length
        };
        await recordWorkspaceActivity({
          tenantId: workspace.tenantId,
          workspaceId: workspace.workspaceId,
          eventType: "source_package_deleted",
          subjectType: "source_package",
          subjectId: sourcePackage.sourcePackageId,
          summary: `Source package '${sourcePackage.fileName}' deleted.`,
          details: {
            fileName: sourcePackage.fileName,
            mediaType: sourcePackage.mediaType,
            deletedImportJobCount: deletion.deletedImportJobCount,
            deletedContentReleaseCount: deletion.deletedContentReleaseCount
          }
        });
        return deletion;
      },
      async activateContentRelease(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const targetRelease = await requireContentRelease(
          repository,
          input.contentReleaseId
        );

        if (
          targetRelease.tenantId !== workspace.tenantId ||
          targetRelease.workspaceId !== workspace.workspaceId
        ) {
          throw new FirstSliceError(
            404,
            "content_release_not_found",
            `Content release '${input.contentReleaseId}' was not found in workspace '${input.workspaceKey}'.`
          );
        }

        const activatedAt = now();
        const workspaceReleases = await repository.listContentReleasesByWorkspace(
          workspace.tenantId,
          workspace.workspaceId
        );
        const activeRelease =
          workspaceReleases.find(release => release.status === "active") ?? null;
        const supersededOpenRuns =
          activeRelease &&
          activeRelease.contentReleaseId !== targetRelease.contentReleaseId
            ? await listOpenMonitorRunsForActiveRelease({
                repository,
                tenantId: workspace.tenantId,
                workspaceId: workspace.workspaceId,
                activeContentRelease: activeRelease,
                timestamp: activatedAt
              })
            : [];

        if (
          activeRelease &&
          activeRelease.contentReleaseId !== targetRelease.contentReleaseId &&
          !input.forceActivation &&
          supersededOpenRuns.length > 0
        ) {
          await recordWorkspaceActivity({
            tenantId: workspace.tenantId,
            workspaceId: workspace.workspaceId,
            eventType: "content_release_activation_blocked",
            actorId: input.activatedByActorId,
            subjectType: "content_release",
            subjectId: targetRelease.contentReleaseId,
            summary: `Activation blocked for release '${targetRelease.contentReleaseId}'.`,
            details: {
              activeContentReleaseId: activeRelease.contentReleaseId,
              openRuns: supersededOpenRuns
            }
          });

          throw new FirstSliceError(
            409,
            "active_content_release_has_open_runs",
            `Active content release '${activeRelease.contentReleaseId}' still has ${supersededOpenRuns.length} open run(s). Re-submit with forceActivation to supersede it.`,
            {
              activeContentReleaseId: activeRelease.contentReleaseId,
              openRuns: supersededOpenRuns
            } satisfies ActivateContentReleaseBlockedDetails
          );
        }

        for (const release of workspaceReleases) {
          if (release.contentReleaseId === targetRelease.contentReleaseId) {
            continue;
          }

          if (release.status === "active") {
            await repository.saveContentRelease({
              ...release,
              status: "superseded"
            });
          }
        }

        const activatedRelease: ContentRelease = {
          ...targetRelease,
          status: "active",
          activatedAt
        };
        await repository.saveContentRelease(activatedRelease);
        const activation: ContentReleaseActivationSummary = {
          forced: Boolean(input.forceActivation),
          previousActiveContentReleaseId: activeRelease?.contentReleaseId ?? null,
          supersededOpenRunCount: supersededOpenRuns.length,
          supersededOpenRuns
        };
        await recordWorkspaceActivity({
          tenantId: workspace.tenantId,
          workspaceId: workspace.workspaceId,
          eventType: "content_release_activated",
          actorId: input.activatedByActorId,
          subjectType: "content_release",
          subjectId: activatedRelease.contentReleaseId,
          summary: `Content release '${activatedRelease.contentReleaseId}' activated.`,
          details: activation
        });
        return {
          contentRelease: activatedRelease,
          activation
        };
      }
    },
    createImportJobWithRelease,
    participantRuntime: {
      async signIn(input) {
        const tenantKey = normalizeOptionalParticipantTenantKey(input.tenantKey);
        const workspaceKey = normalizeParticipantWorkspaceKey(input.workspaceKey);
        const loginKey = normalizeParticipantLoginKey(input.loginKey);
        const workspace = tenantKey
          ? await repository.getWorkspaceByScope(tenantKey, workspaceKey)
          : await resolveUniqueWorkspaceByWorkspaceKey(repository, workspaceKey);

        if (!workspace) {
          throw new FirstSliceError(
            404,
            "workspace_not_found",
            tenantKey
              ? `Workspace '${workspaceKey}' was not found in tenant '${tenantKey}'.`
              : `Workspace '${workspaceKey}' was not found.`
          );
        }

        const activeRelease = await getActiveWorkspaceRelease(
          repository,
          workspace.tenantId,
          workspace.workspaceId
        );

        if (!activeRelease) {
          throw new FirstSliceError(
            409,
            "workspace_has_no_active_content_release",
            `Workspace '${input.workspaceKey}' has no active content release.`
          );
        }

        const participantRosterEntries =
          await repository.listParticipantRosterEntriesByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          );
        const rosterEntry =
          participantRosterEntries.find(entry => entry.loginKey === loginKey) ??
          null;
        if (participantRosterEntries.length > 0 && !rosterEntry) {
          throw new FirstSliceError(
            401,
            "participant_login_invalid",
            "Participant login is invalid."
          );
        }
        const signInTimestamp = now();
        if (rosterEntry?.passwordRequired) {
          const loginAttempt = await repository.getParticipantLoginAttempt(
            workspace.tenantId,
            workspace.workspaceId,
            loginKey
          );
          const loginAttemptExpiresAtMs = Date.parse(
            loginAttempt?.expiresAt ?? ""
          );
          const signInTimestampMs = Date.parse(signInTimestamp);
          if (
            loginAttempt &&
            loginAttempt.failedAttempts >= participantLoginMaxFailures &&
            Number.isFinite(loginAttemptExpiresAtMs) &&
            loginAttemptExpiresAtMs > signInTimestampMs
          ) {
            throw new FirstSliceError(
              429,
              "participant_login_rate_limited",
              "Too many failed participant login attempts. Try again later.",
              {
                retryAfterSeconds: Math.max(
                  1,
                  Math.ceil((loginAttemptExpiresAtMs - signInTimestampMs) / 1_000)
                ),
                maxFailures: participantLoginMaxFailures
              }
            );
          }
          const passwordHash = await repository.getParticipantRosterPasswordHash(
            workspace.tenantId,
            workspace.workspaceId,
            loginKey
          );
          if (
            !passwordHash ||
            typeof input.password !== "string" ||
            !verifyPassword(input.password, passwordHash)
          ) {
            const failedAt = now();
            await repository.recordParticipantLoginFailure({
              tenantId: workspace.tenantId,
              workspaceId: workspace.workspaceId,
              loginKey,
              attemptedAt: failedAt,
              expiresAt: new Date(
                Date.parse(failedAt) + participantLoginFailureWindowMs
              ).toISOString()
            });
            throw new FirstSliceError(
              401,
              "participant_password_invalid",
              `Password for participant '${loginKey}' is required or invalid.`
            );
          }
        }
        const participantCode = String(input.participantCode ?? "").trim();
        const codeRequired = participantRosterRequiresCode(rosterEntry);
        if (codeRequired && !participantCode) {
          throw new FirstSliceError(
            409,
            "participant_code_required",
            `Participant '${loginKey}' must enter the assigned participant code.`,
            { customTexts: rosterEntry?.customTexts ?? {} }
          );
        }
        if (
          codeRequired &&
          !getParticipantRosterBookletAssignments(rosterEntry).some(
            assignment => assignment.accessCodes?.includes(participantCode)
          )
        ) {
          throw new FirstSliceError(
            400,
            "participant_code_invalid",
            "The participant code is invalid.",
            { customTexts: rosterEntry?.customTexts ?? {} }
          );
        }
        const effectiveParticipantCode = codeRequired ? participantCode : null;
        const requestedGroupKey = String(input.groupKey ?? "").trim();
        const groupKey =
          rosterEntry?.groupKey || requestedGroupKey || `group:${loginKey}`;
        const executionMode = resolveParticipantExecutionMode(
          rosterEntry?.executionMode
        );

        const workspaceParticipantSessions =
          await repository.listParticipantSessionsByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          );
        const loginSessions = workspaceParticipantSessions
          .filter(
            participantSession =>
              participantSession.loginKey === loginKey &&
              (participantSession.participantCode ?? null) ===
                effectiveParticipantCode
          )
          .sort((left, right) => left.createdAt.localeCompare(right.createdAt));
        const accessStartedAt = loginSessions[0]?.createdAt ?? signInTimestamp;
        const validUntil = resolveParticipantSessionValidUntil(
          rosterEntry,
          accessStartedAt
        );
        assertParticipantAccessWindow(rosterEntry, signInTimestamp, validUntil);

        const reusableSession = executionMode.alwaysNewSession
          ? undefined
          : workspaceParticipantSessions
              .filter(
                participantSession =>
                  participantSession.loginKey === loginKey &&
                  participantSession.groupKey === groupKey &&
                  (participantSession.participantCode ?? null) ===
                    effectiveParticipantCode &&
                  participantSession.contentReleaseId ===
                    activeRelease.contentReleaseId &&
                  normalizeParticipantExecutionMode(
                    participantSession.executionMode
                  ) === executionMode.mode &&
                  participantSession.status !== "closed"
              )
              .sort((left, right) =>
                right.createdAt.localeCompare(left.createdAt)
              )[0];

        if (reusableSession) {
          await recordWorkspaceActivity({
            tenantId: reusableSession.tenantId,
            workspaceId: reusableSession.workspaceId,
            eventType: "participant_signed_in",
            subjectType: "participant_session",
            subjectId: reusableSession.participantSessionId,
            summary: `Participant '${reusableSession.loginKey}' re-entered an existing session.`,
            details: {
              loginKey: reusableSession.loginKey,
              groupKey: reusableSession.groupKey,
              contentReleaseId: reusableSession.contentReleaseId,
              participantCodeRequired: codeRequired,
              executionMode: executionMode.mode,
              rosterDefaultUsed: !requestedGroupKey && Boolean(rosterEntry),
              reused: true
            }
          });
          return reusableSession;
        }

        const participantSession: ParticipantSession = {
          participantSessionId: idGenerator(),
          tenantId: workspace.tenantId,
          workspaceId: workspace.workspaceId,
          contentReleaseId: activeRelease.contentReleaseId,
          loginKey,
          groupKey,
          participantCode: effectiveParticipantCode,
          executionMode: executionMode.mode,
          status: "signed_in",
          validUntil,
          createdAt: signInTimestamp
        };
        await repository.saveParticipantSession(participantSession);
        await recordWorkspaceActivity({
          tenantId: workspace.tenantId,
          workspaceId: workspace.workspaceId,
          eventType: "participant_signed_in",
          subjectType: "participant_session",
          subjectId: participantSession.participantSessionId,
          summary: `Participant '${participantSession.loginKey}' signed in.`,
          details: {
            loginKey: participantSession.loginKey,
            groupKey: participantSession.groupKey,
            contentReleaseId: participantSession.contentReleaseId,
            participantCodeRequired: codeRequired,
            executionMode: executionMode.mode,
            rosterDefaultUsed: !requestedGroupKey && Boolean(rosterEntry)
          }
        });
        return participantSession;
      },
      async getRuntimeState(input) {
        const participantSessionId = normalizeParticipantSessionId(
          input.participantSessionId
        );
        const participantSession = await requireAccessibleParticipantSession(
          participantSessionId
        );
        const scope = await resolveParticipantSessionScope(
          repository,
          participantSession
        );
        const latestTestRun = await getLatestParticipantSessionRun(
          repository,
          participantSession.participantSessionId
        );
        const participantRosterEntry = await findParticipantRosterEntryByLoginKey(
          repository,
          participantSession.tenantId,
          participantSession.workspaceId,
          participantSession.loginKey
        );
        const contentRelease = await requireContentRelease(
          repository,
          participantSession.contentReleaseId
        );
        const testRuns = (
          await repository.listTestRunsByParticipantSessionId(
            participantSession.participantSessionId
          )
        ).map(normalizeTestRun);
        const booklets = buildParticipantRuntimeBooklets({
          contentRelease,
          participantRosterEntry,
          participantCode: participantSession.participantCode,
          testRuns
        });
        const publicParticipantRosterEntry =
          sanitizeParticipantRosterEntryForSession(
            participantRosterEntry,
            participantSession.participantCode
          );
        const hasAvailableBooklet = booklets.some(
          booklet => booklet.status === "available"
        );
        const executionMode = resolveParticipantExecutionMode(
          latestTestRun?.executionMode ??
            participantSession.executionMode ??
            participantRosterEntry?.executionMode
        );

        if (!latestTestRun) {
          return {
            participantSession,
            participantRosterEntry: publicParticipantRosterEntry,
            scope,
            executionMode,
            latestTestRun: null,
            booklets,
            runtimeStatus: "ready_to_launch",
            availableAction: "launch"
          };
        }

        if (latestTestRun.status === "completed") {
          return {
            participantSession,
            participantRosterEntry: publicParticipantRosterEntry,
            scope,
            executionMode,
            latestTestRun: normalizeTestRun(latestTestRun),
            booklets,
            runtimeStatus: hasAvailableBooklet ? "ready_to_launch" : "completed",
            availableAction: hasAvailableBooklet ? "launch" : "none"
          };
        }

        if (latestTestRun.locked) {
          return {
            participantSession,
            participantRosterEntry: publicParticipantRosterEntry,
            scope,
            executionMode,
            latestTestRun: normalizeTestRun(latestTestRun),
            booklets,
            runtimeStatus: "locked",
            availableAction: "none"
          };
        }

        return {
          participantSession,
          participantRosterEntry: publicParticipantRosterEntry,
          scope,
          executionMode,
          latestTestRun: normalizeTestRun(latestTestRun),
          booklets,
          runtimeStatus: "in_progress",
          availableAction: "resume"
        };
      },
      async getCurrentRunState(input) {
        const participantSessionId = normalizeParticipantSessionId(
          input.participantSessionId
        );
        const participantSession = await requireAccessibleParticipantSession(
          participantSessionId
        );
        const scope = await resolveParticipantSessionScope(
          repository,
          participantSession
        );
        const latestTestRun = await getLatestParticipantSessionRun(
          repository,
          participantSession.participantSessionId
        );

        if (!latestTestRun) {
          throw new FirstSliceError(
            409,
            "participant_session_has_no_current_run",
            `Participant session '${participantSessionId}' has no current test run yet.`
          );
        }

        const storedCurrentTestRun = normalizeTestRun(latestTestRun);
        const contentRelease = await requireContentRelease(
          repository,
          storedCurrentTestRun.contentReleaseId
        );
        const currentTimestamp = now();
        const timerAdjustedTestRun = await persistEffectiveTestletTimerState({
          contentRelease,
          testRun: storedCurrentTestRun,
          timestamp: currentTimestamp
        });
        const currentBooklet = contentRelease.runtimeSnapshot.bookletEntries.find(
          booklet => booklet.bookletKey === timerAdjustedTestRun.bookletKey
        );
        const currentTestRun = hasCompleteBookletStatesSnapshot(
          currentBooklet,
          timerAdjustedTestRun
        )
          ? timerAdjustedTestRun
          : withEvaluatedBookletStates(currentBooklet, timerAdjustedTestRun);
        if (currentTestRun !== timerAdjustedTestRun) {
          await repository.saveTestRun(currentTestRun);
        }
        const participantRosterEntry = await findParticipantRosterEntryByLoginKey(
          repository,
          participantSession.tenantId,
          participantSession.workspaceId,
          participantSession.loginKey
        );
        const testRuns = (
          await repository.listTestRunsByParticipantSessionId(
            participantSession.participantSessionId
          )
        ).map(normalizeTestRun);
        const resolvedNavigation = resolveBookletNavigationState(
          contentRelease,
          currentTestRun
        );
        const navigation = currentTestRun.locked
          ? {
              ...resolvedNavigation,
              canGoPrevious: false,
              canGoNext: false,
              canComplete: false,
              canPlayerEnd: false,
              nextTestletGate: null
            }
          : resolvedNavigation;
        const availableActions: ParticipantCurrentRunState["availableActions"] = [];
        const executionMode = resolveParticipantExecutionMode(
          currentTestRun.executionMode ?? participantSession.executionMode
        );
        if (currentTestRun.locked) {
          // A whole-test monitor lock is independent of the paused/running state.
        } else if (currentTestRun.status === "paused") {
          availableActions.push("resume", "save_progress");
        } else if (currentTestRun.status === "running") {
          availableActions.push("save_progress");
        }
        if (!currentTestRun.locked && navigation.canComplete) {
          availableActions.push("complete");
        }
        if (!currentTestRun.locked && executionMode.canReview) {
          availableActions.push("review");
        }
        if (
          executionMode.canChangeStateOptions &&
          currentTestRun.status !== "completed" &&
          !currentTestRun.locked &&
          (currentBooklet?.stateEntries?.length ?? 0) > 0
        ) {
          availableActions.push("change_state_options");
        }

        const runtimeBooklet = resolveRuntimeBooklet(
          contentRelease,
          currentTestRun.bookletKey
        );
        const participantBooklet = {
          ...runtimeBooklet,
          policy: applyParticipantExecutionModeToBookletPolicy(
            runtimeBooklet.policy,
            executionMode
          )
        };

        return {
          participantSession,
          participantRosterEntry: sanitizeParticipantRosterEntryForSession(
            participantRosterEntry,
            participantSession.participantCode
          ),
          scope,
          executionMode,
          testRun: currentTestRun,
          booklet: participantBooklet,
          currentUnit: resolveRuntimeUnit(
            contentRelease,
            currentTestRun.bookletKey,
            currentTestRun.currentUnitKey
          ),
          ...(input.includeBookletAssets
            ? {
                bookletAssets: resolveRuntimeBookletAssets(
                  contentRelease,
                  currentTestRun.bookletKey
                )
              }
            : {}),
          ...(contentRelease.runtimeSnapshot.resourceEntries?.length
            ? {
                resourceBasePath: `/api/v1/participant/sessions/${encodeURIComponent(participantSessionId)}/resources`
              }
            : {}),
          bookletUnits: resolveRuntimeBookletUnits(
            contentRelease,
            currentTestRun.bookletKey,
            currentTestRun
          ),
          adaptiveStates: resolveAdaptiveStates(
            currentBooklet,
            currentTestRun
          ),
          activeTestletTimer: resolveActiveTestletTimer(
            contentRelease,
            currentTestRun,
            currentTimestamp
          ),
          activeLeaveLock: resolveActiveLeaveLock(
            contentRelease,
            currentTestRun
          ),
          booklets: buildParticipantRuntimeBooklets({
            contentRelease,
            participantRosterEntry,
            participantCode: participantSession.participantCode,
            testRuns
          }),
          navigation,
          availableActions
        };
      },
      async selectAdaptiveState(input) {
        const testRunId = normalizeTestRunId(input.testRunId);
        const storedTestRun = await repository.getTestRunById(testRunId);
        if (!storedTestRun) {
          throw new FirstSliceError(
            404,
            "test_run_not_found",
            `Test run '${testRunId}' was not found.`
          );
        }
        const testRun = normalizeTestRun(storedTestRun);
        requireParticipantTestRunUnlocked(testRun);
        const participantSession = await requireAccessibleParticipantSession(
          testRun.participantSessionId
        );
        const executionMode = resolveParticipantExecutionMode(
          testRun.executionMode ?? participantSession.executionMode
        );
        if (!executionMode.canChangeStateOptions) {
          throw new FirstSliceError(
            403,
            "participant_state_option_change_not_allowed",
            `Execution mode '${executionMode.mode}' does not allow adaptive state choices.`
          );
        }
        if (testRun.status === "completed") {
          throw new FirstSliceError(
            409,
            "test_run_already_completed",
            `Test run '${testRunId}' is already completed.`
          );
        }
        const stateKey = String(input.stateKey ?? "").trim();
        if (!stateKey) {
          throw new FirstSliceError(
            400,
            "participant_state_key_required",
            "stateKey is required."
          );
        }
        const optionKey = String(input.optionKey ?? "").trim();
        if (!optionKey) {
          throw new FirstSliceError(
            400,
            "participant_state_option_key_required",
            "optionKey is required."
          );
        }
        const contentRelease = await requireContentRelease(
          repository,
          testRun.contentReleaseId
        );
        const booklet = contentRelease.runtimeSnapshot.bookletEntries.find(
          candidate => candidate.bookletKey === testRun.bookletKey
        );
        const state = booklet?.stateEntries?.find(
          candidate => candidate.stateKey === stateKey
        );
        if (!state) {
          throw new FirstSliceError(
            404,
            "participant_adaptive_state_not_found",
            `Adaptive state '${stateKey}' was not found in booklet '${testRun.bookletKey}'.`
          );
        }
        if (!state.options.some(option => option.optionKey === optionKey)) {
          throw new FirstSliceError(
            400,
            "participant_adaptive_state_option_invalid",
            `Option '${optionKey}' is not valid for adaptive state '${stateKey}'.`
          );
        }
        const timestamp = now();
        const updatedRun = withEvaluatedBookletStates(booklet, {
          ...testRun,
          bookletStateOverrides: {
            ...(testRun.bookletStateOverrides ?? {}),
            [stateKey]: optionKey
          },
          updatedAt: timestamp
        });
        await repository.saveTestRun(updatedRun);
        if (
          executionMode.saveResponses &&
          Object.keys(updatedRun.bookletStates ?? {}).length > 0
        ) {
          await repository.saveParticipantTestLogs(
            buildParticipantTestLogs({
              testRun: updatedRun,
              batches: [{
                entries: [
                  buildBookletStatesTestStateEntry(updatedRun, timestamp)
                ]
              }]
            })
          );
        }
        await recordWorkspaceActivity({
          tenantId: updatedRun.tenantId,
          workspaceId: updatedRun.workspaceId,
          eventType: "test_run_progress_saved",
          actorId: participantSession.loginKey,
          subjectType: "test_run",
          subjectId: updatedRun.testRunId,
          summary: `Participant selected adaptive state '${stateKey}=${optionKey}'.`,
          details: {
            participantSessionId: updatedRun.participantSessionId,
            stateKey,
            optionKey,
            participantStateOverride: true
          }
        });
        return updatedRun;
      },
      async listReviews(input) {
        const { testRun } = await requireParticipantReviewContext(input.testRunId);
        return (
          await repository.listWorkspaceReviewsByWorkspace(
            testRun.tenantId,
            testRun.workspaceId
          )
        )
          .map(normalizeWorkspaceReview)
          .filter(
            review =>
              review.testRunId === testRun.testRunId &&
              review.participantSessionId === testRun.participantSessionId
          )
          .sort(
            (left, right) =>
              right.updatedAt.localeCompare(left.updatedAt) ||
              right.reviewId.localeCompare(left.reviewId)
          );
      },
      async createReview(input) {
        const { participantSession, testRun, contentRelease } =
          await requireParticipantReviewContext(input.testRunId);
        const unitKey = normalizeOptionalUnitKey(input.unitKey);
        let originalUnitId: string | null = null;
        if (unitKey) {
          const unitEntry = requireRuntimeUnitForBooklet(
            contentRelease,
            testRun.bookletKey,
            unitKey
          );
          originalUnitId = unitEntry.originalUnitId ?? unitEntry.unitKey;
        }
        const categories = normalizeReviewCategories(
          input.categories,
          input.category
        );
        const page = normalizeOptionalReviewPage(input.page);
        const pageLabel = normalizeOptionalReviewPageLabel(input.pageLabel);
        if (!unitKey && (page !== null || pageLabel !== null)) {
          throw new FirstSliceError(
            400,
            "review_page_requires_unit",
            "Task-page metadata requires a unitKey."
          );
        }
        const timestamp = now();
        const review: WorkspaceReview = {
          reviewId: idGenerator(),
          tenantId: testRun.tenantId,
          workspaceId: testRun.workspaceId,
          participantSessionId: participantSession.participantSessionId,
          testRunId: testRun.testRunId,
          unitKey,
          originalUnitId,
          page,
          pageLabel,
          userAgent: normalizeReviewUserAgent(input.userAgent),
          reviewerId: resolveParticipantReviewReviewerId(
            input.reviewerId,
            participantSession.loginKey
          ),
          category: categories.join(" "),
          categories,
          priority: normalizeReviewPriority(input.priority),
          comment: normalizeReviewText(
            input.comment,
            "comment",
            "review_comment_required"
          ),
          createdAt: timestamp,
          updatedAt: timestamp
        };
        await repository.saveWorkspaceReview(review);
        await recordWorkspaceActivity({
          tenantId: testRun.tenantId,
          workspaceId: testRun.workspaceId,
          eventType: "review_created",
          actorId: review.reviewerId,
          subjectType: "test_run",
          subjectId: testRun.testRunId,
          summary: `Participant review '${review.reviewId}' created for test run '${testRun.testRunId}'.`,
          details: {
            reviewId: review.reviewId,
            participantSessionId: review.participantSessionId,
            unitKey: review.unitKey,
            originalUnitId: review.originalUnitId,
            page: review.page,
            pageLabel: review.pageLabel,
            userAgent: review.userAgent,
            category: review.category,
            categories: review.categories,
            priority: review.priority,
            participantAuthored: true
          }
        });
        return review;
      },
      async updateReview(input) {
        const { participantSession, testRun, contentRelease } =
          await requireParticipantReviewContext(input.testRunId);
        const existingReview = normalizeWorkspaceReview(
          await requireParticipantOwnedReview({
            testRun,
            reviewId: input.reviewId
          })
        );
        const unitKey =
          input.unitKey === undefined
            ? existingReview.unitKey
            : normalizeOptionalUnitKey(input.unitKey);
        if (unitKey) {
          requireRuntimeUnitForBooklet(
            contentRelease,
            testRun.bookletKey,
            unitKey
          );
        }
        const categories =
          input.categories === undefined && input.category === undefined
            ? existingReview.categories
            : normalizeReviewCategories(input.categories, input.category);
        const page = unitKey
          ? input.page === undefined
            ? existingReview.page
            : normalizeOptionalReviewPage(input.page)
          : null;
        const pageLabel = unitKey
          ? input.pageLabel === undefined
            ? existingReview.pageLabel
            : normalizeOptionalReviewPageLabel(input.pageLabel)
          : null;
        const review: WorkspaceReview = {
          ...existingReview,
          unitKey,
          page,
          pageLabel,
          reviewerId:
            input.reviewerId === undefined
              ? existingReview.reviewerId
              : resolveParticipantReviewReviewerId(
                  input.reviewerId,
                  participantSession.loginKey
                ),
          category: categories.join(" "),
          categories,
          priority:
            input.priority === undefined
              ? existingReview.priority
              : normalizeReviewPriority(input.priority),
          comment:
            input.comment === undefined
              ? existingReview.comment
              : normalizeReviewText(
                  input.comment,
                  "comment",
                  "review_comment_required"
                ),
          updatedAt: now()
        };
        await repository.saveWorkspaceReview(review);
        await recordWorkspaceActivity({
          tenantId: testRun.tenantId,
          workspaceId: testRun.workspaceId,
          eventType: "review_updated",
          actorId: review.reviewerId,
          subjectType: "test_run",
          subjectId: testRun.testRunId,
          summary: `Participant review '${review.reviewId}' updated.`,
          details: {
            reviewId: review.reviewId,
            participantSessionId: review.participantSessionId,
            unitKey: review.unitKey,
            page: review.page,
            pageLabel: review.pageLabel,
            category: review.category,
            categories: review.categories,
            priority: review.priority,
            participantAuthored: true
          }
        });
        return review;
      },
      async deleteReview(input) {
        const { testRun } = await requireParticipantReviewContext(input.testRunId);
        const review = await requireParticipantOwnedReview({
          testRun,
          reviewId: input.reviewId
        });
        await repository.deleteWorkspaceReview(review.reviewId);
        await recordWorkspaceActivity({
          tenantId: testRun.tenantId,
          workspaceId: testRun.workspaceId,
          eventType: "review_deleted",
          actorId: review.reviewerId,
          subjectType: "test_run",
          subjectId: testRun.testRunId,
          summary: `Participant review '${review.reviewId}' deleted.`,
          details: {
            reviewId: review.reviewId,
            participantSessionId: review.participantSessionId,
            unitKey: review.unitKey,
            page: review.page,
            pageLabel: review.pageLabel,
            category: review.category,
            categories: review.categories,
            priority: review.priority,
            participantAuthored: true
          }
        });
        return review.reviewId;
      },
      async getResource(input) {
        const participantSessionId = normalizeParticipantSessionId(
          input.participantSessionId
        );
        const participantSession = await requireAccessibleParticipantSession(
          participantSessionId
        );
        const requestedPath = String(input.resourcePath ?? "")
          .trim()
          .replace(/^\/+/, "")
          .replace(/\\/g, "/");
        const resourcePath = normalizeZipEntryPath(requestedPath);
        if (!resourcePath || resourcePath !== requestedPath) {
          throw new FirstSliceError(
            400,
            "participant_resource_path_invalid",
            "Participant resource path is invalid."
          );
        }
        const contentRelease = await requireContentRelease(
          repository,
          participantSession.contentReleaseId
        );
        const resourceEntry = contentRelease.runtimeSnapshot.resourceEntries?.find(
          entry => entry.resourcePath.toLowerCase() === resourcePath.toLowerCase()
        );
        if (!resourceEntry) {
          throw new FirstSliceError(
            404,
            "participant_resource_not_found",
            `Participant resource '${resourcePath}' was not found.`
          );
        }
        return resourceEntry;
      },
      async launch(input) {
        const participantSessionId = normalizeParticipantSessionId(
          input.participantSessionId
        );
        const participantSession = await requireAccessibleParticipantSession(
          participantSessionId
        );
        const contentRelease = await requireContentRelease(
          repository,
          participantSession.contentReleaseId
        );

        const requestedBookletKey = normalizeOptionalRuntimeBookletKey(
          input.bookletKey
        );
        const existingRun = await repository.getOpenTestRunByParticipantSessionId(
          participantSession.participantSessionId
        );

        if (existingRun) {
          if (
            requestedBookletKey &&
            existingRun.bookletKey !== requestedBookletKey &&
            (existingRun.bookletAssignmentKey ?? existingRun.bookletKey) !==
              requestedBookletKey
          ) {
            throw new FirstSliceError(
              409,
              "participant_session_open_run_booklet_conflict",
              `Participant session '${participantSessionId}' already has an open run for booklet '${existingRun.bookletKey}'.`
            );
          }

          const normalizedExistingRun = normalizeTestRun(existingRun);
          requireParticipantTestRunUnlocked(normalizedExistingRun);
          return normalizedExistingRun;
        }

        const rosterEntry = await findParticipantRosterEntryByLoginKey(
          repository,
          participantSession.tenantId,
          participantSession.workspaceId,
          participantSession.loginKey
        );
        const assignedBookletKeys = [
          ...new Set(
            getParticipantCodeBookletAssignments(
              rosterEntry,
              participantSession.participantCode
            ).map(assignment => assignment.bookletKey)
          )
        ];
        const testRuns = (
          await repository.listTestRunsByParticipantSessionId(
            participantSession.participantSessionId
          )
        ).map(normalizeTestRun);
        const runtimeBooklets = buildParticipantRuntimeBooklets({
          contentRelease,
          participantRosterEntry: rosterEntry,
          participantCode: participantSession.participantCode,
          testRuns
        });
        const selectedRuntimeBooklet = requestedBookletKey
          ? runtimeBooklets.find(booklet => booklet.bookletKey === requestedBookletKey) ??
            runtimeBooklets.find(
              booklet =>
                booklet.sourceBookletKey === requestedBookletKey &&
                booklet.status === "available"
            )
          : runtimeBooklets.find(booklet => booklet.status === "available");
        if (requestedBookletKey && assignedBookletKeys.length > 0 && !selectedRuntimeBooklet) {
          throw new FirstSliceError(
            403,
            "booklet_not_assigned",
            `Booklet assignment '${requestedBookletKey}' is not assigned to participant '${participantSession.loginKey}'.`
          );
        }
        const effectiveBookletKey =
          selectedRuntimeBooklet?.sourceBookletKey || requestedBookletKey || "";
        const bookletSource = requestedBookletKey
          ? "request"
          : assignedBookletKeys.length > 0
            ? "participant_roster"
            : "active_release_default";
        const selectedBooklet = contentRelease.runtimeSnapshot.bookletEntries.find(
          booklet => booklet.bookletKey === effectiveBookletKey
        );

        if (effectiveBookletKey && !selectedBooklet) {
          throw new FirstSliceError(
            404,
            "booklet_not_found",
            `Booklet '${effectiveBookletKey}' was not found in active content release '${contentRelease.contentReleaseId}'.`
          );
        }
        if (selectedRuntimeBooklet?.status === "completed") {
          throw new FirstSliceError(
            409,
            "booklet_already_completed",
            `Booklet '${effectiveBookletKey}' is already completed in participant session '${participantSessionId}'.`
          );
        }
        if (!selectedBooklet) {
          throw new FirstSliceError(
            409,
            participantSession.status === "closed"
              ? "participant_session_closed"
              : "participant_session_has_no_available_booklet",
            participantSession.status === "closed"
              ? `Participant session '${participantSessionId}' is already closed.`
              : `Participant session '${participantSessionId}' has no available booklet.`
          );
        }

        const timestamp = now();
        const executionMode = resolveParticipantExecutionMode(
          participantSession.executionMode ?? rosterEntry?.executionMode
        );
        const initialTestRun = withEvaluatedBookletStates(selectedBooklet, {
          testRunId: idGenerator(),
          participantSessionId: participantSession.participantSessionId,
          tenantId: participantSession.tenantId,
          workspaceId: participantSession.workspaceId,
          contentReleaseId: participantSession.contentReleaseId,
          bookletKey: selectedBooklet.bookletKey,
          executionMode: executionMode.mode,
          bookletAssignmentKey:
            selectedRuntimeBooklet?.bookletKey ?? selectedBooklet.bookletKey,
          presetBookletStates: selectedRuntimeBooklet?.statePreset ?? {},
          status: "running",
          locked: false,
          currentUnitKey: null,
          unitResponses: {},
          unlockedTestletKeys: executionMode.presetCode
            ? selectedBooklet.testletEntries
                ?.filter(testlet => Boolean(testlet.restrictions?.codeToEnter?.code))
                .map(testlet => testlet.testletKey) ?? []
            : [],
          monitorNavigationUnlocked: false,
          testletTimers: {},
          lockedTestletKeys: [],
          lockedUnitKeys: [],
          createdAt: timestamp,
          updatedAt: timestamp,
          completedAt: null
        });
        const firstUnit = resolveVisibleBookletUnits(
          selectedBooklet,
          initialTestRun
        )[0];
        const firstUnitRequiresCode =
          executionMode.forceNaviRestrictions &&
          !executionMode.presetCode &&
          (firstUnit?.testletPath ?? []).some(
          testletKey =>
            Boolean(
              selectedBooklet.testletEntries?.find(
                testlet => testlet.testletKey === testletKey
              )?.restrictions?.codeToEnter?.code
            )
        );
        const testRun: TestRun = {
          ...initialTestRun,
          currentUnitKey: firstUnitRequiresCode
            ? null
            : firstUnit?.unitKey ?? null
        };
        await repository.saveTestRun(testRun);
        const effectiveTestRun = await persistEffectiveTestletTimerState({
          contentRelease,
          testRun,
          timestamp
        });
        if (executionMode.saveResponses) {
          await repository.saveParticipantTestLogs(
            buildParticipantTestLogs({
            testRun: effectiveTestRun,
            batches: [{
              entries: [
                {
                  key: "CONTROLLER",
                  timeStamp: Date.parse(timestamp),
                  content: "RUNNING"
                },
                ...(effectiveTestRun.currentUnitKey
                  ? [{
                      key: "CURRENT_UNIT_ID",
                      timeStamp: Date.parse(timestamp),
                      content: effectiveTestRun.currentUnitKey
                    }]
                  : []),
                ...(Object.keys(effectiveTestRun.bookletStates ?? {}).length > 0
                  ? [buildBookletStatesTestStateEntry(effectiveTestRun, timestamp)]
                  : [])
              ]
            }]
            })
          );
        }
        await repository.saveParticipantSession({
          ...participantSession,
          status: "launched"
        });
        await recordWorkspaceActivity({
          tenantId: effectiveTestRun.tenantId,
          workspaceId: effectiveTestRun.workspaceId,
          eventType: "participant_session_resumed",
          subjectType: "test_run",
          subjectId: effectiveTestRun.testRunId,
          summary: `Participant session '${participantSession.participantSessionId}' started a run.`,
          details: {
            participantSessionId: participantSession.participantSessionId,
            bookletKey: effectiveTestRun.bookletKey,
            bookletAssignmentKey: effectiveTestRun.bookletAssignmentKey,
            currentUnitKey: effectiveTestRun.currentUnitKey,
            bookletSource
          }
        });
        return effectiveTestRun;
      },
      async resumeSession(input) {
        const participantSessionId = normalizeParticipantSessionId(
          input.participantSessionId
        );
        const participantSession = await requireAccessibleParticipantSession(
          participantSessionId
        );
        const requestedBookletKey = normalizeOptionalRuntimeBookletKey(
          input.bookletKey
        );
        const existingRun = await repository.getOpenTestRunByParticipantSessionId(
          participantSession.participantSessionId
        );

        if (existingRun) {
          const normalizedExistingRun = normalizeTestRun(existingRun);
          requireParticipantTestRunUnlocked(normalizedExistingRun);
          if (
            requestedBookletKey &&
            existingRun.bookletKey !== requestedBookletKey
          ) {
            throw new FirstSliceError(
              409,
              "participant_session_open_run_booklet_conflict",
              `Participant session '${participantSessionId}' already has an open run for booklet '${existingRun.bookletKey}'.`
            );
          }

          if (existingRun.status === "paused") {
            const timestamp = now();
            const contentRelease = await requireContentRelease(
              repository,
              existingRun.contentReleaseId
            );
            const resumedRun = transitionTestletTimersForRunStatus(
              normalizedExistingRun,
              "running",
              timestamp
            );
            await repository.saveTestRun(resumedRun);
            if (
              resolveParticipantExecutionMode(resumedRun.executionMode)
                .saveResponses
            ) {
              const resumedStateEntries: ParticipantTestLogEntryInput[] = [{
                key: "CONTROLLER",
                timeStamp: Date.parse(timestamp),
                content: "RUNNING"
              }];
              if (testletTimerStateChanged(normalizedExistingRun, resumedRun)) {
                resumedStateEntries.unshift(
                  buildTestletTimeLeftTestStateEntry(resumedRun, timestamp)
                );
              }
              await repository.saveParticipantTestLogs(
                buildParticipantTestLogs({
                  testRun: resumedRun,
                  batches: [{
                    entries: resumedStateEntries
                  }]
                })
              );
            }
            const effectiveRun = await persistEffectiveTestletTimerState({
              contentRelease,
              testRun: resumedRun,
              timestamp
            });
            await recordWorkspaceActivity({
              tenantId: effectiveRun.tenantId,
              workspaceId: effectiveRun.workspaceId,
              eventType: "participant_session_resumed",
              subjectType: "test_run",
              subjectId: effectiveRun.testRunId,
              summary: `Participant session '${participantSession.participantSessionId}' resumed an existing run.`,
              details: {
                participantSessionId: participantSession.participantSessionId,
                currentUnitKey: effectiveRun.currentUnitKey
              }
            });
            return effectiveRun;
          }

          return normalizedExistingRun;
        }

        return this.launch({
          participantSessionId: participantSession.participantSessionId,
          bookletKey: requestedBookletKey
        });
      },
      async saveProgress(input) {
        const testRunId = normalizeTestRunId(input.testRunId);
        const deliveryId = normalizeOptionalParticipantDeliveryId(
          input.deliveryId
        );
        const storedTestRun = await repository.getTestRunById(testRunId);

        if (!storedTestRun) {
          throw new FirstSliceError(
            404,
            "test_run_not_found",
            `Test run '${testRunId}' was not found.`
          );
        }

        await requireAccessibleParticipantSession(
          storedTestRun.participantSessionId
        );

        const contentRelease = await requireContentRelease(
          repository,
          storedTestRun.contentReleaseId
        );
        if (input.logs != null && !Array.isArray(input.logs)) {
          throw new FirstSliceError(
            400,
            "participant_test_logs_invalid",
            "Participant test logs must be an array."
          );
        }
        const incomingLogBatches = input.logs ?? [];
        for (const batch of incomingLogBatches) {
          const unitKey =
            batch?.unitKey == null ? null : String(batch.unitKey).trim() || null;
          if (unitKey) {
            requireRuntimeUnitForBooklet(
              contentRelease,
              storedTestRun.bookletKey,
              unitKey
            );
          }
        }
        const timestamp = now();
        const testRun = await persistEffectiveTestletTimerState({
          contentRelease,
          testRun: normalizeTestRun(storedTestRun),
          timestamp
        });
        requireParticipantTestRunUnlocked(testRun);
        const executionMode = resolveParticipantExecutionMode(
          testRun.executionMode
        );
        const booklet = contentRelease.runtimeSnapshot.bookletEntries.find(
          candidate => candidate.bookletKey === testRun.bookletKey
        );
        if (testRun.status === "completed") {
          throw new FirstSliceError(
            409,
            "test_run_already_completed",
            `Test run '${testRunId}' is already completed.`
          );
        }

        const hasCurrentUnitKeyInput = input.currentUnitKey !== undefined;
        const nextCurrentUnitKey = hasCurrentUnitKeyInput
          ? normalizeOptionalCurrentUnitKey(input.currentUnitKey)
          : testRun.currentUnitKey;
        const nextUnitResponse = normalizeOptionalUnitResponse(input.unitResponse);
        const hasResponseUnitKeyInput = input.responseUnitKey !== undefined;
        const responseUnitKey = hasResponseUnitKeyInput
          ? normalizeOptionalResponseUnitKey(input.responseUnitKey)
          : hasCurrentUnitKeyInput
            ? nextCurrentUnitKey
            : testRun.currentUnitKey;
        if (responseUnitKey) {
          requireRuntimeUnitForBooklet(
            contentRelease,
            testRun.bookletKey,
            responseUnitKey
          );
        }
        let navigationTestRun = testRun;
        let activatedLeaveLock: ReturnType<
          typeof resolveCurrentLeaveLock
        > = null;
        if (nextCurrentUnitKey) {
          requireRuntimeUnitForBooklet(
            contentRelease,
            testRun.bookletKey,
            nextCurrentUnitKey
          );
          requireBookletNavigationAllowed({
            contentRelease,
            testRun,
            targetUnitKey: nextCurrentUnitKey,
            confirmTestletTimeLeave: input.confirmTestletTimeLeave,
            confirmTestletLeaveLock: input.confirmTestletLeaveLock
          });
          const leavingTimedTestlet = executionMode.forceTimeRestrictions
            ? resolveLeavingTimedTestlet(
                booklet,
                testRun,
                nextCurrentUnitKey
              )
            : null;
          const leavePolicy =
            leavingTimedTestlet?.restrictions?.timeMax?.leave ?? null;
          if (
            leavingTimedTestlet &&
            (leavePolicy === "allowed" ||
              (leavePolicy === "confirm" && input.confirmTestletTimeLeave))
          ) {
            navigationTestRun = cancelTestletTimerAfterLeave(
              navigationTestRun,
              leavingTimedTestlet.testletKey,
              timestamp
            );
          }
          activatedLeaveLock = executionMode.forceNaviRestrictions
            ? resolveCurrentLeaveLock(
                booklet,
                testRun,
                nextCurrentUnitKey
              )
            : null;
          if (activatedLeaveLock) {
            navigationTestRun = activateCurrentLeaveLock(
              navigationTestRun,
              activatedLeaveLock
            );
          }
        }

        const nextUnitResponses = { ...navigationTestRun.unitResponses };
        if (
          executionMode.saveResponses &&
          responseUnitKey &&
          nextUnitResponse != null
        ) {
          nextUnitResponses[responseUnitKey] = nextUnitResponse;
        }
        const nextStatus = normalizeTestRunProgressStatus(input.status);
        const statusAdjustedRun = transitionTestletTimersForRunStatus(
          navigationTestRun,
          nextStatus,
          timestamp
        );

        const updatedRun = withEvaluatedBookletStates(booklet, {
          ...statusAdjustedRun,
          status: nextStatus,
          currentUnitKey: nextCurrentUnitKey,
          unitResponses: nextUnitResponses,
          updatedAt: timestamp
        });
        const logTimestamp = Date.parse(timestamp);
        const runtimeLogBatches: Array<{
          unitKey?: string | null;
          originalUnitId?: string | null;
          entries: ParticipantTestLogEntryInput[];
        }> = [];
        const testStateEntries: ParticipantTestLogEntryInput[] = [];
        if (
          responseUnitKey &&
          nextUnitResponse != null &&
          Object.keys(updatedRun.bookletStates ?? {}).length > 0
        ) {
          testStateEntries.push(
            buildBookletStatesTestStateEntry(updatedRun, timestamp)
          );
        }
        if (testletTimerStateChanged(testRun, updatedRun)) {
          testStateEntries.push(
            buildTestletTimeLeftTestStateEntry(updatedRun, timestamp)
          );
        }
        if (nextCurrentUnitKey !== testRun.currentUnitKey) {
          testStateEntries.push({
            key: "CURRENT_UNIT_ID",
            timeStamp: logTimestamp,
            content: nextCurrentUnitKey ?? ""
          });
        }
        if (nextStatus !== testRun.status) {
          testStateEntries.push({
            key: "CONTROLLER",
            timeStamp: logTimestamp,
            content: nextStatus.toUpperCase()
          });
        }
        if (activatedLeaveLock) {
          testStateEntries.push(
            buildLeaveLockTestStateEntry({
              booklet,
              testRun: updatedRun,
              leaveLock: activatedLeaveLock,
              timestamp: logTimestamp
            })
          );
        }
        if (testStateEntries.length > 0) {
          runtimeLogBatches.push({ entries: testStateEntries });
        }
        if (responseUnitKey && nextUnitResponse != null) {
          runtimeLogBatches.push({
            unitKey: responseUnitKey,
            originalUnitId: responseUnitKey,
            entries: [{
              key: "RESPONSE_SAVED",
              timeStamp: logTimestamp,
              content: `${nextUnitResponse.length} characters`
            }]
          });
        }
        const participantTestLogs = executionMode.saveResponses
          ? buildParticipantTestLogs({
              testRun: updatedRun,
              deliveryId,
              batches: [...incomingLogBatches, ...runtimeLogBatches]
            })
          : [];
        await repository.saveTestRun(updatedRun);
        if (participantTestLogs.length > 0) {
          await repository.saveParticipantTestLogs(participantTestLogs);
        }
        const effectiveRun = await persistEffectiveTestletTimerState({
          contentRelease,
          testRun: updatedRun,
          timestamp
        });
        await recordWorkspaceActivity({
          ...(deliveryId
            ? {
                activityEventId:
                  `delivery:${updatedRun.testRunId}:${deliveryId}:activity:progress`
              }
            : {}),
          tenantId: effectiveRun.tenantId,
          workspaceId: effectiveRun.workspaceId,
          eventType: "test_run_progress_saved",
          subjectType: "test_run",
          subjectId: effectiveRun.testRunId,
          summary: `Progress saved for run '${effectiveRun.testRunId}'.`,
          details: {
            status: effectiveRun.status,
            currentUnitKey: effectiveRun.currentUnitKey,
            bookletStates: effectiveRun.bookletStates,
            executionMode: executionMode.mode,
            responsesPersisted: executionMode.saveResponses
          }
        });
        if (activatedLeaveLock) {
          await recordWorkspaceActivity({
            ...(deliveryId
              ? {
                  activityEventId:
                    `delivery:${updatedRun.testRunId}:${deliveryId}:activity:leave-lock`
                }
              : {}),
            tenantId: effectiveRun.tenantId,
            workspaceId: effectiveRun.workspaceId,
            eventType: "testlet_leave_lock_activated",
            subjectType: "test_run",
            subjectId: effectiveRun.testRunId,
            summary:
              activatedLeaveLock.scope === "testlet"
                ? `Block '${activatedLeaveLock.testlet.testletKey}' locked after it was left.`
                : `Unit '${activatedLeaveLock.unit.unitKey}' locked after it was left.`,
            details: {
              scope: activatedLeaveLock.scope,
              testletKey: activatedLeaveLock.testlet.testletKey,
              unitKey: activatedLeaveLock.unit.unitKey,
              nextUnitKey: effectiveRun.currentUnitKey
            }
          });
        }
        return effectiveRun;
      },
      async saveTestLogs(input) {
        const testRunId = normalizeTestRunId(input.testRunId);
        const deliveryId = normalizeOptionalParticipantDeliveryId(
          input.deliveryId
        );
        const storedTestRun = await repository.getTestRunById(testRunId);
        if (!storedTestRun) {
          throw new FirstSliceError(
            404,
            "test_run_not_found",
            `Test run '${testRunId}' was not found.`
          );
        }

        await requireAccessibleParticipantSession(
          storedTestRun.participantSessionId
        );
        const contentRelease = await requireContentRelease(
          repository,
          storedTestRun.contentReleaseId
        );
        if (!Array.isArray(input.logs)) {
          throw new FirstSliceError(
            400,
            "participant_test_logs_invalid",
            "Participant test logs must be an array."
          );
        }
        for (const batch of input.logs) {
          const unitKey =
            batch?.unitKey == null ? null : String(batch.unitKey).trim() || null;
          if (unitKey) {
            requireRuntimeUnitForBooklet(
              contentRelease,
              storedTestRun.bookletKey,
              unitKey
            );
          }
        }

        const testRun = normalizeTestRun(storedTestRun);
        const executionMode = resolveParticipantExecutionMode(
          testRun.executionMode
        );
        if (!executionMode.saveResponses) {
          return 0;
        }
        const participantTestLogs = buildParticipantTestLogs({
          testRun,
          deliveryId,
          batches: input.logs
        });
        if (participantTestLogs.length > 0) {
          await repository.saveParticipantTestLogs(participantTestLogs);
        }
        return participantTestLogs.length;
      },
      async unlockTestlet(input) {
        const testRunId = normalizeTestRunId(input.testRunId);
        const testletKey = String(input.testletKey ?? "").trim();
        if (!testletKey) {
          throw new FirstSliceError(
            400,
            "testlet_key_required",
            "testletKey is required."
          );
        }
        if (typeof input.code !== "string" || !input.code.trim()) {
          throw new FirstSliceError(
            400,
            "testlet_unlock_code_required",
            "A block unlock code is required."
          );
        }
        const storedTestRun = await repository.getTestRunById(testRunId);
        if (!storedTestRun) {
          throw new FirstSliceError(
            404,
            "test_run_not_found",
            `Test run '${testRunId}' was not found.`
          );
        }
        await requireAccessibleParticipantSession(
          storedTestRun.participantSessionId
        );
        const contentRelease = await requireContentRelease(
          repository,
          storedTestRun.contentReleaseId
        );
        const timestamp = now();
        const testRun = await persistEffectiveTestletTimerState({
          contentRelease,
          testRun: normalizeTestRun(storedTestRun),
          timestamp
        });
        requireParticipantTestRunUnlocked(testRun);
        if (testRun.status === "completed") {
          throw new FirstSliceError(
            409,
            "test_run_already_completed",
            `Test run '${testRunId}' is already completed.`
          );
        }
        const booklet = contentRelease.runtimeSnapshot.bookletEntries.find(
          candidate => candidate.bookletKey === testRun.bookletKey
        );
        const testlet = booklet?.testletEntries?.find(
          candidate => candidate.testletKey === testletKey
        );
        const expectedCode = testlet?.restrictions?.codeToEnter?.code;
        if (!testlet || !expectedCode) {
          throw new FirstSliceError(
            404,
            "testlet_code_gate_not_found",
            `Block '${testletKey}' has no code gate in booklet '${testRun.bookletKey}'.`
          );
        }
        if (testRun.unlockedTestletKeys?.includes(testletKey)) {
          return testRun;
        }
        const navigation = resolveBookletNavigationState(contentRelease, testRun);
        if (navigation.nextTestletGate?.testletKey !== testletKey) {
          throw new FirstSliceError(
            409,
            "testlet_code_gate_not_reachable",
            `Block '${testletKey}' is not the next reachable code gate for run '${testRunId}'.`
          );
        }
        // The original participant dialog normalizes letters to uppercase while
        // imported booklet codes may use mixed case. Compare the normalized
        // forms so the UI behavior does not invalidate otherwise compatible
        // source packages.
        const expectedCodeBuffer = Buffer.from(expectedCode.toUpperCase(), "utf8");
        const providedCodeBuffer = Buffer.from(
          input.code.trim().toUpperCase(),
          "utf8"
        );
        if (
          expectedCodeBuffer.length !== providedCodeBuffer.length ||
          !timingSafeEqual(expectedCodeBuffer, providedCodeBuffer)
        ) {
          throw new FirstSliceError(
            403,
            "testlet_unlock_code_invalid",
            "The block unlock code is invalid."
          );
        }
        const unlockedRun = normalizeTestRun({
          ...testRun,
          unlockedTestletKeys: [
            ...(testRun.unlockedTestletKeys ?? []),
            testletKey
          ],
          updatedAt: timestamp
        });
        const navigationAfterUnlock = resolveBookletNavigationState(
          contentRelease,
          unlockedRun
        );
        const updatedRun: TestRun = {
          ...unlockedRun,
          ...(navigationAfterUnlock.nextTestletGate == null &&
          navigationAfterUnlock.forwardDeniedReasons.length === 0 &&
          navigation.nextUnitKey
            ? { currentUnitKey: navigation.nextUnitKey }
            : {})
        };
        await repository.saveTestRun(updatedRun);
        const executionMode = resolveParticipantExecutionMode(
          updatedRun.executionMode
        );
        if (executionMode.saveResponses) {
          const testStateEntries: ParticipantTestLogEntryInput[] = [{
            key: "TESTLETS_CLEARED_CODE",
            timeStamp: Date.parse(timestamp),
            content: JSON.stringify(updatedRun.unlockedTestletKeys ?? [])
          }];
          if (updatedRun.currentUnitKey !== testRun.currentUnitKey) {
            testStateEntries.push({
              key: "CURRENT_UNIT_ID",
              timeStamp: Date.parse(timestamp),
              content: updatedRun.currentUnitKey ?? ""
            });
          }
          await repository.saveParticipantTestLogs(
            buildParticipantTestLogs({
              testRun: updatedRun,
              batches: [{
                entries: testStateEntries
              }]
            })
          );
        }
        const effectiveRun = await persistEffectiveTestletTimerState({
          contentRelease,
          testRun: updatedRun,
          timestamp
        });
        await recordWorkspaceActivity({
          tenantId: effectiveRun.tenantId,
          workspaceId: effectiveRun.workspaceId,
          eventType: "testlet_unlocked",
          subjectType: "test_run",
          subjectId: effectiveRun.testRunId,
          summary: `Block '${testletKey}' unlocked for run '${effectiveRun.testRunId}'.`,
          details: {
            testletKey,
            participantSessionId: effectiveRun.participantSessionId,
            currentUnitKey: effectiveRun.currentUnitKey
          }
        });
        return effectiveRun;
      },
      async resumeRun(input) {
        const testRunId = normalizeTestRunId(input.testRunId);
        const storedTestRun = await repository.getTestRunById(testRunId);

        if (!storedTestRun) {
          throw new FirstSliceError(
            404,
            "test_run_not_found",
            `Test run '${testRunId}' was not found.`
          );
        }

        await requireAccessibleParticipantSession(
          storedTestRun.participantSessionId
        );

        const contentRelease = await requireContentRelease(
          repository,
          storedTestRun.contentReleaseId
        );
        const timestamp = now();
        const testRun = await persistEffectiveTestletTimerState({
          contentRelease,
          testRun: normalizeTestRun(storedTestRun),
          timestamp
        });
        requireParticipantTestRunUnlocked(testRun);
        if (testRun.status === "completed") {
          throw new FirstSliceError(
            409,
            "test_run_already_completed",
            `Test run '${testRunId}' is already completed.`
          );
        }

        if (testRun.status === "running") {
          return testRun;
        }

        const resumedRun = transitionTestletTimersForRunStatus(
          testRun,
          "running",
          timestamp
        );
        await repository.saveTestRun(resumedRun);
        if (resolveParticipantExecutionMode(testRun.executionMode).saveResponses) {
          const resumedStateEntries: ParticipantTestLogEntryInput[] = [{
            key: "CONTROLLER",
            timeStamp: Date.parse(timestamp),
            content: "RUNNING"
          }];
          if (testletTimerStateChanged(testRun, resumedRun)) {
            resumedStateEntries.unshift(
              buildTestletTimeLeftTestStateEntry(resumedRun, timestamp)
            );
          }
          await repository.saveParticipantTestLogs(
            buildParticipantTestLogs({
            testRun: resumedRun,
            batches: [{
              entries: resumedStateEntries
            }]
            })
          );
        }
        const effectiveRun = await persistEffectiveTestletTimerState({
          contentRelease,
          testRun: resumedRun,
          timestamp
        });
        await recordWorkspaceActivity({
          tenantId: effectiveRun.tenantId,
          workspaceId: effectiveRun.workspaceId,
          eventType: "test_run_resumed",
          subjectType: "test_run",
          subjectId: effectiveRun.testRunId,
          summary: `Run '${effectiveRun.testRunId}' resumed.`,
          details: {
            currentUnitKey: effectiveRun.currentUnitKey
          }
        });
        return effectiveRun;
      },
      async completeRun(input) {
        const testRunId = normalizeTestRunId(input.testRunId);
        const storedTestRun = await repository.getTestRunById(testRunId);

        if (!storedTestRun) {
          throw new FirstSliceError(
            404,
            "test_run_not_found",
            `Test run '${testRunId}' was not found.`
          );
        }

        await requireAccessibleParticipantSession(
          storedTestRun.participantSessionId
        );

        const contentRelease = await requireContentRelease(
          repository,
          storedTestRun.contentReleaseId
        );
        const timestamp = now();
        const testRun = await persistEffectiveTestletTimerState({
          contentRelease,
          testRun: normalizeTestRun(storedTestRun),
          timestamp
        });
        requireParticipantTestRunUnlocked(testRun);
        if (testRun.status === "completed") {
          return testRun;
        }
        const booklet = contentRelease.runtimeSnapshot.bookletEntries.find(
          candidate => candidate.bookletKey === testRun.bookletKey
        );
        const executionMode = resolveParticipantExecutionMode(
          testRun.executionMode
        );
        const leavingTimedTestlet = executionMode.forceTimeRestrictions
          ? resolveLeavingTimedTestlet(booklet, testRun, null)
          : null;
        const leavePolicy =
          leavingTimedTestlet?.restrictions?.timeMax?.leave ?? null;
        if (
          leavePolicy === "confirm" &&
          !input.confirmTestletTimeLeave
        ) {
          throw new FirstSliceError(
            409,
            "booklet_completion_denied",
            `Run '${testRunId}' cannot be completed without confirming that the active timed block will be closed.`,
            {
              currentUnitKey: testRun.currentUnitKey,
              deniedReasons: [
                "testlet_time_leave_confirmation_required"
              ]
            }
          );
        }
        const leavingLock = executionMode.forceNaviRestrictions
          ? resolveCurrentLeaveLock(booklet, testRun, null)
          : null;
        if (
          leavingLock?.confirm &&
          !input.confirmTestletLeaveLock
        ) {
          throw new FirstSliceError(
            409,
            "booklet_completion_denied",
            `Run '${testRunId}' cannot be completed without confirming that the active leave lock will be applied.`,
            {
              currentUnitKey: testRun.currentUnitKey,
              deniedReasons: [
                "testlet_leave_confirmation_required"
              ]
            }
          );
        }
        const timeAdjustedCompletionRun =
          leavingTimedTestlet &&
          (leavePolicy === "allowed" ||
            (leavePolicy === "confirm" && input.confirmTestletTimeLeave))
            ? cancelTestletTimerAfterLeave(
                testRun,
                leavingTimedTestlet.testletKey,
                timestamp
              )
            : testRun;
        const completionBaseRun = leavingLock
          ? activateCurrentLeaveLock(timeAdjustedCompletionRun, leavingLock)
          : timeAdjustedCompletionRun;
        const navigation = resolveBookletNavigationState(
          contentRelease,
          completionBaseRun
        );
        if (!navigation.canComplete) {
          throw new FirstSliceError(
            409,
            "booklet_completion_denied",
            `Run '${testRunId}' cannot be completed because the current unit completion policy is not satisfied.`,
            {
              currentUnitKey: completionBaseRun.currentUnitKey,
              deniedReasons: navigation.forwardDeniedReasons
            }
          );
        }

        const lockOnTermination =
          executionMode.monitorable &&
          booklet?.policy?.completion.lockOnTermination === true;
        const completedRun: TestRun = {
          ...(lockOnTermination
            ? transitionTestletTimersForRunStatus(
                completionBaseRun,
                "paused",
                timestamp
              )
            : closeRunningTestletTimers(completionBaseRun, timestamp)),
          status: lockOnTermination ? "paused" : "completed",
          locked: lockOnTermination,
          currentUnitKey: lockOnTermination
            ? completionBaseRun.currentUnitKey
            : null,
          updatedAt: timestamp,
          completedAt: lockOnTermination ? null : timestamp
        };
        await repository.saveTestRun(completedRun);
        if (executionMode.saveResponses) {
          const completedStateEntries: ParticipantTestLogEntryInput[] = [];
          if (testletTimerStateChanged(testRun, completedRun)) {
            completedStateEntries.push(
              buildTestletTimeLeftTestStateEntry(completedRun, timestamp)
            );
          }
          if (leavingLock) {
            completedStateEntries.push(
              buildLeaveLockTestStateEntry({
                booklet,
                testRun: completedRun,
                leaveLock: leavingLock,
                timestamp: Date.parse(timestamp)
              })
            );
          }
          completedStateEntries.push({
            key: "CONTROLLER",
            timeStamp: Date.parse(timestamp),
            content: lockOnTermination ? "LOCKED" : "TERMINATED"
          });
          await repository.saveParticipantTestLogs(
            buildParticipantTestLogs({
              testRun: completedRun,
              batches: [{ entries: completedStateEntries }]
            })
          );
        }

        const participantSession = await repository.getParticipantSessionById(
          testRun.participantSessionId
        );
        if (participantSession && !lockOnTermination) {
          const nextSessionStatus =
            await resolveParticipantSessionStatusAfterCompletion(
              repository,
              participantSession
            );
          await repository.saveParticipantSession({
            ...participantSession,
            status: nextSessionStatus
          });
        }

        await recordWorkspaceActivity({
          tenantId: completedRun.tenantId,
          workspaceId: completedRun.workspaceId,
          eventType: lockOnTermination ? "test_run_locked" : "test_run_completed",
          subjectType: "test_run",
          subjectId: completedRun.testRunId,
          summary: lockOnTermination
            ? `Run '${completedRun.testRunId}' locked after participant termination.`
            : `Run '${completedRun.testRunId}' completed.`,
          details: {
            completedAt: completedRun.completedAt,
            lockOnTermination
          }
        });
        if (leavingLock) {
          await recordWorkspaceActivity({
            tenantId: completedRun.tenantId,
            workspaceId: completedRun.workspaceId,
            eventType: "testlet_leave_lock_activated",
            subjectType: "test_run",
            subjectId: completedRun.testRunId,
            summary:
              leavingLock.scope === "testlet"
                ? `Block '${leavingLock.testlet.testletKey}' locked during participant completion.`
                : `Unit '${leavingLock.unit.unitKey}' locked during participant completion.`,
            details: {
              scope: leavingLock.scope,
              testletKey: leavingLock.testlet.testletKey,
              unitKey: leavingLock.unit.unitKey,
              reason: "participant_completion"
            }
          });
        }

        return completedRun;
      }
    },
    monitorRead: {
      async listOpenRuns(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const storedTestRuns = await repository.listTestRunsByWorkspace(
          workspace.tenantId,
          workspace.workspaceId
        );
        const contentReleases = await repository.listContentReleasesByWorkspace(
          workspace.tenantId,
          workspace.workspaceId
        );
        const timestamp = now();
        const testRuns: TestRun[] = [];
        for (const storedTestRun of storedTestRuns) {
          const contentRelease = contentReleases.find(
            candidate =>
              candidate.contentReleaseId === storedTestRun.contentReleaseId
          );
          testRuns.push(
            contentRelease && storedTestRun.status !== "completed"
              ? await persistEffectiveTestletTimerState({
                  contentRelease,
                  testRun: storedTestRun,
                  timestamp
                })
              : normalizeTestRun(storedTestRun)
          );
        }
        const [
          participantSessions,
          participantRosterEntries,
          participantTestLogs
        ] = await Promise.all([
          repository.listParticipantSessionsByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          ),
          repository.listParticipantRosterEntriesByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          ),
          repository.listLatestParticipantTestStateLogsByWorkspace(
            workspace.tenantId,
            workspace.workspaceId,
            [...originalMonitorTestStateKeys]
          )
        ]);
        const latestTestStates = buildLatestMonitorTestStates(
          participantTestLogs
        );

        const items = testRuns
          .filter(testRun => testRun.status !== "completed")
          .filter(
            testRun =>
              resolveParticipantExecutionMode(testRun.executionMode).monitorable
          )
          .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt))
          .map<OpenMonitorRun>(testRun => {
            const contentRelease = contentReleases.find(
              candidate =>
                candidate.contentReleaseId === testRun.contentReleaseId
            ) ?? null;
            const bookletError = resolveOpenMonitorBookletError(
              contentRelease,
              testRun
            );
            const testletTimers = bookletError
              ? []
              : buildMonitorTestletTimers(
                  contentRelease,
                  testRun,
                  timestamp
                );
            const participantSession =
              participantSessions.find(
                candidate =>
                  candidate.participantSessionId === testRun.participantSessionId
              ) ?? null;
            const location = resolveOpenMonitorRunLocation(
              contentRelease,
              testRun,
              testletTimers
            );

            return {
              testRunId: testRun.testRunId,
              participantSessionId: testRun.participantSessionId,
              loginKey: participantSession?.loginKey ?? "unknown-login",
              groupKey: participantSession?.groupKey ?? "unknown-group",
              executionMode: normalizeParticipantExecutionMode(
                testRun.executionMode
              ),
              participantRosterEntry: participantSession
                ? participantRosterEntries.find(
                    entry => entry.loginKey === participantSession.loginKey
                  ) ?? null
                : null,
              bookletKey: testRun.bookletKey,
              bookletLabel: location.bookletLabel,
              bookletSpecies: location.bookletSpecies,
              bookletError: location.bookletError,
              bookletAssignmentKey:
                testRun.bookletAssignmentKey ?? testRun.bookletKey,
              bookletStates: normalizeTestRun(testRun).bookletStates ?? {},
              testState: buildOpenMonitorRunTestState(
                testRun,
                latestTestStates
              ),
              status: testRun.status,
              locked: testRun.locked === true,
              currentUnitKey: testRun.currentUnitKey,
              currentUnitLabel: location.currentUnitLabel,
              currentBlockKey: location.currentBlockKey,
              currentBlockLabel: location.currentBlockLabel,
              blockNavigationTargets: location.blockNavigationTargets,
              activeTestletTimer:
                testletTimers.find(
                  timer =>
                    timer.current &&
                    (timer.status === "running" || timer.status === "paused")
                ) ?? null,
              updatedAt: resolveOpenMonitorRunUpdatedAt(
                testRun,
                latestTestStates
              )
            };
          });

        return filterOpenMonitorRuns(items, input);
      },
      async exportOpenRunsCsv(input) {
        const items = await this.listOpenRuns(input);
        return formatOpenMonitorRunsCsv({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          items
        });
      }
    },
    monitorControl: {
      async issueRunCommand(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const testRunId = normalizeTestRunId(input.testRunId);
        const commandType = normalizeMonitorRunCommandType(input.commandType);
        const targetUnitKey =
          commandType === "goto"
            ? normalizeMonitorGotoTargetUnitKey(input.targetUnitKey)
            : commandType === "set_testlet_time"
              ? normalizeMonitorTimeTargetUnitKey(input.targetUnitKey)
              : null;
        const remainingSeconds =
          commandType === "set_testlet_time" ||
          (commandType === "goto" && input.remainingSeconds != null)
            ? normalizeMonitorTimeRemainingSeconds(input.remainingSeconds)
            : null;
        const actorId =
          typeof input.actorId === "string" && input.actorId.trim()
            ? input.actorId.trim()
            : null;
        const storedTestRun = await repository.getTestRunById(testRunId);

        if (!storedTestRun) {
          throw new FirstSliceError(
            404,
            "test_run_not_found",
            `Test run '${testRunId}' was not found.`
          );
        }

        const storedNormalizedRun = normalizeTestRun(storedTestRun);
        if (
          storedNormalizedRun.tenantId !== workspace.tenantId ||
          storedNormalizedRun.workspaceId !== workspace.workspaceId
        ) {
          throw new FirstSliceError(
            404,
            "test_run_not_found",
            `Test run '${testRunId}' was not found in workspace '${input.workspaceKey}'.`
          );
        }

        const executionMode = resolveParticipantExecutionMode(
          storedNormalizedRun.executionMode
        );
        if (!executionMode.receiveRemoteCommands) {
          throw new FirstSliceError(
            409,
            "monitor_run_commands_disabled",
            `Execution mode '${executionMode.mode}' does not accept monitor commands.`,
            { executionMode: executionMode.mode }
          );
        }

        const issuedAt = now();
        const contentRelease = await requireContentRelease(
          repository,
          storedNormalizedRun.contentReleaseId
        );
        const testRun = await persistEffectiveTestletTimerState({
          contentRelease,
          testRun: storedNormalizedRun,
          timestamp: issuedAt
        });
        if (testRun.status === "completed") {
          throw new FirstSliceError(
            409,
            "test_run_already_completed",
            `Test run '${testRunId}' is already completed.`
          );
        }

        const participantSession = await requireParticipantSession(
          repository,
          testRun.participantSessionId
        );
        const participantRosterEntry = await findParticipantRosterEntryByLoginKey(
          repository,
          workspace.tenantId,
          workspace.workspaceId,
          participantSession.loginKey
        );
        let nextStatus: TestRunStatus = testRun.status;
        if (commandType === "pause") {
          nextStatus = "paused";
        } else if (commandType === "resume" || commandType === "goto") {
          nextStatus = "running";
        } else if (
          commandType === "complete" ||
          commandType === "complete_and_lock"
        ) {
          nextStatus = "completed";
        }
        let adjustedTestletKey: string | null = null;
        let previousTimer: NonNullable<TestRun["testletTimers"]>[string] | null =
          null;
        const nextTestRun: TestRun =
          commandType === "complete" || commandType === "complete_and_lock"
            ? {
                ...closeRunningTestletTimers(testRun, issuedAt),
                status: "completed",
                locked: commandType === "complete_and_lock",
                currentUnitKey: null,
                updatedAt: issuedAt,
                completedAt: issuedAt
              }
            : commandType === "lock_test"
              ? normalizeTestRun({
                  ...testRun,
                  locked: true,
                  updatedAt: issuedAt
                })
              : commandType === "unlock_test"
                ? normalizeTestRun({
                    ...testRun,
                    locked: false,
                    updatedAt: issuedAt
                  })
                : commandType === "goto" && targetUnitKey
                  ? (() => {
                      const adjusted = applyMonitorGoto({
                        contentRelease,
                        testRun,
                        targetUnitKey,
                        remainingSeconds,
                        timestamp: issuedAt
                      });
                      adjustedTestletKey = adjusted.restoredTestletKey;
                      previousTimer = adjusted.previousTimer;
                      return adjusted.testRun;
                    })()
                  : commandType === "unlock_navigation"
                    ? applyMonitorNavigationUnlock({
                        contentRelease,
                        testRun,
                        timestamp: issuedAt
                      })
                    : commandType === "lock_navigation"
                      ? applyMonitorNavigationLock({
                          testRun,
                          timestamp: issuedAt
                        })
                      : commandType === "set_testlet_time" &&
                          targetUnitKey &&
                          remainingSeconds
                        ? (() => {
                            const adjusted = applyMonitorSetTestletTime({
                              contentRelease,
                              testRun,
                              targetUnitKey,
                              remainingSeconds,
                              timestamp: issuedAt
                            });
                            adjustedTestletKey = adjusted.testletKey;
                            previousTimer = adjusted.previousTimer;
                            return adjusted.testRun;
                          })()
                        : transitionTestletTimersForRunStatus(
                            testRun,
                            nextStatus as Extract<
                              TestRunStatus,
                              "running" | "paused"
                            >,
                            issuedAt
                          );
        if (nextTestRun !== testRun) {
          await repository.saveTestRun(nextTestRun);
        }
        const monitorTestLogEntries: ParticipantTestLogEntryInput[] = [];
        if (nextTestRun.status !== testRun.status) {
          monitorTestLogEntries.push({
            key: "CONTROLLER",
            timeStamp: Date.parse(issuedAt),
            content:
              nextTestRun.status === "completed"
                ? "TERMINATED"
                : nextTestRun.status.toUpperCase()
          });
        }
        if (nextTestRun.locked !== testRun.locked) {
          monitorTestLogEntries.push({
            key: "CONTROLLER",
            timeStamp: Date.parse(issuedAt),
            content: nextTestRun.locked
              ? "LOCKED"
              : nextTestRun.status.toUpperCase()
          });
        }
        if (nextTestRun.currentUnitKey !== testRun.currentUnitKey) {
          monitorTestLogEntries.push({
            key: "CURRENT_UNIT_ID",
            timeStamp: Date.parse(issuedAt),
            content: nextTestRun.currentUnitKey ?? ""
          });
        }
        if (testletTimerStateChanged(testRun, nextTestRun)) {
          monitorTestLogEntries.unshift(
            buildTestletTimeLeftTestStateEntry(nextTestRun, issuedAt)
          );
        }
        if (executionMode.saveResponses && monitorTestLogEntries.length > 0) {
          await repository.saveParticipantTestLogs(
            buildParticipantTestLogs({
              testRun: nextTestRun,
              batches: [{ entries: monitorTestLogEntries }]
            })
          );
        }
        const effectiveNextTestRun =
          commandType === "complete" || commandType === "complete_and_lock"
            ? nextTestRun
            : await persistEffectiveTestletTimerState({
                contentRelease,
                testRun: nextTestRun,
                timestamp: issuedAt
              });
        if (
          commandType === "goto" &&
          adjustedTestletKey &&
          remainingSeconds != null &&
          previousTimer &&
          (previousTimer.status === "expired" ||
            previousTimer.status === "cancelled" ||
            getTestletTimerRemainingSeconds(previousTimer, issuedAt) <= 0)
        ) {
          const restoredTimer =
            effectiveNextTestRun.testletTimers?.[adjustedTestletKey];
          await recordWorkspaceActivity({
            tenantId: effectiveNextTestRun.tenantId,
            workspaceId: effectiveNextTestRun.workspaceId,
            eventType: "testlet_timer_started",
            actorId,
            subjectType: "test_run",
            subjectId: effectiveNextTestRun.testRunId,
            summary: `Timed block '${adjustedTestletKey}' reopened by monitor for run '${effectiveNextTestRun.testRunId}'.`,
            details: {
              testletKey: adjustedTestletKey,
              durationSeconds: restoredTimer?.durationSeconds ?? remainingSeconds,
              expiresAt: restoredTimer?.expiresAt ?? null,
              currentUnitKey: effectiveNextTestRun.currentUnitKey,
              restoredByMonitor: true
            }
          });
        }
        const nextParticipantSession =
          commandType === "complete" || commandType === "complete_and_lock"
            ? {
                ...participantSession,
                status: await resolveParticipantSessionStatusAfterCompletion(
                  repository,
                  participantSession
                )
              }
            : participantSession;
        if (nextParticipantSession !== participantSession) {
          await repository.saveParticipantSession(nextParticipantSession);
        }

        const commandId = idGenerator();
        await recordWorkspaceActivity({
          tenantId: workspace.tenantId,
          workspaceId: workspace.workspaceId,
          eventType: "monitor_run_command_issued",
          actorId,
          subjectType: "test_run",
          subjectId: testRunId,
          summary: `Monitor command '${commandType}' issued for run '${testRunId}'.`,
          details: {
            commandId,
            commandType,
            previousStatus: testRun.status,
            nextStatus: effectiveNextTestRun.status,
            previousLocked: testRun.locked === true,
            locked: effectiveNextTestRun.locked === true,
            completedAt: effectiveNextTestRun.completedAt ?? null,
            previousUnitKey: testRun.currentUnitKey,
            targetUnitKey,
            targetTestletKey: adjustedTestletKey,
            previousTimerStatus: previousTimer?.status ?? null,
            previousRemainingSeconds: previousTimer
              ? getTestletTimerRemainingSeconds(previousTimer, issuedAt)
              : null,
            remainingSeconds,
            previousNavigationUnlocked:
              testRun.monitorNavigationUnlocked === true,
            navigationUnlocked:
              effectiveNextTestRun.monitorNavigationUnlocked === true,
            participantSessionId: participantSession.participantSessionId,
            loginKey: participantSession.loginKey,
            groupKey: participantSession.groupKey,
            bookletKey: testRun.bookletKey,
            displayName: participantRosterEntry?.displayName ?? null
          }
        });

        return {
          commandId,
          commandType,
          actorId,
          issuedAt,
          previousStatus: testRun.status,
          previousLocked: testRun.locked === true,
          testRun: effectiveNextTestRun,
          participantSession: nextParticipantSession
        };
      },
      async issueRunCommands(input) {
        const commands: MonitorRunCommandResult[] = [];
        const failures: Array<{
          testRunId: string;
          statusCode: number;
          error: string;
          message: string;
          details: unknown;
        }> = [];
        for (const testRunId of input.testRunIds) {
          try {
            commands.push(
              await this.issueRunCommand({
                tenantKey: input.tenantKey,
                workspaceKey: input.workspaceKey,
                testRunId,
                commandType: input.commandType,
                actorId: input.actorId,
                targetUnitKey: input.targetUnitKey,
                remainingSeconds: input.remainingSeconds
              })
            );
          } catch (error) {
            if (!(error instanceof FirstSliceError)) {
              throw error;
            }
            failures.push({
              testRunId,
              statusCode: error.statusCode,
              error: error.errorCode,
              message: error.message,
              details: error.details
            });
          }
        }
        return { commands, failures };
      }
    },
    systemCheck: {
      async listSystemChecks(input) {
        return listWorkspaceSystemChecks(input);
      },
      async getSystemCheck(input) {
        return requireWorkspaceSystemCheck(input);
      },
      async saveSystemCheckReport(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const systemCheck = await requireWorkspaceSystemCheck(input);
        if (!systemCheck.canSave) {
          throw new FirstSliceError(
            409,
            "system_check_report_saving_disabled",
            `System check '${systemCheck.checkId}' does not allow reports to be saved.`
          );
        }
        const sourcePackage = await requireSourcePackage(
          repository,
          systemCheck.sourcePackageId
        );
        const storedDefinition = sourcePackage.contentStructure?.systemCheckEntries?.find(
          entry => entry.checkId.toUpperCase() === systemCheck.checkId.toUpperCase()
        );
        if (
          !input.authenticatedLoginName &&
          (!storedDefinition?.saveKey ||
            storedDefinition.saveKey.toUpperCase() !==
              String(input.keyPhrase ?? "").trim().toUpperCase())
        ) {
          throw new FirstSliceError(
            403,
            "system_check_save_key_invalid",
            "The system-check report key is invalid."
          );
        }
        const createdAt = now();
        const systemCheckReportId = idGenerator();
        const report: SystemCheckReport = {
          systemCheckReportId,
          tenantId: workspace.tenantId,
          workspaceId: workspace.workspaceId,
          sourcePackageId: systemCheck.sourcePackageId,
          originalFileName: `report_${systemCheckReportId}.json`,
          fileModifiedAt: createdAt,
          sourceDate: formatLegacySystemCheckDate(createdAt),
          checkId: systemCheck.checkId,
          checkLabel: systemCheck.displayLabel,
          title:
            String(input.authenticatedLoginName ?? input.title ?? "").trim() ||
            systemCheck.displayLabel,
          responses: input.responses ?? "",
          environment: normalizeSystemCheckReportEntries(
            "environment",
            input.environment
          ),
          network: normalizeSystemCheckReportEntries("network", input.network),
          questionnaire: normalizeSystemCheckReportEntries(
            "questionnaire",
            input.questionnaire
          ),
          unit: normalizeSystemCheckReportEntries("unit", input.unit),
          createdAt
        };
        await recordWorkspaceActivity({
          tenantId: workspace.tenantId,
          workspaceId: workspace.workspaceId,
          eventType: "system_check_report_saved",
          subjectType: "system_check_report",
          subjectId: report.systemCheckReportId,
          summary: `System-check report '${report.title}' saved for '${report.checkId}'.`,
          details: { report }
        });
        return report;
      }
    }
  };
};
