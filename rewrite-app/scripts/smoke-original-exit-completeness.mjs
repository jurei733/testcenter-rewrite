import { raceWithSmokeDeadline } from "./smoke-deadline.mjs";
import { loadOriginalVisualReference, assertOriginalVisualBrowser, assertOriginalVisualCase } from "./qualified-original-visuals.mjs";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { parseVeronaUnitResponse } from "@testcenter-rewrite-app/contracts";
import { localDemoSourcePackage } from "../apps/api/dist/apps/api/src/local-demo-bootstrap.js";
import { completenessCases, completenessPlayer, legacyCompletenessCase, closeIconMetrics } from "./exit-completeness-fixture.mjs";
import { createServerRequestFailureGate } from "./server-request-failure-gate.mjs";
import { waitForMaterialDialog } from "./material-dialog-ready.mjs";
import { createExitCompletenessDiagnostics } from "./exit-completeness-diagnostics.mjs";

const reference = await loadOriginalVisualReference("original-exit-completeness");
const root = resolve(process.env.UI_SMOKE_FRONTEND_ROOT || ".");
await access(join(root,"dist/apps/web/browser/index.html"));
const artifacts = await mkdtemp(join(tmpdir(),"testcenter-exit-completeness-"));
console.log(`owned_artifacts=${artifacts}`);
const failureGate = createServerRequestFailureGate();
const module = pathToFileURL(resolve("apps/api/dist/apps/api/src/index.js")).href;
const server = spawn(process.execPath,["--input-type=module","-e",`
  import { createProductionApiServer } from ${JSON.stringify(module)};
  const server=await createProductionApiServer();
  server.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));
  process.once('SIGTERM',()=>server.close(()=>process.exit(0)));
`],{cwd:root,env:{...process.env,FIRST_SLICE_STORE:"sqlite",FIRST_SLICE_SQLITE_FILE:join(artifacts,"own.sqlite"),
  FIRST_SLICE_BOOTSTRAP_DEMO:"true",FIRST_SLICE_OPERATOR_AUTH_REQUIRED:"true",FIRST_SLICE_PROOF_OF_WORK_SCOPES:"",
  FIRST_SLICE_XML_SCHEMA_PROFILE:"legacy-compatibility",REQUIRE_LOGIN_PASSWORD:"false"},stdio:["ignore","pipe","pipe","ipc"]});
failureGate.observeStream(server.stdout);failureGate.observeStream(server.stderr);
const serverClosed=new Promise(done=>server.once("close",done));
const errors=[],states={};let browser;
const themes=process.env.EXIT_COMPLETENESS_SINGLE==="true"?["Primar"]:["Primar","Sekundar","Erwachsene"];
const screens=process.env.EXIT_COMPLETENESS_SINGLE==="true"?[["desktop",1280,720]]:[["desktop",1280,720],["mobile",390,844]];
const cases=process.env.EXIT_COMPLETENESS_LEGACY==="true"?{legacy:legacyCompletenessCase}:{...completenessCases,legacy:legacyCompletenessCase};
try {
  const port=await new Promise((done,reject)=>{
    const timer=setTimeout(()=>reject(Error("Owned API did not start")),20_000);
    server.once("message",({port})=>{clearTimeout(timer);done(port);});
    server.once("error",error=>{clearTimeout(timer);reject(error);});
    server.once("exit",()=>{clearTimeout(timer);reject(Error("Owned API exited before startup"));});
  });
  const base=`http://127.0.0.1:${port}`;
  const api=async(path,body,token,method=body===undefined?"GET":"POST",expected=200)=>{
    const response=await fetch(base+path,{method,headers:{...(token?{authorization:`Bearer ${token}`} : {}),
      ...(body===undefined?{}:{"content-type":"application/json"})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    const payload=response.status===204?null:await response.json();
    assert.ok(response.status===expected||expected===200&&response.status===201,`${method} ${path}: actual ${response.status}, expected ${expected}: ${JSON.stringify(payload)}`);
    return payload;
  };
  const operator=(await api("/api/v1/admin/auth/sign-in",{username:"demo-admin",password:"demo-admin-password"})).sessionToken;
  for(const leave of ["none","confirm","forbidden"]) {
    const workspaceKey=`complete-exit-${leave}`,workspace=`/api/v1/tenants/demo-tenant/workspaces/${workspaceKey}`;
    await api("/api/v1/tenants/demo-tenant/workspaces",{workspaceKey,displayName:workspaceKey},operator);
    const content=JSON.parse(localDemoSourcePackage.sourceDocument);
    content.playerEntries[0].html=completenessPlayer(content.playerEntries[0].html);
    content.bookletEntries=[{bookletKey:"owned-exit",displayLabel:"Logo Testheft",config:{force_presentation_complete:"ALWAYS",force_response_complete:"ALWAYS",
      toolbar_show_unit_list:"FALSE",toolbar_show_fullscreen_button:"FALSE",toolbar_show_reload_button:"FALSE",navbar_unit_label:"HIDDEN",navbar_page_label:"HIDDEN",lock_test_on_termination:"OFF"},
      testletEntries:leave==="none"?[]:[{testletKey:"timed",displayLabel:"Zeitblock",parentTestletKey:null,restrictions:{timeMax:{minutes:5,leave}}}],
      unitEntries:[{...content.bookletEntries[0].unitEntries[0],displayLabel:"Logo Aufgabe",testletPath:leave==="none"?[]:["timed"]}]}];
    const source=await api(workspace+"/source-packages",{fileName:"completeness.json",mediaType:"application/json",contentStructure:content},operator);
    const imported=await api(workspace+"/import-jobs",{sourcePackageId:source.sourcePackage.sourcePackageId},operator);
    await api(workspace+`/content-releases/${imported.stagedContentRelease.contentReleaseId}/activate`,{activatedByActorId:"owned-completeness"},operator);
    const names=themes.flatMap(theme=>screens.flatMap(([screen])=>Object.keys(cases).map(progress=>`${theme.toLowerCase()}-${screen}-${progress}`)));
    names.push("foreign");
    await api(workspace+"/participant-roster",{rosterText:`<Testtakers><Group id="owned" label="Exit Group">${names.map(name=>`<Login mode="run-hot-return" name="${name}"><Booklet>owned-exit</Booklet></Login>`).join("")}</Group></Testtakers>`},operator);
  }
  browser=await chromium.launch({headless:process.env.CI==="true"&&process.env.UI_SMOKE_HEADFUL!=="true"});
  assertOriginalVisualBrowser(browser, reference);
  for(const theme of themes) {
    await api("/api/v1/admin/application-settings",{themeName:theme},operator,"PATCH");
    for(const [screen,width,height] of screens) for(const leave of ["none","confirm","forbidden"]) for(const [progress,values] of Object.entries(cases)) {
      if(progress==="legacy"&&(theme!=="Primar"||screen!=="desktop")) continue;
      const key=`${theme}-${screen}-header-${leave}-${progress}`,context=await browser.newContext({viewport:{width,height},locale:"de-DE"}),page=await context.newPage();
      await page.bringToFront();
      page.on("pageerror",error=>errors.push({key,error:String(error)}));
      const diagnostic=createExitCompletenessDiagnostics({page,key,artifactRoot:process.env.UI_SMOKE_ARTIFACT_DIR||join(artifacts,"public-failure")});
      await diagnostic.install();
      try {
      const workspaceKey=`complete-exit-${leave}`;
      diagnostic.mark("navigation");
      await page.goto(`${base}/app/participant?ui=original&tenantKey=demo-tenant&workspaceKey=${workspaceKey}`,{waitUntil:"networkidle"});
      diagnostic.mark("sign-in");
      await page.locator("#originalLoginName").fill(`${theme.toLowerCase()}-${screen}-${progress}`);
      const signedIn=page.waitForResponse(r=>new URL(r.url()).pathname==="/api/v1/participant/auth/sign-in" && r.request().method()==="POST");
      await page.getByRole("button",{name:"Weiter",exact:true}).click();
      assert.equal((await signedIn).status(),200);const identity=await (await signedIn).json(),token=identity.sessionToken;
      diagnostic.mark("player-ready");
      const frame=page.frameLocator("iframe");await frame.locator("#exitPresentation").waitFor();
      const currentPath=`/api/v1/participant/sessions/${identity.participantSession.participantSessionId}/current-state`;
      diagnostic.mark("save-incomplete");
      await frame.locator("#demoPlayerAnswer").fill(`Own ${key}\n Ω exact whitespace  `);
      await frame.locator("#exitPresentation").selectOption(values.presentation);await frame.locator("#exitResponse").selectOption(values.response);
      let current;
      for(let attempt=0;attempt<100;attempt++) {
        current=(await api(currentPath,undefined,token)).currentRunState;
        const parsed=parseVeronaUnitResponse(current.testRun.unitResponses["unit-intro"]||"");
        if(parsed?.unitState.presentationProgress===values.presentation&&parsed?.unitState.responseProgress===values.response)break;
        await delay(100);
      }
      const packet=current.testRun.unitResponses["unit-intro"],parsed=parseVeronaUnitResponse(packet);
      assert.equal(parsed?.unitState.presentationProgress,values.presentation);assert.equal(parsed.unitState.responseProgress,values.response);
      const runId=current.testRun.testRunId,returnPath=`/api/v1/participant/test-runs/${runId}/return-to-starter`;
      states[key]={packet,runId};
      diagnostic.mark("assert-denied");
      const denied=await api(returnPath,{confirmTestletTimeLeave:true,confirmTestletLeaveLock:true},token,"POST",409);
      assert.equal(denied.error,"booklet_starter_return_denied");assert.deepEqual(denied.details.deniedReasons,values.reasons);
      if(theme==="Primar"&&screen==="desktop"&&progress==="both") {
        await api(returnPath,{confirmTestletTimeLeave:true},undefined,"POST",401);
        const foreign=await api("/api/v1/participant/auth/sign-in",{tenantKey:"demo-tenant",workspaceKey,loginKey:"foreign"});
        await api(returnPath,{confirmTestletTimeLeave:true},foreign.sessionToken,"POST",401);
      }
      const mutations=[];page.on("request",request=>{if(new URL(request.url()).pathname===returnPath)mutations.push(request.postDataJSON());});
      diagnostic.mark("denial-open");
      const logo=page.locator("#participantApplicationLogoButton");await logo.click();
      await page.locator('[data-cy="deny-navigation-message"]').waitFor();
      await waitForMaterialDialog(page);
      diagnostic.mark("denial-visuals");
      await page.waitForFunction(()=>document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).every(a=>!a.pending&&a.playState!=="running"));
      await page.evaluate(()=>document.fonts.ready);await page.screenshot({path:join(artifacts,`${key}-information.png`),fullPage:true});
      const dialog=await page.locator("mat-dialog-container").evaluate(dialog=>{
        const rect=n=>{const b=n.getBoundingClientRect(),s=getComputedStyle(n);return{x:b.x,y:b.y,width:b.width,height:b.height,font:s.font,color:s.color,background:s.backgroundColor,padding:s.padding,borderRadius:s.borderRadius};};
        return {role:dialog.getAttribute("role"),box:rect(dialog),title:dialog.querySelector("[mat-dialog-title]").textContent,
          content:dialog.querySelector('[data-cy="deny-navigation-message"]').textContent,
          buttons:[...dialog.querySelectorAll("button")].map(n=>({text:n.textContent.trim(),box:rect(n)}))};
      });
      assertOriginalVisualCase(reference, `${theme}-${screen}-${progress}`);
      assert.equal(reference.referenceRevision,"ee2ab9ab64bd91209ef8534bbe6005838024e46d");
      assert.deepEqual(dialog,reference.information[`${theme}-${screen}-${progress}`]);states[key].information=dialog;
      states[key].closeIconMetrics=await page.locator('[data-cy="close-deny-navigation-message"]').evaluate(closeIconMetrics);
      // Locator screenshots scroll the actual close button into view. A whole-
      // page crop outside the mobile viewport would only compare transparency.
      const closeScreenshot=await page.locator('[data-cy="close-deny-navigation-message"]').screenshot({path:join(artifacts,`${key}-close.png`)});
      const closePixels=await page.evaluate(async png=>{
        const image=new Image();image.src=`data:image/png;base64,${png}`;await image.decode();
        const canvas=document.createElement("canvas");canvas.width=image.width;canvas.height=image.height;
        const context=canvas.getContext("2d");context.drawImage(image,0,0);
        return [...context.getImageData(0,0,canvas.width,canvas.height).data];
      },closeScreenshot.toString("base64"));
      const closeHash=createHash("sha256").update(Buffer.from(closePixels)).digest("hex");
      assert.equal(closeHash,reference.closeButtonPixelSha256[`${theme}-${screen}-${progress}`]);states[key].closeButtonPixelSha256=closeHash;
      assert.equal(await page.locator('[data-cy="dialog-confirm"]').count(),0);assert.deepEqual(mutations,[]);
      const close=page.locator('[data-cy="close-deny-navigation-message"]');
      diagnostic.mark("escape-and-focus");
      await page.keyboard.press("Shift+Tab");assert.equal(await close.evaluate(n=>n===document.activeElement),true);
      await page.keyboard.press("Escape");await page.locator("mat-dialog-container").waitFor({state:"detached"});
      assert.equal(await logo.evaluate(n=>n===document.activeElement),true);
      diagnostic.mark("denial-reopen");
      await logo.click();await waitForMaterialDialog(page);diagnostic.mark("denial-close");await close.click();await page.locator("mat-dialog-container").waitFor({state:"detached"});
      assert.deepEqual(mutations,[]);
      const retained=(await api(currentPath,undefined,token)).currentRunState;
      assert.equal(retained.testRun.testRunId,runId);assert.equal(retained.testRun.status,"running");assert.equal(retained.testRun.unitResponses["unit-intro"],packet);
      assert.deepEqual(retained.testRun.lockedUnitKeys,current.testRun.lockedUnitKeys);assert.deepEqual(retained.testRun.lockedTestletKeys,current.testRun.lockedTestletKeys);
      if(current.activeTestletTimer){assert.equal(retained.activeTestletTimer.status,"running");assert.equal(retained.activeTestletTimer.expiresAt,current.activeTestletTimer.expiresAt);}
      diagnostic.mark("save-complete");
      await frame.locator("#exitPresentation").selectOption("complete");await frame.locator("#exitResponse").selectOption("complete");
      for(let attempt=0;attempt<100;attempt++) {
        current=(await api(currentPath,undefined,token)).currentRunState;
        const parsed=parseVeronaUnitResponse(current.testRun.unitResponses["unit-intro"]||"");
        if(parsed?.unitState.presentationProgress==="complete"&&parsed.unitState.responseProgress==="complete")break;
        await delay(100);
      }
      const completedPacket=current.testRun.unitResponses["unit-intro"];
      const completed=parseVeronaUnitResponse(completedPacket);
      assert.equal(completed?.unitState.presentationProgress,"complete");assert.equal(completed.unitState.responseProgress,"complete");
      diagnostic.mark("complete-logo");
      await logo.click();
      if(leave==="forbidden") {
        await page.locator('[data-cy^="toast-text-"]').filter({hasText:"Es darf erst weiter geblättert werden, wenn die Zeit abgelaufen ist."}).waitFor();
        assert.equal(await page.locator("mat-dialog-container").count(),0);
        assert.deepEqual((await api(returnPath,{confirmTestletTimeLeave:true},token,"POST",409)).details.deniedReasons,["testlet_time_leave_forbidden"]);
      } else {
        diagnostic.mark("complete-dialog");
        await waitForMaterialDialog(page);
        diagnostic.mark("return-starter");
        await page.locator("#participantConfirmationContinueButton").click();
        await page.locator("#originalParticipantStarter mat-card").first().waitFor();assert.equal(mutations.length,1);
        const runtime=await api(`/api/v1/participant/sessions/${identity.participantSession.participantSessionId}/runtime-state`,undefined,token);
        assert.equal(runtime.runtimeState.latestTestRun.testRunId,runId);assert.equal(runtime.runtimeState.latestTestRun.status,"paused");
        assert.equal(runtime.runtimeState.latestTestRun.unitResponses["unit-intro"],completedPacket);
      }
      diagnostic.mark("context-close");
      await context.close();console.log(`original_exit_completeness=${key}:passed`);
      } catch(error) {
        await diagnostic.capture(error).catch(()=>console.log("exit_completeness_diagnostics=unavailable"));
        throw error;
      }
    }
  }
  assert.deepEqual(errors,[]);failureGate.assertHealthy();
} finally {
  await writeFile(join(artifacts,"completeness.json"),JSON.stringify({states,errors},null,2));
  await browser?.close();server.kill("SIGTERM");
  await raceWithSmokeDeadline(serverClosed, 10_000, () => {server.kill("SIGKILL");throw Error("Owned API shutdown timed out");});
  failureGate.assertHealthy();
}
