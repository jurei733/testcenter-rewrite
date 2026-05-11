import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

const composeArgs = ["compose", "-f", "docker-compose.postgres.yml"];
const buildSha = process.env.APP_BUILD_SHA ?? "local-compose-smoke";
const buildTimestamp =
  process.env.APP_BUILD_TIMESTAMP ?? new Date().toISOString();

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

try {
  await run("docker", [
    ...composeArgs,
    "up",
    "-d",
    "--build"
  ], {
    env: {
      ...process.env,
      APP_BUILD_SHA: buildSha,
      APP_BUILD_TIMESTAMP: buildTimestamp
    }
  });

  const readiness = await pollJson("http://127.0.0.1:4310/readyz");
  const manifest = await pollJson("http://127.0.0.1:4310/manifest");

  if (readiness.storage?.kind !== "postgres") {
    throw new Error(
      `Expected readiness storage.kind=postgres but got ${readiness.storage?.kind ?? "unknown"}.`
    );
  }

  if (manifest.build?.commitSha !== buildSha) {
    throw new Error(
      `Expected manifest build.commitSha=${buildSha} but got ${manifest.build?.commitSha ?? "unknown"}.`
    );
  }

  process.stdout.write(
    `Compose Postgres smoke passed for build ${buildSha} at ${buildTimestamp}\n`
  );
} finally {
  await run("docker", [...composeArgs, "down", "-v"]).catch(() => undefined);
}
