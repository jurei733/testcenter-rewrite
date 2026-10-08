import assert from "node:assert/strict";
import test from "node:test";
import {
  participantExecutionModeDefinitions, participantExecutionModes,
  type ParticipantSession, type TestRun
} from "@testcenter-rewrite-app/domain";
import {
  transitionParticipantPresence, PARTICIPANT_PRESENCE_LEASE_MS,
  PARTICIPANT_PRESENCE_MAX_CONNECTIONS, type ParticipantPresence
} from "./participant-presence.js";

const timestamp = Date.parse("2026-10-05T00:00:00Z");
const session: ParticipantSession = { participantSessionId: "session", tenantId: "tenant", workspaceId: "workspace",
  contentReleaseId: "release", loginKey: "login", groupKey: "group", status: "launched", createdAt: new Date(timestamp).toISOString() };
const run: TestRun = { testRunId: "run", participantSessionId: "session", tenantId: "tenant", workspaceId: "workspace",
  contentReleaseId: "release", bookletKey: "booklet", status: "running", currentUnitKey: "unit", unitResponses: { unit: "saved answer" },
  createdAt: session.createdAt, updatedAt: session.createdAt, completedAt: null };
const id = (index: number) => `registered-connection-${index}`;
const transition = (action: "open" | "acknowledge" | "close" | "poll" | "expire",
  current: ParticipantPresence | null, connectionId?: string, elapsed = 0, testRun = run) =>
  transitionParticipantPresence({ testRunId: run.testRunId, participantSessionId: session.participantSessionId,
    action, connectionId, timestamp: timestamp + elapsed }, current, testRun, session);

test("presence caps pending registrations and does not confuse an unconfirmed socket with a connected tab", () => {
  assert.equal(PARTICIPANT_PRESENCE_MAX_CONNECTIONS, 10);
  let presence: ParticipantPresence | null = null;
  for (let index = 0; index < 10; index++) presence = transition("open", presence, id(index)).presence;
  assert.equal(transition("open", presence, id(10)).accepted, false);
  presence = transition("acknowledge", presence, id(0)).presence;
  const closed = transition("close", presence, id(0));
  assert.equal(closed.testLog?.logContent, "LOST");
  assert.equal(Object.keys(closed.presence!.connections).length, 9);
  const expired = transition("expire", closed.presence, undefined, PARTICIPANT_PRESENCE_LEASE_MS);
  assert.equal(expired.testLog, null);
  assert.deepEqual(expired.presence?.connections, {});
  assert.equal(expired.presence?.nextExpiry, null);
});

test("replayed registration cannot extend or demote a confirmed lease", () => {
  const pending = transition("open", null, id(1));
  const live = transition("acknowledge", pending.presence, id(1), 1);
  const replay = transition("open", live.presence, id(1), 20_000);
  assert.equal(replay.accepted, false);
  assert.deepEqual(replay.presence, live.presence);
  assert.equal(replay.presence?.connections[id(1)]?.expiresAt, timestamp + 1 + PARTICIPANT_PRESENCE_LEASE_MS);
});

test("unknown and expired lease messages cannot cancel a newer connected tab", () => {
  const pending = transition("open", null, id(1));
  let presence = transition("acknowledge", pending.presence, id(1)).presence;
  presence = transition("open", presence, id(2), 30_000).presence;
  presence = transition("acknowledge", presence, id(2), 30_001).presence;
  const unchanged = structuredClone(presence);
  for (const action of ["close", "acknowledge"] as const) {
    const stale = transition(action, presence, id(1), 60_000);
    assert.equal(stale.accepted, false);
    assert.deepEqual(stale.presence, unchanged);
    assert.equal(stale.testLog, null);
  }
  const swept = transition("expire", presence, undefined, 60_000);
  assert.equal(swept.presence?.mode, "WEBSOCKET");
  assert.equal(swept.testLog, null);
  assert.equal(Object.keys(swept.presence!.connections).length, 1);
});

test("participant modes retain presence without inventing response-saving logs", () => {
  for (const mode of participantExecutionModes) {
    const testRun = { ...run, executionMode: mode };
    const opened = transition("open", null, id(1), 0, testRun);
    const acknowledged = transition("acknowledge", opened.presence, id(1), 1, testRun);
    assert.equal(Boolean(acknowledged.testLog), participantExecutionModeDefinitions[mode].saveResponses, mode);
    assert.equal(acknowledged.presence?.mode, "WEBSOCKET");
    const lost = transition("close", acknowledged.presence, id(1), 2, testRun);
    assert.equal(Boolean(lost.testLog), participantExecutionModeDefinitions[mode].saveResponses, mode);
    assert.equal(lost.testLog?.originalTimestamp, participantExecutionModeDefinitions[mode].saveResponses ? 0 : undefined);
    assert.deepEqual(testRun.unitResponses, run.unitResponses);
  }
});

test("completed, closed and expired sessions clear leases but preserve history counters", () => {
  const live = transition("acknowledge", transition("open", null, id(1)).presence, id(1));
  for (const [testRun, participantSession] of [
    [{ ...run, status: "completed" as const }, session],
    [run, { ...session, status: "closed" as const }],
    [run, { ...session, validUntil: session.createdAt }]
  ] as const) {
    const result = transitionParticipantPresence({ testRunId: run.testRunId, participantSessionId: session.participantSessionId,
      action: "close", connectionId: id(1), timestamp }, live.presence, testRun, participantSession);
    assert.equal(result.accepted, false);
    assert.equal(result.testLog, null);
    assert.deepEqual(result.presence?.connections, {});
    assert.equal(result.presence?.sequence, live.presence?.sequence);
    assert.equal(result.presence?.nextExpiry, null);
  }
});

test("foreign identities cannot clear the owner's persisted presence", () => {
  const live = transition("acknowledge", transition("open", null, id(1)).presence, id(1));
  const result = transitionParticipantPresence({ testRunId: run.testRunId, participantSessionId: "foreign",
    action: "close", connectionId: id(1), timestamp }, live.presence, run, session);
  assert.equal(result.accepted, false);
  assert.deepEqual(result.presence, live.presence);
  assert.equal(result.testLog, null);
});

test("invalid server deadlines fail before state mutation", () => {
  for (const invalid of [-1, NaN, Infinity, Number.MAX_SAFE_INTEGER, 8_640_000_000_000_000]) {
    assert.throws(() => transitionParticipantPresence({ testRunId: run.testRunId, participantSessionId: session.participantSessionId,
      action: "poll", timestamp: invalid }, null, run, session), /valid server timestamp/);
  }
  assert.throws(() => transition("open", null, "invalid/identifier"), /opaque connection identifier/);
});
