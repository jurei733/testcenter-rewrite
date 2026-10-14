import assert from 'node:assert/strict';
import { randomUUID, createHash } from 'node:crypto';
import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import ts from 'typescript';
import { createFirstSliceServices } from '@testcenter-rewrite-app/application';
import { compileBookletRuntimePolicy, resolveRoutePath } from '@testcenter-rewrite-app/contracts';
import { participantNativeCommandRoute, participantNativeCommandKeywords, isParticipantControllerDispatch,
  isParticipantControllerDispatches, participantControllerTimerInterruptionRoute,
  isParticipantControllerTimerInterruptionRequest, participantCommandCompletionRoute, isParticipantCommandCompletionRequest } from '@testcenter-rewrite-app/contracts/participant-native-command';
import { createInMemoryFirstSliceRepository } from '@testcenter-rewrite-app/memory-store';
import { createFileFirstSliceStorage } from '@testcenter-rewrite-app/file-store';
import { createSqliteFirstSliceStorage } from '@testcenter-rewrite-app/sqlite-store';
import { createOriginalCompletionReference, referenceMicrotasks, completionReference } from './original-controller-completion-reference.mjs';

const source = await readFile(new URL('../apps/web/src/app/participant-native-command.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('native.ts', source, ts.ScriptTarget.Latest, true);
assert.equal(ast.parseDiagnostics.length, 0);
const statements = ast.statements.filter(node => !ts.isImportDeclaration(node)).map(node => node.getText(ast).replace(/^export /, ''));
const compiled = ts.transpileModule(`export const load = (participantNativeCommandRoute, participantNativeCommandKeywords,
  resolveRoutePath, readParticipantSessionCredential, isParticipantControllerDispatch, isParticipantControllerDispatches,
  participantControllerTimerInterruptionRoute, isParticipantControllerTimerInterruptionRequest) => {
  ${statements.join('\n')}; return createParticipantNativeCommands;
};`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { load } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const create = load(participantNativeCommandRoute, participantNativeCommandKeywords, resolveRoutePath,
  () => 'Owned audit credential', isParticipantControllerDispatch, isParticipantControllerDispatches,
  participantControllerTimerInterruptionRoute, isParticipantControllerTimerInterruptionRequest);
const completionSource = await readFile(new URL('../apps/web/src/app/participant-command-completion.ts', import.meta.url), 'utf8');
const completionAst = ts.createSourceFile('completion.ts', completionSource, ts.ScriptTarget.Latest, true);
const completionStatements = completionAst.statements.filter(node => !ts.isImportDeclaration(node)).map(node => node.getText(completionAst).replace(/^export /, ''));
const completionCompiled = ts.transpileModule(`export const load = (participantCommandCompletionRoute, isParticipantCommandCompletionRequest, resolveRoutePath, readParticipantSessionCredential) => {
 ${completionStatements.join('\n')}; return createParticipantCommandCompletions;
};`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { load: loadCompletions } = await import('data:text/javascript;base64,' + Buffer.from(completionCompiled).toString('base64'));
const createCompletions = loadCompletions(participantCommandCompletionRoute, isParticipantCommandCompletionRequest, resolveRoutePath, () => 'Owned audit credential');
const deferred = () => { let resolve; const promise = new Promise(done => { resolve = done; }); return { promise, resolve }; };
const bounded = async promise => {
  let timeout;
  try { return await Promise.race([promise, new Promise((_, reject) => { timeout = setTimeout(() => reject(new Error('Owned completion audit exceeded 10 seconds.')), 10_000); })]); }
  finally { clearTimeout(timeout); }
};
const epoch = Date.parse('2026-10-14T00:00:00.000Z');
const original = createOriginalCompletionReference();
let expected;
try {
  original.setClock(epoch); original.seedAnswer(); original.receive(); await original.buffersClosed;
  original.setClock(epoch + 10_000);
  for (const type of Object.keys(original.writes)) original.release(type);
  await referenceMicrotasks();
  assert.equal(original.navigations.length, 1); assert.deepEqual(original.logs, []);
  original.setClock(epoch + 20_000); original.releaseNavigation(); await referenceMicrotasks();
  assert.deepEqual(original.logs, [{ key: 'command executed', timeStamp: epoch + 20_000, content: 'terminate' }]);
  expected = { commandLogsBeforeNavigationCompletes: 0, completionTimeStamp: epoch + 20_000,
    events: original.events, logs: original.logs };
} finally { original.stop(); }

const cases = [];
for (const kind of ['memory', 'file', 'sqlite']) {
  const directory = await mkdtemp(join(tmpdir(), 'testcenter-command-completion-audit-'));
  let storage, transport, completionTransport;
  const projection = deferred();
  try {
    storage = kind === 'memory' ? { repository: createInMemoryFirstSliceRepository(), shutdown: async () => {} }
      : kind === 'file' ? await createFileFirstSliceStorage(join(directory, 'owned.json'))
      : await createSqliteFirstSliceStorage(join(directory, 'owned.sqlite'));
    const repository = storage.repository;
    let clock = epoch;
    const services = createFirstSliceServices({ repository, now: () => new Date(clock).toISOString() });
    const tenant = await services.platform.createTenant({ tenantKey: 'owned-' + randomUUID(), displayName: 'Owned completion audit' });
    const workspace = await services.platform.createWorkspace({ tenantKey: tenant.tenantKey, workspaceKey: 'owned', displayName: 'Owned completion audit' });
    const base = { tenantId: tenant.tenantId, workspaceId: workspace.workspaceId };
    const contentReleaseId = randomUUID(), participantSessionId = randomUUID(), testRunId = randomUUID();
    const timestamp = new Date(epoch).toISOString();
    const booklet = { bookletKey: 'owned', displayLabel: 'Owned', policy: compileBookletRuntimePolicy({}),
      testletEntries: [], unitEntries: [{ unitKey: 'alias', originalUnitId: 'authored-unit', displayLabel: 'Owned' }] };
    await repository.saveContentRelease({ ...base, contentReleaseId, importJobId: contentReleaseId, releaseLabel: 'Owned',
      status: 'active', createdAt: timestamp, activatedAt: timestamp, runtimeSnapshot: { bookletEntries: [booklet] } });
    const session = { ...base, participantSessionId, contentReleaseId, loginKey: 'owned', groupKey: 'owned',
      executionMode: 'run-hot-return', status: 'launched', createdAt: timestamp };
    await repository.saveParticipantSession(session);
    const run = { ...base, participantSessionId, contentReleaseId, testRunId, bookletKey: 'owned', bookletAssignmentKey: 'owned',
      executionMode: 'run-hot-return', status: 'running', currentUnitKey: 'alias', unitResponses: { alias: 'Exact Ä/β\n"; answer' },
      createdAt: timestamp, updatedAt: timestamp, completedAt: null };
    await repository.saveTestRun(run);
    const prepare = deferred(), preparing = deferred(), projecting = deferred(), projected = deferred(), errors = [], requests = [];
    const values = new Map();
    const localStorage = { get length() { return values.size; }, key: index => [...values.keys()][index] ?? null,
      getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
    const browserWindow = { addEventListener() {}, removeEventListener() {}, setTimeout, clearTimeout };
    completionTransport = createCompletions({ window: browserWindow, storage: localStorage,
      fetch: async (url, request) => {
        assert.equal(url, resolveRoutePath(participantCommandCompletionRoute, { participantSessionId }));
        const packet = JSON.parse(request.body);
        const completion = await services.participantRuntime.completeCommand({ participantSessionId, ...packet });
        return { ok: true, json: async () => ({ completion }) };
      } });
    transport = create({ readState: () => ({ testRun: run }), controllerStatus: () => 'RUNNING', ownerId: 'owned-completion-audit',
      completed: (scope, request) => completionTransport.complete(scope, { testRunId, contentReleaseId, bookletKey: 'owned', command: { kind: 'native', request }, timeStamp: clock }),
      window: browserWindow, storage: localStorage, now: () => clock, id: () => randomUUID(),
      prepare: async () => { preparing.resolve(); await prepare.promise; },
      applied: async () => { projecting.resolve(); await projection.promise; projected.resolve(); },
      failed: error => errors.push(error.message), fetch: async (url, request) => {
        assert.equal(url, resolveRoutePath(participantNativeCommandRoute, { participantSessionId }));
        const body = JSON.parse(request.body); requests.push(body);
        // Real application service and each real adapter; HTTP routing and the
        // Angular view are outside this controlled differential witness.
        const application = await services.participantRuntime.executeNativeCommand({ participantSessionId, ...body });
        return { ok: true, json: async () => ({ application }) };
      } });
    const commandLogs = async () => (await repository.listParticipantTestLogsByWorkspace(base.tenantId, base.workspaceId)).filter(log => log.logKey === 'command executed');
    transport.command('terminate', []); await bounded(preparing.promise);
    assert.deepEqual(await commandLogs(), []);
    clock = epoch + 10_000; prepare.resolve(); await bounded(projecting.promise);
    const before = await commandLogs();
    const committed = await repository.getTestRunById(testRunId);
    assert.equal(committed.status, 'paused'); assert.equal(committed.unitResponses.alias, run.unitResponses.alias);
    clock = epoch + 20_000; projection.resolve(); await bounded(projected.promise); await referenceMicrotasks(); await bounded(completionTransport.drain());
    const after = await commandLogs();
    assert.ok([...before, ...after].every(log => Number.isSafeInteger(log.timestamp)), 'The witness must retain actual stored timestamps.');
    assert.deepEqual(errors, []);
    cases.push({ kind, beforeProjectionCompletes: before.map(log => ({ key: log.logKey, timeStamp: log.timestamp, content: log.logContent })),
      afterProjectionCompletes: after.map(log => ({ key: log.logKey, timeStamp: log.timestamp, content: log.logContent })),
      requestTimeStamp: requests[0].timeStamp, projectionCompletedAt: clock,
      commandLogsBeforeProjectionCompletes: before.length, parity: before.length === expected.commandLogsBeforeNavigationCompletes &&
        after.length === 1 && after[0].timestamp === expected.completionTimeStamp });
  } finally { projection.resolve(); transport?.stop(); completionTransport?.stop(); await storage?.shutdown(); await rm(directory, { recursive: true, force: true }); }
}
const arguments_ = process.argv.slice(2);
assert.ok(arguments_.filter(value => !value.startsWith('--')).length <= 1 && arguments_.every(value => !value.startsWith('--') || value === '--assert-parity'), 'Pass an optional report path and --assert-parity.');
const reportPath = arguments_.find(value => value !== '--assert-parity');
const report = { sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  referenceCommit: completionReference.originalCommit, completionTransportSha256: createHash('sha256').update(completionSource).digest('hex'), nativeTransportSha256: createHash('sha256').update(source).digest('hex'),
  scope: 'Actual Original buffers and completion callback versus actual Rewrite native transport, application service and Memory/File/SQLite adapters; controlled backend/router on Original and controlled transport/view projection on Rewrite. No full Angular browser or HTTP proof.',
  expected, cases, parity: cases.every(value => value.parity) };
if (reportPath) await writeFile(resolve(reportPath), JSON.stringify(report, null, 2) + '\n');
console.log(JSON.stringify({ parity: report.parity, cases: cases.map(({ kind, commandLogsBeforeProjectionCompletes, requestTimeStamp, projectionCompletedAt, parity }) =>
  ({ kind, commandLogsBeforeProjectionCompletes, requestTimeStamp, projectionCompletedAt, parity })) }, null, 2));
if (arguments_.includes('--assert-parity') && !report.parity) process.exitCode = 1;
