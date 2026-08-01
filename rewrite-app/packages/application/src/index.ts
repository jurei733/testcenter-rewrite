import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { inflateRawSync } from "node:zlib";

import { DOMParser } from "@xmldom/xmldom";
import type {
  Document as XmlDocument,
  Element as XmlElement
} from "@xmldom/xmldom";
import { CodingScheme } from "@iqb/responses";
import type { Response as IqbResponse } from "@iqb/responses";

import {
  bookletNavigationDeniedReasons,
  compileBookletRuntimePolicy,
  isSupportedVeronaPlayerApiVersion,
  parseParticipantRosterText,
  parseVeronaUnitResponse,
  readBookletConfigValues
} from "@testcenter-rewrite-app/contracts";
import type {
  ParticipantRosterSource,
  SourceDocumentSource
} from "@testcenter-rewrite-app/contracts";
import { monitorRunCommandTypes } from "@testcenter-rewrite-app/domain";
import type {
  AdminAuditEvent,
  AdminAuditEventType,
  AdminRole,
  AdminRoleAssignment,
  AdminSession,
  AdminSessionStatus,
  AdminUser,
  AdminUserStatus,
  BookletStateCondition,
  BookletStateVariableSource,
  BookletLeaveRestriction,
  BookletRuntimePolicy,
  ContentReleaseActivationReadiness,
  ContentRelease,
  ContentReleaseBookletEntry,
  ContentReleaseStatus,
  ContentReleaseRuntimeSnapshot,
  ImportJob,
  ImportJobStatus,
  ImportJobDiagnostic,
  MonitorRunCommandResult,
  MonitorRunCommandType,
  OpenMonitorRun,
  ParticipantCurrentRunState,
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
  SourcePackageTestletEntry,
  Tenant,
  TestRun,
  TestRunStatus,
  UnitCodingScheme,
  Workspace,
  WorkspaceContentReleaseListItem,
  WorkspaceContentReleaseDetail,
  WorkspaceActivityEvent,
  WorkspaceActivityEventListItem,
  WorkspaceActivitySubjectType,
  WorkspaceImportJobDetail,
  WorkspaceImportJobListItem,
  WorkspaceDetailedResponse,
  WorkspaceGroupResultDeletion,
  WorkspaceParticipantSessionDetail,
  WorkspaceParticipantSessionListItem,
  WorkspaceParticipantRosterItem,
  WorkspaceReview,
  WorkspaceReviewListItem,
  WorkspaceSourcePackageDetail,
  WorkspaceSourcePackageListItem,
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
  }): Promise<string>;
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
  listSourcePackages(input: {
    tenantKey: string;
    workspaceKey: string;
    status?: SourcePackageStatus;
    mediaType?: string;
    fileName?: string;
    latestImportStatus?: ImportJobStatus;
    limit?: number;
  }): Promise<WorkspaceSourcePackageListItem[]>;
  exportSourcePackagesCsv(input: {
    tenantKey: string;
    workspaceKey: string;
    status?: SourcePackageStatus;
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
    items: WorkspaceParticipantRosterItem[];
  }>;
  listParticipantRoster(input: {
    tenantKey: string;
    workspaceKey: string;
  }): Promise<WorkspaceParticipantRosterItem[]>;
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
    bookletKey?: string;
    participantSessionId?: string;
    testRunId?: string;
    unitKey?: string;
    status?: TestRun["status"];
    limit?: number;
  }): Promise<WorkspaceDetailedResponse[]>;
  exportResponseCsv(input: {
    tenantKey: string;
    workspaceKey: string;
    loginKey?: string;
    groupKey?: string;
    bookletKey?: string;
    participantSessionId?: string;
    testRunId?: string;
    unitKey?: string;
    status?: TestRun["status"];
    limit?: number;
  }): Promise<string>;
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
};

export type WorkspaceResultsPort = {
  deleteGroupResults(input: {
    tenantKey: string;
    workspaceKey: string;
    groupKey: string;
  }): Promise<WorkspaceGroupResultDeletion>;
};

export type WorkspaceReviewPort = {
  listReviews(input: {
    tenantKey: string;
    workspaceKey: string;
    loginKey?: string;
    groupKey?: string;
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
    reviewerId: string;
    category: string;
    comment: string;
  }): Promise<WorkspaceReviewListItem>;
  updateReview(input: {
    tenantKey: string;
    workspaceKey: string;
    reviewId: string;
    unitKey?: string | null;
    reviewerId?: string;
    category?: string;
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
  }): Promise<ParticipantSession>;
  getRuntimeState(input: {
    participantSessionId: string;
  }): Promise<ParticipantRuntimeState>;
  getCurrentRunState(input: {
    participantSessionId: string;
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
    currentUnitKey?: string | null;
    status: Extract<TestRun["status"], "running" | "paused">;
    unitResponse?: string | null;
    confirmTestletTimeLeave?: boolean;
    confirmTestletLeaveLock?: boolean;
  }): Promise<TestRun>;
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
    bookletKey?: string;
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
    bookletKey?: string;
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
  signOut(input: { sessionToken: string }): Promise<AdminSession>;
};

export type AdminDirectoryPort = {
  listAdminUsers(input: {
    sessionToken: string;
    username?: string;
    status?: AdminUserStatus;
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
    roleAssignments?: Array<{
      role: AdminRole;
      tenantKey?: string | null;
      workspaceKey?: string | null;
    }>;
  }): Promise<{ adminUser: AdminUser; roleAssignments: AdminRoleAssignment[] }>;
  updateAdminUser(input: {
    sessionToken: string;
    adminUserId: string;
    displayName?: string;
    status?: AdminUserStatus;
  }): Promise<{ adminUser: AdminUser; roleAssignments: AdminRoleAssignment[] }>;
  resetAdminUserPassword(input: {
    sessionToken: string;
    adminUserId: string;
    password: string;
  }): Promise<{ adminUser: AdminUser; roleAssignments: AdminRoleAssignment[] }>;
  assignAdminRole(input: {
    sessionToken: string;
    adminUserId: string;
    role: AdminRole;
    tenantKey?: string | null;
    workspaceKey?: string | null;
  }): Promise<{ adminUser: AdminUser; roleAssignments: AdminRoleAssignment[] }>;
  revokeAdminRole(input: {
    sessionToken: string;
    adminUserId: string;
    roleAssignmentId: string;
  }): Promise<{ adminUser: AdminUser; roleAssignments: AdminRoleAssignment[] }>;
  listAdminAuditEvents(input: {
    sessionToken: string;
    eventType?: AdminAuditEventType;
    actorAdminUserId?: string;
    subjectAdminUserId?: string;
    limit?: number;
  }): Promise<AdminAuditEvent[]>;
};

export type FirstSlicePorts = {
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
  bootstrapAdminUser: "BootstrapAdminUser",
  adminSignIn: "AdminSignIn",
  getAdminCurrentSession: "GetAdminCurrentSession",
  listAdminSessions: "ListAdminSessions",
  revokeAdminSession: "RevokeAdminSession",
  adminSignOut: "AdminSignOut",
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
  listSourcePackages: "ListSourcePackages",
  exportSourcePackagesCsv: "ExportSourcePackagesCsv",
  createSourcePackage: "CreateSourcePackage",
  createImportJob: "CreateImportJob",
  retrySourcePackageImport: "RetrySourcePackageImport",
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
  resumeTestRun: "ResumeTestRun",
  completeTestRun: "CompleteTestRun",
  listOpenMonitorRuns: "ListOpenMonitorRuns",
  issueMonitorRunCommand: "IssueMonitorRunCommand"
} as const;

export type CreateImportJobResult = {
  importJob: ImportJob;
  stagedContentRelease: ContentRelease | null;
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
  listAdminUsers(): Promise<AdminUser[]>;
  getAdminUserById(adminUserId: string): Promise<AdminUser | null>;
  getAdminUserByUsername(username: string): Promise<AdminUser | null>;
  saveAdminUser(adminUser: AdminUser): Promise<void>;
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
  listWorkspaceActivityEventsByWorkspace(
    tenantId: string,
    workspaceId: string
  ): Promise<WorkspaceActivityEvent[]>;
  saveWorkspaceActivityEvent(
    activityEvent: WorkspaceActivityEvent
  ): Promise<void>;
  getSourcePackageById(sourcePackageId: string): Promise<SourcePackage | null>;
  listSourcePackagesByWorkspace(
    tenantId: string,
    workspaceId: string
  ): Promise<SourcePackage[]>;
  saveSourcePackage(sourcePackage: SourcePackage): Promise<void>;
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
  getParticipantRosterPasswordHash(
    tenantId: string,
    workspaceId: string,
    loginKey: string
  ): Promise<string | null>;
  saveParticipantRosterEntry(
    participantRosterEntry: ParticipantRosterEntry,
    passwordHash: string | null
  ): Promise<void>;
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
};

const ADMIN_SESSION_TTL_MS = 12 * 60 * 60 * 1_000;
const PASSWORD_HASH_KEY_LENGTH = 64;
const ADMIN_ROLES: AdminRole[] = [
  "platform_admin",
  "tenant_admin",
  "workspace_admin"
];
const ADMIN_USER_STATUSES: AdminUserStatus[] = ["active", "disabled"];
const TEST_RUN_PROGRESS_STATUSES: Array<
  Extract<TestRunStatus, "running" | "paused">
> = ["running", "paused"];

type AdminRoleAssignmentInput = {
  role: AdminRole;
  tenantKey?: string | null;
  workspaceKey?: string | null;
};

type ResolvedAdminRoleScope = {
  role: AdminRole;
  tenantId: string | null;
  workspaceId: string | null;
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
  if (typeof value !== "string" || value.length < 8) {
    throw new FirstSliceError(
      400,
      "admin_password_policy_violation",
      "Admin password must be at least 8 characters long."
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
      "Monitor run command type must be 'pause', 'resume', 'complete', 'goto', 'unlock_navigation', 'lock_navigation', or 'set_testlet_time'."
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

const createAdminSessionToken = (): string => randomBytes(32).toString("base64url");

const calculateAdminSessionExpiry = (
  createdAt: string,
  sessionTtlMs: number
): string => new Date(Date.parse(createdAt) + sessionTtlMs).toISOString();

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
  (await repository.listAdminRoleAssignmentsByUserId(adminUserId)).sort(
    (left, right) => left.createdAt.localeCompare(right.createdAt)
  );

const requireActiveAdminSession = async (
  repository: FirstSliceRepository,
  sessionToken: string,
  nowIso: string
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
  const assignments = entry?.bookletAssignments?.length
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
          )
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

const buildParticipantRuntimeBooklets = (input: {
  contentRelease: ContentRelease;
  participantRosterEntry: ParticipantRosterEntry | null;
  testRuns: TestRun[];
}): ParticipantRuntimeBooklet[] => {
  const assignedBooklets = getParticipantRosterBookletAssignments(
    input.participantRosterEntry
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
        status: hasOpenRun
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
  const tenantKey = normalizeOptionalScopeKey(input.tenantKey, "tenantKey");
  const workspaceKey = normalizeOptionalScopeKey(input.workspaceKey, "workspaceKey");

  if (role === "platform_admin") {
    if (tenantKey || workspaceKey) {
      throw new FirstSliceError(
        400,
        "admin_role_scope_invalid",
        "Platform admin role assignments must not include tenant or workspace scope."
      );
    }

    return { role, tenantId: null, workspaceId: null };
  }

  if (!tenantKey) {
    throw new FirstSliceError(
      400,
      "admin_role_scope_invalid",
      "Tenant-scoped admin roles require tenantKey."
    );
  }

  if (role === "tenant_admin") {
    if (workspaceKey) {
      throw new FirstSliceError(
        400,
        "admin_role_scope_invalid",
        "Tenant admin role assignments must not include workspaceKey."
      );
    }

    const tenant = await requireTenant(repository, tenantKey);
    return { role, tenantId: tenant.tenantId, workspaceId: null };
  }

  if (!workspaceKey) {
    throw new FirstSliceError(
      400,
      "admin_role_scope_invalid",
      "Workspace admin role assignments require tenantKey and workspaceKey."
    );
  }

  const workspace = await requireWorkspace(repository, tenantKey, workspaceKey);
  return { role, tenantId: workspace.tenantId, workspaceId: workspace.workspaceId };
};

const isSameAdminRoleScope = (
  roleAssignment: AdminRoleAssignment,
  scope: ResolvedAdminRoleScope
): boolean =>
  roleAssignment.role === scope.role &&
  roleAssignment.tenantId === scope.tenantId &&
  roleAssignment.workspaceId === scope.workspaceId;

const summarizeAdminRoleAssignment = (
  roleAssignment: AdminRoleAssignment
): Record<string, string | null> => ({
  roleAssignmentId: roleAssignment.roleAssignmentId,
  role: roleAssignment.role,
  tenantId: roleAssignment.tenantId,
  workspaceId: roleAssignment.workspaceId
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
  activeContentReleaseId: string;
}): Promise<OpenMonitorRun[]> => {
  const participantSessions =
    await input.repository.listParticipantSessionsByWorkspace(
      input.tenantId,
      input.workspaceId
    );
  const participantRosterEntries =
    await input.repository.listParticipantRosterEntriesByWorkspace(
      input.tenantId,
      input.workspaceId
    );
  const activeSessionIds = new Set(
    participantSessions
      .filter(
        participantSession =>
          participantSession.contentReleaseId === input.activeContentReleaseId
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

  return openRuns.map(testRun => {
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
      participantRosterEntry: participantSession
        ? participantRosterEntries.find(
            entry => entry.loginKey === participantSession.loginKey
          ) ?? null
        : null,
      bookletKey: testRun.bookletKey,
      bookletAssignmentKey:
        testRun.bookletAssignmentKey ?? testRun.bookletKey,
      bookletStates: normalizeTestRun(testRun).bookletStates ?? {},
      status: testRun.status,
      currentUnitKey: testRun.currentUnitKey,
      updatedAt: testRun.updatedAt
    };
  });
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

const escapeCsvCell = (value: string | null | undefined): string => {
  const normalizedValue = value ?? "";
  return `"${normalizedValue.replace(/"/g, "\"\"")}"`;
};

type DetailedResponseFilters = {
  loginKey?: string;
  groupKey?: string;
  bookletKey?: string;
  participantSessionId?: string;
  testRunId?: string;
  unitKey?: string;
  status?: TestRun["status"];
  limit?: number;
};

type WorkspaceReviewFilters = {
  loginKey?: string;
  groupKey?: string;
  bookletKey?: string;
  participantSessionId?: string;
  testRunId?: string;
  unitKey?: string;
  reviewerId?: string;
  category?: string;
  limit?: number;
};

type OpenMonitorRunFilters = {
  loginKey?: string;
  groupKey?: string;
  bookletKey?: string;
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

const resolveOperatorReadLimit = (limit: number | undefined): number =>
  Math.max(1, Math.min(limit ?? 500, 500));

const filterOpenMonitorRuns = (
  items: OpenMonitorRun[],
  input: OpenMonitorRunFilters
): OpenMonitorRun[] => {
  const filters = {
    loginKey: normalizeExactFilter(input.loginKey),
    groupKey: normalizeExactFilter(input.groupKey),
    bookletKey: normalizeExactFilter(input.bookletKey),
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
        (!filters.bookletKey ||
          item.bookletKey === filters.bookletKey ||
          item.bookletAssignmentKey === filters.bookletKey ||
          item.participantRosterEntry?.bookletKey === filters.bookletKey) &&
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
    .slice(0, resolveOperatorReadLimit(input.limit));
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
    "mediaType",
    "status",
    "uploadedAt",
    "bookletCount",
    "unitCount",
    "hasSourceDocument",
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
        sourcePackage.mediaType,
        sourcePackage.status,
        sourcePackage.uploadedAt,
        String(bookletEntries.length),
        String(unitCount),
        String(sourcePackage.sourceDocument !== null),
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
    "groupKey",
    "bookletKey",
    "displayName",
    "passwordRequired",
    "importedAt",
    "validationWarningCodes",
    "validationWarningMessages",
    "bookletKeys",
    "bookletStatePresets",
    "bookletAssignments"
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
        item.groupKey,
        item.bookletKey ?? "",
        item.displayName ?? "",
        item.passwordRequired ? "true" : "false",
        item.importedAt,
        item.validationWarnings.map(warning => warning.code).join("|"),
        item.validationWarnings.map(warning => warning.message).join("|"),
        getParticipantRosterBookletKeys(item).join("|"),
        JSON.stringify(item.bookletStatePresets ?? {}),
        JSON.stringify(getParticipantRosterBookletAssignments(item))
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
    "rosterDisplayName"
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
        item.participantRosterEntry?.displayName ?? ""
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
    "bookletKey",
    "bookletAssignmentKey",
    "bookletStates",
    "status",
    "currentUnitKey",
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
        item.bookletKey,
        item.bookletAssignmentKey,
        JSON.stringify(item.bookletStates),
        item.status,
        item.currentUnitKey ?? "",
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
    bookletKey: normalizeExactFilter(input.bookletKey),
    participantSessionId: normalizeExactFilter(input.participantSessionId),
    testRunId: normalizeExactFilter(input.testRunId),
    unitKey: normalizeExactFilter(input.unitKey),
    reviewerId: normalizeExactFilter(input.reviewerId),
    category: normalizeExactFilter(input.category)
  };

  return [...input.reviews]
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
        (!filters.bookletKey ||
          item.testRun?.bookletKey === filters.bookletKey ||
          item.participantRosterEntry?.bookletKey === filters.bookletKey) &&
        (!filters.participantSessionId ||
          item.review.participantSessionId === filters.participantSessionId) &&
        (!filters.testRunId || item.review.testRunId === filters.testRunId) &&
        (!filters.unitKey || item.review.unitKey === filters.unitKey) &&
        (!filters.reviewerId || item.review.reviewerId === filters.reviewerId) &&
        (!filters.category || item.review.category === filters.category)
    )
    .sort(
      (left, right) =>
        right.review.updatedAt.localeCompare(left.review.updatedAt) ||
        right.review.createdAt.localeCompare(left.review.createdAt) ||
        left.review.reviewId.localeCompare(right.review.reviewId)
    )
    .slice(0, resolveOperatorReadLimit(input.limit));
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
    limit: input.limit
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
    "reviewerId",
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
        item.review.reviewerId,
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
  message: string
): ImportJobDiagnostic => ({
  severity: "error",
  code,
  message
});

const hasStructuredContent = (
  contentStructure: SourcePackageContentStructure | null | undefined
): contentStructure is SourcePackageContentStructure =>
  Boolean(
    contentStructure &&
      Array.isArray(contentStructure.bookletEntries) &&
      contentStructure.bookletEntries.length > 0
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

const normalizeContentStructure = (
  contentStructure: SourcePackageContentStructure
): ContentReleaseRuntimeSnapshot | null => {
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
    if (bookletEntry.config && Object.keys(bookletEntry.config).length > 0) {
      normalizedBooklet.policy = compileBookletRuntimePolicy(bookletEntry.config);
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
      const unitKey = normalizeManifestToken(unitEntry.unitKey);
      if (!unitKey || unitKeys.has(unitKey)) {
        continue;
      }

      const description = normalizeUnitContent(unitEntry.description);
      const content = normalizeUnitContent(unitEntry.content);
      const playerKey = normalizeManifestToken(unitEntry.playerKey);
      const unitDefinition = normalizeRuntimeDocument(unitEntry.unitDefinition);
      const unitDefinitionType = normalizeManifestToken(
        unitEntry.unitDefinitionType
      );
      const codingScheme = normalizeUnitCodingScheme(unitEntry.codingScheme);
      normalizedBooklet.unitEntries.push({
        unitKey,
        displayLabel: normalizeManifestLabel(
          unitEntry.displayLabel,
          "Unit",
          unitKey
        ),
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
        ...(codingScheme ? { codingScheme } : {})
      });
      unitKeys.add(unitKey);
    }

    if (normalizedBooklet.unitEntries.length > 0) {
      bookletEntriesByKey.set(bookletKey, normalizedBooklet);
      unitKeysByBookletKey.set(bookletKey, unitKeys);
    }
  }

  const bookletEntries = Array.from(bookletEntriesByKey.values());

  if (bookletEntries.length === 0) {
    return null;
  }

  const playerEntries = Array.from(playerEntriesByKey.values());
  return {
    bookletEntries,
    ...(playerEntries.length > 0 ? { playerEntries } : {})
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
              return {
                unitKey: String(
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
                ).trim(),
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
  if (
    !new RegExp(
      `(?:^|/)definitions/vo_${canonicalRootName}\\.xsd(?:[?#].*)?$`,
      "i"
    ).test(schemaLocation)
  ) {
    diagnostics.push(
      createImportDiagnostic(
        "testcenter_xml_schema_reference_invalid",
        `Original Testcenter XML '${sourceFileName}' references schema '${schemaLocation}', which does not match '${canonicalRootName}'.`
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

  if (canonicalRootName === "Booklet") {
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

    const units = xmlChildrenNamed(root, "Units")[0];
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
        (units ? xmlDescendantsNamed(units, "Testlet") : []).map(testlet => ({
          value: testlet.getAttribute("id")?.trim() ?? "",
          label: "testlet id"
        })),
        "testcenter_xml_testlet_id_duplicate",
        sourceFileName
      )
    );
  }

  if (canonicalRootName === "Unit") {
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
  }

  if (canonicalRootName === "Testtakers") {
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
    const groups = xmlChildrenNamed(root, "Group");
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
    }
    for (const login of logins) {
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
    /<((?:[a-zA-Z_][\w.-]*:)?resource)\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/gi
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
    const testletEntries: SourcePackageTestletEntry[] = [];
    const unitTestletPaths = new Map<string, string[]>();

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
                    lockAfterLeavingElement.getAttribute("confirm")?.trim() ===
                    "true",
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
      unitEntries.push({
        unitKey: readXmlUnitEntryKey(unitAttributes, unitContent),
        displayLabel: String(
          readXmlAttribute(
            unitAttributes,
            "displayLabel",
            "label",
            "labelshort",
            "labelShort",
            "title",
            "name",
            "displayName"
          ) ??
            readXmlChildText(
              unitContent,
              "title",
              "label",
              "labelshort",
              "labelShort",
              "name",
              "displayName"
            ) ??
            ""
        ).trim(),
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
      config: readBookletConfig(bookletMatch[3] ?? ""),
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

const normalizeParsedXmlContentStructure = (
  sourceDocument: string
): ContentReleaseRuntimeSnapshot | null => {
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
  compressionMethod: number;
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
    if (zipBuffer.readUInt32LE(offset) === 0x06054b50) {
      return offset;
    }
  }
  return -1;
};

const readZipEntries = (zipBuffer: Buffer): ZipEntry[] => {
  const endOfCentralDirectoryOffset =
    findZipEndOfCentralDirectoryOffset(zipBuffer);
  if (endOfCentralDirectoryOffset < 0) {
    return [];
  }

  const entryCount = zipBuffer.readUInt16LE(endOfCentralDirectoryOffset + 10);
  const centralDirectoryOffset = zipBuffer.readUInt32LE(
    endOfCentralDirectoryOffset + 16
  );
  const entries: ZipEntry[] = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entryCount; index += 1) {
    if (offset + 46 > zipBuffer.length || zipBuffer.readUInt32LE(offset) !== 0x02014b50) {
      return [];
    }

    const compressionMethod = zipBuffer.readUInt16LE(offset + 10);
    const compressedSize = zipBuffer.readUInt32LE(offset + 20);
    const uncompressedSize = zipBuffer.readUInt32LE(offset + 24);
    const fileNameLength = zipBuffer.readUInt16LE(offset + 28);
    const extraLength = zipBuffer.readUInt16LE(offset + 30);
    const commentLength = zipBuffer.readUInt16LE(offset + 32);
    const localHeaderOffset = zipBuffer.readUInt32LE(offset + 42);
    const fileNameStart = offset + 46;
    const fileNameEnd = fileNameStart + fileNameLength;

    if (fileNameEnd > zipBuffer.length) {
      return [];
    }

    entries.push({
      fileName: zipBuffer.toString("utf8", fileNameStart, fileNameEnd),
      compressionMethod,
      compressedSize,
      uncompressedSize,
      localHeaderOffset
    });
    offset = fileNameEnd + extraLength + commentLength;
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
    zipBuffer.readUInt32LE(entry.localHeaderOffset) !== 0x04034b50
  ) {
    return null;
  }

  const fileNameLength = zipBuffer.readUInt16LE(entry.localHeaderOffset + 26);
  const extraLength = zipBuffer.readUInt16LE(entry.localHeaderOffset + 28);
  const dataStart = entry.localHeaderOffset + 30 + fileNameLength + extraLength;
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

  if (!data || data.length > maxOutputBytes) {
    return null;
  }

  return data;
};

const readZipEntryText = (
  zipBuffer: Buffer,
  entry: ZipEntry
): string | null =>
  readZipEntryBuffer(
    zipBuffer,
    entry,
    MAX_EXTRACTED_MANIFEST_BYTES
  )?.toString("utf8") ?? null;

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
      status: "valid";
      id: string | null;
      specVersion: string;
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
      if (metadata.type !== "player") {
        continue;
      }
      const specVersion =
        typeof metadata.specVersion === "string"
          ? metadata.specVersion.trim()
          : "";
      if (!/^\d+(?:\.\d+){0,2}(?:[-+][0-9A-Za-z.-]+)?$/.test(specVersion)) {
        return {
          status: "invalid",
          reason: "player metadata must declare a numeric specVersion"
        };
      }
      const id = typeof metadata.id === "string" ? metadata.id.trim() : "";
      return {
        status: "valid",
        id: id || null,
        specVersion
      };
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

const findZipUnitPlayerEntry = (
  manifestExtraction: Extract<ZipManifestExtractionResult, { status: "found" }>,
  unitEntry: ZipEntry,
  playerKey: string,
  manifestResources: Map<string, XmlManifestResource>
): ZipEntry | null => {
  const playerResource = findXmlManifestResource(manifestResources, playerKey);
  return findZipEntryByPath(manifestExtraction.entries, [
    ...(playerResource
      ? resolveZipResourcePathCandidates(
          manifestExtraction.manifestFileName,
          playerResource.key
        )
      : []),
    ...resolveZipResourcePathCandidates(unitEntry.fileName, playerKey),
    ...resolveZipResourcePathCandidates(unitEntry.fileName, `${playerKey}.html`)
  ]);
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

const extractXmlManifestFromZipSourceDocument = (
  sourceDocument: string
): ZipManifestExtractionResult => {
  const zipBuffer = decodeBase64ZipSourceDocument(sourceDocument);
  if (!zipBuffer) {
    return { status: "invalid_zip" };
  }

  const entries = readZipEntries(zipBuffer).filter(
    entry => !entry.fileName.endsWith("/")
  );
  const candidates = [
    ...entries.filter(entry =>
      entry.fileName.toLowerCase().endsWith("/imsmanifest.xml") ||
      entry.fileName.toLowerCase() === "imsmanifest.xml"
    ),
    ...entries.filter(entry =>
      entry.fileName.toLowerCase().endsWith("/manifest.xml") ||
      entry.fileName.toLowerCase() === "manifest.xml"
    ),
    ...entries.filter(entry => entry.fileName.toLowerCase().endsWith(".xml"))
  ];

  let foundUnreadableCandidate = false;
  for (const entry of candidates) {
    const text = readZipEntryText(zipBuffer, entry);
    if (!text) {
      foundUnreadableCandidate = true;
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
  const referencedBookletEntries = [...manifestResources.values()].flatMap(resource => {
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

    return (
      normalizeParsedXmlContentStructure(sourceDocument)?.bookletEntries ?? []
    );
  });
  // These entries already are normalized runtime booklets. Normalizing them as
  // source entries again would discard compiled policies from referenced XML.
  const referencedRuntimeSnapshot: ContentReleaseRuntimeSnapshot | null =
    referencedBookletEntries.length > 0
      ? { bookletEntries: referencedBookletEntries }
      : null;

  if (referencedRuntimeSnapshot) {
    runtimeSnapshot = referencedRuntimeSnapshot;
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

        const unitDefinition = extractZipUnitDefinition(sourceDocument);
        const codingSchemeReference =
          extractZipUnitCodingSchemeReference(sourceDocument);
        const codingSchemeEntry = codingSchemeReference?.reference
          ? findZipUnitCodingSchemeEntry(
              manifestExtraction,
              referencedEntry,
              codingSchemeReference.reference,
              manifestResources
            )
          : null;
        const codingSchemeDocument = codingSchemeEntry
          ? readZipEntryText(manifestExtraction.zipBuffer, codingSchemeEntry)
          : null;
        const codingSchemeResult = codingSchemeDocument
          ? parseUnitCodingSchemeDocument(codingSchemeDocument)
          : null;
        const definitionReference = unitDefinition.reference;
        const definitionEntry = definitionReference
          ? findZipEntryByPath(
              manifestExtraction.entries,
              resolveZipResourcePathCandidates(
                referencedEntry.fileName,
                definitionReference
              )
            )
          : null;
        const definitionDocument = definitionEntry
          ? readZipEntryText(manifestExtraction.zipBuffer, definitionEntry)
          : null;
        const runtimeUnitDefinition = normalizeRuntimeDocument(
          definitionDocument ?? unitDefinition.unitDefinition
        );
        const definitionContent = definitionDocument
          ? normalizeUnitContent(decodeXmlTextContent(definitionDocument))
          : null;
        const content =
          unitEntry.content ??
          definitionContent ??
          extractZipUnitContent(sourceDocument);

        const description = unitEntry.description
          ? null
          : extractZipUnitDescription(sourceDocument);
        const playerEntry = unitDefinition.playerKey
          ? findZipUnitPlayerEntry(
              manifestExtraction,
              referencedEntry,
              unitDefinition.playerKey,
              manifestResources
            )
          : null;
        const playerHtml = playerEntry
          ? readZipEntryText(manifestExtraction.zipBuffer, playerEntry)
          : null;
        if (unitDefinition.playerKey && playerHtml) {
          playerEntriesByKey.set(unitDefinition.playerKey, {
            playerKey: unitDefinition.playerKey,
            html: playerHtml
          });
        }

        return {
          ...unitEntry,
          ...(description ? { description } : {}),
          ...(content ? { content } : {}),
          ...(unitDefinition.playerKey
            ? { playerKey: unitDefinition.playerKey }
            : {}),
          ...(runtimeUnitDefinition ? { unitDefinition: runtimeUnitDefinition } : {}),
          ...(unitDefinition.unitDefinitionType
            ? { unitDefinitionType: unitDefinition.unitDefinitionType }
            : {}),
          ...(codingSchemeResult?.status === "valid"
            ? { codingScheme: codingSchemeResult.codingScheme }
            : {})
        };
      })
    })),
    ...(playerEntriesByKey.size > 0
      ? { playerEntries: [...playerEntriesByKey.values()] }
      : {})
  };
};

const validateZipXmlEntries = (
  manifestExtraction: Extract<ZipManifestExtractionResult, { status: "found" }>
): ImportJobDiagnostic[] => {
  const diagnostics: ImportJobDiagnostic[] = [];
  const validatedPlayerKeys = new Set<string>();
  const manifestResources = collectXmlManifestResources(
    manifestExtraction.manifestText
  );
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
          `Source package ZIP entry '${entry.fileName}' could not be read as bounded XML.`
        )
      );
      continue;
    }
    diagnostics.push(
      ...validateTestcenterXmlSourceDocument(sourceDocument, entry.fileName)
    );
    const unitDefinition = extractZipUnitDefinition(sourceDocument);
    if (
      unitDefinition.playerKey &&
      !validatedPlayerKeys.has(unitDefinition.playerKey.toLowerCase())
    ) {
      validatedPlayerKeys.add(unitDefinition.playerKey.toLowerCase());
      const playerEntry = findZipUnitPlayerEntry(
        manifestExtraction,
        entry,
        unitDefinition.playerKey,
        manifestResources
      );
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
          } else if (metadata.status === "valid" && metadata.id) {
            const referencedPlayerId =
              unitDefinition.playerKey.split("@")[0]?.trim() ?? "";
            if (
              referencedPlayerId &&
              referencedPlayerId.toLowerCase() !== metadata.id.toLowerCase()
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
      diagnostics.push(
        createImportDiagnostic(
          "source_document_coding_scheme_reference_invalid",
          `Unit ZIP entry '${entry.fileName}' contains a CodingSchemeRef without a resource path.`
        )
      );
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
    const nestedEntries = readZipEntries(packageBuffer).filter(
      entry => !entry.fileName.endsWith("/")
    );
    for (const nestedEntry of nestedEntries) {
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

  return {
    bookletKey: bookletEntry.bookletKey,
    displayLabel: bookletEntry.displayLabel,
    policy: bookletEntry.policy ?? compileBookletRuntimePolicy({}),
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
  const variablesByUnitKey = new Map<
    string,
    Map<string, AdaptiveResponseVariable>
  >();
  for (const [unitKey, response] of Object.entries(testRun.unitResponses)) {
    const parsedResponse = parseVeronaUnitResponse(response);
    if (
      !parsedResponse?.unitState.unitStateDataType?.match(
        /^iqb-standard@\d+(?:\.\d+)*$/i
      )
    ) {
      continue;
    }
    const variables = new Map<string, AdaptiveResponseVariable>();
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
          variables.set(value.id, {
            id: value.id,
            status: value.status,
            value: value.value,
            ...(typeof value.code === "number" ? { code: value.code } : {}),
            ...(typeof value.score === "number" ? { score: value.score } : {})
          });
        }
      } catch {
        // Invalid data parts remain persisted for player restoration, but cannot
        // participate in server-side adaptive decisions.
      }
    }
    variablesByUnitKey.set(unitKey, variables);
  }

  const trackedVariablesByUnitKey = collectAdaptiveVariableKeys(booklet);
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
      const baseResponses = baseVariableKeys.map(variableKey => {
        const variable = variables.get(variableKey);
        return variable
          ? ({
              id: variable.id,
              status: variable.status as IqbResponse["status"],
              value: variable.value as IqbResponse["value"],
              ...(variable.code === undefined ? {} : { code: variable.code }),
              ...(variable.score === undefined ? {} : { score: variable.score })
            } satisfies IqbResponse)
          : ({
              id: variableKey,
              status: "UNSET",
              value: null
            } satisfies IqbResponse);
      });
      for (const codedVariable of codingScheme.code(baseResponses)) {
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
    return {
      stateKey: state.stateKey,
      displayLabel: state.displayLabel,
      optionKey: presetOptionKey || selected.optionKey,
      optionLabel: presetOption?.displayLabel ?? presetOptionKey ?? selected.displayLabel
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

const resolveTimedTestletForUnit = (
  booklet: ContentReleaseBookletEntry | undefined,
  unitKey: string | null
): SourcePackageTestletEntry | null => {
  if (!booklet || !unitKey) {
    return null;
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
    booklet.unitEntries
      .find(unit => unit.unitKey === testRun.currentUnitKey)
      ?.testletPath?.includes(testletKey)
  );
  if (activeExpiredTestletKey) {
    const lastTimedUnitIndex = booklet.unitEntries.reduce(
      (lastIndex, unit, index) =>
        unit.testletPath?.includes(activeExpiredTestletKey) ? index : lastIndex,
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
  return (targetUnit?.testletPath ?? []).includes(timedTestlet.testletKey)
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
  timestamp: string;
}): TestRun => {
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
    delete testletTimers[targetTimedTestlet.testletKey];
    nextRun = normalizeTestRun({
      ...nextRun,
      testletTimers,
      updatedAt: input.timestamp
    });
  }

  const targetTestletKeys = targetUnit.testletPath ?? [];
  return normalizeTestRun({
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
  });
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
    currentUnit?.testletPath?.includes(timedTestlet.testletKey)
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
    showTimeLeft: timingPolicy.showTimeLeft,
    warningMinutes: timingPolicy.warningMinutes
  };
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
    return fallback;
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
  const backwardDeniedReasons = testRun.monitorNavigationUnlocked
    ? []
    : bookletNavigationDeniedReasons({
        policy: completenessPolicy,
        direction: "backward",
        presentationProgress,
        responseProgress
      });
  const forwardDeniedReasons = testRun.monitorNavigationUnlocked
    ? []
    : bookletNavigationDeniedReasons({
        policy: completenessPolicy,
        direction: "forward",
        presentationProgress,
        responseProgress
      });
  const isUnitInaccessible = (unitKey: string | null): boolean =>
    isUnitLeaveLocked(booklet, testRun, unitKey) ||
    Boolean(findClosedTimedTestlet(booklet, testRun, unitKey));
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
  const nextTestletGate = findTestletCodeGate({
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
    isLeavingForbiddenTimedTestlet(booklet, testRun, nextUnitKey) &&
    !forwardDeniedReasons.includes("testlet_time_leave_forbidden")
  ) {
    forwardDeniedReasons.push("testlet_time_leave_forbidden");
  }
  if (
    isLeavingForbiddenTimedTestlet(booklet, testRun, previousUnitKey) &&
    !backwardDeniedReasons.includes("testlet_time_leave_forbidden")
  ) {
    backwardDeniedReasons.push("testlet_time_leave_forbidden");
  }
  const remainingTestletGate = findTestletCodeGate({
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
    !isLeavingForbiddenTimedTestlet(booklet, testRun, null);
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

const resolveRuntimeBookletUnits = (
  contentRelease: ContentRelease,
  bookletKey: string,
  testRun: TestRun
): Array<{
  unitKey: string;
  displayLabel: string;
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
): void => {
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

  if (!bookletEntry.unitEntries.some(candidate => candidate.unitKey === unitKey)) {
    throw new FirstSliceError(
      404,
      "unit_not_found",
      `Unit '${unitKey}' was not found in booklet '${bookletKey}'.`
    );
  }
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

  const recordWorkspaceActivity = async (input: {
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
      activityEventId: idGenerator(),
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

  const persistEffectiveTestletTimerState = async (input: {
    contentRelease: ContentRelease;
    testRun: TestRun;
    timestamp: string;
  }): Promise<TestRun> => {
    const normalizedRun = normalizeTestRun(input.testRun);
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
  }): Promise<CreateImportJobResult> => {
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
    const importResolution = buildRuntimeSnapshot(sourcePackage);

    if (!importResolution.runtimeSnapshot) {
      const failedImportJob: ImportJob = {
        ...importJob,
        status: "failed",
        finishedAt: timestamp,
        diagnostics: importResolution.diagnostics
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
    }

    const completedImportJob: ImportJob = {
      ...importJob,
      status: "completed",
      finishedAt: timestamp,
      diagnostics: importResolution.diagnostics
    };
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
        diagnostics: completedImportJob.diagnostics
      }
    });

    return { importJob: completedImportJob, stagedContentRelease };
  };

  return {
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
          status: "active",
          createdAt: timestamp
        };
        const platformAdminRoleAssignment: AdminRoleAssignment = {
          roleAssignmentId: idGenerator(),
          adminUserId: adminUser.adminUserId,
          role: "platform_admin",
          tenantId: null,
          workspaceId: null,
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
          await recordAdminAuditEvent({
            eventType: "admin_sign_in_failed",
            subjectAdminUserId: adminUser?.adminUserId ?? null,
            summary: `Admin sign-in failed for '${username}'.`,
            details: {
              username,
              reason: signInFailureReason,
              adminUserStatus: adminUser?.status ?? null
            }
          });
          throw new FirstSliceError(
            401,
            "admin_credentials_invalid",
            "Admin credentials are invalid."
          );
        }

        const timestamp = now();
        const adminSession: AdminSession = {
          adminSessionId: idGenerator(),
          adminUserId: adminUser.adminUserId,
          token: createAdminSessionToken(),
          createdAt: timestamp,
          expiresAt: calculateAdminSessionExpiry(timestamp, adminSessionTtlMs),
          revokedAt: null
        };

        await repository.saveAdminSession(adminSession);
        const roleAssignments = await listAdminRoleAssignmentsForUser(
          repository,
          adminUser.adminUserId
        );
        await recordAdminAuditEvent({
          eventType: "admin_sign_in_succeeded",
          actorAdminUserId: adminUser.adminUserId,
          subjectAdminUserId: adminUser.adminUserId,
          summary: `Admin '${adminUser.username}' signed in.`,
          details: {
            username: adminUser.username,
            adminSessionId: adminSession.adminSessionId
          }
        });
        return {
          adminUser,
          adminSession,
          roleAssignments
        };
      },
      async getCurrentSession(input) {
        return requireActiveAdminSession(repository, input.sessionToken, now());
      },
      async listAdminSessions(input) {
        const currentSession = await requireActiveAdminSession(
          repository,
          input.sessionToken,
          now()
        );
        requireAdminRole(currentSession.roleAssignments, ["platform_admin"]);

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
        requireAdminRole(currentSession.roleAssignments, ["platform_admin"]);

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
      async signOut(input) {
        const { adminUser, adminSession } = await requireActiveAdminSession(
          repository,
          input.sessionToken,
          now()
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
      }
    },
    adminDirectory: {
      async listAdminUsers(input) {
        const currentSession = await requireActiveAdminSession(
          repository,
          input.sessionToken,
          now()
        );
        requireAdminRole(currentSession.roleAssignments, ["platform_admin"]);
        const usernameFilter = input.username?.trim().toLowerCase() || undefined;
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
          .filter(
            item =>
              (!usernameFilter || item.adminUser.username.includes(usernameFilter)) &&
              (!input.status || item.adminUser.status === input.status) &&
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
          )
          .slice(0, limit);
      },
      async createAdminUser(input) {
        const currentSession = await requireActiveAdminSession(
          repository,
          input.sessionToken,
          now()
        );
        requireAdminRole(currentSession.roleAssignments, ["platform_admin"]);

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
        const adminUser: AdminUser = {
          adminUserId: idGenerator(),
          username,
          displayName: normalizeAdminDisplayName(input.displayName, username),
          passwordHash: hashAdminPassword(password),
          status: "active",
          createdAt: timestamp
        };
        const requestedRoleAssignments = normalizeAdminRoleAssignmentInputs(
          input.roleAssignments
        );

        await repository.saveAdminUser(adminUser);

        const savedRoleAssignments: AdminRoleAssignment[] = [];
        for (const requestedRoleAssignment of requestedRoleAssignments) {
          const scope = await resolveAdminRoleScope(repository, requestedRoleAssignment);
          if (
            savedRoleAssignments.some(roleAssignment =>
              isSameAdminRoleScope(roleAssignment, scope)
            )
          ) {
            continue;
          }

          const roleAssignment: AdminRoleAssignment = {
            roleAssignmentId: idGenerator(),
            adminUserId: adminUser.adminUserId,
            role: scope.role,
            tenantId: scope.tenantId,
            workspaceId: scope.workspaceId,
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
        requireAdminRole(currentSession.roleAssignments, ["platform_admin"]);

        const adminUser = await requireAdminUser(repository, input.adminUserId);
        const nextStatus =
          input.status === undefined
            ? adminUser.status
            : normalizeAdminUserStatus(input.status);
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
          status: nextStatus
        };
        await repository.saveAdminUser(updatedAdminUser);

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
            nextStatus: updatedAdminUser.status
          }
        });

        return directoryItem;
      },
      async resetAdminUserPassword(input) {
        const currentSession = await requireActiveAdminSession(
          repository,
          input.sessionToken,
          now()
        );
        requireAdminRole(currentSession.roleAssignments, ["platform_admin"]);

        const adminUser = await requireAdminUser(repository, input.adminUserId);
        const password = requireAdminPassword(input.password);
        const updatedAdminUser: AdminUser = {
          ...adminUser,
          passwordHash: hashAdminPassword(password)
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
            username: updatedAdminUser.username
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
        requireAdminRole(currentSession.roleAssignments, ["platform_admin"]);

        const adminUser = await requireAdminUser(repository, input.adminUserId);
        const scope = await resolveAdminRoleScope(repository, input);
        const existingRoleAssignments = await listAdminRoleAssignmentsForUser(
          repository,
          adminUser.adminUserId
        );
        if (
          existingRoleAssignments.some(roleAssignment =>
            isSameAdminRoleScope(roleAssignment, scope)
          )
        ) {
          return { adminUser, roleAssignments: existingRoleAssignments };
        }

        const roleAssignment: AdminRoleAssignment = {
          roleAssignmentId: idGenerator(),
          adminUserId: adminUser.adminUserId,
          role: scope.role,
          tenantId: scope.tenantId,
          workspaceId: scope.workspaceId,
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
        requireAdminRole(currentSession.roleAssignments, ["platform_admin"]);

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

        await repository.deleteAdminRoleAssignment(roleAssignment.roleAssignmentId);

        const directoryItem = await createAdminUserDirectoryItem(repository, adminUser);
        await recordAdminAuditEvent({
          eventType: "admin_role_revoked",
          actorAdminUserId: currentSession.adminUser.adminUserId,
          subjectAdminUserId: adminUser.adminUserId,
          summary: `Admin '${currentSession.adminUser.username}' revoked '${roleAssignment.role}' from '${adminUser.username}'.`,
          details: {
            username: adminUser.username,
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
        requireAdminRole(currentSession.roleAssignments, ["platform_admin"]);
        const limit = Math.max(1, Math.min(input.limit ?? 100, 500));

        return (await repository.listAdminAuditEvents())
          .filter(
            auditEvent =>
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
          displayName: input.displayName,
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
            contentRelease && storedTestRun.status !== "completed"
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

        return buildStudyMonitorSummary({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          generatedAt: now(),
          participantSessions,
          participantRosterEntries,
          testRuns,
          contentReleases,
          reviews
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

        const matrix = buildStudyMonitorParticipantMatrix({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          generatedAt: now(),
          participantSessions,
          participantRosterEntries,
          testRuns,
          contentReleases,
          reviews
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
        const detail = buildStudyMonitorParticipantDetail({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          loginKey,
          generatedAt: now(),
          participantSessions,
          participantRosterEntries,
          testRuns,
          contentReleases,
          reviews
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
        const detail = buildStudyMonitorGroupDetail({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          groupKey,
          generatedAt: now(),
          participantSessions,
          participantRosterEntries,
          testRuns,
          contentReleases,
          reviews
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
        const detail = buildStudyMonitorBookletDetail({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          bookletKey,
          generatedAt: now(),
          participantSessions,
          participantRosterEntries,
          testRuns,
          contentReleases,
          reviews
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
        const detail = buildStudyMonitorUnitDetail({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          unitKey,
          generatedAt: now(),
          participantSessions,
          participantRosterEntries,
          testRuns,
          contentReleases,
          reviews
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
        const detail = buildStudyMonitorRunDetail({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          testRunId,
          generatedAt: now(),
          participantSessions,
          participantRosterEntries,
          testRuns,
          contentReleases,
          reviews
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
      async exportLogCsv(input) {
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

        const importJobs = (
          await repository.listImportJobsByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          )
        )
          .filter(importJob => importJob.sourcePackageId === sourcePackage.sourcePackageId)
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt));
        const importJobIds = new Set(importJobs.map(importJob => importJob.importJobId));
        const contentReleases = (
          await repository.listContentReleasesByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          )
        )
          .filter(contentRelease => importJobIds.has(contentRelease.importJobId))
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt));

        return {
          sourcePackage,
          importJobs,
          contentReleases
        };
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
        const importJobs = await repository.listImportJobsByWorkspace(
          workspace.tenantId,
          workspace.workspaceId
        );

        const limit = Math.max(1, Math.min(input.limit ?? 100, 500));

        return sourcePackages
          .map<WorkspaceSourcePackageListItem>(sourcePackage => {
            const latestImportJob =
              importJobs
                .filter(
                  importJob => importJob.sourcePackageId === sourcePackage.sourcePackageId
                )
                .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0] ??
              null;

            return {
              sourcePackage,
              latestImportJob
            };
          })
          .filter(
            item =>
              (!input.status || item.sourcePackage.status === input.status) &&
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
        const contentRelease =
          (
            await repository.listContentReleasesByWorkspace(
              workspace.tenantId,
              workspace.workspaceId
            )
          ).find(candidate => candidate.importJobId === importJob.importJobId) ?? null;

        return {
          importJob,
          sourcePackage,
          contentRelease
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
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        if (
          typeof input.rosterText === "string" &&
          input.rosterText.trimStart().startsWith("<")
        ) {
          const xmlDiagnostics = validateTestcenterXmlSourceDocument(
            input.rosterText,
            "participant-roster.xml"
          );
          if (xmlDiagnostics.some(diagnostic => diagnostic.severity === "error")) {
            throw new FirstSliceError(
              400,
              "participant_roster_xml_invalid",
              "Participant roster XML failed Original Testcenter compatibility validation.",
              { diagnostics: xmlDiagnostics }
            );
          }
        }
        const parsedEntries = parseParticipantRosterText(input.rosterText);
        if (parsedEntries.length === 0) {
          throw new FirstSliceError(
            400,
            "participant_roster_empty",
            "Participant roster did not contain any participant login entries."
          );
        }
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

        for (const parsedEntry of parsedEntries) {
          const existingEntry = entriesByLoginKey.get(parsedEntry.loginKey);
          const participantRosterEntry: ParticipantRosterEntry = {
            participantRosterEntryId:
              existingEntry?.participantRosterEntryId ?? idGenerator(),
            tenantId: workspace.tenantId,
            workspaceId: workspace.workspaceId,
            loginKey: parsedEntry.loginKey,
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

        if (parsedEntries.length > 0) {
          await recordWorkspaceActivity({
            tenantId: workspace.tenantId,
            workspaceId: workspace.workspaceId,
            eventType: "participant_roster_imported",
            subjectType: "workspace",
            subjectId: workspace.workspaceId,
            summary: `Imported ${importedCount} and updated ${updatedCount} participant roster entries.`,
            details: {
              importedCount,
              updatedCount,
              parsedCount: parsedEntries.length
            }
          });
        }

        return {
          importedCount,
          updatedCount,
          items: buildParticipantRosterReadItems(
            Array.from(entriesByLoginKey.values()),
            await getActiveWorkspaceRelease(
              repository,
              workspace.tenantId,
              workspace.workspaceId
            )
          )
        };
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
        return buildParticipantRosterReadItems(
          entries,
          await getActiveWorkspaceRelease(
            repository,
            workspace.tenantId,
            workspace.workspaceId
          )
        );
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
          bookletKey: input.bookletKey,
          participantSessionId: input.participantSessionId,
          testRunId: input.testRunId,
          unitKey: input.unitKey,
          status: input.status,
          limit: input.limit
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
          bookletKey: input.bookletKey,
          participantSessionId: input.participantSessionId,
          testRunId: input.testRunId,
          unitKey: input.unitKey,
          status: input.status,
          limit: input.limit
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
                activeContentReleaseId: activeRelease.contentReleaseId
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
      }
    },
    workspaceResults: {
      async deleteGroupResults(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const groupKey = normalizeGroupKey(input.groupKey);
        const [participantSessions, testRuns] = await Promise.all([
          repository.listParticipantSessionsByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          ),
          repository.listTestRunsByWorkspace(workspace.tenantId, workspace.workspaceId)
        ]);
        const affectedParticipantSessionIds = participantSessions
          .filter(participantSession => participantSession.groupKey === groupKey)
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
        const deletedReviewCount =
          await repository.deleteWorkspaceReviewsByTestRunIds(deletedTestRunIds);
        const deletedTestRunCount = await repository.deleteTestRunsByIds(
          deletedTestRunIds
        );

        await recordWorkspaceActivity({
          tenantId: workspace.tenantId,
          workspaceId: workspace.workspaceId,
          eventType: "group_results_deleted",
          subjectType: "workspace",
          subjectId: workspace.workspaceId,
          summary: `Deleted ${deletedTestRunCount} test run(s) for group '${groupKey}'.`,
          details: {
            groupKey,
            deletedTestRunCount,
            deletedResponseCount,
            deletedReviewCount,
            affectedParticipantSessionIds,
            deletedTestRunIds
          }
        });

        return {
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          groupKey,
          deletedTestRunCount,
          deletedResponseCount,
          deletedReviewCount,
          affectedParticipantSessionIds,
          deletedTestRunIds
        };
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
        if (normalizedUnitKey) {
          const contentRelease = await requireContentRelease(
            repository,
            testRun.contentReleaseId
          );
          requireRuntimeUnitForBooklet(
            contentRelease,
            testRun.bookletKey,
            normalizedUnitKey
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
          reviewerId: normalizeReviewText(
            input.reviewerId,
            "reviewerId",
            "review_reviewer_required"
          ),
          category: normalizeReviewText(
            input.category,
            "category",
            "review_category_required"
          ),
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
            category: review.category
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
        const existingReview = await repository.getWorkspaceReviewById(
          input.reviewId
        );

        if (
          !existingReview ||
          existingReview.tenantId !== workspace.tenantId ||
          existingReview.workspaceId !== workspace.workspaceId
        ) {
          throw new FirstSliceError(
            404,
            "review_not_found",
            `Review '${input.reviewId}' was not found in workspace '${input.workspaceKey}'.`
          );
        }

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

        const review: WorkspaceReview = {
          ...existingReview,
          unitKey: nextUnitKey,
          reviewerId:
            input.reviewerId === undefined
              ? existingReview.reviewerId
              : normalizeReviewText(
                  input.reviewerId,
                  "reviewerId",
                  "review_reviewer_required"
                ),
          category:
            input.category === undefined
              ? existingReview.category
              : normalizeReviewText(
                  input.category,
                  "category",
                  "review_category_required"
                ),
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
            category: review.category
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
            category: review.category
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
          bookletKey: input.bookletKey,
          participantSessionId: input.participantSessionId,
          testRunId: input.testRunId,
          unitKey: input.unitKey,
          reviewerId: input.reviewerId,
          category: input.category,
          limit: input.limit
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
          stagedContentRelease: result.stagedContentRelease
        };
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
                activeContentReleaseId: activeRelease.contentReleaseId
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
        if (rosterEntry?.passwordRequired) {
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
            throw new FirstSliceError(
              401,
              "participant_password_invalid",
              `Password for participant '${loginKey}' is required or invalid.`
            );
          }
        }
        const requestedGroupKey = String(input.groupKey ?? "").trim();
        const groupKey =
          rosterEntry?.groupKey || requestedGroupKey || `group:${loginKey}`;

        const reusableSession = (
          await repository.listParticipantSessionsByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          )
        )
          .filter(
            participantSession =>
              participantSession.loginKey === loginKey &&
              participantSession.groupKey === groupKey &&
              participantSession.contentReleaseId ===
                activeRelease.contentReleaseId &&
              participantSession.status !== "closed"
          )
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))[0];

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
          status: "signed_in",
          createdAt: now()
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
            rosterDefaultUsed: !requestedGroupKey && Boolean(rosterEntry)
          }
        });
        return participantSession;
      },
      async getRuntimeState(input) {
        const participantSessionId = normalizeParticipantSessionId(
          input.participantSessionId
        );
        const participantSession = await requireParticipantSession(
          repository,
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
          testRuns
        });
        const hasAvailableBooklet = booklets.some(
          booklet => booklet.status === "available"
        );

        if (!latestTestRun) {
          return {
            participantSession,
            participantRosterEntry,
            scope,
            latestTestRun: null,
            booklets,
            runtimeStatus: "ready_to_launch",
            availableAction: "launch"
          };
        }

        if (latestTestRun.status === "completed") {
          return {
            participantSession,
            participantRosterEntry,
            scope,
            latestTestRun: normalizeTestRun(latestTestRun),
            booklets,
            runtimeStatus: hasAvailableBooklet ? "ready_to_launch" : "completed",
            availableAction: hasAvailableBooklet ? "launch" : "none"
          };
        }

        return {
          participantSession,
          participantRosterEntry,
          scope,
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
        const participantSession = await requireParticipantSession(
          repository,
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
        const navigation = resolveBookletNavigationState(
          contentRelease,
          currentTestRun
        );
        const availableActions: ParticipantCurrentRunState["availableActions"] = [];
        if (currentTestRun.status === "paused") {
          availableActions.push("resume", "save_progress");
        } else if (currentTestRun.status === "running") {
          availableActions.push("save_progress");
        }
        if (navigation.canComplete) {
          availableActions.push("complete");
        }

        return {
          participantSession,
          participantRosterEntry,
          scope,
          testRun: currentTestRun,
          booklet: resolveRuntimeBooklet(contentRelease, currentTestRun.bookletKey),
          currentUnit: resolveRuntimeUnit(
            contentRelease,
            currentTestRun.bookletKey,
            currentTestRun.currentUnitKey
          ),
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
            testRuns
          }),
          navigation,
          availableActions
        };
      },
      async getResource(input) {
        const participantSessionId = normalizeParticipantSessionId(
          input.participantSessionId
        );
        const participantSession = await requireParticipantSession(
          repository,
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
        const participantSession = await requireParticipantSession(
          repository,
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

          return normalizeTestRun(existingRun);
        }

        const rosterEntry = await findParticipantRosterEntryByLoginKey(
          repository,
          participantSession.tenantId,
          participantSession.workspaceId,
          participantSession.loginKey
        );
        const assignedBookletKeys = getParticipantRosterBookletKeys(rosterEntry);
        const testRuns = (
          await repository.listTestRunsByParticipantSessionId(
            participantSession.participantSessionId
          )
        ).map(normalizeTestRun);
        const runtimeBooklets = buildParticipantRuntimeBooklets({
          contentRelease,
          participantRosterEntry: rosterEntry,
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
        const initialTestRun = withEvaluatedBookletStates(selectedBooklet, {
          testRunId: idGenerator(),
          participantSessionId: participantSession.participantSessionId,
          tenantId: participantSession.tenantId,
          workspaceId: participantSession.workspaceId,
          contentReleaseId: participantSession.contentReleaseId,
          bookletKey: selectedBooklet.bookletKey,
          bookletAssignmentKey:
            selectedRuntimeBooklet?.bookletKey ?? selectedBooklet.bookletKey,
          presetBookletStates: selectedRuntimeBooklet?.statePreset ?? {},
          status: "running",
          currentUnitKey: null,
          unitResponses: {},
          unlockedTestletKeys: [],
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
        const firstUnitRequiresCode = (firstUnit?.testletPath ?? []).some(
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
        const participantSession = await requireParticipantSession(
          repository,
          participantSessionId
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
              normalizeTestRun(existingRun),
              "running",
              timestamp
            );
            await repository.saveTestRun(resumedRun);
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

          return normalizeTestRun(existingRun);
        }

        return this.launch({
          participantSessionId: participantSession.participantSessionId,
          bookletKey: requestedBookletKey
        });
      },
      async saveProgress(input) {
        const testRunId = normalizeTestRunId(input.testRunId);
        const storedTestRun = await repository.getTestRunById(testRunId);

        if (!storedTestRun) {
          throw new FirstSliceError(
            404,
            "test_run_not_found",
            `Test run '${testRunId}' was not found.`
          );
        }

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
          const leavingTimedTestlet = resolveLeavingTimedTestlet(
            booklet,
            testRun,
            nextCurrentUnitKey
          );
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
          activatedLeaveLock = resolveCurrentLeaveLock(
            booklet,
            testRun,
            nextCurrentUnitKey
          );
          if (activatedLeaveLock) {
            navigationTestRun = activateCurrentLeaveLock(
              navigationTestRun,
              activatedLeaveLock
            );
          }
        }

        const nextUnitResponses = { ...navigationTestRun.unitResponses };
        const responseUnitKey = hasCurrentUnitKeyInput
          ? nextCurrentUnitKey
          : navigationTestRun.currentUnitKey;
        if (responseUnitKey && nextUnitResponse != null) {
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
        await repository.saveTestRun(updatedRun);
        const effectiveRun = await persistEffectiveTestletTimerState({
          contentRelease,
          testRun: updatedRun,
          timestamp
        });
        await recordWorkspaceActivity({
          tenantId: effectiveRun.tenantId,
          workspaceId: effectiveRun.workspaceId,
          eventType: "test_run_progress_saved",
          subjectType: "test_run",
          subjectId: effectiveRun.testRunId,
          summary: `Progress saved for run '${effectiveRun.testRunId}'.`,
          details: {
            status: effectiveRun.status,
            currentUnitKey: effectiveRun.currentUnitKey,
            bookletStates: effectiveRun.bookletStates
          }
        });
        if (activatedLeaveLock) {
          await recordWorkspaceActivity({
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
        const expectedCodeBuffer = Buffer.from(expectedCode, "utf8");
        const providedCodeBuffer = Buffer.from(input.code.trim(), "utf8");
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
        if (testRun.status === "completed") {
          return testRun;
        }
        const booklet = contentRelease.runtimeSnapshot.bookletEntries.find(
          candidate => candidate.bookletKey === testRun.bookletKey
        );
        const leavingTimedTestlet = resolveLeavingTimedTestlet(
          booklet,
          testRun,
          null
        );
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
        const leavingLock = resolveCurrentLeaveLock(booklet, testRun, null);
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

        const completedRun: TestRun = {
          ...closeRunningTestletTimers(completionBaseRun, timestamp),
          status: "completed",
          currentUnitKey: null,
          updatedAt: timestamp,
          completedAt: timestamp
        };
        await repository.saveTestRun(completedRun);

        const participantSession = await repository.getParticipantSessionById(
          testRun.participantSessionId
        );
        if (participantSession) {
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
          eventType: "test_run_completed",
          subjectType: "test_run",
          subjectId: completedRun.testRunId,
          summary: `Run '${completedRun.testRunId}' completed.`,
          details: {
            completedAt: completedRun.completedAt
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

        const items = testRuns
          .filter(testRun => testRun.status !== "completed")
          .sort((left, right) => left.updatedAt.localeCompare(right.updatedAt))
          .map<OpenMonitorRun>(testRun => {
            const participantSession =
              participantSessions.find(
                candidate =>
                  candidate.participantSessionId === testRun.participantSessionId
              ) ?? null;

            return {
              testRunId: testRun.testRunId,
              participantSessionId: testRun.participantSessionId,
              loginKey: participantSession?.loginKey ?? "unknown-login",
              groupKey: participantSession?.groupKey ?? "unknown-group",
              participantRosterEntry: participantSession
                ? participantRosterEntries.find(
                    entry => entry.loginKey === participantSession.loginKey
                  ) ?? null
                : null,
              bookletKey: testRun.bookletKey,
              bookletAssignmentKey:
                testRun.bookletAssignmentKey ?? testRun.bookletKey,
              bookletStates: normalizeTestRun(testRun).bookletStates ?? {},
              status: testRun.status,
              currentUnitKey: testRun.currentUnitKey,
              updatedAt: testRun.updatedAt
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
          commandType === "set_testlet_time"
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
        const nextStatus: TestRunStatus =
          commandType === "pause"
            ? "paused"
            : commandType === "complete"
              ? "completed"
              : commandType === "unlock_navigation"
                ? testRun.status
                : commandType === "lock_navigation"
                  ? testRun.status
                : commandType === "set_testlet_time"
                  ? testRun.status
                : "running";
        let adjustedTestletKey: string | null = null;
        let previousTimer: NonNullable<TestRun["testletTimers"]>[string] | null =
          null;
        const nextTestRun: TestRun =
          commandType === "complete"
            ? {
                ...closeRunningTestletTimers(testRun, issuedAt),
                status: "completed",
                currentUnitKey: null,
                updatedAt: issuedAt,
                completedAt: issuedAt
              }
            : commandType === "goto" && targetUnitKey
              ? applyMonitorGoto({
                  contentRelease,
                  testRun,
                  targetUnitKey,
                  timestamp: issuedAt
                })
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
                    nextStatus as Extract<TestRunStatus, "running" | "paused">,
                    issuedAt
                  );
        if (nextTestRun !== testRun) {
          await repository.saveTestRun(nextTestRun);
        }
        const effectiveNextTestRun =
          commandType === "complete"
            ? nextTestRun
            : await persistEffectiveTestletTimerState({
                contentRelease,
                testRun: nextTestRun,
                timestamp: issuedAt
              });
        const nextParticipantSession =
          commandType === "complete"
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
          testRun: effectiveNextTestRun,
          participantSession: nextParticipantSession
        };
      }
    }
  };
};
