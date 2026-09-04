import assert from "node:assert/strict";
import test from "node:test";

import {
  MONITOR_EVENT_STREAM_SCHEMA_VERSION,
  parseMonitorEventStreamEvent
} from "./monitor-event-stream.js";

test("monitor event stream payloads require the versioned workspace contract", () => {
  const event = {
    schemaVersion: MONITOR_EVENT_STREAM_SCHEMA_VERSION,
    eventType: "change",
    sequence: 2,
    tenantKey: "tenant-a",
    workspaceKey: "workspace-a",
    emittedAt: "2026-08-01T10:00:00.000Z",
    revision: "A".repeat(64),
    openRunCount: 3
  };

  assert.deepEqual(parseMonitorEventStreamEvent(event), {
    ...event,
    revision: "a".repeat(64)
  });
  assert.equal(
    parseMonitorEventStreamEvent({ ...event, schemaVersion: 2 }),
    null
  );
  assert.equal(
    parseMonitorEventStreamEvent({ ...event, eventType: "unknown" }),
    null
  );
  assert.equal(
    parseMonitorEventStreamEvent({ ...event, revision: "not-a-hash" }),
    null
  );
  assert.equal(
    parseMonitorEventStreamEvent({ ...event, openRunCount: -1 }),
    null
  );
});
