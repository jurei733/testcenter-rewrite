import { mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { spawn } from "node:child_process";
import { createServer as createNetServer } from "node:net";
import { setTimeout as delay } from "node:timers/promises";

const store = process.env.FIRST_SLICE_STORE ?? "memory";
const serverEntry = resolve("apps/api/dist/apps/api/src/index.js");

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

  if (expectedLocation !== null && response.headers.get("location") !== expectedLocation) {
    throw new Error(
      `Expected HEAD ${url} location ${expectedLocation} but got ${response.headers.get("location") ?? "none"}.`
    );
  }

  if ((await response.text()) !== "") {
    throw new Error(`Expected HEAD ${url} to return an empty response body.`);
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

  const stylesheetBundleResponse = await fetch(
    `${baseUrl}/app/${stylesheetBundleMatch[1]}`
  );
  if (!stylesheetBundleResponse.ok) {
    throw new Error(
      `Startup smoke expected Angular stylesheet bundle to load, got ${stylesheetBundleResponse.status}.`
    );
  }

  process.stdout.write(
    `Startup smoke passed for store=${store} schemaVersion=${manifest.storage?.schemaVersion ?? "n/a"}\n`
  );
} finally {
  await stopChild(child);
}
