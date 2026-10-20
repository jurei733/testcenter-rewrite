import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { chromium } from 'playwright';
import { playerVersionErrorPlayer } from './player-version-error-fixture.mjs';
// Read-only unmodified Source frontend on owned API/player fixtures. The caller
// must verify its revision/build. This does not prove Source backend behavior.
assert.ok(process.env.ORIGINAL_PLAYER_REFERENCE_ROOT);
assert.ok(process.env.ORIGINAL_PLAYER_REFERENCE_COMMIT);
assert.ok(process.env.UI_SMOKE_ARTIFACT_DIR);
const root=resolve(process.env.ORIGINAL_PLAYER_REFERENCE_ROOT), artifacts=resolve(process.env.UI_SMOKE_ARTIFACT_DIR);
await access(join(root,'index.html'));await mkdir(artifacts,{recursive:true});
const {localDemoSourcePackage}=await import('../apps/api/dist/apps/api/src/local-demo-bootstrap.js');
const demo=JSON.parse(localDemoSourcePackage.sourceDocument);
const variant=process.env.ORIGINAL_PLAYER_VERSION_ERROR;
assert.ok(['missing','unsupported'].includes(variant));
const runtimePlayer=playerVersionErrorPlayer(demo.playerEntries[0].html,variant);
const expectedTitle=variant==='missing'?'Unbekannte Verona-Version':'Unpassende Verona-Version';
const expectedDescription=variant==='missing'?'Player did not report its Verona version (apiVersion or metadata.specVersion)':
 'Player uses Verona 9.0, but this testcenter only support \n              2 to 6';
const server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=resolve(root,extname(pathname)?'.'+pathname:'index.html');if(relative(root,file).startsWith('..'))return res.writeHead(404).end();res.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'}[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));const base=`http://127.0.0.1:${server.address().port}`;
const errors=[],unknown=[],states={};let browser;
try{
 browser=await chromium.launch({headless:false});
 for(const theme of ['Primar','Sekundar','Erwachsene'])
 for(const [screen,width,height] of [['desktop',1280,720],['mobile',390,844]]) {
  const mode='run-hot-return',restriction='forbidden',silent=false;
  const scope='unit',lockConfirm=true,hidden=false,lockOnTermination=false;
  const key=`${variant}-${mode}-${theme}-${screen}-${restriction}-${silent}`,context=await browser.newContext({viewport:{width,height},locale:'de-DE'}),page=await context.newPage(),requests=[];
  page.on('pageerror',error=>errors.push({key,error:String(error)}));
  let pauseRequested=false;
  const auth={token:'owned-player-exit',displayName:'exit-person',loginName:'exit-person',groupLabel:'Exit Group',flags:[],customTexts:{},groupToken:'owned-exit-group',viewSettings:{theme},claims:{test:[{id:'owned-exit',label:'Logo Testheft',workspaceId:'1',description:'',type:'test',flags:{}}]}};
  const unit='<Unit id="unit-intro" label="Logo Aufgabe"/>',testlet=restriction==='none'?unit:`<Testlet id="timed" label="Zeitblock"><Restrictions><TimeMax minutes="5" leave="${restriction}"/><LockAfterLeaving scope="${scope}" confirm="${lockConfirm}"/></Restrictions>${unit}</Testlet>`;
  const xml=`<Booklet><Metadata><Id>owned-exit</Id><Label>Logo Testheft</Label></Metadata><BookletConfig><Config key="silent_mode">${silent?'TRUE':'FALSE'}</Config><Config key="force_presentation_complete">ALWAYS</Config><Config key="force_response_complete">ALWAYS</Config><Config key="header_hidden">${hidden?'TRUE':'FALSE'}</Config><Config key="toolbar_show_unit_list">FALSE</Config><Config key="toolbar_show_fullscreen_button">FALSE</Config><Config key="toolbar_show_reload_button">FALSE</Config><Config key="navbar_unit_label">HIDDEN</Config><Config key="navbar_page_label">HIDDEN</Config><Config key="lock_test_on_termination">${lockOnTermination?'ON':'OFF'}</Config></BookletConfig><Units>${testlet}</Units></Booklet>`;
  await context.route(`${base}/api/**`,async route=>{const req=route.request(),pathname=new URL(req.url()).pathname,method=req.method();requests.push({method,pathname,...(req.postData()?{body:req.postDataJSON()}: {})});let body;
   if(pathname==='/api/system/config')body={version:'Rewrite',customTexts:{},appConfig:{themeName:theme,appTitle:'IQB-Testcenter'},veronaPlayerApiVersionMin:2,veronaPlayerApiVersionMax:6,iqbStandardResponseTypeMin:1,iqbStandardResponseTypeMax:5,xmlSchemaVersions:{},bruteForceProtection:[],broadcastingServiceUri:'',fileServiceUri:'',passwordMinLength:0,passwordPattern:''};
   else if(pathname==='/api/sys-check-mode')body=false;
   else if(pathname==='/api/asset-assignments')body={};else if(pathname==='/api/assets')body=[];
   else if(pathname==='/api/session/login'&&method==='PUT'||pathname==='/api/session'&&method==='GET')body=auth;
   else if(pathname==='/api/test'&&method==='PUT')body=1;
   else if(pathname==='/api/test/1'&&method==='GET')body={xml,mode,laststate:{},resources:{'UNIT-INTRO':{usesPlayer:['owned-player.html']}},firstStart:false,workspaceId:1,presetBookletStates:{}};
   else if(pathname.startsWith('/api/test/1/unit/unit-intro/alias/')&&method==='GET')body={state:{},dataParts:{},unitResponseType:'owned',definition:demo.bookletEntries[0].unitEntries[0].unitDefinition,definitionType:'application/vnd.testcenter.demo+json'};
   else if(pathname==='/api/file/owned-exit-group/ws_1/owned-player.html'&&method==='GET')return route.fulfill({status:200,contentType:'text/html',body:runtimePlayer});
   else if(pathname==='/api/test/1/connection-lost'&&method==='POST')body={};
   else if(pathname==='/api/test/1/commands'&&method==='GET')body=pauseRequested?[{id:1,timestamp:Date.now(),keyword:'pause',arguments:[]}]:[];
   else if(pathname==='/api/test/1/command/1/executed'&&method==='PATCH')body={};
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
  const capture=async phase=>{
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForFunction(()=>document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).every(a=>!a.pending&&a.playState!=='running'));
    await page.screenshot({animations: "disabled", path:join(artifacts,`${key}-${phase}.png`),fullPage:true});
    return page.evaluate(()=>{
      const read=n=>{if(!n)return null;const b=n.getBoundingClientRect(),s=getComputedStyle(n);return{x:b.x,y:b.y,width:b.width,height:b.height,font:s.font,color:s.color,background:s.backgroundColor,padding:s.padding,margin:s.margin,borderRadius:s.borderRadius,boxShadow:s.boxShadow};};
      const dialog=document.querySelector('mat-dialog-container');
      return {url:location.href,activeTag:document.activeElement.tagName,activeRole:document.activeElement.getAttribute('role'),bodyText:document.body.innerText,iframeCount:document.querySelectorAll('iframe').length,cardCount:document.querySelectorAll('mat-card').length,
        dialog:dialog?{role:dialog.getAttribute('role'),box:read(dialog),title:dialog.querySelector('[mat-dialog-title]').textContent.trim(),titleBox:read(dialog.querySelector('[mat-dialog-title]')),content:dialog.querySelector('mat-dialog-content,[mat-dialog-content]').textContent.trim(),introText:dialog.querySelector('mat-dialog-content > p').textContent.trim(),contentBox:read(dialog.querySelector('mat-dialog-content,[mat-dialog-content]')),expansion:read(dialog.querySelector('mat-expansion-panel')),icon:read(dialog.querySelector('mat-icon')),actions:read(dialog.querySelector('mat-dialog-actions')),buttons:[...dialog.querySelectorAll('button')].map(n=>({text:n.textContent.trim(),box:read(n),classes:n.className}))}:null};
    });
  };
  await page.locator('mat-dialog-container').waitFor();
  states[key]={collapsed:await capture('collapsed'),requests};
  assert.equal(states[key].collapsed.iframeCount,1);
  assert.equal(states[key].collapsed.dialog.title,expectedTitle);
  assert.equal(states[key].collapsed.cardCount,0);
  assert.equal(states[key].collapsed.activeRole,'dialog');
  await page.keyboard.press('Escape');assert.equal(await page.locator('mat-dialog-container').count(),1);
  await page.locator('.cdk-overlay-backdrop').click({position:{x:5,y:5}});assert.equal(await page.locator('mat-dialog-container').count(),1);
  await page.getByRole('button',{name:'Fehlerdetails',exact:true}).click();
  states[key].expanded=await capture('expanded');
  const description=await page.locator('mat-expansion-panel h3 + p').textContent();
  assert.equal(description,expectedDescription);
  states[key].errorDescription=description;
  const address=page.url();
  await page.locator('[data-cy=close]').click();
  await page.waitForLoadState('networkidle');
  await page.locator('mat-dialog-container').waitFor();
  states[key].reloaded=await capture('reloaded');
  assert.equal(page.url(),address);
  assert.equal(states[key].reloaded.dialog.title,expectedTitle);
  assert.equal(states[key].reloaded.iframeCount,1);
  await context.close();console.log(`source_player_version_error=${key}:passed`);
 }
 assert.deepEqual(unknown,[]);assert.deepEqual(errors,[]);
}finally{await writeFile(join(artifacts,'exit.json'),JSON.stringify({states,unknown,errors,callerVerifiedReferenceCommit:process.env.ORIGINAL_PLAYER_REFERENCE_COMMIT,scope:'Unmodified Source frontend on owned API/player fixtures; no Source backend authorization proof'},null,2));await browser?.close();await new Promise(done=>server.close(done));}
