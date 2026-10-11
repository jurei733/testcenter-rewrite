import { mergeCapturedVeronaUnitResponse, parseCapturedVeronaUnitResponse as parseVeronaUnitResponse, serializeCapturedVeronaUnitResponse as serializeVeronaUnitResponse } from "@testcenter-rewrite-app/contracts/participant-response-capture";
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, mkdir, rename, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { setTimeout as delay } from 'node:timers/promises';
import test from 'node:test';
import { Pool } from 'pg';
import { createFirstSliceServices } from '@testcenter-rewrite-app/application';
import { compileBookletRuntimePolicy } from '@testcenter-rewrite-app/contracts';
import { createInMemoryFirstSliceRepository } from '@testcenter-rewrite-app/memory-store';
import { createFileFirstSliceRepository } from '@testcenter-rewrite-app/file-store';
import { createSqliteFirstSliceRepository, migrateSqliteFirstSliceStorage, SQLITE_FIRST_SLICE_SCHEMA_VERSION } from '@testcenter-rewrite-app/sqlite-store';
import { createPostgresFirstSliceStorage, migratePostgresFirstSliceStorage, POSTGRES_FIRST_SLICE_SCHEMA_VERSION } from '@testcenter-rewrite-app/postgres-store';

const timestamp = '2026-10-11T00:00:00.000Z';
const kinds = ['memory', 'file', 'sqlite'];
if (process.env.FIRST_SLICE_STORE === 'postgres') { assert.ok(process.env.FIRST_SLICE_POSTGRES_URL); kinds.push('postgres'); }
const packet = (unitState, fieldTimestamps, playerState) => serializeVeronaUnitResponse({ unitState, fieldTimestamps, playerState });
const denied = code => error => { assert.equal(error.errorCode, code); return true; };

for (const kind of kinds) test(`${kind}: progress delivery receipts and Source field ordering`, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'testcenter-progress-delivery-'));
  const file = join(directory, kind === 'sqlite' ? 'owned.sqlite' : 'owned.json');
  const schema = 'owned_delivery_' + randomUUID().replaceAll('-', '');
  const url = kind === 'postgres' ? new URL(process.env.FIRST_SLICE_POSTGRES_URL) : null;
  url?.searchParams.set('options', `-c search_path=${schema}`);
  url?.searchParams.set('application_name', schema);
  const storages = [];
  let rootPool, control, created = false, repository;
  const service = repository => createFirstSliceServices({ repository, now: () => timestamp });
  const create = async () => {
    if (kind === 'memory') return repository ?? createInMemoryFirstSliceRepository();
    if (kind === 'file') return createFileFirstSliceRepository(file);
    if (kind === 'sqlite') return createSqliteFirstSliceRepository(file);
    const storage = await createPostgresFirstSliceStorage(url.toString()); storages.push(storage); return storage.repository;
  };
  const execute = sql => kind === 'sqlite' ? control.exec(sql) : control.query(sql);
  const fixture = async ({ mode = 'run-hot-return', completeRequired = false, timed = false } = {}) => {
    const services = service(repository), id = randomUUID();
    const tenant = await services.platform.createTenant({ tenantKey: 'owned-' + id, displayName: 'Owned delivery test' });
    const workspace = await services.platform.createWorkspace({ tenantKey: tenant.tenantKey, workspaceKey: 'owned', displayName: 'Owned delivery test' });
    const base = { tenantId: tenant.tenantId, workspaceId: workspace.workspaceId, createdAt: timestamp };
    const booklet = key => ({ bookletKey: key, displayLabel: key,
      policy: compileBookletRuntimePolicy(completeRequired ? { force_presentation_complete: 'ALWAYS', force_response_complete: 'ALWAYS' } : {}),
      testletEntries: [{ testletKey: 'outer', displayLabel: 'Outer', parentTestletKey: null, restrictions: timed ? { timeMax: { minutes: 5, leave: 'allowed' } } : {} }],
      unitEntries: ['unit', 'second'].map(unitKey => ({ unitKey, displayLabel: unitKey, testletPath: ['outer'] })) });
    await repository.saveContentRelease({ ...base, contentReleaseId: id, importJobId: id, releaseLabel: 'Owned', status: 'active', activatedAt: timestamp,
      runtimeSnapshot: { bookletEntries: [booklet('owned'), booklet('other')] } });
    await repository.saveParticipantSession({ ...base, participantSessionId: id, contentReleaseId: id, loginKey: id, groupKey: 'owned', participantCode: 'owned', status: 'launched', executionMode: mode });
    const run = { ...base, testRunId: id, participantSessionId: id, contentReleaseId: id, bookletKey: 'owned', bookletAssignmentKey: 'owned', executionMode: mode,
      status: 'running', currentUnitKey: 'unit', unitResponses: {}, updatedAt: timestamp, completedAt: null };
    await repository.saveTestRun(run);
    return { id, run: await repository.getTestRunById(id), services, base, tenant, workspace };
  };
  const receipt = async (repo, f, deliveryId) => {
    let result;
    const scope = await repo.getTestRunById(f.id);
    await repo.mutateParticipantRun({ ...scope, deliveryId }, context => { result = context.progressDelivery; return null; });
    return result ?? null;
  };
  const snapshot = async (f, deliveryId) => ({ run: await repository.getTestRunById(f.id), parent: await repository.getParticipantSessionById(f.id),
    logs: await repository.listParticipantTestLogsByWorkspace(f.base.tenantId, f.base.workspaceId),
    events: await repository.listWorkspaceActivityEventsByWorkspace(f.base.tenantId, f.base.workspaceId), receipt: deliveryId ? await receipt(repository, f, deliveryId) : null });
  const request = (f, patch = {}) => ({ testRunId: f.id, deliveryId: randomUUID(), responseUnitKey: 'unit', status: 'running', unitResponse: 'Exact Ä/β\n  spaces\u0000 ', ...patch });
  try {
    if (url) { rootPool = new Pool({ connectionString: process.env.FIRST_SLICE_POSTGRES_URL }); await rootPool.query(`CREATE SCHEMA "${schema}"`); created = true; }
    repository = await create();
    if (kind === 'sqlite') control = new DatabaseSync(file);
    if (url) { const controlUrl = new URL(url); controlUrl.searchParams.set('application_name', schema + '_control'); control = new Pool({ connectionString: controlUrl.toString() }); }

    if (control) await t.test('upgrading the previous schema preserves exact answers and a failed migration rolls back both new structures', async () => {
      const f = await fixture();
      await repository.saveTestRun({ ...f.run, unitResponses: { unit: 'Exact legacy Ä/β\n\u0000  spaces' } });
      const before = await repository.getTestRunById(f.id);
      const version = kind === 'sqlite' ? SQLITE_FIRST_SLICE_SCHEMA_VERSION : POSTGRES_FIRST_SLICE_SCHEMA_VERSION;
      assert.equal(version, kind === 'sqlite' ? 63 : 57);
      await execute(`DROP TABLE participant_progress_deliveries; ALTER TABLE test_runs DROP COLUMN response_field_timestamps_json;
        ALTER TABLE test_runs DROP COLUMN shared_parameter_timestamps_json; DELETE FROM schema_migrations WHERE version=${version}`);
      const migration = () => kind === 'sqlite' ? migrateSqliteFirstSliceStorage(file) : migratePostgresFirstSliceStorage(url.toString());
      const value = async sql => kind === 'sqlite' ? control.prepare(sql).get().value : (await control.query(sql)).rows[0].value;
      const install = kind === 'sqlite' ? `CREATE TRIGGER owned_delivery_upgrade_failure BEFORE INSERT ON schema_migrations WHEN NEW.version=${version} BEGIN SELECT RAISE(ABORT,'owned delivery upgrade failure'); END` :
        `CREATE FUNCTION owned_delivery_upgrade_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned delivery upgrade failure'; END $$;
        CREATE TRIGGER owned_delivery_upgrade_failure BEFORE INSERT ON schema_migrations FOR EACH ROW WHEN (NEW.version=${version}) EXECUTE FUNCTION owned_delivery_upgrade_failure()`;
      await execute(install);
      try {
        await assert.rejects(migration(), /owned delivery upgrade failure/);
        assert.equal(Number(await value('SELECT MAX(version) AS value FROM schema_migrations')), version - 1);
        assert.equal(Number(await value(kind === 'sqlite' ? "SELECT COUNT(*) AS value FROM sqlite_master WHERE name='participant_progress_deliveries'" :
          "SELECT COUNT(*)::int AS value FROM information_schema.tables WHERE table_schema=current_schema() AND table_name='participant_progress_deliveries'")), 0);
        assert.equal(Number(await value(kind === 'sqlite' ? "SELECT COUNT(*) AS value FROM pragma_table_info('test_runs') WHERE name IN ('response_field_timestamps_json','shared_parameter_timestamps_json')" :
          "SELECT COUNT(*)::int AS value FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='test_runs' AND column_name IN ('response_field_timestamps_json','shared_parameter_timestamps_json')")), 0);
      } finally {
        await execute(kind === 'sqlite' ? 'DROP TRIGGER owned_delivery_upgrade_failure' :
          'DROP TRIGGER owned_delivery_upgrade_failure ON schema_migrations; DROP FUNCTION owned_delivery_upgrade_failure()');
      }
      assert.equal((await migration()).currentSchemaVersion, version);
      repository = await create(); assert.deepEqual(await repository.getTestRunById(f.id), before);
    });

    await t.test('an older duplicate cannot roll back a newer answer, navigation, status, logs or audit', async () => {
      const f = await fixture(), old = request(f);
      delete old.responseUnitKey; // Defaults must not be reinterpreted after navigation.
      await f.services.participantRuntime.saveProgress(old);
      const newer = request(f, { unitResponse: 'Newest exact answer Ω', currentUnitKey: 'second', status: 'paused' });
      await f.services.participantRuntime.saveProgress(newer);
      const before = await snapshot(f, old.deliveryId);
      const acknowledged = await f.services.participantRuntime.saveProgress(old);
      assert.equal(acknowledged.unitResponses.unit, newer.unitResponse);
      assert.equal(acknowledged.currentUnitKey, 'second'); assert.equal(acknowledged.status, 'paused');
      assert.deepEqual(await snapshot(f, old.deliveryId), before);
    });
    await t.test('a delivery ID is immutable across answer, control and log changes', async () => {
      const f = await fixture(), input = request(f); await f.services.participantRuntime.saveProgress(input);
      const before = await snapshot(f, input.deliveryId);
      for (const patch of [{ unitResponse: 'Different bytes' }, { currentUnitKey: 'second' }, { status: 'paused' },
        { logs: [{ entries: [{ key: 'NEW', timeStamp: 10, content: 'Changed log' }] }] }, { responseTimestamp: 10 }]) {
        await assert.rejects(f.services.participantRuntime.saveProgress({ ...input, ...patch }), denied('participant_delivery_conflict'));
        assert.deepEqual(await snapshot(f, input.deliveryId), before);
      }
    });
    for (const state of ['locked', 'completed']) await t.test(`an accepted retry acknowledges the current ${state} Run; new deliveries still reject`, async () => {
      const f = await fixture(), input = request(f); await f.services.participantRuntime.saveProgress(input);
      await repository.mutateParticipantRun(f.run, context => ({ testRun: { ...context.testRun,
        ...(state === 'locked' ? { locked: true, status: 'paused', pauseSource: 'monitor' } : { status: 'completed', currentUnitKey: null, completedAt: timestamp }) }, testLogs: [], activityEvents: [] }));
      const before = await snapshot(f, input.deliveryId);
      const acknowledged = await f.services.participantRuntime.saveProgress(input);
      assert.equal(acknowledged.status, before.run.status); assert.equal(acknowledged.locked, before.run.locked ?? false);
      assert.deepEqual(await snapshot(f, input.deliveryId), before);
      await assert.rejects(f.services.participantRuntime.saveProgress({ ...input, deliveryId: randomUUID() }),
        denied(state === 'locked' ? 'test_run_locked' : 'test_run_already_completed'));
      assert.deepEqual(await snapshot(f, input.deliveryId), before);
    });
    await t.test('receipt and exact answer survive restart and no duplicate artifact is emitted', async () => {
      const f = await fixture(), input = request(f); await f.services.participantRuntime.saveProgress(input);
      const before = await snapshot(f, input.deliveryId), restarted = await create();
      assert.deepEqual(await receipt(restarted, f, input.deliveryId), before.receipt);
      assert.deepEqual(await restarted.getTestRunById(f.id), kind === 'file' ? JSON.parse(JSON.stringify(before.run)) : before.run);
      await service(restarted).participantRuntime.saveProgress(input);
      assert.deepEqual(await snapshot(f, input.deliveryId), before);
    });
    await t.test('accepted retries reconcile an expired timer without replaying answer or progress artifacts', async () => {
      const f = await fixture({ timed: true }), input = request(f); await f.services.participantRuntime.saveProgress(input);
      await repository.mutateParticipantRun(f.run, context => ({ testRun: { ...context.testRun, testletTimers: { outer: {
        testletKey: 'outer', status: 'running', durationSeconds: 300, remainingSeconds: 300,
        startedAt: '2026-10-10T23:50:00.000Z', expiresAt: '2026-10-10T23:55:00.000Z', updatedAt: timestamp, endedAt: null
      } } }, testLogs: [], activityEvents: [] }));
      const accepted = await f.services.participantRuntime.saveProgress(input);
      assert.equal(accepted.status, 'completed'); assert.equal(accepted.unitResponses.unit, input.unitResponse);
      assert.equal(accepted.testletTimers.outer.status, 'expired');
      const after = await snapshot(f, input.deliveryId);
      assert.equal(after.events.filter(event => event.eventType === 'test_run_progress_saved').length, 1);
      assert.equal(after.logs.filter(log => log.logKey === 'RESPONSE_SAVED').length, 1);
      await f.services.participantRuntime.saveProgress(input);
      assert.deepEqual(await snapshot(f, input.deliveryId), after);
    });
    await t.test('delivery IDs are scoped to the Run and parent scope cannot be forged', async () => {
      const f = await fixture(), input = request(f); await f.services.participantRuntime.saveProgress(input);
      const otherId = randomUUID(); await repository.saveTestRun({ ...f.run, testRunId: otherId, bookletKey: 'other', bookletAssignmentKey: 'other' });
      await f.services.participantRuntime.saveProgress({ ...input, testRunId: otherId, unitResponse: 'Independent Run answer' });
      assert.equal((await repository.getTestRunById(f.id)).unitResponses.unit, input.unitResponse);
      assert.equal((await repository.getTestRunById(otherId)).unitResponses.unit, 'Independent Run answer');
      for (const key of ['tenantId', 'workspaceId', 'participantSessionId', 'contentReleaseId']) {
        assert.equal(await repository.mutateParticipantRun({ ...f.run, deliveryId: input.deliveryId, [key]: 'wrong-scope' }, () => assert.fail('Foreign projection ran')), null);
      }
    });
    await t.test('invalid or cross-scope projected receipts cannot leave a Run or artifact behind', async () => {
      const f = await fixture(), input = request(f), before = await snapshot(f, input.deliveryId);
      const valid = { ...f.base, testRunId: f.id, participantSessionId: f.id, contentReleaseId: f.id, deliveryId: input.deliveryId,
        payloadSha256: 'a'.repeat(64), acceptedAt: timestamp };
      for (const patch of [{ testRunId: 'foreign' }, { tenantId: 'foreign' }, { workspaceId: 'foreign' }, { participantSessionId: 'foreign' },
        { contentReleaseId: 'foreign' }, { deliveryId: 'different' }, { payloadSha256: ['a'.repeat(64)] }, { payloadSha256: 'invalid' }, { acceptedAt: 30 }, { acceptedAt: 'invalid' }]) {
        await assert.rejects(repository.mutateParticipantRun({ ...f.run, deliveryId: input.deliveryId }, context => ({
          testRun: { ...context.testRun, unitResponses: { unit: 'Must roll back' } }, testLogs: [], activityEvents: [], progressDelivery: { ...valid, ...patch }
        })), /progress delivery/);
        assert.deepEqual(await snapshot(f, input.deliveryId), before);
      }
    });
    await t.test('opaque response capture times reject equal and older distinct deliveries; legacy arrival clocks stay monotonic', async () => {
      const f = await fixture();
      await f.services.participantRuntime.saveProgress(request(f, { responseTimestamp: 20, unitResponse: 'New opaque answer' }));
      for (const responseTimestamp of [10, 20]) await f.services.participantRuntime.saveProgress(request(f, { responseTimestamp, unitResponse: 'Stale opaque answer' }));
      assert.equal((await repository.getTestRunById(f.id)).unitResponses.unit, 'New opaque answer');
      await f.services.participantRuntime.saveProgress(request(f, { responseTimestamp: 21, unitResponse: 'Even newer exact answer' }));
      const saved = await repository.getTestRunById(f.id); assert.deepEqual(saved.unitResponseFieldTimestamps.unit, { opaque: 21 });
      for (const unitResponse of ['Legacy arrival one', 'Legacy arrival two']) await f.services.participantRuntime.saveProgress(request(f, { unitResponse }));
      assert.equal((await repository.getTestRunById(f.id)).unitResponses.unit, 'Legacy arrival two');
    });
    await t.test('out of order patches merge independent data parts and progress fields durably', async () => {
      const f = await fixture();
      const newer = packet({ responseProgress: 'complete', dataParts: { a: 'Newest A' } }, { unitState: { responseProgress: 30 }, dataParts: { a: 30 } });
      await f.services.participantRuntime.saveProgress(request(f, { unitResponse: newer }));
      const older = packet({ responseProgress: 'some', presentationProgress: 'complete', dataParts: { a: 'Old A', b: 'Independent B' } },
        { unitState: { responseProgress: 10, presentationProgress: 20 }, dataParts: { a: 10, b: 20 } });
      await f.services.participantRuntime.saveProgress(request(f, { unitResponse: older }));
      const saved = await (await create()).getTestRunById(f.id), parsed = parseVeronaUnitResponse(saved.unitResponses.unit);
      assert.deepEqual(parsed.unitState, { responseProgress: 'complete', presentationProgress: 'complete', dataParts: { a: 'Newest A', b: 'Independent B' } });
      assert.deepEqual(saved.unitResponseFieldTimestamps.unit, { unitState: { responseProgress: 30, presentationProgress: 20 }, dataParts: { a: 30, b: 20 } });
      await f.services.participantRuntime.saveProgress(request(f, { unitResponse: packet({ dataParts: { a: 'Equal timestamp forgery' } }, { dataParts: { a: 30 } }) }));
      assert.equal((await repository.getTestRunById(f.id)).unitResponses.unit, saved.unitResponses.unit);
    });
    await t.test('a cached unreported field cannot overwrite or insert an answer', async () => {
      const f = await fixture();
      await f.services.participantRuntime.saveProgress(request(f, { unitResponse: packet({ dataParts: { a: 'Unreported A', b: 'Reported B' } }, { dataParts: { b: 20 } }) }));
      assert.deepEqual(parseVeronaUnitResponse((await repository.getTestRunById(f.id)).unitResponses.unit).unitState.dataParts, { b: 'Reported B' });
    });
    await t.test('a clocked packet ignores an unused overflowing legacy arrival clock', async () => {
      const f = await fixture();
      await repository.saveTestRun({ ...f.run, unitResponses: { unit: 'Opaque ordering barrier' }, unitResponseFieldTimestamps: { unit: { opaque: Number.MAX_SAFE_INTEGER } } });
      const accepted = await f.services.participantRuntime.saveProgress(request(f, { unitResponse: packet({ dataParts: { a: 'Stale' } }, { dataParts: { a: 20 } }) }));
      assert.equal(accepted.unitResponses.unit, 'Opaque ordering barrier');
      assert.deepEqual(accepted.unitResponseFieldTimestamps.unit, { opaque: Number.MAX_SAFE_INTEGER });
    });
    await t.test('shared variables cannot roll back across two Units, while independent keys can advance', async () => {
      const f = await fixture();
      const shared = (clock, parameters) => packet({}, { playerState: { sharedParameters: clock } }, { sharedParameters: parameters });
      await f.services.participantRuntime.saveProgress(request(f, { unitResponse: shared(30, [{ key: 'shared', value: 'New' }, { key: '__proto__', value: 'Own' }]) }));
      await f.services.participantRuntime.saveProgress(request(f, { responseUnitKey: 'second', unitResponse: shared(20, [{ key: 'shared', value: 'Old' }, { key: 'independent', value: 'Accepted' }]) }));
      const saved = await (await create()).getTestRunById(f.id);
      assert.deepEqual(saved.sharedParameters, [{ key: 'shared', value: 'New' }, { key: '__proto__', value: 'Own' }, { key: 'independent', value: 'Accepted' }]);
      assert.deepEqual(saved.sharedParameterTimestamps, JSON.parse('{"shared":30,"__proto__":30,"independent":20}'));
      await f.services.participantRuntime.saveProgress(request(f, { unitResponse: shared(10, [{ key: 'late', value: 'Stale field' }]) }));
      assert.deepEqual((await repository.getTestRunById(f.id)).sharedParameters, saved.sharedParameters);
    });
    await t.test('stale completion fields cannot bypass navigation or completion restrictions', async () => {
      const f = await fixture({ completeRequired: true });
      const incomplete = packet({ presentationProgress: 'some', responseProgress: 'some' }, { unitState: { presentationProgress: 30, responseProgress: 30 } });
      await f.services.participantRuntime.saveProgress(request(f, { unitResponse: incomplete }));
      const stale = packet({ presentationProgress: 'complete', responseProgress: 'complete' }, { unitState: { presentationProgress: 10, responseProgress: 10 } });
      const before = await snapshot(f);
      await assert.rejects(f.services.participantRuntime.saveProgress(request(f, { unitResponse: stale, currentUnitKey: 'second' })), denied('booklet_navigation_denied'));
      await assert.rejects(f.services.participantRuntime.completeRun({ testRunId: f.id, responseUnitKey: 'unit', unitResponse: stale }), denied('booklet_completion_denied'));
      assert.deepEqual(await snapshot(f), before);
      const fresh = packet({ presentationProgress: 'complete', responseProgress: 'complete', dataParts: { answer: 'Final accepted answer' } },
        { unitState: { presentationProgress: 40, responseProgress: 40 }, dataParts: { answer: 40 } });
      const completed = await f.services.participantRuntime.completeRun({ testRunId: f.id, responseUnitKey: 'unit', unitResponse: fresh });
      assert.equal(completed.status, 'completed'); assert.equal(completed.unitResponses.unit, fresh);
      assert.deepEqual((await (await create()).getTestRunById(f.id)).unitResponseFieldTimestamps.unit.dataParts, { answer: 40 });
    });
    await t.test('malformed timestamps and malformed envelope clocks roll back every artifact', async () => {
      const f = await fixture(), input = request(f), before = await snapshot(f, input.deliveryId);
      for (const responseTimestamp of [null, 0, -1, 1.5, '10', Number.MAX_SAFE_INTEGER + 1]) {
        await assert.rejects(f.services.participantRuntime.saveProgress({ ...input, responseTimestamp }), denied('participant_response_timestamps_invalid'));
      }
      const invalid = JSON.stringify({ kind: 'verona_unit_state', version: 1, unitState: { dataParts: { a: 'Invalid' } }, fieldTimestamps: { dataParts: { a: -1 } } });
      await assert.rejects(f.services.participantRuntime.saveProgress({ ...input, unitResponse: invalid }), denied('participant_response_timestamps_invalid'));
      assert.deepEqual(await snapshot(f, input.deliveryId), before);
    });
    await t.test('fresh Player input uses the stored legacy clock when the device is one minute behind', async () => {
      const f = await fixture();
      await f.services.participantRuntime.saveProgress({ testRunId: f.id, responseUnitKey: 'unit', unitResponse: '', status: 'running' });
      const stored = await repository.getTestRunById(f.id), baseline = stored.unitResponseFieldTimestamps.unit;
      const response = mergeCapturedVeronaUnitResponse('', { unitState: { dataParts: { answer: 'Fresh input Ω\n  \u0000 ' } },
        captureTimestamp: Date.parse(timestamp) - 60_000, storedFieldTimestamps: baseline });
      const accepted = await f.services.participantRuntime.saveProgress(request(f, { responseOnly: true, unitResponse: response,
        responseTimestamp: Date.parse(timestamp) - 60_000 }));
      assert.equal(accepted.unitResponses.unit, response);
      assert.equal(accepted.unitResponseFieldTimestamps.unit.dataParts.answer, baseline.opaque + 1);
      assert.equal((await (await create()).getTestRunById(f.id)).unitResponses.unit, response);
    });
    await t.test('first delayed response-only deliveries cannot reset current navigation, status, pause source or timers', async () => {
      for (const status of ['running', 'paused']) {
        const f = await fixture({ timed: true });
        await f.services.participantRuntime.saveProgress(request(f, { currentUnitKey: 'second', status, unitResponse: 'Newest answer', responseTimestamp: 20 }));
        const before = await snapshot(f);
        const delayed = request(f, { responseOnly: true, status: status === 'paused' ? 'running' : 'paused', unitResponse: 'Older answer', responseTimestamp: 10 });
        const accepted = await f.services.participantRuntime.saveProgress(delayed);
        assert.equal(accepted.unitResponses.unit, 'Newest answer'); assert.equal(accepted.currentUnitKey, 'second');
        assert.equal(accepted.status, status); assert.equal(accepted.pauseSource, before.run.pauseSource);
        assert.equal(accepted.locked, before.run.locked); assert.deepEqual(accepted.lockedUnitKeys, before.run.lockedUnitKeys);
        assert.equal(accepted.testletTimers.outer.status, before.run.testletTimers.outer.status);
        assert.equal(accepted.testletTimers.outer.startedAt, before.run.testletTimers.outer.startedAt);
        assert.equal(accepted.testletTimers.outer.expiresAt, before.run.testletTimers.outer.expiresAt);
        assert.equal(accepted.testletTimers.outer.endedAt, before.run.testletTimers.outer.endedAt);
        assert.deepEqual((await snapshot(f)).parent, before.parent);
        assert.ok(await receipt(repository, f, delayed.deliveryId));
      }
    });
    await t.test('response-only answers preserve a monitor pause and its timers while accepting actual new fields', async () => {
      const f = await fixture({ timed: true });
      await f.services.participantRuntime.saveProgress(request(f));
      const running = await repository.getTestRunById(f.id);
      const commandId = randomUUID();
      await repository.appendParticipantRunCommand({ ...running, commandId, commandType: 'pause', issuedAt: timestamp,
        actorId: null, targetUnitKey: null, remainingSeconds: null, effectsDeferred: true });
      await repository.acknowledgeParticipantRunCommand({ ...running, commandId, acknowledgedAt: timestamp });
      await f.services.participantRuntime.executeCommand({ participantSessionId: f.id, testRunId: f.id, commandId, controllerStatus: 'RUNNING' });
      const before = await repository.getTestRunById(f.id);
      const input = request(f, { responseOnly: true, status: 'running', unitResponse: 'New paused response' });
      const accepted = await f.services.participantRuntime.saveProgress(input);
      assert.equal(accepted.unitResponses.unit, input.unitResponse); assert.equal(accepted.status, 'paused');
      assert.equal(accepted.pauseSource, 'monitor'); assert.equal(accepted.currentUnitKey, 'unit');
      assert.equal(accepted.testletTimers.outer.status, 'paused'); assert.equal(accepted.testletTimers.outer.expiresAt, null);
      assert.equal(accepted.testletTimers.outer.startedAt, before.testletTimers.outer.startedAt);
      assert.equal(accepted.testletTimers.outer.remainingSeconds, before.testletTimers.outer.remainingSeconds);
    });
    await t.test('response-only mode rejects missing addressing and all attempted control changes without writing artifacts', async () => {
      const f = await fixture(), input = request(f, { responseOnly: true }), before = await snapshot(f, input.deliveryId);
      for (const patch of [{ responseOnly: null }, { responseOnly: 'true' }, { responseOnly: 1 },
        { responseUnitKey: undefined }, { responseUnitKey: null }, { responseUnitKey: '' },
        { currentUnitKey: 'second' }, { currentUnitKey: null }, { confirmTestletTimeLeave: true }, { confirmTestletLeaveLock: true }]) {
        await assert.rejects(f.services.participantRuntime.saveProgress({ ...input, ...patch }), denied('participant_response_delivery_invalid'));
      }
      assert.deepEqual(await snapshot(f, input.deliveryId), before);
    });
    await t.test('response-only delivery cannot activate a created Run or start its timers', async () => {
      const f = await fixture({ timed: true });
      await repository.saveTestRun({ ...f.run, status: 'created', currentUnitKey: null });
      const accepted = await f.services.participantRuntime.saveProgress(request(f, { responseOnly: true }));
      assert.equal(accepted.status, 'created'); assert.equal(accepted.currentUnitKey, null);
      assert.deepEqual(accepted.testletTimers ?? {}, {});
    });
    await t.test('upgraded response-only transport acknowledges a legacy receipt while new receipts bind the delivery mode', async () => {
      const f = await fixture(), legacy = request(f); await f.services.participantRuntime.saveProgress(legacy);
      await f.services.participantRuntime.saveProgress(request(f, { currentUnitKey: 'second', status: 'paused', unitResponse: 'Newest' }));
      const before = await snapshot(f, legacy.deliveryId);
      const acknowledged = await f.services.participantRuntime.saveProgress({ ...legacy, responseOnly: true });
      assert.equal(acknowledged.unitResponses.unit, 'Newest'); assert.equal(acknowledged.status, 'paused');
      assert.equal(acknowledged.currentUnitKey, 'second'); assert.deepEqual(await snapshot(f, legacy.deliveryId), before);
      await assert.rejects(f.services.participantRuntime.saveProgress({ ...legacy, responseOnly: true, unitResponse: 'Changed request' }), denied('participant_delivery_conflict'));
      const modern = request(f, { responseOnly: true }); await f.services.participantRuntime.saveProgress(modern);
      await assert.rejects(f.services.participantRuntime.saveProgress({ ...modern, responseOnly: false }), denied('participant_delivery_conflict'));
    });
    await t.test('non-saving mode persists no answer clocks or answer fingerprint and duplicate controls remain stable', async () => {
      for (const responseOnly of [false, true]) {
      const f = await fixture({ mode: 'run-demo' }), input = request(f, { responseOnly }); await f.services.participantRuntime.saveProgress(input);
      const before = await snapshot(f, input.deliveryId);
      assert.deepEqual(before.run.unitResponses, {}); assert.equal(before.run.unitResponseFieldTimestamps, undefined);
      await f.services.participantRuntime.saveProgress({ ...input, unitResponse: 'Different transient answer', responseTimestamp: 20 });
      assert.deepEqual(await snapshot(f, input.deliveryId), before);
      await assert.rejects(f.services.participantRuntime.saveProgress({ ...input, status: 'paused' }), denied('participant_delivery_conflict'));
      }
    });
    await t.test('concurrent same-ID deliveries produce one accepted receipt and one set of artifacts', async () => {
      const f = await fixture(), input = request(f);
      const replica = kind === 'sqlite' || kind === 'postgres' ? await create() : repository;
      await Promise.all(Array.from({ length: 12 }, (_, i) => service(i % 2 ? repository : replica).participantRuntime.saveProgress(input)));
      const saved = await snapshot(f, input.deliveryId);
      assert.equal(saved.run.unitResponses.unit, input.unitResponse);
      assert.equal(saved.events.filter(event => event.eventType === 'test_run_progress_saved').length, 1);
      assert.equal(saved.logs.filter(log => log.logKey === 'RESPONSE_SAVED').length, 1);
    });
    if (kind === 'file') await t.test('failed File publication rolls back receipt and clocks in cache and after restart', async () => {
      const f = await fixture(), input = request(f, { responseOnly: true }), before = await snapshot(f, input.deliveryId), backup = file + '.owned-backup';
      await rename(file, backup); await mkdir(file);
      try { await assert.rejects(f.services.participantRuntime.saveProgress(input)); assert.deepEqual(await snapshot(f, input.deliveryId), before); }
      finally { await rm(file, { recursive: true }); await rename(backup, file); }
      const restarted = await create(); assert.equal(await receipt(restarted, f, input.deliveryId), null);
      assert.deepEqual(await restarted.getTestRunById(f.id), before.run);
      await f.services.participantRuntime.saveProgress(input); assert.ok(await receipt(await create(), f, input.deliveryId));
    });
    if (control) for (const target of ['run', 'log', 'audit']) await t.test(`${target} failure after receipt insertion rolls back receipt, answers, clocks and artifacts`, async () => {
      const f = await fixture(), input = request(f, { responseOnly: true, unitResponse: packet({ dataParts: { a: 'Transactional A' } }, { dataParts: { a: 20 } }) }), before = await snapshot(f, input.deliveryId);
      const table = target === 'run' ? 'test_runs' : target === 'log' ? 'participant_test_logs' : 'workspace_activity_events';
      const field = target === 'audit' ? 'subject_id' : 'test_run_id';
      const install = kind === 'sqlite' ? `CREATE TRIGGER owned_delivery_failure BEFORE INSERT ON ${table} WHEN NEW.${field}='${f.id}' BEGIN SELECT RAISE(ABORT,'owned delivery failure'); END` :
        `CREATE FUNCTION owned_delivery_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned delivery failure'; END $$; CREATE TRIGGER owned_delivery_failure BEFORE INSERT ON ${table} FOR EACH ROW WHEN (NEW.${field}='${f.id}') EXECUTE FUNCTION owned_delivery_failure()`;
      const remove = kind === 'sqlite' ? 'DROP TRIGGER owned_delivery_failure' : `DROP TRIGGER owned_delivery_failure ON ${table}; DROP FUNCTION owned_delivery_failure()`;
      await execute(install);
      try { await assert.rejects(f.services.participantRuntime.saveProgress(input), /owned delivery failure/); assert.deepEqual(await snapshot(f, input.deliveryId), before); }
      finally { await execute(remove); }
      assert.equal(await receipt(await create(), f, input.deliveryId), null);
      await f.services.participantRuntime.saveProgress(input); assert.ok(await receipt(await create(), f, input.deliveryId));
    });
    if (kind === 'postgres') await t.test('a duplicate waits for the first uncommitted receipt and then observes one acceptance', async () => {
      const f = await fixture(), input = request(f), replica = await create();
      let first, second;
      await execute(`CREATE FUNCTION owned_delivery_hold() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN PERFORM pg_sleep(2); RETURN NEW; END $$;
        CREATE TRIGGER owned_delivery_hold BEFORE INSERT ON participant_progress_deliveries FOR EACH ROW WHEN (NEW.test_run_id='${f.id}') EXECUTE FUNCTION owned_delivery_hold()`);
      const waitFor = async event => {
        for (let attempt = 0; attempt < 100; attempt++) {
          if ((await control.query("SELECT 1 FROM pg_stat_activity WHERE application_name=$1 AND wait_event=$2", [schema, event])).rowCount) return true;
          await delay(20);
        }
        return false;
      };
      try {
        first = f.services.participantRuntime.saveProgress(input);
        first.catch(() => {});
        assert.equal(await waitFor('PgSleep'), true, 'The receipt transaction must still be uncommitted.');
        let settled = false;
        second = service(replica).participantRuntime.saveProgress(input).finally(() => { settled = true; });
        second.catch(() => {});
        assert.equal(await waitFor('transactionid'), true, 'The duplicate must wait for the parent row lock.');
        assert.equal(settled, false);
        await Promise.all([first, second]);
        const saved = await snapshot(f, input.deliveryId); assert.ok(saved.receipt);
        assert.equal(saved.events.filter(event => event.eventType === 'test_run_progress_saved').length, 1);
        assert.equal(saved.logs.filter(log => log.logKey === 'RESPONSE_SAVED').length, 1);
      } finally {
        await Promise.allSettled([first, second].filter(Boolean));
        await execute('DROP TRIGGER owned_delivery_hold ON participant_progress_deliveries; DROP FUNCTION owned_delivery_hold()');
      }
    });
    await t.test('Run deletion removes its receipts and cannot affect another Run with the same delivery ID', async () => {
      const f = await fixture(), other = await fixture(), input = request(f);
      await f.services.participantRuntime.saveProgress(input); await other.services.participantRuntime.saveProgress({ ...input, testRunId: other.id });
      await repository.deleteTestRunsByIds([f.id]); assert.equal(await repository.getTestRunById(f.id), null);
      assert.ok(await receipt(repository, other, input.deliveryId));
      await repository.saveTestRun(f.run); assert.equal(await receipt(repository, f, input.deliveryId), null);
      await f.services.participantRuntime.saveProgress({ ...input, unitResponse: 'Fresh answer after deletion' });
      assert.equal((await repository.getTestRunById(f.id)).unitResponses.unit, 'Fresh answer after deletion');
    });
    await t.test('workspace deletion removes owned receipts and preserves an independent workspace', async () => {
      const f = await fixture(), other = await fixture(), input = request(f);
      const parent = await repository.getParticipantSessionById(f.id);
      await f.services.participantRuntime.saveProgress(input); await other.services.participantRuntime.saveProgress({ ...input, testRunId: other.id });
      await repository.deleteWorkspaceAggregate({ tenantKey: f.tenant.tenantKey, workspaceKey: f.workspace.workspaceKey, ...f.base,
        auditEvent: { adminAuditEventId: randomUUID(), eventType: 'workspace_deleted', actorAdminUserId: null,
          subjectAdminUserId: null, occurredAt: timestamp, summary: 'Owned delivery cleanup', details: {} } });
      assert.equal(await repository.getTestRunById(f.id), null);
      assert.ok(await receipt(repository, other, input.deliveryId));
      await repository.saveWorkspace({ tenantKey: f.tenant.tenantKey, workspaceKey: f.workspace.workspaceKey, workspace: f.workspace });
      await repository.saveParticipantSession(parent); await repository.saveTestRun(f.run);
      assert.equal(await receipt(repository, f, input.deliveryId), null);
    });
  } finally {
    for (const storage of storages) await storage.shutdown();
    if (kind === 'sqlite') control?.close(); else await control?.end();
    try { if (created) await rootPool.query(`DROP SCHEMA "${schema}" CASCADE`); }
    finally { await rootPool?.end(); await rm(directory, { recursive: true, force: true }); }
  }
});
