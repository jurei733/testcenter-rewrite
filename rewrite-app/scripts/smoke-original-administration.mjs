import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { mkdtemp, mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { chromium } from "playwright";
import { raceWithSmokeDeadline } from "./smoke-deadline.mjs";
import { runOriginalApplicationSettingsSmoke } from "./original-application-settings-smoke.mjs";
import { waitForMaterialDialog } from "./material-dialog-ready.mjs";

// Real protected API, native Original controls and an owned SQLite database.
// Setup credentials never pre-authenticate the browser or enter UI fixtures.
const scratch=await mkdtemp(join(tmpdir(),"original-administration-"));
const artifacts=process.env.UI_SMOKE_ARTIFACT_DIR?resolve(process.env.UI_SMOKE_ARTIFACT_DIR,"original-administration"):scratch;
await mkdir(artifacts,{recursive:true});console.log(`owned_artifacts=${artifacts}`);
const frontendRoot=resolve(process.env.UI_SMOKE_FRONTEND_ROOT||".");
const module=pathToFileURL(resolve("apps/api/dist/apps/api/src/index.js")).href;
const server=spawn(process.execPath,["--input-type=module","-e",`
  import{createProductionApiServer}from ${JSON.stringify(module)};
  const server=await createProductionApiServer();
  server.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));
  process.once('SIGTERM',()=>server.close(()=>process.exit(0)));
`],{cwd:frontendRoot,stdio:["ignore","ignore","inherit","ipc"],env:{...process.env,PORT:"4310",FIRST_SLICE_STORE:"sqlite",
  FIRST_SLICE_SQLITE_FILE:join(scratch,"store.sqlite"),FIRST_SLICE_BOOTSTRAP_DEMO:"true",FIRST_SLICE_OPERATOR_AUTH_REQUIRED:"true",FIRST_SLICE_PROOF_OF_WORK_SCOPES:""}});
const closed=new Promise(done=>server.once("close",done));
let browser,page,token;
try{
  const port=await raceWithSmokeDeadline(new Promise((done,reject)=>{
    server.once("message",message=>done(message.port));server.once("error",reject);server.once("exit",()=>reject(Error("Owned API exited during startup.")));
  }),20000,()=>{throw Error("Owned API startup timed out.");});
  const base=`http://127.0.0.1:${port}`;
  const api=async(path,body,method=body===undefined?"GET":"POST",expected)=>{
    const response=await fetch(base+path,{method,headers:{...(token?{authorization:`Bearer ${token}`}:{ }),
      ...(body===undefined?{}:{"content-type":"application/json"})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    assert.ok(expected===undefined?response.ok:response.status===expected,`${method} ${path}: ${response.status}`);
    return response.status===204?null:response.json();
  };
  await api("/api/v1/admin/users",undefined,"GET",401);
  const operator=await api("/api/v1/admin/auth/sign-in",{username:"demo-admin",password:"demo-admin-password"});
  token=operator.sessionToken;
  const users=[];
  for(const name of ["owned-admin-a","owned-admin-b","owned-admin-c"]){
    users.push(await api("/api/v1/admin/users",{username:name,password:"Owned-admin-password-9!",roleAssignments:[]}));
  }
  await api("/api/v1/platform/tenants",{tenantKey:"owned-other-tenant",displayName:"Owned other tenant"});
  const alpha=(await api("/api/v1/tenants/demo-tenant/workspaces",{workspaceKey:"owned-alpha",displayName:"Alpha Arbeitsbereich"})).workspace;
  const beta=(await api("/api/v1/tenants/owned-other-tenant/workspaces",{workspaceKey:"owned-beta",displayName:"Beta Arbeitsbereich"})).workspace;
  const adminId=users[0].adminUser.adminUserId,secondId=users[1].adminUser.adminUserId;
  const headful=process.env.CI!=="true"||process.env.UI_SMOKE_HEADFUL==="true";
  browser=await chromium.launch({headless:!headful});
  const context=await browser.newContext({viewport:{width:1280,height:844},locale:"de-DE",timezoneId:"Europe/Berlin"});
  page=await context.newPage();await page.bringToFront();const errors=[];
  page.on("pageerror",error=>errors.push(String(error)));
  await page.goto(base+"/app/ops?ui=original",{waitUntil:"networkidle"});
  await page.locator("#adminUsername").fill("demo-admin");await page.locator("#adminPassword").fill("demo-admin-password");
  const browserSignedIn=page.waitForResponse(response=>new URL(response.url()).pathname==="/api/v1/admin/auth/sign-in"&&response.ok());
  await page.locator("#adminSignInButton").click();const browserToken=(await(await browserSignedIn).json()).sessionToken;
  assert.notEqual(browserToken,token,"The browser must own its actual sign-in session, separate from setup.");
  const surface=page.locator('#originalSystemAdministration[aria-busy="false"]');await surface.waitFor();
  assert.equal(await page.locator("#originalAdministrationHeader h1").textContent(),"Systemverwaltung");
  assert.equal(await page.locator(".hero:visible,.view-nav:visible,.app-layout:visible").count(),0);
  assert.equal(await page.locator("#adminSessionToken").count(),0);
  await page.locator(`[data-admin-id="${adminId}"]`).click();
  const ro=page.locator(`[data-cy="workspace-${alpha.workspaceId}-role-ro"] input`);
  const rw=page.locator(`[data-cy="workspace-${alpha.workspaceId}-role-rw"] input`);
  const originalCheckbox=await ro.elementHandle();
  await ro.check();await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
  assert.equal(await originalCheckbox.evaluate(element=>element.isConnected),true,"Editing a permission must retain the actual focused checkbox row.");
  assert.equal(await ro.evaluate(element=>element===document.activeElement),true);
  assert.equal(await rw.isChecked(),false);await page.locator('[data-cy="save"]').click();await surface.waitFor();
  let directory=await api("/api/v1/admin/users");
  assert.equal(directory.items.find(item=>item.adminUser.adminUserId===adminId).roleAssignments.find(role=>role.workspaceId===alpha.workspaceId).accessMode,"read_only");
  console.log("original_administration=users-real-read-only-grant:passed");
  await page.locator('[data-cy="superadmin-tabs:workspaces"]').click();
  await page.locator(`[data-workspace-id="${beta.workspaceId}"]`).click();
  const row=page.locator(".directory-permissions mat-row").filter({hasText:"owned-admin-b"});
  await row.getByRole("checkbox",{name:"Lesen und Schreiben",exact:true}).check();
  await page.locator('[data-cy="save"]').click();await surface.waitFor();
  directory=await api("/api/v1/admin/users");const assigned=directory.items.find(item=>item.adminUser.adminUserId===secondId).roleAssignments.find(role=>role.workspaceId===beta.workspaceId);
  assert.equal(assigned.accessMode,"read_write");assert.equal(assigned.tenantId,beta.tenantId);
  console.log("original_administration=workspace-exact-cross-tenant-write-grant:passed");
  await row.getByRole("checkbox",{name:"Nur Lesen",exact:true}).uncheck();
  await page.locator('[data-cy="save"]:enabled').waitFor();
  assert.equal(await page.locator('[data-cy="save"]').isEnabled(),true);
  await page.locator('[data-cy="rename-workspace"]').click();await waitForMaterialDialog(page);
  assert.equal(await page.locator('#originalAdministrationName').inputValue(),'');
  await page.locator('#originalAdministrationName').fill('ab');
  await page.locator('#originalAdministrationEditorSave:disabled').waitFor();
  await page.locator("#originalAdministrationName").fill("ZZZ Beta geändert");await page.locator("#originalAdministrationEditorSave").click();
  await page.locator("mat-dialog-container").waitFor({state:"detached"});
  assert.equal((await api("/api/v1/tenants/owned-other-tenant/workspaces")).items.find(item=>item.workspaceId===beta.workspaceId).displayName,"ZZZ Beta geändert");
  assert.equal(await page.locator('.directory-list [data-workspace-id]').last().getAttribute('data-workspace-id'),beta.workspaceId,
    "Renaming must move the actual workspace to its new global name position.");
  assert.equal(await page.locator('[data-cy="rename-workspace"]').isDisabled(),true);
  assert.equal(await page.locator('[data-cy="delete-workspace"]').isDisabled(),true);
  assert.equal(await page.locator('.directory-permissions [data-cy="save"]').count(),0);
  assert.equal((await api("/api/v1/admin/users")).items.find(item=>item.adminUser.adminUserId===secondId)
    .roleAssignments.find(role=>role.workspaceId===beta.workspaceId).accessMode,"read_write",
    "Renaming discards the unsaved checkbox draft without submitting it.");
  await page.locator(`[data-workspace-id="${beta.workspaceId}"]`).click();
  assert.equal(await row.getByRole("checkbox",{name:"Lesen und Schreiben",exact:true}).isChecked(),true);
  await page.locator('[data-cy="delete-workspace"]').click();
  const password=page.locator("#globalConfirmationPasswordInput");await password.waitFor();
  await password.fill("wrong-password");await page.locator("#globalConfirmationConfirmButton").click();
  await page.getByText("Falsches Kennwort.",{exact:true}).waitFor();
  assert.equal((await api("/api/v1/tenants/owned-other-tenant/workspaces")).items.some(item=>item.workspaceId===beta.workspaceId),true);
  await page.locator("#globalConfirmationCancelButton").click();await page.locator("mat-dialog-container").waitFor({state:"detached"});
  console.log("original_administration=rename-and-wrong-delete-password-preserved:passed");
  await page.locator('[data-cy="delete-workspace"]').click();await page.locator("#globalConfirmationPasswordInput").fill("demo-admin-password");
  await page.locator("#globalConfirmationConfirmButton").click();await page.locator("mat-dialog-container").waitFor({state:"detached"});
  assert.equal((await api("/api/v1/tenants/owned-other-tenant/workspaces")).items.some(item=>item.workspaceId===beta.workspaceId),false);
  assert.equal((await api("/api/v1/admin/users")).items.find(item=>item.adminUser.adminUserId===secondId).roleAssignments.some(role=>role.workspaceId===beta.workspaceId),false);
  console.log("original_administration=confirmed-workspace-delete-cascades-membership:passed");
  await page.locator('[data-cy="add-workspace"]').click();await waitForMaterialDialog(page);
  await page.locator('#originalAdministrationName').fill('ab');
  await page.locator('#originalAdministrationEditorSave:disabled').waitFor();
  await page.locator("#originalAdministrationName").fill("AAA Neuer Original-Bereich");await page.locator("#originalAdministrationEditorSave").click();
  await page.locator("mat-dialog-container").waitFor({state:"detached"});
  const tenants=await api("/api/v1/platform/tenants");assert.ok(tenants.items.some(item=>item.tenantKey==="original-interface"));
  const originalWorkspaces=(await api("/api/v1/tenants/original-interface/workspaces")).items;
  assert.deepEqual(originalWorkspaces.map(item=>item.displayName),["AAA Neuer Original-Bereich"]);
  assert.equal(await page.locator('.directory-list [data-workspace-id]').first().getAttribute('data-workspace-id'),originalWorkspaces[0].workspaceId,
    "The flat directory must insert a new name before existing entries in other tenants.");
  console.log("original_administration=workspace-name-only-create-in-owned-container:passed");
  await page.locator('[data-cy="superadmin-tabs:users"]').click();
  await page.locator('[data-cy="add-user"]').click();await waitForMaterialDialog(page);
  await page.locator("#originalAdministrationName").fill("aaa-new-original-admin");
  await page.locator("#originalAdministrationPassword").fill("New-original-password-9!");
  await page.locator("#originalAdministrationEditorSave").click();await page.locator("mat-dialog-container").waitFor({state:"detached"});
  const created=(await api("/api/v1/admin/users")).items.find(item=>item.adminUser.username==="aaa-new-original-admin");assert.ok(created);
  assert.equal(await page.locator('.directory-list [data-admin-id]').first().getAttribute('data-admin-id'),created.adminUser.adminUserId,
    "The new administrator must precede the signed-in operator by Source name order.");
  await page.locator(`[data-admin-id="${created.adminUser.adminUserId}"]`).click();
  const unsavedCreatedAccess=page.locator(`[data-cy="workspace-${alpha.workspaceId}-role-ro"] input`);
  await unsavedCreatedAccess.check();
  await page.locator('[data-cy="change-superadmin"]').click();await page.locator("#globalConfirmationPasswordInput").fill("wrong-confirmation");
  assert.equal((await page.locator('#globalConfirmationTitle').textContent()).trim(),'Superadmin-Status setzen');
  await page.locator("#globalConfirmationConfirmButton").click();await page.getByText("Falsches Kennwort.",{exact:true}).waitFor();
  assert.equal(await unsavedCreatedAccess.isChecked(),true,"Rejected status changes retain the selected user's draft.");
  await page.locator("#globalConfirmationPasswordInput").fill("demo-admin-password");
  await page.locator("#globalConfirmationConfirmButton").click();await page.locator("mat-dialog-container").waitFor({state:"detached"});
  const promoted=(await api("/api/v1/admin/users")).items.find(item=>item.adminUser.adminUserId===created.adminUser.adminUserId);
  assert.ok(promoted.roleAssignments.some(role=>role.role==="platform_admin"));
  assert.equal(promoted.roleAssignments.some(role=>role.workspaceId===alpha.workspaceId),false);
  assert.equal(await page.locator('[data-cy="delete-user"]').isDisabled(),true);
  assert.equal(await page.locator('[data-cy="change-superadmin"]').isDisabled(),true);
  assert.equal(await page.locator('.directory-permissions [data-cy="save"]').count(),0);
  await page.locator(`[data-admin-id="${created.adminUser.adminUserId}"]`).click();
  assert.equal(await unsavedCreatedAccess.isChecked(),false);
  await page.locator('[data-cy="change-superadmin"]').click();
  await page.locator('#globalConfirmationPasswordInput').waitFor();
  assert.equal((await page.locator('#globalConfirmationTitle').textContent()).trim(),'Superadmin-Status entziehen');
  await page.locator('#globalConfirmationCancelButton').click();await page.locator('mat-dialog-container').waitFor({state:'detached'});
  assert.ok((await api('/api/v1/admin/users')).items.find(item=>item.adminUser.adminUserId===created.adminUser.adminUserId)
    .roleAssignments.some(role=>role.role==='platform_admin'),'Cancelling the revoke dialog must preserve the acknowledged role.');
  await page.locator('[data-cy="delete-user"]').click();await page.locator("#globalConfirmationPasswordInput").fill("demo-admin-password");
  await page.locator("#globalConfirmationConfirmButton").click();await page.locator("mat-dialog-container").waitFor({state:"detached"});
  assert.equal((await api("/api/v1/admin/users")).items.some(item=>item.adminUser.adminUserId===created.adminUser.adminUserId),false);
  console.log("original_administration=real-user-create-step-up-promotion-and-delete:passed");
  await runOriginalApplicationSettingsSmoke(page,api,{artifacts});
  const resetInOriginal=async password=>{
    await page.locator(`[data-admin-id="${adminId}"]`).click();await page.locator('[data-cy="change-password"]').click();await waitForMaterialDialog(page);
    await page.locator("#originalAdministrationPassword").fill(password);await page.locator("#originalAdministrationEditorSave").click();
    await page.locator("mat-dialog-container").waitFor({state:"detached"});
  };
  await resetInOriginal("Reset-original-password-9!");
  assert.equal((await api("/api/v1/admin/users")).items.find(item=>item.adminUser.adminUserId===adminId).adminUser.passwordChangeRequired,true);
  const guest=await browser.newContext({serviceWorkers:"block"}),guestPage=await guest.newPage();await guestPage.bringToFront();
  await guestPage.goto(base+"/app/ops?ui=original",{waitUntil:"networkidle"});
  await guestPage.locator("#adminUsername").fill("owned-admin-a");await guestPage.locator("#adminPassword").fill("Reset-original-password-9!");
  const signedIn=guestPage.waitForResponse(response=>new URL(response.url()).pathname==="/api/v1/admin/auth/sign-in"&&response.ok());
  await guestPage.locator("#adminSignInButton").click();const guestToken=(await(await signedIn).json()).sessionToken;
  await guestPage.locator("#requiredAdminPassword").fill("Own-original-password-9!");
  await guestPage.locator("#requiredAdminPasswordConfirmation").fill("Own-original-password-9!");
  await guestPage.locator("#requiredAdminPasswordSubmitButton").click();await guestPage.locator("#requiredAdminPasswordChangeDialog").waitFor({state:"detached"});
  assert.equal((await fetch(base+"/api/v1/admin/auth/current-session",{headers:{authorization:`Bearer ${guestToken}`}})).status,401);
  await guest.close();await page.bringToFront();
  console.log("original_administration=reset-real-login-lazy-required-password-change-revokes-session:passed");
  await resetInOriginal("Reset-original-again-9!");
  const assets=await readdir(resolve(frontendRoot,"dist/apps/web/browser"));const passwordChunks=[];
  for(const name of assets.filter(name=>name.endsWith('.js'))){
    if(/selectors:\s*\[\s*\[\s*"app-admin-password-dialogs"/.test(await readFile(resolve(frontendRoot,"dist/apps/web/browser",name),"utf8")))passwordChunks.push(name);
  }
  assert.equal(passwordChunks.length,1,"The actual lazy password renderer must be unambiguous.");
  const failedGuest=await browser.newContext({serviceWorkers:"block"});
  await failedGuest.route(`**/${passwordChunks[0]}`,route=>route.abort("failed"));
  const failedPage=await failedGuest.newPage();await failedPage.bringToFront();
  await failedPage.goto(base+"/app/ops?ui=original",{waitUntil:"networkidle"});
  await failedPage.locator("#adminUsername").fill("owned-admin-a");await failedPage.locator("#adminPassword").fill("Reset-original-again-9!");
  const failedLogin=failedPage.waitForResponse(response=>new URL(response.url()).pathname==="/api/v1/admin/auth/sign-in"&&response.ok());
  await failedPage.locator("#adminSignInButton").click();const failedToken=(await(await failedLogin).json()).sessionToken;
  const fallback=failedPage.getByRole("alertdialog",{name:"Password form unavailable"});await fallback.waitFor();
  const denied=await fetch(base+"/api/v1/admin/users",{headers:{authorization:`Bearer ${failedToken}`}});
  assert.equal(denied.status,403);assert.equal((await denied.json()).error,"admin_password_change_required");
  await fallback.getByRole("button",{name:"Close",exact:true}).click();
  await fallback.waitFor({state:"detached"});
  assert.equal((await fetch(base+"/api/v1/admin/auth/current-session",{headers:{authorization:`Bearer ${failedToken}`}})).status,401);
  await failedGuest.close();await page.bringToFront();
  console.log("original_administration=missing-password-renderer-keeps-server-gate-and-safe-signout:passed");
  await page.locator(`[data-admin-id="${operator.adminUser.adminUserId}"]`).click();
  await page.locator('[data-cy="change-password"]').click();await waitForMaterialDialog(page);
  await page.locator("#originalAdministrationPassword").fill("Own-root-updated-password-9!");await page.locator("#originalAdministrationEditorSave").click();
  await page.locator("mat-dialog-container").waitFor({state:"detached"});
  assert.equal((await api("/api/v1/admin/users")).items.find(item=>item.adminUser.adminUserId===operator.adminUser.adminUserId).adminUser.passwordChangeRequired,false);
  assert.equal(await page.evaluate(secret=>JSON.stringify({...localStorage,...sessionStorage}).includes(secret),"Own-root-updated-password-9!"),false);
  console.log("original_administration=own-existing-password-reset-and-secret-not-persisted:passed");
  for(const theme of ["Primar","Sekundar","Erwachsene"]){
    await api("/api/v1/admin/application-settings",{themeName:theme},"PATCH");
    await page.reload({waitUntil:"domcontentloaded"});await surface.waitFor();
    for(const [label,width,height]of [["desktop",1280,844],["mobile",390,844]]){
      await page.setViewportSize({width,height});await page.bringToFront();
      await page.evaluate(()=>document.fonts.ready);await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
      await page.locator(`[data-admin-id="${adminId}"]`).click();
      await page.screenshot({path:join(artifacts,`${theme}-${label}-users.png`),fullPage:false});
      await page.locator('[data-cy="superadmin-tabs:workspaces"]').click();
      await page.locator(`[data-workspace-id="${alpha.workspaceId}"]`).click();
      await page.screenshot({path:join(artifacts,`${theme}-${label}-workspaces.png`),fullPage:false});
      await page.locator('[data-cy="superadmin-tabs:users"]').click();
    }
  }
  await page.setViewportSize({width:1280,height:844});
  await page.locator("#originalAdministrationAccountButton").click();
  const account=page.locator(".original-administration-account-menu");await account.waitFor();
  assert.match(await account.innerText(),/demo-admin/);
  assert.match(await account.innerText(),/Verwaltung von Nutzerrechten und von grundsätzlichen Systemeinstellungen/);
  assert.match(await account.innerText(),/Rewrite/);
  await page.locator("#globalAdminSignOutButton").click();await waitForMaterialDialog(page);
  await page.locator("#originalParticipantLogoutCancelButton").click();await page.locator("mat-dialog-container").waitFor({state:"detached"});
  assert.equal((await fetch(base+"/api/v1/admin/auth/current-session",{headers:{authorization:`Bearer ${browserToken}`}})).status,200);
  await page.locator("#originalAdministrationAccountButton").click();await page.locator("#globalAdminSignOutButton").click();
  await waitForMaterialDialog(page);await page.locator("#originalParticipantLogoutConfirmButton").click();
  await page.locator("#adminSignInButton").waitFor();
  assert.equal((await fetch(base+"/api/v1/admin/auth/current-session",{headers:{authorization:`Bearer ${browserToken}`}})).status,401);
  assert.equal((await api("/api/v1/admin/auth/current-session")).adminUser.adminUserId,operator.adminUser.adminUserId);
  assert.deepEqual(errors,[]);await context.close();console.log("original_administration=all-real-api-actions-safe-logout-and-twelve-theme-captures:passed");
}catch(error){
  try{await page?.screenshot({path:join(artifacts,"failure.png"),fullPage:false});await writeFile(join(artifacts,"failure.html"),await page.content());}catch{}
  throw error;
}finally{
  await browser?.close();server.kill("SIGTERM");
  await raceWithSmokeDeadline(closed,10000,()=>{server.kill("SIGKILL");throw Error("Owned API shutdown timed out.");});
  console.log("owned_api=shutdown");
}
