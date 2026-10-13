import type { ParticipantCurrentRunState } from "@testcenter-rewrite-app/domain";
import { participantNativeCommandRoute, participantNativeCommandKeywords, isParticipantControllerDispatch, isParticipantControllerDispatches, type ParticipantNativeCommandKeyword,
  type ParticipantNativeCommandRequest, type ParticipantNativeCommandResult } from "@testcenter-rewrite-app/contracts/participant-native-command";
import { resolveRoutePath } from "@testcenter-rewrite-app/contracts";
import { readParticipantSessionCredential } from "./participant-access-credentials";
import type { ParticipantControllerDispatch, ParticipantRunCommand } from "@testcenter-rewrite-app/domain";

type Scope = ParticipantNativeCommandResult["scope"];
type Entry = { scope: Scope; owner: string; id: string; keyword: ParticipantNativeCommandKeyword; args: string[]; request: ParticipantNativeCommandRequest; prepared?: true; version?: 2 };
const scopeKey = (scope: Scope): string => JSON.stringify([scope.tenantId, scope.workspaceId, scope.participantSessionId,
  scope.testRunId, scope.contentReleaseId, scope.bookletKey]);
const validScope = (scope: unknown): scope is Scope => Boolean(scope && typeof scope === "object" &&
  ["tenantId", "workspaceId", "participantSessionId", "testRunId", "contentReleaseId", "bookletKey"].every(key =>
    typeof (scope as Record<string, unknown>)[key] === "string" && Boolean((scope as Record<string, unknown>)[key])));

const documentOwners = new WeakMap<Window, string>();
const participantNativeOwner = (window: Window): string => {
  const current = documentOwners.get(window); if (current) return current;
  const key = "testcenter-rewrite:participant-native-owner:v1";
  const handoffKey = "testcenter-rewrite:participant-native-reload:v1";
  let owner: string = crypto.randomUUID();
  try {
    const previous = window.sessionStorage.getItem(key);
    const navigation = window.performance.getEntriesByType("navigation")[0] as PerformanceNavigationTiming | undefined;
    // New tabs can copy sessionStorage. Only a departing document's reload
    // handoff can restore its owner; the copied identity of a live tab cannot.
    if (navigation?.type === "reload" && previous && /^[A-Za-z0-9_-]{1,160}$/.test(previous) &&
        window.sessionStorage.getItem(handoffKey) === previous) owner = previous;
    window.sessionStorage.setItem(key, owner);
    window.sessionStorage.removeItem(handoffKey);
  } catch { /* Denied storage still permits a document-local console. */ }
  documentOwners.set(window, owner);
  // These belong to the document, not an Angular route instance. A cached
  // document becoming active again must revoke its departing handoff as well.
  window.addEventListener("pagehide", () => { try {
    if (window.sessionStorage.getItem(key) === owner) window.sessionStorage.setItem(handoffKey, owner);
  } catch {} });
  window.addEventListener("pageshow", () => { try {
    if (window.sessionStorage.getItem(key) === owner) window.sessionStorage.removeItem(handoffKey);
  } catch {} });
  return owner;
};

const controllerDispatchCounters = new WeakMap<Window, Map<string, number>>();
const recordControllerDispatch = (window: Window, testRunId: string, dispatch: ParticipantControllerDispatch): void => {
  let counters = controllerDispatchCounters.get(window);
  if (!counters) { counters = new Map(); controllerDispatchCounters.set(window, counters); }
  const key = "testcenter-rewrite:controller-dispatch:v1:" + JSON.stringify([dispatch.controllerId, testRunId]);
  counters.set(key, Math.max(counters.get(key) ?? 0, dispatch.sequence));
  try { window.sessionStorage.setItem(key, String(counters.get(key))); } catch {}
};

/** Shared by native and remote state effects in this controller document. */
export const nextParticipantControllerDispatch = (testRunId: string, window: Window = globalThis.window,
  controllerId = participantNativeOwner(window), observed: Record<string, number> = {}): ParticipantControllerDispatch => {
  const key = "testcenter-rewrite:controller-dispatch:v1:" + JSON.stringify([controllerId, testRunId]);
  let stored = 0;
  try { const value = Number(window.sessionStorage.getItem(key)); if (Number.isSafeInteger(value) && value >= 0) stored = value; } catch {}
  const known = Object.hasOwn(observed, controllerId) ? observed[controllerId]! : 0;
  const sequence = Math.max(controllerDispatchCounters.get(window)?.get(key) ?? 0, stored, known) + 1;
  if (!Number.isSafeInteger(sequence) || sequence < 1) throw new Error("The controller dispatch sequence is exhausted or invalid.");
  const dispatch = { controllerId, sequence }; recordControllerDispatch(window, testRunId, dispatch); return dispatch;
};

const receivedCommandDispatches = new WeakMap<ParticipantRunCommand, ParticipantControllerDispatch>();
export const receivedParticipantControllerDispatch = (command: ParticipantRunCommand, observed?: Record<string, number>): ParticipantControllerDispatch => {
  let dispatch = receivedCommandDispatches.get(command);
  if (!dispatch) { dispatch = nextParticipantControllerDispatch(command.testRunId, globalThis.window, undefined, observed); receivedCommandDispatches.set(command, dispatch); }
  return dispatch;
};

/** Independent console intents: durable identity, no remote ACK or stored credentials. */
export const createParticipantNativeCommands = (options: {
  readState: () => Pick<ParticipantCurrentRunState, "testRun"> | null;
  controllerStatus: () => ParticipantNativeCommandRequest["controllerStatus"];
  generation?: () => number;
  prepare: (isCurrent: () => boolean) => Promise<void>;
  started?: (request: ParticipantNativeCommandRequest) => void;
  applied: (result: ParticipantNativeCommandResult, isCurrent: () => boolean, dispatch?: ParticipantControllerDispatch) => Promise<void>;
  failed: (error: Error) => void;
  window?: Window; storage?: Storage | null; fetch?: typeof fetch;
  now?: () => number; id?: () => string;
  ownerId?: string;
  schedule?: (callback: () => void, milliseconds: number) => () => void;
}) => {
  const window = options.window ?? globalThis.window, fetcher = options.fetch ?? globalThis.fetch;
  const prefix = "testcenter-rewrite:participant-native-command:v1:";
  const owner = options.ownerId ?? participantNativeOwner(window);
  const storage = (() => { try { return options.storage === undefined ? window.localStorage : options.storage; } catch { return null; } })();
  const schedule = options.schedule ?? ((callback, milliseconds) => { const id = window.setTimeout(callback, milliseconds); return () => window.clearTimeout(id); });
  const selected = (): Scope | null => { const run = options.readState()?.testRun; return validScope(run) ? {
    tenantId: run.tenantId, workspaceId: run.workspaceId, participantSessionId: run.participantSessionId,
    testRunId: run.testRunId, contentReleaseId: run.contentReleaseId, bookletKey: run.bookletKey } : null; };
  const queue = new Map<string, Entry>();
  let stopped = false, current: string | null = null, cancel: (() => void) | null = null;
  let currentGeneration = options.generation?.();
  const flights = new Map<string, { entry: Entry; controller: AbortController }>();
  const retries = new Map<string, () => void>();
  const valid = (value: unknown): value is Entry => {
    const entry = value as Entry | null;
    return Boolean(entry && entry.owner === owner && validScope(entry.scope) && /^[A-Za-z0-9_-]{1,160}$/.test(entry.id) &&
      (entry.version === undefined || entry.version === 2) &&
      (entry.version !== 2 || entry.prepared !== true || isParticipantControllerDispatch(entry.request?.controllerDispatch)) &&
      participantNativeCommandKeywords.includes(entry.keyword) && Array.isArray(entry.args) && entry.args.every(value => typeof value === "string") &&
      entry.request && (entry.prepared === undefined || entry.prepared === true) && entry.request.deliveryId === entry.id && entry.request.keyword === entry.keyword &&
        (entry.request.controllerDispatch === undefined || isParticipantControllerDispatch(entry.request.controllerDispatch) && entry.request.controllerDispatch.controllerId === owner) &&
        entry.request.testRunId === entry.scope.testRunId && entry.request.contentReleaseId === entry.scope.contentReleaseId &&
        entry.request.bookletKey === entry.scope.bookletKey && JSON.stringify(entry.request.arguments) === JSON.stringify(entry.args) &&
        ["LOADING", "RUNNING", "PAUSED", "ERROR"].includes(entry.request.controllerStatus) && Number.isSafeInteger(entry.request.timeStamp) && entry.request.timeStamp >= 0);
  };
  const persist = (entry: Entry): void => { try { storage?.setItem(prefix + entry.id, JSON.stringify(entry)); } catch {} };
  const remove = (entry: Entry): void => { queue.delete(entry.id); try {
    if (storage?.getItem(prefix + entry.id) === JSON.stringify(entry)) storage.removeItem(prefix + entry.id);
  } catch {} };
  const restore = (): void => { try { for (let index = 0; storage && index < storage.length; index++) {
    const name = storage.key(index); if (!name?.startsWith(prefix)) continue;
    try { const entry: unknown = JSON.parse(storage.getItem(name) ?? "null");
      if (valid(entry) && name === prefix + entry.id && !queue.has(entry.id)) {
        queue.set(entry.id, entry);
        if (entry.request.controllerDispatch) recordControllerDispatch(window, entry.scope.testRunId, entry.request.controllerDispatch);
      }
    } catch {}
  } } catch {} };
  const wake = (delay = 0): void => { cancel?.(); cancel = schedule(() => { cancel = null; void drain(); }, delay); };
  const drain = async (): Promise<void> => {
    const scope = selected();
    if (stopped || !scope || current !== scopeKey(scope)) return;
    // A legacy packet has no recoverable dispatch position. Preserve its old
    // native FIFO until it settles; every new v2 packet can overlap normally.
    const legacy = [...queue.values()].find(entry => scopeKey(entry.scope) === current && entry.version === undefined && !entry.request.controllerDispatch);
    if (legacy) { if (!flights.has(legacy.id) && !retries.has(legacy.id)) void dispatch(legacy); return; }
    for (const entry of queue.values()) {
      if (scopeKey(entry.scope) === current && !flights.has(entry.id) && !retries.has(entry.id)) void dispatch(entry);
    }
  };
  const dispatch = async (entry: Entry): Promise<void> => {
    const credential = readParticipantSessionCredential(entry.scope.participantSessionId);
    if (!credential) return;
    const request = { entry, controller: new AbortController() }; flights.set(entry.id, request);
    const generation = options.generation?.();
    const isCurrent = (): boolean => !stopped && !request.controller.signal.aborted && generation === options.generation?.() &&
      Boolean(selected() && scopeKey(selected()!) === scopeKey(entry.scope));
    let retry = false;
    try {
      if (!entry.prepared) {
        await options.prepare(isCurrent); if (!isCurrent()) return;
        if (entry.version === 2) {
          // Source terminateTest observes state after canDeactivateUnit, at
          // the terminal transition. Prepared and legacy packets stay exact.
          if (entry.keyword === "terminate") entry.request.controllerStatus = options.controllerStatus();
          entry.request.controllerDispatch ??= nextParticipantControllerDispatch(entry.scope.testRunId, window, owner, options.readState()?.testRun.controllerDispatches);
        }
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
          application.superseded !== undefined && application.superseded !== true ||
          (application.controllerDispatch !== undefined || application.testRun?.stateRevision !== undefined) &&
            JSON.stringify(application.controllerDispatch) !== JSON.stringify(entry.request.controllerDispatch) ||
          typeof application.applied !== "boolean" || !Number.isFinite(Date.parse(application.executedAt)) ||
          !validScope(application.testRun) || scopeKey(application.testRun) !== scopeKey(entry.scope) ||
          application.testRun?.controllerDispatches !== undefined && !isParticipantControllerDispatches(application.testRun.controllerDispatches) ||
          application.testRun?.stateRevision !== undefined && (!Number.isSafeInteger(application.testRun.stateRevision) || application.testRun.stateRevision < 1) ||
          application.testRun?.controllerEntry !== undefined && (!application.testRun.controllerEntry ||
            typeof application.testRun.controllerEntry.active !== "boolean" || !Number.isSafeInteger(application.testRun.controllerEntry.revision) || application.testRun.controllerEntry.revision < 1) ||
          !["tenantId", "workspaceId", "participantSessionId"].every(key => application.participantSession?.[key as keyof typeof application.participantSession] === entry.scope[key as keyof Scope])) {
        throw Object.assign(new Error("The console receipt does not match its selected immutable Run and command."), { retryable: false });
      }
      remove(entry);
      await options.applied(application, isCurrent, entry.request.controllerDispatch);
    } catch (error) {
      if (!isCurrent()) return;
      if (!queue.has(entry.id)) { options.failed(error instanceof Error ? error : new Error(String(error))); return; }
      retry = (error as { retryable?: boolean }).retryable !== false;
      if (!retry) { remove(entry); options.failed(error instanceof Error ? error : new Error(String(error))); }
    } finally {
      if (flights.get(entry.id) === request) {
        flights.delete(entry.id);
        if (retry && isCurrent() && queue.has(entry.id)) {
          retries.set(entry.id, schedule(() => { retries.delete(entry.id); void drain(); }, 1_000));
        } else if (isCurrent() && queue.size) wake();
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
      current = key; currentGeneration = generation;
      for (const request of flights.values()) request.controller.abort(); flights.clear();
      for (const cancelRetry of retries.values()) cancelRetry(); retries.clear();
      cancel?.(); cancel = null;
    }
    restore(); if (current && !cancel && [...queue.values()].some(entry => scopeKey(entry.scope) === current &&
      !flights.has(entry.id) && !retries.has(entry.id))) wake();
  };
  const online = (): void => {
    cancel?.(); cancel = null; for (const cancelRetry of retries.values()) cancelRetry(); retries.clear(); observeScope();
  };
  window.addEventListener("online", online);
  observeScope();
  return { observeScope,
    command(keyword: ParticipantNativeCommandKeyword, args: readonly string[]): void {
      if (stopped || !participantNativeCommandKeywords.includes(keyword) || !Array.isArray(args) || !args.every(arg => typeof arg === "string")) return;
      observeScope();
      const scope = selected(); if (!scope) return;
      const id = (options.id ?? (() => crypto.randomUUID()))();
      const entry: Entry = { scope, owner, id, version: 2, keyword, args: [...args], request: {
        testRunId: scope.testRunId, contentReleaseId: scope.contentReleaseId, bookletKey: scope.bookletKey,
        deliveryId: id, keyword, arguments: [...args], controllerStatus: options.controllerStatus(), timeStamp: (options.now ?? Date.now)(),
        ...(keyword === "terminate" ? {} : { controllerDispatch: nextParticipantControllerDispatch(scope.testRunId, window, owner, options.readState()?.testRun.controllerDispatches) }) } };
      queue.set(entry.id, entry); persist(entry); options.started?.(entry.request); observeScope();
    },
    stop(): void {
      if (stopped) return;
      stopped = true;
      for (const request of flights.values()) request.controller.abort(); flights.clear();
      for (const cancelRetry of retries.values()) cancelRetry(); retries.clear();
      cancel?.(); cancel = null;
      // Angular destroys this controller on route exit; it must not leave
      // effectful intents for a later controller. A document reload does not
      // call this hook, so its exact pending deliveries remain restorable.
      for (const entry of queue.values()) remove(entry);
      window.removeEventListener("online", online);
    }
  };
};
