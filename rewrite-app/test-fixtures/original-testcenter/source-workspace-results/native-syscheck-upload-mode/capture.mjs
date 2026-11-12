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
const extraFrontendPaths=['frontend/src/app/workspace-admin/files/iqb-files-upload/iqb-files-upload.component.ts','frontend/src/app/workspace-admin/files/iqb-files-upload-queue/iqb-files-upload-queue.component.html','frontend/src/app/workspace-admin/files/files.component.ts','frontend/src/app/workspace-admin/backend.service.ts','frontend/src/app/backend.service.ts'];
for(const path of extraFrontendPaths)frontendHashes[path]=hash(await readFile(join(original,path)));
let modeFault=false;const uploads=[];let stage='setup';
try{
 const root=(await send('admin','PUT','/session/admin',{body:{name:'super',password:adminPassword}})).value;token=root.token;
 const grants=(await send('initial-grants','GET','/user/'+root.id+'/workspaces',{token})).value.filter(row=>row.selected).map(row=>({id:row.id,role:row.role}));
 workspace=Number((await send('workspace','PUT','/workspace',{token,body:{name:'Owned R105 upload '+Date.now()}},201)).value);
 await send('grant-workspace','PATCH','/user/'+root.id+'/workspaces',{token,body:{ws:[...grants,{id:workspace,role:'RW'}]}});
 const checkText=xml('SysCheck','<Metadata><Id>R105.CHECK</Id><Label>Owned upload check</Label></Metadata><Config skipnetwork="true" savekey="owned-key"/>');
 const setupBody=new FormData();setupBody.append('fileforvo[]',new Blob([checkText],{type:'application/xml'}),'check.xml');
 const setupResult=await request('upload-check','POST','/workspace/'+workspace+'/file',{token,body:setupBody});assert.ok([201,207].includes(setupResult.status));assert.deepEqual(Object.values(setupResult.value).flatMap(row=>row.error??[]),[]);
 const forwarded=async(req,res,target,path)=>{
  const chunks=[];for await(const chunk of req)chunks.push(chunk);const body=Buffer.concat(chunks);const headers={...req.headers};delete headers.host;delete headers.connection;
  if(modeFault&&path==='/sys-check-mode'){wire.push({stage,method:req.method,path,status:'actual-tcp-drop',hasNativeToken:!!headers.authtoken});req.socket.destroy();return;}
  const response=await fetch(target+path,{method:req.method,headers,...body.length?{body}:{},redirect:'manual',signal:AbortSignal.timeout(20000)}),bytes=Buffer.from(await response.arrayBuffer());let value;try{value=JSON.parse(bytes.toString());}catch{value=bytes.toString();}register(value);
  wire.push({stage,method:req.method,path,status:response.status,hasNativeToken:!!headers.authtoken,...path==='/sys-check-mode'?{mode:value}:{},...path.endsWith('/report')?{requestBody:JSON.parse(body.toString()),responseBody:value}:{}});
  const outHeaders={};for(const[k,v]of response.headers)if(!['connection','transfer-encoding','content-encoding','content-length'].includes(k))outHeaders[k]=v;res.writeHead(response.status,{...outHeaders,'content-length':bytes.length});res.end(bytes);
 };
 server=createServer(async(req,res)=>{try{const path=new URL('http://127.0.0.1'+req.url).pathname;if(path.startsWith('/api/'))return await forwarded(req,res,base,req.url.slice(4));if(path.startsWith('/fs/'))return await forwarded(req,res,fsBase,req.url.slice(3));const file=resolve(build,extname(path)?'.'+path:'index.html');if(relative(build,file).startsWith('..'))return res.writeHead(404).end();res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'})[extname(file)]??'application/octet-stream');res.end(await readFile(file));}catch(error){errors.push({proxy:String(error)});res.writeHead(500).end();}});
 await new Promise(done=>server.listen(0,'127.0.0.1',done));const url='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({channel:'chrome',headless:false});const page=await browser.newPage({viewport:{width:1280,height:850}});page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(String(error)));
 const capture=async name=>{await page.evaluate(()=>document.fonts.ready);await page.mouse.move(0,0);await waitForFiniteDocumentAnimations(page);await page.screenshot({path:join(out,name+'.png')});ui.push({name,url:new URL(page.url()).hash,bodyClass:await page.locator('body').getAttribute('class'),text:await page.locator('body').innerText()});};
 const signOut=async()=>{await page.locator('[data-cy=account-button]').click();await page.locator('[data-cy=logout-button]').click();await page.getByRole('dialog').locator('[data-cy=dialog-confirm]').click();await page.waitForURL(/\/r\/login\/?$/);};
 const signInAgain=async()=>{await page.goto(url+'/#/r/admin-login');await page.locator('[formcontrolname=name]').fill('super');await page.locator('[formcontrolname=pw]').fill(adminPassword);const response=page.waitForResponse(value=>value.request().method()==='PUT'&&new URL(value.url()).pathname==='/api/session/admin');await page.locator('[data-cy=login-admin]').click();assert.equal((await response).status(),200);await page.waitForURL(value=>!value.hash.includes('admin-login'));};
 stage='startup-public';await page.goto(url+'/#/r/admin-login');await page.locator('[data-cy=login-admin]').waitFor();await page.waitForLoadState('networkidle');const documentTime=await page.evaluate(()=>performance.timeOrigin);assert.equal(wire.filter(row=>row.path==='/sys-check-mode').at(-1).mode,false);
 await page.locator('[formcontrolname=name]').fill('super');await page.locator('[formcontrolname=pw]').fill(adminPassword);const signedIn=page.waitForResponse(response=>response.request().method()==='PUT'&&new URL(response.url()).pathname==='/api/session/admin');await page.locator('[data-cy=login-admin]').click();assert.equal((await signedIn).status(),200);await page.waitForURL(value=>!value.hash.includes('admin-login'));
 await page.goto(url+'/#/admin/'+workspace+'/files');await page.locator('[data-cy=upload-file-select]').waitFor({state:'attached'});await page.locator('[data-cy=upload-files]:not([disabled])').waitFor();assert.equal(await page.evaluate(()=>performance.timeOrigin),documentTime);
 const roster=mode=>xml('Testtakers','<Metadata/><Group id="R105.GROUP.'+workspace+'" label="Owned"><Login name="r105-owned-login" pw="owned-password" mode="'+mode+'"/></Group>');
 const uploadUi=async(name,text,label,expectedMode)=>{
  stage=label;const before=wire.length,pending=page.waitForResponse(response=>response.request().method()==='POST'&&new URL(response.url()).pathname==='/api/workspace/'+workspace+'/file');
  const modeReply=page.waitForResponse(async response=>new URL(response.url()).pathname==='/api/sys-check-mode'&&response.status()===200&&await response.json()===expectedMode);
  await page.locator('[data-cy=upload-file-select]').setInputFiles({name,mimeType:'application/xml',buffer:Buffer.from(text)});const response=await pending,value=await response.json();await modeReply;await page.locator('[data-cy=close-upload-report]:not([disabled])').waitFor();await capture(label);
  uploads.push({label,name,status:response.status(),report:value,modeReads:wire.slice(before).filter(row=>row.path==='/sys-check-mode')});return response.status();
 };
 await uploadUi('people.xml',roster('sys-check-login'),'own-upload-private',true);assert.equal(uploads.at(-1).modeReads.at(-1).mode,true);await page.locator('[data-cy=close-upload-report]').click();assert.equal(await page.evaluate(()=>performance.timeOrigin),documentTime);
 await uploadUi('people.xml',roster('monitor-group'),'own-replacement-public',false);assert.equal(uploads.at(-1).modeReads.at(-1).mode,false);await page.locator('[data-cy=close-upload-report]').click();assert.equal(await page.evaluate(()=>performance.timeOrigin),documentTime);
 await uploadUi('invalid.xml','<SysCheck/>','invalid-upload-refreshes-public-mode',false);assert.equal(uploads.at(-1).modeReads.at(-1).mode,false);await page.locator('[data-cy=close-upload-report]').click();assert.equal(await page.evaluate(()=>performance.timeOrigin),documentTime);
 modeFault=true;stage='own-upload-mode-transport-failure';await page.locator('[data-cy=upload-file-select]').setInputFiles({name:'people.xml',mimeType:'application/xml',buffer:Buffer.from(roster('sys-check-login'))});await page.getByRole('dialog').first().waitFor();await page.waitForLoadState('networkidle');await capture('own-upload-mode-transport-failure');assert.ok(wire.some(row=>row.status==='actual-tcp-drop'));
 const backendMode=(await send('mode-after-transport-failure','GET','/sys-check-mode')).value;assert.equal(backendMode,true);
 await verifyBuild();verifyImage();for(const[p,h]of Object.entries(frontendHashes))assert.equal(hash(await readFile(join(original,p))),h);assert.equal(git('status','--porcelain','--untracked-files=no'),'');
 await writeFile(join(out,'observations.json'),JSON.stringify(redact({verified:true,actualSourceBackend:true,actualSourceFrontend:true,sourceCommit:git('rev-parse','HEAD'),sourceHashes,frontendHashes,compiledHashes:manifest.files,cachedBuildProducer:manifest.buildProducerSourceCommit??manifest.cachedBuildProducer??null,vendor,xmlSchemaValidation:true,allowTestMode:false,browser:browser.version(),workspace,sameDocumentModeRefresh:true,backendMode,rows,wire,uploads,ui,errors,originalReadOnly:true}),null,2)+'\n');
 console.log(JSON.stringify({success:true,uploads:uploads.map(row=>({label:row.label,status:row.status,modes:row.modeReads.map(read=>read.mode)})),sameDocumentModeRefresh:true,modeDrops:wire.filter(row=>row.status==='actual-tcp-drop').length}));
}catch(error){await writeFile(join(out,'failure.json'),JSON.stringify(redact({stage,error:String(error),stack:error.stack,rows,wire,uploads,ui,errors}),null,2)+'\n');throw error;}
finally{await browser?.close();if(server)await new Promise(done=>server.close(done));}
