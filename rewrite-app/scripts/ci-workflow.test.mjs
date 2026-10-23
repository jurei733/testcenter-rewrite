import assert from "node:assert/strict";
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
test('every actual browser consumer waits for the authenticated same-run package producer',()=>{
 const consumers=Object.entries(workflow.jobs).filter(([,job])=>job.steps?.some(step=>
  step.uses==='./.github/actions/rewrite-runtime' && step.with?.playwright && step.with.playwright!=='false'));
 assert.deepEqual(consumers.map(([name])=>name).sort(),['original-browser-reference','quick','quick-extended','verify-memory-sqlite','verify-postgres-ui'].sort());
 for(const [name,job]of consumers)assert.ok(job.needs.includes('browser-system-dependencies'),name);
 const download=action.runs.steps.find(step=>step.name==='Restore authenticated same-run browser system packages');
 assert.equal(download.if,"inputs.playwright == 'true'");assert.equal(download.with.name,'browser-system-${{ github.sha }}-${{ inputs.browser-system-attempt }}');
 assert.equal(download.with['digest-mismatch'],'error');assert.equal(download.with['run-id'],undefined);assert.equal(download.with['github-token'],undefined);
 const restore=action.runs.steps.find(step=>step.name==='Verify and install browser system packages offline');
 assert.equal(restore.if,download.if);assert.equal(restore.env.CI_BROWSER_SYSTEM_DIR,download.with.path);
 assert.equal(restore.run,'timeout --signal=TERM --kill-after=15s 5m node scripts/ci-browser-system.mjs restore');
 assert.ok(action.runs.steps.indexOf(download)<action.runs.steps.indexOf(restore));
 assert.ok(action.runs.steps.indexOf(restore)<action.runs.steps.findIndex(step=>step.run?.includes('playwright install')));
 assert.ok(!action.runs.steps.some(step=>/apt-get|--with-deps|\/etc\/apt|sudo/.test(step.run??'')));
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
  writeFileSync(join(directory,'node'),'#!/bin/sh\n[ "$#" = 2 ] && [ "$1" = scripts/ci-browser-system.mjs ] && [ "$2" = restore ] || exit 65\n[ "$CI_BROWSER_SYSTEM_DIR" = "$OWNED_PACKAGE_DIRECTORY" ] || exit 66\nexit "$OWNED_STATUS"\n');
  writeFileSync(join(directory,'npx'),'#!/bin/sh\n[ "$#" = 4 ] && [ "$1" = --no-install ] && [ "$2" = playwright ] && [ "$3" = install ] && [ "$4" = chromium ] || exit 65\nexit "$OWNED_STATUS"\n');
  for(const name of ['timeout','node','npx'])chmodSync(join(directory,name),0o755);
  const scripts=action.runs.steps.filter(step=>step.run?.startsWith('timeout '));assert.equal(scripts.length,2);
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
const matrix = workflow.jobs["verify-memory-sqlite"].strategy.matrix.include;
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
  const command = step.run.replace("${{ matrix.command }}", "(echo owned-failure; exit 37)")
    .replace("xvfb-run --auto-servernum ", "")
    .replace('"$RUNNER_TEMP/rewrite-ui-quick.log"', "/dev/null");
  const result = spawnSync("bash", ["--noprofile", "--norc", "-e", "-o", "pipefail", "-c", command], { encoding: "utf8" });
  assert.equal(result.status, 37); assert.match(result.stdout, /owned-failure/);
  const implicit = spawnSync("bash", ["-e", "-c", command], { encoding: "utf8" });
  assert.equal(implicit.status, 0, "The old implicit shell must reproduce the false green");
  const legacy = 'bash --noprofile --norc -e -o pipefail -c "exit 37" 2>&1 | tee /dev/null';
  assert.equal(spawnSync("bash", ["-e", "-c", legacy]).status, 0,
    "An inner pipefail bash cannot fix the historical outer logger pipeline");
  assert.equal(spawnSync("bash", ["-e", "-o", "pipefail", "-c", legacy]).status, 37);
});
test("all 28 browser scenarios run once across fast and extended shards, with complete acceptance requiring both", () => {
  const quick = workflow.jobs.quick;
  const extended = workflow.jobs["quick-extended"];
  const shards = [...quick.strategy.matrix.include, ...extended.strategy.matrix.include];
  assert.equal(quick.strategy["fail-fast"], false);
  assert.equal(extended.strategy["fail-fast"], false);
  assert.equal(extended.strategy["max-parallel"], 4, "Long prefix journeys must leave capacity for Postgres and the broad matrix");
  assert.deepEqual([...new Set(shards.map(item => item.group))], ["entry", "system-check", "participant", "content"]);
  assert.equal(shards.length, 28);
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
  for (const tier of [quick, extended]) {
    const execution = tier.steps.find(step => step.run?.includes("| tee"));
    assert.equal(execution.run, 'xvfb-run --auto-servernum ${{ matrix.command }} 2>&1 | tee "$RUNNER_TEMP/rewrite-ui-quick.log"');
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
    ["bug-report","original-login","original-login-protected","original-admin-login","proof-of-work","system-check","participant-variant","ib-player"].sort());
  assert.equal(workflow.jobs["quick-extended"].strategy.matrix.include.length,20);
  assert.deepEqual(workflow.jobs["quick-extended"].needs,["build","fast-feedback","browser-system-dependencies"]);
  assert.ok(!workflow.jobs["fast-feedback"].needs.includes("quick-extended"));
});
test("extended dispatch avoids the measured long tail without adding slots or dropping journeys", () => {
  const recorded = JSON.parse(read("./fixtures/ci-browser-timings.json"));
  const extended = workflow.jobs["quick-extended"].strategy;
  const current = extended.matrix.include.map(item => item.check);
  const weights = recorded.secondsByCheck;
  assert.deepEqual([...current].sort(), Object.keys(weights).sort());
  assert.deepEqual([...recorded.previousOrder].sort(), [...current].sort());
  assert.ok(Object.values(weights).every(value => Number.isInteger(value) && value > 0));
  const duration = order => {
    const slots = Array(extended["max-parallel"]).fill(0);
    for (const check of order) slots[slots.indexOf(Math.min(...slots))] += weights[check];
    return Math.max(...slots);
  };
  assert.equal(extended["max-parallel"], 4);
  assert.ok(duration(current) <= duration(recorded.previousOrder) - 300,
    "Keep at least five minutes of the recorded four-slot queue improvement; this is not an actual CI timing guarantee");
});
test("a green early checkpoint cannot certify missing, cancelled or failed extended qualification", () => {
  const gate = workflow.jobs.acceptance;
  const results = Object.fromEntries(gate.needs.map(name=>[name,{result:"success"}]));
  const execute = values => spawnSync("bash",["-e","-o","pipefail","-c",gate.steps[0].run],{
    encoding:"utf8",env:{...process.env,RESULTS:JSON.stringify(values)}
  });
  assert.equal(execute(results).status,0);
  for (const result of ["skipped","cancelled","failure"]) {
    const outcome=execute({...results,"quick-extended":{result}});
    assert.equal(outcome.status,1); assert.match(outcome.stderr,new RegExp(`quick-extended: ${result}`));
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
test("administration reference requires real browser paint and layout negative controls", () => {
  const consumer = workflow.jobs["original-browser-reference"];
  const control = consumer.steps.find(step => step.name === "Verify native viewport capture");
  assert.equal(control.if, "matrix.family == 'administration' || matrix.family == 'directory'");
  assert.equal(control.run, "xvfb-run --auto-servernum npm run test:browser-capture:built");
  assert.equal(control.env.UI_SMOKE_ARTIFACT_DIR, "${{ runner.temp }}/original-captures");
  assert.equal(scripts["test:browser-capture:built"], "node --test --test-concurrency=1 scripts/stable-viewport-capture.test.mjs scripts/original-sample-diagnostics.test.mjs scripts/finite-animation-ready.test.mjs");
});
test("isolated console shards retain each of the eight prior checks without a long serial prefix", () => {
  const names=["ui-controller-timer","ui-console-debug","ui-participant-console","ui-participant-command-completion","ui-participant-native-routes"];
  const shards=matrix.filter(item=>names.includes(item.check));
  assert.deepEqual(shards.map(item=>item.check),names);
  const prior=baseline.commands.find(item=>item.check==="ui-participant-console").leaves;
  const actual=shards.flatMap(item=>expand(item.command).split("&&").map(value=>value.trim()));
  assert.equal(actual.length,8);assert.equal(new Set(actual).size,8);
  assert.deepEqual([...actual].sort(),[...prior].sort());
  for(const item of shards){assert.equal(item.playwright,true);assert.ok(item.command.split("&&").length<=2);}
  assert.ok(workflow.jobs.acceptance.needs.includes("verify-memory-sqlite"));
  const timer=workflow.jobs["verify-memory-sqlite"].steps.find(step=>step.name==="Retain failed controller timer diagnostics");
  assert.equal(timer.if,"failure() && matrix.check == 'ui-controller-timer'");
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
 assert.ok(workflow.jobs['browser-system-qualification'].steps.some(step=>step.run==='xvfb-run --auto-servernum npm run test:browser-capture:built'));
});
test('the Original sample retains scoped input/message/save evidence without widening credential or store uploads',()=>{
  const step=workflow.jobs['verify-memory-sqlite'].steps.find(step=>step.name==='Retain Original sample transport diagnostics');
  assert.equal(step.if,'failure() || cancelled()');
  assert.equal(step.with.path.trim(),'${{ runner.temp }}/rewrite-ui-artifacts/original-sample/*.json\n${{ runner.temp }}/rewrite-ui-artifacts/original-sample/*.png');
  assert.equal(step.with['retention-days'],7);
  assert.ok(scripts['test:browser-capture:built'].split(/\s+/).includes('scripts/stable-viewport-capture.test.mjs'));
  assert.ok(scripts['test:browser-capture:built'].split(/\s+/).includes('scripts/original-sample-diagnostics.test.mjs'));
  const source=read('./smoke-ui.mjs');
  assert.ok(source.includes('originalSampleTrace = await observeOriginalSample(page)'));
  assert.ok(source.includes('originalSampleTrace.write(resolve(artifactDirectory,"original-sample"))'));
});
test("test jobs use the same-run build and cannot compile a replacement production frontend", () => {
  assert.equal(workflow.jobs.build.steps.filter(step => step.run === "npm run build").length, 1);
  for (const id of ["unit", "quick", "quick-extended", "verify-memory-sqlite", "verify-postgres", "verify-postgres-ui", "deployability", "docker-compose-release-smoke"]) {
    const job = workflow.jobs[id];
    if (id === "unit") assert.equal(job.needs, "build");
    else if(id === "quick") assert.deepEqual(job.needs,["build","browser-system-dependencies"]);
    else if(["quick-extended","verify-memory-sqlite","verify-postgres-ui"].includes(id)) assert.deepEqual(job.needs,["build","fast-feedback","browser-system-dependencies"]);
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
