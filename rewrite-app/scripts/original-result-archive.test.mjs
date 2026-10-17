import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import { Pool } from 'pg';
import { createFirstSliceServices } from '@testcenter-rewrite-app/application';
import { compileBookletRuntimePolicy } from '@testcenter-rewrite-app/contracts';
import { createInMemoryFirstSliceRepository } from '@testcenter-rewrite-app/memory-store';
import { createFileFirstSliceStorage } from '@testcenter-rewrite-app/file-store';
import { createSqliteFirstSliceStorage } from '@testcenter-rewrite-app/sqlite-store';
import { createPostgresFirstSliceStorage } from '@testcenter-rewrite-app/postgres-store';

const timestamp = '2026-10-17T00:00:00.000Z';
const reportNames = ['responses', 'logs', 'reviews'];
const readArchive = ({ body }) => {
  const entries = new Map();
  let offset = 0;
  while (body.readUInt32LE(offset) === 0x04034b50) {
    assert.equal(body.readUInt16LE(offset + 8), 0);
    const length = body.readUInt32LE(offset + 18), nameLength = body.readUInt16LE(offset + 26);
    const start = offset + 30 + nameLength + body.readUInt16LE(offset + 28), end = start + length;
    assert.ok(end <= body.length);
    entries.set(body.subarray(offset + 30, offset + 30 + nameLength).toString('utf8'), body.subarray(start, end).toString('utf8'));
    offset = end;
  }
  assert.equal(entries.size, 7);
  return { manifest: JSON.parse(entries.get('manifest.json')), entries,
    rows: Object.fromEntries(reportNames.map(name => [name, JSON.parse(entries.get(name + '.json'))])) };
};
const kinds = ['memory', 'file', 'sqlite'];
if (process.env.FIRST_SLICE_STORE === 'postgres') { assert.ok(process.env.FIRST_SLICE_POSTGRES_URL); kinds.push('postgres'); }

for (const kind of kinds) test(`${kind}: Original archive distinguishes omitted and empty group selections`, async t => {
  const directory = await mkdtemp(join(tmpdir(), 'testcenter-report-selection-'));
  const schema = 'owned_report_' + randomUUID().replaceAll('-', '');
  const url = kind === 'postgres' ? new URL(process.env.FIRST_SLICE_POSTGRES_URL) : null;
  url?.searchParams.set('options', `-c search_path=${schema}`);
  const root = url ? new Pool({ connectionString: process.env.FIRST_SLICE_POSTGRES_URL }) : null;
  let storage, repository, created = false;
  const open = async () => {
    storage = kind === 'memory' ? storage ?? { repository: createInMemoryFirstSliceRepository(), shutdown: async () => {} }
      : kind === 'file' ? await createFileFirstSliceStorage(join(directory, 'owned.json'))
      : kind === 'sqlite' ? await createSqliteFirstSliceStorage(join(directory, 'owned.sqlite'))
      : await createPostgresFirstSliceStorage(url.toString());
    repository = storage.repository;
  };
  const services = () => createFirstSliceServices({ repository, now: () => timestamp });
  try {
    if (root) { await root.query(`CREATE SCHEMA "${schema}"`); created = true; }
    await open();
    const tenant = await services().platform.createTenant({ tenantKey: 'owned-' + randomUUID(), displayName: 'Owned report test' });
    const seedWorkspace = async workspaceKey => {
      const workspace = await services().platform.createWorkspace({ tenantKey: tenant.tenantKey, workspaceKey, displayName: workspaceKey });
      const scope = { tenantId: tenant.tenantId, workspaceId: workspace.workspaceId }, contentReleaseId = randomUUID();
      await repository.saveContentRelease({ ...scope, contentReleaseId, importJobId: contentReleaseId,
        releaseLabel: 'Owned', status: 'active', createdAt: timestamp, activatedAt: timestamp,
        runtimeSnapshot: { bookletEntries: [{ bookletKey: 'owned', displayLabel: 'Owned booklet', policy: compileBookletRuntimePolicy({}),
          testletEntries: [], unitEntries: [{ unitKey: 'unit', originalUnitId: 'authored', displayLabel: 'Owned Unit' }] }] } });
      return { ...scope, contentReleaseId };
    };
    const workspace = await seedWorkspace('owned'), foreign = await seedWorkspace('foreign');
    const seed = async (scope, groupKey) => {
      const id = randomUUID();
      await repository.saveParticipantSession({ ...scope, participantSessionId: id, loginKey: groupKey, groupKey,
        executionMode: 'run-hot-return', status: 'launched', createdAt: timestamp });
      await repository.saveTestRun({ ...scope, participantSessionId: id, testRunId: id, bookletKey: 'owned', bookletAssignmentKey: 'owned',
        executionMode: 'run-hot-return', status: 'running', currentUnitKey: 'unit', unitResponses: { unit: `Exact ${groupKey} Ω\n"; ` },
        createdAt: timestamp, updatedAt: timestamp, completedAt: null });
      await repository.saveParticipantTestLogs([{ ...scope, participantSessionId: id, testRunId: id, participantTestLogId: randomUUID(),
        unitKey: 'unit', originalUnitId: 'authored', logKey: 'OWNED', logContent: `Log ${groupKey} Ω`, timestamp: Date.parse(timestamp), recordedAt: timestamp }]);
      await services().workspaceReview.createReview({ tenantKey: tenant.tenantKey, workspaceKey: scope === workspace ? 'owned' : 'foreign',
        participantSessionId: id, testRunId: id, unitKey: 'unit', reviewerId: 'owned', category: 'quality', comment: `Review ${groupKey} Ω` });
    };
    for (const group of ['alpha', 'beta']) await seed(workspace, group);
    await seed(foreign, 'private-foreign');
    const scope = { tenantKey: tenant.tenantKey, workspaceKey: 'owned' };
    const report = async groupKeys => readArchive(await services().workspaceAdminRead.exportOriginalResultArchive({ ...scope, ...(groupKeys === undefined ? {} : { groupKeys }) }));

    await t.test('omission equals the union of all group reports in every CSV and JSON member', async () => {
      const all = await report(), selected = await report(['alpha', 'beta']);
      assert.deepEqual(all.manifest.groupKeys, ['alpha', 'beta']);
      for (const name of reportNames) {
        assert.equal(all.entries.get(name + '.csv'), selected.entries.get(name + '.csv'));
        assert.equal(all.entries.get(name + '.json'), selected.entries.get(name + '.json'));
        const union = (await Promise.all(['alpha', 'beta'].map(async group => (await report([group])).rows[name]))).flat();
        const ordered = rows => rows.map(row => JSON.stringify(row)).sort();
        assert.deepEqual(ordered(all.rows[name]), ordered(union));
        assert.deepEqual([...new Set(all.rows[name].map(row => row.groupname))].sort(), ['alpha', 'beta']);
        assert.match(all.entries.get(name + '.csv'), /^\uFEFF/);
      }
    });
    await t.test('explicit empty, blank-only and unknown selections never widen into all groups', async () => {
      for (const selection of [[], [' ', ''], ['absent']]) {
        const empty = await report(selection);
        for (const name of reportNames) assert.deepEqual(empty.rows[name], []);
        assert.deepEqual(empty.manifest.counts, { responses: 0, logs: 0, reviews: 0 });
      }
      assert.deepEqual((await report([' beta ', 'beta'])).manifest.groupKeys, ['beta']);
    });
    await t.test('unfiltered selection is workspace-scoped and survives durable reopen', async () => {
      const before = await report();
      if (kind !== 'memory') { await storage.shutdown(); await open(); }
      const after = await report();
      assert.deepEqual(after.rows, before.rows);
      assert.equal(JSON.stringify(after.rows).includes('private-foreign'), false);
      const emptyWorkspace = await services().platform.createWorkspace({ tenantKey: tenant.tenantKey, workspaceKey: 'empty', displayName: 'Empty' });
      const empty = readArchive(await services().workspaceAdminRead.exportOriginalResultArchive({ ...scope, workspaceKey: emptyWorkspace.workspaceKey }));
      assert.deepEqual(empty.manifest.groupKeys, []); assert.deepEqual(empty.manifest.counts, { responses: 0, logs: 0, reviews: 0 });
    });
    await t.test('all-groups default is not truncated to the explicit selection cap', async () => {
      for (let i = 0; i < 101; i++) await repository.saveParticipantSession({ ...workspace, participantSessionId: randomUUID(), loginKey: 'extra-' + i,
        groupKey: 'extra-' + i, executionMode: 'run-hot-return', status: 'signed_in', createdAt: timestamp });
      const all = await report(); assert.equal(all.manifest.groupKeys.length, 103); assert.equal(all.rows.responses.length, 2);
      await assert.rejects(() => report(all.manifest.groupKeys), error => error.errorCode === 'result_archive_group_limit_exceeded');
    });
  } finally {
    try { await storage?.shutdown(); }
    finally { try { if (created) await root.query(`DROP SCHEMA "${schema}" CASCADE`); }
      finally { await root?.end(); await rm(directory, { recursive: true, force: true }); } }
  }
});
