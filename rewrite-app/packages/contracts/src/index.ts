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
  ContentReleaseStatus,
  ImportJob,
  ImportJobStatus,
  OpenMonitorRun,
  ParticipantCurrentRunState,
  ParticipantSession,
  ParticipantSessionStatus,
  ParticipantRuntimeState,
  SourcePackage,
  SourcePackageStatus,
  SourcePackageContentStructure,
  Tenant,
  TestRun,
  Workspace,
  WorkspaceContentReleaseListItem,
  WorkspaceContentReleaseDetail,
  WorkspaceActivityEventListItem,
  WorkspaceImportJobDetail,
  WorkspaceImportJobListItem,
  WorkspaceDetailedResponse,
  WorkspaceGroupResultDeletion,
  WorkspaceParticipantSessionDetail,
  WorkspaceParticipantRosterItem,
  WorkspaceParticipantSessionListItem,
  WorkspaceReviewListItem,
  WorkspaceActivityEventType,
  WorkspaceActivitySubjectType,
  WorkspaceSourcePackageDetail,
  WorkspaceSourcePackageListItem,
  WorkspaceStudyMonitorBookletDetail,
  WorkspaceStudyMonitorGroupDetail,
  WorkspaceStudyMonitorUnitDetail,
  WorkspaceStudyMonitorSummary,
  WorkspaceOverview
} from "@testcenter-rewrite-app/domain";

export type ParsedParticipantRosterEntry = {
  loginKey: string;
  groupKey: string;
  bookletKey: string | null;
  displayName: string | null;
};

const splitRosterLine = (line: string): string[] => {
  const delimiter = line.includes("\t")
    ? "\t"
    : line.includes(";")
      ? ";"
      : ",";
  return line.split(delimiter).map(value => value.trim());
};

const decodeXmlText = (value: string): string =>
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
    attributes[match[1]] = decodeXmlText(match[2] ?? match[3] ?? "");
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
    const value = match?.[2]?.replace(/<[^>]+>/g, "").trim();
    if (value) {
      return decodeXmlText(value);
    }
  }
  return undefined;
};

const readXmlChildAttribute = (
  content: string,
  tagNames: string,
  ...candidateAttributeNames: string[]
): string | undefined => {
  const match = content.match(
    new RegExp(
      `<((?:[a-zA-Z_][\\w.-]*:)?(?:${tagNames}))\\b([^>]*?)(?:\\/?>|>[\\s\\S]*?<\\/\\1>)`,
      "i"
    )
  );
  if (!match) {
    return undefined;
  }

  return readXmlAttribute(parseXmlAttributes(match[2] ?? ""), ...candidateAttributeNames);
};

const normalizeRosterTextValue = (value: string | undefined | null): string | null => {
  const normalizedValue = value?.trim();
  return normalizedValue ? normalizedValue : null;
};

const combineRosterDisplayName = (
  displayName: string | null,
  firstName: string | null,
  lastName: string | null
): string | null => {
  if (displayName) {
    return displayName;
  }

  const combinedName = [firstName, lastName].filter(Boolean).join(" ").trim();
  return combinedName || null;
};

const parseParticipantRosterXmlText = (
  rosterText: string
): ParsedParticipantRosterEntry[] => {
  if (!rosterText.trim().startsWith("<")) {
    return [];
  }

  const entries: ParsedParticipantRosterEntry[] = [];
  for (const match of rosterText.matchAll(
    /<((?:[a-zA-Z_][\w.-]*:)?(?:testtaker|test-taker|participant|person|student|user|examinee))\b([^>]*?)(?:\/>|>([\s\S]*?)<\/\1>)/gi
  )) {
    const attributes = parseXmlAttributes(match[2] ?? "");
    const content = match[3] ?? "";
    const loginKey = normalizeRosterTextValue(
      readXmlAttribute(
        attributes,
        "loginKey",
        "login",
        "username",
        "userName",
        "code",
        "identifier",
        "id"
      ) ?? readXmlChildText(content, "loginKey", "login", "username", "code", "id")
    );
    if (!loginKey) {
      continue;
    }

    const groupKey = normalizeRosterTextValue(
      readXmlAttribute(
        attributes,
        "groupKey",
        "group",
        "groupId",
        "groupName",
        "class",
        "className"
      ) ??
        readXmlChildAttribute(
          content,
          "group|groupRef|group-ref|class|classRef|class-ref",
          "groupKey",
          "key",
          "id",
          "identifier",
          "ref",
          "name"
        ) ??
        readXmlChildText(content, "groupKey", "group", "groupId", "groupName", "class")
    );
    const bookletKey = normalizeRosterTextValue(
      readXmlAttribute(
        attributes,
        "bookletKey",
        "booklet",
        "bookletId",
        "testlet",
        "testletId"
      ) ??
        readXmlChildAttribute(
          content,
          "booklet|bookletRef|booklet-ref|testlet|testletRef|testlet-ref",
          "bookletKey",
          "key",
          "id",
          "identifier",
          "ref",
          "name"
        ) ??
        readXmlChildText(
          content,
          "bookletKey",
          "booklet",
          "bookletId",
          "testlet",
          "testletId"
        )
    );
    const displayName = combineRosterDisplayName(
      normalizeRosterTextValue(
        readXmlAttribute(
          attributes,
          "displayName",
          "displayLabel",
          "label",
          "name",
          "fullName"
        ) ??
          readXmlChildText(
            content,
            "displayName",
            "displayLabel",
            "label",
            "name",
            "fullName"
          )
      ),
      normalizeRosterTextValue(
        readXmlAttribute(attributes, "firstName", "firstname", "givenName") ??
          readXmlChildText(content, "firstName", "firstname", "givenName")
      ),
      normalizeRosterTextValue(
        readXmlAttribute(attributes, "lastName", "lastname", "familyName") ??
          readXmlChildText(content, "lastName", "lastname", "familyName")
      )
    );

    entries.push({
      loginKey,
      groupKey: groupKey || `group:${loginKey}`,
      bookletKey,
      displayName
    });
  }

  return entries;
};

export const parseParticipantRosterText = (
  rosterText: string
): ParsedParticipantRosterEntry[] => {
  const xmlEntries = parseParticipantRosterXmlText(rosterText);
  if (xmlEntries.length > 0) {
    return xmlEntries;
  }

  return rosterText
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(line => line && !line.startsWith("#"))
    .flatMap(line => {
      const [loginKey, groupKey, bookletKey, displayName] = splitRosterLine(line);
      if (!loginKey || loginKey.toLowerCase() === "loginkey") {
        return [];
      }

      return [
        {
          loginKey,
          groupKey: groupKey || `group:${loginKey}`,
          bookletKey: bookletKey || null,
          displayName: displayName || null
        }
      ];
    });
};

export const productionApiRoutes = {
  admin: {
    bootstrap: "/api/v1/admin/auth/bootstrap",
    signIn: "/api/v1/admin/auth/sign-in",
    signOut: "/api/v1/admin/auth/sign-out",
    currentSession: "/api/v1/admin/auth/current-session",
    listUsers: "/api/v1/admin/users",
    createUser: "/api/v1/admin/users",
    updateUser: "/api/v1/admin/users/:adminUserId",
    resetPassword: "/api/v1/admin/users/:adminUserId/password",
    assignRole: "/api/v1/admin/users/:adminUserId/role-assignments",
    revokeRole:
      "/api/v1/admin/users/:adminUserId/role-assignments/:roleAssignmentId",
    listAuditEvents: "/api/v1/admin/audit-events"
  },
  platform: {
    listTenants: "/api/v1/platform/tenants",
    createTenant: "/api/v1/platform/tenants"
  },
  workspace: {
    createWorkspace: "/api/v1/tenants/:tenantKey/workspaces",
    listWorkspaces: "/api/v1/tenants/:tenantKey/workspaces",
    getWorkspaceOverview: "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey",
    getStudyMonitorSummary:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/study-monitor/summary",
    getStudyMonitorGroup:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/study-monitor/groups/:groupKey",
    getStudyMonitorBooklet:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/study-monitor/booklets/:bookletKey",
    getStudyMonitorUnit:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/study-monitor/units/:unitKey",
    listWorkspaceActivityEvents:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/activity-events",
    createSourcePackage: "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/source-packages",
    listSourcePackages: "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/source-packages",
    getSourcePackage:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/source-packages/:sourcePackageId",
    retrySourcePackageImport:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/source-packages/:sourcePackageId/retry-import",
    createImportJob: "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/import-jobs",
    listImportJobs: "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/import-jobs",
    getImportJob:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/import-jobs/:importJobId",
    listParticipantSessions:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/participant-sessions",
    getParticipantSession:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/participant-sessions/:participantSessionId",
    importParticipantRoster:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/participant-roster",
    listParticipantRoster:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/participant-roster",
    exportResponseCsv:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/responses.csv",
    exportLogCsv:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/logs.csv",
    exportReviewCsv:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/exports/reviews.csv",
    listDetailedResponses:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/responses/detailed",
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
    listContentReleases:
      "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/content-releases",
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
    saveProgress: "/api/v1/participant/test-runs/:testRunId/save-progress",
    resumeSession: "/api/v1/participant/sessions/:participantSessionId/resume",
    resumeRun: "/api/v1/participant/test-runs/:testRunId/resume",
    completeRun: "/api/v1/participant/test-runs/:testRunId/complete"
  },
  monitor: {
    openRuns: "/api/v1/tenants/:tenantKey/workspaces/:workspaceKey/monitor/open-runs"
  },
  system: {
    getRuntimeDiagnostics: "/diagnostics/runtime",
    getRuntimeConfig: "/diagnostics/config"
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

export type CreateSourcePackageRequest = {
  fileName: string;
  mediaType: string;
  contentStructure?: SourcePackageContentStructure;
  sourceDocument?: string;
};

export type CreateImportJobRequest = {
  sourcePackageId: string;
};

export type RetrySourcePackageImportRequest = {
  fileName?: string;
  mediaType?: string;
  contentStructure?: SourcePackageContentStructure | null;
  sourceDocument?: string | null;
};

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
  contentReleaseId?: string;
  limit?: number;
};

export type DetailedResponseListQuery = {
  loginKey?: string;
  groupKey?: string;
  participantSessionId?: string;
  testRunId?: string;
  unitKey?: string;
  status?: TestRun["status"];
  limit?: number;
};

export type WorkspaceReviewListQuery = {
  loginKey?: string;
  groupKey?: string;
  participantSessionId?: string;
  testRunId?: string;
  unitKey?: string;
  reviewerId?: string;
  category?: string;
  limit?: number;
};

export type SourcePackageListQuery = {
  status?: SourcePackageStatus;
  mediaType?: string;
  fileName?: string;
  latestImportStatus?: ImportJobStatus;
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

export type AdminUserListQuery = {
  username?: string;
  status?: AdminUserStatus;
  role?: AdminRole;
  tenantKey?: string;
  workspaceKey?: string;
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
  workspaceKey: string;
  loginKey: string;
  groupKey?: string;
};

export type PublicAdminUser = Omit<AdminUser, "passwordHash">;

export type PublicAdminSession = Omit<AdminSession, "token">;

export type PublicAdminRoleAssignment = AdminRoleAssignment;

export type BootstrapAdminUserRequest = {
  username: string;
  displayName?: string;
  password: string;
};

export type AdminSignInRequest = {
  username: string;
  password: string;
};

export type AdminRoleAssignmentRequest = {
  role: AdminRole;
  tenantKey?: string | null;
  workspaceKey?: string | null;
};

export type CreateAdminUserRequest = {
  username: string;
  displayName?: string;
  password: string;
  roleAssignments?: AdminRoleAssignmentRequest[];
};

export type UpdateAdminUserRequest = {
  displayName?: string;
  status?: AdminUserStatus;
};

export type ResetAdminUserPasswordRequest = {
  password: string;
};

export type AssignAdminRoleRequest = AdminRoleAssignmentRequest;

export type ParticipantLaunchRequest = {
  participantSessionId: string;
  bookletKey?: string;
};

export type ImportParticipantRosterRequest = {
  rosterText: string;
};

export type ResumeParticipantSessionRequest = {
  bookletKey?: string;
};

export type SaveTestRunProgressRequest = {
  currentUnitKey?: string | null;
  status: Extract<TestRun["status"], "running" | "paused">;
  unitResponse?: string | null;
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

export type ListWorkspacesResponse = {
  items: Workspace[];
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

export type AdminUserDirectoryItem = {
  adminUser: PublicAdminUser;
  roleAssignments: PublicAdminRoleAssignment[];
};

export type ListAdminUsersResponse = {
  items: AdminUserDirectoryItem[];
};

export type CreateAdminUserResponse = AdminUserDirectoryItem;

export type UpdateAdminUserResponse = AdminUserDirectoryItem;

export type ResetAdminUserPasswordResponse = AdminUserDirectoryItem;

export type AssignAdminRoleResponse = AdminUserDirectoryItem;

export type RevokeAdminRoleResponse = AdminUserDirectoryItem;

export type ListAdminAuditEventsResponse = {
  items: AdminAuditEvent[];
};

export type GetWorkspaceOverviewResponse = {
  workspaceOverview: WorkspaceOverview;
};

export type GetStudyMonitorSummaryResponse = {
  studyMonitorSummary: WorkspaceStudyMonitorSummary;
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

export type ListWorkspaceActivityEventsResponse = {
  items: WorkspaceActivityEventListItem[];
};

export type CreateSourcePackageResponse = {
  sourcePackage: SourcePackage;
};

export type CreateImportJobResponse = {
  importJob: ImportJob;
  stagedContentRelease: ContentRelease | null;
};

export type RetrySourcePackageImportResponse = {
  sourcePackage: SourcePackage;
  importJob: ImportJob;
  stagedContentRelease: ContentRelease | null;
};

export type ListSourcePackagesResponse = {
  items: WorkspaceSourcePackageListItem[];
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
  items: WorkspaceParticipantRosterItem[];
};

export type ListParticipantRosterResponse = {
  items: WorkspaceParticipantRosterItem[];
};

export type ListDetailedResponsesResponse = {
  items: WorkspaceDetailedResponse[];
};

export type CreateReviewRequest = {
  participantSessionId: string;
  testRunId: string;
  unitKey?: string | null;
  reviewerId: string;
  category: string;
  comment: string;
};

export type UpdateReviewRequest = {
  unitKey?: string | null;
  reviewerId?: string;
  category?: string;
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

export type ListContentReleasesResponse = {
  items: WorkspaceContentReleaseListItem[];
};

export type GetContentReleaseResponse = {
  contentReleaseDetail: WorkspaceContentReleaseDetail;
};

export type GetContentReleaseActivationReadinessResponse = {
  activationReadiness: ContentReleaseActivationReadiness;
};

export type ActivateContentReleaseResponse = {
  contentRelease: ContentRelease;
};

export type ParticipantSignInResponse = {
  participantSession: ParticipantSession;
};

export type ParticipantLaunchResponse = {
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
    httpTimeouts: {
      headersTimeoutMs: number;
      requestTimeoutMs: number;
      keepAliveTimeoutMs: number;
    };
    operatorAuthRequired: boolean;
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
      firstSliceOperatorAuthRequired: boolean;
      firstSliceBootstrapDemo: boolean;
      httpHeadersTimeoutMsPresent: boolean;
      httpRequestTimeoutMsPresent: boolean;
      httpKeepAliveTimeoutMsPresent: boolean;
      appBuildShaPresent: boolean;
      appBuildTimestampPresent: boolean;
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
