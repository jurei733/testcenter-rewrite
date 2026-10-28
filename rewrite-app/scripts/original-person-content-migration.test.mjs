import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {Pool} from 'pg';
import {createSqliteFirstSliceStorage, migrateSqliteFirstSliceStorage} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage, migratePostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';

const kinds = ['sqlite'];
if (process.env.FIRST_SLICE_STORE === 'postgres') { assert.ok(process.env.FIRST_SLICE_POSTGRES_URL); kinds.push('postgres'); }
for (const kind of kinds) test(`${kind}: release-independent native person migration preserves old parents, credentials, Tests and schema objects atomically`, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'owned-person-content-')), file = join(directory, 'state.sqlite');
  const schema = 'owned_content_' + randomUUID().replaceAll('-', '');
  const url = kind === 'postgres' ? new URL(process.env.FIRST_SLICE_POSTGRES_URL) : null;
  url?.searchParams.set('options', '-c search_path=' + schema); url?.searchParams.set('application_name', schema);
  let storage, repository, control, admin, created = false;
  const open = async () => { storage = kind === 'sqlite' ? createSqliteFirstSliceStorage(file) : await createPostgresFirstSliceStorage(url.toString()); repository = storage.repository; };
  const close = async () => { const owned = storage; storage = undefined; await owned?.shutdown(); };
  const exec = sql => kind === 'sqlite' ? control.exec(sql) : control.query(sql);
  const rows = async sql => kind === 'sqlite' ? control.prepare(sql).all().map(row => ({...row})) : (await control.query(sql)).rows;
  const migrate = () => kind === 'sqlite' ? migrateSqliteFirstSliceStorage(file) : migratePostgresFirstSliceStorage(url.toString());
  const version = kind === 'sqlite' ? 71 : 65, stamp = '2026-10-02T12:00:00.000Z';
  try {
    if (url) { admin = new Pool({connectionString: process.env.FIRST_SLICE_POSTGRES_URL}); await admin.query(`CREATE SCHEMA "${schema}"`); created = true; }
    await open();
    const ids = {tenantId: 'owned-tenant', workspaceId: 'owned-workspace'};
    await repository.saveTenant({tenantId: ids.tenantId, tenantKey: 'owned', displayName: 'Owned', status: 'active', createdAt: stamp});
    await repository.saveWorkspace({tenantKey: 'owned', workspaceKey: 'owned', workspace: {...ids, workspaceKey: 'owned', displayName: 'Owned', status: 'active', createdAt: stamp}});
    await repository.saveContentRelease({...ids, contentReleaseId: 'old-release', importJobId: 'old-job', releaseLabel: 'Old real content', status: 'active', createdAt: stamp, activatedAt: stamp, runtimeSnapshot: {bookletEntries: []}});
    await repository.getOrCreateOriginalParticipantGroup({...ids, groupKey: 'OLD', groupLabel: 'First label Ω', createdAt: stamp});
    await repository.bindOriginalLoginGroup({...ids, loginKey: 'old-native', groupKey: 'OLD', groupSnapshotKey: 'OLD', authenticatedAt: stamp});
    const canonical = {...ids, participantSessionId: 'canonical', contentReleaseId: 'old-release', loginKey: 'canonical', groupKey: 'OLD', status: 'signed_in', createdAt: stamp};
    const native = {...canonical, participantSessionId: 'native', loginKey: 'old-native', originalLoginKey: 'old-native', participantCode: 'First Ä', validUntil: null};
    await repository.saveParticipantSession(canonical); await repository.saveParticipantSession(native);
    const run = {...ids, testRunId: 'old-test', participantSessionId: 'native', contentReleaseId: 'old-release', bookletKey: 'old-booklet', status: 'paused', currentUnitKey: 'unit',
      unitResponses: {unit: 'Exact legacy response Ä/β\n\u0000  spaces'}, unitResponseFieldTimestamps: {unit: {opaque: 12345}},
      testletTimers: {}, createdAt: stamp, updatedAt: stamp, completedAt: null};
    await repository.saveTestRun(run);
    await repository.saveParticipantAccessCredential({participantSessionId: 'native', tokenHash: 'a'.repeat(64), updatedAt: stamp});
    await repository.saveParticipantAccessCredential({participantSessionId: 'canonical', tokenHash: null, updatedAt: stamp});
    const before = {canonical: await repository.getParticipantSessionById('canonical'), native: await repository.getParticipantSessionById('native'),
      run: await repository.getTestRunById('old-test'), active: await repository.getParticipantAccessCredential('native'), revoked: await repository.getParticipantAccessCredential('canonical')};
    await close();
    control = kind === 'sqlite' ? new DatabaseSync(file) : new Pool({connectionString: url.toString()});
    await exec(`CREATE INDEX owned_person_index ON participant_sessions(login_key);
      CREATE TABLE owned_person_audit (person_id TEXT);
      CREATE VIEW owned_person_view AS SELECT participant_session_id,content_release_id FROM participant_sessions;`);
    await exec(kind === 'sqlite'
      ? 'CREATE TRIGGER owned_person_trigger AFTER UPDATE OF status ON participant_sessions BEGIN INSERT INTO owned_person_audit VALUES (NEW.participant_session_id); END'
      : `CREATE FUNCTION owned_person_trigger() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN INSERT INTO owned_person_audit VALUES (NEW.participant_session_id); RETURN NEW; END $$;
         CREATE TRIGGER owned_person_trigger AFTER UPDATE OF status ON participant_sessions FOR EACH ROW EXECUTE FUNCTION owned_person_trigger()`);
    await exec('ALTER TABLE operational_login_migration_candidates DROP COLUMN native_logins_json; DROP TABLE IF EXISTS original_native_units; DROP TABLE original_workspace_numbers; DROP TABLE original_workspace_number_counter; ALTER TABLE test_runs DROP COLUMN original_test_state_json; DROP TABLE original_test_numbers; DROP TABLE original_test_number_counter; ALTER TABLE test_runs DROP COLUMN response_part_types_json');
    if (kind === 'sqlite') {
      // Reconstruct the old NOT NULL metadata only in this owned fixture.
      // Production uses a transactional table rebuild, never catalog editing.
      const table = control.prepare("SELECT sql FROM sqlite_schema WHERE name='participant_sessions' AND type='table'").get().sql;
      const old = table.replace(' CHECK (content_release_id IS NOT NULL OR (original_login_key IS NOT NULL AND length(original_login_key) > 0))', '')
        .replace(/\bcontent_release_id\s+TEXT\b/i, 'content_release_id TEXT NOT NULL');
      const revision = Number(control.prepare('PRAGMA schema_version').get().schema_version);
      control.exec('BEGIN; PRAGMA writable_schema=ON;');
      control.prepare("UPDATE sqlite_schema SET sql=? WHERE name='participant_sessions' AND type='table'").run(old);
      control.exec(`DELETE FROM schema_migrations WHERE version>=${version}; PRAGMA schema_version=${revision + 1}; PRAGMA writable_schema=OFF; COMMIT;`);
      control.close(); control = new DatabaseSync(file);
    } else await exec(`ALTER TABLE participant_sessions DROP CONSTRAINT participant_sessions_original_content;
      ALTER TABLE participant_sessions ALTER COLUMN content_release_id SET NOT NULL; DELETE FROM schema_migrations WHERE version>=${version}`);
    const isNullable = async () => kind === 'sqlite' ? Number((await rows('PRAGMA table_info(participant_sessions)')).find(row => row.name === 'content_release_id').notnull) === 0
      : (await rows("SELECT is_nullable FROM information_schema.columns WHERE table_schema=current_schema() AND table_name='participant_sessions' AND column_name='content_release_id'"))[0].is_nullable === 'YES';
    assert.equal(await isNullable(), false);
    const unchanged = async () => {
      assert.equal(Number((await rows('SELECT COUNT(*) AS count FROM participant_access_credentials'))[0].count), 2);
      const records = await rows('SELECT participant_session_id,token_hash,updated_at FROM participant_access_credentials ORDER BY participant_session_id');
      assert.deepEqual(records, [{participant_session_id: 'canonical', token_hash: null, updated_at: stamp}, {participant_session_id: 'native', token_hash: 'a'.repeat(64), updated_at: stamp}]);
      assert.equal(Number((await rows('SELECT COUNT(*) AS count FROM owned_person_audit'))[0].count), 0);
      assert.deepEqual(await rows('SELECT participant_session_id,content_release_id FROM owned_person_view ORDER BY participant_session_id'),
        [{participant_session_id: 'canonical', content_release_id: 'old-release'}, {participant_session_id: 'native', content_release_id: 'old-release'}]);
    };
    await t.test('automatic rollback retains NOT NULL, credentials including tombstones, views and original data after a late metadata failure', async () => {
      await exec(kind === 'sqlite'
        ? `CREATE TRIGGER owned_person_migration_failure BEFORE INSERT ON schema_migrations WHEN NEW.version=${version} BEGIN SELECT RAISE(ROLLBACK,'owned person content migration failure'); END`
        : `CREATE FUNCTION owned_person_migration_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned person content migration failure'; END $$;
           CREATE TRIGGER owned_person_migration_failure BEFORE INSERT ON schema_migrations FOR EACH ROW WHEN (NEW.version=${version}) EXECUTE FUNCTION owned_person_migration_failure()`);
      await assert.rejects(migrate(), /owned person content migration failure/);
      assert.equal(await isNullable(), false); await unchanged();
      assert.equal(Number((await rows('SELECT MAX(version) AS version FROM schema_migrations'))[0].version), version - 1);
      if (kind === 'sqlite') assert.deepEqual(await rows("SELECT name FROM sqlite_schema WHERE name='__rewrite_native_person_release'"), []);
      await exec(kind === 'sqlite' ? 'DROP TRIGGER owned_person_migration_failure'
        : 'DROP TRIGGER owned_person_migration_failure ON schema_migrations; DROP FUNCTION owned_person_migration_failure()');
    });
    await t.test('successful upgrade preserves exact known/unknown parent metadata, Test payload/clocks, credentials and schema behavior', async () => {
      await open(); assert.equal(await isNullable(), true); await unchanged();
      assert.deepEqual(await repository.getParticipantSessionById('canonical'), before.canonical);
      assert.deepEqual(await repository.getParticipantSessionById('native'), before.native);
      assert.equal((await repository.getParticipantSessionById('native')).originalNameSuffix, undefined);
      assert.deepEqual(await repository.getTestRunById('old-test'), before.run);
      assert.deepEqual(await repository.getParticipantAccessCredential('native'), before.active);
      assert.deepEqual(await repository.getParticipantAccessCredential('canonical'), before.revoked);
      await assert.rejects(repository.saveParticipantAccessCredential({participantSessionId: 'missing-parent', tokenHash: 'b'.repeat(64), updatedAt: stamp}), /foreign key/i);
      await assert.rejects(Promise.resolve().then(() => exec("UPDATE participant_sessions SET content_release_id=NULL WHERE participant_session_id='canonical'")), /check constraint/i);
      await exec("UPDATE participant_sessions SET status=status WHERE participant_session_id='canonical'");
      assert.equal(Number((await rows('SELECT COUNT(*) AS count FROM owned_person_audit'))[0].count), 1);
      assert.equal(Number((await rows(kind === 'sqlite' ? "SELECT COUNT(*) AS count FROM sqlite_schema WHERE type='index' AND name='owned_person_index'"
        : "SELECT COUNT(*) AS count FROM pg_indexes WHERE schemaname=current_schema() AND indexname='owned_person_index'"))[0].count), 1);
    });
  } finally {
    await close(); if (control) { if (kind === 'sqlite') control.close(); else await control.end(); }
    if (created) { assert.equal(Number((await admin.query('SELECT COUNT(*) AS count FROM pg_stat_activity WHERE application_name=$1', [schema])).rows[0].count), 0); await admin.query(`DROP SCHEMA "${schema}" CASCADE`); }
    await admin?.end(); await rm(directory, {recursive: true, force: true});
  }
});
