import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp } from "node:fs/promises";
import { createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { chromium } from "playwright";

// Own the API/database; never consume or reset the interactive port 4311.
const frontendRoot = resolve(process.env.UI_SMOKE_FRONTEND_ROOT || ".");
await access(join(frontendRoot, "dist/apps/web/browser/index.html"));
const root = await mkdtemp(join(tmpdir(), "testcenter-original-participant-login-"));
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
let browserChallenges = 0;
const observeProofOfWork = page => page.on("response", response => {
  if (response.status() === 200 && new URL(response.url()).pathname === "/api/v1/system/proof-of-work/challenges") browserChallenges++;
});
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
  const headful = ["1", "true", "yes", "on"].includes(String(process.env.UI_SMOKE_HEADFUL || "").toLowerCase());
  browser = await chromium.launch({ headless: process.env.CI === "true" && !headful,
    ...(process.env.UI_SMOKE_BROWSER_CHANNEL ? { channel: process.env.UI_SMOKE_BROWSER_CHANNEL } : {}),
    args: ["--host-resolver-rules=MAP testcenter-proof.insecure 127.0.0.1"] });
  const protectedParticipant = String(process.env.FIRST_SLICE_PROOF_OF_WORK_SCOPES || "").split(/[\s,]+/u).includes("participant");
  for (const theme of ["Primar", "Sekundar", "Erwachsene"]) {
    await api("/api/v1/admin/application-settings", { themeName: theme }, "PATCH");
    for (const mode of ["original", "rewrite"]) {
      const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, serviceWorkers: "block" });
      const page = await context.newPage(), credentialRequests = [];
      page.on("request", request => {
        if (request.method() === "POST" && ["/api/v1/participant/auth/sign-in", "/api/v1/system/proof-of-work/challenges"].includes(new URL(request.url()).pathname)) credentialRequests.push(request);
      });
      const insecureUrl = new URL(`/app/participant?ui=${mode}&tenantKey=demo-tenant&workspaceKey=demo-workspace`, baseUrl);
      insecureUrl.hostname = "testcenter-proof.insecure";
      await page.goto(insecureUrl.href, { waitUntil: "networkidle" });
      assert.equal(await page.evaluate(() => window.isSecureContext), false);
      const notice = page.locator('[data-cy="login-insecure-context"]');
      if (mode === "original") {
        await page.getByLabel("Anmeldename", { exact: true }).fill("student-demo");
        await page.getByRole("button", { name: "Weiter", exact: true }).click();
      } else {
        await page.locator("#participantLoginKey").fill("student-demo");
      }
      const submit = mode === "original" ? page.getByRole("button", { name: "Anmelden", exact: true }) : page.locator("#participantRouteSignInButton");
      if (protectedParticipant) {
        await notice.waitFor(); assert.equal(await notice.innerText(), "Die Anmeldung ist nur über eine verschlüsselte Verbindung (HTTPS) möglich. Bitte wenden Sie sich an den Betreiber dieses Servers.");
        if (mode === "original") {
          const icon = await notice.locator(".mat-icon").boundingBox();
          assert.equal(icon.width, 24); assert.equal(icon.height, 24);
        }
        assert.equal(await submit.isDisabled(), true); assert.equal(credentialRequests.length, 0);
        if (mode === "original") {
          await page.locator("#originalLoginPassword").fill("owned-password");
          await page.locator("#originalLoginPassword").press("Enter");
          await page.locator("#originalParticipantLogin form").evaluate(form => form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true })));
          assert.equal(credentialRequests.length, 0);
        }
      } else {
        assert.equal(await notice.count(), 0);
        if (mode === "rewrite") {
          const authenticated = page.waitForResponse(response => new URL(response.url()).pathname === "/api/v1/participant/auth/sign-in" && response.ok());
          await submit.click(); assert.equal((await authenticated).status(), 200);
        } else {
          await page.locator("#originalParticipantLogin").waitFor({ state: "detached" });
        }
        assert.equal(credentialRequests.length, 1);
      }
      await page.screenshot({ path: join(root, `${theme}-${mode}-insecure-${protectedParticipant ? "blocked" : "inactive"}.png`), fullPage: true });
      await context.close();
      process.stdout.write(`insecure_participant_entry=${theme}/${mode}/${protectedParticipant ? "blocked-no-request" : "inactive-authorized"}:passed\n`);
    }
    for (const [screen, width, height] of [["desktop", 1280, 720], ["mobile", 390, 844], ["toolbar-small", 599, 844], ["toolbar-large", 600, 844]]) {
      // This geometry fixture explicitly includes the authored old-browser
      // warning. A newer installed Chrome must not silently remove that state.
      const context = await browser.newContext({ viewport: { width, height },
        userAgent: "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/147.0.0.0 Safari/537.36" });
      const page = await context.newPage();
      observeProofOfWork(page);
      const errors = [];
      page.on("pageerror", error => errors.push(String(error)));
      await page.goto(`${baseUrl}/app/participant?ui=original&tenantKey=demo-tenant&workspaceKey=demo-workspace`, { waitUntil: "networkidle" });
      await page.waitForFunction(() => document.activeElement?.id === "originalLoginName");
      await page.evaluate(() => document.fonts.ready);
      const geometry = await page.locator("#originalParticipantLogin").evaluate(element => {
        const read = selector => element.querySelector(selector).getBoundingClientRect();
        const footer = document.querySelector("#originalApplicationFooter").getBoundingClientRect();
        const topbar = document.querySelector("#participantApplicationHeader").getBoundingClientRect();
        const h2 = element.querySelector("h2"), style = getComputedStyle(h2);
        const label = getComputedStyle(element.querySelector(".mdc-floating-label"));
        const icon = element.querySelector(".login-submit [matButtonIcon]");
        return { rootHeight: element.getBoundingClientRect().height,
          footer: [footer.y, footer.height], toolbarHeight: topbar.height,
          heading: [style.fontSize, style.fontWeight, style.lineHeight],
          direction: getComputedStyle(element).flexDirection, labelGap: label.gap,
          disabledOpacity: getComputedStyle(element.querySelector(".login-submit")).opacity,
          iconHeight: icon.getBoundingClientRect().height,
          iconOverflow: getComputedStyle(icon).overflow,
          columnWidth: read(".login-section").width, warningWidth: read(".help-box").width,
          warningSizing: getComputedStyle(element.querySelector(".help-box")).boxSizing };
      });
      assert.equal(geometry.rootHeight, height - (width < 600 ? 56 : 64) - 56);
      assert.deepEqual(geometry.footer, [height - 56, 56]);
      assert.equal(geometry.toolbarHeight, width < 600 ? 56 : 64);
      assert.deepEqual(geometry.heading, ["30px", "400", "normal"]);
      assert.equal(geometry.direction, "row");
      assert.equal(geometry.labelGap, "normal");
      assert.equal(geometry.disabledOpacity, "1");
      assert.equal(geometry.iconOverflow, "hidden");
      assert.ok(geometry.iconHeight >= 18 && geometry.iconHeight < 27);
      assert.equal(geometry.warningSizing, "border-box");
      assert.ok(Math.abs(geometry.warningWidth - geometry.columnWidth * .8) <= 1 / 64);
      await page.screenshot({ path: join(root, `${theme}-${screen}-name.png`) });
      const name = page.getByLabel("Anmeldename", { exact: true });
      await name.fill("ab");
      assert.equal(await page.getByRole("button", { name: "Weiter", exact: true }).isDisabled(), true);
      await name.fill(`unknown-${theme}-${screen}`);
      const rejected = page.waitForResponse(response => new URL(response.url()).pathname === "/api/v1/participant/auth/sign-in" && response.request().method() === "POST");
      await page.getByRole("button", { name: "Weiter", exact: true }).click();
      assert.equal((await rejected).status(), 401);
      await page.waitForFunction(() => document.activeElement?.id === "originalLoginPassword");
      const password = page.getByLabel("Kennwort", { exact: true });
      await password.fill("owned-synthetic-password");
      assert.equal(await password.getAttribute("type"), "password");
      await page.getByRole("button", { name: "Kennwort anzeigen", exact: true }).click();
      await page.getByRole("button", { name: "Kennwort verbergen", exact: true }).waitFor();
      assert.equal(await password.getAttribute("type"), "text");
      await page.getByRole("button", { name: "Kennwort verbergen", exact: true }).click();
      await page.getByRole("button", { name: "Kennwort anzeigen", exact: true }).waitFor();
      assert.equal(await password.getAttribute("type"), "password");
      await page.screenshot({ path: join(root, `${theme}-${screen}-password.png`) });
      await page.getByRole("button", { name: "Zurück zum Anmeldenamen", exact: true }).click();
      await page.waitForFunction(() => document.activeElement?.id === "originalLoginName");
      assert.equal(await name.inputValue(), `unknown-${theme}-${screen}`);
      assert.deepEqual(errors, []);
      await context.close();
      process.stdout.write(`original_login=${theme}/${screen}:passed\n`);
    }
  }
  // A registered password must still go through the real authorization and
  // session creation path, not an injected/pre-authenticated browser fixture.
  const password = "owned-original-password";
  await api("/api/v1/tenants/demo-tenant/workspaces/demo-workspace/participant-roster", {
    rosterText: `loginKey,groupKey,bookletKey,displayName,pw\noriginal-password,original-group,booklet:demo,Owned Original participant,${password}`
  });
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
  const page = await context.newPage();
  observeProofOfWork(page);
  await page.goto(`${baseUrl}/app/participant?ui=original&tenantKey=demo-tenant&workspaceKey=demo-workspace`, { waitUntil: "networkidle" });
  await page.getByLabel("Anmeldename", { exact: true }).fill("original-password");
  await page.getByRole("button", { name: "Weiter", exact: true }).click();
  await page.getByLabel("Kennwort", { exact: true }).fill(password);
  const signedIn = page.waitForResponse(response => new URL(response.url()).pathname === "/api/v1/participant/auth/sign-in" && response.request().method() === "POST");
  await page.getByRole("button", { name: "Anmelden", exact: true }).click();
  const response = await signedIn;
  assert.equal(response.status(), 200);
  const identity = await response.json();
  assert.equal(identity.participantSession.loginKey, "original-password");
  assert.ok(identity.sessionToken);
  await page.locator("#originalParticipantLogin").waitFor({ state: "detached" });
  // The single-booklet auto-start follows sign-in asynchronously. Observe
  // that normal controller transition rather than racing it on slower CI.
  const stateDeadline = Date.now() + 15_000;
  let state;
  while (true) {
    const response = await fetch(`${baseUrl}/api/v1/participant/sessions/${identity.participantSession.participantSessionId}/current-state`, {
      headers: { authorization: `Bearer ${identity.sessionToken}` }
    });
    assert.equal(response.status, 200);
    state = await response.json();
    if (state.currentRunState) break;
    assert.ok(Date.now() < stateDeadline, "Original login's single-booklet auto-start must finish.");
    await delay(100);
  }
  assert.equal(state.currentRunState.participantSession.loginKey, "original-password");
  assert.equal(await page.evaluate(secret => Object.keys(localStorage).some(key => localStorage.getItem(key)?.includes(secret)), password), false);
  if (String(process.env.FIRST_SLICE_PROOF_OF_WORK_SCOPES || "").split(/[\s,]+/u).includes("participant")) {
    assert.ok(browserChallenges > 0, "Original login must solve actual server-issued proof-of-work challenges.");
    process.stdout.write(`original_login_proof_of_work=${browserChallenges} real browser challenges\n`);
  }
  await context.close();
  process.stdout.write("Original password login: real authorized session, no persisted password.\n");
  if (!protectedParticipant) {
    // Second-code-only protection must not disable the preceding name login.
    // This roster and all resulting Runs belong exclusively to this test API.
    const protectedCode = String(process.env.FIRST_SLICE_PROOF_OF_WORK_SCOPES || "").split(/[\s,]+/u).includes("second_code");
    for (const codeInputType of ["keypad-symbols-alt", "text-field"]) {
      await api("/api/v1/tenants/demo-tenant/workspaces/demo-workspace/participant-roster", {
        rosterText: JSON.stringify([{ loginKey: "owned-second-code", groupKey: "owned-second-code-group",
          booklets: [{ id: "booklet:demo", codes: "123" }],
          viewSettings: { codeInput: { type: codeInputType, length: 3 } } }])
      });
      for (const mode of ["original", "rewrite"]) {
        const context = await browser.newContext({ serviceWorkers: "block" }), page = await context.newPage();
        const credentialRequests = [];
        page.on("request", request => {
          if (request.method() === "POST" && ["/api/v1/participant/auth/sign-in", "/api/v1/system/proof-of-work/challenges"].includes(new URL(request.url()).pathname)) credentialRequests.push(request);
        });
        const insecureUrl = new URL(`/app/participant?ui=${mode}&tenantKey=demo-tenant&workspaceKey=demo-workspace`, baseUrl);
        insecureUrl.hostname = "testcenter-proof.insecure";
        await page.goto(insecureUrl.href, { waitUntil: "networkidle" });
        assert.equal(await page.evaluate(() => window.isSecureContext), false);
        if (mode === "original") {
          await page.getByLabel("Anmeldename", { exact: true }).fill("owned-second-code");
          await page.getByRole("button", { name: "Weiter", exact: true }).click();
        } else {
          await page.locator("#participantLoginKey").fill("owned-second-code"); await page.locator("#participantRouteSignInButton").click();
        }
        const control = page.locator(codeInputType === "text-field" ? "#participantCode" : "#participantCodeKeypad"); await control.waitFor();
        assert.equal(credentialRequests.length, 1, "The preceding name entry must remain unprotected for second-code-only scopes.");
        if (protectedCode) {
          await page.locator('[data-cy="login-insecure-context"]').waitFor();
          assert.equal(await page.locator("#participantRouteSignInButton").isDisabled(), true);
          assert.equal(await page.locator("#participantRouteStartOrResumeButton").isDisabled(), true);
          if (codeInputType === "text-field") assert.equal(await control.isDisabled(), true);
          else assert.ok(await control.locator("button").evaluateAll(buttons => buttons.length > 0 && buttons.every(button => button.disabled)));
          await page.keyboard.press("Enter"); assert.equal(credentialRequests.length, 1);
        } else {
          assert.equal(await page.locator('[data-cy="login-insecure-context"]').count(), 0);
          const authenticated = page.waitForResponse(response => new URL(response.url()).pathname === "/api/v1/participant/auth/sign-in" && response.ok());
          if (codeInputType === "text-field") {
            await control.fill("123"); await page.locator("#participantRouteSignInButton").click();
          } else {
            for (const digit of ["1", "2", "3"]) await page.locator(`#participantCodeKeypadValue-${digit}`).click();
          }
          assert.equal((await authenticated).status(), 200); assert.equal(credentialRequests.length, 2);
        }
        await page.screenshot({ path: join(root, `${mode}-${codeInputType}-second-code-insecure-${protectedCode ? "blocked" : "inactive"}.png`), fullPage: true });
        await context.close();
        process.stdout.write(`insecure_second_code=${mode}/${codeInputType}/${protectedCode ? "blocked-no-request" : "inactive-authorized"}:passed\n`);
      }
    }
  }
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
