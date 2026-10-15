import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createFirstSliceServices } from '@testcenter-rewrite-app/application';
import { compileBookletRuntimePolicy } from '@testcenter-rewrite-app/contracts';
import { createInMemoryFirstSliceRepository } from '@testcenter-rewrite-app/memory-store';
import { createFileFirstSliceStorage } from '@testcenter-rewrite-app/file-store';
import { createSqliteFirstSliceStorage } from '@testcenter-rewrite-app/sqlite-store';
import { createPostgresFirstSliceStorage } from '@testcenter-rewrite-app/postgres-store';
import { Pool } from 'pg';

const kinds = ['memory', 'file', 'sqlite'];
if (process.env.FIRST_SLICE_STORE === 'postgres') { assert.ok(process.env.FIRST_SLICE_POSTGRES_URL); kinds.push('postgres'); }
for (const kind of kinds) test(`${kind}: command completion is distinct from the state effect`, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'testcenter-command-completion-'));
  let storage, repository, clock = Date.parse('2026-10-14T00:00:00.000Z');
  const schema = 'owned_completion_' + randomUUID().replaceAll('-', '');
  const url = kind === 'postgres' ? new URL(process.env.FIRST_SLICE_POSTGRES_URL) : null;
  url?.searchParams.set('options', `-c search_path=${schema}`);
  const root = kind === 'postgres' ? new Pool({ connectionString: process.env.FIRST_SLICE_POSTGRES_URL }) : null;
  let schemaCreated = false;
  const open = async () => {
    storage = kind === 'memory' ? storage ?? { repository: createInMemoryFirstSliceRepository(), shutdown: async () => {} }
      : kind === 'file' ? await createFileFirstSliceStorage(join(directory, 'owned.json'))
      : kind === 'sqlite' ? await createSqliteFirstSliceStorage(join(directory, 'owned.sqlite'))
      : await createPostgresFirstSliceStorage(url.toString());
    repository = storage.repository;
  };
  const service = () => createFirstSliceServices({ repository, now: () => new Date(clock).toISOString() });
  try {
    if (root) { await root.query(`CREATE SCHEMA "${schema}"`); schemaCreated = true; }
    await open();
    const tenant = await service().platform.createTenant({ tenantKey: 'owned-' + randomUUID(), displayName: 'Owned' });
    const workspace = await service().platform.createWorkspace({ tenantKey: tenant.tenantKey, workspaceKey: 'owned', displayName: 'Owned' });
    const base = { tenantId: tenant.tenantId, workspaceId: workspace.workspaceId }, contentReleaseId = randomUUID();
    const timestamp = new Date(clock).toISOString();
    await repository.saveContentRelease({ ...base, contentReleaseId, importJobId: contentReleaseId, releaseLabel: 'Owned', status: 'active',
      createdAt: timestamp, activatedAt: timestamp, runtimeSnapshot: { bookletEntries: [{ bookletKey: 'owned', displayLabel: 'Owned',
        policy: compileBookletRuntimePolicy({}), testletEntries: [], unitEntries: [{ unitKey: 'alias', originalUnitId: 'original', displayLabel: 'Owned' }] }] } });
    const seed = async () => {
      const participantSessionId = randomUUID(), testRunId = randomUUID();
      const scope = { ...base, contentReleaseId, participantSessionId, testRunId, bookletKey: 'owned' };
      await repository.saveParticipantSession({ ...base, contentReleaseId, participantSessionId, loginKey: 'owned', groupKey: 'owned',
        executionMode: 'run-hot-return', status: 'launched', createdAt: timestamp });
      await repository.saveTestRun({ ...scope, bookletAssignmentKey: 'owned', executionMode: 'run-hot-return', status: 'running', currentUnitKey: 'alias',
        unitResponses: { alias: 'Exact Ä/β\n"; answer' }, createdAt: timestamp, updatedAt: timestamp, completedAt: null });
      return scope;
    };
    const logs = async scope => (await repository.listParticipantTestLogsByWorkspace(base.tenantId, base.workspaceId))
      .filter(log => log.testRunId === scope.testRunId && log.logKey === 'command executed');
    const native = scope => ({ testRunId: scope.testRunId, contentReleaseId, bookletKey: 'owned', commandCompletion: 'browser-v1',
      deliveryId: randomUUID(), keyword: 'terminate', arguments: [], controllerStatus: 'RUNNING', timeStamp: clock });
    const complete = (scope, command, timeStamp = clock) => ({ participantSessionId: scope.participantSessionId,
      testRunId: scope.testRunId, contentReleaseId, bookletKey: 'owned', command, timeStamp });
    const rejected = (action, code) => assert.rejects(action, error => error.errorCode === code);
    for (const origin of ['native', 'remote']) for (const later of ['pause', 'resume']) for (const lock of [false, true]) await t.test(`${origin}: held termination finishes after ${later}${lock ? ' with lock' : ''} and replays without closing a fresh entry`, async () => {
      const scope = await seed(), request = { ...native(scope), arguments: lock ? ['lock'] : [],
        controllerDispatch: { controllerId: 'owned-overlap', sequence: 1 } };
      const siblingId = randomUUID(), sibling = { ...(await repository.getTestRunById(scope.testRunId)), testRunId: siblingId, bookletAssignmentKey: 'sibling' };
      await repository.saveTestRun(sibling);
      const siblingBefore = await repository.getTestRunById(siblingId);
      let command = { kind: 'native', request }, apply;
      if (origin === 'remote') {
        const commandId = randomUUID(); command = { kind: 'remote', commandId };
        await repository.appendParticipantRunCommand({ ...scope, commandId, commandType: lock ? 'complete_and_lock' : 'complete',
          targetUnitKey: null, remainingSeconds: null, actorId: 'owned-monitor', issuedAt: new Date(clock).toISOString(), effectsDeferred: true });
        await service().participantRuntime.acknowledgeCommand({ participantSessionId: scope.participantSessionId, testRunId: scope.testRunId, commandId });
        apply = () => service().participantRuntime.executeCommand({ participantSessionId: scope.participantSessionId, testRunId: scope.testRunId,
          commandId, controllerStatus: 'RUNNING', controllerDispatch: request.controllerDispatch, commandCompletion: 'browser-v1' });
      } else apply = () => service().participantRuntime.executeNativeCommand({ participantSessionId: scope.participantSessionId, ...request });
      clock += 5_000;
      await service().participantRuntime.executeNativeCommand({ participantSessionId: scope.participantSessionId, ...native(scope), keyword: later,
        controllerStatus: 'TERMINATED', controllerDispatch: { controllerId: 'owned-overlap', sequence: 2 } });
      const before = await repository.getTestRunById(scope.testRunId);
      clock += 5_000; const effect = await apply(), after = await repository.getTestRunById(scope.testRunId);
      assert.equal(effect.terminalContinuation, true); assert.equal(effect.superseded, true);
      assert.equal(after.status, later === 'pause' ? 'paused' : 'running'); assert.equal(after.locked === true, lock);
      assert.equal(after.controllerEntry.active, false); assert.ok(after.controllerEntry.revision > before.controllerEntry.revision);
      for (const key of Object.keys(before).filter(key => !['locked', 'updatedAt', 'controllerEntry', 'stateRevision'].includes(key))) assert.deepEqual(after[key], before[key], key);
      assert.deepEqual(await repository.getTestRunById(siblingId), siblingBefore);
      assert.deepEqual(await logs(scope), []);
      if (kind !== 'memory') { await storage.shutdown(); await open(); }
      const reopened = await repository.getTestRunById(scope.testRunId);
      assert.deepEqual(JSON.parse(JSON.stringify(reopened)), JSON.parse(JSON.stringify(after)));
      const replay = await apply(); assert.equal(replay.applied, false); assert.equal(replay.terminalContinuation, true);
      assert.deepEqual(await repository.getTestRunById(scope.testRunId), reopened);
      clock += 5_000; await service().participantRuntime.completeCommand(complete(scope, command));
      assert.equal((await logs(scope)).length, 1); assert.equal((await logs(scope))[0].logContent, lock ? 'terminate lock' : 'terminate');
      assert.deepEqual(await repository.getTestRunById(scope.testRunId), reopened);
      // A subsequent accepted entry is not another application of the old
      // terminal effect, even when its lost reply is retried afterward.
      if (!lock) {
        clock += 5_000;
        await service().participantRuntime.executeNativeCommand({ participantSessionId: scope.participantSessionId, ...native(scope), keyword: 'resume',
          controllerStatus: later === 'pause' ? 'PAUSED' : 'RUNNING', controllerDispatch: { controllerId: 'owned-overlap', sequence: 3 } });
        const fresh = await repository.getTestRunById(scope.testRunId); assert.equal(fresh.controllerEntry.active, true);
        const stale = await apply(); assert.equal(stale.applied, false); assert.equal(stale.terminalContinuation, true);
        assert.deepEqual(await repository.getTestRunById(scope.testRunId), fresh);
      }
    });
    await t.test('native effect has no completion log; completion and exact replay preserve the Run', async () => {
      const scope = await seed(), request = native(scope);
      const effect = await service().participantRuntime.executeNativeCommand({ participantSessionId: scope.participantSessionId, ...request });
      assert.equal(effect.commandCompletion, 'browser-v1'); assert.deepEqual(await logs(scope), []);
      const before = await repository.getTestRunById(scope.testRunId); clock += 20_000;
      const packet = complete(scope, { kind: 'native', request });
      const results = await Promise.all(Array.from({ length: 5 }, () => service().participantRuntime.completeCommand(packet)));
      assert.equal(results.filter(value => value.applied).length, 1);
      assert.deepEqual(await repository.getTestRunById(scope.testRunId), before);
      const saved = await logs(scope); assert.equal(saved.length, 1); assert.equal(saved[0].timestamp, clock); assert.equal(saved[0].logContent, 'terminate');
      clock += 5_000; const replay = await service().participantRuntime.completeCommand(packet);
      assert.equal(replay.applied, false); assert.equal(replay.acceptedAt, results[0].acceptedAt);
      await rejected(() => service().participantRuntime.completeCommand({ ...packet, timeStamp: clock }), 'participant_delivery_conflict');
      assert.deepEqual(await logs(scope), saved);
    });
    await t.test('unaccepted commands and modified proof cannot manufacture a completion', async () => {
      const scope = await seed(), request = native(scope), packet = complete(scope, { kind: 'native', request });
      await rejected(() => service().participantRuntime.completeCommand(packet), 'participant_command_not_applied');
      await service().participantRuntime.executeNativeCommand({ participantSessionId: scope.participantSessionId, ...request });
      await rejected(() => service().participantRuntime.completeCommand({ ...packet, command: { kind: 'native', request: { ...request, arguments: ['lock'] } } }), 'participant_command_not_applied');
      await rejected(() => service().participantRuntime.completeCommand({ ...packet, bookletKey: 'foreign', command: { kind: 'native', request: { ...request, bookletKey: 'foreign' } } }), 'test_run_scope_changed');
      assert.deepEqual(await logs(scope), []);
    });
    await t.test('legacy native clients retain their original server log and cannot upgrade that accepted identity', async () => {
      const scope = await seed(), request = native(scope); delete request.commandCompletion;
      const result = await service().participantRuntime.executeNativeCommand({ participantSessionId: scope.participantSessionId, ...request });
      assert.equal(result.commandCompletion, undefined); assert.equal((await logs(scope))[0].timestamp, request.timeStamp);
      await rejected(() => service().participantRuntime.completeCommand(complete(scope, { kind: 'native', request: { ...request, commandCompletion: 'browser-v1' } })), 'participant_command_not_applied');
      assert.equal((await logs(scope)).length, 1);
    });
    await t.test('native completion respects saving and non-saving modes without changing their accepted state', async () => {
      for (const mode of ['run-hot-return', 'run-hot-restart', 'run-trial', 'run-demo', 'run-review', 'run-simulation']) {
        const scope = await seed(), initial = await repository.getTestRunById(scope.testRunId);
        await repository.saveTestRun({ ...initial, executionMode: mode });
        const request = native(scope);
        await service().participantRuntime.executeNativeCommand({ participantSessionId: scope.participantSessionId, ...request });
        const before = await repository.getTestRunById(scope.testRunId); assert.deepEqual(await logs(scope), []);
        clock += 20_000; await service().participantRuntime.completeCommand(complete(scope, { kind: 'native', request }));
        assert.deepEqual(await repository.getTestRunById(scope.testRunId), before);
        assert.equal((await logs(scope)).length, ['run-hot-return', 'run-hot-restart', 'run-trial'].includes(mode) ? 1 : 0);
      }
    });
    for (const commandType of ['complete', 'complete_and_lock', 'pause', 'resume', 'debug']) await t.test(`remote ${commandType} retains its accepted completion content through reopen`, async () => {
      const scope = await seed(), commandId = randomUUID();
      await repository.appendParticipantRunCommand({ ...scope, commandId, commandType, targetUnitKey: null, remainingSeconds: null,
        actorId: 'owned-monitor', issuedAt: new Date(clock).toISOString(), effectsDeferred: true,
        ...(commandType === 'debug' ? { debugArguments: ['off', 'Exact Ω'] } : {}) });
      await service().participantRuntime.acknowledgeCommand({ participantSessionId: scope.participantSessionId, testRunId: scope.testRunId, commandId });
      const effect = await service().participantRuntime.executeCommand({ participantSessionId: scope.participantSessionId, testRunId: scope.testRunId,
        commandId, controllerStatus: 'RUNNING', commandCompletion: 'browser-v1' });
      assert.equal(effect.command.commandCompletion, 'browser-v1'); assert.deepEqual(await logs(scope), []);
      let before = await repository.getTestRunById(scope.testRunId);
      if (kind !== 'memory') {
        await storage.shutdown(); await open();
        const reopened = await repository.getTestRunById(scope.testRunId);
        assert.deepEqual(JSON.parse(JSON.stringify(reopened)), JSON.parse(JSON.stringify(before)));
        before = reopened;
      }
      clock += 20_000; const packet = complete(scope, { kind: 'remote', commandId });
      const completed = await service().participantRuntime.completeCommand(packet); assert.equal(completed.applied, true);
      assert.deepEqual(await repository.getTestRunById(scope.testRunId), before);
      const saved = await logs(scope); assert.equal(saved.length, 1); assert.equal(saved[0].timestamp, clock);
      assert.equal(saved[0].logContent, effect.command.commandCompletionContent);
      assert.equal((await service().participantRuntime.completeCommand(packet)).applied, false);
      assert.deepEqual(await logs(scope), saved);
    });
    await t.test('remote completion refuses a pending command without acknowledging or applying it', async () => {
      const scope = await seed(), commandId = randomUUID();
      await repository.appendParticipantRunCommand({ ...scope, commandId, commandType: 'pause', targetUnitKey: null, remainingSeconds: null,
        actorId: 'owned-monitor', issuedAt: new Date(clock).toISOString(), effectsDeferred: true });
      const before = await repository.getTestRunById(scope.testRunId);
      await rejected(() => service().participantRuntime.completeCommand(complete(scope, { kind: 'remote', commandId })), 'participant_command_not_applied');
      assert.deepEqual(await repository.getTestRunById(scope.testRunId), before); assert.deepEqual(await logs(scope), []);
    });
  } finally {
    try { await storage?.shutdown(); }
    finally { try { if (schemaCreated) await root.query(`DROP SCHEMA "${schema}" CASCADE`); }
      finally { await root?.end(); await rm(directory, { recursive: true, force: true }); } }
  }
});
