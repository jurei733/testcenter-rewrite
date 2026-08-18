import { createHash, randomUUID } from "node:crypto";
import { once } from "node:events";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { basename, extname, relative, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";

import { localDemoSourcePackage } from "./local-demo-bootstrap.js";

import {
  createFirstSliceServices,
  type FirstSliceError,
  type FirstSliceRepository,
  type FirstSliceServices,
  firstSliceUseCases
} from "@testcenter-rewrite-app/application";
import {
  BUG_REPORT_MAX_REPORT_LENGTH,
  BUG_REPORT_MAX_TAG_LENGTH,
  BUG_REPORT_MAX_TITLE_LENGTH,
  type AdminSignInRequest,
  type AdminSignInResponse,
  type AdminSignOutResponse,
  type ChangeAdminPasswordRequest,
  type ChangeAdminPasswordResponse,
  type AdminAuditEventListQuery,
  type ApiErrorResponse,
  type ActivateContentReleaseRequest,
  type ActivateContentReleaseResponse,
  type AssembleSourcePackagesRequest,
  type AssembleSourcePackagesResponse,
  type AssignAdminRoleRequest,
  type AssignAdminRoleResponse,
  type BootstrapAdminUserRequest,
  type BootstrapAdminUserResponse,
  type BugReportConfigResponse,
  type CompleteTestRunRequest,
  type CompleteTestRunResponse,
  type CreateAdminUserRequest,
  type CreateAdminUserResponse,
  type DeleteAdminUserResponse,
  type CreateImportJobRequest,
  type CreateImportJobResponse,
  type CreateParticipantReviewRequest,
  type CreateReviewRequest,
  type CreateSourcePackageRequest,
  type CreateSourcePackageResponse,
  type CreateTenantRequest,
  type CreateTenantResponse,
  type CreateWorkspaceRequest,
  type CreateWorkspaceResponse,
  type DeleteAttachmentFileResponse,
  type DeleteGroupResultsResponse,
  type DeleteGroupResultsBulkRequest,
  type DeleteGroupResultsBulkResponse,
  type DeleteParticipantReviewResponse,
  type DeleteReviewResponse,
  type DeleteSourcePackageRequest,
  type DeleteSourcePackageResponse,
  type DeleteSourcePackagesRequest,
  type DeleteSourcePackagesResponse,
  type DeleteSystemCheckReportsRequest,
  type DeleteSystemCheckReportsResponse,
  type DeleteWorkspaceRequest,
  type DeleteWorkspaceResponse,
  type DetailedResponseListQuery,
  type GetContentReleaseActivationReadinessResponse,
  type GetContentReleaseResponse,
  type GetAdminCurrentSessionResponse,
  type GetImportJobResponse,
  type GetParticipantSessionResponse,
  type ListDetailedResponsesResponse,
  type ListGroupResultsResponse,
  type ListReviewsResponse,
  type GetRuntimeConfigResponse,
  type GetRuntimeDiagnosticsResponse,
  type GetSystemTimeResponse,
  type GetApplicationSettingsResponse,
  type GetAttachmentResponse,
  type GetSystemCheckAccessResponse,
  type GetSourcePackageResponse,
  type GetSourcePackageDeletionReadinessResponse,
  type GetStudyMonitorBookletResponse,
  type GetStudyMonitorGroupResponse,
  type GetStudyMonitorParticipantResponse,
  type GetStudyMonitorParticipantMatrixResponse,
  type GetStudyMonitorRunResponse,
  type GetStudyMonitorUnitResponse,
  type GetStudyMonitorSummaryResponse,
  type GetWorkspaceOverviewResponse,
  type ImportParticipantRosterRequest,
  type ImportParticipantRosterResponse,
  type ImportSystemCheckReportRequest,
  type ImportSystemCheckReportResponse,
  type IssueMonitorRunCommandRequest,
  type IssueMonitorRunCommandResponse,
  type IssueMonitorRunCommandsRequest,
  type IssueMonitorRunCommandsResponse,
  type ListAdminAuditEventsResponse,
  type ListAdminSessionsResponse,
  type ListAttachmentsResponse,
  type ListWorkspaceActivityEventsResponse,
  type ListImportJobsResponse,
  type ListAdminUsersResponse,
  type ListTenantsResponse,
  type ListWorkspacesResponse,
  type ListParticipantRosterResponse,
  type ListParticipantReviewsResponse,
  type ListParticipantSessionsResponse,
  type ListParticipantTestLogsResponse,
  type ListContentReleasesResponse,
  type ListSourcePackagesResponse,
  type ListSystemChecksResponse,
  type GetSystemCheckResponse,
  type GetSystemCheckReportStatisticsResponse,
  type SaveSystemCheckReportRequest,
  type SaveSystemCheckReportResponse,
  type ListSystemCheckReportsResponse,
  MONITOR_EVENT_STREAM_SCHEMA_VERSION,
  type MonitorEventStreamEvent,
  PARTICIPANT_EVENT_STREAM_SCHEMA_VERSION,
  type ParticipantEventStreamEvent,
  type SystemCheckSpeedTestUploadResponse,
  type MonitorOpenRunsResponse,
  type MonitorOpenRunsQuery,
  type ParticipantCurrentRunStateResponse,
  type ParticipantLaunchRequest,
  type ParticipantLaunchResponse,
  type ParticipantReviewResponse,
  type ParticipantRuntimeStateResponse,
  type ResumeParticipantSessionRequest,
  type ResumeTestRunResponse,
  type ResumeParticipantSessionResponse,
  type ReturnTestRunToStarterRequest,
  type ReturnTestRunToStarterResponse,
  type RetrySourcePackageImportRequest,
  type RetrySourcePackageImportResponse,
  type ReplaceSourcePackageRequest,
  type ReplaceSourcePackageResponse,
  type ReviewResponse,
  type RuntimeOperationalEvent,
  type ResetAdminUserPasswordRequest,
  type ResetAdminUserPasswordResponse,
  type RevokeAdminRoleRequest,
  type RevokeAdminRoleResponse,
  type RevokeAdminSessionsRequest,
  type RevokeAdminSessionsResponse,
  type RevokeAdminSessionResponse,
  type SaveTestRunProgressRequest,
  type SaveTestRunProgressResponse,
  type SaveParticipantTestLogsRequest,
  type SaveParticipantTestLogsResponse,
  type SelectParticipantAdaptiveStateRequest,
  type SelectParticipantAdaptiveStateResponse,
  type SubmitBugReportRequest,
  type SubmitBugReportResponse,
  type UnlockParticipantTestletRequest,
  type UnlockParticipantTestletResponse,
  type ParticipantSignInRequest,
  type ParticipantSignInResponse,
  type UpdateAdminUserRequest,
  type UpdateAdminUserResponse,
  type UpdateApplicationSettingsRequest,
  type UpdateApplicationSettingsResponse,
  type UploadApplicationAssetRequest,
  type UploadApplicationAssetResponse,
  type ListApplicationAssetsResponse,
  type DeleteApplicationAssetResponse,
  type UploadAttachmentFileRequest,
  type UploadAttachmentFileResponse,
  type UpdateParticipantReviewRequest,
  type AdminSessionListQuery,
  type AdminUserListQuery,
  type AdminUserAccessStatus,
  type ContentReleaseListQuery,
  type ImportJobListQuery,
  type SourcePackageListQuery,
  type UpdateReviewRequest,
  type UpdateWorkspaceRequest,
  type UpdateWorkspaceResponse,
  type WorkspaceReviewListQuery,
  productionApiRoutes,
  type PublicAdminSession,
  type PublicAdminUser,
  type AdminUserDirectoryItem,
  redactBugReportText,
  resolveRoutePath
} from "@testcenter-rewrite-app/contracts";
import {
  type AdminRoleAssignment,
  type AdminRole,
  type AdminSession,
  type AdminSessionStatus,
  type AdminUser,
  type AdminUserStatus,
  type AdminAuditEvent,
  type AdminAuditEventType,
  type ContentReleaseStatus,
  type ImportJobStatus,
  type ParticipantSessionStatus,
  type SourcePackageStatus,
  type TestRunStatus,
  type WorkspaceFileType,
  type WorkspaceActivityEventType,
  type WorkspaceActivitySubjectType,
  adminAuditEventTypes,
  contentReleaseStatuses,
  importJobStatuses,
  participantSessionStatuses,
  sourcePackageStatuses,
  testRunStatuses,
  workspaceActivityEventTypes,
  workspaceActivitySubjectTypes,
  workspaceFileTypes,
  firstProductionSliceCapabilities
} from "@testcenter-rewrite-app/domain";
import {
  checkFileFirstSliceReadiness,
  createFileFirstSliceRepository
} from "@testcenter-rewrite-app/file-store";
import { createInMemoryFirstSliceRepository } from "@testcenter-rewrite-app/memory-store";
import {
  createPostgresFirstSliceStorage,
  POSTGRES_FIRST_SLICE_SCHEMA_VERSION
} from "@testcenter-rewrite-app/postgres-store";
import {
  checkSqliteFirstSliceReadiness,
  createSqliteFirstSliceRepository,
  SQLITE_FIRST_SLICE_SCHEMA_VERSION
} from "@testcenter-rewrite-app/sqlite-store";

import { createAttachmentPagesPdf } from "./attachment-pages-pdf.js";

type RuntimeStoreKind = "memory" | "file" | "sqlite" | "postgres";

type StudyMonitorParticipantMatrixQuery = {
  loginKey?: string;
  groupKey?: string;
  bookletKey?: string;
  unitKey?: string;
  testRunStatus?: TestRunStatus | "not_started";
  answerState?: "answered" | "missing";
  limit?: number;
};

const parseIntegerEnvironmentValue = (
  envKey: string,
  fallbackValue: number
): number => {
  const rawValue = process.env[envKey];
  if (rawValue == null || rawValue === "") {
    return fallbackValue;
  }

  const normalizedValue = rawValue.trim();
  if (!/^\d+$/.test(normalizedValue)) {
    throw new Error(`${envKey} must be a non-negative integer.`);
  }

  const parsedValue = Number.parseInt(normalizedValue, 10);
  if (!Number.isSafeInteger(parsedValue)) {
    throw new Error(`${envKey} must be a non-negative integer.`);
  }

  return parsedValue;
};

const parsePortEnvironmentValue = (
  envKey: string,
  fallbackValue: number
): number => {
  const parsedValue = parsePositiveIntegerEnvironmentValue(envKey, fallbackValue);
  if (parsedValue > 65_535) {
    throw new Error(`${envKey} must be between 1 and 65535.`);
  }

  return parsedValue;
};

const parsePositiveIntegerEnvironmentValue = (
  envKey: string,
  fallbackValue: number
): number => {
  const parsedValue = parseIntegerEnvironmentValue(envKey, fallbackValue);
  if (parsedValue < 1) {
    throw new Error(`${envKey} must be a positive integer.`);
  }

  return parsedValue;
};

const parseBooleanEnvironmentFlag = (
  envKey: string,
  fallbackValue = false
): boolean => {
  const rawValue = process.env[envKey];
  if (rawValue == null || rawValue === "") {
    return fallbackValue;
  }

  const normalizedValue = rawValue.trim().toLowerCase();
  if (["1", "true", "yes", "on", "required"].includes(normalizedValue)) {
    return true;
  }
  if (["0", "false", "no", "off", "optional"].includes(normalizedValue)) {
    return false;
  }

  throw new Error(
    `${envKey} must be a boolean flag like true/false, yes/no, on/off, or required/optional.`
  );
};

const resolveStoreKind = (): RuntimeStoreKind => {
  const store = process.env.FIRST_SLICE_STORE ?? "memory";
  if (store === "memory" || store === "file" || store === "sqlite" || store === "postgres") {
    return store;
  }
  throw new Error(
    `Unsupported FIRST_SLICE_STORE '${store}'. Supported values are memory, file, sqlite, postgres.`
  );
};

const localDemoBootstrap = {
  adminUsername: "demo-admin",
  adminPassword: "demo-admin-password",
  tenantKey: "demo-tenant",
  workspaceKey: "demo-workspace",
  participantLoginKey: "student-demo",
  sourceFileName: localDemoSourcePackage.fileName,
  sourceMediaType: localDemoSourcePackage.mediaType,
  sourceDocument: localDemoSourcePackage.sourceDocument
} as const;

const bootstrapLocalDemoState = async (input: {
  repository: FirstSliceRepository;
  services: FirstSliceServices;
}): Promise<void> => {
  const { repository, services } = input;
  const existingAdminUsers = await repository.listAdminUsers();
  if (existingAdminUsers.length === 0) {
    await services.adminAuth.bootstrapAdminUser({
      username: localDemoBootstrap.adminUsername,
      displayName: "Demo Platform Admin",
      password: localDemoBootstrap.adminPassword
    });
  }

  let tenant = await repository.getTenantByKey(localDemoBootstrap.tenantKey);
  if (!tenant) {
    tenant = await services.platform.createTenant({
      tenantKey: localDemoBootstrap.tenantKey,
      displayName: "Demo Tenant"
    });
  }

  let workspace = await repository.getWorkspaceByScope(
    localDemoBootstrap.tenantKey,
    localDemoBootstrap.workspaceKey
  );
  if (!workspace) {
    workspace = await services.platform.createWorkspace({
      tenantKey: localDemoBootstrap.tenantKey,
      workspaceKey: localDemoBootstrap.workspaceKey,
      displayName: "Demo Workspace"
    });
  }

  const existingParticipantRosterEntries =
    await repository.listParticipantRosterEntriesByWorkspace(
      tenant.tenantId,
      workspace.workspaceId
    );
  if (
    !existingParticipantRosterEntries.some(
      entry =>
        entry.loginKey.toLocaleLowerCase("en-US") ===
        localDemoBootstrap.participantLoginKey.toLocaleLowerCase("en-US")
    )
  ) {
    await services.workspaceAdminRead.importParticipantRoster({
      tenantKey: localDemoBootstrap.tenantKey,
      workspaceKey: localDemoBootstrap.workspaceKey,
      rosterText: [
        "loginKey,groupKey,groupLabel,bookletKey,displayName",
        `${localDemoBootstrap.participantLoginKey},group:student-demo,Demo Group,booklet:demo,Demo Student`
      ].join("\n")
    });
  }

  const existingReleases = await repository.listContentReleasesByWorkspace(
    tenant.tenantId,
    workspace.workspaceId
  );
  if (existingReleases.some(contentRelease => contentRelease.status === "active")) {
    return;
  }

  const sourcePackage = await services.contentIntake.createSourcePackage({
    tenantKey: localDemoBootstrap.tenantKey,
    workspaceKey: localDemoBootstrap.workspaceKey,
    fileName: localDemoBootstrap.sourceFileName,
    mediaType: localDemoBootstrap.sourceMediaType,
    sourceDocument: localDemoBootstrap.sourceDocument
  });
  const result = await services.createImportJobWithRelease({
    tenantKey: localDemoBootstrap.tenantKey,
    workspaceKey: localDemoBootstrap.workspaceKey,
    sourcePackageId: sourcePackage.sourcePackageId
  });

  if (result.stagedContentRelease) {
    await services.contentIntake.activateContentRelease({
      tenantKey: localDemoBootstrap.tenantKey,
      workspaceKey: localDemoBootstrap.workspaceKey,
      contentReleaseId: result.stagedContentRelease.contentReleaseId,
      activatedByActorId: "local-demo-bootstrap"
    });
  }
};

const createRepositoryFromEnvironment = async () => {
  const store = resolveStoreKind();

  if (store === "file") {
    const filePath =
      process.env.FIRST_SLICE_FILE ??
      fileURLToPath(new URL("../../../../.data/first-slice.json", import.meta.url));
    return {
      kind: "file" as const,
      repository: createFileFirstSliceRepository(filePath),
      location: filePath,
      schemaVersion: null,
      readinessCheck: () => checkFileFirstSliceReadiness(filePath),
      shutdown: async () => undefined
    };
  }

  if (store === "sqlite") {
    const filePath =
      process.env.FIRST_SLICE_SQLITE_FILE ??
      fileURLToPath(
        new URL("../../../../.data/first-slice.sqlite", import.meta.url)
      );
    return {
      kind: "sqlite" as const,
      repository: createSqliteFirstSliceRepository(filePath),
      location: filePath,
      schemaVersion: SQLITE_FIRST_SLICE_SCHEMA_VERSION,
      readinessCheck: () => checkSqliteFirstSliceReadiness(filePath),
      shutdown: async () => undefined
    };
  }

  if (store === "postgres") {
    const connectionString = process.env.FIRST_SLICE_POSTGRES_URL;
    if (!connectionString) {
      throw new Error(
        "FIRST_SLICE_POSTGRES_URL is required when FIRST_SLICE_STORE=postgres."
      );
    }
    const storage = await createPostgresFirstSliceStorage(connectionString);
    return {
      kind: "postgres" as const,
      repository: storage.repository,
      location: connectionString,
      schemaVersion: POSTGRES_FIRST_SLICE_SCHEMA_VERSION,
      readinessCheck: storage.readinessCheck,
      shutdown: storage.shutdown
    };
  }

  return {
    kind: "memory" as const,
    repository: createInMemoryFirstSliceRepository(),
    location: null,
    schemaVersion: null,
    readinessCheck: async () => undefined,
    shutdown: async () => undefined
  };
};

const createApiRuntime = async () => {
  const store = resolveStoreKind();
  const configuredPort = parsePortEnvironmentValue("PORT", 4310);
  const shutdownDrainDelayMs = parseIntegerEnvironmentValue(
    "SHUTDOWN_DRAIN_DELAY_MS",
    DEFAULT_SHUTDOWN_DRAIN_DELAY_MS
  );
  const maxJsonBodyBytes = parsePositiveIntegerEnvironmentValue(
    "FIRST_SLICE_MAX_JSON_BODY_BYTES",
    DEFAULT_MAX_JSON_BODY_BYTES
  );
  const maxSourcePackageJsonBodyBytes = parsePositiveIntegerEnvironmentValue(
    "FIRST_SLICE_MAX_SOURCE_PACKAGE_JSON_BODY_BYTES",
    DEFAULT_MAX_SOURCE_PACKAGE_JSON_BODY_BYTES
  );
  const httpHeadersTimeoutMs = parsePositiveIntegerEnvironmentValue(
    "HTTP_HEADERS_TIMEOUT_MS",
    DEFAULT_HTTP_HEADERS_TIMEOUT_MS
  );
  const httpRequestTimeoutMs = parsePositiveIntegerEnvironmentValue(
    "HTTP_REQUEST_TIMEOUT_MS",
    DEFAULT_HTTP_REQUEST_TIMEOUT_MS
  );
  const httpKeepAliveTimeoutMs = parsePositiveIntegerEnvironmentValue(
    "HTTP_KEEP_ALIVE_TIMEOUT_MS",
    DEFAULT_HTTP_KEEP_ALIVE_TIMEOUT_MS
  );
  const operatorAuthRequired = parseBooleanEnvironmentFlag(
    "FIRST_SLICE_OPERATOR_AUTH_REQUIRED",
    false
  );
  const adminLoginMaxFailures = parsePositiveIntegerEnvironmentValue(
    "FIRST_SLICE_ADMIN_LOGIN_MAX_FAILURES",
    DEFAULT_ADMIN_LOGIN_MAX_FAILURES
  );
  const adminLoginFailureWindowMs = parsePositiveIntegerEnvironmentValue(
    "FIRST_SLICE_ADMIN_LOGIN_FAILURE_WINDOW_MS",
    DEFAULT_ADMIN_LOGIN_FAILURE_WINDOW_MS
  );
  const participantLoginMaxFailures = parsePositiveIntegerEnvironmentValue(
    "FIRST_SLICE_PARTICIPANT_LOGIN_MAX_FAILURES",
    DEFAULT_PARTICIPANT_LOGIN_MAX_FAILURES
  );
  const participantLoginFailureWindowMs = parsePositiveIntegerEnvironmentValue(
    "FIRST_SLICE_PARTICIPANT_LOGIN_FAILURE_WINDOW_MS",
    DEFAULT_PARTICIPANT_LOGIN_FAILURE_WINDOW_MS
  );
  const participantAccessTimeZone =
    process.env.FIRST_SLICE_PARTICIPANT_TIME_ZONE?.trim() || "Europe/Berlin";
  const demoBootstrapEnabled = parseBooleanEnvironmentFlag(
    "FIRST_SLICE_BOOTSTRAP_DEMO",
    false
  );
  const bugReportGithubRepository =
    process.env.BUG_REPORT_GITHUB_REPOSITORY?.trim() || null;
  const bugReportGithubToken = process.env.BUG_REPORT_GITHUB_TOKEN?.trim() || null;
  if (
    bugReportGithubRepository &&
    !/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(bugReportGithubRepository)
  ) {
    throw new Error(
      "BUG_REPORT_GITHUB_REPOSITORY must use the 'owner/repository' format."
    );
  }
  const repositoryConfig = await createRepositoryFromEnvironment();
  const repository = repositoryConfig.repository;
  const services = createFirstSliceServices({
    repository,
    adminLoginMaxFailures,
    adminLoginFailureWindowMs,
    participantAccessTimeZone,
    participantLoginMaxFailures,
    participantLoginFailureWindowMs
  });

  if (demoBootstrapEnabled) {
    await bootstrapLocalDemoState({ repository, services });
  }

  return {
    config: {
      port: configuredPort,
      shutdownDrainDelayMs,
      maxJsonBodyBytes,
      maxSourcePackageJsonBodyBytes,
      httpTimeouts: {
        headersTimeoutMs: httpHeadersTimeoutMs,
        requestTimeoutMs: httpRequestTimeoutMs,
        keepAliveTimeoutMs: httpKeepAliveTimeoutMs
      },
      operatorAuthRequired,
      adminLoginProtection: {
        maxFailures: adminLoginMaxFailures,
        failureWindowMs: adminLoginFailureWindowMs
      },
      participantLoginProtection: {
        maxFailures: participantLoginMaxFailures,
        failureWindowMs: participantLoginFailureWindowMs
      },
      participantAccessTimeZone,
      environment: {
        firstSliceStore: store,
        firstSliceFilePresent: Boolean(process.env.FIRST_SLICE_FILE),
        firstSliceSqliteFilePresent: Boolean(process.env.FIRST_SLICE_SQLITE_FILE),
        firstSlicePostgresUrlPresent: Boolean(process.env.FIRST_SLICE_POSTGRES_URL),
        firstSliceMaxJsonBodyBytesPresent: Boolean(
          process.env.FIRST_SLICE_MAX_JSON_BODY_BYTES
        ),
        firstSliceMaxSourcePackageJsonBodyBytesPresent: Boolean(
          process.env.FIRST_SLICE_MAX_SOURCE_PACKAGE_JSON_BODY_BYTES
        ),
        firstSliceOperatorAuthRequired: operatorAuthRequired,
        firstSliceAdminLoginMaxFailuresPresent: Boolean(
          process.env.FIRST_SLICE_ADMIN_LOGIN_MAX_FAILURES
        ),
        firstSliceAdminLoginFailureWindowMsPresent: Boolean(
          process.env.FIRST_SLICE_ADMIN_LOGIN_FAILURE_WINDOW_MS
        ),
        firstSliceParticipantLoginMaxFailuresPresent: Boolean(
          process.env.FIRST_SLICE_PARTICIPANT_LOGIN_MAX_FAILURES
        ),
        firstSliceParticipantLoginFailureWindowMsPresent: Boolean(
          process.env.FIRST_SLICE_PARTICIPANT_LOGIN_FAILURE_WINDOW_MS
        ),
        firstSliceBootstrapDemo: demoBootstrapEnabled,
        httpHeadersTimeoutMsPresent: Boolean(process.env.HTTP_HEADERS_TIMEOUT_MS),
        httpRequestTimeoutMsPresent: Boolean(process.env.HTTP_REQUEST_TIMEOUT_MS),
        httpKeepAliveTimeoutMsPresent: Boolean(
          process.env.HTTP_KEEP_ALIVE_TIMEOUT_MS
        ),
        appBuildShaPresent: Boolean(process.env.APP_BUILD_SHA),
        appBuildTimestampPresent: Boolean(process.env.APP_BUILD_TIMESTAMP),
        bugReportGithubRepositoryPresent: Boolean(bugReportGithubRepository),
        bugReportGithubTokenPresent: Boolean(bugReportGithubToken)
      }
    },
    bugReport: {
      enabled: Boolean(bugReportGithubRepository && bugReportGithubToken),
      repository: bugReportGithubRepository,
      token: bugReportGithubToken,
      submissionWindows: new Map<string, BugReportSubmissionWindow>()
    },
    repositoryConfig,
    repository,
    services,
    metrics: createRuntimeMetrics(),
    recentOperationalEvents: [] as RuntimeOperationalEvent[],
    lifecycle: {
      phase: "running" as "running" | "draining",
      shutdownRequestedAt: null as string | null
    },
    build: {
      commitSha: process.env.APP_BUILD_SHA ?? null,
      builtAt: process.env.APP_BUILD_TIMESTAMP ?? null
    },
    shutdown: repositoryConfig.shutdown
  };
};

const redactStorageLocation = (input: string | null): string | null => {
  if (!input) {
    return input;
  }

  if (!/^postgres(?:ql)?:\/\//.test(input)) {
    return input;
  }

  try {
    const url = new URL(input);
    if (url.username) {
      url.username = "REDACTED";
    }
    if (url.password) {
      url.password = "REDACTED";
    }
    return url.toString();
  } catch {
    return input.replace(/\/\/([^:@/]+)(?::[^@/]+)?@/, "//REDACTED:REDACTED@");
  }
};

const describeProductionApi = (input: {
  storageKind: string;
  storageSchemaVersion: string | number | null;
  buildCommitSha: string | null;
  buildTimestamp: string | null;
}): string =>
  [
    "Testcenter Rewrite Production API Baseline",
    "workspace=rewrite-app/api",
    "phase=production-baseline",
    `storage=${input.storageKind}`,
    `storageSchemaVersion=${input.storageSchemaVersion ?? "n/a"}`,
    `buildCommitSha=${input.buildCommitSha ?? "n/a"}`,
    `buildTimestamp=${input.buildTimestamp ?? "n/a"}`,
    `routes=${Object.keys(productionApiRoutes).join(",")}`
  ].join("\n");

const jsonHeaders = {
  "content-type": "application/json; charset=utf-8"
};

const htmlHeaders = {
  "content-type": "text/html; charset=utf-8"
};

const textHeaders = {
  "content-type": "text/plain; version=0.0.4; charset=utf-8"
};

const securityHeaders = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "x-frame-options": "SAMEORIGIN",
  "permissions-policy": "camera=(self), geolocation=(), microphone=()"
};

// Sandboxed Verona players have an opaque origin and may legitimately embed
// participant-scoped runtimes or widgets. Keep the other defenses while
// allowing those resources to be framed by the player.
const participantResourceSecurityHeaders = {
  "x-content-type-options": "nosniff",
  "referrer-policy": "no-referrer",
  "permissions-policy": "camera=(self), geolocation=(), microphone=()"
};

const MAX_RUNTIME_OPERATIONAL_EVENTS = 100;
const DEFAULT_SHUTDOWN_DRAIN_DELAY_MS = 1_000;
const DEFAULT_MAX_JSON_BODY_BYTES = 1_048_576;
const MAX_APPLICATION_SETTINGS_JSON_BODY_BYTES = 28_100_000;
const DEFAULT_MAX_SOURCE_PACKAGE_JSON_BODY_BYTES = 72 * 1024 * 1024;
const DEFAULT_HTTP_HEADERS_TIMEOUT_MS = 60_000;
const DEFAULT_HTTP_REQUEST_TIMEOUT_MS = 120_000;
const DEFAULT_HTTP_KEEP_ALIVE_TIMEOUT_MS = 5_000;
const DEFAULT_ADMIN_LOGIN_MAX_FAILURES = 5;
const DEFAULT_ADMIN_LOGIN_FAILURE_WINDOW_MS = 30 * 60 * 1_000;
const DEFAULT_PARTICIPANT_LOGIN_MAX_FAILURES = 5;
const DEFAULT_PARTICIPANT_LOGIN_FAILURE_WINDOW_MS = 30 * 60 * 1_000;
const BUG_REPORT_SUBMISSION_WINDOW_MS = 10 * 60 * 1_000;
const BUG_REPORT_MAX_SUBMISSIONS_PER_WINDOW = 3;
const BUG_REPORT_MAX_CLIENT_WINDOWS = 10_000;
const BUG_REPORT_GITHUB_TIMEOUT_MS = 10_000;

type BugReportSubmissionWindow = {
  startedAt: number;
  count: number;
};

type RuntimeMetrics = {
  startedAt: string;
  activeRequests: number;
  totalRequests: number;
  completedRequests: number;
  requestCountsByMethod: Record<string, number>;
  requestCountsByRoute: Record<string, number>;
  responseCountsByStatusCode: Record<string, number>;
  requestLatencyByRoute: Record<string, RouteLatencySummary>;
  errorCounts: {
    firstSlice: number;
    invalidJson: number;
    requestBodyTooLarge: number;
    routeNotFound: number;
    storageNotReady: number;
    internal: number;
  };
};

type RouteLatencySummary = {
  count: number;
  totalMs: number;
  maxMs: number;
  bucketCounts: Record<string, number>;
};

const REQUEST_LATENCY_BUCKETS_MS = [5, 10, 25, 50, 100, 250, 500, 1_000, 2_500, 5_000];

const createRuntimeMetrics = (): RuntimeMetrics => ({
  startedAt: new Date().toISOString(),
  activeRequests: 0,
  totalRequests: 0,
  completedRequests: 0,
  requestCountsByMethod: {},
  requestCountsByRoute: {},
  responseCountsByStatusCode: {},
  requestLatencyByRoute: {},
  errorCounts: {
    firstSlice: 0,
    invalidJson: 0,
    requestBodyTooLarge: 0,
    routeNotFound: 0,
    storageNotReady: 0,
    internal: 0
  }
});

const appendRuntimeOperationalEvent = (
  target: RuntimeOperationalEvent[],
  event: RuntimeOperationalEvent
): void => {
  target.push(event);
  if (target.length > MAX_RUNTIME_OPERATIONAL_EVENTS) {
    target.splice(0, target.length - MAX_RUNTIME_OPERATIONAL_EVENTS);
  }
};

const incrementCounter = (
  counters: Record<string, number>,
  key: string | number
): void => {
  const normalizedKey = String(key);
  counters[normalizedKey] = (counters[normalizedKey] ?? 0) + 1;
};

const createRouteLatencySummary = (): RouteLatencySummary => ({
  count: 0,
  totalMs: 0,
  maxMs: 0,
  bucketCounts: {}
});

const recordRouteLatency = (
  metrics: RuntimeMetrics,
  route: string,
  durationMs: number
): void => {
  const summary =
    metrics.requestLatencyByRoute[route] ??
    (metrics.requestLatencyByRoute[route] = createRouteLatencySummary());
  summary.count += 1;
  summary.totalMs += durationMs;
  summary.maxMs = Math.max(summary.maxMs, durationMs);

  for (const bucket of REQUEST_LATENCY_BUCKETS_MS) {
    if (durationMs <= bucket) {
      incrementCounter(summary.bucketCounts, bucket);
    }
  }

  incrementCounter(summary.bucketCounts, "+Inf");
};

const getProcessMemorySnapshot = () => {
  const usage = process.memoryUsage();
  return {
    rssBytes: usage.rss,
    heapTotalBytes: usage.heapTotal,
    heapUsedBytes: usage.heapUsed,
    externalBytes: usage.external,
    arrayBuffersBytes: usage.arrayBuffers
  };
};

const escapePrometheusLabelValue = (value: string): string =>
  value.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n");

const logStructured = (
  level: "info" | "error",
  event: string,
  details: Record<string, unknown>
): void => {
  const line = JSON.stringify({
    timestamp: new Date().toISOString(),
    level,
    event,
    ...details
  });

  if (level === "error") {
    process.stderr.write(`${line}\n`);
    return;
  }

  process.stdout.write(`${line}\n`);
};

const recordRuntimeOperationalEvent = (
  runtime: Awaited<ReturnType<typeof createApiRuntime>>,
  level: "info" | "error",
  event: string,
  details: Record<string, unknown>
): void => {
  appendRuntimeOperationalEvent(runtime.recentOperationalEvents, {
    occurredAt: new Date().toISOString(),
    level,
    event,
    details
  });
  logStructured(level, event, details);
};

const renderPrometheusMetrics = (
  runtime: Awaited<ReturnType<typeof createApiRuntime>>
): string => {
  const metrics = runtime.metrics;
  const memory = getProcessMemorySnapshot();
  const lines: string[] = [
    "# HELP rewrite_app_uptime_seconds Process uptime in seconds.",
    "# TYPE rewrite_app_uptime_seconds gauge",
    `rewrite_app_uptime_seconds ${((Date.now() - Date.parse(metrics.startedAt)) / 1000).toFixed(3)}`,
    "# HELP rewrite_app_active_requests Active in-flight HTTP requests.",
    "# TYPE rewrite_app_active_requests gauge",
    `rewrite_app_active_requests ${metrics.activeRequests}`,
    "# HELP rewrite_app_total_requests Total HTTP requests seen by the process.",
    "# TYPE rewrite_app_total_requests counter",
    `rewrite_app_total_requests ${metrics.totalRequests}`,
    "# HELP rewrite_app_completed_requests Total completed HTTP requests.",
    "# TYPE rewrite_app_completed_requests counter",
    `rewrite_app_completed_requests ${metrics.completedRequests}`,
    "# HELP rewrite_app_process_resident_memory_bytes Resident process memory in bytes.",
    "# TYPE rewrite_app_process_resident_memory_bytes gauge",
    `rewrite_app_process_resident_memory_bytes ${memory.rssBytes}`,
    "# HELP rewrite_app_process_heap_total_bytes Total V8 heap allocation in bytes.",
    "# TYPE rewrite_app_process_heap_total_bytes gauge",
    `rewrite_app_process_heap_total_bytes ${memory.heapTotalBytes}`,
    "# HELP rewrite_app_process_heap_used_bytes Used V8 heap in bytes.",
    "# TYPE rewrite_app_process_heap_used_bytes gauge",
    `rewrite_app_process_heap_used_bytes ${memory.heapUsedBytes}`,
    "# HELP rewrite_app_process_external_memory_bytes External process memory in bytes.",
    "# TYPE rewrite_app_process_external_memory_bytes gauge",
    `rewrite_app_process_external_memory_bytes ${memory.externalBytes}`,
    "# HELP rewrite_app_build_info Build metadata for the running process.",
    "# TYPE rewrite_app_build_info gauge",
    `rewrite_app_build_info{storage_kind="${escapePrometheusLabelValue(runtime.repositoryConfig.kind)}",build_sha="${escapePrometheusLabelValue(runtime.build.commitSha ?? "unknown")}",build_timestamp="${escapePrometheusLabelValue(runtime.build.builtAt ?? "unknown")}"} 1`
  ];

  for (const [method, count] of Object.entries(metrics.requestCountsByMethod)) {
    lines.push(
      `rewrite_app_request_count_by_method{method="${escapePrometheusLabelValue(method)}"} ${count}`
    );
  }

  for (const [route, count] of Object.entries(metrics.requestCountsByRoute)) {
    lines.push(
      `rewrite_app_request_count_by_route{route="${escapePrometheusLabelValue(route)}"} ${count}`
    );
  }

  for (const [statusCode, count] of Object.entries(metrics.responseCountsByStatusCode)) {
    lines.push(
      `rewrite_app_response_count_by_status{status_code="${escapePrometheusLabelValue(statusCode)}"} ${count}`
    );
  }

  for (const [errorType, count] of Object.entries(metrics.errorCounts)) {
    lines.push(
      `rewrite_app_error_count{error_type="${escapePrometheusLabelValue(errorType)}"} ${count}`
    );
  }

  for (const [route, summary] of Object.entries(metrics.requestLatencyByRoute)) {
    const escapedRoute = escapePrometheusLabelValue(route);
    lines.push(
      `rewrite_app_request_duration_ms_count{route="${escapedRoute}"} ${summary.count}`
    );
    lines.push(
      `rewrite_app_request_duration_ms_sum{route="${escapedRoute}"} ${summary.totalMs.toFixed(3)}`
    );
    lines.push(
      `rewrite_app_request_duration_ms_max{route="${escapedRoute}"} ${summary.maxMs.toFixed(3)}`
    );

    for (const bucket of REQUEST_LATENCY_BUCKETS_MS) {
      lines.push(
        `rewrite_app_request_duration_ms_bucket{route="${escapedRoute}",le="${bucket}"} ${summary.bucketCounts[String(bucket)] ?? 0}`
      );
    }

    lines.push(
      `rewrite_app_request_duration_ms_bucket{route="${escapedRoute}",le="+Inf"} ${summary.bucketCounts["+Inf"] ?? 0}`
    );
  }

  return `${lines.join("\n")}\n`;
};

const sendJson = <T>(
  response: ServerResponse,
  statusCode: number,
  body: T
): void => {
  response.writeHead(statusCode, {
    ...securityHeaders,
    ...jsonHeaders
  });
  endResponse(response, JSON.stringify(body, null, 2));
};

const headResponses = new WeakSet<ServerResponse>();

const endResponse = (response: ServerResponse, body?: string | Buffer): void => {
  if (headResponses.has(response)) {
    response.end();
    return;
  }

  response.end(body);
};

const sendHtml = (
  response: ServerResponse,
  statusCode: number,
  html: string
): void => {
  response.writeHead(statusCode, {
    ...securityHeaders,
    ...htmlHeaders,
    "cache-control": "no-cache"
  });
  endResponse(response, html);
};

const sendText = (
  response: ServerResponse,
  statusCode: number,
  text: string
): void => {
  response.writeHead(statusCode, {
    ...securityHeaders,
    ...textHeaders
  });
  endResponse(response, text);
};

const sendCsv = (
  response: ServerResponse,
  statusCode: number,
  filename: string,
  text: string
): void => {
  response.writeHead(statusCode, {
    ...securityHeaders,
    "content-type": "text/csv; charset=utf-8",
    "content-disposition": `attachment; filename="${filename}"`,
    "cache-control": "no-cache"
  });
  endResponse(response, text);
};

const buildAttachmentContentDisposition = (filename: string): string => {
  const normalizedFileName = basename(filename)
    .replace(/[\u0000-\u001f\u007f/\\]/g, "_")
    .trim() || "download";
  const asciiFallback = normalizedFileName
    .normalize("NFKD")
    .replace(/[^\x20-\x7e]/g, "_")
    .replace(/["\\]/g, "_");
  const encodedFileName = encodeURIComponent(normalizedFileName).replace(
    /['()*]/g,
    character => `%${character.charCodeAt(0).toString(16).toUpperCase()}`
  );
  return `attachment; filename="${asciiFallback}"; filename*=UTF-8''${encodedFileName}`;
};

const sendAsset = (
  response: ServerResponse,
  statusCode: number,
  contentType: string,
  body: Buffer,
  additionalHeaders: Record<string, string> = {}
): void => {
  response.writeHead(statusCode, {
    ...securityHeaders,
    "content-type": contentType,
    "cache-control": "no-cache",
    ...additionalHeaders
  });
  endResponse(response, body);
};

const sendParticipantResourceAsset = (
  response: ServerResponse,
  statusCode: number,
  contentType: string,
  body: Buffer,
  additionalHeaders: Record<string, string> = {}
): void => {
  response.writeHead(statusCode, {
    ...participantResourceSecurityHeaders,
    "content-type": contentType,
    "cache-control": "no-cache",
    ...additionalHeaders
  });
  endResponse(response, body);
};

type ResolvedByteRange = {
  start: number;
  end: number;
};

const MAX_PARTICIPANT_RESOURCE_BYTE_RANGES = 16;

const resolveByteRanges = (
  rangeHeader: string,
  resourceSize: number
): ResolvedByteRange[] | null => {
  const match = /^bytes=(.+)$/i.exec(rangeHeader.trim());
  if (!match || resourceSize <= 0) {
    return null;
  }

  const rangeTexts = (match[1] ?? "").split(",");
  if (
    rangeTexts.length === 0 ||
    rangeTexts.length > MAX_PARTICIPANT_RESOURCE_BYTE_RANGES
  ) {
    return null;
  }

  const resourceSizeBigInt = BigInt(resourceSize);
  const ranges: ResolvedByteRange[] = [];
  for (const rangeText of rangeTexts) {
    const rangeMatch = /^(\d*)-(\d*)$/.exec(rangeText.trim());
    if (!rangeMatch) {
      return null;
    }

    const startText = rangeMatch[1] ?? "";
    const endText = rangeMatch[2] ?? "";
    if (!startText && !endText) {
      return null;
    }

    try {
      if (!startText) {
        const suffixLength = BigInt(endText);
        if (suffixLength <= 0n) {
          continue;
        }
        const boundedSuffixLength = suffixLength > resourceSizeBigInt
          ? resourceSizeBigInt
          : suffixLength;
        ranges.push({
          start: resourceSize - Number(boundedSuffixLength),
          end: resourceSize - 1
        });
        continue;
      }

      const start = BigInt(startText);
      if (start >= resourceSizeBigInt) {
        continue;
      }
      const requestedEnd = endText
        ? BigInt(endText)
        : resourceSizeBigInt - 1n;
      if (requestedEnd < start) {
        return null;
      }
      const end = requestedEnd >= resourceSizeBigInt
        ? resourceSizeBigInt - 1n
        : requestedEnd;
      ranges.push({
        start: Number(start),
        end: Number(end)
      });
    } catch {
      return null;
    }
  }

  return ranges.length > 0 ? ranges : null;
};

const createMultipartByteRangeBody = (input: {
  boundary: string;
  contentType: string;
  resourceBody: Buffer;
  byteRanges: ResolvedByteRange[];
}): Buffer => {
  const contentType = input.contentType.replace(/[\r\n]/g, "");
  const parts: Buffer[] = [];
  for (const byteRange of input.byteRanges) {
    parts.push(
      Buffer.from(
        `--${input.boundary}\r\n` +
          `Content-Type: ${contentType}\r\n` +
          `Content-Range: bytes ${byteRange.start}-${byteRange.end}/${input.resourceBody.byteLength}\r\n` +
          "\r\n",
        "utf8"
      ),
      input.resourceBody.subarray(byteRange.start, byteRange.end + 1),
      Buffer.from("\r\n", "utf8")
    );
  }
  parts.push(Buffer.from(`--${input.boundary}--\r\n`, "utf8"));
  return Buffer.concat(parts);
};

const sendRedirect = (
  response: ServerResponse,
  statusCode: 301 | 302 | 307 | 308,
  location: string
): void => {
  response.writeHead(statusCode, {
    ...securityHeaders,
    location,
    "cache-control": "no-cache"
  });
  endResponse(response);
};

const sendError = (
  response: ServerResponse,
  statusCode: number,
  error: string,
  message: string,
  details?: unknown
): void => {
  sendJson<ApiErrorResponse>(response, statusCode, { error, message, details });
};

const parseAdminUserListQuery = (
  url: URL,
  response: ServerResponse
): AdminUserListQuery | null => {
  const username = url.searchParams.get("username")?.trim() || undefined;
  const status = url.searchParams.get("status")?.trim() || undefined;
  if (status && status !== "active" && status !== "disabled") {
    sendError(
      response,
      400,
      "admin_user_status_invalid",
      `Admin user status '${status}' is not supported.`
    );
    return null;
  }

  const accessStatus =
    url.searchParams.get("accessStatus")?.trim() || undefined;
  if (
    accessStatus &&
    accessStatus !== "available" &&
    accessStatus !== "scheduled" &&
    accessStatus !== "expired"
  ) {
    sendError(
      response,
      400,
      "admin_access_status_invalid",
      `Admin access status '${accessStatus}' is not supported.`
    );
    return null;
  }

  const passwordChangeRequiredRaw =
    url.searchParams.get("passwordChangeRequired")?.trim() || undefined;
  if (
    passwordChangeRequiredRaw &&
    passwordChangeRequiredRaw !== "true" &&
    passwordChangeRequiredRaw !== "false"
  ) {
    sendError(
      response,
      400,
      "admin_password_change_required_filter_invalid",
      "passwordChangeRequired must be true or false when provided."
    );
    return null;
  }

  const role = url.searchParams.get("role")?.trim() || undefined;
  if (
    role &&
    role !== "platform_admin" &&
    role !== "tenant_admin" &&
    role !== "workspace_admin" &&
    role !== "study_monitor" &&
    role !== "group_monitor" &&
    role !== "system_check"
  ) {
    sendError(
      response,
      400,
      "admin_role_invalid",
      `Admin role '${role}' is not supported.`
    );
    return null;
  }

  const limitRawValue = url.searchParams.get("limit")?.trim() || undefined;
  const limit = limitRawValue ? Number.parseInt(limitRawValue, 10) : undefined;
  if (
    limitRawValue &&
    (!/^\d+$/.test(limitRawValue) || !limit || limit < 1 || limit > 500)
  ) {
    sendError(
      response,
      400,
      "admin_user_limit_invalid",
      "Admin user limit must be an integer between 1 and 500."
    );
    return null;
  }

  return {
    username,
    status: status as AdminUserStatus | undefined,
    accessStatus: accessStatus as AdminUserAccessStatus | undefined,
    passwordChangeRequired:
      passwordChangeRequiredRaw === undefined
        ? undefined
        : passwordChangeRequiredRaw === "true",
    role: role as AdminRole | undefined,
    tenantKey: url.searchParams.get("tenantKey")?.trim() || undefined,
    workspaceKey: url.searchParams.get("workspaceKey")?.trim() || undefined,
    limit
  };
};

const parseAdminSessionListQuery = (
  url: URL,
  response: ServerResponse
): AdminSessionListQuery | null => {
  const status = url.searchParams.get("status")?.trim() || undefined;
  if (
    status &&
    status !== "active" &&
    status !== "expired" &&
    status !== "revoked"
  ) {
    sendError(
      response,
      400,
      "admin_session_status_invalid",
      `Admin session status '${status}' is not supported.`
    );
    return null;
  }

  const limitRawValue = url.searchParams.get("limit")?.trim() || undefined;
  const limit = limitRawValue ? Number.parseInt(limitRawValue, 10) : undefined;
  if (
    limitRawValue &&
    (!/^\d+$/.test(limitRawValue) || !limit || limit < 1 || limit > 500)
  ) {
    sendError(
      response,
      400,
      "admin_session_limit_invalid",
      "Admin session limit must be an integer between 1 and 500."
    );
    return null;
  }

  return {
    adminUserId: url.searchParams.get("adminUserId")?.trim() || undefined,
    status: status as AdminSessionStatus | undefined,
    limit
  };
};

const parseAdminAuditEventListQuery = (
  url: URL,
  response: ServerResponse
): AdminAuditEventListQuery | null => {
  const eventType = url.searchParams.get("eventType")?.trim() || undefined;
  if (eventType && !adminAuditEventTypes.includes(eventType as AdminAuditEventType)) {
    sendError(
      response,
      400,
      "admin_audit_event_type_invalid",
      `Admin audit event type '${eventType}' is not supported.`
    );
    return null;
  }

  const limitRawValue = url.searchParams.get("limit")?.trim() || undefined;
  const limit = limitRawValue ? Number.parseInt(limitRawValue, 10) : undefined;
  if (
    limitRawValue &&
    (!/^\d+$/.test(limitRawValue) || !limit || limit < 1 || limit > 500)
  ) {
    sendError(
      response,
      400,
      "admin_audit_limit_invalid",
      "Admin audit limit must be an integer between 1 and 500."
    );
    return null;
  }

  return {
    eventType: eventType as AdminAuditEventType | undefined,
    actorAdminUserId:
      url.searchParams.get("actorAdminUserId")?.trim() || undefined,
    subjectAdminUserId:
      url.searchParams.get("subjectAdminUserId")?.trim() || undefined,
    limit
  };
};

const escapeCsvCell = (value: unknown): string => {
  if (value == null) {
    return "";
  }

  const text = typeof value === "string" ? value : JSON.stringify(value) ?? "";
  return `"${text.replace(/"/g, "\"\"")}"`;
};

const formatAdminAuditEventsCsv = (items: AdminAuditEvent[]): string => {
  const rows: unknown[][] = [
    [
      "adminAuditEventId",
      "eventType",
      "occurredAt",
      "actorAdminUserId",
      "subjectAdminUserId",
      "summary",
      "details"
    ]
  ];

  for (const item of items) {
    rows.push([
      item.adminAuditEventId,
      item.eventType,
      item.occurredAt,
      item.actorAdminUserId ?? "",
      item.subjectAdminUserId ?? "",
      item.summary,
      item.details
    ]);
  }

  return `${rows.map(row => row.map(escapeCsvCell).join(",")).join("\n")}\n`;
};

const formatAdminUsersCsv = (items: AdminUserDirectoryItem[]): string => {
  const rows: unknown[][] = [
    [
      "adminUserId",
      "username",
      "displayName",
      "status",
      "passwordChangeRequired",
      "validFrom",
      "validTo",
      "validForMinutes",
      "firstSignedInAt",
      "createdAt",
      "roleAssignments"
    ]
  ];

  for (const item of items) {
    rows.push([
      item.adminUser.adminUserId,
      item.adminUser.username,
      item.adminUser.displayName,
      item.adminUser.status,
      item.adminUser.passwordChangeRequired,
      item.adminUser.validFrom,
      item.adminUser.validTo,
      item.adminUser.validForMinutes,
      item.adminUser.firstSignedInAt,
      item.adminUser.createdAt,
      item.roleAssignments
    ]);
  }

  return `${rows.map(row => row.map(escapeCsvCell).join(",")).join("\n")}\n`;
};

const formatAdminSessionsCsv = (
  items: ListAdminSessionsResponse["items"]
): string => {
  const rows: unknown[][] = [
    [
      "adminSessionId",
      "adminUserId",
      "username",
      "displayName",
      "userStatus",
      "sessionStatus",
      "createdAt",
      "expiresAt",
      "revokedAt"
    ]
  ];

  for (const item of items) {
    rows.push([
      item.adminSession.adminSessionId,
      item.adminSession.adminUserId,
      item.adminUser.username,
      item.adminUser.displayName,
      item.adminUser.status,
      item.status,
      item.adminSession.createdAt,
      item.adminSession.expiresAt,
      item.adminSession.revokedAt
    ]);
  }

  return `${rows.map(row => row.map(escapeCsvCell).join(",")).join("\n")}\n`;
};

const toPublicAdminUser = (adminUser: AdminUser): PublicAdminUser => {
  return {
    adminUserId: adminUser.adminUserId,
    username: adminUser.username,
    displayName: adminUser.displayName,
    passwordChangeRequired: adminUser.passwordChangeRequired,
    status: adminUser.status,
    customTexts: { ...adminUser.customTexts },
    validFrom: adminUser.validFrom,
    validTo: adminUser.validTo,
    validForMinutes: adminUser.validForMinutes,
    firstSignedInAt: adminUser.firstSignedInAt,
    createdAt: adminUser.createdAt
  };
};

const toPublicAdminSession = (
  adminSession: AdminSession
): PublicAdminSession => {
  return {
    adminSessionId: adminSession.adminSessionId,
    adminUserId: adminSession.adminUserId,
    createdAt: adminSession.createdAt,
    expiresAt: adminSession.expiresAt,
    revokedAt: adminSession.revokedAt
  };
};

const toAdminUserDirectoryItem = (item: {
  adminUser: AdminUser;
  roleAssignments: AdminUserDirectoryItem["roleAssignments"];
}): AdminUserDirectoryItem => ({
  adminUser: toPublicAdminUser(item.adminUser),
  roleAssignments: item.roleAssignments
});

const toAdminSessionDirectoryItem = (item: {
  adminSession: AdminSession;
  adminUser: AdminUser;
  status: AdminSessionStatus;
}) => ({
  adminSession: toPublicAdminSession(item.adminSession),
  adminUser: toPublicAdminUser(item.adminUser),
  status: item.status
});

const readBearerToken = (request: IncomingMessage): string | null => {
  const authorization = request.headers.authorization;
  if (!authorization) {
    return null;
  }

  const [scheme, token] = authorization.trim().split(/\s+/);
  if (scheme?.toLowerCase() !== "bearer" || !token) {
    return null;
  }

  return token;
};

const requireBearerToken = (
  request: IncomingMessage,
  response: ServerResponse
): string | null => {
  const token = readBearerToken(request);
  if (!token) {
    sendError(
      response,
      401,
      "admin_session_missing",
      "Admin bearer session is required."
    );
    return null;
  }

  return token;
};

class RequestBodyTooLargeError extends Error {
  constructor(readonly maxJsonBodyBytes: number) {
    super(`Request body exceeds the configured ${maxJsonBodyBytes} byte limit.`);
    this.name = "RequestBodyTooLargeError";
  }
}

class InvalidMultipartBodyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidMultipartBodyError";
  }
}

type AttachmentUploadBody = {
  fileName: string;
  mediaType: string;
  dataBase64: string;
};

const readRequestBuffer = async (
  request: IncomingMessage,
  maxBytes: number
): Promise<Buffer> => {
  const contentLengthHeader = request.headers["content-length"];
  const contentLength =
    typeof contentLengthHeader === "string" && /^\d+$/.test(contentLengthHeader)
      ? Number.parseInt(contentLengthHeader, 10)
      : null;
  if (contentLength !== null && contentLength > maxBytes) {
    throw new RequestBodyTooLargeError(maxBytes);
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;
  for await (const chunk of request) {
    const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    totalBytes += buffer.byteLength;
    if (totalBytes > maxBytes) {
      throw new RequestBodyTooLargeError(maxBytes);
    }
    chunks.push(buffer);
  }
  return Buffer.concat(chunks);
};

const parseMultipartBoundary = (contentType: string): string => {
  const match = /(?:^|;)\s*boundary=(?:"([^"]+)"|([^;\s]+))/i.exec(contentType);
  const boundary = match?.[1] ?? match?.[2] ?? "";
  if (!boundary || boundary.length > 200 || /[\r\n]/.test(boundary)) {
    throw new InvalidMultipartBodyError(
      "Multipart attachment upload requires a valid boundary."
    );
  }
  return boundary;
};

const parseContentDispositionParameter = (
  disposition: string,
  parameter: string
): string | null => {
  const quoted = new RegExp(`${parameter}="([^"]*)"`, "i").exec(disposition);
  if (quoted) return quoted[1] ?? "";
  const bare = new RegExp(`${parameter}=([^;\\s]+)`, "i").exec(disposition);
  return bare?.[1] ?? null;
};

const readMultipartAttachmentUpload = async (
  request: IncomingMessage,
  contentType: string,
  maxBytes: number
): Promise<AttachmentUploadBody> => {
  const boundary = parseMultipartBoundary(contentType);
  const body = await readRequestBuffer(request, maxBytes);
  const boundaryMarker = Buffer.from(`--${boundary}`, "utf8");
  const nextBoundaryMarker = Buffer.from(`\r\n--${boundary}`, "utf8");
  let cursor = body.indexOf(boundaryMarker);
  let upload: AttachmentUploadBody | null = null;

  while (cursor >= 0) {
    cursor += boundaryMarker.byteLength;
    if (body.subarray(cursor, cursor + 2).equals(Buffer.from("--"))) break;
    if (!body.subarray(cursor, cursor + 2).equals(Buffer.from("\r\n"))) {
      throw new InvalidMultipartBodyError("Malformed multipart boundary.");
    }
    cursor += 2;
    const headerEnd = body.indexOf(Buffer.from("\r\n\r\n"), cursor);
    if (headerEnd < 0) {
      throw new InvalidMultipartBodyError("Malformed multipart part headers.");
    }
    const headers = body.subarray(cursor, headerEnd).toString("latin1");
    const contentDisposition = /^content-disposition:\s*(.+)$/im.exec(headers)?.[1];
    if (!contentDisposition) {
      throw new InvalidMultipartBodyError(
        "Multipart attachment part is missing Content-Disposition."
      );
    }
    const fieldName = parseContentDispositionParameter(
      contentDisposition,
      "name"
    );
    const fileName = parseContentDispositionParameter(
      contentDisposition,
      "filename"
    );
    const dataStart = headerEnd + 4;
    const nextBoundary = body.indexOf(nextBoundaryMarker, dataStart);
    if (nextBoundary < 0) {
      throw new InvalidMultipartBodyError("Multipart body is not terminated.");
    }

    if (fieldName === "attachment" && fileName !== null) {
      if (upload) {
        throw new InvalidMultipartBodyError(
          "Upload exactly one attachment file per request."
        );
      }
      const mediaType = /^content-type:\s*([^;\r\n]+)/im.exec(headers)?.[1];
      upload = {
        fileName,
        mediaType: mediaType?.trim() ?? "application/octet-stream",
        dataBase64: body.subarray(dataStart, nextBoundary).toString("base64")
      };
    }
    cursor = nextBoundary + 2;
  }

  if (!upload) {
    throw new InvalidMultipartBodyError(
      "Multipart attachment upload requires an 'attachment' file field."
    );
  }
  return upload;
};

const readJsonBody = async <T>(
  request: IncomingMessage,
  maxJsonBodyBytes: number
): Promise<T> => {
  const contentLengthHeader = request.headers["content-length"];
  const contentLength =
    typeof contentLengthHeader === "string" && /^\d+$/.test(contentLengthHeader)
      ? Number.parseInt(contentLengthHeader, 10)
      : null;
  if (contentLength !== null && contentLength > maxJsonBodyBytes) {
    throw new RequestBodyTooLargeError(maxJsonBodyBytes);
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    totalBytes += buffer.byteLength;
    if (totalBytes > maxJsonBodyBytes) {
      throw new RequestBodyTooLargeError(maxJsonBodyBytes);
    }
    chunks.push(buffer);
  }

  const payload = Buffer.concat(chunks).toString("utf8");
  return JSON.parse(payload) as T;
};

const readOptionalJsonBody = async <T>(
  request: IncomingMessage,
  maxJsonBodyBytes: number
): Promise<T | null> => {
  const contentLengthHeader = request.headers["content-length"];
  const contentLength =
    typeof contentLengthHeader === "string" && /^\d+$/.test(contentLengthHeader)
      ? Number.parseInt(contentLengthHeader, 10)
      : null;
  if (contentLength !== null && contentLength > maxJsonBodyBytes) {
    throw new RequestBodyTooLargeError(maxJsonBodyBytes);
  }
  if (contentLength === 0) {
    return null;
  }

  const chunks: Buffer[] = [];
  let totalBytes = 0;

  for await (const chunk of request) {
    const buffer = typeof chunk === "string" ? Buffer.from(chunk) : chunk;
    totalBytes += buffer.byteLength;
    if (totalBytes > maxJsonBodyBytes) {
      throw new RequestBodyTooLargeError(maxJsonBodyBytes);
    }
    chunks.push(buffer);
  }

  const payload = Buffer.concat(chunks).toString("utf8").trim();
  return payload ? (JSON.parse(payload) as T) : null;
};

const SYSTEM_CHECK_SPEED_TEST_MIN_BYTES = 16;
const SYSTEM_CHECK_SPEED_TEST_MAX_BYTES = 64 * 1024 * 1024;

const readRequestBodyByteLength = async (
  request: IncomingMessage,
  maxBytes: number
): Promise<number> => {
  const contentLengthHeader = request.headers["content-length"];
  const contentLength =
    typeof contentLengthHeader === "string" && /^\d+$/.test(contentLengthHeader)
      ? Number.parseInt(contentLengthHeader, 10)
      : null;
  if (contentLength !== null && contentLength > maxBytes) {
    throw new RequestBodyTooLargeError(maxBytes);
  }

  let totalBytes = 0;
  for await (const chunk of request) {
    totalBytes += Buffer.byteLength(chunk);
    if (totalBytes > maxBytes) {
      throw new RequestBodyTooLargeError(maxBytes);
    }
  }
  return totalBytes;
};

const sendSystemCheckSpeedTestPackage = async (
  response: ServerResponse,
  size: number
): Promise<void> => {
  response.writeHead(200, {
    ...securityHeaders,
    "content-type": "text/plain; charset=utf-8",
    "content-length": String(size),
    "content-transfer-encoding": "binary",
    "cache-control": "no-store, no-transform",
    "content-encoding": "identity"
  });
  const chunk = Buffer.alloc(Math.min(size, 64 * 1024), "a");
  let remaining = size;
  while (remaining > 0) {
    const nextChunk = remaining >= chunk.byteLength
      ? chunk
      : chunk.subarray(0, remaining);
    if (!response.write(nextChunk)) {
      await once(response, "drain");
    }
    remaining -= nextChunk.byteLength;
  }
  response.end();
};

const isFirstSliceError = (value: unknown): value is FirstSliceError =>
  value instanceof Error &&
  "statusCode" in value &&
  "errorCode" in value;

const createRoutePattern = (template: string): RegExp =>
  new RegExp(
    `^${template
      .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
      .replace(/:([A-Za-z0-9_]+)/g, "(?<$1>[^/]+)")}$`
  );

const adminUserUpdatePattern = createRoutePattern(
  productionApiRoutes.admin.updateUser
);
const adminUserResetPasswordPattern = createRoutePattern(
  productionApiRoutes.admin.resetPassword
);
const adminUserAssignRolePattern = createRoutePattern(
  productionApiRoutes.admin.assignRole
);
const adminUserRevokeRolePattern = createRoutePattern(
  productionApiRoutes.admin.revokeRole
);
const adminSessionRevokePattern = createRoutePattern(
  productionApiRoutes.admin.revokeSession
);
const workspaceCreatePattern = createRoutePattern(
  productionApiRoutes.workspace.createWorkspace
);
const workspaceDirectoryCsvExportPattern = createRoutePattern(
  productionApiRoutes.workspace.exportWorkspacesCsv
);
const workspaceOverviewPattern = createRoutePattern(
  productionApiRoutes.workspace.getWorkspaceOverview
);
const workspaceOverviewCsvExportPattern = createRoutePattern(
  productionApiRoutes.workspace.exportWorkspaceOverviewCsv
);
const studyMonitorSummaryPattern = createRoutePattern(
  productionApiRoutes.workspace.getStudyMonitorSummary
);
const studyMonitorParticipantMatrixPattern = createRoutePattern(
  productionApiRoutes.workspace.getStudyMonitorParticipantMatrix
);
const studyMonitorParticipantPattern = createRoutePattern(
  productionApiRoutes.workspace.getStudyMonitorParticipant
);
const studyMonitorGroupPattern = createRoutePattern(
  productionApiRoutes.workspace.getStudyMonitorGroup
);
const studyMonitorBookletPattern = createRoutePattern(
  productionApiRoutes.workspace.getStudyMonitorBooklet
);
const studyMonitorUnitPattern = createRoutePattern(
  productionApiRoutes.workspace.getStudyMonitorUnit
);
const studyMonitorRunPattern = createRoutePattern(
  productionApiRoutes.workspace.getStudyMonitorRun
);
const workspaceActivityEventListPattern = createRoutePattern(
  productionApiRoutes.workspace.listWorkspaceActivityEvents
);
const attachmentListPattern = createRoutePattern(
  productionApiRoutes.workspace.listAttachments
);
const attachmentPagesPdfPattern = createRoutePattern(
  productionApiRoutes.workspace.downloadAttachmentPagesPdf
);
const attachmentDetailPattern = createRoutePattern(
  productionApiRoutes.workspace.getAttachment
);
const attachmentPagePdfPattern = createRoutePattern(
  productionApiRoutes.workspace.downloadAttachmentPagePdf
);
const attachmentFileUploadPattern = createRoutePattern(
  productionApiRoutes.workspace.uploadAttachmentFile
);
const attachmentFileDetailPattern = createRoutePattern(
  productionApiRoutes.workspace.getAttachmentFile
);
const sourcePackageCreatePattern = createRoutePattern(
  productionApiRoutes.workspace.createSourcePackage
);
const sourcePackageAssemblyPattern = createRoutePattern(
  productionApiRoutes.workspace.assembleSourcePackages
);
const sourcePackageListPattern = createRoutePattern(
  productionApiRoutes.workspace.listSourcePackages
);
const sourcePackageDetailPattern = createRoutePattern(
  productionApiRoutes.workspace.getSourcePackage
);
const sourcePackageDownloadPattern = createRoutePattern(
  productionApiRoutes.workspace.downloadSourcePackage
);
const sourcePackageDeletionReadinessPattern = createRoutePattern(
  productionApiRoutes.workspace.getSourcePackageDeletionReadiness
);
const sourcePackageDeletePattern = createRoutePattern(
  productionApiRoutes.workspace.deleteSourcePackage
);
const sourcePackageBatchDeletePattern = createRoutePattern(
  productionApiRoutes.workspace.deleteSourcePackages
);
const sourcePackageReplacePattern = createRoutePattern(
  productionApiRoutes.workspace.replaceSourcePackage
);
const sourcePackageCsvExportPattern = createRoutePattern(
  productionApiRoutes.workspace.exportSourcePackagesCsv
);
const sourcePackageRetryImportPattern = createRoutePattern(
  productionApiRoutes.workspace.retrySourcePackageImport
);
const importJobCreatePattern = createRoutePattern(
  productionApiRoutes.workspace.createImportJob
);
const importJobListPattern = createRoutePattern(
  productionApiRoutes.workspace.listImportJobs
);
const importJobCsvExportPattern = createRoutePattern(
  productionApiRoutes.workspace.exportImportJobsCsv
);
const participantSessionListPattern = createRoutePattern(
  productionApiRoutes.workspace.listParticipantSessions
);
const participantSessionCsvExportPattern = createRoutePattern(
  productionApiRoutes.workspace.exportParticipantSessionsCsv
);
const participantSessionDetailPattern = createRoutePattern(
  productionApiRoutes.workspace.getParticipantSession
);
const participantRosterPattern = createRoutePattern(
  productionApiRoutes.workspace.listParticipantRoster
);
const participantRosterCsvExportPattern = createRoutePattern(
  productionApiRoutes.workspace.exportParticipantRosterCsv
);
const studyMonitorCsvExportPattern = createRoutePattern(
  productionApiRoutes.workspace.exportStudyMonitorCsv
);
const studyMonitorParticipantMatrixCsvExportPattern = createRoutePattern(
  productionApiRoutes.workspace.exportStudyMonitorParticipantMatrixCsv
);
const studyMonitorRunCsvExportPattern = createRoutePattern(
  productionApiRoutes.workspace.exportStudyMonitorRunCsv
);
const openRunsCsvExportPattern = createRoutePattern(
  productionApiRoutes.workspace.exportOpenRunsCsv
);
const responseCsvExportPattern = createRoutePattern(
  productionApiRoutes.workspace.exportResponseCsv
);
const originalResultArchiveExportPattern = createRoutePattern(
  productionApiRoutes.workspace.exportOriginalResultArchive
);
const logCsvExportPattern = createRoutePattern(
  productionApiRoutes.workspace.exportLogCsv
);
const activityCsvExportPattern = createRoutePattern(
  productionApiRoutes.workspace.exportActivityCsv
);
const participantTestLogListPattern = createRoutePattern(
  productionApiRoutes.workspace.listParticipantTestLogs
);
const reviewCsvExportPattern = createRoutePattern(
  productionApiRoutes.workspace.exportReviewCsv
);
const detailedResponsesPattern = createRoutePattern(
  productionApiRoutes.workspace.listDetailedResponses
);
const groupResultsPattern = createRoutePattern(
  productionApiRoutes.workspace.listGroupResults
);
const reviewListPattern = createRoutePattern(
  productionApiRoutes.workspace.listReviews
);
const reviewDetailPattern = createRoutePattern(
  productionApiRoutes.workspace.updateReview
);
const deleteGroupResultsPattern = createRoutePattern(
  productionApiRoutes.workspace.deleteGroupResults
);
const importJobDetailPattern = createRoutePattern(
  productionApiRoutes.workspace.getImportJob
);
const contentReleaseListPattern = createRoutePattern(
  productionApiRoutes.workspace.listContentReleases
);
const contentReleaseCsvExportPattern = createRoutePattern(
  productionApiRoutes.workspace.exportContentReleasesCsv
);
const contentReleaseDetailPattern = createRoutePattern(
  productionApiRoutes.workspace.getContentRelease
);
const contentReleaseActivationReadinessPattern = createRoutePattern(
  productionApiRoutes.workspace.getContentReleaseActivationReadiness
);
const contentReleaseActivatePattern = createRoutePattern(
  productionApiRoutes.workspace.activateContentRelease
);
const systemCheckListPattern = createRoutePattern(
  productionApiRoutes.workspace.listSystemChecks
);
const systemCheckDetailPattern = createRoutePattern(
  productionApiRoutes.workspace.getSystemCheck
);
const systemCheckReportSavePattern = createRoutePattern(
  productionApiRoutes.workspace.saveSystemCheckReport
);
const systemCheckReportListPattern = createRoutePattern(
  productionApiRoutes.workspace.listSystemCheckReports
);
const systemCheckReportStatisticsPattern = createRoutePattern(
  productionApiRoutes.workspace.getSystemCheckReportStatistics
);
const systemCheckReportImportPattern = createRoutePattern(
  productionApiRoutes.workspace.importSystemCheckReport
);
const systemCheckReportCsvExportPattern = createRoutePattern(
  productionApiRoutes.workspace.exportSystemCheckReportsCsv
);
const systemCheckReportJsonExportPattern = createRoutePattern(
  productionApiRoutes.workspace.exportSystemCheckReportsJson
);
const systemCheckSpeedTestDownloadPattern = createRoutePattern(
  productionApiRoutes.system.downloadSpeedTestPackage
);
const runtimeStatePattern = createRoutePattern(
  productionApiRoutes.participant.getRuntimeState
);
const currentRunStatePattern = createRoutePattern(
  productionApiRoutes.participant.getCurrentRunState
);
const participantEventStreamPattern = createRoutePattern(
  productionApiRoutes.participant.eventStream
);
const participantResourcePattern =
  /^\/api\/v1\/participant\/sessions\/(?<participantSessionId>[^/]+)\/resources\/(?<resourcePath>.+)$/;
const saveProgressPattern = createRoutePattern(
  productionApiRoutes.participant.saveProgress
);
const saveTestLogsPattern = createRoutePattern(
  productionApiRoutes.participant.saveTestLogs
);
const selectAdaptiveStatePattern = createRoutePattern(
  productionApiRoutes.participant.selectAdaptiveState
);
const participantReviewListPattern = createRoutePattern(
  productionApiRoutes.participant.listReviews
);
const participantReviewCsvExportPattern = createRoutePattern(
  productionApiRoutes.participant.exportReviewsCsv
);
const participantReviewDetailPattern = createRoutePattern(
  productionApiRoutes.participant.updateReview
);
const unlockTestletPattern = createRoutePattern(
  productionApiRoutes.participant.unlockTestlet
);
const resumeSessionPattern = createRoutePattern(
  productionApiRoutes.participant.resumeSession
);
const resumeRunPattern = createRoutePattern(
  productionApiRoutes.participant.resumeRun
);
const returnToStarterPattern = createRoutePattern(
  productionApiRoutes.participant.returnToStarter
);
const completeRunPattern = createRoutePattern(
  productionApiRoutes.participant.completeRun
);
const monitorOpenRunsPattern = createRoutePattern(
  productionApiRoutes.monitor.openRuns
);
const monitorEventStreamPattern = createRoutePattern(
  productionApiRoutes.monitor.eventStream
);
const monitorRunCommandPattern = createRoutePattern(
  productionApiRoutes.monitor.issueRunCommand
);
const monitorRunCommandsPattern = createRoutePattern(
  productionApiRoutes.monitor.issueRunCommands
);

type OperatorAccessScope =
  | { kind: "platform" }
  | { kind: "tenant"; tenantKey: string }
  | { kind: "workspace"; tenantKey: string; workspaceKey: string };

const workspaceScopedOperatorRouteChecks: Array<[string, RegExp]> = [
  ["GET", workspaceOverviewPattern],
  ["PATCH", workspaceOverviewPattern],
  ["GET", workspaceOverviewCsvExportPattern],
  ["GET", studyMonitorSummaryPattern],
  ["GET", studyMonitorParticipantMatrixPattern],
  ["GET", studyMonitorParticipantPattern],
  ["GET", studyMonitorGroupPattern],
  ["GET", studyMonitorBookletPattern],
  ["GET", studyMonitorUnitPattern],
  ["GET", studyMonitorRunPattern],
  ["GET", workspaceActivityEventListPattern],
  ["GET", attachmentListPattern],
  ["GET", attachmentPagesPdfPattern],
  ["GET", attachmentDetailPattern],
  ["GET", attachmentPagePdfPattern],
  ["POST", attachmentFileUploadPattern],
  ["GET", attachmentFileDetailPattern],
  ["DELETE", attachmentFileDetailPattern],
  ["POST", sourcePackageCreatePattern],
  ["POST", sourcePackageAssemblyPattern],
  ["GET", sourcePackageListPattern],
  ["GET", sourcePackageDetailPattern],
  ["GET", sourcePackageDownloadPattern],
  ["GET", sourcePackageDeletionReadinessPattern],
  ["DELETE", sourcePackageDeletePattern],
  ["POST", sourcePackageBatchDeletePattern],
  ["POST", sourcePackageReplacePattern],
  ["GET", sourcePackageCsvExportPattern],
  ["POST", sourcePackageRetryImportPattern],
  ["POST", importJobCreatePattern],
  ["GET", importJobListPattern],
  ["GET", importJobDetailPattern],
  ["GET", importJobCsvExportPattern],
  ["GET", contentReleaseCsvExportPattern],
  ["GET", participantSessionListPattern],
  ["GET", participantSessionCsvExportPattern],
  ["GET", participantSessionDetailPattern],
  ["GET", participantRosterPattern],
  ["POST", participantRosterPattern],
  ["GET", participantRosterCsvExportPattern],
  ["GET", studyMonitorCsvExportPattern],
  ["GET", studyMonitorParticipantMatrixCsvExportPattern],
  ["GET", studyMonitorRunCsvExportPattern],
  ["GET", openRunsCsvExportPattern],
  ["GET", detailedResponsesPattern],
  ["GET", groupResultsPattern],
  ["DELETE", groupResultsPattern],
  ["GET", reviewListPattern],
  ["POST", reviewListPattern],
  ["PATCH", reviewDetailPattern],
  ["DELETE", reviewDetailPattern],
  ["DELETE", deleteGroupResultsPattern],
  ["GET", responseCsvExportPattern],
  ["GET", originalResultArchiveExportPattern],
  ["GET", logCsvExportPattern],
  ["GET", activityCsvExportPattern],
  ["GET", participantTestLogListPattern],
  ["GET", reviewCsvExportPattern],
  ["GET", contentReleaseListPattern],
  ["GET", contentReleaseDetailPattern],
  ["GET", contentReleaseActivationReadinessPattern],
  ["POST", contentReleaseActivatePattern],
  ["GET", systemCheckReportListPattern],
  ["GET", systemCheckReportStatisticsPattern],
  ["DELETE", systemCheckReportListPattern],
  ["POST", systemCheckReportImportPattern],
  ["GET", systemCheckReportCsvExportPattern],
  ["GET", systemCheckReportJsonExportPattern],
  ["GET", monitorOpenRunsPattern],
  ["GET", monitorEventStreamPattern],
  ["POST", monitorRunCommandsPattern],
  ["POST", monitorRunCommandPattern]
];

const isOperatorApiRequest = (method: string, pathname: string): boolean => {
  return resolveOperatorAccessScope(method, pathname) !== null;
};

const resolveOperatorAccessScope = (
  method: string,
  pathname: string
): OperatorAccessScope | null => {
  if (method === "POST" && pathname === productionApiRoutes.platform.createTenant) {
    return { kind: "platform" };
  }

  if (method === "GET" && pathname === productionApiRoutes.platform.listTenants) {
    return { kind: "platform" };
  }

  if (method === "GET" && pathname === productionApiRoutes.platform.exportTenantsCsv) {
    return { kind: "platform" };
  }

  const workspaceDeleteMatch = workspaceOverviewPattern.exec(pathname);
  if (method === "DELETE" && workspaceDeleteMatch?.groups) {
    return { kind: "platform" };
  }

  const workspaceCreateMatch = workspaceCreatePattern.exec(pathname);
  if ((method === "POST" || method === "GET") && workspaceCreateMatch?.groups) {
    const tenantKey = decodeRouteGroup(workspaceCreateMatch.groups.tenantKey);
    return tenantKey ? { kind: "tenant", tenantKey } : null;
  }

  const workspaceDirectoryCsvExportMatch =
    workspaceDirectoryCsvExportPattern.exec(pathname);
  if (method === "GET" && workspaceDirectoryCsvExportMatch?.groups) {
    const tenantKey = decodeRouteGroup(
      workspaceDirectoryCsvExportMatch.groups.tenantKey
    );
    return tenantKey ? { kind: "tenant", tenantKey } : null;
  }

  for (const [expectedMethod, pattern] of workspaceScopedOperatorRouteChecks) {
    const match = pattern.exec(pathname);
    if (method !== expectedMethod || !match?.groups) {
      continue;
    }

    const tenantKey = decodeRouteGroup(match.groups.tenantKey);
    const workspaceKey = decodeRouteGroup(match.groups.workspaceKey);
    if (!tenantKey || !workspaceKey) {
      return null;
    }

    return { kind: "workspace", tenantKey, workspaceKey };
  }

  return null;
};

const resolveOperatorAdminAccess = async (
  repository: FirstSliceRepository,
  roleAssignments: AdminRoleAssignment[],
  scope: OperatorAccessScope
): Promise<AdminRoleAssignment["accessMode"] | null> => {
  if (roleAssignments.some(roleAssignment => roleAssignment.role === "platform_admin")) {
    return "read_write";
  }

  if (scope.kind === "platform") {
    return null;
  }

  const tenant = await repository.getTenantByKey(scope.tenantKey);
  if (!tenant) {
    return null;
  }

  if (
    roleAssignments.some(
      roleAssignment =>
        roleAssignment.role === "tenant_admin" &&
        roleAssignment.tenantId === tenant.tenantId
    )
  ) {
    return "read_write";
  }

  if (scope.kind === "tenant") {
    return null;
  }

  const workspace = await repository.getWorkspaceByScope(
    scope.tenantKey,
    scope.workspaceKey
  );
  if (!workspace) {
    return null;
  }

  const workspaceAdminAssignments = roleAssignments.filter(
    roleAssignment =>
      roleAssignment.role === "workspace_admin" &&
      roleAssignment.workspaceId === workspace.workspaceId
  );
  if (
    workspaceAdminAssignments.some(
      roleAssignment => roleAssignment.accessMode !== "read_only"
    )
  ) {
    return "read_write";
  }
  return workspaceAdminAssignments.length > 0 ? "read_only" : null;
};

const hasSystemCheckAccess = async (input: {
  repository: FirstSliceRepository;
  roleAssignments: AdminRoleAssignment[];
  tenantKey: string;
  workspaceKey: string;
}): Promise<boolean> => {
  const workspace = await input.repository.getWorkspaceByScope(
    input.tenantKey,
    input.workspaceKey
  );
  return Boolean(
    workspace &&
      input.roleAssignments.some(
        roleAssignment =>
          roleAssignment.role === "system_check" &&
          roleAssignment.workspaceId === workspace.workspaceId
      )
  );
};

const listSystemCheckRoleAssignments = async (
  repository: FirstSliceRepository
): Promise<AdminRoleAssignment[]> => {
  const adminUsers = await repository.listAdminUsers();
  const roleAssignments = await Promise.all(
    adminUsers.map(adminUser =>
      repository.listAdminRoleAssignmentsByUserId(adminUser.adminUserId)
    )
  );
  return roleAssignments
    .flat()
    .filter(roleAssignment => roleAssignment.role === "system_check");
};

const resolveSystemCheckAuthorizedScopes = async (
  repository: FirstSliceRepository,
  roleAssignments: AdminRoleAssignment[]
): Promise<GetSystemCheckAccessResponse["authorizedScopes"]> => {
  const tenants = await repository.listTenants();
  const workspacesByTenant = await Promise.all(
    tenants.map(async tenant => ({
      tenant,
      workspaces: await repository.listWorkspacesByTenantId(tenant.tenantId)
    }))
  );
  const scopes = new Map<string, GetSystemCheckAccessResponse["authorizedScopes"][number]>();
  for (const roleAssignment of roleAssignments) {
    if (!roleAssignment.tenantId || !roleAssignment.workspaceId) {
      continue;
    }
    const tenantEntry = workspacesByTenant.find(
      entry => entry.tenant.tenantId === roleAssignment.tenantId
    );
    const workspace = tenantEntry?.workspaces.find(
      item => item.workspaceId === roleAssignment.workspaceId
    );
    if (!tenantEntry || !workspace) {
      continue;
    }
    const scope = {
      tenantKey: tenantEntry.tenant.tenantKey,
      workspaceKey: workspace.workspaceKey
    };
    scopes.set(`${scope.tenantKey}\u0000${scope.workspaceKey}`, scope);
  }
  return Array.from(scopes.values()).sort(
    (left, right) =>
      left.tenantKey.localeCompare(right.tenantKey) ||
      left.workspaceKey.localeCompare(right.workspaceKey)
  );
};

type MonitorRouteScope =
  | { kind: "workspace_monitor" }
  | { kind: "study_workspace" }
  | { kind: "study_group"; groupKey: string };

type MonitorOperatorAccess =
  | { kind: "full" }
  | { kind: "groups"; groupKeys: string[] };

const monitorOperatorAccessByRequest = new WeakMap<
  IncomingMessage,
  MonitorOperatorAccess
>();
const operatorAdminUserIdByRequest = new WeakMap<IncomingMessage, string>();

const workspaceMonitorRouteChecks: Array<[string, RegExp]> = [
  ["GET", attachmentListPattern],
  ["GET", attachmentPagesPdfPattern],
  ["GET", attachmentDetailPattern],
  ["GET", attachmentPagePdfPattern],
  ["POST", attachmentFileUploadPattern],
  ["GET", attachmentFileDetailPattern],
  ["DELETE", attachmentFileDetailPattern],
  ["GET", openRunsCsvExportPattern],
  ["GET", monitorOpenRunsPattern],
  ["GET", monitorEventStreamPattern],
  ["POST", monitorRunCommandsPattern],
  ["POST", monitorRunCommandPattern]
];

const studyMonitorRouteChecks: Array<[string, RegExp]> = [
  ["GET", studyMonitorSummaryPattern],
  ["GET", studyMonitorParticipantMatrixPattern],
  ["GET", studyMonitorParticipantPattern],
  ["GET", studyMonitorGroupPattern],
  ["GET", studyMonitorBookletPattern],
  ["GET", studyMonitorUnitPattern],
  ["GET", studyMonitorRunPattern],
  ["GET", studyMonitorCsvExportPattern],
  ["GET", studyMonitorParticipantMatrixCsvExportPattern],
  ["GET", studyMonitorRunCsvExportPattern]
];

const resolveMonitorRouteScope = (
  method: string,
  pathname: string
): MonitorRouteScope | null => {
  for (const [expectedMethod, pattern] of workspaceMonitorRouteChecks) {
    if (method === expectedMethod && pattern.test(pathname)) {
      return { kind: "workspace_monitor" };
    }
  }

  if (method === "GET") {
    const groupMatch = studyMonitorGroupPattern.exec(pathname);
    const groupKey = groupMatch?.groups
      ? decodeRouteGroup(groupMatch.groups.groupKey)
      : null;
    if (groupKey) {
      return { kind: "study_group", groupKey };
    }
  }

  for (const [expectedMethod, pattern] of studyMonitorRouteChecks) {
    if (method === expectedMethod && pattern.test(pathname)) {
      return { kind: "study_workspace" };
    }
  }

  return null;
};

const resolveMonitorOperatorAccess = async (input: {
  repository: FirstSliceRepository;
  roleAssignments: AdminRoleAssignment[];
  tenantKey: string;
  workspaceKey: string;
  routeScope: MonitorRouteScope;
}): Promise<MonitorOperatorAccess | null> => {
  const workspace = await input.repository.getWorkspaceByScope(
    input.tenantKey,
    input.workspaceKey
  );
  if (!workspace) {
    return null;
  }

  if (
    input.roleAssignments.some(
      assignment =>
        assignment.role === "study_monitor" &&
        assignment.workspaceId === workspace.workspaceId
    )
  ) {
    return { kind: "full" };
  }

  const groupKeys = [
    ...new Set(
      input.roleAssignments
        .filter(
          assignment =>
            assignment.role === "group_monitor" &&
            assignment.workspaceId === workspace.workspaceId &&
            assignment.groupKey
        )
        .map(assignment => assignment.groupKey as string)
    )
  ];
  if (groupKeys.length === 0) {
    return null;
  }
  if (
    input.routeScope.kind === "study_group" &&
    !groupKeys.includes(input.routeScope.groupKey)
  ) {
    return null;
  }
  if (input.routeScope.kind === "study_workspace") {
    return null;
  }

  return { kind: "groups", groupKeys };
};

const getMonitorGroupKeys = (request: IncomingMessage): string[] | undefined => {
  const access = monitorOperatorAccessByRequest.get(request);
  return access?.kind === "groups" ? access.groupKeys : undefined;
};

const canAccessMonitorRuns = async (input: {
  repository: FirstSliceRepository;
  tenantKey: string;
  workspaceKey: string;
  testRunIds: string[];
  groupKeys?: string[];
}): Promise<boolean> => {
  if (!input.groupKeys) {
    return true;
  }
  const workspace = await input.repository.getWorkspaceByScope(
    input.tenantKey,
    input.workspaceKey
  );
  if (!workspace) {
    return false;
  }

  for (const testRunId of input.testRunIds) {
    const testRun = await input.repository.getTestRunById(testRunId);
    if (
      !testRun ||
      testRun.tenantId !== workspace.tenantId ||
      testRun.workspaceId !== workspace.workspaceId
    ) {
      return false;
    }
    const participantSession = await input.repository.getParticipantSessionById(
      testRun.participantSessionId
    );
    if (!participantSession || !input.groupKeys.includes(participantSession.groupKey)) {
      return false;
    }
  }

  return true;
};

const describeOperatorAccessScope = (scope: OperatorAccessScope): string => {
  if (scope.kind === "platform") {
    return "platform";
  }

  if (scope.kind === "tenant") {
    return `tenant:${scope.tenantKey}`;
  }

  return `workspace:${scope.tenantKey}/${scope.workspaceKey}`;
};

const frontendBuildDirectoryCandidates = [
  resolve(process.cwd(), "dist/apps/web/browser"),
  fileURLToPath(
    new URL("../../../../../../dist/apps/web/browser", import.meta.url)
  )
];

const resolveFrontendBuildDirectory = (): string => {
  const existingCandidate = frontendBuildDirectoryCandidates.find(candidate =>
    existsSync(candidate)
  );
  return existingCandidate ?? frontendBuildDirectoryCandidates[0];
};

const frontendBuildDirectory = resolveFrontendBuildDirectory();
const frontendIndexPath = resolve(frontendBuildDirectory, "index.html");

const isParticipantEntryPath = (pathname: string): boolean =>
  pathname === "/participant" || pathname === "/participant/";

const isSystemCheckEntryPath = (pathname: string): boolean =>
  pathname === "/system-check" || pathname === "/system-check/";

const resolveFrontendContentType = (pathname: string): string => {
  switch (extname(pathname)) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
    case ".webmanifest":
      return "application/manifest+json; charset=utf-8";
    case ".map":
      return "application/json; charset=utf-8";
    case ".ico":
      return "image/x-icon";
    case ".svg":
      return "image/svg+xml";
    case ".png":
      return "image/png";
    case ".jpg":
    case ".jpeg":
      return "image/jpeg";
    case ".woff2":
      return "font/woff2";
    default:
      return "application/octet-stream";
  }
};

const serveFrontendRequest = async (
  response: ServerResponse,
  pathname: string
): Promise<boolean> => {
  if (!(pathname === "/" || pathname === "/app" || pathname.startsWith("/app/"))) {
    return false;
  }

  if (!existsSync(frontendBuildDirectory) || !existsSync(frontendIndexPath)) {
    sendError(
      response,
      503,
      "frontend_not_built",
      "Angular frontend assets are not available. Run the frontend build first.",
      {
        expectedDirectory: frontendBuildDirectory
      }
    );
    return true;
  }

  const relativePath =
    pathname === "/" || pathname === "/app"
      ? ""
      : pathname.replace(/^\/app\/?/, "");

  if (relativePath === "" || !relativePath.includes(".")) {
    const html = await readFile(frontendIndexPath, "utf8");
    sendHtml(response, 200, html);
    return true;
  }

  const candidatePath = resolve(frontendBuildDirectory, relativePath);
  const candidateRelativePath = relative(frontendBuildDirectory, candidatePath);
  if (candidateRelativePath.startsWith("..")) {
    sendError(response, 404, "not_found", "Frontend asset not found.");
    return true;
  }

  try {
    const assetStat = await stat(candidatePath);
    if (!assetStat.isFile()) {
      throw new Error("Not a file");
    }
    const body = await readFile(candidatePath);
    const isServiceWorker = relativePath === "service-worker.js";
    const isHashedAsset = /(?:^|\/)(?:chunk|main|styles)-[a-z0-9]+\.(?:css|js)$/i.test(
      relativePath
    );
    sendAsset(response, 200, resolveFrontendContentType(candidatePath), body, {
      "cache-control": isServiceWorker
        ? "no-cache, no-store, must-revalidate"
        : isHashedAsset
          ? "public, max-age=31536000, immutable"
          : "no-cache",
      ...(isServiceWorker ? { "service-worker-allowed": "/app/" } : {})
    });
  } catch {
    sendError(response, 404, "not_found", "Frontend asset not found.", {
      assetPath: relativePath
    });
  }

  return true;
};

const validateBugReportRequest = (
  body: unknown
): SubmitBugReportRequest | null => {
  if (!body || typeof body !== "object") {
    return null;
  }
  const candidate = body as Partial<SubmitBugReportRequest>;
  const title = typeof candidate.title === "string" ? candidate.title.trim() : "";
  const tag = typeof candidate.tag === "string" ? candidate.tag.trim() : "";
  const report =
    typeof candidate.report === "string" ? candidate.report.trim() : "";
  if (
    !title ||
    title.length > BUG_REPORT_MAX_TITLE_LENGTH ||
    /[\r\n]/.test(title) ||
    !tag ||
    tag.length > BUG_REPORT_MAX_TAG_LENGTH ||
    !/^[\p{L}\p{N} ._-]+$/u.test(tag) ||
    !report ||
    report.length > BUG_REPORT_MAX_REPORT_LENGTH
  ) {
    return null;
  }
  return { title, tag, report };
};

const consumeBugReportSubmission = (
  windows: Map<string, BugReportSubmissionWindow>,
  clientKey: string,
  now = Date.now()
): number | null => {
  const current = windows.get(clientKey);
  if (!current || now - current.startedAt >= BUG_REPORT_SUBMISSION_WINDOW_MS) {
    if (!current && windows.size >= BUG_REPORT_MAX_CLIENT_WINDOWS) {
      for (const [key, window] of windows) {
        if (now - window.startedAt >= BUG_REPORT_SUBMISSION_WINDOW_MS) {
          windows.delete(key);
        }
      }
      if (windows.size >= BUG_REPORT_MAX_CLIENT_WINDOWS) {
        return Math.ceil(BUG_REPORT_SUBMISSION_WINDOW_MS / 1_000);
      }
    }
    windows.set(clientKey, { startedAt: now, count: 1 });
    return null;
  }
  if (current.count >= BUG_REPORT_MAX_SUBMISSIONS_PER_WINDOW) {
    return Math.max(
      1,
      Math.ceil((current.startedAt + BUG_REPORT_SUBMISSION_WINDOW_MS - now) / 1_000)
    );
  }
  current.count += 1;
  return null;
};

const publishBugReport = async (input: {
  repository: string;
  token: string;
  request: SubmitBugReportRequest;
}): Promise<string> => {
  const githubResponse = await fetch(
    `https://api.github.com/repos/${input.repository}/issues`,
    {
      method: "POST",
      headers: {
        Accept: "application/vnd.github+json",
        Authorization: `Bearer ${input.token}`,
        "Content-Type": "application/json",
        "User-Agent": "testcenter-rewrite",
        "X-GitHub-Api-Version": "2022-11-28"
      },
      body: JSON.stringify({
        title: input.request.title,
        body: redactBugReportText(input.request.report),
        labels: ["Testcenter", input.request.tag]
      }),
      signal: AbortSignal.timeout(BUG_REPORT_GITHUB_TIMEOUT_MS)
    }
  );
  const payload = await githubResponse.json() as { html_url?: unknown };
  if (!githubResponse.ok || typeof payload.html_url !== "string") {
    throw new Error(`GitHub issue creation failed with HTTP ${githubResponse.status}.`);
  }
  return payload.html_url;
};

const resolveMetricsRouteLabel = (method: string, pathname: string): string => {
  if (method === "GET" && (pathname === "/" || pathname === "/app")) {
    return "GET /app";
  }

  if (method === "GET" && pathname.startsWith("/app/")) {
    return "GET /app/*";
  }

  if (method === "GET" && isParticipantEntryPath(pathname)) {
    return "GET /participant";
  }

  if (method === "GET" && isSystemCheckEntryPath(pathname)) {
    return "GET /system-check";
  }

  if (method === "GET" && pathname === "/healthz") {
    return "GET /healthz";
  }

  if (method === "GET" && pathname === "/readyz") {
    return "GET /readyz";
  }

  if (method === "GET" && pathname === "/metrics") {
    return "GET /metrics";
  }

  if (method === "GET" && pathname === "/metrics/prometheus") {
    return "GET /metrics/prometheus";
  }

  if (method === "GET" && pathname === productionApiRoutes.system.getRuntimeDiagnostics) {
    return `GET ${productionApiRoutes.system.getRuntimeDiagnostics}`;
  }

  if (method === "GET" && pathname === productionApiRoutes.system.getRuntimeConfig) {
    return `GET ${productionApiRoutes.system.getRuntimeConfig}`;
  }

  if (method === "GET" && pathname === productionApiRoutes.system.getTime) {
    return `GET ${productionApiRoutes.system.getTime}`;
  }

  if (
    method === "GET" &&
    pathname === productionApiRoutes.system.getBugReportConfig
  ) {
    return `GET ${productionApiRoutes.system.getBugReportConfig}`;
  }

  if (
    method === "POST" &&
    pathname === productionApiRoutes.system.submitBugReport
  ) {
    return `POST ${productionApiRoutes.system.submitBugReport}`;
  }

  if (
    method === "GET" &&
    pathname === productionApiRoutes.system.getApplicationSettings
  ) {
    return `GET ${productionApiRoutes.system.getApplicationSettings}`;
  }

  if (
    method === "GET" &&
    pathname === productionApiRoutes.system.getApplicationAsset
  ) {
    return `GET ${productionApiRoutes.system.getApplicationAsset}`;
  }

  if (
    method === "GET" &&
    pathname === productionApiRoutes.system.getSystemCheckAccess
  ) {
    return `GET ${productionApiRoutes.system.getSystemCheckAccess}`;
  }

  if (method === "GET" && systemCheckSpeedTestDownloadPattern.test(pathname)) {
    return `GET ${productionApiRoutes.system.downloadSpeedTestPackage}`;
  }

  if (
    method === "POST" &&
    pathname === productionApiRoutes.system.uploadSpeedTestPackage
  ) {
    return `POST ${productionApiRoutes.system.uploadSpeedTestPackage}`;
  }

  if (method === "GET" && pathname === "/manifest") {
    return "GET /manifest";
  }

  if (method === "POST" && pathname === productionApiRoutes.admin.bootstrap) {
    return `POST ${productionApiRoutes.admin.bootstrap}`;
  }

  if (method === "POST" && pathname === productionApiRoutes.admin.signIn) {
    return `POST ${productionApiRoutes.admin.signIn}`;
  }

  if (method === "GET" && pathname === productionApiRoutes.admin.currentSession) {
    return `GET ${productionApiRoutes.admin.currentSession}`;
  }

  if (method === "GET" && pathname === productionApiRoutes.admin.listSessions) {
    return `GET ${productionApiRoutes.admin.listSessions}`;
  }

  if (
    method === "GET" &&
    pathname === productionApiRoutes.admin.exportSessionsCsv
  ) {
    return `GET ${productionApiRoutes.admin.exportSessionsCsv}`;
  }

  if (
    method === "POST" &&
    pathname === productionApiRoutes.admin.revokeSessions
  ) {
    return `POST ${productionApiRoutes.admin.revokeSessions}`;
  }

  if (method === "DELETE" && adminSessionRevokePattern.test(pathname)) {
    return `DELETE ${productionApiRoutes.admin.revokeSession}`;
  }

  if (method === "POST" && pathname === productionApiRoutes.admin.signOut) {
    return `POST ${productionApiRoutes.admin.signOut}`;
  }

  if (
    method === "POST" &&
    pathname === productionApiRoutes.admin.changeOwnPassword
  ) {
    return `POST ${productionApiRoutes.admin.changeOwnPassword}`;
  }

  if (method === "GET" && pathname === productionApiRoutes.admin.listAuditEvents) {
    return `GET ${productionApiRoutes.admin.listAuditEvents}`;
  }

  if (
    method === "GET" &&
    pathname === productionApiRoutes.admin.exportAuditEventsCsv
  ) {
    return `GET ${productionApiRoutes.admin.exportAuditEventsCsv}`;
  }

  if (
    method === "PATCH" &&
    pathname === productionApiRoutes.admin.updateApplicationSettings
  ) {
    return `PATCH ${productionApiRoutes.admin.updateApplicationSettings}`;
  }

  if (
    ["GET", "POST", "DELETE"].includes(method) &&
    pathname === productionApiRoutes.admin.applicationAssets
  ) {
    return `${method} ${productionApiRoutes.admin.applicationAssets}`;
  }

  if (method === "GET" && pathname === productionApiRoutes.platform.listTenants) {
    return `GET ${productionApiRoutes.platform.listTenants}`;
  }

  if (
    method === "GET" &&
    pathname === productionApiRoutes.platform.exportTenantsCsv
  ) {
    return `GET ${productionApiRoutes.platform.exportTenantsCsv}`;
  }

  if (method === "GET" && pathname === productionApiRoutes.admin.listUsers) {
    return `GET ${productionApiRoutes.admin.listUsers}`;
  }

  if (method === "GET" && pathname === productionApiRoutes.admin.exportUsersCsv) {
    return `GET ${productionApiRoutes.admin.exportUsersCsv}`;
  }

  if (method === "POST" && pathname === productionApiRoutes.admin.createUser) {
    return `POST ${productionApiRoutes.admin.createUser}`;
  }

  if (method === "PATCH" && adminUserUpdatePattern.test(pathname)) {
    return `PATCH ${productionApiRoutes.admin.updateUser}`;
  }

  if (method === "DELETE" && adminUserUpdatePattern.test(pathname)) {
    return `DELETE ${productionApiRoutes.admin.deleteUser}`;
  }

  if (method === "POST" && adminUserResetPasswordPattern.test(pathname)) {
    return `POST ${productionApiRoutes.admin.resetPassword}`;
  }

  if (method === "POST" && adminUserAssignRolePattern.test(pathname)) {
    return `POST ${productionApiRoutes.admin.assignRole}`;
  }

  if (method === "DELETE" && adminUserRevokeRolePattern.test(pathname)) {
    return `DELETE ${productionApiRoutes.admin.revokeRole}`;
  }

  const routeChecks: Array<[string, RegExp, string]> = [
    ["POST", workspaceCreatePattern, productionApiRoutes.workspace.createWorkspace],
    ["GET", workspaceCreatePattern, productionApiRoutes.workspace.listWorkspaces],
    [
      "GET",
      workspaceDirectoryCsvExportPattern,
      productionApiRoutes.workspace.exportWorkspacesCsv
    ],
    ["GET", workspaceOverviewPattern, productionApiRoutes.workspace.getWorkspaceOverview],
    ["PATCH", workspaceOverviewPattern, productionApiRoutes.workspace.updateWorkspace],
    ["DELETE", workspaceOverviewPattern, productionApiRoutes.workspace.deleteWorkspace],
    [
      "GET",
      workspaceOverviewCsvExportPattern,
      productionApiRoutes.workspace.exportWorkspaceOverviewCsv
    ],
    [
      "GET",
      studyMonitorSummaryPattern,
      productionApiRoutes.workspace.getStudyMonitorSummary
    ],
    [
      "GET",
      studyMonitorParticipantMatrixPattern,
      productionApiRoutes.workspace.getStudyMonitorParticipantMatrix
    ],
    [
      "GET",
      studyMonitorParticipantPattern,
      productionApiRoutes.workspace.getStudyMonitorParticipant
    ],
    [
      "GET",
      studyMonitorGroupPattern,
      productionApiRoutes.workspace.getStudyMonitorGroup
    ],
    [
      "GET",
      studyMonitorBookletPattern,
      productionApiRoutes.workspace.getStudyMonitorBooklet
    ],
    [
      "GET",
      studyMonitorUnitPattern,
      productionApiRoutes.workspace.getStudyMonitorUnit
    ],
    [
      "GET",
      studyMonitorRunPattern,
      productionApiRoutes.workspace.getStudyMonitorRun
    ],
    [
      "GET",
      workspaceActivityEventListPattern,
      productionApiRoutes.workspace.listWorkspaceActivityEvents
    ],
    ["GET", attachmentListPattern, productionApiRoutes.workspace.listAttachments],
    ["GET", attachmentPagesPdfPattern, productionApiRoutes.workspace.downloadAttachmentPagesPdf],
    ["GET", attachmentDetailPattern, productionApiRoutes.workspace.getAttachment],
    ["GET", attachmentPagePdfPattern, productionApiRoutes.workspace.downloadAttachmentPagePdf],
    ["POST", attachmentFileUploadPattern, productionApiRoutes.workspace.uploadAttachmentFile],
    ["GET", attachmentFileDetailPattern, productionApiRoutes.workspace.getAttachmentFile],
    ["DELETE", attachmentFileDetailPattern, productionApiRoutes.workspace.deleteAttachmentFile],
    ["POST", sourcePackageCreatePattern, productionApiRoutes.workspace.createSourcePackage],
    [
      "POST",
      sourcePackageAssemblyPattern,
      productionApiRoutes.workspace.assembleSourcePackages
    ],
    ["GET", sourcePackageListPattern, productionApiRoutes.workspace.listSourcePackages],
    ["GET", sourcePackageDetailPattern, productionApiRoutes.workspace.getSourcePackage],
    [
      "GET",
      sourcePackageDownloadPattern,
      productionApiRoutes.workspace.downloadSourcePackage
    ],
    [
      "GET",
      sourcePackageDeletionReadinessPattern,
      productionApiRoutes.workspace.getSourcePackageDeletionReadiness
    ],
    [
      "DELETE",
      sourcePackageDeletePattern,
      productionApiRoutes.workspace.deleteSourcePackage
    ],
    [
      "POST",
      sourcePackageBatchDeletePattern,
      productionApiRoutes.workspace.deleteSourcePackages
    ],
    [
      "POST",
      sourcePackageReplacePattern,
      productionApiRoutes.workspace.replaceSourcePackage
    ],
    [
      "GET",
      sourcePackageCsvExportPattern,
      productionApiRoutes.workspace.exportSourcePackagesCsv
    ],
    [
      "POST",
      sourcePackageRetryImportPattern,
      productionApiRoutes.workspace.retrySourcePackageImport
    ],
    ["POST", importJobCreatePattern, productionApiRoutes.workspace.createImportJob],
    ["GET", importJobListPattern, productionApiRoutes.workspace.listImportJobs],
    ["GET", importJobDetailPattern, productionApiRoutes.workspace.getImportJob],
    [
      "GET",
      importJobCsvExportPattern,
      productionApiRoutes.workspace.exportImportJobsCsv
    ],
    [
      "GET",
      participantSessionListPattern,
      productionApiRoutes.workspace.listParticipantSessions
    ],
    [
      "GET",
      participantSessionCsvExportPattern,
      productionApiRoutes.workspace.exportParticipantSessionsCsv
    ],
    [
      "GET",
      participantSessionDetailPattern,
      productionApiRoutes.workspace.getParticipantSession
    ],
    [
      "GET",
      participantRosterPattern,
      productionApiRoutes.workspace.listParticipantRoster
    ],
    [
      "POST",
      participantRosterPattern,
      productionApiRoutes.workspace.importParticipantRoster
    ],
    [
      "GET",
      participantRosterCsvExportPattern,
      productionApiRoutes.workspace.exportParticipantRosterCsv
    ],
    [
      "GET",
      detailedResponsesPattern,
      productionApiRoutes.workspace.listDetailedResponses
    ],
    [
      "GET",
      groupResultsPattern,
      productionApiRoutes.workspace.listGroupResults
    ],
    [
      "DELETE",
      groupResultsPattern,
      productionApiRoutes.workspace.deleteGroupResultsBulk
    ],
    [
      "GET",
      reviewListPattern,
      productionApiRoutes.workspace.listReviews
    ],
    [
      "POST",
      reviewListPattern,
      productionApiRoutes.workspace.createReview
    ],
    [
      "PATCH",
      reviewDetailPattern,
      productionApiRoutes.workspace.updateReview
    ],
    [
      "DELETE",
      reviewDetailPattern,
      productionApiRoutes.workspace.deleteReview
    ],
    [
      "DELETE",
      deleteGroupResultsPattern,
      productionApiRoutes.workspace.deleteGroupResults
    ],
    [
      "GET",
      studyMonitorCsvExportPattern,
      productionApiRoutes.workspace.exportStudyMonitorCsv
    ],
    [
      "GET",
      studyMonitorParticipantMatrixCsvExportPattern,
      productionApiRoutes.workspace.exportStudyMonitorParticipantMatrixCsv
    ],
    [
      "GET",
      studyMonitorRunCsvExportPattern,
      productionApiRoutes.workspace.exportStudyMonitorRunCsv
    ],
    [
      "GET",
      openRunsCsvExportPattern,
      productionApiRoutes.workspace.exportOpenRunsCsv
    ],
    [
      "GET",
      responseCsvExportPattern,
      productionApiRoutes.workspace.exportResponseCsv
    ],
    [
      "GET",
      originalResultArchiveExportPattern,
      productionApiRoutes.workspace.exportOriginalResultArchive
    ],
    [
      "GET",
      logCsvExportPattern,
      productionApiRoutes.workspace.exportLogCsv
    ],
    [
      "GET",
      activityCsvExportPattern,
      productionApiRoutes.workspace.exportActivityCsv
    ],
    [
      "GET",
      participantTestLogListPattern,
      productionApiRoutes.workspace.listParticipantTestLogs
    ],
    [
      "GET",
      reviewCsvExportPattern,
      productionApiRoutes.workspace.exportReviewCsv
    ],
    [
      "GET",
      contentReleaseListPattern,
      productionApiRoutes.workspace.listContentReleases
    ],
    [
      "GET",
      contentReleaseCsvExportPattern,
      productionApiRoutes.workspace.exportContentReleasesCsv
    ],
    [
      "GET",
      contentReleaseDetailPattern,
      productionApiRoutes.workspace.getContentRelease
    ],
    [
      "GET",
      contentReleaseActivationReadinessPattern,
      productionApiRoutes.workspace.getContentReleaseActivationReadiness
    ],
    [
      "POST",
      contentReleaseActivatePattern,
      productionApiRoutes.workspace.activateContentRelease
    ],
    ["GET", systemCheckListPattern, productionApiRoutes.workspace.listSystemChecks],
    ["GET", systemCheckDetailPattern, productionApiRoutes.workspace.getSystemCheck],
    [
      "POST",
      systemCheckReportSavePattern,
      productionApiRoutes.workspace.saveSystemCheckReport
    ],
    [
      "GET",
      systemCheckReportListPattern,
      productionApiRoutes.workspace.listSystemCheckReports
    ],
    [
      "GET",
      systemCheckReportStatisticsPattern,
      productionApiRoutes.workspace.getSystemCheckReportStatistics
    ],
    [
      "DELETE",
      systemCheckReportListPattern,
      productionApiRoutes.workspace.deleteSystemCheckReports
    ],
    [
      "POST",
      systemCheckReportImportPattern,
      productionApiRoutes.workspace.importSystemCheckReport
    ],
    [
      "GET",
      systemCheckReportCsvExportPattern,
      productionApiRoutes.workspace.exportSystemCheckReportsCsv
    ],
    [
      "GET",
      systemCheckReportJsonExportPattern,
      productionApiRoutes.workspace.exportSystemCheckReportsJson
    ],
    ["GET", runtimeStatePattern, productionApiRoutes.participant.getRuntimeState],
    ["GET", currentRunStatePattern, productionApiRoutes.participant.getCurrentRunState],
    ["GET", participantEventStreamPattern, productionApiRoutes.participant.eventStream],
    ["GET", participantResourcePattern, productionApiRoutes.participant.getResource],
    ["OPTIONS", participantResourcePattern, productionApiRoutes.participant.getResource],
    ["POST", saveProgressPattern, productionApiRoutes.participant.saveProgress],
    ["POST", saveTestLogsPattern, productionApiRoutes.participant.saveTestLogs],
    [
      "POST",
      selectAdaptiveStatePattern,
      productionApiRoutes.participant.selectAdaptiveState
    ],
    ["GET", participantReviewListPattern, productionApiRoutes.participant.listReviews],
    [
      "GET",
      participantReviewCsvExportPattern,
      productionApiRoutes.participant.exportReviewsCsv
    ],
    ["POST", participantReviewListPattern, productionApiRoutes.participant.createReview],
    ["PATCH", participantReviewDetailPattern, productionApiRoutes.participant.updateReview],
    ["DELETE", participantReviewDetailPattern, productionApiRoutes.participant.deleteReview],
    ["POST", unlockTestletPattern, productionApiRoutes.participant.unlockTestlet],
    ["POST", resumeSessionPattern, productionApiRoutes.participant.resumeSession],
    ["POST", resumeRunPattern, productionApiRoutes.participant.resumeRun],
    [
      "POST",
      returnToStarterPattern,
      productionApiRoutes.participant.returnToStarter
    ],
    ["POST", completeRunPattern, productionApiRoutes.participant.completeRun],
    ["GET", monitorOpenRunsPattern, productionApiRoutes.monitor.openRuns],
    ["GET", monitorEventStreamPattern, productionApiRoutes.monitor.eventStream],
    ["POST", monitorRunCommandsPattern, productionApiRoutes.monitor.issueRunCommands],
    ["POST", monitorRunCommandPattern, productionApiRoutes.monitor.issueRunCommand]
  ];

  for (const [expectedMethod, pattern, template] of routeChecks) {
    if (method === expectedMethod && pattern.test(pathname)) {
      return `${method} ${template}`;
    }
  }

  if (method === "POST" && pathname === productionApiRoutes.platform.createTenant) {
    return `POST ${productionApiRoutes.platform.createTenant}`;
  }

  if (method === "POST" && pathname === productionApiRoutes.participant.signIn) {
    return `POST ${productionApiRoutes.participant.signIn}`;
  }

  if (method === "POST" && pathname === productionApiRoutes.participant.launch) {
    return `POST ${productionApiRoutes.participant.launch}`;
  }

  return `${method} <unmatched>`;
};

const decodeRouteGroup = (value: string | undefined): string | null =>
  value ? decodeURIComponent(value) : null;

const readOptionalQueryValue = (url: URL, key: string): string | undefined =>
  url.searchParams.get(key)?.trim() || undefined;

const parseGroupKeyQuery = (
  url: URL,
  response: ServerResponse
): { ok: true; groupKey?: string; groupKeys?: string[] } | { ok: false } => {
  const groupKeys = Array.from(
    new Set(
      url.searchParams
        .getAll("groupKey")
        .map(value => value.trim())
        .filter(Boolean)
    )
  );
  if (groupKeys.length > 100) {
    sendError(
      response,
      400,
      "group_key_filter_invalid",
      "At most 100 distinct groupKey filters are supported."
    );
    return { ok: false };
  }
  return groupKeys.length > 1
    ? { ok: true, groupKeys }
    : { ok: true, groupKey: groupKeys[0] };
};

const parseOperatorReadLimit = (
  url: URL,
  response: ServerResponse,
  error: string,
  message: string,
  maximum = 500
): { ok: true; limit?: number } | { ok: false } => {
  const limitRawValue = readOptionalQueryValue(url, "limit");
  const limit = limitRawValue ? Number.parseInt(limitRawValue, 10) : undefined;
  if (
    limitRawValue &&
    (!/^\d+$/.test(limitRawValue) || !limit || limit < 1 || limit > maximum)
  ) {
    sendError(response, 400, error, message);
    return { ok: false };
  }

  return { ok: true, limit };
};

const parseSourcePackageListQuery = (
  url: URL,
  response: ServerResponse
): SourcePackageListQuery | null => {
  const status = readOptionalQueryValue(url, "status");
  if (status && !sourcePackageStatuses.includes(status as SourcePackageStatus)) {
    sendError(
      response,
      400,
      "source_package_status_invalid",
      `Source package status '${status}' is not supported.`
    );
    return null;
  }

  const latestImportStatus = readOptionalQueryValue(url, "latestImportStatus");
  if (
    latestImportStatus &&
    !importJobStatuses.includes(latestImportStatus as ImportJobStatus)
  ) {
    sendError(
      response,
      400,
      "source_package_latest_import_status_invalid",
      `Latest import status '${latestImportStatus}' is not supported.`
    );
    return null;
  }

  const fileType = readOptionalQueryValue(url, "fileType");
  if (fileType && !workspaceFileTypes.includes(fileType as WorkspaceFileType)) {
    sendError(
      response,
      400,
      "source_package_file_type_invalid",
      `Workspace file type '${fileType}' is not supported.`
    );
    return null;
  }

  const sortBy = readOptionalQueryValue(url, "sortBy");
  if (sortBy && !["fileName", "fileSize", "uploadedAt"].includes(sortBy)) {
    sendError(
      response,
      400,
      "source_package_sort_field_invalid",
      `Source package sort field '${sortBy}' is not supported.`
    );
    return null;
  }

  const sortDirection = readOptionalQueryValue(url, "sortDirection");
  if (sortDirection && !["asc", "desc"].includes(sortDirection)) {
    sendError(
      response,
      400,
      "source_package_sort_direction_invalid",
      `Source package sort direction '${sortDirection}' is not supported.`
    );
    return null;
  }

  const limit = parseOperatorReadLimit(
    url,
    response,
    "source_package_limit_invalid",
    "Source package limit must be an integer between 1 and 500."
  );
  if (!limit.ok) {
    return null;
  }

  return {
    status: status as SourcePackageStatus | undefined,
    fileType: fileType as WorkspaceFileType | undefined,
    mediaType: readOptionalQueryValue(url, "mediaType"),
    fileName: readOptionalQueryValue(url, "fileName"),
    latestImportStatus: latestImportStatus as ImportJobStatus | undefined,
    sortBy: sortBy as "fileName" | "fileSize" | "uploadedAt" | undefined,
    sortDirection: sortDirection as "asc" | "desc" | undefined,
    limit: limit.limit
  };
};

const parseImportJobListQuery = (
  url: URL,
  response: ServerResponse
): ImportJobListQuery | null => {
  const status = readOptionalQueryValue(url, "status");
  if (status && !importJobStatuses.includes(status as ImportJobStatus)) {
    sendError(
      response,
      400,
      "import_job_status_invalid",
      `Import job status '${status}' is not supported.`
    );
    return null;
  }

  const limit = parseOperatorReadLimit(
    url,
    response,
    "import_job_limit_invalid",
    "Import job limit must be an integer between 1 and 500."
  );
  if (!limit.ok) {
    return null;
  }

  return {
    status: status as ImportJobStatus | undefined,
    sourcePackageId: readOptionalQueryValue(url, "sourcePackageId"),
    limit: limit.limit
  };
};

const parseContentReleaseListQuery = (
  url: URL,
  response: ServerResponse
): ContentReleaseListQuery | null => {
  const status = readOptionalQueryValue(url, "status");
  if (status && !contentReleaseStatuses.includes(status as ContentReleaseStatus)) {
    sendError(
      response,
      400,
      "content_release_status_invalid",
      `Content release status '${status}' is not supported.`
    );
    return null;
  }

  const limit = parseOperatorReadLimit(
    url,
    response,
    "content_release_limit_invalid",
    "Content release limit must be an integer between 1 and 500."
  );
  if (!limit.ok) {
    return null;
  }

  return {
    status: status as ContentReleaseStatus | undefined,
    importJobId: readOptionalQueryValue(url, "importJobId"),
    sourcePackageId: readOptionalQueryValue(url, "sourcePackageId"),
    limit: limit.limit
  };
};

const parseDetailedResponseListQuery = (
  url: URL,
  response: ServerResponse,
  maximumLimit = 500
): DetailedResponseListQuery | null => {
  const groupFilter = parseGroupKeyQuery(url, response);
  if (!groupFilter.ok) {
    return null;
  }
  const status = readOptionalQueryValue(url, "status");
  if (status && !testRunStatuses.includes(status as TestRunStatus)) {
    sendError(
      response,
      400,
      "detailed_response_status_invalid",
      `Detailed response status '${status}' is not supported.`
    );
    return null;
  }

  const limitResult = parseOperatorReadLimit(
    url,
    response,
    "detailed_response_limit_invalid",
    `Detailed response limit must be an integer between 1 and ${maximumLimit}.`,
    maximumLimit
  );
  if (!limitResult.ok) {
    return null;
  }

  return {
    loginKey: readOptionalQueryValue(url, "loginKey"),
    groupKey: groupFilter.groupKey,
    groupKeys: groupFilter.groupKeys,
    bookletKey: readOptionalQueryValue(url, "bookletKey"),
    participantSessionId: readOptionalQueryValue(url, "participantSessionId"),
    testRunId: readOptionalQueryValue(url, "testRunId"),
    unitKey: readOptionalQueryValue(url, "unitKey"),
    status: status as TestRunStatus | undefined,
    limit: limitResult.limit
  };
};

const parseParticipantTestLogListQuery = (
  url: URL,
  response: ServerResponse
): {
  loginKey?: string;
  groupKey?: string;
  groupKeys?: string[];
  bookletKey?: string;
  testRunId?: string;
  unitKey?: string;
  logKey?: string;
  limit?: number;
} | null => {
  const groupFilter = parseGroupKeyQuery(url, response);
  if (!groupFilter.ok) {
    return null;
  }
  const limitRawValue = url.searchParams.get("limit")?.trim() || undefined;
  const limit = limitRawValue ? Number.parseInt(limitRawValue, 10) : undefined;
  if (
    limitRawValue &&
    (!/^\d+$/.test(limitRawValue) || !limit || limit < 1 || limit > 50_000)
  ) {
    sendError(
      response,
      400,
      "participant_test_log_limit_invalid",
      "Participant test-log limit must be an integer between 1 and 50000."
    );
    return null;
  }
  return {
    loginKey: readOptionalQueryValue(url, "loginKey"),
    groupKey: groupFilter.groupKey,
    groupKeys: groupFilter.groupKeys,
    bookletKey: readOptionalQueryValue(url, "bookletKey"),
    testRunId: readOptionalQueryValue(url, "testRunId"),
    unitKey: readOptionalQueryValue(url, "unitKey"),
    logKey: readOptionalQueryValue(url, "logKey"),
    limit
  };
};

const parseWorkspaceReviewListQuery = (
  url: URL,
  response: ServerResponse,
  maximumLimit = 500
): WorkspaceReviewListQuery | null => {
  const groupFilter = parseGroupKeyQuery(url, response);
  if (!groupFilter.ok) {
    return null;
  }
  const limitResult = parseOperatorReadLimit(
    url,
    response,
    "workspace_review_limit_invalid",
    `Workspace review limit must be an integer between 1 and ${maximumLimit}.`,
    maximumLimit
  );
  if (!limitResult.ok) {
    return null;
  }

  return {
    loginKey: readOptionalQueryValue(url, "loginKey"),
    groupKey: groupFilter.groupKey,
    groupKeys: groupFilter.groupKeys,
    bookletKey: readOptionalQueryValue(url, "bookletKey"),
    participantSessionId: readOptionalQueryValue(url, "participantSessionId"),
    testRunId: readOptionalQueryValue(url, "testRunId"),
    unitKey: readOptionalQueryValue(url, "unitKey"),
    reviewerId: readOptionalQueryValue(url, "reviewerId"),
    category: readOptionalQueryValue(url, "category"),
    limit: limitResult.limit
  };
};

const parseMonitorOpenRunsQuery = (
  url: URL,
  response: ServerResponse
): MonitorOpenRunsQuery | null => {
  const status = readOptionalQueryValue(url, "status");
  if (status && !testRunStatuses.includes(status as TestRunStatus)) {
    sendError(
      response,
      400,
      "open_runs_status_invalid",
      `Open runs status '${status}' is not supported.`
    );
    return null;
  }

  const limitResult = parseOperatorReadLimit(
    url,
    response,
    "open_runs_limit_invalid",
    "Open runs limit must be an integer between 1 and 500."
  );
  if (!limitResult.ok) {
    return null;
  }

  return {
    loginKey: readOptionalQueryValue(url, "loginKey"),
    groupKey: readOptionalQueryValue(url, "groupKey"),
    bookletKey: readOptionalQueryValue(url, "bookletKey"),
    bookletSpecies: readOptionalQueryValue(url, "bookletSpecies"),
    participantSessionId: readOptionalQueryValue(url, "participantSessionId"),
    testRunId: readOptionalQueryValue(url, "testRunId"),
    unitKey: readOptionalQueryValue(url, "unitKey"),
    status: status as TestRunStatus | undefined,
    limit: limitResult.limit
  };
};

const parseStudyMonitorParticipantMatrixQuery = (
  url: URL,
  response: ServerResponse
): StudyMonitorParticipantMatrixQuery | null => {
  const testRunStatus =
    url.searchParams.get("testRunStatus")?.trim() || undefined;
  if (
    testRunStatus &&
    testRunStatus !== "not_started" &&
    !testRunStatuses.includes(testRunStatus as TestRunStatus)
  ) {
    sendError(
      response,
      400,
      "invalid_study_monitor_matrix_status_filter",
      "testRunStatus must be one of not_started, created, running, paused, or completed."
    );
    return null;
  }

  const answerState = url.searchParams.get("answerState")?.trim() || undefined;
  if (answerState && answerState !== "answered" && answerState !== "missing") {
    sendError(
      response,
      400,
      "invalid_study_monitor_matrix_answer_filter",
      "answerState must be answered or missing."
    );
    return null;
  }

  const limitResult = parseOperatorReadLimit(
    url,
    response,
    "invalid_study_monitor_matrix_limit",
    "limit must be an integer from 1 to 500."
  );
  if (!limitResult.ok) {
    return null;
  }

  return {
    loginKey: readOptionalQueryValue(url, "loginKey"),
    groupKey: readOptionalQueryValue(url, "groupKey"),
    bookletKey: readOptionalQueryValue(url, "bookletKey"),
    unitKey: readOptionalQueryValue(url, "unitKey"),
    testRunStatus: testRunStatus as TestRunStatus | "not_started" | undefined,
    answerState: answerState as "answered" | "missing" | undefined,
    limit: limitResult.limit
  };
};

const PARTICIPANT_EVENT_STREAM_POLL_INTERVAL_MS = 1_000;
const PARTICIPANT_EVENT_STREAM_HEARTBEAT_INTERVAL_MS = 15_000;

const participantCurrentStateRevision = (
  currentRunState: ParticipantCurrentRunStateResponse["currentRunState"]
): string =>
  createHash("sha256")
    .update(
      JSON.stringify(currentRunState.testRun, (key, value) =>
        key === "remainingSeconds" ? undefined : value
      )
    )
    .digest("hex");

const writeParticipantEvent = (
  response: ServerResponse,
  event: ParticipantEventStreamEvent
): void => {
  response.write(`id: ${event.sequence}\n`);
  response.write(`event: ${event.eventType}\n`);
  response.write(`data: ${JSON.stringify(event)}\n\n`);
};

const streamParticipantEvents = async (input: {
  request: IncomingMessage;
  response: ServerResponse;
  participantRuntime: FirstSliceServices["participantRuntime"];
  participantSessionId: string;
}): Promise<void> => {
  const initialState = await input.participantRuntime.getCurrentRunState({
    participantSessionId: input.participantSessionId
  });
  let testRunId = initialState.testRun.testRunId;
  let revision = participantCurrentStateRevision(initialState);
  let sequence = 0;
  let lastEventAt = Date.now();
  let polling = false;
  let closed = false;
  let pollHandle: NodeJS.Timeout | null = null;

  const stop = (): void => {
    if (closed) {
      return;
    }
    closed = true;
    if (pollHandle) {
      clearInterval(pollHandle);
      pollHandle = null;
    }
  };
  const publish = (
    eventType: ParticipantEventStreamEvent["eventType"]
  ): void => {
    sequence += 1;
    lastEventAt = Date.now();
    writeParticipantEvent(input.response, {
      schemaVersion: PARTICIPANT_EVENT_STREAM_SCHEMA_VERSION,
      eventType,
      sequence,
      participantSessionId: input.participantSessionId,
      testRunId,
      emittedAt: new Date(lastEventAt).toISOString(),
      revision
    });
  };

  input.request.once("close", stop);
  input.response.once("close", stop);
  input.response.writeHead(200, {
    ...securityHeaders,
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no"
  });
  input.response.flushHeaders();
  input.response.write("retry: 3000\n\n");
  publish("snapshot");

  pollHandle = setInterval(() => {
    if (closed || polling) {
      return;
    }
    polling = true;
    void input.participantRuntime
      .getCurrentRunState({
        participantSessionId: input.participantSessionId
      })
      .then(currentState => {
        if (closed) {
          return;
        }
        const nextRevision = participantCurrentStateRevision(currentState);
        if (nextRevision !== revision) {
          testRunId = currentState.testRun.testRunId;
          revision = nextRevision;
          publish("change");
          return;
        }
        if (
          Date.now() - lastEventAt >=
          PARTICIPANT_EVENT_STREAM_HEARTBEAT_INTERVAL_MS
        ) {
          publish("heartbeat");
        }
      })
      .catch(() => {
        stop();
        if (!input.response.writableEnded) {
          input.response.end();
        }
      })
      .finally(() => {
        polling = false;
      });
  }, PARTICIPANT_EVENT_STREAM_POLL_INTERVAL_MS);
  pollHandle.unref();
};

const MONITOR_EVENT_STREAM_POLL_INTERVAL_MS = 1_000;
const MONITOR_EVENT_STREAM_HEARTBEAT_INTERVAL_MS = 15_000;

const monitorOpenRunsRevision = (items: unknown[]): string =>
  createHash("sha256")
    .update(
      JSON.stringify(items, (key, value) =>
        key === "remainingSeconds" ? undefined : value
      )
    )
    .digest("hex");

const writeMonitorEvent = (
  response: ServerResponse,
  event: MonitorEventStreamEvent
): void => {
  response.write(`id: ${event.sequence}\n`);
  response.write(`event: ${event.eventType}\n`);
  response.write(`data: ${JSON.stringify(event)}\n\n`);
};

const streamMonitorEvents = async (input: {
  request: IncomingMessage;
  response: ServerResponse;
  monitorRead: FirstSliceServices["monitorRead"];
  tenantKey: string;
  workspaceKey: string;
  groupKeys?: string[];
  validateAccess?: () => Promise<void>;
}): Promise<void> => {
  await input.validateAccess?.();
  const initialItems = await input.monitorRead.listOpenRuns({
    tenantKey: input.tenantKey,
    workspaceKey: input.workspaceKey,
    groupKeys: input.groupKeys,
    limit: 500
  });
  let revision = monitorOpenRunsRevision(initialItems);
  let openRunCount = initialItems.length;
  let sequence = 0;
  let lastEventAt = Date.now();
  let polling = false;
  let closed = false;
  let pollHandle: NodeJS.Timeout | null = null;

  const stop = (): void => {
    if (closed) {
      return;
    }
    closed = true;
    if (pollHandle) {
      clearInterval(pollHandle);
      pollHandle = null;
    }
  };
  const publish = (
    eventType: MonitorEventStreamEvent["eventType"]
  ): void => {
    sequence += 1;
    lastEventAt = Date.now();
    writeMonitorEvent(input.response, {
      schemaVersion: MONITOR_EVENT_STREAM_SCHEMA_VERSION,
      eventType,
      sequence,
      tenantKey: input.tenantKey,
      workspaceKey: input.workspaceKey,
      emittedAt: new Date(lastEventAt).toISOString(),
      revision,
      openRunCount
    });
  };

  input.request.once("close", stop);
  input.response.once("close", stop);
  input.response.writeHead(200, {
    ...securityHeaders,
    "content-type": "text/event-stream; charset=utf-8",
    "cache-control": "no-cache, no-transform",
    connection: "keep-alive",
    "x-accel-buffering": "no"
  });
  input.response.flushHeaders();
  input.response.write("retry: 3000\n\n");
  publish("snapshot");

  pollHandle = setInterval(() => {
    if (closed || polling) {
      return;
    }
    polling = true;
    void (async () => {
      await input.validateAccess?.();
      return input.monitorRead.listOpenRuns({
        tenantKey: input.tenantKey,
        workspaceKey: input.workspaceKey,
        groupKeys: input.groupKeys,
        limit: 500
      });
    })()
      .then(items => {
        if (closed) {
          return;
        }
        const nextRevision = monitorOpenRunsRevision(items);
        if (nextRevision !== revision) {
          revision = nextRevision;
          openRunCount = items.length;
          publish("change");
          return;
        }
        if (
          Date.now() - lastEventAt >=
          MONITOR_EVENT_STREAM_HEARTBEAT_INTERVAL_MS
        ) {
          publish("heartbeat");
        }
      })
      .catch(() => {
        stop();
        if (!input.response.writableEnded) {
          input.response.end();
        }
      })
      .finally(() => {
        polling = false;
      });
  }, MONITOR_EVENT_STREAM_POLL_INTERVAL_MS);
  pollHandle.unref();
};

const createRequestHandler = (runtime: Awaited<ReturnType<typeof createApiRuntime>>) =>
  async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const services = runtime.services;
    const requestId = randomUUID();
    const requestStartedAt = process.hrtime.bigint();
    const method = request.method ?? "UNKNOWN";
    const effectiveMethod = method === "HEAD" ? "GET" : method;
    const metrics = runtime.metrics;
    const requestPathname = new URL(
      request.url ?? "/",
      "http://127.0.0.1"
    ).pathname;
    const routeLabel = resolveMetricsRouteLabel(
      effectiveMethod,
      requestPathname
    );

    response.setHeader("x-request-id", requestId);
    metrics.activeRequests += 1;
    metrics.totalRequests += 1;
    incrementCounter(metrics.requestCountsByMethod, method);
    incrementCounter(metrics.requestCountsByRoute, routeLabel);

    response.once("finish", () => {
      const durationMs = Number(process.hrtime.bigint() - requestStartedAt) / 1_000_000;
      metrics.activeRequests -= 1;
      metrics.completedRequests += 1;
      incrementCounter(metrics.responseCountsByStatusCode, response.statusCode);
      recordRouteLatency(metrics, routeLabel, durationMs);
      recordRuntimeOperationalEvent(runtime, "info", "http_request_completed", {
        requestId,
        method,
        route: routeLabel,
        path: requestPathname,
        statusCode: response.statusCode,
        durationMs: Number(durationMs.toFixed(3)),
        storageKind: runtime.repositoryConfig.kind
      });
    });

    if (!request.url || !request.method) {
      sendError(response, 400, "invalid_request", "Missing request URL or method.");
      return;
    }

    if (method === "HEAD") {
      headResponses.add(response);
      request.method = effectiveMethod;
    }

    const url = new URL(request.url, "http://127.0.0.1");
    const pathname = url.pathname;
    const readRequestJsonBody = <T>(): Promise<T> =>
      readJsonBody<T>(request, runtime.config.maxJsonBodyBytes);
    const readSourcePackageRequestJsonBody = <T>(): Promise<T> =>
      readJsonBody<T>(request, runtime.config.maxSourcePackageJsonBodyBytes);
    const readApplicationSettingsRequestJsonBody = <T>(): Promise<T> =>
      readJsonBody<T>(request, MAX_APPLICATION_SETTINGS_JSON_BODY_BYTES);
    const readOptionalRequestJsonBody = <T>(): Promise<T | null> =>
      readOptionalJsonBody<T>(request, runtime.config.maxJsonBodyBytes);
    const userAgentHeader = request.headers["user-agent"];
    const requestUserAgent = Array.isArray(userAgentHeader)
      ? userAgentHeader[0] ?? null
      : userAgentHeader ?? null;

    try {
      if (request.method === "GET" && isParticipantEntryPath(pathname)) {
        sendRedirect(response, 302, `/app/participant${url.search}`);
        return;
      }

      if (request.method === "GET" && isSystemCheckEntryPath(pathname)) {
        sendRedirect(response, 302, `/app/system-check${url.search}`);
        return;
      }

      if (request.method === "GET" && (pathname === "/" || pathname.startsWith("/app"))) {
        await serveFrontendRequest(response, pathname);
        return;
      }

      if (request.method === "GET" && pathname === "/healthz") {
        sendJson(response, 200, {
          status: "ok",
          phase: "production-baseline"
        });
        return;
      }

      if (
        request.method === "GET" &&
        pathname === productionApiRoutes.system.getTime
      ) {
        response.setHeader("cache-control", "no-store");
        sendJson<GetSystemTimeResponse>(response, 200, {
          timestamp: Date.now(),
          timezone: runtime.config.participantAccessTimeZone
        });
        return;
      }

      const systemCheckSpeedTestDownloadMatch =
        systemCheckSpeedTestDownloadPattern.exec(pathname);
      if (
        request.method === "GET" &&
        systemCheckSpeedTestDownloadMatch?.groups
      ) {
        const sizeValue = decodeRouteGroup(
          systemCheckSpeedTestDownloadMatch.groups.size
        ) ?? "";
        const size = /^\d+$/.test(sizeValue)
          ? Number.parseInt(sizeValue, 10)
          : Number.NaN;
        if (
          !Number.isSafeInteger(size) ||
          size < SYSTEM_CHECK_SPEED_TEST_MIN_BYTES ||
          size > SYSTEM_CHECK_SPEED_TEST_MAX_BYTES
        ) {
          sendError(
            response,
            406,
            "system_check_speed_test_size_unsupported",
            `Speed-test package size must be between ${SYSTEM_CHECK_SPEED_TEST_MIN_BYTES} and ${SYSTEM_CHECK_SPEED_TEST_MAX_BYTES} bytes.`
          );
          return;
        }
        await sendSystemCheckSpeedTestPackage(response, size);
        return;
      }

      if (
        request.method === "POST" &&
        pathname === productionApiRoutes.system.uploadSpeedTestPackage
      ) {
        let packageReceivedSize = 0;
        try {
          packageReceivedSize = await readRequestBodyByteLength(
            request,
            SYSTEM_CHECK_SPEED_TEST_MAX_BYTES
          );
        } catch (error) {
          if (error instanceof RequestBodyTooLargeError) {
            sendError(
              response,
              413,
              "system_check_speed_test_package_too_large",
              `Speed-test upload must not exceed ${SYSTEM_CHECK_SPEED_TEST_MAX_BYTES} bytes.`
            );
            return;
          }
          throw error;
        }
        sendJson<SystemCheckSpeedTestUploadResponse>(response, 200, {
          requestTime: Date.now() / 1000,
          packageReceivedSize
        });
        return;
      }

      if (request.method === "GET" && pathname === "/readyz") {
        if (runtime.lifecycle.phase === "draining") {
          sendError(
            response,
            503,
            "service_draining",
            "Service is draining and not accepting new work.",
            {
              storageKind: runtime.repositoryConfig.kind,
              shutdownRequestedAt: runtime.lifecycle.shutdownRequestedAt
            }
          );
          return;
        }

        try {
          await runtime.repositoryConfig.readinessCheck();
          sendJson(response, 200, {
            status: "ready",
            phase: "production-baseline",
            storage: {
              kind: runtime.repositoryConfig.kind,
              schemaVersion: runtime.repositoryConfig.schemaVersion
            }
          });
        } catch (error) {
          metrics.errorCounts.storageNotReady += 1;
          recordRuntimeOperationalEvent(runtime, "error", "storage_readiness_failed", {
            requestId,
            method,
            route: routeLabel,
            path: request.url ?? null,
            storageKind: runtime.repositoryConfig.kind,
            cause: error instanceof Error ? error.message : String(error)
          });
          sendError(
            response,
            503,
            "storage_not_ready",
            "Storage readiness check failed.",
            {
              storageKind: runtime.repositoryConfig.kind,
              cause: error instanceof Error ? error.message : String(error)
            }
          );
        }
        return;
      }

      if (request.method === "GET" && pathname === "/metrics") {
        const memory = getProcessMemorySnapshot();
        sendJson(response, 200, {
          phase: "production-baseline",
          build: runtime.build,
          runtime: {
            startedAt: metrics.startedAt,
            uptimeSeconds: Number(
              ((Date.now() - Date.parse(metrics.startedAt)) / 1000).toFixed(3)
            ),
            lifecycle: runtime.lifecycle,
            activeRequests: metrics.activeRequests,
            totalRequests: metrics.totalRequests,
            completedRequests: metrics.completedRequests
          },
          memory,
          storage: {
            kind: runtime.repositoryConfig.kind,
            schemaVersion: runtime.repositoryConfig.schemaVersion
          },
          requestCountsByMethod: metrics.requestCountsByMethod,
          requestCountsByRoute: metrics.requestCountsByRoute,
          responseCountsByStatusCode: metrics.responseCountsByStatusCode,
          requestLatencyByRoute: metrics.requestLatencyByRoute,
          errorCounts: metrics.errorCounts
        });
        return;
      }

      if (request.method === "GET" && pathname === "/metrics/prometheus") {
        sendText(response, 200, renderPrometheusMetrics(runtime));
        return;
      }

      if (
        request.method === "GET" &&
        pathname === productionApiRoutes.system.getRuntimeDiagnostics
      ) {
        const memory = getProcessMemorySnapshot();
        sendJson<GetRuntimeDiagnosticsResponse>(response, 200, {
          phase: "production-baseline",
          build: runtime.build,
          runtime: {
            startedAt: metrics.startedAt,
            uptimeSeconds: Number(
              ((Date.now() - Date.parse(metrics.startedAt)) / 1000).toFixed(3)
            ),
            lifecycle: runtime.lifecycle,
            activeRequests: metrics.activeRequests,
            totalRequests: metrics.totalRequests,
            completedRequests: metrics.completedRequests
          },
          memory,
          storage: {
            kind: runtime.repositoryConfig.kind,
            schemaVersion: runtime.repositoryConfig.schemaVersion,
            location: redactStorageLocation(runtime.repositoryConfig.location)
          },
          recentEvents: runtime.recentOperationalEvents
        });
        return;
      }

      if (
        request.method === "GET" &&
        pathname === productionApiRoutes.system.getRuntimeConfig
      ) {
        sendJson<GetRuntimeConfigResponse>(response, 200, {
          phase: "production-baseline",
          build: runtime.build,
          runtimeConfig: {
            port: runtime.config.port,
            shutdownDrainDelayMs: runtime.config.shutdownDrainDelayMs,
            maxJsonBodyBytes: runtime.config.maxJsonBodyBytes,
            maxSourcePackageJsonBodyBytes:
              runtime.config.maxSourcePackageJsonBodyBytes,
            httpTimeouts: runtime.config.httpTimeouts,
            operatorAuthRequired: runtime.config.operatorAuthRequired,
            adminLoginProtection: runtime.config.adminLoginProtection,
            participantLoginProtection:
              runtime.config.participantLoginProtection,
            participantAccessTimeZone:
              runtime.config.participantAccessTimeZone,
            storage: {
              kind: runtime.repositoryConfig.kind,
              location: redactStorageLocation(runtime.repositoryConfig.location),
              schemaVersion: runtime.repositoryConfig.schemaVersion
            },
            environment: runtime.config.environment
          }
        });
        return;
      }

      if (
        request.method === "GET" &&
        pathname === productionApiRoutes.system.getBugReportConfig
      ) {
        response.setHeader("cache-control", "no-store");
        sendJson<BugReportConfigResponse>(response, 200, {
          enabled: runtime.bugReport.enabled,
          target: runtime.bugReport.enabled
            ? runtime.bugReport.repository
            : null
        });
        return;
      }

      if (
        request.method === "POST" &&
        pathname === productionApiRoutes.system.submitBugReport
      ) {
        const repository = runtime.bugReport.repository;
        const token = runtime.bugReport.token;
        if (!runtime.bugReport.enabled || !repository || !token) {
          sendError(
            response,
            503,
            "bug_report_not_configured",
            "Direct bug-report submission is not configured. Download the report instead."
          );
          return;
        }
        const bugReportRequest = validateBugReportRequest(
          await readRequestJsonBody<unknown>()
        );
        if (!bugReportRequest) {
          sendError(
            response,
            400,
            "invalid_bug_report",
            "Bug report title, tag, or report content is invalid."
          );
          return;
        }
        const retryAfterSeconds = consumeBugReportSubmission(
          runtime.bugReport.submissionWindows,
          request.socket.remoteAddress ?? "unknown"
        );
        if (retryAfterSeconds !== null) {
          response.setHeader("retry-after", String(retryAfterSeconds));
          sendError(
            response,
            429,
            "bug_report_rate_limited",
            "Too many bug reports were submitted from this client. Try again later.",
            { retryAfterSeconds }
          );
          return;
        }
        try {
          const issueUrl = await publishBugReport({
            repository,
            token,
            request: bugReportRequest
          });
          sendJson<SubmitBugReportResponse>(response, 201, {
            success: true,
            message: "Bericht gesendet, vielen Dank!",
            issueUrl
          });
        } catch {
          sendError(
            response,
            502,
            "bug_report_delivery_failed",
            "The bug report could not be delivered. Download it and contact support."
          );
        }
        return;
      }

      if (
        request.method === "GET" &&
        pathname === productionApiRoutes.system.getApplicationSettings
      ) {
        const applicationSettings =
          await services.applicationSettings.getApplicationSettings();
        sendJson<GetApplicationSettingsResponse>(response, 200, {
          applicationSettings
        });
        return;
      }

      if (
        request.method === "GET" &&
        pathname === productionApiRoutes.system.getApplicationAsset
      ) {
        const applicationAssetId = url.searchParams
          .get("applicationAssetId")
          ?.trim();
        const originalName = url.searchParams.get("originalName")?.trim();
        if (!applicationAssetId && !originalName) {
          sendError(
            response,
            400,
            "application_asset_id_missing",
            "applicationAssetId or originalName is required."
          );
          return;
        }
        const applicationAsset =
          await services.applicationSettings.getApplicationAsset({
            applicationAssetId,
            originalName
          });
        sendAsset(
          response,
          200,
          applicationAsset.mediaType,
          Buffer.from(applicationAsset.dataBase64, "base64"),
          {
            "cache-control": "public, max-age=300",
            "content-disposition": `inline; filename="${applicationAsset.originalName.replace(/["\\\r\n]/g, "_")}"`
          }
        );
        return;
      }

      if (
        request.method === "GET" &&
        pathname === productionApiRoutes.system.getSystemCheckAccess
      ) {
        const allSystemCheckRoles = await listSystemCheckRoleAssignments(
          runtime.repository
        );
        const sessionToken = readBearerToken(request);
        let authorizedScopes: GetSystemCheckAccessResponse["authorizedScopes"] = [];
        if (sessionToken) {
          const { roleAssignments } = await services.adminAuth.getCurrentSession({
            sessionToken
          });
          const systemCheckRoles = roleAssignments.filter(
            roleAssignment => roleAssignment.role === "system_check"
          );
          if (systemCheckRoles.length === 0) {
            sendError(
              response,
              403,
              "admin_role_required",
              "The admin session does not have dedicated system-check access.",
              { requiredRoles: ["system_check"] }
            );
            return;
          }
          authorizedScopes = await resolveSystemCheckAuthorizedScopes(
            runtime.repository,
            systemCheckRoles
          );
        }
        sendJson<GetSystemCheckAccessResponse>(response, 200, {
          accessMode:
            allSystemCheckRoles.length > 0 ? "login_required" : "anonymous_key",
          authorizedScopes
        });
        return;
      }

      if (
        request.method === "POST" &&
        pathname === productionApiRoutes.admin.bootstrap
      ) {
        const body = await readRequestJsonBody<BootstrapAdminUserRequest>();
        const { adminUser, roleAssignments } =
          await services.adminAuth.bootstrapAdminUser(body);
        sendJson<BootstrapAdminUserResponse>(response, 201, {
          adminUser: toPublicAdminUser(adminUser),
          roleAssignments
        });
        return;
      }

      if (
        request.method === "PATCH" &&
        pathname === productionApiRoutes.admin.updateApplicationSettings
      ) {
        const sessionToken = requireBearerToken(request, response);
        if (!sessionToken) {
          return;
        }
        const body =
          await readApplicationSettingsRequestJsonBody<UpdateApplicationSettingsRequest>();
        const applicationSettings =
          await services.applicationSettings.updateApplicationSettings({
            sessionToken,
            appTitle: body.appTitle,
            mainLogo: body.mainLogo,
            themeName: body.themeName,
            introHtml: body.introHtml,
            legalNoticeHtml: body.legalNoticeHtml,
            privacyNotice: body.privacyNotice,
            accessibilityNotice: body.accessibilityNotice,
            customTexts: body.customTexts,
            assetAssignments: body.assetAssignments,
            globalWarningText: body.globalWarningText,
            globalWarningExpiresAt: body.globalWarningExpiresAt
          });
        sendJson<UpdateApplicationSettingsResponse>(response, 200, {
          applicationSettings
        });
        return;
      }

      if (
        pathname === productionApiRoutes.admin.applicationAssets &&
        ["GET", "POST", "DELETE"].includes(request.method ?? "")
      ) {
        const sessionToken = requireBearerToken(request, response);
        if (!sessionToken) {
          return;
        }
        if (request.method === "GET") {
          const items = await services.applicationSettings.listApplicationAssets(
            { sessionToken }
          );
          sendJson<ListApplicationAssetsResponse>(response, 200, {
            items: items.map(({ dataBase64: _dataBase64, ...item }) => item)
          });
          return;
        }
        if (request.method === "POST") {
          const body =
            await readApplicationSettingsRequestJsonBody<UploadApplicationAssetRequest>();
          const { dataBase64: _dataBase64, ...applicationAsset } =
            await services.applicationSettings.uploadApplicationAsset({
              sessionToken,
              originalName: body.originalName,
              mediaType: body.mediaType,
              dataBase64: body.dataBase64
            });
          sendJson<UploadApplicationAssetResponse>(response, 201, {
            applicationAsset
          });
          return;
        }
        const applicationAssetId = url.searchParams
          .get("applicationAssetId")
          ?.trim();
        if (!applicationAssetId) {
          sendError(
            response,
            400,
            "application_asset_id_missing",
            "applicationAssetId is required."
          );
          return;
        }
        const { dataBase64: _dataBase64, ...applicationAsset } =
          await services.applicationSettings.deleteApplicationAsset({
            sessionToken,
            applicationAssetId
          });
        sendJson<DeleteApplicationAssetResponse>(response, 200, {
          applicationAsset
        });
        return;
      }

      if (
        request.method === "POST" &&
        pathname === productionApiRoutes.admin.signIn
      ) {
        const body = await readRequestJsonBody<AdminSignInRequest>();
        const { adminUser, adminSession, roleAssignments } =
          await services.adminAuth.signIn(body);
        sendJson<AdminSignInResponse>(response, 200, {
          adminUser: toPublicAdminUser(adminUser),
          adminSession: toPublicAdminSession(adminSession),
          roleAssignments,
          sessionToken: adminSession.token
        });
        return;
      }

      if (
        request.method === "GET" &&
        pathname === productionApiRoutes.admin.currentSession
      ) {
        const sessionToken = requireBearerToken(request, response);
        if (!sessionToken) {
          return;
        }

        const { adminUser, adminSession, roleAssignments } =
          await services.adminAuth.getCurrentSession({ sessionToken });
        sendJson<GetAdminCurrentSessionResponse>(response, 200, {
          adminUser: toPublicAdminUser(adminUser),
          adminSession: toPublicAdminSession(adminSession),
          roleAssignments
        });
        return;
      }

      if (
        request.method === "POST" &&
        pathname === productionApiRoutes.admin.signOut
      ) {
        const sessionToken = requireBearerToken(request, response);
        if (!sessionToken) {
          return;
        }

        const adminSession = await services.adminAuth.signOut({ sessionToken });
        sendJson<AdminSignOutResponse>(response, 200, {
          adminSession: toPublicAdminSession(adminSession)
        });
        return;
      }

      if (
        request.method === "POST" &&
        pathname === productionApiRoutes.admin.changeOwnPassword
      ) {
        const sessionToken = requireBearerToken(request, response);
        if (!sessionToken) {
          return;
        }
        const body = await readRequestJsonBody<ChangeAdminPasswordRequest>();
        const result = await services.adminAuth.changeOwnPassword({
          sessionToken,
          currentPassword: body.currentPassword,
          password: body.password
        });
        sendJson<ChangeAdminPasswordResponse>(response, 200, {
          adminUser: toPublicAdminUser(result.adminUser),
          revokedAdminSessionIds: result.revokedAdminSessionIds
        });
        return;
      }

      if (
        request.method === "GET" &&
        pathname === productionApiRoutes.admin.listSessions
      ) {
        const sessionToken = requireBearerToken(request, response);
        if (!sessionToken) {
          return;
        }

        const query = parseAdminSessionListQuery(url, response);
        if (!query) {
          return;
        }

        const items = await services.adminAuth.listAdminSessions({
          sessionToken,
          ...query
        });
        sendJson<ListAdminSessionsResponse>(response, 200, {
          items: items.map(toAdminSessionDirectoryItem)
        });
        return;
      }

      if (
        request.method === "GET" &&
        pathname === productionApiRoutes.admin.exportSessionsCsv
      ) {
        const sessionToken = requireBearerToken(request, response);
        if (!sessionToken) {
          return;
        }

        const query = parseAdminSessionListQuery(url, response);
        if (!query) {
          return;
        }

        const items = await services.adminAuth.listAdminSessions({
          sessionToken,
          ...query
        });
        sendCsv(
          response,
          200,
          "admin-sessions.csv",
          formatAdminSessionsCsv(items.map(toAdminSessionDirectoryItem))
        );
        return;
      }

      if (
        request.method === "POST" &&
        pathname === productionApiRoutes.admin.revokeSessions
      ) {
        const sessionToken = requireBearerToken(request, response);
        if (!sessionToken) {
          return;
        }
        const body = await readRequestJsonBody<RevokeAdminSessionsRequest>();
        if (
          !Array.isArray(body.adminSessionIds) ||
          body.adminSessionIds.length < 1 ||
          body.adminSessionIds.length > 50 ||
          body.adminSessionIds.some(
            adminSessionId =>
              typeof adminSessionId !== "string" ||
              !adminSessionId.trim() ||
              adminSessionId.trim().length > 200
          )
        ) {
          sendError(
            response,
            400,
            "admin_session_ids_invalid",
            "adminSessionIds must contain between 1 and 50 non-empty session ids."
          );
          return;
        }

        const result = await services.adminAuth.revokeAdminSessions({
          sessionToken,
          adminSessionIds: body.adminSessionIds
        });
        sendJson<RevokeAdminSessionsResponse>(response, 200, {
          requestedCount: result.requestedCount,
          adminSessions: result.adminSessions.map(toPublicAdminSession),
          failures: result.failures
        });
        return;
      }

      const adminSessionRevokeMatch = adminSessionRevokePattern.exec(pathname);
      if (request.method === "DELETE" && adminSessionRevokeMatch?.groups) {
        const adminSessionId = decodeRouteGroup(
          adminSessionRevokeMatch.groups.adminSessionId
        );
        if (!adminSessionId) {
          sendError(
            response,
            400,
            "invalid_admin_session_id",
            "adminSessionId is required."
          );
          return;
        }

        const sessionToken = requireBearerToken(request, response);
        if (!sessionToken) {
          return;
        }

        const adminSession = await services.adminAuth.revokeAdminSession({
          sessionToken,
          adminSessionId
        });
        sendJson<RevokeAdminSessionResponse>(response, 200, {
          adminSession: toPublicAdminSession(adminSession)
        });
        return;
      }

      if (
        request.method === "GET" &&
        pathname === productionApiRoutes.admin.listAuditEvents
      ) {
        const sessionToken = requireBearerToken(request, response);
        if (!sessionToken) {
          return;
        }

        const query = parseAdminAuditEventListQuery(url, response);
        if (!query) {
          return;
        }

        const items = await services.adminDirectory.listAdminAuditEvents({
          sessionToken,
          ...query
        });
        sendJson<ListAdminAuditEventsResponse>(response, 200, { items });
        return;
      }

      if (
        request.method === "GET" &&
        pathname === productionApiRoutes.admin.exportAuditEventsCsv
      ) {
        const sessionToken = requireBearerToken(request, response);
        if (!sessionToken) {
          return;
        }

        const query = parseAdminAuditEventListQuery(url, response);
        if (!query) {
          return;
        }

        const items = await services.adminDirectory.listAdminAuditEvents({
          sessionToken,
          ...query
        });
        sendCsv(
          response,
          200,
          "admin-audit-events.csv",
          formatAdminAuditEventsCsv(items)
        );
        return;
      }

      if (
        request.method === "GET" &&
        pathname === productionApiRoutes.admin.listUsers
      ) {
        const sessionToken = requireBearerToken(request, response);
        if (!sessionToken) {
          return;
        }

        const query = parseAdminUserListQuery(url, response);
        if (!query) {
          return;
        }

        const items = await services.adminDirectory.listAdminUsers({
          sessionToken,
          ...query
        });
        sendJson<ListAdminUsersResponse>(response, 200, {
          items: items.map(toAdminUserDirectoryItem)
        });
        return;
      }

      if (
        request.method === "GET" &&
        pathname === productionApiRoutes.admin.exportUsersCsv
      ) {
        const sessionToken = requireBearerToken(request, response);
        if (!sessionToken) {
          return;
        }

        const query = parseAdminUserListQuery(url, response);
        if (!query) {
          return;
        }

        const items = await services.adminDirectory.listAdminUsers({
          sessionToken,
          ...query
        });
        sendCsv(
          response,
          200,
          "admin-users.csv",
          formatAdminUsersCsv(items.map(toAdminUserDirectoryItem))
        );
        return;
      }

      if (
        request.method === "POST" &&
        pathname === productionApiRoutes.admin.createUser
      ) {
        const sessionToken = requireBearerToken(request, response);
        if (!sessionToken) {
          return;
        }

        const body = await readRequestJsonBody<CreateAdminUserRequest>();
        const item = await services.adminDirectory.createAdminUser({
          sessionToken,
          username: body.username,
          displayName: body.displayName,
          password: body.password,
          confirmationPassword: body.confirmationPassword,
          customTexts: body.customTexts,
          validFrom: body.validFrom,
          validTo: body.validTo,
          validForMinutes: body.validForMinutes,
          roleAssignments: body.roleAssignments
        });
        sendJson<CreateAdminUserResponse>(
          response,
          201,
          toAdminUserDirectoryItem(item)
        );
        return;
      }

      const adminUserUpdateMatch = adminUserUpdatePattern.exec(pathname);
      if (request.method === "DELETE" && adminUserUpdateMatch?.groups) {
        const adminUserId = decodeRouteGroup(
          adminUserUpdateMatch.groups.adminUserId
        );
        if (!adminUserId) {
          sendError(response, 400, "invalid_admin_user_id", "adminUserId is required.");
          return;
        }

        const sessionToken = requireBearerToken(request, response);
        if (!sessionToken) {
          return;
        }

        const deletion = await services.adminDirectory.deleteAdminUser({
          sessionToken,
          adminUserId
        });
        sendJson<DeleteAdminUserResponse>(response, 200, deletion);
        return;
      }
      if (request.method === "PATCH" && adminUserUpdateMatch?.groups) {
        const adminUserId = decodeRouteGroup(
          adminUserUpdateMatch.groups.adminUserId
        );
        if (!adminUserId) {
          sendError(response, 400, "invalid_admin_user_id", "adminUserId is required.");
          return;
        }

        const sessionToken = requireBearerToken(request, response);
        if (!sessionToken) {
          return;
        }

        const body = await readRequestJsonBody<UpdateAdminUserRequest>();
        const item = await services.adminDirectory.updateAdminUser({
          sessionToken,
          adminUserId,
          displayName: body.displayName,
          status: body.status,
          customTexts: body.customTexts,
          validFrom: body.validFrom,
          validTo: body.validTo,
          validForMinutes: body.validForMinutes
        });
        sendJson<UpdateAdminUserResponse>(
          response,
          200,
          toAdminUserDirectoryItem(item)
        );
        return;
      }

      const adminUserResetPasswordMatch =
        adminUserResetPasswordPattern.exec(pathname);
      if (request.method === "POST" && adminUserResetPasswordMatch?.groups) {
        const adminUserId = decodeRouteGroup(
          adminUserResetPasswordMatch.groups.adminUserId
        );
        if (!adminUserId) {
          sendError(response, 400, "invalid_admin_user_id", "adminUserId is required.");
          return;
        }

        const sessionToken = requireBearerToken(request, response);
        if (!sessionToken) {
          return;
        }

        const body = await readRequestJsonBody<ResetAdminUserPasswordRequest>();
        const item = await services.adminDirectory.resetAdminUserPassword({
          sessionToken,
          adminUserId,
          password: body.password
        });
        sendJson<ResetAdminUserPasswordResponse>(
          response,
          200,
          toAdminUserDirectoryItem(item)
        );
        return;
      }

      const adminUserAssignRoleMatch = adminUserAssignRolePattern.exec(pathname);
      if (request.method === "POST" && adminUserAssignRoleMatch?.groups) {
        const adminUserId = decodeRouteGroup(
          adminUserAssignRoleMatch.groups.adminUserId
        );
        if (!adminUserId) {
          sendError(response, 400, "invalid_admin_user_id", "adminUserId is required.");
          return;
        }

        const sessionToken = requireBearerToken(request, response);
        if (!sessionToken) {
          return;
        }

        const body = await readRequestJsonBody<AssignAdminRoleRequest>();
        const item = await services.adminDirectory.assignAdminRole({
          sessionToken,
          adminUserId,
          role: body.role,
          confirmationPassword: body.confirmationPassword,
          accessMode: body.accessMode,
          tenantKey: body.tenantKey,
          workspaceKey: body.workspaceKey,
          groupKey: body.groupKey,
          monitorProfiles: body.monitorProfiles,
          monitorBookletVisibility: body.monitorBookletVisibility
        });
        sendJson<AssignAdminRoleResponse>(
          response,
          200,
          toAdminUserDirectoryItem(item)
        );
        return;
      }

      const adminUserRevokeRoleMatch = adminUserRevokeRolePattern.exec(pathname);
      if (request.method === "DELETE" && adminUserRevokeRoleMatch?.groups) {
        const adminUserId = decodeRouteGroup(
          adminUserRevokeRoleMatch.groups.adminUserId
        );
        const roleAssignmentId = decodeRouteGroup(
          adminUserRevokeRoleMatch.groups.roleAssignmentId
        );
        if (!adminUserId) {
          sendError(response, 400, "invalid_admin_user_id", "adminUserId is required.");
          return;
        }
        if (!roleAssignmentId) {
          sendError(
            response,
            400,
            "invalid_role_assignment_id",
            "roleAssignmentId is required."
          );
          return;
        }

        const sessionToken = requireBearerToken(request, response);
        if (!sessionToken) {
          return;
        }

        const body =
          (await readOptionalRequestJsonBody<RevokeAdminRoleRequest>()) ?? {};
        const item = await services.adminDirectory.revokeAdminRole({
          sessionToken,
          adminUserId,
          roleAssignmentId,
          confirmationPassword: body.confirmationPassword
        });
        sendJson<RevokeAdminRoleResponse>(
          response,
          200,
          toAdminUserDirectoryItem(item)
        );
        return;
      }

      if (
        runtime.config.operatorAuthRequired &&
        isOperatorApiRequest(request.method, pathname)
      ) {
        const operatorAccessScope = resolveOperatorAccessScope(
          request.method,
          pathname
        );
        const sessionToken = requireBearerToken(request, response);
        if (!sessionToken) {
          return;
        }

        const { adminUser, roleAssignments } =
          await services.adminAuth.getCurrentSession({ sessionToken });
        operatorAdminUserIdByRequest.set(request, adminUser.adminUserId);
        const adminAccessMode = operatorAccessScope
          ? await resolveOperatorAdminAccess(
              runtime.repository,
              roleAssignments,
              operatorAccessScope
            )
          : null;
        const requiresWriteAccess = request.method !== "GET";
        const monitorRouteScope = resolveMonitorRouteScope(
          request.method,
          pathname
        );
        const monitorAccess =
          adminAccessMode !== "read_write" &&
          operatorAccessScope?.kind === "workspace" &&
          monitorRouteScope
            ? await resolveMonitorOperatorAccess({
                repository: runtime.repository,
                roleAssignments,
                tenantKey: operatorAccessScope.tenantKey,
                workspaceKey: operatorAccessScope.workspaceKey,
                routeScope: monitorRouteScope
              })
            : null;
        if (
          operatorAccessScope &&
          requiresWriteAccess &&
          adminAccessMode === "read_only" &&
          !monitorAccess
        ) {
          sendError(
            response,
            403,
            "admin_write_role_required",
            "The admin session has read-only access to this workspace.",
            {
              requiredAccessMode: "read_write",
              scope: describeOperatorAccessScope(operatorAccessScope)
            }
          );
          return;
        }
        if (!operatorAccessScope || (!adminAccessMode && !monitorAccess)) {
          sendError(
            response,
            403,
            "admin_role_required",
            "The admin session does not have the required role.",
            {
              requiredRoles: [
                "platform_admin",
                "tenant_admin",
                "workspace_admin"
              ],
              scope: operatorAccessScope
                ? describeOperatorAccessScope(operatorAccessScope)
                : "unknown"
            }
          );
          return;
        }
        if (monitorRouteScope) {
          monitorOperatorAccessByRequest.set(
            request,
            adminAccessMode ? { kind: "full" } : monitorAccess!
          );
        }
      }

      if (
        request.method === "GET" &&
        pathname === productionApiRoutes.platform.listTenants
      ) {
        const items = await services.platform.listTenants();
        sendJson<ListTenantsResponse>(response, 200, { items });
        return;
      }

      if (
        request.method === "GET" &&
        pathname === productionApiRoutes.platform.exportTenantsCsv
      ) {
        const csv = await services.platform.exportTenantsCsv();
        sendCsv(response, 200, "tenants.csv", csv);
        return;
      }

      if (
        request.method === "POST" &&
        pathname === productionApiRoutes.platform.createTenant
      ) {
        const body = await readRequestJsonBody<CreateTenantRequest>();
        const tenant = await services.platform.createTenant(body);
        sendJson<CreateTenantResponse>(response, 201, { tenant });
        return;
      }

      const workspaceCreateMatch = workspaceCreatePattern.exec(pathname);
      const workspaceDirectoryCsvExportMatch =
        workspaceDirectoryCsvExportPattern.exec(pathname);
      if (request.method === "GET" && workspaceCreateMatch?.groups) {
        const tenantKey = decodeRouteGroup(workspaceCreateMatch.groups.tenantKey);
        if (!tenantKey) {
          sendError(response, 400, "invalid_tenant_key", "tenantKey is required.");
          return;
        }

        const items = await services.platform.listWorkspaces({ tenantKey });
        sendJson<ListWorkspacesResponse>(response, 200, { items });
        return;
      }

      if (request.method === "GET" && workspaceDirectoryCsvExportMatch?.groups) {
        const tenantKey = decodeRouteGroup(
          workspaceDirectoryCsvExportMatch.groups.tenantKey
        );
        if (!tenantKey) {
          sendError(response, 400, "invalid_tenant_key", "tenantKey is required.");
          return;
        }

        const csv = await services.platform.exportWorkspacesCsv({ tenantKey });
        sendCsv(response, 200, `${tenantKey}-workspaces.csv`, csv);
        return;
      }

      if (request.method === "POST" && workspaceCreateMatch?.groups) {
        const tenantKey = decodeRouteGroup(workspaceCreateMatch.groups.tenantKey);
        if (!tenantKey) {
          sendError(response, 400, "invalid_tenant_key", "tenantKey is required.");
          return;
        }

        const body = await readRequestJsonBody<CreateWorkspaceRequest>();
        const workspace = await services.platform.createWorkspace({
          tenantKey,
          workspaceKey: body.workspaceKey,
          displayName: body.displayName
        });
        sendJson<CreateWorkspaceResponse>(response, 201, { workspace });
        return;
      }

      const workspaceOverviewMatch = workspaceOverviewPattern.exec(pathname);
      const workspaceOverviewCsvExportMatch =
        workspaceOverviewCsvExportPattern.exec(pathname);
      const studyMonitorSummaryMatch = studyMonitorSummaryPattern.exec(pathname);
      const studyMonitorParticipantMatrixMatch =
        studyMonitorParticipantMatrixPattern.exec(pathname);
      const studyMonitorParticipantMatch =
        studyMonitorParticipantPattern.exec(pathname);
      const studyMonitorGroupMatch = studyMonitorGroupPattern.exec(pathname);
      const studyMonitorBookletMatch = studyMonitorBookletPattern.exec(pathname);
      const studyMonitorUnitMatch = studyMonitorUnitPattern.exec(pathname);
      const studyMonitorRunMatch = studyMonitorRunPattern.exec(pathname);
      if (request.method === "PATCH" && workspaceOverviewMatch?.groups) {
        const tenantKey = decodeRouteGroup(workspaceOverviewMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(
          workspaceOverviewMatch.groups.workspaceKey
        );
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }

        const body = await readRequestJsonBody<UpdateWorkspaceRequest>();
        const workspace = await services.platform.updateWorkspace({
          tenantKey,
          workspaceKey,
          displayName: body.displayName,
          actorId: operatorAdminUserIdByRequest.get(request)
        });
        sendJson<UpdateWorkspaceResponse>(response, 200, { workspace });
        return;
      }

      if (request.method === "DELETE" && workspaceOverviewMatch?.groups) {
        const tenantKey = decodeRouteGroup(workspaceOverviewMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(
          workspaceOverviewMatch.groups.workspaceKey
        );
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }

        const body = await readRequestJsonBody<DeleteWorkspaceRequest>();
        const deletion = await services.platform.deleteWorkspace({
          tenantKey,
          workspaceKey,
          confirmation: body.confirmation,
          actorId: operatorAdminUserIdByRequest.get(request)
        });
        sendJson<DeleteWorkspaceResponse>(response, 200, { deletion });
        return;
      }

      if (request.method === "GET" && workspaceOverviewCsvExportMatch?.groups) {
        const tenantKey = decodeRouteGroup(
          workspaceOverviewCsvExportMatch.groups.tenantKey
        );
        const workspaceKey = decodeRouteGroup(
          workspaceOverviewCsvExportMatch.groups.workspaceKey
        );
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }

        const csv = await services.workspaceAdminRead.exportWorkspaceOverviewCsv({
          tenantKey,
          workspaceKey
        });
        sendCsv(response, 200, `${workspaceKey}-workspace-overview.csv`, csv);
        return;
      }

      if (request.method === "GET" && workspaceOverviewMatch?.groups) {
        const tenantKey = decodeRouteGroup(workspaceOverviewMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(
          workspaceOverviewMatch.groups.workspaceKey
        );
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }

        const workspaceOverview =
          await services.workspaceAdminRead.getWorkspaceOverview({
            tenantKey,
            workspaceKey
          });
        sendJson<GetWorkspaceOverviewResponse>(response, 200, {
          workspaceOverview
        });
        return;
      }

      if (request.method === "GET" && studyMonitorSummaryMatch?.groups) {
        const tenantKey = decodeRouteGroup(
          studyMonitorSummaryMatch.groups.tenantKey
        );
        const workspaceKey = decodeRouteGroup(
          studyMonitorSummaryMatch.groups.workspaceKey
        );
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }

        const studyMonitorSummary =
          await services.workspaceAdminRead.getStudyMonitorSummary({
            tenantKey,
            workspaceKey
          });
        sendJson<GetStudyMonitorSummaryResponse>(response, 200, {
          studyMonitorSummary
        });
        return;
      }

      if (
        request.method === "GET" &&
        studyMonitorParticipantMatrixMatch?.groups
      ) {
        const tenantKey = decodeRouteGroup(
          studyMonitorParticipantMatrixMatch.groups.tenantKey
        );
        const workspaceKey = decodeRouteGroup(
          studyMonitorParticipantMatrixMatch.groups.workspaceKey
        );
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }
        const matrixQuery = parseStudyMonitorParticipantMatrixQuery(
          url,
          response
        );
        if (!matrixQuery) {
          return;
        }

        const studyMonitorParticipantMatrix =
          await services.workspaceAdminRead.getStudyMonitorParticipantMatrix({
            tenantKey,
            workspaceKey,
            ...matrixQuery
          });
        sendJson<GetStudyMonitorParticipantMatrixResponse>(response, 200, {
          studyMonitorParticipantMatrix
        });
        return;
      }

      if (request.method === "GET" && studyMonitorParticipantMatch?.groups) {
        const tenantKey = decodeRouteGroup(
          studyMonitorParticipantMatch.groups.tenantKey
        );
        const workspaceKey = decodeRouteGroup(
          studyMonitorParticipantMatch.groups.workspaceKey
        );
        const loginKey = decodeRouteGroup(
          studyMonitorParticipantMatch.groups.loginKey
        );
        if (!tenantKey || !workspaceKey || !loginKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey, workspaceKey, and loginKey are required."
          );
          return;
        }

        const studyMonitorParticipant =
          await services.workspaceAdminRead.getStudyMonitorParticipantDetail({
            tenantKey,
            workspaceKey,
            loginKey
          });
        sendJson<GetStudyMonitorParticipantResponse>(response, 200, {
          studyMonitorParticipant
        });
        return;
      }

      if (request.method === "GET" && studyMonitorGroupMatch?.groups) {
        const tenantKey = decodeRouteGroup(studyMonitorGroupMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(
          studyMonitorGroupMatch.groups.workspaceKey
        );
        const groupKey = decodeRouteGroup(studyMonitorGroupMatch.groups.groupKey);
        if (!tenantKey || !workspaceKey || !groupKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey, workspaceKey, and groupKey are required."
          );
          return;
        }

        const studyMonitorGroup =
          await services.workspaceAdminRead.getStudyMonitorGroupDetail({
            tenantKey,
            workspaceKey,
            groupKey
          });
        sendJson<GetStudyMonitorGroupResponse>(response, 200, {
          studyMonitorGroup
        });
        return;
      }

      if (request.method === "GET" && studyMonitorBookletMatch?.groups) {
        const tenantKey = decodeRouteGroup(
          studyMonitorBookletMatch.groups.tenantKey
        );
        const workspaceKey = decodeRouteGroup(
          studyMonitorBookletMatch.groups.workspaceKey
        );
        const bookletKey = decodeRouteGroup(
          studyMonitorBookletMatch.groups.bookletKey
        );
        if (!tenantKey || !workspaceKey || !bookletKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey, workspaceKey, and bookletKey are required."
          );
          return;
        }

        const studyMonitorBooklet =
          await services.workspaceAdminRead.getStudyMonitorBookletDetail({
            tenantKey,
            workspaceKey,
            bookletKey
          });
        sendJson<GetStudyMonitorBookletResponse>(response, 200, {
          studyMonitorBooklet
        });
        return;
      }

      if (request.method === "GET" && studyMonitorUnitMatch?.groups) {
        const tenantKey = decodeRouteGroup(studyMonitorUnitMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(
          studyMonitorUnitMatch.groups.workspaceKey
        );
        const unitKey = decodeRouteGroup(studyMonitorUnitMatch.groups.unitKey);
        if (!tenantKey || !workspaceKey || !unitKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey, workspaceKey, and unitKey are required."
          );
          return;
        }

        const studyMonitorUnit =
          await services.workspaceAdminRead.getStudyMonitorUnitDetail({
            tenantKey,
            workspaceKey,
            unitKey
          });
        sendJson<GetStudyMonitorUnitResponse>(response, 200, {
          studyMonitorUnit
        });
        return;
      }

      if (request.method === "GET" && studyMonitorRunMatch?.groups) {
        const tenantKey = decodeRouteGroup(studyMonitorRunMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(
          studyMonitorRunMatch.groups.workspaceKey
        );
        const testRunId = decodeRouteGroup(
          studyMonitorRunMatch.groups.testRunId
        );
        if (!tenantKey || !workspaceKey || !testRunId) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey, workspaceKey, and testRunId are required."
          );
          return;
        }

        const studyMonitorRun =
          await services.workspaceAdminRead.getStudyMonitorRunDetail({
            tenantKey,
            workspaceKey,
            testRunId
          });
        sendJson<GetStudyMonitorRunResponse>(response, 200, {
          studyMonitorRun
        });
        return;
      }

      const workspaceActivityEventListMatch =
        workspaceActivityEventListPattern.exec(pathname);
      if (request.method === "GET" && workspaceActivityEventListMatch?.groups) {
        const tenantKey = decodeRouteGroup(
          workspaceActivityEventListMatch.groups.tenantKey
        );
        const workspaceKey = decodeRouteGroup(
          workspaceActivityEventListMatch.groups.workspaceKey
        );
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }

        const eventType = url.searchParams.get("eventType")?.trim() || undefined;
        if (
          eventType &&
          !workspaceActivityEventTypes.includes(eventType as WorkspaceActivityEventType)
        ) {
          sendError(
            response,
            400,
            "workspace_activity_event_type_invalid",
            `Workspace activity event type '${eventType}' is not supported.`
          );
          return;
        }

        const subjectType =
          url.searchParams.get("subjectType")?.trim() || undefined;
        if (
          subjectType &&
          !workspaceActivitySubjectTypes.includes(
            subjectType as WorkspaceActivitySubjectType
          )
        ) {
          sendError(
            response,
            400,
            "workspace_activity_subject_type_invalid",
            `Workspace activity subject type '${subjectType}' is not supported.`
          );
          return;
        }

        const subjectId = url.searchParams.get("subjectId")?.trim() || undefined;
        const limitRawValue = url.searchParams.get("limit")?.trim() || undefined;
        const limit = limitRawValue
          ? Number.parseInt(limitRawValue, 10)
          : undefined;
        if (
          limitRawValue &&
          (!/^\d+$/.test(limitRawValue) || !limit || limit < 1 || limit > 500)
        ) {
          sendError(
            response,
            400,
            "workspace_activity_limit_invalid",
            "Workspace activity limit must be an integer between 1 and 500."
          );
          return;
        }

        const items = await services.workspaceAdminRead.listWorkspaceActivityEvents({
          tenantKey,
          workspaceKey,
          eventType: eventType as WorkspaceActivityEventType | undefined,
          subjectType: subjectType as WorkspaceActivitySubjectType | undefined,
          subjectId,
          limit
        });
        sendJson<ListWorkspaceActivityEventsResponse>(response, 200, { items });
        return;
      }

      const attachmentListMatch = attachmentListPattern.exec(pathname);
      const attachmentPagesPdfMatch = attachmentPagesPdfPattern.exec(pathname);
      const attachmentDetailMatch = attachmentDetailPattern.exec(pathname);
      const attachmentPagePdfMatch = attachmentPagePdfPattern.exec(pathname);
      const attachmentFileUploadMatch =
        attachmentFileUploadPattern.exec(pathname);
      const attachmentFileDetailMatch =
        attachmentFileDetailPattern.exec(pathname);
      if (request.method === "GET" && attachmentPagesPdfMatch?.groups) {
        const sessionToken = requireBearerToken(request, response);
        if (!sessionToken) return;
        const tenantKey = decodeRouteGroup(
          attachmentPagesPdfMatch.groups.tenantKey
        );
        const workspaceKey = decodeRouteGroup(
          attachmentPagesPdfMatch.groups.workspaceKey
        );
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }
        const labelTemplate = url.searchParams.get("labelTemplate");
        if (labelTemplate && labelTemplate.length > 500) {
          sendError(
            response,
            400,
            "attachment_label_template_too_long",
            "Attachment page label templates may contain at most 500 characters."
          );
          return;
        }
        const attachments = (
          await services.attachments.listAttachments({
            sessionToken,
            tenantKey,
            workspaceKey,
            groupKey: url.searchParams.get("groupKey")?.trim() || undefined
          })
        ).filter(attachment => attachment.attachmentType === "capture-image");
        if (attachments.length === 0) {
          sendError(
            response,
            404,
            "attachment_pages_empty",
            "No requested attachments are available for this scope."
          );
          return;
        }
        if (attachments.length > 500) {
          sendError(
            response,
            400,
            "attachment_page_limit_exceeded",
            "Narrow the attachment scope to at most 500 printable pages.",
            { attachmentCount: attachments.length, maxAttachmentCount: 500 }
          );
          return;
        }
        const pdf = await createAttachmentPagesPdf({
          attachments,
          labelTemplate
        });
        sendAsset(response, 200, "application/pdf", pdf, {
          "content-disposition": buildAttachmentContentDisposition(
            `${workspaceKey}-attachment-pages.pdf`
          ),
          "cache-control": "private, no-store"
        });
        return;
      }

      if (request.method === "GET" && attachmentPagePdfMatch?.groups) {
        const sessionToken = requireBearerToken(request, response);
        if (!sessionToken) return;
        const tenantKey = decodeRouteGroup(
          attachmentPagePdfMatch.groups.tenantKey
        );
        const workspaceKey = decodeRouteGroup(
          attachmentPagePdfMatch.groups.workspaceKey
        );
        const attachmentId = decodeRouteGroup(
          attachmentPagePdfMatch.groups.attachmentId
        );
        if (!tenantKey || !workspaceKey || !attachmentId) {
          sendError(
            response,
            400,
            "invalid_attachment_scope",
            "tenantKey, workspaceKey, and attachmentId are required."
          );
          return;
        }
        const labelTemplate = url.searchParams.get("labelTemplate");
        if (labelTemplate && labelTemplate.length > 500) {
          sendError(
            response,
            400,
            "attachment_label_template_too_long",
            "Attachment page label templates may contain at most 500 characters."
          );
          return;
        }
        const attachment = await services.attachments.getAttachment({
          sessionToken,
          tenantKey,
          workspaceKey,
          attachmentId
        });
        if (attachment.attachmentType !== "capture-image") {
          sendError(
            response,
            409,
            "attachment_capture_type_unsupported",
            `Attachment type '${attachment.attachmentType || "unspecified"}' is retained for compatibility but does not support capture pages.`
          );
          return;
        }
        const pdf = await createAttachmentPagesPdf({
          attachments: [attachment],
          labelTemplate
        });
        sendAsset(response, 200, "application/pdf", pdf, {
          "content-disposition": buildAttachmentContentDisposition(
            `${attachment.loginKey}-${attachment.variableId}-attachment-page.pdf`
          ),
          "cache-control": "private, no-store"
        });
        return;
      }

      if (request.method === "GET" && attachmentListMatch?.groups) {
        const sessionToken = requireBearerToken(request, response);
        if (!sessionToken) {
          return;
        }
        const tenantKey = decodeRouteGroup(attachmentListMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(
          attachmentListMatch.groups.workspaceKey
        );
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }
        const items = await services.attachments.listAttachments({
          sessionToken,
          tenantKey,
          workspaceKey,
          groupKey: url.searchParams.get("groupKey")?.trim() || undefined
        });
        sendJson<ListAttachmentsResponse>(response, 200, { items });
        return;
      }

      if (request.method === "GET" && attachmentFileDetailMatch?.groups) {
        const sessionToken = requireBearerToken(request, response);
        if (!sessionToken) {
          return;
        }
        const tenantKey = decodeRouteGroup(
          attachmentFileDetailMatch.groups.tenantKey
        );
        const workspaceKey = decodeRouteGroup(
          attachmentFileDetailMatch.groups.workspaceKey
        );
        const attachmentId = decodeRouteGroup(
          attachmentFileDetailMatch.groups.attachmentId
        );
        const attachmentFileId = decodeRouteGroup(
          attachmentFileDetailMatch.groups.attachmentFileId
        );
        if (!tenantKey || !workspaceKey || !attachmentId || !attachmentFileId) {
          sendError(
            response,
            400,
            "invalid_attachment_scope",
            "tenantKey, workspaceKey, attachmentId, and attachmentFileId are required."
          );
          return;
        }
        const attachmentFile = await services.attachments.getAttachmentFile({
          sessionToken,
          tenantKey,
          workspaceKey,
          attachmentId,
          attachmentFileId
        });
        const body = Buffer.from(attachmentFile.dataBase64, "base64");
        sendAsset(response, 200, attachmentFile.mediaType, body, {
          "content-disposition": buildAttachmentContentDisposition(
            attachmentFile.fileName
          ).replace(/^attachment;/, "inline;"),
          "content-length": String(body.byteLength),
          "cache-control": "no-store"
        });
        return;
      }

      if (request.method === "DELETE" && attachmentFileDetailMatch?.groups) {
        const sessionToken = requireBearerToken(request, response);
        if (!sessionToken) {
          return;
        }
        const tenantKey = decodeRouteGroup(
          attachmentFileDetailMatch.groups.tenantKey
        );
        const workspaceKey = decodeRouteGroup(
          attachmentFileDetailMatch.groups.workspaceKey
        );
        const attachmentId = decodeRouteGroup(
          attachmentFileDetailMatch.groups.attachmentId
        );
        const attachmentFileId = decodeRouteGroup(
          attachmentFileDetailMatch.groups.attachmentFileId
        );
        if (!tenantKey || !workspaceKey || !attachmentId || !attachmentFileId) {
          sendError(
            response,
            400,
            "invalid_attachment_scope",
            "tenantKey, workspaceKey, attachmentId, and attachmentFileId are required."
          );
          return;
        }
        const attachment = await services.attachments.deleteAttachmentFile({
          sessionToken,
          tenantKey,
          workspaceKey,
          attachmentId,
          attachmentFileId
        });
        sendJson<DeleteAttachmentFileResponse>(response, 200, { attachment });
        return;
      }

      if (request.method === "POST" && attachmentFileUploadMatch?.groups) {
        const sessionToken = requireBearerToken(request, response);
        if (!sessionToken) {
          return;
        }
        const tenantKey = decodeRouteGroup(
          attachmentFileUploadMatch.groups.tenantKey
        );
        const workspaceKey = decodeRouteGroup(
          attachmentFileUploadMatch.groups.workspaceKey
        );
        const attachmentId = decodeRouteGroup(
          attachmentFileUploadMatch.groups.attachmentId
        );
        if (!tenantKey || !workspaceKey || !attachmentId) {
          sendError(
            response,
            400,
            "invalid_attachment_scope",
            "tenantKey, workspaceKey, and attachmentId are required."
          );
          return;
        }
        const contentTypeHeader = request.headers["content-type"];
        const contentType = Array.isArray(contentTypeHeader)
          ? contentTypeHeader[0] ?? ""
          : contentTypeHeader ?? "";
        const body = /^multipart\/form-data(?:;|$)/i.test(contentType)
          ? await readMultipartAttachmentUpload(
              request,
              contentType,
              runtime.config.maxSourcePackageJsonBodyBytes
            )
          : await readSourcePackageRequestJsonBody<UploadAttachmentFileRequest>();
        const attachment = await services.attachments.uploadAttachmentFile({
          sessionToken,
          tenantKey,
          workspaceKey,
          attachmentId,
          fileName: String(body.fileName ?? ""),
          mediaType: String(body.mediaType ?? ""),
          dataBase64: String(body.dataBase64 ?? "")
        });
        sendJson<UploadAttachmentFileResponse>(response, 201, { attachment });
        return;
      }

      if (request.method === "GET" && attachmentDetailMatch?.groups) {
        const sessionToken = requireBearerToken(request, response);
        if (!sessionToken) {
          return;
        }
        const tenantKey = decodeRouteGroup(attachmentDetailMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(
          attachmentDetailMatch.groups.workspaceKey
        );
        const attachmentId = decodeRouteGroup(
          attachmentDetailMatch.groups.attachmentId
        );
        if (!tenantKey || !workspaceKey || !attachmentId) {
          sendError(
            response,
            400,
            "invalid_attachment_scope",
            "tenantKey, workspaceKey, and attachmentId are required."
          );
          return;
        }
        const attachment = await services.attachments.getAttachment({
          sessionToken,
          tenantKey,
          workspaceKey,
          attachmentId
        });
        sendJson<GetAttachmentResponse>(response, 200, { attachment });
        return;
      }

      const sourcePackageCreateMatch = sourcePackageCreatePattern.exec(pathname);
      const sourcePackageAssemblyMatch = sourcePackageAssemblyPattern.exec(pathname);
      const sourcePackageListMatch = sourcePackageListPattern.exec(pathname);
      const sourcePackageDetailMatch = sourcePackageDetailPattern.exec(pathname);
      const sourcePackageDownloadMatch = sourcePackageDownloadPattern.exec(pathname);
      const sourcePackageDeletionReadinessMatch =
        sourcePackageDeletionReadinessPattern.exec(pathname);
      const sourcePackageDeleteMatch = sourcePackageDeletePattern.exec(pathname);
      const sourcePackageBatchDeleteMatch =
        sourcePackageBatchDeletePattern.exec(pathname);
      const sourcePackageReplaceMatch = sourcePackageReplacePattern.exec(pathname);
      const sourcePackageCsvExportMatch =
        sourcePackageCsvExportPattern.exec(pathname);
      const sourcePackageRetryImportMatch =
        sourcePackageRetryImportPattern.exec(pathname);
      if (request.method === "GET" && sourcePackageListMatch?.groups) {
        const tenantKey = decodeRouteGroup(sourcePackageListMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(
          sourcePackageListMatch.groups.workspaceKey
        );
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }

        const query = parseSourcePackageListQuery(url, response);
        if (!query) {
          return;
        }

        const result = await services.workspaceAdminRead.listSourcePackages({
          tenantKey,
          workspaceKey,
          ...query
        });
        sendJson<ListSourcePackagesResponse>(response, 200, result);
        return;
      }

      if (request.method === "GET" && sourcePackageCsvExportMatch?.groups) {
        const tenantKey = decodeRouteGroup(
          sourcePackageCsvExportMatch.groups.tenantKey
        );
        const workspaceKey = decodeRouteGroup(
          sourcePackageCsvExportMatch.groups.workspaceKey
        );
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }

        const query = parseSourcePackageListQuery(url, response);
        if (!query) {
          return;
        }

        const csv = await services.workspaceAdminRead.exportSourcePackagesCsv({
          tenantKey,
          workspaceKey,
          ...query
        });
        sendCsv(response, 200, `${workspaceKey}-source-packages.csv`, csv);
        return;
      }

      if (request.method === "GET" && sourcePackageDownloadMatch?.groups) {
        const tenantKey = decodeRouteGroup(
          sourcePackageDownloadMatch.groups.tenantKey
        );
        const workspaceKey = decodeRouteGroup(
          sourcePackageDownloadMatch.groups.workspaceKey
        );
        const sourcePackageId = decodeRouteGroup(
          sourcePackageDownloadMatch.groups.sourcePackageId
        );
        if (!tenantKey || !workspaceKey || !sourcePackageId) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey, workspaceKey, and sourcePackageId are required."
          );
          return;
        }

        const download = await services.workspaceAdminRead.downloadSourcePackage({
          tenantKey,
          workspaceKey,
          sourcePackageId
        });
        const body = Buffer.from(download.dataBase64, "base64");
        sendAsset(response, 200, download.mediaType, body, {
          "content-disposition": buildAttachmentContentDisposition(download.fileName),
          "content-length": String(body.byteLength)
        });
        return;
      }

      if (
        request.method === "GET" &&
        sourcePackageDeletionReadinessMatch?.groups
      ) {
        const tenantKey = decodeRouteGroup(
          sourcePackageDeletionReadinessMatch.groups.tenantKey
        );
        const workspaceKey = decodeRouteGroup(
          sourcePackageDeletionReadinessMatch.groups.workspaceKey
        );
        const sourcePackageId = decodeRouteGroup(
          sourcePackageDeletionReadinessMatch.groups.sourcePackageId
        );
        if (!tenantKey || !workspaceKey || !sourcePackageId) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey, workspaceKey, and sourcePackageId are required."
          );
          return;
        }

        const deletionReadiness =
          await services.workspaceAdminRead.getSourcePackageDeletionReadiness({
            tenantKey,
            workspaceKey,
            sourcePackageId
          });
        sendJson<GetSourcePackageDeletionReadinessResponse>(response, 200, {
          deletionReadiness
        });
        return;
      }

      if (request.method === "DELETE" && sourcePackageDeleteMatch?.groups) {
        const tenantKey = decodeRouteGroup(sourcePackageDeleteMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(
          sourcePackageDeleteMatch.groups.workspaceKey
        );
        const sourcePackageId = decodeRouteGroup(
          sourcePackageDeleteMatch.groups.sourcePackageId
        );
        if (!tenantKey || !workspaceKey || !sourcePackageId) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey, workspaceKey, and sourcePackageId are required."
          );
          return;
        }

        const body = await readRequestJsonBody<DeleteSourcePackageRequest>();
        const deletion = await services.contentIntake.deleteSourcePackage({
          tenantKey,
          workspaceKey,
          sourcePackageId,
          confirmation: body.confirmation
        });
        sendJson<DeleteSourcePackageResponse>(response, 200, { deletion });
        return;
      }

      if (
        request.method === "POST" &&
        sourcePackageBatchDeleteMatch?.groups
      ) {
        const tenantKey = decodeRouteGroup(
          sourcePackageBatchDeleteMatch.groups.tenantKey
        );
        const workspaceKey = decodeRouteGroup(
          sourcePackageBatchDeleteMatch.groups.workspaceKey
        );
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }

        const body = await readRequestJsonBody<DeleteSourcePackagesRequest>();
        if (!Array.isArray(body.items) || body.items.length < 1 || body.items.length > 200) {
          sendError(
            response,
            400,
            "source_package_delete_batch_invalid",
            "Batch deletion requires between 1 and 200 source-package items."
          );
          return;
        }
        const normalizedItems = body.items.map(item => ({
          sourcePackageId:
            typeof item?.sourcePackageId === "string"
              ? item.sourcePackageId.trim()
              : "",
          confirmation:
            typeof item?.confirmation === "string" ? item.confirmation : ""
        }));
        if (
          normalizedItems.some(item => !item.sourcePackageId) ||
          new Set(normalizedItems.map(item => item.sourcePackageId)).size !==
            normalizedItems.length
        ) {
          sendError(
            response,
            400,
            "source_package_delete_batch_invalid",
            "Every batch item requires a unique sourcePackageId."
          );
          return;
        }

        const report: DeleteSourcePackagesResponse["report"] = {
          requestedCount: normalizedItems.length,
          deleted: [],
          didNotExist: [],
          notAllowed: [],
          wasUsed: [],
          errors: []
        };
        for (const item of normalizedItems) {
          try {
            report.deleted.push(
              await services.contentIntake.deleteSourcePackage({
                tenantKey,
                workspaceKey,
                sourcePackageId: item.sourcePackageId,
                confirmation: item.confirmation
              })
            );
          } catch (error) {
            const issue = isFirstSliceError(error)
              ? {
                  sourcePackageId: item.sourcePackageId,
                  fileName: item.confirmation || null,
                  error: String(error.errorCode),
                  message: error.message,
                  ...(error.details === undefined ? {} : { details: error.details })
                }
              : {
                  sourcePackageId: item.sourcePackageId,
                  fileName: item.confirmation || null,
                  error: "unexpected_error",
                  message: "Source package deletion failed unexpectedly."
                };
            if (issue.error === "source_package_not_found") {
              report.didNotExist.push(issue);
            } else if (
              issue.error === "source_package_delete_confirmation_mismatch"
            ) {
              report.notAllowed.push(issue);
            } else if (issue.error === "source_package_delete_blocked") {
              report.wasUsed.push(issue);
            } else {
              report.errors.push(issue);
            }
          }
        }
        sendJson<DeleteSourcePackagesResponse>(response, 200, { report });
        return;
      }

      if (request.method === "POST" && sourcePackageReplaceMatch?.groups) {
        const tenantKey = decodeRouteGroup(sourcePackageReplaceMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(
          sourcePackageReplaceMatch.groups.workspaceKey
        );
        const sourcePackageId = decodeRouteGroup(
          sourcePackageReplaceMatch.groups.sourcePackageId
        );
        if (!tenantKey || !workspaceKey || !sourcePackageId) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey, workspaceKey, and sourcePackageId are required."
          );
          return;
        }

        const body =
          await readSourcePackageRequestJsonBody<ReplaceSourcePackageRequest>();
        const replacement = await services.contentIntake.replaceSourcePackage({
          tenantKey,
          workspaceKey,
          sourcePackageId,
          fileName: body.fileName,
          mediaType: body.mediaType,
          contentStructure: body.contentStructure,
          sourceDocument: body.sourceDocument
        });
        sendJson<ReplaceSourcePackageResponse>(response, 201, replacement);
        return;
      }

      if (request.method === "GET" && sourcePackageDetailMatch?.groups) {
        const tenantKey = decodeRouteGroup(sourcePackageDetailMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(
          sourcePackageDetailMatch.groups.workspaceKey
        );
        const sourcePackageId = decodeRouteGroup(
          sourcePackageDetailMatch.groups.sourcePackageId
        );
        if (!tenantKey || !workspaceKey || !sourcePackageId) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey, workspaceKey, and sourcePackageId are required."
          );
          return;
        }

        const sourcePackageDetail =
          await services.workspaceAdminRead.getSourcePackageDetail({
            tenantKey,
            workspaceKey,
            sourcePackageId
          });
        sendJson<GetSourcePackageResponse>(response, 200, { sourcePackageDetail });
        return;
      }

      if (request.method === "POST" && sourcePackageRetryImportMatch?.groups) {
        const tenantKey = decodeRouteGroup(sourcePackageRetryImportMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(
          sourcePackageRetryImportMatch.groups.workspaceKey
        );
        const sourcePackageId = decodeRouteGroup(
          sourcePackageRetryImportMatch.groups.sourcePackageId
        );
        if (!tenantKey || !workspaceKey || !sourcePackageId) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey, workspaceKey, and sourcePackageId are required."
          );
          return;
        }

        const body =
          await readSourcePackageRequestJsonBody<RetrySourcePackageImportRequest>();
        const result = await services.contentIntake.retrySourcePackageImport({
          tenantKey,
          workspaceKey,
          sourcePackageId,
          fileName: body.fileName,
          mediaType: body.mediaType,
          contentStructure: body.contentStructure,
          sourceDocument: body.sourceDocument
        });
        sendJson<RetrySourcePackageImportResponse>(response, 200, result);
        return;
      }

      if (request.method === "POST" && sourcePackageCreateMatch?.groups) {
        const tenantKey = decodeRouteGroup(sourcePackageCreateMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(
          sourcePackageCreateMatch.groups.workspaceKey
        );
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }

        const body =
          await readSourcePackageRequestJsonBody<CreateSourcePackageRequest>();
        const sourcePackage = await services.contentIntake.createSourcePackage({
          tenantKey,
          workspaceKey,
          fileName: body.fileName,
          mediaType: body.mediaType,
          contentStructure: body.contentStructure,
          sourceDocument: body.sourceDocument
        });
        sendJson<CreateSourcePackageResponse>(response, 201, { sourcePackage });
        return;
      }

      if (request.method === "POST" && sourcePackageAssemblyMatch?.groups) {
        const tenantKey = decodeRouteGroup(sourcePackageAssemblyMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(
          sourcePackageAssemblyMatch.groups.workspaceKey
        );
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }

        const body = await readRequestJsonBody<AssembleSourcePackagesRequest>();
        const result = await services.contentIntake.assembleSourcePackages({
          tenantKey,
          workspaceKey,
          fileName: body.fileName,
          sourcePackageIds: body.sourcePackageIds
        });
        sendJson<AssembleSourcePackagesResponse>(response, 201, result);
        return;
      }

      const importJobCreateMatch = importJobCreatePattern.exec(pathname);
      const importJobListMatch = importJobListPattern.exec(pathname);
      const importJobDetailMatch = importJobDetailPattern.exec(pathname);
      const importJobCsvExportMatch = importJobCsvExportPattern.exec(pathname);
      const participantSessionListMatch = participantSessionListPattern.exec(pathname);
      const participantSessionDetailMatch =
        participantSessionDetailPattern.exec(pathname);
      const participantSessionCsvExportMatch =
        participantSessionCsvExportPattern.exec(pathname);
      const participantRosterMatch = participantRosterPattern.exec(pathname);
      const participantRosterCsvExportMatch =
        participantRosterCsvExportPattern.exec(pathname);
      const detailedResponsesMatch = detailedResponsesPattern.exec(pathname);
      const groupResultsMatch = groupResultsPattern.exec(pathname);
      const reviewListMatch = reviewListPattern.exec(pathname);
      const reviewDetailMatch = reviewDetailPattern.exec(pathname);
      const deleteGroupResultsMatch = deleteGroupResultsPattern.exec(pathname);
      const studyMonitorCsvExportMatch =
        studyMonitorCsvExportPattern.exec(pathname);
      const studyMonitorParticipantMatrixCsvExportMatch =
        studyMonitorParticipantMatrixCsvExportPattern.exec(pathname);
      const studyMonitorRunCsvExportMatch =
        studyMonitorRunCsvExportPattern.exec(pathname);
      const openRunsCsvExportMatch = openRunsCsvExportPattern.exec(pathname);
      const responseCsvExportMatch = responseCsvExportPattern.exec(pathname);
      const originalResultArchiveExportMatch =
        originalResultArchiveExportPattern.exec(pathname);
      const logCsvExportMatch = logCsvExportPattern.exec(pathname);
      const activityCsvExportMatch = activityCsvExportPattern.exec(pathname);
      const participantTestLogListMatch =
        participantTestLogListPattern.exec(pathname);
      const reviewCsvExportMatch = reviewCsvExportPattern.exec(pathname);
      if (request.method === "GET" && importJobListMatch?.groups) {
        const tenantKey = decodeRouteGroup(importJobListMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(importJobListMatch.groups.workspaceKey);
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }

        const query = parseImportJobListQuery(url, response);
        if (!query) {
          return;
        }

        const items = await services.workspaceAdminRead.listImportJobs({
          tenantKey,
          workspaceKey,
          ...query
        });
        sendJson<ListImportJobsResponse>(response, 200, { items });
        return;
      }

      if (request.method === "GET" && importJobCsvExportMatch?.groups) {
        const tenantKey = decodeRouteGroup(importJobCsvExportMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(
          importJobCsvExportMatch.groups.workspaceKey
        );
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }

        const query = parseImportJobListQuery(url, response);
        if (!query) {
          return;
        }

        const csv = await services.workspaceAdminRead.exportImportJobsCsv({
          tenantKey,
          workspaceKey,
          ...query
        });
        sendCsv(response, 200, `${workspaceKey}-import-jobs.csv`, csv);
        return;
      }

      if (request.method === "GET" && importJobDetailMatch?.groups) {
        const tenantKey = decodeRouteGroup(importJobDetailMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(importJobDetailMatch.groups.workspaceKey);
        const importJobId = decodeRouteGroup(importJobDetailMatch.groups.importJobId);
        if (!tenantKey || !workspaceKey || !importJobId) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey, workspaceKey, and importJobId are required."
          );
          return;
        }

        const importJobDetail = await services.workspaceAdminRead.getImportJobDetail({
          tenantKey,
          workspaceKey,
          importJobId
        });
        sendJson<GetImportJobResponse>(response, 200, { importJobDetail });
        return;
      }

      if (request.method === "GET" && participantSessionListMatch?.groups) {
        const tenantKey = decodeRouteGroup(participantSessionListMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(
          participantSessionListMatch.groups.workspaceKey
        );
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }

        const status = url.searchParams.get("status")?.trim() || undefined;
        if (
          status &&
          !participantSessionStatuses.includes(status as ParticipantSessionStatus)
        ) {
          sendError(
            response,
            400,
            "participant_session_status_invalid",
            `Participant session status '${status}' is not supported.`
          );
          return;
        }

        const groupKey = url.searchParams.get("groupKey")?.trim() || undefined;
        const loginKey = url.searchParams.get("loginKey")?.trim() || undefined;
        const bookletKey =
          url.searchParams.get("bookletKey")?.trim() || undefined;
        const contentReleaseId =
          url.searchParams.get("contentReleaseId")?.trim() || undefined;
        const limitRawValue = url.searchParams.get("limit")?.trim() || undefined;
        const limit = limitRawValue
          ? Number.parseInt(limitRawValue, 10)
          : undefined;
        if (
          limitRawValue &&
          (!/^\d+$/.test(limitRawValue) || !limit || limit < 1 || limit > 500)
        ) {
          sendError(
            response,
            400,
            "participant_session_limit_invalid",
            "Participant session limit must be an integer between 1 and 500."
          );
          return;
        }

        const items = await services.workspaceAdminRead.listParticipantSessions({
          tenantKey,
          workspaceKey,
          status: status as ParticipantSessionStatus | undefined,
          groupKey,
          loginKey,
          bookletKey,
          contentReleaseId,
          limit
        });
        sendJson<ListParticipantSessionsResponse>(response, 200, { items });
        return;
      }

      if (request.method === "GET" && participantSessionCsvExportMatch?.groups) {
        const tenantKey = decodeRouteGroup(
          participantSessionCsvExportMatch.groups.tenantKey
        );
        const workspaceKey = decodeRouteGroup(
          participantSessionCsvExportMatch.groups.workspaceKey
        );
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }

        const status = url.searchParams.get("status")?.trim() || undefined;
        if (
          status &&
          !participantSessionStatuses.includes(status as ParticipantSessionStatus)
        ) {
          sendError(
            response,
            400,
            "participant_session_status_invalid",
            `Participant session status '${status}' is not supported.`
          );
          return;
        }

        const groupKey = url.searchParams.get("groupKey")?.trim() || undefined;
        const loginKey = url.searchParams.get("loginKey")?.trim() || undefined;
        const bookletKey =
          url.searchParams.get("bookletKey")?.trim() || undefined;
        const contentReleaseId =
          url.searchParams.get("contentReleaseId")?.trim() || undefined;
        const limitRawValue = url.searchParams.get("limit")?.trim() || undefined;
        const limit = limitRawValue
          ? Number.parseInt(limitRawValue, 10)
          : undefined;
        if (
          limitRawValue &&
          (!/^\d+$/.test(limitRawValue) || !limit || limit < 1 || limit > 500)
        ) {
          sendError(
            response,
            400,
            "participant_session_limit_invalid",
            "Participant session limit must be an integer between 1 and 500."
          );
          return;
        }

        const csv = await services.workspaceAdminRead.exportParticipantSessionsCsv({
          tenantKey,
          workspaceKey,
          status: status as ParticipantSessionStatus | undefined,
          groupKey,
          loginKey,
          bookletKey,
          contentReleaseId,
          limit
        });
        sendCsv(response, 200, `${workspaceKey}-participant-sessions.csv`, csv);
        return;
      }

      if (request.method === "GET" && participantSessionDetailMatch?.groups) {
        const tenantKey = decodeRouteGroup(
          participantSessionDetailMatch.groups.tenantKey
        );
        const workspaceKey = decodeRouteGroup(
          participantSessionDetailMatch.groups.workspaceKey
        );
        const participantSessionId = decodeRouteGroup(
          participantSessionDetailMatch.groups.participantSessionId
        );
        if (!tenantKey || !workspaceKey || !participantSessionId) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey, workspaceKey, and participantSessionId are required."
          );
          return;
        }

        const participantSessionDetail =
          await services.workspaceAdminRead.getParticipantSessionDetail({
            tenantKey,
            workspaceKey,
            participantSessionId
          });
        sendJson<GetParticipantSessionResponse>(response, 200, {
          participantSessionDetail
        });
        return;
      }

      if (request.method === "GET" && participantRosterMatch?.groups) {
        const tenantKey = decodeRouteGroup(participantRosterMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(
          participantRosterMatch.groups.workspaceKey
        );
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }

        const payload = await services.workspaceAdminRead.listParticipantRoster({
          tenantKey,
          workspaceKey
        });
        sendJson<ListParticipantRosterResponse>(response, 200, payload);
        return;
      }

      if (request.method === "POST" && participantRosterMatch?.groups) {
        const tenantKey = decodeRouteGroup(participantRosterMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(
          participantRosterMatch.groups.workspaceKey
        );
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }

        const body = await readRequestJsonBody<ImportParticipantRosterRequest>();
        const hasSupportedRosterSource =
          typeof body?.rosterText === "string" ||
          Array.isArray(body?.rosterText) ||
          (typeof body?.rosterText === "object" && body.rosterText !== null);
        if (!hasSupportedRosterSource) {
          sendError(
            response,
            400,
            "participant_roster_request_invalid",
            "rosterText must be a string, JSON object, or JSON array."
          );
          return;
        }

        const result = await services.workspaceAdminRead.importParticipantRoster({
          tenantKey,
          workspaceKey,
          rosterText: body.rosterText
        });
        sendJson<ImportParticipantRosterResponse>(response, 201, result);
        return;
      }

      if (request.method === "GET" && detailedResponsesMatch?.groups) {
        const tenantKey = decodeRouteGroup(detailedResponsesMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(
          detailedResponsesMatch.groups.workspaceKey
        );
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }

        const query = parseDetailedResponseListQuery(url, response);
        if (!query) {
          return;
        }

        const items = await services.workspaceAdminRead.listDetailedResponses({
          tenantKey,
          workspaceKey,
          ...query
        });
        sendJson<ListDetailedResponsesResponse>(response, 200, { items });
        return;
      }

      if (request.method === "GET" && groupResultsMatch?.groups) {
        const tenantKey = decodeRouteGroup(groupResultsMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(
          groupResultsMatch.groups.workspaceKey
        );
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }

        const items = await services.workspaceAdminRead.listGroupResults({
          tenantKey,
          workspaceKey
        });
        sendJson<ListGroupResultsResponse>(response, 200, { items });
        return;
      }

      if (request.method === "DELETE" && groupResultsMatch?.groups) {
        const tenantKey = decodeRouteGroup(groupResultsMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(
          groupResultsMatch.groups.workspaceKey
        );
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }
        const body = await readRequestJsonBody<DeleteGroupResultsBulkRequest>();
        const deletion = await services.workspaceResults.deleteGroupResultsBulk({
          tenantKey,
          workspaceKey,
          groupKeys: body.groupKeys,
          confirmation: body.confirmation
        });
        sendJson<DeleteGroupResultsBulkResponse>(response, 200, { deletion });
        return;
      }

      if (request.method === "GET" && participantTestLogListMatch?.groups) {
        const tenantKey = decodeRouteGroup(
          participantTestLogListMatch.groups.tenantKey
        );
        const workspaceKey = decodeRouteGroup(
          participantTestLogListMatch.groups.workspaceKey
        );
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }
        const query = parseParticipantTestLogListQuery(url, response);
        if (!query) {
          return;
        }
        const items = await services.workspaceAdminRead.listParticipantTestLogs({
          tenantKey,
          workspaceKey,
          ...query
        });
        sendJson<ListParticipantTestLogsResponse>(response, 200, { items });
        return;
      }

      if (request.method === "GET" && reviewListMatch?.groups) {
        const tenantKey = decodeRouteGroup(reviewListMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(reviewListMatch.groups.workspaceKey);
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }

        const query = parseWorkspaceReviewListQuery(url, response);
        if (!query) {
          return;
        }

        const items = await services.workspaceReview.listReviews({
          tenantKey,
          workspaceKey,
          ...query
        });
        sendJson<ListReviewsResponse>(response, 200, { items });
        return;
      }

      if (request.method === "POST" && reviewListMatch?.groups) {
        const tenantKey = decodeRouteGroup(reviewListMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(reviewListMatch.groups.workspaceKey);
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }

        const body = await readRequestJsonBody<CreateReviewRequest>();
        const item = await services.workspaceReview.createReview({
          tenantKey,
          workspaceKey,
          participantSessionId: body.participantSessionId,
          testRunId: body.testRunId,
          unitKey: body.unitKey,
          page: body.page,
          pageLabel: body.pageLabel,
          reviewerId: body.reviewerId,
          category: body.category,
          categories: body.categories,
          priority: body.priority,
          comment: body.comment,
          userAgent: requestUserAgent
        });
        sendJson<ReviewResponse>(response, 201, { item });
        return;
      }

      if (request.method === "PATCH" && reviewDetailMatch?.groups) {
        const tenantKey = decodeRouteGroup(reviewDetailMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(reviewDetailMatch.groups.workspaceKey);
        const reviewId = decodeRouteGroup(reviewDetailMatch.groups.reviewId);
        if (!tenantKey || !workspaceKey || !reviewId) {
          sendError(
            response,
            400,
            "invalid_review_scope",
            "tenantKey, workspaceKey, and reviewId are required."
          );
          return;
        }

        const body = await readRequestJsonBody<UpdateReviewRequest>();
        const item = await services.workspaceReview.updateReview({
          tenantKey,
          workspaceKey,
          reviewId,
          unitKey: body.unitKey,
          page: body.page,
          pageLabel: body.pageLabel,
          reviewerId: body.reviewerId,
          category: body.category,
          categories: body.categories,
          priority: body.priority,
          comment: body.comment
        });
        sendJson<ReviewResponse>(response, 200, { item });
        return;
      }

      if (request.method === "DELETE" && reviewDetailMatch?.groups) {
        const tenantKey = decodeRouteGroup(reviewDetailMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(reviewDetailMatch.groups.workspaceKey);
        const reviewId = decodeRouteGroup(reviewDetailMatch.groups.reviewId);
        if (!tenantKey || !workspaceKey || !reviewId) {
          sendError(
            response,
            400,
            "invalid_review_scope",
            "tenantKey, workspaceKey, and reviewId are required."
          );
          return;
        }

        const deletedReviewId = await services.workspaceReview.deleteReview({
          tenantKey,
          workspaceKey,
          reviewId
        });
        sendJson<DeleteReviewResponse>(response, 200, { deletedReviewId });
        return;
      }

      if (request.method === "DELETE" && deleteGroupResultsMatch?.groups) {
        const tenantKey = decodeRouteGroup(deleteGroupResultsMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(
          deleteGroupResultsMatch.groups.workspaceKey
        );
        const groupKey = decodeRouteGroup(deleteGroupResultsMatch.groups.groupKey);
        if (!tenantKey || !workspaceKey || !groupKey) {
          sendError(
            response,
            400,
            "invalid_group_result_scope",
            "tenantKey, workspaceKey, and groupKey are required."
          );
          return;
        }

        const deletion = await services.workspaceResults.deleteGroupResults({
          tenantKey,
          workspaceKey,
          groupKey
        });
        sendJson<DeleteGroupResultsResponse>(response, 200, { deletion });
        return;
      }

      if (request.method === "GET" && studyMonitorCsvExportMatch?.groups) {
        const tenantKey = decodeRouteGroup(
          studyMonitorCsvExportMatch.groups.tenantKey
        );
        const workspaceKey = decodeRouteGroup(
          studyMonitorCsvExportMatch.groups.workspaceKey
        );
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }

        const csv = await services.workspaceAdminRead.exportStudyMonitorCsv({
          tenantKey,
          workspaceKey
        });
        sendCsv(response, 200, `${workspaceKey}-study-monitor.csv`, csv);
        return;
      }

      if (
        request.method === "GET" &&
        studyMonitorParticipantMatrixCsvExportMatch?.groups
      ) {
        const tenantKey = decodeRouteGroup(
          studyMonitorParticipantMatrixCsvExportMatch.groups.tenantKey
        );
        const workspaceKey = decodeRouteGroup(
          studyMonitorParticipantMatrixCsvExportMatch.groups.workspaceKey
        );
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }
        const matrixQuery = parseStudyMonitorParticipantMatrixQuery(
          url,
          response
        );
        if (!matrixQuery) {
          return;
        }

        const csv =
          await services.workspaceAdminRead.exportStudyMonitorParticipantMatrixCsv(
            {
              tenantKey,
              workspaceKey,
              ...matrixQuery
            }
          );
        sendCsv(
          response,
          200,
          `${workspaceKey}-study-monitor-participants.csv`,
          csv
        );
        return;
      }

      if (request.method === "GET" && studyMonitorRunCsvExportMatch?.groups) {
        const tenantKey = decodeRouteGroup(
          studyMonitorRunCsvExportMatch.groups.tenantKey
        );
        const workspaceKey = decodeRouteGroup(
          studyMonitorRunCsvExportMatch.groups.workspaceKey
        );
        const testRunId = decodeRouteGroup(
          studyMonitorRunCsvExportMatch.groups.testRunId
        );
        if (!tenantKey || !workspaceKey || !testRunId) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey, workspaceKey and testRunId are required."
          );
          return;
        }

        const csv = await services.workspaceAdminRead.exportStudyMonitorRunCsv({
          tenantKey,
          workspaceKey,
          testRunId
        });
        sendCsv(
          response,
          200,
          `${workspaceKey}-study-monitor-run-${testRunId}.csv`,
          csv
        );
        return;
      }

      if (request.method === "GET" && openRunsCsvExportMatch?.groups) {
        const tenantKey = decodeRouteGroup(
          openRunsCsvExportMatch.groups.tenantKey
        );
        const workspaceKey = decodeRouteGroup(
          openRunsCsvExportMatch.groups.workspaceKey
        );
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }

        const query = parseMonitorOpenRunsQuery(url, response);
        if (!query) {
          return;
        }

        const groupKeys = getMonitorGroupKeys(request);
        if (query.groupKey && groupKeys && !groupKeys.includes(query.groupKey)) {
          sendError(
            response,
            403,
            "monitor_group_access_required",
            "The monitor session does not have access to the requested group."
          );
          return;
        }

        const csv = await services.monitorRead.exportOpenRunsCsv({
          tenantKey,
          workspaceKey,
          groupKeys,
          ...query
        });
        sendCsv(response, 200, `${workspaceKey}-open-runs.csv`, csv);
        return;
      }

      if (request.method === "GET" && participantRosterCsvExportMatch?.groups) {
        const tenantKey = decodeRouteGroup(
          participantRosterCsvExportMatch.groups.tenantKey
        );
        const workspaceKey = decodeRouteGroup(
          participantRosterCsvExportMatch.groups.workspaceKey
        );
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }

        const csv = await services.workspaceAdminRead.exportParticipantRosterCsv({
          tenantKey,
          workspaceKey
        });
        sendCsv(response, 200, `${workspaceKey}-participant-roster.csv`, csv);
        return;
      }

      if (request.method === "GET" && responseCsvExportMatch?.groups) {
        const tenantKey = decodeRouteGroup(responseCsvExportMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(
          responseCsvExportMatch.groups.workspaceKey
        );
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }

        const query = parseDetailedResponseListQuery(url, response, 50_000);
        if (!query) {
          return;
        }

        const csv = await services.workspaceAdminRead.exportResponseCsv({
          tenantKey,
          workspaceKey,
          ...query
        });
        sendCsv(response, 200, `${workspaceKey}-responses.csv`, csv);
        return;
      }

      if (
        request.method === "GET" &&
        originalResultArchiveExportMatch?.groups
      ) {
        const tenantKey = decodeRouteGroup(
          originalResultArchiveExportMatch.groups.tenantKey
        );
        const workspaceKey = decodeRouteGroup(
          originalResultArchiveExportMatch.groups.workspaceKey
        );
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }
        const groupFilter = parseGroupKeyQuery(url, response);
        if (!groupFilter.ok) {
          return;
        }
        const archive =
          await services.workspaceAdminRead.exportOriginalResultArchive({
            tenantKey,
            workspaceKey,
            groupKeys:
              groupFilter.groupKeys ??
              (groupFilter.groupKey ? [groupFilter.groupKey] : [])
          });
        sendAsset(response, 200, archive.mediaType, archive.body, {
          "content-disposition": buildAttachmentContentDisposition(
            archive.fileName
          )
        });
        return;
      }

      if (request.method === "GET" && logCsvExportMatch?.groups) {
        const tenantKey = decodeRouteGroup(logCsvExportMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(logCsvExportMatch.groups.workspaceKey);
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }

        const query = parseParticipantTestLogListQuery(url, response);
        if (!query) {
          return;
        }
        const csv = await services.workspaceAdminRead.exportLogCsv({
          tenantKey,
          workspaceKey,
          ...query
        });
        sendCsv(response, 200, `${workspaceKey}-logs.csv`, csv);
        return;
      }

      if (request.method === "GET" && activityCsvExportMatch?.groups) {
        const tenantKey = decodeRouteGroup(activityCsvExportMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(
          activityCsvExportMatch.groups.workspaceKey
        );
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }
        const csv = await services.workspaceAdminRead.exportActivityCsv({
          tenantKey,
          workspaceKey
        });
        sendCsv(response, 200, `${workspaceKey}-activity-events.csv`, csv);
        return;
      }

      if (request.method === "GET" && reviewCsvExportMatch?.groups) {
        const tenantKey = decodeRouteGroup(reviewCsvExportMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(
          reviewCsvExportMatch.groups.workspaceKey
        );
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }

        const query = parseWorkspaceReviewListQuery(url, response, 50_000);
        if (!query) {
          return;
        }

        const csv = await services.workspaceReview.exportReviewCsv({
          tenantKey,
          workspaceKey,
          ...query
        });
        sendCsv(response, 200, `${workspaceKey}-reviews.csv`, csv);
        return;
      }

      if (request.method === "POST" && importJobCreateMatch?.groups) {
        const tenantKey = decodeRouteGroup(importJobCreateMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(importJobCreateMatch.groups.workspaceKey);
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }

        const body = await readRequestJsonBody<CreateImportJobRequest>();
        const result = await services.createImportJobWithRelease({
          tenantKey,
          workspaceKey,
          sourcePackageId: body.sourcePackageId
        });
        sendJson<CreateImportJobResponse>(response, 201, result);
        return;
      }

      const contentReleaseListMatch = contentReleaseListPattern.exec(pathname);
      const contentReleaseCsvExportMatch =
        contentReleaseCsvExportPattern.exec(pathname);
      if (request.method === "GET" && contentReleaseListMatch?.groups) {
        const tenantKey = decodeRouteGroup(contentReleaseListMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(
          contentReleaseListMatch.groups.workspaceKey
        );
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }

        const query = parseContentReleaseListQuery(url, response);
        if (!query) {
          return;
        }

        const items = await services.workspaceAdminRead.listContentReleases({
          tenantKey,
          workspaceKey,
          ...query
        });
        sendJson<ListContentReleasesResponse>(response, 200, { items });
        return;
      }

      if (request.method === "GET" && contentReleaseCsvExportMatch?.groups) {
        const tenantKey = decodeRouteGroup(
          contentReleaseCsvExportMatch.groups.tenantKey
        );
        const workspaceKey = decodeRouteGroup(
          contentReleaseCsvExportMatch.groups.workspaceKey
        );
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }

        const query = parseContentReleaseListQuery(url, response);
        if (!query) {
          return;
        }

        const csv = await services.workspaceAdminRead.exportContentReleasesCsv({
          tenantKey,
          workspaceKey,
          ...query
        });
        sendCsv(response, 200, `${workspaceKey}-content-releases.csv`, csv);
        return;
      }

      const contentReleaseDetailMatch = contentReleaseDetailPattern.exec(pathname);
      if (request.method === "GET" && contentReleaseDetailMatch?.groups) {
        const tenantKey = decodeRouteGroup(contentReleaseDetailMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(
          contentReleaseDetailMatch.groups.workspaceKey
        );
        const contentReleaseId = decodeRouteGroup(
          contentReleaseDetailMatch.groups.contentReleaseId
        );
        if (!tenantKey || !workspaceKey || !contentReleaseId) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey, workspaceKey, and contentReleaseId are required."
          );
          return;
        }

        const contentReleaseDetail =
          await services.workspaceAdminRead.getContentReleaseDetail({
            tenantKey,
            workspaceKey,
            contentReleaseId
          });
        sendJson<GetContentReleaseResponse>(response, 200, {
          contentReleaseDetail
        });
        return;
      }

      const contentReleaseActivationReadinessMatch =
        contentReleaseActivationReadinessPattern.exec(pathname);
      if (
        request.method === "GET" &&
        contentReleaseActivationReadinessMatch?.groups
      ) {
        const tenantKey = decodeRouteGroup(
          contentReleaseActivationReadinessMatch.groups.tenantKey
        );
        const workspaceKey = decodeRouteGroup(
          contentReleaseActivationReadinessMatch.groups.workspaceKey
        );
        const contentReleaseId = decodeRouteGroup(
          contentReleaseActivationReadinessMatch.groups.contentReleaseId
        );
        if (!tenantKey || !workspaceKey || !contentReleaseId) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey, workspaceKey, and contentReleaseId are required."
          );
          return;
        }

        const activationReadiness =
          await services.workspaceAdminRead.getContentReleaseActivationReadiness({
            tenantKey,
            workspaceKey,
            contentReleaseId
          });
        sendJson<GetContentReleaseActivationReadinessResponse>(response, 200, {
          activationReadiness
        });
        return;
      }

      const contentReleaseActivateMatch = contentReleaseActivatePattern.exec(pathname);
      if (request.method === "POST" && contentReleaseActivateMatch?.groups) {
        const tenantKey = decodeRouteGroup(contentReleaseActivateMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(
          contentReleaseActivateMatch.groups.workspaceKey
        );
        const contentReleaseId = decodeRouteGroup(
          contentReleaseActivateMatch.groups.contentReleaseId
        );
        if (!tenantKey || !workspaceKey || !contentReleaseId) {
          sendError(
            response,
            400,
            "invalid_content_release_scope",
            "tenantKey, workspaceKey, and contentReleaseId are required."
          );
          return;
        }

        const body = await readRequestJsonBody<ActivateContentReleaseRequest>();
        const activationResult = await services.contentIntake.activateContentRelease({
          tenantKey,
          workspaceKey,
          contentReleaseId,
          activatedByActorId: body.activatedByActorId,
          forceActivation: body.forceActivation
        });
        sendJson<ActivateContentReleaseResponse>(response, 200, activationResult);
        return;
      }

      const systemCheckListMatch = systemCheckListPattern.exec(pathname);
      const systemCheckDetailMatch = systemCheckDetailPattern.exec(pathname);
      const systemCheckReportSaveMatch =
        systemCheckReportSavePattern.exec(pathname);
      const systemCheckReportListMatch =
        systemCheckReportListPattern.exec(pathname);
      const systemCheckReportStatisticsMatch =
        systemCheckReportStatisticsPattern.exec(pathname);
      const systemCheckReportImportMatch =
        systemCheckReportImportPattern.exec(pathname);
      const systemCheckReportCsvExportMatch =
        systemCheckReportCsvExportPattern.exec(pathname);
      const systemCheckReportJsonExportMatch =
        systemCheckReportJsonExportPattern.exec(pathname);
      if (request.method === "GET" && systemCheckListMatch?.groups) {
        const tenantKey = decodeRouteGroup(systemCheckListMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(
          systemCheckListMatch.groups.workspaceKey
        );
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }
        const items = await services.systemCheck.listSystemChecks({
          tenantKey,
          workspaceKey
        });
        sendJson<ListSystemChecksResponse>(response, 200, { items });
        return;
      }

      if (request.method === "GET" && systemCheckDetailMatch?.groups) {
        const tenantKey = decodeRouteGroup(systemCheckDetailMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(
          systemCheckDetailMatch.groups.workspaceKey
        );
        const checkId = decodeRouteGroup(systemCheckDetailMatch.groups.checkId);
        if (!tenantKey || !workspaceKey || !checkId) {
          sendError(
            response,
            400,
            "invalid_system_check_scope",
            "tenantKey, workspaceKey, and checkId are required."
          );
          return;
        }
        const systemCheck = await services.systemCheck.getSystemCheck({
          tenantKey,
          workspaceKey,
          checkId
        });
        sendJson<GetSystemCheckResponse>(response, 200, { systemCheck });
        return;
      }

      if (request.method === "POST" && systemCheckReportSaveMatch?.groups) {
        const tenantKey = decodeRouteGroup(
          systemCheckReportSaveMatch.groups.tenantKey
        );
        const workspaceKey = decodeRouteGroup(
          systemCheckReportSaveMatch.groups.workspaceKey
        );
        const checkId = decodeRouteGroup(
          systemCheckReportSaveMatch.groups.checkId
        );
        if (!tenantKey || !workspaceKey || !checkId) {
          sendError(
            response,
            400,
            "invalid_system_check_scope",
            "tenantKey, workspaceKey, and checkId are required."
          );
          return;
        }
        const sessionToken = readBearerToken(request);
        let authenticatedLoginName: string | undefined;
        if (sessionToken) {
          const { adminUser, roleAssignments } =
            await services.adminAuth.getCurrentSession({ sessionToken });
          if (
            !(await hasSystemCheckAccess({
              repository: runtime.repository,
              roleAssignments,
              tenantKey,
              workspaceKey
            }))
          ) {
            sendError(
              response,
              403,
              "admin_role_required",
              "The admin session does not have system-check access for this workspace.",
              { requiredRoles: ["system_check"] }
            );
            return;
          }
          authenticatedLoginName = adminUser.username;
        } else if (
          (await listSystemCheckRoleAssignments(runtime.repository)).length > 0
        ) {
          sendError(
            response,
            401,
            "system_check_login_required",
            "A dedicated system-check login is required while system-check login mode is active."
          );
          return;
        }
        const body = await readRequestJsonBody<SaveSystemCheckReportRequest>();
        const report = await services.systemCheck.saveSystemCheckReport({
          tenantKey,
          workspaceKey,
          checkId,
          keyPhrase: body.keyPhrase,
          authenticatedLoginName,
          title: body.title,
          responses: body.responses,
          environment: body.environment,
          network: body.network,
          questionnaire: body.questionnaire,
          unit: body.unit
        });
        sendJson<SaveSystemCheckReportResponse>(response, 201, { report });
        return;
      }

      if (request.method === "POST" && systemCheckReportImportMatch?.groups) {
        const tenantKey = decodeRouteGroup(
          systemCheckReportImportMatch.groups.tenantKey
        );
        const workspaceKey = decodeRouteGroup(
          systemCheckReportImportMatch.groups.workspaceKey
        );
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }
        const body = await readRequestJsonBody<ImportSystemCheckReportRequest>();
        const result = await services.workspaceResults.importSystemCheckReport({
          tenantKey,
          workspaceKey,
          fileName: body.fileName,
          modifiedAt: body.modifiedAt,
          report: body.report
        });
        sendJson<ImportSystemCheckReportResponse>(
          response,
          result.disposition === "imported" ? 201 : 200,
          result
        );
        return;
      }

      if (
        request.method === "GET" &&
        (systemCheckReportListMatch?.groups ||
          systemCheckReportCsvExportMatch?.groups ||
          systemCheckReportJsonExportMatch?.groups)
      ) {
        const groups =
          systemCheckReportListMatch?.groups ??
          systemCheckReportCsvExportMatch?.groups ??
          systemCheckReportJsonExportMatch?.groups;
        const tenantKey = decodeRouteGroup(groups?.tenantKey);
        const workspaceKey = decodeRouteGroup(groups?.workspaceKey);
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }
        const checkId = url.searchParams.get("checkId")?.trim() || undefined;
        const limitValue = url.searchParams.get("limit")?.trim();
        const limit = limitValue ? Number.parseInt(limitValue, 10) : undefined;
        if (
          limitValue &&
          (!/^\d+$/.test(limitValue) || !limit || limit < 1 || limit > 500)
        ) {
          sendError(
            response,
            400,
            "system_check_report_limit_invalid",
            "System-check report limit must be an integer between 1 and 500."
          );
          return;
        }
        if (systemCheckReportCsvExportMatch?.groups) {
          const csv =
            await services.workspaceAdminRead.exportSystemCheckReportsCsv({
              tenantKey,
              workspaceKey,
              checkId,
              limit
            });
          sendCsv(
            response,
            200,
            `${workspaceKey}-system-check-reports.csv`,
            csv
          );
          return;
        }
        if (systemCheckReportJsonExportMatch?.groups) {
          const json =
            await services.workspaceAdminRead.exportSystemCheckReportsJson({
              tenantKey,
              workspaceKey,
              checkId,
              limit
            });
          sendAsset(
            response,
            200,
            "application/json; charset=utf-8",
            Buffer.from(json, "utf8"),
            {
              "content-disposition": buildAttachmentContentDisposition(
                `${workspaceKey}-system-check-reports.json`
              )
            }
          );
          return;
        }
        const items =
          await services.workspaceAdminRead.listSystemCheckReports({
            tenantKey,
            workspaceKey,
            checkId,
            limit
          });
        sendJson<ListSystemCheckReportsResponse>(response, 200, { items });
        return;
      }

      if (request.method === "GET" && systemCheckReportStatisticsMatch?.groups) {
        const tenantKey = decodeRouteGroup(
          systemCheckReportStatisticsMatch.groups.tenantKey
        );
        const workspaceKey = decodeRouteGroup(
          systemCheckReportStatisticsMatch.groups.workspaceKey
        );
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }
        const checkId = url.searchParams.get("checkId")?.trim() || undefined;
        const items =
          await services.workspaceAdminRead.getSystemCheckReportStatistics({
            tenantKey,
            workspaceKey,
            checkId
          });
        sendJson<GetSystemCheckReportStatisticsResponse>(response, 200, { items });
        return;
      }

      if (request.method === "DELETE" && systemCheckReportListMatch?.groups) {
        const tenantKey = decodeRouteGroup(systemCheckReportListMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(
          systemCheckReportListMatch.groups.workspaceKey
        );
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_workspace_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }
        const body = await readRequestJsonBody<DeleteSystemCheckReportsRequest>();
        const deletion = await services.workspaceResults.deleteSystemCheckReports({
          tenantKey,
          workspaceKey,
          checkIds: body.checkIds,
          confirmation: body.confirmation
        });
        sendJson<DeleteSystemCheckReportsResponse>(response, 200, { deletion });
        return;
      }

      if (
        request.method === "POST" &&
        pathname === productionApiRoutes.participant.signIn
      ) {
        const body = await readRequestJsonBody<ParticipantSignInRequest>();
        const participantSession = await services.participantRuntime.signIn(body);
        const runtimeState = await services.participantRuntime.getRuntimeState({
          participantSessionId: participantSession.participantSessionId
        });
        sendJson<ParticipantSignInResponse>(response, 200, {
          participantSession,
          participantRosterEntry: runtimeState.participantRosterEntry,
          booklets: runtimeState.booklets
        });
        return;
      }

      const runtimeStateMatch = runtimeStatePattern.exec(pathname);
      if (request.method === "GET" && runtimeStateMatch?.groups) {
        const participantSessionId = decodeRouteGroup(
          runtimeStateMatch.groups.participantSessionId
        );
        if (!participantSessionId) {
          sendError(
            response,
            400,
            "invalid_participant_session_id",
            "participantSessionId is required."
          );
          return;
        }

        const runtimeState = await services.participantRuntime.getRuntimeState({
          participantSessionId
        });
        sendJson<ParticipantRuntimeStateResponse>(response, 200, {
          runtimeState
        });
        return;
      }

      const currentRunStateMatch = currentRunStatePattern.exec(pathname);
      const participantEventStreamMatch =
        participantEventStreamPattern.exec(pathname);
      if (request.method === "GET" && participantEventStreamMatch?.groups) {
        const participantSessionId = decodeRouteGroup(
          participantEventStreamMatch.groups.participantSessionId
        );
        if (!participantSessionId) {
          sendError(
            response,
            400,
            "invalid_participant_session_id",
            "participantSessionId is required."
          );
          return;
        }

        await streamParticipantEvents({
          request,
          response,
          participantRuntime: services.participantRuntime,
          participantSessionId
        });
        return;
      }

      if (request.method === "GET" && currentRunStateMatch?.groups) {
        const participantSessionId = decodeRouteGroup(
          currentRunStateMatch.groups.participantSessionId
        );
        if (!participantSessionId) {
          sendError(
            response,
            400,
            "invalid_participant_session_id",
            "participantSessionId is required."
          );
          return;
        }

        const currentRunState = await services.participantRuntime.getCurrentRunState({
          participantSessionId,
          includeBookletAssets:
            url.searchParams.get("includeBookletAssets") === "true"
        });
        sendJson<ParticipantCurrentRunStateResponse>(response, 200, {
          currentRunState
        });
        return;
      }

      const participantResourceMatch = participantResourcePattern.exec(pathname);
      if (request.method === "OPTIONS" && participantResourceMatch?.groups) {
        response.writeHead(204, {
          ...participantResourceSecurityHeaders,
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, HEAD, OPTIONS",
          "access-control-allow-headers": "range",
          "access-control-max-age": "600",
          "content-length": "0"
        });
        endResponse(response);
        return;
      }
      if (request.method === "GET" && participantResourceMatch?.groups) {
        const participantSessionId = decodeRouteGroup(
          participantResourceMatch.groups.participantSessionId
        );
        const resourcePath = decodeRouteGroup(
          participantResourceMatch.groups.resourcePath
        );
        if (!participantSessionId || !resourcePath) {
          sendError(
            response,
            400,
            "participant_resource_path_invalid",
            "participantSessionId and resourcePath are required."
          );
          return;
        }
        const resource = await services.participantRuntime.getResource({
          participantSessionId,
          resourcePath
        });
        const resourceBody = Buffer.from(resource.dataBase64, "base64");
        const resourceHeaders = {
          "access-control-allow-origin": "*",
          "access-control-expose-headers":
            "accept-ranges, content-length, content-range",
          "accept-ranges": "bytes"
        };
        const rangeHeader = request.headers.range;
        if (rangeHeader !== undefined) {
          const byteRanges = resolveByteRanges(
            rangeHeader,
            resourceBody.byteLength
          );
          if (!byteRanges) {
            sendParticipantResourceAsset(
              response,
              416,
              resource.mediaType,
              Buffer.alloc(0),
              {
                ...resourceHeaders,
                "content-length": "0",
                "content-range": `bytes */${resourceBody.byteLength}`
              }
            );
            return;
          }
          if (byteRanges.length > 1) {
            const boundary = `rewrite-range-${randomUUID().replaceAll("-", "")}`;
            const multipartBody = createMultipartByteRangeBody({
              boundary,
              contentType: resource.mediaType,
              resourceBody,
              byteRanges
            });
            sendParticipantResourceAsset(
              response,
              206,
              `multipart/byteranges; boundary=${boundary}`,
              multipartBody,
              {
                ...resourceHeaders,
                "content-length": String(multipartBody.byteLength)
              }
            );
            return;
          }
          const byteRange = byteRanges[0]!;
          const partialBody = resourceBody.subarray(
            byteRange.start,
            byteRange.end + 1
          );
          sendParticipantResourceAsset(
            response,
            206,
            resource.mediaType,
            partialBody,
            {
              ...resourceHeaders,
              "content-length": String(partialBody.byteLength),
              "content-range":
                `bytes ${byteRange.start}-${byteRange.end}/${resourceBody.byteLength}`
            }
          );
          return;
        }
        sendParticipantResourceAsset(
          response,
          200,
          resource.mediaType,
          resourceBody,
          {
            ...resourceHeaders,
            "content-length": String(resourceBody.byteLength)
          }
        );
        return;
      }

      if (
        request.method === "POST" &&
        pathname === productionApiRoutes.participant.launch
      ) {
        const body = await readRequestJsonBody<ParticipantLaunchRequest>();
        if (
          body.participantSessionId !== undefined &&
          body.participantSessionId !== null
        ) {
          const testRun = await services.participantRuntime.launch({
            participantSessionId: body.participantSessionId,
            bookletKey: body.bookletKey
          });
          const runtimeState = await services.participantRuntime.getRuntimeState({
            participantSessionId: testRun.participantSessionId
          });
          sendJson<ParticipantLaunchResponse>(response, 200, {
            participantSession: runtimeState.participantSession,
            participantRosterEntry: runtimeState.participantRosterEntry,
            booklets: runtimeState.booklets,
            testRun
          });
          return;
        }

        const participantSession = await services.participantRuntime.signIn({
          tenantKey: body.tenantKey,
          workspaceKey: body.workspaceKey ?? "",
          loginKey: body.loginKey ?? "",
          groupKey: body.groupKey,
          password: body.password,
          participantCode: body.participantCode
        });
        const testRun = await services.participantRuntime.resumeSession({
          participantSessionId: participantSession.participantSessionId,
          bookletKey: body.bookletKey
        });
        const runtimeState = await services.participantRuntime.getRuntimeState({
          participantSessionId: testRun.participantSessionId
        });
        sendJson<ParticipantLaunchResponse>(response, 200, {
          participantSession: runtimeState.participantSession,
          participantRosterEntry: runtimeState.participantRosterEntry,
          booklets: runtimeState.booklets,
          testRun
        });
        return;
      }

      const resumeSessionMatch = resumeSessionPattern.exec(pathname);
      if (request.method === "POST" && resumeSessionMatch?.groups) {
        const participantSessionId = decodeRouteGroup(
          resumeSessionMatch.groups.participantSessionId
        );
        if (!participantSessionId) {
          sendError(
            response,
            400,
            "invalid_participant_session_id",
            "participantSessionId is required."
          );
          return;
        }

        const body =
          await readOptionalRequestJsonBody<ResumeParticipantSessionRequest>();
        const testRun = await services.participantRuntime.resumeSession({
          participantSessionId,
          bookletKey: body?.bookletKey
        });
        sendJson<ResumeParticipantSessionResponse>(response, 200, { testRun });
        return;
      }

      const saveProgressMatch = saveProgressPattern.exec(pathname);
      if (request.method === "POST" && saveProgressMatch?.groups) {
        const testRunId = decodeRouteGroup(saveProgressMatch.groups.testRunId);
        if (!testRunId) {
          sendError(response, 400, "invalid_test_run_id", "testRunId is required.");
          return;
        }

        const body = await readRequestJsonBody<SaveTestRunProgressRequest>();
        const testRun = await services.participantRuntime.saveProgress({
          testRunId,
          deliveryId: body.deliveryId,
          currentUnitKey: body.currentUnitKey,
          responseUnitKey: body.responseUnitKey,
          transientUnitResponses: body.transientUnitResponses,
          status: body.status,
          unitResponse: body.unitResponse,
          confirmTestletTimeLeave: body.confirmTestletTimeLeave,
          confirmTestletLeaveLock: body.confirmTestletLeaveLock,
          logs: body.logs
        });
        sendJson<SaveTestRunProgressResponse>(response, 200, { testRun });
        return;
      }

      const saveTestLogsMatch = saveTestLogsPattern.exec(pathname);
      if (request.method === "POST" && saveTestLogsMatch?.groups) {
        const testRunId = decodeRouteGroup(saveTestLogsMatch.groups.testRunId);
        if (!testRunId) {
          sendError(response, 400, "invalid_test_run_id", "testRunId is required.");
          return;
        }

        const body = await readRequestJsonBody<SaveParticipantTestLogsRequest>();
        const savedCount = await services.participantRuntime.saveTestLogs({
          testRunId,
          deliveryId: body.deliveryId,
          logs: body.logs
        });
        sendJson<SaveParticipantTestLogsResponse>(response, 200, { savedCount });
        return;
      }

      const selectAdaptiveStateMatch =
        selectAdaptiveStatePattern.exec(pathname);
      if (request.method === "POST" && selectAdaptiveStateMatch?.groups) {
        const testRunId = decodeRouteGroup(
          selectAdaptiveStateMatch.groups.testRunId
        );
        const stateKey = decodeRouteGroup(
          selectAdaptiveStateMatch.groups.stateKey
        );
        if (!testRunId) {
          sendError(response, 400, "invalid_test_run_id", "testRunId is required.");
          return;
        }
        if (!stateKey) {
          sendError(response, 400, "participant_state_key_required", "stateKey is required.");
          return;
        }
        const body =
          await readRequestJsonBody<SelectParticipantAdaptiveStateRequest>();
        const testRun = await services.participantRuntime.selectAdaptiveState({
          testRunId,
          stateKey,
          optionKey: body.optionKey
        });
        sendJson<SelectParticipantAdaptiveStateResponse>(response, 200, {
          testRun
        });
        return;
      }

      const participantReviewListMatch =
        participantReviewListPattern.exec(pathname);
      const participantReviewCsvExportMatch =
        participantReviewCsvExportPattern.exec(pathname);
      if (
        request.method === "GET" &&
        participantReviewCsvExportMatch?.groups
      ) {
        const participantSessionId = decodeRouteGroup(
          participantReviewCsvExportMatch.groups.participantSessionId
        );
        if (!participantSessionId) {
          sendError(
            response,
            400,
            "invalid_participant_session_id",
            "participantSessionId is required."
          );
          return;
        }
        const csv = await services.participantRuntime.exportReviewsCsv({
          participantSessionId
        });
        if (csv === null) {
          response.writeHead(204, {
            ...securityHeaders,
            "cache-control": "no-cache",
            "content-length": "0"
          });
          endResponse(response);
          return;
        }
        sendCsv(response, 200, "testcenter-reviews.csv", csv);
        return;
      }
      if (request.method === "GET" && participantReviewListMatch?.groups) {
        const testRunId = decodeRouteGroup(
          participantReviewListMatch.groups.testRunId
        );
        if (!testRunId) {
          sendError(response, 400, "invalid_test_run_id", "testRunId is required.");
          return;
        }
        const items = await services.participantRuntime.listReviews({ testRunId });
        sendJson<ListParticipantReviewsResponse>(response, 200, { items });
        return;
      }

      if (request.method === "POST" && participantReviewListMatch?.groups) {
        const testRunId = decodeRouteGroup(
          participantReviewListMatch.groups.testRunId
        );
        if (!testRunId) {
          sendError(response, 400, "invalid_test_run_id", "testRunId is required.");
          return;
        }
        const body =
          await readRequestJsonBody<CreateParticipantReviewRequest>();
        const review = await services.participantRuntime.createReview({
          testRunId,
          unitKey: body.unitKey,
          page: body.page,
          pageLabel: body.pageLabel,
          reviewerId: body.reviewerId,
          category: body.category,
          categories: body.categories,
          priority: body.priority,
          comment: body.comment,
          userAgent: requestUserAgent
        });
        sendJson<ParticipantReviewResponse>(response, 201, { review });
        return;
      }

      const participantReviewDetailMatch =
        participantReviewDetailPattern.exec(pathname);
      if (
        (request.method === "PATCH" || request.method === "DELETE") &&
        participantReviewDetailMatch?.groups
      ) {
        const testRunId = decodeRouteGroup(
          participantReviewDetailMatch.groups.testRunId
        );
        const reviewId = decodeRouteGroup(
          participantReviewDetailMatch.groups.reviewId
        );
        if (!testRunId || !reviewId) {
          sendError(
            response,
            400,
            "invalid_participant_review_scope",
            "testRunId and reviewId are required."
          );
          return;
        }
        if (request.method === "DELETE") {
          const deletedReviewId =
            await services.participantRuntime.deleteReview({
              testRunId,
              reviewId
            });
          sendJson<DeleteParticipantReviewResponse>(response, 200, {
            deletedReviewId
          });
          return;
        }
        const body =
          await readRequestJsonBody<UpdateParticipantReviewRequest>();
        const review = await services.participantRuntime.updateReview({
          testRunId,
          reviewId,
          unitKey: body.unitKey,
          page: body.page,
          pageLabel: body.pageLabel,
          reviewerId: body.reviewerId,
          category: body.category,
          categories: body.categories,
          priority: body.priority,
          comment: body.comment
        });
        sendJson<ParticipantReviewResponse>(response, 200, { review });
        return;
      }

      const resumeRunMatch = resumeRunPattern.exec(pathname);
      const unlockTestletMatch = unlockTestletPattern.exec(pathname);
      if (request.method === "POST" && unlockTestletMatch?.groups) {
        const testRunId = decodeRouteGroup(unlockTestletMatch.groups.testRunId);
        const testletKey = decodeRouteGroup(unlockTestletMatch.groups.testletKey);
        if (!testRunId || !testletKey) {
          sendError(
            response,
            400,
            "invalid_testlet_unlock_scope",
            "testRunId and testletKey are required."
          );
          return;
        }
        const body = await readRequestJsonBody<UnlockParticipantTestletRequest>();
        const testRun = await services.participantRuntime.unlockTestlet({
          testRunId,
          testletKey,
          code: body.code
        });
        sendJson<UnlockParticipantTestletResponse>(response, 200, { testRun });
        return;
      }

      if (request.method === "POST" && resumeRunMatch?.groups) {
        const testRunId = decodeRouteGroup(resumeRunMatch.groups.testRunId);
        if (!testRunId) {
          sendError(response, 400, "invalid_test_run_id", "testRunId is required.");
          return;
        }

        const testRun = await services.participantRuntime.resumeRun({
          testRunId
        });
        sendJson<ResumeTestRunResponse>(response, 200, { testRun });
        return;
      }

      const returnToStarterMatch = returnToStarterPattern.exec(pathname);
      if (request.method === "POST" && returnToStarterMatch?.groups) {
        const testRunId = decodeRouteGroup(
          returnToStarterMatch.groups.testRunId
        );
        if (!testRunId) {
          sendError(response, 400, "invalid_test_run_id", "testRunId is required.");
          return;
        }

        const body =
          await readOptionalRequestJsonBody<ReturnTestRunToStarterRequest>();
        const testRun = await services.participantRuntime.returnToStarter({
          testRunId,
          responseUnitKey: body?.responseUnitKey,
          unitResponse: body?.unitResponse,
          transientUnitResponses: body?.transientUnitResponses,
          confirmTestletTimeLeave: body?.confirmTestletTimeLeave,
          confirmTestletLeaveLock: body?.confirmTestletLeaveLock
        });
        const runtimeState = await services.participantRuntime.getRuntimeState({
          participantSessionId: testRun.participantSessionId
        });
        sendJson<ReturnTestRunToStarterResponse>(response, 200, {
          testRun,
          runtimeState
        });
        return;
      }

      const completeRunMatch = completeRunPattern.exec(pathname);
      if (request.method === "POST" && completeRunMatch?.groups) {
        const testRunId = decodeRouteGroup(completeRunMatch.groups.testRunId);
        if (!testRunId) {
          sendError(response, 400, "invalid_test_run_id", "testRunId is required.");
          return;
        }

        const body =
          await readOptionalRequestJsonBody<CompleteTestRunRequest>();
        const testRun = await services.participantRuntime.completeRun({
          testRunId,
          responseUnitKey: body?.responseUnitKey,
          unitResponse: body?.unitResponse,
          transientUnitResponses: body?.transientUnitResponses,
          confirmTestletTimeLeave: body?.confirmTestletTimeLeave,
          confirmTestletLeaveLock: body?.confirmTestletLeaveLock
        });
        sendJson<CompleteTestRunResponse>(response, 200, { testRun });
        return;
      }

      const monitorOpenRunsMatch = monitorOpenRunsPattern.exec(pathname);
      const monitorEventStreamMatch = monitorEventStreamPattern.exec(pathname);
      if (request.method === "GET" && monitorEventStreamMatch?.groups) {
        const tenantKey = decodeRouteGroup(
          monitorEventStreamMatch.groups.tenantKey
        );
        const workspaceKey = decodeRouteGroup(
          monitorEventStreamMatch.groups.workspaceKey
        );
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_monitor_event_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }

        const initialGroupKeys = getMonitorGroupKeys(request);
        await streamMonitorEvents({
          request,
          response,
          monitorRead: services.monitorRead,
          tenantKey,
          workspaceKey,
          groupKeys: initialGroupKeys,
          ...(runtime.config.operatorAuthRequired
            ? {
                validateAccess: async () => {
                  const sessionToken = readBearerToken(request);
                  if (!sessionToken) {
                    throw new Error("Admin session is no longer available.");
                  }
                  const { roleAssignments } =
                    await services.adminAuth.getCurrentSession({ sessionToken });
                  const adminAccessMode = await resolveOperatorAdminAccess(
                    runtime.repository,
                    roleAssignments,
                    { kind: "workspace", tenantKey, workspaceKey }
                  );
                  const monitorAccess = adminAccessMode
                    ? { kind: "full" as const }
                    : await resolveMonitorOperatorAccess({
                        repository: runtime.repository,
                        roleAssignments,
                        tenantKey,
                        workspaceKey,
                        routeScope: { kind: "workspace_monitor" }
                      });
                  const currentGroupKeys =
                    monitorAccess?.kind === "groups"
                      ? [...monitorAccess.groupKeys].sort()
                      : undefined;
                  const expectedGroupKeys = initialGroupKeys
                    ? [...initialGroupKeys].sort()
                    : undefined;
                  if (
                    !monitorAccess ||
                    (expectedGroupKeys &&
                      JSON.stringify(currentGroupKeys) !==
                        JSON.stringify(expectedGroupKeys)) ||
                    (!expectedGroupKeys && currentGroupKeys)
                  ) {
                    throw new Error("Workspace monitor access was revoked.");
                  }
                }
              }
            : {})
        });
        return;
      }

      if (request.method === "GET" && monitorOpenRunsMatch?.groups) {
        const tenantKey = decodeRouteGroup(monitorOpenRunsMatch.groups.tenantKey);
        const workspaceKey = decodeRouteGroup(monitorOpenRunsMatch.groups.workspaceKey);
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_monitor_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }

        const query = parseMonitorOpenRunsQuery(url, response);
        if (!query) {
          return;
        }

        const groupKeys = getMonitorGroupKeys(request);
        if (query.groupKey && groupKeys && !groupKeys.includes(query.groupKey)) {
          sendError(
            response,
            403,
            "monitor_group_access_required",
            "The monitor session does not have access to the requested group."
          );
          return;
        }

        const items = await services.monitorRead.listOpenRuns({
          tenantKey,
          workspaceKey,
          groupKeys,
          ...query
        });
        sendJson<MonitorOpenRunsResponse>(response, 200, { items });
        return;
      }

      const monitorRunCommandMatch = monitorRunCommandPattern.exec(pathname);
      const monitorRunCommandsMatch = monitorRunCommandsPattern.exec(pathname);
      if (request.method === "POST" && monitorRunCommandsMatch?.groups) {
        const tenantKey = decodeRouteGroup(
          monitorRunCommandsMatch.groups.tenantKey
        );
        const workspaceKey = decodeRouteGroup(
          monitorRunCommandsMatch.groups.workspaceKey
        );
        if (!tenantKey || !workspaceKey) {
          sendError(
            response,
            400,
            "invalid_monitor_bulk_command_scope",
            "tenantKey and workspaceKey are required."
          );
          return;
        }

        const body = await readRequestJsonBody<IssueMonitorRunCommandsRequest>();
        const groupKeys = getMonitorGroupKeys(request);
        let normalizedTestRunIds: string[];
        if (body.scope === "all_unlocked_open_runs") {
          if (
            body.commandType !== "complete_and_lock" ||
            body.testRunIds !== undefined
          ) {
            sendError(
              response,
              400,
              "monitor_bulk_scope_invalid",
              "all_unlocked_open_runs only supports complete_and_lock without testRunIds."
            );
            return;
          }
          const openRuns = await services.monitorRead.listOpenRuns({
            tenantKey,
            workspaceKey,
            groupKeys,
            limit: null
          });
          normalizedTestRunIds = openRuns
            .filter(openRun => openRun.locked !== true)
            .map(openRun => openRun.testRunId);
        } else {
          if (body.scope !== undefined) {
            sendError(
              response,
              400,
              "monitor_bulk_scope_invalid",
              "The requested monitor bulk scope is not supported."
            );
            return;
          }
          if (!Array.isArray(body.testRunIds)) {
            sendError(
              response,
              400,
              "monitor_bulk_test_run_ids_invalid",
              "testRunIds must be an array containing 1 to 100 run ids."
            );
            return;
          }
          normalizedTestRunIds = [
            ...new Set(
              body.testRunIds.map(testRunId =>
                typeof testRunId === "string" ? testRunId.trim() : ""
              )
            )
          ];
          if (
            normalizedTestRunIds.length === 0 ||
            normalizedTestRunIds.length > 100 ||
            normalizedTestRunIds.some(testRunId => !testRunId)
          ) {
            sendError(
              response,
              400,
              "monitor_bulk_test_run_ids_invalid",
              "testRunIds must contain 1 to 100 non-empty run ids."
            );
            return;
          }

          if (
            !(await canAccessMonitorRuns({
              repository: runtime.repository,
              tenantKey,
              workspaceKey,
              testRunIds: normalizedTestRunIds,
              groupKeys
            }))
          ) {
            sendError(
              response,
              403,
              "monitor_group_access_required",
              "The monitor session does not have access to every requested run."
            );
            return;
          }
        }

        const { commands, failures } =
          await services.monitorControl.issueRunCommands({
            tenantKey,
            workspaceKey,
            testRunIds: normalizedTestRunIds,
            commandType: body.commandType,
            actorId:
              operatorAdminUserIdByRequest.get(request) ?? body.actorId,
            targetUnitKey: body.targetUnitKey,
            remainingSeconds: body.remainingSeconds
          });

        sendJson<IssueMonitorRunCommandsResponse>(response, 200, {
          requestedCount: normalizedTestRunIds.length,
          succeededCount: commands.length,
          failedCount: failures.length,
          commands,
          failures
        });
        return;
      }

      if (request.method === "POST" && monitorRunCommandMatch?.groups) {
        const tenantKey = decodeRouteGroup(
          monitorRunCommandMatch.groups.tenantKey
        );
        const workspaceKey = decodeRouteGroup(
          monitorRunCommandMatch.groups.workspaceKey
        );
        const testRunId = decodeRouteGroup(monitorRunCommandMatch.groups.testRunId);
        if (!tenantKey || !workspaceKey || !testRunId) {
          sendError(
            response,
            400,
            "invalid_monitor_command_scope",
            "tenantKey, workspaceKey, and testRunId are required."
          );
          return;
        }

        const body = await readRequestJsonBody<IssueMonitorRunCommandRequest>();
        if (
          !(await canAccessMonitorRuns({
            repository: runtime.repository,
            tenantKey,
            workspaceKey,
            testRunIds: [testRunId],
            groupKeys: getMonitorGroupKeys(request)
          }))
        ) {
          sendError(
            response,
            403,
            "monitor_group_access_required",
            "The monitor session does not have access to the requested run."
          );
          return;
        }
        const command = await services.monitorControl.issueRunCommand({
          tenantKey,
          workspaceKey,
          testRunId,
          commandType: body.commandType,
          actorId: operatorAdminUserIdByRequest.get(request) ?? body.actorId,
          targetUnitKey: body.targetUnitKey,
          remainingSeconds: body.remainingSeconds
        });
        sendJson<IssueMonitorRunCommandResponse>(response, 200, { command });
        return;
      }

      if (request.method === "GET" && pathname === "/manifest") {
        const workspaceCreateExample = resolveRoutePath(
          productionApiRoutes.workspace.createWorkspace,
          { tenantKey: "demo-tenant" }
        );
        const workspaceOverviewExample = resolveRoutePath(
          productionApiRoutes.workspace.getWorkspaceOverview,
          {
            tenantKey: "demo-tenant",
            workspaceKey: "demo-workspace"
          }
        );
        sendJson(response, 200, {
          workspace: "rewrite-app/api",
          phase: "production-baseline",
          build: runtime.build,
          storage: {
            kind: runtime.repositoryConfig.kind,
            location: redactStorageLocation(runtime.repositoryConfig.location),
            schemaVersion: runtime.repositoryConfig.schemaVersion
          },
          routes: productionApiRoutes,
          useCases: firstSliceUseCases,
          capabilities: firstProductionSliceCapabilities,
          examples: {
            workspaceCreate: workspaceCreateExample,
            workspaceOverview: workspaceOverviewExample
          }
        });
        return;
      }

      metrics.errorCounts.routeNotFound += 1;
      sendError(response, 404, "route_not_found", `No route matches '${pathname}'.`);
    } catch (error) {
      if (isFirstSliceError(error)) {
        metrics.errorCounts.firstSlice += 1;
        if (
          (error.errorCode === "participant_login_rate_limited" ||
            error.errorCode === "admin_login_rate_limited") &&
          typeof error.details === "object" &&
          error.details !== null &&
          "retryAfterSeconds" in error.details &&
          typeof error.details.retryAfterSeconds === "number"
        ) {
          response.setHeader(
            "retry-after",
            String(Math.max(1, Math.ceil(error.details.retryAfterSeconds)))
          );
        }
        sendError(
          response,
          error.statusCode,
          error.errorCode,
          error.message,
          error.details
        );
        return;
      }

      if (error instanceof SyntaxError) {
        metrics.errorCounts.invalidJson += 1;
        sendError(response, 400, "invalid_json", "Request body must be valid JSON.");
        return;
      }

      if (error instanceof RequestBodyTooLargeError) {
        metrics.errorCounts.requestBodyTooLarge += 1;
        sendError(
          response,
          413,
          "request_body_too_large",
          "Request body exceeds the configured JSON payload limit.",
          { maxJsonBodyBytes: error.maxJsonBodyBytes }
        );
        return;
      }

      if (error instanceof InvalidMultipartBodyError) {
        sendError(
          response,
          400,
          "invalid_multipart_attachment",
          error.message
        );
        return;
      }

      metrics.errorCounts.internal += 1;
      recordRuntimeOperationalEvent(runtime, "error", "http_request_failed", {
        requestId,
        method,
        route: routeLabel,
        path: request.url ?? null,
        storageKind: runtime.repositoryConfig.kind,
        error:
          error instanceof Error
            ? {
                name: error.name,
                message: error.message
              }
            : { message: String(error) }
      });
      sendError(
        response,
        500,
        "internal_server_error",
        "An unexpected server error occurred.",
        { requestId }
      );
    }
  };

const applyHttpServerTimeouts = (
  server: ReturnType<typeof createServer>,
  runtime: Awaited<ReturnType<typeof createApiRuntime>>
): void => {
  server.headersTimeout = runtime.config.httpTimeouts.headersTimeoutMs;
  server.requestTimeout = runtime.config.httpTimeouts.requestTimeoutMs;
  server.keepAliveTimeout = runtime.config.httpTimeouts.keepAliveTimeoutMs;
};

export const createProductionApiServer = async () =>
  {
    const runtime = await createApiRuntime();
    const server = createServer(createRequestHandler(runtime));
    applyHttpServerTimeouts(server, runtime);
    server.once("close", () => {
      void runtime.shutdown();
    });
    return server;
  };

if (import.meta.url === `file://${process.argv[1]}`) {
  const runtime = await createApiRuntime();
  const port = runtime.config.port;
  const shutdownDrainDelayMs = runtime.config.shutdownDrainDelayMs;
  const server = createServer(createRequestHandler(runtime));
  applyHttpServerTimeouts(server, runtime);
  let shuttingDown = false;

  const closeServer = () => {
    server.closeIdleConnections?.();
    const forceCloseHandle = setTimeout(() => {
      server.closeAllConnections?.();
    }, 1_000);
    forceCloseHandle.unref();

    server.close(async error => {
      clearTimeout(forceCloseHandle);
      try {
        await runtime.shutdown();
      } finally {
        if (error) {
          process.stderr.write(`${String(error)}\n`);
          process.exit(1);
          return;
        }
        process.exit(0);
      }
    });
  };

  const shutdown = (signal: string) => {
    if (shuttingDown) {
      return;
    }
    shuttingDown = true;
    runtime.lifecycle.phase = "draining";
    runtime.lifecycle.shutdownRequestedAt = new Date().toISOString();
    recordRuntimeOperationalEvent(runtime, "info", "process_shutdown_requested", {
      signal,
      storageKind: runtime.repositoryConfig.kind,
      shutdownDrainDelayMs
    });
    process.stdout.write(`shutdown_signal=${signal}\n`);
    setTimeout(closeServer, Math.max(0, shutdownDrainDelayMs)).unref();

    setTimeout(() => {
      process.stderr.write("shutdown_timeout_exceeded\n");
      process.exit(1);
    }, shutdownDrainDelayMs + 5_000).unref();
  };

  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("uncaughtException", error => {
    recordRuntimeOperationalEvent(runtime, "error", "process_uncaught_exception", {
      storageKind: runtime.repositoryConfig.kind,
      error: {
        name: error.name,
        message: error.message
      }
    });
    shutdown("uncaughtException");
  });
  process.on("unhandledRejection", reason => {
    recordRuntimeOperationalEvent(runtime, "error", "process_unhandled_rejection", {
      storageKind: runtime.repositoryConfig.kind,
      reason:
        reason instanceof Error
          ? {
              name: reason.name,
              message: reason.message
            }
          : { message: String(reason) }
    });
    shutdown("unhandledRejection");
  });

  server.listen(port, () => {
    recordRuntimeOperationalEvent(runtime, "info", "process_started", {
      storageKind: runtime.repositoryConfig.kind,
      storageSchemaVersion: runtime.repositoryConfig.schemaVersion,
      buildCommitSha: runtime.build.commitSha,
      buildTimestamp: runtime.build.builtAt,
      port
    });
    process.stdout.write(
      `${describeProductionApi({
        storageKind: runtime.repositoryConfig.kind,
        storageSchemaVersion: runtime.repositoryConfig.schemaVersion,
        buildCommitSha: runtime.build.commitSha,
        buildTimestamp: runtime.build.builtAt
      })}\n`
    );
    process.stdout.write(`listening=http://127.0.0.1:${port}\n`);
  });
}
