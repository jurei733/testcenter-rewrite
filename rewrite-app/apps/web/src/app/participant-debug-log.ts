import type { ParticipantCurrentRunState, ParticipantRunCommandScope } from "@testcenter-rewrite-app/domain";
import { productionApiRoutes, resolveRoutePath } from "@testcenter-rewrite-app/contracts";
import { readParticipantSessionCredential } from "./participant-access-credentials";

/** Console commands bypass the remote ACK; their log uses the existing log-only endpoint. */
export const createParticipantDebugLog = (options: {
  readState: () => Pick<ParticipantCurrentRunState, "testRun" | "executionMode"> | null;
  window?: Window;
  storage?: Storage | null;
  fetch?: typeof fetch;
  now?: () => number;
  id?: () => string;
  schedule?: (callback: () => void, milliseconds: number) => () => void;
}) => {
  type Entry = { scope: ParticipantRunCommandScope; id: string; timestamp: number; args: string[] };
  const prefix = "testcenter-rewrite:participant-debug-log:v1:";
  const window = options.window ?? globalThis.window;
  const fetcher = options.fetch ?? globalThis.fetch;
  const storage = (() => { try { return options.storage === undefined ? window?.localStorage ?? null : options.storage; } catch { return null; } })();
  const schedule = options.schedule ?? ((callback, milliseconds) => {
    const handle = window.setTimeout(callback, milliseconds); return () => window.clearTimeout(handle);
  });
  const key = (scope: ParticipantRunCommandScope): string => JSON.stringify([scope.tenantId, scope.workspaceId, scope.participantSessionId, scope.testRunId]);
  const selected = (): string | null => {
    const state = options.readState(); return state?.executionMode.saveResponses ? key(state.testRun) : null;
  };
  const valid = (value: unknown): value is Entry => {
    const entry = value as Entry | null;
    return Boolean(entry && typeof entry.id === "string" && /^[A-Za-z0-9_-]{1,160}$/.test(entry.id) &&
      Number.isFinite(entry.timestamp) && entry.timestamp >= 0 && Array.isArray(entry.args) && entry.args.every(arg => typeof arg === "string") &&
      entry.scope && ["tenantId", "workspaceId", "participantSessionId", "testRunId"].every(field =>
        typeof entry.scope[field as keyof ParticipantRunCommandScope] === "string" && entry.scope[field as keyof ParticipantRunCommandScope].length > 0));
  };
  const queue = new Map<string, Entry>();
  let stopped = false, current: string | null = null, cancelTimer: (() => void) | null = null;
  let flight: { controller: AbortController; entry: Entry } | null = null;
  const restore = (): void => {
    try { for (let index = 0; storage && index < storage.length; index++) {
      const name = storage.key(index); if (!name?.startsWith(prefix)) continue;
      try {
        const entry: unknown = JSON.parse(storage.getItem(name) ?? "null");
        if (valid(entry) && name === prefix + entry.id && !queue.has(entry.id)) queue.set(entry.id, entry);
      } catch {}
    } } catch {}
  };
  const persist = (entry: Entry): void => { try { storage?.setItem(prefix + entry.id, JSON.stringify(entry)); } catch {} };
  const remove = (entry: Entry): void => {
    queue.delete(entry.id);
    try { if (storage?.getItem(prefix + entry.id) === JSON.stringify(entry)) storage.removeItem(prefix + entry.id); } catch {}
  };
  const wake = (delay = 0): void => { cancelTimer?.(); cancelTimer = schedule(() => { cancelTimer = null; void drain(); }, delay); };
  const drain = async (): Promise<void> => {
    if (stopped || flight || !current || current !== selected()) return;
    const entry = [...queue.values()].find(value => key(value.scope) === current);
    if (!entry) return;
    const credential = readParticipantSessionCredential(entry.scope.participantSessionId);
    if (!credential) return;
    const request = { controller: new AbortController(), entry }; flight = request;
    let retry = false;
    try {
      const response = await fetcher(resolveRoutePath(productionApiRoutes.participant.saveTestLogs, { testRunId: entry.scope.testRunId }), {
        method: "POST", cache: "no-store", signal: request.controller.signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${credential}` },
        body: JSON.stringify({ logs: [{ unitKey: null, originalUnitId: null, entries: [{ key: "command executed", timeStamp: entry.timestamp,
          content: ["debug", ...entry.args].join(" "), clientEntryId: entry.id }] }] })
      });
      if (stopped || request.controller.signal.aborted || selected() !== key(entry.scope)) return;
      if (!response.ok) {
        if (response.status >= 500) retry = true; else remove(entry);
      } else {
        const body: unknown = await response.json();
        if (stopped || request.controller.signal.aborted || selected() !== key(entry.scope)) return;
        const count = (body as { savedCount?: unknown } | null)?.savedCount;
        if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) retry = true; else remove(entry);
      }
    } catch { retry = true; }
    finally { if (flight === request) { flight = null; if (!stopped && current === selected()) wake(retry ? 1_000 : 0); } }
  };
  const observeScope = (): void => {
    if (stopped) return;
    const next = selected();
    if (next !== current) { current = next; flight?.controller.abort(); flight = null; cancelTimer?.(); cancelTimer = null; }
    restore(); if (current && !flight && !cancelTimer && [...queue.values()].some(entry => key(entry.scope) === current)) wake();
  };
  const online = (): void => { cancelTimer?.(); cancelTimer = null; observeScope(); };
  window?.addEventListener("online", online);
  return {
    observeScope,
    log(args: readonly string[]): void {
      if (stopped) return;
      const state = options.readState(); if (!state?.executionMode.saveResponses) return;
      const run = state.testRun;
      const entry: Entry = { scope: { tenantId: run.tenantId, workspaceId: run.workspaceId,
        participantSessionId: run.participantSessionId, testRunId: run.testRunId }, args: [...args],
        id: options.id?.() ?? globalThis.crypto?.randomUUID?.() ?? `debug-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
        timestamp: options.now?.() ?? Date.now() };
      if (!valid(entry)) return;
      queue.set(entry.id, entry); persist(entry); observeScope();
    },
    stop(): void { stopped = true; flight?.controller.abort(); flight = null; cancelTimer?.(); cancelTimer = null; window?.removeEventListener("online", online); }
  };
};
