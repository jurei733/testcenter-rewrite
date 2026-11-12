import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {systemCheckXml} from './native-system-check-fixture.mjs';
import {raceWithSmokeDeadline} from './smoke-deadline.mjs';
import {stopNativeSmokeServer} from './native-monitor-smoke-io.mjs';
import {waitForFiniteDocumentAnimations} from './finite-animation-ready.mjs';

const digest=value=>createHash('sha256').update(value).digest('hex');
const fixture=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-syscheck-upload-mode/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',fixture)));
for(const[name,sha]of Object.entries(manifest.files))assert.equal(digest(await readFile(new URL(name,fixture))),sha);
const source=JSON.parse(await readFile(new URL('observations.json',fixture)));
assert.equal(source.verified,true);assert.equal(source.sameDocumentModeRefresh,true);
const sourceHistory=JSON.parse(await readFile(new URL('history-observations.json',fixture)));
assert.equal(sourceHistory.globalDialogClosedAfterHistory,true);assert.equal(sourceHistory.sameDocumentAfterHistory,true);
const normalize=value=>value.replace(/\s+/gu,' ').trim();
const sourceNetworkError=normalize(source.ui.at(-1).text.slice(source.ui.at(-1).text.indexOf('Netzwerkfehler')));

export async function runNativeSystemCheckUploadChecks({browser,out,mark}){
 await mkdir(out,{recursive:true});const runtime=await mkdtemp(join(out,'runtime-')),checks=[],wire=[],modes=[],errors=[],bodies=[];let server,context,otherContext,page,base,token,serial=0;
 const passed=name=>{checks.push(name);mark('native-system-check-upload-'+name);};
 const configureFault=async value=>{
  const id='mode-'+(++serial);let listener;
  try{
   const reply=new Promise(done=>{listener=message=>{if(message?.configured&&message.id===id)done(message);};server.on('message',listener);});
   server.send({nativeModeFault:value,id});await raceWithSmokeDeadline(reply,5000,()=>{throw Error('Owned mode-fault configuration timed out.');});
  }finally{server.off('message',listener);}
 };
 const api=async(path,body,method=body===undefined?'GET':'POST',status=200,credential=token)=>{
  const response=await fetch(base+path,{method,headers:{...(credential?{authorization:'Bearer '+credential}:{}),...body===undefined?{}:{'content-type':'application/json'}},...body===undefined?{}:{body:JSON.stringify(body)}});
  const text=await response.text();let value;try{value=JSON.parse(text);}catch{value=text;}
  assert.equal(response.status,status,method+' '+path+': '+text);return value;
 };
 const observe=target=>{
  target.setDefaultTimeout(20000);target.on('pageerror',error=>errors.push(String(error)));
  target.on('request',request=>{const path=new URL(request.url()).pathname;if(path.startsWith('/app/'))return;const headers=request.headers();wire.push({method:request.method(),path,nativeToken:!!headers.authtoken,canonicalToken:!!headers.authorization,...headers.authorization?{canonicalDigest:digest(headers.authorization)}:{}});if(request.method()==='PUT'&&path.endsWith('/report'))bodies.push(request.postDataJSON());});
  target.on('response',response=>{if(new URL(response.url()).pathname==='/sys-check-mode')void response.json().then(mode=>modes.push(mode)).catch(error=>{if(!target.isClosed())errors.push(String(error));});});
 };
 const capture=async name=>{await page.evaluate(()=>document.fonts.ready);await page.mouse.move(0,0);await waitForFiniteDocumentAnimations(page);await page.screenshot({path:join(out,name+'.png')});};
 try{
  server=spawn(process.execPath,[resolve('scripts/native-system-check-server.mjs')],{stdio:['ignore','ignore','inherit','ipc'],env:{...process.env,FIRST_SLICE_STORE:'sqlite',FIRST_SLICE_SQLITE_FILE:join(runtime,'owned.sqlite'),FIRST_SLICE_BOOTSTRAP_DEMO:'true',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',FIRST_SLICE_XML_SCHEMA_PROFILE:'original-19',FIRST_SLICE_PROOF_OF_WORK_SCOPES:'',REQUIRE_LOGIN_PASSWORD:'false'}});
  const port=await raceWithSmokeDeadline(new Promise((done,reject)=>{server.once('message',message=>done(message.port));server.once('error',reject);server.once('exit',()=>reject(Error('Owned upload API exited.')));}),20000,()=>{throw Error('Owned upload API startup timed out.');});base='http://127.0.0.1:'+port;
  token=(await api('/api/v1/admin/auth/sign-in',{username:'demo-admin',password:'demo-admin-password'},'POST',200,'')).sessionToken;
  await api('/api/v1/platform/tenants',{tenantKey:'owned-mode',displayName:'Owned mode'},'POST',201);await api('/api/v1/tenants/owned-mode/workspaces',{workspaceKey:'upload',displayName:'Owned mode'},'POST',201);
  const scope='/api/v1/tenants/owned-mode/workspaces/upload';
  await api(scope+'/files',{fileName:'check.xml',mediaType:'application/xml',sourceDocument:systemCheckXml('SysCheck','<Metadata><Id>R105.CHECK</Id><Label>Owned upload check</Label></Metadata><Config skipnetwork="true" savekey="owned-key"/>')},'POST',201);
  const directory=await api('/sys-checks',undefined,'GET',200,''),number=String(directory.find(row=>row.name==='R105.CHECK').workspaceId);
  const roster=mode=>systemCheckXml('Testtakers','<Metadata/><Group id="R105.REWRITE" label="Owned"><Login name="r105-owned-login" pw="owned-password" mode="'+mode+'"/></Group>');
  context=await browser.newContext({viewport:{width:1280,height:850}});page=await context.newPage();observe(page);
  await page.goto(base+'/app/r/check-starter?ui=original');await page.getByRole('button',{name:'Owned upload check',exact:true}).waitFor();const documentTime=await page.evaluate(()=>performance.timeOrigin);
  const navigation=await context.newCDPSession(page),initialHistory=await navigation.send('Page.getNavigationHistory'),selectionEntry=initialHistory.entries[initialHistory.currentIndex].id;
  await page.getByRole('button',{name:/zurück zur Startseite/}).click();await page.locator('[data-cy=login-admin-form]').click();await page.locator('#adminUsername').fill('demo-admin');await page.locator('#adminPassword').fill('demo-admin-password');
  const signedIn=page.waitForResponse(response=>new URL(response.url()).pathname==='/api/v1/admin/auth/sign-in'&&response.request().method()==='POST');await page.locator('#adminSignInButton').click();const browserToken=(await(await signedIn).json()).sessionToken,browserDigest=digest('Bearer '+browserToken);
  await page.locator('#originalSystemAdministration[aria-busy=false]').waitFor();await page.getByRole('link',{name:'Gehe zur Startseite',exact:true}).click();await page.locator('#tenantKey').fill('owned-mode');await page.locator('#tenantKey').dispatchEvent('change');await page.locator('#workspaceKey').fill('upload');await page.locator('#workspaceKey').dispatchEvent('change');await page.locator('[data-view-nav=content]').click();await page.locator('#originalWorkspaceFiles[aria-busy=false]').waitFor();
  assert.equal(await page.evaluate(()=>performance.timeOrigin),documentTime);assert.equal(modes.at(-1),false);
  const contentPath=new URL(page.url()).pathname;
  const upload=async(text,label,expected,status=201)=>{
   const pending=page.waitForResponse(response=>new URL(response.url()).pathname===scope+'/files'&&response.request().method()==='POST');
   const modeReply=page.waitForResponse(async response=>new URL(response.url()).pathname==='/sys-check-mode'&&response.status()===200&&await response.json()===expected);
   await page.locator('[data-cy=upload-file-select]').setInputFiles({name:'people.xml',mimeType:'application/xml',buffer:Buffer.from(text)});assert.equal((await pending).status(),status);await modeReply;await page.locator('#originalWorkspaceFiles[aria-busy=false]').waitFor();await page.locator('[data-cy=close-upload-report]').click();assert.equal(await page.evaluate(()=>performance.timeOrigin),documentTime);await capture(label);
  };
  const backToNative=async()=>{
   // Select the real existing browser-history entry once. Repeated goBack()
   // calls can outrun same-document router events and cross the initial page.
   await navigation.send('Page.navigateToHistoryEntry',{entryId:selectionEntry});await page.waitForURL(url=>url.pathname==='/app/r/check-starter');await page.getByRole('button',{name:'Owned upload check',exact:true}).waitFor();assert.equal(await page.evaluate(()=>performance.timeOrigin),documentTime);
  };
  const returnToFiles=async()=>{await backToNative();await page.getByRole('button',{name:/zurück zur Startseite/}).click();await page.locator('[data-cy=login-admin-form]').click();await page.locator('#originalSystemAdministration[aria-busy=false]').waitFor();await page.getByRole('link',{name:'Gehe zur Startseite',exact:true}).click();await page.locator('#tenantKey').fill('owned-mode');await page.locator('#tenantKey').dispatchEvent('change');await page.locator('#workspaceKey').fill('upload');await page.locator('#workspaceKey').dispatchEvent('change');await page.locator('[data-view-nav=content]').click();assert.equal(new URL(page.url()).pathname,contentPath);await page.locator('#originalWorkspaceFiles[aria-busy=false]').waitFor();assert.equal(await page.evaluate(()=>performance.timeOrigin),documentTime);};
  const openReport=async()=>{await page.getByRole('button',{name:'Owned upload check',exact:true}).click();await page.locator('#syscheck-next-step:enabled').waitFor();await page.locator('#syscheck-next-step').click();await page.locator('#originalSystemCheckReport').waitFor();};
  await upload(roster('sys-check-login'),'own-upload-private',true);passed('same-document-real-admin-upload-refreshes-private-mode');
  await backToNative();await openReport();const denied=page.waitForResponse(response=>response.request().method()==='PUT'&&new URL(response.url()).pathname==='/workspace/'+number+'/sys-check/R105.CHECK/report');await page.locator('#saveSystemCheckReportButton').click();assert.equal((await denied).status(),400);await page.getByRole('dialog').waitFor();assert.equal(await page.locator('#systemCheckSaveReportKey').count(),0);assert.equal('keyPhrase' in bodies.at(-1),false);assert.equal('title' in bodies.at(-1),false);await capture('retained-canonical-native-private-error');passed('retained-canonical-administrator-is-not-promoted-to-native-person');
  await returnToFiles();
  await upload(roster('monitor-group'),'own-replacement-public',false);assert.ok(wire.filter(row=>row.method==='POST'&&row.path===scope+'/files').every(row=>row.canonicalDigest===browserDigest));passed('same-document-return-keeps-real-canonical-credential-and-refreshes-public-mode');
  await backToNative();await openReport();await page.locator('#saveSystemCheckReportButton').click();await page.locator('#systemCheckSaveReportKey').waitFor();await capture('same-document-public-save-dialog');await page.locator('#systemCheckSaveReportCancelButton').click();passed('refreshed-public-mode-restores-source-key-title-dialog');
  await returnToFiles();
  await upload('<SysCheck/>','invalid-upload-refresh',false,400);passed('rejected-real-upload-also-refreshes-public-mode');
  await configureFault(true);const posted=page.waitForResponse(response=>new URL(response.url()).pathname===scope+'/files'&&response.request().method()==='POST');await page.locator('[data-cy=upload-file-select]').setInputFiles({name:'people.xml',mimeType:'application/xml',buffer:Buffer.from(roster('sys-check-login'))});assert.equal((await posted).status(),201);
  const networkDialog=page.locator('.original-native-login-error-dialog');await networkDialog.getByRole('heading',{name:'Netzwerkfehler',exact:true}).waitFor();assert.equal(normalize(await networkDialog.innerText()),sourceNetworkError);await capture('global-mode-network-error');await backToNative();await networkDialog.waitFor({state:'hidden'});await configureFault(false);assert.equal(await api('/sys-check-mode',undefined,'GET',200,''),true);
  await openReport();await page.locator('#saveSystemCheckReportButton').click();await page.locator('#systemCheckSaveReportKey').waitFor();await page.locator('#systemCheckSaveReportCancelButton').click();await backToNative();await page.reload();await page.getByRole('button',{name:'Owned upload check',exact:true}).waitFor();assert.notEqual(await page.evaluate(()=>performance.timeOrigin),documentTime);assert.equal(await networkDialog.count(),0);passed('actual-tcp-failure-keeps-source-cache-and-history-dismisses-dialog-before-reload');
  await configureFault(true);otherContext=await browser.newContext({viewport:{width:1280,height:850}});const other=await otherContext.newPage();observe(other);await other.goto(base+'/app/r/check-starter');const startupError=other.locator('.original-native-login-error-dialog');await startupError.getByRole('heading',{name:'Netzwerkfehler',exact:true}).waitFor();assert.equal(normalize(await startupError.innerText()),sourceNetworkError);await configureFault(false);await startupError.locator('[data-cy=close]').click();await other.getByRole('button',{name:'Owned upload check',exact:true}).waitFor();assert.equal(await startupError.count(),0);passed('actual-startup-mode-failure-is-visible-and-reload-recovers');
  assert.ok(wire.filter(row=>row.path==='/sys-check-mode'||row.path==='/sys-checks'||row.path.startsWith('/workspace/')).every(row=>!row.nativeToken&&!row.canonicalToken));assert.equal((await api(scope+'/system-check-reports?checkId=R105.CHECK')).items.length,0);assert.deepEqual(errors,[]);
  await writeFile(join(out,'result.json'),JSON.stringify({success:true,browser:browser.version(),checks,wire,modes,bodies,errors,sourceFixture:manifest.sourceCommit,sourceNetworkDialogExactText:true,actualReportsPersisted:0,canonicalAdministratorEstablishedByActualUI:true,visualParityProven:false},null,2)+'\n');return checks;
 }catch(error){await writeFile(join(out,'failure.json'),JSON.stringify({error:String(error),stack:error.stack,url:page?.url(),text:await page?.locator('body').innerText().catch(()=>''),checks,wire,modes,bodies,errors},null,2)+'\n');throw error;}
 finally{await otherContext?.close();await context?.close();if(server)await stopNativeSmokeServer(server);}
}
