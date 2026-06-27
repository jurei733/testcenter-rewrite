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
const api = spawn(npmCommand, ["run", "start:api"], {
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

try {
  await waitForJson(`${baseUrl}/readyz`);

  browser = await chromium.launch();
  const page = await browser.newPage();

  await page.goto(`${baseUrl}/app`, { waitUntil: "networkidle" });
  const demoLink = page.getByRole("link", { name: "Start Demo Participant" });
  await demoLink.waitFor({ timeout: 15_000 });
  assert.equal(
    await demoLink.getAttribute("href"),
    "/participant?workspaceKey=demo-workspace&loginKey=student-demo"
  );
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
  assert.equal(await page.locator("#participantWorkspaceKey").inputValue(), "demo-workspace");
  assert.equal(await page.locator("#participantLoginKey").inputValue(), "student-demo");
  assert.equal(
    (await page.locator("#participantRouteUnitPosition").textContent())?.trim(),
    "1 / 3"
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
      document.body.textContent?.includes("student-demo · unit-intro"),
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
      document.body.textContent?.includes("note · student-demo") &&
      document.querySelector("#reviewId")?.value?.trim().length > 0,
    undefined,
    { timeout: 15_000 }
  );

  await page.locator("#reviewComment").fill("Updated smoke review note");
  await page.locator("#reviewComment").dispatchEvent("input");
  await page.locator("#reviewComment").dispatchEvent("change");
  await page.getByRole("button", { name: "Update Review" }).click();
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

  await page.getByRole("button", { name: "Delete Review" }).click();
  await page
    .getByText("Create or load reviews to inspect operator notes.")
    .waitFor({ timeout: 15_000 });
  await page.getByText("Review Deleted").waitFor({ timeout: 15_000 });

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

  await page.waitForFunction(
    () => document.querySelector("#groupKey")?.value === "group:student-demo",
    undefined,
    { timeout: 15_000 }
  );
  page.once("dialog", async dialog => {
    assert.match(dialog.message(), /group 'group:student-demo'/);
    await dialog.accept();
  });
  await page.getByRole("button", { name: "Delete Group Results" }).click();
  await page
    .getByText("Load detailed responses to inspect saved answers across the workspace.")
    .waitFor({ timeout: 15_000 });
  await page.getByText("Group Results Deleted").waitFor({ timeout: 15_000 });

  await page.goto(`${baseUrl}/app/workspace`, { waitUntil: "networkidle" });
  await page.getByRole("button", { name: "Refresh Study Monitor" }).click();
  await page.waitForFunction(
    () =>
      document.body.textContent?.includes("group:student-demo") &&
      document.body.textContent?.includes("0 running") &&
      document.body.textContent?.includes("Responses") &&
      document.body.textContent?.includes("0"),
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

  process.stdout.write(`Local demo smoke passed at ${baseUrl}/app\n`);
} finally {
  if (browser) {
    await browser.close();
  }
  await stopProcess(api);
}
