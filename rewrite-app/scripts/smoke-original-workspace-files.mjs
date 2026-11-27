import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,readFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {raceWithSmokeDeadline} from './smoke-deadline.mjs';
import {waitForMaterialDialog} from './material-dialog-ready.mjs';
import {checkOriginalAccountKeyboardFocus} from './original-account-keyboard-focus.mjs';
const scratch=await mkdtemp(join(tmpdir(),'owned-original-files-'));
const artifacts=process.env.UI_SMOKE_ARTIFACT_DIR?resolve(process.env.UI_SMOKE_ARTIFACT_DIR,'original-workspace-files'):scratch;
await mkdir(artifacts,{recursive:true});console.log('owned_artifacts='+artifacts);
const frontendRoot=resolve(process.env.UI_SMOKE_FRONTEND_ROOT||'.');
const module=pathToFileURL(resolve('apps/api/dist/apps/api/src/index.js')).href;
const server=spawn(process.execPath,['--input-type=module','-e',`
 import{createProductionApiServer}from ${JSON.stringify(module)};
 const server=await createProductionApiServer();server.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));
 process.once('SIGTERM',()=>server.close(()=>process.exit(0)));
`],{cwd:frontendRoot,stdio:['ignore','ignore','inherit','ipc'],env:{...process.env,FIRST_SLICE_STORE:'sqlite',
 FIRST_SLICE_SQLITE_FILE:join(scratch,'owned.sqlite'),FIRST_SLICE_BOOTSTRAP_DEMO:'true',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',
 FIRST_SLICE_PROOF_OF_WORK_SCOPES:'',FIRST_SLICE_XML_SCHEMA_PROFILE:'original-19',FIRST_SLICE_XML_SCHEMA_DOWNLOAD:'false',
 FIRST_SLICE_XML_SCHEMA_CACHE:resolve(process.env.FIRST_SLICE_XML_SCHEMA_CACHE||'.data/original-xml-schemas')}});
const closed=new Promise(done=>server.once('close',done));let browser,base,token,page;
const api=async(path,body,method=body===undefined?'GET':'POST',status=200,credential=token)=>{
 const response=await fetch(base+path,{method,headers:{...(credential?{authorization:'Bearer '+credential}:{}),
  ...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 const value=await response.json();assert.equal(response.status,status,method+' '+path+': '+JSON.stringify(value));return value;
};
const xml=(type,repo,version,body)=>`<${type} xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/${repo}/${version}">${body}</${type}>`;
const player='<!doctype html><html><script type="application/ld+json">'+JSON.stringify({
 $schema:'https://raw.githubusercontent.com/verona-interfaces/metadata/master/verona-module-metadata.json',id:'native-files-player',version:'6.0.4',
 specVersion:'6.0',metadataVersion:'2.0',type:'player',name:[{lang:'de',value:'Eigener Player'}],description:[{lang:'de',value:'Eigener Player'}]
})+'</script><script>globalThis.OWNED_FILES_SCRIPT_EXECUTED=true</script><main>private-player-bytes</main></html>';
const unitSource=xml('Unit','unit-xml','17.6','<Metadata><Id>NATIVE.UNIT</Id><Label>Aufgabe Ω</Label></Metadata><Definition player="native-files-player@6.0.4">private-unit-bytes</Definition>');
const utf16=Buffer.concat([Buffer.from([255,254]),Buffer.from('<?xml version="1.0" encoding="UTF-16"?>'+unitSource,'utf16le')]);
const booklet=xml('Booklet','testcenter-booklet-xml','18.0','<Metadata><Id>NATIVE.BOOK</Id><Label>Testheft Ω</Label></Metadata><Units><Unit id="NATIVE.UNIT" label="Aufgabe"/></Units>');
const check=xml('SysCheck','testcenter-syscheck-xml','18.0','<Metadata><Id>NATIVE.CHECK</Id><Label>Systemcheck Ω</Label></Metadata><Config unit="NATIVE.UNIT" skipnetwork="true"/>');
async function signIn(context,key,username='demo-admin',password='demo-admin-password',waitFiles=true) {
 const page=await context.newPage();await page.goto(base+'/app/ops?ui=original',{waitUntil:'domcontentloaded'});
 await page.locator('#adminUsername').fill(username);await page.locator('#adminPassword').fill(password);await page.locator('#adminSignInButton').click();
 await page.waitForURL(url=>url.pathname==='/app/operator-start');
 const workspaceSession=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/v1/admin/auth/current-session');
 await page.goto(base+'/app/workspace?ui=original',{waitUntil:'domcontentloaded'});
 assert.equal((await workspaceSession).status(),200);
 await page.locator('#tenantKey').fill('demo-tenant');await page.locator('#tenantKey').dispatchEvent('change');
 await page.locator('#workspaceKey').fill(key);await page.locator('#workspaceKey').dispatchEvent('change');
 await page.locator('[data-view-nav="content"]').click();if(waitFiles)await page.locator('#originalWorkspaceFiles[aria-busy="false"]').waitFor();return page;
}
async function upload(page,scope,files,status=201) {
 const responses=files.map(file=>page.waitForResponse(response=>response.url()===base+scope+'/files' &&
  response.request().method()==='POST' && response.request().postDataJSON()?.fileName===file.name));
 await page.locator('[data-cy="upload-file-select"]').setInputFiles(files.map(file=>({name:file.name,mimeType:file.type,buffer:file.bytes})));
 const values=[];for(const pending of responses){const response=await pending,body=await response.json();assert.equal(response.status(),status,JSON.stringify(body));values.push(body);}
 await page.locator('#originalWorkspaceFiles[aria-busy="false"]').waitFor();await page.locator('[data-cy="close-upload-report"]').waitFor();
 assert.equal(await page.locator('[data-cy="upload-report"] .subheading-2').count(),files.length);return values;
}
try {
 const port=await raceWithSmokeDeadline(new Promise((done,reject)=>{server.once('message',message=>done(message.port));server.once('error',reject);
  server.once('exit',()=>reject(Error('Owned native-files API exited before readiness.')));}),20000,()=>{throw Error('Owned native-files API did not start.');});
 base='http://127.0.0.1:'+port;token=(await api('/api/v1/admin/auth/sign-in',{username:'demo-admin',password:'demo-admin-password'})).sessionToken;
 browser=await chromium.launch({
  headless:process.env.CI==='true' && process.env.UI_SMOKE_HEADFUL!=='true',
  ...(process.env.UI_SMOKE_BROWSER_CHANNEL?{channel:process.env.UI_SMOKE_BROWSER_CHANNEL}:{})
 });
 const unauthenticated=await browser.newContext();
 try {
   const directStarter=await unauthenticated.newPage();
   await directStarter.goto(base+'/app/operator-start?ui=original');
   await directStarter.locator('#adminSignInButton').waitFor();
   assert.equal(new URL(directStarter.url()).searchParams.get('returnUrl'),'/operator-start?ui=original');
   assert.equal(await directStarter.locator('[data-cy^="workspace-card-"]').count(),0);
   const response=await unauthenticated.request.get(base+'/api/v1/admin/auth/current-session?view=original-workspace-starter');
   assert.equal(response.status(),401);
 } finally {await unauthenticated.close();}
 for(const theme of ['Primar','Sekundar','Erwachsene'])for(const width of [1280,390]) {
  const key='native-files-'+theme.toLowerCase()+'-'+width,scope='/api/v1/tenants/demo-tenant/workspaces/'+key;
  await api('/api/v1/admin/original-interface/application-settings',{themeName:theme},'PATCH');
  await api('/api/v1/tenants/demo-tenant/workspaces',{workspaceKey:key,displayName:'Eigener Arbeitsbereich '+width},'POST',201);
  const context=await browser.newContext({viewport:{width,height:844},locale:'de-DE',timezoneId:'Europe/Berlin'}),errors=[];
  try {
   page=await signIn(context,key);page.on('pageerror',error=>errors.push(String(error)));
   await page.getByText('Dieser Arbeitsbereich enthält noch keine Dateien!',{exact:true}).waitFor();assert.equal(await page.locator('[data-cy="delete-files"]').isDisabled(),true);
   const roster=xml('Testtakers','testcenter-testtaker-xml','18.0',`<Metadata/><Group id="${key}" label="Eigene Gruppe"><Login name="${key}-participant" pw="private-participant-password"><Booklet>NATIVE.BOOK</Booklet></Login></Group>`);
   const initial=[{name:'player.html',type:'text/html',bytes:Buffer.from(player)},{name:'shared.xml',type:'application/xml',bytes:utf16},
    {name:'shared.xml',type:'application/xml',bytes:Buffer.from(booklet)},{name:'check.xml',type:'application/xml',bytes:Buffer.from(check)},
    {name:'people.xml',type:'application/xml',bytes:Buffer.from(roster)},{name:'empty.bin',type:'application/octet-stream',bytes:Buffer.alloc(0)}];
   const uploads=[];for(const file of initial){uploads.push(...await upload(page,scope,[file]));await page.locator('[data-cy="close-upload-report"]').click();}
   assert.ok(uploads.every(value=>value.sourcePackage.status==='accepted'),JSON.stringify(uploads.map(value=>({fileName:value.sourcePackage.fileName,status:value.sourcePackage.status,diagnostics:value.importJob?.diagnostics}))));
   assert.equal(uploads[2].importJob.status,'completed');assert.ok(JSON.stringify(uploads[2].stagedContentRelease.runtimeSnapshot).includes('private-unit-bytes'));
   assert.equal(uploads[2].stagedContentRelease.runtimeSnapshot.playerEntries.find(value=>value.playerKey==='native-files-player@6.0.4')?.html,player);
   assert.equal(uploads[4].importJob.status,'completed');assert.ok(uploads[4].participantRosterImport);
   // These are native uploads with the real Original XSD validator. No
   // operator activation is needed before a protected participant can run.
   assert.equal(uploads[2].workspaceAvailability?.status,'available');
   const identity=await api('/api/v1/participant/auth/sign-in',{tenantKey:'demo-tenant',workspaceKey:key,
    loginKey:key+'-participant',password:'private-participant-password'},'POST',200,'');
   const participantToken=identity.sessionToken,sessionId=identity.participantSession.participantSessionId;
   const entered=await api('/api/v1/participant/starter:launch',{participantSessionId:sessionId,bookletKey:'NATIVE.BOOK'},'POST',200,participantToken);
   const currentPath='/api/v1/participant/sessions/'+sessionId+'/current-state?includeBookletAssets=true';
   const original=(await api(currentPath,undefined,'GET',200,participantToken)).currentRunState;
   assert.equal(original.currentUnit.unitDefinition,'private-unit-bytes');
   assert.equal(original.testRun.testRunId,entered.testRun.testRunId);
   await api(currentPath,undefined,'GET',401,'');
   await api('/api/v1/participant/test-runs/'+entered.testRun.testRunId+'/save-progress',{
    status:'paused',unitResponse:' Exact live-file answer Ω\n '},'POST',200,participantToken);
   const saved=(await api(currentPath,undefined,'GET',200,participantToken)).currentRunState;
   await api('/api/v1/participant/sessions/'+sessionId+'/resources/Testtakers/people.xml',undefined,'GET',404,participantToken);
   assert.equal(await page.locator('#originalWorkspaceFiles mat-row').count(),6);
   for(const label of ['Teilnehmerlisten','Testhefte','Systemcheck-Definitionen','Units','Ressourcen'])await page.locator('mat-panel-title').getByText(label,{exact:true}).waitFor();
   for(const [category,fileName] of [['SysCheck','check.xml'],['Testtakers','people.xml']]){
    const row=page.locator('mat-row').filter({has:page.locator('[data-cy="'+fileName+'"]')});
    await row.locator('mat-icon.report-warning').waitFor();
    assert.equal(await row.getByText(category+' is never used.',{exact:true}).count(),0);
   }
   const unusedRow=page.locator('mat-row').filter({has:page.locator('[data-cy="empty.bin"]')});
   await unusedRow.locator('mat-icon.report-warning').waitFor();
   assert.equal(await unusedRow.getByText('Resource is never used.',{exact:true}).count(),1);
   const unitRow=page.locator('mat-row').filter({has:page.locator('[data-cy="files-checkbox-NATIVE.UNIT"]')});
   assert.equal(await unitRow.locator('mat-icon.report-warning').count(),0);
   await unitRow.locator('mat-cell').last().click();
   await page.locator('mat-row.selected-row').filter({has:page.locator('[data-cy="files-checkbox-NATIVE.UNIT"]')}).waitFor();
   assert.ok((await unitRow.getAttribute('class')).includes('selected-row'));
   assert.ok(await page.locator('mat-row.isDependency').filter({hasText:'shared.xml'}).count());
   const catalog=await api(scope+'/files');
   for(const [index,bytes]of [[1,utf16],[5,Buffer.alloc(0)]]) {
    const identifier=catalog.items.find(value=>value.sourcePackageId===uploads[index].sourcePackage.sourcePackageId).metadata.identifier;
    const row=page.locator('mat-row').filter({has:page.locator(`[data-cy="files-checkbox-${identifier}"]`)});
    const received=page.waitForEvent('download');await row.locator('button').click();const download=await received;
    assert.equal(download.suggestedFilename(),initial[index].name);const saved=join(artifacts,key+'-'+index+'.bin');await download.saveAs(saved);assert.deepEqual(await readFile(saved),bytes);
   }
   assert.equal(await page.evaluate(()=>globalThis.OWNED_FILES_SCRIPT_EXECUTED),undefined);
   const before=await api(scope+'/files');
   const failed=await upload(page,scope,[{name:'invalid.xml',type:'application/xml',bytes:Buffer.from('<SysCheck/>')}],400);
   assert.equal(failed[0].error,'workspace_file_validation_failed');assert.ok(await page.locator('[data-cy="upload-report"] .subheading-2.error').count());
   await page.locator('[data-cy="close-upload-report"]').click();assert.deepEqual(await api(scope+'/files'),before);
   const changed=Buffer.concat([Buffer.from([255,254]),Buffer.from('<?xml version="1.0" encoding="UTF-16"?>'+unitSource.replace('private-unit-bytes','new-private-unit-bytes'),'utf16le')]);
   const overwritten=await upload(page,scope,[{name:'shared.xml',type:'application/xml',bytes:changed}]);assert.equal(overwritten[0].replacedSourcePackageId,uploads[1].sourcePackage.sourcePackageId);
   const updated=(await api(currentPath,undefined,'GET',200,participantToken)).currentRunState;
   assert.equal(updated.currentUnit.unitDefinition,'new-private-unit-bytes');
   assert.equal(updated.testRun.testRunId,saved.testRun.testRunId);
   assert.deepEqual(updated.testRun.unitResponses,saved.testRun.unitResponses);
   await page.locator('[data-cy="close-upload-report"]').click();assert.equal((await api(scope+'/files')).totalCount,6);
   const unused=await upload(page,scope,[{name:'unused.txt',type:'text/plain',bytes:Buffer.from('unused')}]);await page.locator('[data-cy="close-upload-report"]').click();
   await page.locator('[data-cy="files-checkbox-NATIVE.UNIT"] input').check();await page.locator('[data-cy="files-checkbox-UNUSED.TXT"] input').check();
   const deleteFiles=page.locator('[data-cy="delete-files"]');
   await deleteFiles.and(page.locator(':enabled')).press('Enter');
   await waitForMaterialDialog(page);
   const dialog=page.getByRole('dialog');
   await page.waitForFunction(()=>document.activeElement===document.querySelector('mat-dialog-container'));
   assert.deepEqual(await dialog.locator('mat-dialog-actions button').allTextContents(),['Löschen','Abbrechen']);
   assert.ok(await dialog.locator('mat-dialog-actions button').evaluateAll(buttons=>buttons.every(button=>button.classList.contains('mat-mdc-outlined-button'))));
   await dialog.getByText('Sie haben 2 Dateien ausgewählt. Sollen diese gelöscht werden?',{exact:true}).waitFor();
   await page.keyboard.press('Escape');
   await dialog.waitFor({state:'detached'});
   assert.ok(await deleteFiles.evaluate(button=>button===document.activeElement));
   assert.equal(await page.locator('#originalWorkspaceFiles input:checked').count(),2);
   const deleted=page.waitForResponse(response=>response.url()===base+scope+'/source-package-deletions' && response.request().method()==='POST');
   await page.locator('[data-cy="delete-files"]').click();await page.locator('mat-dialog-container [data-cy="dialog-confirm"]').click();
   const deletion=await deleted;assert.equal(deletion.status(),200);const report=(await deletion.json()).report;
   assert.deepEqual(report.deleted.map(value=>value.sourcePackageId),[unused[0].sourcePackage.sourcePackageId]);assert.equal(report.wasUsed.length,1);
   assert.equal(report.wasUsed[0].sourcePackageId,overwritten[0].sourcePackage.sourcePackageId);
   await page.locator('#originalWorkspaceFiles[aria-busy="false"]').waitFor();assert.equal((await api(scope+'/files')).totalCount,6);
   await page.screenshot({path:join(artifacts,key+'.png'),fullPage:true});assert.deepEqual(errors,[]);console.log('native_workspace_files='+theme+'-'+width+':passed');
  }catch(error){await page?.screenshot({path:join(artifacts,key+'-failure.png'),fullPage:true});throw error;}
  finally{await context.close();}
  const username='reader-'+key,password='Changed-files-password-9!';
  await api('/api/v1/admin/users',{username,password:'Owned-files-password-9!',roleAssignments:[{
    role:'workspace_admin',tenantKey:'demo-tenant',workspaceKey:key,accessMode:'read_only'}]},'POST',201);
  const firstSession=(await api('/api/v1/admin/auth/sign-in',{username,password:'Owned-files-password-9!'})).sessionToken;
  await api('/api/v1/admin/auth/password',{password},'POST',200,firstSession);
  const readContext=await browser.newContext({viewport:{width,height:844},locale:'de-DE',timezoneId:'Europe/Berlin'});
  let releaseDownload;try {
    const readPage=await signIn(readContext,key,username,password);
    assert.equal(await readPage.locator('[data-cy="upload-files"]').isDisabled(),true);
    assert.equal(await readPage.locator('[data-cy="upload-file-select"]').isDisabled(),true);
    const accountTrigger=readPage.locator('[data-cy="account-button"]');
    await accountTrigger.click();
    const account=readPage.locator('.original-native-account-menu');await account.waitFor();
    const [loginName,group,right,version]=await account.locator('dd').allTextContents();
    assert.equal(await account.locator('dd').count(),4);
    assert.deepEqual([loginName,group,right],[username,'','Verwaltung von Testinhalten']);
    assert.match(version,/^Rewrite(?: \([a-f0-9]{12}\))?$/);
    await account.getByRole('button',{name:'Nutzerinformationen schließen'}).click();
    await account.waitFor({state:'detached'});
    assert.equal(await accountTrigger.evaluate(element=>document.activeElement===element),true);
    console.log('native_workspace_files_account='+theme+'-'+width+':passed');
    await checkOriginalAccountKeyboardFocus(readPage,accountTrigger);
    console.log('native_workspace_files_keyboard_account='+theme+'-'+width+':passed');
    if(theme==='Primar' && width===1280) {
      await readPage.reload({waitUntil:'domcontentloaded'});
      await readPage.locator('#originalWorkspaceFiles[aria-busy="false"]').waitFor();
      assert.equal(await readPage.locator('[data-cy="upload-files"]').isDisabled(),true);
      await accountTrigger.click();await account.waitFor();
      const restoredDetails=await account.locator('dd').allTextContents();
      assert.equal(restoredDetails.length,3);
      assert.deepEqual(restoredDetails.slice(0,2),[username,'']);
      await account.getByRole('button',{name:'Nutzerinformationen schließen'}).click();
      await account.waitFor({state:'detached'});
      const workspaceRefresh=readPage.waitForResponse(response=>{
        const url=new URL(response.url());
        return url.pathname==='/api/v1/admin/auth/current-session' && url.searchParams.get('view')==='original-workspace-starter';
      });
      await readPage.locator('#originalWorkspaceFileHeader a:has([data-cy="logo"])').press('Enter');
      const starterSession=await workspaceRefresh;
      assert.equal(starterSession.status(),200);
      const {originalWorkspaceChoices}=await starterSession.json();
      assert.deepEqual(originalWorkspaceChoices.map(({tenantKey,workspaceKey,label,mode})=>({tenantKey,workspaceKey,label,mode})),
        [{tenantKey:'demo-tenant',workspaceKey:key,label:'Eigener Arbeitsbereich '+width,mode:'RO'}]);
      // At short heights the Original scrolls the overview beneath its fixed header.
      await readPage.setViewportSize({width:390,height:320});
      const card=readPage.locator('[data-cy="workspace-card-Eigener Arbeitsbereich '+width+'"] button');
      const scrollAction=readPage.getByRole('button',{name:'Unten geht es weiter'});
      await scrollAction.waitFor();
      const previousTop=(await card.boundingBox()).y;
      await scrollAction.press('Enter');
      await scrollAction.waitFor({state:'detached'});
      assert.ok((await card.boundingBox()).y<previousTop-30);
      assert.equal((await readPage.locator('#originalOperatorStarterHeader').boundingBox()).y,0);
      assert.equal(await readPage.evaluate(()=>window.scrollY),0);
      await readPage.setViewportSize({width,height:844});
      await readPage.locator('[data-cy=change-password]').press('Enter');
      await readPage.locator('#ownAdminPasswordChangeDialog').waitFor();
      await readPage.locator('#ownAdminPasswordCancelButton').click();
      await readPage.locator('#ownAdminPasswordChangeDialog').waitFor({state:'detached'});
      const nativeNumber=originalWorkspaceChoices[0].workspaceNumber;
      assert.match(nativeNumber,/^[1-9][0-9]*$/);
      await card.press('Enter');
      await readPage.locator('#originalWorkspaceFiles[aria-busy="false"]').waitFor();
      const nativeFilesPath='/admin/'+nativeNumber+'/files';
      assert.equal(new URL(readPage.url()).pathname,'/app'+nativeFilesPath);
      await readPage.goto(base+'/#'+nativeFilesPath);
      await readPage.locator('#originalWorkspaceFiles[aria-busy="false"]').waitFor();
      assert.equal(new URL(readPage.url()).pathname,'/app'+nativeFilesPath);
      assert.equal(await readPage.locator('[data-cy="upload-files"]').isDisabled(),true);
      // Reloaded numeric routes verify and publish the operator's account rights
      // before the file view opens.
      await accountTrigger.click();await account.waitFor();
      assert.deepEqual((await account.locator('dd').allTextContents()).slice(0,-1),[username,'','Verwaltung von Testinhalten']);
      await account.getByRole('button',{name:'Nutzerinformationen schließen'}).click();
      await account.waitFor({state:'detached'});
      console.log('native_workspace_files_account_restored_session=passed');
      const deniedRequests=[];
      const observeDenied=request=>{
        if(new URL(request.url()).pathname.startsWith('/api/v1/tenants/'))deniedRequests.push(request.url());
      };
      readPage.on('request',observeDenied);
      await readPage.goto(base+'/app/admin/9223372036854775808/files?ui=original');
      const denied=readPage.getByRole('dialog',{name:'Daten/Objekt nicht gefunden.'});
      await waitForMaterialDialog(readPage);
      await denied.waitFor();
      await readPage.keyboard.press('Escape');
      await denied.waitFor();
      assert.equal(await readPage.locator('#originalWorkspaceFileFrame,[data-cy="upload-files"]').count(),0);
      assert.deepEqual(deniedRequests,[]);
      readPage.off('request',observeDenied);
      const details=denied.getByRole('button',{name:'Fehlerdetails'});
      assert.equal(await details.getAttribute('aria-expanded'),'false');
      await details.press('Enter');
      await denied.getByText('Dieser Arbeitsbereich ist für Sie nicht freigegeben.',{exact:true}).waitFor();
      await denied.locator('[data-cy="close"]').press('Enter');
      await readPage.locator('#originalOperatorStarterHeader').waitFor();
      await card.press('Enter');
      await readPage.locator('#originalWorkspaceFiles[aria-busy="false"]').waitFor();
      console.log('native_workspace_files_denied_dialog_returns_to_overview=passed');
    }
    await readPage.locator('[data-cy="files-checkAll-Unit"] input').check();
    assert.equal(await readPage.locator('[data-cy="delete-files"]').isDisabled(),true);
    const readRow=readPage.locator('mat-row').filter({has:readPage.locator('[data-cy="files-checkbox-NATIVE.UNIT"]')});
    const received=readPage.waitForEvent('download');await readRow.locator('button').click();const downloaded=await received;
    const saved=join(artifacts,key+'-readonly.bin');await downloaded.saveAs(saved);
    const expected=Buffer.concat([Buffer.from([255,254]),Buffer.from('<?xml version="1.0" encoding="UTF-16"?>'+unitSource.replace('private-unit-bytes','new-private-unit-bytes'),'utf16le')]);
    assert.deepEqual(await readFile(saved),expected);
    if(theme==='Primar' && width===1280) {
      await readPage.goto(base+'/app/content?ui=original');
      await readPage.locator('#originalWorkspaceFiles[aria-busy="false"]').waitFor();
      const currentUnit=(await api(scope+'/files')).items.find(value=>value.metadata.identifier==='NATIVE.UNIT');
      const route=base+scope+'/files/'+currentUnit.sourcePackageId+'/download';
      let requestStarted;const started=new Promise(done=>{requestStarted=done;});
      const held=new Promise(done=>{releaseDownload=done;});let afterLogoutDownloads=0;
      readPage.on('download',()=>afterLogoutDownloads++);
      await readContext.route(route,async request=>{requestStarted();await held;await request.continue();});
      await readRow.locator('button').click();
      await raceWithSmokeDeadline(started,10000,()=>{throw Error('Owned held download did not start.');});
      await accountTrigger.click();
      await account.locator('#globalAdminSignOutButton.mat-tonal-button').click();
      await readPage.locator('#originalParticipantLogoutConfirmButton').click();
      await readPage.locator('#originalWorkspaceFiles').waitFor({state:'detached'});
      const rejected=readPage.waitForResponse(response=>response.url()===route);
      releaseDownload();const rejectedResponse=await rejected;assert.equal(rejectedResponse.status(),401);
      await readPage.waitForLoadState('domcontentloaded');assert.equal(afterLogoutDownloads,0);
      console.log('native_workspace_files_held_download_logout=passed');
    }
    if(theme==='Primar' && width===390) {
      const openContent=async query=>readPage.goto(base+'/app/content?ui=original&'+query,{waitUntil:'domcontentloaded'});
      const selectedTab=name=>readPage.getByRole('tab',{name,selected:true,exact:true});
      await openContent('tab=unknown');
      await selectedTab('Dateien').waitFor();
      await readPage.locator('#originalWorkspaceFiles[aria-busy="false"]').waitFor();
      await openContent('tab=results&tab=tests');
      await selectedTab('Ergebnisse/Antworten').waitFor();
      await readPage.locator('#originalWorkspaceResults[aria-busy="false"]').waitFor();
      const testsTab=readPage.getByRole('tab',{name:'Tests löschen',exact:true});
      await testsTab.press('Enter');
      await selectedTab('Tests löschen').waitFor();
      await readPage.locator('#originalWorkspaceTests[aria-busy="false"]').waitFor();
      await readPage.goBack();
      await selectedTab('Ergebnisse/Antworten').waitFor();
      await readPage.locator('#originalWorkspaceResults[aria-busy="false"]').waitFor();
      console.log('native_workspace_files_direct_tabs_and_history=passed');
    }
    console.log('native_workspace_files_readonly='+theme+'-'+width+':passed');
  }finally{releaseDownload?.();await readContext.close();}
 }
 // Fail the actual lazy component request, then recover through the user's
 // explicit Reload action. Missing feature code must never reveal old rows or
 // leave mutation controls from the generic content console mounted.
 const browserRoot=join(frontendRoot,'dist/apps/web/browser'),candidates=[];
 for(const name of await readdir(browserRoot))if(name.endsWith('.js')){
   const text=await readFile(join(browserRoot,name),'utf8');
   if(text.includes('app-original-workspace-files') && text.includes('originalWorkspaceFileFrame'))candidates.push(name);
 }
 assert.equal(candidates.length,1,'The native file feature must have one identifiable lazy component bundle.');
 const missingKey='native-files-missing-chunk',missingScope='/api/v1/tenants/demo-tenant/workspaces/'+missingKey;
 await api('/api/v1/tenants/demo-tenant/workspaces',{workspaceKey:missingKey,displayName:'Owned missing file bundle'},'POST',201);
 const missingContext=await browser.newContext({viewport:{width:1280,height:844},serviceWorkers:'block'});
 try {
   let blocked=0,writes=0;const route=base+'/app/'+candidates[0];
   await missingContext.route(route,request=>{blocked++;return request.abort('failed');});
   missingContext.on('request',request=>{if(request.url()===base+missingScope+'/files' && request.method()==='POST')writes++;});
   const missingPage=await signIn(missingContext,missingKey,'demo-admin','demo-admin-password',false);
   await missingPage.getByText('Die Dateiverwaltung konnte nicht geladen werden.',{exact:true}).waitFor();
   assert.ok(blocked);assert.equal(await missingPage.locator('#originalWorkspaceFiles').count(),0);
   assert.equal(await missingPage.locator('#createSourcePackageButton').count(),0);assert.equal(writes,0);
   await missingContext.unroute(route);
   await missingPage.getByRole('button',{name:'Erneut laden',exact:true}).click();
   await missingPage.locator('#originalWorkspaceFiles[aria-busy="false"]').waitFor();
   await missingPage.getByText('Dieser Arbeitsbereich enthält noch keine Dateien!',{exact:true}).waitFor();
   assert.equal(writes,0);console.log('native_workspace_files_missing_bundle_recovery=passed');
 }finally{await missingContext.close();}
}finally{
 await browser?.close();if(server.exitCode===null && server.signalCode===null)server.kill('SIGTERM');
 await raceWithSmokeDeadline(closed,10000,()=>{server.kill('SIGKILL');throw Error('Owned native-files API shutdown timed out.');});console.log('owned_native_files_api_stopped=true');
}
