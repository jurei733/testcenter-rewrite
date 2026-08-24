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
  rm(`${sqliteFile}-wal`, { force: true }),
  rm(`${sqliteFile}-journal`, { force: true })
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
  const expectButtonEnabled = async (pageObject, name) => {
    const button = pageObject.getByRole("button", { name, exact: true });
    await button.waitFor({ timeout: 15_000 });
    assert.equal(await button.isEnabled(), true);
  };
  const expectButtonDisabled = async (pageObject, name) => {
    const button = pageObject.getByRole("button", { name, exact: true });
    await button.waitFor({ timeout: 15_000 });
    assert.equal(await button.isDisabled(), true);
  };
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

  const initialUnauthorizedResponses = [];
  const trackInitialUnauthorizedResponse = response => {
    if (response.status() === 401) {
      initialUnauthorizedResponses.push(response.url());
    }
  };
  page.on("response", trackInitialUnauthorizedResponse);
  await page.goto(`${baseUrl}/app`, { waitUntil: "networkidle" });
  await page.waitForURL(/\/app\/home$/);
  await page.locator("#applicationStartView").waitFor({
    timeout: 15_000
  });
  page.off("response", trackInitialUnauthorizedResponse);
  assert.deepEqual(
    initialUnauthorizedResponses,
    [],
    "The public application start must not probe protected operator routes."
  );
  await page.locator('[data-view-nav="home"].is-active').waitFor();
  assert.equal(
    await page.locator('[data-view-nav="workspace"]').count(),
    0,
    "Signed-out navigation must not advertise protected workspace administration."
  );
  await page.getByRole("link", { name: "Open participant entry" }).waitFor();
  await page.getByRole("link", { name: "Open system check" }).waitFor();
  await page.getByRole("link", { name: "Open operator sign-in" }).waitFor();
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
  const demoAdminLink = page.getByRole("link", { name: "Sign In Demo Admin" });
  assert.equal(await demoAdminLink.getAttribute("href"), "/app/ops?demoAdmin=sign-in");
  await page.locator("#localDemoStartupCard").waitFor({ timeout: 15_000 });
  assert.equal(
    (await page.locator("#localDemoStartupStatus").textContent())?.trim(),
    "Local demo is ready to use"
  );
  assert.equal(
    (await page.locator("#localDemoAdminCredential").textContent())?.trim(),
    "demo-admin / demo-admin-password"
  );
  assert.equal(
    (await page.locator("#localDemoParticipantCredential").textContent())?.trim(),
    "student-demo"
  );
  assert.match(
    (await page.locator("#localDemoRuntimeDetail").textContent())?.trim() ?? "",
    /Storage sqlite, schema \d+, auth required/
  );
  assert.match(
    (await page.locator("#localDemoBuildDetail").textContent())?.trim() ?? "",
    /^Build .+/
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.reload({ waitUntil: "networkidle" });
  await page.locator("#applicationStartView").waitFor({ timeout: 15_000 });
  const mobileStartDimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyHeight: document.body.scrollHeight
  }));
  assert.equal(
    mobileStartDimensions.scrollWidth,
    mobileStartDimensions.clientWidth,
    "The public application start must not overflow the mobile viewport."
  );
  assert.ok(
    mobileStartDimensions.bodyHeight < 3_500,
    `The public application start must stay focused; got ${mobileStartDimensions.bodyHeight}px.`
  );
  await page.setViewportSize({ width: 1280, height: 720 });
  const protectedRouteUnauthorizedResponses = [];
  const trackProtectedRouteUnauthorizedResponse = response => {
    if (response.status() === 401) {
      protectedRouteUnauthorizedResponses.push(response.url());
    }
  };
  page.on("response", trackProtectedRouteUnauthorizedResponse);
  await page.goto(`${baseUrl}/app/workspace`, { waitUntil: "networkidle" });
  await page.waitForURL(url =>
    url.pathname === "/app/ops" && url.searchParams.get("returnUrl") === "/workspace"
  );
  page.off("response", trackProtectedRouteUnauthorizedResponse);
  assert.deepEqual(
    protectedRouteUnauthorizedResponses,
    [],
    "A protected direct link must reach operator sign-in without probing protected APIs."
  );
  await page.locator('[data-view-nav="ops"].is-active').waitFor({
    timeout: 15_000
  });
  await page.locator("#operatorAccessCard.is-signed-out").waitFor();
  assert.equal(
    await page.getByRole("heading", { name: "Diagnostics", exact: true }).count(),
    0,
    "Signed-out operator access must not expose the diagnostic console."
  );
  assert.equal(
    await page.getByRole("heading", { name: "Ops Action Queue", exact: true }).count(),
    0,
    "Signed-out operator access must not render operational data cards."
  );
  await page.setViewportSize({ width: 390, height: 844 });
  const mobileOperatorDimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyHeight: document.body.scrollHeight
  }));
  assert.equal(
    mobileOperatorDimensions.scrollWidth,
    mobileOperatorDimensions.clientWidth,
    "Operator sign-in must not overflow the mobile viewport."
  );
  assert.ok(
    mobileOperatorDimensions.bodyHeight < 3_000,
    `Operator sign-in must stay focused; got ${mobileOperatorDimensions.bodyHeight}px.`
  );
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.locator("#adminUsername").fill("demo-admin");
  await page.locator("#adminPassword").fill("demo-admin-password");
  await page.locator("#adminSignInButton").click();
  await page.waitForURL(/\/app\/workspace$/);
  await page.locator('[data-view-nav="workspace"].is-active').waitFor({
    timeout: 15_000
  });
  await page.locator("#tenantKey").fill("demo-tenant");
  await page.locator("#tenantKey").dispatchEvent("input");
  await page.locator("#tenantKey").dispatchEvent("change");
  await page.locator("#workspaceKey").fill("demo-workspace");
  await page.locator("#workspaceKey").dispatchEvent("input");
  await page.locator("#workspaceKey").dispatchEvent("change");

  const tenantDirectoryDownloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export Tenant Directory CSV", exact: true })
    .click();
  const tenantDirectoryDownload = await tenantDirectoryDownloadPromise;
  assert.equal(tenantDirectoryDownload.suggestedFilename(), "tenants.csv");
  await page.waitForFunction(
    () =>
      document
        .querySelector("#tenantDirectoryExportPreview")
        ?.textContent?.includes("tenantKey,displayName,status,tenantId,createdAt") &&
      document
        .querySelector("#tenantDirectoryExportPreview")
        ?.textContent?.includes("demo-tenant"),
    undefined,
    { timeout: 15_000 }
  );

  const workspaceDirectoryDownloadPromise = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export Workspace Directory CSV", exact: true })
    .click();
  const workspaceDirectoryDownload = await workspaceDirectoryDownloadPromise;
  assert.equal(
    workspaceDirectoryDownload.suggestedFilename(),
    "demo-tenant-workspaces.csv"
  );
  await page.waitForFunction(
    () =>
      document
        .querySelector("#workspaceDirectoryExportPreview")
        ?.textContent?.includes(
          "tenantKey,workspaceKey,displayName,status,workspaceId,createdAt,latestFileModificationAt"
        ) &&
      document
        .querySelector("#workspaceDirectoryExportPreview")
        ?.textContent?.includes("demo-workspace"),
    undefined,
    { timeout: 15_000 }
  );

  await page.goto(`${baseUrl}${demoParticipantPath}`, {
    waitUntil: "domcontentloaded"
  });
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
  for (const starterField of [
    "#participantWorkspaceKey",
    "#participantLoginKey",
    "#participantRouteGroupKey",
    "#participantRouteBookletKey"
  ]) {
    assert.equal(await page.locator(starterField).count(), 0);
  }
  await page.goto(`${baseUrl}${demoParticipantPath}`, {
    waitUntil: "domcontentloaded"
  });
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
    (await page.locator("#participantRouteGroupLabel").textContent())?.trim(),
    "Demo Group"
  );
  const progressTrack = page.locator(".participant-progress .progress-track");
  assert.equal(await progressTrack.getAttribute("role"), "progressbar");
  assert.equal(
    await progressTrack.getAttribute("aria-labelledby"),
    "participantRouteProgressLabel"
  );
  assert.equal(await progressTrack.getAttribute("aria-valuemin"), "0");
  assert.equal(await progressTrack.getAttribute("aria-valuemax"), "100");
  assert.equal(await progressTrack.getAttribute("aria-valuenow"), "0");
  assert.equal(
    await progressTrack.getAttribute("aria-valuetext"),
    "0 / 3 responses saved"
  );
  const introUnitChip = page.locator('[data-unit-key="unit-intro"]').first();
  await introUnitChip.waitFor({ timeout: 15_000 });
  assert.equal(await introUnitChip.getAttribute("aria-current"), "step");
  assert.equal(
    await introUnitChip.getAttribute("aria-label"),
    "Unit 1: Introduction, current, unanswered, available"
  );
  assert.equal(
    await introUnitChip.getAttribute("title"),
    "Unit 1: Introduction, current, unanswered, available"
  );
  assert.equal(await page.locator("#participantRouteUnitResponse").count(), 0);
  await page
    .locator("#participantVeronaPlayerVersion")
    .filter({ hasText: "API 6.0" })
    .waitFor({ timeout: 15_000 });
  const introPlayerFrame = page.frameLocator("#participantVeronaPlayerFrame");
  await introPlayerFrame
    .locator("#demoPlayerTitle")
    .filter({ hasText: "Welcome to the interactive demo" })
    .waitFor({ timeout: 15_000 });
  const introAnswerSaved = page.waitForResponse(
    response => {
      if (
        response.request().method() !== "POST" ||
        !response.url().endsWith("/save-progress") ||
        !response.ok()
      ) {
        return false;
      }
      try {
        const payload = response.request().postDataJSON();
        return String(payload?.unitResponse ?? "").includes(
          "Intro answer from smoke"
        );
      } catch {
        return false;
      }
    },
    { timeout: 15_000 }
  );
  await introPlayerFrame
    .locator("#demoPlayerAnswer")
    .fill("Intro answer from smoke");
  await introAnswerSaved;
  await page
    .locator("#participantVeronaSaveStatus")
    .filter({ hasText: "saved" })
    .waitFor({ timeout: 15_000 });

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
  assert.equal(
    await page
      .locator('[data-unit-key="unit-practice"]')
      .first()
      .getAttribute("aria-current"),
    "step"
  );
  assert.equal(
    await page
      .locator('[data-unit-key="unit-intro"]')
      .first()
      .getAttribute("aria-label"),
    "Unit 1: Introduction, not current, answered, available"
  );
  await page
    .frameLocator("#participantVeronaPlayerFrame")
    .locator("#demoPlayerTitle")
    .filter({ hasText: "Practice response persistence" })
    .waitFor({ timeout: 15_000 });
  await page.locator("#participantRoutePreviousUnitButton").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#participantRouteUnitKey")?.textContent?.trim() ===
        "unit-intro",
    undefined,
    { timeout: 15_000 }
  );
  const restoredIntroPlayerFrame = page.frameLocator(
    "#participantVeronaPlayerFrame"
  );
  await restoredIntroPlayerFrame
    .locator("#demoPlayerAnswer")
    .waitFor({ state: "visible", timeout: 15_000 });
  await restoredIntroPlayerFrame
    .locator("#demoPlayerAnswer")
    .evaluate(
      (input, expectedValue) =>
        new Promise((resolve, reject) => {
          const deadline = Date.now() + 15_000;
          const check = () => {
            if (input.value === expectedValue) {
              resolve(undefined);
              return;
            }
            if (Date.now() >= deadline) {
              reject(
                new Error(
                  `Expected restored demo answer '${expectedValue}', received '${input.value}'.`
                )
              );
              return;
            }
            setTimeout(check, 50);
          };
          check();
        }),
      "Intro answer from smoke"
    );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page.waitForFunction(
    expectedSessionId =>
      document.querySelector("#participantRouteStatus")?.textContent?.trim() ===
        "running" &&
      document.querySelector("#participantRouteSessionId")?.value ===
        expectedSessionId,
    firstParticipantSessionId,
    { timeout: 15_000 }
  );
  const reloadedIntroPlayerFrame = page.frameLocator(
    "#participantVeronaPlayerFrame"
  );
  await reloadedIntroPlayerFrame
    .locator("#demoPlayerAnswer")
    .waitFor({ timeout: 15_000 });
  assert.equal(
    await reloadedIntroPlayerFrame.locator("#demoPlayerAnswer").inputValue(),
    "Intro answer from smoke"
  );

  await page.goto(`${baseUrl}/app/ops`, { waitUntil: "networkidle" });
  await page
    .getByRole("heading", { name: "Local demo is ready", exact: true })
    .waitFor({ timeout: 15_000 });
  const localDemoAccessCard = page.locator("article.card").filter({
    has: page.getByRole("heading", { name: "Local Demo Access", exact: true })
  });
  const localDemoAccessRecord = localDemoAccessCard.locator(".record-card").filter({
    has: page.getByRole("heading", { name: "Local demo is ready", exact: true })
  });
  await localDemoAccessRecord.waitFor({ timeout: 15_000 });
  assert.equal(
    await localDemoAccessRecord.getAttribute("aria-label"),
    "Local demo is ready: demo-tenant / demo-workspace"
  );
  assert.equal(
    await localDemoAccessRecord
      .locator(".record-card-row-value")
      .filter({ hasText: "student-demo" })
      .first()
      .getAttribute("aria-label"),
    "Login Key: student-demo"
  );
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

  await page.goto(`${baseUrl}/app/runtime`, { waitUntil: "domcontentloaded" });
  await page.locator("#runtimeUnitResponse").waitFor({ timeout: 15_000 });
  const runtimeSummaryCards = page
    .getByRole("list", { name: "Operational summary cards" })
    .first();
  await runtimeSummaryCards.waitFor({ timeout: 15_000 });
  assert.equal(await runtimeSummaryCards.getAttribute("role"), "list");
  assert.equal(
    await runtimeSummaryCards.getAttribute("aria-label"),
    "Operational summary cards"
  );
  const firstSummaryCard = runtimeSummaryCards.locator(".summary-card").first();
  await firstSummaryCard.waitFor({ timeout: 15_000 });
  assert.equal(await firstSummaryCard.getAttribute("role"), "listitem");
  assert.match(await firstSummaryCard.getAttribute("aria-label"), /.+: .+\. .+/);
  await page.waitForFunction(
    () =>
      document.querySelector("#participantSessionId")?.value?.trim().length > 0 &&
      document.querySelector("#testRunId")?.value?.trim().length > 0 &&
      document.querySelector("#currentUnitKey")?.value?.trim().length > 0,
    undefined,
    { timeout: 15_000 }
  );
  await expectButtonEnabled(page, "Resume Session");
  await expectButtonEnabled(page, "Save Paused");
  await expectButtonEnabled(page, "Monitor Pause");
  await expectButtonDisabled(page, "Update Review");
  await page.getByRole("button", { name: "Refresh Runtime Reads" }).click();
  await page.waitForFunction(
    () =>
      document
        .querySelector("#playerPreviewUnitResponseText")
        ?.textContent?.includes("Intro answer from smoke") &&
      document
        .querySelector("#runtimeUnitResponse")
        ?.value?.includes("Intro answer from smoke"),
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
        ?.textContent?.includes("Demo Group"),
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
        ?.textContent?.includes("Demo Group"),
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

  await clickCardAction(
    "Review Action Queue",
    "Apply Suggestion",
    "Delete selected review"
  );
  const deleteReviewConfirmation = page.locator("#globalConfirmationDialog");
  await deleteReviewConfirmation.waitFor({ timeout: 15_000 });
  assert.match(
    (await deleteReviewConfirmation
      .locator("#globalConfirmationMessage")
      .textContent()) ?? "",
    /Delete review '.+' from this workspace\?/
  );
  await deleteReviewConfirmation
    .locator("#globalConfirmationConfirmButton")
    .click();
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

  await page.goto(`${baseUrl}/app/workspace`, { waitUntil: "domcontentloaded" });
  const logDownloadPromise = page.waitForEvent("download");
  await page.locator("#exportWorkspaceLogCsvButton").click();
  const logDownload = await logDownloadPromise;
  assert.equal(
    logDownload.suggestedFilename(),
    "demo-workspace-test-logs.csv"
  );
  await page.waitForFunction(
    () =>
      document
        .querySelector("#workspaceLogExportPreview")
        ?.textContent?.includes(
          "groupname;loginname;code;bookletname;unitname;originalUnitId;timestamp;logentry"
        ) &&
      document
        .querySelector("#workspaceLogExportPreview")
        ?.textContent?.includes("DEMO_ANSWER_CHANGED") &&
      document
        .querySelector("#workspaceLogExportPreview")
        ?.textContent?.includes("answered"),
    undefined,
    { timeout: 15_000 }
  );
  await page.goto(`${baseUrl}/app/runtime`, { waitUntil: "domcontentloaded" });

  await page.locator("#groupKey").fill("group:student-demo");
  await page.locator("#groupKey").dispatchEvent("change");
  await page.waitForFunction(
    () => document.querySelector("#groupKey")?.value === "group:student-demo",
    undefined,
    { timeout: 15_000 }
  );
  await page.getByRole("button", { name: "Delete Group Results" }).click();
  const deleteGroupResultsConfirmation = page.locator("#globalConfirmationDialog");
  await deleteGroupResultsConfirmation.waitFor({ timeout: 15_000 });
  assert.match(
    (await deleteGroupResultsConfirmation
      .locator("#globalConfirmationMessage")
      .textContent()) ?? "",
    /Delete all collected test runs for group 'group:student-demo'\?/
  );
  await deleteGroupResultsConfirmation
    .locator("#globalConfirmationVerificationInput")
    .fill("group:student-demo");
  await deleteGroupResultsConfirmation
    .locator("#globalConfirmationConfirmButton")
    .click();
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

  await page.goto(`${baseUrl}/app/workspace`, { waitUntil: "domcontentloaded" });
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
  assert.equal(demoGroup?.groupLabel, "Demo Group");
  assert.equal(demoGroup?.testRunCount ?? 0, 0);
  assert.equal(demoGroup?.responseCount ?? 0, 0);

  const participantMatrixDownloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export Participant Matrix CSV" }).click();
  const participantMatrixDownload = await participantMatrixDownloadPromise;
  assert.equal(
    participantMatrixDownload.suggestedFilename(),
    "demo-workspace-study-monitor-participants.csv"
  );
  const filteredParticipantMatrixCsvResponse = await fetch(
    `${baseUrl}/api/v1/tenants/demo-tenant/workspaces/demo-workspace/exports/study-monitor-participants.csv?loginKey=student-demo&unitKey=unit-intro&testRunStatus=not_started&answerState=missing&limit=1`,
    {
      headers: {
        authorization: `Bearer ${adminSessionToken}`
      }
    }
  );
  assert.equal(filteredParticipantMatrixCsvResponse.status, 200);
  const filteredParticipantMatrixCsv =
    await filteredParticipantMatrixCsvResponse.text();
  assert.match(filteredParticipantMatrixCsv, /tenantKey,workspaceKey,generatedAt,loginKey/);
  assert.match(filteredParticipantMatrixCsv, /student-demo/);
  assert.match(filteredParticipantMatrixCsv, /Demo Group/);
  assert.match(filteredParticipantMatrixCsv, /unit-intro/);
  assert.match(filteredParticipantMatrixCsv, /not_started/);
  assert.equal(filteredParticipantMatrixCsv.trim().split("\n").length, 2);
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

  const activeGlobalSessionToken = await page.evaluate(() => {
    const snapshot = JSON.parse(
      window.localStorage.getItem("testcenter-rewrite-app-shell") ?? "{}"
    );
    return typeof snapshot.adminSessionToken === "string"
      ? snapshot.adminSessionToken
      : "";
  });
  assert.ok(activeGlobalSessionToken.length > 20);
  const globalSignOutResponsePromise = page.waitForResponse(response =>
    response.url().endsWith("/api/v1/admin/auth/sign-out")
  );
  await page.locator("#globalAdminSignOutButton").click();
  assert.equal((await globalSignOutResponsePromise).status(), 200);
  await page.waitForURL(/\/app\/ops$/);
  await page.locator("#operatorAccessCard.is-signed-out").waitFor();
  assert.equal(
    await page.getByRole("heading", { name: "Ops Action Queue", exact: true }).count(),
    0
  );
  const signedOutSessionResponse = await fetch(
    `${baseUrl}/api/v1/admin/auth/current-session`,
    {
      headers: {
        authorization: `Bearer ${activeGlobalSessionToken}`
      }
    }
  );
  assert.equal(signedOutSessionResponse.status, 401);

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
  await page.goto(`${baseUrl}${demoParticipantPath}`, {
    waitUntil: "domcontentloaded"
  });
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
