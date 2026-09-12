import assert from "node:assert/strict";
import test from "node:test";

import {
  PARTICIPANT_EVENT_STREAM_SCHEMA_VERSION,
  parseParticipantEventStreamEvent
} from "./participant-event-stream.js";

test("participant event stream payloads require the versioned session contract", () => {
  const event = {
    schemaVersion: PARTICIPANT_EVENT_STREAM_SCHEMA_VERSION,
    eventType: "change",
    sequence: 2,
    participantSessionId: "participant-session-1",
    testRunId: "test-run-1",
    emittedAt: "2026-08-09T13:30:00.000Z",
    revision: "A".repeat(64)
  };

  assert.deepEqual(parseParticipantEventStreamEvent(event), {
    ...event,
    revision: "a".repeat(64)
  });
  assert.equal(
    parseParticipantEventStreamEvent({ ...event, schemaVersion: 2 }),
    null
  );
  assert.equal(
    parseParticipantEventStreamEvent({ ...event, eventType: "unknown" }),
    null
  );
  assert.equal(
    parseParticipantEventStreamEvent({ ...event, participantSessionId: "" }),
    null
  );
  assert.equal(
    parseParticipantEventStreamEvent({ ...event, testRunId: "" }),
    null
  );
  assert.equal(
    parseParticipantEventStreamEvent({ ...event, revision: "not-a-hash" }),
    null
  );
});
