import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdir, mkdtemp, readFile, rm } from "node:fs/promises";
import { createServer as createNetServer } from "node:net";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { brotliDecompressSync } from "node:zlib";

import { chromium } from "playwright";
import { createParticipantHttpTestActor } from "./participant-http-test-actor.mjs";
import { captureChromiumFrameDiagnostics, redactBrowserDiagnostic } from "./chromium-frame-diagnostics.mjs";
import { withChromiumIbRuntime } from "./chromium-ib-runtime.mjs";

const participantHttpActor = createParticipantHttpTestActor();
const fetch = participantHttpActor.fetch;

const store = process.env.FIRST_SLICE_STORE ?? "sqlite";
const serverEntry = resolve("apps/api/dist/apps/api/src/index.js");
const frontendRoot = resolve(process.env.UI_SMOKE_FRONTEND_ROOT || ".");
await access(join(frontendRoot, "dist/apps/web/browser/index.html"));
const artifacts = await mkdtemp(join(tmpdir(), "testcenter-ib-player-"));
process.stdout.write(`owned_artifacts=${artifacts}\n`);
const ibRuntimeReadyTimeoutMs = 60_000;
const interfaceMode = process.env.UI_SMOKE_INTERFACE === "original" ? "original" : "rewrite";
const recordResourceProof = (phase, resources) => process.stdout.write(
  `ib_browser_resource_proof=${JSON.stringify({ phase, interfaceMode,
    resources: [resources.document, resources.script].map(response => ({
      type: response.type, status: response.status, frameId: response.frameId,
      loaderId: response.loaderId, contentType: response.headers["content-type"],
      xFrameOptions: response.headers["x-frame-options"] ?? null,
      fromDiskCache: response.fromDiskCache, fromServiceWorker: response.fromServiceWorker
    })) })}\n`
);

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

let operatorToken;
const sendJson = async (url, body) => {
  const response = await fetch(url, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(operatorToken ? { authorization: `Bearer ${operatorToken}` } : {})
    },
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
  cwd: frontendRoot,
  stdio: "inherit",
  env: { ...process.env, PORT: String(port), FIRST_SLICE_STORE: store,
    FIRST_SLICE_XML_SCHEMA_PROFILE: process.env.FIRST_SLICE_XML_SCHEMA_PROFILE || "legacy-compatibility" }
});
let browser;
let context;
let page;
let participantOperatorCredentialLeaks = 0;

try {
  await pollReady(`${baseUrl}/readyz`);
  if (["1", "true", "yes", "on"].includes(String(process.env.FIRST_SLICE_OPERATOR_AUTH_REQUIRED || "").toLowerCase())) {
    const signedIn = await sendJson(`${baseUrl}/api/v1/admin/auth/sign-in`, {
      username: process.env.UI_SMOKE_ADMIN_USERNAME || "demo-admin",
      password: process.env.UI_SMOKE_ADMIN_PASSWORD || "demo-admin-password"
    });
    operatorToken = (await signedIn.json()).sessionToken;
    assert.ok(operatorToken, "Protected fixture setup requires a real operator session.");
  }
  const headful = ["1", "true", "yes", "on"].includes(String(process.env.UI_SMOKE_HEADFUL || "").toLowerCase());
  browser = await chromium.launch({ headless: process.env.CI === "true" && !headful,
    channel: process.env.UI_SMOKE_BROWSER_CHANNEL || undefined });
  process.stdout.write(`ib_browser_version=${browser.version()}, ui=${interfaceMode}, headful=${headful}\n`);
  context = await browser.newContext();
  await context.tracing.start({ screenshots: true, snapshots: true, sources: true });
  page = await context.newPage();
  page.on("request", request => {
    if (operatorToken && request.url().startsWith(`${baseUrl}/api/v1/participant/`) &&
        request.headers().authorization === `Bearer ${operatorToken}`) {
      participantOperatorCredentialLeaks += 1;
    }
  });
  page.on("pageerror", error => process.stderr.write(`ib_page_error=${redactBrowserDiagnostic(error)}\n`));
  page.on("requestfailed", request => {
    if (request.url().includes("/IB_SAMPLE_2025/")) {
      process.stderr.write(redactBrowserDiagnostic(`ib_resource_failure=${request.url()}: ${request.failure()?.errorText}\n`));
    }
  });
  participantHttpActor.observePage(page);
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
      bookletKey,
      ui: interfaceMode
    })}`,
    { waitUntil: "domcontentloaded" }
  );
  await page
    .locator("#participantVeronaPlayerVersion")
    .filter({ hasText: `API ${playerPackage.playerApiVersion}` })
    .waitFor({ state: interfaceMode === "original" ? "attached" : "visible", timeout: ibRuntimeReadyTimeoutMs });
  assert.equal(await page.locator("html").getAttribute("data-interface-mode"), interfaceMode);
  const participantSessionId = await page
    .locator("#participantRouteSessionId")
    .inputValue();
  assert.ok(participantSessionId);
  const beforeInputResources = await withChromiumIbRuntime(context, page, participantSessionId, async runtime => {
    await runtime.waitVisible("input[type=checkbox], input[type=text], button");
    const resources = await runtime.reloadResources();
    recordResourceProof("before-input", resources);
    return resources;
  }, ibRuntimeReadyTimeoutMs);
  process.stdout.write(`IB browser Document and Script downloads completed before input, ui=${interfaceMode}\n`);
  let foreignSessionVerified = false;
  await assert.rejects(withChromiumIbRuntime(context, page, `${participantSessionId}-foreign`, async () => {
    foreignSessionVerified = true;
  }), /selected participant Session/u);
  assert.equal(foreignSessionVerified, false);
  const responseText = "7";
  await withChromiumIbRuntime(context, page, participantSessionId, async runtime => {
    assert.equal(runtime.identity.frameId, beforeInputResources.document.frameId);
    assert.equal(runtime.identity.loaderId, beforeInputResources.document.loaderId);
    await runtime.waitVisible("html");
    await runtime.waitVisible("input, textarea, button");
    assert.equal(await runtime.evaluate("document.querySelectorAll('input[type=checkbox]').length"), 1);
    assert.equal(await runtime.evaluate("document.querySelectorAll('input[type=text]').length"), 1);
    assert.deepEqual(await runtime.evaluate("[...document.querySelectorAll('button')].map(button=>button.textContent)"),
      ["Next Task", "Cancel Task"]);
    assert.equal(await runtime.evaluate("[...document.querySelectorAll('span,label')].some(element=>element.textContent==='CheckBoxA')"), true);
    assert.equal(await runtime.evaluate("document.querySelector('input[type=checkbox]').checked"), false);
    await page.evaluate(() => {
      const rect = document.querySelector("#participantVeronaPlayerFrame").getBoundingClientRect();
      const cover = document.createElement("div"); cover.id = "ib-pointer-proof-cover";
      Object.assign(cover.style, { position: "fixed", left: `${rect.x}px`, top: `${rect.y}px`,
        width: `${rect.width}px`, height: `${rect.height}px`, zIndex: "2147483647", pointerEvents: "auto" });
      document.body.append(cover);
    });
    try {
      await assert.rejects(runtime.click("input[type=checkbox]"), /Player must not be covered/u);
      assert.equal(await runtime.evaluate("document.querySelector('input[type=checkbox]').checked"), false);
    } finally { await page.locator("#ib-pointer-proof-cover").evaluate(element => element.remove()); }
    await runtime.click("input[type=checkbox]");
    assert.equal(await runtime.evaluate("document.querySelector('input[type=checkbox]').checked"), true);
    await runtime.click("input[type=text]");
    await page.keyboard.type(responseText);
    await page.keyboard.press("Tab");
    assert.equal(await runtime.evaluate("document.querySelector('input[type=text]').value"), responseText);
    const events = await runtime.inputEvents();
    for (const inputType of ["checkbox", "text"]) assert.ok(events.some(event =>
      event.type === "input" && event.inputType === inputType && event.trusted),
    `The ${inputType} interaction must use a trusted actual browser event.`);
    await page.locator("#participantVeronaPlayerFrame").screenshot({ path: join(artifacts, "interactive-player.png") });
  }, ibRuntimeReadyTimeoutMs);
  const stateDeadline = Date.now() + 10_000;
  let savedUnitResponse = "";
  let capturedInteractions = false;
  while (!capturedInteractions && Date.now() < stateDeadline) {
    await delay(250);
    const currentStateResponse = await fetch(
      `${baseUrl}/api/v1/participant/sessions/${participantSessionId}/current-state`
    );
    assert.equal(currentStateResponse.status, 200);
    const currentState = await currentStateResponse.json();
    savedUnitResponse =
      currentState.currentRunState.testRun.unitResponses[unitKey] ?? "";
    // The Player reports data parts separately. An initial envelope or the
    // checkbox save can arrive before the text interaction's score part.
    const parts = savedUnitResponse
      ? JSON.parse(savedUnitResponse).unitState?.dataParts
      : null;
    if (
      typeof parts?.variables === "string" &&
      typeof parts?.scores === "string"
    ) {
      capturedInteractions = JSON.parse(parts.scores).some(
        score => score.id === "nbUserInteractions" && score.value >= 2
      );
    }
  }
  assert.ok(
    capturedInteractions,
    "The IB runtime must persist variables and scores for both interactions before reload."
  );
  const savedUnitState = JSON.parse(savedUnitResponse).unitState;
  assert.equal(savedUnitState.unitStateDataType, "iqb-standard@1.4");
  const savedVariables = JSON.parse(savedUnitState.dataParts.variables);
  assert.equal(savedVariables.find(variable => variable.id === "VarA")?.value, 0);
  const savedScores = JSON.parse(savedUnitState.dataParts.scores);
  assert.ok(
    savedScores.find(score => score.id === "nbUserInteractions")?.value >= 2
  );

  await participantHttpActor.goto(page,
    `${baseUrl}/participant?participantSessionId=${encodeURIComponent(
      participantSessionId
    )}`,
    { waitUntil: "domcontentloaded" }
  );
  const reEntryResources = await withChromiumIbRuntime(context, page, participantSessionId, async runtime => {
    await runtime.waitVisible("input[type=text]");
    const resources = await runtime.reloadResources();
    recordResourceProof("after-participant-re-entry", resources);
    return resources;
  }, ibRuntimeReadyTimeoutMs);
  process.stdout.write(`IB browser Document and Script downloads completed after participant re-entry, ui=${interfaceMode}\n`);
  await withChromiumIbRuntime(context, page, participantSessionId, async runtime => {
    assert.equal(runtime.identity.frameId, reEntryResources.document.frameId);
    assert.equal(runtime.identity.loaderId, reEntryResources.document.loaderId);
    await runtime.waitVisible("input[type=text]");
    assert.equal(await page.locator("html").getAttribute("data-interface-mode"), interfaceMode);
    await page.locator("#participantVeronaPlayerFrame").screenshot({ path: join(artifacts, "restored-player.png") });
  }, ibRuntimeReadyTimeoutMs);
  const restoredStateResponse = await fetch(
    `${baseUrl}/api/v1/participant/sessions/${participantSessionId}/current-state`
  );
  assert.equal(restoredStateResponse.status, 200);
  const restoredState = await restoredStateResponse.json();
  assert.equal(
    restoredState.currentRunState.testRun.unitResponses[unitKey],
    savedUnitResponse
  );
  assert.equal(participantOperatorCredentialLeaks, 0,
    "Participant browser requests must never carry the fixture operator credential.");
  process.stdout.write(
    `IB player smoke passed trusted input, rejected foreign/covered targets and exact reload for store=${store}, ui=${interfaceMode}\n`
  );
  await page.screenshot({ path: join(artifacts, "restored.png"), fullPage: true });
  await context.tracing.stop({ path: join(artifacts, "trace.zip") });
} catch (error) {
  if (page && context) await captureChromiumFrameDiagnostics(context, page,
    line => process.stderr.write(`${line}\n`)).catch(() => undefined);
  await page?.screenshot({ path: join(artifacts, "failure.png"), fullPage: true }).catch(() => undefined);
  await context?.tracing.stop({ path: join(artifacts, "failure-trace.zip") }).catch(() => undefined);
  throw error;
} finally {
  await browser?.close();
  await stopChild(child);
}
