import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import test from 'node:test';
import { inspectOriginalHtmlResource, guessOriginalResourceName, splitOriginalResourceVersion } from './original-resource-metadata.js';
import { buildWorkspaceFileCatalog, normalizeWorkspacePlayerResourceId, type WorkspaceCatalogInput } from './workspace-file-catalog.js';
import { readWorkspaceFileReport } from './original-workspace-file-report.js';
const root = resolve('test-fixtures/original-testcenter/source-workspace-results/native-workspace-zip-reports-http');
const inputs = JSON.parse(readFileSync(resolve(root, 'inputs.json'), 'utf8')) as Array<{
    label: string;
    entries: Array<{
        name: string;
        base64: string;
    }>;
}>;
const observations = JSON.parse(readFileSync(resolve(root, 'observations.json'), 'utf8'));
const reference = observations.rows.find((row: {
    label: string;
}) => row.label === 'metadata-files').value.Resource as Array<{
    name: string;
    id: string;
    report: {
        warning?: string[];
        info?: string[];
    };
    info: {
        label: string;
        description: string;
        veronaVersion?: string;
        version?: string;
    };
}>;
test('actual pinned Source HTML file catalog retains all six identities, fallback labels and notice channels', () => {
    assert.equal(observations.sourceCommit, 'eedae41840cbe90e5547c0211da818bdf620f5aa');
    const files = inputs.find(row => row.label === 'metadata-forms')!.entries.filter(row => row.name.endsWith('.html'));
    const rows: WorkspaceCatalogInput[] = files.map(row => ({ sourcePackageId: row.name, fileName: 'Resource/' + row.name, fileType: 'Resource', status: 'accepted',
        uploadedAt: '2026-11-06T00:00:00Z', fileSizeBytes: Buffer.from(row.base64, 'base64').length,
        sourceText: Buffer.from(row.base64, 'base64').toString(), resourceIdentifier: 'OLD-UNTRUSTED-INDEX-9.9' }));
    const catalog = buildWorkspaceFileCatalog(rows);
    for (const input of rows) {
        const expected = reference.find(row => row.name === input.sourcePackageId)!;
        const file = catalog.items.find(row => row.sourcePackageId === input.sourcePackageId)!;
        assert.equal(file.metadata.identifier, expected.id, input.fileName);
        assert.equal(file.metadata.label, expected.info.label, input.fileName);
        assert.equal(file.metadata.description, expected.info.description, input.fileName);
        assert.equal(file.metadata.veronaVersion, expected.info.veronaVersion ?? null, input.fileName);
        assert.equal(file.metadata.moduleVersion, expected.info.version ?? null, input.fileName);
        for (const level of ['warning', 'info'] as const) {
            assert.deepEqual(file.validationDiagnostics?.filter(row => row.severity === level).map(row => row.message) ?? [], expected.report[level] ?? [], input.fileName + ' ' + level);
            assert.deepEqual(readWorkspaceFileReport(input)[level] ?? [], expected.report[level] ?? [], input.fileName + ' upload ' + level);
        }
    }
    assert.equal(rows.length, 6);
});
test('unknown metadata schemas cannot publish raw schema values, script bodies or object coercion through the catalog', () => {
    const secret = 'private-player-body-and-schema';
    for (const value of [secret, { toString: secret }, [secret], null]) {
        const html = '<html><script type="application/ld+json">' + JSON.stringify({ $schema: value, id: 'ignored', version: '1.0.0' }) + '</script><script>' + secret + '</script></html>';
        const parsed = inspectOriginalHtmlResource('fallback-2.3.html', html);
        assert.equal(parsed.identifier, 'FALLBACK-2.3');
        assert.equal(parsed.label, 'fallback-2.3.0');
        assert.ok(!JSON.stringify(parsed.catalogWarnings).includes(secret));
        const catalog = buildWorkspaceFileCatalog([{ sourcePackageId: 'owned', fileName: 'fallback-2.3.html', fileType: 'Resource', status: 'uploaded', uploadedAt: '2026-11-06T00:00:00Z', fileSizeBytes: html.length, sourceText: html, resourceIdentifier: 'ignored' }]);
        assert.ok(!JSON.stringify(catalog).includes(secret));
    }
});
test('metadata remains inert and a legacy document title is retained before filename guessing', () => {
    const parsed = inspectOriginalHtmlResource('legacy-4.2.html', '<html><meta charset="utf-8"><title>  Authored Ω  </title><script>globalThis.ownedMetadataExecuted=true</script></html>');
    assert.equal(parsed.label, '  Authored Ω  ');
    assert.equal(parsed.identifier, 'LEGACY-4.2');
    assert.equal((globalThis as Record<string, unknown>).ownedMetadataExecuted, undefined);
    assert.deepEqual(parsed.warnings, ['No Metadata Element', 'Metadata missing. Version guessed from Filename.']);
});
test('actual pinned Source FileID and Version preserve filename rules, zero labels and exact PHP int64 boundaries', () => {
    const root = resolve('test-fixtures/original-testcenter/source-workspace-results/native-resource-version-primitives');
    const manifest = JSON.parse(readFileSync(resolve(root, 'manifest.json'), 'utf8'));
    for (const [name, sha] of Object.entries(manifest.files))
        assert.equal(createHash('sha256').update(readFileSync(resolve(root, name))).digest('hex'), sha, name);
    const reference = JSON.parse(readFileSync(resolve(root, 'observations.json'), 'utf8'));
    assert.equal(reference.sourceCommit, 'eedae41840cbe90e5547c0211da818bdf620f5aa');
    assert.equal(reference.sourceFilesMatched, true);
    assert.equal(reference.readOnlyContainer, true);
    assert.equal(reference.references.length, 12);
    assert.equal(reference.versions.length, 15);
    for (const row of reference.references) {
        const actual = guessOriginalResourceName(row.input);
        assert.equal(actual.moduleId, row.guess.module, row.input);
        for (const key of ['major', 'minor', 'patch'] as const)
            assert.equal(actual[key].toString(), row.guess[key], row.input + ' ' + key);
        assert.equal(actual.label, row.guess.label, row.input);
        const normalized = normalizeWorkspacePlayerResourceId(row.input);
        if (row.input === '' || row.input === '0')
            assert.equal(normalized, null, 'Source XML caller ignores PHP-false player attributes.');
        else
            assert.equal(normalized!.replace(/[a-z]/g, letter => letter.toUpperCase()), row.id, row.input);
    }
    for (const row of reference.versions) {
        const actual = splitOriginalResourceVersion(row.input);
        for (const key of ['major', 'minor', 'patch'] as const)
            assert.equal(actual[key].toString(), row.parts[key], row.input + ' ' + key);
        assert.equal(actual.label, row.parts.label, row.input);
        assert.equal(actual.text, row.text ?? '', row.input);
    }
});
