import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,readFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {raceWithSmokeDeadline} from './smoke-deadline.mjs';
import {waitForMaterialDialog} from './material-dialog-ready.mjs';
import {waitForFiniteDocumentAnimations} from './finite-animation-ready.mjs';
import {captureStableViewport} from './stable-viewport-capture.mjs';

const scratch=await mkdtemp(join(tmpdir(),'owned-native-reports-'));
const artifacts=process.env.UI_SMOKE_ARTIFACT_DIR?resolve(process.env.UI_SMOKE_ARTIFACT_DIR,'original-system-check-reports'):scratch;
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
const key='owned-native-reports',scope='/api/v1/tenants/demo-tenant/workspaces/'+key;
const api=async(path,body,method=body===undefined?'GET':'POST',status=200,credential=token)=>{
 const response=await fetch(base+path,{method,headers:{...(credential?{authorization:'Bearer '+credential}:{}),
  ...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(15000)});
 const value=(response.headers.get('content-type')??'').includes('application/json')?await response.json():Buffer.from(await response.arrayBuffer());
 assert.equal(response.status,status,method+' '+path+': '+(Buffer.isBuffer(value)?'binary':JSON.stringify(value)));return value;
};
const surface=page=>page.locator('#originalSystemCheckReports[aria-busy="false"]');
async function chooseTab(page,label){
 const direction=label==='Dateien'?'before':'after';
 const pagination=page.locator('.mat-mdc-tab-header-pagination-'+direction+':not(.mat-mdc-tab-header-pagination-disabled)');
 if(await pagination.isVisible())await pagination.click();
 await page.locator('[data-cy="'+label+'"]').click();
}
async function open(context,username='owned-reports-writer',workspace=key){
 const page=await context.newPage();await page.goto(base+'/app/ops?ui=original',{waitUntil:'domcontentloaded'});
 await page.locator('#adminUsername').fill(username);await page.locator('#adminPassword').fill('Changed-native-reports-9!');await page.locator('#adminSignInButton').click();
 await page.locator('#adminSignOutButton').waitFor();
 return visitWorkspace(page,workspace);
}
async function visitWorkspace(page,workspace){
 await page.goto(base+'/app/workspace?ui=original',{waitUntil:'domcontentloaded'});
 await page.locator('#tenantKey').fill('demo-tenant');await page.locator('#tenantKey').dispatchEvent('change');
 await page.locator('#workspaceKey').fill(workspace);await page.locator('#workspaceKey').dispatchEvent('change');
 await page.locator('[data-view-nav="content"]').click();await page.locator('#originalWorkspaceFiles[aria-busy="false"]').waitFor();
 await chooseTab(page,'Systemcheck Berichte');await surface(page).waitFor();return page;
}
const select=async(page,label)=>page.locator('mat-row').filter({hasText:label}).locator('[data-cy="systemcheck-checkbox"] input').check();
try{
 const port=await raceWithSmokeDeadline(new Promise((done,reject)=>{server.once('message',message=>done(message.port));server.once('error',reject);
  server.once('exit',()=>reject(Error('Owned native-reports API exited before readiness.')));}),20000,()=>{throw Error('Owned native-reports API did not start.');});
 base='http://127.0.0.1:'+port;token=(await api('/api/v1/admin/auth/sign-in',{username:'demo-admin',password:'demo-admin-password'})).sessionToken;
 await api('/api/v1/tenants/demo-tenant/workspaces',{workspaceKey:key,displayName:'Eigene Berichte Ω'},'POST',201);
 await api('/api/v1/tenants/demo-tenant/workspaces',{workspaceKey:key+'-empty',displayName:'Leere Berichte'},'POST',201);
 for(const [id,label]of [['CHECK.A','Alpha Ω'],['CHECK.B','Beta'],['CHECK.C','Gamma']]){
  const xml=`<SysCheck xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/testcenter-syscheck-xml/18.0"><Metadata><Id>${id}</Id><Label>${label}</Label></Metadata><Config savekey="owned-native-reports-key" skipnetwork="true"/></SysCheck>`;
  const uploaded=await api(scope+'/files',{fileName:id+'.xml',mediaType:'application/xml',sourceDocument:xml},'POST',201);
  assert.equal(uploaded.sourcePackage.status,'accepted');
 }
 for(let i=0;i<505;i++){
  const id=i<501?'CHECK.A':i<504?'CHECK.B':'CHECK.C';
  await api(scope+'/system-checks/'+id+'/reports',{keyPhrase:'owned-native-reports-key',title:'owned-title-'+i,responses:{exact:'Ω\n";value'},
   environment:[{id:'os',label:'Betriebssystem',type:'environment',value:i%2?'Linux':'Windows',warning:false},
    {id:'os-version',label:'Betriebssystemversion',type:'environment',value:i%2?'6':'10',warning:false},
    {id:'browser',label:'Browser',type:'environment',value:'Chromium',warning:false},
    {id:'browser-version',label:'Browserversion',type:'environment',value:'130',warning:false}],network:[],unit:[],
   questionnaire:[{id:'question',type:'string',label:id==='CHECK.C'?'Private unselected column':'Selected question',value:'exact selected answer',warning:false}]},'POST',201,'');
 }
 for(const [username,accessMode]of [['owned-reports-writer','read_write'],['owned-reports-reader','read_only']]){
  await api('/api/v1/admin/users',{username,password:'Initial-native-reports-9!',roleAssignments:[{role:'workspace_admin',tenantKey:'demo-tenant',workspaceKey:key,accessMode},
   {role:'workspace_admin',tenantKey:'demo-tenant',workspaceKey:key+'-empty',accessMode}]},'POST',201);
  const first=(await api('/api/v1/admin/auth/sign-in',{username,password:'Initial-native-reports-9!'})).sessionToken;
  await api('/api/v1/admin/auth/password',{password:'Changed-native-reports-9!'},'POST',200,first);
 }
 const expected=await api(scope+'/exports/system-check-reports.csv?checkId=CHECK.A&checkId=CHECK.B');
 assert.equal((expected.toString('utf8').match(/owned-title-/g)??[]).length,504);
 browser=await chromium.launch({headless:process.env.CI==='true' && process.env.UI_SMOKE_HEADFUL!=='true'});
 for(const theme of ['Primar','Sekundar','Erwachsene'])for(const width of [1280,390]){
  await api('/api/v1/admin/original-interface/application-settings',{themeName:theme},'PATCH');
  const context=await browser.newContext({viewport:{width,height:844},locale:'de-DE',timezoneId:'Europe/Berlin'}),errors=[];
  try{
   page=await open(context);page.on('pageerror',error=>errors.push(String(error)));
   assert.equal(await page.locator('#originalWorkspaceFileHeader h1').textContent(),'Verwaltung "Eigene Berichte Ω" (RW)');
   assert.equal(await page.locator('#createSourcePackageButton,#originalWorkspaceFiles').count(),0);
   assert.equal(await surface(page).locator('mat-row').count(),3);
   const alpha=surface(page).locator('mat-row').filter({hasText:'Alpha Ω'});
   await alpha.getByText('Linux 6: 250',{exact:true}).waitFor();await alpha.getByText('Windows 10: 251',{exact:true}).waitFor();
   await alpha.getByText('Chromium 130: 501',{exact:true}).waitFor();
   assert.equal(await page.locator('[data-cy="download-button"]').isDisabled(),true);
   assert.equal(await page.locator('[data-cy="delete-systemcheck-reports"]').isDisabled(),true);
   await select(page,'Alpha Ω');await select(page,'Beta');
   assert.equal(await page.locator('mat-header-cell input').evaluate(input=>input.indeterminate),true);
   await waitForFiniteDocumentAnimations(page);
   const measure=()=>page.evaluate(()=>({width:innerWidth,height:innerHeight,header:document.querySelector('#originalWorkspaceFileHeader').getBoundingClientRect().toJSON(),
    table:document.querySelector('#originalSystemCheckReports mat-table').getBoundingClientRect().toJSON(),scrollY}));
   await captureStableViewport(page,measure,join(artifacts,theme+'-'+width+'.png'));
   const downloaded=page.waitForEvent('download');await page.locator('[data-cy="download-button"]').click();const download=await downloaded;
   assert.equal(download.suggestedFilename(),'iqb-testcenter-syscheckreports.csv');const file=join(artifacts,theme+'-'+width+'.csv');
   await download.saveAs(file);assert.deepEqual(await readFile(file),expected);
   assert.equal(await page.locator('[data-cy="systemcheck-checkbox"] input:checked').count(),0);
   await select(page,'Beta');await page.locator('[data-cy="delete-systemcheck-reports"]').click();await waitForMaterialDialog(page);
   await page.locator('[data-cy="dialog-content"]').getByText('Es werden alle Berichte für diesen Systemcheck "CHECK.B" gelöscht. Fortsetzen?',{exact:true}).waitFor();
   await page.locator('[data-cy="dialog-cancel"]').click();await page.locator('mat-dialog-container').waitFor({state:'detached'});
   assert.equal(await page.locator('[data-cy="systemcheck-checkbox"] input:checked').count(),1);
   await chooseTab(page,'Dateien');await page.locator('#originalWorkspaceFiles[aria-busy="false"]').waitFor();
   await chooseTab(page,'Systemcheck Berichte');await surface(page).waitFor();
   assert.equal(await page.locator('[data-cy="systemcheck-checkbox"] input:checked').count(),0,'Changing tabs destroys the old report selection.');
   await page.reload({waitUntil:'domcontentloaded'});await surface(page).waitFor();assert.equal(await page.locator('mat-row').count(),3);
   assert.deepEqual(errors,[]);console.log('native_syscheck_reports='+theme+'-'+width+':passed');
  }catch(error){await page?.screenshot({path:join(artifacts,theme+'-'+width+'-failure.png'),fullPage:true});throw error;}
  finally{await context.close();}
 }
 const readonly=await browser.newContext({viewport:{width:1280,height:844}});let release;
 try{
  page=await open(readonly,'owned-reports-reader');await select(page,'Alpha Ω');await select(page,'Beta');
  assert.equal(await page.locator('[data-cy="delete-systemcheck-reports"]').isEnabled(),true);
  await page.screenshot({path:join(artifacts,'readonly-selected.png'),fullPage:true});
  const beforeReports=await api(scope+'/exports/system-check-reports.json'),beforeAudit=await api(scope+'/activity-events?limit=500');
  const refused=page.waitForResponse(response=>response.url()===base+scope+'/system-check-reports' && response.request().method()==='DELETE');
  await page.locator('[data-cy="delete-systemcheck-reports"]').click();await waitForMaterialDialog(page);
  await page.locator('[data-cy="dialog-content"]').getByText('Es werden alle Berichte für diese 2 Systemchecks gelöscht. Fortsetzen?',{exact:true}).waitFor();
  await page.locator('[data-cy="dialog-confirm"]').click();const refusal=await refused;
  assert.equal(refusal.status(),403);await surface(page).waitFor();await page.locator('#originalSystemCheckReports [role="alert"]').waitFor();
  assert.equal(await page.locator('mat-row').count(),3);assert.equal(await page.locator('[data-cy="systemcheck-checkbox"] input:checked').count(),2);
  assert.deepEqual(await api(scope+'/exports/system-check-reports.json'),beforeReports);
  assert.deepEqual(await api(scope+'/activity-events?limit=500'),beforeAudit);
  await page.screenshot({path:join(artifacts,'readonly-refused.png'),fullPage:true});
  const downloaded=page.waitForEvent('download');await page.locator('[data-cy="download-button"]').click();const download=await downloaded;
  const file=join(artifacts,'readonly.csv');await download.saveAs(file);assert.deepEqual(await readFile(file),expected);
  const ro=(await api('/api/v1/admin/auth/sign-in',{username:'owned-reports-reader',password:'Changed-native-reports-9!'})).sessionToken;
  await api(scope+'/system-check-reports',{checkIds:['CHECK.A'],confirmation:key},'DELETE',403,ro);
  await select(page,'Alpha Ω');let started;const seen=new Promise(done=>{started=done;}),wait=new Promise(done=>{release=done;});let downloads=0;
  page.on('download',()=>downloads++);const route=base+scope+'/exports/system-check-reports.csv?checkId=CHECK.A';
  await readonly.route(route,async request=>{started();await wait;await request.continue();});
  await page.locator('[data-cy="download-button"]').click();await raceWithSmokeDeadline(seen,10000,()=>{throw Error('Held report download did not start.');});
  await page.locator('[data-cy="account-button"]').click();await page.locator('#globalAdminSignOutButton').click();
  await page.locator('#originalParticipantLogoutConfirmButton').click();await page.locator('#originalSystemCheckReports').waitFor({state:'detached'});
  const rejected=page.waitForResponse(response=>response.url()===route);release();assert.equal((await rejected).status(),401);
  assert.equal(downloads,0);console.log('native_syscheck_reports_readonly_and_held_logout=passed');
 }finally{release?.();await readonly.close();}
 const writer=await browser.newContext({viewport:{width:1280,height:844}});
 try{
  page=await open(writer);await select(page,'Beta');const result=page.waitForResponse(response=>response.url()===base+scope+'/system-check-reports' && response.request().method()==='DELETE');
  await page.locator('[data-cy="delete-systemcheck-reports"]').click();await waitForMaterialDialog(page);await page.locator('[data-cy="dialog-confirm"]').click();
  const response=await result;assert.equal(response.status(),200);assert.equal((await response.json()).deletion.deletedCount,3);
  await surface(page).waitFor();assert.equal(await page.locator('mat-row').count(),2);
  const stats=await api(scope+'/system-check-reports/statistics');assert.deepEqual(stats.items.map(row=>[row.checkId,row.reportCount]),[['CHECK.A',501],['CHECK.C',1]]);
  page=await visitWorkspace(page,key+'-empty');assert.equal(await page.locator('mat-row').count(),0);
  assert.equal(await page.locator('[data-cy="download-button"]').isDisabled(),true);assert.equal(await page.locator('[data-cy="delete-systemcheck-reports"]').isDisabled(),true);
  console.log('native_syscheck_reports_real_selected_delete_and_empty=passed');
 }finally{await writer.close();}
 // Exercise the actual deferred report bundle's error state and explicit reload.
 const bundles=[];const root=join(frontendRoot,'dist/apps/web/browser');
 for(const name of await readdir(root))if(name.endsWith('.js')){
  const bytes=await readFile(join(root,name),'utf8');if(bytes.includes('app-original-system-check-reports') && bytes.includes('originalSystemCheckReports'))bundles.push(name);
 }
 assert.equal(bundles.length,1,'Native reports must stay in a separately identifiable deferred feature bundle.');
 const missing=await browser.newContext({serviceWorkers:'block',viewport:{width:1280,height:844}});
 try{
  const route=base+'/app/'+bundles[0];let blocked=0;await missing.route(route,request=>{blocked++;return request.abort('failed');});
  // Use the real sign-in and workspace controls, then navigate directly to the
  // selected report tab without preloading its feature code.
  page=await missing.newPage();await page.goto(base+'/app/ops?ui=original',{waitUntil:'domcontentloaded'});
  await page.locator('#adminUsername').fill('owned-reports-writer');await page.locator('#adminPassword').fill('Changed-native-reports-9!');await page.locator('#adminSignInButton').click();await page.locator('#adminSignOutButton').waitFor();
  await page.goto(base+'/app/workspace?ui=original',{waitUntil:'domcontentloaded'});await page.locator('#workspaceKey').fill(key);await page.locator('#workspaceKey').dispatchEvent('change');
  await page.locator('[data-view-nav="content"]').click();await page.locator('#originalWorkspaceFiles[aria-busy="false"]').waitFor();await page.locator('[data-cy="Systemcheck Berichte"]').click();
  await page.getByText('Die Berichtsverwaltung konnte nicht geladen werden.',{exact:true}).waitFor();assert.ok(blocked);
  assert.equal(await page.locator('#originalSystemCheckReports,#createSourcePackageButton').count(),0);
  await missing.unroute(route);await page.getByRole('button',{name:'Erneut laden',exact:true}).click();await surface(page).waitFor();assert.equal(await page.locator('mat-row').count(),2);
  console.log('native_syscheck_reports_missing_bundle_recovery=passed');
 }finally{await missing.close();}
}finally{
 await browser?.close();if(server.exitCode===null && server.signalCode===null)server.kill('SIGTERM');
 await raceWithSmokeDeadline(closed,10000,()=>{server.kill('SIGKILL');throw Error('Owned native-reports API shutdown timed out.');});
 console.log('owned_native_reports_api_stopped=true');
}
