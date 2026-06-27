import { spawn } from "node:child_process";
import { readFile } from "node:fs/promises";
import { setTimeout as delay } from "node:timers/promises";

const composeArgs = ["compose", "-f", "docker-compose.postgres.yml"];
const buildSha = process.env.APP_BUILD_SHA ?? "local-compose-smoke";
const buildTimestamp =
  process.env.APP_BUILD_TIMESTAMP ?? new Date().toISOString();
const operatorAuthRequired =
  process.env.FIRST_SLICE_OPERATOR_AUTH_REQUIRED ?? "true";
const bootstrapDemo = process.env.FIRST_SLICE_BOOTSTRAP_DEMO ?? "false";

const run = (command, args, options = {}) =>
  new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      stdio: "inherit",
      env: options.env ?? process.env
    });
    child.once("error", reject);
    child.once("exit", code => {
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
  const match = /POSTGRES_FIRST_SLICE_SCHEMA_VERSION\s*=\s*(\d+)/.exec(source);
  if (!match) {
    throw new Error("Could not resolve expected Postgres schema version.");
  }
  return Number.parseInt(match[1], 10);
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

const parseBooleanFlag = value => {
  const normalizedValue = value.trim().toLowerCase();
  if (["1", "true", "yes", "on", "required"].includes(normalizedValue)) {
    return true;
  }
  if (["0", "false", "no", "off", "optional"].includes(normalizedValue)) {
    return false;
  }
  throw new Error(
    `FIRST_SLICE_OPERATOR_AUTH_REQUIRED must be a boolean-like flag, got '${value}'.`
  );
};

const dumpComposeLogs = async () => {
  await run("docker", [...composeArgs, "logs"]).catch(() => undefined);
};

try {
  const expectedSchemaVersion = await readExpectedPostgresSchemaVersion();

  await run("docker", [
    ...composeArgs,
    "up",
    "-d",
    "--build"
  ], {
    env: {
      ...process.env,
      APP_BUILD_SHA: buildSha,
      APP_BUILD_TIMESTAMP: buildTimestamp,
      FIRST_SLICE_OPERATOR_AUTH_REQUIRED: operatorAuthRequired,
      FIRST_SLICE_BOOTSTRAP_DEMO: bootstrapDemo
    }
  });

  const readiness = await pollJson("http://127.0.0.1:4310/readyz");
  const manifest = await pollJson("http://127.0.0.1:4310/manifest");
  const config = await pollJson("http://127.0.0.1:4310/diagnostics/config");
  const apiContainerId = await capture("docker", [
    ...composeArgs,
    "ps",
    "-q",
    "rewrite-app-api"
  ]);
  if (!apiContainerId) {
    throw new Error("Could not resolve rewrite-app-api container id.");
  }
  const apiContainerUser = await capture("docker", [
    "inspect",
    apiContainerId,
    "--format",
    "{{.Config.User}}"
  ]);

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
  expectEqual(
    "runtimeConfig.operatorAuthRequired",
    config.runtimeConfig?.operatorAuthRequired,
    parseBooleanFlag(operatorAuthRequired)
  );
  expectEqual(
    "runtimeConfig.environment.firstSlicePostgresUrlPresent",
    config.runtimeConfig?.environment?.firstSlicePostgresUrlPresent,
    true
  );
  expectEqual(
    "runtimeConfig.environment.firstSliceBootstrapDemo",
    config.runtimeConfig?.environment?.firstSliceBootstrapDemo,
    parseBooleanFlag(bootstrapDemo)
  );
  expectEqual("apiContainer.user", apiContainerUser, "node");

  process.stdout.write(
    `Compose Postgres smoke passed for build ${buildSha} schema=${expectedSchemaVersion} operatorAuthRequired=${operatorAuthRequired} bootstrapDemo=${bootstrapDemo}\n`
  );
} catch (error) {
  await dumpComposeLogs();
  throw error;
} finally {
  await run("docker", [...composeArgs, "down", "-v"]).catch(() => undefined);
}
