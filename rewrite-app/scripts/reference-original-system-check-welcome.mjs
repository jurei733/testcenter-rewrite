import assert from "node:assert/strict";
import { createServer } from "node:http";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import { resolve, relative, extname, join } from "node:path";
import { chromium } from "playwright";
// Unmodified Source on the same owned acknowledgement check as the rewrite gate.
const root = resolve(process.env.ORIGINAL_PLAYER_REFERENCE_ROOT);
const artifacts = resolve(process.env.UI_SMOKE_ARTIFACT_DIR);
assert.ok(process.env.ORIGINAL_PLAYER_REFERENCE_COMMIT);
await mkdir(artifacts, { recursive: true });
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, "http://localhost").pathname;
    const file = resolve(root, extname(pathname) ? `.${pathname}` : "index.html");
    if (relative(root, file).startsWith("..")) return response.writeHead(404).end();
    response.setHeader("content-type", { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml", ".woff2": "font/woff2", ".png": "image/png" }[extname(file)] || "application/octet-stream");
    response.end(await readFile(file));
  } catch { response.writeHead(404).end(); }
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const base = `http://127.0.0.1:${server.address().port}`;
const browser = await chromium.launch({ headless: false });
const measurements = {}, errors = [], unknown = [];
try {
  for (const theme of ["Primar", "Sekundar", "Erwachsene"]) {
    const context = await browser.newContext({ viewport: { width: 1280, height: 720 } }), page = await context.newPage();
    page.on("pageerror", error => errors.push(String(error)));
    await context.route(`${base}/api/**`, async route => {
      const request = route.request(), pathname = new URL(request.url()).pathname;
      assert.equal(request.method(), "GET", "This Source welcome capture never sends a report.");
      let body;
      if (pathname === "/api/system/config") body = { version: "Owned Source reference", customTexts: {}, appConfig: { themeName: theme, appTitle: "IQB-Testcenter" },
        veronaPlayerApiVersionMin: 2, veronaPlayerApiVersionMax: 6, iqbStandardResponseTypeMin: 1, iqbStandardResponseTypeMax: 5,
        xmlSchemaVersions: {}, bruteForceProtection: [], broadcastingServiceUri: "", fileServiceUri: "", passwordMinLength: 0, passwordPattern: "" };
      else if (pathname === "/api/sys-check-mode") body = false;
      else if (pathname === "/api/asset-assignments") body = {};
      else if (pathname === "/api/assets") body = [];
      else if (pathname === "/api/workspace/1/sys-check/ACK.SAMPLE") body = {
        name: "ACK.SAMPLE", label: "Systemcheck acknowledgement", workspaceId: 1,
        hasUnit: false, skipNetwork: true, canSave: true, customTexts: [], downloadSpeed: {}, uploadSpeed: {},
        questions: [{ id: "feedback", type: "string", prompt: "Feedback", required: true, value: "", options: [] }] };
      else if (pathname === "/api/system/time") body = { timestamp: Date.now(), timezone: "UTC" };
      else { unknown.push(pathname); return route.fulfill({ status: 404, body: "{}" }); }
      return route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
    });
    await page.goto(`${base}/#/check/1/ACK.SAMPLE/w`, { waitUntil: "networkidle" });
    await page.locator("mat-card td").first().waitFor();
    assert.equal(await page.locator("mat-card").count(), 2);
    assert.equal(await page.locator("#syscheck-previous-step").isDisabled(), true);
    for (const [screen, width, height] of [["desktop", 1280, 720], ["mobile", 390, 844], ["toolbar-small", 599, 844], ["toolbar-large", 600, 844]]) {
      await page.setViewportSize({ width, height });
      await page.evaluate(() => document.fonts.ready);
      await page.screenshot({ animations: "disabled", path: join(artifacts, `${theme}-${screen}.png`), fullPage: true });
      measurements[`${theme}-${screen}`] = await page.evaluate(() => {
        const button = document.querySelector("#syscheck-previous-step"), header = button.parentElement, icon = button.querySelector("svg");
        const title = document.querySelector("tc-header h1"), titleStyle = getComputedStyle(title), titleBounds = title.getBoundingClientRect();
        const toolbar = document.querySelector("tc-header mat-toolbar").getBoundingClientRect(), logo = document.querySelector("tc-header img").getBoundingClientRect();
        return { width: header.getBoundingClientRect().width, color: getComputedStyle(header).color,
          backgrounds: [...document.querySelectorAll("mat-card")].map(card => getComputedStyle(card).backgroundColor),
          disabled: button.disabled, opacity: getComputedStyle(button).opacity,
          iconSize: [icon.getBoundingClientRect().width, icon.getBoundingClientRect().height],
          tableSizing: getComputedStyle(document.querySelector("td")).boxSizing, topbarHeight: toolbar.height,
          logoSize: [logo.width, logo.height], titleTypography: [titleStyle.fontFamily, titleStyle.fontSize, titleStyle.lineHeight],
          titleCentered: Math.abs(titleBounds.x + titleBounds.width / 2 - toolbar.x - toolbar.width / 2) < .01 &&
            Math.abs(titleBounds.y + titleBounds.height / 2 - toolbar.y - toolbar.height / 2) < .01 };
      });
      console.log(`source_system_check_welcome=${theme}/${screen}:passed`);
    }
    await context.close();
  }
  assert.deepEqual(errors, []); assert.deepEqual(unknown, []);
} finally {
  await writeFile(join(artifacts, "welcome.json"), JSON.stringify({ measurements, errors, unknown,
    callerVerifiedReferenceCommit: process.env.ORIGINAL_PLAYER_REFERENCE_COMMIT }, null, 2));
  await browser.close(); await new Promise(done => server.close(done));
}
