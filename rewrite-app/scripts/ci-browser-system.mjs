import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {createRequire} from 'node:module';
import {constants} from 'node:fs';
import {chmod,copyFile,lstat,mkdir,mkdtemp,readFile,readdir,writeFile} from 'node:fs/promises';
import {dirname,join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {preferOfficialUbuntuArchive} from './ci-apt-mirrors.mjs';

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
  assert(process.versions.node.split('.')[0]==='22','Unqualified browser system Node');
  assert(native('dpkg',['--audit']).trim()==='','Runner has incomplete package operations');
  const deps=lockedBrowserDependencies(root);
  return {commit:env.GITHUB_SHA,runId:env.GITHUB_RUN_ID,runAttempt:env.GITHUB_RUN_ATTEMPT,
    imageOS:env.ImageOS,imageVersion:env.ImageVersion,osSha256:sha(os),platform:'linux',arch:'x64',nodeMajor:'22',
    lockSha256:sha(await readFile(join(root,'package-lock.json'))),nativeDepsSha256:sha(await readFile(deps.dependencyPath)),
    playwrightVersion:JSON.parse(await readFile(deps.packagePath,'utf8')).version,requested:deps.packages};
}

export function validateManifest(value,expected,before){
  assert(value?.version===2&&JSON.stringify(value.context)===JSON.stringify(expected),'Browser system workflow/lock/image mismatch');
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
  return {files:[...files],bytes};
}

const inspectPackage=path=>{
  const text=native('dpkg-deb',['--field',path,'Package','Version','Architecture']);
  const rows=text.trim().split('\n');assert(rows.length===3,'Unexpected Debian package metadata');
  const fields=Object.fromEntries(rows.map(row=>{const match=/^(Package|Version|Architecture): ([^\r\n]+)$/.exec(row);assert(match,'Invalid Debian package metadata');return [match[1],match[2]];}));
  assert(Object.keys(fields).length===3,'Duplicate Debian package fields');
  return {name:fields.Package,version:fields.Version,arch:fields.Architecture};
};

export async function verifyArtifact(directory,expected,before,inspect=inspectPackage){
  assert((await lstat(directory)).isDirectory()&&!(await lstat(directory)).isSymbolicLink(),'Unsafe browser system directory');
  const manifest=JSON.parse((await regular(join(directory,'manifest.json'),3*1024*1024)).toString('utf8'));
  const {files,bytes}=validateManifest(manifest,expected,before);
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

export async function browserSystem(mode,root,directory){
  assert(['pack','restore'].includes(mode),'Expected pack or restore');
  const started=Date.now(),context=await nativeContext(root),before=inventory();parseInventory(before);
  const report=(phase,values={})=>console.log(JSON.stringify({ciBrowserSystem:{mode,phase,elapsedMs:Date.now()-started,...values}}));
  report('base_verified',{inventorySha256:sha(before),imageVersion:context.imageVersion});
  if(mode==='pack'){
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
    // This is the ordinary native APT oracle, using the authenticated cache.
    // A fresh consumer must reproduce its exact dpkg state offline.
    const installStarted=Date.now();
    report('native_apt_oracle',{downloadMs,packages:packages.length});
    install(['apt-get',...options,...cacheOptions,'install','-y','--no-remove','--no-install-recommends','--no-download',...context.requested]);
    assert(native('dpkg',['--audit']).trim()==='','Native APT left incomplete package operations');
    const manifest={version:2,context,beforeInventory:before,afterInventory:inventory(),fontInventorySha256:fontDigest(),packages,
      timings:{downloadMs,aptInstallMs:Date.now()-installStarted}};
    validateManifest(manifest,context,before);
    await writeFile(join(directory,'manifest.json'),JSON.stringify(manifest)+'\n',{flag:'wx'});
    const verified=await verifyArtifact(directory,context,before);
    console.log(JSON.stringify({ciBrowserSystem:{mode,elapsedMs:Date.now()-started,packages:packages.length,bytes:verified.bytes,...manifest.timings}}));
  }else if(mode==='restore'){
    const verified=await verifyArtifact(directory,context,before);
    const installStarted=Date.now();
    report('offline_install',{packages:verified.paths.length,bytes:verified.bytes});
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
    console.log(JSON.stringify({ciBrowserSystem:{mode,elapsedMs:Date.now()-started,offlineInstallMs:Date.now()-installStarted,
      packages:verified.paths.length,bytes:verified.bytes,inventorySha256:sha(inventory())}}));
  }else throw Error('Expected pack or restore');
}
if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{await browserSystem(process.argv[2],process.cwd(),resolve(process.env.CI_BROWSER_SYSTEM_DIR));}
  catch(error){console.error(error.message);process.exitCode=error.exitCode??1;}
}
