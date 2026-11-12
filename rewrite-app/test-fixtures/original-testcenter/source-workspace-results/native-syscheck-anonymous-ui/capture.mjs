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
const frontendHashes=Object.fromEntries(await Promise.all(frontendPaths.map(async p=>[p,hash(await readFile(join(original,p)))])));
const fsPort=execFileSync('docker',['port',process.env.ORIGINAL_ASSET_FILE_CONTAINER,'8080'],{encoding:'utf8'}).trim();assert.match(fsPort,/^127\.0\.0\.1:\d+$/);const fsBase='http://'+fsPort;

import {pathToFileURL} from 'node:url';
const {waitForFiniteDocumentAnimations}=await import(pathToFileURL(process.env.REWRITE_APP_ROOT+'/scripts/finite-animation-ready.mjs'));
let token,workspace,server,browser;const assets=[],ui=[],errors=[],wire=[],reportBodies=[],controls=[];
const xml=(type,body)=>'<'+type+' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/'+({Testtakers:'testcenter-testtaker-xml/18.0',SysCheck:'testcenter-syscheck-xml/18.0'}[type])+'">'+body+'</'+type+'>';
try{
 const root=(await send('admin','PUT','/session/admin',{body:{name:'super',password:adminPassword}})).value;token=root.token;
 const grants=(await send('initial-grants','GET','/user/'+root.id+'/workspaces',{token})).value.filter(r=>r.selected).map(r=>({id:r.id,role:r.role}));
 workspace=Number((await send('workspace','PUT','/workspace',{token,body:{name:'Owned R104 anonymous '+Date.now()}},201)).value);
 await send('grant-workspace','PATCH','/user/'+root.id+'/workspaces',{token,body:{ws:[...grants,{id:workspace,role:'RW'}]}});
 const upload=async(name,text)=>{const body=new FormData();body.append('fileforvo[]',new Blob([text],{type:'application/xml'}),name);const r=await request('upload-'+name,'POST','/workspace/'+workspace+'/file',{token,body});assert.ok([201,207].includes(r.status));assert.deepEqual(Object.values(r.value).flatMap(v=>v.error??[]),[],JSON.stringify(redact(r)));};
 const forwarded=async(request,response,target,path)=>{const chunks=[];for await(const c of request)chunks.push(c);const body=Buffer.concat(chunks);const headers={...request.headers};delete headers.host;delete headers.connection;const r=await fetch(target+path,{method:request.method,headers,...body.length?{body}:{},redirect:'manual',signal:AbortSignal.timeout(20000)});const bytes=Buffer.from(await r.arrayBuffer());const outHeaders={};for(const[k,v]of r.headers)if(!['connection','transfer-encoding','content-encoding','content-length'].includes(k))outHeaders[k]=v;response.writeHead(r.status,{...outHeaders,'content-length':bytes.length});response.end(bytes);};
 server=createServer(async(req,res)=>{try{const path=new URL('http://127.0.0.1'+req.url).pathname;if(path.startsWith('/api/'))return await forwarded(req,res,base,req.url.slice(4));if(path.startsWith('/fs/'))return await forwarded(req,res,fsBase,req.url.slice(3));const file=resolve(build,extname(path)&&!path.startsWith('/check/')?'.'+path:'index.html');if(relative(build,file).startsWith('..'))return res.writeHead(404).end();res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'})[extname(file)]??'application/octet-stream');res.end(await readFile(file));}catch(error){errors.push({proxy:String(error)});res.writeHead(500).end();}});
 await new Promise(done=>server.listen(0,'127.0.0.1',done));const url='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({channel:'chrome',headless:false});
 const page=await browser.newPage({viewport:{width:1280,height:850}});page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(String(error)));
 page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/'))wire.push({method:req.method(),path,hasNativeToken:!!req.headers().authtoken});});
 const screenshot=async(name,target=page)=>{await target.evaluate(()=>document.fonts.ready);await target.mouse.move(0,0);await waitForFiniteDocumentAnimations(target);await target.screenshot({path:join(out,name+'.png')});ui.push({name,url:new URL(target.url()).hash,bodyClass:await target.locator('body').getAttribute('class'),text:await target.locator('body').innerText(),card:await target.locator('mat-card').first().boundingBox(),header:await target.locator('[data-cy=header]').innerText()});};

 page.on('request',req=>{if(req.method()==='PUT'&&req.url().endsWith('/report'))reportBodies.push({path:new URL(req.url()).pathname,body:req.postDataJSON(),authenticated:!!req.headers().authtoken});});
 await page.goto(url+'/#/r/admin-login');await page.locator('[data-cy=login-admin]').waitFor();assert.equal(await page.locator('[data-cy=general-sys-check]').count(),0);await screenshot('admin-entry-hidden-link');
 await page.goto(url+'/#/r/check-starter');await Promise.all([page.waitForResponse(r=>new URL(r.url()).pathname==='/api/sys-checks'&&r.request().method()==='GET'),page.reload()]);await page.getByText('Auf diesem Server ist aktuell kein Systemcheck verfügbar.',{exact:true}).waitFor();assert.equal(await page.getByText('Bitte warten... Konfiguration wird geladen',{exact:true}).count(),0);await screenshot('selection-empty');
 await upload('public.xml',xml('SysCheck','<Metadata><Id>R104.PUBLIC</Id><Label>Owned public check</Label><Description>Owned public description</Description></Metadata><Config skipnetwork="true" savekey="owned-key"/>'));
 const selection=async(label,count)=>{await page.reload();await page.getByText(count===1?'Bitte klicken Sie auf den Schalter, um den Check zu starten!':'Bitte wählen Sie einen Check aus!',{exact:true}).waitFor();assert.equal(await page.locator('button.starter').count(),count);await screenshot(label);};
 await selection('selection-one',1);assert.match(page.url(),/check-starter$/);
 const openReport=async()=>{await page.getByRole('button',{name:/Owned public check/}).click();await page.waitForURL(/\/w$/);await page.locator('#syscheck-next-step:not([disabled])').waitFor();await page.locator('#syscheck-next-step').click();await page.waitForURL(/\/r$/);await page.locator('[data-cy="send sc-report"]').waitFor();};
 await openReport();await screenshot('anonymous-report');await page.locator('[data-cy="send sc-report"]').click();const dialog=page.getByRole('dialog');await dialog.getByRole('heading',{name:'Bericht senden',exact:true}).waitFor();
 const saveButton=dialog.getByRole('button',{name:'Speichern',exact:true});assert.equal(await saveButton.isDisabled(),true);await dialog.locator('[formcontrolname=key]').fill('owned-key');await dialog.locator('[formcontrolname=title]').fill(' A');assert.equal(await saveButton.isDisabled(),true);await dialog.locator('[formcontrolname=title]').fill('  A');assert.equal(await saveButton.isEnabled(),true);controls.push({name:'source-raw-title-minimum',emptyDisabled:true,twoCharactersDisabled:true,threeRawCharactersEnabled:true});await screenshot('anonymous-save-dialog');
 await saveButton.click();await page.locator('[data-cy=dialog-title]').waitFor();await screenshot('anonymous-saved');await page.locator('[data-cy=dialog-cancel]').click();await page.waitForURL(/\/r\/login\/?$/);
 // Same document keeps the installation mode read on application startup.
 await upload('other.xml',xml('SysCheck','<Metadata><Id>R104.OTHER</Id><Label>Owned other check</Label><Description>Owned other description</Description></Metadata><Config skipnetwork="true"/>'));
 await page.goto(url+'/#/r/check-starter');await selection('selection-many',2);
 const sourceLoginName='r104-source-'+Date.now();
 await upload('people.xml',xml('Testtakers','<Metadata/><Group id="R104.GROUP.'+workspace+'" label="Owned"><Login name="'+sourceLoginName+'" pw="owned-password" mode="sys-check-login"/></Group>'));
 assert.equal((await send('mode-after-external-upload','GET','/sys-check-mode')).value,true);
 const modeReadsBefore=wire.filter(row=>row.path==='/api/sys-check-mode').length;
 await page.goto(url+'/#/r/login');await page.locator('[formcontrolname=name]').fill(sourceLoginName);await page.locator('[data-cy=login-user]').click();await page.locator('[formcontrolname=pw]').fill('owned-password');await page.locator('[data-cy=login-user]').click();await page.locator('[data-cy="syscheck-R104.PUBLIC"]').waitFor();assert.equal(wire.filter(row=>row.path==='/api/sys-check-mode').length,modeReadsBefore);
 await page.locator('[data-cy="syscheck-R104.PUBLIC"]').click();await page.waitForURL(/\/w$/);await page.locator('#syscheck-next-step:not([disabled])').waitFor();await page.locator('#syscheck-next-step').click();await page.waitForURL(/\/r$/);await page.locator('[data-cy="send sc-report"]').click();await dialog.getByRole('heading',{name:'Bericht senden',exact:true}).waitFor();await screenshot('authenticated-cached-public-mode-dialog');await dialog.locator('[formcontrolname=key]').fill('owned-key');await dialog.locator('[formcontrolname=title]').fill('Owned actor dialog title');await saveButton.click();await page.locator('[data-cy=dialog-title]').waitFor();await page.locator('[data-cy=dialog-cancel]').click();await page.waitForURL(/\/r\/starter$/);
 await page.reload();await page.locator('[data-cy="syscheck-R104.PUBLIC"]').waitFor();await page.locator('[data-cy="syscheck-R104.PUBLIC"]').click();await page.waitForURL(/\/w$/);await page.locator('#syscheck-next-step:not([disabled])').waitFor();await page.locator('#syscheck-next-step').click();await page.waitForURL(/\/r$/);await page.locator('[data-cy="send sc-report"]').click();await page.locator('[data-cy=dialog-title]').waitFor();assert.equal(await page.locator('[formcontrolname=key]').count(),0);await screenshot('authenticated-private-mode-saved');

 const anonymousPage=await browser.newPage({viewport:{width:1280,height:850}});anonymousPage.setDefaultTimeout(20000);anonymousPage.on('pageerror',error=>errors.push(String(error)));anonymousPage.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/'))wire.push({context:'anonymous-global-mode',method:req.method(),path,hasNativeToken:!!req.headers().authtoken});if(req.method()==='PUT'&&req.url().endsWith('/report'))reportBodies.push({path,body:req.postDataJSON(),authenticated:!!req.headers().authtoken});});
 await anonymousPage.goto(url+'/#/r/check-starter');await anonymousPage.getByRole('button',{name:/Owned public check/}).click();await anonymousPage.waitForURL(/\/w$/);await anonymousPage.locator('#syscheck-next-step:not([disabled])').waitFor();await anonymousPage.locator('#syscheck-next-step').click();await anonymousPage.waitForURL(/\/r$/);const denied=anonymousPage.waitForResponse(r=>r.request().method()==='PUT'&&r.url().endsWith('/report'));await anonymousPage.locator('[data-cy="send sc-report"]').click();assert.equal((await denied).status(),400);await anonymousPage.getByRole('dialog').waitFor();assert.equal(await anonymousPage.locator('[formcontrolname=key]').count(),0);await screenshot('anonymous-global-mode-error',anonymousPage);await anonymousPage.close();
 const overview=await send('reports-overview','GET','/workspace/'+workspace+'/sys-check/reports/overview',{token});
 const php='$dir="/var/www/testcenter/data/ws_'+workspace+'/SysCheck/reports";$r=[];foreach(glob($dir."/*.json") as $f)$r[basename($f)]=json_decode(file_get_contents($f),true,512,JSON_THROW_ON_ERROR);echo json_encode($r,JSON_THROW_ON_ERROR);';
 const persistedReports=JSON.parse(execFileSync('docker',['exec',container,'php','-r',php],{encoding:'utf8'}));
 assert.equal(Object.keys(persistedReports).length,3);assert.equal(reportBodies.length,4);assert.equal(reportBodies[0].authenticated,false);assert.equal(reportBodies[0].body.title,'  A');assert.equal(reportBodies[1].authenticated,true);assert.equal(reportBodies[1].body.title,'Owned actor dialog title');assert.equal(reportBodies[2].authenticated,true);assert.equal('title' in reportBodies[2].body,false);assert.equal('keyPhrase' in reportBodies[2].body,false);
 await verifyBuild();verifyImage();for(const[p,h]of Object.entries(frontendHashes))assert.equal(hash(await readFile(join(original,p))),h);assert.equal(git('status','--porcelain','--untracked-files=no'),'');assert.deepEqual(errors,[]);
 await writeFile(join(out,'observations.json'),JSON.stringify(redact({verified:true,sourceCommit:git('rev-parse','HEAD'),sourceHashes,frontendHashes,compiledBuild:{producerAppCommit:manifest.appCommit,source:manifest.source,files:manifest.files,readOnly:true},backendImage:containerInfo.Image,vendor,actualSourceBackend:true,actualSourceFrontend:true,sourceBrowserChannel:'chrome',sourceBrowserVersion:browser.version(),apiMocks:false,sqlSeedsOrDaoStubs:false,configuration:{xmlSchemaValidation:true,allowTestMode:false,bruteForceProtection:'login person'},rows,ui,wire,reportBodies,controls,persistedReports,errors,settledFiniteAnimations:true,pointerParkedAt:[0,0],visualParityProven:false}),null,2)+'\n');
}catch(error){await writeFile(join(out,'failure.json'),JSON.stringify(redact({error:String(error),rows,ui,wire,reportBodies,controls,errors}),null,2)+'\n');throw error;}
finally{await browser?.close();if(server)await new Promise(done=>server.close(done));}
