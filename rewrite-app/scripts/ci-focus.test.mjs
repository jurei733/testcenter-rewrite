import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { mkdtemp, writeFile, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { parse } from 'yaml';
import { executeFocus, focusChecks, parseFocusCommand, planFocus } from './ci-focus.mjs';

const workflow = parse(readFileSync(new URL('../../.github/workflows/rewrite-app-ci.yml', import.meta.url), 'utf8'));
const scripts = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8')).scripts;
const checks = focusChecks(workflow, scripts);

test('every actual Quick, qualification and memory/SQLite shard has an executable focused plan', () => {
  const actual = ['quick', 'quick-extended', 'verify-memory-sqlite']
    .flatMap(job => workflow.jobs[job].strategy.matrix.include);
  assert.equal(checks.length, actual.length + 3);
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

test('policy and no-emit typecheck need no production build; unit retains one', () => {
  assert.equal(planFocus(['policy', 'typecheck'], checks).build, false);
  assert.equal(planFocus(['unit'], checks).build, true);
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
  const result = spawnSync(process.execPath, [new URL('./ci-focus.mjs', import.meta.url).pathname,
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
    const result = spawnSync(process.execPath, [new URL('./ci-focus.mjs', import.meta.url).pathname,
      'ui-participant-console', 'original-login'], { encoding: 'utf8',
      env: { ...process.env, npm_execpath: npm, UI_SMOKE_HEADFUL: 'false' } });
    assert.equal(result.status, 37, result.stderr);
    assert.deepEqual((await readFile(calls, 'utf8')).trim().split('\n').map(JSON.parse),
      ['build', 'smoke:ui:participant-console-loading:built']);
    assert.ok(result.stdout.includes('"status":37'));
  } finally { await rm(directory, { recursive: true, force: true }); }
});
