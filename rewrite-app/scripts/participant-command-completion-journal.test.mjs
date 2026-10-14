import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
import { resolveRoutePath } from '@testcenter-rewrite-app/contracts';
import { participantCommandCompletionRoute, isParticipantCommandCompletionRequest } from '@testcenter-rewrite-app/contracts/participant-native-command';

const source = readFileSync(new URL('../apps/web/src/app/participant-command-completion.ts', import.meta.url), 'utf8');
const ast = ts.createSourceFile('completion.ts', source, ts.ScriptTarget.Latest, true);
assert.equal(ast.parseDiagnostics.length, 0);
const statements = ast.statements.filter(node => !ts.isImportDeclaration(node)).map(node => node.getText(ast).replace(/^export /, ''));
const compiled = ts.transpileModule(`export const load = (participantCommandCompletionRoute, isParticipantCommandCompletionRequest, resolveRoutePath, readParticipantSessionCredential) => {
 ${statements.join('\n')}; return createParticipantCommandCompletions;
};`, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext } }).outputText;
const { load } = await import('data:text/javascript;base64,' + Buffer.from(compiled).toString('base64'));
const create = load(participantCommandCompletionRoute, isParticipantCommandCompletionRequest, resolveRoutePath, () => null);
const scope = { tenantId: 'tenant', workspaceId: 'workspace', participantSessionId: 'session', testRunId: 'run', contentReleaseId: 'release', bookletKey: 'booklet' };
const packet = () => ({ testRunId: 'run', contentReleaseId: 'release', bookletKey: 'booklet', timeStamp: 1791936020000,
  command: { kind: 'remote', commandId: 'owned-command' } });
const flush = async () => { for (let index = 0; index < 30; index++) await Promise.resolve(); };
const fixture = (values = new Map(), responder, denied = false) => {
  const calls = [], failures = [], timers = new Map(), listeners = new Map(); let time = 0, timerId = 0, credential = 'Owned fresh credential';
  const storage = { get length() { return values.size; }, key: index => [...values.keys()][index] ?? null,
    getItem: key => values.get(key) ?? null, setItem: (key, value) => { if (denied) throw Error('denied'); values.set(key, value); }, removeItem: key => values.delete(key) };
  const window = { addEventListener: (name, callback) => listeners.set(name, callback), removeEventListener: (name, callback) => {
    if (listeners.get(name) === callback) listeners.delete(name);
  }, setTimeout: (callback, milliseconds) => { const id = ++timerId; timers.set(id, { callback, at: time + milliseconds }); return id; }, clearTimeout: id => timers.delete(id) };
  const receipt = body => ({ ok: true, json: async () => ({ completion: { ...body, scope: { ...scope }, applied: false, acceptedAt: '2026-10-14T00:00:30.000Z' } }) });
  const queue = create({ window, storage, now: () => time, readCredential: () => credential, failed: error => failures.push(error.message),
    fetch: async (url, request) => { const body = JSON.parse(request.body); calls.push({ url, request, body }); return responder ? responder(body, calls.length, request, receipt) : receipt(body); } });
  return { queue, calls, failures, values, listeners, timers, receipt,
    credential(value) { credential = value; },
    async advance(value) { time = value; for (const [id, timer] of [...timers]) if (timer.at <= time) { timers.delete(id); timer.callback(); } await flush(); } };
};

test('completion captures exact packet and fresh credentials without persisting any credential or Run snapshot', async () => {
  const f = fixture(); try {
    const original = packet(); f.queue.complete({ ...scope, unitResponses: { secret: 'never stored' } }, original);
    const stored = [...f.values.values()].join(); assert.ok(stored.includes(String(original.timeStamp))); assert.ok(!stored.includes('credential')); assert.ok(!stored.includes('never stored'));
    original.timeStamp++; await f.queue.drain();
    assert.equal(f.calls.length, 1); assert.deepEqual(f.calls[0].body, packet());
    assert.equal(f.calls[0].url, '/api/v1/participant/sessions/session/command-completions');
    assert.equal(f.calls[0].request.headers.authorization, 'Bearer Owned fresh credential');
    assert.equal(f.calls[0].request.cache, 'no-store'); assert.equal(f.values.size, 0); assert.deepEqual(f.failures, []);
    f.queue.complete(scope, { ...packet(), timeStamp: packet().timeStamp + 50_000 }); await f.queue.drain(); assert.equal(f.calls.length, 1);
  } finally { f.queue.stop(); }
});

test('a lost completion reply retries the exact completed packet without repeating a command effect', async () => {
  const f = fixture(new Map(), (body, count, _request, receipt) => { if (count === 1) throw Error('lost receipt'); return receipt(body); });
  try {
    f.queue.complete(scope, packet()); await f.queue.drain(); assert.equal(f.calls.length, 1); assert.equal(f.values.size, 1);
    f.credential('Rotated fresh credential'); await f.advance(5_000); await f.queue.drain();
    assert.equal(f.calls.length, 2); assert.equal(f.calls[0].request.body, f.calls[1].request.body);
    assert.equal(f.calls[1].request.headers.authorization, 'Bearer Rotated fresh credential'); assert.equal(f.values.size, 0);
    assert.ok(f.calls.every(call => call.url.endsWith('/command-completions')));
  } finally { f.queue.stop(); }
});

test('document replacement restores only observed-session completed packets with their first timestamp', async () => {
  const first = fixture(new Map(), () => { throw Error('offline'); });
  first.queue.complete(scope, packet()); await first.queue.drain(); const persisted = new Map(first.values); first.queue.stop();
  assert.equal(first.listeners.size, 0); assert.equal(first.timers.size, 0);
  const next = fixture(persisted); try {
    await next.queue.drain(); assert.equal(next.calls.length, 0);
    next.queue.observeSession('session'); await next.queue.drain();
    assert.equal(next.calls.length, 1); assert.equal(next.calls[0].request.body, first.calls[0].request.body); assert.equal(next.values.size, 0);
  } finally { next.queue.stop(); }
});

for (const field of ['testRunId', 'contentReleaseId', 'bookletKey']) test(`a forged completion receipt with another ${field} retains the exact journal`, async () => {
  const f = fixture(new Map(), (body, _count, _request, receipt) => ({ ok: true, json: async () => {
    const value = await receipt(body).json(); value.completion.scope[field] = 'foreign'; return value;
  } }));
  try { f.queue.complete(scope, packet()); await f.queue.drain(); assert.equal(f.values.size, 1); assert.equal(f.failures.length, 1); }
  finally { f.queue.stop(); }
});

test('another session, malformed entries and unrelated storage remain untouched', async () => {
  const first = fixture(new Map(), () => { throw Error('offline'); }); first.queue.complete(scope, packet()); await first.queue.drain();
  const ownedKey = [...first.values.keys()][0], value = JSON.parse(first.values.get(ownedKey)); first.queue.stop();
  const foreign = structuredClone(value); foreign.scope.participantSessionId = 'foreign-session';
  const foreignKey = ownedKey.replace('"session"', '"foreign-session"');
  const values = new Map([[foreignKey, JSON.stringify(foreign)], ['unrelated', 'protected'], [ownedKey, '{broken']]);
  const f = fixture(values); try {
    f.queue.observeSession('session'); await f.queue.drain(); assert.equal(f.calls.length, 0); assert.equal(values.size, 3);
  } finally { f.queue.stop(); }
});

test('denied browser storage still delivers this document completion without delaying the fulfilled handler', async () => {
  const f = fixture(new Map(), undefined, true); try { f.queue.complete(scope, packet()); await f.queue.drain(); assert.equal(f.calls.length, 1); assert.equal(f.values.size, 0); }
  finally { f.queue.stop(); }
});

test('a stalled HTTP completion times out and preserves its packet for a separate retry', async () => {
  const f = fixture(new Map(), (_body, count, request, receipt) => count === 1 ? new Promise((_, reject) => {
    request.signal.addEventListener('abort', () => reject(Error('aborted')), { once: true });
  }) : receipt(_body));
  try {
    f.queue.complete(scope, packet()); const waiting = f.queue.drain(); await f.advance(25_000); await waiting;
    assert.equal(f.calls[0].request.signal.aborted, true); assert.equal(f.values.size, 1);
    await f.advance(30_000); await f.queue.drain(); assert.equal(f.calls.length, 2); assert.equal(f.values.size, 0);
  } finally { f.queue.stop(); }
});

test('a temporarily older API cannot permanently strand an already-completed command', async () => {
  const f = fixture(new Map(), (body, count, _request, receipt) => count === 1 ? { ok: false, status: 404 } : receipt(body));
  try {
    f.queue.complete(scope, packet()); await f.queue.drain(); assert.equal(f.values.size, 1);
    await f.advance(5_000); await f.queue.drain(); assert.equal(f.calls.length, 1);
    await f.advance(60_000); await f.queue.drain(); assert.equal(f.calls.length, 2);
    assert.equal(f.calls[0].request.body, f.calls[1].request.body); assert.equal(f.values.size, 0);
  } finally { f.queue.stop(); }
});

for (const change of [value => { value.timeStamp = Infinity; }, value => { value.authorization = 'do not deliver'; },
  value => { value.command.commandId = ''; }, value => { value.command.unknown = true; }, value => { value.bookletKey = 'foreign'; }]) {
  test('invalid completion packets cannot enter the journal or issue a request', async () => {
    const f = fixture(); try { const value = packet(); change(value); assert.throws(() => f.queue.complete(scope, value)); assert.equal(f.values.size, 0); assert.equal(f.calls.length, 0); }
    finally { f.queue.stop(); }
  });
}
