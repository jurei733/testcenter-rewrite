import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {loadCohortCertificates,readCohortBindings,cohortDigest} from './ci-browser-cohort-certificates.mjs';
import {nativeContext,validateManifest} from './ci-browser-system.mjs';
import {validateRejectedSourceFamily} from './measure-rejected-native-cohort.mjs';
const root=process.cwd(),context=await nativeContext(root),bindings=await readCohortBindings(root),records=await loadCohortCertificates(root);
const oracle=JSON.parse(await readFile(join(process.env.RUNNER_TEMP,'native-browser-system/manifest.json'),'utf8'));
validateManifest(oracle,context,oracle.beforeInventory,{format:3,collectorSha256:bindings.collectorSha256,materialSha256:oracle.runtimeMaterial?.materialSha256});
validateRejectedSourceFamily(oracle.runtimeMaterial,records);
const previous=records.find(record=>record.id===context.imageVersion);
if(previous){assert.deepEqual(oracle.runtimeMaterial.material,previous.nativeOracle.runtimeMaterial.material);assert.equal(oracle.beforeInventory,previous.nativeOracle.beforeInventory);}
console.log(JSON.stringify({measurementOnly:true,productionAdmission:false,newCertificatePrepared:false,sourceFamilyEqual:true,context,beforeInventorySha256:cohortDigest(oracle.beforeInventory),afterInventorySha256:cohortDigest(oracle.afterInventory),materialSha256:oracle.runtimeMaterial.materialSha256,previouslyQualifiedImage:!!previous}));
