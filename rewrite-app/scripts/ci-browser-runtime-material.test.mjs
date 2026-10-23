import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
import {readFile,mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {canonicalMaterial,validateRuntimeMaterial} from './ci-browser-material-contract.mjs';
import {browserSystemFormat,expectedBrowserArtifact,validateManifest,verifyArtifact,verifyRuntimeObservation} from './ci-browser-system.mjs';
const hash=body=>createHash('sha256').update(body).digest('hex');
const root=new URL('./fixtures/browser-material-cohorts-20261023/',import.meta.url);
const originalProfile=JSON.parse(await readFile(new URL('older-profile.json',root)));
const originalNative=JSON.parse(await readFile(new URL('older-native-manifest.json',root)));
const seal=profile=>{profile.materialSha256=hash(canonicalMaterial(profile.material));return profile;};
const fixture=()=>{
 const profile=structuredClone(originalProfile);profile.qualification='runtime-measurement';
 const row=originalNative.afterInventory.split('\n').find(row=>row.startsWith('fonts-freefont-ttf\t'));
 const [name,version,arch]=row.split('\t'),bytes=Buffer.from('Owned synthetic archive bytes, never installed'),sha256=hash(bytes);
 const entry={name,version,arch,bytes:bytes.length,sha256,file:sha256+'.deb',cacheFileName:'owned-font.deb'};
 const before=originalNative.afterInventory.split('\n').filter(line=>line!==row).join('\n');
 const manifest={version:3,context:structuredClone(profile.context),beforeInventory:before,afterInventory:originalNative.afterInventory,
  fontInventorySha256:originalNative.fontInventorySha256,packages:[entry],timings:{downloadMs:1,aptInstallMs:1},runtimeMaterial:profile};
 const policy={format:3,collectorSha256:profile.material.scriptSha256,materialSha256:profile.materialSha256};
 return{profile,manifest,policy,before,bytes,entry};
};
test('explicit v3 producer outputs preserve both actual consumer identity and immutable earlier producer attempt',()=>{
 const f=fixture(),consumer={...f.profile.context,imageVersion:'20261023.334.3',runAttempt:'4'},before=structuredClone(consumer);
 const actual=expectedBrowserArtifact(consumer,'1',{format:'3',producerImageVersion:f.profile.context.imageVersion,materialSha256:f.profile.materialSha256});
 assert.deepEqual(actual.context,f.profile.context);assert.deepEqual(consumer,before);
 assert.equal(actual.policy.format,3);assert.equal(actual.policy.materialSha256,f.profile.materialSha256);
 assert.deepEqual(validateManifest(f.manifest,actual.context,f.before,{...actual.policy,collectorSha256:f.policy.collectorSha256}),{files:[f.entry.file],bytes:f.bytes.length});
});
test('legacy selection keeps strict exact-image binding and cannot silently consume a v3 artifact',()=>{
 const f=fixture(),consumer={...f.profile.context,imageVersion:'20261023.334.3'};
 assert.throws(()=>expectedBrowserArtifact(consumer,'1',{producerImageVersion:f.profile.context.imageVersion}),/Legacy browser image mismatch/);
 const legacy=expectedBrowserArtifact(consumer,'1');assert.equal(legacy.context.imageVersion,consumer.imageVersion);assert.equal(legacy.policy.format,2);
 assert.throws(()=>validateManifest(f.manifest,legacy.context,f.before,legacy.policy),/workflow\/lock\/image mismatch/);
 assert.throws(()=>validateManifest(f.manifest,f.profile.context,f.before),/workflow\/lock\/image mismatch/);
});
test('missing or malformed profile format, producer image or digest never falls back to permissive admission',()=>{
 const f=fixture();
 for(const format of [0,2,3,'','1','03','3\n','4','3;echo owned'])assert.throws(()=>browserSystemFormat(format));
 for(const producerImageVersion of [undefined,null,'','x\n','old;echo owned'])assert.throws(()=>expectedBrowserArtifact(f.profile.context,'1',{format:'3',producerImageVersion,materialSha256:f.profile.materialSha256}));
 for(const materialSha256 of [undefined,null,'','0'.repeat(63),'a'.repeat(64)+'\n','x;echo owned'])assert.throws(()=>expectedBrowserArtifact(f.profile.context,'1',{format:'3',producerImageVersion:f.profile.context.imageVersion,materialSha256}));
 assert.throws(()=>expectedBrowserArtifact({...f.profile.context,runAttempt:'1'},'2',{format:'3',producerImageVersion:f.profile.context.imageVersion,materialSha256:f.profile.materialSha256}),/producer attempt/);
});
test('v3 package verification binds the complete producer context, profile, collector and immutable output before native inspection',()=>{
 const f=fixture();
 for(const field of Object.keys(f.profile.context)){
  const changed=structuredClone(f.manifest);changed.context[field]=field==='requested'?['different']:String(changed.context[field])+'changed';
  assert.throws(()=>validateManifest(changed,f.profile.context,f.before,f.policy),/workflow\/lock\/image mismatch/);
  const profileOnly=structuredClone(f.manifest);profileOnly.runtimeMaterial.context[field]=changed.context[field];
  assert.throws(()=>validateManifest(profileOnly,f.profile.context,f.before,f.policy));
 }
 for(const change of [p=>p.runtimeMaterial.qualification='diagnostic-only',p=>p.runtimeMaterial=null,p=>p.extra='unexpected',p=>p.version=2]){
  const changed=structuredClone(f.manifest);change(changed);assert.throws(()=>validateManifest(changed,f.profile.context,f.before,f.policy));
 }
 for(const change of [{materialSha256:'f'.repeat(64)},{materialSha256:undefined},{collectorSha256:'e'.repeat(64)},{collectorSha256:undefined}])assert.throws(()=>validateManifest(f.manifest,f.profile.context,f.before,{...f.policy,...change}));
});
test('re-signed profile claims cannot detach the material from native APT package or font inventory',()=>{
 for(const field of ['packageInventorySha256','fontCatalogSha256']){
  const f=fixture();f.manifest.runtimeMaterial.material[field]='a'.repeat(64);seal(f.manifest.runtimeMaterial);f.policy.materialSha256=f.manifest.runtimeMaterial.materialSha256;
  assert.throws(()=>validateManifest(f.manifest,f.profile.context,f.before,f.policy),/material (package|font) inventory mismatch/);
 }
});
test('a complete runtime schema cannot substitute malformed, incomplete, duplicate or flat Source measurements',()=>{
 const changes=[p=>p.qualification='diagnostic-only',p=>p.material.extra=true,p=>p.extra=true,p=>delete p.material.scriptSha256,
  p=>p.material.files.push({...p.material.files[0]}),p=>p.material.files.reverse(),p=>p.material.files[0].mode=0o10000,
  p=>p.material.files=p.material.files.filter(row=>row.name!=='native:/usr/bin/Xvfb'),
  p=>p.material.files=p.material.files.filter(row=>!/^native:.*\.(ttf|otf|ttc)$/i.test(row.name)),
  p=>p.material.views[0].width=900,p=>p.material.views[2].height=900,p=>p.material.views[1].pixelSha256=p.material.views[0].pixelSha256,
  p=>p.context.requested.push(p.context.requested[0]),p=>p.context.imageVersion='bad\n',p=>p.material.nodeVersion='v24.0.0'];
 for(const change of changes){const p=structuredClone(fixture().profile);change(p);seal(p);assert.throws(()=>validateRuntimeMaterial(p));}
});
test('same material across actual different labels qualifies only after preserving the actual consumer context',()=>{
 const f=fixture(),consumer={...f.profile.context,imageVersion:'20261023.334.3',runAttempt:'3'},observed={...structuredClone(f.profile),context:structuredClone(consumer)};
 const result=verifyRuntimeObservation(observed,consumer,f.manifest,f.policy);
 assert.equal(result.producerImageVersion,'20261012.334.1');assert.equal(result.consumerImageVersion,'20261023.334.3');
 assert.equal(result.materialSha256,f.profile.materialSha256);
 assert.throws(()=>verifyRuntimeObservation(f.profile,consumer,f.manifest,f.policy),/Observed browser material context mismatch/);
});
test('actual font, browser, Node, library, screen or Original pixel drift fails despite matching labels and package versions',()=>{
 const changes=[p=>p.material.files[0].sha256='a'.repeat(64),p=>p.material.files.find(row=>/\.ttf$/i.test(row.name)).sha256='b'.repeat(64),
  p=>p.material.files.find(row=>/\.so(?:\.|$)/.test(row.name)).sha256='c'.repeat(64),p=>p.material.nodeVersion='v22.23.4',
  p=>p.material.browserVersion='147.0.7727.16',p=>p.material.screen.colorDepth=32,p=>p.material.views[0].pixelSha256='d'.repeat(64)];
 for(const change of changes){const f=fixture(),p=structuredClone(f.profile);change(p);seal(p);assert.throws(()=>verifyRuntimeObservation(p,f.profile.context,f.manifest,f.policy),/Actual browser material or Original pixels differ/);}
});
test('v3 archive validation rejects profile or package corruption before any Debian inspector is called',async()=>{
 const f=fixture(),directory=await mkdtemp(join(tmpdir(),'owned-runtime-artifact-'));
 try{
  const save=()=>writeFile(join(directory,'manifest.json'),JSON.stringify(f.manifest));
  await save();await writeFile(join(directory,f.entry.file),f.bytes);
  await verifyArtifact(directory,f.profile.context,f.before,()=>f.entry,f.policy);
  f.manifest.runtimeMaterial.qualification='diagnostic-only';await save();
  await assert.rejects(verifyArtifact(directory,f.profile.context,f.before,()=>assert.fail('No native inspection on invalid material.'),f.policy));
  f.manifest.runtimeMaterial.qualification='runtime-measurement';await save();await writeFile(join(directory,f.entry.file),Buffer.alloc(f.bytes.length));
  await assert.rejects(verifyArtifact(directory,f.profile.context,f.before,()=>assert.fail('No native inspection on invalid bytes.'),f.policy),/digest\/size mismatch/);
 }finally{await rm(directory,{recursive:true,force:true});}
});

test('the actual early v3 command validates raw immutable metadata without granting material admission or evaluating it',()=>{
 const env={...process.env,ImageOS:'ubuntu24',ImageVersion:'20261023.334.3',CI_BROWSER_SYSTEM_EXPECTED_IMAGE_VERSION:'20261012.334.1',CI_BROWSER_SYSTEM_FORMAT:'3',CI_BROWSER_SYSTEM_EXPECTED_MATERIAL_SHA256:'a'.repeat(64)};
 const run=change=>spawnSync('bash',[resolve('scripts/ci-browser-cohort.sh'),'check'],{encoding:'utf8',env:{...env,...change}});
 const accepted=run({});assert.equal(accepted.status,0);assert.match(accepted.stdout,/actual material verification remains mandatory/);
 for(const change of [{CI_BROWSER_SYSTEM_EXPECTED_MATERIAL_SHA256:''},{CI_BROWSER_SYSTEM_EXPECTED_MATERIAL_SHA256:'x;echo OWNED_SHELL_MARKER'},
  {CI_BROWSER_SYSTEM_FORMAT:''},{CI_BROWSER_SYSTEM_FORMAT:'3;echo OWNED_SHELL_MARKER'},{CI_BROWSER_SYSTEM_EXPECTED_IMAGE_VERSION:'bad;echo OWNED_SHELL_MARKER'}]){
  const result=run(change);assert.notEqual(result.status,0);assert.equal(result.stdout.includes('OWNED_SHELL_MARKER'),false);assert.equal(result.stderr.includes('OWNED_SHELL_MARKER'),false);
 }
 assert.notEqual(run({CI_BROWSER_SYSTEM_FORMAT:'2'}).status,0,'Legacy images still require exact equality.');
 assert.notEqual(run({ImageVersion:'20261012.334.1',CI_BROWSER_SYSTEM_EXPECTED_MATERIAL_SHA256:''}).status,0,'Matching labels cannot replace the v3 digest.');
});

test('actual offline cross-image and partial-rerun evidence binds raw producer packages, observed contexts and exact Source pixels',async()=>{
 const root=new URL('./fixtures/browser-runtime-v3-20261024/',import.meta.url);
 const read=name=>readFile(new URL(name,root));
 const receipt=JSON.parse(await read('receipt.json'));
 assert.equal(receipt.runId,40034252270);assert.equal(receipt.probe.codeTree,'183d3f87507045580731c19124a8355f8684aaca');
 assert.equal(receipt.fullOriginalParity,false);assert.equal(receipt.jobs.length,9);
 assert.ok(receipt.jobs.every(j=>j.status==='completed'&&j.conclusion==='success'));
 for(const [name,digest]of Object.entries(receipt.files)){assert.match(name,/^[a-z0-9.-]+$/);assert.equal(hash(await read(name)),digest,name);}
 const manifest=JSON.parse(await read('producer-manifest.json'));
 const policy={format:3,collectorSha256:manifest.runtimeMaterial.material.scriptSha256,materialSha256:receipt.materialSha256};
 const result=validateManifest(manifest,manifest.context,manifest.beforeInventory,policy);
 assert.equal(result.files.length,17);assert.equal(result.bytes,25937806);
 assert.equal(receipt.packageArtifact.id,12535783284);assert.equal(receipt.partialRerun.reusedArtifact,receipt.packageArtifact.id);
 const opposite=JSON.parse(await read('opposite-consumer-profile.json')),rerun=JSON.parse(await read('rerun-consumer-profile.json'));
 for(const [profile,identity]of [[manifest.runtimeMaterial,'producer'],[opposite,'4-attempt-1'],[rerun,'4-attempt-2']]){
  const observation=receipt.observations.find(row=>row.identity===identity);
  assert.deepEqual(profile.context,observation.context);
  verifyRuntimeObservation(profile,observation.context,manifest,policy);
 }
 assert.equal(manifest.context.imageVersion,'20261012.334.1');assert.equal(opposite.context.imageVersion,'20261023.334.3');
 assert.equal(manifest.context.runAttempt,'1');assert.equal(rerun.context.runAttempt,'2');
 assert.equal(receipt.partialRerun.producerAttempt,1);assert.equal(receipt.partialRerun.consumerAttempt,2);assert.equal(receipt.partialRerun.conclusion,'success');
 assert.equal(receipt.observations.length,10);assert.equal(receipt.observations.filter(o=>o.context.imageVersion==='20261023.334.3').length,2);
 assert.equal(receipt.pngFilesCompared,80);assert.equal(receipt.independentDebianControlMetadataVerified,true);
 for(const view of receipt.views){
  assert.equal(view.observedMatchingFiles,20);assert.equal(view.independentlyDecoded,true);
  assert.equal(hash(await read('../browser-material-cohorts-20261023/'+view.name+'.png')),view.pngSha256);
  assert.deepEqual(manifest.runtimeMaterial.material.views.find(v=>v.name===view.name),{name:view.name,width:view.width,height:view.height,pixelSha256:view.pixelSha256});
 }
});
