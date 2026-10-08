import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtemp, readFile } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { brotliDecompressSync } from "node:zlib";
import { chromium } from "playwright";

// Build into a fresh owned directory: never replace another runtime's frontend
// or reset a caller-supplied database while checking Angular's dev-mode guards.
const root = await mkdtemp(join(tmpdir(), "testcenter-verona-development-"));
const appRoot = resolve(".");
const run = (entry, args) => new Promise((done, reject) => {
  const child = spawn(process.execPath, [entry, ...args], { stdio: "inherit" });
  child.once("error", reject);
  child.once("exit", code => code === 0 ? done() : reject(new Error(`Build exited ${code}.`)));
});
await run(resolve("node_modules/@angular/cli/bin/ng.js"), [
  "build", "rewrite-app-web", "--configuration", "development",
  "--output-path", join(root, "dist/apps/web")
]);

const crcTable = Array.from({ length: 256 }, (_, value) => {
  let crc = value;
  for (let bit = 0; bit < 8; bit += 1) crc = crc & 1 ? 0xedb88320 ^ crc >>> 1 : crc >>> 1;
  return crc >>> 0;
});
const createZip = entries => {
  const local = [], central = [];
  let offset = 0;
  for (const { fileName, content } of entries) {
    const name = Buffer.from(fileName), bytes = Buffer.from(content);
    let crc = 0xffffffff;
    for (const byte of bytes) crc = crcTable[(crc ^ byte) & 255] ^ crc >>> 8;
    crc = (crc ^ 0xffffffff) >>> 0;
    const header = Buffer.alloc(30 + name.length);
    header.writeUInt32LE(0x04034b50, 0); header.writeUInt16LE(20, 4);
    header.writeUInt16LE(0x0800, 6); header.writeUInt32LE(crc, 14);
    header.writeUInt32LE(bytes.length, 18); header.writeUInt32LE(bytes.length, 22);
    header.writeUInt16LE(name.length, 26); name.copy(header, 30);
    local.push(header, bytes);
    const directory = Buffer.alloc(46 + name.length);
    directory.writeUInt32LE(0x02014b50, 0); directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6); directory.writeUInt16LE(0x0800, 8);
    directory.writeUInt32LE(crc, 16); directory.writeUInt32LE(bytes.length, 20);
    directory.writeUInt32LE(bytes.length, 24); directory.writeUInt16LE(name.length, 28);
    directory.writeUInt32LE(offset, 42); name.copy(directory, 46); central.push(directory);
    offset += header.length + bytes.length;
  }
  const directory = Buffer.concat(central), end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0); end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10); end.writeUInt32LE(directory.length, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, directory, end]);
};
const port = await new Promise((done, reject) => {
  const listener = createServer();
  listener.once("error", reject);
  listener.listen(0, "127.0.0.1", () => {
    const address = listener.address();
    assert.ok(address && typeof address !== "string");
    listener.close(error => error ? reject(error) : done(address.port));
  });
});
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [resolve("apps/api/dist/apps/api/src/index.js")], {
  cwd: root, stdio: "inherit",
  env: { ...process.env, PORT: String(port), FIRST_SLICE_STORE: "sqlite",
    FIRST_SLICE_XML_SCHEMA_PROFILE: "legacy-compatibility",
    FIRST_SLICE_SQLITE_FILE: join(root, "store.sqlite"), FIRST_SLICE_BOOTSTRAP_DEMO: "true",
    FIRST_SLICE_OPERATOR_AUTH_REQUIRED: "true", REQUIRE_LOGIN_PASSWORD: "false" }
});
let browser, operatorToken;
const json = async (path, body, token = operatorToken) => {
  const response = await fetch(`${baseUrl}${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: { ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) })
  });
  assert.ok(response.ok, `HTTP ${response.status}: ${path}`);
  return response.json();
};
const poll = async action => {
  const deadline = Date.now() + 20_000;
  let lastError;
  while (Date.now() < deadline) {
    try { const result = await action(); if (result) return result; }
    catch (error) { lastError = error; }
    await delay(100);
  }
  throw lastError ?? new Error("Development Player condition did not become true.");
};
try {
  await poll(async () => (await fetch(`${baseUrl}/readyz`)).ok);
  operatorToken = (await json("/api/v1/admin/auth/sign-in", {
    username: "demo-admin", password: "demo-admin-password"
  }, null)).sessionToken;
  assert.ok(operatorToken);
  const corpus = JSON.parse(await readFile(resolve("test-fixtures/original-testcenter/corpus.json"), "utf8"));
  const fixture = corpus.veronaPlayerFamilyPackages.find(entry => entry.family === "ABI scripted survey");
  assert.ok(fixture);
  const fixtureRoot = resolve("test-fixtures/original-testcenter");
  const player = brotliDecompressSync(Buffer.from(await readFile(join(fixtureRoot, fixture.playerFixture), "utf8"), "base64")).toString("utf8");
  const definition = Buffer.from(await readFile(join(fixtureRoot, fixture.definitionFixture), "utf8"), "base64").toString("utf8");
  assert.equal(createHash("sha256").update(player).digest("hex"), fixture.playerSha256);
  assert.equal(createHash("sha256").update(definition).digest("hex"), fixture.definitionSha256);
  const tenantKey = "verona-development", workspaceKey = "verona-development";
  const bookletKey = "BOOKLET.DEV.ABI", unitKeys = ["UNIT.DEV.ABI.1", "UNIT.DEV.ABI.2"];
  const archive = createZip([
    { fileName: "export/imsmanifest.xml", content: `<manifest xmlns="http://www.imsglobal.org/xsd/imscp_v1p1"><resources><resource identifier="${bookletKey}" href="booklets/Booklet.xml" />${unitKeys.map((key, index) => `<resource identifier="${key}" href="units/Unit${index}.xml" />`).join("")}<resource identifier="${fixture.playerKey}" href="players/Player.html" /></resources></manifest>` },
    { fileName: "export/booklets/Booklet.xml", content: `<Booklet><Metadata><Id>${bookletKey}</Id><Label>Official ABI development regression</Label></Metadata><BookletConfig><Config key="toolbar_show_reload_button">TRUE</Config></BookletConfig><Units>${unitKeys.map(key => `<Unit id="${key}" label="${key}" />`).join("")}</Units></Booklet>` },
    ...unitKeys.map((key, index) => ({ fileName: `export/units/Unit${index}.xml`, content: `<Unit><Metadata><Id>${key}</Id><Label>${key}</Label></Metadata><Definition player="${fixture.playerKey}" type="${fixture.unitDefinitionType}"><![CDATA[${definition}]]></Definition></Unit>` })),
    { fileName: "export/players/Player.html", content: player }
  ]);
  await json("/api/v1/platform/tenants", { tenantKey, displayName: "Development smoke" });
  const tenantPath = `/api/v1/tenants/${tenantKey}`;
  await json(`${tenantPath}/workspaces`, { workspaceKey, displayName: "Development smoke" });
  const workspacePath = `${tenantPath}/workspaces/${workspaceKey}`;
  const source = await json(`${workspacePath}/source-packages`, { fileName: "abi-development.zip", mediaType: "application/zip", sourceDocument: `data:application/zip;base64,${archive.toString("base64")}` });
  const imported = await json(`${workspacePath}/import-jobs`, { sourcePackageId: source.sourcePackage.sourcePackageId });
  assert.equal(imported.importJob.status, "completed", JSON.stringify(imported.importJob.diagnostics));
  await json(`${workspacePath}/content-releases/${imported.stagedContentRelease.contentReleaseId}/activate`, {});
  await json(`${workspacePath}/participant-roster`, { rosterText: ["rewrite", "original"].map(layout => ({ loginKey: `abi-${layout}`, groupKey: "dev-regression", bookletKey, executionMode: "run-hot-return" })) });
  browser = await chromium.launch({ headless: process.env.UI_SMOKE_HEADFUL !== "true" });
  for (const layout of ["rewrite", "original"]) {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on("pageerror", error => errors.push(error.message));
    page.on("console", message => { if (message.type() === "error") errors.push(message.text()); });
    const clean = () => assert.deepEqual(errors, [], `No Angular/runtime errors in ${layout}.`);
    const ready = async () => {
      // Original deliberately hides the diagnostic label, not the real frame.
      await page.locator("#participantVeronaPlayerVersion").filter({ hasText: `API ${fixture.playerApiVersion}` }).waitFor({ state: "attached" });
      await page.frameLocator("#participantVeronaPlayerFrame").getByText("Abschnitt 1: Text und einfache Eingabe", { exact: true }).waitFor();
      clean();
    };
    const login = page.waitForResponse(response => response.ok() && /\/participant\/(auth\/sign-in|starter:launch)$/u.test(new URL(response.url()).pathname));
    await page.goto(`${baseUrl}/app/participant?${new URLSearchParams({ tenantKey, workspaceKey, loginKey: `abi-${layout}`, bookletKey, ui: layout })}`);
    const credentials = await (await login).json();
    const sessionId = credentials.participantSession.participantSessionId;
    const participantToken = credentials.sessionToken;
    assert.ok(participantToken);
    const state = () => json(`/api/v1/participant/sessions/${sessionId}/current-state`, undefined, participantToken);
    await ready();
    // Moving unchanged Player-only CSS out of the initial shell must preserve
    // its real layout, including Original's higher-specificity overrides.
    const playerCss = await readFile(resolve(appRoot, "apps/web/src/app/verona-player-host.component.css"), "utf8");
    const statusCss = await readFile(resolve(appRoot, "apps/web/src/app/participant-status-styles.component.css"), "utf8");
    for (const width of [1280, 390]) {
      await page.setViewportSize({ width, height: 900 });
      const comparison = await page.evaluate(css => {
        const selectors = [".verona-player-shell", ".verona-player-shell > header", ".verona-player-shell > footer",
          "#participantVeronaFrameHost", "#participantVeronaPlayerFrame", ".verona-player-page-navigation"];
        const properties = ["display", "position", "width", "height", "min-height", "padding", "gap",
          "border", "border-radius", "background-color", "color", "font-family", "overflow", "align-items", "justify-content"];
        const snapshot = () => selectors.map(selector => {
          const element = document.querySelector(selector);
          if (!element) return null;
          const computed = getComputedStyle(element);
          return Object.fromEntries(properties.map(property => [property, computed.getPropertyValue(property)]));
        });
        const movedStyles = [...document.head.querySelectorAll("style")].filter(style => style.textContent?.includes(".verona-player-shell"));
        const hostStyle = movedStyles.find(style => !style.textContent?.includes(".is-original-player"));
        if (!hostStyle) throw new Error("Player-only stylesheet must be delivered with the host");
        const actual = snapshot();
        const parent = hostStyle.parentNode, sibling = hostStyle.nextSibling;
        hostStyle.remove();
        const oldPlacement = document.createElement("style");
        oldPlacement.textContent = css;
        const initialStyles = document.head.querySelector("link[rel='stylesheet']");
        if (initialStyles) initialStyles.after(oldPlacement); else document.head.prepend(oldPlacement);
        const originalPlacement = snapshot();
        oldPlacement.remove();
        parent.insertBefore(hostStyle, sibling);
        return { actual, originalPlacement };
      }, playerCss);
      assert.deepEqual(comparison.actual, comparison.originalPlacement,
        `${layout} Player CSS remains identical at ${width}px after lazy delivery`);
      const statusComparison = await page.evaluate(css => {
        const elements = [...document.querySelectorAll(
          ".participant-draft-state, .participant-draft-state *, .participant-completion-readiness, .participant-completion-readiness *"
        )];
        if (elements.length === 0) throw new Error("Participant save/readiness widgets must be present");
        const properties = ["display", "position", "width", "height", "padding", "gap", "border", "border-radius",
          "background", "color", "font-family", "font-size", "font-weight", "text-transform"];
        const snapshot = () => elements.map(element => {
          const computed = getComputedStyle(element);
          return Object.fromEntries(properties.map(property => [property, computed.getPropertyValue(property)]));
        });
        const statusStyle = [...document.head.querySelectorAll("style")].find(style =>
          style.textContent?.includes(".participant-review-panel") && !style.textContent?.includes(".is-original-player"));
        if (!statusStyle) throw new Error("Status stylesheet must be delivered with the participant route");
        const actual = snapshot(), parent = statusStyle.parentNode, sibling = statusStyle.nextSibling;
        statusStyle.remove();
        const oldPlacement = document.createElement("style");
        oldPlacement.textContent = css;
        const initialStyles = document.head.querySelector("link[rel='stylesheet']");
        if (initialStyles) initialStyles.after(oldPlacement); else document.head.prepend(oldPlacement);
        const originalPlacement = snapshot();
        oldPlacement.remove();
        parent.insertBefore(statusStyle, sibling);
        const styleHost = document.querySelector("app-participant-status-styles");
        return { actual, originalPlacement, styleHostDisplay: styleHost ? getComputedStyle(styleHost).display : null };
      }, statusCss);
      assert.deepEqual(statusComparison.actual, statusComparison.originalPlacement,
        `${layout} save/readiness CSS remains identical at ${width}px after lazy delivery`);
      assert.equal(statusComparison.styleHostDisplay, "none", "Style delivery must not add a visible row or grid gap");
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }
    await page.setViewportSize({ width: 1280, height: 900 });
    const initial = (await state()).currentRunState;
    const runId = initial.testRun.testRunId;
    const frame = page.frameLocator("#participantVeronaPlayerFrame");
    await frame.locator("input:not([type])").first().fill("Abi-42");
    await frame.getByText("Sekundar I", { exact: true }).click();
    const saved = await poll(async () => {
      const current = (await state()).currentRunState;
      const response = current.testRun.unitResponses[unitKeys[0]];
      if (!response) return false;
      const answers = JSON.parse(JSON.parse(response).unitState.dataParts.allResponses);
      return answers.text_var1 === "Abi-42" && answers.mc_var1 === "2" ? current : false;
    });
    const exactResponse = saved.testRun.unitResponses[unitKeys[0]];
    if (layout === "original") await page.locator("#originalPlayerMoreButton").click();
    await Promise.all([
      page.waitForEvent("load"),
      page.locator(layout === "rewrite" ? "#participantRouteReloadButton" : "#originalPlayerReloadButton").click()
    ]);
    await ready();
    assert.equal(await page.frameLocator("#participantVeronaPlayerFrame").locator("input:not([type])").first().inputValue(), "Abi-42");
    await page.reload();
    await ready();
    assert.equal((await state()).currentRunState.testRun.testRunId, runId);
    const next = layout === "rewrite" ? "#participantRouteNextUnitButton" : "#originalUnitNavigation-forward";
    await page.locator(next).click();
    await poll(async () => (await state()).currentRunState.currentUnit.unitKey === unitKeys[1]);
    await ready();
    const previous = layout === "rewrite" ? "#participantRoutePreviousUnitButton" : "#originalUnitNavigation-backward";
    await page.locator(previous).click();
    await poll(async () => (await state()).currentRunState.currentUnit.unitKey === unitKeys[0]);
    await ready();
    const restored = (await state()).currentRunState;
    assert.equal(restored.testRun.testRunId, runId);
    assert.equal(restored.testRun.unitResponses[unitKeys[0]], exactResponse);
    assert.equal(await page.locator("#bugReportDialog").count(), 0);
    clean();
    await page.close();
    console.log(`PASS ABI Angular development lifecycle: ${layout}, load/save/reload/unit changes, exact saved response`);
  }
} finally {
  if (browser) await browser.close();
  if (server.exitCode === null && server.signalCode === null) {
    await new Promise(done => {
      const deadline = setTimeout(() => server.kill("SIGKILL"), 10_000);
      server.once("exit", () => { clearTimeout(deadline); done(); });
      server.kill("SIGTERM");
    });
  }
  console.log(`Development smoke artifacts retained in ${root}; shared dist and user databases were not changed.`);
}
