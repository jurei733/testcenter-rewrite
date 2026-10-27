import assert from 'node:assert/strict';
import {mkdtemp,readFile,rm,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import test from 'node:test';
import {canonicalMaterial} from './ci-browser-material-contract.mjs';
import {certifiedBrowserPolicy,certifiedBrowserSelection,cohortDigest} from './ci-browser-cohort-certificates.mjs';
import {browserSystemFormat,expectedProducerContext,validateManifest,verifyArtifact,verifyRuntimeObservation} from './ci-browser-system.mjs';
const data=JSON.parse(await readFile(new URL('./fixtures/ci-browser-native-cohorts.json',import.meta.url),'utf8'));
const fixture=(index=0)=>{
  const certificate=structuredClone(data.records[index]),oracle=certificate.nativeOracle;
  const context={...structuredClone(oracle.context),commit:'a'.repeat(40),runId:'999',runAttempt:'3'};
  const policy=certifiedBrowserPolicy(certificate);
  const manifest={version:4,context:structuredClone(context),beforeInventory:oracle.beforeInventory,afterInventory:oracle.afterInventory,
    fontInventorySha256:oracle.fontInventorySha256,packages:structuredClone(oracle.packages),timings:{downloadMs:1},
    nativeOracle:structuredClone(oracle),certificate:{id:certificate.id,sha256:policy.certificateSha256}};
  const observed={...structuredClone(oracle.runtimeMaterial),context:structuredClone(context)};
  return {certificate,oracle,context,policy,manifest,observed};
};
test('certified local bundles retain their actual current context and the independently measured original oracle',()=>{
  for(const index of [0,1]){
    const f=fixture(index),before=JSON.stringify(f.manifest.nativeOracle);
    const result=validateManifest(f.manifest,f.context,f.oracle.beforeInventory,f.policy);
    assert.equal(result.files.length,index===0?17:9);
    const verified=verifyRuntimeObservation(f.observed,f.context,f.manifest,f.policy);
    assert.equal(verified.oracleRunId,'40571016364');assert.equal(verified.bundleRunId,'999');
    assert.equal(verified.materialSha256,f.oracle.runtimeMaterial.materialSha256);
    assert.equal(JSON.stringify(f.manifest.nativeOracle),before);
    assert.notEqual(f.manifest.context.commit,f.manifest.nativeOracle.context.commit);
  }
});
test('legacy format and artifact selection cannot implicitly enable the certificate-backed schema',()=>{
  const f=fixture();assert.throws(()=>browserSystemFormat('4'),/Unsupported/);
  for(const policy of [{format:2},{format:3,collectorSha256:f.policy.collectorSha256,materialSha256:f.policy.materialSha256}])
    assert.throws(()=>validateManifest(f.manifest,f.context,f.oracle.beforeInventory,policy),/workflow\/lock\/image/);
  assert.throws(()=>validateManifest(f.manifest,f.context,f.oracle.beforeInventory,{format:4}),/trusted native certificate/);
});
test('all current workflow identity and runtime graph fields bind before archive inspection',()=>{
  for(const key of Object.keys(fixture().context)){
    const f=fixture();f.manifest.context[key]=key==='requested'?['owned-wrong']:String(f.manifest.context[key])+'changed';
    assert.throws(()=>validateManifest(f.manifest,f.context,f.oracle.beforeInventory,f.policy),/workflow\/lock\/image/);
  }
  const f=fixture(),both={...f.context,imageVersion:'unmeasured'};
  assert.throws(()=>validateManifest({...f.manifest,context:both},both,f.oracle.beforeInventory,f.policy),/runtime input/);
});
test('relabeling an oracle, detaching its certificate or adding fields is rejected',()=>{
  for(const change of [m=>m.nativeOracle.context.commit=m.context.commit,m=>m.nativeOracle.runtimeMaterial.context.runId=m.context.runId,
    m=>m.certificate.sha256='a'.repeat(64),m=>m.certificate.id='other',m=>m.certificate.extra=true,
    m=>delete m.nativeOracle,m=>m.runtimeMaterial=m.nativeOracle.runtimeMaterial,m=>m.extra=true]){
    const f=fixture();change(f.manifest);assert.throws(()=>validateManifest(f.manifest,f.context,f.oracle.beforeInventory,f.policy));
  }
});
test('different signed archive hashes, basenames, sizes, identities or target state still reject',()=>{
  for(const change of [m=>{m.packages[0].sha256='f'.repeat(64);m.packages[0].file='f'.repeat(64)+'.deb';},
    m=>m.packages[0].cacheFileName='other.deb',m=>m.packages[0].bytes++,m=>m.packages[0].extra=true,
    m=>m.packages.pop(),m=>m.packages[0].arch=m.packages[0].arch==='all'?'amd64':'all',m=>m.afterInventory+='\n',m=>m.fontInventorySha256='b'.repeat(64)]){
    const f=fixture();change(f.manifest);assert.throws(()=>validateManifest(f.manifest,f.context,f.oracle.beforeInventory,f.policy));
  }
  const f=fixture();f.manifest.packages.reverse();validateManifest(f.manifest,f.context,f.oracle.beforeInventory,f.policy);
});
test('prior global attempts stay supported while certified local bundles require the exact current attempt and selection',()=>{
  const f=fixture(),selection={certificateId:f.certificate.id,certificateSha256:f.policy.certificateSha256,producerAttempt:'3'};
  assert.equal(expectedProducerContext(f.context,'1').runAttempt,'1');
  assert.equal(certifiedBrowserSelection(f.certificate,f.context,selection).format,4);
  for(const wrong of [{producerAttempt:'1'},{producerAttempt:'4'},{producerAttempt:undefined},{certificateId:'other'},
    {certificateSha256:'a'.repeat(64)},{certificateSha256:'$(echo owned)'}])
    assert.throws(()=>certifiedBrowserSelection(f.certificate,f.context,{...selection,...wrong}));
});
test('actual Node modes, libraries, fonts, Original pixels and observed context remain exact even with re-signed observed hashes',()=>{
  const changes=[p=>p.material.files.find(row=>row.name.endsWith('/bin/node')).mode=0o777,
    p=>p.material.files.find(row=>/\.so(?:\.|$)/.test(row.name)).sha256='d'.repeat(64),
    p=>p.material.fontCatalogSha256='e'.repeat(64),p=>p.material.views[0].pixelSha256='f'.repeat(64)];
  for(const change of changes){
    const f=fixture();change(f.observed);f.observed.materialSha256=cohortDigest(canonicalMaterial(f.observed.material));
    assert.throws(()=>verifyRuntimeObservation(f.observed,f.context,f.manifest,f.policy),/Actual browser material or Original pixels differ/);
  }
  const f=fixture();f.observed.context.runAttempt='2';
  assert.throws(()=>verifyRuntimeObservation(f.observed,f.context,f.manifest,f.policy),/Observed browser material context mismatch/);
});
test('invalid certified manifests stop before Debian inspection or any archive bytes are accepted',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'owned-certified-artifact-'));
  try{
    for(const change of [m=>m.certificate.sha256='0'.repeat(64),m=>m.nativeOracle.context.runId='999']){
      const f=fixture();change(f.manifest);await writeFile(join(directory,'manifest.json'),JSON.stringify(f.manifest));
      let inspected=0;
      await assert.rejects(verifyArtifact(directory,f.context,f.oracle.beforeInventory,()=>{inspected++;throw Error('Should not inspect');},f.policy),/provenance mismatch|oracle measurement/);
      assert.equal(inspected,0);
    }
  }finally{await rm(directory,{recursive:true,force:true});}
});
