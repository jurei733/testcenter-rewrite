// Ephemeral test credentials learned only from successful, real HTTP responses.
// This never installs credentials in the application or overrides explicit
// Authorization headers (including negative authorization test cases).
export function createParticipantHttpTestActor(nativeFetch = globalThis.fetch) {
  const tokens = new Map();
  const owners = new Map();
  const browserCaptures = new Set();
  const observedPages = new WeakSet();
  const key = (origin, id) => `${origin}\n${id}`;
  const isParticipant = url => new URL(url).pathname.startsWith("/api/v1/participant/");
  const capture = (url, payload, authorization) => {
    const { origin, pathname } = new URL(url);
    if (!isParticipant(url) || pathname.includes("/resources/") || !payload || typeof payload !== "object") return;
    const state = payload.currentRunState ?? payload.runtimeState ?? payload;
    const sessionId = state.participantSession?.participantSessionId;
    const run = state.testRun;
    if (typeof run?.testRunId === "string" && typeof run.participantSessionId === "string") {
      owners.set(key(origin, run.testRunId), run.participantSessionId);
    }
    if (typeof sessionId !== "string") return;
    const suppliedToken = /^Bearer ([A-Za-z0-9_-]{43})$/u.exec(authorization ?? "")?.[1];
    const token = payload.sessionToken ?? (tokens.has(key(origin, sessionId)) ? undefined : suppliedToken);
    if (typeof token === "string" && /^[A-Za-z0-9_-]{43}$/u.test(token)) {
      tokens.set(key(origin, sessionId), token);
    }
  };
  const headers = (url, body) => {
    const { origin, pathname } = new URL(url);
    if (!isParticipant(url)) return {};
    const sessionMatch = /^\/api\/v1\/participant\/sessions\/([^/]+)\//u.exec(pathname);
    const runMatch = /^\/api\/v1\/participant\/test-runs\/([^/]+)\//u.exec(pathname);
    let sessionId;
    try {
      sessionId = sessionMatch ? decodeURIComponent(sessionMatch[1]) : runMatch
        ? owners.get(key(origin, decodeURIComponent(runMatch[1])))
        : pathname === "/api/v1/participant/starter:launch" ? body?.participantSessionId : undefined;
    } catch { return {}; }
    if (typeof sessionId !== "string" || !sessionId.trim()) return {};
    return { authorization: `Bearer ${tokens.get(key(origin, sessionId)) ?? sessionId}` };
  };
  const fetch = async (url, init = {}) => {
    while (browserCaptures.size) await Promise.all([...browserCaptures]);
    const explicitHeaders = new Headers(init.headers);
    if (isParticipant(url) && !explicitHeaders.has("authorization")) {
      let body;
      try { body = typeof init.body === "string" ? JSON.parse(init.body) : undefined; } catch {}
      for (const [name, value] of Object.entries(headers(url, body))) explicitHeaders.set(name, value);
    }
    const response = await nativeFetch(url, { ...init, headers: explicitHeaders });
    if (response.ok && isParticipant(url) && !new URL(url).pathname.includes("/resources/") &&
        response.headers.get("content-type")?.includes("application/json")) {
      capture(url, await response.clone().json(), explicitHeaders.get("authorization"));
    }
    return response;
  };
  const observePage = page => {
    if (observedPages.has(page)) return;
    observedPages.add(page);
    page.on("response", response => {
      if (!response.ok() || !isParticipant(response.url()) || new URL(response.url()).pathname.includes("/resources/") ||
          !response.headers()["content-type"]?.includes("application/json")) return;
      const pending = response.json().then(payload => {
        capture(response.url(), payload, response.request().headers().authorization);
      }).catch(() => {}).finally(() => browserCaptures.delete(pending));
      browserCaptures.add(pending);
    });
  };
  const observeContext = context => {
    context.on("page", observePage);
    context.pages().forEach(observePage);
    return context;
  };
  // API-created synthetic fixtures are pre-authenticated with their actual
  // setup-login response. Login-only URLs never bootstrap credentials, and
  // existing credentials/tombstones are untouched during re-entry/rotation.
  const goto = async (page, url, options) => {
    const target = new URL(url);
    const sessionId = target.searchParams.get("participantSessionId");
    const token = sessionId && tokens.get(key(target.origin, sessionId));
    if (sessionId && token && /\/participant$/u.test(target.pathname)) {
      const runs = [...owners].filter(([ownerKey, owner]) => owner === sessionId &&
        ownerKey.startsWith(target.origin + "\n")).map(([ownerKey]) => ownerKey.split("\n")[1]);
      await page.addInitScript(({ origin, sessionId, token, runs }) => {
        if (location.origin !== origin) return;
        const storageKey = "testcenter-rewrite:participant-access:v1";
        const raw = localStorage.getItem(storageKey);
        const state = raw ? JSON.parse(raw) : { version: 1, sessions: [], runs: [] };
        if (state.version !== 1 || !Array.isArray(state.sessions) || !Array.isArray(state.runs)) {
          throw new Error("Invalid participant fixture credential storage.");
        }
        if (state.sessions.some(([id]) => id === sessionId)) return;
        if (state.sessions.length >= 500 || state.runs.length + runs.length > 500) {
          throw new Error("Participant fixture credential capacity exceeded.");
        }
        state.sessions.push([sessionId, token]);
        for (const runId of runs) {
          const existing = state.runs.find(([id]) => id === runId);
          if (existing && existing[1] !== sessionId) throw new Error("Conflicting participant fixture owner.");
          if (!existing) state.runs.push([runId, sessionId]);
        }
        localStorage.setItem(storageKey, JSON.stringify(state));
      }, { origin: target.origin, sessionId, token, runs });
    }
    observePage(page);
    return page.goto(url, options);
  };
  return { fetch, headers, isParticipant, observePage, observeContext, goto };
}
