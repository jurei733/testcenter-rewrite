import { mergeCapturedVeronaUnitResponse, parseCapturedVeronaUnitResponse as parseVeronaUnitResponse, serializeCapturedVeronaUnitResponse as serializeVeronaUnitResponse } from "./participant-response-capture.js";
import { parseVeronaUnitResponse as parseLegacyVeronaUnitResponse } from "./verona-player.js";
import assert from "node:assert/strict";
import test from "node:test";
import { captureParticipantResponseFieldTimestamps, nextParticipantResponseTimestamp,
  normalizeParticipantResponseFieldTimestamps } from "./participant-response-field-timestamps.js";
import { reconcileParticipantResponse } from "./participant-response-order.js";

test("opaque responses keep exact bytes and ignore older/equal captures", () => {
  const response = " Ä/β\n   exact spaces \u0000 ";
  const first = reconcileParticipantResponse({ currentResponse: undefined, incomingResponse: response, capturedAt: 20 });
  assert.equal(first.response, response); assert.deepEqual(first.timestamps, { opaque: 20 });
  for (const capturedAt of [0 + 10, 20]) {
    const stale = reconcileParticipantResponse({ currentResponse: response, currentTimestamps: first.timestamps, incomingResponse: "Must not replace", capturedAt });
    assert.equal(stale.response, response); assert.equal(stale.changed, false);
  }
  const next = reconcileParticipantResponse({ currentResponse: response, currentTimestamps: first.timestamps, incomingResponse: " Newer \n ", capturedAt: 21 });
  assert.equal(next.response, " Newer \n "); assert.equal(next.acceptedFields, 1);
});

test("a full accepted Verona packet preserves its original serialization", () => {
  const response = serializeVeronaUnitResponse({ unitState: { presentationProgress: "complete", dataParts: { a: "ä\n", b: { score: 2 } } }, playerState: { currentPage: "p1" } }) + "\n  ";
  const result = reconcileParticipantResponse({ currentResponse: undefined, incomingResponse: response, capturedAt: 40 });
  assert.equal(result.response, response); assert.equal(result.acceptedFields, 4);
  assert.deepEqual(result.timestamps, { unitState: { presentationProgress: 40 }, dataParts: { a: 40, b: 40 }, playerState: { currentPage: 40 } });
});

test("Source field ordering merges a newer part without overwriting another newer part", () => {
  const currentResponse = serializeVeronaUnitResponse({ unitState: { presentationProgress: "complete", responseProgress: "some", dataParts: { a: "newest A", b: "old B" } }, playerState: { currentPage: "p2" } });
  const incomingResponse = serializeVeronaUnitResponse({ unitState: { presentationProgress: "some", responseProgress: "complete", dataParts: { a: { stale: true }, b: "new B", c: "first C" } }, playerState: { currentPage: "p1" } });
  const result = reconcileParticipantResponse({ currentResponse, currentTimestamps: { unitState: { presentationProgress: 30, responseProgress: 10 }, dataParts: { a: 30, b: 10 }, playerState: { currentPage: 30 } },
    incomingResponse, incomingTimestamps: { unitState: { presentationProgress: 20, responseProgress: 20 }, dataParts: { a: 20, b: 20, c: 20 }, playerState: { currentPage: 20 } }, capturedAt: 99 });
  const merged = parseVeronaUnitResponse(result.response)!;
  assert.deepEqual(merged.unitState, { presentationProgress: "complete", responseProgress: "complete", dataParts: { a: "newest A", b: "new B", c: "first C" } });
  assert.equal(merged.dataPartValueTypes?.a, "string"); assert.equal(merged.playerState?.currentPage, "p2");
  assert.equal(result.acceptedFields, 3);
  assert.deepEqual(result.timestamps.dataParts, { a: 30, b: 20, c: 20 });
});

test("equal field timestamps retain the previous content and bytes", () => {
  const currentResponse = serializeVeronaUnitResponse({ unitState: { dataParts: { a: "keep" } }, fieldTimestamps: { dataParts: { a: 20 } } }) + "\n ";
  const incomingResponse = serializeVeronaUnitResponse({ unitState: { dataParts: { a: "different" } }, fieldTimestamps: { dataParts: { a: 20 } } });
  const result = reconcileParticipantResponse({ currentResponse, incomingResponse, capturedAt: 1000 });
  assert.equal(result.response, currentResponse); assert.equal(result.acceptedFields, 0); assert.equal(result.changed, false);
});

test("missing parts and state fields are retained, matching Source patches", () => {
  const currentResponse = serializeVeronaUnitResponse({ unitState: { responseProgress: "complete", dataParts: { a: "keep" } }, playerState: { currentPage: "p1" } });
  const result = reconcileParticipantResponse({ currentResponse, incomingResponse: serializeVeronaUnitResponse({ unitState: { presentationProgress: "some", dataParts: {} } }), capturedAt: 20 });
  const packet = parseVeronaUnitResponse(result.response)!;
  assert.deepEqual(packet.unitState, { responseProgress: "complete", presentationProgress: "some", dataParts: { a: "keep" } });
  assert.equal(packet.playerState?.currentPage, "p1");
});

test("a field timestamp cannot advance or poison unrelated fields", () => {
  const result = reconcileParticipantResponse({ currentResponse: undefined, incomingResponse: serializeVeronaUnitResponse({ unitState: { dataParts: { a: "actual" } } }),
    incomingTimestamps: { dataParts: { a: 10, foreign: Number.MAX_SAFE_INTEGER }, playerState: { currentPage: 500 } }, capturedAt: 20 });
  assert.deepEqual(result.timestamps, { dataParts: { a: 10 } });
});

test("opaque conversion cannot erase a newer Verona field", () => {
  const currentResponse = serializeVeronaUnitResponse({ unitState: { dataParts: { a: "A", b: "B" } } });
  const currentTimestamps = { dataParts: { a: 10, b: 30 } };
  const stale = reconcileParticipantResponse({ currentResponse, currentTimestamps, incomingResponse: "old opaque", capturedAt: 20 });
  assert.equal(stale.response, currentResponse); assert.equal(stale.changed, false);
  const fresh = reconcileParticipantResponse({ currentResponse, currentTimestamps, incomingResponse: "fresh opaque", capturedAt: 31 });
  assert.equal(fresh.response, "fresh opaque"); assert.deepEqual(fresh.timestamps, { opaque: 31 });
});

test("conversion from opaque retains its ordering barrier for unreported fields", () => {
  const result = reconcileParticipantResponse({ currentResponse: "opaque baseline", currentTimestamps: { opaque: 20 },
    incomingResponse: serializeVeronaUnitResponse({ unitState: { dataParts: { a: "too old", b: "new" } } }), incomingTimestamps: { dataParts: { a: 10, b: 30 } }, capturedAt: 40 });
  assert.deepEqual(parseVeronaUnitResponse(result.response)?.unitState.dataParts, { b: "new" });
  assert.deepEqual(result.timestamps, { opaque: 20, dataParts: { b: 30 } });
});

test("a full captured packet keeps exact bytes after opaque conversion while its sidecar guards unreported fields", () => {
  const incomingResponse = serializeVeronaUnitResponse({
    unitState: { dataParts: { answer: "Exact Ä/β\n  \u0000 " }, responseProgress: "complete" },
    fieldTimestamps: { dataParts: { answer: 30 }, unitState: { responseProgress: 30 } }
  }) + "\n  ";
  const first = reconcileParticipantResponse({ currentResponse: "opaque baseline", currentTimestamps: { opaque: 20 },
    incomingResponse, capturedAt: 40 });
  assert.equal(first.response, incomingResponse);
  assert.deepEqual(first.timestamps, { opaque: 20, dataParts: { answer: 30 }, unitState: { responseProgress: 30 } });
  const stale = reconcileParticipantResponse({ currentResponse: first.response, currentTimestamps: first.timestamps,
    incomingResponse: serializeVeronaUnitResponse({ unitState: { dataParts: { unreported: "Older than the opaque baseline" } },
      fieldTimestamps: { dataParts: { unreported: 15 } } }), capturedAt: 50 });
  assert.equal(stale.response, incomingResponse); assert.equal(stale.acceptedFields, 0);
  const reloaded = mergeCapturedVeronaUnitResponse(first.response, { unitState: { dataParts: { answer: "New real input" } }, captureTimestamp: 10 });
  assert.equal(parseVeronaUnitResponse(reloaded)?.fieldTimestamps?.dataParts?.answer, 31);
  const second = reconcileParticipantResponse({ currentResponse: first.response, currentTimestamps: first.timestamps,
    incomingResponse: reloaded, capturedAt: 50 });
  assert.equal(second.response, reloaded);
  assert.equal(second.timestamps.opaque, 20);
});

test("embedded field clocks survive serialization and patch merging", () => {
  const first = mergeCapturedVeronaUnitResponse(undefined, { unitState: { dataParts: { a: "A" }, presentationProgress: "some" }, captureTimestamp: 10 });
  const next = mergeCapturedVeronaUnitResponse(first, { unitState: { dataParts: { b: "B" } }, playerState: { currentPage: "p2" }, captureTimestamp: 10 });
  assert.deepEqual(parseVeronaUnitResponse(next)?.fieldTimestamps, {
    unitState: { presentationProgress: 10 }, dataParts: { a: 10, b: 11 }, playerState: { currentPage: 11 }
  });
  const replay = reconcileParticipantResponse({ currentResponse: next, incomingResponse: first, capturedAt: 99 });
  assert.equal(replay.response, next); assert.equal(replay.changed, false);
});

test("capturing a notification stamps only its own fields without mutating prior clocks", () => {
  const previous = { dataParts: { a: 10 }, unitState: { responseProgress: 10 } };
  const result = captureParticipantResponseFieldTimestamps(previous, { unitState: { presentationProgress: "complete", dataParts: { b: "B" } } }, 20);
  assert.deepEqual(result, { dataParts: { a: 10, b: 20 }, unitState: { responseProgress: 10, presentationProgress: 20 } });
  assert.deepEqual(previous, { dataParts: { a: 10 }, unitState: { responseProgress: 10 } });
});

test("prototype-named answer parts remain ordinary fields", () => {
  const parts = JSON.parse('{"__proto__":"own","constructor":"second","toString":"third"}');
  const response = serializeVeronaUnitResponse({ unitState: { dataParts: parts } });
  const result = reconcileParticipantResponse({ currentResponse: undefined, incomingResponse: response, capturedAt: 10 });
  assert.equal(result.response, response); assert.equal(result.acceptedFields, 3);
  assert.equal(Object.hasOwn(result.timestamps.dataParts!, "__proto__"), true);
  assert.equal(result.timestamps.dataParts!.__proto__, 10); assert.equal(Object.getPrototypeOf(result.timestamps.dataParts), Object.prototype);
});

test("zero baseline clocks cannot overwrite a stored field", () => {
  const currentResponse = serializeVeronaUnitResponse({ unitState: { dataParts: { a: "current" } } });
  const result = reconcileParticipantResponse({ currentResponse, incomingResponse: serializeVeronaUnitResponse({ unitState: { dataParts: { a: "cached" } } }), incomingTimestamps: { dataParts: { a: 0 } }, capturedAt: 10 });
  assert.equal(result.response, currentResponse); assert.equal(result.changed, false);
});

test("cached fields without capture clocks neither overwrite nor insert data", () => {
  const incomingResponse = serializeVeronaUnitResponse({ unitState: { dataParts: { a: "cached", b: "actual" } }, fieldTimestamps: { dataParts: { b: 20 } } });
  const existing = reconcileParticipantResponse({ currentResponse: serializeVeronaUnitResponse({ unitState: { dataParts: { a: "newer A" } } }), incomingResponse, capturedAt: 100 });
  assert.deepEqual(parseVeronaUnitResponse(existing.response)?.unitState.dataParts, { a: "newer A", b: "actual" });
  const initial = reconcileParticipantResponse({ currentResponse: undefined, incomingResponse, capturedAt: 100 });
  assert.deepEqual(parseVeronaUnitResponse(initial.response)?.unitState.dataParts, { b: "actual" });
  const zero = reconcileParticipantResponse({ currentResponse: undefined, incomingResponse: serializeVeronaUnitResponse({ unitState: { dataParts: { a: "never reported" } }, fieldTimestamps: {} }), capturedAt: 100 });
  assert.equal(parseVeronaUnitResponse(zero.response)?.unitState.dataParts, undefined); assert.equal(zero.acceptedFields, 0);
});

test("malformed clocks are rejected instead of downgrading a Verona envelope to opaque", () => {
  for (const clocks of [null, [], { unexpected: 10 }, { dataParts: [] }, { dataParts: { a: -1 } }, { dataParts: { a: 1.5 } }]) {
    assert.throws(() => normalizeParticipantResponseFieldTimestamps(clocks), RangeError);
    const incomingResponse = JSON.stringify({ kind: "verona_unit_state", version: 1, unitState: { dataParts: { a: "invalid" } }, fieldTimestamps: clocks });
    assert.throws(() => reconcileParticipantResponse({ currentResponse: undefined, incomingResponse, capturedAt: 20 }), RangeError);
  }
  assert.throws(() => reconcileParticipantResponse({ currentResponse: "newer opaque", currentTimestamps: { opaque: 30 },
    incomingResponse: JSON.stringify({ kind: "verona_unit_state", version: 1, unitState: "invalid", fieldTimestamps: { dataParts: { a: 10 } } }),
    capturedAt: 100 }), RangeError);
});

test("capture clocks remain monotonic across equal clocks, clock rollback and reload", () => {
  assert.equal(nextParticipantResponseTimestamp({ dataParts: { a: 100 } }, 100), 101);
  assert.equal(nextParticipantResponseTimestamp({ dataParts: { a: 100 } }, 10), 101);
  assert.equal(nextParticipantResponseTimestamp(undefined, 100), 100);
  assert.throws(() => nextParticipantResponseTimestamp({ opaque: Number.MAX_SAFE_INTEGER }, 10), RangeError);
});

test("ordering metadata never changes decoded answer/progress/page state and is validated at persistence", () => {
  const unitState = { responseProgress: "complete" as const, presentationProgress: "some" as const, dataParts: { answer: "Exact Ä/β\n  " } };
  const playerState = { currentPage: "p2" };
  const response = serializeVeronaUnitResponse({ unitState, playerState, fieldTimestamps: { dataParts: { answer: 20 } } });
  const parsed = parseVeronaUnitResponse(response)!;
  assert.deepEqual(parsed.unitState, unitState); assert.deepEqual(parsed.playerState, playerState);
  assert.deepEqual(parsed.fieldTimestamps, { dataParts: { answer: 20 } });
  const malformed = JSON.stringify({ kind: "verona_unit_state", version: 1, unitState, playerState, fieldTimestamps: { dataParts: { answer: -1 } } });
  assert.deepEqual(parseLegacyVeronaUnitResponse(malformed)?.unitState, unitState);
  assert.throws(() => parseVeronaUnitResponse(malformed), RangeError);
  assert.throws(() => reconcileParticipantResponse({ currentResponse: undefined, incomingResponse: malformed, capturedAt: 30 }), RangeError);
  assert.throws(() => mergeCapturedVeronaUnitResponse(malformed, { unitState, captureTimestamp: 30 }), RangeError);
});

test("legacy replacement of a captured envelope retains clocks for Player reload", () => {
  const currentResponse = serializeVeronaUnitResponse({ unitState: { dataParts: { a: "Old" } }, fieldTimestamps: { dataParts: { a: 20 } } });
  const incomingResponse = serializeVeronaUnitResponse({ unitState: { dataParts: { a: "New" } } });
  const updated = reconcileParticipantResponse({ currentResponse, incomingResponse, capturedAt: 30 });
  assert.deepEqual(parseVeronaUnitResponse(updated.response)?.fieldTimestamps, { dataParts: { a: 30 } });
  assert.deepEqual(parseVeronaUnitResponse(updated.response)?.unitState.dataParts, { a: "New" });
  assert.equal(reconcileParticipantResponse({ currentResponse: updated.response, incomingResponse: currentResponse, capturedAt: 100 }).response, updated.response);
});

test("an empty packet cannot persist a future clock for an unreported field", () => {
  const incomingResponse = serializeVeronaUnitResponse({ unitState: {}, fieldTimestamps: { dataParts: { ghost: Number.MAX_SAFE_INTEGER } } });
  const first = reconcileParticipantResponse({ currentResponse: undefined, incomingResponse, capturedAt: 10 });
  assert.deepEqual(parseVeronaUnitResponse(first.response)?.fieldTimestamps, {});
  const next = mergeCapturedVeronaUnitResponse(first.response, { unitState: { dataParts: { answer: "Actual" } }, captureTimestamp: 20 });
  assert.deepEqual(parseVeronaUnitResponse(next)?.fieldTimestamps, { dataParts: { answer: 20 } });
});

test("a fresh Player capture starts beyond the stored legacy clock even when its device clock is behind", () => {
  const storedFieldTimestamps = { opaque: 60_000 };
  const response = mergeCapturedVeronaUnitResponse(undefined, {
    unitState: { dataParts: { answer: "Fresh Ä/β\n  \u0000 " } }, captureTimestamp: 1_000, storedFieldTimestamps
  });
  assert.deepEqual(parseVeronaUnitResponse(response)?.fieldTimestamps, { dataParts: { answer: 60_001 } });
  const accepted = reconcileParticipantResponse({ currentResponse: "Legacy opaque answer", currentTimestamps: storedFieldTimestamps,
    incomingResponse: response, capturedAt: 1_001 });
  assert.equal(accepted.response, response); assert.equal(accepted.acceptedFields, 1);
  assert.deepEqual(storedFieldTimestamps, { opaque: 60_000 });
});

test("a stored opaque bootstrap barrier cannot rewrite a captured packet when addressed to another Unit", () => {
  const captured = mergeCapturedVeronaUnitResponse(undefined, {
    unitState: { dataParts: { answer: "Fresh Ä/β\n  \u0000 " } }, captureTimestamp: 1_000,
    storedFieldTimestamps: { opaque: 60_000 }
  }) + "\n  ";
  const accepted = reconcileParticipantResponse({ currentResponse: undefined, incomingResponse: captured, capturedAt: 1_001 });
  assert.equal(accepted.response, captured);
  assert.deepEqual(accepted.timestamps, { dataParts: { answer: 60_001 } });
});

test("stored and embedded clocks keep their maxima without restamping cached fields", () => {
  const previous = serializeVeronaUnitResponse({ unitState: { dataParts: { a: "Cached A", b: "Cached B" } },
    fieldTimestamps: { dataParts: { a: 150, b: 300 } } });
  const storedFieldTimestamps = { dataParts: { a: 200, b: 250 }, playerState: { currentPage: 200 } };
  const updated = mergeCapturedVeronaUnitResponse(previous, { playerState: { currentPage: "p2" }, captureTimestamp: 10, storedFieldTimestamps });
  assert.deepEqual(parseVeronaUnitResponse(updated)?.fieldTimestamps, { dataParts: { a: 200, b: 300 }, playerState: { currentPage: 301 } });
  assert.deepEqual(parseVeronaUnitResponse(updated)?.unitState.dataParts, { a: "Cached A", b: "Cached B" });
  assert.deepEqual(storedFieldTimestamps, { dataParts: { a: 200, b: 250 }, playerState: { currentPage: 200 } });
});
