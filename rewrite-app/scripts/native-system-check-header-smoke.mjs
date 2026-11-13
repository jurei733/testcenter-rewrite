import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,mkdtemp,readFile,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {systemCheckXml} from './native-system-check-fixture.mjs';
import {raceWithSmokeDeadline} from './smoke-deadline.mjs';
import {stopNativeSmokeServer} from './native-monitor-smoke-io.mjs';
import {waitForFiniteDocumentAnimations} from './finite-animation-ready.mjs';
import {compareScreenshots} from './exact-rgba-comparison.mjs';

const fixture=new URL('../test-fixtures/original-testcenter/source-workspace-results/native-syscheck-public-header/',import.meta.url);
const manifest=JSON.parse(await readFile(new URL('manifest.json',fixture)));
for(const[name,sha]of Object.entries(manifest.files)){
 assert.match(name,/^[A-Za-z0-9.-]+$/);
 assert.equal(createHash('sha256').update(await readFile(new URL(name,fixture))).digest('hex'),sha);
}
const source=JSON.parse(await readFile(new URL('observations.json',fixture)));
assert.equal(source.actualSourceBackend,true);assert.equal(source.actualSourceFrontend,true);
assert.equal(source.apiMocks,false);assert.equal(source.sqlSeedsOrDaoStubs,false);
assert.equal(source.controls.length,12);assert.equal(source.selfControls.length,36);
for(const row of source.controls){
 assert.equal(row.freshHeader,'');assert.equal(row.afterLogin,'Anmelden');
 assert.equal(row.afterSystemcheck,'Systemcheck');assert.equal(row.reloadResetsHeader,true);
}

/** Actual public routes, protected settings HTTP, real browser history and
 * full reload. Source pixels are compared independently for matching platforms;
 * the mandatory functional cohort also runs on other supported CI platforms. */
export async function runNativeSystemCheckHeaderChecks({browser,out,mark}){
 await mkdir(out,{recursive:true});
 const runtime=await mkdtemp(join(out,'runtime-')),checks=[],wire=[],errors=[],ui=[],selfControls=[],controls=[];
 let server,context,page,base,token,stage='setup';
 const passed=name=>{checks.push(name);mark('native-system-check-header-'+name);};
 const api=async(path,body,method=body===undefined?'GET':'POST',expected=200,credential=token)=>{
  const response=await fetch(base+path,{method,headers:{Accept:'application/json',
   ...(credential?{authorization:'Bearer '+credential}:{}),
   ...(body===undefined?{}:{'content-type':'application/json'})},
   ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
  const text=await response.text();let value;try{value=JSON.parse(text);}catch{value=text;}
  assert.equal(response.status,expected,method+' '+path+': '+text);return value;
 };
 const capture=async(name,meta)=>{
  await page.evaluate(()=>document.fonts.ready);
  await page.waitForFunction(()=>Array.from(document.images).every(image=>image.complete&&image.naturalWidth>0));
  await page.mouse.move(0,0);await waitForFiniteDocumentAnimations(page);
  const first=await page.screenshot({path:join(out,name+'.png')});
  await page.evaluate(()=>{
   const cover=document.createElement('div');cover.id='owned-repaint-control';
   cover.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#fff;pointer-events:none';
   document.body.append(cover);
  });
  const witnesses=[];
  for(let index=0;index<3;index++){
   await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));
   const png=await page.screenshot({path:join(out,name+'-white-'+index+'.png')});
   const result=await page.evaluate(async base64=>{
    const image=new Image();image.src='data:image/png;base64,'+base64;await image.decode();
    const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;
    const ctx=canvas.getContext('2d');ctx.drawImage(image,0,0);
    const pixels=ctx.getImageData(0,0,canvas.width,canvas.height).data;let nonWhite=0;
    for(let i=0;i<pixels.length;i+=4)if(pixels[i]!==255||pixels[i+1]!==255||pixels[i+2]!==255||pixels[i+3]!==255)nonWhite++;
    return{width:canvas.width,height:canvas.height,nonWhite};
   },png.toString('base64'));
   assert.equal(result.nonWhite,0);witnesses.push(result);
  }
  await page.evaluate(()=>{
   document.getElementById('owned-repaint-control').remove();
   return new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));
  });
  await waitForFiniteDocumentAnimations(page);
  const second=await page.screenshot({path:join(out,name+'-self.png')});
  const comparison=await compareScreenshots(page,first,second);
  assert.equal(comparison.differingPixels,0,name+' Rewrite repaint control');
  selfControls.push({name,...meta,comparison,witnesses});
  ui.push({name,...meta,header:await page.locator('[data-cy=header] .center').innerText(),
   bodyClass:await page.locator('body').getAttribute('class'),text:await page.locator('body').innerText()});
 };
 try{
  server=spawn(process.execPath,[resolve('scripts/native-system-check-server.mjs')],{
   stdio:['ignore','ignore','inherit','ipc'],env:{...process.env,FIRST_SLICE_STORE:'sqlite',
    FIRST_SLICE_SQLITE_FILE:join(runtime,'owned.sqlite'),FIRST_SLICE_BOOTSTRAP_DEMO:'false',
    FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',FIRST_SLICE_XML_SCHEMA_PROFILE:'original-19',
    FIRST_SLICE_PROOF_OF_WORK_SCOPES:'',REQUIRE_LOGIN_PASSWORD:'false'}});
  const port=await raceWithSmokeDeadline(new Promise((done,reject)=>{
   server.once('message',message=>done(message.port));server.once('error',reject);
   server.once('exit',()=>reject(Error('Owned header API exited.')));
  }),20000,()=>{throw Error('Owned header API startup timed out.');});
  base='http://127.0.0.1:'+port;
  await api('/api/v1/admin/auth/bootstrap',{username:'owned-header-admin',displayName:'Owned header admin',
   password:'owned-header-admin-password'},'POST',201,'');
  token=(await api('/api/v1/admin/auth/sign-in',{username:'owned-header-admin',
   password:'owned-header-admin-password'},'POST',200,'')).sessionToken;
  await api('/api/v1/platform/tenants',{tenantKey:'owned-header',displayName:'Owned header'},'POST',201);
  await api('/api/v1/tenants/owned-header/workspaces',{workspaceKey:'header',displayName:'Owned header'},'POST',201);
  const scope='/api/v1/tenants/owned-header/workspaces/header';
  await api(scope+'/files',{fileName:'header.xml',mediaType:'application/xml',
   sourceDocument:systemCheckXml('SysCheck','<Metadata><Id>R107.CHECK</Id><Label>Owned public header check</Label></Metadata><Config skipnetwork="true" savekey="owned-key"/>')},'POST',201);
  const directory=await api('/sys-checks',undefined,'GET',200,'');
  assert.equal(directory.length,1);
  const number=String(directory[0].workspaceId);
  for(const theme of ['Primar','Sekundar','Erwachsene']){
   await api('/api/v1/admin/application-settings',{themeName:theme},'PATCH');
   for(const width of [1280,390]){
    context=await browser.newContext({viewport:{width,height:850}});page=await context.newPage();
    page.setDefaultTimeout(20000);const meta={theme,width,height:850,browser:browser.version()},prefix=theme+'-'+width;
    page.on('pageerror',error=>errors.push(String(error)));
    page.on('request',request=>{
     const path=new URL(request.url()).pathname;if(path.startsWith('/app/'))return;
     wire.push({...meta,method:request.method(),path,nativeToken:!!request.headers().authtoken,
      canonicalToken:!!request.headers().authorization});
    });
    const directoryReady=async navigate=>{
     const reply=page.waitForResponse(r=>r.request().method()==='GET'&&new URL(r.url()).pathname==='/sys-checks');
     await navigate();assert.equal((await reply).status(),200);
     await page.getByRole('button',{name:'Owned public header check',exact:true}).waitFor();
    };
    stage=prefix+'-fresh';
    await directoryReady(()=>page.goto(base+'/app/r/check-starter'));
    await page.waitForFunction(theme=>document.documentElement.dataset.applicationTheme===theme&&document.documentElement.dataset.interfaceMode==='original',theme);
    const documentTime=await page.evaluate(()=>performance.timeOrigin);
    assert.equal(await page.locator('[data-cy=header] .center').innerText(),'');
    await capture(prefix+'-selection-fresh',meta);passed(prefix+'-fresh-selection-has-no-invented-title');
    const navigation=await context.newCDPSession(page),history=await navigation.send('Page.getNavigationHistory');
    const selectionEntry=history.entries[history.currentIndex].id;
    stage=prefix+'-login';
    await page.getByRole('button',{name:/zurück zur Startseite/}).click();
    await page.getByRole('textbox',{name:'Anmeldename',exact:true}).waitFor();
    assert.equal(await page.locator('[data-cy=header] .center').innerText(),'Anmelden');
    await directoryReady(()=>navigation.send('Page.navigateToHistoryEntry',{entryId:selectionEntry}));
    assert.equal(await page.locator('[data-cy=header] .center').innerText(),'Anmelden');
    assert.equal(await page.evaluate(()=>performance.timeOrigin),documentTime);
    await capture(prefix+'-selection-login',meta);passed(prefix+'-selection-retains-the-real-login-title');
    stage=prefix+'-systemcheck';
    const config=page.waitForResponse(r=>r.request().method()==='GET'&&new URL(r.url()).pathname==='/workspace/'+number+'/sys-check/R107.CHECK');
    await page.getByRole('button',{name:'Owned public header check',exact:true}).click();
    assert.equal((await config).status(),200);await page.locator('#syscheck-next-step:enabled').waitFor();
    assert.equal(await page.locator('[data-cy=header] .center').innerText(),'Systemcheck');
    await directoryReady(()=>navigation.send('Page.navigateToHistoryEntry',{entryId:selectionEntry}));
    assert.equal(await page.locator('[data-cy=header] .center').innerText(),'Systemcheck');
    assert.equal(await page.evaluate(()=>performance.timeOrigin),documentTime);
    await capture(prefix+'-selection-systemcheck',meta);passed(prefix+'-selection-retains-the-real-systemcheck-title');
    stage=prefix+'-reload';
    await directoryReady(()=>page.reload());
    assert.equal(await page.locator('[data-cy=header] .center').innerText(),'');
    assert.notEqual(await page.evaluate(()=>performance.timeOrigin),documentTime);
    passed(prefix+'-full-reload-resets-the-public-title');
    controls.push({...meta,freshHeader:'',afterLogin:'Anmelden',afterSystemcheck:'Systemcheck',reloadResetsHeader:true});
    await context.close();context=undefined;page=undefined;
   }
  }
  assert.equal(wire.some(row=>row.nativeToken||row.canonicalToken),false);
  const reports=await api(scope+'/system-check-reports?checkId=R107.CHECK');
  assert.equal(reports.items.length,0);assert.deepEqual(errors,[]);
  await writeFile(join(out,'result.json'),JSON.stringify({success:true,browser:browser.version(),checks,
   controls,ui,selfControls,wire,errors,actualReportsPersisted:0,actualSourceFrontendReference:true,
   sourceFixture:manifest.sourceCommit,visualParityProven:false},null,2)+'\n');
  return checks;
 }catch(error){
  await page?.screenshot({path:join(out,'failure.png')}).catch(()=>{});
  await writeFile(join(out,'failure.json'),JSON.stringify({stage,error:String(error),stack:error.stack,
   checks,ui,controls,wire,errors},null,2)+'\n');throw error;
 }finally{await context?.close();if(server)await stopNativeSmokeServer(server);}
}
