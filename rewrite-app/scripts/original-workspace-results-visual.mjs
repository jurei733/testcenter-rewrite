import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {extname,join,relative,resolve} from 'node:path';
import {originalBrowserSource,verifyOriginalBuild} from './original-browser-reference.mjs';
import {captureStableViewport} from './stable-viewport-capture.mjs';
import {compareScreenshots} from './exact-rgba-comparison.mjs';
import {waitForFiniteDocumentAnimations} from './finite-animation-ready.mjs';

/** The actual pinned Source frontend is the visual oracle. Its read-only owned
 * DTOs are captured from the real candidate API; authorization and writes are
 * qualified separately by the accompanying real SQLite browser journey. */
export async function createOriginalResultsVisualReference({browser,root,sourceRoot,artifacts}){
 root=resolve(root);await verifyOriginalBuild(root);await mkdir(artifacts,{recursive:true});
 const paths=['workspace.component.ts','workspace.component.html','workspace.component.css','workspace.interfaces.ts',
  'results/results.component.ts','results/results.component.html','results/results.component.css',
  'tests/tests.component.ts','tests/tests.component.html','tests/tests.component.css'].map(p=>'frontend/src/app/workspace-admin/'+p);
 const provenance=paths.map(path=>({path,sha256:createHash('sha256').update(execFileSync('git',['show',originalBrowserSource.commit+':'+path],{cwd:sourceRoot})).digest('hex')}));
 const server=createServer(async(req,res)=>{
  try{const path=resolve(root,'.'+new URL(req.url,'http://owned.invalid').pathname.replace(/^\/$/,'/index.html'));
   if(relative(root,path).startsWith('..'))return res.writeHead(404).end();
   res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.woff2':'font/woff2','.svg':'image/svg+xml','.png':'image/png'})[extname(path)]??'application/octet-stream');res.end(await readFile(path));
  }catch{res.writeHead(404).end();}
 });
 await new Promise(done=>server.listen(0,'127.0.0.1',done));const base='http://127.0.0.1:'+server.address().port,results=[];
 async function capture(page,path){
  await page.bringToFront();await page.evaluate(()=>document.fonts.ready);
  await page.locator('[data-cy="header"] h1').click();await page.mouse.move(0,0);await waitForFiniteDocumentAnimations(page);
  const measure=()=>page.evaluate(()=>{
   const box=node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node);return {x:r.x,y:r.y,width:r.width,height:r.height,font:s.font,padding:s.padding,text:node.textContent.trim()};};
   return {viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},scroll:[scrollX,scrollY],
    heading:[...document.querySelectorAll('mat-toolbar h1')].map(box),tabs:[...document.querySelectorAll('a[mat-tab-link]')].map(box),
    panels:[...document.querySelectorAll('mat-expansion-panel')].map(box),rows:[...document.querySelectorAll('mat-header-row,mat-row')].map(box),
    buttons:[...document.querySelectorAll('mat-tab-nav-panel button')].map(node=>({...box(node),disabled:node.disabled})),
    checks:[...document.querySelectorAll('input[type=checkbox]')].map(node=>({checked:node.checked,indeterminate:node.indeterminate,disabled:node.disabled}))};
  });
  const result=await captureStableViewport(page,measure,path);await writeFile(path+'.json',JSON.stringify({geometry:result.geometry,paintDiagnostics:result.paintDiagnostics},null,2));return result;
 }
 return {async compare({page,theme,width,role='RW',view,selected,workspaceId,groups,tests}){
  const key=theme+'-'+width+'-'+role+'-'+view+'-'+(selected?'selected':'empty-selection');
  const candidate=await capture(page,join(artifacts,'rewrite-'+key+'.png'));
  const context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:1,locale:'de-DE',timezoneId:'Europe/Berlin',colorScheme:'light'});
  const unknown=[],errors=[];let first;
  try{
   await context.addInitScript(({origin,theme,role,workspaceId})=>{if(location.origin!==origin)return;
    localStorage.setItem('iqb-tc-a',JSON.stringify({token:'owned-results-reference',displayName:'Owned Admin',loginName:'owned-admin',groupLabel:null,id:7,
     flags:[],customTexts:{},claims:{workspaceAdmin:[{id:workspaceId,type:'workspaceAdmin',label:'Eigene Ergebnisse Ω',flags:{mode:role}}]},viewSettings:{theme}}));
   },{origin:base,theme,role,workspaceId});
   await context.route(base+'/api/**',async route=>{
    const request=route.request(),path=new URL(request.url()).pathname;let body;
    if(request.method()!=='GET'){unknown.push({method:request.method(),path});return route.fulfill({status:403,body:'{}'});}
    if(path==='/api/system/config')body={version:'19.0.0',customTexts:{},appConfig:{themeName:theme},veronaPlayerApiVersionMin:2,veronaPlayerApiVersionMax:6,
     iqbStandardResponseTypeMin:1,iqbStandardResponseTypeMax:1,xmlSchemaVersions:{},bruteForceProtection:[],broadcastingServiceUri:'',fileServiceUri:'',passwordMinLength:8,passwordPattern:'.*'};
    else if(path==='/api/sys-check-mode')body=false;
    else if(path==='/api/asset-assignments')body={};else if(path==='/api/assets')body=[];
    else if(path==='/api/workspace/'+workspaceId+'/results')body=groups;
    else if(path==='/api/workspace/'+workspaceId+'/responses/detailed')body=tests;
    else{unknown.push({method:request.method(),path});return route.fulfill({status:404,body:'{}'});}
    await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
   });
   for(const kind of ['source','source-repeat']){
    const original=await context.newPage();original.on('pageerror',error=>errors.push(String(error)));
    await original.goto(base+'/#/admin/'+workspaceId+'/'+view,{waitUntil:'networkidle'});
    await original.waitForFunction(n=>document.querySelectorAll('mat-row').length===n,view==='results'?groups.length:Object.values(tests).flat().length);
    if(selected)await original.locator('mat-row input[type=checkbox]').first().check();
    await original.waitForFunction(selected=>[...document.querySelectorAll('mat-row input[type=checkbox]')].some(n=>n.checked)===selected,selected);
    const result=await capture(original,join(artifacts,kind+'-'+key+'.png'));
    if(kind==='source')first=result;
    else{
     const self=await compareScreenshots(original,first.bytes,result.bytes),comparison=await compareScreenshots(original,first.bytes,candidate.bytes);
     const receipt={key,sourceSelfControl:self,comparison,sourceGeometry:first.geometry,rewriteGeometry:candidate.geometry};results.push(receipt);
     await writeFile(join(artifacts,key+'.json'),JSON.stringify(receipt,null,2));
     assert.equal(self.differingPixels,0,'Original self-control: '+key);assert.equal(comparison.differingPixels,0,'Actual Original-to-Rewrite whole viewport: '+key);
    }
    await original.close();
   }
   assert.deepEqual(unknown,[]);assert.deepEqual(errors,[]);console.log('native_results_visual='+key+':exact');
  }finally{await context.close();await page.bringToFront();}
 },async close(){
  await new Promise(done=>server.close(done));await writeFile(join(artifacts,'visuals.json'),JSON.stringify({source:originalBrowserSource,provenance,results,
   fullOriginalParityProven:false,scope:'Actual Results and Tests frontend viewports; real candidate data; Source API fixture does not prove Source backend authorization.'},null,2));
 }};
}
