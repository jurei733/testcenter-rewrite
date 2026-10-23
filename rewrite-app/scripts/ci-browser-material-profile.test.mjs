import assert from 'node:assert/strict';
import test from 'node:test';
import {createHash} from 'node:crypto';
import {readFile} from 'node:fs/promises';
import {brotliDecompressSync} from 'node:zlib';
import {canonicalMaterial,compareDiagnosticProfiles,materialProfileSource,validateDiagnosticProfile} from './ci-browser-material-profile.mjs';
const hash=value=>createHash('sha256').update(value).digest('hex');
const seal=p=>({...p,materialSha256:hash(canonicalMaterial(p.material))});
const fixture=()=>seal({version:1,qualification:'diagnostic-only',context:{commit:'1'.repeat(40),runId:'41',runAttempt:'1',imageOS:'ubuntu24',imageVersion:'20261012.334.1',lockSha256:'2'.repeat(64),nodeMajor:'22',platform:'linux',arch:'x64'},
 material:{source:materialProfileSource,scriptSha256:'3'.repeat(64),nodeVersion:'v22.23.3',files:[{name:'chromium/chrome',bytes:100,sha256:'4'.repeat(64)},{name:'native:/usr/share/fonts/owned.ttf',bytes:200,sha256:'5'.repeat(64)}],
 views:['desktop-empty','desktop-input','mobile-empty','mobile-input'].map((name,i)=>({name,width:i<2?1366:390,height:i<2?900:844,pixelSha256:String(i+6).repeat(64)}))}});

test('diagnostic capture uses exact current pinned Source 6.0.5 and unchanged sample definition',async()=>{
 const root=new URL('../test-fixtures/original-testcenter/',import.meta.url);
 const player=brotliDecompressSync(Buffer.from(await readFile(new URL('players/verona-player-simple-6.0.5.html.br.base64',root),'utf8'),'base64'));
 assert.equal(hash(player),materialProfileSource.playerSha256);assert.equal(hash(await readFile(new URL('definitions/SAMPLE_UNITCONTENTS.HTM',root))),materialProfileSource.definitionSha256);
 assert.equal(JSON.parse(player.toString().match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]).version,'6.0.5');
});
test('matching diagnostic material across different observed image labels is evidence only, never production admission',()=>{
 const left=fixture(),right=structuredClone(left);right.context.imageVersion='20261023.334.3';
 const comparison=compareDiagnosticProfiles(left,right);assert.equal(comparison.materialEqual,true);assert.equal(comparison.sameImageVersion,false);
 assert.equal(comparison.productionAdmission,false);assert.equal(comparison.qualification,'diagnostic-only');
});
test('different workflow identity, lock, attempt or architecture cannot be compared as one cohort',()=>{
 for(const key of ['commit','runId','runAttempt','lockSha256','platform','arch','nodeMajor']){
  const left=fixture(),right=structuredClone(left);right.context[key]=key==='commit'?'2'.repeat(40):key==='lockSha256'?'3'.repeat(64):key==='runId'?'42':key==='runAttempt'?'2':'changed';
  assert.throws(()=>compareDiagnosticProfiles(left,right),/exact workflow, lock and platform/);
 }
});
test('changed font, browser, runtime or actual Source pixels cannot be hidden by identical package versions or image names',()=>{
 for(const change of [p=>p.material.files[0].sha256='a'.repeat(64),p=>p.material.files[1].sha256='b'.repeat(64),p=>p.material.nodeVersion='v22.23.4',p=>p.material.views[0].pixelSha256='c'.repeat(64)]){
  const left=fixture(),right=structuredClone(left);change(right);assert.equal(compareDiagnosticProfiles(left,seal(right)).materialEqual,false);
 }
});
test('malformed, duplicate, unsorted, stale-digest or edited Source profiles fail before comparison',()=>{
 for(const change of [p=>p.version=2,p=>p.qualification='production',p=>p.material.files.reverse(),p=>p.material.files.push({...p.material.files[0]}),p=>p.material.files[0].sha256='invalid',p=>p.material.source={...materialProfileSource,playerSha256:'a'.repeat(64)},p=>p.material.views.pop(),p=>p.materialSha256='0'.repeat(64)]){
  const profile=fixture();change(profile);assert.throws(()=>validateDiagnosticProfile(profile));
 }
 assert.throws(()=>canonicalMaterial({bad:undefined}));assert.throws(()=>canonicalMaterial({bad:Infinity}));
});

test('actual eight-host cross-image material and Source pixels retain exact independent evidence without granting production admission',async()=>{
 const root=new URL('./fixtures/browser-material-cohorts-20261023/',import.meta.url);
 const read=async name=>readFile(new URL(name,root));
 const manifest=JSON.parse(await read('manifest.json'));
 assert.equal(manifest.runId,40030001971);assert.equal(manifest.commit,'3d8cb50d1ab677c849404a05e5ce064ab135401b');
 assert.equal(manifest.productionAdmission,false);assert.equal(manifest.jobs.length,8);
 assert.ok(manifest.jobs.every(job=>job.status==='completed'&&job.conclusion==='success'));
 assert.deepEqual(manifest.observedImages,{'20261012.334.1':7,'20261023.334.3':1});
 for(const [name,sha]of Object.entries(manifest.files)){assert.match(name,/^[a-z0-9][a-z0-9.-]*$/);assert.equal(hash(await read(name)),sha,name);}
 const older=JSON.parse(await read('older-profile.json')),newer=JSON.parse(await read('newer-profile.json'));
 const result=compareDiagnosticProfiles(older,newer);assert.equal(result.materialEqual,true);assert.equal(result.sameImageVersion,false);assert.equal(result.productionAdmission,false);
 assert.equal(older.material.files.length,591);assert.deepEqual(older.material.files,newer.material.files);
 const receipt=JSON.parse(await read('verified-comparison.json'));
 assert.equal(receipt.materialSha256,older.materialSha256);assert.equal(receipt.pngFilesCompared,64);assert.equal(receipt.nativePackageCount,17);assert.equal(receipt.observations.length,8);
 for(const view of receipt.views){assert.equal(view.observedMatchingFiles,16);assert.equal(view.independentlyDecoded,true);assert.equal(hash(await read(view.name+'.png')),view.pngSha256);assert.equal(older.material.views.find(row=>row.name===view.name).pixelSha256,view.pixelSha256);}
 const oldNative=JSON.parse(await read('older-native-manifest.json')),newNative=JSON.parse(await read('newer-native-manifest.json'));
 assert.deepEqual(oldNative.context,older.context);assert.deepEqual(newNative.context,newer.context);
 assert.equal(oldNative.beforeInventory,newNative.beforeInventory);assert.equal(oldNative.afterInventory,newNative.afterInventory);
 assert.equal(oldNative.packages.length,17);
 const sorted=rows=>[...rows].sort((a,b)=>a.name.localeCompare(b.name,'en'));
 assert.deepEqual(sorted(oldNative.packages),sorted(newNative.packages));
});
