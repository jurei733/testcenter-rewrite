import assert from "node:assert/strict";
import test from "node:test";

import {
  hasMeaningfulVeronaResponse,
  isSupportedVeronaPlayerApiVersion,
  mergeVeronaSharedParameters,
  mergeVeronaUnitResponse,
  normalizeVeronaSharedParameters,
  normalizeVeronaStateLogEntries,
  parseVeronaIncomingNotification,
  parseVeronaUnitResponse,
  prepareVeronaUnitStateForPlayer,
  projectVeronaPageState,
  projectVeronaUnitStateLogs,
  readVeronaPlayerApiVersion,
  resolveVeronaNavigationRequest,
  serializeVeronaUnitResponse
} from "./verona-player.js";

test("Verona shared parameters normalize and merge by key", () => {
  assert.deepEqual(
    normalizeVeronaSharedParameters([
      { key: " avatar ", value: "blue" },
      { key: "", value: "ignored" },
      { key: "empty", value: "" },
      { key: "avatar", value: "green" },
      { key: "invalid", value: 7 }
    ]),
    [{ key: "avatar", value: "green" }]
  );
  assert.deepEqual(
    mergeVeronaSharedParameters(
      [
        { key: "avatar", value: "blue" },
        { key: "language", value: "de" }
      ],
      [
        { key: "avatar", value: "green" },
        { key: "difficulty", value: "high" }
      ]
    ),
    [
      { key: "avatar", value: "green" },
      { key: "language", value: "de" },
      { key: "difficulty", value: "high" }
    ]
  );
});

test("Verona response presence ignores empty host envelopes", () => {
  assert.equal(hasMeaningfulVeronaResponse(""), false);
  assert.equal(hasMeaningfulVeronaResponse("  "), false);
  assert.equal(hasMeaningfulVeronaResponse("legacy response"), true);
  assert.equal(
    hasMeaningfulVeronaResponse(serializeVeronaUnitResponse({ unitState: {} })),
    false
  );
  assert.equal(
    hasMeaningfulVeronaResponse(
      serializeVeronaUnitResponse({
        unitState: {
          dataParts: { answer: "" },
          responseProgress: "none"
        }
      })
    ),
    false
  );
  assert.equal(
    hasMeaningfulVeronaResponse(
      serializeVeronaUnitResponse({
        unitState: {
          dataParts: { answer: { value: "" } },
          responseProgress: "none"
        }
      })
    ),
    false
  );
  assert.equal(
    hasMeaningfulVeronaResponse(
      serializeVeronaUnitResponse({
        unitState: {
          dataParts: { answer: { value: 0 } },
          responseProgress: "none"
        }
      })
    ),
    true
  );
  assert.equal(
    hasMeaningfulVeronaResponse(
      serializeVeronaUnitResponse({
        unitState: { responseProgress: "some" }
      })
    ),
    true
  );
});

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

test("Verona response envelopes merge partial unit-state reports without losing answers", () => {
  const initialResponse = serializeVeronaUnitResponse({
    unitState: {
      dataParts: {
        answer: { value: 42 },
        untouched: "plain text"
      },
      presentationProgress: "some",
      responseProgress: "some",
      unitStateDataType: "example@1"
    }
  });
  const progressResponse = mergeVeronaUnitResponse(initialResponse, {
    unitState: {
      presentationProgress: "complete"
    }
  });
  const dataPartResponse = mergeVeronaUnitResponse(progressResponse, {
    unitState: {
      dataParts: {
        answer: "updated",
        added: { selected: true }
      }
    }
  });

  assert.deepEqual(parseVeronaUnitResponse(dataPartResponse), {
    kind: "verona_unit_state",
    version: 1,
    unitState: {
      dataParts: {
        answer: "updated",
        untouched: "plain text",
        added: '{"selected":true}'
      },
      presentationProgress: "complete",
      responseProgress: "some",
      unitStateDataType: "example@1"
    },
    dataPartValueTypes: {
      answer: "string",
      untouched: "string",
      added: "json"
    }
  });
});

test("Verona page state projects the original host-side page logs", () => {
  const timeStamp = 1_786_278_400_000;

  assert.deepEqual(
    projectVeronaPageState(
      {
        currentPage: "page-2",
        validPages: [
          { id: "page-1", label: "Introduction" },
          { id: "page-2", label: "Review" }
        ]
      },
      timeStamp
    ),
    {
      pages: [
        { id: "page-1", label: "Introduction" },
        { id: "page-2", label: "Review" }
      ],
      currentPageIndex: 1,
      logEntries: [
        { key: "CURRENT_PAGE_NR", timeStamp, content: "page-2" },
        { key: "CURRENT_PAGE_ID", timeStamp, content: "1" },
        { key: "PAGE_COUNT", timeStamp, content: "2" }
      ]
    }
  );
});

test("Verona page state supports legacy page maps and numeric indices", () => {
  const timeStamp = 123;

  assert.deepEqual(
    projectVeronaPageState(
      {
        currentPage: 0,
        validPages: { first: "First", second: "Second" }
      },
      timeStamp
    ),
    {
      pages: [
        { id: "first", label: "First" },
        { id: "second", label: "Second" }
      ],
      currentPageIndex: 0,
      logEntries: [
        { key: "CURRENT_PAGE_NR", timeStamp, content: "0" },
        { key: "CURRENT_PAGE_ID", timeStamp, content: "0" },
        { key: "PAGE_COUNT", timeStamp, content: "2" }
      ]
    }
  );
});

test("Verona unit state projects the original host-side progress logs", () => {
  const timeStamp = 1_786_278_400_001;

  assert.deepEqual(
    projectVeronaUnitStateLogs(
      {
        presentationProgress: "complete",
        responseProgress: "some"
      },
      timeStamp
    ),
    [
      { key: "PRESENTATION_PROGRESS", timeStamp, content: "complete" },
      { key: "RESPONSE_PROGRESS", timeStamp, content: "some" }
    ]
  );
  assert.deepEqual(projectVeronaUnitStateLogs({}, timeStamp), [
    { key: "PRESENTATION_PROGRESS", timeStamp, content: "" },
    { key: "RESPONSE_PROGRESS", timeStamp, content: "" }
  ]);
});

test("Verona Player logs discard malformed entries without losing valid records", () => {
  const entries: unknown[] = Array.from({ length: 202 }, (_, index) => ({
    key: `LOG_${index}`,
    timeStamp: index,
    content: index
  }));
  entries.splice(50, 0, null, { key: "", timeStamp: 50, content: 50 });

  const normalized = normalizeVeronaStateLogEntries(entries);

  assert.equal(normalized.length, 200);
  assert.deepEqual(normalized[0], {
    key: "LOG_2",
    timeStamp: 2,
    content: "2"
  });
  assert.deepEqual(normalized.at(-1), {
    key: "LOG_201",
    timeStamp: 201,
    content: "201"
  });
  assert.deepEqual(normalizeVeronaStateLogEntries([null, "invalid"]), []);
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
  for (const invalidState of [
    { unitState: null },
    { unitState: "complete" },
    { playerState: null },
    { playerState: "page-2" },
    { log: { key: "PLAYER" } }
  ]) {
    assert.equal(
      parseVeronaIncomingNotification({
        type: "vopStateChangedNotification",
        sessionId: "run:unit",
        ...invalidState
      }),
      null
    );
  }
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
  for (const invalidNavigation of [
    { target: 1 },
    { targetRelative: true }
  ]) {
    assert.equal(
      parseVeronaIncomingNotification({
        type: "vopUnitNavigationRequestedNotification",
        sessionId: "run:unit",
        ...invalidNavigation
      }),
      null
    );
  }
  assert.equal(
    parseVeronaIncomingNotification({
      type: "vopRuntimeErrorNotification",
      code: 500,
      message: "broken"
    }),
    null
  );
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
});

test("Verona navigation keeps absolute Unit ids separate from relative commands", () => {
  assert.deepEqual(
    resolveVeronaNavigationRequest({
      type: "vopUnitNavigationRequestedNotification",
      sessionId: "run:unit",
      target: "CY-Unit.Sample-102",
      targetRelative: "next"
    }),
    { kind: "absolute", unitKey: "CY-Unit.Sample-102" }
  );
  assert.deepEqual(
    resolveVeronaNavigationRequest(
      {
        type: "vopUnitNavigationRequestedNotification",
        sessionId: "run:unit",
        target: "end"
      },
      ["end"]
    ),
    { kind: "absolute", unitKey: "end" }
  );
  assert.deepEqual(
    resolveVeronaNavigationRequest(
      {
        type: "vopUnitNavigationRequestedNotification",
        sessionId: "run:unit",
        target: "last"
      },
      ["UNIT.1", "UNIT.2"]
    ),
    { kind: "relative", target: "last" }
  );
  assert.deepEqual(
    resolveVeronaNavigationRequest({
      type: "vopUnitNavigationRequestedNotification",
      sessionId: "run:unit",
      targetRelative: " #NEXT "
    }),
    { kind: "relative", target: "next" }
  );
  assert.equal(
    resolveVeronaNavigationRequest({
      type: "vopUnitNavigationRequestedNotification",
      sessionId: "run:unit",
      targetRelative: "sideways"
    }),
    null
  );
});
