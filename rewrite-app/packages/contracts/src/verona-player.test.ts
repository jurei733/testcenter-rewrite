import assert from "node:assert/strict";
import test from "node:test";

import {
  isSupportedVeronaPlayerApiVersion,
  mergeVeronaUnitResponse,
  parseVeronaIncomingNotification,
  parseVeronaUnitResponse,
  prepareVeronaUnitStateForPlayer,
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
    dataPartValueTypes: { answer: "json", untouched: "string" },
    playerState: { currentPage: "page-2" }
  });
  assert.equal(parseVeronaUnitResponse("legacy plain response"), null);
});

test("Verona 2 and 3 players receive restored object-valued data parts", () => {
  const persistedState = {
    dataParts: {
      all: '{"answers":[{"id":"answer","value":"saved"}]}',
      opaque: "not-json"
    },
    responseProgress: "some" as const
  };

  assert.deepEqual(prepareVeronaUnitStateForPlayer(persistedState, "3.0.0"), {
    dataParts: {
      all: { answers: [{ id: "answer", value: "saved" }] },
      opaque: "not-json"
    },
    responseProgress: "some"
  });
  assert.deepEqual(
    prepareVeronaUnitStateForPlayer(persistedState, "4.0"),
    persistedState
  );
});

test("Verona 2 and 3 players retain data parts originally emitted as strings", () => {
  const serialized = serializeVeronaUnitResponse({
    unitState: {
      dataParts: {
        allResponses: '{"text_var1":"saved"}',
        all: { answers: [{ id: "answer", value: "saved" }] }
      }
    }
  });
  const persisted = parseVeronaUnitResponse(serialized);
  assert.ok(persisted);

  assert.deepEqual(
    prepareVeronaUnitStateForPlayer(
      persisted.unitState,
      "2.1.0",
      persisted.dataPartValueTypes
    ),
    {
      dataParts: {
        allResponses: '{"text_var1":"saved"}',
        all: { answers: [{ id: "answer", value: "saved" }] }
      }
    }
  );
});

test("legacy Verona envelopes keep object restoration when player state is merged", () => {
  const legacyResponse = JSON.stringify({
    kind: "verona_unit_state",
    version: 1,
    unitState: {
      dataParts: {
        all: '{"answers":[{"id":"answer","value":"saved"}]}'
      }
    }
  });
  const merged = mergeVeronaUnitResponse(legacyResponse, {
    playerState: { currentPage: "2" }
  });
  const persisted = parseVeronaUnitResponse(merged);
  assert.ok(persisted);
  assert.equal(persisted.dataPartValueTypes, undefined);
  assert.deepEqual(
    prepareVeronaUnitStateForPlayer(
      persisted.unitState,
      "3.0.0",
      persisted.dataPartValueTypes
    ),
    {
      dataParts: {
        all: { answers: [{ id: "answer", value: "saved" }] }
      }
    }
  );
});

test("Verona response envelopes merge separately reported unit and player state", () => {
  const playerResponse = mergeVeronaUnitResponse(null, {
    playerState: { currentPage: "1", validPages: [{ id: "0" }, { id: "1" }] }
  });
  const completeResponse = mergeVeronaUnitResponse(playerResponse, {
    unitState: {
      dataParts: { elementCodes: '[{"id":"radio_1","value":2}]' },
      responseProgress: "some"
    }
  });

  assert.deepEqual(parseVeronaUnitResponse(completeResponse), {
    kind: "verona_unit_state",
    version: 1,
    unitState: {
      dataParts: { elementCodes: '[{"id":"radio_1","value":2}]' },
      responseProgress: "some"
    },
    dataPartValueTypes: { elementCodes: "string" },
    playerState: {
      currentPage: "1",
      validPages: [{ id: "0" }, { id: "1" }]
    }
  });
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
