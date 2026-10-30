import assert from 'node:assert/strict';
import {mkdtemp,mkdir,readFile,rm,symlink,writeFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {canonicalMaterial} from './ci-browser-material-contract.mjs';
import {qualifiedNativeCohortFixture} from './qualified-native-cohort-fixture.mjs';
import {chooseCohortCertificate,cohortDigest,loadCohortCertificates,readCohortBindings,
  validateCohortCertificate,validateCohortFamily,validateCohortRegistry} from './ci-browser-cohort-certificates.mjs';

const root=fileURLToPath(new URL('../',import.meta.url));
const {registry,bindings}=await qualifiedNativeCohortFixture();
// These pure admission tests model the actually qualified Linux Node patch.
// The native prepare/install qualifier separately executes real Node and APT.
const currentBindings=await readCohortBindings(root,{nodeVersion:'v22.23.4'});
const currentName='ci-browser-native-cohorts-'+currentBindings.lockSha256+'.json';
const currentBytes=await readFile(new URL('./fixtures/'+currentName,import.meta.url));
const currentRegistry=JSON.parse(currentBytes);
const fresh=()=>structuredClone(registry);
const reseal=record=>{
  record.nativeOracle.runtimeMaterial.materialSha256=cohortDigest(canonicalMaterial(record.nativeOracle.runtimeMaterial.material));
  record.provenance.independentPNGVerification.materialSha256=record.nativeOracle.runtimeMaterial.materialSha256;
  record.provenance.nativeOracleManifestSha256=cohortDigest(JSON.stringify(record.nativeOracle)+'\n');
};

test('actual current inputs require their own qualification; the loader cannot retarget the historical records',async()=>{
  const same=Object.keys(currentBindings).every(key=>currentBindings[key]===bindings[key]);
  if(same)assert.deepEqual(validateCohortRegistry(registry,currentBindings),registry.records);
  else assert.throws(()=>validateCohortRegistry(registry,currentBindings),/Current .* differs from qualified native input/);
  // This actual loader check runs on the pinned native Node patch. macOS's
  // different patch remains independently rejected by the existing control.
  if(process.version===currentBindings.nodeVersion){
    assert.deepEqual(await loadCohortCertificates(root),currentRegistry.records);
  }
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

test('the separately qualified current lock retains actual provenance and admits only its measured cohort',()=>{
  const before=JSON.stringify([registry,currentRegistry]);
  const records=validateCohortFamily(registry,currentRegistry,currentBindings);
  assert.deepEqual(records.map(record=>record.id),['20261026.354.1']);
  const record=records[0],context=record.nativeOracle.context;
  assert.equal(record.provenance.runId,41113160664);
  assert.equal(context.commit,'2fc93fd5dee96b0877855feaad5a7746ac5ec299');
  assert.equal(context.runId,'41113160664');
  assert.equal(record.provenance.nativeQualification.policyTests,335);
  assert.equal(chooseCohortCertificate(records,context,record.nativeOracle.beforeInventory,currentBindings,{requireRuntimeGraph:true}),record);
  assert.throws(()=>chooseCohortCertificate(records,{...context,imageVersion:'20261023.334.3'},record.nativeOracle.beforeInventory,currentBindings),/No unique/);
  for(const key of Object.keys(currentBindings)){
    assert.throws(()=>validateCohortFamily(registry,currentRegistry,{...currentBindings,[key]:String(currentBindings[key])+'changed'}));
  }
  assert.equal(JSON.stringify([registry,currentRegistry]),before,'Loading a new qualification must not retarget either oracle');
});

test('a new lock cannot replace the historical Source pixels, fonts, browser or screen even with re-sealed digests',()=>{
  for(const field of ['pixels','fonts','browser','screen']){
    const d=structuredClone(currentRegistry),record=d.records[0],material=record.nativeOracle.runtimeMaterial.material;
    if(field==='pixels')material.views[0].pixelSha256='d'.repeat(64);
    if(field==='fonts'){record.nativeOracle.fontInventorySha256='e'.repeat(64);material.fontCatalogSha256='e'.repeat(64);}
    if(field==='browser')material.browserVersion='999.0.0.0';
    if(field==='screen')material.screen.width++;
    reseal(record);validateCohortCertificate(record,{bindings:currentBindings});
    assert.throws(()=>validateCohortFamily(registry,d,currentBindings),/identical Source pixels, fonts and browser inputs/);
  }
  const invalid=fresh();invalid.records[0].provenance.nativeQualification.conclusion='failure';
  assert.throws(()=>validateCohortFamily(invalid,currentRegistry,currentBindings));
});

test('the actual pinned-Node loader selects only the exact-lock file and rejects unsafe shadows or changed inputs',
  {skip:process.version!==currentBindings.nodeVersion},async()=>{
  const directory=await mkdtemp(join(tmpdir(),'owned-current-cohort-'));
  try{
    const app=join(directory,'rewrite-app'),fixtures=join(app,'scripts/fixtures');
    await mkdir(fixtures,{recursive:true});
    await writeFile(join(directory,'.node-version'),await readFile(join(root,'../.node-version')));
    const inputs=['package-lock.json','scripts/ci-browser-material-profile.mjs','scripts/ci-node-runtime.mjs'];
    for(const path of inputs)await writeFile(join(app,path),await readFile(join(root,path)));
    const legacyPath=join(fixtures,'ci-browser-native-cohorts.json'),path=join(fixtures,currentName);
    await writeFile(legacyPath,await readFile(new URL('./fixtures/ci-browser-native-cohorts.json',import.meta.url)));
    await writeFile(path,currentBytes);
    const loaded=await loadCohortCertificates(app);
    assert.deepEqual(loaded,currentRegistry.records);
    assert.ok(Object.isFrozen(loaded)&&Object.isFrozen(loaded[0])&&Object.isFrozen(loaded[0].nativeOracle.context));
    assert.equal(cohortDigest(await readFile(legacyPath)),'566c6c86c10a04fd111e3e008d64c35138b5c230054a7ec1d211c913d445965b');
    await rm(path);
    await assert.rejects(loadCohortCertificates(app),/Current lockSha256 differs/);
    await writeFile(join(fixtures,'ci-browser-native-cohorts-'+'0'.repeat(64)+'.json'),currentBytes);
    await assert.rejects(loadCohortCertificates(app),/Current lockSha256 differs/);
    await writeFile(path,'{');await assert.rejects(loadCohortCertificates(app),SyntaxError);
    await writeFile(path,Buffer.alloc(3*1024*1024+1));await assert.rejects(loadCohortCertificates(app),/Unsafe native cohort registry/);
    await rm(path);await symlink(legacyPath,path);await assert.rejects(loadCohortCertificates(app),/Unsafe native cohort registry/);
    await rm(path);await mkdir(path);await assert.rejects(loadCohortCertificates(app),/Unsafe native cohort registry/);
    await rm(path,{recursive:true});await writeFile(path,currentBytes);
    for(const input of inputs){
      const bytes=await readFile(join(app,input));await writeFile(join(app,input),Buffer.concat([bytes,Buffer.from('\n')]));
      await assert.rejects(loadCohortCertificates(app),/Current .* differs from qualified native input/);
      await writeFile(join(app,input),bytes);
    }
    await writeFile(join(directory,'.node-version'),'22.23.3\n');
    await assert.rejects(loadCohortCertificates(app),/Actual Node must match the exact shared patch/);
  }finally{await rm(directory,{recursive:true,force:true});}
});
