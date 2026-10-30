import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {cohortDigest,validateCohortCertificate} from './ci-browser-cohort-certificates.mjs';
const manifest=JSON.parse(await readFile(join(process.env.RUNNER_TEMP,'native-browser-system/manifest.json'),'utf8'));
const records=JSON.parse(await readFile(new URL('./fixtures/ci-browser-native-cohorts.json',import.meta.url),'utf8')).records;
const expected=records.find(record=>record.id===manifest.context.imageVersion);
assert.ok(expected,'Unmeasured runner cohort: retain evidence but grant no admission');validateCohortCertificate(expected);
assert.equal(manifest.context.commit,process.env.GITHUB_SHA);assert.equal(manifest.context.runId,process.env.GITHUB_RUN_ID);
assert.equal(manifest.context.lockSha256,cohortDigest(await readFile('package-lock.json')));
assert.equal(manifest.beforeInventory,expected.nativeOracle.beforeInventory);
assert.deepEqual(manifest.runtimeMaterial.material,expected.nativeOracle.runtimeMaterial.material,'Actual files/fonts/browser/Source pixels changed');
assert.equal(manifest.runtimeMaterial.materialSha256,expected.nativeOracle.runtimeMaterial.materialSha256);
console.log(JSON.stringify({measurementOnly:true,productionAdmission:false,imageVersion:manifest.context.imageVersion,currentLock:manifest.context.lockSha256,
 historicalLock:expected.bindings.lockSha256,fullMaterialEqual:true,materialSha256:manifest.runtimeMaterial.materialSha256}));
