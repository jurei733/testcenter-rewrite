import assert from 'node:assert/strict';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {chmod,lstat,readFile,realpath,writeFile} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {bootstrapCohortContext} from './ci-browser-cohort-route.mjs';
import {canonicalNativeInventory} from './ci-browser-inventory-preflight.mjs';
import {cohortDigest,loadCohortCertificates,readCohortBindings} from './ci-browser-cohort-certificates.mjs';
import {nativeContext,validateManifest} from './ci-browser-system.mjs';
import {validateRuntimeMaterial} from './ci-browser-material-contract.mjs';
import {isSupervisedSmokeChild,reportSmokePhase,runSupervisedSmoke} from './supervised-smoke.mjs';

const execute=promisify(execFile),hash=/^[a-f0-9]{64}$/;

/** Eligibility for evidence collection never grants installation admission. */
export function validateRejectedNativeInputs(context,before,mismatch,records,bindings){
 assert.equal(context.imageOS,'ubuntu24');assert.equal(context.platform,'linux');assert.equal(context.arch,'x64');assert.equal(context.nodeMajor,'22');
 assert.match(context.imageVersion,/^[A-Za-z0-9._-]{1,80}$/);assert.match(context.lockSha256,hash);
 assert.equal(mismatch.version,1);assert.match(mismatch.expected,hash);assert.match(mismatch.actual,hash);
 assert.equal(cohortDigest(before),mismatch.actual,'Rejected inventory evidence changed');
 assert.notEqual(mismatch.expected,mismatch.actual,'A matching producer needs no rejection measurement');
 assert.equal(context.lockSha256,bindings.lockSha256,'Rejected checkout lock changed');
 assert.ok(records.length>0&&records.every(record=>record.id!==context.imageVersion),'Known cohorts require their existing certificate, not replacement measurement');
 return Object.freeze({measurementOnly:true,productionAdmission:false,newCertificatePrepared:false,
  context,beforeInventorySha256:mismatch.actual,producerBeforeInventorySha256:mismatch.expected});
}

/** Changed OS files may be measured, but every Source rendering input stays fixed. */
export function validateRejectedSourceFamily(observed,records){
 validateRuntimeMaterial(observed);
 const comparable=profile=>{
  const m=profile.material;return{source:m.source,collector:m.scriptSha256,node:m.nodeVersion,
   browser:m.browserVersion,fonts:m.fontCatalogSha256,screen:m.screen,views:m.views};
 };
 assert.ok(records.length>0);
 for(const record of records){validateRuntimeMaterial(record.nativeOracle.runtimeMaterial);
  assert.deepEqual(comparable(observed),comparable(record.nativeOracle.runtimeMaterial),'Rejected cohort changed qualified Source pixels, fonts, browser or measurement inputs');}
 return observed;
}

export function successfulTapSummary(text){
 const result={};
 for(const key of ['tests','pass','fail','cancelled','skipped','todo']){
  const matches=[...text.matchAll(new RegExp('^# '+key+' ([0-9]+)$','gm'))];
  assert.equal(matches.length,1,'Missing or repeated native TAP summary: '+key);result[key]=Number(matches[0][1]);
 }
 assert.ok(result.tests>0);assert.equal(result.pass,result.tests);
 for(const key of ['fail','cancelled','skipped','todo'])assert.equal(result[key],0,'Incomplete native qualification: '+key);
 return result;
}

const regular=async(path,max)=>{const info=await lstat(path);assert.ok(info.isFile()&&!info.isSymbolicLink()&&info.size<=max,'Unsafe rejection evidence');return readFile(path);};
async function prepare(root,env){
 assert.equal(env.GITHUB_ACTIONS,'true');
 const directory=resolve(env.CI_BROWSER_REJECTION_MEASUREMENT_DIR??'');
 assert.ok(env.RUNNER_TEMP&&directory===join(resolve(env.RUNNER_TEMP),'rejected-native-measurement'),'Only the owned rejection directory may be written');
 const diagnostic=resolve(env.CI_BROWSER_COHORT_DIAGNOSTIC_DIR??'');
 assert.equal(diagnostic,join(resolve(env.RUNNER_TEMP),'browser-cohort'));
 const context=await bootstrapCohortContext(root,env),before=canonicalNativeInventory();
 const captured=await regular(join(diagnostic,'observed-inventory.tsv'),1024*1024);assert.equal(captured.toString(),before,'Actual rejected host inventory changed before measurement');
 const mismatch=JSON.parse(await regular(join(diagnostic,'inventory-mismatch.json'),4096));
 const records=await loadCohortCertificates(root),bindings=await readCohortBindings(root);
 const trigger=validateRejectedNativeInputs(context,before,mismatch,records,bindings);
 return{directory,context,before,records,bindings,trigger};
}

/** GNU timeout owns each native command; the independent outer supervisor owns
 * the whole measurement and its descendants if a child blocks or ignores TERM. */
export async function executeRejectedMeasurementStep(root,command,args,seconds=300,env=process.env){
 assert.ok(Number.isSafeInteger(seconds)&&seconds>0&&seconds<=300);
 return execute('/usr/bin/timeout',['--signal=TERM','--kill-after=15s',seconds+'s',command,...args],{
  cwd:root,env,maxBuffer:16*1024*1024,timeout:(seconds+20)*1000,killSignal:'SIGKILL'});
}

async function exerciseOwnedNode(root){
 const path=process.execPath;assert.equal(path,'/opt/hostedtoolcache/node/22.23.4/x64/bin/node');
 assert.equal(await realpath(path),path);const info=await lstat(path);assert.ok(info.isFile());
 assert.equal(info.uid,process.getuid());assert.equal(info.mode&0o7777,0o755);
 const before=cohortDigest(await readFile(path));assert.equal(before,'94efd062ed066c1a0b332e18249859c905e920eeada5df55d24c99b919629a90');
 await chmod(path,0o777);
 try{
  const child=await executeRejectedMeasurementStep(root,path,['scripts/ci-node-runtime.mjs'],15),node=JSON.parse(child.stdout).ciNode;
  assert.deepEqual(node,{nodeVersion:'v22.23.4',beforeMode:0o777,afterMode:0o755,changed:true});assert.equal(cohortDigest(await readFile(path)),before);
  return{actualOwnedNodeModeCorrection:true,binarySha256:before,...node};
 }finally{await chmod(path,0o755);}
}

async function measure(root,env){
 const prepared=await prepare(root,env),{directory,context,before,records,bindings,trigger}=prepared;
 let stage='validate-rejected-host';
 const step=async(name,command,args,seconds=300,childEnv=env)=>{
  stage=name;reportSmokePhase(name);
  try{const child=await executeRejectedMeasurementStep(root,command,args,seconds,childEnv);await writeFile(join(directory,name+'.log'),child.stdout,{flag:'wx'});await writeFile(join(directory,name+'.stderr.log'),child.stderr,{flag:'wx'});}
  catch(error){await writeFile(join(directory,name+'.log'),String(error.stdout??''),{flag:'wx'});await writeFile(join(directory,name+'.stderr.log'),String(error.stderr??''),{flag:'wx'});throw Object.assign(Error('Rejected-native measurement failed at '+name),{exitCode:Number.isInteger(error.code)&&error.code>0?error.code:1});}
 };
 try{
  await writeFile(join(directory,'trigger.json'),JSON.stringify(trigger)+'\n',{flag:'wx'});
  await step('locked-install','npm',['ci','--no-audit','--no-fund'],90);
  assert.equal(canonicalNativeInventory(),before,'Dependency installation changed the rejected native inventory');
  const current=await nativeContext(root,env);for(const [key,value]of Object.entries(context))assert.deepEqual(current[key],value,'Rejected host identity changed: '+key);
  stage='owned-node-mode';reportSmokePhase(stage);const node=await exerciseOwnedNode(root);await writeFile(join(directory,'node-mode.json'),JSON.stringify(node)+'\n',{flag:'wx'});
  await step('policy','npm',['run','test:ci-policy'],90);
  await step('native-debian',process.execPath,['--test','scripts/ci-browser-system-linux.test.mjs'],30);
  await step('audit','npm',['audit','--package-lock-only','--include=dev','--include=optional','--audit-level=high','--json'],60);
  const policy=successfulTapSummary(await readFile(join(directory,'policy.log'),'utf8')),debian=successfulTapSummary(await readFile(join(directory,'native-debian.log'),'utf8'));
  assert.equal(JSON.parse(await readFile(join(directory,'audit.log'),'utf8')).metadata.vulnerabilities.total,0);
  await step('locked-chromium','npx',['--no-install','playwright','install','chromium']);
  assert.equal(canonicalNativeInventory(),before,'Rejected native inventory changed before its actual APT oracle');
  const system=join(directory,'native-browser-system');
  await step('native-oracle',process.execPath,['scripts/ci-browser-system.mjs','pack'],300,{...env,CI_BROWSER_SYSTEM_DIR:system,CI_BROWSER_SYSTEM_FORMAT:'3'});
  stage='unchanged-source-family';reportSmokePhase(stage);
  const oracle=JSON.parse(await regular(join(system,'manifest.json'),3*1024*1024));
  validateManifest(oracle,current,before,{format:3,collectorSha256:bindings.collectorSha256,materialSha256:oracle.runtimeMaterial?.materialSha256});
  validateRejectedSourceFamily(oracle.runtimeMaterial,records);
  await writeFile(join(directory,'measurement.json'),JSON.stringify({...trigger,context:current,sourceFamilyEqual:true,
   nativeOracleManifestSha256:cohortDigest(JSON.stringify(oracle)+'\n'),materialSha256:oracle.runtimeMaterial.materialSha256,
   nativePolicy:policy,nativeDebian:debian,auditVulnerabilities:0,actualOwnedNodeModeCorrection:node.actualOwnedNodeModeCorrection,
   materialFiles:oracle.runtimeMaterial.material.files.length,packages:oracle.packages.length})+'\n',{flag:'wx'});
  console.log('Rejected native cohort measured; original route remains failed and production admission remains false.');
 }catch(error){await writeFile(join(directory,'measurement-failure.json'),JSON.stringify({measurementOnly:true,productionAdmission:false,newCertificatePrepared:false,stage,message:String(error.message).slice(0,2000)})+'\n',{flag:'wx'});throw error;}
}

if(process.argv[1]&&resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 try{
  const root=process.cwd(),prepared=await prepare(root,process.env);
  if(!isSupervisedSmokeChild(import.meta.url))process.exitCode=await runSupervisedSmoke({entry:fileURLToPath(import.meta.url),artifactDirectory:join(prepared.directory,'supervision'),phaseTimeoutMs:315000,totalTimeoutMs:420000});
  else await measure(root,process.env);
 }catch(error){console.error(String(error.message).slice(0,2000));process.exitCode=error.exitCode??1;}
}
