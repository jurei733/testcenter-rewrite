import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { serializeVeronaUnitResponse } from "@testcenter-rewrite-app/contracts";
import { localDemoSourcePackage } from "../apps/api/dist/apps/api/src/local-demo-bootstrap.js";
import { playerVersionErrorPlayer } from "./player-version-error-fixture.mjs";
import { createServerRequestFailureGate } from "./server-request-failure-gate.mjs";

const root = resolve(process.env.UI_SMOKE_FRONTEND_ROOT || ".");
await access(join(root, "dist/apps/web/browser/index.html"));
const reference = JSON.parse(await readFile(new URL("./fixtures/original-player-version-error.json", import.meta.url), "utf8"));
assert.equal(reference.referenceRevision, "ee2ab9ab64bd91209ef8534bbe6005838024e46d");
const artifacts = await mkdtemp(join(tmpdir(), "testcenter-player-version-error-"));
console.log(`owned_artifacts=${artifacts}`);
const failureGate = createServerRequestFailureGate();
const module = pathToFileURL(resolve("apps/api/dist/apps/api/src/index.js")).href;
const server = spawn(process.execPath, ["--input-type=module", "-e", `
  import { createProductionApiServer } from ${JSON.stringify(module)};
  const server = await createProductionApiServer();
  server.listen(0, '127.0.0.1', () => process.send({port:server.address().port}));
  process.once('SIGTERM', () => server.close(() => process.exit(0)));
`], { cwd: root, env: { ...process.env, FIRST_SLICE_STORE: "sqlite", FIRST_SLICE_SQLITE_FILE: join(artifacts, "own.sqlite"),
  FIRST_SLICE_BOOTSTRAP_DEMO: "true", FIRST_SLICE_OPERATOR_AUTH_REQUIRED: "true", FIRST_SLICE_PROOF_OF_WORK_SCOPES: "",
  FIRST_SLICE_XML_SCHEMA_PROFILE: "legacy-compatibility", REQUIRE_LOGIN_PASSWORD: "false" }, stdio: ["ignore", "pipe", "pipe", "ipc"] });
failureGate.observeStream(server.stdout); failureGate.observeStream(server.stderr);
const serverClosed = new Promise(done => server.once("close", done));
const errors = [], states = {}; let browser;
const failDialog = process.env.UI_SMOKE_RUNTIME_DIALOG_FAILURE === "true";
const saveFailure = process.env.UI_SMOKE_RUNTIME_SAVE_FAILURE;
const logFailure = process.env.UI_SMOKE_VERSION_LOG_FAILURE;
const deliveryFailure = saveFailure || logFailure;
try {
  const port = await new Promise((done, reject) => {
    const timer = setTimeout(() => reject(Error("Owned API did not start")), 20_000);
    server.once("message", ({ port }) => { clearTimeout(timer); done(port); });
    server.once("error", error => { clearTimeout(timer); reject(error); });
    server.once("exit", () => { clearTimeout(timer); reject(Error("Owned API exited before startup")); });
  });
  const base = `http://127.0.0.1:${port}`;
  const api = async (path, body, token, method = body === undefined ? "GET" : "POST") => {
    const response = await fetch(base + path, { method, headers: { ...(token ? {authorization:`Bearer ${token}`} : {}),
      ...(body === undefined ? {} : {"content-type":"application/json"}) }, ...(body === undefined ? {} : {body:JSON.stringify(body)}) });
    const payload = response.status === 204 ? null : await response.json();
    assert.ok(response.status === 200 || response.status === 201, `${method} ${path}: ${response.status}: ${JSON.stringify(payload)}`);
    return payload;
  };
  const poll = async (read, predicate) => {
    let value;
    for (let attempt = 0; attempt < 100; attempt++) { value = await read(); if (predicate(value)) return value; await delay(100); }
    assert.fail(`Owned API condition did not settle: ${JSON.stringify(value)}`);
  };
  const operator = (await api("/api/v1/admin/auth/sign-in", {username:"demo-admin",password:"demo-admin-password"})).sessionToken;
  browser = await chromium.launch({headless:process.env.CI === "true" && process.env.UI_SMOKE_HEADFUL !== "true"});
  for (const [key, expected] of Object.entries(reference.cases)) {
    if (process.env.UI_SMOKE_ONLY_CASE && key !== process.env.UI_SMOKE_ONLY_CASE) continue;
    const [, variant, theme, screen] = key.match(/^(missing|unsupported)-run-hot-return-(Primar|Sekundar|Erwachsene)-(desktop|mobile)-forbidden-false$/);
    const workspaceKey = `version-${key.toLowerCase()}`, workspace = `/api/v1/tenants/demo-tenant/workspaces/${workspaceKey}`;
    await api("/api/v1/tenants/demo-tenant/workspaces", {workspaceKey,displayName:workspaceKey}, operator);
    const content = JSON.parse(localDemoSourcePackage.sourceDocument);
    content.playerEntries[0].html = playerVersionErrorPlayer(content.playerEntries[0].html, variant, logFailure ? 3_000 : 0);
    content.bookletEntries = [{bookletKey:"owned-exit",displayLabel:"Logo Testheft",config:{silent_mode:"FALSE",
      force_presentation_complete:"ALWAYS",force_response_complete:"ALWAYS",toolbar_show_unit_list:"FALSE",
      toolbar_show_fullscreen_button:"FALSE",toolbar_show_reload_button:"FALSE",navbar_unit_label:"HIDDEN",navbar_page_label:"HIDDEN"},
      testletEntries:[{testletKey:"timed",displayLabel:"Zeitblock",parentTestletKey:null,
        restrictions:{timeMax:{minutes:5,leave:"forbidden"},lockAfterLeaving:{scope:"unit",confirm:true}}}],
      unitEntries:[{...content.bookletEntries[0].unitEntries[0],displayLabel:"Logo Aufgabe",testletPath:["timed"]}]}];
    const source = await api(workspace + "/source-packages", {fileName:"version.json",mediaType:"application/json",contentStructure:content}, operator);
    const imported = await api(workspace + "/import-jobs", {sourcePackageId:source.sourcePackage.sourcePackageId}, operator);
    await api(workspace + `/content-releases/${imported.stagedContentRelease.contentReleaseId}/activate`, {activatedByActorId:"version-proof"}, operator);
    await api(workspace + "/participant-roster", {rosterText:'<Testtakers><Group id="owned" label="Exit Group"><Login mode="run-hot-return" name="exit-person"><Booklet>owned-exit</Booklet></Login></Group></Testtakers>'}, operator);
    await api("/api/v1/admin/application-settings", {themeName:theme}, operator, "PATCH");
    const seedIdentity = await api("/api/v1/participant/auth/sign-in", {tenantKey:"demo-tenant",workspaceKey,loginKey:"exit-person"});
    const seeded = await api(`/api/v1/participant/sessions/${seedIdentity.participantSession.participantSessionId}/resume`, {bookletKey:"owned-exit"}, seedIdentity.sessionToken);
    const packet = serializeVeronaUnitResponse({unitState:{dataParts:{answer:`Previously saved ${key} Ω  whitespace`},
      presentationProgress:"some",responseProgress:"none"},playerState:{currentPage:"1",validPages:[{id:"1",label:"Owned page"}]}});
    await api(`/api/v1/participant/test-runs/${seeded.testRun.testRunId}/save-progress`,
      {currentUnitKey:"unit-intro",unitResponse:packet,status:"running"},seedIdentity.sessionToken);
    const context = await browser.newContext({viewport:screen === "desktop" ? {width:1280,height:720} : {width:390,height:844},locale:"de-DE"});
    if (failDialog) {
      const matches = [];
      for (const asset of (await readdir(join(root, "dist/apps/web/browser"))).filter(a => a.endsWith(".js"))) {
        if (/selectors:\s*\[\s*\[\s*"app-original-participant-error-launcher"/.test(await readFile(join(root, "dist/apps/web/browser", asset), "utf8"))) matches.push(asset);
      }
      assert.equal(matches.length, 1);
      await context.route(`**/${matches[0]}`, route => route.abort("failed"));
    }
    let releaseSave, saveStarted, allowSave = false, attempts = 0;
    const interceptedSaves = [];
    const blocked = new Promise(done => {saveStarted = done;});
    const gate = new Promise(done => {releaseSave = done;});
    if (deliveryFailure) await context.route("**/api/v1/participant/test-runs/*/*", async route => {
      const body = route.request().postDataJSON();
      const pathname = new URL(route.request().url()).pathname;
      if (!pathname.endsWith("/save-progress") && !pathname.endsWith("/test-logs")) return route.continue();
      if (logFailure && !body?.logs?.some(batch => batch.entries?.some(entry => entry.key === "CONTROLLER" && entry.content === "ERROR"))) return route.continue();
      interceptedSaves.push(body);
      attempts++; saveStarted();
      if (deliveryFailure === "delay") { await gate; await route.continue(); }
      else if (!allowSave) await route.fulfill({status:503,contentType:"application/json",body:'{"error":"owned_save_unavailable"}'});
      else await route.continue();
    });
    const page = await context.newPage(); page.on("pageerror", error => errors.push({key,error:String(error)}));
    await page.goto(`${base}/app/participant?ui=original&theme=${theme}&tenantKey=demo-tenant&workspaceKey=${workspaceKey}`, {waitUntil:"networkidle"});
    await page.locator("#originalLoginName").fill("exit-person");
    const signedIn = page.waitForResponse(r => new URL(r.url()).pathname === "/api/v1/participant/auth/sign-in" && r.request().method() === "POST");
    await page.getByRole("button", {name:"Weiter",exact:true}).click();
    const identity = await (await signedIn).json(), token = identity.sessionToken;
    assert.equal(identity.participantSession.participantSessionId, seedIdentity.participantSession.participantSessionId);
    const currentPath = `/api/v1/participant/sessions/${identity.participantSession.participantSessionId}/current-state`;
    const currentState = async () => (await api(currentPath, undefined, token)).currentRunState;
    const surfaceSelector = failDialog ? "#participantRuntimeErrorFallback" : "mat-dialog-container";
    await page.locator(surfaceSelector).waitFor();
    const element = await page.locator("iframe").elementHandle();
    assert.ok(element); assert.equal(await page.locator("iframe").count(), 1);
    assert.equal(await page.locator("mat-card, #participantRouteControllerErrorState").count(), 0);
    const capture = async phase => {
      await page.evaluate(() => document.fonts.ready);
      await page.waitForFunction(() => document.getAnimations().filter(a => a.effect?.getComputedTiming().iterations !== Infinity).every(a => !a.pending && a.playState !== "running"));
      await page.screenshot({path:join(artifacts, `${key}-${phase}.png`),fullPage:true});
      return page.locator("mat-dialog-container").evaluate(dialog => {
        const read = n => { const b = n.getBoundingClientRect(), s = getComputedStyle(n); return {x:b.x,y:b.y,width:b.width,height:b.height,font:s.font,color:s.color,background:s.backgroundColor,padding:s.padding,margin:s.margin,borderRadius:s.borderRadius,boxShadow:s.boxShadow}; };
        return {role:dialog.getAttribute("role"),box:read(dialog),title:dialog.querySelector("[mat-dialog-title]").textContent.trim(),
          titleBox:read(dialog.querySelector("[mat-dialog-title]")),contentBox:read(dialog.querySelector("mat-dialog-content")),
          introText:dialog.querySelector("mat-dialog-content > p").textContent.trim(),expansion:read(dialog.querySelector("mat-expansion-panel")),
          icon:read(dialog.querySelector(".mat-icon")),actions:read(dialog.querySelector("mat-dialog-actions")),
          buttons:[...dialog.querySelectorAll("button")].map(n => ({text:n.textContent.trim(),box:read(n)}))};
      });
    };
    if (!failDialog) {
      const surface = await capture("collapsed"); states[key] = {collapsedDialog:surface};
      const compare = (actual, wanted, label) => {
        for (const part of ["x","y","width","height"]) assert.ok(Math.abs(actual[part] - wanted[part]) <= 0.6, `${key}/${label}/${part}: ${actual[part]} vs ${wanted[part]}`);
        for (const part of ["font","color","background","padding","margin","borderRadius","boxShadow"]) assert.equal(actual[part], wanted[part], `${key}/${label}/${part}`);
      };
      for (const field of ["box","titleBox","contentBox","expansion","icon","actions"]) compare(surface[field], expected.collapsedDialog[field], field);
      assert.equal(surface.role, expected.collapsedDialog.role); assert.equal(surface.title, expected.collapsedDialog.title);
      assert.equal(surface.introText, expected.introText); assert.deepEqual(surface.buttons.map(b => b.text), expected.collapsedDialog.buttons.map(b => b.text));
      compare(surface.buttons[0].box, expected.collapsedDialog.buttons[0].box, "reload");
      assert.equal(await page.evaluate(() => document.activeElement.getAttribute("role")), expected.activeRole);
      await page.getByRole("button", {name:"Fehlerdetails",exact:true}).click(); await capture("expanded");
      assert.equal(await page.locator("mat-expansion-panel h3").textContent(), `Fehlerbericht: ${expected.collapsedDialog.title}`);
      assert.equal(await page.locator("mat-expansion-panel h3 + p").textContent(), expected.errorDescription);
    } else {
      const fallback = page.locator(surfaceSelector); states[key] = {fallback:true};
      assert.equal(await fallback.getAttribute("role"), "alertdialog");
      assert.equal(await fallback.locator("h2").textContent(), expected.collapsedDialog.title);
      assert.equal(await fallback.locator("article > p").textContent(), expected.introText);
      await fallback.locator("summary").click();
      assert.equal(await fallback.locator("details p").textContent(), expected.errorDescription);
      await page.screenshot({path:join(artifacts, `${key}-fallback.png`),fullPage:true});
    }
    await page.keyboard.press("Escape"); assert.equal(await page.locator(surfaceSelector).count(), 1);
    await page.locator(failDialog ? surfaceSelector : ".cdk-overlay-backdrop").click({position:{x:5,y:5}});
    assert.equal(await page.locator(surfaceSelector).count(), 1);
    for (let i = 0; i < 5; i++) { await page.keyboard.press("Tab"); assert.equal(await page.evaluate(() => !!document.activeElement.closest("mat-dialog-container, #participantRuntimeErrorFallback")), true); }
    const current = await currentState(), runId = current.testRun.testRunId;
    const controllerLogsPath = workspace + `/test-logs?testRunId=${encodeURIComponent(runId)}&logKey=CONTROLLER&limit=100`;
    const countErrors = p => p.items.filter(i => i.testLog.logContent === "ERROR").length;
    if (!deliveryFailure) await poll(() => api(controllerLogsPath, undefined, operator), p => countErrors(p) === 1);
    assert.equal(current.testRun.status, "running");
    assert.deepEqual(current.testRun.lockedUnitKeys, []); assert.deepEqual(current.testRun.lockedTestletKeys, []);
    assert.deepEqual(current.testRun.unitResponses, {"unit-intro":packet}, "A rejected ready notification must preserve the exact existing answer packet.");
    const address = page.url();
    if (deliveryFailure) await Promise.race([blocked, delay(10_000).then(() => {throw Error("Owned startup save did not start");})]);
    await page.locator("#participantRouteControllerReloadButton").click();
    if (deliveryFailure) {
      if (deliveryFailure === "reject") await poll(async () => attempts, n => n >= 3);
      await delay(350);
      assert.equal(page.url(), address); assert.equal(await element.evaluate(el => el.isConnected), true);
      assert.equal(await page.evaluate(() => !!localStorage.getItem("testcenter-rewrite:participant-save-outbox:v1")), true,
        `Startup save must remain durable: ${JSON.stringify(interceptedSaves)}`);
      if (deliveryFailure === "delay") releaseSave();
      else { allowSave = true; await page.locator("#participantRouteControllerReloadButton").click(); }
    }
    await poll(async () => element.evaluate(el => el.isConnected).catch(() => false), connected => !connected);
    await page.locator(surfaceSelector).waitFor();
    assert.equal(await page.locator("iframe").count(), 1);
    assert.equal((await page.locator(surfaceSelector + " h2").textContent()).trim(), expected.collapsedDialog.title);
    const link = new URL(page.url()); assert.equal(link.searchParams.get("ui"), "original"); assert.equal(link.searchParams.get("testRunId"), runId);
    assert.equal(link.searchParams.get("participantSessionId"), identity.participantSession.participantSessionId);
    await poll(() => api(controllerLogsPath, undefined, operator), p => countErrors(p) === 2);
    const reloaded = await currentState();
    assert.equal(reloaded.testRun.status, "running"); assert.deepEqual(reloaded.testRun.unitResponses, current.testRun.unitResponses);
    assert.deepEqual(reloaded.testRun.lockedUnitKeys, []); assert.deepEqual(reloaded.testRun.lockedTestletKeys, []);
    assert.equal(reloaded.testRun.testletTimers.timed.status, "running");
    await context.close(); console.log(`original_player_version_error=${key}:passed`);
  }
  assert.deepEqual(errors, []); failureGate.assertHealthy();
} finally {
  await writeFile(join(artifacts, "player-version-error.json"), JSON.stringify({states,errors}, null, 2));
  await browser?.close(); server.kill("SIGTERM");
  await Promise.race([serverClosed, delay(10_000).then(() => {server.kill("SIGKILL");throw Error("Owned API shutdown timed out");})]);
  failureGate.assertHealthy(); console.log("owned_api=shutdown");
}
