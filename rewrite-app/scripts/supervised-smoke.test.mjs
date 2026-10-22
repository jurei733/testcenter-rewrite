import assert from 'node:assert/strict';
import {spawn, execFileSync} from 'node:child_process';
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {runSupervisedSmoke, signalOwnedSmokeProcess} from './supervised-smoke.mjs';

const helper = new URL('./supervised-smoke.mjs', import.meta.url).href;
test('a denied owned signal is retained and cannot skip remaining process or group cleanup', () => {
  const failures = [], calls = [];
  const kill = (pid, name) => {
    calls.push([pid, name]);
    if (pid === 4102) throw Object.assign(Error('owned denial'), {code: 'EPERM'});
    if (pid === 4103) throw Object.assign(Error('already exited'), {code: 'ESRCH'});
  };
  for (const pid of [4102, 4103, 4104, -4101]) signalOwnedSmokeProcess(pid, 'SIGTERM', failures, kill);
  assert.deepEqual(calls.map(([pid]) => pid), [4102, 4103, 4104, -4101]);
  assert.deepEqual(failures, [{pid: 4102, signal: 'SIGTERM', code: 'EPERM'}]);
});

test('cleanup rejects system and malformed process IDs before signaling', () => {
  for (const pid of [0, 1, -1, undefined, NaN, 1.5]) {
    assert.throws(() => signalOwnedSmokeProcess(pid, 'SIGTERM', [], () => assert.fail('No signal permitted')));
  }
});

async function fixture(source, check, options = {}) {
  const directory = await mkdtemp(join(tmpdir(), 'owned-supervision-test-'));
  const entry = join(directory, 'child.mjs'), evidence = join(directory, 'evidence');
  try {
    await writeFile(entry, `import {reportSmokePhase,reportSmokeObservation,isSupervisedSmokeChild} from ${JSON.stringify(helper)};\n` +
      `if(!isSupervisedSmokeChild(import.meta.url)) throw Error('Missing exact child entry marker');\n` + source);
    const result = await runSupervisedSmoke({entry, artifactDirectory: evidence,
      env: {...process.env, OWNED_TEST_SECRET: 'must-not-be-recorded'},
      phaseTimeoutMs: 500, totalTimeoutMs: 3000, killGraceMs: 50, ...options});
    const raw = await readFile(join(evidence, 'supervision.json'), 'utf8');
    assert.ok(!raw.includes('must-not-be-recorded'));
    await check(result, JSON.parse(raw), directory);
  } finally {await rm(directory, {recursive: true, force: true});}
}

test('successful work clears its long watchdog and records actual child completion', () => fixture(
  `reportSmokePhase('all-real-checks-passed');`,
  (result, record) => {
    assert.equal(result, 0); assert.equal(record.outcome, 'passed');
    assert.equal(record.phases.at(-1).phase, 'all-real-checks-passed');
    assert.deepEqual(record.exit, {code: 0, signal: null});
  }, {phaseTimeoutMs: 60_000, totalTimeoutMs: 60_000}));

test('a real failing child keeps its exact upstream failure status', () => fixture(
  `reportSmokePhase('owned-assertion-failed');process.exitCode=37;`,
  (result, record) => {
    assert.equal(result, 37); assert.equal(record.outcome, 'failed');
    assert.equal(record.exit.code, 37);
  }));

test('a blocked child event loop cannot prevent phase timeout evidence or fatal cleanup', () => fixture(
  `reportSmokePhase('blocked-browser-evaluation');while(true){}`, (result, record) => {
    assert.equal(result, 1); assert.equal(record.outcome, 'phase-timeout');
    assert.equal(record.phases.at(-1).phase, 'blocked-browser-evaluation');
    assert.ok(record.ownedPids.includes(record.childPid));
  }));

test('repeated phase progress cannot postpone the absolute smoke deadline', () => fixture(
  `setInterval(()=>reportSmokePhase('active-but-never-finished'),30);`,
  (result, record) => {assert.equal(result, 1); assert.equal(record.outcome, 'total-timeout');},
  {phaseTimeoutMs: 500, totalTimeoutMs: 700}));

test('operation observations preserve their order without postponing a stalled phase', () => fixture(
  `reportSmokePhase('owned-stalled-operation');let n=0;setInterval(()=>reportSmokeObservation('owned-step:'+n++),20);`,
  (result, record) => {
    assert.equal(result,1);assert.equal(record.outcome,'phase-timeout');
    assert.equal(record.phases.at(-1).phase,'owned-stalled-operation');
    assert.ok(record.observations.length>3);
    assert.deepEqual(record.observations.map(item=>item.observation),record.observations.map((_,i)=>'owned-step:'+i));
    assert.ok(record.failedAt-record.phases.at(-1).at<1500,'Diagnostic activity must not keep a phase alive.');
  }));

test('timeout kills an owned detached grandchild and leaves an unrelated process running', async () => {
  const sentinel = spawn(process.execPath, ['-e', 'setInterval(()=>{},1000)'], {stdio: 'ignore'});
  let grandchild;
  try {
    await fixture(`import {spawn} from 'node:child_process';
      const child=spawn(process.execPath,['-e',"process.on('SIGTERM',()=>{});setInterval(()=>{},1000)"],{detached:true,stdio:'ignore'});
      reportSmokePhase('owned-detached-child:'+child.pid);setInterval(()=>{},1000);`,
    async (result, record) => {
      assert.equal(result, 1); assert.equal(record.outcome, 'phase-timeout');
      grandchild = Number(record.phases.at(-1).phase.split(':')[1]);
      assert.ok(record.ownedPids.includes(grandchild));
      assert.ok(!record.ownedPids.includes(sentinel.pid));
      process.kill(sentinel.pid, 0);
      let state;
      try {state = execFileSync('ps', ['-o', 'stat=', '-p', String(grandchild)], {encoding: 'utf8'}).trim();}
      catch {state = '';}
      assert.ok(!state || state.startsWith('Z'), 'The owned detached process must be terminated');
    });
  } finally {
    sentinel.kill('SIGKILL');
    if (grandchild) {try {process.kill(grandchild, 'SIGKILL');} catch (error) {if(error.code !== 'ESRCH') throw error;}}
  }
});
