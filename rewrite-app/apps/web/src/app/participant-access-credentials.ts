// Kept separate from shell snapshots, route links and response payloads.
// The run-owner index is populated only from authorized participant responses.
export const PARTICIPANT_ACCESS_STORAGE_KEY = "testcenter-rewrite:participant-access:v1";
type AccessState = {
  version: 1;
  sessions: Array<[string, string | null]>;
  runs: Array<[string, string]>;
};
const MAX_IDENTITIES = 500;
const empty = (): AccessState => ({ version: 1, sessions: [], runs: [] });
const identifier = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 500 && !/[\s/]/u.test(value);
const token = (value: unknown): value is string =>
  typeof value === "string" && /^[A-Za-z0-9_-]{43}$/.test(value);

export function rememberParticipantSessionCredential(
  participantSessionId: string, sessionToken: string, storage = browserStorage()
): boolean {
  if (!identifier(participantSessionId) || !token(sessionToken)) return false;
  const state = read(storage);
  if (state.sessions.some(([id, stored]) => id === participantSessionId && stored === sessionToken)) return true;
  state.sessions = [...state.sessions.filter(([id]) => id !== participantSessionId), [participantSessionId, sessionToken]];
  return write(state, storage);
}

export function rememberParticipantRunOwner(
  testRunId: string, participantSessionId: string, storage = browserStorage()
): boolean {
  if (!identifier(testRunId) || !identifier(participantSessionId)) return false;
  const state = read(storage);
  const owner = state.runs.find(([id]) => id === testRunId)?.[1];
  if (owner) return owner === participantSessionId;
  state.runs.push([testRunId, participantSessionId]);
  return write(state, storage);
}

export function readParticipantSessionCredential(
  participantSessionId: string, storage = browserStorage()
): string | null {
  if (!identifier(participantSessionId)) return null;
  const session = read(storage).sessions.find(([id]) => id === participantSessionId);
  // Explicit legacy opaque ID only until this browser has a credential/tombstone.
  return session ? session[1] : participantSessionId;
}

export function readParticipantRunCredential(
  testRunId: string, storage = browserStorage()
): string | null {
  const state = read(storage);
  const participantSessionId = state.runs.find(([id]) => id === testRunId)?.[1];
  if (!participantSessionId) return null;
  const session = state.sessions.find(([id]) => id === participantSessionId);
  return session ? session[1] : participantSessionId;
}

/** Call only after server logout; never delete responses or the run-owner index. */
export function forgetParticipantSessionCredential(
  participantSessionId: string, storage = browserStorage(), expectedSessionToken?: string
): boolean {
  if (!identifier(participantSessionId)) return false;
  const state = read(storage);
  const existing = state.sessions.find(([id]) => id === participantSessionId);
  if (expectedSessionToken !== undefined &&
    (existing ? existing[1] : participantSessionId) !== expectedSessionToken) return false;
  state.sessions = [...state.sessions.filter(([id]) => id !== participantSessionId), [participantSessionId, null]];
  return write(state, storage);
}

export function participantRequestToken(path: string, body?: unknown, storage = browserStorage()): string | null {
  try {
    const session = /^\/api\/v1\/participant\/sessions\/([^/]+)\//u.exec(path);
    if (session) return readParticipantSessionCredential(decodeURIComponent(session[1]!), storage);
    const run = /^\/api\/v1\/participant\/test-runs\/([^/]+)\//u.exec(path);
    if (run) return readParticipantRunCredential(decodeURIComponent(run[1]!), storage);
    if (path === "/api/v1/participant/starter:launch") {
      const id = object(body).participantSessionId;
      if (typeof id === "string") return readParticipantSessionCredential(id, storage);
    }
  } catch { /* Malformed URL identifiers cannot select a credential. */ }
  return null;
}

/** Capture only successful participant responses, never operator/export data. */
export function rememberParticipantAccessResponse(path: string, payload: unknown, storage = browserStorage()): boolean {
  if (!path.startsWith("/api/v1/participant/")) return true;
  const response = object(payload);
  const state = object(response.currentRunState ?? response.runtimeState ?? payload);
  const sessionId = object(state.participantSession).participantSessionId;
  const run = object(state.testRun);
  const runSessionId = run.participantSessionId;
  if (identifier(sessionId) && identifier(runSessionId) && sessionId !== runSessionId) return false;
  if (response.sessionToken !== undefined) {
    if (!identifier(sessionId) || !token(response.sessionToken) ||
      !rememberParticipantSessionCredential(sessionId, response.sessionToken, storage)) return false;
  }
  if (identifier(run.testRunId) && identifier(runSessionId)) {
    return rememberParticipantRunOwner(run.testRunId, runSessionId, storage);
  }
  return true;
}

function object(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === "object" ? value as Record<string, unknown> : {};
}

function browserStorage(): Storage | null {
  try { return globalThis.localStorage ?? null; } catch { return null; }
}

function read(storage: Storage | null): AccessState {
  try {
    const raw = storage?.getItem(PARTICIPANT_ACCESS_STORAGE_KEY);
    if (!raw || raw.length > 1_000_000) return empty();
    const state = JSON.parse(raw) as Partial<AccessState>;
    if (state.version !== 1 || !Array.isArray(state.sessions) || !Array.isArray(state.runs) ||
      state.sessions.length > MAX_IDENTITIES || state.runs.length > MAX_IDENTITIES ||
      !state.sessions.every(entry => Array.isArray(entry) && entry.length === 2 && identifier(entry[0]) && (entry[1] === null || token(entry[1]))) ||
      !state.runs.every(entry => Array.isArray(entry) && entry.length === 2 && entry.every(identifier)) ||
      new Set(state.sessions.map(([id]) => id)).size !== state.sessions.length ||
      new Set(state.runs.map(([id]) => id)).size !== state.runs.length
    ) return empty();
    return state as AccessState;
  } catch { return empty(); }
}

function write(state: AccessState, storage: Storage | null): boolean {
  if (!storage || state.sessions.length > MAX_IDENTITIES || state.runs.length > MAX_IDENTITIES) return false;
  try { storage.setItem(PARTICIPANT_ACCESS_STORAGE_KEY, JSON.stringify(state)); return true; }
  catch { return false; }
}
