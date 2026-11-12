import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {createSqliteFirstSliceStorage} from '@testcenter-rewrite-app/sqlite-store';
import {createFirstSliceServices} from '@testcenter-rewrite-app/application';
import {systemCheckXml} from './native-system-check-fixture.mjs';
import {raceWithSmokeDeadline} from './smoke-deadline.mjs';
import {stopNativeSmokeServer} from './native-monitor-smoke-io.mjs';
import {waitForFiniteDocumentAnimations} from './finite-animation-ready.mjs';
import {compareScreenshots} from './exact-rgba-comparison.mjs';

const fixture=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-syscheck-anonymous-ui/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',fixture)));
for(const[name,digest]of Object.entries(manifest.files))assert.equal(createHash('sha256').update(await readFile(new URL(name,fixture))).digest('hex'),digest);
const source=JSON.parse(await readFile(new URL('observations.json',fixture)));
assert.equal(source.actualSourceBackend,true);assert.equal(source.actualSourceFrontend,true);assert.equal(Object.keys(source.persistedReports).length,3);
const sourceWrongKey=JSON.parse(await readFile(new URL('wrong-key-observations.json',fixture)));
assert.equal(sourceWrongKey.verified,true);
const sourceBody=index=>source.reportBodies[index].body;

export async function runNativeAnonymousSystemChecks({browser,out,validator,mark}){
 await mkdir(out,{recursive:true});
 const file=join(await mkdtemp(join(out,'runtime-')),'owned.sqlite');
 const storage=createSqliteFirstSliceStorage(file),repository=storage.repository,services=createFirstSliceServices({repository,originalXmlSchemaValidator:validator,xmlSchemaProfile:'original-19'});
 const errors=[],wire=[],bodies=[],checks=[],selfControls=[];let server,page,anonymous;
 const passed=name=>{checks.push(name);mark('native-anonymous-system-check-'+name);};
 try{
  const tenant=await services.platform.createTenant({tenantKey:'owned-anonymous',displayName:'Owned anonymous'}),workspace=await services.platform.createWorkspace({tenantKey:tenant.tenantKey,workspaceKey:'owned',displayName:'Owned anonymous'});
  const scope={tenantKey:tenant.tenantKey,workspaceKey:workspace.workspaceKey},number=await repository.getOrCreateOriginalWorkspaceNumber(workspace);
  const upload=(fileName,sourceDocument)=>services.contentIntake.uploadWorkspaceFile({...scope,fileName,sourceDocument,mediaType:'application/xml'});
  const records=async()=>(await repository.listWorkspaceActivityEventsByWorkspace(tenant.tenantId,workspace.workspaceId)).filter(row=>row.eventType==='system_check_report_saved').map(row=>row.details.report);
  server=spawn(process.execPath,[resolve('scripts/native-system-check-server.mjs')],{stdio:['ignore','ignore','inherit','ipc'],env:{...process.env,FIRST_SLICE_STORE:'sqlite',FIRST_SLICE_SQLITE_FILE:file,FIRST_SLICE_BOOTSTRAP_DEMO:'false',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',FIRST_SLICE_XML_SCHEMA_PROFILE:'original-19',REQUIRE_LOGIN_PASSWORD:'false',FIRST_SLICE_PROOF_OF_WORK_SCOPES:'participant,second_code',FIRST_SLICE_PROOF_OF_WORK_SECRET:'owned-anonymous-system-check-proof',FIRST_SLICE_PROOF_OF_WORK_PREVIOUS_SECRET:'',FIRST_SLICE_PROOF_OF_WORK_MAX_NUMBER:'12',FIRST_SLICE_PROOF_OF_WORK_TTL_MS:'60000'}});
  const port=await raceWithSmokeDeadline(new Promise((done,reject)=>{server.once('message',message=>done(message.port));server.once('error',reject);server.once('exit',()=>reject(Error('Owned anonymous API exited.')));}),20000,()=>{throw Error('Owned anonymous API startup timed out.');});
  const base='http://127.0.0.1:'+port;
  const observe=target=>{
   target.setDefaultTimeout(20000);target.on('pageerror',error=>errors.push(String(error)));
   target.on('request',request=>{const path=new URL(request.url()).pathname;if(path.startsWith('/app/'))return;wire.push({method:request.method(),path,nativeToken:!!request.headers().authtoken,canonicalToken:!!request.headers().authorization});if(request.method()==='PUT'&&path.endsWith('/report'))bodies.push({body:request.postDataJSON(),authenticated:!!request.headers().authtoken});});
  };
  const capture=async(name,target=page)=>{
   await target.evaluate(()=>document.fonts.ready);await target.waitForFunction(()=>Array.from(document.images).every(image=>image.complete&&image.naturalWidth>0));await target.mouse.move(0,0);await waitForFiniteDocumentAnimations(target);
   const first=await target.screenshot({path:join(out,name+'.png')});if(!name.startsWith('selection-'))return;
   await target.evaluate(()=>{const cover=document.createElement('div');cover.id='owned-repaint-control';cover.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#fff;pointer-events:none';document.body.append(cover);});
   const witnesses=[];
   for(let index=0;index<3;index++){
    await target.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));const png=await target.screenshot({path:join(out,name+'-white-'+index+'.png')});
    const result=await target.evaluate(async base64=>{const image=new Image();image.src='data:image/png;base64,'+base64;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const context=canvas.getContext('2d');context.drawImage(image,0,0);const data=context.getImageData(0,0,canvas.width,canvas.height).data;let nonWhite=0;for(let index=0;index<data.length;index+=4)if(data[index]!==255||data[index+1]!==255||data[index+2]!==255||data[index+3]!==255)nonWhite++;return{width:canvas.width,height:canvas.height,nonWhite};},png.toString('base64'));assert.equal(result.nonWhite,0);witnesses.push(result);
   }
   await target.evaluate(()=>{document.getElementById('owned-repaint-control').remove();return new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));});await waitForFiniteDocumentAnimations(target);
   const second=await target.screenshot({path:join(out,name+'-self.png')});const comparison=await compareScreenshots(target,first,second);selfControls.push({name,comparison,witnesses});assert.equal(comparison.differingPixels,0,name+' Rewrite repaint control');
  };
  page=await browser.newPage({viewport:{width:1280,height:850}});observe(page);
  await page.goto(base+'/app/r/check-starter');await page.getByText('Auf diesem Server ist aktuell kein Systemcheck verfügbar.',{exact:true}).waitFor();await capture('selection-empty');passed('public-empty-directory');
  await upload('public.xml',systemCheckXml('SysCheck','<Metadata><Id>R104.PUBLIC</Id><Label>Owned public check</Label><Description>Owned public description</Description></Metadata><Config skipnetwork="true" savekey="owned-key"/>'));
  await page.reload();await page.getByText('Bitte klicken Sie auf den Schalter, um den Check zu starten!',{exact:true}).waitFor();assert.equal(await page.locator('button.starter').count(),1);assert.match(page.url(),/check-starter$/);await capture('selection-one');passed('single-public-check-keeps-explicit-selection');
  const report=async(target=page)=>{await target.getByRole('button',{name:/Owned public check/}).click();await target.waitForURL(/\/w$/);await target.locator('#syscheck-next-step:not([disabled])').waitFor();await target.locator('#syscheck-next-step').click();await target.waitForURL(/\/r$/);};
  await report();await page.locator('#saveSystemCheckReportButton').click();const dialog=page.getByRole('dialog');await dialog.getByRole('heading',{name:'Bericht senden',exact:true}).waitFor();
  const save=page.locator('#systemCheckSaveReportConfirmButton');assert.equal(await save.isDisabled(),true);await page.locator('#systemCheckSaveReportKey').fill('owned-key');await page.locator('#systemCheckSaveReportId').fill(' A');assert.equal(await save.isDisabled(),true);await page.locator('#systemCheckSaveReportId').fill(sourceBody(0).title);assert.equal(await save.isEnabled(),true);await capture('anonymous-save-dialog');
  await save.click();await page.locator('#globalConfirmationTitle').waitFor();assert.equal(bodies[0].authenticated,false);assert.equal(bodies[0].body.title,sourceBody(0).title);assert.equal(bodies[0].body.keyPhrase,sourceBody(0).keyPhrase);assert.equal((await records())[0].title,sourceBody(0).title);await page.locator('#globalConfirmationCancelButton').click();await page.waitForURL(/\/native-start$/);passed('anonymous-key-and-untrimmed-title-persist');
  await upload('other.xml',systemCheckXml('SysCheck','<Metadata><Id>R104.OTHER</Id><Label>Owned other check</Label><Description>Owned other description</Description></Metadata><Config skipnetwork="true"/>'));
  await page.goto(base+'/app/r/check-starter');await page.getByText('Bitte wählen Sie einen Check aus!',{exact:true}).waitFor();assert.equal(await page.locator('button.starter').count(),2);await capture('selection-many');passed('public-multiple-checks');
  const roster=(await upload('people.xml',systemCheckXml('Testtakers','<Metadata/><Group id="R104.OWNED" label="Owned"><Login name="r104-owned" pw="owned-password" mode="sys-check-login"/></Group>'))).sourcePackage;
  const modeReads=()=>wire.filter(row=>row.path==='/sys-check-mode').length,before=modeReads();assert.equal(await services.originalSystemCheck.mode(),true);
  await page.getByRole('button',{name:/zurück zur Startseite/}).click();await page.waitForURL(/\/native-start$/);await page.locator('input[name="name"]').fill('r104-owned');await page.locator('[data-cy=login-user]').click();await page.locator('input[name="password"]').fill('owned-password');await page.locator('[data-cy=login-user]').click();await page.locator('[data-cy="syscheck-R104.PUBLIC"]').waitFor();assert.equal(modeReads(),before);
  const nativeReport=async()=>{await page.locator('[data-cy="syscheck-R104.PUBLIC"]').click();await page.waitForURL(/\/w$/);await page.locator('#syscheck-next-step:not([disabled])').waitFor();await page.locator('#syscheck-next-step').click();await page.waitForURL(/\/r$/);await page.locator('#saveSystemCheckReportButton').click();};
  await nativeReport();await page.locator('#systemCheckSaveReportKey').waitFor();await page.locator('#systemCheckSaveReportKey').fill(sourceBody(1).keyPhrase);await page.locator('#systemCheckSaveReportId').fill(sourceBody(1).title);await save.click();await page.locator('#globalConfirmationTitle').waitFor();assert.equal(bodies[1].authenticated,true);assert.equal(bodies[1].body.title,sourceBody(1).title);assert.equal((await records())[1].title,'r104-owned');await page.locator('#globalConfirmationCancelButton').click();await page.waitForURL(/\/native-start$/);passed('authenticated-actor-keeps-cached-public-mode-dialog');
  await page.reload();await page.locator('[data-cy="syscheck-R104.PUBLIC"]').waitFor();await nativeReport();await page.locator('#globalConfirmationTitle').waitFor();assert.equal(await page.locator('#systemCheckSaveReportKey').count(),0);assert.equal('title' in bodies[2].body,false);assert.equal('keyPhrase' in bodies[2].body,false);assert.equal((await records())[2].title,'r104-owned');passed('reloaded-private-mode-saves-without-key-dialog');
  anonymous=await browser.newPage({viewport:{width:1280,height:850}});observe(anonymous);await anonymous.goto(base+'/app/r/check-starter');await anonymous.getByRole('button',{name:/Owned public check/}).waitFor();await report(anonymous);const denied=anonymous.waitForResponse(response=>response.request().method()==='PUT'&&response.url().endsWith('/report'));await anonymous.locator('#saveSystemCheckReportButton').click();assert.equal((await denied).status(),400);await anonymous.getByRole('heading',{name:'Fehlerhafte Daten',exact:true}).waitFor();assert.equal(await anonymous.locator('#systemCheckSaveReportKey').count(),0);await capture('anonymous-global-mode-error',anonymous);assert.equal(bodies[3].authenticated,false);assert.equal('keyPhrase' in bodies[3].body,false);assert.equal('title' in bodies[3].body,false);assert.equal((await records()).length,3);passed('anonymous-private-mode-keeps-source-error-and-no-report');

  await anonymous.close();anonymous=undefined;
  await services.contentIntake.deleteSourcePackage({...scope,sourcePackageId:roster.sourcePackageId,confirmation:roster.fileName});assert.equal(await services.originalSystemCheck.mode(),false);
  anonymous=await browser.newPage({viewport:{width:1280,height:850}});observe(anonymous);await anonymous.goto(base+'/app/r/check-starter');await anonymous.getByRole('button',{name:/Owned public check/}).waitFor();await report(anonymous);await anonymous.locator('#saveSystemCheckReportButton').click();await anonymous.locator('#systemCheckSaveReportKey').fill(sourceWrongKey.reportBodies[0].body.keyPhrase);await anonymous.locator('#systemCheckSaveReportId').fill(sourceWrongKey.reportBodies[0].body.title);const wrong=anonymous.waitForResponse(response=>response.request().method()==='PUT'&&response.url().endsWith('/report'));await anonymous.locator('#systemCheckSaveReportConfirmButton').click();assert.equal((await wrong).status(),403);await anonymous.getByRole('heading',{name:'Falsches Kennwort',exact:true}).waitFor();await capture('wrong-key-error',anonymous);assert.equal((await records()).length,3);const sourceError=sourceWrongKey.ui[0].text.slice(sourceWrongKey.ui[0].text.lastIndexOf('Falsches Kennwort'));assert.equal((await anonymous.getByRole('dialog').innerText()).replace(/\s+/g,' ').trim(),sourceError.replace(/\s+/g,' ').trim());passed('wrong-key-source-dialog-does-not-save');
  assert.ok(wire.every(row=>!row.canonicalToken));assert.ok(wire.filter(row=>['/sys-check-mode','/sys-checks'].includes(row.path)).every(row=>!row.nativeToken));assert.deepEqual(errors,[]);passed('public-reads-and-native-writes-do-not-use-canonical-bearer');
  const result={success:true,browser:browser.version(),checks,wire,reportBodies:bodies,reportsPersisted:(await records()).length,errors,selfControls,actualSourceFrontendReference:true,visualParityProven:false};await writeFile(join(out,'result.json'),JSON.stringify(result,null,2)+'\n');return result;
 }catch(error){if(page)await page.screenshot({path:join(out,'failure.png')}).catch(()=>{});await writeFile(join(out,'result.json'),JSON.stringify({success:false,checks,errors:[...errors,String(error)],wire,reportBodies:bodies,visualParityProven:false},null,2)+'\n');throw error;}
 finally{await anonymous?.close();await page?.close();if(server)await stopNativeSmokeServer(server);await storage.shutdown();}
}
