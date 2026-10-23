import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {mkdtemp,readFile,rm,writeFile,symlink,mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import test from 'node:test';
import {commandFailure,lockedBrowserDependencies,nativeContext,parseInventory,stageAptCache,validateManifest,verifyArtifact} from './ci-browser-system.mjs';

const hash=body=>createHash('sha256').update(body).digest('hex');
test('package-manager status remains fatal without exposing raw configuration or credential-bearing errors',()=>{
  for(const status of [37,51,100,null]){
    const cause=Object.assign(Error('http://owned:OWNED_PROXY_SECRET@proxy'),{status,stdout:'OWNED_STDOUT_SECRET',stderr:'OWNED_STDERR_SECRET'});
    const result=commandFailure('apt-config',cause);
    assert.equal(result.exitCode,status??1);assert.equal(result.cause,undefined);
    for(const secret of ['OWNED_PROXY_SECRET','OWNED_STDOUT_SECRET','OWNED_STDERR_SECRET'])assert.ok(!JSON.stringify({message:result.message,...result}).includes(secret));
  }
});
const rows=(...rows)=>rows.sort().join('\n')+'\n';
const fixture=()=>{
  const bytes=Buffer.from('Owned package byte fixture Ω'),sha256=hash(bytes);
  const context={commit:'a'.repeat(40),runId:'123',runAttempt:'1',imageOS:'ubuntu24',imageVersion:'20261019.1.0',
    lockSha256:'b'.repeat(64),nativeDepsSha256:'c'.repeat(64),nodeMajor:'22',platform:'linux',arch:'x64',requested:['libbase','owned-font']};
  const before=rows('libbase\t1.0\tamd64\tii ');
  const entry={file:sha256+'.deb',cacheFileName:'owned-font_2%3a1.9+dfsg-1_all.deb',bytes:bytes.length,sha256,name:'owned-font',version:'2:1.9+dfsg-1',arch:'all'};
  return {bytes,context,before,entry,manifest:{version:2,context:structuredClone(context),beforeInventory:before,fontInventorySha256:'d'.repeat(64),
    afterInventory:rows('libbase\t1.0\tamd64\tii ','owned-font\t2:1.9+dfsg-1\tall\tii '),packages:[entry]}};
};
test('the browser dependency list comes from this lockfile installation and contains no command arguments',()=>{
  const value=lockedBrowserDependencies(process.cwd());
  assert.equal(value.packages.length,33);
  for(const name of ['xvfb','fonts-noto-color-emoji','libnss3','libasound2t64'])assert.ok(value.packages.includes(name));
  assert.equal(value.packages.includes('libasound2'),false);
  assert.ok(value.dependencyPath.startsWith(resolve('node_modules/playwright-core')+'/'));
});
test('a package snapshot is bound to the exact run, attempt, checkout, lock, Node, architecture and runner image',()=>{
  const f=fixture();assert.deepEqual(validateManifest(f.manifest,f.context,f.before),{files:[f.entry.file],bytes:f.bytes.length});
  for(const field of Object.keys(f.context)){
    const manifest=structuredClone(f.manifest);manifest.context[field]=field==='requested'?['other']:String(manifest.context[field])+'changed';
    assert.throws(()=>validateManifest(manifest,f.context,f.before),/workflow\/lock\/image mismatch/);
  }
});
test('empty snapshots are valid only when every requested package was already installed and no dpkg row changes',()=>{
  const f=fixture();f.manifest.packages=[];f.context.requested=['libbase'];f.manifest.context=structuredClone(f.context);
  f.manifest.afterInventory=f.before;
  assert.equal(validateManifest(f.manifest,f.context,f.before).bytes,0);
  f.manifest.afterInventory=rows('libbase\t1.1\tamd64\tii ');
  assert.throws(()=>validateManifest(f.manifest,f.context,f.before),/unrepresented/);
});
test('an already installed package upgrade must have its exact matching authenticated artifact',()=>{
  const f=fixture();f.manifest.afterInventory=rows('libbase\t1.1\tamd64\tii ','owned-font\t2:1.9+dfsg-1\tall\tii ');
  assert.throws(()=>validateManifest(f.manifest,f.context,f.before),/unrepresented/);
  f.manifest.packages.push({...f.entry,name:'libbase',version:'1.1',arch:'amd64',cacheFileName:'libbase_1.1_amd64.deb',file:'d'.repeat(64)+'.deb',sha256:'d'.repeat(64)});
  assert.equal(validateManifest(f.manifest,f.context,f.before).files.length,2);
});
const invalid=[
  ['version',f=>{f.manifest.version=1;}],
  ['font inventory',f=>{f.manifest.fontInventorySha256='invalid';}],
  ['stale base',f=>{f.before=rows('libbase\t1.1\tamd64\tii ');}],
  ['package path',f=>{f.manifest.packages[0].file='../owned.deb';}],
  ['absolute package path',f=>{f.manifest.packages[0].file='/owned.deb';}],
  ['APT cache traversal',f=>{f.manifest.packages[0].cacheFileName='../owned.deb';}],
  ['APT cache absolute path',f=>{f.manifest.packages[0].cacheFileName='/owned.deb';}],
  ['APT cache duplicate',f=>{f.manifest.packages.push({...f.entry,name:'another',file:'e'.repeat(64)+'.deb',sha256:'e'.repeat(64)});}],
  ['bad digest',f=>{f.manifest.packages[0].sha256='x'.repeat(64);}],
  ['duplicate filename',f=>{f.manifest.packages.push({...f.entry,name:'different'});}],
  ['duplicate identity',f=>{f.manifest.packages.push({...f.entry,file:'d'.repeat(64)+'.deb',sha256:'d'.repeat(64)});}],
  ['wrong architecture',f=>{f.manifest.packages[0].arch='arm64';}],
  ['wrong version',f=>{f.manifest.packages[0].version='new';}],
  ['option as package name',f=>{f.manifest.packages[0].name='--force-all';}],
  ['zero bytes',f=>{f.manifest.packages[0].bytes=0;}],
  ['fractional bytes',f=>{f.manifest.packages[0].bytes=1.2;}],
  ['oversized package',f=>{f.manifest.packages[0].bytes=256*1024*1024+1;}],
  ['removed base package',f=>{f.manifest.afterInventory=rows('owned-font\t2:1.9+dfsg-1\tall\tii ');}],
  ['unconfigured package',f=>{f.manifest.afterInventory=rows('libbase\t1.0\tamd64\tii ','owned-font\t2:1.9+dfsg-1\tall\tiU ');}],
  ['missing requested package',f=>{f.context.requested.push('absent');f.manifest.context=structuredClone(f.context);}],
  ['unrepresented change',f=>{f.manifest.afterInventory=rows('libbase\t1.0\tamd64\tii ','owned-font\t2:1.9+dfsg-1\tall\tii ','other\t1.0\tamd64\tii ');}],
  ['duplicate inventory row',f=>{f.manifest.afterInventory+=f.manifest.afterInventory.split('\n')[0]+'\n';}],
  ['control character in inventory',f=>{f.manifest.afterInventory=f.manifest.afterInventory.replace('libbase','libbase\r');}]
];
for(const [label,mutate]of invalid)test('a malformed/stale package snapshot fails before installation: '+label,()=>{
  const f=fixture();mutate(f);assert.throws(()=>validateManifest(f.manifest,f.context,f.before));
});
test('inventory canonicalization rejects duplicate, reordered, unterminated and empty rows',()=>{
  for(const value of ['', 'owned\t1\tall\tii ',rows('owned\t1\tall\tii ')+'\n',
    'z\t1\tall\tii \na\t1\tall\tii \n',rows('a\t1\tall\tii ','a\t1\tall\tii ')])assert.throws(()=>parseInventory(value));
});
const withArtifact=async action=>{
  const directory=await mkdtemp(join(tmpdir(),'owned-browser-system-')),f=fixture();
  await writeFile(join(directory,'manifest.json'),JSON.stringify(f.manifest));await writeFile(join(directory,f.entry.file),f.bytes);
  try{await action(f,directory);}finally{await rm(directory,{recursive:true,force:true});}
};
test('every exact package byte and Debian identity is verified before returning any install paths',async()=>{
  await withArtifact(async(f,directory)=>{
    const inspected=[];
    const result=await verifyArtifact(directory,f.context,f.before,path=>{inspected.push(path);return f.entry;});
    assert.deepEqual(result.paths,[join(directory,f.entry.file)]);assert.deepEqual(inspected,result.paths);
    assert.equal(result.bytes,f.bytes.length);
    await assert.rejects(verifyArtifact(directory,f.context,f.before,()=>({...f.entry,name:'foreign'})),/metadata mismatch/);
    await writeFile(join(directory,f.entry.file),Buffer.alloc(f.bytes.length));
    await assert.rejects(verifyArtifact(directory,f.context,f.before,()=>assert.fail('Corrupt bytes must fail before metadata inspection.')),/digest\/size mismatch/);
  });
});
test('the private APT cache uses the actual producer filename and retains verified bytes without another download',async()=>{
  await withArtifact(async(f,directory)=>{
    const verified=await verifyArtifact(directory,f.context,f.before,()=>f.entry),cache=join(directory,'owned-cache');await mkdir(cache);
    await stageAptCache(verified,cache);
    assert.deepEqual(await readFile(join(cache,'owned-font_2%3a1.9+dfsg-1_all.deb')),f.bytes);
    await assert.rejects(stageAptCache(verified,cache),/new empty directory/);
    assert.deepEqual(await readFile(join(cache,f.entry.cacheFileName)),f.bytes);
  });
});
test('cache staging detects changed source bytes and never follows a linked cache directory',async()=>{
  await withArtifact(async(f,directory)=>{
    const verified=await verifyArtifact(directory,f.context,f.before,()=>f.entry),cache=join(directory,'owned-cache'),link=join(directory,'linked-cache');await mkdir(cache);
    await symlink(cache,link);await assert.rejects(stageAptCache(verified,link),/new empty directory/);
    await writeFile(join(directory,f.entry.file),Buffer.alloc(f.bytes.length));
    await assert.rejects(stageAptCache(verified,cache),/Staged APT cache digest\/size mismatch/);
  });
});
for(const target of ['package','manifest','directory'])test('symlinks are rejected before package inspection: '+target,async()=>{
  await withArtifact(async(f,directory)=>{
    const other=await mkdtemp(join(tmpdir(),'owned-browser-system-target-'));
    try{
      let path=directory;
      if(target==='directory'){path=join(other,'link');await symlink(directory,path);}
      else{const file=target==='package'?f.entry.file:'manifest.json',bytes=target==='package'?f.bytes:Buffer.from(JSON.stringify(f.manifest));
        await writeFile(join(other,'data'),bytes);await rm(join(directory,file));await symlink(join(other,'data'),join(directory,file));}
      await assert.rejects(verifyArtifact(path,f.context,f.before,()=>assert.fail('A link must not reach Debian metadata inspection.')),/Unsafe browser system/);
    }finally{await rm(other,{recursive:true,force:true});}
  });
});
test('unexpected artifact files, subdirectories and oversized manifests are rejected',async()=>{
  for(const kind of ['file','directory','manifest'])await withArtifact(async(f,directory)=>{
    if(kind==='directory')await mkdir(join(directory,'extra'));
    if(kind==='file')await writeFile(join(directory,'other.deb'),'owned');
    if(kind==='manifest')await writeFile(join(directory,'manifest.json'),Buffer.alloc(3*1024*1024+1));
    await assert.rejects(verifyArtifact(directory,f.context,f.before,()=>assert.fail('Unverified members must fail before inspection.')));
  });
});
test('unqualified hosts or workflow identities fail before any package-manager mutation',async()=>{
  if(process.platform==='linux')await assert.rejects(nativeContext(process.cwd(),{...process.env,GITHUB_SHA:'invalid'}),/Exact workflow identity|Unqualified browser system OS|exact hosted runner|requires native Linux x64/);
  else await assert.rejects(nativeContext(process.cwd()),/requires native Linux x64/);
});
