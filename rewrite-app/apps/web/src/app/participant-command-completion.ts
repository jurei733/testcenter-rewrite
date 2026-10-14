import { participantCommandCompletionRoute, isParticipantCommandCompletionRequest,
  type ParticipantCommandCompletionRequest, type ParticipantCommandCompletionResult } from "@testcenter-rewrite-app/contracts/participant-native-command";
import { resolveRoutePath } from "@testcenter-rewrite-app/contracts";
import { readParticipantSessionCredential } from "./participant-access-credentials";

type Scope = ParticipantCommandCompletionResult["scope"];
type Entry = { scope: Scope; packet: ParticipantCommandCompletionRequest };
const fields = ["tenantId", "workspaceId", "participantSessionId", "testRunId", "contentReleaseId", "bookletKey"] as const;
const prefix = "testcenter-rewrite:participant-command-completion:v1:";
const keyFor = (entry: Entry): string => prefix + JSON.stringify([fields.map(key => entry.scope[key]), entry.packet.command.kind,
  entry.packet.command.kind === "native" ? entry.packet.command.request.deliveryId : entry.packet.command.commandId]);
const valid = (entry: unknown): entry is Entry => {
  const value = entry as Entry | null;
  return Boolean(value && fields.every(key => typeof value.scope?.[key] === "string" && Boolean(value.scope[key].trim())) &&
    Object.keys(value).every(key => ["scope", "packet"].includes(key)) && Object.keys(value.scope).every(key => fields.includes(key as typeof fields[number])) &&
    isParticipantCommandCompletionRequest(value.packet) && ["testRunId", "contentReleaseId", "bookletKey"].every(key =>
      value.scope[key as "testRunId"] === value.packet[key as "testRunId"]));
};

/** Independent, scope-bound completion delivery; retry never applies a command. */
export const createParticipantCommandCompletions = (options: {
  window: Pick<Window, "addEventListener" | "removeEventListener" | "setTimeout" | "clearTimeout">;
  storage: Storage | null;
  fetch?: typeof fetch;
  readCredential?: (participantSessionId: string) => string | null;
  now?: () => number;
  failed?: (error: Error) => void;
}) => {
  const entries = new Map<string, Entry>(), sessions = new Set<string>(), flights = new Map<string, AbortController>();
  const deliveries = new Map<string, Promise<void>>(), completed = new Set<string>();
  const deniedCredentials = new Map<string, { credential: string; retryAt: number }>();
  const now = options.now ?? (() => globalThis.performance.now());
  const fetcher = options.fetch ?? globalThis.fetch, credentialFor = options.readCredential ?? readParticipantSessionCredential;
  let stopped = false, retryTimer: number | null = null;
  const restore = (): void => {
    try {
      for (let index = 0; index < (options.storage?.length ?? 0); index++) {
        const key = options.storage!.key(index); if (!key?.startsWith(prefix) || entries.has(key)) continue;
        try {
          const value: unknown = JSON.parse(options.storage!.getItem(key) ?? "null");
          if (valid(value) && keyFor(value) === key && sessions.has(value.scope.participantSessionId)) entries.set(key, value);
        } catch { /* Uncertain and unrelated storage is preserved. */ }
      }
    } catch { /* The in-memory packet still permits this document's delivery. */ }
  };
  const retry = (): void => {
    if (stopped || retryTimer !== null || !entries.size) return;
    retryTimer = options.window.setTimeout(() => { retryTimer = null; void drain(); }, 5_000);
  };
  const deliver = async (key: string, entry: Entry): Promise<void> => {
    const credential = credentialFor(entry.scope.participantSessionId);
    const denied = deniedCredentials.get(key);
    if (!credential || denied?.credential === credential && now() < denied.retryAt) return;
    const controller = new AbortController(); flights.set(key, controller);
    const timeout = options.window.setTimeout(() => controller.abort(), 25_000);
    try {
      const response = await fetcher(resolveRoutePath(participantCommandCompletionRoute, { participantSessionId: entry.scope.participantSessionId }), {
        method: "POST", cache: "no-store", signal: controller.signal,
        headers: { "content-type": "application/json", authorization: `Bearer ${credential}` }, body: JSON.stringify(entry.packet)
      });
      if (stopped || controller.signal.aborted) return;
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500) deniedCredentials.set(key, { credential, retryAt: now() + 60_000 });
        throw new Error(`Command completion returned HTTP ${response.status}.`);
      }
      const body = await response.json() as { completion?: ParticipantCommandCompletionResult } | null;
      const receipt = body?.completion;
      if (!receipt || !fields.every(field => receipt.scope?.[field] === entry.scope[field]) ||
        !Object.keys(entry.packet).every(field => JSON.stringify(receipt[field as keyof typeof receipt]) === JSON.stringify(entry.packet[field as keyof typeof entry.packet])) ||
        typeof receipt.applied !== "boolean" || typeof receipt.acceptedAt !== "string" || !Number.isFinite(Date.parse(receipt.acceptedAt))) {
        throw new Error("The command completion receipt does not match its immutable scope, command and timestamp.");
      }
      if (stopped || controller.signal.aborted) return;
      entries.delete(key);
      deniedCredentials.delete(key);
      completed.add(key);
      try { if (options.storage?.getItem(key) === JSON.stringify(entry)) options.storage.removeItem(key); } catch {}
    } catch (error) {
      if (!stopped && !controller.signal.aborted) options.failed?.(error instanceof Error ? error : new Error(String(error)));
    } finally { options.window.clearTimeout(timeout); flights.delete(key); }
  };
  const drain = async (): Promise<void> => {
    if (stopped) return;
    restore();
    await Promise.all([...entries].filter(([, entry]) => sessions.has(entry.scope.participantSessionId)).map(([key, entry]) => {
      const active = deliveries.get(key); if (active) return active;
      const pending = deliver(key, entry).finally(() => deliveries.delete(key)); deliveries.set(key, pending); return pending;
    }));
    if (entries.size) retry();
  };
  const online = (): void => { deniedCredentials.clear(); if (retryTimer !== null) options.window.clearTimeout(retryTimer); retryTimer = null; void drain(); };
  options.window.addEventListener("online", online);
  return {
    observeSession(participantSessionId: string): void {
      if (stopped || !participantSessionId?.trim()) return;
      const fresh = !sessions.has(participantSessionId); sessions.add(participantSessionId);
      if (fresh) void drain();
    },
    complete(scope: Scope, packet: ParticipantCommandCompletionRequest): void {
      if (stopped) return;
      // Preserve only the six immutable fields; Run snapshots and credentials
      // must never become part of the browser's completion journal.
      const entry: Entry = { scope: Object.fromEntries(fields.map(key => [key, scope[key]])) as Scope, packet: structuredClone(packet) };
      if (!valid(entry)) throw new Error("The completed command's immutable scope is invalid.");
      sessions.add(scope.participantSessionId);
      const key = keyFor(entry);
      if (completed.has(key)) return;
      restore();
      // A replay cannot replace the first captured completion timestamp.
      if (!entries.has(key)) {
        entries.set(key, entry); try { options.storage?.setItem(key, JSON.stringify(entry)); } catch {}
      }
      void drain();
    },
    drain,
    stop(): void {
      stopped = true; options.window.removeEventListener("online", online);
      if (retryTimer !== null) options.window.clearTimeout(retryTimer); retryTimer = null;
      for (const controller of flights.values()) controller.abort(); flights.clear();
      // Durable, already-completed packets survive document replacement.
    }
  };
};

let documentCompletions: ReturnType<typeof createParticipantCommandCompletions> | undefined;
const completions = () => documentCompletions ??= createParticipantCommandCompletions({ window: globalThis.window,
  storage: (() => { try { return globalThis.localStorage; } catch { return null; } })() });
export const observeParticipantCommandCompletionSession = (participantSessionId: string): void => completions().observeSession(participantSessionId);
export const queueParticipantCommandCompletion = (scope: Scope, packet: ParticipantCommandCompletionRequest): void => completions().complete(scope, packet);
