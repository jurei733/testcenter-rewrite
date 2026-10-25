import assert from 'node:assert/strict';
import {readFile, writeFile, mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {pathToFileURL} from 'node:url';
import test from 'node:test';
import {parse} from 'yaml';
import {createTimerSmokeConfiguration} from './timer-smoke-supervision.mjs';
import {runSupervisedSmoke} from './supervised-smoke.mjs';

const read = path => readFile(new URL(path, import.meta.url), 'utf8');
test('both actual timer entries retain their complete supervised execution and bounded public evidence', async () => {
  for (const [name, kind] of [['reference-original-controller-timer-worker.mjs','original-timer-reference'],['smoke-participant-controller-timer-interruption.mjs','participant-controller-timer']]) {
    const source = await read('./'+name);
    assert.match(source, /if \(!isSupervisedSmokeChild\(import\.meta\.url\)\)/);
    assert.ok(source.indexOf('await superviseTimerSmoke(') < source.indexOf(name.startsWith('reference-') ? 'const fixture=' : 'const root='));
    assert.ok(source.includes(`await superviseTimerSmoke(import.meta.url, '${kind}')`));
    assert.ok(source.includes('reportSmokePhase('));
  }
  const original = await read('./reference-original-controller-timer-worker.mjs');
  assert.ok(original.includes("'pause','terminate','terminate-error','zero-pause-enforced','zero-pause-preview','expired-enforced','expired-preview','goto-reentry','goto-zero-reentry'"));
  const rewrite = await read('./smoke-participant-controller-timer-interruption.mjs');
  for (const text of ["'unrouteAll cleanup'", "'context cleanup'", 'await routeFailures.settle();', "assert.equal(final.status,'paused')", 'scenario.legacyZero', 'scenario.lostLegacyReply']) assert.ok(rewrite.includes(text), text);
  assert.ok(rewrite.includes('reportSmokeObservation(`case-${index}:route-enter:${pattern}`)'));
  const workflow = parse(await read('../../.github/workflows/rewrite-app-ci.yml'));
  const job = workflow.jobs['verify-memory-sqlite'];
  const timer = job.strategy.matrix.include.find(item=>item.check==='ui-controller-timer');
  assert.equal(timer.command, 'npm run reference:ui:original-controller-timer:built && npm run smoke:ui:participant-controller-timer:built');
  const retain = job.steps.find(step=>step.name==='Retain failed controller timer diagnostics');
  assert.equal(retain.if, "(failure() || cancelled()) && matrix.check == 'ui-controller-timer'");
  assert.equal(retain.with['retention-days'],7);
  assert.deepEqual(retain.with.path.trim().split('\n').map(line=>line.trim()), ['failure.json','api.log','supervision.json','worker-reference.json'].map(name=>'${{ runner.temp }}/controller-timer-diagnostics/**/'+name));
  assert.ok(!retain.with.path.includes('sqlite'));
  const scripts = JSON.parse(await read('../package.json')).scripts;
  assert.ok(scripts['test:frontend-state'].split(/\s+/).includes('scripts/timer-smoke-supervision.test.mjs'));
});

test('timer supervision has fixed case/total budgets and owned artifact paths', () => {
  const root = join(tmpdir(),'owned-timer-config'), entry = new URL('./reference-original-controller-timer-worker.mjs',import.meta.url);
  for (const name of ['original-timer-reference','participant-controller-timer']) {
    const config = createTimerSmokeConfiguration({entry,name,artifactRoot:root,env:{OWNED_SENTINEL:'not public'}});
    assert.equal(config.phaseTimeoutMs,60000);assert.equal(config.totalTimeoutMs,480000);
    assert.equal(config.artifactDirectory,join(root,name));assert.equal(config.env.UI_SMOKE_CONTROLLER_TIMER_ARTIFACT_ROOT,root);
    assert.equal(config.env.OWNED_SENTINEL,'not public');assert.ok(config.entry.endsWith('/reference-original-controller-timer-worker.mjs'));
  }
  for (const name of ['../elsewhere','participant-controller-timer; false','unknown','']) assert.throws(()=>createTimerSmokeConfiguration({entry,name,artifactRoot:root}),/Unknown owned/);
  assert.throws(()=>createTimerSmokeConfiguration({entry,name:'original-timer-reference',artifactRoot:''}),/owned directory/);
});

for (const blocked of [false,true]) test(`actual timer supervisor ${blocked?'fails a non-settling phase':'accepts a completed phase'} and keeps environment material private`, {timeout:15000}, async () => {
  const directory = await mkdtemp(join(tmpdir(),'owned-timer-boundary-'));
  try {
    const entry = join(directory,'entry.mjs');
    await writeFile(entry, "process.send({type:'owned-smoke-phase',phase:'owned-timer-fixture'});"+(blocked?"setInterval(()=>{},1000);":""));
    const configuration = createTimerSmokeConfiguration({entry:pathToFileURL(entry),name:'participant-controller-timer',artifactRoot:directory,env:{...process.env,OWNED_PRIVATE_ENV:'OWNED_TIMER_PRIVATE_ENV_SENTINEL'}});
    // Exercise the real configured entry/owner/evidence path with short test
    // budgets; production configuration above stays fixed and non-optional.
    const code = await runSupervisedSmoke({...configuration,phaseTimeoutMs:1000,totalTimeoutMs:5000,killGraceMs:50});
    assert.equal(code,blocked?1:0);
    const bytes = await readFile(join(configuration.artifactDirectory,'supervision.json'),'utf8'), receipt = JSON.parse(bytes);
    assert.equal(receipt.outcome,blocked?'phase-timeout':'passed');
    assert.ok(receipt.phases.some(row=>row.phase==='owned-timer-fixture'));
    assert.equal(bytes.includes('OWNED_TIMER_PRIVATE_ENV_SENTINEL'),false);
    assert.equal('env' in receipt,false);
  } finally {await rm(directory,{recursive:true,force:true});}
});
