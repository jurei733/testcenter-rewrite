import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,writeFile,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
import {chromium} from 'playwright';
import {isSupervisedSmokeChild,runSupervisedSmoke,reportSmokePhase} from './supervised-smoke.mjs';
import {raceWithSmokeDeadline} from './smoke-deadline.mjs';
import {stopNativeSmokeServer} from './native-monitor-smoke-io.mjs';
const root=process.env.UI_SMOKE_ARTIFACT_DIR?resolve(process.env.UI_SMOKE_ARTIFACT_DIR):await mkdtemp(join(tmpdir(),'owned-native-assets-ui-'));
if(!isSupervisedSmokeChild(import.meta.url))process.exitCode=await runSupervisedSmoke({entry:fileURLToPath(import.meta.url),artifactDirectory:join(root,'native-assets-supervision'),env:{...process.env,UI_SMOKE_ARTIFACT_DIR:root},phaseTimeoutMs:60000,totalTimeoutMs:240000});
else{
const out=join(root,'native-assets');await mkdir(out,{recursive:true});console.log('owned_artifacts='+out);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=','base64'),sha=x=>createHash('sha256').update(x).digest('hex');
const slots=['logo','loginIllustration','codeInputIllustration','codeInputCompanion','starterCompanion','starterCardDone','loadingProgress','confirmDialog'];
const frozen=process.env.NATIVE_ASSET_INPUT_FREEZE?JSON.parse(await readFile(process.env.NATIVE_ASSET_INPUT_FREEZE,'utf8')):null;
const verifyInputs=async()=>{if(frozen)for(const [path,hash]of Object.entries(frozen.hashes))assert.equal(sha(await readFile(resolve(path))),hash,path);};
await verifyInputs();
const publicBitmapFormats=[],rows=[],errors=[],wire=[],checks=[],responses=[];let browser,server,releasePlayer,observedPage;
try{
 reportSmokePhase('native-assets-owned-server');
 const module=pathToFileURL(resolve('apps/api/dist/apps/api/src/index.js')).href,owner=pathToFileURL(resolve('scripts/native-monitor-smoke-io.mjs')).href;
 server=spawn(process.execPath,['--input-type=module','-e',`import{createProductionApiServer}from ${JSON.stringify(module)};import{bindNativeSmokeServerOwner}from ${JSON.stringify(owner)};const server=await createProductionApiServer();bindNativeSmokeServerOwner(server);server.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));`],{
  stdio:['ignore','ignore','inherit','ipc'],env:{...process.env,FIRST_SLICE_STORE:'sqlite',FIRST_SLICE_SQLITE_FILE:join(out,'owned.sqlite'),FIRST_SLICE_BOOTSTRAP_DEMO:'true',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',FIRST_SLICE_PROOF_OF_WORK_SCOPES:'',FIRST_SLICE_XML_SCHEMA_PROFILE:'original-19'}});
 const port=await raceWithSmokeDeadline(new Promise((done,reject)=>{server.once('message',x=>done(x.port));server.once('error',reject);server.once('exit',()=>reject(Error('Owned native assets API exited.')));}),20000,()=>{throw Error('Owned native assets API startup timed out.');}),base='http://127.0.0.1:'+port;
 let token;
 const api=async(method,path,body,native=true,status=200)=>{
  const r=await fetch(base+path,{method,headers:{...(token?native?{AuthToken:token}:{Authorization:'Bearer '+token}:{}),...(body===undefined||body instanceof FormData?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:body instanceof FormData?body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});const text=await r.text();assert.equal(r.status,status,method+' '+path+': '+text);return text?JSON.parse(text):null;
 };
 token=(await api('PUT','/session/admin',{name:'demo-admin',password:'demo-admin-password'})).token;
 const assets=[];for(const name of ['global','group','user']){const body=new FormData();body.append('file',new Blob([png]),'owned-ui-assets-'+name+'.png');assets.push(await api('POST','/assets',body));}
 await api('POST','/asset-assignments',{assignments:slots.map(slotName=>({slotName,assetID:assets[0].id}))});
 const prefix='/api/v1/tenants/demo-tenant/workspaces/demo-workspace';
 const xml=(type,body)=>`<${type} xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/${type==='Unit'?'unit-xml/17.6':type==='Booklet'?'testcenter-booklet-xml/18.0':'testcenter-testtaker-xml/18.0'}">${body}</${type}>`;
 const upload=(fileName,sourceDocument,mediaType='application/xml')=>api('POST',prefix+'/files',{fileName,sourceDocument,mediaType},false,201);
 const metadata={$schema:'https://raw.githubusercontent.com/verona-interfaces/metadata/master/verona-module-metadata.json',id:'owned-asset-player',version:'1.0.0',specVersion:'6.0',metadataVersion:'2.0',type:'player',name:[{lang:'de',value:'Owned asset Player'}]};
 const player='<!doctype html><html><script type="application/ld+json">'+JSON.stringify(metadata)+'</script><body><label>Owned asset answer<input aria-label="Owned asset answer" disabled></label><script>addEventListener("message",event=>{if(event.data?.type==="vopStartCommand"){document.querySelector("input").disabled=false;document.body.dataset.started="true";}});parent.postMessage({type:"vopReadyNotification",metadata:{specVersion:"6.0"}},"*");</script></body></html>';
 await upload('owned-asset-player-1.0.html',player,'text/html');
 await upload('unit.xml',xml('Unit','<Metadata><Id>OWNED.ASSET.UNIT</Id><Label>Owned asset Unit</Label></Metadata><Definition player="owned-asset-player-1.0">Owned</Definition>'));
 await upload('booklet.xml',xml('Booklet','<Metadata><Id>OWNED.ASSET.BOOK</Id><Label>Owned asset Booklet</Label></Metadata><Units><Unit id="OWNED.ASSET.UNIT" label="Owned asset Unit"/></Units>'));
 const assignment=(slot,asset)=>'<Asset slot="'+slot+'">'+asset.originalName+'</Asset>';
 const roster=xml('Testtakers','<Metadata/><Group id="OWNED.ASSET.UI" label="Owned asset UI"><AssetAssignments>'+assignment('logo',assets[1])+assignment('starterCompanion',assets[1])+assignment('loadingProgress',assets[1])+'</AssetAssignments><Login name="owned-assets-user" pw="owned-assets-password" mode="run-hot-return"><Booklet codes="c1">OWNED.ASSET.BOOK</Booklet><AssetAssignments>'+assignment('logo',assets[2])+'</AssetAssignments></Login></Group>');
 await upload('people.xml',roster);await api('POST',prefix+'/participant-roster',{rosterText:roster},false,201);
 browser=await chromium.launch({headless:process.env.CI==='true'&&process.env.UI_SMOKE_HEADFUL!=='true',...(process.env.UI_SMOKE_BROWSER_CHANNEL?{channel:process.env.UI_SMOKE_BROWSER_CHANNEL}:{})});
 const image=async(page,selector,asset)=>{
  await page.waitForFunction(({selector,url})=>{const n=document.querySelector(selector);return n instanceof HTMLImageElement&&n.complete&&n.naturalWidth===1&&n.src===url;},{selector,url:base+'/'+asset.url});
  return page.locator(selector).first().evaluate(n=>({src:new URL(n.src).pathname,complete:n.complete,naturalWidth:n.naturalWidth,naturalHeight:n.naturalHeight}));
 };
 // Actual browser decoding also covers the Source's accepted mismatch
 // between PNG fileinfo bytes and generated JPEG/WebP URL extensions.
 const formatContext=await browser.newContext(),formatPage=await formatContext.newPage();
 formatPage.on('pageerror',error=>errors.push({scope:'public-bitmap-formats',error:String(error)}));
 try{
  await formatPage.goto(base+'/app/native-start?ui=original');
  for(const extension of ['png','webp','jpeg','jpg']){
   reportSmokePhase('native-assets-public-bitmap-'+extension);
   const body=new FormData();body.append('file',new Blob([png],{type:'image/png'}),'owned-public-bitmap.'+extension);
   const asset=await api('POST','/assets',body),url=base+'/'+asset.url;
   const response=formatPage.waitForResponse(r=>r.url()===url);void response.catch(()=>{});
   const dimensions=await formatPage.evaluate(url=>new Promise((done,reject)=>{const image=new Image();image.onload=()=>done({width:image.naturalWidth,height:image.naturalHeight});image.onerror=()=>reject(Error('Public image did not decode.'));image.src=url;document.body.append(image);}),url);
   const reply=await response;assert.equal(reply.status(),200);assert.equal(await reply.headerValue('content-type'),extension==='png'?'image/png':extension==='webp'?'image/webp':'image/jpeg');assert.equal(await reply.headerValue('cache-control'),'public, max-age=31536000, immutable');assert.equal(sha(await reply.body()),sha(png));assert.deepEqual(dimensions,{width:1,height:1});publicBitmapFormats.push({extension,dimensions,mimeType:await reply.headerValue('content-type'),bytesSha256:sha(png)});
  }
 }finally{await formatContext.close();}
 for(const theme of ['Primar','Sekundar','Erwachsene'])for(const width of [390,1280]){
  reportSmokePhase('native-assets-'+theme+'-'+width);
  await api('PATCH','/api/v1/admin/original-interface/application-settings',{themeName:theme},false);
  const context=await browser.newContext({viewport:{width,height:844},locale:'de-DE',timezoneId:'Europe/Berlin'}),page=await context.newPage();observedPage=page;
  page.on('pageerror',e=>errors.push({theme,width,error:String(e)}));
  page.on('request',request=>{const path=new URL(request.url()).pathname;if(path==='/asset-assignments'||path.startsWith('/public/uploaded_assets/'))wire.push({theme,width,method:request.method(),path,hasAuthToken:Boolean(request.headers().authtoken)});});
  page.on('response',r=>{if(new URL(r.url()).pathname.startsWith('/public/uploaded_assets/'))responses.push(r.body().then(body=>({path:new URL(r.url()).pathname,status:r.status(),sha256:sha(body)})));});
  await page.goto(base+'/app/native-start?ui=original');await image(page,'header .logo img',assets[0]);await image(page,'.welcome-section img',assets[0]);
  await page.getByRole('textbox',{name:'Anmeldename',exact:true}).fill('owned-assets-user');await page.locator('[data-cy=login-user]').click();
  await page.locator('input[type=password]').fill('owned-assets-password');await page.locator('[data-cy=login-user]').click();
  await page.locator('tc-code-input').waitFor();await image(page,'header .logo img',assets[2]);
  const code=page.locator('tc-code-input input');await code.fill('c1');await code.press('Enter');
  await page.locator('tc-test-card[data-cy="booklet-OWNED.ASSET.BOOK"]').waitFor();await image(page,'header .logo img',assets[2]);await image(page,'app-native-starter .companion-image',assets[1]);
  let requested;const requestSeen=new Promise(done=>requested=done),held=new Promise(done=>releasePlayer=done);
  await page.route('**/file/**',async route=>{if(new URL(route.request().url()).pathname.endsWith('/owned-asset-player-1.0.html')){requested();await held;}await route.continue();});
  await page.locator('tc-test-card[data-cy="booklet-OWNED.ASSET.BOOK"] button').click();
  await raceWithSmokeDeadline(requestSeen,20000,()=>{throw Error('Actual Player resource was not requested.');});
  const loading=await image(page,'tc-loading-progress .progress-image',assets[1]);await image(page,'header .logo img',assets[2]);
  await page.screenshot({path:join(out,theme+'-'+width+'-loading.png'),fullPage:false});releasePlayer();releasePlayer=undefined;
  await page.frameLocator('iframe').locator('body[data-started=true]').waitFor();
  await page.unroute('**/file/**');await page.reload();await page.frameLocator('iframe').locator('body[data-started=true]').waitFor();await image(page,'header .logo img',assets[2]);
  await page.goto(base+'/app/native-start?ui=original');await page.locator('app-native-starter').waitFor();await image(page,'header .logo img',assets[2]);await image(page,'app-native-starter .companion-image',assets[1]);
  await page.locator('header .account-button').click();await page.locator('[data-cy=logout-button]').click();await page.locator('[data-cy=dialog-confirm]').click();
  await page.getByRole('textbox',{name:'Anmeldename',exact:true}).waitFor();await image(page,'header .logo img',assets[0]);
  rows.push({theme,width,publicAndAuthenticatedSlots:true,loading,actualOpaquePlayerStarted:true,runReloadRetainsUserImage:true,logoutReturnsGlobalImage:true});checks.push('native-assets-'+theme+'-'+width);await context.close();
 }
 await verifyInputs();
 const downloaded=await Promise.all(responses);for(const row of downloaded){assert.equal(row.status,200);assert.equal(row.sha256,sha(png));}assert.equal(errors.length,0);
 await writeFile(join(out,'result.json'),JSON.stringify({success:true,functionalOnly:true,visualParityProven:false,diagnosticScreenshotsOnly:true,inputFreezeSha256:frozen?sha(await readFile(process.env.NATIVE_ASSET_INPUT_FREEZE)):null,inputFilesVerified:frozen?Object.keys(frozen.hashes).length:null,browser:browser.version(),publicBitmapFormats,rows,checks,wire,downloads:downloaded,errors,wholeOriginalParityProven:false},null,2)+'\n');console.log(JSON.stringify({success:true,cohorts:rows.length,browser:browser.version()}));
}catch(error){const ui=observedPage&&!observedPage.isClosed()?await observedPage.evaluate(()=>({path:location.pathname,inputs:[...document.querySelectorAll('input')].map(n=>({type:n.type,name:n.name,dataCy:n.getAttribute('data-cy'),placeholder:n.placeholder})),alerts:[...document.querySelectorAll('[role=alert]')].map(n=>n.textContent)})).catch(()=>undefined):undefined;if(observedPage&&!observedPage.isClosed())await observedPage.screenshot({path:join(out,'failure.png')}).catch(()=>{});await writeFile(join(out,'failure.json'),JSON.stringify({error:String(error),ui,rows,checks,wire,errors},null,2)+'\n');throw error;}
finally{releasePlayer?.();await browser?.close();if(server)await stopNativeSmokeServer(server);}
}
