import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

const frontendRoot = resolve(process.env.UI_SMOKE_FRONTEND_ROOT || ".");
await access(join(frontendRoot, "dist/apps/web/browser/index.html"));
const root = await mkdtemp(join(tmpdir(), "testcenter-original-xsd-browser-"));
console.log(`owned_artifacts=${root}`);
const serverModule = pathToFileURL(resolve("apps/api/dist/apps/api/src/index.js")).href;
// The child binds port zero itself; closing a temporary allocator first races
// Chromium/parallel gates for that ephemeral port. Keep the real API factory.
const server = spawn(process.execPath, ["--input-type=module", "-e", `
  import { createProductionApiServer } from ${JSON.stringify(serverModule)};
  const server = await createProductionApiServer();
  server.listen(0, "127.0.0.1", () => process.send({ port: server.address().port }));
  process.once("SIGTERM", () => server.close(() => process.exit(0)));
`], {
  cwd: frontendRoot, stdio: ["ignore", "ignore", "inherit", "ipc"],
  env: { ...process.env, PORT: "4310", FIRST_SLICE_STORE: "sqlite",
    FIRST_SLICE_SQLITE_FILE: join(root, "store.sqlite"), FIRST_SLICE_BOOTSTRAP_DEMO: "true",
    FIRST_SLICE_OPERATOR_AUTH_REQUIRED: "true", FIRST_SLICE_XML_SCHEMA_PROFILE: "original-19",
    FIRST_SLICE_XML_SCHEMA_CACHE: resolve(process.env.FIRST_SLICE_XML_SCHEMA_CACHE || ".data/original-xml-schemas"),
    FIRST_SLICE_XML_SCHEMA_DOWNLOAD: "false" }
});
let browser, token, baseUrl;
const api = async (path, body, method = body === undefined ? "GET" : "POST") => {
  const response = await fetch(`${baseUrl}${path}`, { method,
    headers: { ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  assert.ok(response.ok, `${method} ${path}: ${response.status}`);
  return response.json();
};
try {
  const port = await new Promise((done, reject) => {
    const timeout = setTimeout(() => reject(Error("Owned strict-XSD API did not become ready.")), 20_000);
    server.once("error", error => { clearTimeout(timeout); reject(error); });
    server.once("exit", () => { clearTimeout(timeout); reject(Error("Owned strict-XSD API exited before readiness.")); });
    server.once("message", message => {
      clearTimeout(timeout);
      if (!Number.isInteger(message?.port) || message.port < 1) reject(Error("Invalid owned API address."));
      else done(message.port);
    });
  });
  baseUrl = `http://127.0.0.1:${port}`;
  assert.equal((await fetch(`${baseUrl}/readyz`)).status, 200);
  token = (await api("/api/v1/admin/auth/sign-in", { username: "demo-admin", password: "demo-admin-password" })).sessionToken;
  browser = await chromium.launch({ headless: process.env.CI === "true" && process.env.UI_SMOKE_HEADFUL !== "true" });
  for (const ui of ["rewrite", "original"]) {
    for (const [screen, width, height] of [["desktop", 1280, 720], ["mobile", 390, 844]]) {
      const fixture = `${ui}-${screen}`;
      const workspaceKey = `xsd-${fixture}`;
      const path = `/api/v1/tenants/demo-tenant/workspaces/${workspaceKey}`;
      await api("/api/v1/tenants/demo-tenant/workspaces", { workspaceKey, displayName: `Owned XSD ${fixture}` });
      const context = await browser.newContext({ viewport: { width, height } });
      const page = await context.newPage(); const errors = [];
      page.on("pageerror", error => errors.push(String(error)));
      await page.goto(`${baseUrl}/app/ops?ui=${ui}`, { waitUntil: "networkidle" });
      await page.locator("#adminUsername").fill("demo-admin");
      await page.locator("#adminPassword").fill("demo-admin-password");
      await page.locator("#adminSignInButton").click();
      await page.locator("#adminSignOutButton").waitFor();
      await page.locator('[data-view-nav="workspace"]').click();
      await page.locator("#tenantKey").fill("demo-tenant"); await page.locator("#tenantKey").dispatchEvent("change");
      await page.locator("#workspaceKey").fill(workspaceKey); await page.locator("#workspaceKey").dispatchEvent("change");
      await page.locator('[data-view-nav="content"]').click();
      await page.locator("#xmlSchemaProfileSummary").filter({ hasText: "Original Testcenter 19: XSD reference and schema validation required" }).waitFor();
      assert.equal(await page.locator("html").getAttribute("data-interface-mode"), ui);
      const schemaSource = (id, withSchema) => `<SysCheck xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" ${withSchema ? 'xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/testcenter-syscheck-xml/18.0"' : ""}><Metadata><Id>${id}</Id><Label>Owned strict browser check</Label></Metadata><Config skipnetwork="true"><Q id="feedback" type="string" prompt="Feedback"/></Config></SysCheck>`;
      const uploadFromUi = async (name, source) => {
        await page.locator("#sourceFileName").fill(name); await page.locator("#sourceFileName").dispatchEvent("change");
        await page.locator("#sourceMediaType").fill("application/xml"); await page.locator("#sourceMediaType").dispatchEvent("change");
        await page.locator("#sourceDocument").fill(source); await page.locator("#sourceDocument").dispatchEvent("change");
        const created = page.waitForResponse(response => response.url().endsWith(`${path}/source-packages`) && response.request().method() === "POST");
        await page.locator("#createSourcePackageButton").click();
        const upload = await created; assert.equal(upload.status(), 201);
        const id = (await upload.json()).sourcePackage.sourcePackageId;
        await page.waitForFunction(expected => document.querySelector("#sourcePackageId")?.value === expected, id);
        const imported = page.waitForResponse(response => response.url().endsWith(`${path}/import-jobs`) && response.request().method() === "POST");
        await page.locator("#createImportJobButton").click();
        const result = await imported; assert.equal(result.status(), 201);
        return result.json();
      };
      const rejected = await uploadFromUi("MISSING.SCHEMA.xml", schemaSource("MISSING.SCHEMA", false));
      assert.equal(rejected.importJob.status, "failed");
      assert.equal(rejected.stagedContentRelease, null);
      assert.ok(rejected.importJob.diagnostics.some(item => item.code === "testcenter_xml_schema_reference_missing"));
      await page.getByText("Original Testcenter SysCheck requires an XSD reference.", { exact: true }).first().waitFor();
      const accepted = await uploadFromUi("VALID.SCHEMA.xml", schemaSource("VALID.SCHEMA", true));
      assert.equal(accepted.importJob.status, "completed", JSON.stringify(accepted.importJob.diagnostics));
      assert.equal(accepted.stagedContentRelease, null);
      const stored = await api(`${path}/source-packages/${accepted.importJob.sourcePackageId}`);
      assert.equal(stored.sourcePackageDetail.sourcePackage.status, "accepted");
      const rejectedStored = await api(`${path}/source-packages/${rejected.importJob.sourcePackageId}`);
      assert.equal(rejectedStored.sourcePackageDetail.sourcePackage.status, "rejected");
      await page.screenshot({ path: join(root, `strict-xsd-${fixture}.png`), fullPage: true });
      assert.deepEqual(errors, []); await context.close();
      console.log(`strict_xsd=${fixture}:passed`);
    }
  }
} finally {
  await browser?.close(); server.kill("SIGTERM");
  await Promise.race([new Promise(done => server.once("exit", done)), delay(5_000)]);
  if (server.exitCode === null) server.kill("SIGKILL");
}
