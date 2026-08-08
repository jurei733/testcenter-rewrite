import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { brotliDecompressSync } from "node:zlib";

import { chromium } from "playwright";

const store = process.env.FIRST_SLICE_STORE ?? "sqlite";
const operatorAuthRequired =
  process.env.FIRST_SLICE_OPERATOR_AUTH_REQUIRED === "true";
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
  '<Booklet><Metadata><Id>booklet:starter</Id><Label>Starter</Label></Metadata><BookletConfig><Config key="toolbar_show_unit_list">TRUE</Config><Config key="ask_for_fullscreen">ON</Config><Config key="show_fullscreen_button">ON</Config><Config key="toolbar_show_reload_button">TRUE</Config><Config key="unit_screenheader">WITH_UNIT_TITLE</Config><Config key="unit_title">OFF</Config></BookletConfig><Units><Unit id="unit-1" label="Entry" /><Unit id="unit-participant-route" label="Participant Route"><description>Read the participant prompt.</description><prompt>Explain how the starter example works.</prompt></Unit><Testlet id="testlet:timed-paused" label="Timed Paused Work"><Restrictions><TimeMax minutes="5" leave="allowed" /></Restrictions><Unit id="unit-paused" label="Paused Work"><Definition><![CDATA[<section>Answer the direct Testcenter definition prompt.</section>]]></Definition></Unit></Testlet></Units></Booklet>';
let smokeAdminSessionToken = "";

const readBrotliBase64Text = async fixturePath =>
  brotliDecompressSync(
    Buffer.from(await readFile(fixturePath, "utf8"), "base64")
  ).toString("utf8");

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
    await Promise.all(
      [filePath, `${filePath}-wal`, `${filePath}-shm`, `${filePath}-journal`].map(
        sqlitePath => rm(sqlitePath, { force: true })
      )
    );
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

  const serializedPayload = JSON.stringify(lastPayload);
  const payloadPreview =
    serializedPayload.length <= 4_000
      ? serializedPayload
      : `${serializedPayload.slice(0, 4_000)}... (${serializedPayload.length} characters total)`;
  throw new Error(
    `Timed out waiting for predicate on ${url}. Last payload: ${payloadPreview}`
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
  const baseUrl = `http://127.0.0.1:${port}`;
  const context = await browser.newContext();
  await context.grantPermissions(["clipboard-read", "clipboard-write"], {
    origin: baseUrl
  });
  const page = await context.newPage();
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
  logStep("browser-compatibility-warning");
  const outdatedBrowserContext = await browser.newContext({
    userAgent:
      "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/90.0.4430.93 Safari/537.36"
  });
  const outdatedBrowserPage = await outdatedBrowserContext.newPage();
  await outdatedBrowserPage.goto(`${baseUrl}/participant`, {
    waitUntil: "networkidle"
  });
  const browserCompatibilityWarning = outdatedBrowserPage.locator(
    "#browserCompatibilityWarning"
  );
  await browserCompatibilityWarning.waitFor();
  assert.equal(
    await browserCompatibilityWarning.getAttribute("data-browser-family"),
    "Chrome"
  );
  assert.equal(
    await browserCompatibilityWarning.getAttribute("data-browser-version"),
    "90.0.4430.93"
  );
  assert.match(
    (
      await outdatedBrowserPage
        .locator("#browserCompatibilityWarningMessage")
        .innerText()
    ).trim(),
    /Ihr Browser Chrome 90\.0\.4430\.93 ist veraltet/
  );
  await outdatedBrowserPage
    .locator("#browserCompatibilityWarningDismissButton")
    .click();
  await browserCompatibilityWarning.waitFor({ state: "detached" });
  await outdatedBrowserPage.reload({ waitUntil: "networkidle" });
  await outdatedBrowserPage.locator("#browserCompatibilityWarning").waitFor();
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
    try {
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
    } catch (error) {
      const actualValue = await page.locator(selector).inputValue();
      assert.equal(
        actualValue,
        expectedValue,
        `Expected ${selector} to contain the requested value.`
      );
      throw error;
    }
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
  const waitForOptionalDownload = () =>
    page.waitForEvent("download", { timeout: 5_000 }).catch(() => null);
  const expectButtonSelectorEnabled = async selector => {
    const button = page.locator(selector);
    await button.waitFor({ state: "attached", timeout: 15_000 });
    await page.waitForFunction(
      targetSelector => {
        const element = document.querySelector(targetSelector);
        return element instanceof HTMLButtonElement && !element.disabled;
      },
      selector,
      { timeout: 15_000 }
    );
  };
  const expectButtonSelectorDisabled = async selector => {
    const button = page.locator(selector);
    await button.waitFor({ state: "attached", timeout: 15_000 });
    await page.waitForFunction(
      targetSelector => {
        const element = document.querySelector(targetSelector);
        return element instanceof HTMLButtonElement && element.disabled;
      },
      selector,
      { timeout: 15_000 }
    );
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
    displayName = "",
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
      .filter(displayName ? { hasText: displayName } : { hasText: loginKey })
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
    [port, operatorAuthRequired ? "required" : "open"],
    { timeout: 15_000 }
  );
  logStep("offline-app-shell");
  const offlineShellContext = await browser.newContext({
    serviceWorkers: "allow"
  });
  const offlineShellPage = await offlineShellContext.newPage();
  try {
    await offlineShellPage.goto(`${baseUrl}/app/participant`, {
      waitUntil: "networkidle"
    });
    await offlineShellPage.locator("#participantLoginKey").waitFor();
    const serviceWorkerRegistration = await offlineShellPage.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready;
      return {
        scope: registration.scope,
        activeState: registration.active?.state ?? null
      };
    });
    assert.equal(serviceWorkerRegistration.scope, `${baseUrl}/app/`);
    assert.equal(serviceWorkerRegistration.activeState, "activated");

    await offlineShellPage.reload({ waitUntil: "networkidle" });
    await offlineShellPage.waitForFunction(
      () => navigator.serviceWorker.controller !== null,
      undefined,
      { timeout: 15_000 }
    );
    await offlineShellPage.locator("#participantLoginKey").waitFor();

    await offlineShellContext.setOffline(true);
    const offlineNavigationResponse = await offlineShellPage.reload({
      waitUntil: "domcontentloaded"
    });
    assert.equal(
      offlineNavigationResponse?.fromServiceWorker(),
      true,
      "The offline participant navigation should come from the application-shell service worker."
    );
    await offlineShellPage.locator("#participantLoginKey").waitFor({
      timeout: 15_000
    });
    await offlineShellPage
      .locator("#participantCustomLoginSubtitle")
      .filter({ hasText: "Start or Resume Test" })
      .waitFor();
    const offlineNotice = offlineShellPage.locator("#appOfflineShellNotice");
    await offlineNotice.waitFor();
    assert.match(
      (await offlineNotice.innerText()).replace(/\s+/g, " "),
      /Offline mode.*signing in, loading test content, and saving require a connection/
    );
    assert.equal(
      await offlineShellPage.evaluate(() => navigator.onLine),
      false
    );
    const offlineShellCache = await offlineShellPage.evaluate(async () => {
      const cacheName = (await caches.keys()).find(candidate =>
        candidate.startsWith("testcenter-rewrite-app-shell-")
      );
      if (!cacheName) {
        return null;
      }
      const cache = await caches.open(cacheName);
      return {
        cacheName,
        urls: (await cache.keys()).map(request => request.url)
      };
    });
    assert.ok(
      offlineShellCache?.cacheName,
      "The browser should retain a versioned application-shell cache."
    );
    assert.ok(
      offlineShellCache.urls.some(url => /\/app\/chunk-[^/]+\.js$/.test(url)),
      "The cached shell should contain the lazy Participant route."
    );
    assert.ok(
      offlineShellCache.urls.every(url => new URL(url).pathname.startsWith("/app/")),
      "The Service Worker must not cache API or participant-state requests."
    );
  } finally {
    await offlineShellContext.setOffline(false);
    await offlineShellContext.close();
  }
  stopAfter("offline-app-shell");
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
      has: page.getByRole("heading", { name: "Operator Session", exact: true })
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
  await expectButtonSelectorDisabled("#exportWorkspaceOverviewCsvButton");
  await expectButtonSelectorDisabled("#refreshStudyMonitorButton");
  await expectButtonSelectorEnabled("#refreshTenantDirectoryButton");
  await expectButtonSelectorEnabled("#exportTenantDirectoryCsvButton");
  await expectButtonSelectorDisabled("#refreshWorkspaceDirectoryButton");
  await expectButtonSelectorDisabled("#exportWorkspaceDirectoryCsvButton");
  await expectButtonSelectorDisabled("#exportStudyMonitorCsvButton");
  await expectButtonSelectorDisabled("#exportParticipantMatrixCsvButton");
  await expectButtonSelectorDisabled("#exportWorkspaceLogCsvButton");
  await expectButtonSelectorDisabled("#refreshParticipantTestLogsButton");
  await expectButtonSelectorDisabled("#exportWorkspaceActivityCsvButton");
  await fillAndCommit("#tenantKey", tenantKey);
  await expectButtonSelectorEnabled("#createTenantButton");
  await expectButtonSelectorDisabled("#createWorkspaceButton");
  await expectButtonSelectorDisabled("#refreshWorkspaceOverviewButton");
  await expectButtonSelectorEnabled("#refreshWorkspaceDirectoryButton");
  await expectButtonSelectorEnabled("#exportWorkspaceDirectoryCsvButton");
  await fillAndCommit("#workspaceKey", workspaceKey);
  await expectButtonSelectorEnabled("#createWorkspaceButton");
  await expectButtonSelectorEnabled("#refreshWorkspaceOverviewButton");
  await expectButtonSelectorEnabled("#exportWorkspaceOverviewCsvButton");
  await expectButtonSelectorEnabled("#refreshStudyMonitorButton");
  await expectButtonSelectorEnabled("#exportStudyMonitorCsvButton");
  await expectButtonSelectorEnabled("#exportParticipantMatrixCsvButton");
  await expectButtonSelectorEnabled("#exportWorkspaceLogCsvButton");
  await expectButtonSelectorEnabled("#refreshParticipantTestLogsButton");
  await expectButtonSelectorEnabled("#exportWorkspaceActivityCsvButton");
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
  logStep("export-workspace-overview-csv");
  const workspaceOverviewDownloadPromise = page.waitForEvent("download");
  await clickAction("Export Workspace Overview CSV");
  const workspaceOverviewDownload = await workspaceOverviewDownloadPromise;
  assert.equal(
    workspaceOverviewDownload.suggestedFilename(),
    `${workspaceKey}-workspace-overview.csv`
  );
  await page
    .locator("#workspaceOverviewExportPreview")
    .filter({ hasText: "tenantKey,workspaceKey,tenantDisplayName" })
    .filter({ hasText: tenantKey })
    .filter({ hasText: workspaceKey })
    .waitFor();

  if (stopAfterStep === "" || stopAfterStep === "system-check-report") {
    logStep("system-check-report");
    const systemCheckTenantKey = `${tenantKey}-system-check`;
    const systemCheckWorkspaceKey = `${workspaceKey}-system-check`;
    await sendSmokeJson(`${baseUrl}/api/v1/platform/tenants`, {
      body: {
        tenantKey: systemCheckTenantKey,
        displayName: "UI System Check Tenant"
      }
    });
    await sendSmokeJson(
      `${baseUrl}/api/v1/tenants/${systemCheckTenantKey}/workspaces`,
      {
        body: {
          workspaceKey: systemCheckWorkspaceKey,
          displayName: "UI System Check Workspace"
        }
      }
    );
    const systemCheckSourceDocument = (await readFile(
      resolve("test-fixtures/original-testcenter/system-checks/SysCheck.xml"),
      "utf8"
    )).replace(
      '    <Q id="1"',
      '    <CustomText key="syscheck_intro">UI smoke readiness introduction</CustomText>\n\n    <Q id="1"'
    );
    const systemCheckUnitDocument = (await readFile(
      resolve("test-fixtures/original-testcenter/units/Unit2.xml"),
      "utf8"
    )).replace("<Id>UNIT.SAMPLE-2</Id>", "<Id>UNIT.SAMPLE</Id>");
    for (const dependency of [
      {
        fileName: "SystemCheckUnit.xml",
        mediaType: "application/xml",
        sourceDocument: systemCheckUnitDocument
      },
      {
        fileName: "coding-scheme.vocs.json",
        mediaType: "application/json",
        sourceDocument: await readFile(
          resolve(
            "test-fixtures/original-testcenter/schemes/coding-scheme.vocs.json"
          ),
          "utf8"
        )
      },
      {
        fileName: "verona-player-simple-6.0.html",
        mediaType: "text/html",
        sourceDocument: await readFile(
          resolve(
            "test-fixtures/original-testcenter/players/verona-player-simple-6.0.html"
          ),
          "utf8"
        )
      }
    ]) {
      await sendSmokeJson(
        `${baseUrl}/api/v1/tenants/${systemCheckTenantKey}/workspaces/${systemCheckWorkspaceKey}/source-packages`,
        { body: dependency }
      );
    }
    const systemCheckSourceResponse = await sendSmokeJson(
      `${baseUrl}/api/v1/tenants/${systemCheckTenantKey}/workspaces/${systemCheckWorkspaceKey}/source-packages`,
      {
        body: {
          fileName: "SysCheck.xml",
          mediaType: "application/xml",
          sourceDocument: systemCheckSourceDocument
        }
      }
    );
    const systemCheckSource = await systemCheckSourceResponse.json();
    const systemCheckSourcePackageId =
      systemCheckSource.sourcePackage?.sourcePackageId;
    assert.ok(
      systemCheckSourcePackageId,
      "UI smoke expected a source package id for the system check."
    );
    const systemCheckImportResponse = await sendSmokeJson(
      `${baseUrl}/api/v1/tenants/${systemCheckTenantKey}/workspaces/${systemCheckWorkspaceKey}/import-jobs`,
      { body: { sourcePackageId: systemCheckSourcePackageId } }
    );
    const systemCheckImport = await systemCheckImportResponse.json();
    assert.equal(systemCheckImport.importJob?.status, "completed");
    assert.notEqual(
      systemCheckImport.importJob?.sourcePackageId,
      systemCheckSourcePackageId
    );
    const secondSystemCheckSourceResponse = await sendSmokeJson(
      `${baseUrl}/api/v1/tenants/${systemCheckTenantKey}/workspaces/${systemCheckWorkspaceKey}/source-packages`,
      {
        body: {
          fileName: "CY_SysCheck_2.xml",
          mediaType: "application/xml",
          sourceDocument: await readFile(
            resolve(
              "test-fixtures/original-testcenter/system-checks/CY_SysCheck_2.xml"
            ),
            "utf8"
          )
        }
      }
    );
    const secondSystemCheckSource = await secondSystemCheckSourceResponse.json();
    const secondSystemCheckSourcePackageId =
      secondSystemCheckSource.sourcePackage?.sourcePackageId;
    assert.ok(
      secondSystemCheckSourcePackageId,
      "UI smoke expected a source package id for the second system check."
    );
    const secondSystemCheckImportResponse = await sendSmokeJson(
      `${baseUrl}/api/v1/tenants/${systemCheckTenantKey}/workspaces/${systemCheckWorkspaceKey}/import-jobs`,
      { body: { sourcePackageId: secondSystemCheckSourcePackageId } }
    );
    const secondSystemCheckImport = await secondSystemCheckImportResponse.json();
    assert.equal(secondSystemCheckImport.importJob?.status, "completed");
    assert.notEqual(
      secondSystemCheckImport.importJob?.sourcePackageId,
      secondSystemCheckSourcePackageId
    );
    await page.goto(
      `${baseUrl}/app/system-check?tenantKey=${encodeURIComponent(
        systemCheckTenantKey
      )}&workspaceKey=${encodeURIComponent(
        systemCheckWorkspaceKey
      )}`,
      { waitUntil: "networkidle" }
    );
    await page.getByRole("heading", { name: "Choose a system check" }).waitFor();
    await page.locator("[data-system-check-id='SYSCHECK.SAMPLE']").waitFor();
    await page.locator("[data-system-check-id='syscheck-2']").waitFor();
    assert.equal(await page.locator(".system-check-option").count(), 2);
    await page.locator("[data-system-check-id='SYSCHECK.SAMPLE']").click();
    await page.getByRole("heading", { name: "System-Check Beispiel" }).waitFor();
    await page
      .locator("#systemCheckIntroText")
      .filter({ hasText: "UI smoke readiness introduction" })
      .waitFor();
    await page.locator("#systemCheckNextButton").click();
    await page.getByRole("heading", { name: "Environment" }).waitFor();
    await page.locator("#systemCheckNextButton").click();
    await page.getByRole("heading", { name: "Network" }).waitFor();
    await page.locator("#runSystemCheckNetworkButton").click();
    await page.waitForFunction(
      () => {
        const rating = document
          .querySelector("#systemCheckNetworkRating")
          ?.textContent?.trim();
        return ["good", "ok", "insufficient", "unstable"].includes(rating ?? "");
      },
      undefined,
      { timeout: 45_000 }
    );
    await page
      .locator(".system-check-results")
      .filter({ hasText: "Downloadgeschwindigkeit" })
      .filter({ hasText: "Uploadgeschwindigkeit" })
      .waitFor();
    await page.locator("#systemCheckNextButton").click();
    await page.getByRole("heading", { name: "Questionnaire" }).waitFor();
    await fillAndCommit("#systemCheckQuestion-2", "UI smoke device");
    await selectAndCommit("#systemCheckQuestion-3", "Option B");
    await fillAndCommit("#systemCheckQuestion-4", "Browser flow verified");
    await page.locator("#systemCheckQuestion-5").check();
    await page.getByRole("radio", { name: "Option A", exact: true }).check();
    await page.locator("#systemCheckNextButton").click();
    await page.getByRole("heading", { name: "Player and unit" }).waitFor();
    await page
      .locator("#participantVeronaPlayerVersion")
      .filter({ hasText: "API 6.0" })
      .waitFor({ timeout: 15_000 });
    const systemCheckPlayerFrame = page.frameLocator(
      "#participantVeronaPlayerFrame"
    );
    await systemCheckPlayerFrame.locator("#var1").fill("System check answer");
    await page
      .locator("#participantVeronaPlayerStatus")
      .filter({ hasText: "running" })
      .waitFor({ timeout: 15_000 });
    await page.locator("#systemCheckNextButton").click();
    await page.getByRole("heading", { name: "Report", exact: true }).waitFor();
    await fillAndCommit("#systemCheckReportTitle", "UI Smoke System Check");
    await fillAndCommit("#systemCheckReportKey", "saveme");
    await expectButtonSelectorEnabled("#saveSystemCheckReportButton");
    await page.locator("#saveSystemCheckReportButton").click();
    await page.locator("#systemCheckSavedReportStatus").waitFor({ timeout: 15_000 });
    await expectButtonSelectorEnabled("#loadSystemCheckReportsButton");
    await page.locator("#loadSystemCheckReportsButton").click();
    await page
      .locator(".system-check-operator")
      .filter({ hasText: "UI Smoke System Check" })
      .filter({ hasText: "System check answer" })
      .waitFor({ timeout: 15_000 });
    await expectButtonSelectorEnabled("#exportSystemCheckReportsButton");
    const systemCheckReportDownloadPromise = page.waitForEvent("download");
    await page.locator("#exportSystemCheckReportsButton").click();
    const systemCheckReportDownload = await systemCheckReportDownloadPromise;
    assert.equal(
      systemCheckReportDownload.suggestedFilename(),
      `${systemCheckWorkspaceKey}-system-check-reports.csv`
    );
    await page
      .locator(".system-check-statistics")
      .filter({ hasText: "Chrome" })
      .filter({ hasText: "good" })
      .waitFor();
    await page
      .getByLabel("Select reports for SYSCHECK.SAMPLE", { exact: true })
      .check();
    page.once("dialog", async dialog => {
      assert.equal(dialog.type(), "prompt");
      assert.match(dialog.message(), /Delete all reports for SYSCHECK\.SAMPLE/);
      await dialog.accept(systemCheckWorkspaceKey);
    });
    await expectButtonSelectorEnabled("#deleteSystemCheckReportsButton");
    await page.locator("#deleteSystemCheckReportsButton").click();
    await page
      .locator("#systemCheckReportOperatorStatus")
      .filter({ hasText: "1 report(s) deleted." })
      .waitFor({ timeout: 15_000 });

    await page.getByRole("button", { name: "Choose Another Check" }).click();
    await page.getByRole("heading", { name: "Choose a system check" }).waitFor();
    await page.locator("[data-system-check-id='syscheck-2']").click();
    await page.getByRole("heading", { name: "System-Check-2" }).waitFor();
    await page
      .locator(".system-check-facts")
      .filter({ hasText: "Skipped by configuration" })
      .filter({ hasText: "5" })
      .waitFor();
    await page
      .locator("#systemCheckStepStatus")
      .filter({ hasText: "1 / 5" })
      .waitFor();
    assert.equal(
      await page.getByRole("button", { name: "Network", exact: true }).count(),
      0
    );
    await page.locator("#systemCheckNextButton").click();
    await page.getByRole("heading", { name: "Environment" }).waitFor();
    await page.locator("#systemCheckNextButton").click();
    await page.getByRole("heading", { name: "Questionnaire" }).waitFor();
    await expectButtonSelectorEnabled("#systemCheckNextButton");
    await page.locator("#systemCheckNextButton").click();
    await page
      .locator(".validation-message")
      .filter({ hasText: "Please complete all required questions." })
      .waitFor();
    await page.getByRole("heading", { name: "Questionnaire" }).waitFor();
    await fillAndCommit("#systemCheckQuestion-2", "Test-Input1");
    await selectAndCommit("#systemCheckQuestion-3", "Option A");
    await fillAndCommit("#systemCheckQuestion-4", "Test-Input2");
    await page.locator("#systemCheckQuestion-5").check();
    await page.getByRole("radio", { name: "Option B", exact: true }).check();
    await page.locator("#systemCheckNextButton").click();
    await page.getByRole("heading", { name: "Player and unit" }).waitFor();
    await page
      .locator("#participantVeronaPlayerVersion")
      .filter({ hasText: "API 6.0" })
      .waitFor({ timeout: 15_000 });
    const secondSystemCheckPlayerFrame = page.frameLocator(
      "#participantVeronaPlayerFrame"
    );
    await secondSystemCheckPlayerFrame
      .locator("#var1")
      .fill("Second system check answer");
    await page
      .locator("#participantVeronaPlayerStatus")
      .filter({ hasText: "running" })
      .waitFor({ timeout: 15_000 });
    await page.locator("#systemCheckNextButton").click();
    await page.getByRole("heading", { name: "Report", exact: true }).waitFor();
    await fillAndCommit("#systemCheckReportTitle", "UI Smoke System Check 2");
    await fillAndCommit("#systemCheckReportKey", "saveme");
    await expectButtonSelectorEnabled("#saveSystemCheckReportButton");
    await page.locator("#saveSystemCheckReportButton").click();
    await page.locator("#systemCheckSavedReportStatus").waitFor({ timeout: 15_000 });
    await expectButtonSelectorEnabled("#loadSystemCheckReportsButton");
    await page.locator("#loadSystemCheckReportsButton").click();
    await page
      .locator(".system-check-report-detail")
      .filter({ hasText: "UI Smoke System Check 2" })
      .filter({ hasText: "Test-Input1" })
      .filter({ hasText: "Option A" })
      .filter({ hasText: "Test-Input2" })
      .filter({ hasText: "true" })
      .filter({ hasText: "Option B" })
      .filter({ hasText: "Second system check answer" })
      .waitFor({ timeout: 15_000 });
    await page
      .locator(".system-check-statistics")
      .filter({ hasText: "System-Check-2" })
      .filter({ hasText: "Chrome" })
      .filter({ hasText: "unknown" })
      .waitFor();
    await page
      .getByLabel("Select reports for syscheck-2", { exact: true })
      .check();
    page.once("dialog", async dialog => {
      assert.equal(dialog.type(), "prompt");
      assert.match(dialog.message(), /Delete all reports for syscheck-2/);
      await dialog.accept(systemCheckWorkspaceKey);
    });
    await expectButtonSelectorEnabled("#deleteSystemCheckReportsButton");
    await page.locator("#deleteSystemCheckReportsButton").click();
    await page
      .locator("#systemCheckReportOperatorStatus")
      .filter({ hasText: "1 report(s) deleted." })
      .waitFor({ timeout: 15_000 });
    stopAfter("system-check-report");

    await page.evaluate(
      ([nextTenantKey, nextWorkspaceKey]) => {
        const storageKey = "testcenter-rewrite-app-shell";
        const persisted = JSON.parse(localStorage.getItem(storageKey) ?? "{}");
        localStorage.setItem(
          storageKey,
          JSON.stringify({
            ...persisted,
            tenantKey: nextTenantKey,
            workspaceKey: nextWorkspaceKey,
            activeView: "workspace"
          })
        );
      },
      [tenantKey, workspaceKey]
    );
    await page.goto(`${baseUrl}/app/workspace`, { waitUntil: "networkidle" });
  }
  logStep("workspace-directory-reads");
  const expectedTenantDirectoryCount = stopAfterStep === "" ? 2 : 1;
  await clickAction("Refresh Tenant Directory");
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Tenant Directory", exact: true })
    })
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: "Tenant directory window" }) })
    .filter({
      hasText: `${expectedTenantDirectoryCount} tenant row(s) loaded for the current directory`
    })
    .filter({ hasText: `${expectedTenantDirectoryCount} loaded` })
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
  const tenantDirectoryDownloadPromise = page.waitForEvent("download");
  await clickAction("Export Tenant Directory CSV");
  const tenantDirectoryDownload = await tenantDirectoryDownloadPromise;
  assert.equal(tenantDirectoryDownload.suggestedFilename(), "tenants.csv");
  await page
    .locator("#tenantDirectoryExportPreview")
    .filter({ hasText: "tenantKey,displayName,status,tenantId,createdAt" })
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
  const workspaceDirectoryDownloadPromise = page.waitForEvent("download");
  await clickAction("Export Workspace Directory CSV");
  const workspaceDirectoryDownload = await workspaceDirectoryDownloadPromise;
  assert.equal(
    workspaceDirectoryDownload.suggestedFilename(),
    `${tenantKey}-workspaces.csv`
  );
  await page
    .locator("#workspaceDirectoryExportPreview")
    .filter({
      hasText: "tenantKey,workspaceKey,displayName,status,workspaceId,createdAt"
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
  await selectAndCommit("#adminCreateAccessMode", "read_only");
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
            roleAssignment =>
              roleAssignment?.role === "workspace_admin" &&
              roleAssignment?.accessMode === "read_only"
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
    .filter({ hasText: "read_only" })
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

  const groupMonitorKey = "group:ui-monitor";
  await selectAndCommit("#adminRoleRole", "group_monitor");
  await fillAndCommit("#adminRoleTenantKey", tenantKey);
  await fillAndCommit("#adminRoleWorkspaceKey", workspaceKey);
  await fillAndCommit("#adminRoleGroupKey", "");
  await expectButtonSelectorDisabled("#adminAssignRoleButton");
  await fillAndCommit("#adminRoleGroupKey", groupMonitorKey);
  await expectButtonSelectorEnabled("#adminAssignRoleButton");
  logStep("assign-group-monitor-role");
  await clickAction("Assign Role");
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
            roleAssignment =>
              roleAssignment?.role === "group_monitor" &&
              roleAssignment?.groupKey === groupMonitorKey
          )
      )
  );
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Admin Role Assignments", exact: true })
    })
    .filter({ hasText: "group_monitor" })
    .filter({ hasText: groupMonitorKey })
    .waitFor();

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
  const resetWorkspaceAdminPasswordPayload =
    await resetWorkspaceAdminPasswordSignIn.json();
  assert.equal(
    resetWorkspaceAdminPasswordPayload.roleAssignments.find(
      roleAssignment => roleAssignment?.role === "workspace_admin"
    )?.accessMode,
    "read_only"
  );

  logStep("read-only-workspace-admin");
  await clickAction("Sign Out");
  await expectInputValue("#adminSessionToken", "");
  await fillAndCommitUntilValue("#adminUsername", workspaceAdminUsername);
  await fillAndCommitUntilValue("#adminPassword", workspaceAdminResetPassword);
  const readOnlyAdminSignInResponsePromise = page.waitForResponse(
    response =>
      response.request().method() === "POST" &&
      response.url().endsWith("/api/v1/admin/auth/sign-in")
  );
  await clickAction("Sign In");
  const readOnlyAdminSignInResponse = await readOnlyAdminSignInResponsePromise;
  assert.equal(readOnlyAdminSignInResponse.status(), 200);
  await waitForInputMinLength("#adminSessionToken", 20);
  await page
    .locator("app-record-collection")
    .filter({ has: page.getByRole("heading", { name: "Operator Session" }) })
    .filter({ hasText: "workspace_admin" })
    .filter({ hasText: "Active access: Read-only workspace administrator" })
    .waitFor();
  await page
    .locator(".hero-panel")
    .filter({ hasText: "Inspect The Workspace Without Changing It." })
    .filter({ hasText: "Changes require an RW role assignment." })
    .waitFor();
  const readOnlyAdminSessionToken = await page
    .locator("#adminSessionToken")
    .inputValue();
  assert.equal(
    await page.getByRole("heading", { name: "Admin User Management" }).count(),
    0
  );
  assert.equal(await page.locator("#adminSessionsButton").count(), 0);
  assert.equal(await page.locator("#adminUsersButton").count(), 0);
  assert.equal(await page.locator("#adminAuditEventsButton").count(), 0);

  await page.locator('[data-view-nav="content"]').click();
  await page.waitForURL(/\/app\/content$/);
  await page.locator("#createSourcePackageButton").waitFor();
  await fillAndCommit("#sourceFileName", "read-only-denied.xml");
  await fillAndCommit("#sourceMediaType", "application/xml");
  await fillAndCommit("#sourceDocument", "<assessment />");
  await expectButtonSelectorDisabled("#createSourcePackageButton");
  await expectButtonSelectorDisabled("#createImportJobButton");
  await expectButtonSelectorDisabled("#activateContentReleaseButton");
  await expectButtonSelectorDisabled("#assembleSourcePackagesButton");
  await expectButtonSelectorDisabled("#bootstrapWorkspaceFlowButton");
  await expectButtonSelectorDisabled("#importActivateFlowButton");
  await expectButtonSelectorDisabled("#blockedActivationFlowButton");
  await expectButtonSelectorEnabled("#refreshContentReadsButton");

  if (operatorAuthRequired) {
    const deniedReadOnlyWriteResponse = await fetch(
      `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`,
      {
        method: "POST",
        headers: {
          authorization: `Bearer ${readOnlyAdminSessionToken}`,
          "content-type": "application/json"
        },
        body: JSON.stringify({
          fileName: "read-only-denied.xml",
          mediaType: "application/xml",
          sourceDocument: "<assessment />"
        })
      }
    );
    assert.equal(deniedReadOnlyWriteResponse.status, 403);
    assert.equal(
      (await deniedReadOnlyWriteResponse.json()).error,
      "admin_write_role_required"
    );
  }

  await page.locator('[data-view-nav="workspace"]').click();
  await page.waitForURL(/\/app\/workspace$/);
  await expectButtonSelectorDisabled("#createTenantButton");
  await expectButtonSelectorDisabled("#createWorkspaceButton");
  await expectButtonSelectorDisabled("#refreshTenantDirectoryButton");
  await expectButtonSelectorDisabled("#exportTenantDirectoryCsvButton");
  await expectButtonSelectorDisabled("#refreshWorkspaceDirectoryButton");
  await expectButtonSelectorDisabled("#exportWorkspaceDirectoryCsvButton");
  await expectButtonSelectorEnabled("#refreshWorkspaceOverviewButton");
  await expectButtonSelectorEnabled("#exportWorkspaceOverviewCsvButton");

  await page.locator('[data-view-nav="runtime"]').click();
  await page.waitForURL(/\/app\/runtime$/);
  await expectButtonSelectorDisabled("#runtimeResumeSessionButton");
  await expectButtonSelectorDisabled("#runtimeMonitorLockTestButton");
  await expectButtonSelectorDisabled("#importParticipantRosterButton");

  await page.locator('[data-view-nav="ops"]').click();
  await page.waitForURL(/\/app\/ops$/);
  await clickAction("Sign Out");
  await expectInputValue("#adminSessionToken", "");
  await fillAndCommitUntilValue("#adminUsername", adminUsername);
  await fillAndCommitUntilValue("#adminPassword", adminPassword);
  await clickAction("Sign In");
  await waitForInputMinLength("#adminSessionToken", 20);
  smokeAdminSessionToken = await page.locator("#adminSessionToken").inputValue();
  stopAfter("read-only-workspace-admin");

  logStep("delegated-workspace-operator-management");
  const delegatedWorkspaceAdminUsername = `ui-delegated-admin-${Date.now()}`;
  const delegatedWorkspaceAdminPassword = "ui-delegated-admin-secret";
  await fillAndCommit("#adminCreateUsername", delegatedWorkspaceAdminUsername);
  await fillAndCommit("#adminCreateDisplayName", "UI Delegated Workspace Admin");
  await fillAndCommit("#adminCreatePassword", delegatedWorkspaceAdminPassword);
  await selectAndCommit("#adminCreateRole", "workspace_admin");
  await selectAndCommit("#adminCreateAccessMode", "read_write");
  await fillAndCommit("#adminCreateTenantKey", tenantKey);
  await fillAndCommit("#adminCreateWorkspaceKey", workspaceKey);
  await expectButtonSelectorEnabled("#adminCreateUserButton");
  await clickAction("Create Admin User");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/admin/users?username=${delegatedWorkspaceAdminUsername}`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.some(
        item =>
          item?.adminUser?.username === delegatedWorkspaceAdminUsername &&
          item?.roleAssignments?.some(
            roleAssignment =>
              roleAssignment?.role === "workspace_admin" &&
              roleAssignment?.accessMode === "read_write"
          )
      )
  );

  await clickAction("Sign Out");
  await fillAndCommitUntilValue(
    "#adminUsername",
    delegatedWorkspaceAdminUsername
  );
  await fillAndCommitUntilValue(
    "#adminPassword",
    delegatedWorkspaceAdminPassword
  );
  await clickAction("Sign In");
  await waitForInputMinLength("#adminSessionToken", 20);
  smokeAdminSessionToken = await page.locator("#adminSessionToken").inputValue();
  await page.locator("#adminCreateUsername").waitFor();
  const delegatedRoleOptions = await page
    .locator("#adminCreateRole option")
    .allTextContents();
  assert.deepEqual(
    delegatedRoleOptions.map(option => option.trim()),
    ["system_check", "group_monitor", "study_monitor"]
  );

  const delegatedSystemCheckUsername = `ui-system-check-${Date.now()}`;
  await fillAndCommit("#adminCreateUsername", delegatedSystemCheckUsername);
  await fillAndCommit("#adminCreateDisplayName", "UI Delegated System Check");
  await fillAndCommit("#adminCreatePassword", "ui-system-check-secret");
  await selectAndCommit("#adminCreateRole", "system_check");
  await fillAndCommit("#adminCreateTenantKey", tenantKey);
  await fillAndCommit("#adminCreateWorkspaceKey", workspaceKey);
  await expectButtonSelectorEnabled("#adminCreateUserButton");
  await clickAction("Create System Check Account");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/admin/users?username=${delegatedSystemCheckUsername}`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.some(
        item =>
          item?.adminUser?.username === delegatedSystemCheckUsername &&
          item?.roleAssignments?.some(
            roleAssignment => roleAssignment?.role === "system_check"
          )
      )
  );
  assert.equal(
    await page
      .locator("#adminCreateRole option")
      .filter({ hasText: "platform_admin" })
      .count(),
    0
  );
  stopAfter("delegated-workspace-operator-management");

  await clickAction("Sign Out");
  await fillAndCommitUntilValue("#adminUsername", adminUsername);
  await fillAndCommitUntilValue("#adminPassword", adminPassword);
  await clickAction("Sign In");
  await waitForInputMinLength("#adminSessionToken", 20);
  smokeAdminSessionToken = await page.locator("#adminSessionToken").inputValue();

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
  await expectButtonSelectorDisabled("#sourcePackageDeletionReadinessButton");
  await expectButtonSelectorDisabled("#replaceSourcePackageButton");
  await expectButtonSelectorDisabled("#deleteSourcePackageButton");
  await expectButtonSelectorDisabled("#participantSessionDetailButton");
  await expectButtonSelectorDisabled("#releaseReadinessButton");
  await expectButtonSelectorDisabled("#releaseDetailButton");
  await expectButtonSelectorDisabled("#retrySourcePackageImportButton");
  logStep("assemble-loose-original-source-files");
  const looseAssemblyFileName = `ui-original-loose-${Date.now()}.zip`;
  await page.locator("#sourcePackageAssemblyFiles").setInputFiles([
    resolve("test-fixtures/original-testcenter/booklets/Booklet2.xml"),
    resolve("test-fixtures/original-testcenter/units/Unit2.xml"),
    resolve(
      "test-fixtures/original-testcenter/schemes/coding-scheme.vocs.json"
    ),
    resolve(
      "test-fixtures/original-testcenter/players/verona-player-simple-6.0.html"
    )
  ]);
  await page
    .locator("#sourcePackageAssemblySelection")
    .filter({ hasText: "4 file(s) selected" })
    .waitFor({ timeout: 20_000 });
  await page
    .locator("app-record-collection")
    .filter({ has: page.getByRole("heading", { name: "Assembly Candidates" }) })
    .filter({ hasText: "Booklet2.xml" })
    .filter({ hasText: "Unit2.xml" })
    .filter({ hasText: "coding-scheme.vocs.json" })
    .filter({ hasText: "verona-player-simple-6.0.html" })
    .waitFor({ timeout: 20_000 });
  logStep("resolve-loose-original-workspace-dependencies");
  const sourcePackageCollection = page
    .locator("app-record-collection")
    .filter({ has: page.getByRole("heading", { name: "Source Packages" }) });
  await sourcePackageCollection
    .locator("article.record-card")
    .filter({ has: page.getByRole("heading", { name: "Booklet2.xml" }) })
    .getByRole("button", { name: "Select + Load" })
    .click();
  await expectInputValue("#sourceFileName", "Booklet2.xml");
  await expectButtonSelectorEnabled("#createImportJobButton");
  await page.locator("#createImportJobButton").click();
  const automaticDependencySnapshotFileName =
    "Booklet2.workspace-dependencies.zip";
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages?fileName=${encodeURIComponent(automaticDependencySnapshotFileName)}`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.some(
        item =>
          item?.sourcePackage?.fileName === automaticDependencySnapshotFileName &&
          item?.sourcePackage?.status === "accepted" &&
          item?.latestImportJob?.status === "completed" &&
          item?.contentReleaseCount === 1
      )
  );
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/activity-events?eventType=source_package_assembled&limit=10`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.some(
        item =>
          item?.activityEvent?.details?.assemblyMode ===
            "workspace_dependencies" &&
          item?.activityEvent?.details?.sourcePackages?.length === 4
      )
  );
  await page
    .locator("app-record-collection")
    .filter({
      has: page.getByRole("heading", {
        name: "Workspace File Dependency Graph"
      })
    })
    .filter({ hasText: automaticDependencySnapshotFileName })
    .filter({ hasText: "assembled from" })
    .filter({ hasText: "uses player" })
    .filter({ hasText: "uses coding scheme" })
    .waitFor({ timeout: 20_000 });
  await fillAndCommit("#sourcePackageAssemblyFileName", looseAssemblyFileName);
  await expectButtonSelectorEnabled("#assembleSourcePackagesButton");
  await page.locator("#assembleSourcePackagesButton").click();
  await expectInputValue("#sourceFileName", looseAssemblyFileName);
  await page
    .locator("#sourcePackageAssemblySelection")
    .filter({ hasText: "0 file(s) selected" })
    .waitFor({ timeout: 20_000 });
  await expectButtonSelectorDisabled("#assembleSourcePackagesButton");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages?fileName=${encodeURIComponent(looseAssemblyFileName)}`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.some(
        item =>
          item?.sourcePackage?.fileName === looseAssemblyFileName &&
          item?.sourcePackage?.mediaType === "application/zip" &&
          item?.sourcePackage?.status === "accepted" &&
          item?.latestImportJob?.status === "completed" &&
          item?.contentReleaseCount === 1
      )
  );
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/activity-events?eventType=source_package_assembled&limit=1`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.some(
        item =>
          item?.activityEvent?.eventType === "source_package_assembled" &&
          item?.activityEvent?.details?.sourcePackages?.length === 4
      )
  );
  await page
    .locator("app-record-collection")
    .filter({
      has: page.getByRole("heading", {
        name: "Workspace File Dependency Graph"
      })
    })
    .filter({ hasText: looseAssemblyFileName })
    .filter({ hasText: "transitive requirement(s)" })
    .filter({ hasText: "assembled from" })
    .filter({ hasText: "contains booklet" })
    .filter({ hasText: "contains unit" })
    .filter({ hasText: "uses player" })
    .filter({ hasText: "uses definition" })
    .filter({ hasText: "uses coding scheme" })
    .waitFor({ timeout: 20_000 });
  await page
    .locator("app-record-collection")
    .filter({
      has: page.getByRole("heading", {
        name: "Workspace File Dependency Graph"
      })
    })
    .getByRole("button", { name: "Select Related File" })
    .first()
    .waitFor({ timeout: 20_000 });
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
  const uploadedZip = await readFile(uploadedZipSourcePath);
  await page.locator("#refreshContentReadsButton").click();
  await page
    .locator("app-record-collection")
    .filter({ hasText: "Source Packages" })
    .filter({ hasText: "Package" })
    .filter({ hasText: "File Type" })
    .filter({ hasText: `${uploadedZip.byteLength} byte(s), downloadable` })
    .filter({ hasText: "0 import(s), 0 release(s)" })
    .waitFor({ timeout: 15_000 });
  await page
    .locator("app-record-collection")
    .filter({ has: page.getByRole("heading", { name: "Workspace Files By Type" }) })
    .filter({ hasText: "Package" })
    .filter({ hasText: uploadedZipSourceFileName })
    .waitFor({ timeout: 15_000 });
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
  assert.deepEqual(downloadedZip, uploadedZip);
  await expectButtonSelectorEnabled("#sourcePackageDeletionReadinessButton");
  await expectButtonSelectorEnabled("#deleteSourcePackageButton");
  await page.locator("#sourcePackageDeletionReadinessButton").click();
  await page
    .locator("app-record-collection")
    .filter({
      has: page.getByRole("heading", {
        name: "Source Package Deletion Readiness"
      })
    })
    .filter({ hasText: "Deletion is safe" })
    .filter({ hasText: "0 import(s), 0 unused release(s)" })
    .waitFor({ timeout: 15_000 });
  page.once("dialog", async dialog => {
    assert.equal(dialog.type(), "prompt");
    await dialog.accept(uploadedZipSourceFileName);
  });
  await page.locator("#deleteSourcePackageButton").click();
  await expectInputValue("#sourcePackageId", "");

  logStep("replace-and-delete-source-package");
  const lifecycleOldFileName = `ui-lifecycle-old-${Date.now()}.xml`;
  const lifecycleOldResponse = await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`,
    {
      body: {
        fileName: lifecycleOldFileName,
        mediaType: "application/xml",
        sourceDocument: uploadedSourceDocument
      }
    }
  );
  const lifecycleOld = await lifecycleOldResponse.json();
  const lifecycleOldSourcePackageId = lifecycleOld.sourcePackage?.sourcePackageId;
  assert.ok(
    lifecycleOldSourcePackageId,
    "UI smoke expected an original source package id for replacement."
  );
  await fillAndCommit("#sourcePackageId", lifecycleOldSourcePackageId);
  const lifecycleReplacementFileName = `ui-lifecycle-new-${Date.now()}.xml`;
  const lifecycleReplacementPath = resolve(
    ".data",
    lifecycleReplacementFileName
  );
  await writeFile(lifecycleReplacementPath, uploadedSourceDocument, "utf8");
  await page
    .locator("#sourceDocumentFile")
    .setInputFiles(lifecycleReplacementPath);
  await expectButtonSelectorEnabled("#replaceSourcePackageButton");
  page.once("dialog", async dialog => {
    assert.equal(dialog.type(), "confirm");
    await dialog.accept();
  });
  await page.locator("#replaceSourcePackageButton").click();
  await page.waitForFunction(
    oldSourcePackageId => {
      const sourcePackageId = document.querySelector("#sourcePackageId");
      return (
        sourcePackageId instanceof HTMLInputElement &&
        sourcePackageId.value.trim() !== "" &&
        sourcePackageId.value !== oldSourcePackageId
      );
    },
    lifecycleOldSourcePackageId,
    { timeout: 15_000 }
  );
  await page
    .locator("app-record-collection")
    .filter({ has: page.getByRole("heading", { name: "Source Packages" }) })
    .filter({ hasText: lifecycleReplacementFileName })
    .filter({ hasText: "1 import(s), 1 release(s)" })
    .filter({ hasText: "safe after exact-name confirmation" })
    .waitFor({ timeout: 15_000 });
  await page.locator("#sourcePackageDeletionReadinessButton").click();
  await page
    .locator("app-record-collection")
    .filter({
      has: page.getByRole("heading", {
        name: "Source Package Deletion Readiness"
      })
    })
    .filter({ hasText: lifecycleReplacementFileName })
    .filter({ hasText: "1 import(s), 1 unused release(s)" })
    .waitFor({ timeout: 15_000 });
  page.once("dialog", async dialog => {
    assert.equal(dialog.type(), "prompt");
    await dialog.accept(lifecycleReplacementFileName);
  });
  await page.locator("#deleteSourcePackageButton").click();
  await expectInputValue("#sourcePackageId", "");
  await fillAndCommit("#sourcePackageId", lifecycleOldSourcePackageId);
  page.once("dialog", async dialog => {
    assert.equal(dialog.type(), "prompt");
    await dialog.accept(lifecycleOldFileName);
  });
  await page.locator("#deleteSourcePackageButton").click();
  await expectInputValue("#sourcePackageId", "");
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
  logStep("export-source-packages-csv");
  await expectButtonSelectorEnabled("#exportSourcePackagesCsvButton");
  const sourcePackagesDownloadPromise = page.waitForEvent("download");
  await clickAction("Export Source Packages CSV");
  const sourcePackagesDownload = await sourcePackagesDownloadPromise;
  assert.equal(
    sourcePackagesDownload.suggestedFilename(),
    `${workspaceKey}-source-packages.csv`
  );
  await page
    .locator("#sourcePackagesExportPreview")
    .filter({ hasText: "tenantKey,workspaceKey,sourcePackageId" })
    .filter({ hasText: uploadedSourceFileName })
    .filter({ hasText: "application/xml" })
    .waitFor();
  await expectButtonSelectorEnabled("#createImportJobButton");
  await expectButtonSelectorEnabled("#sourcePackageDetailButton");
  await expectButtonSelectorEnabled("#downloadSourceDocumentButton");
  await expectButtonSelectorDisabled("#retrySourcePackageImportButton");
  await expectButtonSelectorDisabled("#activateContentReleaseButton");
  await clickAction("Create Import Job");
  const stagedStarterReleasePayload = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.some(item => item?.contentRelease?.status === "staged")
  );
  const starterContentReleaseId =
    stagedStarterReleasePayload.items.find(
      item =>
        item?.contentRelease?.status === "staged" &&
        item?.sourcePackage?.fileName === uploadedSourceFileName
    )?.contentRelease?.contentReleaseId;
  assert.ok(
    starterContentReleaseId,
    "UI smoke expected the imported starter release id."
  );
  logStep("export-import-jobs-csv");
  await expectButtonSelectorEnabled("#exportImportJobsCsvButton");
  const importJobsDownloadPromise = page.waitForEvent("download");
  await clickAction("Export Import Jobs CSV");
  const importJobsDownload = await importJobsDownloadPromise;
  assert.equal(
    importJobsDownload.suggestedFilename(),
    `${workspaceKey}-import-jobs.csv`
  );
  await page
    .locator("#importJobsExportPreview")
    .filter({ hasText: "tenantKey,workspaceKey,importJobId" })
    .filter({ hasText: uploadedSourceFileName })
    .filter({ hasText: "completed" })
    .waitFor();
  logStep("export-content-releases-csv");
  await expectButtonSelectorEnabled("#exportContentReleasesCsvButton");
  const contentReleasesDownloadPromise = page.waitForEvent("download");
  await clickAction("Export Content Releases CSV");
  const contentReleasesDownload = await contentReleasesDownloadPromise;
  assert.equal(
    contentReleasesDownload.suggestedFilename(),
    `${workspaceKey}-content-releases.csv`
  );
  await page
    .locator("#contentReleasesExportPreview")
    .filter({ hasText: "tenantKey,workspaceKey,contentReleaseId" })
    .filter({ hasText: uploadedSourceFileName })
    .filter({ hasText: "staged" })
    .waitFor();
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
        bodyText.includes("2 / 3 prompt(s), 1 / 3 description(s)") &&
        bodyText.includes("Participant Route: Read the participant prompt.") &&
        bodyText.includes("Explain how the starter example works.") &&
        bodyText.includes("Paused Work: Answer the direct Testcenter definition prompt.")
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
  const participantEntrySignInDisplayName = "Student Entry Sign In";
  await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-roster`,
    {
      body: {
        rosterText: [
          "loginKey,groupKey,displayName",
          [
            participantEntrySignInLoginKey,
            participantEntrySignInGroupKey,
            participantEntrySignInDisplayName
          ].join(",")
        ].join("\n")
      }
    }
  );
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
    ([expectedSessionId, expectedDisplayName]) =>
      document.querySelector("#participantRouteSessionLabel")?.textContent?.trim() ===
        expectedSessionId &&
      document.querySelector("#participantEntryDisplayName")?.textContent?.trim() ===
        expectedDisplayName &&
      document.querySelector("#participantRouteStatus")?.textContent?.trim() ===
        "signed_in" &&
      document.querySelector("#participantRouteRunId")?.textContent?.trim() ===
        "no run yet" &&
      document.querySelector("#participantEntryNextStep")?.textContent?.includes(
        "Start test"
      ),
    [participantEntrySignInSessionId, participantEntrySignInDisplayName],
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
  await page.locator("#participantRouteFullscreenPrompt").waitFor();
  await page
    .locator("#participantRouteScreenHeader")
    .filter({ hasText: "Entry" })
    .waitFor();
  assert.equal(await page.locator("#participantRouteUnit").count(), 0);
  await page.locator("#participantRouteFullscreenButton").waitFor();
  await page.locator("#participantRouteEnterFullscreenButton").click();
  await page.waitForFunction(() => Boolean(document.fullscreenElement));
  await page
    .locator("#participantRouteFullscreenStatus")
    .filter({ hasText: "active" })
    .waitFor();
  assert.equal(
    (await page.locator("#participantRouteFullscreenButton").textContent())?.trim(),
    "Exit Fullscreen"
  );
  await page.locator("#participantRouteFullscreenButton").click();
  await page.waitForFunction(() => !document.fullscreenElement);
  await page
    .locator("#participantRouteFullscreenStatus")
    .filter({ hasText: "closed" })
    .waitFor();
  await page.locator("#participantRouteFullscreenPrompt").waitFor({ state: "detached" });
  await page.locator("#participantRouteReloadButton").waitFor();
  await page.locator("#participantRouteReloadButton").click();
  await page.waitForLoadState("networkidle");
  await page.waitForURL(url =>
    url.searchParams.get("participantSessionId") === participantEntrySignInSessionId
  );
  await page.waitForFunction(
    expectedRunId =>
      document.querySelector("#participantRouteRunId")?.textContent?.trim() ===
        expectedRunId &&
      document.querySelector("#participantRouteStatus")?.textContent?.trim() ===
        "running",
    participantEntryStartedRunId,
    { timeout: 15_000 }
  );
  await page.locator("#participantRouteReloadButton").waitFor();
  stopAfter("participant-entry-start-after-sign-in");

  logStep("participant-entry-review-comments");
  const participantReviewLoginKey = "student-entry-review";
  await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-roster`,
    {
      body: {
        rosterText: [
          "loginKey,executionMode,groupKey,displayName",
          `${participantReviewLoginKey},run-review,group:participant-entry-review,Student Entry Review`
        ].join("\n")
      }
    }
  );
  await page.locator("#participantRouteClearSessionButton").click();
  await fillAndCommitUntilValue("#participantTenantKey", tenantKey);
  await fillAndCommitUntilValue("#participantWorkspaceKey", workspaceKey);
  await fillAndCommitUntilValue("#participantLoginKey", participantReviewLoginKey);
  await fillAndCommitUntilValue(
    "#participantRouteGroupKey",
    "group:participant-entry-review"
  );
  await page.getByRole("button", { name: "Start Or Resume" }).click();
  await page.locator("#participantRouteReviewPanel").waitFor({ timeout: 15_000 });
  await page
    .locator("#participantRouteExecutionMode")
    .filter({ hasText: "run-review" })
    .waitFor();
  await page
    .locator("#participantRouteActions")
    .filter({ hasText: "review" })
    .waitFor();
  const participantReviewRunId = (
    await page.locator("#participantRouteRunId").textContent()
  )?.trim();
  assert.ok(participantReviewRunId, "Participant review smoke expected a run id.");
  await page.locator("#participantRouteReviewReviewer").fill("UI Reviewer");
  await page
    .locator("#participantRouteReviewPriority")
    .selectOption({ label: "Critical / urgent" });
  await page.locator("#participantRouteReviewCategory-tech").check();
  await page.locator("#participantRouteReviewCategory-content").check();
  await page.locator("#participantRouteReviewTargetTask").click();
  await page
    .locator("#participantRouteReviewPageLabel")
    .fill("Browser smoke task");
  await page
    .locator("#participantRouteReviewComment")
    .fill("Participant review comment from browser smoke");
  await page.locator("#participantRouteReviewSaveButton").click();
  await page
    .locator("#participantRouteReviewFeedback")
    .filter({ hasText: "Comment saved" })
    .waitFor({ timeout: 15_000 });
  await page
    .locator(".participant-review-item")
    .filter({ hasText: "Participant review comment from browser smoke" })
    .filter({ hasText: "unit-1" })
    .filter({ hasText: "Original unit unit-1" })
    .filter({ hasText: "Browser" })
    .waitFor();
  const participantReviewPayload = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/test-runs/${participantReviewRunId}/reviews`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.some(
        item =>
          item?.comment === "Participant review comment from browser smoke" &&
          item?.originalUnitId === "unit-1" &&
          typeof item?.userAgent === "string" &&
          item.userAgent.length > 0 &&
          item?.priority === 1 &&
          item?.pageLabel === "Browser smoke task" &&
          Array.isArray(item?.categories) &&
          item.categories.join(" ") === "tech content"
      )
  );
  const participantReviewId = participantReviewPayload.items[0]?.reviewId;
  assert.ok(participantReviewId, "Participant review smoke expected a review id.");
  await page
    .locator(`.participant-review-item[data-review-id="${participantReviewId}"]`)
    .getByRole("button", { name: "Edit" })
    .click();
  await page.locator("#participantRouteReviewTargetTest").click();
  await page
    .locator("#participantRouteReviewComment")
    .fill("Updated whole-test review comment");
  await page.locator("#participantRouteReviewSaveButton").click();
  await page
    .locator(".participant-review-item")
    .filter({ hasText: "Updated whole-test review comment" })
    .filter({ hasText: "Whole test" })
    .waitFor({ timeout: 15_000 });
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/test-runs/${participantReviewRunId}/reviews`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.some(
        item =>
          item?.reviewId === participantReviewId &&
          item?.unitKey === null &&
          item?.originalUnitId === "unit-1" &&
          typeof item?.userAgent === "string" &&
          item.userAgent.length > 0 &&
          item?.page === null &&
          item?.pageLabel === null &&
          item?.priority === 1 &&
          item?.categories?.join(" ") === "tech content" &&
          item?.comment === "Updated whole-test review comment"
      )
  );
  page.once("dialog", dialog => dialog.accept());
  await page
    .locator(`.participant-review-item[data-review-id="${participantReviewId}"]`)
    .getByRole("button", { name: "Delete" })
    .click();
  await page.locator("#participantRouteReviewEmpty").waitFor({ timeout: 15_000 });
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/test-runs/${participantReviewRunId}/reviews`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.length === 0
  );
  stopAfter("participant-entry-review-comments");

  logStep("participant-entry-protected-password");
  const protectedParticipantLoginKey = "student-entry-protected";
  const protectedParticipantGroupKey = "group:participant-entry-protected";
  const protectedParticipantDisplayName = "Student Entry Protected";
  const protectedParticipantPassword = "entry-protected-secret";
  await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-roster`,
    {
      body: {
        rosterText: [
          "loginKey,groupKey,displayName,pw",
          [
            protectedParticipantLoginKey,
            protectedParticipantGroupKey,
            protectedParticipantDisplayName,
            protectedParticipantPassword
          ].join(",")
        ].join("\n")
      }
    }
  );
  await page.locator("#participantRouteClearSessionButton").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#participantRouteSessionId")?.value === "" &&
      document.querySelector("#participantRouteRunId")?.textContent?.trim() ===
        "no run yet",
    undefined,
    { timeout: 15_000 }
  );
  await fillAndCommitUntilValue("#participantTenantKey", tenantKey);
  await fillAndCommitUntilValue("#participantWorkspaceKey", workspaceKey);
  await fillAndCommitUntilValue(
    "#participantLoginKey",
    protectedParticipantLoginKey
  );
  await fillAndCommitUntilValue(
    "#participantRouteGroupKey",
    protectedParticipantGroupKey
  );
  await fillAndCommitUntilValue("#participantRouteBookletKey", "");
  await fillAndCommitUntilValue("#participantPassword", "wrong-entry-password");
  await page.locator("#participantRouteSignInButton").click();
  await page
    .locator("#participantEntryIssueCode")
    .filter({ hasText: "participant_password_invalid" })
    .waitFor({ timeout: 15_000 });
  await page.locator("#participantEntryIssueStatus").filter({ hasText: "401" }).waitFor();
  await expectInputValue("#participantRouteSessionId", "");
  await fillAndCommitUntilValue("#participantPassword", protectedParticipantPassword);
  await page.locator("#participantRouteSignInButton").click();
  const protectedParticipantSessionsPayload = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-sessions`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.some(item => {
        const participantSession = item?.participantSession;
        return (
          participantSession?.loginKey === protectedParticipantLoginKey &&
          participantSession?.groupKey === protectedParticipantGroupKey &&
          participantSession?.status === "signed_in"
        );
      })
  );
  const protectedParticipantSessionId =
    protectedParticipantSessionsPayload.items.find(item => {
      const participantSession = item?.participantSession;
      return participantSession?.loginKey === protectedParticipantLoginKey;
    })?.participantSession?.participantSessionId;
  assert.ok(
    protectedParticipantSessionId,
    "UI smoke expected protected participant Sign In to create a signed-in session."
  );
  await expectInputValue("#participantRouteSessionId", protectedParticipantSessionId);
  await page.waitForFunction(
    ([expectedSessionId, expectedDisplayName]) =>
      document.querySelector("#participantRouteSessionLabel")?.textContent?.trim() ===
        expectedSessionId &&
      document.querySelector("#participantEntryDisplayName")?.textContent?.trim() ===
        expectedDisplayName &&
      document.querySelector("#participantRouteStatus")?.textContent?.trim() ===
        "signed_in",
    [protectedParticipantSessionId, protectedParticipantDisplayName],
    { timeout: 15_000 }
  );
  assert.equal(
    await page.locator("#participantEntryIssueCode").count(),
    0,
    "Protected participant issue guidance should clear after a successful sign-in."
  );
  const persistedAfterProtectedSignIn = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("testcenter-rewrite-app-shell") ?? "{}")
  );
  assert.equal(
    Object.hasOwn(persistedAfterProtectedSignIn, "participantPassword"),
    false,
    "Participant passwords should not be persisted in shell localStorage."
  );
  stopAfter("participant-entry-protected-password");

  logStep("participant-entry-second-code");
  const codedParticipantLoginKey = "student-entry-coded";
  const codedParticipantGroupKey = "group:participant-entry-coded";
  await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-roster`,
    {
      body: {
        rosterText: [
          "<Testtakers>",
          "  <CustomTexts>",
          "    <CustomText key=\"login_subtitle\">Project Test Selection</CustomText>",
          "    <CustomText key=\"login_codeInputTitle\">Project Access Code</CustomText>",
          "    <CustomText key=\"login_codeInputPrompt\">Ask the project supervisor for your access code.</CustomText>",
          "    <CustomText key=\"login_testResumeButtonLabel\">Open Project Test</CustomText>",
          "    <CustomText key=\"login_bookletSelectPromptOne\">Choose the available project test.</CustomText>",
          "  </CustomTexts>",
          `  <Group id="${codedParticipantGroupKey}">`,
          `    <Login mode="run-hot-return" name="${codedParticipantLoginKey}">`,
          "      <Booklet codes=\"alpha beta\">booklet:starter</Booklet>",
          "    </Login>",
          "  </Group>",
          "</Testtakers>"
        ].join("\n")
      }
    }
  );
  await page.locator("#participantRouteClearSessionButton").click();
  await expectInputValue("#participantRouteSessionId", "");
  await fillAndCommitUntilValue("#participantLoginKey", codedParticipantLoginKey);
  await fillAndCommitUntilValue("#participantRouteGroupKey", codedParticipantGroupKey);
  await fillAndCommitUntilValue("#participantPassword", "");
  await page.locator("#participantRouteSignInButton").click();
  await page.locator("#participantCodePrompt").waitFor({ timeout: 15_000 });
  await page.locator("#participantCode").waitFor({ timeout: 15_000 });
  await page
    .locator("label")
    .filter({ hasText: "Project Access Code" })
    .filter({ has: page.locator("#participantCode") })
    .waitFor();
  await page
    .locator("#participantCodePrompt")
    .filter({ hasText: "Ask the project supervisor for your access code." })
    .waitFor();
  await expectInputValue("#participantRouteSessionId", "");
  await fillAndCommitUntilValue("#participantCode", "wrong");
  await page.locator("#participantRouteSignInButton").click();
  await page
    .locator("#participantEntryIssueCode")
    .filter({ hasText: "participant_code_invalid" })
    .waitFor({ timeout: 15_000 });
  await fillAndCommitUntilValue("#participantCode", "alpha");
  await page.locator("#participantRouteSignInButton").click();
  const codedParticipantSessionsPayload = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-sessions`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.some(
        item =>
          item?.participantSession?.loginKey === codedParticipantLoginKey &&
          item?.participantSession?.participantCode === "alpha"
      )
  );
  const codedParticipantSessionId =
    codedParticipantSessionsPayload.items.find(
      item => item?.participantSession?.loginKey === codedParticipantLoginKey
    )?.participantSession?.participantSessionId;
  assert.ok(
    codedParticipantSessionId,
    "UI smoke expected the second participant code to create a scoped session."
  );
  await expectInputValue("#participantRouteSessionId", codedParticipantSessionId);
  await page
    .locator("#participantCustomLoginSubtitle")
    .filter({ hasText: "Project Test Selection" })
    .waitFor();
  await page
    .locator("#participantRouteStartOrResumeButton")
    .filter({ hasText: "Open Project Test" })
    .waitFor();
  await page
    .locator("#participantBookletSelectionPrompt")
    .filter({ hasText: "Choose the available project test." })
    .waitFor();
  assert.equal(
    await page.locator("#participantCode").count(),
    0,
    "Participant code input should close after a successful code challenge."
  );
  const persistedAfterParticipantCode = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("testcenter-rewrite-app-shell") ?? "{}")
  );
  assert.equal(
    Object.hasOwn(persistedAfterParticipantCode, "participantCode"),
    false,
    "Participant codes should not be persisted in shell localStorage."
  );
  stopAfter("participant-entry-second-code");

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
  const participantRouteDisplayName = "Student Participant Route";
  await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-roster`,
    {
      body: {
        rosterText: [
          "loginKey,groupKey,bookletKey,displayName",
          [
            participantRouteLoginKey,
            participantRouteGroupKey,
            participantRouteBookletKey,
            participantRouteDisplayName
          ].join(",")
        ].join("\n")
      }
    }
  );
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
    ([expectedLoginKey, expectedGroupKey, expectedDisplayName, expectedSessionId]) =>
      document.querySelector("#participantRouteStatus")?.textContent?.trim() ===
        "running" &&
      document.querySelector("#participantEntryStatus")?.textContent?.trim() ===
        "running" &&
      document.querySelector("#participantRouteLoginLabel")?.textContent?.trim() ===
        expectedLoginKey &&
      document.querySelector("#participantRouteGroupLabel")?.textContent?.trim() ===
        expectedGroupKey &&
      document.querySelector("#participantRouteDisplayName")?.textContent?.trim() ===
        expectedDisplayName &&
      document.querySelector("#participantEntryDisplayName")?.textContent?.trim() ===
        expectedDisplayName &&
      document.querySelector("#participantRouteSessionLabel")?.textContent?.trim() ===
        expectedSessionId &&
      document.querySelector("#participantRouteExecutionMode")?.textContent?.trim() ===
        "run-hot-return · Durchführung Test/Befragung" &&
      document
        .querySelector("#participantRouteResponsePersistence")
        ?.textContent?.trim() === "Responses and player logs are saved" &&
      document.querySelector("#participantRouteUnitDescription")?.textContent?.trim() ===
        "Read the participant prompt." &&
      document.querySelector("#participantRouteUnitContent")?.textContent?.trim() ===
        "Explain how the starter example works.",
    [
      participantRouteLoginKey,
      participantRouteGroupKey,
      participantRouteDisplayName,
      participantRouteSessionId
    ],
    { timeout: 15_000 }
  );
  const participantRouteCopySessionLinkButton = page.locator(
    "#participantRouteCopySessionLinkButton"
  );
  await participantRouteCopySessionLinkButton.waitFor({ state: "visible" });
  assert.equal(
    await participantRouteCopySessionLinkButton.getAttribute("aria-label"),
    `Copy Session Re-Entry: ${participantRouteSessionLink}`
  );
  await participantRouteCopySessionLinkButton.click();
  await page
    .locator("#participantRouteCopySessionLinkButton")
    .filter({ hasText: "Copied" })
    .waitFor({ state: "visible" });
  await page
    .locator("#participantRouteSessionLinkCopyStatus")
    .filter({ hasText: "Session link copied" })
    .waitFor({ state: "visible" });
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
      document.querySelector("#participantRouteUnitOverview")?.textContent?.trim() ===
        "1/3 answered · 2 open" &&
      document
        .querySelector(`#participantRouteUnitRail [data-unit-key="${expectedUnitKey}"] em`)
        ?.textContent?.trim() === "Current answered" &&
      document
        .querySelector(
          `#participantRouteUnitRail [data-unit-key="${expectedNextUnitKey}"]`
        )
        ?.textContent?.includes("Paused Work") &&
      document
        .querySelector(`#participantRouteUnitRail [data-unit-key="${expectedNextUnitKey}"] em`)
        ?.textContent?.trim() === "Open",
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
      document.querySelector("#participantRouteUnitContent")?.textContent?.trim() ===
        "Answer the direct Testcenter definition prompt." &&
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
      document.querySelector("#participantRouteUnitOverview")?.textContent?.trim() ===
        "2/3 answered · 1 open" &&
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
      document.querySelector("#participantRouteUnitOverview")?.textContent?.trim() ===
        "3/3 answered · 0 open" &&
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

  logStep("participant-verona-player");
  const veronaPlayerKey = "verona-smoke-player@6.0";
  const veronaBookletKey = "booklet:verona-smoke";
  const veronaUnitKey = "unit:verona-smoke";
  const veronaTestletKey = "testlet:verona-protected";
  const veronaTestletCode = "open-verona";
  const veronaLoginKey = "student-verona-smoke";
  const veronaAdvisoryLoginKey = "student-verona-advisory";
  const expectedVeronaResourceContent =
    'This content was fetched dynamically by the player via directDownloadUrl from resource-package "sample_resource_package".\n';
  const expectedVeronaResourceRange = expectedVeronaResourceContent.slice(5, 20);
  const expectedVeronaResourceMultiRanges = [
    expectedVeronaResourceContent.slice(0, 4),
    expectedVeronaResourceContent.slice(10, 16)
  ];
  const originalVeronaResourcePackage = Buffer.from(
    (
      await readFile(
        resolve(
          "test-fixtures/original-testcenter/resources/sample_resource_package.itcr.zip.base64"
        ),
        "utf8"
      )
    ).trim(),
    "base64"
  );
  const veronaPlayerHtml = `<!doctype html>
    <html><body>
      <strong id="playerDefinition"></strong>
      <output id="playerConfig"></output>
      <output id="playerStartPage"></output>
      <output id="playerResource"></output>
      <output id="playerResourceRange"></output>
      <output id="playerResourceMultiRange"></output>
      <label>Player answer <input id="playerAnswer" /></label>
      <button id="playerEnd" type="button">End from player</button>
      <script>
        let sessionId = "";
        const sendState = () => parent.postMessage({
          type: "vopStateChangedNotification",
          sessionId,
          unitState: {
            dataParts: { answer: document.querySelector("#playerAnswer").value },
            presentationProgress: "complete",
            responseProgress: document.querySelector("#playerAnswer").value ? "complete" : "none",
            unitStateDataType: "verona-smoke@1"
          },
          playerState: { currentPage: "page-1" },
          log: [{
            key: "PLAYER_STATE_CHANGED",
            timeStamp: Date.now(),
            content: document.querySelector("#playerAnswer").value
          }]
        }, "*");
        addEventListener("message", event => {
          if (event.data?.type !== "vopStartCommand") return;
          sessionId = event.data.sessionId;
          document.querySelector("#playerDefinition").textContent = event.data.unitDefinition;
          document.querySelector("#playerConfig").textContent = JSON.stringify(event.data.playerConfig);
          document.querySelector("#playerStartPage").textContent = String(event.data.playerConfig?.startPage || "");
          document.querySelector("#playerAnswer").value = event.data.unitState?.dataParts?.answer || "";
          document.querySelector("#playerAnswer").addEventListener("input", sendState);
          parent.postMessage({
            type: "vopWindowFocusChangedNotification",
            hasFocus: true
          }, "*");
          fetch(event.data.playerConfig.directDownloadUrl + "/sample_resource_package/file.text")
            .then(response => {
              if (!response.ok) throw new Error("resource status " + response.status);
              return response.text();
            })
            .then(content => {
              document.querySelector("#playerResource").textContent = content;
            })
            .catch(error => {
              document.querySelector("#playerResource").textContent = "resource-error: " + error.message;
            });
          fetch(event.data.playerConfig.directDownloadUrl + "/sample_resource_package/file.text", {
            headers: { Range: "bytes=5-19" }
          })
            .then(async response => {
              if (response.status !== 206) throw new Error("range status " + response.status);
              const content = await response.text();
              return response.headers.get("content-range") + "|" + content;
            })
            .then(content => {
              document.querySelector("#playerResourceRange").textContent = content;
            })
            .catch(error => {
              document.querySelector("#playerResourceRange").textContent = "resource-range-error: " + error.message;
            });
          fetch(event.data.playerConfig.directDownloadUrl + "/sample_resource_package/file.text", {
            headers: { Range: "bytes=0-3,10-15" }
          })
            .then(async response => {
              if (response.status !== 206) throw new Error("multi-range status " + response.status);
              return (response.headers.get("content-type") || "") + "|" + await response.text();
            })
            .then(content => {
              document.querySelector("#playerResourceMultiRange").textContent = content;
            })
            .catch(error => {
              document.querySelector("#playerResourceMultiRange").textContent = "resource-multi-range-error: " + error.message;
            });
        });
        document.querySelector("#playerEnd").addEventListener("click", () => parent.postMessage({
          type: "vopUnitNavigationRequestedNotification",
          sessionId,
          target: "end"
        }, "*"));
        addEventListener("DOMContentLoaded", () => setTimeout(() => parent.postMessage({
          type: "vopReadyNotification",
          metadata: { specVersion: "6.0" }
        }, "*"), 750));
      <\/script>
    </body></html>`;
  const veronaSourcePackageZip = createStoredZipBuffer([
    {
      fileName: "export/imsmanifest.xml",
      content: `
        <manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1">
          <resources>
            <resource identifier="${veronaBookletKey}" href="booklets/Booklet.xml">
              <dependency identifierref="${veronaUnitKey}" />
            </resource>
            <resource identifier="${veronaUnitKey}" href="units/Unit.xml" />
            <resource identifier="${veronaPlayerKey}" href="players/verona-smoke.html" />
          </resources>
        </manifest>
      `
    },
    {
      fileName: "export/booklets/Booklet.xml",
      content: `
        <Booklet>
          <Metadata>
            <Id>${veronaBookletKey}</Id>
            <Label>Verona Smoke Booklet</Label>
          </Metadata>
          <BookletConfig>
            <Config key="force_response_complete">OFF</Config>
            <Config key="allow_player_to_terminate_test">LAST_UNIT</Config>
            <Config key="unit_menu">OFF</Config>
            <Config key="unit_navibuttons">OFF</Config>
            <Config key="pagingMode">concat-scroll</Config>
            <Config key="logPolicy">debug</Config>
            <Config key="restore_current_page_on_return">ON</Config>
            <Config key="toolbar_show_reload_button">TRUE</Config>
            <Config key="unit_show_time_left">ON</Config>
            <Config key="unit_time_left_warnings">1</Config>
          </BookletConfig>
          <Units>
            <Testlet id="${veronaTestletKey}" label="Protected Verona Block">
              <Restrictions>
                <CodeToEnter code="${veronaTestletCode}">Enter the assigned Verona block code.</CodeToEnter>
                <TimeMax minutes="1.05" leave="allowed" />
                <DenyNavigationOnIncomplete response="ON" />
                <LockAfterLeaving confirm="true" scope="unit" />
              </Restrictions>
              <Unit id="${veronaUnitKey}" label="Verona Smoke Unit" />
            </Testlet>
          </Units>
        </Booklet>
      `
    },
    {
      fileName: "export/units/Unit.xml",
      content: `
        <Unit>
          <Metadata>
            <Id>${veronaUnitKey}</Id>
            <Label>Verona Smoke Unit</Label>
          </Metadata>
          <Definition player="${veronaPlayerKey}"><![CDATA[Smoke unit definition]]></Definition>
          <Dependencies><File for="player">sample_resource_package.itcr.zip</File></Dependencies>
        </Unit>
      `
    },
    {
      fileName: "export/players/verona-smoke.html",
      content: veronaPlayerHtml
    },
    {
      fileName: "export/resources/sample_resource_package.itcr.zip",
      content: originalVeronaResourcePackage
    }
  ]);
  const veronaSourcePackageResponse = await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`,
    {
      body: {
        fileName: "verona-resource-smoke.zip",
        mediaType: "application/zip",
        sourceDocument: `data:application/zip;base64,${veronaSourcePackageZip.toString("base64")}`
      }
    }
  );
  const veronaSourcePackagePayload = await veronaSourcePackageResponse.json();
  const veronaImportResponse = await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`,
    {
      body: {
        sourcePackageId: veronaSourcePackagePayload.sourcePackage.sourcePackageId
      }
    }
  );
  const veronaImportPayload = await veronaImportResponse.json();
  assert.ok(
    veronaImportPayload.importJob?.diagnostics?.some(
      diagnostic =>
        diagnostic.code === "source_document_player_metadata_missing" &&
        diagnostic.severity === "warning"
    ),
    "Metadata-free Verona player import should retain a legacy compatibility warning."
  );
  const veronaContentReleaseId =
    veronaImportPayload.stagedContentRelease?.contentReleaseId;
  assert.ok(veronaContentReleaseId, "Verona smoke import should stage a release.");
  await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${veronaContentReleaseId}/activate`,
    { body: { forceActivation: true } }
  );
  await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-roster`,
    {
      body: {
        rosterText: [
          {
            loginKey: veronaLoginKey,
            groupKey: "group:verona-smoke",
            bookletKey: veronaBookletKey,
            displayName: "Verona Smoke Participant",
            customTexts: {
              booklet_loading: "Please wait for the project player.",
              booklet_loadingBlock: "Project block is loading",
              booklet_unitLoadingPending: "Project player is queued.",
              booklet_unitLoadingUnknownProgress: "Project loading progress is pending.",
              booklet_unitLoading: "Project player loaded",
              booklet_errormessage: "The project player could not be loaded.",
              booklet_msgTimerStarted: "Project timer started: ",
              booklet_msgTimeOver: "Project time is over.",
              booklet_msgTimerCancelled: "Project timer was cancelled.",
              login_unsupportedBrowserBanner:
                "Project browser %s %s needs an update.",
              booklet_codeToEnterTitle: "Project block access",
              booklet_codeToEnterPrompt: "Enter the project block code.",
              booklet_codeToEnterWarning: "Letters are normalized automatically.",
              booketlet_continueButtonLockedUnit: "Continue to project block",
              booklet_msgSoonTimeOver: "Only %s project minute remains.",
              booklet_lockedByAfterLeave: "This project task closes after leaving.",
              booklet_msgNavigationDeniedTitle: "Project task incomplete",
              booklet_msgNavigationDeniedText_responsesIncomplete:
                "Answer the project task before continuing."
            }
          },
          {
            loginKey: veronaAdvisoryLoginKey,
            groupKey: "group:verona-smoke",
            bookletKey: veronaBookletKey,
            displayName: "Verona Advisory Participant",
            executionMode: "run-trial"
          }
        ]
      }
    }
  );
  await outdatedBrowserPage.locator("#participantTenantKey").fill(tenantKey);
  await outdatedBrowserPage
    .locator("#participantWorkspaceKey")
    .fill(workspaceKey);
  await outdatedBrowserPage.locator("#participantLoginKey").fill(veronaLoginKey);
  await outdatedBrowserPage.locator("#participantRouteSignInButton").click();
  await outdatedBrowserPage
    .locator("#browserCompatibilityWarningMessage")
    .filter({ hasText: "Project browser Chrome 90.0.4430.93 needs an update." })
    .waitFor();
  await outdatedBrowserContext.close();
  const isVeronaResourceResponse = response => response
    .url()
    .endsWith("/resources/sample_resource_package/file.text");
  const veronaResourceResponsePromise = page.waitForResponse(
    response =>
      isVeronaResourceResponse(response) &&
      !response.request().headers()["range"]
  );
  const veronaRangeResponsePromise = page.waitForResponse(
    response =>
      isVeronaResourceResponse(response) &&
      response.request().headers()["range"] === "bytes=5-19"
  );
  const veronaMultiRangeResponsePromise = page.waitForResponse(
    response =>
      isVeronaResourceResponse(response) &&
      response.request().headers()["range"] === "bytes=0-3,10-15"
  );
  await page.goto(
    `${baseUrl}/participant?${new URLSearchParams({
      tenantKey,
      workspaceKey,
      loginKey: veronaLoginKey,
      bookletKey: veronaBookletKey
    }).toString()}`,
    { waitUntil: "networkidle" }
  );
  await page
    .locator("#participantRouteTestletGateLabel")
    .filter({ hasText: "Protected Verona Block" })
    .waitFor({ timeout: 15_000 });
  await page
    .locator("#participantRouteTestletGatePrompt")
    .filter({ hasText: "Enter the project block code." })
    .waitFor();
  await page
    .locator("#participantRouteTestletGateWarning")
    .filter({ hasText: "Letters are normalized automatically." })
    .waitFor();
  await page
    .locator("#participantRouteTestletUnlockButton")
    .filter({ hasText: "Continue to project block" })
    .waitFor();
  await page
    .locator(".participant-testlet-gate")
    .filter({ hasText: "Project block access" })
    .waitFor();
  assert.equal(await page.locator("#participantVeronaPlayerFrame").count(), 0);
  await page.evaluate(() => {
    window.__participantVeronaLoadingPhases = [];
    const recordLoadingPhase = () => {
      const loadingElement = document.querySelector(
        "#participantVeronaPlayerLoading"
      );
      const phase = loadingElement?.getAttribute("data-loading-phase");
      const label = document
        .querySelector("#participantVeronaPlayerLoadingLabel")
        ?.textContent?.trim();
      const title = document
        .querySelector("#participantVeronaPlayerLoadingTitle")
        ?.textContent?.trim();
      const message = document
        .querySelector("#participantVeronaPlayerLoadingStatus")
        ?.textContent?.trim();
      if (!phase || !label || !title || !message) {
        return;
      }
      const records = window.__participantVeronaLoadingPhases;
      if (!records.some(record => record.phase === phase)) {
        records.push({ phase, label, title, message });
      }
    };
    window.__participantVeronaLoadingObserver = new MutationObserver(
      recordLoadingPhase
    );
    window.__participantVeronaLoadingObserver.observe(document.body, {
      attributes: true,
      childList: true,
      subtree: true,
      attributeFilter: ["data-loading-phase"]
    });
    const recordLoadingFrame = () => {
      recordLoadingPhase();
      window.__participantVeronaLoadingFrameRequest =
        window.requestAnimationFrame(recordLoadingFrame);
    };
    window.__participantVeronaLoadingFrameRequest =
      window.requestAnimationFrame(recordLoadingFrame);
    recordLoadingPhase();
  });
  await page.locator("#participantRouteTestletUnlockCode").fill(veronaTestletCode);
  await page.locator("#participantRouteTestletUnlockButton").click();
  await page
    .locator("#participantVeronaPlayerStatus")
    .filter({ hasText: "running" })
    .waitFor({ timeout: 15_000 });
  const veronaLoadingPhases = await page.evaluate(() => {
    window.__participantVeronaLoadingObserver?.disconnect();
    window.cancelAnimationFrame(
      window.__participantVeronaLoadingFrameRequest ?? 0
    );
    return window.__participantVeronaLoadingPhases;
  });
  assert.deepEqual(veronaLoadingPhases, [
    {
      phase: "pending",
      label: "Please wait for the project player.",
      title: "Project block is loading",
      message: "Project player is queued."
    },
    {
      phase: "unknown",
      label: "Please wait for the project player.",
      title: "Project block is loading",
      message: "Project loading progress is pending."
    },
    {
      phase: "complete",
      label: "Please wait for the project player.",
      title: "Project block is loading",
      message: "100% Project player loaded"
    }
  ]);
  await page
    .locator("#participantRouteTestletTimerLabel")
    .filter({ hasText: "Protected Verona Block" })
    .waitFor({ timeout: 15_000 });
  const timerStartedMessage = page.locator(
    "#participantRouteTimerLifecycleMessage"
  );
  await timerStartedMessage.waitFor();
  assert.match(
    (await timerStartedMessage.innerText()).trim(),
    /^Project timer started: \d+:\d{2}$/
  );
  await page
    .locator("#participantRouteTestletTimerLeave")
    .filter({ hasText: "closes it immediately" })
    .waitFor();
  const veronaTimerValue = (
    await page.locator("#participantRouteTestletTimerValue").innerText()
  ).trim();
  assert.match(veronaTimerValue, /^[01]:[0-5]\d$/);
  const [veronaTimerMinutes, veronaTimerSeconds] = veronaTimerValue
    .split(":")
    .map(Number);
  assert.ok(
    veronaTimerMinutes * 60 + veronaTimerSeconds > 0 &&
      veronaTimerMinutes * 60 + veronaTimerSeconds <= 63,
    `Expected a live Verona testlet timer, received '${veronaTimerValue}'.`
  );
  await page
    .locator("#participantRouteTestletTimerWarning")
    .filter({ hasText: "Only 1 project minute remains." })
    .waitFor({ timeout: 10_000 });
  await page
    .locator("#participantRouteLeaveLockLabel")
    .filter({ hasText: "Verona Smoke Unit" })
    .waitFor();
  await page
    .locator("#participantRouteLeaveLockDetail")
    .filter({ hasText: "This project task closes after leaving." })
    .waitFor();
  const veronaFrame = page.frameLocator("#participantVeronaPlayerFrame");
  await veronaFrame.locator("#playerAnswer").waitFor({ timeout: 15_000 });
  await veronaFrame
    .locator("#playerDefinition")
    .filter({ hasText: "Smoke unit definition" })
    .waitFor();
  await page
    .locator("#participantVeronaPlayerVersion")
    .filter({ hasText: "API 6.0" })
    .waitFor();
  await veronaFrame
    .locator("#playerConfig")
    .filter({ hasText: '"pagingMode":"concat-scroll"' })
    .filter({ hasText: '"logPolicy":"debug"' })
    .waitFor();
  await veronaFrame
    .locator("#playerResource")
    .filter({ hasText: expectedVeronaResourceContent.trim() })
    .waitFor({ timeout: 15_000 });
  await veronaFrame
    .locator("#playerResourceRange")
    .filter({ hasText: expectedVeronaResourceRange })
    .waitFor({ timeout: 15_000 });
  await veronaFrame
    .locator("#playerResourceMultiRange")
    .filter({ hasText: "multipart/byteranges" })
    .waitFor({ timeout: 15_000 });
  const veronaResourceResponse = await veronaResourceResponsePromise;
  assert.equal(veronaResourceResponse.status(), 200);
  assert.equal(
    veronaResourceResponse.headers()["access-control-allow-origin"],
    "*"
  );
  assert.equal(
    await veronaFrame.locator("#playerResource").textContent(),
    expectedVeronaResourceContent
  );
  const veronaRangeResponse = await veronaRangeResponsePromise;
  assert.equal(veronaRangeResponse.status(), 206);
  assert.equal(
    veronaRangeResponse.headers()["content-range"],
    `bytes 5-19/${Buffer.byteLength(expectedVeronaResourceContent, "utf8")}`
  );
  assert.equal(
    await veronaFrame.locator("#playerResourceRange").textContent(),
    `${veronaRangeResponse.headers()["content-range"]}|${expectedVeronaResourceRange}`
  );
  const veronaMultiRangeResponse = await veronaMultiRangeResponsePromise;
  assert.equal(veronaMultiRangeResponse.status(), 206);
  assert.match(
    veronaMultiRangeResponse.headers()["content-type"] ?? "",
    /^multipart\/byteranges; boundary=/i
  );
  assert.equal(veronaMultiRangeResponse.headers()["content-range"], undefined);
  const veronaMultiRangeContent =
    (await veronaFrame.locator("#playerResourceMultiRange").textContent()) ?? "";
  assert.match(veronaMultiRangeContent, /Content-Range: bytes 0-3\//);
  assert.match(veronaMultiRangeContent, /Content-Range: bytes 10-15\//);
  for (const expectedRange of expectedVeronaResourceMultiRanges) {
    assert.ok(veronaMultiRangeContent.includes(expectedRange));
  }
  await page
    .locator("#participantRouteNavigationNotice")
    .filter({ hasText: "Answer the project task before continuing." })
    .waitFor();
  await page
    .locator("#participantRouteNavigationNoticeTitle")
    .filter({ hasText: "Project task incomplete" })
    .waitFor();
  assert.equal(
    await page.locator("#participantRouteCompleteButton").isDisabled(),
    true
  );
  assert.equal(await page.locator("#participantRouteUnitRail").count(), 0);
  assert.equal(await page.locator("#participantRouteNextUnitButton").count(), 0);
  const veronaParticipantSessionId = await page
    .locator("#participantRouteSessionId")
    .inputValue();
  assert.ok(veronaParticipantSessionId);
  assert.equal(
    JSON.parse(
      (await veronaFrame.locator("#playerConfig").textContent()) ?? "{}"
    ).directDownloadUrl,
    `${baseUrl}/api/v1/participant/sessions/${veronaParticipantSessionId}/resources`
  );
  await veronaFrame.locator("#playerEnd").click();
  await page.waitForTimeout(250);
  const guardedPlayerEndState = await (
    await fetch(
      `${baseUrl}/api/v1/participant/sessions/${veronaParticipantSessionId}/current-state`
    )
  ).json();
  assert.equal(guardedPlayerEndState.currentRunState.testRun.status, "running");
  await veronaFrame.locator("#playerAnswer").fill("Saved through Verona");
  await page.waitForFunction(
    () =>
      document.querySelector("#participantVeronaSaveStatus")?.textContent?.trim() ===
      "saved",
    undefined,
    { timeout: 15_000 }
  );
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${veronaParticipantSessionId}/current-state`,
    payload => {
      const response = payload?.currentRunState?.testRun?.unitResponses?.[veronaUnitKey];
      if (typeof response !== "string") return false;
      try {
        const parsed = JSON.parse(response);
        return (
          parsed.kind === "verona_unit_state" &&
          parsed.unitState?.dataParts?.answer === "Saved through Verona"
        );
      } catch {
        return false;
      }
    }
  );
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/test-logs?loginKey=${encodeURIComponent(
      veronaLoginKey
    )}&logKey=PLAYER_STATE_CHANGED&unitKey=${encodeURIComponent(veronaUnitKey)}`,
    payload =>
      Array.isArray(payload?.items) &&
      payload.items.some(
        item =>
          item.testLog?.logKey === "PLAYER_STATE_CHANGED" &&
          item.testLog?.logContent === "Saved through Verona" &&
          item.testLog?.unitKey === veronaUnitKey
      )
  );
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/test-logs?loginKey=${encodeURIComponent(
      veronaLoginKey
    )}&logKey=FOCUS`,
    payload =>
      Array.isArray(payload?.items) &&
      payload.items.some(
        item =>
          item.testLog?.logKey === "FOCUS" &&
          item.testLog?.logContent === "HAS" &&
          item.testLog?.unitKey === null &&
          item.testLog?.originalUnitId === null
      )
  );
  await page.locator("#participantRouteNavigationNotice").waitFor({ state: "detached" });
  assert.equal(
    await page.locator("#participantRouteCompleteButton").isDisabled(),
    false
  );
  await page
    .locator("#participantVeronaPlayerLoading")
    .waitFor({ state: "detached", timeout: 15_000 });
  await page
    .locator("#participantVeronaPlayerStatus")
    .filter({ hasText: "running" })
    .waitFor();
  logStep("participant-verona-offline-outbox");
  const veronaOfflineResponse = "Recovered after offline reload";
  const veronaTestRunId = (
    await page.locator("#participantRouteRunId").textContent()
  )?.trim();
  assert.ok(veronaTestRunId);
  const veronaSaveProgressUrl =
    `**/api/v1/participant/test-runs/${veronaTestRunId}/save-progress`;
  const rejectVeronaSave = route => route.abort("internetdisconnected");
  await page.route(veronaSaveProgressUrl, rejectVeronaSave);
  await veronaFrame.locator("#playerAnswer").fill(veronaOfflineResponse);
  await page
    .locator("#participantVeronaSaveStatus")
    .filter({ hasText: "queued offline" })
    .waitFor({ timeout: 15_000 });
  const queuedOutbox = await page.evaluate(() => {
    const rawValue = localStorage.getItem(
      "testcenter-rewrite:participant-save-outbox:v1"
    );
    return rawValue ? JSON.parse(rawValue) : null;
  });
  assert.equal(queuedOutbox?.version, 1);
  assert.ok(
    queuedOutbox.entries.some(entry => {
      if (
        entry.testRunId !== veronaTestRunId ||
        entry.unitKey !== veronaUnitKey ||
        typeof entry.response !== "string" ||
        !entry.deliveryId
      ) {
        return false;
      }
      try {
        return (
          JSON.parse(entry.response).unitState?.dataParts?.answer ===
          veronaOfflineResponse
        );
      } catch {
        return false;
      }
    }),
    "Failed Verona saves should remain durable in the browser outbox."
  );
  await page.unroute(veronaSaveProgressUrl, rejectVeronaSave);
  await page.locator("#participantRouteReloadButton").click({ noWaitAfter: true });
  await page.waitForURL(url =>
    url.searchParams.get("participantSessionId") === veronaParticipantSessionId
  );
  await page.waitForLoadState("networkidle");
  const offlineRecoveredVeronaFrame = page.frameLocator(
    "#participantVeronaPlayerFrame"
  );
  await offlineRecoveredVeronaFrame
    .locator("#playerAnswer")
    .waitFor({ timeout: 15_000 });
  await offlineRecoveredVeronaFrame
    .locator("#playerDefinition")
    .filter({ hasText: "Smoke unit definition" })
    .waitFor({ timeout: 15_000 });
  assert.equal(
    await offlineRecoveredVeronaFrame.locator("#playerAnswer").inputValue(),
    veronaOfflineResponse
  );
  await page
    .locator("#participantVeronaSaveStatus")
    .filter({ hasText: "saved" })
    .waitFor({ timeout: 15_000 });
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${veronaParticipantSessionId}/current-state`,
    payload => {
      const response =
        payload?.currentRunState?.testRun?.unitResponses?.[veronaUnitKey];
      if (typeof response !== "string") return false;
      try {
        return (
          JSON.parse(response).unitState?.dataParts?.answer ===
          veronaOfflineResponse
        );
      } catch {
        return false;
      }
    }
  );
  assert.equal(
    await page.evaluate(() =>
      localStorage.getItem("testcenter-rewrite:participant-save-outbox:v1")
    ),
    null,
    "A confirmed retry should remove the durable Verona outbox entry."
  );
  const recoveredVeronaLogs = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/test-logs?loginKey=${encodeURIComponent(
      veronaLoginKey
    )}&logKey=PLAYER_STATE_CHANGED&unitKey=${encodeURIComponent(veronaUnitKey)}`,
    payload =>
      Array.isArray(payload?.items) &&
      payload.items.some(
        item => item.testLog?.logContent === veronaOfflineResponse
      )
  );
  assert.equal(
    recoveredVeronaLogs.items.filter(
      item => item.testLog?.logContent === veronaOfflineResponse
    ).length,
    1,
    "Outbox retries should not duplicate Verona Player logs."
  );
  await page.goto(
    `${baseUrl}/participant?participantSessionId=${encodeURIComponent(
      veronaParticipantSessionId
    )}`,
    { waitUntil: "networkidle" }
  );
  const resumedVeronaFrame = page.frameLocator("#participantVeronaPlayerFrame");
  await resumedVeronaFrame.locator("#playerAnswer").waitFor({ timeout: 15_000 });
  await resumedVeronaFrame
    .locator("#playerAnswer")
    .waitFor({ state: "visible" });
  await resumedVeronaFrame
    .locator("#playerDefinition")
    .filter({ hasText: "Smoke unit definition" })
    .waitFor({ timeout: 15_000 });
  assert.equal(
    await resumedVeronaFrame.locator("#playerAnswer").inputValue(),
    veronaOfflineResponse
  );
  assert.equal(
    await resumedVeronaFrame.locator("#playerStartPage").textContent(),
    "page-1"
  );

  logStep("participant-verona-background-sync");
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined));
  const backgroundSyncedResponse = "Saved after participant closed";
  await resumedVeronaFrame
    .locator("#playerAnswer")
    .fill(backgroundSyncedResponse);
  await page.waitForFunction(
    ({ storageKey, testRunId, expectedAnswer }) => {
      const rawValue = localStorage.getItem(storageKey);
      if (!rawValue) return false;
      try {
        const document = JSON.parse(rawValue);
        return document.entries?.some(entry => {
          if (entry.testRunId !== testRunId) return false;
          return JSON.parse(entry.response).unitState?.dataParts?.answer ===
            expectedAnswer;
        });
      } catch {
        return false;
      }
    },
    {
      storageKey: "testcenter-rewrite:participant-save-outbox:v1",
      testRunId: veronaTestRunId,
      expectedAnswer: backgroundSyncedResponse
    }
  );
  await page.goto(`${baseUrl}/app/runtime`, { waitUntil: "domcontentloaded" });
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${veronaParticipantSessionId}/current-state`,
    payload => {
      const response =
        payload?.currentRunState?.testRun?.unitResponses?.[veronaUnitKey];
      if (typeof response !== "string") return false;
      try {
        return JSON.parse(response).unitState?.dataParts?.answer ===
          backgroundSyncedResponse;
      } catch {
        return false;
      }
    }
  );
  await page.goto(
    `${baseUrl}/participant?participantSessionId=${encodeURIComponent(
      veronaParticipantSessionId
    )}`,
    { waitUntil: "networkidle" }
  );
  const backgroundSyncedVeronaFrame = page.frameLocator(
    "#participantVeronaPlayerFrame"
  );
  await backgroundSyncedVeronaFrame
    .locator("#playerAnswer")
    .waitFor({ timeout: 15_000 });
  await page.waitForFunction(
    storageKey => localStorage.getItem(storageKey) === null,
    "testcenter-rewrite:participant-save-outbox:v1"
  );
  const backgroundQueueEntryCount = await page.evaluate(
    () => new Promise((resolvePromise, reject) => {
      const request = indexedDB.open("testcenter-participant-save-outbox-v1", 1);
      request.addEventListener("error", () => reject(request.error));
      request.addEventListener("success", () => {
        const database = request.result;
        const transaction = database.transaction("pending-saves", "readonly");
        const countRequest = transaction.objectStore("pending-saves").count();
        countRequest.addEventListener("error", () => reject(countRequest.error));
        countRequest.addEventListener("success", () => {
          database.close();
          resolvePromise(countRequest.result);
        });
      });
    })
  );
  assert.equal(
    backgroundQueueEntryCount,
    0,
    "A delivered background response should leave no Service Worker outbox entry."
  );
  await delay(2_500);
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${veronaParticipantSessionId}/current-state`,
    payload => {
      const response =
        payload?.currentRunState?.testRun?.unitResponses?.[veronaUnitKey];
      if (typeof response !== "string") return false;
      try {
        return JSON.parse(response).unitState?.dataParts?.answer ===
          backgroundSyncedResponse;
      } catch {
        return false;
      }
    }
  );
  stopAfter("participant-verona-background-sync");

  logStep("participant-test-mode-navigation-advisory");
  await page.goto(
    `${baseUrl}/participant?${new URLSearchParams({
      tenantKey,
      workspaceKey,
      loginKey: veronaAdvisoryLoginKey,
      bookletKey: veronaBookletKey
    }).toString()}`,
    { waitUntil: "networkidle" }
  );
  const advisoryVeronaFrame = page.frameLocator("#participantVeronaPlayerFrame");
  await advisoryVeronaFrame.locator("#playerAnswer").waitFor({ timeout: 15_000 });
  await page
    .locator("#participantRouteExecutionMode")
    .filter({ hasText: "run-trial" })
    .waitFor();
  await expectButtonSelectorEnabled("#participantRouteCompleteButton");
  const acceptAdvisoryCompletionDialog = dialog => dialog.accept();
  page.on("dialog", acceptAdvisoryCompletionDialog);
  try {
    await page.locator("#participantRouteCompleteButton").click();
  } finally {
    page.off("dialog", acceptAdvisoryCompletionDialog);
  }
  await page
    .locator("#participantRouteNavigationNoticeTitle")
    .filter({ hasText: "Test mode: navigation remains available" })
    .waitFor();
  await page
    .locator("#participantRouteNavigationNotice")
    .filter({ hasText: "In an enforced test, this action would be blocked." })
    .filter({ hasText: "Complete the required response" })
    .waitFor();
  await page
    .locator("#participantRouteStatus")
    .filter({ hasText: "completed" })
    .waitFor({ timeout: 15_000 });
  stopAfter("participant-test-mode-navigation-advisory");

  logStep("participant-original-verona-player");
  const originalAdaptiveLoginKey = "student-original-adaptive-smoke";
  const originalAdaptiveBookletKey = "BOOKLET.SAMPLE-2";
  const originalAdaptiveUnitKey = "decision-unit";
  const [
    originalAdaptiveBookletDocument,
    originalAdaptiveUnitDocument,
    originalAdaptiveCodingSchemeDocument,
    originalAdaptivePlayerDocument
  ] = await Promise.all([
    readFile(
      resolve("test-fixtures/original-testcenter/booklets/Booklet2.xml"),
      "utf8"
    ),
    readFile(
      resolve("test-fixtures/original-testcenter/units/Unit2.xml"),
      "utf8"
    ),
    readFile(
      resolve(
        "test-fixtures/original-testcenter/schemes/coding-scheme.vocs.json"
      ),
      "utf8"
    ),
    readFile(
      resolve(
        "test-fixtures/original-testcenter/players/verona-player-simple-6.0.html"
      ),
      "utf8"
    )
  ]);
  const originalAdaptiveZip = createStoredZipBuffer([
    {
      fileName: "export/imsmanifest.xml",
      content: `
        <manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1">
          <resources>
            <resource identifier="${originalAdaptiveBookletKey}" href="booklets/Booklet2.xml" />
            <resource identifier="UNIT.SAMPLE-2" href="units/Unit2.xml" />
            <resource identifier="coding-scheme.vocs.json" href="schemes/coding-scheme.vocs.json" />
            <resource identifier="verona-player-simple@6.0" href="players/verona-player-simple-6.0.html" />
          </resources>
        </manifest>
      `
    },
    {
      fileName: "export/booklets/Booklet2.xml",
      content: originalAdaptiveBookletDocument
    },
    {
      fileName: "export/units/Unit2.xml",
      content: originalAdaptiveUnitDocument
    },
    {
      fileName: "export/schemes/coding-scheme.vocs.json",
      content: originalAdaptiveCodingSchemeDocument
    },
    {
      fileName: "export/players/verona-player-simple-6.0.html",
      content: originalAdaptivePlayerDocument
    }
  ]);
  const originalAdaptiveSourcePackageResponse = await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`,
    {
      body: {
        fileName: "original-adaptive-browser-smoke.zip",
        mediaType: "application/zip",
        sourceDocument: `data:application/zip;base64,${originalAdaptiveZip.toString("base64")}`
      }
    }
  );
  const originalAdaptiveSourcePackagePayload =
    await originalAdaptiveSourcePackageResponse.json();
  const originalAdaptiveImportResponse = await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`,
    {
      body: {
        sourcePackageId:
          originalAdaptiveSourcePackagePayload.sourcePackage.sourcePackageId
      }
    }
  );
  const originalAdaptiveImportPayload = await originalAdaptiveImportResponse.json();
  const originalAdaptiveReleaseId =
    originalAdaptiveImportPayload.stagedContentRelease?.contentReleaseId;
  assert.ok(
    originalAdaptiveReleaseId,
    "Original adaptive browser smoke import should stage a release."
  );
  await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${originalAdaptiveReleaseId}/activate`,
    { body: { forceActivation: true } }
  );
  await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-roster`,
    {
      body: {
        rosterText: [
          {
            loginKey: originalAdaptiveLoginKey,
            groupKey: "group:original-adaptive-smoke",
            bookletKey: originalAdaptiveBookletKey,
            displayName: "Original Adaptive Smoke Participant",
            executionMode: "run-trial"
          }
        ]
      }
    }
  );
  await page.goto(
    `${baseUrl}/participant?${new URLSearchParams({
      tenantKey,
      workspaceKey,
      loginKey: originalAdaptiveLoginKey,
      bookletKey: originalAdaptiveBookletKey
    }).toString()}`,
    { waitUntil: "networkidle" }
  );
  const originalAdaptiveFrame = page.frameLocator(
    "#participantVeronaPlayerFrame"
  );
  await originalAdaptiveFrame.locator("#var1").waitFor({ timeout: 15_000 });
  await originalAdaptiveFrame.locator("#var2").waitFor();
  await page
    .locator("#participantVeronaPlayerVersion")
    .filter({ hasText: "API 6.0" })
    .waitFor();
  await originalAdaptiveFrame
    .locator("label[for='var1']")
    .filter({ hasText: "var1" })
    .waitFor();
  const originalAdaptiveParticipantSessionId = await page
    .locator("#participantRouteSessionId")
    .inputValue();
  assert.ok(originalAdaptiveParticipantSessionId);
  await originalAdaptiveFrame.locator("#var1").fill("a");
  await originalAdaptiveFrame.locator("#var1").dispatchEvent("keyup", {
    key: "a",
    code: "KeyA"
  });
  await originalAdaptiveFrame.locator("#var2").fill("a");
  await originalAdaptiveFrame.locator("#var2").dispatchEvent("keyup", {
    key: "a",
    code: "KeyA"
  });
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${originalAdaptiveParticipantSessionId}/current-state`,
    payload => {
      if (
        payload?.currentRunState?.testRun?.bookletStates?.level !==
          "professional" ||
        payload.currentRunState.testRun.bookletStates?.bonus !== "no"
      ) {
        return false;
      }
      const response =
        payload.currentRunState.testRun.unitResponses?.[originalAdaptiveUnitKey];
      if (typeof response !== "string") return false;
      try {
        const parsed = JSON.parse(response);
        const answers = JSON.parse(parsed.unitState?.dataParts?.answers ?? "[]");
        return (
          answers.find(answer => answer.id === "var1")?.value === "a" &&
          answers.find(answer => answer.id === "var2")?.value === "a"
        );
      } catch {
        return false;
      }
    }
  );
  await page.waitForFunction(
    () => {
      const unitKeys = [
        ...document.querySelectorAll(
          "#participantRouteUnitRail [data-unit-key]"
        )
      ].map(element => element.getAttribute("data-unit-key"));
      return (
        unitKeys.length === 2 &&
        unitKeys[0] === "decision-unit" &&
        unitKeys[1] === "professional-unit"
      );
    },
    undefined,
    { timeout: 15_000 }
  );
  await page.waitForFunction(() =>
    Boolean(document.querySelector("#participantRouteAdaptiveState-level"))
  );
  await page.evaluate(() => {
    const select = document.querySelector("#participantRouteAdaptiveState-level");
    if (!(select instanceof HTMLSelectElement)) {
      throw new Error("Adaptive level selector is unavailable.");
    }
    select.value = "beginner";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page
    .locator("#participantRouteAdaptiveStateFeedback")
    .filter({ hasText: "leicht" })
    .waitFor({ timeout: 15_000 });
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${originalAdaptiveParticipantSessionId}/current-state`,
    payload =>
      payload?.currentRunState?.testRun?.bookletStates?.level === "beginner" &&
      payload.currentRunState.testRun.bookletStateOverrides?.level === "beginner" &&
      payload.currentRunState.adaptiveStates?.find(
        state => state.stateKey === "level"
      )?.automaticOptionKey === "professional"
  );
  await page.waitForFunction(
    () => {
      const unitKeys = [
        ...document.querySelectorAll(
          "#participantRouteUnitRail [data-unit-key]"
        )
      ].map(element => element.getAttribute("data-unit-key"));
      return (
        unitKeys.length === 2 &&
        unitKeys[0] === "decision-unit" &&
        unitKeys[1] === "beginner-unit"
      );
    },
    undefined,
    { timeout: 15_000 }
  );
  await page.goto(
    `${baseUrl}/participant?participantSessionId=${encodeURIComponent(
      originalAdaptiveParticipantSessionId
    )}`,
    { waitUntil: "networkidle" }
  );
  const resumedOriginalAdaptiveFrame = page.frameLocator(
    "#participantVeronaPlayerFrame"
  );
  await resumedOriginalAdaptiveFrame
    .locator("#var1")
    .waitFor({ timeout: 15_000 });
  assert.equal(
    await resumedOriginalAdaptiveFrame.locator("#var1").inputValue(),
    "a"
  );
  assert.equal(
    await resumedOriginalAdaptiveFrame.locator("#var2").inputValue(),
    "a"
  );
  assert.equal(
    await page.locator("#participantRouteAdaptiveState-level").inputValue(),
    "beginner"
  );

  logStep("participant-original-aspect-player");
  const aspectLoginKey = "student-original-aspect-smoke";
  const aspectBookletKey = "booklet1";
  const aspectUnitKey = "testcenter-sample1";
  const aspectPlayerKey = "iqb-player-aspect@2.12";
  const [
    aspectBookletDocument,
    aspectUnitDocument,
    aspectDefinitionDocument,
    aspectSecondUnitDocument,
    aspectSecondDefinitionDocument,
    aspectThirdUnitDocument,
    aspectThirdDefinitionDocument
  ] = await Promise.all([
      readFile(
        resolve("test-fixtures/original-testcenter/booklets/booklet-17.4.xml"),
        "utf8"
      ),
      readFile(
        resolve(
          "test-fixtures/original-testcenter/units/aspect-testcenter-sample1.xml"
        ),
        "utf8"
      ),
      readFile(
        resolve(
          "test-fixtures/original-testcenter/definitions/aspect-testcenter-sample1.voud"
        ),
        "utf8"
      ),
      readFile(
        resolve(
          "test-fixtures/original-testcenter/units/aspect-testcenter-sample2.xml"
        ),
        "utf8"
      ),
      readBrotliBase64Text(
        resolve(
          "test-fixtures/original-testcenter/definitions/aspect-testcenter-sample2.voud.br.base64"
        )
      ),
      readFile(
        resolve(
          "test-fixtures/original-testcenter/units/aspect-testcenter-sample3.xml"
        ),
        "utf8"
      ),
      readFile(
        resolve(
          "test-fixtures/original-testcenter/definitions/aspect-testcenter-sample3.voud"
        ),
        "utf8"
      )
    ]);
  const aspectPlayerDocument = await readBrotliBase64Text(
    resolve(
      "test-fixtures/original-testcenter/players/iqb-player-aspect-2.12.3.html.br.base64"
    )
  );
  const aspectZip = createStoredZipBuffer([
    {
      fileName: "export/imsmanifest.xml",
      content: `
        <manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1">
          <resources>
            <resource identifier="${aspectBookletKey}" href="booklets/Booklet.xml" />
            <resource identifier="${aspectUnitKey}" href="units/testcenter-sample1.xml" />
            <resource identifier="testcenter-sample1.voud" href="units/testcenter-sample1.voud" />
            <resource identifier="testcenter-sample2" href="units/testcenter-sample2.xml" />
            <resource identifier="testcenter-sample2.voud" href="units/testcenter-sample2.voud" />
            <resource identifier="testcenter-sample3" href="units/testcenter-sample3.xml" />
            <resource identifier="testcenter-sample3.voud" href="units/testcenter-sample3.voud" />
            <resource identifier="${aspectPlayerKey}" href="players/iqb-player-aspect-2.12.3.html" />
          </resources>
        </manifest>
      `
    },
    {
      fileName: "export/booklets/Booklet.xml",
      content: aspectBookletDocument
    },
    {
      fileName: "export/units/testcenter-sample1.xml",
      content: aspectUnitDocument
    },
    {
      fileName: "export/units/testcenter-sample1.voud",
      content: aspectDefinitionDocument
    },
    {
      fileName: "export/units/testcenter-sample2.xml",
      content: aspectSecondUnitDocument
    },
    {
      fileName: "export/units/testcenter-sample2.voud",
      content: aspectSecondDefinitionDocument
    },
    {
      fileName: "export/units/testcenter-sample3.xml",
      content: aspectThirdUnitDocument
    },
    {
      fileName: "export/units/testcenter-sample3.voud",
      content: aspectThirdDefinitionDocument
    },
    {
      fileName: "export/players/iqb-player-aspect-2.12.3.html",
      content: aspectPlayerDocument
    }
  ]);
  const aspectSourcePackageResponse = await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`,
    {
      body: {
        fileName: "original-aspect-browser-smoke.zip",
        mediaType: "application/zip",
        sourceDocument: `data:application/zip;base64,${aspectZip.toString("base64")}`
      }
    }
  );
  const aspectSourcePackagePayload = await aspectSourcePackageResponse.json();
  assert.equal(aspectSourcePackageResponse.status, 201);
  const aspectImportResponse = await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`,
    {
      body: {
        sourcePackageId: aspectSourcePackagePayload.sourcePackage.sourcePackageId
      }
    }
  );
  const aspectImportPayload = await aspectImportResponse.json();
  const aspectReleaseId =
    aspectImportPayload.stagedContentRelease?.contentReleaseId;
  assert.ok(aspectReleaseId, "Original Aspect import should stage a release.");
  await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${aspectReleaseId}/activate`,
    { body: { forceActivation: true } }
  );
  await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-roster`,
    {
      body: {
        rosterText: [
          {
            loginKey: aspectLoginKey,
            groupKey: "group:original-aspect-smoke",
            bookletKey: aspectBookletKey,
            displayName: "Original Aspect Smoke Participant",
            executionMode: "run-hot-return"
          }
        ]
      }
    }
  );
  await page.goto(
    `${baseUrl}/participant?${new URLSearchParams({
      tenantKey,
      workspaceKey,
      loginKey: aspectLoginKey,
      bookletKey: aspectBookletKey
    }).toString()}`,
    { waitUntil: "networkidle" }
  );
  await page
    .locator("#participantVeronaPlayerVersion")
    .filter({ hasText: "API 6.0" })
    .waitFor({ timeout: 30_000 });
  const aspectFrame = page.frameLocator("#participantVeronaPlayerFrame");
  await aspectFrame.getByText("Unit 1", { exact: true }).waitFor({
    timeout: 30_000
  });
  await aspectFrame.getByText("Eingabefeld", { exact: true }).waitFor();
  const aspectParticipantSessionId = await page
    .locator("#participantRouteSessionId")
    .inputValue();
  assert.ok(aspectParticipantSessionId);
  const aspectResponse = "Gespeichert durch den Rewrite-Host";
  await aspectFrame.locator("input").fill(aspectResponse);
  await aspectFrame
    .getByRole("button", { name: "Gehe zu Seite 2", exact: true })
    .click();
  await aspectFrame.locator("p", { hasText: "Seite 2" }).waitFor();
  await aspectFrame.getByText("Option 2", { exact: true }).click();
  const savedAspectState = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${aspectParticipantSessionId}/current-state`,
    payload => {
      const response =
        payload?.currentRunState?.testRun?.unitResponses?.[aspectUnitKey];
      if (typeof response !== "string") return false;
      try {
        const parsed = JSON.parse(response);
        const elementCodes = JSON.parse(
          parsed.unitState?.dataParts?.elementCodes ?? "[]"
        );
        const textField = elementCodes.find(
          elementCode => elementCode.id === "text-field_1"
        );
        const radio = elementCodes.find(
          elementCode => elementCode.id === "radio_1"
        );
        return (
          textField?.status === "VALUE_CHANGED" &&
          textField.value === aspectResponse &&
          radio?.status === "VALUE_CHANGED" &&
          radio.value === 2 &&
          String(parsed.playerState?.currentPage) === "1"
        );
      } catch {
        return false;
      }
    },
    30_000
  );
  assert.equal(
    savedAspectState.currentRunState.navigation.canGoNext,
    true,
    "The original booklet should allow its separate next-unit control."
  );
  const aspectNextUnitButton = page.locator("#participantRouteNextUnitButton");
  assert.equal(await aspectNextUnitButton.isEnabled(), true);
  await aspectNextUnitButton.click();
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${aspectParticipantSessionId}/current-state`,
    payload =>
      payload?.currentRunState?.testRun?.currentUnitKey ===
      "testcenter-sample2",
    30_000
  );
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "testcenter-sample2" })
    .waitFor({ timeout: 30_000 });
  await aspectFrame.getByText("Sample 2", { exact: true }).waitFor({
    timeout: 30_000
  });
  await aspectFrame.getByText("Relativ große Bilder", { exact: true }).waitFor();
  assert.ok(
    (await aspectFrame.locator("img").count()) >= 4,
    "The media-heavy Aspect unit should render its four original images."
  );
  await page.locator("#participantRouteNextUnitButton").click();
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "testcenter-sample3" })
    .waitFor({ timeout: 30_000 });
  await aspectFrame.getByText("Sample Unit 3", { exact: true }).waitFor({
    timeout: 30_000
  });
  await page.locator("#participantRoutePreviousUnitButton").click();
  await aspectFrame.getByText("Sample 2", { exact: true }).waitFor({
    timeout: 30_000
  });
  await page.locator("#participantRoutePreviousUnitButton").click();
  await aspectFrame.getByText("Unit 1", { exact: true }).waitFor({
    timeout: 30_000
  });
  await page.goto(
    `${baseUrl}/participant?participantSessionId=${encodeURIComponent(
      aspectParticipantSessionId
    )}`,
    { waitUntil: "networkidle" }
  );
  await page
    .locator("#participantVeronaPlayerVersion")
    .filter({ hasText: "API 6.0" })
    .waitFor({ timeout: 30_000 });
  const resumedAspectFrame = page.frameLocator("#participantVeronaPlayerFrame");
  await resumedAspectFrame.getByText("Unit 1", { exact: true }).waitFor({
    timeout: 30_000
  });
  assert.equal(
    await resumedAspectFrame.locator("input").inputValue(),
    aspectResponse
  );
  await resumedAspectFrame
    .getByRole("button", { name: "Gehe zu Seite 2", exact: true })
    .click();
  await resumedAspectFrame.locator("p", { hasText: "Seite 2" }).waitFor();
  assert.equal(
    await resumedAspectFrame.getByRole("radio").nth(1).isChecked(),
    true
  );
  stopAfter("participant-verona-player");

  logStep("participant-original-booklet-config");
  const bookletConfigTenantKey = `${tenantKey}-booklet-config`;
  const bookletConfigWorkspaceKey = `${workspaceKey}-booklet-config`;
  await sendSmokeJson(`${baseUrl}/api/v1/platform/tenants`, {
    body: {
      tenantKey: bookletConfigTenantKey,
      displayName: "UI Original Booklet Config Tenant"
    }
  });
  await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${bookletConfigTenantKey}/workspaces`,
    {
      body: {
        workspaceKey: bookletConfigWorkspaceKey,
        displayName: "UI Original Booklet Config Workspace"
      }
    }
  );
  const bookletConfigFixtures = [
    {
      fixture: "booklets/system-test/CY_Bklt_BkltConfig_1.xml",
      bookletKey: "Cy-Bklt_BkltConfig-1"
    },
    {
      fixture: "booklets/CY_Bklt_BkltConfig_2.xml",
      bookletKey: "Cy-Bklt_BkltConfig-2"
    },
    {
      fixture: "booklets/system-test/CY_Bklt_BkltConfig_3.xml",
      bookletKey: "Cy-Bklt_BkltConfig-3"
    },
    {
      fixture: "booklets/system-test/CY_Bklt_BkltConfig_4.xml",
      bookletKey: "Cy-Bklt_BkltConfig-4"
    }
  ];
  const bookletConfigUnitFixtures = [
    {
      fixture: "units/CY_Unit101.xml",
      unitKey: "CY-Unit.Sample-101"
    },
    {
      fixture: "units/CY_Unit102.xml",
      unitKey: "CY-Unit.Sample-102"
    },
    {
      fixture: "units/CY_Unit104.xml",
      unitKey: "CY-Unit.Sample-104"
    }
  ];
  const bookletConfigPlayerFixture = "players/verona-player-simple-6.0.html";
  const bookletConfigPlayerKey = "verona-player-simple-6.0";
  const originalCorpusRoot = resolve("test-fixtures/original-testcenter");
  const [
    bookletConfigDocuments,
    bookletConfigUnitDocuments,
    bookletConfigPlayerDocument,
    bookletConfigRosterBase64
  ] = await Promise.all([
    Promise.all(
      bookletConfigFixtures.map(async fixture => ({
        ...fixture,
        content: await readFile(
          resolve(originalCorpusRoot, fixture.fixture),
          "utf8"
        )
      }))
    ),
    Promise.all(
      bookletConfigUnitFixtures.map(async fixture => ({
        ...fixture,
        content: await readFile(
          resolve(originalCorpusRoot, fixture.fixture),
          "utf8"
        )
      }))
    ),
    readFile(resolve(originalCorpusRoot, bookletConfigPlayerFixture), "utf8"),
    readFile(
      resolve(originalCorpusRoot, "rosters/CY_Logins_BkltConfig.xml.base64"),
      "utf8"
    )
  ]);
  const bookletConfigManifestResources = [
    ...bookletConfigFixtures.map(
      fixture =>
        `<resource identifier="${fixture.bookletKey}" href="${fixture.fixture}" />`
    ),
    ...bookletConfigUnitFixtures.map(
      fixture =>
        `<resource identifier="${fixture.unitKey}" href="${fixture.fixture}" />`
    ),
    `<resource identifier="${bookletConfigPlayerKey}" href="${bookletConfigPlayerFixture}" />`
  ].join("\n");
  const bookletConfigZip = createStoredZipBuffer([
    {
      fileName: "export/imsmanifest.xml",
      content: `
        <manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1">
          <resources>${bookletConfigManifestResources}</resources>
        </manifest>
      `
    },
    ...bookletConfigDocuments.map(document => ({
      fileName: `export/${document.fixture}`,
      content: document.content
    })),
    ...bookletConfigUnitDocuments.map(document => ({
      fileName: `export/${document.fixture}`,
      content: document.content
    })),
    {
      fileName: `export/${bookletConfigPlayerFixture}`,
      content: bookletConfigPlayerDocument
    }
  ]);
  const bookletConfigSourcePackageResponse = await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${bookletConfigTenantKey}/workspaces/${bookletConfigWorkspaceKey}/source-packages`,
    {
      body: {
        fileName: "original-booklet-config-browser-smoke.zip",
        mediaType: "application/zip",
        sourceDocument: `data:application/zip;base64,${bookletConfigZip.toString("base64")}`
      }
    }
  );
  const bookletConfigSourcePackagePayload =
    await bookletConfigSourcePackageResponse.json();
  const bookletConfigImportResponse = await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${bookletConfigTenantKey}/workspaces/${bookletConfigWorkspaceKey}/import-jobs`,
    {
      body: {
        sourcePackageId:
          bookletConfigSourcePackagePayload.sourcePackage.sourcePackageId
      }
    }
  );
  const bookletConfigImportPayload = await bookletConfigImportResponse.json();
  const bookletConfigReleaseId =
    bookletConfigImportPayload.stagedContentRelease?.contentReleaseId;
  assert.ok(
    bookletConfigReleaseId,
    `Original Booklet Config browser import should stage a release: ${JSON.stringify(
      bookletConfigImportPayload.importJob?.diagnostics ?? []
    )}`
  );
  await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${bookletConfigTenantKey}/workspaces/${bookletConfigWorkspaceKey}/content-releases/${bookletConfigReleaseId}/activate`,
    { body: {} }
  );
  const bookletConfigRosterResponse = await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${bookletConfigTenantKey}/workspaces/${bookletConfigWorkspaceKey}/participant-roster`,
    {
      body: {
        rosterText: Buffer.from(
          bookletConfigRosterBase64.trim(),
          "base64"
        ).toString("utf8")
      }
    }
  );
  const bookletConfigRosterPayload = await bookletConfigRosterResponse.json();
  assert.deepEqual(
    bookletConfigRosterPayload.items.map(item => [
      item.loginKey,
      item.bookletKey,
      item.passwordRequired
    ]),
    [
      ["Bklt_Config-1", "Cy-Bklt_BkltConfig-1", true],
      ["Bklt_Config-2", "Cy-Bklt_BkltConfig-2", true],
      ["Bklt_Config-3", "Cy-Bklt_BkltConfig-3", true],
      ["Bklt_Config-4", "Cy-Bklt_BkltConfig-4", true]
    ]
  );
  const openOriginalBookletConfig = async (loginKey, bookletKey) => {
    const signInResponse = await sendSmokeJson(
      `${baseUrl}/api/v1/participant/auth/sign-in`,
      {
        body: {
          tenantKey: bookletConfigTenantKey,
          workspaceKey: bookletConfigWorkspaceKey,
          loginKey,
          password: "123"
        }
      }
    );
    const signInPayload = await signInResponse.json();
    const participantSessionId =
      signInPayload.participantSession?.participantSessionId;
    assert.ok(participantSessionId, `${loginKey} should create a session.`);
    await sendSmokeJson(
      `${baseUrl}/api/v1/participant/sessions/${participantSessionId}/resume`,
      { body: { bookletKey } }
    );
    await page.goto(
      `${baseUrl}/participant?participantSessionId=${encodeURIComponent(
        participantSessionId
      )}`,
      { waitUntil: "networkidle" }
    );
    await page
      .locator("#participantVeronaPlayerVersion")
      .filter({ hasText: "API 6.0" })
      .waitFor({ timeout: 30_000 });
    const playerFrame = page.frameLocator("#participantVeronaPlayerFrame");
    await playerFrame.locator("#end-unit").waitFor({ timeout: 15_000 });
    return { participantSessionId, playerFrame };
  };

  const configTwoBrowser = await openOriginalBookletConfig(
    "Bklt_Config-2",
    "Cy-Bklt_BkltConfig-2"
  );
  await page.locator("#participantRouteFullscreenPrompt").waitFor();
  await page.locator("#participantRouteDismissFullscreenButton").click();
  await page
    .locator("#participantRouteScreenHeader")
    .filter({ hasText: "Aufgabe1" })
    .waitFor();
  assert.equal(await page.locator("#participantRouteUnit").count(), 0);
  await page.locator("#participantRouteFullscreenButton").waitFor();
  await page.locator("#participantRouteUnitRail").waitFor();
  assert.equal(
    await page.locator("#participantRoutePreviousUnitButton").count(),
    0
  );
  assert.equal(
    await page.locator("#participantRouteNextUnitButton").count(),
    0
  );
  await page.locator("#participantRouteTestletTimerValue").waitFor();
  assert.equal(
    await configTwoBrowser.playerFrame.locator("#end-unit").isDisabled(),
    true
  );

  const configThreeBrowser = await openOriginalBookletConfig(
    "Bklt_Config-3",
    "Cy-Bklt_BkltConfig-3"
  );
  await page
    .locator("#participantRouteScreenHeader")
    .filter({ hasText: "Bklt-config-3" })
    .waitFor();
  await page
    .locator("#participantRouteUnit")
    .filter({ hasText: "Aufgabe1" })
    .waitFor();
  assert.equal(await page.locator("#participantRouteUnitRail").count(), 0);
  assert.equal(
    await configThreeBrowser.playerFrame.locator("#end-unit").isDisabled(),
    true
  );
  assert.equal(
    await page.locator("#participantRouteTestletTimerValue").count(),
    0
  );
  await page.locator("#participantRouteNextUnitButton").click();
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "cpy" })
    .waitFor({ timeout: 15_000 });
  await page
    .locator("#participantRouteUnit")
    .filter({ hasText: "Aufgabe2" })
    .waitFor();
  assert.equal(
    await configThreeBrowser.playerFrame.locator("#end-unit").isEnabled(),
    true
  );

  const configFourBrowser = await openOriginalBookletConfig(
    "Bklt_Config-4",
    "Cy-Bklt_BkltConfig-4"
  );
  await page
    .locator("#participantRouteScreenHeader")
    .filter({ hasText: "Aufgabenblock" })
    .waitFor();
  await page
    .locator("#participantRouteUnit")
    .filter({ hasText: "Aufgabe1" })
    .waitFor();
  assert.equal(await page.locator("#participantRouteUnitRail").count(), 0);
  await page.locator("#participantRouteNextUnitButton").waitFor();
  assert.equal(
    await configFourBrowser.playerFrame.locator("#end-unit").isEnabled(),
    true
  );

  const configOneBrowser = await openOriginalBookletConfig(
    "Bklt_Config-1",
    "Cy-Bklt_BkltConfig-1"
  );
  await page.locator("#participantRouteUnit").waitFor();
  assert.equal(await page.locator("#participantRouteScreenHeader").count(), 0);
  assert.equal(
    await page.locator("#participantRouteFullscreenPrompt").count(),
    0
  );
  assert.equal(
    await page.locator("#participantRouteFullscreenButton").count(),
    0
  );
  assert.equal(await page.locator("#participantRouteUnitRail").count(), 0);
  assert.equal(
    await page.locator("#participantRouteTestletTimerValue").count(),
    0
  );
  await page.locator("#participantRouteNextUnitButton").waitFor();
  assert.equal(
    await configOneBrowser.playerFrame.locator("#end-unit").isEnabled(),
    true
  );
  stopAfter("participant-original-booklet-config");

  logStep("participant-original-test-controller");
  const testControllerTenantKey = `${tenantKey}-test-controller`;
  const testControllerWorkspaceKey = `${workspaceKey}-test-controller`;
  await sendSmokeJson(`${baseUrl}/api/v1/platform/tenants`, {
    body: {
      tenantKey: testControllerTenantKey,
      displayName: "UI Original Test Controller Tenant"
    }
  });
  await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${testControllerTenantKey}/workspaces`,
    {
      body: {
        workspaceKey: testControllerWorkspaceKey,
        displayName: "UI Original Test Controller Workspace"
      }
    }
  );
  const testControllerFixtures = Array.from({ length: 17 }, (_, index) => ({
    fixture: `booklets/system-test/CY_Bklt_TC-${index + 1}.xml`,
    bookletKey: `Cy-Bklt_TC-${index + 1}`
  }));
  const testControllerUnitFixtures = Array.from({ length: 5 }, (_, index) => ({
    fixture: `units/CY_Unit10${index}.xml`,
    unitKey: `CY-Unit.Sample-10${index}`
  }));
  const [testControllerDocuments, testControllerUnitDocuments] =
    await Promise.all([
      Promise.all(
        testControllerFixtures.map(async fixture => ({
          ...fixture,
          content: await readFile(
            resolve(originalCorpusRoot, fixture.fixture),
            "utf8"
          )
        }))
      ),
      Promise.all(
        testControllerUnitFixtures.map(async fixture => ({
          ...fixture,
          content: await readFile(
            resolve(originalCorpusRoot, fixture.fixture),
            "utf8"
          )
        }))
      )
    ]);
  const testControllerManifestResources = [
    ...testControllerFixtures.map(
      fixture =>
        `<resource identifier="${fixture.bookletKey}" href="${fixture.fixture}" />`
    ),
    ...testControllerUnitFixtures.map(
      fixture =>
        `<resource identifier="${fixture.unitKey}" href="${fixture.fixture}" />`
    ),
    `<resource identifier="${bookletConfigPlayerKey}" href="${bookletConfigPlayerFixture}" />`
  ].join("\n");
  const testControllerZip = createStoredZipBuffer([
    {
      fileName: "export/imsmanifest.xml",
      content: `
        <manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1">
          <resources>${testControllerManifestResources}</resources>
        </manifest>
      `
    },
    ...testControllerDocuments.map(document => ({
      fileName: `export/${document.fixture}`,
      content: document.content
    })),
    ...testControllerUnitDocuments.map(document => ({
      fileName: `export/${document.fixture}`,
      content: document.content
    })),
    {
      fileName: `export/${bookletConfigPlayerFixture}`,
      content: bookletConfigPlayerDocument
    }
  ]);
  const testControllerSourcePackageResponse = await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${testControllerTenantKey}/workspaces/${testControllerWorkspaceKey}/source-packages`,
    {
      body: {
        fileName: "original-test-controller-browser-smoke.zip",
        mediaType: "application/zip",
        sourceDocument: `data:application/zip;base64,${testControllerZip.toString("base64")}`
      }
    }
  );
  const testControllerSourcePackagePayload =
    await testControllerSourcePackageResponse.json();
  const testControllerImportResponse = await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${testControllerTenantKey}/workspaces/${testControllerWorkspaceKey}/import-jobs`,
    {
      body: {
        sourcePackageId:
          testControllerSourcePackagePayload.sourcePackage.sourcePackageId
      }
    }
  );
  const testControllerImportPayload = await testControllerImportResponse.json();
  const testControllerReleaseId =
    testControllerImportPayload.stagedContentRelease?.contentReleaseId;
  assert.ok(
    testControllerReleaseId,
    `Original Test Controller browser import should stage a release: ${JSON.stringify(
      testControllerImportPayload.importJob?.diagnostics ?? []
    )}`
  );
  await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${testControllerTenantKey}/workspaces/${testControllerWorkspaceKey}/content-releases/${testControllerReleaseId}/activate`,
    { body: {} }
  );
  const testControllerRosterResponse = await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${testControllerTenantKey}/workspaces/${testControllerWorkspaceKey}/participant-roster`,
    {
      body: {
        rosterText: Buffer.from(
          (
            await readFile(
              resolve(
                originalCorpusRoot,
                "rosters/CY_Logins_TestController.xml.base64"
              ),
              "utf8"
            )
          ).trim(),
          "base64"
        ).toString("utf8")
      }
    }
  );
  const testControllerRosterPayload = await testControllerRosterResponse.json();
  assert.equal(testControllerRosterPayload.items.length, 26);
  assert.deepEqual(
    testControllerRosterPayload.items
      .filter(item => ["Test_Ctrl-3", "Test_Ctrl-23"].includes(item.loginKey))
      .map(item => [item.loginKey, item.bookletKey, item.passwordRequired])
      .sort((left, right) => left[0].localeCompare(right[0])),
    [
      ["Test_Ctrl-23", "Cy-Bklt_TC-14", true],
      ["Test_Ctrl-3", "Cy-Bklt_TC-3", true]
    ]
  );
  const openOriginalTestController = async (loginKey, bookletKey) => {
    const signInResponse = await sendSmokeJson(
      `${baseUrl}/api/v1/participant/auth/sign-in`,
      {
        body: {
          tenantKey: testControllerTenantKey,
          workspaceKey: testControllerWorkspaceKey,
          loginKey,
          password: "123"
        }
      }
    );
    const signInPayload = await signInResponse.json();
    const participantSessionId =
      signInPayload.participantSession?.participantSessionId;
    assert.ok(participantSessionId, `${loginKey} should create a session.`);
    await sendSmokeJson(
      `${baseUrl}/api/v1/participant/sessions/${participantSessionId}/resume`,
      { body: { bookletKey } }
    );
    await page.goto(
      `${baseUrl}/participant?participantSessionId=${encodeURIComponent(
        participantSessionId
      )}`,
      { waitUntil: "networkidle" }
    );
    await page
      .locator("#participantVeronaPlayerVersion")
      .filter({ hasText: "API 6.0" })
      .waitFor({ timeout: 30_000 });
    return {
      frame: page.frameLocator("#participantVeronaPlayerFrame"),
      participantSessionId
    };
  };

  const protectedController = await openOriginalTestController(
    "Test_Ctrl-3",
    "Cy-Bklt_TC-3"
  );
  const protectedControllerFrame = protectedController.frame;
  await protectedControllerFrame
    .getByText("Testung Controller: Startseite", { exact: true })
    .waitFor({ timeout: 15_000 });
  await page
    .locator("#participantRouteTestletGateLabel")
    .filter({ hasText: "Aufgabenblock" })
    .waitFor();
  await page
    .locator("#participantRouteTestletGatePrompt")
    .filter({ hasText: "Bitte gib das Freigabewort ein." })
    .waitFor();
  await page.locator("#participantRouteTestletUnlockCode").fill("hase");
  assert.equal(
    await page.locator("#participantRouteTestletUnlockCode").inputValue(),
    "HASE"
  );
  await page.locator("#participantRouteTestletUnlockButton").click();
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "CY-Unit.Sample-101" })
    .waitFor({ timeout: 15_000 });
  await page
    .locator("#participantRouteTestletTimerLabel")
    .filter({ hasText: "Aufgabenblock" })
    .waitFor();
  await page.locator("#participantRouteTestletTimerValue").waitFor();
  await protectedControllerFrame
    .getByText(/Testung Controller: Aufgabe1:/)
    .waitFor({ timeout: 15_000 });
  await protectedControllerFrame
    .locator('[data-cy="TestController-radio1-Aufg1"]')
    .check();
  await page
    .locator("#participantVeronaSaveStatus")
    .filter({ hasText: "saving" })
    .waitFor();
  const bufferedControllerStateResponse = await sendSmokeJson(
    `${baseUrl}/api/v1/participant/sessions/${protectedController.participantSessionId}/current-state`,
    { method: "GET" }
  );
  const bufferedControllerState = await bufferedControllerStateResponse.json();
  assert.deepEqual(
    bufferedControllerState.currentRunState.booklet.policy.persistence,
    {
      unitResponsesBufferMs: 20_000_000,
      unitStateBufferMs: 20_000_000,
      testStateBufferMs: 20_000_000
    }
  );
  assert.equal(
    bufferedControllerState.currentRunState.testRun.unitResponses[
      "CY-Unit.Sample-101"
    ],
    undefined
  );
  await page.locator("#participantRouteNextUnitButton").click();
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "CY-Unit.Sample-102" })
    .waitFor({ timeout: 15_000 });
  const flushedControllerStateResponse = await sendSmokeJson(
    `${baseUrl}/api/v1/participant/sessions/${protectedController.participantSessionId}/current-state`,
    { method: "GET" }
  );
  const flushedControllerState = await flushedControllerStateResponse.json();
  const flushedControllerResponse = JSON.parse(
    flushedControllerState.currentRunState.testRun.unitResponses[
      "CY-Unit.Sample-101"
    ]
  );
  assert.ok(
    Object.keys(flushedControllerResponse.unitState?.dataParts ?? {}).length > 0
  );

  const completionController = await openOriginalTestController(
    "Test_Ctrl-23",
    "Cy-Bklt_TC-14"
  );
  const completionControllerFrame = completionController.frame;
  await completionControllerFrame
    .getByText("Testung Controller: Aufgabe1: Check response complete and presentation complete", {
      exact: true
    })
    .waitFor({ timeout: 15_000 });
  await page.locator("#participantRouteNextUnitButton").click();
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "CY-Unit.Sample-101" })
    .waitFor({ timeout: 15_000 });
  assert.equal(
    await page.locator("#participantRouteNextUnitButton").isDisabled(),
    true
  );
  assert.equal(
    await completionControllerFrame.locator("#next-unit").isDisabled(),
    true
  );
  await completionControllerFrame
    .locator('[data-cy="TestController-radio1-Aufg1"]')
    .check();
  assert.equal(
    await page.locator("#participantRouteNextUnitButton").isDisabled(),
    true
  );
  await completionControllerFrame.locator("#next-page").click();
  await completionControllerFrame
    .getByText("Presentation complete", { exact: true })
    .waitFor();
  await page
    .locator("#participantRouteNextUnitButton")
    .waitFor({ state: "visible", timeout: 15_000 });
  await page.waitForFunction(
    () => {
      const button = document.querySelector("#participantRouteNextUnitButton");
      return button instanceof HTMLButtonElement && !button.disabled;
    },
    undefined,
    { timeout: 15_000 }
  );
  assert.equal(
    await completionControllerFrame.locator("#next-unit").isEnabled(),
    true
  );
  await page.locator("#participantRouteNextUnitButton").click();
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "CY-Unit.Sample-102" })
    .waitFor({ timeout: 15_000 });
  stopAfter("participant-original-test-controller");

  logStep("nav-runtime");
  await page.goto(`${baseUrl}/app/runtime`, { waitUntil: "domcontentloaded" });
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
  await page.goto(`${baseUrl}/app/runtime`, { waitUntil: "domcontentloaded" });
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
  await page.goto(`${baseUrl}/app/runtime`, { waitUntil: "domcontentloaded" });
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
  await page.waitForFunction(
    () =>
      document.querySelector("#monitorConnectionStatus")?.textContent?.trim() ===
        "Live" &&
      document
        .querySelector("#monitorConnectionDetail")
        ?.textContent?.includes("open run") &&
      document.querySelector("#monitorConnectionLastEvent")?.textContent?.trim() !==
        "waiting for first event",
    undefined,
    { timeout: 15_000 }
  );
  const aspectStateBeforeMonitorPush = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${aspectParticipantSessionId}/current-state`,
    payload =>
      typeof payload?.currentRunState?.testRun?.testRunId === "string" &&
      typeof payload?.currentRunState?.testRun?.currentUnitKey === "string"
  );
  const monitorEventBeforeExternalSave = await page
    .locator("#monitorConnectionDetail")
    .textContent();
  await sendSmokeJson(
    `${baseUrl}/api/v1/participant/test-runs/${aspectStateBeforeMonitorPush.currentRunState.testRun.testRunId}/save-progress`,
    {
      body: {
        status: "running",
        currentUnitKey:
          aspectStateBeforeMonitorPush.currentRunState.testRun.currentUnitKey
      }
    }
  );
  await page.waitForFunction(
    previousEvent => {
      const detail = document
        .querySelector("#monitorConnectionDetail")
        ?.textContent?.trim();
      return !!detail && detail !== previousEvent?.trim() && detail.includes("change #");
    },
    monitorEventBeforeExternalSave,
    { timeout: 15_000 }
  );
  stopAfter("runtime-scope-gating");
  logStep("generate-entry-links");
  const uploadedRosterText = [
    "login\tgroup\tbooklet\tname",
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
  const rosterInputPreviewCard = page
    .locator("app-record-collection")
    .filter({
      has: page.getByRole("heading", { name: "Roster Input Preview" })
    });
  await rosterInputPreviewCard
    .filter({ hasText: "2 participant rows parsed" })
    .filter({ hasText: "Alias headers and canonical columns are normalized before import." })
    .filter({ hasText: "Ada Entry" })
    .filter({ hasText: "Ben Entry" })
    .waitFor();
  await page
    .locator("app-record-collection")
    .filter({
      has: page.getByRole("heading", { name: "Participant Launchpad Actions" })
    })
    .filter({ hasText: "Import current roster input" })
    .filter({ hasText: "2 parsed input rows" })
    .waitFor();
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
  const participantGroupKey = "group:student-ui";
  const groupMonitorUsername = "entry-group-monitor";
  const groupMonitorPassword = "ui-migrated-group-monitor-secret";
  const systemCheckUsername = "entry-system-check";
  const systemCheckPassword = "ui-migrated-system-check-secret";
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
    [
      "<Testtakers>",
      "  <Profiles><GroupMonitor>",
      "    <Profile id=\"all\" label=\"All sessions\" view=\"small\" blockColumn=\"hide\" unitColumn=\"hide\" groupColumn=\"show\" bookletColumn=\"hide\" autoselectNextBlock=\"no\">",
      "      <Filter label=\"Current participant\" type=\"substring\" field=\"personLabel\" value=\"student-ui\" not=\"true\" />",
      "    </Profile>",
      "  </GroupMonitor></Profiles>",
      `  <Group id="${participantGroupKey}" validFor="45">`,
      "    <Login name=\"entry-student-login\">",
      `      <Booklet>${participantRouteBookletKey}</Booklet>`,
      "    </Login>",
      `    <Login mode="monitor-group" name="${groupMonitorUsername}" pw="operator-secret">`,
      "      <Profile id=\"all\" />",
      "    </Login>",
      `    <Login mode="sys-check-login" name="${systemCheckUsername}" pw="system-check-secret" />`,
      "  </Group>",
      "</Testtakers>"
    ].join("\n")
  );
  await page.locator("#importParticipantRosterButton").click();
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Saved Participant Roster" })
    })
    .filter({ hasText: "entry-student-login" })
    .filter({ hasText: participantGroupKey })
    .filter({ hasText: participantRouteBookletKey })
    .filter({ hasText: "time-limited" })
    .filter({ hasText: "45 minute(s) after first sign-in" })
    .waitFor();
  const operationalLoginCandidateCard = page
    .locator("app-record-collection")
    .filter({
      has: page.getByRole("heading", {
        name: "Operational Login Migration Candidates"
      })
    })
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: groupMonitorUsername }) });
  logStep("operational-login-migration-candidates");
  await operationalLoginCandidateCard.waitFor();
  const operationalLoginCandidateText =
    (await operationalLoginCandidateCard.textContent()) ?? "";
  for (const expectedText of [
    "monitor-group",
    participantGroupKey,
    "password protected",
    "All sessions (all)",
    "all: small view; block hide",
    "all: Current participant not substring student-ui"
  ]) {
    assert.ok(
      operationalLoginCandidateText.includes(expectedText),
      `Operational login migration card is missing '${expectedText}': ${operationalLoginCandidateText}`
    );
  }
  if (operationalLoginCandidateText.includes("operator-secret")) {
    throw new Error("Operational login migration card exposed a source password.");
  }
  stopAfter("operational-login-migration-candidates");
  await operationalLoginCandidateCard
    .getByRole("button", { name: "Prepare Monitor Account" })
    .click();
  await page.waitForURL(/\/app\/ops$/);
  await expectInputValue("#adminCreateUsername", groupMonitorUsername);
  assert.equal(
    (await page.locator("#adminCreateRole option:checked").textContent())?.trim(),
    "group_monitor"
  );
  await expectInputValue("#adminCreateTenantKey", tenantKey);
  await expectInputValue("#adminCreateWorkspaceKey", workspaceKey);
  await expectInputValue(
    "#adminCreateGroupKey",
    participantGroupKey
  );
  await expectInputValue("#adminCreateValidFrom", "");
  await expectInputValue("#adminCreateValidTo", "");
  await expectInputValue("#adminCreateValidForMinutes", "45");
  await expectInputValue("#adminCreatePassword", "");
  await page.getByText("1 imported monitor profile(s)").waitFor();
  await expectButtonSelectorDisabled("#adminCreateUserButton");
  await clickAction("Clear User Filters");
  await fillAndCommit("#adminCreatePassword", groupMonitorPassword);
  await expectButtonSelectorEnabled("#adminCreateUserButton");
  await clickAction("Create Monitor Account");
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Admin Users", exact: true })
    })
    .filter({ hasText: groupMonitorUsername })
    .filter({ hasText: "group_monitor" })
    .filter({ hasText: participantGroupKey })
    .filter({ hasText: "45 minute(s) after first sign-in" })
    .waitFor();

  logStep("group-monitor-access-window");
  await clickAction("Sign Out");
  await expectInputValue("#adminSessionToken", "");
  await fillAndCommit("#adminUsername", groupMonitorUsername);
  await fillAndCommit("#adminPassword", groupMonitorPassword);
  const initialGroupMonitorSignInResponsePromise = page.waitForResponse(
    response =>
      response.request().method() === "POST" &&
      response.url().endsWith("/api/v1/admin/auth/sign-in")
  );
  await clickAction("Sign In");
  const initialGroupMonitorSignInResponse =
    await initialGroupMonitorSignInResponsePromise;
  assert.equal(initialGroupMonitorSignInResponse.status(), 200);
  const initialGroupMonitorSignIn =
    await initialGroupMonitorSignInResponse.json();
  assert.equal(initialGroupMonitorSignIn.adminUser.validForMinutes, 45);
  assert.deepEqual(
    initialGroupMonitorSignIn.roleAssignments[0]?.monitorProfiles.map(
      profile => profile.profileId
    ),
    ["all"]
  );
  assert.equal(
    initialGroupMonitorSignIn.adminUser.firstSignedInAt,
    initialGroupMonitorSignIn.adminSession.createdAt
  );
  assert.equal(
    Date.parse(initialGroupMonitorSignIn.adminSession.expiresAt),
    Date.parse(initialGroupMonitorSignIn.adminUser.firstSignedInAt) +
      45 * 60_000
  );
  await waitForInputMinLength("#adminSessionToken", 20);
  await page.locator('[data-view-nav="runtime"]').click();
  await page.waitForURL(/\/app\/runtime$/);
  await page.locator("#monitorOperatorConsole").waitFor();
  assert.equal(
    (await page.locator("#monitorProfile option:checked").textContent())?.trim(),
    "All sessions"
  );
  await page
    .locator("#monitorProfileDetail")
    .filter({ hasText: "All sessions: small view, 1 imported filter(s)." })
    .waitFor();
  await page.locator('[data-view-nav="ops"]').click();
  await page.waitForURL(/\/app\/ops$/);
  await clickAction("Sign Out");
  await expectInputValue("#adminSessionToken", "");
  await fillAndCommit("#adminUsername", adminUsername);
  await fillAndCommit("#adminPassword", adminPassword);
  await clickAction("Sign In");
  await waitForInputMinLength("#adminSessionToken", 20);
  smokeAdminSessionToken = await page.locator("#adminSessionToken").inputValue();
  stopAfter("group-monitor-access-window");

  await page.locator('[data-view-nav="runtime"]').click();
  await page.waitForURL(/\/app\/runtime$/);
  const systemCheckLoginCandidateCard = page
    .locator("app-record-collection")
    .filter({
      has: page.getByRole("heading", {
        name: "Operational Login Migration Candidates"
      })
    })
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: systemCheckUsername }) })
    .filter({ hasText: "sys-check-login" })
    .filter({ hasText: "Ready to prepare a system_check account draft" });
  await systemCheckLoginCandidateCard.waitFor();
  await systemCheckLoginCandidateCard
    .getByRole("button", { name: "Prepare System Check Account" })
    .click();
  await page.waitForURL(/\/app\/ops$/);
  await expectInputValue("#adminCreateUsername", systemCheckUsername);
  assert.equal(
    (await page.locator("#adminCreateRole option:checked").textContent())?.trim(),
    "system_check"
  );
  await expectInputValue("#adminCreateTenantKey", tenantKey);
  await expectInputValue("#adminCreateWorkspaceKey", workspaceKey);
  await expectInputValue("#adminCreateValidForMinutes", "45");
  await fillAndCommit("#adminCreatePassword", systemCheckPassword);
  await clickAction("Create System Check Account");
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Admin Users", exact: true })
    })
    .filter({ hasText: systemCheckUsername })
    .filter({ hasText: "system_check" })
    .filter({ hasText: "45 minute(s) after first sign-in" })
    .waitFor();
  await page.goto(
    `${baseUrl}/app/system-check?tenantKey=${encodeURIComponent(
      tenantKey
    )}&workspaceKey=${encodeURIComponent(workspaceKey)}`
  );
  await page.locator("#systemCheckLoginRequiredStatus").waitFor();
  assert.equal(await page.locator("#loadSystemChecksButton").count(), 0);
  await fillAndCommit("#systemCheckUsername", systemCheckUsername);
  await fillAndCommit("#systemCheckPassword", systemCheckPassword);
  await page.locator("#systemCheckSignInButton").click();
  await page
    .locator("#systemCheckSignedInUser")
    .filter({ hasText: systemCheckUsername })
    .waitFor();
  await page.evaluate(() => {
    window.history.pushState({}, "", "/app/runtime");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await page.waitForURL(/\/app\/system-check$/);
  await page.locator("#systemCheckSignOutButton").click();
  await page.locator("#systemCheckSignInButton").waitFor();
  await page.locator("#systemCheckLoginRequiredStatus").waitFor();
  await page.goto(`${baseUrl}/app/ops`);
  await fillAndCommit("#adminUsername", adminUsername);
  await fillAndCommit("#adminPassword", adminPassword);
  await clickAction("Sign In");
  await waitForInputMinLength("#adminSessionToken", 20);
  smokeAdminSessionToken = await page.locator("#adminSessionToken").inputValue();
  stopAfter("system-check-login-migration");

  await page.locator('[data-view-nav="runtime"]').click();
  await page.waitForURL(/\/app\/runtime$/);
  stopAfter("operational-login-candidates");
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
  const savedRosterBenCard = page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Saved Participant Roster" })
    })
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: "entry-student-b" }) })
    .filter({ hasText: "Ben Entry" });
  await savedRosterBenCard.getByRole("link", { name: /Entry URL:/ }).waitFor();
  const savedRosterCopyLinkButton = savedRosterBenCard.getByRole("button", {
    name: /Copy Entry URL:/
  });
  await savedRosterCopyLinkButton.waitFor({ state: "visible" });
  await savedRosterCopyLinkButton.click({ force: true });
  await savedRosterBenCard
    .getByRole("button", { name: /Copied Entry URL:/ })
    .waitFor({ state: "visible" });
  await savedRosterBenCard.getByText("Link copied").waitFor({ state: "visible" });
  const bookletKeyBeforeRosterSelection = await page.locator("#bookletKey").inputValue();
  await savedRosterBenCard
    .getByRole("button", { name: "Use Roster Entry", exact: true })
    .click({ force: true });
  await expectInputValue("#loginKey", "entry-student-b");
  await expectInputValue("#groupKey", "group:entry-smoke");
  await expectInputValue("#bookletKey", bookletKeyBeforeRosterSelection);
  await expectInputValue("#participantDisplayName", "Ben Entry");
  await savedRosterBenCard
    .getByRole("button", { name: "Open Participant Entry", exact: true })
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
    .filter({ hasText: "entry-student-login" })
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
    .filter({ hasText: "entry-student-login" })
    .filter({ hasText: participantEntryUrlPrefix })
    .filter({ hasText: encodeURIComponent(participantGroupKey) })
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
    .filter({
      hasText: `"entry-student-login","${participantGroupKey}","booklet:starter"`
    })
    .filter({
      hasText:
        '"student-entry-sign-in","group:participant-entry-sign-in",""'
    })
    .filter({
      hasText:
        '"student-participant-route","group:participant-route-smoke","booklet:starter"'
    })
    .filter({ hasText: participantEntryUrlPrefix })
    .filter({ hasText: '"Ada Entry"' })
    .waitFor();
  const generatedEntryLinksCsv =
    (await page.locator("#entryLinksCsvPreview").textContent()) ?? "";
  const generatedEntryLinkCount = Math.max(
    generatedEntryLinksCsv.split(/\r?\n/).filter(Boolean).length - 1,
    0
  );
  assert.ok(
    generatedEntryLinkCount >= 11,
    "UI smoke expected all previously imported participant roster entries to produce links."
  );
  await page
    .locator("#entryLinkSummary")
    .filter({ hasText: "Entry Links" })
    .filter({ hasText: String(generatedEntryLinkCount) })
    .filter({ hasText: workspaceKey })
    .filter({ hasText: "Ready" })
    .waitFor();
  await page
    .locator("#participantLaunchpad")
    .filter({ hasText: "Roster Entries" })
    .filter({ hasText: String(generatedEntryLinkCount) })
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
  logStep("reactivate-starter-release");
  await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${starterContentReleaseId}/activate`,
    { body: { forceActivation: true } }
  );
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
  await page.locator("#importParticipantRosterButton").click();
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Saved Participant Roster" })
    })
    .filter({ hasText: "entry-student-direct-xml" })
    .filter({ hasText: "group:direct-xml" })
    .filter({ hasText: participantRouteBookletKey })
    .waitFor();
  await page.locator("#generateEntryLinksButton").click();
  const directEntryLinkCard = page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Generated Entry Links" })
    })
    .locator(".record-card")
    .filter({ hasText: "entry-student-direct-xml" })
    .filter({ hasText: "Direct Xml" })
    .filter({ hasText: participantEntryUrlPrefix })
    .filter({ hasText: "group%3Adirect-xml" })
    .filter({ hasText: "booklet%3Astarter" });
  await directEntryLinkCard.waitFor();
  await directEntryLinkCard
    .getByRole("link", { name: /URL:/ })
    .waitFor({ state: "visible" });
  await directEntryLinkCard
    .getByRole("button", { name: "Use Entry Link", exact: true })
    .click({ force: true });
  await expectInputValue("#loginKey", "entry-student-direct-xml");
  await expectInputValue("#groupKey", "group:direct-xml");
  await expectInputValue("#bookletKey", participantRouteBookletKey);
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
  const directLaunchStatusCard = page
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
    .filter({ hasText: "bookletKey=booklet%3Astarter" });
  await directLaunchStatusCard.waitFor();
  await waitForNotBusy("direct-launch-status-select-before-click");
  await directLaunchStatusCard
    .getByRole("button", { name: "Select + Load", exact: true })
    .click();
  await waitForBusy("direct-launch-status-select-after-click");
  await waitForNotBusy("direct-launch-status-select-after-click");
  await expectInputValue("#participantDisplayName", "Direct Xml");
  await page
    .locator("article.card")
    .filter({ has: page.getByRole("heading", { name: "Runtime Snapshot" }) })
    .filter({ hasText: "Direct Xml" })
    .waitFor();
  await page
    .locator("app-live-context")
    .filter({ hasText: "Participant Runtime" })
    .filter({ hasText: "Participant" })
    .filter({ hasText: "Direct Xml" })
    .waitFor();
  stopAfter("participant-launch-status-session-link");
  logStep("participant-start");
  const participantLoginKey = "student-ui";
  const participantBookletKey = "booklet:starter";
  await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-roster`,
    {
      body: {
        rosterText: [
          "loginKey,groupKey,bookletKey,displayName",
          [
            participantLoginKey,
            participantGroupKey,
            participantBookletKey,
            participantLoginKey
          ].join(",")
        ].join("\n")
      }
    }
  );
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
  const monitorEventBeforePause = await page
    .locator("#monitorConnectionDetail")
    .textContent();
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
  await page.waitForFunction(
    previousEvent => {
      const detail = document
        .querySelector("#monitorConnectionDetail")
        ?.textContent?.trim();
      return !!detail && detail !== previousEvent?.trim() && detail.includes("change #");
    },
    monitorEventBeforePause,
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
  logStep("monitor-set-testlet-time");
  await fillAndCommit("#monitorTimeSeconds", "1800");
  await clickSelectorAction(
    "Monitor Set Testlet Time",
    "#runtimeMonitorSetTestletTimeButton"
  );
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${participantSessionId}/current-state`,
    payload => {
      const timers = payload?.currentRunState?.testRun?.testletTimers;
      const timer = timers?.["testlet:timed-paused"];
      return (
        payload?.currentRunState?.testRun?.status === "paused" &&
        timer?.status === "paused" &&
        timer?.durationSeconds === 1800 &&
        timer?.remainingSeconds === 1800
      );
    }
  );
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
  logStep("monitor-unlock-navigation");
  await clickSelectorAction(
    "Monitor Unlock Navigation",
    "#runtimeMonitorUnlockNavigationButton"
  );
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${participantSessionId}/current-state`,
    payload =>
      payload?.currentRunState?.testRun?.status === "running" &&
      payload?.currentRunState?.testRun?.monitorNavigationUnlocked === true
  );
  logStep("monitor-lock-navigation");
  await clickSelectorAction(
    "Monitor Lock Navigation",
    "#runtimeMonitorLockNavigationButton"
  );
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${participantSessionId}/current-state`,
    payload =>
      payload?.currentRunState?.testRun?.status === "running" &&
      payload?.currentRunState?.testRun?.monitorNavigationUnlocked === false
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
  await openRunStudentCard
    .filter({ hasText: "Timed Paused Work" })
    .filter({ hasText: "Booklet Species" })
    .filter({ hasText: "species: 1" })
    .filter({ hasText: "Active Timer" })
    .filter({ hasText: "Timer Remaining" })
    .filter({ hasText: "Timer Expires" })
    .waitFor();
  assert.match(await openRunStudentCard.innerText(), /Timer Remaining\s+\d+:\d{2}/i);
  logStep("monitor-bulk-pause-resume");
  await openRunStudentCard
    .getByRole("button", { name: "Add to Batch" })
    .click();
  const monitorBatchCard = page
    .locator("article.card")
    .filter({ has: page.getByRole("heading", { name: "Monitor Batch Command Preview" }) });
  await monitorBatchCard
    .filter({ hasText: "1 selected run" })
    .filter({ hasText: pausedTestRunId })
    .waitFor();
  page.once("dialog", async dialog => {
    assert.match(dialog.message(), /pause.*1 selected run/i);
    await dialog.accept();
  });
  const bulkPauseResponsePromise = page.waitForResponse(
    response =>
      response.url().endsWith("/monitor/open-runs/commands") &&
      response.request().method() === "POST"
  );
  await page.locator("#monitorBatchPauseButton").click();
  const bulkPauseResponse = await bulkPauseResponsePromise;
  assert.equal(bulkPauseResponse.status(), 200);
  const bulkPausePayload = await bulkPauseResponse.json();
  assert.equal(bulkPausePayload.succeededCount, 1);
  assert.equal(bulkPausePayload.failedCount, 0);
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${participantSessionId}/current-state`,
    payload => payload?.currentRunState?.testRun?.status === "paused"
  );
  await monitorBatchCard.filter({ hasText: "0 selected runs" }).waitFor();
  await openRunStudentCard
    .getByRole("button", { name: "Add to Batch" })
    .click();
  page.once("dialog", async dialog => {
    assert.match(dialog.message(), /lock_test.*1 selected run/i);
    await dialog.accept();
  });
  const bulkLockResponsePromise = page.waitForResponse(
    response =>
      response.url().endsWith("/monitor/open-runs/commands") &&
      response.request().method() === "POST"
  );
  await page.locator("#monitorBatchLockTestButton").click();
  const bulkLockResponse = await bulkLockResponsePromise;
  assert.equal(bulkLockResponse.status(), 200);
  assert.equal((await bulkLockResponse.json()).commands[0]?.testRun?.locked, true);
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${participantSessionId}/current-state`,
    payload => payload?.currentRunState?.testRun?.locked === true
  );
  await openRunStudentCard.filter({ hasText: "test locked" }).waitFor();
  await monitorBatchCard.filter({ hasText: "0 selected runs" }).waitFor();
  await openRunStudentCard
    .getByRole("button", { name: "Add to Batch" })
    .click();
  page.once("dialog", async dialog => {
    assert.match(dialog.message(), /unlock_test.*1 selected run/i);
    await dialog.accept();
  });
  const bulkUnlockResponsePromise = page.waitForResponse(
    response =>
      response.url().endsWith("/monitor/open-runs/commands") &&
      response.request().method() === "POST"
  );
  await page.locator("#monitorBatchUnlockTestButton").click();
  const bulkUnlockResponse = await bulkUnlockResponsePromise;
  assert.equal(bulkUnlockResponse.status(), 200);
  assert.equal((await bulkUnlockResponse.json()).commands[0]?.testRun?.locked, false);
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${participantSessionId}/current-state`,
    payload => payload?.currentRunState?.testRun?.locked === false
  );
  await openRunStudentCard.filter({ hasText: "test unlocked" }).waitFor();
  await monitorBatchCard.filter({ hasText: "0 selected runs" }).waitFor();
  await openRunStudentCard
    .getByRole("button", { name: "Add to Batch" })
    .click();
  await monitorBatchCard
    .filter({ hasText: "1 selected run" })
    .filter({ hasText: pausedTestRunId })
    .waitFor();
  page.once("dialog", async dialog => {
    assert.match(dialog.message(), /resume.*1 selected run/i);
    await dialog.accept();
  });
  const bulkResumeResponsePromise = page.waitForResponse(
    response =>
      response.url().endsWith("/monitor/open-runs/commands") &&
      response.request().method() === "POST"
  );
  await page.locator("#monitorBatchResumeButton").click();
  const bulkResumeResponse = await bulkResumeResponsePromise;
  assert.equal(bulkResumeResponse.status(), 200);
  const bulkResumePayload = await bulkResumeResponse.json();
  assert.equal(bulkResumePayload.succeededCount, 1);
  assert.equal(bulkResumePayload.failedCount, 0);
  assert.equal(bulkResumePayload.commands[0]?.testRun?.testRunId, pausedTestRunId);
  assert.equal(bulkResumePayload.commands[0]?.testRun?.status, "running");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${participantSessionId}/current-state`,
    payload => payload?.currentRunState?.testRun?.status === "running"
  );
  stopAfter("monitor-bulk-pause-resume");
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

  logStep("group-monitor-console");
  await page.locator('[data-view-nav="ops"]').click();
  await page.waitForURL(/\/app\/ops$/);
  await clickAction("Sign Out");
  await expectInputValue("#adminSessionToken", "");
  await fillAndCommit("#adminUsername", groupMonitorUsername);
  await fillAndCommit("#adminPassword", groupMonitorPassword);
  const groupMonitorSignInResponsePromise = page.waitForResponse(
    response =>
      response.request().method() === "POST" &&
      response.url().endsWith("/api/v1/admin/auth/sign-in")
  );
  await clickAction("Sign In");
  const groupMonitorSignInResponse = await groupMonitorSignInResponsePromise;
  assert.equal(groupMonitorSignInResponse.status(), 200);
  const groupMonitorSignIn = await groupMonitorSignInResponse.json();
  assert.equal(groupMonitorSignIn.adminUser.validForMinutes, 45);
  assert.ok(groupMonitorSignIn.adminUser.firstSignedInAt);
  assert.equal(
    Date.parse(groupMonitorSignIn.adminSession.expiresAt),
    Date.parse(groupMonitorSignIn.adminUser.firstSignedInAt) + 45 * 60_000
  );
  await waitForInputMinLength("#adminSessionToken", 20);
  await page
    .locator("app-record-collection")
    .filter({ has: page.getByRole("heading", { name: "Operator Session" }) })
    .filter({ hasText: "group_monitor" })
    .filter({ hasText: "Active access: Group monitor" })
    .waitFor();
  assert.equal(
    await page.locator('[data-view-nav="workspace"]').count(),
    0,
    "Group monitor navigation must not expose workspace administration."
  );
  assert.equal(
    await page.locator('[data-view-nav="content"]').count(),
    0,
    "Group monitor navigation must not expose content administration."
  );
  assert.equal(
    await page.getByRole("heading", { name: "Admin User Management" }).count(),
    0,
    "Group monitor diagnostics must not render admin user management."
  );

  await page.evaluate(() => {
    window.history.pushState({}, "", "/app/workspace");
    window.dispatchEvent(new PopStateEvent("popstate"));
  });
  await page.waitForURL(/\/app\/runtime$/);
  await page.locator("#monitorOperatorConsole").waitFor();
  assert.equal(
    (await page.locator("#monitorProfile option:checked").textContent())?.trim(),
    "All sessions"
  );
  await page
    .locator("#monitorProfileDetail")
    .filter({ hasText: "All sessions: small view, 1 imported filter(s)." })
    .waitFor();
  assert.equal(
    await page.locator("#loginKey").count(),
    0,
    "Group monitor runtime must not render participant-management controls."
  );
  await fillAndCommit("#monitorTenantKey", tenantKey);
  await fillAndCommit("#monitorWorkspaceKey", workspaceKey);
  await clickAction("Clear Open Run Filters");
  await page.locator("#monitorApplyScopeButton").click();
  const scopedOpenRuns = page
    .locator("app-record-collection")
    .filter({ has: page.getByRole("heading", { name: "Open Monitor Runs" }) });
  await scopedOpenRuns
    .filter({ hasText: participantLoginKey })
    .filter({ hasText: participantGroupKey })
    .waitFor();
  assert.equal(
    await scopedOpenRuns.getByText("Group", { exact: true }).count(),
    1,
    "Imported monitor profile must show the configured group column."
  );
  for (const hiddenColumn of ["Session", "Run", "Booklet", "Current Unit"]) {
    assert.equal(
      await scopedOpenRuns.getByText(hiddenColumn, { exact: true }).count(),
      0,
      `Imported small monitor profile must hide the ${hiddenColumn} column.`
    );
  }
  assert.equal(
    await scopedOpenRuns.filter({ hasText: "entry-student-a" }).count(),
    0,
    "Group monitor open runs must not include participants from other groups."
  );
  await scopedOpenRuns
    .getByRole("button", { name: "Select + Sync" })
    .first()
    .click();
  await expectInputValue("#monitorSelectedTestRunId", pausedTestRunId);
  await expectButtonSelectorEnabled("#monitorConsoleResumeButton");
  await page.waitForFunction(
    () => !document.querySelector(".status-banner.is-error"),
    undefined,
    { timeout: 10_000 }
  );
  stopAfter("group-monitor-console");

  await page.locator('[data-view-nav="ops"]').click();
  await page.waitForURL(/\/app\/ops$/);
  await clickAction("Sign Out");
  await fillAndCommitUntilValue("#adminUsername", adminUsername);
  await fillAndCommitUntilValue("#adminPassword", adminPassword);
  await clickAction("Sign In");
  await waitForInputMinLength("#adminSessionToken", 20);
  smokeAdminSessionToken = await page.locator("#adminSessionToken").inputValue();
  await page.locator('[data-view-nav="runtime"]').click();
  await page.waitForURL(/\/app\/runtime$/);

  logStep("filter-open-runs");
  await fillAndCommit("#openRunLoginFilter", participantLoginKey);
  await fillAndCommit("#openRunGroupFilter", participantGroupKey);
  await fillAndCommit("#openRunBookletFilter", participantBookletKey);
  await fillAndCommit("#openRunSpeciesFilter", "species: 1");
  await fillAndCommit("#openRunSessionFilter", participantSessionId);
  await fillAndCommit("#openRunRunFilter", pausedTestRunId);
  await fillAndCommit("#openRunUnitFilter", "unit-paused");
  await selectAndCommit("#openRunStatusFilter", "running");
  await fillAndCommit("#openRunLimit", "1");
  await clickAction("Apply Open Run Filters");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/monitor/open-runs?loginKey=${participantLoginKey}&groupKey=${encodeURIComponent(participantGroupKey)}&bookletKey=${encodeURIComponent(participantBookletKey)}&bookletSpecies=${encodeURIComponent("species: 1")}&participantSessionId=${participantSessionId}&testRunId=${pausedTestRunId}&unitKey=unit-paused&status=running&limit=1`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.length === 1 &&
      payload.items[0]?.testRunId === pausedTestRunId
  );
  logStep("export-open-runs-csv");
  const openRunsDownloadPromise = page
    .waitForEvent("download", { timeout: 5_000 })
    .catch(() => null);
  const openRunsCsvResponsePromise = page.waitForResponse(
    response =>
      response.request().method() === "GET" &&
      response.url().includes("/exports/open-runs.csv?")
  );
  await clickAction("Export Open Runs CSV");
  const openRunsCsvResponse = await openRunsCsvResponsePromise;
  assert.equal(openRunsCsvResponse.status(), 200);
  const openRunsCsvText = await openRunsCsvResponse.text();
  for (const expectedFragment of [
    "tenantKey,workspaceKey,participantSessionId,testRunId,loginKey",
    participantSessionId,
    participantLoginKey,
    participantGroupKey,
    participantBookletKey,
    "running"
  ]) {
    assert.ok(
      openRunsCsvText.includes(expectedFragment),
      `Open-runs CSV must include ${expectedFragment}.`
    );
  }
  const openRunsDownload = await openRunsDownloadPromise;
  if (openRunsDownload) {
    assert.equal(
      openRunsDownload.suggestedFilename(),
      `${workspaceKey}-open-runs.csv`
    );
  }
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
      const containsExpectedNotStartedParticipants =
        normalizedExpectedNotStartedParticipants.every(expected =>
          normalizedNotStartedParticipants.some(
            participant =>
              participant.loginKey === expected.loginKey &&
              participant.groupKey === expected.groupKey &&
              participant.bookletKey === expected.bookletKey &&
              participant.displayName === expected.displayName
          )
        );
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
        summary.rosterEntryCount >= 4 &&
        summary.participantSessionCount >= 4 &&
        summary.testRunCount >= 4 &&
        summary.notStartedCount >= 4 &&
        containsExpectedNotStartedParticipants &&
        missingResponseCount >= 11 &&
        Array.isArray(summary.groups) &&
        summary.groups.length >= 6 &&
        pausedWorkUnit?.rosterExpectedCount >= 2 &&
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
  await fillAndCommit("#studyMonitorMatrixLoginFilter", participantLoginKey);
  await fillAndCommit("#studyMonitorMatrixUnitFilter", "unit-paused");
  await page.selectOption("#studyMonitorMatrixStatusFilter", "running");
  await page.selectOption("#studyMonitorMatrixAnswerFilter", "answered");
  await fillAndCommit("#studyMonitorMatrixLimit", "5");
  await clickAction("Apply Matrix Filters");
  await page
    .locator("app-record-collection")
    .filter({ hasText: "Participant Unit Matrix" })
    .locator(".record-card")
    .filter({ hasText: "student-ui" })
    .filter({ hasText: "unit-paused" })
    .filter({ hasText: "answered" })
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
  await page.getByRole("button", { name: "Clear Matrix Filters" }).click();
  await expectInputValue("#studyMonitorMatrixLoginFilter", "");
  await expectInputValue("#studyMonitorMatrixUnitFilter", "");
  await expectInputValue("#studyMonitorMatrixLimit", "25");
  logStep("run-detail-csv-export");
  await expectButtonSelectorEnabled("#exportStudyMonitorRunCsvButton");
  const studyMonitorRunDownloadPromise = waitForOptionalDownload();
  await clickAction("Export Run Detail CSV");
  const studyMonitorRunDownload = await studyMonitorRunDownloadPromise;
  if (studyMonitorRunDownload) {
    assert.equal(
      studyMonitorRunDownload.suggestedFilename(),
      `${workspaceKey}-study-monitor-run-${pausedTestRunId}.csv`
    );
  }
  await page
    .locator("#studyMonitorRunExportPreview")
    .filter({
      hasText:
        "tenantKey,workspaceKey,generatedAt,testRunId,participantSessionId"
    })
    .filter({ hasText: participantLoginKey })
    .filter({ hasText: pausedTestRunId })
    .filter({ hasText: "unit-paused" })
    .filter({ hasText: "Filtered response smoke" })
    .waitFor();
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
    .filter({ hasText: `${studyMonitorSummary.unitProgress.length} unit(s)` })
    .filter({ hasText: `${studyMonitorMissingResponseCount} missing response(s)` })
    .filter({ hasText: "Roster Entries" })
    .filter({ hasText: "Not Started" })
    .filter({ hasText: String(studyMonitorSummary.notStartedCount) })
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
  const studyMonitorDownloadPromise = waitForOptionalDownload();
  await clickAction("Export Study Monitor CSV");
  const studyMonitorDownload = await studyMonitorDownloadPromise;
  if (studyMonitorDownload) {
    assert.equal(
      studyMonitorDownload.suggestedFilename(),
      `${workspaceKey}-study-monitor.csv`
    );
  }
  await page
    .locator("#studyMonitorExportPreview")
    .filter({ hasText: "tenantKey,workspaceKey,section" })
    .filter({ hasText: "unit-paused" })
    .filter({ hasText: "not_started_participant" })
    .waitFor();
  const participantMatrixDownloadPromise = waitForOptionalDownload();
  await clickAction("Export Participant Matrix CSV");
  const participantMatrixDownload = await participantMatrixDownloadPromise;
  if (participantMatrixDownload) {
    assert.equal(
      participantMatrixDownload.suggestedFilename(),
      `${workspaceKey}-study-monitor-participants.csv`
    );
  }
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
  logStep("refresh-participant-test-logs");
  await clickAction("Refresh Participant Test Logs");
  await page
    .locator("article.card")
    .filter({ has: page.getByRole("heading", { name: "Participant Test Logs" }) })
    .filter({ hasText: "CONTROLLER" })
    .waitFor();
  logStep("export-participant-test-log-csv");
  const workspaceLogDownloadPromise = waitForOptionalDownload();
  await clickAction("Export Participant Test Logs CSV");
  const workspaceLogDownload = await workspaceLogDownloadPromise;
  if (workspaceLogDownload) {
    assert.equal(
      workspaceLogDownload.suggestedFilename(),
      `${workspaceKey}-test-logs.csv`
    );
  }
  await page
    .locator("#workspaceLogExportPreview")
    .filter({
      hasText:
        "groupname;loginname;code;bookletname;unitname;originalUnitId;timestamp;logentry"
    })
    .filter({ hasText: "PLAYER_STATE_CHANGED" })
    .filter({ hasText: "Saved through Verona" })
    .waitFor();
  logStep("export-workspace-activity-csv");
  const workspaceActivityDownloadPromise = waitForOptionalDownload();
  await clickAction("Export Activity CSV");
  const workspaceActivityDownload = await workspaceActivityDownloadPromise;
  if (workspaceActivityDownload) {
    assert.equal(
      workspaceActivityDownload.suggestedFilename(),
      `${workspaceKey}-activity-events.csv`
    );
  }
  await page
    .locator("#workspaceActivityExportPreview")
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
          item?.sourcePackage?.fileName === "broken.json" &&
          item?.sourcePackage?.mediaType === "application/json" &&
          item?.sourcePackage?.sourceDocument == null
      )
  );
  const failedSourcePackageId = failedSourcePackagesPayload.items.find(
    item =>
      item?.sourcePackage?.fileName === "broken.json" &&
      item?.sourcePackage?.mediaType === "application/json" &&
      item?.sourcePackage?.sourceDocument == null
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
  await selectAndCommit("#sourcePackageFileTypeFilter", "Resource");
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
    .filter({ hasText: "5 active filter(s)" })
    .filter({ hasText: "limit 1" })
    .filter({ hasText: "Loaded Records" })
    .filter({ hasText: "status, file type, media type, file name, latest import" })
    .waitFor();
  await page
    .locator("article.card")
    .filter({ has: page.getByRole("heading", { name: "Source Packages" }) })
    .filter({ hasText: retriedSourcePackageFileName })
    .filter({ hasText: "File Type" })
    .filter({ hasText: "Resource" })
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
      payload.currentRunState.testRun.status === "running" &&
      payload.currentRunState.testRun.currentUnitKey === "unit-paused"
  );
  await fillAndCommitUntilValue("#testRunId", pausedTestRunId);
  logStep("monitor-goto-unit");
  await fillAndCommitUntilValue("#monitorTargetUnitKey", "unit-1");
  await clickSelectorAction(
    "Monitor Go To Unit",
    "#runtimeMonitorGotoButton"
  );
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${participantSessionId}/current-state`,
    payload =>
      payload?.currentRunState?.testRun?.status === "running" &&
      payload?.currentRunState?.testRun?.currentUnitKey === "unit-1"
  );
  await expectInputValue("#monitorTargetUnitKey", "unit-1");
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
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/activity-events?eventType=monitor_run_command_issued&subjectType=test_run&subjectId=${pausedTestRunId}&limit=2`,
    payload =>
      payload?.items?.some(
        item =>
          item?.activityEvent?.actorId === "operator-ui" &&
          item.activityEvent.subjectId === pausedTestRunId &&
          item.activityEvent.details?.commandType === "complete" &&
          item.activityEvent.details?.previousStatus === "running" &&
          item.activityEvent.details?.nextStatus === "completed" &&
          item.activityEvent.details?.participantSessionId === participantSessionId &&
          item.activityEvent.details?.loginKey === participantLoginKey &&
          item.activityEvent.details?.groupKey === participantGroupKey &&
          item.activityEvent.details?.bookletKey === participantBookletKey
      )
  );

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
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/results/groups`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.some(item => item?.groupKey === participantGroupKey)
  );
  await clickAction("Load Result Groups");
  const resultGroups = page
    .locator("app-record-collection")
    .filter({ hasText: "Result Groups" });
  const selectedResultGroup = resultGroups
    .locator(".record-card")
    .filter({ hasText: participantGroupKey });
  await resultGroups.filter({ hasText: participantGroupKey }).waitFor();
  await selectedResultGroup
    .filter({ hasText: "Booklets Started" })
    .filter({ hasText: "Units Minimum" })
    .filter({ hasText: "Units Maximum" })
    .filter({ hasText: "Units Average" })
    .filter({ hasText: "Last Test Activity" })
    .waitFor();
  await fillAndCommit("#groupKey", "group:selection-placeholder");
  await selectedResultGroup.getByRole("button", { name: "Use Result Group" }).click();
  await expectInputValue("#groupKey", participantGroupKey);
  await expectInputValue("#detailedResponseGroupFilter", participantGroupKey);
  await expectInputValue("#reviewGroupFilter", participantGroupKey);
  await expectInputValue("#participantSessionGroupFilter", participantGroupKey);
  await expectInputValue("#openRunGroupFilter", participantGroupKey);
  await selectedResultGroup
    .getByRole("button", { name: "Add to Selection" })
    .click();
  await page
    .locator("#resultGroupSelectionActions")
    .filter({ hasText: "1 selected group" })
    .waitFor();
  for (const [selector, filenamePattern] of [
    ["#exportSelectedGroupResponsesButton", /selected-responses\.csv$/],
    ["#exportSelectedGroupLogsButton", /selected-logs\.csv$/],
    ["#exportSelectedGroupReviewsButton", /selected-reviews\.csv$/]
  ]) {
    const [download] = await Promise.all([
      page.waitForEvent("download"),
      page.locator(selector).click()
    ]);
    assert.match(download.suggestedFilename(), filenamePattern);
  }
  const deleteGroupResultsDialog = new Promise((resolvePromise, reject) => {
    page.once("dialog", async dialog => {
      try {
        assert.match(dialog.message(), /1 selected group/);
        assert.match(dialog.message(), new RegExp(workspaceKey));
        await dialog.accept(workspaceKey);
        resolvePromise(undefined);
      } catch (error) {
        reject(error);
      }
    });
  });
  await page.locator("#deleteSelectedGroupResultsButton").click();
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
        item => item?.activityEvent?.details?.groupKeys?.includes(participantGroupKey)
      )
  );
  await selectedResultGroup.waitFor({ state: "detached" });
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
