import assert from "node:assert/strict";
import { createServer } from "node:net";
import { rm, mkdir } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { spawn } from "node:child_process";
import { setTimeout as delay } from "node:timers/promises";

import { chromium } from "playwright";

const appRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const npmCommand = process.platform === "win32" ? "npm.cmd" : "npm";
const buildMetadataWrapper = resolve(appRoot, "scripts/with-build-metadata.mjs");
const sqliteFile = resolve(
  appRoot,
  process.env.LOCAL_DEMO_SMOKE_SQLITE_FILE ?? ".data/local-demo-smoke.sqlite"
);

const getAvailablePort = () =>
  new Promise((resolvePromise, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        server.close(() => reject(new Error("Could not allocate a TCP port.")));
        return;
      }
      const { port } = address;
      server.close(() => resolvePromise(port));
    });
  });

const run = (command, args, options = {}) =>
  new Promise((resolvePromise, reject) => {
    const child = spawn(command, args, {
      cwd: appRoot,
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

const waitForJson = async url => {
  const deadline = Date.now() + 30_000;
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

const stopProcess = async child => {
  if (!child || child.exitCode != null) {
    return;
  }

  child.kill("SIGTERM");
  await new Promise(resolvePromise => {
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      resolvePromise(undefined);
    }, 5_000);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolvePromise(undefined);
    });
  });
};

await mkdir(dirname(sqliteFile), { recursive: true });
await Promise.all([
  rm(sqliteFile, { force: true }),
  rm(`${sqliteFile}-shm`, { force: true }),
  rm(`${sqliteFile}-wal`, { force: true })
]);

const baseEnv = {
  ...process.env,
  FIRST_SLICE_STORE: "sqlite",
  FIRST_SLICE_SQLITE_FILE: sqliteFile
};

await run(npmCommand, ["run", "db:migrate:sqlite:built"], { env: baseEnv });

const port = await getAvailablePort();
const api = spawn(process.execPath, [buildMetadataWrapper, npmCommand, "run", "start:api"], {
  cwd: appRoot,
  stdio: "inherit",
  env: {
    ...baseEnv,
    PORT: String(port),
    FIRST_SLICE_OPERATOR_AUTH_REQUIRED: "true",
    FIRST_SLICE_BOOTSTRAP_DEMO: "true"
  }
});

api.once("error", error => {
  throw error;
});

const baseUrl = `http://127.0.0.1:${port}`;
let browser = null;
let adminSessionToken = "";

try {
  await waitForJson(`${baseUrl}/readyz`);
  const manifest = await waitForJson(`${baseUrl}/manifest`);
  assert.equal(typeof manifest.build?.commitSha, "string");
  assert.ok(manifest.build.commitSha.length > 0);
  assert.equal(typeof manifest.build?.builtAt, "string");
  assert.match(manifest.build.builtAt, /^\d{4}-\d{2}-\d{2}T/);

  browser = await chromium.launch();
  const page = await browser.newPage();
  const clickCardAction = async (cardTitle, buttonName, itemHeadline) => {
    const card = page.locator("article.card").filter({
      has: page.getByRole("heading", { name: cardTitle, exact: true })
    });
    const actionScope = card.locator(".record-card").filter({
      has: page.getByRole("heading", { name: itemHeadline, exact: true })
    });
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        await actionScope
          .getByRole("button", { name: buttonName, exact: true })
          .first()
          .click({ force: true });
        return;
      } catch (error) {
        if (attempt === 3 || !String(error?.message).includes("not attached")) {
          throw error;
        }
        await page.waitForTimeout(250);
      }
    }
  };

  await page.goto(`${baseUrl}/app`, { waitUntil: "networkidle" });
  const demoLink = page.getByRole("link", { name: "Start Demo Participant" });
  const demoParticipantPath = `/participant?${new URLSearchParams({
    tenantKey: "demo-tenant",
    workspaceKey: "demo-workspace",
    loginKey: "student-demo",
    groupKey: "group:student-demo",
    bookletKey: "booklet:demo"
  }).toString()}`;
  await demoLink.waitFor({ timeout: 15_000 });
  assert.equal(await demoLink.getAttribute("href"), demoParticipantPath);
  await demoLink.click();
  await page.locator("#participantLoginKey").waitFor({ timeout: 15_000 });
  await page.waitForFunction(
    () => {
      const status = document
        .querySelector("#participantRouteStatus")
        ?.textContent?.trim();
      const session =
        document.querySelector("#participantRouteSessionId")?.value ?? "";
      return status === "running" && session.trim().length > 0;
    },
    undefined,
    { timeout: 15_000 }
  );
  const firstParticipantSessionId = await page
    .locator("#participantRouteSessionId")
    .inputValue();
  assert.equal(await page.locator("#participantWorkspaceKey").inputValue(), "demo-workspace");
  assert.equal(await page.locator("#participantLoginKey").inputValue(), "student-demo");
  assert.equal(await page.locator("#participantRouteGroupKey").inputValue(), "group:student-demo");
  assert.equal(await page.locator("#participantRouteBookletKey").inputValue(), "booklet:demo");
  await page.goto(`${baseUrl}${demoParticipantPath}`, { waitUntil: "networkidle" });
  await page.waitForFunction(
    expectedSessionId => {
      const status = document
        .querySelector("#participantRouteStatus")
        ?.textContent?.trim();
      const session =
        document.querySelector("#participantRouteSessionId")?.value ?? "";
      return status === "running" && session === expectedSessionId;
    },
    firstParticipantSessionId,
    { timeout: 15_000 }
  );
  assert.equal(
    (await page.locator("#participantRouteUnitPosition").textContent())?.trim(),
    "1 / 3"
  );
  assert.equal(
    (await page.locator("#participantRouteUnitDescription").textContent())?.trim(),
    "Demo introduction task"
  );
  assert.equal(
    (await page.locator("#participantRouteUnitContent").textContent())?.trim(),
    "Describe what you see in the demo introduction."
  );
  await page.locator("#participantRouteUnitResponse").fill("Intro answer from smoke");

  await page.locator("#participantRouteNextUnitButton").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#participantRouteUnitKey")?.textContent?.trim() ===
        "unit-practice" &&
      document.querySelector("#participantRouteUnitPosition")?.textContent?.trim() ===
        "2 / 3",
    undefined,
    { timeout: 15_000 }
  );
  await page.locator("#participantRoutePreviousUnitButton").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#participantRouteUnitKey")?.textContent?.trim() ===
        "unit-intro" &&
      document.querySelector("#participantRouteUnitResponse")?.value ===
        "Intro answer from smoke",
    undefined,
    { timeout: 15_000 }
  );

  await page.goto(`${baseUrl}/app/ops`, { waitUntil: "networkidle" });
  await page.getByText("Local demo is ready").waitFor({ timeout: 15_000 });
  const localDemoAccessCard = page.locator("article.card").filter({
    has: page.getByRole("heading", { name: "Local Demo Access", exact: true })
  });
  const localDemoParticipantLink = localDemoAccessCard.locator(
    `a[href="${demoParticipantPath}"]`
  );
  await localDemoParticipantLink.waitFor({ timeout: 15_000 });
  assert.equal(
    await localDemoParticipantLink.getAttribute("aria-label"),
    `Participant: ${demoParticipantPath}`
  );
  assert.equal(await localDemoParticipantLink.getAttribute("target"), "_blank");
  assert.equal(await localDemoParticipantLink.getAttribute("rel"), "noreferrer");
  await page.getByRole("button", { name: "Sign In Demo Admin" }).click();
  await page.waitForFunction(
    () => {
      const token = document.querySelector("#adminSessionToken")?.value ?? "";
      return token.trim().length > 0;
    },
    undefined,
    { timeout: 15_000 }
  );
  assert.equal(await page.locator("#adminUsername").inputValue(), "demo-admin");
  adminSessionToken = await page.locator("#adminSessionToken").inputValue();
  assert.ok(adminSessionToken.length > 0);

  await page.goto(`${baseUrl}/app/runtime`, { waitUntil: "networkidle" });
  await page.locator("#runtimeUnitResponse").waitFor({ timeout: 15_000 });
  await page.getByRole("button", { name: "Refresh Runtime Reads" }).click();
  await page.waitForFunction(
    () =>
      document
        .querySelector("#playerPreviewUnitResponseText")
        ?.textContent?.includes("Intro answer from smoke") &&
      document.querySelector("#runtimeUnitResponse")?.value ===
        "Intro answer from smoke",
    undefined,
    { timeout: 15_000 }
  );
  await page.locator(".status-banner").waitFor({ state: "hidden", timeout: 15_000 });

  const rosterDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Saved Roster CSV" }).click();
  const rosterDownload = await rosterDownloadPromise;
  assert.equal(rosterDownload.suggestedFilename(), "demo-workspace-participant-roster.csv");
  await page.waitForFunction(
    () =>
      document
        .querySelector("#participantRosterExportPreview")
        ?.textContent?.includes("Demo Student") &&
      document
        .querySelector("#participantRosterExportPreview")
        ?.textContent?.includes("student-demo"),
    undefined,
    { timeout: 15_000 }
  );

  const participantSessionsDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Sessions CSV" }).click();
  const participantSessionsDownload = await participantSessionsDownloadPromise;
  assert.equal(
    participantSessionsDownload.suggestedFilename(),
    "demo-workspace-participant-sessions.csv"
  );
  await page.waitForFunction(
    () =>
      document
        .querySelector("#participantSessionsExportPreview")
        ?.textContent?.includes("student-demo") &&
      document
        .querySelector("#participantSessionsExportPreview")
        ?.textContent?.includes("group:student-demo"),
    undefined,
    { timeout: 15_000 }
  );

  const openRunsDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Open Runs CSV" }).click();
  const openRunsDownload = await openRunsDownloadPromise;
  assert.equal(openRunsDownload.suggestedFilename(), "demo-workspace-open-runs.csv");
  await page.waitForFunction(
    () =>
      document
        .querySelector("#openRunsExportPreview")
        ?.textContent?.includes("student-demo") &&
      document
        .querySelector("#openRunsExportPreview")
        ?.textContent?.includes("unit-intro"),
    undefined,
    { timeout: 15_000 }
  );

  await page.locator("#runtimeUnitResponse").fill("Operator adjusted smoke response");
  await page.locator("#runtimeUnitResponse").dispatchEvent("input");
  await page.locator("#runtimeUnitResponse").dispatchEvent("change");
  await page.getByRole("button", { name: /^Preview Save/ }).click();
  await page.waitForFunction(
    () =>
      document
        .querySelector("#playerPreviewUnitResponseText")
        ?.textContent?.includes("Operator adjusted smoke response") &&
      document.querySelector("#runtimeUnitResponse")?.value ===
        "Operator adjusted smoke response",
    undefined,
    { timeout: 15_000 }
  );

  await page.getByRole("button", { name: "Detailed Responses" }).click();
  await page.waitForFunction(
    () =>
      document.body.textContent?.includes("Operator adjusted smoke response") &&
      document.body.textContent?.includes("student-demo") &&
      document.body.textContent?.includes("unit-intro"),
    undefined,
    { timeout: 15_000 }
  );

  await page.locator("#reviewComment").fill("Smoke review for adjusted response");
  await page.locator("#reviewComment").dispatchEvent("input");
  await page.locator("#reviewComment").dispatchEvent("change");
  await page.getByRole("button", { name: "Create Review" }).click();
  await page.waitForFunction(
    () =>
      document.body.textContent?.includes("Smoke review for adjusted response") &&
      document.body.textContent?.includes("operator-ui") &&
      document.body.textContent?.includes("Demo Student") &&
      document.body.textContent?.includes("student-demo") &&
      document.querySelector("#reviewId")?.value?.trim().length > 0,
    undefined,
    { timeout: 15_000 }
  );
  const reviewActionQueue = page.locator("article.card").filter({
    has: page.getByRole("heading", { name: "Review Action Queue", exact: true })
  });
  const updateReviewSuggestion = reviewActionQueue
    .locator(".record-card")
    .filter({
      has: page.getByRole("heading", { name: "Update selected review" })
    });
  const deleteReviewSuggestion = reviewActionQueue
    .locator(".record-card")
    .filter({
      has: page.getByRole("heading", { name: "Delete selected review" })
    });
  await updateReviewSuggestion.waitFor({ timeout: 15_000 });
  await deleteReviewSuggestion.waitFor({ timeout: 15_000 });

  await page.locator("#reviewComment").fill("Updated smoke review note");
  await page.locator("#reviewComment").dispatchEvent("input");
  await page.locator("#reviewComment").dispatchEvent("change");
  await clickCardAction(
    "Review Action Queue",
    "Apply Suggestion",
    "Update selected review"
  );
  await page.waitForFunction(
    () =>
      document.body.textContent?.includes("Updated smoke review note") &&
      document.body.textContent?.includes("Review Updated"),
    undefined,
    { timeout: 15_000 }
  );

  await page.getByRole("button", { name: "Participant Session Detail" }).click();
  await page.waitForFunction(
    () => {
      const reviewCard = Array.from(document.querySelectorAll("article.card")).find(
        card =>
          card.querySelector("h3")?.textContent?.trim() ===
          "Selected Session Reviews"
      );
      return (
        reviewCard?.textContent?.includes("Updated smoke review note") &&
        reviewCard.textContent.includes("operator-ui")
      );
    },
    undefined,
    { timeout: 15_000 }
  );

  const reviewDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Review CSV" }).click();
  const reviewDownload = await reviewDownloadPromise;
  assert.equal(reviewDownload.suggestedFilename(), "demo-workspace-reviews.csv");
  await page.waitForFunction(
    () =>
      document
        .querySelector("#reviewExportPreview")
        ?.textContent?.includes("Updated smoke review note"),
    undefined,
    { timeout: 15_000 }
  );

  const deleteReviewDialog = new Promise((resolvePromise, reject) => {
    page.once("dialog", async dialog => {
      try {
        assert.match(dialog.message(), /Delete review '.+' from this workspace\?/);
        await dialog.accept();
        resolvePromise(undefined);
      } catch (error) {
        reject(error);
      }
    });
  });
  await clickCardAction(
    "Review Action Queue",
    "Apply Suggestion",
    "Delete selected review"
  );
  await deleteReviewDialog;
  await page.getByText("Review Deleted").waitFor({ timeout: 15_000 });
  await page
    .locator("app-record-collection")
    .filter({ hasText: "Reviews" })
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: "Review window" }) })
    .filter({ hasText: "0 review row(s)" })
    .waitFor({ timeout: 15_000 });
  const remainingReviews = await fetch(
    `${baseUrl}/api/v1/tenants/demo-tenant/workspaces/demo-workspace/reviews?limit=10`,
    {
      headers: {
        authorization: `Bearer ${adminSessionToken}`
      }
    }
  ).then(async response => {
    assert.equal(response.status, 200);
    return response.json();
  });
  assert.equal(remainingReviews.items.length, 0);

  const responseDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Responses CSV" }).click();
  const responseDownload = await responseDownloadPromise;
  assert.equal(responseDownload.suggestedFilename(), "demo-workspace-responses.csv");
  await page.waitForFunction(
    () =>
      document
        .querySelector("#responseExportPreview")
        ?.textContent?.includes("Operator adjusted smoke response"),
    undefined,
    { timeout: 15_000 }
  );

  await page.locator("#groupKey").fill("group:student-demo");
  await page.locator("#groupKey").dispatchEvent("change");
  await page.waitForFunction(
    () => document.querySelector("#groupKey")?.value === "group:student-demo",
    undefined,
    { timeout: 15_000 }
  );
  page.once("dialog", async dialog => {
    assert.match(dialog.message(), /Type 'group:student-demo'/);
    await dialog.accept("group:student-demo");
  });
  await page.getByRole("button", { name: "Delete Group Results" }).click();
  await page.getByText("Group Results Deleted").waitFor({ timeout: 15_000 });
  const remainingResponses = await fetch(
    `${baseUrl}/api/v1/tenants/demo-tenant/workspaces/demo-workspace/responses/detailed?groupKey=${encodeURIComponent("group:student-demo")}&limit=10`,
    {
      headers: {
        authorization: `Bearer ${adminSessionToken}`
      }
    }
  ).then(async response => {
    assert.equal(response.status, 200);
    return response.json();
  });
  assert.equal(remainingResponses.items.length, 0);

  await page.goto(`${baseUrl}/app/workspace`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Refresh Study Monitor" }).click();
  await page
    .getByRole("heading", { name: "Study Monitor", exact: true })
    .waitFor({ timeout: 15_000 });
  const studyMonitor = await fetch(
    `${baseUrl}/api/v1/tenants/demo-tenant/workspaces/demo-workspace/study-monitor/summary`,
    {
      headers: {
        authorization: `Bearer ${adminSessionToken}`
      }
    }
  ).then(async response => {
    assert.equal(response.status, 200);
    return response.json();
  });
  const demoGroup = studyMonitor.studyMonitorSummary.groups.find(
    group => group.groupKey === "group:student-demo"
  );
  assert.equal(demoGroup?.testRunCount ?? 0, 0);
  assert.equal(demoGroup?.responseCount ?? 0, 0);

  const participantMatrixDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Participant Matrix CSV" }).click();
  const participantMatrixDownload = await participantMatrixDownloadPromise;
  assert.equal(
    participantMatrixDownload.suggestedFilename(),
    "demo-workspace-study-monitor-participants.csv"
  );
  await page
    .locator("app-record-collection")
    .filter({ hasText: "Participant Unit Matrix" })
    .filter({ hasText: "student-demo" })
    .filter({ hasText: "unit-intro" })
    .waitFor({ state: "visible", timeout: 15_000 });
  await page
    .locator("app-record-collection")
    .filter({ hasText: "Participant Unit Matrix" })
    .locator(".record-card")
    .filter({ hasText: "student-demo" })
    .filter({ hasText: "unit-intro" })
    .getByRole("button", { name: "Open Participant Detail" })
    .first()
    .click();
  await page
    .locator("app-record-collection")
    .filter({ hasText: "Study Monitor Participant Detail" })
    .filter({ hasText: "student-demo" })
    .filter({ hasText: "unit-intro" })
    .waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(
    () =>
      document
        .querySelector("#studyMonitorParticipantMatrixExportPreview")
        ?.textContent?.includes("student-demo") &&
      document
        .querySelector("#studyMonitorParticipantMatrixExportPreview")
        ?.textContent?.includes("unit-intro") &&
      document
        .querySelector("#studyMonitorParticipantMatrixExportPreview")
        ?.textContent?.includes("not_started"),
    undefined,
    { timeout: 15_000 }
  );

  const logDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Workspace Logs CSV" }).click();
  const logDownload = await logDownloadPromise;
  assert.equal(logDownload.suggestedFilename(), "demo-workspace-logs.csv");
  await page.waitForFunction(
    () =>
      document
        .querySelector("#workspaceLogExportPreview")
        ?.textContent?.includes("test_run_progress_saved"),
    undefined,
    { timeout: 15_000 }
  );
  const staleParticipantSessionId = "00000000-0000-4000-8000-000000000000";
  await page.evaluate(staleSessionId => {
    const storageKey = "testcenter-rewrite-app-shell";
    const snapshot = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}");
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        ...snapshot,
        participantSessionId: staleSessionId,
        testRunId: "",
        currentUnitKey: ""
      })
    );
  }, staleParticipantSessionId);
  await page.goto(`${baseUrl}${demoParticipantPath}`, { waitUntil: "networkidle" });
  await page.waitForFunction(
    staleSessionId => {
      const status = document
        .querySelector("#participantRouteStatus")
        ?.textContent?.trim();
      const session =
        document.querySelector("#participantRouteSessionId")?.value ?? "";
      return (
        status === "running" &&
        session.trim().length > 0 &&
        session !== staleSessionId
      );
    },
    staleParticipantSessionId,
    { timeout: 15_000 }
  );

  process.stdout.write(`Local demo smoke passed at ${baseUrl}/app\n`);
} finally {
  if (browser) {
    await browser.close();
  }
  await stopProcess(api);
}
