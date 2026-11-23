import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdir, readFile, rm } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { brotliDecompressSync } from "node:zlib";

import { chromium } from "playwright";
import { createParticipantHttpTestActor } from "./participant-http-test-actor.mjs";

const participantHttpActor = createParticipantHttpTestActor();
const fetch = participantHttpActor.fetch;

const store = process.env.FIRST_SLICE_STORE ?? "sqlite";
const serverEntry = resolve("apps/api/dist/apps/api/src/index.js");
const fixtureRoot = resolve("test-fixtures/original-testcenter");

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
    const content = Buffer.from(entry.content);
    const checksum = crc32(content);
    const localHeader = Buffer.alloc(30 + fileName.length);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0x0800, 6);
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
    centralDirectoryHeader.writeUInt32LE(checksum, 16);
    centralDirectoryHeader.writeUInt32LE(content.length, 20);
    centralDirectoryHeader.writeUInt32LE(content.length, 24);
    centralDirectoryHeader.writeUInt16LE(fileName.length, 28);
    centralDirectoryHeader.writeUInt32LE(offset, 42);
    fileName.copy(centralDirectoryHeader, 46);
    centralDirectoryHeaders.push(centralDirectoryHeader);
    offset += localHeader.length + content.length;
  }

  const centralDirectory = Buffer.concat(centralDirectoryHeaders);
  const endOfCentralDirectory = Buffer.alloc(22);
  endOfCentralDirectory.writeUInt32LE(0x06054b50, 0);
  endOfCentralDirectory.writeUInt16LE(entries.length, 8);
  endOfCentralDirectory.writeUInt16LE(entries.length, 10);
  endOfCentralDirectory.writeUInt32LE(centralDirectory.length, 12);
  endOfCentralDirectory.writeUInt32LE(offset, 16);
  return Buffer.concat([
    ...localFileHeaders,
    centralDirectory,
    endOfCentralDirectory
  ]);
};

const allocatePort = () =>
  new Promise((resolvePromise, reject) => {
    const server = createNetServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      if (!address || typeof address === "string") {
        reject(new Error("Could not allocate an adaptive runtime smoke port."));
        return;
      }
      server.close(error =>
        error ? reject(error) : resolvePromise(address.port)
      );
    });
  });

const pollReady = async url => {
  const deadline = Date.now() + 20_000;
  let lastError;
  while (Date.now() < deadline) {
    try {
      const response = await fetch(url);
      assert.equal(response.status, 200);
      return;
    } catch (error) {
      lastError = error;
      await delay(250);
    }
  }
  throw lastError ?? new Error(`Timed out waiting for ${url}`);
};

const sendJson = async (url, body) => {
  const response = await fetch(url, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body)
  });
  assert.equal(
    response.ok,
    true,
    `${response.status} ${url}: ${await response.clone().text()}`
  );
  return response;
};

const pollJson = async (url, predicate, timeoutMs = 30_000) => {
  const deadline = Date.now() + timeoutMs;
  let lastPayload = null;
  while (Date.now() < deadline) {
    const response = await fetch(url);
    assert.equal(response.status, 200);
    lastPayload = await response.json();
    if (predicate(lastPayload)) return lastPayload;
    await delay(250);
  }
  throw new Error(
    `Timed out waiting for predicate on ${url}: ${JSON.stringify(lastPayload)}`
  );
};

const stopChild = child =>
  new Promise(resolvePromise => {
    if (child.exitCode !== null) {
      resolvePromise();
      return;
    }
    const timeout = setTimeout(() => child.kill("SIGKILL"), 2_000);
    child.once("exit", () => {
      clearTimeout(timeout);
      resolvePromise();
    });
    child.kill("SIGTERM");
  });

const sqliteFile = resolve(
  process.env.FIRST_SLICE_SQLITE_FILE ??
    "./.data/ui-smoke-adaptive-runtime.sqlite"
);
if (store === "sqlite") {
  process.env.FIRST_SLICE_SQLITE_FILE = sqliteFile;
  await mkdir(dirname(sqliteFile), { recursive: true });
  await Promise.all(
    [sqliteFile, `${sqliteFile}-wal`, `${sqliteFile}-shm`, `${sqliteFile}-journal`].map(
      filePath => rm(filePath, { force: true })
    )
  );
}

const port = await allocatePort();
const baseUrl = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, [serverEntry], {
  stdio: "inherit",
  env: { ...process.env, PORT: String(port), FIRST_SLICE_STORE: store,
    FIRST_SLICE_XML_SCHEMA_PROFILE: process.env.FIRST_SLICE_XML_SCHEMA_PROFILE || "legacy-compatibility" }
});
let browser;

try {
  await pollReady(`${baseUrl}/readyz`);
  browser = await chromium.launch({
    headless: true,
    channel: process.env.UI_SMOKE_BROWSER_CHANNEL || undefined
  });
  console.log(`adaptive_runtime_browser=${browser.version()}`);
  const page = await browser.newPage();
  participantHttpActor.observePage(page);
  const corpus = JSON.parse(
    await readFile(resolve(fixtureRoot, "corpus.json"), "utf8")
  );
  const adaptivePackage = corpus.currentOriginalAdaptivePackage;
  assert.ok(adaptivePackage);
  assert.equal(
    adaptivePackage.sourceCommit,
    "a5a6d25a72990d667300804c337cc5b500b01d2f"
  );

  const originalBookletDocument = await readFile(
    resolve(fixtureRoot, adaptivePackage.booklet.fixture),
    "utf8"
  );
  assert.equal(
    createHash("sha256").update(originalBookletDocument).digest("hex"),
    adaptivePackage.booklet.sha256
  );
  const professionalShow = '          <Show if="level" is="professional" />';
  const restrictedProfessional = [
    '          <CodeToEnter code="route" />',
    '          <TimeMax minutes="2" leave="allowed" />',
    professionalShow,
    '          <DenyNavigationOnIncomplete response="ON" />',
    '          <LockAfterLeaving confirm="false" scope="testlet" />'
  ].join("\n");
  const restrictedBookletDocument = originalBookletDocument
    .replace(professionalShow, restrictedProfessional)
    .replace(
      "  </Units>",
      [
        '    <Unit id="UNIT.SAMPLE-2" label="Finish Unit" labelshort="F" alias="finish-unit" />',
        "  </Units>"
      ].join("\n")
    );
  assert.match(restrictedBookletDocument, /CodeToEnter code="route"/);
  assert.match(restrictedBookletDocument, /alias="finish-unit"/);
  const expiringBookletKey = `${adaptivePackage.booklet.bookletKey}-expiry`;
  const expiringBookletDocument = restrictedBookletDocument
    .replace(`<Id>${adaptivePackage.booklet.bookletKey}</Id>`, `<Id>${expiringBookletKey}</Id>`)
    .replace('TimeMax minutes="2"', 'TimeMax minutes="0.2"');
  assert.ok(expiringBookletDocument.includes(`<Id>${expiringBookletKey}</Id>`));
  assert.match(expiringBookletDocument, /TimeMax minutes="0\.2"/);

  const [originalUnitDocument, codingSchemeBase64, playerBase64] = await Promise.all([
    readFile(resolve(fixtureRoot, adaptivePackage.unit.fixture), "utf8"),
    readFile(resolve(fixtureRoot, adaptivePackage.codingScheme.fixture), "utf8"),
    readFile(resolve(fixtureRoot, adaptivePackage.player.fixture), "utf8")
  ]);
  assert.equal(
    createHash("sha256").update(originalUnitDocument).digest("hex"),
    adaptivePackage.unit.sha256
  );
  const unitDocument = originalUnitDocument.replace(
    '<input id="var1"',
    '<input required id="var1"'
  );
  assert.notEqual(unitDocument, originalUnitDocument);
  const codingSchemeDocument = Buffer.from(
    codingSchemeBase64.trim(),
    "base64"
  ).toString("utf8");
  assert.equal(
    createHash("sha256").update(codingSchemeDocument).digest("hex"),
    adaptivePackage.codingScheme.sha256
  );
  const playerDocument = brotliDecompressSync(
    Buffer.from(playerBase64, "base64")
  ).toString("utf8");
  assert.equal(
    createHash("sha256").update(playerDocument).digest("hex"),
    adaptivePackage.player.sha256
  );
  const sourcePackage = createStoredZipBuffer([
    {
      fileName: "export/imsmanifest.xml",
      content: `<manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"><resources><resource identifier="${adaptivePackage.booklet.bookletKey}" href="booklets/CY_Bklt_Adap-1.xml" /><resource identifier="${expiringBookletKey}" href="booklets/Adaptive-Timed-Expiry.xml" /><resource identifier="${adaptivePackage.unit.unitKey}" href="units/Unit2.xml" /><resource identifier="coding-scheme.vocs.json" href="schemes/coding-scheme.vocs.json" /><resource identifier="${adaptivePackage.player.playerKey}" href="players/verona-player-simple-6.0.html" /></resources></manifest>`
    },
    {
      fileName: "export/booklets/CY_Bklt_Adap-1.xml",
      content: restrictedBookletDocument
    },
    { fileName: "export/booklets/Adaptive-Timed-Expiry.xml", content: expiringBookletDocument },
    { fileName: "export/units/Unit2.xml", content: unitDocument },
    {
      fileName: "export/schemes/coding-scheme.vocs.json",
      content: codingSchemeDocument
    },
    {
      fileName: "export/players/verona-player-simple-6.0.html",
      content: playerDocument
    }
  ]);

  const suffix = Date.now();
  const tenantKey = `adaptive-runtime-smoke-${suffix}`;
  const workspaceKey = `adaptive-runtime-smoke-${suffix}`;
  const loginKey = "adaptive-runtime-participant";
  const bookletKey = adaptivePackage.booklet.bookletKey;
  const expiryScenarios = [
    { executionMode: "run-hot-return", nextUnit: "finish-unit", locked: true, resumes: true },
    { executionMode: "run-review", nextUnit: "professional-unit", locked: false, resumes: false }
  ];
  await sendJson(`${baseUrl}/api/v1/platform/tenants`, {
    tenantKey,
    displayName: "Adaptive runtime smoke"
  });
  await sendJson(`${baseUrl}/api/v1/tenants/${tenantKey}/workspaces`, {
    workspaceKey,
    displayName: "Adaptive runtime smoke"
  });
  const workspaceUrl =
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}`;
  const sourceResponse = await sendJson(`${workspaceUrl}/source-packages`, {
    fileName: "current-adaptive-runtime-browser-smoke.zip",
    mediaType: "application/zip",
    sourceDocument: `data:application/zip;base64,${sourcePackage.toString("base64")}`
  });
  const sourcePayload = await sourceResponse.json();
  const importResponse = await sendJson(`${workspaceUrl}/import-jobs`, {
    sourcePackageId: sourcePayload.sourcePackage.sourcePackageId
  });
  const importPayload = await importResponse.json();
  assert.equal(
    importPayload.importJob.status,
    "completed",
    JSON.stringify(importPayload.importJob.diagnostics)
  );
  assert.ok(importPayload.stagedContentRelease?.contentReleaseId);
  await sendJson(
    `${workspaceUrl}/content-releases/${importPayload.stagedContentRelease.contentReleaseId}/activate`,
    {}
  );
  await sendJson(`${workspaceUrl}/participant-roster`, {
    rosterText: [
      {
        loginKey,
        groupKey: "group:adaptive-runtime",
        bookletKey,
        displayName: "Adaptive Runtime Participant",
        executionMode: "run-hot-restart"
      },
      ...expiryScenarios.map(({ executionMode }) => ({
        loginKey: `adaptive-${executionMode}`,
        groupKey: "group:adaptive-runtime",
        bookletKey: expiringBookletKey,
        displayName: `Adaptive ${executionMode} Participant`,
        executionMode
      }))
    ]
  });

  await page.goto(
    `${baseUrl}/participant?${new URLSearchParams({
      tenantKey,
      workspaceKey,
      loginKey,
      bookletKey
    })}`,
    { waitUntil: "domcontentloaded" }
  );
  await page
    .locator("#participantVeronaPlayerVersion")
    .filter({ hasText: `API ${adaptivePackage.player.playerApiVersion}` })
    .waitFor({ timeout: 30_000 });
  let playerFrame = page.frameLocator("#participantVeronaPlayerFrame");
  await playerFrame.locator("#var3").waitFor({ timeout: 30_000 });
  const participantSessionId = await page
    .locator("#participantRouteSessionId")
    .inputValue();
  assert.ok(participantSessionId);
  const currentStateUrl =
    `${baseUrl}/api/v1/participant/sessions/${participantSessionId}/current-state`;

  const readVisibleUnitKeys = () =>
    page.locator("#participantRouteUnitRail [data-unit-key]").evaluateAll(elements =>
      elements.map(element => element.getAttribute("data-unit-key"))
    );
  assert.deepEqual(await readVisibleUnitKeys(), [
    "decision-unit",
    "beginner-unit",
    "finish-unit"
  ]);
  assert.equal(await page.locator("#participantRouteTestletUnlockCode").count(), 0);
  assert.equal(await page.locator("#participantRouteTestletTimer").count(), 0);
  assert.equal(await page.locator("#participantRouteLeaveLock").count(), 0);

  await playerFrame.locator("#var3").fill("3");
  await playerFrame.locator("#var3").dispatchEvent("keyup", {
    key: "3",
    code: "Digit3"
  });
  await playerFrame.locator("#var4").fill("3");
  await playerFrame.locator("#var4").dispatchEvent("keyup", {
    key: "3",
    code: "Digit3"
  });
  const routedState = await pollJson(
    currentStateUrl,
    payload =>
      payload?.currentRunState?.testRun?.bookletStates?.level ===
        "professional" &&
      payload.currentRunState.bookletUnits?.some(
        unit => unit.unitKey === "professional-unit"
      )
  );
  const testRunId = routedState.currentRunState.testRun.testRunId;
  assert.ok(testRunId);
  await page.waitForFunction(
    () =>
      [...document.querySelectorAll("#participantRouteUnitRail [data-unit-key]")]
        .map(element => element.getAttribute("data-unit-key"))
        .join(",") === "decision-unit,professional-unit,finish-unit",
    undefined,
    { timeout: 30_000 }
  );
  await page.locator("#participantRouteTestletUnlockCode").waitFor();
  assert.equal(await page.locator("#participantRouteTestletTimer").count(), 0);
  assert.equal(await page.locator("#participantRouteLeaveLock").count(), 0);
  assert.equal(
    await page
      .locator('#participantRouteUnitRail [data-unit-key="professional-unit"]')
      .isDisabled(),
    true
  );

  await page.locator("#participantRouteTestletUnlockCode").fill("route");
  assert.equal(
    await page.locator("#participantRouteTestletUnlockCode").inputValue(),
    "ROUTE"
  );
  await page.locator("#participantRouteTestletUnlockButton").click();
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "professional-unit" })
    .waitFor({ timeout: 30_000 });
  await page.locator("#participantRouteTestletTimer").waitFor();
  await page.locator("#participantRouteLeaveLock").waitFor();
  const unlockedState = await pollJson(
    currentStateUrl,
    payload =>
      payload?.currentRunState?.testRun?.currentUnitKey ===
        "professional-unit" &&
      payload.currentRunState.testRun.testletTimers?.["stage1-professional"]
        ?.status === "running"
  );
  assert.deepEqual(
    unlockedState.currentRunState.testRun.unlockedTestletKeys,
    ["stage1-professional"]
  );
  assert.deepEqual(
    unlockedState.currentRunState.testRun.lockedTestletKeys ?? [],
    []
  );

  assert.equal(
    await page.locator("#participantRouteNextUnitButton").isDisabled(),
    false
  );
  await page.locator("#participantRouteNextUnitButton").click();
  await page.locator("#participantRouteNavigationNotice").waitFor();
  const afterDeniedState = await pollJson(
    currentStateUrl,
    payload =>
      payload?.currentRunState?.testRun?.currentUnitKey ===
        "professional-unit"
  );
  assert.equal(
    afterDeniedState.currentRunState.testRun.testletTimers?.[
      "stage1-professional"
    ]?.status,
    "running"
  );
  assert.deepEqual(
    afterDeniedState.currentRunState.testRun.lockedTestletKeys ?? [],
    []
  );
  assert.deepEqual(
    afterDeniedState.currentRunState.navigation.forwardDeniedReasons,
    ["response_incomplete"]
  );

  playerFrame = page.frameLocator("#participantVeronaPlayerFrame");
  await playerFrame.locator("#var1").fill("complete");
  await playerFrame.locator("#var1").dispatchEvent("keyup", {
    key: "e",
    code: "KeyE"
  });
  await pollJson(currentStateUrl, payload => {
    const response =
      payload?.currentRunState?.testRun?.unitResponses?.["professional-unit"];
    if (typeof response !== "string") return false;
    try {
      return JSON.parse(response).unitState?.responseProgress === "complete";
    } catch {
      return false;
    }
  });
  const allowedNavigation = page.waitForResponse(
    response =>
      response.request().method() === "POST" &&
      response.url().endsWith(
        `/api/v1/participant/test-runs/${testRunId}/save-progress`
      ) &&
      response.status() === 200
  );
  await page.locator("#participantRouteNextUnitButton").click();
  await allowedNavigation;
  await page
    .locator("#participantRouteUnitKey")
    .filter({ hasText: "finish-unit" })
    .waitFor({ timeout: 30_000 });
  const finishedRouteState = await pollJson(
    currentStateUrl,
    payload =>
      payload?.currentRunState?.testRun?.currentUnitKey === "finish-unit" &&
      payload.currentRunState.testRun.testletTimers?.["stage1-professional"]
        ?.status === "cancelled" &&
      payload.currentRunState.testRun.lockedTestletKeys?.includes(
        "stage1-professional"
      )
  );
  assert.equal(
    finishedRouteState.currentRunState.testRun.testletTimers[
      "stage1-professional"
    ].durationSeconds,
    120
  );
  assert.equal(await page.locator("#participantRouteTestletTimer").count(), 0);
  const lockedProfessionalUnit = page.locator(
    '#participantRouteUnitRail [data-unit-key="professional-unit"]'
  );
  assert.equal(await lockedProfessionalUnit.isDisabled(), true);

  const logsResponse = await fetch(
    `${workspaceUrl}/test-logs?testRunId=${encodeURIComponent(testRunId)}&limit=100`
  );
  assert.equal(logsResponse.status, 200);
  const logs = await logsResponse.json();
  const logKeys = new Set(logs.items.map(item => item.testLog.logKey));
  for (const logKey of [
    "BOOKLET_STATES",
    "TESTLETS_CLEARED_CODE",
    "TESTLETS_TIMELEFT",
    "TESTLETS_LOCKED_AFTER_LEAVE"
  ]) {
    assert.equal(logKeys.has(logKey), true, logKey);
  }

  for (const { executionMode, nextUnit, locked, resumes } of expiryScenarios) {
    const context = await browser.newContext();
    try {
      const learner = await context.newPage();
      participantHttpActor.observePage(learner);
      await learner.goto(`${baseUrl}/participant?${new URLSearchParams({
        tenantKey, workspaceKey, loginKey: `adaptive-${executionMode}`, bookletKey: expiringBookletKey
      })}`, { waitUntil: "domcontentloaded" });
      const frame = learner.frameLocator("#participantVeronaPlayerFrame");
      if (executionMode === "run-review") {
        await learner.locator("#participantRouteAdaptiveState-level").selectOption("professional");
      } else {
        await frame.locator("#var3").fill("3");
        await frame.locator("#var3").press("End");
      }
      await learner.locator("#participantRouteTestletUnlockCode").waitFor();
      const sessionId = await learner.locator("#participantRouteSessionId").inputValue();
      assert.ok(sessionId);
      const stateUrl = `${baseUrl}/api/v1/participant/sessions/${sessionId}/current-state`;
      const before = (await pollJson(stateUrl, ({ currentRunState }) =>
        currentRunState?.testRun?.bookletStates?.level === "professional"
      )).currentRunState.testRun;
      assert.equal(before.currentUnitKey, "decision-unit");
      assert.equal(Object.keys(before.testletTimers ?? {}).length, 0);

      await learner.locator("#participantRouteTestletUnlockCode").fill("route");
      await learner.locator("#participantRouteTestletUnlockButton").click();
      const timerKey = "stage1-professional";
      const running = (await pollJson(stateUrl, ({ currentRunState }) =>
        currentRunState?.testRun?.testletTimers?.[timerKey]?.status === "running"
      )).currentRunState.testRun;
      const start = running.testletTimers[timerKey];
      assert.equal(running.currentUnitKey, "professional-unit");
      assert.equal(start.durationSeconds, 12);
      assert.equal(Date.parse(start.expiresAt) - Date.parse(start.startedAt), 12_000);
      await frame.locator("#var1").waitFor();
      const timer = learner.locator("#participantRouteTestletTimer");
      await timer.waitFor();

      if (resumes) {
        await participantHttpActor.goto(learner,
          `${baseUrl}/participant?participantSessionId=${encodeURIComponent(sessionId)}`,
          { waitUntil: "domcontentloaded" }
        );
        await frame.locator("#var1").waitFor();
        await timer.waitFor();
        const resumed = (await pollJson(stateUrl, ({ currentRunState }) =>
          currentRunState?.testRun?.testletTimers?.[timerKey]?.status === "running"
        )).currentRunState.testRun;
        assert.equal(resumed.testRunId, running.testRunId);
        assert.equal(resumed.testletTimers[timerKey].startedAt, start.startedAt);
        assert.equal(resumed.testletTimers[timerKey].expiresAt, start.expiresAt);
        assert.equal(resumed.bookletStates.level, "professional");
      }

      // Observe the actual browser handle expiry before asking the API for the final state.
      await timer.waitFor({ state: "hidden", timeout: 22_000 });
      await learner.locator("#participantRouteUnitKey").filter({ hasText: nextUnit }).waitFor();
      const expiredState = (await pollJson(stateUrl, ({ currentRunState }) =>
        currentRunState?.testRun?.testletTimers?.[timerKey]?.status === "expired"
      )).currentRunState;
      const expired = expiredState.testRun;
      assert.equal(expired.testRunId, running.testRunId);
      assert.equal(expired.currentUnitKey, nextUnit);
      assert.equal(expired.testletTimers[timerKey].remainingSeconds, 0);
      assert.equal(expired.bookletStates.level, "professional");
      assert.equal(expiredState.bookletUnits.find(unit => unit.unitKey === "professional-unit")?.isLocked, locked);
      for (const other of ["stage1-beginner", "stage1-advanced", "optional-block"]) {
        assert.ok(!Object.hasOwn(expired.testletTimers, other));
      }
      const branch = learner.locator('#participantRouteUnitRail [data-unit-key="professional-unit"]');
      assert.match(await branch.getAttribute("aria-label"), locked ? /, locked$/ : /, available$/);
      if (locked) {
        assert.equal(await branch.isDisabled(), true);
        const reopen = await fetch(`${baseUrl}/api/v1/participant/test-runs/${expired.testRunId}/save-progress`, {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ currentUnitKey: "professional-unit", status: "running" })
        });
        assert.equal(reopen.status, 409);
        const denial = await reopen.json();
        assert.equal(denial.error, "booklet_navigation_denied");
        assert.ok(denial.details.deniedReasons.includes("testlet_time_closed"));
        const audit = await fetch(`${workspaceUrl}/test-logs?testRunId=${encodeURIComponent(expired.testRunId)}&limit=100`);
        assert.equal(audit.status, 200);
        const snapshots = (await audit.json()).items.map(item => item.testLog)
          .filter(log => log.logKey === "TESTLETS_TIMELEFT")
          .map(log => JSON.parse(log.logContent));
        assert.ok(snapshots.some(snapshot => snapshot[timerKey] === 0.2), "The log must record the authored 12-second budget in minutes.");
        assert.ok(snapshots.some(snapshot => snapshot[timerKey] === 0), "The log must record the exhausted budget.");
      }
      console.log(`adaptive_timer_expiry=${executionMode}:${nextUnit}:${locked ? "locked" : "advisory"}:passed`);
    } finally {
      await context.close();
    }
  }

  process.stdout.write(
    `Adaptive runtime browser smoke passed current routing and composed restrictions for store=${store}\n`
  );
} finally {
  await browser?.close();
  await stopChild(child);
}
