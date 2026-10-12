import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { Worker } from 'node:worker_threads';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { Pool } from 'pg';
import { createFirstSliceServices } from '@testcenter-rewrite-app/application';
import { compileBookletRuntimePolicy } from '@testcenter-rewrite-app/contracts';
import { createInMemoryFirstSliceRepository } from '@testcenter-rewrite-app/memory-store';
import { createFileFirstSliceRepository } from '@testcenter-rewrite-app/file-store';
import { createSqliteFirstSliceRepository } from '@testcenter-rewrite-app/sqlite-store';
import { createPostgresFirstSliceStorage } from '@testcenter-rewrite-app/postgres-store';

const timestamp = '2026-10-11T00:00:00.000Z';
const kinds = ['memory', 'file', 'sqlite'];
if (process.env.FIRST_SLICE_STORE === 'postgres') { assert.ok(process.env.FIRST_SLICE_POSTGRES_URL); kinds.push('postgres'); }

for (const kind of kinds) test(`${kind}: participant runtime transitions, progress and timers commit from the current Run`, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'testcenter-run-mutation-'));
  const file = join(directory, kind === 'sqlite' ? 'owned.sqlite' : 'owned.json');
  const schema = 'owned_run_mutation_' + randomUUID().replaceAll('-', '');
  const applicationName = schema;
  const url = kind === 'postgres' ? new URL(process.env.FIRST_SLICE_POSTGRES_URL) : null;
  url?.searchParams.set('options', `-c search_path=${schema}`);
  url?.searchParams.set('application_name', applicationName);
  const storages = [];
  let rootPool, control, created = false;
  const create = async () => {
    if (kind === 'memory') return createInMemoryFirstSliceRepository();
    if (kind === 'file') return createFileFirstSliceRepository(file);
    if (kind === 'sqlite') return createSqliteFirstSliceRepository(file);
    const storage = await createPostgresFirstSliceStorage(url.toString()); storages.push(storage); return storage.repository;
  };
  let repository;
  const service = repository => createFirstSliceServices({ repository, now: () => timestamp });
  const writeAfterInitialRead = (repository, action) => {
    let once = true;
    return new Proxy(repository, { get(target, property) {
      if (property === 'mutateParticipantRun') return async (input, transform) => {
        if (once) { once = false; await action(input); }
        return target.mutateParticipantRun(input, transform);
      };
      return Reflect.get(target, property);
    } });
  };
  const fixture = async ({ timed = false, liveTimer = false, gate = false, adaptive = false, mode = 'run-hot-return', status = 'running' } = {}) => {
    const services = service(repository);
    const tenant = await services.platform.createTenant({ tenantKey: 'owned-' + randomUUID(), displayName: 'Owned mutation test' });
    const workspace = await services.platform.createWorkspace({ tenantKey: tenant.tenantKey, workspaceKey: 'owned', displayName: 'Owned mutation test' });
    const id = randomUUID(), base = { tenantId: tenant.tenantId, workspaceId: workspace.workspaceId, createdAt: timestamp };
    const booklet = key => ({ bookletKey: key, displayLabel: key, policy: compileBookletRuntimePolicy({}),
      ...(adaptive ? { stateEntries: [{ stateKey: 'choice', displayLabel: 'Choice', options: ['first', 'second'].map(optionKey => ({ optionKey, displayLabel: optionKey, conditions: [] })) }] } : {}),
      testletEntries: [{ testletKey: 'outer', displayLabel: 'Outer', parentTestletKey: null, restrictions: timed ? { timeMax: { minutes: 5, leave: 'allowed' } } : {} },
        ...(gate ? [{ testletKey: 'gate', displayLabel: 'Owned gate', parentTestletKey: 'outer', restrictions: { codeToEnter: { code: 'OWN', prompt: 'Code' } } }] : [])],
      unitEntries: ['unit', 'second'].map(unitKey => ({ unitKey, displayLabel: unitKey, testletPath: gate && unitKey === 'second' ? ['outer', 'gate'] : ['outer'] })) });
    await repository.saveContentRelease({ ...base, contentReleaseId: id, importJobId: id, releaseLabel: 'Owned', status: 'active', activatedAt: timestamp,
      runtimeSnapshot: { bookletEntries: [booklet('owned'), booklet('other')] } });
    const parent = { ...base, participantSessionId: id, contentReleaseId: id, loginKey: id, groupKey: 'owned', participantCode: 'owned original code', status: 'launched', executionMode: mode };
    await repository.saveParticipantSession(parent);
    const run = { ...base, testRunId: id, participantSessionId: id, contentReleaseId: id, bookletKey: 'owned', executionMode: mode, status,
      currentUnitKey: 'unit', unitResponses: { unit: 'Exact baseline Ä/β\n  spaces  ' }, updatedAt: timestamp, completedAt: null,
      testletTimers: timed ? { outer: { testletKey: 'outer', status: 'running', durationSeconds: 300, remainingSeconds: 300,
        startedAt: liveTimer ? timestamp : '2026-10-10T23:50:00.000Z', expiresAt: liveTimer ? '2026-10-11T00:05:00.000Z' : '2026-10-10T23:55:00.000Z', updatedAt: timestamp, endedAt: null } } : {} };
    await repository.saveTestRun(run);
    return { id, run: await repository.getTestRunById(id), parent, services, base, tenantKey: tenant.tenantKey, workspaceKey: workspace.workspaceKey };
  };
  const snapshot = async f => ({ run: await repository.getTestRunById(f.id), parent: await repository.getParticipantSessionById(f.id),
    logs: await repository.listParticipantTestLogsByWorkspace(f.base.tenantId, f.base.workspaceId),
    events: await repository.listWorkspaceActivityEventsByWorkspace(f.base.tenantId, f.base.workspaceId),
    commands: await repository.listPendingParticipantRunCommands(f.run) });
  const effect = (context, answer = 'Owned newer answer') => ({ testRun: { ...context.testRun, unitResponses: { ...context.testRun.unitResponses, second: answer } },
    testLogs: [{ participantTestLogId: 'owned-log-' + context.testRun.testRunId, ...context.testRun, unitKey: 'second', originalUnitId: 'second', logKey: 'RESPONSE_SAVED', logContent: answer, timestamp: Date.parse(timestamp), recordedAt: timestamp }],
    activityEvents: [{ activityEventId: 'owned-event-' + context.testRun.testRunId, tenantId: context.testRun.tenantId, workspaceId: context.testRun.workspaceId,
      eventType: 'test_run_progress_saved', actorId: null, subjectType: 'test_run', subjectId: context.testRun.testRunId, occurredAt: timestamp, summary: 'Owned projection', details: {} }] });
  const issue = (services, f, commandType) => services.monitorControl.issueRunCommand({
    tenantKey: f.tenantKey, workspaceKey: f.workspaceKey, testRunId: f.id, commandType, actorId: 'owned-monitor' });
  const operations = [
    { name: 'resumeRun', options: { status: 'paused' }, invoke: (s, f) => s.participantRuntime.resumeRun({ testRunId: f.id }) },
    { name: 'resumeSession', options: { status: 'paused' }, invoke: (s, f) => s.participantRuntime.resumeSession({ participantSessionId: f.id, bookletKey: 'owned' }) },
    { name: 'prepareStarterExit', options: { timed: true, liveTimer: true }, invoke: (s, f) => s.participantRuntime.prepareStarterExit({ testRunId: f.id, currentUnitKey: 'unit' }) },
    { name: 'returnToStarter', invoke: (s, f) => s.participantRuntime.returnToStarter({ testRunId: f.id, currentUnitKey: 'unit', expectedStatus: 'running' }) },
    { name: 'completeRun', invoke: (s, f) => s.participantRuntime.completeRun({ testRunId: f.id }) },
    { name: 'unlockTestlet', options: { gate: true }, invoke: (s, f) => s.participantRuntime.unlockTestlet({ testRunId: f.id, testletKey: 'gate', code: 'OWN' }) },
    { name: 'selectAdaptiveState', options: { adaptive: true, mode: 'run-trial' }, invoke: (s, f) => s.participantRuntime.selectAdaptiveState({ testRunId: f.id, stateKey: 'choice', optionKey: 'second' }) },
    { name: 'monitor native lock', monitor: true, invoke: (s, f) => issue(s, f, 'lock_test') },
    { name: 'monitor deferred pause', monitor: true, invoke: (s, f) => issue(s, f, 'pause') }
  ];
  try {
    if (url) { rootPool = new Pool({ connectionString: process.env.FIRST_SLICE_POSTGRES_URL }); await rootPool.query(`CREATE SCHEMA "${schema}"`); created = true; }
    repository = await create();
    if (kind === 'sqlite') control = new DatabaseSync(file);
    if (url) { const controlUrl = new URL(url); controlUrl.searchParams.set('application_name', applicationName + '_control'); control = new Pool({ connectionString: controlUrl.toString() }); }

    await t.test('entry revisions distinguish native and remote reentry from sibling activation and response-only writes',async()=>{
      const f=await fixture();f.run={...f.run,bookletAssignmentKey:f.run.bookletKey};await repository.saveTestRun(f.run);const native=(keyword,id)=>f.services.participantRuntime.executeNativeCommand({participantSessionId:f.id,testRunId:f.id,
        contentReleaseId:f.run.contentReleaseId,bookletKey:f.run.bookletKey,deliveryId:id,keyword,arguments:[],controllerStatus:'RUNNING',timeStamp:Date.parse(timestamp)});
      const initial=await repository.activateParticipantController({...f.run,activatedAt:timestamp});assert.deepEqual(initial.testRun.controllerEntry,{active:true,revision:1});
      const stopped=await native('terminate','owned-stop');assert.deepEqual(stopped.testRun.controllerEntry,{active:false,revision:2});
      const sibling={...stopped.testRun,testRunId:f.id+'-sibling',bookletAssignmentKey:'sibling',controllerEntry:{active:false,revision:8}};
      await repository.saveTestRun(sibling);await repository.activateParticipantController({...sibling,activatedAt:timestamp});
      assert.deepEqual((await repository.getTestRunById(f.id)).controllerEntry,{active:false,revision:2});
      const response=await repository.mutateParticipantRun(f.run,context=>({...effect(context),testRun:{...context.testRun,controllerEntry:{active:true,revision:999},unitResponses:{...context.testRun.unitResponses,second:'Owned later response'}}}));
      assert.deepEqual(response.testRun.controllerEntry,{active:false,revision:2});assert.equal(response.testRun.unitResponses.second,'Owned later response');
      const beforePause=await repository.getTestRunById(f.id),paused=await native('pause','owned-pause');
      assert.deepEqual(paused.testRun.controllerEntry,{active:true,revision:3});assert.equal(paused.testRun.status,'paused');
      assert.deepEqual(paused.testRun.unitResponses,beforePause.unitResponses);assert.deepEqual(paused.testRun.unitResponseFieldTimestamps,beforePause.unitResponseFieldTimestamps);
      const replay=await native('terminate','owned-stop');assert.equal(replay.applied,false);assert.deepEqual(replay.testRun.controllerEntry,{active:true,revision:3});
      const complete=await issue(f.services,f,'complete');await f.services.participantRuntime.acknowledgeCommand({participantSessionId:f.id,testRunId:f.id,commandId:complete.commandId});
      const terminal=await f.services.participantRuntime.executeCommand({participantSessionId:f.id,testRunId:f.id,commandId:complete.commandId,controllerStatus:'PAUSED'});
      assert.deepEqual(terminal.testRun.controllerEntry,{active:false,revision:4});
      const remotePause=await issue(f.services,f,'pause');await f.services.participantRuntime.acknowledgeCommand({participantSessionId:f.id,testRunId:f.id,commandId:remotePause.commandId});
      const entered=await f.services.participantRuntime.executeCommand({participantSessionId:f.id,testRunId:f.id,commandId:remotePause.commandId,controllerStatus:'PAUSED'});
      assert.deepEqual(entered.testRun.controllerEntry,{active:true,revision:5});assert.equal(entered.testRun.status,'paused');
      const repeated=await f.services.participantRuntime.executeCommand({participantSessionId:f.id,testRunId:f.id,commandId:complete.commandId});
      assert.equal(repeated.applied,false);assert.deepEqual(repeated.testRun.controllerEntry,{active:true,revision:5});
      if(kind!=='memory')assert.deepEqual((await (await create()).getTestRunById(f.id)).controllerEntry,{active:true,revision:5});
    });
    await t.test('invalid and exhausted entry revisions fail before committing any artifact',async()=>{
      for(const controllerEntry of [{active:false,revision:Number.MAX_SAFE_INTEGER},{active:false,revision:0},{active:'true',revision:1}]){
        const f=await fixture();await repository.saveTestRun({...f.run,controllerEntry});const before=await snapshot(f);
        await assert.rejects(repository.activateParticipantController({...f.run,activatedAt:timestamp}),/entry.*(invalid|exhausted)/);
        assert.deepEqual(await snapshot(f),before);
      }
    });
    await t.test('scope denials and throwing/invalid projections leave every artifact unchanged', async () => {
      const f = await fixture(), before = await snapshot(f);
      for (const key of ['testRunId', 'participantSessionId', 'tenantId', 'workspaceId', 'contentReleaseId']) {
        assert.equal(await repository.mutateParticipantRun({ ...f.run, [key]: 'foreign' }, () => { throw Error('Must not evaluate foreign scope'); }), null);
      }
      await assert.rejects(repository.mutateParticipantRun(f.run, context => { context.testRun.status = 'completed'; throw Error('owned projection failure'); }), /owned projection failure/);
      for (const key of ['bookletKey', 'bookletAssignmentKey', 'executionMode', 'createdAt']) {
        await assert.rejects(repository.mutateParticipantRun(f.run, context => { const projected = effect(context); projected.testRun[key] = 'foreign'; return projected; }), /immutable parent scope/);
      }
      for (const target of ['parent', 'log', 'activity']) {
        await assert.rejects(repository.mutateParticipantRun(f.run, context => {
          const projected = effect(context);
          if (target === 'parent') projected.participantSession = { ...context.participantSession, participantCode: 'foreign' };
          if (target === 'log') projected.testLogs[0].workspaceId = 'foreign';
          if (target === 'activity') projected.activityEvents[0].tenantId = 'foreign';
          return projected;
        }), /immutable parent scope/);
      }
      await assert.rejects(repository.mutateParticipantRun(f.run, context => ({ ...effect(context), commandInput: {
        ...f.run, workspaceId: 'foreign', commandId: randomUUID(), commandType: 'pause', issuedAt: timestamp,
        actorId: null, targetUnitKey: null, remainingSeconds: null, effectsDeferred: true
      } })), /immutable parent scope/);
      assert.deepEqual(await snapshot(f), before);
    });
    await t.test('Run, artifacts and parent commit together and returned values are detached', async () => {
      const f = await fixture();
      const result = await repository.mutateParticipantRun(f.run, context => ({ ...effect(context), participantSession: { ...context.participantSession, status: 'signed_in' } }));
      assert.equal(result.applied, true); assert.equal(result.participantSession.status, 'signed_in');
      result.testRun.unitResponses.unit = 'caller mutation'; result.participantSession.participantCode = 'caller mutation';
      const after = await snapshot(f); assert.equal(after.run.unitResponses.unit, f.run.unitResponses.unit); assert.equal(after.run.unitResponses.second, 'Owned newer answer');
      assert.equal(after.parent.participantCode, f.parent.participantCode); assert.equal(after.logs.length, 1); assert.equal(after.events.filter(e => e.subjectId === f.id).length, 1);
      const noOp = await repository.mutateParticipantRun(f.run, () => null); assert.equal(noOp.applied, false); assert.deepEqual(noOp.testRun, after.run);
    });
    await t.test('two independent service queues merge answers from the current Run', async () => {
      const f = await fixture();
      const first = service(writeAfterInitialRead(repository, () => service(repository).participantRuntime.saveProgress({ testRunId: f.id, responseUnitKey: 'second', unitResponse: 'Second service ä\n', status: 'running' })));
      const saved = await first.participantRuntime.saveProgress({ testRunId: f.id, responseUnitKey: 'unit', unitResponse: 'First service β\n', status: 'running' });
      assert.deepEqual(saved.unitResponses, { unit: 'First service β\n', second: 'Second service ä\n' });
      assert.deepEqual((await snapshot(f)).run.unitResponses, saved.unitResponses);
    });
    await t.test('a monitor pause applied after the initial read survives a progress write', async () => {
      const f = await fixture();
      const first = service(writeAfterInitialRead(repository, async () => {
        const commandId = randomUUID();
        await repository.appendParticipantRunCommand({ ...f.run, commandId, commandType: 'pause', issuedAt: timestamp, actorId: null, targetUnitKey: null, remainingSeconds: null, effectsDeferred: true });
        await repository.acknowledgeParticipantRunCommand({ ...f.run, commandId, acknowledgedAt: timestamp });
        await service(repository).participantRuntime.executeCommand({ participantSessionId: f.id, testRunId: f.id, commandId, controllerStatus: 'RUNNING' });
      }));
      const saved = await first.participantRuntime.saveProgress({ testRunId: f.id, unitResponse: 'Saved despite the pause', status: 'running' });
      assert.equal(saved.status, 'paused'); assert.equal(saved.pauseSource, 'monitor'); assert.equal(saved.unitResponses.unit, 'Saved despite the pause');
      await assert.rejects(service(repository).participantRuntime.saveProgress({ testRunId: f.id, currentUnitKey: 'second', status: 'running' }), error => error.errorCode === 'test_run_monitor_paused');
    });
    await t.test('a concurrent lock or expired parent is checked inside the progress transaction', async () => {
      for (const target of ['run', 'parent']) {
        const f = await fixture();
        const first = service(writeAfterInitialRead(repository, async () => {
          if (target === 'run') await repository.mutateParticipantRun(f.run, context => ({ testRun: { ...context.testRun, locked: true }, testLogs: [], activityEvents: [] }));
          else await repository.saveParticipantSession({ ...f.parent, validUntil: '2026-10-10T00:00:00.000Z', participantCode: 'owned changed code' });
        }));
        await assert.rejects(first.participantRuntime.saveProgress({ testRunId: f.id, unitResponse: 'Must not save', status: 'running' }), error => error.errorCode === (target === 'run' ? 'test_run_locked' : 'participant_access_expired'));
        const after = await snapshot(f); assert.equal(after.run.unitResponses.unit, f.run.unitResponses.unit); assert.equal(after.logs.length, 0);
        if (target === 'run') assert.equal(after.run.locked, true); else assert.equal(after.parent.participantCode, 'owned changed code');
      }
    });
    await t.test('current-state/booklet-state calculation cannot overwrite a concurrently saved answer', async () => {
      const f = await fixture();
      const first = service(writeAfterInitialRead(repository, () => service(repository).participantRuntime.saveProgress({ testRunId: f.id, responseUnitKey: 'second', unitResponse: 'Concurrent state-query answer', status: 'running' })));
      const state = await first.participantRuntime.getCurrentRunState({ participantSessionId: f.id, testRunId: f.id });
      assert.equal(state.testRun.unitResponses.second, 'Concurrent state-query answer'); assert.equal((await snapshot(f)).run.unitResponses.second, 'Concurrent state-query answer');
    });
    await t.test('timer completion reads the current sibling Runs and commits its parent status and artifacts', async () => {
      const f = await fixture({ timed: true }), sibling = { ...f.run, testRunId: randomUUID(), bookletKey: 'other', bookletAssignmentKey: 'other', status: 'running', testletTimers: {} };
      await repository.saveTestRun(sibling);
      const first = service(writeAfterInitialRead(repository, () => repository.mutateParticipantRun(sibling, context => ({ testRun: { ...context.testRun, status: 'completed', completedAt: timestamp }, testLogs: [], activityEvents: [] }))));
      await first.participantRuntime.getCurrentRunState({ participantSessionId: f.id, testRunId: f.id });
      const after = await snapshot(f); assert.equal(after.run.status, 'completed'); assert.equal(after.parent.status, 'closed');
      assert.equal(after.events.filter(e => e.subjectId === f.id && e.eventType === 'test_run_completed').length, 1);
      assert.ok(after.logs.some(log => log.logKey === 'TESTLETS_TIMELEFT'));
    });
    for (const operation of operations) await t.test(`${operation.name} preserves an answer committed after its initial Run read`, async () => {
      const f = await fixture(operation.options), answer = `Concurrent ${operation.name}: Ä/β\n  exact spaces  `;
      const first = service(writeAfterInitialRead(repository, () => service(repository).participantRuntime.saveProgress({
        testRunId: f.id, responseUnitKey: 'second', unitResponse: answer, status: f.run.status })));
      await operation.invoke(first, f);
      const after = await snapshot(f);
      assert.equal(after.run.unitResponses.second, answer);
      assert.equal(after.run.unitResponses.unit, f.run.unitResponses.unit);
      if (operation.monitor) {
        assert.equal(after.commands.length, 1);
        const issued = after.events.filter(event => event.eventType === 'monitor_run_command_issued');
        assert.equal(issued.length, 1); assert.equal(issued[0].details.commandId, after.commands[0].commandId);
        assert.equal(after.run.locked === true, operation.name === 'monitor native lock');
        assert.equal(after.run.status, 'running');
      }
    });
    for (const operation of operations.filter(operation => !operation.monitor)) await t.test(`${operation.name} denies a lock and expired parent committed after its initial read`, async () => {
      for (const target of ['run', 'parent']) {
        const f = await fixture(operation.options);
        let expected;
        const first = service(writeAfterInitialRead(repository, async () => {
          if (target === 'run') await repository.mutateParticipantRun(f.run, context => ({ testRun: { ...context.testRun, locked: true }, testLogs: [], activityEvents: [] }));
          else await repository.saveParticipantSession({ ...f.parent, validUntil: '2026-10-10T00:00:00.000Z' });
          expected = await snapshot(f);
        }));
        await assert.rejects(operation.invoke(first, f), error => error.errorCode === (target === 'run' ? 'test_run_locked' : 'participant_access_expired'));
        assert.deepEqual(await snapshot(f), expected);
      }
    });
    for (const operation of operations.filter(operation => ['prepareStarterExit', 'returnToStarter'].includes(operation.name))) await t.test(`${operation.name} rejects a stale current-unit confirmation without changing the newer Run`, async () => {
      const f = await fixture(operation.options); let expected;
      const first = service(writeAfterInitialRead(repository, async () => {
        await repository.mutateParticipantRun(f.run, context => ({ testRun: { ...context.testRun, currentUnitKey: 'second' }, testLogs: [], activityEvents: [] }));
        expected = await snapshot(f);
      }));
      await assert.rejects(operation.invoke(first, f), error => error.errorCode === 'starter_exit_unit_changed');
      assert.deepEqual(await snapshot(f), expected);
    });
    await t.test('starter status confirmation and session reentry respect a newer monitor pause', async () => {
      for (const action of ['return', 'resume']) {
        const f = await fixture(); let expected;
        const first = service(writeAfterInitialRead(repository, async () => {
          await repository.mutateParticipantRun(f.run, context => ({ testRun: { ...context.testRun, status: 'paused', pauseSource: 'monitor' }, testLogs: [], activityEvents: [] }));
          expected = await snapshot(f);
        }));
        if (action === 'return') await assert.rejects(first.participantRuntime.returnToStarter({ testRunId: f.id, currentUnitKey: 'unit', expectedStatus: 'running' }), error => error.errorCode === 'starter_exit_state_changed');
        else { const result = await first.participantRuntime.resumeSession({ participantSessionId: f.id, bookletKey: 'owned' }); assert.equal(result.status, 'paused'); assert.equal(result.pauseSource, 'monitor');
          expected={...expected,run:{...expected.run,controllerEntry:{active:true,revision:1}}}; }
        assert.deepEqual(await snapshot(f), expected);
      }
    });
    await t.test('explicit completion uses the current sibling status and preserves the current parent identity', async () => {
      const f = await fixture(), sibling = { ...f.run, testRunId: randomUUID(), bookletKey: 'other', bookletAssignmentKey: 'other' };
      await repository.saveTestRun(sibling);
      const first = service(writeAfterInitialRead(repository, async () => {
        await repository.mutateParticipantRun(sibling, context => ({ testRun: { ...context.testRun, status: 'completed', completedAt: timestamp }, testLogs: [], activityEvents: [] }));
        await repository.saveParticipantSession({ ...f.parent, participantCode: 'newest parent code' });
      }));
      await first.participantRuntime.completeRun({ testRunId: f.id });
      const after = await snapshot(f); assert.equal(after.run.status, 'completed'); assert.equal(after.parent.status, 'closed');
      assert.equal(after.parent.participantCode, 'newest parent code');
      assert.equal(after.events.filter(event => event.eventType === 'test_run_completed').length, 1);
    });
    for (const commandType of ['pause', 'lock_test']) await t.test(`${commandType} cannot queue an intent after concurrent completion`, async () => {
      const f = await fixture(); let expected;
      const first = service(writeAfterInitialRead(repository, async () => {
        await repository.mutateParticipantRun(f.run, context => ({ testRun: { ...context.testRun, status: 'completed', completedAt: timestamp }, testLogs: [], activityEvents: [] }));
        expected = await snapshot(f);
      }));
      await assert.rejects(issue(first, f, commandType), error => error.errorCode === 'test_run_already_completed');
      assert.deepEqual(await snapshot(f), expected);
    });
    if (kind === 'file') for (const operation of operations) await t.test(`${operation.name}: failed File persistence rolls back Run, parent, logs, command and audit together`, async () => {
      const f = await fixture(operation.options), before = await snapshot(f), backup = join(directory, 'runtime-backup.json');
      await rename(file, backup); await mkdir(file);
      try { await assert.rejects(operation.invoke(f.services, f)); assert.deepEqual(await snapshot(f), before); }
      finally { await rm(file, { recursive: true }); await rename(backup, file); }
      const restarted = await create();
      assert.deepEqual(await restarted.getTestRunById(f.id), before.run);
      assert.deepEqual(await restarted.listPendingParticipantRunCommands(f.run), before.commands);
      await operation.invoke(service(repository), f);
      const durable = await create(); assert.deepEqual(await durable.getTestRunById(f.id), JSON.parse(JSON.stringify((await snapshot(f)).run)));
      if (operation.monitor) assert.equal((await durable.listPendingParticipantRunCommands(f.run)).length, 1);
    });
    if (control) for (const commandType of ['pause', 'lock_test']) await t.test(`${commandType}: audit failure after command insertion rolls back the intent and Run together`, async () => {
      const f = await fixture(), before = await snapshot(f);
      const install = kind === 'sqlite' ? `CREATE TRIGGER owned_command_audit_failure BEFORE INSERT ON workspace_activity_events WHEN NEW.subject_id='${f.id}' BEGIN SELECT RAISE(ABORT,'owned command audit failure'); END` :
        `CREATE FUNCTION owned_command_audit_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned command audit failure'; END $$; CREATE TRIGGER owned_command_audit_failure BEFORE INSERT ON workspace_activity_events FOR EACH ROW WHEN (NEW.subject_id='${f.id}') EXECUTE FUNCTION owned_command_audit_failure()`;
      const remove = kind === 'sqlite' ? 'DROP TRIGGER owned_command_audit_failure' : 'DROP TRIGGER owned_command_audit_failure ON workspace_activity_events; DROP FUNCTION owned_command_audit_failure()';
      const execute = query => kind === 'sqlite' ? control.exec(query) : control.query(query);
      await execute(install);
      try { await assert.rejects(issue(f.services, f, commandType), /owned command audit failure/); assert.deepEqual(await snapshot(f), before); }
      finally { await execute(remove); }
      await issue(service(await create()), f, commandType);
      const after = await snapshot(f); assert.equal(after.commands.length, 1); assert.equal(after.commands[0].sequence, 1);
      assert.equal(after.events.filter(event => event.eventType === 'monitor_run_command_issued').length, 1);
    });
    if (control) for (const operation of operations.filter(operation => !operation.monitor)) await t.test(`${operation.name}: SQL artifact failure rolls back every runtime change`, async () => {
      const f = await fixture(operation.options), before = await snapshot(f);
      const logs = operation.name === 'prepareStarterExit';
      const table = logs ? 'participant_test_logs' : 'workspace_activity_events', field = logs ? 'test_run_id' : 'subject_id';
      const install = kind === 'sqlite' ? `CREATE TRIGGER owned_runtime_failure BEFORE INSERT ON ${table} WHEN NEW.${field}='${f.id}' BEGIN SELECT RAISE(ABORT,'owned runtime artifact failure'); END` :
        `CREATE FUNCTION owned_runtime_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned runtime artifact failure'; END $$; CREATE TRIGGER owned_runtime_failure BEFORE INSERT ON ${table} FOR EACH ROW WHEN (NEW.${field}='${f.id}') EXECUTE FUNCTION owned_runtime_failure()`;
      const remove = kind === 'sqlite' ? 'DROP TRIGGER owned_runtime_failure' : `DROP TRIGGER owned_runtime_failure ON ${table}; DROP FUNCTION owned_runtime_failure()`;
      const execute = query => kind === 'sqlite' ? control.exec(query) : control.query(query);
      await execute(install);
      try { await assert.rejects(operation.invoke(f.services, f), /owned runtime artifact failure/); assert.deepEqual(await snapshot(f), before); }
      finally { await execute(remove); }
      await operation.invoke(service(await create()), f);
    });
    if (control) for (const name of ['resumeSession', 'completeRun']) await t.test(`${name}: final parent failure rolls back Run and all earlier artifacts`, async () => {
      const f = await fixture({ status: name === 'resumeSession' ? 'paused' : 'running' });
      if (name === 'resumeSession') await repository.saveParticipantSession({ ...f.parent, status: 'signed_in' });
      else await repository.saveTestRun({ ...f.run, testRunId: randomUUID(), bookletKey: 'other', bookletAssignmentKey: 'other', status: 'completed', completedAt: timestamp });
      const before = await snapshot(f), operation = operations.find(operation => operation.name === name);
      const install = kind === 'sqlite' ? `CREATE TRIGGER owned_runtime_parent_failure BEFORE UPDATE OF status ON participant_sessions WHEN NEW.participant_session_id='${f.id}' BEGIN SELECT RAISE(ABORT,'owned runtime parent failure'); END` :
        `CREATE FUNCTION owned_runtime_parent_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned runtime parent failure'; END $$; CREATE TRIGGER owned_runtime_parent_failure BEFORE UPDATE OF status ON participant_sessions FOR EACH ROW WHEN (NEW.participant_session_id='${f.id}') EXECUTE FUNCTION owned_runtime_parent_failure()`;
      const remove = kind === 'sqlite' ? 'DROP TRIGGER owned_runtime_parent_failure' : 'DROP TRIGGER owned_runtime_parent_failure ON participant_sessions; DROP FUNCTION owned_runtime_parent_failure()';
      const execute = query => kind === 'sqlite' ? control.exec(query) : control.query(query);
      await execute(install);
      try { await assert.rejects(operation.invoke(f.services, f), /owned runtime parent failure/); assert.deepEqual(await snapshot(f), before); }
      finally { await execute(remove); }
      await operation.invoke(service(await create()), f);
      assert.equal((await snapshot(f)).parent.status, name === 'resumeSession' ? 'launched' : 'closed');
    });
    if (kind === 'file') await t.test('failed persistence leaves cached Run/logs/activity/parent unchanged and retry succeeds', async () => {
      const f = await fixture(), before = await snapshot(f), backup = join(directory, 'backup.json');
      await rename(file, backup); await mkdir(file);
      try { await assert.rejects(f.services.participantRuntime.saveProgress({ testRunId: f.id, unitResponse: 'Failed progress', status: 'running' })); assert.deepEqual(await snapshot(f), before); }
      finally { await rm(file, { recursive: true }); await rename(backup, file); }
      const restarted = await create(); assert.deepEqual(await restarted.getTestRunById(f.id), before.run);
      await service(repository).participantRuntime.saveProgress({ testRunId: f.id, unitResponse: 'Retried progress', status: 'running' });
      assert.equal((await (await create()).getTestRunById(f.id)).unitResponses.unit, 'Retried progress');
    });
    if (control) await t.test('failure after writing Run/logs rolls back the complete progress projection', async () => {
      const f = await fixture(), before = await snapshot(f);
      const install = kind === 'sqlite' ? `CREATE TRIGGER owned_run_failure BEFORE INSERT ON workspace_activity_events WHEN NEW.subject_id='${f.id}' BEGIN SELECT RAISE(ABORT,'owned progress transaction failure'); END` :
        `CREATE FUNCTION owned_run_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned progress transaction failure'; END $$; CREATE TRIGGER owned_run_failure BEFORE INSERT ON workspace_activity_events FOR EACH ROW WHEN (NEW.subject_id='${f.id}') EXECUTE FUNCTION owned_run_failure()`;
      const remove = kind === 'sqlite' ? 'DROP TRIGGER owned_run_failure' : 'DROP TRIGGER owned_run_failure ON workspace_activity_events; DROP FUNCTION owned_run_failure()';
      const execute = query => kind === 'sqlite' ? control.exec(query) : control.query(query);
      await execute(install);
      try { await assert.rejects(f.services.participantRuntime.saveProgress({ testRunId: f.id, unitResponse: 'Failed SQL progress', status: 'running' }), /owned progress transaction failure/); assert.deepEqual(await snapshot(f), before); }
      finally { await execute(remove); }
      await service(await create()).participantRuntime.saveProgress({ testRunId: f.id, unitResponse: 'Successful SQL retry', status: 'running' });
      assert.equal((await snapshot(f)).run.unitResponses.unit, 'Successful SQL retry');
    });
    if (control) await t.test('a failed timer-completion parent update rolls back the Run, timer logs and completion activity', async () => {
      const f = await fixture({ timed: true });
      await repository.saveTestRun({ ...f.run, testRunId: randomUUID(), bookletKey: 'other', bookletAssignmentKey: 'other', status: 'completed', completedAt: timestamp, testletTimers: {} });
      const before = await snapshot(f);
      const install = kind === 'sqlite' ? `CREATE TRIGGER owned_timer_parent_failure BEFORE UPDATE OF status ON participant_sessions WHEN NEW.participant_session_id='${f.id}' BEGIN SELECT RAISE(ABORT,'owned timer parent failure'); END` :
        `CREATE FUNCTION owned_timer_parent_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned timer parent failure'; END $$; CREATE TRIGGER owned_timer_parent_failure BEFORE UPDATE OF status ON participant_sessions FOR EACH ROW WHEN (NEW.participant_session_id='${f.id}') EXECUTE FUNCTION owned_timer_parent_failure()`;
      const remove = kind === 'sqlite' ? 'DROP TRIGGER owned_timer_parent_failure' : 'DROP TRIGGER owned_timer_parent_failure ON participant_sessions; DROP FUNCTION owned_timer_parent_failure()';
      const execute = query => kind === 'sqlite' ? control.exec(query) : control.query(query);
      await execute(install);
      try { await assert.rejects(f.services.participantRuntime.getCurrentRunState({ participantSessionId: f.id, testRunId: f.id }), /owned timer parent failure/); assert.deepEqual(await snapshot(f), before); }
      finally { await execute(remove); }
      await service(repository).participantRuntime.getCurrentRunState({ participantSessionId: f.id, testRunId: f.id });
      const after = await snapshot(f); assert.equal(after.run.status, 'completed'); assert.equal(after.parent.status, 'closed');
    });
    if (kind === 'postgres') await t.test('a separate PostgreSQL writer holds a row lock until the mutation waits, then its answer survives', async () => {
      const f = await fixture(), writer = await control.connect(); let pending, committed = false;
      try {
        await writer.query('BEGIN');
        await writer.query('UPDATE test_runs SET unit_responses_json = $1 WHERE test_run_id = $2', [JSON.stringify({ ...f.run.unitResponses, second: 'Held SQL writer answer' }), f.id]);
        const replica = await create(); let settled = false;
        pending = replica.mutateParticipantRun(f.run, context => ({ testRun: { ...context.testRun, unitResponses: { ...context.testRun.unitResponses, unit: 'Waiting mutation answer' } }, testLogs: [], activityEvents: [] })).finally(() => { settled = true; });
        let waited = false;
        for (let attempt = 0; attempt < 100; attempt++) { const rows = await control.query("SELECT 1 FROM pg_stat_activity WHERE application_name=$1 AND wait_event_type='Lock'", [applicationName]); if (rows.rowCount) { waited = true; break; } await delay(20); }
        assert.equal(waited, true); assert.equal(settled, false);
        await writer.query('COMMIT'); committed = true; await pending;
        assert.deepEqual((await snapshot(f)).run.unitResponses, { unit: 'Waiting mutation answer', second: 'Held SQL writer answer' });
      } finally { if (!committed) await writer.query('ROLLBACK'); writer.release(); await pending; }
    });
    if (kind === 'sqlite') await t.test('an independent SQLite worker commits an answer before the blocked mutation reads its Run', async () => {
      const f = await fixture();
      const worker = new Worker(`const {parentPort,workerData}=require('node:worker_threads');const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(workerData.file);db.exec('BEGIN IMMEDIATE');db.prepare('UPDATE test_runs SET unit_responses_json=? WHERE test_run_id=?').run(JSON.stringify(workerData.responses),workerData.id);parentPort.postMessage('locked');parentPort.once('message',()=>setTimeout(()=>{db.exec('COMMIT');db.close();parentPort.close();},300));`, { eval: true, workerData: { file, id: f.id, responses: { ...f.run.unitResponses, second: 'SQLite worker answer' } } });
      const ready = new Promise((resolve, reject) => { worker.once('message', resolve); worker.once('error', reject); });
      const finished = new Promise((resolve, reject) => { worker.once('exit', code => code === 0 ? resolve() : reject(Error('Owned SQLite writer failed'))); worker.once('error', reject); });
      try { assert.equal(await ready, 'locked'); worker.postMessage('mutate');
        await repository.mutateParticipantRun(f.run, context => ({ testRun: { ...context.testRun, unitResponses: { ...context.testRun.unitResponses, unit: 'SQLite mutation answer' } }, testLogs: [], activityEvents: [] }));
        await finished; assert.deepEqual((await snapshot(f)).run.unitResponses, { unit: 'SQLite mutation answer', second: 'SQLite worker answer' });
      } finally { await worker.terminate(); }
    });
  } finally {
    for (const storage of storages) await storage.shutdown();
    if (kind === 'sqlite') control?.close(); else await control?.end();
    try { if (created) await rootPool.query(`DROP SCHEMA "${schema}" CASCADE`); }
    finally { await rootPool?.end(); await rm(directory, { recursive: true, force: true }); }
  }
});
