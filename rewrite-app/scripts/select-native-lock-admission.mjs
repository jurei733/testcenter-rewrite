import assert from 'node:assert/strict';
import {appendFile,writeFile} from 'node:fs/promises';
import {join} from 'node:path';
import {canonicalNativeInventory} from './ci-browser-inventory-preflight.mjs';
import {nativeContext} from './ci-browser-system.mjs';
import {chooseCohortCertificate,cohortDigest,loadCohortCertificates,readCohortBindings,
  certifiedBrowserPolicy} from './ci-browser-cohort-certificates.mjs';

const root=process.cwd(),context=await nativeContext(root),before=canonicalNativeInventory();
const records=await loadCohortCertificates(root),bindings=await readCohortBindings(root);
const certificate=chooseCohortCertificate(records,context,before,bindings,{requireRuntimeGraph:true});
const policy=certifiedBrowserPolicy(certificate);
assert.ok(Object.isFrozen(records)&&Object.isFrozen(certificate.nativeOracle.context));
assert.equal(certificate.provenance.runId,41113160664);
assert.equal(certificate.nativeOracle.context.commit,'2fc93fd5dee96b0877855feaad5a7746ac5ec299');
assert.equal(bindings.lockSha256,'84a86833d8703b3b830024dcb04fb0b5ca138fe90af3361a9906180fbcc8ac30');
assert.ok(process.env.GITHUB_ENV&&process.env.RUNNER_TEMP);
await appendFile(process.env.GITHUB_ENV,'CI_BROWSER_SYSTEM_CERTIFICATE_ID='+certificate.id+'\n'+
  'CI_BROWSER_SYSTEM_EXPECTED_CERTIFICATE_SHA256='+policy.certificateSha256+'\n'+
  'CI_BROWSER_SYSTEM_PRODUCER_ATTEMPT='+context.runAttempt+'\n');
const receipt={nativeCertificateSelected:true,runtimeRestorationProven:false,context,
  beforeInventorySha256:cohortDigest(before),certificateId:certificate.id,certificateSha256:policy.certificateSha256,
  certificateOracleRun:certificate.provenance.runId,certificateOracleCommit:certificate.nativeOracle.context.commit,
  currentBindings:bindings,availableCohorts:records.map(record=>record.id)};
await writeFile(join(process.env.RUNNER_TEMP,'native-admission-evidence/selection.json'),JSON.stringify(receipt)+'\n',{flag:'wx'});
console.log(JSON.stringify(receipt));
