import { randomUUID } from "node:crypto";
import { existsSync } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { extname, relative, resolve } from "node:path";
import { fileURLToPath, URL } from "node:url";

import {
  createFirstSliceServices,
  type FirstSliceError,
  type FirstSliceRepository,
  type FirstSliceServices,
  firstSliceUseCases
} from "@testcenter-rewrite-app/application";
import {
  type AdminSignInRequest,
  type AdminSignInResponse,
  type AdminSignOutResponse,
  type AdminAuditEventListQuery,
  type ApiErrorResponse,
  type ActivateContentReleaseRequest,
  type ActivateContentReleaseResponse,
  type AssignAdminRoleRequest,
  type AssignAdminRoleResponse,
  type BootstrapAdminUserRequest,
  type BootstrapAdminUserResponse,
  type CompleteTestRunRequest,
  type CompleteTestRunResponse,
  type CreateAdminUserRequest,
  type CreateAdminUserResponse,
  type CreateImportJobRequest,
  type CreateImportJobResponse,
  type CreateReviewRequest,
  type CreateSourcePackageRequest,
  type CreateSourcePackageResponse,
  type CreateTenantRequest,
  type CreateTenantResponse,
  type CreateWorkspaceRequest,
  type CreateWorkspaceResponse,
  type DeleteGroupResultsResponse,
  type DeleteReviewResponse,
  type DetailedResponseListQuery,
  type GetContentReleaseActivationReadinessResponse,
  type GetContentReleaseResponse,
  type GetAdminCurrentSessionResponse,
  type GetImportJobResponse,
  type GetParticipantSessionResponse,
  type ListDetailedResponsesResponse,
  type ListReviewsResponse,
  type GetRuntimeConfigResponse,
  type GetRuntimeDiagnosticsResponse,
  type GetSourcePackageResponse,
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
  type IssueMonitorRunCommandRequest,
  type IssueMonitorRunCommandResponse,
  type IssueMonitorRunCommandsRequest,
  type IssueMonitorRunCommandsResponse,
  type ListAdminAuditEventsResponse,
  type ListAdminSessionsResponse,
  type ListWorkspaceActivityEventsResponse,
  type ListImportJobsResponse,
  type ListAdminUsersResponse,
  type ListTenantsResponse,
  type ListWorkspacesResponse,
  type ListParticipantRosterResponse,
  type ListParticipantSessionsResponse,
  type ListContentReleasesResponse,
  type ListSourcePackagesResponse,
  type MonitorOpenRunsResponse,
  type MonitorOpenRunsQuery,
  type ParticipantCurrentRunStateResponse,
  type ParticipantLaunchRequest,
  type ParticipantLaunchResponse,
  type ParticipantRuntimeStateResponse,
  type ResumeParticipantSessionRequest,
  type ResumeTestRunResponse,
  type ResumeParticipantSessionResponse,
  type RetrySourcePackageImportRequest,
  type RetrySourcePackageImportResponse,
  type ReviewResponse,
  type RuntimeOperationalEvent,
  type ResetAdminUserPasswordRequest,
  type ResetAdminUserPasswordResponse,
  type RevokeAdminRoleResponse,
  type RevokeAdminSessionResponse,
  type SaveTestRunProgressRequest,
  type SaveTestRunProgressResponse,
  type UnlockParticipantTestletRequest,
  type UnlockParticipantTestletResponse,
  type ParticipantSignInRequest,
  type ParticipantSignInResponse,
  type UpdateAdminUserRequest,
  type UpdateAdminUserResponse,
  type AdminSessionListQuery,
  type AdminUserListQuery,
  type ContentReleaseListQuery,
  type ImportJobListQuery,
  type SourcePackageListQuery,
  type UpdateReviewRequest,
  type WorkspaceReviewListQuery,
  productionApiRoutes,
  type PublicAdminSession,
  type PublicAdminUser,
  type AdminUserDirectoryItem,
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
  sourceFileName: "demo-assessment.xml",
  sourceMediaType: "application/xml",
  sourceDocument:
    '<assessment><booklet key="booklet:demo" label="Demo Booklet"><BookletConfig><Config key="toolbar_show_unit_list">TRUE</Config></BookletConfig><unit key="unit-intro" label="Introduction"><description>Demo introduction task</description><prompt>Describe what you see in the demo introduction.</prompt></unit><unit key="unit-practice" label="Practice"><prompt>Save a practice response.</prompt></unit><unit key="unit-finish" label="Finish"><prompt>Complete the demo test.</prompt></unit></booklet></assessment>'
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

  await services.workspaceAdminRead.importParticipantRoster({
    tenantKey: localDemoBootstrap.tenantKey,
    workspaceKey: localDemoBootstrap.workspaceKey,
    rosterText: [
      "loginKey,groupKey,bookletKey,displayName",
      `${localDemoBootstrap.participantLoginKey},group:student-demo,booklet:demo,Demo Student`
    ].join("\n")
  });

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
  const participantLoginMaxFailures = parsePositiveIntegerEnvironmentValue(
    "FIRST_SLICE_PARTICIPANT_LOGIN_MAX_FAILURES",
    DEFAULT_PARTICIPANT_LOGIN_MAX_FAILURES
  );
  const participantLoginFailureWindowMs = parsePositiveIntegerEnvironmentValue(
    "FIRST_SLICE_PARTICIPANT_LOGIN_FAILURE_WINDOW_MS",
    DEFAULT_PARTICIPANT_LOGIN_FAILURE_WINDOW_MS
  );
  const demoBootstrapEnabled = parseBooleanEnvironmentFlag(
    "FIRST_SLICE_BOOTSTRAP_DEMO",
    false
  );
  const repositoryConfig = await createRepositoryFromEnvironment();
  const repository = repositoryConfig.repository;
  const services = createFirstSliceServices({
    repository,
    participantAccessTimeZone:
      process.env.FIRST_SLICE_PARTICIPANT_TIME_ZONE ?? "Europe/Berlin",
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
      httpTimeouts: {
        headersTimeoutMs: httpHeadersTimeoutMs,
        requestTimeoutMs: httpRequestTimeoutMs,
        keepAliveTimeoutMs: httpKeepAliveTimeoutMs
      },
      operatorAuthRequired,
      participantLoginProtection: {
        maxFailures: participantLoginMaxFailures,
        failureWindowMs: participantLoginFailureWindowMs
      },
      environment: {
        firstSliceStore: store,
        firstSliceFilePresent: Boolean(process.env.FIRST_SLICE_FILE),
        firstSliceSqliteFilePresent: Boolean(process.env.FIRST_SLICE_SQLITE_FILE),
        firstSlicePostgresUrlPresent: Boolean(process.env.FIRST_SLICE_POSTGRES_URL),
        firstSliceMaxJsonBodyBytesPresent: Boolean(
          process.env.FIRST_SLICE_MAX_JSON_BODY_BYTES
        ),
        firstSliceOperatorAuthRequired: operatorAuthRequired,
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
        appBuildTimestampPresent: Boolean(process.env.APP_BUILD_TIMESTAMP)
      }
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
  "permissions-policy": "camera=(), geolocation=(), microphone=()"
};

const MAX_RUNTIME_OPERATIONAL_EVENTS = 100;
const DEFAULT_SHUTDOWN_DRAIN_DELAY_MS = 1_000;
const DEFAULT_MAX_JSON_BODY_BYTES = 1_048_576;
const DEFAULT_HTTP_HEADERS_TIMEOUT_MS = 60_000;
const DEFAULT_HTTP_REQUEST_TIMEOUT_MS = 120_000;
const DEFAULT_HTTP_KEEP_ALIVE_TIMEOUT_MS = 5_000;
const DEFAULT_PARTICIPANT_LOGIN_MAX_FAILURES = 5;
const DEFAULT_PARTICIPANT_LOGIN_FAILURE_WINDOW_MS = 30 * 60 * 1_000;

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
    ...htmlHeaders
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

  const role = url.searchParams.get("role")?.trim() || undefined;
  if (
    role &&
    role !== "platform_admin" &&
    role !== "tenant_admin" &&
    role !== "workspace_admin"
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
    status: adminUser.status,
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
const sourcePackageCreatePattern = createRoutePattern(
  productionApiRoutes.workspace.createSourcePackage
);
const sourcePackageListPattern = createRoutePattern(
  productionApiRoutes.workspace.listSourcePackages
);
const sourcePackageDetailPattern = createRoutePattern(
  productionApiRoutes.workspace.getSourcePackage
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
const logCsvExportPattern = createRoutePattern(
  productionApiRoutes.workspace.exportLogCsv
);
const reviewCsvExportPattern = createRoutePattern(
  productionApiRoutes.workspace.exportReviewCsv
);
const detailedResponsesPattern = createRoutePattern(
  productionApiRoutes.workspace.listDetailedResponses
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
const runtimeStatePattern = createRoutePattern(
  productionApiRoutes.participant.getRuntimeState
);
const currentRunStatePattern = createRoutePattern(
  productionApiRoutes.participant.getCurrentRunState
);
const participantResourcePattern =
  /^\/api\/v1\/participant\/sessions\/(?<participantSessionId>[^/]+)\/resources\/(?<resourcePath>.+)$/;
const saveProgressPattern = createRoutePattern(
  productionApiRoutes.participant.saveProgress
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
const completeRunPattern = createRoutePattern(
  productionApiRoutes.participant.completeRun
);
const monitorOpenRunsPattern = createRoutePattern(
  productionApiRoutes.monitor.openRuns
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
  ["GET", workspaceOverviewCsvExportPattern],
  ["GET", studyMonitorSummaryPattern],
  ["GET", studyMonitorParticipantMatrixPattern],
  ["GET", studyMonitorParticipantPattern],
  ["GET", studyMonitorGroupPattern],
  ["GET", studyMonitorBookletPattern],
  ["GET", studyMonitorUnitPattern],
  ["GET", studyMonitorRunPattern],
  ["GET", workspaceActivityEventListPattern],
  ["POST", sourcePackageCreatePattern],
  ["GET", sourcePackageListPattern],
  ["GET", sourcePackageDetailPattern],
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
  ["GET", reviewListPattern],
  ["POST", reviewListPattern],
  ["PATCH", reviewDetailPattern],
  ["DELETE", reviewDetailPattern],
  ["DELETE", deleteGroupResultsPattern],
  ["GET", responseCsvExportPattern],
  ["GET", logCsvExportPattern],
  ["GET", reviewCsvExportPattern],
  ["GET", contentReleaseListPattern],
  ["GET", contentReleaseDetailPattern],
  ["GET", contentReleaseActivationReadinessPattern],
  ["POST", contentReleaseActivatePattern],
  ["GET", monitorOpenRunsPattern],
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

const hasOperatorAccess = async (
  repository: FirstSliceRepository,
  roleAssignments: AdminRoleAssignment[],
  scope: OperatorAccessScope
): Promise<boolean> => {
  if (roleAssignments.some(roleAssignment => roleAssignment.role === "platform_admin")) {
    return true;
  }

  if (scope.kind === "platform") {
    return false;
  }

  const tenant = await repository.getTenantByKey(scope.tenantKey);
  if (!tenant) {
    return false;
  }

  if (
    roleAssignments.some(
      roleAssignment =>
        roleAssignment.role === "tenant_admin" &&
        roleAssignment.tenantId === tenant.tenantId
    )
  ) {
    return true;
  }

  if (scope.kind === "tenant") {
    return false;
  }

  const workspace = await repository.getWorkspaceByScope(
    scope.tenantKey,
    scope.workspaceKey
  );
  if (!workspace) {
    return false;
  }

  return roleAssignments.some(
    roleAssignment =>
      roleAssignment.role === "workspace_admin" &&
      roleAssignment.workspaceId === workspace.workspaceId
  );
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

const resolveFrontendContentType = (pathname: string): string => {
  switch (extname(pathname)) {
    case ".css":
      return "text/css; charset=utf-8";
    case ".js":
      return "text/javascript; charset=utf-8";
    case ".json":
      return "application/json; charset=utf-8";
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
    sendAsset(response, 200, resolveFrontendContentType(candidatePath), body);
  } catch {
    sendError(response, 404, "not_found", "Frontend asset not found.", {
      assetPath: relativePath
    });
  }

  return true;
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

  if (method === "DELETE" && adminSessionRevokePattern.test(pathname)) {
    return `DELETE ${productionApiRoutes.admin.revokeSession}`;
  }

  if (method === "POST" && pathname === productionApiRoutes.admin.signOut) {
    return `POST ${productionApiRoutes.admin.signOut}`;
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
    ["POST", sourcePackageCreatePattern, productionApiRoutes.workspace.createSourcePackage],
    ["GET", sourcePackageListPattern, productionApiRoutes.workspace.listSourcePackages],
    ["GET", sourcePackageDetailPattern, productionApiRoutes.workspace.getSourcePackage],
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
      logCsvExportPattern,
      productionApiRoutes.workspace.exportLogCsv
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
    ["GET", runtimeStatePattern, productionApiRoutes.participant.getRuntimeState],
    ["GET", currentRunStatePattern, productionApiRoutes.participant.getCurrentRunState],
    ["GET", participantResourcePattern, productionApiRoutes.participant.getResource],
    ["POST", saveProgressPattern, productionApiRoutes.participant.saveProgress],
    ["POST", unlockTestletPattern, productionApiRoutes.participant.unlockTestlet],
    ["POST", resumeSessionPattern, productionApiRoutes.participant.resumeSession],
    ["POST", resumeRunPattern, productionApiRoutes.participant.resumeRun],
    ["POST", completeRunPattern, productionApiRoutes.participant.completeRun],
    ["GET", monitorOpenRunsPattern, productionApiRoutes.monitor.openRuns],
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

const parseOperatorReadLimit = (
  url: URL,
  response: ServerResponse,
  error: string,
  message: string
): { ok: true; limit?: number } | { ok: false } => {
  const limitRawValue = readOptionalQueryValue(url, "limit");
  const limit = limitRawValue ? Number.parseInt(limitRawValue, 10) : undefined;
  if (
    limitRawValue &&
    (!/^\d+$/.test(limitRawValue) || !limit || limit < 1 || limit > 500)
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
    mediaType: readOptionalQueryValue(url, "mediaType"),
    fileName: readOptionalQueryValue(url, "fileName"),
    latestImportStatus: latestImportStatus as ImportJobStatus | undefined,
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
  response: ServerResponse
): DetailedResponseListQuery | null => {
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
    "Detailed response limit must be an integer between 1 and 500."
  );
  if (!limitResult.ok) {
    return null;
  }

  return {
    loginKey: readOptionalQueryValue(url, "loginKey"),
    groupKey: readOptionalQueryValue(url, "groupKey"),
    bookletKey: readOptionalQueryValue(url, "bookletKey"),
    participantSessionId: readOptionalQueryValue(url, "participantSessionId"),
    testRunId: readOptionalQueryValue(url, "testRunId"),
    unitKey: readOptionalQueryValue(url, "unitKey"),
    status: status as TestRunStatus | undefined,
    limit: limitResult.limit
  };
};

const parseWorkspaceReviewListQuery = (
  url: URL,
  response: ServerResponse
): WorkspaceReviewListQuery | null => {
  const limitResult = parseOperatorReadLimit(
    url,
    response,
    "workspace_review_limit_invalid",
    "Workspace review limit must be an integer between 1 and 500."
  );
  if (!limitResult.ok) {
    return null;
  }

  return {
    loginKey: readOptionalQueryValue(url, "loginKey"),
    groupKey: readOptionalQueryValue(url, "groupKey"),
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

const createRequestHandler = (runtime: Awaited<ReturnType<typeof createApiRuntime>>) =>
  async (request: IncomingMessage, response: ServerResponse): Promise<void> => {
    const services = runtime.services;
    const requestId = randomUUID();
    const requestStartedAt = process.hrtime.bigint();
    const method = request.method ?? "UNKNOWN";
    const effectiveMethod = method === "HEAD" ? "GET" : method;
    const metrics = runtime.metrics;
    const routeLabel = resolveMetricsRouteLabel(
      effectiveMethod,
      new URL(request.url ?? "/", "http://127.0.0.1").pathname
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
        path: request.url ?? null,
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
    const readOptionalRequestJsonBody = <T>(): Promise<T | null> =>
      readOptionalJsonBody<T>(request, runtime.config.maxJsonBodyBytes);

    try {
      if (request.method === "GET" && isParticipantEntryPath(pathname)) {
        sendRedirect(response, 302, `/app/participant${url.search}`);
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
            httpTimeouts: runtime.config.httpTimeouts,
            operatorAuthRequired: runtime.config.operatorAuthRequired,
            participantLoginProtection:
              runtime.config.participantLoginProtection,
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
          status: body.status
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
          tenantKey: body.tenantKey,
          workspaceKey: body.workspaceKey
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

        const item = await services.adminDirectory.revokeAdminRole({
          sessionToken,
          adminUserId,
          roleAssignmentId
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

        const { roleAssignments } = await services.adminAuth.getCurrentSession({
          sessionToken
        });
        if (
          !operatorAccessScope ||
          !(await hasOperatorAccess(
            runtime.repository,
            roleAssignments,
            operatorAccessScope
          ))
        ) {
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

      const sourcePackageCreateMatch = sourcePackageCreatePattern.exec(pathname);
      const sourcePackageListMatch = sourcePackageListPattern.exec(pathname);
      const sourcePackageDetailMatch = sourcePackageDetailPattern.exec(pathname);
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

        const items = await services.workspaceAdminRead.listSourcePackages({
          tenantKey,
          workspaceKey,
          ...query
        });
        sendJson<ListSourcePackagesResponse>(response, 200, { items });
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

        const body = await readRequestJsonBody<RetrySourcePackageImportRequest>();
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

        const body = await readRequestJsonBody<CreateSourcePackageRequest>();
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
      const logCsvExportMatch = logCsvExportPattern.exec(pathname);
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

        const items = await services.workspaceAdminRead.listParticipantRoster({
          tenantKey,
          workspaceKey
        });
        sendJson<ListParticipantRosterResponse>(response, 200, { items });
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
          reviewerId: body.reviewerId,
          category: body.category,
          comment: body.comment
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
          reviewerId: body.reviewerId,
          category: body.category,
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

        const csv = await services.monitorRead.exportOpenRunsCsv({
          tenantKey,
          workspaceKey,
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

        const query = parseDetailedResponseListQuery(url, response);
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

        const csv = await services.workspaceAdminRead.exportLogCsv({
          tenantKey,
          workspaceKey
        });
        sendCsv(response, 200, `${workspaceKey}-logs.csv`, csv);
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

        const query = parseWorkspaceReviewListQuery(url, response);
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
          participantSessionId
        });
        sendJson<ParticipantCurrentRunStateResponse>(response, 200, {
          currentRunState
        });
        return;
      }

      const participantResourceMatch = participantResourcePattern.exec(pathname);
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
        sendAsset(
          response,
          200,
          resource.mediaType,
          Buffer.from(resource.dataBase64, "base64"),
          { "access-control-allow-origin": "*" }
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
          password: body.password
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
          currentUnitKey: body.currentUnitKey,
          status: body.status,
          unitResponse: body.unitResponse,
          confirmTestletTimeLeave: body.confirmTestletTimeLeave,
          confirmTestletLeaveLock: body.confirmTestletLeaveLock
        });
        sendJson<SaveTestRunProgressResponse>(response, 200, { testRun });
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
          confirmTestletTimeLeave: body?.confirmTestletTimeLeave,
          confirmTestletLeaveLock: body?.confirmTestletLeaveLock
        });
        sendJson<CompleteTestRunResponse>(response, 200, { testRun });
        return;
      }

      const monitorOpenRunsMatch = monitorOpenRunsPattern.exec(pathname);
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

        const items = await services.monitorRead.listOpenRuns({
          tenantKey,
          workspaceKey,
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
        if (!Array.isArray(body.testRunIds)) {
          sendError(
            response,
            400,
            "monitor_bulk_test_run_ids_invalid",
            "testRunIds must be an array containing 1 to 100 run ids."
          );
          return;
        }
        const normalizedTestRunIds = [
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

        const { commands, failures } =
          await services.monitorControl.issueRunCommands({
            tenantKey,
            workspaceKey,
            testRunIds: normalizedTestRunIds,
            commandType: body.commandType,
            actorId: body.actorId,
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
        const command = await services.monitorControl.issueRunCommand({
          tenantKey,
          workspaceKey,
          testRunId,
          commandType: body.commandType,
          actorId: body.actorId,
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
          error.errorCode === "participant_login_rate_limited" &&
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
