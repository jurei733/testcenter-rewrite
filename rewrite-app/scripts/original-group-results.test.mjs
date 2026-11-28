import './source-native-group-deletion-evidence.mjs';
import './source-native-test-administration-evidence.mjs';
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
import {createOriginalGroupResultsPort, projectOriginalGroupResults, projectOriginalResultTest} from '../packages/application/dist/packages/application/src/original-group-results.js';
import {prepareOriginalXmlSchemaValidator} from '../packages/application/dist/packages/application/src/original-xml-schema.js';
import {createProductionApiServer} from '../apps/api/dist/apps/api/src/index.js';

const evidence = new URL('../test-fixtures/original-testcenter/source-workspace-results/', import.meta.url);
const receipts = {};
for (const folder of ['', 'group-snapshots/', 'native-person-lifecycle/']) {
  const manifest = JSON.parse(await readFile(new URL(folder + 'manifest.json', evidence), 'utf8'));
  assert.equal(manifest.sourceCommit, 'eedae41840cbe90e5547c0211da818bdf620f5aa');
  for (const [name, sha] of Object.entries(manifest.files)) {
    assert.match(name, /^[a-z0-9][a-z0-9.-]*$/);
    assert.equal(createHash('sha256').update(await readFile(new URL(folder + name, evidence))).digest('hex'), sha);
  }
  const receipt = JSON.parse(await readFile(new URL(folder + 'receipt.json', evidence), 'utf8'));
  assert.equal(receipt.success, true); assert.equal(receipt.testMode, false); receipts[folder] = receipt;
}
const stats = receipts[''].checks.find(row => row.name.startsWith('group statistics aggregate saved Unit rows'));
const frozen = receipts['group-snapshots/'].checks.find(row => row.name.startsWith('credential login freezes group label'));
const nativeCase = receipts['native-person-lifecycle/'].checks.find(row => row.name.startsWith('case-equivalent group reentry updates result group spelling'));
const validator = await prepareOriginalXmlSchemaValidator(resolve(process.env.FIRST_SLICE_XML_SCHEMA_CACHE || '.data/original-xml-schemas'), process.env.FIRST_SLICE_XML_SCHEMA_DOWNLOAD !== 'false');
const stamp = n => new Date(Date.parse('2026-10-25T08:00:00.456Z') + n * 1000).toISOString();
const seconds = n => Math.floor(Date.parse(stamp(n)) / 1000);
const privateResponse = 'OWNED_PRIVATE_RESULT_PAYLOAD_Ω';
const kinds = ['memory', 'file', 'sqlite'];
if (process.env.FIRST_SLICE_STORE === 'postgres') {assert.ok(process.env.FIRST_SLICE_POSTGRES_URL); kinds.push('postgres');}
const historyError = error => error.errorCode === 'original_result_history_unavailable' && error.statusCode === 409;

test('response counts merge native and legacy aliases without counting state-only Units', () => {
  const run = {testRunId: 'run', participantSessionId: 'person', tenantId: 'tenant', workspaceId: 'workspace',
    contentReleaseId: 'release', updatedAt: stamp(1), unitResponses: {'Alias.Ä': 'legacy'}};
  const result = projectOriginalResultTest(run, undefined, [
    {unitName: 'alias.ä', hasResponse: true},
    {unitName: 'alias.a', hasResponse: true},
    {unitName: 'STATE.ONLY', hasResponse: false}
  ]);
  assert.equal(result.responseCount, 2);
  assert.deepEqual(result.savedUnitKeys, ['Alias.Ä', 'alias.a', 'STATE.ONLY']);
});

test('a large native group uses indexed Login lookups and bounded aggregate arguments', {timeout: 30_000}, () => {
  const count = 140_001, scope = {tenantId: 'owned-large-tenant', workspaceId: 'owned-large-workspace'}, contentReleaseId = 'owned-large-release';
  const rows = projectOriginalGroupResults({...scope,
    people: Array.from({length: count}, (_, index) => ({...scope, contentReleaseId, participantSessionId: 'person-' + index, originalLoginKey: 'owned-large-login-' + index, groupKey: 'Owned.Large'})),
    bindings: Array.from({length: count}, (_, index) => ({...scope, loginKey: 'owned-large-login-' + index, groupKey: 'Owned.Large', groupSnapshotKey: 'Owned.Large'})),
    groups: [{...scope, groupKey: 'Owned.Large', groupLabel: 'Owned large native group', lastModifiedAt: stamp(1)}],
    runs: Array.from({length: count}, (_, index) => ({...scope, contentReleaseId, participantSessionId: 'person-' + index, testRunId: 'test-' + index,
      bookletName: 'Owned.Booklet', savedUnitKeys: ['Owned.Unit'], lastOpenedAt: stamp(3), lastTestModifiedAt: stamp(3)})), reviews: [], events: []});
  assert.deepEqual(rows, [{groupName: 'Owned.Large', groupLabel: 'Owned large native group', bookletsStarted: count,
    numUnitsMin: 1, numUnitsMax: 1, numUnitsTotal: count, numUnitsAvg: 1, lastChange: seconds(3)}]);
});

for (const kind of kinds) test(`${kind}: Original result groups use frozen labels, real saved Units and independent Test clocks`, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'owned-original-results-')), file = join(directory, kind === 'file' ? 'state.json' : 'state.sqlite');
  const schema = 'owned_results_' + randomUUID().replaceAll('-', ''), url = kind === 'postgres' ? new URL(process.env.FIRST_SLICE_POSTGRES_URL) : null;
  url?.searchParams.set('options', '-c search_path=' + schema); url?.searchParams.set('application_name', schema);
  let storage, repository, services, admin, created = false, clock = 0, person, first, second;
  const open = async () => {
    storage = kind === 'memory' ? storage ?? {repository: createInMemoryFirstSliceRepository(), shutdown: async () => {}}
      : kind === 'file' ? await createFileFirstSliceStorage(file)
      : kind === 'sqlite' ? createSqliteFirstSliceStorage(file) : await createPostgresFirstSliceStorage(url.toString());
    repository = storage.repository; services = createFirstSliceServices({repository, now: () => stamp(clock), originalXmlSchemaValidator: validator});
  };
  const close = async () => {const owned = storage; if (kind !== 'memory') storage = undefined; await owned?.shutdown();};
  try {
    if (url) {admin = new Pool({connectionString: process.env.FIRST_SLICE_POSTGRES_URL}); await admin.query(`CREATE SCHEMA "${schema}"`); created = true;}
    await open();
    const tenant = await services.platform.createTenant({tenantKey: 'owned-' + randomUUID(), displayName: 'Owned native results'});
    const workspace = await services.platform.createWorkspace({tenantKey: tenant.tenantKey, workspaceKey: 'owned', displayName: 'Owned native results'});
    const scope = {tenantKey: tenant.tenantKey, workspaceKey: workspace.workspaceKey}, ids = {tenantId: tenant.tenantId, workspaceId: workspace.workspaceId};
    const release = randomUUID();
    // An owned release fixture supplies runtime Booklets; this is not a new
    // production Source/XSD-upload Oracle. Native credential parsing is real.
    await repository.saveContentRelease({...ids, contentReleaseId: release, importJobId: release, releaseLabel: 'Owned results', status: 'active', createdAt: stamp(0), activatedAt: stamp(0),
      runtimeSnapshot: {bookletEntries: ['A', 'B'].map(name => ({bookletKey: 'ORACLE.BOOK.' + name, displayLabel: 'Booklet ' + name, policy: compileBookletRuntimePolicy({}), testletEntries: [],
        unitEntries: [1, 2].map(index => ({unitKey: name + index, originalUnitId: 'ORIGINAL.' + name + index, displayLabel: name + index, content: 'Owned Unit'}))}))}});
    const roster = (group = frozen.groupName, label = frozen.groupLabel) => `<Testtakers xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/testcenter-testtaker-xml/18.0"><Metadata/><Group id="${group}" label="${label}"><Login name="owned-results-person" pw="Owned-results-secret" mode="run-hot-return"><Booklet codes="AbC">ORACLE.BOOK.A</Booklet><Booklet codes="AbC">ORACLE.BOOK.B</Booklet></Login></Group></Testtakers>`;
    const upload = (group, label) => services.workspaceAdminRead.importParticipantRoster({...scope, rosterText: roster(group, label)});
    const login = () => services.originalAuthentication.login({name: 'owned-results-person', password: 'Owned-results-secret'});
    const read = groups => services.originalGroupResults.list({...scope, ...(groups === undefined ? {} : {groups})});
    const readOverview = () => services.workspaceAdminRead.listGroupResults(scope);
    const overviewMetrics = row => [row.bookletsStarted, row.numUnitsMin, row.numUnitsMax, row.numUnitsTotal, row.numUnitsAvg];
    await upload(); clock = 1;
    const credential = await login();
    await t.test('credential-only and person-only groups have no started result row', async () => {
      assert.deepEqual(await read(), []); clock = 2;
      person = (await services.originalAuthentication.person({loginToken: credential.token, code: 'abc'})).participantSession;
      assert.deepEqual(await read(), []);
    });
    await t.test('a truly opened Booklet counts with zero Units; a pre-created unopened Test does not', async () => {
      clock = 3; first = await services.participantRuntime.launch({participantSessionId: person.participantSessionId, bookletKey: 'ORACLE.BOOK.A'});
      second = {...first, testRunId: randomUUID(), bookletKey: 'ORACLE.BOOK.B', bookletAssignmentKey: 'ORACLE.BOOK.B', status: 'created', currentUnitKey: 'B1', unitResponses: {},
        originalResultState: {bookletName: 'ORACLE.BOOK.B', bookletLabel: 'Booklet B', lastOpenedAt: null, lastTestStateAt: null, hasTestState: false, lastTestModifiedAt: null}};
      delete second.controllerEntry; delete second.controllerDispatches; delete second.stateRevision;
      await repository.saveTestRun(second);
      const [row] = await read(); assert.equal(row.bookletsStarted, 1); assert.equal(row.numUnitsTotal, 0); assert.equal(row.lastChange, seconds(3));
      assert.deepEqual(Object.keys(row).sort(), Object.keys(nativeCase.result).sort());
      const [overview] = await readOverview();
      assert.deepEqual(overviewMetrics(overview), [1, 0, 0, 0, 0]);
      assert.equal(Date.parse(overview.lastChangeAt), seconds(3) * 1000);
    });
    await t.test('saved state/review Units count without answers, including a deleted review, and Unit writes do not advance Test time', async () => {
      clock = 4; await services.participantRuntime.saveProgress({testRunId: first.testRunId, status: 'running', responseOnly: true, responseUnitKey: 'A1', unitResponse: privateResponse});
      assert.equal((await read())[0].lastChange, seconds(3));
      clock = 5; second = await services.participantRuntime.launch({participantSessionId: person.participantSessionId, bookletKey: 'ORACLE.BOOK.B'});
      clock = 6; const comment = await services.workspaceReview.createReview({...scope, participantSessionId: person.participantSessionId, testRunId: second.testRunId, unitKey: 'B1', reviewerId: 'owned', category: 'quality', comment: 'Owned review-only Unit'});
      clock = 7; await services.workspaceReview.deleteReview({...scope, reviewId: comment.review.reviewId});
      clock = 8; await services.participantRuntime.saveProgress({testRunId: second.testRunId, status: 'running', responseOnly: true, responseUnitKey: 'B2', unitResponse: JSON.stringify({kind: 'verona_unit_state', version: 1, unitState: {presentationProgress: 'some'}})});
      const [row] = await read(); assert.deepEqual([row.bookletsStarted, row.numUnitsMin, row.numUnitsMax, row.numUnitsTotal, row.numUnitsAvg],
        [stats.openedBooklets, stats.minimum, stats.maximum, stats.savedUnits, stats.average]);
      assert.equal(row.lastChange, seconds(5));
      await repository.saveParticipantTestLogs([{...ids, participantSessionId: person.participantSessionId, testRunId: first.testRunId, participantTestLogId: randomUUID(),
        unitKey: 'uninitialized-arbitrary-log', originalUnitId: null, logKey: 'OWNED', logContent: 'does not create a Unit', timestamp: Date.parse(stamp(99)), recordedAt: stamp(99)}]);
      assert.deepEqual(await read(), [row]);
      const [overview] = await readOverview();
      assert.deepEqual(overviewMetrics(overview), overviewMetrics(row));
      assert.equal(Date.parse(overview.lastChangeAt), seconds(5) * 1000);
      assert.equal(overview.responseCount, 2);
      assert.ok(overview.testLogCount > 0);
    });
    await t.test('current raw group spelling uses the binding while first label and the Test-only clock remain frozen', async () => {
      clock = 10; await upload(frozen.groupName, frozen.reimportedLabel); await login();
      assert.equal((await read())[0].groupLabel, frozen.groupLabel); assert.equal((await read())[0].lastChange, seconds(5));
      assert.equal((await readOverview())[0].groupLabel, frozen.groupLabel);
      clock = 11; const lower = frozen.groupName.toLowerCase(); await upload(lower, frozen.reimportedLabel); await login();
      const [row] = await read(); assert.equal(row.groupName, lower); assert.equal(row.groupLabel, frozen.groupLabel);
      assert.deepEqual(await read([]), [row]); assert.deepEqual(await read([frozen.groupName]), [row]); assert.deepEqual(await read([' ' + lower]), []); assert.deepEqual(await read(['missing']), []);
    });
    await t.test('metadata reads cannot load full private Run payloads and leave all stored data unchanged across reopen', async () => {
      // Establish File's persisted JSON shape before taking the exact snapshot;
      // JavaScript-only undefined fields are absent after its ordinary reopen.
      if (kind === 'file') {await close(); await open();}
      const before = await repository.listTestRunsByWorkspace(...Object.values(ids));
      const forbidden = new Proxy(repository, {get(target, key) {
        if (['listTestRunsByWorkspace', 'listParticipantSessionsByWorkspace', 'listOriginalLoginBindingsByWorkspace', 'listOriginalParticipantGroupsByWorkspace', 'listWorkspaceReviewsByWorkspace', 'listWorkspaceActivityEventsByWorkspace'].includes(key)) return () => assert.fail('Native statistics require one owned snapshot, without independent reads or complete Runs');
        const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
      }});
      const projected = createFirstSliceServices({repository: forbidden}).originalGroupResults;
      const parser = JSON.parse, pgParser = pgTypes.getTypeParser(3802);
      if (kind === 'sqlite' || kind === 'postgres') JSON.parse = (...args) => {
        if (typeof args[0] === 'string' && args[0].includes(privateResponse)) throw Error('Owned private result decoder fence'); return parser(...args);
      };
      if (kind === 'postgres') pgTypes.setTypeParser(3802, text => {if (text.includes(privateResponse)) throw Error('Owned private result decoder fence'); return pgParser(text);});
      let rows;
      try {
        if (kind === 'sqlite' || kind === 'postgres') await assert.rejects(repository.getTestRunById(first.testRunId), /Owned private result decoder fence/);
        rows = await projected.list(scope); assert.equal(rows[0].numUnitsTotal, 3);
      } finally {JSON.parse = parser; if (kind === 'postgres') pgTypes.setTypeParser(3802, pgParser);}
      const metadata = (await repository.getOriginalGroupResultInventory(...Object.values(ids))).runs;
      assert.ok(metadata.every(row => !('unitResponses' in row) && !('testletTimers' in row)));
      assert.equal(JSON.stringify(metadata).includes(privateResponse), false);
      assert.deepEqual(await repository.listTestRunsByWorkspace(...Object.values(ids)), before);
      await close(); await open(); assert.deepEqual(await read(), rows); assert.deepEqual(await repository.listTestRunsByWorkspace(...Object.values(ids)), before);
    });
    await t.test('unknown Test clocks and duplicate native identities refuse rather than inventing historical statistics', async () => {
      for (const alter of [rows => rows.map((row, index) => index ? row : {...row, lastTestModifiedAt: undefined}), rows => [...rows, {...rows[0], testRunId: 'duplicate-owned-test'}]]) {
        const guarded = new Proxy(repository, {get(target, key) {
          if (key === 'getOriginalGroupResultInventory') return async (...args) => {const inventory = await target[key](...args); return {...inventory, runs: alter(inventory.runs)};};
          const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
        }});
        await assert.rejects(createFirstSliceServices({repository: guarded}).originalGroupResults.list(scope), historyError);
      }
      assert.equal((await read())[0].numUnitsTotal, 3);
    });
    await t.test('a queued selected-group array cannot be changed by the caller after submission', async () => {
      let release, entered; const gate = new Promise(done => {release = done;}), entry = new Promise(done => {entered = done;});
      const port = createOriginalGroupResultsPort(repository, async () => {entered(); await gate; return ids;});
      const groups = [frozen.groupName], pending = port.list({...scope, groups}); await entry; groups[0] = 'missing'; release();
      assert.equal((await pending)[0].numUnitsTotal, 3);
    });
    await t.test('moving the native Login moves its existing Tests and uses the new group snapshot time', async () => {
      clock = 12; await upload('ORACLE.NEXT', 'Next frozen group'); await login();
      assert.deepEqual(await read([frozen.groupName]), []);
      const [row] = await read(); assert.equal(row.groupName, 'ORACLE.NEXT'); assert.equal(row.groupLabel, 'Next frozen group'); assert.equal(row.lastChange, seconds(12)); assert.equal(row.numUnitsTotal, 3);
    });
    if (kind === 'sqlite' || kind === 'postgres') await t.test('real protected HTTP returns the exact native array and refuses anonymous and foreign-workspace readers', async () => {
      const administration = createFirstSliceServices({repository}), password = 'Owned-native-results-admin-2026!';
      const initial = await administration.adminAuth.bootstrapAdminUser({username: 'owned-results-admin', password});
      const foreign = await services.platform.createWorkspace({tenantKey: scope.tenantKey, workspaceKey: 'foreign', displayName: 'Owned foreign workspace'});
      const workspaceNumber = await repository.getOrCreateOriginalWorkspaceNumber(ids);
      const tokens = {};
      for (const [name, workspaceId] of [['owned-reader', ids.workspaceId], ['foreign-reader', foreign.workspaceId]]) {
        const adminUserId = randomUUID();
        await repository.saveAdminUser({...initial.adminUser, adminUserId, username: name});
        await repository.saveAdminRoleAssignment({roleAssignmentId: randomUUID(), adminUserId, role: 'workspace_admin', accessMode: 'read_only',
          tenantId: ids.tenantId, workspaceId, groupKey: null, monitorProfiles: [], monitorBookletVisibility: 'visible', createdAt: new Date().toISOString()});
        tokens[name] = (await administration.adminAuth.signIn({username: name, password})).adminSession.token;
        assert.equal(typeof tokens[name], 'string');
      }
      const environment = {FIRST_SLICE_STORE: kind, FIRST_SLICE_SQLITE_FILE: file, FIRST_SLICE_BOOTSTRAP_DEMO: 'false', FIRST_SLICE_OPERATOR_AUTH_REQUIRED: 'true',
        FIRST_SLICE_XML_SCHEMA_PROFILE: 'original-19', FIRST_SLICE_PROOF_OF_WORK_SCOPES: '', ...(url ? {FIRST_SLICE_POSTGRES_URL: url.toString()} : {})};
      const previous = new Map(Object.keys(environment).map(key => [key, process.env[key]]));
      let server;
      const before = await repository.listTestRunsByWorkspace(...Object.values(ids));
      try {
        try {Object.assign(process.env, environment); server = await createProductionApiServer();}
        finally {for (const [key, value] of previous) {if (value === undefined) delete process.env[key]; else process.env[key] = value;}}
        await new Promise(done => server.listen(0, '127.0.0.1', done));
        const base = 'http://127.0.0.1:' + server.address().port;
        const path = `/api/v1/tenants/${scope.tenantKey}/workspaces/${scope.workspaceKey}/results/original-groups`;
        const get = async (token, query = '', expected = 200) => {
          const response = await fetch(base + path + query, {headers: token ? {authorization: 'Bearer ' + token} : {}, signal: AbortSignal.timeout(15_000)});
          assert.equal(response.status, expected); const value = await response.json();
          if (expected === 200) assert.equal(response.headers.get('cache-control'), 'private, no-store');
          return value;
        };
        await get(undefined, '', 401); await get('invalid-owned-token', '', 401); await get(tokens['foreign-reader'], '', 403);
        const rows = await get(tokens['owned-reader']); assert.deepEqual(rows, await read());
        assert.deepEqual(await get(tokens['owned-reader'], '?groups='), rows);
        assert.deepEqual(await get(tokens['owned-reader'], '?groups=oracle.next'), rows);
        assert.deepEqual(await get(tokens['owned-reader'], '?groups=%20ORACLE.NEXT'), []);
        assert.deepEqual(await get(tokens['owned-reader'], '?groups=missing'), []);
        assert.equal(JSON.stringify(rows).includes(privateResponse), false);

        const nativePath = '/workspace/' + workspaceNumber + '/results';
        const nativeGet = async (token, query, status, expected) => {
          const response = await fetch(base + nativePath + query, {
            headers: token ? {AuthToken: token} : {}, signal: AbortSignal.timeout(15_000)
          });
          assert.equal(response.status, status, query);
          assert.equal(response.headers.get('cache-control'), 'private, no-store');
          if (status === 200) assert.deepEqual(await response.json(), expected, query);
        };
        const reader = tokens['owned-reader'];
        await nativeGet(undefined, '?groups=ORACLE.NEXT', 401);
        await nativeGet(tokens['foreign-reader'], '?groups=ORACLE.NEXT', 404);
        await nativeGet(reader, '?groups=%20ORACLE.NEXT', 200, []);
        await nativeGet(reader, '?groups=', 200, rows);
        await nativeGet(reader, '?groups=oracle.next,missing', 200, rows);
        await nativeGet(reader, '?groups=ORACLE.NEXT&groups=missing', 200, []);
        await nativeGet(reader, '?groups=ORACLE.NEXT&groups[]=missing', 500);
        await nativeGet(reader, '?groups[]=missing&groups=oracle.next', 200, rows);
      } finally {
        if (server) await new Promise((done, reject) => server.close(error => error && error.code !== 'ERR_SERVER_NOT_RUNNING' ? reject(error) : done()));
      }
      assert.deepEqual(await repository.listTestRunsByWorkspace(...Object.values(ids)), before);
    });
    await t.test('a completed inventory is immutable while a real Login move and Unit write overtake its projection', async () => {
      const before = await read();
      let release, entered; const gate = new Promise(done => {release = done;}), entry = new Promise(done => {entered = done;});
      const delayed = new Proxy(repository, {get(target, key) {
        if (key === 'getOriginalGroupResultInventory') return async (...args) => {const inventory = await target[key](...args); entered(); await gate; return inventory;};
        const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
      }});
      const pending = createFirstSliceServices({repository: delayed}).originalGroupResults.list(scope);
      try {
        await entry;
        clock = 13; await services.participantRuntime.saveProgress({testRunId: first.testRunId, status: 'running', responseOnly: true, responseUnitKey: 'A2', unitResponse: 'Owned later Unit'});
        clock = 14; await upload('ORACLE.ATOMIC', 'Atomic group'); await login();
      } finally {release();}
      assert.deepEqual(await pending, before);
      const [after] = await read(); assert.equal(after.groupName, 'ORACLE.ATOMIC'); assert.equal(after.numUnitsTotal, 4); assert.equal(after.lastChange, seconds(14));
    });
    await t.test('canonical extensions and foreign review evidence cannot manufacture native result history', async () => {
      const before = await read(), id = randomUUID();
      await repository.saveParticipantSession({...ids, contentReleaseId: release, participantSessionId: id, loginKey: 'canonical-extension', groupKey: 'Canonical.Extension', status: 'launched', createdAt: stamp(90)});
      await repository.saveTestRun({...ids, contentReleaseId: release, participantSessionId: id, testRunId: id, bookletKey: 'ORACLE.BOOK.A',
        executionMode: 'run-hot-return', status: 'running', currentUnitKey: 'A1', unitResponses: {A1: privateResponse}, createdAt: stamp(90), updatedAt: stamp(99), completedAt: null});
      assert.deepEqual(await read(), before);
      const extension = (await readOverview()).find(row => row.groupKey === 'Canonical.Extension');
      assert.deepEqual(overviewMetrics(extension), [1,1,1,1,1]);
      assert.equal(extension.lastChangeAt, stamp(99));
      const guarded = new Proxy(repository, {get(target, key) {
        if (key === 'getOriginalGroupResultInventory') return async (...args) => {
          const inventory = await target[key](...args), alien = {...ids, workspaceId: 'foreign-owned-workspace'};
          return {...inventory, reviews: [...inventory.reviews,
            {...alien, participantSessionId: person.participantSessionId, testRunId: first.testRunId, unitKey: 'foreign-review'},
            {...ids, participantSessionId: 'foreign-person', testRunId: first.testRunId, unitKey: 'foreign-person-review'}],
            events: [...inventory.events, {...alien, eventType: 'review_created', subjectType: 'test_run', subjectId: first.testRunId, occurredAt: stamp(99),
              details: {reviewId: 'owned-alien-review', participantSessionId: person.participantSessionId, unitKey: 'foreign-event'}}]};
        };
        const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
      }});
      assert.deepEqual(await createFirstSliceServices({repository: guarded}).originalGroupResults.list(scope), before);
    });
    await t.test('native response parts affect the group and deletion count once per Unit across reopen', async () => {
      const groupKey = 'ORACLE.ATOMIC';
      const overview = async () => (await readOverview()).find(row => row.groupKey === groupKey);
      const survivor = (await readOverview()).find(row => row.groupKey === 'Canonical.Extension');
      const before = await overview();
      const unit = {...ids, participantSessionId: first.participantSessionId, testRunId: first.testRunId,
        contentReleaseId: release, unitName: 'NATIVE.ONLY'};
      const responseFilter = {...scope, groupKeys: [groupKey], testRunId: first.testRunId};
      const getDetails = unitKey => services.workspaceAdminRead.listDetailedResponses({...responseFilter, unitKey});
      const putParts = (parts, unknownHistory) => repository.mutateOriginalUnit(unit, () => ({
        unit: {...unit, originalUnitId: 'ORIGINAL.A1', stateInitialized: true,
          state: {}, stateClocks: {}, parts, ...(unknownHistory ? {unknownHistory} : {})},
        logs: []
      }));
      await putParts([]);
      const stateOnly = await overview();
      assert.equal(stateOnly.numUnitsTotal, before.numUnitsTotal + 1);
      assert.equal(stateOnly.responseCount, before.responseCount);
      assert.deepEqual(await getDetails(unit.unitName), []);
      const parts = [
        {id: 'left', content: privateResponse, ts: Date.parse(stamp(16)), responseType: 'iqb@1.0'},
        {id: 'right', content: null, ts: Date.parse(stamp(16)), responseType: 'iqb@1.0'},
        {id: 'empty', content: '', ts: Date.parse(stamp(16)), responseType: 'iqb@1.0'}
      ];
      await putParts(parts, true);
      assert.equal((await overview()).responseCount, before.responseCount);
      assert.deepEqual(await getDetails(unit.unitName), []);
      await putParts(parts);
      await close();
      await open();
      const answered = await overview();
      assert.equal(answered.responseCount, before.responseCount + 1);
      assert.equal(answered.numUnitsTotal, stateOnly.numUnitsTotal);
      assert.equal(answered.lastChangeAt, before.lastChangeAt);
      const projection = await repository.getOriginalGroupResultInventory(...Object.values(ids));
      assert.equal(JSON.stringify(projection).includes(privateResponse), false);

      const details = await getDetails(unit.unitName);
      assert.equal(details.length, 1);
      const [detail] = details;
      assert.equal(detail.unitKey, unit.unitName);
      assert.equal(detail.participantSessionId, first.participantSessionId);
      assert.equal(detail.groupKey, groupKey);
      assert.equal(detail.responseLength, detail.response.length);
      const response = JSON.parse(detail.response);
      assert.equal(response.kind, 'verona_unit_state');
      assert.deepEqual(response.unitState, {
        dataParts: {left: privateResponse, right: 'null', empty: ''},
        unitStateDataType: 'iqb@1.0'
      });
      assert.deepEqual(response.dataPartValueTypes, {left: 'string', right: 'json', empty: 'string'});
      const csv = await services.workspaceAdminRead.exportResponseCsv({...responseFilter, unitKey: unit.unitName});
      assert.equal(csv.trimEnd().split('\n').length, 2);
      assert.ok(csv.includes('"' + detail.response.replaceAll('"', '""') + '"'));
      const legacy = await services.workspaceAdminRead.listDetailedResponses({...scope, groupKey: survivor.groupKey});
      assert.equal(legacy.length, 1);
      assert.equal(legacy[0].response, privateResponse);

      const persistedRun = (await repository.listTestRunsByWorkspace(ids.tenantId, ids.workspaceId))
        .find(run => run.testRunId === first.testRunId);
      const existingKey = 'native.only';
      await repository.saveTestRun({...persistedRun, unitResponses: {...persistedRun.unitResponses,
        [existingKey]: 'Old canonical answer for the same Unit'}});
      const [updated] = await getDetails(existingKey);
      assert.equal(updated.response, 'Old canonical answer for the same Unit');
      assert.deepEqual(await getDetails(unit.unitName), []);

      await putParts(parts);
      const [aliased] = await getDetails(existingKey);
      assert.equal(aliased.unitKey, existingKey);
      assert.equal(aliased.response, detail.response);
      assert.deepEqual(await getDetails(unit.unitName), []);
      assert.equal((await overview()).responseCount, answered.responseCount);

      const deletion = await services.workspaceResults.deleteGroupResultsBulk({
        ...scope, groupKeys: [groupKey], confirmation: scope.workspaceKey
      });
      assert.equal(deletion.deletedTestRunCount, before.bookletsStarted);
      assert.equal(deletion.deletedResponseCount, answered.responseCount);
      await close();
      await open();
      assert.equal(await overview(), undefined);
      assert.deepEqual((await readOverview()).find(row => row.groupKey === survivor.groupKey), survivor);
    });
    await t.test('opened canonical Runs include review-only Units and use the Test clock', async () => {
      const participantSessionId = randomUUID();
      const groupKey = 'Canonical.Opened';
      await repository.saveParticipantSession({...ids, contentReleaseId: release, participantSessionId,
        loginKey: 'owned-opened-canonical', groupKey, status: 'launched', createdAt: stamp(20)});
      const run = {...ids, contentReleaseId: release, participantSessionId, testRunId: randomUUID(),
        bookletKey: 'ORACLE.BOOK.A', executionMode: 'run-hot-return', status: 'created',
        currentUnitKey: 'A1', unitResponses: {}, createdAt: stamp(20), updatedAt: stamp(20), completedAt: null,
        originalResultState: {bookletName: 'ORACLE.BOOK.A', bookletLabel: 'Booklet A',
          lastOpenedAt: null, lastTestStateAt: null, hasTestState: false, lastTestModifiedAt: stamp(20)}};
      const overview = async () => (await readOverview()).find(row => row.groupKey === groupKey);
      await repository.saveTestRun(run);
      assert.equal(await overview(), undefined);

      const started = {...run, status: 'running', updatedAt: stamp(21),
        originalResultState: {...run.originalResultState, lastOpenedAt: stamp(21), lastTestModifiedAt: stamp(21)}};
      await repository.saveTestRun(started);
      assert.deepEqual(overviewMetrics(await overview()), [1, 0, 0, 0, 0]);
      clock = 22;
      const {review} = await services.workspaceReview.createReview({...scope, participantSessionId,
        testRunId: run.testRunId, unitKey: 'A2', reviewerId: 'owned', category: 'quality', comment: 'Owned canonical review'});
      assert.deepEqual(overviewMetrics(await overview()), [1, 1, 1, 1, 1]);
      assert.equal((await overview()).responseCount, 0);
      await repository.saveTestRun({...started, updatedAt: stamp(23), unitResponses: {A1: privateResponse}});
      await services.workspaceReview.deleteReview({...scope, reviewId: review.reviewId});
      await close();
      await open();
      const answered = await overview();
      assert.deepEqual(overviewMetrics(answered), [1, 2, 2, 2, 2]);
      assert.equal(answered.responseCount, 1);
      assert.equal(answered.reviewCount, 0);
      assert.equal(answered.lastChangeAt, stamp(21));
    });
  } finally {
    await close();
    if (created) {assert.equal(Number((await admin.query('SELECT count(*) AS count FROM pg_stat_activity WHERE application_name=$1', [schema])).rows[0].count), 0); await admin.query(`DROP SCHEMA "${schema}" CASCADE`);}
    await admin?.end(); await rm(directory, {recursive: true, force: true});
  }
});
