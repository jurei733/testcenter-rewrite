import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {extname,join,relative,resolve} from 'node:path';
import {originalBrowserSource,verifyOriginalBuild,originalWorkspaceResultsReference} from './original-browser-reference.mjs';
import {captureStableViewport} from './stable-viewport-capture.mjs';
import {compareScreenshots} from './exact-rgba-comparison.mjs';
import {waitForFiniteDocumentAnimations} from './finite-animation-ready.mjs';

/** The actual pinned Source frontend is the visual oracle. Its read-only owned
 * DTOs are captured from the real candidate API; authorization and writes are
 * qualified separately by the accompanying real SQLite browser journey. */
export async function createOriginalResultsVisualReference({browser,root,sourceRoot,artifacts}){
 root=resolve(root);const manifest=await verifyOriginalBuild(root);await mkdir(artifacts,{recursive:true});
 const provenance=originalWorkspaceResultsReference.sources;
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
   const box=node=>{const r=node.getBoundingClientRect(),s=getComputedStyle(node);return {x:r.x,y:r.y,width:r.width,height:r.height,font:s.font,padding:s.padding,opacity:s.opacity,color:s.color,background:s.backgroundColor,text:node.textContent.trim()};};
   return {viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},scroll:[scrollX,scrollY],
    heading:[...document.querySelectorAll('mat-toolbar h1')].map(box),tabs:[...document.querySelectorAll('a[mat-tab-link]')].map(box),
    pagination:[...document.querySelectorAll('.mat-mdc-tab-header-pagination-chevron')].map(node=>({...box(node),boxSizing:getComputedStyle(node).boxSizing,border:getComputedStyle(node).border,transform:getComputedStyle(node).transform})),
    panels:[...document.querySelectorAll('mat-expansion-panel')].map(box),rows:[...document.querySelectorAll('mat-header-row,mat-row')].map(box),
    buttons:[...document.querySelectorAll('mat-tab-nav-panel button')].map(node=>({...box(node),disabled:node.disabled})),
    checks:[...document.querySelectorAll('input[type=checkbox]')].map(node=>({checked:node.checked,indeterminate:node.indeterminate,disabled:node.disabled})),
    containers:(()=>{const rows=[];let node=[...document.querySelectorAll('mat-expansion-panel')].at(-1);for(let i=0;node&&i<9;i++,node=node.parentElement){const s=getComputedStyle(node);rows.push({tag:node.tagName,...box(node),display:s.display,overflowX:s.overflowX,overflowY:s.overflowY,clientHeight:node.clientHeight,scrollHeight:node.scrollHeight});}return rows;})()};
  });
  const result=await captureStableViewport(page,measure,path);await writeFile(path+'.json',JSON.stringify({geometry:result.geometry,paintDiagnostics:result.paintDiagnostics},null,2));return result;
 }
 async function activateTab(page,view){
  await page.evaluate(()=>document.fonts.ready);
  // The candidate journey enters from Files by keyboard. Reproduce that focus
  // history on both sides: initial-route selection alone retains a different
  // legitimate Material scroll position in a narrow viewport.
  await page.locator('[data-cy="Dateien"]').focus();
  const target=page.locator('[data-cy="'+(view==='results'?'Ergebnisse/Antworten':'Tests löschen')+'"]');
  await target.focus();await target.press('Enter');await waitForFiniteDocumentAnimations(page);
 }
 return {async compare({page,theme,width,role='RW',view,selected,workspaceId,groups,tests}){
  const key=theme+'-'+width+'-'+role+'-'+view+'-'+(selected?'selected':'empty-selection');
  // Both renderers get a fresh document for this scene. Earlier real CSV and
  // dialog actions can legitimately leave their overflowing panel scrolled;
  // that functional journey is qualified separately by the caller.
  const candidatePage=await page.context().newPage();let context;
  const unknown=[],errors=[];let first;
  try{
   candidatePage.on('pageerror',error=>errors.push(String(error)));
   await candidatePage.goto(page.url(),{waitUntil:'domcontentloaded'});
   const id=view==='results'?'originalWorkspaceResults':'originalWorkspaceTests';
   await candidatePage.locator('#'+id+'[aria-busy="false"]').waitFor();
   await candidatePage.waitForFunction(({id,n})=>document.querySelectorAll('#'+id+' mat-row').length===n,
    {id,n:view==='results'?groups.length:Object.values(tests).flat().length});
   await activateTab(candidatePage,view);
   if(selected)await candidatePage.locator('#'+id+' mat-row input[type=checkbox]').first().check();
   const candidate=await capture(candidatePage,join(artifacts,'rewrite-'+key+'.png'));
   context=await browser.newContext({viewport:{width,height:844},deviceScaleFactor:1,locale:'de-DE',timezoneId:'Europe/Berlin',colorScheme:'light'});
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
    await activateTab(original,view);
    if(selected)await original.locator('mat-row input[type=checkbox]').first().check();
    await original.waitForFunction(selected=>[...document.querySelectorAll('mat-row input[type=checkbox]')].some(n=>n.checked)===selected,selected);
    const result=await capture(original,join(artifacts,kind+'-'+key+'.png'));
    if(kind==='source')first=result;
    else{
     const self=await compareScreenshots(original,first.bytes,result.bytes),comparison=await compareScreenshots(original,first.bytes,candidate.bytes);
     const receipt={key,candidate:manifest.appCommit,sourceCommit:manifest.source.commit,inputSequence:'Fresh document in authenticated context; fonts ready; focus Files; focus target tab; Enter; select row when requested; blur via heading',sourceSelfControl:self,comparison,sourceGeometry:first.geometry,rewriteGeometry:candidate.geometry};results.push(receipt);
     await writeFile(join(artifacts,key+'.json'),JSON.stringify(receipt,null,2));
     assert.equal(self.differingPixels,0,'Original self-control: '+key);assert.equal(comparison.differingPixels,0,'Actual Original-to-Rewrite whole viewport: '+key);
    }
    await original.close();
   }
   assert.deepEqual(unknown,[]);assert.deepEqual(errors,[]);console.log('native_results_visual='+key+':exact');
  }catch(error){
   if(!candidatePage.isClosed())await candidatePage.screenshot({path:join(artifacts,'failure-rewrite-'+key+'.png'),fullPage:true});throw error;
  }finally{await context?.close();await candidatePage.close();await page.bringToFront();}
 },async close(){
  await new Promise(done=>server.close(done));await verifyOriginalBuild(root);await writeFile(join(artifacts,'visuals.json'),JSON.stringify({manifest,source:originalBrowserSource,provenance,results,
   fullOriginalParityProven:false,scope:'Actual Results and Tests frontend viewports; real candidate data; Source API fixture does not prove Source backend authorization.'},null,2));
 }};
}
