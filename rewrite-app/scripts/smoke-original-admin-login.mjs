import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { access, mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

// These fixtures own their API/database/address; no interactive test is reset.
const frontendRoot = resolve(process.env.UI_SMOKE_FRONTEND_ROOT || ".");
await access(join(frontendRoot, "dist/apps/web/browser/index.html"));
const artifacts = await mkdtemp(join(tmpdir(), "testcenter-original-admin-login-"));
process.stdout.write(`owned_artifacts=${artifacts}\n`);
const proof = ["1", "true"].includes(String(process.env.UI_SMOKE_ADMIN_PROOF_OF_WORK));
const serverModule = pathToFileURL(resolve("apps/api/dist/apps/api/src/index.js")).href;
const server = spawn(process.execPath, ["--input-type=module", "-e", `
  import { createProductionApiServer } from ${JSON.stringify(serverModule)};
  const server = await createProductionApiServer();
  server.listen(0, '127.0.0.1', () => process.send({ port: server.address().port }));
  process.once('SIGTERM', () => server.close(() => process.exit(0)));
`], { cwd: frontendRoot, stdio: ["ignore", "ignore", "inherit", "ipc"], env: {
  ...process.env, PORT: "4310", FIRST_SLICE_STORE: "sqlite",
  FIRST_SLICE_SQLITE_FILE: join(artifacts, "store.sqlite"), FIRST_SLICE_BOOTSTRAP_DEMO: "true",
  FIRST_SLICE_OPERATOR_AUTH_REQUIRED: "true", FIRST_SLICE_PROOF_OF_WORK_SCOPES: proof ? "admin" : "",
  ...(proof ? { FIRST_SLICE_PROOF_OF_WORK_SECRET: "owned-original-admin-challenge-secret-not-production",
    FIRST_SLICE_PROOF_OF_WORK_MAX_NUMBER: "1000" } : {})
} });
let baseUrl, token, browser;
const password = "demo-admin-password";
const api = async (path, body, method = body === undefined ? "GET" : "POST") => {
  const response = await fetch(`${baseUrl}${path}`, { method, headers: {
    ...(body === undefined ? {} : { "content-type": "application/json" }),
    ...(token ? { authorization: `Bearer ${token}` } : {})
  }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
  assert.ok(response.ok, `${method} ${path}: ${response.status}`); return response.json();
};
try {
  const port = await new Promise((done, reject) => {
    const timeout = setTimeout(() => reject(Error("Owned API readiness timeout.")), 20_000);
    server.once("error", error => { clearTimeout(timeout); reject(error); });
    server.once("exit", () => { clearTimeout(timeout); reject(Error("Owned API exited.")); });
    server.once("message", message => { clearTimeout(timeout); assert.ok(Number.isInteger(message.port)); done(message.port); });
  });
  baseUrl = `http://127.0.0.1:${port}`;
  assert.equal((await fetch(`${baseUrl}/readyz`)).status, 200);
  const credentials = { username: "demo-admin", password };
  if (proof) {
    // Setup only. Browser logins below solve their own real server challenges,
    // never receive this setup token or a pre-authenticated localStorage fixture.
    const challenge = await api("/api/v1/system/proof-of-work/challenges", { scope: "admin", credentials });
    let number;
    for (let candidate = 0; candidate <= challenge.maxNumber; candidate++) {
      if (createHash("sha256").update(challenge.salt + candidate).digest("hex") === challenge.challenge) { number = candidate; break; }
    }
    assert.notEqual(number, undefined); credentials.proofOfWork = { admin: { token: challenge.token, number } };
  }
  token = (await api("/api/v1/admin/auth/sign-in", credentials)).sessionToken;
  const headful = ["1", "true", "yes", "on"].includes(String(process.env.UI_SMOKE_HEADFUL || "").toLowerCase());
  browser = await chromium.launch({ headless: process.env.CI === "true" && !headful,
    ...(process.env.UI_SMOKE_BROWSER_CHANNEL ? { channel: process.env.UI_SMOKE_BROWSER_CHANNEL } : {}),
    args: ["--host-resolver-rules=MAP testcenter-proof.insecure 127.0.0.1"] });
  let browserChallenges = 0;
  for (const theme of ["Primar", "Sekundar", "Erwachsene"]) {
    await api("/api/v1/admin/application-settings", { themeName: theme }, "PATCH");
    for (const mode of ["original", "rewrite"]) {
      for (const [screen, width, height] of [["desktop", 1280, 720], ["mobile", 390, 844]]) {
        const context = await browser.newContext({ viewport: { width, height }, serviceWorkers: "block" });
        const page = await context.newPage(), credentialRequests = [];
        page.on("request", request => {
          if (request.method() === "POST" && ["/api/v1/admin/auth/sign-in", "/api/v1/system/proof-of-work/challenges"].includes(new URL(request.url()).pathname)) credentialRequests.push(request);
        });
        const insecureUrl = new URL(`/app/ops?ui=${mode}&returnUrl=%2Fworkspace`, baseUrl);
        insecureUrl.hostname = "testcenter-proof.insecure";
        await page.goto(insecureUrl.href, { waitUntil: "networkidle" });
        assert.equal(await page.evaluate(() => window.isSecureContext), false, "Use a real insecure origin, not a mocked security flag.");
        await page.locator("#adminUsername").fill("demo-admin"); await page.locator("#adminPassword").fill(password);
        const submit = page.locator("#adminSignInButton"), notice = page.locator('[data-cy="login-insecure-context"]');
        if (proof) {
          await notice.waitFor(); assert.equal(await notice.innerText(), "Die Anmeldung ist nur über eine verschlüsselte Verbindung (HTTPS) möglich. Bitte wenden Sie sich an den Betreiber dieses Servers.");
          if (mode === "original") {
            const icon = await notice.locator(".mat-icon").boundingBox();
            assert.equal(icon.width, 24); assert.equal(icon.height, 24);
          }
          assert.equal(await submit.isDisabled(), true);
          await page.locator("#adminPassword").press("Enter");
          await page.locator("form").evaluate(form => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
          assert.equal(credentialRequests.length, 0, "Disabled and direct form submissions must send neither credentials nor challenges.");
          assert.equal(await submit.isDisabled(), true);
        } else {
          assert.equal(await notice.count(), 0); assert.equal(await submit.isDisabled(), false);
          const authenticated = page.waitForResponse(response => new URL(response.url()).pathname === "/api/v1/admin/auth/sign-in" && response.ok());
          await submit.click(); assert.equal((await authenticated).status(), 200);
          await page.waitForURL(url => url.pathname === "/app/workspace"); assert.equal(credentialRequests.length, 1);
        }
        await page.screenshot({ path: join(artifacts, `${theme}-${screen}-${mode}-insecure-${proof ? "blocked" : "inactive"}.png`), fullPage: true });
        await context.close();
        process.stdout.write(`insecure_admin_entry=${theme}/${screen}/${mode}/${proof ? "blocked-no-request" : "inactive-authorized"}:passed\n`);
      }
    }
    for (const [screen, width, height] of [["desktop", 1280, 720], ["mobile", 390, 844], ["toolbar-small", 599, 844], ["toolbar-large", 600, 844]]) {
      const context = await browser.newContext({ viewport: { width, height } });
      const page = await context.newPage(); const errors = [], signIns = [];
      page.on("pageerror", error => errors.push(String(error)));
      page.on("console", message => { if (message.type() === "error" && /TypeError|ReferenceError|SyntaxError|NG\d{4}/u.test(message.text())) errors.push(message.text()); });
      page.on("response", response => {
        const path = new URL(response.url()).pathname;
        if (path === "/api/v1/admin/auth/sign-in" && response.request().method() === "POST") signIns.push(response);
        if (path === "/api/v1/system/proof-of-work/challenges" && response.ok()) browserChallenges++;
      });
      await page.goto(`${baseUrl}/app/ops?ui=original&returnUrl=%2Fworkspace`, { waitUntil: "networkidle" });
      const root = page.locator("#originalAdminLogin"); await root.waitFor();
      await page.evaluate(() => document.fonts.ready);
      const geometry = await root.evaluate(element => {
        const b = element.getBoundingClientRect(), card = element.querySelector("mat-card");
        const footer = document.querySelector("#originalApplicationFooter").getBoundingClientRect();
        return { width: b.width, height: b.height, footer: [footer.y, footer.height],
          header: document.querySelector("#participantApplicationHeader").getBoundingClientRect().height,
          cardWidth: card.getBoundingClientRect().width, cardColor: getComputedStyle(card).backgroundColor,
          heading: element.querySelector("mat-card-title").textContent.trim(),
          extraHero: Boolean(document.querySelector(".hero")), extraNavigation: Boolean(document.querySelector(".view-nav")),
          passwordSuffix: Boolean(element.querySelector(".mat-mdc-form-field-icon-suffix")) };
      });
      assert.equal(geometry.height, height - (width < 600 ? 56 : 64) - 56 - 14);
      assert.ok(Math.abs(geometry.width - width * .98) <= 1 / 64);
      assert.deepEqual(geometry.footer, [height - 56, 56]);
      assert.equal(geometry.header, width < 600 ? 56 : 64);
      assert.equal(geometry.cardWidth, 400); assert.equal(geometry.cardColor, "rgb(255, 255, 255)");
      assert.equal(geometry.heading, "Admin-Bereich");
      assert.equal(geometry.extraHero, false); assert.equal(geometry.extraNavigation, false); assert.equal(geometry.passwordSuffix, false);
      const name = page.locator("#adminUsername"), pw = page.locator("#adminPassword"), submit = page.locator("#adminSignInButton");
      await name.fill("ab"); await pw.fill("owned-wrong-password"); assert.equal(await submit.isDisabled(), true);
      assert.equal(signIns.length, 0); await name.fill(`unknown-${theme}-${screen}`);
      await pw.evaluate(input => input.dispatchEvent(new KeyboardEvent("keyup", { key: "A", modifierCapsLock: true, bubbles: true })));
      await page.getByText("Feststelltaste ist aktiviert!", { exact: true }).waitFor();
      await pw.evaluate(input => input.dispatchEvent(new KeyboardEvent("keyup", { key: "B", bubbles: true })));
      await page.getByText("Feststelltaste ist aktiviert!", { exact: true }).waitFor({ state: "detached" });
      await submit.click(); await page.locator('[data-cy="login-problem:400"]').waitFor();
      assert.equal(signIns.length, 1); assert.equal(signIns[0].status(), 401);
      assert.equal(await name.inputValue(), ""); assert.equal(await pw.inputValue(), "");
      assert.equal(await submit.isDisabled(), true);
      await page.screenshot({ path: join(artifacts, `${theme}-${screen}-wrong.png`) });
      await name.fill("demo-admin"); await pw.fill(password);
      const pending = (() => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; })();
      let reached;
      const acknowledged = new Promise(done => { reached = done; });
      await page.route("**/api/v1/admin/auth/sign-in", async route => {
        const response = await route.fetch(); reached(response); await pending.promise; await route.fulfill({ response });
      });
      await submit.click(); assert.equal((await acknowledged).status(), 200);
      assert.equal(await submit.isDisabled(), true); assert.equal(await pw.getAttribute("readonly"), "");
      // Enter on the readonly field still reaches ngSubmit: the controller,
      // not just a disabled mouse target, must reject that duplicate.
      await pw.press("Enter"); assert.equal(signIns.length, 1);
      pending.resolve(); await page.waitForURL(url => url.pathname === "/app/workspace");
      assert.equal(signIns.length, 2);
      const identity = await signIns[1].json(); assert.equal(identity.adminUser.username, "demo-admin"); assert.ok(identity.sessionToken);
      await page.locator("#originalAdminLogin").waitFor({ state: "detached" });
      assert.equal(await page.evaluate(secret => Object.keys(localStorage).some(key => localStorage.getItem(key)?.includes(secret)), password), false);
      assert.deepEqual(errors, []); await context.close();
      process.stdout.write(`original_admin_login=${theme}/${screen}:passed\n`);
    }
  }
  for (const [name, window, expectedCode, copy] of [
    ["scheduled", { validFrom: new Date(Date.now() + 86_400_000).toISOString() }, 401, "Anmeldung abgelehnt. Anmeldedaten sind noch nicht freigeben."],
    ["expired", { validTo: new Date(Date.now() - 86_400_000).toISOString() }, 410, "Anmeldedaten sind abgelaufen"]
  ]) {
    await api("/api/v1/admin/users", { username: `owned.${name}`, password: "owned-window-password", ...window,
      roleAssignments: [{ role: "workspace_admin", tenantKey: "demo-tenant", workspaceKey: "demo-workspace" }] });
    const context = await browser.newContext(), page = await context.newPage();
    await page.goto(`${baseUrl}/app/ops?ui=original`, { waitUntil: "networkidle" });
    await page.locator("#adminUsername").fill(`owned.${name}`); await page.locator("#adminPassword").fill("owned-window-password");
    await page.locator("#adminSignInButton").click();
    await page.locator(`[data-cy="login-problem:${expectedCode}"]`).filter({ hasText: copy }).waitFor();
    assert.equal(await page.locator("#adminPassword").inputValue(), "");
    await page.locator('[data-cy="login-testtaker-form"]').click();
    await page.waitForURL(url => url.pathname === "/app/participant");
    await page.locator("#originalParticipantLogin").waitFor(); await context.close();
    process.stdout.write(`original_admin_window=${name}:passed\n`);
  }
  const browserRoot = join(frontendRoot, "dist/apps/web/browser");
  const blankContext = await browser.newContext(), blankPage = await blankContext.newPage();
  await blankPage.goto(`${baseUrl}/app/ops?ui=original`, { waitUntil: "networkidle" });
  await blankPage.locator("#adminUsername").fill("   "); await blankPage.locator("#adminPassword").fill("owned-wrong-password");
  await blankPage.locator("#adminSignInButton").click();
  await blankPage.locator('[data-cy="login-problem:400"]').filter({ hasText: "Anmeldedaten sind nicht gültig." }).waitFor();
  assert.equal(await blankPage.locator("#adminPassword").inputValue(), "");
  await blankContext.close(); process.stdout.write("original_admin_login=blank-normalized-name-rejected:passed\n");
  // A real acknowledged session is not a failed login merely because the
  // following asset list is unavailable. The original return URL must survive.
  const assetContext = await browser.newContext(), assetPage = await assetContext.newPage();
  let assetReads = 0;
  await assetPage.route("**/api/v1/admin/application-assets", route => {
    assetReads++; return route.fulfill({ status: 503, contentType: "application/json", body: JSON.stringify({ error: "owned_asset_read_failed", message: "Owned read failure after authentication" }) });
  });
  await assetPage.goto(`${baseUrl}/app/ops?ui=original&returnUrl=%2Fworkspace`, { waitUntil: "networkidle" });
  await assetPage.locator("#adminUsername").fill("demo-admin"); await assetPage.locator("#adminPassword").fill(password);
  const authenticated = assetPage.waitForResponse(response => new URL(response.url()).pathname === "/api/v1/admin/auth/sign-in" && response.ok());
  await assetPage.locator("#adminSignInButton").click(); const acknowledgedIdentity = await (await authenticated).json();
  await assetPage.waitForURL(url => url.pathname === "/app/workspace");
  assert.ok(assetReads > 0); assert.ok(acknowledgedIdentity.sessionToken);
  const retained = await fetch(`${baseUrl}/api/v1/admin/auth/current-session`, { headers: { authorization: `Bearer ${acknowledgedIdentity.sessionToken}` } });
  assert.equal(retained.status, 200);
  await assetContext.close(); process.stdout.write("original_admin_login=acknowledged-session-after-failed-asset-read:passed\n");
  const chunks = (await readdir(browserRoot)).filter(name => /^chunk-.*\.js$/u.test(name));
  // The parent template also mentions the element tag. Abort only the actual
  // component definition, not an arbitrary first filename/parent route chunk.
  const componentChunks = (await Promise.all(chunks.map(async name => ({ name,
    contains: /selectors:\s*\[\[\s*"app-original-admin-login"\s*\]\]/u.test(await readFile(join(browserRoot, name), "utf8"))
  })))).filter(candidate => candidate.contains);
  assert.equal(componentChunks.length, 1, "Original administrator renderer must have one actual lazy definition.");
  const componentChunk = componentChunks[0];
  const fallbackContext = await browser.newContext({ serviceWorkers: "block" });
  const fallback = await fallbackContext.newPage(); let blocked = 0, requests = 0;
  fallback.on("request", request => { if (new URL(request.url()).pathname === "/api/v1/admin/auth/sign-in") requests++; });
  await fallback.route(`**/${componentChunk.name}`, route => { blocked++; return route.abort("failed"); });
  await fallback.goto(`${baseUrl}/app/ops?ui=original`, { waitUntil: "networkidle" });
  await fallback.getByRole("button", { name: "Rewrite-Anmeldung öffnen", exact: true }).click();
  await fallback.locator("#adminSignInButton").filter({ hasText: "Sign In" }).waitFor();
  await fallback.locator("#firstDeploymentSetup").waitFor();
  assert.ok(blocked > 0); assert.equal(requests, 0); await fallbackContext.close();
  if (proof) assert.ok(browserChallenges >= 24, "Every browser credential attempt must solve its own admin challenge.");
  process.stdout.write(`original_admin_login=failed-chunk-safe-rewrite; browser_challenges=${browserChallenges}\n`);
} finally {
  await browser?.close().catch(() => undefined);
  if (server.exitCode === null) {
    const stopped = new Promise(done => server.once("exit", done)); server.kill("SIGTERM");
    await Promise.race([stopped, delay(5_000)]); if (server.exitCode === null) { server.kill("SIGKILL"); await stopped; }
  }
  process.stdout.write("owned_api=shutdown\n");
}
