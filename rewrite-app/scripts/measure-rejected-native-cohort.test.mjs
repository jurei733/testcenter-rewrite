import assert from 'node:assert/strict';
import test from 'node:test';
import {spawnSync} from 'node:child_process';
import {mkdtemp,readFile,rm,access} from 'node:fs/promises';
import {join} from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {parse} from 'yaml';
import {cohortDigest} from './ci-browser-cohort-certificates.mjs';
import {canonicalMaterial} from './ci-browser-material-contract.mjs';
import {qualifiedNativeCohortFixture,qualifiedLockCohortFixture} from './qualified-native-cohort-fixture.mjs';
import {validateRejectedNativeInputs,validateRejectedSourceFamily,successfulTapSummary,executeRejectedMeasurementStep,publicRejectedMirrorProfile} from './measure-rejected-native-cohort.mjs';

const root=fileURLToPath(new URL('../',import.meta.url)),historical=await qualifiedNativeCohortFixture(),known=await qualifiedLockCohortFixture();
const older=historical.registry.records[0],before=older.nativeOracle.beforeInventory;
const context={...older.nativeOracle.context,lockSha256:known.bindings.lockSha256};
const mismatch={version:1,actual:cohortDigest(before),expected:cohortDigest(known.registry.records[0].nativeOracle.beforeInventory)};

test('an actually measured historical inventory can be eligible only for evidence collection, never certificate admission',()=>{
 const result=validateRejectedNativeInputs(context,before,mismatch,known.registry.records,known.bindings);
 assert.equal(result.measurementOnly,true);assert.equal(result.productionAdmission,false);assert.equal(result.newCertificatePrepared,false);
 assert.equal(result.beforeInventorySha256,mismatch.actual);assert.equal(result.context.imageVersion,older.id);
});
test('matching or changed inventories, changed locks, invalid hosts and already qualified image labels cannot enter rejection measurement',()=>{
 const call=(c=context,b=before,m=mismatch)=>validateRejectedNativeInputs(c,b,m,known.registry.records,known.bindings);
 assert.throws(()=>call(context,before+'\n'));
 assert.throws(()=>call(context,before,{...mismatch,actual:mismatch.expected}));
 assert.throws(()=>call(context,before,{...mismatch,expected:mismatch.actual}));
 assert.throws(()=>call(context,before,{...mismatch,version:2}));
 assert.throws(()=>call({...context,lockSha256:'0'.repeat(64)}));
 assert.throws(()=>call({...context,imageVersion:known.registry.records[0].id}));
 for(const [key,value]of [['platform','darwin'],['arch','arm64'],['nodeMajor','23'],['imageOS','ubuntu22'],['imageVersion','../unknown']])assert.throws(()=>call({...context,[key]:value}));
});
test('real earlier native files may differ while their exact qualified Source family remains mandatory',()=>{
 assert.notEqual(older.nativeOracle.runtimeMaterial.materialSha256,known.registry.records[0].nativeOracle.runtimeMaterial.materialSha256);
 assert.equal(validateRejectedSourceFamily(older.nativeOracle.runtimeMaterial,known.registry.records),older.nativeOracle.runtimeMaterial);
});
test('re-sealed Source pixel, font, browser, Node, collector, screen and Source revisions remain rejected',()=>{
 for(const change of [p=>p.material.views[0].pixelSha256='a'.repeat(64),p=>p.material.fontCatalogSha256='b'.repeat(64),
  p=>p.material.browserVersion='999.0.0.0',p=>p.material.nodeVersion='v22.23.5',p=>p.material.scriptSha256='c'.repeat(64),
  p=>p.material.screen.width++,p=>p.material.source.commit='d'.repeat(40)]){
  const profile=structuredClone(older.nativeOracle.runtimeMaterial);change(profile);profile.materialSha256=cohortDigest(canonicalMaterial(profile.material));
  assert.throws(()=>validateRejectedSourceFamily(profile,known.registry.records));
 }
});
test('partial, skipped, failed, duplicate or absent TAP summaries cannot become native qualification receipts',()=>{
 const good='# tests 4\n# pass 4\n# fail 0\n# cancelled 0\n# skipped 0\n# todo 0\n';assert.equal(successfulTapSummary(good).pass,4);
 for(const bad of ['',good+good,good.replace('# pass 4','# pass 3'),...['fail','cancelled','skipped','todo'].map(key=>good.replace('# '+key+' 0','# '+key+' 1'))])assert.throws(()=>successfulTapSummary(bad));
});
test('public mirror evidence preserves permitted Ubuntu identities without changing sources or granting admission',()=>{
 const source='# public runner profile\nhttp://us-east-1.ec2.archive.ubuntu.com/ubuntu/ priority:1\nhttps://archive.ubuntu.com/ubuntu/ priority:2\nhttps://security.ubuntu.com/ubuntu/ priority:3\n';
 const profile=publicRejectedMirrorProfile(source);assert.equal(profile.sourceSha256,cohortDigest(source));assert.equal(profile.changesMade,false);
 assert.deepEqual(profile.rows.map(row=>row.uri),['http://us-east-1.ec2.archive.ubuntu.com/ubuntu/','https://archive.ubuntu.com/ubuntu/','https://security.ubuntu.com/ubuntu/']);
 assert.deepEqual(profile.rows[0].options,[{value:'priority:1'}]);
 assert.equal(publicRejectedMirrorProfile('http://ARCHIVE.ubuntu.com:80/ubuntu priority:1\n').rows[0].uri,'http://ARCHIVE.ubuntu.com:80/ubuntu');
});
test('mirror evidence redacts credential-bearing, query-bearing, foreign or malformed transports and arbitrary options',()=>{
 const secrets=['OWNED_USER','OWNED_PASSWORD','OWNED_QUERY','OWNED_COMMENT','OWNED_OPTION'];
 const source='# OWNED_COMMENT\nhttps://OWNED_USER:OWNED_PASSWORD@archive.ubuntu.com/ubuntu/ priority:1\nhttps://archive.ubuntu.com/ubuntu/?token=OWNED_QUERY priority:2\nhttps://foreign.invalid/ubuntu/ trusted:OWNED_OPTION\nnot-a-url priority:3\n';
 const profile=publicRejectedMirrorProfile(source),encoded=JSON.stringify(profile);assert.ok(profile.rows.every(row=>row.redactedTransport));for(const secret of secrets)assert.equal(encoded.includes(secret),false);
 assert.ok(profile.rows[2].options[0].redacted);assert.throws(()=>publicRejectedMirrorProfile('x'.repeat(16385)));
});
test('the actual diagnostic CLI refuses an external output directory before it can create or modify files',async()=>{
 const directory=await mkdtemp(join(tmpdir(),'owned-rejected-native-'));
 try{
  const outside=join(directory,'outside'),child=spawnSync(process.execPath,[join(root,'scripts/measure-rejected-native-cohort.mjs')],{
   cwd:root,encoding:'utf8',timeout:10000,env:{...process.env,GITHUB_ACTIONS:'true',RUNNER_TEMP:directory,CI_BROWSER_REJECTION_MEASUREMENT_DIR:outside,CI_BROWSER_COHORT_DIAGNOSTIC_DIR:join(directory,'browser-cohort')}});
  assert.equal(child.status,1,child.stderr);assert.match(child.stderr,/Only the owned rejection directory/);await assert.rejects(access(outside),{code:'ENOENT'});
 }finally{await rm(directory,{recursive:true,force:true});}
});
test('the actual failure-only action preserves every previously qualified runtime step, field and gate',async()=>{
 const bytes=await readFile(new URL('./fixtures/qualified-runtime-action-7e40cc2e.yml',import.meta.url));
 assert.equal(cohortDigest(bytes),'d27b0048793092c12057062f2af9e26f2ae1fdddb6366122ee1cb1264559910d');
 const prior=parse(bytes.toString()),current=parse(await readFile(new URL('../../.github/actions/rewrite-runtime/action.yml',import.meta.url),'utf8'));
 const names=['Measure the actual rejected native cohort without granting admission','Retain actual rejected-cohort measurements without granting admission'];
 const added=current.runs.steps.filter(step=>names.includes(step.name));assert.equal(added.length,2);
 assert.ok(current.runs.steps.findIndex(step=>step.name==='Retain rejected initial package inventory')<current.runs.steps.findIndex(step=>step.name===names[0]),'The original inventory must be retained before any long-running measurement');
 const unchanged={...current,runs:{...current.runs,steps:current.runs.steps.filter(step=>!names.includes(step.name))}};assert.deepEqual(unchanged,prior);
 assert.equal(added[0].if,"failure() && !cancelled() && inputs.playwright == 'true' && inputs.browser-system-certified-cohorts == 'true' && steps.browser-route.outcome == 'failure'");
 assert.equal(added[1].if,"always() && inputs.playwright == 'true' && inputs.browser-system-certified-cohorts == 'true' && steps.browser-route.outcome == 'failure'");
 assert.ok(added.every(step=>step['continue-on-error']===undefined));
 assert.equal(added[0].run,'node scripts/measure-rejected-native-cohort.mjs');
 assert.deepEqual(added[1].with.path.trim().split('\n'),['*.json','*.log','supervision/','native-browser-system/','browser-material-*/'].map(path=>'${{ runner.temp }}/rejected-native-measurement/'+path));
 assert.ok(added[1].with.name.endsWith('-${{ github.run_attempt }}'));assert.equal(added[1].with.overwrite,undefined);
});
test('actual native measurement commands preserve exit status and GNU timeout terminates a child ignoring TERM',
 {skip:process.platform!=='linux',timeout:25000},async()=>{
  await assert.rejects(executeRejectedMeasurementStep(root,process.execPath,['-e','process.exit(37)'],1),error=>error.code===37);
  const started=Date.now();await assert.rejects(executeRejectedMeasurementStep(root,process.execPath,['-e','process.on("SIGTERM",()=>{});setInterval(()=>{},1000)'],1),error=>[124,137].includes(error.code)||error.signal==='SIGKILL');
  assert.ok(Date.now()-started<22000);
});
