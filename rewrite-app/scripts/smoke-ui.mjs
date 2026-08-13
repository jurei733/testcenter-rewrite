import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { brotliDecompressSync } from "node:zlib";

import { chromium } from "playwright";
import QRCode from "qrcode";

const store = process.env.FIRST_SLICE_STORE ?? "sqlite";
const operatorAuthRequired =
  process.env.FIRST_SLICE_OPERATOR_AUTH_REQUIRED === "true";
const stopAfterStep = process.env.UI_SMOKE_STOP_AFTER_STEP ?? "";
const skipRuntimeCsvExports = ["1", "true", "yes", "on"].includes(
  String(process.env.UI_SMOKE_SKIP_RUNTIME_CSV_EXPORTS ?? "").toLowerCase()
);
const skipOfflineAppShell = ["1", "true", "yes", "on"].includes(
  String(process.env.UI_SMOKE_SKIP_OFFLINE_APP_SHELL ?? "").toLowerCase()
);
const skipWorkspaceRename = ["1", "true", "yes", "on"].includes(
  String(process.env.UI_SMOKE_SKIP_WORKSPACE_RENAME ?? "").toLowerCase()
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
  '<Booklet><Metadata><Id>booklet:starter</Id><Label>Starter</Label></Metadata><BookletConfig><Config key="toolbar_show_unit_list">TRUE</Config><Config key="ask_for_fullscreen">ON</Config><Config key="show_fullscreen_button">ON</Config><Config key="toolbar_show_reload_button">TRUE</Config><Config key="unit_screenheader">WITH_UNIT_TITLE</Config><Config key="unit_title">OFF</Config></BookletConfig><Units><Unit id="unit-1" label="Entry" /><Testlet id="testlet:participant-route" label="Participant Route Block"><Unit id="unit-participant-route" label="Participant Route"><description>Read the participant prompt.</description><prompt>Explain how the starter example works.</prompt></Unit></Testlet><Testlet id="testlet:timed-paused" label="Timed Paused Work"><Restrictions><TimeMax minutes="5" leave="allowed" /></Restrictions><Unit id="unit-paused" label="Paused Work"><Definition><![CDATA[<section>Answer the direct Testcenter definition prompt.</section>]]></Definition></Unit></Testlet></Units></Booklet>';
let smokeAdminSessionToken = "";

const readBrotliBase64Text = async fixturePath =>
  brotliDecompressSync(
    Buffer.from(await readFile(fixturePath, "utf8"), "base64")
  ).toString("utf8");

const crc32Table = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) {
    crc = (crc & 1) !== 0 ? 0xedb88320 ^ (crc >>> 1) : crc >>> 1;
  }
  return crc >>> 0;
});

const crc32 = content => {
  let crc = 0xffffffff;
  for (const byte of content) {
    crc = crc32Table[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
};

const createStoredZipBuffer = entries => {
  const localFileHeaders = [];
  const centralDirectoryHeaders = [];
  let offset = 0;

  for (const entry of entries) {
    const fileName = Buffer.from(entry.fileName, "utf8");
    const content = Buffer.from(entry.content, "utf8");
    const checksum = crc32(content);
    const localHeader = Buffer.alloc(30 + fileName.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
    localHeader.writeUInt16LE(0, 8);
    localHeader.writeUInt32LE(0, 10);
    localHeader.writeUInt32LE(checksum, 14);
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
    centralDirectoryHeader.writeUInt32LE(checksum, 16);
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

const readStoredZipTextEntries = archive => {
  const entries = new Map();
  let offset = 0;
  while (
    offset + 30 <= archive.length &&
    archive.readUInt32LE(offset) === 0x04034b50
  ) {
    assert.equal(archive.readUInt16LE(offset + 8), 0);
    const contentLength = archive.readUInt32LE(offset + 18);
    const fileNameLength = archive.readUInt16LE(offset + 26);
    const extraLength = archive.readUInt16LE(offset + 28);
    const fileNameStart = offset + 30;
    const contentStart = fileNameStart + fileNameLength + extraLength;
    const contentEnd = contentStart + contentLength;
    assert.ok(contentEnd <= archive.length);
    entries.set(
      archive
        .subarray(fileNameStart, fileNameStart + fileNameLength)
        .toString("utf8"),
      archive.subarray(contentStart, contentEnd).toString("utf8")
    );
    offset = contentEnd;
  }
  return entries;
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

  browser = await chromium.launch({
    headless: true,
    args: [
      "--use-fake-device-for-media-stream",
      "--use-fake-ui-for-media-stream"
    ]
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  const context = await browser.newContext();
  await context.grantPermissions(
    ["clipboard-read", "clipboard-write", "camera"],
    { origin: baseUrl }
  );
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
  const fillVeronaAnswerAndWaitForHost = async (frame, selector, value) => {
    const observedAnswer = page.evaluate(
      expectedValue =>
        new Promise(resolve => {
          const timeout = globalThis.setTimeout(() => {
            globalThis.removeEventListener("message", observeAnswer);
            resolve(false);
          }, 15_000);
          const observeAnswer = event => {
            const notification = event.data;
            if (
              notification?.type !== "vopStateChangedNotification" ||
              notification.unitState == null
            ) {
              return;
            }
            let serializedUnitState = "";
            try {
              serializedUnitState = JSON.stringify(notification.unitState);
            } catch {
              return;
            }
            if (!serializedUnitState.includes(expectedValue)) {
              return;
            }
            globalThis.clearTimeout(timeout);
            globalThis.removeEventListener("message", observeAnswer);
            resolve(true);
          };
          globalThis.addEventListener("message", observeAnswer);
        }),
      value
    );
    await frame.locator(selector).fill(value);
    await frame.locator(selector).dispatchEvent("keyup", {
      key: value.at(-1) ?? "a"
    });
    assert.equal(
      await observedAnswer,
      true,
      `UI smoke expected Verona to publish the answer ${JSON.stringify(value)}.`
    );
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
    const clickDeadline = Date.now() + 15_000;
    let clicked = false;
    while (!clicked && Date.now() < clickDeadline) {
      clicked = await button
        .evaluate(element => {
          if (!(element instanceof HTMLButtonElement) || element.disabled) {
            return false;
          }
          element.click();
          return true;
        })
        .catch(() => false);
      if (!clicked) {
        await page.waitForTimeout(50);
      }
    }
    assert.equal(clicked, true, `Timed out clicking action '${name}'.`);
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
    await page.waitForFunction(
      targetSelector => {
        const element = document.querySelector(targetSelector);
        if (!(element instanceof HTMLButtonElement) || element.disabled) {
          return false;
        }
        element.click();
        return true;
      },
      selector,
      { timeout: 15_000 }
    );
    const startedBusy = await waitForBusy(`${name}-after-click`);
    if (!startedBusy) {
      await page.waitForTimeout(150);
    }
    await waitForNotBusy(`${name}-after-click`);
    logStep(`action-${name.replaceAll(" ", "-").toLowerCase()}-done`);
  };
  const signOutAdmin = async () => {
    logStep("action-sign-out-start");
    await waitForNotBusy("sign-out-before-click");
    const signOutResponsePromise = page.waitForResponse(
      response =>
        response.request().method() === "POST" &&
        response.url().endsWith("/api/v1/admin/auth/sign-out"),
      { timeout: 15_000 }
    );
    await page.waitForFunction(
      () => {
        const button = document.querySelector("#adminSignOutButton");
        if (!(button instanceof HTMLButtonElement) || button.disabled) {
          return false;
        }
        button.click();
        return true;
      },
      undefined,
      { timeout: 15_000 }
    );
    assert.equal((await signOutResponsePromise).status(), 200);
    await waitForNotBusy("sign-out-after-click");
    await expectInputValue("#adminSessionToken", "");
    logStep("action-sign-out-done");
  };
  const waitForRouteTarget = async (selector, recover = null) => {
    const target = page.locator(selector);
    for (let attempt = 1; attempt <= 3; attempt += 1) {
      const mounted = await target
        .waitFor({ state: "visible", timeout: 10_000 })
        .then(() => true)
        .catch(() => false);
      if (mounted) {
        return target;
      }
      if (attempt === 3) {
        break;
      }
      await page.reload({ waitUntil: "domcontentloaded" });
      if (recover) {
        await recover();
      }
    }
    await target.waitFor({ state: "visible", timeout: 15_000 });
    return target;
  };
  const restorePlatformAdminSession = async () => {
    logStep("restore-platform-admin-session-start");
    await page.goto(`${baseUrl}/app/ops`, { waitUntil: "domcontentloaded" });
    await page.waitForURL(/\/app\/ops$/);
    await waitForRouteTarget("#operatorAccessCard");
    const signOutButton = page.locator("#adminSignOutButton");
    if (await signOutButton.isVisible().catch(() => false)) {
      await signOutAdmin();
    }
    await fillAndCommitUntilValue("#adminUsername", adminUsername);
    await fillAndCommitUntilValue("#adminPassword", adminPassword);
    await clickAction("Sign In");
    await waitForInputMinLength("#adminSessionToken", 20);
    smokeAdminSessionToken = await page.locator("#adminSessionToken").inputValue();
    await page.locator("#adminCreateUsername").waitFor({ timeout: 15_000 });
    logStep("restore-platform-admin-session-done");
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
  const waitForAppConfirmation = async (
    expectedTitlePattern,
    expectedMessagePattern
  ) => {
    const backdrop = page.locator("#globalConfirmationBackdrop");
    await backdrop.waitFor({ timeout: 15_000 });
    assert.match(
      (await page.locator("#globalConfirmationTitle").textContent()) ?? "",
      expectedTitlePattern
    );
    assert.match(
      (await page.locator("#globalConfirmationMessage").textContent()) ?? "",
      expectedMessagePattern
    );
    return backdrop;
  };
  const acceptAppConfirmation = async (
    expectedTitlePattern,
    expectedMessagePattern
  ) => {
    const backdrop = await waitForAppConfirmation(
      expectedTitlePattern,
      expectedMessagePattern
    );
    await page.locator("#globalConfirmationConfirmButton").click();
    await backdrop.waitFor({ state: "detached" });
  };
  const acceptVerifiedAppConfirmation = async (
    expectedTitlePattern,
    expectedMessagePattern,
    verificationText
  ) => {
    const backdrop = await waitForAppConfirmation(
      expectedTitlePattern,
      expectedMessagePattern
    );
    const verificationInput = page.locator(
      "#globalConfirmationVerificationInput"
    );
    await verificationInput.fill(verificationText);
    await expectButtonSelectorEnabled("#globalConfirmationConfirmButton");
    await page.locator("#globalConfirmationConfirmButton").click();
    await backdrop.waitFor({ state: "detached" });
  };
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
      const card = page.locator("article.card").filter({
        has: page.getByRole("heading", { name: cardTitle, exact: true })
      });
      const actionScope = itemHeadline
        ? card.locator(".record-card").filter({
            has: page.getByRole("heading", { name: itemHeadline, exact: true })
          })
        : card;
      try {
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
  await page.waitForURL(/\/app\/home$/);
  await page.waitForSelector("h1");
  await page.locator("#applicationStartView").waitFor();
  await page.locator("#startSystemCheck").waitFor();
  assert.equal(
    await page.locator("#startProtectedSystemCheck").count(),
    0,
    "An installation without system-check accounts should expose the anonymous System Check entry."
  );
  await waitForNotBusy("initial-load");
  assert.equal(await page.locator("#authModeBadge").count(), 0);
  logStep("central-bug-report");
  await page.goto(
    `${baseUrl}/app/home?login=browser-secret#private-fragment`,
    { waitUntil: "networkidle" }
  );
  await page.evaluate(() => {
    setTimeout(() => {
      throw new Error(
        "runtime token=top-secret at https://example.test/unit?password=hidden#fragment"
      );
    }, 0);
  });
  await page.locator("#bugReportDialog").waitFor();
  const bugReportText = await page.locator("#bugReportText").innerText();
  assert.match(bugReportText, /runtime token=\[REDACTED\]/);
  assert.match(bugReportText, /https:\/\/example\.test\/unit/);
  assert.doesNotMatch(
    bugReportText,
    /top-secret|browser-secret|password=hidden|private-fragment|#fragment/
  );
  assert.equal(
    await page.locator("#bugReportSubmitButton").count(),
    0,
    "Direct report submission should stay hidden without server credentials."
  );
  const bugReportDownloadPromise = page.waitForEvent("download");
  await page.locator("#bugReportDownloadButton").click();
  const bugReportDownload = await bugReportDownloadPromise;
  assert.equal(bugReportDownload.suggestedFilename(), "bug-report.txt");
  await page.locator("#bugReportCloseButton").click();
  await page.locator("#bugReportDialog").waitFor({ state: "detached" });
  stopAfter("central-bug-report");
  await page.goto(`${baseUrl}/app/workspace`, { waitUntil: "networkidle" });
  if (operatorAuthRequired) {
    await page.waitForURL(url => {
      return (
        url.pathname === "/app/ops" &&
        url.searchParams.get("returnUrl") === "/workspace"
      );
    });
    await page.locator("#operatorAccessCard.is-signed-out").waitFor();
    assert.equal(
      await page
        .getByRole("heading", { name: "Workspace Action Queue", exact: true })
        .count(),
      0
    );
    await page.goto(`${baseUrl}/app/ops`, { waitUntil: "networkidle" });
    await page.locator("#operatorAccessCard.is-signed-out").waitFor();
  } else {
    await page
      .locator("article.card")
      .filter({
        has: page.getByRole("heading", { name: "Workspace Action Queue" })
      })
      .waitFor();
    await page.waitForFunction(
      expectedPort => {
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
          authMode === "open" &&
          runtimePort === String(expectedPort) &&
          Number.isFinite(routeCount) &&
          routeCount >= 30 &&
          !!buildRef &&
          buildRef !== "unknown"
        );
      },
      port,
      { timeout: 15_000 }
    );
  }
  if (!skipOfflineAppShell) {
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
    if (await offlineShellPage.evaluate(() => navigator.onLine)) {
      await offlineShellPage.evaluate(() => {
        window.dispatchEvent(new Event("offline"));
      });
    }
    const offlineNotice = offlineShellPage.locator("#appOfflineShellNotice");
    await offlineNotice.waitFor();
    assert.match(
      (await offlineNotice.innerText()).replace(/\s+/g, " "),
      /Offline mode.*signing in, loading test content, and saving require a connection/
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
  }
  stopAfter("offline-app-shell");
  if (!operatorAuthRequired) {
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
  }
  await page.locator("#operatorAccessCard.is-signed-out").waitFor();
  assert.equal(
    await page.getByRole("heading", { name: "Ops Action Queue", exact: true }).count(),
    0
  );
  logStep("admin-bootstrap-sign-in");
  await page.locator("#firstDeploymentSetup").evaluate(details => {
    details.open = true;
  });
  await fillAndCommit("#adminUsername", adminUsername);
  await fillAndCommit("#adminDisplayName", "UI Smoke Admin");
  await fillAndCommit("#adminPassword", "");
  await expectButtonSelectorDisabled("#adminBootstrapOrSignInButton");
  await expectButtonSelectorDisabled("#adminBootstrapButton");
  await expectButtonSelectorDisabled("#adminSignInButton");
  for (const protectedSelector of [
    "#adminCurrentSessionButton",
    "#adminSessionsButton",
    "#adminUsersButton",
    "#adminAuditEventsButton",
    "#adminSignOutButton",
    "#applyAdminSessionFiltersButton",
    "#exportAdminSessionsCsvButton",
    "#applyAdminUserFiltersButton",
    "#exportAdminUsersCsvButton",
    "#applyAdminAuditFiltersButton",
    "#exportAdminAuditCsvButton"
  ]) {
    assert.equal(await page.locator(protectedSelector).count(), 0);
  }
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
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Ops Action Queue" })
    })
    .waitFor();
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
  logStep("admin-access-window-copy");
  const scheduledAdminUsername = `ui-scheduled-admin-${Date.now()}`;
  const scheduledAdminPassword = "ui-scheduled-admin-secret";
  const scheduledAdminResponse = await sendSmokeJson(
    `${baseUrl}/api/v1/admin/users`,
    {
      body: {
        username: scheduledAdminUsername,
        password: scheduledAdminPassword,
        validFrom: "2999-01-01T00:00:00.000Z",
        customTexts: {
          gm_selection_text_scheduled: "Scheduled monitor opens $date"
        },
        roleAssignments: []
      }
    }
  );
  const scheduledAdminPayload = await scheduledAdminResponse.json();
  const expiredAdminUsername = `ui-expired-admin-${Date.now()}`;
  const expiredAdminPassword = "ui-expired-admin-secret";
  const expiredAdminResponse = await sendSmokeJson(
    `${baseUrl}/api/v1/admin/users`,
    {
      body: {
        username: expiredAdminUsername,
        password: expiredAdminPassword,
        validTo: "2000-01-01T00:00:00.000Z",
        customTexts: {
          gm_selection_text_expired: "Expired monitor closed %date"
        },
        roleAssignments: []
      }
    }
  );
  const expiredAdminPayload = await expiredAdminResponse.json();
  const accessWindowContext = await browser.newContext();
  const accessWindowPage = await accessWindowContext.newPage();
  try {
    await accessWindowPage.goto(`${baseUrl}/app/ops`, {
      waitUntil: "domcontentloaded"
    });
    await accessWindowPage.locator("#adminSignInButton").waitFor();
    const attemptAccessWindowSignIn = async (username, password, statusCode) => {
      await accessWindowPage.locator("#adminUsername").fill(username);
      await accessWindowPage.locator("#adminPassword").fill(password);
      const responsePromise = accessWindowPage.waitForResponse(
        response =>
          response.request().method() === "POST" &&
          response.url().endsWith("/api/v1/admin/auth/sign-in")
      );
      await accessWindowPage.locator("#adminSignInButton").click();
      assert.equal((await responsePromise).status(), statusCode);
    };

    await attemptAccessWindowSignIn(
      scheduledAdminUsername,
      "wrong-scheduled-secret",
      401
    );
    assert.equal(
      await accessWindowPage.locator("#adminAccessWindowNotice").count(),
      0
    );
    await attemptAccessWindowSignIn(
      scheduledAdminUsername,
      scheduledAdminPassword,
      403
    );
    const scheduledAccessNotice = accessWindowPage.locator(
      "#adminAccessWindowNotice"
    );
    await scheduledAccessNotice.waitFor();
    assert.match(
      await scheduledAccessNotice.innerText(),
      /^Scheduled monitor opens /
    );
    assert.match(await scheduledAccessNotice.innerText(), /2999/);
    assert.doesNotMatch(await scheduledAccessNotice.innerText(), /\$date|%date/);

    await attemptAccessWindowSignIn(
      expiredAdminUsername,
      expiredAdminPassword,
      410
    );
    const expiredAccessNotice = accessWindowPage.locator(
      "#adminAccessWindowNotice"
    );
    await expiredAccessNotice.waitFor();
    assert.match(
      await expiredAccessNotice.innerText(),
      /^Expired monitor closed /
    );
    assert.match(await expiredAccessNotice.innerText(), /2000/);
    assert.doesNotMatch(await expiredAccessNotice.innerText(), /\$date|%date/);
  } finally {
    await accessWindowContext.close();
  }
  await sendSmokeJson(
    `${baseUrl}/api/v1/admin/users/${scheduledAdminPayload.adminUser.adminUserId}`,
    { method: "DELETE" }
  );
  await sendSmokeJson(
    `${baseUrl}/api/v1/admin/users/${expiredAdminPayload.adminUser.adminUserId}`,
    { method: "DELETE" }
  );
  stopAfter("admin-access-window-copy");
  logStep("admin-current-session");
  await clickSelectorAction("Refresh Session", "#adminCurrentSessionButton");
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Operator Session", exact: true })
    })
    .filter({ hasText: "platform_admin" })
    .waitFor();
  logStep("application-settings");
  await page.locator("#administrationUsersTab").waitFor();
  assert.equal(
    await page.locator("#administrationUsersTab").getAttribute("aria-current"),
    "page"
  );
  assert.equal(await page.locator("#applicationSettingsCard").count(), 0);
  await page.locator("#administrationSettingsTab").click();
  await page.waitForURL(/\/app\/ops\?adminSection=settings$/);
  await page.waitForFunction(
    () =>
      document
        .querySelector("#administrationSettingsTab")
        ?.getAttribute("aria-current") === "page"
  );
  assert.equal(
    await page.locator("#administrationSettingsTab").getAttribute("aria-current"),
    "page"
  );
  assert.equal(
    await page.getByRole("heading", { name: "Admin User Management" }).count(),
    0
  );
  await page.locator("#applicationSettingsCard").waitFor();
  await expectInputValue("#applicationTitleInput", "IQB-Testcenter");
  await page.waitForFunction(() => {
    const image = document.querySelector("#applicationLogo");
    return (
      image instanceof HTMLImageElement &&
      image.complete &&
      image.naturalWidth > 0 &&
      image.src.endsWith("/app/assets/images/IQB-Logo-2025.png")
    );
  });
  const configuredLogoBase64 =
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=";
  await page.locator("#applicationAssetInput").setInputFiles({
    name: "ui-login-illustration.png",
    mimeType: "image/png",
    buffer: Buffer.from(configuredLogoBase64, "base64")
  });
  await page
    .locator(".application-asset-card")
    .filter({ hasText: "ui-login-illustration.png" })
    .waitFor();
  await page
    .locator("#applicationAssetSlot-loginIllustration")
    .selectOption("ui-login-illustration.png");
  await page.locator("#applicationCustomTextsEditor summary").click();
  await fillAndCommit(
    "#applicationCustomText-login_subtitle",
    "UI Global Selection"
  );
  await fillAndCommit(
    "#applicationCustomText-login_testResumeButtonLabel",
    "UI Global Resume"
  );
  await fillAndCommit(
    "#applicationCustomText-gm_menu_filter",
    "UI Global Hidden Sessions"
  );
  await page.locator("#applicationThemeSelect").selectOption({ label: "Sekundar" });
  const configuredLogo = `data:image/png;base64,${configuredLogoBase64}`;
  const configuredIntroHtml =
    '<p id="uiConfiguredIntro">Welcome to the <strong>UI smoke assessment</strong>.</p><img id="uiIntroSanitizerProbe" src="missing-intro.png" onerror="document.body.dataset.introUnsafe=\'true\'">';
  const configuredLegalNoticeHtml =
    '<h3 id="uiConfiguredLegalHeading">UI Smoke Provider</h3><p>Provider contact: <a href="mailto:provider@example.test" onclick="document.body.dataset.legalUnsafe=\'true\'">provider@example.test</a></p>';
  const configuredPrivacyNotice =
    '<h3 id="uiConfiguredPrivacyHeading">UI Smoke Privacy</h3><p>Privacy contact: <a href="mailto:privacy@example.test" onclick="document.body.dataset.privacyUnsafe=\'true\'">privacy@example.test</a></p>';
  const configuredAccessibilityNotice =
    '<h3 id="uiConfiguredAccessibilityHeading">UI Smoke Accessibility</h3><p>Accessibility contact: <a href="mailto:accessibility@example.test" onclick="document.body.dataset.accessibilityUnsafe=\'true\'">accessibility@example.test</a></p>';
  await page.locator("#applicationLogoInput").setInputFiles({
    name: "ui-smoke-logo.png",
    mimeType: "image/png",
    buffer: Buffer.from(configuredLogoBase64, "base64")
  });
  try {
    await page.waitForFunction(
      expected => {
        const image = document.querySelector("#applicationLogoPreview");
        return image instanceof HTMLImageElement && image.src === expected;
      },
      configuredLogo,
      { timeout: 5_000 }
    );
  } catch (error) {
    const logoState = await page.evaluate(() => {
      const input = document.querySelector("#applicationLogoInput");
      const preview = document.querySelector("#applicationLogoPreview");
      return {
        file:
          input instanceof HTMLInputElement && input.files?.[0]
            ? {
                name: input.files[0].name,
                type: input.files[0].type,
                size: input.files[0].size
              }
            : null,
        preview:
          preview instanceof HTMLImageElement ? preview.getAttribute("src") : null,
        error: document.querySelector("#applicationLogoError")?.textContent
      };
    });
    throw new Error(`Logo preview did not update: ${JSON.stringify(logoState)}`, {
      cause: error
    });
  }
  const warningExpiration = new Date(Date.now() + 60 * 60_000);
  const formatLocalDateTime = value => {
    const component = number => String(number).padStart(2, "0");
    return `${value.getFullYear()}-${component(value.getMonth() + 1)}-${component(
      value.getDate()
    )}T${component(value.getHours())}:${component(value.getMinutes())}`;
  };
  await fillAndCommit("#applicationTitleInput", "UI Smoke Testcenter");
  await fillAndCommit("#applicationIntroHtmlInput", configuredIntroHtml);
  await fillAndCommit(
    "#applicationLegalNoticeHtmlInput",
    configuredLegalNoticeHtml
  );
  await fillAndCommit(
    "#applicationPrivacyNoticeInput",
    configuredPrivacyNotice
  );
  await fillAndCommit(
    "#applicationAccessibilityNoticeInput",
    configuredAccessibilityNotice
  );
  await fillAndCommit(
    "#applicationWarningTextInput",
    "UI smoke planned maintenance warning"
  );
  await fillAndCommit(
    "#applicationWarningExpiresAtInput",
    formatLocalDateTime(warningExpiration)
  );
  await clickAction("Save Application Settings");
  await page.waitForFunction(() => document.title === "UI Smoke Testcenter");
  await page.waitForFunction(
    expected =>
      document.documentElement.dataset["applicationTheme"] === expected &&
      getComputedStyle(document.documentElement)
        .getPropertyValue("--secondary")
        .trim()
        .toLowerCase() === "#0b2d84",
    "Sekundar"
  );
  await page.waitForFunction(
    expected => {
      const image = document.querySelector("#applicationLogo");
      return image instanceof HTMLImageElement && image.src === expected;
    },
    configuredLogo
  );
  await page
    .locator("#globalApplicationWarning")
    .filter({ hasText: "UI smoke planned maintenance warning" })
    .waitFor();
  const configuredSettingsResponse = await fetch(
    `${baseUrl}/api/v1/system/application-settings`
  );
  assert.equal(configuredSettingsResponse.status, 200);
  const configuredSettingsPayload = await configuredSettingsResponse.json();
  assert.equal(
    configuredSettingsPayload.applicationSettings.appTitle,
    "UI Smoke Testcenter"
  );
  assert.equal(
    configuredSettingsPayload.applicationSettings.mainLogo,
    configuredLogo
  );
  assert.equal(
    configuredSettingsPayload.applicationSettings.themeName,
    "Sekundar"
  );
  assert.equal(
    configuredSettingsPayload.applicationSettings.introHtml,
    configuredIntroHtml
  );
  assert.equal(
    configuredSettingsPayload.applicationSettings.legalNoticeHtml,
    configuredLegalNoticeHtml
  );
  assert.equal(
    configuredSettingsPayload.applicationSettings.privacyNotice,
    configuredPrivacyNotice
  );
  assert.equal(
    configuredSettingsPayload.applicationSettings.accessibilityNotice,
    configuredAccessibilityNotice
  );
  assert.deepEqual(configuredSettingsPayload.applicationSettings.customTexts, {
    gm_menu_filter: "UI Global Hidden Sessions",
    login_subtitle: "UI Global Selection",
    login_testResumeButtonLabel: "UI Global Resume"
  });
  assert.deepEqual(
    configuredSettingsPayload.applicationSettings.assetAssignments,
    { loginIllustration: "ui-login-illustration.png" }
  );
  const configuredApplicationAssetResponse = await fetch(
    `${baseUrl}/api/v1/system/application-assets?originalName=ui-login-illustration.png`
  );
  assert.equal(configuredApplicationAssetResponse.status, 200);
  assert.equal(
    configuredApplicationAssetResponse.headers.get("content-type"),
    "image/png"
  );
  assert.equal(
    configuredSettingsPayload.applicationSettings.globalWarningText,
    "UI smoke planned maintenance warning"
  );
  assert.match(
    configuredSettingsPayload.applicationSettings.globalWarningExpiresAt,
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:00\.000Z$/
  );

  const customTextTenantKey = "ui-custom-text-tenant";
  const customTextWorkspaceKey = "ui-custom-text-workspace";
  const customTextBookletKey = "BOOKLET.UI-CUSTOM-TEXT";
  const customTextUnitKey = "UNIT.UI-CUSTOM-TEXT";
  await sendSmokeJson(`${baseUrl}/api/v1/platform/tenants`, {
    body: {
      tenantKey: customTextTenantKey,
      displayName: "UI Custom Text Tenant"
    }
  });
  await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${customTextTenantKey}/workspaces`,
    {
      body: {
        workspaceKey: customTextWorkspaceKey,
        displayName: "UI Custom Text Workspace"
      }
    }
  );
  const customTextArchive = createStoredZipBuffer([
    {
      fileName: "export/imsmanifest.xml",
      content: `<manifest><resources><resource identifier="${customTextBookletKey}" href="booklets/Booklet.xml" /><resource identifier="${customTextUnitKey}" href="units/Unit.xml" /></resources></manifest>`
    },
    {
      fileName: "export/booklets/Booklet.xml",
      content: `<Booklet><Metadata><Id>${customTextBookletKey}</Id><Label>UI Custom Text Booklet</Label></Metadata><CustomTexts><CustomText key="login_testResumeButtonLabel">UI Booklet Resume</CustomText><CustomText key="login_testEndButtonLabel">UI Booklet Complete</CustomText></CustomTexts><Units><Unit id="${customTextUnitKey}" alias="ui-custom-text-unit" label="UI Custom Text Unit" /></Units></Booklet>`
    },
    {
      fileName: "export/units/Unit.xml",
      content: `<Unit><Metadata><Id>${customTextUnitKey}</Id><Label>UI Custom Text Unit</Label></Metadata></Unit>`
    }
  ]);
  const customTextSourceResponse = await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${customTextTenantKey}/workspaces/${customTextWorkspaceKey}/source-packages`,
    {
      body: {
        fileName: "ui-custom-text-export.zip",
        mediaType: "application/zip",
        sourceDocument: `data:application/zip;base64,${customTextArchive.toString("base64")}`
      }
    }
  );
  const customTextSourcePayload = await customTextSourceResponse.json();
  const customTextImportResponse = await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${customTextTenantKey}/workspaces/${customTextWorkspaceKey}/import-jobs`,
    {
      body: {
        sourcePackageId: customTextSourcePayload.sourcePackage.sourcePackageId
      }
    }
  );
  const customTextImportPayload = await customTextImportResponse.json();
  await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${customTextTenantKey}/workspaces/${customTextWorkspaceKey}/content-releases/${customTextImportPayload.stagedContentRelease.contentReleaseId}/activate`,
    { body: { activatedByActorId: "ui-custom-text-smoke" } }
  );
  await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${customTextTenantKey}/workspaces/${customTextWorkspaceKey}/participant-roster`,
    {
      body: {
        rosterText: [
          "<Testtakers>",
          "  <CustomTexts><CustomText key=\"login_subtitle\">UI Workspace Selection</CustomText><CustomText key=\"login_testResumeButtonLabel\">UI Workspace Resume</CustomText></CustomTexts>",
          `  <Group id="ui-custom-text-group"><Login mode="run-hot-return" name="ui-custom-text-login"><Booklet>${customTextBookletKey}</Booklet></Login></Group>`,
          "</Testtakers>"
        ].join("\n")
      }
    }
  );

  const brandedParticipantPage = await context.newPage();
  await brandedParticipantPage.goto(`${baseUrl}/app/participant`, {
    waitUntil: "networkidle"
  });
  await brandedParticipantPage.waitForFunction(
    expected => {
      const image = document.querySelector("#applicationLogo");
      return (
        document.documentElement.dataset["applicationTheme"] === "Sekundar" &&
        getComputedStyle(document.documentElement)
          .getPropertyValue("--secondary")
          .trim()
          .toLowerCase() === "#0b2d84" &&
        image instanceof HTMLImageElement &&
        image.src === expected
      );
    },
    configuredLogo
  );
  await brandedParticipantPage
    .locator("#participantCustomLoginSubtitle")
    .filter({ hasText: "UI Global Selection" })
    .waitFor();
  await brandedParticipantPage.waitForFunction(() => {
    const image = document.querySelector("#participantLoginIllustration");
    return (
      image instanceof HTMLImageElement &&
      image.complete &&
      image.naturalWidth > 0 &&
      image.src.includes(
        "/api/v1/system/application-assets?originalName=ui-login-illustration.png"
      )
    );
  });
  await brandedParticipantPage
    .locator("#applicationIntroContent p")
    .filter({ hasText: "Welcome to the UI smoke assessment." })
    .waitFor();
  assert.equal(
    await brandedParticipantPage
      .locator('#applicationIntroContent img[src="missing-intro.png"]')
      .getAttribute("onerror"),
    null,
    "Configured intro HTML must pass through Angular sanitization."
  );
  assert.equal(
    await brandedParticipantPage.evaluate(
      () => document.body.dataset["introUnsafe"] ?? null
    ),
    null
  );
  await brandedParticipantPage.locator("#applicationLegalNoticeLink").click();
  await brandedParticipantPage.waitForURL(/\/app\/legal-notice$/);
  await brandedParticipantPage
    .locator("#applicationLegalNoticeContent h3")
    .filter({ hasText: "UI Smoke Provider" })
    .waitFor();
  assert.equal(
    await brandedParticipantPage
      .locator(
        '#applicationLegalNoticeContent a[href="mailto:provider@example.test"]'
      )
      .getAttribute("onclick"),
    null,
    "Configured legal HTML must pass through Angular sanitization."
  );
  await brandedParticipantPage
    .getByRole("link", { name: "Back to participant entry" })
    .click();
  await brandedParticipantPage.waitForURL(/\/app\/participant$/);
  await brandedParticipantPage.locator("#applicationPrivacyNoticeLink").click();
  await brandedParticipantPage.waitForURL(/\/app\/privacy$/);
  await brandedParticipantPage
    .locator("#applicationPrivacyNoticeContent h3")
    .filter({ hasText: "UI Smoke Privacy" })
    .waitFor();
  assert.equal(
    await brandedParticipantPage
      .locator(
        '#applicationPrivacyNoticeContent a[href="mailto:privacy@example.test"]'
      )
      .getAttribute("onclick"),
    null,
    "Configured privacy HTML must pass through Angular sanitization."
  );
  await brandedParticipantPage
    .getByRole("link", { name: "Back to participant entry" })
    .click();
  await brandedParticipantPage.waitForURL(/\/app\/participant$/);
  await brandedParticipantPage
    .locator("#applicationAccessibilityNoticeLink")
    .click();
  await brandedParticipantPage.waitForURL(/\/app\/accessibility$/);
  await brandedParticipantPage
    .locator("#applicationAccessibilityNoticeContent h3")
    .filter({ hasText: "UI Smoke Accessibility" })
    .waitFor();
  assert.equal(
    await brandedParticipantPage
      .locator(
        '#applicationAccessibilityNoticeContent a[href="mailto:accessibility@example.test"]'
      )
      .getAttribute("onclick"),
    null,
    "Configured accessibility HTML must pass through Angular sanitization."
  );
  await brandedParticipantPage
    .getByRole("link", { name: "Back to participant entry" })
    .click();
  await brandedParticipantPage.waitForURL(/\/app\/participant$/);
  await brandedParticipantPage
    .locator("#participantRouteStartOrResumeButton")
    .filter({ hasText: "UI Global Resume" })
    .waitFor();
  await brandedParticipantPage
    .locator("#participantTenantKey")
    .fill(customTextTenantKey);
  await brandedParticipantPage
    .locator("#participantWorkspaceKey")
    .fill(customTextWorkspaceKey);
  await brandedParticipantPage
    .locator("#participantLoginKey")
    .fill("ui-custom-text-login");
  await brandedParticipantPage.locator("#participantRouteSignInButton").click();
  await brandedParticipantPage.waitForFunction(() => {
    const sessionId = document.querySelector("#participantRouteSessionId");
    return sessionId instanceof HTMLInputElement && sessionId.value.length > 0;
  });
  await brandedParticipantPage
    .locator("#participantCustomLoginSubtitle")
    .filter({ hasText: "UI Workspace Selection" })
    .waitFor();
  await brandedParticipantPage
    .locator("#participantRouteCompleteButton")
    .filter({ hasText: "UI Booklet Complete" })
    .waitFor();
  await brandedParticipantPage
    .locator("#participantRouteEntry")
    .waitFor({ state: "detached" });
  assert.equal(
    await brandedParticipantPage.locator("#participantRouteEntry").count(),
    0,
    "A running test must replace the Participant entry surface."
  );
  await brandedParticipantPage.close();

  await fillAndCommit(
    "#applicationWarningExpiresAtInput",
    "2000-01-01T00:00"
  );
  await clickAction("Save Application Settings");
  await page.locator("#globalApplicationWarning").waitFor({ state: "detached" });

  await fillAndCommit("#applicationTitleInput", "IQB-Testcenter");
  await fillAndCommit("#applicationIntroHtmlInput", "");
  await fillAndCommit("#applicationLegalNoticeHtmlInput", "");
  await fillAndCommit("#applicationPrivacyNoticeInput", "");
  await fillAndCommit("#applicationAccessibilityNoticeInput", "");
  await page.locator("#applicationThemeSelect").selectOption({ label: "Primar" });
  await page.locator("#resetApplicationLogoButton").click();
  await page.locator("#resetApplicationCustomTextsButton").click();
  await page
    .locator("#applicationAssetSlot-loginIllustration")
    .selectOption("");
  await fillAndCommit("#applicationWarningTextInput", "");
  await fillAndCommit("#applicationWarningExpiresAtInput", "");
  await clickAction("Save Application Settings");
  await page.waitForFunction(() => document.title === "IQB-Testcenter");
  await page.waitForFunction(
    () => document.documentElement.dataset["applicationTheme"] === "Primar"
  );
  await page.waitForFunction(() => {
    const image = document.querySelector("#applicationLogo");
    return (
      image instanceof HTMLImageElement &&
      image.complete &&
      image.naturalWidth > 0 &&
      image.src.endsWith("/app/assets/images/IQB-Logo-2025.png")
    );
  });
  const fallbackParticipantPage = await context.newPage();
  await fallbackParticipantPage.goto(`${baseUrl}/app/participant`, {
    waitUntil: "networkidle"
  });
  await fallbackParticipantPage.waitForFunction(() => {
    const image = document.querySelector("#participantLoginIllustration");
    return (
      image instanceof HTMLImageElement &&
      image.complete &&
      image.naturalWidth > 0 &&
      image.src.endsWith("/app/assets/images/login-illustration.png")
    );
  });
  await fallbackParticipantPage.close();
  const settingsAuditResponse = await fetch(
    `${baseUrl}/api/v1/admin/audit-events?eventType=application_settings_updated`,
    {
      headers: {
        authorization: `Bearer ${smokeAdminSessionToken}`
      }
    }
  );
  assert.equal(settingsAuditResponse.status, 200);
  const settingsAuditPayload = await settingsAuditResponse.json();
  assert.equal(settingsAuditPayload.items.length, 3);
  assert.equal(settingsAuditPayload.items[0].eventType, "application_settings_updated");
  await fillAndCommit(
    "#applicationCustomText-gm_menu_filter",
    "UI Global Hidden Sessions"
  );
  await clickAction("Save Application Settings");
  const monitorGlobalTextResponse = await fetch(
    `${baseUrl}/api/v1/system/application-settings`
  );
  assert.equal(monitorGlobalTextResponse.status, 200);
  assert.equal(
    (await monitorGlobalTextResponse.json()).applicationSettings.customTexts
      .gm_menu_filter,
    "UI Global Hidden Sessions"
  );
  logStep("superadmin-navigation");
  await page.locator("#administrationWorkspacesTab").click();
  await page.waitForURL(/\/app\/workspace$/);
  await page.locator("#administrationWorkspacesTab").waitFor();
  await page.waitForFunction(
    () =>
      document
        .querySelector("#administrationWorkspacesTab")
        ?.getAttribute("aria-current") === "page"
  );
  assert.equal(
    await page
      .locator("#administrationWorkspacesTab")
      .getAttribute("aria-current"),
    "page"
  );
  await page.getByRole("heading", { name: "Workspace Setup" }).waitFor();
  await page.locator("#administrationUsersTab").click();
  await page.waitForURL(/\/app\/ops\?adminSection=users$/);
  await page.getByRole("heading", { name: "Admin User Management" }).waitFor();
  await page.waitForFunction(
    () =>
      document
        .querySelector("#administrationUsersTab")
        ?.getAttribute("aria-current") === "page"
  );
  assert.equal(await page.locator("#applicationSettingsCard").count(), 0);
  assert.equal(
    await page.locator("#administrationUsersTab").getAttribute("aria-current"),
    "page"
  );
  stopAfter("application-settings");
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
  await signOutAdmin();
  for (const signedOutSelector of [
    "#adminCurrentSessionButton",
    "#adminSessionsButton",
    "#adminUsersButton",
    "#adminAuditEventsButton",
    "#adminSignOutButton"
  ]) {
    assert.equal(await page.locator(signedOutSelector).count(), 0);
  }
  assert.equal(await page.locator("#applyAdminSessionFiltersButton").count(), 0);
  assert.equal(await page.locator("#applyAdminUserFiltersButton").count(), 0);
  assert.equal(await page.locator("#applyAdminAuditFiltersButton").count(), 0);
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
  const revokeAdminSessionDialog = acceptAppConfirmation(
    /Revoke admin session\?/,
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

  if (stopAfterStep === "attachment-manager") {
    await runAttachmentManagerSmoke();
  }

  if (stopAfterStep === "" || stopAfterStep === "system-check-report") {
    logStep("system-check-report");
    const systemCheckTenantKey = `${tenantKey}-system-check`;
    const systemCheckWorkspaceKey = `${workspaceKey}-system-check`;
    const systemCheckBrowserTimeZone = await page.evaluate(
      () => Intl.DateTimeFormat().resolvedOptions().timeZone || "unknown"
    );
    const systemCheckServerTimeZone =
      systemCheckBrowserTimeZone === "Pacific/Kiritimati"
        ? "America/Adak"
        : "Pacific/Kiritimati";
    const systemTimeRoute = "**/api/v1/system/time";
    await page.route(systemTimeRoute, route =>
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          timestamp: Date.now() - 120_000,
          timezone: systemCheckServerTimeZone
        })
      })
    );
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
    ))
      .replace(
        '    <Q id="1"',
        '    <CustomText key="syscheck_intro">UI smoke readiness introduction</CustomText>\n    <CustomText key="login_pagesNaviPrompt">UI system-check pages:</CustomText>\n\n    <Q id="1"'
      )
      .replace(
        '<Q id="1" type="header" prompt="Beispielüberschrift"/>',
        '<Q id="1" type="header" prompt="Fallback heading">UI authored heading</Q>'
      );
    const systemCheckUnitDocument = (await readFile(
      resolve("test-fixtures/original-testcenter/units/Unit2.xml"),
      "utf8"
    ))
      .replace("<Id>UNIT.SAMPLE-2</Id>", "<Id>UNIT.SAMPLE</Id>")
      .replace(
        "<![CDATA[\n    <div",
        "<![CDATA[\n    <fieldset><legend>System-check task</legend>\n    <div"
      )
      .replace(
        "    </div>\n  ]]></Definition>",
        "    </div>\n    </fieldset>\n  ]]></Definition>"
      );
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
    await page.evaluate(() => {
      Object.defineProperties(window.screen, {
        width: { configurable: true, value: 799 },
        height: { configurable: true, value: 599 }
      });
      Object.defineProperties(window.navigator, {
        userAgent: {
          configurable: true,
          value:
            "Mozilla/5.0 (Linux; Android 13; SM-S918B Build/TP1A.220624.014; arm64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.6099.43 Mobile Safari/537.36"
        },
        plugins: {
          configurable: true,
          value: [{ name: "Smoke PDF Viewer" }]
        }
      });
    });
    await page.locator("[data-system-check-id='SYSCHECK.SAMPLE']").click();
    await page.getByRole("heading", { name: "System-Check Beispiel" }).waitFor();
    await page
      .locator("#systemCheckIntroText")
      .filter({ hasText: "UI smoke readiness introduction" })
      .waitFor();
    await page.locator("#systemCheckNextButton").click();
    await page.getByRole("heading", { name: "Environment" }).waitFor();
    const timeDifferenceEntry = page.locator(
      "#systemCheckEnvironment-time-difference"
    );
    await timeDifferenceEntry.waitFor();
    assert.equal(await timeDifferenceEntry.evaluate(node =>
      node.classList.contains("has-warning")
    ), true);
    assert.equal(
      Number.parseInt(
        (await timeDifferenceEntry.locator("dd").textContent())?.trim() ?? "",
        10
      ) >= 119,
      true
    );
    const timeZoneEntry = page.locator("#systemCheckEnvironment-time-zone");
    await timeZoneEntry.filter({ hasText: systemCheckBrowserTimeZone }).waitFor();
    assert.equal(await timeZoneEntry.evaluate(node =>
      node.classList.contains("has-warning")
    ), true);
    const screenResolutionEntry = page.locator(
      "#systemCheckEnvironment-screen-resolution"
    );
    await screenResolutionEntry.filter({ hasText: "799 x 599" }).waitFor();
    assert.equal(await screenResolutionEntry.evaluate(node =>
      node.classList.contains("has-warning")
    ), true);
    for (const [id, expectedValue] of [
      ["CPU-Architektur", "arm64"],
      ["Gerätemodell", "SM-S918B"],
      ["Gerätetyp", "mobile"],
      ["Gerätehersteller", "Samsung"],
      ["Browser", "Chrome"],
      ["Browser-Version", "120"],
      ["Betriebsystem", "Android"],
      ["Betriebsystem-Version", "13"],
      ["browser-plugins", "Smoke PDF Viewer"]
    ]) {
      await page
        .locator(`#systemCheckEnvironment-${id}`)
        .filter({ hasText: expectedValue })
        .waitFor();
    }
    for (const id of [
      "cookieEnabled",
      "language",
      "hardwareConcurrency"
    ]) {
      await page.locator(`#systemCheckEnvironment-${id}`).waitFor();
    }
    await page.evaluate(() => {
      delete window.screen.width;
      delete window.screen.height;
      delete window.navigator.userAgent;
      delete window.navigator.plugins;
    });
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
    await page
      .getByRole("heading", { name: "UI authored heading", exact: true })
      .waitFor();
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
    await fillVeronaAnswerAndWaitForHost(
      systemCheckPlayerFrame,
      "#var1",
      "System check answer"
    );
    await page
      .locator("#participantVeronaPlayerStatus")
      .filter({ hasText: "running" })
      .waitFor({ timeout: 15_000 });
    await page
      .locator("#participantVeronaPageNavigationPrompt")
      .filter({ hasText: "UI system-check pages:" })
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
      .filter({ hasText: "SM-S918B" })
      .filter({ hasText: "Smoke PDF Viewer" })
      .waitFor({ timeout: 15_000 });
    await expectButtonSelectorEnabled("#exportSystemCheckReportsButton");
    const systemCheckReportDownloadPromise = page.waitForEvent("download");
    await page.locator("#exportSystemCheckReportsButton").click();
    const systemCheckReportDownload = await systemCheckReportDownloadPromise;
    assert.equal(
      systemCheckReportDownload.suggestedFilename(),
      `${systemCheckWorkspaceKey}-system-check-reports.csv`
    );
    const systemCheckReportCsvPath = await systemCheckReportDownload.path();
    assert.ok(
      systemCheckReportCsvPath,
      "UI smoke expected a temporary path for the system-check CSV export."
    );
    const systemCheckReportCsv = await readFile(
      systemCheckReportCsvPath,
      "utf8"
    );
    for (const expectedValue of [
      '"Browser-Version"',
      '"CPU-Architektur"',
      '"SM-S918B"',
      '"Smoke PDF Viewer"'
    ]) {
      assert.match(systemCheckReportCsv, new RegExp(expectedValue));
    }
    await expectButtonSelectorEnabled("#importSystemCheckReportButton");
    await expectButtonSelectorEnabled("#importSystemCheckReportDirectoryButton");
    const originalSystemCheckReportPath = resolve(
      "test-fixtures/original-testcenter/system-checks/SysCheck-Report.json"
    );
    await page.locator("#legacySystemCheckReportInput").setInputFiles(
      originalSystemCheckReportPath
    );
    await page
      .locator("#systemCheckReportOperatorStatus")
      .filter({ hasText: "1 imported, 0 already present, 0 failed." })
      .waitFor({ timeout: 15_000 });
    await page
      .locator(".system-check-report-detail")
      .filter({ hasText: "SAMPLE SYS-CHECK REPORT" })
      .filter({ hasText: "Original file: SysCheck-Report.json" })
      .filter({ hasText: "Linux" })
      .waitFor({ timeout: 15_000 });
    const originalSystemCheckReportText = await readFile(
      originalSystemCheckReportPath,
      "utf8"
    );
    const secondLegacySystemCheckReport = {
      ...JSON.parse(originalSystemCheckReportText),
      checkId: "syscheck-2",
      checkLabel: "System-Check-2",
      title: "MIGRATED SYSTEM-CHECK-2 REPORT"
    };
    await page.locator("#legacySystemCheckReportInput").setInputFiles([
      {
        name: "SysCheck-Report.json",
        mimeType: "application/json",
        buffer: Buffer.from(originalSystemCheckReportText, "utf8")
      },
      {
        name: "SysCheck-2-Report.json",
        mimeType: "application/json",
        buffer: Buffer.from(
          `${JSON.stringify(secondLegacySystemCheckReport, null, 2)}\n`,
          "utf8"
        )
      },
      {
        name: "broken-report.json",
        mimeType: "application/json",
        buffer: Buffer.from("{", "utf8")
      },
      {
        name: "missing-check-report.json",
        mimeType: "application/json",
        buffer: Buffer.from(
          JSON.stringify({
            ...secondLegacySystemCheckReport,
            checkId: "missing-check"
          }),
          "utf8"
        )
      }
    ]);
    await page
      .locator("#systemCheckReportOperatorStatus")
      .filter({ hasText: "1 imported, 1 already present, 2 failed." })
      .waitFor({ timeout: 15_000 });
    await page
      .locator("#systemCheckReportImportFailures")
      .filter({ hasText: "broken-report.json: invalid JSON." })
      .filter({ hasText: "missing-check-report.json: system_check_not_found" })
      .waitFor({ timeout: 15_000 });
    await expectButtonSelectorEnabled("#exportSystemCheckReportsJsonButton");
    const systemCheckReportJsonDownloadPromise = page.waitForEvent("download");
    await page.locator("#exportSystemCheckReportsJsonButton").click();
    const systemCheckReportJsonDownload =
      await systemCheckReportJsonDownloadPromise;
    assert.equal(
      systemCheckReportJsonDownload.suggestedFilename(),
      `${systemCheckWorkspaceKey}-system-check-reports.json`
    );
    const systemCheckReportJsonPath = resolve(
      ".data",
      `${systemCheckWorkspaceKey}-system-check-reports.json`
    );
    await systemCheckReportJsonDownload.saveAs(systemCheckReportJsonPath);
    const exportedSystemCheckReports = JSON.parse(
      await readFile(systemCheckReportJsonPath, "utf8")
    );
    assert.equal(exportedSystemCheckReports.length, 2);
    assert.ok(
      exportedSystemCheckReports.some(
        report =>
          report.date === "2020-02-17 13:01:31" &&
          report.fileData?.some(
            entry =>
              entry.label === "FileName" &&
              entry.value === "SysCheck-Report.json"
          )
      ),
      "UI smoke expected the migrated original report in the JSON export."
    );
    await page
      .locator(".system-check-statistics")
      .filter({ hasText: "Chrome" })
      .filter({ hasText: "good" })
      .waitFor();
    await page
      .getByLabel("Select reports for SYSCHECK.SAMPLE", { exact: true })
      .check();
    await expectButtonSelectorEnabled("#deleteSystemCheckReportsButton");
    const deleteSampleReportsDialog = acceptVerifiedAppConfirmation(
      /Delete system-check reports\?/,
      /Delete all reports for SYSCHECK\.SAMPLE\? This cannot be undone\./,
      systemCheckWorkspaceKey
    );
    await page.locator("#deleteSystemCheckReportsButton").click();
    await deleteSampleReportsDialog;
    await page
      .locator("#systemCheckReportOperatorStatus")
      .filter({ hasText: "2 report(s) deleted." })
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
    await fillVeronaAnswerAndWaitForHost(
      secondSystemCheckPlayerFrame,
      "#var1",
      "Second system check answer"
    );
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
    const secondSystemCheckReportDetail = page.locator(
      ".system-check-report-detail"
    );
    await secondSystemCheckReportDetail.waitFor({ timeout: 30_000 });
    const secondSystemCheckReportText =
      (await secondSystemCheckReportDetail.textContent()) ?? "";
    for (const expectedText of [
      "UI Smoke System Check 2",
      "Test-Input1",
      "Option A",
      "Test-Input2",
      "true",
      "Option B",
      "Second system check answer"
    ]) {
      assert.ok(
        secondSystemCheckReportText.includes(expectedText),
        `System-check report detail must include ${expectedText}. Actual detail: ${secondSystemCheckReportText}`
      );
    }
    await page
      .locator(".system-check-statistics")
      .filter({ hasText: "System-Check-2" })
      .filter({ hasText: "Chrome" })
      .filter({ hasText: "unknown" })
      .waitFor();
    await page
      .getByLabel("Select reports for syscheck-2", { exact: true })
      .check();
    await expectButtonSelectorEnabled("#deleteSystemCheckReportsButton");
    const deleteSecondCheckReportsDialog = acceptVerifiedAppConfirmation(
      /Delete system-check reports\?/,
      /Delete all reports for syscheck-2\? This cannot be undone\./,
      systemCheckWorkspaceKey
    );
    await page.locator("#deleteSystemCheckReportsButton").click();
    await deleteSecondCheckReportsDialog;
    await page
      .locator("#systemCheckReportOperatorStatus")
      .filter({ hasText: "2 report(s) deleted." })
      .waitFor({ timeout: 15_000 });
    await page.unroute(systemTimeRoute);
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
  const expectedTenantDirectoryCount = stopAfterStep ? 2 : 3;
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
    .filter({ hasText: "Latest File Modification" })
    .waitFor();
  await page
    .locator("#workspaceDirectorySortBy")
    .selectOption("latestFileModificationAt");
  await page.locator("#workspaceDirectorySortDirection").selectOption("desc");
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Workspace Directory", exact: true })
    })
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: "Workspace directory window" }) })
    .filter({ hasText: "Latest file modification · desc" })
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
      hasText:
        "tenantKey,workspaceKey,displayName,status,workspaceId,createdAt,latestFileModificationAt"
    })
    .filter({ hasText: workspaceKey })
    .waitFor();
  stopAfter("workspace-directory-reads");

  if (!skipWorkspaceRename) {
    logStep("workspace-rename");
    const renamedWorkspaceDisplayName = `Renamed Workspace ${Date.now()}`;
    await fillAndCommit("#workspaceDisplayNameInput", renamedWorkspaceDisplayName);
    await expectButtonSelectorEnabled("#renameWorkspaceButton");
    await clickAction("Rename Workspace");
    await pollJsonWithPredicate(
      `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}`,
      payload =>
        payload?.workspaceOverview?.workspace?.workspaceKey === workspaceKey &&
        payload.workspaceOverview.workspace.displayName === renamedWorkspaceDisplayName
    );
    await page
      .locator("article.card")
      .filter({
        has: page.getByRole("heading", { name: "Workspace Directory", exact: true })
      })
      .locator(".record-card")
      .filter({
        has: page.getByRole("heading", {
          name: renamedWorkspaceDisplayName,
          exact: true
        })
      })
      .filter({ hasText: workspaceKey })
      .waitFor();
    await pollJsonWithPredicate(
      `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/activity-events?eventType=workspace_updated`,
      payload =>
        Array.isArray(payload?.items) &&
        payload.items.some(
          item =>
            item?.activityEvent?.eventType === "workspace_updated" &&
            item.activityEvent?.details?.nextDisplayName === renamedWorkspaceDisplayName
        )
    );
    await page.reload({ waitUntil: "networkidle" });
    await waitForNotBusy("workspace-rename-reload");
    await clickAction("Refresh Workspace Directory");
    await page
      .locator("article.card")
      .filter({
        has: page.getByRole("heading", { name: "Workspace Directory", exact: true })
      })
      .filter({ hasText: renamedWorkspaceDisplayName })
      .filter({ hasText: workspaceKey })
      .waitFor();
    stopAfter("workspace-rename");

    logStep("workspace-delete");
    const disposableWorkspaceKey = `ui-delete-${Date.now()}`;
    const disposableWorkspaceDisplayName = "Disposable Workspace";
    await sendSmokeJson(
      `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces`,
      {
        body: {
          workspaceKey: disposableWorkspaceKey,
          displayName: disposableWorkspaceDisplayName
        }
      }
    );
    await sendSmokeJson(
      `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${disposableWorkspaceKey}/source-packages`,
      {
        body: {
          fileName: "disposable-workspace.json",
          mediaType: "application/json",
          contentStructure: { bookletEntries: [] },
          sourceDocument: '{"booklets":[]}'
        }
      }
    );
    await clickAction("Refresh Workspace Directory");
    await clickCardAction(
      "Workspace Directory",
      "Use Workspace",
      disposableWorkspaceDisplayName
    );
    await page.waitForFunction(
      expectedWorkspaceKey =>
        document.querySelector("#workspaceKey")?.value === expectedWorkspaceKey,
      disposableWorkspaceKey
    );
    await expectButtonSelectorEnabled("#deleteWorkspaceButton");
    await page.locator("#deleteWorkspaceButton").click();
    const cancelledDeleteWorkspaceBackdrop = await waitForAppConfirmation(
      /Permanently delete workspace\?/,
      new RegExp(
        `Permanently delete '${tenantKey}/${disposableWorkspaceKey}'.+This cannot be undone\\.`
      )
    );
    const workspaceVerificationInput = page.locator(
      "#globalConfirmationVerificationInput"
    );
    assert.equal(
      await workspaceVerificationInput.evaluate(
        element => element === document.activeElement
      ),
      true,
      "Exact-text confirmations must focus the verification field."
    );
    await workspaceVerificationInput.fill(`${disposableWorkspaceKey}-wrong`);
    await expectButtonSelectorDisabled("#globalConfirmationConfirmButton");
    const cancelledWorkspaceDeleteRequest = page
      .waitForRequest(
        request =>
          request.method() === "DELETE" &&
          request.url().endsWith(
            `/tenants/${tenantKey}/workspaces/${disposableWorkspaceKey}`
          ),
        { timeout: 750 }
      )
      .then(() => true)
      .catch(() => false);
    await page.keyboard.press("Escape");
    await cancelledDeleteWorkspaceBackdrop.waitFor({ state: "detached" });
    await page.waitForFunction(
      () => document.activeElement?.id === "deleteWorkspaceButton"
    );
    assert.equal(
      await cancelledWorkspaceDeleteRequest,
      false,
      "Cancelling an exact-text confirmation must not delete the workspace."
    );
    const deleteDialog = acceptVerifiedAppConfirmation(
      /Permanently delete workspace\?/,
      new RegExp(
        `Permanently delete '${tenantKey}/${disposableWorkspaceKey}'.+This cannot be undone\\.`
      ),
      disposableWorkspaceKey
    );
    await page.locator("#deleteWorkspaceButton").click();
    await deleteDialog;
    await pollJsonWithPredicate(
      `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces`,
      payload =>
        Array.isArray(payload?.items) &&
        !payload.items.some(
          workspace => workspace?.workspaceKey === disposableWorkspaceKey
        )
    );
    await pollJsonWithPredicate(
      `${baseUrl}/api/v1/admin/audit-events?eventType=workspace_deleted`,
      payload =>
        Array.isArray(payload?.items) &&
        payload.items.some(
          event =>
            event?.eventType === "workspace_deleted" &&
            event?.details?.workspaceKey === disposableWorkspaceKey
        )
    );
    await page
      .locator("article.card")
      .filter({
        has: page.getByRole("heading", { name: "Workspace Directory", exact: true })
      })
      .filter({ hasNotText: disposableWorkspaceKey })
      .waitFor();
    await clickCardAction(
      "Workspace Directory",
      "Use Workspace",
      renamedWorkspaceDisplayName
    );
    await page.waitForFunction(
      expectedWorkspaceKey =>
        document.querySelector("#workspaceKey")?.value === expectedWorkspaceKey,
      workspaceKey
    );
    stopAfter("workspace-delete");
  }

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
  await fillAndCommit("#adminResetPasswordConfirmation", "");
  await fillAndCommit("#adminStatusTargetUserId", "");
  await fillAndCommit("#adminDisplayNameTargetUserId", "");
  await fillAndCommit("#adminDisplayNameUpdateDraft", "");
  await fillAndCommit("#adminAccessWindowTargetUserId", "");
  await fillAndCommit("#adminAccessWindowValidFrom", "");
  await fillAndCommit("#adminAccessWindowValidTo", "");
  await fillAndCommit("#adminAccessWindowValidForMinutes", "");
  await fillAndCommit("#adminCustomTextsTargetUserId", "");
  await fillAndCommit("#adminCustomTextsUpdateDraft", "{}");
  await selectAndCommit("#adminUserAccessStatusFilter", "");
  await selectAndCommit("#adminUserPasswordChangeFilter", "");
  assert.equal(
    await page.locator("#adminCreatePassword").getAttribute("minlength"),
    "8"
  );
  assert.equal(
    await page.locator("#adminCreatePassword").getAttribute("maxlength"),
    "60"
  );
  assert.equal(
    await page.locator("#adminResetPassword").getAttribute("minlength"),
    "8"
  );
  assert.equal(
    await page.locator("#adminResetPassword").getAttribute("maxlength"),
    "60"
  );
  assert.equal(
    await page
      .locator("#adminResetPasswordConfirmation")
      .getAttribute("minlength"),
    "8"
  );
  assert.equal(
    await page
      .locator("#adminResetPasswordConfirmation")
      .getAttribute("maxlength"),
    "60"
  );
  await expectButtonSelectorDisabled("#adminCreateUserButton");
  await expectButtonSelectorDisabled("#adminAssignRoleButton");
  await expectButtonSelectorDisabled("#adminRevokeRoleButton");
  await expectButtonSelectorDisabled("#adminResetPasswordButton");
  await expectButtonSelectorDisabled("#adminUpdateStatusButton");
  const generatedWorkspaceAdminUsername = `ui-workspace-admin-${Date.now()}`;
  const workspaceAdminPassword = "ui-workspace-admin-secret";
  const workspaceAdminResetPassword = "ui-workspace-admin-reset-secret";
  const workspaceAdminFinalPassword = "ui-workspace-admin-final-secret";
  const workspaceAdminVoluntaryPassword =
    "ui-workspace-admin-voluntary-secret";
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
    .filter({ hasText: "password handoff pending" })
    .filter({ hasText: "Required before administration" })
    .filter({ hasText: "workspace_admin" })
    .filter({ hasText: "read_only" })
    .waitFor();
  await expectInputValue("#workspaceAdminMatrixTenantKey", tenantKey);
  await expectInputValue("#workspaceAdminMatrixWorkspaceKey", workspaceKey);
  await page.locator("#refreshWorkspaceAdminAccessMatrixButton").click();
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", {
        name: "Workspace Admin Access",
        exact: true
      })
    })
    .locator(".record-card")
    .filter({ hasText: workspaceAdminUsername })
    .filter({ hasText: "Read only (RO)" })
    .filter({ hasText: "workspace role" })
    .waitFor();
  logStep("workspace-admin-access-matrix-read-write");
  await clickCardAction(
    "Workspace Admin Access",
    "Set Read Write",
    workspaceAdminUsername
  );
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/admin/users`,
    payload =>
      Array.isArray(payload?.items) &&
      payload.items.some(
        item =>
          item?.adminUser?.adminUserId === workspaceAdminUserId &&
          item.roleAssignments?.some(
            roleAssignment =>
              roleAssignment?.role === "workspace_admin" &&
              roleAssignment?.accessMode === "read_write"
          )
      )
  );
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", {
        name: "Workspace Admin Access",
        exact: true
      })
    })
    .locator(".record-card")
    .filter({ hasText: workspaceAdminUsername })
    .filter({ hasText: "Read and write (RW)" })
    .waitFor();
  logStep("workspace-admin-access-matrix-read-only");
  await clickCardAction(
    "Workspace Admin Access",
    "Set Read Only",
    workspaceAdminUsername
  );
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/admin/users`,
    payload =>
      Array.isArray(payload?.items) &&
      payload.items.some(
        item =>
          item?.adminUser?.adminUserId === workspaceAdminUserId &&
          item.roleAssignments?.some(
            roleAssignment =>
              roleAssignment?.role === "workspace_admin" &&
              roleAssignment?.accessMode === "read_only"
          )
      )
  );

  await expectInputValue("#adminWorkspaceMatrixTenantKey", tenantKey);
  await expectInputValue("#adminWorkspaceMatrixUserId", workspaceAdminUserId);
  await expectButtonSelectorEnabled("#refreshAdminWorkspaceAccessMatrixButton");
  await page.locator("#refreshAdminWorkspaceAccessMatrixButton").click();
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", {
        name: "Admin Workspace Access",
        exact: true
      })
    })
    .locator(".record-card")
    .filter({ hasText: workspaceKey })
    .filter({ hasText: "Read only (RO)" })
    .filter({ hasText: "workspace role" })
    .waitFor();

  logStep("admin-workspace-access-matrix-read-write");
  await clickCardAction("Admin Workspace Access", "Set Read Write");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/admin/users`,
    payload =>
      Array.isArray(payload?.items) &&
      payload.items.some(
        item =>
          item?.adminUser?.adminUserId === workspaceAdminUserId &&
          item.roleAssignments?.some(
            roleAssignment =>
              roleAssignment?.role === "workspace_admin" &&
              roleAssignment?.accessMode === "read_write"
          )
      )
  );
  logStep("admin-workspace-access-matrix-read-only");
  await clickCardAction("Admin Workspace Access", "Set Read Only");
  const adminWorkspaceReadOnlyUsers = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/admin/users`,
    payload =>
      Array.isArray(payload?.items) &&
      payload.items.some(
        item =>
          item?.adminUser?.adminUserId === workspaceAdminUserId &&
          item.roleAssignments?.some(
            roleAssignment =>
              roleAssignment?.role === "workspace_admin" &&
              roleAssignment?.accessMode === "read_only"
          )
      )
  );
  const adminWorkspaceRoleAssignmentId =
    adminWorkspaceReadOnlyUsers.items
      .find(item => item?.adminUser?.adminUserId === workspaceAdminUserId)
      ?.roleAssignments?.find(
        roleAssignment => roleAssignment?.role === "workspace_admin"
      )?.roleAssignmentId;
  assert.ok(
    adminWorkspaceRoleAssignmentId,
    "UI smoke expected a workspace role assignment in the admin-centred matrix."
  );

  logStep("admin-workspace-access-matrix-revoke");
  const revokeAdminWorkspaceAccessDialog = acceptAppConfirmation(
    /Revoke role assignment\?/,
    new RegExp(
      `Revoke role assignment '${adminWorkspaceRoleAssignmentId}' from admin user '${workspaceAdminUserId}'\\?`
    )
  );
  await clickCardAction("Admin Workspace Access", "Revoke Access");
  await revokeAdminWorkspaceAccessDialog;
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/admin/users`,
    payload =>
      Array.isArray(payload?.items) &&
      payload.items.some(
        item =>
          item?.adminUser?.adminUserId === workspaceAdminUserId &&
          !item.roleAssignments?.some(
            roleAssignment => roleAssignment?.role === "workspace_admin"
          )
      )
  );
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", {
        name: "Admin Workspace Access",
        exact: true
      })
    })
    .locator(".record-card")
    .filter({ hasText: workspaceKey })
    .filter({ hasText: "No workspace access" })
    .waitFor();

  logStep("admin-workspace-access-matrix-grant-read-only");
  await clickCardAction("Admin Workspace Access", "Grant Read Only");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/admin/users`,
    payload =>
      Array.isArray(payload?.items) &&
      payload.items.some(
        item =>
          item?.adminUser?.adminUserId === workspaceAdminUserId &&
          item.roleAssignments?.some(
            roleAssignment =>
              roleAssignment?.role === "workspace_admin" &&
              roleAssignment?.accessMode === "read_only"
          )
      )
  );
  stopAfter("admin-workspace-access-matrix");

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
  assert.equal(
    await page.locator("#monitorProfileEditorTarget").inputValue(),
    "role"
  );
  const authoredMonitorProfileId = "room-overview";
  await fillAndCommit("#monitorProfileDraftId", authoredMonitorProfileId);
  await fillAndCommit("#monitorProfileDraftLabel", "Room overview");
  await selectAndCommit("#monitorProfileDraftView", "small");
  await selectAndCommit("#monitorProfileDraftGroupColumn", "show");
  await selectAndCommit("#monitorProfileDraftLocked", "yes");
  await selectAndCommit("#monitorFilterDraftTarget", "groupName");
  await selectAndCommit("#monitorFilterDraftType", "substring");
  await fillAndCommit("#monitorFilterDraftValue", "group:hidden");
  await fillAndCommit("#monitorFilterDraftLabel", "Hide hidden groups");
  await expectButtonSelectorEnabled("#addMonitorProfileFilterButton");
  await page.locator("#addMonitorProfileFilterButton").click();
  await page
    .locator("article.card")
    .filter({ has: page.getByRole("heading", { name: "Profile Draft Filters" }) })
    .filter({ hasText: "Hide hidden groups" })
    .filter({ hasText: "substring group:hidden" })
    .waitFor();
  const attentionStates = [
    "error",
    "connection_lost",
    "focus_lost",
    "idle"
  ];
  await selectAndCommit("#monitorFilterDraftTarget", "state");
  await page.locator("#monitorFilterDraftStates").selectOption(attentionStates);
  await fillAndCommit("#monitorFilterDraftLabel", "Hide attention states");
  await expectButtonSelectorEnabled("#addMonitorProfileFilterButton");
  await page.locator("#addMonitorProfileFilterButton").click();
  await page
    .locator("article.card")
    .filter({ has: page.getByRole("heading", { name: "Profile Draft Filters" }) })
    .filter({ hasText: "Hide attention states" })
    .filter({ hasText: attentionStates.join(", ") })
    .waitFor();
  await expectButtonSelectorEnabled("#saveMonitorProfileButton");
  await page.locator("#saveMonitorProfileButton").click();
  await page
    .locator("article.card")
    .filter({ has: page.getByRole("heading", { name: "Monitor Profile Library" }) })
    .filter({ hasText: "Room overview" })
    .filter({ hasText: "small view" })
    .filter({ hasText: "2 filter(s)" })
    .waitFor();
  const persistedProfileDraft = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("testcenter-rewrite-app-shell") ?? "{}")
  );
  assert.equal(
    JSON.parse(persistedProfileDraft.adminRoleMonitorProfilesJson)[0]?.profileId,
    authoredMonitorProfileId
  );
  assert.deepEqual(
    JSON.parse(persistedProfileDraft.adminRoleMonitorProfilesJson)[0]?.filters[1]
      ?.value,
    attentionStates
  );
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
          item?.roleAssignments?.some(
            roleAssignment =>
              roleAssignment?.role === "group_monitor" &&
              roleAssignment?.groupKey === groupMonitorKey &&
              roleAssignment?.monitorProfiles?.some(
                profile =>
                  profile?.profileId === authoredMonitorProfileId &&
                  profile?.settings?.view === "small" &&
                  profile?.settings?.groupColumn === "show" &&
                  profile?.filtersEnabled?.locked === "yes" &&
                  profile?.filters?.some(
                    filter =>
                      filter?.target === "groupName" &&
                      filter?.type === "substring" &&
                      filter?.value === "group:hidden"
                  ) &&
                  profile?.filters?.some(
                    filter =>
                      filter?.target === "state" &&
                      filter?.type === "equal" &&
                      Array.isArray(filter?.value) &&
                      JSON.stringify(filter.value) === JSON.stringify(attentionStates)
                  )
              )
          )
      )
  );
  await clickCardAction(
    "Admin Role Assignments",
    "Edit Role Scope",
    "group_monitor"
  );
  await clickCardAction(
    "Monitor Profile Library",
    "Edit Profile",
    "Room overview"
  );
  await expectInputValue("#monitorProfileDraftId", authoredMonitorProfileId);
  await expectInputValue("#monitorProfileDraftLabel", "Room overview");
  await expectInputValue("#monitorProfileDraftView", "small");
  await expectInputValue("#monitorProfileDraftLocked", "yes");
  logStep("monitor-profile-authoring");
  stopAfter("monitor-profile-authoring");
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
  await clickCardAction("Admin Role Assignments", "Edit Role Scope", "tenant_admin");
  await expectInputValue("#adminRevokeTargetUserId", workspaceAdminUserId);
  await expectInputValue("#adminRevokeRoleAssignmentId", tenantRoleAssignmentId);
  await expectButtonSelectorEnabled("#adminRevokeRoleButton");
  logStep("revoke-tenant-admin-role");
  const revokeAdminRoleDialog = acceptAppConfirmation(
    /Revoke role assignment\?/,
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

  await selectAndCommit("#adminRoleRole", "platform_admin");
  await page.locator("#adminPlatformRoleConfirmationPassword").waitFor();
  assert.equal(
    await page
      .locator("#adminPlatformRoleConfirmationPassword")
      .getAttribute("maxlength"),
    "60"
  );
  await expectButtonSelectorDisabled("#adminAssignRoleButton");
  const wrongPlatformRoleConfirmation = "wrong-ui-platform-password";
  await fillAndCommit(
    "#adminPlatformRoleConfirmationPassword",
    wrongPlatformRoleConfirmation
  );
  await expectButtonSelectorEnabled("#adminAssignRoleButton");
  const rejectedPlatformRoleResponsePromise = page.waitForResponse(
    response =>
      response.request().method() === "POST" &&
      response.url().endsWith(
        `/api/v1/admin/users/${workspaceAdminUserId}/role-assignments`
      )
  );
  await page.locator("#adminAssignRoleButton").click();
  const rejectedPlatformRoleResponse =
    await rejectedPlatformRoleResponsePromise;
  assert.equal(rejectedPlatformRoleResponse.status(), 403);
  assert.equal(
    (await rejectedPlatformRoleResponse.json()).error,
    "admin_password_confirmation_invalid"
  );
  await expectInputValue(
    "#adminPlatformRoleConfirmationPassword",
    wrongPlatformRoleConfirmation
  );
  const persistedAfterRejectedPlatformRole = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("testcenter-rewrite-app-shell") ?? "{}")
  );
  assert.equal(
    JSON.stringify(persistedAfterRejectedPlatformRole).includes(
      wrongPlatformRoleConfirmation
    ),
    false
  );

  await fillAndCommit("#adminPlatformRoleConfirmationPassword", adminPassword);
  const assignedPlatformRoleResponsePromise = page.waitForResponse(
    response =>
      response.request().method() === "POST" &&
      response.url().endsWith(
        `/api/v1/admin/users/${workspaceAdminUserId}/role-assignments`
      )
  );
  logStep("assign-platform-admin-role-with-step-up");
  await page.locator("#adminAssignRoleButton").click();
  const assignedPlatformRoleResponse = await assignedPlatformRoleResponsePromise;
  assert.equal(assignedPlatformRoleResponse.status(), 200);
  await expectInputValue("#adminPlatformRoleConfirmationPassword", "");
  const adminUsersWithPlatformRole = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/admin/users`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.some(
        item =>
          item?.adminUser?.adminUserId === workspaceAdminUserId &&
          item?.roleAssignments?.some(
            roleAssignment => roleAssignment?.role === "platform_admin"
          )
      )
  );
  const platformRoleAssignmentId = adminUsersWithPlatformRole.items
    .find(item => item?.adminUser?.adminUserId === workspaceAdminUserId)
    ?.roleAssignments.find(
      roleAssignment => roleAssignment?.role === "platform_admin"
    )?.roleAssignmentId;
  assert.ok(
    platformRoleAssignmentId,
    "UI smoke expected the step-up-confirmed platform role assignment."
  );

  const targetPlatformRoleCard = page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", {
        name: "Admin Role Assignments",
        exact: true
      })
    })
    .locator(".record-card")
    .filter({
      has: page.getByRole("heading", { name: "platform_admin", exact: true })
    })
    .filter({ hasText: workspaceAdminUsername })
    .filter({ hasText: platformRoleAssignmentId });
  await targetPlatformRoleCard.waitFor();
  await targetPlatformRoleCard
    .getByRole("button", { name: "Edit Role Scope", exact: true })
    .click();
  await expectInputValue("#adminRevokeTargetUserId", workspaceAdminUserId);
  await expectInputValue(
    "#adminRevokeRoleAssignmentId",
    platformRoleAssignmentId
  );
  await expectButtonSelectorDisabled("#adminRevokeRoleButton");
  await fillAndCommit("#adminPlatformRoleConfirmationPassword", adminPassword);
  await expectButtonSelectorEnabled("#adminRevokeRoleButton");
  const revokePlatformRoleDialog = acceptAppConfirmation(
    /Revoke role assignment\?/,
    new RegExp(
      `Revoke role assignment '${platformRoleAssignmentId}' from admin user '${workspaceAdminUserId}'\\?`
    )
  );
  const revokedPlatformRoleResponsePromise = page.waitForResponse(
    response =>
      response.request().method() === "DELETE" &&
      response.url().endsWith(
        `/api/v1/admin/users/${workspaceAdminUserId}/role-assignments/${platformRoleAssignmentId}`
      )
  );
  logStep("revoke-platform-admin-role-with-step-up");
  await page.locator("#adminRevokeRoleButton").click();
  await revokePlatformRoleDialog;
  const revokedPlatformRoleResponse = await revokedPlatformRoleResponsePromise;
  assert.equal(revokedPlatformRoleResponse.status(), 200);
  await expectInputValue("#adminPlatformRoleConfirmationPassword", "");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/admin/users`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.some(
        item =>
          item?.adminUser?.adminUserId === workspaceAdminUserId &&
          !item?.roleAssignments?.some(
            roleAssignment => roleAssignment?.role === "platform_admin"
          )
      )
  );
  logStep("admin-platform-role-step-up");
  stopAfter("admin-platform-role-step-up");

  await fillAndCommit("#adminResetTargetUserId", workspaceAdminUserId);
  await fillAndCommit("#adminResetPassword", workspaceAdminResetPassword);
  await expectButtonSelectorDisabled("#adminResetPasswordButton");
  await fillAndCommit(
    "#adminResetPasswordConfirmation",
    `${workspaceAdminResetPassword}-mismatch`
  );
  await page.locator("#adminResetPasswordMismatch").waitFor();
  await expectButtonSelectorDisabled("#adminResetPasswordButton");
  const resetPasswordStorageSnapshot = JSON.stringify(
    await page.evaluate(() =>
      JSON.parse(localStorage.getItem("testcenter-rewrite-app-shell") ?? "{}")
    )
  );
  assert.equal(
    resetPasswordStorageSnapshot.includes(workspaceAdminResetPassword),
    false
  );
  await fillAndCommit(
    "#adminResetPasswordConfirmation",
    workspaceAdminResetPassword
  );
  await expectButtonSelectorEnabled("#adminResetPasswordButton");
  logStep("reset-workspace-admin-password");
  const cancelledResetAdminPasswordDialog = waitForAppConfirmation(
    /Reset account password\?/,
    new RegExp(`Reset password for admin user '${workspaceAdminUserId}'\\?`)
  );
  const cancelledResetAdminPasswordRequest = page
    .waitForRequest(
      request =>
        request.method() === "POST" &&
        request.url().endsWith(
          `/api/v1/admin/users/${workspaceAdminUserId}/password`
        ),
      { timeout: 750 }
    )
    .then(() => true)
    .catch(() => false);
  await page.locator("#adminResetPasswordButton").click();
  const cancelledResetAdminPasswordBackdrop =
    await cancelledResetAdminPasswordDialog;
  assert.equal(
    await page
      .locator("#globalConfirmationCancelButton")
      .evaluate(element => element === document.activeElement),
    true,
    "The safe confirmation action must receive initial focus."
  );
  await page.keyboard.press("Shift+Tab");
  assert.equal(
    await page
      .locator("#globalConfirmationConfirmButton")
      .evaluate(element => element === document.activeElement),
    true,
    "Backward tab navigation must remain inside the confirmation dialog."
  );
  await page.keyboard.press("Tab");
  assert.equal(
    await page
      .locator("#globalConfirmationCancelButton")
      .evaluate(element => element === document.activeElement),
    true,
    "Forward tab navigation must remain inside the confirmation dialog."
  );
  await page.keyboard.press("Escape");
  await cancelledResetAdminPasswordBackdrop.waitFor({ state: "detached" });
  await page.waitForFunction(
    () => document.activeElement?.id === "adminResetPasswordButton"
  );
  assert.equal(
    await cancelledResetAdminPasswordRequest,
    false,
    "Cancelling the confirmation must not submit the password reset."
  );
  await expectInputValue("#adminResetPassword", workspaceAdminResetPassword);
  await expectInputValue(
    "#adminResetPasswordConfirmation",
    workspaceAdminResetPassword
  );
  const resetAdminPasswordDialog = acceptAppConfirmation(
    /Reset account password\?/,
    new RegExp(`Reset password for admin user '${workspaceAdminUserId}'\\?`)
  );
  await clickAction("Reset Password");
  await resetAdminPasswordDialog;
  await expectInputValue("#adminResetPassword", "");
  await expectInputValue("#adminResetPasswordConfirmation", "");
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
    resetWorkspaceAdminPasswordPayload.adminUser.passwordChangeRequired,
    true
  );
  assert.equal(
    resetWorkspaceAdminPasswordPayload.roleAssignments.find(
      roleAssignment => roleAssignment?.role === "workspace_admin"
    )?.accessMode,
    "read_only"
  );
  const blockedResetPasswordSession = await fetch(
    `${baseUrl}/api/v1/admin/users`,
    {
      headers: {
        authorization: `Bearer ${resetWorkspaceAdminPasswordPayload.sessionToken}`
      }
    }
  );
  assert.equal(blockedResetPasswordSession.status, 403);
  assert.equal(
    (await blockedResetPasswordSession.json()).error,
    "admin_password_change_required"
  );
  logStep("admin-password-reset-confirmation");
  stopAfter("admin-password-reset-confirmation");

  logStep("read-only-workspace-admin");
  await signOutAdmin();
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
  await page.locator("#requiredAdminPasswordChangeDialog").waitFor();
  await waitForInputMinLength("#adminSessionToken", 20);
  assert.equal(
    await page.locator("#requiredAdminPassword").getAttribute("minlength"),
    "8"
  );
  assert.equal(
    await page.locator("#requiredAdminPassword").getAttribute("maxlength"),
    "60"
  );
  assert.equal(
    await page
      .locator("#requiredAdminPasswordConfirmation")
      .getAttribute("maxlength"),
    "60"
  );
  await fillAndCommit("#requiredAdminPassword", "short");
  await fillAndCommit("#requiredAdminPasswordConfirmation", "different");
  await expectButtonSelectorDisabled("#requiredAdminPasswordSubmitButton");
  await fillAndCommit(
    "#requiredAdminPassword",
    workspaceAdminFinalPassword
  );
  await fillAndCommit(
    "#requiredAdminPasswordConfirmation",
    workspaceAdminFinalPassword
  );
  await expectButtonSelectorEnabled("#requiredAdminPasswordSubmitButton");
  const requiredPasswordChangeResponsePromise = page.waitForResponse(
    response =>
      response.request().method() === "POST" &&
      response.url().endsWith("/api/v1/admin/auth/password")
  );
  await page.locator("#requiredAdminPasswordSubmitButton").click();
  const requiredPasswordChangeResponse =
    await requiredPasswordChangeResponsePromise;
  assert.equal(requiredPasswordChangeResponse.status(), 200);
  await page
    .locator("#requiredAdminPasswordChangeDialog")
    .waitFor({ state: "detached" });
  await expectInputValue("#adminSessionToken", "");
  const revokedResetPasswordSession = await fetch(
    `${baseUrl}/api/v1/admin/auth/current-session`,
    {
      headers: {
        authorization: `Bearer ${resetWorkspaceAdminPasswordPayload.sessionToken}`
      }
    }
  );
  assert.equal(revokedResetPasswordSession.status, 401);

  await fillAndCommitUntilValue("#adminUsername", workspaceAdminUsername);
  await fillAndCommitUntilValue("#adminPassword", workspaceAdminFinalPassword);
  const finalReadOnlyAdminSignInResponsePromise = page.waitForResponse(
    response =>
      response.request().method() === "POST" &&
      response.url().endsWith("/api/v1/admin/auth/sign-in")
  );
  await clickAction("Sign In");
  const finalReadOnlyAdminSignInResponse =
    await finalReadOnlyAdminSignInResponsePromise;
  assert.equal(finalReadOnlyAdminSignInResponse.status(), 200);
  await waitForInputMinLength("#adminSessionToken", 20);
  assert.equal(
    await page.locator("#requiredAdminPasswordChangeDialog").count(),
    0
  );
  await page.locator("#ownAdminPasswordOpenButton").click();
  await page.locator("#ownAdminPasswordChangeDialog").waitFor();
  assert.equal(
    await page.locator("#currentAdminPassword").getAttribute("maxlength"),
    "60"
  );
  assert.equal(
    await page.locator("#ownAdminPassword").getAttribute("minlength"),
    "8"
  );
  assert.equal(
    await page.locator("#ownAdminPasswordConfirmation").getAttribute("maxlength"),
    "60"
  );
  await fillAndCommit("#currentAdminPassword", "wrong-current-password");
  await fillAndCommit("#ownAdminPassword", workspaceAdminVoluntaryPassword);
  await fillAndCommit(
    "#ownAdminPasswordConfirmation",
    workspaceAdminVoluntaryPassword
  );
  await expectButtonSelectorEnabled("#ownAdminPasswordSubmitButton");
  const rejectedOwnPasswordChangeResponsePromise = page.waitForResponse(
    response =>
      response.request().method() === "POST" &&
      response.url().endsWith("/api/v1/admin/auth/password")
  );
  await page.locator("#ownAdminPasswordSubmitButton").click();
  const rejectedOwnPasswordChangeResponse =
    await rejectedOwnPasswordChangeResponsePromise;
  assert.equal(rejectedOwnPasswordChangeResponse.status(), 403);
  await page
    .locator("#ownAdminPasswordError")
    .filter({ hasText: "Check the current password" })
    .waitFor();
  await fillAndCommit(
    "#currentAdminPassword",
    workspaceAdminFinalPassword
  );
  const ownPasswordChangeResponsePromise = page.waitForResponse(
    response =>
      response.request().method() === "POST" &&
      response.url().endsWith("/api/v1/admin/auth/password")
  );
  await page.locator("#ownAdminPasswordSubmitButton").click();
  const ownPasswordChangeResponse = await ownPasswordChangeResponsePromise;
  assert.equal(ownPasswordChangeResponse.status(), 200);
  await page
    .locator("#ownAdminPasswordChangeDialog")
    .waitFor({ state: "detached" });
  await expectInputValue("#adminSessionToken", "");
  const rejectedPreChangePasswordSignIn = await fetch(
    `${baseUrl}/api/v1/admin/auth/sign-in`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: workspaceAdminUsername,
        password: workspaceAdminFinalPassword
      })
    }
  );
  assert.equal(rejectedPreChangePasswordSignIn.status, 401);
  await fillAndCommitUntilValue("#adminUsername", workspaceAdminUsername);
  await fillAndCommitUntilValue(
    "#adminPassword",
    workspaceAdminVoluntaryPassword
  );
  await clickAction("Sign In");
  await waitForInputMinLength("#adminSessionToken", 20);
  await page.locator("#operatorAccountSummary").click();
  assert.equal(
    (await page.locator("#operatorAccountUsername").textContent())?.trim(),
    workspaceAdminUsername
  );
  assert.equal(
    (await page.locator("#operatorAccountDisplayName").textContent())?.trim(),
    "UI Workspace Admin"
  );
  assert.match(
    (await page.locator("#operatorAccountAccessLabel").textContent()) ?? "",
    /administrator/i
  );
  assert.match(
    (await page.locator(".operator-account-role").allTextContents()).join(" "),
    /workspace administrator/i
  );
  assert.notEqual(
    (await page.locator("#operatorAccountSessionExpiresAt").textContent())?.trim(),
    "unknown"
  );
  assert.notEqual(
    (await page.locator("#operatorAccountVersion").textContent())?.trim(),
    ""
  );
  await page.locator("#operatorAccountSummary").click();
  logStep("admin-account-panel");
  const globalSignOutResponsePromise = page.waitForResponse(
    response =>
      response.request().method() === "POST" &&
      response.url().endsWith("/api/v1/admin/auth/sign-out")
  );
  await page.locator("#globalAdminSignOutButton").click();
  assert.equal((await globalSignOutResponsePromise).status(), 200);
  await expectInputValue("#adminSessionToken", "");
  assert.equal(await page.locator("#globalAdminSignOutButton").count(), 0);
  await fillAndCommitUntilValue("#adminUsername", workspaceAdminUsername);
  await fillAndCommitUntilValue(
    "#adminPassword",
    workspaceAdminVoluntaryPassword
  );
  await clickAction("Sign In");
  await waitForInputMinLength("#adminSessionToken", 20);
  logStep("admin-global-sign-out");
  logStep("admin-voluntary-password-change");
  stopAfter("admin-voluntary-password-change");
  logStep("admin-required-password-change");
  stopAfter("admin-required-password-change");
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
  await signOutAdmin();
  await fillAndCommitUntilValue("#adminUsername", adminUsername);
  await fillAndCommitUntilValue("#adminPassword", adminPassword);
  await clickAction("Sign In");
  await waitForInputMinLength("#adminSessionToken", 20);
  smokeAdminSessionToken = await page.locator("#adminSessionToken").inputValue();
  stopAfter("read-only-workspace-admin");

  logStep("delegated-workspace-operator-management");
  const delegatedWorkspaceAdminUsername = `ui-delegated-admin-${Date.now()}`;
  const delegatedWorkspaceAdminPassword = "ui-delegated-admin-secret";
  const delegatedWorkspaceAdminFinalPassword =
    "ui-delegated-admin-final-secret";
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

  await clickCardAction(
    "Admin Users",
    "Use For Admin Actions",
    delegatedWorkspaceAdminUsername
  );
  const delegatedDisplayNameTargetUserId = await page
    .locator("#adminStatusTargetUserId")
    .inputValue();
  assert.ok(delegatedDisplayNameTargetUserId.length > 0);
  await expectInputValue(
    "#adminDisplayNameTargetUserId",
    delegatedDisplayNameTargetUserId
  );
  await expectInputValue(
    "#adminDisplayNameUpdateDraft",
    "UI Delegated Workspace Admin"
  );
  const delegatedWorkspaceAdminRenamedDisplayName =
    "UI Renamed Delegated Workspace Admin";
  await fillAndCommit(
    "#adminDisplayNameUpdateDraft",
    delegatedWorkspaceAdminRenamedDisplayName
  );
  await expectButtonSelectorEnabled("#adminUpdateDisplayNameButton");
  logStep("admin-user-display-name");
  const updateAdminDisplayNameDialog = acceptAppConfirmation(
    /Change display name\?/,
    new RegExp(
      `Change admin user '.+' display name to '${delegatedWorkspaceAdminRenamedDisplayName}'\\?`
    )
  );
  const updateAdminDisplayNameResponsePromise = page.waitForResponse(
    response =>
      response.request().method() === "PATCH" &&
      /\/api\/v1\/admin\/users\/[^/]+$/.test(new URL(response.url()).pathname)
  );
  await page.locator("#adminUpdateDisplayNameButton").click();
  await updateAdminDisplayNameDialog;
  assert.equal((await updateAdminDisplayNameResponsePromise).status(), 200);
  await waitForNotBusy("admin-user-display-name");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/admin/users?username=${delegatedWorkspaceAdminUsername}`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.some(
        item =>
          item?.adminUser?.username === delegatedWorkspaceAdminUsername &&
          item?.adminUser?.displayName ===
            delegatedWorkspaceAdminRenamedDisplayName
      )
  );
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/admin/audit-events?eventType=admin_user_updated&subjectAdminUserId=${delegatedDisplayNameTargetUserId}&limit=5`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.some(
        item =>
          item?.eventType === "admin_user_updated" &&
          item?.subjectAdminUserId === delegatedDisplayNameTargetUserId &&
          item?.details?.previousDisplayName ===
            "UI Delegated Workspace Admin" &&
          item?.details?.nextDisplayName ===
            delegatedWorkspaceAdminRenamedDisplayName
      )
  );
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Admin Users", exact: true })
    })
    .filter({ hasText: delegatedWorkspaceAdminRenamedDisplayName })
    .waitFor();
  stopAfter("admin-user-display-name");

  await expectInputValue(
    "#adminAccessWindowTargetUserId",
    delegatedDisplayNameTargetUserId
  );
  await expectInputValue("#adminAccessWindowValidFrom", "");
  await expectInputValue("#adminAccessWindowValidTo", "");
  await expectInputValue("#adminAccessWindowValidForMinutes", "");
  await fillAndCommit(
    "#adminAccessWindowValidFrom",
    "2999-01-02T00:00:00.000Z"
  );
  await fillAndCommit(
    "#adminAccessWindowValidTo",
    "2999-01-01T00:00:00.000Z"
  );
  await expectButtonSelectorDisabled("#adminUpdateAccessWindowButton");
  await fillAndCommit(
    "#adminAccessWindowValidFrom",
    "2999-01-01T00:00:00.000Z"
  );
  await fillAndCommit("#adminAccessWindowValidTo", "");
  await fillAndCommit("#adminAccessWindowValidForMinutes", "45");
  await expectButtonSelectorEnabled("#adminUpdateAccessWindowButton");
  logStep("admin-user-access-window");
  const scheduleAdminAccessDialog = acceptAppConfirmation(
    /Update access window\?/,
    new RegExp(
      `Update admin user '${delegatedDisplayNameTargetUserId}' access window\\? Active sessions outside the new boundary will be ended\\.`
    )
  );
  const scheduleAdminAccessResponsePromise = page.waitForResponse(
    response =>
      response.request().method() === "PATCH" &&
      /\/api\/v1\/admin\/users\/[^/]+$/.test(new URL(response.url()).pathname)
  );
  await page.locator("#adminUpdateAccessWindowButton").click();
  await scheduleAdminAccessDialog;
  assert.equal((await scheduleAdminAccessResponsePromise).status(), 200);
  await waitForNotBusy("admin-user-access-window-schedule");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/admin/users?username=${delegatedWorkspaceAdminUsername}`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.some(
        item =>
          item?.adminUser?.username === delegatedWorkspaceAdminUsername &&
          item?.adminUser?.validFrom === "2999-01-01T00:00:00.000Z" &&
          item?.adminUser?.validTo === null &&
          item?.adminUser?.validForMinutes === 45
      )
  );
  const scheduledAdminSignInResponse = await fetch(
    `${baseUrl}/api/v1/admin/auth/sign-in`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: delegatedWorkspaceAdminUsername,
        password: delegatedWorkspaceAdminPassword
      })
    }
  );
  assert.equal(scheduledAdminSignInResponse.status, 403);
  assert.equal(
    (await scheduledAdminSignInResponse.json()).error,
    "admin_access_not_started"
  );
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/admin/audit-events?eventType=admin_user_updated&subjectAdminUserId=${delegatedDisplayNameTargetUserId}&limit=10`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.some(
        item =>
          item?.details?.previousValidFrom === null &&
          item?.details?.nextValidFrom === "2999-01-01T00:00:00.000Z" &&
          item?.details?.nextValidForMinutes === 45
      )
  );
  await selectAndCommit("#adminUserAccessStatusFilter", "scheduled");
  await selectAndCommit("#adminUserPasswordChangeFilter", "true");
  logStep("admin-user-lifecycle-filters");
  const lifecycleFilterResponsePromise = page.waitForResponse(response => {
    if (
      response.request().method() !== "GET" ||
      new URL(response.url()).pathname !== "/api/v1/admin/users"
    ) {
      return false;
    }
    const responseUrl = new URL(response.url());
    return (
      responseUrl.searchParams.get("accessStatus") === "scheduled" &&
      responseUrl.searchParams.get("passwordChangeRequired") === "true"
    );
  });
  await clickAction("Apply User Filters");
  const lifecycleFilterResponse = await lifecycleFilterResponsePromise;
  assert.equal(lifecycleFilterResponse.status(), 200);
  const lifecycleFilterPayload = await lifecycleFilterResponse.json();
  assert.deepEqual(
    lifecycleFilterPayload.items.map(item => item.adminUser?.adminUserId),
    [delegatedDisplayNameTargetUserId]
  );
  await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Admin Users", exact: true })
    })
    .filter({ hasText: delegatedWorkspaceAdminUsername })
    .waitFor();
  await clickAction("Clear User Filters");
  await expectInputValue("#adminUserAccessStatusFilter", "");
  await expectInputValue("#adminUserPasswordChangeFilter", "");
  await clickAction("Apply User Filters");
  stopAfter("admin-user-lifecycle-filters");
  await fillAndCommit("#adminAccessWindowValidFrom", "");
  await fillAndCommit("#adminAccessWindowValidTo", "");
  await fillAndCommit("#adminAccessWindowValidForMinutes", "");
  await expectButtonSelectorEnabled("#adminUpdateAccessWindowButton");
  const clearAdminAccessDialog = acceptAppConfirmation(
    /Update access window\?/,
    new RegExp(
      `Update admin user '${delegatedDisplayNameTargetUserId}' access window\\? Active sessions outside the new boundary will be ended\\.`
    )
  );
  const clearAdminAccessResponsePromise = page.waitForResponse(
    response =>
      response.request().method() === "PATCH" &&
      /\/api\/v1\/admin\/users\/[^/]+$/.test(new URL(response.url()).pathname)
  );
  await page.locator("#adminUpdateAccessWindowButton").click();
  await clearAdminAccessDialog;
  assert.equal((await clearAdminAccessResponsePromise).status(), 200);
  await waitForNotBusy("admin-user-access-window-clear");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/admin/users?username=${delegatedWorkspaceAdminUsername}`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.some(
        item =>
          item?.adminUser?.username === delegatedWorkspaceAdminUsername &&
          item?.adminUser?.validFrom === null &&
          item?.adminUser?.validTo === null &&
          item?.adminUser?.validForMinutes === null
      )
  );
  stopAfter("admin-user-access-window");

  await expectInputValue(
    "#adminCustomTextsTargetUserId",
    delegatedDisplayNameTargetUserId
  );
  await expectInputValue("#adminCustomTextsUpdateDraft", "{}");
  await fillAndCommit("#adminCustomTextsUpdateDraft", "not-json");
  await expectButtonSelectorDisabled("#adminUpdateCustomTextsButton");
  const delegatedAdminCustomTexts = {
    gm_headline: "UI custom workspace headline",
    gm_control_pause: "UI hold workspace tests"
  };
  await fillAndCommit(
    "#adminCustomTextsUpdateDraft",
    JSON.stringify(delegatedAdminCustomTexts, null, 2)
  );
  await expectButtonSelectorEnabled("#adminUpdateCustomTextsButton");
  logStep("admin-user-custom-texts");
  const updateAdminCustomTextsDialog = acceptAppConfirmation(
    /Replace login-specific texts\?/,
    new RegExp(
      `Replace admin user '${delegatedDisplayNameTargetUserId}' login-specific custom texts with 2 entries\\?`
    )
  );
  const updateAdminCustomTextsResponsePromise = page.waitForResponse(
    response =>
      response.request().method() === "PATCH" &&
      /\/api\/v1\/admin\/users\/[^/]+$/.test(new URL(response.url()).pathname)
  );
  await page.locator("#adminUpdateCustomTextsButton").click();
  await updateAdminCustomTextsDialog;
  assert.equal((await updateAdminCustomTextsResponsePromise).status(), 200);
  await waitForNotBusy("admin-user-custom-texts");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/admin/users?username=${delegatedWorkspaceAdminUsername}`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.some(
        item =>
          item?.adminUser?.username === delegatedWorkspaceAdminUsername &&
          item?.adminUser?.customTexts?.gm_headline ===
            delegatedAdminCustomTexts.gm_headline &&
          item?.adminUser?.customTexts?.gm_control_pause ===
            delegatedAdminCustomTexts.gm_control_pause &&
          Object.keys(item?.adminUser?.customTexts ?? {}).length === 2
      )
  );
  const adminCustomTextsAuditPayload = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/admin/audit-events?eventType=admin_user_updated&subjectAdminUserId=${delegatedDisplayNameTargetUserId}&limit=10`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.some(
        item =>
          item?.details?.previousCustomTextCount === 0 &&
          item?.details?.nextCustomTextCount === 2 &&
          Array.isArray(item?.details?.changedCustomTextKeys) &&
          item.details.changedCustomTextKeys.includes("gm_headline") &&
          item.details.changedCustomTextKeys.includes("gm_control_pause")
      )
  );
  assert.equal(
    JSON.stringify(adminCustomTextsAuditPayload).includes(
      delegatedAdminCustomTexts.gm_headline
    ),
    false
  );
  assert.equal(
    JSON.stringify(adminCustomTextsAuditPayload).includes(
      delegatedAdminCustomTexts.gm_control_pause
    ),
    false
  );
  const customTextSignInResponse = await fetch(
    `${baseUrl}/api/v1/admin/auth/sign-in`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        username: delegatedWorkspaceAdminUsername,
        password: delegatedWorkspaceAdminPassword
      })
    }
  );
  assert.equal(customTextSignInResponse.status, 200);
  const customTextSignInPayload = await customTextSignInResponse.json();
  assert.deepEqual(
    customTextSignInPayload.adminUser?.customTexts,
    delegatedAdminCustomTexts
  );
  const customTextSignOutResponse = await fetch(
    `${baseUrl}/api/v1/admin/auth/sign-out`,
    {
      method: "POST",
      headers: {
        authorization: `Bearer ${customTextSignInPayload.sessionToken}`
      }
    }
  );
  assert.equal(customTextSignOutResponse.status, 200);
  stopAfter("admin-user-custom-texts");

  await signOutAdmin();
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
  await page.locator("#requiredAdminPasswordChangeDialog").waitFor();
  await fillAndCommit(
    "#requiredAdminPassword",
    delegatedWorkspaceAdminFinalPassword
  );
  await fillAndCommit(
    "#requiredAdminPasswordConfirmation",
    delegatedWorkspaceAdminFinalPassword
  );
  await expectButtonSelectorEnabled("#requiredAdminPasswordSubmitButton");
  const delegatedPasswordChangeResponsePromise = page.waitForResponse(
    response =>
      response.request().method() === "POST" &&
      response.url().endsWith("/api/v1/admin/auth/password")
  );
  await page.locator("#requiredAdminPasswordSubmitButton").click();
  assert.equal((await delegatedPasswordChangeResponsePromise).status(), 200);
  await page
    .locator("#requiredAdminPasswordChangeDialog")
    .waitFor({ state: "detached" });
  await expectInputValue("#adminSessionToken", "");
  await fillAndCommitUntilValue(
    "#adminUsername",
    delegatedWorkspaceAdminUsername
  );
  await fillAndCommitUntilValue(
    "#adminPassword",
    delegatedWorkspaceAdminFinalPassword
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

  await signOutAdmin();
  await fillAndCommitUntilValue("#adminUsername", adminUsername);
  await fillAndCommitUntilValue("#adminPassword", adminPassword);
  await clickAction("Sign In");
  await waitForInputMinLength("#adminSessionToken", 20);
  smokeAdminSessionToken = await page.locator("#adminSessionToken").inputValue();

  const createBatchAdminSession = async (username, password) => {
    const response = await fetch(`${baseUrl}/api/v1/admin/auth/sign-in`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ username, password })
    });
    assert.equal(response.status, 200);
    return response.json();
  };
  const workspaceAdminBatchSession = await createBatchAdminSession(
    workspaceAdminUsername,
    workspaceAdminVoluntaryPassword
  );
  const delegatedAdminBatchSession = await createBatchAdminSession(
    delegatedWorkspaceAdminUsername,
    delegatedWorkspaceAdminFinalPassword
  );

  await page
    .getByRole("button", { name: "Clear Session Filters", exact: true })
    .click();
  await clickAction("Admin Sessions");
  const adminSessionsCollection = page
    .locator("app-record-collection")
    .filter({ has: page.getByRole("heading", { name: "Admin Sessions", exact: true }) });
  const currentAdminSessionCard = adminSessionsCollection
    .locator(".record-card")
    .filter({ hasText: "current session" });
  await currentAdminSessionCard.waitFor();
  assert.equal(
    await currentAdminSessionCard
      .getByRole("button", { name: "Add To Batch" })
      .count(),
    0,
    "The signed-in admin session must not be available for bulk revocation."
  );
  for (const adminSessionId of [
    workspaceAdminBatchSession.adminSession.adminSessionId,
    delegatedAdminBatchSession.adminSession.adminSessionId
  ]) {
    await adminSessionsCollection
      .locator(".record-card")
      .filter({ hasText: adminSessionId })
      .getByRole("button", { name: "Add To Batch" })
      .dispatchEvent("click");
    await page
      .locator("app-record-collection")
      .filter({
        has: page.getByRole("heading", {
          name: "Selected Admin Sessions",
          exact: true
        })
      })
      .filter({ hasText: adminSessionId })
      .waitFor({ timeout: 15_000 });
  }
  const selectedAdminSessions = page
    .locator("app-record-collection")
    .filter({
      has: page.getByRole("heading", {
        name: "Selected Admin Sessions",
        exact: true
      })
    });
  await selectedAdminSessions
    .filter({ hasText: "2 selected admin session(s) will be revoked" })
    .filter({ hasText: workspaceAdminBatchSession.adminSession.adminSessionId })
    .filter({ hasText: delegatedAdminBatchSession.adminSession.adminSessionId })
    .waitFor();
  await expectButtonSelectorEnabled("#adminBatchRevokeSessionsButton");
  logStep("admin-session-bulk-revoke");
  const revokeAdminSessionBatchDialog = acceptAppConfirmation(
    /Revoke selected sessions\?/,
    /Revoke 2 selected admin session\(s\)\? The current session is excluded and every target remains subject to the server delegation boundary\./
  );
  await page.locator("#adminBatchRevokeSessionsButton").click();
  await revokeAdminSessionBatchDialog;
  await waitForNotBusy("admin-session-bulk-revoke");
  for (const sessionToken of [
    workspaceAdminBatchSession.sessionToken,
    delegatedAdminBatchSession.sessionToken
  ]) {
    const revokedSessionResponse = await fetch(
      `${baseUrl}/api/v1/admin/auth/current-session`,
      { headers: { authorization: `Bearer ${sessionToken}` } }
    );
    assert.equal(revokedSessionResponse.status, 401);
  }
  await selectedAdminSessions
    .filter({ hasText: "0 selected admin session(s) will be revoked" })
    .filter({ hasText: "Last Succeeded" })
    .filter({ hasText: "Last Failed" })
    .waitFor();
  stopAfter("admin-session-bulk-revoke");

  await clickAction("Admin Users");
  const batchAdminDirectoryResponse = await fetch(
    `${baseUrl}/api/v1/admin/users?limit=100`,
    { headers: { authorization: `Bearer ${smokeAdminSessionToken}` } }
  );
  assert.equal(batchAdminDirectoryResponse.status, 200);
  const batchAdminDirectory = await batchAdminDirectoryResponse.json();
  const delegatedWorkspaceAdminUserId = batchAdminDirectory.items.find(
    item => item?.adminUser?.username === delegatedWorkspaceAdminUsername
  )?.adminUser?.adminUserId;
  assert.ok(delegatedWorkspaceAdminUserId);
  const adminUsersCollection = page
    .locator("app-record-collection")
    .filter({ has: page.getByRole("heading", { name: "Admin Users" }) });
  const currentPlatformAdminCard = adminUsersCollection
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: adminUsername }) });
  await currentPlatformAdminCard.filter({ hasText: "current session" }).waitFor();
  assert.equal(
    await currentPlatformAdminCard
      .getByRole("button", { name: "Add To Batch" })
      .count(),
    0,
    "The signed-in admin account must not be available for bulk status changes."
  );
  const selectedAdminAccounts = page
    .locator("app-record-collection")
    .filter({
      has: page.getByRole("heading", { name: "Selected Admin Accounts" })
    });
  const addAdminUsersToBatch = async entries => {
    for (const [username, adminUserId] of entries) {
      await adminUsersCollection
        .locator(".record-card")
        .filter({
          has: page.getByRole("heading", { name: username, exact: true })
        })
        .getByRole("button", { name: "Add To Batch", exact: true })
        .dispatchEvent("click");
      await selectedAdminAccounts
        .filter({ hasText: adminUserId })
        .waitFor({ timeout: 15_000 });
    }
  };
  const batchAdminUsers = [
    [workspaceAdminUsername, workspaceAdminUserId],
    [delegatedWorkspaceAdminUsername, delegatedWorkspaceAdminUserId]
  ];
  await addAdminUsersToBatch(batchAdminUsers);
  await selectedAdminAccounts
    .filter({ hasText: workspaceAdminUserId })
    .filter({ hasText: delegatedWorkspaceAdminUserId })
    .waitFor();
  await expectButtonSelectorEnabled("#adminBatchResetPasswordsButton");
  logStep("admin-user-bulk-password");
  const resetAdminBatchPasswordDialog = acceptAppConfirmation(
    /Generate new account passwords\?/,
    /Generate and set a unique password for 2 selected admin user\(s\)\? Existing passwords will stop working immediately; active sessions are unchanged\./
  );
  await page.locator("#adminBatchResetPasswordsButton").click();
  await resetAdminBatchPasswordDialog;
  await waitForNotBusy("admin-user-bulk-password");
  const generatedPasswordFor = async username => {
    const credentialCard = selectedAdminAccounts
      .locator(".record-card")
      .filter({ has: page.getByRole("heading", { name: username, exact: true }) })
      .filter({ hasText: "Generated password handoff" });
    await credentialCard.waitFor();
    return credentialCard
      .locator('[aria-label^="Generated Password: "]')
      .getAttribute("title");
  };
  const workspaceAdminGeneratedPassword = await generatedPasswordFor(
    workspaceAdminUsername
  );
  const delegatedAdminGeneratedPassword = await generatedPasswordFor(
    delegatedWorkspaceAdminUsername
  );
  assert.equal(workspaceAdminGeneratedPassword?.length, 24);
  assert.equal(delegatedAdminGeneratedPassword?.length, 24);
  assert.notEqual(
    workspaceAdminGeneratedPassword,
    delegatedAdminGeneratedPassword,
    "Bulk password resets must issue a unique password for every account."
  );
  const persistedBrowserState = await page.evaluate(() =>
    Object.values(globalThis.localStorage).join("\n")
  );
  assert.equal(persistedBrowserState.includes(workspaceAdminGeneratedPassword), false);
  assert.equal(persistedBrowserState.includes(delegatedAdminGeneratedPassword), false);
  await selectedAdminAccounts
    .filter({ hasText: "Generated Passwords Awaiting Handoff" })
    .filter({ hasText: "Last Password Failed" })
    .waitFor();
  const passwordCsvDownloadPromise = page.waitForEvent("download");
  await page.locator("#downloadAdminBatchPasswordsButton").click();
  const passwordCsvDownload = await passwordCsvDownloadPromise;
  assert.match(
    passwordCsvDownload.suggestedFilename(),
    /^admin-generated-passwords-.*\.csv$/
  );
  const passwordCsvPath = await passwordCsvDownload.path();
  assert.ok(passwordCsvPath);
  const passwordCsv = await readFile(passwordCsvPath, "utf8");
  assert.match(passwordCsv, /adminUserId,username,generatedPassword/);
  assert.match(passwordCsv, new RegExp(workspaceAdminGeneratedPassword));
  assert.match(passwordCsv, new RegExp(delegatedAdminGeneratedPassword));
  await expectButtonSelectorDisabled("#downloadAdminBatchPasswordsButton");
  assert.equal(
    await selectedAdminAccounts
      .locator(".record-card")
      .filter({ hasText: "Generated password handoff" })
      .count(),
    0,
    "Downloaded password credentials must be removed from the rendered batch state."
  );
  const generatedPasswordSessions = [];
  for (const [username, previousPassword, generatedPassword] of [
    [workspaceAdminUsername, workspaceAdminResetPassword, workspaceAdminGeneratedPassword],
    [
      delegatedWorkspaceAdminUsername,
      delegatedWorkspaceAdminPassword,
      delegatedAdminGeneratedPassword
    ]
  ]) {
    const previousPasswordResponse = await fetch(
      `${baseUrl}/api/v1/admin/auth/sign-in`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password: previousPassword })
      }
    );
    assert.equal(previousPasswordResponse.status, 401);
    const generatedPasswordResponse = await fetch(
      `${baseUrl}/api/v1/admin/auth/sign-in`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ username, password: generatedPassword })
      }
    );
    assert.equal(generatedPasswordResponse.status, 200);
    generatedPasswordSessions.push(await generatedPasswordResponse.json());
  }
  stopAfter("admin-user-bulk-password");

  await addAdminUsersToBatch(batchAdminUsers);
  await selectAndCommit("#adminRoleRole", "system_check");
  await fillAndCommit("#adminRoleTenantKey", tenantKey);
  await fillAndCommit("#adminRoleWorkspaceKey", workspaceKey);
  await expectButtonSelectorEnabled("#adminBatchAssignRoleButton");
  await selectedAdminAccounts
    .filter({ hasText: workspaceAdminUserId })
    .filter({ hasText: delegatedWorkspaceAdminUserId })
    .filter({ hasText: "system_check" })
    .waitFor();
  logStep("admin-user-bulk-role");
  const assignAdminBatchRoleDialog = acceptAppConfirmation(
    /Assign role to selected accounts\?/,
    /Assign 'system_check' to 2 selected admin user\(s\)\? Each account remains subject to the server delegation boundary\./
  );
  await page.locator("#adminBatchAssignRoleButton").click();
  await assignAdminBatchRoleDialog;
  await waitForNotBusy("admin-user-bulk-role");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/admin/users`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      [workspaceAdminUserId, delegatedWorkspaceAdminUserId].every(adminUserId =>
        payload.items.some(
          item =>
            item?.adminUser?.adminUserId === adminUserId &&
            item?.roleAssignments?.some(
              roleAssignment => roleAssignment?.role === "system_check"
            )
        )
      )
  );
  await selectedAdminAccounts
    .filter({ hasText: "Last Role Succeeded" })
    .filter({ hasText: "Last Role Failed" })
    .waitFor();
  stopAfter("admin-user-bulk-role");

  await addAdminUsersToBatch(batchAdminUsers);
  await selectAndCommit("#adminBatchStatusValue", "disabled");
  await selectedAdminAccounts
    .filter({ hasText: "2 selected account(s) will be changed to disabled" })
    .filter({ hasText: workspaceAdminUserId })
    .filter({ hasText: delegatedWorkspaceAdminUserId })
    .waitFor();
  await expectButtonSelectorEnabled("#adminBatchStatusButton");
  logStep("admin-user-bulk-status");
  const updateAdminBatchStatusDialog = acceptAppConfirmation(
    /Change selected account status\?/,
    /Change 2 selected admin user\(s\) to 'disabled'\? Each account remains subject to the server delegation boundary\./
  );
  await page.locator("#adminBatchStatusButton").click();
  await updateAdminBatchStatusDialog;
  await waitForNotBusy("admin-user-bulk-status");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/admin/users`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      [workspaceAdminUserId, delegatedWorkspaceAdminUserId].every(adminUserId =>
        payload.items.some(
          item =>
            item?.adminUser?.adminUserId === adminUserId &&
            item?.adminUser?.status === "disabled"
        )
      )
  );
  await selectedAdminAccounts
    .filter({ hasText: "0 selected account(s) will be changed to disabled" })
    .filter({ hasText: "Last Succeeded" })
    .filter({ hasText: "Last Failed" })
    .waitFor();
  for (const generatedPasswordSession of generatedPasswordSessions) {
    const revokedSessionResponse = await fetch(
      `${baseUrl}/api/v1/admin/auth/current-session`,
      {
        headers: {
          authorization: `Bearer ${generatedPasswordSession.sessionToken}`
        }
      }
    );
    assert.equal(revokedSessionResponse.status, 401);
  }
  const disabledAdminSessionsResponse = await fetch(
    `${baseUrl}/api/v1/admin/auth/sessions?status=revoked&limit=100`,
    {
      headers: { authorization: `Bearer ${smokeAdminSessionToken}` }
    }
  );
  assert.equal(disabledAdminSessionsResponse.status, 200);
  const disabledAdminSessions = await disabledAdminSessionsResponse.json();
  assert.ok(Array.isArray(disabledAdminSessions.items));
  for (const generatedPasswordSession of generatedPasswordSessions) {
    assert.equal(
      disabledAdminSessions.items.some(
        item =>
          item?.adminSession?.adminSessionId ===
            generatedPasswordSession.adminSession.adminSessionId &&
          item?.status === "revoked"
      ),
      true
    );
  }
  stopAfter("admin-user-bulk-status");
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

  await page
    .getByRole("button", { name: "Clear User Filters", exact: true })
    .click();
  await clickAction("Admin Users");
  await addAdminUsersToBatch(batchAdminUsers);
  await selectedAdminAccounts
    .filter({ hasText: workspaceAdminUserId })
    .filter({ hasText: delegatedWorkspaceAdminUserId })
    .waitFor();
  await page
    .locator("#adminUserBatchStatusCard")
    .filter({ hasText: "2/50 selected" })
    .waitFor();
  await expectButtonSelectorEnabled("#adminBatchDeleteButton");
  logStep("admin-user-bulk-delete");
  const deleteAdminBatchDialog = acceptAppConfirmation(
    /Permanently delete selected accounts\?/,
    /Permanently delete 2 selected admin user\(s\)\? Their sessions and role assignments will be removed; audit evidence will be retained\. This cannot be undone\./
  );
  await page.locator("#adminBatchDeleteButton").click();
  await deleteAdminBatchDialog;
  await waitForBusy("admin-user-bulk-delete");
  await waitForNotBusy("admin-user-bulk-delete");
  await selectedAdminAccounts
    .filter({ hasText: "Last Deleted" })
    .filter({ hasText: "Deleted Sessions" })
    .filter({ hasText: "Deleted Role Assignments" })
    .filter({ hasText: "Deletion Failure Details" })
    .waitFor();
  const adminDeletionPreviewText = await selectedAdminAccounts.innerText();
  assert.match(
    adminDeletionPreviewText,
    /LAST DELETED\s+2/,
    adminDeletionPreviewText
  );
  const remainingAdminUsersResponse = await fetch(
    `${baseUrl}/api/v1/admin/users?limit=100`,
    { headers: { authorization: `Bearer ${smokeAdminSessionToken}` } }
  );
  assert.equal(remainingAdminUsersResponse.status, 200);
  const remainingAdminUsers = await remainingAdminUsersResponse.json();
  assert.equal(
    remainingAdminUsers.items.some(item =>
      [workspaceAdminUserId, delegatedWorkspaceAdminUserId].includes(
        item?.adminUser?.adminUserId
      )
    ),
    false
  );
  const deletionAuditResponse = await fetch(
    `${baseUrl}/api/v1/admin/audit-events?eventType=admin_user_deleted&limit=10`,
    { headers: { authorization: `Bearer ${smokeAdminSessionToken}` } }
  );
  assert.equal(deletionAuditResponse.status, 200);
  const deletionAudit = await deletionAuditResponse.json();
  for (const deletedAdminUserId of [
    workspaceAdminUserId,
    delegatedWorkspaceAdminUserId
  ]) {
    assert.equal(
      deletionAudit.items.some(
        item =>
          item?.eventType === "admin_user_deleted" &&
          item?.subjectAdminUserId === deletedAdminUserId &&
          Number(item?.details?.deletedRoleAssignmentCount) >= 1 &&
          Number(item?.details?.deletedSessionCount) >= 1
      ),
      true
    );
  }
  const deletedAdminSessionsResponse = await fetch(
    `${baseUrl}/api/v1/admin/auth/sessions?limit=100`,
    { headers: { authorization: `Bearer ${smokeAdminSessionToken}` } }
  );
  assert.equal(deletedAdminSessionsResponse.status, 200);
  const deletedAdminSessions = await deletedAdminSessionsResponse.json();
  assert.equal(
    deletedAdminSessions.items.some(item =>
      [workspaceAdminUserId, delegatedWorkspaceAdminUserId].includes(
        item?.adminUser?.adminUserId
      )
    ),
    false
  );
  stopAfter("admin-user-bulk-delete");

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
  logStep("loose-upload-partial-report");
  const looseUploadInput = page.locator("#sourcePackageAssemblyFiles");
  assert.equal(await looseUploadInput.getAttribute("accept"), null);
  const survivingLooseUploadFileName = `ui-loose-survivor-${Date.now()}.voud`;
  const survivingBinaryUploadFileName = `ui-loose-binary-${Date.now()}.bin`;
  const survivingBinaryUpload = Buffer.from([0x00, 0xff, 0x80, 0x41, 0x0a]);
  const looseSourcePackageUploadRoute =
    `**/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`;
  let releaseHeldLooseUpload = () => {};
  let markHeldLooseUploadObserved = () => {};
  const heldLooseUploadRelease = new Promise(resolve => {
    releaseHeldLooseUpload = resolve;
  });
  const heldLooseUploadObserved = new Promise(resolve => {
    markHeldLooseUploadObserved = resolve;
  });
  const holdFinalLooseUpload = async route => {
    const request = route.request();
    if (request.method() === "POST") {
      const payload = request.postDataJSON();
      if (payload?.fileName === survivingBinaryUploadFileName) {
        markHeldLooseUploadObserved();
        await heldLooseUploadRelease;
      }
    }
    await route.continue();
  };
  await page.route(looseSourcePackageUploadRoute, holdFinalLooseUpload);
  await looseUploadInput.setInputFiles([
    {
      name: "Booklet2.xml",
      mimeType: "application/xml",
      buffer: await readFile(
        resolve("test-fixtures/original-testcenter/booklets/Booklet2.xml")
      )
    },
    {
      name: survivingLooseUploadFileName,
      mimeType: "",
      buffer: await readFile(
        resolve(
          "test-fixtures/original-testcenter/definitions/aspect-testcenter-sample1.voud"
        )
      )
    },
    {
      name: survivingBinaryUploadFileName,
      mimeType: "",
      buffer: survivingBinaryUpload
    }
  ]);
  await heldLooseUploadObserved;
  const liveLooseUploadProgress = page.locator(
    "#looseSourcePackageUploadProgress"
  );
  await liveLooseUploadProgress
    .filter({ hasText: "2 of 3 loose file(s) processed" })
    .filter({ hasText: `Uploading ${survivingBinaryUploadFileName}` })
    .waitFor({ timeout: 20_000 });
  assert.equal(
    await liveLooseUploadProgress
      .getByRole("progressbar", { name: "Loose file upload progress" })
      .getAttribute("aria-valuenow"),
    "2"
  );
  assert.equal(await looseUploadInput.isDisabled(), true);
  releaseHeldLooseUpload();
  const looseUploadReport = page
    .locator("app-record-collection")
    .filter({
      has: page.getByRole("heading", { name: "Loose File Upload Report" })
    });
  await looseUploadReport
    .locator("article.record-card")
    .filter({ has: page.getByRole("heading", { name: "3 loose file(s) processed" }) })
    .filter({ hasText: "2 uploaded, 1 rejected" })
    .filter({ hasText: "workspace refreshed" })
    .waitFor({ timeout: 20_000 });
  await page.unroute(looseSourcePackageUploadRoute, holdFinalLooseUpload);
  assert.equal(await looseUploadInput.isEnabled(), true);
  await looseUploadReport
    .locator("article.record-card")
    .filter({ has: page.getByRole("heading", { name: "Booklet2.xml" }) })
    .filter({ hasText: "source_package_file_name_duplicate" })
    .filter({ hasText: "HTTP 409" })
    .filter({ hasText: "Create a replacement" })
    .waitFor();
  await looseUploadReport
    .locator("article.record-card")
    .filter({
      has: page.getByRole("heading", { name: survivingLooseUploadFileName })
    })
    .filter({ hasText: "uploaded" })
    .filter({ hasText: "application/json" })
    .filter({ hasText: "Selected for reviewed package assembly" })
    .waitFor();
  await looseUploadReport
    .locator("article.record-card")
    .filter({
      has: page.getByRole("heading", { name: survivingBinaryUploadFileName })
    })
    .filter({ hasText: "uploaded" })
    .filter({ hasText: "application/octet-stream" })
    .filter({ hasText: "Selected for reviewed package assembly" })
    .waitFor();
  await page
    .locator("#sourcePackageAssemblySelection")
    .filter({ hasText: "2 file(s) selected" })
    .waitFor();
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages?fileName=${encodeURIComponent(survivingLooseUploadFileName)}`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      payload.filteredCount === 1 &&
      Array.isArray(payload.items) &&
      payload.items.some(
        item =>
          item?.sourcePackage?.fileName === survivingLooseUploadFileName &&
          item?.sourcePackage?.status === "uploaded" &&
          item?.sourcePackage?.mediaType === "application/json" &&
          item?.fileType === "Resource"
      )
  );
  const binaryUploadList = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages?fileName=${encodeURIComponent(survivingBinaryUploadFileName)}`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      payload.filteredCount === 1 &&
      Array.isArray(payload.items) &&
      payload.items.some(
        item =>
          item?.sourcePackage?.fileName === survivingBinaryUploadFileName &&
          item?.sourcePackage?.status === "uploaded" &&
          item?.sourcePackage?.mediaType === "application/octet-stream" &&
          item?.fileType === "Resource"
      )
  );
  const binarySourcePackageId = binaryUploadList.items.find(
    item => item?.sourcePackage?.fileName === survivingBinaryUploadFileName
  )?.sourcePackage?.sourcePackageId;
  assert.ok(binarySourcePackageId);
  const binaryDownloadResponse = await fetch(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages/${binarySourcePackageId}/download`,
    createSmokeFetchInit()
  );
  assert.equal(binaryDownloadResponse.status, 200);
  assert.deepEqual(
    Buffer.from(await binaryDownloadResponse.arrayBuffer()),
    survivingBinaryUpload
  );
  await page.locator("#clearSourcePackageAssemblyButton").click();
  await page
    .locator("#sourcePackageAssemblySelection")
    .filter({ hasText: "0 file(s) selected" })
    .waitFor();
  stopAfter("loose-upload-partial-report");
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
  const deleteUploadedZipDialog = acceptVerifiedAppConfirmation(
    /Delete workspace file\?/,
    new RegExp(`Delete '${uploadedZipSourceFileName}'.+cannot be undone\\.`),
    uploadedZipSourceFileName
  );
  await page.locator("#deleteSourcePackageButton").click();
  await deleteUploadedZipDialog;
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
  const replaceSourcePackageDialog = acceptAppConfirmation(
    /Import a new package version\?/,
    new RegExp(
      `Import '${lifecycleReplacementFileName}' as a new version\\? The prior package remains\\.`
    )
  );
  await page.locator("#replaceSourcePackageButton").click();
  await replaceSourcePackageDialog;
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
  const deleteReplacementSourcePackageDialog = acceptVerifiedAppConfirmation(
    /Delete workspace file\?/,
    new RegExp(`Delete '${lifecycleReplacementFileName}'.+cannot be undone\\.`),
    lifecycleReplacementFileName
  );
  await page.locator("#deleteSourcePackageButton").click();
  await deleteReplacementSourcePackageDialog;
  await expectInputValue("#sourcePackageId", "");
  await fillAndCommit("#sourcePackageId", lifecycleOldSourcePackageId);
  const deleteOldSourcePackageDialog = acceptVerifiedAppConfirmation(
    /Delete workspace file\?/,
    new RegExp(`Delete '${lifecycleOldFileName}'.+cannot be undone\\.`),
    lifecycleOldFileName
  );
  await page.locator("#deleteSourcePackageButton").click();
  await deleteOldSourcePackageDialog;
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
  logStep("workspace-file-batch-delete");
  const batchDisposableFileName = `ui-batch-disposable-${Date.now()}.txt`;
  const batchDisposableResponse = await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`,
    {
      body: {
        fileName: batchDisposableFileName,
        mediaType: "text/plain",
        sourceDocument: "Disposable workspace file for mixed batch deletion."
      }
    }
  );
  const batchDisposablePayload = await batchDisposableResponse.json();
  assert.ok(batchDisposablePayload.sourcePackage?.sourcePackageId);
  await page.locator("#refreshContentReadsButton").click();
  await clickCardAction(
    "Source Packages",
    "Add To Delete Batch",
    uploadedSourceFileName
  );
  await page
    .locator("#sourcePackageDeletionSelection")
    .filter({ hasText: "1 file(s) selected" })
    .waitFor({ timeout: 15_000 });
  await clickCardAction(
    "Source Packages",
    "Add To Delete Batch",
    batchDisposableFileName
  );
  await page
    .locator("#sourcePackageDeletionSelection")
    .filter({ hasText: "2 file(s) selected" })
    .waitFor();
  await expectButtonSelectorEnabled("#deleteSourcePackageBatchButton");
  const deleteSourcePackageBatchDialog = acceptAppConfirmation(
    /Delete selected workspace files\?/,
    /Delete 2 selected workspace file\(s\) and their unused derivatives\? Files that are still referenced will remain and be reported separately\./
  );
  await page.locator("#deleteSourcePackageBatchButton").click();
  await deleteSourcePackageBatchDialog;
  await page
    .locator("app-record-collection")
    .filter({
      has: page.getByRole("heading", {
        name: "Workspace File Batch Deletion Report"
      })
    })
    .filter({ hasText: "1/2 deleted" })
    .filter({ hasText: "1 used" })
    .filter({ hasText: batchDisposableFileName })
    .filter({ hasText: uploadedSourceFileName })
    .waitFor({ timeout: 15_000 });
  await page
    .locator("#sourcePackageDeletionSelection")
    .filter({ hasText: "1 file(s) selected" })
    .waitFor();
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.some(
        item => item?.sourcePackage?.fileName === uploadedSourceFileName
      ) &&
      !payload.items.some(
        item => item?.sourcePackage?.fileName === batchDisposableFileName
      )
  );
  await page.locator("#clearSourcePackageDeletionSelectionButton").click();
  await page
    .locator("#sourcePackageDeletionSelection")
    .filter({ hasText: "0 file(s) selected" })
    .waitFor();
  stopAfter("content-prompt-read-model");

  logStep("operational-only-login-migration-candidates");
  const operationalOnlyStudyUsername =
    "entry-operational-only-study-monitor";
  await page.goto(`${baseUrl}/app/runtime`, { waitUntil: "domcontentloaded" });
  await page.locator("#entryRosterText").waitFor();
  await fillAndCommit(
    "#entryRosterText",
    [
      "<Testtakers>",
      "  <CustomTexts>",
      "    <CustomText key=\"gm_headline\">Operational-only monitor</CustomText>",
      "  </CustomTexts>",
      "  <Profiles><GroupMonitor>",
      "    <Profile id=\"all\" label=\"All operational sessions\" view=\"small\" />",
      "  </GroupMonitor></Profiles>",
      "  <Group id=\"group:operational-only\" validFor=\"30\">",
      `    <Login mode="monitor-study" name="${operationalOnlyStudyUsername}" pw="operational-source-secret">`,
      "      <Profile id=\"all\" />",
      "    </Login>",
      "  </Group>",
      "</Testtakers>"
    ].join("\n")
  );
  const operationalOnlyPreview = page
    .locator("app-record-collection")
    .filter({
      has: page.getByRole("heading", { name: "Roster Input Preview" })
    });
  await operationalOnlyPreview
    .filter({ hasText: "1 operational login candidate detected" })
    .filter({ hasText: operationalOnlyStudyUsername })
    .filter({ hasText: "migration ready" })
    .filter({ hasText: "Source passwords stay unavailable" })
    .waitFor();
  await expectButtonSelectorEnabled("#importParticipantRosterButton");
  await expectButtonSelectorDisabled("#generateEntryLinksButton");
  const operationalOnlyImportResponsePromise = page.waitForResponse(
    response =>
      response.request().method() === "POST" &&
      response.url().endsWith("/participant-roster")
  );
  await page.locator("#importParticipantRosterButton").click();
  const operationalOnlyImportResponse =
    await operationalOnlyImportResponsePromise;
  assert.equal(operationalOnlyImportResponse.status(), 201);
  const operationalOnlyImportPayload =
    await operationalOnlyImportResponse.json();
  assert.equal(operationalOnlyImportPayload.importedCount, 0);
  assert.equal(operationalOnlyImportPayload.updatedCount, 0);
  assert.equal(
    operationalOnlyImportPayload.operationalLoginCandidates[0]?.loginKey,
    operationalOnlyStudyUsername
  );
  assert.equal(
    JSON.stringify(operationalOnlyImportPayload).includes(
      "operational-source-secret"
    ),
    false
  );
  const operationalOnlyCandidateCard = page
    .locator("app-record-collection")
    .filter({
      has: page.getByRole("heading", {
        name: "Operational Login Migration Candidates"
      })
    })
    .locator(".record-card")
    .filter({
      has: page.getByRole("heading", {
        name: operationalOnlyStudyUsername
      })
    })
    .filter({ hasText: "Ready to prepare a study_monitor account draft" })
    .filter({ hasText: "All operational sessions (all)" });
  await operationalOnlyCandidateCard.waitFor();
  await operationalOnlyCandidateCard
    .getByRole("button", { name: "Prepare Monitor Account" })
    .waitFor();
  await page.waitForFunction(
    expectedUsername =>
      window.localStorage
        .getItem("testcenter-rewrite-app-shell")
        ?.includes(expectedUsername) === true,
    operationalOnlyStudyUsername,
    { timeout: 15_000 }
  );
  const persistedOperationalCandidateState = await page.evaluate(() =>
    window.localStorage.getItem("testcenter-rewrite-app-shell")
  );
  assert.ok(persistedOperationalCandidateState);
  assert.equal(
    persistedOperationalCandidateState.includes("operational-source-secret"),
    false
  );
  assert.equal(
    persistedOperationalCandidateState.includes(
      operationalOnlyStudyUsername
    ),
    true
  );
  await page.evaluate(() => {
    const storageKey = "testcenter-rewrite-app-shell";
    const snapshot = JSON.parse(window.localStorage.getItem(storageKey) ?? "{}");
    window.localStorage.setItem(
      storageKey,
      JSON.stringify({
        ...snapshot,
        operationalLoginCandidatesView: JSON.stringify({ items: [] })
      })
    );
  });
  await page.reload({ waitUntil: "domcontentloaded" });
  await operationalOnlyCandidateCard.waitFor();
  await operationalOnlyCandidateCard
    .getByRole("button", { name: "Prepare Monitor Account" })
    .waitFor();
  stopAfter("operational-only-login-migration-candidates");

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
  await page.goto(`${baseUrl}/participant`, { waitUntil: "domcontentloaded" });
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
  await page.goto(`${baseUrl}/participant`, { waitUntil: "domcontentloaded" });
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
  await page.goto(`${baseUrl}/participant`, { waitUntil: "domcontentloaded" });
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
  const legacyShortLinkLoginKey = "student-legacy-short-link";
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
          ].join(","),
          [
            legacyShortLinkLoginKey,
            "group:legacy-short-link",
            "Student Legacy Short Link"
          ].join(",")
        ].join("\n")
      }
    }
  );
  logStep("participant-entry-legacy-short-link");
  const legacyShortLinkContext = await browser.newContext();
  await legacyShortLinkContext.addInitScript(
    ({ staleTenantKey, staleWorkspaceKey }) => {
      window.localStorage.setItem(
        "testcenter-rewrite-app-shell",
        JSON.stringify({
          tenantKey: staleTenantKey,
          workspaceKey: staleWorkspaceKey,
          loginKey: "stale-login",
          groupKey: "group:stale",
          bookletKey: "booklet:stale",
          participantSessionId: "stale-session",
          testRunId: "stale-run"
        })
      );
    },
    {
      staleTenantKey: ambiguousParticipantTenantA,
      staleWorkspaceKey: ambiguousParticipantWorkspaceKey
    }
  );
  const legacyShortLinkPage = await legacyShortLinkContext.newPage();
  await legacyShortLinkPage.goto(
    `${baseUrl}/#/${encodeURIComponent(legacyShortLinkLoginKey)}`,
    { waitUntil: "domcontentloaded" }
  );
  await legacyShortLinkPage.waitForURL(url =>
    url.pathname.endsWith("/participant") &&
    Boolean(url.searchParams.get("participantSessionId")) &&
    url.searchParams.get("legacyShortLink") == null &&
    url.searchParams.get("loginKey") == null &&
    url.hash === ""
  );
  await legacyShortLinkPage.waitForFunction(
    () =>
      document.querySelector("#participantRouteStatus")?.textContent?.trim() ===
        "signed_in" &&
      document.querySelector("#participantRouteRunId")?.textContent?.trim() ===
        "no run yet" &&
      document.querySelector("#participantRouteEntry") != null,
    undefined,
    { timeout: 15_000 }
  );
  await legacyShortLinkPage
    .locator("#participantEntryDisplayName")
    .filter({ hasText: "Student Legacy Short Link" })
    .waitFor();
  await legacyShortLinkContext.close();
  stopAfter("participant-entry-legacy-short-link");

  await page.goto(`${baseUrl}/participant`, { waitUntil: "domcontentloaded" });
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
          participantSession?.groupKey === participantEntrySignInGroupKey
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
    "UI smoke expected participant Sign In to create a participant session."
  );
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
    ([expectedSessionId, expectedDisplayName, expectedRunId]) =>
      document.querySelector("#participantRouteSessionLabel")?.textContent?.trim() ===
        expectedSessionId &&
      document.querySelector("#participantRouteDisplayName")?.textContent?.trim() ===
        expectedDisplayName &&
      document.querySelector("#participantRouteStatus")?.textContent?.trim() ===
        "running" &&
      document.querySelector("#participantRouteRunId")?.textContent?.trim() ===
        expectedRunId &&
      document.querySelector("#participantRouteEntry") == null,
    [
      participantEntrySignInSessionId,
      participantEntrySignInDisplayName,
      participantEntryStartedRunId
    ],
    { timeout: 15_000 }
  );
  assert.equal(
    await page.locator("#participantEntryIssueCode").count(),
    0,
    "Participant entry issue guidance should clear after a successful sign-in."
  );
  stopAfter("participant-entry-sign-in");
  logStep("participant-entry-start-after-sign-in");
  await page.waitForFunction(
    ([expectedSessionId, expectedRunId]) =>
      document.querySelector("#participantRouteSessionLabel")?.textContent?.trim() ===
        expectedSessionId &&
      document.querySelector("#participantRouteStatus")?.textContent?.trim() ===
        "running" &&
      document.querySelector("#participantRouteRunId")?.textContent?.trim() ===
        expectedRunId &&
      document.querySelector("#participantRouteEntry") == null,
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
  await page.locator("#participantRouteClearSessionButton").waitFor();
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
        "running" &&
      document.querySelector("#participantRouteEntry") == null,
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
  await page.setViewportSize({ width: 800, height: 300 });
  await page.evaluate(() => window.scrollTo({ top: 0 }));
  await page.waitForFunction(() => {
    const sentinel = document.querySelector("#participantStarterBottomSentinel");
    return (
      sentinel instanceof HTMLElement &&
      sentinel.getBoundingClientRect().top > window.innerHeight
    );
  });
  await page.locator("#participantStarterScrollButton").waitFor();
  await page.locator("#participantStarterScrollButton").click();
  await page.waitForFunction(() => {
    const sentinel = document.querySelector("#participantStarterBottomSentinel");
    if (!(sentinel instanceof HTMLElement)) {
      return false;
    }
    const bounds = sentinel.getBoundingClientRect();
    return bounds.top >= 0 && bounds.bottom <= window.innerHeight;
  });
  await page
    .locator("#participantStarterScrollButton")
    .waitFor({ state: "detached" });
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.goto(`${baseUrl}/#/${encodeURIComponent(participantReviewLoginKey)}`, {
    waitUntil: "domcontentloaded"
  });
  await page.waitForFunction(
    () =>
      document.querySelector("#participantRouteStatus")?.textContent?.trim() ===
        "signed_in" &&
      document.querySelector("#participantRouteRunId")?.textContent?.trim() ===
        "no run yet" &&
      document.querySelector("#participantRouteEntry") != null,
    undefined,
    { timeout: 15_000 }
  );
  await page.locator("#participantRouteDownloadReviewsButton").waitFor();
  const emptyParticipantReviewResponse = page.waitForResponse(
    response =>
      response.url().includes("/exports/reviews.csv") &&
      response.status() === 204
  );
  await page.locator("#participantRouteDownloadReviewsButton").click();
  await emptyParticipantReviewResponse;
  await page
    .locator("#participantRouteReviewDownloadFeedback")
    .filter({ hasText: "Keine Kommentare verfügbar." })
    .waitFor();
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
  await page.locator("#participantRouteClearSessionButton").click();
  await page.goto(`${baseUrl}/#/${encodeURIComponent(participantReviewLoginKey)}`, {
    waitUntil: "domcontentloaded"
  });
  await page.locator("#participantRouteDownloadReviewsButton").waitFor();
  const participantReviewDownloadPromise = page.waitForEvent("download");
  await page.locator("#participantRouteDownloadReviewsButton").click();
  const participantReviewDownload = await participantReviewDownloadPromise;
  assert.equal(
    participantReviewDownload.suggestedFilename(),
    "testcenter-reviews.csv"
  );
  const participantReviewDownloadPath = resolve(
    ".data/ui-smoke-participant-reviews.csv"
  );
  await participantReviewDownload.saveAs(participantReviewDownloadPath);
  const participantReviewCsv = await readFile(
    participantReviewDownloadPath,
    "utf8"
  );
  await rm(participantReviewDownloadPath, { force: true });
  assert.match(participantReviewCsv, /^\uFEFFgroupname;loginname;code;/);
  assert.match(participantReviewCsv, /"student-entry-review"/);
  assert.match(participantReviewCsv, /"Updated whole-test review comment"/);
  assert.match(participantReviewCsv, /category_content/);
  assert.match(participantReviewCsv, /category_tech/);
  await page.getByRole("button", { name: "Start Or Resume" }).click();
  await page.locator("#participantRouteReviewPanel").waitFor({ timeout: 15_000 });
  await page
    .locator(`.participant-review-item[data-review-id="${participantReviewId}"]`)
    .getByRole("button", { name: "Delete" })
    .click();
  await page
    .locator("#participantConfirmationTitle")
    .filter({ hasText: "Delete comment?" })
    .waitFor();
  await page
    .locator("#participantConfirmationMessage")
    .filter({ hasText: "Delete this participant comment permanently?" })
    .waitFor();
  await page.locator("#participantConfirmationContinueButton").click();
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
          participantSession?.groupKey === protectedParticipantGroupKey
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
    "UI smoke expected protected participant Sign In to create a participant session."
  );
  const protectedParticipantStartedPayload = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${protectedParticipantSessionId}/current-state`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      typeof payload.currentRunState === "object" &&
      payload.currentRunState != null &&
      payload.currentRunState.testRun?.status === "running"
  );
  await expectInputValue("#participantRouteSessionId", protectedParticipantSessionId);
  await page.waitForFunction(
    ([expectedSessionId, expectedDisplayName, expectedRunId]) =>
      document.querySelector("#participantRouteSessionLabel")?.textContent?.trim() ===
        expectedSessionId &&
      document.querySelector("#participantRouteDisplayName")?.textContent?.trim() ===
        expectedDisplayName &&
      document.querySelector("#participantRouteStatus")?.textContent?.trim() ===
        "running" &&
      document.querySelector("#participantRouteRunId")?.textContent?.trim() ===
        expectedRunId &&
      document.querySelector("#participantRouteEntry") == null,
    [
      protectedParticipantSessionId,
      protectedParticipantDisplayName,
      protectedParticipantStartedPayload.currentRunState.testRun.testRunId
    ],
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
          "      <Booklet codes=\"123 456\">booklet:starter</Booklet>",
          "      <ViewSettings>",
          "        <theme>Sekundar</theme>",
          "        <codeInput><type>keypad-symbols-alt</type><length>3</length></codeInput>",
          "      </ViewSettings>",
          "    </Login>",
          "  </Group>",
          "</Testtakers>"
        ].join("\n")
      }
    }
  );
  await page.locator("#participantRouteClearSessionButton").click();
  await expectInputValue("#participantRouteSessionId", "");
  const applicationThemeBeforeCodedParticipant = await page.evaluate(
    () => document.documentElement.dataset.applicationTheme
  );
  await fillAndCommitUntilValue("#participantLoginKey", codedParticipantLoginKey);
  await fillAndCommitUntilValue("#participantRouteGroupKey", codedParticipantGroupKey);
  await fillAndCommitUntilValue("#participantPassword", "");
  await page.locator("#participantRouteSignInButton").click();
  await page.locator("#participantCodePrompt").waitFor({ timeout: 15_000 });
  await page.locator("#participantCodeKeypad").waitFor({ timeout: 15_000 });
  assert.equal(
    await page.locator("#participantCode").count(),
    0,
    "The imported keypad view must replace the participant text code field."
  );
  assert.equal(
    await page.evaluate(() => document.documentElement.dataset.applicationTheme),
    "Sekundar",
    "The participant roster theme must override the application theme during entry."
  );
  await page.waitForFunction(() => {
    const illustration = document.querySelector(
      "#participantCodeInputIllustration"
    );
    const companion = document.querySelector("#participantCodeInputCompanion");
    return (
      illustration instanceof HTMLImageElement &&
      illustration.complete &&
      illustration.naturalWidth > 0 &&
      illustration.src.endsWith(
        "/app/assets/images/code-input-illustration-teens.png"
      ) &&
      companion instanceof HTMLImageElement &&
      companion.complete &&
      companion.naturalWidth > 0 &&
      companion.src.endsWith("/app/assets/images/bird-character.png")
    );
  });
  await page
    .locator(".participant-code-control")
    .filter({ hasText: "Project Access Code" })
    .filter({ has: page.locator("#participantCodeKeypad") })
    .waitFor();
  await page
    .locator("#participantCodePrompt")
    .filter({ hasText: "Ask the project supervisor for your access code." })
    .waitFor();
  await expectInputValue("#participantRouteSessionId", "");
  await page.locator("#participantCodeKeypadValue-1").click();
  await page.locator("#participantCodeKeypadValue-1").click();
  await page.locator("#participantCodeKeypadValue-1").click();
  await page
    .locator("#participantEntryIssueCode")
    .filter({ hasText: "participant_code_invalid" })
    .waitFor({ timeout: 15_000 });
  assert.equal(
    await page.locator("#participantCodeKeypad .participant-code-slots .is-filled").count(),
    0,
    "An invalid keypad code should clear before the retry."
  );
  await page.locator("#participantCodeKeypadValue-1").click();
  await page.locator("#participantCodeKeypadValue-2").click();
  await page.locator("#participantCodeKeypadValue-3").click();
  const codedParticipantSessionsPayload = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-sessions`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.some(
        item =>
          item?.participantSession?.loginKey === codedParticipantLoginKey &&
          item?.participantSession?.participantCode === "123"
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
  const codedParticipantStartedPayload = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${codedParticipantSessionId}/current-state`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      typeof payload.currentRunState === "object" &&
      payload.currentRunState != null &&
      payload.currentRunState.testRun?.status === "running"
  );
  const codedParticipantRunId =
    codedParticipantStartedPayload.currentRunState.testRun.testRunId;
  await expectInputValue("#participantRouteSessionId", codedParticipantSessionId);
  await page.waitForFunction(
    expectedRunId =>
      document.querySelector("#participantRouteStatus")?.textContent?.trim() ===
        "running" &&
      document.querySelector("#participantRouteRunId")?.textContent?.trim() ===
        expectedRunId &&
      document.querySelector("#participantRouteEntry") == null,
    codedParticipantRunId,
    { timeout: 15_000 }
  );
  assert.equal(
    await page.locator("#participantCodeKeypad").count(),
    0,
    "A successful code challenge should close the keypad and open the only assigned Booklet."
  );
  const persistedAfterParticipantCode = await page.evaluate(() =>
    JSON.parse(localStorage.getItem("testcenter-rewrite-app-shell") ?? "{}")
  );
  assert.equal(
    Object.hasOwn(persistedAfterParticipantCode, "participantCode"),
    false,
    "Participant codes should not be persisted in shell localStorage."
  );
  await page.locator("#participantRouteClearSessionButton").click();
  await expectInputValue("#participantRouteSessionId", "");
  assert.equal(
    await page.evaluate(() => document.documentElement.dataset.applicationTheme),
    applicationThemeBeforeCodedParticipant,
    "Leaving the participant session should restore the application theme."
  );

  logStep("participant-entry-legacy-short-link-code");
  const codedLegacyContext = await browser.newContext();
  const codedLegacyPage = await codedLegacyContext.newPage();
  await codedLegacyPage.goto(
    `${baseUrl}/#/${encodeURIComponent(codedParticipantLoginKey)}`,
    { waitUntil: "domcontentloaded" }
  );
  await codedLegacyPage.locator("#participantCodeKeypad").waitFor({ timeout: 15_000 });
  await codedLegacyPage.locator("#participantCodeKeypadValue-4").click();
  await codedLegacyPage.locator("#participantCodeKeypadValue-5").click();
  await codedLegacyPage.locator("#participantCodeKeypadValue-6").click();
  await codedLegacyPage.waitForURL(url =>
    url.pathname.endsWith("/participant") &&
    Boolean(url.searchParams.get("participantSessionId")) &&
    url.searchParams.get("legacyShortLink") == null &&
    url.searchParams.get("loginKey") == null &&
    url.hash === ""
  );
  const codedLegacySessionId = new URL(codedLegacyPage.url()).searchParams.get(
    "participantSessionId"
  );
  assert.ok(
    codedLegacySessionId,
    "The legacy code link should be replaced with an opaque participant session link."
  );
  const codedLegacyStartedPayload = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${codedLegacySessionId}/current-state`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      typeof payload.currentRunState === "object" &&
      payload.currentRunState != null &&
      payload.currentRunState.testRun?.status === "running"
  );
  await codedLegacyPage.waitForFunction(
    expectedRunId =>
      document.querySelector("#participantRouteStatus")?.textContent?.trim() ===
        "running" &&
      document.querySelector("#participantRouteRunId")?.textContent?.trim() ===
        expectedRunId &&
      document.querySelector("#participantRouteEntry") == null,
    codedLegacyStartedPayload.currentRunState.testRun.testRunId,
    { timeout: 15_000 }
  );
  assert.equal(
    await codedLegacyPage.evaluate(() => {
      const persisted = JSON.parse(
        localStorage.getItem("testcenter-rewrite-app-shell") ?? "{}"
      );
      return Object.hasOwn(persisted, "participantCode");
    }),
    false,
    "Legacy-link participant codes must not be persisted in shell localStorage."
  );
  await codedLegacyContext.close();
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
    { waitUntil: "domcontentloaded" }
  );
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
  const participantRouteSessionAnchor = page.locator("#participantRouteSessionAnchor");
  await participantRouteSessionAnchor.waitFor({ state: "visible" });
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
    ([expectedLoginKey, expectedGroupKey, expectedDisplayName, expectedSessionId, expectedResponse]) =>
      document.querySelector("#participantRouteStatus")?.textContent?.trim() ===
        "running" &&
      document.querySelector("#participantRouteEntry") == null &&
      document.querySelector("#participantRouteLoginLabel")?.textContent?.trim() ===
        expectedLoginKey &&
      document.querySelector("#participantRouteGroupLabel")?.textContent?.trim() ===
        expectedGroupKey &&
      document.querySelector("#participantRouteDisplayName")?.textContent?.trim() ===
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
        "Explain how the starter example works." &&
      document.querySelector("#participantRouteUnitResponse")?.value ===
        expectedResponse,
    [
      participantRouteLoginKey,
      participantRouteGroupKey,
      participantRouteDisplayName,
      participantRouteSessionId,
      participantRouteUnitResponse
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
    expectedUnitKey =>
      document.querySelector("#participantRouteStatus")?.textContent?.trim() ===
        "paused" &&
      document.querySelector("#participantRouteUnitKey")?.textContent?.trim() ===
        expectedUnitKey &&
      document.querySelector("#participantRoutePausedState") != null &&
      document.querySelector("#participantRouteUnitResponse") == null &&
      document
        .querySelector("#participantRouteActions")
        ?.textContent?.includes("resume"),
    participantRouteUnitKey,
    { timeout: 15_000 }
  );
  await clickAction("Continue Test");
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
  await page.evaluate(() => {
    window.localStorage.removeItem("testcenter-rewrite-app-shell");
  });
  await page.goto(
    `${baseUrl}/participant?participantSessionId=${encodeURIComponent(
      participantRouteSessionId
    )}`,
    { waitUntil: "domcontentloaded" }
  );
  await page.waitForFunction(
    ([expectedSessionId, expectedUnitKey, expectedResponse]) =>
      document.querySelector("#participantRouteSessionLabel")?.textContent?.trim() ===
        expectedSessionId &&
      document.querySelector("#participantRouteUnitKey")?.textContent?.trim() ===
        expectedUnitKey &&
      document.querySelector("#participantRouteUnitResponse")?.value ===
        expectedResponse &&
      document.querySelector("#participantRouteUnitOverview")?.textContent?.trim() ===
        "2/3 answered · 1 open" &&
      document.querySelector("#participantRouteEntry") == null,
    [
      participantRouteSessionId,
      participantRouteUnitKey,
      participantRouteUnitResponse
    ],
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
      document.querySelector("#participantRouteCompletedState") != null &&
      document
        .querySelector("#participantRouteCompletedDetail")
        ?.textContent?.includes("responses are closed") &&
      document.querySelector("#participantRouteProgressLabel")?.textContent?.trim() ===
        "3 / 3 responses saved" &&
      document.querySelector("#participantRouteMissingLabel")?.textContent?.trim() ===
        "All units have a saved response." &&
      document
        .querySelector("#participantRouteCompletionLabel")
        ?.textContent?.includes("Completed") &&
      document.querySelector("app-verona-player-host") == null &&
      document.querySelector("#participantRouteUnitResponse") == null &&
      document.querySelector("#participantRouteUnitKey") == null &&
      document.querySelector("#participantRouteReviewPanel") == null &&
      document.querySelector("#participantRouteTestletTimer") == null &&
      document.querySelector("#participantRouteConnectionState") == null &&
      document.querySelector("#participantRouteBookletLoadingStatus") == null &&
      document.querySelector(".participant-runtime-toolbar") == null &&
      document.querySelector("#participantRouteCompleteButton") == null,
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
    { waitUntil: "domcontentloaded" }
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
      document.querySelector("#participantRouteCompletedState") != null &&
      document
        .querySelector("#participantRouteCompletionLabel")
        ?.textContent?.includes("Completed") &&
      document.querySelector("app-verona-player-host") == null &&
      document.querySelector("#participantRouteUnitResponse") == null &&
      document.querySelector("#participantRouteCompleteButton") == null,
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
  const veronaSimulationLoginKey = "student-verona-simulation";
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
      <output id="playerSessionId"></output>
      <output id="playerStartCount">0</output>
      <output id="playerConfigChangeCount">0</output>
      <output id="playerNavigationDenied"></output>
      <output id="playerStartPage"></output>
      <output id="playerCurrentPage"></output>
      <output id="playerResource"></output>
      <output id="playerResourceRange"></output>
      <output id="playerResourceMultiRange"></output>
      <output id="playerClipboardResult"></output>
      <label>Player answer <input id="playerAnswer" /></label>
      <button id="playerEnd" type="button">End from player</button>
      <button id="playerDownload" type="button">Download from player</button>
      <button id="playerPopup" type="button">Open player help</button>
      <button id="playerClipboard" type="button">Use player clipboard</button>
      <button id="playerRuntimeError" type="button">Report runtime error</button>
      <script>
        let sessionId = "";
        let currentPage = "page-1";
        const sendState = (includeLog = true) => {
          const answer = document.querySelector("#playerAnswer").value;
          parent.postMessage({
            type: "vopStateChangedNotification",
            sessionId,
            unitState: {
              dataParts: { answer },
              unitStateDataType: "verona-smoke@1"
            },
            ...(includeLog ? { log: [{
              key: "PLAYER_STATE_CHANGED",
              timeStamp: Date.now(),
              content: answer
            }] } : {})
          }, "*");
          parent.postMessage({
            type: "vopStateChangedNotification",
            sessionId,
            unitState: {
              presentationProgress: "complete",
              responseProgress: answer ? "complete" : "none"
            }
          }, "*");
          parent.postMessage({
            type: "vopStateChangedNotification",
            sessionId,
            playerState: {
              currentPage,
              validPages: [
                { id: "page-1", label: "Introduction" },
                { id: "page-2", label: "Review" }
              ]
            }
          }, "*");
        };
        addEventListener("message", event => {
          if (event.data?.type === "vopPageNavigationCommand") {
            currentPage = String(event.data.target || "");
            document.querySelector("#playerCurrentPage").textContent = currentPage;
            sendState(false);
            return;
          }
          if (event.data?.type === "vopPlayerConfigChangedNotification") {
            document.querySelector("#playerConfig").textContent = JSON.stringify(event.data.playerConfig);
            const count = Number(document.querySelector("#playerConfigChangeCount").textContent || "0");
            document.querySelector("#playerConfigChangeCount").textContent = String(count + 1);
            return;
          }
          if (event.data?.type === "vopNavigationDeniedNotification") {
            document.querySelector("#playerNavigationDenied").textContent = JSON.stringify(event.data.reason);
            return;
          }
          if (event.data?.type !== "vopStartCommand") return;
          sessionId = event.data.sessionId;
          document.querySelector("#playerSessionId").textContent = sessionId;
          const startCount = Number(document.querySelector("#playerStartCount").textContent || "0");
          document.querySelector("#playerStartCount").textContent = String(startCount + 1);
          document.querySelector("#playerDefinition").textContent = event.data.unitDefinition;
          document.querySelector("#playerConfig").textContent = JSON.stringify(event.data.playerConfig);
          document.querySelector("#playerStartPage").textContent = String(event.data.playerConfig?.startPage || "");
          currentPage = String(event.data.playerState?.currentPage || event.data.playerConfig?.startPage || "page-1");
          document.querySelector("#playerCurrentPage").textContent = currentPage;
          document.querySelector("#playerAnswer").value = event.data.unitState?.dataParts?.answer || "";
          document.querySelector("#playerAnswer").addEventListener("input", () => sendState(true));
          parent.postMessage({
            type: "vopStateChangedNotification",
            sessionId,
            unitState: null
          }, "*");
          parent.postMessage({
            type: "vopStateChangedNotification",
            sessionId,
            playerState: null
          }, "*");
          parent.postMessage({
            type: "vopUnitNavigationRequestedNotification",
            sessionId,
            target: 1
          }, "*");
          parent.postMessage({
            type: "vopStateChangedNotification",
            sessionId,
            log: [null, {
              key: "PLAYER_RECOVERED_AFTER_MALFORMED_LOG",
              timeStamp: Date.now(),
              content: "valid"
            }]
          }, "*");
          sendState(false);
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
          targetRelative: "end"
        }, "*"));
        document.querySelector("#playerDownload").addEventListener("click", () => {
          const link = document.createElement("a");
          const url = URL.createObjectURL(new File(["Verona player export"], "verona-player-export.txt", {
            type: "text/plain"
          }));
          link.href = url;
          link.download = "verona-player-export.txt";
          document.body.appendChild(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 0);
        });
        document.querySelector("#playerPopup").addEventListener("click", () => {
          window.open("about:blank", "verona-player-help");
        });
        document.querySelector("#playerClipboard").addEventListener("click", async () => {
          const output = document.querySelector("#playerClipboardResult");
          try {
            await navigator.clipboard.writeText("Verona player clipboard");
            output.textContent = await navigator.clipboard.readText();
          } catch (error) {
            output.textContent = "clipboard-error: " + error.message;
          }
        });
        document.querySelector("#playerRuntimeError").addEventListener("click", () => parent.postMessage({
          type: "vopRuntimeErrorNotification",
          sessionId,
          code: "runtime-error",
          message: "Synthetic player failure"
        }, "*"));
        addEventListener("unload", () => {
          document.querySelector("#playerAnswer").value = "Saved during player unload";
          parent.postMessage({
            type: "vopRuntimeErrorNotification",
            sessionId,
            code: "unload-runtime-error",
            message: "Synthetic unload failure"
          }, "*");
          sendState(false);
        });
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
            <Config key="loading_mode">LAZY</Config>
            <Config key="force_response_complete">OFF</Config>
            <Config key="allow_player_to_terminate_test">LAST_UNIT</Config>
            <Config key="unit_menu">OFF</Config>
            <Config key="unit_navibuttons">OFF</Config>
            <Config key="pagingMode">concat-scroll</Config>
            <Config key="logPolicy">debug</Config>
            <Config key="navbar_page_label">LABEL</Config>
            <Config key="navbar_page_controls_hidden">FALSE</Config>
            <Config key="navbar_backward_button">DYNAMIC</Config>
            <Config key="navbar_forward_button">DYNAMIC</Config>
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
              booklet_console_warning: "Project console warning",
              booklet_loadingBlock: "Project block is loading",
              booklet_unitLoadingPending: "Project player is queued.",
              booklet_unitLoadingUnknownProgress: "Project loading progress is pending.",
              booklet_unitLoading: "Project player loaded",
              booklet_errormessage: "The project player could not be loaded.",
              booklet_reload: "Restart project player",
              booklet_msgTimerStarted: "Project timer started: ",
              booklet_msgTimeOver: "Project time is over.",
              booklet_msgTimerCancelled: "Project timer was cancelled.",
              login_unsupportedBrowserBanner:
                "Project browser %s %s needs an update.",
              login_pagesNaviPrompt: "Project pages:",
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
          },
          {
            loginKey: veronaSimulationLoginKey,
            groupKey: "group:verona-smoke",
            bookletKey: veronaBookletKey,
            displayName: "Verona Simulation Participant",
            executionMode: "run-simulation",
            customTexts: {
              "booklet_warningLeaveTitle-unit": "Leave simulation task?",
              "booklet_warningLeaveTextPrompt-unit":
                "This simulation task will close after leaving."
            }
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
  const lazyBookletPreloadPattern =
    /\/current-state\?includeBookletAssets=true$/;
  const lazyBookletPreloadStarted = page.waitForRequest(
    request => lazyBookletPreloadPattern.test(request.url())
  );
  let releaseLazyBookletPreload;
  const lazyBookletPreloadRelease = new Promise(resolve => {
    releaseLazyBookletPreload = resolve;
  });
  const holdLazyBookletPreload = async route => {
    await lazyBookletPreloadRelease;
    await route.continue();
  };
  await page.route(lazyBookletPreloadPattern, holdLazyBookletPreload);
  let lazyBookletPreloadCompleted = false;
  const lazyBookletPreloadResponsePromise = page
    .waitForResponse(
      response => lazyBookletPreloadPattern.test(response.url())
    )
    .then(response => {
      lazyBookletPreloadCompleted = true;
      return response;
    });
  const veronaConsoleWarnings = [];
  const recordVeronaConsoleWarning = message => {
    if (
      message.type() === "warning" &&
      message.text().includes("Project console warning")
    ) {
      veronaConsoleWarnings.push(message.text());
    }
  };
  page.on("console", recordVeronaConsoleWarning);
  await page.goto(
    `${baseUrl}/participant?${new URLSearchParams({
      tenantKey,
      workspaceKey,
      loginKey: veronaLoginKey,
      bookletKey: veronaBookletKey
    }).toString()}`,
    { waitUntil: "domcontentloaded" }
  );
  await page
    .locator("#participantRouteTestletGateLabel")
    .filter({ hasText: "Protected Verona Block" })
    .waitFor({ timeout: 15_000 });
  await lazyBookletPreloadStarted;
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
  const malformedVeronaMessageErrors = [];
  const recordMalformedVeronaMessageError = error => {
    malformedVeronaMessageErrors.push(error.message);
  };
  page.on("pageerror", recordMalformedVeronaMessageError);
  await page.locator("#participantRouteTestletUnlockCode").fill(veronaTestletCode);
  await page.locator("#participantRouteTestletUnlockButton").click();
  await page
    .locator("#participantVeronaPlayerStatus")
    .filter({ hasText: "running" })
    .waitFor({ timeout: 15_000 });
  assert.equal(
    lazyBookletPreloadCompleted,
    false,
    "LAZY loading must mount the current Player before background Booklet loading completes."
  );
  releaseLazyBookletPreload();
  const lazyBookletPreloadResponse = await lazyBookletPreloadResponsePromise;
  assert.equal(lazyBookletPreloadResponse.status(), 200);
  const lazyBookletPreloadPayload = await lazyBookletPreloadResponse.json();
  assert.equal(
    lazyBookletPreloadPayload.currentRunState.booklet.policy.player.loadingMode,
    "lazy"
  );
  assert.deepEqual(
    lazyBookletPreloadPayload.currentRunState.bookletAssets.units.map(
      unit => unit.unitKey
    ),
    [veronaUnitKey]
  );
  await page
    .locator("#participantRouteBookletLoadingStatus")
    .filter({ hasText: "1 unit asset loaded" })
    .waitFor();
  await page.unroute(lazyBookletPreloadPattern, holdLazyBookletPreload);
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
  const veronaPlayerFrameElement = page.locator("#participantVeronaPlayerFrame");
  const veronaSandboxTokens = new Set(
    ((await veronaPlayerFrameElement.getAttribute("sandbox")) ?? "")
      .split(/\s+/)
      .filter(Boolean)
  );
  assert.ok(veronaSandboxTokens.has("allow-downloads"));
  assert.ok(veronaSandboxTokens.has("allow-popups"));
  assert.equal(veronaSandboxTokens.has("allow-same-origin"), false);
  assert.equal(veronaSandboxTokens.has("allow-top-navigation"), false);
  assert.equal(veronaSandboxTokens.has("allow-popups-to-escape-sandbox"), false);
  assert.equal(
    await veronaPlayerFrameElement.getAttribute("allow"),
    "clipboard-read; clipboard-write"
  );
  const playerDownloadPromise = page.waitForEvent("download");
  await veronaFrame.locator("#playerDownload").click();
  const playerDownload = await playerDownloadPromise;
  assert.equal(playerDownload.suggestedFilename(), "verona-player-export.txt");
  const playerPopupPromise = page.waitForEvent("popup");
  await veronaFrame.locator("#playerPopup").click();
  const playerPopup = await playerPopupPromise;
  assert.equal(playerPopup.url(), "about:blank");
  await playerPopup.close();
  await veronaFrame.locator("#playerClipboard").click();
  await veronaFrame
    .locator("#playerClipboardResult")
    .filter({ hasText: "Verona player clipboard" })
    .waitFor({ timeout: 10_000 });
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
  assert.equal(
    await veronaFrame.locator("#playerSessionId").textContent(),
    veronaUnitKey,
    "The Verona session id must retain the original active Unit alias."
  );
  assert.equal(
    JSON.parse((await veronaFrame.locator("#playerConfig").textContent()) ?? "{}")
      .unitId,
    veronaUnitKey
  );
  await page
    .locator("#participantVeronaPageLabel")
    .filter({ hasText: "Introduction" })
    .waitFor();
  await page
    .locator("#participantVeronaPageNavigationPrompt")
    .filter({ hasText: "Project pages:" })
    .waitFor();
  assert.deepEqual(
    veronaConsoleWarnings,
    ["Project console warning"],
    "The effective console warning should be emitted once when the run starts."
  );
  page.off("console", recordVeronaConsoleWarning);
  page.off("pageerror", recordMalformedVeronaMessageError);
  assert.deepEqual(
    malformedVeronaMessageErrors,
    [],
    "Malformed Verona notifications must be ignored without crashing the Participant host."
  );
  await expectButtonSelectorDisabled("#participantVeronaPreviousPageButton");
  await expectButtonSelectorEnabled("#participantVeronaNextPageButton");
  await expectButtonSelectorDisabled("#participantVeronaGlobalBackwardButton");
  await expectButtonSelectorEnabled("#participantVeronaGlobalForwardButton");
  await page.locator("#participantVeronaGlobalForwardButton").click();
  await veronaFrame
    .locator("#playerCurrentPage")
    .filter({ hasText: "page-2" })
    .waitFor();
  await page
    .locator("#participantVeronaPageLabel")
    .filter({ hasText: "Review" })
    .waitFor();
  await expectButtonSelectorEnabled("#participantVeronaPreviousPageButton");
  await expectButtonSelectorDisabled("#participantVeronaNextPageButton");
  await expectButtonSelectorEnabled("#participantVeronaGlobalBackwardButton");
  await expectButtonSelectorDisabled("#participantVeronaGlobalForwardButton");
  await page.locator("#participantVeronaGlobalBackwardButton").click();
  await veronaFrame
    .locator("#playerCurrentPage")
    .filter({ hasText: "page-1" })
    .waitFor();
  await page
    .locator("#participantVeronaPageLabel")
    .filter({ hasText: "Introduction" })
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
  assert.equal(
    await page.locator("#participantRouteNextUnitButton").count(),
    0
  );
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
  await veronaFrame
    .locator("#playerNavigationDenied")
    .filter({ hasText: '["responsesIncomplete"]' })
    .waitFor();
  const guardedPlayerEndState = await (
    await fetch(
      `${baseUrl}/api/v1/participant/sessions/${veronaParticipantSessionId}/current-state`
    )
  ).json();
  assert.equal(guardedPlayerEndState.currentRunState.testRun.status, "running");
  const veronaTestRunId =
    guardedPlayerEndState.currentRunState.testRun.testRunId;
  assert.ok(veronaTestRunId);
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
  const recoveredMalformedVeronaLog = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/test-logs?loginKey=${encodeURIComponent(
      veronaLoginKey
    )}&logKey=PLAYER_RECOVERED_AFTER_MALFORMED_LOG&unitKey=${encodeURIComponent(veronaUnitKey)}`,
    payload =>
      Array.isArray(payload?.items) &&
      payload.items.some(item => item.testLog?.logContent === "valid")
  );
  assert.equal(recoveredMalformedVeronaLog.items.length, 1);
  const veronaPlayerLifecycleLogs = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/test-logs?loginKey=${encodeURIComponent(
      veronaLoginKey
    )}&logKey=PLAYER&unitKey=${encodeURIComponent(veronaUnitKey)}`,
    payload => {
      const contents = payload?.items?.map(item => item.testLog?.logContent) ?? [];
      return contents.includes("LOADING") && contents.includes("RUNNING");
    }
  );
  assert.deepEqual(
    new Set(
      veronaPlayerLifecycleLogs.items.map(item => item.testLog?.logContent)
    ),
    new Set(["LOADING", "RUNNING"])
  );
  const veronaCurrentPageLogs = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/test-logs?loginKey=${encodeURIComponent(
      veronaLoginKey
    )}&logKey=CURRENT_PAGE_NR&unitKey=${encodeURIComponent(veronaUnitKey)}`,
    payload => {
      const contents = payload?.items?.map(item => item.testLog?.logContent) ?? [];
      return contents.includes("page-1") && contents.includes("page-2");
    }
  );
  assert.deepEqual(
    new Set(veronaCurrentPageLogs.items.map(item => item.testLog?.logContent)),
    new Set(["page-1", "page-2"])
  );
  const veronaCurrentPageIndexLogs = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/test-logs?loginKey=${encodeURIComponent(
      veronaLoginKey
    )}&logKey=CURRENT_PAGE_ID&unitKey=${encodeURIComponent(veronaUnitKey)}`,
    payload => {
      const contents = payload?.items?.map(item => item.testLog?.logContent) ?? [];
      return contents.includes("0") && contents.includes("1");
    }
  );
  assert.deepEqual(
    new Set(
      veronaCurrentPageIndexLogs.items.map(item => item.testLog?.logContent)
    ),
    new Set(["0", "1"])
  );
  const veronaPageCountLogs = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/test-logs?loginKey=${encodeURIComponent(
      veronaLoginKey
    )}&logKey=PAGE_COUNT&unitKey=${encodeURIComponent(veronaUnitKey)}`,
    payload =>
      Array.isArray(payload?.items) &&
      payload.items.some(item => item.testLog?.logContent === "2")
  );
  assert.deepEqual(
    new Set(veronaPageCountLogs.items.map(item => item.testLog?.logContent)),
    new Set(["2"])
  );
  const veronaPresentationProgressLogs = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/test-logs?loginKey=${encodeURIComponent(
      veronaLoginKey
    )}&logKey=PRESENTATION_PROGRESS&unitKey=${encodeURIComponent(veronaUnitKey)}`,
    payload =>
      Array.isArray(payload?.items) &&
      payload.items.some(item => item.testLog?.logContent === "complete")
  );
  assert.deepEqual(
    new Set(
      veronaPresentationProgressLogs.items.map(
        item => item.testLog?.logContent
      )
    ),
    new Set(["", "complete"])
  );
  const veronaResponseProgressLogs = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/test-logs?loginKey=${encodeURIComponent(
      veronaLoginKey
    )}&logKey=RESPONSE_PROGRESS&unitKey=${encodeURIComponent(veronaUnitKey)}`,
    payload => {
      const contents = payload?.items?.map(item => item.testLog?.logContent) ?? [];
      return contents.includes("none") && contents.includes("complete");
    }
  );
  assert.deepEqual(
    new Set(
      veronaResponseProgressLogs.items.map(item => item.testLog?.logContent)
    ),
    new Set(["", "none", "complete"])
  );
  const isRuntimeLoadCompleteLog = item => {
    try {
      const browserVersion = JSON.parse(
        item.testLog?.logContent ?? "null"
      )?.browserVersion;
      return (
        typeof browserVersion === "string" && browserVersion !== "90.0.4430.93"
      );
    } catch {
      return false;
    }
  };
  const veronaLoadCompleteLogs = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/test-logs?loginKey=${encodeURIComponent(
      veronaLoginKey
    )}&testRunId=${encodeURIComponent(veronaTestRunId)}&logKey=LOADCOMPLETE`,
    payload =>
      Array.isArray(payload?.items) &&
      payload.items.some(isRuntimeLoadCompleteLog)
  );
  const veronaLoadCompleteLog = veronaLoadCompleteLogs.items.find(
    isRuntimeLoadCompleteLog
  );
  assert.ok(veronaLoadCompleteLog);
  assert.equal(veronaLoadCompleteLog.testLog?.unitKey, null);
  assert.equal(veronaLoadCompleteLog.testLog?.originalUnitId, null);
  const veronaLoadEnvironment = JSON.parse(
    veronaLoadCompleteLog.testLog.logContent
  );
  assert.equal(veronaLoadEnvironment.browserName, "Chrome");
  assert.match(veronaLoadEnvironment.browserVersion, /^\d+(?:\.\d+)+$/);
  assert.match(
    veronaLoadEnvironment.osName,
    /^(?:Android|Chrome OS|Chromium OS|iOS|Linux|Mac OS|Windows)(?:\s.+)?$/
  );
  assert.equal(veronaLoadEnvironment.device, "");
  assert.ok(veronaLoadEnvironment.screenSizeWidth > 0);
  assert.ok(veronaLoadEnvironment.screenSizeHeight > 0);
  assert.ok(Number.isSafeInteger(veronaLoadEnvironment.loadTime));
  assert.ok(veronaLoadEnvironment.loadTime >= 0);
  const veronaConnectionLogs = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/test-logs?loginKey=${encodeURIComponent(
      veronaLoginKey
    )}&testRunId=${encodeURIComponent(veronaTestRunId)}&logKey=CONNECTION`,
    payload =>
      Array.isArray(payload?.items) &&
      payload.items.some(item => item.testLog?.logContent === "POLLING")
  );
  assert.ok(
    veronaConnectionLogs.items.every(
      item =>
        item.testLog?.unitKey === null &&
        item.testLog?.originalUnitId === null
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
  await veronaFrame
    .locator("#playerConfig")
    .filter({ hasText: '"enabledNavigationTargets":["end"]' })
    .waitFor({ timeout: 15_000 });
  assert.equal(
    await veronaFrame.locator("#playerStartCount").textContent(),
    "1",
    "A navigation-policy update must not restart the running Verona Player."
  );
  assert.ok(
    Number(await veronaFrame.locator("#playerConfigChangeCount").textContent()) >= 1,
    "The running Verona Player should receive vopPlayerConfigChangedNotification."
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
  assert.equal(
    (await page.locator("#participantRouteRunId").textContent())?.trim(),
    veronaTestRunId
  );
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
    { waitUntil: "domcontentloaded" }
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
    { waitUntil: "domcontentloaded" }
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
  await backgroundSyncedVeronaFrame
    .locator("#playerRuntimeError")
    .evaluate(button => {
      button.click();
      button.click();
    });
  await page
    .locator("#participantRouteControllerErrorState")
    .waitFor({ timeout: 15_000 });
  assert.equal(
    await page.locator("#participantRouteControllerErrorDetail").textContent(),
    "runtime-error: Synthetic player failure"
  );
  assert.equal(
    await page.locator("#participantRouteStatus").textContent(),
    "error"
  );
  assert.equal(await page.locator("#participantRouteEntry").count(), 0);
  assert.equal(
    await page.locator("#participantRouteControllerErrorText").textContent(),
    "The project player could not be loaded."
  );
  assert.equal(
    (await page.locator("#participantRouteControllerReloadButton").textContent())
      ?.trim(),
    "Restart project player"
  );
  for (const selector of [
    "app-verona-player-host",
    "#participantVeronaPlayerFrame",
    "#participantRouteUnitKey",
    "#participantRouteUnitResponse",
    "#participantRouteReviewPanel",
    "#participantRouteTestletTimer",
    "#participantRouteCompleteButton",
    "#participantVeronaReloadPlayerButton",
    "#participantConnectionState"
  ]) {
    assert.equal(
      await page.locator(selector).count(),
      0,
      `Controller error must remove ${selector} from the participant unit surface.`
    );
  }
  for (const selector of [
    "#participantRouteSignInButton",
    "#participantRouteStartOrResumeButton",
    "#participantRouteRefreshCurrentStateButton",
    "#participantRouteClearSessionButton",
    "#participantRouteSessionAnchor",
    "#participantRouteCopySessionLinkButton"
  ]) {
    assert.equal(
      await page.locator(selector).count(),
      0,
      `Controller error must remove ${selector} from the participant route.`
    );
  }
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/test-logs?loginKey=${encodeURIComponent(
      veronaLoginKey
    )}&logKey=${encodeURIComponent("Runtime Error: runtime-error")}&unitKey=${encodeURIComponent(veronaUnitKey)}`,
    payload =>
      Array.isArray(payload?.items) &&
      payload.items.some(
        item =>
          item.testLog?.logKey === "Runtime Error: runtime-error" &&
          item.testLog?.logContent === "Synthetic player failure" &&
          item.testLog?.unitKey === veronaUnitKey
      )
  );
  const veronaControllerErrorLogs = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/test-logs?testRunId=${encodeURIComponent(
      veronaTestRunId
    )}&logKey=CONTROLLER&limit=100`,
    payload =>
      Array.isArray(payload?.items) &&
      payload.items.filter(
        item =>
          item.testLog?.logContent === "ERROR" &&
          item.testLog?.unitKey === null &&
          item.testLog?.originalUnitId === null
      ).length === 1
  );
  const veronaControllerErrorTimestamp =
    veronaControllerErrorLogs.items.find(
      item => item.testLog?.logContent === "ERROR"
    )?.testLog?.timestamp;
  assert.ok(Number.isSafeInteger(veronaControllerErrorTimestamp));
  await page.locator("#participantRouteControllerReloadButton").click();
  const controllerRecoveredVeronaFrame = page.frameLocator(
    "#participantVeronaPlayerFrame"
  );
  await controllerRecoveredVeronaFrame
    .locator("#playerAnswer")
    .waitFor({ timeout: 15_000 });
  await controllerRecoveredVeronaFrame
    .locator("#playerDefinition")
    .filter({ hasText: "Smoke unit definition" })
    .waitFor({ timeout: 15_000 });
  assert.equal(
    await page.locator("#participantRouteControllerErrorState").count(),
    0
  );
  assert.equal(
    await page.locator("#participantRouteStatus").textContent(),
    "running"
  );
  const recoveredVeronaControllerLogs = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/test-logs?testRunId=${encodeURIComponent(
      veronaTestRunId
    )}&logKey=CONTROLLER&limit=100`,
    payload =>
      Array.isArray(payload?.items) &&
      payload.items.some(
        item =>
          item.testLog?.logContent === "RUNNING" &&
          item.testLog?.unitKey === null &&
          item.testLog?.timestamp > veronaControllerErrorTimestamp
      )
  );
  assert.equal(
    recoveredVeronaControllerLogs.items.filter(
      item => item.testLog?.logContent === "ERROR"
    ).length,
    1,
    "Repeated notifications from one failed Player frame must persist one controller error."
  );
  assert.equal(
    await controllerRecoveredVeronaFrame.locator("#playerAnswer").inputValue(),
    backgroundSyncedResponse
  );
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
    { waitUntil: "domcontentloaded" }
  );
  const advisoryVeronaFrame = page.frameLocator("#participantVeronaPlayerFrame");
  await advisoryVeronaFrame.locator("#playerAnswer").waitFor({ timeout: 15_000 });
  await page.waitForTimeout(1_500);
  await page
    .locator("#participantRouteExecutionMode")
    .filter({ hasText: "run-trial" })
    .waitFor();
  await expectButtonSelectorEnabled("#participantRouteCompleteButton");
  await page.locator("#participantRouteCompleteButton").click();
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
    .locator("#participantConfirmationTitle")
    .filter({ hasText: "Leave task?" })
    .waitFor();
  await page
    .locator("#participantConfirmationMessage")
    .filter({ hasText: "cannot be opened again" })
    .waitFor();
  await page.waitForTimeout(250);
  await page.locator("#participantConfirmationContinueButton").click();
  await page
    .locator("#participantConfirmationTitle")
    .filter({ hasText: "Complete test?" })
    .waitFor();
  await page
    .locator("#participantConfirmationMessage")
    .filter({ hasText: "Complete this test with" })
    .waitFor();
  await page.locator("#participantConfirmationContinueButton").click();
  await page
    .locator("#participantRouteStatus")
    .filter({ hasText: "completed" })
    .waitFor({ timeout: 15_000 });
  await page.goto(
    `${baseUrl}/participant?${new URLSearchParams({
      tenantKey,
      workspaceKey,
      loginKey: veronaSimulationLoginKey,
      bookletKey: veronaBookletKey
    }).toString()}`,
    { waitUntil: "domcontentloaded" }
  );
  await page
    .locator("#participantRouteExecutionMode")
    .filter({ hasText: "run-simulation" })
    .waitFor({ timeout: 15_000 });
  await page.locator("#participantRouteTestletUnlockCode").fill(veronaTestletCode);
  await page.locator("#participantRouteTestletUnlockButton").click();
  const simulationVeronaFrame = page.frameLocator("#participantVeronaPlayerFrame");
  await simulationVeronaFrame.locator("#playerAnswer").waitFor({ timeout: 15_000 });
  await simulationVeronaFrame
    .locator("#playerDefinition")
    .filter({ hasText: "Smoke unit definition" })
    .waitFor({ timeout: 15_000 });
  const simulationRunId = (
    await page.locator("#participantRouteRunId").textContent()
  )?.trim();
  assert.ok(simulationRunId, "Simulation smoke expected a run id.");
  const simulationSessionId = (
    await page.locator("#participantRouteSessionLabel").textContent()
  )?.trim();
  assert.ok(simulationSessionId, "Simulation smoke expected a session id.");
  const ephemeralSimulationAnswer = "Ephemeral simulation response";
  await simulationVeronaFrame
    .locator("#playerAnswer")
    .fill(ephemeralSimulationAnswer);
  await expectButtonSelectorEnabled("#participantRouteCompleteButton");
  const activeSimulationState = await (
    await sendSmokeJson(
      `${baseUrl}/api/v1/participant/sessions/${encodeURIComponent(
        simulationSessionId
      )}/current-state`,
      { method: "GET" }
    )
  ).json();
  assert.deepEqual(
    activeSimulationState.currentRunState?.testRun?.unlockedTestletKeys,
    [veronaTestletKey]
  );
  assert.ok(
    activeSimulationState.currentRunState?.testRun?.testletTimers?.[
      veronaTestletKey
    ]
  );
  await page.reload({ waitUntil: "networkidle" });
  await page
    .locator("#participantRouteExecutionMode")
    .filter({ hasText: "run-simulation" })
    .waitFor({ timeout: 15_000 });
  assert.equal(
    (await page.locator("#participantRouteRunId").textContent())?.trim(),
    simulationRunId,
    "Simulation re-entry must reuse the open run."
  );
  const resetSimulationState = await (
    await sendSmokeJson(
      `${baseUrl}/api/v1/participant/sessions/${encodeURIComponent(
        simulationSessionId
      )}/current-state`,
      { method: "GET" }
    )
  ).json();
  assert.equal(resetSimulationState.currentRunState?.testRun?.currentUnitKey, null);
  assert.deepEqual(
    resetSimulationState.currentRunState?.testRun?.unlockedTestletKeys,
    []
  );
  assert.deepEqual(resetSimulationState.currentRunState?.testRun?.testletTimers, {});
  assert.deepEqual(resetSimulationState.currentRunState?.testRun?.lockedTestletKeys, []);
  assert.deepEqual(resetSimulationState.currentRunState?.testRun?.lockedUnitKeys, []);
  assert.equal(
    await page.evaluate(answer =>
      Object.values(localStorage).some(value => value.includes(answer)),
      ephemeralSimulationAnswer
    ),
    false,
    "Simulation responses must not survive re-entry in local storage."
  );
  await page.locator("#participantRouteTestletUnlockCode").fill(veronaTestletCode);
  await page.locator("#participantRouteTestletUnlockButton").click();
  const resumedSimulationVeronaFrame = page.frameLocator(
    "#participantVeronaPlayerFrame"
  );
  await resumedSimulationVeronaFrame
    .locator("#playerDefinition")
    .filter({ hasText: "Smoke unit definition" })
    .waitFor({ timeout: 15_000 });
  assert.equal(
    await resumedSimulationVeronaFrame.locator("#playerAnswer").inputValue(),
    ""
  );
  await resumedSimulationVeronaFrame
    .locator("#playerAnswer")
    .fill(ephemeralSimulationAnswer);
  await expectButtonSelectorEnabled("#participantRouteCompleteButton");
  await page.locator("#participantRouteCompleteButton").click();
  await page
    .locator("#participantConfirmationTitle")
    .filter({ hasText: "Leave simulation task?" })
    .waitFor();
  await page
    .locator("#participantConfirmationMessage")
    .filter({ hasText: "This simulation task will close after leaving." })
    .waitFor();
  await page.locator("#participantConfirmationStayButton").click();
  await page.locator("#participantConfirmationBackdrop").waitFor({
    state: "detached"
  });
  await page
    .locator("#participantRouteStatus")
    .filter({ hasText: "running" })
    .waitFor();
  await page.locator("#participantRouteCompleteButton").click();
  await page
    .locator("#participantConfirmationTitle")
    .filter({ hasText: "Leave simulation task?" })
    .waitFor();
  await page.waitForTimeout(250);
  const simulationCompleteResponsePromise = page.waitForResponse(
    response =>
      response.request().method() === "POST" &&
      response.url().endsWith(
        `/api/v1/participant/test-runs/${encodeURIComponent(simulationRunId)}/complete`
      )
  );
  await page.locator("#participantConfirmationContinueButton").click();
  const simulationCompleteResponse = await simulationCompleteResponsePromise;
  assert.equal(simulationCompleteResponse.status(), 200);
  logStep("participant-custom-leave-confirmation");
  stopAfter("participant-custom-leave-confirmation");
  const completedSimulationState = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${encodeURIComponent(
      simulationSessionId
    )}/current-state`,
    payload =>
      payload?.currentRunState?.testRun?.testRunId === simulationRunId &&
      payload.currentRunState.testRun.status === "running" &&
      payload.currentRunState.testRun.currentUnitKey === null
  );
  assert.equal(completedSimulationState.currentRunState?.testRun?.testRunId, simulationRunId);
  assert.equal(completedSimulationState.currentRunState?.testRun?.status, "running");
  assert.equal(completedSimulationState.currentRunState?.testRun?.currentUnitKey, null);
  assert.equal(completedSimulationState.currentRunState?.testRun?.completedAt, null);
  assert.deepEqual(completedSimulationState.currentRunState?.testRun?.unitResponses, {});
  assert.deepEqual(
    completedSimulationState.currentRunState?.testRun?.unlockedTestletKeys,
    []
  );
  assert.deepEqual(completedSimulationState.currentRunState?.testRun?.testletTimers, {});
  assert.deepEqual(
    completedSimulationState.currentRunState?.testRun?.lockedTestletKeys,
    []
  );
  assert.deepEqual(completedSimulationState.currentRunState?.testRun?.lockedUnitKeys, []);
  assert.deepEqual(
    completedSimulationState.currentRunState?.booklets?.map(booklet => booklet.status),
    ["in_progress"]
  );
  const simulationLogs = await (
    await sendSmokeJson(
      `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/test-logs?testRunId=${encodeURIComponent(
        simulationRunId
      )}`,
      { method: "GET" }
    )
  ).json();
  assert.deepEqual(simulationLogs.items, []);
  assert.equal(
    await page.evaluate(answer =>
      Object.values(localStorage).some(value => value.includes(answer)),
      ephemeralSimulationAnswer
    ),
    false,
    "Simulation responses must not survive in local storage."
  );
  await page.reload({ waitUntil: "domcontentloaded" });
  await page
    .locator("#participantRouteRunId")
    .filter({ hasText: simulationRunId })
    .waitFor({ timeout: 15_000 });
  await clickSelectorAction(
    "resume completed simulation",
    "#participantRouteStartOrResumeButton"
  );
  await page
    .locator("#participantRouteStatus")
    .filter({ hasText: "running" })
    .waitFor({ timeout: 15_000 });
  assert.equal(
    (await page.locator("#participantRouteRunId").textContent())?.trim(),
    simulationRunId,
    "Completing a simulation must keep the same reusable run."
  );
  await page.locator("#participantRouteTestletUnlockCode").waitFor({
    state: "visible",
    timeout: 15_000
  });
  const rerunSimulationState = await (
    await sendSmokeJson(
      `${baseUrl}/api/v1/participant/sessions/${encodeURIComponent(
        simulationSessionId
      )}/current-state`,
      { method: "GET" }
    )
  ).json();
  assert.equal(rerunSimulationState.currentRunState?.testRun?.testRunId, simulationRunId);
  assert.equal(rerunSimulationState.currentRunState?.testRun?.status, "running");
  assert.equal(rerunSimulationState.currentRunState?.testRun?.currentUnitKey, null);
  assert.deepEqual(rerunSimulationState.currentRunState?.testRun?.unitResponses, {});
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
    { waitUntil: "domcontentloaded" }
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
  await originalAdaptiveFrame.locator("body").evaluate(() => {
    globalThis.__adaptivePlayerConfigUpdates = [];
    addEventListener("message", event => {
      if (event.data?.type === "vopPlayerConfigChangedNotification") {
        globalThis.__adaptivePlayerConfigUpdates.push(event.data.playerConfig);
      }
    });
  });
  await page.evaluate(() => {
    const select = document.querySelector("#participantRouteAdaptiveState-bonus");
    if (!(select instanceof HTMLSelectElement)) {
      throw new Error("Adaptive bonus selector is unavailable.");
    }
    select.value = "yes";
    select.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await page
    .locator("#participantRouteAdaptiveStateFeedback")
    .filter({ hasText: "ja" })
    .waitFor({ timeout: 15_000 });
  await page.waitForFunction(
    () =>
      document.querySelectorAll(
        "#participantRouteUnitRail [data-unit-key]"
      ).length === 3,
    undefined,
    { timeout: 15_000 }
  );
  const adaptivePlayerUnitCount = await originalAdaptiveFrame
    .locator("body")
    .evaluate(
      () =>
        new Promise((resolvePromise, reject) => {
          const deadline = Date.now() + 15_000;
          const poll = () => {
            const latestConfig =
              globalThis.__adaptivePlayerConfigUpdates?.at(-1);
            if (latestConfig?.unitCount === 3) {
              resolvePromise(latestConfig.unitCount);
              return;
            }
            if (Date.now() >= deadline) {
              reject(
                new Error(
                  `Expected adaptive unitCount 3, received ${JSON.stringify(latestConfig)}`
                )
              );
              return;
            }
            setTimeout(poll, 50);
          };
          poll();
        })
    );
  assert.equal(
    adaptivePlayerUnitCount,
    3,
    "The running Verona Player must receive the updated adaptive Unit count."
  );
  await page.goto(
    `${baseUrl}/participant?participantSessionId=${encodeURIComponent(
      originalAdaptiveParticipantSessionId
    )}`,
    { waitUntil: "domcontentloaded" }
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
  assert.equal(
    await page.locator("#participantRouteAdaptiveState-bonus").inputValue(),
    "yes"
  );
  logStep("participant-multi-unit-outbox-recovery");
  const originalAdaptiveStateForOutbox = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${originalAdaptiveParticipantSessionId}/current-state`,
    payload =>
      typeof payload?.currentRunState?.testRun?.unitResponses?.[
        originalAdaptiveUnitKey
      ] === "string"
  );
  const originalAdaptiveTestRunId =
    originalAdaptiveStateForOutbox.currentRunState.testRun.testRunId;
  const originalAdaptiveBaseResponse =
    originalAdaptiveStateForOutbox.currentRunState.testRun.unitResponses[
      originalAdaptiveUnitKey
    ];
  const originalAdaptiveBeginnerUnitKey = "beginner-unit";
  const currentUnitOutboxResponse = `${originalAdaptiveBaseResponse}\n`;
  const otherUnitOutboxResponse = `${originalAdaptiveBaseResponse}\n `;
  const multiUnitSaveOrder = [];
  const recordMultiUnitSaveOrder = request => {
    const requestBody = request.postDataJSON();
    if (
      request.method() === "POST" &&
      request.url().endsWith(
        `/participant/test-runs/${originalAdaptiveTestRunId}/save-progress`
      ) &&
      requestBody?.deliveryId?.startsWith("multi-unit-")
    ) {
      multiUnitSaveOrder.push(requestBody.responseUnitKey);
    }
  };
  page.on("request", recordMultiUnitSaveOrder);
  await page.evaluate(
    ({
      storageKey,
      testRunId,
      currentUnitKey,
      currentResponse,
      otherUnitKey,
      otherResponse
    }) => {
      const queuedAt = Date.now();
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          version: 1,
          entries: [
            {
              version: 1,
              deliveryId: `multi-unit-other-${queuedAt}`,
              testRunId,
              unitKey: otherUnitKey,
              response: otherResponse,
              status: "running",
              logs: [],
              queuedAt: new Date(queuedAt - 1_000).toISOString()
            },
            {
              version: 1,
              deliveryId: `multi-unit-current-${queuedAt}`,
              testRunId,
              unitKey: currentUnitKey,
              response: currentResponse,
              status: "running",
              logs: [],
              queuedAt: new Date(queuedAt).toISOString()
            }
          ]
        })
      );
      window.dispatchEvent(new Event("online"));
    },
    {
      storageKey: "testcenter-rewrite:participant-save-outbox:v1",
      testRunId: originalAdaptiveTestRunId,
      currentUnitKey: originalAdaptiveUnitKey,
      currentResponse: currentUnitOutboxResponse,
      otherUnitKey: originalAdaptiveBeginnerUnitKey,
      otherResponse: otherUnitOutboxResponse
    }
  );
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${originalAdaptiveParticipantSessionId}/current-state`,
    payload =>
      payload?.currentRunState?.testRun?.unitResponses?.[
        originalAdaptiveUnitKey
      ] === currentUnitOutboxResponse &&
      payload.currentRunState.testRun.unitResponses?.[
        originalAdaptiveBeginnerUnitKey
      ] === otherUnitOutboxResponse
  );
  await page.waitForFunction(
    storageKey => localStorage.getItem(storageKey) === null,
    "testcenter-rewrite:participant-save-outbox:v1"
  );
  page.off("request", recordMultiUnitSaveOrder);
  assert.deepEqual(
    multiUnitSaveOrder.slice(0, 2),
    [originalAdaptiveUnitKey, originalAdaptiveBeginnerUnitKey],
    "Recovery must restore the visible Unit first, then drain every remaining Unit."
  );

  logStep("participant-multi-unit-background-sync");
  const backgroundCurrentResponse = `${originalAdaptiveBaseResponse}\n  `;
  const backgroundOtherResponse = `${originalAdaptiveBaseResponse}\n   `;
  await page.evaluate(
    ({
      storageKey,
      testRunId,
      currentUnitKey,
      currentResponse,
      otherUnitKey,
      otherResponse
    }) => {
      const queuedAt = Date.now();
      localStorage.setItem(
        storageKey,
        JSON.stringify({
          version: 1,
          entries: [
            {
              version: 1,
              deliveryId: `background-current-${queuedAt}`,
              testRunId,
              unitKey: currentUnitKey,
              response: currentResponse,
              status: "running",
              logs: [],
              queuedAt: new Date(queuedAt).toISOString()
            },
            {
              version: 1,
              deliveryId: `background-other-${queuedAt}`,
              testRunId,
              unitKey: otherUnitKey,
              response: otherResponse,
              status: "running",
              logs: [],
              queuedAt: new Date(queuedAt + 1).toISOString()
            }
          ]
        })
      );
    },
    {
      storageKey: "testcenter-rewrite:participant-save-outbox:v1",
      testRunId: originalAdaptiveTestRunId,
      currentUnitKey: originalAdaptiveUnitKey,
      currentResponse: backgroundCurrentResponse,
      otherUnitKey: originalAdaptiveBeginnerUnitKey,
      otherResponse: backgroundOtherResponse
    }
  );
  await context.setOffline(true);
  await page.evaluate(() => window.dispatchEvent(new Event("pagehide")));
  await page.waitForFunction(
    async testRunId => {
      const database = await new Promise((resolvePromise, reject) => {
        const request = indexedDB.open("testcenter-participant-save-outbox-v1", 1);
        request.addEventListener("error", () => reject(request.error));
        request.addEventListener("success", () => resolvePromise(request.result));
      });
      try {
        const records = await new Promise((resolvePromise, reject) => {
          const transaction = database.transaction("pending-saves", "readonly");
          const request = transaction.objectStore("pending-saves").getAll();
          request.addEventListener("error", () => reject(request.error));
          request.addEventListener("success", () => resolvePromise(request.result));
        });
        return records.filter(record => record.entry?.testRunId === testRunId).length === 2;
      } finally {
        database.close();
      }
    },
    originalAdaptiveTestRunId
  );
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${originalAdaptiveParticipantSessionId}/current-state`,
    payload =>
      payload?.currentRunState?.testRun?.unitResponses?.[
        originalAdaptiveUnitKey
      ] === backgroundCurrentResponse &&
      payload.currentRunState.testRun.unitResponses?.[
        originalAdaptiveBeginnerUnitKey
      ] === backgroundOtherResponse
  );
  await page.waitForFunction(
    storageKey => localStorage.getItem(storageKey) === null,
    "testcenter-rewrite:participant-save-outbox:v1"
  );
  stopAfter("participant-original-verona-player");

  logStep("participant-official-verona-3-player");
  const legacyPlayerTenantKey = `${tenantKey}-verona-3`;
  const legacyPlayerWorkspaceKey = `${workspaceKey}-verona-3`;
  const legacyPlayerBookletKey = "BOOKLET.LEGACY.VERONA-3";
  const legacyPlayerFirstUnitKey = "UNIT.LEGACY.VERONA-3.1";
  const legacyPlayerSecondUnitKey = "UNIT.LEGACY.VERONA-3.2";
  const legacyPlayerKey = "iqb-player-simple@2.1";
  const legacyPlayerLoginKey = "student-official-verona-3";
  const legacyPlayerResponse = "Restored by the Verona 3 host";
  const legacyPlayerDocument = await readBrotliBase64Text(
    resolve(
      "test-fixtures/original-testcenter/players/verona-simple-player-2.1.0.html.br.base64"
    )
  );
  const legacyPlayerZip = createStoredZipBuffer([
    {
      fileName: "export/imsmanifest.xml",
      content: `
        <manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1">
          <resources>
            <resource identifier="${legacyPlayerBookletKey}" href="booklets/Booklet.xml" />
            <resource identifier="${legacyPlayerFirstUnitKey}" href="units/Unit1.xml" />
            <resource identifier="${legacyPlayerSecondUnitKey}" href="units/Unit2.xml" />
            <resource identifier="${legacyPlayerKey}" href="players/verona-simple-player-2.html" />
          </resources>
        </manifest>
      `
    },
    {
      fileName: "export/booklets/Booklet.xml",
      content: `
        <Booklet>
          <Metadata>
            <Id>${legacyPlayerBookletKey}</Id>
            <Label>Official Verona 3 Player</Label>
          </Metadata>
          <BookletConfig>
            <Config key="loading_mode">EAGER</Config>
            <Config key="pagingMode">separate</Config>
            <Config key="browserBehaviour">preventNav</Config>
            <Config key="unit_menu">OFF</Config>
            <Config key="unit_navibuttons">OFF</Config>
            <Config key="navbar_unit_label">LABEL</Config>
          </BookletConfig>
          <Units>
            <Unit id="${legacyPlayerFirstUnitKey}" label="Legacy first unit" />
            <Unit id="${legacyPlayerSecondUnitKey}" label="Legacy second unit" />
          </Units>
        </Booklet>
      `
    },
    {
      fileName: "export/units/Unit1.xml",
      content: `
        <Unit>
          <Metadata>
            <Id>${legacyPlayerFirstUnitKey}</Id>
            <Label>Legacy first unit</Label>
          </Metadata>
          <Definition player="${legacyPlayerKey}"><![CDATA[
            <fieldset>
              <legend>Official Verona 3 first unit</legend>
              <label>Legacy answer <input name="legacy-answer" /></label>
            </fieldset>
          ]]></Definition>
        </Unit>
      `
    },
    {
      fileName: "export/units/Unit2.xml",
      content: `
        <Unit>
          <Metadata>
            <Id>${legacyPlayerSecondUnitKey}</Id>
            <Label>Legacy second unit</Label>
          </Metadata>
          <Definition player="${legacyPlayerKey}"><![CDATA[
            <fieldset>
              <legend>Official Verona 3 second unit</legend>
              <label>Second answer <input name="second-answer" /></label>
            </fieldset>
          ]]></Definition>
        </Unit>
      `
    },
    {
      fileName: "export/players/verona-simple-player-2.html",
      content: legacyPlayerDocument
    }
  ]);
  await sendSmokeJson(`${baseUrl}/api/v1/platform/tenants`, {
    body: {
      tenantKey: legacyPlayerTenantKey,
      displayName: "Official Verona 3 Player"
    }
  });
  await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${legacyPlayerTenantKey}/workspaces`,
    {
      body: {
        workspaceKey: legacyPlayerWorkspaceKey,
        displayName: "Official Verona 3 Player"
      }
    }
  );
  const legacyPlayerWorkspaceApiUrl =
    `${baseUrl}/api/v1/tenants/${legacyPlayerTenantKey}` +
    `/workspaces/${legacyPlayerWorkspaceKey}`;
  const legacyPlayerSourceResponse = await sendSmokeJson(
    `${legacyPlayerWorkspaceApiUrl}/source-packages`,
    {
      body: {
        fileName: "official-verona-3-browser-smoke.zip",
        mediaType: "application/zip",
        sourceDocument: `data:application/zip;base64,${legacyPlayerZip.toString("base64")}`
      }
    }
  );
  const legacyPlayerSourcePayload = await legacyPlayerSourceResponse.json();
  const legacyPlayerImportResponse = await sendSmokeJson(
    `${legacyPlayerWorkspaceApiUrl}/import-jobs`,
    {
      body: {
        sourcePackageId:
          legacyPlayerSourcePayload.sourcePackage.sourcePackageId
      }
    }
  );
  const legacyPlayerImportPayload = await legacyPlayerImportResponse.json();
  assert.equal(legacyPlayerImportPayload.importJob.status, "completed");
  assert.equal(
    legacyPlayerImportPayload.importJob.diagnostics.some(
      diagnostic => diagnostic.severity === "error"
    ),
    false,
    JSON.stringify(legacyPlayerImportPayload.importJob.diagnostics)
  );
  const legacyPlayerReleaseId =
    legacyPlayerImportPayload.stagedContentRelease?.contentReleaseId;
  assert.ok(legacyPlayerReleaseId);
  await sendSmokeJson(
    `${legacyPlayerWorkspaceApiUrl}/content-releases/${legacyPlayerReleaseId}/activate`,
    { body: {} }
  );
  await sendSmokeJson(`${legacyPlayerWorkspaceApiUrl}/participant-roster`, {
    body: {
      rosterText: [
        {
          loginKey: legacyPlayerLoginKey,
          groupKey: "group:official-verona-3",
          bookletKey: legacyPlayerBookletKey,
          displayName: "Official Verona 3 Participant",
          executionMode: "run-hot-return"
        }
      ]
    }
  });
  const legacyPlayerPreloadResponse = page.waitForResponse(
    response =>
      response.request().method() === "GET" &&
      response.url().includes("includeBookletAssets=true")
  );
  await page.goto(
    `${baseUrl}/participant?${new URLSearchParams({
      tenantKey: legacyPlayerTenantKey,
      workspaceKey: legacyPlayerWorkspaceKey,
      loginKey: legacyPlayerLoginKey,
      bookletKey: legacyPlayerBookletKey
    }).toString()}`,
    { waitUntil: "domcontentloaded" }
  );
  const legacyPlayerPreloadPayload =
    await (await legacyPlayerPreloadResponse).json();
  assert.equal(
    legacyPlayerPreloadPayload.currentRunState.booklet.policy.player.loadingMode,
    "eager"
  );
  assert.equal(
    legacyPlayerPreloadPayload.currentRunState.booklet.policy.navigation.unitLabel,
    "label"
  );
  assert.deepEqual(
    legacyPlayerPreloadPayload.currentRunState.bookletAssets.units.map(
      unit => unit.unitKey
    ),
    [legacyPlayerFirstUnitKey, legacyPlayerSecondUnitKey]
  );
  assert.deepEqual(
    legacyPlayerPreloadPayload.currentRunState.bookletAssets.players.map(
      player => player.playerKey
    ),
    [legacyPlayerKey]
  );
  await page
    .locator("#participantRouteBookletLoadingStatus")
    .filter({ hasText: "2 unit assets loaded" })
    .waitFor();
  await page
    .locator("#participantVeronaPlayerVersion")
    .filter({ hasText: "API 3.0.0" })
    .waitFor({ timeout: 30_000 });
  const legacyPlayerFrame = page.frameLocator("#participantVeronaPlayerFrame");
  await legacyPlayerFrame
    .getByText("Official Verona 3 first unit", { exact: true })
    .waitFor({ timeout: 30_000 });
  await page
    .locator("#participantRouteUnitNavigationLabel")
    .filter({ hasText: "Legacy first unit" })
    .waitFor();
  assert.equal(await page.locator("#participantRouteUnitRail").count(), 0);
  assert.equal(await page.locator("#participantRouteNextUnitButton").count(), 0);
  const legacyPlayerAnswer = legacyPlayerFrame.locator(
    "input[name='legacy-answer']"
  );
  await legacyPlayerAnswer.fill(legacyPlayerResponse);
  await legacyPlayerAnswer.dispatchEvent("keyup", {
    key: "t",
    code: "KeyT"
  });
  const legacyPlayerParticipantSessionId = await page
    .locator("#participantRouteSessionId")
    .inputValue();
  assert.ok(legacyPlayerParticipantSessionId);
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${legacyPlayerParticipantSessionId}/current-state`,
    payload => {
      const response =
        payload?.currentRunState?.testRun?.unitResponses?.[
          legacyPlayerFirstUnitKey
        ];
      if (typeof response !== "string") return false;
      try {
        const parsed = JSON.parse(response);
        const all = JSON.parse(parsed.unitState?.dataParts?.all ?? "{}");
        return all.answers?.["legacy-answer"] === legacyPlayerResponse;
      } catch {
        return false;
      }
    },
    30_000
  );
  await legacyPlayerFrame.locator("#last-unit").dispatchEvent("click");
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: legacyPlayerSecondUnitKey })
    .waitFor({ timeout: 30_000 });
  await legacyPlayerFrame
    .getByText("Official Verona 3 second unit", { exact: true })
    .waitFor({ timeout: 30_000 });
  await page
    .locator("#participantRouteUnitNavigationLabel")
    .filter({ hasText: "Legacy second unit" })
    .waitFor();
  await legacyPlayerFrame.locator("#first-unit").dispatchEvent("click");
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: legacyPlayerFirstUnitKey })
    .waitFor({ timeout: 30_000 });
  await legacyPlayerFrame
    .getByText("Official Verona 3 first unit", { exact: true })
    .waitFor({ timeout: 30_000 });
  await legacyPlayerFrame.locator("#next-unit").dispatchEvent("click");
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: legacyPlayerSecondUnitKey })
    .waitFor({ timeout: 30_000 });
  await legacyPlayerFrame
    .getByText("Official Verona 3 second unit", { exact: true })
    .waitFor({ timeout: 30_000 });
  await legacyPlayerFrame.locator("#prev-unit").dispatchEvent("click");
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: legacyPlayerFirstUnitKey })
    .waitFor({ timeout: 30_000 });
  await legacyPlayerFrame
    .getByText("Official Verona 3 first unit", { exact: true })
    .waitFor({ timeout: 30_000 });
  assert.equal(
    await legacyPlayerFrame
      .locator("input[name='legacy-answer']")
      .inputValue(),
    legacyPlayerResponse
  );
  const legacyPlayerProtectedUrl = page.url();
  const legacyPlayerProtectedPath = new URL(legacyPlayerProtectedUrl);
  await page.evaluate(protectedPath => {
    history.replaceState(history.state, "", "/app/runtime");
    history.pushState(history.state, "", protectedPath);
    history.back();
  }, `${legacyPlayerProtectedPath.pathname}${legacyPlayerProtectedPath.search}`);
  await page
    .locator("#participantRouteNavigationNoticeTitle")
    .filter({ hasText: "Browser navigation disabled" })
    .waitFor({ timeout: 15_000 });
  await page.waitForURL(legacyPlayerProtectedUrl);
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: legacyPlayerFirstUnitKey })
    .waitFor();
  await page.goto(
    `${baseUrl}/participant?participantSessionId=${encodeURIComponent(
      legacyPlayerParticipantSessionId
    )}`,
    { waitUntil: "domcontentloaded" }
  );
  await page
    .locator("#participantVeronaPlayerVersion")
    .filter({ hasText: "API 3.0.0" })
    .waitFor({ timeout: 30_000 });
  assert.equal(
    await page
      .frameLocator("#participantVeronaPlayerFrame")
      .locator("input[name='legacy-answer']")
      .inputValue(),
    legacyPlayerResponse
  );
  stopAfter("participant-verona-3-player");

  logStep("participant-official-verona-2-4-5-players");
  const officialProtocolCorpus = JSON.parse(
    await readFile(
      resolve("test-fixtures/original-testcenter/corpus.json"),
      "utf8"
    )
  );
  const officialProtocolPlayers =
    officialProtocolCorpus.veronaSimplePlayerPackages.filter(player =>
      ["2.1.0", "4.0", "5.2"].includes(player.playerApiVersion)
    );
  assert.equal(officialProtocolPlayers.length, 3);

  for (const protocolPlayer of officialProtocolPlayers) {
    const apiMajor = protocolPlayer.playerApiVersion.split(".")[0];
    const protocolTenantKey = `${tenantKey}-verona-${apiMajor}`;
    const protocolWorkspaceKey = `${workspaceKey}-verona-${apiMajor}`;
    const protocolBookletKey = `BOOKLET.OFFICIAL.VERONA-${apiMajor}`;
    const protocolFirstUnitKey = `UNIT.OFFICIAL.VERONA-${apiMajor}.1`;
    const protocolSecondUnitKey = `UNIT.OFFICIAL.VERONA-${apiMajor}.2`;
    const protocolLoginKey = `student-official-verona-${apiMajor}`;
    const protocolInputName = `answer-${apiMajor}`;
    const protocolResponse = `Restored by the Verona ${apiMajor} host`;
    const protocolPlayerDocument = await readBrotliBase64Text(
      resolve("test-fixtures/original-testcenter", protocolPlayer.fixture)
    );
    const protocolPlayerZip = createStoredZipBuffer([
      {
        fileName: "export/imsmanifest.xml",
        content: `
          <manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1">
            <resources>
              <resource identifier="${protocolBookletKey}" href="booklets/Booklet.xml" />
              <resource identifier="${protocolFirstUnitKey}" href="units/Unit1.xml" />
              <resource identifier="${protocolSecondUnitKey}" href="units/Unit2.xml" />
              <resource identifier="${protocolPlayer.playerKey}" href="players/Player.html" />
            </resources>
          </manifest>
        `
      },
      {
        fileName: "export/booklets/Booklet.xml",
        content: `
          <Booklet>
            <Metadata>
              <Id>${protocolBookletKey}</Id>
              <Label>Official Verona ${apiMajor} Player</Label>
            </Metadata>
            <BookletConfig>
              <Config key="paging_mode">separate</Config>
              <Config key="restore_current_page_on_return">ON</Config>
            </BookletConfig>
            <Units>
              <Unit id="${protocolFirstUnitKey}" label="Protocol first unit" />
              <Unit id="${protocolSecondUnitKey}" label="Protocol second unit" />
            </Units>
          </Booklet>
        `
      },
      {
        fileName: "export/units/Unit1.xml",
        content: `
          <Unit>
            <Metadata>
              <Id>${protocolFirstUnitKey}</Id>
              <Label>Protocol first unit</Label>
            </Metadata>
            <Definition player="${protocolPlayer.playerKey}" type="${protocolPlayer.unitDefinitionType}"><![CDATA[
              <fieldset>
                <legend>Official Verona ${apiMajor} first unit</legend>
                <label>Protocol answer <input name="${protocolInputName}" /></label>
              </fieldset>
              ${apiMajor === "2" ? `
                <fieldset>
                  <legend>Official Verona 2 restored page</legend>
                  <p>Legacy player state is restored.</p>
                </fieldset>
              ` : ""}
            ]]></Definition>
          </Unit>
        `
      },
      {
        fileName: "export/units/Unit2.xml",
        content: `
          <Unit>
            <Metadata>
              <Id>${protocolSecondUnitKey}</Id>
              <Label>Protocol second unit</Label>
            </Metadata>
            <Definition player="${protocolPlayer.playerKey}" type="${protocolPlayer.unitDefinitionType}"><![CDATA[
              <fieldset>
                <legend>Official Verona ${apiMajor} second unit</legend>
                <label>Second answer <input name="second-${apiMajor}" /></label>
              </fieldset>
            ]]></Definition>
          </Unit>
        `
      },
      {
        fileName: "export/players/Player.html",
        content: protocolPlayerDocument
      }
    ]);
    await sendSmokeJson(`${baseUrl}/api/v1/platform/tenants`, {
      body: {
        tenantKey: protocolTenantKey,
        displayName: `Official Verona ${apiMajor} Player`
      }
    });
    await sendSmokeJson(
      `${baseUrl}/api/v1/tenants/${protocolTenantKey}/workspaces`,
      {
        body: {
          workspaceKey: protocolWorkspaceKey,
          displayName: `Official Verona ${apiMajor} Player`
        }
      }
    );
    const protocolWorkspaceApiUrl =
      `${baseUrl}/api/v1/tenants/${protocolTenantKey}` +
      `/workspaces/${protocolWorkspaceKey}`;
    const protocolSourceResponse = await sendSmokeJson(
      `${protocolWorkspaceApiUrl}/source-packages`,
      {
        body: {
          fileName: `official-verona-${apiMajor}-browser-smoke.zip`,
          mediaType: "application/zip",
          sourceDocument: `data:application/zip;base64,${protocolPlayerZip.toString("base64")}`
        }
      }
    );
    const protocolSourcePayload = await protocolSourceResponse.json();
    const protocolImportResponse = await sendSmokeJson(
      `${protocolWorkspaceApiUrl}/import-jobs`,
      {
        body: {
          sourcePackageId:
            protocolSourcePayload.sourcePackage.sourcePackageId
        }
      }
    );
    const protocolImportPayload = await protocolImportResponse.json();
    assert.equal(
      protocolImportPayload.importJob.status,
      "completed",
      JSON.stringify(protocolImportPayload.importJob.diagnostics)
    );
    assert.equal(
      protocolImportPayload.importJob.diagnostics.some(
        diagnostic => diagnostic.severity === "error"
      ),
      false,
      JSON.stringify(protocolImportPayload.importJob.diagnostics)
    );
    assert.equal(
      protocolImportPayload.importJob.diagnostics.some(
        diagnostic =>
          diagnostic.code === "source_document_player_metadata_missing" &&
          diagnostic.severity === "warning"
      ),
      protocolPlayer.metadataFormat === "legacy-meta-element",
      JSON.stringify(protocolImportPayload.importJob.diagnostics)
    );
    const protocolReleaseId =
      protocolImportPayload.stagedContentRelease?.contentReleaseId;
    assert.ok(protocolReleaseId);
    await sendSmokeJson(
      `${protocolWorkspaceApiUrl}/content-releases/${protocolReleaseId}/activate`,
      { body: {} }
    );
    await sendSmokeJson(`${protocolWorkspaceApiUrl}/participant-roster`, {
      body: {
        rosterText: [
          {
            loginKey: protocolLoginKey,
            groupKey: `group:official-verona-${apiMajor}`,
            bookletKey: protocolBookletKey,
            displayName: `Official Verona ${apiMajor} Participant`,
            executionMode: "run-hot-return"
          }
        ]
      }
    });
    await page.goto(
      `${baseUrl}/participant?${new URLSearchParams({
        tenantKey: protocolTenantKey,
        workspaceKey: protocolWorkspaceKey,
        loginKey: protocolLoginKey,
        bookletKey: protocolBookletKey
      }).toString()}`,
      { waitUntil: "domcontentloaded" }
    );
    await page
      .locator("#participantVeronaPlayerVersion")
      .filter({ hasText: `API ${protocolPlayer.playerApiVersion}` })
      .waitFor({ timeout: 30_000 });
    const protocolFrame = page.frameLocator("#participantVeronaPlayerFrame");
    await protocolFrame
      .getByText(`Official Verona ${apiMajor} first unit`, { exact: true })
      .waitFor({ timeout: 30_000 });
    const protocolAnswer = protocolFrame.locator(
      `input[name='${protocolInputName}']`
    );
    await protocolAnswer.fill(protocolResponse);
    await protocolAnswer.dispatchEvent("keyup", {
      key: "t",
      code: "KeyT"
    });
    const protocolParticipantSessionId = await page
      .locator("#participantRouteSessionId")
      .inputValue();
    assert.ok(protocolParticipantSessionId);
    await pollJsonWithPredicate(
      `${baseUrl}/api/v1/participant/sessions/${protocolParticipantSessionId}/current-state`,
      payload => {
        const response =
          payload?.currentRunState?.testRun?.unitResponses?.[
            protocolFirstUnitKey
          ];
        if (typeof response !== "string") return false;
        try {
          const parsed = JSON.parse(response);
          const decodedDataPart = JSON.parse(
            parsed.unitState?.dataParts?.answers ??
              parsed.unitState?.dataParts?.all ??
              "null"
          );
          const answers = decodedDataPart?.answers ?? decodedDataPart;
          return Array.isArray(answers)
            ? answers.some(
                answer =>
                  answer?.id === protocolInputName &&
                  answer?.value === protocolResponse
              )
            : answers?.[protocolInputName] === protocolResponse;
        } catch {
          return false;
        }
      },
      30_000
    );
    if (apiMajor === "2") {
      await protocolFrame.locator("#next-page").waitFor({ state: "visible" });
      await protocolFrame.locator("#next-page").dispatchEvent("click");
      await protocolFrame
        .getByText("Official Verona 2 restored page", { exact: true })
        .waitFor({ timeout: 30_000 });
      await pollJsonWithPredicate(
        `${baseUrl}/api/v1/participant/sessions/${protocolParticipantSessionId}/current-state`,
        payload => {
          const response =
            payload?.currentRunState?.testRun?.unitResponses?.[
              protocolFirstUnitKey
            ];
          if (typeof response !== "string") return false;
          try {
            return JSON.parse(response).playerState?.currentPage === "2";
          } catch {
            return false;
          }
        },
        30_000
      );
    }
    await protocolFrame.locator("#next-unit").waitFor({ state: "visible" });
    await protocolFrame.locator("#next-unit").dispatchEvent("click");
    await page
      .locator("#participantRouteUnitKey")
      .filter({ hasText: protocolSecondUnitKey })
      .waitFor({ timeout: 30_000 });
    await protocolFrame
      .getByText(`Official Verona ${apiMajor} second unit`, { exact: true })
      .waitFor({ timeout: 30_000 });
    await protocolFrame.locator("#prev-unit").waitFor({ state: "visible" });
    await protocolFrame.locator("#prev-unit").dispatchEvent("click");
    await page
      .locator("#participantRouteUnitKey")
      .filter({ hasText: protocolFirstUnitKey })
      .waitFor({ timeout: 30_000 });
    if (apiMajor === "2") {
      await protocolFrame
        .getByText("Official Verona 2 restored page", { exact: true })
        .waitFor({ timeout: 30_000 });
    } else {
      await protocolFrame
        .getByText(`Official Verona ${apiMajor} first unit`, { exact: true })
        .waitFor({ timeout: 30_000 });
    }
    assert.equal(
      await protocolFrame
        .locator(`input[name='${protocolInputName}']`)
        .inputValue(),
      protocolResponse
    );
    await page.goto(
      `${baseUrl}/participant?participantSessionId=${encodeURIComponent(
        protocolParticipantSessionId
      )}`,
      { waitUntil: "domcontentloaded" }
    );
    await page
      .locator("#participantVeronaPlayerVersion")
      .filter({ hasText: `API ${protocolPlayer.playerApiVersion}` })
      .waitFor({ timeout: 30_000 });
    if (apiMajor === "2") {
      await page
        .frameLocator("#participantVeronaPlayerFrame")
        .getByText("Official Verona 2 restored page", { exact: true })
        .waitFor({ timeout: 30_000 });
    }
    assert.equal(
      await page
        .frameLocator("#participantVeronaPlayerFrame")
        .locator(`input[name='${protocolInputName}']`)
        .inputValue(),
      protocolResponse
    );
  }
  stopAfter("participant-verona-2-5-players");

  logStep("participant-official-abi-player-family");
  const abiPlayerPackage =
    officialProtocolCorpus.veronaPlayerFamilyPackages.find(
      playerPackage => playerPackage.family === "ABI scripted survey"
    );
  assert.ok(abiPlayerPackage, "The official ABI player fixture should be pinned.");
  const abiTenantKey = `${tenantKey}-verona-abi`;
  const abiWorkspaceKey = `${workspaceKey}-verona-abi`;
  const abiBookletKey = "BOOKLET.OFFICIAL.ABI-3.3";
  const abiUnitKey = "UNIT.OFFICIAL.ABI-3.3";
  const abiLoginKey = "student-official-abi";
  const abiResponse = "Abi-42";
  const [abiPlayerDocument, abiDefinitionDocument] = await Promise.all([
    readBrotliBase64Text(
      resolve(
        "test-fixtures/original-testcenter",
        abiPlayerPackage.playerFixture
      )
    ),
    readFile(
      resolve(
        "test-fixtures/original-testcenter",
        abiPlayerPackage.definitionFixture
      ),
      "utf8"
    ).then(encoded => Buffer.from(encoded.trim(), "base64").toString("utf8"))
  ]);
  const abiPlayerZip = createStoredZipBuffer([
    {
      fileName: "export/imsmanifest.xml",
      content: `
        <manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1">
          <resources>
            <resource identifier="${abiBookletKey}" href="booklets/Booklet.xml" />
            <resource identifier="${abiUnitKey}" href="units/Unit.xml" />
            <resource identifier="${abiPlayerPackage.playerKey}" href="players/Player.html" />
          </resources>
        </manifest>
      `
    },
    {
      fileName: "export/booklets/Booklet.xml",
      content: `
        <Booklet>
          <Metadata>
            <Id>${abiBookletKey}</Id>
            <Label>Official ABI scripted survey</Label>
          </Metadata>
          <Units>
            <Unit id="${abiUnitKey}" label="ABI survey" />
          </Units>
        </Booklet>
      `
    },
    {
      fileName: "export/units/Unit.xml",
      content: `
        <Unit>
          <Metadata>
            <Id>${abiUnitKey}</Id>
            <Label>Official ABI survey</Label>
          </Metadata>
          <Definition player="${abiPlayerPackage.playerKey}" type="${abiPlayerPackage.unitDefinitionType}"><![CDATA[${abiDefinitionDocument}]]></Definition>
        </Unit>
      `
    },
    {
      fileName: "export/players/Player.html",
      content: abiPlayerDocument
    }
  ]);
  await sendSmokeJson(`${baseUrl}/api/v1/platform/tenants`, {
    body: {
      tenantKey: abiTenantKey,
      displayName: "Official ABI Player"
    }
  });
  await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${abiTenantKey}/workspaces`,
    {
      body: {
        workspaceKey: abiWorkspaceKey,
        displayName: "Official ABI Player"
      }
    }
  );
  const abiWorkspaceApiUrl =
    `${baseUrl}/api/v1/tenants/${abiTenantKey}` +
    `/workspaces/${abiWorkspaceKey}`;
  const abiSourceResponse = await sendSmokeJson(
    `${abiWorkspaceApiUrl}/source-packages`,
    {
      body: {
        fileName: "official-abi-3.3-browser-smoke.zip",
        mediaType: "application/zip",
        sourceDocument: `data:application/zip;base64,${abiPlayerZip.toString("base64")}`
      }
    }
  );
  const abiSourcePayload = await abiSourceResponse.json();
  const abiImportResponse = await sendSmokeJson(
    `${abiWorkspaceApiUrl}/import-jobs`,
    {
      body: {
        sourcePackageId: abiSourcePayload.sourcePackage.sourcePackageId
      }
    }
  );
  const abiImportPayload = await abiImportResponse.json();
  assert.equal(
    abiImportPayload.importJob.status,
    "completed",
    JSON.stringify(abiImportPayload.importJob.diagnostics)
  );
  const abiReleaseId = abiImportPayload.stagedContentRelease?.contentReleaseId;
  assert.ok(abiReleaseId, "Official ABI import should stage a release.");
  await sendSmokeJson(
    `${abiWorkspaceApiUrl}/content-releases/${abiReleaseId}/activate`,
    { body: {} }
  );
  await sendSmokeJson(`${abiWorkspaceApiUrl}/participant-roster`, {
    body: {
      rosterText: [
        {
          loginKey: abiLoginKey,
          groupKey: "group:official-abi",
          bookletKey: abiBookletKey,
          displayName: "Official ABI Participant",
          executionMode: "run-hot-return"
        }
      ]
    }
  });
  await page.goto(
    `${baseUrl}/participant?${new URLSearchParams({
      tenantKey: abiTenantKey,
      workspaceKey: abiWorkspaceKey,
      loginKey: abiLoginKey,
      bookletKey: abiBookletKey
    }).toString()}`,
    { waitUntil: "domcontentloaded" }
  );
  await page
    .locator("#participantVeronaPlayerVersion")
    .filter({ hasText: `API ${abiPlayerPackage.playerApiVersion}` })
    .waitFor({ timeout: 30_000 });
  const abiFrame = page.frameLocator("#participantVeronaPlayerFrame");
  await abiFrame
    .getByText("Abschnitt 1: Text und einfache Eingabe", { exact: true })
    .waitFor({ timeout: 30_000 });
  const abiTextInput = abiFrame.locator("input:not([type])").first();
  await abiTextInput.fill(abiResponse);
  await abiFrame.getByText("Sekundar I", { exact: true }).click();
  const abiParticipantSessionId = await page
    .locator("#participantRouteSessionId")
    .inputValue();
  assert.ok(abiParticipantSessionId);
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${abiParticipantSessionId}/current-state`,
    payload => {
      const response =
        payload?.currentRunState?.testRun?.unitResponses?.[abiUnitKey];
      if (typeof response !== "string") return false;
      try {
        const dataPart = JSON.parse(response).unitState?.dataParts?.allResponses;
        const answers = typeof dataPart === "string" ? JSON.parse(dataPart) : dataPart;
        return answers?.text_var1 === abiResponse && answers?.mc_var1 === "2";
      } catch {
        return false;
      }
    },
    30_000
  );
  await page.goto(
    `${baseUrl}/participant?participantSessionId=${encodeURIComponent(
      abiParticipantSessionId
    )}`,
    { waitUntil: "domcontentloaded" }
  );
  await page
    .locator("#participantVeronaPlayerVersion")
    .filter({ hasText: `API ${abiPlayerPackage.playerApiVersion}` })
    .waitFor({ timeout: 30_000 });
  const restoredAbiFrame = page.frameLocator("#participantVeronaPlayerFrame");
  await restoredAbiFrame
    .getByText("Abschnitt 1: Text und einfache Eingabe", { exact: true })
    .waitFor({ timeout: 30_000 });
  assert.equal(
    await restoredAbiFrame.locator("input:not([type])").first().inputValue(),
    abiResponse
  );
  assert.equal(
    await restoredAbiFrame
      .getByRole("radio", { name: "Sekundar I", exact: true })
      .isChecked(),
    true
  );

  logStep("participant-official-dan-player-family");
  const danPlayerPackage =
    officialProtocolCorpus.veronaPlayerFamilyPackages.find(
      playerPackage => playerPackage.family === "DAN visual assessment"
    );
  assert.ok(danPlayerPackage, "The official DAN player fixture should be pinned.");
  const danTenantKey = `${tenantKey}-verona-dan`;
  const danWorkspaceKey = `${workspaceKey}-verona-dan`;
  const danBookletKey = "BOOKLET.OFFICIAL.DAN-3.0";
  const danUnitKey = "UNIT.OFFICIAL.DAN-3.0";
  const danLoginKey = "student-official-dan";
  const danResponse = "Heute ging ich früher, um meinen Hunger zu stillen.";
  const [danPlayerDocument, danDefinitionDocument] = await Promise.all([
    readBrotliBase64Text(
      resolve(
        "test-fixtures/original-testcenter",
        danPlayerPackage.playerFixture
      )
    ),
    readFile(
      resolve(
        "test-fixtures/original-testcenter",
        danPlayerPackage.definitionFixture
      ),
      "utf8"
    ).then(encoded => Buffer.from(encoded.trim(), "base64").toString("utf8"))
  ]);
  const danPlayerZip = createStoredZipBuffer([
    {
      fileName: "export/imsmanifest.xml",
      content: `
        <manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1">
          <resources>
            <resource identifier="${danBookletKey}" href="booklets/Booklet.xml" />
            <resource identifier="${danUnitKey}" href="units/Unit.xml" />
            <resource identifier="${danPlayerPackage.playerKey}" href="players/Player.html" />
          </resources>
        </manifest>
      `
    },
    {
      fileName: "export/booklets/Booklet.xml",
      content: `
        <Booklet>
          <Metadata>
            <Id>${danBookletKey}</Id>
            <Label>Official DAN visual assessment</Label>
          </Metadata>
          <Units>
            <Unit id="${danUnitKey}" label="DAN visual assessment" />
          </Units>
        </Booklet>
      `
    },
    {
      fileName: "export/units/Unit.xml",
      content: `
        <Unit>
          <Metadata>
            <Id>${danUnitKey}</Id>
            <Label>Official DAN visual assessment</Label>
          </Metadata>
          <Definition player="${danPlayerPackage.playerKey}" type="${danPlayerPackage.unitDefinitionType}"><![CDATA[${danDefinitionDocument}]]></Definition>
        </Unit>
      `
    },
    {
      fileName: "export/players/Player.html",
      content: danPlayerDocument
    }
  ]);
  await sendSmokeJson(`${baseUrl}/api/v1/platform/tenants`, {
    body: {
      tenantKey: danTenantKey,
      displayName: "Official DAN Player"
    }
  });
  await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${danTenantKey}/workspaces`,
    {
      body: {
        workspaceKey: danWorkspaceKey,
        displayName: "Official DAN Player"
      }
    }
  );
  const danWorkspaceApiUrl =
    `${baseUrl}/api/v1/tenants/${danTenantKey}` +
    `/workspaces/${danWorkspaceKey}`;
  const danSourceResponse = await sendSmokeJson(
    `${danWorkspaceApiUrl}/source-packages`,
    {
      body: {
        fileName: "official-dan-3.0-browser-smoke.zip",
        mediaType: "application/zip",
        sourceDocument: `data:application/zip;base64,${danPlayerZip.toString("base64")}`
      }
    }
  );
  const danSourcePayload = await danSourceResponse.json();
  const danImportResponse = await sendSmokeJson(
    `${danWorkspaceApiUrl}/import-jobs`,
    {
      body: {
        sourcePackageId: danSourcePayload.sourcePackage.sourcePackageId
      }
    }
  );
  const danImportPayload = await danImportResponse.json();
  assert.equal(
    danImportPayload.importJob.status,
    "completed",
    JSON.stringify(danImportPayload.importJob.diagnostics)
  );
  const danReleaseId = danImportPayload.stagedContentRelease?.contentReleaseId;
  assert.ok(danReleaseId, "Official DAN import should stage a release.");
  await sendSmokeJson(
    `${danWorkspaceApiUrl}/content-releases/${danReleaseId}/activate`,
    { body: {} }
  );
  await sendSmokeJson(`${danWorkspaceApiUrl}/participant-roster`, {
    body: {
      rosterText: [
        {
          loginKey: danLoginKey,
          groupKey: "group:official-dan",
          bookletKey: danBookletKey,
          displayName: "Official DAN Participant",
          executionMode: "run-hot-return"
        }
      ]
    }
  });
  await page.goto(
    `${baseUrl}/participant?${new URLSearchParams({
      tenantKey: danTenantKey,
      workspaceKey: danWorkspaceKey,
      loginKey: danLoginKey,
      bookletKey: danBookletKey
    }).toString()}`,
    { waitUntil: "domcontentloaded" }
  );
  await page
    .locator("#participantVeronaPlayerVersion")
    .filter({ hasText: `API ${danPlayerPackage.playerApiVersion}` })
    .waitFor({ timeout: 30_000 });
  const danFrame = page.frameLocator("#participantVeronaPlayerFrame");
  await danFrame
    .getByText("Verbinde die vier folgenden Sätze zu einem Satz.", {
      exact: false
    })
    .waitFor({ timeout: 30_000 });
  const danTextInput = danFrame.locator("#canvasElement4_textbox");
  await danTextInput.pressSequentially(danResponse);
  await danFrame.locator("#canvasElement14_multipleChoice").click();
  const danParticipantSessionId = await page
    .locator("#participantRouteSessionId")
    .inputValue();
  assert.ok(danParticipantSessionId);
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${danParticipantSessionId}/current-state`,
    payload => {
      const response =
        payload?.currentRunState?.testRun?.unitResponses?.[danUnitKey];
      if (typeof response !== "string") return false;
      try {
        const all = JSON.parse(response).unitState?.dataParts?.all;
        if (typeof all !== "string") return false;
        const unitStatus = JSON.parse(all);
        return (
          unitStatus?.canvasElement4 === danResponse &&
          unitStatus?.canvasElement14 === "true"
        );
      } catch {
        return false;
      }
    },
    30_000
  );
  await page.goto(
    `${baseUrl}/participant?participantSessionId=${encodeURIComponent(
      danParticipantSessionId
    )}`,
    { waitUntil: "domcontentloaded" }
  );
  await page
    .locator("#participantVeronaPlayerVersion")
    .filter({ hasText: `API ${danPlayerPackage.playerApiVersion}` })
    .waitFor({ timeout: 30_000 });
  const restoredDanFrame = page.frameLocator("#participantVeronaPlayerFrame");
  await restoredDanFrame
    .getByText("Verbinde die vier folgenden Sätze zu einem Satz.", {
      exact: false
    })
    .waitFor({ timeout: 30_000 });
  assert.equal(
    await restoredDanFrame.locator("#canvasElement4_textbox").inputValue(),
    danResponse
  );
  assert.equal(
    await restoredDanFrame
      .locator("#canvasElement14_multipleChoice")
      .isChecked(),
    true
  );

  logStep("participant-historical-dan-testbed-player");
  const historicalDanPackage = danPlayerPackage.legacyTestbedPackage;
  assert.ok(
    historicalDanPackage,
    "The historical DAN Testbed package should be pinned."
  );
  const historicalDanTenantKey = `${tenantKey}-historical-dan`;
  const historicalDanWorkspaceKey = `${workspaceKey}-historical-dan`;
  const historicalDanBookletKey = "BOOKLET.OFFICIAL.DAN-TESTBED";
  const historicalDanUnitKey = "G231mm";
  const historicalDanLoginKey = "student-historical-dan";
  const historicalDanResponse =
    "Historischer Testbed-Player stellt diese Antwort wieder her.";
  const [
    historicalDanPlayerDocument,
    historicalDanUnitDocument,
    historicalDanDefinitionDocument
  ] = await Promise.all([
    readBrotliBase64Text(
      resolve(
        "test-fixtures/original-testcenter",
        historicalDanPackage.playerFixture
      )
    ),
    readFile(
      resolve(
        "test-fixtures/original-testcenter",
        historicalDanPackage.unitFixture
      ),
      "utf8"
    ),
    readFile(
      resolve(
        "test-fixtures/original-testcenter",
        danPlayerPackage.definitionFixture
      ),
      "utf8"
    ).then(encoded => Buffer.from(encoded.trim(), "base64").toString("utf8"))
  ]);
  const historicalDanZip = createStoredZipBuffer([
    {
      fileName: "export/imsmanifest.xml",
      content: `
        <manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1">
          <resources>
            <resource identifier="${historicalDanBookletKey}" href="booklets/Booklet.xml" />
            <resource identifier="${historicalDanUnitKey}" href="units/G231mm.xml" />
            <resource identifier="${historicalDanPackage.playerKey}" href="players/IQBVisualUnitPlayerV2.99.2.html" />
          </resources>
        </manifest>
      `
    },
    {
      fileName: "export/booklets/Booklet.xml",
      content: `
        <Booklet>
          <Metadata>
            <Id>${historicalDanBookletKey}</Id>
            <Label>Historical DAN Testbed</Label>
          </Metadata>
          <Units>
            <Unit id="${historicalDanUnitKey}" label="Sprachliche Mittel MM" />
          </Units>
        </Booklet>
      `
    },
    {
      fileName: "export/units/G231mm.xml",
      content: historicalDanUnitDocument
    },
    {
      fileName: "export/units/G231mm.voud",
      content: historicalDanDefinitionDocument
    },
    {
      fileName: "export/players/IQBVisualUnitPlayerV2.99.2.html",
      content: historicalDanPlayerDocument
    }
  ]);
  await sendSmokeJson(`${baseUrl}/api/v1/platform/tenants`, {
    body: {
      tenantKey: historicalDanTenantKey,
      displayName: "Historical DAN Testbed"
    }
  });
  await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${historicalDanTenantKey}/workspaces`,
    {
      body: {
        workspaceKey: historicalDanWorkspaceKey,
        displayName: "Historical DAN Testbed"
      }
    }
  );
  const historicalDanWorkspaceApiUrl =
    `${baseUrl}/api/v1/tenants/${historicalDanTenantKey}` +
    `/workspaces/${historicalDanWorkspaceKey}`;
  const historicalDanSourceResponse = await sendSmokeJson(
    `${historicalDanWorkspaceApiUrl}/source-packages`,
    {
      body: {
        fileName: "historical-dan-testbed-browser-smoke.zip",
        mediaType: "application/zip",
        sourceDocument: `data:application/zip;base64,${historicalDanZip.toString("base64")}`
      }
    }
  );
  const historicalDanSourcePayload = await historicalDanSourceResponse.json();
  const historicalDanImportResponse = await sendSmokeJson(
    `${historicalDanWorkspaceApiUrl}/import-jobs`,
    {
      body: {
        sourcePackageId:
          historicalDanSourcePayload.sourcePackage.sourcePackageId
      }
    }
  );
  const historicalDanImportPayload = await historicalDanImportResponse.json();
  assert.equal(
    historicalDanImportPayload.importJob.status,
    "completed",
    JSON.stringify(historicalDanImportPayload.importJob.diagnostics)
  );
  assert.equal(
    historicalDanImportPayload.importJob.diagnostics.some(
      diagnostic =>
        diagnostic.code === "source_document_player_metadata_missing" &&
        diagnostic.severity === "warning"
    ),
    true,
    JSON.stringify(historicalDanImportPayload.importJob.diagnostics)
  );
  const historicalDanReleaseId =
    historicalDanImportPayload.stagedContentRelease?.contentReleaseId;
  assert.ok(
    historicalDanReleaseId,
    "Historical DAN import should stage a release."
  );
  await sendSmokeJson(
    `${historicalDanWorkspaceApiUrl}/content-releases/${historicalDanReleaseId}/activate`,
    { body: {} }
  );
  await sendSmokeJson(`${historicalDanWorkspaceApiUrl}/participant-roster`, {
    body: {
      rosterText: [
        {
          loginKey: historicalDanLoginKey,
          groupKey: "group:historical-dan",
          bookletKey: historicalDanBookletKey,
          displayName: "Historical DAN Participant",
          executionMode: "run-hot-return"
        }
      ]
    }
  });
  await page.goto(
    `${baseUrl}/participant?${new URLSearchParams({
      tenantKey: historicalDanTenantKey,
      workspaceKey: historicalDanWorkspaceKey,
      loginKey: historicalDanLoginKey,
      bookletKey: historicalDanBookletKey
    }).toString()}`,
    { waitUntil: "domcontentloaded" }
  );
  await page
    .locator("#participantVeronaPlayerVersion")
    .filter({ hasText: `API ${historicalDanPackage.playerApiVersion}` })
    .waitFor({ timeout: 30_000 });
  const historicalDanFrame = page.frameLocator(
    "#participantVeronaPlayerFrame"
  );
  await historicalDanFrame
    .getByText("Verbinde die vier folgenden Sätze zu einem Satz.", {
      exact: false
    })
    .waitFor({ timeout: 30_000 });
  await historicalDanFrame
    .locator("#canvasElement4_textbox")
    .pressSequentially(historicalDanResponse);
  await historicalDanFrame.locator("#canvasElement14_multipleChoice").click();
  const historicalDanParticipantSessionId = await page
    .locator("#participantRouteSessionId")
    .inputValue();
  assert.ok(historicalDanParticipantSessionId);
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${historicalDanParticipantSessionId}/current-state`,
    payload => {
      const response =
        payload?.currentRunState?.testRun?.unitResponses?.[
          historicalDanUnitKey
        ];
      if (typeof response !== "string") return false;
      try {
        const all = JSON.parse(response).unitState?.dataParts?.all;
        if (typeof all !== "string") return false;
        const unitStatus = JSON.parse(all);
        return (
          unitStatus?.canvasElement4 === historicalDanResponse &&
          unitStatus?.canvasElement14 === "true"
        );
      } catch {
        return false;
      }
    },
    30_000
  );
  await page.goto(
    `${baseUrl}/participant?participantSessionId=${encodeURIComponent(
      historicalDanParticipantSessionId
    )}`,
    { waitUntil: "domcontentloaded" }
  );
  await page
    .locator("#participantVeronaPlayerVersion")
    .filter({ hasText: `API ${historicalDanPackage.playerApiVersion}` })
    .waitFor({ timeout: 30_000 });
  const restoredHistoricalDanFrame = page.frameLocator(
    "#participantVeronaPlayerFrame"
  );
  await restoredHistoricalDanFrame
    .getByText("Verbinde die vier folgenden Sätze zu einem Satz.", {
      exact: false
    })
    .waitFor({ timeout: 30_000 });
  assert.equal(
    await restoredHistoricalDanFrame
      .locator("#canvasElement4_textbox")
      .inputValue(),
    historicalDanResponse
  );
  assert.equal(
    await restoredHistoricalDanFrame
      .locator("#canvasElement14_multipleChoice")
      .isChecked(),
    true
  );

  logStep("participant-official-stars-player-family");
  const starsPlayerPackage =
    officialProtocolCorpus.currentOriginalStarsPackage;
  assert.ok(
    starsPlayerPackage,
    "The current Original Testcenter STARS package should be pinned."
  );
  const starsTenantKey = `${tenantKey}-verona-stars`;
  const starsWorkspaceKey = `${workspaceKey}-verona-stars`;
  const starsBookletKey = starsPlayerPackage.booklet.bookletKey;
  const starsUnitKey = starsPlayerPackage.unit.unitKey;
  const starsLoginKey = "stars-3";
  const [
    starsPlayerDocument,
    starsDefinitionDocument,
    starsMetadataDocument,
    starsUnitDocument,
    starsBookletDocument,
    starsRosterDocument
  ] = await Promise.all([
    readBrotliBase64Text(
      resolve(
        "test-fixtures/original-testcenter",
        starsPlayerPackage.player.fixture
      )
    ),
    readFile(
      resolve(
        "test-fixtures/original-testcenter",
        starsPlayerPackage.definition.fixture
      ),
      "utf8"
    ).then(encoded => Buffer.from(encoded.trim(), "base64").toString("utf8")),
    readFile(
      resolve(
        "test-fixtures/original-testcenter",
        starsPlayerPackage.metadata.fixture
      ),
      "utf8"
    ).then(encoded => Buffer.from(encoded.trim(), "base64").toString("utf8")),
    readFile(
      resolve(
        "test-fixtures/original-testcenter",
        starsPlayerPackage.unit.fixture
      ),
      "utf8"
    ),
    readFile(
      resolve(
        "test-fixtures/original-testcenter",
        starsPlayerPackage.booklet.fixture
      ),
      "utf8"
    ),
    readFile(
      resolve(
        "test-fixtures/original-testcenter",
        starsPlayerPackage.roster.fixture
      ),
      "utf8"
    )
  ]);
  const starsPlayerZip = createStoredZipBuffer([
    {
      fileName: "export/imsmanifest.xml",
      content: `
        <manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1">
          <resources>
            <resource identifier="${starsBookletKey}" href="booklets/CY_Bklt_Stars.xml" />
            <resource identifier="${starsUnitKey}" href="units/CY-StarsUnit-001.xml" />
            <resource identifier="${starsUnitKey}.voud" href="units/CY-StarsUnit-001.voud" />
            <resource identifier="${starsUnitKey}.vomd" href="units/CY-StarsUnit-001.vomd" />
            <resource identifier="${starsPlayerPackage.player.playerKey}" href="players/iqb-player-stars-0.6.40.html" />
          </resources>
        </manifest>
      `
    },
    {
      fileName: "export/booklets/CY_Bklt_Stars.xml",
      content: starsBookletDocument
    },
    {
      fileName: "export/units/CY-StarsUnit-001.xml",
      content: starsUnitDocument
    },
    {
      fileName: "export/units/CY-StarsUnit-001.voud",
      content: starsDefinitionDocument
    },
    {
      fileName: "export/units/CY-StarsUnit-001.vomd",
      content: starsMetadataDocument
    },
    {
      fileName: "export/players/iqb-player-stars-0.6.40.html",
      content: starsPlayerDocument
    }
  ]);
  await sendSmokeJson(`${baseUrl}/api/v1/platform/tenants`, {
    body: {
      tenantKey: starsTenantKey,
      displayName: "Official STARS Player"
    }
  });
  await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${starsTenantKey}/workspaces`,
    {
      body: {
        workspaceKey: starsWorkspaceKey,
        displayName: "Official STARS Player"
      }
    }
  );
  const starsWorkspaceApiUrl =
    `${baseUrl}/api/v1/tenants/${starsTenantKey}` +
    `/workspaces/${starsWorkspaceKey}`;
  const starsSourceResponse = await sendSmokeJson(
    `${starsWorkspaceApiUrl}/source-packages`,
    {
      body: {
        fileName: "current-original-stars-0.6.40-browser-smoke.zip",
        mediaType: "application/zip",
        sourceDocument: `data:application/zip;base64,${starsPlayerZip.toString("base64")}`
      }
    }
  );
  const starsSourcePayload = await starsSourceResponse.json();
  const starsImportResponse = await sendSmokeJson(
    `${starsWorkspaceApiUrl}/import-jobs`,
    {
      body: {
        sourcePackageId: starsSourcePayload.sourcePackage.sourcePackageId
      }
    }
  );
  const starsImportPayload = await starsImportResponse.json();
  assert.equal(
    starsImportPayload.importJob.status,
    "completed",
    JSON.stringify(starsImportPayload.importJob.diagnostics)
  );
  const starsReleaseId = starsImportPayload.stagedContentRelease?.contentReleaseId;
  assert.ok(starsReleaseId, "Official STARS import should stage a release.");
  await sendSmokeJson(
    `${starsWorkspaceApiUrl}/content-releases/${starsReleaseId}/activate`,
    { body: {} }
  );
  await sendSmokeJson(`${starsWorkspaceApiUrl}/participant-roster`, {
    body: {
      rosterText: starsRosterDocument
    }
  });
  const starsSignInResponse = await sendSmokeJson(
    `${baseUrl}/api/v1/participant/auth/sign-in`,
    {
      body: {
        tenantKey: starsTenantKey,
        workspaceKey: starsWorkspaceKey,
        loginKey: starsLoginKey,
        password: "123"
      }
    }
  );
  const starsSignInPayload = await starsSignInResponse.json();
  const starsParticipantSessionId =
    starsSignInPayload.participantSession.participantSessionId;
  assert.ok(starsParticipantSessionId);
  await sendSmokeJson(
    `${baseUrl}/api/v1/participant/sessions/${starsParticipantSessionId}/resume`,
    { body: { bookletKey: starsBookletKey } }
  );
  await page.goto(
    `${baseUrl}/participant?participantSessionId=${encodeURIComponent(
      starsParticipantSessionId
    )}`,
    { waitUntil: "domcontentloaded" }
  );
  await page
    .locator("#participantVeronaPlayerVersion")
    .filter({ hasText: `API ${starsPlayerPackage.player.playerApiVersion}` })
    .waitFor({ timeout: 30_000 });
  const starsFrame = page.frameLocator("#participantVeronaPlayerFrame");
  const starsChoice = starsFrame.locator('[data-cy="button-0"] input');
  await starsChoice.waitFor({ state: "attached", timeout: 30_000 });
  await starsChoice.dispatchEvent("click");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${starsParticipantSessionId}/current-state`,
    payload => {
      const response =
        payload?.currentRunState?.testRun?.unitResponses?.["1"];
      if (typeof response !== "string") return false;
      try {
        const unitState = JSON.parse(response).unitState;
        if (
          unitState?.unitStateDataType !==
          starsPlayerPackage.player.unitStateType
        ) return false;
        const responses = unitState?.dataParts?.responses;
        if (typeof responses !== "string") return false;
        const values = JSON.parse(responses);
        return values?.some(
          value =>
            value?.id === "interact" &&
            value?.status === "CODING_COMPLETE" &&
            String(value?.value) === "1"
        );
      } catch {
        return false;
      }
    },
    30_000
  );
  const starsContinueButton = starsFrame.locator(
    '[data-cy="continue-button"]'
  );
  await starsContinueButton.waitFor({ state: "attached", timeout: 30_000 });
  await starsContinueButton.dispatchEvent("click");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${starsParticipantSessionId}/current-state`,
    payload => payload?.currentRunState?.testRun?.currentUnitKey === "2",
    30_000
  );
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "2" })
    .waitFor({ timeout: 30_000 });
  const starsSecondFrame = page.frameLocator("#participantVeronaPlayerFrame");
  const starsSecondChoice = starsSecondFrame.locator(
    '[data-cy="button-1"] input'
  );
  await starsSecondChoice.waitFor({ state: "attached", timeout: 30_000 });
  await starsSecondChoice.dispatchEvent("click");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${starsParticipantSessionId}/current-state`,
    payload => {
      const response = payload?.currentRunState?.testRun?.unitResponses?.["2"];
      if (typeof response !== "string") return false;
      try {
        const unitState = JSON.parse(response).unitState;
        if (
          unitState?.unitStateDataType !==
          starsPlayerPackage.player.unitStateType
        ) return false;
        const responses = unitState?.dataParts?.responses;
        if (typeof responses !== "string") return false;
        return JSON.parse(responses)?.some(
          value =>
            value?.id === "interact" &&
            value?.status === "CODING_COMPLETE" &&
            String(value?.value) === "2"
        );
      } catch {
        return false;
      }
    },
    30_000
  );
  await page.goto(
    `${baseUrl}/participant?participantSessionId=${encodeURIComponent(
      starsParticipantSessionId
    )}`,
    { waitUntil: "domcontentloaded" }
  );
  await page
    .locator("#participantVeronaPlayerVersion")
    .filter({ hasText: `API ${starsPlayerPackage.player.playerApiVersion}` })
    .waitFor({ timeout: 30_000 });
  const restoredStarsFrame = page.frameLocator("#participantVeronaPlayerFrame");
  const restoredStarsChoice = restoredStarsFrame.locator(
    '[data-cy="button-1"] input'
  );
  await restoredStarsChoice.waitFor({ state: "attached", timeout: 30_000 });
  assert.equal(await restoredStarsChoice.isChecked(), true);
  stopAfter("participant-verona-player-families");

  logStep("participant-original-aspect-player");
  const aspectLoginKey = "testuser1";
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
    aspectThirdDefinitionDocument,
    aspectRosterDocument
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
      ),
      readFile(
        resolve(
          "test-fixtures/original-testcenter/rosters/aspect-testtaker1.xml"
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
  const aspectRosterImportResponse = await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-roster`,
    {
      body: { rosterText: aspectRosterDocument }
    }
  );
  const aspectRosterImportPayload = await aspectRosterImportResponse.json();
  assert.equal(aspectRosterImportResponse.status, 201);
  assert.equal(aspectRosterImportPayload.importedCount, 3);
  for (const loginKey of ["testuser1", "testuser2", "testuser-review"]) {
    assert.ok(
      aspectRosterImportPayload.items.some(item => item.loginKey === loginKey),
      `Original Aspect roster should expose ${loginKey}.`
    );
  }
  assert.deepEqual(
    aspectRosterImportPayload.operationalLoginCandidates.map(
      candidate => candidate.loginKey
    ),
    ["testuser-monitor"]
  );
  await page.goto(
    `${baseUrl}/participant?${new URLSearchParams({
      tenantKey,
      workspaceKey,
      loginKey: aspectLoginKey,
      bookletKey: aspectBookletKey
    }).toString()}`,
    { waitUntil: "domcontentloaded" }
  );
  await page
    .locator("#participantVeronaPlayerVersion")
    .filter({ hasText: "API 6.0" })
    .waitFor({ timeout: 30_000 });
  const aspectUnitNavigation = page.locator(
    "#participantRouteUnitNavigationList"
  );
  await aspectUnitNavigation.waitFor({ timeout: 30_000 });
  assert.deepEqual(
    await aspectUnitNavigation
      .locator(".participant-unit-navigation-item")
      .allTextContents(),
    ["1", "2", "3"]
  );
  assert.equal(
    await page.locator("#participantRouteUnitNavigationLabel").count(),
    0,
    "Legacy FULL navigation should render authored short labels instead of a second current-Unit label."
  );
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
  assert.deepEqual(
    savedAspectState.currentRunState.bookletUnits.map(unit => [
      unit.unitKey,
      unit.shortLabel
    ]),
    [
      ["testcenter-sample1", "1"],
      ["testcenter-sample2", "2"],
      ["testcenter-sample3", "3"]
    ]
  );
  const aspectNextUnitButton = page.locator("#participantRouteNextUnitButton");
  assert.equal(await aspectNextUnitButton.isEnabled(), true);
  const aspectSecondUnitNavigationItem = aspectUnitNavigation.locator(
    '[data-unit-key="testcenter-sample2"]'
  );
  assert.equal(await aspectSecondUnitNavigationItem.isEnabled(), true);
  await aspectFrame.locator("body").evaluate(
    (_body, request) => parent.postMessage({
      type: "vopUnitNavigationRequestedNotification",
      sessionId: request.sessionId,
      target: request.target
    }, "*"),
    {
      sessionId: aspectUnitKey,
      target: "testcenter-sample2"
    }
  );
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
    { waitUntil: "domcontentloaded" }
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

  logStep("participant-original-sample-package");
  const originalSampleTenantKey = `${tenantKey}-original-sample`;
  const originalSampleWorkspaceKey = `${workspaceKey}-original-sample`;
  const originalSampleWorkspaceApiUrl =
    `${baseUrl}/api/v1/tenants/${originalSampleTenantKey}` +
    `/workspaces/${originalSampleWorkspaceKey}`;
  const originalSampleBookletKey = "BOOKLET.SAMPLE-1";
  const originalSampleUnitKey = "UNIT.SAMPLE";
  const originalSampleLoginKey = "test-no-pw";
  const originalSampleResponse = "Saved from the original external HTML unit";
  const originalSampleResourceContent =
    'This content was fetched dynamically by the player via directDownloadUrl from resource-package "sample_resource_package".\n';
  await sendSmokeJson(`${baseUrl}/api/v1/platform/tenants`, {
    body: {
      tenantKey: originalSampleTenantKey,
      displayName: "UI Original Sample Package Tenant"
    }
  });
  await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${originalSampleTenantKey}/workspaces`,
    {
      body: {
        workspaceKey: originalSampleWorkspaceKey,
        displayName: "UI Original Sample Package Workspace"
      }
    }
  );
  const originalSampleFiles = [
    {
      fileName: "Booklet.xml",
      mediaType: "application/xml",
      sourceDocument: await readFile(
        resolve("test-fixtures/original-testcenter/booklets/Booklet.xml"),
        "utf8"
      )
    },
    {
      fileName: "Unit.xml",
      mediaType: "application/xml",
      sourceDocument: await readFile(
        resolve("test-fixtures/original-testcenter/units/Unit.xml"),
        "utf8"
      )
    },
    {
      fileName: "Unit2.xml",
      mediaType: "application/xml",
      sourceDocument: await readFile(
        resolve("test-fixtures/original-testcenter/units/Unit2.xml"),
        "utf8"
      )
    },
    {
      fileName: "SAMPLE_UNITCONTENTS.HTM",
      mediaType: "text/html",
      sourceDocument: await readFile(
        resolve(
          "test-fixtures/original-testcenter/definitions/SAMPLE_UNITCONTENTS.HTM"
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
    },
    {
      fileName: "coding-scheme.vocs.json",
      mediaType: "application/json",
      sourceDocument: `data:application/json;base64,${(
        await readFile(
          resolve(
            "test-fixtures/original-testcenter/schemes/coding-scheme.vocs.json.base64"
          ),
          "utf8"
        )
      ).trim()}`
    },
    {
      fileName: "sample_resource_package.itcr.zip",
      mediaType: "application/zip",
      sourceDocument: `data:application/zip;base64,${(
        await readFile(
          resolve(
            "test-fixtures/original-testcenter/resources/sample_resource_package.itcr.zip.base64"
          ),
          "utf8"
        )
      ).trim()}`
    }
  ];
  let originalSampleRootSourcePackageId = "";
  for (const file of originalSampleFiles) {
    const uploadResponse = await sendSmokeJson(
      `${originalSampleWorkspaceApiUrl}/source-packages`,
      { body: file }
    );
    const uploadPayload = await uploadResponse.json();
    if (file.fileName === "Booklet.xml") {
      originalSampleRootSourcePackageId =
        uploadPayload.sourcePackage?.sourcePackageId ?? "";
    }
  }
  assert.ok(originalSampleRootSourcePackageId);
  const originalSampleImportResponse = await sendSmokeJson(
    `${originalSampleWorkspaceApiUrl}/import-jobs`,
    { body: { sourcePackageId: originalSampleRootSourcePackageId } }
  );
  const originalSampleImportPayload = await originalSampleImportResponse.json();
  assert.equal(originalSampleImportPayload.importJob?.status, "completed");
  assert.notEqual(
    originalSampleImportPayload.importJob?.sourcePackageId,
    originalSampleRootSourcePackageId,
    "The original loose sample should import through an immutable dependency snapshot."
  );
  const originalSampleReleaseId =
    originalSampleImportPayload.stagedContentRelease?.contentReleaseId;
  assert.ok(originalSampleReleaseId);
  await sendSmokeJson(
    `${originalSampleWorkspaceApiUrl}` +
      `/content-releases/${originalSampleReleaseId}/activate`,
    { body: { forceActivation: true } }
  );
  const originalSampleRosterDocument = await readFile(
    resolve("test-fixtures/original-testcenter/rosters/Testtakers.xml"),
    "utf8"
  );
  const originalSampleRosterResponse = await sendSmokeJson(
    `${originalSampleWorkspaceApiUrl}/participant-roster`,
    { body: { rosterText: originalSampleRosterDocument } }
  );
  const originalSampleRosterPayload = await originalSampleRosterResponse.json();
  assert.deepEqual(
    originalSampleRosterPayload.items.find(
      item => item.loginKey === originalSampleLoginKey
    )?.validationWarnings,
    []
  );
  await page.goto(
    `${baseUrl}/participant?${new URLSearchParams({
      tenantKey: originalSampleTenantKey,
      workspaceKey: originalSampleWorkspaceKey,
      loginKey: originalSampleLoginKey,
      bookletKey: originalSampleBookletKey
    }).toString()}`,
    { waitUntil: "domcontentloaded" }
  );
  await page
    .locator("#participantVeronaPlayerVersion")
    .filter({ hasText: "API 6.0" })
    .waitFor({ timeout: 30_000 });
  const originalSampleFrame = page.frameLocator(
    "#participantVeronaPlayerFrame"
  );
  await originalSampleFrame
    .locator('[data-cy="legend-about"]')
    .waitFor({ timeout: 30_000 });
  await originalSampleFrame
    .locator('[data-cy="legend-longContent"]')
    .filter({ hasText: "Long Content and Form Elements" })
    .waitFor();
  const originalSampleParticipantSessionId = await page
    .locator("#participantRouteSessionId")
    .inputValue();
  assert.ok(originalSampleParticipantSessionId);
  const requiredTextField = originalSampleFrame.locator(
    'input[name="required-text-field"]'
  );
  await requiredTextField.fill(originalSampleResponse);
  await requiredTextField.dispatchEvent("keyup", {
    key: "e",
    code: "KeyE"
  });
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${originalSampleParticipantSessionId}/current-state`,
    payload => {
      if (
        payload?.currentRunState?.testRun?.currentUnitKey !==
        originalSampleUnitKey
      ) {
        return false;
      }
      const response =
        payload.currentRunState.testRun.unitResponses?.[originalSampleUnitKey];
      if (typeof response !== "string") return false;
      try {
        const parsed = JSON.parse(response);
        const answers = JSON.parse(parsed.unitState?.dataParts?.answers ?? "[]");
        return answers.some(
          answer =>
            answer.id === "required-text-field" &&
            answer.value === originalSampleResponse
        );
      } catch {
        return false;
      }
    },
    30_000
  );
  const originalSampleResourceResponse = await fetch(
    `${baseUrl}/api/v1/participant/sessions/` +
      `${originalSampleParticipantSessionId}/resources/` +
      "sample_resource_package/file.text"
  );
  assert.equal(originalSampleResourceResponse.status, 200);
  assert.equal(
    await originalSampleResourceResponse.text(),
    originalSampleResourceContent
  );
  await page.goto(
    `${baseUrl}/participant?participantSessionId=${encodeURIComponent(
      originalSampleParticipantSessionId
    )}`,
    { waitUntil: "domcontentloaded" }
  );
  const resumedOriginalSampleFrame = page.frameLocator(
    "#participantVeronaPlayerFrame"
  );
  await resumedOriginalSampleFrame
    .locator('input[name="required-text-field"]')
    .waitFor({ timeout: 30_000 });
  assert.equal(
    await resumedOriginalSampleFrame
      .locator('input[name="required-text-field"]')
      .inputValue(),
    originalSampleResponse
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
    },
    ...Array.from({ length: 6 }, (_, index) => {
      const number = index + 5;
      return {
        fixture: `booklets/system-test/CY_Bklt_BkltConfig_${number}.xml`,
        bookletKey: `Cy-Bklt_BkltConfig-${number}`
      };
    }),
    ...Array.from({ length: 4 }, (_, index) => {
      const number = index + 11;
      return {
        fixture: `booklets/system-test/CY_Bklt_BkltConfig_${number}.xml`,
        bookletKey: `Cy-Bklt_BkltConfig-${number}`
      };
    }),
    ...[15, 16, 17, 18].map(number => ({
      fixture: `booklets/system-test/CY_Bklt_BkltConfig_${number}.xml`,
      bookletKey: `Cy-Bklt_BkltConfig-${number}`
    })),
    ...Array.from({ length: 33 }, (_, index) => {
      const number = index + 19;
      return {
        fixture: `booklets/system-test/CY_Bklt_BkltConfig_${number}.xml`,
        bookletKey: `Cy-Bklt_BkltConfig-${number}`
      };
    })
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
      { waitUntil: "domcontentloaded" }
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
    await page.locator("#participantRouteUnitNavigationLabel").count(),
    0
  );
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
  await page
    .locator("#participantRouteUnitNavigationLabel")
    .filter({ hasText: "Aufgabe1" })
    .waitFor();
  assert.equal(await page.locator("#participantRouteUnitRail").count(), 0);
  assert.equal(
    await page.locator("#participantRouteUnitNavigationList").count(),
    0
  );
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
  await page
    .locator("#participantRouteUnitNavigationLabel")
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
  await page
    .locator("#participantRouteUnitNavigationLabel")
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
  await page
    .locator("#participantRouteUnitNavigationLabel")
    .filter({ hasText: "Aufgabe1" })
    .waitFor();
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
  await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${bookletConfigTenantKey}/workspaces/${bookletConfigWorkspaceKey}/participant-roster`,
    {
      body: {
        rosterText: [
          ...Array.from({ length: 4 }, (_, index) => index + 11),
          15,
          16,
          17,
          18,
          ...Array.from({ length: 33 }, (_, index) => index + 19)
        ].map(number => {
          return {
            loginKey: `Bklt_Config-${number}`,
            password: "123",
            groupKey: "bklt-config-navigation",
            bookletKey: `Cy-Bklt_BkltConfig-${number}`,
            executionMode: "run-hot-restart"
          };
        })
      }
    }
  );
  await openOriginalBookletConfig(
    "Bklt_Config-11",
    "Cy-Bklt_BkltConfig-11"
  );
  await page
    .locator("#participantRouteScreenHeader")
    .filter({ hasText: "Bklt-config-11" })
    .waitFor();

  await openOriginalBookletConfig(
    "Bklt_Config-12",
    "Cy-Bklt_BkltConfig-12"
  );
  assert.equal(await page.locator("#participantRouteScreenHeader").count(), 0);
  await page
    .locator("#participantRouteUnit")
    .filter({ hasText: "Aufgabe1" })
    .waitFor();

  await openOriginalBookletConfig(
    "Bklt_Config-13",
    "Cy-Bklt_BkltConfig-13"
  );
  await page
    .locator("#participantRouteScreenHeader")
    .filter({ hasText: "Aufgabenblock" })
    .waitFor();

  await openOriginalBookletConfig(
    "Bklt_Config-14",
    "Cy-Bklt_BkltConfig-14"
  );
  await page
    .locator("#participantRouteScreenHeader")
    .filter({ hasText: "Aufgabe1" })
    .waitFor();
  await page.locator("#participantRouteNextUnitButton").click();
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "cpy" })
    .waitFor({ timeout: 15_000 });
  await page
    .locator("#participantRouteScreenHeader")
    .filter({ hasText: "Aufgabe2" })
    .waitFor();

  await openOriginalBookletConfig(
    "Bklt_Config-15",
    "Cy-Bklt_BkltConfig-15"
  );
  await page.locator("#participantApplicationHeader").waitFor();
  assert.equal(await page.locator("#participantStandaloneLogo").count(), 0);
  await page
    .locator("#participantRouteUnit")
    .filter({ hasText: "Aufgabe1" })
    .waitFor();

  await openOriginalBookletConfig(
    "Bklt_Config-16",
    "Cy-Bklt_BkltConfig-16"
  );
  await page.locator("#participantStandaloneLogo").waitFor();
  assert.equal(await page.locator("#participantApplicationHeader").count(), 0);
  assert.equal(await page.locator("#participantRouteScreenHeader").count(), 0);
  await page
    .locator("#participantRouteUnit")
    .filter({ hasText: "Aufgabe1" })
    .waitFor();
  await page.locator("#participantRouteClearSessionButton").waitFor();
  await page.locator("#participantStandaloneLogo").click();
  await page.locator("#participantRouteEntry").waitFor();
  await page.locator("#participantApplicationHeader").waitFor();
  assert.equal(await page.locator("#participantStandaloneLogo").count(), 0);

  const configSeventeenBrowser = await openOriginalBookletConfig(
    "Bklt_Config-17",
    "Cy-Bklt_BkltConfig-17"
  );
  await expectButtonSelectorEnabled("#participantRouteCompleteButton");
  await page.locator("#participantRouteCompleteButton").click();
  await page
    .locator("#participantConfirmationTitle")
    .filter({ hasText: "Complete test?" })
    .waitFor();
  await page.locator("#participantConfirmationContinueButton").click();
  await page.locator("#participantRouteCompletedState").waitFor();
  await page
    .locator("#participantRouteStatus")
    .filter({ hasText: "completed" })
    .waitFor();
  const configSeventeenRuntimeState = await (
    await sendSmokeJson(
      `${baseUrl}/api/v1/participant/sessions/${encodeURIComponent(
        configSeventeenBrowser.participantSessionId
      )}/runtime-state`,
      { method: "GET" }
    )
  ).json();
  assert.equal(
    configSeventeenRuntimeState.runtimeState?.runtimeStatus,
    "completed"
  );
  assert.equal(
    configSeventeenRuntimeState.runtimeState?.availableAction,
    "none"
  );

  const configEighteenBrowser = await openOriginalBookletConfig(
    "Bklt_Config-18",
    "Cy-Bklt_BkltConfig-18"
  );
  await page.locator("#participantRouteUnitRail").waitFor();
  await expectButtonSelectorEnabled("#participantRouteCompleteButton");
  await page.locator("#participantRouteCompleteButton").click();
  await page
    .locator("#participantConfirmationTitle")
    .filter({ hasText: "Complete test?" })
    .waitFor();
  await page.locator("#participantConfirmationContinueButton").click();
  await page.locator("#participantRoutePausedState").waitFor();
  assert.equal(
    await page.locator("#participantRouteResumeRunButton").count(),
    0
  );
  const configEighteenLockedState = await (
    await sendSmokeJson(
      `${baseUrl}/api/v1/participant/sessions/${encodeURIComponent(
        configEighteenBrowser.participantSessionId
      )}/current-state`,
      { method: "GET" }
    )
  ).json();
  assert.equal(
    configEighteenLockedState.currentRunState?.testRun?.status,
    "paused"
  );
  assert.equal(
    configEighteenLockedState.currentRunState?.testRun?.locked,
    true
  );
  assert.deepEqual(
    configEighteenLockedState.currentRunState?.availableActions,
    []
  );

  await openOriginalBookletConfig(
    "Bklt_Config-23",
    "Cy-Bklt_BkltConfig-23"
  );
  assert.equal(
    await page.locator("#participantVeronaGlobalForwardButton").count(),
    0,
    "HIDDEN must omit the separate global forward button."
  );
  await openOriginalBookletConfig(
    "Bklt_Config-25",
    "Cy-Bklt_BkltConfig-25"
  );
  await expectButtonSelectorEnabled("#participantVeronaGlobalForwardButton");
  await page.locator("#participantVeronaGlobalForwardButton").click();
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "cpy" })
    .waitFor({ timeout: 15_000 });
  const verifyCurrentPageOnReturn = async (number, expectedPageLabel) => {
    await openOriginalBookletConfig(
      `Bklt_Config-${number}`,
      `Cy-Bklt_BkltConfig-${number}`
    );
    await page
      .locator("#participantVeronaPageLabel")
      .filter({ hasText: "Page 1/2" })
      .waitFor();
    await expectButtonSelectorEnabled("#participantVeronaNextPageButton");
    await page.locator("#participantVeronaNextPageButton").click();
    await page
      .locator("#participantVeronaPageLabel")
      .filter({ hasText: "Page 2/2" })
      .waitFor();
    await page.locator("#participantRouteNextUnitButton").click();
    await page
      .locator("#participantRouteUnitKey")
      .filter({ hasText: "cpy" })
      .waitFor({ timeout: 15_000 });
    await page.locator("#participantRoutePreviousUnitButton").click();
    await page
      .locator("#participantRouteUnitKey")
      .filter({ hasText: "CY-Unit.Sample-101" })
      .waitFor({ timeout: 15_000 });
    await page
      .locator("#participantVeronaPageLabel")
      .filter({ hasText: expectedPageLabel })
      .waitFor({ timeout: 15_000 });
  };
  await verifyCurrentPageOnReturn(27, "Page 1/2");
  await verifyCurrentPageOnReturn(28, "Page 2/2");

  await openOriginalBookletConfig(
    "Bklt_Config-29",
    "Cy-Bklt_BkltConfig-29"
  );
  await page
    .locator("#participantRouteUnitNavigationLabel")
    .filter({ hasText: "Unit 1 / 2" })
    .waitFor();

  await openOriginalBookletConfig(
    "Bklt_Config-30",
    "Cy-Bklt_BkltConfig-30"
  );
  await page
    .locator("#participantRouteUnitNavigationLabel")
    .filter({ hasText: "Aufgabe1" })
    .waitFor();

  await openOriginalBookletConfig(
    "Bklt_Config-31",
    "Cy-Bklt_BkltConfig-31"
  );
  assert.equal(
    await page.locator("#participantRouteUnitNavigationLabel").count(),
    0
  );

  await openOriginalBookletConfig(
    "Bklt_Config-32",
    "Cy-Bklt_BkltConfig-32"
  );
  await expectButtonSelectorDisabled("#participantRoutePreviousUnitButton");
  await expectButtonSelectorEnabled("#participantRouteNextUnitButton");

  await openOriginalBookletConfig(
    "Bklt_Config-33",
    "Cy-Bklt_BkltConfig-33"
  );
  assert.equal(
    await page.locator("#participantRoutePreviousUnitButton").count(),
    0
  );
  assert.equal(
    await page.locator("#participantRouteNextUnitButton").count(),
    0
  );

  await openOriginalBookletConfig(
    "Bklt_Config-34",
    "Cy-Bklt_BkltConfig-34"
  );
  await page
    .locator("#participantVeronaPageLabel")
    .filter({ hasText: "Page 1/2" })
    .waitFor();

  await openOriginalBookletConfig(
    "Bklt_Config-35",
    "Cy-Bklt_BkltConfig-35"
  );
  await page
    .locator("#participantVeronaPageLabel")
    .filter({ hasText: "Aufgabe1: Fieldset1" })
    .waitFor();

  await openOriginalBookletConfig(
    "Bklt_Config-36",
    "Cy-Bklt_BkltConfig-36"
  );
  const pageListItems = page.locator(
    "#participantVeronaPageLabel .verona-player-page-list > span"
  );
  await pageListItems.first().waitFor();
  assert.equal(await pageListItems.count(), 2);
  assert.equal(await pageListItems.first().getAttribute("aria-current"), "page");

  await openOriginalBookletConfig(
    "Bklt_Config-37",
    "Cy-Bklt_BkltConfig-37"
  );
  assert.equal(await page.locator("#participantVeronaPageLabel").count(), 0);
  await expectButtonSelectorDisabled("#participantVeronaPreviousPageButton");
  await expectButtonSelectorEnabled("#participantVeronaNextPageButton");

  await openOriginalBookletConfig(
    "Bklt_Config-38",
    "Cy-Bklt_BkltConfig-38"
  );
  await expectButtonSelectorDisabled("#participantVeronaPreviousPageButton");
  await expectButtonSelectorEnabled("#participantVeronaNextPageButton");

  await openOriginalBookletConfig(
    "Bklt_Config-39",
    "Cy-Bklt_BkltConfig-39"
  );
  assert.equal(
    await page.locator("#participantVeronaPreviousPageButton").count(),
    0
  );
  assert.equal(
    await page.locator("#participantVeronaNextPageButton").count(),
    0
  );

  await openOriginalBookletConfig(
    "Bklt_Config-40",
    "Cy-Bklt_BkltConfig-40"
  );
  await page
    .locator("#participantRouteUnit")
    .filter({ hasText: "Aufgabe1" })
    .waitFor();

  await openOriginalBookletConfig(
    "Bklt_Config-41",
    "Cy-Bklt_BkltConfig-41"
  );
  assert.equal(await page.locator("#participantRouteUnit").count(), 0);

  await openOriginalBookletConfig(
    "Bklt_Config-42",
    "Cy-Bklt_BkltConfig-42"
  );
  assert.equal(await page.locator("#participantRouteUnitRail").count(), 0);

  await openOriginalBookletConfig(
    "Bklt_Config-43",
    "Cy-Bklt_BkltConfig-43"
  );
  await page.locator("#participantRouteUnitRail").waitFor();

  await openOriginalBookletConfig(
    "Bklt_Config-44",
    "Cy-Bklt_BkltConfig-44"
  );
  assert.equal(await page.locator("#participantRouteFullscreenButton").count(), 0);

  await openOriginalBookletConfig(
    "Bklt_Config-45",
    "Cy-Bklt_BkltConfig-45"
  );
  await page.locator("#participantRouteFullscreenButton").waitFor();

  await openOriginalBookletConfig(
    "Bklt_Config-46",
    "Cy-Bklt_BkltConfig-46"
  );
  assert.equal(await page.locator("#participantRouteReloadButton").count(), 0);

  await openOriginalBookletConfig(
    "Bklt_Config-47",
    "Cy-Bklt_BkltConfig-47"
  );
  await page.locator("#participantRouteReloadButton").waitFor();

  await openOriginalBookletConfig(
    "Bklt_Config-48",
    "Cy-Bklt_BkltConfig-48"
  );
  await page.locator("#participantRouteTestletTimer").waitFor();
  assert.equal(
    await page.locator("#participantRouteTestletTimerValue").count(),
    0
  );

  await openOriginalBookletConfig(
    "Bklt_Config-49",
    "Cy-Bklt_BkltConfig-49"
  );
  await page.locator("#participantRouteTestletTimerValue").waitFor();

  await openOriginalBookletConfig(
    "Bklt_Config-50",
    "Cy-Bklt_BkltConfig-50"
  );
  await page.locator("#participantRouteTimerLifecycleEvent").waitFor();
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "xyz" })
    .waitFor({ timeout: 15_000 });
  await page
    .locator("#participantRouteTimerLifecycleMessage")
    .filter({ hasText: "ended" })
    .waitFor();

  await openOriginalBookletConfig(
    "Bklt_Config-51",
    "Cy-Bklt_BkltConfig-51"
  );
  assert.equal(
    await page.locator("#participantRouteTimerLifecycleEvent").count(),
    0
  );
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "xyz" })
    .waitFor({ timeout: 15_000 });
  assert.equal(
    await page.locator("#participantRouteTimerLifecycleEvent").count(),
    0
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
    const resumeResponse = await sendSmokeJson(
      `${baseUrl}/api/v1/participant/sessions/${participantSessionId}/resume`,
      { body: { bookletKey } }
    );
    const resumePayload = await resumeResponse.json();
    await page.goto(
      `${baseUrl}/participant?participantSessionId=${encodeURIComponent(
        participantSessionId
      )}`,
      { waitUntil: "domcontentloaded" }
    );
    await page
      .locator("#participantVeronaPlayerVersion")
      .filter({ hasText: "API 6.0" })
      .waitFor({ timeout: 30_000 });
    return {
      frame: page.frameLocator("#participantVeronaPlayerFrame"),
      participantSessionId,
      testRunId: resumePayload.testRun?.testRunId
    };
  };
  const completeOriginalControllerUnit = async frame => {
    await frame
      .locator('[data-cy="TestController-radio1-Aufg1"]')
      .check();
    await frame.locator("#next-page").click();
    await frame
      .getByText("Presentation complete", { exact: true })
      .waitFor({ timeout: 15_000 });
  };
  const waitForOriginalControllerCompletenessDenial = async (
    controller,
    direction
  ) =>
    pollJsonWithPredicate(
      `${baseUrl}/api/v1/participant/sessions/${controller.participantSessionId}/current-state`,
      payload => {
        const reasons =
          direction === "forward"
            ? payload?.currentRunState?.navigation?.forwardDeniedReasons
            : payload?.currentRunState?.navigation?.backwardDeniedReasons;
        return (
          reasons?.includes("presentation_incomplete") === true &&
          reasons.includes("response_incomplete")
        );
      }
    );
  const assertOriginalControllerCompletenessDenied = async (
    controller,
    targetUnitKey,
    direction
  ) => {
    await waitForOriginalControllerCompletenessDenial(controller, direction);
    const response = await fetch(
      `${baseUrl}/api/v1/participant/test-runs/${controller.testRunId}/save-progress`,
      {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentUnitKey: targetUnitKey, status: "running" })
      }
    );
    assert.equal(response.status, 409);
    const payload = await response.json();
    assert.equal(payload.error, "booklet_navigation_denied");
    assert.equal(payload.details?.direction, direction);
    assert.deepEqual(payload.details?.deniedReasons, [
      "presentation_incomplete",
      "response_incomplete"
    ]);
  };
  const runOriginalControllerCompletenessCase = async ({
    loginKey,
    bookletKey,
    secondUnitKey,
    policy
  }) => {
    const controller = await openOriginalTestController(loginKey, bookletKey);
    assert.ok(controller.testRunId);
    const frame = controller.frame;
    await frame
      .getByText(
        "Testung Controller: Aufgabe1: Check response complete and presentation complete",
        { exact: true }
      )
      .waitFor({ timeout: 15_000 });

    if (policy === "off") {
      await expectButtonSelectorEnabled("#participantRouteNextUnitButton");
    } else {
      await expectButtonSelectorDisabled("#participantRouteNextUnitButton");
      await assertOriginalControllerCompletenessDenied(
        controller,
        secondUnitKey,
        "forward"
      );
      await completeOriginalControllerUnit(frame);
      await expectButtonSelectorEnabled("#participantRouteNextUnitButton");
    }

    await page.locator("#participantRouteNextUnitButton").click();
    await page
      .locator("#participantRouteUnitKey")
      .filter({ hasText: secondUnitKey })
      .waitFor({ timeout: 15_000 });

    if (policy === "always") {
      await expectButtonSelectorDisabled("#participantRoutePreviousUnitButton");
      await assertOriginalControllerCompletenessDenied(
        controller,
        "CY-Unit.Sample-101",
        "backward"
      );
      await completeOriginalControllerUnit(frame);
    }
    await expectButtonSelectorEnabled("#participantRoutePreviousUnitButton");
    await page.locator("#participantRoutePreviousUnitButton").click();
    await page
      .locator("#participantRouteUnitKey")
      .filter({ hasText: "CY-Unit.Sample-101" })
      .waitFor({ timeout: 15_000 });
  };
  const enterOriginalControllerTimedTestlet = async ({
    loginKey,
    executionMode,
    forceTimeRestrictions,
    requiresCode
  }) => {
    const controller = await openOriginalTestController(
      loginKey,
      "Cy-Bklt_TC-5"
    );
    assert.ok(controller.testRunId);
    await page
      .locator("#participantRouteUnitKey")
      .filter({ hasText: "CY-Unit.Sample-100" })
      .waitFor();
    if (requiresCode) {
      await page
        .locator("#participantRouteTestletGateLabel")
        .filter({ hasText: "Aufgabenblock" })
        .waitFor();
      await page.locator("#participantRouteTestletUnlockCode").fill("hase");
      await page.locator("#participantRouteTestletUnlockButton").click();
    } else {
      assert.equal(
        await page.locator("#participantRouteTestletGateLabel").count(),
        0
      );
      await page.locator("#participantRouteNextUnitButton").click();
    }
    await page
      .locator("#participantRouteUnitKey")
      .filter({ hasText: "CY-Unit.Sample-101" })
      .waitFor({ timeout: 15_000 });
    await page.locator("#participantRouteTestletTimer").waitFor();
    await page
      .locator("#participantRouteTimerLifecycleMessage")
      .filter({ hasText: "started" })
      .waitFor();
    await pollJsonWithPredicate(
      `${baseUrl}/api/v1/participant/sessions/${controller.participantSessionId}/current-state`,
      payload =>
        payload?.currentRunState?.executionMode?.mode === executionMode &&
        payload.currentRunState.executionMode.forceTimeRestrictions ===
          forceTimeRestrictions &&
        payload.currentRunState.testRun?.testletTimers?.Tslt1?.status ===
          "running" &&
        payload.currentRunState.testRun.testletTimers.Tslt1.durationSeconds === 12
    );
    return controller;
  };

  const demoController = await openOriginalTestController(
    "Test_Ctrl-1",
    "Cy-Bklt_TC-1"
  );
  assert.ok(demoController.testRunId);
  await page
    .locator("#participantRouteExecutionMode")
    .filter({ hasText: "run-demo" })
    .waitFor();
  assert.equal(await page.locator("#participantRouteUnitRail").count(), 0);
  await page.locator("#participantRouteNextUnitButton").click();
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "CY-Unit.Sample-101" })
    .waitFor({ timeout: 15_000 });
  await page
    .locator("#participantRouteTimerLifecycleMessage")
    .filter({ hasText: "started" })
    .waitFor();
  await demoController.frame
    .locator('[data-cy="TestController-radio1-Aufg1"]')
    .check();
  await page.locator("#participantRouteNextUnitButton").click();
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "CY-Unit.Sample-102" })
    .waitFor({ timeout: 15_000 });
  await page.locator("#participantRoutePreviousUnitButton").click();
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "CY-Unit.Sample-101" })
    .waitFor({ timeout: 15_000 });
  await demoController.frame
    .locator('[data-cy="TestController-radio1-Aufg1"]')
    .waitFor({ timeout: 15_000 });
  assert.equal(
    await demoController.frame
      .locator('[data-cy="TestController-radio1-Aufg1"]')
      .isChecked(),
    true
  );
  const reopenedDemoController = await openOriginalTestController(
    "Test_Ctrl-1",
    "Cy-Bklt_TC-1"
  );
  assert.equal(
    reopenedDemoController.participantSessionId,
    demoController.participantSessionId
  );
  assert.equal(reopenedDemoController.testRunId, demoController.testRunId);
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "CY-Unit.Sample-100" })
    .waitFor();
  const resetDemoState = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${reopenedDemoController.participantSessionId}/current-state`,
    payload =>
      payload?.currentRunState?.testRun?.currentUnitKey ===
        "CY-Unit.Sample-100" &&
      Object.keys(payload.currentRunState.testRun.unitResponses ?? {}).length ===
        0 &&
      Object.keys(payload.currentRunState.testRun.testletTimers ?? {}).length === 0
  );
  assert.equal(resetDemoState.currentRunState.executionMode.saveResponses, false);
  await page.locator("#participantRouteNextUnitButton").click();
  await reopenedDemoController.frame
    .locator('[data-cy="TestController-radio1-Aufg1"]')
    .waitFor({ timeout: 15_000 });
  assert.equal(
    await reopenedDemoController.frame
      .locator('[data-cy="TestController-radio1-Aufg1"]')
      .isChecked(),
    false
  );

  const reviewController = await openOriginalTestController(
    "Test_Ctrl-2",
    "Cy-Bklt_TC-2"
  );
  assert.ok(reviewController.testRunId);
  await page
    .locator("#participantRouteExecutionMode")
    .filter({ hasText: "run-review" })
    .waitFor();
  await page.locator("#participantRouteUnitRail").waitFor();
  await page.locator("#participantRouteReviewPanel").waitFor();
  await page.locator("#participantRouteNextUnitButton").click();
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "CY-Unit.Sample-101" })
    .waitFor({ timeout: 15_000 });
  await page.locator("#participantRouteTestletTimerValue").waitFor();
  await reviewController.frame
    .locator('[data-cy="TestController-radio1-Aufg1"]')
    .check();
  await page.locator("#participantRouteReviewReviewer").fill("tobias");
  await page
    .locator("#participantRouteReviewPriority")
    .selectOption({ label: "Critical / urgent" });
  await page.locator("#participantRouteReviewCategory-tech").check();
  await page.locator("#participantRouteReviewTargetUnit").click();
  await page
    .locator("#participantRouteReviewComment")
    .fill("its a new comment");
  await page.locator("#participantRouteReviewSaveButton").click();
  await page
    .locator("#participantRouteReviewFeedback")
    .filter({ hasText: "Comment saved" })
    .waitFor({ timeout: 15_000 });
  const officialReviewPayload = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/test-runs/${reviewController.testRunId}/reviews`,
    payload =>
      Array.isArray(payload?.items) &&
      payload.items.some(
        item =>
          item?.reviewerId === "tobias" &&
          item?.unitKey === "CY-Unit.Sample-101" &&
          item?.priority === 1 &&
          item?.categories?.join(" ") === "tech" &&
          item?.comment === "its a new comment"
      )
  );
  const officialReviewId = officialReviewPayload.items.find(
    item => item?.comment === "its a new comment"
  )?.reviewId;
  assert.ok(officialReviewId);
  await page.locator("#participantRouteNextUnitButton").click();
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "CY-Unit.Sample-102" })
    .waitFor({ timeout: 15_000 });
  await page.locator("#participantRoutePreviousUnitButton").click();
  await reviewController.frame
    .locator('[data-cy="TestController-radio1-Aufg1"]')
    .waitFor({ timeout: 15_000 });
  assert.equal(
    await reviewController.frame
      .locator('[data-cy="TestController-radio1-Aufg1"]')
      .isChecked(),
    true
  );
  const reopenedReviewController = await openOriginalTestController(
    "Test_Ctrl-2",
    "Cy-Bklt_TC-2"
  );
  assert.equal(
    reopenedReviewController.participantSessionId,
    reviewController.participantSessionId
  );
  assert.equal(reopenedReviewController.testRunId, reviewController.testRunId);
  await page
    .locator(`.participant-review-item[data-review-id="${officialReviewId}"]`)
    .filter({ hasText: "its a new comment" })
    .waitFor({ timeout: 15_000 });
  const resetReviewState = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${reopenedReviewController.participantSessionId}/current-state`,
    payload =>
      payload?.currentRunState?.testRun?.currentUnitKey ===
        "CY-Unit.Sample-100" &&
      Object.keys(payload.currentRunState.testRun.unitResponses ?? {}).length ===
        0 &&
      Object.keys(payload.currentRunState.testRun.testletTimers ?? {}).length === 0
  );
  assert.equal(resetReviewState.currentRunState.executionMode.saveResponses, false);
  await page.locator("#participantRouteNextUnitButton").click();
  await reopenedReviewController.frame
    .locator('[data-cy="TestController-radio1-Aufg1"]')
    .waitFor({ timeout: 15_000 });
  assert.equal(
    await reopenedReviewController.frame
      .locator('[data-cy="TestController-radio1-Aufg1"]')
      .isChecked(),
    false
  );
  const officialReviewLogs = await (
    await sendSmokeJson(
      `${baseUrl}/api/v1/tenants/${testControllerTenantKey}/workspaces/${testControllerWorkspaceKey}/test-logs?testRunId=${encodeURIComponent(
        reviewController.testRunId
      )}`,
      { method: "GET" }
    )
  ).json();
  assert.deepEqual(officialReviewLogs.items, []);

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
  assert.ok(
    [undefined, ""].includes(
      bufferedControllerState.currentRunState.testRun.unitResponses[
        "CY-Unit.Sample-101"
      ]
    ),
    "The buffered controller response must not contain a persisted answer."
  );
  await page.locator("#participantRouteNextUnitButton").click();
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "CY-Unit.Sample-102" })
    .waitFor({ timeout: 15_000 });
  const flushedControllerState = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${protectedController.participantSessionId}/current-state`,
    payload => {
      const response =
        payload?.currentRunState?.testRun?.unitResponses?.[
          "CY-Unit.Sample-101"
        ];
      if (typeof response !== "string" || response.trim() === "") {
        return false;
      }
      try {
        return (
          Object.keys(JSON.parse(response).unitState?.dataParts ?? {}).length > 0
        );
      } catch {
        return false;
      }
    }
  );
  const flushedControllerResponse = JSON.parse(
    flushedControllerState.currentRunState.testRun.unitResponses[
      "CY-Unit.Sample-101"
    ]
  );
  assert.ok(
    Object.keys(flushedControllerResponse.unitState?.dataParts ?? {}).length > 0
  );

  const resumedProtectedController = await openOriginalTestController(
    "Test_Ctrl-3",
    "Cy-Bklt_TC-3"
  );
  assert.equal(
    resumedProtectedController.participantSessionId,
    protectedController.participantSessionId
  );
  assert.equal(
    resumedProtectedController.testRunId,
    protectedController.testRunId
  );
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "CY-Unit.Sample-102" })
    .waitFor({ timeout: 15_000 });
  await page.locator("#participantRoutePreviousUnitButton").click();
  await resumedProtectedController.frame
    .locator('[data-cy="TestController-radio1-Aufg1"]')
    .waitFor({ timeout: 15_000 });
  assert.equal(
    await resumedProtectedController.frame
      .locator('[data-cy="TestController-radio1-Aufg1"]')
      .isChecked(),
    true
  );

  const hotRestartController = await openOriginalTestController(
    "Test_Ctrl-7",
    "Cy-Bklt_TC-4"
  );
  assert.ok(hotRestartController.testRunId);
  await page
    .locator("#participantRouteExecutionMode")
    .filter({ hasText: "run-hot-restart" })
    .waitFor();
  await hotRestartController.frame
    .getByText("Testung Controller: Startseite", { exact: true })
    .waitFor({ timeout: 15_000 });
  await page
    .locator("#participantRouteTestletGateLabel")
    .filter({ hasText: "Aufgabenblock" })
    .waitFor();
  await page.locator("#participantRouteTestletUnlockCode").fill("hase");
  await page.locator("#participantRouteTestletUnlockButton").click();
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "CY-Unit.Sample-101" })
    .waitFor({ timeout: 15_000 });
  await hotRestartController.frame
    .locator('[data-cy="TestController-radio1-Aufg1"]')
    .check();
  await page.locator("#participantRouteNextUnitButton").click();
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "CY-Unit.Sample-102" })
    .waitFor({ timeout: 15_000 });
  const savedHotRestartState = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${hotRestartController.participantSessionId}/current-state`,
    payload => {
      const response =
        payload?.currentRunState?.testRun?.unitResponses?.[
          "CY-Unit.Sample-101"
        ];
      if (typeof response !== "string" || response.trim() === "") {
        return false;
      }
      try {
        return (
          Object.keys(JSON.parse(response).unitState?.dataParts ?? {}).length > 0
        );
      } catch {
        return false;
      }
    }
  );
  assert.equal(
    savedHotRestartState.currentRunState.testRun.currentUnitKey,
    "CY-Unit.Sample-102"
  );
  const restartedController = await openOriginalTestController(
    "Test_Ctrl-7",
    "Cy-Bklt_TC-4"
  );
  assert.notEqual(
    restartedController.participantSessionId,
    hotRestartController.participantSessionId
  );
  assert.notEqual(restartedController.testRunId, hotRestartController.testRunId);
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "CY-Unit.Sample-100" })
    .waitFor({ timeout: 15_000 });
  const cleanHotRestartState = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${restartedController.participantSessionId}/current-state`,
    payload =>
      payload?.currentRunState?.testRun?.currentUnitKey ===
        "CY-Unit.Sample-100" &&
      Object.keys(payload.currentRunState.testRun.unitResponses ?? {}).length ===
        0 &&
      Object.keys(payload.currentRunState.testRun.testletTimers ?? {}).length === 0
  );
  assert.equal(
    cleanHotRestartState.currentRunState.executionMode.alwaysNewSession,
    true
  );
  const retainedHotRestartState = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${hotRestartController.participantSessionId}/current-state`,
    payload =>
      payload?.currentRunState?.testRun?.testRunId ===
        hotRestartController.testRunId &&
      typeof payload.currentRunState.testRun.unitResponses?.[
        "CY-Unit.Sample-101"
      ] === "string"
  );
  assert.equal(
    retainedHotRestartState.currentRunState.testRun.currentUnitKey,
    "CY-Unit.Sample-102"
  );
  const retainedHotRestartCsvResponse = await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${testControllerTenantKey}/workspaces/${testControllerWorkspaceKey}/exports/responses.csv?testRunId=${encodeURIComponent(
      hotRestartController.testRunId
    )}&unitKey=${encodeURIComponent("CY-Unit.Sample-101")}&limit=1`,
    { method: "GET" }
  );
  const retainedHotRestartCsv = await retainedHotRestartCsvResponse.text();
  assert.match(retainedHotRestartCsv, /Test_Ctrl-7/);
  assert.match(retainedHotRestartCsv, /"hot-restart"/);
  assert.match(retainedHotRestartCsv, /CY-Unit\.Sample-101/);
  assert.match(retainedHotRestartCsv, /radio1/);

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
  const aliasedStartPlayerFrame = await page
    .locator("#participantVeronaPlayerFrame")
    .elementHandle();
  assert.ok(
    aliasedStartPlayerFrame,
    "The aliased Test Controller start unit should have a mounted player frame."
  );
  await page.locator("#participantRouteNextUnitButton").click();
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "CY-Unit.Sample-101" })
    .waitFor({ timeout: 15_000 });
  await page.waitForFunction(
    frame => !frame.isConnected,
    aliasedStartPlayerFrame,
    { timeout: 15_000 }
  );
  await completionControllerFrame
    .getByText("Testung Controller: Aufgabe1: Check response complete and presentation complete", {
      exact: true
    })
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

  await runOriginalControllerCompletenessCase({
    loginKey: "Test_Ctrl-18",
    bookletKey: "Cy-Bklt_TC-9",
    secondUnitKey: "unit2",
    policy: "off"
  });
  await runOriginalControllerCompletenessCase({
    loginKey: "Test_Ctrl-19",
    bookletKey: "Cy-Bklt_TC-10",
    secondUnitKey: "unit2",
    policy: "forward"
  });
  await runOriginalControllerCompletenessCase({
    loginKey: "Test_Ctrl-20",
    bookletKey: "Cy-Bklt_TC-11",
    secondUnitKey: "unit2",
    policy: "always"
  });
  await runOriginalControllerCompletenessCase({
    loginKey: "Test_Ctrl-24",
    bookletKey: "Cy-Bklt_TC-15",
    secondUnitKey: "CY-Unit.Sample-102",
    policy: "off"
  });
  await runOriginalControllerCompletenessCase({
    loginKey: "Test_Ctrl-25",
    bookletKey: "Cy-Bklt_TC-16",
    secondUnitKey: "CY-Unit.Sample-102",
    policy: "forward"
  });
  await runOriginalControllerCompletenessCase({
    loginKey: "Test_Ctrl-26",
    bookletKey: "Cy-Bklt_TC-17",
    secondUnitKey: "unit2",
    policy: "always"
  });

  const hotReturnTimedController =
    await enterOriginalControllerTimedTestlet({
      loginKey: "Test_Ctrl-10",
      executionMode: "run-hot-return",
      forceTimeRestrictions: true,
      requiresCode: true
    });
  await page
    .locator(
      '#participantRouteUnitRail [data-unit-key="CY-Unit.Sample-104"]'
    )
    .click();
  await page
    .locator("#participantConfirmationTitle")
    .filter({ hasText: "Leave timed block?" })
    .waitFor();
  const hotReturnDialogStateBeforeResponse = await sendSmokeJson(
    `${baseUrl}/api/v1/participant/sessions/${hotReturnTimedController.participantSessionId}/current-state`,
    { method: "GET" }
  );
  assert.equal(hotReturnDialogStateBeforeResponse.status, 200);
  const hotReturnDialogStateBefore =
    await hotReturnDialogStateBeforeResponse.json();
  const hotReturnDialogRemainingBefore =
    hotReturnDialogStateBefore.currentRunState?.activeTestletTimer
      ?.remainingSeconds;
  assert.ok(
    Number.isInteger(hotReturnDialogRemainingBefore) &&
      hotReturnDialogRemainingBefore > 3
  );
  await new Promise(resolve => setTimeout(resolve, 2_500));
  const hotReturnDialogStateAfterResponse = await sendSmokeJson(
    `${baseUrl}/api/v1/participant/sessions/${hotReturnTimedController.participantSessionId}/current-state`,
    { method: "GET" }
  );
  assert.equal(hotReturnDialogStateAfterResponse.status, 200);
  const hotReturnDialogStateAfter = await hotReturnDialogStateAfterResponse.json();
  const hotReturnDialogRemainingAfter =
    hotReturnDialogStateAfter.currentRunState?.activeTestletTimer
      ?.remainingSeconds;
  assert.equal(
    hotReturnDialogStateAfter.currentRunState?.testRun?.currentUnitKey,
    "CY-Unit.Sample-101"
  );
  assert.equal(
    hotReturnDialogStateAfter.currentRunState?.testRun?.testletTimers?.Tslt1
      ?.status,
    "running"
  );
  assert.ok(
    Number.isInteger(hotReturnDialogRemainingAfter) &&
      hotReturnDialogRemainingAfter <= hotReturnDialogRemainingBefore - 2,
    `Expected the TC-5 timer to continue while the leave dialog was open, received ${hotReturnDialogRemainingBefore} then ${hotReturnDialogRemainingAfter}.`
  );
  await page.locator("#participantConfirmationStayButton").click();
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "CY-Unit.Sample-101" })
    .waitFor();
  const hotReturnExpiryController =
    await enterOriginalControllerTimedTestlet({
      loginKey: "Test_Ctrl-11",
      executionMode: "run-hot-return",
      forceTimeRestrictions: true,
      requiresCode: true
    });
  const hotRestartTimedController =
    await enterOriginalControllerTimedTestlet({
      loginKey: "Test_Ctrl-12",
      executionMode: "run-hot-restart",
      forceTimeRestrictions: true,
      requiresCode: true
    });
  const demoTimedController = await enterOriginalControllerTimedTestlet({
    loginKey: "Test_Ctrl-13",
    executionMode: "run-demo",
    forceTimeRestrictions: false,
    requiresCode: false
  });
  const reviewTimedController = await enterOriginalControllerTimedTestlet({
    loginKey: "Test_Ctrl-14",
    executionMode: "run-review",
    forceTimeRestrictions: false,
    requiresCode: false
  });
  await page
    .locator("#participantRouteTimerLifecycleMessage")
    .filter({ hasText: "ended" })
    .waitFor({ timeout: 20_000 });
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "CY-Unit.Sample-101" })
    .waitFor();
  assert.equal(await page.locator("#participantRouteTestletTimer").count(), 0);
  const reviewExpiredState = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${reviewTimedController.participantSessionId}/current-state`,
    payload =>
      payload?.currentRunState?.testRun?.currentUnitKey ===
        "CY-Unit.Sample-101" &&
      payload.currentRunState.testRun.testletTimers?.Tslt1?.status === "expired"
  );
  assert.equal(
    reviewExpiredState.currentRunState.executionMode.forceTimeRestrictions,
    false
  );
  for (const controller of [
    hotReturnTimedController,
    hotReturnExpiryController,
    hotRestartTimedController
  ]) {
    await pollJsonWithPredicate(
      `${baseUrl}/api/v1/participant/sessions/${controller.participantSessionId}/current-state`,
      payload =>
        payload?.currentRunState?.testRun?.currentUnitKey ===
          "CY-Unit.Sample-104" &&
        payload.currentRunState.testRun.testletTimers?.Tslt1?.status === "expired"
    );
  }
  const demoExpiredState = await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${demoTimedController.participantSessionId}/current-state`,
    payload =>
      payload?.currentRunState?.testRun?.currentUnitKey ===
        "CY-Unit.Sample-101" &&
      payload.currentRunState.testRun.testletTimers?.Tslt1?.status === "expired"
  );
  assert.equal(
    demoExpiredState.currentRunState.executionMode.forceTimeRestrictions,
    false
  );
  await expectButtonSelectorEnabled("#participantRoutePreviousUnitButton");
  await page.locator("#participantRoutePreviousUnitButton").click();
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "CY-Unit.Sample-100" })
    .waitFor({ timeout: 15_000 });
  await page.locator("#participantRouteNextUnitButton").click();
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "CY-Unit.Sample-101" })
    .waitFor({ timeout: 15_000 });
  const demoExpiredNavigationResponse = await fetch(
    `${baseUrl}/api/v1/participant/test-runs/${demoTimedController.testRunId}/save-progress`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        currentUnitKey: "CY-Unit.Sample-104",
        status: "running"
      })
    }
  );
  assert.equal(demoExpiredNavigationResponse.status, 200);
  const demoExpiredNavigationPayload =
    await demoExpiredNavigationResponse.json();
  assert.equal(
    demoExpiredNavigationPayload.testRun?.currentUnitKey,
    "CY-Unit.Sample-104"
  );
  assert.equal(
    demoExpiredNavigationPayload.testRun?.testletTimers?.Tslt1?.status,
    "expired"
  );

  const confirmLeaveController = await openOriginalTestController(
    "Test_Ctrl-15",
    "Cy-Bklt_TC-6"
  );
  assert.ok(confirmLeaveController.testRunId);
  await page.locator("#participantRouteTestletTimer").waitFor();
  await page.locator("#participantRouteNextUnitButton").click();
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "CY-Unit.Sample-102" })
    .waitFor({ timeout: 15_000 });
  const confirmLeaveTarget = page.locator("#participantRouteNextUnitButton");
  await confirmLeaveTarget.click();
  await page
    .locator("#participantConfirmationTitle")
    .filter({ hasText: "Leave timed block?" })
    .waitFor();
  await page.locator("#participantConfirmationStayButton").click();
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "CY-Unit.Sample-102" })
    .waitFor();
  await confirmLeaveTarget.click();
  await page.locator("#participantConfirmationContinueButton").click();
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "CY-Unit.Sample-104" })
    .waitFor({ timeout: 15_000 });
  await page
    .locator("#participantRouteTimerLifecycleMessage")
    .filter({ hasText: "cancelled" })
    .waitFor();
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${confirmLeaveController.participantSessionId}/current-state`,
    payload =>
      payload?.currentRunState?.testRun?.testletTimers?.Tslt1?.status ===
        "cancelled" &&
      payload.currentRunState.activeTestletTimer == null
  );
  await expectButtonSelectorDisabled("#participantRoutePreviousUnitButton");

  const allowedLeaveController = await openOriginalTestController(
    "Test_Ctrl-16",
    "Cy-Bklt_TC-7"
  );
  assert.ok(allowedLeaveController.testRunId);
  await page.locator("#participantRouteTestletTimer").waitFor();
  await page.locator("#participantRouteNextUnitButton").click();
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "CY-Unit.Sample-102" })
    .waitFor({ timeout: 15_000 });
  await page.locator("#participantRouteNextUnitButton").click();
  assert.equal(await page.locator("#participantConfirmationBackdrop").count(), 0);
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "CY-Unit.Sample-104" })
    .waitFor({ timeout: 15_000 });
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${allowedLeaveController.participantSessionId}/current-state`,
    payload =>
      payload?.currentRunState?.testRun?.testletTimers?.Tslt1?.status ===
        "cancelled" &&
      payload.currentRunState.activeTestletTimer == null
  );
  await expectButtonSelectorDisabled("#participantRoutePreviousUnitButton");

  const forbiddenLeaveController = await openOriginalTestController(
    "Test_Ctrl-17",
    "Cy-Bklt_TC-8"
  );
  assert.ok(forbiddenLeaveController.testRunId);
  await page.locator("#participantRouteTestletTimer").waitFor();
  await page.locator("#participantRouteNextUnitButton").click();
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "CY-Unit.Sample-102" })
    .waitFor({ timeout: 15_000 });
  await page
    .locator("#participantRouteNavigationNotice")
    .filter({ hasText: "cannot be left before its time expires" })
    .waitFor();
  await expectButtonSelectorDisabled("#participantRouteNextUnitButton");
  const forbiddenLeaveResponse = await fetch(
    `${baseUrl}/api/v1/participant/test-runs/${forbiddenLeaveController.testRunId}/save-progress`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        currentUnitKey: "CY-Unit.Sample-104",
        status: "running"
      })
    }
  );
  assert.equal(forbiddenLeaveResponse.status, 409);
  const forbiddenLeavePayload = await forbiddenLeaveResponse.json();
  assert.equal(forbiddenLeavePayload.error, "booklet_navigation_denied");
  assert.ok(
    forbiddenLeavePayload.details?.deniedReasons?.includes(
      "testlet_time_leave_forbidden"
    )
  );
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "CY-Unit.Sample-102" })
    .waitFor();

  const confirmedUnitLockController = await openOriginalTestController(
    "Test_Ctrl-21",
    "Cy-Bklt_TC-12"
  );
  assert.ok(confirmedUnitLockController.testRunId);
  await page
    .locator("#participantRouteLeaveLockLabel")
    .filter({ hasText: "Aufgabe1" })
    .waitFor();
  const confirmedUnitLockTarget = page.locator(
    "#participantRouteNextUnitButton"
  );
  await confirmedUnitLockTarget.click();
  await page
    .locator("#participantConfirmationTitle")
    .filter({ hasText: "Leave task?" })
    .waitFor();
  await page.locator("#participantConfirmationStayButton").click();
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "CY-Unit.Sample-101" })
    .waitFor();
  await confirmedUnitLockTarget.click();
  await page.locator("#participantConfirmationContinueButton").click();
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "CY-Unit.Sample-102" })
    .waitFor({ timeout: 15_000 });
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${confirmedUnitLockController.participantSessionId}/current-state`,
    payload =>
      payload?.currentRunState?.testRun?.lockedUnitKeys?.includes(
        "CY-Unit.Sample-101"
      ) === true
  );
  await expectButtonSelectorDisabled("#participantRoutePreviousUnitButton");
  const lockedUnitReentryResponse = await fetch(
    `${baseUrl}/api/v1/participant/test-runs/${confirmedUnitLockController.testRunId}/save-progress`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        currentUnitKey: "CY-Unit.Sample-101",
        status: "running"
      })
    }
  );
  assert.equal(lockedUnitReentryResponse.status, 409);
  const lockedUnitReentryPayload = await lockedUnitReentryResponse.json();
  assert.equal(lockedUnitReentryPayload.error, "booklet_navigation_denied");
  assert.ok(
    lockedUnitReentryPayload.details?.deniedReasons?.includes(
      "testlet_leave_locked"
    )
  );

  const automaticTestletLockController = await openOriginalTestController(
    "Test_Ctrl-22",
    "Cy-Bklt_TC-13"
  );
  assert.ok(automaticTestletLockController.testRunId);
  await page
    .locator("#participantRouteLeaveLockLabel")
    .filter({ hasText: "Aufgabenblock" })
    .waitFor();
  await page.locator("#participantRouteNextUnitButton").click();
  assert.equal(await page.locator("#participantConfirmationBackdrop").count(), 0);
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "CY-Unit.Sample-102" })
    .waitFor({ timeout: 15_000 });
  const withinTestletLockState = await (
    await sendSmokeJson(
      `${baseUrl}/api/v1/participant/sessions/${automaticTestletLockController.participantSessionId}/current-state`,
      { method: "GET" }
    )
  ).json();
  assert.deepEqual(
    withinTestletLockState.currentRunState?.testRun?.lockedTestletKeys,
    []
  );
  await page.locator("#participantRouteNextUnitButton").click();
  assert.equal(await page.locator("#participantConfirmationBackdrop").count(), 0);
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "CY-Unit.Sample-104" })
    .waitFor({ timeout: 15_000 });
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${automaticTestletLockController.participantSessionId}/current-state`,
    payload =>
      payload?.currentRunState?.testRun?.lockedTestletKeys?.includes("Tslt1") ===
      true
  );
  await expectButtonSelectorDisabled("#participantRoutePreviousUnitButton");
  const lockedTestletReentryResponse = await fetch(
    `${baseUrl}/api/v1/participant/test-runs/${automaticTestletLockController.testRunId}/save-progress`,
    {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        currentUnitKey: "CY-Unit.Sample-102",
        status: "running"
      })
    }
  );
  assert.equal(lockedTestletReentryResponse.status, 409);
  const lockedTestletReentryPayload = await lockedTestletReentryResponse.json();
  assert.equal(lockedTestletReentryPayload.error, "booklet_navigation_denied");
  assert.ok(
    lockedTestletReentryPayload.details?.deniedReasons?.includes(
      "testlet_leave_locked"
    )
  );
  stopAfter("participant-original-test-controller");

  await restorePlatformAdminSession();
  logStep("nav-runtime");
  await page.goto(`${baseUrl}/app/runtime`, { waitUntil: "domcontentloaded" });
  await page.waitForURL(/\/app\/runtime$/);
  await waitForRouteTarget("#loginKey");
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
  const groupMonitorFinalPassword = "ui-migrated-group-monitor-final-secret";
  const systemCheckUsername = "entry-system-check";
  const systemCheckPassword = "ui-migrated-system-check-secret";
  const systemCheckFinalPassword = "ui-migrated-system-check-final-secret";
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
      "  <CustomTexts>",
      "    <CustomText key=\"gm_headline\">UI Scoped Monitor</CustomText>",
      "    <CustomText key=\"gm_controls\">UI Test Controls</CustomText>",
      "    <CustomText key=\"gm_control_pause\">UI Hold</CustomText>",
      "    <CustomText key=\"gm_control_resume\">UI Continue</CustomText>",
      "    <CustomText key=\"gm_control_goto\">UI Jump</CustomText>",
      "    <CustomText key=\"gm_control_unlock\">UI Release</CustomText>",
      "    <CustomText key=\"gm_control_finish_everything\">UI Finish All</CustomText>",
      "    <CustomText key=\"gm_col_groupName\">UI Cohort</CustomText>",
      "    <CustomText key=\"gm_col_bookletLabel\">UI Test Booklet</CustomText>",
      "    <CustomText key=\"gm_col_blockLabel\">UI Section</CustomText>",
      "    <CustomText key=\"gm_col_unitLabel\">UI Task</CustomText>",
      "    <CustomText key=\"gm_col_personLabel\">UI Candidate</CustomText>",
      "    <CustomText key=\"gm_col_state\">UI Activity</CustomText>",
      "    <CustomText key=\"gm_settings_tooltip\">UI Layout</CustomText>",
      "    <CustomText key=\"gm_view_small\">UI Compact</CustomText>",
      "    <CustomText key=\"gm_menu_filter\">UI Hidden Sessions</CustomText>",
      "    <CustomText key=\"gm_filter_type_substring\">UI Contains</CustomText>",
      "    <CustomText key=\"gm_filter_not\">UI Excluding</CustomText>",
      "    <CustomText key=\"gm_selection_info\">UI%s %s run%s / %s booklet%s selected</CustomText>",
      "    <CustomText key=\"gm_selection_info_none\">UI No Runs Selected</CustomText>",
      "    <CustomText key=\"gm_control_goto_tooltip\">UI Pick a Section</CustomText>",
      "    <CustomText key=\"gm_control_unlock_tooltip\">UI Authorize Test</CustomText>",
      "    <CustomText key=\"gm_control_unlock_success_warning\">UI Restart Clients After Release</CustomText>",
      "    <CustomText key=\"gm_codetoenter_unlock_tooltip\">UI Section Opened</CustomText>",
      "    <CustomText key=\"gm_filter_pending\">UI Pending Sessions</CustomText>",
      "    <CustomText key=\"gm_filter_locked\">UI Locked Sessions</CustomText>",
      "    <CustomText key=\"gm_selection_text\">UI Start Monitoring</CustomText>",
      "    <CustomText key=\"gm_show_monitor\">UI Groups In Scope</CustomText>",
      "    <CustomText key=\"gm_show_test\">UI Open Monitor Tests</CustomText>",
      "    <CustomText key=\"gm_menu_cols\">UI Columns</CustomText>",
      "    <CustomText key=\"gm_menu_cols_states\">UI States</CustomText>",
      "    <CustomText key=\"gm_scroll_down\">UI Bottom</CustomText>",
      "    <CustomText key=\"gm_hide_controls_tooltip\">UI Hide Controls</CustomText>",
      "    <CustomText key=\"gm_auto_checkall\">UI Control All</CustomText>",
      "    <CustomText key=\"gm_timeleft_tooltip\">UI %s/%s minutes left</CustomText>",
      "    <CustomText key=\"gm_timeup_tooltip\">UI Timer Closed</CustomText>",
      "    <CustomText key=\"gm_timemax_tooltip\">UI Timer %s minutes</CustomText>",
      "    <CustomText key=\"gm_control_goto_unlock_blocks_confirm_headline\">UI Reopen Timed Section</CustomText>",
      "    <CustomText key=\"gm_control_goto_unlock_blocks_confirm_text\">UI Restore time before jumping.</CustomText>",
      "    <CustomText key=\"gm_booklet_error_missing_id\">UI No Booklet Assigned</CustomText>",
      "    <CustomText key=\"gm_booklet_error_missing_file\">UI Missing Booklet File</CustomText>",
      "    <CustomText key=\"gm_booklet_error_xml\">UI Broken Booklet XML</CustomText>",
      "    <CustomText key=\"gm_booklet_error_general\">UI Booklet Access Error</CustomText>",
      "  </CustomTexts>",
      "  <Profiles><GroupMonitor>",
      "    <Profile id=\"all\" label=\"All sessions\" view=\"small\" blockColumn=\"hide\" unitColumn=\"hide\" groupColumn=\"show\" bookletColumn=\"hide\" autoselectNextBlock=\"yes\">",
      "      <Filter label=\"Current participant\" type=\"substring\" field=\"personLabel\" value=\"student-ui\" not=\"true\" />",
      "    </Profile>",
      "    <Profile id=\"booklet-errors\" label=\"Booklet diagnostics\" view=\"full\" blockColumn=\"show\" unitColumn=\"show\" groupColumn=\"show\" bookletColumn=\"show\" />",
      "  </GroupMonitor></Profiles>",
      `  <Group id="${participantGroupKey}" validFor="45">`,
      "    <Login name=\"entry-student-login\">",
      `      <Booklet>${participantRouteBookletKey}</Booklet>`,
      "    </Login>",
      `    <Login mode="monitor-group" name="${groupMonitorUsername}" pw="operator-secret">`,
      "      <Profile id=\"all\" />",
      "      <Profile id=\"booklet-errors\" />",
      "      <ViewSettings monitorBookletVisibility=\"collapsed\" />",
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
    "all: Current participant not substring student-ui",
    "Booklet diagnostics (booklet-errors)",
    "collapsed",
    "43 imported override(s)"
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
  await waitForRouteTarget("#adminCreateUsername", async () => {
    const signInButton = page.locator("#adminSignInButton");
    const signedOut = await signInButton
      .waitFor({ state: "visible", timeout: 15_000 })
      .then(() => true)
      .catch(() => false);
    if (!signedOut) {
      return;
    }
    await fillAndCommitUntilValue("#adminUsername", adminUsername);
    await fillAndCommitUntilValue("#adminPassword", adminPassword);
    await clickAction("Sign In");
    await waitForInputMinLength("#adminSessionToken", 20);
    smokeAdminSessionToken = await page.locator("#adminSessionToken").inputValue();
  });
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
  await expectInputValue(
    "#adminCreateMonitorBookletVisibility",
    "collapsed"
  );
  await expectInputValue("#adminCreatePassword", "");
  await page.getByText("2 imported monitor profile(s)").waitFor();
  await page.getByText("43 login-specific custom text(s)").waitFor();
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
  await signOutAdmin();
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
    ["all", "booklet-errors"]
  );
  assert.equal(
    initialGroupMonitorSignIn.roleAssignments[0]?.monitorBookletVisibility,
    "collapsed"
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
  await page.locator("#requiredAdminPasswordChangeDialog").waitFor();
  await fillAndCommit(
    "#requiredAdminPassword",
    groupMonitorFinalPassword
  );
  await fillAndCommit(
    "#requiredAdminPasswordConfirmation",
    groupMonitorFinalPassword
  );
  await expectButtonSelectorEnabled("#requiredAdminPasswordSubmitButton");
  const groupMonitorPasswordChangeResponsePromise = page.waitForResponse(
    response =>
      response.request().method() === "POST" &&
      response.url().endsWith("/api/v1/admin/auth/password")
  );
  await page.locator("#requiredAdminPasswordSubmitButton").click();
  assert.equal((await groupMonitorPasswordChangeResponsePromise).status(), 200);
  await page
    .locator("#requiredAdminPasswordChangeDialog")
    .waitFor({ state: "detached" });
  await expectInputValue("#adminSessionToken", "");
  await fillAndCommit("#adminUsername", groupMonitorUsername);
  await fillAndCommit("#adminPassword", groupMonitorFinalPassword);
  await clickAction("Sign In");
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
    .filter({
      hasText:
        "All sessions: small view, 1 imported filter(s), next-block selection automatic."
    })
    .waitFor();
  await page.locator('[data-view-nav="ops"]').click();
  await page.waitForURL(/\/app\/ops$/);
  await signOutAdmin();
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
  const protectedSystemCheckId = "SYS-CHECK-PROTECTED";
  const protectedSystemCheckSourceResponse = await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages`,
    {
      body: {
        fileName: "ProtectedSysCheck.xml",
        mediaType: "application/xml",
        sourceDocument: [
          '<?xml version="1.0" encoding="utf-8"?>',
          '<SysCheck xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://raw.githubusercontent.com/iqb-berlin/testcenter/17.6.0/definitions/vo_SysCheck.xsd">',
          "  <Metadata>",
          `    <Id>${protectedSystemCheckId}</Id>`,
          "    <Label>Protected Account System Check</Label>",
          "  </Metadata>",
          '  <Config savekey="not-disclosed" skipnetwork="true">',
          '    <Q id="device" type="string" prompt="Assigned device" required="true"/>',
          "  </Config>",
          "</SysCheck>"
        ].join("\n")
      }
    }
  );
  const protectedSystemCheckSource = await protectedSystemCheckSourceResponse.json();
  const protectedSystemCheckSourcePackageId =
    protectedSystemCheckSource.sourcePackage?.sourcePackageId;
  assert.ok(
    protectedSystemCheckSourcePackageId,
    "Protected system-check smoke expected a source package id."
  );
  const protectedSystemCheckImportResponse = await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/import-jobs`,
    { body: { sourcePackageId: protectedSystemCheckSourcePackageId } }
  );
  const protectedSystemCheckImport = await protectedSystemCheckImportResponse.json();
  assert.equal(protectedSystemCheckImport.importJob?.status, "completed");
  await page.goto(`${baseUrl}/app/home`, { waitUntil: "domcontentloaded" });
  await page.locator("#startProtectedSystemCheck").waitFor();
  assert.equal(
    await page.locator("#startSystemCheck").count(),
    0,
    "A configured system-check account must remove the anonymous System Check entry."
  );
  await page.locator("#startProtectedSystemCheck").click();
  await page.waitForURL(/\/app\/system-check$/);
  await page.locator("#systemCheckLoginRequiredStatus").waitFor();
  assert.equal(await page.locator("#loadSystemChecksButton").count(), 0);
  await fillAndCommit("#systemCheckUsername", systemCheckUsername);
  await fillAndCommit("#systemCheckPassword", systemCheckPassword);
  await page.locator("#systemCheckSignInButton").click();
  await page
    .locator("#systemCheckSignedInUser")
    .filter({ hasText: systemCheckUsername })
    .waitFor();
  await page.locator("#requiredAdminPasswordChangeDialog").waitFor();
  await fillAndCommit("#requiredAdminPassword", systemCheckFinalPassword);
  await fillAndCommit(
    "#requiredAdminPasswordConfirmation",
    systemCheckFinalPassword
  );
  await expectButtonSelectorEnabled("#requiredAdminPasswordSubmitButton");
  const systemCheckPasswordChangeResponsePromise = page.waitForResponse(
    response =>
      response.request().method() === "POST" &&
      response.url().endsWith("/api/v1/admin/auth/password")
  );
  await page.locator("#requiredAdminPasswordSubmitButton").click();
  assert.equal((await systemCheckPasswordChangeResponsePromise).status(), 200);
  await page
    .locator("#requiredAdminPasswordChangeDialog")
    .waitFor({ state: "detached" });
  await page.locator("#systemCheckSignInButton").waitFor();
  await fillAndCommit("#systemCheckUsername", systemCheckUsername);
  await fillAndCommit("#systemCheckPassword", systemCheckFinalPassword);
  await page.locator("#systemCheckSignInButton").click();
  await page
    .locator("#systemCheckSignedInUser")
    .filter({ hasText: systemCheckUsername })
    .waitFor();
  await page
    .locator("#systemCheckIntroText")
    .filter({ hasText: "This check verifies whether the current device is ready" })
    .waitFor();
  await page
    .locator(".system-check-facts")
    .filter({ hasText: "Authorized by system-check login" })
    .waitFor();
  const advanceProtectedSystemCheck = async (expectedHeading, expectedStep) => {
    const stepStatus = page.locator("#systemCheckStepStatus");
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const previousStatus = (await stepStatus.innerText()).trim();
      await page.locator("#systemCheckNextButton").click();
      try {
        await page
          .getByRole("heading", { name: expectedHeading, exact: true })
          .waitFor({ timeout: 5_000 });
        await stepStatus.filter({ hasText: expectedStep }).waitFor();
        return;
      } catch (error) {
        const currentStatus = (await stepStatus.innerText()).trim();
        if (currentStatus !== previousStatus || attempt === 2) {
          throw error;
        }
      }
    }
  };
  await page
    .locator("#systemCheckStepStatus")
    .filter({ hasText: "1 / 4" })
    .waitFor();
  await advanceProtectedSystemCheck("Environment", "2 / 4");
  await advanceProtectedSystemCheck("Questionnaire", "3 / 4");
  await page.locator("#systemCheckNextButton").click();
  await page
    .locator(".validation-message")
    .filter({ hasText: "Please complete all required questions." })
    .waitFor();
  await fillAndCommit("#systemCheckQuestion-device", "Protected UI device");
  await advanceProtectedSystemCheck("Report", "4 / 4");
  await page
    .locator("article.card")
    .filter({ has: page.getByRole("heading", { name: "Report", exact: true }) })
    .filter({ hasText: `The report will be saved as ${systemCheckUsername}.` })
    .waitFor();
  assert.equal(await page.locator("#systemCheckReportTitle").count(), 0);
  assert.equal(await page.locator("#systemCheckReportKey").count(), 0);
  const protectedSystemCheckSaveResponsePromise = page.waitForResponse(
    response =>
      response.request().method() === "POST" &&
      response.url().includes(
        `/system-checks/${encodeURIComponent(protectedSystemCheckId)}/reports`
      )
  );
  await page.locator("#saveSystemCheckReportButton").click();
  const protectedSystemCheckSaveResponse =
    await protectedSystemCheckSaveResponsePromise;
  assert.equal(protectedSystemCheckSaveResponse.status(), 201);
  const protectedSystemCheckSavePayload =
    await protectedSystemCheckSaveResponse.json();
  assert.equal(
    protectedSystemCheckSavePayload.report?.title,
    systemCheckUsername,
    "A dedicated system-check session must force the saved report title to its login name."
  );
  await page.locator("#systemCheckSavedReportStatus").waitFor();
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
  let directLaunchStatusError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await directLaunchStatusCard.waitFor({ timeout: 10_000 });
      directLaunchStatusError = null;
      break;
    } catch (error) {
      directLaunchStatusError = error;
      if (attempt < 3) {
        await clickAction("Refresh Sessions");
      }
    }
  }
  if (directLaunchStatusError) {
    throw directLaunchStatusError;
  }
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
  let participantSessionId = participantSessionsPayload.items.find(item => {
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
  let pausedTestRunId = pausedCurrentState.currentRunState.testRun.testRunId;
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
  logStep("participant-monitor-live-sync");
  const liveParticipantPage = await context.newPage();
  await liveParticipantPage.goto(
    `${baseUrl}/participant?participantSessionId=${encodeURIComponent(participantSessionId)}`,
    { waitUntil: "domcontentloaded" }
  );
  await liveParticipantPage
    .locator("#participantRouteStatus", { hasText: "paused" })
    .waitFor({ timeout: 15_000 });
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
  await liveParticipantPage
    .locator("#participantRouteStatus", { hasText: "running" })
    .waitFor({ timeout: 15_000 });
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
        ?.textContent?.trim() === "none",
    undefined,
    { timeout: 15_000 }
  );
  await liveParticipantPage
    .locator("#participantRouteStatus", { hasText: "paused" })
    .waitFor({ timeout: 15_000 });
  await liveParticipantPage.close();
  stopAfter("participant-monitor-live-sync");
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
  logStep("monitor-resume-after-time-setting");
  await clickAction("Monitor Resume");
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
    .filter({ hasText: "species: 2" })
    .filter({ hasText: "Active Timer" })
    .filter({ hasText: "Timer Remaining" })
    .filter({ hasText: "Timer Expires" })
    .waitFor();
  assert.match(
    await openRunStudentCard.innerText(),
    /Timer Remaining\s+Verbleibende Zeit: \d+(?:[.,]\d+)? von \d+ Minute\(n\)/i
  );
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
  const bulkPauseDialog = acceptAppConfirmation(
    /Issue monitor command\?/,
    /pause.*1 selected run/i
  );
  const bulkPauseResponsePromise = page.waitForResponse(
    response =>
      response.url().endsWith("/monitor/open-runs/commands") &&
      response.request().method() === "POST"
  );
  await page.locator("#monitorBatchPauseButton").click();
  await bulkPauseDialog;
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
  const bulkLockDialog = acceptAppConfirmation(
    /Issue monitor command\?/,
    /lock_test.*1 selected run/i
  );
  const bulkLockResponsePromise = page.waitForResponse(
    response =>
      response.url().endsWith("/monitor/open-runs/commands") &&
      response.request().method() === "POST"
  );
  await page.locator("#monitorBatchLockTestButton").click();
  await bulkLockDialog;
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
  const bulkUnlockDialog = acceptAppConfirmation(
    /Issue monitor command\?/,
    /unlock_test.*1 selected run/i
  );
  const bulkUnlockResponsePromise = page.waitForResponse(
    response =>
      response.url().endsWith("/monitor/open-runs/commands") &&
      response.request().method() === "POST"
  );
  await page.locator("#monitorBatchUnlockTestButton").click();
  await bulkUnlockDialog;
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
  const bulkResumeDialog = acceptAppConfirmation(
    /Issue monitor command\?/,
    /resume.*1 selected run/i
  );
  const bulkResumeResponsePromise = page.waitForResponse(
    response =>
      response.url().endsWith("/monitor/open-runs/commands") &&
      response.request().method() === "POST"
  );
  await page.locator("#monitorBatchResumeButton").click();
  await bulkResumeDialog;
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
  await signOutAdmin();
  await fillAndCommit("#adminUsername", groupMonitorUsername);
  await fillAndCommit("#adminPassword", groupMonitorFinalPassword);
  const groupMonitorSignInResponsePromise = page.waitForResponse(
    response =>
      response.request().method() === "POST" &&
      response.url().endsWith("/api/v1/admin/auth/sign-in")
  );
  await clickAction("Sign In");
  const groupMonitorSignInResponse = await groupMonitorSignInResponsePromise;
  assert.equal(groupMonitorSignInResponse.status(), 200);
  const groupMonitorSignIn = await groupMonitorSignInResponse.json();
  const groupMonitorSessionToken = groupMonitorSignIn.sessionToken;
  assert.ok(groupMonitorSessionToken);
  assert.equal(groupMonitorSignIn.adminUser.validForMinutes, 45);
  assert.ok(groupMonitorSignIn.adminUser.firstSignedInAt);
  assert.equal(groupMonitorSignIn.adminUser.customTexts.gm_headline, "UI Scoped Monitor");
  assert.equal(groupMonitorSignIn.adminUser.customTexts.gm_control_pause, "UI Hold");
  assert.equal(
    groupMonitorSignIn.roleAssignments[0]?.monitorBookletVisibility,
    "collapsed"
  );
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
  await page.locator("#monitorCustomHeadline", { hasText: "UI Scoped Monitor" }).waitFor();
  await page.locator("#monitorConsolePauseButton", { hasText: "UI Hold" }).waitFor();
  await page.locator("#monitorConsoleResumeButton", { hasText: "UI Continue" }).waitFor();
  await page.locator("#monitorConsoleGotoButton", { hasText: "UI Jump" }).waitFor();
  await page.locator("#monitorConsoleUnlockTestButton", { hasText: "UI Release" }).waitFor();
  await page.locator("#monitorConsoleCompleteButton", { hasText: "UI Finish All" }).waitFor();
  await page.locator("#monitorScrollDownButton", { hasText: "UI Bottom" }).waitFor();
  await page.locator("#monitorToggleControlsButton", { hasText: "UI Hide Controls" }).waitFor();
  assert.equal(
    await page.locator("#monitorToggleBookletListButton").getAttribute("aria-expanded"),
    "false"
  );
  assert.equal(
    await page.getByRole("heading", { name: "Active Test Booklets" }).count(),
    0,
    "Collapsed monitor booklet visibility must keep the start-menu list closed."
  );
  await page
    .locator("#monitorColumnPresentation")
    .filter({ hasText: "UI Columns" })
    .filter({ hasText: "UI States" })
    .waitFor();
  await page.locator("#monitorToggleControlsButton").click();
  await page.locator("#monitorTenantKey").waitFor({ state: "hidden" });
  await page.locator("#monitorToggleControlsButton", { hasText: "UI Test Controls" }).click();
  await page.locator("#monitorTenantKey").waitFor({ state: "visible" });
  await selectAndCommit("#monitorTargetUnitKey", "");
  assert.equal(
    await page.locator("#monitorConsoleGotoButton").getAttribute("title"),
    "UI Pick a Section"
  );
  assert.equal(
    await page.locator("#monitorConsoleUnlockTestButton").getAttribute("title"),
    "UI Authorize Test"
  );
  assert.equal(
    (await page.locator("#monitorProfile option:checked").textContent())?.trim(),
    "All sessions"
  );
  await page
    .locator("#monitorProfileDetail")
    .filter({
      hasText:
        "All sessions: small view, 1 imported filter(s), next-block selection automatic."
    })
    .waitFor();
  await page
    .locator("#monitorProfilePresentation")
    .filter({ hasText: "UI Layout: UI Compact" })
    .filter({ hasText: "UI Hidden Sessions" })
    .filter({ hasText: "UI Pending Sessions: —" })
    .filter({ hasText: "UI Locked Sessions: —" })
    .filter({ hasText: "Current participant — UI Candidate UI Contains UI Excluding student-ui" })
    .waitFor();
  assert.equal(
    await page.locator("#monitorPendingFilterButton").getAttribute("aria-pressed"),
    "false"
  );
  assert.equal(
    await page.locator("#monitorLockedFilterButton").getAttribute("aria-pressed"),
    "false"
  );
  const importedMonitorFilterButton = page.locator(
    '.monitor-profile-filter[data-filter-index="0"]'
  );
  assert.equal(
    await importedMonitorFilterButton.getAttribute("aria-pressed"),
    "true",
    "Imported profile filters must start enabled like the Original monitor menu."
  );
  await importedMonitorFilterButton.click();
  await page
    .locator("#monitorProfilePresentation")
    .filter({ hasText: "Current participant — UI Candidate UI Contains UI Excluding student-ui: —" })
    .waitFor();
  await page.locator("#monitorResetRuntimeFiltersButton").click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('.monitor-profile-filter[data-filter-index="0"]')
        ?.getAttribute("aria-pressed") === "true"
  );
  assert.equal(
    await importedMonitorFilterButton.getAttribute("aria-pressed"),
    "true",
    "Reset must restore the imported profile filter baseline."
  );
  await page
    .locator("#monitorApplyScopeButton", { hasText: "UI Start Monitoring" })
    .waitFor();
  await page
    .locator("#openRunFiltersHeadline")
    .filter({ hasText: "UI Hidden Sessions" })
    .waitFor();
  await page
    .locator("#monitorBatchSelectionStatus")
    .filter({ hasText: "UI No Runs Selected" })
    .waitFor();
  assert.equal(
    await page.locator("#loginKey").count(),
    0,
    "Group monitor runtime must not render participant-management controls."
  );
  await fillAndCommit("#monitorTenantKey", tenantKey);
  await fillAndCommit("#monitorWorkspaceKey", workspaceKey);
  const monitorOpenRunsRoute = new RegExp(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/monitor/open-runs(?:\\?.*)?$`
  );
  const applyMonitorScopeAndWaitForOpenRuns = async step => {
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const responsePromise = page
        .waitForResponse(
          response =>
            response.request().method() === "GET" &&
            monitorOpenRunsRoute.test(response.url()),
          { timeout: 5_000 }
        )
        .catch(() => null);
      await page.locator("#monitorApplyScopeButton").click();
      const response = await responsePromise;
      if (response) {
        assert.equal(response.status(), 200);
        await waitForNotBusy(step);
        return;
      }
      await waitForNotBusy(`${step}-retry-${attempt + 1}`);
    }
    throw new Error(`${step} did not request the scoped monitor runs.`);
  };
  await clickAction("Clear Open Run Filters");
  await applyMonitorScopeAndWaitForOpenRuns("group-monitor-initial-scope");
  const scopedOpenRuns = page
    .locator("app-record-collection")
    .filter({ has: page.getByRole("heading", { name: "UI Open Monitor Tests" }) });
  await scopedOpenRuns
    .filter({ hasText: participantLoginKey })
    .filter({ hasText: participantGroupKey })
    .waitFor();
  logStep("group-monitor-custom-filters");
  assert.equal(
    await page.locator("#monitorSaveCustomFilterButton").isDisabled(),
    true,
    "A custom monitor filter must require a value before it can be saved."
  );
  await selectAndCommit("#monitorCustomFilterTarget", "groupName");
  await selectAndCommit("#monitorCustomFilterType", "equal");
  await page.locator("#monitorCustomFilterValue").fill(participantGroupKey);
  await page.locator("#monitorCustomFilterLabel").fill("Hide selected cohort");
  await page.locator("#monitorSaveCustomFilterButton").click();
  await scopedOpenRuns.getByText("No open runs are currently loaded.").waitFor();
  const customMonitorFilter = page.locator(".monitor-custom-filter").first();
  await customMonitorFilter.filter({ hasText: "Hide selected cohort" }).waitFor();
  assert.equal(
    await customMonitorFilter.getAttribute("aria-pressed"),
    "true",
    "A newly authored Original-style filter must start enabled."
  );
  await customMonitorFilter.click();
  await scopedOpenRuns.filter({ hasText: participantLoginKey }).waitFor();
  assert.equal(await customMonitorFilter.getAttribute("aria-pressed"), "false");
  await page.locator(".monitor-custom-filter-edit").first().click();
  await expectInputValue("#monitorCustomFilterTarget", "groupName");
  await expectInputValue("#monitorCustomFilterValue", participantGroupKey);
  await page.locator("#monitorCustomFilterValue").fill("group:outside-scope");
  await page
    .locator("#monitorSaveCustomFilterButton", { hasText: "Filter aktualisieren" })
    .click();
  await scopedOpenRuns.filter({ hasText: participantLoginKey }).waitFor();
  await page.waitForFunction(
    () =>
      document
        .querySelector(".monitor-custom-filter")
        ?.getAttribute("aria-pressed") === "true"
  );
  assert.equal(
    await customMonitorFilter.getAttribute("aria-pressed"),
    "true",
    "Editing a custom filter must reactivate its updated predicate."
  );
  await page.locator(".monitor-custom-filter-remove").first().click();
  await page.locator(".monitor-custom-filter").waitFor({ state: "detached" });
  assert.equal(await page.locator(".monitor-custom-filter").count(), 0);
  await scopedOpenRuns.filter({ hasText: participantLoginKey }).waitFor();
  stopAfter("group-monitor-custom-filters");

  logStep("group-monitor-finish-all");
  await fillAndCommit("#openRunLoginFilter", "hidden-by-finish-all-smoke");
  await page.locator("#monitorApplyScopeButton").click();
  await waitForNotBusy("group-monitor-finish-all-filter");
  const finishAllCommandRoute = new RegExp(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/monitor/open-runs/commands$`
  );
  let finishAllRequestBody;
  await page.route(finishAllCommandRoute, async route => {
    finishAllRequestBody = route.request().postDataJSON();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        requestedCount: 0,
        succeededCount: 0,
        failedCount: 0,
        commands: [],
        failures: []
      })
    });
  });
  const finishAllDialog = acceptAppConfirmation(
    /Testdurchführung Beenden/,
    /sämtliche Tests dieser Sitzung/
  );
  await page.locator("#monitorConsoleCompleteButton").click();
  await finishAllDialog;
  await waitForNotBusy("group-monitor-finish-all-command");
  assert.deepEqual(finishAllRequestBody, {
    scope: "all_unlocked_open_runs",
    commandType: "complete_and_lock",
    actorId: "operator-ui"
  });
  await expectInputValue("#openRunLoginFilter", "");
  assert.equal(
    await importedMonitorFilterButton.getAttribute("aria-pressed"),
    "false",
    "Finishing the monitor session must clear imported runtime filters like the Original monitor."
  );
  await page
    .locator("#monitorCommandNotice")
    .filter({ hasText: "0 Tests beendet und gesperrt." })
    .waitFor();
  await page.unroute(finishAllCommandRoute);
  stopAfter("group-monitor-finish-all");
  await page.locator("#monitorResetRuntimeFiltersButton").click();
  await page.waitForFunction(
    () =>
      document
        .querySelector('.monitor-profile-filter[data-filter-index="0"]')
        ?.getAttribute("aria-pressed") === "true"
  );

  await page.locator("#monitorToggleBookletListButton").click();
  await page
    .locator("app-record-collection")
    .filter({ has: page.getByRole("heading", { name: "Active Test Booklets" }) })
    .filter({ hasText: participantBookletKey })
    .filter({ hasText: "1 active run" })
    .waitFor();
  logStep("group-monitor-auto-select-all");
  assert.equal(
    await page.locator("#monitorAutoSelectAllButton").getAttribute("aria-pressed"),
    "false"
  );
  await expectButtonSelectorEnabled("#monitorAutoSelectAllButton");
  await page.locator("#monitorAutoSelectAllButton").click();
  await page
    .locator("#monitorBatchSelectionStatus")
    .filter({ hasText: "UI Alle 1 run / 1 booklet selected" })
    .waitFor();
  assert.equal(
    await scopedOpenRuns.getByRole("button", { name: "Add to Batch" }).count(),
    0,
    "Automatic selection must replace per-run manual selection controls."
  );
  assert.equal(
    await page.locator("#invertVisibleMonitorRunSelectionButton").isDisabled(),
    true,
    "Automatic selection must keep manual inversion inactive."
  );
  await page.locator("#monitorAutoSelectAllButton").click();
  await page
    .locator("#monitorBatchSelectionStatus")
    .filter({ hasText: "UI No Runs Selected" })
    .waitFor();
  await scopedOpenRuns
    .getByRole("button", { name: "Add to Batch" })
    .first()
    .click();
  await page
    .locator("#monitorBatchSelectionStatus")
    .filter({ hasText: "UI Alle 1 run / 1 booklet selected" })
    .waitFor();
  await page.locator("#invertVisibleMonitorRunSelectionButton").click();
  await page
    .locator("#monitorBatchSelectionStatus")
    .filter({ hasText: "UI No Runs Selected" })
    .waitFor();
  await page.locator("#invertVisibleMonitorRunSelectionButton").click();
  await page
    .locator("#monitorBatchSelectionStatus")
    .filter({ hasText: "UI Alle 1 run / 1 booklet selected" })
    .waitFor();
  await page.locator("#clearMonitorBatchSelectionButton").click();
  await page
    .locator("#monitorBatchSelectionStatus")
    .filter({ hasText: "UI No Runs Selected" })
    .waitFor();
  await scopedOpenRuns
    .getByRole("button", { name: "Add to Batch" })
    .first()
    .click();
  await page.locator("#monitorPendingFilterButton").click();
  await page
    .locator("#monitorBatchSelectionStatus")
    .filter({ hasText: "UI No Runs Selected" })
    .waitFor();
  await page.locator("#monitorPendingFilterButton").click();
  assert.equal(
    await scopedOpenRuns.locator(".record-collection-grid").getAttribute("data-density"),
    "small",
    "Imported small monitor profile must apply the compact card layout."
  );
  await page.locator("#monitorQuickFilter").fill("not-this-participant");
  await scopedOpenRuns.getByText("No open runs are currently loaded.").waitFor();
  assert.equal(
    await page.locator("#monitorClearQuickFilterButton").isEnabled(),
    true,
    "The Original-style quick filter must expose an explicit clear action."
  );
  await page.locator("#monitorClearQuickFilterButton").click();
  await scopedOpenRuns.filter({ hasText: participantLoginKey }).waitFor();
  await page.locator("#monitorQuickFilter").fill("STUDENT-UI");
  await scopedOpenRuns.filter({ hasText: participantLoginKey }).waitFor();
  await page.locator("#monitorClearQuickFilterButton").click();
  await expectInputValue("#monitorSortKey", "participant");
  assert.equal(
    await page.locator("#monitorSortDirectionButton").getAttribute("data-direction"),
    "asc",
    "The monitor list must start with the Original participant-ascending sort."
  );
  await page.locator("#monitorSortDirectionButton").click();
  await page.waitForFunction(
    () =>
      document
        .querySelector("#monitorSortDirectionButton")
        ?.getAttribute("data-direction") === "desc"
  );
  await page.locator("#monitorResetSortButton").click();
  await page.waitForFunction(
    () =>
      document.querySelector("#monitorSortKey")?.value === "participant" &&
      document
        .querySelector("#monitorSortDirectionButton")
        ?.getAttribute("data-direction") === "asc"
  );
  assert.equal(
    await page.locator("#monitorToggleGroupColumnButton").getAttribute("aria-pressed"),
    "true"
  );
  assert.equal(
    await page.locator("#monitorToggleBookletColumnButton").getAttribute("aria-pressed"),
    "false"
  );
  await page.locator("#monitorToggleGroupColumnButton").click();
  await page.locator("#monitorToggleBookletColumnButton").click();
  await page.locator("#monitorToggleBlockColumnButton").click();
  await page.locator("#monitorToggleUnitColumnButton").click();
  await page.locator("#monitorDisplayFullButton").click();
  await page.waitForFunction(
    () =>
      document
        .querySelector("#monitorDisplayFullButton")
        ?.getAttribute("aria-pressed") === "true" &&
      document
        .querySelector("#openMonitorRunsCollection .record-collection-grid")
        ?.getAttribute("data-density") === "full"
  );
  assert.equal(
    await scopedOpenRuns.locator(".record-collection-grid").getAttribute("data-density"),
    "full",
    "The Original-style activity menu must override the imported profile density."
  );
  for (const visibleColumn of [
    "Session",
    "Run",
    "UI Test Booklet",
    "UI Section",
    "UI Task"
  ]) {
    assert.equal(
      await scopedOpenRuns.getByText(visibleColumn, { exact: true }).count(),
      1,
      `The runtime display controls must show the ${visibleColumn} column.`
    );
  }
  assert.equal(
    await scopedOpenRuns.getByText("UI Cohort", { exact: true }).count(),
    0,
    "The runtime display controls must hide the group column."
  );
  await page.locator("#monitorResetDisplayOptionsButton").click();
  await page.waitForFunction(
    () =>
      document
        .querySelector("#monitorDisplaySmallButton")
        ?.getAttribute("aria-pressed") === "true" &&
      document
        .querySelector("#openMonitorRunsCollection .record-collection-grid")
        ?.getAttribute("data-density") === "small"
  );
  assert.equal(
    await scopedOpenRuns.locator(".record-collection-grid").getAttribute("data-density"),
    "small",
    "Reset must restore the imported profile density."
  );
  assert.equal(
    await scopedOpenRuns.getByText("UI Cohort", { exact: true }).count(),
    1,
    "Reset must restore imported profile columns."
  );
  for (const hiddenColumn of [
    "Session",
    "Run",
    "UI Test Booklet",
    "UI Section",
    "UI Task"
  ]) {
    assert.equal(
      await scopedOpenRuns.getByText(hiddenColumn, { exact: true }).count(),
      0,
      `Reset must hide the profile-disabled ${hiddenColumn} column.`
    );
  }
  const monitorOverview = page.locator("#monitorOverviewCard");
  await monitorOverview
    .locator(".summary-card")
    .filter({ hasText: "Visible Runs" })
    .getByRole("heading", { name: "1", exact: true })
    .waitFor();
  await monitorOverview
    .locator(".summary-card")
    .filter({ hasText: "UI Candidate" })
    .getByRole("heading", { name: "1", exact: true })
    .waitFor();
  await monitorOverview
    .locator(".summary-card")
    .filter({ hasText: "Running" })
    .getByRole("heading", { name: "1", exact: true })
    .waitFor();
  await monitorOverview
    .locator(".summary-card")
    .filter({ hasText: "Paused" })
    .getByRole("heading", { name: "0", exact: true })
    .waitFor();
  await page
    .locator("#monitorOverviewDetail")
    .filter({
      hasText:
        "1 open run after server scope, request filters, and the active imported profile."
    })
    .waitFor();
  const scopedGroups = page
    .locator("app-record-collection")
    .filter({ has: page.getByRole("heading", { name: "UI Groups In Scope" }) });
  await scopedGroups
    .filter({ hasText: participantGroupKey })
    .filter({ hasText: "1 participant · 1 visible run" })
    .filter({ hasText: "1 running" })
    .waitFor();
  assert.equal(
    await scopedGroups.filter({ hasText: "group:entry-smoke" }).count(),
    0,
    "Group monitor overview must not aggregate groups outside its server scope."
  );
  await scopedGroups.getByRole("button", { name: "Show Group Runs" }).click();
  await waitForNotBusy("group-monitor-overview-filter");
  await expectInputValue("#openRunGroupFilter", participantGroupKey);
  assert.equal(
    await scopedOpenRuns.getByText("UI Cohort", { exact: true }).count(),
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
  await page.locator("#monitorConsoleLockTestButton").click();
  await waitForNotBusy("group-monitor-runtime-locked-filter-lock");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${participantSessionId}/current-state`,
    payload => payload?.currentRunState?.testRun?.locked === true
  );
  await applyMonitorScopeAndWaitForOpenRuns(
    "group-monitor-runtime-locked-filter-refresh"
  );
  await scopedOpenRuns
    .filter({ hasText: participantLoginKey })
    .filter({ hasText: "test locked" })
    .waitFor();
  assert.equal(
    await page.locator("#monitorLockedFilterButton").getAttribute("aria-pressed"),
    "false",
    "The runtime locked filter must start inactive."
  );
  await page.locator("#monitorLockedFilterButton").click();
  await page.waitForFunction(
    () =>
      document
        .querySelector("#monitorLockedFilterButton")
        ?.getAttribute("aria-pressed") === "true"
  );
  await scopedOpenRuns.getByText("No open runs are currently loaded.").waitFor();
  assert.equal(
    await page.locator("#monitorLockedFilterButton").getAttribute("aria-pressed"),
    "true",
    "The runtime locked filter must hide locked runs."
  );
  await page.locator("#monitorLockedFilterButton").click();
  await scopedOpenRuns.filter({ hasText: participantLoginKey }).waitFor();
  await page.locator("#monitorConsoleUnlockTestButton").click();
  await waitForNotBusy("group-monitor-runtime-locked-filter-unlock");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${participantSessionId}/current-state`,
    payload => payload?.currentRunState?.testRun?.locked === false
  );
  await page.locator("#monitorConsoleUnlockButton").click();
  await waitForNotBusy("group-monitor-unlock-navigation");
  await page
    .locator("#monitorCommandNotice", { hasText: "UI Section Opened" })
    .waitFor();
  await page.locator("#monitorConsoleUnlockTestButton").click();
  await waitForNotBusy("group-monitor-unlock-test");
  await page
    .locator("#monitorCommandNotice.warning", {
      hasText: "UI Restart Clients After Release"
    })
    .waitFor();
  await page.locator("#monitorConsolePauseButton").click();
  await waitForNotBusy("group-monitor-pause");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${participantSessionId}/current-state`,
    payload => payload?.currentRunState?.testRun?.status === "paused"
  );
  await monitorOverview
    .locator(".summary-card")
    .filter({ hasText: "Paused" })
    .getByRole("heading", { name: "1", exact: true })
    .waitFor();
  const pausedMonitorRunCard = scopedOpenRuns
    .locator(".record-card")
    .filter({ hasText: participantLoginKey })
    .first();
  await page.waitForFunction(
    loginKey =>
      [...document.querySelectorAll(".record-card")].some(
        card =>
          card.textContent?.includes(loginKey) &&
          card.getAttribute("data-presentation-state") === "paused"
    ),
    participantLoginKey
  );
  await page.waitForFunction(
    ([loginKey, expectedBackground]) =>
      [...document.querySelectorAll(".record-card")].some(
        card =>
          card.textContent?.includes(loginKey) &&
          card.getAttribute("data-presentation-state") === "paused" &&
          getComputedStyle(card).backgroundColor === expectedBackground
      ),
    [participantLoginKey, "rgb(230, 230, 230)"],
    { timeout: 15_000 }
  );
  assert.equal(
    await pausedMonitorRunCard.getAttribute("data-presentation-state"),
    "paused",
    "The monitor run card must expose the Original paused presentation state."
  );
  assert.equal(
    await pausedMonitorRunCard.evaluate(
      element => getComputedStyle(element).backgroundColor
    ),
    "rgb(230, 230, 230)",
    "The monitor run card must render the Original neutral paused surface."
  );
  await page.locator("#monitorConsoleResumeButton").click();
  await waitForNotBusy("group-monitor-resume");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${participantSessionId}/current-state`,
    payload => payload?.currentRunState?.testRun?.status === "running"
  );
  await monitorOverview
    .locator(".summary-card")
    .filter({ hasText: "Running" })
    .getByRole("heading", { name: "1", exact: true })
    .waitFor();
  await expectButtonSelectorEnabled("#monitorConsoleResumeButton");
  assert.equal(
    await page.locator("#monitorTargetUnitKey option").count(),
    3,
    "The scoped monitor should offer a placeholder and both visible booklet blocks."
  );
  await selectAndCommit("#monitorTargetUnitKey", "unit-participant-route");
  const firstBlockGotoResponsePromise = page.waitForResponse(
    response =>
      response.request().method() === "POST" &&
      response.url().endsWith(
        `/monitor/open-runs/${pausedTestRunId}/commands`
      )
  );
  await page.locator("#monitorConsoleGotoButton").click();
  assert.equal((await firstBlockGotoResponsePromise).status(), 200);
  await waitForNotBusy("group-monitor-first-goto");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${participantSessionId}/current-state`,
    payload =>
      payload?.currentRunState?.testRun?.currentUnitKey ===
      "unit-participant-route"
  );
  await page.locator("#monitorApplyScopeButton").click();
  await waitForNotBusy("group-monitor-reload-scope");
  await expectInputValue("#openRunUnitFilter", "");
  await expectInputValue("#monitorTargetUnitKey", "unit-paused");
  await page
    .locator("#monitorTargetTimerStatus")
    .filter({ hasText: "UI Timer Closed" })
    .waitFor();
  await fillAndCommit("#monitorConsoleTimeSeconds", "120");
  const acceptTimedGotoRestoration = acceptAppConfirmation(
    /UI Reopen Timed Section/,
    /UI Restore time before jumping\.[\s\S]*UI Timer 2 minutes/
  );
  const nextBlockGotoResponsePromise = page.waitForResponse(
    response =>
      response.request().method() === "POST" &&
      response.url().endsWith(
        `/monitor/open-runs/${pausedTestRunId}/commands`
      )
  );
  await page.locator("#monitorConsoleGotoButton").click();
  await acceptTimedGotoRestoration;
  const nextBlockGotoResponse = await nextBlockGotoResponsePromise;
  await waitForNotBusy("group-monitor-timed-goto");
  assert.equal(nextBlockGotoResponse.status(), 200);
  assert.equal(
    nextBlockGotoResponse.request().postDataJSON().remainingSeconds,
    120,
    "The confirmed monitor jump must restore the closed timer atomically."
  );
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/participant/sessions/${participantSessionId}/current-state`,
    payload => {
      const timer =
        payload?.currentRunState?.testRun?.testletTimers?.[
          "testlet:timed-paused"
        ];
      return (
        payload?.currentRunState?.testRun?.currentUnitKey === "unit-paused" &&
        timer?.status === "running" &&
        timer?.durationSeconds === 120 &&
        timer?.remainingSeconds <= 120 &&
        timer?.remainingSeconds > 0
      );
    }
  );
  await expectInputValue("#monitorTargetUnitKey", "");
  await monitorOverview
    .locator(".summary-card")
    .filter({ hasText: "Running" })
    .getByRole("heading", { name: "1", exact: true })
    .waitFor();
  await monitorOverview
    .locator(".summary-card")
    .filter({ hasText: "Paused" })
    .getByRole("heading", { name: "0", exact: true })
    .waitFor();
  const monitorSpeciesRoute = new RegExp(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/monitor/open-runs(?:\\?.*)?$`
  );
  const monitorSpeciesRouteOperations = new Set();
  let speciesReferenceTarget;
  let speciesVariantTargetUnitKey;
  await page.route(monitorSpeciesRoute, route => {
    const operation = (async () => {
      const response = await route.fetch();
      const payload = await response.json();
      const template = payload.items?.[0];
      assert.ok(template, "Species highlighting needs one real scoped run.");
      speciesReferenceTarget ??=
        template.blockNavigationTargets?.find(target => !target.timer) ??
        template.blockNavigationTargets?.[0];
      assert.ok(
        speciesReferenceTarget,
        "Species cohort navigation needs one visible block target."
      );
      speciesVariantTargetUnitKey ??=
        `${speciesReferenceTarget.targetUnitKey}-species-variant`;
      await route.fulfill({
        response,
        json: {
          ...payload,
          items: [
            {
              ...template,
              testRunId: `${template.testRunId}:species-beta-one`,
              participantSessionId: `${template.participantSessionId}:species-beta-one`,
              loginKey: `${template.loginKey}-species-beta-one`,
              participantRosterEntry: null,
              bookletSpecies: "beta"
            },
            {
              ...template,
              testRunId: `${template.testRunId}:species-beta-two`,
              participantSessionId: `${template.participantSessionId}:species-beta-two`,
              loginKey: `${template.loginKey}-species-beta-two`,
              participantRosterEntry: null,
              bookletSpecies: "beta",
              blockNavigationTargets: template.blockNavigationTargets.map(
                target =>
                  target.blockKey === speciesReferenceTarget.blockKey
                    ? {
                        ...target,
                        targetUnitKey: speciesVariantTargetUnitKey,
                        unitKeys: [speciesVariantTargetUnitKey]
                      }
                    : target
              )
            },
            {
              ...template,
              testRunId: `${template.testRunId}:species-two`,
              participantSessionId: `${template.participantSessionId}:species-two`,
              loginKey: `${template.loginKey}-species-two`,
              participantRosterEntry: null,
              bookletSpecies: "two"
            }
          ]
        }
      });
    })();
    monitorSpeciesRouteOperations.add(operation);
    void operation.then(
      () => monitorSpeciesRouteOperations.delete(operation),
      () => monitorSpeciesRouteOperations.delete(operation)
    );
    return operation;
  });
  await page.locator("#monitorApplyScopeButton").click();
  await waitForNotBusy("group-monitor-species-highlighting");
  const speciesMonitorRunCards = scopedOpenRuns.locator(
    ".record-card.is-species-highlighted"
  );
  await speciesMonitorRunCards.first().waitFor();
  assert.equal(
    await speciesMonitorRunCards.count(),
    3,
    "Every run must be species-highlighted when multiple Booklet species are visible."
  );
  const speciesBackgrounds = await speciesMonitorRunCards.evaluateAll(cards =>
    cards.map(card => getComputedStyle(card).backgroundColor)
  );
  assert.equal(
    new Set(speciesBackgrounds).size,
    2,
    "Different visible Booklet species must receive deterministic distinct surfaces."
  );
  await page.locator("#monitorDisplayFullButton").click();
  await page.waitForFunction(
    () =>
      document
        .querySelector("#openMonitorRunsCollection .record-collection-grid")
        ?.getAttribute("data-density") === "full"
  );
  const betaOneMonitorRunCard = speciesMonitorRunCards.filter({
    hasText: `${participantLoginKey}-species-beta-one`
  });
  const betaOneBlockTargetButton = betaOneMonitorRunCard
    .getByRole("button", {
      name: `Select ${speciesReferenceTarget.blockLabel} for monitor jump`
    })
    .first();
  await betaOneBlockTargetButton.hover();
  assert.equal(
    await speciesMonitorRunCards
      .filter({ hasText: `${participantLoginKey}-species-beta` })
      .locator('[data-target-marked="true"]')
      .count(),
    2,
    "Hovering a block target must preview the matching target across its visible species cohort."
  );
  assert.equal(
    await speciesMonitorRunCards
      .filter({ hasText: `${participantLoginKey}-species-two` })
      .locator('[data-target-marked="true"]')
      .count(),
    0,
    "Block previews must not cross Booklet-species boundaries."
  );
  await page.locator("#monitorSortControlsHeading").hover();
  assert.equal(
    await speciesMonitorRunCards.locator('[data-target-marked="true"]').count(),
    0,
    "Leaving a block target must clear the cohort preview."
  );
  await betaOneBlockTargetButton.focus();
  assert.equal(
    await speciesMonitorRunCards
      .filter({ hasText: `${participantLoginKey}-species-beta` })
      .locator('[data-target-marked="true"]')
      .count(),
    2,
    "Keyboard focus must expose the same cohort preview as pointer hover."
  );
  await page.locator("#monitorSortKey").focus();
  assert.equal(
    await speciesMonitorRunCards.locator('[data-target-marked="true"]').count(),
    0,
    "Moving keyboard focus away must clear the cohort preview."
  );
  await betaOneBlockTargetButton.click();
  await page
    .locator("#monitorBatchSelectionStatus")
    .filter({ hasText: "1 run" })
    .waitFor();
  await expectInputValue(
    "#monitorTargetUnitKey",
    speciesReferenceTarget.targetUnitKey
  );
  assert.equal(
    await betaOneBlockTargetButton.getAttribute("aria-pressed"),
    "true",
    "The first block activation must visibly select the origin run target."
  );
  await betaOneBlockTargetButton.click();
  await page
    .locator("#monitorBatchSelectionStatus")
    .filter({ hasText: "2 run" })
    .filter({ hasText: "1 booklet" })
    .waitFor();
  const pressedBetaBlockTarget = page.getByRole("button", {
    name: `Select ${speciesReferenceTarget.blockLabel} for monitor jump`,
    pressed: true
  });
  const betaSpeciesSelectedRunCards = speciesMonitorRunCards
    .filter({ hasText: `${participantLoginKey}-species-beta` })
    .filter({ has: pressedBetaBlockTarget });
  assert.equal(
    await betaSpeciesSelectedRunCards.count(),
    2,
    "The second block activation must mark the matching target across the selected species cohort."
  );
  await betaOneBlockTargetButton.click();
  await page
    .locator("#monitorBatchSelectionStatus")
    .filter({ hasText: "UI No Runs Selected" })
    .waitFor();
  assert.equal(
    await speciesMonitorRunCards
      .getByRole("button", {
        name: `Select ${speciesReferenceTarget.blockLabel} for monitor jump`,
        pressed: true
      })
      .count(),
    0,
    "The third block activation must clear every selected target marker."
  );
  await page.locator("#monitorResetDisplayOptionsButton").click();
  await betaOneMonitorRunCard
    .getByRole("button", { name: "Select Species Cohort" })
    .click();
  await page
    .locator("#monitorBatchSelectionStatus")
    .filter({ hasText: "2 run" })
    .filter({ hasText: "1 booklet" })
    .waitFor();
  const selectedSpeciesRunIds = await page
    .locator("article.card")
    .filter({
      has: page.getByRole("heading", { name: "Monitor Batch Command Preview" })
    })
    .locator("li code")
    .allTextContents();
  assert.deepEqual(
    new Set(selectedSpeciesRunIds),
    new Set([
      `${pausedTestRunId}:species-beta-one`,
      `${pausedTestRunId}:species-beta-two`
    ]),
    "Species-cohort selection must replace the batch with every visible run of the chosen species."
  );
  await selectAndCommit("#monitorSortKey", "selection");
  const speciesLoginOrder = [
    `${participantLoginKey}-species-beta-one`,
    `${participantLoginKey}-species-beta-two`,
    `${participantLoginKey}-species-two`
  ];
  const sortedSpeciesLogins = async () =>
    speciesMonitorRunCards.evaluateAll((cards, loginKeys) =>
      cards.map(card =>
        loginKeys.find(loginKey => card.textContent?.includes(loginKey))
      ),
      speciesLoginOrder
    );
  assert.deepEqual(
    await sortedSpeciesLogins(),
    speciesLoginOrder,
    "Ascending Original-style selection sorting must place checked runs first and preserve their stable order."
  );
  await page.locator("#monitorSortDirectionButton").click();
  await page.waitForFunction(
    () =>
      document
        .querySelector("#monitorSortDirectionButton")
        ?.getAttribute("data-direction") === "desc"
  );
  assert.deepEqual(
    await sortedSpeciesLogins(),
    [
      `${participantLoginKey}-species-two`,
      `${participantLoginKey}-species-beta-one`,
      `${participantLoginKey}-species-beta-two`
    ],
    "Descending selection sorting must place checked runs last without disturbing ties."
  );
  await page.locator("#monitorResetSortButton").click();
  await selectAndCommit(
    "#monitorTargetUnitKey",
    speciesReferenceTarget.targetUnitKey
  );
  await expectButtonSelectorEnabled("#monitorBatchGotoButton");
  const groupedGotoRequests = [];
  const monitorBatchCommandsRoute = new RegExp(
    `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/monitor/open-runs/commands$`
  );
  await page.route(monitorBatchCommandsRoute, async route => {
    const requestBody = route.request().postDataJSON();
    groupedGotoRequests.push(requestBody);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        requestedCount: requestBody.testRunIds.length,
        succeededCount: requestBody.testRunIds.length,
        failedCount: 0,
        commands: requestBody.testRunIds.map(testRunId => ({
          testRun: {
            testRunId,
            currentUnitKey: requestBody.targetUnitKey
          }
        })),
        failures: []
      })
    });
  });
  const acceptGroupedGoto = acceptAppConfirmation(
    /Issue monitor command/,
    /using 2 matching unit target\(s\)/
  );
  await page.locator("#monitorBatchGotoButton").click();
  await acceptGroupedGoto;
  await waitForNotBusy("group-monitor-species-cohort-goto");
  assert.deepEqual(
    groupedGotoRequests
      .map(requestBody => ({
        targetUnitKey: requestBody.targetUnitKey,
        testRunIds: requestBody.testRunIds
      }))
      .sort((left, right) =>
        left.targetUnitKey.localeCompare(right.targetUnitKey)
      ),
    [
      {
        targetUnitKey: speciesReferenceTarget.targetUnitKey,
        testRunIds: [`${pausedTestRunId}:species-beta-one`]
      },
      {
        targetUnitKey: speciesVariantTargetUnitKey,
        testRunIds: [`${pausedTestRunId}:species-beta-two`]
      }
    ].sort((left, right) =>
      left.targetUnitKey.localeCompare(right.targetUnitKey)
    ),
    "A cohort go-to must resolve the selected block to each run's own first visible unit."
  );
  await page.unroute(monitorBatchCommandsRoute);
  if (await page.locator("#clearMonitorBatchSelectionButton").isEnabled()) {
    await page.locator("#clearMonitorBatchSelectionButton").click();
  }
  while (monitorSpeciesRouteOperations.size > 0) {
    await Promise.all([...monitorSpeciesRouteOperations]);
  }
  await page.unroute(monitorSpeciesRoute);
  await applyMonitorScopeAndWaitForOpenRuns(
    "group-monitor-species-highlighting-restore"
  );
  await scopedOpenRuns.filter({ hasText: participantLoginKey }).waitFor();
  stopAfter("group-monitor-auto-next-block");

  logStep("group-monitor-booklet-error-copy");
  const monitorBookletErrorTemplateResponse = await fetch(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/monitor/open-runs?limit=100`,
    {
      headers: { authorization: `Bearer ${groupMonitorSessionToken}` }
    }
  );
  assert.equal(monitorBookletErrorTemplateResponse.status, 200);
  const monitorBookletErrorTemplatePayload =
    await monitorBookletErrorTemplateResponse.json();
  const monitorBookletErrorTemplate =
    monitorBookletErrorTemplatePayload.items?.[0];
  assert.ok(
    monitorBookletErrorTemplate,
    "Booklet-error presentation needs one real scoped run."
  );
  const monitorBookletErrors = [
    ["missing-id", "UI No Booklet Assigned"],
    ["missing-file", "UI Missing Booklet File"],
    ["xml", "UI Broken Booklet XML"],
    ["general", "UI Booklet Access Error"]
  ];
  const monitorBookletErrorRouteOperations = new Set();
  await page.route(monitorOpenRunsRoute, route => {
    const operation = (async () => {
      const response = await route.fetch();
      const payload = await response.json();
      await route.fulfill({
        response,
        json: {
          ...payload,
          items: monitorBookletErrors.map(([bookletError], index) => ({
            ...monitorBookletErrorTemplate,
            testRunId: `${monitorBookletErrorTemplate.testRunId}:booklet-error:${bookletError}`,
            participantSessionId: `${monitorBookletErrorTemplate.participantSessionId}:booklet-error:${index}`,
            loginKey: `${monitorBookletErrorTemplate.loginKey}-${bookletError}`,
            bookletKey:
              bookletError === "missing-id" ? "" : `broken-${bookletError}`,
            bookletLabel: null,
            bookletSpecies: null,
            bookletError,
            blockNavigationTargets: [],
            activeTestletTimer: null
          }))
        }
      });
    })();
    monitorBookletErrorRouteOperations.add(operation);
    void operation.then(
      () => monitorBookletErrorRouteOperations.delete(operation),
      () => monitorBookletErrorRouteOperations.delete(operation)
    );
    return operation;
  });
  await selectAndCommit("#monitorProfile", "booklet-errors");
  await applyMonitorScopeAndWaitForOpenRuns("group-monitor-booklet-error-copy");
  for (const [, expectedCopy] of monitorBookletErrors) {
    await scopedOpenRuns.getByText(expectedCopy, { exact: true }).waitFor();
  }
  assert.equal(
    await scopedOpenRuns.getByRole("button", { name: "Add to Batch" }).count(),
    0,
    "Broken-booklet runs must not be available to batch commands."
  );
  await scopedOpenRuns
    .getByRole("button", { name: "Select + Sync" })
    .first()
    .click();
  await waitForNotBusy("group-monitor-booklet-error-copy-select");
  await expectButtonSelectorDisabled("#monitorConsolePauseButton");
  await expectButtonSelectorEnabled("#monitorConsoleCompleteButton");
  while (monitorBookletErrorRouteOperations.size > 0) {
    await Promise.all([...monitorBookletErrorRouteOperations]);
  }
  await page.unroute(monitorOpenRunsRoute);
  await selectAndCommit("#monitorProfile", "all");
  await clickAction("Clear Open Run Filters");
  await applyMonitorScopeAndWaitForOpenRuns(
    "group-monitor-booklet-error-copy-restore"
  );
  await scopedOpenRuns.filter({ hasText: participantLoginKey }).waitFor();
  stopAfter("group-monitor-booklet-error-copy");

  await page.waitForFunction(
    () => !document.querySelector(".status-banner.is-error"),
    undefined,
    { timeout: 10_000 }
  );
  stopAfter("group-monitor-console");

  await page.locator('[data-view-nav="ops"]').click();
  await page.waitForURL(/\/app\/ops$/);
  await signOutAdmin();
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
  await fillAndCommit("#openRunSpeciesFilter", "species: 2");
  await fillAndCommit("#openRunSessionFilter", participantSessionId);
  await fillAndCommit("#openRunRunFilter", pausedTestRunId);
  await fillAndCommit("#openRunUnitFilter", "unit-paused");
  await selectAndCommit("#openRunStatusFilter", "running");
  await fillAndCommit("#openRunLimit", "1");
  await clickAction("Apply Open Run Filters");
  await pollJsonWithPredicate(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/monitor/open-runs?loginKey=${participantLoginKey}&groupKey=${encodeURIComponent(participantGroupKey)}&bookletKey=${encodeURIComponent(participantBookletKey)}&bookletSpecies=${encodeURIComponent("species: 2")}&participantSessionId=${participantSessionId}&testRunId=${pausedTestRunId}&unitKey=unit-paused&status=running&limit=1`,
    payload =>
      typeof payload === "object" &&
      payload != null &&
      Array.isArray(payload.items) &&
      payload.items.length === 1 &&
      payload.items[0]?.testRunId === pausedTestRunId
  );
  await fillAndCommitUntilValue("#openRunLoginFilter", participantLoginKey);
  await expectInputValue("#openRunLoginFilter", participantLoginKey);
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
  const entrySmokeGroupCard = studyMonitorCard
    .locator(".record-card")
    .filter({ has: page.getByRole("heading", { name: "group:entry-smoke" }) })
    .filter({ hasText: "2 expected, 0 session(s)" })
    .filter({ hasText: "2 not started" })
    .filter({ hasText: "Open Group Detail" })
    .filter({ hasText: "Show In Matrix" });
  await entrySmokeGroupCard.waitFor();
  logStep("study-monitor-group-filter-matrix");
  await entrySmokeGroupCard
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
  const studyMonitorExportPreview = page
    .locator("#studyMonitorExportPreview")
    .filter({ hasText: "tenantKey,workspaceKey,section" })
    .filter({ hasText: "unit-paused" })
    .filter({ hasText: "not_started_participant" });
  let studyMonitorExportError = null;
  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      await studyMonitorExportPreview.waitFor({ timeout: 10_000 });
      studyMonitorExportError = null;
      break;
    } catch (error) {
      studyMonitorExportError = error;
      if (attempt < 3) {
        await clickAction("Export Study Monitor CSV");
      }
    }
  }
  if (studyMonitorExportError) {
    throw studyMonitorExportError;
  }
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
  await fillAndCommitUntilValue("#sourceFileName", "broken.json");
  await fillAndCommitUntilValue("#sourceMediaType", "application/json");
  await fillAndCommitUntilValue("#sourceDocument", failedImportSourceDocument);
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
  const failedSourcePackageDetailResponsePromise = page.waitForResponse(
    response =>
      response.request().method() === "GET" &&
      response.url().endsWith(
        `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/source-packages/${failedSourcePackageId}`
      )
  );
  await clickAction("Source Package Detail");
  const failedSourcePackageDetailResponse =
    await failedSourcePackageDetailResponsePromise;
  assert.equal(failedSourcePackageDetailResponse.status(), 200);
  await expectButtonSelectorEnabled("#retrySourcePackageImportButton");

  await fillAndCommitUntilValue("#sourceFileName", "fixed.xml");
  await fillAndCommitUntilValue("#sourceMediaType", "application/xml");
  await expectInputValue("#sourceMediaType", "application/xml");
  await fillAndCommitUntilValue("#sourceDocument", repairedImportSourceDocument);
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
  await selectAndCommit("#sourcePackageSortBy", "fileSize");
  await selectAndCommit("#sourcePackageSortDirection", "desc");
  await fillAndCommit("#sourcePackageLimit", "1");
  await selectAndCommit("#importJobStatusFilter", "completed");
  await fillAndCommit("#importJobSourcePackageFilter", failedSourcePackageId);
  await fillAndCommit("#importJobLimit", "1");
  await selectAndCommit("#contentReleaseStatusFilter", "staged");
  await fillAndCommit("#contentReleaseImportJobFilter", completedRetryImportJobId);
  await fillAndCommit("#contentReleaseSourcePackageFilter", failedSourcePackageId);
  await fillAndCommit("#contentReleaseLimit", "1");
  const sortedSourcePackageResponse = page.waitForResponse(response => {
    const url = new URL(response.url());
    return (
      url.pathname.endsWith("/source-packages") &&
      url.searchParams.get("sortBy") === "fileSize" &&
      url.searchParams.get("sortDirection") === "desc" &&
      response.status() === 200
    );
  });
  await clickContentFilterApply();
  const sortedSourcePackagePayload = await (
    await sortedSourcePackageResponse
  ).json();
  assert.equal(sortedSourcePackagePayload.filteredCount, 1);
  assert.ok(sortedSourcePackagePayload.workspaceSummary.totalCount > 1);
  assert.equal(
    sortedSourcePackagePayload.workspaceSummary.validCount +
      sortedSourcePackagePayload.workspaceSummary.pendingCount +
      sortedSourcePackagePayload.workspaceSummary.invalidCount,
    sortedSourcePackagePayload.workspaceSummary.totalCount
  );
  assert.equal(
    sortedSourcePackagePayload.workspaceSummary.fileTypes.reduce(
      (count, summary) => count + summary.totalCount,
      0
    ),
    sortedSourcePackagePayload.workspaceSummary.totalCount
  );
  const sourcePackageHealthCard = page
    .locator("article.card")
    .filter({ has: page.getByRole("heading", { name: "Workspace File Health" }) })
    .locator(".record-card");
  await sourcePackageHealthCard
    .filter({
      hasText: `${sortedSourcePackagePayload.workspaceSummary.totalCount} workspace file(s), independent of filters and limit`
    })
    .filter({
      hasText: `${sortedSourcePackagePayload.workspaceSummary.validCount} valid`
    })
    .filter({
      hasText: `${sortedSourcePackagePayload.workspaceSummary.pendingCount} pending`
    })
    .filter({
      hasText: `${sortedSourcePackagePayload.workspaceSummary.invalidCount} invalid`
    })
    .filter({
      hasText: `${sortedSourcePackagePayload.workspaceSummary.warningFileCount} with warnings`
    })
    .waitFor();
  const nonMatchingTypeSummary =
    sortedSourcePackagePayload.workspaceSummary.fileTypes.find(
      summary => summary.fileType !== "Resource" && summary.totalCount > 0
    );
  assert.ok(
    nonMatchingTypeSummary,
    "UI smoke expected a workspace file type outside the filtered Resource window."
  );
  await page
    .locator("article.card")
    .filter({ has: page.getByRole("heading", { name: "Workspace Files By Type" }) })
    .locator(".record-card")
    .filter({
      has: page.getByRole("heading", { name: nonMatchingTypeSummary.fileType })
    })
    .filter({ hasText: `${nonMatchingTypeSummary.totalCount} file` })
    .filter({ hasText: "No matching file in the current filtered window" })
    .waitFor();
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
    .filter({ hasText: "Sort" })
    .filter({ hasText: "fileSize desc" })
    .filter({ hasText: "Matched Records" })
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
  logStep("refresh-monitor-command-target");
  const monitorCommandLoginKey = `${participantLoginKey}-monitor-command`;
  const monitorCommandGroupKey = `${participantGroupKey}-monitor-command`;
  await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/participant-roster`,
    {
      body: {
        rosterText: [
          "loginKey,groupKey,bookletKey,displayName",
          [
            monitorCommandLoginKey,
            monitorCommandGroupKey,
            participantBookletKey,
            monitorCommandLoginKey
          ].join(",")
        ].join("\n")
      }
    }
  );
  const refreshedMonitorTarget = await (
    await sendSmokeJson(`${baseUrl}/api/v1/participant/starter:launch`, {
      body: {
        tenantKey,
        workspaceKey,
        loginKey: monitorCommandLoginKey,
        groupKey: monitorCommandGroupKey,
        bookletKey: participantBookletKey
      }
    })
  ).json();
  participantSessionId = refreshedMonitorTarget.participantSession.participantSessionId;
  pausedTestRunId = refreshedMonitorTarget.testRun.testRunId;
  await sendSmokeJson(
    `${baseUrl}/api/v1/participant/test-runs/${encodeURIComponent(
      pausedTestRunId
    )}/save-progress`,
    {
      body: {
        currentUnitKey: "unit-paused",
        status: "running",
        unitResponse: "Filtered response smoke"
      }
    }
  );
  await fillAndCommitUntilValue("#participantSessionId", participantSessionId);
  await fillAndCommitUntilValue("#testRunId", pausedTestRunId);
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
          item.activityEvent.details?.commandType === "complete_and_lock" &&
          item.activityEvent.details?.previousStatus === "running" &&
          item.activityEvent.details?.nextStatus === "completed" &&
          item.activityEvent.details?.locked === true &&
          item.activityEvent.details?.participantSessionId === participantSessionId &&
          item.activityEvent.details?.loginKey === monitorCommandLoginKey &&
          item.activityEvent.details?.groupKey === monitorCommandGroupKey &&
          item.activityEvent.details?.bookletKey === participantBookletKey
      )
  );
  logStep("force-activate-after-complete");
  await page.locator('[data-view-nav="content"]').click();
  await page.waitForURL(/\/app\/content$/);
  await fillAndCommitUntilValue("#contentReleaseId", retriedContentReleaseId);
  await page.locator("#forceActivation").check({ force: true });
  await page.locator("#forceActivation").dispatchEvent("change");
  const forceActivationDialog = acceptAppConfirmation(
    /Force activate release\?/,
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
  await fillAndCommitUntilValue("#contentReleaseId", retriedContentReleaseId);
  const activatedReleaseReadinessResponsePromise = page.waitForResponse(
    response =>
      response.request().method() === "GET" &&
      response.url().endsWith(
        `/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}/content-releases/${retriedContentReleaseId}/activation-readiness`
      )
  );
  await clickAction("Release Readiness");
  const activatedReleaseReadinessResponse =
    await activatedReleaseReadinessResponsePromise;
  assert.equal(activatedReleaseReadinessResponse.status(), 200);
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

  async function runAttachmentManagerSmoke() {
    logStep("attachment-manager");
    const attachmentWorkspaceKey = `${workspaceKey}-attachments`;
    const attachmentBookletKey = "booklet:attachment-smoke";
  await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces`,
    {
      body: {
        workspaceKey: attachmentWorkspaceKey,
        displayName: "Attachment Smoke Workspace"
      }
    }
  );
  const attachmentSourcePackage = await (
    await sendSmokeJson(
      `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${attachmentWorkspaceKey}/source-packages`,
      {
        body: {
          fileName: "attachment-smoke.json",
          mediaType: "application/json",
          contentStructure: {
            bookletEntries: [
              {
                bookletKey: attachmentBookletKey,
                displayLabel: "Attachment Smoke Booklet",
                unitEntries: [
                  {
                    unitKey: "unit:attachment-smoke",
                    displayLabel: "Capture Photo",
                    requestedAttachments: [
                      {
                        variableId: "participant-photo",
                        attachmentType: "capture-image"
                      },
                      {
                        variableId: "source-audio",
                        attachmentType: "audio"
                      }
                    ]
                  }
                ]
              }
            ]
          }
        }
      }
    )
  ).json();
  const attachmentImport = await (
    await sendSmokeJson(
      `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${attachmentWorkspaceKey}/import-jobs`,
      {
        body: {
          sourcePackageId:
            attachmentSourcePackage.sourcePackage.sourcePackageId
        }
      }
    )
  ).json();
  await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${attachmentWorkspaceKey}/content-releases/${attachmentImport.stagedContentRelease.contentReleaseId}/activate`,
    { body: { activatedByActorId: "ui-attachment-smoke" } }
  );
  await sendSmokeJson(
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${attachmentWorkspaceKey}/participant-roster`,
    {
      body: {
        rosterText: [
          {
            loginKey: "attachment-smoke-participant",
            groupKey: "group:attachment-smoke",
            bookletKey: attachmentBookletKey,
            displayName: "Attachment Smoke Participant"
          }
        ]
      }
    }
  );
  await sendSmokeJson(`${baseUrl}/api/v1/participant/starter:launch`, {
    body: {
      tenantKey,
      workspaceKey: attachmentWorkspaceKey,
      loginKey: "attachment-smoke-participant",
      bookletKey: attachmentBookletKey
    }
  });

  await page.locator('[data-view-nav="workspace"]').click();
  await page.waitForURL(/\/app\/workspace$/);
  await fillAndCommit("#workspaceKey", attachmentWorkspaceKey);
  await page.locator('[data-view-nav="runtime"]').click();
  await page.waitForURL(/\/app\/runtime$/);
  const attachmentManager = page.locator("#attachmentManagerCard");
  await attachmentManager.waitFor();
  await attachmentManager.locator("#loadAttachmentsButton").click();
  await attachmentManager
    .locator("#attachmentRows")
    .filter({ hasText: "Attachment Smoke Participant" })
    .filter({ hasText: "missing" })
    .waitFor();
  const unsupportedAttachmentRow = attachmentManager
    .locator(".attachment-row")
    .filter({ hasText: "source-audio" })
    .filter({ hasText: "type: audio" });
  await unsupportedAttachmentRow.waitFor();
  await unsupportedAttachmentRow.click();
  await attachmentManager
    .locator("#unsupportedAttachmentType")
    .filter({ hasText: "No audio capture workflow" })
    .waitFor();
  assert.equal(
    await attachmentManager.locator("#downloadSelectedAttachmentPageButton").count(),
    0
  );
  assert.equal(
    await attachmentManager.locator("#captureSelectedAttachmentButton").count(),
    0
  );
  await attachmentManager
    .locator(".attachment-row")
    .filter({ hasText: "participant-photo" })
    .click();
  await attachmentManager
    .locator(".attachment-side")
    .filter({ hasText: "participant-photo" })
    .filter({ hasText: "capture-image" })
    .waitFor();
  await attachmentManager
    .locator("#selectedAttachmentCode")
    .filter({ hasText: /^att-/ })
    .waitFor();
  const selectedAttachmentCode = (
    await attachmentManager.locator("#selectedAttachmentCode").textContent()
  )?.trim();
  assert.match(selectedAttachmentCode ?? "", /^att-/);
  await fillAndCommit(
    "#attachmentLabelTemplate",
    "%TESTTAKER% | %GROUP% | %VAR%"
  );
  const allAttachmentPagesDownloadPromise = page.waitForEvent("download");
  await attachmentManager.locator("#downloadAttachmentPagesButton").click();
  const allAttachmentPagesDownload = await allAttachmentPagesDownloadPromise;
  assert.equal(
    allAttachmentPagesDownload.suggestedFilename(),
    `${attachmentWorkspaceKey}-attachment-pages.pdf`
  );
  const allAttachmentPagesPath = await allAttachmentPagesDownload.path();
  assert.ok(allAttachmentPagesPath);
  assert.equal(
    (await readFile(allAttachmentPagesPath)).subarray(0, 5).toString("ascii"),
    "%PDF-"
  );
  await attachmentManager
    .locator("#attachmentManagerStatus")
    .filter({ hasText: "capture QR page(s) downloaded" })
    .waitFor();
  const selectedAttachmentPageDownloadPromise = page.waitForEvent("download");
  await attachmentManager
    .locator("#downloadSelectedAttachmentPageButton")
    .click();
  const selectedAttachmentPageDownload =
    await selectedAttachmentPageDownloadPromise;
  assert.equal(
    selectedAttachmentPageDownload.suggestedFilename(),
    "attachment-smoke-participant-participant-photo-attachment-page.pdf"
  );

  await attachmentManager.locator("#openAttachmentCaptureButton").click();
  await page.waitForURL(/\/app\/attachment-capture$/);
  const attachmentCapture = page.locator("#attachmentCaptureCard");
  await attachmentCapture.waitFor();
  await attachmentCapture.locator("#startAttachmentCameraButton").click();
  try {
    await attachmentCapture
      .locator("#attachmentCaptureStatus")
      .filter({ hasText: "Camera active" })
      .waitFor({ timeout: 15_000 });
  } catch (error) {
    const cameraState = await page.evaluate(() => {
      const video = document.querySelector("#attachmentCaptureVideo");
      return {
        status: document.querySelector("#attachmentCaptureStatus")?.textContent,
        placeholder: document.querySelector(".camera-placeholder")?.textContent,
        video:
          video instanceof HTMLVideoElement
            ? {
                paused: video.paused,
                readyState: video.readyState,
                videoWidth: video.videoWidth,
                videoHeight: video.videoHeight,
                hasStream: video.srcObject instanceof MediaStream
              }
            : null
      };
    });
    throw new Error(
      `Attachment camera did not become active: ${JSON.stringify(cameraState)}`,
      { cause: error }
    );
  }
  await page.waitForFunction(() => {
    const video = document.querySelector("#attachmentCaptureVideo");
    return (
      video instanceof HTMLVideoElement &&
      video.videoWidth > 0 &&
      video.videoHeight > 0
    );
  });
  await attachmentCapture.locator("#attachmentQrImageInput").setInputFiles({
    name: "attachment-code.png",
    mimeType: "image/png",
    buffer: await QRCode.toBuffer(selectedAttachmentCode, {
      type: "png",
      margin: 4,
      width: 512
    })
  });
  await attachmentCapture
    .locator("#attachmentCaptureTarget")
    .filter({ hasText: "Attachment Smoke Participant" })
    .filter({ hasText: "participant-photo" })
    .waitFor();
  await attachmentCapture.locator("#captureAttachmentFrameButton").click();
  await attachmentCapture.locator("#attachmentCapturePreview").waitFor();
  await attachmentCapture.locator("#uploadCapturedAttachmentButton").click();
  await attachmentCapture
    .locator("#attachmentCaptureStatus")
    .filter({ hasText: "Attachment uploaded for Attachment Smoke Participant" })
    .waitFor();
  await attachmentCapture
    .getByRole("link", { name: "Back to Attachment Manager" })
    .click();
  await page.waitForURL(/\/app\/runtime$/);
  const refreshedAttachmentManager = page.locator("#attachmentManagerCard");
  await refreshedAttachmentManager.locator("#loadAttachmentsButton").click();
  await refreshedAttachmentManager
    .locator("#attachmentRows")
    .filter({ hasText: "image" })
    .waitFor();
  await refreshedAttachmentManager
    .locator(".attachment-row")
    .filter({ hasText: "participant-photo" })
    .click();
  await refreshedAttachmentManager
    .getByRole("button", { name: "Preview" })
    .click({ force: true });
  await refreshedAttachmentManager.locator("#attachmentPreview").waitFor();
  await refreshedAttachmentManager.getByRole("button", { name: "Delete" }).click();
  await refreshedAttachmentManager
    .locator("#attachmentManagerStatus")
    .filter({ hasText: "Attachment image deleted" })
    .waitFor();
  await refreshedAttachmentManager
    .locator("#attachmentRows")
    .filter({ hasText: "missing" })
    .waitFor();
    stopAfter("attachment-manager");
  }

  await runAttachmentManagerSmoke();

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
          activeView: "runtime"
        })
      );
    },
    [tenantKey, workspaceKey]
  );
  await page.goto(`${baseUrl}/app/runtime`, { waitUntil: "domcontentloaded" });
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
  const [resultArchiveDownload] = await Promise.all([
    page.waitForEvent("download"),
    page.locator("#exportSelectedGroupResultArchiveButton").click()
  ]);
  assert.match(
    resultArchiveDownload.suggestedFilename(),
    /original-results\.zip$/
  );
  const resultArchivePath = resolve(
    ".data",
    `${workspaceKey}-browser-original-results.zip`
  );
  await resultArchiveDownload.saveAs(resultArchivePath);
  const resultArchiveEntries = readStoredZipTextEntries(
    await readFile(resultArchivePath)
  );
  assert.deepEqual([...resultArchiveEntries.keys()], [
    "manifest.json",
    "responses.json",
    "responses.csv",
    "logs.json",
    "logs.csv",
    "reviews.json",
    "reviews.csv"
  ]);
  const resultArchiveManifest = JSON.parse(
    resultArchiveEntries.get("manifest.json")
  );
  assert.deepEqual(resultArchiveManifest.groupKeys, [participantGroupKey]);
  assert.ok(resultArchiveManifest.counts.responses > 0);
  assert.ok(resultArchiveManifest.counts.logs > 0);
  assert.ok(resultArchiveManifest.counts.reviews > 0);
  assert.match(
    resultArchiveEntries.get("responses.csv"),
    /^\uFEFFgroupname;loginname;code;bookletname;unitname;originalUnitId;responses;laststate\n/
  );
  assert.match(resultArchiveEntries.get("reviews.csv"), /category_/);
  await rm(resultArchivePath, { force: true });
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
  const deleteGroupResultsDialog = acceptVerifiedAppConfirmation(
    /Delete selected group results\?/,
    /Delete all responses, reviews, and logs for 1 selected group\(s\)\? This cannot be undone\./,
    workspaceKey
  );
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
