import assert from 'node:assert/strict';
import test from 'node:test';
import {matchesMergedReturnBaseline} from './merged-return-baseline.mjs';

const answer = 'Merged timer return keeps this exact answer Ω';
const fixture = () => ({kind: 'verona_unit_state', version: 1,
  unitState: {dataParts: {answer}, unitStateDataType: 'verona-smoke@1',
    presentationProgress: 'complete', responseProgress: 'complete'},
  dataPartValueTypes: {answer: 'string'}, playerState: {currentPage: 'page-1',
    validPages: [{id: 'page-1', label: 'Introduction'}, {id: 'page-2', label: 'Review'}]},
  fieldTimestamps: {dataParts: {answer: 100}, unitState: {presentationProgress: 101, responseProgress: 101},
    playerState: {currentPage: 102, validPages: 102}}});
const matches = state => matchesMergedReturnBaseline(JSON.stringify(state), answer);

test('an answer-only intermediate save cannot freeze the retention baseline', () => {
  const state = fixture(); state.unitState.responseProgress = 'none';
  assert.equal(matches(state), false);
});
test('complete progress with a stale Player save still cannot freeze the baseline', () => {
  const state = fixture(); state.fieldTimestamps.playerState = {currentPage: 90, validPages: 90};
  assert.equal(matches(state), false);
});
test('all three persisted fixture notifications qualify without modifying the envelope', () => {
  const raw = JSON.stringify(fixture()); assert.equal(matchesMergedReturnBaseline(raw, answer), true);
  assert.equal(raw, JSON.stringify(fixture()));
});
test('equal capture milliseconds remain valid for ordered notifications', () => {
  const state = fixture(); state.fieldTimestamps.unitState = {presentationProgress: 100, responseProgress: 100};
  state.fieldTimestamps.playerState = {currentPage: 100, validPages: 100}; assert.equal(matches(state), true);
});
test('wrong answer bytes, types and page payloads cannot qualify', () => {
  for (const mutate of [s => {s.unitState.dataParts.answer += ' ';}, s => {s.dataPartValueTypes.answer = 'object';},
    s => {s.playerState.validPages[1].label = 'Changed';}, s => {s.playerState.currentPage = 'page-2';}]) {
    const state = fixture(); mutate(state); assert.equal(matches(state), false);
  }
});
test('missing, fractional and reversed capture clocks cannot qualify', () => {
  for (const mutate of [s => {delete s.fieldTimestamps;}, s => {s.fieldTimestamps.dataParts.answer = 1.5;},
    s => {s.fieldTimestamps.unitState.responseProgress = 99;}]) {
    const state = fixture(); mutate(state); assert.equal(matches(state), false);
  }
});
test('malformed responses fail closed', () => {
  for (const raw of [undefined, '', 'null', '{}', '{']) assert.equal(matchesMergedReturnBaseline(raw, answer), false);
});
