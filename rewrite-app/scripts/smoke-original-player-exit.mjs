import { raceWithSmokeDeadline } from "./smoke-deadline.mjs";
import { loadOriginalVisualReference, assertOriginalVisualBrowser } from "./qualified-original-visuals.mjs";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { localDemoSourcePackage } from "../apps/api/dist/apps/api/src/local-demo-bootstrap.js";
import { createServerRequestFailureGate } from "./server-request-failure-gate.mjs";
import { waitForMaterialDialog } from "./material-dialog-ready.mjs";

// Real participant authentication, Verona input, SQLite, and guarded return.
// The Source dialog reference uses the same owned synthetic player/booklet.
const frontendRoot = resolve(process.env.UI_SMOKE_FRONTEND_ROOT || ".");
await access(join(frontendRoot, "dist/apps/web/browser/index.html"));
const scratch = await mkdtemp(join(tmpdir(), "testcenter-original-player-exit-"));
const artifacts = process.env.UI_SMOKE_ARTIFACT_DIR ? resolve(process.env.UI_SMOKE_ARTIFACT_DIR) : scratch;
await mkdir(artifacts, { recursive: true });
console.log(`owned_artifacts=${artifacts}`);
const reference = await loadOriginalVisualReference("original-player-exit");
assert.equal(reference.referenceRevision, "ee2ab9ab64bd91209ef8534bbe6005838024e46d");
const serverFailureGate = createServerRequestFailureGate();
const apiModule = pathToFileURL(resolve("apps/api/dist/apps/api/src/index.js")).href;
const server = spawn(process.execPath, ["--input-type=module", "-e", `
  import { createProductionApiServer } from ${JSON.stringify(apiModule)};
  const server = await createProductionApiServer();
  server.listen(0, "127.0.0.1", () => process.send({port:server.address().port}));
  process.once("SIGTERM", () => server.close(() => process.exit(0)));
`], {
  cwd: frontendRoot,
  env: {...process.env, PORT:"4310", FIRST_SLICE_STORE:"sqlite",
    FIRST_SLICE_SQLITE_FILE:join(scratch,"store.sqlite"), FIRST_SLICE_BOOTSTRAP_DEMO:"true",
    FIRST_SLICE_OPERATOR_AUTH_REQUIRED:"true", FIRST_SLICE_PROOF_OF_WORK_SCOPES:"",
    FIRST_SLICE_XML_SCHEMA_PROFILE:"legacy-compatibility", REQUIRE_LOGIN_PASSWORD:"false"},
  stdio:["ignore","pipe","pipe","ipc"]
});
serverFailureGate.observeStream(server.stdout);
serverFailureGate.observeStream(server.stderr);
const serverClosed = new Promise(done => server.once("close",done));
const errors = [], states = {};
let browser, activePage, activeContext, activeKey;
let activeNetwork = [];
const traceFailures = Boolean(process.env.UI_SMOKE_ARTIFACT_DIR);
try {
  const port = await new Promise((done,reject) => {
    const timer=setTimeout(()=>reject(new Error("Owned API startup timed out.")),20_000);
    server.once("message",message=>{clearTimeout(timer);done(message.port);});
    server.once("error",error=>{clearTimeout(timer);reject(error);});
    server.once("exit",()=>{clearTimeout(timer);reject(new Error("Owned API exited before ready."));});
  });
  const base=`http://127.0.0.1:${port}`;
  const api=async(path,body,token,method=body===undefined?"GET":"POST",expected=200)=>{
    const response=await fetch(base+path,{method,headers:{...(token?{authorization:`Bearer ${token}`} : {}),
      ...(body===undefined?{}:{"content-type":"application/json"})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    assert.ok(response.status===expected||expected===200&&response.status===201,`${method} ${path}: ${response.status} ${await response.clone().text()}`);
    return response.status===204?null:response.json();
  };
  const operatorToken=(await api("/api/v1/admin/auth/sign-in",{username:"demo-admin",password:"demo-admin-password"})).sessionToken;
  const themes=["Primar","Sekundar","Erwachsene"],screens=[["desktop",1280,720],["mobile",390,844]];
  const loginKey=(theme,screen,mode="original")=>`${mode}-${theme.toLowerCase()}-${screen}`;
  const fixtures={};
  for(const hidden of [false,true]) for(const restriction of ["none","confirm","forbidden"]) {
    const key=`${hidden?"hidden":"header"}-${restriction}`,workspaceKey=`exit-${key}`,workspace=`/api/v1/tenants/demo-tenant/workspaces/${workspaceKey}`;
    await api("/api/v1/tenants/demo-tenant/workspaces",{workspaceKey,displayName:key},operatorToken);
    const content=JSON.parse(localDemoSourcePackage.sourceDocument);
    content.bookletEntries=[{bookletKey:"owned-exit",displayLabel:"Logo Testheft",config:{header_hidden:hidden?"TRUE":"FALSE",
      toolbar_show_unit_list:"FALSE",toolbar_show_fullscreen_button:"FALSE",toolbar_show_reload_button:"FALSE",
      navbar_unit_label:"HIDDEN",navbar_page_label:"HIDDEN",lock_test_on_termination:"OFF"},
      testletEntries:restriction==="none"?[]:[{testletKey:"timed",displayLabel:"Zeitblock",parentTestletKey:null,restrictions:{timeMax:{minutes:5,leave:restriction}}}],
      unitEntries:[{...content.bookletEntries[0].unitEntries[0],displayLabel:"Logo Aufgabe",testletPath:restriction==="none"?[]:["timed"]}]}];
    const source=await api(`${workspace}/source-packages`,{fileName:"exit.json",mediaType:"application/json",contentStructure:content},operatorToken);
    const imported=await api(`${workspace}/import-jobs`,{sourcePackageId:source.sourcePackage.sourcePackageId},operatorToken);
    await api(`${workspace}/content-releases/${imported.stagedContentRelease.contentReleaseId}/activate`,{activatedByActorId:"owned-player-exit"},operatorToken);
    const names=themes.flatMap(theme=>screens.map(([screen])=>loginKey(theme,screen)));
    names.push(loginKey("Primar","desktop","rewrite"),loginKey("Primar","desktop","fallback"));
    await api(`${workspace}/participant-roster`,{rosterText:`<Testtakers><Group id="exit" label="Exit Group">${names.map(name=>`<Login mode="run-hot-return" name="${name}"><Booklet>owned-exit</Booklet></Login>`).join("")}</Group></Testtakers>`},operatorToken);
    fixtures[key]={workspaceKey,hidden,restriction};
  }
  browser=await chromium.launch({headless:process.env.CI==="true" && process.env.UI_SMOKE_HEADFUL!=="true"});
  assertOriginalVisualBrowser(browser, reference);
  for(const theme of themes) {
    await api("/api/v1/admin/application-settings",{themeName:theme},operatorToken,"PATCH");
    for(const [screen,width,height] of screens) for(const [fixtureKey,fixture] of Object.entries(fixtures)) {
      const key=`${theme}-${screen}-${fixtureKey}`,context=await browser.newContext({viewport:{width,height},locale:"de-DE"}),page=await context.newPage();
      await page.bringToFront();
      activePage=page;activeContext=context;activeKey=key;activeNetwork=[];
      if(traceFailures) await context.tracing.start({screenshots:true,snapshots:true,sources:true});
      await page.addInitScript(()=>{
        const events=[];window.__ownedExitInputEvents=events;
        for(const type of ["pointerdown","pointerup","click","keydown","keyup"]) window.addEventListener(type,event=>{
          const target=event.target instanceof Element?event.target.closest("button,a,mat-dialog-container"):null;
          if(!target || !/participantApplicationLogo|participantStandaloneLogo|participantConfirmation|mat-mdc-dialog/.test(target.id))return;
          events.push({type,id:target.id,text:target.textContent.trim().slice(0,100),trusted:event.isTrusted,
            ...(event instanceof KeyboardEvent?{key:event.key}:{})});
          if(events.length>80)events.shift();
        },true);
      });
      for(const type of ["request","requestfailed"]) page.on(type,request=>{
        const pathname=new URL(request.url()).pathname;
        if(pathname.startsWith("/api/v1/participant/")) {
          activeNetwork.push({type,path:pathname,method:request.method(),
            ...(type==="requestfailed"?{failure:request.failure()?.errorText}:{})});
          if(activeNetwork.length>100)activeNetwork.shift();
        }
      });
      page.on("response",response=>{
        const pathname=new URL(response.url()).pathname;
        if(pathname.startsWith("/api/v1/participant/")){
          activeNetwork.push({type:"response",path:pathname,method:response.request().method(),status:response.status()});
          if(activeNetwork.length>100)activeNetwork.shift();
        }
      });
      page.on("pageerror",error=>errors.push({key,error:String(error)}));
      await page.goto(`${base}/app/participant?ui=original&tenantKey=demo-tenant&workspaceKey=${fixture.workspaceKey}`,{waitUntil:"networkidle"});
      await page.locator("#originalLoginName").fill(loginKey(theme,screen));
      const signedIn=page.waitForResponse(r=>new URL(r.url()).pathname==="/api/v1/participant/auth/sign-in" && r.request().method()==="POST");
      await page.getByRole("button",{name:"Weiter",exact:true}).click();
      assert.equal((await signedIn).status(),200);const identity=await (await signedIn).json();
      const frame=page.frameLocator("iframe");await frame.locator("#demoPlayerAnswer").waitFor();
      await page.locator("#originalPlayerToolbar").waitFor();await page.evaluate(()=>document.fonts.ready);
      const currentPath=`/api/v1/participant/sessions/${identity.participantSession.participantSessionId}/current-state`;
      let current=(await api(currentPath,undefined,identity.sessionToken)).currentRunState;
      const runId=current.testRun.testRunId,returnPath=`/api/v1/participant/test-runs/${runId}/return-to-starter`;
      const logo=page.locator(fixture.hidden?"#participantStandaloneLogo":"#participantApplicationLogoButton");await logo.waitFor();
      assert.equal(await logo.evaluate(n=>n.tagName),"A");
      const mutations=[];page.on("request",request=>{if(new URL(request.url()).pathname===returnPath)mutations.push(request.postDataJSON());});
      let popups=0;context.on("page",()=>popups++);await logo.click({modifiers:["ControlOrMeta"]});await delay(100);
      assert.equal(popups,0);assert.deepEqual(mutations,[]);
      const capture=async(phase)=>{
        await page.bringToFront();
        try {
          await page.waitForFunction(()=>document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).every(a=>!a.pending&&a.playState!=="running"));
        } catch(error) {
          states[key]??={};
          states[key].animationTimeout=await page.evaluate(phase=>({phase,visibility:document.visibilityState,focus:document.hasFocus(),
            animations:document.getAnimations().map(a=>({pending:a.pending,state:a.playState,time:a.currentTime,
              timing:a.effect?.getComputedTiming(),target:a.effect?.target?.outerHTML.slice(0,500)}))}),phase);
          throw error;
        }
        await page.screenshot({path:join(artifacts,`${key}-${phase}.png`),fullPage:false});
        return page.evaluate(()=>{const rect=n=>{if(!n)return null;const b=n.getBoundingClientRect(),s=getComputedStyle(n);return{x:b.x,y:b.y,width:b.width,height:b.height,font:s.font,color:s.color,background:s.backgroundColor,padding:s.padding,borderRadius:s.borderRadius};};
          const dialog=document.querySelector("mat-dialog-container");return{logo:rect(document.querySelector("#participantStandaloneLogo,#participantApplicationLogoButton")),logoImage:rect(document.querySelector("#applicationLogo")),
            dialog:dialog?{role:dialog.getAttribute("role"),box:rect(dialog),title:dialog.querySelector('[data-cy="dialog-title"]').textContent,content:dialog.querySelector('[data-cy="dialog-content"]').textContent,
              buttons:[...dialog.querySelectorAll("button")].map(n=>({text:n.textContent.trim(),box:rect(n)}))}:null,activeTag:document.activeElement.tagName};});
      };
      states[key]={player:await capture("player")};
      assert.deepEqual(states[key].player.logo,reference.measurements[key].player.logo);
      assert.deepEqual(states[key].player.logoImage,reference.measurements[key].player.logoImage);
      // Real trusted Player input, then compare the exact stored packet.
      const answer=`Own ${key}\n Ω  exact whitespace  `;await frame.locator("#demoPlayerAnswer").fill(answer);
      for(let attempt=0;attempt<100;attempt++) {
        current=(await api(currentPath,undefined,identity.sessionToken)).currentRunState;
        if(current.testRun.unitResponses["unit-intro"]?.includes(JSON.stringify(answer).slice(1,-1)))break;
        await delay(100);
      }
      assert.ok(current.testRun.unitResponses["unit-intro"]?.includes(JSON.stringify(answer).slice(1,-1)),"Actual Verona answer must reach SQLite before navigation.");
      const saved=structuredClone(current.testRun.unitResponses),timerBefore=current.activeTestletTimer;
      await logo.click();
      if(fixture.restriction==="forbidden") {
        const toast=page.locator('[data-cy^="toast-text-"]').filter({hasText:reference.forbiddenToast});await toast.waitFor();
        assert.equal((await toast.textContent()).trim(),reference.forbiddenToast);
        assert.equal(await page.locator("mat-dialog-container").count(),0);assert.deepEqual(mutations,[]);
        await api(returnPath,{},identity.sessionToken,"POST",409);
        current=(await api(currentPath,undefined,identity.sessionToken)).currentRunState;
        assert.equal(current.testRun.status,"running");assert.deepEqual(current.testRun.unitResponses,saved);
        assert.equal(current.activeTestletTimer.testletKey,timerBefore.testletKey);
      } else {
        const dialog=page.getByRole("dialog",{name:"Sicher, dass du den Test beenden möchtest?",exact:true});await dialog.waitFor();
        await waitForMaterialDialog(page);
        await page.waitForFunction(()=>document.activeElement?.tagName==="MAT-DIALOG-CONTAINER");
        states[key].confirmation=await capture("confirmation");
        assert.deepEqual(states[key].confirmation.dialog,reference.measurements[key].confirmation.dialog);
        assert.equal(states[key].confirmation.activeTag,"MAT-DIALOG-CONTAINER");
        if(key==="Primar-desktop-header-none") {
          const replacedId=await dialog.getAttribute("id");
          await page.evaluate(()=>window.dispatchEvent(new CustomEvent("participant-leave-session")));
          await page.waitForFunction(oldId=>{
            const dialogs=document.querySelectorAll("mat-dialog-container");
            return dialogs.length===1&&dialogs[0].id!==oldId;
          },replacedId);
          await page.waitForFunction(()=>document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).every(a=>!a.pending&&a.playState!=="running"));
          assert.deepEqual(mutations,[]);assert.equal(await page.locator("mat-dialog-container").count(),1);
        }
        for(const button of await dialog.locator("button").all()) {
          const before=await button.boundingBox();await button.hover();
          assert.equal(await button.evaluate(n=>getComputedStyle(n).transform),"none");
          assert.deepEqual(await button.boundingBox(),before);
        }
        // Native focus trap and Escape restore the source link without a write.
        await page.keyboard.press("Shift+Tab");assert.equal(await page.evaluate(()=>!!document.activeElement.closest("mat-dialog-container")),true);
        await page.keyboard.press("Tab");assert.equal(await page.evaluate(()=>!!document.activeElement.closest("mat-dialog-container")),true);
        await page.keyboard.press("Escape");await dialog.waitFor({state:"detached"});
        assert.equal(await logo.evaluate(n=>n===document.activeElement),true);assert.deepEqual(mutations,[]);
        await logo.click();await waitForMaterialDialog(page);await page.locator(".cdk-overlay-backdrop").click({position:{x:5,y:5}});
        await dialog.waitFor({state:"detached"});assert.deepEqual(mutations,[]);
        await logo.click();await waitForMaterialDialog(page);await page.locator("#participantConfirmationStayButton").click();await dialog.waitFor({state:"detached"});
        assert.deepEqual(mutations,[]);current=(await api(currentPath,undefined,identity.sessionToken)).currentRunState;
        assert.equal(current.testRun.status,"running");assert.deepEqual(current.testRun.unitResponses,saved);
        if(timerBefore)assert.equal(current.activeTestletTimer.testletKey,timerBefore.testletKey);
        await logo.focus();await page.keyboard.press("Enter");await dialog.waitFor();
        // The Linux trace showed a successful Playwright click while Material
        // still had mdc-dialog--opening, with no trusted event reaching either
        // button. DOM visibility precedes the compositor's opening transition.
        await waitForMaterialDialog(page);
        const returned=page.waitForResponse(r=>new URL(r.url()).pathname===returnPath && r.request().method()==="POST");
        await page.locator("#participantConfirmationContinueButton").click();assert.equal((await returned).status(),200);
        const result=await (await returned).json();assert.equal(mutations.length,1);
        assert.deepEqual(result.testRun.unitResponses,saved);assert.equal(result.testRun.testRunId,runId);assert.equal(result.testRun.status,"paused");
        if(fixture.restriction==="confirm") {
          assert.equal(mutations[0].confirmTestletTimeLeave,true);
          assert.equal(result.testRun.testletTimers.timed.status,"cancelled");
          assert.equal(result.testRun.testletTimers.timed.remainingSeconds,0);
          assert.equal(result.testRun.testletTimers.timed.expiresAt,null);
        }
        await page.locator("#originalParticipantStarter mat-card").first().waitFor();assert.equal(await page.locator("mat-dialog-container").count(),0);
        const runtime=(await api(`/api/v1/participant/sessions/${identity.participantSession.participantSessionId}/runtime-state`,undefined,identity.sessionToken)).runtimeState;
        assert.deepEqual(runtime.latestTestRun.unitResponses,saved);assert.equal(runtime.latestTestRun.testRunId,runId);
      }
      if(traceFailures)await context.tracing.stop();
      await context.close();activePage=activeContext=undefined;console.log(`original_player_exit=${key}:passed`);
    }
  }
  // A missing lazy dialog bundle keeps the shared guarded action usable.
  {
    const context=await browser.newContext({viewport:{width:1280,height:720},locale:"de-DE"});
    // The Worker cache must not satisfy the deliberately failed import. Model
    // an unsupported Worker in the owned top frame only: Playwright's block
    // shim itself throws in the unchanged opaque Verona iframe.
    await context.addInitScript(()=>{if(window===window.top)delete Navigator.prototype.serviceWorker;});
    const page=await context.newPage();
    page.on("pageerror",error=>errors.push({key:"native-dialog-fallback",error:String(error)}));
    const chunks=[];
    for(const file of await readdir(join(frontendRoot,"dist/apps/web/browser"))) {
      if(file.endsWith(".js")&&(await readFile(join(frontendRoot,"dist/apps/web/browser",file),"utf8")).includes('selectors:[["app-original-participant-confirmation-launcher"]]'))chunks.push(file);
    }
    assert.equal(chunks.length,1,"Exactly one owned production bundle defines the native launcher.");
    let blocked=0;await page.route(`**/${chunks[0]}`,route=>{blocked++;return route.abort("failed");});
    await page.goto(`${base}/app/participant?ui=original&tenantKey=demo-tenant&workspaceKey=exit-header-none`,{waitUntil:"networkidle"});
    await page.locator("#originalLoginName").fill(loginKey("Primar","desktop","fallback"));
    const signedIn=page.waitForResponse(r=>new URL(r.url()).pathname==="/api/v1/participant/auth/sign-in"&&r.request().method()==="POST");
    await page.getByRole("button",{name:"Weiter",exact:true}).click();const identity=await (await signedIn).json();
    await page.frameLocator("iframe").locator("#demoPlayerAnswer").waitFor();
    const current=(await api(`/api/v1/participant/sessions/${identity.participantSession.participantSessionId}/current-state`,undefined,identity.sessionToken)).currentRunState;
    const logo=page.locator("#participantApplicationLogoButton");await logo.click();
    await page.getByRole("alertdialog",{name:"Return to test selection?",exact:true}).waitFor();
    assert.ok(blocked>0);assert.equal(await page.locator("mat-dialog-container").count(),0);
    await page.locator("#participantConfirmationStayButton").click();await page.locator("#participantConfirmationBackdrop").waitFor({state:"detached"});
    await logo.click();await page.locator("#participantConfirmationContinueButton").waitFor();
    const returned=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/v1/participant/test-runs/${current.testRun.testRunId}/return-to-starter`&&r.request().method()==="POST");
    await page.locator("#participantConfirmationContinueButton").click();assert.equal((await returned).status(),200);
    assert.equal((await (await returned).json()).testRun.status,"paused");
    await page.locator("#originalParticipantStarter mat-card").first().waitFor();await context.close();
    console.log("original_player_exit=missing-lazy-bundle:passed");
  }
  // Shared decisions still use the existing Rewrite renderer and labels.
  for(const [fixtureKey,fixture] of Object.entries(fixtures)) {
    const context=await browser.newContext({viewport:{width:1280,height:720},locale:"de-DE"}),page=await context.newPage();
    page.on("pageerror",error=>errors.push({key:`rewrite-${fixtureKey}`,error:String(error)}));
    await page.goto(`${base}/app/participant?ui=rewrite&tenantKey=demo-tenant&workspaceKey=${fixture.workspaceKey}`,{waitUntil:"networkidle"});
    await page.locator("#participantLoginKey").fill(loginKey("Primar","desktop","rewrite"));
    const signedIn=page.waitForResponse(r=>new URL(r.url()).pathname==="/api/v1/participant/auth/sign-in" && r.request().method()==="POST");
    await page.locator("#participantRouteSignInButton").click();assert.equal((await signedIn).status(),200);
    const identity=await (await signedIn).json();
    await page.frameLocator("iframe").locator("#demoPlayerAnswer").waitFor();
    const currentPath=`/api/v1/participant/sessions/${identity.participantSession.participantSessionId}/current-state`;
    const current=(await api(currentPath,undefined,identity.sessionToken)).currentRunState,runId=current.testRun.testRunId;
    const logo=page.locator(fixture.hidden?"#participantStandaloneLogo":"#participantApplicationLogoButton");
    assert.equal(await logo.evaluate(n=>n.tagName),"BUTTON");await logo.click();
    assert.equal(await page.locator("mat-dialog-container").count(),0);
    if(fixture.restriction==="forbidden") {
      await page.locator("#participantRouteNavigationNotice").waitFor();
      assert.equal(await page.locator("#participantConfirmationBackdrop").count(),0);
      assert.equal((await api(currentPath,undefined,identity.sessionToken)).currentRunState.testRun.status,"running");
    } else {
      await page.locator("#participantConfirmationTitle").filter({hasText:"Return to test selection?"}).waitFor();
      await page.locator("#participantConfirmationStayButton").click();
      await page.locator("#participantConfirmationBackdrop").waitFor({state:"detached"});
      assert.equal((await api(currentPath,undefined,identity.sessionToken)).currentRunState.testRun.testRunId,runId);
      await logo.click();await page.locator("#participantConfirmationContinueButton").waitFor();
      const returned=page.waitForResponse(r=>new URL(r.url()).pathname===`/api/v1/participant/test-runs/${runId}/return-to-starter` && r.request().method()==="POST");
      await page.locator("#participantConfirmationContinueButton").click();assert.equal((await returned).status(),200);
      assert.equal((await (await returned).json()).testRun.status,"paused");
    }
    await context.close();console.log(`rewrite_player_exit=${fixtureKey}:passed`);
  }
  assert.deepEqual(errors,[]);
} catch(error) {
  const diagnostic=async(name,action)=>{
    try { await action(); } catch(failure) { console.error(`Exit ${name} diagnostic unavailable: ${String(failure)}`); }
  };
  let snapshot=null;
  await diagnostic("snapshot",async()=>{
    if(activePage && !activePage.isClosed()) snapshot=await activePage.evaluate(()=>({
      inputEvents:window.__ownedExitInputEvents??[],
      activeElement:document.activeElement?.id,
      dialogs:[...document.querySelectorAll("mat-dialog-container")].map(n=>({text:n.textContent,html:n.outerHTML})),
      runId:document.querySelector("#participantRouteRunId")?.textContent,
      unitKey:document.querySelector("#participantRouteUnitKey")?.textContent,
      status:document.querySelector("#participantRouteStatus")?.textContent,
      busy:document.querySelector(".page")?.classList.contains("is-busy"),
      globalError:document.querySelector(".status-banner.is-error")?.textContent,
      playerStatus:document.querySelector("#participantVeronaPlayerStatus")?.textContent
    }));
  });
  await diagnostic("packet",()=>writeFile(join(artifacts,"failure.json"),JSON.stringify({key:activeKey,error:String(error),snapshot,network:activeNetwork},null,2)));
  await diagnostic("screenshot",()=>activePage?.screenshot({path:join(artifacts,"failure.png"),fullPage:false,animations:"disabled"}));
  if(traceFailures)await diagnostic("trace",()=>activeContext?.tracing.stop({path:join(artifacts,"failure-trace.zip")}));
  console.error(`original_player_exit_failure=${activeKey}; diagnostic=${join(artifacts,"failure.json")}`);
  throw error;
} finally {
  await writeFile(join(artifacts,"exit.json"),JSON.stringify({states,errors},null,2));
  await browser?.close();
  if(server.exitCode===null){const stopped=new Promise(done=>server.once("exit",done));server.kill("SIGTERM");await raceWithSmokeDeadline(stopped,5000,()=>undefined);if(server.exitCode===null){server.kill("SIGKILL");await stopped;}}
  await serverClosed;console.log("owned_api=shutdown");serverFailureGate.assertHealthy();
}
