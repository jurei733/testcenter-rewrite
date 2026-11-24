import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {mkdtemp, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join, resolve} from 'node:path';
import test from 'node:test';
import {DatabaseSync} from 'node:sqlite';
import {Pool} from 'pg';
import {createFirstSliceServices} from '@testcenter-rewrite-app/application';
import {createInMemoryFirstSliceRepository} from '@testcenter-rewrite-app/memory-store';
import {createFileFirstSliceStorage} from '@testcenter-rewrite-app/file-store';
import {createSqliteFirstSliceStorage} from '@testcenter-rewrite-app/sqlite-store';
import {createPostgresFirstSliceStorage} from '@testcenter-rewrite-app/postgres-store';
import {prepareOriginalXmlSchemaValidator} from '../packages/application/dist/packages/application/src/original-xml-schema.js';
import {createOriginalAttachmentPort} from '../packages/application/dist/packages/application/src/original-attachment.js';

const schemaCache = resolve(process.env.FIRST_SLICE_XML_SCHEMA_CACHE || '.data/original-xml-schemas');
const validator = await prepareOriginalXmlSchemaValidator(schemaCache, process.env.FIRST_SLICE_XML_SCHEMA_DOWNLOAD !== 'false');
const schemas = {Unit:'unit-xml/17.6',Booklet:'testcenter-booklet-xml/18.0',Testtakers:'testcenter-testtaker-xml/18.0'};
const xml = (type, body) => `<${type} xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xsi:noNamespaceSchemaLocation="https://w3id.org/iqb/spec/${schemas[type]}">${body}</${type}>`;
const group = 'experimental-attachment';
const unitId = 'OWNED.ATTACHMENT';
const alias = 'Page.Alias';
const image = fileName => ({fileName, mediaType:'image/png',
  dataBase64:'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aX1sAAAAASUVORK5CYII='});
const rejected = (status, code) => error => error.statusCode === status && error.errorCode === code;

test('a physical code shared by two eligible occurrences cannot choose an attachment', async () => {
  const scope = {tenantId:'owned-tenant',workspaceId:'owned-workspace'};
  const workspace = {...scope,tenantKey:'owned',workspaceKey:'owned'};
  const participantSessionId = 'fixture-participant';
  const contentReleaseId = 'fixture-release';
  const testRunId = 'fixture-run';
  const testNumber = '2';
  const loginKey = 'fixture-owner';
  const aliases = ['First.Page','Second.Page'];
  const attachments = aliases.map(unitKey=>({
    originalUnitId:unitId,
    attachment:{...scope,unitKey,attachmentId:'stored-'+unitKey,participantSessionId,testRunId,groupKey:group,loginKey,
      variableId:'page',attachmentType:'capture-image',attachmentFileIds:[],lastModified:null,dataType:'missing'}
  }));
  const port = createOriginalAttachmentPort({
    auth:{read:async()=>({kind:'person',participantSession:{...scope,originalOperationalMode:'monitor-group',
      groupKey:group,participantSessionId:'fixture-monitor'}})},
    workspace:async()=>workspace,
    inventory:async()=>({
      people:[{participantSessionId,contentReleaseId,originalLoginKey:loginKey,groupKey:group}],
      bindings:[{loginKey,groupKey:group}],
      runs:[{testRunId,participantSessionId,contentReleaseId,bookletName:'fixture-booklet'}],
      numbers:[{testRunId,participantSessionId,contentReleaseId,testNumber}]
    }),
    attachments:async()=>attachments, units:async()=>[], scopedOperations:()=>({})
  });
  const reference = unit => ({token:'fixture-token',attachmentId:[testNumber,unit,'page'].join(':')});
  await assert.rejects(port.get(reference(unitId)),rejected(404,'original_attachment_not_found'));
  assert.deepEqual((await port.list('fixture-token')).map(row=>row.attachmentId),aliases.map(alias=>reference(alias).attachmentId));
  for (const alias of aliases) {
    const row = await port.get(reference(alias));
    const printed = await port.page(reference(alias));
    assert.equal(printed.attachmentId,reference(alias.toUpperCase()).attachmentId);
    assert.deepEqual(await port.get(reference(alias.toUpperCase())),row);
  }
});

function archiveText(buffer, fileName) {
  for (let offset = 0; buffer.readUInt32LE(offset) === 0x04034b50;) {
    const length = buffer.readUInt32LE(offset + 18);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const start = offset + 30 + nameLength + buffer.readUInt16LE(offset + 28);
    if (buffer.subarray(offset + 30, offset + 30 + nameLength).toString() === fileName) {
      return buffer.subarray(start, start + length).toString();
    }
    offset = start + length;
  }
  throw new Error('Missing archive entry ' + fileName);
}

const kinds = process.env.FIRST_SLICE_STORE === 'postgres' ? ['postgres'] : ['memory', 'file', 'sqlite'];
for (const kind of kinds) test(`${kind}: Original attachment writes update Unit read and result export atomically`, async t => {
  const folder = await mkdtemp(join(tmpdir(), 'owned-original-attachment-'));
  const schema = 'owned_attachment_' + randomUUID().replaceAll('-', '');
  const url = kind === 'postgres' ? new URL(process.env.FIRST_SLICE_POSTGRES_URL) : null;
  const control = url ? new Pool({connectionString: url.toString()}) : null;
  url?.searchParams.set('options', '-c search_path=' + schema);
  let storage, services;
  let stamp = '2026-11-23T12:00:00.123Z';
  const open = async () => {
    storage = kind === 'memory' ? storage ?? {repository:createInMemoryFirstSliceRepository(), shutdown:async () => {}}
      : kind === 'file' ? await createFileFirstSliceStorage(join(folder, 'state.json'))
      : kind === 'sqlite' ? createSqliteFirstSliceStorage(join(folder, 'state.sqlite'))
      : await createPostgresFirstSliceStorage(url.toString());
    services = createFirstSliceServices({repository:storage.repository, originalXmlSchemaValidator:validator,
      xmlSchemaProfile:'original-19', now:() => stamp});
  };
  t.after(async () => {
    await storage?.shutdown();
    if (control) {await control.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`); await control.end();}
    await rm(folder, {recursive:true, force:true});
  });
  if (control) await control.query(`CREATE SCHEMA "${schema}"`);
  await open();
  const tenant = await services.platform.createTenant({tenantKey:'owned-attachment', displayName:'Owned attachment'});
  const workspace = await services.platform.createWorkspace({tenantKey:tenant.tenantKey, workspaceKey:'owned', displayName:'Owned attachment'});
  const scope = {tenantKey:tenant.tenantKey, workspaceKey:workspace.workspaceKey};
  const download = () => services.workspaceAdminRead.exportOriginalResultArchive({...scope, groupKeys:[group]});
  const upload = (fileName, sourceDocument, mediaType = 'application/xml') =>
    services.contentIntake.uploadWorkspaceFile({...scope, fileName, sourceDocument, mediaType});
  await upload('owned-attachment-player-1.0.html', '<html><script type="application/ld+json">' +
    JSON.stringify({id:'owned-attachment-player',version:'1.0.0',specVersion:'6.0',metadataVersion:'2.0',
      type:'player',name:[{lang:'de',value:'Owned Player'}]}) + '</script><main>Owned</main></html>', 'text/html');
  await upload('unit.xml', xml('Unit', `<Metadata><Id>${unitId}</Id><Label>Owned Unit</Label></Metadata><Definition player="owned-attachment-player@1.0.0">Owned</Definition><BaseVariables><Variable id="page" type="attachment" format="capture-image" /></BaseVariables>`));
  await upload('booklet.xml', xml('Booklet', `<Metadata><Id>OWNED.ATTACHMENT.BOOK</Id><Label>Owned Booklet</Label></Metadata><Units><Unit id="${unitId}" alias="${alias}" label="Owned Alias"/></Units>`));
  await services.workspaceAdminRead.importParticipantRoster({...scope, rosterText:xml('Testtakers',
    `<Metadata/><Group id="${group}" label="Owned"><Login name="owned-test" mode="run-trial"><Booklet>OWNED.ATTACHMENT.BOOK</Booklet></Login><Login name="owned-monitor" mode="monitor-group" /></Group><Group id="experimental-other" label="Other"><Login name="other-monitor" mode="monitor-group" /></Group>`)});
  const authenticate = name => services.originalSession.login({name, password:''});
  const [owner, monitor, outsider] = await Promise.all(['owned-test','owned-monitor','other-monitor'].map(authenticate));
  const testNumber = await services.originalTest.create({token:owner.token, bookletName:'OWNED.ATTACHMENT.BOOK'});
  const attachmentId = [testNumber, alias, 'page'].join(':');
  const target = {token:monitor.token, attachmentId};
  const unit = {token:owner.token, testNumber, unitName:alias};
  const metadata = () => services.originalAttachments.get(target);
  const unitRead = () => services.originalUnit.read({...unit, unitName:unitId, alias, nativeUnitProtocol:'1'});
  const verifyAttachment = async (ids, effectiveTime) => {
    const current = await metadata();
    assert.deepEqual(current.attachmentFileIds, ids);
    assert.equal(current.lastModified, effectiveTime);
    const read = await unitRead();
    const entries = Object.fromEntries(read.dataParts);
    assert.equal(entries.ordinary, 'owned answer');
    const archive = await download();
    const rows = JSON.parse(archiveText(archive.body, 'responses.json'));
    const report = rows.find(row => row.unitname === alias);
    const part = report.responses.find(row => row.id === attachmentId);
    if (ids.length) {
      assert.equal(read.unitResponseType, 'iqb-standard@1.0');
      assert.deepEqual(JSON.parse(entries[attachmentId]), [{id:'page', value:ids, status:'VALUE_CHANGED'}]);
      assert.equal(read.nativeClocks.partClocks[attachmentId], effectiveTime);
      assert.deepEqual(part, {id:attachmentId, content:entries[attachmentId], ts:effectiveTime, responseType:'iqb-standard@1.0'});
      assert.ok(archiveText(archive.body, 'responses.csv').includes(attachmentId));
    } else {
      assert.equal(entries[attachmentId], undefined);
      assert.equal(part, undefined);
      assert.equal(read.nativeClocks.partClocks[attachmentId], undefined);
      assert.equal(read.unitResponseType, 'owned@1.0');
    }
  };
  await t.test('an unopened Unit rejects a valid upload without creating a file', async () => {
    await assert.rejects(services.originalAttachments.upload(target, image('unopened.png')), rejected(404, 'original_unit_uninitialized'));
    assert.equal((await metadata()).dataType, 'missing');
    assert.deepEqual(await storage.repository.listAttachmentFilesByWorkspace(tenant.tenantId, workspace.workspaceId), []);
  });
  const [legacyRequest] = await services.originalAttachments.list(monitor.token);
  const originalQrTarget = {...target, attachmentId:[testNumber, unitId, 'page'].join(':')};
  assert.deepEqual(legacyRequest, {
    attachmentId:originalQrTarget.attachmentId, attachmentType:'capture-image', dataType:'missing', attachmentFileIds:[], lastModified:null,
    testLabel:'Owned Booklet', unitLabel:unitId, personLabel:'Owned/owned-test', variableId:'page'
  });
  assert.deepEqual(await services.originalAttachments.get(originalQrTarget), legacyRequest);
  assert.deepEqual(await services.originalAttachments.get(target), legacyRequest);
  assert.deepEqual(await services.originalAttachments.get({...target,attachmentId:[testNumber,alias.toUpperCase(),'page'].join(':')}), legacyRequest);
  const printable = await services.originalAttachments.page(target);
  assert.equal(printable.attachmentId, originalQrTarget.attachmentId);
  assert.equal(printable.unitKey, unitId);
  assert.equal(printable.bookletKey, 'OWNED.ATTACHMENT.BOOK');
  assert.deepEqual(await services.originalAttachments.pages(monitor.token), [printable]);
  await assert.rejects(services.originalAttachments.get({...originalQrTarget,token:outsider.token}),
    rejected(404, 'original_attachment_not_found'));
  const inventory = await storage.repository.getOriginalTestAdministrationInventory(tenant.tenantId, workspace.workspaceId);
  const {testRunId} = inventory.numbers.find(row => row.testNumber === testNumber);
  const legacyId = 'att-' + Buffer.from(JSON.stringify([testRunId, alias, 'page'])).toString('base64url');
  const olderFile = {attachmentFileId:'image:previous.png', attachmentId:legacyId, tenantId:tenant.tenantId,
    workspaceId:workspace.workspaceId, ...image('previous.png'), createdAt:stamp};
  await t.test('a stored file from before response linkage remains manageable before first Unit entry', async () => {
    await storage.repository.saveAttachmentFile(olderFile);
    assert.deepEqual((await metadata()).attachmentFileIds, [olderFile.attachmentFileId]);
    assert.equal(legacyRequest.attachmentId, originalQrTarget.attachmentId);
    assert.deepEqual((await unitRead()).dataParts, []);
    await services.originalAttachments.delete({...target,attachmentFileId:olderFile.attachmentFileId});
    assert.equal((await metadata()).dataType, 'missing');
  });
  await services.originalUnit.patchState({...unit, body:{originalUnitId:unitId, newState:[{key:'CURRENT_PAGE', content:'1', timeStamp:1}]}});
  await services.originalUnit.putResponse({...unit, body:{responseType:'owned@1.0', timeStamp:2, dataParts:{ordinary:'owned answer'}}});
  await t.test('untouched legacy attachments appear in both exports and the task read without a storage write', async () => {
    await storage.repository.saveAttachmentFile(olderFile);
    const selectedRun = inventory.numbers.find(row => row.testNumber === testNumber);
    const rawBefore = await storage.repository.getOriginalUnit({...selectedRun, unitName:alias});
    const timestamp = Date.parse('2026-11-23T12:00:00Z');
    await verifyAttachment([olderFile.attachmentFileId], timestamp);
    const normalizedAlias = await services.originalUnit.read({...unit, unitName:unitId, alias:alias.toLowerCase()});
    const recovered = JSON.parse(Object.fromEntries(normalizedAlias.dataParts)[attachmentId]);
    assert.deepEqual(recovered, [{id:'page', value:[olderFile.attachmentFileId], status:'VALUE_CHANGED'}]);

    const request = {...scope,type:'response',dataIds:group,accept:'application/json',useNewVersion:true};
    const native = JSON.parse((await services.originalWorkspaceReport.read(request)).body);
    assert.ok(native.some(row => row.responses.some(part => part.id === attachmentId && part.ts === timestamp)));
    const foreignReport = await services.originalWorkspaceReport.read({...request,dataIds:'experimental-other'});
    assert.ok(!foreignReport.body.includes(olderFile.attachmentFileId));
    await assert.rejects(services.originalUnit.read({...unit,token:outsider.token,unitName:unitId,alias}),
      rejected(403, 'original_test_forbidden'));

    await storage.shutdown();
    await open();
    await verifyAttachment([olderFile.attachmentFileId], timestamp);
    assert.deepEqual(await storage.repository.getOriginalUnit({...selectedRun,unitName:alias}), rawBefore);
    assert.ok(!rawBefore.parts.some(part => part.id === attachmentId));
    await services.originalAttachments.delete({...target,attachmentFileId:olderFile.attachmentFileId});
    await verifyAttachment([], null);
  });
  if (kind === 'sqlite' || kind === 'postgres') await t.test('a failed Unit write rolls back the file insert', async () => {
    const sqlite = kind === 'sqlite' ? new DatabaseSync(join(folder, 'state.sqlite')) : null;
    const pg = url ? new Pool({connectionString: url.toString()}) : null;
    const execute = statement => sqlite ? sqlite.exec(statement) : pg.query(statement);
    if (sqlite) {
      await execute(`CREATE TRIGGER reject_native_attachment_part BEFORE UPDATE ON original_native_units
        BEGIN SELECT RAISE(ABORT, 'owned write failure'); END;`);
    } else {
      await execute(`CREATE FUNCTION reject_native_attachment_part() RETURNS trigger LANGUAGE plpgsql
        AS $$ BEGIN RAISE EXCEPTION 'owned write failure'; END; $$;
        CREATE TRIGGER reject_native_attachment_part BEFORE UPDATE ON original_native_units
          FOR EACH ROW EXECUTE PROCEDURE reject_native_attachment_part();`);
    }
    try {
      await assert.rejects(services.originalAttachments.upload(target, image('rolled-back.png')), /owned write failure/);
      assert.deepEqual(await storage.repository.listAttachmentFilesByWorkspace(tenant.tenantId, workspace.workspaceId), []);
      await verifyAttachment([], null);
    } finally {
      await execute('DROP TRIGGER reject_native_attachment_part' + (pg ? ' ON original_native_units' : ''));
      sqlite?.close();
      await pg?.end();
    }
  });
  let originalFirst, second, third;
  await t.test('serialized writes at the same Source clock retain all files and unrelated responses', async () => {
    await storage.repository.saveAttachmentFile(olderFile);
    await services.originalAttachments.upload(originalQrTarget,image('first.png'));
    const initialIds = (await metadata()).attachmentFileIds;
    assert.equal(initialIds[0], olderFile.attachmentFileId);
    await services.originalAttachments.delete({...target,attachmentFileId:olderFile.attachmentFileId});
    [originalFirst] = (await metadata()).attachmentFileIds;
    await Promise.all(['second.png','third.png'].map(file => services.originalAttachments.upload(target,image(file))));
    const ids = (await metadata()).attachmentFileIds;
    assert.equal(ids[0], originalFirst);
    assert.equal(new Set(ids).size, 3);
    [second, third] = ids.slice(1);
    await verifyAttachment(ids, Date.parse('2026-11-23T12:00:00Z'));
    const before = await unitRead();
    await storage.repository.saveAttachmentFile(olderFile);
    assert.deepEqual(await unitRead(), before, 'A stored attachment part wins over fallback history.');
    await storage.repository.deleteAttachmentFile(olderFile.attachmentFileId);
  });
  await t.test('reopening preserves the linkage and denies a foreign monitor even with the exact file ID', async () => {
    await storage.shutdown();
    await open();
    await verifyAttachment([originalFirst, second, third], Date.parse('2026-11-23T12:00:00Z'));
    await assert.rejects(services.originalAttachments.delete({...target, token:outsider.token, attachmentFileId:second}),
      rejected(404, 'original_attachment_not_found'));
  });
  await t.test('parallel deletions remove exactly their own files and the final deletion removes the part', async () => {
    stamp = '2026-11-23T12:00:02.789Z';
    const duplicate = await Promise.allSettled(Array.from({length:2}, () =>
      services.originalAttachments.delete({...target,attachmentFileId:second})));
    assert.equal(duplicate.filter(result => result.status === 'fulfilled').length, 1);
    assert.equal(duplicate.find(result => result.status === 'rejected').reason.statusCode, 404);
    await verifyAttachment([originalFirst, third], Date.parse('2026-11-23T12:00:02Z'));
    await Promise.all([originalFirst,third].map(attachmentFileId => services.originalAttachments.delete({...target,attachmentFileId})));
    await verifyAttachment([], null);
    assert.deepEqual(await storage.repository.listAttachmentFilesByWorkspace(tenant.tenantId, workspace.workspaceId), []);
  });
});
