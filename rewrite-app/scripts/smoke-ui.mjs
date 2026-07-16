import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";

import { chromium } from "playwright";

const store = process.env.FIRST_SLICE_STORE ?? "sqlite";
const stopAfterStep = process.env.UI_SMOKE_STOP_AFTER_STEP ?? "";
const skipRuntimeCsvExports = ["1", "true", "yes", "on"].includes(
  String(process.env.UI_SMOKE_SKIP_RUNTIME_CSV_EXPORTS ?? "").toLowerCase()
);
const busyStartTimeoutMs = Number.parseInt(
  process.env.UI_SMOKE_BUSY_START_TIMEOUT_MS ?? "750",
  10
);
const logBusyStartTimeouts = ["1", "true", "yes", "on"].includes(
  String(process.env.UI_SMOKE_LOG_BUSY_START_TIMEOUTS ?? "").toLowerCase()
);
const serverEntry = resolve("apps/api/dist/apps/api/src/index.js");
const failedImportSourceDocument = '{"booklets":[]}';
const repairedImportSourceDocument =
  '<assessment><booklet key="booklet:recovered" label="Recovered"><unit key="unit-recovered" label="Recovered Unit" /></booklet></assessment>';
const uploadedSourceDocument =
  '<assessment><booklet key="booklet:starter" label="Starter"><unit key="unit-1" label="Entry" /><unit key="unit-participant-route" label="Participant Route"><description>Read the participant prompt.</description><prompt>Explain how the starter example works.</prompt></unit><unit key="unit-paused" label="Paused Work" /></booklet></assessment>';
let smokeAdminSessionToken = "";

const createStoredZipBuffer = entries => {
  const localFileHeaders = [];
  const centralDirectoryHeaders = [];
  let offset = 0;

  for (const entry of entries) {
    const fileName = Buffer.from(entry.fileName, "utf8");
    const content = Buffer.from(entry.content, "utf8");
    const localHeader = Buffer.alloc(30 + fileName.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt32LE(0, 10);
    localHeader.writeUInt32LE(0, 14);
    localHeader.writeUInt32LE(content.length, 18);
    localHeader.writeUInt32LE(content.length, 22);
    localHeader.writeUInt16LE(fileName.length, 26);
    fileName.copy(localHeader, 30);
    localFileHeaders.push(localHeader, content);

    const centralDirectoryHeader = Buffer.alloc(46 + fileName.length);
    centralDirectoryHeader.writeUInt32LE(0x02014b50, 0);
    centralDirectoryHeader.writeUInt16LE(20, 4);
    centralDirectoryHeader.writeUInt16LE(20, 6);
    centralDirectoryHeader.writeUInt16LE(0x0800, 8);
    centralDirectoryHeader.writeUInt16LE(0, 10);
    centralDirectoryHeader.writeUInt32LE(0, 12);
    centralDirectoryHeader.writeUInt32LE(0, 16);
    centralDirectoryHeader.writeUInt32LE(content.length, 20);
    centralDirectoryHeader.writeUInt32LE(content.length, 24);
    centralDirectoryHeader.writeUInt16LE(fileName.length, 28);
    centralDirectoryHeader.writeUInt32LE(offset, 42);
    fileName.copy(centralDirectoryHeader, 46);
    centralDirectoryHeaders.push(centralDirectoryHeader);

    offset += localHeader.length + content.length;
  }

  const centralDirectoryOffset = offset;
  const centralDirectory = Buffer.concat(centralDirectoryHeaders);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(entries.length, 8);
  endOfCentralDirectory.writeUInt16LE(entries.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(centralDirectoryOffset, 16);

  return Buffer.concat([
    ...localFileHeaders,
    centralDirectory,
    endOfCentralDirectory
  ]);
};

class UiSmokeEarlyExit extends Error {
  constructor(step) {
    super(`UI smoke stopped after requested step: ${step}`);
    this.name = "UiSmokeEarlyExit";
    this.step = step;
  }
}

const createSmokeFetchInit = () =>
  smokeAdminSessionToken
    ? {
        headers: {
          authorization: `Bearer ${smokeAdminSessionToken}`
        }
      }
    : undefined;

const sendSmokeJson = async (url, { method = "POST", body } = {}) => {
  const response = await fetch(url, {
    method,
    headers: {
      "content-type": "application/json",
      ...(smokeAdminSessionToken
        ? { authorization: `Bearer ${smokeAdminSessionToken}` }
        : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });

  if (!response.ok) {
    throw new Error(
      `Unexpected status ${response.status} for ${method} ${url}: ${await response.text()}`
    );
  }

  return response;
};

const flattenManifestRouteNames = value => {
  if (!value || typeof value !== "object") {
    return [];
  }

  return Object.entries(value).flatMap(([key, nestedValue]) =>
    typeof nestedValue === "string"
      ? [key]
      : flattenManifestRouteNames(nestedValue)
  );
};

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
    const response = await fetch(url, createSmokeFetchInit());
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
  const participantEntryUrlPrefix = `${baseUrl}/participant?tenantKey=${encodeURIComponent(
    tenantKey
  )}&workspaceKey=${encodeURIComponent(workspaceKey)}`;
  const adminUsername = `ui-admin-${Date.now()}`;
  const adminPassword = "ui-smoke-admin-secret";
  let totalApiRequestCount = 0;
  const logStep = step => {
    process.stdout.write(`ui_smoke_step=${step}\n`);
  };
  const stopAfter = step => {
    if (stopAfterStep !== step) {
      return;
    }

    process.stdout.write(
      `UI smoke stopped after requested step=${step} for store=${store} at ${baseUrl}/app\n`
    );
    throw new UiSmokeEarlyExit(step);
  };
  page.on("request", request => {
    const url = request.url();
    if (!url.includes("/api/v1/")) {
      return;
    }

    totalApiRequestCount += 1;
  });
  if (!Number.isFinite(busyStartTimeoutMs) || busyStartTimeoutMs < 0) {
    throw new Error("UI_SMOKE_BUSY_START_TIMEOUT_MS must be a non-negative integer.");
  }
  const fillAndCommit = async (selector, value) => {
    const locator = page.locator(selector);
    await locator.waitFor({ state: "attached" });
    await locator.evaluate((element, nextValue) => {
      const value = String(nextValue);
      if (element instanceof HTMLInputElement) {
        const valueSetter = Object.getOwnPropertyDescriptor(
          HTMLInputElement.prototype,
          "value"
        )?.set;
        valueSetter?.call(element, value);
      } else if (element instanceof HTMLTextAreaElement) {
        const valueSetter = Object.getOwnPropertyDescriptor(
          HTMLTextAreaElement.prototype,
          "value"
        )?.set;
        valueSetter?.call(element, value);
      }
      element.dispatchEvent(new Event("input", { bubbles: true }));
      element.dispatchEvent(new Event("change", { bubbles: true }));
    }, String(value));
    await locator.blur();
    await page.waitForTimeout(50);
  };
  const selectAndCommit = async (selector, value) => {
    const locator = page.locator(selector);
    await locator.selectOption(String(value));
    await locator.dispatchEvent("change");
    await locator.blur();
    await page.waitForTimeout(50);
  };
  const expectInputValue = async (selector, expectedValue) => {
    await page.waitForFunction(
      ([targetSelector, targetValue]) => {
        const field = document.querySelector(targetSelector);
        return (
          (field instanceof HTMLInputElement ||
            field instanceof HTMLTextAreaElement ||
            field instanceof HTMLSelectElement) &&
          field.value === targetValue
        );
      },
      [selector, expectedValue],
      { timeout: 15_000 }
    );
  };
  const expectRuntimeReviewHandoff = async ({
    loginKey,
    groupKey,
    bookletKey,
    participantSessionId,
    testRunId,
    unitKey
  }) => {
    await page.waitForURL(/\/app\/runtime$/);
    await expectInputValue("#participantSessionId", participantSessionId);
    await expectInputValue("#testRunId", testRunId);
    await expectInputValue("#groupKey", groupKey);
    await expectInputValue("#bookletKey", bookletKey);
    await expectInputValue("#currentUnitKey", unitKey);
    await expectInputValue("#detailedResponseLoginFilter", loginKey);
    await expectInputValue("#detailedResponseGroupFilter", groupKey);
    await expectInputValue("#detailedResponseBookletFilter", bookletKey);
    await expectInputValue("#detailedResponseSessionFilter", participantSessionId);
    await expectInputValue("#detailedResponseRunFilter", testRunId);
    await expectInputValue("#detailedResponseUnitFilter", unitKey);
    await expectInputValue("#reviewLoginFilter", loginKey);
    await expectInputValue("#reviewGroupFilter", groupKey);
    await expectInputValue("#reviewBookletFilter", bookletKey);
    await expectInputValue("#reviewSessionFilter", participantSessionId);
    await expectInputValue("#reviewRunFilter", testRunId);
    await expectInputValue("#reviewUnitFilter", unitKey);
    await expectInputValue("#openRunLoginFilter", loginKey);
    await expectInputValue("#openRunGroupFilter", groupKey);
    await expectInputValue("#openRunBookletFilter", bookletKey);
    await expectInputValue("#openRunSessionFilter", participantSessionId);
    await expectInputValue("#openRunRunFilter", testRunId);
    await expectInputValue("#openRunUnitFilter", unitKey);
  };
  const fillAndCommitUntilValue = async (selector, value) => {
    let lastError = null;
    for (let attempt = 0; attempt < 4; attempt += 1) {
      await fillAndCommit(selector, value);
      try {
        await expectInputValue(selector, value);
        return;
      } catch (error) {
        lastError = error;
        await page.waitForTimeout(250);
      }
    }
    throw lastError ?? new Error(`Timed out committing ${selector}.`);
  };
  const waitForInputMinLength = async (selector, minLength) => {
    await page.waitForFunction(
      ([targetSelector, targetMinLength]) => {
        const input = document.querySelector(targetSelector);
        return (
          input instanceof HTMLInputElement &&
          input.value.length >= Number(targetMinLength)
        );
      },
      [selector, minLength],
      { timeout: 15_000 }
    );
  };
  const expectParticipantEntryAnchor = async (cardLocator, expectedFragments) => {
    const link = cardLocator
      .locator("a")
      .filter({ hasText: participantEntryUrlPrefix })
      .first();
    await link.waitFor();
    const href = await link.getAttribute("href");
    assert.ok(
      href?.startsWith(participantEntryUrlPrefix),
      `Expected participant entry link to start with ${participantEntryUrlPrefix}, got ${href}`
    );
    for (const fragment of expectedFragments) {
      assert.ok(
        href.includes(fragment),
        `Expected participant entry link ${href} to include ${fragment}`
      );
    }
    assert.equal(await link.getAttribute("target"), "_blank");
    assert.equal(await link.getAttribute("rel"), "noreferrer");
    assert.ok(
      (await link.getAttribute("aria-label"))?.startsWith("Entry URL: "),
      "Expected participant entry link to expose an Entry URL aria-label"
    );
  };
  const waitForBusy = async stepLabel => {
    try {
      await page.waitForFunction(
        () => {
          const root = document.querySelector(".page");
          return root != null && root.classList.contains("is-busy");
        },
        undefined,
        { timeout: busyStartTimeoutMs }
      );
      return true;
    } catch {
      if (!logBusyStartTimeouts) {
        return false;
      }

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
        undefined,
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
    logStep(`action-${name.replaceAll(" ", "-").toLowerCase()}-start`);
    await waitForNotBusy(`${name}-before-click`);
    const button = page.getByRole("button", { name, exact: true });
    await button.scrollIntoViewIfNeeded();
    await button.click({ force: true });
    const startedBusy = await waitForBusy(`${name}-after-click`);
    if (!startedBusy) {
      await page.waitForTimeout(150);
    }
    await waitForNotBusy(`${name}-after-click`);
    logStep(`action-${name.replaceAll(" ", "-").toLowerCase()}-done`);
  };
  const clickSelectorAction = async (name, selector) => {
    logStep(`action-${name.replaceAll(" ", "-").toLowerCase()}-start`);
    await waitForNotBusy(`${name}-before-click`);
    const button = page.locator(selector);
    await button.scrollIntoViewIfNeeded();
    await button.click();
    const startedBusy = await waitForBusy(`${name}-after-click`);
    if (!startedBusy) {
      await page.waitForTimeout(150);
    }
    await waitForNotBusy(`${name}-after-click`);
    logStep(`action-${name.replaceAll(" ", "-").toLowerCase()}-done`);
  };
  const expectButtonSelectorEnabled = async selector => {
    const button = page.locator(selector);
    await button.waitFor({ timeout: 15_000 });
    assert.equal(await button.isEnabled(), true);
  };
  const expectButtonSelectorDisabled = async selector => {
    const button = page.locator(selector);
    await button.waitFor({ timeout: 15_000 });
    assert.equal(await button.isDisabled(), true);
  };
  const acceptNextDialog = expectedMessagePattern =>
    new Promise((resolvePromise, reject) => {
      page.once("dialog", async dialog => {
        try {
          assert.match(dialog.message(), expectedMessagePattern);
          await dialog.accept();
          resolvePromise(undefined);
        } catch (error) {
          reject(error);
        }
      });
    });
  const clickContentFilterApply = async () => {
    const requestCountBeforeClick = totalApiRequestCount;
    await clickAction("Apply Content Filters");
    if (totalApiRequestCount > requestCountBeforeClick) {
      return;
    }

    logStep("action-apply-content-filters-dom-fallback-start");
    await page
      .locator('[data-content-filter-action="apply"]')
      .evaluate(button => {
        if (button instanceof HTMLButtonElement) {
          button.click();
        }
      });
    await page.waitForTimeout(500);
    logStep("action-apply-content-filters-dom-fallback-done");
  };
  const clickCardAction = async (cardTitle, buttonName, itemHeadline = null) => {
    const stepName = [cardTitle, itemHeadline ?? buttonName]
      .join("-")
      .replaceAll(" ", "-")
      .toLowerCase();
    logStep(`action-${stepName}-start`);
    await waitForNotBusy(`${stepName}-before-click`);
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      try {
        const card = page.locator("article.card").filter({
          has: page.getByRole("heading", { name: cardTitle, exact: true })
        });
        const actionScope = itemHeadline
          ? card.locator(".record-card").filter({
              has: page.getByRole("heading", { name: itemHeadline, exact: true })
            })
          : card;
        await actionScope
          .getByRole("button", { name: buttonName, exact: true })
          .first()
          .click({ force: true });
        break;
      } catch (error) {
        if (String(error?.message).includes("not visible")) {
          await actionScope
            .getByRole("button", { name: buttonName, exact: true })
            .first()
            .evaluate(button => {
              if (button instanceof HTMLButtonElement) {
                button.click();
              }
            });
          break;
        }
        if (attempt === 3 || !String(error?.message).includes("not attached")) {
          throw error;
        }
        await page.waitForTimeout(250);
        await waitForNotBusy(`${stepName}-retry-${attempt}`);
      }
    }
    const startedBusy = await waitForBusy(`${stepName}-after-click`);
    if (!startedBusy) {
      await page.waitForTimeout(150);
    }
    await waitForNotBusy(`${stepName}-after-click`);
    logStep(`action-${stepName}-done`);
  };
  const expectMonitorCommandHistoryCard = async ({
    actorId = "operator-ui",
    commandType,
    groupKey,
    bookletKey = "",
    loginKey,
    participantSessionId,
    testRunId,
    transition
  }) => {
    await page
      .locator("app-record-collection")
      .filter({
        has: page.getByRole("heading", {
          name: "Monitor Command History",
          exact: true
        })
      })
      .locator(".record-card")
      .filter({
        has: page.getByRole("heading", {
          name: `${commandType} command`,
          exact: true
        })
      })
      .filter({ hasText: actorId })
      .filter({ hasText: transition })
      .filter({ hasText: testRunId })
      .filter({ hasText: participantSessionId })
      .filter({ hasText: loginKey })
      .filter({ hasText: groupKey })
      .filter(
        bookletKey ? { hasText: bookletKey } : { hasText: participantSessionId }
      )
      .waitFor({ timeout: 15_000 });
  };
  await page.goto(`${baseUrl}/app`, { waitUntil: "networkidle" });
  await page.waitForURL(/\/app\/workspace$/);
  await page.waitForSelector("h1");
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Workspace Action Queue" })
    })
    .waitFor();
  await waitForNotBusy("initial-load");
  await page.waitForFunction(
    ([expectedPort, expectedAuthMode]) => {
      const authMode = document.querySelector("#authModeBadge")?.textContent?.trim();
      const runtimePort = document
        .querySelector("#runtimePortBadge")
        ?.textContent?.trim();
      const routeCount = Number.parseInt(
        document.querySelector("#routeCountBadge")?.textContent?.trim() ?? "",
        10
      );
      const buildRef = document.querySelector("#buildRefBadge")?.textContent?.trim();
      return (
        authMode === expectedAuthMode &&
        runtimePort === String(expectedPort) &&
        Number.isFinite(routeCount) &&
        routeCount >= 30 &&
        !!buildRef &&
        buildRef !== "unknown"
      );
    },
    [port, process.env.FIRST_SLICE_OPERATOR_AUTH_REQUIRED === "true" ? "required" : "open"],
    { timeout: 15_000 }
  );
  logStep("raw-debug-toggle");
  assert.equal(
    await page.locator(".raw-debug-panel").count(),
    0,
    "Raw debug panels should be hidden by default."
  );
  assert.equal(
    await page.locator("#lastResponse").count(),
    0,
    "The full raw last response should be hidden by default."
  );
  await page.locator("#lastResponsePreview").waitFor();
  await page.locator("#rawDebugToggle").click();
  await page.locator(".raw-debug-panel").first().waitFor();
  await page.locator("#lastResponse").waitFor();
  await page.locator("#rawDebugToggle").click();
  await page.waitForFunction(
    () =>
      document.querySelectorAll(".raw-debug-panel").length === 0 &&
      document.querySelector("#lastResponse") == null,
    undefined,
    { timeout: 10_000 }
  );
  if (await page.locator("#autoRefreshEnabled").isChecked()) {
    logStep("disable-auto-refresh");
    await page.locator("#autoRefreshEnabled").uncheck();
    await page.waitForTimeout(150);
  }

  logStep("nav-ops");
  await page.locator('[data-view-nav="ops"]').click();
  await page.waitForURL(/\/app\/ops$/);
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Ops Action Queue" })
    })
    .waitFor();
  logStep("admin-bootstrap-sign-in");
  await fillAndCommit("#adminUsername", adminUsername);
  await fillAndCommit("#adminDisplayName", "UI Smoke Admin");
  await fillAndCommit("#adminPassword", "");
  await fillAndCommit("#adminSessionToken", "");
  await expectButtonSelectorDisabled("#adminBootstrapOrSignInButton");
  await expectButtonSelectorDisabled("#adminBootstrapButton");
  await expectButtonSelectorDisabled("#adminSignInButton");
  await expectButtonSelectorDisabled("#adminCurrentSessionButton");
  await expectButtonSelectorDisabled("#adminSessionsButton");
  await expectButtonSelectorDisabled("#adminUsersButton");
  await expectButtonSelectorDisabled("#adminAuditEventsButton");
  await expectButtonSelectorDisabled("#adminSignOutButton");
  await expectButtonSelectorDisabled("#applyAdminSessionFiltersButton");
  await expectButtonSelectorDisabled("#exportAdminSessionsCsvButton");
  await expectButtonSelectorDisabled("#applyAdminUserFiltersButton");
  await expectButtonSelectorDisabled("#exportAdminUsersCsvButton");
  await expectButtonSelectorDisabled("#applyAdminAuditFiltersButton");
  await expectButtonSelectorDisabled("#exportAdminAuditCsvButton");
  await fillAndCommit("#adminPassword", adminPassword);
  await expectButtonSelectorEnabled("#adminBootstrapOrSignInButton");
  await expectButtonSelectorEnabled("#adminBootstrapButton");
  await expectButtonSelectorEnabled("#adminSignInButton");
  await clickAction("Bootstrap / Sign In");
  await waitForInputMinLength("#adminSessionToken", 20);
  await expectButtonSelectorEnabled("#adminCurrentSessionButton");
  await expectButtonSelectorEnabled("#adminSessionsButton");
  await expectButtonSelectorEnabled("#adminUsersButton");
  await expectButtonSelectorEnabled("#adminAuditEventsButton");
  await expectButtonSelectorEnabled("#adminSignOutButton");
  await expectButtonSelectorEnabled("#applyAdminSessionFiltersButton");
  await expectButtonSelectorEnabled("#exportAdminSessionsCsvButton");
  await expectButtonSelectorEnabled("#applyAdminUserFiltersButton");
  await expectButtonSelectorEnabled("#exportAdminUsersCsvButton");
  await expectButtonSelectorEnabled("#applyAdminAuditFiltersButton");
  await expectButtonSelectorEnabled("#exportAdminAuditCsvButton");
  smokeAdminSessionToken = await page.locator("#adminSessionToken").inputValue();
  const adminCurrentSessionResponse = await fetch(
    `${baseUrl}/api/v1/admin/auth/current-session`,
    {
      headers: {
        authorization: `Bearer ${smokeAdminSessionToken}`
      }
    }
  );
  assert.equal(adminCurrentSessionResponse.status, 200);
  const adminCurrentSessionPayload = await adminCurrentSessionResponse.json();
  assert.equal(adminCurrentSessionPayload.adminUser.username, adminUsername);
  assert.equal(
    adminCurrentSessionPayload.roleAssignments.some(
      assignment => assignment.role === "platform_admin"
    ),
    true
  );
  logStep("admin-current-session");
  await clickAction("Current Session");
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Admin Session", exact: true })
    })
    .filter({ hasText: "platform_admin" })
    .waitFor();
  logStep("admin-sessions");
  await clickAction("Admin Sessions");
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Admin Sessions", exact: true })
    })
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: "Admin session window" }) })
    .filter({ hasText: "1 admin session row(s) loaded for the current filters" })
    .filter({ hasText: "0 active filter(s)" })
    .filter({ hasText: "limit 100" })
    .filter({ hasText: "Loaded Records" })
    .filter({ hasText: "none" })
    .waitFor();
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Admin Sessions", exact: true })
    })
    .filter({ hasText: adminUsername })
    .filter({ hasText: "active" })
    .waitFor();
  logStep("admin-users");
  await clickAction("Admin Users");
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Admin Users", exact: true })
    })
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: "Admin user window" }) })
    .filter({ hasText: "1 admin user row(s) loaded for the current filters" })
    .filter({ hasText: "0 active filter(s)" })
    .filter({ hasText: "limit 100" })
    .filter({ hasText: "Loaded Records" })
    .filter({ hasText: "none" })
    .waitFor();
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Admin Users", exact: true })
    })
    .filter({ hasText: adminUsername })
    .filter({ hasText: "platform_admin" })
    .waitFor();
  logStep("admin-sign-out");
  await clickAction("Sign Out");
  await expectInputValue("#adminSessionToken", "");
  await expectButtonSelectorDisabled("#adminCurrentSessionButton");
  await expectButtonSelectorDisabled("#adminSessionsButton");
  await expectButtonSelectorDisabled("#adminUsersButton");
  await expectButtonSelectorDisabled("#adminAuditEventsButton");
  await expectButtonSelectorDisabled("#adminSignOutButton");
  await expectButtonSelectorDisabled("#applyAdminSessionFiltersButton");
  await expectButtonSelectorDisabled("#exportAdminSessionsCsvButton");
  await expectButtonSelectorDisabled("#applyAdminUserFiltersButton");
  await expectButtonSelectorDisabled("#exportAdminUsersCsvButton");
  await expectButtonSelectorDisabled("#applyAdminAuditFiltersButton");
  await expectButtonSelectorDisabled("#exportAdminAuditCsvButton");
  smokeAdminSessionToken = "";
  logStep("admin-sign-in");
  await fillAndCommit("#adminPassword", adminPassword);
  await expectButtonSelectorEnabled("#adminSignInButton");
  await clickAction("Sign In");
  await waitForInputMinLength("#adminSessionToken", 20);
  await expectButtonSelectorEnabled("#adminCurrentSessionButton");
  await expectButtonSelectorEnabled("#adminSessionsButton");
  await expectButtonSelectorEnabled("#adminUsersButton");
  await expectButtonSelectorEnabled("#adminAuditEventsButton");
  await expectButtonSelectorEnabled("#adminSignOutButton");
  smokeAdminSessionToken = await page.locator("#adminSessionToken").inputValue();
  assert.notEqual(smokeAdminSessionToken.length, 0);
  logStep("admin-revoke-session");
  await clickAction("Admin Sessions");
  await expectButtonSelectorDisabled("#adminRevokeSessionButton");
  const revokedAdminSessionCard = page
    .locator("article.record-card")
    .filter({ hasText: adminUsername })
    .filter({
      has: page.locator("p", { hasText: /^revoked session / })
    });
  await revokedAdminSessionCard.waitFor();
  await revokedAdminSessionCard.getByRole("button", { name: "Select Session" }).click();
  await waitForInputMinLength("#adminSessionRevokeTargetId", 20);
  await expectButtonSelectorEnabled("#adminRevokeSessionButton");
  const revokeAdminSessionTargetId = await page
    .locator("#adminSessionRevokeTargetId")
    .inputValue();
  const revokeAdminSessionDialog = acceptNextDialog(
    new RegExp(`Revoke admin session '${revokeAdminSessionTargetId}'\\?`)
  );
  await clickAction("Revoke Selected Session");
  await revokeAdminSessionDialog;
  await expectInputValue("#adminSessionRevokeTargetId", "");
  const adminSessionsDownloadPromise = page.waitForEvent("download");
  await clickAction("Export Sessions CSV");
  const adminSessionsDownload = await adminSessionsDownloadPromise;
  assert.equal(adminSessionsDownload.suggestedFilename(), "admin-sessions.csv");
  await page
    .locator("#adminSessionsExportPreview")
    .filter({ hasText: "adminSessionId" })
    .filter({ hasText: "username" })
    .filter({ hasText: "revoked" })
    .waitFor();
  logStep("refresh-diagnostics");
  await clickAction("Refresh Diagnostics");
  const manifestPayload = await pollJsonWithPredicate(
    `${baseUrl}/manifest`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      typeof payload.routes === "object" &&
      payload.routes != null
  );
  const workspaceRouteNames = flattenManifestRouteNames(
    manifestPayload.routes.workspace
  );
  const listedWorkspaceRouteCount = Math.min(workspaceRouteNames.length, 8);
  const hiddenWorkspaceRouteCount = Math.max(
    workspaceRouteNames.length - listedWorkspaceRouteCount,
    0
  );
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Process Metrics", exact: true })
    })
    .waitFor();
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Manifest Capabilities", exact: true })
    })
    .locator(".record-card")
    .filter({ hasText: "Admin Control" })
    .waitFor();
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Manifest Route Groups", exact: true })
    })
    .locator(".record-card")
    .filter({ hasText: "Workspace" })
    .filter({ hasText: "Total Routes" })
    .filter({ hasText: String(workspaceRouteNames.length) })
    .filter({ hasText: "Listed Routes" })
    .filter({ hasText: String(listedWorkspaceRouteCount) })
    .filter({ hasText: "Hidden Routes" })
    .filter({ hasText: String(hiddenWorkspaceRouteCount) })
    .waitFor();
  stopAfter("refresh-diagnostics");

  logStep("nav-workspace-bootstrap");
  await page.locator('[data-view-nav="workspace"]').click();
  await page.waitForURL(/\/app\/workspace$/);
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Workspace Action Queue" })
    })
    .waitFor();
  logStep("fill-workspace-scope");
  await fillAndCommit("#tenantKey", "");
  await fillAndCommit("#workspaceKey", "");
  await expectButtonSelectorDisabled("#createTenantButton");
  await expectButtonSelectorDisabled("#createWorkspaceButton");
  await expectButtonSelectorDisabled("#refreshWorkspaceOverviewButton");
  await expectButtonSelectorDisabled("#refreshStudyMonitorButton");
  await expectButtonSelectorEnabled("#refreshTenantDirectoryButton");
  await expectButtonSelectorDisabled("#refreshWorkspaceDirectoryButton");
  await expectButtonSelectorDisabled("#exportStudyMonitorCsvButton");
  await expectButtonSelectorDisabled("#exportParticipantMatrixCsvButton");
  await expectButtonSelectorDisabled("#exportWorkspaceLogCsvButton");
  await fillAndCommit("#tenantKey", tenantKey);
  await expectButtonSelectorEnabled("#createTenantButton");
  await expectButtonSelectorDisabled("#createWorkspaceButton");
  await expectButtonSelectorDisabled("#refreshWorkspaceOverviewButton");
  await expectButtonSelectorEnabled("#refreshWorkspaceDirectoryButton");
  await fillAndCommit("#workspaceKey", workspaceKey);
  await expectButtonSelectorEnabled("#createWorkspaceButton");
  await expectButtonSelectorEnabled("#refreshWorkspaceOverviewButton");
  await expectButtonSelectorEnabled("#refreshStudyMonitorButton");
  await expectButtonSelectorEnabled("#exportStudyMonitorCsvButton");
  await expectButtonSelectorEnabled("#exportParticipantMatrixCsvButton");
  await expectButtonSelectorEnabled("#exportWorkspaceLogCsvButton");
  logStep("bootstrap-workspace-flow");
  await clickCardAction(
    "Workspace Action Queue",
    "Apply Suggestion",
    "Bootstrap workspace scope"
  );
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
  logStep("workspace-directory-reads");
  await clickAction("Refresh Tenant Directory");
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Tenant Directory", exact: true })
    })
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: "Tenant directory window" }) })
    .filter({ hasText: "1 tenant row(s) loaded for the current directory" })
    .filter({ hasText: "1 loaded" })
    .filter({ hasText: "directory" })
    .filter({ hasText: "Loaded Records" })
    .filter({ hasText: "Selected Tenant" })
    .filter({ hasText: tenantKey })
    .waitFor();
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Tenant Directory", exact: true })
    })
    .filter({ hasText: tenantKey })
    .waitFor();
  await clickAction("Refresh Workspace Directory");
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Workspace Directory", exact: true })
    })
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: "Workspace directory window" }) })
    .filter({ hasText: "1 workspace row(s) loaded for the current directory" })
    .filter({ hasText: "1 loaded" })
    .filter({ hasText: "directory" })
    .filter({ hasText: "Loaded Records" })
    .filter({ hasText: "Tenant Scope" })
    .filter({ hasText: tenantKey })
    .filter({ hasText: "Selected Workspace" })
    .filter({ hasText: workspaceKey })
    .waitFor();
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Workspace Directory", exact: true })
    })
    .filter({ hasText: workspaceKey })
    .waitFor();
  stopAfter("workspace-directory-reads");

  logStep("nav-ops-admin-management");
  await page.locator('[data-view-nav="ops"]').click();
  await page.waitForURL(/\/app\/ops$/);
  await page.locator("#adminCreateUsername").waitFor();
  await fillAndCommit("#adminCreatePassword", "");
  await fillAndCommit("#adminRoleTargetUserId", "");
  await fillAndCommit("#adminRevokeTargetUserId", "");
  await fillAndCommit("#adminRevokeRoleAssignmentId", "");
  await fillAndCommit("#adminResetTargetUserId", "");
  await fillAndCommit("#adminResetPassword", "");
  await fillAndCommit("#adminStatusTargetUserId", "");
  await expectButtonSelectorDisabled("#adminCreateUserButton");
  await expectButtonSelectorDisabled("#adminAssignRoleButton");
  await expectButtonSelectorDisabled("#adminRevokeRoleButton");
  await expectButtonSelectorDisabled("#adminResetPasswordButton");
  await expectButtonSelectorDisabled("#adminUpdateStatusButton");
  const generatedWorkspaceAdminUsername = `ui-workspace-admin-${Date.now()}`;
  const workspaceAdminPassword = "ui-workspace-admin-secret";
  const workspaceAdminResetPassword = "ui-workspace-admin-reset-secret";
  await fillAndCommit("#adminCreateUsername", generatedWorkspaceAdminUsername);
  await fillAndCommit("#adminCreateDisplayName", "UI Workspace Admin");
  await fillAndCommit("#adminCreatePassword", workspaceAdminPassword);
  await selectAndCommit("#adminCreateRole", "workspace_admin");
  await fillAndCommit("#adminCreateTenantKey", tenantKey);
  await fillAndCommit("#adminCreateWorkspaceKey", workspaceKey);
  const workspaceAdminUsername = (
    await page.locator("#adminCreateUsername").inputValue()
  ).trim();
  assert.ok(
    workspaceAdminUsername.length > 0,
    "UI smoke expected a non-empty admin username before creating a workspace admin."
  );
  await expectButtonSelectorEnabled("#adminCreateUserButton");
  logStep("create-workspace-admin");
  await clickAction("Create Admin User");
  const adminUsersAfterCreate = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/admin/users`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.some(
        item =>
          item?.adminUser?.username === workspaceAdminUsername &&
          item?.adminUser?.status === "active" &&
          Array.isArray(item?.roleAssignments) &&
          item.roleAssignments.some(
            roleAssignment => roleAssignment?.role === "workspace_admin"
          )
      )
  );
  const workspaceAdminUserId = adminUsersAfterCreate.items.find(
    item => item?.adminUser?.username === workspaceAdminUsername
  )?.adminUser?.adminUserId;
  assert.ok(
    workspaceAdminUserId,
    "UI smoke expected an adminUserId for the created workspace admin."
  );
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Admin Users", exact: true })
    })
    .filter({ hasText: workspaceAdminUsername })
    .filter({ hasText: "workspace_admin" })
    .waitFor();

  await fillAndCommit("#adminRoleTargetUserId", workspaceAdminUserId);
  await selectAndCommit("#adminRoleRole", "tenant_admin");
  await fillAndCommit("#adminRoleTenantKey", tenantKey);
  await expectButtonSelectorEnabled("#adminAssignRoleButton");
  logStep("assign-tenant-admin-role");
  await clickAction("Assign Role");
  const adminUsersAfterRoleAssign = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/admin/users`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.some(
        item =>
          item?.adminUser?.adminUserId === workspaceAdminUserId &&
          Array.isArray(item?.roleAssignments) &&
          item.roleAssignments.some(
            roleAssignment => roleAssignment?.role === "workspace_admin"
          ) &&
          item.roleAssignments.some(
            roleAssignment => roleAssignment?.role === "tenant_admin"
          )
      )
  );
  const tenantRoleAssignmentId = adminUsersAfterRoleAssign.items
    .find(item => item?.adminUser?.adminUserId === workspaceAdminUserId)
    ?.roleAssignments.find(
      roleAssignment => roleAssignment?.role === "tenant_admin"
    )?.roleAssignmentId;
  assert.ok(
    tenantRoleAssignmentId,
    "UI smoke expected a tenant admin role assignment id after assigning the role."
  );

  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Admin Role Assignments", exact: true })
    })
    .locator(".record-card")
    .filter({
      has: page.getByRole("heading", { name: "Admin role assignment window" })
    })
    .filter({ hasText: "role assignment row(s) loaded from admin users" })
    .filter({ hasText: "source user(s)" })
    .filter({ hasText: "role scopes" })
    .filter({ hasText: "Loaded Assignments" })
    .filter({ hasText: "Source Users" })
    .filter({ hasText: "Selected Assignment" })
    .waitFor();
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Admin Role Assignments", exact: true })
    })
    .filter({ hasText: "tenant_admin" })
    .filter({ hasText: tenantRoleAssignmentId })
    .waitFor();
  await clickCardAction("Admin Role Assignments", "Use For Revoke", "tenant_admin");
  await expectInputValue("#adminRevokeTargetUserId", workspaceAdminUserId);
  await expectInputValue("#adminRevokeRoleAssignmentId", tenantRoleAssignmentId);
  await expectButtonSelectorEnabled("#adminRevokeRoleButton");
  logStep("revoke-tenant-admin-role");
  const revokeAdminRoleDialog = acceptNextDialog(
    new RegExp(
      `Revoke role assignment '${tenantRoleAssignmentId}' from admin user '${workspaceAdminUserId}'\\?`
    )
  );
  await clickAction("Revoke Role");
  await revokeAdminRoleDialog;
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/admin/users`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.some(
        item =>
          item?.adminUser?.adminUserId === workspaceAdminUserId &&
          Array.isArray(item?.roleAssignments) &&
          item.roleAssignments.some(
            roleAssignment => roleAssignment?.role === "workspace_admin"
          ) &&
          !item.roleAssignments.some(
            roleAssignment => roleAssignment?.role === "tenant_admin"
          )
      )
  );

  await fillAndCommit("#adminResetTargetUserId", workspaceAdminUserId);
  await fillAndCommit("#adminResetPassword", workspaceAdminResetPassword);
  await expectButtonSelectorEnabled("#adminResetPasswordButton");
  logStep("reset-workspace-admin-password");
  const resetAdminPasswordDialog = acceptNextDialog(
    new RegExp(`Reset password for admin user '${workspaceAdminUserId}'\\?`)
  );
  await clickAction("Reset Password");
  await resetAdminPasswordDialog;
  const oldWorkspaceAdminPasswordSignIn = await fetch(
    `${baseUrl}/api/v1/admin/auth/sign-in`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: workspaceAdminUsername,
        password: workspaceAdminPassword
      })
    }
  );
  assert.equal(oldWorkspaceAdminPasswordSignIn.status, 401);
  const resetWorkspaceAdminPasswordSignIn = await fetch(
    `${baseUrl}/api/v1/admin/auth/sign-in`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: workspaceAdminUsername,
        password: workspaceAdminResetPassword
      })
    }
  );
  assert.equal(resetWorkspaceAdminPasswordSignIn.status, 200);

  await fillAndCommit("#adminStatusTargetUserId", workspaceAdminUserId);
  await selectAndCommit("#adminStatusValue", "disabled");
  await expectButtonSelectorEnabled("#adminUpdateStatusButton");
  logStep("disable-workspace-admin");
  const updateAdminStatusDialog = acceptNextDialog(
    new RegExp(
      `Change admin user '${workspaceAdminUserId}' status to 'disabled'\\?`
    )
  );
  await clickAction("Update Status");
  await updateAdminStatusDialog;
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/admin/users`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.some(
        item =>
          item?.adminUser?.adminUserId === workspaceAdminUserId &&
          item?.adminUser?.status === "disabled"
      )
  );
  const disabledWorkspaceAdminSignIn = await fetch(
    `${baseUrl}/api/v1/admin/auth/sign-in`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: workspaceAdminUsername,
        password: workspaceAdminResetPassword
      })
    }
  );
  assert.equal(disabledWorkspaceAdminSignIn.status, 401);

  logStep("admin-user-filters");
  await fillAndCommit("#adminUserUsernameFilter", "workspace");
  await selectAndCommit("#adminUserStatusFilter", "disabled");
  await selectAndCommit("#adminUserRoleFilter", "workspace_admin");
  await fillAndCommit("#adminUserTenantFilter", tenantKey);
  await fillAndCommit("#adminUserWorkspaceFilter", workspaceKey);
  await fillAndCommit("#adminUserLimit", "1");
  await clickAction("Apply User Filters");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/admin/users?username=workspace&status=disabled&role=workspace_admin&tenantKey=${tenantKey}&workspaceKey=${workspaceKey}&limit=1`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.length === 1 &&
      payload.items.every(
        item =>
          item?.adminUser?.adminUserId === workspaceAdminUserId &&
          item?.adminUser?.status === "disabled"
      )
  );
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Admin Users", exact: true })
    })
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: "Admin user window" }) })
    .filter({ hasText: "1 admin user row(s) loaded for the current filters" })
    .filter({ hasText: "5 active filter(s)" })
    .filter({ hasText: "limit 1" })
    .filter({ hasText: "Loaded Records" })
    .filter({ hasText: "username, status, role, tenant, workspace" })
    .waitFor();
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Admin Users", exact: true })
    })
    .filter({ hasText: workspaceAdminUserId })
    .filter({ hasText: "disabled" })
    .waitFor();
  const adminUsersDownloadPromise = page.waitForEvent("download");
  await page.locator("#exportAdminUsersCsvButton").click();
  const adminUsersDownload = await adminUsersDownloadPromise;
  assert.equal(adminUsersDownload.suggestedFilename(), "admin-users.csv");
  await page
    .locator("#adminUsersExportPreview")
    .filter({ hasText: "adminUserId" })
    .filter({ hasText: workspaceAdminUsername })
    .filter({ hasText: "workspace_admin" })
    .waitFor({ timeout: 15_000 });

  logStep("admin-audit-events");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/admin/audit-events`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.some(
        item =>
          item?.eventType === "admin_user_updated" &&
          item?.subjectAdminUserId === workspaceAdminUserId
      ) &&
      payload.items.some(item => item?.eventType === "admin_role_revoked")
  );
  await selectAndCommit("#adminAuditEventTypeFilter", "admin_user_updated");
  await fillAndCommit("#adminAuditSubjectFilter", workspaceAdminUserId);
  await fillAndCommit("#adminAuditLimit", "1");
  await clickAction("Apply Audit Filters");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/admin/audit-events?eventType=admin_user_updated&subjectAdminUserId=${workspaceAdminUserId}&limit=1`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.length === 1 &&
      payload.items.every(
        item =>
          item?.eventType === "admin_user_updated" &&
          item?.subjectAdminUserId === workspaceAdminUserId
      )
  );
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Admin Audit Events", exact: true })
    })
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: "Admin audit window" }) })
    .filter({ hasText: "1 admin audit event row(s) loaded for the current filters" })
    .filter({ hasText: "2 active filter(s)" })
    .filter({ hasText: "limit 1" })
    .filter({ hasText: "Loaded Records" })
    .filter({ hasText: "event type, subject" })
    .waitFor();
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Admin Audit Events", exact: true })
    })
    .filter({ hasText: "admin_user_updated" })
    .filter({ hasText: workspaceAdminUserId })
    .waitFor();
  await clickCardAction("Admin Audit Events", "Use Audit Scope", "admin_user_updated");
  await expectInputValue("#adminAuditSubjectFilter", workspaceAdminUserId);
  await expectInputValue("#adminStatusTargetUserId", workspaceAdminUserId);
  const adminAuditDownloadPromise = page.waitForEvent("download");
  await page.locator("#exportAdminAuditCsvButton").click();
  const adminAuditDownload = await adminAuditDownloadPromise;
  assert.equal(
    adminAuditDownload.suggestedFilename(),
    "admin-audit-events.csv"
  );
  await page
    .locator("#adminAuditExportPreview")
    .filter({ hasText: "adminAuditEventId" })
    .filter({ hasText: "admin_user_updated" })
    .filter({ hasText: workspaceAdminUserId })
    .waitFor({ timeout: 15_000 });
  stopAfter("admin-audit-events");

  logStep("nav-content");
  await page.locator('[data-view-nav="content"]').click();
  await page.waitForURL(/\/app\/content$/);
  await page.locator("#sourceFileName").waitFor();
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Content Action Queue" })
    })
    .waitFor();
  await expectButtonSelectorEnabled("#createSourcePackageButton");
  await expectButtonSelectorEnabled("#refreshContentReadsButton");
  await expectButtonSelectorEnabled("#applyContentReadFiltersButton");
  await expectButtonSelectorEnabled("#useSelectedIdsAsContentReadFiltersButton");
  await expectButtonSelectorDisabled("#createImportJobButton");
  await expectButtonSelectorDisabled("#activateContentReleaseButton");
  await expectButtonSelectorDisabled("#sourcePackageDetailButton");
  await expectButtonSelectorDisabled("#importJobDetailButton");
  await expectButtonSelectorDisabled("#downloadSourceDocumentButton");
  await expectButtonSelectorDisabled("#participantSessionDetailButton");
  await expectButtonSelectorDisabled("#releaseReadinessButton");
  await expectButtonSelectorDisabled("#releaseDetailButton");
  await expectButtonSelectorDisabled("#retrySourcePackageImportButton");
  logStep("load-zip-source-document-file");
  const uploadedZipSourceFileName = `ui-smoke-source-${Date.now()}.zip`;
  const uploadedZipSourcePath = resolve(".data", uploadedZipSourceFileName);
  await mkdir(dirname(uploadedZipSourcePath), { recursive: true });
  await writeFile(
    uploadedZipSourcePath,
    createStoredZipBuffer([
      {
        fileName: "imsmanifest.xml",
        content:
          '<manifest><organizations default="ORG"><organization identifier="ORG"><item identifierref="BOOKLET"><item identifierref="UNIT" /></item></organization></organizations><resources><resource identifier="BOOKLET" href="booklets/ui-zip.xml" /><resource identifier="UNIT" href="units/ui-zip.xml" /></resources></manifest>'
      }
    ])
  );
  await page.locator("#sourceDocumentFile").setInputFiles(uploadedZipSourcePath);
  await page.waitForFunction(
    expectedFileName => {
      const sourceFileName = document.querySelector("#sourceFileName");
      const sourceMediaType = document.querySelector("#sourceMediaType");
      const sourceDocument = document.querySelector("#sourceDocument");
      return (
        sourceFileName instanceof HTMLInputElement &&
        sourceFileName.value === expectedFileName &&
        sourceMediaType instanceof HTMLInputElement &&
        sourceMediaType.value === "application/zip" &&
        sourceDocument instanceof HTMLTextAreaElement &&
        sourceDocument.value.startsWith("data:") &&
        sourceDocument.value.includes(";base64,")
      );
    },
    uploadedZipSourceFileName,
    { timeout: 15_000 }
  );
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Draft Source Document Preview" })
    })
    .filter({ hasText: uploadedZipSourceFileName })
    .filter({ hasText: "ZIP package source document" })
    .waitFor();
  const persistedAfterZipLoad = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("testcenter-rewrite-app-shell") ?? "{}")
  );
  assert.equal(persistedAfterZipLoad.sourceFileName, uploadedZipSourceFileName);
  assert.equal(persistedAfterZipLoad.sourceMediaType, "application/zip");
  assert.equal(persistedAfterZipLoad.sourceDocument, "");
  logStep("download-zip-source-document");
  await expectButtonSelectorEnabled("#createSourcePackageButton");
  await page.locator("#createSourcePackageButton").click();
  await page.waitForFunction(
    () => {
      const sourcePackageId = document.querySelector("#sourcePackageId");
      return (
        sourcePackageId instanceof HTMLInputElement &&
        sourcePackageId.value.trim() !== ""
      );
    },
    undefined,
    { timeout: 15_000 }
  );
  await expectButtonSelectorEnabled("#downloadSourceDocumentButton");
  const zipDownloadPromise = page.waitForEvent("download");
  await page.locator("#downloadSourceDocumentButton").click();
  const zipDownload = await zipDownloadPromise;
  assert.equal(zipDownload.suggestedFilename(), uploadedZipSourceFileName);
  const downloadedZipPath = resolve(
    ".data",
    `downloaded-${uploadedZipSourceFileName}`
  );
  await zipDownload.saveAs(downloadedZipPath);
  const downloadedZip = await readFile(downloadedZipPath);
  assert.equal(downloadedZip.readUInt32LE(0), 0x04034b50);
  await fillAndCommit("#sourcePackageId", "");
  await fillAndCommit("#importJobId", "");
  await fillAndCommit("#contentReleaseId", "");
  logStep("load-source-document-file");
  const uploadedSourceFileName = `ui-smoke-source-${Date.now()}.imsmanifest`;
  const uploadedSourcePath = resolve(".data", uploadedSourceFileName);
  await mkdir(dirname(uploadedSourcePath), { recursive: true });
  await writeFile(uploadedSourcePath, uploadedSourceDocument, "utf8");
  await page.locator("#sourceDocumentFile").setInputFiles(uploadedSourcePath);
  await page.waitForFunction(
    ([expectedFileName, expectedMediaType, expectedDocument]) => {
      const sourceFileName = document.querySelector("#sourceFileName");
      const sourceMediaType = document.querySelector("#sourceMediaType");
      const sourceDocument = document.querySelector("#sourceDocument");
      return (
        sourceFileName instanceof HTMLInputElement &&
        sourceFileName.value === expectedFileName &&
        sourceMediaType instanceof HTMLInputElement &&
        sourceMediaType.value === expectedMediaType &&
        sourceDocument instanceof HTMLTextAreaElement &&
        sourceDocument.value === expectedDocument
      );
    },
    [uploadedSourceFileName, "application/xml", uploadedSourceDocument],
    { timeout: 15_000 }
  );
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Draft Source Document Preview" })
    })
    .filter({ hasText: uploadedSourceFileName })
    .filter({ hasText: "1 inferred booklet(s)" })
    .waitFor();
  logStep("import-and-activate-flow");
  await clickCardAction(
    "Content Action Queue",
    "Apply Suggestion",
    "Create source package"
  );
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.length > 0
  );
  await expectButtonSelectorEnabled("#createImportJobButton");
  await expectButtonSelectorEnabled("#sourcePackageDetailButton");
  await expectButtonSelectorEnabled("#downloadSourceDocumentButton");
  await expectButtonSelectorDisabled("#retrySourcePackageImportButton");
  await expectButtonSelectorDisabled("#activateContentReleaseButton");
  await clickAction("Create Import Job");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.some(item => item?.contentRelease?.status === "staged")
  );
  await expectButtonSelectorEnabled("#importJobDetailButton");
  await expectButtonSelectorEnabled("#activateContentReleaseButton");
  await expectButtonSelectorEnabled("#releaseReadinessButton");
  await expectButtonSelectorEnabled("#releaseDetailButton");
  await clickAction("Activate Release");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.some(item => item?.contentRelease?.status === "active")
  );
  await page
    .locator("app-record-collection")
    .filter({ has: page.getByRole("heading", { name: "Activation Guard Result" }) })
    .filter({ hasText: "Activation readiness" })
    .filter({ hasText: "ready" })
    .filter({ hasText: "guarded" })
    .waitFor();
  logStep("content-prompt-read-model");
  await clickAction("Source Package Detail");
  await clickAction("Release Detail");
  const sourceDocumentDownloadPromise = page.waitForEvent("download");
  await page.locator("#downloadSourceDocumentButton").click();
  const sourceDocumentDownload = await sourceDocumentDownloadPromise;
  assert.equal(sourceDocumentDownload.suggestedFilename(), uploadedSourceFileName);
  await page.waitForFunction(
    () => {
      const bodyText = document.body.textContent ?? "";
      return (
        bodyText.includes("Prompt Coverage") &&
        bodyText.includes("1 / 3 prompt(s), 1 / 3 description(s)") &&
        bodyText.includes("Participant Route: Read the participant prompt.") &&
        bodyText.includes("Explain how the starter example works.")
      );
    },
    undefined,
    { timeout: 15_000 }
  );
  stopAfter("content-prompt-read-model");

  logStep("participant-entry-ambiguous-workspace-guidance");
  const ambiguousParticipantWorkspaceKey = `ui-ambiguous-workspace-${Date.now()}`;
  const ambiguousParticipantTenantA = `ui-ambiguous-tenant-a-${Date.now()}`;
  const ambiguousParticipantTenantB = `ui-ambiguous-tenant-b-${Date.now()}`;
  await sendSmokeJson(`${baseUrl}/api/v1/platform/tenants`, {
    body: {
      tenantKey: ambiguousParticipantTenantA,
      displayName: "UI Ambiguous Tenant A"
    }
  });
  await sendSmokeJson(`${baseUrl}/api/v1/platform/tenants`, {
    body: {
      tenantKey: ambiguousParticipantTenantB,
      displayName: "UI Ambiguous Tenant B"
    }
  });
  await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${ambiguousParticipantTenantA}/workspaces`,
    {
      body: {
        workspaceKey: ambiguousParticipantWorkspaceKey,
        displayName: "UI Ambiguous Workspace A"
      }
    }
  );
  await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${ambiguousParticipantTenantB}/workspaces`,
    {
      body: {
        workspaceKey: ambiguousParticipantWorkspaceKey,
        displayName: "UI Ambiguous Workspace B"
      }
    }
  );
  await page.goto(`${baseUrl}/participant`, { waitUntil: "networkidle" });
  await page.locator("#participantLoginKey").waitFor();
  await page.evaluate(() => {
    const storageKey = "testcenter-rewrite-app-shell";
    const snapshot = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}");
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        ...snapshot,
        tenantKey: "",
        workspaceKey: "",
        loginKey: "",
        participantSessionId: "",
        testRunId: "",
        currentRunStateView: ""
      })
    );
  });
  await page.goto(`${baseUrl}/participant`, { waitUntil: "networkidle" });
  await page.locator("#participantLoginKey").waitFor();
  await fillAndCommitUntilValue("#participantTenantKey", "");
  await fillAndCommitUntilValue("#participantWorkspaceKey", "");
  await fillAndCommitUntilValue("#participantLoginKey", "");
  await expectButtonSelectorDisabled("#participantRouteSignInButton");
  await expectButtonSelectorDisabled("#participantRouteStartOrResumeButton");
  await expectButtonSelectorDisabled("#participantRouteRefreshCurrentStateButton");
  await expectButtonSelectorDisabled("#participantRouteClearSessionButton");
  await fillAndCommitUntilValue(
    "#participantWorkspaceKey",
    ambiguousParticipantWorkspaceKey
  );
  await expectButtonSelectorDisabled("#participantRouteSignInButton");
  await expectButtonSelectorDisabled("#participantRouteStartOrResumeButton");
  await fillAndCommitUntilValue(
    "#participantLoginKey",
    "ambiguous-entry-student"
  );
  await expectButtonSelectorEnabled("#participantRouteSignInButton");
  await expectButtonSelectorEnabled("#participantRouteStartOrResumeButton");
  await expectButtonSelectorDisabled("#participantRouteRefreshCurrentStateButton");
  await page.locator("#participantRouteSignInButton").click();
  await page
    .locator(".status-banner.is-error")
    .filter({ hasText: "Workspace key" })
    .filter({ hasText: "multiple tenants" })
    .waitFor({ timeout: 15_000 });
  await page
    .locator("#participantEntryIssueTitle")
    .filter({ hasText: "Tenant key required" })
    .waitFor();
  await page
    .locator("#participantEntryIssueDetail")
    .filter({ hasText: ambiguousParticipantWorkspaceKey })
    .filter({ hasText: "2 tenants" })
    .waitFor();
  await page
    .locator("#participantEntryIssueAction")
    .filter({ hasText: "Enter the assigned tenant key" })
    .waitFor();
  await page
    .locator("#participantEntryIssueCode")
    .filter({ hasText: "participant_workspace_ambiguous" })
    .waitFor();
  stopAfter("participant-entry-ambiguous-workspace-guidance");

  logStep("participant-entry-invalid-booklet-guidance");
  await page.goto(`${baseUrl}/participant`, { waitUntil: "networkidle" });
  await page.locator("#participantLoginKey").waitFor();
  await fillAndCommitUntilValue("#participantTenantKey", tenantKey);
  await fillAndCommitUntilValue("#participantWorkspaceKey", workspaceKey);
  await fillAndCommitUntilValue(
    "#participantLoginKey",
    "invalid-booklet-entry-student"
  );
  await fillAndCommitUntilValue(
    "#participantRouteGroupKey",
    "group:invalid-booklet-entry"
  );
  await fillAndCommitUntilValue("#participantRouteBookletKey", "booklet:missing");
  await page.getByRole("button", { name: "Start Or Resume" }).click();
  await page
    .locator("#participantEntryIssueTitle")
    .filter({ hasText: "Assigned booklet unavailable" })
    .waitFor({ timeout: 15_000 });
  await page
    .locator("#participantEntryIssueDetail")
    .filter({ hasText: "booklet:missing" })
    .waitFor();
  await page
    .locator("#participantEntryIssueAction")
    .filter({ hasText: "update the roster assignment" })
    .waitFor();
  await page
    .locator("#participantEntryIssueCode")
    .filter({ hasText: "booklet_not_found" })
    .waitFor();
  stopAfter("participant-entry-invalid-booklet-guidance");

  logStep("participant-entry-sign-in");
  const participantEntrySignInLoginKey = "student-entry-sign-in";
  const participantEntrySignInGroupKey = "group:participant-entry-sign-in";
  await page.goto(`${baseUrl}/participant`, { waitUntil: "networkidle" });
  await page.locator("#participantLoginKey").waitFor();
  await fillAndCommitUntilValue("#participantTenantKey", tenantKey);
  await fillAndCommitUntilValue("#participantWorkspaceKey", workspaceKey);
  await fillAndCommitUntilValue("#participantLoginKey", participantEntrySignInLoginKey);
  await fillAndCommitUntilValue(
    "#participantRouteGroupKey",
    participantEntrySignInGroupKey
  );
  await fillAndCommitUntilValue("#participantRouteBookletKey", "");
  await page.locator("#participantRouteSignInButton").click();
  const participantEntrySignInSessionsPayload = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-sessions`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.some(item => {
        const participantSession = item?.participantSession;
        return (
          participantSession?.loginKey === participantEntrySignInLoginKey &&
          participantSession?.groupKey === participantEntrySignInGroupKey &&
          participantSession?.status === "signed_in"
        );
      })
  );
  const participantEntrySignInSessionId =
    participantEntrySignInSessionsPayload.items.find(item => {
      const participantSession = item?.participantSession;
      return participantSession?.loginKey === participantEntrySignInLoginKey;
    })?.participantSession?.participantSessionId;
  assert.ok(
    participantEntrySignInSessionId,
    "UI smoke expected participant Sign In to create a signed-in session."
  );
  await expectInputValue("#participantRouteSessionId", participantEntrySignInSessionId);
  await expectButtonSelectorEnabled("#participantRouteStartOrResumeButton");
  await expectButtonSelectorEnabled("#participantRouteRefreshCurrentStateButton");
  await expectButtonSelectorEnabled("#participantRouteClearSessionButton");
  await page.waitForFunction(
    expectedSessionId =>
      document.querySelector("#participantRouteSessionLabel")?.textContent?.trim() ===
        expectedSessionId &&
      document.querySelector("#participantRouteStatus")?.textContent?.trim() ===
        "signed_in" &&
      document.querySelector("#participantRouteRunId")?.textContent?.trim() ===
        "no run yet" &&
      document.querySelector("#participantEntryNextStep")?.textContent?.includes(
        "Start test"
      ),
    participantEntrySignInSessionId,
    { timeout: 15_000 }
  );
  assert.equal(
    await page.locator("#participantEntryIssueCode").count(),
    0,
    "Participant entry issue guidance should clear after a successful sign-in."
  );
  stopAfter("participant-entry-sign-in");
  logStep("participant-entry-start-after-sign-in");
  await page.getByRole("button", { name: "Start Or Resume" }).click();
  const participantEntryStartedPayload = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${participantEntrySignInSessionId}/current-state`,
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
  const participantEntryStartedRunId =
    participantEntryStartedPayload.currentRunState.testRun.testRunId;
  await page.waitForFunction(
    ([expectedSessionId, expectedRunId]) =>
      document.querySelector("#participantRouteSessionLabel")?.textContent?.trim() ===
        expectedSessionId &&
      document.querySelector("#participantRouteStatus")?.textContent?.trim() ===
        "running" &&
      document.querySelector("#participantRouteRunId")?.textContent?.trim() ===
        expectedRunId &&
      document.querySelector("#participantEntryNextStep")?.textContent?.includes(
        "Answer current unit"
      ),
    [participantEntrySignInSessionId, participantEntryStartedRunId],
    { timeout: 15_000 }
  );
  stopAfter("participant-entry-start-after-sign-in");

  logStep("participant-entry-url");
  const participantRouteLoginKey = "student-participant-route";
  const participantRouteGroupKey = "group:participant-route-smoke";
  const participantRouteBookletKey = "booklet:starter";
  const participantRouteFirstUnitKey = "unit-1";
  const participantRouteUnitKey = "unit-participant-route";
  const participantRouteNextUnitKey = "unit-paused";
  const participantRouteFirstUnitResponse = "Final unit response before complete";
  const participantRouteUnitResponse = "Prefilled participant route response";
  const participantRouteNextUnitResponse = "Second unit participant response";
  await page.goto(
    `${baseUrl}/participant?tenantKey=${encodeURIComponent(
      tenantKey
    )}&workspaceKey=${encodeURIComponent(
      workspaceKey
    )}&loginKey=${encodeURIComponent(participantRouteLoginKey)}&groupKey=${encodeURIComponent(
      participantRouteGroupKey
    )}&bookletKey=${encodeURIComponent(
      participantRouteBookletKey
    )}&currentUnitKey=${encodeURIComponent(
      participantRouteUnitKey
    )}&unitResponse=${encodeURIComponent(
      participantRouteUnitResponse
    )}`,
    { waitUntil: "networkidle" }
  );
  await page.locator("#participantLoginKey").waitFor();
  await page.getByRole("heading", { name: "Participant Test" }).waitFor();
  assert.equal(
    await page.locator('[data-view-nav="runtime"]').count(),
    0,
    "Participant route should not expose operator navigation."
  );
  assert.equal(
    await page.locator("#rawDebugToggle").count(),
    0,
    "Participant route should not expose the raw debug toggle."
  );
  await expectInputValue("#participantTenantKey", tenantKey);
  await expectInputValue("#participantWorkspaceKey", workspaceKey);
  await expectInputValue("#participantLoginKey", participantRouteLoginKey);
  await expectInputValue("#participantRouteGroupKey", participantRouteGroupKey);
  await expectInputValue("#participantRouteBookletKey", participantRouteBookletKey);
  await expectInputValue("#participantRouteCurrentUnitKey", participantRouteUnitKey);
  await expectInputValue(
    "#participantRouteUnitResponse",
    participantRouteUnitResponse
  );
  logStep("participant-route-auto-start");
  const participantRouteSessionsUrl = `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-sessions`;
  const participantRouteSessionsPayload = await pollJsonWithPredicate(
    participantRouteSessionsUrl,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.some(item => {
        const participantSession = item?.participantSession;
        return (
          participantSession?.loginKey === participantRouteLoginKey &&
          participantSession?.groupKey === participantRouteGroupKey &&
          typeof participantSession?.participantSessionId === "string" &&
          participantSession.participantSessionId.length > 0
        );
      })
  );
  const participantRouteSessionId = participantRouteSessionsPayload.items.find(item => {
    const participantSession = item?.participantSession;
    return participantSession?.loginKey === participantRouteLoginKey;
  })?.participantSession?.participantSessionId;
  assert.ok(
    participantRouteSessionId,
    "UI smoke expected a participant route session id after opening the entry URL."
  );
  const participantRouteSessionLink = `${baseUrl}/participant?${new URLSearchParams({
    participantSessionId: participantRouteSessionId,
    tenantKey,
    workspaceKey,
    loginKey: participantRouteLoginKey,
    groupKey: participantRouteGroupKey,
    bookletKey: participantRouteBookletKey
  }).toString()}`;
  await expectInputValue("#participantRouteSessionId", participantRouteSessionId);
  await expectInputValue("#participantRouteSessionLink", participantRouteSessionLink);
  const participantRouteSessionAnchor = page.locator("#participantRouteSessionAnchor");
  assert.equal(
    await participantRouteSessionAnchor.getAttribute("href"),
    participantRouteSessionLink,
    "Participant route should expose a direct session re-entry link."
  );
  assert.equal(await participantRouteSessionAnchor.getAttribute("target"), "_blank");
  assert.equal(await participantRouteSessionAnchor.getAttribute("rel"), "noreferrer");
  assert.equal(
    await participantRouteSessionAnchor.getAttribute("aria-label"),
    `Session Re-Entry: ${participantRouteSessionLink}`
  );
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${participantRouteSessionId}/current-state`,
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
  await page.waitForFunction(
    ([expectedLoginKey, expectedGroupKey, expectedSessionId]) =>
      document.querySelector("#participantRouteStatus")?.textContent?.trim() ===
        "running" &&
      document.querySelector("#participantEntryStatus")?.textContent?.trim() ===
        "running" &&
      document.querySelector("#participantRouteLoginLabel")?.textContent?.trim() ===
        expectedLoginKey &&
      document.querySelector("#participantRouteGroupLabel")?.textContent?.trim() ===
        expectedGroupKey &&
      document.querySelector("#participantRouteSessionLabel")?.textContent?.trim() ===
        expectedSessionId &&
      document.querySelector("#participantRouteUnitDescription")?.textContent?.trim() ===
        "Read the participant prompt." &&
      document.querySelector("#participantRouteUnitContent")?.textContent?.trim() ===
        "Explain how the starter example works.",
    [
      participantRouteLoginKey,
      participantRouteGroupKey,
      participantRouteSessionId
    ],
    { timeout: 15_000 }
  );
  await clickAction("Save Paused");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${participantRouteSessionId}/current-state`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      "currentRunState" in payload &&
      typeof payload.currentRunState === "object" &&
      payload.currentRunState != null &&
      typeof payload.currentRunState.testRun === "object" &&
      payload.currentRunState.testRun != null &&
      payload.currentRunState.testRun.status === "paused" &&
      payload.currentRunState.testRun.currentUnitKey === participantRouteUnitKey &&
      payload.currentRunState.testRun.unitResponses?.[participantRouteUnitKey] ===
        participantRouteUnitResponse
  );
  await page.waitForFunction(
    ([expectedUnitKey, expectedResponse]) =>
      document.querySelector("#participantRouteStatus")?.textContent?.trim() ===
        "paused" &&
      document.querySelector("#participantRouteUnitKey")?.textContent?.trim() ===
        expectedUnitKey &&
      document.querySelector("#participantRouteUnitResponse")?.value ===
        expectedResponse &&
      document
        .querySelector("#participantRouteActions")
        ?.textContent?.includes("resume"),
    [participantRouteUnitKey, participantRouteUnitResponse],
    { timeout: 15_000 }
  );
  await clickAction("Resume Run");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${participantRouteSessionId}/current-state`,
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
  await page.waitForFunction(
    ([expectedUnitKey, expectedNextUnitKey]) =>
      document.querySelector("#participantRouteUnitKey")?.textContent?.trim() ===
        expectedUnitKey &&
      document
        .querySelector(
          `#participantRouteUnitRail [data-unit-key="${expectedNextUnitKey}"]`
        )
        ?.textContent?.includes("Paused Work"),
    [participantRouteUnitKey, participantRouteNextUnitKey],
    { timeout: 15_000 }
  );
  logStep("participant-route-unit-next");
  await clickAction("Next Unit");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${participantRouteSessionId}/current-state`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      "currentRunState" in payload &&
      typeof payload.currentRunState === "object" &&
      payload.currentRunState != null &&
      typeof payload.currentRunState.testRun === "object" &&
      payload.currentRunState.testRun != null &&
      payload.currentRunState.testRun.status === "running" &&
      payload.currentRunState.testRun.currentUnitKey ===
        participantRouteNextUnitKey &&
      payload.currentRunState.testRun.unitResponses?.[participantRouteUnitKey] ===
        participantRouteUnitResponse
  );
  await page.waitForFunction(
    ([expectedUnitKey]) =>
      document.querySelector("#participantRouteUnitKey")?.textContent?.trim() ===
        expectedUnitKey &&
      document.querySelector("#participantRouteUnitPosition")?.textContent?.trim() ===
        "3 / 3" &&
      document.querySelector("#participantRouteUnitResponse")?.value === "",
    [participantRouteNextUnitKey],
    { timeout: 15_000 }
  );
  await fillAndCommit(
    "#participantRouteUnitResponse",
    participantRouteNextUnitResponse
  );
  await page
    .locator("#participantRouteDraftLabel")
    .filter({ hasText: "Unsaved draft" })
    .waitFor();
  await page
    .locator("#participantRouteDraftDetail")
    .filter({ hasText: "Complete Test saves this draft" })
    .waitFor();
  logStep("participant-route-unit-previous");
  await clickAction("Previous Unit");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${participantRouteSessionId}/current-state`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      "currentRunState" in payload &&
      typeof payload.currentRunState === "object" &&
      payload.currentRunState != null &&
      typeof payload.currentRunState.testRun === "object" &&
      payload.currentRunState.testRun != null &&
      payload.currentRunState.testRun.status === "running" &&
      payload.currentRunState.testRun.currentUnitKey === participantRouteUnitKey &&
      payload.currentRunState.testRun.unitResponses?.[participantRouteUnitKey] ===
        participantRouteUnitResponse &&
      payload.currentRunState.testRun.unitResponses?.[
        participantRouteNextUnitKey
      ] === participantRouteNextUnitResponse
  );
  await page.waitForFunction(
    ([expectedUnitKey, expectedResponse]) =>
      document.querySelector("#participantRouteUnitKey")?.textContent?.trim() ===
        expectedUnitKey &&
      document.querySelector("#participantRouteUnitPosition")?.textContent?.trim() ===
        "2 / 3" &&
      document.querySelector("#participantRouteUnitResponse")?.value ===
        expectedResponse,
    [participantRouteUnitKey, participantRouteUnitResponse],
    { timeout: 15_000 }
  );
  logStep("participant-entry-reentry");
  await page.goto(
    `${baseUrl}/participant?workspaceKey=${encodeURIComponent(
      workspaceKey
    )}&loginKey=${encodeURIComponent(participantRouteLoginKey)}&groupKey=${encodeURIComponent(
      participantRouteGroupKey
    )}&bookletKey=${encodeURIComponent(
      participantRouteBookletKey
    )}`,
    { waitUntil: "networkidle" }
  );
  await expectInputValue("#participantRouteGroupKey", participantRouteGroupKey);
  await expectInputValue("#participantRouteBookletKey", participantRouteBookletKey);
  await page.locator("#participantLoginKey").waitFor();
  await expectInputValue("#participantRouteSessionId", participantRouteSessionId);
  await page.waitForFunction(
    ([expectedSessionId]) =>
      document.querySelector("#participantRouteSessionId")?.value ===
        expectedSessionId &&
      document.querySelector("#participantRouteStatus")?.textContent?.trim() ===
        "running",
    [participantRouteSessionId],
    { timeout: 15_000 }
  );
  const participantRouteReentryPayload = await pollJsonWithPredicate(
    participantRouteSessionsUrl,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.filter(item => {
        const participantSession = item?.participantSession;
        return participantSession?.loginKey === participantRouteLoginKey;
      }).length === 1
  );
  const participantRouteReentrySessionId =
    participantRouteReentryPayload.items.find(item => {
      const participantSession = item?.participantSession;
      return participantSession?.loginKey === participantRouteLoginKey;
    })?.participantSession?.participantSessionId;
  assert.equal(
    participantRouteReentrySessionId,
    participantRouteSessionId,
    "UI smoke expected participant re-entry to reuse the open session."
  );
  logStep("participant-route-complete-autosaves-current-draft");
  await clickAction("Previous Unit");
  await page.waitForFunction(
    ([expectedUnitKey]) =>
      document.querySelector("#participantRouteUnitKey")?.textContent?.trim() ===
        expectedUnitKey &&
      document.querySelector("#participantRouteUnitResponse")?.value === "",
    [participantRouteFirstUnitKey],
    { timeout: 15_000 }
  );
  await fillAndCommit(
    "#participantRouteUnitResponse",
    participantRouteFirstUnitResponse
  );
  await page
    .locator("#participantRouteDraftDetail")
    .filter({ hasText: "Complete Test saves this draft before closing" })
    .waitFor();
  await page
    .locator("#participantRouteCompletionReadinessLabel")
    .filter({ hasText: "Ready to complete" })
    .waitFor();
  await page
    .locator("#participantRouteCompletionReadinessDetail")
    .filter({
      hasText: "All units will be answered after Complete Test saves the current draft."
    })
    .waitFor();
  await clickAction("Complete Test");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${participantRouteSessionId}/current-state`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      "currentRunState" in payload &&
      typeof payload.currentRunState === "object" &&
      payload.currentRunState != null &&
      typeof payload.currentRunState.testRun === "object" &&
      payload.currentRunState.testRun != null &&
      payload.currentRunState.testRun.status === "completed" &&
      payload.currentRunState.testRun.unitResponses?.[
        participantRouteFirstUnitKey
      ] === participantRouteFirstUnitResponse
  );
  await page.waitForFunction(
    () =>
      document.querySelector("#participantRouteStatus")?.textContent?.trim() ===
        "completed" &&
      document.querySelector("#participantEntryStatus")?.textContent?.trim() ===
        "completed" &&
      document.querySelector("#participantRouteProgressLabel")?.textContent?.trim() ===
        "3 / 3 responses saved" &&
      document.querySelector("#participantRouteMissingLabel")?.textContent?.trim() ===
        "All units have a saved response." &&
      document
        .querySelector("#participantRouteCompletionReadinessLabel")
        ?.textContent?.trim() === "Complete" &&
      document
        .querySelector("#participantRouteCompletionReadinessDetail")
        ?.textContent?.includes("closed and ready for operator review") &&
      document
        .querySelector("#participantRouteCompletionLabel")
        ?.textContent?.includes("Completed"),
    undefined,
    { timeout: 15_000 }
  );
  logStep("participant-entry-completed-session-reentry");
  await page.evaluate(() => {
    const storageKey = "testcenter-rewrite-app-shell";
    const snapshot = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}");
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        ...snapshot,
        tenantKey: "stale-tenant-before-reentry",
        workspaceKey: "stale-workspace-before-reentry",
        loginKey: "stale-login-before-reentry",
        groupKey: "stale-group-before-reentry",
        bookletKey: "stale-booklet-before-reentry"
      })
    );
  });
  await page.goto(
    `${baseUrl}/participant?participantSessionId=${encodeURIComponent(
      participantRouteSessionId
    )}`,
    { waitUntil: "networkidle" }
  );
  await page.locator("#participantLoginKey").waitFor();
  await expectInputValue("#participantRouteSessionId", participantRouteSessionId);
  await expectInputValue("#participantRouteSessionLink", participantRouteSessionLink);
  await expectInputValue("#participantTenantKey", tenantKey);
  await expectInputValue("#participantWorkspaceKey", workspaceKey);
  await expectInputValue("#participantLoginKey", participantRouteLoginKey);
  await expectInputValue("#participantRouteGroupKey", participantRouteGroupKey);
  await expectInputValue("#participantRouteBookletKey", participantRouteBookletKey);
  await page.waitForFunction(
    expectedSessionId =>
      document.querySelector("#participantRouteSessionLabel")?.textContent?.trim() ===
        expectedSessionId &&
      document.querySelector("#participantRouteStatus")?.textContent?.trim() ===
        "completed" &&
      document.querySelector("#participantEntryStatus")?.textContent?.trim() ===
        "completed" &&
      document.querySelector("#participantEntryNextStep")?.textContent?.includes(
        "Completed"
      ) &&
      document
        .querySelector("#participantRouteCompletionReadinessLabel")
        ?.textContent?.trim() === "Complete" &&
      document
        .querySelector("#participantRouteCompletionLabel")
        ?.textContent?.includes("Completed"),
    participantRouteSessionId,
    { timeout: 15_000 }
  );
  assert.equal(
    await page.locator("#participantEntryIssueCode").count(),
    0,
    "Completed participant session re-entry should not surface the expected resume fallback as an entry issue."
  );
  logStep("participant-entry-clear-session");
  await page.locator("#participantRouteClearSessionButton").click();
  await page.waitForFunction(
    ([expectedTenantKey, expectedWorkspaceKey, expectedLoginKey]) =>
      document.querySelector("#participantRouteSessionId")?.value === "" &&
      document.querySelector("#participantRouteRunId")?.textContent?.trim() ===
        "no run yet" &&
      document.querySelector("#participantRouteStatus")?.textContent?.trim() ===
        "idle" &&
      document.querySelector("#participantEntryStatus")?.textContent?.trim() ===
        "idle" &&
      document.querySelector("#participantRouteSessionLink") == null &&
      document.querySelector("#participantTenantKey")?.value === expectedTenantKey &&
      document.querySelector("#participantWorkspaceKey")?.value ===
        expectedWorkspaceKey &&
      document.querySelector("#participantLoginKey")?.value === expectedLoginKey &&
      document
        .querySelector("#participantEntryNextStep")
        ?.textContent?.includes("Sign in"),
    [tenantKey, workspaceKey, participantRouteLoginKey],
    { timeout: 15_000 }
  );
  await expectButtonSelectorEnabled("#participantRouteSignInButton");
  await expectButtonSelectorEnabled("#participantRouteStartOrResumeButton");
  await expectButtonSelectorDisabled("#participantRouteRefreshCurrentStateButton");
  await expectButtonSelectorDisabled("#participantRouteClearSessionButton");
  stopAfter("participant-entry-completed-session-reentry");

  logStep("nav-runtime");
  await page.goto(`${baseUrl}/app/runtime`, { waitUntil: "networkidle" });
  await page.waitForURL(/\/app\/runtime$/);
  await page.locator("#loginKey").waitFor();
  await page
    .locator(".action-groups")
    .filter({ hasText: "Participant Setup" })
    .filter({ hasText: "Run Lifecycle" })
    .filter({ hasText: "Monitor Control" })
    .filter({ hasText: "Review And Export" })
    .waitFor();
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Runtime Action Queue" })
    })
    .waitFor();
  logStep("runtime-scope-gating");
  await page.goto(`${baseUrl}/app/workspace`, { waitUntil: "networkidle" });
  await page.locator("#tenantKey").waitFor();
  await fillAndCommit("#tenantKey", "");
  await fillAndCommit("#workspaceKey", "");
  await page.goto(`${baseUrl}/app/content`, { waitUntil: "networkidle" });
  await page.waitForURL(/\/app\/content$/);
  await page.locator("#sourceFileName").waitFor();
  await expectButtonSelectorDisabled("#createSourcePackageButton");
  await expectButtonSelectorDisabled("#refreshContentReadsButton");
  await expectButtonSelectorDisabled("#applyContentReadFiltersButton");
  await expectButtonSelectorDisabled("#useSelectedIdsAsContentReadFiltersButton");
  await page.goto(`${baseUrl}/app/runtime`, { waitUntil: "networkidle" });
  await page.waitForURL(/\/app\/runtime$/);
  await page.locator("#loginKey").waitFor();
  await fillAndCommit("#loginKey", "runtime-no-scope");
  await fillAndCommit("#entryRosterText", "runtime-no-scope,group:no-scope");
  await expectButtonSelectorDisabled("#runtimeParticipantSignInButton");
  await expectButtonSelectorDisabled("#runtimeParticipantLaunchButton");
  await expectButtonSelectorDisabled("#runtimeRefreshRuntimeReadsButton");
  await expectButtonSelectorDisabled("#runtimeOpenRunsButton");
  await expectButtonSelectorDisabled("#runtimeExportOpenRunsCsvButton");
  await expectButtonSelectorDisabled("#applyOpenRunFiltersButton");
  await expectButtonSelectorDisabled("#runtimeLoadDetailedResponsesButton");
  await expectButtonSelectorDisabled("#runtimeLoadReviewsButton");
  await expectButtonSelectorDisabled("#runtimeExportResponsesCsvButton");
  await expectButtonSelectorDisabled("#runtimeExportReviewsCsvButton");
  await expectButtonSelectorDisabled("#participantHappyPathButton");
  await expectButtonSelectorDisabled("#runtimeParticipantSessionDetailButton");
  await expectButtonSelectorDisabled("#refreshParticipantSessionsButton");
  await expectButtonSelectorDisabled("#exportParticipantSessionsCsvButton");
  await expectButtonSelectorDisabled("#importParticipantRosterButton");
  await expectButtonSelectorDisabled("#loadParticipantRosterButton");
  await expectButtonSelectorDisabled("#exportParticipantRosterCsvButton");
  await expectButtonSelectorDisabled("#generateEntryLinksButton");
  await expectButtonSelectorDisabled("#downloadEntryLinksCsvButton");
  await expectButtonSelectorDisabled("#applyDetailedResponseFiltersButton");
  await expectButtonSelectorDisabled("#applyReviewFiltersButton");
  await expectButtonSelectorDisabled("#applyMonitorCommandHistoryFiltersButton");
  await page.goto(`${baseUrl}/app/workspace`, { waitUntil: "networkidle" });
  await page.locator("#tenantKey").waitFor();
  await fillAndCommit("#tenantKey", tenantKey);
  await fillAndCommit("#workspaceKey", workspaceKey);
  await page.goto(`${baseUrl}/app/runtime`, { waitUntil: "networkidle" });
  await page.waitForURL(/\/app\/runtime$/);
  await page.locator("#loginKey").waitFor();
  await expectButtonSelectorEnabled("#runtimeParticipantSignInButton");
  await expectButtonSelectorEnabled("#runtimeParticipantLaunchButton");
  await expectButtonSelectorEnabled("#runtimeRefreshRuntimeReadsButton");
  await expectButtonSelectorEnabled("#runtimeOpenRunsButton");
  await expectButtonSelectorEnabled("#runtimeExportOpenRunsCsvButton");
  await expectButtonSelectorEnabled("#applyOpenRunFiltersButton");
  await expectButtonSelectorEnabled("#runtimeLoadDetailedResponsesButton");
  await expectButtonSelectorEnabled("#runtimeLoadReviewsButton");
  await expectButtonSelectorEnabled("#runtimeExportResponsesCsvButton");
  await expectButtonSelectorEnabled("#runtimeExportReviewsCsvButton");
  await expectButtonSelectorEnabled("#participantHappyPathButton");
  await expectButtonSelectorEnabled("#refreshParticipantSessionsButton");
  await expectButtonSelectorEnabled("#exportParticipantSessionsCsvButton");
  await expectButtonSelectorEnabled("#importParticipantRosterButton");
  await expectButtonSelectorEnabled("#loadParticipantRosterButton");
  await expectButtonSelectorEnabled("#exportParticipantRosterCsvButton");
  await expectButtonSelectorEnabled("#generateEntryLinksButton");
  await expectButtonSelectorEnabled("#downloadEntryLinksCsvButton");
  await expectButtonSelectorEnabled("#applyDetailedResponseFiltersButton");
  await expectButtonSelectorEnabled("#applyReviewFiltersButton");
  await expectButtonSelectorEnabled("#applyMonitorCommandHistoryFiltersButton");
  stopAfter("runtime-scope-gating");
  logStep("generate-entry-links");
  const uploadedRosterText = [
    "loginKey\tgroupKey\tbookletKey\tdisplayName",
    `entry-student-a\tgroup:entry-smoke\t${participantRouteBookletKey}\tAda Entry`,
    "entry-student-b\tgroup:entry-smoke\t\tBen Entry"
  ].join("\n");
  const uploadedRosterFileName = `ui-smoke-roster-${Date.now()}.tsv`;
  const uploadedRosterPath = resolve(".data", uploadedRosterFileName);
  await writeFile(uploadedRosterPath, uploadedRosterText);
  await page.locator("#entryRosterFile").setInputFiles(uploadedRosterPath);
  await page.waitForFunction(
    expectedRosterText =>
      document.querySelector("#entryRosterText")?.value === expectedRosterText,
    uploadedRosterText,
    { timeout: 15_000 }
  );
  await page.locator("#importParticipantRosterButton").click();
  const savedAdaRosterCard = page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Saved Participant Roster" })
    })
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: "entry-student-a" }) })
    .filter({ hasText: "entry-student-a" })
    .filter({ hasText: "Ada Entry" });
  await savedAdaRosterCard.waitFor();
  await expectParticipantEntryAnchor(savedAdaRosterCard, [
    "loginKey=entry-student-a",
    "groupKey=group%3Aentry-smoke",
    "bookletKey=booklet%3Astarter"
  ]);
  await fillAndCommit(
    "#entryRosterText",
    [
      "<Testtakers>",
      "  <Testtaker login=\"entry-student-xml\" group=\"group:xml-entry\" name=\"Xml Entry\" />",
      "</Testtakers>"
    ].join("\n")
  );
  await page.locator("#importParticipantRosterButton").click();
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Saved Participant Roster" })
    })
    .filter({ hasText: "entry-student-xml" })
    .filter({ hasText: "Xml Entry" })
    .waitFor();
  await fillAndCommit(
    "#entryRosterText",
    JSON.stringify({
      groups: [
        {
          groupKey: "group:json-entry",
          booklets: [
            {
              bookletKey: participantRouteBookletKey,
              participants: [
                {
                  loginKey: "entry-student-json",
                  displayName: "Json Entry"
                }
              ]
            }
          ]
        }
      ]
    })
  );
  await page.locator("#importParticipantRosterButton").click();
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Saved Participant Roster" })
    })
    .filter({ hasText: "entry-student-json" })
    .filter({ hasText: "Json Entry" })
    .filter({ hasText: "group:json-entry" })
    .waitFor();
  await page.locator("#loadParticipantRosterButton").click();
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Saved Participant Roster" })
    })
    .filter({ hasText: "entry-student-b" })
    .filter({ hasText: "Ben Entry" })
    .waitFor();
  const participantRosterDownloadPromise = page.waitForEvent("download");
  await page.locator("#exportParticipantRosterCsvButton").click();
  const participantRosterDownload = await participantRosterDownloadPromise;
  assert.equal(
    participantRosterDownload.suggestedFilename(),
    `${workspaceKey}-participant-roster.csv`
  );
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Participant Roster CSV Export" })
    })
    .filter({ hasText: "participantRosterEntryId" })
    .filter({ hasText: "loginKey" })
    .filter({ hasText: "groupKey" })
    .filter({ hasText: "entry-student-a" })
    .filter({ hasText: "Ada Entry" })
    .filter({ hasText: "entry-student-json" })
    .filter({ hasText: "Json Entry" })
    .filter({ hasText: "booklet:starter" })
    .waitFor();
  await page.locator("#generateSavedRosterEntryLinksButton").click();
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Generated Entry Links" })
    })
    .filter({ hasText: "entry-student-a" })
    .filter({ hasText: "Ada Entry" })
    .filter({ hasText: participantEntryUrlPrefix })
    .filter({ hasText: "group%3Aentry-smoke" })
    .filter({ hasText: "booklet%3Astarter" })
    .waitFor();
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Generated Entry Links" })
    })
    .filter({ hasText: "entry-student-json" })
    .filter({ hasText: "Json Entry" })
    .filter({ hasText: participantEntryUrlPrefix })
    .filter({ hasText: "group%3Ajson-entry" })
    .filter({ hasText: "booklet%3Astarter" })
    .waitFor();
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Generated Entry Links" })
    })
    .filter({ hasText: "entry-student-xml" })
    .filter({ hasText: "Xml Entry" })
    .filter({ hasText: participantEntryUrlPrefix })
    .filter({ hasText: "group%3Axml-entry" })
    .waitFor();
  await page
    .locator("#entryLinksCsvPreview")
    .filter({ hasText: '"loginKey","groupKey","bookletKey","url","displayName"' })
    .filter({ hasText: '"entry-student-a","group:entry-smoke","booklet:starter"' })
    .filter({ hasText: participantEntryUrlPrefix })
    .filter({ hasText: '"Ada Entry"' })
    .waitFor();
  await page
    .locator("#entryLinkSummary")
    .filter({ hasText: "Entry Links" })
    .filter({ hasText: "4" })
    .filter({ hasText: workspaceKey })
    .filter({ hasText: "Ready" })
    .waitFor();
  await page
    .locator("#participantLaunchpad")
    .filter({ hasText: "Roster Entries" })
    .filter({ hasText: "4" })
    .filter({ hasText: "Generated Links" })
    .filter({ hasText: "Link CSV" })
    .filter({ hasText: "Ready" })
    .waitFor();
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Participant Launch Status" })
    })
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: "Ada Entry" }) })
    .filter({ hasText: "entry-student-a" })
    .filter({ hasText: "not_started" })
    .filter({ hasText: "no run" })
    .filter({ hasText: participantEntryUrlPrefix })
    .waitFor();
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Participant Launchpad Actions" })
    })
    .filter({ hasText: "Download participant entry links" })
    .filter({ hasText: "Refresh participant sessions" })
    .waitFor();
  stopAfter("generate-entry-links");
  logStep("activation-roster-warning-cards");
  const authenticatedJsonHeaders = {
    ...(createSmokeFetchInit()?.headers ?? {}),
    "content-type": "application/json"
  };
  const incompatibleSourcePackageResponse = await fetch(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`,
    {
      method: "POST",
      headers: authenticatedJsonHeaders,
      body: JSON.stringify({
        fileName: "incompatible-roster-release.xml",
        mediaType: "application/xml",
        sourceDocument:
          '<assessment><booklet key="booklet:alternate" label="Alternate"><unit key="unit-alternate" label="Alternate Unit" /></booklet></assessment>'
      })
    }
  );
  assert.equal(incompatibleSourcePackageResponse.status, 201);
  const incompatibleSourcePackagePayload =
    await incompatibleSourcePackageResponse.json();
  const incompatibleImportResponse = await fetch(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`,
    {
      method: "POST",
      headers: authenticatedJsonHeaders,
      body: JSON.stringify({
        sourcePackageId:
          incompatibleSourcePackagePayload.sourcePackage.sourcePackageId
      })
    }
  );
  assert.equal(incompatibleImportResponse.status, 201);
  const incompatibleImportPayload = await incompatibleImportResponse.json();
  const incompatibleReleaseId =
    incompatibleImportPayload.stagedContentRelease?.contentReleaseId;
  assert.ok(incompatibleReleaseId);
  await page.goto(`${baseUrl}/app/content`, { waitUntil: "networkidle" });
  await fillAndCommitUntilValue("#contentReleaseId", incompatibleReleaseId);
  await clickAction("Release Readiness");
  const rosterWarningCard = page
    .locator("app-record-collection")
    .filter({ has: page.getByRole("heading", { name: "Roster Compatibility Warnings" }) })
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: "Ada Entry" }) })
    .filter({ hasText: "entry-student-a" })
    .filter({ hasText: "booklet:starter" })
    .filter({ hasText: "booklet_not_found_in_active_release" });
  await rosterWarningCard.waitFor({ state: "visible", timeout: 15_000 });
  await rosterWarningCard.getByRole("button", { name: "Open In Runtime" }).click();
  await page.waitForURL(/\/app\/runtime$/);
  await expectInputValue("#loginKey", "entry-student-a");
  await expectInputValue("#groupKey", "group:entry-smoke");
  await expectInputValue("#bookletKey", participantRouteBookletKey);
  stopAfter("activation-roster-warning-cards");
  await fillAndCommit(
    "#entryRosterText",
    [
      "<Testtakers>",
      "  <participant>",
      "    <login>entry-student-direct-xml</login>",
      "    <group id=\"group:direct-xml\" />",
      `    <booklet ref=\"${participantRouteBookletKey}\" />`,
      "    <firstName>Direct</firstName>",
      "    <lastName>Xml</lastName>",
      "  </participant>",
      "</Testtakers>"
    ].join("\n")
  );
  await page.locator("#generateEntryLinksButton").click();
  const directEntryLinkCard = page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Generated Entry Links" })
    })
    .filter({ hasText: "entry-student-direct-xml" })
    .filter({ hasText: "Direct Xml" })
    .filter({ hasText: participantEntryUrlPrefix })
    .filter({ hasText: "group%3Adirect-xml" })
    .filter({ hasText: "booklet%3Astarter" });
  await directEntryLinkCard.waitFor();
  await page
    .locator("#entryLinkSummary")
    .filter({ hasText: "Entry Links" })
    .filter({ hasText: "1" })
    .filter({ hasText: "Ready" })
    .waitFor();
  const participantEntryPopupPromise = page.waitForEvent("popup");
  await directEntryLinkCard
    .getByRole("button", { name: "Open Participant Entry", exact: true })
    .click({ force: true });
  const participantEntryPopup = await participantEntryPopupPromise;
  await participantEntryPopup.locator("#participantLoginKey").waitFor();
  await participantEntryPopup.waitForFunction(
    ([expectedTenantKey, expectedWorkspaceKey, expectedLoginKey, expectedGroupKey, expectedBookletKey]) => {
      const valueOf = selector => document.querySelector(selector)?.value;
      return (
        valueOf("#participantTenantKey") === expectedTenantKey &&
        valueOf("#participantWorkspaceKey") === expectedWorkspaceKey &&
        valueOf("#participantLoginKey") === expectedLoginKey &&
        valueOf("#participantRouteGroupKey") === expectedGroupKey &&
        valueOf("#participantRouteBookletKey") === expectedBookletKey
      );
    },
    [
      tenantKey,
      workspaceKey,
      "entry-student-direct-xml",
      "group:direct-xml",
      participantRouteBookletKey
    ],
    { timeout: 15_000 }
  );
  await participantEntryPopup.waitForFunction(
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
  await participantEntryPopup.close();
  await clickAction("Refresh Sessions");
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Participant Launch Status" })
    })
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: "Direct Xml" }) })
    .filter({ hasText: "entry-student-direct-xml" })
    .filter({ hasText: "launched" })
    .filter({ hasText: "running" })
    .filter({ hasText: "group:direct-xml" })
    .filter({ hasText: "Participant Link" })
    .filter({ hasText: "participantSessionId=" })
    .filter({ hasText: "loginKey=entry-student-direct-xml" })
    .filter({ hasText: "groupKey=group%3Adirect-xml" })
    .filter({ hasText: "bookletKey=booklet%3Astarter" })
    .waitFor();
  stopAfter("participant-launch-status-session-link");
  logStep("participant-start");
  const participantLoginKey = "student-ui";
  const participantGroupKey = "group:student-ui";
  const participantBookletKey = "booklet:starter";
  await fillAndCommit("#loginKey", participantLoginKey);
  await fillAndCommit("#groupKey", participantGroupKey);
  await fillAndCommit("#bookletKey", participantBookletKey);
  await clickAction("Start Participant");
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
    process.stdout.write("ui_smoke_step=participant-start-retry\n");
    await fillAndCommit("#loginKey", participantLoginKey);
    await clickAction("Start Participant");
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
  logStep("filter-participant-sessions");
  await selectAndCommit("#participantSessionStatusFilter", "launched");
  await fillAndCommit("#participantSessionGroupFilter", participantGroupKey);
  await fillAndCommit("#participantSessionLoginFilter", participantLoginKey);
  await fillAndCommit("#participantSessionBookletFilter", participantBookletKey);
  await fillAndCommit("#participantSessionLimit", "1");
  await clickAction("Refresh Sessions");
  const filteredParticipantSessionsResponse = await fetch(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-sessions?status=launched&groupKey=${encodeURIComponent(participantGroupKey)}&loginKey=${encodeURIComponent(participantLoginKey)}&bookletKey=${encodeURIComponent(participantBookletKey)}&limit=1`,
    createSmokeFetchInit()
  );
  assert.equal(filteredParticipantSessionsResponse.status, 200);
  const filteredParticipantSessionsPayload =
    await filteredParticipantSessionsResponse.json();
  assert.equal(filteredParticipantSessionsPayload.items.length, 1);
  assert.equal(
    filteredParticipantSessionsPayload.items[0]?.latestTestRun?.bookletKey,
    participantBookletKey
  );
  const operatorParticipantSessionLink = `${baseUrl}/participant?${new URLSearchParams({
    participantSessionId,
    tenantKey,
    workspaceKey,
    loginKey: participantLoginKey,
    groupKey: participantGroupKey,
    bookletKey: participantBookletKey
  }).toString()}`;
  const participantSessionCard = page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Participant Sessions" })
    })
    .locator(".record-card")
    .filter({ hasText: participantLoginKey })
    .first();
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Participant Sessions" })
    })
    .locator(".record-card")
    .filter({
      has: page.getByRole("heading", { name: "Participant session window" })
    })
    .filter({ hasText: "1 session row(s) loaded for the current filters" })
    .filter({ hasText: "4 active filter(s)" })
    .filter({ hasText: "limit 1" })
    .filter({ hasText: "Loaded Sessions" })
    .filter({ hasText: "Active Filters" })
    .filter({ hasText: "status, group, login, booklet" })
    .waitFor();
  await participantSessionCard.waitFor();
  await participantSessionCard
    .getByRole("link", { name: operatorParticipantSessionLink })
    .waitFor();
  assert.equal(
    await participantSessionCard
      .getByRole("link", { name: operatorParticipantSessionLink })
      .getAttribute("href"),
    operatorParticipantSessionLink,
    "Operator participant-session card should expose the participant re-entry link."
  );
  await fillAndCommit("#bookletKey", "");
  await waitForNotBusy("participant-session-select-before-click");
  await participantSessionCard
    .getByRole("button", { name: "Select + Load", exact: true })
    .click();
  await waitForBusy("participant-session-select-after-click");
  await waitForNotBusy("participant-session-select-after-click");
  await expectInputValue("#bookletKey", participantBookletKey);
  stopAfter("filter-participant-sessions");
  logStep("export-participant-sessions-csv");
  const participantSessionsDownloadPromise = page.waitForEvent("download");
  await clickAction("Export Sessions CSV");
  const participantSessionsDownload = await participantSessionsDownloadPromise;
  assert.equal(
    participantSessionsDownload.suggestedFilename(),
    `${workspaceKey}-participant-sessions.csv`
  );
  await page
    .locator("#participantSessionsExportPreview")
    .filter({ hasText: "tenantKey,workspaceKey,participantSessionId,loginKey" })
    .filter({ hasText: participantLoginKey })
    .filter({ hasText: participantGroupKey })
    .waitFor();
  await fillAndCommit("#participantSessionId", participantSessionId);
  logStep("read-started-session");
  const pausedCurrentState = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${participantSessionId}/current-state`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      "currentRunState" in payload &&
      typeof payload.currentRunState === "object" &&
      payload.currentRunState != null &&
      "currentUnit" in payload.currentRunState &&
      payload.currentRunState.currentUnit?.unitKey != null &&
      payload.currentRunState.testRun?.bookletKey === participantBookletKey
  );
  await expectInputValue(
    "#currentUnitKey",
    pausedCurrentState.currentRunState.currentUnit.unitKey
  );
  const pausedTestRunId = pausedCurrentState.currentRunState.testRun.testRunId;
  assert.ok(pausedTestRunId, "UI smoke expected a paused testRunId before resuming.");
  await fillAndCommitUntilValue("#currentUnitKey", "unit-paused");
  await fillAndCommit("#runtimeUnitResponse", "Filtered response smoke");
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
  await page.waitForFunction(
    () =>
      document.querySelector("#playerPreviewStatus")?.textContent?.trim() ===
        "paused" &&
      document.querySelector("#playerPreviewUnitKey")?.textContent?.trim() ===
        "unit-paused" &&
      document
        .querySelector("#playerPreviewActions")
        ?.textContent?.includes("resume"),
    undefined,
    { timeout: 15_000 }
  );
  const runtimeStateDetailCard = page
    .locator("app-record-collection")
    .filter({ has: page.getByRole("heading", { name: "Runtime State Detail" }) })
    .locator(".record-card")
    .filter({ hasText: participantLoginKey })
    .filter({ hasText: participantSessionId });
  await runtimeStateDetailCard
    .getByRole("link", { name: operatorParticipantSessionLink })
    .waitFor();
  const currentRunDetailCard = page
    .locator("app-record-collection")
    .filter({ has: page.getByRole("heading", { name: "Current Run Detail" }) })
    .locator(".record-card")
    .filter({ hasText: participantSessionId })
    .filter({ hasText: pausedTestRunId });
  await currentRunDetailCard
    .getByRole("link", { name: operatorParticipantSessionLink })
    .waitFor();
  stopAfter("runtime-detail-session-links");
  await fillAndCommit("#testRunId", pausedTestRunId);
  logStep("filter-detailed-responses");
  await fillAndCommit("#detailedResponseLoginFilter", participantLoginKey);
  await fillAndCommit("#detailedResponseGroupFilter", participantGroupKey);
  await fillAndCommit("#detailedResponseBookletFilter", participantBookletKey);
  await fillAndCommit("#detailedResponseSessionFilter", participantSessionId);
  await fillAndCommit("#detailedResponseRunFilter", pausedTestRunId);
  await fillAndCommit("#detailedResponseUnitFilter", "unit-paused");
  await selectAndCommit("#detailedResponseStatusFilter", "paused");
  await fillAndCommit("#detailedResponseLimit", "1");
  await clickAction("Apply Response Filters");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/responses/detailed?loginKey=${participantLoginKey}&groupKey=${encodeURIComponent(participantGroupKey)}&bookletKey=${encodeURIComponent(participantBookletKey)}&participantSessionId=${participantSessionId}&testRunId=${pausedTestRunId}&unitKey=unit-paused&status=paused&limit=1`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.length === 1 &&
      payload.items[0]?.response === "Filtered response smoke"
  );
  await page
    .locator("article.card")
    .filter({ has: page.getByRole("heading", { name: "Detailed Responses" }) })
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: "Detailed response window" }) })
    .filter({ hasText: "1 response row(s) loaded for the current filters" })
    .filter({ hasText: "7 active filter(s)" })
    .filter({ hasText: "limit 1" })
    .filter({ hasText: "Loaded Responses" })
    .filter({ hasText: "Active Filters" })
    .filter({ hasText: "login, group, booklet, session, run, unit, status" })
    .waitFor();
  await page
    .locator("article.card")
    .filter({ has: page.getByRole("heading", { name: "Detailed Responses" }) })
    .filter({ hasText: "Filtered response smoke" })
    .filter({ hasText: participantBookletKey })
    .filter({ hasText: "unit-paused" })
    .waitFor();
  await fillAndCommit("#bookletKey", "");
  const detailedResponseCard = page
    .locator("article.card")
    .filter({ has: page.getByRole("heading", { name: "Detailed Responses" }) })
    .locator(".record-card")
    .filter({ hasText: "Filtered response smoke" })
    .filter({ hasText: participantBookletKey })
    .filter({ hasText: "unit-paused" });
  await detailedResponseCard
    .getByRole("button", { name: "Select Response", exact: true })
    .click();
  await waitForBusy("detailed-response-select-after-click");
  await waitForNotBusy("detailed-response-select-after-click");
  await expectInputValue("#bookletKey", participantBookletKey);
  await fillAndCommit("#reviewComment", "Filtered review smoke");
  logStep("create-filtered-review");
  await clickAction("Create Review");
  const reviewActionQueue = page.locator("article.card").filter({
    has: page.getByRole("heading", { name: "Review Action Queue", exact: true })
  });
  await reviewActionQueue
    .locator(".record-card")
    .filter({
      has: page.getByRole("heading", { name: "Update selected review" })
    })
    .filter({ hasText: "Filtered review smoke" })
    .waitFor();
  await reviewActionQueue
    .locator(".record-card")
    .filter({
      has: page.getByRole("heading", { name: "Delete selected review" })
    })
    .waitFor();
  await clickCardAction(
    "Review Action Queue",
    "Apply Suggestion",
    "Load reviews for selected scope"
  );
  logStep("filter-reviews");
  await fillAndCommit("#reviewLoginFilter", participantLoginKey);
  await fillAndCommit("#reviewGroupFilter", participantGroupKey);
  await fillAndCommit("#reviewBookletFilter", participantBookletKey);
  await fillAndCommit("#reviewSessionFilter", participantSessionId);
  await fillAndCommit("#reviewRunFilter", pausedTestRunId);
  await fillAndCommit("#reviewUnitFilter", "unit-paused");
  await fillAndCommit("#reviewReviewerFilter", "operator-ui");
  await fillAndCommit("#reviewCategoryFilter", "note");
  await fillAndCommit("#reviewLimit", "1");
  await clickAction("Apply Review Filters");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/reviews?loginKey=${participantLoginKey}&groupKey=${encodeURIComponent(participantGroupKey)}&bookletKey=${encodeURIComponent(participantBookletKey)}&participantSessionId=${participantSessionId}&testRunId=${pausedTestRunId}&unitKey=unit-paused&reviewerId=operator-ui&category=note&limit=1`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.length === 1 &&
      payload.items[0]?.review?.comment === "Filtered review smoke"
  );
  await page
    .locator("article.card")
    .filter({ has: page.getByRole("heading", { name: "Reviews", exact: true }) })
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: "Review window" }) })
    .filter({ hasText: "1 review row(s) loaded for the current filters" })
    .filter({ hasText: "8 active filter(s)" })
    .filter({ hasText: "limit 1" })
    .filter({ hasText: "Loaded Reviews" })
    .filter({ hasText: "Active Filters" })
    .filter({ hasText: "login, group, booklet, session, run, unit, reviewer, category" })
    .waitFor();
  await page
    .locator("article.card")
    .filter({ has: page.getByRole("heading", { name: "Reviews", exact: true }) })
    .filter({ hasText: "Filtered review smoke" })
    .filter({ hasText: "operator-ui" })
    .waitFor();
  await page
    .locator("article.card")
    .filter({ has: page.getByRole("heading", { name: "Review Readiness" }) })
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: "Review readiness" }) })
    .filter({ hasText: participantLoginKey })
    .filter({ hasText: pausedTestRunId })
    .filter({ hasText: "review(s)" })
    .filter({ hasText: "Unit Reviews" })
    .waitFor();
  const reviewReadinessPausedWorkCard = page
    .locator("article.card")
    .filter({ has: page.getByRole("heading", { name: "Review Readiness" }) })
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: "Paused Work" }) })
    .filter({ hasText: "answered" })
    .filter({ hasText: "reviewed" })
    .filter({ hasText: "Filtered response smoke" })
    .filter({ hasText: "Filtered review smoke" });
  await reviewReadinessPausedWorkCard.waitFor();
  await reviewReadinessPausedWorkCard
    .getByRole("button", { name: "Select Review Scope" })
    .click();
  await expectInputValue("#detailedResponseRunFilter", pausedTestRunId);
  await expectInputValue("#detailedResponseUnitFilter", "unit-paused");
  await expectInputValue("#detailedResponseBookletFilter", participantBookletKey);
  await expectInputValue("#reviewRunFilter", pausedTestRunId);
  await expectInputValue("#reviewUnitFilter", "unit-paused");
  await expectInputValue("#reviewBookletFilter", participantBookletKey);
  await expectInputValue("#reviewReviewerFilter", "operator-ui");
  await expectInputValue("#reviewCategoryFilter", "note");
  stopAfter("filter-reviews");
  if (skipRuntimeCsvExports) {
    logStep("skip-runtime-csv-exports");
  } else {
    logStep("export-response-csv");
    const responseDownloadPromise = page
      .waitForEvent("download", { timeout: 5_000 })
      .catch(() => null);
    const responseCsvResponsePromise = page.waitForResponse(
      response =>
        response.url().includes("/exports/responses.csv") && response.status() === 200
    );
    await clickSelectorAction(
      "Export Responses CSV",
      "#runtimeExportResponsesCsvButton"
    );
    await responseCsvResponsePromise;
    const responseDownload = await responseDownloadPromise;
    if (responseDownload) {
      assert.equal(responseDownload.suggestedFilename(), `${workspaceKey}-responses.csv`);
    }
    await page
      .locator("#responseExportPreview")
      .filter({ hasText: "tenantKey,workspaceKey,loginKey,groupKey" })
      .filter({ hasText: participantLoginKey })
      .filter({ hasText: pausedTestRunId })
      .filter({ hasText: "unit-paused" })
      .filter({ hasText: "Filtered response smoke" })
      .waitFor();
    logStep("export-review-csv");
    const reviewDownloadPromise = page
      .waitForEvent("download", { timeout: 5_000 })
      .catch(() => null);
    const reviewCsvResponsePromise = page.waitForResponse(
      response =>
        response.url().includes("/exports/reviews.csv") && response.status() === 200
    );
    await clickSelectorAction("Export Review CSV", "#runtimeExportReviewsCsvButton");
    await reviewCsvResponsePromise;
    const reviewDownload = await reviewDownloadPromise;
    if (reviewDownload) {
      assert.equal(reviewDownload.suggestedFilename(), `${workspaceKey}-reviews.csv`);
    }
    await page
      .locator("#reviewExportPreview")
      .filter({ hasText: "tenantKey,workspaceKey,reviewId,loginKey" })
      .filter({ hasText: participantLoginKey })
      .filter({ hasText: pausedTestRunId })
      .filter({ hasText: "unit-paused" })
      .filter({ hasText: "operator-ui" })
      .filter({ hasText: "Filtered review smoke" })
      .waitFor();
  }
  logStep("monitor-resume-run-suggestion");
  await clickCardAction(
    "Runtime Action Queue",
    "Apply Suggestion",
    "Monitor resume selected run"
  );
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
  await page.waitForFunction(
    () =>
      document.querySelector("#playerPreviewStatus")?.textContent?.trim() ===
        "running",
    undefined,
    { timeout: 15_000 }
  );
  await clickAction("Refresh Runtime Reads");
  await expectMonitorCommandHistoryCard({
    commandType: "resume",
    bookletKey: participantBookletKey,
    groupKey: participantGroupKey,
    loginKey: participantLoginKey,
    participantSessionId,
    testRunId: pausedTestRunId,
    transition: "paused -> running"
  });
  logStep("monitor-pause-run");
  await clickAction("Monitor Pause");
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
      payload.currentRunState.testRun.status === "paused"
  );
  await page.waitForFunction(
    () =>
      document.querySelector("#playerPreviewStatus")?.textContent?.trim() ===
        "paused" &&
      document
        .querySelector("#playerPreviewActions")
        ?.textContent?.includes("resume"),
    undefined,
    { timeout: 15_000 }
  );
  await clickAction("Refresh Runtime Reads");
  await expectMonitorCommandHistoryCard({
    commandType: "pause",
    bookletKey: participantBookletKey,
    groupKey: participantGroupKey,
    loginKey: participantLoginKey,
    participantSessionId,
    testRunId: pausedTestRunId,
    transition: "running -> paused"
  });
  await fillAndCommit("#monitorCommandHistoryRunFilter", "missing-monitor-run");
  await fillAndCommit("#monitorCommandHistoryLimit", "1");
  await clickAction("Apply Command Filters");
  await page
    .locator("app-record-collection")
    .filter({
      has: page.getByRole("heading", {
        name: "Monitor Command History",
        exact: true
      })
    })
    .filter({ hasText: "No monitor commands have been issued yet." })
    .waitFor({ timeout: 15_000 });
  await fillAndCommit("#monitorCommandHistoryRunFilter", pausedTestRunId);
  await fillAndCommit("#monitorCommandHistoryLimit", "2");
  await clickAction("Apply Command Filters");
  await expectMonitorCommandHistoryCard({
    commandType: "pause",
    bookletKey: participantBookletKey,
    groupKey: participantGroupKey,
    loginKey: participantLoginKey,
    participantSessionId,
    testRunId: pausedTestRunId,
    transition: "running -> paused"
  });
  await expectMonitorCommandHistoryCard({
    commandType: "resume",
    bookletKey: participantBookletKey,
    groupKey: participantGroupKey,
    loginKey: participantLoginKey,
    participantSessionId,
    testRunId: pausedTestRunId,
    transition: "paused -> running"
  });
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
  const openRunStudentCard = page
    .locator("app-record-collection")
    .filter({ has: page.getByRole("heading", { name: "Open Monitor Runs" }) })
    .locator(".record-card")
    .filter({ hasText: participantLoginKey })
    .filter({ hasText: participantSessionId })
    .filter({ hasText: operatorParticipantSessionLink })
    .filter({ hasText: pausedTestRunId });
  await openRunStudentCard.waitFor();
  logStep("open-run-select-sync");
  await fillAndCommit("#detailedResponseLoginFilter", "stale-login");
  await selectAndCommit("#detailedResponseStatusFilter", "paused");
  await selectAndCommit("#openRunStatusFilter", "paused");
  await openRunStudentCard
    .getByRole("button", { name: "Select + Sync" })
    .click();
  await waitForNotBusy("open-run-select-sync");
  await expectInputValue("#participantSessionId", participantSessionId);
  await expectInputValue("#testRunId", pausedTestRunId);
  await expectInputValue("#currentUnitKey", "unit-paused");
  await expectInputValue("#detailedResponseLoginFilter", participantLoginKey);
  await expectInputValue("#detailedResponseGroupFilter", participantGroupKey);
  await expectInputValue("#detailedResponseBookletFilter", participantBookletKey);
  await expectInputValue("#detailedResponseSessionFilter", participantSessionId);
  await expectInputValue("#detailedResponseRunFilter", pausedTestRunId);
  await expectInputValue("#detailedResponseUnitFilter", "unit-paused");
  await expectInputValue("#detailedResponseStatusFilter", "");
  await expectInputValue("#reviewLoginFilter", participantLoginKey);
  await expectInputValue("#reviewGroupFilter", participantGroupKey);
  await expectInputValue("#reviewBookletFilter", participantBookletKey);
  await expectInputValue("#reviewSessionFilter", participantSessionId);
  await expectInputValue("#reviewRunFilter", pausedTestRunId);
  await expectInputValue("#reviewUnitFilter", "unit-paused");
  await expectInputValue("#openRunLoginFilter", participantLoginKey);
  await expectInputValue("#openRunGroupFilter", participantGroupKey);
  await expectInputValue("#openRunBookletFilter", participantBookletKey);
  await expectInputValue("#openRunSessionFilter", participantSessionId);
  await expectInputValue("#openRunRunFilter", pausedTestRunId);
  await expectInputValue("#openRunUnitFilter", "unit-paused");
  await expectInputValue("#openRunStatusFilter", "");
  stopAfter("open-run-select-sync");
  logStep("filter-open-runs");
  await fillAndCommit("#openRunLoginFilter", participantLoginKey);
  await fillAndCommit("#openRunGroupFilter", participantGroupKey);
  await fillAndCommit("#openRunBookletFilter", participantBookletKey);
  await fillAndCommit("#openRunSessionFilter", participantSessionId);
  await fillAndCommit("#openRunRunFilter", pausedTestRunId);
  await fillAndCommit("#openRunUnitFilter", "unit-paused");
  await selectAndCommit("#openRunStatusFilter", "running");
  await fillAndCommit("#openRunLimit", "1");
  await clickAction("Apply Open Run Filters");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/monitor/open-runs?loginKey=${participantLoginKey}&groupKey=${encodeURIComponent(participantGroupKey)}&bookletKey=${encodeURIComponent(participantBookletKey)}&participantSessionId=${participantSessionId}&testRunId=${pausedTestRunId}&unitKey=unit-paused&status=running&limit=1`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.length === 1 &&
      payload.items[0]?.testRunId === pausedTestRunId
  );
  logStep("export-open-runs-csv");
  const openRunsDownloadPromise = page.waitForEvent("download");
  await clickAction("Export Open Runs CSV");
  const openRunsDownload = await openRunsDownloadPromise;
  assert.equal(
    openRunsDownload.suggestedFilename(),
    `${workspaceKey}-open-runs.csv`
  );
  await page
    .locator("#openRunsExportPreview")
    .filter({ hasText: "tenantKey,workspaceKey,participantSessionId,testRunId,loginKey" })
    .filter({ hasText: participantSessionId })
    .filter({ hasText: participantLoginKey })
    .filter({ hasText: participantGroupKey })
    .filter({ hasText: participantBookletKey })
    .filter({ hasText: "running" })
    .waitFor();

  logStep("study-monitor-group-detail");
  await page.locator('[data-view-nav="workspace"]').click();
  await page.waitForURL(/\/app\/workspace$/);
  await clickAction("Refresh Study Monitor");
  const studyMonitorSummaryPayload = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/study-monitor/summary`,
    payload => {
      const summary = payload?.studyMonitorSummary;
      if (typeof summary !== "object" || summary == null) {
        return false;
      }
      const entrySmokeGroup = Array.isArray(summary.groups)
        ? summary.groups.find(group => group?.groupKey === "group:entry-smoke")
        : null;
      const directXmlGroup = Array.isArray(summary.groups)
        ? summary.groups.find(group => group?.groupKey === "group:direct-xml")
        : null;
      const xmlEntryGroup = Array.isArray(summary.groups)
        ? summary.groups.find(group => group?.groupKey === "group:xml-entry")
        : null;
      const jsonEntryGroup = Array.isArray(summary.groups)
        ? summary.groups.find(group => group?.groupKey === "group:json-entry")
        : null;
      const notStartedParticipants = Array.isArray(summary.notStartedParticipants)
        ? summary.notStartedParticipants.map(entry => ({
            loginKey: entry?.loginKey,
            groupKey: entry?.groupKey,
            bookletKey: entry?.bookletKey ?? null,
            displayName: entry?.displayName ?? null
          }))
        : [];
      const expectedNotStartedParticipants = [
        {
          loginKey: "entry-student-a",
          groupKey: "group:entry-smoke",
          bookletKey: "booklet:starter",
          displayName: "Ada Entry"
        },
        {
          loginKey: "entry-student-b",
          groupKey: "group:entry-smoke",
          bookletKey: null,
          displayName: "Ben Entry"
        },
        {
          loginKey: "entry-student-xml",
          groupKey: "group:xml-entry",
          bookletKey: null,
          displayName: "Xml Entry"
        },
        {
          loginKey: "entry-student-json",
          groupKey: "group:json-entry",
          bookletKey: "booklet:starter",
          displayName: "Json Entry"
        }
      ];
      const byLoginKey = (left, right) =>
        String(left.loginKey).localeCompare(String(right.loginKey));
      const normalizedNotStartedParticipants = [...notStartedParticipants].sort(
        byLoginKey
      );
      const normalizedExpectedNotStartedParticipants = [
        ...expectedNotStartedParticipants
      ].sort(byLoginKey);
      const pausedWorkUnit = Array.isArray(summary.unitProgress)
        ? summary.unitProgress.find(unit => unit?.unitKey === "unit-paused")
        : null;
      const pausedWorkAttention = Array.isArray(summary.attentionItems)
        ? summary.attentionItems.find(
            item => item?.subjectType === "unit" && item?.key === "unit-paused"
          )
        : null;
      const entrySmokeAttention = Array.isArray(summary.attentionItems)
        ? summary.attentionItems.find(
            item =>
              item?.subjectType === "group" &&
              item?.key === "group:entry-smoke"
          )
        : null;
      const studentUiGroup = Array.isArray(summary.groups)
        ? summary.groups.find(group => group?.groupKey === "group:student-ui")
        : null;
      const missingResponseCount = Array.isArray(summary.unitProgress)
        ? summary.unitProgress.reduce(
            (total, unit) => total + Number(unit?.missingResponseCount ?? 0),
            0
          )
        : 0;
      return (
        summary.expectedParticipantCount >= 8 &&
        summary.rosterEntryCount === 4 &&
        summary.participantSessionCount >= 4 &&
        summary.testRunCount >= 4 &&
        summary.notStartedCount >= 4 &&
        JSON.stringify(normalizedNotStartedParticipants) ===
          JSON.stringify(normalizedExpectedNotStartedParticipants) &&
        missingResponseCount >= 11 &&
        Array.isArray(summary.groups) &&
        summary.groups.length >= 6 &&
        pausedWorkUnit?.rosterExpectedCount === 2 &&
        pausedWorkUnit?.expectedRunCount >= 6 &&
        pausedWorkUnit?.missingResponseCount >= 4 &&
        pausedWorkAttention?.score >= 300 &&
        pausedWorkAttention?.missingResponseCount >= 3 &&
        entrySmokeAttention?.score === 60 &&
        entrySmokeAttention?.notStartedCount === 2 &&
        directXmlGroup?.expectedParticipantCount === 1 &&
        directXmlGroup?.participantSessionCount === 1 &&
        directXmlGroup?.testRunCount === 1 &&
        directXmlGroup?.runningCount === 1 &&
        entrySmokeGroup?.expectedParticipantCount === 2 &&
        entrySmokeGroup?.rosterEntryCount === 2 &&
        entrySmokeGroup?.participantSessionCount === 0 &&
        entrySmokeGroup?.notStartedCount === 2 &&
        xmlEntryGroup?.expectedParticipantCount === 1 &&
        xmlEntryGroup?.rosterEntryCount === 1 &&
        xmlEntryGroup?.participantSessionCount === 0 &&
        xmlEntryGroup?.notStartedCount === 1 &&
        jsonEntryGroup?.expectedParticipantCount === 1 &&
        jsonEntryGroup?.rosterEntryCount === 1 &&
        jsonEntryGroup?.participantSessionCount === 0 &&
        jsonEntryGroup?.notStartedCount === 1 &&
        studentUiGroup?.participantSessionCount === 1 &&
        studentUiGroup?.testRunCount === 1 &&
        studentUiGroup?.runningCount === 1 &&
        studentUiGroup?.reviewCount === 1
      );
    }
  );
  const studyMonitorSummary = studyMonitorSummaryPayload.studyMonitorSummary;
  const studyMonitorParticipantMatrixPayload = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/study-monitor/participants`,
    payload => {
      const matrix = payload?.studyMonitorParticipantMatrix;
      return (
        typeof matrix === "object" &&
        matrix != null &&
        Array.isArray(matrix.rows) &&
        matrix.rows.length > 0
      );
    }
  );
  const studyMonitorParticipantMatrix =
    studyMonitorParticipantMatrixPayload.studyMonitorParticipantMatrix;
  const studyMonitorRunDetailPayload = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/study-monitor/runs/${pausedTestRunId}`,
    payload => {
      const detail = payload?.studyMonitorRun;
      if (typeof detail !== "object" || detail == null) {
        return false;
      }
      const pausedUnit = Array.isArray(detail.units)
        ? detail.units.find(unit => unit?.unitKey === "unit-paused")
        : null;
      return (
        detail.testRun?.testRunId === pausedTestRunId &&
        detail.testRun?.status === "running" &&
        detail.participantSession?.participantSessionId === participantSessionId &&
        detail.participantSession?.loginKey === participantLoginKey &&
        detail.bookletKey === participantBookletKey &&
        detail.responseCount >= 1 &&
        detail.reviewCount === 1 &&
        detail.expectedUnitCount === 3 &&
        detail.missingExpectedUnitCount >= 2 &&
        pausedUnit?.expected === true &&
        pausedUnit?.answered === true &&
        pausedUnit?.current === true &&
        pausedUnit?.reviewCount === 1
      );
    }
  );
  const studyMonitorRunDetail = studyMonitorRunDetailPayload.studyMonitorRun;
  const displayedParticipantMatrixRows = Math.min(
    studyMonitorParticipantMatrix.rows.length,
    25
  );
  const hiddenParticipantMatrixRows = Math.max(
    studyMonitorParticipantMatrix.rows.length - displayedParticipantMatrixRows,
    0
  );
  const visibleParticipantMatrixRecords = displayedParticipantMatrixRows + 1;
  const studyMonitorMissingResponseCount = Array.isArray(
    studyMonitorSummary.unitProgress
  )
    ? studyMonitorSummary.unitProgress.reduce(
        (total, unit) => total + Number(unit?.missingResponseCount ?? 0),
        0
      )
    : 0;
  const pausedWorkSummaryUnit = Array.isArray(studyMonitorSummary.unitProgress)
    ? studyMonitorSummary.unitProgress.find(unit => unit?.unitKey === "unit-paused")
    : null;
  const pausedWorkExpectedRunCount = Number(
    pausedWorkSummaryUnit?.expectedRunCount ?? 0
  );
  const pausedWorkMissingResponseCount = Number(
    pausedWorkSummaryUnit?.missingResponseCount ?? 0
  );
  const pausedWorkAnsweredCount = Math.max(
    pausedWorkExpectedRunCount - pausedWorkMissingResponseCount,
    0
  );
  const pausedWorkAttentionSummary = Array.isArray(
    studyMonitorSummary.attentionItems
  )
    ? studyMonitorSummary.attentionItems.find(
        item => item?.subjectType === "unit" && item?.key === "unit-paused"
      )
    : null;
  await page
    .locator("app-record-collection")
    .filter({ hasText: "Participant Unit Matrix" })
    .filter({ hasText: "student-ui" })
    .filter({ hasText: "unit-paused" })
    .filter({ hasText: "missing" })
    .waitFor({ state: "visible", timeout: 15_000 });
  const expectStudyMonitorParticipantDetail = async (
    loginKey,
    expectedTexts = []
  ) => {
    let collection = page
      .locator("app-record-collection")
      .filter({ hasText: "Study Monitor Participant Detail" })
      .filter({ hasText: loginKey });
    for (const expectedText of expectedTexts) {
      collection = collection.filter({ hasText: expectedText });
    }
    await collection.waitFor({ state: "visible", timeout: 15_000 });
  };
  await page
    .locator("app-record-collection")
    .filter({ hasText: "Participant Unit Matrix" })
    .locator(".record-card")
    .filter({ hasText: "student-ui" })
    .filter({ hasText: "unit-paused" })
    .getByRole("button", { name: "Open Run Detail" })
    .first()
    .click();
  await page
    .locator("app-record-collection")
    .filter({ hasText: "Study Monitor Run Detail" })
    .filter({ hasText: "student-ui" })
    .filter({ hasText: pausedTestRunId })
    .filter({ hasText: participantBookletKey })
    .filter({ hasText: "unit-paused" })
    .filter({ hasText: "current" })
    .filter({ hasText: `${studyMonitorRunDetail.missingExpectedUnitCount} missing` })
    .filter({ hasText: "1 review(s)" })
    .waitFor({ state: "visible", timeout: 15_000 });
  logStep("run-detail-review-response");
  await page
    .locator("app-record-collection")
    .filter({ hasText: "Study Monitor Run Detail" })
    .locator(".record-card")
    .filter({ hasText: "unit-paused" })
    .filter({ hasText: "answered" })
    .getByRole("button", { name: "Review Response" })
    .first()
    .click();
  await page.waitForURL(/\/app\/runtime$/);
  await expectInputValue("#participantSessionId", participantSessionId);
  await expectInputValue("#testRunId", pausedTestRunId);
  await expectInputValue("#groupKey", participantGroupKey);
  await expectInputValue("#bookletKey", participantBookletKey);
  await expectInputValue("#currentUnitKey", "unit-paused");
  await expectInputValue("#detailedResponseLoginFilter", participantLoginKey);
  await expectInputValue("#detailedResponseGroupFilter", participantGroupKey);
  await expectInputValue("#detailedResponseBookletFilter", participantBookletKey);
  await expectInputValue("#detailedResponseSessionFilter", participantSessionId);
  await expectInputValue("#detailedResponseRunFilter", pausedTestRunId);
  await expectInputValue("#detailedResponseUnitFilter", "unit-paused");
  await expectInputValue("#reviewLoginFilter", participantLoginKey);
  await expectInputValue("#reviewGroupFilter", participantGroupKey);
  await expectInputValue("#reviewBookletFilter", participantBookletKey);
  await expectInputValue("#reviewSessionFilter", participantSessionId);
  await expectInputValue("#reviewRunFilter", pausedTestRunId);
  await expectInputValue("#reviewUnitFilter", "unit-paused");
  await expectInputValue("#openRunLoginFilter", participantLoginKey);
  await expectInputValue("#openRunGroupFilter", participantGroupKey);
  await expectInputValue("#openRunBookletFilter", participantBookletKey);
  await expectInputValue("#openRunSessionFilter", participantSessionId);
  await expectInputValue("#openRunRunFilter", pausedTestRunId);
  await expectInputValue("#openRunUnitFilter", "unit-paused");
  await page.locator('[data-view-nav="workspace"]').click();
  await page.waitForURL(/\/app\/workspace$/);
  stopAfter("run-detail-review-response");
  logStep("run-detail-select-review");
  await page
    .locator("app-record-collection")
    .filter({ hasText: "Study Monitor Run Detail" })
    .locator(".record-card")
    .filter({ hasText: "operator-ui" })
    .filter({ hasText: "unit-paused" })
    .filter({ hasText: "Filtered review smoke" })
    .getByRole("button", { name: "Select Review", exact: true })
    .first()
    .click();
  await page.waitForURL(/\/app\/runtime$/);
  await expectInputValue("#participantSessionId", participantSessionId);
  await expectInputValue("#testRunId", pausedTestRunId);
  await expectInputValue("#groupKey", participantGroupKey);
  await expectInputValue("#bookletKey", participantBookletKey);
  await expectInputValue("#currentUnitKey", "unit-paused");
  await expectInputValue("#reviewerId", "operator-ui");
  await expectInputValue("#reviewCategory", "note");
  await expectInputValue("#reviewComment", "Filtered review smoke");
  await expectInputValue("#detailedResponseLoginFilter", participantLoginKey);
  await expectInputValue("#detailedResponseGroupFilter", participantGroupKey);
  await expectInputValue("#detailedResponseBookletFilter", participantBookletKey);
  await expectInputValue("#detailedResponseSessionFilter", participantSessionId);
  await expectInputValue("#detailedResponseRunFilter", pausedTestRunId);
  await expectInputValue("#detailedResponseUnitFilter", "unit-paused");
  await expectInputValue("#reviewLoginFilter", participantLoginKey);
  await expectInputValue("#reviewGroupFilter", participantGroupKey);
  await expectInputValue("#reviewBookletFilter", participantBookletKey);
  await expectInputValue("#reviewSessionFilter", participantSessionId);
  await expectInputValue("#reviewRunFilter", pausedTestRunId);
  await expectInputValue("#reviewUnitFilter", "unit-paused");
  await expectInputValue("#reviewReviewerFilter", "operator-ui");
  await expectInputValue("#reviewCategoryFilter", "note");
  await expectInputValue("#openRunLoginFilter", participantLoginKey);
  await expectInputValue("#openRunGroupFilter", participantGroupKey);
  await expectInputValue("#openRunBookletFilter", participantBookletKey);
  await expectInputValue("#openRunSessionFilter", participantSessionId);
  await expectInputValue("#openRunRunFilter", pausedTestRunId);
  await expectInputValue("#openRunUnitFilter", "unit-paused");
  await page.locator('[data-view-nav="workspace"]').click();
  await page.waitForURL(/\/app\/workspace$/);
  stopAfter("run-detail-select-review");
  logStep("run-detail-open-runtime");
  await page
    .locator("app-record-collection")
    .filter({ hasText: "Study Monitor Run Detail" })
    .locator(".record-card")
    .filter({ hasText: pausedTestRunId })
    .getByRole("button", { name: "Open In Runtime" })
    .first()
    .click();
  await page.waitForURL(/\/app\/runtime$/);
  await expectInputValue("#participantSessionId", participantSessionId);
  await expectInputValue("#testRunId", pausedTestRunId);
  await expectInputValue("#groupKey", participantGroupKey);
  await expectInputValue("#bookletKey", participantBookletKey);
  await expectInputValue("#currentUnitKey", "unit-paused");
  await page.locator('[data-view-nav="workspace"]').click();
  await page.waitForURL(/\/app\/workspace$/);
  const monitorStatusTotal = [
    studyMonitorSummary.notStartedCount,
    studyMonitorSummary.runningCount,
    studyMonitorSummary.pausedCount,
    studyMonitorSummary.completedCount
  ].reduce((total, count) => total + Number(count ?? 0), 0);
  const formatMonitorStatusPercent = count =>
    monitorStatusTotal <= 0
      ? "0"
      : ((Number(count ?? 0) / monitorStatusTotal) * 100)
          .toFixed(1)
          .replace(/\.0$/, "");
  const expectMonitorStatusCard = async (headline, count, meaning) => {
    const statusCard = monitorStatusDistributionCard
      .locator(".record-card")
      .filter({ has: page.getByRole("heading", { name: headline }) })
      .filter({
        hasText: `${count} participant state${count === 1 ? "" : "s"}`
      })
      .filter({ hasText: `${formatMonitorStatusPercent(count)}%` })
      .filter({ hasText: meaning })
      .filter({ hasText: "Show In Matrix" });
    await statusCard.waitFor();
    return statusCard;
  };
  const studyMonitorCard = page.locator("article.card").filter({
    has: page.getByRole("heading", { name: "Study Monitor", exact: true })
  });
  await studyMonitorCard
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: `${workspaceKey} monitor` }) })
    .filter({
      hasText: `${studyMonitorSummary.expectedParticipantCount} expected participant(s)`
    })
    .filter({ hasText: `${studyMonitorSummary.participantSessionCount} session(s)` })
    .filter({ hasText: `${studyMonitorSummary.testRunCount} run(s)` })
    .filter({ hasText: `${studyMonitorSummary.groups.length} group(s)` })
    .filter({ hasText: "3 unit(s)" })
    .filter({ hasText: `${studyMonitorMissingResponseCount} missing response(s)` })
    .filter({ hasText: "Roster Entries" })
    .filter({ hasText: "Not Started" })
    .filter({ hasText: "3" })
    .waitFor();
  const participantUnitMatrixCard = page.locator("article.card").filter({
    has: page.getByRole("heading", {
      name: "Participant Unit Matrix",
      exact: true
    })
  });
  await participantUnitMatrixCard
    .locator(".record-collection-summary")
    .filter({ hasText: `${visibleParticipantMatrixRecords} visible records` })
    .waitFor();
  await participantUnitMatrixCard
    .locator(".record-card")
    .filter({
      has: page.getByRole("heading", {
        name: `${workspaceKey} participant matrix`
      })
    })
    .filter({
      hasText: `${studyMonitorParticipantMatrix.rows.length} participant-unit row(s)`
    })
    .filter({ hasText: "Total Rows" })
    .filter({ hasText: String(studyMonitorParticipantMatrix.rows.length) })
    .filter({ hasText: "Displayed Rows" })
    .filter({ hasText: String(displayedParticipantMatrixRows) })
    .filter({ hasText: "Hidden Rows" })
    .filter({ hasText: String(hiddenParticipantMatrixRows) })
    .waitFor();
  await fillAndCommit("#studyMonitorMatrixLoginFilter", participantLoginKey);
  await fillAndCommit("#studyMonitorMatrixUnitFilter", "unit-paused");
  await page.selectOption("#studyMonitorMatrixStatusFilter", "running");
  await page.selectOption("#studyMonitorMatrixAnswerFilter", "answered");
  await fillAndCommit("#studyMonitorMatrixLimit", "5");
  await participantUnitMatrixCard
    .locator(".record-collection-summary")
    .filter({ hasText: "2 visible records" })
    .waitFor();
  await participantUnitMatrixCard
    .locator(".record-card")
    .filter({
      has: page.getByRole("heading", {
        name: `${workspaceKey} participant matrix`
      })
    })
    .filter({ hasText: "Filtered Rows" })
    .filter({ hasText: "1" })
    .filter({ hasText: "Visible Limit" })
    .filter({ hasText: "5" })
    .waitFor();
  await clickAction("Apply Matrix Filters");
  const filteredParticipantMatrixJsonResponse = await fetch(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/study-monitor/participants?loginKey=${encodeURIComponent(participantLoginKey)}&unitKey=unit-paused&testRunStatus=running&answerState=answered&limit=5`,
    createSmokeFetchInit()
  );
  assert.equal(filteredParticipantMatrixJsonResponse.status, 200);
  const filteredParticipantMatrixJson =
    await filteredParticipantMatrixJsonResponse.json();
  assert.equal(
    filteredParticipantMatrixJson.studyMonitorParticipantMatrix.rows.length,
    1
  );
  const filteredParticipantMatrixRunCard = participantUnitMatrixCard
    .locator(".record-card")
    .filter({ hasText: participantLoginKey })
    .filter({ hasText: "unit-paused" })
    .filter({ hasText: "running" })
    .filter({ hasText: "answered" });
  await filteredParticipantMatrixRunCard
    .filter({ hasText: "Open Run Detail" })
    .filter({ hasText: "Open Participant Detail" })
    .filter({ hasText: "Review Response" })
    .filter({ hasText: "Open In Runtime" })
    .waitFor();
  logStep("study-monitor-participant-detail-review-response");
  await filteredParticipantMatrixRunCard
    .getByRole("button", { name: "Open Participant Detail" })
    .click();
  const activeParticipantDetailRunCard = page
    .locator("app-record-collection")
    .filter({ hasText: "Study Monitor Participant Detail" })
    .locator(".record-card")
    .filter({ hasText: pausedTestRunId })
    .filter({ hasText: participantSessionId })
    .filter({ hasText: "unit-paused" })
    .filter({ hasText: "answered" });
  await activeParticipantDetailRunCard
    .getByRole("button", { name: "Review Response" })
    .waitFor();
  await activeParticipantDetailRunCard
    .getByRole("button", { name: "Review Response" })
    .click();
  await page.waitForURL(/\/app\/runtime$/);
  await expectInputValue("#participantSessionId", participantSessionId);
  await expectInputValue("#testRunId", pausedTestRunId);
  await expectInputValue("#groupKey", participantGroupKey);
  await expectInputValue("#bookletKey", participantBookletKey);
  await expectInputValue("#currentUnitKey", "unit-paused");
  await expectInputValue("#detailedResponseLoginFilter", participantLoginKey);
  await expectInputValue("#detailedResponseGroupFilter", participantGroupKey);
  await expectInputValue("#detailedResponseBookletFilter", participantBookletKey);
  await expectInputValue("#detailedResponseSessionFilter", participantSessionId);
  await expectInputValue("#detailedResponseRunFilter", pausedTestRunId);
  await expectInputValue("#detailedResponseUnitFilter", "unit-paused");
  await expectInputValue("#reviewLoginFilter", participantLoginKey);
  await expectInputValue("#reviewGroupFilter", participantGroupKey);
  await expectInputValue("#reviewBookletFilter", participantBookletKey);
  await expectInputValue("#reviewSessionFilter", participantSessionId);
  await expectInputValue("#reviewRunFilter", pausedTestRunId);
  await expectInputValue("#reviewUnitFilter", "unit-paused");
  await expectInputValue("#openRunLoginFilter", participantLoginKey);
  await expectInputValue("#openRunGroupFilter", participantGroupKey);
  await expectInputValue("#openRunBookletFilter", participantBookletKey);
  await expectInputValue("#openRunSessionFilter", participantSessionId);
  await expectInputValue("#openRunRunFilter", pausedTestRunId);
  await expectInputValue("#openRunUnitFilter", "unit-paused");
  await page.locator('[data-view-nav="workspace"]').click();
  await page.waitForURL(/\/app\/workspace$/);
  stopAfter("study-monitor-participant-detail-review-response");
  logStep("study-monitor-matrix-open-runtime");
  await filteredParticipantMatrixRunCard
    .getByRole("button", { name: "Open In Runtime" })
    .click();
  await page.waitForURL(/\/app\/runtime$/);
  await expectInputValue("#participantSessionId", participantSessionId);
  await expectInputValue("#testRunId", pausedTestRunId);
  await expectInputValue("#groupKey", participantGroupKey);
  await expectInputValue("#bookletKey", participantBookletKey);
  await expectInputValue("#currentUnitKey", "unit-paused");
  await page.locator('[data-view-nav="workspace"]').click();
  await page.waitForURL(/\/app\/workspace$/);
  stopAfter("study-monitor-matrix-open-runtime");
  const filteredParticipantMatrixCsvResponse = await fetch(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/exports/study-monitor-participants.csv?loginKey=${encodeURIComponent(participantLoginKey)}&unitKey=unit-paused&testRunStatus=running&answerState=answered&limit=5`,
    createSmokeFetchInit()
  );
  assert.equal(filteredParticipantMatrixCsvResponse.status, 200);
  const filteredParticipantMatrixCsv =
    await filteredParticipantMatrixCsvResponse.text();
  assert.match(filteredParticipantMatrixCsv, /tenantKey,workspaceKey,generatedAt,loginKey/);
  assert.match(filteredParticipantMatrixCsv, new RegExp(participantLoginKey));
  assert.match(filteredParticipantMatrixCsv, /unit-paused/);
  assert.match(filteredParticipantMatrixCsv, /running/);
  assert.equal(filteredParticipantMatrixCsv.trim().split("\n").length, 2);
  await page.getByRole("button", { name: "Clear Matrix Filters" }).click();
  await participantUnitMatrixCard
    .locator(".record-collection-summary")
    .filter({ hasText: `${visibleParticipantMatrixRecords} visible records` })
    .waitFor();
  const monitorStatusDistributionCard = page.locator("article.card").filter({
    has: page.getByRole("heading", {
      name: "Monitor Status Distribution",
      exact: true
    })
  });
  await expectMonitorStatusCard(
    "Not Started",
    studyMonitorSummary.notStartedCount,
    "Expected participants without a launched run."
  );
  const runningMonitorStatusCard = await expectMonitorStatusCard(
    "Running",
    studyMonitorSummary.runningCount,
    "Runs currently marked as running."
  );
  await expectMonitorStatusCard(
    "Paused",
    studyMonitorSummary.pausedCount,
    "Runs saved as paused and resumable."
  );
  await expectMonitorStatusCard(
    "Completed",
    studyMonitorSummary.completedCount,
    "Runs completed by participants."
  );
  logStep("study-monitor-status-filter-matrix");
  await runningMonitorStatusCard
    .getByRole("button", { name: "Show In Matrix" })
    .click();
  await expectInputValue("#studyMonitorMatrixLoginFilter", "");
  await expectInputValue("#studyMonitorMatrixGroupFilter", "");
  await expectInputValue("#studyMonitorMatrixBookletFilter", "");
  await expectInputValue("#studyMonitorMatrixUnitFilter", "");
  await expectInputValue("#studyMonitorMatrixStatusFilter", "running");
  await expectInputValue("#studyMonitorMatrixAnswerFilter", "");
  await expectInputValue("#studyMonitorMatrixLimit", "25");
  await page
    .locator("article.card")
    .filter({ has: page.getByRole("heading", { name: "Participant Unit Matrix" }) })
    .locator(".record-card")
    .filter({ hasText: "running" })
    .first()
    .waitFor();
  await page.getByRole("button", { name: "Clear Matrix Filters" }).click();
  stopAfter("study-monitor-status-filter-matrix");
  const monitorBookletProgressCard = page.locator("article.card").filter({
    has: page.getByRole("heading", {
      name: "Monitor Booklet Progress",
      exact: true
    })
  });
  const starterBookletProgressCard = monitorBookletProgressCard
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: "Starter" }) })
    .filter({ hasText: "booklet:starter" })
    .filter({ hasText: "expected participant(s)" })
    .filter({ hasText: "Participant Sessions" })
    .filter({ hasText: "Open Booklet Detail" })
    .filter({ hasText: "Show In Matrix" });
  await starterBookletProgressCard.waitFor();
  logStep("study-monitor-booklet-filter-matrix");
  await starterBookletProgressCard
    .getByRole("button", { name: "Show In Matrix" })
    .click();
  await expectInputValue("#studyMonitorMatrixLoginFilter", "");
  await expectInputValue("#studyMonitorMatrixGroupFilter", "");
  await expectInputValue("#studyMonitorMatrixBookletFilter", "booklet:starter");
  await expectInputValue("#studyMonitorMatrixUnitFilter", "");
  await expectInputValue("#studyMonitorMatrixStatusFilter", "");
  await expectInputValue("#studyMonitorMatrixAnswerFilter", "");
  await expectInputValue("#studyMonitorMatrixLimit", "25");
  await participantUnitMatrixCard
    .locator(".record-card")
    .filter({ hasText: "booklet:starter" })
    .first()
    .waitFor();
  await page.getByRole("button", { name: "Clear Matrix Filters" }).click();
  stopAfter("study-monitor-booklet-filter-matrix");
  const monitorUnitProgressCard = page.locator("article.card").filter({
    has: page.getByRole("heading", {
      name: "Monitor Unit Progress",
      exact: true
    })
  });
  const pausedWorkUnitProgressCard = monitorUnitProgressCard
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: "Paused Work" }) })
    .filter({ hasText: "unit-paused" })
    .filter({ hasText: `${pausedWorkMissingResponseCount} missing` })
    .filter({ hasText: "Missing Responses" })
    .filter({ hasText: "Open Unit Detail" })
    .filter({ hasText: "Show In Matrix" });
  await pausedWorkUnitProgressCard.waitFor();
  logStep("study-monitor-unit-filter-matrix");
  await pausedWorkUnitProgressCard
    .getByRole("button", { name: "Show In Matrix" })
    .click();
  await expectInputValue("#studyMonitorMatrixLoginFilter", "");
  await expectInputValue("#studyMonitorMatrixGroupFilter", "");
  await expectInputValue("#studyMonitorMatrixBookletFilter", "");
  await expectInputValue("#studyMonitorMatrixUnitFilter", "unit-paused");
  await expectInputValue("#studyMonitorMatrixStatusFilter", "");
  await expectInputValue("#studyMonitorMatrixAnswerFilter", "");
  await expectInputValue("#studyMonitorMatrixLimit", "25");
  await participantUnitMatrixCard
    .locator(".record-card")
    .filter({ hasText: "unit-paused" })
    .first()
    .waitFor();
  await page.getByRole("button", { name: "Clear Matrix Filters" }).click();
  stopAfter("study-monitor-unit-filter-matrix");
  const monitorAttentionQueueCard = page.locator("article.card").filter({
    has: page.getByRole("heading", {
      name: "Monitor Attention Queue",
      exact: true
    })
  });
  await monitorAttentionQueueCard
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: "Paused Work" }) })
    .filter({ hasText: `${pausedWorkMissingResponseCount} missing response(s)` })
    .filter({
      hasText: `${pausedWorkAnsweredCount}/${pausedWorkExpectedRunCount} answered`
    })
    .filter({ hasText: "Missing Responses" })
    .filter({ hasText: "Attention Score" })
    .filter({ hasText: String(pausedWorkAttentionSummary?.score ?? "") })
    .filter({ hasText: "Open Unit Detail" })
    .waitFor();
  const entrySmokeAttentionGroupCard = monitorAttentionQueueCard
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: "group:entry-smoke" }) })
    .filter({ hasText: "2 waiting, 0 active run(s)" })
    .filter({ hasText: "2 not started" })
    .filter({ hasText: "Attention Score" })
    .filter({ hasText: "60" })
    .filter({ hasText: "Open Group Detail" })
    .filter({ hasText: "Show In Matrix" });
  await entrySmokeAttentionGroupCard.waitFor();
  logStep("study-monitor-group-filter-matrix");
  await entrySmokeAttentionGroupCard
    .getByRole("button", { name: "Show In Matrix" })
    .click();
  await expectInputValue("#studyMonitorMatrixLoginFilter", "");
  await expectInputValue("#studyMonitorMatrixGroupFilter", "group:entry-smoke");
  await expectInputValue("#studyMonitorMatrixBookletFilter", "");
  await expectInputValue("#studyMonitorMatrixUnitFilter", "");
  await expectInputValue("#studyMonitorMatrixStatusFilter", "");
  await expectInputValue("#studyMonitorMatrixAnswerFilter", "");
  await expectInputValue("#studyMonitorMatrixLimit", "25");
  await participantUnitMatrixCard
    .locator(".record-card")
    .filter({ hasText: "group:entry-smoke" })
    .first()
    .waitFor();
  await page.getByRole("button", { name: "Clear Matrix Filters" }).click();
  stopAfter("study-monitor-group-filter-matrix");
  const monitorReviewQueueCard = page.locator("article.card").filter({
    has: page.getByRole("heading", {
      name: "Monitor Review Queue",
      exact: true
    })
  });
  const monitorReviewQueueStudentCard = monitorReviewQueueCard
    .locator(".record-card")
    .filter({ hasText: participantLoginKey })
    .filter({ hasText: "unit-paused" })
    .filter({ hasText: "answered" })
    .filter({ hasText: "reviewed" })
    .filter({ hasText: "1 review(s)" })
    .filter({ hasText: "Open Run Detail" })
    .filter({ hasText: "Review Response" })
    .filter({ hasText: "Open In Runtime" });
  await monitorReviewQueueStudentCard.waitFor();
  logStep("study-monitor-review-queue-review-response");
  await monitorReviewQueueStudentCard
    .getByRole("button", { name: "Review Response" })
    .click();
  await page.waitForURL(/\/app\/runtime$/);
  await expectInputValue("#participantSessionId", participantSessionId);
  await expectInputValue("#testRunId", pausedTestRunId);
  await expectInputValue("#groupKey", participantGroupKey);
  await expectInputValue("#bookletKey", participantBookletKey);
  await expectInputValue("#currentUnitKey", "unit-paused");
  await expectInputValue("#detailedResponseLoginFilter", participantLoginKey);
  await expectInputValue("#detailedResponseGroupFilter", participantGroupKey);
  await expectInputValue("#detailedResponseBookletFilter", participantBookletKey);
  await expectInputValue("#detailedResponseSessionFilter", participantSessionId);
  await expectInputValue("#detailedResponseRunFilter", pausedTestRunId);
  await expectInputValue("#detailedResponseUnitFilter", "unit-paused");
  await expectInputValue("#reviewLoginFilter", participantLoginKey);
  await expectInputValue("#reviewGroupFilter", participantGroupKey);
  await expectInputValue("#reviewBookletFilter", participantBookletKey);
  await expectInputValue("#reviewSessionFilter", participantSessionId);
  await expectInputValue("#reviewRunFilter", pausedTestRunId);
  await expectInputValue("#reviewUnitFilter", "unit-paused");
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Detailed Responses", exact: true })
    })
    .filter({ hasText: "Filtered response smoke" })
    .filter({ hasText: pausedTestRunId })
    .filter({ hasText: "unit-paused" })
    .waitFor();
  await page
    .locator("article.card")
    .filter({ has: page.getByRole("heading", { name: "Reviews", exact: true }) })
    .filter({ hasText: "Filtered review smoke" })
    .filter({ hasText: pausedTestRunId })
    .filter({ hasText: "unit-paused" })
    .waitFor();
  await page.locator('[data-view-nav="workspace"]').click();
  await page.waitForURL(/\/app\/workspace$/);
  stopAfter("study-monitor-review-queue-review-response");
  const studyMonitorDownloadPromise = page.waitForEvent("download");
  await clickAction("Export Study Monitor CSV");
  const studyMonitorDownload = await studyMonitorDownloadPromise;
  assert.equal(
    studyMonitorDownload.suggestedFilename(),
    `${workspaceKey}-study-monitor.csv`
  );
  await page
    .locator("#studyMonitorExportPreview")
    .filter({ hasText: "tenantKey,workspaceKey,section" })
    .filter({ hasText: "unit-paused" })
    .filter({ hasText: "not_started_participant" })
    .waitFor();
  const participantMatrixDownloadPromise = page.waitForEvent("download");
  await clickAction("Export Participant Matrix CSV");
  const participantMatrixDownload = await participantMatrixDownloadPromise;
  assert.equal(
    participantMatrixDownload.suggestedFilename(),
    `${workspaceKey}-study-monitor-participants.csv`
  );
  await page
    .locator("#studyMonitorParticipantMatrixExportPreview")
    .filter({ hasText: "tenantKey,workspaceKey,generatedAt,loginKey" })
    .filter({ hasText: participantLoginKey })
    .filter({ hasText: "unit-paused" })
    .filter({ hasText: "running" })
    .waitFor();
  await studyMonitorCard
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: "group:entry-smoke" }) })
    .filter({ hasText: "2 expected" })
    .filter({ hasText: "0 session(s)" })
    .filter({ hasText: "2 not started" })
    .filter({ hasText: "Roster Entries" })
    .waitFor();
  await studyMonitorCard
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: "group:xml-entry" }) })
    .filter({ hasText: "1 expected" })
    .filter({ hasText: "0 session(s)" })
    .filter({ hasText: "1 not started" })
    .filter({ hasText: "Roster Entries" })
    .waitFor();
  const notStartedParticipantsCard = page.locator("article.card").filter({
    has: page.getByRole("heading", {
      name: "Not Started Participants",
      exact: true
    })
  });
  const notStartedAdaCard = notStartedParticipantsCard
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: "Ada Entry" }) })
    .filter({ hasText: "entry-student-a" })
    .filter({ hasText: "group:entry-smoke" })
    .filter({ hasText: "booklet:starter" })
    .filter({ hasText: participantEntryUrlPrefix });
  await notStartedAdaCard.waitFor();
  await expectParticipantEntryAnchor(notStartedAdaCard, [
    "loginKey=entry-student-a",
    "groupKey=group%3Aentry-smoke",
    "bookletKey=booklet%3Astarter"
  ]);
  await notStartedAdaCard.getByRole("button", { name: "Prepare Runtime" }).click();
  await page.waitForURL(/\/app\/runtime$/);
  await expectInputValue("#loginKey", "entry-student-a");
  await expectInputValue("#groupKey", "group:entry-smoke");
  await expectInputValue("#bookletKey", "booklet:starter");
  await expectInputValue("#participantSessionId", "");
  await expectInputValue("#testRunId", "");
  const runtimeActionQueueCard = page.locator("article.card").filter({
    has: page.getByRole("heading", { name: "Runtime Action Queue" })
  });
  const startPreparedParticipantCard = runtimeActionQueueCard
    .locator(".record-card")
    .filter({
      has: page.getByRole("heading", { name: "Start prepared participant" })
    })
    .filter({ hasText: "entry-student-a" })
    .filter({ hasText: "group:entry-smoke" })
    .filter({ hasText: "booklet:starter" })
    .filter({ hasText: "Create a participant session and start the first run" });
  await startPreparedParticipantCard.waitFor();
  if (stopAfterStep === "study-monitor-not-started-start-prepared-runtime") {
    await startPreparedParticipantCard
      .getByRole("button", { name: "Apply Suggestion", exact: true })
      .click();
    await waitForBusy("start-prepared-participant-after-click");
    await waitForNotBusy("start-prepared-participant-after-click");
    await waitForInputMinLength("#participantSessionId", 1);
    await waitForInputMinLength("#testRunId", 1);
    const preparedParticipantSessionId = await page
      .locator("#participantSessionId")
      .inputValue();
    const preparedTestRunId = await page.locator("#testRunId").inputValue();
    await pollJsonWithPredicate(
      `${baseUrl}/api/v1/participant/sessions/${preparedParticipantSessionId}/current-state`,
      payload =>
        typeof payload === "object" &&
        payload != null &&
        "currentRunState" in payload &&
        typeof payload.currentRunState === "object" &&
        payload.currentRunState != null &&
        payload.currentRunState.participantSession?.loginKey ===
          "entry-student-a" &&
        payload.currentRunState.testRun?.testRunId === preparedTestRunId &&
        payload.currentRunState.testRun?.status === "running" &&
        payload.currentRunState.testRun?.bookletKey === "booklet:starter"
    );
    stopAfter("study-monitor-not-started-start-prepared-runtime");
  }
  await page.locator('[data-view-nav="workspace"]').click();
  await page.waitForURL(/\/app\/workspace$/);
  await notStartedAdaCard.waitFor();
  stopAfter("study-monitor-not-started-prepare-runtime");
  await notStartedParticipantsCard
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: "Ben Entry" }) })
    .filter({ hasText: "entry-student-b" })
    .filter({ hasText: "group:entry-smoke" })
    .filter({ hasText: "default booklet" })
    .filter({ hasText: participantEntryUrlPrefix })
    .waitFor();
  await notStartedParticipantsCard
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: "Xml Entry" }) })
    .filter({ hasText: "entry-student-xml" })
    .filter({ hasText: "group:xml-entry" })
    .filter({ hasText: "default booklet" })
    .filter({ hasText: participantEntryUrlPrefix })
    .waitFor();
  await clickCardAction("Study Monitor", "Open Group Detail", "group:entry-smoke");
  await page.waitForFunction(
    participantEntryUrlPrefix => {
      const detailCard = Array.from(document.querySelectorAll("article.card")).find(
        card =>
          card.querySelector("h3")?.textContent?.trim() ===
          "Study Monitor Group Detail"
      );
      return (
        detailCard?.textContent?.includes("group:entry-smoke") &&
        detailCard.textContent.includes("entry-student-a") &&
        detailCard.textContent.includes("Ada Entry") &&
        detailCard.textContent.includes("entry-student-b") &&
        detailCard.textContent.includes("Ben Entry") &&
        detailCard.textContent.includes("not signed in") &&
        detailCard.textContent.includes("booklet:starter") &&
        detailCard.textContent.includes(participantEntryUrlPrefix)
      );
    },
    participantEntryUrlPrefix,
    { timeout: 15_000 }
  );
  const groupDetailAdaCard = page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Study Monitor Group Detail" })
    })
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: "Ada Entry" }) })
    .filter({ hasText: "entry-student-a" });
  await expectParticipantEntryAnchor(groupDetailAdaCard, [
    "loginKey=entry-student-a",
    "groupKey=group%3Aentry-smoke",
    "bookletKey=booklet%3Astarter"
  ]);
  logStep("study-monitor-group-detail-prepare-runtime");
  await groupDetailAdaCard
    .getByRole("button", { name: "Prepare Runtime" })
    .click();
  await page.waitForURL(/\/app\/runtime$/);
  await expectInputValue("#loginKey", "entry-student-a");
  await expectInputValue("#groupKey", "group:entry-smoke");
  await expectInputValue("#bookletKey", "booklet:starter");
  await expectInputValue("#participantSessionId", "");
  await expectInputValue("#testRunId", "");
  await page.locator('[data-view-nav="workspace"]').click();
  await page.waitForURL(/\/app\/workspace$/);
  stopAfter("study-monitor-group-detail-prepare-runtime");
  await groupDetailAdaCard
    .getByRole("button", { name: "Open Participant Detail" })
    .click();
  await expectStudyMonitorParticipantDetail("entry-student-a", [
    "group:entry-smoke",
    "Ada Entry",
    "booklet:starter",
    "missing"
  ]);
  await studyMonitorCard
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: "Paused Work" }) })
    .filter({ hasText: "unit-paused" })
    .filter({
      hasText: `${pausedWorkAnsweredCount}/${pausedWorkExpectedRunCount} answered`
    })
    .filter({ hasText: `${pausedWorkMissingResponseCount} missing` })
    .filter({ hasText: "Roster Expected" })
    .waitFor();
  await studyMonitorCard
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: "Starter" }) })
    .filter({ hasText: "booklet:starter" })
    .waitFor();
  await clickCardAction("Study Monitor", "Open Booklet Detail", "Starter");
  await page.waitForFunction(
    participantEntryUrlPrefix => {
      const detailCard = Array.from(document.querySelectorAll("article.card")).find(
        card =>
          card.querySelector("h3")?.textContent?.trim() ===
          "Study Monitor Booklet Detail"
      );
      return (
        detailCard?.textContent?.includes("booklet:starter") &&
        detailCard.textContent.includes("Roster Entries") &&
        detailCard.textContent.includes("entry-student-a") &&
        detailCard.textContent.includes("Ada Entry") &&
        detailCard.textContent.includes(participantEntryUrlPrefix) &&
        detailCard.textContent.includes("student-ui") &&
        detailCard.textContent.includes("unit-paused") &&
        detailCard.textContent.includes("run(s)")
      );
    },
    participantEntryUrlPrefix,
    { timeout: 15_000 }
  );
  const bookletDetailStudentCard = page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Study Monitor Booklet Detail" })
    })
    .locator(".record-card")
    .filter({ hasText: "student-ui" })
    .filter({ hasText: pausedTestRunId })
    .filter({ hasText: participantSessionId });
  await bookletDetailStudentCard
    .getByRole("button", { name: "Review Response" })
    .waitFor();
  logStep("study-monitor-booklet-detail-review-response");
  await bookletDetailStudentCard
    .getByRole("button", { name: "Review Response" })
    .click();
  await expectRuntimeReviewHandoff({
    loginKey: participantLoginKey,
    groupKey: participantGroupKey,
    bookletKey: participantBookletKey,
    participantSessionId,
    testRunId: pausedTestRunId,
    unitKey: "unit-paused"
  });
  await page.locator('[data-view-nav="workspace"]').click();
  await page.waitForURL(/\/app\/workspace$/);
  stopAfter("study-monitor-booklet-detail-review-response");
  const bookletDetailAdaCard = page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Study Monitor Booklet Detail" })
    })
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: "Ada Entry" }) })
    .filter({ hasText: "entry-student-a" });
  await expectParticipantEntryAnchor(bookletDetailAdaCard, [
    "loginKey=entry-student-a",
    "groupKey=group%3Aentry-smoke",
    "bookletKey=booklet%3Astarter"
  ]);
  logStep("study-monitor-booklet-detail-prepare-runtime");
  await bookletDetailAdaCard
    .getByRole("button", { name: "Prepare Runtime" })
    .click();
  await page.waitForURL(/\/app\/runtime$/);
  await expectInputValue("#loginKey", "entry-student-a");
  await expectInputValue("#groupKey", "group:entry-smoke");
  await expectInputValue("#bookletKey", "booklet:starter");
  await expectInputValue("#participantSessionId", "");
  await expectInputValue("#testRunId", "");
  await page.locator('[data-view-nav="workspace"]').click();
  await page.waitForURL(/\/app\/workspace$/);
  stopAfter("study-monitor-booklet-detail-prepare-runtime");
  await bookletDetailAdaCard
    .getByRole("button", { name: "Open Participant Detail" })
    .click();
  await expectStudyMonitorParticipantDetail("entry-student-a", [
    "group:entry-smoke",
    "Ada Entry",
    "booklet:starter",
    "missing"
  ]);
  logStep("action-study-monitor-group:student-ui-start");
  const studentGroupSummaryCard = studyMonitorCard
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: participantGroupKey }) });
  await studentGroupSummaryCard.waitFor({ state: "visible", timeout: 15_000 });
  const studentGroupDetailResponse = page.waitForResponse(
    response =>
      response
        .url()
        .includes(`/study-monitor/groups/${encodeURIComponent(participantGroupKey)}`) &&
      response.status() === 200,
    { timeout: 15_000 }
  );
  await studentGroupSummaryCard
    .getByRole("button", { name: "Open Group Detail", exact: true })
    .click();
  await studentGroupDetailResponse;
  await waitForNotBusy("study-monitor-group-student-ui-after-click");
  logStep("action-study-monitor-group:student-ui-done");
  const studyMonitorGroupDetailCard = page.locator("article.card").filter({
    has: page.getByRole("heading", {
      name: "Study Monitor Group Detail",
      exact: true
    })
  });
  await studyMonitorGroupDetailCard
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: "group:student-ui" }) })
    .filter({ hasText: "student-ui" })
    .filter({ hasText: "run(s)" })
    .filter({ hasText: "Missing Responses" })
    .waitFor({ state: "visible", timeout: 15_000 });
  await studyMonitorGroupDetailCard
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: "Paused Work" }) })
    .filter({ hasText: "unit-paused" })
    .filter({ hasText: "answered" })
    .filter({ hasText: "missing" })
    .waitFor({ state: "visible", timeout: 15_000 });
  const activeGroupDetailStudentCard = page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Study Monitor Group Detail" })
    })
    .locator(".record-card")
    .filter({ hasText: "student-ui" })
    .filter({ hasText: participantSessionId })
    .first();
  await activeGroupDetailStudentCard
    .getByRole("link", { name: operatorParticipantSessionLink })
    .waitFor();
  const activeGroupDetailRunCard = studyMonitorGroupDetailCard
    .locator(".record-card")
    .filter({ hasText: "student-ui" })
    .filter({ hasText: pausedTestRunId })
    .filter({ hasText: participantSessionId });
  await activeGroupDetailRunCard
    .getByRole("button", { name: "Review Response" })
    .waitFor();
  logStep("study-monitor-group-detail-review-response");
  await activeGroupDetailRunCard
    .getByRole("button", { name: "Review Response" })
    .click();
  await expectRuntimeReviewHandoff({
    loginKey: participantLoginKey,
    groupKey: participantGroupKey,
    bookletKey: participantBookletKey,
    participantSessionId,
    testRunId: pausedTestRunId,
    unitKey: "unit-paused"
  });
  await page.locator('[data-view-nav="workspace"]').click();
  await page.waitForURL(/\/app\/workspace$/);
  stopAfter("study-monitor-group-detail-review-response");
  await clickCardAction("Study Monitor", "Open Unit Detail", "Paused Work");
  await page.waitForFunction(
    expected => {
      const detailCard = Array.from(document.querySelectorAll("article.card")).find(
        card =>
          card.querySelector("h3")?.textContent?.trim() ===
          "Study Monitor Unit Detail"
      );
      return (
        detailCard?.textContent?.includes("unit-paused") &&
        detailCard.textContent.includes(expected.missingText) &&
        detailCard.textContent.includes("Roster Expected") &&
        detailCard.textContent.includes("entry-student-a") &&
        detailCard.textContent.includes("Ada Entry") &&
        detailCard.textContent.includes(expected.participantEntryUrlPrefix) &&
        detailCard.textContent.includes("student-ui") &&
        detailCard.textContent.includes("answered")
      );
    },
    {
      participantEntryUrlPrefix,
      missingText: `${pausedWorkMissingResponseCount} missing`
    },
    { timeout: 15_000 }
  );
  const activeUnitDetailStudentCard = page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Study Monitor Unit Detail" })
    })
    .locator(".record-card")
    .filter({ hasText: "student-ui" })
    .filter({ hasText: "answered" })
    .first();
  await activeUnitDetailStudentCard
    .getByRole("link", { name: operatorParticipantSessionLink })
    .waitFor();
  logStep("study-monitor-unit-detail-review-response");
  await activeUnitDetailStudentCard
    .getByRole("button", { name: "Review Response" })
    .click();
  await page.waitForURL(/\/app\/runtime$/);
  await expectInputValue("#participantSessionId", participantSessionId);
  await expectInputValue("#testRunId", pausedTestRunId);
  await expectInputValue("#groupKey", participantGroupKey);
  await expectInputValue("#bookletKey", participantBookletKey);
  await expectInputValue("#currentUnitKey", "unit-paused");
  await expectInputValue("#detailedResponseLoginFilter", participantLoginKey);
  await expectInputValue("#detailedResponseGroupFilter", participantGroupKey);
  await expectInputValue("#detailedResponseBookletFilter", participantBookletKey);
  await expectInputValue("#detailedResponseSessionFilter", participantSessionId);
  await expectInputValue("#detailedResponseRunFilter", pausedTestRunId);
  await expectInputValue("#detailedResponseUnitFilter", "unit-paused");
  await expectInputValue("#reviewLoginFilter", participantLoginKey);
  await expectInputValue("#reviewGroupFilter", participantGroupKey);
  await expectInputValue("#reviewBookletFilter", participantBookletKey);
  await expectInputValue("#reviewSessionFilter", participantSessionId);
  await expectInputValue("#reviewRunFilter", pausedTestRunId);
  await expectInputValue("#reviewUnitFilter", "unit-paused");
  await expectInputValue("#openRunLoginFilter", participantLoginKey);
  await expectInputValue("#openRunGroupFilter", participantGroupKey);
  await expectInputValue("#openRunBookletFilter", participantBookletKey);
  await expectInputValue("#openRunSessionFilter", participantSessionId);
  await expectInputValue("#openRunRunFilter", pausedTestRunId);
  await expectInputValue("#openRunUnitFilter", "unit-paused");
  await page.locator('[data-view-nav="workspace"]').click();
  await page.waitForURL(/\/app\/workspace$/);
  stopAfter("study-monitor-unit-detail-review-response");
  logStep("study-monitor-unit-detail-open-runtime");
  await activeUnitDetailStudentCard
    .getByRole("button", { name: "Open In Runtime" })
    .click();
  await page.waitForURL(/\/app\/runtime$/);
  await expectInputValue("#participantSessionId", participantSessionId);
  await expectInputValue("#testRunId", pausedTestRunId);
  await expectInputValue("#groupKey", participantGroupKey);
  await expectInputValue("#bookletKey", participantBookletKey);
  await expectInputValue("#currentUnitKey", "unit-paused");
  await page.locator('[data-view-nav="workspace"]').click();
  await page.waitForURL(/\/app\/workspace$/);
  stopAfter("study-monitor-unit-detail-open-runtime");
  const unitDetailAdaCard = page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Study Monitor Unit Detail" })
    })
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: "Ada Entry" }) })
    .filter({ hasText: "entry-student-a" });
  await expectParticipantEntryAnchor(unitDetailAdaCard, [
    "loginKey=entry-student-a",
    "groupKey=group%3Aentry-smoke",
    "bookletKey=booklet%3Astarter"
  ]);
  logStep("study-monitor-unit-detail-prepare-runtime");
  await unitDetailAdaCard
    .getByRole("button", { name: "Prepare Runtime" })
    .click();
  await page.waitForURL(/\/app\/runtime$/);
  await expectInputValue("#loginKey", "entry-student-a");
  await expectInputValue("#groupKey", "group:entry-smoke");
  await expectInputValue("#bookletKey", "booklet:starter");
  await expectInputValue("#participantSessionId", "");
  await expectInputValue("#testRunId", "");
  await page.locator('[data-view-nav="workspace"]').click();
  await page.waitForURL(/\/app\/workspace$/);
  stopAfter("study-monitor-unit-detail-prepare-runtime");
  await unitDetailAdaCard
    .getByRole("button", { name: "Open Participant Detail" })
    .click();
  await expectStudyMonitorParticipantDetail("entry-student-a", [
    "group:entry-smoke",
    "Ada Entry",
    "booklet:starter",
    "missing"
  ]);

  logStep("nav-content-blocked-activation");
  await page.locator('[data-view-nav="content"]').click();
  await page.waitForURL(/\/app\/content$/);
  logStep("blocked-activation-flow");
  await fillAndCommit("#sourceFileName", "blocked-activation.xml");
  await fillAndCommit("#sourceMediaType", "application/xml");
  await fillAndCommit("#sourceDocument", repairedImportSourceDocument);
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

  logStep("open-blocking-run-in-runtime");
  const activationBlockingStudentCard = page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Activation Blocking Runs" })
    })
    .locator(".record-card")
    .filter({ hasText: participantLoginKey });
  await activationBlockingStudentCard
    .getByRole("link", { name: operatorParticipantSessionLink })
    .waitFor();
  await activationBlockingStudentCard
    .getByRole("button", { name: "Open In Runtime" })
    .first()
    .click();
  await page.waitForURL(/\/app\/runtime$/);
  await expectInputValue("#participantSessionId", participantSessionId);
  await expectInputValue("#testRunId", pausedTestRunId);
  await expectInputValue("#groupKey", participantGroupKey);
  await expectInputValue("#bookletKey", participantBookletKey);
  await expectInputValue("#currentUnitKey", "unit-paused");
  await expectInputValue("#detailedResponseLoginFilter", participantLoginKey);
  await expectInputValue("#detailedResponseGroupFilter", participantGroupKey);
  await expectInputValue("#detailedResponseBookletFilter", participantBookletKey);
  await expectInputValue("#detailedResponseSessionFilter", participantSessionId);
  await expectInputValue("#detailedResponseRunFilter", pausedTestRunId);
  await expectInputValue("#detailedResponseUnitFilter", "unit-paused");
  await expectInputValue("#reviewLoginFilter", participantLoginKey);
  await expectInputValue("#reviewGroupFilter", participantGroupKey);
  await expectInputValue("#reviewBookletFilter", participantBookletKey);
  await expectInputValue("#reviewSessionFilter", participantSessionId);
  await expectInputValue("#reviewRunFilter", pausedTestRunId);
  await expectInputValue("#reviewUnitFilter", "unit-paused");
  await expectInputValue("#openRunLoginFilter", participantLoginKey);
  await expectInputValue("#openRunGroupFilter", participantGroupKey);
  await expectInputValue("#openRunBookletFilter", participantBookletKey);
  await expectInputValue("#openRunSessionFilter", participantSessionId);
  await expectInputValue("#openRunRunFilter", pausedTestRunId);
  await expectInputValue("#openRunUnitFilter", "unit-paused");
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
      payload.currentRunState.testRun.testRunId === pausedTestRunId
  );
  stopAfter("open-blocking-run-in-runtime");

  logStep("nav-content-after-blocking-run");
  await page.locator('[data-view-nav="content"]').click();
  await page.waitForURL(/\/app\/content$/);

  logStep("nav-workspace-activity");
  await page.locator('[data-view-nav="workspace"]').click();
  await page.waitForURL(/\/app\/workspace$/);
  logStep("filter-workspace-activity");
  await selectAndCommit("#workspaceActivityEventType", "participant_session_resumed");
  await selectAndCommit("#workspaceActivitySubjectType", "test_run");
  await fillAndCommit("#workspaceActivitySubjectId", pausedTestRunId);
  await fillAndCommit("#workspaceActivityLimit", "5");
  await clickAction("Refresh Activity");
  const filteredWorkspaceActivityPayload = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/activity-events?eventType=participant_session_resumed&subjectType=test_run&subjectId=${pausedTestRunId}&limit=5`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.length > 0
  );
  const filteredWorkspaceActivityDisplayedEvents = Math.min(
    filteredWorkspaceActivityPayload.items.length,
    8
  );
  const filteredWorkspaceActivityHiddenEvents = Math.max(
    filteredWorkspaceActivityPayload.items.length -
      filteredWorkspaceActivityDisplayedEvents,
    0
  );
  const filteredWorkspaceActivityDisplayedDetails = Math.min(
    filteredWorkspaceActivityPayload.items.length,
    5
  );
  const filteredWorkspaceActivityHiddenDetails = Math.max(
    filteredWorkspaceActivityPayload.items.length -
      filteredWorkspaceActivityDisplayedDetails,
    0
  );
  const workspaceActivityCard = page.locator("article.card").filter({
    has: page.getByRole("heading", { name: "Workspace Activity", exact: true })
  });
  const workspaceActivityDetailCard = page.locator("article.card").filter({
    has: page.getByRole("heading", {
      name: "Workspace Activity Detail",
      exact: true
    })
  });
  await workspaceActivityCard
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: "Workspace activity window" }) })
    .filter({
      hasText: `${filteredWorkspaceActivityPayload.items.length} event(s) loaded for the current filters`
    })
    .filter({ hasText: "Loaded Events" })
    .filter({ hasText: String(filteredWorkspaceActivityPayload.items.length) })
    .filter({ hasText: "Displayed Events" })
    .filter({ hasText: String(filteredWorkspaceActivityDisplayedEvents) })
    .filter({ hasText: "Hidden Events" })
    .filter({ hasText: String(filteredWorkspaceActivityHiddenEvents) })
    .filter({ hasText: "Limit" })
    .filter({ hasText: "5" })
    .waitFor();
  await workspaceActivityDetailCard
    .locator(".record-card")
    .filter({
      has: page.getByRole("heading", {
        name: "Workspace activity detail window"
      })
    })
    .filter({
      hasText: `${filteredWorkspaceActivityPayload.items.length} event payload(s) loaded for the current filters`
    })
    .filter({ hasText: "Loaded Events" })
    .filter({ hasText: String(filteredWorkspaceActivityPayload.items.length) })
    .filter({ hasText: "Displayed Details" })
    .filter({ hasText: String(filteredWorkspaceActivityDisplayedDetails) })
    .filter({ hasText: "Hidden Details" })
    .filter({ hasText: String(filteredWorkspaceActivityHiddenDetails) })
    .filter({ hasText: "Limit" })
    .filter({ hasText: "5" })
    .waitFor();
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Workspace Activity" })
    })
    .locator(
      `a[href^="${baseUrl}/participant?"][href*="participantSessionId=${encodeURIComponent(
        participantSessionId
      )}"]`
    )
    .first()
    .waitFor();
  logStep("export-workspace-log-csv");
  const workspaceLogDownloadPromise = page.waitForEvent("download");
  await clickAction("Export Workspace Logs CSV");
  const workspaceLogDownload = await workspaceLogDownloadPromise;
  assert.equal(workspaceLogDownload.suggestedFilename(), `${workspaceKey}-logs.csv`);
  await page
    .locator("#workspaceLogExportPreview")
    .filter({ hasText: "tenantKey,workspaceKey,activityEventId,eventType" })
    .filter({ hasText: "participant_session_resumed" })
    .filter({ hasText: "test_run_progress_saved" })
    .filter({ hasText: pausedTestRunId })
    .waitFor();
  logStep("open-activity-subject");
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Workspace Activity" })
    })
    .locator(".record-card")
    .filter({ hasText: "participant_session_resumed" })
    .first()
    .getByRole("button", { name: "Open Subject" })
    .click();
  await page.waitForURL(/\/app\/runtime$/);
  await expectInputValue("#participantSessionId", participantSessionId);
  await expectInputValue("#testRunId", pausedTestRunId);
  await expectInputValue("#groupKey", participantGroupKey);
  await expectInputValue("#bookletKey", participantBookletKey);
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
      payload.currentRunState.testRun.testRunId === pausedTestRunId
  );

  logStep("nav-content-after-activity-subject");
  await page.locator('[data-view-nav="content"]').click();
  await page.waitForURL(/\/app\/content$/);

  await page.locator("#sourceFileName").waitFor();
  await fillAndCommit("#sourceFileName", "broken.json");
  await fillAndCommit("#sourceMediaType", "application/json");
  await expectInputValue("#sourceMediaType", "application/json");
  await fillAndCommit("#sourceDocument", failedImportSourceDocument);
  await clickAction("Create Source Package");

  const failedSourcePackagesPayload = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.some(
        item =>
          item?.sourcePackage?.mediaType === "application/json" &&
          item?.sourcePackage?.sourceDocument === failedImportSourceDocument
      )
  );
  const failedSourcePackageId = failedSourcePackagesPayload.items.find(
    item =>
      item?.sourcePackage?.mediaType === "application/json" &&
      item?.sourcePackage?.sourceDocument === failedImportSourceDocument
  )?.sourcePackage?.sourcePackageId;
  assert.ok(
    failedSourcePackageId,
    "UI smoke expected a source package id for the failed import scenario."
  );

  await fillAndCommit("#sourcePackageId", failedSourcePackageId);
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
  await expectButtonSelectorEnabled("#retrySourcePackageImportButton");

  await fillAndCommit("#sourceFileName", "fixed.xml");
  await fillAndCommit("#sourceMediaType", "application/xml");
  await expectInputValue("#sourceMediaType", "application/xml");
  await fillAndCommit("#sourceDocument", repairedImportSourceDocument);
  logStep("retry-failed-import");
  await clickAction("Retry Failed Import");
  const retriedSourcePackagePayload = await pollJsonWithPredicate(
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
  const completedRetryImportJobId =
    retriedSourcePackagePayload.sourcePackageDetail.importJobs.find(
      importJob => importJob?.status === "completed"
    )?.importJobId;
  const retriedSourcePackageFileName =
    retriedSourcePackagePayload.sourcePackageDetail.sourcePackage.fileName;
  const retriedContentReleaseId =
    retriedSourcePackagePayload.sourcePackageDetail.contentReleases.at(-1)
      ?.contentReleaseId;
  assert.ok(
    completedRetryImportJobId,
    "UI smoke expected the retried import to expose a completed import job id."
  );
  assert.ok(
    retriedContentReleaseId,
    "UI smoke expected the retried import to expose a staged content release id."
  );
  assert.equal(typeof retriedSourcePackageFileName, "string");
  logStep("content-read-filters");
  await selectAndCommit("#sourcePackageStatusFilter", "accepted");
  await fillAndCommit("#sourcePackageMediaTypeFilter", "application/xml");
  await fillAndCommit("#sourcePackageFileNameFilter", retriedSourcePackageFileName);
  await selectAndCommit("#sourcePackageLatestImportStatusFilter", "completed");
  await fillAndCommit("#sourcePackageLimit", "1");
  await selectAndCommit("#importJobStatusFilter", "completed");
  await fillAndCommit("#importJobSourcePackageFilter", failedSourcePackageId);
  await fillAndCommit("#importJobLimit", "1");
  await selectAndCommit("#contentReleaseStatusFilter", "staged");
  await fillAndCommit("#contentReleaseImportJobFilter", completedRetryImportJobId);
  await fillAndCommit("#contentReleaseSourcePackageFilter", failedSourcePackageId);
  await fillAndCommit("#contentReleaseLimit", "1");
  await clickContentFilterApply();
  await page
    .locator("article.card")
    .filter({ has: page.getByRole("heading", { name: "Source Packages" }) })
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: "Source package window" }) })
    .filter({ hasText: "1 source package row(s) loaded for the current filters" })
    .filter({ hasText: "4 active filter(s)" })
    .filter({ hasText: "limit 1" })
    .filter({ hasText: "Loaded Records" })
    .filter({ hasText: "status, media type, file name, latest import" })
    .waitFor();
  await page
    .locator("article.card")
    .filter({ has: page.getByRole("heading", { name: "Source Packages" }) })
    .filter({ hasText: retriedSourcePackageFileName })
    .filter({ hasText: "completed" })
    .waitFor();
  await page
    .locator("article.card")
    .filter({ has: page.getByRole("heading", { name: "Import Jobs" }) })
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: "Import job window" }) })
    .filter({ hasText: "1 import job row(s) loaded for the current filters" })
    .filter({ hasText: "2 active filter(s)" })
    .filter({ hasText: "limit 1" })
    .filter({ hasText: "Loaded Records" })
    .filter({ hasText: "status, source package" })
    .waitFor();
  await page
    .locator("article.card")
    .filter({ has: page.getByRole("heading", { name: "Import Jobs" }) })
    .filter({ hasText: "completed" })
    .filter({ hasText: completedRetryImportJobId })
    .waitFor();
  await page
    .locator("article.card")
    .filter({ has: page.getByRole("heading", { name: "Content Releases" }) })
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: "Content release window" }) })
    .filter({ hasText: "1 content release row(s) loaded for the current filters" })
    .filter({ hasText: "3 active filter(s)" })
    .filter({ hasText: "limit 1" })
    .filter({ hasText: "Loaded Records" })
    .filter({ hasText: "status, import job, source package" })
    .waitFor();
  await page
    .locator("article.card")
    .filter({ has: page.getByRole("heading", { name: "Content Releases" }) })
    .filter({ hasText: "staged" })
    .waitFor();
  stopAfter("content-read-filters");

  logStep("nav-runtime-before-complete");
  await page.locator('[data-view-nav="runtime"]').click();
  await page.waitForURL(/\/app\/runtime$/);
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
  await fillAndCommit("#testRunId", pausedTestRunId);
  logStep("monitor-complete-run");
  await clickAction("Monitor Complete");
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
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/monitor/open-runs`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.every(item => item?.testRunId !== pausedTestRunId)
  );
  await clickAction("Refresh Runtime Reads");
  await expectMonitorCommandHistoryCard({
    commandType: "complete",
    bookletKey: participantBookletKey,
    groupKey: participantGroupKey,
    loginKey: participantLoginKey,
    participantSessionId,
    testRunId: pausedTestRunId,
    transition: "running -> completed"
  });

  logStep("force-activate-after-complete");
  await page.locator('[data-view-nav="content"]').click();
  await page.waitForURL(/\/app\/content$/);
  await fillAndCommit("#contentReleaseId", retriedContentReleaseId);
  await page.locator("#forceActivation").check({ force: true });
  await page.locator("#forceActivation").dispatchEvent("change");
  const forceActivationDialog = acceptNextDialog(
    new RegExp(
      `Force activate release '${retriedContentReleaseId}' and supersede open participant runs\\?`
    )
  );
  await clickAction("Activate Release");
  await forceActivationDialog;
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.some(
        item =>
          item?.contentRelease?.contentReleaseId === retriedContentReleaseId &&
          item?.contentRelease?.status === "active"
      )
  );
  await page
    .locator("#activityFeed")
    .filter({ hasText: "Release Activated" })
    .filter({ hasText: retriedContentReleaseId })
    .filter({ hasText: /Force activation/ })
    .waitFor();
  await page.locator("#rawDebugToggle").click();
  await page.locator(".raw-debug-panel").first().waitFor();
  await page
    .locator("app-json-panel")
    .filter({ hasText: "Activation Guard" })
    .getByRole("button", { name: "Show Raw Debug" })
    .click();
  await page
    .locator("#activationGuardView")
    .filter({ hasText: "ready" })
    .filter({ hasText: retriedContentReleaseId })
    .waitFor();

  await page.locator('[data-view-nav="runtime"]').click();
  await page.waitForURL(/\/app\/runtime$/);
  logStep("delete-group-results");
  await fillAndCommit("#groupKey", participantGroupKey);
  const deleteGroupResultsDialog = new Promise((resolvePromise, reject) => {
    page.once("dialog", async dialog => {
      try {
        assert.match(dialog.message(), new RegExp(participantGroupKey));
        await dialog.accept(participantGroupKey);
        resolvePromise(undefined);
      } catch (error) {
        reject(error);
      }
    });
  });
  await clickAction("Delete Group Results");
  await deleteGroupResultsDialog;
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/responses/detailed?groupKey=${encodeURIComponent(participantGroupKey)}&testRunId=${pausedTestRunId}&limit=1`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.length === 0
  );
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/reviews?groupKey=${encodeURIComponent(participantGroupKey)}&testRunId=${pausedTestRunId}&limit=1`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.length === 0
  );
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/activity-events?eventType=group_results_deleted&subjectType=workspace&limit=1`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.some(
        item => item?.activityEvent?.details?.groupKey === participantGroupKey
      )
  );
  await page
    .locator(".activity-feed")
    .filter({ hasText: "Group Results Deleted" })
    .filter({ hasText: participantGroupKey })
    .waitFor();
  stopAfter("delete-group-results");

  process.stdout.write(
    `UI smoke passed for store=${store} at http://127.0.0.1:${port}/app\n`
  );
} catch (error) {
  if (!(error instanceof UiSmokeEarlyExit)) {
    throw error;
  }
} finally {
  process.stdout.write("ui_smoke_step=teardown-browser\n");
  await browser?.close().catch(() => undefined);
  process.stdout.write("ui_smoke_step=teardown-server\n");
  await stopChild(child);
  process.stdout.write("ui_smoke_step=teardown-complete\n");
}
