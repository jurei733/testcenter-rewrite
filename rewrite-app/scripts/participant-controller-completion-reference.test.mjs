import assert from 'node:assert/strict';
import test from 'node:test';
import { createOriginalCompletionReference, referenceMicrotasks } from './original-controller-completion-reference.mjs';

for (const order of [['unitData', 'unitState', 'testState'], ['testState', 'unitData', 'unitState'], ['unitState', 'testState', 'unitData']]) {
  test(`actual Original termination waits for all three saved buffers: ${order.join(', ')}`, { timeout: 5_000 }, async () => {
    const f = createOriginalCompletionReference();
    try {
      f.seedAnswer(); f.receive(['lock']); await f.buffersClosed; await referenceMicrotasks();
      assert.equal(f.service.state$.getValue(), 'TERMINATED');
      assert.deepEqual(Object.values(f.writes).map(values => values.length), [1, 1, 1]);
      assert.equal(f.writes.unitData[0].args[3].main, 'Exact Ä/β\n"; answer');
      assert.deepEqual(f.writes.testState[0].args[0].state.map(entry => entry.content), ['RUNNING', 'TERMINATED']);
      assert.deepEqual(f.flushEvents.filter(event => event.event === 'closed').map(event => event.type).sort(), ['testState', 'unitData', 'unitState']);
      assert.deepEqual(f.logs, []); assert.deepEqual(f.locks, []); assert.deepEqual(f.navigations, []);
      for (const [index, type] of order.entries()) {
        f.setClock(20_000 + index); f.release(type); await referenceMicrotasks();
        assert.deepEqual(f.logs, []); assert.deepEqual(f.navigations, []);
        assert.equal(f.locks.length, Number(index === 2));
      }
      f.setClock(30_000); f.releaseLock(); await referenceMicrotasks();
      assert.equal(f.navigations.length, 1); assert.deepEqual(f.logs, []);
      f.setClock(40_000); f.releaseNavigation(); await referenceMicrotasks();
      assert.deepEqual(f.logs, [{ key: 'command executed', timeStamp: 40_000, content: 'terminate lock' }]);
      assert.deepEqual(f.events.map(event => event.phase), ['interrupt', 'write:unitData', 'write:unitState', 'write:testState', 'lock', 'navigate', 'command-complete']);
    } finally { f.stop(); }
  });
}

test('actual Original command completion is still recorded when navigation resolves false', { timeout: 5_000 }, async () => {
  const f = createOriginalCompletionReference({ navigationResult: false });
  try {
    f.receive(); await f.buffersClosed; await referenceMicrotasks();
    assert.equal(f.writes.unitData.length, 0); assert.equal(f.writes.unitState.length, 0);
    assert.equal(f.writes.testState.length, 1); assert.deepEqual(f.navigations, []);
    f.release('testState'); await referenceMicrotasks(); assert.equal(f.navigations.length, 1);
    assert.deepEqual(f.logs, []); f.setClock(50_000); f.releaseNavigation(); await referenceMicrotasks();
    assert.deepEqual(f.logs, [{ key: 'command executed', timeStamp: 50_000, content: 'terminate' }]);
  } finally { f.stop(); }
});

test('actual Original non-saving termination closes all buffers without waiting for response writes', { timeout: 5_000 }, async () => {
  const f = createOriginalCompletionReference({ saveResponses: false });
  try {
    f.seedAnswer(); f.receive(); await f.buffersClosed; await referenceMicrotasks();
    assert.deepEqual(Object.values(f.writes).map(values => values.length), [0, 0, 0]);
    assert.equal(f.flushEvents.filter(event => event.event === 'saved').length, 3);
    assert.equal(f.navigations.length, 1); assert.deepEqual(f.logs, []);
    f.releaseNavigation(); await referenceMicrotasks(); assert.equal(f.logs.length, 1);
    // The Original invokes its backend here; whether non-saving logs are
    // accepted belongs to that backend, not this frontend source oracle.
  } finally { f.stop(); }
});

test('actual Original already-TERMINATED command logs immediately without saving, locking or navigation', { timeout: 5_000 }, async () => {
  const f = createOriginalCompletionReference({ initial: 'TERMINATED' });
  try {
    f.receive(['lock']); await referenceMicrotasks();
    assert.deepEqual(f.logs, [{ key: 'command executed', timeStamp: 10_000, content: 'terminate lock' }]);
    assert.deepEqual(f.events.map(event => event.phase), ['command-complete']);
    assert.deepEqual(Object.values(f.writes).map(values => values.length), [0, 0, 0]);
  } finally { f.stop(); }
});

test('actual Original repeated terminate can complete before the first command saves its real buffers', { timeout: 5_000 }, async () => {
  const f = createOriginalCompletionReference();
  try {
    f.seedAnswer(); f.receive(); await f.buffersClosed; await referenceMicrotasks();
    f.setClock(20_000); f.receive(['lock']); await referenceMicrotasks();
    assert.deepEqual(f.logs.map(log => [log.content, log.timeStamp]), [['terminate lock', 20_000]]);
    assert.deepEqual(f.locks, []); assert.deepEqual(f.navigations, []);
    for (const type of Object.keys(f.writes)) f.release(type);
    await referenceMicrotasks(); f.setClock(30_000); f.releaseNavigation(); await referenceMicrotasks();
    assert.deepEqual(f.logs.map(log => [log.content, log.timeStamp]), [['terminate lock', 20_000], ['terminate', 30_000]]);
  } finally { f.stop(); }
});

test('actual Original paused termination keeps TERMINATED_PAUSED through buffer and lock completion', { timeout: 5_000 }, async () => {
  const f = createOriginalCompletionReference({ initial: 'PAUSED' });
  try {
    f.seedAnswer(); f.receive(['lock']); await f.buffersClosed; await referenceMicrotasks();
    assert.equal(f.service.state$.getValue(), 'TERMINATED_PAUSED');
    assert.deepEqual(f.writes.testState[0].args[0].state.map(entry => entry.content), ['PAUSED', 'TERMINATED_PAUSED']);
    for (const type of Object.keys(f.writes)) f.release(type);
    await referenceMicrotasks(); f.releaseLock(); await referenceMicrotasks();
    assert.equal(f.service.state$.getValue(), 'TERMINATED_PAUSED'); assert.deepEqual(f.logs, []);
    f.releaseNavigation(); await referenceMicrotasks(); assert.equal(f.logs.length, 1);
  } finally { f.stop(); }
});

test('actual Original data buffer merges chunks before its held backend write without rewriting their strings', { timeout: 5_000 }, async () => {
  const f = createOriginalCompletionReference();
  try {
    f.seedAnswer();
    f.service.unitDataPartsBuffer$.next({ testId: '42', unitAlias: 'alias', dataParts: { page: '{"current":2}', main: 'Second exact Ω\n ' }, unitStateDataType: 'later-kind' });
    f.receive(); await f.buffersClosed; await referenceMicrotasks();
    assert.equal(f.writes.unitData.length, 1);
    assert.deepEqual(f.writes.unitData[0].args, ['42', 'alias', 'authored-unit', { main: 'Second exact Ω\n ', page: '{"current":2}' }, 'iqb-standard@1.0']);
    assert.deepEqual(f.logs, []);
  } finally { f.stop(); await referenceMicrotasks(); }
});
