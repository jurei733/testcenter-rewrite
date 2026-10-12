import type { ParticipantCurrentRunState } from "@testcenter-rewrite-app/domain";
import { participantNativeCommandRoute, participantNativeCommandKeywords, type ParticipantNativeCommandKeyword,
  type ParticipantNativeCommandRequest, type ParticipantNativeCommandResult } from "@testcenter-rewrite-app/contracts/participant-native-command";
import { resolveRoutePath } from "@testcenter-rewrite-app/contracts";
import { readParticipantSessionCredential } from "./participant-access-credentials";

type Scope = ParticipantNativeCommandResult["scope"];
type Entry = { scope: Scope; owner: string; id: string; keyword: ParticipantNativeCommandKeyword; args: string[]; request: ParticipantNativeCommandRequest; prepared?: true };
const scopeKey = (scope: Scope): string => JSON.stringify([scope.tenantId, scope.workspaceId, scope.participantSessionId,
  scope.testRunId, scope.contentReleaseId, scope.bookletKey]);
const validScope = (scope: unknown): scope is Scope => Boolean(scope && typeof scope === "object" &&
  ["tenantId", "workspaceId", "participantSessionId", "testRunId", "contentReleaseId", "bookletKey"].every(key =>
    typeof (scope as Record<string, unknown>)[key] === "string" && Boolean((scope as Record<string, unknown>)[key])));

/** Ordered console intents: no remote ACK, durable identity and no credentials in storage. */
export const createParticipantNativeCommands = (options: {
  readState: () => Pick<ParticipantCurrentRunState, "testRun"> | null;
  controllerStatus: () => ParticipantNativeCommandRequest["controllerStatus"];
  generation?: () => number;
  prepare: (isCurrent: () => boolean) => Promise<void>;
  applied: (result: ParticipantNativeCommandResult, isCurrent: () => boolean) => Promise<void>;
  failed: (error: Error) => void;
  window?: Window; storage?: Storage | null; fetch?: typeof fetch;
  now?: () => number; id?: () => string;
  ownerId?: string;
  schedule?: (callback: () => void, milliseconds: number) => () => void;
}) => {
  const window = options.window ?? globalThis.window, fetcher = options.fetch ?? globalThis.fetch;
  const prefix = "testcenter-rewrite:participant-native-command:v1:";
  const owner = options.ownerId ?? (() => {
    try {
      const key = "testcenter-rewrite:participant-native-owner:v1", old = window.sessionStorage.getItem(key);
      if (old && /^[A-Za-z0-9_-]{1,160}$/.test(old)) return old;
      const id = crypto.randomUUID(); window.sessionStorage.setItem(key, id); return id;
    } catch { return crypto.randomUUID(); }
  })();
  const storage = (() => { try { return options.storage === undefined ? window.localStorage : options.storage; } catch { return null; } })();
  const schedule = options.schedule ?? ((callback, milliseconds) => { const id = window.setTimeout(callback, milliseconds); return () => window.clearTimeout(id); });
  const selected = (): Scope | null => { const run = options.readState()?.testRun; return validScope(run) ? {
    tenantId: run.tenantId, workspaceId: run.workspaceId, participantSessionId: run.participantSessionId,
    testRunId: run.testRunId, contentReleaseId: run.contentReleaseId, bookletKey: run.bookletKey } : null; };
  const queue = new Map<string, Entry>();
  let stopped = false, current: string | null = null, cancel: (() => void) | null = null;
  let currentGeneration = options.generation?.();
  let flight: { entry: Entry; controller: AbortController } | null = null;
  const valid = (value: unknown): value is Entry => {
    const entry = value as Entry | null;
    return Boolean(entry && entry.owner === owner && validScope(entry.scope) && /^[A-Za-z0-9_-]{1,160}$/.test(entry.id) &&
      participantNativeCommandKeywords.includes(entry.keyword) && Array.isArray(entry.args) && entry.args.every(value => typeof value === "string") &&
      entry.request && (entry.prepared === undefined || entry.prepared === true) && entry.request.deliveryId === entry.id && entry.request.keyword === entry.keyword &&
        entry.request.testRunId === entry.scope.testRunId && entry.request.contentReleaseId === entry.scope.contentReleaseId &&
        entry.request.bookletKey === entry.scope.bookletKey && JSON.stringify(entry.request.arguments) === JSON.stringify(entry.args) &&
        ["RUNNING", "PAUSED", "ERROR"].includes(entry.request.controllerStatus) && Number.isSafeInteger(entry.request.timeStamp) && entry.request.timeStamp >= 0);
  };
  const persist = (entry: Entry): void => { try { storage?.setItem(prefix + entry.id, JSON.stringify(entry)); } catch {} };
  const remove = (entry: Entry): void => { queue.delete(entry.id); try {
    if (storage?.getItem(prefix + entry.id) === JSON.stringify(entry)) storage.removeItem(prefix + entry.id);
  } catch {} };
  const restore = (): void => { try { for (let index = 0; storage && index < storage.length; index++) {
    const name = storage.key(index); if (!name?.startsWith(prefix)) continue;
    try { const entry: unknown = JSON.parse(storage.getItem(name) ?? "null");
      if (valid(entry) && name === prefix + entry.id && !queue.has(entry.id)) queue.set(entry.id, entry);
    } catch {}
  } } catch {} };
  const wake = (delay = 0): void => { cancel?.(); cancel = schedule(() => { cancel = null; void drain(); }, delay); };
  const drain = async (): Promise<void> => {
    const scope = selected();
    if (stopped || flight || !scope || current !== scopeKey(scope)) return;
    const entry = [...queue.values()].find(entry => scopeKey(entry.scope) === current);
    if (!entry) return;
    const credential = readParticipantSessionCredential(entry.scope.participantSessionId);
    if (!credential) return;
    const request = { entry, controller: new AbortController() }; flight = request;
    const generation = options.generation?.();
    const isCurrent = (): boolean => !stopped && !request.controller.signal.aborted && generation === options.generation?.() &&
      Boolean(selected() && scopeKey(selected()!) === scopeKey(entry.scope));
    let retry = false;
    try {
      if (!entry.prepared) {
        await options.prepare(isCurrent); if (!isCurrent()) return;
        entry.prepared = true;
        persist(entry);
      }
      const response = await fetcher(resolveRoutePath(participantNativeCommandRoute, { participantSessionId: entry.scope.participantSessionId }), {
        method: "POST", cache: "no-store", signal: request.controller.signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${credential}` }, body: JSON.stringify(entry.request)
      });
      if (!isCurrent()) return;
      if (!response.ok) {
        const error = Object.assign(new Error(`Console command returned HTTP ${response.status}.`), { retryable: response.status >= 500 });
        throw error;
      }
      const body = await response.json() as { application?: ParticipantNativeCommandResult } | null;
      const application = body?.application;
      if (!isCurrent()) return;
      if (!application || !validScope(application.scope) || scopeKey(application.scope) !== scopeKey(entry.scope) ||
          application.deliveryId !== entry.id || application.keyword !== entry.keyword || JSON.stringify(application.arguments) !== JSON.stringify(entry.args) ||
          application.controllerStatus !== entry.request.controllerStatus || application.timeStamp !== entry.request.timeStamp ||
          typeof application.applied !== "boolean" || !Number.isFinite(Date.parse(application.executedAt)) ||
          !validScope(application.testRun) || scopeKey(application.testRun) !== scopeKey(entry.scope) ||
          !["tenantId", "workspaceId", "participantSessionId"].every(key => application.participantSession?.[key as keyof typeof application.participantSession] === entry.scope[key as keyof Scope])) {
        throw Object.assign(new Error("The console receipt does not match its selected immutable Run and command."), { retryable: false });
      }
      remove(entry);
      await options.applied(application, isCurrent);
    } catch (error) {
      if (!isCurrent()) return;
      if (!queue.has(entry.id)) { options.failed(error instanceof Error ? error : new Error(String(error))); return; }
      retry = (error as { retryable?: boolean }).retryable !== false;
      if (!retry) { remove(entry); options.failed(error instanceof Error ? error : new Error(String(error))); }
    } finally {
      if (flight === request) { flight = null;
        if (!stopped && current && selected() && current === scopeKey(selected()!) && queue.size) wake(retry ? 1_000 : 0);
      }
    }
  };
  const observeScope = (): void => {
    if (stopped) return;
    const next = selected(), key = next ? scopeKey(next) : null;
    const generation = options.generation?.();
    if (key !== current || generation !== currentGeneration) {
      // A live controller replacement cancels its own pending intents. A page
      // reload instead restores them through the same tab's persistent owner.
      if (current) for (const entry of queue.values()) if (scopeKey(entry.scope) === current) remove(entry);
      current = key; currentGeneration = generation; flight?.controller.abort(); flight = null; cancel?.(); cancel = null;
    }
    restore(); if (current && !flight && !cancel && [...queue.values()].some(entry => scopeKey(entry.scope) === current)) wake();
  };
  const online = (): void => { cancel?.(); cancel = null; observeScope(); };
  window.addEventListener("online", online);
  observeScope();
  return { observeScope,
    command(keyword: ParticipantNativeCommandKeyword, args: readonly string[]): void {
      if (stopped || !participantNativeCommandKeywords.includes(keyword) || !Array.isArray(args) || !args.every(arg => typeof arg === "string")) return;
      observeScope();
      const scope = selected(); if (!scope) return;
      const id = (options.id ?? (() => crypto.randomUUID()))();
      const entry: Entry = { scope, owner, id, keyword, args: [...args], request: {
        testRunId: scope.testRunId, contentReleaseId: scope.contentReleaseId, bookletKey: scope.bookletKey,
        deliveryId: id, keyword, arguments: [...args], controllerStatus: options.controllerStatus(), timeStamp: (options.now ?? Date.now)() } };
      queue.set(entry.id, entry); persist(entry); observeScope();
    },
    stop(): void { if (stopped) return; stopped = true; flight?.controller.abort(); flight = null; cancel?.(); cancel = null; window.removeEventListener("online", online); }
  };
};
