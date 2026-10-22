import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {mkdir,readFile,writeFile} from 'node:fs/promises';
import {extname,join,relative,resolve} from 'node:path';
import {chromium} from 'playwright';
import {originalBrowserSource,verifyOriginalBuild} from './original-browser-reference.mjs';
import {captureStableViewport} from './stable-viewport-capture.mjs';
import {compareScreenshots} from './exact-rgba-comparison.mjs';

// Source frontend evidence only. Owned API fixtures do not prove Source backend
// authorization, Candidate behavior or whole-workspace parity.
assert.equal(process.env.UI_SMOKE_HEADFUL,'true');
assert.equal(process.env.ORIGINAL_PLAYER_REFERENCE_COMMIT,originalBrowserSource.commit);
const root=resolve(process.env.ORIGINAL_PLAYER_REFERENCE_ROOT),artifacts=resolve(process.env.UI_SMOKE_ARTIFACT_DIR);
const sourceRoot=resolve(process.env.ORIGINAL_SOURCE_ROOT);
assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:sourceRoot,encoding:'utf8'}).trim(),originalBrowserSource.commit);
const manifest=await verifyOriginalBuild(root);await mkdir(artifacts,{recursive:true});
const sourcePaths=['workspace.component.ts','workspace.component.html','workspace.component.css','workspace.interfaces.ts','backend.service.ts',
  'files/files.component.ts','files/files.component.html','files/files.component.css'].map(path=>'frontend/src/app/workspace-admin/'+path);
sourcePaths.push('definitions/compatibility.json','frontend/src/app/shared/pipes/bytes/bytes.pipe.ts',
  'backend/src/data-collection/FileRelationshipType.class.php','backend/src/dao/WorkspaceDAO.class.php',
  'backend/src/files/XMLFileUnit.class.php','backend/src/files/XMLFileBooklet.class.php','backend/src/files/XMLFileTesttakers.class.php');
const sources=Object.fromEntries(sourcePaths.map(path=>[path,execFileSync('git',['show',`${originalBrowserSource.commit}:${path}`],{cwd:sourceRoot,encoding:'utf8'})]));
const provenance=sourcePaths.map(path=>({path,sha256:createHash('sha256').update(sources[path]).digest('hex')}));
const schemas=JSON.parse(sources['definitions/compatibility.json'])['xml-schema-versions'];
const file=(type,name,size,id,dependencies=[],info={})=>({type,name,size,id,modificationTime:'1792483200',isChecked:false,
  dependencies:dependencies.map(([object_name,relationship_type])=>({object_name,relationship_type})),report:{error:[],warning:[],info:[]},info});
const fixture={
  Testtakers:[file('Testtakers','owned.testtakers.xml',512,'OWNED_PEOPLE',[['owned.booklet.xml','hasBooklet'],['owned.unit.xml','containsUnit'],['owned.player.html','usesPlayer']],{testtakers:2,label:'Eigene Teilnehmer'})],
  Booklet:[file('Booklet','owned.booklet.xml',1024,'OWNED_BOOKLET',[['owned.unit.xml','containsUnit'],['owned.player.html','usesPlayer']],{label:'Eigenes Testheft'}),
    file('Booklet','second.booklet.xml',2048,'SECOND_BOOKLET',[['owned.unit.xml','containsUnit'],['owned.player.html','usesPlayer']],{label:'Zweites Testheft'})],
  SysCheck:[file('SysCheck','owned.syscheck.xml',384,'OWNED_CHECK',[],{label:'Eigener Systemcheck'})],
  Unit:[file('Unit','owned.unit.xml',1536,'OWNED_UNIT',[['owned.player.html','usesPlayer']],{label:'Eigene Aufgabe'})],
  Resource:[file('Resource','owned.player.html',4096,'OWNED.PLAYER',[],{veronaVersion:'6.0'})]
};
const unknown=[],errors=[],requests=[],states={},repeats={};let browser;
const server=createServer(async(request,response)=>{
  try{
    const pathname=new URL(request.url,'http://localhost').pathname;
    const path=resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(relative(root,path).startsWith('..'))return response.writeHead(404).end();
    response.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png'})[extname(path)]??'application/octet-stream');
    response.end(await readFile(path));
  }catch{response.writeHead(404).end();}
});
await new Promise(done=>server.listen(0,'127.0.0.1',done));const base='http://127.0.0.1:'+server.address().port;
async function capture(page,key,kind){
  await page.evaluate(()=>document.fonts.ready);
  if(!await page.locator('mat-dialog-container').count())await page.locator('[data-cy="header"] h1').click();
  await page.mouse.move(0,0);
  await page.waitForFunction(()=>!document.querySelector('.mat-ripple-element:not(.mat-radio-persistent-ripple)')&&
    document.getAnimations().filter(animation=>animation.effect?.getComputedTiming().iterations!==Infinity).every(animation=>!animation.pending&&animation.playState!=='running'));
  const measure=()=>page.evaluate(()=>{
    const box=node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node);return{x:r.x,y:r.y,width:r.width,height:r.height,font:s.font,padding:s.padding,text:node.textContent.trim()};};
    return{viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},
      heading:[...document.querySelectorAll('mat-toolbar h1')].map(box),tabs:[...document.querySelectorAll('a[mat-tab-link]')].map(box),
      panels:[...document.querySelectorAll('mat-expansion-panel')].map(box),
      rows:[...document.querySelectorAll('mat-header-row,mat-row')].map(node=>({...box(node),selected:node.classList.contains('selected-row'),dependency:node.classList.contains('isDependency')})),
      buttons:[...document.querySelectorAll('button[data-cy]')].map(node=>({...box(node),disabled:node.disabled})),
      checks:[...document.querySelectorAll('input[type=checkbox]')].map(node=>({checked:node.checked,disabled:node.disabled})),
      dialogs:[...document.querySelectorAll('mat-dialog-container')].map(box)};
  });
  const result=await captureStableViewport(page,measure,join(artifacts,kind+'-'+key+'.png'));
  await writeFile(join(artifacts,kind+'-'+key+'.json'),JSON.stringify({geometry:result.geometry,paintDiagnostics:result.paintDiagnostics},null,2));
  if(kind==='source')states[key]=result;
  else{repeats[key]=await compareScreenshots(page,states[key].bytes,result.bytes);assert.equal(repeats[key].differingPixels,0,key);}
  console.log('original_workspace_files='+kind+'/'+key+':passed');
}
try{
  browser=await chromium.launch({headless:false});
  for(const theme of ['Primar','Sekundar','Erwachsene'])for(const width of [1280,390])for(const role of ['RW','RO']){
    const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:1,locale:'de-DE',timezoneId:'Europe/Berlin',colorScheme:'light'});
    try{
      await context.addInitScript(({theme,role,origin})=>{if(location.origin!==origin)return;
        localStorage.setItem('iqb-tc-a',JSON.stringify({token:'owned-workspace-reference',displayName:'Owned Admin',loginName:'owned-admin',groupLabel:'',id:7,
          flags:[],customTexts:{},claims:{workspaceAdmin:[{id:'7',label:'Eigener Arbeitsbereich',type:'workspaceAdmin',flags:{mode:role},workspaceId:'7',description:''}]},viewSettings:{theme}}));
      },{theme,role,origin:base});
      let empty=true;
      await context.route(base+'/api/**',async route=>{
        const request=route.request(),path=new URL(request.url()).pathname,method=request.method();let body;
        requests.push({method,path});
        if(method==='POST'&&path==='/api/workspace/7/files-dependencies'){
          assert.equal(request.headers().authtoken,'owned-workspace-reference');
          assert.deepEqual([...request.postDataJSON().body].sort(),Object.values(empty?{}:fixture).flat().map(file=>file.name).sort());
          body=empty?Object.fromEntries(Object.keys(fixture).map(type=>[type,[]])):fixture;
        }else if(method!=='GET'){unknown.push({method,path});return route.fulfill({status:403,body:'{}'});}
        else if(path==='/api/system/config')body={version:'Owned Source files reference',customTexts:{},appConfig:{themeName:theme},
          veronaPlayerApiVersionMin:2,veronaPlayerApiVersionMax:6,iqbStandardResponseTypeMin:1,iqbStandardResponseTypeMax:5,xmlSchemaVersions:schemas,
          bruteForceProtection:[],broadcastingServiceUri:'',fileServiceUri:'',passwordMinLength:0,passwordPattern:''};
        else if(path==='/api/sys-check-mode')body=false;
        else if(path==='/api/asset-assignments')body={};
        else if(path==='/api/assets')body=[];
        else if(path==='/api/workspace/7/files')body=empty?Object.fromEntries(Object.keys(fixture).map(type=>[type,[]])):fixture;
        else{unknown.push({method,path});return route.fulfill({status:404,body:'{}'});}
        await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
      });
      // Independent native pages also isolate retained browser paint after
      // document replacement. The native clear/stability checks stay unchanged.
      for(const kind of ['source','source-repeat']){
        const page=await context.newPage();await page.bringToFront();page.on('pageerror',error=>errors.push(String(error)));
        const key=theme+'-'+width+'-'+role;empty=true;
        await page.goto('about:blank');await page.goto(base+'/#/admin/7/files',{waitUntil:'networkidle'});
        await page.locator('[data-cy="upload-files"]').waitFor();
        assert.equal(await page.locator('[data-cy="upload-files"]').isDisabled(),role==='RO');
        assert.equal(await page.locator('[data-cy="delete-files"]').isDisabled(),true);
        await capture(page,key+'-empty',kind);
        empty=false;await page.reload({waitUntil:'networkidle'});
        await page.waitForFunction(()=>document.querySelectorAll('mat-row').length===6);
        await page.locator('mat-spinner').waitFor({state:'detached'});
        await page.locator('[data-cy="upload-files"]:enabled').waitFor({state:role==='RW'?'visible':'detached'});
        assert.equal(await page.locator('[data-cy="delete-files"]').isDisabled(),true);
        assert.ok((await page.locator('mat-row').filter({hasText:'owned.booklet.xml'}).first().innerText()).includes('6.5 KB'));
        assert.ok((await page.locator('mat-row').filter({hasText:'owned.unit.xml'}).innerText()).includes('1.5 KB'));
        await capture(page,key+'-populated',kind);
        await page.locator('[data-cy="files-checkAll-Testtakers"] input').check();
        assert.equal(await page.locator('input[type=checkbox]:checked').count(),2);
        assert.equal(await page.locator('[data-cy="delete-files"]').isDisabled(),role==='RO');
        await capture(page,key+'-selected',kind);
        if(role==='RW'){
          await page.locator('[data-cy="delete-files"]').click();await page.locator('mat-dialog-container').waitFor();
          await capture(page,key+'-delete',kind);
          await page.locator('mat-dialog-container [data-cy="dialog-cancel"]').click();
          await page.locator('mat-dialog-container').waitFor({state:'detached'});
          assert.equal(await page.locator('input[type=checkbox]:checked').count(),2);
          await capture(page,key+'-cancelled',kind);
        }
        await page.close();
      }
    }finally{await context.close();}
  }
  assert.equal(Object.keys(states).length,48);assert.equal(Object.keys(repeats).length,48);
  assert.deepEqual(unknown,[]);assert.deepEqual(errors,[]);
  await verifyOriginalBuild(root);
}finally{
  await writeFile(join(artifacts,'workspace-files.json'),JSON.stringify({kind:'source-rendered-reference-only',manifest,provenance,
    fixtures:fixture,states:Object.fromEntries(Object.entries(states).map(([key,value])=>[key,{geometry:value.geometry,paintDiagnostics:value.paintDiagnostics}])),repeats,requests,unknown,errors},null,2));
  await browser?.close();await new Promise(done=>server.close(done));
}
