import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {systemCheckXml} from './native-system-check-fixture.mjs';
import {raceWithSmokeDeadline} from './smoke-deadline.mjs';
import {stopNativeSmokeServer} from './native-monitor-smoke-io.mjs';
import {waitForFiniteDocumentAnimations} from './finite-animation-ready.mjs';

const fixture=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-syscheck-offline-error/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',fixture)));
for(const[path,sha]of Object.entries(manifest.files)){
 assert.match(path,/^[A-Za-z0-9.-]+$/);
 assert.equal(createHash('sha256').update(await readFile(new URL(path,fixture))).digest('hex'),sha);
}
const source=JSON.parse(await readFile(new URL('observations.json',fixture)));
assert.equal(source.actualSourceBackend,true);assert.equal(source.actualSourceFrontend,true);
assert.equal(source.apiMocks,false);assert.equal(source.sqlSeedsOrDaoStubs,false);
assert.equal(source.controls.length,12);assert.equal(source.selfControls.length,24);
for(const row of source.controls){
 assert.equal(row.offline,true);assert.deepEqual(row.scriptsAfter,[]);
 assert.equal(row.survivesEscape,1);assert.equal(row.offlineBannerCount,0);
 assert.equal(row.recovery.newDocument,true);assert.equal(row.recovery.loginVisible,true);
 assert.equal(row.recovery.path,'#/r/login/');
}
const normalize=text=>text.replace(/\s+/gu,' ').trim();

/** Real browser offline transition and persistent TCP mode fault, with cold
 * contexts and no Service Worker cache. Source's missing-resource cascade is
 * recorded counter-evidence, not a pixel target for the usable network dialog. */
export async function runNativeSystemCheckOfflineChecks({browser,out,mark}){
 await mkdir(out,{recursive:true});const runtime=await mkdtemp(join(out,'runtime-'));
 const checks=[],controls=[],errors=[],consoleErrors=[],wire=[];
 let server,context,page,base,token,serial=0,stage='setup';
 const passed=name=>{checks.push(name);mark('native-system-check-offline-'+name);};
 const configure=async options=>{
  const id='offline-'+(++serial);let listener;
  const reply=new Promise(done=>{listener=message=>{if(message?.configured&&message.id===id)done(message);};server.on('message',listener);});
  try{server.send({...options,id});await raceWithSmokeDeadline(reply,5000,()=>{throw Error('Owned offline configuration timed out.');});}finally{server.off('message',listener);}
 };
 const api=async(path,body,method=body===undefined?'GET':'POST',expected=200,credential=token)=>{
  const response=await fetch(base+path,{method,headers:{...(credential?{authorization:'Bearer '+credential}:{}),...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
  const text=await response.text();let value;try{value=JSON.parse(text);}catch{value=text;}
  assert.equal(response.status,expected,method+' '+path+': '+text);return value;
 };
 try{
  server=spawn(process.execPath,[resolve('scripts/native-system-check-server.mjs')],{stdio:['ignore','ignore','inherit','ipc'],env:{...process.env,FIRST_SLICE_STORE:'sqlite',FIRST_SLICE_SQLITE_FILE:join(runtime,'owned.sqlite'),FIRST_SLICE_BOOTSTRAP_DEMO:'false',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',FIRST_SLICE_XML_SCHEMA_PROFILE:'original-19',FIRST_SLICE_PROOF_OF_WORK_SCOPES:'',REQUIRE_LOGIN_PASSWORD:'false'}});
  const port=await raceWithSmokeDeadline(new Promise((done,reject)=>{server.once('message',message=>done(message.port));server.once('error',reject);server.once('exit',()=>reject(Error('Owned offline API exited.')));}),20000,()=>{throw Error('Owned offline API startup timed out.');});base='http://127.0.0.1:'+port;
  await api('/api/v1/admin/auth/bootstrap',{username:'owned-offline-admin',displayName:'Owned offline',password:'owned-offline-admin-password'},'POST',201,'');
  token=(await api('/api/v1/admin/auth/sign-in',{username:'owned-offline-admin',password:'owned-offline-admin-password'},'POST',200,'')).sessionToken;
  await api('/api/v1/platform/tenants',{tenantKey:'owned-offline',displayName:'Owned offline'},'POST',201);
  await api('/api/v1/tenants/owned-offline/workspaces',{workspaceKey:'offline',displayName:'Owned offline'},'POST',201);
  const scope='/api/v1/tenants/owned-offline/workspaces/offline';
  await api(scope+'/files',{fileName:'check.xml',mediaType:'application/xml',sourceDocument:systemCheckXml('SysCheck','<Metadata><Id>R108.CHECK</Id><Label>Owned offline error check</Label></Metadata><Config skipnetwork="true" savekey="owned-key"/>')},'POST',201);
  for(const theme of ['Primar','Sekundar','Erwachsene']){
   await api('/api/v1/admin/application-settings',{themeName:theme},'PATCH');
   for(const width of [1280,390]){
    const prefix=theme+'-'+width,reference=source.controls.find(row=>row.theme===theme&&row.width===width&&row.browser===browser.version())??source.controls.find(row=>row.theme===theme&&row.width===width);
    assert.ok(reference);stage=prefix+'-startup';await configure({nativeModeHold:true,nativeModeFault:true});
    context=await browser.newContext({viewport:{width,height:850},serviceWorkers:'block'});page=await context.newPage();page.setDefaultTimeout(20000);
    const scripts=[],failed=[];
    page.on('pageerror',error=>errors.push(String(error)));page.on('console',message=>{if(message.type()==='error')consoleErrors.push(message.text());});
    page.on('request',request=>{const path=new URL(request.url()).pathname;if(request.resourceType()==='script')scripts.push(path);if(!path.startsWith('/app/'))wire.push({theme,width,path,method:request.method(),nativeToken:!!request.headers().authtoken,canonicalToken:!!request.headers().authorization});});
    page.on('requestfailed',request=>failed.push({path:new URL(request.url()).pathname,error:request.failure()?.errorText}));
    let heldListener;const held=new Promise(done=>{heldListener=message=>{if(message?.heldModeRequest){server.off('message',heldListener);done();}};server.on('message',heldListener);});
    await page.goto(base+'/app/r/check-starter');await page.getByRole('button',{name:'Owned offline error check',exact:true}).waitFor();
    await page.waitForFunction(theme=>document.documentElement.dataset.applicationTheme===theme&&document.documentElement.dataset.interfaceMode==='original',theme);
    await raceWithSmokeDeadline(held,5000,()=>{throw Error('Actual offline mode request not held.');});
    await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>Array.from(document.images).every(image=>image.complete&&image.naturalWidth>0));
    const scriptsBefore=[...scripts],timeOrigin=await page.evaluate(()=>performance.timeOrigin),before=await page.evaluate(()=>Date.now()),platform=await page.evaluate(()=>navigator.platform);
    stage=prefix+'-offline';await context.setOffline(true);await configure({nativeModeHold:false});
    const dialog=page.getByRole('dialog');await dialog.getByRole('heading',{name:'Netzwerkfehler',exact:true}).waitFor({timeout:5000});await waitForFiniteDocumentAnimations(page);
    assert.equal(await page.evaluate(()=>navigator.onLine),false);assert.equal(await page.evaluate(()=>performance.timeOrigin),timeOrigin);
    assert.equal(await page.locator('.offline-shell-banner').count(),reference.offlineBannerCount);
    await page.screenshot({path:join(out,prefix+'-collapsed.png')});passed(prefix+'-cold-offline-error-renders-without-another-script');
    await dialog.locator('mat-expansion-panel-header').click();await dialog.getByText('Browser:',{exact:true}).waitFor();await waitForFiniteDocumentAnimations(page);
    const paragraphs=await dialog.locator('mat-expansion-panel p').allInnerTexts();
    const sourceEnvironmentMatched=platform==='MacIntel'&&reference.browser===browser.version();
    for(const field of ['Browser:','Betriebssystem:','Gerät:'])assert.ok(paragraphs.some(text=>text.startsWith(field)),JSON.stringify({field,paragraphs}));
    for(const field of [...(sourceEnvironmentMatched?['Browser:','Betriebssystem:','Gerät:']:[]),'Booklet:','Login:','Mode:']){
     assert.equal(normalize(paragraphs.find(text=>text.startsWith(field))??''),normalize(reference.expanded.paragraphs.find(text=>text.startsWith(field))??''),field);
    }
    const timestamp=paragraphs.find(text=>text.startsWith('Zeitpunkt: '))?.slice('Zeitpunkt: '.length);assert.match(timestamp,/^[A-Z][a-z]{2} \d{1,2}, \d{4}, \d{1,2}:\d{2}:\d{2} (AM|PM)$/);
    const parsed=await page.evaluate(text=>Date.parse(text),timestamp),now=await page.evaluate(()=>Date.now());assert.ok(parsed+1000>=before&&parsed<=now);
    assert.equal(paragraphs.find(text=>text.startsWith('Url: '))?.slice('Url: '.length),page.url());
    await page.screenshot({path:join(out,prefix+'-expanded.png')});await page.keyboard.press('Escape');assert.equal(await dialog.count(),reference.survivesEscape);
    const scriptsAfter=scripts.slice(scriptsBefore.length);assert.deepEqual(scriptsAfter,[]);assert.ok(failed.some(row=>row.path==='/sys-check-mode'));
    passed(prefix+'-Source-anonymous-details-and-Escape-retain-the-offline-dialog');
    stage=prefix+'-recover';await context.setOffline(false);await configure({nativeModeFault:false});await dialog.locator('[data-cy=close]').click();
    await page.waitForURL(url=>url.pathname==='/app/native-start');await page.getByRole('textbox',{name:'Anmeldename',exact:true}).waitFor();
    assert.notEqual(await page.evaluate(()=>performance.timeOrigin),timeOrigin);assert.equal(await page.getByRole('dialog').count(),0);
    controls.push({theme,width,browser:browser.version(),platform,sourceEnvironmentMatched,scriptsBefore,scriptsAfter,failed,timestamp,paragraphs,recovery:{newDocument:true,loginVisible:true,path:new URL(page.url()).pathname},sourceResourceFailureDialogs:reference.dialogCount});
    passed(prefix+'-Source-reload-enters-a-new-login-document');await context.close();context=undefined;page=undefined;
   }
  }
  assert.deepEqual(errors,[]);assert.deepEqual(consoleErrors.filter(text=>/TypeError|ReferenceError|SyntaxError|NG\d{4}/u.test(text)),[]);
  assert.ok(wire.every(row=>!row.nativeToken&&!row.canonicalToken));assert.equal((await api(scope+'/system-check-reports?checkId=R108.CHECK')).items.length,0);
  await writeFile(join(out,'result.json'),JSON.stringify({success:true,browser:browser.version(),checks,controls,errors,consoleErrors,wire,reportsPersisted:0,actualSourceFrontendReference:true,sourceFixture:manifest.sourceCommit,sourceResourceFailureCascadeRetainedAsCounterEvidence:true,visualParityProven:false},null,2)+'\n');return checks;
 }catch(error){
  await page?.screenshot({path:join(out,'failure.png')}).catch(()=>{});
  await writeFile(join(out,'failure.json'),JSON.stringify({stage,error:String(error),stack:error.stack,text:await page?.locator('body').innerText().catch(()=>''),checks,controls,errors,consoleErrors,wire},null,2)+'\n');throw error;
 }finally{await context?.close();if(server)await stopNativeSmokeServer(server);}
}
