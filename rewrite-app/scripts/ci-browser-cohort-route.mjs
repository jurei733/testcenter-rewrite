import assert from 'node:assert/strict';
import {appendFile,mkdir,readFile,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {canonicalNativeInventory} from './ci-browser-inventory-preflight.mjs';
import {expectedBrowserArtifact,parseInventory} from './ci-browser-system.mjs';
import {chooseCohortCertificate,cohortDigest,loadCohortCertificates,readCohortBindings,
  validateCohortCertificate,validateCohortRegistry,certifiedBrowserPolicy} from './ci-browser-cohort-certificates.mjs';

const hash=value=>typeof value==='string'&&value.length===64&&/^[a-f0-9]{64}$/.test(value);
export function chooseBrowserInstallRoute({format='2',producerAttempt,producerImageVersion,producerMaterialSha256,
  producerBeforeSha256,consumerContext,before,allowCertified=false,records,bindings}){
  expectedBrowserArtifact(consumerContext,producerAttempt,{format,producerImageVersion,materialSha256:producerMaterialSha256});
  assert.ok(hash(producerBeforeSha256),'Missing or invalid producer initial inventory digest');
  parseInventory(before);
  if(cohortDigest(before)===producerBeforeSha256)return {route:'same-run',producerAttempt};
  assert.ok(format==='3'&&allowCertified===true,'Browser system initial dpkg inventory mismatch before dependency installation');
  validateCohortRegistry({version:1,records},bindings);
  const producer=records.find(record=>record.id===producerImageVersion&&record.nativeOracle.runtimeMaterial.materialSha256===producerMaterialSha256);
  assert.ok(producer,'Producer runtime has no independently qualified matching certificate');
  assert.equal(cohortDigest(producer.nativeOracle.beforeInventory),producerBeforeSha256,'Producer initial inventory does not match its qualified native oracle');
  validateCohortCertificate(producer,{bindings});
  const certificate=chooseCohortCertificate(records,consumerContext,before,bindings),policy=certifiedBrowserPolicy(certificate);
  return {route:'certified',producerAttempt:consumerContext.runAttempt,certificateId:certificate.id,certificateSha256:policy.certificateSha256};
}

export async function bootstrapCohortContext(root,env=process.env){
  assert.ok(process.platform==='linux'&&process.arch==='x64','Browser routing requires native Linux x64');
  assert.ok(env.ImageOS==='ubuntu24'&&typeof env.ImageVersion==='string'&&/^[A-Za-z0-9._-]{1,80}$/.test(env.ImageVersion),'Invalid hosted browser cohort');
  assert.ok(typeof env.GITHUB_SHA==='string'&&/^[a-f0-9]{40}$/.test(env.GITHUB_SHA),'Invalid current checkout identity');
  const native=args=>execFileSync('/usr/bin/git',args,{cwd:root,encoding:'utf8',timeout:30000,maxBuffer:1024*1024}).trim();
  assert.equal(native(['rev-parse','HEAD']),env.GITHUB_SHA,'Browser routing checkout mismatch');
  assert.equal(native(['status','--porcelain','--untracked-files=no']),'','Browser routing checkout has tracked mutations');
  const os=await readFile('/etc/os-release','utf8');
  assert.ok(/^ID=ubuntu$/m.test(os)&&/^VERSION_ID="24\.04"$/m.test(os),'Browser routing requires Ubuntu24.04');
  return {imageOS:env.ImageOS,imageVersion:env.ImageVersion,osSha256:cohortDigest(os),platform:'linux',arch:'x64',nodeMajor:'22',
    lockSha256:cohortDigest(await readFile(join(root,'package-lock.json'))),runAttempt:env.GITHUB_RUN_ATTEMPT};
}

export async function routeBrowserCohort(root,env=process.env){
  const context=await bootstrapCohortContext(root,env),before=canonicalNativeInventory();
  const allowCertified=env.CI_BROWSER_SYSTEM_ALLOW_CERTIFIED==='true';
  const differs=cohortDigest(before)!==env.CI_BROWSER_SYSTEM_EXPECTED_BEFORE_SHA256;
  try{
    const records=differs&&allowCertified?await loadCohortCertificates(root):undefined;
    const bindings=records?await readCohortBindings(root):undefined;
    const result=chooseBrowserInstallRoute({format:env.CI_BROWSER_SYSTEM_FORMAT??'2',producerAttempt:env.CI_BROWSER_SYSTEM_PRODUCER_ATTEMPT,
      producerImageVersion:env.CI_BROWSER_SYSTEM_EXPECTED_IMAGE_VERSION,producerMaterialSha256:env.CI_BROWSER_SYSTEM_EXPECTED_MATERIAL_SHA256,
      producerBeforeSha256:env.CI_BROWSER_SYSTEM_EXPECTED_BEFORE_SHA256,consumerContext:context,before,allowCertified,records,bindings});
    if(env.GITHUB_OUTPUT)await appendFile(env.GITHUB_OUTPUT,'route='+result.route+'\nproducer-attempt='+result.producerAttempt+'\n'+
      'certificate-id='+(result.certificateId??'')+'\ncertificate-sha256='+(result.certificateSha256??'')+'\n');
    console.log(JSON.stringify({browserInstallRoute:result.route,imageVersion:context.imageVersion,beforeSha256:cohortDigest(before),
      ...(result.certificateId?{certificateId:result.certificateId}:{})}));
    return result;
  }catch(error){
    if(env.CI_BROWSER_COHORT_DIAGNOSTIC_DIR){
      await mkdir(env.CI_BROWSER_COHORT_DIAGNOSTIC_DIR,{recursive:true});
      await writeFile(join(env.CI_BROWSER_COHORT_DIAGNOSTIC_DIR,'observed-inventory.tsv'),before,{flag:'wx'});
      await writeFile(join(env.CI_BROWSER_COHORT_DIAGNOSTIC_DIR,'inventory-mismatch.json'),JSON.stringify({version:1,
        expected:hash(env.CI_BROWSER_SYSTEM_EXPECTED_BEFORE_SHA256)?env.CI_BROWSER_SYSTEM_EXPECTED_BEFORE_SHA256:null,
        actual:cohortDigest(before)})+'\n',{flag:'wx'});
    }
    throw error;
  }
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
  try{await routeBrowserCohort(process.cwd());}catch(error){console.error(error.message);process.exitCode=1;}
}
