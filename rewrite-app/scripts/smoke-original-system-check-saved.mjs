import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

// This narrow browser regression always owns its database and API. In
// particular it never resets a caller-provided SQLite file or uses port 4311.
const frontendRoot = resolve(process.env.UI_SMOKE_FRONTEND_ROOT || ".");
await access(join(frontendRoot, "dist/apps/web/browser/index.html"));
const root = await mkdtemp(join(tmpdir(), "testcenter-original-system-check-saved-"));
process.stdout.write(`owned_artifacts=${root}\n`);
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
  cwd: frontendRoot,
  env: { ...process.env, PORT: String(port), FIRST_SLICE_STORE: "sqlite",
    FIRST_SLICE_SQLITE_FILE: join(root, "store.sqlite"), FIRST_SLICE_BOOTSTRAP_DEMO: "true",
    FIRST_SLICE_OPERATOR_AUTH_REQUIRED: "true", REQUIRE_LOGIN_PASSWORD: "false" },
  stdio: ["ignore", "ignore", "inherit"]
});
let browser;
try {
  const deadline = Date.now() + 20_000;
  while (true) {
    try { if ((await fetch(`${baseUrl}/readyz`)).ok) break; } catch { /* Starting. */ }
    if (server.exitCode !== null || Date.now() > deadline) throw new Error("Owned API did not become ready.");
    await delay(100);
  }
  let token;
  const api = async (path, body, method = body === undefined ? "GET" : "POST") => {
    const response = await fetch(`${baseUrl}${path}`, { method,
      headers: { ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(token ? { authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    assert.ok(response.ok, `${method} ${path}: ${response.status}`);
    return response.json();
  };
  token = (await api("/api/v1/admin/auth/sign-in", { username: "demo-admin", password: "demo-admin-password" })).sessionToken;
  assert.ok(token);
  await api("/api/v1/platform/tenants", { tenantKey: "ack-tenant", displayName: "Owned acknowledgement gate" });
  await api("/api/v1/tenants/ack-tenant/workspaces", { workspaceKey: "ack-workspace", displayName: "Owned acknowledgement gate" });
  const workspace = "/api/v1/tenants/ack-tenant/workspaces/ack-workspace";
  const source = await api(`${workspace}/source-packages`, {
    fileName: "Acknowledgement.xml", mediaType: "application/xml",
    sourceDocument: '<SysCheck xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/testcenter-syscheck-xml/18.0"><Metadata><Id>ACK.SAMPLE</Id><Label>Systemcheck acknowledgement</Label></Metadata><Config skipnetwork="true" savekey="ack-save"><Q id="feedback" type="string" prompt="Feedback" required="true"/></Config></SysCheck>'
  });
  const imported = await api(`${workspace}/import-jobs`, { sourcePackageId: source.sourcePackage.sourcePackageId });
  assert.equal(imported.importJob.status, "completed");
  const headful = ["1", "true", "yes", "on"].includes(String(process.env.UI_SMOKE_HEADFUL || "").toLowerCase());
  browser = await chromium.launch({ headless: process.env.CI === "true" && !headful });
  for (const [theme, closeAction] of [["Primar", "cancel"], ["Sekundar", "confirm"], ["Erwachsene", "escape"]]) {
    await api("/api/v1/admin/application-settings", { themeName: theme }, "PATCH");
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
    const page = await context.newPage();
    const errors = [];
    page.on("pageerror", error => errors.push(String(error)));
    page.on("console", message => { if (message.type() === "error" && /NG\d{4}/u.test(message.text())) errors.push(message.text()); });
    await page.goto(`${baseUrl}/app/system-check?ui=original&tenantKey=ack-tenant&workspaceKey=ack-workspace&checkId=ACK.SAMPLE`, { waitUntil: "networkidle" });
    await page.locator("#originalSystemCheckWelcome").waitFor();
    await page.evaluate(() => document.fonts.ready);
    // Values verified against the unmodified 19.0 frontend, not a screenshot
    // of this adaptation. Scope the assertions to the matched welcome state.
    for (const [screen, width, height] of [["desktop", 1280, 720], ["mobile", 390, 844], ["toolbar-small", 599, 844], ["toolbar-large", 600, 844]]) {
      await page.setViewportSize({ width, height });
      const appearance = await page.locator("app-original-system-check-content").evaluate(element => {
        const header = element.querySelector(".header");
        const button = element.querySelector("#syscheck-previous-step");
        const icon = button.querySelector("svg");
        const cards = [...element.querySelectorAll("mat-card")];
        const title = document.querySelector("#participantApplicationHeader h1");
        const titleStyle = getComputedStyle(title);
        const titleBounds = title.getBoundingClientRect();
        const toolbar = document.querySelector("#participantApplicationHeader").getBoundingClientRect();
        const logo = document.querySelector("#participantApplicationHeader img").getBoundingClientRect();
        return { width: header.getBoundingClientRect().width,
          color: getComputedStyle(header).color,
          backgrounds: cards.map(card => getComputedStyle(card).backgroundColor),
          disabled: button.disabled, opacity: getComputedStyle(button).opacity,
          iconSize: [icon.getBoundingClientRect().width, icon.getBoundingClientRect().height],
          tableSizing: getComputedStyle(element.querySelector("td")).boxSizing,
          topbarHeight: toolbar.height,
          logoSize: [logo.width, logo.height],
          titleTypography: [titleStyle.fontFamily, titleStyle.fontSize, titleStyle.lineHeight],
          titleCentered: Math.abs(titleBounds.x + titleBounds.width / 2 - toolbar.x - toolbar.width / 2) < .01
            && Math.abs(titleBounds.y + titleBounds.height / 2 - toolbar.y - toolbar.height / 2) < .01 };
      });
      assert.deepEqual(appearance, { width, color: "rgb(25, 28, 29)",
        backgrounds: ["rgb(255, 255, 255)", "rgb(255, 255, 255)"], disabled: true,
        opacity: "1", iconSize: [24, 24], tableSizing: "content-box",
        topbarHeight: width < 600 ? 56 : 64,
        logoSize: width < 600 ? [92.8671875, 40] : [111.4375, 48],
        titleTypography: ['"Nunito Sans"', "22px", "28px"], titleCentered: true });
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
      await page.screenshot({ path: join(root, `${theme}-welcome-${screen}.png`), fullPage: true });
    }
    await page.setViewportSize({ width: 1280, height: 720 });
    await page.locator("#syscheck-next-step").click();
    await page.locator("#originalSystemCheckQuestionnaire").waitFor();
    await page.getByRole("textbox", { name: "Feedback", exact: true }).fill(`Owned ${theme} response`);
    await page.locator("#syscheck-next-step").click();
    await page.locator("#originalSystemCheckReport").waitFor();
    await page.bringToFront();
    await page.locator("#saveSystemCheckReportButton").click();
    await page.locator("#systemCheckSaveReportKey").fill("ack-save");
    await page.locator("#systemCheckSaveReportId").fill(`Owned ${theme} acknowledgement`);
    const posted = page.waitForResponse(response => response.request().method() === "POST" && new URL(response.url()).pathname.endsWith("/system-checks/ACK.SAMPLE/reports"));
    await page.locator("#systemCheckSaveReportConfirmButton").click();
    assert.equal((await posted).status(), 201);
    const dialog = page.locator(".original-system-check-saved-dialog");
    await dialog.waitFor();
    await dialog.evaluate(element => Promise.all(element.getAnimations({ subtree: true }).map(animation => animation.finished.catch(() => undefined))));
    const labels = theme === "Primar" ? ["Abbrechen", "Bestätigen"] : ["Bestätigen", "Abbrechen"];
    assert.deepEqual(await dialog.getByRole("button").allTextContents(), labels);
    assert.equal(await page.locator("#globalConfirmationBackdrop").count(), 0);
    // CDK installs the native focus trap asynchronously after the overlay
    // opens. Wait for that behavior; never move focus in the test itself.
    await page.waitForFunction(() => Boolean(document.activeElement?.closest(".original-system-check-saved-dialog")), undefined, { timeout: 5_000 });
    assert.equal(await page.evaluate(() => Boolean(document.activeElement?.closest(".original-system-check-saved-dialog"))), true);
    await page.keyboard.press("Tab");
    assert.equal(await dialog.getByRole("button", { name: labels[0], exact: true }).evaluate(element => element === document.activeElement), true);
    await page.keyboard.press("Shift+Tab");
    assert.equal(await dialog.getByRole("button", { name: labels[1], exact: true }).evaluate(element => element === document.activeElement), true);
    await page.screenshot({ path: join(root, `${theme}-desktop.png`), fullPage: true });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    const bounds = await dialog.boundingBox();
    assert.ok(bounds && bounds.x >= 0 && bounds.x + bounds.width <= 390 && bounds.y >= 0 && bounds.y + bounds.height <= 844);
    await page.screenshot({ path: join(root, `${theme}-mobile.png`), fullPage: true });
    if (closeAction === "escape") await page.keyboard.press("Escape");
    else await page.locator(closeAction === "cancel" ? "#globalConfirmationCancelButton" : "#globalConfirmationConfirmButton").click();
    await page.waitForURL(url => url.pathname === "/app/home");
    assert.deepEqual(errors, []);
    await context.close();
    process.stdout.write(`original_acknowledgement=${theme}/${closeAction}:passed\n`);
  }
  const reports = await api(`${workspace}/system-check-reports?checkId=ACK.SAMPLE`);
  assert.equal(reports.items.length, 3);
  for (const theme of ["Primar", "Sekundar", "Erwachsene"]) {
    const report = reports.items.find(item => item.title === `Owned ${theme} acknowledgement`);
    assert.ok(report);
    assert.ok(report.questionnaire.some(entry => entry.value === `Owned ${theme} response`));
  }
  process.stdout.write("Original acknowledgement: three real saves retained, no Angular page errors.\n");
} finally {
  await browser?.close().catch(() => undefined);
  if (server.exitCode === null) {
    const stopped = new Promise(done => server.once("exit", done));
    server.kill("SIGTERM");
    await Promise.race([stopped, delay(5_000)]);
    if (server.exitCode === null) { server.kill("SIGKILL"); await stopped; }
  }
  process.stdout.write("owned_api=shutdown\n");
}
