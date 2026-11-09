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
import {compareScreenshots} from './exact-rgba-comparison.mjs';
const root=process.env.UI_SMOKE_ARTIFACT_DIR?resolve(process.env.UI_SMOKE_ARTIFACT_DIR):await mkdtemp(join(tmpdir(),'owned-native-assets-ui-'));
if(!isSupervisedSmokeChild(import.meta.url))process.exitCode=await runSupervisedSmoke({entry:fileURLToPath(import.meta.url),artifactDirectory:join(root,'native-assets-supervision'),env:{...process.env,UI_SMOKE_ARTIFACT_DIR:root},phaseTimeoutMs:60000,totalTimeoutMs:240000});
else{
const out=join(root,'native-assets');await mkdir(out,{recursive:true});console.log('owned_artifacts='+out);
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=','base64'),sha=x=>createHash('sha256').update(x).digest('hex');
const slots=['logo','loginIllustration','codeInputIllustration','codeInputCompanion','starterCompanion','starterCardDone','loadingProgress','confirmDialog'];
const frozen=process.env.NATIVE_ASSET_INPUT_FREEZE?JSON.parse(await readFile(process.env.NATIVE_ASSET_INPUT_FREEZE,'utf8')):null;
const verifyInputs=async()=>{if(frozen)for(const [path,hash]of Object.entries(frozen.hashes))assert.equal(sha(await readFile(resolve(path))),hash,path);};
await verifyInputs();
const publicBitmapFormats=[],themeRows=[],monitorThemeRows=[],rows=[],errors=[],wire=[],checks=[],responses=[];let browser,server,releasePlayer,observedPage;
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
 // Authored themes use the same actor and image scope as the real session.
 const themeSourcePath=resolve('test-fixtures/original-testcenter/source-workspace-results/native-login-theme-http/observations.json');
 const themeSourceBytes=await readFile(themeSourcePath),themeSource=JSON.parse(themeSourceBytes);
 assert.equal(themeSource.sourceCommit,'eedae41840cbe90e5547c0211da818bdf620f5aa');assert.equal(themeSource.actualSourceFrontend,true);assert.equal(themeSource.actualSourceBackend,true);assert.deepEqual(themeSource.errors,[]);
 const themeReferences=themeSource.ui.filter(row=>row.loginTheme!==undefined&&!row.mode);assert.equal(themeReferences.length,24);
 await api('POST','/asset-assignments',{assignments:slots.filter(slot=>slot!=='logo').map(slotName=>({slotName,assetID:null}))});
 await upload('booklet.xml',xml('Booklet','<Metadata><Id>OWNED.ASSET.BOOK</Id><Label>Owned Theme Book</Label></Metadata><Units><Unit id="OWNED.ASSET.UNIT" label="Owned asset Unit"/></Units>'));
 await upload('booklet2.xml',xml('Booklet','<Metadata><Id>OWNED.ASSET.BOOK2</Id><Label>Owned Theme Book2</Label></Metadata><Units><Unit id="OWNED.ASSET.UNIT" label="Owned asset Unit"/></Units>'));
 const themeLogins=[null,'Primar','Sekundar','Erwachsene'].map(theme=>'<Login name="owned-theme-'+(theme??'global').toLowerCase()+'" pw="owned-assets-password" mode="run-hot-return"><Booklet codes="c1">OWNED.ASSET.BOOK</Booklet><Booklet codes="c1">OWNED.ASSET.BOOK2</Booklet>'+(theme==='Primar'?'<AssetAssignments>'+assignment('logo',assets[2])+'</AssetAssignments>':'')+(theme?'<ViewSettings><theme>'+theme+'</theme></ViewSettings>':'')+'</Login>').join('');
 const monitorLogin='<Login name="owned-theme-monitor" pw="owned-assets-password" mode="monitor-group"><Profile id="full"/><AssetAssignments>'+assignment('logo',assets[2])+'</AssetAssignments><ViewSettings><theme>Primar</theme></ViewSettings></Login>';
 const themeRoster=roster.replace('<Group id=', '<Profiles><GroupMonitor><Profile id="full" label="Owned" view="full"/></GroupMonitor></Profiles><Group id=').replace('</Group>',themeLogins+monitorLogin+'</Group>').replace('label="Owned asset UI"','label="Owned Theme Group"');await upload('people.xml',themeRoster);await api('POST',prefix+'/participant-roster',{rosterText:themeRoster},false,201);
 const themeReady=async(page,theme,asset,code=false)=>{
  await page.waitForFunction(({theme,url,code})=>{const logo=document.querySelector('header .logo img'),illustration=document.querySelector('app-native-code-login .illustration img');return document.documentElement.dataset.applicationTheme===theme&&logo instanceof HTMLImageElement&&logo.complete&&logo.naturalWidth===1&&logo.src===url&&(!code||illustration instanceof HTMLImageElement&&illustration.complete&&illustration.naturalWidth>0&&new URL(illustration.src).pathname.endsWith('/code-input-illustration-'+(theme==='Sekundar'?'teens':'kids')+'.png'));},{theme,url:base+'/'+asset.url,code});
  await page.evaluate(()=>document.fonts.ready);
  return page.locator('header mat-toolbar').evaluate(n=>({headerColor:getComputedStyle(n).backgroundColor,theme:document.documentElement.dataset.applicationTheme}));
 };
 for(const globalTheme of ['Primar','Sekundar','Erwachsene']){
  await api('PATCH','/api/v1/admin/original-interface/application-settings',{themeName:globalTheme},false);
  for(const loginTheme of [null,'Primar','Sekundar','Erwachsene'])for(const width of [390,1280]){
   const expected=loginTheme??globalTheme,reference=themeReferences.find(row=>row.globalTheme===globalTheme&&row.loginTheme===loginTheme&&row.width===width);assert.ok(reference);
   reportSmokePhase('native-authored-theme-'+globalTheme+'-'+(loginTheme??'global')+'-'+width);
   const context=await browser.newContext({viewport:{width,height:844},locale:'de-DE',timezoneId:'Europe/Berlin'}),page=await context.newPage();observedPage=page;
   page.on('pageerror',error=>errors.push({scope:'authored-themes',globalTheme,loginTheme,width,error:String(error)}));
   try{
    await page.goto(base+'/app/native-start?ui=original');await themeReady(page,globalTheme,assets[0]);
    await page.getByRole('textbox',{name:'Anmeldename',exact:true}).fill('owned-theme-'+(loginTheme??'global').toLowerCase());await page.locator('[data-cy=login-user]').click();
    await page.locator('input[type=password]').fill('owned-assets-password');await page.locator('[data-cy=login-user]').click();await page.locator('tc-code-input').waitFor();
    const actorAsset=assets[loginTheme==='Primar'?2:1],initial=await themeReady(page,expected,actorAsset,true);assert.equal(initial.headerColor,reference.initial.headerColor);assert.equal(await page.locator('header .account-button').count(),0);
    await page.reload();await page.locator('tc-code-input').waitFor();const restored=await themeReady(page,expected,actorAsset,true);assert.equal(restored.headerColor,reference.restored.headerColor);
    const illustration=await page.locator('app-native-code-login .illustration img').evaluate(n=>({path:new URL(n.src).pathname,naturalWidth:n.naturalWidth,naturalHeight:n.naturalHeight}));
    const sourceIllustration=reference.restored.images.find(row=>row.src.includes('code-input-illustration-'));assert.equal(illustration.path.replace(/^\/app(?=\/assets\/)/,''),sourceIllustration.src);assert.equal(illustration.naturalWidth,sourceIllustration.width);
    const stem=globalTheme+'-'+(loginTheme??'global')+'-'+width,codeScreenshot=await page.screenshot({path:join(out,stem+'-code.png'),fullPage:false});
    if(width===1280&&loginTheme==='Sekundar'){
     await page.getByRole('link',{name:'Gehe zur Startseite',exact:true}).click();await page.getByRole('textbox',{name:'Anmeldename',exact:true}).waitFor();await themeReady(page,globalTheme,assets[0]);
     await page.getByRole('textbox',{name:'Anmeldename',exact:true}).fill('owned-theme-sekundar');await page.locator('[data-cy=login-user]').click();await page.locator('input[type=password]').fill('owned-assets-password');await page.locator('[data-cy=login-user]').click();await page.locator('tc-code-input').waitFor();await themeReady(page,expected,actorAsset,true);
    }
    await page.locator('tc-code-input input').fill('c1');await page.locator('tc-code-input input').press('Enter');await page.locator('tc-test-card[data-cy="booklet-OWNED.ASSET.BOOK"]').waitFor();await themeReady(page,expected,actorAsset);
    await page.locator('header .account-button').click();await page.locator('[data-cy=logout-button]').click();const dialog=page.locator('mat-dialog-container');await dialog.locator('[data-cy=dialog-confirm]').waitFor();
    const buttons=await dialog.locator('button').evaluateAll(nodes=>nodes.map(n=>({text:n.textContent.trim(),filled:n.classList.contains('mat-mdc-unelevated-button')})));
    assert.deepEqual(buttons,reference.logout.buttonClasses.map(row=>({text:row.text,filled:row.className.includes('mat-mdc-unelevated-button')})));
    const dialogScreenshot=await dialog.screenshot({path:join(out,stem+'-dialog.png'),animations:'disabled'});
    const visualDiagnostics={};
    if(process.env.NATIVE_THEME_SOURCE_SCREENSHOTS){
     for(const [surface,candidate]of [['code',codeScreenshot],['dialog',dialogScreenshot]]){
      const name=stem+'-'+surface+'.png',source=await readFile(join(process.env.NATIVE_THEME_SOURCE_SCREENSHOTS,name));
      assert.equal(sha(source),themeSource.screenshotHashes[name]);
      try{visualDiagnostics[surface]=await compareScreenshots(page,source,candidate);}catch(error){visualDiagnostics[surface]={comparisonError:String(error)};}
     }
    }
    await dialog.locator('[data-cy=dialog-confirm]').click();await page.getByRole('textbox',{name:'Anmeldename',exact:true}).waitFor();const loggedOut=await themeReady(page,globalTheme,assets[0]);assert.equal(loggedOut.headerColor,reference.loggedOut.headerColor);
    themeRows.push({globalTheme,loginTheme,width,expected,initial,restored,illustration,logoutButtons:buttons,loggedOut,sourceMatched:true,visualDiagnostics});
   }finally{await context.close();}
  }
 }


 for(const entry of ['monitor','participant'])for(const width of [390,1280]){
  reportSmokePhase('native-authored-monitor-theme-'+entry+'-'+width);
  const reference=themeSource.ui.find(row=>row.mode==='monitor-group');assert.ok(reference);
  const context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage();observedPage=page;
  page.on('pageerror',error=>errors.push({scope:'authored-monitor-theme',width,error:String(error)}));
  try{
   await page.goto(base+(entry==='monitor'?'/app/group-monitor':'/app/native-start')+'?ui=original');await themeReady(page,'Erwachsene',assets[0]);
   await page.getByRole('textbox',{name:'Anmeldename',exact:true}).fill('owned-theme-monitor');await page.locator('[data-cy=login-user]').click();await page.locator('input[type=password]').fill('owned-assets-password');await page.locator('[data-cy=login-user]').click();
   await page.locator('app-native-starter').waitFor();const initial=await themeReady(page,'Primar',assets[2]);assert.equal(initial.headerColor,reference.state.headerColor);
   await page.reload();await page.locator('app-native-starter').waitFor();const restored=await themeReady(page,'Primar',assets[2]);assert.equal(restored.headerColor,reference.state.headerColor);
   await page.locator('header .account-button').click();await page.locator('[data-cy=logout-button]').click();const dialog=page.locator('mat-dialog-container');await dialog.locator('[data-cy=dialog-confirm]').waitFor();
   const buttons=await dialog.locator('button').evaluateAll(nodes=>nodes.map(n=>({text:n.textContent.trim(),filled:n.classList.contains('mat-mdc-unelevated-button')})));
   assert.deepEqual(buttons,[{text:'Abmelden',filled:false},{text:'Hier bleiben',filled:false}]);
   await dialog.locator('[data-cy=dialog-confirm]').click();await page.getByRole('textbox',{name:'Anmeldename',exact:true}).waitFor();await themeReady(page,'Erwachsene',assets[0]);
   monitorThemeRows.push({entry,globalTheme:'Erwachsene',loginTheme:'Primar',width,initial,restored,logoutButtons:buttons,sourceMatched:true});
  }finally{await context.close();}
 }

 await verifyInputs();
 const downloaded=await Promise.all(responses);for(const row of downloaded){assert.equal(row.status,200);assert.equal(row.sha256,sha(png));}assert.equal(errors.length,0);
 await writeFile(join(out,'result.json'),JSON.stringify({success:true,functionalOnly:true,visualParityProven:false,diagnosticScreenshotsOnly:true,inputFreezeSha256:frozen?sha(await readFile(process.env.NATIVE_ASSET_INPUT_FREEZE)):null,inputFilesVerified:frozen?Object.keys(frozen.hashes).length:null,browser:browser.version(),publicBitmapFormats,rows,themeRows,monitorThemeRows,themeSourceSha256:sha(themeSourceBytes),checks,wire,downloads:downloaded,errors,wholeOriginalParityProven:false},null,2)+'\n');console.log(JSON.stringify({success:true,cohorts:rows.length,authoredThemeCohorts:themeRows.length,authoredMonitorThemeCohorts:monitorThemeRows.length,browser:browser.version()}));
}catch(error){const ui=observedPage&&!observedPage.isClosed()?await observedPage.evaluate(()=>({path:location.pathname,inputs:[...document.querySelectorAll('input')].map(n=>({type:n.type,name:n.name,dataCy:n.getAttribute('data-cy'),placeholder:n.placeholder})),alerts:[...document.querySelectorAll('[role=alert]')].map(n=>n.textContent)})).catch(()=>undefined):undefined;if(observedPage&&!observedPage.isClosed())await observedPage.screenshot({path:join(out,'failure.png')}).catch(()=>{});await writeFile(join(out,'failure.json'),JSON.stringify({error:String(error),ui,rows,checks,wire,errors},null,2)+'\n');throw error;}
finally{releasePlayer?.();await browser?.close();if(server)await stopNativeSmokeServer(server);}
}
