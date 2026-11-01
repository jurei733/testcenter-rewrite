import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {cohortDigest,loadCohortCertificates,readCohortBindings} from './ci-browser-cohort-certificates.mjs';
import {nativeContext,validateManifest} from './ci-browser-system.mjs';
import {validateRejectedSourceFamily} from './measure-rejected-native-cohort.mjs';

const root=process.cwd(),context=await nativeContext(root),bindings=await readCohortBindings(root);
const records=await loadCohortCertificates(root);
const oracle=JSON.parse(await readFile(join(process.env.RUNNER_TEMP,'native-browser-system/manifest.json'),'utf8'));
validateManifest(oracle,context,oracle.beforeInventory,{
 format:3,collectorSha256:bindings.collectorSha256,materialSha256:oracle.runtimeMaterial?.materialSha256
});
validateRejectedSourceFamily(oracle.runtimeMaterial,records);
const known=records.find(record=>record.id===context.imageVersion);
if(known){
 assert.deepEqual(oracle.runtimeMaterial.material,known.nativeOracle.runtimeMaterial.material);
 assert.equal(oracle.beforeInventory,known.nativeOracle.beforeInventory);
}
console.log(JSON.stringify({
 measurementOnly:true,productionAdmission:false,newCertificatePrepared:false,
 sourceFamilyEqual:true,context,beforeInventorySha256:cohortDigest(oracle.beforeInventory),
 afterInventorySha256:cohortDigest(oracle.afterInventory),materialSha256:oracle.runtimeMaterial.materialSha256,
 previouslyQualifiedImage:!!known,observedLockSha256:bindings.lockSha256
}));
