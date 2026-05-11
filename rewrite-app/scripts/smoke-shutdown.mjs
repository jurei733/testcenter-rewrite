import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { createServer as createNetServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";

const store = process.env.FIRST_SLICE_STORE ?? "sqlite";
const serverEntry = resolve("apps/api/dist/apps/api/src/index.js");
const shutdownDrainDelayMs = Number.parseInt(
  process.env.SHUTDOWN_DRAIN_DELAY_MS ?? "2000",
  10
);

const allocatePort = () =>
  new Promise((resolvePromise, reject) => {
    const server = createNetServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not allocate a shutdown smoke port."));
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
      process.env.FIRST_SLICE_FILE ?? "./.data/smoke-shutdown.json"
    );
    process.env.FIRST_SLICE_FILE = filePath;
    await mkdir(dirname(filePath), { recursive: true });
    return;
  }

  if (store === "sqlite") {
    const filePath = resolve(
      process.env.FIRST_SLICE_SQLITE_FILE ?? "./.data/smoke-shutdown.sqlite"
    );
    process.env.FIRST_SLICE_SQLITE_FILE = filePath;
    await mkdir(dirname(filePath), { recursive: true });
  }
};

const pollJson = async (url, expectedStatus = 200, timeoutMs = 15_000) => {
  const deadline = Date.now() + timeoutMs;
  let lastError = null;

  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      if (response.status !== expectedStatus) {
        throw new Error(`Unexpected status ${response.status} for ${url}`);
      }
      return await response.json();
    } catch (error) {
      lastError = error;
      await delay(200);
    }
  }

  throw lastError ?? new Error(`Timed out waiting for ${url}`);
};

const waitForExit = child =>
  new Promise((resolvePromise, reject) => {
    if (child.exitCode !== null) {
      resolvePromise(child.exitCode);
      return;
    }
    child.once("error", reject);
    child.once("exit", code => resolvePromise(code ?? 0));
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
    FIRST_SLICE_STORE: store,
    SHUTDOWN_DRAIN_DELAY_MS: String(shutdownDrainDelayMs)
  }
});

try {
  await pollJson(`http://127.0.0.1:${port}/readyz`);
  child.kill("SIGTERM");

  const draining = await pollJson(
    `http://127.0.0.1:${port}/readyz`,
    503,
    Math.max(5_000, shutdownDrainDelayMs + 2_000)
  );

  if (draining.error !== "service_draining") {
    throw new Error(
      `Expected service_draining during shutdown smoke but got ${draining.error ?? "unknown"}.`
    );
  }

  if (draining.details?.shutdownRequestedAt == null) {
    throw new Error("Expected shutdownRequestedAt details during shutdown smoke.");
  }

  const exitCode = await waitForExit(child);
  if (exitCode !== 0) {
    throw new Error(`Expected clean shutdown with exit code 0 but got ${exitCode}.`);
  }

  process.stdout.write(
    `Shutdown smoke passed for store=${store} drainDelayMs=${shutdownDrainDelayMs}\n`
  );
} finally {
  if (child.exitCode === null) {
    child.kill("SIGKILL");
  }
}
