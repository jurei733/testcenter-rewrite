import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { chromium } from "playwright";

const serverEntry = resolve("apps/api/dist/apps/api/src/index.js");
const sqliteFile = resolve(".data/smoke-participant-monitor-live.sqlite");

const allocatePort = () =>
  new Promise((resolvePromise, reject) => {
    const server = createNetServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not allocate a participant monitor smoke port."));
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

const removeSqliteFiles = () =>
  Promise.all(
    [sqliteFile, `${sqliteFile}-wal`, `${sqliteFile}-shm`, `${sqliteFile}-journal`].map(
      filePath => rm(filePath, { force: true })
    )
  );

const stopChild = async child => {
  if (child.exitCode != null || child.signalCode != null) {
    return;
  }
  child.kill("SIGTERM");
  await Promise.race([
    new Promise(resolvePromise => child.once("exit", resolvePromise)),
    delay(5_000).then(() => {
      if (child.exitCode == null && child.signalCode == null) {
        child.kill("SIGKILL");
      }
    })
  ]);
};

const waitUntilReady = async baseUrl => {
  const deadline = Date.now() + 15_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(`${baseUrl}/readyz`);
      if (response.ok) {
        return;
      }
      lastError = new Error(`Readiness returned HTTP ${response.status}.`);
    } catch (error) {
      lastError = error;
    }
    await delay(100);
  }
  throw lastError ?? new Error("Participant monitor smoke server did not become ready.");
};

const sendJson = async (baseUrl, path, body) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  const payload = await response.json();
  assert.equal(
    response.ok,
    true,
    `${path} returned HTTP ${response.status}: ${JSON.stringify(payload)}`
  );
  return payload;
};

await mkdir(dirname(sqliteFile), { recursive: true });
await removeSqliteFiles();
const port = await allocatePort();
const baseUrl = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, [serverEntry], {
  stdio: ["ignore", "pipe", "pipe"],
  env: {
    ...process.env,
    PORT: String(port),
    FIRST_SLICE_STORE: "sqlite",
    FIRST_SLICE_SQLITE_FILE: sqliteFile,
    FIRST_SLICE_BOOTSTRAP_DEMO: "true",
    FIRST_SLICE_OPERATOR_AUTH_REQUIRED: "false"
  }
});
let serverOutput = "";
for (const stream of [child.stdout, child.stderr]) {
  stream?.on("data", chunk => {
    serverOutput = `${serverOutput}${chunk.toString("utf8")}`.slice(-12_000);
  });
}

let browser;
try {
  await waitUntilReady(baseUrl);
  const signIn = await sendJson(baseUrl, "/api/v1/participant/auth/sign-in", {
    workspaceKey: "demo-workspace",
    loginKey: "student-demo"
  });
  const participantSessionId = signIn.participantSession?.participantSessionId;
  assert.ok(participantSessionId, "Demo sign-in must create a participant session.");
  const resumed = await sendJson(
    baseUrl,
    `/api/v1/participant/sessions/${encodeURIComponent(participantSessionId)}/resume`,
    {}
  );
  const testRunId = resumed.testRun?.testRunId;
  assert.ok(testRunId, "Demo resume must return a test run.");
  assert.equal(resumed.testRun.status, "running");

  browser = await chromium.launch({ headless: true });
  const context = await browser.newContext();
  const participantPage = await context.newPage();
  const participantStreamResponse = participantPage.waitForResponse(
    response =>
      response.url().endsWith(
        `/api/v1/participant/sessions/${participantSessionId}/events`
      ) && response.status() === 200
  );
  await participantPage.goto(
    `${baseUrl}/participant?participantSessionId=${encodeURIComponent(participantSessionId)}`,
    { waitUntil: "domcontentloaded" }
  );
  await participantPage
    .locator("#participantRouteStatus", { hasText: "running" })
    .waitFor({ timeout: 15_000 });
  await participantStreamResponse;

  const operatorPage = await context.newPage();
  await operatorPage.goto(`${baseUrl}/app/workspace`, {
    waitUntil: "networkidle"
  });
  await operatorPage.locator("#tenantKey").fill("demo-tenant");
  await operatorPage.locator("#tenantKey").dispatchEvent("change");
  await operatorPage.locator("#workspaceKey").fill("demo-workspace");
  await operatorPage.locator("#workspaceKey").dispatchEvent("change");
  await operatorPage.goto(`${baseUrl}/app/runtime`, {
    waitUntil: "domcontentloaded"
  });
  await operatorPage.locator("#testRunId").fill(testRunId);
  await operatorPage.locator("#testRunId").dispatchEvent("change");

  const pauseButton = operatorPage.getByRole("button", {
    name: "Monitor Pause",
    exact: true
  });
  await pauseButton.waitFor();
  await pauseButton.click();
  await participantPage
    .locator("#participantRouteStatus", { hasText: "paused" })
    .waitFor({ timeout: 15_000 });

  const resumeButton = operatorPage.getByRole("button", {
    name: "Monitor Resume",
    exact: true
  });
  await resumeButton.click();
  await participantPage
    .locator("#participantRouteStatus", { hasText: "running" })
    .waitFor({ timeout: 15_000 });

  process.stdout.write(
    `Participant monitor live smoke passed for run=${testRunId} at ${baseUrl}/app\n`
  );
} catch (error) {
  if (serverOutput) {
    process.stderr.write(`\nServer output tail:\n${serverOutput}\n`);
  }
  throw error;
} finally {
  await browser?.close().catch(() => undefined);
  await stopChild(child);
  await removeSqliteFiles();
}
