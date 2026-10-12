import type { ParticipantCurrentRunState, ParticipantRunCommandScope } from "@testcenter-rewrite-app/domain";
import { productionApiRoutes, resolveRoutePath } from "@testcenter-rewrite-app/contracts";
import { readParticipantSessionCredential } from "./participant-access-credentials";

/** Initial controller lifecycle and console logs use log-only delivery, independent of a Unit or answer. */
export const createParticipantDebugLog = (options: {
  readState: () => Pick<ParticipantCurrentRunState, "testRun" | "executionMode"> | null;
  readControllerState?: () => { testRun: ParticipantCurrentRunState["testRun"]; status: string; alreadyRecorded: boolean; ready: boolean } | null;
  window?: Window;
  storage?: Storage | null;
  fetch?: typeof fetch;
  now?: () => number;
  id?: () => string;
  schedule?: (callback: () => void, milliseconds: number) => () => void;
}) => {
  type Entry = { scope: ParticipantRunCommandScope & { contentReleaseId?: string; bookletKey?: string };
    id: string; timestamp: number; args?: string[]; status?: string };
  const prefix = "testcenter-rewrite:participant-debug-log:v1:";
  const controllerPrefix = "testcenter-rewrite:participant-controller-log:v1:";
  const window = options.window ?? globalThis.window;
  const fetcher = options.fetch ?? globalThis.fetch;
  const storage = (() => { try { return options.storage === undefined ? window?.localStorage ?? null : options.storage; } catch { return null; } })();
  const schedule = options.schedule ?? ((callback, milliseconds) => {
    const handle = window.setTimeout(callback, milliseconds); return () => window.clearTimeout(handle);
  });
  const key = (scope: Entry["scope"]): string => JSON.stringify([scope.tenantId, scope.workspaceId, scope.participantSessionId,
    scope.testRunId, scope.contentReleaseId, scope.bookletKey]);
  const storageKey = (entry: Entry): string => (entry.status ? controllerPrefix : prefix) + entry.id;
  const selected = (): string | null => {
    const state = options.readState(); return state?.executionMode.saveResponses ? key(state.testRun) : null;
  };
  const valid = (value: unknown): value is Entry => {
    const entry = value as Entry | null;
    return Boolean(entry && typeof entry.id === "string" && /^[A-Za-z0-9_-]{1,160}$/.test(entry.id) &&
      Number.isFinite(entry.timestamp) && entry.timestamp >= 0 && (entry.status !== undefined
        ? entry.args === undefined && ["LOADING", "RUNNING", "PAUSED", "ERROR", "TERMINATED", "TERMINATED_PAUSED"].includes(entry.status) &&
          [entry.scope?.contentReleaseId, entry.scope?.bookletKey].every(value => typeof value === "string" && value.length > 0)
        : Array.isArray(entry.args) && entry.args.every(arg => typeof arg === "string")) &&
      entry.scope && ["tenantId", "workspaceId", "participantSessionId", "testRunId"].every(field =>
        typeof entry.scope[field as keyof ParticipantRunCommandScope] === "string" && entry.scope[field as keyof ParticipantRunCommandScope].length > 0));
  };
  const queue = new Map<string, Entry>();
  let stopped = false, current: string | null = null, cancelTimer: (() => void) | null = null;
  let lastStatus: string | null = null, controllerIdentity: string | null = null, sequence = 0;
  let lifecycleFinished = false;
  let flight: { controller: AbortController; entry: Entry } | null = null;
  const restore = (): void => {
    try { for (let index = 0; storage && index < storage.length; index++) {
      const name = storage.key(index); if (!name?.startsWith(prefix) && !name?.startsWith(controllerPrefix)) continue;
      try {
        const entry: unknown = JSON.parse(storage.getItem(name) ?? "null");
        if (valid(entry) && name === storageKey(entry) && !queue.has(name)) queue.set(name, entry);
      } catch {}
    } } catch {}
  };
  const persist = (entry: Entry): void => { queue.set(storageKey(entry), entry); try { storage?.setItem(storageKey(entry), JSON.stringify(entry)); } catch {} };
  const remove = (entry: Entry): void => {
    queue.delete(storageKey(entry));
    try { if (storage?.getItem(storageKey(entry)) === JSON.stringify(entry)) storage.removeItem(storageKey(entry)); } catch {}
  };
  const matches = (entry: Entry): boolean => key(entry.scope) === current || !entry.status &&
    !entry.scope.contentReleaseId && !entry.scope.bookletKey &&
    key({ ...options.readState()?.testRun, contentReleaseId: undefined, bookletKey: undefined } as Entry["scope"]) === key(entry.scope);
  const wake = (delay = 0): void => { cancelTimer?.(); cancelTimer = schedule(() => { cancelTimer = null; void drain(); }, delay); };
  const drain = async (): Promise<void> => {
    if (stopped || flight || !current || current !== selected()) return;
    const entry = [...queue.values()].filter(matches).sort((a, b) => a.timestamp - b.timestamp || a.id.localeCompare(b.id))[0];
    if (!entry) return;
    const credential = readParticipantSessionCredential(entry.scope.participantSessionId);
    if (!credential) return;
    const selectedScope = current;
    const request = { controller: new AbortController(), entry }; flight = request;
    let retry = false;
    try {
      const response = await fetcher(resolveRoutePath(productionApiRoutes.participant.saveTestLogs, { testRunId: entry.scope.testRunId }), {
        method: "POST", cache: "no-store", signal: request.controller.signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${credential}` },
        body: JSON.stringify({ logs: [{ unitKey: null, originalUnitId: null, entries: [{ key: entry.status ? "CONTROLLER" : "command executed", timeStamp: entry.timestamp,
          content: entry.status ?? ["debug", ...entry.args ?? []].join(" "), clientEntryId: entry.id }] }] })
      });
      if (stopped || request.controller.signal.aborted || selected() !== selectedScope) return;
      if (!response.ok) {
        if (response.status >= 500) retry = true; else remove(entry);
      } else {
        const body: unknown = await response.json();
        if (stopped || request.controller.signal.aborted || selected() !== selectedScope) return;
        const count = (body as { savedCount?: unknown } | null)?.savedCount;
        if (typeof count !== "number" || !Number.isSafeInteger(count) || count < 0) retry = true; else remove(entry);
      }
    } catch { retry = true; }
    finally { if (flight === request) { flight = null; if (!stopped && current === selected()) wake(retry ? 1_000 : 0); } }
  };
  const observeScope = (): void => {
    if (stopped) return;
    const next = selected();
    if (next !== current) { current = next; lastStatus = null; lifecycleFinished = false; flight?.controller.abort(); flight = null; cancelTimer?.(); cancelTimer = null; }
    restore();
    const controller = options.readControllerState?.();
    if (current && controller && key(controller.testRun) === current && !lifecycleFinished && controller.status !== lastStatus) {
      const append = (status: string): void => {
        controllerIdentity ??= options.id?.() ?? globalThis.crypto?.randomUUID?.() ?? `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
        const run = controller.testRun;
        const entry: Entry = { scope: { tenantId: run.tenantId, workspaceId: run.workspaceId, participantSessionId: run.participantSessionId,
          testRunId: run.testRunId, contentReleaseId: run.contentReleaseId, bookletKey: run.bookletKey },
          id: `controller-${controllerIdentity}-${String(++sequence).padStart(8, "0")}`, timestamp: options.now?.() ?? Date.now(), status };
        if (valid(entry)) persist(entry);
      };
      if (lastStatus === null) append("LOADING");
      if (controller.status !== "LOADING" && !controller.alreadyRecorded || lastStatus !== null && controller.status === "LOADING") append(controller.status);
      lastStatus = controller.status;
    }
    // After the first full view, Player/outbox logs and server command receipts own later transitions.
    if (current && controller?.ready && key(controller.testRun) === current) lifecycleFinished = true;
    if (current && !flight && !cancelTimer && [...queue.values()].some(matches)) wake();
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
        participantSessionId: run.participantSessionId, testRunId: run.testRunId,
        contentReleaseId: run.contentReleaseId, bookletKey: run.bookletKey }, args: [...args],
        id: options.id?.() ?? globalThis.crypto?.randomUUID?.() ?? `debug-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`,
        timestamp: options.now?.() ?? Date.now() };
      if (!valid(entry)) return;
      persist(entry); observeScope();
    },
    stop(): void { stopped = true; flight?.controller.abort(); flight = null; cancelTimer?.(); cancelTimer = null; window?.removeEventListener("online", online); }
  };
};
