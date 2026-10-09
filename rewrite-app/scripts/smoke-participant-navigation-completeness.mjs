import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

// Own content and protected SQLite. Keep an older browser current-state read
// pending while a native Player input completes its answer, then navigate using
// the native host button. Every save and policy decision uses the real API.
const root = resolve(process.env.UI_SMOKE_FRONTEND_ROOT || ".");
await access(join(root, "dist/apps/web/browser/index.html"));
const artifacts = await mkdtemp(join(tmpdir(), "testcenter-navigation-completeness-"));
console.log(`owned_artifacts=${artifacts}`);
const { localDemoSourcePackage } = await import(pathToFileURL(join(root, "apps/api/dist/apps/api/src/local-demo-bootstrap.js")));
const entry = pathToFileURL(join(root, "apps/api/dist/apps/api/src/index.js")).href;
const server = spawn(process.execPath, ["--input-type=module", "-e", `
  import { createProductionApiServer } from ${JSON.stringify(entry)};
  const server = await createProductionApiServer();
  server.listen(0, '127.0.0.1', () => process.send({port:server.address().port}));
  process.once('SIGTERM',()=>server.close(()=>process.exit(0)));
`], { cwd: root, env: { ...process.env, FIRST_SLICE_STORE: "sqlite",
  FIRST_SLICE_SQLITE_FILE: join(artifacts, "store.sqlite"), FIRST_SLICE_BOOTSTRAP_DEMO: "true",
  FIRST_SLICE_OPERATOR_AUTH_REQUIRED: "true", FIRST_SLICE_PROOF_OF_WORK_SCOPES: "",
  FIRST_SLICE_XML_SCHEMA_PROFILE: "legacy-compatibility", REQUIRE_LOGIN_PASSWORD: "false" },
  stdio: ["ignore", "ignore", "inherit", "ipc"] });
let browser, activePage;
let releaseRead = () => {};
try {
  const port = await new Promise((done, reject) => {
    const timer = setTimeout(() => reject(Error("Owned navigation API startup timed out")), 20_000);
    server.once("message", ({port}) => { clearTimeout(timer); done(port); });
    server.once("error", error => { clearTimeout(timer); reject(error); });
  });
  const base = `http://127.0.0.1:${port}`;
  let token;
  const api = async (path, body, method = body === undefined ? "GET" : "POST") => {
    const response = await fetch(base + path, { method,
      headers: { ...(token ? {authorization:`Bearer ${token}`} : {}),
        ...(body === undefined ? {} : {"content-type":"application/json"}) },
      ...(body === undefined ? {} : {body:JSON.stringify(body)}) });
    assert.ok(response.ok, `${method} ${path}: ${response.status}`);
    return response.status === 204 ? null : response.json();
  };
  assert.equal((await fetch(base + "/api/v1/admin/users")).status, 401);
  token = (await api("/api/v1/admin/auth/sign-in", {username:"demo-admin", password:"demo-admin-password"})).sessionToken;
  const workspace = "/api/v1/tenants/demo-tenant/workspaces/owned-navigation";
  await api("/api/v1/tenants/demo-tenant/workspaces", {workspaceKey:"owned-navigation", displayName:"Own navigation"});
  const content = JSON.parse(localDemoSourcePackage.sourceDocument);
  content.bookletEntries[0].config = {
    ...content.bookletEntries[0].config, force_presentation_complete:"ALWAYS", force_response_complete:"ALWAYS",
    navbar_unit_label:"INDEX", navbar_unit_controls_hidden:"FALSE", navbar_page_label:"HIDDEN",
    unit_responses_buffer_time:"60000", unit_state_buffer_time:"60000"
  };
  const source = await api(workspace + "/source-packages", {fileName:"own-navigation.json", mediaType:"application/json", sourceDocument:JSON.stringify(content)});
  const imported = await api(workspace + "/import-jobs", {sourcePackageId:source.sourcePackage.sourcePackageId});
  await api(workspace + `/content-releases/${imported.stagedContentRelease.contentReleaseId}/activate`, {activatedByActorId:"own-navigation"});
  await api(workspace + "/participant-roster", {rosterText:["loginKey,groupKey,bookletKey,executionMode",
    ...["original-1280","original-390","rewrite-1280","rewrite-390","foreign"].map(key=>`${key},own-group,booklet:demo,run-hot-return`)].join("\n")});
  const foreignIdentity = await api("/api/v1/participant/auth/sign-in", {tenantKey:"demo-tenant",workspaceKey:"owned-navigation",loginKey:"foreign"});
  token = foreignIdentity.sessionToken;
  const foreign = await api(`/api/v1/participant/sessions/${foreignIdentity.participantSession.participantSessionId}/resume`, {bookletKey:"booklet:demo"});
  const foreignPath = `/api/v1/participant/sessions/${foreignIdentity.participantSession.participantSessionId}/current-state?testRunId=${foreign.testRun.testRunId}`;
  const foreignState = await api(foreignPath);
  const foreignBefore = JSON.stringify({session:foreignState.currentRunState.participantSession, run:foreignState.currentRunState.testRun});
  browser = await chromium.launch({headless:true});
  const errors = [];
  for (const mode of ["original","rewrite"]) for (const width of [1280,390]) {
    const context = await browser.newContext({viewport:{width,height:width===1280?720:844}});
    await context.addInitScript(()=>{
      globalThis.ownNavigationInputs=[];
      addEventListener("input",event=>{
        if(event.target?.id==="demoPlayerAnswer") globalThis.ownNavigationInputs.push({kind:"input",trusted:event.isTrusted});
      },true);
      addEventListener("click",event=>{
        const button=event.target?.closest?.("button");
        if(["originalUnitNavigation-forward","originalUnitNavigation-backward","participantRouteNextUnitButton","participantRoutePreviousUnitButton"].includes(button?.id))
          globalThis.ownNavigationInputs.push({kind:button.id,trusted:event.isTrusted});
      },true);
    });
    const page = await context.newPage(); activePage = page;
    page.on("pageerror", error=>errors.push(String(error)));
    await page.goto(base + `/app/participant?ui=${mode}&tenantKey=demo-tenant&workspaceKey=owned-navigation`);
    await (mode==="original" ? page.getByLabel("Anmeldename",{exact:true}) : page.locator("#participantLoginKey")).fill(`${mode}-${width}`);
    const signedIn = page.waitForResponse(response=>response.url().endsWith("/participant/auth/sign-in") && response.request().method()==="POST");
    await (mode==="original" ? page.getByRole("button",{name:"Weiter",exact:true}) : page.locator("#participantRouteSignInButton")).click();
    const identity = await (await signedIn).json(); token = identity.sessionToken;
    const sessionId = identity.participantSession.participantSessionId;
    assert.notEqual(sessionId, foreignIdentity.participantSession.participantSessionId);
    const own = await api(`/api/v1/participant/sessions/${sessionId}/resume`, {bookletKey:"booklet:demo"});
    const runId = own.testRun.testRunId;
    const currentPath = `/api/v1/participant/sessions/${sessionId}/current-state?testRunId=${runId}`;
    const savePath = `/api/v1/participant/test-runs/${runId}/save-progress`;
    const denied = await fetch(base+savePath, {method:"POST",headers:{authorization:`Bearer ${token}`,"content-type":"application/json"},
      body:JSON.stringify({status:"running", currentUnitKey:"unit-practice"})});
    assert.equal(denied.status,409);
    assert.equal((await denied.json()).error,"booklet_navigation_denied");
    assert.equal((await fetch(base+foreignPath,{headers:{authorization:`Bearer ${token}`}})).status,401);
    await page.goto(base+`/app/participant?ui=${mode}&participantSessionId=${sessionId}&testRunId=${runId}`);
    const frame = page.frameLocator("#participantVeronaPlayerFrame");
    await frame.locator("#demoPlayerAnswer").waitFor();
    const ownPackets={};
    let currentReadGate=null;
    // Retain the handler until its held requests have completed. Removing an
    // active Playwright route can otherwise race its already-handled request.
    const holdRead = async route=>{const gate=currentReadGate; if(gate) await gate; await route.continue();};
    await page.route(base+currentPath,holdRead);
    for (const [target,button] of [["unit-practice",mode==="original"?"#originalUnitNavigation-forward":"#participantRouteNextUnitButton"],
      ["unit-intro",mode==="original"?"#originalUnitNavigation-backward":"#participantRoutePreviousUnitButton"]]) {
      let finishRead;
      const readGate = new Promise(done=>{finishRead=done;});
      currentReadGate=readGate;
      releaseRead=finishRead;
      const unitKey=(await page.locator("#participantRouteUnitKey").textContent()).trim();
      const before=await api(currentPath);
      const direction=target==="unit-practice"?"forward":"backward";
      assert.ok(before.currentRunState.navigation[`${direction}DeniedReasons`].length>0);
      const answer=`Own ${mode} ${width} ${unitKey}\n ä🙂 whitespace  `;
      await frame.locator("#demoPlayerAnswer").fill(answer);
      const packet=await page.waitForFunction(({runId,unitKey,answer})=>{
        const outbox=JSON.parse(localStorage.getItem("testcenter-rewrite:participant-save-outbox:v1") || "{}");
        const entry=outbox.entries?.find(entry=>entry.testRunId===runId && entry.unitKey===unitKey);
        const response=JSON.parse(entry?.response || "{}");
        return response.unitState?.presentationProgress==="complete" && response.unitState?.responseProgress==="complete" &&
          response.unitState.dataParts.answer===answer ? entry.response : false;
      },{runId,unitKey,answer});
      const exactResponse=await packet.jsonValue();
      ownPackets[unitKey]=exactResponse;
      assert.equal(await frame.locator("#demoPlayerAnswer").evaluate(()=>globalThis.ownNavigationInputs.at(-1)?.trusted),true);
      const navigation=page.waitForResponse(response=>response.url()===base+savePath && response.request().method()==="POST" &&
        response.request().postDataJSON()?.currentUnitKey===target,{timeout:15_000})
        .then(response=>({response}),error=>({error}));
      console.log(`native_navigation_attempt=${mode}:${width}:${direction}:completed-own-packet`);
      await page.screenshot({path:join(artifacts,`${mode}-${width}-${direction}-before.png`)});
      await page.locator(button).click();
      assert.equal(await page.evaluate(button=>globalThis.ownNavigationInputs.findLast(event=>event.kind===button.slice(1))?.trusted,button),true);
      const result=await navigation;
      if(result.error) throw result.error;
      assert.equal(result.response.status(),200);
      currentReadGate=null;
      finishRead();
      await page.locator("#participantRouteUnitKey").filter({hasText:target}).waitFor({timeout:15_000,state:"attached"});
      await frame.locator("#demoPlayerTitle").filter({hasText:target==="unit-practice"?"Practice response persistence":"Welcome to the interactive demo"}).waitFor({timeout:15_000});
      const after=await api(currentPath);
      assert.equal(after.currentRunState.testRun.testRunId,runId);
      assert.equal(after.currentRunState.participantSession.participantSessionId,sessionId);
      const saved=after.currentRunState.testRun.unitResponses[unitKey];
      assert.equal(saved,exactResponse);
      assert.equal(JSON.parse(saved).unitState.dataParts.answer,answer);
      console.log(`native_navigation=${mode}:${width}:${direction}:same-session-run:exact-answer`);
    }
    await page.reload();
    await frame.locator("#demoPlayerAnswerStatus").filter({hasText:"Answer captured"}).waitFor({timeout:15_000});
    assert.equal(await frame.locator("#demoPlayerAnswer").inputValue(),`Own ${mode} ${width} unit-intro\n ä🙂 whitespace  `);
    const restored=await api(currentPath);
    assert.equal(restored.currentRunState.testRun.testRunId,runId);
    for(const [unitKey,response] of Object.entries(ownPackets)) assert.equal(restored.currentRunState.testRun.unitResponses[unitKey],response);
    await page.unrouteAll({behavior:"wait"});
    await context.close();
  }
  token=foreignIdentity.sessionToken;
  const foreignAfter = await api(foreignPath);
  assert.equal(JSON.stringify({session:foreignAfter.currentRunState.participantSession,run:foreignAfter.currentRunState.testRun}),foreignBefore);
  assert.deepEqual(errors,[]);
  console.log("native_navigation_completeness=8:passed; foreign_session_run=unchanged");
} catch (error) {
  if (activePage && !activePage.isClosed()) await activePage.screenshot({path:join(artifacts,"failure.png"),fullPage:true});
  throw error;
} finally {
  releaseRead();
  if(activePage && !activePage.isClosed()) await activePage.unrouteAll({behavior:"wait"});
  await browser?.close();
  if(server.exitCode===null) {
    const exited = new Promise(done=>server.once("exit",done));
    server.kill("SIGTERM");
    await exited;
  }
}
