import assert from "node:assert/strict";
import test from "node:test";

import {
  isSupportedVeronaPlayerApiVersion,
  parseVeronaIncomingNotification,
  parseVeronaUnitResponse,
  readVeronaPlayerApiVersion,
  serializeVeronaUnitResponse
} from "./verona-player.js";

test("Verona response envelopes normalize and restore player state", () => {
  const serialized = serializeVeronaUnitResponse({
    unitState: {
      dataParts: { answer: { value: 42 }, untouched: "yes" },
      presentationProgress: "complete",
      responseProgress: "some",
      unitStateDataType: "example@1"
    },
    playerState: { currentPage: "page-2" }
  });

  assert.deepEqual(parseVeronaUnitResponse(serialized), {
    kind: "verona_unit_state",
    version: 1,
    unitState: {
      dataParts: { answer: '{"value":42}', untouched: "yes" },
      presentationProgress: "complete",
      responseProgress: "some",
      unitStateDataType: "example@1"
    },
    playerState: { currentPage: "page-2" }
  });
  assert.equal(parseVeronaUnitResponse("legacy plain response"), null);
});

test("Verona notifications and supported API versions are validated", () => {
  assert.equal(
    readVeronaPlayerApiVersion({
      type: "vopReadyNotification",
      metadata: { specVersion: "6.0" }
    }),
    "6.0"
  );
  assert.equal(isSupportedVeronaPlayerApiVersion("2.0"), true);
  assert.equal(isSupportedVeronaPlayerApiVersion("6.9"), true);
  assert.equal(isSupportedVeronaPlayerApiVersion("7.0"), false);
  assert.deepEqual(
    parseVeronaIncomingNotification({
      type: "vopStateChangedNotification",
      sessionId: "run:unit",
      unitState: { responseProgress: "complete" }
    }),
    {
      type: "vopStateChangedNotification",
      sessionId: "run:unit",
      unitState: { responseProgress: "complete" }
    }
  );
  assert.equal(
    parseVeronaIncomingNotification({
      type: "vopStateChangedNotification"
    }),
    null
  );
  assert.deepEqual(
    parseVeronaIncomingNotification({
      type: "vopWindowFocusChangedNotification",
      hasFocus: true
    }),
    {
      type: "vopWindowFocusChangedNotification",
      hasFocus: true
    }
  );
  assert.equal(
    parseVeronaIncomingNotification({
      type: "vopWindowFocusChangedNotification",
      hasFocus: "true"
    }),
    null
  );
});
