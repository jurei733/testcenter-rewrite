import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm,symlink,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {canonicalMaterial} from './ci-browser-material-contract.mjs';
import {qualifiedNativeCohortFixture,qualifiedLockCohortFixture} from './qualified-native-cohort-fixture.mjs';
import {chooseCohortCertificate,cohortDigest,loadCohortCertificates,readCohortBindings,
  validateCohortCertificate,validateCohortFamily,validateCohortRegistry} from './ci-browser-cohort-certificates.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const {registry,bindings}=await qualifiedNativeCohortFixture();
// Keep the real earlier qualification immutable when dependencies advance.
const {registry:qualifiedRegistry,bindings:qualifiedBindings,name:qualifiedName,bytes:qualifiedBytes,lockBytes:qualifiedLockBytes}=await qualifiedLockCohortFixture();
const fresh=()=>structuredClone(registry);
const reseal=record=>{
  record.nativeOracle.runtimeMaterial.materialSha256=cohortDigest(canonicalMaterial(record.nativeOracle.runtimeMaterial.material));
  record.provenance.independentPNGVerification.materialSha256=record.nativeOracle.runtimeMaterial.materialSha256;
  record.provenance.nativeOracleManifestSha256=cohortDigest(JSON.stringify(record.nativeOracle)+'\n');
};

test('the immutable qualified graph cannot retarget the historical records',()=>{
  const same=Object.keys(qualifiedBindings).every(key=>qualifiedBindings[key]===bindings[key]);
  if(same)assert.deepEqual(validateCohortRegistry(registry,qualifiedBindings),registry.records);
  else assert.throws(()=>validateCohortRegistry(registry,qualifiedBindings),/Current .* differs from qualified native input/);
  // Actual-root admission is checked below on the pinned Node patch, against
  // that root's exact lock rather than the historical positive fixture.
});

test('both actual native certificates retain qualified APT deltas, material and original measurement context',()=>{
  const before=JSON.stringify(registry),records=validateCohortRegistry(registry,bindings);
  assert.deepEqual(records.map(record=>record.nativeOracle.packages.length),[17,9]);
  for(const record of records){
    const context={...structuredClone(record.nativeOracle.context),commit:'a'.repeat(40),runId:'999',runAttempt:'3'};
    assert.equal(chooseCohortCertificate(records,context,record.nativeOracle.beforeInventory,bindings,{requireRuntimeGraph:true}),record);
    assert.equal(record.nativeOracle.context.commit,'6afb1cba82fe52fa736fa5af5eec9cecf127e8da');
    assert.equal(record.nativeOracle.context.runId,'40571016364');
    assert.equal(record.nativeOracle.runtimeMaterial.material.files.length,591);
    assert.equal(record.nativeOracle.runtimeMaterial.material.files.find(row=>row.name.endsWith('/bin/node')).mode,0o755);
  }
  assert.equal(JSON.stringify(registry),before,'Selection must not rewrite a prior oracle to the current run');
});
test('changed current source, Node, lock or normalization inputs cannot use a prior certificate',async()=>{
  for(const key of Object.keys(bindings)){
    assert.throws(()=>validateCohortRegistry(registry,{...bindings,[key]:String(bindings[key])+'changed'}));
  }
  await assert.rejects(readCohortBindings(root,{nodeVersion:'v22.23.3'}),/Actual Node must match/);
});
test('native runtime graph and every initial inventory byte remain exact requirements',()=>{
  const record=registry.records[0],context=record.nativeOracle.context;
  for(const key of ['imageOS','imageVersion','osSha256','platform','arch','nodeMajor','lockSha256','nativeDepsSha256','playwrightVersion','requested']){
    const wrong={...context,[key]:key==='requested'?['different']:String(context[key])+'changed'};
    assert.throws(()=>validateCohortCertificate(record,{bindings,context:wrong,before:record.nativeOracle.beforeInventory,requireRuntimeGraph:true}));
    const absent={...context};delete absent[key];
    assert.throws(()=>validateCohortCertificate(record,{bindings,context:absent,before:record.nativeOracle.beforeInventory,requireRuntimeGraph:true}));
  }
  assert.throws(()=>chooseCohortCertificate(registry.records,{...context,imageVersion:'unmeasured'},record.nativeOracle.beforeInventory,bindings),/No unique/);
  assert.throws(()=>validateCohortCertificate(record,{bindings,context,before:record.nativeOracle.beforeInventory+'\n'}),/initial inventory/);
  assert.throws(()=>validateCohortCertificate(record,{bindings,requireRuntimeGraph:true}),/Missing actual runtime/);
});
test('unqualified or altered native provenance and oracle bytes cannot be substituted',()=>{
  const changes=[r=>r.provenance.runId++,r=>r.provenance.wrapperCommit='b'.repeat(40),
    r=>r.provenance.nativeOracleManifestSha256='a'.repeat(64),r=>r.provenance.nativeQualification.conclusion='failure',
    r=>r.provenance.nativeQualification.policySkipped=1,r=>r.provenance.nativeQualification.actualOwnedNodeModeCorrection=false,
    r=>r.provenance.independentPNGVerification.visiblePixelHashes=7,r=>r.provenance.independentPNGVerification.actualWhiteFrames=23,
    r=>r.nativeOracle.afterInventory+='\n',r=>r.nativeOracle.packages[0].sha256='c'.repeat(64),
    r=>r.nativeOracle.runtimeMaterial.material.files[0].mode^=1,r=>r.nativeOracle.runtimeMaterial.qualification='diagnostic-only'];
  for(const change of changes){const r=structuredClone(registry.records[0]);change(r);assert.throws(()=>validateCohortCertificate(r,{bindings}));}
});
test('even re-signed alternative Source pixels or font catalogs cannot join the certified cohort family',()=>{
  for(const field of ['pixels','fonts']){
    const d=fresh(),r=d.records[1];
    if(field==='pixels')r.nativeOracle.runtimeMaterial.material.views[0].pixelSha256='d'.repeat(64);
    else {r.nativeOracle.fontInventorySha256='e'.repeat(64);r.nativeOracle.runtimeMaterial.material.fontCatalogSha256='e'.repeat(64);}
    reseal(r);validateCohortCertificate(r,{bindings});
    assert.throws(()=>validateCohortRegistry(d,bindings),/identical Source pixels, fonts and browser inputs/);
  }
});
test('the November native cohort selects only its independently measured image and inventory while prior oracles stay immutable',async()=>{
 const currentBindings=await readCohortBindings(root,{nodeVersion:'v22.23.4'});
 const data=JSON.parse(await readFile(join(root,'scripts/fixtures/ci-browser-native-cohorts-'+currentBindings.lockSha256+'.json'),'utf8'));
 const records=validateCohortFamily(registry,data,currentBindings),record=records.find(r=>r.id==='20261101.360.1');assert.ok(record);
 assert.deepEqual(records.filter(r=>['20261026.354.1','20261018.96.1'].includes(r.id)).map(r=>cohortDigest(JSON.stringify(r))),[
  '763eda9c513230d89b6e3eadac4b9021c4f5146d70d5cfe4b8d65b9af8d70a48','fc6495e25a4da1d2a4942eca15a6a105bd151d24432350ede6f31aed43e40e6a'
 ]);
 assert.equal(record.provenance.runId,41634733039);assert.equal(record.provenance.jobId,125916607651);
 assert.equal(record.provenance.nativeQualification.policyTests,368);assert.equal(record.provenance.nativeQualification.policySkipped,0);
 assert.equal(record.provenance.independentPNGVerification.visiblePixelHashes,8);assert.equal(record.provenance.independentPNGVerification.actualWhiteFrames,24);
 const context=record.nativeOracle.context,before=record.nativeOracle.beforeInventory;
 assert.equal(chooseCohortCertificate(records,context,before,currentBindings,{requireRuntimeGraph:true}),record);
 assert.throws(()=>chooseCohortCertificate(records,{...context,imageVersion:'20261101.unmeasured'},before,currentBindings),/No unique/);
 assert.throws(()=>chooseCohortCertificate(records,context,before+'\n',currentBindings),/initial inventory differs/);
});
test('the separately measured November 114 variant retains exact native provenance and cannot retarget any prior certificate',async()=>{
 const currentBindings=await readCohortBindings(root,{nodeVersion:'v22.23.4'});
 const data=JSON.parse(await readFile(join(root,'scripts/fixtures/ci-browser-native-cohorts-'+currentBindings.lockSha256+'.json'),'utf8'));
 const records=validateCohortFamily(registry,data,currentBindings),record=records.find(r=>r.id==='20261101.114.1');assert.ok(record);
 assert.deepEqual(records.map(r=>r.id),['20261026.354.1','20261018.96.1','20261101.360.1','20261101.114.1']);
 assert.deepEqual(records.slice(0,3).map(r=>cohortDigest(JSON.stringify(r))),[
  '763eda9c513230d89b6e3eadac4b9021c4f5146d70d5cfe4b8d65b9af8d70a48','fc6495e25a4da1d2a4942eca15a6a105bd151d24432350ede6f31aed43e40e6a','6c9c567c636ff5d31a7b71a9791c8de712b6ac69078aacb83c147234af644a81'
 ]);
 assert.equal(record.provenance.runId,41640942834);assert.equal(record.provenance.jobId,125938960716);assert.equal(record.provenance.artifactId,13235191255);
 assert.equal(record.provenance.nativeQualification.policyTests,370);assert.equal(record.provenance.nativeQualification.policySkipped,0);
 const context=record.nativeOracle.context,before=record.nativeOracle.beforeInventory;
 assert.equal(cohortDigest(before),'d35c06b98bb4d11730bd2f1ad1f2a512952d45e364d971c443afc23afa95d66d');
 assert.equal(chooseCohortCertificate(records,context,before,currentBindings,{requireRuntimeGraph:true}),record);
 assert.throws(()=>chooseCohortCertificate(records,{...context,imageVersion:'20261101.114.unmeasured'},before,currentBindings),/No unique/);
 assert.throws(()=>chooseCohortCertificate(records,context,before+'\n',currentBindings),/initial inventory differs/);
});
test('registry ambiguity, unexpected fields and malformed binding hashes reject',()=>{
  for(const change of [d=>d.records.push(structuredClone(d.records[0])),d=>d.version=2,d=>d.extra=true,
    d=>d.records=[],d=>d.records[0].bindings.extra=true,d=>d.records[0].bindings.collectorSha256+='\n']){
    const d=fresh();change(d);assert.throws(()=>validateCohortRegistry(d,bindings));
  }
});
test('the fixed registry loader rejects symlinks and oversized input before reading current bindings',async()=>{
  const directory=await mkdtemp(join(tmpdir(),'owned-cohort-registry-'));
  try{
    const fixtures=join(directory,'scripts/fixtures');await mkdir(fixtures,{recursive:true});
    const path=join(fixtures,'ci-browser-native-cohorts.json');
    await symlink(new URL('./fixtures/ci-browser-native-cohorts.json',import.meta.url),path);
    await assert.rejects(loadCohortCertificates(directory),/Unsafe native cohort registry/);
    await rm(path);await writeFile(path,Buffer.alloc(3*1024*1024+1));
    await assert.rejects(loadCohortCertificates(directory),/Unsafe native cohort registry/);
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('the separately qualified84 lock retains actual provenance and admits only its measured cohort',()=>{
  const before=JSON.stringify([registry,qualifiedRegistry]);
  const records=validateCohortFamily(registry,qualifiedRegistry,qualifiedBindings);
  assert.deepEqual(records.map(record=>record.id),['20261026.354.1']);
  const record=records[0],context=record.nativeOracle.context;
  assert.equal(record.provenance.runId,41113160664);
  assert.equal(context.commit,'2fc93fd5dee96b0877855feaad5a7746ac5ec299');
  assert.equal(context.runId,'41113160664');
  assert.equal(record.provenance.nativeQualification.policyTests,335);
  assert.equal(chooseCohortCertificate(records,context,record.nativeOracle.beforeInventory,qualifiedBindings,{requireRuntimeGraph:true}),record);
  assert.throws(()=>chooseCohortCertificate(records,{...context,imageVersion:'20261023.334.3'},record.nativeOracle.beforeInventory,qualifiedBindings),/No unique/);
  for(const key of Object.keys(qualifiedBindings)){
    assert.throws(()=>validateCohortFamily(registry,qualifiedRegistry,{...qualifiedBindings,[key]:String(qualifiedBindings[key])+'changed'}));
  }
  assert.equal(JSON.stringify([registry,qualifiedRegistry]),before,'Loading a new qualification must not retarget either oracle');
});

test('a new lock cannot replace the historical Source pixels, fonts, browser or screen even with re-sealed digests',()=>{
  for(const field of ['pixels','fonts','browser','screen']){
    const d=structuredClone(qualifiedRegistry),record=d.records[0],material=record.nativeOracle.runtimeMaterial.material;
    if(field==='pixels')material.views[0].pixelSha256='d'.repeat(64);
    if(field==='fonts'){record.nativeOracle.fontInventorySha256='e'.repeat(64);material.fontCatalogSha256='e'.repeat(64);}
    if(field==='browser')material.browserVersion='999.0.0.0';
    if(field==='screen')material.screen.width++;
    reseal(record);validateCohortCertificate(record,{bindings:qualifiedBindings});
    assert.throws(()=>validateCohortFamily(registry,d,qualifiedBindings),/identical Source pixels, fonts and browser inputs/);
  }
  const invalid=fresh();invalid.records[0].provenance.nativeQualification.conclusion='failure';
  assert.throws(()=>validateCohortFamily(invalid,qualifiedRegistry,qualifiedBindings));
});

test('the pinned-Node loader with the immutable qualified84 graph selects only the exact-lock file and rejects unsafe shadows or changed inputs',
  {skip:process.version!==qualifiedBindings.nodeVersion},async()=>{
  const directory=await mkdtemp(join(tmpdir(),'owned-current-cohort-'));
  try{
    const app=join(directory,'rewrite-app'),fixtures=join(app,'scripts/fixtures');
    await mkdir(fixtures,{recursive:true});
    await writeFile(join(directory,'.node-version'),await readFile(join(root,'../.node-version')));
    const inputs=['package-lock.json','scripts/ci-browser-material-profile.mjs','scripts/ci-node-runtime.mjs'];
    for(const path of inputs)await writeFile(join(app,path),path==='package-lock.json'?qualifiedLockBytes:await readFile(join(root,path)));
    const legacyPath=join(fixtures,'ci-browser-native-cohorts.json'),path=join(fixtures,qualifiedName);
    await writeFile(legacyPath,await readFile(new URL('./fixtures/ci-browser-native-cohorts.json',import.meta.url)));
    await writeFile(path,qualifiedBytes);
    const loaded=await loadCohortCertificates(app);
    assert.deepEqual(loaded,qualifiedRegistry.records);
    assert.ok(Object.isFrozen(loaded)&&Object.isFrozen(loaded[0])&&Object.isFrozen(loaded[0].nativeOracle.context));
    assert.equal(cohortDigest(await readFile(legacyPath)),'566c6c86c10a04fd111e3e008d64c35138b5c230054a7ec1d211c913d445965b');
    await rm(path);
    await assert.rejects(loadCohortCertificates(app),/Current lockSha256 differs/);
    await writeFile(join(fixtures,'ci-browser-native-cohorts-'+'0'.repeat(64)+'.json'),qualifiedBytes);
    await assert.rejects(loadCohortCertificates(app),/Current lockSha256 differs/);
    await writeFile(path,'{');await assert.rejects(loadCohortCertificates(app),SyntaxError);
    await writeFile(path,Buffer.alloc(3*1024*1024+1));await assert.rejects(loadCohortCertificates(app),/Unsafe native cohort registry/);
    await rm(path);await symlink(legacyPath,path);await assert.rejects(loadCohortCertificates(app),/Unsafe native cohort registry/);
    await rm(path);await mkdir(path);await assert.rejects(loadCohortCertificates(app),/Unsafe native cohort registry/);
    await rm(path,{recursive:true});await writeFile(path,qualifiedBytes);
    for(const input of inputs){
      const bytes=await readFile(join(app,input));await writeFile(join(app,input),Buffer.concat([bytes,Buffer.from('\n')]));
      await assert.rejects(loadCohortCertificates(app),/Current .* differs from qualified native input/);
      await writeFile(join(app,input),bytes);
    }
    await writeFile(join(directory,'.node-version'),'22.23.3\n');
    await assert.rejects(loadCohortCertificates(app),/Actual Node must match the exact shared patch/);
  }finally{await rm(directory,{recursive:true,force:true});}
});

test('the actual current graph requires its own exact certificate and fails closed before qualification',
 {skip:process.version!==qualifiedBindings.nodeVersion},async()=>{
  const actual=await readCohortBindings(root),name='ci-browser-native-cohorts-'+actual.lockSha256+'.json';
  let bytes;try{bytes=await readFile(new URL('./fixtures/'+name,import.meta.url));}
  catch(error){if(error.code!=='ENOENT')throw error;
   assert.notEqual(actual.lockSha256,qualifiedBindings.lockSha256,'The qualified graph must retain its own actual certificate');
   await assert.rejects(loadCohortCertificates(root),/Current lockSha256 differs from qualified native input/);return;
  }
  const current=JSON.parse(bytes),loaded=await loadCohortCertificates(root);
  assert.deepEqual(loaded,validateCohortFamily(registry,current,actual));
  assert.ok(loaded.length>0&&loaded.every(record=>record.bindings.lockSha256===actual.lockSha256));
 });
