import assert from 'node:assert/strict';
import test from 'node:test';
import type { WorkspaceCatalogInput } from './workspace-file-catalog.js';
import { workspaceFileReplacementConflict as conflict } from './workspace-file-replacement.js';

const xml = (type: string, id: string) => `<${type}><Metadata><Id>${id}</Id></Metadata></${type}>`;
const file = (sourceText: string | null, extra: Partial<WorkspaceCatalogInput> = {}): WorkspaceCatalogInput => ({
  sourcePackageId: 'owned', fileName: 'unit.xml', fileType: 'Unit', status: 'uploaded', uploadedAt: '2026-10-22T12:00:00Z',
  fileSizeBytes: 10, sourceText, resourceIdentifier: null, ...extra
});
const player = (id: string, version: string) => file('<html><script type="application/ld+json">' + JSON.stringify({
  $schema: 'https://raw.githubusercontent.com/verona-interfaces/metadata/master/verona-module-metadata.json',
  id, version, specVersion: '6.0', type: 'player'
}) + '</script></html>', {fileName: 'custom-player.html', fileType: 'Resource',
  resourceIdentifier: id + '-' + version.split('.').slice(0, 2).join('.')});

test('Source overwrite IDs permit ASCII casing and PHP trim but preserve Unicode distinctions', () => {
  assert.equal(conflict(file(xml('Unit', ' U-ä ')), file(xml('Unit', 'u-ä'))), null);
  assert.equal(conflict(file(xml('Unit', 'U-ä')), file(xml('Unit', 'U-Ä')))?.code, 'workspace_file_identifier_mismatch');
});
test('same name cannot overwrite a different authored ID or file type', () => {
  assert.equal(conflict(file(xml('Unit', 'first')), file(xml('Unit', 'second')))?.code, 'workspace_file_identifier_mismatch');
  assert.equal(conflict(file(xml('Unit', 'same')), file(xml('Booklet', 'same'), {fileType: 'Booklet'}))?.code, 'workspace_file_type_mismatch');
});
test('Source module identity keeps case even when the public file ID normalizes case', () => {
  assert.equal(conflict(player('Owned', '1.2.9'), player('owned', '1.2.9'))?.code, 'workspace_file_module_id_mismatch');
});
test('Source permits patch upgrades and downgrades within the same Player identity', () => {
  assert.equal(conflict(player('owned', '1.2.9'), player('owned', '1.2.1')), null);
  assert.equal(conflict(player('owned', '1.2.1'), player('owned', '1.2.99')), null);
  assert.equal(conflict(player('owned', '1.2.1'), player('owned', '1.3.0'))?.code, 'workspace_file_identifier_mismatch');
});
test('Source legacy filename versions remain authoritative when metadata has no nonzero module version', () => {
  const unversioned = file('<html></html>', {fileName: 'LegacyV4.html', fileType: 'Resource'});
  const zero = {...player('ignored-metadata-module', '0.0.0'), fileName: 'LegacyV4.html'};
  assert.equal(conflict(unversioned, zero), null, 'Explicit 0.0.0 falls back just like missing metadata in Source.');
  const renamedModule = {...player('other', '4.0.1'), fileName: 'LegacyV4.html'};
  assert.equal(conflict(unversioned, renamedModule)?.code, 'workspace_file_identifier_mismatch');
});
test('ordinary binary resources keep their filename identity and do not inspect or expose raw content', () => {
  const oldFile = file('PRIVATE_OLD_BYTES', {fileName: 'picture.bin', fileType: 'Resource'});
  const newFile = file('PRIVATE_NEW_BYTES', {fileName: 'picture.bin', fileType: 'Resource'});
  assert.equal(conflict(oldFile, newFile), null);
  const result = conflict(oldFile, {...newFile, fileType: 'Unit'});
  assert.ok(!JSON.stringify(result).includes('PRIVATE_'));
});
test('upload containers require member materialization instead of masquerading as loose files', () => {
  assert.equal(conflict(file(null, {fileType: 'Package'}), file(null))?.code, 'workspace_file_container_replacement_unsupported');
});
