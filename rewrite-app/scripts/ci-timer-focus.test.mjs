import assert from 'node:assert/strict';
import {readFile, mkdtemp, writeFile, rm} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {fileURLToPath} from 'node:url';
import test from 'node:test';
import {parse} from 'yaml';
import {focusChecks, planFocus} from './ci-focus.mjs';

const read = name => readFile(new URL(name, import.meta.url), 'utf8');
const focus = parse(await read('../../.github/workflows/rewrite-timer-focus.yml'));
const full = parse(await read('../../.github/workflows/rewrite-app-ci.yml'));
const versions = JSON.parse(await read('./fixtures/ci-action-versions.json'));
const scripts = JSON.parse(await read('../package.json')).scripts;
const job = focus.jobs['focused-timer'];
const run = job.steps.find(step => step.name === 'Build once and run both complete timer entries from the acceptance inventory');

test('focused timer uses a fixed complete selection, fresh checkout and authenticated native material in one owned job', () => {
  assert.deepEqual(Object.keys(focus.on).sort(), ['workflow_call', 'workflow_dispatch']);
  assert.ok(Object.values(focus.on).every(value => value === null));
  assert.deepEqual(focus.permissions, {contents:'read'});
  assert.deepEqual(focus.concurrency, {group:'${{ github.workflow }}-${{ github.ref }}-controller-timer', 'cancel-in-progress':true});
  assert.deepEqual(Object.keys(focus.jobs), ['focused-timer']);
  assert.equal(job['runs-on'], 'ubuntu-24.04');
  assert.equal(job['timeout-minutes'], 25);
  assert.equal(job.needs, undefined);
  assert.equal(job.env.UI_SMOKE_HEADFUL, full.jobs['verify-memory-sqlite'].env?.UI_SMOKE_HEADFUL);
  assert.equal(job.env.FIRST_SLICE_XML_SCHEMA_CACHE, full.env.FIRST_SLICE_XML_SCHEMA_CACHE);
  const checkout = job.steps.find(step => step.uses?.startsWith('actions/checkout@'));
  assert.equal(checkout.uses, 'actions/checkout@'+versions.checkout.sha);
  assert.equal(checkout.with['persist-credentials'], false);
  const setup = job.steps.findIndex(step => step.uses === './.github/actions/rewrite-runtime');
  assert.equal(job.steps[setup].with, undefined, 'No inherited build or material from another run');
  assert.equal(job.steps[setup-1].run, 'bash scripts/ci-browser-cohort.sh record');
  const native = job.steps.find(step => step.name === 'Install authenticated native packages and verify actual browser material');
  const fullNative = full.jobs['browser-system-dependencies'].steps.find(step => step.id === 'packages');
  assert.equal(native.run, fullNative.run);
  assert.deepEqual(native.env, fullNative.env);
  assert.ok(job.steps.findIndex(step => step.run?.includes('playwright install chromium')) < job.steps.indexOf(native));
  assert.ok(job.steps.indexOf(native) < job.steps.indexOf(run));
  for (const command of ['npm audit --package-lock-only --include=dev --include=optional --audit-level=high',
    'npm run test:ci-policy', 'node --test scripts/ci-browser-system-linux.test.mjs']) {
    assert.ok(job.steps.some(step => step.run === command));
  }
  const cache = job.steps.find(step => step.uses?.startsWith('actions/cache@'));
  const fullCache = full.jobs['browser-system-dependencies'].steps.find(step => step.uses?.startsWith('actions/cache@'));
  assert.deepEqual(cache.with, fullCache.with);
  for (const step of job.steps) {
    if (step.uses?.startsWith('actions/')) {
      const name = step.uses.slice(8).split('@')[0];
      assert.equal(step.uses, 'actions/'+name+'@'+versions[name].sha);
    }
    assert.notEqual(step['continue-on-error'], true);
    assert.equal(step['retry-max-attempts'], undefined);
    assert.ok(!/\$\{\{.*inputs\.|--with-deps|apt-get|audit fix|--force|download-artifact/.test(step.run ?? step.uses ?? ''));
  }
  assert.notEqual(job['continue-on-error'], true);
  assert.match(focus.name, /not acceptance/);
  assert.match(job.name, /not complete acceptance/);
});

test('focused timer plans both exact acceptance entries with one complete fresh production build', () => {
  assert.equal(run.run, 'npm run ci:focus -- verify/ui-controller-timer');
  const selected = run.run.split(' -- ')[1];
  const plan = planFocus([selected], focusChecks(full, scripts));
  assert.equal(plan.completeAcceptance, false);
  assert.equal(plan.buildScript, 'build');
  assert.equal(plan.checks.length, 1);
  assert.equal(plan.checks[0].browser, true);
  assert.equal(plan.checks[0].headed, false);
  assert.deepEqual(plan.checks[0].steps, [
    {script:'reference:ui:original-controller-timer:built', env:{}},
    {script:'smoke:ui:participant-controller-timer:built', env:{}}
  ]);
  for (const event of ['push', 'pull_request']) {
    assert.ok(full.on[event].paths.includes('.github/workflows/rewrite-timer-focus.yml'));
  }
  assert.ok(scripts['test:ci-policy'].split(/\s+/).includes('scripts/ci-timer-focus.test.mjs'));
});

test('the actual focused timer CLI preserves build and either timer failure without retry or a skipped successor', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'owned-timer-focus-'));
  try {
    const calls = join(directory, 'calls.jsonl'), npm = join(directory, 'npm.mjs');
    await writeFile(npm, "import {appendFileSync} from 'node:fs';const script=process.argv[3];appendFileSync(process.env.OWNED_CALLS,JSON.stringify(script)+'\\n');process.exitCode=script===process.env.OWNED_FAIL?37:0;");
    const expected = ['build', 'reference:ui:original-controller-timer:built', 'smoke:ui:participant-controller-timer:built'];
    for (const fail of ['', ...expected]) {
      await writeFile(calls, '');
      const result = spawnSync(process.execPath, [fileURLToPath(new URL('./ci-focus.mjs', import.meta.url)), run.run.split(' -- ')[1]], {
        encoding:'utf8', env:{...process.env, npm_execpath:npm, OWNED_CALLS:calls, OWNED_FAIL:fail,
          OWNED_PRIVATE_ENV:'OWNED_TIMER_FOCUS_PRIVATE_SENTINEL'}
      });
      assert.equal(result.status, fail ? 37 : 0, result.stderr);
      assert.deepEqual((await readFile(calls, 'utf8')).trim().split('\n').map(JSON.parse),
        fail ? expected.slice(0, expected.indexOf(fail)+1) : expected);
      assert.equal(result.stdout.includes('OWNED_TIMER_FOCUS_PRIVATE_SENTINEL'), false);
      assert.equal(result.stderr.includes('OWNED_TIMER_FOCUS_PRIVATE_SENTINEL'), false);
    }
  } finally {await rm(directory, {recursive:true, force:true});}
});

test('focused timer retains bounded public receipts independently of failure and never uploads private stores or package archives', () => {
  const uploads = job.steps.filter(step => step.uses?.startsWith('actions/upload-artifact@'));
  assert.equal(uploads.length, 3);
  const receipts = uploads.find(step => step.name === 'Retain bounded timer receipts on success or failure');
  const failure = uploads.find(step => step.name === 'Retain failed controller timer diagnostics');
  const material = uploads.find(step => step.name === 'Retain owned runtime material diagnostics');
  assert.equal(receipts.if, 'always()');
  assert.equal(failure.if, 'failure() || cancelled()');
  assert.equal(material.if, 'always()');
  const root = run.env.UI_SMOKE_CONTROLLER_TIMER_ARTIFACT_ROOT;
  assert.equal(root, '${{ runner.temp }}/controller-timer-diagnostics');
  assert.deepEqual(receipts.with.path.trim().split('\n'), ['supervision.json', 'worker-reference.json'].map(name => root+'/**/'+name));
  assert.deepEqual(failure.with.path.trim().split('\n'), ['failure.json', 'api.log'].map(name => root+'/**/'+name));
  assert.equal(material.with.path, '${{ runner.temp }}/browser-material-*/');
  for (const upload of uploads) {
    assert.equal(upload.with['retention-days'], 7);
    assert.ok(upload.with.name.endsWith('-${{ github.sha }}-${{ github.run_attempt }}'));
    assert.notEqual(upload.with.overwrite, true);
    assert.ok(!/\.sqlite|browser-system|\.deb|\.data|\*\*\/$/.test(upload.with.path));
  }
});
