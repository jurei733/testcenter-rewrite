import { randomBytes, randomUUID, scryptSync, timingSafeEqual } from "node:crypto";

import type {
  AdminAuditEvent,
  AdminAuditEventType,
  AdminRole,
  AdminRoleAssignment,
  AdminSession,
  AdminUser,
  AdminUserStatus,
  ContentReleaseActivationReadiness,
  ContentRelease,
  ContentReleaseRuntimeSnapshot,
  ImportJob,
  ImportJobDiagnostic,
  OpenMonitorRun,
  ParticipantCurrentRunState,
  ParticipantSession,
  ParticipantRuntimeState,
  SourcePackage,
  SourcePackageContentStructure,
  Tenant,
  TestRun,
  Workspace,
  WorkspaceContentReleaseListItem,
  WorkspaceContentReleaseDetail,
  WorkspaceActivityEvent,
  WorkspaceActivityEventListItem,
  WorkspaceImportJobDetail,
  WorkspaceImportJobListItem,
  WorkspaceDetailedResponse,
  WorkspaceGroupResultDeletion,
  WorkspaceParticipantSessionDetail,
  WorkspaceParticipantSessionListItem,
  WorkspaceSourcePackageDetail,
  WorkspaceSourcePackageListItem,
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
    sourceDocument?: string;
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
    sourceDocument?: string | null;
  }): Promise<CreateImportJobResult & { sourcePackage: SourcePackage }>;
  activateContentRelease(input: {
    tenantKey: string;
    workspaceKey: string;
    contentReleaseId: string;
    activatedByActorId: string;
    forceActivation?: boolean;
  }): Promise<ContentRelease>;
};

export type WorkspaceAdminReadPort = {
  getWorkspaceOverview(input: {
    tenantKey: string;
    workspaceKey: string;
  }): Promise<WorkspaceOverview>;
  listWorkspaceActivityEvents(input: {
    tenantKey: string;
    workspaceKey: string;
    eventType?: WorkspaceActivityEvent["eventType"];
  }): Promise<WorkspaceActivityEventListItem[]>;
  exportLogCsv(input: {
    tenantKey: string;
    workspaceKey: string;
  }): Promise<string>;
  getSourcePackageDetail(input: {
    tenantKey: string;
    workspaceKey: string;
    sourcePackageId: string;
  }): Promise<WorkspaceSourcePackageDetail>;
  listSourcePackages(input: {
    tenantKey: string;
    workspaceKey: string;
  }): Promise<WorkspaceSourcePackageListItem[]>;
  getImportJobDetail(input: {
    tenantKey: string;
    workspaceKey: string;
    importJobId: string;
  }): Promise<WorkspaceImportJobDetail>;
  listParticipantSessions(input: {
    tenantKey: string;
    workspaceKey: string;
  }): Promise<WorkspaceParticipantSessionListItem[]>;
  getParticipantSessionDetail(input: {
    tenantKey: string;
    workspaceKey: string;
    participantSessionId: string;
  }): Promise<WorkspaceParticipantSessionDetail>;
  listDetailedResponses(input: {
    tenantKey: string;
    workspaceKey: string;
  }): Promise<WorkspaceDetailedResponse[]>;
  exportResponseCsv(input: {
    tenantKey: string;
    workspaceKey: string;
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
  }): Promise<WorkspaceImportJobListItem[]>;
  listContentReleases(input: {
    tenantKey: string;
    workspaceKey: string;
  }): Promise<WorkspaceContentReleaseListItem[]>;
};

export type WorkspaceResultsPort = {
  deleteGroupResults(input: {
    tenantKey: string;
    workspaceKey: string;
    groupKey: string;
  }): Promise<WorkspaceGroupResultDeletion>;
};

export type ParticipantRuntimePort = {
  signIn(input: {
    workspaceKey: string;
    loginKey: string;
  }): Promise<ParticipantSession>;
  getRuntimeState(input: {
    participantSessionId: string;
  }): Promise<ParticipantRuntimeState>;
  getCurrentRunState(input: {
    participantSessionId: string;
  }): Promise<ParticipantCurrentRunState>;
  launch(input: { participantSessionId: string }): Promise<TestRun>;
  resumeSession(input: { participantSessionId: string }): Promise<TestRun>;
  saveProgress(input: {
    testRunId: string;
    currentUnitKey: string | null;
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
  }): Promise<OpenMonitorRun[]>;
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
  signOut(input: { sessionToken: string }): Promise<AdminSession>;
};

export type AdminDirectoryPort = {
  listAdminUsers(input: {
    sessionToken: string;
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
  participantRuntime: ParticipantRuntimePort;
  monitorRead: MonitorReadPort;
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
  listWorkspaceActivityEvents: "ListWorkspaceActivityEvents",
  exportLogCsv: "ExportLogCsv",
  getSourcePackageDetail: "GetSourcePackageDetail",
  listSourcePackages: "ListSourcePackages",
  createSourcePackage: "CreateSourcePackage",
  createImportJob: "CreateImportJob",
  retrySourcePackageImport: "RetrySourcePackageImport",
  getImportJobDetail: "GetImportJobDetail",
  listParticipantSessions: "ListParticipantSessions",
  getParticipantSessionDetail: "GetParticipantSessionDetail",
  listDetailedResponses: "ListDetailedResponses",
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
  listOpenMonitorRuns: "ListOpenMonitorRuns"
} as const;

export type CreateImportJobResult = {
  importJob: ImportJob;
  stagedContentRelease: ContentRelease | null;
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
      loginKey: participantSession?.loginKey ?? "unknown",
      groupKey: participantSession?.groupKey ?? "unknown",
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

const formatResponseCsv = (input: {
  tenantKey: string;
  workspaceKey: string;
  participantSessions: ParticipantSession[];
  testRuns: TestRun[];
}): string => {
  const participantSessionsById = new Map(
    input.participantSessions.map(participantSession => [
      participantSession.participantSessionId,
      participantSession
    ])
  );
  const rows = input.testRuns.flatMap(testRun => {
    const normalizedTestRun = normalizeTestRun(testRun);
    const participantSession =
      participantSessionsById.get(normalizedTestRun.participantSessionId) ?? null;

    return Object.entries(normalizedTestRun.unitResponses).map(
      ([unitKey, response]) => ({
        tenantKey: input.tenantKey,
        workspaceKey: input.workspaceKey,
        loginKey: participantSession?.loginKey ?? "",
        groupKey: participantSession?.groupKey ?? "",
        participantSessionId: normalizedTestRun.participantSessionId,
        testRunId: normalizedTestRun.testRunId,
        bookletKey: normalizedTestRun.bookletKey,
        unitKey,
        response,
        status: normalizedTestRun.status,
        updatedAt: normalizedTestRun.updatedAt,
        completedAt: normalizedTestRun.completedAt ?? ""
      })
    );
  });

  rows.sort(
    (left, right) =>
      left.loginKey.localeCompare(right.loginKey) ||
      left.participantSessionId.localeCompare(right.participantSessionId) ||
      left.testRunId.localeCompare(right.testRunId) ||
      left.unitKey.localeCompare(right.unitKey)
  );

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
    "completedAt"
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
        row.completedAt
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

const listDetailedResponsesForWorkspace = (input: {
  tenantKey: string;
  workspaceKey: string;
  participantSessions: ParticipantSession[];
  testRuns: TestRun[];
}): WorkspaceDetailedResponse[] => {
  const participantSessionsById = new Map(
    input.participantSessions.map(participantSession => [
      participantSession.participantSessionId,
      participantSession
    ])
  );

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
    .sort(
      (left, right) =>
        left.loginKey.localeCompare(right.loginKey) ||
        left.participantSessionId.localeCompare(right.participantSessionId) ||
        left.testRunId.localeCompare(right.testRunId) ||
        left.unitKey.localeCompare(right.unitKey)
    );
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

const normalizeContentStructure = (
  contentStructure: SourcePackageContentStructure
): ContentReleaseRuntimeSnapshot | null => {
  const bookletEntries = contentStructure.bookletEntries
    .map(bookletEntry => ({
      bookletKey: bookletEntry.bookletKey,
      displayLabel: bookletEntry.displayLabel,
      unitEntries: bookletEntry.unitEntries.map(unitEntry => ({
        unitKey: unitEntry.unitKey,
        displayLabel: unitEntry.displayLabel
      }))
    }))
    .filter(
      bookletEntry =>
        bookletEntry.bookletKey.length > 0 &&
        bookletEntry.displayLabel.length > 0 &&
        bookletEntry.unitEntries.length > 0
    );

  if (bookletEntries.length === 0) {
    return null;
  }

  return { bookletEntries };
};

const normalizeParsedJsonContentStructure = (
  parsed: unknown
): ContentReleaseRuntimeSnapshot | null => {
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }

  const candidate = parsed as {
    bookletEntries?: unknown;
    booklets?: unknown;
  };
  const rawBooklets = Array.isArray(candidate.bookletEntries)
    ? candidate.bookletEntries
    : Array.isArray(candidate.booklets)
      ? candidate.booklets
      : [];

  const contentStructure: SourcePackageContentStructure = {
    bookletEntries: rawBooklets
      .map(rawBooklet => {
        if (typeof rawBooklet !== "object" || rawBooklet === null) {
          return null;
        }

        const booklet = rawBooklet as Record<string, unknown>;
        const rawUnits = Array.isArray(booklet.unitEntries)
          ? booklet.unitEntries
          : Array.isArray(booklet.units)
            ? booklet.units
            : [];

        return {
          bookletKey: String(
            booklet.bookletKey ?? booklet.key ?? booklet.id ?? ""
          ).trim(),
          displayLabel: String(
            booklet.displayLabel ?? booklet.label ?? booklet.title ?? ""
          ).trim(),
          unitEntries: rawUnits
            .map(rawUnit => {
              if (typeof rawUnit !== "object" || rawUnit === null) {
                return null;
              }

              const unit = rawUnit as Record<string, unknown>;
              return {
                unitKey: String(unit.unitKey ?? unit.key ?? unit.id ?? "").trim(),
                displayLabel: String(
                  unit.displayLabel ?? unit.label ?? unit.title ?? ""
                ).trim()
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
    const match = normalizedEntries.find(([key]) => key === normalizedName);
    if (match) {
      return match[1];
    }
  }

  return undefined;
};

const normalizeParsedXmlContentStructure = (
  sourceDocument: string
): ContentReleaseRuntimeSnapshot | null => {
  const bookletEntries: SourcePackageContentStructure["bookletEntries"] = [];

  for (const bookletMatch of sourceDocument.matchAll(
    /<booklet\b([^>]*)>([\s\S]*?)<\/booklet>/gi
  )) {
    const bookletAttributes = parseXmlAttributes(bookletMatch[1] ?? "");
    const unitEntries: SourcePackageContentStructure["bookletEntries"][number]["unitEntries"] = [];

    for (const unitMatch of (bookletMatch[2] ?? "").matchAll(/<unit\b([^>]*?)(?:\/>|>([\s\S]*?)<\/unit>)/gi)) {
      const unitAttributes = parseXmlAttributes(unitMatch[1] ?? "");
      unitEntries.push({
        unitKey: String(
          readXmlAttribute(unitAttributes, "unitKey", "key", "id") ?? ""
        ).trim(),
        displayLabel: String(
          readXmlAttribute(unitAttributes, "displayLabel", "label", "title") ??
            ""
        ).trim()
      });
    }

    bookletEntries.push({
      bookletKey: String(
        readXmlAttribute(bookletAttributes, "bookletKey", "key", "id") ??
          ""
      ).trim(),
      displayLabel: String(
        readXmlAttribute(bookletAttributes, "displayLabel", "label", "title") ??
          ""
      ).trim(),
      unitEntries
    });
  }

  return normalizeContentStructure({ bookletEntries });
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

  if (
    normalizedMediaType.includes("json") ||
    normalizedFileName.endsWith(".json")
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

  if (normalizedMediaType.includes("xml") || normalizedFileName.endsWith(".xml")) {
    return {
      runtimeSnapshot: normalizeParsedXmlContentStructure(sourcePackage.sourceDocument),
      diagnostics: []
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
            { unitKey: "unit-1", displayLabel: "Introduction Unit" },
            { unitKey: "unit-2", displayLabel: "Practice Unit" },
            { unitKey: "unit-3", displayLabel: "Assessment Unit" },
            { unitKey: "unit-4", displayLabel: "Wrap-Up Unit" }
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
): { unitKey: string | null; displayLabel: string | null } => {
  if (!unitKey) {
    return {
      unitKey: null,
      displayLabel: null
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
    displayLabel: unitEntry?.displayLabel ?? toDisplayLabel("Unit", unitKey)
  };
};

const resolveRuntimeBookletUnits = (
  contentRelease: ContentRelease,
  bookletKey: string
): Array<{ unitKey: string; displayLabel: string }> => {
  const bookletEntry =
    contentRelease.runtimeSnapshot.bookletEntries.find(
      candidate => candidate.bookletKey === bookletKey
    ) ?? contentRelease.runtimeSnapshot.bookletEntries[0];

  return (
    bookletEntry?.unitEntries.map(unitEntry => ({
      unitKey: unitEntry.unitKey,
      displayLabel: unitEntry.displayLabel
    })) ?? []
  );
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

export const createFirstSliceServices = (
  dependencies: FirstSliceDependencies
): FirstSliceServices => {
  const repository = dependencies.repository;
  const idGenerator = dependencies.idGenerator ?? randomUUID;
  const now = dependencies.now ?? (() => new Date().toISOString());
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

        const adminUsers = (await repository.listAdminUsers()).sort(
          (left, right) =>
            left.createdAt.localeCompare(right.createdAt) ||
            left.username.localeCompare(right.username)
        );

        return Promise.all(
          adminUsers.map(async adminUser => ({
            adminUser,
            roleAssignments: await listAdminRoleAssignmentsForUser(
              repository,
              adminUser.adminUserId
            )
          }))
        );
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

        return activityEvents
          .filter(activityEvent =>
            input.eventType ? activityEvent.eventType === input.eventType : true
          )
          .sort((left, right) => right.occurredAt.localeCompare(left.occurredAt))
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

        return sourcePackages
          .sort((left, right) => right.uploadedAt.localeCompare(left.uploadedAt))
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

        return importJobs
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
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
        const testRuns = await repository.listTestRunsByWorkspace(
          workspace.tenantId,
          workspace.workspaceId
        );
        const contentReleases = await repository.listContentReleasesByWorkspace(
          workspace.tenantId,
          workspace.workspaceId
        );

        return participantSessions
          .sort((left, right) => right.createdAt.localeCompare(left.createdAt))
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
              latestTestRun: sessionRuns[0] ?? null,
              contentRelease:
                contentReleases.find(
                  contentRelease =>
                    contentRelease.contentReleaseId ===
                    participantSession.contentReleaseId
                ) ?? null
            };
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

        const contentRelease =
          (await repository.getContentReleaseById(
            participantSession.contentReleaseId
          )) ?? null;
        const testRuns = (
          await repository.listTestRunsByParticipantSessionId(
            participantSession.participantSessionId
          )
        ).sort((left, right) => right.updatedAt.localeCompare(left.updatedAt));

        return {
          participantSession,
          contentRelease,
          testRuns
        };
      },
      async listDetailedResponses(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const [participantSessions, testRuns] = await Promise.all([
          repository.listParticipantSessionsByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          ),
          repository.listTestRunsByWorkspace(workspace.tenantId, workspace.workspaceId)
        ]);

        return listDetailedResponsesForWorkspace({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          participantSessions,
          testRuns
        });
      },
      async exportResponseCsv(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const [participantSessions, testRuns] = await Promise.all([
          repository.listParticipantSessionsByWorkspace(
            workspace.tenantId,
            workspace.workspaceId
          ),
          repository.listTestRunsByWorkspace(workspace.tenantId, workspace.workspaceId)
        ]);

        return formatResponseCsv({
          tenantKey: input.tenantKey,
          workspaceKey: input.workspaceKey,
          participantSessions,
          testRuns
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

        return {
          contentRelease,
          activeContentReleaseId: activeRelease?.contentReleaseId ?? null,
          canActivate: blockingOpenRuns.length === 0,
          blockingOpenRuns
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

        return buildWorkspaceContentReleaseListItems({
          contentReleases,
          importJobs,
          sourcePackages,
          participantSessions,
          testRuns
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
          affectedParticipantSessionIds,
          deletedTestRunIds
        };
      }
    },
    contentIntake: {
      async createSourcePackage(input) {
        const workspace = await requireWorkspace(
          repository,
          input.tenantKey,
          input.workspaceKey
        );
        const sourcePackage: SourcePackage = {
          sourcePackageId: idGenerator(),
          tenantId: workspace.tenantId,
          workspaceId: workspace.workspaceId,
          fileName: input.fileName,
          mediaType: input.mediaType,
          contentStructure: input.contentStructure ?? null,
          sourceDocument: input.sourceDocument ?? null,
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

        const updatedSourcePackage: SourcePackage = {
          ...sourcePackage,
          fileName: input.fileName ?? sourcePackage.fileName,
          mediaType: input.mediaType ?? sourcePackage.mediaType,
          contentStructure:
            input.contentStructure !== undefined
              ? input.contentStructure
              : sourcePackage.contentStructure,
          sourceDocument:
            input.sourceDocument !== undefined
              ? input.sourceDocument
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

        if (
          activeRelease &&
          activeRelease.contentReleaseId !== targetRelease.contentReleaseId &&
          !input.forceActivation
        ) {
          const openMonitorRuns = await listOpenMonitorRunsForActiveRelease({
            repository,
            tenantId: workspace.tenantId,
            workspaceId: workspace.workspaceId,
            activeContentReleaseId: activeRelease.contentReleaseId
          });

          if (openMonitorRuns.length > 0) {
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
                openRuns: openMonitorRuns
              }
            });

            throw new FirstSliceError(
              409,
              "active_content_release_has_open_runs",
              `Active content release '${activeRelease.contentReleaseId}' still has ${openMonitorRuns.length} open run(s). Re-submit with forceActivation to supersede it.`,
              {
                activeContentReleaseId: activeRelease.contentReleaseId,
                openRuns: openMonitorRuns
              } satisfies ActivateContentReleaseBlockedDetails
            );
          }
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
        await recordWorkspaceActivity({
          tenantId: workspace.tenantId,
          workspaceId: workspace.workspaceId,
          eventType: "content_release_activated",
          actorId: input.activatedByActorId,
          subjectType: "content_release",
          subjectId: activatedRelease.contentReleaseId,
          summary: `Content release '${activatedRelease.contentReleaseId}' activated.`,
          details: {
            forced: Boolean(input.forceActivation)
          }
        });
        return activatedRelease;
      }
    },
    createImportJobWithRelease,
    participantRuntime: {
      async signIn(input) {
        const workspace = await repository.getWorkspaceByWorkspaceKey(
          input.workspaceKey
        );

        if (!workspace) {
          throw new FirstSliceError(
            404,
            "workspace_not_found",
            `Workspace '${input.workspaceKey}' was not found.`
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

        const participantSession: ParticipantSession = {
          participantSessionId: idGenerator(),
          tenantId: workspace.tenantId,
          workspaceId: workspace.workspaceId,
          contentReleaseId: activeRelease.contentReleaseId,
          loginKey: input.loginKey,
          groupKey: `group:${input.loginKey}`,
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
            contentReleaseId: participantSession.contentReleaseId
          }
        });
        return participantSession;
      },
      async getRuntimeState(input) {
        const participantSession = await requireParticipantSession(
          repository,
          input.participantSessionId
        );
        const latestTestRun = await getLatestParticipantSessionRun(
          repository,
          participantSession.participantSessionId
        );

        if (!latestTestRun) {
          return {
            participantSession,
            latestTestRun: null,
            runtimeStatus: "ready_to_launch",
            availableAction: "launch"
          };
        }

        if (latestTestRun.status === "completed") {
          return {
            participantSession,
            latestTestRun: normalizeTestRun(latestTestRun),
            runtimeStatus: "completed",
            availableAction: "none"
          };
        }

        return {
          participantSession,
          latestTestRun: normalizeTestRun(latestTestRun),
          runtimeStatus: "in_progress",
          availableAction: "resume"
        };
      },
      async getCurrentRunState(input) {
        const participantSession = await requireParticipantSession(
          repository,
          input.participantSessionId
        );
        const latestTestRun = await getLatestParticipantSessionRun(
          repository,
          participantSession.participantSessionId
        );

        if (!latestTestRun) {
          throw new FirstSliceError(
            409,
            "participant_session_has_no_current_run",
            `Participant session '${input.participantSessionId}' has no current test run yet.`
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
        const participantSession = await requireParticipantSession(
          repository,
          input.participantSessionId
        );
        const contentRelease = await requireContentRelease(
          repository,
          participantSession.contentReleaseId
        );

        const existingRun = await repository.getOpenTestRunByParticipantSessionId(
          participantSession.participantSessionId
        );

        if (existingRun) {
          return normalizeTestRun(existingRun);
        }

        const timestamp = now();
        const testRun: TestRun = {
          testRunId: idGenerator(),
          participantSessionId: participantSession.participantSessionId,
          tenantId: participantSession.tenantId,
          workspaceId: participantSession.workspaceId,
          contentReleaseId: participantSession.contentReleaseId,
          bookletKey: contentRelease.runtimeSnapshot.bookletEntries[0]?.bookletKey ??
            `booklet:${participantSession.loginKey}`,
          status: "running",
          currentUnitKey:
            contentRelease.runtimeSnapshot.bookletEntries[0]?.unitEntries[0]?.unitKey ??
            "unit-1",
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
            currentUnitKey: testRun.currentUnitKey
          }
        });
        return testRun;
      },
      async resumeSession(input) {
        const participantSession = await requireParticipantSession(
          repository,
          input.participantSessionId
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
            `Participant session '${input.participantSessionId}' has no resumable test run.`
          );
        }

        return this.launch({
          participantSessionId: participantSession.participantSessionId
        });
      },
      async saveProgress(input) {
        const storedTestRun = await repository.getTestRunById(input.testRunId);

        if (!storedTestRun) {
          throw new FirstSliceError(
            404,
            "test_run_not_found",
            `Test run '${input.testRunId}' was not found.`
          );
        }

        const testRun = normalizeTestRun(storedTestRun);
        if (testRun.status === "completed") {
          throw new FirstSliceError(
            409,
            "test_run_already_completed",
            `Test run '${input.testRunId}' is already completed.`
          );
        }

        const nextUnitResponses = { ...testRun.unitResponses };
        if (input.currentUnitKey && input.unitResponse != null) {
          nextUnitResponses[input.currentUnitKey] = input.unitResponse;
        }

        const updatedRun: TestRun = {
          ...testRun,
          status: input.status,
          currentUnitKey: input.currentUnitKey,
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
        const storedTestRun = await repository.getTestRunById(input.testRunId);

        if (!storedTestRun) {
          throw new FirstSliceError(
            404,
            "test_run_not_found",
            `Test run '${input.testRunId}' was not found.`
          );
        }

        const testRun = normalizeTestRun(storedTestRun);
        if (testRun.status === "completed") {
          throw new FirstSliceError(
            409,
            "test_run_already_completed",
            `Test run '${input.testRunId}' is already completed.`
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
        const storedTestRun = await repository.getTestRunById(input.testRunId);

        if (!storedTestRun) {
          throw new FirstSliceError(
            404,
            "test_run_not_found",
            `Test run '${input.testRunId}' was not found.`
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

        return testRuns
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
              loginKey: participantSession?.loginKey ?? "unknown-login",
              groupKey: participantSession?.groupKey ?? "unknown-group",
              bookletKey: testRun.bookletKey,
              status: testRun.status,
              currentUnitKey: testRun.currentUnitKey,
              updatedAt: testRun.updatedAt
            };
          });
      }
    }
  };
};
