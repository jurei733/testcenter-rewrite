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
