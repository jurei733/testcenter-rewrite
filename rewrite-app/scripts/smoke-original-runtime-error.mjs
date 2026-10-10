import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { parseVeronaUnitResponse } from "@testcenter-rewrite-app/contracts";
import { localDemoSourcePackage } from "../apps/api/dist/apps/api/src/local-demo-bootstrap.js";
import { runtimeErrorPlayer } from "./runtime-error-fixture.mjs";
import { createServerRequestFailureGate } from "./server-request-failure-gate.mjs";

const root = resolve(process.env.UI_SMOKE_FRONTEND_ROOT || ".");
await access(join(root, "dist/apps/web/browser/index.html"));
const reference = JSON.parse(await readFile(new URL("./fixtures/original-runtime-error.json", import.meta.url), "utf8"));
assert.equal(reference.referenceRevision, "ee2ab9ab64bd91209ef8534bbe6005838024e46d");
const artifacts = await mkdtemp(join(tmpdir(), "testcenter-runtime-error-"));
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
const replacementMode = process.env.UI_SMOKE_RUNTIME_REPLACEMENT;
assert.ok(!replacementMode || ["success", "reject"].includes(replacementMode));
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
    const [, theme, screen] = key.match(/^run-hot-return-(Primar|Sekundar|Erwachsene)-(desktop|mobile)-forbidden-false$/);
    const workspaceKey = `runtime-${key.toLowerCase()}`, workspace = `/api/v1/tenants/demo-tenant/workspaces/${workspaceKey}`;
    await api("/api/v1/tenants/demo-tenant/workspaces", {workspaceKey,displayName:workspaceKey}, operator);
    const content = JSON.parse(localDemoSourcePackage.sourceDocument);
    content.playerEntries[0].html = runtimeErrorPlayer(content.playerEntries[0].html);
    content.bookletEntries = [{bookletKey:"owned-exit",displayLabel:"Logo Testheft",config:{silent_mode:"FALSE",
      force_presentation_complete:"ALWAYS",force_response_complete:"ALWAYS",toolbar_show_unit_list:"FALSE",
      toolbar_show_fullscreen_button:"FALSE",toolbar_show_reload_button:"FALSE",navbar_unit_label:"HIDDEN",navbar_page_label:"HIDDEN"},
      testletEntries:[{testletKey:"timed",displayLabel:"Zeitblock",parentTestletKey:null,
        restrictions:{timeMax:{minutes:5,leave:"forbidden"},lockAfterLeaving:{scope:"unit",confirm:true}}}],
      unitEntries:[{...content.bookletEntries[0].unitEntries[0],displayLabel:"Logo Aufgabe",testletPath:["timed"]}]}];
    const source = await api(workspace + "/source-packages", {fileName:"runtime.json",mediaType:"application/json",contentStructure:content}, operator);
    const imported = await api(workspace + "/import-jobs", {sourcePackageId:source.sourcePackage.sourcePackageId}, operator);
    await api(workspace + `/content-releases/${imported.stagedContentRelease.contentReleaseId}/activate`, {activatedByActorId:"runtime-proof"}, operator);
    await api(workspace + "/participant-roster", {rosterText:'<Testtakers><Group id="owned" label="Exit Group"><Login mode="run-hot-return" name="exit-person"><Booklet>owned-exit</Booklet></Login></Group></Testtakers>'}, operator);
    await api("/api/v1/admin/application-settings", {themeName:theme}, operator, "PATCH");
    const context = await browser.newContext({viewport:screen === "desktop" ? {width:1280,height:720} : {width:390,height:844},locale:"de-DE"});
    if (failDialog) {
      const assets = await readdir(join(root, "dist/apps/web/browser"));
      const matches = [];
      for (const asset of assets.filter(a => a.endsWith(".js"))) {
        if (/selectors:\s*\[\s*\[\s*"app-original-participant-error-launcher"/.test(await readFile(join(root, "dist/apps/web/browser", asset), "utf8"))) matches.push(asset);
      }
      assert.equal(matches.length, 1, "The actual error-dialog lazy bundle must be unambiguous.");
      await context.route(`**/${matches[0]}`, route => route.abort("failed"));
    }
    const page = await context.newPage(); page.on("pageerror", error => errors.push({key,error:String(error)}));
    await page.goto(`${base}/app/participant?ui=original&theme=${theme}&tenantKey=demo-tenant&workspaceKey=${workspaceKey}`, {waitUntil:"networkidle"});
    await page.locator("#originalLoginName").fill("exit-person");
    const [signedIn] = await Promise.all([
      page.waitForResponse(r => new URL(r.url()).pathname === "/api/v1/participant/auth/sign-in" && r.request().method() === "POST"),
      page.getByRole("button", {name:"Weiter",exact:true}).click()
    ]);
    const identity = await signedIn.json(), token = identity.sessionToken;
    const currentPath = `/api/v1/participant/sessions/${identity.participantSession.participantSessionId}/current-state`;
    const currentState = async () => (await api(currentPath, undefined, token)).currentRunState;
    const frame = page.frameLocator("iframe"); await frame.locator("#ownedRuntimeError").waitFor();
    const element = await page.locator("iframe").elementHandle();
    const answer = `Own incomplete ${key} Ω  whitespace`;
    await frame.locator("#demoPlayerAnswer").fill(answer);
    await frame.locator("#exitPresentation").selectOption("some"); await frame.locator("#exitResponse").selectOption("none");
    const current = await poll(currentState, s => {
      const p = parseVeronaUnitResponse(s.testRun.unitResponses["unit-intro"] || "");
      return p?.unitState.presentationProgress === "some" && p.unitState.responseProgress === "none" && p.unitState.dataParts.answer === answer;
    });
    const runId = current.testRun.testRunId, packet = current.testRun.unitResponses["unit-intro"];
    // An unrelated window cannot send a trusted Player error.
    await page.evaluate(() => window.postMessage({type:"vopRuntimeErrorNotification",sessionId:"wrong-session",code:"runtime-error",message:"untrusted"}, "*"));
    await delay(200);
    assert.equal(await page.locator("mat-dialog-container").count(), 0);
    await frame.locator("#ownedRuntimeError").click(); await page.locator(failDialog ? "#participantRuntimeErrorFallback" : "mat-dialog-container").waitFor();
    assert.equal(await element.evaluate(el => el.isConnected), expected.iframePreserved);
    assert.equal(await page.locator("#participantRouteControllerErrorState").count(), 0);
    assert.equal(await page.locator("mat-card").count(), expected.cardCount);
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
    await page.keyboard.press("Escape"); assert.equal(await page.locator("mat-dialog-container").count(), 1);
    await page.locator(".cdk-overlay-backdrop").click({position:{x:5,y:5}}); assert.equal(await page.locator("mat-dialog-container").count(), 1);
    const expansion = page.getByRole("button", {name:"Fehlerdetails",exact:true});
    await expansion.focus(); await page.keyboard.press("Enter");
    await page.locator("mat-expansion-panel").filter({hasText:expected.errorDescription}).waitFor();
    await capture("expanded");
    assert.ok((await page.locator("mat-expansion-panel").innerText()).includes(expected.errorDescription));
    } else {
      const fallback = page.locator("#participantRuntimeErrorFallback");
      assert.equal(await fallback.getAttribute("role"), "alertdialog");
      assert.equal(await fallback.locator("h2").textContent(), expected.collapsedDialog.title);
      assert.equal(await fallback.locator("article > p").textContent(), expected.introText);
      await page.keyboard.press("Escape"); assert.equal(await fallback.count(), 1);
      await fallback.click({position:{x:5,y:5}}); assert.equal(await fallback.count(), 1);
      await fallback.locator("summary").click();
      assert.equal(await fallback.locator("details p").innerText(), expected.errorDescription);
      await page.waitForFunction(() => !!document.activeElement.closest("#participantRuntimeErrorFallback"));
      await page.screenshot({path:join(artifacts, `${key}-fallback.png`),fullPage:true});
      states[key] = {fallback:true};
    }
    await frame.locator("#ownedRuntimeError").evaluate(button => {button.dataset.message = "Second owned runtime Ω"; button.click();});
    await delay(700);
    assert.equal(await page.locator(failDialog ? "#participantRuntimeErrorFallback" : "mat-dialog-container").count(), expected.repeatedDialogCount);
    assert.ok(!(await page.locator(failDialog ? "#participantRuntimeErrorFallback details" : "mat-expansion-panel").innerText()).includes("Second owned runtime Ω"));
    for (let i = 0; i < 5; i++) { await page.keyboard.press("Tab"); assert.equal(await page.evaluate(() => !!document.activeElement.closest("mat-dialog-container, #participantRuntimeErrorFallback")), true); }
    const unitLogsPath = workspace + `/test-logs?testRunId=${encodeURIComponent(runId)}&logKey=${encodeURIComponent("Runtime Error: runtime-error")}&unitKey=unit-intro`;
    const controllerLogsPath = workspace + `/test-logs?testRunId=${encodeURIComponent(runId)}&logKey=CONTROLLER&limit=100`;
    const runtimeLogs = await poll(() => api(unitLogsPath, undefined, operator), p => p.items.length === expected.repeatedRuntimeLogCount);
    assert.deepEqual(runtimeLogs.items.map(i => i.testLog.logContent).sort(), [expected.errorDescription,"Second owned runtime Ω"].sort());
    await poll(() => api(controllerLogsPath, undefined, operator), p => p.items.filter(i => i.testLog.logContent === "ERROR").length === 1);
    const failed = await currentState();
    assert.equal(failed.testRun.status, "running"); assert.equal(failed.testRun.unitResponses["unit-intro"], packet);
    assert.deepEqual(failed.testRun.lockedUnitKeys, []); assert.deepEqual(failed.testRun.lockedTestletKeys, []);
    let expectedPacket = packet, expectedAnswer = answer;
    let expectedRuntimeLogCount = expected.repeatedRuntimeLogCount;
    if (replacementMode) {
      const lateError = "Third owned runtime log during replacement Ω";
      const writes = [];
      let releaseSave, saveStarted;
      const blocked = new Promise(done => {saveStarted = done;});
      const gate = new Promise(done => {releaseSave = done;});
      let held = false;
      await context.route(`**/api/v1/participant/test-runs/${encodeURIComponent(runId)}/save-progress`, async route => {
        const body = route.request().postDataJSON();
        writes.push(body);
        if (!held && body.logs?.some(batch => batch.entries.some(entry => entry.content === lateError))) {
          held = true;
          saveStarted(body);
          await gate;
          if (replacementMode === "reject") {
            await route.fulfill({status:503,contentType:"application/json",body:'{"error":"owned_old_packet_unavailable"}'});
            return;
          }
        }
        await route.continue();
      });
      await frame.locator("#ownedRuntimeError").evaluate((button, message) => {
        button.dataset.message = message; button.click();
      }, lateError);
      const older = await Promise.race([blocked, delay(10_000).then(() => {throw Error("Owned log-bearing delivery did not start");})]);
      expectedAnswer += " newer packet Ω";
      await frame.locator("#demoPlayerAnswer").evaluate((input, value) => {
        input.value = value; input.dispatchEvent(new Event("input", {bubbles:true}));
      }, expectedAnswer);
      const replacement = await poll(() => page.evaluate(() => {
        const raw = localStorage.getItem("testcenter-rewrite:participant-save-outbox:v1");
        return raw ? JSON.parse(raw).entries : [];
      }), entries => entries.some(entry => entry.testRunId === runId &&
        parseVeronaUnitResponse(entry.response)?.unitState.dataParts.answer === expectedAnswer));
      const latest = replacement.find(entry => entry.testRunId === runId && entry.unitKey === "unit-intro");
      expectedPacket = latest.response;
      const lateEntries = logs => logs.flatMap(batch => batch.entries).filter(entry => entry.content === lateError);
      assert.notEqual(latest.deliveryId, older.deliveryId);
      assert.equal(lateEntries(older.logs).length, 1);
      assert.deepEqual(lateEntries(latest.logs), lateEntries(older.logs), "The replacement must retain the exact original log identity before the older request settles.");
      assert.ok(lateEntries(latest.logs)[0].clientEntryId);
      const address = page.url();
      await page.locator("#participantRouteControllerReloadButton").click();
      await delay(350);
      assert.equal(page.url(), address);
      assert.equal(await element.evaluate(el => el.isConnected), true);
      assert.equal((await currentState()).testRun.unitResponses["unit-intro"], packet);
      releaseSave();
      await poll(currentState, state => state.testRun.unitResponses["unit-intro"] === expectedPacket);
      const delivered = writes.filter(body => body.unitResponse === expectedPacket);
      assert.ok(delivered.length > 0);
      assert.deepEqual(lateEntries(delivered.at(-1).logs), lateEntries(older.logs));
      expectedRuntimeLogCount++;
      const stored = await poll(() => api(unitLogsPath, undefined, operator), result => result.items.length === expectedRuntimeLogCount);
      assert.equal(stored.items.filter(item => item.testLog.logContent === lateError).length, 1);
      await page.waitForFunction(() => localStorage.getItem("testcenter-rewrite:participant-save-outbox:v1") === null);
      states[key].replacement = {olderResult:replacementMode, exactLogIdentityPreserved:true, runtimeLogCount:stored.items.length};
    } else if (saveFailure) {
      expectedAnswer += " late save Ω";
      let releaseSave, saveStarted;
      const blocked = new Promise(done => {saveStarted = done;});
      const gate = new Promise(done => {releaseSave = done;});
      let allowSave = false, attempts = 0;
      await context.route(`**/api/v1/participant/test-runs/${encodeURIComponent(runId)}/save-progress`, async route => {
        const body = route.request().postDataJSON();
        expectedPacket = body.unitResponse; attempts++; saveStarted();
        if (saveFailure === "delay") { await gate; await route.continue(); }
        else if (!allowSave) await route.fulfill({status:503,contentType:"application/json",body:'{"error":"owned_save_unavailable"}'});
        else await route.continue();
      });
      await frame.locator("#demoPlayerAnswer").evaluate((input, value) => {
        input.value = value; input.dispatchEvent(new Event("input", {bubbles:true}));
      }, expectedAnswer);
      await Promise.race([blocked, delay(10_000).then(() => {throw Error("Owned late save did not start");})]);
      const address = page.url();
      await page.locator("#participantRouteControllerReloadButton").click();
      if (saveFailure === "reject") await poll(async () => attempts, n => n >= 3);
      await delay(350);
      assert.equal(page.url(), address, "An unsettled save cannot change the entry URL.");
      assert.equal(await element.evaluate(el => el.isConnected), true, "An unsettled save cannot reload the active frame.");
      assert.equal((await currentState()).testRun.unitResponses["unit-intro"], packet);
      assert.equal(await page.evaluate(value => localStorage.getItem("testcenter-rewrite:participant-save-outbox:v1")?.includes(value), expectedAnswer), true);
      if (saveFailure === "reject") {
        allowSave = true;
        await page.locator("#participantRouteControllerReloadButton").click();
      } else releaseSave();
    } else await page.locator("#participantRouteControllerReloadButton").click();
    await frame.locator("#ownedRuntimeError").waitFor(); await page.locator("mat-dialog-container, #participantRuntimeErrorFallback").waitFor({state:"detached"});
    assert.equal(await frame.locator("#demoPlayerAnswer").inputValue(), expectedAnswer);
    assert.equal(await frame.locator("#exitPresentation").inputValue(), "some"); assert.equal(await frame.locator("#exitResponse").inputValue(), "none");
    const link = new URL(page.url()); assert.equal(link.searchParams.get("ui"), "original"); assert.equal(link.searchParams.get("testRunId"), runId);
    assert.equal(link.searchParams.get("participantSessionId"), identity.participantSession.participantSessionId);
    const recovered = await poll(() => api(controllerLogsPath, undefined, operator), p => p.items.some(i => i.testLog.logContent === "RUNNING"));
    assert.equal(recovered.items.filter(i => i.testLog.logContent === "ERROR").length, expected.controllerErrorWriteCount);
    assert.equal((await api(unitLogsPath, undefined, operator)).items.length, expectedRuntimeLogCount);
    assert.equal((await currentState()).testRun.unitResponses["unit-intro"], expectedPacket);
    await context.close(); console.log(`original_runtime_error=${key}:passed`);
  }
  assert.deepEqual(errors, []); failureGate.assertHealthy();
} finally {
  await writeFile(join(artifacts, "runtime-error.json"), JSON.stringify({states,errors}, null, 2));
  await browser?.close(); server.kill("SIGTERM");
  await Promise.race([serverClosed, delay(10_000).then(() => {server.kill("SIGKILL");throw Error("Owned API shutdown timed out");})]);
  failureGate.assertHealthy(); console.log("owned_api=shutdown");
}
