import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,mkdir,readFile,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {createSqliteFirstSliceStorage} from '@testcenter-rewrite-app/sqlite-store';
import {createFirstSliceServices} from '@testcenter-rewrite-app/application';
import {prepareOriginalXmlSchemaValidator} from '../packages/application/dist/packages/application/src/original-xml-schema.js';
import {bindNativeSmokeServerOwner,stopNativeSmokeServer} from './native-monitor-smoke-io.mjs';
import {waitForMaterialDialog} from './material-dialog-ready.mjs';
import {waitForFiniteDocumentAnimations} from './finite-animation-ready.mjs';
import {raceWithSmokeDeadline} from './smoke-deadline.mjs';
const scratch=await mkdtemp(join(tmpdir(),'owned-native-results-'));
const artifacts=process.env.UI_SMOKE_ARTIFACT_DIR?resolve(process.env.UI_SMOKE_ARTIFACT_DIR,'original-workspace-results'):scratch;
await mkdir(artifacts,{recursive:true});console.log('owned_artifacts='+artifacts);
const schemaCache=resolve(process.env.FIRST_SLICE_XML_SCHEMA_CACHE||'.data/original-xml-schemas');
const file=join(scratch,'owned.sqlite'),storage=createSqliteFirstSliceStorage(file),services=createFirstSliceServices({repository:storage.repository,
 originalXmlSchemaValidator:await prepareOriginalXmlSchemaValidator(schemaCache,false),xmlSchemaProfile:'original-19'});
const password='Owned-native-results-password-9!',key='owned-results',scope={tenantKey:'owned-results',workspaceKey:key};
let visual;
let browser,server,page,base,rootToken,writerToken,readerToken,workspaceId;const markers=[],errors=[],wire=[];
const xml=(type,body)=>`<${type} xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/${type==='Unit'?'unit-xml/17.6':type==='Booklet'?'testcenter-booklet-xml/18.0':'testcenter-testtaker-xml/18.0'}">${body}</${type}>`;
const mark=name=>{markers.push(name);console.log('native_workspace_results='+name+':passed');};
const native=async(path,token=writerToken,method='GET',body,accept='application/json')=>{
 const r=await fetch(base+path,{method,headers:{AuthToken:token,Accept:accept,...body===undefined?{}:{'Content-Type':'application/json'}},...body===undefined?{}:{body:JSON.stringify(body)},signal:AbortSignal.timeout(15000)});
 return {status:r.status,headers:r.headers,bytes:Buffer.from(await r.arrayBuffer())};
};
async function tab(label){
 const link=page.locator('[data-cy="'+label+'"]');
 // Real keyboard activation also exercises narrow-view tab navigation; the
 // Material tab bar owns scrolling the newly active link into view.
 await link.focus();await link.press('Enter');
 await page.locator(label==='Tests löschen'?'#originalWorkspaceTests[aria-busy="false"]':'#originalWorkspaceResults[aria-busy="false"]').waitFor();
}

async function open(context,username='owned-results-writer',view='results'){
 page=await context.newPage();page.on('pageerror',e=>errors.push(String(e)));
 page.on('request',r=>{const path=new URL(r.url()).pathname;if(/^\/workspace\//.test(path))wire.push({path,method:r.method(),native:!!r.headers().authtoken,canonical:!!r.headers().authorization});});
 await page.goto(base+'/app/ops?ui=original',{waitUntil:'domcontentloaded'});
 await page.locator('#adminUsername').fill(username);await page.locator('#adminPassword').fill(password);await page.locator('#adminSignInButton').click();
 await page.locator('#adminSignOutButton').waitFor();
 await page.goto(base+'/app/workspace?ui=original',{waitUntil:'domcontentloaded'});
 await page.locator('#tenantKey').fill(scope.tenantKey);await page.locator('#tenantKey').dispatchEvent('change');
 await page.locator('#workspaceKey').fill(scope.workspaceKey);await page.locator('#workspaceKey').dispatchEvent('change');
 await page.locator('[data-view-nav="content"]').click();await page.locator('#originalWorkspaceFiles[aria-busy="false"]').waitFor();
 await tab(view==='tests'?'Tests löschen':'Ergebnisse/Antworten');return page;
}
const selectGroup=async(label)=>{await page.locator('#originalWorkspaceResults mat-row').filter({hasText:label}).locator('input[type=checkbox]').check();await page.locator('[data-cy="download-responses"]:enabled').waitFor();};
try{
 await services.platform.createTenant({tenantKey:scope.tenantKey,displayName:'Owned results'});
 const workspace=await services.platform.createWorkspace({...scope,displayName:'Eigene Ergebnisse Ω'});
 const upload=(fileName,sourceDocument,mediaType='application/xml')=>services.contentIntake.uploadWorkspaceFile({...scope,fileName,sourceDocument,mediaType});
 await upload('player.html','<html><script type="application/ld+json">'+JSON.stringify({id:'owned-results-player',version:'1.0.0',specVersion:'6.0',metadataVersion:'2.0',type:'player',name:[{lang:'de',value:'Owned Player'}]})+'</script></html>','text/html');
 await upload('unit.xml',xml('Unit','<Metadata><Id>OWNED.RESULT.UNIT</Id><Label>Owned result Unit</Label></Metadata><Definition player="owned-results-player@1.0.0">Owned</Definition>'));
 for(const id of ['A','B'])await upload(id+'.xml',xml('Booklet','<Metadata><Id>OWNED.RESULT.'+id+'</Id><Label>Testheft '+id+' Ω</Label></Metadata><Units><Unit id="OWNED.RESULT.UNIT" label="Owned result Unit"/></Units>'));
 await services.workspaceAdminRead.importParticipantRoster({...scope,rosterText:xml('Testtakers','<Metadata/>'+['A','B'].map(id=>`<Group id="OWNED.RESULT.${id}" label="Ergebnisgruppe ${id}"><Login name="owned-result-${id.toLowerCase()}" mode="run-trial"><Booklet>OWNED.RESULT.A</Booklet><Booklet>OWNED.RESULT.B</Booklet></Login></Group>`).join(''))});
 const reviewFixture=JSON.parse(await readFile(new URL('../test-fixtures/original-testcenter/source-workspace-results/native-result-report-http/observations.json',import.meta.url),'utf8'));
 let clock=1793782800000;
 for(const group of ['A','B']){
  const actor=await services.originalSession.login({name:'owned-result-'+group.toLowerCase(),password:''});
  for(const id of group==='A'?['A','B']:['A']){
   const testNumber=await services.originalTest.create({token:actor.token,bookletName:'OWNED.RESULT.'+id});
   await services.originalTest.read({token:actor.token,testNumber});
   await services.originalTest.patchState({token:actor.token,testNumber,patch:[{key:'CONTROLLER',content:'RUNNING',timeStamp:++clock}]});
   const unit={token:actor.token,testNumber,unitName:'OWNED.RESULT.UNIT'};
   await services.originalUnit.patchState({...unit,body:{newState:[{key:'PRESENTATION_PROGRESS',content:'some',timeStamp:++clock}]}});
   await services.originalUnit.putResponse({...unit,body:{timeStamp:++clock,dataParts:{owned:JSON.stringify({answer:'Private selected '+group+id+' Ω'})},responseType:'owned'}});
   await services.originalTest.putLog({token:actor.token,testNumber,body:[{key:'LOADCOMPLETE',content:'Owned '+group+id,timeStamp:++clock}]});
   await services.originalReview.create({...unit,body:JSON.parse(reviewFixture.rows.find(r=>r.label==='unit-create').requestBodyText)});
  }
 }
 await services.adminAuth.bootstrapAdminUser({username:'owned-results-root',password});
 rootToken=(await services.adminAuth.signIn({username:'owned-results-root',password})).adminSession.token;
 for(const [username,accessMode]of [['owned-results-writer','read_write'],['owned-results-reader','read_only']]){
  await services.adminDirectory.createAdminUser({sessionToken:rootToken,username,password:password+'initial',roleAssignments:[{role:'workspace_admin',...scope,accessMode}]});
  const first=(await services.adminAuth.signIn({username,password:password+'initial'})).adminSession.token;
  await services.adminAuth.changeOwnPassword({sessionToken:first,password});
 }
 writerToken=(await services.adminAuth.signIn({username:'owned-results-writer',password})).adminSession.token;
 readerToken=(await services.adminAuth.signIn({username:'owned-results-reader',password})).adminSession.token;
 const expectedGroups=await services.originalGroupResults.list(scope);assert.equal(expectedGroups.length,2);
 workspaceId=(await services.originalWorkspaceAdministration.context({...scope,token:writerToken})).workspaceId;
 await storage.shutdown();
 const module=pathToFileURL(resolve('apps/api/dist/apps/api/src/index.js')).href,owner=pathToFileURL(resolve('scripts/native-monitor-smoke-io.mjs')).href;
 server=spawn(process.execPath,['--input-type=module','-e',`import{createProductionApiServer}from ${JSON.stringify(module)};import{bindNativeSmokeServerOwner}from ${JSON.stringify(owner)};const server=await createProductionApiServer();bindNativeSmokeServerOwner(server);server.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));`],{stdio:['ignore','ignore','inherit','ipc'],env:{...process.env,
  FIRST_SLICE_STORE:'sqlite',FIRST_SLICE_SQLITE_FILE:file,FIRST_SLICE_BOOTSTRAP_DEMO:'false',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',FIRST_SLICE_PROOF_OF_WORK_SCOPES:'',FIRST_SLICE_XML_SCHEMA_PROFILE:'original-19',FIRST_SLICE_XML_SCHEMA_DOWNLOAD:'false',FIRST_SLICE_XML_SCHEMA_CACHE:schemaCache}});
 const port=await raceWithSmokeDeadline(new Promise((yes,no)=>{server.once('message',m=>yes(m.port));server.once('error',no);server.once('exit',()=>no(Error('Owned API exited before readiness.')));}),20000,()=>{throw Error('Owned API startup timeout');});base='http://127.0.0.1:'+port;
 const bridge='/api/v1/tenants/'+scope.tenantKey+'/workspaces/'+scope.workspaceKey+'/original-administration';
 assert.equal((await native(bridge,rootToken)).status,404,'Root does not inherit an explicit native workspace grant.');
 assert.equal(JSON.parse((await native(bridge,readerToken)).bytes).role,'RO');
 assert.equal((await native('/workspace/'+workspaceId+'/responses',readerToken,'DELETE',{groups:['OWNED.RESULT.A']})).status,403);
 mark('native-context-and-read-only-authorization');
 const expected={};for(const [label,type,enhanced]of [['responses','response',false],['logs','log',false],['comments','review',false],['comments-newFormat','review',true]]){
  const r=await native('/workspace/'+workspaceId+'/report/'+type+'?dataIds=OWNED.RESULT.A&useNewVersion='+enhanced,writerToken,'GET',undefined,'text/csv');assert.equal(r.status,200);assert.ok(r.bytes.length>0);expected[label]=r.bytes;
 }
 browser=await chromium.launch({channel:process.env.UI_SMOKE_BROWSER_CHANNEL||(process.env.CI==='true'?undefined:'chrome'),headless:process.env.CI==='true'&&process.env.UI_SMOKE_HEADFUL!=='true'});
 for(const theme of ['Primar','Sekundar','Erwachsene'])for(const width of [1280,390])for(const role of process.env.ORIGINAL_BROWSER_REFERENCE_ROOT?['RW','RO']:['RW']){
  const settings=await fetch(base+'/api/v1/admin/original-interface/application-settings',{method:'PATCH',headers:{authorization:'Bearer '+rootToken,'Content-Type':'application/json'},body:JSON.stringify({themeName:theme})});assert.equal(settings.status,200);
  if(process.env.ORIGINAL_BROWSER_REFERENCE_ROOT&&!visual){const {createOriginalResultsVisualReference}=await import('./original-workspace-results-visual.mjs');visual=await createOriginalResultsVisualReference({browser,root:process.env.ORIGINAL_BROWSER_REFERENCE_ROOT,sourceRoot:process.env.ORIGINAL_SOURCE_ROOT,artifacts:join(artifacts,'visual')});}
  const context=await browser.newContext({viewport:{width,height:844},locale:'de-DE',timezoneId:'Europe/Berlin'});
  try{
   await open(context,role==='RW'?'owned-results-writer':'owned-results-reader');const visualInput={page,theme,width,role,workspaceId,groups:JSON.parse((await native('/workspace/'+workspaceId+'/results')).bytes),tests:JSON.parse((await native('/workspace/'+workspaceId+'/responses/detailed')).bytes)};
   if(visual)await visual.compare({...visualInput,view:'results',selected:false});
   assert.equal(await page.locator('#originalWorkspaceResults mat-row').count(),2);
   await page.locator('#originalWorkspaceFileHeader h1').getByText('Verwaltung "Eigene Ergebnisse Ω" ('+role+')',{exact:true}).waitFor();
   assert.equal(await page.locator('[data-cy="download-responses"]').isDisabled(),true);
   for(const label of ['responses','logs','comments','comments-newFormat']){
    await selectGroup('Ergebnisgruppe A');const downloaded=page.waitForEvent('download');await page.locator('[data-cy="download-'+label+'"]').click();const download=await downloaded;
    assert.equal(download.suggestedFilename(),'iqb-testcenter-'+(label==='responses'?'responses':label==='logs'?'logs':'reviews')+'.csv');
    const destination=join(artifacts,theme+'-'+width+'-'+role+'-'+label+'.csv');await download.saveAs(destination);assert.deepEqual(await readFile(destination),expected[label]);
    assert.equal(await page.locator('#originalWorkspaceResults mat-row input:checked').count(),0);
   }
   await selectGroup('Ergebnisgruppe A');await page.waitForFunction(()=>document.querySelector('#originalWorkspaceResults mat-header-cell input')?.indeterminate===true);
   if(role==='RW'){await page.locator('[data-cy="delete-files"]').click();await waitForMaterialDialog(page);await page.locator('[data-cy="dialog-cancel"]').click();}
   else assert.equal(await page.locator('[data-cy="delete-files"]').isDisabled(),true);
   assert.equal(await page.locator('#originalWorkspaceResults mat-row input:checked').count(),1);
   if(visual)await visual.compare({...visualInput,view:'results',selected:true});
   await waitForFiniteDocumentAnimations(page);await page.screenshot({path:join(artifacts,theme+'-'+width+'-'+role+'-results-selected.png'),fullPage:true});
   await tab('Tests löschen');assert.equal(await page.locator('#originalWorkspaceTests mat-row').count(),3);
   if(visual)await visual.compare({...visualInput,view:'tests',selected:false});
   await page.locator('#originalWorkspaceTests mat-row input').first().check();await page.getByText('1 Test-Session(s) zum Löschen ausgewählt',{exact:true}).waitFor();
   if(role==='RW'){
    await page.locator('#originalWorkspaceTests .sidebar button').click();await waitForMaterialDialog(page);
    await page.locator('[data-cy="dialog-content"]').getByText('Sie haben eine Test-Session ausgewählt. Soll diese gelöscht werden?',{exact:true}).waitFor();
    await page.locator('[data-cy="dialog-cancel"]').click();await page.locator('mat-dialog-container').waitFor({state:'detached'});
   }else assert.equal(await page.locator('#originalWorkspaceTests .sidebar button').isDisabled(),true);
   if(visual)await visual.compare({...visualInput,view:'tests',selected:true});
   await page.screenshot({path:join(artifacts,theme+'-'+width+'-'+role+'-tests-selected.png'),fullPage:true});
   await page.reload({waitUntil:'domcontentloaded'});await page.locator('#originalWorkspaceTests[aria-busy="false"]').waitFor();
   assert.equal(await page.locator('#originalWorkspaceTests mat-row input:checked').count(),0);mark('four-downloads-two-tabs-cancel-reload-'+theme+'-'+width+'-'+role);
  }catch(e){await page?.screenshot({path:join(artifacts,theme+'-'+width+'-'+role+'-failure.png'),fullPage:true});throw e;}finally{await context.close();}
 }
 const ro=await browser.newContext({viewport:{width:1280,height:844}});
 try{
  await open(ro,'owned-results-reader');await selectGroup('Ergebnisgruppe A');assert.equal(await page.locator('[data-cy="delete-files"]').isDisabled(),true);
  assert.equal(await page.locator('[data-cy="download-responses"]').isEnabled(),true);
  await tab('Tests löschen');await page.locator('#originalWorkspaceTests mat-row input').first().check();assert.equal(await page.locator('#originalWorkspaceTests .sidebar button').isDisabled(),true);mark('readonly-controls');
 }finally{await ro.close();}
 const write=await browser.newContext({viewport:{width:1280,height:844}});
 try{
  await open(write,'owned-results-writer','tests');const before=JSON.parse((await native('/workspace/'+workspaceId+'/responses/detailed')).bytes);
  const retained=await native('/workspace/'+workspaceId+'/report/response?dataIds=OWNED.RESULT.B',writerToken,'GET',undefined,'text/csv');
  await page.locator('#originalWorkspaceTests mat-row input').first().check();await page.locator('#originalWorkspaceTests .sidebar button').click();await waitForMaterialDialog(page);
  await page.locator('[data-cy="dialog-confirm"]').click();await page.locator('#originalWorkspaceTests[aria-busy="false"]').waitFor();
  await page.waitForFunction(()=>document.querySelectorAll('#originalWorkspaceTests mat-row').length===2);
  const after=JSON.parse((await native('/workspace/'+workspaceId+'/responses/detailed')).bytes);assert.equal(Object.values(after).flat().length,Object.values(before).flat().length-1);
  assert.deepEqual((await native('/workspace/'+workspaceId+'/report/response?dataIds=OWNED.RESULT.B',writerToken,'GET',undefined,'text/csv')).bytes,retained.bytes);
  await page.reload({waitUntil:'domcontentloaded'});await page.locator('#originalWorkspaceTests[aria-busy="false"]').waitFor();assert.equal(await page.locator('#originalWorkspaceTests mat-row').count(),2);
  mark('actual-selected-test-delete-retains-other-group-and-survives-reload');
  await tab('Ergebnisse/Antworten');await selectGroup('Ergebnisgruppe B');await page.locator('[data-cy="delete-files"]').click();await waitForMaterialDialog(page);
  await page.locator('[data-cy="dialog-confirm"]').click();await page.waitForFunction(()=>document.querySelectorAll('#originalWorkspaceResults mat-row').length===1);
  const remaining=JSON.parse((await native('/workspace/'+workspaceId+'/results')).bytes);assert.deepEqual(remaining.map(r=>r.groupName),['OWNED.RESULT.A']);mark('actual-selected-group-delete');
 }finally{await write.close();}
 assert.deepEqual(errors,[]);assert.ok(wire.length>0);assert.ok(wire.every(r=>r.native&&!r.canonical));
 await writeFile(join(artifacts,'results.json'),JSON.stringify({verified:true,markers,nativeRequests:wire,sourceOfData:'real application services and native HTTP; owned SQLite; no route DTO stubs',fullOriginalParityProven:false},null,2));
}finally{
 await visual?.close();await browser?.close();await storage.shutdown().catch(()=>{});if(server)await stopNativeSmokeServer(server);
}
