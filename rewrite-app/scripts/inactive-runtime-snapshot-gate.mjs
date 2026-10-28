import assert from 'node:assert/strict';

/** Hold the owned inactive response, not a preceding active runtime read. */
export function createInactiveRuntimeSnapshotGate(participantSessionId, release) {
  let reads = 0, leadingActiveReads = 0, heldSnapshot = null;
  return {
    async observe(response) {
      assert.equal(response.status(), 200, 'The held runtime must be a successful actual response.');
      const snapshot = (await response.json()).runtimeState;
      assert.equal(snapshot?.participantSession?.participantSessionId, participantSessionId,
        'Runtime snapshots must belong to the owned participant.');
      const status = snapshot.participantSession.status;
      assert.ok(status === 'launched' || status === 'signed_in', 'Unexpected runtime lifecycle during the owned terminal scenario.');
      if (heldSnapshot === null && status === 'launched') {
        leadingActiveReads++; return;
      }
      reads++;
      if (heldSnapshot === null) {
        heldSnapshot = structuredClone(snapshot);
        await release;
      }
    },
    get reads() { return reads; },
    get leadingActiveReads() { return leadingActiveReads; },
    get heldSnapshot() { return structuredClone(heldSnapshot); }
  };
}
