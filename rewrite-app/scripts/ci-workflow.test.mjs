import assert from "node:assert/strict";
import {createHash} from "node:crypto";
import { readFileSync, mkdtempSync, mkdirSync, writeFileSync, chmodSync, rmSync } from "node:fs";
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from "node:test";
import { spawnSync } from "node:child_process";
import { parse } from "yaml";

const read = path => readFileSync(new URL(path, import.meta.url), "utf8");
const workflow = parse(read("../../.github/workflows/rewrite-app-ci.yml"));
const action = parse(read("../../.github/actions/rewrite-runtime/action.yml"));
const scripts = JSON.parse(read("../package.json")).scripts;
const baseline = JSON.parse(read("./fixtures/ci-coverage-baseline.json"));
const actionVersions = JSON.parse(read("./fixtures/ci-action-versions.json"));
const qualificationTiers = ['quick-extended-long','quick-extended'].map(id => workflow.jobs[id]);
const qualificationRows = qualificationTiers.flatMap(job => job.strategy.matrix.include);
test('optional package/browser cache segments are bounded at every actual owner without weakening qualification',()=>{
 const users=[...Object.values(workflow.jobs).flatMap(job=>job.steps??[]),...action.runs.steps]
  .filter(step=>/^actions\/(setup-node|cache)@/.test(step.uses??''));
 assert.equal(users.length,7);
 for(const step of users){
  assert.deepEqual(step.env,{SEGMENT_DOWNLOAD_TIMEOUT_MINS:'1'});
  assert.equal(step['continue-on-error'],undefined);
  if(step.uses.startsWith('actions/setup-node@'))assert.equal(step.with['node-version-file'],'.node-version');
 }
 assert.ok(scripts['test:browser-capture:built'].split(/\s+/).includes('scripts/starter-scroll-ready.test.mjs'));
 const driver=read('./reference-original-starter-asset-viewports.mjs');
 assert.ok(driver.includes('waitForStarterScrollReadiness(page,'));
 assert.ok(driver.indexOf('imageFacts.push')<driver.indexOf('scrollReady=await waitForStarterScrollReadiness'));
 const consoleDriver=read('./smoke-participant-console-loading.mjs');
 assert.ok(consoleDriver.includes('loadingRoutes.route("**/current-state?*"'));
 assert.ok(consoleDriver.includes('"loading-release-current-view-routes",()=>loadingRoutes.drain()'));
 assert.ok(!consoleDriver.includes('loadingPage.unrouteAll('));
});
test('manual service feedback retains full selected suites, a fresh core build and the full security gate',()=>{
 const focused=parse(read('../../.github/workflows/rewrite-service-focus.yml'));
 assert.deepEqual(Object.keys(focused.on).sort(),['workflow_call','workflow_dispatch']);
 assert.deepEqual(focused.permissions,{contents:'read'});
 assert.deepEqual(Object.keys(focused.jobs),['focused-service']);
 const job=focused.jobs['focused-service'];
 assert.equal(job['runs-on'],'ubuntu-24.04');assert.equal(job['timeout-minutes'],15);
 assert.equal(job.env.FIRST_SLICE_STORE,'postgres');
 assert.equal(job.env.FIRST_SLICE_POSTGRES_URL,workflow.jobs['verify-postgres'].env.FIRST_SLICE_POSTGRES_URL);
 assert.deepEqual(job.services,workflow.jobs['verify-postgres'].services);
 const checkout=job.steps.find(step=>step.uses?.startsWith('actions/checkout@'));
 assert.equal(checkout.uses,`actions/checkout@${actionVersions.checkout.sha}`);
 assert.equal(checkout.with['persist-credentials'],false);
 const setup=job.steps.findIndex(step=>step.uses==='./.github/actions/rewrite-runtime');
 assert.equal(job.steps[setup].with,undefined,'fresh checkout and locked installation; no output reuse');
 const validate=job.steps.findIndex(step=>step.name==='Validate the selected service before installing dependencies');
 assert.ok(validate<setup);
 assert.equal(job.env.FOCUS_CHECK,'${{ inputs.check }}');
 assert.equal(job.steps.at(-1).run,'npm run ci:focus -- "$FOCUS_CHECK"');
 assert.equal(job.steps.at(-3).run,'npm audit --package-lock-only --include=dev --include=optional --audit-level=high');
 assert.equal(job.steps.at(-2).run,'npm run test:ci-policy');
 assert.ok(!job.steps.some(step=>step['continue-on-error']||/upload-artifact|download-artifact/.test(step.uses??'')));
 assert.notEqual(job['continue-on-error'],true);
 assert.match(focused.name,/not acceptance/);assert.match(job.name,/not complete acceptance/);
});
test('the actual service input validator rejects broader suites and shell payloads without evaluating or printing them',()=>{
 const focused=parse(read('../../.github/workflows/rewrite-service-focus.yml'));
 const command=focused.jobs['focused-service'].steps.find(step=>step.name==='Validate the selected service before installing dependencies').run;
 const match=/^node -e '([^']+)'$/.exec(command);assert.ok(match);
 const allowed=focused.on.workflow_dispatch.inputs.check.options;
 assert.deepEqual(allowed,['participant-auth','original-results','original-commands','system-check-reports']);
 for(const check of [...allowed,'unit','original-login','--list','participant-auth original-results','participant-auth; echo owned','$(echo owned)','']){
  const child=spawnSync(process.execPath,['-e',match[1]],{encoding:'utf8',env:{...process.env,FOCUS_CHECK:check}});
  assert.equal(child.status,allowed.includes(check)?0:2,check);assert.equal(child.stdout,'');assert.equal(child.stderr,'');
 }
});
test('dependency audit skips installation while preserving the complete locked graph and high-severity gate',()=>{
 const audit=workflow.jobs.dependencies;
 assert.ok(!audit.steps.some(step=>step.uses==='./.github/actions/rewrite-runtime'||/npm (?:ci|install|update)|audit fix|--force|--omit/.test(step.run??'')));
 const setup=audit.steps.find(step=>step.uses?.startsWith('actions/setup-node@'));
 assert.equal(setup.with['node-version-file'],'.node-version');assert.equal(setup.with['package-manager-cache'],false);
 const check=audit.steps.find(step=>step.run?.startsWith('npm audit '));
 assert.equal(check['working-directory'],'rewrite-app');
 assert.equal(check.run,'npm audit --package-lock-only --include=dev --include=optional --audit-level=high');
 assert.notEqual(check['continue-on-error'],true);assert.notEqual(audit['continue-on-error'],true);
 assert.ok(workflow.jobs['verify-postgres'].needs.includes('dependencies'));
 assert.ok(action.runs.steps.some(step=>step.run==='npm ci --no-audit --no-fund'));
});
test('every actual browser consumer waits for the authenticated same-run package producer',()=>{
 const consumers=Object.entries(workflow.jobs).filter(([,job])=>job.steps?.some(step=>
  step.uses==='./.github/actions/rewrite-runtime' && step.with?.playwright && step.with.playwright!=='false'));
 assert.deepEqual(consumers.map(([name])=>name).sort(),['original-browser-reference','native-monitor-visual','native-login-visual','quick','quick-extended-long','quick-extended','verify-long-ui','verify-memory-sqlite','verify-postgres-ui'].sort());
 for(const [name,job]of consumers)assert.ok(job.needs.includes('browser-system-dependencies'),name);
 const download=action.runs.steps.find(step=>step.name==='Restore authenticated same-run browser system packages');
 assert.equal(download.if,"inputs.playwright == 'true' && steps.browser-route.outputs.route != 'certified'");assert.equal(download.with.name,'browser-system-${{ github.sha }}-${{ inputs.browser-system-attempt }}');
 assert.equal(download.with['digest-mismatch'],'error');assert.equal(download.with['run-id'],undefined);assert.equal(download.with['github-token'],undefined);
 const restore=action.runs.steps.find(step=>step.name==='Verify and install browser system packages offline');
 assert.equal(restore.if,download.if);assert.equal(restore.env.CI_BROWSER_SYSTEM_DIR,download.with.path);
 assert.equal(restore.run,'timeout --signal=TERM --kill-after=15s 5m node scripts/ci-browser-system.mjs restore');
 assert.ok(action.runs.steps.indexOf(download)<action.runs.steps.indexOf(restore));
 const v3=action.runs.steps.find(step=>step.name==='Download locked Chromium before v3 runtime verification');
 const legacy=action.runs.steps.find(step=>step.run?.includes('playwright install')&&step.if==="inputs.playwright == 'true' && inputs.browser-system-profile-format == '2'");
 assert.ok(action.runs.steps.indexOf(download)<action.runs.steps.indexOf(v3));
 assert.ok(action.runs.steps.indexOf(v3)<action.runs.steps.indexOf(restore));
 assert.ok(action.runs.steps.indexOf(restore)<action.runs.steps.indexOf(legacy));
 assert.equal(v3.if,"inputs.playwright == 'true' && inputs.browser-system-profile-format == '3'");
 assert.equal(restore.env.CI_BROWSER_SYSTEM_FORMAT,'${{ inputs.browser-system-profile-format }}');
 assert.equal(restore.env.CI_BROWSER_SYSTEM_EXPECTED_IMAGE_VERSION,'${{ inputs.browser-system-image-version }}');
 assert.equal(restore.env.CI_BROWSER_SYSTEM_EXPECTED_MATERIAL_SHA256,'${{ inputs.browser-system-material-sha256 }}');
 assert.ok(!action.runs.steps.some(step=>/apt-get|--with-deps|\/etc\/apt|sudo/.test(step.run??'')));
});
test('legacy incompatible cohorts and malformed v3 metadata fail before setup while v3 requires later material verification',()=>{
 const first=action.runs.steps[0];
 assert.equal(first.name,'Validate browser producer metadata before installation');
 assert.equal(first.if,"inputs.playwright == 'true'");
 assert.equal(first['working-directory'],'${{ github.workspace }}');
 assert.equal(first.env.CI_BROWSER_SYSTEM_EXPECTED_IMAGE_VERSION,'${{ inputs.browser-system-image-version }}');
 assert.equal(first.run,'bash rewrite-app/scripts/ci-browser-cohort.sh check');
 assert.equal(action.inputs['browser-system-image-version'].default,'');
 const producer=workflow.jobs['browser-system-dependencies'];
 assert.equal(producer.outputs['image-version'],'${{ steps.cohort.outputs.image-version }}');
 const record=producer.steps.find(step=>step.id==='cohort');
 assert.equal(record.run,'bash scripts/ci-browser-cohort.sh record');
 assert.ok(producer.steps.indexOf(record)<producer.steps.findIndex(step=>step.uses==='./.github/actions/rewrite-runtime'));
 const qualification=workflow.jobs['browser-system-qualification'];
 const check=qualification.steps.find(step=>step.run==='bash scripts/ci-browser-cohort.sh check');
 assert.equal(check.env.CI_BROWSER_SYSTEM_EXPECTED_IMAGE_VERSION,'${{ needs.browser-system-dependencies.outputs.image-version }}');
 assert.ok(qualification.steps.indexOf(check)<qualification.steps.findIndex(step=>step.uses==='./.github/actions/rewrite-runtime'));
});
test('the actual early cohort command rejects the observed rollout and malformed metadata without evaluating or echoing it',()=>{
 const directory=mkdtempSync(join(tmpdir(),'owned-browser-cohort-'));
 try{
  const output=join(directory,'outputs'),canary=join(directory,'executed');writeFileSync(output,'previous=kept\n');
  const env={...process.env,ImageOS:'ubuntu24',ImageVersion:'20261012.334.1',
    CI_BROWSER_SYSTEM_EXPECTED_IMAGE_VERSION:'20261012.334.1',GITHUB_OUTPUT:output};
  const run=(mode,patch={})=>spawnSync('bash',['scripts/ci-browser-cohort.sh',mode],{env:{...env,...patch},encoding:'utf8'});
  assert.equal(run('record').status,0);assert.equal(readFileSync(output,'utf8'),'previous=kept\nimage-version=20261012.334.1\n');
  assert.equal(run('check').status,0);
  const mismatch=run('check',{ImageVersion:'20261023.334.3'});
  assert.equal(mismatch.status,1);assert.match(mismatch.stderr,/producer=20261012\.334\.1 consumer=20261023\.334\.3/);
  for(const bad of ['', '20261012.334.1\n', 'a'.repeat(81), `$(touch ${canary})`, 'https://user:OWNED_SECRET@proxy']){
   for(const key of ['ImageVersion','CI_BROWSER_SYSTEM_EXPECTED_IMAGE_VERSION']){
    const result=run('check',{[key]:bad});assert.equal(result.status,1);assert.ok(!result.stderr.includes('OWNED_SECRET'));
   }
   assert.equal(run('record',{ImageVersion:bad}).status,1);
  }
  for(const ImageOS of ['ubuntu22','', 'ubuntu24\n'])assert.equal(run('check',{ImageOS}).status,1);
  assert.equal(run('check',{CI_BROWSER_SYSTEM_EXPECTED_IMAGE_VERSION:undefined}).status,1);
  assert.equal(run('record',{GITHUB_OUTPUT:''}).status,1);assert.equal(run('unknown').status,1);
  assert.equal(readFileSync(output,'utf8'),'previous=kept\nimage-version=20261012.334.1\n');
  assert.throws(()=>readFileSync(canary),{code:'ENOENT'});
 }finally{rmSync(directory,{recursive:true,force:true});}
});
test('reruns retain exact producer attempts and immutable evidence without a cross-run artifact lookup',()=>{
 for(const id of ['build','browser-system-dependencies','original-reference-build'])
  assert.equal(workflow.jobs[id].outputs.attempt,'${{ github.run_attempt }}');
 for(const [id,job]of Object.entries(workflow.jobs))for(const step of job.steps??[]){
  if(step.uses?.startsWith('actions/upload-artifact@')){
   assert.ok(step.with.name.endsWith('-${{ github.run_attempt }}'),id+': '+step.with.name);
   assert.notEqual(step.with.overwrite,true,'Evidence from earlier attempts must remain immutable.');
  }
  if(step.uses!=='./.github/actions/rewrite-runtime')continue;
  const needs=Array.isArray(job.needs)?job.needs:[job.needs];
  if(step.with?.prebuilt==='true'){
   assert.ok(needs.includes('build'),id);
   assert.equal(step.with['build-attempt'],'${{ needs.build.outputs.attempt }}',id);
  }
  if(step.with?.playwright&&step.with.playwright!=='false'){
   assert.ok(needs.includes('browser-system-dependencies'),id);
   assert.equal(step.with['browser-system-attempt'],'${{ needs.browser-system-dependencies.outputs.attempt }}',id);
   assert.equal(step.with['browser-system-image-version'],'${{ needs.browser-system-dependencies.outputs.image-version }}',id);
  }
 }
 const restore=action.runs.steps.find(step=>step.name==='Verify and install browser system packages offline');
 assert.equal(restore.env.CI_BROWSER_SYSTEM_PRODUCER_ATTEMPT,'${{ inputs.browser-system-attempt }}');
 const direct=workflow.jobs['browser-system-qualification'].steps.find(step=>step.run?.endsWith('ci-browser-system.mjs restore'));
 assert.equal(direct.env.CI_BROWSER_SYSTEM_PRODUCER_ATTEMPT,'${{ needs.browser-system-dependencies.outputs.attempt }}');
 assert.equal(action.inputs['build-attempt'].default,'');
 assert.equal(action.inputs['browser-system-attempt'].default,'');
});
test('the actual browser restore and Chromium commands preserve every nonzero child status',()=>{
 const directory=mkdtempSync(join(tmpdir(),'owned-offline-browser-status-'));
 try{
  writeFileSync(join(directory,'timeout'),'#!/bin/sh\n[ "$1" = --signal=TERM ] && [ "$2" = --kill-after=15s ] && [ "$3" = 5m ] || exit 65\nshift 3\nexec "$@"\n');
  writeFileSync(join(directory,'node'),'#!/bin/sh\n[ "$#" = 2 ] && [ "$1" = scripts/ci-browser-system.mjs ] || exit 65\ncase "$2" in restore|prepare-certified|restore-certified) ;; *) exit 65 ;; esac\n[ "$CI_BROWSER_SYSTEM_DIR" = "$OWNED_PACKAGE_DIRECTORY" ] || exit 66\nexit "$OWNED_STATUS"\n');
  writeFileSync(join(directory,'npx'),'#!/bin/sh\n[ "$#" = 4 ] && [ "$1" = --no-install ] && [ "$2" = playwright ] && [ "$3" = install ] && [ "$4" = chromium ] || exit 65\nexit "$OWNED_STATUS"\n');
  for(const name of ['timeout','node','npx'])chmodSync(join(directory,name),0o755);
  const scripts=action.runs.steps.filter(step=>step.run?.startsWith('timeout '));assert.equal(scripts.length,5);
  for(const step of scripts)for(const status of [0,37,51,100]){
   const result=spawnSync('bash',['--noprofile','--norc','-e','-o','pipefail','-c',step.run],{encoding:'utf8',
    env:{...process.env,PATH:directory+':'+process.env.PATH,CI_BROWSER_SYSTEM_DIR:directory,OWNED_PACKAGE_DIRECTORY:directory,OWNED_STATUS:String(status)}});
   assert.equal(result.status,status,result.stderr);
  }
 }finally{rmSync(directory,{recursive:true,force:true});}
});
test('real Linux supervision terminates a stuck offline restore and Chromium installer',{
 skip:process.platform!=='linux'?'Real GNU timeout qualification requires Linux.':false
},()=>{
 const directory=mkdtempSync(join(tmpdir(),'owned-offline-browser-timeout-'));
 try{
  for(const name of ['node','npx']){
   writeFileSync(join(directory,name),'#!/bin/sh\nexec "$OWNED_NODE" -e \'process.on("SIGTERM",()=>{});setInterval(()=>{},1000)\'\n');chmodSync(join(directory,name),0o755);
  }
  for(const step of action.runs.steps.filter(step=>step.run?.startsWith('timeout '))){
   const result=spawnSync('bash',['-e','-o','pipefail','-c',step.run.replace('--kill-after=15s 5m','--kill-after=0.2s 0.2s')],{
    encoding:'utf8',timeout:5000,env:{...process.env,PATH:directory+':'+process.env.PATH,OWNED_NODE:process.execPath}});
   assert.equal(result.error,undefined);assert.ok([124,137].includes(result.status??(result.signal==='SIGKILL'?137:null)));
  }
 }finally{rmSync(directory,{recursive:true,force:true});}
});
test('same-run browser system qualification is mandatory and retains independent early application feedback',()=>{
  const producer=workflow.jobs['browser-system-dependencies'],consumer=workflow.jobs['browser-system-qualification'];
  assert.equal(producer['runs-on'],'ubuntu-24.04');assert.equal(consumer['runs-on'],'ubuntu-24.04');
  assert.deepEqual(consumer.needs,['build','browser-system-dependencies']);
  assert.ok(producer.steps.some(step=>step.run==='timeout --signal=TERM --kill-after=15s 5m node scripts/ci-browser-system.mjs pack'));
  assert.ok(producer.steps.some(step=>step.run==='node --test scripts/ci-browser-system-linux.test.mjs'));
  assert.ok(consumer.steps.some(step=>step.run==='timeout --signal=TERM --kill-after=15s 5m node scripts/ci-browser-system.mjs restore'));
  assert.ok(consumer.steps.some(step=>step.run==='timeout --signal=TERM --kill-after=15s 5m npx --no-install playwright install chromium'));
  assert.ok(consumer.steps.some(step=>step.run==='xvfb-run --auto-servernum npm run test:browser-capture:built'));
  const upload=producer.steps.find(step=>step.uses?.startsWith('actions/upload-artifact@'));
  const download=consumer.steps.find(step=>step.uses?.startsWith('actions/download-artifact@'));
  assert.equal(upload.with.name,'browser-system-${{ github.sha }}-${{ github.run_attempt }}');assert.equal(upload.with['retention-days'],1);
  assert.equal(download.with.name,'browser-system-${{ github.sha }}-${{ needs.browser-system-dependencies.outputs.attempt }}');assert.equal(download.with['digest-mismatch'],'error');
  assert.equal(download.with['run-id'],undefined);assert.equal(download.with['github-token'],undefined);
  const setup=consumer.steps.find(step=>step.uses==='./.github/actions/rewrite-runtime');
  assert.equal(setup.with.prebuilt,'true');assert.equal(setup.with.playwright,undefined);
  for(const id of ['browser-system-dependencies','browser-system-qualification']){
    assert.ok(workflow.jobs.acceptance.needs.includes(id));assert.ok(!workflow.jobs['fast-feedback'].needs.includes(id));
  }
  assert.ok(scripts['test:ci-policy'].split(/\s+/).includes('scripts/ci-browser-system.test.mjs'));
});
test('workspace file catalog HTTP authorization and projection qualify in unit and real PostgreSQL gates', () => {
  const suite = 'scripts/workspace-file-catalog-api.test.mjs';
  assert.ok(scripts['test:unit:built'].split(/\s+/).includes(suite));
  assert.ok(read('./run-postgres-integration.mjs').includes(JSON.stringify(suite)));
});
test('PostgreSQL test namespace controls are required locally and on the real PostgreSQL runner',()=>{
 const suite='scripts/postgres-test-scope.test.mjs';
 assert.ok(scripts['test:ci-policy'].split(/\s+/).includes(suite));
 const runner=read('./run-postgres-integration.mjs');
 assert.ok(runner.includes(JSON.stringify(suite)));assert.ok(runner.includes('withPostgresTestScope(connectionString,'));
});
test('Original result export iteration retains the complete archive suite in unit and PostgreSQL gates',()=>{
 const suite='scripts/original-result-archive.test.mjs';
 const selectedLocks='scripts/original-monitor-locks.test.mjs';
 assert.ok(scripts['test:unit:built'].split(/\s+/).includes(selectedLocks));
 assert.ok(read('./run-postgres-integration.mjs').includes(JSON.stringify(selectedLocks)));
 assert.ok(scripts['test:participant-auth:built'].split(/\s+/).includes(selectedLocks));
 const monitorFrontend='scripts/original-monitor-frontend-support.test.mjs';
 assert.ok(scripts['test:unit:built'].split(/\s+/).includes(monitorFrontend));
 assert.ok(read('./run-postgres-integration.mjs').includes(JSON.stringify(monitorFrontend)));
 assert.ok(scripts['test:participant-auth:built'].split(/\s+/).includes(monitorFrontend));

 const wire='scripts/original-workspace-report-wire.test.mjs';
 const partTypes='scripts/participant-response-part-types.test.mjs';
 assert.ok(scripts['test:unit:built'].split(/\s+/).includes(partTypes));
 assert.ok(read('./run-postgres-integration.mjs').includes(JSON.stringify(partTypes)));
 assert.ok(scripts['test:original-results:built'].split(/\s+/).includes(partTypes));
 assert.ok(scripts['test:unit:built'].split(/\s+/).includes(wire));
 assert.ok(read('./run-postgres-integration.mjs').includes(JSON.stringify(wire)));
 assert.ok(scripts['test:unit:built'].split(/\s+/).includes('scripts/original-group-results.test.mjs'));
 assert.ok(read('./run-postgres-integration.mjs').includes(JSON.stringify('scripts/original-group-results.test.mjs')));
 assert.ok(scripts['test:unit:built'].split(/\s+/).includes('scripts/original-group-deletion.test.mjs'));
 assert.ok(read('./run-postgres-integration.mjs').includes(JSON.stringify('scripts/original-group-deletion.test.mjs')));
 assert.ok(scripts['test:unit:built'].split(/\s+/).includes(suite));
 assert.ok(read('./run-postgres-integration.mjs').includes(JSON.stringify(suite)));
 assert.equal(scripts['test:original-results'],'npm run build:core && npm run test:original-results:built');
 assert.equal(scripts['test:original-results:built'],'node --test scripts/original-workspace-report-wire.test.mjs '+suite+' scripts/original-group-results.test.mjs scripts/original-group-deletion.test.mjs scripts/original-result-state.test.mjs scripts/participant-response-part-types.test.mjs scripts/original-participant-group.test.mjs scripts/original-login-binding.test.mjs scripts/original-test-identity.test.mjs scripts/original-person-identity.test.mjs scripts/original-person-number.test.mjs scripts/original-login-protocol.test.mjs scripts/original-session.test.mjs scripts/original-test-creation.test.mjs scripts/original-native-command-source.test.mjs scripts/original-command-codec.test.mjs scripts/original-command.test.mjs scripts/original-operational-login.test.mjs scripts/original-monitor-auth.test.mjs scripts/original-monitor-sessions.test.mjs scripts/original-monitor-frontend-support.test.mjs scripts/original-monitor-locks.test.mjs scripts/original-person-content-migration.test.mjs scripts/participant-run-creation-api.test.mjs');
 assert.ok(scripts['test:unit:built'].split(/\s+/).includes('scripts/original-result-state.test.mjs'));
 assert.ok(read('./run-postgres-integration.mjs').includes(JSON.stringify('scripts/original-result-state.test.mjs')));
 assert.ok(scripts['test:unit:built'].split(/\s+/).includes('scripts/original-person-identity.test.mjs'));
 assert.ok(read('./run-postgres-integration.mjs').includes(JSON.stringify('scripts/original-person-identity.test.mjs')));
 assert.ok(scripts['test:unit:built'].split(/\s+/).includes('scripts/original-login-protocol.test.mjs'));
 assert.ok(read('./run-postgres-integration.mjs').includes(JSON.stringify('scripts/original-login-protocol.test.mjs')));
 assert.ok(scripts['test:unit:built'].split(/\s+/).includes('scripts/original-person-content-migration.test.mjs'));
 assert.ok(read('./run-postgres-integration.mjs').includes(JSON.stringify('scripts/original-person-content-migration.test.mjs')));
 assert.ok(scripts['test:unit:built'].split(/\s+/).includes('scripts/original-test-identity.test.mjs'));
 assert.ok(read('./run-postgres-integration.mjs').includes(JSON.stringify('scripts/original-test-identity.test.mjs')));
 assert.ok(scripts['test:unit:built'].split(/\s+/).includes('scripts/original-login-binding.test.mjs'));
 assert.ok(read('./run-postgres-integration.mjs').includes(JSON.stringify('scripts/original-login-binding.test.mjs')));
 assert.ok(scripts['test:unit:built'].split(/\s+/).includes('scripts/original-participant-group.test.mjs'));
 assert.ok(read('./run-postgres-integration.mjs').includes(JSON.stringify('scripts/original-participant-group.test.mjs')));
});
test('complete selected Systemcheck exports qualify in unit and real PostgreSQL groups',()=>{
 const suite='scripts/system-check-report-selection.test.mjs';
 assert.ok(scripts['test:unit:built'].split(/\s+/).includes(suite));
 assert.ok(read('./run-postgres-integration.mjs').includes(JSON.stringify(suite)));
 assert.equal(scripts['test:system-check-reports'],'npm run build:core && npm run test:system-check-reports:built');
 assert.equal(scripts['test:system-check-reports:built'],'node --test '+suite);
});
test('live Source files and their atomic first publication qualify in local and real PostgreSQL gates',()=>{
 for(const suite of ['scripts/workspace-file-publication.test.mjs','scripts/workspace-file-live-runtime.test.mjs']){
  assert.ok(scripts['test:unit:built'].split(/\s+/).includes(suite));
  assert.ok(read('./run-postgres-integration.mjs').includes(JSON.stringify(suite)));
 }
});
test('native tab failures retain only scoped public metadata without private scratch stores or body dumps', () => {
  const upload = workflow.jobs['verify-memory-sqlite'].steps.find(step => step.name === 'Retain scoped native tab failure evidence');
  assert.equal(upload.if, "(failure() || cancelled()) && matrix.check == 'ui-participant-native-routes'");
  assert.equal(upload.with.path, '${{ runner.temp }}/rewrite-ui-artifacts/participant-native-tabs/public-failure.json');
  assert.equal(upload.with['retention-days'], 7);
  assert.ok(scripts['test:ci-policy'].split(/\s+/).includes('scripts/participant-native-tab-evidence.test.mjs'));
});
test("focused asset iteration retains mandatory unit and real PostgreSQL qualification", () => {
  const suites = ["scripts/application-asset-cascade.test.mjs", "scripts/application-asset-cascade-api.test.mjs"];
  const postgres = read("./run-postgres-integration.mjs");
  for (const suite of suites) {
    assert.ok(scripts["test:unit:built"].split(/\s+/).includes(suite));
    assert.ok(postgres.includes(JSON.stringify(suite)));
    assert.ok(scripts["test:application-assets:built"].split(/\s+/).includes(suite));
  }
  assert.equal(scripts["test:application-assets"], "npm run build:core && npm run test:application-assets:built");
  assert.ok(scripts["test:application-assets:built"].includes("scripts/original-settings-controller.test.mjs"));
});
function expand(command, trail = []) {
  return command.replace(/npm run ([\w:-]+)/g, (_, key) => {
    assert.ok(Object.hasOwn(scripts, key), `Missing npm script ${key}`);
    assert.ok(!trail.includes(key), `Recursive script ${key}`);
    return ["build", "build:core"].includes(key) ? "" : expand(scripts[key], [...trail, key]);
  });
}
const matrix = ['verify-long-ui', 'verify-memory-sqlite'].flatMap(id => workflow.jobs[id].strategy.matrix.include);
const commands = Object.values(workflow.jobs).flatMap(job => [
  ...(job.strategy?.matrix?.include ?? []).map(item => item.command).filter(command => typeof command === "string"),
  ...(job.steps ?? []).map(step => step.run).filter(run => typeof run === "string" && run.includes("npm run"))
]);
const leaves = commands.flatMap(command => expand(command.replace(/ 2>&1 \| tee[^\n]+/g, ""))
  .split("&&").map(value => value.trim().replace(/\s+/g, " ")).filter(Boolean));
const environmentPreludes = baseline.additional.flatMap(item => item.leaves).filter(leaf => leaf.endsWith("\\"));
test("Quick logs retain an upstream test failure instead of reporting tee success", () => {
  const step = workflow.jobs.quick.steps.find(step => step.run?.includes("| tee"));
  assert.equal(step.shell, "bash", "GitHub's implicit bash -e shell does not enable pipefail");
  // GitHub's explicit bash shell is bash --noprofile --norc -e -o pipefail.
  // Reproduce a failing test piped through the exact logging command without
  // invoking the full browser suite or depending on its eventual runtime.
  const command = step.run.replace("xvfb-run --auto-servernum ", "")
    .replace('"$RUNNER_TEMP/rewrite-ui-quick.log"', "/dev/null");
  const result = spawnSync("bash", ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", command], { encoding: "utf8", env: {...process.env, CI_BROWSER_COMMAND: "echo owned-failure; exit 37"} });
  assert.equal(result.status, 37); assert.match(result.stdout, /owned-failure/);
  const implicit = spawnSync("bash", ["-e", "-c", command], { encoding: "utf8", env: {...process.env, CI_BROWSER_COMMAND: "echo owned-failure; exit 37"} });
  assert.equal(implicit.status, 0, "The old implicit shell must reproduce the false green");
  const legacy = 'bash --noprofile --norc -e -o pipefail -c "exit 37" 2>&1 | tee /dev/null';
  assert.equal(spawnSync("bash", ["-e", "-c", legacy]).status, 0,
    "An inner pipefail bash cannot fix the historical outer logger pipeline");
  assert.equal(spawnSync("bash", ["-e", "-o", "pipefail", "-c", legacy]).status, 37);
});
test('compound browser gates share one display and preserve either command failure through the actual logger', () => {
  const scratch = mkdtempSync(join(tmpdir(), 'owned-ci-display-'));
  const bin = join(scratch, 'bin'); mkdirSync(bin);
  const xvfb = join(bin, 'xvfb-run'), browser = join(bin, 'owned-browser-command');
  writeFileSync(xvfb, '#!/bin/bash\n[ "$1" = --auto-servernum ] || exit 91\nshift\nexport DISPLAY=:owned-display\nexport OWNED_DISPLAY_OWNER=$$\nexec "$@"\n');
  writeFileSync(browser, '#!/bin/bash\n[ "$DISPLAY" = :owned-display ] && [ -n "$OWNED_DISPLAY_OWNER" ] || exit 92\nprintf "%s %s %s\\n" "$1" "$DISPLAY" "$OWNED_DISPLAY_OWNER"\nif [ "$OWNED_FAIL_STAGE" = "$1" ]; then exit 37; fi\n');
  chmodSync(xvfb, 0o755); chmodSync(browser, 0o755);
  const env = {...process.env, PATH: bin + ':' + process.env.PATH, DISPLAY: '', OWNED_DISPLAY_OWNER: '',
    RUNNER_TEMP: scratch, CI_BROWSER_COMMAND: 'owned-browser-command first && owned-browser-command second'};
  const execute = (command, failed = '', selected = env.CI_BROWSER_COMMAND) => spawnSync('bash', ['--noprofile', '--norc', '-e', '-o', 'pipefail', '-c', command],
    {env: {...env, OWNED_FAIL_STAGE: failed, CI_BROWSER_COMMAND: selected}, encoding: 'utf8'});
  try {
    // The historical shell really runs its successor outside xvfb; reproduce
    // that failure rather than only asserting a workflow string.
    const old = execute('xvfb-run --auto-servernum owned-browser-command first && owned-browser-command second 2>&1 | tee "$RUNNER_TEMP/rewrite-ui-quick.log"');
    assert.equal(old.status, 92); assert.equal(old.stdout.trim().split('\n').length, 1);
    for (const name of ['quick', 'quick-extended-long', 'quick-extended']) {
      const command = workflow.jobs[name].steps.find(step => step.name === 'Run Quick browser gates').run;
      const success = execute(command); assert.equal(success.status, 0, success.stderr);
      const lines = success.stdout.trim().split('\n').map(line => line.split(' '));
      assert.deepEqual(lines.map(line => line[0]), ['first', 'second']);
      assert.deepEqual(lines[0].slice(1), lines[1].slice(1), 'Both commands require the same display owner');
      assert.equal(readFileSync(join(scratch, 'rewrite-ui-quick.log'), 'utf8'), success.stdout);
      const first = execute(command, 'first'); assert.equal(first.status, 37); assert.equal(first.stdout.trim().split('\n').length, 1);
      const second = execute(command, 'second'); assert.equal(second.status, 37); assert.equal(second.stdout.trim().split('\n').length, 2);
      const piped = execute(command, 'first', 'owned-browser-command first | cat && owned-browser-command second');
      assert.equal(piped.status, 37);
    }
  } finally { rmSync(scratch, {recursive: true, force: true}); }
});
test("all 29 browser scenarios run once across fast and extended shards, with complete acceptance requiring both", () => {
  const quick = workflow.jobs.quick;
  const extended = workflow.jobs["quick-extended"];
  const shards = [...quick.strategy.matrix.include, ...qualificationRows];
  assert.equal(quick.strategy["fail-fast"], false);
  assert.equal(extended.strategy["fail-fast"], false);
  assert.equal(extended.strategy["max-parallel"], 8, "Bound the extended group while releasing its measured four-slot tail");
  assert.deepEqual([...new Set(shards.map(item => item.group))], ["entry", "system-check", "participant", "content"]);
  assert.equal(shards.length, 29);
  assert.equal(new Set(shards.map(item => item.check)).size, shards.length);
  const split = command => expand(command).split("&&").map(value => value.trim()).filter(Boolean);
  const complete = split("npm run ci:browser:quick:built");
  const distributed = shards.flatMap(item => split(item.command));
  assert.deepEqual([...distributed].sort(), [...complete].sort());
  assert.equal(new Set(distributed).size, distributed.length, "Quick scenarios must not be duplicated across shards");
  for (const group of ["entry", "system-check", "participant", "content"]) {
    assert.deepEqual(shards.filter(item => item.group === group).flatMap(item => split(item.command)).sort(),
      split(`npm run ci:browser:quick:${group}:built`).sort());
  }
  for (const tier of [quick, ...qualificationTiers]) {
    const execution = tier.steps.find(step => step.run?.includes("| tee"));
    assert.equal(execution.env.CI_BROWSER_COMMAND, '${{ matrix.command }}');
    assert.equal(execution.run, 'xvfb-run --auto-servernum bash --noprofile --norc -e -o pipefail -c "$CI_BROWSER_COMMAND" 2>&1 | tee "$RUNNER_TEMP/rewrite-ui-quick.log"');
    assert.equal(execution.shell, "bash");
    assert.equal(tier.env.UI_SMOKE_HEADFUL, "true", "Source visual measurements use a visible Chromium renderer");
    const log = tier.steps.find(step => step.name === "Retain failed Quick browser log");
    assert.equal(log.if, "failure()"); assert.match(log.with.name, /matrix\.check/);
    const browserArtifacts = execution.env.UI_SMOKE_ARTIFACT_DIR;
    assert.equal(browserArtifacts, "${{ runner.temp }}/rewrite-ui-artifacts");
    assert.ok(log.with.path.includes(browserArtifacts + "/"));
    assert.ok(log.with.path.includes("rewrite-ui-quick.log"));
  }
  assert.ok(workflow.jobs["fast-feedback"].needs.includes("quick"));
  assert.ok(workflow.jobs.acceptance.needs.includes("quick"));
  assert.ok(workflow.jobs.acceptance.needs.includes("quick-extended"));
});
test("the early browser set is bounded and retains real authentication, isolation, Start restoration and Systemcheck", () => {
  assert.deepEqual(workflow.jobs.quick.strategy.matrix.include.map(item=>item.check).sort(),
    ["bug-report","native-monitor","original-login","original-login-protected","original-admin-login","proof-of-work","system-check","participant-variant","ib-player"].sort());
  assert.equal(qualificationRows.length,20);
  assert.equal(workflow.jobs["quick-extended"].strategy.matrix.include.length,19);
  assert.deepEqual(workflow.jobs["quick-extended-long"].strategy.matrix.include.map(row=>row.check),["json-roster"]);
  assert.deepEqual(workflow.jobs["quick-extended"].needs,["build","fast-feedback","browser-system-dependencies"]);
  assert.ok(!workflow.jobs["fast-feedback"].needs.includes("quick-extended"));
});
test("extended dispatch retains the historical four-slot ordering improvement", () => {
  const recorded = JSON.parse(read("./fixtures/ci-browser-timings.json"));
  const extended = workflow.jobs["quick-extended"].strategy;
  const current = qualificationRows.map(item => item.check);
  const weights = recorded.secondsByCheck;
  assert.deepEqual([...current].sort(), Object.keys(weights).sort());
  assert.deepEqual([...recorded.previousOrder].sort(), [...current].sort());
  assert.ok(Object.values(weights).every(value => Number.isInteger(value) && value > 0));
  const duration = order => {
    const slots = Array(4).fill(0); // Historical receipt used four slots, independently of today's limit.
    for (const check of order) slots[slots.indexOf(Math.min(...slots))] += weights[check];
    return Math.max(...slots);
  };
  assert.ok(duration(current) <= duration(recorded.previousOrder) - 300,
    "Keep at least five minutes of the recorded four-slot queue improvement; this is not an actual CI timing guarantee");
});
test('extended capacity covers every measured journey and reduces its isolated queue model', () => {
  const recorded = JSON.parse(read('./fixtures/ci-extended-capacity-timings.json'));
  const strategy = workflow.jobs['quick-extended'].strategy;
  assert.equal(recorded.status, 'completed'); assert.equal(recorded.conclusion, 'success');
  assert.equal(recorded.totalJobs, 89); assert.equal(recorded.successfulJobs, 89);
  assert.equal(recorded.spanSeconds, (Date.parse(recorded.last) - Date.parse(recorded.first)) / 1000);
  assert.ok(recorded.spanSeconds > recorded.baselineSpanSeconds, 'Retain the failed whole-pipeline speed experiment');
  assert.equal(recorded.extendedSlots, 4);
  const weights = new Map(recorded.extendedJobs.map(job => {
    assert.ok(Number.isInteger(job.seconds) && job.seconds > 0);
    assert.equal(job.seconds, (Date.parse(job.completedAt) - Date.parse(job.startedAt)) / 1000);
    return [job.check, job.seconds];
  }));
  const checks = qualificationRows.map(item => item.check);
  assert.equal(weights.size, 20); assert.equal(recorded.extendedJobs.length, 20);
  assert.deepEqual([...weights.keys()].sort(), [...checks].sort());
  const duration = capacity => {
    const slots = Array(capacity).fill(0);
    for (const check of checks) slots[slots.indexOf(Math.min(...slots))] += weights.get(check);
    return Math.max(...slots);
  };
  assert.equal(strategy['max-parallel'], 8);
  assert.ok(duration(strategy['max-parallel']) <= duration(recorded.extendedSlots) - 500,
    'Retain the measured isolated-queue benefit; a fresh complete run must establish actual makespan');
});
test('broad verification dispatches recorded long jobs first without changing coverage or runner limits', () => {
  const recorded = JSON.parse(read('./fixtures/ci-verification-timings.json'));
  const strategy = workflow.jobs['verify-memory-sqlite'].strategy;
  const current = matrix;
  for (const previous of recorded.previousMatrix) {
    assert.deepEqual(current.find(item => item.check === previous.check), previous, 'Preserve every prior command, option and browser requirement');
  }
  assert.equal(strategy['fail-fast'], false);
  assert.equal(strategy['max-parallel'], undefined, 'Do not increase or restrict existing runner capacity');
  const weights = recorded.secondsByCheck;
  assert.deepEqual(Object.keys(weights).sort(), recorded.previousMatrix.map(item => item.check).sort());
  assert.ok(Object.values(weights).every(value => Number.isInteger(value) && value > 0));
  const latest = JSON.parse(read('./fixtures/ci-global-priority-capacity-timings.json'));
  assert.equal(latest.status, 'completed'); assert.equal(latest.conclusion, 'success');
  const latestJobs = latest.rows.filter(job => job.kind === 'broad');
  const latestWeights = Object.fromEntries(latestJobs.map(job => {
    assert.equal(job.seconds, (Date.parse(job.completed) - Date.parse(job.started)) / 1000);
    assert.ok(Number.isInteger(job.seconds) && job.seconds > 0);
    return [job.check, job.seconds];
  }));
  assert.equal(latestJobs.length, Object.keys(latestWeights).length);
  assert.deepEqual(Object.keys(latestWeights).sort(), Object.keys(weights).sort());
  const longestFirst = [...recorded.previousMatrix].sort((a, b) => latestWeights[b.check] - latestWeights[a.check] || a.check.localeCompare(b.check));
  // Keep the historical receipt and its improvement controls below. Refresh
  // dispatch from a separate completed run instead of freezing old durations.
  const measuredCurrent = current.filter(item => Object.hasOwn(weights, item.check));
  assert.deepEqual(measuredCurrent, longestFirst);
  const duration = (order, count) => {
    const slots = Array(count).fill(0);
    for (const item of order) slots[slots.indexOf(Math.min(...slots))] += weights[item.check];
    return Math.max(...slots);
  };
  // A deterministic scheduling model using observed job times, not a claim
  // about GitHub's shared runner availability or actual end-to-end speedup.
  const historical = JSON.parse(read('./fixtures/ci-priority-capacity-timings.json'));
  const historicalWeights = new Map(historical.jobs.map(job=>[job.check,job.seconds]));
  const historicalOrder = [...recorded.previousMatrix].sort((a,b)=>historicalWeights.get(b.check)-historicalWeights.get(a.check)||a.check.localeCompare(b.check));
  for (const count of [15, 16]) {
    assert.ok(duration(historicalOrder, count) <= duration(recorded.previousMatrix, count) - 300);
  }
});
test('the early long tier preserves exact workloads and browser mode behind every technical/security prerequisite', () => {
  const early = workflow.jobs['verify-long-ui'], later = workflow.jobs['verify-memory-sqlite'];
  const receipt = JSON.parse(read('./fixtures/ci-long-ui-timings.json'));
  assert.equal(receipt.status, 'completed'); assert.equal(receipt.conclusion, 'success');
  assert.equal(receipt.jobs.length, 40); assert.equal(receipt.thresholdSeconds, 700);
  const measured = receipt.jobs.filter(job => {
    assert.equal(job.seconds, (Date.parse(job.completed) - Date.parse(job.started)) / 1000);
    return job.seconds >= receipt.thresholdSeconds;
  }).map(job => job.check).sort();
  assert.equal(measured.length, 14);
  const priority = JSON.parse(read('./fixtures/ci-priority-capacity-timings.json'));
  assert.equal(priority.status, 'completed'); assert.equal(priority.conclusion, 'success');
  const weights = new Map(priority.jobs.map(job => [job.check,job.seconds]));
  assert.equal(weights.size,40);
  const global = JSON.parse(read('./fixtures/ci-global-priority-capacity-timings.json'));
  const selected = global.selected.filter(key=>key.startsWith('broad/')).map(key=>key.slice('broad/'.length));
  assert.equal(selected.length,11); assert.ok(selected.every(check=>measured.includes(check)));
  assert.deepEqual(early.strategy.matrix.include.map(item => item.check), selected);
  assert.equal(later.strategy.matrix.include.length, 29);
  assert.equal(matrix.length, new Set(matrix.map(item => item.check)).size);
  assert.deepEqual(matrix.map(item => item.check).sort(), receipt.jobs.map(item => item.check).sort());
  assert.deepEqual(early.needs, ['build','typecheck','dependencies','unit','browser-system-dependencies']);
  assert.equal(early.if, undefined, 'Failed technical prerequisites must skip the early workload.');
  assert.equal(early.strategy['fail-fast'], false); assert.equal(early.strategy['max-parallel'], undefined);
  for (const key of ['name','runs-on','timeout-minutes','defaults','env','permissions'])
    assert.deepEqual(early[key], later[key], key + ' must preserve the prior execution context');
  const excluded = ['Retain failed console loading evidence','Retain failed console debug evidence',
    'Retain scoped native tab failure evidence','Retain failed controller timer diagnostics'];
  assert.deepEqual(early.steps, later.steps.filter(step => !excluded.includes(step.name)));
  assert.ok(early.strategy.matrix.include.every(item => item.playwright === true));
  for (const check of ['ui-participant-console','ui-console-debug','ui-participant-native-routes','ui-controller-timer'])
    assert.ok(later.strategy.matrix.include.some(item => item.check === check),
      'Keep suites with specialized diagnostics in their existing owner until those artifacts move too.');
  const ancestors = new Set();
  const visit = id => { for(const need of [workflow.jobs[id].needs ?? []].flat())
    if(!ancestors.has(need)){ ancestors.add(need); visit(need); } };
  visit('verify-long-ui');
  assert.ok(!ancestors.has('quick') && !ancestors.has('fast-feedback'), 'Long tests consume no short-browser result.');
  assert.ok(workflow.jobs.acceptance.needs.includes('quick'));
  assert.ok(workflow.jobs.acceptance.needs.includes('quick-extended'));
  assert.ok(workflow.jobs.acceptance.needs.includes('verify-long-ui'));
  assert.ok(workflow.jobs.acceptance.needs.includes('verify-memory-sqlite'));
});
test('global early eligibility uses the complete accepted 60-row observation without changing any workload or other execution context',()=>{
 const data=JSON.parse(read('./fixtures/ci-global-priority-capacity-timings.json'));
 assert.equal(data.run,40600025889);assert.equal(data.head,'f88f67e956f0c984eabfc524c2bed1738afb9faf');
 assert.equal(data.tree,'35feddb124b910040a8ce41a12ad9da22193c89f');assert.equal(data.merge,'be3039911a3a668b900eafe6b66adbb6204bac66');
 assert.equal(data.status,'completed');assert.equal(data.conclusion,'success');
 assert.equal(data.totalJobs,89);assert.equal(data.successfulJobs,89);assert.equal(data.SourceTasks,24);
 assert.equal(data.wholeRunSeconds,(Date.parse(data.completed)-Date.parse(data.started))/1000);
 assert.equal(data.allJobs.length,89);assert.equal(new Set(data.allJobs.map(job=>job.id)).size,89);
 assert.ok(data.allJobs.every(job=>job.conclusion==='success'));
 const records=[...matrix.map(row=>({kind:'broad',row})),...qualificationRows.map(row=>({kind:'extended',row}))];
 assert.equal(records.length,60);assert.equal(data.rows.length,60);
 const observed=new Map(data.rows.map(row=>[row.key,row]));assert.equal(observed.size,60);
 for(const{kind,row}of records){
  const measurement=observed.get(kind+'/'+row.check);assert.ok(measurement);assert.deepEqual(row,measurement.row);
  assert.equal(measurement.seconds,(Date.parse(measurement.completed)-Date.parse(measurement.started))/1000);
  assert.ok(measurement.seconds>0&&measurement.commandSeconds>0&&measurement.commandSeconds<=measurement.seconds);
  const job=data.allJobs.find(job=>job.id===measurement.jobId);assert.ok(job);assert.equal(job.name,measurement.name);
  assert.equal(job.started,measurement.started);assert.equal(job.completed,measurement.completed);
 }
 const selected=[...data.rows].sort((a,b)=>b.seconds-a.seconds||a.key.localeCompare(b.key)).slice(0,12).map(row=>row.key);
 assert.deepEqual(data.selected,selected);
 const broadEarly=workflow.jobs['verify-long-ui'],qualificationEarly=workflow.jobs['quick-extended-long'];
 const actual=[...broadEarly.strategy.matrix.include.map(row=>'broad/'+row.check),...qualificationEarly.strategy.matrix.include.map(row=>'extended/'+row.check)];
 assert.deepEqual([...actual].sort(),[...selected].sort());assert.equal(actual.length,12);
 assert.deepEqual(data.promoted,['broad/ui-participant-detail-review','extended/json-roster','broad/ui-review-readiness']);
 assert.deepEqual(data.deferred.sort(),['broad/ui-monitor-bulk','broad/ui-monitor-detail-review','broad/ui-monitor-review']);
 assert.ok(Math.min(...data.promoted.map(key=>observed.get(key).seconds))>Math.max(...data.deferred.map(key=>observed.get(key).seconds)));
 assert.ok(data.promoted.every(key=>observed.get(key).startAfterRunSeconds>=1000&&observed.get(key).commandSeconds>=700),
  'Preserve the actual late start and long command evidence rather than calling these short journeys.');
 assert.deepEqual(data.model,{earlyTotal:12,earlyBroad:11,earlyExtended:1,observedRunnerCapacity:20,SourceFamilies:5,databaseApi:1,databaseBrowser:1,checkpointSlots:1,lateQualificationLimit:8});
 assert.equal(actual.length+data.model.SourceFamilies+data.model.databaseApi+data.model.databaseBrowser+data.model.checkpointSlots,20);
 assert.equal(workflow.jobs['original-browser-reference'].strategy.matrix.family.length,5);
 assert.equal(workflow.jobs['quick-extended'].strategy['max-parallel'],8);
 const instances=Object.values(workflow.jobs).reduce((n,job)=>{const matrix=job.strategy?.matrix;return n+(matrix?.include?.length??Object.values(matrix??{}).reduce((product,axis)=>product*axis.length,1));},0);assert.equal(instances,120); // Keep all 90 prior jobs, ten Monitor states, and twenty native login state/root pairs.
 assert.deepEqual(qualificationEarly.needs,broadEarly.needs);
 assert.deepEqual(qualificationEarly.needs,['build','typecheck','dependencies','unit','browser-system-dependencies']);
 const ancestors=new Set();const visit=id=>{for(const need of[workflow.jobs[id].needs??[]].flat())if(!ancestors.has(need)){ancestors.add(need);visit(need);}};visit('quick-extended-long');
 assert.equal(ancestors.has('quick'),false);assert.equal(ancestors.has('fast-feedback'),false);
 assert.ok(workflow.jobs.acceptance.needs.includes('quick-extended-long'));assert.equal(qualificationEarly.if,undefined);
 const unchanged=structuredClone(workflow);delete unchanged.jobs['quick-extended-long'];
 assert.ok(unchanged.jobs['native-monitor-visual']);delete unchanged.jobs['native-monitor-visual'];
 assert.ok(unchanged.jobs['native-login-visual']);delete unchanged.jobs['native-login-visual'];
 assert.deepEqual(unchanged.jobs.quick.strategy.matrix.include.filter(row=>row.check==='native-monitor'),[{check:'native-monitor',group:'entry',command:'npm run smoke:ui:native-monitor:built'}]);
 unchanged.jobs.quick.strategy.matrix.include=unchanged.jobs.quick.strategy.matrix.include.filter(row=>row.check!=='native-monitor');
 for(const id of['verify-long-ui','verify-memory-sqlite','quick-extended'])unchanged.jobs[id].strategy.matrix.include=[];
 unchanged.jobs.acceptance.needs=unchanged.jobs.acceptance.needs.filter(id=>!['quick-extended-long','native-monitor-visual','native-login-visual'].includes(id));
 assert.equal(createHash('sha256').update(JSON.stringify(unchanged)).digest('hex'),data.baselineContextSha256,
  'Only the three recorded matrix partitions, their early owner and acceptance edge, plus the explicitly checked native Quick and full-viewport Monitor/login gates may change.');
 const clone=structuredClone(qualificationEarly),later=workflow.jobs['quick-extended'];
 clone.needs=later.needs;clone.strategy.matrix.include=later.strategy.matrix.include;
 assert.deepEqual(clone,later,'The promoted qualification retains its complete prior shell, artifact ownership, browser mode and execution context.');
});
test('historical deferral receipts stay truthful while the PostgreSQL browser and global early tier retain every technical gate',()=>{
 const data=JSON.parse(read('./fixtures/ci-priority-capacity-timings.json'));
 assert.equal(data.totalJobs,89);assert.equal(data.successfulJobs,89);assert.equal(data.wholeRunSeconds,2271);
 assert.equal(data.run,40317717809);assert.equal(data.conclusion,'success');
 assert.equal(data.jobs.length,40);
 const weights=new Map(data.jobs.map(job=>{
  assert.equal(job.seconds,(Date.parse(job.completed)-Date.parse(job.started))/1000);
  assert.ok(Number.isInteger(job.seconds)&&job.seconds>0);return[job.check,job.seconds];
 }));
 assert.equal(weights.size,40);
 const early=workflow.jobs['verify-long-ui'],later=workflow.jobs['verify-memory-sqlite'],pg=workflow.jobs['verify-postgres-ui'];
 const prior=JSON.parse(read('./fixtures/ci-long-ui-timings.json')).jobs.filter(job=>job.seconds>=700).map(job=>job.check);
 const selected=[...prior].sort((a,b)=>weights.get(b)-weights.get(a)||a.localeCompare(b)).slice(0,data.proposedModel.earlyJourneyCount);
 const deferred=prior.filter(check=>!selected.includes(check));
 assert.deepEqual(deferred.sort(),['ui-participant-detail-review','ui-review-readiness']);
 assert.ok(deferred.every(check=>matrix.some(row=>row.check===check)));
 const actualEarlyCount=early.strategy.matrix.include.length+workflow.jobs['quick-extended-long'].strategy.matrix.include.length;
 assert.equal(actualEarlyCount,12);
 assert.deepEqual(pg.needs,early.needs);assert.equal(pg.if,undefined);
 assert.equal(pg.services.postgres.image,workflow.jobs['verify-postgres'].services.postgres.image);
 assert.equal(pg['timeout-minutes'],30);assert.ok(workflow.jobs.acceptance.needs.includes('verify-postgres-ui'));
 const ancestors=new Set();const visit=id=>{for(const need of[workflow.jobs[id].needs??[]].flat())if(!ancestors.has(need)){ancestors.add(need);visit(need);}};visit('verify-postgres-ui');
 for(const id of['build','typecheck','dependencies','unit','browser-system-dependencies'])assert.ok(ancestors.has(id));
 for(const id of['quick','fast-feedback'])assert.equal(ancestors.has(id),false);
 const model=data.proposedModel;
 assert.deepEqual(model,{earlyJourneyCount:12,observedRunnerCapacityModel:20,SourceFamilies:5,earlyDatabaseApiJobs:1,earlyDatabaseBrowserJobs:1});
 assert.equal(workflow.jobs['original-browser-reference'].strategy.matrix.family.length,model.SourceFamilies);
 assert.equal(actualEarlyCount+model.SourceFamilies+model.earlyDatabaseApiJobs+model.earlyDatabaseBrowserJobs,model.observedRunnerCapacityModel-1,
  'The observed capacity model leaves a checkpoint slot once short prerequisites finish; not a hosted queue guarantee.');
 assert.deepEqual(data.technical.map(row=>row.name).sort(),['Shared production build','verify-memory-sqlite (typecheck)','Dependency audit','verify-memory-sqlite (unit)','Authenticated browser system packages'].sort());
 assert.deepEqual(data.completedBeforeFeedback.map(row=>row.name).sort(),['Offline browser system qualification','Docker image runtime smoke'].sort());
 const ready=Math.max(...data.technical.map(row=>Date.parse(row.completed))),lag=(Date.parse(data.fastFeedbackCompleted)-ready)/1000;
 assert.ok(lag>0);assert.ok(data.completedBeforeFeedback.every(row=>Date.parse(row.completed)<=Date.parse(data.fastFeedbackCompleted)));
 assert.equal(data.postgresUi.seconds,(Date.parse(data.postgresUi.completed)-Date.parse(data.postgresUi.started))/1000);
 const previous=Math.max(...prior.map(check=>weights.get(check)),lag+data.postgresUi.seconds);
 const proposed=Math.max(...selected.map(check=>weights.get(check)),...deferred.map(check=>lag+weights.get(check)),data.postgresUi.seconds);
 assert.ok(proposed<=previous-120,'Keep the isolated measured priority benefit without asserting actual CI acceleration.');
 const rejected=data.rejectedRunObservation;assert.equal(rejected.conclusion,'failure');assert.equal(rejected.validSpeedBenchmark,false);
 assert.equal(rejected.fastFeedbackRunnerWaitSeconds,42);assert.equal(rejected.postgresUiWaitAfterFeedbackSeconds,252);
});
test("a green early checkpoint cannot certify missing, cancelled or failed extended qualification", () => {
  const gate = workflow.jobs.acceptance;
  const results = Object.fromEntries(gate.needs.map(name=>[name,{result:"success"}]));
  const execute = values => spawnSync("bash",["-e","-o","pipefail","-c",gate.steps[0].run],{
    encoding:"utf8",env:{...process.env,RESULTS:JSON.stringify(values)}
  });
  assert.equal(execute(results).status,0);
  for (const id of ['quick-extended-long', 'quick-extended', 'verify-long-ui', 'verify-memory-sqlite'])
    for (const result of ["skipped","cancelled","failure"]) {
      const outcome=execute({...results,[id]:{result}});
      assert.equal(outcome.status,1); assert.match(outcome.stderr,new RegExp(`${id}: ${result}`));
    }
});
function extendsExplicitTestFiles(previous, current) {
  const files = command => {
    if (!command.startsWith("node --test ")) return null;
    const paths = command.slice("node --test ".length).split(" ");
    return paths.length && paths.every(path => /^[\w./*-]+\.test\.(?:mjs|cjs|js)$/.test(path)) ? paths : null;
  };
  const before = files(previous), after = files(current);
  return Boolean(before && after && before.every(path => after.includes(path)));
}
for (const item of [...baseline.commands, ...baseline.additional]) test(`the complete prior ${item.check} qualification is retained`, () => {
  for (const leaf of item.leaves) {
    // Removing the first build leaves an environment-only prelude in the old
    // expansion. It still wraps the complete new npm child, so check the exact
    // prelude separately instead of mistaking it for an executable test.
    const retainedPrelude = leaf.endsWith("\\") && commands.some(command => command.replace(/\s+/g, " ").includes(leaf));
    const attachedPrelude = leaves.some(value => value.endsWith(leaf) &&
      environmentPreludes.includes(value.slice(0, -leaf.length).trim()));
    const expandedFiles = leaves.some(value => extendsExplicitTestFiles(leaf, value));
    // Keep the immutable baseline's complete development build. Only relocate
    // its output so type checking cannot overwrite a production browser input.
    const isolatedDevelopmentBuild = leaf === 'ng build rewrite-app-web --configuration development' &&
      leaves.includes(leaf + ' --output-path dist/typecheck-development');
    assert.ok(leaves.includes(leaf) || retainedPrelude || attachedPrelude || expandedFiles || isolatedDevelopmentBuild, `Lost qualification: ${leaf}`);
  }
});
test('local type checking emits no frontend and CI retains the full isolated development build', () => {
  assert.equal(scripts['typecheck'], 'npm run typecheck:core && npm run typecheck:web');
  assert.equal(scripts['typecheck:web'], 'ngc -p apps/web/tsconfig.app.json --noEmit');
  const core = baseline.commands.find(item=>item.check==='typecheck').leaves[0];
  assert.equal(scripts['typecheck:core'], core);
  assert.equal(scripts['typecheck:ci'], 'npm run typecheck:core && ng build rewrite-app-web --configuration development --output-path dist/typecheck-development');
  assert.ok(workflow.jobs.typecheck.steps.some(step=>step.run==='npm run typecheck:ci'));
  assert.ok(scripts['test:ci-policy'].split(/\s+/).includes('scripts/angular-typecheck.test.mjs'));
  const config=JSON.parse(read('../apps/web/tsconfig.json'));
  assert.equal(config.angularCompilerOptions.strictTemplates,true);
  assert.equal(config.angularCompilerOptions.strictInjectionParameters,true);
  const angular=JSON.parse(read('../angular.json')).projects['rewrite-app-web'].architect.build;
  assert.equal(angular.options.tsConfig,'apps/web/tsconfig.app.json');
  assert.equal(angular.defaultConfiguration,'production');
  assert.equal(scripts['build:web'],'ng build rewrite-app-web');
  assert.ok(scripts.build.split(' && ').includes('npm run build:web'));
});
test("coverage may add explicit tests but cannot remove files or change test-runner flags", () => {
  const original = "node --test scripts/old.test.mjs scripts/other.test.mjs";
  assert.equal(extendsExplicitTestFiles(original, original + " scripts/new.test.mjs"), true);
  for (const changed of ["node --test scripts/old.test.mjs", original + " --test-skip-pattern=old",
    original.replace("--test", "--test --test-name-pattern=new"), original + " || true", "echo " + original]) {
    assert.equal(extendsExplicitTestFiles(original, changed), false);
  }
});
test("third-party actions are immutable and checkout never leaves a write credential", () => {
  const steps = [...Object.values(workflow.jobs).flatMap(job => job.steps ?? []), ...action.runs.steps];
  for (const step of steps.filter(step => step.uses && !step.uses.startsWith("./"))) {
    assert.match(step.uses, /^[\w.-]+\/[\w.-]+@[a-f0-9]{40}$/);
    const [repository, sha] = step.uses.split("@");
    const reference = actionVersions[repository.replace(/^actions\//, "")];
    assert.ok(reference, `Unreviewed action ${repository}`);
    assert.equal(sha, reference.sha); assert.equal(reference.runtime, "node24");
    for (const input of Object.keys(step.with ?? {})) assert.ok(reference.inputs.includes(input), `Unsupported ${repository} input ${input}`);
    if (step.uses.startsWith("actions/checkout@")) assert.equal(step.with["persist-credentials"], false);
  }
  assert.deepEqual(workflow.permissions, { contents: "read" });
  assert.equal(workflow.on.pull_request_target, undefined);
  assert.equal(workflow.on.workflow_run, undefined);
});
test("PR code runs once per update while main, merge queue and manual runs remain supported", () => {
  assert.deepEqual(workflow.on.push.branches, ["main"]);
  for (const key of ["pull_request", "merge_group", "workflow_dispatch"]) assert.ok(Object.hasOwn(workflow.on, key));
  for (const event of ["push", "pull_request"]) assert.ok(workflow.on[event].paths.includes(".github/actions/**"));
  assert.equal(workflow.concurrency["cancel-in-progress"], true);
});
test('changing either production workflow alone still triggers complete acceptance', () => {
  for (const event of ['push', 'pull_request']) {
    const trigger = workflow.on[event];
    assert.equal(trigger['paths-ignore'], undefined);
    for (const path of ['.github/workflows/rewrite-app-ci.yml', '.github/workflows/rewrite-service-focus.yml']) {
      assert.ok(trigger.paths.includes(path), `${event} must check a change only to ${path}`);
    }
    assert.ok(trigger.paths.includes('rewrite-app/**'));
    assert.ok(trigger.paths.includes('.github/actions/**'));
  }
});
test('same-run build and visual consumers retain the qualified OS and an OS-specific browser cache', () => {
  assert.deepEqual([...new Set(Object.values(workflow.jobs).map(job => job['runs-on']))], ['ubuntu-24.04']);
  const cache = action.runs.steps.find(step => step.uses?.startsWith('actions/cache@'));
  assert.equal(cache.with.key,
    "${{ runner.os }}-${{ runner.arch }}-ubuntu-24.04-playwright-${{ hashFiles('rewrite-app/package-lock.json') }}");
  assert.equal(cache.with['restore-keys'], undefined, 'Never fall back to another OS or locked Chromium version');
});
test("Linux source reference uses an unchanged commit-pinned Original and same-run verified artifact", () => {
  const source = JSON.parse(read("./fixtures/original-browser-source.json"));
  const producer = workflow.jobs["original-reference-build"];
  const checkout = producer.steps.find(step => step.with?.repository);
  assert.equal(checkout.with.repository, source.repository); assert.equal(checkout.with.ref, source.commit);
  assert.ok(producer.steps.some(step => step.run?.includes("verify-source")));
  assert.ok(producer.steps.some(step => step.run?.includes(" pack ")));
  const upload = producer.steps.find(step => step.uses?.startsWith("actions/upload-artifact@"));
  assert.equal(upload.with["include-hidden-files"], true, "The official compiled assets include .browserslistrc; its digest must survive upload.");
  const consumer = workflow.jobs["original-browser-reference"];
  assert.deepEqual(consumer.needs, ["build", "original-reference-build", "browser-system-dependencies"]);
  assert.deepEqual(consumer.strategy.matrix.family, ["entry", "dialogs", "starter", "administration", "directory"]);
  const runtime = consumer.steps.find(step => step.uses === "./.github/actions/rewrite-runtime");
  assert.equal(runtime.with.prebuilt, "true", "Paired Source/Rewrite pages require the verified same-run application build.");
  assert.equal(runtime.with.playwright, "true");
  const download = consumer.steps.find(step => step.uses?.startsWith("actions/download-artifact@"));
  assert.equal(download.with.name, "original-reference-${{ github.sha }}-${{ needs.original-reference-build.outputs.attempt }}");
  assert.equal(download.with["digest-mismatch"], "error");
  assert.equal(download.with["run-id"], undefined); assert.equal(download.with["github-token"], undefined);
  assert.equal(consumer.env.UI_SMOKE_HEADFUL, "true");
  const evidence = consumer.steps.find(step => step.uses?.startsWith("actions/upload-artifact@"));
  assert.equal(evidence.with["retention-days"], 30, "Source images and raw measurements must survive the review window.");
  assert.ok(consumer.steps.some(step => step.run?.startsWith("xvfb-run --auto-servernum node scripts/original-browser-reference.mjs capture")));
});
test("paired reference families require real browser paint and layout negative controls", () => {
  const consumer = workflow.jobs["original-browser-reference"];
  const control = consumer.steps.find(step => step.name === "Verify native viewport capture");
  assert.equal(control.if, "matrix.family == 'administration' || matrix.family == 'directory' || matrix.family == 'entry' || matrix.family == 'starter'");
  assert.equal(control.run, "xvfb-run --auto-servernum npm run test:browser-capture:built");
  assert.equal(control.env.UI_SMOKE_ARTIFACT_DIR, "${{ runner.temp }}/original-captures");
  assert.equal(scripts["test:browser-capture:built"], "node --test --test-concurrency=1 scripts/stable-viewport-capture.test.mjs scripts/original-sample-diagnostics.test.mjs scripts/finite-animation-ready.test.mjs scripts/exit-completeness-diagnostics.test.mjs scripts/ci-browser-material-capture.test.mjs scripts/starter-scroll-ready.test.mjs");
});
test("isolated console shards retain each of the eight prior checks without a long serial prefix", () => {
  const names=["ui-controller-timer","ui-console-debug","ui-participant-console","ui-participant-command-completion","ui-participant-native-routes"];
  const shards=matrix.filter(item=>names.includes(item.check));
  assert.deepEqual(shards.map(item=>item.check).sort(),[...names].sort());
  const prior=baseline.commands.find(item=>item.check==="ui-participant-console").leaves;
  const actual=shards.flatMap(item=>expand(item.command).split("&&").map(value=>value.trim()));
  assert.equal(actual.length,8);assert.equal(new Set(actual).size,8);
  assert.deepEqual([...actual].sort(),[...prior].sort());
  for(const item of shards){assert.equal(item.playwright,true);assert.ok(item.command.split("&&").length<=2);}
  assert.ok(workflow.jobs.acceptance.needs.includes("verify-memory-sqlite"));
  const timer=workflow.jobs["verify-memory-sqlite"].steps.find(step=>step.name==="Retain failed controller timer diagnostics");
  assert.equal(timer.if,"(failure() || cancelled()) && matrix.check == 'ui-controller-timer'");
  const debug=workflow.jobs["verify-memory-sqlite"].steps.find(step=>step.name==="Retain failed console debug evidence");
  assert.equal(debug.if,"failure() && matrix.check == 'ui-console-debug'");
  assert.equal(debug.with.path.trim(),"${{ runner.temp }}/rewrite-ui-artifacts/participant-debug/*.json\n${{ runner.temp }}/rewrite-ui-artifacts/participant-debug/*.png");
  assert.equal(debug.with["retention-days"],7);
});
test("atomic settings regressions remain mandatory for both local and PostgreSQL acceptance", () => {
  assert.ok(scripts["test:unit:built"].includes("scripts/application-settings-mutation.test.mjs"));
  const postgres=readFileSync(new URL("./run-postgres-integration.mjs",import.meta.url),"utf8");
  assert.ok(postgres.includes('"scripts/application-settings-mutation.test.mjs"'));
});
test("release activation transaction regressions remain mandatory for local and PostgreSQL acceptance", () => {
  assert.ok(scripts["test:unit:built"].split(/\s+/).includes("scripts/content-release-activation.test.mjs"));
  const postgres = readFileSync(new URL("./run-postgres-integration.mjs", import.meta.url), "utf8");
  assert.ok(postgres.includes('"scripts/content-release-activation.test.mjs"'));
});
test("participant diagnostics are retained without uploading their SQLite scratch stores", () => {
  const job = workflow.jobs["verify-memory-sqlite"];
  const execute = job.steps.find(step => step.name === "Run ${{ matrix.check }}");
  assert.equal(execute.env.UI_SMOKE_ARTIFACT_DIR, "${{ runner.temp }}/rewrite-ui-artifacts");
  const evidence = job.steps.find(step => step.name === "Retain failed console loading evidence");
  assert.equal(evidence.if, "(failure() || cancelled()) && matrix.check == 'ui-participant-console'");
  assert.equal(evidence.with["retention-days"], 7);
  assert.equal(evidence.with.path.trim(), "${{ runner.temp }}/rewrite-ui-artifacts/participant-console-loading/*.json\n${{ runner.temp }}/rewrite-ui-artifacts/participant-console-loading/*.png");
  assert.ok(scripts["test:frontend-state"].split(/\s+/).includes("scripts/inactive-runtime-snapshot-gate.test.mjs"));
});
test('every extended browser leaf retains its existing failure document without uploading successful captures or stores',()=>{
 for(const id of ['verify-long-ui','verify-memory-sqlite']) {
 const job=workflow.jobs[id];
 const execute=job.steps.find(step=>step.name==='Run ${{ matrix.check }}');
 assert.equal(execute.run,'${{ matrix.command }}');
 assert.equal(execute.env.UI_SMOKE_ARTIFACT_DIR,'${{ runner.temp }}/rewrite-ui-artifacts');
 const evidence=job.steps.find(step=>step.name==='Retain the exact failing browser document');
 assert.equal(evidence.if,'(failure() || cancelled()) && matrix.playwright');
 assert.equal(evidence.with.name,'ui-failure-${{ matrix.check }}-${{ github.run_attempt }}');
 assert.equal(evidence.with.path.trim(),'${{ runner.temp }}/rewrite-ui-artifacts/failure.json\n${{ runner.temp }}/rewrite-ui-artifacts/failure.png');
 assert.equal(evidence.with['retention-days'],7);assert.equal(evidence.with['if-no-files-found'],'warn');
 assert.equal(evidence.uses,`actions/upload-artifact@${actionVersions['upload-artifact'].sha}`);
 }
});
test("the full PostgreSQL UI retains failure-only navigation evidence and its exact failing log", () => {
  const job = workflow.jobs["verify-postgres-ui"];
  const execute = job.steps.find(step => step.name === "Run protected PostgreSQL UI");
  assert.equal(execute.shell, "bash", "The tee pipeline must retain bash pipefail");
  assert.equal(execute.env.UI_SMOKE_FAILURE_ARTIFACT_DIR, "${{ runner.temp }}/rewrite-postgres-ui-failure");
  assert.equal(execute.env.UI_SMOKE_ARTIFACT_DIR, undefined, "Do not add successful screenshot captures to the full UI journey");
  assert.equal(execute.run, 'npm run smoke:ui:postgres:built 2>&1 | tee "$RUNNER_TEMP/rewrite-postgres-ui.log"');
  const evidence = job.steps.find(step => step.name === "Retain failed PostgreSQL UI diagnostics");
  assert.equal(evidence.if, "failure() || cancelled()");
  assert.equal(evidence.with["retention-days"], 7);
  assert.equal(evidence.with.path.trim(), "${{ runner.temp }}/rewrite-postgres-ui.log\n${{ runner.temp }}/rewrite-postgres-ui-failure/");
});
test("the required loading leaf has independent fatal phase and total deadlines", () => {
  const source = read('./smoke-participant-console-loading.mjs');
  assert.equal(scripts['smoke:ui:participant-console-loading:built'], 'node ./scripts/smoke-participant-console-loading.mjs');
  assert.ok(source.includes('if (!isSupervisedSmokeChild(import.meta.url))'));
  assert.ok(source.includes('process.exitCode = await runSupervisedSmoke('));
  assert.ok(source.includes('phaseTimeoutMs: 60_000, totalTimeoutMs: 480_000'));
  assert.ok(scripts['test:ci-policy'].split(/\s+/).includes('scripts/supervised-smoke.test.mjs'));
});
test('Compose JSON readiness keeps its absolute request/body deadline and real subprocess controls', () => {
  const source=read('./smoke-compose-postgres.mjs');
  assert.ok(source.includes("import {pollSmokeJson} from './poll-smoke-json.mjs'"));
  assert.ok(source.includes('const pollJson = url => pollSmokeJson(url, {fetcher: fetch,'));
  assert.ok(source.includes("console.log('compose_json_phase='+JSON.stringify(phase))"));
  assert.ok(scripts['test:ci-policy'].split(/\s+/).includes('scripts/poll-smoke-json.test.mjs'));
});
test('settings wait for current finite effects and keep actual Chromium cancellation and failure controls mandatory',()=>{
 const source=read('./original-application-settings-smoke.mjs');
 assert.ok(source.includes('await waitForFiniteDocumentAnimations(page)'));
 assert.ok(!source.includes('.map(a=>a.finished)'));
 assert.ok(scripts['test:browser-capture:built'].split(/\s+/).includes('scripts/finite-animation-ready.test.mjs'));
 assert.ok(scripts['test:browser-capture:built'].split(/\s+/).includes('scripts/exit-completeness-diagnostics.test.mjs'));
 assert.ok(workflow.jobs['browser-system-qualification'].steps.some(step=>step.run==='xvfb-run --auto-servernum npm run test:browser-capture:built'));
});
test('the Original sample retains scoped input/message/save evidence without widening credential or store uploads',()=>{
  for(const id of ['verify-long-ui','verify-memory-sqlite']) {
  const step=workflow.jobs[id].steps.find(step=>step.name==='Retain Original sample transport diagnostics');
  assert.equal(step.if,'failure() || cancelled()');
  assert.equal(step.with.path.trim(),'${{ runner.temp }}/rewrite-ui-artifacts/original-sample/*.json\n${{ runner.temp }}/rewrite-ui-artifacts/original-sample/*.png');
  assert.equal(step.with['retention-days'],7);
  }
  assert.ok(scripts['test:browser-capture:built'].split(/\s+/).includes('scripts/stable-viewport-capture.test.mjs'));
  assert.ok(scripts['test:browser-capture:built'].split(/\s+/).includes('scripts/original-sample-diagnostics.test.mjs'));
  const source=read('./smoke-ui.mjs');
  assert.ok(source.includes('originalSampleTrace = await observeOriginalSample(page)'));
  assert.ok(source.includes('originalSampleTrace.write(resolve(artifactDirectory,"original-sample"))'));
});
test("test jobs use the same-run build and cannot compile a replacement production frontend", () => {
  assert.equal(workflow.jobs.build.steps.filter(step => step.run === "npm run build").length, 1);
  for (const id of ["unit", "quick", "quick-extended-long", "quick-extended", "verify-long-ui", "verify-memory-sqlite", "verify-postgres", "verify-postgres-ui", "deployability", "docker-compose-release-smoke"]) {
    const job = workflow.jobs[id];
    if (id === "unit") assert.equal(job.needs, "build");
    else if(id === "quick") assert.deepEqual(job.needs,["build","browser-system-dependencies"]);
    else if(id === "verify-postgres") assert.deepEqual(job.needs,["build","typecheck","dependencies","unit"]);
    else if(["verify-long-ui","quick-extended-long","verify-postgres-ui"].includes(id)) assert.deepEqual(job.needs,["build","typecheck","dependencies","unit","browser-system-dependencies"]);
    else if(["quick-extended","verify-memory-sqlite"].includes(id)) assert.deepEqual(job.needs,["build","fast-feedback","browser-system-dependencies"]);
    else assert.deepEqual(job.needs, ["build", "fast-feedback"]);
    const setup = job.steps.find(step => step.uses === "./.github/actions/rewrite-runtime");
    assert.equal(setup.with.prebuilt, "true");
  }
  for (const item of matrix) assert.ok(!/npm run (?:build|typecheck)(?:\s|$)/.test(item.command));
  const download = action.runs.steps.find(step => step.with?.name === "rewrite-build-${{ github.sha }}-${{ inputs.build-attempt }}");
  assert.equal(download.with.name, "rewrite-build-${{ github.sha }}-${{ inputs.build-attempt }}");
  assert.equal(download.with["run-id"], undefined);
  assert.equal(download.with["github-token"], undefined);
  assert.equal(download.with["digest-mismatch"], "error");
  assert.ok(action.runs.steps.some(step => step.run === "node scripts/ci-build-artifact.mjs restore"));
});
test('full PostgreSQL feedback is gated by all non-browser fast checks and remains reachable after a browser cohort rejection',()=>{
  const postgres=workflow.jobs['verify-postgres'];
  assert.deepEqual(postgres.needs,['build','typecheck','dependencies','unit']);
  const ancestors=new Set();
  const visit=id=>{for(const name of [workflow.jobs[id].needs??[]].flat()){
    if(!ancestors.has(name)){ancestors.add(name);visit(name);}
  }};visit('verify-postgres');
  for(const id of ['quick','fast-feedback','browser-system-dependencies','browser-system-qualification','original-browser-reference'])
    assert.equal(ancestors.has(id),false,id+' must not fence the actual database group.');
  assert.equal(postgres.if,undefined,'Use normal failure gating for every required non-browser dependency.');
  assert.ok(postgres.steps.some(step=>step.run==='npm run test:integration:postgres:built'));
  assert.ok(postgres.steps.some(step=>step.name==='Run protected Postgres startup smoke'));
  assert.ok(workflow.jobs.acceptance.needs.includes('verify-postgres'));
  assert.ok(workflow.jobs.acceptance.needs.includes('verify-postgres-ui'));
});
test("fast feedback is independent of the long matrix and full acceptance rejects skipped/failed groups", () => {
  assert.deepEqual(workflow.jobs["fast-feedback"].needs, ["build", "typecheck", "dependencies", "unit", "quick"]);
  const gate = workflow.jobs.acceptance;
  assert.equal(gate.if, "always()");
  for (const id of Object.keys(workflow.jobs).filter(id => !["acceptance", "fast-feedback"].includes(id))) assert.ok(gate.needs.includes(id), id);
  assert.match(gate.steps[0].run, /result\.result !== "success"/);
});
test("Ops qualification is split into independent browser jobs without dropping its authenticated full flow", () => {
  for (const name of ["original-xml-schema", "original-workspace-files", "deletion-confirmation", "delete-group-results", "admin-workspace-access", "admin-delete", "workspace-rename", "workspace-delete"]) {
    assert.equal(matrix.find(item => item.check === "ui-" + name)?.command, `npm run smoke:ui:${name}:built`);
  }
  assert.equal(matrix.find(item => item.check === "ui-ops").command, "npm run smoke:ui:operator-auth:built");
});
test('native Systemcheck reports retain their real browser journey in required workspace qualification',()=>{
 assert.equal(scripts['smoke:ui:original-workspace-files:built'],
  'node scripts/smoke-original-workspace-files.mjs && npm run smoke:ui:original-system-check-reports:built');
 assert.equal(scripts['smoke:ui:original-system-check-reports:built'],'node scripts/smoke-original-system-check-reports.mjs');
 assert.ok(scripts['test:frontend-state'].split(/\s+/).includes('scripts/original-system-check-reports-controller.test.mjs'));
 assert.equal(matrix.find(item=>item.check==='ui-original-workspace-files')?.command,'npm run smoke:ui:original-workspace-files:built');
});

test('all v3 consumers use exact immutable producer format and digest and cannot bypass offline material verification',()=>{
 const producer=workflow.jobs['browser-system-dependencies'];
 assert.equal(producer.outputs['profile-format'],'${{ steps.packages.outputs.profile-format }}');
 assert.equal(producer.outputs['material-sha256'],'${{ steps.packages.outputs.material-sha256 }}');
 assert.equal(producer.outputs['before-inventory-sha256'],'${{ steps.packages.outputs.before-inventory-sha256 }}');
 const pack=producer.steps.find(step=>step.id==='packages');assert.equal(pack.env.CI_BROWSER_SYSTEM_FORMAT,'3');
 assert.ok(producer.steps.findIndex(step=>step.run?.includes('playwright install chromium'))<producer.steps.indexOf(pack));
 for(const [name,job]of Object.entries(workflow.jobs))for(const step of job.steps??[]){
  if(step.uses!=='./.github/actions/rewrite-runtime'||!step.with?.playwright||step.with.playwright==='false')continue;
  assert.equal(step.with['browser-system-profile-format'],'${{ needs.browser-system-dependencies.outputs.profile-format }}',name);
  assert.equal(step.with['browser-system-material-sha256'],'${{ needs.browser-system-dependencies.outputs.material-sha256 }}',name);
  assert.equal(step.with['browser-system-before-inventory-sha256'],'${{ needs.browser-system-dependencies.outputs.before-inventory-sha256 }}',name);
  assert.equal(step.with['browser-system-certified-cohorts'],'true',name);
  assert.equal(step.with['browser-material-label'],'${{ strategy.job-index }}',name);
 }
 const qualification=workflow.jobs['browser-system-qualification'];
 const restore=qualification.steps.find(step=>step.run?.includes('ci-browser-system.mjs restore'));
 assert.equal(restore.env.CI_BROWSER_SYSTEM_FORMAT,'${{ needs.browser-system-dependencies.outputs.profile-format }}');
 assert.equal(restore.env.CI_BROWSER_SYSTEM_EXPECTED_IMAGE_VERSION,'${{ needs.browser-system-dependencies.outputs.image-version }}');
 assert.equal(restore.env.CI_BROWSER_SYSTEM_EXPECTED_MATERIAL_SHA256,'${{ needs.browser-system-dependencies.outputs.material-sha256 }}');
 assert.ok(qualification.steps.findIndex(step=>step.run?.includes('playwright install chromium'))<qualification.steps.indexOf(restore));
 assert.equal(action.inputs['browser-system-profile-format'].default,'2');
});

test('native Test creation is mandatory in complete units, PostgreSQL and focused Original results',()=>{
 const suite='scripts/original-test-creation.test.mjs';
 for(const script of ['test:unit:built','test:original-results:built'])assert.ok(scripts[script].split(/\s+/).includes(suite));
 assert.ok(read('./run-postgres-integration.mjs').includes(JSON.stringify(suite)));
});


test('trusted initial inventory rejects before npm or browser downloads while retaining bounded package evidence',()=>{
 const setup=action.runs.steps.findIndex(step=>step.uses?.startsWith('actions/setup-node@'));
 const preflight=action.runs.steps.findIndex(step=>step.run==='node scripts/ci-browser-inventory-preflight.mjs');
 const install=action.runs.steps.findIndex(step=>step.run==='npm ci --no-audit --no-fund');
 assert.ok(setup<preflight&&preflight<install);
 const step=action.runs.steps[preflight];
 assert.equal(step.if,"inputs.browser-system-before-inventory-sha256 != '' && inputs.browser-system-certified-cohorts != 'true'");
 assert.equal(step.env.CI_BROWSER_SYSTEM_EXPECTED_BEFORE_SHA256,'${{ inputs.browser-system-before-inventory-sha256 }}');
 assert.equal(step.env.CI_BROWSER_COHORT_DIAGNOSTIC_DIR,'${{ runner.temp }}/browser-cohort');
 assert.equal(action.inputs['browser-system-before-inventory-sha256'].default,'','Earlier wrappers retain complete offline verification');
 const download=action.runs.steps.findIndex(step=>step.uses?.startsWith('actions/download-artifact@'));
 assert.ok(preflight<download,'Known incompatible hosts must reject before any browser artifact download');
 const qualification=workflow.jobs['browser-system-qualification'].steps.find(step=>step.uses==='./.github/actions/rewrite-runtime');
 assert.equal(qualification.with['browser-system-before-inventory-sha256'],'${{ needs.browser-system-dependencies.outputs.before-inventory-sha256 }}');
 const retained=action.runs.steps.find(step=>step.name==='Retain rejected initial package inventory');
 assert.equal(retained.if,"failure() && inputs.browser-system-before-inventory-sha256 != ''");
 assert.equal(retained.with.path,'${{ runner.temp }}/browser-cohort/');assert.equal(retained.with['retention-days'],7);
 assert.ok(retained.with.name.includes('${{ inputs.browser-material-label }}'));
 assert.ok(action.runs.steps.some(step=>step.run?.includes('ci-browser-system.mjs restore')),'Early comparison cannot replace the complete offline gate');
});


test('all CI Node producers and consumers use one exact patch file instead of runner-cache-dependent major selection',()=>{
 const pin=read('../../.node-version');assert.equal(pin,'22.23.4\n');assert.match(pin.trim(),/^22\.[0-9]+\.[0-9]+$/);
 const all=[...action.runs.steps,...Object.values(workflow.jobs).flatMap(job=>job.steps??[])];
 const setups=all.filter(step=>step.uses?.startsWith('actions/setup-node@'));
 assert.equal(setups.length,4,'Shared runtime plus Original compilation, locked audit and container smoke owners');
 for(const setup of setups){
  assert.equal(setup.with['node-version-file'],'.node-version');
  assert.equal(setup.with['node-version'],undefined,'A major range would reintroduce producer/consumer patch drift');
 }
});


test('every Node setup immediately qualifies the exact executable before npm or artifact access',()=>{
 for(const steps of [action.runs.steps,...Object.values(workflow.jobs).map(job=>job.steps??[])]){
  for(const [index,step]of steps.entries())if(step.uses?.startsWith('actions/setup-node@')){
   const next=steps[index+1];assert.equal(next.name,'Qualify exact Node version and executable permissions');
   assert.ok(['node scripts/ci-node-runtime.mjs','node rewrite-app/scripts/ci-node-runtime.mjs'].includes(next.run));
   assert.equal(next['continue-on-error'],undefined);
  }
 }
 const setup=action.runs.steps.findIndex(step=>step.uses?.startsWith('actions/setup-node@'));
 const inventory=action.runs.steps.findIndex(step=>step.run==='node scripts/ci-browser-inventory-preflight.mjs');
 assert.ok(setup+1<inventory,'Node normalization precedes the trusted initial inventory gate');
});


test('certified routing is explicit before npm and preserves same-run authentication and native failure behavior',()=>{
 assert.equal(action.inputs['browser-system-certified-cohorts'].default,'false');
 const route=action.runs.steps.find(step=>step.id==='browser-route');
 assert.equal(route.if,"inputs.browser-system-certified-cohorts == 'true'");
 assert.equal(route.run,'node scripts/ci-browser-cohort-route.mjs');
 assert.ok(action.runs.steps.indexOf(route)<action.runs.steps.findIndex(step=>step.run==='npm ci --no-audit --no-fund'));
 for(const [env,input]of [['CI_BROWSER_SYSTEM_FORMAT','browser-system-profile-format'],['CI_BROWSER_SYSTEM_ALLOW_CERTIFIED','browser-system-certified-cohorts'],
  ['CI_BROWSER_SYSTEM_PRODUCER_ATTEMPT','browser-system-attempt'],['CI_BROWSER_SYSTEM_EXPECTED_IMAGE_VERSION','browser-system-image-version'],
  ['CI_BROWSER_SYSTEM_EXPECTED_MATERIAL_SHA256','browser-system-material-sha256'],['CI_BROWSER_SYSTEM_EXPECTED_BEFORE_SHA256','browser-system-before-inventory-sha256']])
   assert.equal(route.env[env],'${{ inputs.'+input+' }}');
 for(const field of ['browser-install-route','browser-certificate-id','browser-certificate-sha256','browser-producer-attempt'])assert.ok(action.outputs[field].value.includes('steps.browser-route.outputs.'));
});
test('each browser route has exactly one archive source and one real offline installer without catch-and-retry',()=>{
 const selected=name=>action.runs.steps.find(step=>step.name===name);
 const global=selected('Restore authenticated same-run browser system packages');
 const prepare=selected('Prepare exact qualified native archives without package installation');
 const ordinary=selected('Verify and install browser system packages offline');
 const certified=selected('Install exact certified archives offline and verify actual material');
 for(const step of [global,ordinary])assert.equal(step.if,"inputs.playwright == 'true' && steps.browser-route.outputs.route != 'certified'");
 for(const step of [prepare,certified])assert.equal(step.if,"inputs.playwright == 'true' && steps.browser-route.outputs.route == 'certified'");
 assert.equal(global.with['digest-mismatch'],'error');
 assert.match(prepare.run,/ci-browser-system\.mjs prepare-certified$/);assert.match(certified.run,/ci-browser-system\.mjs restore-certified$/);
 assert.ok(action.runs.steps.indexOf(prepare)<action.runs.steps.indexOf(certified));
 for(const step of [prepare,certified]){
  assert.equal(step['continue-on-error'],undefined);
  assert.equal(step.env.CI_BROWSER_SYSTEM_PRODUCER_ATTEMPT,'${{ steps.browser-route.outputs.producer-attempt }}');
  assert.equal(step.env.CI_BROWSER_SYSTEM_CERTIFICATE_ID,'${{ steps.browser-route.outputs.certificate-id }}');
  assert.equal(step.env.CI_BROWSER_SYSTEM_EXPECTED_CERTIFICATE_SHA256,'${{ steps.browser-route.outputs.certificate-sha256 }}');
 }
});
test('direct offline qualification retains fresh certified installation and every native capture control',()=>{
 const job=workflow.jobs['browser-system-qualification'],runtime=job.steps.find(step=>step.uses==='./.github/actions/rewrite-runtime');
 assert.equal(runtime.id,'runtime');assert.equal(runtime.with['browser-system-certified-cohorts'],'true');
 assert.equal(runtime.with['browser-system-attempt'],'${{ needs.browser-system-dependencies.outputs.attempt }}');
 const prepare=job.steps.find(step=>step.run?.endsWith('ci-browser-system.mjs prepare-certified'));
 const installed=job.steps.find(step=>step.run?.endsWith('ci-browser-system.mjs restore-certified'));
 const ordinary=job.steps.find(step=>step.run?.endsWith('ci-browser-system.mjs restore'));
 const capture=job.steps.find(step=>step.run==='xvfb-run --auto-servernum npm run test:browser-capture:built');
 assert.equal(prepare.if,"steps.runtime.outputs.browser-install-route == 'certified'");
 assert.equal(installed.if,prepare.if);assert.equal(ordinary.if,"steps.runtime.outputs.browser-install-route != 'certified'");
 assert.ok(job.steps.indexOf(prepare)<job.steps.indexOf(installed)&&job.steps.indexOf(installed)<job.steps.indexOf(capture));
 for(const step of [prepare,installed]){
  assert.equal(step.env.CI_BROWSER_SYSTEM_CERTIFICATE_ID,'${{ steps.runtime.outputs.browser-certificate-id }}');
  assert.equal(step.env.CI_BROWSER_SYSTEM_EXPECTED_CERTIFICATE_SHA256,'${{ steps.runtime.outputs.browser-certificate-sha256 }}');
  assert.equal(step.env.CI_BROWSER_SYSTEM_PRODUCER_ATTEMPT,'${{ steps.runtime.outputs.browser-producer-attempt }}');
 }
 assert.equal(capture.if,undefined,'No cohort can skip the native capture controls');
});


test('Docker and Compose schema assertions use the same dependency-free complete migration reader',()=>{
 assert.ok(scripts['test:ci-policy'].split(/\s+/).includes('scripts/smoke-schema-version.test.mjs'));
 const helper=read('./smoke-schema-version.mjs');assert.ok(!/^import.*from ['"](?!node:)/m.test(helper));
 for(const [file,store]of [['smoke-docker-runtime.mjs','sqlite'],['smoke-compose-postgres.mjs','postgres']]){
   const driver=read('./'+file);assert.ok(driver.includes("import {readExpectedSchemaVersion} from './smoke-schema-version.mjs'"));
   assert.ok(driver.includes('new URL("../packages/'+store+'-store/src/index.ts", import.meta.url)'));
   assert.ok(driver.includes('readiness.storage?.schemaVersion'));assert.ok(driver.includes('manifest.storage?.schemaVersion'));
   assert.ok(!driver.includes('source.matchAll('));
 }
});

test('native monitor keeps protected real-browser coverage and all numeric, record and session regressions mandatory',()=>{
 const row=workflow.jobs.quick.strategy.matrix.include.find(row=>row.check==='native-monitor');
 assert.equal(row.command,'npm run smoke:ui:native-monitor:built');
 assert.equal(workflow.jobs.quick.env.UI_SMOKE_HEADFUL,'true');
 assert.equal(scripts['smoke:ui:native-monitor:built'],'node scripts/smoke-native-monitor.mjs');
 for(const file of ['native-monitor-wire','native-monitor-number','native-monitor-views','native-monitor-session','native-monitor-lifecycle'])assert.ok(scripts['test:frontend-state'].split(/\s+/).includes('scripts/'+file+'.test.mjs'));
 const driver=read('./smoke-native-monitor.mjs');
 for(const marker of ['real-native-protected-login-and-profile-choice','literal-int64-snapshots-real-booklet-and-profile-rendering','same-browser-workspace-switch-does-not-reuse-private-booklet-or-selection','real-empty-native-snapshot-clears-previous-rows','current-native-role-revocation-clears-monitor-and-local-bearer'])assert.ok(driver.includes(marker));
});


test('complete native Monitor pixels are a required same-run Source and runtime consumer',()=>{
 const job=workflow.jobs['native-monitor-visual'];
 assert.deepEqual(job.strategy.matrix.scenario,['baseline','selected-row','settings-menu','new-filter-dialog','filter-target-menu','filter-value-options','advanced-filter-dialog','finish-dialog','time-dialog','time-dialog-edited']);assert.equal(job.strategy['fail-fast'],false);assert.equal(job.strategy['max-parallel'],3);
 assert.deepEqual(job.needs,['build','original-reference-build','browser-system-dependencies','fast-feedback']);
 assert.equal(job.env.UI_SMOKE_HEADFUL,'true');assert.equal(job['timeout-minutes'],15);
 assert.equal(job.defaults.run['working-directory'],'rewrite-app');assert.equal(job['continue-on-error'],undefined);
 const runtime=job.steps.find(step=>step.uses==='./.github/actions/rewrite-runtime');
 assert.equal(runtime.with.prebuilt,'true');assert.equal(runtime.with.playwright,'true');
 assert.equal(runtime.with['build-attempt'],'${{ needs.build.outputs.attempt }}');
 const download=job.steps.find(step=>step.uses?.startsWith('actions/download-artifact@'));
 assert.equal(download.with.name,'original-reference-${{ github.sha }}-${{ needs.original-reference-build.outputs.attempt }}');
 assert.equal(download.with['digest-mismatch'],'error');assert.equal(download.with['run-id'],undefined);assert.equal(download.with['github-token'],undefined);
 const self=job.steps.find(step=>step.name==='Require exact Original self-control');
 const pair=job.steps.find(step=>step.name==='Require eight exact complete Original-to-Rewrite Monitor viewports');
 assert.equal(self.run,'timeout --signal=TERM --kill-after=15s 5m xvfb-run --auto-servernum node scripts/smoke-native-monitor-visual.mjs source-self-control "$NATIVE_MONITOR_VISUAL_SCENE"');
 assert.equal(pair.run,'timeout --signal=TERM --kill-after=15s 5m xvfb-run --auto-servernum node scripts/smoke-native-monitor-visual.mjs rewrite "$NATIVE_MONITOR_VISUAL_SCENE"');
 assert.ok(job.steps.indexOf(runtime)<job.steps.indexOf(self));assert.ok(job.steps.indexOf(self)<job.steps.indexOf(pair));
 for(const step of [self,pair]){assert.equal(step.env.NATIVE_MONITOR_VISUAL_SCENE,'${{ matrix.scenario }}');assert.equal(step.env.ORIGINAL_BROWSER_REFERENCE_ROOT,download.with.path);assert.equal(step.if,undefined);assert.equal(step['continue-on-error'],undefined);}
 const evidence=job.steps.find(step=>step.uses?.startsWith('actions/upload-artifact@'));
 assert.equal(evidence.with.name,'native-monitor-parity-${{ matrix.scenario }}-${{ github.sha }}-${{ github.run_attempt }}');assert.equal(evidence.if,'always()');assert.equal(evidence.with['include-hidden-files'],true);assert.equal(evidence.with['if-no-files-found'],'error');assert.equal(evidence.with['retention-days'],30);
 assert.ok(evidence.with.path.includes(download.with.path));assert.ok(evidence.with.path.includes(self.env.UI_SMOKE_ARTIFACT_DIR));assert.ok(evidence.with.path.includes(pair.env.UI_SMOKE_ARTIFACT_DIR));
 assert.ok(workflow.jobs.acceptance.needs.includes('native-monitor-visual'));
});

test('both native login roots require all ten exact Source states and retain immutable same-run evidence',()=>{
 const job=workflow.jobs['native-login-visual'];
 assert.deepEqual(job.strategy.matrix.entry,['monitor','participant']);
 assert.deepEqual(job.strategy.matrix.scenario,['empty','name-filled','password','password-filled','password-visible','password-back','password-error','password-rate-limit','password-expired','password-scheduled']);
 assert.equal(job.strategy['fail-fast'],false);assert.equal(job.strategy['max-parallel'],3);
 assert.deepEqual(job.needs,['build','original-reference-build','browser-system-dependencies','fast-feedback']);
 assert.equal(job.env.UI_SMOKE_HEADFUL,'true');assert.equal(job['timeout-minutes'],15);assert.equal(job['continue-on-error'],undefined);
 assert.equal(job.defaults.run['working-directory'],'rewrite-app');
 const runtime=job.steps.find(step=>step.uses==='./.github/actions/rewrite-runtime');
 assert.equal(runtime.with.prebuilt,'true');assert.equal(runtime.with.playwright,'true');assert.equal(runtime.with['browser-system-certified-cohorts'],'true');
 assert.equal(runtime.with['build-attempt'],'${{ needs.build.outputs.attempt }}');
 const download=job.steps.find(step=>step.uses?.startsWith('actions/download-artifact@'));
 assert.equal(download.id,'original-login-reference');assert.equal(download.with.name,'original-reference-${{ github.sha }}-${{ needs.original-reference-build.outputs.attempt }}');
 assert.equal(download.with['digest-mismatch'],'error');assert.equal(download.with['run-id'],undefined);assert.equal(download.with['github-token'],undefined);
 const controls=job.steps.find(step=>step.name==='Verify actual native paint and layout negative controls');assert.equal(controls.run,'xvfb-run --auto-servernum npm run test:browser-capture:built');
 const self=job.steps.find(step=>step.name==='Require exact Original login self-control'),pair=job.steps.find(step=>step.name==='Require eight exact complete Original-to-Rewrite login viewports');
 assert.equal(self.run,'timeout --signal=TERM --kill-after=15s 5m xvfb-run --auto-servernum node scripts/smoke-native-login-visual.mjs source-self-control');
 assert.equal(pair.run,'timeout --signal=TERM --kill-after=15s 5m xvfb-run --auto-servernum node scripts/smoke-native-login-visual.mjs rewrite');
 assert.ok(job.steps.indexOf(runtime)<job.steps.indexOf(controls));assert.ok(job.steps.indexOf(controls)<job.steps.indexOf(self));assert.ok(job.steps.indexOf(self)<job.steps.indexOf(pair));
 for(const step of [self,pair]){assert.equal(step.env.NATIVE_LOGIN_ENTRY,'${{ matrix.entry }}');assert.equal(step.env.NATIVE_LOGIN_SCENE,'${{ matrix.scenario }}');assert.equal(step.env.ORIGINAL_BROWSER_REFERENCE_ROOT,download.with.path);assert.equal(step.if,undefined);assert.equal(step['continue-on-error'],undefined);}
 const post=job.steps.find(step=>step.name==='Verify Original build remains unchanged after login capture');
 assert.equal(post.if,"always() && steps.original-login-reference.outcome == 'success'");assert.equal(post.env.ORIGINAL_BROWSER_REFERENCE_ROOT,download.with.path);assert.equal(post.run,'node scripts/original-browser-reference.mjs verify-build "$ORIGINAL_BROWSER_REFERENCE_ROOT"');assert.ok(job.steps.indexOf(pair)<job.steps.indexOf(post));
 const evidence=job.steps.find(step=>step.uses?.startsWith('actions/upload-artifact@'));assert.equal(evidence.if,'always()');assert.equal(evidence.with['include-hidden-files'],true);assert.equal(evidence.with['if-no-files-found'],'error');assert.equal(evidence.with['retention-days'],30);
 assert.equal(evidence.with.name,'native-login-parity-${{ matrix.entry }}-${{ matrix.scenario }}-${{ github.sha }}-${{ github.run_attempt }}');
 for(const path of [controls.env.UI_SMOKE_ARTIFACT_DIR,self.env.UI_SMOKE_ARTIFACT_DIR,pair.env.UI_SMOKE_ARTIFACT_DIR,download.with.path,'${{ runner.temp }}/browser-system/manifest.json'])assert.ok(evidence.with.path.includes(path));
 assert.ok(workflow.jobs.acceptance.needs.includes('native-login-visual'));
});
