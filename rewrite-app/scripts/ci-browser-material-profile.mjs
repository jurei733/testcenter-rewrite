import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createReadStream} from 'node:fs';
import {lstat,mkdir,readFile,readdir,realpath,stat,writeFile} from 'node:fs/promises';
import {dirname,join,relative,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {brotliDecompressSync,inflateRawSync} from 'node:zlib';
import {createServer} from 'node:http';
import {nativeContext} from './ci-browser-system.mjs';
import {captureStableViewport} from './stable-viewport-capture.mjs';
import {compareScreenshots} from './exact-rgba-comparison.mjs';
import {waitForOriginalSampleResource} from './original-sample-readiness.mjs';

// Diagnostic evidence only. No production restore or cohort check calls this module.
export const materialProfileSource={commit:'eedae41840cbe90e5547c0211da818bdf620f5aa',
 playerSha256:'bece3e969e4267a5690620b4a9b056c5245c02697628b1306dca630423a7b2d3',
 definitionSha256:'532310b1f4bf1eab6eaaa1603962a39566919b5669974f7b1a7dc2de4316d202',
 resourceZipSha256:'da2ae859b77f8a6ba09b3f61cab38ea0c5d6de5f08b9fcefef9d263aef187f4e'};
const digest=bytes=>createHash('sha256').update(bytes).digest('hex');
const hashPattern=/^[a-f0-9]{64}$/;
const native=(command,args)=>execFileSync('/usr/bin/'+command,args,{encoding:'utf8',timeout:30000,maxBuffer:4*1024*1024,env:{...process.env,LC_ALL:'C'}});
const inventory=()=>native('dpkg-query',['-W','-f=${Package}\t${Version}\t${Architecture}\t${db:Status-Abbrev}\n']).split('\n').filter(Boolean).sort().join('\n')+'\n';
export function canonicalMaterial(value){
 const encode=value=>{
  if(value===null||typeof value==='boolean')return value;
  if(typeof value==='number'){assert.ok(Number.isFinite(value));return value;}
  if(typeof value==='string'){assert.ok(value.length<=1024*1024);return value;}
  if(Array.isArray(value)){assert.ok(value.length<=8192);return value.map(encode);}
  assert.ok(value&&Object.getPrototypeOf(value)===Object.prototype,'Profile values must be plain JSON.');
  assert.ok(!Object.hasOwn(value,'__proto__'));
  return Object.fromEntries(Object.keys(value).sort().map(key=>[key,encode(value[key])]));
 };
 const result=JSON.stringify(encode(value));assert.ok(Buffer.byteLength(result)<=4*1024*1024);return result;
}
export function validateDiagnosticProfile(profile){
 assert.equal(profile?.version,1);assert.equal(profile.qualification,'diagnostic-only');
 const context=profile.context;
 assert.match(context?.commit??'',/^[a-f0-9]{40}$/);
 for(const key of ['runId','runAttempt'])assert.match(context[key]??'',/^[1-9][0-9]*$/);
 assert.match(context.imageVersion??'',/^[A-Za-z0-9._-]{1,80}$/);assert.equal(context.imageOS,'ubuntu24');
 assert.match(context.lockSha256??'',hashPattern);
 assert.deepEqual(profile.material?.source,materialProfileSource);
 assert.match(profile.material.scriptSha256??'',hashPattern);
 assert.ok(Array.isArray(profile.material.files)&&profile.material.files.length>0);
 const names=[];
 for(const file of profile.material.files){assert.ok(typeof file.name==='string'&&file.name.length>0);assert.match(file.sha256??'',hashPattern);assert.ok(Number.isSafeInteger(file.bytes)&&file.bytes>0);names.push(file.name);}
 assert.deepEqual(names,[...new Set(names)].sort(),'Material files must be unique and sorted.');
 const views=profile.material.views;
 assert.deepEqual(views?.map(view=>view.name),['desktop-empty','desktop-input','mobile-empty','mobile-input']);
 for(const view of views){assert.match(view.pixelSha256??'',hashPattern);assert.ok(view.width>0&&view.height>0);}
 assert.equal(profile.materialSha256,digest(canonicalMaterial(profile.material)),'Material profile digest mismatch.');
 return profile;
}
export function compareDiagnosticProfiles(left,right){
 validateDiagnosticProfile(left);validateDiagnosticProfile(right);
 const {imageVersion:leftImage,...leftContext}=left.context,{imageVersion:rightImage,...rightContext}=right.context;
 assert.equal(canonicalMaterial(leftContext),canonicalMaterial(rightContext),'Diagnostic profiles must share the exact workflow, lock and platform.');
 return {qualification:'diagnostic-only',productionAdmission:false,leftImage,rightImage,
  sameImageVersion:leftImage===rightImage,materialEqual:left.materialSha256===right.materialSha256,
  leftMaterialSha256:left.materialSha256,rightMaterialSha256:right.materialSha256};
}
async function fileRow(name,path){
 const entry=await stat(path);assert.ok(entry.isFile()&&entry.size>0&&entry.size<=512*1024*1024,'Invalid material file.');
 const hash=createHash('sha256');for await(const bytes of createReadStream(path))hash.update(bytes);
 return {name,bytes:entry.size,mode:entry.mode&0o777,sha256:hash.digest('hex')};
}
async function treeFiles(root,logical,files){
 for(const name of (await readdir(root)).sort()){
  const path=join(root,name),info=await lstat(path);assert.ok(!info.isSymbolicLink(),'Browser payload must not contain links.');
  if(info.isDirectory())await treeFiles(path,logical+'/'+name,files);
  else{assert.ok(info.isFile());files.set(logical+'/'+name,path);}
 }
}
function fontPaths(){
 const fonts=native('fc-list',['--format','%{file}\n']).split('\n').filter(Boolean);
 assert.ok(fonts.length>0);const configs=native('fc-conflist',[]).split('\n').filter(Boolean).map(line=>{
  const match=/^[+-] (\/[^:]+):/.exec(line);assert.ok(match,'Unexpected fontconfig file inventory.');return match[1];
 });
 assert.ok(configs.length>0);return [...new Set([...fonts,...configs])].sort();
}
async function mappedBrowserFiles(browser){
 const session=await browser.newBrowserCDPSession();
 try{
  const processes=(await session.send('SystemInfo.getProcessInfo')).processInfo;assert.ok(processes.length>0);
  const paths=new Set();
  for(const process of processes){
   const pid=process.id;assert.ok(Number.isSafeInteger(pid)&&pid>0);
   const directory='/proc/'+pid;let map;
   try{
    const uid=/^Uid:\s+(\d+)\s+(\d+)/m.exec(await readFile(directory+'/status','utf8'));
    assert.ok(uid&&Number(uid[1])===globalThis.process.getuid()&&Number(uid[2])===globalThis.process.getuid(),'Only this browser user process may be inspected.');
    try{map=await readFile(directory+'/maps','utf8');}
    catch(error){if(error.code!=='EACCES')throw error;
     // Sandboxed owned renderers may disable dumpability. Read only map paths,
     // never process memory, environment, command lines or unrelated PIDs.
     map=native('sudo',['-n','--','/usr/bin/cat','--',directory+'/maps']);
    }
   }catch(error){
    if(error.code==='ENOENT'&&!(await session.send('SystemInfo.getProcessInfo')).processInfo.some(item=>item.id===pid))continue;
    throw error;
   }
   for(const line of map.split('\n')){
    const path=/^[0-9a-f-]+\s+\S+\s+\S+\s+\S+\s+\S+\s+(\/.*)$/.exec(line)?.[1];
    if(path&&!path.endsWith(' (deleted)')&&/\.so(?:\.|$)/.test(path))paths.add(await realpath(path));
   }
  }
  assert.ok(paths.size>0);return [...paths].sort();
 }finally{await session.detach();}
}
export async function captureOriginalMaterialViews(browser,root,output,observe=async()=>{}){
 assert.equal(process.env.UI_SMOKE_HEADFUL,'true');
 const player=brotliDecompressSync(Buffer.from(await readFile(join(root,'test-fixtures/original-testcenter/players/verona-player-simple-6.0.5.html.br.base64'),'utf8'),'base64'));
 const definition=await readFile(join(root,'test-fixtures/original-testcenter/definitions/SAMPLE_UNITCONTENTS.HTM'),'utf8');
 assert.equal(digest(player),materialProfileSource.playerSha256);assert.equal(digest(definition),materialProfileSource.definitionSha256);
 const archive=Buffer.from(await readFile(join(root,'test-fixtures/original-testcenter/resources/sample_resource_package.itcr.zip.base64'),'utf8'),'base64');
 assert.equal(digest(archive),materialProfileSource.resourceZipSha256);
 // Decode only this pinned, single-member fixture, never arbitrary ZIP input.
 assert.equal(archive.readUInt32LE(0),0x04034b50);assert.equal(archive.readUInt16LE(6),0);assert.equal(archive.readUInt16LE(8),8);
 const nameLength=archive.readUInt16LE(26),extraLength=archive.readUInt16LE(28),start=30+nameLength+extraLength;
 assert.equal(archive.subarray(30,30+nameLength).toString(),'file.text');
 const resource=inflateRawSync(archive.subarray(start,start+archive.readUInt32LE(18)),{maxOutputLength:4096});
 assert.equal(resource.length,archive.readUInt32LE(22));const content=resource.toString('utf8');
 const escaped=player.toString('utf8').replaceAll('&','&amp;').replaceAll('"','&quot;');
 const server=createServer((request,response)=>{
  response.setHeader('cache-control','no-store');
  if(request.url==='/resources/sample_resource_package/file.text'){response.setHeader('access-control-allow-origin','*');response.end(content);}
  else if(request.url==='/'){response.setHeader('content-type','text/html');response.end('<!doctype html><html><body style="margin:0"><iframe id="source" style="display:block;border:0;width:100vw;height:100vh" sandbox="allow-scripts allow-forms" srcdoc="'+escaped+'"></iframe></body></html>');}
  else response.writeHead(404).end();
 });
 await new Promise(done=>server.listen(0,'127.0.0.1',done));
 const base='http://127.0.0.1:'+server.address().port,views=[];let screen;
 try{
  for(const [name,width,height]of [['desktop',1366,900],['mobile',390,844]]){
   let reference;
   for(let repeat=0;repeat<2;repeat++){
    const context=await browser.newContext({viewport:{width,height},deviceScaleFactor:1,locale:'de-DE',timezoneId:'Europe/Berlin',colorScheme:'light'});
    try{
     // Source random text receives the same reproducible random input stream.
     // Neither Source bytes nor clocks, styles, content or form behavior change.
     await context.addInitScript(()=>{let seed=8731;Math.random=()=>((seed=(Math.imul(seed,1664525)+1013904223)>>>0)/4294967296);});
     const page=await context.newPage();page.setDefaultTimeout(15000);await page.bringToFront();
     await page.addInitScript(()=>{window.ready=false;addEventListener('message',event=>{if(event.source===document.querySelector('iframe')?.contentWindow&&event.data.type==='vopReadyNotification')window.ready=true;});});
     await page.goto(base);await page.waitForFunction(()=>window.ready);
     await page.evaluate(({definition,base})=>document.querySelector('iframe').contentWindow.postMessage({type:'vopStartCommand',sessionId:'owned-material',unitDefinition:definition,playerConfig:{pagingMode:'concat-scroll',directDownloadUrl:base+'/resources'}},'*'),{definition,base});
     const frame=page.frameLocator('#source');await waitForOriginalSampleResource(frame,content);
     await frame.locator('input[name="required-text-field"]').waitFor();
     await frame.locator('body').evaluate(()=>document.fonts.ready);
     const capture=async state=>{
      await page.mouse.move(0,0);
      const measure=()=>page.evaluate(()=>({width:innerWidth,height:innerHeight,frame:document.querySelector('iframe').getBoundingClientRect().toJSON()}));
      const path=join(output,name+'-'+state+'-'+repeat+'.png');
      const result=await captureStableViewport(page,measure,path);
      const pixels=await compareScreenshots(page,result.bytes,result.bytes);assert.equal(pixels.differingPixels,0);
      return{name:name+'-'+state,width:pixels.width,height:pixels.height,pixelSha256:pixels.sourcePixelSha256};
     };
     const current=[await capture('empty')];
     const input=frame.locator('input[name="required-text-field"]');await input.fill('ÄÖÜ ß Ω العربية 中文 日本語 🙂');await input.press('Tab');
     assert.equal(await input.inputValue(),'ÄÖÜ ß Ω العربية 中文 日本語 🙂');
     await frame.locator('legend[data-cy="legend-longContent"]').click();
     await frame.locator('body').evaluate(()=>document.fonts.ready);
     current.push(await capture('input'));
     if(repeat===0)await observe(browser);
     screen??=await page.evaluate(()=>({width:screen.width,height:screen.height,colorDepth:screen.colorDepth,pixelDepth:screen.pixelDepth}));
     if(reference)assert.deepEqual(current,reference,'Original viewport must reproduce in an independent fresh browser context.');
     else reference=current;
    }finally{await context.close();}
   }
   views.push(...reference);
  }
  assert.notEqual(views[0].pixelSha256,views[1].pixelSha256,'Real Source input must change visible pixels.');
  return {views,screen};
 }finally{await new Promise(done=>server.close(done));}
}
export async function captureDiagnosticProfile(root,output){
 assert.equal(process.env.UI_SMOKE_HEADFUL,'true');await mkdir(output,{recursive:true});
 const context=await nativeContext(root),before=inventory();
 const nativeManifest=JSON.parse(await readFile(process.env.CI_BROWSER_NATIVE_MANIFEST,'utf8'));
 assert.deepEqual(nativeManifest.context,context,'Each diagnostic job must qualify its own exact image through authenticated native APT.');
 assert.equal(nativeManifest.afterInventory,before,'Native APT result must match the actual profile host.');
 const {chromium}=await import('playwright');let browser;
 try{
  browser=await chromium.launch({headless:false});
  const mapped=new Set(),paths=new Map();
  const source=await captureOriginalMaterialViews(browser,root,output,async()=>{for(const path of await mappedBrowserFiles(browser))mapped.add(path);});
  // Browser tree includes its binaries, bundled libraries, ICU data and resources.
  await treeFiles(dirname(chromium.executablePath()),'chromium',paths);
  for(const path of [...fontPaths(),...mapped,'/usr/bin/Xvfb','/usr/bin/fc-list','/usr/bin/fc-match',process.execPath]){
   const real=await realpath(path);paths.set('native:'+real,real);
  }
  const files=[];
  for(const [name,path]of [...paths.entries()].sort(([a],[b])=>a.localeCompare(b,'en'))){files.push(await fileRow(name,path));}
  files.sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);
  const material={source:materialProfileSource,scriptSha256:digest(await readFile(fileURLToPath(import.meta.url))),
   nodeVersion:process.version,browserVersion:browser.version(),packageInventorySha256:digest(before),
   fontCatalogSha256:digest(native('fc-list',['--format','%{file}\t%{family}\t%{style}\n']).split('\n').filter(Boolean).sort().join('\n')+'\n'),
   screen:source.screen,files,views:source.views};
  const profile={version:1,qualification:'diagnostic-only',context,material,materialSha256:digest(canonicalMaterial(material))};
  validateDiagnosticProfile(profile);assert.equal(inventory(),before,'Capturing diagnostic material must not change packages.');
  await writeFile(join(output,'profile.json'),JSON.stringify(profile,null,2)+'\n');
  console.log(JSON.stringify({imageVersion:context.imageVersion,materialSha256:profile.materialSha256,files:files.length,bytes:files.reduce((n,f)=>n+f.bytes,0),views:material.views}));
  return profile;
 }finally{await browser?.close();}
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{await captureDiagnosticProfile(process.cwd(),resolve(process.env.CI_BROWSER_MATERIAL_DIR));}
 catch(error){console.error(error.message);process.exitCode=1;}
}
