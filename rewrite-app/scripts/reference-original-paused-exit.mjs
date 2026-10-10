import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { chromium } from 'playwright';
import { completenessPlayer } from './exit-completeness-fixture.mjs';
// Read-only unmodified Source frontend on owned API/player fixtures. The caller
// must verify its revision/build. This does not prove Source backend behavior.
assert.ok(process.env.ORIGINAL_PLAYER_REFERENCE_ROOT);
assert.ok(process.env.ORIGINAL_PLAYER_REFERENCE_COMMIT);
assert.ok(process.env.UI_SMOKE_ARTIFACT_DIR);
const root=resolve(process.env.ORIGINAL_PLAYER_REFERENCE_ROOT), artifacts=resolve(process.env.UI_SMOKE_ARTIFACT_DIR);
await access(join(root,'index.html'));await mkdir(artifacts,{recursive:true});
const {localDemoSourcePackage}=await import('../apps/api/dist/apps/api/src/local-demo-bootstrap.js');
const demo=JSON.parse(localDemoSourcePackage.sourceDocument),player=completenessPlayer(demo.playerEntries[0].html);
const server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=resolve(root,extname(pathname)?'.'+pathname:'index.html');if(relative(root,file).startsWith('..'))return res.writeHead(404).end();res.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'}[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));const base=`http://127.0.0.1:${server.address().port}`;
const errors=[],unknown=[],states={};let browser;
try{
 browser=await chromium.launch({headless:false});
 const lockOnTermination=process.env.ORIGINAL_PAUSED_LOCK_ONLY==='true';
 for(const mode of (lockOnTermination?['run-hot-return']:['run-hot-return','run-hot-restart'])) for(const theme of (mode==='run-hot-return'&&!lockOnTermination?['Primar','Sekundar','Erwachsene']:['Primar']))
 for(const [screen,width,height] of (mode==='run-hot-return'&&!lockOnTermination?[['desktop',1280,720],['mobile',390,844]]:[['desktop',1280,720]]))
 for(const restriction of (lockOnTermination?['forbidden']:['allowed','confirm','forbidden'])) for(const silent of [false,true]) {
  const scope='unit',lockConfirm=true,hidden=false;
  const key=`${mode}-${theme}-${screen}-${restriction}-${silent}${lockOnTermination?'-locked':''}`,context=await browser.newContext({viewport:{width,height},locale:'de-DE'}),page=await context.newPage(),requests=[];
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
   else if(pathname==='/api/file/owned-exit-group/ws_1/owned-player.html'&&method==='GET')return route.fulfill({status:200,contentType:'text/html',body:player});
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
  const capture=async phase=>{await page.waitForFunction(()=>document.getAnimations().filter(a=>a.effect?.getComputedTiming().iterations!==Infinity).every(a=>!a.pending&&a.playState!=='running'));await page.screenshot({path:join(artifacts,`${key}-${phase}.png`),fullPage:true});return page.evaluate(()=>{const rect=n=>{if(!n)return null;const b=n.getBoundingClientRect(),s=getComputedStyle(n);return{x:b.x,y:b.y,width:b.width,height:b.height,font:s.font,color:s.color,background:s.backgroundColor,padding:s.padding,borderRadius:s.borderRadius};};const dialog=document.querySelector('mat-dialog-container');return{logo:rect(document.querySelector('tc-header a')),logoImage:rect(document.querySelector('tc-header img')),header:rect(document.querySelector('[data-cy=header]')),dialog:dialog?{role:dialog.getAttribute('role'),box:rect(dialog),title:dialog.querySelector('[data-cy=dialog-title],mat-dialog-title,[mat-dialog-title]').textContent,content:dialog.querySelector('[data-cy=dialog-content],[data-cy=deny-navigation-message]').textContent,buttons:[...dialog.querySelectorAll('button')].map(n=>({text:n.textContent.trim(),box:rect(n),classes:n.className}))}:null,activeTag:document.activeElement.tagName};});};
  states[key]={player:await capture('player'),requests};
  const frame=page.frameLocator('iframe');await frame.locator('#demoPlayerAnswer').fill('Own incomplete Ω');
  await frame.locator('#exitPresentation').selectOption('some');await frame.locator('#exitResponse').selectOption('none');
  pauseRequested=true;
  try {await page.locator('iframe').waitFor({state:'detached',timeout:15_000});}catch(error){states[key].diagnostic=await page.locator('body').innerText();await page.screenshot({path:join(artifacts,'pause-failure.png'),fullPage:true});throw error;}
  await page.locator('iframe').waitFor({state:'detached'});await page.waitForTimeout(150);
  states[key].paused=await capture('paused');
  states[key].pausedSurface=await page.locator('mat-card').evaluate(card=>{
    const read=n=>{const b=n.getBoundingClientRect(),s=getComputedStyle(n);return {x:b.x,y:b.y,width:b.width,height:b.height,font:s.font,color:s.color,background:s.backgroundColor,padding:s.padding,margin:s.margin,border:s.border,borderRadius:s.borderRadius,boxShadow:s.boxShadow};};
    return {card:read(card),title:{text:card.querySelector('mat-card-title').textContent,box:read(card.querySelector('mat-card-title'))},paragraphs:[...card.querySelectorAll('p')].map(p=>({text:p.textContent.trim(),box:read(p),bold:read(p.querySelector('b'))})),toolbar:read(document.querySelector('[data-cy=unit-screenheader]'))};
  });
  const before=requests.length;await logo.click();
  if(silent){
    await page.locator('mat-dialog-container').waitFor();states[key].confirmation=await capture('confirmation');
    await page.locator('[data-cy=dialog-cancel]').click();await page.locator('mat-dialog-container').waitFor({state:'detached'});
    assert.ok(page.url().includes('/t/1/u/1'));states[key].stayedRequests=requests.slice(before);
    await logo.click();await page.locator('[data-cy=dialog-confirm]').click();
  }
  await page.waitForURL('**/#/r/starter');states[key].left={requests:requests.slice(before),notices:await page.locator('[data-cy^=toast-text-]').allTextContents()};
  const stateKeys=states[key].left.requests.filter(request=>request.pathname==='/api/test/1/state').flatMap(request=>request.body.map(entry=>entry.key));
  assert.deepEqual(stateKeys,silent?['CONTROLLER']:[]);
  assert.equal(states[key].left.requests.some(request=>request.pathname==='/api/test/1/lock'),silent&&lockOnTermination);
  assert.deepEqual(states[key].left.notices,[]);
  await context.close();console.log(`source_player_exit=${key}:passed`);
 }
 assert.deepEqual(unknown,[]);assert.deepEqual(errors,[]);
}finally{await writeFile(join(artifacts,'exit.json'),JSON.stringify({states,unknown,errors,callerVerifiedReferenceCommit:process.env.ORIGINAL_PLAYER_REFERENCE_COMMIT,scope:'Unmodified Source frontend on owned API/player fixtures; no Source backend authorization proof'},null,2));await browser?.close();await new Promise(done=>server.close(done));}
