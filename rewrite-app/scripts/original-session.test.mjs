import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import test from 'node:test';
import {Pool, types as pgTypes} from 'pg';
import {createFirstSliceServices} from '@testcenter-rewrite-app/application';
import {compileBookletRuntimePolicy} from '@testcenter-rewrite-app/contracts';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceStorage} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceStorage} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';
import {prepareOriginalXmlSchemaValidator} from '../packages/application/dist/packages/application/src/original-xml-schema.js';
import {OriginalSessionProof} from '../apps/api/dist/apps/api/src/original-session-proof.js';
import {createProductionApiServer} from '../apps/api/dist/apps/api/src/index.js';

const fixtureRoot = new URL('../test-fixtures/original-testcenter/source-workspace-results/', import.meta.url);
const source = JSON.parse(await readFile(new URL('native-login-protocol/http-observations.json', fixtureRoot), 'utf8'));
for (const folder of ['native-login-protocol', 'native-pow-protocol']) {
  const manifest = JSON.parse(await readFile(new URL(folder + '/manifest.json', fixtureRoot), 'utf8'));
  assert.equal(manifest.testMode, false); assert.equal(manifest.sourceCommit, 'eedae41840cbe90e5547c0211da818bdf620f5aa');
  for (const [file, sha] of Object.entries(manifest.files)) {
    assert.match(file, /^[a-z0-9][a-z0-9.-]*$/);
    assert.equal(createHash('sha256').update(await readFile(new URL(folder + '/' + file, fixtureRoot))).digest('hex'), sha);
  }
}
const sourceLogin = source.find(row => row.path === '/session/login' && row.status === 200).value;
const sourcePerson = source.find(row => row.path === '/session/person' && row.status === 200).value;
const validator = await prepareOriginalXmlSchemaValidator(resolve(process.env.FIRST_SLICE_XML_SCHEMA_CACHE || '.data/original-xml-schemas'), process.env.FIRST_SLICE_XML_SCHEMA_DOWNLOAD !== 'false');
const name = 'owned-native-binary-login', password = 'OWNED_PRIVATE_HTTP_PASSWORD_2026';
const secret = 'OWNED_NATIVE_WORK_CURRENT_SECRET_2026_123456789', nextSecret = 'OWNED_NATIVE_WORK_ROTATED_SECRET_2026_987654321';
const config = {enabledScopes: ['participant', 'second_code'], maxNumber: 12, ttlMs: 60_000, currentSecret: secret, previousSecret: null};
const xml = (type, repo, body) => `<${type} xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/${repo}/18.0">${body}</${type}>`;
const roster = (mode = 'run-hot-return', code = 'Shared') => xml('Testtakers', 'testcenter-testtaker-xml', `<Metadata/><Group id="ORACLE.NATIVE.LOGIN" label="Owned native login Ω"><Login name="${name}" pw="${password}" mode="${mode}"><Booklet codes="${code}">ORACLE.BOOK.A</Booklet></Login><Login name="owned-peer" pw="${password}" mode="run-hot-return"><Booklet codes="Shared">ORACLE.BOOK.A</Booklet></Login></Group>`);
const booklet = label => xml('Booklet', 'testcenter-booklet-xml', `<Metadata><Id>ORACLE.BOOK.A</Id><Label>${label}</Label></Metadata><Units><Unit id="ORACLE.UNIT" label="Owned unit"/></Units>`);
const solve = challenge => {
  for (let number = 0; number <= challenge.maxNumber; number++) if (createHash('sha256').update(challenge.salt + number).digest('hex') === challenge.challenge)
    return {algorithm: challenge.algorithm, challenge: challenge.challenge, salt: challenge.salt, signature: challenge.signature, number};
  assert.fail('The actual native challenge must be solvable by the unchanged five-field client algorithm');
};
const uploadDependencies = async (services, scope) => {
  const metadata = {id: 'owned-session-player', version: '6.0.4', specVersion: '6.0', metadataVersion: '2.0', type: 'player',
    name: [{lang: 'de', value: 'Owned native session Player'}], description: [{lang: 'de', value: 'Owned fixture'}]};
  await services.contentIntake.uploadWorkspaceFile({...scope, fileName: 'player.html', mediaType: 'text/html',
    sourceDocument: '<html><script type="application/ld+json">' + JSON.stringify(metadata) + '</script><main>Owned Player</main></html>'});
  await services.contentIntake.uploadWorkspaceFile({...scope, fileName: 'unit.xml', mediaType: 'application/xml',
    sourceDocument: '<Unit xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/unit-xml/17.6"><Metadata><Id>ORACLE.UNIT</Id><Label>Owned unit</Label></Metadata><Definition player="owned-session-player@6.0.4">Owned definition</Definition></Unit>'});
};
const error = code => value => value.errorCode === code;
const sameAccessSet = (actual, expected) => {
  assert.deepEqual(actual, {...expected, token: actual.token, groupToken: actual.groupToken});
  assert.match(actual.token, /^[a-z0-9_-]{24}$/); assert.match(actual.groupToken, /^[a-z0-9_-]{24}$/);
  for (const key of ['participantSession', 'participantSessionId', 'contentReleaseId', 'tenantId', 'workspaceId', 'kind', 'requestedCode']) assert.equal(Object.hasOwn(actual, key), false);
};

const kinds = ['memory', 'file', 'sqlite'];
if (process.env.FIRST_SLICE_STORE === 'postgres') { assert.ok(process.env.FIRST_SLICE_POSTGRES_URL); kinds.push('postgres'); }
for (const kind of kinds) test(`${kind}: native AccessSets and sealed ALTCHA preserve Source session boundaries`, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'owned-native-session-')), file = join(directory, kind === 'file' ? 'state.json' : 'state.sqlite');
  const schema = 'owned_session_' + randomUUID().replaceAll('-', ''), url = kind === 'postgres' ? new URL(process.env.FIRST_SLICE_POSTGRES_URL) : null;
  url?.searchParams.set('options', '-c search_path=' + schema); url?.searchParams.set('application_name', schema);
  let storage, repository, services, admin, created = false, ids, scope, login, person, opened, retiredReleases;
  const open = async () => {
    storage = kind === 'memory' ? storage ?? {repository: createInMemoryFirstSliceRepository(), shutdown: async () => {}}
      : kind === 'file' ? await createFileFirstSliceStorage(file) : kind === 'sqlite' ? createSqliteFirstSliceStorage(file) : await createPostgresFirstSliceStorage(url.toString());
    repository = storage.repository; services = createFirstSliceServices({repository, originalXmlSchemaValidator: validator});
  };
  const close = async () => { const owned = storage; if (kind !== 'memory') storage = undefined; await owned?.shutdown(); };
  try {
    if (url) { admin = new Pool({connectionString: process.env.FIRST_SLICE_POSTGRES_URL}); await admin.query(`CREATE SCHEMA "${schema}"`); created = true; }
    await open();
    const tenant = await services.platform.createTenant({tenantKey: 'owned-' + randomUUID(), displayName: 'Owned native session'});
    const workspace = await services.platform.createWorkspace({tenantKey: tenant.tenantKey, workspaceKey: 'owned', displayName: 'Owned native session'});
    ids = {tenantId: tenant.tenantId, workspaceId: workspace.workspaceId}; scope = {tenantKey: tenant.tenantKey, workspaceKey: workspace.workspaceKey};
    const uploadBooklet = label => services.contentIntake.uploadWorkspaceFile({...scope, fileName: 'booklet.xml', sourceDocument: booklet(label), mediaType: 'application/xml'});
    const uploadRoster = (mode, code) => services.workspaceAdminRead.importParticipantRoster({...scope, rosterText: roster(mode, code)});
    await uploadDependencies(services, scope); await uploadBooklet('Owned booklet'); await uploadRoster();
    for (const release of await repository.listContentReleasesByWorkspace(...Object.values(ids))) await repository.saveContentRelease({...release, status: 'retired'});
    retiredReleases = await repository.listContentReleasesByWorkspace(...Object.values(ids));
    assert.ok(retiredReleases.length && retiredReleases.every(row => row.status !== 'active'));

    await t.test('coded Login AccessSet matches the real production Source without person/Test creation or active content', async () => {
      login = await services.originalSession.login({name, password}); sameAccessSet(login, sourceLogin);
      assert.deepEqual(await services.originalSession.read({token: login.token}), login);
      assert.deepEqual(await repository.listParticipantSessionsByWorkspace(...Object.values(ids)), []);
      assert.deepEqual(await repository.listContentReleasesByWorkspace(...Object.values(ids)), retiredReleases);
    });
    await t.test('person AccessSet matches real Source claims from physical Booklet metadata before a Test and without active content', async () => {
      const forbidden = new Proxy(repository, {get(target, key) {
        if (['getParticipantRosterPasswordHash', 'bindOriginalLoginGroup', 'resetParticipantLoginAttempts'].includes(key)) return () => assert.fail('Person phase must not replay first-factor work');
        const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
      }});
      person = await createFirstSliceServices({repository: forbidden, originalXmlSchemaValidator: validator}).originalSession.person({loginToken: login.token, code: 'sHaReD'});
      sameAccessSet(person, sourcePerson);
      const parent = await repository.findParticipantSessionByAccessTokenHash(createHash('sha256').update(person.token).digest('hex'));
      assert.equal(parent.contentReleaseId, null); assert.deepEqual(await repository.listTestRunsByParticipantSessionId(parent.participantSessionId), []);
      assert.deepEqual(await repository.listContentReleasesByWorkspace(...Object.values(ids)), retiredReleases);
    });
    await t.test('immediate code spelling and stored first suffix stay distinct after reentry', async () => {
      const previous = person.token;
      person = await services.originalSession.person({loginToken: login.token, code: 'SHARED'});
      assert.ok(person.displayName.endsWith('/SHARED'));
      assert.ok((await services.originalSession.read({token: person.token})).displayName.endsWith('/sHaReD'));
      await assert.rejects(services.originalSession.read({token: previous}), error('original_session_invalid'));
      await assert.rejects(services.originalSession.requireLogin({token: person.token}), error('original_session_wrong_type'));
      await assert.rejects(services.originalSession.person({loginToken: login.groupToken, code: 'Shared'}), error('original_session_wrong_type'));
    });
    await t.test('opened/paused/completed Test claims keep Source running history; reads use current physical labels without editing Tests', async () => {
      const parent = await repository.findParticipantSessionByAccessTokenHash(createHash('sha256').update(person.token).digest('hex'));
      const stamp = new Date().toISOString(), release = randomUUID();
      await repository.saveContentRelease({...ids, contentReleaseId: release, importJobId: release, releaseLabel: 'Actual fixed content', status: 'active', createdAt: stamp, activatedAt: stamp,
        runtimeSnapshot: {bookletEntries: [{bookletKey: 'ORACLE.BOOK.A', displayLabel: 'Owned booklet', policy: compileBookletRuntimePolicy({}), unitEntries: [], testletEntries: []}]}});
      opened = await services.participantRuntime.launch({participantSessionId: parent.participantSessionId, bookletKey: 'ORACLE.BOOK.A'});
      await repository.saveTestRun({...opened, status: 'paused', locked: true, unitResponses: {'private-unit': 'Exact private Ω\n  '}, unitResponseFieldTimestamps: {'private-unit': {opaque: 123}}});
      const before = await repository.getTestRunById(opened.testRunId);
      await uploadBooklet('  Current physical Ω\n  ');
      const metadataOnly = new Proxy(repository, {get(target, key) {
        if (key === 'listTestRunsByParticipantSessionId') return () => assert.fail('Session claims must not load complete private Test payloads');
        const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
      }});
      const metadataServices = createFirstSliceServices({repository: metadataOnly, originalXmlSchemaValidator: validator});
      const originalParser = pgTypes.getTypeParser(3802), originalJsonParse = JSON.parse;
      if (kind === 'postgres' || kind === 'sqlite') JSON.parse = (...args) => {
        if (typeof args[0] === 'string' && args[0].includes('private-unit')) throw Error('Owned private Test payload decoder fence');
        return originalJsonParse(...args);
      };
      if (kind === 'postgres') pgTypes.setTypeParser(3802, text => {
        if (text.includes('private-unit')) throw Error('Owned private Test payload decoder fence');
        return originalParser(text);
      });
      let state;
      try {
        if (kind === 'postgres' || kind === 'sqlite') await assert.rejects(repository.getTestRunById(opened.testRunId), /Owned private Test payload decoder fence/);
        state = await metadataServices.originalSession.read({token: person.token});
      } finally { JSON.parse = originalJsonParse; if (kind === 'postgres') pgTypes.setTypeParser(3802, originalParser); }
      const flags = await repository.listOriginalSessionTestFlags(parent.participantSessionId);
      assert.equal(flags.length, 1); assert.equal(Object.hasOwn(flags[0], 'unitResponses'), false); assert.equal(Object.hasOwn(flags[0], 'testletTimers'), false);
      assert.equal(state.claims.test[0].label, '  Current physical Ω\n  '); assert.deepEqual(state.claims.test[0].flags, {locked: true, running: true});
      assert.deepEqual(await repository.getTestRunById(opened.testRunId), before);
      await repository.saveTestRun({...before, status: 'completed'});
      assert.equal((await services.originalSession.read({token: person.token})).claims.test[0].flags.running, true);
      await uploadBooklet('Owned booklet');
    });
    await t.test('current review/missing code claims follow imports without changing first person or existing Test data', async () => {
      const before = await repository.getTestRunById(opened.testRunId);
      await uploadRoster('run-review');
      assert.deepEqual((await services.originalSession.read({token: person.token})).claims.review, []);
      await uploadRoster('run-hot-return', 'replacement');
      const removed = await services.originalSession.read({token: person.token}); assert.deepEqual(removed.claims, {}); assert.deepEqual(removed.access, {});
      const after = await repository.getTestRunById(opened.testRunId); assert.deepEqual({...after, executionMode: before.executionMode}, before);
      await uploadRoster();
    });
    await t.test('person reads retain the first credential-stage group label while immediate responses use current Login labels', async () => {
      const currentLabel = 'Current imported group Ω';
      await services.workspaceAdminRead.importParticipantRoster({...scope, rosterText: roster().replace('label="Owned native login Ω"', 'label="' + currentLabel + '"')});
      try {
        assert.equal((await services.originalSession.read({token: login.token})).groupLabel, currentLabel);
        assert.equal((await services.originalSession.read({token: person.token})).groupLabel, 'Owned native login Ω');
        person = await services.originalSession.person({loginToken: login.token, code: 'Shared'});
        assert.equal(person.groupLabel, currentLabel); assert.ok(person.displayName.startsWith(currentLabel + '/'));
        assert.equal((await services.originalSession.read({token: person.token})).groupLabel, 'Owned native login Ω');
        assert.equal((await services.originalSession.login({name, password})).token, login.token);
        assert.equal((await services.originalSession.read({token: person.token})).groupLabel, 'Owned native login Ω');
      } finally { await uploadRoster(); }
    });
    await t.test('Source case-colliding code buckets retain their last bucket and append common Booklets after coded ones', async () => {
      const definition = (id, label) => booklet(label).replace('<Id>ORACLE.BOOK.A</Id>', '<Id>' + id + '</Id>');
      await services.contentIntake.uploadWorkspaceFile({...scope, fileName: 'booklet-b.xml', mediaType: 'application/xml', sourceDocument: definition('ORACLE.BOOK.B', 'Bucket B')});
      await services.contentIntake.uploadWorkspaceFile({...scope, fileName: 'booklet-c.xml', mediaType: 'application/xml', sourceDocument: definition('ORACLE.BOOK.C', 'Common C')});
      const changed = xml('Testtakers', 'testcenter-testtaker-xml', `<Metadata/><Group id="ORACLE.NATIVE.LOGIN" label="Owned native login Ω"><Login name="${name}" pw="${password}" mode="run-hot-return"><Booklet>ORACLE.BOOK.C</Booklet><Booklet codes="Case">ORACLE.BOOK.A</Booklet><Booklet codes="case">ORACLE.BOOK.B</Booklet></Login></Group>`);
      await services.workspaceAdminRead.importParticipantRoster({...scope, rosterText: changed});
      try {
        const entry = await services.originalSession.person({loginToken: login.token, code: 'CASE'});
        assert.deepEqual(entry.access.test, ['ORACLE.BOOK.B', 'ORACLE.BOOK.C']);
        assert.deepEqual(entry.claims.test.map(row => row.label), ['Bucket B', 'Common C']);
        const parent = await repository.findParticipantSessionByAccessTokenHash(createHash('sha256').update(entry.token).digest('hex'));
        const state = await services.participantRuntime.getRuntimeState({participantSessionId: parent.participantSessionId});
        assert.deepEqual(state.booklets.map(row => row.bookletKey), ['ORACLE.BOOK.B', 'ORACLE.BOOK.C']);
        assert.deepEqual((await services.originalSession.read({token: person.token})).claims, {});
      } finally { await uploadRoster(); }
    });
    await t.test('same opaque five-field puzzle format preserves secrets, raw code and exact Login-token binding', async () => {
      const mutable = {...config, enabledScopes: [...config.enabledScopes]};
      const work = new OriginalSessionProof(repository, mutable), target = {kind: 'person', code: ' sHaReD ', tokenHash: OriginalSessionProof.tokenHash(login.token)};
      mutable.currentSecret = nextSecret; mutable.enabledScopes.length = 0;
      assert.throws(() => work.directAllowed('login', name), error('original_work_required'));
      assert.throws(() => work.directAllowed('person', '0'), error('original_work_required'));
      const challenge = work.create(target), solution = solve(challenge);
      assert.deepEqual(Object.keys(challenge).sort(), ['algorithm', 'challenge', 'maxNumber', 'salt', 'signature']);
      for (const privateValue of [password, target.code, login.token]) assert.equal(JSON.stringify(challenge).includes(privateValue), false);
      await assert.rejects(work.consume({...solution, signature: '0'.repeat(64)}, login.token), error('original_work_invalid'));
      await assert.rejects(work.consume({...solution, number: solution.number + 1}, login.token), error('original_work_invalid'));
      await assert.rejects(work.consume({...solution, salt: solution.salt + 'x'}, login.token), error('original_work_invalid'));
      await assert.rejects(work.consume(solution), error('original_token_missing'));
      await assert.rejects(work.consume(solution, 'different-owned-login-token'), error('original_work_invalid'));
      assert.deepEqual(await work.consume(solution, login.token), target, 'The exact raw code is retained, without canonical trimming');
      await assert.rejects(work.consume(solution, login.token), error('original_work_replayed'));
    });
    await t.test('native challenge bounds follow the existing wire budget rather than shrinking valid credential fields', async () => {
      const work = new OriginalSessionProof(repository, config);
      const large = {kind: 'login', name: 'n'.repeat(1024), password: 'p'.repeat(8192)};
      const challenge = work.create(large); assert.equal(JSON.stringify(challenge).includes(large.password), false);
      assert.deepEqual(await work.consume(solve(challenge)), large);
      assert.throws(() => new OriginalSessionProof(repository, {...config, maxJsonBodyBytes: 700}).create({kind: 'login', name: 'n'.repeat(200), password: 'p'.repeat(200)}), error('original_work_too_large'));
    });
    await t.test('concurrent valid solutions have one durable winner across proof instances', async () => {
      const work = new OriginalSessionProof(repository, config), solution = solve(work.create({kind: 'login', name, password}));
      const results = await Promise.allSettled(Array.from({length: 8}, () => new OriginalSessionProof(repository, config).consume(solution)));
      assert.equal(results.filter(row => row.status === 'fulfilled').length, 1);
      for (const row of results.filter(row => row.status === 'rejected')) assert.equal(row.reason.errorCode, 'original_work_replayed');
    });
    await t.test('expired/future/config-mismatched work cannot consume a ticket; key rotation accepts only configured previous keys', async () => {
      let clock = Date.now();
      const work = new OriginalSessionProof(repository, config, () => clock), target = {kind: 'login', name, password};
      const expired = solve(work.create(target)); clock += config.ttlMs;
      await assert.rejects(work.consume(expired), error('original_work_expired'));
      const future = solve(work.create(target)); clock -= 10_000;
      await assert.rejects(work.consume(future), error('original_work_invalid'));
      clock += 10_000;
      const retained = solve(work.create(target));
      await assert.rejects(new OriginalSessionProof(repository, {...config, currentSecret: nextSecret}, () => clock).consume(retained), error('original_work_invalid'));
      await assert.rejects(new OriginalSessionProof(repository, {...config, ttlMs: config.ttlMs + 1}, () => clock).consume(retained), error('original_work_invalid'));
      assert.deepEqual(await new OriginalSessionProof(repository, {...config, currentSecret: nextSecret, previousSecret: secret}, () => clock).consume(retained), target);
    });
    await t.test('consumption survives durable reopen; Login logout and person revocation retain Test data', async () => {
      const work = new OriginalSessionProof(repository, config), solution = solve(work.create({kind: 'login', name, password}));
      await work.consume(solution); await close(); await open();
      await assert.rejects(new OriginalSessionProof(repository, config).consume(solution), error('original_work_replayed'));
      await services.originalSession.logout({token: login.token}); assert.equal((await services.originalSession.read({token: login.token})).token, login.token);
      const before = await repository.getTestRunById(opened.testRunId);
      await services.originalSession.logout({token: person.token}); await assert.rejects(services.originalSession.read({token: person.token}), error('original_session_invalid'));
      assert.deepEqual(await repository.getTestRunById(opened.testRunId), before);
    });
  } finally {
    await close();
    if (created) { assert.equal(Number((await admin.query('SELECT count(*) AS count FROM pg_stat_activity WHERE application_name=$1', [schema])).rows[0].count), 0); await admin.query(`DROP SCHEMA "${schema}" CASCADE`); }
    await admin?.end(); await rm(directory, {recursive: true, force: true});
  }
});

test(`real ${process.env.FIRST_SLICE_STORE === 'postgres' ? 'PostgreSQL' : 'SQLite'} native session HTTP enforces typed credentials and configured work`, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'owned-native-http-')), file = join(directory, 'state.sqlite');
  const postgres = process.env.FIRST_SLICE_STORE === 'postgres', schema = 'owned_session_api_' + randomUUID().replaceAll('-', '');
  const url = postgres ? new URL(process.env.FIRST_SLICE_POSTGRES_URL) : null; url?.searchParams.set('options', '-c search_path=' + schema); url?.searchParams.set('application_name', schema);
  let server, storage, repository, admin, created = false;
  const environment = {FIRST_SLICE_STORE: postgres ? 'postgres' : 'sqlite', FIRST_SLICE_SQLITE_FILE: file, FIRST_SLICE_BOOTSTRAP_DEMO: 'false',
    FIRST_SLICE_OPERATOR_AUTH_REQUIRED: 'true', FIRST_SLICE_XML_SCHEMA_PROFILE: 'original-19', REQUIRE_LOGIN_PASSWORD: 'false',
    FIRST_SLICE_PROOF_OF_WORK_SCOPES: 'participant,second_code', FIRST_SLICE_PROOF_OF_WORK_SECRET: secret, FIRST_SLICE_PROOF_OF_WORK_PREVIOUS_SECRET: '', FIRST_SLICE_PROOF_OF_WORK_MAX_NUMBER: '12',
    FIRST_SLICE_PROOF_OF_WORK_TTL_MS: '60000', ...(url ? {FIRST_SLICE_POSTGRES_URL: url.toString()} : {})};
  const previous = new Map(Object.keys(environment).map(key => [key, process.env[key]]));
  try {
    if (postgres) { admin = new Pool({connectionString: process.env.FIRST_SLICE_POSTGRES_URL}); await admin.query(`CREATE SCHEMA "${schema}"`); created = true; }
    try { Object.assign(process.env, environment); server = await createProductionApiServer(); }
    finally { for (const [key, value] of previous) { if (value === undefined) delete process.env[key]; else process.env[key] = value; } }
    storage = postgres ? await createPostgresFirstSliceStorage(url.toString()) : createSqliteFirstSliceStorage(file); repository = storage.repository;
    const services = createFirstSliceServices({repository, originalXmlSchemaValidator: validator});
    const tenant = await services.platform.createTenant({tenantKey: 'owned-' + randomUUID(), displayName: 'Owned HTTP session'});
    const workspace = await services.platform.createWorkspace({tenantKey: tenant.tenantKey, workspaceKey: 'owned', displayName: 'Owned HTTP session'});
    const scope = {tenantKey: tenant.tenantKey, workspaceKey: workspace.workspaceKey};
    await uploadDependencies(services, scope);
    await services.contentIntake.uploadWorkspaceFile({...scope, fileName: 'booklet.xml', sourceDocument: booklet('Owned booklet'), mediaType: 'application/xml'});
    await services.workspaceAdminRead.importParticipantRoster({...scope, rosterText: roster()});
    await new Promise(done => server.listen(0, '127.0.0.1', done));
    const base = 'http://127.0.0.1:' + server.address().port;
    const request = async (method, path, {body, token, status = 200} = {}) => {
      const response = await fetch(base + path, {method, headers: {...(body === undefined ? {} : {'content-type': 'application/json'}), ...(token ? {AuthToken: token} : {})},
        ...(body === undefined ? {} : {body: JSON.stringify(body)}), signal: AbortSignal.timeout(15_000)});
      const text = await response.text(); const value = text ? JSON.parse(text) : null;
      assert.equal(response.status, status, `${method} ${path}: HTTP ${response.status}`);
      assert.equal(response.headers.get('cache-control'), 'private, no-store'); return {value, text, headers: response.headers};
    };
    let login, person, loginSolution, personSolution;
    await t.test('direct secrets are refused and invalid work creates no person or Login capability', async () => {
      assert.equal(typeof (await request('PUT', '/session/login', {body: {name, password}, status: 400})).value, 'string');
      await request('PUT', '/session/login', {body: {name, password: ''}, status: 400});
      await request('GET', '/session', {status: 401});
      assert.deepEqual(await repository.listParticipantSessionsByWorkspace(tenant.tenantId, workspace.workspaceId), []);
      assert.deepEqual(await repository.listOriginalLoginBindingsByWorkspace(tenant.tenantId, workspace.workspaceId), []);
      const challenge = (await request('POST', '/session/challenge', {body: {loginType: 'login', name, password}})).value;
      loginSolution = solve(challenge); assert.equal(JSON.stringify(challenge).includes(password), false);
      await request('PUT', '/session', {body: {...loginSolution, signature: '0'.repeat(64)}, status: 400});
      assert.deepEqual(await repository.listOriginalLoginBindingsByWorkspace(tenant.tenantId, workspace.workspaceId), []);
    });
    await t.test('real protected Login/person requests match Source AccessSets and the exact five-field solver', async () => {
      login = (await request('PUT', '/session', {body: loginSolution})).value; sameAccessSet(login, sourceLogin);
      await request('PUT', '/session', {body: loginSolution, status: 409});
      assert.deepEqual((await request('GET', '/session', {token: login.token})).value, login);
      await request('POST', '/session/person/challenge', {body: {code: 'Shared'}, status: 401});
      await request('POST', '/session/person/challenge', {token: login.groupToken, body: {code: 'Shared'}, status: 403});
      await request('PUT', '/session/person', {token: login.token, body: {code: 'Shared'}, status: 400});
      const challenge = (await request('POST', '/session/person/challenge', {token: login.token, body: {code: 'sHaReD'}})).value;
      assert.equal(JSON.stringify(challenge).includes('sHaReD'), false); personSolution = solve(challenge);
      await request('PUT', '/session', {body: personSolution, status: 401});
      person = (await request('PUT', '/session', {token: login.token, body: personSolution})).value; sameAccessSet(person, sourcePerson);
      assert.deepEqual((await request('GET', '/session', {token: person.token})).value, person);
      await request('POST', '/session/person/challenge', {token: person.token, body: {code: 'Shared'}, status: 403});
    });
    await t.test('person work is one-use and cannot cross another valid Login; rejected peers cannot burn the valid ticket', async () => {
      await request('PUT', '/session', {token: login.token, body: personSolution, status: 409});
      const peerChallenge = (await request('POST', '/session/challenge', {body: {loginType: 'login', name: 'owned-peer', password}})).value;
      const peer = (await request('PUT', '/session', {body: solve(peerChallenge)})).value;
      const challenge = (await request('POST', '/session/person/challenge', {token: login.token, body: {code: 'SHARED'}})).value;
      const solution = solve(challenge);
      await request('PUT', '/session', {token: peer.token, body: solution, status: 400});
      await request('PUT', '/session', {token: person.token, body: solution, status: 403});
      person = (await request('PUT', '/session', {token: login.token, body: {...solution, code: 'tampered-input'}})).value;
      assert.ok(person.displayName.endsWith('/SHARED')); assert.ok((await request('GET', '/session', {token: person.token})).value.displayName.endsWith('/sHaReD'));
    });
    await t.test('native logout uses empty HTTP205, preserves Login metadata, and revokes only the person bearer', async () => {
      assert.equal((await request('DELETE', '/session', {token: login.token, status: 205})).text, '');
      assert.equal((await request('GET', '/session', {token: login.token})).value.token, login.token);
      assert.equal((await request('DELETE', '/session', {token: person.token, status: 205})).text, '');
      await request('GET', '/session', {token: person.token, status: 401});
      const wrong = await request('GET', '/session/login', {status: 405}); assert.equal(wrong.headers.get('allow'), 'PUT');
    });
  } finally {
    if (server) await new Promise((done, reject) => server.close(error => error && error.code !== 'ERR_SERVER_NOT_RUNNING' ? reject(error) : done()));
    await storage?.shutdown();
    if (created) { assert.equal(Number((await admin.query('SELECT count(*) AS count FROM pg_stat_activity WHERE application_name=$1', [schema])).rows[0].count), 0); await admin.query(`DROP SCHEMA "${schema}" CASCADE`); }
    await admin?.end(); await rm(directory, {recursive: true, force: true});
  }
});
