/** Match a run-bound request without depending on query ordering. When a new
 * session is not known yet, callers must assert the captured scope against the
 * rendered session/run before releasing a held request. */
export function matchesParticipantRunRequest(value, {
  baseUrl, endpoint, participantSessionId, testRunId, includeBookletAssets
}) {
  try {
    const url = new URL(value);
    if (url.origin !== new URL(baseUrl).origin ||
        !["current-state", "events"].includes(endpoint)) return false;
    const path = url.pathname.match(/^\/api\/v1\/participant\/sessions\/([^/]+)\/(current-state|events)$/u);
    if (!path || path[2] !== endpoint) return false;
    const sessionId = decodeURIComponent(path[1]);
    if (!sessionId.trim() || (participantSessionId !== undefined && sessionId !== participantSessionId)) return false;
    const runIds = url.searchParams.getAll("testRunId");
    if (runIds.length !== 1 || !runIds[0].trim() ||
        (testRunId !== undefined && runIds[0] !== testRunId)) return false;
    if (includeBookletAssets !== undefined) {
      const flags = url.searchParams.getAll("includeBookletAssets");
      if (flags.length !== 1 || flags[0] !== String(includeBookletAssets)) return false;
    }
    return true;
  } catch {
    return false;
  }
}
