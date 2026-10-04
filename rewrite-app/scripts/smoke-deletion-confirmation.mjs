import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

// Real API, owned disposable database, no private interactive-session writes.
const frontendRoot = resolve(process.env.UI_SMOKE_FRONTEND_ROOT || ".");
await access(join(frontendRoot, "dist/apps/web/browser/index.html"));
const root = await mkdtemp(join(tmpdir(), "testcenter-deletion-confirmation-"));
process.stdout.write(`owned_artifacts=${root}\n`);
const port = await new Promise((done, reject) => {
  const listener = createServer(); listener.once("error", reject);
  listener.listen(0, "127.0.0.1", () => {
    const address = listener.address(); assert.ok(address && typeof address !== "string");
    listener.close(error => error ? reject(error) : done(address.port));
  });
});
const baseUrl = `http://127.0.0.1:${port}`;
const server = spawn(process.execPath, [resolve("apps/api/dist/apps/api/src/index.js")], {
  cwd: frontendRoot,
  env: { ...process.env, PORT: String(port), FIRST_SLICE_STORE: "sqlite",
    FIRST_SLICE_SQLITE_FILE: join(root, "store.sqlite"), FIRST_SLICE_BOOTSTRAP_DEMO: "true",
    FIRST_SLICE_OPERATOR_AUTH_REQUIRED: "true" },
  stdio: ["ignore", "ignore", "inherit"]
});
let browser, token;
const password = "demo-admin-password", wrongPassword = "owned-wrong-confirmation-password";
const api = async (path, body, method = body === undefined ? "GET" : "POST") => {
  const response = await fetch(`${baseUrl}${path}`, { method,
    headers: { ...(body === undefined ? {} : { "content-type": "application/json" }),
      ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  assert.ok(response.ok, `${method} ${path}: ${response.status}`);
  return response.json();
};
try {
  const deadline = Date.now() + 20_000;
  while (true) {
    try { if ((await fetch(`${baseUrl}/readyz`)).ok) break; } catch { /* starting */ }
    if (server.exitCode !== null || Date.now() > deadline) throw Error("Owned deletion API did not become ready.");
    await delay(100);
  }
  token = (await api("/api/v1/admin/auth/sign-in", { username: "demo-admin", password })).sessionToken;
  const headful = ["1", "true", "yes", "on"].includes(String(process.env.UI_SMOKE_HEADFUL || "").toLowerCase());
  browser = await chromium.launch({ headless: process.env.CI === "true" && !headful });
  for (const ui of ["rewrite", "original"]) {
    for (const [screen, width, height] of [["desktop", 1280, 720], ["mobile", 390, 844]]) {
      const fixture = `${ui}-${screen}`;
      const workspaceKey = `delete-${fixture}`;
      const workspacePath = `/api/v1/tenants/demo-tenant/workspaces/${workspaceKey}`;
      await api("/api/v1/tenants/demo-tenant/workspaces", { workspaceKey, displayName: `Owned ${fixture}` });
      await api(`${workspacePath}/source-packages`, { fileName: "owned-delete-fixture.txt", mediaType: "text/plain", sourceDocument: "Retain until successful step-up" });
      const users = [];
      for (const number of [1, 2]) users.push(await api("/api/v1/admin/users", {
        username: `delete.${fixture}.${number}`, password: "owned-victim-password",
        roleAssignments: [{ role: "workspace_admin", tenantKey: "demo-tenant", workspaceKey }]
      }));
      const context = await browser.newContext({ viewport: { width, height } });
      const page = await context.newPage(); const errors = [], deletions = [];
      page.on("pageerror", error => errors.push(String(error)));
      page.on("response", response => { if (response.request().method() === "DELETE") deletions.push(response); });
      await page.goto(`${baseUrl}/app/ops?ui=${ui}`, { waitUntil: "networkidle" });
      await page.locator("#adminUsername").fill("demo-admin");
      await page.locator("#adminPassword").fill(password);
      await page.locator("#adminSignInButton").click();
      await page.locator("#adminSignOutButton").waitFor();
      await page.locator("#adminUsersButton").click();
      const directory = page.locator("app-record-collection").filter({ has: page.getByRole("heading", { name: "Admin Users", exact: true }) });
      for (const user of users) {
        await directory.locator(".record-card").filter({ has: page.getByRole("heading", { name: user.adminUser.username, exact: true }) })
          .getByRole("button", { name: "Add To Batch", exact: true }).click();
      }
      const backdrop = page.locator("#globalConfirmationBackdrop");
      const secretInput = page.locator("#globalConfirmationPasswordInput");
      const submit = page.locator("#globalConfirmationConfirmButton");
      await page.locator("#adminBatchDeleteButton").click();
      await page.waitForFunction(() => document.activeElement?.id === "globalConfirmationPasswordInput");
      assert.equal(await page.locator("#globalConfirmationDialog").evaluate(element => getComputedStyle(element).backgroundColor),
        "rgb(255, 255, 255)", "The password dialog must have an opaque readable surface above its dimmed backdrop.");
      assert.equal(await secretInput.getAttribute("type"), "password");
      assert.equal(await submit.isDisabled(), true);
      await secretInput.fill(wrongPassword);
      await page.keyboard.press("Escape");
      await backdrop.waitFor({ state: "detached" });
      assert.equal(deletions.length, 0, "Cancel never issues a DELETE.");
      await page.waitForFunction(() => document.activeElement?.id === "adminBatchDeleteButton");
      await page.locator("#adminBatchDeleteButton").click();
      await secretInput.waitFor(); assert.equal(await secretInput.inputValue(), "");
      await secretInput.fill(wrongPassword); await submit.click();
      await page.locator("#globalConfirmationPasswordError").filter({ hasText: "Incorrect current administrator password" }).waitFor();
      assert.equal(deletions.length, 2); assert.ok(deletions.every(response => response.status() === 403));
      const retained = await api("/api/v1/admin/users?limit=100");
      assert.ok(users.every(user => retained.items.some(item => item.adminUser.adminUserId === user.adminUser.adminUserId)));
      await secretInput.fill(password);
      await page.locator("#globalConfirmationPasswordError").waitFor({ state: "detached" });
      await page.screenshot({ path: join(root, `${fixture}-admin-confirmation.png`) });
      let readFaults = 0;
      const directoryReadPattern = "**/api/v1/admin/users**";
      if (fixture === "original-mobile") await page.route(directoryReadPattern, async route => {
        if (route.request().method() === "GET" && readFaults === 0 && deletions.length >= 4) {
          readFaults++;
          await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "owned_directory_read_failure", message: "Owned refresh fault" }) });
        } else await route.continue();
      });
      let release, started;
      const held = new Promise(done => { started = done; }), pending = new Promise(done => { release = done; });
      const deletePattern = "**/api/v1/admin/users/*";
      if (fixture === "rewrite-desktop") {
        let heldOnce = false;
        await page.route(deletePattern, async route => {
          if (route.request().method() === "DELETE" && !heldOnce) {
            heldOnce = true;
            const response = await route.fetch(); started(); await pending;
            await route.fulfill({ response });
          } else await route.continue();
        });
      }
      await submit.click();
      if (fixture === "rewrite-desktop") {
        await Promise.race([held, delay(10_000).then(() => { throw Error("Pending real DELETE was not observed."); })]);
        try {
          assert.equal(await secretInput.isEditable(), false);
          assert.equal(await submit.isDisabled(), true);
          assert.equal(await page.locator("#globalConfirmationCancelButton").isDisabled(), true);
          await secretInput.focus(); await page.keyboard.press("Enter"); await page.keyboard.press("Escape");
          assert.equal(await backdrop.count(), 1, "Pending deletion cannot close or submit twice.");
        } finally { release(); }
      }
      await backdrop.waitFor({ state: "detached" });
      if (fixture === "rewrite-desktop") await page.unroute(deletePattern);
      if (fixture === "original-mobile") {
        assert.equal(readFaults, 1, "Fault-inject the directory read after acknowledged deletions.");
        await page.unroute(directoryReadPattern);
      }
      assert.equal(deletions.length, 4); assert.ok(deletions.slice(2).every(response => response.status() === 200));
      const removed = await api("/api/v1/admin/users?limit=100");
      assert.ok(users.every(user => !removed.items.some(item => item.adminUser.adminUserId === user.adminUser.adminUserId)));
      await page.locator('[data-view-nav="workspace"]').click();
      await page.locator("#tenantKey").fill("demo-tenant"); await page.locator("#tenantKey").dispatchEvent("change");
      await page.locator("#workspaceKey").fill(workspaceKey); await page.locator("#workspaceKey").dispatchEvent("change");
      await page.locator("#deleteWorkspaceButton").click();
      await page.waitForFunction(() => document.activeElement?.id === "globalConfirmationVerificationInput");
      assert.equal(await secretInput.inputValue(), "");
      await secretInput.fill(password);
      const verification = page.locator("#globalConfirmationVerificationInput");
      await verification.fill(`${workspaceKey}-wrong`); assert.equal(await submit.isDisabled(), true);
      await verification.fill(workspaceKey); await secretInput.fill(wrongPassword);
      await submit.click();
      await page.locator("#globalConfirmationPasswordError").filter({ hasText: "Incorrect current administrator password" }).waitFor();
      assert.equal(deletions.length, 5); assert.equal(deletions.at(-1).status(), 403);
      await api(workspacePath); // Still exists; wrong-password rejection did not mutate.
      await secretInput.fill(password); await page.screenshot({ path: join(root, `${fixture}-workspace-confirmation.png`) });
      let workspaceReadFaults = 0;
      const workspaceDirectoryPattern = "**/api/v1/tenants/demo-tenant/workspaces";
      if (fixture === "original-mobile") await page.route(workspaceDirectoryPattern, async route => {
        if (route.request().method() === "GET" && workspaceReadFaults === 0 && deletions.length >= 6) {
          workspaceReadFaults++;
          await route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "owned_directory_read_failure", message: "Owned refresh fault" }) });
        } else await route.continue();
      });
      await submit.click(); await backdrop.waitFor({ state: "detached" });
      if (fixture === "original-mobile") {
        assert.equal(workspaceReadFaults, 1, "Failed workspace refresh must not reopen the completed destructive operation.");
        await page.unroute(workspaceDirectoryPattern);
      }
      assert.equal(deletions.length, 6); assert.equal(deletions.at(-1).status(), 200);
      assert.equal((await fetch(`${baseUrl}${workspacePath}`, { headers: { authorization: `Bearer ${token}` } })).status, 404);
      assert.equal(await page.locator("#workspaceKey").inputValue(), "");
      const audit = await api("/api/v1/admin/audit-events?limit=100");
      assert.equal(JSON.stringify(audit).includes(wrongPassword), false);
      assert.equal(JSON.stringify(audit).includes("confirmationPassword"), false);
      assert.equal(await page.evaluate(secret => Object.keys(localStorage).some(key => localStorage.getItem(key)?.includes(secret)), wrongPassword), false);
      assert.equal(await page.evaluate(() => Object.keys(localStorage).some(key => localStorage.getItem(key)?.includes("confirmationPassword"))), false);
      assert.deepEqual(errors, []); await context.close();
      process.stdout.write(`deletion_confirmation=${fixture}:passed\n`);
    }
  }
} finally {
  await browser?.close(); server.kill("SIGTERM");
  await Promise.race([new Promise(done => server.once("exit", done)), delay(5_000)]);
  if (server.exitCode === null) server.kill("SIGKILL");
}
