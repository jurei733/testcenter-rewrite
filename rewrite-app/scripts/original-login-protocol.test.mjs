import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {mkdtemp, readFile, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {Pool} from 'pg';
import {createFirstSliceServices, hashOriginalSessionToken, OriginalSessionTokenCollisionError} from '@testcenter-rewrite-app/application';
import {compileBookletRuntimePolicy} from '@testcenter-rewrite-app/contracts';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceStorage} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceStorage, migrateSqliteFirstSliceStorage} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage, migratePostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';
import {prepareOriginalXmlSchemaValidator} from '../packages/application/dist/packages/application/src/original-xml-schema.js';

const evidence = new URL('../test-fixtures/original-testcenter/source-workspace-results/native-login-protocol/', import.meta.url);
const manifest = JSON.parse(await readFile(new URL('manifest.json', evidence), 'utf8'));
for (const [file, hash] of Object.entries(manifest.files)) {
  assert.match(file, /^[a-z0-9][a-z0-9.-]*$/);
  assert.equal(createHash('sha256').update(await readFile(new URL(file, evidence))).digest('hex'), hash);
}
const source = JSON.parse(await readFile(new URL('receipt.json', evidence), 'utf8'));
assert.equal(manifest.runId, 40063392830); assert.equal(source.success, true); assert.equal(source.testMode, false);
assert.equal(source.checks.length, 21);
const observed = name => assert.ok(source.checks.some(row => row.name === name));
observed('coded credential phase returns a Login AccessSet without person or Test claims');
observed('existing native Login token uses current code assignments after password replacement without replaying a password');
observed('removing one exact native Login disables its two token types with 410 and retains every case or composition peer');
observed('restoring the same exact native Login makes its retained Login and active person tokens readable again');
const names = source.checks.filter(row => row.name.startsWith('exact native Login identity is isolated for ')).map(row => row.loginName);
assert.equal(names.length, 6);
const xmlValidator = await prepareOriginalXmlSchemaValidator(resolve(process.env.FIRST_SLICE_XML_SCHEMA_CACHE || '.data/original-xml-schemas'), process.env.FIRST_SLICE_XML_SCHEMA_DOWNLOAD !== 'false');
const kinds = ['memory', 'file', 'sqlite'];
if (process.env.FIRST_SLICE_STORE === 'postgres') { assert.ok(process.env.FIRST_SLICE_POSTGRES_URL); kinds.push('postgres'); }
const fails = (status, code) => error => error.statusCode === status && (!code || error.errorCode === code);

for (const kind of kinds) test(`${kind}: real native Login and person phases use durable private capabilities`, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'owned-native-login-'));
  const file = join(directory, kind === 'file' ? 'state.json' : 'state.sqlite');
  const schema = 'owned_login_' + randomUUID().replaceAll('-', '');
  const url = kind === 'postgres' ? new URL(process.env.FIRST_SLICE_POSTGRES_URL) : null;
  url?.searchParams.set('options', '-c search_path=' + schema);
  url?.searchParams.set('application_name', schema);
  let storage, repository, services, pool, created = false;
  const open = async () => {
    storage = kind === 'memory' ? storage ?? {repository: createInMemoryFirstSliceRepository(), shutdown: async () => {}}
      : kind === 'file' ? await createFileFirstSliceStorage(file)
      : kind === 'sqlite' ? createSqliteFirstSliceStorage(file) : await createPostgresFirstSliceStorage(url.toString());
    repository = storage.repository;
    services = createFirstSliceServices({repository, originalXmlSchemaValidator: xmlValidator});
  };
  const close = async () => { const owned = storage; if (kind !== 'memory') storage = undefined; await owned?.shutdown(); };
  try {
    if (url) { pool = new Pool({connectionString: process.env.FIRST_SLICE_POSTGRES_URL}); await pool.query(`CREATE SCHEMA "${schema}"`); created = true; }
    await open();
    const tenant = await services.platform.createTenant({tenantKey: 'owned-' + randomUUID(), displayName: 'Owned native login'});
    const workspace = await services.platform.createWorkspace({tenantKey: tenant.tenantKey, workspaceKey: 'owned', displayName: 'Owned native login'});
    const scope = {tenantKey: tenant.tenantKey, workspaceKey: workspace.workspaceKey};
    const ids = {tenantId: tenant.tenantId, workspaceId: workspace.workspaceId};
    let selected = [...names], password = 'Owned-native-secret', code = 'Shared', group = 'ORACLE.NATIVE.LOGIN';
    const document = () => `<Testtakers xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/testcenter-testtaker-xml/18.0"><Metadata/><Group id="${group}" label="Owned native login Ω">${selected.map(name => `<Login name="${name}" pw="${password}" mode="run-hot-return"><Booklet codes="${code}">owned</Booklet></Login>`).join('')}<Login name="plain" pw="Owned-native-secret" mode="run-hot-return"><Booklet>owned</Booklet></Login><Login name="zero" pw="Owned-native-secret" mode="run-hot-return"><Booklet codes="0">owned</Booklet></Login><Login name="empty" pw="" mode="run-hot-return"><Booklet>owned</Booklet></Login></Group></Testtakers>`;
    const upload = () => services.workspaceAdminRead.importParticipantRoster({...scope, rosterText: document()});
    const login = (name = names[0], supplied = password) => services.originalAuthentication.login({name, password: supplied});
    const person = (token, requested = code) => services.originalAuthentication.person({loginToken: token, code: requested});
    const read = token => services.originalAuthentication.read({token});
    let first, entered, run, lastPerson, firstBinding;
    await upload();
    if (kind === 'file') await t.test('a pre-capability File manifest retains its roster and workspace when the private collection is absent', async () => {
      const roster = await repository.listParticipantRosterEntriesByWorkspace(ids.tenantId, ids.workspaceId);
      await close();
      const legacy = JSON.parse(await readFile(file, 'utf8')); delete legacy.originalSessionTokens;
      await writeFile(file, JSON.stringify(legacy));
      await open();
      const persisted = value => JSON.parse(JSON.stringify(value));
      assert.deepEqual(persisted(await repository.listParticipantRosterEntriesByWorkspace(ids.tenantId, ids.workspaceId)), persisted(roster));
      assert.equal((await repository.getWorkspaceByScope(scope.tenantKey, scope.workspaceKey)).workspaceId, ids.workspaceId);
    });
    await t.test('first factor needs no active release, creates no person and resets successful credential attempts', async () => {
      await assert.rejects(login(names[0], 'wrong'), error => error.errorCode === 'participant_password_invalid');
      first = await login(); assert.equal(first.kind, 'login'); assert.equal(first.codeRequired, true);
      assert.match(first.token, /^[a-z0-9_-]{24}$/); assert.match(first.groupToken, /^[a-z0-9_-]{24}$/); assert.notEqual(first.token, first.groupToken);
      assert.deepEqual(await repository.listParticipantSessionsByWorkspace(...Object.values(ids)), []);
      assert.equal(await repository.getParticipantLoginAttempt(ids.tenantId, ids.workspaceId, names[0]), null);
      assert.equal((await read(first.token)).token, first.token);
      firstBinding = (await repository.listOriginalLoginBindingsByWorkspace(ids.tenantId, ids.workspaceId)).find(row => row.loginKey === names[0]);
      assert.ok(firstBinding);
    });
    const release = randomUUID(), now = new Date().toISOString();
    await repository.saveContentRelease({...ids, contentReleaseId: release, importJobId: release, releaseLabel: 'Owned native login', status: 'active', createdAt: now, activatedAt: now,
      runtimeSnapshot: {bookletEntries: [{bookletKey: 'owned', displayLabel: 'Owned', policy: compileBookletRuntimePolicy({}), testletEntries: [], unitEntries: []}]}});
    await t.test('stable first-factor tokens survive concurrent credential entry and durable reopening', async () => {
      const replies = await Promise.all(Array.from({length: 6}, () => login()));
      assert.ok(replies.every(row => row.kind === 'login' && row.token === first.token && row.groupToken === first.groupToken));
      await close(); await open();
      assert.equal((await login()).token, first.token); assert.equal((await read(first.token)).groupToken, first.groupToken);
    });
    await t.test('independent clients share the registered File writer or separate SQL connections and allocate one first-factor capability', async () => {
      if (kind === 'file') await assert.rejects(createFileFirstSliceStorage(file), error => error.code === 'FILE_STORE_BUSY');
      const other = kind === 'memory' || kind === 'file' ? storage
        : kind === 'sqlite' ? createSqliteFirstSliceStorage(file) : await createPostgresFirstSliceStorage(url.toString());
      try {
        const otherServices = createFirstSliceServices({repository: other.repository, originalXmlSchemaValidator: xmlValidator});
        const replies = await Promise.all(Array.from({length: 8}, (_, index) =>
          (index % 2 ? otherServices : services).originalAuthentication.login({name: names[1], password})));
        assert.ok(replies.every(reply => reply.kind === 'login' && reply.token === replies[0].token && reply.groupToken === first.groupToken));
        assert.notEqual(replies[0].token, first.token);
      } finally { if (other !== storage) await other.shutdown(); }
    });
    await t.test('a real person step does not read a password or rebind the group; codes retain raw spelling', async () => {
      const restricted = new Proxy(repository, {get(target, key) {
        if (['getParticipantRosterPasswordHash', 'bindOriginalLoginGroup', 'resetParticipantLoginAttempts'].includes(key)) return () => { throw Error('Person phase replayed first-factor work'); };
        const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
      }});
      const native = createFirstSliceServices({repository: restricted, originalXmlSchemaValidator: xmlValidator}).originalAuthentication;
      await assert.rejects(native.person({loginToken: first.token, code: ' Shared'}), error => error.errorCode === 'participant_code_invalid');
      entered = await native.person({loginToken: first.token, code: 'sHaReD'});
      assert.equal(entered.kind, 'person'); assert.match(entered.token, /^[a-z0-9_-]{24}$/);
      assert.equal(entered.participantSession.participantCode, 'sHaReD'); assert.equal(entered.requestedCode, 'sHaReD');
      const again = await native.person({loginToken: first.token, code: 'SHARED'});
      assert.equal(again.participantSession.participantSessionId, entered.participantSession.participantSessionId);
      assert.equal(again.participantSession.participantCode, 'sHaReD'); assert.equal(again.requestedCode, 'SHARED');
      assert.equal((await read(again.token)).requestedCode, 'sHaReD');
      await assert.rejects(read(entered.token), fails(401)); entered = again;
      run = await services.participantRuntime.launch({participantSessionId: entered.participantSession.participantSessionId, bookletKey: 'owned'});
      lastPerson = entered;
    });
    await t.test('Login/group/person capabilities are distinct and group metadata is never promoted into a person bearer', async () => {
      await assert.rejects(person(first.groupToken), fails(403)); await assert.rejects(person(entered.token), fails(403));
      await assert.rejects(read(first.groupToken), fails(403));
      await assert.rejects(services.participantAccess.authorize({participantSessionId: entered.participantSession.participantSessionId, sessionToken: first.token}), fails(401));
      await assert.rejects(services.participantAccess.authorize({participantSessionId: entered.participantSession.participantSessionId, sessionToken: first.groupToken}), fails(401));
      const roster = JSON.stringify(await repository.listParticipantRosterEntriesByWorkspace(ids.tenantId, ids.workspaceId));
      assert.ok(!roster.includes(first.token) && !roster.includes(first.groupToken) && !roster.includes(entered.token));
    });
    await t.test('the exact six Source name peers authenticate independently; unknown aliases do not resolve', async () => {
      await assert.rejects(login('OwNeD-native-binary-login'), fails(401));
      await assert.rejects(login(' ' + names[0]), fails(401));
      const peers = [];
      for (const name of names.slice(1)) { const phase = await login(name); const state = await person(phase.token, 'sHaReD'); peers.push(state); }
      assert.equal(new Set([entered, ...peers].map(row => row.participantSession.participantSessionId)).size, 6);
      for (const peer of peers) await assert.rejects(services.participantAccess.authorize({participantSessionId: entered.participantSession.participantSessionId, sessionToken: peer.token}), fails(401));
    });
    await t.test('an existing Login token uses replacement assignments after password import without replay', async () => {
      password = 'Owned-native-replacement'; code = 'replacement'; await upload();
      await assert.rejects(login(names[0], 'Owned-native-secret'), error => error.errorCode === 'participant_password_invalid');
      await assert.rejects(person(first.token, 'Shared'), error => error.errorCode === 'participant_code_invalid');
      lastPerson = await person(first.token, 'replacement'); assert.equal(lastPerson.kind, 'person');
      assert.equal((await login()).token, first.token); assert.equal((await read(first.token)).token, first.token);
      assert.equal((await read(entered.token)).participantSession.participantSessionId, entered.participantSession.participantSessionId);
    });
    await t.test('Login logout is a no-op; person logout revokes only that bearer and retains people and Tests', async () => {
      await services.originalAuthentication.logout({token: first.token}); assert.equal((await read(first.token)).token, first.token);
      await services.originalAuthentication.logout({token: entered.token}); await assert.rejects(read(entered.token), fails(401));
      assert.equal((await repository.getTestRunById(run.testRunId)).testRunId, run.testRunId);
      const next = await person(first.token, 'replacement'); assert.equal(next.participantSession.participantSessionId, lastPerson.participantSession.participantSessionId);
      assert.notEqual(next.token, lastPerson.token); lastPerson = next;
    });
    await t.test('a removed native definition denies both tokens even with a same-name canonical row; native restoration revives them', async () => {
      const row = (await repository.listParticipantRosterEntriesByWorkspace(ids.tenantId, ids.workspaceId)).find(entry => entry.loginKey === names[0]);
      const passwordHash = await repository.getParticipantRosterPasswordHash(ids.tenantId, ids.workspaceId, names[0]);
      // Exercise the real persisted native boundary without pretending the
      // existing canonical upsert importer performs whole-file replacement.
      await repository.saveParticipantRosterEntry({...row, originalLoginIdentity: undefined}, passwordHash);
      await assert.rejects(read(first.token), fails(410)); await assert.rejects(read(lastPerson.token), fails(410));
      await assert.rejects(services.participantAccess.authorize({participantSessionId: lastPerson.participantSession.participantSessionId, sessionToken: lastPerson.token}), fails(410));
      const peer = await login(names[1]); assert.equal(peer.kind, 'login');
      await upload();
      assert.equal((await read(first.token)).token, first.token);
      assert.equal((await read(lastPerson.token)).participantSession.participantSessionId, lastPerson.participantSession.participantSessionId);
    });
    await t.test('imported group moves stay credential-stage effects while Login capability identity remains stable', async () => {
      const before = (await repository.listOriginalLoginBindingsByWorkspace(ids.tenantId, ids.workspaceId)).find(row => row.loginKey === names[0]);
      group = 'ORACLE.NATIVE.MOVED'; await upload();
      assert.equal((await read(first.token)).groupToken, first.groupToken);
      const during = await person(first.token, 'replacement'); assert.equal(during.participantSession.groupKey, before.groupKey);
      const renewed = await login(); assert.equal(renewed.token, first.token); assert.notEqual(renewed.groupToken, first.groupToken);
      assert.equal((await read(during.token)).groupToken, renewed.groupToken);
      assert.equal((await repository.getParticipantSessionById(during.participantSession.participantSessionId)).groupKey, group);
      lastPerson = during;
    });
    await t.test('uncoded and PHP-falsy zero logins directly return persons; empty passwords are checked exactly', async () => {
      for (const name of ['plain', 'zero']) { const state = await login(name, 'Owned-native-secret'); assert.equal(state.kind, 'person'); assert.equal(state.participantSession.participantCode, null); }
      await assert.rejects(login('empty', 'not-empty'), error => error.errorCode === 'participant_password_invalid');
      const empty = await login('empty', ''); assert.equal(empty.kind, 'person');
    });
    await t.test('private capability writers retain the first value and reject cross-subject collisions without leakage', async () => {
      const candidate = {...ids, kind: 'login', subjectKey: names[0], token: 'a'.repeat(24), createdAt: new Date().toISOString()};
      const stable = await repository.getOrCreateOriginalSessionToken(candidate); assert.equal(stable.token, first.token);
      stable.token = 'b'.repeat(24); assert.equal((await repository.findOriginalSessionTokenByHash(hashOriginalSessionToken(first.token))).token, first.token);
      const binding = (await repository.listOriginalLoginBindingsByWorkspace(ids.tenantId, ids.workspaceId)).find(row => row.loginKey === names[0]);
      const groupState = await repository.getOrCreateOriginalParticipantGroup({...ids, groupKey: 'owned-collision', groupLabel: 'Owned', createdAt: new Date().toISOString()});
      await assert.rejects(repository.getOrCreateOriginalSessionToken({...candidate, kind: 'group', subjectKey: groupState.groupKey, token: first.token}), OriginalSessionTokenCollisionError);
      const submitted = {...candidate, kind: 'group', subjectKey: groupState.groupKey, token: 'x'.repeat(24)};
      const expected = structuredClone(submitted);
      const pending = repository.getOrCreateOriginalSessionToken(submitted);
      submitted.subjectKey = 'missing'; submitted.token = 'b'.repeat(24);
      assert.deepEqual(await pending, expected, 'Async writers capture validated private scope/token values before yielding');
      assert.equal(await repository.getOrCreateOriginalSessionToken({...candidate, subjectKey: 'missing'}), null);
      assert.equal(await repository.findOriginalSessionTokenByHash('invalid'), null);
      assert.equal(binding.loginKey, names[0]);
    });
    await t.test('both native capabilities and person digest lookup survive a final store restart', async () => {
      await close(); await open();
      assert.equal((await read(first.token)).token, first.token);
      assert.equal((await read(lastPerson.token)).participantSession.participantSessionId, lastPerson.participantSession.participantSessionId);
      assert.ok(await repository.getTestRunById(run.testRunId));
    });
    if (kind === 'sqlite' || kind === 'postgres') await t.test('private-token migration failure rolls back the table and digest index; legacy people, Tests and credentials stay exact', async () => {
      const savedPerson = await repository.getParticipantSessionById(lastPerson.participantSession.participantSessionId);
      const savedRun = await repository.getTestRunById(run.testRunId);
      const savedCredential = await repository.getParticipantAccessCredential(savedPerson.participantSessionId);
      await close();
      const control = kind === 'sqlite' ? new DatabaseSync(file) : new Pool({connectionString: url.toString()});
      const execute = sql => kind === 'sqlite' ? control.exec(sql) : control.query(sql);
      const value = async sql => kind === 'sqlite' ? control.prepare(sql).get().value : (await control.query(sql)).rows[0].value;
      const version = kind === 'sqlite' ? 70 : 64;
      const migrate = () => kind === 'sqlite' ? migrateSqliteFirstSliceStorage(file) : migratePostgresFirstSliceStorage(url.toString());
      try {
        await execute(`DROP TABLE original_session_tokens; DROP INDEX participant_access_credentials_token_hash; DELETE FROM schema_migrations WHERE version>=${version}`);
        await execute(kind === 'sqlite'
          ? `CREATE TRIGGER owned_token_migration_failure BEFORE INSERT ON schema_migrations WHEN NEW.version=${version} BEGIN SELECT RAISE(ABORT,'owned token migration failure'); END`
          : `CREATE FUNCTION owned_token_migration_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned token migration failure'; END $$; CREATE TRIGGER owned_token_migration_failure BEFORE INSERT ON schema_migrations FOR EACH ROW WHEN (NEW.version=${version}) EXECUTE FUNCTION owned_token_migration_failure()`);
        await assert.rejects(migrate(), /owned token migration failure/);
        assert.equal(Number(await value('SELECT MAX(version) AS value FROM schema_migrations')), version - 1);
        assert.equal(Number(await value(kind === 'sqlite'
          ? "SELECT COUNT(*) AS value FROM sqlite_master WHERE name IN ('original_session_tokens','participant_access_credentials_token_hash')"
          : "SELECT COUNT(*) AS value FROM pg_class WHERE relnamespace=current_schema()::regnamespace AND relname IN ('original_session_tokens','participant_access_credentials_token_hash')")), 0);
        await execute(kind === 'sqlite' ? 'DROP TRIGGER owned_token_migration_failure'
          : 'DROP TRIGGER owned_token_migration_failure ON schema_migrations; DROP FUNCTION owned_token_migration_failure()');
      } finally { if (kind === 'sqlite') control.close(); else await control.end(); }
      await open();
      assert.deepEqual(await repository.getParticipantSessionById(savedPerson.participantSessionId), savedPerson);
      assert.deepEqual(await repository.getTestRunById(run.testRunId), savedRun);
      assert.deepEqual(await repository.getParticipantAccessCredential(savedPerson.participantSessionId), savedCredential);
      assert.equal((await read(lastPerson.token)).participantSession.participantSessionId, savedPerson.participantSessionId);
    });
  } finally {
    await close();
    if (created) { assert.equal(Number((await pool.query('SELECT COUNT(*) AS count FROM pg_stat_activity WHERE application_name=$1', [schema])).rows[0].count), 0); await pool.query(`DROP SCHEMA "${schema}" CASCADE`); }
    await pool?.end(); await rm(directory, {recursive: true, force: true});
  }
});
