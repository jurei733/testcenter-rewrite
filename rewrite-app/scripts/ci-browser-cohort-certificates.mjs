import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {lstat,readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {materialProfileSource} from './ci-browser-material-contract.mjs';
import {validateManifest} from './ci-browser-system.mjs';

export const cohortDigest=value=>createHash('sha256').update(value).digest('hex');
const hash=value=>typeof value==='string'&&value.length===64&&/^[a-f0-9]{64}$/.test(value);
const commit=value=>typeof value==='string'&&value.length===40&&/^[a-f0-9]{40}$/.test(value);
const positive=value=>Number.isSafeInteger(value)&&value>0;
const exactKeys=(value,keys,label)=>{
  assert.ok(value&&Object.getPrototypeOf(value)===Object.prototype,label+' must be a plain record');
  assert.deepEqual(Object.keys(value).sort(),[...keys].sort(),'Unexpected '+label+' fields');
};

export async function readCohortBindings(root,{nodeVersion=process.version}={}){
  const paths={lockSha256:'package-lock.json',collectorSha256:'scripts/ci-browser-material-profile.mjs',
    nodeVersionFileSha256:'../.node-version',nodeNormalizerSha256:'scripts/ci-node-runtime.mjs'};
  const result={};
  for(const [key,path]of Object.entries(paths))result[key]=cohortDigest(await readFile(join(root,path)));
  result.originalFrontendCommit=materialProfileSource.commit;
  assert.equal(nodeVersion,'v'+(await readFile(join(root,'../.node-version'),'utf8')).trim(),'Actual Node must match the exact shared patch');
  result.nodeVersion=nodeVersion;
  return result;
}

// The original native oracle remains an actual earlier measurement. Its
// context is never rewritten to claim that it ran in a new workflow attempt.
export function validateCohortCertificate(record,{bindings,context,before,requireRuntimeGraph=false}={}){
  exactKeys(record,['id','provenance','bindings','nativeOracle'],'cohort certificate');
  const {nativeOracle:oracle,provenance:p,bindings:b}=record;
  exactKeys(b,['lockSha256','nativeDepsSha256','collectorSha256','nodeVersionFileSha256','nodeNormalizerSha256','originalFrontendCommit'],'cohort bindings');
  exactKeys(p,['runId','jobId','applicationCommit','wrapperCommit','artifactId','artifactZipSha256',
    'nativeOracleManifestSha256','independentPNGVerification','nativeQualification'],'cohort provenance');
  assert.ok(positive(p.runId)&&positive(p.jobId)&&positive(p.artifactId),'Invalid native qualification identifiers');
  assert.ok(commit(p.applicationCommit)&&commit(p.wrapperCommit)&&hash(p.artifactZipSha256)&&hash(p.nativeOracleManifestSha256),'Invalid native qualification digests');
  exactKeys(p.nativeQualification,['conclusion','policyTests','policySkipped','nativeDebianTests','auditVulnerabilities','actualOwnedNodeModeCorrection'],'native qualification');
  assert.equal(p.nativeQualification.conclusion,'success');assert.ok(positive(p.nativeQualification.policyTests));
  assert.equal(p.nativeQualification.policySkipped,0);assert.ok(positive(p.nativeQualification.nativeDebianTests));
  assert.equal(p.nativeQualification.auditVulnerabilities,0);assert.equal(p.nativeQualification.actualOwnedNodeModeCorrection,true);
  assert.equal(cohortDigest(JSON.stringify(oracle)+'\n'),p.nativeOracleManifestSha256,'Native oracle bytes do not match qualified provenance');
  assert.equal(oracle.context.commit,p.wrapperCommit,'Native oracle qualification commit mismatch');
  assert.equal(oracle.context.runId,String(p.runId),'Native oracle qualification run mismatch');
  assert.equal(record.id,oracle.context.imageVersion,'Native oracle cohort label mismatch');
  for(const key of ['lockSha256','nativeDepsSha256','collectorSha256','nodeVersionFileSha256','nodeNormalizerSha256'])assert.ok(hash(b[key]),'Invalid cohort binding digest');
  assert.equal(b.originalFrontendCommit,materialProfileSource.commit,'Native oracle Source revision mismatch');
  assert.equal(b.lockSha256,oracle.context.lockSha256);assert.equal(b.nativeDepsSha256,oracle.context.nativeDepsSha256);
  const profile=oracle.runtimeMaterial;
  validateManifest(oracle,oracle.context,oracle.beforeInventory,{format:3,collectorSha256:b.collectorSha256,materialSha256:profile?.materialSha256});
  const proof=p.independentPNGVerification;
  assert.equal(proof.commit,p.wrapperCommit);assert.equal(proof.runId,String(p.runId));assert.equal(proof.imageVersion,record.id);
  assert.equal(proof.node,profile.material.nodeVersion);assert.equal(proof.materialSha256,profile.materialSha256);
  assert.equal(proof.beforeInventorySha256,cohortDigest(oracle.beforeInventory));
  assert.equal(proof.afterInventorySha256,cohortDigest(oracle.afterInventory));
  assert.equal(proof.packages,oracle.packages.length);assert.equal(proof.files,profile.material.files.length);
  assert.equal(proof.visiblePixelHashes,8);assert.equal(proof.actualWhiteFrames,24);
  if(bindings){
    for(const key of ['lockSha256','collectorSha256','nodeVersionFileSha256','nodeNormalizerSha256','originalFrontendCommit'])
      assert.equal(b[key],bindings[key],'Current '+key+' differs from qualified native input');
    assert.equal(profile.material.nodeVersion,bindings.nodeVersion,'Current Node patch differs from qualified native input');
  }
  if(context){
    const keys=['imageOS','imageVersion','osSha256','platform','arch','nodeMajor','lockSha256'];
    if(requireRuntimeGraph)keys.push('nativeDepsSha256','playwrightVersion','requested');
    for(const key of keys){assert.notEqual(context[key],undefined,'Missing current native context '+key);
      assert.deepEqual(context[key],oracle.context[key],'Current '+key+' differs from qualified native input');}
  }else assert.ok(!requireRuntimeGraph,'Missing actual runtime dependency context');
  if(before!==undefined)assert.ok(before===oracle.beforeInventory,'Current initial inventory differs from qualified native input');
  return record;
}

const requireIdenticalSourceInputs=records=>{
  let reference;
  for(const record of records){
    const material=record.nativeOracle.runtimeMaterial.material;
    const comparable={source:material.source,collector:material.scriptSha256,node:material.nodeVersion,
      browser:material.browserVersion,fonts:material.fontCatalogSha256,screen:material.screen,views:material.views};
    if(reference)assert.deepEqual(comparable,reference,'Qualified cohorts must retain identical Source pixels, fonts and browser inputs');
    else reference=comparable;
  }
};

export function validateCohortRegistry(value,bindings){
  exactKeys(value,['version','records'],'cohort registry');assert.equal(value.version,1);
  assert.ok(Array.isArray(value.records)&&value.records.length>0&&value.records.length<=16,'Invalid native cohort registry size');
  const ids=new Set();
  for(const record of value.records){
    validateCohortCertificate(record,{bindings});assert.ok(!ids.has(record.id),'Duplicate native cohort certificate');ids.add(record.id);
  }
  requireIdenticalSourceInputs(value.records);
  return value.records;
}

export function validateCohortFamily(historical,qualified,bindings){
  const reference=validateCohortRegistry(historical),records=validateCohortRegistry(qualified,bindings);
  // Separate locks need their own actual qualification. They must still agree
  // with the historical Source views, fonts, browser and measurement inputs.
  requireIdenticalSourceInputs([...reference,...records]);
  return records;
}

const readRegistry=async path=>{
  const info=await lstat(path);
  assert.ok(info.isFile()&&!info.isSymbolicLink()&&info.size<=3*1024*1024,'Unsafe native cohort registry');
  return JSON.parse(await readFile(path,'utf8'));
};

export async function loadCohortCertificates(root){
  const historical=await readRegistry(join(root,'scripts/fixtures/ci-browser-native-cohorts.json'));
  const bindings=await readCohortBindings(root);
  let qualified;
  try{
    qualified=await readRegistry(join(root,'scripts/fixtures/ci-browser-native-cohorts-'+bindings.lockSha256+'.json'));
  }catch(error){
    // Only an absent exact-lock file may use the legacy registry, which must
    // independently satisfy the actual current bindings. Invalid files reject.
    if(error.code!=='ENOENT')throw error;
    qualified=historical;
  }
  const records=validateCohortFamily(historical,qualified,bindings);
  const freeze=value=>{
    if(value&&typeof value==='object'&&!Object.isFrozen(value)){
      Object.values(value).forEach(freeze);Object.freeze(value);
    }
    return value;
  };
  return freeze(records);
}

export function chooseCohortCertificate(records,context,before,bindings,{requireRuntimeGraph=false}={}){
  const matches=records.filter(record=>record.id===context.imageVersion);
  assert.equal(matches.length,1,'No unique independently qualified native cohort');
  return validateCohortCertificate(matches[0],{bindings,context,before,requireRuntimeGraph});
}

export function certifiedBrowserPolicy(certificate){
  return {format:4,certificate,certificateSha256:cohortDigest(JSON.stringify(certificate)),
    collectorSha256:certificate.bindings.collectorSha256,materialSha256:certificate.nativeOracle.runtimeMaterial.materialSha256};
}

export function certifiedBrowserSelection(certificate,consumer,{certificateId,certificateSha256,producerAttempt}={}){
  const policy=certifiedBrowserPolicy(certificate);
  assert.ok(certificateId===certificate.id&&certificateSha256===policy.certificateSha256,'Certified browser selection changed or is missing');
  assert.ok(typeof consumer.runAttempt==='string'&&/^[1-9][0-9]*$/.test(consumer.runAttempt)&&Number.isSafeInteger(Number(consumer.runAttempt))&&
    producerAttempt===consumer.runAttempt,'Locally prepared browser bundle requires the current exact attempt');
  return policy;
}
