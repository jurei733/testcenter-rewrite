import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {Pool} from 'pg';
import {createFirstSliceServices} from '@testcenter-rewrite-app/application';
import {compileBookletRuntimePolicy, parseVeronaUnitResponse} from '@testcenter-rewrite-app/contracts';
import {serializeCapturedVeronaUnitResponse as packet} from '@testcenter-rewrite-app/contracts/participant-response-capture';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceStorage} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceStorage, migrateSqliteFirstSliceStorage, SQLITE_FIRST_SLICE_SCHEMA_VERSION} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage, migratePostgresFirstSliceStorage, POSTGRES_FIRST_SLICE_SCHEMA_VERSION} from '@testcenter-rewrite-app/postgres-store';
import {ParticipantResponseTypeError, withOrderedParticipantResponse} from '../packages/application/dist/packages/application/src/participant-response-persistence.js';
import {prepareOriginalXmlSchemaValidator} from '../packages/application/dist/packages/application/src/original-xml-schema.js';

const timestamp = '2026-10-25T12:00:00.000Z';
const captured = (dataParts, clocks, type, typeClock) => packet({unitState: {...(type === undefined ? {} : {unitStateDataType: type}), dataParts},
  fieldTimestamps: {dataParts: clocks, ...(typeClock === undefined ? {} : {unitState: {unitStateDataType: typeClock}})}});
const base = {unitResponses: {}, updatedAt: timestamp};
const apply = (testRun, response, unitKey = 'unit', responseTimestamp = 99) => withOrderedParticipantResponse({testRun, unitKey, response, responseTimestamp, timestamp});

test('prototype-named Units and parts retain only their own accepted response types', () => {
  let run = {...base, unitResponsePartTypes: {untouched: {part: 'other/type'}}};
  for (const unit of ['__proto__', 'constructor', 'toString']) {
    run = apply(run, captured(Object.fromEntries([['__proto__', 'exact'], ['constructor', 'also exact']]),
      Object.fromEntries([['__proto__', 10], ['constructor', 10]]), 'native/Ω', 10), unit);
    assert.deepEqual(run.unitResponsePartTypes[unit], Object.fromEntries([['__proto__', 'native/Ω'], ['constructor', 'native/Ω']]));
  }
  assert.deepEqual(run.unitResponsePartTypes.untouched, {part: 'other/type'});
  assert.equal(Object.hasOwn({}, 'part'), false);
});

test('type metadata follows accepted part clocks rather than global type clocks or untrusted envelope sidecars', () => {
  let run = apply(base, captured({a: 'first'}, {a: 20}, 'first/type', 20));
  const response = captured({b: 'new older part', a: 'equal replay'}, {b: 10, a: 20}, 'second/type', 10);
  run = apply(run, response);
  assert.equal(parseVeronaUnitResponse(run.unitResponses.unit).unitState.unitStateDataType, 'first/type');
  assert.deepEqual(run.unitResponsePartTypes.unit, {a: 'first/type', b: 'second/type'});
  const before = structuredClone(run);
  run = apply(run, captured({a: 'stale', b: 'equal'}, {a: 19, b: 10}, 'forged/type', 30));
  assert.deepEqual(run.unitResponsePartTypes, before.unitResponsePartTypes);
  const forged = JSON.parse(captured({a: 'accepted'}, {a: 21}, undefined));
  forged.unitResponsePartTypes = {unit: {a: 'forged'}};
  run = apply(run, JSON.stringify(forged));
  assert.deepEqual(run.unitResponsePartTypes.unit, {a: 'unknown', b: 'second/type'});
  run = apply(run, captured({empty: 'valid raw type'}, {empty: 22}, '', 31));
  assert.equal(run.unitResponsePartTypes.unit.empty, '');
  run = apply(run, captured({invalid: 'malformed declared type'}, {invalid: 23}, {not: 'a string'}, 32));
  assert.equal(run.unitResponsePartTypes.unit.invalid, 'unknown');
});

test('Source varchar(50) type limits prevent oversized metadata multiplication while preserving Unicode characters', () => {
  const maximum = '😀'.repeat(50), run = apply(base, captured({a: 'accepted'}, {a: 20}, maximum, 20));
  assert.equal(run.unitResponsePartTypes.unit.a, maximum);
  for (const type of ['x'.repeat(51), '😀'.repeat(51), 'invalid\u0000type', '\ud800', '\udfff']) {
    assert.throws(() => apply(base, captured({a: 'rejected'}, {a: 20}, type, 20)), ParticipantResponseTypeError);
  }
  const keys = Array.from({length: 1000}, (_, index) => ['part-' + index, 'value']);
  assert.throws(() => apply(base, captured(Object.fromEntries(keys), Object.fromEntries(keys.map(([key]) => [key, 20])), 'x'.repeat(10000), 20)), ParticipantResponseTypeError);
  assert.deepEqual(base.unitResponses, {});
});

test('opaque replacement retires its Unit type history only when accepted and retains the opaque barrier', () => {
  const original = {...apply(base, captured({a: 'first'}, {a: 20}, 'first/type', 20)),
    unitResponsePartTypes: {unit: {a: 'first/type'}, sibling: {a: 'sibling/type'}}};
  assert.deepEqual(apply(original, 'stale opaque', 'unit', 20).unitResponsePartTypes, original.unitResponsePartTypes);
  let run = apply(original, 'new opaque', 'unit', 21);
  assert.deepEqual(run.unitResponsePartTypes, {sibling: {a: 'sibling/type'}});
  run = apply(run, captured({a: 'blocked', b: 'accepted'}, {a: 21, b: 22}, 'after/opaque', 22));
  assert.deepEqual(run.unitResponsePartTypes, {sibling: {a: 'sibling/type'}, unit: {b: 'after/opaque'}});
  assert.equal(parseVeronaUnitResponse(run.unitResponses.unit).unitState.dataParts.a, undefined);
});

const source = JSON.parse(await readFile(new URL('../test-fixtures/original-testcenter/source-workspace-results/native-unit-reports/receipt.json', import.meta.url), 'utf8'));
assert.equal(source.sourceCommit, 'eedae41840cbe90e5547c0211da818bdf620f5aa'); assert.equal(source.success, true); assert.equal(source.testMode, false);
const sourceParts = source.checks.find(row => row.name === 'response parts retain independent client clocks and response types across partial writes, equal/stale rejection and the omitted-type default').parts;
const validator = await prepareOriginalXmlSchemaValidator(resolve(process.env.FIRST_SLICE_XML_SCHEMA_CACHE || '.data/original-xml-schemas'), process.env.FIRST_SLICE_XML_SCHEMA_DOWNLOAD !== 'false');
const kinds = ['memory', 'file', 'sqlite'];
if (process.env.FIRST_SLICE_STORE === 'postgres') {assert.ok(process.env.FIRST_SLICE_POSTGRES_URL); kinds.push('postgres');}
for (const kind of kinds) test(`${kind}: native authenticated progress retains per-part type history durably`, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'owned-part-types-')), file = join(directory, kind === 'file' ? 'state.json' : 'state.sqlite');
  const schema = 'owned_part_types_' + randomUUID().replaceAll('-', '');
  const url = kind === 'postgres' ? new URL(process.env.FIRST_SLICE_POSTGRES_URL) : null;
  url?.searchParams.set('options', '-c search_path=' + schema); url?.searchParams.set('application_name', schema);
  let storage, repository, services, admin, control, created = false;
  const open = async () => {
    storage = kind === 'memory' ? storage ?? {repository: createInMemoryFirstSliceRepository(), shutdown: async () => {}}
      : kind === 'file' ? await createFileFirstSliceStorage(file) : kind === 'sqlite' ? createSqliteFirstSliceStorage(file) : await createPostgresFirstSliceStorage(url.toString());
    repository = storage.repository; services = createFirstSliceServices({repository, now: () => timestamp, originalXmlSchemaValidator: validator});
  };
  const close = async () => {if (kind !== 'memory') {const owned = storage; storage = undefined; await owned?.shutdown();}};
  const reopen = async () => {await close(); await open();};
  try {
    if (url) {admin = new Pool({connectionString: process.env.FIRST_SLICE_POSTGRES_URL}); await admin.query(`CREATE SCHEMA "${schema}"`); created = true;}
    await open();
    const tenant = await services.platform.createTenant({tenantKey: 'owned-' + randomUUID(), displayName: 'Owned types'});
    const workspace = await services.platform.createWorkspace({tenantKey: tenant.tenantKey, workspaceKey: 'owned', displayName: 'Owned types'});
    const scope = {tenantKey: tenant.tenantKey, workspaceKey: workspace.workspaceKey}, ids = {tenantId: tenant.tenantId, workspaceId: workspace.workspaceId};
    // An owned release supplies runtime content. Credential XML/schema parsing,
    // native Login/Person creation and all progress transactions are production code.
    const release = randomUUID();
    await repository.saveContentRelease({...ids, contentReleaseId: release, importJobId: release, releaseLabel: 'Owned types', status: 'active', createdAt: timestamp, activatedAt: timestamp,
      runtimeSnapshot: {bookletEntries: [{bookletKey: 'OWNED.BOOK', displayLabel: 'Owned', policy: compileBookletRuntimePolicy({}), testletEntries: [],
        unitEntries: ['unit', 'sibling'].map(unitKey => ({unitKey, originalUnitId: 'OWNED.' + unitKey, displayLabel: unitKey, content: 'Owned'}))}]}});
    await services.workspaceAdminRead.importParticipantRoster({...scope, rosterText: '<Testtakers xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/testcenter-testtaker-xml/18.0"><Metadata/><Group id="Owned.Types" label="Owned types"><Login name="owned-types" pw="Owned-types-secret" mode="run-hot-return"><Booklet codes="AbC">OWNED.BOOK</Booklet></Login><Login name="owned-types-review" pw="Owned-types-secret" mode="run-review"><Booklet codes="AbC">OWNED.BOOK</Booklet></Login></Group></Testtakers>'});
    const login = await services.originalAuthentication.login({name: 'owned-types', password: 'Owned-types-secret'});
    const person = (await services.originalAuthentication.person({loginToken: login.token, code: 'abc'})).participantSession;
    const initial = await services.participantRuntime.launch({participantSessionId: person.participantSessionId, bookletKey: 'OWNED.BOOK'});
    const read = () => repository.getTestRunById(initial.testRunId);
    const input = (response, extra = {}) => ({testRunId: initial.testRunId, status: 'running', responseOnly: true, responseUnitKey: 'unit', unitResponse: response, deliveryId: randomUUID(), ...extra});
    const save = (response, extra) => services.participantRuntime.saveProgress(input(response, extra));
    const testEvidence = structuredClone(initial.originalResultState);
    await t.test('actual Source four-part history survives partial, equal and stale writes and a new part with an older clock', async () => {
      const byId = new Map(sourceParts.map(part => [part.id, part]));
      const a = byId.get('part-a'), z = byId.get('part-z'), c = byId.get('part-c'), d = byId.get('part-default');
      await save(captured({[a.id]: a.content}, {[a.id]: a.ts}, a.responseType, a.ts));
      const second = input(captured({[z.id]: z.content, [a.id]: 'equal must not replace'}, {[z.id]: z.ts, [a.id]: a.ts}, z.responseType, z.ts));
      await services.participantRuntime.saveProgress(second);
      await save(captured({[c.id]: c.content, [a.id]: 'stale must not replace'}, {[c.id]: c.ts, [a.id]: a.ts - 1}, c.responseType, c.ts));
      await save(captured({[d.id]: d.content}, {[d.id]: d.ts}));
      const expected = Object.fromEntries(sourceParts.map(part => [part.id, part.responseType]));
      let run = await read(); assert.deepEqual(run.unitResponsePartTypes.unit, expected);
      for (const part of sourceParts) {
        assert.equal(parseVeronaUnitResponse(run.unitResponses.unit).unitState.dataParts[part.id], part.content);
        assert.equal(run.unitResponseFieldTimestamps.unit.dataParts[part.id], part.ts);
      }
      const beforeReplay = structuredClone(run);
      await services.participantRuntime.saveProgress(second); assert.deepEqual(await read(), beforeReplay);
      await reopen(); run = await read(); assert.deepEqual(run.unitResponsePartTypes.unit, expected);
      assert.deepEqual(run.originalResultState, testEvidence, 'Unit-only state must not advance Source Test-level result time.');
      const rows = await services.originalGroupResults.list(scope);
      assert.equal(rows.length, 1); assert.equal(rows[0].numUnitsTotal, 1);
      assert.equal(Object.keys(rows[0]).length, 8);
      assert.equal(JSON.stringify(rows).includes('unitResponsePartTypes'), false);
      assert.equal(JSON.stringify(rows).includes(a.content), false);
    });
    await t.test('oversized and invalid response types cannot change persisted answers, clocks, type history or Test evidence', async () => {
      const before = await read();
      for (const type of ['x'.repeat(51), '😀'.repeat(51), 'invalid\u0000type', '\ud800', '\udfff']) {
        await assert.rejects(save(captured({invalidType: 'must not persist'}, {invalidType: 5000}, type, 5000)), error => error.errorCode === 'participant_response_type_invalid' && error.statusCode === 400);
        assert.deepEqual(await read(), before);
      }
      const maximum = '😀'.repeat(50);
      await save(captured({validType: 'accepted'}, {validType: 5000}, maximum, 5000));
      await reopen(); assert.equal((await read()).unitResponsePartTypes.unit.validType, maximum);
    });
    await t.test('new independent parts merge under the Run transaction and client metadata cannot overwrite accepted types', async () => {
      const response = captured({parallelA: 'A'}, {parallelA: 80}, 'parallel/A', 80);
      const other = captured({parallelB: 'B'}, {parallelB: 70}, 'parallel/B', 70);
      await Promise.all([save(response, {unitResponsePartTypes: {unit: {parallelA: 'forged'}}}), save(other)]);
      const run = await read(); assert.equal(run.unitResponsePartTypes.unit.parallelA, 'parallel/A'); assert.equal(run.unitResponsePartTypes.unit.parallelB, 'parallel/B');
      assert.deepEqual(run.originalResultState, testEvidence);
      for (const key of ['tenantId', 'workspaceId', 'participantSessionId', 'contentReleaseId']) {
        assert.equal(await repository.mutateParticipantRun({...run, [key]: 'foreign'}, () => assert.fail('Cross-scope mutation ran')), null);
        assert.deepEqual(await read(), run);
      }
    });
    await t.test('legacy parts remain unknown rather than inheriting the latest global type; accepted opaque replacements retire only this Unit history', async () => {
      const legacy = await read();
      delete legacy.unitResponsePartTypes;
      legacy.unitResponses.unit = captured({oldA: 'old A', oldB: 'old B'}, {oldA: 100, oldB: 200}, 'latest/global', 200);
      legacy.unitResponseFieldTimestamps.unit = {dataParts: {oldA: 100, oldB: 200}, unitState: {unitStateDataType: 200}};
      await repository.saveTestRun(legacy); await reopen();
      assert.equal((await read()).unitResponsePartTypes, undefined);
      await save(captured({newC: 'new C'}, {newC: 150}, 'new/part', 150));
      assert.deepEqual((await read()).unitResponsePartTypes.unit, {newC: 'new/part'});
      await save(captured({siblingPart: 'sibling'}, {siblingPart: 300}, 'sibling/type', 300), {responseUnitKey: 'sibling'});
      await save('stale opaque', {responseTimestamp: 200}); assert.deepEqual((await read()).unitResponsePartTypes.unit, {newC: 'new/part'});
      await save('accepted opaque', {responseTimestamp: 201});
      assert.deepEqual((await read()).unitResponsePartTypes, {sibling: {siblingPart: 'sibling/type'}});
      await reopen(); assert.deepEqual((await read()).unitResponsePartTypes, {sibling: {siblingPart: 'sibling/type'}});
    });
    await t.test('non-saving reentry clears even an old persisted type sidecar with its answers and clocks', async () => {
      const reviewLogin = await services.originalAuthentication.login({name: 'owned-types-review', password: 'Owned-types-secret'});
      const reviewPerson = (await services.originalAuthentication.person({loginToken: reviewLogin.token, code: 'abc'})).participantSession;
      const reviewRun = await services.participantRuntime.launch({participantSessionId: reviewPerson.participantSessionId, bookletKey: 'OWNED.BOOK'});
      assert.equal(reviewRun.executionMode, 'run-review');
      await repository.saveTestRun({...reviewRun, unitResponses: {unit: 'Old non-saving answer'}, unitResponseFieldTimestamps: {unit: {opaque: 9}}, unitResponsePartTypes: {unit: {old: 'old/type'}}});
      await services.participantRuntime.returnToStarter({testRunId: reviewRun.testRunId});
      const run = await repository.getTestRunById(reviewRun.testRunId); assert.deepEqual(run.unitResponses, {}); assert.deepEqual(run.unitResponsePartTypes, {});
      await reopen(); assert.deepEqual((await repository.getTestRunById(reviewRun.testRunId)).unitResponsePartTypes, {});
    });
    if (kind === 'sqlite' || kind === 'postgres') await t.test('upgrading legacy rows does not invent types; migration failure rolls back the column and exact old answers', async () => {
      const legacy = {...await read(), unitResponses: {unit: captured({old: 'Exact legacy Ω\n  '}, {old: 90}, 'latest/global', 90)}};
      delete legacy.unitResponsePartTypes; await repository.saveTestRun(legacy); const before = await read(); await close();
      control = kind === 'sqlite' ? new DatabaseSync(file) : new Pool({connectionString: url.toString()});
      const exec = sql => kind === 'sqlite' ? control.exec(sql) : control.query(sql);
      const rows = async sql => kind === 'sqlite' ? control.prepare(sql).all().map(row => ({...row})) : (await control.query(sql)).rows;
      const version = kind === 'sqlite' ? 72 : 66;
      await exec(`ALTER TABLE participant_sessions DROP COLUMN original_operational_mode; ALTER TABLE operational_login_migration_candidates DROP COLUMN native_logins_json; DROP TABLE IF EXISTS original_native_units; DROP TABLE original_workspace_numbers; DROP TABLE original_workspace_number_counter; ALTER TABLE test_runs DROP COLUMN original_test_state_json; DROP TABLE original_test_numbers; DROP TABLE original_test_number_counter; ALTER TABLE test_runs DROP COLUMN response_part_types_json; DELETE FROM schema_migrations WHERE version>=${version}`);
      const expected = await rows('SELECT test_run_id,unit_responses_json FROM test_runs ORDER BY test_run_id');
      await exec(kind === 'sqlite' ? `CREATE TRIGGER owned_type_failure BEFORE INSERT ON schema_migrations WHEN NEW.version=${version} BEGIN SELECT RAISE(ABORT,'owned type migration failure'); END`
        : `CREATE FUNCTION owned_type_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned type migration failure'; END $$; CREATE TRIGGER owned_type_failure BEFORE INSERT ON schema_migrations FOR EACH ROW WHEN (NEW.version=${version}) EXECUTE FUNCTION owned_type_failure()`);
      const migrate = () => kind === 'sqlite' ? migrateSqliteFirstSliceStorage(file) : migratePostgresFirstSliceStorage(url.toString());
      try {
        await assert.rejects(migrate(), /owned type migration failure/);
        const columns = await rows(kind === 'sqlite' ? "SELECT name FROM pragma_table_info('test_runs') WHERE name='response_part_types_json'" : "SELECT column_name FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='test_runs' AND column_name='response_part_types_json'");
        assert.deepEqual(columns, []); assert.deepEqual(await rows('SELECT test_run_id,unit_responses_json FROM test_runs ORDER BY test_run_id'), expected);
        assert.equal(Number((await rows('SELECT MAX(version) AS version FROM schema_migrations'))[0].version), version - 1);
      } finally {
        await exec(kind === 'sqlite' ? 'DROP TRIGGER owned_type_failure' : 'DROP TRIGGER owned_type_failure ON schema_migrations; DROP FUNCTION owned_type_failure()');
      }
      assert.equal((await migrate()).currentSchemaVersion, kind === 'sqlite' ? SQLITE_FIRST_SLICE_SCHEMA_VERSION : POSTGRES_FIRST_SLICE_SCHEMA_VERSION);
      if (kind === 'sqlite') control.close(); else await control.end(); control = undefined;
      await open(); assert.deepEqual(await read(), before); assert.equal((await read()).unitResponsePartTypes, undefined);
    });
  } finally {
    await close(); if (kind === 'sqlite') control?.close(); else await control?.end();
    if (admin) {if (created) await admin.query(`DROP SCHEMA "${schema}" CASCADE`); await admin.end();}
    await rm(directory, {recursive: true, force: true});
  }
});
