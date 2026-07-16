import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";
import { inflateRawSync } from "node:zlib";

import { parseParticipantRosterText } from "@testcenter-rewrite-app/contracts";
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
  ContentReleaseActivationReadiness,
  ContentRelease,
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
  ParticipantSession,
  ParticipantSessionScope,
  ParticipantSessionStatus,
  ParticipantRuntimeState,
  SourcePackage,
  SourcePackageStatus,
  SourcePackageContentStructure,
  Tenant,
  TestRun,
  TestRunStatus,
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
  createTenant(input: { tenantKey: string; displayName: string }): Promise<Tenant>;
  listWorkspaces(input: { tenantKey: string }): Promise<Workspace[]>;
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
  listContentReleases(input: {
    tenantKey: string;
    workspaceKey: string;
    status?: ContentReleaseStatus;
    importJobId?: string;
    sourcePackageId?: string;
    limit?: number;
  }): Promise<WorkspaceContentReleaseListItem[]>;
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
  }): Promise<ParticipantSession>;
  getRuntimeState(input: {
    participantSessionId: string;
  }): Promise<ParticipantRuntimeState>;
  getCurrentRunState(input: {
    participantSessionId: string;
  }): Promise<ParticipantCurrentRunState>;
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
  }): Promise<TestRun>;
  resumeRun(input: { testRunId: string }): Promise<TestRun>;
  completeRun(input: { testRunId: string }): Promise<TestRun>;
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
  createTenant: "CreateTenant",
  listWorkspaces: "ListWorkspaces",
  createWorkspace: "CreateWorkspace",
  getWorkspaceOverview: "GetWorkspaceOverview",
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
  exportOpenRunsCsv: "ExportOpenRunsCsv",
  exportParticipantRosterCsv: "ExportParticipantRosterCsv",
  getSourcePackageDetail: "GetSourcePackageDetail",
  listSourcePackages: "ListSourcePackages",
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
  listContentReleases: "ListContentReleases",
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
  saveParticipantRosterEntry(
    participantRosterEntry: ParticipantRosterEntry
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
const TEST_RUN_PROGRESS_STATUSES: TestRunStatus[] = ["running", "paused"];

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

const normalizeTestRunProgressStatus = (value: unknown): TestRunStatus => {
  if (
    typeof value !== "string" ||
    !TEST_RUN_PROGRESS_STATUSES.includes(value as TestRunStatus)
  ) {
    throw new FirstSliceError(
      400,
      "test_run_progress_status_invalid",
      "Test run progress status must be 'running' or 'paused'."
    );
  }

  return value as TestRunStatus;
};

const normalizeMonitorRunCommandType = (value: unknown): MonitorRunCommandType => {
  if (
    typeof value !== "string" ||
    !monitorRunCommandTypes.includes(value as MonitorRunCommandType)
  ) {
    throw new FirstSliceError(
      400,
      "monitor_run_command_type_invalid",
      "Monitor run command type must be 'pause', 'resume', or 'complete'."
    );
  }

  return value as MonitorRunCommandType;
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

const hashAdminPassword = (password: string): string => {
  const salt = randomBytes(16).toString("hex");
  const derivedKey = scryptSync(password, salt, PASSWORD_HASH_KEY_LENGTH);
  return `scrypt$${salt}$${derivedKey.toString("hex")}`;
};

const verifyAdminPassword = (password: string, passwordHash: string): boolean => {
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

      if (entry.bookletKey && !activeContentRelease) {
        validationWarnings.push({
          code: "active_content_release_missing",
          message:
            "Booklet assignment cannot be validated because the workspace has no active content release."
        });
      } else if (entry.bookletKey && !activeBookletKeys.has(entry.bookletKey)) {
        validationWarnings.push({
          code: "booklet_not_found_in_active_release",
          message: `Booklet '${entry.bookletKey}' is not part of the active content release.`
        });
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

const normalizeTestRun = (testRun: TestRun): TestRun => ({
  ...testRun,
  unitResponses: testRun.unitResponses ?? {}
});

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
    "importedAt",
    "validationWarningCodes",
    "validationWarningMessages"
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
        item.importedAt,
        item.validationWarnings.map(warning => warning.code).join("|"),
        item.validationWarnings.map(warning => warning.message).join("|")
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

const normalizeContentStructure = (
  contentStructure: SourcePackageContentStructure
): ContentReleaseRuntimeSnapshot | null => {
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

    const normalizedBooklet =
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
      normalizedBooklet.unitEntries.push({
        unitKey,
        displayLabel: normalizeManifestLabel(
          unitEntry.displayLabel,
          "Unit",
          unitKey
        ),
        ...(description ? { description } : {}),
        ...(content ? { content } : {})
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

  return { bookletEntries };
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
    const visit = (candidate: unknown): void => {
      if (Array.isArray(candidate)) {
        candidate.forEach(item => visit(item));
        return;
      }

      const objectValue = asObject(candidate);
      if (!objectValue) {
        return;
      }

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
        const key =
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
        visit(container);
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
                  unit.text ??
                  unit.stimulus ??
                  unit.markdown ??
                  unit.html
              );
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
                ...(description ? { description } : {}),
                ...(content ? { content } : {})
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
    candidatesByResourceKey.set(
      resource.key,
      [
        ...new Set(
          collectResourceCandidates(
            resource,
            new Set([resourceIdentifier])
          )
        )
      ]
    );
  }

  return candidatesByResourceKey;
};

const collectXmlBookletEntries = (
  sourceDocument: string,
  bookletTagNames: string
): SourcePackageContentStructure["bookletEntries"] => {
  const bookletEntries: SourcePackageContentStructure["bookletEntries"] = [];

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
            "text",
            "stimulus",
            "markdown",
            "html"
          )
      );
      unitEntries.push({
        unitKey: String(
          readXmlAttribute(
            unitAttributes,
            "unitKey",
            "unitId",
            "identifier",
            "key",
            "id",
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
            "name"
          ) ??
            readXmlChildText(
              unitContent,
              "unitKey",
              "unitId",
              "identifier",
              "key",
              "id",
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
              "name"
            ) ??
            ""
        ).trim(),
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
            ""
        ).trim(),
        ...(description ? { description } : {}),
        ...(content ? { content } : {})
      });
    }

    bookletEntries.push({
      bookletKey: String(
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
      ).trim(),
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
      unitEntries
    });
  }

  return bookletEntries;
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

const readZipEntryText = (
  zipBuffer: Buffer,
  entry: ZipEntry
): string | null => {
  if (
    entry.uncompressedSize > MAX_EXTRACTED_MANIFEST_BYTES ||
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
              maxOutputLength: MAX_EXTRACTED_MANIFEST_BYTES + 1
            })
          : null;
  } catch {
    return null;
  }

  if (!data || data.length > MAX_EXTRACTED_MANIFEST_BYTES) {
    return null;
  }

  return data.toString("utf8");
};

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

const extractZipUnitContent = (sourceDocument: string): string | null => {
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
      "html"
    ) ?? sourceDocument
  );
  return content || null;
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
  const runtimeSnapshot = normalizeParsedXmlContentStructure(
    manifestExtraction.manifestText
  );
  if (!runtimeSnapshot) {
    return null;
  }
  const contentPathCandidatesByResourceKey =
    collectXmlManifestResourceContentPathCandidates(
      manifestExtraction.manifestText
    );

  return {
    bookletEntries: runtimeSnapshot.bookletEntries.map(bookletEntry => ({
      ...bookletEntry,
      unitEntries: bookletEntry.unitEntries.map(unitEntry => {
        if (unitEntry.content) {
          return unitEntry;
        }

        const resourcePathCandidates =
          contentPathCandidatesByResourceKey.get(unitEntry.unitKey) ?? [
            unitEntry.unitKey
          ];
        const referencedEntry = findZipEntryByPath(
          manifestExtraction.entries,
          resourcePathCandidates.flatMap(resourcePath =>
            resolveZipResourcePathCandidates(
              manifestExtraction.manifestFileName,
              resourcePath
            )
          )
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

        const content = extractZipUnitContent(sourceDocument);
        if (!content) {
          return unitEntry;
        }

        const description = unitEntry.description
          ? null
          : extractZipUnitDescription(sourceDocument);

        return {
          ...unitEntry,
          ...(description ? { description } : {}),
          content
        };
      })
    }))
  };
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
    return {
      runtimeSnapshot: normalizeParsedXmlContentStructure(sourcePackage.sourceDocument),
      diagnostics: []
    };
  }

  if (looksLikeZipPackage) {
    const manifestExtraction = extractXmlManifestFromZipSourceDocument(
      sourcePackage.sourceDocument
    );
    if (manifestExtraction.status === "found") {
      return {
        runtimeSnapshot: normalizeParsedZipXmlContentStructure(
          manifestExtraction
        ),
        diagnostics: []
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
        diagnostics: []
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
): { bookletKey: string; displayLabel: string } => {
  const bookletEntry =
    contentRelease.runtimeSnapshot.bookletEntries.find(
      candidate => candidate.bookletKey === bookletKey
    ) ??
    contentRelease.runtimeSnapshot.bookletEntries[0] ??
    null;

  if (!bookletEntry) {
    return {
      bookletKey,
      displayLabel: toDisplayLabel("Booklet", bookletKey) ?? bookletKey
    };
  }

  return {
    bookletKey: bookletEntry.bookletKey,
    displayLabel: bookletEntry.displayLabel
  };
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
} => {
  if (!unitKey) {
    return {
      unitKey: null,
      displayLabel: null,
      description: null,
      content: null
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
    content: unitEntry?.content ?? null
  };
};

const resolveRuntimeBookletUnits = (
  contentRelease: ContentRelease,
  bookletKey: string
): Array<{
  unitKey: string;
  displayLabel: string;
  description?: string;
  content?: string;
}> => {
  const bookletEntry =
    contentRelease.runtimeSnapshot.bookletEntries.find(
      candidate => candidate.bookletKey === bookletKey
    ) ?? contentRelease.runtimeSnapshot.bookletEntries[0];

  return (
    bookletEntry?.unitEntries.map(unitEntry => ({
      unitKey: unitEntry.unitKey,
      displayLabel: unitEntry.displayLabel,
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

    for (const unitEntry of booklet?.unitEntries ?? []) {
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
    const bookletKey = rosterEntry.bookletKey?.trim();
    if (
      !bookletKey ||
      runLoginKeysByBookletKey.get(bookletKey)?.has(rosterEntry.loginKey)
    ) {
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
    const bookletKey = rosterEntry.bookletKey?.trim();
    if (!bookletKey) {
      continue;
    }
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
    const expectedUnits = inputRow.booklet?.unitEntries ?? [];
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
      const expected =
        booklet?.unitEntries.some(unitEntry => unitEntry.unitKey === normalizedUnitKey) ??
        false;
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
  const expectedUnits = booklet?.unitEntries ?? [];
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
        const testRuns = await repository.listTestRunsByWorkspace(
          workspace.tenantId,
          workspace.workspaceId
        );
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
        const parsedEntries = parseParticipantRosterText(input.rosterText);
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
            displayName: parsedEntry.displayName,
            importedAt: now()
          };

          await repository.saveParticipantRosterEntry(participantRosterEntry);
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

        const rosterEntry = await findParticipantRosterEntryByLoginKey(
          repository,
          workspace.tenantId,
          workspace.workspaceId,
          loginKey
        );
        const requestedGroupKey = String(input.groupKey ?? "").trim();
        const groupKey =
          requestedGroupKey || rosterEntry?.groupKey || `group:${loginKey}`;

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

        if (!latestTestRun) {
          return {
            participantSession,
            scope,
            latestTestRun: null,
            runtimeStatus: "ready_to_launch",
            availableAction: "launch"
          };
        }

        if (latestTestRun.status === "completed") {
          return {
            participantSession,
            scope,
            latestTestRun: normalizeTestRun(latestTestRun),
            runtimeStatus: "completed",
            availableAction: "none"
          };
        }

        return {
          participantSession,
          scope,
          latestTestRun: normalizeTestRun(latestTestRun),
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

        const currentTestRun = normalizeTestRun(latestTestRun);
        const contentRelease = await requireContentRelease(
          repository,
          currentTestRun.contentReleaseId
        );
        const availableActions: ParticipantCurrentRunState["availableActions"] = [];
        if (currentTestRun.status === "paused") {
          availableActions.push("resume", "save_progress", "complete");
        } else if (currentTestRun.status === "running") {
          availableActions.push("save_progress", "complete");
        }

        return {
          participantSession,
          scope,
          testRun: currentTestRun,
          booklet: resolveRuntimeBooklet(contentRelease, currentTestRun.bookletKey),
          currentUnit: resolveRuntimeUnit(
            contentRelease,
            currentTestRun.bookletKey,
            currentTestRun.currentUnitKey
          ),
          bookletUnits: resolveRuntimeBookletUnits(
            contentRelease,
            currentTestRun.bookletKey
          ),
          availableActions
        };
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

        if (participantSession.status === "closed") {
          throw new FirstSliceError(
            409,
            "participant_session_closed",
            `Participant session '${participantSessionId}' is already closed.`
          );
        }

        const requestedBookletKey = normalizeOptionalRuntimeBookletKey(
          input.bookletKey
        );
        const existingRun = await repository.getOpenTestRunByParticipantSessionId(
          participantSession.participantSessionId
        );

        if (existingRun) {
          return normalizeTestRun(existingRun);
        }

        const rosterEntry = requestedBookletKey
          ? null
          : await findParticipantRosterEntryByLoginKey(
              repository,
              participantSession.tenantId,
              participantSession.workspaceId,
              participantSession.loginKey
            );
        const rosterBookletKey = rosterEntry?.bookletKey?.trim() ?? "";
        const effectiveBookletKey = requestedBookletKey || rosterBookletKey;
        const bookletSource = requestedBookletKey
          ? "request"
          : rosterBookletKey
            ? "participant_roster"
            : "active_release_default";
        const selectedBooklet = effectiveBookletKey
          ? contentRelease.runtimeSnapshot.bookletEntries.find(
              booklet => booklet.bookletKey === effectiveBookletKey
            )
          : contentRelease.runtimeSnapshot.bookletEntries[0];

        if (effectiveBookletKey && !selectedBooklet) {
          throw new FirstSliceError(
            404,
            "booklet_not_found",
            `Booklet '${effectiveBookletKey}' was not found in active content release '${contentRelease.contentReleaseId}'.`
          );
        }

        const timestamp = now();
        const testRun: TestRun = {
          testRunId: idGenerator(),
          participantSessionId: participantSession.participantSessionId,
          tenantId: participantSession.tenantId,
          workspaceId: participantSession.workspaceId,
          contentReleaseId: participantSession.contentReleaseId,
          bookletKey:
            selectedBooklet?.bookletKey ?? `booklet:${participantSession.loginKey}`,
          status: "running",
          currentUnitKey: selectedBooklet?.unitEntries[0]?.unitKey ?? "unit-1",
          unitResponses: {},
          createdAt: timestamp,
          updatedAt: timestamp,
          completedAt: null
        };
        await repository.saveTestRun(testRun);
        await repository.saveParticipantSession({
          ...participantSession,
          status: "launched"
        });
        await recordWorkspaceActivity({
          tenantId: testRun.tenantId,
          workspaceId: testRun.workspaceId,
          eventType: "participant_session_resumed",
          subjectType: "test_run",
          subjectId: testRun.testRunId,
          summary: `Participant session '${participantSession.participantSessionId}' started a run.`,
          details: {
            participantSessionId: participantSession.participantSessionId,
            bookletKey: testRun.bookletKey,
            currentUnitKey: testRun.currentUnitKey,
            bookletSource
          }
        });
        return testRun;
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
          if (existingRun.status === "paused") {
            const resumedRun: TestRun = {
              ...normalizeTestRun(existingRun),
              status: "running",
              updatedAt: now()
            };
            await repository.saveTestRun(resumedRun);
            await recordWorkspaceActivity({
              tenantId: resumedRun.tenantId,
              workspaceId: resumedRun.workspaceId,
              eventType: "participant_session_resumed",
              subjectType: "test_run",
              subjectId: resumedRun.testRunId,
              summary: `Participant session '${participantSession.participantSessionId}' resumed an existing run.`,
              details: {
                participantSessionId: participantSession.participantSessionId,
                currentUnitKey: resumedRun.currentUnitKey
              }
            });
            return resumedRun;
          }

          return normalizeTestRun(existingRun);
        }

        const latestRun = await getLatestParticipantSessionRun(
          repository,
          participantSession.participantSessionId
        );
        if (latestRun?.status === "completed" || participantSession.status === "closed") {
          throw new FirstSliceError(
            409,
            "participant_session_has_no_resumable_run",
            `Participant session '${participantSessionId}' has no resumable test run.`
          );
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

        const testRun = normalizeTestRun(storedTestRun);
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
        if (nextCurrentUnitKey) {
          const contentRelease = await requireContentRelease(
            repository,
            testRun.contentReleaseId
          );
          requireRuntimeUnitForBooklet(
            contentRelease,
            testRun.bookletKey,
            nextCurrentUnitKey
          );
        }

        const nextUnitResponses = { ...testRun.unitResponses };
        const responseUnitKey = hasCurrentUnitKeyInput
          ? nextCurrentUnitKey
          : testRun.currentUnitKey;
        if (responseUnitKey && nextUnitResponse != null) {
          nextUnitResponses[responseUnitKey] = nextUnitResponse;
        }
        const nextStatus = normalizeTestRunProgressStatus(input.status);

        const updatedRun: TestRun = {
          ...testRun,
          status: nextStatus,
          currentUnitKey: nextCurrentUnitKey,
          unitResponses: nextUnitResponses,
          updatedAt: now()
        };
        await repository.saveTestRun(updatedRun);
        await recordWorkspaceActivity({
          tenantId: updatedRun.tenantId,
          workspaceId: updatedRun.workspaceId,
          eventType: "test_run_progress_saved",
          subjectType: "test_run",
          subjectId: updatedRun.testRunId,
          summary: `Progress saved for run '${updatedRun.testRunId}'.`,
          details: {
            status: updatedRun.status,
            currentUnitKey: updatedRun.currentUnitKey
          }
        });
        return updatedRun;
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

        const testRun = normalizeTestRun(storedTestRun);
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

        const resumedRun: TestRun = {
          ...testRun,
          status: "running",
          updatedAt: now()
        };
        await repository.saveTestRun(resumedRun);
        await recordWorkspaceActivity({
          tenantId: resumedRun.tenantId,
          workspaceId: resumedRun.workspaceId,
          eventType: "test_run_resumed",
          subjectType: "test_run",
          subjectId: resumedRun.testRunId,
          summary: `Run '${resumedRun.testRunId}' resumed.`,
          details: {
            currentUnitKey: resumedRun.currentUnitKey
          }
        });
        return resumedRun;
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

        const testRun = normalizeTestRun(storedTestRun);
        if (testRun.status === "completed") {
          return testRun;
        }

        const timestamp = now();
        const completedRun: TestRun = {
          ...testRun,
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
          await repository.saveParticipantSession({
            ...participantSession,
            status: "closed"
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
        const testRuns = await repository.listTestRunsByWorkspace(
          workspace.tenantId,
          workspace.workspaceId
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

        const testRun = normalizeTestRun(storedTestRun);
        if (
          testRun.tenantId !== workspace.tenantId ||
          testRun.workspaceId !== workspace.workspaceId
        ) {
          throw new FirstSliceError(
            404,
            "test_run_not_found",
            `Test run '${testRunId}' was not found in workspace '${input.workspaceKey}'.`
          );
        }

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
        const issuedAt = now();
        const nextStatus: TestRunStatus =
          commandType === "pause"
            ? "paused"
            : commandType === "resume"
              ? "running"
              : "completed";
        const nextTestRun: TestRun =
          commandType === "complete"
            ? {
                ...testRun,
                status: "completed",
                currentUnitKey: null,
                updatedAt: issuedAt,
                completedAt: issuedAt
              }
            : testRun.status === nextStatus
              ? testRun
              : {
                  ...testRun,
                  status: nextStatus,
                  updatedAt: issuedAt
                };
        const nextParticipantSession =
          commandType === "complete" && participantSession.status !== "closed"
            ? {
                ...participantSession,
                status: "closed" as const
              }
            : participantSession;

        if (nextTestRun !== testRun) {
          await repository.saveTestRun(nextTestRun);
        }
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
            nextStatus: nextTestRun.status,
            completedAt: nextTestRun.completedAt ?? null,
            participantSessionId: participantSession.participantSessionId,
            loginKey: participantSession.loginKey,
            groupKey: participantSession.groupKey,
            bookletKey: testRun.bookletKey
          }
        });

        return {
          commandId,
          commandType,
          actorId,
          issuedAt,
          previousStatus: testRun.status,
          testRun: nextTestRun,
          participantSession: nextParticipantSession
        };
      }
    }
  };
};
