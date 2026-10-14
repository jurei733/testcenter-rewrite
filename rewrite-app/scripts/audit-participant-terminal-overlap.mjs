import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { createFirstSliceServices } from '@testcenter-rewrite-app/application';
import { compileBookletRuntimePolicy } from '@testcenter-rewrite-app/contracts';
import { createInMemoryFirstSliceRepository } from '@testcenter-rewrite-app/memory-store';
import { createFileFirstSliceStorage } from '@testcenter-rewrite-app/file-store';
import { createSqliteFirstSliceStorage } from '@testcenter-rewrite-app/sqlite-store';
import { createOriginalCompletionReference, completionReference, referenceMicrotasks } from './original-controller-completion-reference.mjs';

const args = process.argv.slice(2);
assert.ok(args.filter(value => !value.startsWith('--')).length <= 1 && args.every(value => !value.startsWith('--') || value === '--assert-parity'));
const reportPath = args.find(value => value !== '--assert-parity');
const sha256 = value => createHash('sha256').update(value).digest('hex');
const epoch = Date.parse('2026-10-14T00:00:00.000Z');
const references = [];
for (const initial of ['RUNNING', 'PAUSED']) for (const later of ['pause', 'resume']) for (const lock of [false, true]) {
  const f = createOriginalCompletionReference({ initial });
  try {
    f.seedAnswer(); f.receive(lock ? ['lock'] : []); await f.buffersClosed; await referenceMicrotasks();
    const closed = later === 'pause' ? f.nextBufferClose() : Promise.resolve();
    f.setClock(20_000); f.receiveCommand(later); await closed; await referenceMicrotasks();
    const stateBefore = f.service.state$.getValue();
    assert.equal(stateBefore, later === 'pause' ? 'PAUSED' : 'RUNNING');
    assert.equal(f.logs.length, 1); assert.equal(f.logs[0].content, later);
    assert.equal(f.navigations.length, 1); assert.equal(f.locks.length, 0);
    f.setClock(30_000); for (const type of Object.keys(f.writes)) f.release(type);
    await referenceMicrotasks(); assert.equal(f.locks.length, Number(lock));
    if (lock) { f.setClock(40_000); f.releaseLock(); await referenceMicrotasks(); }
    assert.equal(f.navigations.length, 2); assert.equal(f.navigations[1][0][0], '/r/starter');
    assert.equal(f.logs.length, 1); f.setClock(50_000); f.releaseNavigation(); await referenceMicrotasks();
    assert.equal(f.logs.length, 2); assert.equal(f.logs[1].timeStamp, 50_000);
    assert.equal(f.service.state$.getValue(), stateBefore);
    references.push({ initial, later, lock, controllerStatus: stateBefore, terminalNavigation: f.navigations[1],
      lockCalls: f.locks.map(value => value.args), completionLogs: f.logs, events: f.events,
      expected: { status: later === 'pause' ? 'paused' : 'running', locked: lock, controllerEntryActive: false } });
  } finally { f.stop(); await referenceMicrotasks(); }
}

const cases = [];
for (const kind of ['memory', 'file', 'sqlite']) {
  const directory = await mkdtemp(join(tmpdir(), 'testcenter-terminal-overlap-'));
  let storage;
  try {
    storage = kind === 'memory' ? { repository: createInMemoryFirstSliceRepository(), shutdown: async () => {} }
      : kind === 'file' ? await createFileFirstSliceStorage(join(directory, 'owned.json'))
      : await createSqliteFirstSliceStorage(join(directory, 'owned.sqlite'));
    const repository = storage.repository;
    let clock = epoch;
    const service = createFirstSliceServices({ repository, now: () => new Date(clock).toISOString() });
    const tenant = await service.platform.createTenant({ tenantKey: 'owned-' + randomUUID(), displayName: 'Owned overlap audit' });
    const workspace = await service.platform.createWorkspace({ tenantKey: tenant.tenantKey, workspaceKey: 'owned', displayName: 'Owned overlap audit' });
    const base = { tenantId: tenant.tenantId, workspaceId: workspace.workspaceId }, contentReleaseId = randomUUID();
    const timestamp = new Date(epoch).toISOString();
    await repository.saveContentRelease({ ...base, contentReleaseId, importJobId: contentReleaseId, releaseLabel: 'Owned', status: 'active',
      createdAt: timestamp, activatedAt: timestamp, runtimeSnapshot: { bookletEntries: [{ bookletKey: 'owned', displayLabel: 'Owned',
        policy: compileBookletRuntimePolicy({}), testletEntries: [], unitEntries: [{ unitKey: 'alias', originalUnitId: 'authored-unit', displayLabel: 'Owned' }] }] } });
    for (const origin of ['native', 'remote']) for (const reference of references) {
      clock = epoch;
      const { initial, later, lock, expected } = reference;
      const participantSessionId = randomUUID(), testRunId = randomUUID();
      const scope = { ...base, contentReleaseId, participantSessionId, testRunId, bookletKey: 'owned' };
      await repository.saveParticipantSession({ ...base, contentReleaseId, participantSessionId, loginKey: 'owned', groupKey: 'owned',
        executionMode: 'run-hot-return', status: 'launched', createdAt: timestamp });
      await repository.saveTestRun({ ...scope, bookletAssignmentKey: 'owned', executionMode: 'run-hot-return', status: initial === 'PAUSED' ? 'paused' : 'running',
        currentUnitKey: 'alias', unitResponses: { alias: 'Exact Ä/β\n"; answer' }, createdAt: timestamp, updatedAt: timestamp, completedAt: null });
      const request = { testRunId, contentReleaseId, bookletKey: 'owned', deliveryId: randomUUID(), keyword: 'terminate',
        arguments: lock ? ['lock'] : [], controllerStatus: initial, timeStamp: epoch, commandCompletion: 'browser-v1',
        controllerDispatch: { controllerId: 'owned-terminal-overlap', sequence: 1 } };
      let command;
      if (origin === 'remote') {
        const commandId = randomUUID();
        await repository.appendParticipantRunCommand({ ...scope, commandId, commandType: lock ? 'complete_and_lock' : 'complete',
          targetUnitKey: null, remainingSeconds: null, actorId: 'owned-monitor', issuedAt: timestamp, effectsDeferred: true });
        await service.participantRuntime.acknowledgeCommand({ participantSessionId, testRunId, commandId });
        command = { kind: 'remote', commandId };
      } else command = { kind: 'native', request };
      // An earlier handler's preparation is held. Its first state-effect request
      // therefore reaches the service after the later handler's request.
      clock = epoch + 10_000;
      await service.participantRuntime.executeNativeCommand({ participantSessionId, ...request, deliveryId: randomUUID(),
        keyword: later, arguments: [], controllerStatus: initial === 'PAUSED' ? 'TERMINATED_PAUSED' : 'TERMINATED', timeStamp: clock,
        controllerDispatch: { controllerId: request.controllerDispatch.controllerId, sequence: 2 } });
      const before = await repository.getTestRunById(testRunId);
      const apply = () => origin === 'native' ? service.participantRuntime.executeNativeCommand({ participantSessionId, ...request })
        : service.participantRuntime.executeCommand({ participantSessionId, testRunId, commandId: command.commandId,
          controllerStatus: request.controllerStatus, controllerDispatch: request.controllerDispatch, commandCompletion: 'browser-v1' });
      clock = epoch + 20_000; const result = await apply();
      const after = await repository.getTestRunById(testRunId);
      for (const key of ['unitResponses', 'unitResponseFieldTimestamps', 'currentUnitKey', 'controllerDispatches']) assert.deepEqual(after[key], before[key], key);
      const actual = { status: after.status, locked: after.locked === true, controllerEntryActive: after.controllerEntry?.active === true };
      const mismatches = Object.keys(expected).filter(key => actual[key] !== expected[key]);
      const effectLogs = (await repository.listParticipantTestLogsByWorkspace(base.tenantId, base.workspaceId))
        .filter(value => value.testRunId === testRunId && value.logKey === 'command executed');
      assert.equal(effectLogs.length, 0, 'Effects must not fabricate a browser completion');
      await apply(); assert.deepEqual(await repository.getTestRunById(testRunId), after, 'Effect receipt replay must be idempotent');
      cases.push({ kind, origin, initial, later, lock, expected, actual, mismatches, superseded: result.superseded === true,
        preservedAnswersUnitAndDispatch: true, effectReplayPreservedRun: true, parity: mismatches.length === 0 });
    }
  } finally { await storage?.shutdown(); await rm(directory, { recursive: true, force: true }); }
}
const report = { sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  referenceCommit: completionReference.originalCommit,
  referenceFiles: Object.fromEntries(Object.entries(completionReference.sources).map(([key, value]) => [key, { path: value.path, sha256: value.fileSha256 }])),
  auditSha256: sha256(await readFile(new URL(import.meta.url))),
  applicationSourceSha256: sha256(await readFile(new URL('../packages/application/src/index.ts', import.meta.url))),
  applicationBuiltSha256: sha256(await readFile(new URL(import.meta.resolve('@testcenter-rewrite-app/application')))),
  scope: 'Actual pinned Original buffer barrier, later native Pause/Resume, terminal lock call, Starter navigation and completion callback versus current built Rewrite native and deferred remote state-effect services on Memory/File/SQLite. Original backend/router are controlled I/O; Rewrite Angular/HTTP/Player and PostgreSQL are outside this witness. Original remote command delivery itself is not covered. Controller-entry expectation derives from the observed Original Starter destination, not Original metadata.',
  references, cases, parity: cases.every(value => value.parity) };
if (reportPath) await writeFile(resolve(reportPath), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ parity: report.parity, cases: cases.length, failed: cases.filter(value => !value.parity).length,
  mismatches: [...new Set(cases.flatMap(value => value.mismatches))] }, null, 2));
if (args.includes('--assert-parity') && !report.parity) process.exitCode = 1;
