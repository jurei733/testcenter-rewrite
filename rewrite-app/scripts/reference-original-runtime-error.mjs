import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { access, mkdir, readFile, writeFile } from 'node:fs/promises';
import { extname, join, relative, resolve } from 'node:path';
import { chromium } from 'playwright';
import { runtimeErrorPlayer } from './runtime-error-fixture.mjs';
import { runtimeErrorContractCases, expectedRuntimeErrorHelp } from './runtime-error-contract-fixture.mjs';
// Read-only unmodified Source frontend on owned API/player fixtures. The caller
// must verify its revision/build. This does not prove Source backend behavior.
assert.ok(process.env.ORIGINAL_PLAYER_REFERENCE_ROOT);
assert.ok(process.env.ORIGINAL_PLAYER_REFERENCE_COMMIT);
assert.ok(process.env.UI_SMOKE_ARTIFACT_DIR);
const root=resolve(process.env.ORIGINAL_PLAYER_REFERENCE_ROOT), artifacts=resolve(process.env.UI_SMOKE_ARTIFACT_DIR);
await access(join(root,'index.html'));await mkdir(artifacts,{recursive:true});
const {localDemoSourcePackage}=await import('../apps/api/dist/apps/api/src/local-demo-bootstrap.js');
const demo=JSON.parse(localDemoSourcePackage.sourceDocument);
const contract=process.env.ORIGINAL_RUNTIME_CONTRACT==='true';
const overlap=process.env.ORIGINAL_RUNTIME_COMMAND_OVERLAP;
assert.ok(!overlap||['pending-pause','pending-terminate','queued-pause','queued-terminate','pending-resume','queued-resume','queued-pause-resume','queued-pause-resume-reversed-acks'].includes(overlap));
const pairedCommands=overlap?.startsWith('queued-pause-resume');
assert.ok(!(overlap&&contract));
const xmlText=value=>String(value).replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
const server=createServer(async(req,res)=>{try{const pathname=new URL(req.url,'http://localhost').pathname,file=resolve(root,extname(pathname)?'.'+pathname:'index.html');if(relative(root,file).startsWith('..'))return res.writeHead(404).end();res.setHeader('content-type',{'.html':'text/html','.js':'text/javascript','.css':'text/css','.svg':'image/svg+xml','.woff2':'font/woff2'}[extname(file)]||'application/octet-stream');res.end(await readFile(file));}catch{res.writeHead(404).end();}});
await new Promise(done=>server.listen(0,'127.0.0.1',done));const base=`http://127.0.0.1:${server.address().port}`;
const errors=[],unknown=[],states={};let browser;
try{
 browser=await chromium.launch({headless:false});
 const lockOnTermination=process.env.ORIGINAL_PAUSED_LOCK_ONLY==='true';
 const cases=overlap?[{theme:'Primar',screen:'desktop'}]:contract?runtimeErrorContractCases:['Primar','Sekundar','Erwachsene'].slice(0,lockOnTermination?1:3).flatMap(theme=>
  (lockOnTermination?['desktop']:['desktop','mobile']).map(screen=>({theme,screen})));
 for(const scenario of cases) {
  const {theme,screen}=scenario,mode='run-hot-return',restriction='forbidden',silent=false;
  const [width,height]=screen==='desktop'?[1280,720]:[390,844];
  const runtimePlayer=runtimeErrorPlayer(demo.playerEntries[0].html,contract?scenario:{});
  const scope='unit',lockConfirm=true,hidden=false;
  const key=overlap?overlap:contract?scenario.key:`${mode}-${theme}-${screen}-${restriction}-${silent}${lockOnTermination?'-locked':''}`,context=await browser.newContext({viewport:{width,height},locale:'de-DE'}),page=await context.newPage(),requests=[];
  page.on('pageerror',error=>errors.push({key,error:String(error)}));
  let pauseRequested=false;
  let releaseCommand,commandBlocked,commandPollCount=0;
  const acknowledgementCompletionOrder=[];
  const commandGate=new Promise(done=>{releaseCommand=done;});
  const commandStarted=new Promise(done=>{commandBlocked=done;});
  const auth={token:'owned-player-exit',displayName:'exit-person',loginName:'exit-person',groupLabel:'Exit Group',flags:[],customTexts:scenario.loginCustomTexts??{},groupToken:'owned-exit-group',viewSettings:{theme},claims:{test:[{id:'owned-exit',label:'Logo Testheft',workspaceId:'1',description:'',type:'test',flags:{}}]}};
  const customTexts=Object.keys(scenario.bookletCustomTexts??{}).length?`<CustomTexts>${Object.entries(scenario.bookletCustomTexts).map(([key,value])=>`<CustomText key="${key}">${xmlText(value)}</CustomText>`).join('')}</CustomTexts>`:'';
  const unit='<Unit id="unit-intro" label="Logo Aufgabe"/>',testlet=restriction==='none'?unit:`<Testlet id="timed" label="Zeitblock"><Restrictions><TimeMax minutes="5" leave="${restriction}"/><LockAfterLeaving scope="${scope}" confirm="${lockConfirm}"/></Restrictions>${unit}</Testlet>`;
  const xml=`<Booklet><Metadata><Id>owned-exit</Id><Label>Logo Testheft</Label></Metadata>${customTexts}<BookletConfig><Config key="silent_mode">${silent?'TRUE':'FALSE'}</Config><Config key="force_presentation_complete">ALWAYS</Config><Config key="force_response_complete">ALWAYS</Config><Config key="header_hidden">${hidden?'TRUE':'FALSE'}</Config><Config key="toolbar_show_unit_list">FALSE</Config><Config key="toolbar_show_fullscreen_button">FALSE</Config><Config key="toolbar_show_reload_button">FALSE</Config><Config key="navbar_unit_label">HIDDEN</Config><Config key="navbar_page_label">HIDDEN</Config><Config key="lock_test_on_termination">${lockOnTermination?'ON':'OFF'}</Config></BookletConfig><Units>${testlet}</Units></Booklet>`;
  await context.route(`${base}/api/**`,async route=>{const req=route.request(),pathname=new URL(req.url()).pathname,method=req.method();requests.push({method,pathname,...(req.postData()?{body:req.postDataJSON()}: {})});let body;
   if(pathname==='/api/system/config')body={version:'Rewrite',customTexts:scenario.applicationCustomTexts??{},appConfig:{themeName:theme,appTitle:'IQB-Testcenter'},veronaPlayerApiVersionMin:2,veronaPlayerApiVersionMax:6,iqbStandardResponseTypeMin:1,iqbStandardResponseTypeMax:5,xmlSchemaVersions:{},bruteForceProtection:[],broadcastingServiceUri:'',fileServiceUri:'',passwordMinLength:0,passwordPattern:''};
   else if(pathname==='/api/sys-check-mode')body=false;
   else if(pathname==='/api/asset-assignments')body={};else if(pathname==='/api/assets')body=[];
   else if(pathname==='/api/session/login'&&method==='PUT'||pathname==='/api/session'&&method==='GET')body=auth;
   else if(pathname==='/api/test'&&method==='PUT')body=1;
   else if(pathname==='/api/test/1'&&method==='GET')body={xml,mode,laststate:{},resources:{'UNIT-INTRO':{usesPlayer:['owned-player.html']}},firstStart:false,workspaceId:1,presetBookletStates:{}};
   else if(pathname.startsWith('/api/test/1/unit/unit-intro/alias/')&&method==='GET')body={state:{},dataParts:{},unitResponseType:'owned',definition:demo.bookletEntries[0].unitEntries[0].unitDefinition,definitionType:'application/vnd.testcenter.demo+json'};
   else if(pathname==='/api/file/owned-exit-group/ws_1/owned-player.html'&&method==='GET')return route.fulfill({status:200,contentType:'text/html',body:runtimePlayer});
   else if(pathname==='/api/test/1/connection-lost'&&method==='POST')body={};
   else if(pathname==='/api/test/1/commands'&&method==='GET'){
    commandPollCount++;
    if(overlap&&commandPollCount===1){
      const command={id:2,timestamp:Date.now(),keyword:overlap.split('-')[1],arguments:[]};
      if(overlap.startsWith('pending-')){commandBlocked();await commandGate;body=[command];}
      else body=pairedCommands?[{id:1,timestamp:Date.now(),keyword:'pause',arguments:[]},{...command,keyword:'resume'}]:[{id:1,timestamp:Date.now(),keyword:'debug',arguments:['off']},command];
    }else body=pauseRequested?[{id:1,timestamp:Date.now(),keyword:'pause',arguments:[]}]:[];
   }
   else if(/^\/api\/test\/1\/command\/[12]\/executed$/.test(pathname)&&method==='PATCH'){
    if(overlap?.startsWith('queued-')){if(pathname.endsWith('/1/executed'))commandBlocked();await commandGate;}
    if(overlap==='queued-pause-resume-reversed-acks'&&pathname.endsWith('/1/executed'))await new Promise(done=>setTimeout(done,1800));
    await route.fulfill({status:200,contentType:'application/json',body:'{}'});
    acknowledgementCompletionOrder.push(Number(pathname.match(/\/command\/(\d+)\/executed$/)[1]));
    return;
   }
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
    await page.screenshot({path:join(artifacts,`${key}-${phase}.png`),fullPage:true});
    return page.evaluate(()=>{
      const read=n=>{if(!n)return null;const b=n.getBoundingClientRect(),s=getComputedStyle(n);return{x:b.x,y:b.y,width:b.width,height:b.height,font:s.font,color:s.color,background:s.backgroundColor,padding:s.padding,margin:s.margin,borderRadius:s.borderRadius,boxShadow:s.boxShadow};};
      const dialog=document.querySelector('mat-dialog-container');
      return {url:location.href,activeTag:document.activeElement.tagName,activeRole:document.activeElement.getAttribute('role'),bodyText:document.body.innerText,iframeCount:document.querySelectorAll('iframe').length,cardCount:document.querySelectorAll('mat-card').length,samePlayerFrameAsBeforeError:document.querySelector('iframe')===globalThis.__ownedPlayerFrameBeforeError,
        dialog:dialog?{role:dialog.getAttribute('role'),box:read(dialog),title:dialog.querySelector('[mat-dialog-title]').textContent.trim(),titleBox:read(dialog.querySelector('[mat-dialog-title]')),content:dialog.querySelector('mat-dialog-content,[mat-dialog-content]').textContent.trim(),contentBox:read(dialog.querySelector('mat-dialog-content,[mat-dialog-content]')),expansion:read(dialog.querySelector('mat-expansion-panel')),icon:read(dialog.querySelector('mat-icon')),actions:read(dialog.querySelector('mat-dialog-actions')),buttons:[...dialog.querySelectorAll('button')].map(n=>({text:n.textContent.trim(),box:read(n),classes:n.className}))}:null};
    });
  };
  const frame=page.frameLocator('iframe');await frame.locator('#demoPlayerAnswer').fill('Own incomplete Ω');
  await frame.locator('#exitPresentation').selectOption('some');await frame.locator('#exitResponse').selectOption('none');
  if(overlap){
    let gateTimer;
    try{await Promise.race([commandStarted,new Promise((_,reject)=>{gateTimer=setTimeout(()=>reject(Error('Owned command gate did not start')),15000);})]);}
    finally{clearTimeout(gateTimer);}
  }
  await page.evaluate(()=>{globalThis.__ownedPlayerFrameBeforeError=document.querySelector('iframe');});
  const before=requests.length;await frame.locator('#ownedRuntimeError').click();
  await page.locator('mat-dialog-container').waitFor();
  if(overlap){
    const first=await capture('error');releaseCommand();
    await new Promise(done=>setTimeout(done,pairedCommands?3500:1800));
    const after=await capture('after-command');
    const acknowledgements=requests.filter(q=>/\/command\/[12]\/executed$/.test(q.pathname));
    if(overlap.startsWith('pending-')){
      assert.equal(acknowledgements.length,0);assert.equal(after.iframeCount,1);assert.equal(after.cardCount,0);assert.equal(after.url,first.url);
    }else assert.ok(acknowledgements.some(q=>q.pathname.endsWith('/2/executed')));
    assert.equal(first.dialog.title,'Fehler beim Abspielen der Aufgabe');
    states[key]={first,after,commandPollCount,acknowledgements,acknowledgementCompletionOrder,requests};
    await context.close();console.log(`source_runtime_command_overlap=${key}:passed`);continue;
  }
  if(contract)await page.mouse.move(0,0);
  states[key]={definition:scenario,collapsed:await capture('collapsed'),requests};
  const intro=await page.locator('mat-dialog-content').evaluate(content=>{
    const p=content.querySelector(':scope > p');
    return p?{text:p.innerText.trim(),whiteSpace:getComputedStyle(p).whiteSpace}:
      {text:[...content.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE).map(n=>n.textContent).join('').trim().replace(/\s+/g,' '),whiteSpace:null};
  });
  states[key].intro=intro;
  if(contract&&expectedRuntimeErrorHelp(scenario)){
    assert.equal(intro.text,expectedRuntimeErrorHelp(scenario));assert.equal(intro.whiteSpace,'pre-wrap');
  }
  assert.equal(states[key].collapsed.dialog.title,'Fehler beim Abspielen der Aufgabe');assert.equal(states[key].collapsed.cardCount,0);assert.equal(states[key].collapsed.iframeCount,1);assert.equal(states[key].collapsed.activeRole,'dialog');
  await page.keyboard.press('Escape');assert.equal(await page.locator('mat-dialog-container').count(),1);
  await page.locator('.cdk-overlay-backdrop').click({position:{x:5,y:5}});assert.equal(await page.locator('mat-dialog-container').count(),1);
  await page.getByRole('button',{name:'Fehlerdetails',exact:true}).click();states[key].expanded=await capture('expanded');
  const description=page.locator('mat-expansion-panel p').first();
  states[key].description={html:await description.innerHTML(),text:await description.textContent()};
  const firstMessage=contract?scenario.message:'Owned incomplete runtime Ω';
  if(!contract)assert.ok(states[key].expanded.dialog.content.includes(firstMessage));
  await frame.locator('#ownedRuntimeError').evaluate(button=>{button.dataset.message='Second owned runtime Ω';button.click();});
  await new Promise(done=>setTimeout(done,700));
  states[key].repeated=await capture('repeated');
  states[key].repeatedDialogCount=await page.locator('mat-dialog-container').count();
  assert.equal(states[key].repeatedDialogCount,1);
  assert.equal(await description.innerHTML(),states[key].description.html);
  assert.ok(!states[key].repeated.dialog.content.includes('Second owned runtime Ω'));
  await page.locator('[data-cy=close]').click();await page.waitForFunction(()=>!document.querySelector('mat-dialog-container'));
  await page.waitForLoadState('networkidle');states[key].reloaded=await capture('reloaded');states[key].errorRequests=requests.slice(before);
  const runtimeLogKey=`Runtime Error: ${contract?scenario.code:'runtime-error'}`;
  assert.equal(states[key].errorRequests.filter(q=>q.body?.logEntries?.some(e=>e.key===runtimeLogKey&&e.content===firstMessage)).length,1);
  states[key].repeatedRuntimeLogCount=states[key].errorRequests.filter(q=>q.body?.logEntries?.some(e=>e.key===runtimeLogKey)).length;
  assert.equal(states[key].repeatedRuntimeLogCount,2);
  assert.equal(states[key].errorRequests.filter(q=>Array.isArray(q.body)&&q.body.some(e=>e.key==='CONTROLLER'&&e.content==='ERROR')).length,1);
  await context.close();console.log(`${contract?'source_runtime_error_contract':'source_runtime_error'}=${key}:passed`);
 }
 assert.deepEqual(unknown,[]);assert.deepEqual(errors,[]);
}finally{await writeFile(join(artifacts,'exit.json'),JSON.stringify({states,unknown,errors,callerVerifiedReferenceCommit:process.env.ORIGINAL_PLAYER_REFERENCE_COMMIT,scope:'Unmodified Source frontend on owned API/player fixtures; no Source backend authorization proof'},null,2));await browser?.close();await new Promise(done=>server.close(done));}
