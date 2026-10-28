import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { parse } from 'yaml';
import { executeFocus, focusChecks, parseFocusCommand, planFocus } from './ci-focus.mjs';

const workflow = parse(readFileSync(new URL('../../.github/workflows/rewrite-app-ci.yml', import.meta.url), 'utf8'));
const scripts = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).scripts;
const checks = focusChecks(workflow, scripts);
const cli = fileURLToPath(new URL('./ci-focus.mjs', import.meta.url));

test('every actual Quick, qualification and memory/SQLite shard has an executable focused plan', () => {
  const actual = ['quick', 'quick-extended-long', 'quick-extended', 'verify-long-ui', 'verify-memory-sqlite']
    .flatMap(job => workflow.jobs[job].strategy.matrix.include);
  assert.equal(checks.length, actual.length + 6);
  for (const item of actual) {
    const plan = planFocus([item.check], checks);
    assert.equal(plan.checks[0].check, item.check);
    assert.deepEqual(plan.checks[0].steps, parseFocusCommand(item.command, scripts));
    assert.equal(plan.completeAcceptance, false);
  }
});

test('multiple selected shards share one fresh production build and retain every command in order', () => {
  const plan = planFocus(['ui-participant-console', 'ui-attachments', 'verify/ui-participant-console'], checks);
  assert.equal(plan.checks.length, 2);
  const calls = [];
  assert.equal(executeFocus(plan, (step, check) => { calls.push({ step, id: check.id }); return 0; }), 0);
  assert.deepEqual(calls.map(call => call.step.script), ['build', 'smoke:ui:participant-console-loading:built',
    'smoke:ui:participant-console-context-compat:built', 'smoke:ui:attachments:built',
    'smoke:ui:attachments-live:built', 'smoke:ui:attachments-live:built']);
  assert.deepEqual(calls.at(-1).step.env, { UI_SMOKE_ATTACHMENT_CAMERA_FACING: 'front' });
  assert.deepEqual(calls.at(-2).step.env, {});
});
test('moving a long suite retains its public selector, exact command, browser mode and one fresh build', () => {
  const plan = planFocus(['verify/ui-full','ui-full','integration-file'], checks);
  assert.deepEqual(plan.checks.map(check => check.id), ['verify/ui-full','verify/integration-file']);
  assert.equal(plan.checks[0].browser, true); assert.equal(plan.checks[0].headed, false);
  const calls = [];
  assert.equal(executeFocus(plan, step => { calls.push(step.script); return 0; }), 0);
  assert.deepEqual(calls, ['build','smoke:ui:built','test:integration:file:built']);
  calls.length = 0;
  assert.equal(executeFocus(plan, step => { calls.push(step.script); return step.script==='smoke:ui:built'?37:0; }), 37);
  assert.deepEqual(calls, ['build','smoke:ui:built']);
});

test('a failing production build stops all tests and retains its exact status', () => {
  const calls = [];
  assert.equal(executeFocus(planFocus(['original-login'], checks), step => { calls.push(step.script); return 37; }), 37);
  assert.deepEqual(calls, ['build']);
});

test('a failing first leaf stops later leaves and selected shards without a retry', () => {
  const calls = [];
  assert.equal(executeFocus(planFocus(['ui-participant-console', 'original-login'], checks), step => {
    calls.push(step.script); return step.script === 'build' ? 0 : 41;
  }), 41);
  assert.deepEqual(calls, ['build', 'smoke:ui:participant-console-loading:built']);
});

test('policy and no-emit typecheck need no build; unit uses its declared core dependency', () => {
  assert.equal(planFocus(['policy', 'typecheck'], checks).build, false);
  assert.equal(scripts['test:unit'], 'npm run build:core && npm run test:unit:built');
  assert.equal(planFocus(['unit'], checks).buildScript, 'build:core');
  assert.equal(planFocus(['original-login'], checks).checks[0].headed, true);
  assert.equal(planFocus(['integration-sqlite'], checks).checks[0].browser, false);
});

test('unknown, ambiguous, conflicting and shell-like selections fail before any build', () => {
  for (const args of [[], ['--built', 'unit'], ['--plan', '--plan', 'unit'], ['--list', 'unit'],
    ['--list', '--plan'], ['unknown'], ['unit;touch /tmp/owned-focus-injected'], ['$(echo unit)']]) {
    assert.throws(() => planFocus(args, checks));
  }
  assert.throws(() => planFocus(['same'], [{ id: 'a/same', check: 'same' }, { id: 'b/same', check: 'same' }]));
});

test('workflow shell expansions and arbitrary environment writes are rejected instead of executed', () => {
  for (const command of ['npm run unit; echo injected', 'npm run unit || true', 'npm run $(echo unit)',
    'npm run unit -- --test-skip-pattern=all', 'NODE_OPTIONS=--inspect npm run unit',
    'UI_SMOKE_ATTACHMENT_CAMERA_FACING=$(echo front) npm run unit', 'npm run missing', 'npm run unit &&']) {
    assert.throws(() => parseFocusCommand(command, { unit: 'owned' }));
  }
});

test('the actual CLI plan builds nothing and exports no inherited credential values', () => {
  const result = spawnSync(process.execPath, [cli,
    '--plan', 'ui-participant-console'], { encoding: 'utf8',
    env: { ...process.env, FIRST_SLICE_POSTGRES_URL: 'owned-focus-secret-must-not-appear' } });
  assert.equal(result.status, 0, result.stderr);
  const plan = JSON.parse(result.stdout);
  assert.equal(plan.build, true); assert.equal(plan.dryRun, true);
  assert.equal(plan.checks[0].steps.length, 2);
  assert.equal(result.stdout.includes('owned-focus-secret-must-not-appear'), false);
});

test('the actual CLI preserves a failing npm child status and does not dispatch a later command', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'owned-focus-status-'));
  const npm = join(directory, 'npm.mjs'), calls = join(directory, 'calls.jsonl');
  try {
    await writeFile(npm, `import {appendFileSync} from 'node:fs';
      const script=process.argv[3];
      appendFileSync(${JSON.stringify(calls)},JSON.stringify(script)+'\\n');
      process.exitCode=script==='build'?0:37;`);
    const result = spawnSync(process.execPath, [cli,
      'ui-participant-console', 'original-login'], { encoding: 'utf8',
      env: { ...process.env, npm_execpath: npm, UI_SMOKE_HEADFUL: 'false' } });
    assert.equal(result.status, 37, result.stderr);
    assert.deepEqual((await readFile(calls, 'utf8')).trim().split('\n').map(JSON.parse),
      ['build', 'smoke:ui:participant-console-loading:built']);
    assert.ok(result.stdout.includes('"status":37'));
  } finally { await rm(directory, { recursive: true, force: true }); }
});


test('Original service suites build core once; mixed and unknown consumers require the full production build', () => {
  const plan = planFocus(['original-results'], checks), calls = [];
  assert.equal(plan.buildScript, 'build:core');
  assert.equal(executeFocus(plan, step => {calls.push(step.script);return 0;}), 0);
  assert.deepEqual(calls, ['build:core', 'test:original-results:built']);
  assert.equal(planFocus(['original-results', 'ui-participant-console'], checks).buildScript, 'build');
  assert.equal(planFocus(['original-results', 'unit'], checks).buildScript, 'build:core');
  assert.equal(planFocus(['policy'], checks).buildScript, null);
  const unknown = [{id:'future',check:'future',build:true,browser:false,steps:[{script:'future:built',env:{}}]}];
  assert.equal(planFocus(['future'], unknown).buildScript, 'build');
});

test('a failing core build blocks all selected checks and keeps its status', () => {
  const calls=[];
  assert.equal(executeFocus(planFocus(['original-results'], checks),step=>{calls.push(step.script);return 43;}),43);
  assert.deepEqual(calls,['build:core']);
});

test('participant authentication focus retains all existing identity, HTTP, credential and logout checks', () => {
  const plan=planFocus(['participant-auth'],checks),calls=[];
  assert.equal(plan.buildScript,'build:core');
  assert.equal(plan.completeAcceptance,false);
  assert.equal(scripts['test:participant-auth'],'npm run build:core && npm run test:participant-auth:built');
  const files=scripts['test:participant-auth:built'].replace(/^node --test /,'').split(' ');
  assert.deepEqual(files,['scripts/original-participant-group.test.mjs','scripts/original-login-binding.test.mjs',
    'scripts/original-person-identity.test.mjs','scripts/original-login-protocol.test.mjs','scripts/original-operational-login.test.mjs','scripts/original-session.test.mjs','scripts/original-person-content-migration.test.mjs','scripts/participant-run-creation-api.test.mjs',
    'scripts/participant-access-credentials.test.mjs','scripts/participant-sign-out.test.mjs']);
  const mandatory=(scripts['test:unit:built']+' '+scripts['test:frontend-state']).split(/\s+/);
  for(const file of files)assert.ok(mandatory.includes(file),`${file} remains in required unit CI`);
  assert.equal(executeFocus(plan,step=>{calls.push(step.script);return 0;}),0);
  assert.deepEqual(calls,['build:core','test:participant-auth:built']);
  assert.equal(planFocus(['participant-auth','original-results','unit'],checks).buildScript,'build:core');
  assert.equal(planFocus(['participant-auth','original-login'],checks).buildScript,'build');
});
