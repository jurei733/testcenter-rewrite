import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {mkdtemp, readFile, writeFile, rm, rename, mkdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {Pool} from 'pg';
import {createFirstSliceServices, prepareOriginalPersonNumber, selectOriginalPersonNumber} from '@testcenter-rewrite-app/application';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceStorage} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceStorage, SQLITE_FIRST_SLICE_SCHEMA_VERSION} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage, POSTGRES_FIRST_SLICE_SCHEMA_VERSION} from '@testcenter-rewrite-app/postgres-store';

const evidence = new URL('../test-fixtures/original-testcenter/source-workspace-results/native-monitor-sessions/', import.meta.url);
test('Source75 protected production HTTP proves stable shared numeric person identity before Test entry', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', evidence), 'utf8'));
  assert.equal(manifest.sourceCommit, 'eedae41840cbe90e5547c0211da818bdf620f5aa');
  assert.equal(manifest.checks, 75); assert.equal(manifest.httpObservations, 1139); assert.equal(manifest.sourceFilesIndependentlyMatched, 48);
  for (const [name, sha] of Object.entries(manifest.files)) {
    assert.match(name, /^[a-z0-9][a-z0-9.-]*$/);
    assert.equal(createHash('sha256').update(await readFile(new URL(name, evidence))).digest('hex'), sha, name);
  }
  const receipt = JSON.parse(await readFile(new URL('receipt.json', evidence), 'utf8'));
  assert.equal(receipt.success, true); assert.equal(receipt.testMode, false); assert.equal(receipt.checks.length, 75);
  assert.equal(Object.keys(receipt.sourceFiles).length, 48);
  const rows = JSON.parse(await readFile(new URL('monitor-unopened.json', evidence), 'utf8'));
  const same = rows.filter(row => row.personLabel === 'owned-session-one/Shared');
  const peer = rows.filter(row => row.personLabel === 'owned-session-two/Shared');
  assert.equal(same.length, 3); assert.equal(peer.length, 2);
  assert.equal(new Set(same.map(row => row.personId)).size, 1);
  assert.notEqual(same[0].personId, peer[0].personId);
  assert.equal(new Set(rows.map(row => row.testId)).size, 5);
  for (const row of rows) { assert.ok(Number.isSafeInteger(row.personId) && row.personId > 0); assert.deepEqual(row.testState, {status: 'pending'}); }
  const reentry = receipt.checks.find(row => row.name.startsWith('monitor person numeric identity survives'));
  assert.equal(reentry.personId, same[0].personId);
  assert.deepEqual(reentry.rows.map(row => [row.personId, row.testId]), rows.map(row => [row.personId, row.testId]));
});

test('person counter is exact signed-int64 metadata and cannot invent a legacy identity', () => {
  const person = {participantSessionId: 'owned-person', tenantId: 'owned-tenant', workspaceId: 'owned-workspace', originalLoginKey: 'owned-login', originalNameSuffix: ''};
  const high = prepareOriginalPersonNumber(person, '9007199254740992');
  assert.equal(high.record.personNumber, '9007199254740993');
  assert.equal(selectOriginalPersonNumber(person, high.record, person), '9007199254740993');
  assert.equal(prepareOriginalPersonNumber(person, '9223372036854775806').counter, '9223372036854775807');
  assert.throws(() => prepareOriginalPersonNumber(person, '9223372036854775807'), /exhausted/);
  for (const counter of ['-1', '01', '', '1.5', '9223372036854775808', 1]) assert.throws(() => prepareOriginalPersonNumber(person, counter), /Invalid persisted/);
  assert.throws(() => prepareOriginalPersonNumber({...person, originalNameSuffix: undefined}, '0'), /observed immutable identity/);
  assert.equal(selectOriginalPersonNumber(person, undefined, person), null);
});

const kinds = process.env.FIRST_SLICE_STORE === 'postgres' ? ['postgres'] : ['memory', 'file', 'sqlite'];
for (const kind of kinds) test(`${kind}: atomic native person numbers retain scope, history and exact sequence through real store failures`, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'owned-person-number-'));
  const file = join(directory, kind === 'file' ? 'state.json' : 'state.sqlite');
  const schema = 'owned_person_number_' + randomUUID().replaceAll('-', '');
  const url = kind === 'postgres' ? new URL(process.env.FIRST_SLICE_POSTGRES_URL) : null;
  url?.searchParams.set('options', '-c search_path=' + schema);
  let storage, repository, pool, control, first, firstNumber, lastNumber;
  const open = async () => {
    storage = kind === 'memory' ? storage ?? {repository: createInMemoryFirstSliceRepository(), shutdown: async () => {}}
      : kind === 'file' ? await createFileFirstSliceStorage(file) : kind === 'sqlite' ? createSqliteFirstSliceStorage(file) : await createPostgresFirstSliceStorage(url.toString());
    repository = storage.repository;
  };
  const query = async (sql, args = []) => kind === 'sqlite' ? control.prepare(sql).all(...args) : (await control.query(sql, args)).rows;
  const patchFile = async update => {
    await storage.shutdown();
    const state = JSON.parse(await readFile(file, 'utf8')); update(state);
    await writeFile(file, JSON.stringify(state)); await open();
  };
  try {
    if (url) { pool = new Pool({connectionString: process.env.FIRST_SLICE_POSTGRES_URL}); await pool.query(`CREATE SCHEMA "${schema}"`); }
    await open();
    const services = createFirstSliceServices({repository});
    const tenant = await services.platform.createTenant({tenantKey: 'owned-' + randomUUID(), displayName: 'Owned numeric people'});
    const workspace = await services.platform.createWorkspace({tenantKey: tenant.tenantKey, workspaceKey: 'owned', displayName: 'Owned numeric people'});
    const scope = {tenantId: tenant.tenantId, workspaceId: workspace.workspaceId};
    const now = new Date().toISOString();
    const bind = async (loginKey, groupKey = 'OWNED.PEOPLE') => {
      await repository.getOrCreateOriginalParticipantGroup({...scope, groupKey, groupLabel: groupKey, createdAt: now});
      await repository.bindOriginalLoginGroup({...scope, loginKey, groupKey, groupSnapshotKey: groupKey, authenticatedAt: now});
    };
    const candidate = (loginKey, code = '') => ({...scope, participantSessionId: randomUUID(), contentReleaseId: null,
      loginKey, originalLoginKey: loginKey, originalNameSuffix: code, participantCode: code, groupKey: 'OWNED.PEOPLE',
      executionMode: 'run-hot-return', status: 'active', createdAt: now});
    const resolve = async (loginKey, code = '') => (await repository.resolveOriginalParticipantSession(candidate(loginKey, code))).participantSession;
    const number = person => repository.getOriginalPersonNumber(person);
    await bind('old');
    const old = candidate('old'); await repository.saveParticipantSession(old);
    await t.test('real additive upgrade preserves unnumbered historical people without guessing or consuming a number', async () => {
      if (kind === 'file') await patchFile(state => { delete state.originalPersonNumbers; delete state.originalPersonNumberCounter; });
      if (kind === 'sqlite' || kind === 'postgres') {
        await storage.shutdown();
        control = kind === 'sqlite' ? new DatabaseSync(file) : new Pool({connectionString: url.toString()});
        await query('DROP TABLE original_person_numbers'); await query('DROP TABLE original_person_number_counter');
        await query('DROP INDEX original_person_number_parent_scope');
        await query('DELETE FROM schema_migrations WHERE version=' + (kind === 'sqlite' ? SQLITE_FIRST_SLICE_SCHEMA_VERSION : POSTGRES_FIRST_SLICE_SCHEMA_VERSION));
        if (kind === 'postgres') {
          const failureName = schema + '_failed_startup', failureUrl = new URL(url);
          failureUrl.searchParams.set('application_name', failureName);
          await query("CREATE FUNCTION owned_person_upgrade_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned-person-upgrade-failure'; END; $$");
          await query('CREATE TRIGGER owned_person_upgrade_failure BEFORE INSERT ON schema_migrations FOR EACH ROW EXECUTE FUNCTION owned_person_upgrade_failure()');
          try {
            await assert.rejects(createPostgresFirstSliceStorage(failureUrl.toString()), /owned-person-upgrade-failure/);
            assert.equal(Number((await query('SELECT count(*) AS count FROM pg_stat_activity WHERE application_name=$1', [failureName]))[0].count), 0,
              'A rejected migration must close its real PostgreSQL connections before returning its original failure');
          } finally { await query('DROP TRIGGER owned_person_upgrade_failure ON schema_migrations'); await query('DROP FUNCTION owned_person_upgrade_failure()'); }
        }
        if (kind === 'sqlite') control.close(); else await control.end(); control = null;
        await open();
      }
      const existing = await resolve('old'); assert.equal(existing.participantSessionId, old.participantSessionId); assert.equal(await number(existing), null);
      await bind('first'); first = await resolve('first', 'AbC'); firstNumber = await number(first); lastNumber = firstNumber;
      assert.equal(firstNumber, '1'); assert.equal(first.personNumber, undefined);
      assert.equal((await repository.getParticipantSessionById(first.participantSessionId)).personNumber, undefined);
    });
    await t.test('case-equivalent reentry and concurrent callers reuse the first number without reservations', async () => {
      let peer;
      if (kind === 'sqlite') peer = createSqliteFirstSliceStorage(file);
      if (kind === 'postgres') peer = await createPostgresFirstSliceStorage(url.toString());
      try {
        const results = await Promise.all(Array.from({length: 12}, (_, index) => (index % 2 && peer ? peer.repository : repository)
          .resolveOriginalParticipantSession(candidate('first', index % 2 ? 'abc' : 'ABC'))));
        for (const result of results) { assert.equal(result.created, false); assert.equal(result.participantSession.participantSessionId, first.participantSessionId); assert.equal(await number(result.participantSession), firstNumber); }
        await bind('second'); const second = await resolve('second'); lastNumber = await number(second); assert.equal(lastNumber, '2');
      } finally { await peer?.shutdown(); }
    });
    await t.test('scope changes cannot disclose a private number; current group and mode changes retain it', async () => {
      for (const key of ['participantSessionId', 'tenantId', 'workspaceId', 'originalLoginKey', 'originalNameSuffix']) assert.equal(await number({...first, [key]: randomUUID()}), null, key);
      await bind('first', 'OWNED.MOVED');
      const moved = await repository.resolveOriginalParticipantSession({...candidate('first', 'abc'), executionMode: 'run-trial'});
      assert.equal(moved.participantSession.groupKey, 'OWNED.MOVED'); assert.equal(moved.participantSession.executionMode, 'run-trial');
      assert.equal(await number(moved.participantSession), firstNumber);
      await repository.saveParticipantSession(moved.participantSession); assert.equal(await number(first), firstNumber);
    });
    await t.test('simultaneous fresh native people get independent monotonically allocated identities', async () => {
      await bind('restart'); let peer;
      if (kind === 'sqlite') peer = createSqliteFirstSliceStorage(file);
      if (kind === 'postgres') peer = await createPostgresFirstSliceStorage(url.toString());
      try {
        const people = await Promise.all(Array.from({length: 16}, (_, index) => (index % 2 && peer ? peer.repository : repository)
          .resolveOriginalParticipantSession({...candidate('restart'), executionMode: 'run-hot-restart', originalNameSuffix: 'abcdefgh'})));
        const ids = await Promise.all(people.map(row => number(row.participantSession)));
        assert.equal(new Set(ids).size, 16);
        assert.deepEqual(ids.map(BigInt).sort((a, b) => a < b ? -1 : a > b ? 1 : 0), Array.from({length: 16}, (_, index) => BigInt(lastNumber) + BigInt(index + 1)));
        lastNumber = (BigInt(lastNumber) + 16n).toString();
      } finally { await peer?.shutdown(); }
    });
    await t.test('validation failure publishes neither a person nor a reservation', async () => {
      await bind('rejected'); const before = await repository.listParticipantSessionsByWorkspace(scope.tenantId, scope.workspaceId);
      await assert.rejects(repository.resolveOriginalParticipantSession(candidate('rejected'), () => { throw Error('owned-validation-failure'); }), /owned-validation-failure/);
      assert.deepEqual(await repository.listParticipantSessionsByWorkspace(scope.tenantId, scope.workspaceId), before);
      const person = await resolve('rejected'); assert.equal(await number(person), (BigInt(lastNumber) + 1n).toString()); lastNumber = await number(person);
    });
    await t.test('independent workspace writers share the counter and workspace deletion preserves the next number', async () => {
      const other = await createFirstSliceServices({repository}).platform.createWorkspace({tenantKey: tenant.tenantKey, workspaceKey: 'peer', displayName: 'Owned peer'});
      const otherScope = {tenantId: tenant.tenantId, workspaceId: other.workspaceId};
      await bind('cross-workspace');
      await repository.getOrCreateOriginalParticipantGroup({...otherScope, groupKey: 'OWNED.PEOPLE', groupLabel: 'Peer', createdAt: now});
      await repository.bindOriginalLoginGroup({...otherScope, loginKey: 'cross-workspace', groupKey: 'OWNED.PEOPLE', groupSnapshotKey: 'OWNED.PEOPLE', authenticatedAt: now});
      let peer;
      if (kind === 'sqlite') peer = createSqliteFirstSliceStorage(file);
      if (kind === 'postgres') peer = await createPostgresFirstSliceStorage(url.toString());
      try {
        const results = await Promise.all([
          repository.resolveOriginalParticipantSession(candidate('cross-workspace')),
          (peer?.repository ?? repository).resolveOriginalParticipantSession({...candidate('cross-workspace'), ...otherScope})
        ]);
        const ids = await Promise.all(results.map(row => number(row.participantSession)));
        assert.deepEqual(ids.map(BigInt).sort((a, b) => a < b ? -1 : 1), [BigInt(lastNumber) + 1n, BigInt(lastNumber) + 2n]);
        lastNumber = (BigInt(lastNumber) + 2n).toString();
        const foreign = results[1].participantSession;
        assert.equal(await number({...foreign, workspaceId: scope.workspaceId}), null);
        const deleted = await repository.deleteWorkspaceAggregate({...otherScope, tenantKey: tenant.tenantKey, workspaceKey: other.workspaceKey,
          auditEvent: {adminAuditEventId: randomUUID(), eventType: 'workspace_deleted', actorAdminUserId: null, subjectAdminUserId: null,
            occurredAt: now, summary: 'Owned peer deletion', details: {}}});
        assert.equal(deleted.deletedWorkspaceCount, 1); assert.equal(await number(foreign), null);
        await bind('after-workspace-delete'); const next = await resolve('after-workspace-delete');
        assert.equal(await number(next), (BigInt(lastNumber) + 1n).toString()); lastNumber = await number(next);
      } finally { await peer?.shutdown(); }
    });
    if (kind === 'sqlite' || kind === 'postgres') await t.test('database constraints reject a forged immutable person scope', async () => {
      control = kind === 'sqlite' ? new DatabaseSync(file) : new Pool({connectionString: url.toString()});
      if (kind === 'sqlite') control.exec('PRAGMA foreign_keys=ON');
      const sql = kind === 'sqlite' ? 'UPDATE original_person_numbers SET tenant_id=? WHERE participant_session_id=?' : 'UPDATE original_person_numbers SET tenant_id=$1 WHERE participant_session_id=$2';
      await assert.rejects(query(sql, [randomUUID(), first.participantSessionId]), /foreign key/i);
      assert.equal(await number(first), firstNumber);
      if (kind === 'sqlite') control.close(); else await control.end(); control = null;
    });
    if (kind !== 'memory') await t.test('actual durable write failure rolls back both fresh person and counter', async () => {
      await bind('write-failure'); const before = await repository.listParticipantSessionsByWorkspace(scope.tenantId, scope.workspaceId);
      if (kind === 'file') {
        await rename(file, file + '.before'); await mkdir(file);
        try { await assert.rejects(resolve('write-failure')); } finally { await rm(file, {recursive: true}); await rename(file + '.before', file); }
      } else {
        control = kind === 'sqlite' ? new DatabaseSync(file) : new Pool({connectionString: url.toString()});
        if (kind === 'sqlite') control.exec("CREATE TRIGGER owned_person_failure BEFORE INSERT ON original_person_numbers BEGIN SELECT RAISE(ABORT,'owned-number-failure'); END;");
        else {
          await query("CREATE FUNCTION owned_person_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned-number-failure'; END; $$");
          await query('CREATE TRIGGER owned_person_failure BEFORE INSERT ON original_person_numbers FOR EACH ROW EXECUTE FUNCTION owned_person_failure()');
        }
        try { await assert.rejects(resolve('write-failure'), /owned-number-failure/); }
        finally { await query('DROP TRIGGER owned_person_failure' + (kind === 'postgres' ? ' ON original_person_numbers' : '')); if (kind === 'postgres') await query('DROP FUNCTION owned_person_failure()'); }
      }
      assert.deepEqual(await repository.listParticipantSessionsByWorkspace(scope.tenantId, scope.workspaceId), before);
      const next = await resolve('write-failure'); assert.equal(await number(next), (BigInt(lastNumber) + 1n).toString()); lastNumber = await number(next);
      if (control) { if (kind === 'sqlite') control.close(); else await control.end(); control = null; }
    });
    await t.test('restart retains exact mappings and parent deletion removes them without recycling numbers', async () => {
      if (kind !== 'memory') { await storage.shutdown(); await open(); }
      assert.equal(await number(first), firstNumber);
      const removed = await repository.deleteOriginalGroupResults({...scope, groups: ['OWNED.MOVED']}); assert.equal(removed.deletedPersonCount, 1);
      assert.equal(await number(first), null);
      await bind('after-delete'); const after = await resolve('after-delete'); assert.equal(await number(after), (BigInt(lastNumber) + 1n).toString()); lastNumber = await number(after);
    });
    if (kind !== 'memory') await t.test('actual stored counters preserve values above 2^53 and exhaustion rolls back fresh identity', async () => {
      await bind('high'); await bind('exhausted');
      const setCounter = async value => {
        if (kind === 'file') return patchFile(state => { state.originalPersonNumberCounter = value; });
        control ??= kind === 'sqlite' ? new DatabaseSync(file) : new Pool({connectionString: url.toString()});
        if (kind === 'sqlite') control.prepare('UPDATE original_person_number_counter SET last_number=?').run(value);
        else await query('UPDATE original_person_number_counter SET last_number=$1', [value]);
      };
      await setCounter('9007199254740992'); const high = await resolve('high'); assert.equal(await number(high), '9007199254740993');
      await setCounter('9223372036854775807');
      const before = await repository.listParticipantSessionsByWorkspace(scope.tenantId, scope.workspaceId);
      await assert.rejects(resolve('exhausted'), /exhausted/); assert.deepEqual(await repository.listParticipantSessionsByWorkspace(scope.tenantId, scope.workspaceId), before);
      assert.equal(await number(high), '9007199254740993');
    });
  } finally {
    if (control) { if (kind === 'sqlite') control.close(); else await control.end(); }
    await storage?.shutdown();
    if (pool) { await pool.query(`DROP SCHEMA "${schema}" CASCADE`); await pool.end(); }
    await rm(directory, {recursive: true, force: true});
  }
});
