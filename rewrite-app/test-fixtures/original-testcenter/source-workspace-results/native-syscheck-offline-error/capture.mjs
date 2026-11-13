import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {join} from 'node:path';
const out=process.env.ORIGINAL_TEST_ADMIN_OUTPUT_DIR,original=process.env.ORIGINAL_TEST_ADMIN_SOURCE_ROOT,container=process.env.ORIGINAL_TEST_ADMIN_CONTAINER;
assert.ok(out&&original&&container,'Set the owned output directory, pinned Source root and dedicated backend container');await mkdir(out,{recursive:true});
const port=execFileSync('docker',['port',container,'8080'],{encoding:'utf8'}).trim();assert.match(port,/^127\.0\.0\.1:\d+$/);const base='http://'+port;
const hash=b=>createHash('sha256').update(b).digest('hex'),git=(...a)=>execFileSync('git',['--no-optional-locks','-C',original,...a],{encoding:'utf8'}).trim();
assert.equal(git('rev-parse','HEAD'),'eedae41840cbe90e5547c0211da818bdf620f5aa');assert.equal(git('status','--porcelain','--untracked-files=no'),'');
const paths=git('ls-files','backend/src','backend/index.php','backend/routes.php','backend/initialize.php','definitions/testtaker','scripts/database/full.sql').split('\n');
const sourceHashes=Object.fromEntries(await Promise.all(paths.map(async p=>[p,hash(await readFile(join(original,p)))])));
const verifyImage=()=>{
 const php='$paths=json_decode(stream_get_contents(STDIN),true,512,JSON_THROW_ON_ERROR);$out=[];foreach($paths as $p){$f="/var/www/testcenter/".$p;if(!is_file($f))throw new RuntimeException("Missing pinned source: ".$p);$out[$p]=hash_file("sha256",$f);}echo json_encode($out,JSON_THROW_ON_ERROR);';
 const actual=JSON.parse(execFileSync('docker',['exec','-i',container,'php','-r',php],{encoding:'utf8',input:JSON.stringify(paths)}));assert.deepEqual(actual,sourceHashes);return actual;
};
verifyImage();
const composerLock=JSON.parse(await readFile(join(original,'backend/composer.lock'),'utf8'));
const installedBytes=execFileSync('docker',['exec',container,'php','-r','echo file_get_contents("/var/www/testcenter/backend/vendor/composer/installed.json");']);
const installed=JSON.parse(installedBytes),known=new Map([...composerLock.packages,...composerLock['packages-dev']].map(p=>[p.name,p]));
for(const p of installed.packages){assert.ok(known.has(p.name),p.name);assert.equal(p.version,known.get(p.name).version,p.name);assert.equal(p.source?.reference,known.get(p.name).source?.reference,p.name);}
for(const p of composerLock.packages)assert.ok(installed.packages.some(i=>i.name===p.name),'Missing locked production package '+p.name);
const vendor={sourceComposerLockSha256:hash(await readFile(join(original,'backend/composer.lock'))),installedMetadataSha256:hash(installedBytes),installedPackages:installed.packages.length,requiredProductionPackages:composerLock.packages.length,allInstalledVersionsAndSourceReferencesMatchPinnedLock:true};

const adminPassword='owned-source-super-secret',aliases=new Map([[adminPassword,'[owned-admin-password]']]),rows=[];
const register=v=>{if(v&&typeof v==='object')for(const[k,x]of Object.entries(v)){if(/^(token|groupToken|salt|signature)$/i.test(k)&&typeof x==='string'&&!aliases.has(x))aliases.set(x,'[owned-'+k+'-'+aliases.size+']');else register(x);}};
const redact=v=>{if(typeof v==='string'){for(const[s,a]of [...aliases].sort((a,b)=>b[0].length-a[0].length))v=v.replaceAll(s,a);return v;}if(Array.isArray(v))return v.map(redact);if(v&&typeof v==='object')return Object.fromEntries(Object.entries(v).map(([k,x])=>[k,redact(x)]));return v;};
const request=async(label,method,path,{body,token,rawBody=false}={})=>{
 const r=await fetch(base+path,{method,headers:{Accept:'application/json',...(token===undefined?{}:{AuthToken:token}),...(body!==undefined&&!(body instanceof FormData)?{'Content-Type':'application/json'}:{})},...(body===undefined?{}:{body:body instanceof FormData||rawBody?body:JSON.stringify(body)}),signal:AbortSignal.timeout(20000)});
 const bytes=Buffer.from(await r.arrayBuffer());let value;try{value=JSON.parse(bytes.toString());}catch{value=bytes.toString();}register(value);
 const result={label,method,path,status:r.status,value,bodySha256:hash(bytes),contentType:r.headers.get('content-type'),errorId:r.headers.get('error-id'),testMode:r.headers.get('test-mode'),rawText:bytes.toString(),requestBody:body instanceof FormData?'[actual multipart upload]':body};rows.push(result);return {...result,bytes};
};
const solve=c=>{assert.equal(c.algorithm,'SHA-256');assert.ok(c.maxNumber<=1000000);for(let number=0;number<=c.maxNumber;number++)if(hash(c.salt+number)===c.challenge)return{algorithm:c.algorithm,challenge:c.challenge,salt:c.salt,signature:c.signature,number};assert.fail('Actual Source ALTCHA has no bounded solution');};

const containerInfo=JSON.parse(execFileSync('docker',['inspect',container],{encoding:'utf8'}))[0];
assert.equal(containerInfo.Image,'sha256:d7045f22e834e2907ed39b5f8c99eed3d81f37643c50c3f66746e3f654381328');
assert.ok(containerInfo.Config.Env.includes('XML_SCHEMA_VALIDATION=true'));
assert.ok(containerInfo.Config.Env.includes('ALLOW_TEST_MODE=false'));
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII=','base64');
const check=(row,status=200)=>{assert.equal(row.status,status,JSON.stringify(redact({label:row.label,status:row.status,value:row.value})));return row;};
const send=async(label,method,path,options,status=200)=>check(await request(label,method,path,options),status);
const login=async(label,name)=>{const challenge=(await send(label+'-challenge','POST','/session/challenge',{body:{loginType:'login',name,password:'owned-r98-theme-password'}})).value;return (await send(label,'PUT','/session',{body:solve(challenge)})).value;};
const personLogin=async(label,loginToken)=>{const challenge=(await send(label+'-challenge','POST','/session/person/challenge',{token:loginToken,body:{code:'c1'}})).value;return (await send(label,'PUT','/session',{token:loginToken,body:solve(challenge)})).value;};
import {createServer} from 'node:http';
import {createRequire} from 'node:module';
import {resolve,relative,extname} from 'node:path';
const require=createRequire(process.env.REWRITE_APP_ROOT+'/package.json'),{chromium}=require('playwright');
const build=join(original,'frontend/dist/testcenter-frontend/browser'),manifest=JSON.parse(await readFile(join(build,'original-reference-manifest.json')));
assert.equal(manifest.source.commit,git('rev-parse','HEAD'));assert.equal(hash(await readFile(join(original,'frontend/package-lock.json'))),manifest.source.frontendLockSha256);
const verifyBuild=async()=>{for(const[p,h]of Object.entries(manifest.files))assert.equal(hash(await readFile(join(build,p))),h,p);};await verifyBuild();
const frontendPaths=[...git('ls-files','frontend/src/app/sys-check').split('\n'),'frontend/src/app/app.component.ts','frontend/src/app/app-root/login/login.component.ts','frontend/src/app/shared/services/theme.service.ts','frontend/src/app/shared/services/asset.service.ts','frontend/src/app/shared/services/maindata/maindata.service.ts','frontend/src/app/brute-force-protection.service.ts','frontend/src/app/app-root/code-login/code-login.component.ts','frontend/src/app/app-root/code-login/code-login.component.scss','frontend/src/app/shared/components/header/header.component.html','frontend/src/app/shared/services/message.service.ts'];
frontendPaths.push('frontend/src/app/app-root/sys-check-starter/sys-check-starter.component.ts','frontend/src/app/app-root/sys-check-starter/sys-check-starter.component.html','frontend/src/app/app-root/sys-check-starter/sys-check-starter.component.css','frontend/src/app/app-root/login/admin-login/admin-login.component.html','frontend/src/app/app-routing.module.ts');
frontendPaths.push('frontend/src/app/shared/services/header.service.ts','frontend/src/app/shared/components/header/header.component.ts','frontend/src/app/app-root/starter/starter.component.ts','frontend/src/app/app-root/code-login/code-login.component.ts','frontend/src/app/app-root/app-root.component.ts','frontend/src/app/app.component.html');
frontendPaths.push('frontend/src/app/shared/components/dialog/error-dialog.component.ts','frontend/src/app/app.interfaces.ts');
const frontendHashes=Object.fromEntries(await Promise.all(frontendPaths.map(async p=>[p,hash(await readFile(join(original,p)))])));
const fsPort=execFileSync('docker',['port',process.env.ORIGINAL_ASSET_FILE_CONTAINER,'8080'],{encoding:'utf8'}).trim();assert.match(fsPort,/^127\.0\.0\.1:\d+$/);const fsBase='http://'+fsPort;

import {pathToFileURL} from 'node:url';
const {waitForFiniteDocumentAnimations}=await import(pathToFileURL(process.env.REWRITE_APP_ROOT+'/scripts/finite-animation-ready.mjs'));
let token,workspace,server,browser;const assets=[],ui=[],errors=[],wire=[],reportBodies=[],controls=[];
const xml=(type,body)=>'<'+type+' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/'+({Testtakers:'testcenter-testtaker-xml/18.0',SysCheck:'testcenter-syscheck-xml/18.0'}[type])+'">'+body+'</'+type+'>';
const extraFrontendPaths=['frontend/src/app/workspace-admin/files/iqb-files-upload/iqb-files-upload.component.ts','frontend/src/app/workspace-admin/files/iqb-files-upload-queue/iqb-files-upload-queue.component.html','frontend/src/app/workspace-admin/files/files.component.ts','frontend/src/app/workspace-admin/backend.service.ts','frontend/src/app/backend.service.ts'];
for(const path of extraFrontendPaths)frontendHashes[path]=hash(await readFile(join(original,path)));
let modeFault=false,modeHold=false;const heldModeSockets=new Set();const uploads=[];let stage='setup';
try{
 const admin=(await send('admin','PUT','/session/admin',{body:{name:'super',password:adminPassword}})).value;token=admin.token;
 const grants=(await send('initial-grants','GET','/user/'+admin.id+'/workspaces',{token})).value.filter(row=>row.selected).map(row=>({id:row.id,role:row.role}));
 workspace=Number((await send('workspace','PUT','/workspace',{token,body:{name:'Owned R108 offline error'}},201)).value);
 await send('grant-workspace','PATCH','/user/'+admin.id+'/workspaces',{token,body:{ws:[...grants,{id:workspace,role:'RW'}]}});
 const checkText=xml('SysCheck','<Metadata><Id>R108.CHECK</Id><Label>Owned offline error check</Label></Metadata><Config skipnetwork="true" savekey="owned-key"/>');
 const form=new FormData();form.append('fileforvo[]',new Blob([checkText],{type:'application/xml'}),'check.xml');
 const uploaded=await request('upload-check','POST','/workspace/'+workspace+'/file',{token,body:form});assert.ok([201,207].includes(uploaded.status));assert.deepEqual(Object.values(uploaded.value).flatMap(row=>row.error??[]),[]);
 assert.equal((await send('actual-underlying-mode','GET','/sys-check-mode')).value,false);modeFault=false;
  const forwarded=async(req,res,target,path)=>{
  const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);const headers={...req.headers};delete headers.host;delete headers.connection;
  if(modeHold&&path==='/sys-check-mode'){wire.push({stage,method:req.method,path,status:'actual-tcp-held',hasNativeToken:!!headers.authtoken});heldModeSockets.add(req.socket);req.socket.once('close',()=>heldModeSockets.delete(req.socket));return;}
  if(modeFault&&path==='/sys-check-mode'){wire.push({stage,method:req.method,path,status:'actual-tcp-drop',hasNativeToken:!!headers.authtoken});req.socket.destroy();return;}
  const response=await fetch(target+path,{method:req.method,headers,...body.length?{body}:{},redirect:'manual',signal:AbortSignal.timeout(20000)}),bytes=Buffer.from(await response.arrayBuffer());let value;try{value=JSON.parse(bytes.toString());}catch{value=bytes.toString();}register(value);
  wire.push({stage,method:req.method,path,status:response.status,hasNativeToken:!!headers.authtoken,...path==='/sys-check-mode'?{mode:value}:{},...path.endsWith('/report')?{requestBody:JSON.parse(body.toString()),responseBody:value}:{}});
  const outHeaders={};for(const[k,v]of response.headers)if(!['connection','transfer-encoding','content-encoding','content-length'].includes(k))outHeaders[k]=v;res.writeHead(response.status,{...outHeaders,'content-length':bytes.length});res.end(bytes);
 };
 server=createServer(async(req,res)=>{try{const path=new URL('http://127.0.0.1'+req.url).pathname;if(path.startsWith('/api/'))return await forwarded(req,res,base,req.url.slice(4));if(path.startsWith('/fs/'))return await forwarded(req,res,fsBase,req.url.slice(3));const file=resolve(build,extname(path)?'.'+path:'index.html');if(relative(build,file).startsWith('..'))return res.writeHead(404).end();res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'})[extname(file)]??'application/octet-stream');res.end(await readFile(file));}catch(error){errors.push({proxy:String(error)});res.writeHead(500).end();}});
 await new Promise(done=>server.listen(0,'127.0.0.1',done));const url='http://127.0.0.1:'+server.address().port;

 const selfControls=[];
 const {compareScreenshots}=await import(pathToFileURL(process.env.REWRITE_APP_ROOT+'/scripts/exact-rgba-comparison.mjs'));

 const capture=async(name,page,meta)=>{
  await page.waitForFunction(()=>[...document.querySelectorAll('mat-dialog-container')].every(el=>el.classList.contains('mdc-dialog--open')&&!el.classList.contains('mdc-dialog--opening')&&!el.classList.contains('mdc-dialog--closing')));
  await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>Array.from(document.images).every(image=>image.complete&&image.naturalWidth>0));await page.mouse.move(0,0);await waitForFiniteDocumentAnimations(page);
  const first=await page.screenshot({path:join(out,name+'.png')});
  await page.evaluate(()=>{const cover=document.createElement('div');cover.id='owned-repaint-control';cover.style.cssText='position:fixed;inset:0;z-index:2147483647;background:#fff;pointer-events:none';document.body.append(cover);});
  const witnesses=[];
  for(let index=0;index<3;index++){
   await page.evaluate(()=>new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done))));const png=await page.screenshot({path:join(out,name+'-white-'+index+'.png')});
   const result=await page.evaluate(async base64=>{const image=new Image();image.src='data:image/png;base64,'+base64;await image.decode();const canvas=document.createElement('canvas');canvas.width=image.width;canvas.height=image.height;const context=canvas.getContext('2d');context.drawImage(image,0,0);const data=context.getImageData(0,0,canvas.width,canvas.height).data;let nonWhite=0;for(let index=0;index<data.length;index+=4)if(data[index]!==255||data[index+1]!==255||data[index+2]!==255||data[index+3]!==255)nonWhite++;return{width:canvas.width,height:canvas.height,nonWhite};},png.toString('base64'));assert.equal(result.nonWhite,0);witnesses.push(result);
  }
  await page.evaluate(()=>{document.getElementById('owned-repaint-control').remove();return new Promise(done=>requestAnimationFrame(()=>requestAnimationFrame(done)));});await waitForFiniteDocumentAnimations(page);
  const second=await page.screenshot({path:join(out,name+'-self.png')});const comparison=await compareScreenshots(page,first,second);selfControls.push({name,...meta,comparison,witnesses});ui.push({name,...meta,url:new URL(page.url()).hash,header:await page.locator('[data-cy=header] .center').innerText(),bodyClass:await page.locator('body').getAttribute('class'),text:await page.locator('body').innerText()});console.log('source_offline='+name+':passed');assert.equal(comparison.differingPixels,0,name+' Source repaint control');
 };

 for(const channel of (process.env.R108_LIMIT_ONE?['chrome']:['chrome','chromium'])){
  browser=await chromium.launch({channel,headless:false});
  for(const theme of (process.env.R108_LIMIT_ONE?['Primar']:['Primar','Sekundar','Erwachsene'])){
   await send('theme-'+channel+'-'+theme,'PATCH','/system/config/app',{token,body:{themeName:theme}});
   for(const width of (process.env.R108_LIMIT_ONE?[1280]:[1280,390])){
    const context=await browser.newContext({viewport:{width,height:850},serviceWorkers:'block'}),page=await context.newPage();page.setDefaultTimeout(20000);
    const meta={channel,browser:browser.version(),theme,width,height:850},prefix=channel+'-'+theme+'-'+width,scripts=[],failed=[];
    page.on('request',req=>{if(req.resourceType()==='script')scripts.push(new URL(req.url()).pathname);});
    page.on('requestfailed',req=>failed.push({path:new URL(req.url()).pathname,error:req.failure()?.errorText}));
    page.on('pageerror',error=>errors.push({...meta,error:String(error)}));
    try{
     stage=prefix+'-hold';modeHold=true;
     const directory=page.waitForResponse(r=>r.request().method()==='GET'&&new URL(r.url()).pathname==='/api/sys-checks');
     await page.goto(url+'/#/r/check-starter');assert.equal((await directory).status(),200);
     await page.getByRole('button',{name:'Owned offline error check',exact:true}).waitFor();
     await page.waitForFunction(theme=>document.body.classList.contains(theme==='Erwachsene'?'theme-adult':'theme-'+theme.toLowerCase()),theme);
     await page.evaluate(()=>document.fonts.ready);await page.waitForFunction(()=>Array.from(document.images).every(i=>i.complete&&i.naturalWidth>0));
     assert.equal(heldModeSockets.size,1);const documentTime=await page.evaluate(()=>performance.timeOrigin),scriptsBefore=[...scripts];
     stage=prefix+'-offline';modeFault=true;await context.setOffline(true);modeHold=false;for(const socket of heldModeSockets)socket.destroy();heldModeSockets.clear();
     const dialog=page.getByRole('dialog').last();await dialog.waitFor({timeout:5000});
     const state=await page.evaluate(()=>({online:navigator.onLine,location:location.href,now:Date.now(),timeOrigin:performance.timeOrigin}));
     assert.equal(state.online,false);assert.equal(state.timeOrigin,documentTime);
     await capture(prefix+'-offline-collapsed',page,meta);
     const collapsedText=await dialog.innerText(),heading=await dialog.locator('[mat-dialog-title]').innerText();
     const focus=await page.evaluate(()=>({tag:document.activeElement.tagName,role:document.activeElement.getAttribute('role'),text:document.activeElement.textContent?.trim().slice(0,120)}));
     await dialog.locator('mat-expansion-panel-header').click();await dialog.locator('.mat-expansion-panel-content-wrapper').waitFor();
     await capture(prefix+'-offline-expanded',page,meta);
     const expanded=await dialog.evaluate(el=>{
      const css=node=>{const s=getComputedStyle(node),b=node.getBoundingClientRect();return{tag:node.tagName,font:s.fontFamily,fontSize:s.fontSize,lineHeight:s.lineHeight,fontWeight:s.fontWeight,color:s.color,whiteSpace:s.whiteSpace,x:b.x,y:b.y,width:b.width,height:b.height};};
      return{text:el.innerText,paragraphs:[...el.querySelectorAll('mat-expansion-panel p')].map(p=>p.innerText),geometry:[...el.querySelectorAll('h2,h3,mat-dialog-content,mat-expansion-panel,mat-dialog-actions')].map(css),errorIcons:el.querySelectorAll('h2 mat-icon svg').length};
     });
     await page.keyboard.press('Escape');const survivesEscape=await dialog.count();
     controls.push({...meta,offline:true,dialogCount:await page.getByRole('dialog').count(),allDialogHeadings:await page.getByRole('dialog').locator('[mat-dialog-title]').allInnerTexts(),scriptsBefore,scriptsAfter:scripts.slice(scriptsBefore.length),failed,documentTime,state,heading,collapsedText,focus,expanded,survivesEscape,offlineBannerCount:await page.locator('.offline-shell-banner').count()});
     assert.equal(survivesEscape,1);assert.equal(await page.locator('.offline-shell-banner').count(),0);
     stage=prefix+'-recover';modeFault=false;await context.setOffline(false);const recovered=page.waitForResponse(r=>r.request().method()==='GET'&&new URL(r.url()).pathname==='/api/sys-check-mode');
     await dialog.locator('[data-cy=close]').click();assert.equal((await recovered).status(),200);await page.locator('[formcontrolname=name]').waitFor();assert.notEqual(await page.evaluate(()=>performance.timeOrigin),documentTime);assert.equal(await page.getByRole('dialog').count(),0);controls.at(-1).recovery={newDocument:true,path:new URL(page.url()).hash,loginVisible:true};
    }catch(error){await page.screenshot({path:join(out,prefix+'-failure.png')}).catch(()=>{});await writeFile(join(out,prefix+'-failure-state.json'),JSON.stringify({error:String(error),text:await page.locator('body').innerText().catch(()=>''),html:await page.content().catch(()=>''),scripts,failed,online:await page.evaluate(()=>navigator.onLine).catch(()=>null)},null,2));throw error;}finally{modeFault=false;modeHold=false;for(const socket of heldModeSockets)socket.destroy();heldModeSockets.clear();await context.close();}
   }
  }
  await browser.close();browser=undefined;
 }
 await verifyBuild();verifyImage();for(const[p,h]of Object.entries(frontendHashes))assert.equal(hash(await readFile(join(original,p))),h);assert.equal(git('status','--porcelain','--untracked-files=no'),'');assert.deepEqual(errors,[]);
 await writeFile(join(out,'observations.json'),JSON.stringify(redact({verified:true,actualSourceBackend:true,actualSourceFrontend:true,sourceCommit:git('rev-parse','HEAD'),sourceHashes,frontendHashes,compiledHashes:manifest.files,cachedBuildProducer:manifest.appCommit,vendor,xmlSchemaValidation:true,allowTestMode:false,apiMocks:false,sqlSeedsOrDaoStubs:false,workspace,rows,wire,ui,controls,selfControls,errors,originalReadOnly:true,scope:'Cold public startup-mode connection failure after fully offline browser transition, collapsed/expanded actual Source dialog, Escape and real online reload recovery; fresh contexts with Service Workers blocked; actual Source settings/config HTTP.'}),null,2)+'\n');
 console.log(JSON.stringify({success:true,scenes:ui.length,contexts:controls.length,selfControls:selfControls.length,whiteFrames:selfControls.length*3}));
}catch(error){await writeFile(join(out,'failure.json'),JSON.stringify(redact({stage,error:String(error),stack:error.stack,rows,wire,ui,controls,errors}),null,2)+'\n');throw error;}
finally{await browser?.close();if(server)await new Promise(done=>server.close(done));if(workspace&&token){await send('cleanup-owned-workspace','DELETE','/workspaces',{token,body:{ws:[workspace],p:adminPassword}});console.log('owned_source_workspace=deleted');}}
