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
