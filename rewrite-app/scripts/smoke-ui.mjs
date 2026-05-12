import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, rm } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { chromium } from "playwright";

const store = process.env.FIRST_SLICE_STORE ?? "sqlite";
const serverEntry = resolve("apps/api/dist/apps/api/src/index.js");
const failedImportSourceDocument = '{"booklets":[]}';
const repairedImportSourceDocument =
  '<assessment><booklet key="booklet:recovered" label="Recovered"><unit key="unit-recovered" label="Recovered Unit" /></booklet></assessment>';

const allocatePort = () =>
  new Promise((resolvePromise, reject) => {
    const server = createNetServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not allocate a UI smoke port."));
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
    const filePath = resolve(process.env.FIRST_SLICE_FILE ?? "./.data/ui-smoke.json");
    process.env.FIRST_SLICE_FILE = filePath;
    await mkdir(dirname(filePath), { recursive: true });
    await rm(filePath, { force: true });
    return;
  }

  if (store === "sqlite") {
    const filePath = resolve(
      process.env.FIRST_SLICE_SQLITE_FILE ?? "./.data/ui-smoke.sqlite"
    );
    process.env.FIRST_SLICE_SQLITE_FILE = filePath;
    await mkdir(dirname(filePath), { recursive: true });
    await rm(filePath, { force: true });
  }
};

const pollJson = async url => {
  const deadline = Date.now() + 20_000;
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

const pollJsonWithPredicate = async (url, predicate, timeoutMs = 20_000) => {
  const deadline = Date.now() + timeoutMs;
  let lastPayload = null;

  while (Date.now() < deadline) {
    const response = await fetch(url);
    if (response.ok) {
      const payload = await response.json();
      lastPayload = payload;
      if (predicate(payload)) {
        return payload;
      }
    }
    await delay(250);
  }

  throw new Error(
    `Timed out waiting for predicate on ${url}. Last payload: ${JSON.stringify(lastPayload)}`
  );
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

const port = process.env.FIRST_SLICE_UI_PORT
  ? Number.parseInt(process.env.FIRST_SLICE_UI_PORT, 10)
  : await allocatePort();

const child = spawn(process.execPath, [serverEntry], {
  stdio: "inherit",
  env: {
    ...process.env,
    PORT: String(port),
    FIRST_SLICE_STORE: store
  }
});

let browser;

try {
  await pollJson(`http://127.0.0.1:${port}/readyz`);

  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const baseUrl = `http://127.0.0.1:${port}`;
  const tenantKey = `ui-tenant-${Date.now()}`;
  const workspaceKey = `ui-workspace-${Date.now()}`;
  const logStep = step => {
    process.stdout.write(`ui_smoke_step=${step}\n`);
  };
  const waitForBusy = async stepLabel => {
    try {
      await page.waitForFunction(
        () => {
          const root = document.querySelector(".page");
          return root != null && root.classList.contains("is-busy");
        },
        { timeout: 5_000 }
      );
      return true;
    } catch {
      const statusBanner = await page
        .locator(".status-banner")
        .textContent()
        .catch(() => null);
      process.stdout.write(
        `ui_smoke_busy_start_timeout step=${stepLabel} banner=${statusBanner ?? "n/a"}\n`
      );
      return false;
    }
  };
  const waitForNotBusy = async stepLabel => {
    try {
      await page.waitForFunction(
        () => {
          const root = document.querySelector(".page");
          return root != null && !root.classList.contains("is-busy");
        },
        { timeout: 15_000 }
      );
      return true;
    } catch {
      const statusBanner = await page
        .locator(".status-banner")
        .textContent()
        .catch(() => null);
      process.stdout.write(
        `ui_smoke_busy_timeout step=${stepLabel} banner=${statusBanner ?? "n/a"}\n`
      );
      return false;
    }
  };
  const clickAction = async name => {
    await waitForNotBusy(`${name}-before-click`);
    await page.getByRole("button", { name }).click({ force: true });
    const startedBusy = await waitForBusy(`${name}-after-click`);
    if (!startedBusy) {
      await page.waitForTimeout(150);
    }
    await waitForNotBusy(`${name}-after-click`);
  };
  await page.goto(`${baseUrl}/app`, { waitUntil: "networkidle" });
  await page.waitForURL(/\/app\/workspace$/);
  await page.waitForSelector("h1");
  await waitForNotBusy("initial-load");
  if (await page.locator("#autoRefreshEnabled").isChecked()) {
    logStep("disable-auto-refresh");
    await page.locator("#autoRefreshEnabled").uncheck();
    await page.waitForTimeout(150);
  }

  logStep("fill-workspace-scope");
  await page.locator("#tenantKey").fill(tenantKey);
  await page.locator("#workspaceKey").fill(workspaceKey);
  logStep("bootstrap-workspace-flow");
  await clickAction("Create Tenant");
  await clickAction("Create Workspace");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      typeof payload.workspaceOverview === "object" &&
      payload.workspaceOverview != null &&
      typeof payload.workspaceOverview.workspace === "object" &&
      payload.workspaceOverview.workspace != null &&
      payload.workspaceOverview.workspace.workspaceKey === workspaceKey
  );

  await page.getByRole("link", { name: "Content" }).click();
  await page.waitForURL(/\/app\/content$/);
  await page.locator("#sourceFileName").waitFor();
  logStep("import-and-activate-flow");
  await clickAction("Create Source Package");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.length > 0
  );
  await clickAction("Create Import Job");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.some(item => item?.contentRelease?.status === "staged")
  );
  await clickAction("Activate Release");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.some(item => item?.contentRelease?.status === "active")
  );

  await page.getByRole("link", { name: "Runtime" }).click();
  await page.waitForURL(/\/app\/runtime$/);
  await page.locator("#loginKey").waitFor();
  await waitForNotBusy("runtime-before-sign-in");
  logStep("participant-sign-in");
  const participantLoginKey = "student-ui";
  await page.locator("#loginKey").fill(participantLoginKey);
  await clickAction("Sign In");
  const participantSessionsUrl = `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-sessions`;
  const hasParticipantSession = payload =>
    typeof payload === "object" &&
    payload != null &&
    Array.isArray(payload.items) &&
    payload.items.some(item => {
      const participantSession = item?.participantSession;
      return (
        participantSession?.loginKey === participantLoginKey &&
        typeof participantSession?.participantSessionId === "string" &&
        participantSession.participantSessionId.length > 0
      );
    });
  let participantSessionsPayload;
  try {
    participantSessionsPayload = await pollJsonWithPredicate(
      participantSessionsUrl,
      hasParticipantSession,
      4_000
    );
  } catch {
    process.stdout.write("ui_smoke_step=participant-sign-in-retry\n");
    await clickAction("Sign In");
    participantSessionsPayload = await pollJsonWithPredicate(
      participantSessionsUrl,
      hasParticipantSession
    );
  }
  const participantSessionId = participantSessionsPayload.items.find(item => {
    const participantSession = item?.participantSession;
    return participantSession?.loginKey === participantLoginKey;
  })?.participantSession?.participantSessionId;
  assert.ok(
    participantSessionId,
    "UI smoke expected participantSessionId to be populated after the runtime happy path."
  );
  await page.locator("#participantSessionId").fill(participantSessionId);
  await waitForNotBusy("runtime-before-resume");
  logStep("resume-session");
  await clickAction("Resume Session");
  const pausedCurrentState = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${participantSessionId}/current-state`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      "currentRunState" in payload &&
      typeof payload.currentRunState === "object" &&
      payload.currentRunState != null &&
      "currentUnit" in payload.currentRunState &&
      payload.currentRunState.currentUnit?.unitKey != null
  );
  await page.locator("#currentUnitKey").fill("unit-paused");
  await clickAction("Save Paused");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${participantSessionId}/current-state`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      "currentRunState" in payload &&
      typeof payload.currentRunState === "object" &&
      payload.currentRunState != null &&
      typeof payload.currentRunState.testRun === "object" &&
      payload.currentRunState.testRun != null &&
      payload.currentRunState.testRun.status === "paused" &&
      payload.currentRunState.testRun.currentUnitKey === "unit-paused"
  );
  const pausedTestRunId = pausedCurrentState.currentRunState.testRun.testRunId;
  assert.ok(pausedTestRunId, "UI smoke expected a paused testRunId before resuming.");
  await page.locator("#testRunId").fill(pausedTestRunId);
  logStep("resume-run");
  await clickAction("Resume Run");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${participantSessionId}/current-state`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      "currentRunState" in payload &&
      typeof payload.currentRunState === "object" &&
      payload.currentRunState != null &&
      typeof payload.currentRunState.testRun === "object" &&
      payload.currentRunState.testRun != null &&
      payload.currentRunState.testRun.status === "running"
  );
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/monitor/open-runs`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.length > 0
  );

  await page.getByRole("link", { name: "Content" }).click();
  await page.waitForURL(/\/app\/content$/);
  logStep("blocked-activation-flow");
  await page.locator("#sourceFileName").fill("blocked-activation.xml");
  await page.locator("#sourceMediaType").fill("application/xml");
  await page.locator("#sourceDocument").fill(repairedImportSourceDocument);
  await clickAction("Create Source Package");
  await clickAction("Create Import Job");
  await clickAction("Activate Release");
  await page.waitForTimeout(250);
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.some(item => item?.contentRelease?.status === "staged")
  );

  await page.locator("#sourceFileName").waitFor();
  await page.locator("#sourceFileName").fill("broken.json");
  await page.locator("#sourceMediaType").fill("application/json");
  await page.locator("#sourceDocument").fill(failedImportSourceDocument);
  await clickAction("Create Source Package");

  const failedSourcePackagesPayload = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.some(
        item => item?.sourcePackage?.fileName === "broken.json"
      )
  );
  const failedSourcePackageId = failedSourcePackagesPayload.items.find(
    item => item?.sourcePackage?.fileName === "broken.json"
  )?.sourcePackage?.sourcePackageId;
  assert.ok(
    failedSourcePackageId,
    "UI smoke expected a source package id for the failed import scenario."
  );

  await page.locator("#sourcePackageId").fill(failedSourcePackageId);
  logStep("create-failed-import-job");
  await clickAction("Create Import Job");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages/${failedSourcePackageId}`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      "sourcePackageDetail" in payload &&
      typeof payload.sourcePackageDetail === "object" &&
      payload.sourcePackageDetail != null &&
      Array.isArray(payload.sourcePackageDetail.importJobs) &&
      payload.sourcePackageDetail.importJobs.some(
        importJob =>
          importJob?.status === "failed" &&
          Array.isArray(importJob?.diagnostics) &&
          importJob.diagnostics.some(
            diagnostic =>
              diagnostic?.code === "source_document_runtime_structure_invalid"
          )
      )
  );

  await page.locator("#sourceFileName").fill("fixed.xml");
  await page.locator("#sourceMediaType").fill("application/xml");
  await page.locator("#sourceDocument").fill(repairedImportSourceDocument);
  logStep("retry-failed-import");
  await clickAction("Retry Failed Import");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages/${failedSourcePackageId}`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      "sourcePackageDetail" in payload &&
      typeof payload.sourcePackageDetail === "object" &&
      payload.sourcePackageDetail != null &&
      Array.isArray(payload.sourcePackageDetail.importJobs) &&
      Array.isArray(payload.sourcePackageDetail.contentReleases) &&
      payload.sourcePackageDetail.importJobs.some(
        importJob => importJob?.status === "failed"
      ) &&
      payload.sourcePackageDetail.importJobs.some(
        importJob => importJob?.status === "completed"
      ) &&
      payload.sourcePackageDetail.contentReleases.length > 0
  );

  await page.getByRole("link", { name: "Runtime" }).click();
  await page.waitForURL(/\/app\/runtime$/);
  await waitForNotBusy("runtime-before-complete");
  logStep("refresh-runtime-before-complete");
  await clickAction("Refresh Runtime Reads");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${participantSessionId}/current-state`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      "currentRunState" in payload &&
      typeof payload.currentRunState === "object" &&
      payload.currentRunState != null &&
      typeof payload.currentRunState.testRun === "object" &&
      payload.currentRunState.testRun != null &&
      payload.currentRunState.testRun.testRunId === pausedTestRunId &&
      payload.currentRunState.testRun.status === "running"
  );
  await page.locator("#testRunId").fill(pausedTestRunId);
  logStep("complete-run");
  await clickAction("Complete Run");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${participantSessionId}/current-state`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      "currentRunState" in payload &&
      typeof payload.currentRunState === "object" &&
      payload.currentRunState != null &&
      typeof payload.currentRunState.testRun === "object" &&
      payload.currentRunState.testRun != null &&
      payload.currentRunState.testRun.status === "completed"
  );
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${participantSessionId}/runtime-state`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      "runtimeState" in payload &&
      typeof payload.runtimeState === "object" &&
      payload.runtimeState != null &&
      payload.runtimeState.runtimeStatus === "completed" &&
      payload.runtimeState.latestTestRun?.status === "completed"
  );

  process.stdout.write(
    `UI smoke passed for store=${store} at http://127.0.0.1:${port}/app\n`
  );
} finally {
  await browser?.close().catch(() => undefined);
  await stopChild(child);
}
