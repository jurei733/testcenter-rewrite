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
assert.equal(certificate.provenance.runId,41139735354);
assert.equal(certificate.nativeOracle.context.commit,'5b39d91dfdb7b5e8acb0a5628b8a87e51f7e678d');
assert.equal(bindings.lockSha256,'faacd429b74eae7024b0c01716c6cdb8b45fb09b5bcf4aa70d53dd93862b8a20');
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
