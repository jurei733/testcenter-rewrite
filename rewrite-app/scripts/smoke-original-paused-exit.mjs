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
const reference=JSON.parse(await readFile(new URL("./fixtures/original-paused-exit.json",import.meta.url),"utf8"));
assert.equal(reference.referenceRevision,"ee2ab9ab64bd91209ef8534bbe6005838024e46d");
const artifacts = await mkdtemp(join(tmpdir(),"testcenter-paused-exit-"));
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
  const fixtures=new Map();
  for(const key of Object.keys(reference.cases)) {
    const [mode,,,leave,silentText]=key.match(/^(run-hot-return|run-hot-restart)-(Primar|Sekundar|Erwachsene)-(desktop|mobile)-(allowed|confirm|forbidden)-(false|true)(?:-locked)?$/).slice(1);
    const silent=silentText==="true",locked=key.endsWith("-locked");
    const workspaceKey=`paused-${key.toLowerCase()}`,workspace=`/api/v1/tenants/demo-tenant/workspaces/${workspaceKey}`;
    await api("/api/v1/tenants/demo-tenant/workspaces",{workspaceKey,displayName:workspaceKey},operator);
    const content=JSON.parse(localDemoSourcePackage.sourceDocument);content.playerEntries[0].html=completenessPlayer(content.playerEntries[0].html);
    content.bookletEntries=[{bookletKey:"owned-exit",displayLabel:"Logo Testheft",config:{silent_mode:silent?"TRUE":"FALSE",force_presentation_complete:"ALWAYS",force_response_complete:"ALWAYS",
      toolbar_show_unit_list:"FALSE",toolbar_show_fullscreen_button:"FALSE",toolbar_show_reload_button:"FALSE",navbar_unit_label:"HIDDEN",navbar_page_label:"HIDDEN",lock_test_on_termination:locked?"ON":"OFF"},
      testletEntries:[{testletKey:"timed",displayLabel:"Zeitblock",parentTestletKey:null,restrictions:{timeMax:{minutes:5,leave},lockAfterLeaving:{scope:"unit",confirm:true}}}],
      unitEntries:[{...content.bookletEntries[0].unitEntries[0],displayLabel:"Logo Aufgabe",testletPath:["timed"]}]}];
    const source=await api(workspace+"/source-packages",{fileName:"paused.json",mediaType:"application/json",contentStructure:content},operator);
    const imported=await api(workspace+"/import-jobs",{sourcePackageId:source.sourcePackage.sourcePackageId},operator);
    await api(workspace+`/content-releases/${imported.stagedContentRelease.contentReleaseId}/activate`,{activatedByActorId:"paused-proof"},operator);
    await api(workspace+"/participant-roster",{rosterText:`<Testtakers><Group id="owned" label="Exit Group"><Login mode="${mode}" name="exit-person"><Booklet>owned-exit</Booklet></Login><Login mode="${mode}" name="foreign-person"><Booklet>owned-exit</Booklet></Login></Group></Testtakers>`},operator);
    fixtures.set(key,{workspaceKey,workspace});
  }
  browser=await chromium.launch({headless:process.env.CI==="true"&&process.env.UI_SMOKE_HEADFUL!=="true"});
  for(const [key,expected] of Object.entries(reference.cases)) {
    if(process.env.UI_SMOKE_ONLY_CASE&&key!==process.env.UI_SMOKE_ONLY_CASE)continue;
    const [,theme,screen,leave,silentText]=key.match(/^(run-hot-return|run-hot-restart)-(Primar|Sekundar|Erwachsene)-(desktop|mobile)-(allowed|confirm|forbidden)-(false|true)(?:-locked)?$/).slice(1);
    const locked=key.endsWith("-locked");
    const mode=key.startsWith("run-hot-return")?"run-hot-return":"run-hot-restart",silent=silentText==="true";
    const {workspaceKey,workspace}=fixtures.get(key);
    await api("/api/v1/admin/application-settings",{themeName:theme},operator,"PATCH");
    const viewport=screen==="desktop"?{width:1280,height:720}:{width:390,height:844};
    const context=await browser.newContext({viewport,locale:"de-DE"}),page=await context.newPage();
    page.on("pageerror",error=>errors.push({key,error:String(error)}));
    await page.goto(`${base}/app/participant?ui=original&theme=${theme}&tenantKey=demo-tenant&workspaceKey=${workspaceKey}`,{waitUntil:"networkidle"});
    await page.locator("#originalLoginName").fill("exit-person");
    const signedIn=page.waitForResponse(r=>new URL(r.url()).pathname==="/api/v1/participant/auth/sign-in"&&r.request().method()==="POST");
    await page.getByRole("button",{name:"Weiter",exact:true}).click();const identity=await (await signedIn).json(),token=identity.sessionToken;
    const frame=page.frameLocator("iframe");await frame.locator("#exitPresentation").waitFor();
    await frame.locator("#demoPlayerAnswer").fill(`Exact paused ${key} Ω  whitespace`);
    await frame.locator("#exitPresentation").selectOption("some");await frame.locator("#exitResponse").selectOption("none");
    const currentPath=`/api/v1/participant/sessions/${identity.participantSession.participantSessionId}/current-state`;
    let current;
    for(let attempt=0;attempt<100;attempt++) {
      current=(await api(currentPath,undefined,token)).currentRunState;
      const parsed=parseVeronaUnitResponse(current.testRun.unitResponses["unit-intro"]||"");
      if(parsed?.unitState.presentationProgress==="some"&&parsed.unitState.responseProgress==="none")break;
      await delay(100);
    }
    const runId=current.testRun.testRunId,packet=current.testRun.unitResponses["unit-intro"];
    assert.equal(parseVeronaUnitResponse(packet).unitState.presentationProgress,"some");
    const returnPath=`/api/v1/participant/test-runs/${runId}/return-to-starter`,preparePath=`/api/v1/participant/test-runs/${runId}/prepare-starter-exit`;
    await api(workspace+`/monitor/open-runs/${runId}/commands`,{commandType:"pause",actorId:"paused-proof"},operator);
    await page.locator("app-original-participant-paused mat-card").waitFor();await page.locator("iframe").waitFor({state:"detached"});
    await page.evaluate(()=>document.fonts.ready);
    const before=(await api(currentPath,undefined,token)).currentRunState.testRun;
    assert.equal(before.status,"paused");assert.equal(before.pauseSource,"monitor");assert.equal(before.unitResponses["unit-intro"],packet);
    assert.equal(await page.locator('[data-cy="time-value"]').count(),0);
    assert.equal(await page.locator("#participantRoutePausedState button").count(),0);
    const surface=await page.locator("app-original-participant-paused mat-card").evaluate(card=>{
      const read=n=>{const b=n.getBoundingClientRect(),s=getComputedStyle(n);return {x:b.x,y:b.y,width:b.width,height:b.height,font:s.font,color:s.color,background:s.backgroundColor,padding:s.padding,margin:s.margin,border:s.border,borderRadius:s.borderRadius,boxShadow:s.boxShadow};};
      return {card:read(card),title:{text:card.querySelector("mat-card-title").textContent,box:read(card.querySelector("mat-card-title"))},paragraphs:[...card.querySelectorAll("p")].map(p=>({text:p.textContent.trim(),box:read(p),bold:read(p.querySelector("b"))})),toolbar:read(document.querySelector('[data-cy="unit-screenheader"]'))};
    });
    states[key]={pausedSurface:surface};
    await page.screenshot({path:join(artifacts,`${key}-paused.png`),fullPage:true});
    const compareBox=(actual,wanted,label)=>{
      for(const part of ["x","y","width","height"])assert.ok(Math.abs(actual[part]-wanted[part])<=0.6,`${key}/${label}/${part}: ${actual[part]} vs ${wanted[part]}`);
      for(const part of ["font","color","background","padding","margin","border","borderRadius","boxShadow"])assert.equal(actual[part],wanted[part],`${key}/${label}/${part}`);
    };
    compareBox(surface.card,expected.pausedSurface.card,"card");compareBox(surface.toolbar,expected.pausedSurface.toolbar,"toolbar");
    assert.equal(surface.title.text,expected.pausedSurface.title.text);compareBox(surface.title.box,expected.pausedSurface.title.box,"title");
    for(let i=0;i<3;i++) {assert.equal(surface.paragraphs[i].text,expected.pausedSurface.paragraphs[i].text);compareBox(surface.paragraphs[i].box,expected.pausedSurface.paragraphs[i].box,`paragraph-${i}`);compareBox(surface.paragraphs[i].bold,expected.pausedSurface.paragraphs[i].bold,`bold-${i}`);}
    await api(returnPath,{currentUnitKey:"unit-intro",expectedStatus:"paused"},undefined,"POST",401);
    const foreign=await api("/api/v1/participant/auth/sign-in",{tenantKey:"demo-tenant",workspaceKey,loginKey:"foreign-person"});
    await api(returnPath,{currentUnitKey:"unit-intro",expectedStatus:"paused"},foreign.sessionToken,"POST",401);
    assert.equal((await api(returnPath,{currentUnitKey:"old-unit",expectedStatus:"paused"},token,"POST",409)).error,"starter_exit_unit_changed");
    assert.equal((await api(returnPath,{currentUnitKey:"unit-intro",expectedStatus:"running"},token,"POST",409)).error,"starter_exit_state_changed");
    assert.deepEqual((await api(currentPath,undefined,token)).currentRunState.testRun,before);
    const mutations=[],preparations=[];
    page.on("request",request=>{if(request.method()==="POST"){const path=new URL(request.url()).pathname;if(path===returnPath)mutations.push(request.postDataJSON());if(path===preparePath)preparations.push(request.postDataJSON());}});
    await page.locator("#participantApplicationLogoButton").click();
    if(silent) {
      await page.locator("mat-dialog-container").waitFor();
      const wanted=expected.confirmation;
      assert.equal((await page.locator("mat-dialog-container h2").textContent()).trim(),wanted.title);
      assert.equal((await page.locator("mat-dialog-content").textContent()).trim(),wanted.content);
      assert.deepEqual((await page.locator("mat-dialog-container button").allTextContents()).map(x=>x.trim()),wanted.buttons.map(x=>x.text));
      await page.screenshot({path:join(artifacts,`${key}-confirmation.png`),fullPage:true});
      await page.locator("#participantConfirmationStayButton").click();await page.locator("mat-dialog-container").waitFor({state:"detached"});
      assert.equal(mutations.length,0);assert.deepEqual((await api(currentPath,undefined,token)).currentRunState.testRun,before);
      await page.locator("#participantApplicationLogoButton").click();await page.locator("#participantConfirmationContinueButton").click();
    }
    await page.locator("#originalParticipantStarter mat-card").first().waitFor();assert.equal(mutations.length,1);assert.equal(preparations.length,0);
    assert.equal(mutations[0].expectedStatus,"paused");assert.equal(mutations[0].currentUnitKey,"unit-intro");
    assert.deepEqual(await page.locator('[data-cy^="toast-text-"]').allTextContents(),expected.left.notices);
    const returned=(await api(`/api/v1/participant/sessions/${identity.participantSession.participantSessionId}/runtime-state`,undefined,token)).runtimeState.latestTestRun;
    assert.equal(returned.status,"paused");assert.equal(returned.locked,silent&&locked);assert.equal(returned.unitResponses["unit-intro"],packet);
    assert.deepEqual(returned.testletTimers,before.testletTimers);assert.deepEqual(returned.lockedUnitKeys,[]);assert.deepEqual(returned.lockedTestletKeys,[]);
    if(!silent)assert.deepEqual(returned,before);
    states[key].returned=returned;
    await context.close();console.log(`original_paused_exit=${key}:passed`);
  }
  assert.deepEqual(errors,[]);failureGate.assertHealthy();
} finally {
  await writeFile(join(artifacts,"paused-exit.json"),JSON.stringify({states,errors},null,2));
  await browser?.close();server.kill("SIGTERM");
  await Promise.race([serverClosed,delay(10_000).then(()=>{server.kill("SIGKILL");throw Error("Owned API shutdown timed out");})]);
  failureGate.assertHealthy();console.log("owned_api=shutdown");
}
