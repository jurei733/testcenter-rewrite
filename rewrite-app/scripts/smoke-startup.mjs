import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { createServer as createNetServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";

const store = process.env.FIRST_SLICE_STORE ?? "memory";
const serverEntry = resolve("apps/api/dist/apps/api/src/index.js");

const parseBooleanFlag = value => {
  const normalizedValue = String(value ?? "")
    .trim()
    .toLowerCase();
  if (["1", "true", "yes", "on", "required"].includes(normalizedValue)) {
    return true;
  }
  if (["0", "false", "no", "off", "optional", ""].includes(normalizedValue)) {
    return false;
  }
  throw new Error(`Unsupported boolean flag '${value}'.`);
};

const allocatePort = () =>
  new Promise((resolvePromise, reject) => {
    const server = createNetServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not allocate a startup smoke port."));
        return;
      }
      server.close(error => {
        if (error) {
          reject(error);
          return;
        }
        resolvePromise(address.port);
      });
    });
  });

const ensureDataDirectory = async () => {
  if (store === "file") {
    const filePath = resolve(
      process.env.FIRST_SLICE_FILE ?? "./.data/smoke-startup.json"
    );
    process.env.FIRST_SLICE_FILE = filePath;
    await mkdir(dirname(filePath), { recursive: true });
    return;
  }

  if (store === "sqlite") {
    const filePath = resolve(
      process.env.FIRST_SLICE_SQLITE_FILE ?? "./.data/smoke-startup.sqlite"
    );
    process.env.FIRST_SLICE_SQLITE_FILE = filePath;
    await mkdir(dirname(filePath), { recursive: true });
  }
};

const pollJson = async url => {
  const deadline = Date.now() + 15_000;
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
      await delay(250);
    }
  }

  throw lastError ?? new Error(`Timed out waiting for ${url}`);
};

const expectHead = async (url, expectedStatus = 200, expectedLocation = null) => {
  const response = await fetch(url, {
    method: "HEAD",
    redirect: "manual"
  });
  if (response.status !== expectedStatus) {
    throw new Error(
      `Expected HEAD ${url} to return ${expectedStatus} but got ${response.status}.`
    );
  }

  expectSecurityHeaders(`HEAD ${url}`, response);

  if (expectedLocation !== null && response.headers.get("location") !== expectedLocation) {
    throw new Error(
      `Expected HEAD ${url} location ${expectedLocation} but got ${response.headers.get("location") ?? "none"}.`
    );
  }

  if ((await response.text()) !== "") {
    throw new Error(`Expected HEAD ${url} to return an empty response body.`);
  }
};

const expectSecurityHeaders = (label, response) => {
  for (const [header, expectedValue] of [
    ["x-content-type-options", "nosniff"],
    ["referrer-policy", "no-referrer"],
    ["x-frame-options", "SAMEORIGIN"],
    ["permissions-policy", "camera=(), geolocation=(), microphone=()"]
  ]) {
    const actualValue = response.headers.get(header);
    if (actualValue !== expectedValue) {
      throw new Error(
        `Expected ${label} header ${header}=${expectedValue} but got ${actualValue ?? "missing"}.`
      );
    }
  }
};

const expectBuildMetadata = (label, build) => {
  if (process.env.APP_BUILD_SHA && build?.commitSha !== process.env.APP_BUILD_SHA) {
    throw new Error(
      `Expected ${label}.commitSha=${process.env.APP_BUILD_SHA} but got ${build?.commitSha ?? "missing"}.`
    );
  }

  if (
    process.env.APP_BUILD_TIMESTAMP &&
    build?.builtAt !== process.env.APP_BUILD_TIMESTAMP
  ) {
    throw new Error(
      `Expected ${label}.builtAt=${process.env.APP_BUILD_TIMESTAMP} but got ${build?.builtAt ?? "missing"}.`
    );
  }
};

const expectRedactedPostgresLocation = (label, location) => {
  if (store !== "postgres") {
    return;
  }

  if (typeof location !== "string" || !/^postgres(?:ql)?:\/\//.test(location)) {
    throw new Error(`Expected ${label} to expose a redacted Postgres URL.`);
  }

  const source = process.env.FIRST_SLICE_POSTGRES_URL;
  if (!source) {
    return;
  }

  const sourceUrl = new URL(source);

  const redactedUrl = new URL(location);
  if (sourceUrl.username && redactedUrl.username !== "REDACTED") {
    throw new Error(`Expected ${label} to redact Postgres username.`);
  }
  if (sourceUrl.password && redactedUrl.password !== "REDACTED") {
    throw new Error(`Expected ${label} to redact Postgres password.`);
  }
};

const stopChild = child =>
  new Promise(async (resolvePromise, reject) => {
    if (child.exitCode !== null) {
      resolvePromise(undefined);
      return;
    }
    let settled = false;
    const finish = () => {
      if (!settled) {
        settled = true;
        resolvePromise(undefined);
      }
    };
    child.once("exit", finish);
    child.once("error", reject);
    child.kill("SIGTERM");
    await delay(2_000);
    if (child.exitCode === null) {
      child.kill("SIGKILL");
    }
  });

await ensureDataDirectory();
const port = process.env.FIRST_SLICE_STARTUP_PORT
  ? Number.parseInt(process.env.FIRST_SLICE_STARTUP_PORT, 10)
  : await allocatePort();

const child = spawn(process.execPath, [serverEntry], {
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: String(port),
    FIRST_SLICE_STORE: store
  }
});

try {
  const baseUrl = `http://127.0.0.1:${port}`;
  const health = await pollJson(`${baseUrl}/healthz`);
  const readiness = await pollJson(`${baseUrl}/readyz`);
  const manifest = await pollJson(`${baseUrl}/manifest`);
  const config = await pollJson(`${baseUrl}/diagnostics/config`);
  const metrics = await pollJson(`${baseUrl}/metrics`);
  const prometheusResponse = await fetch(`${baseUrl}/metrics/prometheus`);
  expectSecurityHeaders(`${baseUrl}/metrics/prometheus`, prometheusResponse);

  await expectHead(`${baseUrl}/healthz`);
  await expectHead(`${baseUrl}/readyz`);
  await expectHead(`${baseUrl}/app`);
  await expectHead(
    `${baseUrl}/participant?workspaceKey=demo-workspace`,
    302,
    "/app/participant?workspaceKey=demo-workspace"
  );

  const appHtml = await fetch(`${baseUrl}/app`).then(async response => {
    if (!response.ok) {
      throw new Error(`Unexpected status ${response.status} for /app.`);
    }
    expectSecurityHeaders(`${baseUrl}/app`, response);
    return response.text();
  });

  if (health.status !== "ok") {
    throw new Error(`Startup smoke failed health check for store=${store}.`);
  }

  if (readiness.status !== "ready") {
    throw new Error(`Startup smoke failed readiness check for store=${store}.`);
  }

  if (manifest.storage?.kind !== store) {
    throw new Error(
      `Expected manifest storage.kind=${store} but got ${manifest.storage?.kind ?? "unknown"}.`
    );
  }

  if (config.runtimeConfig?.storage?.kind !== store) {
    throw new Error(
      `Expected runtime config storage.kind=${store} but got ${config.runtimeConfig?.storage?.kind ?? "unknown"}.`
    );
  }

  expectBuildMetadata("manifest.build", manifest.build);
  expectBuildMetadata("runtimeConfig.build", config.build);
  expectBuildMetadata("metrics.build", metrics.build);

  expectRedactedPostgresLocation("manifest.storage.location", manifest.storage?.location);
  expectRedactedPostgresLocation(
    "runtimeConfig.storage.location",
    config.runtimeConfig?.storage?.location
  );

  if (metrics.storage?.kind !== store) {
    throw new Error(
      `Expected metrics storage.kind=${store} but got ${metrics.storage?.kind ?? "unknown"}.`
    );
  }

  if (metrics.storage?.schemaVersion !== manifest.storage?.schemaVersion) {
    throw new Error(
      `Expected metrics schemaVersion to match manifest schemaVersion ${manifest.storage?.schemaVersion ?? "unknown"}.`
    );
  }

  if (typeof metrics.runtime?.completedRequests !== "number") {
    throw new Error("Startup smoke expected runtime metrics completedRequests.");
  }

  if (!prometheusResponse.ok) {
    throw new Error(
      `Startup smoke expected Prometheus metrics to load, got ${prometheusResponse.status}.`
    );
  }

  const prometheusBody = await prometheusResponse.text();
  if (!prometheusBody.includes("rewrite_app_build_info{")) {
    throw new Error("Startup smoke expected Prometheus build info.");
  }

  if (
    process.env.APP_BUILD_SHA &&
    !prometheusBody.includes(`build_sha="${process.env.APP_BUILD_SHA}"`)
  ) {
    throw new Error("Startup smoke expected Prometheus build_sha label.");
  }

  if (
    process.env.APP_BUILD_TIMESTAMP &&
    !prometheusBody.includes(
      `build_timestamp="${process.env.APP_BUILD_TIMESTAMP}"`
    )
  ) {
    throw new Error("Startup smoke expected Prometheus build_timestamp label.");
  }

  const expectedOperatorAuthRequired = parseBooleanFlag(
    process.env.FIRST_SLICE_OPERATOR_AUTH_REQUIRED
  );
  if (config.runtimeConfig?.operatorAuthRequired !== expectedOperatorAuthRequired) {
    throw new Error(
      `Expected runtime config operatorAuthRequired=${expectedOperatorAuthRequired} but got ${config.runtimeConfig?.operatorAuthRequired ?? "missing"}.`
    );
  }

  if (
    config.runtimeConfig?.environment?.firstSliceOperatorAuthRequired !==
    expectedOperatorAuthRequired
  ) {
    throw new Error(
      "Expected runtime config environment to mirror FIRST_SLICE_OPERATOR_AUTH_REQUIRED."
    );
  }

  for (const [label, value] of [
    ["maxJsonBodyBytes", config.runtimeConfig?.maxJsonBodyBytes],
    ["headersTimeoutMs", config.runtimeConfig?.httpTimeouts?.headersTimeoutMs],
    ["requestTimeoutMs", config.runtimeConfig?.httpTimeouts?.requestTimeoutMs],
    ["keepAliveTimeoutMs", config.runtimeConfig?.httpTimeouts?.keepAliveTimeoutMs]
  ]) {
    if (typeof value !== "number" || value < 1) {
      throw new Error(`Startup smoke expected runtime config ${label} to be positive.`);
    }
  }

  for (const marker of [
    "<app-root></app-root>",
    '<base href="/app/">',
    "<title>Testcenter Rewrite App</title>"
  ]) {
    if (!appHtml.includes(marker)) {
      throw new Error(`Startup smoke expected /app to include marker ${marker}.`);
    }
  }

  const mainBundleMatch = appHtml.match(
    /<script src="([^"]*main[^"]*\.js)" type="module"><\/script>/
  );
  if (!mainBundleMatch) {
    throw new Error("Startup smoke expected /app to reference an Angular main bundle.");
  }

  const stylesheetBundleMatch = appHtml.match(
    /<link rel="stylesheet" href="([^"]*styles[^"]*\.css)"/
  );
  if (!stylesheetBundleMatch) {
    throw new Error(
      "Startup smoke expected /app to reference an Angular stylesheet bundle."
    );
  }

  const mainBundleResponse = await fetch(
    `${baseUrl}/app/${mainBundleMatch[1]}`
  );
  if (!mainBundleResponse.ok) {
    throw new Error(
      `Startup smoke expected Angular main bundle to load, got ${mainBundleResponse.status}.`
    );
  }
  expectSecurityHeaders("Angular main bundle", mainBundleResponse);

  const stylesheetBundleResponse = await fetch(
    `${baseUrl}/app/${stylesheetBundleMatch[1]}`
  );
  if (!stylesheetBundleResponse.ok) {
    throw new Error(
      `Startup smoke expected Angular stylesheet bundle to load, got ${stylesheetBundleResponse.status}.`
    );
  }
  expectSecurityHeaders("Angular stylesheet bundle", stylesheetBundleResponse);

  process.stdout.write(
    `Startup smoke passed for store=${store} schemaVersion=${manifest.storage?.schemaVersion ?? "n/a"}\n`
  );
} finally {
  await stopChild(child);
}
