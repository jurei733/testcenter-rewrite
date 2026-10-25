import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp, readFile, rename, mkdir, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {Pool, Client, types as pgTypes} from 'pg';
import {setTimeout as delay} from 'node:timers/promises';
import {createFirstSliceServices, hashOriginalSessionToken, selectOriginalGroupDeletionKeys, attachmentTestRunId} from '@testcenter-rewrite-app/application';
import {compileBookletRuntimePolicy} from '@testcenter-rewrite-app/contracts';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceStorage} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceStorage} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';
import {prepareOriginalXmlSchemaValidator} from '../packages/application/dist/packages/application/src/original-xml-schema.js';
import {createOriginalGroupResultsPort} from '../packages/application/dist/packages/application/src/original-group-results.js';
import {createProductionApiServer} from '../apps/api/dist/apps/api/src/index.js';

const validator = await prepareOriginalXmlSchemaValidator(resolve(process.env.FIRST_SLICE_XML_SCHEMA_CACHE || '.data/original-xml-schemas'), process.env.FIRST_SLICE_XML_SCHEMA_DOWNLOAD !== 'false');
const kinds = ['memory', 'file', 'sqlite'];
if (process.env.FIRST_SLICE_STORE === 'postgres') {assert.ok(process.env.FIRST_SLICE_POSTGRES_URL); kinds.push('postgres');}
const stamp = '2026-10-25T13:30:00.000Z', privatePayload = 'OWNED_PRIVATE_NATIVE_DELETE_Ω';
const unavailable = error => error.statusCode === 409 && error.errorCode === 'result_parent_scope_changed';
const stable = value => JSON.parse(JSON.stringify(value));
const order = rows => stable(rows).sort((a,b) => JSON.stringify(a).localeCompare(JSON.stringify(b)));

test('large native selections retain qualified German equality without quadratic group scans or a small selection cap', {timeout:10000}, () => {
  const groups=Array.from({length:50001},(_,n)=>({groupKey:'Owned.Group.'+n}));
  const selected=groups.filter((_,n)=>n%2===0).map(row=>row.groupKey.toLowerCase());
  assert.deepEqual(selectOriginalGroupDeletionKeys({tenantId:'owned',workspaceId:'owned',groups:selected},groups),groups.filter((_,n)=>n%2===0).map(row=>row.groupKey));
  assert.deepEqual(selectOriginalGroupDeletionKeys({tenantId:'owned',workspaceId:'owned',groups:['E\u0301','Ä',' raw']},[{groupKey:'é'},{groupKey:'a'},{groupKey:'ä'},{groupKey:'raw'}]),['é','ä']);
  for(const tuple of [['owned-run','unit','variable'],['owned-run','','']]) assert.equal(attachmentTestRunId('att-'+Buffer.from(JSON.stringify(tuple)).toString('base64url')),'owned-run');
  for(const tuple of [[],['','unit','variable'],['owned-run',null,'variable']]) assert.equal(attachmentTestRunId('att-'+Buffer.from(JSON.stringify(tuple)).toString('base64url')),null);
});

for (const kind of kinds) test(`${kind}: native group deletion removes sessions and capabilities atomically without touching moved or canonical data`, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'owned-native-cascade-')), file = join(directory, kind === 'file' ? 'state.json' : 'state.sqlite');
  const schema = 'owned_native_delete_' + randomUUID().replaceAll('-', ''), url = kind === 'postgres' ? new URL(process.env.FIRST_SLICE_POSTGRES_URL) : null;
  url?.searchParams.set('options', '-c search_path=' + schema); url?.searchParams.set('application_name', schema);
  let storage, repository, services, pool, control, created = false;
  const open = async () => {
    storage = kind === 'memory' ? storage ?? {repository: createInMemoryFirstSliceRepository(), shutdown: async () => {}}
      : kind === 'file' ? await createFileFirstSliceStorage(file) : kind === 'sqlite' ? createSqliteFirstSliceStorage(file) : await createPostgresFirstSliceStorage(url.toString());
    repository = storage.repository; services = createFirstSliceServices({repository, now: () => stamp, originalXmlSchemaValidator: validator});
  };
  const reopen = async () => {if (kind !== 'memory') {await storage.shutdown(); storage = undefined; await open();}};
  try {
    if (url) {pool = new Pool({connectionString: process.env.FIRST_SLICE_POSTGRES_URL}); await pool.query(`CREATE SCHEMA "${schema}"`); created = true;}
    await open();
    const tenant = await services.platform.createTenant({tenantKey: 'owned-' + randomUUID(), displayName: 'Owned cascade'});
    const workspace = await services.platform.createWorkspace({tenantKey: tenant.tenantKey, workspaceKey: 'owned', displayName: 'Owned cascade'});
    const scope = {tenantKey: tenant.tenantKey, workspaceKey: 'owned'}, ids = {tenantId: tenant.tenantId, workspaceId: workspace.workspaceId};
    const release = randomUUID();
    const content = {...ids, contentReleaseId: release, importJobId: release, releaseLabel: 'Owned cascade', status: 'active', createdAt: stamp, activatedAt: stamp,
      runtimeSnapshot: {bookletEntries: [{bookletKey: 'ORACLE.POW.BOOK', displayLabel: 'Owned Booklet', policy: compileBookletRuntimePolicy({}), testletEntries: [],
        unitEntries: [{unitKey: 'ORACLE.POW.UNIT', originalUnitId: 'ORACLE.POW.UNIT', displayLabel: 'Owned Unit'}]}]}};
    // Strict native XML/authentication with an explicitly seeded owned release;
    // production Source21/XSD HTTP evidence is retained separately.
    await repository.saveContentRelease(content);
    const groups = [ ['ORACLE.DELETE.MAIN', 'First deletion label', ['owned-delete-main', 'owned-delete-peer']],
      ['ORACLE.DELETE.KEEP', 'Retained label', ['owned-delete-keep']], ['ORACLE.DELETE.FORMER', 'Former label', ['owned-delete-moved']],
      ['ORACLE.DELETE.EMPTY', 'Empty native group', ['owned-delete-empty']] ];
    const document = rows => '<Testtakers xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/testcenter-testtaker-xml/18.0"><Metadata/>' +
      rows.map(([id,label,names]) => `<Group id="${id}" label="${label}">` + names.map(name => `<Login name="${name}" pw="Owned-cascade-secret" mode="run-trial"><Booklet codes="Shared Other Unopened">ORACLE.POW.BOOK</Booklet></Login>`).join('') + '</Group>').join('') + '</Testtakers>';
    const upload = rows => services.workspaceAdminRead.importParticipantRoster({...scope, rosterText: document(rows)});
    const trackedTokens = [], trackedPeople = [];
    const authenticate = async (name, code = 'Shared') => {
      const login = await services.originalAuthentication.login({name, password: 'Owned-cascade-secret'});
      const person = await services.originalAuthentication.person({loginToken: login.token, code});
      trackedTokens.push(login.token,login.groupToken,person.token,person.groupToken); trackedPeople.push(person.participantSession.participantSessionId);
      return {login, person};
    };
    const seed = async (name, code) => {
      const result = await authenticate(name, code), person = result.person.participantSession;
      const run = await services.participantRuntime.launch({participantSessionId: person.participantSessionId, bookletKey: 'ORACLE.POW.BOOK'});
      const deliveryId = randomUUID();
      await services.participantRuntime.saveProgress({testRunId: run.testRunId, status: 'running', responseOnly: true, responseUnitKey: 'ORACLE.POW.UNIT', unitResponse: privatePayload, deliveryId});
      const review = (await services.workspaceReview.createReview({...scope, participantSessionId: person.participantSessionId, testRunId: run.testRunId,
        unitKey: 'ORACLE.POW.UNIT', reviewerId: 'Owned reviewer', category: 'owned', comment: 'Owned private review'})).review;
      assert.ok(await repository.appendParticipantRunCommand({...run, commandId: randomUUID(), commandType: 'pause', actorId: null, targetUnitKey: null, remainingSeconds: null, issuedAt: stamp}));
      assert.equal((await repository.listPendingParticipantRunCommands(run)).length,1);
      assert.equal((await repository.updateParticipantPresence({testRunId: run.testRunId, participantSessionId: person.participantSessionId, action: 'poll', timestamp: Date.parse(stamp)})).accepted,true);
      const attachment = {...ids, attachmentFileId: randomUUID(), attachmentId: 'att-' + Buffer.from(JSON.stringify([run.testRunId, 'ORACLE.POW.UNIT', 'owned-variable'])).toString('base64url'),
        fileName: 'owned.png', mediaType: 'image/png', dataBase64: Buffer.from('Owned private attachment').toString('base64'), createdAt: stamp};
      await repository.saveAttachmentFile(attachment);
      const saved = await repository.getTestRunById(run.testRunId); assert.equal(saved.unitResponses['ORACLE.POW.UNIT'], privatePayload);
      let receipt; await repository.mutateParticipantRun({...saved,deliveryId},context=>{receipt=context.progressDelivery;return null;}); assert.equal(receipt.deliveryId,deliveryId);
      return {...result, run: saved, review, attachment, deliveryId};
    };
    const snapshot = async () => ({groups: order(await repository.listOriginalParticipantGroupsByWorkspace(ids.tenantId, ids.workspaceId)),
      bindings: order(await repository.listOriginalLoginBindingsByWorkspace(ids.tenantId, ids.workspaceId)), people: order(await repository.listParticipantSessionsByWorkspace(ids.tenantId, ids.workspaceId)),
      runs: order(await repository.listTestRunsByWorkspace(ids.tenantId, ids.workspaceId)), reviews: order(await repository.listWorkspaceReviewsByWorkspace(ids.tenantId, ids.workspaceId)),
      logs: order(await repository.listParticipantTestLogsByWorkspace(ids.tenantId, ids.workspaceId)), events: order(await repository.listWorkspaceActivityEventsByWorkspace(ids.tenantId, ids.workspaceId)),
      files: order(await repository.listAttachmentFilesByWorkspace(ids.tenantId, ids.workspaceId)), roster: order(await repository.listParticipantRosterEntriesByWorkspace(ids.tenantId, ids.workspaceId)),
      release: stable(await repository.getContentReleaseById(release)), capabilities: await Promise.all([...new Set(trackedTokens)].map(token=>repository.findOriginalSessionTokenByHash(hashOriginalSessionToken(token)))),
      credentials: await Promise.all([...new Set(trackedPeople)].map(id=>repository.getParticipantAccessCredential(id)))});
    await upload(groups);
    const main = await seed('owned-delete-main'), second = await seed('owned-delete-main', 'Other'), peer = await seed('owned-delete-peer'), kept = await seed('owned-delete-keep'), moved = await seed('owned-delete-moved');
    const unopened = await authenticate('owned-delete-main','Unopened');
    const empty = await services.originalAuthentication.login({name: 'owned-delete-empty', password: 'Owned-cascade-secret'}); trackedTokens.push(empty.token,empty.groupToken);
    const canonical = {...ids, contentReleaseId: release, participantSessionId: randomUUID(), loginKey: 'canonical-owned', groupKey: 'ORACLE.DELETE.MAIN', status: 'launched', createdAt: stamp};
    await repository.saveParticipantSession(canonical);
    const canonicalRun = {...main.run, testRunId: randomUUID(), participantSessionId: canonical.participantSessionId}; await repository.saveTestRun(canonicalRun);
    const foreign = await services.platform.createWorkspace({tenantKey: scope.tenantKey, workspaceKey: 'foreign', displayName: 'Owned foreign scope'});
    const foreignRelease=randomUUID(); await repository.saveContentRelease({...content,workspaceId:foreign.workspaceId,contentReleaseId:foreignRelease,importJobId:foreignRelease});
    await services.workspaceAdminRead.importParticipantRoster({tenantKey:scope.tenantKey,workspaceKey:'foreign',rosterText:document([['ORACLE.DELETE.MAIN','Foreign snapshot',['owned-delete-foreign']]])});
    const foreignAuth=await authenticate('owned-delete-foreign');
    const foreignRun=await services.participantRuntime.launch({participantSessionId:foreignAuth.person.participantSession.participantSessionId,bookletKey:'ORACLE.POW.BOOK'});
    const changed = groups.map(row => row[0] === 'ORACLE.DELETE.FORMER' ? ['ORACLE.DELETE.NEXT', 'Moved label', row[2]] : row);
    await upload(changed); const movedLogin = await services.originalAuthentication.login({name: 'owned-delete-moved', password: 'Owned-cascade-secret'});
    assert.equal(movedLogin.token, moved.login.token);
    await reopen();
    const foreignBefore = {groups:await repository.listOriginalParticipantGroupsByWorkspace(ids.tenantId,foreign.workspaceId),person:await repository.getParticipantSessionById(foreignRun.participantSessionId),run:await repository.getTestRunById(foreignRun.testRunId)};
    await t.test('unknown, empty and untrimmed selections preserve the entire state; malformed input is rejected', async () => {
      const before = await snapshot();
      for (const names of [[], ['unknown'], [' ORACLE.DELETE.MAIN'], Array.from({length: 101}, (_, n) => 'unknown-' + n)]) await services.originalGroupResults.delete({...scope, groups: names});
      for (const names of [undefined, null, 'ORACLE.DELETE.MAIN', [1]]) await assert.rejects(services.originalGroupResults.delete({...scope, groups: names}), error => error.statusCode === 400);
      assert.deepEqual(await snapshot(), before);
    });
    await t.test('an obsolete group snapshot does not own already moved Login/person/Test data', async () => {
      await services.originalGroupResults.delete({...scope, groups: ['ORACLE.DELETE.FORMER']});
      assert.ok(await repository.getTestRunById(moved.run.testRunId));
      assert.equal((await services.originalAuthentication.read({token: moved.person.token})).participantSession.participantSessionId, moved.person.participantSession.participantSessionId);
    });
    if (kind !== 'memory') await t.test('a late durable failure rolls back all descendants and capabilities and survives reopen', async () => {
      const before = await snapshot();
      if (kind === 'file') {await rename(file, file + '.owned-backup'); await mkdir(file);}
      else if (kind === 'sqlite') {control = new DatabaseSync(file); control.exec("CREATE TRIGGER owned_native_delete_failure BEFORE DELETE ON original_participant_groups BEGIN SELECT RAISE(ABORT, 'owned late cascade failure'); END");}
      else {control = new Pool({connectionString: url.toString()}); await control.query("CREATE FUNCTION owned_native_delete_failure() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'owned late cascade failure'; END; $$; CREATE TRIGGER owned_native_delete_failure BEFORE DELETE ON original_participant_groups FOR EACH ROW EXECUTE FUNCTION owned_native_delete_failure()");}
      try {await assert.rejects(services.originalGroupResults.delete({...scope, groups: ['ORACLE.DELETE.MAIN', 'ORACLE.DELETE.EMPTY']}), kind === 'file' ? /directory|EISDIR|ENOTEMPTY/ : /owned late cascade failure/);}
      finally {
        if (kind === 'file') {await rm(file, {recursive: true}); await rename(file + '.owned-backup', file);}
        else if (kind === 'sqlite') {control.exec('DROP TRIGGER owned_native_delete_failure'); control.close(); control = null;}
        else {await control.query('DROP TRIGGER owned_native_delete_failure ON original_participant_groups; DROP FUNCTION owned_native_delete_failure()'); await control.end(); control = null;}
      }
      assert.deepEqual(await snapshot(), before); await reopen(); assert.deepEqual(await snapshot(), before);
      assert.equal((await services.originalAuthentication.read({token: main.person.token})).participantSession.participantSessionId, main.person.participantSession.participantSessionId);
    });
    await t.test('one metadata-only transaction revokes every selected native identity and preserves other groups, canonical runs and definitions', async () => {
      const before = await snapshot(), canonicalBefore = await repository.getTestRunById(canonicalRun.testRunId), parser = JSON.parse, pgParser = pgTypes.getTypeParser(3802);
      if (kind === 'sqlite' || kind === 'postgres') JSON.parse = (...args) => {if (typeof args[0] === 'string' && args[0].includes(privatePayload)) throw Error('Owned full response decoder fence'); return parser(...args);};
      if (kind === 'postgres') pgTypes.setTypeParser(3802, text => {if (text.includes(privatePayload)) throw Error('Owned full response decoder fence'); return pgParser(text);});
      try {
        if (kind === 'sqlite' || kind === 'postgres') await assert.rejects(repository.getTestRunById(main.run.testRunId), /Owned full response decoder fence/);
        await services.originalGroupResults.delete({...scope, groups: ['oracle.delete.main', 'ORACLE.DELETE.EMPTY', 'ORACLE.DELETE.MAIN']});
      }
      finally {JSON.parse = parser; if (kind === 'postgres') pgTypes.setTypeParser(3802, pgParser);}
      const after = await snapshot(), deletedPeople = new Set([...([main, second, peer].map(row => row.person.participantSession.participantSessionId)),unopened.person.participantSession.participantSessionId]);
      for (const row of [main, second, peer]) {
        assert.equal(await repository.getTestRunById(row.run.testRunId), null); assert.equal(await repository.getParticipantSessionById(row.person.participantSession.participantSessionId), null);
        assert.equal(await repository.getParticipantAccessCredential(row.person.participantSession.participantSessionId), null);
        assert.equal(await repository.findOriginalSessionTokenByHash(hashOriginalSessionToken(row.login.token)), null);
        await assert.rejects(services.originalAuthentication.read({token: row.person.token}));
      }
      assert.equal(await repository.getParticipantSessionById(unopened.person.participantSession.participantSessionId),null);
      await assert.rejects(services.originalAuthentication.read({token:unopened.person.token}));
      for (const token of [main.person.groupToken, empty.token, empty.groupToken]) assert.equal(await repository.findOriginalSessionTokenByHash(hashOriginalSessionToken(token)), null);
      assert.ok(after.reviews.every(row => !deletedPeople.has(row.participantSessionId))); assert.ok(after.logs.every(row => !deletedPeople.has(row.participantSessionId)));
      assert.ok(after.files.every(row => ![main, second, peer].some(value => value.attachment.attachmentFileId === row.attachmentFileId)));
      assert.ok(after.events.every(row => !deletedPeople.has(row.subjectId) && !deletedPeople.has(row.details?.participantSessionId)));
      for (const row of [kept, moved]) assert.equal((await services.originalAuthentication.read({token: row.person.token})).participantSession.participantSessionId, row.person.participantSession.participantSessionId);
      assert.deepEqual(await repository.getTestRunById(canonicalRun.testRunId), canonicalBefore);
      assert.deepEqual(after.roster, before.roster); assert.deepEqual(after.release, before.release);
      assert.deepEqual({groups:await repository.listOriginalParticipantGroupsByWorkspace(ids.tenantId,foreign.workspaceId),person:await repository.getParticipantSessionById(foreignRun.participantSessionId),run:await repository.getTestRunById(foreignRun.testRunId)},foreignBefore);
      const removedRuns = [main,second,peer].map(row=>row.run.testRunId);
      if(kind==='file') {
        const document=JSON.parse(await readFile(file,'utf8'));
        for(const key of ['participantRunCommands','participantProgressDeliveries','participantPresence']) assert.ok(Object.values(document[key]).every(row=>!removedRuns.includes(row.testRunId)));
        for(const id of deletedPeople) assert.ok(!Object.hasOwn(document.participantAccessCredentials,id));
      } else if(kind==='sqlite'||kind==='postgres') {
        const inspect=kind==='sqlite'?new DatabaseSync(file):new Pool({connectionString:url.toString()});
        try {for(const table of ['participant_run_commands','participant_progress_deliveries','participant_connection_presence']) {
          const count=kind==='sqlite'?inspect.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE test_run_id IN (SELECT value FROM json_each(?))`).get(JSON.stringify(removedRuns)).count
            :(await inspect.query(`SELECT COUNT(*) AS count FROM ${table} WHERE test_run_id=ANY($1::text[])`,[removedRuns])).rows[0].count;
          assert.equal(Number(count),0,table);
        }} finally {if(kind==='sqlite')inspect.close();else await inspect.end();}
      }
      for(const row of [main,second,peer]) {
        assert.deepEqual(await repository.listPendingParticipantRunCommands(row.run),[]);
        assert.equal((await repository.updateParticipantPresence({testRunId:row.run.testRunId,participantSessionId:row.run.participantSessionId,action:'expire',timestamp:Date.parse(stamp)+120000})).accepted,false);
      }
      await reopen(); assert.deepEqual(await snapshot(), after);
    });
    await t.test('delayed Run, review, log, journal, attachment, credential and import-validity writes cannot resurrect removed parents', async () => {
      const before = await snapshot();
      await assert.rejects(repository.saveTestRun(main.run), unavailable);
      await assert.rejects(repository.saveWorkspaceReview(main.review), unavailable);
      await assert.rejects(repository.saveAttachmentFile(main.attachment), unavailable);
      await assert.rejects(repository.saveParticipantTestLogs([{...ids, participantTestLogId: randomUUID(), participantSessionId: main.run.participantSessionId, testRunId: main.run.testRunId,
        unitKey: null, originalUnitId: null, logKey: 'OWNED', logContent: 'stale', timestamp: Date.parse(stamp), recordedAt: stamp}]), unavailable);
      await assert.rejects(repository.saveWorkspaceActivityEvent({...ids, activityEventId: randomUUID(), eventType: 'review_created', actorId: null, subjectType: 'test_run', subjectId: main.run.testRunId,
        occurredAt: stamp, summary: 'Stale private review journal', details: {participantSessionId: main.run.participantSessionId, unitKey: 'ORACLE.POW.UNIT', reviewId: main.review.reviewId}}), unavailable);
      await assert.rejects(repository.saveParticipantAccessCredential({participantSessionId: main.run.participantSessionId, tokenHash: hashOriginalSessionToken(main.person.token), updatedAt: stamp}));
      await repository.updateParticipantSessionValidity({...ids, participantSessionId: main.run.participantSessionId, validUntil: null});
      assert.deepEqual(await snapshot(), before);
    });
    await t.test('fresh native entry rotates Login/group/person capabilities and does not regain an old Test or bearer', async () => {
      await upload(changed.map(row => row[0] === 'ORACLE.DELETE.MAIN' ? [row[0], 'Recreated deletion label', row[2]] : row));
      const fresh = await authenticate('owned-delete-main');
      assert.notEqual(fresh.login.token, main.login.token); assert.notEqual(fresh.person.token, main.person.token); assert.notEqual(fresh.person.groupToken, main.person.groupToken);
      assert.equal(fresh.login.login.groupLabel, 'Recreated deletion label'); assert.equal((await repository.listOriginalParticipantGroupsByWorkspace(ids.tenantId,ids.workspaceId)).find(row=>row.groupKey==='ORACLE.DELETE.MAIN').groupLabel,'Recreated deletion label'); assert.notEqual(fresh.person.participantSession.participantSessionId, main.run.participantSessionId);
      assert.deepEqual(await repository.listTestRunsByParticipantSessionId(fresh.person.participantSession.participantSessionId), []);
      for (const token of [main.login.token, main.person.token]) await assert.rejects(services.originalAuthentication.read({token}));
      // Even after a new binding exists, a delayed validity refresh must never upsert the former person.
      await repository.updateParticipantSessionValidity({...ids, participantSessionId: main.run.participantSessionId, validUntil: null});
      assert.equal(await repository.getParticipantSessionById(main.run.participantSessionId), null);
    });
    await t.test('the caller cannot replace a selected group while workspace resolution is queued', async () => {
      let entered, release; const entry = new Promise(done => {entered = done;}), gate = new Promise(done => {release = done;});
      const port = createOriginalGroupResultsPort(repository, async () => {entered(); await gate; return ids;});
      const names = ['ORACLE.DELETE.MAIN'], pending = port.delete({...scope, groups: names}); await entry; names[0] = 'ORACLE.DELETE.KEEP'; release(); await pending;
      assert.ok((await repository.listOriginalParticipantGroupsByWorkspace(ids.tenantId, ids.workspaceId)).some(row => row.groupKey === 'ORACLE.DELETE.KEEP'));
      assert.ok(!(await repository.listOriginalParticipantGroupsByWorkspace(ids.tenantId, ids.workspaceId)).some(row => row.groupKey === 'ORACLE.DELETE.MAIN'));
    });
    await t.test('in-flight review and log requests are fenced at their actual durable write after deletion', async () => {
      for (const method of ['saveWorkspaceReview', 'saveParticipantTestLogs']) {
        const fresh = await seed('owned-delete-main');
        let entered, release; const entry = new Promise(done => {entered = done;}), gate = new Promise(done => {release = done;});
        const delayed = new Proxy(repository, {get(target, key) {
          if (key === method) return async (...args) => {entered(); await gate; return target[key](...args);};
          const value = Reflect.get(target, key); return typeof value === 'function' ? value.bind(target) : value;
        }});
        const runtime = createFirstSliceServices({repository: delayed, now: () => stamp});
        const pending = (method === 'saveWorkspaceReview'
          ? runtime.participantRuntime.createReview({testRunId:fresh.run.testRunId,unitKey:'ORACLE.POW.UNIT',reviewerId:'Owned',category:'owned',comment:'Delayed owned comment'})
          : runtime.participantRuntime.saveTestLogs({testRunId:fresh.run.testRunId,logs:[{unitKey:'ORACLE.POW.UNIT',entries:[{key:'OWNED',content:'Delayed owned log',timeStamp:Date.parse(stamp)}]}]}))
          .then(value => ({value}), error => ({error}));
        try {await Promise.race([entry, pending.then(outcome => {throw outcome.error ?? Error('Expected the request to reach its durable write.');})]); await services.originalGroupResults.delete({...scope,groups:['ORACLE.DELETE.MAIN']});}
        finally {release();}
        const outcome = await pending; assert.ok(outcome.error && unavailable(outcome.error));
        assert.equal(await repository.getTestRunById(fresh.run.testRunId),null);
        assert.ok(!(await repository.listWorkspaceReviewsByWorkspace(ids.tenantId,ids.workspaceId)).some(row=>row.testRunId===fresh.run.testRunId));
        assert.ok(!(await repository.listParticipantTestLogsByWorkspace(ids.tenantId,ids.workspaceId)).some(row=>row.testRunId===fresh.run.testRunId));
      }
    });
    if(kind==='postgres') await t.test('independent PostgreSQL writers demonstrably wait on the deleting transaction and cannot revive descendants', {timeout:30000}, async race => {
      for(const operation of ['review','logs','journal','attachment','run','credential','validity']) {
        const fresh=await seed('owned-delete-main'), other=await createPostgresFirstSliceStorage(url.toString());
        const observer=new Pool({connectionString:url.toString()});
        let releaseDelete, reachedDelete, reachedWriter, deletionPid, writerPid, paused=false;
        const gate=new Promise(done=>{releaseDelete=done;}), deletionEntry=new Promise(done=>{reachedDelete=done;}), writerEntry=new Promise(done=>{reachedWriter=done;});
        const query=Client.prototype.query;
        const hook=race.mock.method(Client.prototype,'query',function(...args){
          const text=typeof args[0]==='string'?args[0]:args[0]?.text??'';
          if(!paused&&text.startsWith('DELETE FROM original_participant_groups')) {paused=true;deletionPid=this.processID;reachedDelete();return gate.then(()=>query.apply(this,args));}
          if(paused&&this.processID!==deletionPid&&!writerPid&&(/FOR (?:KEY SHARE|NO KEY UPDATE|UPDATE)/.test(text)||/^(?:INSERT INTO participant_access_credentials|UPDATE participant_sessions SET valid_until)/.test(text))) {writerPid=this.processID;reachedWriter();}
          return query.apply(this,args);
        });
        const deletion=services.originalGroupResults.delete({...scope,groups:['ORACLE.DELETE.MAIN']}).then(value=>({value}),error=>({error}));
        let writing;
        try {
          await Promise.race([deletionEntry,deletion.then(result=>{throw result.error??Error('Deletion missed its final statement.');})]);
          const target=other.repository;
          writing=(operation==='review'?target.saveWorkspaceReview({...fresh.review,reviewId:randomUUID()})
            :operation==='logs'?target.saveParticipantTestLogs([{...ids,participantTestLogId:randomUUID(),participantSessionId:fresh.run.participantSessionId,testRunId:fresh.run.testRunId,
              unitKey:null,originalUnitId:null,logKey:'OWNED',logContent:'Concurrent owned log',timestamp:Date.parse(stamp),recordedAt:stamp}])
            :operation==='journal'?target.saveWorkspaceActivityEvent({...ids,activityEventId:randomUUID(),eventType:'review_created',actorId:null,subjectType:'test_run',subjectId:fresh.run.testRunId,occurredAt:stamp,summary:'Concurrent owned event',details:{participantSessionId:fresh.run.participantSessionId,unitKey:'ORACLE.POW.UNIT',reviewId:fresh.review.reviewId}})
            :operation==='attachment'?target.saveAttachmentFile({...fresh.attachment,attachmentFileId:randomUUID()})
            :operation==='run'?target.saveTestRun(fresh.run)
            :operation==='credential'?target.saveParticipantAccessCredential({participantSessionId:fresh.run.participantSessionId,tokenHash:hashOriginalSessionToken(fresh.person.token),updatedAt:stamp})
            :target.updateParticipantSessionValidity({...ids,participantSessionId:fresh.run.participantSessionId,validUntil:null})).then(value=>({value}),error=>({error}));
          await Promise.race([writerEntry,writing.then(result=>{throw result.error??Error('Writer missed its actual database lock.');})]);
          let locked=false;const deadline=Date.now()+5000;
          while(Date.now()<deadline){const row=(await observer.query('SELECT wait_event_type FROM pg_stat_activity WHERE pid=$1',[writerPid])).rows[0];if(row?.wait_event_type==='Lock'){locked=true;break;}await delay(10);}
          assert.equal(locked,true,operation+' must actually wait on a database lock');
          releaseDelete(); assert.equal((await deletion).error,undefined);
          const result=await writing;
          if(operation==='validity')assert.equal(result.error,undefined);else if(operation==='credential')assert.equal(result.error?.code,'23503');else assert.ok(result.error&&unavailable(result.error),operation);
          assert.equal(await repository.getParticipantSessionById(fresh.run.participantSessionId),null);
          assert.equal(await repository.getTestRunById(fresh.run.testRunId),null);
          assert.equal(await repository.getParticipantAccessCredential(fresh.run.participantSessionId),null);
          assert.ok(!(await repository.listWorkspaceReviewsByWorkspace(ids.tenantId,ids.workspaceId)).some(row=>row.testRunId===fresh.run.testRunId));
          assert.ok(!(await repository.listWorkspaceActivityEventsByWorkspace(ids.tenantId,ids.workspaceId)).some(row=>row.subjectId===fresh.run.testRunId));
          assert.ok(!(await repository.listAttachmentFilesByWorkspace(ids.tenantId,ids.workspaceId)).some(row=>row.attachmentId===fresh.attachment.attachmentId));
        } finally {releaseDelete();await Promise.allSettled([deletion,...(writing?[writing]:[])]);hook.mock.restore();await other.shutdown();await observer.end();}
      }
    });
    if (kind === 'sqlite' || kind === 'postgres') await t.test('actual protected HTTP requires workspace RW and returns empty private HTTP200 for native deletion', async () => {
      const fresh = await seed('owned-delete-main'), password = 'Owned-native-delete-admin-2026!';
      const administration = createFirstSliceServices({repository});
      const initial = await administration.adminAuth.bootstrapAdminUser({username:'owned-native-delete-admin',password});
      const tokens = {};
      for (const [name,workspaceId,accessMode] of [['owned-writer',ids.workspaceId,'read_write'],['owned-reader',ids.workspaceId,'read_only'],['foreign-writer',foreign.workspaceId,'read_write']]) {
        const adminUserId=randomUUID(); await repository.saveAdminUser({...initial.adminUser,adminUserId,username:name});
        await repository.saveAdminRoleAssignment({roleAssignmentId:randomUUID(),adminUserId,role:'workspace_admin',accessMode,tenantId:ids.tenantId,workspaceId,
          groupKey:null,monitorProfiles:[],monitorBookletVisibility:'visible',createdAt:new Date().toISOString()});
        tokens[name]=(await administration.adminAuth.signIn({username:name,password})).adminSession.token;
      }
      const environment={FIRST_SLICE_STORE:kind,FIRST_SLICE_SQLITE_FILE:file,FIRST_SLICE_BOOTSTRAP_DEMO:'false',FIRST_SLICE_OPERATOR_AUTH_REQUIRED:'true',FIRST_SLICE_XML_SCHEMA_PROFILE:'original-19',FIRST_SLICE_PROOF_OF_WORK_SCOPES:'',...(url?{FIRST_SLICE_POSTGRES_URL:url.toString()}:{})};
      const previous=new Map(Object.keys(environment).map(key=>[key,process.env[key]])); let server;
      try {
        try {Object.assign(process.env,environment);server=await createProductionApiServer();}
        finally {for (const [key,value] of previous) {if (value===undefined) delete process.env[key];else process.env[key]=value;}}
        await new Promise(done=>server.listen(0,'127.0.0.1',done));
        const base='http://127.0.0.1:'+server.address().port;
        const path=`/api/v1/tenants/${scope.tenantKey}/workspaces/${scope.workspaceKey}/results/original-groups`;
        const request=async(token,body,status)=>{
          const response=await fetch(base+path,{method:'DELETE',headers:{'content-type':'application/json',...(token?{authorization:'Bearer '+token}:{})},body:JSON.stringify(body),signal:AbortSignal.timeout(15000)});
          assert.equal(response.status,status);const text=await response.text();
          if(status===200){assert.equal(text,'');assert.equal(response.headers.get('cache-control'),'private, no-store');}
        };
        const before=await snapshot();
        await request(undefined,{groups:['ORACLE.DELETE.MAIN']},401);await request('invalid-owned-token',{groups:['ORACLE.DELETE.MAIN']},401);
        await request(tokens['owned-reader'],{groups:['ORACLE.DELETE.MAIN']},403);await request(tokens['foreign-writer'],{groups:['ORACLE.DELETE.MAIN']},403);
        await request(fresh.person.token,{groups:['ORACLE.DELETE.MAIN']},401);
        for(const body of [null,[],{}, {groups:'ORACLE.DELETE.MAIN'},{groups:[1]}])await request(tokens['owned-writer'],body,400);
        for(const groups of [[],['unknown'],[' ORACLE.DELETE.MAIN']])await request(tokens['owned-writer'],{groups},200);
        assert.deepEqual(await snapshot(),before);
        await request(tokens['owned-writer'],{groups:['oracle.delete.main']},200);
        assert.equal(await repository.getParticipantSessionById(fresh.run.participantSessionId),null);
        assert.equal(await repository.findOriginalSessionTokenByHash(hashOriginalSessionToken(fresh.login.token)),null);
        assert.equal(await repository.getTestRunById(fresh.run.testRunId),null);
      } finally {if(server)await new Promise((done,reject)=>server.close(error=>error&&error.code!=='ERR_SERVER_NOT_RUNNING'?reject(error):done()));}
    });
  } finally {
    if (control) {if (kind === 'sqlite') control.close(); else await control.end();}
    await storage?.shutdown(); if (pool) {if (created) await pool.query(`DROP SCHEMA "${schema}" CASCADE`); await pool.end();}
    await rm(directory, {recursive: true, force: true});
  }
});
