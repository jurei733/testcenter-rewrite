import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {createServer} from 'node:http';
import {mkdtemp, mkdir, readFile, writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {extname, join, relative, resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {chromium} from 'playwright';
import {originalBrowserSource, originalDirectoryReference, verifyOriginalBuild} from './original-browser-reference.mjs';
import {raceWithSmokeDeadline} from './smoke-deadline.mjs';
import {compareScreenshots} from './exact-rgba-comparison.mjs';
import {captureStableViewport} from './stable-viewport-capture.mjs';

assert.equal(process.env.UI_SMOKE_HEADFUL, 'true');
assert.ok(!process.env.UI_SMOKE_BROWSER_CHANNEL, 'Source and Rewrite use the lockfile Chromium.');
assert.equal(process.env.ORIGINAL_PLAYER_REFERENCE_COMMIT, originalBrowserSource.commit);
const root = resolve(process.env.ORIGINAL_PLAYER_REFERENCE_ROOT);
const artifacts = resolve(process.env.UI_SMOKE_ARTIFACT_DIR);
const manifest = await verifyOriginalBuild(root);
const scratch = await mkdtemp(join(tmpdir(), 'original-directory-paired-'));
await mkdir(artifacts, {recursive: true});
const notices = {privacyNotice: 'Eigener Datenschutz aus dem Bestand',
  accessibilityNotice: 'Bestand Barrierefreiheit', legalNoticeHtml: 'Bestand Impressum'};
const sourceServer = createServer(async (request, response) => {
  try {
    const pathname = decodeURIComponent(new URL(request.url, 'http://localhost').pathname);
    const file = resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (relative(root, file).startsWith('..')) return response.writeHead(404).end();
    response.setHeader('content-type', ({'.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
      '.woff2': 'font/woff2', '.svg': 'image/svg+xml', '.png': 'image/png'})[extname(file)] || 'application/octet-stream');
    response.end(await readFile(file));
  } catch { response.writeHead(404).end(); }
});
await new Promise(done => sourceServer.listen(0, '127.0.0.1', done));
const sourceBase = 'http://127.0.0.1:' + sourceServer.address().port;
const module = pathToFileURL(resolve('apps/api/dist/apps/api/src/index.js')).href;
const apiServer = spawn(process.execPath, ['--input-type=module', '-e',
  'import{createProductionApiServer}from ' + JSON.stringify(module) + ';const server=await createProductionApiServer();' +
  "server.listen(0,'127.0.0.1',()=>process.send({port:server.address().port}));" +
  "process.once('SIGTERM',()=>server.close(()=>process.exit(0)));"], {
  stdio: ['ignore', 'ignore', 'inherit', 'ipc'], env: {...process.env, PORT: '4310', FIRST_SLICE_STORE: 'sqlite',
    FIRST_SLICE_SQLITE_FILE: join(scratch, 'owned.sqlite'), FIRST_SLICE_BOOTSTRAP_DEMO: 'true',
    FIRST_SLICE_OPERATOR_AUTH_REQUIRED: 'true', FIRST_SLICE_PROOF_OF_WORK_SCOPES: ''}
});
const apiClosed = new Promise(done => apiServer.once('close', done));
let browser;
const states = {}, comparisons = {}, referenceReproducibility = {}, documentDiagnostics = [], errors = [], unknown = [];
const options = width => ({viewport: {width, height: 844}, deviceScaleFactor: 1,
  locale: 'de-DE', timezoneId: 'Europe/Berlin', colorScheme: 'light'});

async function snapshot(page, key, kind) {
  await page.evaluate(() => document.fonts.ready);
  await page.locator('[data-cy="header"] h1').click(); await page.mouse.move(0, 0);
  await page.waitForFunction(() => !document.querySelector('.mat-ripple-element:not(.mat-radio-persistent-ripple)') &&
    document.getAnimations().filter(animation => animation.effect?.getComputedTiming().iterations !== Infinity)
      .every(animation => !animation.pending && animation.playState !== 'running'));
  const measure = () => page.evaluate(() => {
    const box = element => {const r = element.getBoundingClientRect(), s = getComputedStyle(element);
      return {tag: element.tagName, text: element.textContent.trim(), x:r.x, y:r.y, width:r.width, height:r.height,
        font:s.font, padding:s.padding, boxSizing:s.boxSizing};};
    return {viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},
      tables:[...document.querySelectorAll('mat-table')].map(table => ({...box(table),
        rows:[...table.querySelectorAll('mat-header-row,mat-row')].map(box)})),
      checkboxes:[...document.querySelectorAll('input[type="checkbox"]')].map(input => ({checked:input.checked,disabled:input.disabled})),
      buttons:[...document.querySelectorAll('mat-tab-nav-panel button')].map(button => ({...box(button),disabled:button.disabled}))};
  });
  const result = await captureStableViewport(page, measure, join(artifacts, kind+'-'+key+'.png'));
  await writeFile(join(artifacts, kind+'-'+key+'.json'), JSON.stringify({geometry:result.geometry,paintDiagnostics:result.paintDiagnostics},null,2));
  (states[key] ??= {})[kind] = result;
  if(kind === 'rewrite') {
    comparisons[key] = await compareScreenshots(page, states[key].source.bytes, result.bytes);
    console.log('paired_original_directory='+key+': '+comparisons[key].differingPixels+' differing pixels');
  } else if(kind === 'source-repeat') {
    referenceReproducibility[key] = await compareScreenshots(page, states[key].source.bytes, result.bytes);
    console.log('source_directory_reproducibility='+key+': '+referenceReproducibility[key].differingPixels+' differing pixels');
  }
}
try {
  const port = await raceWithSmokeDeadline(new Promise((done,reject)=>{
    apiServer.once('message',message=>done(message.port));apiServer.once('error',reject);
    apiServer.once('exit',()=>reject(Error('Owned API exited before listening.')));
  }),20_000,()=>{throw Error('Owned API startup timed out.');});
  const base = 'http://127.0.0.1:'+port;let token;
  const api = async(path,body,method=body===undefined?'GET':'POST')=>{
    const response = await fetch(base+path,{method,headers:{...(token?{authorization:'Bearer '+token}:{}),
      ...(body===undefined?{}:{'content-type':'application/json'})},...(body===undefined?{}:{body:JSON.stringify(body)})});
    assert.ok(response.ok,'Owned setup HTTP '+response.status+': '+method+' '+path);return response.json();
  };
  token = (await api('/api/v1/admin/auth/sign-in',{username:'demo-admin',password:'demo-admin-password'})).sessionToken;
  await api('/api/v1/platform/tenants',{tenantKey:'owned-directory',displayName:'Owned directory scope'});
  const alpha = (await api('/api/v1/tenants/owned-directory/workspaces',{workspaceKey:'alpha',displayName:'Alpha Bereich'})).workspace;
  await api('/api/v1/tenants/demo-tenant/workspaces',{workspaceKey:'zeta',displayName:'Zeta Bereich'});
  const reader = (await api('/api/v1/admin/users',{username:'owned-reader',displayName:'owned-reader',password:'Owned-directory-password-9!',roleAssignments:[]})).adminUser;
  await api('/api/v1/admin/users/'+reader.adminUserId+'/role-assignments',
    {role:'workspace_admin',tenantKey:'owned-directory',workspaceKey:'alpha',accessMode:'read_only'});
  const admins = (await api('/api/v1/admin/users')).items;
  const tenants = (await api('/api/v1/platform/tenants')).items;
  const workspaces = [];
  for(const tenant of tenants)workspaces.push(...(await api('/api/v1/tenants/'+tenant.tenantKey+'/workspaces')).items);
  // The Source DAO orders names globally; never reuse the candidate UI's row order.
  const users = [...admins].sort((a,b)=>a.adminUser.username.localeCompare(b.adminUser.username))
    .map((item,index)=>({id:index+1,name:item.adminUser.username,email:'',isSuperadmin:item.roleAssignments.some(role=>role.role==='platform_admin'),item}));
  const spaces = [...workspaces].sort((a,b)=>a.displayName.localeCompare(b.displayName))
    .map((item,index)=>({id:index+1,name:item.displayName,latest_modification_ts:item.latestFileModificationAt??null,item}));
  const sourceRole = (user,workspace)=>{
    const assignment=user.item.roleAssignments.find(role=>role.role==='workspace_admin'&&role.workspaceId===workspace.item.workspaceId);
    return assignment?assignment.accessMode==='read_write'?'RW':'RO':'';
  };
  const before = (await api('/api/v1/system/application-settings')).applicationSettings;
  browser = await chromium.launch({headless:false});
  for(const theme of ['Primar','Sekundar','Erwachsene']) {
    await api('/api/v1/admin/application-settings',{...before,...notices,themeName:theme},'PATCH');
    const login = await browser.newContext(options(1280)), loginPage = await login.newPage();await loginPage.bringToFront();
    await loginPage.goto(base+'/app/ops?ui=original',{waitUntil:'networkidle'});
    await loginPage.locator('#adminUsername').fill('demo-admin');await loginPage.locator('#adminPassword').fill('demo-admin-password');
    const signedIn=loginPage.waitForResponse(response=>new URL(response.url()).pathname==='/api/v1/admin/auth/sign-in'&&response.ok());
    await loginPage.locator('#adminSignInButton').click();assert.notEqual((await(await signedIn).json()).sessionToken,token);
    await loginPage.locator('#originalSystemAdministration[aria-busy="false"]').waitFor();
    const storageState=await login.storageState();await login.close();
    for(const width of [1280,390]) {
      const context=await browser.newContext({...options(width),storageState});
      await context.addInitScript(({theme,sourceOrigin,adminId})=>{
        if(location.origin!==sourceOrigin)return;
        localStorage.setItem('iqb-tc-a',JSON.stringify({token:'owned-directory-reference',displayName:'Owned Admin',loginName:'demo-admin',groupLabel:'',id:adminId,
          flags:[],customTexts:{},claims:{superAdmin:[{id:'1',label:'Systemverwaltung',type:'superAdmin',flags:{},workspaceId:'',description:''}]},viewSettings:{theme}}));
      },{theme,sourceOrigin:sourceBase,adminId:users.find(user=>user.name==='demo-admin').id});
      await context.route(sourceBase+'/api/**',async route=>{
        const method=route.request().method(),path=new URL(route.request().url()).pathname;let body;
        if(method!=='GET'){unknown.push({method,path});return route.fulfill({status:403,body:'{}'});}
        if(path==='/api/system/config')body={version:'Owned directory reference',customTexts:{},appConfig:{appTitle:before.appTitle,themeName:theme,...notices},
          veronaPlayerApiVersionMin:2,veronaPlayerApiVersionMax:6,iqbStandardResponseTypeMin:1,iqbStandardResponseTypeMax:5,xmlSchemaVersions:{},
          bruteForceProtection:[],broadcastingServiceUri:'',fileServiceUri:'',passwordMinLength:0,passwordPattern:''};
        else if(path==='/api/sys-check-mode')body=false;
        else if(path==='/api/asset-assignments')body={};
        else if(path==='/api/assets')body=[];
        else if(path==='/api/users')body=users.map(({item,...dto})=>dto);
        else if(path==='/api/workspaces')body=spaces.map(({item,...dto})=>dto);
        else if(/^\/api\/user\/\d+\/workspaces$/.test(path)){
          const user=users.find(user=>user.id===Number(path.split('/')[3]));assert.ok(user);
          body=spaces.map(workspace=>({id:workspace.id,name:workspace.name,selected:!!sourceRole(user,workspace),role:sourceRole(user,workspace)}));
        }else if(/^\/api\/workspace\/\d+\/users$/.test(path)){
          const workspace=spaces.find(workspace=>workspace.id===Number(path.split('/')[3]));assert.ok(workspace);
          body=users.map(user=>({id:user.id,name:user.name,selected:!!sourceRole(user,workspace),role:sourceRole(user,workspace)}));
        }else{unknown.push({method,path});return route.fulfill({status:404,body:'{}'});}
        await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
      });
      const page=await context.newPage();await page.bringToFront();
      page.on('pageerror',error=>errors.push({theme,width,error:String(error)}));
      for(const kind of ['source','rewrite','source-repeat'])for(const tab of ['users','workspaces']) {
        await page.goto('about:blank');
        const previous=await page.evaluate(()=>performance.timeOrigin);
        await page.goto(kind==='rewrite'?base+'/app/ops?ui=original&adminSection='+tab:sourceBase+'/#/superadmin/'+tab,{waitUntil:'networkidle'});
        const current=await page.evaluate(()=>performance.timeOrigin);assert.notEqual(current,previous);
        documentDiagnostics.push({kind,theme,width,tab,previous,current});
        if(kind==='rewrite')assert.equal(await page.evaluate(()=>localStorage.getItem('iqb-tc-a')),null);
        const expected=tab==='users'?users.length:spaces.length;
        await page.waitForFunction(expected=>document.querySelector('mat-table')?.querySelectorAll('mat-row').length===expected,expected);
        const key=theme+'-'+width+'-'+tab;
        await snapshot(page,key+'-initial',kind);
        const table=page.locator('mat-table').first();
        await table.locator('mat-row').filter({hasText:tab==='users'?'owned-reader':'Alpha Bereich'}).click();
        await page.waitForFunction(expected=>document.querySelectorAll('mat-table')[1]?.querySelectorAll('mat-row').length===expected,tab==='users'?spaces.length:users.length);
        await snapshot(page,key+'-selected',kind);
        const target=page.locator('mat-table').nth(1).locator('mat-row').filter({hasText:tab==='users'?'Alpha Bereich':'owned-reader'});
        if(tab==='users')await target.locator('input[type="checkbox"]').nth(1).check();
        else await target.locator('input[type="checkbox"]').first().uncheck();
        await page.locator('[data-cy="save"]:enabled').waitFor();
        await snapshot(page,key+'-draft',kind);
      }
      await context.close();
    }
  }
  assert.equal(Object.keys(comparisons).length,36);assert.equal(Object.keys(referenceReproducibility).length,36);
  assert.deepEqual(errors,[]);assert.deepEqual(unknown,[]);
  assert.deepEqual(Object.entries(comparisons).filter(([,v])=>v.differingPixels),[], 'Every full directory viewport must match Source.');
  assert.deepEqual(Object.entries(referenceReproducibility).filter(([,v])=>v.differingPixels),[], 'Source must reproduce every viewport.');
}finally{
  await writeFile(join(artifacts,'directory.json'),JSON.stringify({source:originalBrowserSource,directoryReference:originalDirectoryReference,manifest,
    scope:'Unchanged Source frontend with read-only fixtures derived from protected candidate setup; real candidate UI authentication. No Source backend authorization proof.',
    comparisons,referenceReproducibility,documentDiagnostics,errors,unknown},null,2));
  await browser?.close();apiServer.kill('SIGTERM');
  await raceWithSmokeDeadline(apiClosed,10000,()=>{apiServer.kill('SIGKILL');throw Error('Owned API shutdown timed out.');});
  await new Promise(done=>sourceServer.close(done));await verifyOriginalBuild(root);
}
