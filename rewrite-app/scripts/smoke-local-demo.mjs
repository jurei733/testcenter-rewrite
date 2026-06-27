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

  process.stdout.write(`Local demo smoke passed at ${baseUrl}/app\n`);
} finally {
  if (browser) {
    await browser.close();
  }
  await stopProcess(api);
}
