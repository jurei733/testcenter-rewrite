import {
  defaultParticipantExecutionMode, participantExecutionModeDefinitions,
  type ParticipantSession, type ParticipantTestLog, type TestRun
} from "@testcenter-rewrite-app/domain";

export const PARTICIPANT_PRESENCE_LEASE_MS = 60_000;
export const PARTICIPANT_PRESENCE_MAX_CONNECTIONS = 10;
export type ParticipantPresence = {
  testRunId: string;
  participantSessionId: string;
  connections: Record<string, { expiresAt: number; confirmed: boolean }>;
  mode: "WEBSOCKET" | "POLLING" | "LOST" | null;
  sequence: number;
  lastLogTimestamp: number;
  nextExpiry: number | null;
};
export type ParticipantPresenceMutation = {
  testRunId: string;
  participantSessionId: string;
  action: "open" | "acknowledge" | "close" | "poll" | "expire";
  connectionId?: string;
  timestamp: number;
};
export type ParticipantPresenceTransition = {
  presence: ParticipantPresence | null;
  testLog: ParticipantTestLog | null;
  accepted: boolean;
};

/** Pure decision inside the store's atomic run lock. Never writes answers or timers. */
export const transitionParticipantPresence = (
  input: ParticipantPresenceMutation,
  current: ParticipantPresence | null,
  testRun: TestRun | null,
  session: ParticipantSession | null,
  latestConnectionTimestamp = 0
): ParticipantPresenceTransition => {
  if (!Number.isSafeInteger(input.timestamp) || input.timestamp < 0 ||
      input.timestamp > 8_640_000_000_000_000 - PARTICIPANT_PRESENCE_LEASE_MS) {
    throw new Error("Participant presence requires a valid server timestamp.");
  }
  if (testRun?.participantSessionId !== input.participantSessionId ||
      session?.participantSessionId !== input.participantSessionId) {
    // A foreign identity must not delete the real owner's presence.
    return { presence: current, testLog: null, accepted: false };
  }
  if (session.status === "closed" ||
      (session.validUntil && Date.parse(session.validUntil) <= input.timestamp) ||
      (testRun.status !== "running" && testRun.status !== "paused")) {
    // Retain the log sequence if an administrator later reopens the same run.
    return { presence: current ? { ...current, connections: {}, nextExpiry: null } : null,
      testLog: null, accepted: false };
  }
  if (input.action === "expire" && !current) {
    return { presence: null, testLog: null, accepted: false };
  }
  if (input.action === "open" &&
      (!input.connectionId || !/^[a-zA-Z0-9-]{16,80}$/.test(input.connectionId))) {
    throw new Error("Participant presence requires an opaque connection identifier.");
  }
  if ((input.action === "acknowledge" || input.action === "close") &&
      (!input.connectionId || !current?.connections[input.connectionId] ||
       current.connections[input.connectionId].expiresAt <= input.timestamp)) {
    return { presence: current, testLog: null, accepted: false };
  }
  const presence: ParticipantPresence = current
    ? { ...current, connections: { ...current.connections } }
    : { testRunId: input.testRunId, participantSessionId: input.participantSessionId,
        connections: {}, mode: null, sequence: 0, lastLogTimestamp: 0, nextExpiry: null };
  for (const [id, connection] of Object.entries(presence.connections)) {
    if (connection.expiresAt <= input.timestamp) delete presence.connections[id];
  }
  if (input.action === "open") {
    // Replayed registration cannot extend or demote a confirmed connection.
    if (presence.connections[input.connectionId!] ||
        Object.keys(presence.connections).length >= PARTICIPANT_PRESENCE_MAX_CONNECTIONS) {
      return { presence: current, testLog: null, accepted: false };
    }
    presence.connections[input.connectionId!] = {
      expiresAt: input.timestamp + PARTICIPANT_PRESENCE_LEASE_MS, confirmed: false
    };
  } else if (input.action === "acknowledge") {
    presence.connections[input.connectionId!] = {
      expiresAt: input.timestamp + PARTICIPANT_PRESENCE_LEASE_MS, confirmed: true
    };
  } else if (input.action === "close") {
    delete presence.connections[input.connectionId!];
  }
  const live = Object.values(presence.connections).some(connection => connection.confirmed);
  const mode = live ? "WEBSOCKET"
    : input.action === "poll" ? "POLLING"
    : presence.mode === "WEBSOCKET" ? "LOST" : presence.mode;
  let testLog: ParticipantTestLog | null = null;
  if (mode !== presence.mode) {
    presence.mode = mode;
    presence.sequence += 1;
    // Server logs must remain newer than retained client CONNECTION history.
    presence.lastLogTimestamp = Math.max(input.timestamp, presence.lastLogTimestamp + 1,
      latestConnectionTimestamp + 1);
    const executionMode = participantExecutionModeDefinitions[
      testRun.executionMode ?? defaultParticipantExecutionMode
    ] ?? participantExecutionModeDefinitions[defaultParticipantExecutionMode];
    if (mode && executionMode.saveResponses) {
      testLog = {
        participantTestLogId: `presence:${testRun.testRunId}:${presence.sequence}`,
        tenantId: testRun.tenantId, workspaceId: testRun.workspaceId,
        participantSessionId: testRun.participantSessionId, testRunId: testRun.testRunId,
        unitKey: null, originalUnitId: null, logKey: "CONNECTION", logContent: mode,
        timestamp: presence.lastLogTimestamp,
        ...(mode === "LOST" || (mode === "POLLING" && current?.mode === "LOST")
          ? { originalTimestamp: 0 as const } : {}),
        recordedAt: new Date(input.timestamp).toISOString()
      };
    }
  }
  presence.nextExpiry = Object.values(presence.connections).reduce<number | null>(
    (earliest, connection) => Math.min(earliest ?? Infinity, connection.expiresAt), null
  );
  return { presence, testLog, accepted: true };
};
