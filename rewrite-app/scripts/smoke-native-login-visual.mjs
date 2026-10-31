import assert from 'node:assert/strict';
import {monitorVisualRuntimeMaterial} from './native-monitor-visual-runtime.mjs';

import {createRequire} from 'node:module';
import {spawn,execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir,readdir,realpath,mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {resolve,join,extname,relative} from 'node:path';
import {pathToFileURL} from 'node:url';
const app=process.cwd(),selfControl=process.argv[2]==='source-self-control',entry=process.env.NATIVE_LOGIN_ENTRY??'monitor';assert.ok(['monitor','participant'].includes(entry));
assert.ok(process.argv[2]===undefined||selfControl||process.argv[2]==='rewrite','Expected source-self-control or rewrite');
const loginState=process.env.NATIVE_LOGIN_SCENE??'empty';assert.ok(['empty','name-filled','password','password-filled','password-visible','password-back','password-error','password-rate-limit'].includes(loginState));const scene='native-login-'+entry+'-'+loginState;assert.ok(process.argv.length<=3,'Unexpected native login visual arguments');
assert.ok(process.env.UI_SMOKE_ARTIFACT_DIR&&process.env.ORIGINAL_BROWSER_REFERENCE_ROOT);
const out=resolve(process.env.UI_SMOKE_ARTIFACT_DIR),root=await realpath(process.env.ORIGINAL_BROWSER_REFERENCE_ROOT);
assert.ok(relative(app,out).startsWith('..'),'Visual evidence must stay outside the source checkout');
assert.ok(relative(root,out).startsWith('..'),'Original build is read-only during capture');
if(process.env.CI==='true'){assert.equal(process.env.UI_SMOKE_HEADFUL,'true');assert.equal(process.env.UI_SMOKE_BROWSER_CHANNEL,undefined,'Native Linux qualification uses the exact locked Chromium');}
const head=execFileSync('git',['-C',app,'rev-parse','HEAD'],{encoding:'utf8'}).trim();
assert.equal(execFileSync('git',['-C',app,'status','--porcelain'],{encoding:'utf8'}).trim(),'','Only a clean candidate may be qualified');
if(process.env.GITHUB_ACTIONS==='true')assert.equal(process.env.GITHUB_SHA,head);else process.env.GITHUB_SHA=head;
const sourceSnapshot=async()=>{
 const walk=async path=>{const rows=[];for(const entry of await readdir(join(app,path),{withFileTypes:true})){const next=path+'/'+entry.name;if(entry.isDirectory())rows.push(...await walk(next));else rows.push([next,createHash('sha256').update(await readFile(join(app,next))).digest('hex')]);}return rows;};
 return Object.fromEntries(await walk('apps/web/src'));
};
const sourceHashes=await sourceSnapshot();
await mkdir(out);const require=createRequire(join(app,'package.json'));
const mod=async name=>import(pathToFileURL(require.resolve(name)).href);
const {chromium}=require('playwright'),{createFirstSliceServices}=await mod('@testcenter-rewrite-app/application'),{createSqliteFirstSliceStorage}=await mod('@testcenter-rewrite-app/sqlite-store');
const {productionApiRoutes}=await mod('@testcenter-rewrite-app/contracts');
const {prepareOriginalXmlSchemaValidator}=await import(pathToFileURL(join(app,'packages/application/dist/packages/application/src/original-xml-schema.js')));
const {verifyOriginalBuild}=await import(pathToFileURL(join(app,'scripts/original-browser-reference.mjs')));
const {captureStableViewport}=await import(pathToFileURL(join(app,'scripts/stable-viewport-capture.mjs')));
const {compareScreenshots}=await import(pathToFileURL(join(app,'scripts/exact-rgba-comparison.mjs')));
const {readNativeSmokeResponse,stopNativeSmokeServer}=await import(pathToFileURL(join(app,'scripts/native-monitor-smoke-io.mjs')));
const manifest=await verifyOriginalBuild(root);
// Keep the owned fixture database outside the published evidence directory.
const storeRoot=await mkdtemp(join(tmpdir(),'owned-native-monitor-visual-'));
try{
const file=join(storeRoot,'store.sqlite'),storage=createSqliteFirstSliceStorage(file),validator=await prepareOriginalXmlSchemaValidator(process.env.FIRST_SLICE_XML_SCHEMA_CACHE??join(app,'.data/original-xml-schemas'),false),services=createFirstSliceServices({repository:storage.repository,originalXmlSchemaValidator:validator,xmlSchemaProfile:'original-19'});
const group='OWNED.PARITY',name='owned-parity-monitor',password='Owned parity password';
// Each rejected final-password flow gets its own real actor; the production retry limiter stays enabled.
const errorActors=['desktop-source','desktop-rewrite','mobile-source','mobile-rewrite'].map(id=>'owned-error-'+id);
const xml=(type,body)=>`<${type} xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/${type==='Unit'?'unit-xml/17.6':type==='Booklet'?'testcenter-booklet-xml/18.0':'testcenter-testtaker-xml/18.0'}">${body}</${type}>`;
const t=await services.platform.createTenant({tenantKey:'owned-parity',displayName:'Owned parity'}),w=await services.platform.createWorkspace({tenantKey:t.tenantKey,workspaceKey:'owned',displayName:'Owned parity'}),scope={tenantKey:t.tenantKey,workspaceKey:w.workspaceKey};
const upload=(fileName,sourceDocument,mediaType='application/xml')=>services.contentIntake.uploadWorkspaceFile({...scope,fileName,sourceDocument,mediaType});
await upload('player.html','<html><script type="application/ld+json">'+JSON.stringify({id:'owned-player',version:'1.2.3',specVersion:'6.0',metadataVersion:'2.0',type:'player',name:[{lang:'de',value:'Owned Player'}]})+'</script><main>Owned</main></html>','text/html');
await upload('unit.xml',xml('Unit','<Metadata><Id>OWNED.UNIT</Id><Label>Owned Unit</Label></Metadata><Definition player="owned-player@1.2.3">Owned</Definition>'));
await upload('booklet.xml',xml('Booklet','<Metadata><Id>OWNED.BOOK</Id><Label>Owned Monitor Booklet</Label></Metadata><Units><Testlet id="B1" label="Owned Block"><Restrictions><TimeMax minutes="10"/></Restrictions><Unit id="OWNED.UNIT" label="Owned Unit"/></Testlet></Units>'));
await services.workspaceAdminRead.importParticipantRoster({...scope,rosterText:xml('Testtakers','<Metadata/><Group id="'+group+'" label="Owned Monitor Group"><Login name="'+name+'" pw="'+password+'" mode="monitor-group"/>'+errorActors.map(actor=>'<Login name="'+actor+'" pw="'+password+'" mode="monitor-group"/>').join('')+'<Login name="owned-alpha" mode="run-hot-return"><Booklet>OWNED.BOOK</Booklet></Login><Login name="owned-beta" mode="run-hot-return"><Booklet>OWNED.BOOK</Booklet></Login></Group>')});
for(const person of ['owned-alpha','owned-beta']){const a=await services.originalSession.login({name:person,password:''}),id=await services.originalTest.create({token:a.token,bookletName:'OWNED.BOOK'});await services.originalTest.read({token:a.token,testNumber:id});await services.originalTest.patchState({token:a.token,testNumber:id,patch:[{key:'CURRENT_UNIT_ID',content:'OWNED.UNIT',timeStamp:100},{key:'CONTROLLER',content:'RUNNING',timeStamp:101},{key:'CONNECTION',content:'POLLING',timeStamp:102}]});await services.originalUnit.patchState({token:a.token,testNumber:id,unitName:'OWNED.UNIT',body:{newState:[{key:'PRESENTATION_PROGRESS',content:'some',timeStamp:103}]}});}
await storage.shutdown();
let server,browser,sourceServer;const pages=[],surfaces=[],errors=[],unknown=[],requests=[],captureFailures=[];let base;
try{
 const serverModule=pathToFileURL(join(app,'apps/api/dist/apps/api/src/index.js')).href;
 server=spawn(process.execPath,['--input-type=module','-e',`import {createProductionApiServer} from ${JSON.stringify(serverModule)};import {bindNativeSmokeServerOwner} from ${JSON.stringify(pathToFileURL(join(app,'scripts/native-monitor-smoke-io.mjs')).href)};const s=await createProductionApiServer();bindNativeSmokeServerOwner(s);s.listen(0,'127.0.0.1',()=>process.send({port:s.address().port}));`],{cwd:app,stdio:['ignore','ignore','inherit','ipc'],env:{...process.env,FIRST_SLICE_STORE:'sqlite',FIRST_SLICE_SQLITE_FILE:file,FIRST_SLICE_BOOTSTRAP_DEMO:'false',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',FIRST_SLICE_XML_SCHEMA_PROFILE:'original-19',FIRST_SLICE_PROOF_OF_WORK_SCOPES:'',REQUIRE_LOGIN_PASSWORD:'false'}});
 const port=await new Promise((done,reject)=>{const timeout=setTimeout(()=>reject(Error('API startup deadline')),20000);server.once('message',m=>{clearTimeout(timeout);done(m.port);});server.once('exit',()=>{clearTimeout(timeout);reject(Error('API exited before ready'));});});base='http://127.0.0.1:'+port;
 const native=async(method,path,body,token)=>{const r=await readNativeSmokeResponse(base+path,{method,headers:{...(token?{AuthToken:token}:{}),...(body===undefined?{}:{'Content-Type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});assert.ok(r.ok,method+' '+path+' '+r.status);return r.text?JSON.parse(r.text):null;};
 const emptyProbe=await readNativeSmokeResponse(base+'/session/login',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,password:''})});assert.equal(emptyProbe.status,400,'The owned protected Login must reject its known empty password before the browser password-step control');
 const auth=await native('PUT','/session/login',{name,password});assert.ok(auth.token);
 if(loginState==='password-rate-limit'){const rateControls=[];for(const actor of errorActors){let blocked=false;const statuses=[];for(let i=0;i<20;i++){const response=await readNativeSmokeResponse(base+'/session/login',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:actor,password:'Wrong owned password'})});statuses.push(response.status);assert.ok([400,429].includes(response.status));if(response.status===429){blocked=true;break;}}assert.ok(blocked,'Actual production limiter must block this actor');const correct=await readNativeSmokeResponse(base+'/session/login',{method:'PUT',headers:{'Content-Type':'application/json'},body:JSON.stringify({name:actor,password})});assert.equal(correct.status,429,'Correct credentials must remain blocked during the active production lockout');rateControls.push({actor,statuses,validPasswordStillBlocked:correct.status});}await writeFile(join(out,'actual-rate-limit-controls.json'),JSON.stringify(rateControls,null,2));}
const settings=(await native('GET',productionApiRoutes.system.getApplicationSettings)).applicationSettings;
 const snapshot=await native('GET','/monitor/group/'+group+'/test-sessions',undefined,auth.token);await writeFile(join(out,'snapshot.json'),JSON.stringify(snapshot,null,2));
 sourceServer=createServer(async(req,res)=>{try{const path=new URL(req.url,'http://localhost').pathname;
  if(path.startsWith('/api/')){let value;
   if(path==='/api/system/config')value={version:'Rewrite',customTexts:{},appConfig:settings,veronaPlayerApiVersionMin:2,veronaPlayerApiVersionMax:6,iqbStandardResponseTypeMin:1,iqbStandardResponseTypeMax:5,xmlSchemaVersions:{},bruteForceProtection:[],broadcastingServiceUri:'',fileServiceUri:'',passwordMinLength:0,passwordPattern:''};
   else if(path==='/api/sys-check-mode')value=false;else if(path==='/api/asset-assignments')value={};else if(path==='/api/assets')value=[];
   if(value!==undefined){res.writeHead(200,{'Content-Type':'application/json'}).end(JSON.stringify(value));return;}
   const chunks=[];for await(const b of req)chunks.push(b);const body=Buffer.concat(chunks);const h={};for(const key of ['authtoken','accept','content-type'])if(req.headers[key])h[key]=req.headers[key];
   const r=await fetch(base+path.slice(4),{method:req.method,headers:h,...(body.length?{body}:{}),signal:AbortSignal.timeout(20000)});requests.push({side:'source',method:req.method,path,status:r.status});if(!r.ok)if(!(path==='/api/session/login'&&r.status===(loginState==='password-rate-limit'?429:400)&&loginState.startsWith('password')&&(()=>{try{const value=JSON.parse(body.toString());return (loginState==='password-rate-limit'?errorActors.includes(value.name)&&(value.password===''||value.password==='Wrong owned password'):(loginState==='password-error'?errorActors.includes(value.name)&&(value.password===''||value.password==='Wrong owned password'):value.name===name&&value.password===''))&&Object.keys(value).sort().join(',')==='name,password';}catch{return false;}})()))unknown.push({path,status:r.status});res.writeHead(r.status,{'Content-Type':r.headers.get('content-type')??'application/json'}).end(Buffer.from(await r.arrayBuffer()));return;
  }
  const asset=['.html','.js','.css','.svg','.png','.woff2','.ico','.txt','.json'].includes(extname(path));const file=resolve(root,asset?'.'+path:'index.html');assert.ok(!relative(root,file).startsWith('..'));res.setHeader('Content-Type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.png':'image/png','.woff2':'font/woff2','.ico':'image/x-icon'}[extname(file)]??'application/octet-stream');res.end(await readFile(file));
 }catch(error){unknown.push({error:String(error),url:req.url});res.writeHead(404).end();}});
 await new Promise(done=>sourceServer.listen(0,'127.0.0.1',done));const originalBase='http://127.0.0.1:'+sourceServer.address().port;
 browser=await chromium.launch({...(process.env.UI_SMOKE_BROWSER_CHANNEL?{channel:process.env.UI_SMOKE_BROWSER_CHANNEL}:{}),headless:false});
 const browserSession=await browser.newBrowserCDPSession();const system=await browserSession.send('SystemInfo.getInfo');await browserSession.detach();
 await writeFile(join(out,'graphics-context.json'),JSON.stringify({defaultBrowserArguments:true,diagnosticOnly:process.env.GITHUB_ACTIONS!=='true',launchArgs:[],headful:true,gpu:system.gpu},null,2));
 if(process.env.GITHUB_ACTIONS==='true'){const bundle=JSON.parse(await readFile(join(process.env.RUNNER_TEMP,'browser-system/manifest.json'),'utf8'));const reference=monitorVisualRuntimeMaterial(bundle);assert.equal(browser.version(),reference.material.browserVersion);await writeFile(join(out,'runtime-reference.json'),JSON.stringify({bundleVersion:bundle.version,bundleContext:bundle.context,oracleContext:reference.context,materialSha256:reference.materialSha256},null,2));}
 const comparisons={};const now=Date.now();
 for(const [screen,width,height]of [['desktop',1280,720],['mobile',390,844]]){
  const captures={},animationSpecs={};
  for(const side of ['source','rewrite']){
   const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,locale:'de-DE',timezoneId:'Europe/Berlin',serviceWorkers:'block'}),page=await context.newPage();pages.push({page,side,screen});await page.bringToFront();
   await page.clock.setFixedTime(now);page.on('pageerror',error=>errors.push({side,screen,error:String(error)}));
   const navigation=await page.goto(side==='source'||selfControl?originalBase+'/':base+(entry==='participant'?'/app/native-start?ui=original':'/app/group-monitor?ui=original'),{waitUntil:'networkidle'});
   assert.equal(navigation.status(),200);const documentBytes=await navigation.body();await writeFile(join(out,screen+'-'+side+'-document.html'),documentBytes);
   surfaces.push({side,screen,origin:new URL(page.url()).origin,path:new URL(page.url()).pathname,documentSha256:createHash('sha256').update(documentBytes).digest('hex')});
   await page.locator('.login-section form input').first().waitFor();await page.evaluate(()=>document.fonts.ready);
   if(loginState!=='empty'){
    await page.locator('.login-section form input').first().fill(['password-error','password-rate-limit'].includes(loginState)?'owned-error-'+screen+'-'+side:name);
    if(loginState.startsWith('password')){
     await page.locator('[data-cy=login-user]').click();await page.locator('.login-section input[type=password]').waitFor();
     if(loginState!=='password')await page.locator('.login-section input[type=password]').fill(password);
     if(['password-error','password-rate-limit'].includes(loginState)){await page.locator('.login-section input[type=password]').fill('Wrong owned password');const rejected=page.waitForResponse(response=>new URL(response.url()).pathname.endsWith('/session/login')&&response.request().method()==='PUT');await page.locator('[data-cy=login-user]').click();const expected=loginState==='password-rate-limit'?429:400;assert.equal((await rejected).status(),expected);await page.locator('[data-cy="login-problem:'+expected+'"]').waitFor();}
     if(loginState==='password-visible')await page.locator('.mat-mdc-form-field-icon-suffix button').click();if(loginState==='password-back'){await page.locator('.password-headline button').click();await page.locator('.login-section form input[type=password]').waitFor({state:'detached'});}
    }
   }
   await page.mouse.move(1,1);
   await page.waitForFunction(()=>document.getAnimations().every(a=>!Number.isFinite(a.effect?.getTiming().iterations)||a.playState==='finished'),{},{timeout:2000});
   await writeFile(join(out,screen+'-'+side+'-scene.json'),JSON.stringify({scene,authenticated:false,entryState:await page.evaluate(()=>{const field=document.querySelector('.login-section form input'),eye=document.querySelector('.mat-mdc-form-field-icon-suffix button');return {focusedInput:document.activeElement===field,inputType:field?.type,inputValueLength:field?.value.length,autofocus:field?.hasAttribute('autofocus'),visibilityPressed:eye?.getAttribute('aria-pressed')??null};}),text:await page.locator('body').innerText()},null,2));
   const inspectLayout=()=>page.evaluate(()=>{
    const box=e=>{const b=e?.getBoundingClientRect();return b?{x:b.x,y:b.y,width:b.width,height:b.height}:null;};
    const selectors=['.help-box','.help-box mat-icon','.help-box mat-card-content','app-root','tc-root','app-native-monitor-entry','app-native-participant-entry','.button-section button','.mdc-notched-outline__leading','.mdc-notched-outline__notch','.mdc-notched-outline__trailing','.mdc-floating-label','.mat-mdc-text-field-wrapper','.mdc-button__ripple','.login-page','.welcome-section','.login-section','.login-section form','.login-section h2','.button-section','.login-section form button','.login-section input','tc-footer','footer','.cdk-overlay-pane','.mat-mdc-dialog-container','.mat-mdc-dialog-title','.mat-mdc-dialog-content','.mat-mdc-dialog-actions','input','#setTimer','h2[mat-dialog-title]','[data-cy=dialog-confirm]','[data-cy=dialog-cancel]','.mat-mdc-menu-panel','.mat-mdc-menu-item','.mat-mdc-menu-submenu-icon','[data-cy=GM_forward_button]','[data-cy=GM_pause_button]','[data-cy=GM_end_button]','[data-cy=account-button]','html','body','[data-cy=header] h1','.mat-drawer-container','.mat-drawer-content','tc-test-session:first-of-type td','tc-test-session:first-of-type h1','tc-test-session:first-of-type .units','tc-test-session:first-of-type .testlet','tc-test-session:first-of-type .unit','tc-test-session:first-of-type mat-icon'];
    const diagnostic=selector=>[...document.querySelectorAll(selector)].map(e=>{const c=getComputedStyle(e);return {tag:e.tagName,classes:e.className?.baseVal??e.className,box:box(e),text:e.textContent.trim().slice(0,150),css:Object.fromEntries(['color','-webkit-text-fill-color','-webkit-font-smoothing','text-rendering','color-scheme','color-interpolation','border','border-width','border-color','border-style','border-top-left-radius','border-top-right-radius','border-bottom-left-radius','border-bottom-right-radius','background-clip','outline','gap','font-family','font-size','font-weight','font-style','letter-spacing','line-height','font-variation-settings','box-sizing','background-color','display','margin','padding','width','min-width','vertical-align','height','box-shadow','border-radius','filter','transform','will-change','opacity','position','isolation','overflow','contain'].map(k=>[k,c.getPropertyValue(k)]))};});
    return {viewport:[innerWidth,innerHeight],scroll:[scrollX,scrollY],document:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],header:box(document.querySelector('[data-cy=header]')),rows:[...document.querySelectorAll('tc-test-session')].map(e=>({box:box(e),text:e.textContent,classes:e.className})),diagnostics:Object.fromEntries(selectors.map(selector=>[selector,diagnostic(selector)]))};
   });
   const measure=async()=>{const {diagnostics,...geometry}=await inspectLayout();return geometry;};
   const animationSpec=await page.evaluate(()=>document.getAnimations().map(a=>({name:a.animationName,iterations:String(a.effect?.getTiming().iterations),playState:a.playState})));assert.deepEqual(animationSpec,[],'Static login must retain no authored animation');
   captures[side]={};comparisons[screen]??={};
   for(const phase of [0,1250,2500,3750]){

    const path=join(out,screen+'-'+side+'-'+phase+'.png');let capture;try{capture=await captureStableViewport(page,measure,path);}catch(error){captureFailures.push({side,screen,phase,error:String(error),geometry:await measure(),animations:await page.evaluate(()=>document.getAnimations().filter(a=>a.effect?.target?.matches('.connection-status')).map(a=>({state:a.playState,currentTime:a.currentTime})))});continue;}captures[side][phase]=capture.bytes;

    await writeFile(join(out,screen+'-'+side+'-'+phase+'.json'),JSON.stringify({geometry:capture.geometry,diagnostics:(await inspectLayout()).diagnostics,paint:capture.paintDiagnostics,animationSpec,phase},null,2));console.log('captured='+screen+'-'+side+'-'+phase);
    if(side==='rewrite'&&captures.source[phase])comparisons[screen][phase]=await compareScreenshots(page,captures.source[phase],capture.bytes);
   }
   await context.close();
  }
 }
 assert.deepEqual(await sourceSnapshot(),sourceHashes,'No candidate source may change during visual capture');await verifyOriginalBuild(root);assert.equal(execFileSync('git',['-C',app,'status','--porcelain'],{encoding:'utf8'}).trim(),'','Candidate must remain clean');assert.deepEqual(errors,[]);assert.deepEqual(unknown,[]);await writeFile(join(out,'result.json'),JSON.stringify({success:captureFailures.length===0,exactParity:captureFailures.length===0&&Object.values(comparisons).flatMap(Object.values).length===8&&Object.values(comparisons).flatMap(Object.values).every(v=>v.differingPixels===0),browser:browser.version(),scene,diagnosticOnly:process.env.GITHUB_ACTIONS!=='true',nativeLinuxMeasurement:process.env.GITHUB_ACTIONS==='true',launchArgs:[],candidate:{head:process.env.GITHUB_SHA,sourceHashes,dirty:execFileSync('git',['-C',app,'status','--porcelain'],{encoding:'utf8'}).trim(),diffSha256:createHash('sha256').update(execFileSync('git',['-C',app,'diff','--binary'])).digest('hex')},manifest,surfaces,comparisons,captureFailures,errors,unknown,requests,comparisonKind:selfControl?'Original-vs-Original':'Original-vs-Rewrite',hasRewriteSurface:!selfControl,productionAdmission:false,scope:'Default headed browser; locked Chromium on actual native Linux in CI. Unmodified pinned Original frontend against an owned real native API and owned bootstrap config DTO. Owned real active rate-limit login scene; actual production limiter and correct-password lockout are retained. Seven other static name/password/visibility/back/rejected-password scenes on both native entry routes; four repeated static captures per viewport, not authored gradient phases. Source backend and complete Original entry behavior are not qualified.'},null,2));console.log(JSON.stringify({comparisons,errors,unknown}));assert.equal(surfaces.length,4);if(!selfControl)for(const screen of ['desktop','mobile']){const a=surfaces.find(s=>s.screen===screen&&s.side==='source'),b=surfaces.find(s=>s.screen===screen&&s.side==='rewrite');assert.notEqual(a.origin,b.origin);assert.notEqual(a.documentSha256,b.documentSha256,'The rewrite must use its own real compiled document');}
 assert.deepEqual(captureFailures,[],'Every complete native frame must stabilize');assert.equal(Object.values(comparisons).flatMap(Object.values).length,8);assert.ok(Object.values(comparisons).flatMap(Object.values).every(value=>value.differingPixels===0),'All eight full native viewport comparisons must be exactly RGBA-identical');
}catch(error){for(const {page,side,screen}of pages)if(!page.isClosed()){await page.screenshot({path:join(out,screen+'-'+side+'-failure.png')}).catch(()=>{});await writeFile(join(out,screen+'-'+side+'-failure.html'),await page.content().catch(()=>''));}await writeFile(join(out,'failure.json'),JSON.stringify({error:String(error),errors,unknown,requests},null,2));throw error;}
finally{try{await browser?.close();}finally{if(sourceServer){sourceServer.closeAllConnections();await new Promise(done=>sourceServer.close(done));}if(server)await stopNativeSmokeServer(server);}}

}finally{await rm(storeRoot,{recursive:true,force:true});}
