import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { randomUUID } from "node:crypto";
import { access, mkdir, mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";

// Own content, protected SQLite and native input/connectivity events. Hold the
// real foreground request until after reconnection, then settle its old failure.
const root = resolve(process.env.UI_SMOKE_FRONTEND_ROOT || ".");
await access(join(root, "dist/apps/web/browser/index.html"));
const artifacts = process.env.UI_SMOKE_ARTIFACT_DIR || await mkdtemp(join(tmpdir(), "testcenter-save-retry-"));
await mkdir(artifacts, { recursive: true });
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
let browser, page, releaseHeld = () => {};
const evidence = [], errors = [];
try {
  const port = await new Promise((done, reject) => {
    const timer = setTimeout(() => reject(Error("Owned save-retry API startup timed out")), 20_000);
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
  const workspace = "/api/v1/tenants/demo-tenant/workspaces/owned-save-retry";
  await api("/api/v1/tenants/demo-tenant/workspaces", {workspaceKey:"owned-save-retry", displayName:"Own save retry"});
  const content = JSON.parse(localDemoSourcePackage.sourceDocument);
  // This own Player emits exactly one state packet per native input. Window
  // focus notifications would create unrelated newer packets and obscure the
  // same-delivery retry being tested here.
  content.playerEntries[0].html = `<!doctype html><html lang="en"><head>
    <meta charset="utf-8"><title>Own save retry Player</title>
    <script type="application/ld+json">{"type":"player","id":"testcenter-demo-player",
      "name":[{"value":"Own save retry Player","lang":"en"}],"version":"1.0.0",
      "specVersion":"6.0","metadataVersion":"2.0",
      "maintainer":{"name":[{"value":"Testcenter Rewrite","lang":"en"}]},
      "code":{"licenseType":"MIT"}}</script></head><body>
    <label for="demoPlayerAnswer">Own answer</label>
    <textarea id="demoPlayerAnswer" hidden></textarea>
    <span id="demoPlayerAnswerStatus" role="status">Not answered</span>
    <script>
      const answer=document.querySelector("#demoPlayerAnswer");
      const status=document.querySelector("#demoPlayerAnswerStatus");
      let sessionId="";
      const updateStatus=()=>status.textContent=answer.value?"Answer captured":"Not answered";
      addEventListener("message",event=>{
        if(event.data?.type!=="vopStartCommand")return;
        sessionId=event.data.sessionId;
        answer.value=event.data.unitState?.dataParts?.answer||"";
        answer.hidden=false;updateStatus();
      });
      answer.addEventListener("input",()=>{
        updateStatus();
        parent.postMessage({type:"vopStateChangedNotification",sessionId,
          unitState:{dataParts:{answer:answer.value},presentationProgress:"complete",
            responseProgress:answer.value?"complete":"none"}},"*");
      });
      setTimeout(()=>parent.postMessage({type:"vopReadyNotification",
        metadata:{specVersion:"6.0"}},"*"),0);
    </script></body></html>`;
  content.bookletEntries[0].config = { ...content.bookletEntries[0].config,
    unit_responses_buffer_time:"0", unit_state_buffer_time:"0" };
  const source = await api(workspace + "/source-packages", {fileName:"own-save-retry.json", mediaType:"application/json", sourceDocument:JSON.stringify(content)});
  const imported = await api(workspace + "/import-jobs", {sourcePackageId:source.sourcePackage.sourcePackageId});
  await api(workspace + `/content-releases/${imported.stagedContentRelease.contentReleaseId}/activate`, {activatedByActorId:"own-save-retry"});
  await api(workspace + "/participant-roster", {rosterText:["loginKey,groupKey,bookletKey,executionMode",
    ...["original-1280","original-390","rewrite-1280","rewrite-390","foreign"].map(key=>`${key},own-group,booklet:demo,run-hot-return`)].join("\n")});
  const foreignIdentity = await api("/api/v1/participant/auth/sign-in", {tenantKey:"demo-tenant",workspaceKey:"owned-save-retry",loginKey:"foreign"});
  token = foreignIdentity.sessionToken;
  const foreign = await api(`/api/v1/participant/sessions/${foreignIdentity.participantSession.participantSessionId}/resume`, {bookletKey:"booklet:demo"});
  const foreignPath = `/api/v1/participant/sessions/${foreignIdentity.participantSession.participantSessionId}/current-state?testRunId=${foreign.testRun.testRunId}`;
  const foreignBefore = JSON.stringify((await api(foreignPath)).currentRunState.testRun);
  browser = await chromium.launch({headless:true});
  for (const mode of ["original","rewrite"]) for (const width of [1280,390]) {
    // Exercise the supported foreground fallback independently of a Worker
    // racing to deliver the same packet. Existing full Worker gates stay intact.
    const context = await browser.newContext({viewport:{width,height:width===1280?720:844}});
    await context.route(base+"/app/service-worker.js",route=>route.abort("failed"));
    await context.addInitScript(()=>{
      globalThis.ownRetryEvents=[];
      for(const type of ["input","offline","online"]) addEventListener(type,event=>{
        if(type!=="input" || event.target?.id==="demoPlayerAnswer")
          globalThis.ownRetryEvents.push({type,trusted:event.isTrusted});
      },true);
    });
    page = await context.newPage();
    page.on("pageerror", error=>errors.push(String(error)));
    await page.goto(base + `/app/participant?ui=${mode}&tenantKey=demo-tenant&workspaceKey=owned-save-retry`);
    await (mode==="original" ? page.getByLabel("Anmeldename",{exact:true}) : page.locator("#participantLoginKey")).fill(`${mode}-${width}`);
    const signedIn = page.waitForResponse(response=>response.url().endsWith("/participant/auth/sign-in") && response.request().method()==="POST");
    await (mode==="original" ? page.getByRole("button",{name:"Weiter",exact:true}) : page.locator("#participantRouteSignInButton")).click();
    const identity = await (await signedIn).json(); token = identity.sessionToken;
    const sessionId = identity.participantSession.participantSessionId;
    const own = await api(`/api/v1/participant/sessions/${sessionId}/resume`, {bookletKey:"booklet:demo"});
    const runId = own.testRun.testRunId;
    const currentPath = `/api/v1/participant/sessions/${sessionId}/current-state?testRunId=${runId}`;
    const savePath = `/api/v1/participant/test-runs/${runId}/save-progress`;
    assert.equal((await fetch(base+foreignPath,{headers:{authorization:`Bearer ${token}`}})).status,401);
    await page.goto(base+`/app/participant?ui=${mode}&participantSessionId=${sessionId}&testRunId=${runId}`);
    const frame = page.frameLocator("#participantVeronaPlayerFrame");
    await frame.locator("#demoPlayerAnswer").waitFor();
    const answer = `Own native retry ${mode} ${width}\n ä🙂 whitespace  `;
    let heldPacket, holdNext = false;
    let resolveHeld;
    const held = new Promise(done => { resolveHeld=done; });
    const gate = new Promise(release => { releaseHeld = release; });
    await page.route(base+savePath, async route => {
        const body = route.request().postDataJSON();
        let value;
        try { value = JSON.parse(body.unitResponse).unitState?.dataParts?.answer; } catch {}
        if (holdNext && !heldPacket && body.responseUnitKey==="unit-intro" && value===answer) {
          heldPacket=body; resolveHeld(body); await gate; await route.abort("failed");
        } else if (!holdNext) await route.abort("failed");
        else await route.continue();
    });
    const requested = page.waitForRequest(request=>request.url()===base+savePath && request.method()==="POST" &&
      request.postDataJSON()?.responseUnitKey==="unit-intro", {timeout:15_000});
    await frame.locator("#demoPlayerAnswer").fill(answer);
    await requested;
    // Native focus is itself logged by the host after its debounce. Let that
    // real newer packet finish its initial failed attempt before holding a
    // retry of the final durable packet. No extra input is made afterwards.
    await page.waitForFunction(runId=>{
      const packet=JSON.parse(localStorage.getItem("testcenter-rewrite:participant-save-outbox:v1")||"{}").entries
        ?.find(entry=>entry.testRunId===runId && entry.unitKey==="unit-intro");
      return packet?.logs?.some(batch=>batch.entries.some(entry=>entry.key==="FOCUS")) &&
        document.querySelector("#participantVeronaSaveStatus")?.textContent==="queued offline";
    },runId,{timeout:15_000});
    holdNext=true;
    await context.setOffline(true);
    await page.waitForFunction(()=>!navigator.onLine && globalThis.ownRetryEvents.some(event=>event.type==="offline" && event.trusted));
    const heldRequest=page.waitForRequest(request=>request.url()===base+savePath && request.method()==="POST",{timeout:15_000});
    await context.setOffline(false);
    await heldRequest;
    const packet = await held;
    assert.equal(await frame.locator("#demoPlayerAnswer").evaluate(()=>globalThis.ownRetryEvents.findLast(event=>event.type==="input")?.trusted),true);
    const secondaryEnvelope = JSON.parse(packet.unitResponse);
    secondaryEnvelope.unitState.dataParts.answer = `Own secondary ${mode} ${width}\n ä🙂\u0000 whitespace  `;
    const secondary = { version:1, deliveryId:`own-retry-${randomUUID()}`,testRunId:runId,unitKey:"unit-practice",
      response:JSON.stringify(secondaryEnvelope)+"\n  ", status:"running",logs:[],queuedAt:new Date().toISOString() };
    await page.evaluate(secondary=>{
      const key="testcenter-rewrite:participant-save-outbox:v1";
      const document=JSON.parse(localStorage.getItem(key));
      if(!document?.entries?.some(entry=>entry.testRunId===secondary.testRunId && entry.unitKey==="unit-intro"))
        throw Error("The real native answer must already be durable before seeding the secondary own packet");
      document.entries.push(secondary); localStorage.setItem(key,JSON.stringify(document));
    },secondary);
    await context.setOffline(true);
    await page.waitForFunction(()=>navigator.onLine===false && globalThis.ownRetryEvents.some(event=>event.type==="offline" && event.trusted));
    await context.setOffline(false);
    await page.waitForFunction(()=>navigator.onLine && globalThis.ownRetryEvents.filter(event=>event.type==="online" && event.trusted).length===2);
    const pending = await page.evaluate(runId=>JSON.parse(localStorage.getItem("testcenter-rewrite:participant-save-outbox:v1")).entries
      .find(entry=>entry.testRunId===runId && entry.unitKey==="unit-intro"),runId);
    assert.equal(pending.deliveryId,packet.deliveryId,"Reconnection must retain the same in-flight delivery, not create a newer packet");
    assert.equal(pending.response,packet.unitResponse);
    const retried = page.waitForResponse(response=>response.url()===base+savePath && response.request().method()==="POST" &&
      response.request().postDataJSON()?.deliveryId===packet.deliveryId, {timeout:15_000});
    releaseHeld();
    assert.equal((await retried).status(),200);
    await page.waitForFunction(runId=>!JSON.parse(localStorage.getItem("testcenter-rewrite:participant-save-outbox:v1")||"{}").entries?.some(entry=>entry.testRunId===runId),runId,{timeout:15_000});
    const after = await api(currentPath);
    assert.equal(after.currentRunState.testRun.testRunId,runId);
    assert.equal(after.currentRunState.participantSession.participantSessionId,sessionId);
    assert.equal(after.currentRunState.testRun.unitResponses["unit-intro"],packet.unitResponse);
    assert.equal(after.currentRunState.testRun.unitResponses["unit-practice"],secondary.response);
    await page.unrouteAll({behavior:"wait"});
    await page.reload();
    await frame.locator("#demoPlayerAnswerStatus").filter({hasText:"Answer captured"}).waitFor({timeout:15_000});
    assert.equal(await frame.locator("#demoPlayerAnswer").inputValue(),answer);
    const restored = await api(currentPath);
    assert.equal(restored.currentRunState.testRun.testRunId,runId);
    assert.equal(restored.currentRunState.testRun.unitResponses["unit-intro"],packet.unitResponse);
    assert.equal(restored.currentRunState.testRun.unitResponses["unit-practice"],secondary.response);
    evidence.push({mode,width,foregroundFallback:true,sameSessionRun:true,nativeInput:true,nativeOfflineOnline:true,sameDeliveryRetry:true,exactAnswers:true,reload:true});
    console.log(`native_save_retry=${mode}:${width}:same-delivery:same-session-run:exact-answer`);
    await context.close();
  }
  token=foreignIdentity.sessionToken;
  assert.equal(JSON.stringify((await api(foreignPath)).currentRunState.testRun),foreignBefore);
  assert.deepEqual(errors,[]);
  await writeFile(join(artifacts,"evidence.json"),JSON.stringify({evidence,errors},null,2));
  console.log("native_save_retry=4:passed; foreign_session_run=unchanged");
} catch(error) {
  if(page && !page.isClosed()) await page.screenshot({path:join(artifacts,"failure.png"),fullPage:true});
  await writeFile(join(artifacts,"failure.json"),JSON.stringify({error:String(error),evidence,errors},null,2));
  throw error;
} finally {
  releaseHeld();
  if(page && !page.isClosed()) await page.unrouteAll({behavior:"wait"});
  await browser?.close();
  if(server.exitCode===null) {
    const exited=new Promise(done=>server.once("exit",done)); server.kill("SIGTERM"); await exited;
  }
}
