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
const frontendHashes=Object.fromEntries(await Promise.all(frontendPaths.map(async p=>[p,hash(await readFile(join(original,p)))])));
const fsPort=execFileSync('docker',['port',process.env.ORIGINAL_ASSET_FILE_CONTAINER,'8080'],{encoding:'utf8'}).trim();assert.match(fsPort,/^127\.0\.0\.1:\d+$/);const fsBase='http://'+fsPort;
let token,workspace,server,browser;const assets=[],ui=[],errors=[],wire=[];
const xml=(type,body)=>'<'+type+' xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/'+({Unit:'unit-xml/17.6',Booklet:'testcenter-booklet-xml/18.0',Testtakers:'testcenter-testtaker-xml/18.0',SysCheck:'testcenter-syscheck-xml/18.0'}[type])+'">'+body+'</'+type+'>';

const {waitForFiniteDocumentAnimations}=await import('file://'+process.env.REWRITE_APP_ROOT+'/scripts/finite-animation-ready.mjs');
const definitions=[
 {id:'DEFAULT',speed:''},
 {id:'SCALAR',speed:'<DownloadSpeed min="1"/><UploadSpeed>64</UploadSpeed>'},
 {id:'INVALID',speed:'<DownloadSpeed maxErrorsPerSequence="0">oops</DownloadSpeed><UploadSpeed>64</UploadSpeed>'},
 {id:'SMALL',speed:'<DownloadSpeed maxErrorsPerSequence="0">15</DownloadSpeed><UploadSpeed>64</UploadSpeed>'},
 {id:'DROP.DOWN',speed:'<DownloadSpeed maxErrorsPerSequence="0">128</DownloadSpeed><UploadSpeed>64</UploadSpeed>',fault:'download'},
 {id:'DROP.UP',speed:'<DownloadSpeed>64</DownloadSpeed><UploadSpeed maxErrorsPerSequence="0">64</UploadSpeed>',fault:'upload'},
 {id:'ZERO.UP',speed:'<DownloadSpeed>64</DownloadSpeed><UploadSpeed>0,64</UploadSpeed>'}
];
const networkCases=[],faults=[];let fault='',observedPage;
try{
 const sourceLoginName='r102-source-'+Date.now();
 const root=(await send('admin','PUT','/session/admin',{body:{name:'super',password:adminPassword}})).value;token=root.token;
 const grants=(await send('initial-grants','GET','/user/'+root.id+'/workspaces',{token})).value.filter(r=>r.selected).map(r=>({id:r.id,role:r.role}));
 workspace=Number((await send('workspace','PUT','/workspace',{token,body:{name:'Owned R102 Network '+Date.now()}},201)).value);
 await send('grant-workspace','PATCH','/user/'+root.id+'/workspaces',{token,body:{ws:[...grants,{id:workspace,role:'RW'}]}});
 const upload=async(name,text)=>{const body=new FormData();body.append('fileforvo[]',new Blob([text],{type:'application/xml'}),name);const r=await request('upload-'+name,'POST','/workspace/'+workspace+'/file',{token,body});assert.ok([201,207].includes(r.status));assert.deepEqual(Object.values(r.value).flatMap(v=>v.error??[]),[],JSON.stringify(redact(r)));};
 for(const c of definitions)c.speed=c.speed.replace(/(<DownloadSpeed[^>]*(?:\/>|>[^<]*<\/DownloadSpeed>))(<UploadSpeed[^>]*>[^<]*<\/UploadSpeed>)/,'$2$1');
 for(const c of definitions)c.speed=c.speed.replace(/<(UploadSpeed|DownloadSpeed)([^>]*?)(\/?)>/g,(_,tag,attrs,end)=>'<'+tag+(/\bmin=/.test(attrs)?attrs:' min="0"'+attrs)+end+'>');
 for(const c of definitions)await upload('network-'+c.id.toLowerCase()+'.xml',xml('SysCheck','<Metadata><Id>R102.'+c.id+'</Id><Label>Owned network '+c.id+'</Label></Metadata><Config savekey="owned-key">'+c.speed+'<Q id="feedback" type="string" prompt="Owned feedback"/></Config>'));
 await upload('people.xml',xml('Testtakers','<Metadata/><Group id="R102.GROUP.'+workspace+'" label="Owned Network Group"><Login name="'+sourceLoginName+'" pw="owned-r98-theme-password" mode="sys-check-login"><ViewSettings><theme>Sekundar</theme></ViewSettings></Login></Group>'));
 assert.equal((await send('mode-native','GET','/sys-check-mode')).value,true);
 const forwarded=async(request,response,target,path)=>{const chunks=[];for await(const c of request)chunks.push(c);const body=Buffer.concat(chunks);const headers={...request.headers};delete headers.host;delete headers.connection;const r=await fetch(target+path,{method:request.method,headers,...body.length?{body}:{},redirect:'manual',signal:AbortSignal.timeout(20000)});const bytes=Buffer.from(await r.arrayBuffer());const outHeaders={};for(const[k,v]of r.headers)if(!['connection','transfer-encoding','content-encoding','content-length'].includes(k))outHeaders[k]=v;response.writeHead(r.status,{...outHeaders,'content-length':bytes.length});response.end(bytes);};
 server=createServer(async(req,res)=>{try{const path=new URL('http://127.0.0.1'+req.url).pathname;if((fault==='download'&&path.startsWith('/api/speed-test/random-package/'))||(fault==='upload'&&req.method==='POST'&&path==='/api/speed-test/random-package')){faults.push({fault,method:req.method,path});req.socket.destroy();return;}if(path.startsWith('/api/'))return await forwarded(req,res,base,req.url.slice(4));if(path.startsWith('/fs/'))return await forwarded(req,res,fsBase,req.url.slice(3));const file=resolve(build,extname(path)&&!path.startsWith('/check/')?'.'+path:'index.html');if(relative(build,file).startsWith('..'))return res.writeHead(404).end();res.setHeader('content-type',({'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml','.woff2':'font/woff2'})[extname(file)]??'application/octet-stream');res.end(await readFile(file));}catch(error){errors.push({proxy:String(error)});res.writeHead(500).end();}});
 await new Promise(done=>server.listen(0,'127.0.0.1',done));const url='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({channel:'chrome',headless:false});const page=await browser.newPage({viewport:{width:1280,height:850}});observedPage=page;page.setDefaultTimeout(20000);page.on('pageerror',error=>errors.push(String(error)));
 page.on('request',req=>{const path=new URL(req.url()).pathname;if(path.startsWith('/api/'))wire.push({method:req.method(),path,bodyBytes:req.postDataBuffer()?.length??0});});
 await page.goto(url+'/r/login');await page.locator('[formcontrolname=name]').fill(sourceLoginName);await page.locator('[data-cy=login-user]').click();await page.locator('[formcontrolname=pw]').fill('owned-r98-theme-password');await page.locator('[data-cy=login-user]').click();await page.locator('[data-cy="syscheck-R102.DEFAULT"]').waitFor();
 for(const c of definitions){
  fault=c.fault??'';const before=wire.length,beforeErrors=errors.length;const configuration=(await send('config-'+c.id,'GET','/workspace/'+workspace+'/sys-check/R102.'+c.id)).value;
  await page.goto(url+'/#/r/starter');await page.reload();await page.locator('[data-cy="syscheck-R102.'+c.id+'"]').waitFor();await page.locator('[data-cy="syscheck-R102.'+c.id+'"]').click();await page.locator('#syscheck-next-step:not([disabled])').waitFor();await page.locator('#syscheck-next-step').click();await page.waitForURL(/\/n$/);
  const outcome=await Promise.race([page.getByText('Die folgenden Netzwerkeigenschaften wurden festgestellt:',{exact:false}).waitFor().then(()=>'complete'),page.locator('mat-dialog-container').waitFor().then(()=>'dialog')]);
  if(outcome==='dialog'){
   const dialog=page.locator('mat-dialog-container');await waitForFiniteDocumentAnimations(page);const state={canContinue:await page.locator('#syscheck-next-step').isEnabled(),dialog:await dialog.innerText()};
   await page.screenshot({path:join(out,c.id+'-error.png')});networkCases.push({id:c.id,definition:c,configuration,outcome,networkState:state,requests:wire.slice(before),pageErrors:errors.slice(beforeErrors)});console.log(JSON.stringify({case:c.id,outcome,state}));continue;
  }
  await page.locator('#syscheck-next-step:not([disabled])').waitFor();await page.mouse.move(1270,840);await page.evaluate(()=>document.fonts.ready);await waitForFiniteDocumentAnimations(page);
  const networkState=await page.locator('tc-speed-chart').first().evaluate(node=>({card:node.closest('mat-card')?.innerText,canContinue:!document.querySelector('#syscheck-next-step').disabled}));
  await page.screenshot({path:join(out,c.id+'-network.png')});
  await page.locator('#syscheck-next-step').click();await page.waitForURL(/\/q$/);await page.locator('#feedback').fill('Owned network feedback');await page.locator('#syscheck-next-step').click();await page.waitForURL(/\/r$/);
  const bodyPromise=page.waitForRequest(req=>req.method()==='PUT'&&new URL(req.url()).pathname.endsWith('/report'));
  await page.locator('[data-cy="send sc-report"]').click();const saved=(await bodyPromise).postDataJSON();await page.locator('[data-cy=dialog-title]').waitFor();await waitForFiniteDocumentAnimations(page);await page.locator('[data-cy=dialog-cancel]').click();await page.waitForURL(/\/r\/starter$/);
  networkCases.push({id:c.id,definition:c,configuration,outcome,networkState,network:saved.network,requests:wire.slice(before)});console.log(JSON.stringify({case:c.id,canContinue:networkState.canContinue,network:saved.network.slice(0,7),requests:wire.slice(before)}));
 }
 fault='';await send('reports-overview','GET','/workspace/'+workspace+'/sys-check/reports/overview',{token});
 await verifyBuild();verifyImage();for(const[p,h]of Object.entries(frontendHashes))assert.equal(hash(await readFile(join(original,p))),h);assert.equal(git('status','--porcelain','--untracked-files=no'),'');
 const expectedErrors=networkCases.filter(c=>c.outcome==='dialog').flatMap(c=>c.pageErrors);assert.deepEqual(errors,expectedErrors);await writeFile(join(out,'observations.json'),JSON.stringify(redact({verified:true,sourceCommit:git('rev-parse','HEAD'),sourceHashes,frontendHashes,compiledBuild:{producerAppCommit:manifest.appCommit,source:manifest.source,files:manifest.files,readOnly:true},backendImage:containerInfo.Image,vendor,actualSourceBackend:true,actualSourceFrontend:true,sourceBrowserChannel:'chrome',sourceBrowserVersion:browser.version(),apiMocks:false,sqlSeedsOrDaoStubs:false,transportFaultInjection:'owned proxy destroys speed-test sockets; no fake API response bodies',configuration:{xmlSchemaValidation:true,allowTestMode:false,bruteForceProtection:'login person'},rows,networkCases,faults,wire,errors}),null,2)+'\n');
}catch(error){if(observedPage){await observedPage.screenshot({path:join(out,'failure.png')});await writeFile(join(out,'failure-dom.json'),JSON.stringify({url:observedPage.url(),body:await observedPage.locator('body').innerText(),html:await observedPage.content()},null,2));}await writeFile(join(out,'failure.json'),JSON.stringify(redact({error:String(error),rows,networkCases,faults,errors}),null,2)+'\n');throw error;}
finally{await browser?.close();if(server)await new Promise(done=>server.close(done));}
