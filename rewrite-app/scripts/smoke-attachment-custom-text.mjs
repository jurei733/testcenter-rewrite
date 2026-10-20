import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { PDFDocument } from "pdf-lib";
import QRCode from "qrcode";
import ts from "typescript";
import { localDemoSourcePackage } from "../apps/api/dist/apps/api/src/local-demo-bootstrap.js";
import { createSmokeRouteFailureGate } from "./smoke-route-failure-gate.mjs";

const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const within = async (promise, description) => {
  let timeout;
  try { return await Promise.race([promise, new Promise((_, reject) => { timeout = setTimeout(() => reject(Error(description)), 15_000); })]); }
  finally { clearTimeout(timeout); }
};

// Real operator login, production Angular, owned SQLite, actual scoped downloads.
// This checks text/transport semantics, not complete Original page geometry.
const root = resolve(process.env.UI_SMOKE_FRONTEND_ROOT || ".");
await access(join(root, "dist/apps/web/browser/index.html"));
const artifacts = await mkdtemp(join(tmpdir(), "testcenter-attachment-text-"));
process.stdout.write(`owned_artifacts=${artifacts}\n`);
const moduleUrl = pathToFileURL(resolve("apps/api/dist/apps/api/src/index.js")).href;
const server = spawn(process.execPath, ["--input-type=module", "-e", `
  import { createProductionApiServer } from ${JSON.stringify(moduleUrl)};
  const server = await createProductionApiServer();
  server.listen(0, '127.0.0.1', () => process.send({ port: server.address().port }));
  process.once('SIGTERM', () => server.close(() => process.exit(0)));
`], { cwd: root, stdio: ["ignore", "ignore", "pipe", "ipc"], env: {
  ...process.env, FIRST_SLICE_STORE: "sqlite", FIRST_SLICE_SQLITE_FILE: join(artifacts, "store.sqlite"),
  FIRST_SLICE_BOOTSTRAP_DEMO: "true", FIRST_SLICE_OPERATOR_AUTH_REQUIRED: "true",
  FIRST_SLICE_PROOF_OF_WORK_SCOPES: "", FIRST_SLICE_XML_SCHEMA_PROFILE: "original-19"
} });
let log = ""; server.stderr.on("data", value => { log += value; });
const closed = new Promise(done => server.once("close", done));
const helpersSource = ts.transpileModule(await readFile(new URL("../apps/web/src/app/attachment-custom-texts.ts", import.meta.url), "utf8"), {
  compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }
}).outputText;
const { originalAttachmentTextFallbacks: defaults } = await import(`data:text/javascript;base64,${Buffer.from(helpersSource).toString("base64")}`);
let browser, baseUrl, token;
const api = async (path, body, method = body === undefined ? "GET" : "POST") => {
  const response = await fetch(baseUrl + path, { method, headers: {
    ...(body === undefined ? {} : { "content-type": "application/json" }), ...(token ? { authorization: `Bearer ${token}` } : {})
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  assert.ok(response.ok, `${method} ${path}: ${response.status}`);
  return response.status === 204 ? null : response.json();
};
const errors = [];
try {
  const port = await new Promise((done, reject) => {
    const timeout = setTimeout(() => reject(Error("Owned API startup timeout")), 20_000);
    server.once("message", value => { clearTimeout(timeout); done(value.port); });
    server.once("error", error => { clearTimeout(timeout); reject(error); });
    server.once("exit", () => { clearTimeout(timeout); reject(Error("Owned API exited before ready")); });
  });
  baseUrl = `http://127.0.0.1:${port}`;
  token = (await api("/api/v1/admin/auth/sign-in", { username: "demo-admin", password: "demo-admin-password" })).sessionToken;
  const workspaceKey = "owned-attachment-text", scope = `/api/v1/tenants/demo-tenant/workspaces/${workspaceKey}`;
  await api("/api/v1/tenants/demo-tenant/workspaces", { workspaceKey, displayName: "Owned attachment text" });
  const content = JSON.parse(localDemoSourcePackage.sourceDocument);
  const booklet = content.bookletEntries[0];
  booklet.unitEntries = [{ ...booklet.unitEntries[0], requestedAttachments: [{ variableId: "own-photo", attachmentType: "capture-image" }] }];
  const source = await api(scope + "/source-packages", { fileName: "owned.json", mediaType: "application/json", contentStructure: content });
  const imported = await api(scope + "/import-jobs", { sourcePackageId: source.sourcePackage.sourcePackageId });
  await api(`${scope}/content-releases/${imported.stagedContentRelease.contentReleaseId}/activate`, { activatedByActorId: "owned-attachment-text" });
  await api(scope + "/participant-roster", { rosterText: [
    { loginKey: "own-person", groupKey: "own-group", groupLabel: "Own Group", booklets: [{ id: booklet.bookletKey, codes: "own-suffix" }] },
    { loginKey: "foreign-person", groupKey: "foreign-group", bookletKey: booklet.bookletKey }
  ] });
  for (const [loginKey, groupKey, participantCode] of [["own-person", "own-group", "own-suffix"], ["foreign-person", "foreign-group", undefined]]) {
    await api("/api/v1/participant/starter:launch", { tenantKey: "demo-tenant", workspaceKey, loginKey, groupKey, participantCode, bookletKey: booklet.bookletKey });
  }
  const all = (await api(scope + "/attachments")).items;
  assert.equal(all.length, 2);
  const attachment = all.find(item => item.groupKey === "own-group"), foreign = all.find(item => item.groupKey === "foreign-group");
  assert.equal(attachment.participantCode, "own-suffix"); assert.equal(attachment.groupLabel, "Own Group");
  await api(`${scope}/attachments/${encodeURIComponent(attachment.attachmentId)}/files`, {
    fileName: "own.png", mediaType: "image/png", dataBase64: (await QRCode.toBuffer("owned-photo")).toString("base64")
  });
  const otherWorkspaceKey = "owned-attachment-other", otherScope = `/api/v1/tenants/demo-tenant/workspaces/${otherWorkspaceKey}`;
  await api("/api/v1/tenants/demo-tenant/workspaces", { workspaceKey: otherWorkspaceKey, displayName: "Other owned attachment scope" });
  const otherSource = await api(otherScope + "/source-packages", { fileName: "owned.json", mediaType: "application/json", contentStructure: content });
  const otherImport = await api(otherScope + "/import-jobs", { sourcePackageId: otherSource.sourcePackage.sourcePackageId });
  await api(`${otherScope}/content-releases/${otherImport.stagedContentRelease.contentReleaseId}/activate`, { activatedByActorId: "owned-attachment-text" });
  await api(otherScope + "/participant-roster", { rosterText: [{ loginKey: "own-other", groupKey: "own-other-group", bookletKey: booklet.bookletKey }] });
  await api("/api/v1/participant/starter:launch", { tenantKey: "demo-tenant", workspaceKey: otherWorkspaceKey,
    loginKey: "own-other", groupKey: "own-other-group", bookletKey: booklet.bookletKey });
  const otherAttachment = (await api(otherScope + "/attachments")).items[0];
  assert.ok(otherAttachment); assert.notEqual(otherAttachment.attachmentId, attachment.attachmentId);
  const cases = [
    { name: "defaults", global: {}, local: {} },
    { name: "global", global: Object.fromEntries(Object.keys(defaults).map(key => [key, "Global " + key])), local: {} },
    { name: "empty-login", global: Object.fromEntries(Object.keys(defaults).map(key => [key, "Global " + key])), local: Object.fromEntries(Object.keys(defaults).map(key => [key, ""])) },
    { name: "padded-login", global: Object.fromEntries(Object.keys(defaults).map(key => [key, "Global " + key])), local: Object.fromEntries(Object.keys(defaults).map(key => [key, "  Eigene\nSeite Ω  "])) }
  ];
  browser = await chromium.launch({ headless: process.env.UI_SMOKE_HEADFUL !== "true",
    ...(process.env.UI_SMOKE_BROWSER_CHANNEL ? { channel: process.env.UI_SMOKE_BROWSER_CHANNEL } : {}) });
  for (const item of cases) {
    const global = { ...item.global, ...(item.name === "defaults" ? {} : { am_page_template_label: "Global %LOGIN%|%CODE%" }) };
    const local = { ...item.local, ...(item.name === "empty-login" ? { am_page_template_label: "" }
      : item.name === "padded-login" ? { am_page_template_label: "  %LOGIN%\n %CODE%  " } : {}) };
    await api("/api/v1/admin/application-settings", { customTexts: global }, "PATCH");
    const username = `own-attachment-${item.name}`, initialPassword = "owned-attachment-initial", password = "owned-attachment-password";
    await api("/api/v1/admin/users", { username, password: initialPassword, customTexts: local,
      roleAssignments: [{ role: "group_monitor", tenantKey: "demo-tenant", workspaceKey, groupKey: "own-group" },
        { role: "group_monitor", tenantKey: "demo-tenant", workspaceKey: otherWorkspaceKey, groupKey: "own-other-group" }] });
    const adminToken = token;
    token = (await api("/api/v1/admin/auth/sign-in", { username, password: initialPassword })).sessionToken;
    await api("/api/v1/admin/auth/password", { password }, "POST");
    token = adminToken;
    for (const mode of ["original", "rewrite"]) for (const width of [1280, 390]) {
      const context = await browser.newContext({ viewport: { width, height: 844 }, serviceWorkers: "block" });
      const page = await context.newPage(); page.on("pageerror", error => errors.push(String(error)));
      await page.goto(`${baseUrl}/app/runtime?ui=${mode}`, { waitUntil: "networkidle" });
      await page.locator("#adminUsername").fill(username); await page.locator("#adminPassword").fill(password);
      const signedIn = page.waitForResponse(response => new URL(response.url()).pathname === "/api/v1/admin/auth/sign-in" && response.ok());
      await page.locator("#adminSignInButton").click(); const identity = await (await signedIn).json();
      assert.deepEqual(identity.adminUser.customTexts, local);
      await page.locator("#monitorTenantKey").fill("demo-tenant"); await page.locator("#monitorWorkspaceKey").fill(workspaceKey);
      await page.locator("#monitorApplyScopeButton").click();
      await page.locator("#loadAttachmentsButton").click();
      const row = page.locator(`.attachment-row[data-attachment-id="${attachment.attachmentId}"]`);
      await row.waitFor(); assert.equal(await page.locator(".attachment-row").count(), 1);
      if (item.name === "defaults") {
        const arrived = deferred(), release = deferred(), gate = createSmokeRouteFailureGate();
        const endpoint = `${baseUrl}${scope}/attachments`;
        const handler = gate.wrap("old-workspace-attachment-list", async route => {
          const response = await route.fetch();
          try {
            assert.equal(response.status(), 200);
            assert.deepEqual((await response.json()).items.map(item => item.attachmentId), [attachment.attachmentId]);
            arrived.resolve(); await release.promise; await route.fulfill({ response });
          } finally { await response.dispose(); }
        });
        let primary;
        await page.route(endpoint, handler);
        try {
          await page.locator("#loadAttachmentsButton").click();
          await within(arrived.promise, "The exact old-workspace inventory request never arrived");
          await page.locator("#monitorWorkspaceKey").fill(otherWorkspaceKey);
          await page.locator("#monitorApplyScopeButton").click();
          await page.locator("#attachmentEmptyState").waitFor();
          assert.equal(await page.locator("#loadAttachmentsButton").isEnabled(), true,
            "Changing workspace must release the old request's loading state before its reply");
          await page.locator("#loadAttachmentsButton").click();
          await page.locator(`.attachment-row[data-attachment-id="${otherAttachment.attachmentId}"]`).waitFor();
          release.resolve(); await gate.settle(); gate.assertHealthy();
          await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
          assert.equal(await row.count(), 0, "The late first-workspace list must not replace the second workspace");
          assert.equal(await page.locator(".attachment-row").count(), 1);
          assert.equal(await page.locator(".attachment-row").getAttribute("data-attachment-id"), otherAttachment.attachmentId);
        } catch (error) { primary = error; }
        finally { gate.beginCleanup(); release.resolve(); await gate.settle(); await page.unroute(endpoint, handler); }
        const failure = gate.failure(primary); if (failure) throw failure;
        await page.locator("#monitorWorkspaceKey").fill(workspaceKey); await page.locator("#monitorApplyScopeButton").click();
        await page.locator("#loadAttachmentsButton").click(); await row.waitFor();
        process.stdout.write(`attachment_scope=${mode}/${width}:passed\n`);
      }
      await row.click();
      const expected = (key, rewrite) => local[key] ?? global[key] ?? "";
      const text = (key, rewrite) => expected(key, rewrite) || (mode === "original" ? defaults[key] : rewrite);
      assert.equal(await page.locator('.attachment-side[data-attachment-type="capture-image"] code').textContent(),
        text("am_attachment_type_capture-image", "capture-image"));
      assert.equal(await page.locator("#openAttachmentCaptureButton").textContent(), text("am_capture_image", "Open camera capture"));
      assert.equal(await page.locator(".attachment-file-actions .danger").textContent(), text("am_button_delete_attachment", "Delete"));
      const template = local.am_page_template_label ?? global.am_page_template_label ?? "";
      const responsePromise = page.waitForResponse(response => new URL(response.url()).pathname.endsWith("/page.pdf"));
      const downloadPromise = page.waitForEvent("download");
      await page.locator("#downloadSelectedAttachmentPageButton").click();
      const response = await responsePromise, request = new URL(response.url());
      assert.equal(response.status(), 200); assert.equal(request.searchParams.get("layout"), mode);
      assert.equal(request.searchParams.get("labelTemplate"), template || (mode === "rewrite" ? "%TESTTAKER% | %BOOKLET% | %UNIT% | %VAR%" : null));
      const download = await downloadPromise;
      const pdf = await PDFDocument.load(await readFile(await download.path()));
      if (template && mode === "original") assert.equal(pdf.getTitle(), template.replaceAll("%LOGIN%", "own-person").replaceAll("%CODE%", "own-suffix"));
      const denied = await context.request.get(`${baseUrl}${scope}/attachments/${encodeURIComponent(foreign.attachmentId)}/page.pdf?layout=original`,
        { headers: { authorization: `Bearer ${identity.sessionToken}` } });
      assert.equal(denied.status(), 403, "The same authenticated group monitor cannot export another group's attachment"); await denied.dispose();
      await page.locator("#openAttachmentCaptureButton").click();
      await page.locator("#attachmentCaptureCard").waitFor();
      assert.equal(await page.locator("#attachmentCaptureCard h2").textContent(), text("am_capture_image", "Capture a printed page"));
      assert.equal((await page.locator(".capture-intro").textContent()).trim(), text("am_capture_image_instructions", "Align the printed page with the camera preview and its QR code with the highlighted box. Check the image, participant, booklet, unit and variable before uploading.").trim());
      assert.equal(await page.locator("#backToAttachmentManager").textContent(), text("am_goto_attachment_overview", "Back to Attachment Manager"));
      assert.equal(await page.locator("#toggleAttachmentFlashButton").textContent(), text("gm_flash_checkbox", "Turn flash on"));
      await page.screenshot({ path: join(artifacts, `${item.name}-${mode}-${width}.png`), fullPage: true });
      assert.deepEqual(errors, []); await context.close();
      process.stdout.write(`attachment_text=${item.name}/${mode}/${width}:passed\n`);
    }
  }
} finally {
  await browser?.close(); server.kill("SIGTERM"); await closed;
  await writeFile(join(artifacts, "api.log"), log);
}
