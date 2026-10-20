import { loadOriginalVisualReference, assertOriginalVisualBrowser } from "./qualified-original-visuals.mjs";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { createServerRequestFailureGate } from "./server-request-failure-gate.mjs";

// Source header link and settled tooltip, plus real authorized Starter entry.
// Own the API/SQLite. Never consume or reset the interactive participant DB.
const frontendRoot = resolve(process.env.UI_SMOKE_FRONTEND_ROOT || ".");
await access(join(frontendRoot, "dist/apps/web/browser/index.html"));
const artifacts = await mkdtemp(join(tmpdir(), "testcenter-original-header-"));
process.stdout.write(`owned_artifacts=${artifacts}\n`);
const serverFailureGate = createServerRequestFailureGate();
const apiModule = pathToFileURL(resolve("apps/api/dist/apps/api/src/index.js")).href;
const server = spawn(process.execPath, ["--input-type=module", "-e", `
  import { createProductionApiServer } from ${JSON.stringify(apiModule)};
  const server = await createProductionApiServer();
  server.listen(0, "127.0.0.1", () => process.send({ port: server.address().port }));
  process.once("SIGTERM", () => server.close(() => process.exit(0)));
`], {
  cwd: frontendRoot,
  env: { ...process.env, PORT: "4310", FIRST_SLICE_STORE: "sqlite",
    FIRST_SLICE_SQLITE_FILE: join(artifacts, "store.sqlite"), FIRST_SLICE_BOOTSTRAP_DEMO: "true",
    FIRST_SLICE_OPERATOR_AUTH_REQUIRED: "true", FIRST_SLICE_PROOF_OF_WORK_SCOPES: "",
    FIRST_SLICE_XML_SCHEMA_PROFILE: "legacy-compatibility", REQUIRE_LOGIN_PASSWORD: "false" },
  stdio: ["ignore", "pipe", "pipe", "ipc"]
});
serverFailureGate.observeStream(server.stdout);
serverFailureGate.observeStream(server.stderr);
const serverClosed = new Promise(done => server.once("close", done));
let browser;
const errors = [];
const metrics = {};
const reference = await loadOriginalVisualReference("original-header-logo");
assert.equal(reference.referenceRevision, "ee2ab9ab64bd91209ef8534bbe6005838024e46d");
const fixtures = {};
try {
  const port = await new Promise((done, reject) => {
    const timer = setTimeout(() => reject(new Error("Owned API startup timed out.")), 20_000);
    server.once("message", message => { clearTimeout(timer); done(message.port); });
    server.once("error", error => { clearTimeout(timer); reject(error); });
    server.once("exit", () => { clearTimeout(timer); reject(new Error("Owned API exited before ready.")); });
  });
  const baseUrl = `http://127.0.0.1:${port}`;
  let token;
  const api = async (path, body, method = body === undefined ? "GET" : "POST") => {
    const response = await fetch(`${baseUrl}${path}`, { method,
      headers: { ...(body === undefined ? {} : { "content-type": "application/json" }),
        ...(token ? { authorization: `Bearer ${token}` } : {}) },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }) });
    assert.ok(response.ok, `${method} ${path}: ${response.status}`);
    return response.status === 204 ? null : response.json();
  };
  token = (await api("/api/v1/admin/auth/sign-in", {
    username: "demo-admin", password: "demo-admin-password"
  })).sessionToken;
  const operatorToken = token;
  for (const mode of ["run-hot-return", "run-demo", "run-review", "run-simulation"]) {
    const workspaceKey = `header-${mode}`, workspace = `/api/v1/tenants/demo-tenant/workspaces/${workspaceKey}`;
    await api("/api/v1/tenants/demo-tenant/workspaces", { workspaceKey, displayName: mode });
    const source = await api(`${workspace}/source-packages`, {
      fileName: "header.json", mediaType: "application/json", contentStructure: { bookletEntries: [0, 1].map(index => ({
        bookletKey: `header-${index}`, displayLabel: `Header ${index}`,
        unitEntries: [0, 1].map(unit => ({ unitKey: `header-unit-${index}-${unit}`, displayLabel: `Unit ${unit}` }))
      })) }
    });
    const imported = await api(`${workspace}/import-jobs`, { sourcePackageId: source.sourcePackage.sourcePackageId });
    await api(`${workspace}/content-releases/${imported.stagedContentRelease.contentReleaseId}/activate`, { activatedByActorId: "owned-header-smoke" });
    await api(`${workspace}/participant-roster`, { rosterText: `<Testtakers><Group id="header"><Login mode="${mode}" name="header-person"><Booklet>header-0</Booklet><Booklet>header-1</Booklet></Login><Login mode="${mode}" name="header-other"><Booklet>header-0</Booklet></Login></Group></Testtakers>` });
    fixtures[mode] = { workspaceKey };
  }
  const headful = ["1", "true", "yes", "on"].includes(String(process.env.UI_SMOKE_HEADFUL || "").toLowerCase());
  browser = await chromium.launch({ headless: process.env.CI === "true" && !headful });
  assertOriginalVisualBrowser(browser, reference);

  for (const theme of ["Primar", "Sekundar", "Erwachsene"]) {
    await api("/api/v1/admin/application-settings", { themeName: theme }, "PATCH");
    for (const [screen,width,height] of [["desktop",1280,720],["mobile",390,844],["toolbar-small",599,844],["toolbar-large",600,844]]) {
      const context = await browser.newContext({viewport:{width,height},locale:"de-DE"});
      const page = await context.newPage();
      page.on("pageerror", e=>errors.push(String(e)));
      await page.goto(`${baseUrl}/app/participant?ui=original&tenantKey=demo-tenant&workspaceKey=demo-workspace`,{waitUntil:"networkidle"});
      const logo=page.locator('#participantApplicationLogoButton'),name=page.locator('#originalLoginName');
      await logo.waitFor(); await name.waitFor(); await page.evaluate(()=>document.fonts.ready);
      assert.equal(await logo.evaluate(e=>e.tagName),"A");
      assert.equal(await logo.getAttribute('aria-label'),"Gehe zur Startseite");
      assert.equal(await logo.locator('img').getAttribute('alt'),"Logo der Anwendung");
      const href=new URL(await logo.getAttribute('href'),baseUrl);
      assert.equal(href.pathname,"/app/participant");
      assert.equal(href.searchParams.get('tenantKey'),"demo-tenant");
      assert.equal(href.searchParams.get('workspaceKey'),"demo-workspace");
      assert.equal(href.searchParams.get('ui'),"original");
      assert.equal(href.searchParams.has('loginKey'),false);
      await logo.hover();const tooltip=page.locator('.mat-mdc-tooltip-surface');await tooltip.waitFor();
      await page.waitForFunction(() => document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity).every(animation => animation.playState === "finished" || animation.playState === "idle"));
      metrics[`${theme}-${screen}`]=await tooltip.evaluate(element=>{
        const b=element.getBoundingClientRect(),st=getComputedStyle(element);
        return {text:element.textContent.trim(),x:b.x,y:b.y,width:b.width,height:b.height,color:st.color,background:st.backgroundColor,font:st.font,lineHeight:st.lineHeight,padding:st.padding,borderRadius:st.borderRadius};
      });
      assert.deepEqual(metrics[`${theme}-${screen}`], reference.measurements[`${theme}-${screen}`]);
      await page.screenshot({path:join(artifacts,`${theme}-${screen}-tooltip.png`),fullPage:true});
      await page.mouse.move(0,height/2);await tooltip.waitFor({state:"hidden"});
      await name.fill(`owned-header-${theme}-${screen}`);
      await page.getByRole('button',{name:'Weiter',exact:true}).click();await page.locator('#originalLoginPassword').waitFor();
      await page.locator('#originalLoginPassword').fill('owned-password');
      await logo.focus();await page.keyboard.press('Enter');await page.waitForLoadState('networkidle');await name.waitFor();
      assert.equal(await name.inputValue(),"");assert.equal(await page.evaluate(()=>document.activeElement.tagName),"BODY");
      assert.equal(await page.locator('#originalLoginPassword').count(),0);
      const persisted=await page.evaluate(()=>JSON.parse(localStorage.getItem('testcenter-rewrite-app-shell')||'{}'));
      assert.equal(persisted.loginKey,"");
      await name.fill('owned-modified-reset');
      const [popup]=await Promise.all([context.waitForEvent('page'),logo.click({modifiers:['ControlOrMeta']})]);
      popup.on('pageerror',e=>errors.push(String(e)));await popup.waitForLoadState('networkidle');await page.waitForLoadState('networkidle');
      await name.waitFor();const popupName=popup.locator('#originalLoginName');await popupName.waitFor();
      assert.equal(await name.inputValue(),"");assert.equal(await popupName.inputValue(),"");
      await popup.close();await context.close();console.log(`original_header_login=${theme}/${screen}:passed`);
      const adminContext = await browser.newContext({ viewport: {width, height}, locale: "de-DE" });
      const adminPage = await adminContext.newPage(); adminPage.on("pageerror", error => errors.push(String(error)));
      await adminPage.goto(`${baseUrl}/app/ops?ui=original`, {waitUntil:"networkidle"});
      await adminPage.locator("#adminUsername").fill("owned-header-admin");
      await adminPage.locator("#adminPassword").fill("owned-admin-password");
      const adminLogo = adminPage.locator("#participantApplicationLogoButton");
      await adminLogo.focus(); await adminPage.keyboard.press("Enter");
      await adminPage.waitForLoadState("networkidle"); await adminPage.locator("#originalLoginName").waitFor();
      assert.equal(await adminPage.locator("#originalLoginName").inputValue(), "");
      await adminPage.goto(`${baseUrl}/app/ops?ui=original`, {waitUntil:"networkidle"});
      await adminPage.locator("#adminUsername").fill("owned-modified-admin");
      const [adminPopup] = await Promise.all([adminContext.waitForEvent("page"), adminLogo.click({modifiers:["ControlOrMeta"]})]);
      adminPopup.on("pageerror", error => errors.push(String(error)));
      await adminPopup.waitForLoadState("networkidle"); await adminPage.waitForLoadState("networkidle");
      for (const tab of [adminPage, adminPopup]) { await tab.locator("#originalLoginName").waitFor(); assert.equal(await tab.locator("#originalLoginName").inputValue(), ""); }
      await adminContext.close(); console.log(`original_header_admin=${theme}/${screen}:passed`);
    }
  }
  for (const [mode, fixture] of Object.entries(fixtures)) {
    for (const hasRun of [false, true]) {
      token = operatorToken;
      const context = await browser.newContext({ viewport: {width:1280, height:720}, locale:"de-DE" });
      const page = await context.newPage(); page.on("pageerror", error => errors.push(String(error)));
      await page.goto(`${baseUrl}/app/participant?ui=original&tenantKey=demo-tenant&workspaceKey=${fixture.workspaceKey}`, {waitUntil:"networkidle"});
      await page.locator("#originalLoginName").fill("header-person");
      const signedIn = page.waitForResponse(response => new URL(response.url()).pathname === "/api/v1/participant/auth/sign-in" && response.request().method() === "POST");
      await page.getByRole("button", {name:"Weiter", exact:true}).click();
      const identityResponse = await signedIn; assert.equal(identityResponse.status(),200); const identity = await identityResponse.json();
      await page.locator("#originalParticipantStarter mat-card").first().waitFor();
      const sessionId = identity.participantSession.participantSessionId, sessionPath = `/api/v1/participant/sessions/${sessionId}`;
      token = identity.sessionToken;
      if (hasRun) {
        const started = await api(`${sessionPath}/resume`, {bookletKey:"header-0"});
        await api(`/api/v1/participant/test-runs/${started.testRun.testRunId}/save-progress`, {
          currentUnitKey:"header-unit-0-1", unitResponse:`Owned header response ${mode}`, status:"running"
        });
      }
      const before = await api(`${sessionPath}/runtime-state`);
      const outbox = JSON.stringify({version:1,entries:before.runtimeState.latestTestRun ? [{version:1,deliveryId:"owned-header-outbox",testRunId:before.runtimeState.latestTestRun.testRunId,unitKey:"header-unit-0-1",response:"Owned pending response from another tab",status:"running",logs:[],queuedAt:new Date().toISOString()}] : []});
      await page.evaluate(value=>localStorage.setItem("testcenter-rewrite:participant-save-outbox:v1",value),outbox);
      const logo = page.locator("#participantApplicationLogoButton");
      const href = new URL(await logo.getAttribute("href"), baseUrl);
      assert.equal(href.searchParams.get("participantSessionId"),sessionId); assert.equal(href.searchParams.get("view"),"starter");
      assert.deepEqual([...href.searchParams.keys()].sort(),["participantSessionId","tenantKey","ui","view","workspaceKey"]);
      let popupEvents=0;context.on("page",()=>popupEvents++);
      const originMutations=[]; page.on("request", request => { if (new URL(request.url()).pathname.startsWith("/api/v1/participant/") && !["GET","HEAD"].includes(request.method())) originMutations.push({method:request.method(),path:new URL(request.url()).pathname}); });
      await logo.click({modifiers:["ControlOrMeta"]}); await delay(150);
      assert.equal(popupEvents,0);assert.deepEqual(originMutations,[]);
      const copied = await context.newPage(); copied.on("pageerror", error => errors.push(String(error)));
      const requests=[];copied.on("request", request => { const pathname=new URL(request.url()).pathname;if(pathname.startsWith("/api/v1/participant/"))requests.push({method:request.method(),path:pathname}); });
      await copied.goto(href.href,{waitUntil:"networkidle"}); await copied.locator("#originalParticipantStarter mat-card").first().waitFor();
      assert.equal(await copied.locator("#participantRouteUnit").count(),0);
      assert.ok(requests.some(request=>request.method==="GET"&&request.path===`${sessionPath}/runtime-state`));
      assert.deepEqual(requests.filter(request=>!['GET','HEAD'].includes(request.method) && !request.path.endsWith('/presence')),[]);
      assert.equal(await copied.evaluate(()=>localStorage.getItem("testcenter-rewrite:participant-save-outbox:v1")),outbox);
      const after = await api(`${sessionPath}/runtime-state`);
      assert.deepEqual(after.runtimeState.latestTestRun,before.runtimeState.latestTestRun);
      const fresh = await browser.newContext({viewport:{width:1280,height:720},locale:"de-DE"}), denied=await fresh.newPage();
      denied.on("pageerror",error=>errors.push(String(error)));const deniedResponses=[];
      denied.on("response",response=>{if(new URL(response.url()).pathname===`${sessionPath}/runtime-state`)deniedResponses.push(response.status());});
      await denied.goto(href.href,{waitUntil:"networkidle"});assert.ok(deniedResponses.some(status=>[401,403].includes(status)));
      assert.equal(await denied.locator("#originalParticipantStarter mat-card").count(),0);
      await fresh.close();
      token = operatorToken;
      const foreign = await api("/api/v1/participant/auth/sign-in", {tenantKey:"demo-tenant",workspaceKey:fixture.workspaceKey,loginKey:"header-other"});
      token = identity.sessionToken;
      const foreignId = foreign.participantSession.participantSessionId;
      const foreignHref = new URL(href); foreignHref.searchParams.set("participantSessionId",foreignId);
      const foreignPage = await context.newPage(); foreignPage.on("pageerror",error=>errors.push(String(error)));
      const foreignResponses=[];
      foreignPage.on("response",response=>{if(new URL(response.url()).pathname===`/api/v1/participant/sessions/${foreignId}/runtime-state`)foreignResponses.push(response.status());});
      await foreignPage.goto(foreignHref.href,{waitUntil:"networkidle"});
      assert.ok(foreignResponses.some(status=>[401,403].includes(status)));
      assert.equal(await foreignPage.locator("#originalParticipantStarter mat-card").count(),0);
      assert.deepEqual((await api(`${sessionPath}/runtime-state`)).runtimeState.latestTestRun,before.runtimeState.latestTestRun);
      await context.close();console.log(`original_header_readonly_starter=${mode}/${hasRun?'running':'fresh'}:passed`);
    }
  }
  assert.deepEqual(errors,[]);
  await writeFile(join(artifacts,'header-metrics.json'),JSON.stringify({metrics,errors},null,2));
} finally {
  await browser?.close();
  if (server.exitCode === null) {
    const stopped=new Promise(done=>server.once('exit',done));server.kill('SIGTERM');
    await Promise.race([stopped,delay(5000)]);if(server.exitCode===null){server.kill('SIGKILL');await stopped;}
  }
  await serverClosed;
  console.log('owned_api=shutdown');
  serverFailureGate.assertHealthy();
}
