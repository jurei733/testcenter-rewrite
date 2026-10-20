import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { chromium } from 'playwright';
import { completenessCases, completenessPlayer, legacyCompletenessCase, closeIconMetrics } from './exit-completeness-fixture.mjs';
// Read-only unmodified Source frontend on owned API/player fixtures. The caller
// must verify its revision/build. This does not prove Source backend behavior.
assert.ok(process.env.ORIGINAL_PLAYER_REFERENCE_ROOT);
assert.ok(process.env.ORIGINAL_PLAYER_REFERENCE_COMMIT);
assert.ok(process.env.UI_SMOKE_ARTIFACT_DIR);
const root=resolve(process.env.ORIGINAL_PLAYER_REFERENCE_ROOT), artifacts=resolve(process.env.UI_SMOKE_ARTIFACT_DIR);
await access(join(root,'index.html'));await mkdir(artifacts,{recursive:true});
const {localDemoSourcePackage}=await import('../apps/api/dist/apps/api/src/local-demo-bootstrap.js');
const demo=JSON.parse(localDemoSourcePackage.sourceDocument),completeness=process.env.REFERENCE_COMPLETENESS==='true',unreported=process.env.REFERENCE_UNREPORTED,player=completeness?completenessPlayer(demo.playerEntries[0].html):demo.playerEntries[0].html;
const server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=resolve(root,extname(pathname)?'.'+pathname:'index.html');if(relative(root,file).startsWith('..'))return res.writeHead(404).end();res.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'}[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));const base=`http://127.0.0.1:${server.address().port}`;
const referenceCases=process.env.REFERENCE_LEGACY_PROGRESS==='true'?{legacy:legacyCompletenessCase}:completenessCases;
const errors=[],unknown=[],states={};let browser;
try{
 browser=await chromium.launch({headless:false});
 for(const theme of (process.env.REFERENCE_SINGLE==='true'?['Primar']:['Primar','Sekundar','Erwachsene']))for(const [screen,width,height] of (process.env.REFERENCE_SINGLE==='true'?[['desktop',1280,720]]:[['desktop',1280,720],['mobile',390,844]]))for(const hidden of (completeness||process.env.REFERENCE_SINGLE==='true'?[false]:[false,true]))for(const restriction of (process.env.REFERENCE_SINGLE==='true'?['none']:['none','confirm','forbidden']))for(const progress of unreported?['both']:completeness?Object.keys(referenceCases):['complete']){
  const key=`${theme}-${screen}-${hidden?'hidden':'header'}-${restriction}${completeness?`-${progress}`:''}`,context=await browser.newContext({viewport:{width,height},locale:'de-DE'}),page=await context.newPage(),requests=[];
  page.on('pageerror',error=>errors.push({key,error:String(error)}));
  const auth={token:'owned-player-exit',displayName:'Exit Person',loginName:'exit-person',groupLabel:'Exit Group',flags:[],customTexts:{},groupToken:'owned-exit-group',viewSettings:{theme},claims:{test:[{id:'owned-exit',label:'Logo Testheft',workspaceId:'1',description:'',type:'test',flags:{}}]}};
  const unit='<Unit id="unit-intro" label="Logo Aufgabe"/>',testlet=restriction==='none'?unit:`<Testlet id="timed" label="Zeitblock"><Restrictions><TimeMax minutes="5" leave="${restriction}"/></Restrictions>${unit}</Testlet>`;
  const xml=`<Booklet><Metadata><Id>owned-exit</Id><Label>Logo Testheft</Label></Metadata><BookletConfig>${completeness?`<Config key="force_presentation_complete">${unreported==='response'?'OFF':'ALWAYS'}</Config><Config key="force_response_complete">ALWAYS</Config>`:''}<Config key="header_hidden">${hidden?'TRUE':'FALSE'}</Config><Config key="toolbar_show_unit_list">FALSE</Config><Config key="toolbar_show_fullscreen_button">FALSE</Config><Config key="toolbar_show_reload_button">FALSE</Config><Config key="navbar_unit_label">HIDDEN</Config><Config key="navbar_page_label">HIDDEN</Config><Config key="lock_test_on_termination">OFF</Config></BookletConfig><Units>${testlet}</Units></Booklet>`;
  await context.route(`${base}/api/**`,async route=>{const req=route.request(),pathname=new URL(req.url()).pathname,method=req.method();requests.push({method,pathname,...(req.postData()?{body:req.postDataJSON()}: {})});let body;
   if(pathname==='/api/system/config')body={version:'Rewrite',customTexts:{},appConfig:{themeName:theme,appTitle:'IQB-Testcenter'},veronaPlayerApiVersionMin:2,veronaPlayerApiVersionMax:6,iqbStandardResponseTypeMin:1,iqbStandardResponseTypeMax:5,xmlSchemaVersions:{},bruteForceProtection:[],broadcastingServiceUri:'',fileServiceUri:'',passwordMinLength:0,passwordPattern:''};
   else if(pathname==='/api/sys-check-mode')body=false;
   else if(pathname==='/api/asset-assignments')body={};else if(pathname==='/api/assets')body=[];
   else if(pathname==='/api/session/login'&&method==='PUT'||pathname==='/api/session'&&method==='GET')body=auth;
   else if(pathname==='/api/test'&&method==='PUT')body=1;
   else if(pathname==='/api/test/1'&&method==='GET')body={xml,mode:'run-hot-return',laststate:{},resources:{'UNIT-INTRO':{usesPlayer:['owned-player.html']}},firstStart:false,workspaceId:1,presetBookletStates:{}};
   else if(pathname.startsWith('/api/test/1/unit/unit-intro/alias/')&&method==='GET')body={state:{},dataParts:{},unitResponseType:'owned',definition:demo.bookletEntries[0].unitEntries[0].unitDefinition,definitionType:'application/vnd.testcenter.demo+json'};
   else if(pathname==='/api/file/owned-exit-group/ws_1/owned-player.html'&&method==='GET')return route.fulfill({status:200,contentType:'text/html',body:player});
   else if(pathname==='/api/test/1/commands'&&method==='GET')body=[];
   else if(pathname==='/api/test/1/state'&&method==='PATCH')body='';
   else if(pathname==='/api/test/1/lock'&&method==='PATCH')body=true;
   else if((pathname==='/api/test/1/log'||pathname==='/api/test/1/unit/unit-intro/log'||pathname==='/api/test/1/unit/unit-intro/response')&&method==='PUT')body={};
   else if(pathname==='/api/test/1/unit/unit-intro/state'&&method==='PATCH')body={};
   else{unknown.push({key,method,pathname});return route.fulfill({status:404,body:'{}'});}
   await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });
  await page.goto(`${base}/#/r/login`,{waitUntil:'networkidle'});await page.locator('input[formcontrolname=name]').fill('exit-person');await page.getByRole('button',{name:'Weiter',exact:true}).click();
  await page.waitForURL('**/#/t/1/u/1');await page.frameLocator('iframe').locator('#demoPlayerAnswer').waitFor();await page.evaluate(()=>document.fonts.ready);
  const logo=page.locator('tc-header a');await logo.waitFor();assert.equal(await logo.getAttribute('href'),'#/r/starter');
  const capture=async phase=>{await page.waitForFunction(()=>document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).every(a=>!a.pending&&a.playState!=='running'));await page.screenshot({animations: "disabled", path:join(artifacts,`${key}-${phase}.png`),fullPage:true});return page.evaluate(()=>{const rect=n=>{if(!n)return null;const b=n.getBoundingClientRect(),s=getComputedStyle(n);return{x:b.x,y:b.y,width:b.width,height:b.height,font:s.font,color:s.color,background:s.backgroundColor,padding:s.padding,borderRadius:s.borderRadius};};const dialog=document.querySelector('mat-dialog-container');return{logo:rect(document.querySelector('tc-header a')),logoImage:rect(document.querySelector('tc-header img')),header:rect(document.querySelector('[data-cy=header]')),dialog:dialog?{role:dialog.getAttribute('role'),box:rect(dialog),title:dialog.querySelector('[data-cy=dialog-title],mat-dialog-title,[mat-dialog-title]').textContent,content:dialog.querySelector('[data-cy=dialog-content],[data-cy=deny-navigation-message]').textContent,buttons:[...dialog.querySelectorAll('button')].map(n=>({text:n.textContent.trim(),box:rect(n),classes:n.className}))}:null,activeTag:document.activeElement.tagName};});};
  states[key]={player:await capture('player')};
  if(unreported){
   await logo.click();await page.locator('mat-dialog-container').waitFor();states[key].unreported=await capture('unreported');
   if(unreported==='response'){assert.equal(await page.locator('[data-cy=deny-navigation-message]').count(),0);await page.locator('[data-cy=dialog-cancel]').click();}
   else{assert.equal((await page.locator('[data-cy=deny-navigation-message]').textContent()).trim(),'Es müssen erst alle Audio-Dateien vollständig abgespielt werden und auf allen Seiten bis ganz nach unten gescrollt werden.');await page.locator('[data-cy=close-deny-navigation-message]').click();}
   await page.locator('mat-dialog-container').waitFor({state:'detached'});assert.ok(page.url().includes('/t/1/u/1'));await context.close();console.log(`source_unreported=${unreported}:passed`);continue;
  }
  if(completeness){
   const frame=page.frameLocator('iframe'),values=referenceCases[progress];
   await frame.locator('#demoPlayerAnswer').fill(`Own ${key}\n Ω exact whitespace  `);
   await frame.locator('#exitPresentation').selectOption(values.presentation);await frame.locator('#exitResponse').selectOption(values.response);
   const beforeDenial=requests.length;await logo.click();await page.locator('[data-cy=deny-navigation-message]').waitFor();
   states[key].information=await capture('information');states[key].closeIconMetrics=await page.locator('[data-cy=close-deny-navigation-message]').evaluate(closeIconMetrics);await page.locator('[data-cy=close-deny-navigation-message]').screenshot({animations: "disabled", path:join(artifacts,`${key}-close.png`)});assert.equal(await page.locator('[data-cy=dialog-confirm]').count(),0);
   await page.locator('[data-cy=close-deny-navigation-message]').click();await page.locator('mat-dialog-container').waitFor({state:'detached'});
   assert.ok(page.url().includes('/t/1/u/1'));states[key].deniedRequests=requests.slice(beforeDenial);
   assert.equal(states[key].deniedRequests.some(r=>r.pathname==='/api/test/1/lock'),false);
   await frame.locator('#exitPresentation').selectOption('complete');await frame.locator('#exitResponse').selectOption('complete');
  }
  const before=requests.length;await logo.click();
  if(restriction==='forbidden'){await page.locator('[data-cy^=toast-text-]').filter({hasText:'Es darf erst weiter geblättert werden, wenn die Zeit abgelaufen ist.'}).waitFor();assert.equal(await page.locator('mat-dialog-container').count(),0);states[key].toast=await page.locator('[data-cy^=toast-text-]').filter({hasText:'Es darf erst weiter geblättert werden, wenn die Zeit abgelaufen ist.'}).textContent();assert.ok(page.url().includes('/t/1/u/1'));}
  else{await page.locator('mat-dialog-container').waitFor();states[key].confirmation=await capture('confirmation');await page.locator(`[data-cy=${restriction==='none'?'dialog-cancel':'dialog-confirm'}]`).click();await page.locator('mat-dialog-container').waitFor({state:'detached'});assert.ok(page.url().includes('/t/1/u/1'));states[key].cancelledRequests=requests.slice(before);await logo.click();await page.locator('mat-dialog-container').waitFor();await page.locator(`[data-cy=${restriction==='none'?'dialog-confirm':'dialog-cancel'}]`).click();await page.waitForURL('**/#/r/starter');states[key].confirmedRequests=requests.slice(before);}
  await context.close();console.log(`source_player_exit=${key}:passed`);
 }
 assert.deepEqual(unknown,[]);assert.deepEqual(errors,[]);
}finally{await writeFile(join(artifacts,'exit.json'),JSON.stringify({states,unknown,errors,callerVerifiedReferenceCommit:process.env.ORIGINAL_PLAYER_REFERENCE_COMMIT,scope:'Unmodified Source frontend on owned API/player fixtures; no Source backend authorization proof'},null,2));await browser?.close();await new Promise(done=>server.close(done));}
