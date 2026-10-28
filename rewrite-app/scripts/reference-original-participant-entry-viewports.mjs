import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdtemp, mkdir, readFile, rm, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {extname, join, relative, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {originalBrowserSource, verifyOriginalBuild} from './original-browser-reference.mjs';
import {raceWithSmokeDeadline} from './smoke-deadline.mjs';
import {captureStableViewport} from './stable-viewport-capture.mjs';
import {compareScreenshots} from './exact-rgba-comparison.mjs';

// Complete native viewports. Source is unchanged, with owned UI DTOs; the
// candidate uses its real protected API. This is no Source backend auth proof.
assert.equal(process.env.UI_SMOKE_HEADFUL, 'true');
assert.ok(!process.env.UI_SMOKE_BROWSER_CHANNEL);
assert.equal(process.env.ORIGINAL_PLAYER_REFERENCE_COMMIT, originalBrowserSource.commit);
const root = resolve(process.env.ORIGINAL_PLAYER_REFERENCE_ROOT);
const artifacts = resolve(process.env.UI_SMOKE_ARTIFACT_DIR);
const manifest = await verifyOriginalBuild(root);
await mkdir(artifacts, {recursive:true});
const scratch = await mkdtemp(join(tmpdir(), 'original-entry-paired-'));
const sourceServer = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(root, extname(pathname) ? '.'+pathname : 'index.html');
    if (relative(root,file).startsWith('..')) return response.writeHead(404).end();
    response.setHeader('content-type', ({'.html':'text/html','.js':'text/javascript','.css':'text/css',
      '.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png'})[extname(file)]||'application/octet-stream');
    response.end(await readFile(file));
  } catch {response.writeHead(404).end();}
});
await new Promise(done=>sourceServer.listen(0,'127.0.0.1',done));
const sourceBase = 'http://127.0.0.1:'+sourceServer.address().port;
const module = pathToFileURL(resolve('apps/api/dist/apps/api/src/index.js')).href;
const apiServer = spawn(process.execPath,['--input-type=module','-e',
  'import{createProductionApiServer}from '+JSON.stringify(module)+';const server=await createProductionApiServer();'+
  "server.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));"+
  "process.once('SIGTERM',()=>server.close(()=>process.exit(0)));"],{
  stdio:['ignore','ignore','inherit','ipc'],env:{...process.env,PORT:'4310',FIRST_SLICE_STORE:'sqlite',
    FIRST_SLICE_SQLITE_FILE:join(scratch,'owned.sqlite'),FIRST_SLICE_BOOTSTRAP_DEMO:'true',
    FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',FIRST_SLICE_PROOF_OF_WORK_SCOPES:''}
});
const apiClosed = new Promise(done=>apiServer.once('close',done));
const comparisons = {}, referenceReproducibility = {}, diagnostics = [], faultControls = [], errors = [], unknown = [], sourceWrites = [], candidateWrites = [];
let browser;
try {
  const port = await raceWithSmokeDeadline(new Promise((done,reject)=>{
    apiServer.once('message',message=>done(message.port));apiServer.once('error',reject);
    apiServer.once('exit',()=>reject(Error('Owned API exited before listening.')));
  }),20_000,()=>{throw Error('Owned API startup timed out.');});
  const base = 'http://127.0.0.1:'+port;
  const signIn = await fetch(base+'/api/v1/admin/auth/sign-in',{method:'POST',headers:{'content-type':'application/json'},
    body:JSON.stringify({username:'demo-admin',password:'demo-admin-password'})});
  assert.equal(signIn.status,200);const token = (await signIn.json()).sessionToken;
  browser = await chromium.launch({headless:false});
  for (const theme of ['Primar','Sekundar','Erwachsene']) {
    const settings = await fetch(base+'/api/v1/admin/application-settings',{method:'PATCH',
      headers:{authorization:'Bearer '+token,'content-type':'application/json'},body:JSON.stringify({themeName:theme})});
    assert.equal(settings.status,200);
    for (const [screen,width,height] of [['desktop',1280,720],['mobile',390,844],['toolbar-small',599,844],['toolbar-large',600,844]]) {
      const key = theme+'-'+screen;
      const captures = {};
      for (const kind of ['source','rewrite','source-repeat']) {
        const source = kind!=='rewrite';
        const context = await browser.newContext({viewport:{width,height},deviceScaleFactor:1,locale:'de-DE',timezoneId:'Europe/Berlin',serviceWorkers:'block'});
        const page = await context.newPage();await page.bringToFront();
        page.on('pageerror',error=>errors.push({key,kind,error:String(error)}));
        if (source) await context.route(sourceBase+'/api/**',async route=>{
          const request = route.request(), path = new URL(request.url()).pathname;
          let body;
          if (path==='/api/system/config') body={version:'Rewrite',customTexts:{},appConfig:{themeName:theme,appTitle:'IQB-Testcenter'},
            veronaPlayerApiVersionMin:2,veronaPlayerApiVersionMax:6,iqbStandardResponseTypeMin:1,iqbStandardResponseTypeMax:5,
            xmlSchemaVersions:{},bruteForceProtection:[],broadcastingServiceUri:'',fileServiceUri:'',passwordMinLength:0,passwordPattern:''};
          else if (path==='/api/sys-check-mode') body=false;
          else if (path==='/api/asset-assignments') body={};
          else if (path==='/api/assets') body=[];
          else if (path==='/api/session/login' && request.method()==='PUT') {
            sourceWrites.push({key,kind,path,body:request.postDataJSON()});
            return route.fulfill({status:400,contentType:'application/json',body:JSON.stringify({message:'Owned invalid credentials'})});
          } else {
            unknown.push({key,kind,path,method:request.method()});
            return route.fulfill({status:404,body:'{}'});
          }
          await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
        });
        else page.on('request',request=>{
          if(request.method()==='POST'&&new URL(request.url()).pathname==='/api/v1/participant/auth/sign-in')
            candidateWrites.push({key,path:new URL(request.url()).pathname,body:request.postDataJSON()});
        });
        await page.goto(source?sourceBase+'/#/r/login':base+'/app/participant?ui=original&tenantKey=demo-tenant&workspaceKey=demo-workspace',{waitUntil:'networkidle'});
        const name = page.locator(source?'input[formcontrolname=name]':'#originalLoginName');
        await name.waitFor();
        assert.equal(await name.inputValue(),'');
        assert.equal(await page.getByRole('button',{name:'Weiter',exact:true}).isDisabled(),true);
        const measure=()=>page.evaluate(()=>({viewport:[innerWidth,innerHeight],scroll:[scrollX,scrollY],
          document:[document.documentElement.scrollWidth,document.documentElement.scrollHeight],documentFocused:document.hasFocus(),
          active:[document.activeElement.tagName,document.activeElement.id,document.activeElement.getAttribute('type')],
          hover:[...document.querySelectorAll(':hover')].map(element=>[element.tagName,element.id]),
          inputs:[...document.querySelectorAll('input')].map(input=>[input.type,input.value.length,input.selectionStart,input.selectionEnd]),
          layout:[...document.querySelectorAll('.login-page,.login-section,.welcome-section,.help-box,form')]
            .map(element=>({box:element.getBoundingClientRect().toJSON(),scroll:[element.scrollLeft,element.scrollTop]}))}));
        const capture = async (phase,{hover}={})=>{
          console.log('entry_viewport_capture='+key+'/'+kind+'/'+phase);
          await page.bringToFront();await page.waitForFunction(()=>document.hasFocus());
          // Use the same trusted neutral pointer position in both documents.
          // Explicit hover cases move to their actual control after layout.
          await page.mouse.move(0,0);
          await page.evaluate(()=>document.fonts.ready);
          await page.waitForFunction(()=>[...document.images].every(image=>image.complete&&image.naturalWidth>0));
          await page.waitForFunction(()=>!document.querySelector('.mat-ripple-element:not(.mat-radio-persistent-ripple)')&&
            document.getAnimations().filter(animation=>animation.effect?.getComputedTiming().iterations!==Infinity)
              .every(animation=>!animation.pending&&(animation.playState==='finished'||animation.playState==='idle')));
          if(hover) {
            await page.locator(hover).hover();
            await page.waitForFunction(()=>document.getAnimations().filter(animation=>animation.effect?.getComputedTiming().iterations!==Infinity)
              .every(animation=>!animation.pending&&(animation.playState==='finished'||animation.playState==='idle')));
          }
          await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
          const result = await captureStableViewport(page,measure,join(artifacts,key+'-'+phase+'-'+kind+'.png'));
          const controls=await page.evaluate(()=>[...document.querySelectorAll('form button,mat-form-field,.mat-mdc-form-field-subscript-wrapper,.help-box,form,.login-section')].map(element=>{
            const rect=element.getBoundingClientRect(),style=getComputedStyle(element);
            return{tag:element.tagName,classes:element.className,text:element.textContent.trim(),
              bounds:[rect.x,rect.y,rect.width,rect.height],font:style.font,lineHeight:style.lineHeight,
              padding:style.padding,margin:style.margin,display:style.display,transform:style.transform,
              border:style.border,boxShadow:style.boxShadow,active:element===document.activeElement};
          }));
          diagnostics.push({key,phase,kind,geometry:result.geometry,controls,paint:result.paintDiagnostics});
          const id=key+'-'+phase;
          if(kind==='source') captures[phase]=result.bytes;
          else if(kind==='rewrite') comparisons[id]=await compareScreenshots(page,captures[phase],result.bytes);
          else referenceReproducibility[id]=await compareScreenshots(page,captures[phase],result.bytes);
        };
        await capture('initial');
        if(kind==='rewrite' && screen==='desktop') {
          const initial=await readFile(join(artifacts,key+'-initial-rewrite.png'));
          for(const [fault,selector,css] of [
            ['footer','#originalApplicationFooter','transform:translateY(-1px)!important'],
            ['welcome','.welcome-section','background:#ffd0ab!important'],
            ['submit','.login-submit','transform:translateX(1px)!important']
          ]) {
            assert.equal(await page.locator(selector).count(),1);
            const style=await page.addStyleTag({content:selector+'{'+css+'}'});
            let mutated;
            try {
              const result=await captureStableViewport(page,measure,join(artifacts,key+'-fault-'+fault+'.png'));
              mutated=await compareScreenshots(page,initial,result.bytes);
              assert.ok(mutated.differingPixels>0,'A real '+fault+' paint defect must fail the complete viewport comparison.');
            } finally {await style.evaluate(element=>element.remove());}
            const restored=await captureStableViewport(page,measure,join(artifacts,key+'-restored-'+fault+'.png'));
            const recovery=await compareScreenshots(page,initial,restored.bytes);
            assert.equal(recovery.differingPixels,0,'Removing the owned defect must restore the real candidate paint.');
            faultControls.push({key,fault,mutated,recovery});
          }
        }
        await page.keyboard.press('Tab');
        assert.equal(await page.evaluate(()=>document.activeElement.closest('a')?.getAttribute('aria-label')),
          'Gehe zur Startseite');
        await capture('logo-focus');
        await page.keyboard.press('Tab');await page.keyboard.press('Tab');
        assert.equal(await name.evaluate(element=>element===document.activeElement),true);
        await page.locator('.mat-mdc-tooltip-surface').waitFor({state:'detached'});
        await capture('name-focus');
        const missing='owned-missing-'+key.toLowerCase();
        const password=page.locator(source?'input[formcontrolname=pw]':'#originalLoginPassword');
        const submitName=async()=>{
          const previous=await name.evaluateHandle(element=>element.closest('form'));
          await name.fill(missing);await page.getByRole('button',{name:'Weiter',exact:true}).click();
          await password.waitFor();
          assert.equal(await previous.evaluate(element=>element.isConnected),false,
            'Name and password steps must use independent native forms, as the Original does.');
          await previous.dispose();
        };
        await submitName();await capture('password');
        await capture('password-submit-hover',{hover:'form > button'});
        await password.evaluate(input=>input.dispatchEvent(new KeyboardEvent('keyup',{key:'A',modifierCapsLock:true,bubbles:true})));
        await page.getByText('Feststelltaste ist aktiviert!',{exact:true}).waitFor();
        await capture('caps-lock');
        await password.evaluate(input=>input.dispatchEvent(new KeyboardEvent('keyup',{key:'a',modifierCapsLock:false,bubbles:true})));
        await page.getByText('Feststelltaste ist aktiviert!',{exact:true}).waitFor({state:'detached'});
        await page.locator('mat-form-field button').click();
        await page.waitForFunction(selector=>document.querySelector(selector)?.getAttribute('type')==='text',
          source?'input[formcontrolname=pw]':'#originalLoginPassword');
        await capture('visibility');
        await capture('visibility-hover',{hover:'mat-form-field button'});
        const previousPasswordForm=await password.evaluateHandle(element=>element.closest('form'));
        await page.locator('.password-headline button').click();await name.waitFor();
        assert.equal(await previousPasswordForm.evaluate(element=>element.isConnected),false);
        await previousPasswordForm.dispose();
        assert.equal(await name.inputValue(),missing);await capture('back');
        await submitName();await password.fill('owned-invalid-password');
        await page.getByRole('button',{name:'Anmelden',exact:true}).click();await name.waitFor();
        await page.getByText('Anmeldedaten sind nicht gültig. Bitte noch einmal versuchen!',{exact:true}).waitFor();
        assert.equal(await name.inputValue(),'');await capture('invalid');
        await context.close();
      }
      console.log('paired_entry='+key+':captured');
    }
  }
  assert.equal(Object.keys(comparisons).length,120);assert.equal(Object.keys(referenceReproducibility).length,120);
  assert.equal(faultControls.length,9);
  assert.deepEqual(errors,[]);assert.deepEqual(unknown,[]);
  assert.equal(sourceWrites.length,72);assert.equal(candidateWrites.length,36);
  for(const key of new Set(candidateWrites.map(entry=>entry.key))) {
    const loginKey='owned-missing-'+key.toLowerCase();
    assert.deepEqual(candidateWrites.filter(entry=>entry.key===key).map(entry=>({loginKey:entry.body.loginKey,password:entry.body.password??''})),
      [{loginKey,password:''},{loginKey,password:''},{loginKey,password:'owned-invalid-password'}]);
    for(const kind of ['source','source-repeat']) assert.deepEqual(sourceWrites.filter(entry=>entry.key===key&&entry.kind===kind).map(entry=>entry.body),
      [{name:loginKey,password:''},{name:loginKey,password:''},{name:loginKey,password:'owned-invalid-password'}]);
  }
  assert.deepEqual(Object.entries(referenceReproducibility).filter(([,value])=>value.differingPixels),[],'Source must reproduce each complete entry viewport.');
  assert.deepEqual(Object.entries(comparisons).filter(([,value])=>value.differingPixels),[],'Every complete entry viewport must match Source.');
} finally {
  await writeFile(join(artifacts,'entry-viewports.json'),JSON.stringify({source:originalBrowserSource,manifest,
    scope:'Unchanged Source frontend with owned UI DTOs; real protected candidate API. No Source backend authentication proof.',
    comparisons,referenceReproducibility,diagnostics,faultControls,errors,unknown,sourceWrites,candidateWrites},null,2));
  await browser?.close();apiServer.kill('SIGTERM');
  await raceWithSmokeDeadline(apiClosed,10_000,()=>{apiServer.kill('SIGKILL');throw Error('Owned API shutdown timed out.');});
  await rm(scratch,{recursive:true,force:true});
  await new Promise(done=>sourceServer.close(done));await verifyOriginalBuild(root);
}
