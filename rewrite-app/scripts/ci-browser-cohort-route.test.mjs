import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {chooseBrowserInstallRoute} from './ci-browser-cohort-route.mjs';
import {cohortDigest,readCohortBindings,certifiedBrowserPolicy} from './ci-browser-cohort-certificates.mjs';
const records=JSON.parse(await readFile(new URL('./fixtures/ci-browser-native-cohorts.json',import.meta.url),'utf8')).records;
const bindings=await readCohortBindings(fileURLToPath(new URL('../',import.meta.url)),{nodeVersion:'v22.23.4'});
const inputs=(consumer=0,producer=0)=>({format:'3',producerAttempt:'1',producerImageVersion:records[producer].id,
  producerMaterialSha256:records[producer].nativeOracle.runtimeMaterial.materialSha256,
  producerBeforeSha256:cohortDigest(records[producer].nativeOracle.beforeInventory),
  consumerContext:{...structuredClone(records[consumer].nativeOracle.context),runAttempt:'3'},
  before:records[consumer].nativeOracle.beforeInventory,allowCertified:true,records,bindings});
test('matching complete initial inventories retain the original same-run path and exact earlier producer attempt',()=>{
  for(const allowCertified of [false,true])assert.deepEqual(chooseBrowserInstallRoute({...inputs(),allowCertified,records:undefined}),
    {route:'same-run',producerAttempt:'1'});
  assert.deepEqual(chooseBrowserInstallRoute({...inputs(),format:'2',producerMaterialSha256:undefined,records:undefined}),
    {route:'same-run',producerAttempt:'1'});
});
test('both actually qualified cross-cohort directions select an explicit local certificate and current attempt',()=>{
  for(const [consumer,producer]of [[0,1],[1,0]]){
    const actual=chooseBrowserInstallRoute(inputs(consumer,producer)),certificate=records[consumer];
    assert.deepEqual(actual,{route:'certified',producerAttempt:'3',certificateId:certificate.id,
      certificateSha256:certifiedBrowserPolicy(certificate).certificateSha256});
  }
});
test('cross-cohort admission requires an explicit boolean opt-in and cannot enable itself for legacy format',()=>{
  for(const allowCertified of [false,undefined,'true',1])assert.throws(()=>chooseBrowserInstallRoute({...inputs(0,1),allowCertified}),/initial dpkg inventory mismatch/);
  assert.throws(()=>chooseBrowserInstallRoute({...inputs(0,1),format:'2'}));
  assert.throws(()=>chooseBrowserInstallRoute({...inputs(0,1),format:'4'}),/Unsupported/);
});
test('global producer image, material and exact initial digest must match one of the independent native oracles',()=>{
  for(const changed of [{producerImageVersion:'unknown'},{producerMaterialSha256:'f'.repeat(64)},
    {producerBeforeSha256:'e'.repeat(64)}])assert.throws(()=>chooseBrowserInstallRoute({...inputs(0,1),...changed}));
});
test('unknown current images, changed inventory bytes or current bindings never fall back to native install',()=>{
  const f=inputs(0,1);
  for(const changed of [{consumerContext:{...f.consumerContext,imageVersion:'unknown'}},{before:f.before+'\n'},
    {bindings:{...bindings,nodeNormalizerSha256:'d'.repeat(64)}},{records:undefined}])
    assert.throws(()=>chooseBrowserInstallRoute({...f,...changed}));
});
test('malformed metadata, injected payloads and impossible rerun attempts reject before an install route is granted',()=>{
  for(const changed of [{format:'3;echo owned'},{producerAttempt:'4'},{producerAttempt:'0'},
    {producerBeforeSha256:'$(echo owned)'},{producerBeforeSha256:'a'.repeat(64)+'\n'},
    {producerImageVersion:'x\n'},{producerMaterialSha256:undefined}])assert.throws(()=>chooseBrowserInstallRoute({...inputs(),...changed}));
});
