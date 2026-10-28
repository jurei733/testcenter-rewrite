import { raceWithSmokeDeadline } from "./smoke-deadline.mjs";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { access, mkdtemp, readFile, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { parseVeronaUnitResponse } from "@testcenter-rewrite-app/contracts";
import { localDemoSourcePackage } from "../apps/api/dist/apps/api/src/local-demo-bootstrap.js";
import { completenessPlayer } from "./exit-completeness-fixture.mjs";
import { createServerRequestFailureGate } from "./server-request-failure-gate.mjs";

const root = resolve(process.env.UI_SMOKE_FRONTEND_ROOT || ".");
await access(join(root,"dist/apps/web/browser/index.html"));
const artifacts = await mkdtemp(join(tmpdir(),"testcenter-starter-advisories-"));
console.log(`owned_artifacts=${artifacts}`);
const failureGate = createServerRequestFailureGate();
const module = pathToFileURL(resolve("apps/api/dist/apps/api/src/index.js")).href;
const reference=JSON.parse(await readFile(new URL("./fixtures/original-starter-advisories.json",import.meta.url),"utf8"));
assert.equal(reference.referenceRevision,"ee2ab9ab64bd91209ef8534bbe6005838024e46d");
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
  const fixtures=[];
  for(const leave of ["allowed","confirm","forbidden"]) for(const scope of ["unit","testlet"]) for(const lockConfirm of [false,true]) {
    const workspaceKey=`advisory-${leave}-${scope}-${lockConfirm}`,workspace=`/api/v1/tenants/demo-tenant/workspaces/${workspaceKey}`;
    await api("/api/v1/tenants/demo-tenant/workspaces",{workspaceKey,displayName:workspaceKey},operator);
    const content=JSON.parse(localDemoSourcePackage.sourceDocument);content.playerEntries[0].html=completenessPlayer(content.playerEntries[0].html);
    content.bookletEntries=[{bookletKey:"owned-exit",displayLabel:"Logo Testheft",config:{force_presentation_complete:"ALWAYS",force_response_complete:"ALWAYS",
      toolbar_show_unit_list:"FALSE",toolbar_show_fullscreen_button:"FALSE",toolbar_show_reload_button:"FALSE",navbar_unit_label:"HIDDEN",navbar_page_label:"HIDDEN",lock_test_on_termination:"OFF"},
      testletEntries:[{testletKey:"timed",displayLabel:"Zeitblock",parentTestletKey:null,restrictions:{timeMax:{minutes:5,leave},lockAfterLeaving:{scope,confirm:lockConfirm}}}],
      unitEntries:[{...content.bookletEntries[0].unitEntries[0],displayLabel:"Logo Aufgabe",testletPath:["timed"]}]}];
    const source=await api(workspace+"/source-packages",{fileName:"advisories.json",mediaType:"application/json",contentStructure:content},operator);
    const imported=await api(workspace+"/import-jobs",{sourcePackageId:source.sourcePackage.sourcePackageId},operator);
    await api(workspace+`/content-releases/${imported.stagedContentRelease.contentReleaseId}/activate`,{activatedByActorId:"owned-advisory"},operator);
    const modes=["run-demo","run-review","run-trial","run-hot-return"];
    await api(workspace+"/participant-roster",{rosterText:`<Testtakers><Group id="owned" label="Exit Group">${modes.map(mode=>`<Login mode="${mode}" name="${mode}"><Booklet>owned-exit</Booklet></Login>`).join("")}</Group></Testtakers>`},operator);
    fixtures.push({workspaceKey,leave,scope,lockConfirm});
  }
  browser=await chromium.launch({headless:process.env.CI==="true"&&process.env.UI_SMOKE_HEADFUL!=="true"});
  for(const mode of ["run-demo","run-review","run-trial"]) for(const {workspaceKey,leave,scope,lockConfirm} of fixtures) {
    const key=`${mode}-${leave}-${scope}-${lockConfirm}`,expected=reference.cases[key];assert.ok(expected,key);
    const context=await browser.newContext({viewport:{width:1280,height:720},locale:"de-DE"}),page=await context.newPage();
    page.on("pageerror",error=>errors.push({key,error:String(error)}));
    // Observe the owned Player's real messages without touching its controller.
    await page.addInitScript(()=>{window.ownedVeronaReports=[];window.addEventListener("message",event=>{if(event.data?.type==="vopStateChangedNotification")window.ownedVeronaReports.push(event.data);});});
    await page.goto(`${base}/app/participant?ui=original&tenantKey=demo-tenant&workspaceKey=${workspaceKey}`,{waitUntil:"networkidle"});
    await page.locator("#originalLoginName").fill(mode);
    const signedIn=page.waitForResponse(r=>new URL(r.url()).pathname==="/api/v1/participant/auth/sign-in"&&r.request().method()==="POST");
    await page.getByRole("button",{name:"Weiter",exact:true}).click();const identity=await (await signedIn).json(),token=identity.sessionToken;
    const frame=page.frameLocator("iframe");await frame.locator("#exitPresentation").waitFor();
    await frame.locator("#demoPlayerAnswer").fill(`Exact ${key} Ω  whitespace`);
    await frame.locator("#exitPresentation").selectOption("some");await frame.locator("#exitResponse").selectOption("none");
    await page.waitForFunction(()=>window.ownedVeronaReports.some(report=>report.unitState.presentationProgress==="some"&&report.unitState.responseProgress==="none"));
    const currentPath=`/api/v1/participant/sessions/${identity.participantSession.participantSessionId}/current-state`;
    let current=(await api(currentPath,undefined,token)).currentRunState;
    if(mode==="run-trial") for(let attempt=0;attempt<100;attempt++) {
      current=(await api(currentPath,undefined,token)).currentRunState;
      const parsed=parseVeronaUnitResponse(current.testRun.unitResponses["unit-intro"]||"");
      if(parsed?.unitState.presentationProgress==="some"&&parsed.unitState.responseProgress==="none")break;
      await delay(100);
    }
    const runId=current.testRun.testRunId,packet=current.testRun.unitResponses["unit-intro"],timerBefore=current.testRun.testletTimers.timed;
    if(mode==="run-trial")assert.equal(parseVeronaUnitResponse(packet).unitState.presentationProgress,"some");else assert.deepEqual(current.testRun.unitResponses,{});
    const preparePath=`/api/v1/participant/test-runs/${runId}/prepare-starter-exit`,returnPath=`/api/v1/participant/test-runs/${runId}/return-to-starter`;
    if(mode==="run-demo") {
      await api(preparePath,{currentUnitKey:"unit-intro"},undefined,"POST",401);
      const foreign=await api("/api/v1/participant/auth/sign-in",{tenantKey:"demo-tenant",workspaceKey,loginKey:"run-hot-return"});
      await api(preparePath,{currentUnitKey:"unit-intro"},foreign.sessionToken,"POST",401);
      assert.equal((await api(preparePath,{currentUnitKey:"old-unit"},token,"POST",409)).error,"starter_exit_unit_changed");
      assert.equal((await api(returnPath,{currentUnitKey:"old-unit"},token,"POST",409)).error,"starter_exit_unit_changed");
      assert.deepEqual((await api(currentPath,undefined,token)).currentRunState.testRun.testletTimers.timed,timerBefore);
    }
    const mutations=[],preparations=[];
    page.on("request",request=>{if(request.method()==="POST"){const path=new URL(request.url()).pathname;if(path===returnPath)mutations.push(request.postDataJSON());if(path===preparePath)preparations.push(request.postDataJSON());}});
    const notices=()=>page.locator('[data-cy^="toast-text-"]').allTextContents();
    const readPrepared=async()=>{
      const testRun=(await api(currentPath,undefined,token)).currentRunState.testRun;
      assert.equal(testRun.status,"running");assert.equal(testRun.currentUnitKey,"unit-intro");
      assert.equal(testRun.testletTimers.timed.status,leave==="allowed"?"cancelled":"paused");
      assert.equal(testRun.testletTimers.timed.expiresAt,null);assert.deepEqual(testRun.lockedUnitKeys,[]);assert.deepEqual(testRun.lockedTestletKeys,[]);
      assert.deepEqual(testRun.unitResponses,mode==="run-trial"?{"unit-intro":packet}:{});return testRun;
    };
    const dialog=async()=>({title:(await page.locator("mat-dialog-container h2").textContent()).trim(),message:(await page.locator("mat-dialog-content").textContent()).trim()});
    await page.locator("#participantApplicationLogoButton").click();
    if(expected.beforeConsent) {
      await page.locator("mat-dialog-container").waitFor();await readPrepared();
      assert.equal(await page.locator('[data-cy="time-value"]').count(),0);
      states[key]={beforeConsent:{dialog:await dialog(),notices:await notices()}};
      assert.deepEqual(states[key].beforeConsent.dialog,expected.beforeConsent.dialog);assert.deepEqual(states[key].beforeConsent.notices,expected.beforeConsent.notices);
      await page.locator("#participantConfirmationStayButton").click();await page.locator("mat-dialog-container").waitFor({state:"detached"});
      const stopped=await readPrepared();assert.equal(mutations.length,0);assert.equal(preparations.length,1);
      states[key].stayed={notices:await notices()};assert.deepEqual(states[key].stayed.notices,expected.stayed.notices);
      await page.locator("#participantApplicationLogoButton").click();await page.locator("mat-dialog-container").waitFor();
      assert.equal(preparations.length,1);assert.deepEqual((await api(currentPath,undefined,token)).currentRunState.testRun.testletTimers,stopped.testletTimers);
      states[key].secondConsent={dialog:await dialog(),notices:await notices()};assert.deepEqual(states[key].secondConsent.dialog,expected.secondConsent.dialog);
      assert.deepEqual(states[key].secondConsent.notices,expected.secondConsent.notices);
      await page.locator("#participantConfirmationContinueButton").click();
    }
    await page.locator("#originalParticipantStarter mat-card").first().waitFor();assert.equal(mutations.length,1);assert.equal(preparations.length,1);
    states[key]??={};states[key].left={notices:await notices()};assert.deepEqual(states[key].left.notices,expected.left.notices);
    const returned=(await api(`/api/v1/participant/sessions/${identity.participantSession.participantSessionId}/runtime-state`,undefined,token)).runtimeState.latestTestRun;
    assert.deepEqual(returned.lockedUnitKeys,[]);assert.deepEqual(returned.lockedTestletKeys,[]);
    assert.deepEqual(returned.unitResponses,mode==="run-trial"?{"unit-intro":packet}:{});
    assert.equal(returned.status,mode==="run-trial"?"paused":"running");
    await context.close();console.log(`original_starter_advisory=${key}:passed`);
  }
  assert.deepEqual(errors,[]);failureGate.assertHealthy();
} finally {
  await writeFile(join(artifacts,"advisories.json"),JSON.stringify({states,errors},null,2));
  await browser?.close();server.kill("SIGTERM");
  await raceWithSmokeDeadline(serverClosed, 10_000, () => {server.kill("SIGKILL");throw Error("Owned API shutdown timed out");});
  failureGate.assertHealthy();
}
