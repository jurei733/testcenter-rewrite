import assert from 'node:assert/strict';
import test from 'node:test';
import type { SourcePackage, WorkspaceActivityEvent } from '@testcenter-rewrite-app/domain';
import { buildWorkspaceFileCatalog, selectCurrentWorkspaceFiles, type WorkspaceCatalogInput } from './workspace-file-catalog.js';

const stamp = '2026-10-22T10:00:00.000Z';
const file = (id: string, type: WorkspaceCatalogInput['fileType'], size: number, source: string | null,
  extra: Partial<WorkspaceCatalogInput> = {}): WorkspaceCatalogInput => ({ sourcePackageId: id,
  fileName: id + (type === 'Resource' ? '.html' : '.xml'), fileType: type, status: 'uploaded',
  uploadedAt: stamp, fileSizeBytes: size, sourceText: source, resourceIdentifier: null, ...extra });
const xml = (type: string, id: string, body = '', metadata = '') =>
  `<${type}><Metadata><Id>${id}</Id>${metadata}</Metadata>${body}</${type}>`;
const fixture = () => [
  file('people', 'Testtakers', 512, xml('Testtakers', 'PEOPLE', '<Group><Login name="private-user" pw="private-password"><Booklet>B#level:private-state</Booklet></Login><Login name="private-monitor" mode="monitor-group"/></Group>')),
  file('booklet', 'Booklet', 1024, xml('Booklet', 'B', '<Units><Testlet><Unit id="U"/></Testlet></Units>')),
  file('booklet2', 'Booklet', 2048, xml('Booklet', 'B2', '<Units><Unit id="U"/></Units>')),
  file('check', 'SysCheck', 384, xml('SysCheck', 'CHECK', '<Config unit="U"/>')),
  file('unit', 'Unit', 1536, xml('Unit', 'U', '<Definition player="owned-player@1.2.9"><![CDATA[private-unit-definition]]></Definition>')),
  file('player', 'Resource', 4096, '<html><script>private-player-body</script></html>', { resourceIdentifier: 'owned-player-1.2' })
];
const byId = (catalog: ReturnType<typeof buildWorkspaceFileCatalog>, id: string) => catalog.items.find(item => item.sourcePackageId === id)!;

test('complete grouped file metadata follows the pinned Source recursive size distinctions', () => {
  const catalog = buildWorkspaceFileCatalog(fixture());
  assert.equal(catalog.totalCount, 6); assert.equal(catalog.dependencySizesCalculated, true);
  assert.deepEqual(catalog.items.map(item => item.fileName), ['booklet.xml', 'booklet2.xml', 'check.xml', 'people.xml', 'player.html', 'unit.xml']);
  for (const [id, size] of [['people', 512], ['booklet', 6656], ['booklet2', 7680], ['check', 384], ['unit', 1536], ['player', 4096]] as const) {
    assert.equal(byId(catalog, id).totalSizeBytes, size, id);
  }
  assert.deepEqual(byId(catalog, 'people').dependencies.map(item => item.relationship), ['hasBooklet', 'containsUnit', 'usesPlayer']);
  assert.equal(byId(catalog, 'people').metadata.participantCount, 2);
  assert.equal(byId(catalog, 'unit').metadata.identifier, 'U');
  assert.equal(byId(catalog, 'player').metadata.identifier, 'OWNED-PLAYER-1.2');
});

test('catalog output excludes roster credentials, authored State values, Player bodies and Unit definitions', () => {
  const result = JSON.stringify(buildWorkspaceFileCatalog(fixture()));
  for (const secret of ['private-user', 'private-monitor', 'private-password', 'private-state',
    'private-unit-definition', 'private-player-body', 'sourceText', 'sourceDocument']) assert.ok(!result.includes(secret), secret);
});

test('XML metadata preserves authored labels, description whitespace, CDATA and entities', () => {
  const catalog = buildWorkspaceFileCatalog([file('padded', 'Unit', 100,
    xml('Unit', '  mixed-id  ', '', '<Label>  Ω &amp; Titel  </Label><Description><![CDATA[  <b>Text</b>\n  ]]></Description>'))]);
  assert.deepEqual(catalog.items[0]!.metadata, { identifier: 'MIXED-ID', label: '  Ω & Titel  ',
    description: '  <b>Text</b>\n  ', participantCount: null, veronaVersion: null, moduleVersion: null });
});

test('Source identifier casing changes ASCII letters while preserving valid Unicode ID distinctions', () => {
  const result = buildWorkspaceFileCatalog([
    file('book', 'Booklet', 10, xml('Booklet', 'heft-ä', '<Units><Unit id="aufgabe-ä"/><Unit id="AUFGABE-Ä"/></Units>')),
    file('unit', 'Unit', 20, xml('Unit', ' aufgabe-ä '))
  ]);
  const booklet = byId(result, 'book');
  assert.equal(booklet.metadata.identifier, 'HEFT-ä');
  assert.equal(byId(result, 'unit').metadata.identifier, 'AUFGABE-ä');
  assert.equal(booklet.dependencies.length, 1);
  assert.equal(booklet.totalSizeBytes, 30);
  assert.equal(booklet.unresolvedReferences[0]!.reference, 'AUFGABE-Ä');
});

test('shared descendants count once per target/relationship, retaining Source distinct-relation semantics', () => {
  const inputs = fixture();
  inputs[1]!.sourceText = xml('Booklet', 'B', '<Units><Unit id="U"/><Unit id="U2"/><Unit id="U"/></Units>');
  inputs.push(file('unit2', 'Unit', 100, xml('Unit', 'U2', '<Definition player="owned-player-1.2"/>')));
  assert.equal(byId(buildWorkspaceFileCatalog(inputs), 'booklet').totalSizeBytes, 6756);
  inputs[4]!.sourceText = xml('Unit', 'U', '<CodingSchemeRef>scheme.json</CodingSchemeRef><Dependencies><File>scheme.json</File><File for="controller">ignored.json</File></Dependencies>');
  inputs.push(file('scheme', 'Resource', 10, null, {fileName: 'scheme.json'}));
  const unit = byId(buildWorkspaceFileCatalog(inputs), 'unit');
  assert.equal(unit.totalSizeBytes, 1556, 'Distinct usesScheme and usesPlayerResource rows each contribute Source bytes');
  assert.deepEqual(unit.dependencies.map(item => item.relationship), ['usesScheme', 'usesPlayerResource']);
});

test('missing and ambiguous typed IDs stay explicit without choosing a filename or unrelated type', () => {
  const inputs = fixture();
  inputs.push(file('duplicate', 'Unit', 5, xml('Unit', 'U')));
  const catalog = buildWorkspaceFileCatalog(inputs), booklet = byId(catalog, 'booklet');
  assert.deepEqual(booklet.dependencies, []);
  assert.deepEqual(booklet.unresolvedReferences[0]!.candidateSourcePackageIds, ['unit', 'duplicate']);
  inputs[1]!.sourceText = xml('Booklet', 'B', '<Units><Unit id="unit.xml"/><Unit id="PEOPLE"/><Unit id="missing"/></Units>');
  const unresolved = byId(buildWorkspaceFileCatalog(inputs), 'booklet').unresolvedReferences;
  assert.deepEqual(unresolved.map(item => item.reference), ['unit.xml', 'PEOPLE', 'missing']);
  assert.ok(unresolved.every(item => item.candidateSourcePackageIds.length === 0));
});

test('exact Source 1,000-file boundary computes sizes; 1,001 files remain fully listed with uncomputed sizes', () => {
  const inputs = Array.from({length: 1000}, (_, i) => file('resource-' + i, 'Resource', 1, null));
  const boundary = buildWorkspaceFileCatalog(inputs);
  assert.equal(boundary.totalCount, 1000); assert.equal(boundary.dependencySizesCalculated, true);
  assert.ok(boundary.items.every(item => item.totalSizeBytes === 1));
  inputs.push(file('resource-more', 'Resource', 1, null));
  const above = buildWorkspaceFileCatalog(inputs);
  assert.equal(above.totalCount, 1001); assert.equal(above.items.length, 1001);
  assert.equal(above.dependencySizesCalculated, false);
  assert.ok(above.items.every(item => item.totalSizeBytes === null && item.dependencies.length === 0));
});

test('rejected, malformed and entity-declaring documents remain listable and cannot load external data', () => {
  const catalog = buildWorkspaceFileCatalog([
    file('bad', 'Unit', 20, '<Unit><Metadata>private-malformed', {status: 'rejected'}),
    file('entity', 'Unit', 25, '<!DOCTYPE Unit [<!ENTITY private SYSTEM "file:///private-owned-path">]><Unit><Metadata><Label>&private;</Label></Metadata></Unit>'),
    file('archive', 'Package', 30, 'private-archive-document')
  ]);
  assert.equal(byId(catalog, 'bad').status, 'rejected');
  assert.equal(byId(catalog, 'entity').metadata.label, '');
  assert.equal(byId(catalog, 'archive').fileType, 'Package', 'Uploaded containers are not silently hidden or relabeled as Source files');
  assert.ok(!JSON.stringify(catalog).includes('private-'));
});

test('Player metadata prefers German, then English, then authored first entry and ignores commented scripts', () => {
  const metadata = {$schema: 'https://raw.githubusercontent.com/verona-interfaces/metadata/master/verona-module-metadata.json',
    id: 'owned-player', version: '1.2.9', specVersion: '6.0',
    name: [{lang: 'fr', value: 'français'}, {lang: 'en', value: 'English'}, {lang: 'de', value: 'Deutsch'}],
    description: [{lang: 'fr', value: 'Premier'}]};
  const html = '<!-- <script type="application/ld+json">{"name":"private-imposter"}</script> -->' +
    '<html><script type="application/ld+json">' + JSON.stringify(metadata) + '</script></html>';
  const result = buildWorkspaceFileCatalog([file('player', 'Resource', 500, html, {resourceIdentifier: 'owned-player-1.2'})]).items[0]!.metadata;
  assert.equal(result.label, 'Deutsch'); assert.equal(result.description, 'Premier');
  assert.equal(result.veronaVersion, '6.0'); assert.equal(result.moduleVersion, '1.2.9');
  const legacy = buildWorkspaceFileCatalog([file('old', 'Resource', 90,
    '<html><title>Alter &amp; Titel</title><meta name="application-name" content="old" data-version="1.0.1" data-api-version="3" data-description="Alt"></html>')]);
  assert.equal(legacy.items[0]!.metadata.label, 'Alter & Titel'); assert.equal(legacy.items[0]!.metadata.veronaVersion, '3');
});

test('current-file selection retains immutable originals until a present non-rejected replacement exists', () => {
  const source = (id: string, status: SourcePackage['status'] = 'uploaded'): SourcePackage => ({
    sourcePackageId: id, tenantId: 'tenant', workspaceId: 'workspace', fileName: id, mediaType: 'text/plain',
    contentStructure: null, sourceDocument: 'owned', status, uploadedAt: stamp
  });
  const event = (id: string, replacement: string, type: WorkspaceActivityEvent['eventType'] = 'source_package_replaced'): WorkspaceActivityEvent => ({
    activityEventId: id, tenantId: 'tenant', workspaceId: 'workspace', subjectType: 'source_package', subjectId: id,
    eventType: type, occurredAt: stamp, actorId: null, summary: 'owned', details: {replacementSourcePackageId: replacement}
  });
  const sources = [source('old'), source('new'), source('failed-old'), source('failed', 'rejected'), source('absent-old'), source('assembly')];
  const events = [event('old', 'new'), event('failed-old', 'failed'), event('absent-old', 'absent'), event('assembly', '', 'source_package_assembled')];
  assert.deepEqual(selectCurrentWorkspaceFiles(sources, events).map(item => item.sourcePackageId), ['new', 'failed-old', 'failed', 'absent-old']);
  assert.equal(sources.length, 6); assert.equal(events.length, 4);
});
