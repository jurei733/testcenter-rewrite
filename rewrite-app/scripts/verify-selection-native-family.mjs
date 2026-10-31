import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {validateCohortFamily,readCohortBindings,cohortDigest} from './ci-browser-cohort-certificates.mjs';
import {qualifiedNativeCohortFixture,qualifiedLockCohortFixture} from './qualified-native-cohort-fixture.mjs';
import {validateObservedNativeBindings} from './observed-native-source-family.mjs';
import {nativeContext,validateManifest} from './ci-browser-system.mjs';
import {validateRejectedSourceFamily} from './measure-rejected-native-cohort.mjs';
const root=process.cwd(),context=await nativeContext(root),bindings=await readCohortBindings(root);
// A changed lock needs measurement before any production certificate exists.
// Use the immutable previous family solely as a rendering reference; never
// pass it to the production loader or change its real measurement contexts.
const referenceBytes=await readFile(join(root,'scripts/fixtures/ci-browser-native-cohorts-faacd429b74eae7024b0c01716c6cdb8b45fb09b5bcf4aa70d53dd93862b8a20.json'));
assert.equal(cohortDigest(referenceBytes),'a97c085487bc5f150836496ab594783ca8f4aff41316d6a3641e9e3532d69cfa');
const historical=await qualifiedNativeCohortFixture(),records=validateCohortFamily(historical.registry,JSON.parse(referenceBytes));
const previousInputs=await qualifiedLockCohortFixture();validateObservedNativeBindings(bindings,previousInputs.bindings);
const oracle=JSON.parse(await readFile(join(process.env.RUNNER_TEMP,'native-browser-system/manifest.json'),'utf8'));
validateManifest(oracle,context,oracle.beforeInventory,{format:3,collectorSha256:bindings.collectorSha256,materialSha256:oracle.runtimeMaterial?.materialSha256});
validateRejectedSourceFamily(oracle.runtimeMaterial,records);
const previous=records.find(record=>record.id===context.imageVersion);
if(previous){assert.deepEqual(oracle.runtimeMaterial.material,previous.nativeOracle.runtimeMaterial.material);assert.equal(oracle.beforeInventory,previous.nativeOracle.beforeInventory);}
console.log(JSON.stringify({measurementOnly:true,productionAdmission:false,newCertificatePrepared:false,sourceFamilyEqual:true,context,beforeInventorySha256:cohortDigest(oracle.beforeInventory),afterInventorySha256:cohortDigest(oracle.afterInventory),materialSha256:oracle.runtimeMaterial.materialSha256,previouslyQualifiedImage:!!previous,observedLockSha256:bindings.lockSha256,referenceLockSha256:records[0].bindings.lockSha256}));
