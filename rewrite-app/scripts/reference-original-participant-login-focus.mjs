import assert from "node:assert/strict";
import { createServer } from "node:http";
import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { extname, join, relative, resolve } from "node:path";
import { chromium } from "playwright";

// Read-only Source frontend on owned UI fixtures. Verify the Source revision
// and build before calling; this does not verify its backend authentication.
assert.ok(process.env.ORIGINAL_LOGIN_REFERENCE_ROOT);
assert.ok(process.env.ORIGINAL_LOGIN_REFERENCE_COMMIT);
assert.ok(process.env.UI_SMOKE_ARTIFACT_DIR);
const root = resolve(process.env.ORIGINAL_LOGIN_REFERENCE_ROOT);
const artifacts = resolve(process.env.UI_SMOKE_ARTIFACT_DIR);
const insecureReference = process.env.ORIGINAL_LOGIN_REFERENCE_INSECURE === "true";
const adminReference = insecureReference && process.env.ORIGINAL_LOGIN_REFERENCE_ENTRY === "admin";
const noticeReference = JSON.parse(await readFile(new URL("./fixtures/original-login-notices.json", import.meta.url), "utf8"));
const readNotice = element => {
  const box = el => { const rect = el.getBoundingClientRect(), style = getComputedStyle(el);
    return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, color: style.color,
      font: style.font, margin: style.margin, display: style.display }; };
  const host = box(element), icon = box(element.querySelector(".mat-icon"));
  icon.x -= host.x; icon.y -= host.y;
  host.x = host.y = 0;
  return { text: element.textContent.trim(), host, icon };
};
await access(join(root, "index.html"));
await mkdir(artifacts, { recursive: true });
const server = createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, "http://localhost").pathname;
    const file = resolve(root, extname(pathname) ? `.${pathname}` : "index.html");
    if (relative(root, file).startsWith("..")) return response.writeHead(404).end();
    response.setHeader("content-type", {
      ".html": "text/html", ".js": "text/javascript", ".css": "text/css",
      ".svg": "image/svg+xml", ".png": "image/png", ".woff2": "font/woff2"
    }[extname(file)] || "application/octet-stream");
    response.end(await readFile(file));
  } catch { response.writeHead(404).end(); }
});
await new Promise(done => server.listen(0, "127.0.0.1", done));
const base = `http://127.0.0.1:${server.address().port}`;
const browserBase = insecureReference ? base.replace("127.0.0.1", "testcenter-proof.insecure") : base;
const states = {}, errors = [], unknown = [];
let browser;
try {
  browser = await chromium.launch({ headless: false,
    ...(process.env.UI_SMOKE_BROWSER_CHANNEL ? { channel: process.env.UI_SMOKE_BROWSER_CHANNEL } : {}),
    args: ["--host-resolver-rules=MAP testcenter-proof.insecure 127.0.0.1"] });
  for (const theme of ["Primar", "Sekundar", "Erwachsene"]) {
    for (const [screen, width, height] of [["desktop", 1280, 720], ["mobile", 390, 844],
      ["toolbar-small", 599, 844], ["toolbar-large", 600, 844]]) {
      const context = await browser.newContext({ viewport: { width, height }, locale: "de-DE" });
      const page = await context.newPage(), requests = [];
      const key = `${theme}-${screen}`;
      page.on("pageerror", error => errors.push({ key, error: String(error) }));
      await page.route(`${browserBase}/api/**`, async route => {
        const request = route.request(), pathname = new URL(request.url()).pathname;
        let body;
        if (pathname === "/api/system/config") body = {
          version: "Rewrite", customTexts: {}, appConfig: { themeName: theme, appTitle: "IQB-Testcenter" },
          veronaPlayerApiVersionMin: 2, veronaPlayerApiVersionMax: 6,
          iqbStandardResponseTypeMin: 1, iqbStandardResponseTypeMax: 5, xmlSchemaVersions: {},
          bruteForceProtection: insecureReference ? ["login", "admin"] : [], broadcastingServiceUri: "", fileServiceUri: "",
          passwordMinLength: 0, passwordPattern: ""
        };
        else if (pathname === "/api/sys-check-mode") body = false;
        else if (pathname === "/api/asset-assignments") body = {};
        else if (pathname === "/api/assets") body = [];
        else if (pathname === "/api/session/login") {
          assert.equal(request.method(), "PUT");
          requests.push(request.postDataJSON());
          return route.fulfill({ status: 400, contentType: "application/json",
            body: JSON.stringify({ message: "Owned invalid credentials" }) });
        } else {
          unknown.push({ key, pathname, method: request.method() });
          return route.fulfill({ status: 404, body: "{}" });
        }
        await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify(body) });
      });
      await page.goto(`${browserBase}/#/r/${adminReference ? "admin-login" : "login"}`, { waitUntil: "networkidle" });
      const name = page.locator("input[formcontrolname=name]");
      const password = page.locator("input[formcontrolname=pw]");
      await name.waitFor();
      const capture = async phase => {
        await page.evaluate(() => document.fonts.ready);
        await page.waitForFunction(() => [...document.querySelectorAll("img")]
          .every(image => image.complete && image.naturalWidth > 0));
        await page.waitForFunction(() => document.getAnimations()
          .filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity)
          .every(animation => animation.playState === "finished" || animation.playState === "idle"));
        await page.evaluate(() => new Promise(done => requestAnimationFrame(() => requestAnimationFrame(done))));
        states[`${key}-${phase}`] = await page.evaluate(() => {
          const active = document.activeElement;
          return { tag: active.tagName, type: active.getAttribute("type"),
            target: active.closest(".logo") ? "logo" : active.classList.contains("welcome-section") ? "welcome"
              : active.matches("input[formcontrolname=name]") ? "name"
                : active.matches("input[formcontrolname=pw]") ? "password" : active.tagName.toLowerCase(),
            nameValue: document.querySelector("input[formcontrolname=name]")?.value ?? null,
            passwordEmpty: document.querySelector("input[formcontrolname=pw]")?.value === "" };
        });
        await page.screenshot({ path: join(artifacts, `${key}-${phase}.png`), fullPage: true });
        return states[`${key}-${phase}`];
      };
      if (insecureReference) {
        assert.equal(await page.evaluate(() => window.isSecureContext), false);
        if (!adminReference) {
          await name.fill("owned-missing-login");
          await page.getByRole("button", { name: "Weiter", exact: true }).click();
          await password.waitFor();
        }
        const notice = page.locator('[data-cy="login-insecure-context"]');
        await notice.waitFor();
        const state = await capture("https-notice");
        state.notice = await notice.evaluate(readNotice);
        assert.deepEqual(state.notice, noticeReference.measurements[key][adminReference ? "httpsAdmin" : "httpsParticipant"]);
        assert.equal(await page.getByRole("button", { name: "Anmelden", exact: true }).isDisabled(), true);
        assert.deepEqual(requests, adminReference ? [] : [{ name: "owned-missing-login", password: "" }]);
        await context.close();
        process.stdout.write(`source_login_https=${adminReference ? "admin" : "participant"}/${key}:passed\n`);
        continue;
      }
      assert.equal((await capture("initial")).tag, "BODY");
      await page.keyboard.press("Tab");
      assert.equal((await capture("first-tab")).target, "logo");
      await page.keyboard.press("Tab");
      assert.equal((await capture("second-tab")).target, "welcome");
      await page.keyboard.press("Tab");
      assert.equal((await capture("third-tab")).target, "name");
      const submitName = async () => {
        await name.fill("owned-missing-login");
        await page.getByRole("button", { name: "Weiter", exact: true }).click();
        await password.waitFor();
      };
      await submitName();
      assert.equal((await capture("password")).target, "password");
      await password.evaluate(input => input.dispatchEvent(new KeyboardEvent("keyup", {
        key: "A", modifierCapsLock: true, bubbles: true
      })));
      const warning = page.locator('tc-alert[data-cy^="login-problem"]');
      await warning.waitFor();
      const caps = await capture("caps-on");
      caps.notice = await warning.evaluate(readNotice);
      assert.deepEqual(caps.notice, noticeReference.measurements[key].capsLock);
      assert.equal(await warning.evaluate(element => element.getBoundingClientRect().top -
        element.closest("form").querySelector("mat-form-field").getBoundingClientRect().bottom), 24);
      await password.evaluate(input => input.dispatchEvent(new KeyboardEvent("keyup", {
        key: "a", modifierCapsLock: false, bubbles: true
      })));
      await warning.waitFor({ state: "detached" });
      await capture("caps-off");
      await page.locator("mat-form-field button").click();
      assert.equal((await capture("visibility")).type, "text");
      await page.locator(".password-headline button").click();
      await name.waitFor();
      const back = await capture("back");
      assert.equal(back.tag, "BODY"); assert.equal(back.nameValue, "owned-missing-login");
      await submitName();
      assert.equal((await capture("password-again")).tag, "BODY");
      await password.fill("owned-invalid-password");
      await page.getByRole("button", { name: "Anmelden", exact: true }).click();
      await name.waitFor();
      const invalid = await capture("invalid");
      assert.equal(invalid.tag, "BODY"); assert.equal(invalid.nameValue, "");
      invalid.notice = await warning.evaluate(readNotice);
      assert.deepEqual(invalid.notice, noticeReference.measurements[key].invalidCredentials);
      assert.equal(await warning.evaluate(element => element.getBoundingClientRect().top -
        element.closest("form").querySelector("mat-form-field").getBoundingClientRect().bottom), 24);
      assert.notEqual(await name.getAttribute("aria-invalid"), "true");
      assert.deepEqual(requests, [
        { name: "owned-missing-login", password: "" },
        { name: "owned-missing-login", password: "" },
        { name: "owned-missing-login", password: "owned-invalid-password" }
      ]);
      await context.close();
      process.stdout.write(`source_login_focus=${key}:passed\n`);
    }
  }
  assert.deepEqual(errors, []); assert.deepEqual(unknown, []);
} finally {
  await writeFile(join(artifacts, "focus.json"), JSON.stringify({ states, errors, unknown,
    callerVerifiedReferenceCommit: process.env.ORIGINAL_LOGIN_REFERENCE_COMMIT,
    insecureReference, entry: adminReference ? "admin" : "participant",
    scope: "Unmodified Source frontend on owned rejected-login fixtures; no Source backend or full UI proof" }, null, 2));
  await browser?.close();
  await new Promise(done => server.close(done));
}
