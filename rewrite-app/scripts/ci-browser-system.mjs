import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {constants} from 'node:fs';
import {appendFile,chmod,copyFile,lstat,mkdir,mkdtemp,readFile,readdir,writeFile} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {preferOfficialUbuntuArchive} from './ci-apt-mirrors.mjs';
import {validateRuntimeMaterial} from './ci-browser-material-contract.mjs';
import {runSupervisedSmoke} from './supervised-smoke.mjs';

const require=createRequire(import.meta.url),maxBytes=256*1024*1024;
const authenticatedAptOptions=['-o','Acquire::AllowInsecureRepositories=false','-o','APT::Get::AllowUnauthenticated=false'];
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
export function commandFailure(command,cause){
  const status=Number.isInteger(cause.status)&&cause.status>0&&cause.status<=255?cause.status:1;
  // apt-config can contain proxy credentials. Never attach the native error,
  // stdout or environment to the public failure, including its cause chain.
  return Object.assign(Error(`Browser system ${command} failed with status ${status}`),{exitCode:status});
}
const native=(command,args,options={})=>{
  try{return execFileSync('/usr/bin/'+command,args,{
    encoding:'utf8',maxBuffer:4*1024*1024,env:{...process.env,LC_ALL:'C',DEBIAN_FRONTEND:'noninteractive'},...options
  });}catch(error){throw commandFailure(command,error);}
};
const assert=(condition,message)=>{if(!condition)throw Error(message);};
const install=([command,...args])=>{
  assert(['install','apt-get','unshare'].includes(command),'Unexpected privileged browser system command');
  return native('sudo',['-n','--','/usr/bin/env','LC_ALL=C','DEBIAN_FRONTEND=noninteractive','/usr/bin/'+command,...args],{stdio:'inherit'});
};
const regular=async(path,limit)=>{
  const entry=await lstat(path);
  assert(entry.isFile()&&!entry.isSymbolicLink()&&entry.size<=limit,'Unsafe browser system file');
  return readFile(path);
};
const inventory=()=>native('dpkg-query',['-W','-f=${Package}\t${Version}\t${Architecture}\t${db:Status-Abbrev}\n'])
  .split('\n').filter(Boolean).sort().join('\n')+'\n';
const fontDigest=()=>{
  const rows=native('fc-list',['--format','%{file}\t%{family}\t%{style}\n']).split('\n').filter(Boolean).sort();
  assert(rows.length>0,'Native font inventory is empty');return sha(rows.join('\n')+'\n');
};

export function parseInventory(value){
  assert(typeof value==='string'&&Buffer.byteLength(value)<=1024*1024,'Invalid package inventory');
  const rows=value.split('\n').filter(Boolean),result=new Map();
  for(const row of rows){
    const [name,version,arch,status,...extra]=row.split('\t');
    assert(!extra.length&&/^[a-z0-9][a-z0-9+.-]*$/.test(name??'')&&
      /^[A-Za-z0-9:~+._-]+$/.test(version??'')&&/^[a-z0-9][a-z0-9-]*$/.test(arch??'')&&
      /^[a-zA-Z? ][a-zA-Z? ][a-zA-Z? ]$/.test(status??''),'Invalid package inventory row');
    const key=name+':'+arch;assert(!result.has(key),'Duplicate package inventory row');
    result.set(key,{name,version,arch,status,row});
  }
  assert(rows.length>0&&rows.join('\n')+'\n'===[...rows].sort().join('\n')+'\n'&&value===rows.join('\n')+'\n','Noncanonical package inventory');
  return result;
}

export function lockedBrowserDependencies(root){
  const packagePath=require.resolve('playwright-core/package.json',{paths:[root]});
  const dependencyPath=join(dirname(packagePath),'lib/server/registry/nativeDeps.js');
  const group=require(dependencyPath).deps['ubuntu24.04-x64'];
  assert(group&&Array.isArray(group.tools)&&Array.isArray(group.chromium),'Missing locked Ubuntu browser profile');
  const packages=[...new Set([...group.tools,...group.chromium])].sort();
  assert(packages.length>0&&packages.length<=128&&packages.every(name=>/^[a-z0-9][a-z0-9+.-]*$/.test(name)),'Invalid locked browser packages');
  return {packagePath,dependencyPath,packages};
}

export async function nativeContext(root,env=process.env){
  assert(process.platform==='linux'&&process.arch==='x64','Browser system qualification requires native Linux x64');
  const os=await readFile('/etc/os-release','utf8');
  assert(/^ID=ubuntu$/m.test(os)&&/^VERSION_ID="24\.04"$/m.test(os)&&native('dpkg',['--print-architecture']).trim()==='amd64','Unqualified browser system OS');
  assert(env.ImageOS==='ubuntu24'&&/^[A-Za-z0-9._-]{1,80}$/.test(env.ImageVersion??''),'An exact hosted runner image is required');
  assert(/^[a-f0-9]{40}$/.test(env.GITHUB_SHA??'')&&/^[1-9][0-9]*$/.test(env.GITHUB_RUN_ID??'')&&/^[1-9][0-9]*$/.test(env.GITHUB_RUN_ATTEMPT??''),'Exact workflow identity is required');
  assert(native('git',['rev-parse','HEAD'],{cwd:root}).trim()===env.GITHUB_SHA,'Browser system checkout mismatch');
  assert(native('git',['status','--porcelain','--untracked-files=no'],{cwd:root}).trim()==='','Browser system checkout has tracked mutations');
  assert(process.versions.node.split('.')[0]==='22','Unqualified browser system Node');
  assert(native('dpkg',['--audit']).trim()==='','Runner has incomplete package operations');
  const deps=lockedBrowserDependencies(root);
  return {commit:env.GITHUB_SHA,runId:env.GITHUB_RUN_ID,runAttempt:env.GITHUB_RUN_ATTEMPT,
    imageOS:env.ImageOS,imageVersion:env.ImageVersion,osSha256:sha(os),platform:'linux',arch:'x64',nodeMajor:'22',
    lockSha256:sha(await readFile(join(root,'package-lock.json'))),nativeDepsSha256:sha(await readFile(deps.dependencyPath)),
    playwrightVersion:JSON.parse(await readFile(deps.packagePath,'utf8')).version,requested:deps.packages};
}

// A partial GitHub re-run retains a successful producer's job output. Require
// that exact attempt, not the consumer's newer attempt or a guessed fallback.
export function expectedProducerContext(consumer,producerAttempt){
  const valid=value=>typeof value==='string'&&/^[1-9][0-9]*$/.test(value)&&Number.isSafeInteger(Number(value));
  assert(valid(consumer.runAttempt)&&valid(producerAttempt)&&Number(producerAttempt)<=Number(consumer.runAttempt),
    'Invalid browser system producer attempt');
  return {...consumer,runAttempt:producerAttempt};
}

export function browserSystemFormat(value='2'){
  assert(value==='2'||value==='3','Unsupported browser system profile format');return Number(value);
}
// The producer image is a trusted, immutable job output. It never replaces the
// observed consumer context, and only v3 can defer image-label equality to bytes.
export function expectedBrowserArtifact(consumer,producerAttempt,{format='2',producerImageVersion,materialSha256}={}){
  const version=browserSystemFormat(format),context=expectedProducerContext(consumer,producerAttempt);
  if(version===3){
    assert(typeof producerImageVersion==='string'&&/^[A-Za-z0-9._-]{1,80}$/.test(producerImageVersion),'Invalid producer browser image version');
    assert(typeof materialSha256==='string'&&/^[a-f0-9]{64}$/.test(materialSha256),'Invalid producer browser material digest');
    return {context:{...context,imageVersion:producerImageVersion},policy:{format:version,materialSha256}};
  }
  if(producerImageVersion!==undefined&&producerImageVersion!=='')assert(producerImageVersion===consumer.imageVersion,'Legacy browser image mismatch');
  return {context,policy:{format:version}};
}

export function validateManifest(value,expected,before,policy={format:2}){
  assert([2,3,4].includes(policy.format)&&value?.version===policy.format&&JSON.stringify(value.context)===JSON.stringify(expected),'Browser system workflow/lock/image mismatch');
  assert(value.beforeInventory===before,'Browser system initial dpkg inventory mismatch');
  assert(/^[a-f0-9]{64}$/.test(value.fontInventorySha256??''),'Invalid native font inventory digest');
  const initial=parseInventory(value.beforeInventory),after=parseInventory(value.afterInventory);
  assert(Array.isArray(value.packages)&&value.packages.length<=128,'Invalid browser package list');
  const files=new Set(),cacheNames=new Set(),identities=new Set();let bytes=0;
  for(const entry of value.packages){
    assert(entry&&/^[a-f0-9]{64}$/.test(entry.sha256??'')&&entry.file===entry.sha256+'.deb'&&
      Number.isSafeInteger(entry.bytes)&&entry.bytes>0&&entry.bytes<=maxBytes,'Invalid browser package artifact');
    assert(typeof entry.cacheFileName==='string'&&Buffer.byteLength(entry.cacheFileName)<=255&&
      /^[a-z0-9][A-Za-z0-9+_.%~-]*\.deb$/.test(entry.cacheFileName)&&!cacheNames.has(entry.cacheFileName),'Invalid or duplicate APT cache filename');
    cacheNames.add(entry.cacheFileName);
    assert(/^[a-z0-9][a-z0-9+.-]*$/.test(entry.name??'')&&/^[A-Za-z0-9:~+._-]+$/.test(entry.version??'')&&
      ['amd64','all'].includes(entry.arch),'Invalid browser package identity');
    const id=entry.name+':'+entry.arch;
    assert(!files.has(entry.file)&&!identities.has(id),'Duplicate browser package');files.add(entry.file);identities.add(id);bytes+=entry.bytes;
    const installed=after.get(id);
    assert(installed?.version===entry.version&&installed.status==='ii ','Browser package does not match native APT result');
  }
  assert(bytes<=maxBytes,'Browser package snapshot exceeds 256 MiB');
  for(const [id,row]of initial)assert(after.has(id),'Browser snapshot removes a base package');
  for(const [id,row]of after)if(row.row!==initial.get(id)?.row)assert(identities.has(id)&&row.status==='ii ','Browser snapshot has an unrepresented package change');
  for(const name of expected.requested)assert([...after.values()].some(row=>row.name===name&&row.status==='ii '),'A locked browser dependency is absent');
  if(policy.format===3){
    assert(JSON.stringify(Object.keys(value).sort())===JSON.stringify(['version','context','beforeInventory','afterInventory','fontInventorySha256','packages','timings','runtimeMaterial'].sort()),'Unexpected v3 browser manifest fields');
    const profile=validateRuntimeMaterial(value.runtimeMaterial);
    assert(JSON.stringify(profile.context)===JSON.stringify(expected),'Browser material producer context mismatch');
    assert(/^[a-f0-9]{64}$/.test(policy.collectorSha256??'')&&profile.material.scriptSha256===policy.collectorSha256,'Browser material collector mismatch');
    assert(/^[a-f0-9]{64}$/.test(policy.materialSha256??'')&&profile.materialSha256===policy.materialSha256,'Browser material producer output mismatch');
    assert(profile.material.packageInventorySha256===sha(value.afterInventory),'Browser material package inventory mismatch');
    assert(profile.material.fontCatalogSha256===value.fontInventorySha256,'Browser material font inventory mismatch');
  }
  if(policy.format===4){
    assert(JSON.stringify(Object.keys(value).sort())===JSON.stringify(['version','context','beforeInventory','afterInventory','fontInventorySha256','packages','timings','nativeOracle','certificate'].sort()),'Unexpected certified browser manifest fields');
    const certificate=policy.certificate,oracle=certificate?.nativeOracle;
    assert(certificate&&oracle&&policy.certificateSha256===sha(JSON.stringify(certificate)),'Missing or changed trusted native certificate');
    assert(value.certificate&&JSON.stringify(Object.keys(value.certificate).sort())===JSON.stringify(['id','sha256'])&&
      value.certificate.id===certificate.id&&value.certificate.sha256===policy.certificateSha256,'Certified browser bundle provenance mismatch');
    assert(JSON.stringify(value.nativeOracle)===JSON.stringify(oracle),'Certified native oracle measurement or original context changed');
    validateManifest(oracle,oracle.context,oracle.beforeInventory,{format:3,collectorSha256:policy.collectorSha256,materialSha256:policy.materialSha256});
    for(const key of ['imageOS','imageVersion','osSha256','platform','arch','nodeMajor','lockSha256','nativeDepsSha256','playwrightVersion','requested'])
      assert(JSON.stringify(expected[key])===JSON.stringify(oracle.context[key]),'Certified browser runtime input mismatch');
    assert(before===oracle.beforeInventory&&value.afterInventory===oracle.afterInventory&&value.fontInventorySha256===oracle.fontInventorySha256,'Certified browser package or font target changed');
    const records=entries=>JSON.stringify([...entries].sort((a,b)=>a.file<b.file?-1:a.file>b.file?1:0).map(entry=>
      Object.fromEntries(Object.entries(entry).sort(([a],[b])=>a<b?-1:a>b?1:0))));
    assert(records(value.packages)===records(oracle.packages),'Authenticated downloads differ from qualified native archives');
  }
  return {files:[...files],bytes};
}

const inspectPackage=path=>{
  const text=native('dpkg-deb',['--field',path,'Package','Version','Architecture']);
  const rows=text.trim().split('\n');assert(rows.length===3,'Unexpected Debian package metadata');
  const fields=Object.fromEntries(rows.map(row=>{const match=/^(Package|Version|Architecture): ([^\r\n]+)$/.exec(row);assert(match,'Invalid Debian package metadata');return [match[1],match[2]];}));
  assert(Object.keys(fields).length===3,'Duplicate Debian package fields');
  return {name:fields.Package,version:fields.Version,arch:fields.Architecture};
};

export async function verifyArtifact(directory,expected,before,inspect=inspectPackage,policy={format:2}){
  assert((await lstat(directory)).isDirectory()&&!(await lstat(directory)).isSymbolicLink(),'Unsafe browser system directory');
  const manifest=JSON.parse((await regular(join(directory,'manifest.json'),3*1024*1024)).toString('utf8'));
  const {files,bytes}=validateManifest(manifest,expected,before,policy);
  assert(JSON.stringify((await readdir(directory)).sort())===JSON.stringify(['manifest.json',...files].sort()),'Unexpected browser system artifact member');
  for(const entry of manifest.packages){
    const path=join(directory,entry.file),body=await regular(path,entry.bytes);
    assert(body.length===entry.bytes&&sha(body)===entry.sha256,'Browser package digest/size mismatch');
    const actual=inspect(path);
    assert(actual.name===entry.name&&actual.version===entry.version&&actual.arch===entry.arch,'Debian package metadata mismatch');
  }
  return {manifest,directory,paths:files.map(file=>join(directory,file)),bytes};
}

export async function stageAptCache(verified,cache){
  const info=await lstat(cache);assert(info.isDirectory()&&!info.isSymbolicLink()&&(await readdir(cache)).length===0,'APT cache must be a new empty directory');
  for(const entry of verified.manifest.packages){
    const path=join(cache,entry.cacheFileName);
    await copyFile(join(verified.directory,entry.file),path,constants.COPYFILE_EXCL);
    const bytes=await regular(path,entry.bytes);assert(bytes.length===entry.bytes&&sha(bytes)===entry.sha256,'Staged APT cache digest/size mismatch');
  }
}

async function configureApt(staging){
  const mirrors=preferOfficialUbuntuArchive(await readFile('/etc/apt/apt-mirrors.txt','utf8'));
  const mirrorsPath=join(staging,'mirrors.txt');await writeFile(mirrorsPath,mirrors);
  install(['install','-m','644',mirrorsPath,'/etc/apt/apt-mirrors.txt']);
  assert(await readFile('/etc/apt/apt-mirrors.txt','utf8')===mirrors,'APT archive preference is ineffective');
  const lines=['Acquire::http::Timeout "15";','Acquire::https::Timeout "15";','Acquire::Retries "1";',
    'Acquire::http::Dl-Limit "0";','Acquire::https::Dl-Limit "0";'];
  const path=join(staging,'network.conf');await writeFile(path,lines.join('\n')+'\n');
  install(['install','-m','644',path,'/etc/apt/apt.conf.d/zz-testcenter-ci-network']);
  const actual=native('apt-config',['dump']).toLowerCase().split(/\r?\n/);
  assert(lines.every(line=>actual.includes(line.toLowerCase())),'APT network bounds are ineffective');
}

async function collectRuntimeMaterial(root,expectedContext,expectedInventory,artifactDirectory){
  const output=await mkdtemp(join(dirname(artifactDirectory),'browser-material-'));
  await runSupervisedSmoke({entry:join(root,'scripts/ci-browser-material-worker.mjs'),artifactDirectory:output,
    env:{...process.env,UI_SMOKE_HEADFUL:'true',CI_BROWSER_MATERIAL_DIR:output},phaseTimeoutMs:180000,totalTimeoutMs:180000});
  const profile=validateRuntimeMaterial(JSON.parse((await regular(join(output,'profile.json'),3*1024*1024)).toString('utf8')));
  assert(JSON.stringify(profile.context)===JSON.stringify(expectedContext),'Observed browser material context mismatch');
  assert(profile.material.packageInventorySha256===sha(expectedInventory)&&inventory()===expectedInventory,'Observed browser material package inventory mismatch');
  assert(JSON.stringify(await nativeContext(root))===JSON.stringify(expectedContext),'Browser context changed during material verification');
  return profile;
}
export function verifyRuntimeObservation(observed,consumer,manifest,policy){
  validateRuntimeMaterial(observed);
  const reference=policy.format===4?policy.certificate?.nativeOracle?.runtimeMaterial:manifest.runtimeMaterial;
  validateRuntimeMaterial(reference);
  if(policy.format===4){
    validateManifest(manifest,manifest.context,manifest.beforeInventory,policy);
    assert(JSON.stringify(manifest.context)===JSON.stringify(consumer),'Certified browser bundle context mismatch');
  }else assert(JSON.stringify(reference.context)===JSON.stringify(manifest.context),'Browser material producer context mismatch');
  assert(JSON.stringify(observed.context)===JSON.stringify(consumer),'Observed browser material context mismatch');
  assert(observed.materialSha256===policy.materialSha256&&observed.materialSha256===reference.materialSha256,'Actual browser material or Original pixels differ from producer');
  return {producerImageVersion:reference.context.imageVersion,consumerImageVersion:consumer.imageVersion,materialSha256:observed.materialSha256,
    ...(policy.format===4?{oracleRunId:reference.context.runId,bundleRunId:manifest.context.runId,certificateId:policy.certificate.id}:{})};
}


async function downloadAuthenticatedPackages(context,before,directory,report){
  await mkdir(directory);
  const staging=await mkdtemp(join(dirname(directory),'browser-system-apt-')),cache=join(staging,'archives');
  await chmod(staging,0o755); // Preserve APT's _apt download sandbox traversal.
  await mkdir(cache,{mode:0o755});await configureApt(staging);
  const options=authenticatedAptOptions;
  report('apt_update');install(['apt-get',...options,'update','--error-on=any']);
  const downloadStarted=Date.now();
  const cacheOptions=['-o','Dir::Cache::archives='+cache,'-o','APT::Keep-Downloaded-Packages=true'];
  report('apt_download',{requested:context.requested.length});
  install(['apt-get',...options,...cacheOptions,'install','-y','--no-remove','--no-install-recommends','--download-only',...context.requested]);
  const downloadMs=Date.now()-downloadStarted;
  assert(inventory()===before,'Package download unexpectedly changed dpkg inventory');
  const packages=[];
  for(const file of await readdir(cache)){
    if(['partial','lock'].includes(file))continue;
    assert(file.endsWith('.deb'),'Unexpected downloaded package member');
    const path=join(cache,file),bytes=await regular(path,maxBytes),sha256=sha(bytes),name=sha256+'.deb';
    packages.push({file:name,cacheFileName:file,sha256,bytes:bytes.length,...inspectPackage(path)});
    await writeFile(join(directory,name),bytes,{flag:'wx'});
  }
  return {packages,downloadMs,cacheOptions};
}

export async function browserSystem(mode,root,directory){
  assert(['pack','restore','prepare-certified','restore-certified'].includes(mode),'Expected pack or restore, or explicit certified preparation/restore');
  const certified=mode==='prepare-certified'||mode==='restore-certified';
  const format=certified?4:browserSystemFormat(process.env.CI_BROWSER_SYSTEM_FORMAT);
  const started=Date.now(),consumer=await nativeContext(root);
  const before=inventory();parseInventory(before);
  let artifact;
  if(certified){
    const {loadCohortCertificates,chooseCohortCertificate,readCohortBindings,certifiedBrowserSelection}=await import('./ci-browser-cohort-certificates.mjs');
    const certificate=chooseCohortCertificate(await loadCohortCertificates(root),consumer,before,await readCohortBindings(root),{requireRuntimeGraph:true});
    const policy=certifiedBrowserSelection(certificate,consumer,{certificateId:process.env.CI_BROWSER_SYSTEM_CERTIFICATE_ID,
      certificateSha256:process.env.CI_BROWSER_SYSTEM_EXPECTED_CERTIFICATE_SHA256,producerAttempt:process.env.CI_BROWSER_SYSTEM_PRODUCER_ATTEMPT});
    artifact={context:consumer,policy};
  }else artifact=mode==='restore'?expectedBrowserArtifact(consumer,process.env.CI_BROWSER_SYSTEM_PRODUCER_ATTEMPT,{
      format:String(format),producerImageVersion:process.env.CI_BROWSER_SYSTEM_EXPECTED_IMAGE_VERSION,materialSha256:process.env.CI_BROWSER_SYSTEM_EXPECTED_MATERIAL_SHA256})
      :{context:consumer,policy:{format}};
  const {context,policy}=artifact;
  if(format===3)policy.collectorSha256=sha(await readFile(join(root,'scripts/ci-browser-material-profile.mjs')));
  const report=(phase,values={})=>console.log(JSON.stringify({ciBrowserSystem:{mode,phase,elapsedMs:Date.now()-started,...values}}));
  report('base_verified',{inventorySha256:sha(before),imageVersion:consumer.imageVersion,producerImageVersion:context.imageVersion,format});
  if(mode==='prepare-certified'){
    const {packages,downloadMs}=await downloadAuthenticatedPackages(context,before,directory,report);
    const oracle=policy.certificate.nativeOracle;
    const manifest={version:4,context,beforeInventory:before,afterInventory:oracle.afterInventory,
      fontInventorySha256:oracle.fontInventorySha256,packages,timings:{downloadMs},nativeOracle:oracle,
      certificate:{id:policy.certificate.id,sha256:policy.certificateSha256}};
    // Only authenticated downloads have occurred. The fresh initial package
    // state must survive until the real network-isolated offline installer.
    assert(inventory()===before,'Certified package preparation changed the initial inventory');
    validateManifest(manifest,context,before,policy);
    await writeFile(join(directory,'manifest.json'),JSON.stringify(manifest)+'\n',{flag:'wx'});
    const verified=await verifyArtifact(directory,context,before,undefined,policy);
    report('certified_prepared',{certificateId:policy.certificate.id,oracleRunId:oracle.context.runId,
      packages:packages.length,bytes:verified.bytes,downloadMs});
  }else if(mode==='pack'){
    const {packages,downloadMs,cacheOptions}=await downloadAuthenticatedPackages(context,before,directory,report);
    const options=authenticatedAptOptions;
    // This is the ordinary native APT oracle, using the authenticated cache.
    // A fresh consumer must reproduce its exact dpkg state offline.
    const installStarted=Date.now();
    report('native_apt_oracle',{downloadMs,packages:packages.length});
    install(['apt-get',...options,...cacheOptions,'install','-y','--no-remove','--no-install-recommends','--no-download',...context.requested]);
    assert(native('dpkg',['--audit']).trim()==='','Native APT left incomplete package operations');
    const manifest={version:format,context,beforeInventory:before,afterInventory:inventory(),fontInventorySha256:fontDigest(),packages,
      timings:{downloadMs,aptInstallMs:Date.now()-installStarted}};
    if(format===3){
      const captureStarted=Date.now();manifest.runtimeMaterial=await collectRuntimeMaterial(root,context,manifest.afterInventory,directory);
      manifest.timings.materialCaptureMs=Date.now()-captureStarted;policy.materialSha256=manifest.runtimeMaterial.materialSha256;
    }
    validateManifest(manifest,context,before,policy);
    await writeFile(join(directory,'manifest.json'),JSON.stringify(manifest)+'\n',{flag:'wx'});
    const verified=await verifyArtifact(directory,context,before,undefined,policy);
    if(format===3&&process.env.GITHUB_OUTPUT)await appendFile(process.env.GITHUB_OUTPUT,'profile-format=3\nmaterial-sha256='+policy.materialSha256+'\nbefore-inventory-sha256='+sha(before)+'\n');
    console.log(JSON.stringify({ciBrowserSystem:{mode,elapsedMs:Date.now()-started,packages:packages.length,bytes:verified.bytes,...manifest.timings}}));
  }else if(mode==='restore'||mode==='restore-certified'){
    const verified=await verifyArtifact(directory,context,before,undefined,policy);
    const installStarted=Date.now();
    report('offline_install',{packages:verified.paths.length,bytes:verified.bytes,
      producerRunAttempt:context.runAttempt,consumerRunAttempt:consumer.runAttempt});
    // APT requires its original cache basenames even for explicit local files
    // under --no-download. Preserve the producer's actual names, not a second
    // implementation of APT's epoch/version escaping rules.
    const cache=await mkdtemp(join(dirname(directory),'browser-system-offline-'));await chmod(cache,0o755);
    await stageAptCache(verified,cache);
    const sources=join(cache,'sources'),lists=join(cache,'lists');await mkdir(sources);await mkdir(lists);
    install(['unshare','--net','--',...(verified.paths.length
      ? ['/usr/bin/apt-get',...authenticatedAptOptions,'-o','Dir::Cache::archives='+cache,
        '-o','Dir::Etc::sourcelist=/dev/null','-o','Dir::Etc::sourceparts='+sources,'-o','Dir::State::lists='+lists,
        '-o','Dir::Cache::pkgcache=','-o','Dir::Cache::srcpkgcache=',
        '-o','Dpkg::Options::=--force-confdef','-o','Dpkg::Options::=--force-confold',
        'install','-y','--no-remove','--no-install-recommends','--no-download',...verified.paths]
      : ['/usr/bin/dpkg','--audit'])]);
    assert(native('dpkg',['--audit']).trim()===''&&inventory()===verified.manifest.afterInventory,'Offline dpkg result differs from native APT');
    assert(fontDigest()===verified.manifest.fontInventorySha256,'Offline native font inventory differs from native APT');
    const offlineInstallMs=Date.now()-installStarted;let materialCaptureMs=0;
    if(format===3||format===4){
      const captureStarted=Date.now();
      const observed=await collectRuntimeMaterial(root,consumer,verified.manifest.afterInventory,directory);
      report('material_verified',verifyRuntimeObservation(observed,consumer,verified.manifest,policy));
      materialCaptureMs=Date.now()-captureStarted;
    }
    console.log(JSON.stringify({ciBrowserSystem:{mode,elapsedMs:Date.now()-started,offlineInstallMs,materialCaptureMs,
      packages:verified.paths.length,bytes:verified.bytes,inventorySha256:sha(inventory())}}));
  }else throw Error('Expected pack or restore');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  // Finish evaluating this reusable module before loading a certificate module
  // that imports its validators. Top-level await here creates a module cycle.
  void (async()=>{
    try{await browserSystem(process.argv[2],process.cwd(),resolve(process.env.CI_BROWSER_SYSTEM_DIR));}
    catch(error){console.error(error.message);process.exitCode=error.exitCode??1;}
  })();
}
