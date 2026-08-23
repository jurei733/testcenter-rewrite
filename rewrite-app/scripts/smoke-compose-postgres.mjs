import { spawn } from "node:child_process";
import { randomBytes } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

const parseBooleanFlag = (value, label = "boolean flag") => {
  const normalizedValue = value.trim().toLowerCase();
  if (["1", "true", "yes", "on", "required"].includes(normalizedValue)) {
    return true;
  }
  if (["0", "false", "no", "off", "optional"].includes(normalizedValue)) {
    return false;
  }
  throw new Error(
    `${label} must be a boolean-like flag, got '${value}'.`
  );
};

const buildSha = process.env.APP_BUILD_SHA ?? "local-compose-smoke";
const buildTimestamp =
  process.env.APP_BUILD_TIMESTAMP ?? new Date().toISOString();
const operatorAuthRequired =
  process.env.FIRST_SLICE_OPERATOR_AUTH_REQUIRED ?? "true";
const bootstrapDemo = process.env.FIRST_SLICE_BOOTSTRAP_DEMO ?? "false";
const productionBoundary = parseBooleanFlag(
  process.env.SMOKE_COMPOSE_PRODUCTION_BOUNDARY ?? "false",
  "SMOKE_COMPOSE_PRODUCTION_BOUNDARY"
);
if (
  productionBoundary &&
  parseBooleanFlag(bootstrapDemo, "FIRST_SLICE_BOOTSTRAP_DEMO")
) {
  throw new Error(
    "SMOKE_COMPOSE_PRODUCTION_BOUNDARY cannot be combined with FIRST_SLICE_BOOTSTRAP_DEMO."
  );
}
const bootstrapAdminUsername =
  process.env.FIRST_SLICE_BOOTSTRAP_ADMIN_USERNAME ?? "release-admin";
const bootstrapAdminPassword = randomBytes(24).toString("base64url");
let generatedSecretDirectory = null;
let bootstrapAdminPasswordSourceFile = null;
if (productionBoundary) {
  generatedSecretDirectory = await mkdtemp(
    join(tmpdir(), "testcenter-rewrite-compose-secret-")
  );
  bootstrapAdminPasswordSourceFile = join(
    generatedSecretDirectory,
    "bootstrap-admin-password"
  );
  await writeFile(
    bootstrapAdminPasswordSourceFile,
    `${bootstrapAdminPassword}\n`,
    // Docker Compose implements local file-backed secrets as bind mounts. The
    // generated directory remains owner-only, while the mounted file must be
    // readable by the non-root `node` user inside the container.
    { encoding: "utf8", mode: 0o644 }
  );
}
const composeArgs = [
  "compose",
  "-f",
  "docker-compose.postgres.yml",
  ...(productionBoundary
    ? [
        "-f",
        "docker-compose.production.yml",
        "-f",
        "docker-compose.bootstrap.yml"
      ]
    : [])
];
const composeProjectName =
  process.env.COMPOSE_PROJECT_NAME ?? `rewrite-app-smoke-${process.pid}`;

const parsePositiveInteger = (value, label) => {
  const parsedValue = Number.parseInt(value, 10);
  if (!Number.isFinite(parsedValue) || parsedValue <= 0) {
    throw new Error(`${label} must be a positive integer, got '${value}'.`);
  }
  return parsedValue;
};

const composeUpTimeoutMs = parsePositiveInteger(
  process.env.SMOKE_COMPOSE_UP_TIMEOUT_MS ?? "180000",
  "SMOKE_COMPOSE_UP_TIMEOUT_MS"
);
const rewriteAppPort = parsePositiveInteger(
  process.env.REWRITE_APP_PORT ?? "4310",
  "REWRITE_APP_PORT"
);

const run = (command, args, options = {}) =>
  new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: options.env ?? process.env
    });
    let timedOut = false;
    let timeout = null;
    let killTimeout = null;
    if (options.timeoutMs) {
      timeout = setTimeout(() => {
        timedOut = true;
        child.kill("SIGTERM");
        killTimeout = setTimeout(() => {
          child.kill("SIGKILL");
        }, 5_000);
      }, options.timeoutMs);
    }
    child.once("error", reject);
    child.once("exit", code => {
      if (timeout) {
        clearTimeout(timeout);
      }
      if (killTimeout) {
        clearTimeout(killTimeout);
      }
      if (timedOut) {
        reject(
          new Error(
            `${command} ${args.join(" ")} timed out after ${options.timeoutMs}ms`
          )
        );
        return;
      }
      if (code === 0) {
        resolvePromise(undefined);
        return;
      }
      reject(new Error(`${command} ${args.join(" ")} exited with code ${code ?? 1}`));
    });
  });

const capture = (command, args, options = {}) =>
  new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      env: options.env ?? process.env
    });
    let stdout = "";
    let stderr = "";
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", chunk => {
      stdout += chunk;
    });
    child.stderr.on("data", chunk => {
      stderr += chunk;
    });
    child.once("error", reject);
    child.once("exit", code => {
      if (code === 0) {
        resolvePromise(stdout.trim());
        return;
      }
      reject(
        new Error(
          `${command} ${args.join(" ")} exited with code ${code ?? 1}: ${stderr.trim()}`
        )
      );
    });
  });

const readExpectedPostgresSchemaVersion = async () => {
  const source = await readFile(
    new URL("../packages/postgres-store/src/index.ts", import.meta.url),
    "utf8"
  );
  const versions = Array.from(
    source.matchAll(/\bversion:\s*(\d+)\b/g),
    match => Number.parseInt(match[1], 10)
  );
  if (versions.length === 0) {
    throw new Error("Could not resolve expected Postgres schema version.");
  }
  return Math.max(...versions);
};

const pollJson = async url => {
  const deadline = Date.now() + 40_000;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`Unexpected status ${response.status} for ${url}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      await delay(1_000);
    }
  }

  throw lastError ?? new Error(`Timed out waiting for ${url}`);
};

const expectEqual = (label, actual, expected) => {
  if (actual !== expected) {
    throw new Error(
      `Expected ${label}=${expected} but got ${actual ?? "unknown"}.`
    );
  }
};

const expectRedactedPostgresLocation = (label, location) => {
  if (typeof location !== "string" || !/^postgres(?:ql)?:\/\//.test(location)) {
    throw new Error(`Expected ${label} to expose a redacted Postgres URL.`);
  }

  const url = new URL(location);
  expectEqual(`${label}.username`, url.username, "REDACTED");
  expectEqual(`${label}.password`, url.password, "REDACTED");
};

const requestJson = async (url, options = {}) => {
  const response = await fetch(url, {
    ...options,
    headers: {
      ...(options.body ? { "content-type": "application/json" } : {}),
      ...(options.headers ?? {})
    },
    body:
      options.body && typeof options.body !== "string"
        ? JSON.stringify(options.body)
        : options.body
  });
  const payload = await response.json().catch(() => null);
  return { response, payload };
};

const createComposeEnvironment = () => ({
  ...process.env,
  COMPOSE_PROJECT_NAME: composeProjectName,
  APP_BUILD_SHA: buildSha,
  APP_BUILD_TIMESTAMP: buildTimestamp,
  FIRST_SLICE_OPERATOR_AUTH_REQUIRED: operatorAuthRequired,
  FIRST_SLICE_BOOTSTRAP_DEMO: bootstrapDemo,
  ...(productionBoundary
    ? {
        FIRST_SLICE_HSTS_ENABLED: "true",
        FIRST_SLICE_BOOTSTRAP_ADMIN_USERNAME: bootstrapAdminUsername,
        FIRST_SLICE_BOOTSTRAP_ADMIN_DISPLAY_NAME: "Release Administrator",
        FIRST_SLICE_BOOTSTRAP_ADMIN_PASSWORD_SOURCE_FILE:
          bootstrapAdminPasswordSourceFile
      }
    : {}),
  REWRITE_APP_PORT: String(rewriteAppPort)
});

const dumpComposeLogs = async env => {
  await run("docker", [...composeArgs, "logs"], { env }).catch(() => undefined);
};

const verifyBootstrappedDemo = async baseUrl => {
  const adminSignIn = await requestJson(`${baseUrl}/api/v1/admin/auth/sign-in`, {
    method: "POST",
    body: {
      username: "demo-admin",
      password: "demo-admin-password"
    }
  });
  expectEqual("demo admin sign-in status", adminSignIn.response.status, 200);
  expectEqual("demo admin username", adminSignIn.payload?.adminUser?.username, "demo-admin");
  expectEqual(
    "demo admin first role",
    adminSignIn.payload?.roleAssignments?.[0]?.role,
    "platform_admin"
  );

  const sessionToken = adminSignIn.payload?.sessionToken;
  if (typeof sessionToken !== "string" || sessionToken.length === 0) {
    throw new Error("Expected demo admin sign-in to return a bearer session token.");
  }

  const overview = await requestJson(
    `${baseUrl}/api/v1/tenants/demo-tenant/workspaces/demo-workspace`,
    {
      headers: {
        authorization: `Bearer ${sessionToken}`
      }
    }
  );
  expectEqual("demo workspace overview status", overview.response.status, 200);
  expectEqual(
    "demo workspace key",
    overview.payload?.workspaceOverview?.workspace?.workspaceKey,
    "demo-workspace"
  );
  if (
    typeof overview.payload?.workspaceOverview?.activeContentReleaseId !== "string" ||
    overview.payload.workspaceOverview.activeContentReleaseId.length === 0
  ) {
    throw new Error("Expected demo workspace to have an active content release.");
  }

  const tenantDirectoryCsv = await fetch(`${baseUrl}/api/v1/platform/tenants.csv`, {
    headers: {
      authorization: `Bearer ${sessionToken}`
    }
  });
  expectEqual("demo tenant directory CSV status", tenantDirectoryCsv.status, 200);
  expectEqual(
    "demo tenant directory CSV content-type",
    tenantDirectoryCsv.headers.get("content-type"),
    "text/csv; charset=utf-8"
  );
  const tenantDirectoryCsvText = await tenantDirectoryCsv.text();
  if (
    !tenantDirectoryCsvText.startsWith(
      "tenantKey,displayName,status,tenantId,createdAt\n"
    ) ||
    !tenantDirectoryCsvText.includes('"demo-tenant","Demo Tenant"')
  ) {
    throw new Error("Expected demo tenant directory CSV to contain demo-tenant.");
  }

  const workspaceDirectoryCsv = await fetch(
    `${baseUrl}/api/v1/tenants/demo-tenant/workspaces.csv`,
    {
      headers: {
        authorization: `Bearer ${sessionToken}`
      }
    }
  );
  expectEqual(
    "demo workspace directory CSV status",
    workspaceDirectoryCsv.status,
    200
  );
  expectEqual(
    "demo workspace directory CSV content-type",
    workspaceDirectoryCsv.headers.get("content-type"),
    "text/csv; charset=utf-8"
  );
  const workspaceDirectoryCsvText = await workspaceDirectoryCsv.text();
  if (
    !workspaceDirectoryCsvText.startsWith(
      "tenantKey,workspaceKey,displayName,status,workspaceId,createdAt,latestFileModificationAt\n"
    ) ||
    !workspaceDirectoryCsvText.includes(
      '"demo-tenant","demo-workspace","Demo Workspace"'
    )
  ) {
    throw new Error(
      "Expected demo workspace directory CSV to contain demo-workspace."
    );
  }

  const rosterCsv = await fetch(
    `${baseUrl}/api/v1/tenants/demo-tenant/workspaces/demo-workspace/exports/participant-roster.csv`,
    {
      headers: {
        authorization: `Bearer ${sessionToken}`
      }
    }
  );
  expectEqual("demo roster CSV status", rosterCsv.status, 200);
  expectEqual(
    "demo roster CSV content-type",
    rosterCsv.headers.get("content-type"),
    "text/csv; charset=utf-8"
  );
  const rosterCsvText = await rosterCsv.text();
  if (
    !rosterCsvText.startsWith(
      "tenantKey,workspaceKey,participantRosterEntryId,loginKey,executionMode,groupKey,groupLabel,bookletKey,displayName,passwordRequired,importedAt,validationWarningCodes,validationWarningMessages,bookletKeys,bookletStatePresets,bookletAssignments,validFrom,validTo,validForMinutes\n"
    ) ||
    !/"demo-tenant","demo-workspace","[^"]+","student-demo","run-hot-return","group:student-demo","Demo Group","booklet:demo","Demo Student","false"/.test(
      rosterCsvText
    )
  ) {
    throw new Error("Expected demo participant roster CSV to contain student-demo.");
  }

  const participantSignIn = await requestJson(
    `${baseUrl}/api/v1/participant/auth/sign-in`,
    {
      method: "POST",
      body: {
        workspaceKey: "demo-workspace",
        loginKey: "student-demo"
      }
    }
  );
  expectEqual("demo participant sign-in status", participantSignIn.response.status, 200);
  expectEqual(
    "demo participant login key",
    participantSignIn.payload?.participantSession?.loginKey,
    "student-demo"
  );

  const participantSessionId =
    participantSignIn.payload?.participantSession?.participantSessionId;
  if (typeof participantSessionId !== "string" || participantSessionId.length === 0) {
    throw new Error("Expected demo participant sign-in to return a session id.");
  }

  const resumed = await requestJson(
    `${baseUrl}/api/v1/participant/sessions/${participantSessionId}/resume`,
    {
      method: "POST"
    }
  );
  expectEqual("demo participant resume status", resumed.response.status, 200);
  expectEqual("demo test run status", resumed.payload?.testRun?.status, "running");
  expectEqual("demo booklet key", resumed.payload?.testRun?.bookletKey, "booklet:demo");
  expectEqual("demo current unit key", resumed.payload?.testRun?.currentUnitKey, "unit-intro");

  const saved = await requestJson(
    `${baseUrl}/api/v1/participant/test-runs/${resumed.payload?.testRun?.testRunId}/save-progress`,
    {
      method: "POST",
      body: {
        currentUnitKey: "unit-intro",
        status: "running",
        unitResponse: "My first demo response"
      }
    }
  );
  expectEqual("demo participant save-progress status", saved.response.status, 200);
  expectEqual(
    "demo saved unit-intro response",
    saved.payload?.testRun?.unitResponses?.["unit-intro"],
    "My first demo response"
  );

  const participantSessionsCsv = await fetch(
    `${baseUrl}/api/v1/tenants/demo-tenant/workspaces/demo-workspace/exports/participant-sessions.csv?loginKey=student-demo&groupKey=${encodeURIComponent("group:student-demo")}&limit=1`,
    {
      headers: {
        authorization: `Bearer ${sessionToken}`
      }
    }
  );
  expectEqual("demo participant sessions CSV status", participantSessionsCsv.status, 200);
  expectEqual(
    "demo participant sessions CSV content-type",
    participantSessionsCsv.headers.get("content-type"),
    "text/csv; charset=utf-8"
  );
  const participantSessionsCsvText = await participantSessionsCsv.text();
  if (
    !participantSessionsCsvText.startsWith(
      "tenantKey,workspaceKey,participantSessionId,loginKey,groupKey,groupLabel,executionMode,sessionStatus,"
    ) ||
    !participantSessionsCsvText.includes('"student-demo"') ||
    !participantSessionsCsvText.includes('"group:student-demo"') ||
    !participantSessionsCsvText.includes('"booklet:demo"') ||
    !participantSessionsCsvText.includes('"unit-intro"')
  ) {
    throw new Error(
      "Expected demo participant sessions CSV to contain student-demo run context."
    );
  }

  const participantMatrix = await fetch(
    `${baseUrl}/api/v1/tenants/demo-tenant/workspaces/demo-workspace/study-monitor/participants`,
    {
      headers: {
        authorization: `Bearer ${sessionToken}`
      }
    }
  );
  expectEqual("demo participant matrix status", participantMatrix.status, 200);
  const participantMatrixBody = await participantMatrix.json();
  const participantMatrixRows =
    participantMatrixBody.studyMonitorParticipantMatrix?.rows ?? [];
  const participantIntroRow = participantMatrixRows.find(
    row => row.loginKey === "student-demo" && row.unitKey === "unit-intro"
  );
  if (
    participantIntroRow?.groupKey !== "group:student-demo" ||
    participantIntroRow?.testRunStatus !== "running" ||
    participantIntroRow?.answered !== true
  ) {
    throw new Error(
      "Expected demo participant matrix read model to contain answered unit-intro."
    );
  }

  const participantDetail = await fetch(
    `${baseUrl}/api/v1/tenants/demo-tenant/workspaces/demo-workspace/study-monitor/participants/student-demo`,
    {
      headers: {
        authorization: `Bearer ${sessionToken}`
      }
    }
  );
  expectEqual("demo participant detail status", participantDetail.status, 200);
  const participantDetailBody = await participantDetail.json();
  const participantDetailIntroRow =
    participantDetailBody.studyMonitorParticipant?.unitRows?.find(
      row => row.unitKey === "unit-intro"
    );
  if (
    participantDetailBody.studyMonitorParticipant?.loginKey !== "student-demo" ||
    participantDetailBody.studyMonitorParticipant?.testRunCount !== 1 ||
    participantDetailIntroRow?.answered !== true ||
    participantDetailIntroRow?.testRunStatus !== "running"
  ) {
    throw new Error(
      "Expected demo participant detail read model to contain answered unit-intro."
    );
  }

  const participantMatrixCsv = await fetch(
    `${baseUrl}/api/v1/tenants/demo-tenant/workspaces/demo-workspace/exports/study-monitor-participants.csv`,
    {
      headers: {
        authorization: `Bearer ${sessionToken}`
      }
    }
  );
  expectEqual("demo participant matrix CSV status", participantMatrixCsv.status, 200);
  expectEqual(
    "demo participant matrix CSV content-type",
    participantMatrixCsv.headers.get("content-type"),
    "text/csv; charset=utf-8"
  );
  const participantMatrixCsvText = await participantMatrixCsv.text();
  if (
    !participantMatrixCsvText.startsWith(
      "tenantKey,workspaceKey,generatedAt,loginKey,groupKey,groupLabel,displayName,"
    ) ||
    !participantMatrixCsvText.includes('"student-demo"') ||
    !participantMatrixCsvText.includes('"group:student-demo"') ||
    !participantMatrixCsvText.includes('"booklet:demo"') ||
    !participantMatrixCsvText.includes('"unit-intro"') ||
    !participantMatrixCsvText.includes('"running"')
  ) {
    throw new Error(
      "Expected demo participant matrix CSV to contain student-demo unit context."
    );
  }

  const openRunsCsv = await fetch(
    `${baseUrl}/api/v1/tenants/demo-tenant/workspaces/demo-workspace/exports/open-runs.csv`,
    {
      headers: {
        authorization: `Bearer ${sessionToken}`
      }
    }
  );
  expectEqual("demo open runs CSV status", openRunsCsv.status, 200);
  expectEqual(
    "demo open runs CSV content-type",
    openRunsCsv.headers.get("content-type"),
    "text/csv; charset=utf-8"
  );
  const openRunsCsvText = await openRunsCsv.text();
  if (
    !openRunsCsvText.startsWith(
      "tenantKey,workspaceKey,participantSessionId,testRunId,loginKey,groupKey,executionMode,bookletKey,"
    ) ||
    !openRunsCsvText.includes('"student-demo"') ||
    !openRunsCsvText.includes('"group:student-demo"') ||
    !openRunsCsvText.includes('"booklet:demo"') ||
    !openRunsCsvText.includes('"unit-intro"')
  ) {
    throw new Error("Expected demo open runs CSV to contain student-demo run context.");
  }
};

const verifyProductionBoundary = async (baseUrl, config, env) => {
  expectEqual(
    "runtimeConfig.transportSecurity.hstsEnabled",
    config.runtimeConfig?.transportSecurity?.hstsEnabled,
    true
  );
  expectEqual(
    "runtimeConfig.bootstrapAdmin.configured",
    config.runtimeConfig?.bootstrapAdmin?.configured,
    true
  );
  expectEqual(
    "runtimeConfig.environment.firstSliceBootstrapAdminPasswordFilePresent",
    config.runtimeConfig?.environment
      ?.firstSliceBootstrapAdminPasswordFilePresent,
    true
  );

  const readinessResponse = await fetch(`${baseUrl}/readyz`);
  expectEqual("production readiness status", readinessResponse.status, 200);
  expectEqual(
    "production Strict-Transport-Security header",
    readinessResponse.headers.get("strict-transport-security"),
    "max-age=31536000; includeSubDomains"
  );

  const adminSignIn = await requestJson(`${baseUrl}/api/v1/admin/auth/sign-in`, {
    method: "POST",
    body: {
      username: bootstrapAdminUsername,
      password: bootstrapAdminPassword
    }
  });
  expectEqual(
    "secret-file bootstrap admin sign-in status",
    adminSignIn.response.status,
    200
  );
  expectEqual(
    "secret-file bootstrap admin username",
    adminSignIn.payload?.adminUser?.username,
    bootstrapAdminUsername
  );
  expectEqual(
    "secret-file bootstrap admin role",
    adminSignIn.payload?.roleAssignments?.[0]?.role,
    "platform_admin"
  );

  const duplicateBootstrap = await requestJson(
    `${baseUrl}/api/v1/admin/auth/bootstrap`,
    {
      method: "POST",
      body: {
        username: "unexpected-admin",
        password: "Unexpected-Administrator-Secret-43"
      }
    }
  );
  expectEqual(
    "duplicate bootstrap status",
    duplicateBootstrap.response.status,
    409
  );
  expectEqual(
    "duplicate bootstrap error",
    duplicateBootstrap.payload?.error,
    "admin_bootstrap_already_completed"
  );

  await run("docker", [
    ...composeArgs,
    "restart",
    "rewrite-app-api"
  ], { env });
  await pollJson(`${baseUrl}/readyz`);
  const restartedAdminSignIn = await requestJson(
    `${baseUrl}/api/v1/admin/auth/sign-in`,
    {
      method: "POST",
      body: {
        username: bootstrapAdminUsername,
        password: bootstrapAdminPassword
      }
    }
  );
  expectEqual(
    "restarted secret-file bootstrap admin sign-in status",
    restartedAdminSignIn.response.status,
    200
  );
  const restartedSessionToken = restartedAdminSignIn.payload?.sessionToken;
  if (typeof restartedSessionToken !== "string" || !restartedSessionToken) {
    throw new Error(
      "Expected restarted bootstrap administrator sign-in to return a session token."
    );
  }
  const adminDirectory = await requestJson(
    `${baseUrl}/api/v1/admin/users?username=${encodeURIComponent(bootstrapAdminUsername)}`,
    {
      headers: {
        authorization: `Bearer ${restartedSessionToken}`
      }
    }
  );
  expectEqual(
    "restarted bootstrap administrator directory status",
    adminDirectory.response.status,
    200
  );
  expectEqual(
    "restarted bootstrap administrator count",
    adminDirectory.payload?.items?.length,
    1
  );

  const apiContainerId = await capture("docker", [
    ...composeArgs,
    "ps",
    "-q",
    "rewrite-app-api"
  ], { env });
  const inspectedEnvironment = await capture("docker", [
    "inspect",
    apiContainerId,
    "--format",
    "{{json .Config.Env}}"
  ], { env });
  const serviceLogs = await capture("docker", [
    ...composeArgs,
    "logs",
    "rewrite-app-api",
    "rewrite-app-preflight"
  ], { env });
  for (const [label, value] of [
    ["runtime diagnostics", JSON.stringify(config)],
    ["container environment", inspectedEnvironment],
    ["service logs", serviceLogs]
  ]) {
    if (value.includes(bootstrapAdminPassword)) {
      throw new Error(`Production bootstrap password leaked through ${label}.`);
    }
  }
};

try {
  const expectedSchemaVersion = await readExpectedPostgresSchemaVersion();
  const baseUrl = `http://127.0.0.1:${rewriteAppPort}`;
  const composeEnvironment = createComposeEnvironment();

  process.stdout.write(
    `Starting Compose Postgres smoke build/start timeout=${composeUpTimeoutMs}ms port=${rewriteAppPort} project=${composeProjectName} bootstrapDemo=${bootstrapDemo} productionBoundary=${productionBoundary}\n`
  );
  await run("docker", [
    ...composeArgs,
    "up",
    "-d",
    "--build"
  ], {
    env: composeEnvironment,
    timeoutMs: composeUpTimeoutMs
  });

  const readiness = await pollJson(`${baseUrl}/readyz`);
  const manifest = await pollJson(`${baseUrl}/manifest`);
  const config = await pollJson(`${baseUrl}/diagnostics/config`);
  const apiContainerId = await capture("docker", [
    ...composeArgs,
    "ps",
    "-q",
    "rewrite-app-api"
  ], { env: composeEnvironment });
  if (!apiContainerId) {
    throw new Error("Could not resolve rewrite-app-api container id.");
  }
  const apiContainerUser = await capture("docker", [
    "inspect",
    apiContainerId,
    "--format",
    "{{.Config.User}}"
  ], { env: composeEnvironment });

  expectEqual("readiness.storage.kind", readiness.storage?.kind, "postgres");
  expectEqual(
    "readiness.storage.schemaVersion",
    readiness.storage?.schemaVersion,
    expectedSchemaVersion
  );
  expectEqual("manifest.storage.kind", manifest.storage?.kind, "postgres");
  expectEqual(
    "manifest.storage.schemaVersion",
    manifest.storage?.schemaVersion,
    expectedSchemaVersion
  );
  expectRedactedPostgresLocation(
    "manifest.storage.location",
    manifest.storage?.location
  );
  expectEqual("manifest.build.commitSha", manifest.build?.commitSha, buildSha);
  expectEqual("manifest.build.builtAt", manifest.build?.builtAt, buildTimestamp);
  expectEqual(
    "runtimeConfig.storage.kind",
    config.runtimeConfig?.storage?.kind,
    "postgres"
  );
  expectEqual(
    "runtimeConfig.storage.schemaVersion",
    config.runtimeConfig?.storage?.schemaVersion,
    expectedSchemaVersion
  );
  expectRedactedPostgresLocation(
    "runtimeConfig.storage.location",
    config.runtimeConfig?.storage?.location
  );
  expectEqual(
    "runtimeConfig.operatorAuthRequired",
    config.runtimeConfig?.operatorAuthRequired,
    parseBooleanFlag(operatorAuthRequired, "FIRST_SLICE_OPERATOR_AUTH_REQUIRED")
  );
  expectEqual(
    "runtimeConfig.environment.firstSlicePostgresUrlPresent",
    config.runtimeConfig?.environment?.firstSlicePostgresUrlPresent,
    true
  );
  expectEqual(
    "runtimeConfig.environment.firstSliceBootstrapDemo",
    config.runtimeConfig?.environment?.firstSliceBootstrapDemo,
    parseBooleanFlag(bootstrapDemo, "FIRST_SLICE_BOOTSTRAP_DEMO")
  );
  expectEqual("apiContainer.user", apiContainerUser, "node");

  if (parseBooleanFlag(bootstrapDemo, "FIRST_SLICE_BOOTSTRAP_DEMO")) {
    await verifyBootstrappedDemo(baseUrl);
  }
  if (productionBoundary) {
    await verifyProductionBoundary(baseUrl, config, composeEnvironment);
  }

  process.stdout.write(
    `Compose Postgres smoke passed for build ${buildSha} schema=${expectedSchemaVersion} operatorAuthRequired=${operatorAuthRequired} bootstrapDemo=${bootstrapDemo} productionBoundary=${productionBoundary}\n`
  );
} catch (error) {
  await dumpComposeLogs(createComposeEnvironment());
  throw error;
} finally {
  await run("docker", [...composeArgs, "down", "-v"], {
    env: createComposeEnvironment()
  }).catch(() => undefined);
  if (generatedSecretDirectory) {
    await rm(generatedSecretDirectory, { recursive: true, force: true });
  }
}
