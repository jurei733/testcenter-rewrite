import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdtemp,mkdir,readFile,rm,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {extname,join,relative,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {originalBrowserSource,verifyOriginalBuild} from './original-browser-reference.mjs';
import {raceWithSmokeDeadline} from './smoke-deadline.mjs';
import {captureStableViewport} from './stable-viewport-capture.mjs';
import {compareScreenshots} from './exact-rgba-comparison.mjs';

// Unchanged Source frontend with owned UI DTOs; real protected candidate API.
// These images are not evidence of Source backend authentication.
assert.equal(process.env.UI_SMOKE_HEADFUL,'true');
assert.ok(!process.env.UI_SMOKE_BROWSER_CHANNEL);
assert.equal(process.env.ORIGINAL_PLAYER_REFERENCE_COMMIT,originalBrowserSource.commit);
const root=resolve(process.env.ORIGINAL_PLAYER_REFERENCE_ROOT),artifacts=resolve(process.env.UI_SMOKE_ARTIFACT_DIR);
const manifest=await verifyOriginalBuild(root);
await mkdir(artifacts,{recursive:true});
const scratch=await mkdtemp(join(tmpdir(),'original-starter-paired-'));
const sourceServer=createServer(async(request,response)=>{
  try {
    const pathname=decodeURIComponent(new URL(request.url,'http://localhost').pathname);
    const file=resolve(root,extname(pathname)?'.'+pathname:'index.html');
    if(relative(root,file).startsWith('..'))return response.writeHead(404).end();
    response.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.css':'text/css',
      '.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png'})[extname(file)]||'application/octet-stream');
    response.end(await readFile(file));
  }catch{response.writeHead(404).end();}
});
await new Promise(done=>sourceServer.listen(0,'127.0.0.1',done));
const sourceBase='http://127.0.0.1:'+sourceServer.address().port;
const module=pathToFileURL(resolve('apps/api/dist/apps/api/src/index.js')).href;
const apiServer=spawn(process.execPath,['--input-type=module','-e',
  'import{createProductionApiServer}from '+JSON.stringify(module)+';const server=await createProductionApiServer();'+
  "server.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));"+
  "process.once('SIGTERM',()=>server.close(()=>process.exit(0)));"],{
  stdio:['ignore','ignore','inherit','ipc'],env:{...process.env,PORT:'4310',FIRST_SLICE_STORE:'sqlite',
    FIRST_SLICE_SQLITE_FILE:join(scratch,'owned.sqlite'),FIRST_SLICE_BOOTSTRAP_DEMO:'true',
    FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',FIRST_SLICE_PROOF_OF_WORK_SCOPES:''}
});
const apiClosed=new Promise(done=>apiServer.once('close',done));
const labels=['Alpha Booklet','Beta Booklet','Gamma Booklet'];
const longLabels=['Eine längere Bezeichnung mit mehreren Worten, die die verfügbare Breite der Original-Karte überschreitet und vollständig umbricht.',
  'UntrennbaresTestheft'+'a'.repeat(140),labels[2]];
const actionTexts={booklet_starterStartTestButtonLabel:'Los geht’s',booklet_starterContinueTestButtonLabel:'Jetzt fortsetzen',
  booklet_starterLockedTestButtonLabel:'Teil abgeschlossen'};
const comparisons={},referenceReproducibility={},diagnostics=[],faultControls=[],errors=[],unknown=[],sourceWrites=[],candidateWrites=[];
let browser;
try {
  const port=await raceWithSmokeDeadline(new Promise((done,reject)=>{
    apiServer.once('message',message=>done(message.port));apiServer.once('error',reject);
    apiServer.once('exit',()=>reject(Error('Owned API exited before listening.')));
  }),20_000,()=>{throw Error('Owned API startup timed out.');});
  const base='http://127.0.0.1:'+port;let token;
  const api=async(path,body,method=body===undefined?'GET':'POST')=>{
    const response=await fetch(base+path,{method,headers:{...(token?{authorization:'Bearer '+token}:{}),
      ...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    assert.ok(response.ok,'Owned setup HTTP '+response.status+': '+method+' '+path+(response.ok?'':': '+(await response.text()).slice(0,1200)));
    return response.status===204?null:response.json();
  };
  token=(await api('/api/v1/admin/auth/sign-in',{username:'demo-admin',password:'demo-admin-password'})).sessionToken;
  const operatorToken=token,fixtures={};
  for(const state of ['fresh','mixed','long','review']) {
    const workspaceKey='paired-starter-'+state,names=state==='long'?longLabels:labels;
    await api('/api/v1/tenants/demo-tenant/workspaces',{workspaceKey,displayName:'Owned starter '+state});
    const workspace='/api/v1/tenants/demo-tenant/workspaces/'+workspaceKey;
    const source=await api(workspace+'/source-packages',{fileName:'starter.json',mediaType:'application/json',
      contentStructure:{bookletEntries:names.map((displayLabel,index)=>({bookletKey:'reference-'+index,displayLabel,
        unitEntries:[{unitKey:'reference-unit-'+index,displayLabel:'Unit '+index}]}))}});
    const imported=await api(workspace+'/import-jobs',{sourcePackageId:source.sourcePackage.sourcePackageId});
    await api(workspace+'/content-releases/'+imported.stagedContentRelease.contentReleaseId+'/activate',{activatedByActorId:'owned-paired-starter'});
    const texts=state==='mixed'?actionTexts:{};
    await api(workspace+'/participant-roster',{rosterText:'<Testtakers xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/testcenter-testtaker-xml/18.0"><Metadata/>'+
      (Object.keys(texts).length?'<CustomTexts>'+Object.entries(texts).map(([key,value])=>'<CustomText key="'+key+'">'+value+'</CustomText>').join('')+'</CustomTexts>':'')+
      '<Group id="reference" label="Reference"><Login mode="'+(state==='review'?'run-review':'run-hot-return')+'" name="paired-starter">'+
      names.map((_,index)=>'<Booklet>reference-'+index+'</Booklet>').join('')+'</Login></Group></Testtakers>'});
    if(state==='mixed') {
      const identity=await api('/api/v1/participant/auth/sign-in',{tenantKey:'demo-tenant',workspaceKey,loginKey:'paired-starter'});
      token=identity.sessionToken;
      const sessionPath='/api/v1/participant/sessions/'+identity.participantSession.participantSessionId;
      const second=await api(sessionPath+'/resume',{bookletKey:'reference-1'});
      await api('/api/v1/participant/test-runs/'+second.testRun.testRunId+'/save-progress',
        {currentUnitKey:'reference-unit-1',unitResponse:'Owned completed starter answer',status:'running'});
      await api('/api/v1/participant/test-runs/'+second.testRun.testRunId+'/complete',{});
      const first=await api(sessionPath+'/resume',{bookletKey:'reference-0'});
      await api('/api/v1/participant/test-runs/'+first.testRun.testRunId+'/save-progress',
        {currentUnitKey:'reference-unit-0',unitResponse:'Owned exact continuing starter answer',status:'running'});
      await api('/api/v1/participant/test-runs/'+first.testRun.testRunId+'/return-to-starter',{});
      token=operatorToken;
    }
    fixtures[state]={workspaceKey,names};
  }
  browser=await chromium.launch({headless:false});
  for(const theme of ['Primar','Sekundar','Erwachsene']) {
    await api('/api/v1/admin/application-settings',{themeName:theme},'PATCH');
    for(const [state,fixture]of Object.entries(fixtures))for(const [screen,width,height]of
      [['desktop',1280,720],['mobile',390,844],['toolbar-small',599,844],['toolbar-large',600,844]]) {
      const key=theme+'-'+state+'-'+screen,captures={};
      for(const kind of ['source','rewrite','source-repeat']) {
        const source=kind!=='rewrite';
        const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,locale:'de-DE',timezoneId:'Europe/Berlin',serviceWorkers:'block'});
        const page=await context.newPage();await page.bringToFront();
        page.on('pageerror',error=>errors.push({key,kind,error:String(error)}));
        const auth={token:'owned-source-starter',displayName:'paired-starter',loginName:'paired-starter',groupLabel:'Reference',flags:[],
          customTexts:state==='mixed'?actionTexts:{},viewSettings:{theme},claims:{test:fixture.names.map((label,index)=>({
            id:'reference-'+index,label,workspaceId:'1',description:'',type:'test',flags:state==='mixed'?{running:index===0,locked:index===1}:{}})),
            ...(state==='review'?{review:[]}:{})}};
        if(source)await context.route(sourceBase+'/api/**',async route=>{
          const request=route.request(),path=new URL(request.url()).pathname;let body;
          if(path==='/api/system/config')body={version:'Rewrite',customTexts:{},appConfig:{themeName:theme,appTitle:'IQB-Testcenter'},
            veronaPlayerApiVersionMin:2,veronaPlayerApiVersionMax:6,iqbStandardResponseTypeMin:1,iqbStandardResponseTypeMax:5,
            xmlSchemaVersions:{},bruteForceProtection:[],broadcastingServiceUri:'',fileServiceUri:'',passwordMinLength:0,passwordPattern:''};
          else if(path==='/api/sys-check-mode')body=false;
          else if(path==='/api/asset-assignments')body={};
          else if(path==='/api/assets')body=[];
          else if(path==='/api/session'&&request.method()==='GET')body=auth;
          else if(path==='/api/session/login'&&request.method()==='PUT'){
            assert.deepEqual(request.postDataJSON(),{name:'paired-starter',password:''});sourceWrites.push({key,kind,path});body=auth;
          }else{unknown.push({key,kind,path,method:request.method()});return route.fulfill({status:404,body:'{}'});}
          await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
        });
        else page.on('request',request=>{
          const path=new URL(request.url()).pathname;
          if(request.method()!=='GET'&&path.startsWith('/api/'))candidateWrites.push({key,path,method:request.method()});
        });
        await page.goto(source?sourceBase+'/#/r/login':base+'/app/participant?ui=original&tenantKey=demo-tenant&workspaceKey='+fixture.workspaceKey,{waitUntil:'networkidle'});
        await page.locator(source?'input[formcontrolname=name]':'#originalLoginName').fill('paired-starter');
        const signedIn=page.waitForResponse(response=>new URL(response.url()).pathname===(source?'/api/session/login':'/api/v1/participant/auth/sign-in'));
        await page.getByRole('button',{name:'Weiter',exact:true}).click();const response=await signedIn;assert.equal(response.status(),200);
        if(!source)assert.notEqual((await response.json()).sessionToken,operatorToken);
        const starter=page.locator(source?'tc-starter':'#originalParticipantStarter');
        await starter.locator('mat-card').nth(2).waitFor();
        assert.deepEqual(await starter.locator('mat-card-header p').allTextContents(),fixture.names);
        assert.deepEqual(await starter.locator('mat-card button').evaluateAll(buttons=>buttons.map(button=>button.disabled)),
          state==='mixed'?[false,true,false]:[false,false,false]);
        const review=starter.locator(source?'[data-cy="review-download"]':'#originalDownloadReviews');
        assert.equal(await review.count(),state==='review'?1:0);
        const measure=()=>page.evaluate(()=>({viewport:[innerWidth,innerHeight],dpr:devicePixelRatio,windowScroll:[scrollX,scrollY],documentFocused:document.hasFocus(),
          active:[document.activeElement.tagName,document.activeElement.id],hover:[...document.querySelectorAll(':hover')].map(element=>[element.tagName,element.id]),
          layout:[...document.querySelectorAll('.intro,.cards,mat-card,.sentinel,.button-box,.scroll-button')].map(element=>({
            box:element.getBoundingClientRect().toJSON(),scroll:[element.scrollLeft,element.scrollTop]}))}));
        for(const phase of state==='review'?['initial','review-hover']:['initial']) {
          if(phase==='review-hover') {
            await review.hover();
            assert.equal(await review.evaluate(element=>getComputedStyle(element).transform),'none',
              'The native review button remains in position while hovered.');
          }
          console.log('starter_viewport_capture='+key+'/'+kind+'/'+phase);
          await page.bringToFront();await page.waitForFunction(()=>document.hasFocus());
          if(phase==='initial')await page.mouse.move(0,0);
          await page.evaluate(()=>document.fonts.ready);
          await page.waitForFunction(()=>[...document.images].every(image=>image.complete&&image.naturalWidth>0));
          await page.waitForFunction(()=>!document.querySelector('.mat-ripple-element:not(.mat-radio-persistent-ripple)')&&
            document.getAnimations().filter(animation=>animation.effect?.getComputedTiming().iterations!==Infinity)
              .every(animation=>!animation.pending&&(animation.playState==='finished'||animation.playState==='idle')));
          await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
          const result=await captureStableViewport(page,measure,join(artifacts,key+'-'+phase+'-'+kind+'.png'));
          diagnostics.push({key,phase,kind,geometry:result.geometry,paint:result.paintDiagnostics});
          if(kind==='source')captures[phase]=result.bytes;
          else if(kind==='rewrite')comparisons[key+'-'+phase]=await compareScreenshots(page,captures[phase],result.bytes);
          else referenceReproducibility[key+'-'+phase]=await compareScreenshots(page,captures[phase],result.bytes);
          if(kind==='rewrite'&&state==='fresh'&&screen==='desktop') {
            for(const[fault,selector,css]of[
              ['card-border','#originalParticipantStarter mat-card:first-child','border-color:#ef0011!important'],
              ['intro-position','#originalParticipantStarter .intro','transform:translateY(1px)!important']
            ]) {
              assert.equal(await page.locator(selector).count(),1);
              const style=await page.addStyleTag({content:selector+'{'+css+'}'});let mutation;
              try{
                const changed=await captureStableViewport(page,measure,join(artifacts,key+'-fault-'+fault+'.png'));
                mutation=await compareScreenshots(page,result.bytes,changed.bytes);
                assert.ok(mutation.differingPixels>0,'An actual '+fault+' defect must fail the complete comparison.');
              }finally{await style.evaluate(element=>element.remove());}
              const restored=await captureStableViewport(page,measure,join(artifacts,key+'-restored-'+fault+'.png'));
              const recovery=await compareScreenshots(page,result.bytes,restored.bytes);
              assert.equal(recovery.differingPixels,0);faultControls.push({key,fault,mutation,recovery});
            }
          }
        }
        await context.close();
      }
      console.log('paired_starter='+key+':captured');
    }
  }
  assert.equal(Object.keys(comparisons).length,60);assert.equal(Object.keys(referenceReproducibility).length,60);
  assert.equal(faultControls.length,6);
  assert.equal(sourceWrites.length,96);assert.equal(candidateWrites.length,48);
  assert.ok(candidateWrites.every(request=>request.path==='/api/v1/participant/auth/sign-in'&&request.method==='POST'));
  assert.deepEqual(errors,[]);assert.deepEqual(unknown,[]);
  assert.deepEqual(Object.entries(referenceReproducibility).filter(([,v])=>v.differingPixels),[],'Source must reproduce every complete starter viewport.');
  assert.deepEqual(Object.entries(comparisons).filter(([,v])=>v.differingPixels),[],'Every complete starter viewport must match Source.');
}finally{
  await writeFile(join(artifacts,'starter-viewports.json'),JSON.stringify({source:originalBrowserSource,manifest,
    scope:'Unchanged Source frontend on owned UI DTOs; real protected candidate API. Source backend authorization not established.',
    comparisons,referenceReproducibility,diagnostics,faultControls,errors,unknown,sourceWrites,candidateWrites},null,2));
  await browser?.close();apiServer.kill('SIGTERM');
  await raceWithSmokeDeadline(apiClosed,10_000,()=>{apiServer.kill('SIGKILL');throw Error('Owned API shutdown timed out.');});
  await rm(scratch,{recursive:true,force:true});await new Promise(done=>sourceServer.close(done));await verifyOriginalBuild(root);
}
