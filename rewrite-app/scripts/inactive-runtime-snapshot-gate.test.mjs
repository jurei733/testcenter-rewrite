import assert from 'node:assert/strict';
import test from 'node:test';
import {createInactiveRuntimeSnapshotGate} from './inactive-runtime-snapshot-gate.mjs';

const response = (status, participantSessionId = 'owned') => ({status: () => 200,
  json: async () => ({runtimeState: {participantSession: {participantSessionId, status}, booklets: []}})});
test('a leading active read cannot consume the intended inactive snapshot hold', async () => {
  const release = Promise.withResolvers(), gate = createInactiveRuntimeSnapshotGate('owned', release.promise);
  await gate.observe(response('launched'));
  assert.equal(gate.leadingActiveReads, 1); assert.equal(gate.reads, 0); assert.equal(gate.heldSnapshot, null);
  let completed = false;
  const held = gate.observe(response('signed_in')).then(() => { completed = true; });
  await Promise.resolve(); await Promise.resolve();
  assert.equal(gate.reads, 1); assert.equal(completed, false);
  assert.equal(gate.holdPending, true);
  await gate.observe(response('launched'));
  assert.equal(gate.reads, 2); assert.equal(completed, false);
  assert.equal(gate.heldSnapshot.participantSession.status, 'signed_in');
  release.resolve(); await held; assert.equal(completed, true); assert.equal(gate.holdPending, false);
});
test('a later valid active read cannot hide the still-held inactive response before the observer polls', async () => {
  const release = Promise.withResolvers(), gate = createInactiveRuntimeSnapshotGate('owned', release.promise);
  const completed = [];
  const inactive = gate.observe(response('signed_in')).then(() => completed.push('inactive'));
  await Promise.resolve(); await Promise.resolve();
  await gate.observe(response('launched')).then(() => completed.push('active'));
  assert.deepEqual(completed, ['active']);
  assert.equal(gate.reads === 1, false, 'The former exact-count predicate loses this valid interleaving.');
  assert.equal(gate.reads, 2); assert.equal(gate.holdPending, true);
  assert.equal(gate.heldSnapshot.participantSession.status, 'signed_in');
  release.resolve(); await inactive;
  assert.deepEqual(completed, ['active', 'inactive']); assert.equal(gate.holdPending, false);
});
test('pre-release responses cannot satisfy the required read after the old response is released', async () => {
  const release = Promise.withResolvers(), gate = createInactiveRuntimeSnapshotGate('owned', release.promise);
  const inactive = gate.observe(response('signed_in'));
  await Promise.resolve(); await Promise.resolve(); await gate.observe(response('launched'));
  const beforeRelease = gate.reads; assert.equal(beforeRelease, 2);
  release.resolve(); await inactive;
  assert.equal(gate.reads > beforeRelease, false);
  await gate.observe(response('launched'));
  assert.equal(gate.reads > beforeRelease, true); assert.equal(gate.holdPending, false);
});
test('foreign participants cannot qualify the inactive observation', async () => {
  const gate = createInactiveRuntimeSnapshotGate('owned', Promise.resolve());
  await assert.rejects(gate.observe(response('signed_in', 'foreign')), /owned participant/);
  assert.equal(gate.reads, 0); assert.equal(gate.heldSnapshot, null);
});
test('failed responses cannot qualify as an inactive runtime', async () => {
  const gate = createInactiveRuntimeSnapshotGate('owned', Promise.resolve());
  await assert.rejects(gate.observe({...response('signed_in'), status: () => 503}), /successful actual response/);
  assert.equal(gate.reads, 0);
});
test('unexpected lifecycle states remain fatal rather than being skipped', async () => {
  const gate = createInactiveRuntimeSnapshotGate('owned', Promise.resolve());
  await assert.rejects(gate.observe(response('expired')), /Unexpected runtime lifecycle/);
  assert.equal(gate.reads, 0);
});
