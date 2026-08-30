import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdir, readFile, rm } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import { dirname, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { brotliDecompressSync } from "node:zlib";

import { chromium } from "playwright";

const store = process.env.FIRST_SLICE_STORE ?? "sqlite";
const serverEntry = resolve("apps/api/dist/apps/api/src/index.js");
const ibRuntimeReadyTimeoutMs = 60_000;

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
        reject(new Error("Could not allocate an IB smoke port."));
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
  process.env.FIRST_SLICE_SQLITE_FILE ?? "./.data/ui-smoke-ib-player.sqlite"
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
  env: { ...process.env, PORT: String(port), FIRST_SLICE_STORE: store }
});
let browser;

try {
  await pollReady(`${baseUrl}/readyz`);
  browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const corpus = JSON.parse(
    await readFile("test-fixtures/original-testcenter/corpus.json", "utf8")
  );
  const playerPackage = corpus.veronaPlayerFamilyPackages.find(
    candidate => candidate.family === "IB ItemBuilder migration study"
  );
  assert.ok(playerPackage);

  const [playerDocument, definitionDocument, resourcePackage] =
    await Promise.all([
      readBrotliBase64Text(
        resolve("test-fixtures/original-testcenter", playerPackage.playerFixture)
      ),
      readFile(
        resolve("test-fixtures/original-testcenter", playerPackage.definitionFixture),
        "utf8"
      ),
      readFile(
        resolve("test-fixtures/original-testcenter", playerPackage.resourceFixture),
        "utf8"
      ).then(encoded => Buffer.from(encoded.trim(), "base64"))
    ]);

  const suffix = Date.now();
  const tenantKey = `ib-smoke-${suffix}`;
  const workspaceKey = `ib-smoke-${suffix}`;
  const bookletKey = "BOOKLET.OFFICIAL.IB-0.2";
  const unitKey = "UNIT.OFFICIAL.IB-SIMPLE";
  const loginKey = "student-official-ib";
  const sourcePackage = createStoredZipBuffer([
    {
      fileName: "export/imsmanifest.xml",
      content: `<manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"><resources><resource identifier="${bookletKey}" href="booklets/Booklet.xml" /><resource identifier="${unitKey}" href="units/Simple.xml" /><resource identifier="${playerPackage.playerKey}" href="players/player.html" /><resource identifier="${playerPackage.requiredResourceId}" href="resources/IB_SAMPLE_2025.itcr.zip" /></resources></manifest>`
    },
    {
      fileName: "export/booklets/Booklet.xml",
      content: `<Booklet><Metadata><Id>${bookletKey}</Id><Label>Official IB ItemBuilder migration study</Label></Metadata><Units><Unit id="${unitKey}" label="IB Simple sample" /></Units></Booklet>`
    },
    {
      fileName: "export/units/Simple.xml",
      content: `<Unit><Metadata><Id>${unitKey}</Id><Label>IB Simple sample</Label></Metadata><Definition player="${playerPackage.playerKey}"><![CDATA[${definitionDocument}]]></Definition><Dependencies><File for="player">${playerPackage.requiredResourceId}</File></Dependencies></Unit>`
    },
    { fileName: "export/players/player.html", content: playerDocument },
    {
      fileName: "export/resources/IB_SAMPLE_2025.itcr.zip",
      content: resourcePackage
    }
  ]);

  await sendJson(`${baseUrl}/api/v1/platform/tenants`, {
    tenantKey,
    displayName: "IB player smoke"
  });
  await sendJson(`${baseUrl}/api/v1/tenants/${tenantKey}/workspaces`, {
    workspaceKey,
    displayName: "IB player smoke"
  });
  const workspaceUrl =
    `${baseUrl}/api/v1/tenants/${tenantKey}/workspaces/${workspaceKey}`;
  const sourceResponse = await sendJson(`${workspaceUrl}/source-packages`, {
    fileName: "official-ib-browser-smoke.zip",
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
  await sendJson(
    `${workspaceUrl}/content-releases/${importPayload.stagedContentRelease.contentReleaseId}/activate`,
    {}
  );
  await sendJson(`${workspaceUrl}/participant-roster`, {
    rosterText: [
      {
        loginKey,
        groupKey: "group:official-ib",
        bookletKey,
        displayName: "Official IB ItemBuilder Participant",
        executionMode: "run-hot-return"
      }
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
    .filter({ hasText: `API ${playerPackage.playerApiVersion}` })
    .waitFor({ timeout: ibRuntimeReadyTimeoutMs });
  const runtimeFrame = page
    .frameLocator("#participantVeronaPlayerFrame")
    .frameLocator("#ib-runtime-host");
  await runtimeFrame.locator("html").waitFor({
    timeout: ibRuntimeReadyTimeoutMs
  });
  assert.equal(
    await runtimeFrame.locator("html").evaluate(() =>
      Boolean(
        document.querySelector(
          'script[data-testcenter-compatibility="dipf-opaque-parent-origin"]'
        )
      )
    ),
    true
  );
  await runtimeFrame.locator("input, textarea, button").first().waitFor({
    state: "visible",
    timeout: ibRuntimeReadyTimeoutMs
  });
  assert.equal(await runtimeFrame.locator("input[type='checkbox']").count(), 1);
  assert.equal(await runtimeFrame.locator("input[type='text']").count(), 1);
  assert.deepEqual(
    await runtimeFrame.locator("button").allTextContents(),
    ["Next Task", "Cancel Task"]
  );
  const participantSessionId = await page
    .locator("#participantRouteSessionId")
    .inputValue();
  assert.ok(participantSessionId);
  await runtimeFrame
    .getByText("CheckBoxA", { exact: true })
    .evaluate(element => element.click());
  assert.equal(
    await runtimeFrame.locator("input[type='checkbox']").isChecked(),
    true
  );
  const responseText = "7";
  await runtimeFrame
    .locator("input[type='text']")
    .evaluate(element => element.focus());
  await page.keyboard.type(responseText);
  await page.keyboard.press("Tab");
  const stateDeadline = Date.now() + 10_000;
  let savedUnitResponse = "";
  while (!savedUnitResponse && Date.now() < stateDeadline) {
    await delay(250);
    const currentStateResponse = await fetch(
      `${baseUrl}/api/v1/participant/sessions/${participantSessionId}/current-state`
    );
    assert.equal(currentStateResponse.status, 200);
    const currentState = await currentStateResponse.json();
    savedUnitResponse =
      currentState.currentRunState.testRun.unitResponses[unitKey] ?? "";
  }
  assert.ok(savedUnitResponse, "The IB runtime response should be persisted.");
  const savedUnitState = JSON.parse(savedUnitResponse).unitState;
  assert.equal(savedUnitState.unitStateDataType, "iqb-standard@1.4");
  const savedVariables = JSON.parse(savedUnitState.dataParts.variables);
  assert.equal(savedVariables.find(variable => variable.id === "VarA")?.value, 0);
  const savedScores = JSON.parse(savedUnitState.dataParts.scores);
  assert.ok(
    savedScores.find(score => score.id === "nbUserInteractions")?.value >= 2
  );

  await page.goto(
    `${baseUrl}/participant?participantSessionId=${encodeURIComponent(
      participantSessionId
    )}`,
    { waitUntil: "domcontentloaded" }
  );
  const restoredRuntimeFrame = page
    .frameLocator("#participantVeronaPlayerFrame")
    .frameLocator("#ib-runtime-host");
  await restoredRuntimeFrame.locator("input[type='text']").waitFor({
    state: "visible",
    timeout: ibRuntimeReadyTimeoutMs
  });
  const restoredStateResponse = await fetch(
    `${baseUrl}/api/v1/participant/sessions/${participantSessionId}/current-state`
  );
  assert.equal(restoredStateResponse.status, 200);
  const restoredState = await restoredStateResponse.json();
  assert.equal(
    restoredState.currentRunState.testRun.unitResponses[unitKey],
    savedUnitResponse
  );
  process.stdout.write(
    `IB player smoke passed interactive state capture and reload for store=${store}\n`
  );
} finally {
  await browser?.close();
  await stopChild(child);
}
