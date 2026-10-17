import assert from "node:assert/strict";
import test from "node:test";
import { matchesVeronaSavedResponse } from "./verona-save-response-match.mjs";

const envelope = {
  kind: "verona_unit_state", version: 1,
  unitState: { dataParts: { answers: '[{"id":"item","value":" a "}]' }, responseProgress: "complete" },
  playerState: { currentPage: "1" }, dataPartValueTypes: { answers: "string" }
};
const response = JSON.stringify(envelope);

test("inactive Units require exact serialized response bytes", () => {
  assert.equal(matchesVeronaSavedResponse(response, response), true);
  assert.equal(matchesVeronaSavedResponse(response, `${response}\n `), false);
});
test("only an active Player may canonicalize the complete outer JSON envelope", () => {
  assert.equal(matchesVeronaSavedResponse(response, `${response}\n `, true), true);
  assert.equal(matchesVeronaSavedResponse(JSON.stringify(envelope, null, 2), response, true), true);
});
test("canonicalization never hides answer, metadata, page or raw dataPart changes", () => {
  for (const changed of [
    { ...envelope, version: 2 },
    { ...envelope, playerState: { currentPage: "2" } },
    { ...envelope, unitState: { ...envelope.unitState, responseProgress: "some" } },
    { ...envelope, unitState: { ...envelope.unitState, dataParts: { answers: '[{"id":"item","value":"a"}]' } } },
    { ...envelope, unitState: { ...envelope.unitState, dataParts: { answers: '[ {"id":"item","value":" a "}]' } } },
    { ...envelope, dataPartValueTypes: { answers: "object" } }
  ]) assert.equal(matchesVeronaSavedResponse(JSON.stringify(changed), response, true), false);
});
test("malformed or unrelated JSON cannot pass canonical response matching", () => {
  for (const actual of [null, undefined, "{", "null", "[]", '"response"'])
    assert.equal(matchesVeronaSavedResponse(actual, response, true), false);
  assert.equal(matchesVeronaSavedResponse('{} ', '{}', true), false);
});

const clocked = { ...envelope, fieldTimestamps: {
  unitState: { responseProgress: 100 }, dataParts: { answers: 101 }, playerState: { currentPage: 102 }, opaque: 99
} };
test("active recapture may advance every field clock while inactive packets stay exact", () => {
  const later = { ...envelope, fieldTimestamps: {
    opaque: 200, playerState: { currentPage: 203 }, dataParts: { answers: 202 }, unitState: { responseProgress: 201 }
  } };
  assert.equal(matchesVeronaSavedResponse(JSON.stringify(later), JSON.stringify(clocked), true), true);
  assert.equal(matchesVeronaSavedResponse(JSON.stringify(later), JSON.stringify(clocked)), false);
  assert.equal(matchesVeronaSavedResponse(JSON.stringify(later), response, true), true);
});
test("active recapture cannot remove, regress or corrupt any existing field clock", () => {
  for (const clocks of [undefined, null, [], {},
    { ...clocked.fieldTimestamps, opaque: 98 },
    { ...clocked.fieldTimestamps, dataParts: {} },
    { ...clocked.fieldTimestamps, dataParts: { answers: 100 } },
    { ...clocked.fieldTimestamps, dataParts: { answers: '102' } },
    { ...clocked.fieldTimestamps, dataParts: { answers: 101.5 } },
    { ...clocked.fieldTimestamps, dataParts: { answers: -1 } }
  ]) assert.equal(matchesVeronaSavedResponse(JSON.stringify({ ...envelope, fieldTimestamps: clocks }), JSON.stringify(clocked), true), false);
  assert.equal(matchesVeronaSavedResponse(JSON.stringify({ ...envelope, fieldTimestamps: { dataParts: { answers: '101' } } }), response, true), false);
});
test("new clocks cannot hide changed typed data, page state or metadata", () => {
  for (const changed of [
    { ...envelope, dataPartValueTypes: { answers: 'object' } },
    { ...envelope, playerState: { currentPage: '2' } },
    { ...envelope, unitState: { ...envelope.unitState, dataParts: {} } },
    { ...envelope, unitState: { ...envelope.unitState, dataParts: { answers: 42 } } }
  ]) assert.equal(matchesVeronaSavedResponse(JSON.stringify({ ...changed, fieldTimestamps: clocked.fieldTimestamps }), JSON.stringify(clocked), true), false);
});
