import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {mkdtemp, readFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {Pool, types as pgTypes} from 'pg';
import {createFirstSliceServices} from '@testcenter-rewrite-app/application';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceStorage} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceStorage} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';
import {createProductionApiServer} from '../apps/api/dist/apps/api/src/index.js';
import {prepareOriginalXmlSchemaValidator} from '../packages/application/dist/packages/application/src/original-xml-schema.js';

const validator = await prepareOriginalXmlSchemaValidator(resolve(process.env.FIRST_SLICE_XML_SCHEMA_CACHE || '.data/original-xml-schemas'), process.env.FIRST_SLICE_XML_SCHEMA_DOWNLOAD !== 'false');
const source = new URL('../test-fixtures/original-testcenter/source-workspace-results/native-monitor-materialization/', import.meta.url);
const group = 'ORACLE.MATERIAL', peerGroup = 'ORACLE.MATERIAL.PEER', label = 'Alpha owned materialization';
const coded = 'owned-auto-coded', plain = 'owned-auto-plain', restart = 'owned-auto-restart', peerName = 'owned-auto-peer', monitorName = 'owned-auto-monitor', studyName = 'owned-auto-study';
const password = 'Owned-native-monitor-secret', unitName = 'ORACLE.POW.UNIT', firstBook = 'ORACLE.POW.BOOK#MATERIAL:FIRST', secondBook = 'ORACLE.POW.BOOK#MATERIAL:SECOND';
const xml = (type, body) => `<${type} xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/${type === 'Unit' ? 'unit-xml/17.6' : type === 'Booklet' ? 'testcenter-booklet-xml/18.0' : 'testcenter-testtaker-xml/18.0'}">${body}</${type}>`;
const loginXml = (name, mode, books = '') => `<Login name="${name}" pw="${password}" mode="${mode}">${books}</Login>`;
const document = (mode = 'run-hot-return', groupLabel = label) => xml('Testtakers', '<Metadata/>' + `<Group id="${group}" label="${groupLabel}">` +
  loginXml(coded, mode, `<Booklet codes="A B">${firstBook.toLowerCase()}</Booklet><Booklet codes="A B">${secondBook.toLowerCase()}</Booklet>`) +
  loginXml(plain, 'run-trial', '<Booklet>ORACLE.POW.BOOK</Booklet>') + loginXml(restart, 'run-hot-restart', '<Booklet>ORACLE.POW.BOOK</Booklet>') +
  loginXml(monitorName, 'monitor-group') + loginXml(studyName, 'monitor-study') + '</Group>' + `<Group id="${peerGroup}" label="Beta owned materialization">` +
  loginXml(peerName, 'run-hot-return', '<Booklet>ORACLE.POW.BOOK</Booklet>') + '</Group>');
const packetSet = rows => [...rows].sort((a, b) => a.testId - b.testId);
const stable = rows => packetSet(rows).map(({timestamp, ...row}) => row);
const rejected = status => error => error.statusCode === status;

test('Source79 retains all Source75 controls and proves fresh dependent materialization, bearer retention and study group claims', async () => {
  const manifest = JSON.parse(await readFile(new URL('manifest.json', source), 'utf8'));
  assert.equal(manifest.sourceCommit, 'eedae41840cbe90e5547c0211da818bdf620f5aa');
  assert.equal(manifest.checks, 79); assert.equal(manifest.precedingChecksRetained, 75); assert.equal(manifest.httpObservations, 1157);
  for (const [name, sha] of Object.entries(manifest.files)) {
    assert.match(name, /^[a-z0-9][a-z0-9.-]*$/);
    assert.equal(createHash('sha256').update(await readFile(new URL(name, source))).digest('hex'), sha, name);
  }
  const receipt = JSON.parse(await readFile(new URL('receipt.json', source), 'utf8'));
  assert.equal(receipt.success, true); assert.equal(receipt.testMode, false); assert.equal(receipt.checks.length, 79);
  const fresh = receipt.checks[75], first = receipt.checks[76], repeated = receipt.checks[77], study = receipt.checks[78];
  assert.equal(fresh.rows.length, 5); assert.equal(new Set(fresh.rows.map(row => row.personId)).size, 3);
  assert.deepEqual(packetSet(first.rows), packetSet(fresh.rows)); assert.deepEqual(packetSet(repeated.rows), packetSet(fresh.rows));
  assert.equal(repeated.personBearerRetained, true); assert.equal(study.studyAccessSet.claims.test, undefined);
  assert.equal(study.peerRows[0].personLabel, peerName); assert.equal(study.peerRows[0].testState.status, 'pending');
});

const kinds = process.env.FIRST_SLICE_STORE === 'postgres' ? ['postgres'] : ['memory', 'file', 'sqlite'];
for (const kind of kinds) test(`${kind}: actual native monitor materialization and metadata-only session snapshots`, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'owned-monitor-sessions-')), file = join(directory, kind === 'file' ? 'state.json' : 'state.sqlite');
  const schema = 'owned_monitor_sessions_' + randomUUID().replaceAll('-', '');
  const url = kind === 'postgres' ? new URL(process.env.FIRST_SLICE_POSTGRES_URL) : null;
  url?.searchParams.set('options', '-c search_path=' + schema);
  let storage, repository, services, pool, control, server, monitor, study, owner, firstRows, firstId, identity, baseScope;
  const open = async () => {
    storage = kind === 'memory' ? storage ?? {repository: createInMemoryFirstSliceRepository(), shutdown: async () => {}}
      : kind === 'file' ? await createFileFirstSliceStorage(file) : kind === 'sqlite' ? createSqliteFirstSliceStorage(file) : await createPostgresFirstSliceStorage(url.toString());
    repository = storage.repository; services = createFirstSliceServices({repository, originalXmlSchemaValidator: validator, xmlSchemaProfile: 'original-19'});
  };
  const list = (token = monitor.token, groupKey = group) => services.originalMonitor.sessions({token, groupKey}).then(JSON.parse);
  const authenticate = async (name, code = '') => {
    const login = await services.originalAuthentication.login({name, password});
    return login.kind === 'login' ? services.originalAuthentication.person({loginToken: login.token, code}) : login;
  };
  const closeServer = async () => {if (server) {await new Promise((done, reject) => server.close(error => error && error.code !== 'ERR_SERVER_NOT_RUNNING' ? reject(error) : done())); server = undefined;}};
  try {
    if (url) {pool = new Pool({connectionString: process.env.FIRST_SLICE_POSTGRES_URL}); await pool.query(`CREATE SCHEMA "${schema}"`);}
    await open();
    const tenant = await services.platform.createTenant({tenantKey: 'owned-' + randomUUID(), displayName: 'Owned native monitor'});
    const workspace = await services.platform.createWorkspace({tenantKey: tenant.tenantKey, workspaceKey: 'owned', displayName: 'Owned native monitor'});
    baseScope = {tenantId: tenant.tenantId, workspaceId: workspace.workspaceId};
    const scope = {tenantKey: tenant.tenantKey, workspaceKey: workspace.workspaceKey};
    const upload = (fileName, sourceDocument, mediaType = 'application/xml') => services.contentIntake.uploadWorkspaceFile({...scope, fileName, sourceDocument, mediaType});
    await upload('player.html', '<html><script type="application/ld+json">' + JSON.stringify({id: 'owned-monitor-player', version: '1.2.3', specVersion: '6.0', metadataVersion: '2.0', type: 'player', name: [{lang: 'en', value: 'Owned monitor Player'}]}) + '</script><main>Owned</main></html>', 'text/html');
    await upload('unit.xml', xml('Unit', '<Metadata><Id>' + unitName + '</Id><Label>Owned Unit</Label></Metadata><Definition player="owned-monitor-player@1.2.3">Owned definition</Definition>'));
    await upload('booklet.xml', xml('Booklet', '<Metadata><Id>ORACLE.POW.BOOK</Id><Label>  Current Booklet Ω\n  </Label></Metadata><Units><Unit id="' + unitName + '" label="Owned Unit"/></Units>'));
    const importRoster = (mode, groupLabel) => services.workspaceAdminRead.importParticipantRoster({...scope, rosterText: document(mode, groupLabel)});
    await importRoster();

    await t.test('monitor credential login alone creates fresh coded/uncoded people and every unopened assigned Test', async () => {
      assert.equal((await repository.listParticipantSessionsByWorkspace(baseScope.tenantId, baseScope.workspaceId)).length, 0);
      monitor = await services.originalSession.login({name: monitorName, password});
      firstRows = await list(); assert.equal(firstRows.length, 5);
      assert.deepEqual(firstRows.map(row => row.personLabel).sort(), [coded + '/A', coded + '/A', coded + '/B', coded + '/B', plain].sort());
      assert.equal(new Set(firstRows.map(row => row.personId)).size, 3); assert.equal(new Set(firstRows.map(row => row.testId)).size, 5);
      for (const suffix of ['A', 'B']) assert.deepEqual(firstRows.filter(row => row.personLabel === coded + '/' + suffix).map(row => row.bookletName).sort(), [firstBook, secondBook]);
      for (const row of firstRows) {assert.deepEqual(row.testState, {status: 'pending'}); assert.deepEqual(row.unitState, {}); assert.equal(row.unitName, undefined);}
      assert.equal(await services.originalMonitor.sessions({token: monitor.token}), '[]');
      await assert.rejects(list(monitor.token, peerGroup), rejected(403));
      const people = await repository.listParticipantSessionsByWorkspace(baseScope.tenantId, baseScope.workspaceId);
      assert.equal(people.some(person => person.originalLoginKey === restart || person.originalLoginKey === peerName), false);
      assert.ok(people.filter(person => person.originalLoginKey !== monitorName).every(person => person.contentReleaseId !== null));
    });
    await t.test('first person login and repeated monitor login retain every identity, saved clock and existing active bearer', async () => {
      owner = await authenticate(coded, 'a');
      const before = await list(); assert.deepEqual(packetSet(before), packetSet(firstRows));
      identity = await repository.getOriginalPersonNumber(owner.participantSession);
      assert.equal(Number(identity), before.find(row => row.personLabel === coded + '/A').personId);
      const credential = await repository.getParticipantAccessCredential(owner.participantSession.participantSessionId);
      monitor = await services.originalSession.login({name: monitorName, password});
      assert.deepEqual(await repository.getParticipantAccessCredential(owner.participantSession.participantSessionId), credential);
      assert.equal((await services.originalAuthentication.read({token: owner.token})).participantSession.participantSessionId, owner.participantSession.participantSessionId);
      assert.deepEqual(packetSet(await list()), packetSet(before));
      await assert.rejects(list(owner.token), rejected(403));
      const login = await services.originalAuthentication.login({name: coded, password});
      await assert.rejects(list(login.token), rejected(403));
    });
    await t.test('study login materializes only its workspace and returns group claims without inventing own Test claims', async () => {
      study = await services.originalSession.login({name: studyName, password});
      assert.equal(study.claims.test, undefined); assert.ok(study.claims.testGroupMonitor.some(row => row.id === peerGroup));
      const rows = await list(study.token, peerGroup); assert.equal(rows.length, 1); assert.equal(rows[0].personLabel, peerName);
      assert.equal(rows[0].testState.status, 'pending');
      const all = JSON.parse(await services.originalMonitor.sessions({token: study.token})); assert.equal(all.length, 6);
      assert.deepEqual(new Set(all.map(row => row.groupName)), new Set([group, peerGroup]));
      await assert.rejects(list(monitor.token, peerGroup), rejected(403));
    });
    await t.test('running/locked projection uses saved native Test and Unit state and repeated polling is read-only', async () => {
      firstId = String(firstRows.find(row => row.personLabel === coded + '/A' && row.bookletName === firstBook).testId);
      await services.originalTest.read({token: owner.token, testNumber: firstId});
      await services.originalTest.patchState({token: owner.token, testNumber: firstId, patch: [
        {key: 'CURRENT_UNIT_ID', content: unitName, timeStamp: 900}, {key: 'status', content: 'authored-status', timeStamp: 901}, {key: 'ownedState', content: 'Ω first', timeStamp: 902}
      ]});
      await services.originalUnit.patchState({token: owner.token, testNumber: firstId, unitName, body: {originalUnitId: 'OWNED.MONITOR.UNIT', newState: [
        {key: 'PRESENTATION_PROGRESS', content: 'some', timeStamp: 903}, {key: 'ownedUnit', content: 'Ω unit', timeStamp: 904}
      ]}});
      let packet = (await list()).find(row => String(row.testId) === firstId);
      assert.equal(packet.testState.status, 'running'); assert.equal(packet.testState.ownedState, 'Ω first'); assert.equal(packet.unitName, unitName); assert.equal(packet.unitState.ownedUnit, 'Ω unit');
      await services.originalTest.patchLock({token: owner.token, testNumber: firstId, body: {timeStamp: 950, message: 'Owned monitor lock'}});
      packet = (await list()).find(row => String(row.testId) === firstId); assert.equal(packet.testState.status, 'locked'); assert.equal(packet.unitState.ownedUnit, 'Ω unit');
      const mapping = await repository.findOriginalTestNumber({...owner.participantSession, testNumber: firstId});
      const before = await repository.getTestRunById(mapping.testRunId), units = await repository.getOriginalUnit({...mapping, unitName});
      assert.deepEqual(packetSet(await list()), packetSet(await list()));
      assert.deepEqual(await repository.getTestRunById(mapping.testRunId), before); assert.deepEqual(await repository.getOriginalUnit({...mapping, unitName}), units);
      monitor = await services.originalSession.login({name: monitorName, password});
      assert.equal((await list()).find(row => String(row.testId) === firstId).testState.status, 'locked');
    });
    await t.test('current imported mode/label projection does not rewrite Test history or numeric identity', async () => {
      const before = (await list()).find(row => String(row.testId) === firstId);
      await importRoster('run-review', 'Changed Ω group'); assert.equal((await list()).some(row => String(row.testId) === firstId), false);
      await importRoster('run-trial', 'Changed Ω group');
      const after = (await list()).find(row => String(row.testId) === firstId);
      assert.equal(after.personId, before.personId); assert.equal(after.testId, before.testId); assert.equal(after.timestamp, before.timestamp);
      assert.equal(after.mode, 'run-trial'); assert.equal(after.groupLabel, 'Changed Ω group'); assert.deepEqual(after.testState, before.testState); assert.deepEqual(after.unitState, before.unitState);
      await importRoster();
    });
    if (kind === 'sqlite' || kind === 'postgres') await t.test('production HTTP protects native monitor snapshots with real challenge login, current roles and group scope', async () => {
      const env = {FIRST_SLICE_STORE: kind, FIRST_SLICE_SQLITE_FILE: file, FIRST_SLICE_BOOTSTRAP_DEMO: 'false', FIRST_SLICE_OPERATOR_AUTH_REQUIRED: 'true', FIRST_SLICE_XML_SCHEMA_PROFILE: 'original-19', REQUIRE_LOGIN_PASSWORD: 'false',
        FIRST_SLICE_PROOF_OF_WORK_SCOPES: 'participant,second_code', FIRST_SLICE_PROOF_OF_WORK_SECRET: 'owned-monitor-sessions-http-secret-not-production', FIRST_SLICE_PROOF_OF_WORK_PREVIOUS_SECRET: '', FIRST_SLICE_PROOF_OF_WORK_MAX_NUMBER: '12', FIRST_SLICE_PROOF_OF_WORK_TTL_MS: '60000', ...(url ? {FIRST_SLICE_POSTGRES_URL: url.toString()} : {})};
      const previous = new Map(Object.keys(env).map(key => [key, process.env[key]]));
      try {Object.assign(process.env, env); server = await createProductionApiServer();}
      finally {for (const [key, value] of previous) if (value === undefined) delete process.env[key]; else process.env[key] = value;}
      await new Promise(done => server.listen(0, '127.0.0.1', done));
      const base = 'http://127.0.0.1:' + server.address().port;
      const request = async (method, path, {token, body, headers = {}, status = 200} = {}) => {
        const response = await fetch(base + path, {method, headers: {...headers, ...(token ? {AuthToken: token} : {}), ...(body === undefined ? {} : {'content-type': 'application/json'})}, ...(body === undefined ? {} : {body: JSON.stringify(body)}), signal: AbortSignal.timeout(15000)});
        const text = await response.text(); assert.equal(response.status, status, method + ' ' + path + ': ' + text);
        assert.equal(response.headers.get('cache-control'), 'private, no-store');
        assert.equal(response.headers.get('content-type')?.split(';')[0], 'application/json');
        return {value: text ? JSON.parse(text) : null, headers: response.headers, text};
      };
      const path = '/monitor/group/' + encodeURIComponent(group) + '/test-sessions';
      await request('GET', path, {status: 401});
      await request('GET', path + '?AuthToken=' + encodeURIComponent(monitor.token), {status: 401});
      await request('GET', path, {headers: {Authorization: 'Bearer ' + monitor.token}, status: 401});
      await request('GET', path, {token: owner.token, status: 403});
      await request('GET', path, {token: monitor.groupToken, status: 403});
      await request('GET', '/monitor/group/%ZZ/test-sessions', {token: owner.token, status: 403});
      await request('GET', '/monitor/group/%ZZ/test-sessions', {token: monitor.token, status: 400});
      await request('GET', '/monitor/group/' + encodeURIComponent(peerGroup) + '/test-sessions', {token: monitor.token, status: 403});
      const wrongMethod = await request('POST', path, {token: monitor.token, status: 405}); assert.equal(wrongMethod.headers.get('allow'), 'GET');
      await request('PUT', '/session/login', {body: {name: monitorName, password}, status: 400});
      const challenge = (await request('POST', '/session/challenge', {body: {loginType: 'login', name: monitorName, password}})).value;
      let solution;
      for (let number = 0; number <= challenge.maxNumber; number++) if (createHash('sha256').update(challenge.salt + number).digest('hex') === challenge.challenge) {
        solution = {algorithm: challenge.algorithm, challenge: challenge.challenge, salt: challenge.salt, signature: challenge.signature, number}; break;
      }
      assert.ok(solution); await request('PUT', '/session', {body: {...solution, signature: '0'.repeat(64)}, status: 400});
      const access = (await request('PUT', '/session', {body: solution})).value;
      await request('PUT', '/session', {body: solution, status: 409});
      assert.equal(access.claims.testGroupMonitor[0].id, group); monitor = access;
      const snapshot = await request('GET', path, {token: access.token});
      assert.deepEqual(packetSet(snapshot.value), packetSet(await list())); assert.equal(snapshot.value.length, 5);
      assert.equal(snapshot.text.includes(access.token), false); assert.equal(snapshot.text.includes(owner.token), false);
      assert.deepEqual((await request('GET', '/monitor/test-sessions', {token: access.token})).value, []);
      const studyRows = (await request('GET', '/monitor/test-sessions', {token: study.token})).value;
      assert.equal(studyRows.length, 6); assert.deepEqual(new Set(studyRows.map(row => row.groupName)), new Set([group, peerGroup]));
      assert.equal((await request('GET', '/session', {token: owner.token})).value.token, owner.token);
      await closeServer();
    });
    await t.test('conditional dependent credentials preserve a concurrent human login and reject foreign or missing parents', async () => {
      let human=await authenticate(peerName);
      assert.equal(human.kind,'person');
      const parent=human.participantSession;
      const input={...parent,originalLoginKey:parent.originalLoginKey,originalNameSuffix:parent.originalNameSuffix,tokenHash:createHash('sha256').update('owned-conditional-'+randomUUID()).digest('hex'),updatedAt:new Date().toISOString()};
      const active=await repository.getParticipantAccessCredential(parent.participantSessionId);
      assert.equal(await repository.ensureOriginalPersonCredential(input),true);
      assert.deepEqual(await repository.getParticipantAccessCredential(parent.participantSessionId),active);
      for(const mutation of [{tenantId:'foreign-'+parent.tenantId},{workspaceId:randomUUID()},{originalLoginKey:'foreign-native-login'},{originalNameSuffix:'foreign-suffix'},{participantSessionId:randomUUID()}])assert.equal(await repository.ensureOriginalPersonCredential({...input,...mutation}),false);
      await assert.rejects(repository.ensureOriginalPersonCredential({...input,tokenHash:'invalid'}),TypeError);
      assert.deepEqual(await repository.getParticipantAccessCredential(parent.participantSessionId),active);
      await services.originalAuthentication.logout({token:human.token});
      const [initialized,reentered]=await Promise.all([repository.ensureOriginalPersonCredential(input),authenticate(peerName)]);
      assert.equal(initialized,true); assert.equal(reentered.participantSession.participantSessionId,parent.participantSessionId);
      human=reentered;
      assert.equal((await services.originalAuthentication.read({token:human.token})).participantSession.participantSessionId,parent.participantSessionId);
      assert.equal((await repository.getParticipantAccessCredential(parent.participantSessionId)).tokenHash,createHash('sha256').update(human.token).digest('hex'));
    });
    if (kind === 'sqlite' || kind === 'postgres') await t.test('SQL monitor reads and repeat registration do not decode private responses or out-of-group state', async () => {
      control = kind === 'sqlite' ? new DatabaseSync(file) : new Pool({connectionString: url.toString()});
      const query = async (sql, args = []) => kind === 'sqlite' ? control.prepare(sql).all(...args) : (await control.query(sql, args)).rows;
      const mapping = await repository.findOriginalTestNumber({...owner.participantSession, testNumber: firstId});
      const marker = 'owned-private-monitor-' + randomUUID();
      await services.originalUnit.putResponse({token: owner.token, testNumber: firstId, unitName, body: {timeStamp: 960, dataParts: {private: marker}, responseType: 'owned'}});
      const originalResponse = (await repository.getTestRunById(mapping.testRunId)).unitResponses;
      await query(kind === 'sqlite' ? 'UPDATE test_runs SET unit_responses_json=? WHERE test_run_id=?' : 'UPDATE test_runs SET unit_responses_json=$1::jsonb WHERE test_run_id=$2', [JSON.stringify({private: marker}), mapping.testRunId]);
      // A newly assigned preset must be reservable while an older Test holds
      // real private responses. Repeat-only snapshots miss this SQL decode edge.
      await services.workspaceAdminRead.importParticipantRoster({...scope, rosterText: document().replace('<Booklet codes="A B">', '<Booklet codes="A">ORACLE.POW.BOOK#MATERIAL:THIRD</Booklet><Booklet codes="A B">')});
      const peerPerson=(await repository.listParticipantSessionsByWorkspace(baseScope.tenantId,baseScope.workspaceId)).find(person=>person.originalLoginKey===peerName);
      const peerIdentity=(await repository.listOriginalPersonTestIdentities(peerPerson))[0];
      const peerBefore=await repository.getTestRunById(peerIdentity.testRunId);
      await query(kind==='sqlite'?'UPDATE test_runs SET original_test_state_json=? WHERE test_run_id=?':'UPDATE test_runs SET original_test_state_json=$1::jsonb WHERE test_run_id=$2',[JSON.stringify({ownedForeignState:marker}),peerIdentity.testRunId]);
      const parse = JSON.parse, pgParse = pgTypes.getTypeParser(3802, 'text');
      const guarded = original => value => {if (typeof value === 'string' && value.includes(marker)) throw Error('Private monitor response was decoded'); return original(value);};
      try {
        JSON.parse = guarded(parse); if (kind === 'postgres') pgTypes.setTypeParser(3802, 'text', guarded(pgParse));
        await assert.rejects(repository.getTestRunById(mapping.testRunId), /Private monitor response was decoded/);
        await assert.rejects(repository.getOriginalUnit({...mapping, unitName}), /Private monitor response was decoded/);
        await assert.rejects(repository.getTestRunById(peerIdentity.testRunId), /Private monitor response was decoded/);
        const rows = await list(); assert.equal(rows.find(row => String(row.testId) === firstId).unitState.ownedUnit, 'Ω unit');
        monitor = await services.originalSession.login({name: monitorName, password});
        const expanded=await list(); assert.equal(expanded.length, 6);
        assert.equal(expanded.filter(row=>row.personLabel===coded+'/A'&&row.bookletName==='ORACLE.POW.BOOK#MATERIAL:THIRD').length,1);
      } finally {
        JSON.parse = parse; pgTypes.setTypeParser(3802, 'text', pgParse);
        await query(kind === 'sqlite' ? 'UPDATE test_runs SET unit_responses_json=? WHERE test_run_id=?' : 'UPDATE test_runs SET unit_responses_json=$1::jsonb WHERE test_run_id=$2', [JSON.stringify(originalResponse), mapping.testRunId]);
        await query(kind==='sqlite'?'UPDATE test_runs SET original_test_state_json=? WHERE test_run_id=?':'UPDATE test_runs SET original_test_state_json=$1::jsonb WHERE test_run_id=$2',[peerBefore.originalTestState===undefined?null:JSON.stringify(peerBefore.originalTestState),peerIdentity.testRunId]);
        if (kind === 'sqlite') control.close(); else await control.end(); control = undefined;
      }
    });
    if(kind==='sqlite'||kind==='postgres')await t.test('exhausted native numbering rolls back the entire fresh Test reservation before a real retry',async()=>{
      control=kind==='sqlite'?new DatabaseSync(file):new Pool({connectionString:url.toString()});
      const query=async(sql,args=[])=>kind==='sqlite'?control.prepare(sql).all(...args):(await control.query(sql,args)).rows;
      const counter=String((await query('SELECT last_number FROM original_test_number_counter WHERE singleton=1'))[0].last_number);
      const before=await repository.listOriginalPersonTestIdentities(owner.participantSession);
      await services.workspaceAdminRead.importParticipantRoster({...scope,rosterText:document().replace('<Booklet codes="A B">','<Booklet codes="A">ORACLE.POW.BOOK#MATERIAL:THIRD</Booklet><Booklet codes="A">ORACLE.POW.BOOK#MATERIAL:FOURTH</Booklet><Booklet codes="A B">')});
      try{
        await query(kind==='sqlite'?'UPDATE original_test_number_counter SET last_number=? WHERE singleton=1':'UPDATE original_test_number_counter SET last_number=$1 WHERE singleton=1',['9223372036854775807']);
        await assert.rejects(services.originalSession.login({name:monitorName,password}),/Native Test number space is exhausted/);
        assert.deepEqual(await repository.listOriginalPersonTestIdentities(owner.participantSession),before);
        assert.equal(String((await query('SELECT last_number FROM original_test_number_counter WHERE singleton=1'))[0].last_number),'9223372036854775807');
      }finally{
        await query(kind==='sqlite'?'UPDATE original_test_number_counter SET last_number=? WHERE singleton=1':'UPDATE original_test_number_counter SET last_number=$1 WHERE singleton=1',[counter]);
        if(kind==='sqlite')control.close();else await control.end();control=undefined;
      }
      monitor=await services.originalSession.login({name:monitorName,password});
      const rows=await list();assert.equal(rows.length,7);assert.equal(rows.filter(row=>row.personLabel===coded+'/A'&&row.bookletName==='ORACLE.POW.BOOK#MATERIAL:FOURTH').length,1);
      assert.equal((await services.originalAuthentication.read({token:owner.token})).participantSession.participantSessionId,owner.participantSession.participantSessionId);
    });
    await t.test('real store restart retains exact native packets, person IDs and a usable bearer', async () => {
      const before = stable(await list());
      if (kind !== 'memory') {await storage.shutdown(); await open();}
      assert.deepEqual(stable(await list()), before);
      assert.equal(await repository.getOriginalPersonNumber(owner.participantSession), identity);
      assert.equal((await services.originalAuthentication.read({token: owner.token})).participantSession.participantSessionId, owner.participantSession.participantSessionId);
    });
  } finally {
    await closeServer();
    if (control) {if (kind === 'sqlite') control.close(); else await control.end();}
    await storage?.shutdown();
    if (pool) {await pool.query(`DROP SCHEMA "${schema}" CASCADE`); await pool.end();}
    await rm(directory, {recursive: true, force: true});
  }
});
