import assert from 'node:assert/strict';
import test from 'node:test';
import type { SourcePackage } from '@testcenter-rewrite-app/domain';
import { createOriginalResourcePackages } from './original-resource-package.js';
test('archive metadata counts directory entries and reuses complete validated immutable cache entries', () => {
    let decodes = 0, reads = 0, comments = 0;
    const source: SourcePackage = { sourcePackageId: 'owned', tenantId: 'tenant', workspaceId: 'workspace', fileName: 'Resource/owned.itcr.zip', mediaType: 'application/zip', sourceDocument: 'first', contentStructure: null, status: 'accepted', uploadedAt: '2026-11-06T00:00:00Z' };
    const packages = createOriginalResourcePackages({ decode: value => { decodes++; return { bytes: Buffer.from(value.sourceDocument!) }; },
        entries: () => [{ fileName: 'folder/', uncompressedSize: 0 }, { fileName: 'folder/member.txt', uncompressedSize: 1 }],
        read: (_bytes, entry) => { reads++; return Buffer.from(entry.fileName.endsWith('/') ? '' : 'x'); }, safe: () => true, normalize: path => path.replace(/\/$/, ''),
        comment: () => { comments++; return '  Authored archive Ω  '; } });
    packages.validate(source);
    assert.equal(decodes, 1);
    assert.equal(reads, 2);
    const metadata = packages.metadata(source);
    assert.deepEqual(metadata, { entryCount: 2, comment: '  Authored archive Ω  ' });
    metadata.entryCount = 999;
    assert.equal(packages.metadata(source).entryCount, 2);
    assert.equal(decodes, 1);
    assert.equal(reads, 2);
    assert.equal(comments, 1);
    assert.equal(packages.read(source, 'folder/member.txt')?.toString(), 'x');
    assert.equal(reads, 3);
    packages.metadata({ ...source, sourceDocument: 'replacement' });
    assert.equal(decodes, 2);
    assert.equal(reads, 5);
    packages.metadata({ ...source, workspaceId: 'foreign' });
    assert.equal(decodes, 3, 'A different workspace cannot select the prior cache entry.');
});
