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
const frontendPaths=['frontend/src/app/app.component.ts','frontend/src/app/app-root/login/login.component.ts','frontend/src/app/shared/services/theme.service.ts','frontend/src/app/shared/services/asset.service.ts','frontend/src/app/shared/services/maindata/maindata.service.ts','frontend/src/app/brute-force-protection.service.ts','frontend/src/app/app-root/code-login/code-login.component.ts','frontend/src/app/app-root/code-login/code-login.component.scss','frontend/src/app/shared/components/header/header.component.html','frontend/src/app/shared/services/message.service.ts'];
const frontendHashes=Object.fromEntries(await Promise.all(frontendPaths.map(async p=>[p,hash(await readFile(join(original,p)))])));
const fsPort=execFileSync('docker',['port',process.env.ORIGINAL_ASSET_FILE_CONTAINER,'8080'],{encoding:'utf8'}).trim();assert.match(fsPort,/^127\.0\.0\.1:\d+$/);const fsBase='http://'+fsPort;
let token,workspace,server,browser;const assets=[],ui=[],errors=[],wire=[];
const xml=(type,body)=>'<'+type+' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/'+({Unit:'unit-xml/17.6',Booklet:'testcenter-booklet-xml/18.0',Testtakers:'testcenter-testtaker-xml/18.0',SysCheck:'testcenter-syscheck-xml/18.0'}[type])+'">'+body+'</'+type+'>';
try{
 const root=(await send('admin','PUT','/session/admin',{body:{name:'super',password:adminPassword}})).value;token=root.token;
 const grants=(await send('initial-grants','GET','/user/'+root.id+'/workspaces',{token})).value.filter(r=>r.selected).map(r=>({id:r.id,role:r.role}));
 workspace=Number((await send('workspace','PUT','/workspace',{token,body:{name:'Owned R98 Theme'}},201)).value);
 await send('grant-workspace','PATCH','/user/'+root.id+'/workspaces',{token,body:{ws:[...grants,{id:workspace,role:'RW'}]}});
 const upload=async(name,text)=>{const body=new FormData();body.append('fileforvo[]',new Blob([text],{type:'application/xml'}),name);const r=await request('upload-'+name,'POST','/workspace/'+workspace+'/file',{token,body});assert.ok([201,207].includes(r.status));assert.deepEqual(Object.values(r.value).flatMap(v=>v.error??[]),[],JSON.stringify(redact(r)));};
 const metadata={$schema:'https://raw.githubusercontent.com/verona-interfaces/metadata/master/verona-module-metadata.json',id:'owned-theme-player',version:'1.0.0',specVersion:'6.0',metadataVersion:'2.0',type:'player',name:[{lang:'de',value:'Owned theme Player'}]};
 await upload('owned-theme-player-1.0.html','<html><script type="application/ld+json">'+JSON.stringify(metadata)+'</script></html>');
 await upload('unit.xml',xml('Unit','<Metadata><Id>R98.UNIT</Id><Label>Owned</Label></Metadata><Definition player="owned-theme-player-1.0">Owned</Definition>'));
 await upload('booklet.xml',xml('Booklet','<Metadata><Id>R98.BOOK</Id><Label>Owned Theme Book</Label></Metadata><Units><Unit id="R98.UNIT" label="Owned"/></Units>'));
 await upload('booklet2.xml',xml('Booklet','<Metadata><Id>R98.BOOK2</Id><Label>Owned Theme Book2</Label></Metadata><Units><Unit id="R98.UNIT" label="Owned"/></Units>'));
 await upload('syscheck.xml',xml('SysCheck','<Metadata><Id>R98.CHECK</Id><Label>Owned Theme Check</Label></Metadata><Config skipnetwork="true"><Q id="owned" type="string" prompt="Owned"/></Config>'));
 for(const name of ['global','group','user']){const body=new FormData();body.append('file',new Blob([png],{type:'image/png'}),'owned-r98-'+name+'.png');assets.push((await send('asset-'+name,'POST','/assets',{token,body})).value);}
 await send('global-assets','POST','/asset-assignments',{token,body:{assignments:[{slotName:'logo',assetID:assets[0].id}]}});
 const assignment=asset=>'<AssetAssignments><Asset slot="logo">'+asset.originalName+'</Asset></AssetAssignments>';
 const loginXml=(name,theme,mode='run-hot-return')=>'<Login name="'+name+'" pw="owned-r98-theme-password" mode="'+mode+'">'+(mode==='run-hot-return'?'<Booklet codes="c1">R98.BOOK</Booklet><Booklet codes="c1">R98.BOOK2</Booklet>':mode==='monitor-group'?'<Profile id="full"/>':'')+(theme==='Primar'?assignment(assets[2]):'')+(theme?'<ViewSettings><theme>'+theme+'</theme></ViewSettings>':'')+'</Login>';
 const roster=xml('Testtakers','<Metadata/><Profiles><GroupMonitor><Profile id="full" label="Owned" view="full"/></GroupMonitor></Profiles><Group id="R98.GROUP" label="Owned Theme Group">'+assignment(assets[1])+['','Primar','Sekundar','Erwachsene'].map(theme=>loginXml('r98-'+(theme||'global').toLowerCase(),theme)).join('')+loginXml('r98-monitor','Primar','monitor-group')+loginXml('r98-syscheck','Sekundar','sys-check-login')+'</Group>');
 await upload('people.xml',roster);
 const logins={};for(const name of ['r98-global','r98-primar','r98-sekundar','r98-erwachsene','r98-monitor','r98-syscheck']){const value=await login('auth-'+name,name);logins[name]=value;await send('asset-scope-'+name,'GET','/asset-assignments',{token:value.token});}
 const forwarded=async(request,response,target,path)=>{const chunks=[];for await(const c of request)chunks.push(c);const body=Buffer.concat(chunks);const headers={...request.headers};delete headers.host;delete headers.connection;const r=await fetch(target+path,{method:request.method,headers,...body.length?{body}:{},redirect:'manual',signal:AbortSignal.timeout(20000)});const bytes=Buffer.from(await r.arrayBuffer());const outHeaders={};for(const[k,v]of r.headers)if(!['connection','transfer-encoding','content-encoding','content-length'].includes(k))outHeaders[k]=v;response.writeHead(r.status,{...outHeaders,'content-length':bytes.length});response.end(bytes);};
 server=createServer(async(req,res)=>{try{const path=new URL('http://127.0.0.1'+req.url).pathname;if(path.startsWith('/api/'))return await forwarded(req,res,base,req.url.slice(4));if(path.startsWith('/fs/'))return await forwarded(req,res,fsBase,req.url.slice(3));const file=resolve(build,extname(path)?'.'+path:'index.html');if(relative(build,file).startsWith('..'))return res.writeHead(404).end();res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'})[extname(file)]??'application/octet-stream');res.end(await readFile(file));}catch(error){errors.push({proxy:String(error)});res.writeHead(500).end();}});
 await new Promise(done=>server.listen(0,'127.0.0.1',done));const url='http://127.0.0.1:'+server.address().port;
 const ready=async(page,theme,logo,code=false)=>{await page.waitForFunction(({theme,logo,code})=>{const image=document.querySelector('[data-cy=logo]'),illustration=document.querySelector('.illustration img');return document.body.classList.contains(theme==='Erwachsene'?'theme-adult':'theme-'+theme.toLowerCase())&&image instanceof HTMLImageElement&&image.complete&&image.naturalWidth===1&&new URL(image.src).pathname.endsWith('/'+logo)&&(!code||illustration instanceof HTMLImageElement&&illustration.complete&&illustration.naturalWidth>0&&new URL(illustration.src).pathname.endsWith('/code-input-illustration-'+(theme==='Sekundar'?'teens':'kids')+'.png'));},{theme,logo,code});await page.evaluate(()=>document.fonts.ready);};
 const state=page=>page.evaluate(()=>({bodyClass:document.body.className,headerColor:getComputedStyle(document.querySelector('mat-toolbar')).backgroundColor,headerTitle:document.querySelector('mat-toolbar h1')?.textContent??null,images:[...document.querySelectorAll('tc-header img,tc-code-input img,.illustration img')].map(n=>({src:new URL(n.src).pathname,width:n.naturalWidth,complete:n.complete})),pathname:window.location.pathname,hash:window.location.hash,route:window.location.hash.replace(/^#/, '')||window.location.pathname}));
 browser=await chromium.launch({channel:'chrome',headless:false});
 for(const globalTheme of ['Primar','Sekundar','Erwachsene']){
  await send('global-theme-'+globalTheme,'PATCH','/system/config/app',{token,body:{themeName:globalTheme}});
  for(const theme of ['', 'Primar','Sekundar','Erwachsene'])for(const width of [390,1280]){
   const name='r98-'+(theme||'global').toLowerCase(),context=await browser.newContext({viewport:{width,height:844}}),page=await context.newPage();page.setDefaultTimeout(20000);
   page.on('pageerror',e=>errors.push({globalTheme,theme,error:String(e)}));page.on('request',r=>{const path=new URL(r.url()).pathname;if(path==='/api/asset-assignments'||path.startsWith('/api/session'))wire.push({globalTheme,theme,method:r.method(),path,hasToken:Boolean(r.headers().authtoken)});});
   try{
    await page.goto(url+'/r/login');await page.locator('[formcontrolname=name]').fill(name);await page.locator('[data-cy=login-user]').click();await page.locator('[formcontrolname=pw]').fill('owned-r98-theme-password');await page.locator('[data-cy=login-user]').click();await page.waitForURL(/\/r\/code-input/);
    const expected=theme||globalTheme;await page.waitForFunction(theme=>document.body.classList.contains(theme==='Erwachsene'?'theme-adult':'theme-'+theme.toLowerCase()),expected);await page.locator('tc-code-input').waitFor();await ready(page,expected,assets[theme==='Primar'?2:1].url,true);const initial=await state(page);await page.reload();await page.locator('tc-code-input').waitFor();await ready(page,expected,assets[theme==='Primar'?2:1].url,true);await page.waitForFunction(theme=>document.body.classList.contains(theme==='Erwachsene'?'theme-adult':'theme-'+theme.toLowerCase()),expected);const restored=await state(page);await page.screenshot({path:join(out,globalTheme+'-'+(theme||'global')+'-'+width+'-code.png')});
    await page.locator('tc-code-input input').fill('c1');await page.locator('tc-code-input input').press('Enter');await page.waitForURL(/\/r\/starter/);await page.locator('[data-cy=account-button]').waitFor();await ready(page,expected,assets[theme==='Primar'?2:1].url);const starter=await state(page);
    await page.locator('[data-cy=account-button]').click();await page.locator('[data-cy=logout-button]').click();const dialog=page.locator('mat-dialog-container');await dialog.locator('[data-cy=dialog-confirm]').waitFor();await dialog.screenshot({path:join(out,globalTheme+'-'+(theme||'global')+'-'+width+'-dialog.png'),animations:'disabled'});const logout={text:await dialog.innerText(),checkboxes:await dialog.locator('input[type=checkbox]').count(),buttons:await dialog.locator('button').allTextContents(),buttonClasses:await dialog.locator('button').evaluateAll(nodes=>nodes.map(n=>({text:n.textContent.trim(),className:n.className})))};await page.screenshot({path:join(out,globalTheme+'-'+(theme||'global')+'-'+width+'-logout.png')});
    await dialog.locator('[data-cy=dialog-confirm]').click();await page.waitForURL(/\/r\/login/);await page.waitForFunction(theme=>document.body.classList.contains(theme==='Erwachsene'?'theme-adult':'theme-'+theme.toLowerCase()),globalTheme);await page.locator('[formcontrolname=name]').waitFor();await ready(page,globalTheme,assets[0].url);const loggedOut=await state(page);
    ui.push({globalTheme,width,loginTheme:theme||null,expectedTheme:expected,initial,restored,starter,logout,loggedOut});
   }finally{await context.close();}
  }
 }
 for(const[name,theme]of [['r98-monitor','Primar'],['r98-syscheck','Sekundar']]){
  const context=await browser.newContext(),page=await context.newPage();page.setDefaultTimeout(20000);
  try{await page.goto(url+'/r/login');await page.locator('[formcontrolname=name]').fill(name);await page.locator('[data-cy=login-user]').click();await page.locator('[formcontrolname=pw]').fill('owned-r98-theme-password');await page.locator('[data-cy=login-user]').click();await page.waitForFunction(theme=>document.body.classList.contains('theme-'+theme.toLowerCase()),theme);await page.waitForURL(name==='r98-monitor'?/\/r\/starter/:/\/check\/1\/R98.CHECK/);await ready(page,theme,assets[name==='r98-monitor'?2:1].url);ui.push({mode:name==='r98-monitor'?'monitor-group':'sys-check-login',globalTheme:'Erwachsene',loginTheme:theme,state:await state(page),sourceAccess:redact(logins[name])});}finally{await context.close();}
 }
 await verifyBuild();verifyImage();for(const[p,h]of Object.entries(frontendHashes))assert.equal(hash(await readFile(join(original,p))),h);assert.equal(git('status','--porcelain','--untracked-files=no'),'');
 assert.deepEqual(errors,[]);const screenshotHashes={};for(const row of ui.filter(row=>!row.mode))for(const surface of ['code','dialog','logout']){const name=row.globalTheme+'-'+(row.loginTheme||'global')+'-'+row.width+'-'+surface+'.png';screenshotHashes[name]=hash(await readFile(join(out,name)));}await writeFile(join(out,'observations.json'),JSON.stringify({verified:true,sourceCommit:git('rev-parse','HEAD'),sourceHashes,sourceFilesVerified:137,frontendHashes,compiledBuild:{producerAppCommit:manifest.appCommit,source:manifest.source,files:manifest.files,readOnly:true},backendImage:containerInfo.Image,vendor,actualSourceBackend:true,actualSourceFrontend:true,sourceBrowserChannel:'chrome',sourceBrowserVersion:browser.version(),sourceBrowserVersionRecorded:true,apiMocks:false,sqlSeedsOrDaoStubs:false,configuration:{xmlSchemaValidation:true,allowTestMode:false},roster,rows:redact(rows),ui,wire,errors,screenshotHashes,functionalOnly:true,visualParityProven:false,wholeOriginalParityProven:false},null,2)+'\n');console.log(JSON.stringify({success:true,apiRows:rows.length,uiCases:ui.length,errors}));
}catch(error){await writeFile(join(out,'failure.json'),JSON.stringify(redact({error:String(error),rows,ui,errors}),null,2)+'\n');throw error;}
finally{await browser?.close();if(server)await new Promise(done=>server.close(done));}
