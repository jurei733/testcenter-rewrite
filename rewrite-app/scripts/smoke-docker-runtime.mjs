import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

const imageTag = process.env.DOCKER_IMAGE_TAG ?? "testcenter-rewrite-app:smoke";
const containerName =
  process.env.DOCKER_SMOKE_CONTAINER_NAME ??
  `rewrite-app-docker-smoke-${process.pid}`;
const buildSha = process.env.APP_BUILD_SHA ?? "local-docker";
const buildTimestamp = process.env.APP_BUILD_TIMESTAMP ?? "unknown";

const run = (command, args, options = {}) =>
  new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      stdio: options.capture ? ["ignore", "pipe", "pipe"] : "inherit",
      env: options.env ?? process.env
    });
    let stdout = "";
    let stderr = "";
    if (options.capture) {
      child.stdout.setEncoding("utf8");
      child.stderr.setEncoding("utf8");
      child.stdout.on("data", chunk => {
        stdout += chunk;
      });
      child.stderr.on("data", chunk => {
        stderr += chunk;
      });
    }
    child.once("error", reject);
    child.once("exit", code => {
      if (code === 0) {
        resolvePromise(options.capture ? stdout.trim() : undefined);
        return;
      }
      reject(
        new Error(
          `${command} ${args.join(" ")} exited with code ${code ?? 1}${
            stderr ? `:\n${stderr}` : ""
          }`
        )
      );
    });
  });

const findOpenPort = () =>
  new Promise((resolvePromise, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => {
        if (!address || typeof address === "string") {
          reject(new Error("Could not resolve an open TCP port."));
          return;
        }
        resolvePromise(address.port);
      });
    });
  });

const readExpectedSqliteSchemaVersion = async () => {
  const source = await readFile(
    new URL("../packages/sqlite-store/src/index.ts", import.meta.url),
    "utf8"
  );
  const match = /SQLITE_FIRST_SLICE_SCHEMA_VERSION\s*=\s*(\d+)/.exec(source);
  if (!match) {
    throw new Error("Could not resolve expected SQLite schema version.");
  }
  return Number.parseInt(match[1], 10);
};

const pollJson = async url => {
  const deadline = Date.now() + 45_000;
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

const fetchText = async url => {
  const response = await fetch(url);
  const body = await response.text();
  if (!response.ok) {
    throw new Error(`Unexpected status ${response.status} for ${url}: ${body}`);
  }
  return { response, body };
};

const expectEqual = (label, actual, expected) => {
  if (actual !== expected) {
    throw new Error(
      `Expected ${label}=${expected} but got ${actual ?? "unknown"}.`
    );
  }
};

const expectHeader = (response, headerName, expectedValue) => {
  const actualValue = response.headers.get(headerName);
  if (actualValue !== expectedValue) {
    throw new Error(
      `Expected ${headerName}=${expectedValue} but got ${actualValue ?? "missing"}.`
    );
  }
};

const dumpContainerLogs = async () => {
  await run("docker", ["logs", containerName]).catch(() => undefined);
};

const removeContainer = async () => {
  await run("docker", ["rm", "-f", containerName], { capture: true }).catch(
    () => undefined
  );
};

const expectedSchemaVersion = await readExpectedSqliteSchemaVersion();
const hostPort = await findOpenPort();
const baseUrl = `http://127.0.0.1:${hostPort}`;

try {
  await removeContainer();
  process.stdout.write(
    `Starting Docker runtime smoke image=${imageTag} port=${hostPort} container=${containerName}\n`
  );
  await run("docker", [
    "run",
    "-d",
    "--name",
    containerName,
    "-p",
    `127.0.0.1:${hostPort}:4310`,
    "-e",
    "PORT=4310",
    "-e",
    "FIRST_SLICE_STORE=sqlite",
    "-e",
    "FIRST_SLICE_SQLITE_FILE=/tmp/rewrite-app-smoke.sqlite",
    "-e",
    "FIRST_SLICE_OPERATOR_AUTH_REQUIRED=true",
    "-e",
    "FIRST_SLICE_BOOTSTRAP_DEMO=true",
    "-e",
    `APP_BUILD_SHA=${buildSha}`,
    "-e",
    `APP_BUILD_TIMESTAMP=${buildTimestamp}`,
    imageTag,
    "sh",
    "-c",
    "npm run db:migrate:sqlite:built && node apps/api/dist/apps/api/src/index.js"
  ], { capture: true });

  const readiness = await pollJson(`${baseUrl}/readyz`);
  const manifest = await pollJson(`${baseUrl}/manifest`);
  const { response: appResponse, body: appHtml } = await fetchText(
    `${baseUrl}/app`
  );
  const apiContainerUser = await run(
    "docker",
    ["inspect", containerName, "--format", "{{.Config.User}}"],
    { capture: true }
  );

  expectEqual("readiness.status", readiness.status, "ready");
  expectEqual("readiness.storage.kind", readiness.storage?.kind, "sqlite");
  expectEqual(
    "readiness.storage.schemaVersion",
    readiness.storage?.schemaVersion,
    expectedSchemaVersion
  );
  expectEqual("manifest.phase", manifest.phase, "production-baseline");
  expectEqual("manifest.storage.kind", manifest.storage?.kind, "sqlite");
  expectEqual(
    "manifest.storage.schemaVersion",
    manifest.storage?.schemaVersion,
    expectedSchemaVersion
  );
  expectEqual("manifest.build.commitSha", manifest.build?.commitSha, buildSha);
  expectEqual("manifest.build.builtAt", manifest.build?.builtAt, buildTimestamp);
  expectEqual("apiContainer.user", apiContainerUser, "node");

  const contentType = appResponse.headers.get("content-type") ?? "";
  if (!contentType.includes("text/html")) {
    throw new Error(`Expected /app to serve HTML but got '${contentType}'.`);
  }
  expectHeader(appResponse, "x-content-type-options", "nosniff");
  expectHeader(appResponse, "referrer-policy", "no-referrer");
  expectHeader(appResponse, "x-frame-options", "SAMEORIGIN");
  expectHeader(
    appResponse,
    "permissions-policy",
    "camera=(), geolocation=(), microphone=()"
  );
  if (!appHtml.includes("<app-root></app-root>")) {
    throw new Error("Expected /app HTML to contain the Angular root marker.");
  }

  process.stdout.write(
    `Docker runtime smoke passed for build ${buildSha} schema=${expectedSchemaVersion}\n`
  );
} catch (error) {
  await dumpContainerLogs();
  throw error;
} finally {
  await removeContainer();
}
