import assert from 'node:assert/strict';
import test from 'node:test';
import {createContentReleaseActivationRevision, type ContentReleaseActivationState} from './content-release-activation.js';

test('activation revisions survive JSONB object ordering and durable collection reordering', () => {
  const state = {
    contentReleases: [{id: 'a', snapshot: {unicode: 'Ω', nullable: null, absent: undefined, definition: '  exact Ω\n', clocks: [1, 2]}}, {id: 'b'}],
    participantSessions: [{id: 'first'}, {id: 'second'}],
    testRuns: [{answers: {unit: '  exact Ω\n'}, clocks: [1, 2]}]
  } as unknown as ContentReleaseActivationState;
  const reordered = {
    testRuns: [{clocks: [1, 2], answers: {unit: '  exact Ω\n'}}],
    participantSessions: [{id: 'second'}, {id: 'first'}],
    contentReleases: [{id: 'b'}, {snapshot: {clocks: [1, 2], definition: '  exact Ω\n', nullable: null, unicode: 'Ω'}, id: 'a'}]
  } as unknown as ContentReleaseActivationState;
  const before = structuredClone(state);
  assert.equal(createContentReleaseActivationRevision(state), createContentReleaseActivationRevision(reordered));
  assert.deepEqual(state, before);
  for (const replacement of [' exact Ω\n', '  exact Ω', '  exact ω\n']) {
    const changed = structuredClone(reordered) as unknown as {contentReleases: Array<{snapshot?: {definition: string}}>};
    changed.contentReleases[1]!.snapshot!.definition = replacement;
    assert.notEqual(createContentReleaseActivationRevision(state), createContentReleaseActivationRevision(changed as unknown as ContentReleaseActivationState));
  }
  const changed = structuredClone(reordered) as unknown as {contentReleases: Array<{snapshot?: {clocks: number[]}}>};
  changed.contentReleases[1]!.snapshot!.clocks.reverse();
  assert.notEqual(createContentReleaseActivationRevision(state), createContentReleaseActivationRevision(changed as unknown as ContentReleaseActivationState));
});
