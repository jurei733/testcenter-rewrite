import type { ParticipantRunCommand, ParticipantRunCommandScope, ParticipantRunCommandApplicationResult, TestRun, ParticipantSession } from "@testcenter-rewrite-app/domain";
import { parseParticipantRunCommand, participantCommandExecutionRoute } from "@testcenter-rewrite-app/contracts/participant-run-command";
import { resolveRoutePath } from "@testcenter-rewrite-app/contracts";
import { readParticipantSessionCredential } from "./participant-access-credentials";

/** Reconcile presentation after a committed effect without occupying its command lane. */
export const reconcileAcceptedParticipantCommand = (options: {
  signal?: AbortSignal;
  isCurrent: () => boolean;
  reconcile: () => Promise<void>;
  failed: (error: Error) => void;
  schedule?: (callback: () => void, milliseconds: number) => () => void;
}): void => {
  const schedule = options.schedule ?? ((callback, milliseconds) => {
    const timer = globalThis.setTimeout(callback, milliseconds);
    return () => globalThis.clearTimeout(timer);
  });
  let stopped = false, cancel: (() => void) | null = null;
  const current = (): boolean => !stopped && !options.signal?.aborted && options.isCurrent();
  const stop = (): void => {
    stopped = true; cancel?.(); cancel = null;
    options.signal?.removeEventListener("abort", stop);
  };
  const attempt = (): void => {
    if (!current()) { stop(); return; }
    void Promise.resolve().then(() => current() ? options.reconcile() : undefined).then(stop).catch(error => {
      if (!current()) { stop(); return; }
      if (error?.retryable === false || error?.statusCode >= 400 && error.statusCode < 500) {
        stop(); options.failed(error instanceof Error ? error : new Error(String(error))); return;
      }
      cancel = schedule(() => { cancel = null; attempt(); }, 1_000);
    });
  };
  options.signal?.addEventListener("abort", stop, { once: true });
  attempt();
};

/** Apply an accepted receipt before projecting its effect into the current view. */
export const executeReceivedParticipantCommand = async (
  command: ParticipantRunCommand,
  signal: AbortSignal,
  options: {
    scope: ParticipantRunCommandScope & { contentReleaseId: string; bookletKey: string };
    isCurrent: () => boolean;
    controllerStatus: () => "RUNNING" | "PAUSED" | "ERROR";
    prepare: () => Promise<void>;
    apply: (application: ParticipantRunCommandApplicationResult) => Promise<void>;
  }
): Promise<void> => {
  if (signal.aborted || !options.isCurrent()) return;
  if (command.commandType !== "debug") await options.prepare();
  if (signal.aborted || !options.isCurrent()) return;
  const token = readParticipantSessionCredential(command.participantSessionId);
  const response = await fetch(resolveRoutePath(participantCommandExecutionRoute, {
    participantSessionId: command.participantSessionId, commandId: command.commandId
  }), { method: "POST", cache: "no-store", signal, headers: {
    "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {})
  }, body: JSON.stringify({ testRunId: command.testRunId, controllerStatus: options.controllerStatus() }) });
  if (!response.ok) throw Object.assign(new Error(`Command application returned HTTP ${response.status}.`), { retryable: response.status >= 500 });
  const payload = await response.json() as { application?: {
    command?: unknown;
    testRun?: Partial<TestRun>;
    participantSession?: Partial<ParticipantSession>;
    applied?: unknown;
  } } | null;
  if (signal.aborted || !options.isCurrent()) return;
  const application = payload?.application, receipt = parseParticipantRunCommand(application?.command);
  if (!receipt?.executedAt || !receipt.executionSequence || typeof application?.applied !== "boolean" ||
      Object.keys(command).some(key => !["executedAt", "executionSequence"].includes(key) &&
        (key === "debugArguments" ? JSON.stringify(receipt.debugArguments ?? []) !== JSON.stringify(command.debugArguments) :
          receipt[key as keyof ParticipantRunCommand] !== command[key as keyof ParticipantRunCommand])) ||
      !(["tenantId", "workspaceId", "participantSessionId", "testRunId", "contentReleaseId", "bookletKey"] as const).every(key =>
        application.testRun?.[key] === options.scope[key]) ||
      !["running", "paused", "completed"].includes(application.testRun?.status ?? "") ||
          application.testRun?.controllerEntry !== undefined && (!application.testRun.controllerEntry ||
            typeof application.testRun.controllerEntry.active !== "boolean" || !Number.isSafeInteger(application.testRun.controllerEntry.revision) || application.testRun.controllerEntry.revision < 1) ||
      !application.testRun?.unitResponses || typeof application.testRun.unitResponses !== "object" || Array.isArray(application.testRun.unitResponses) ||
      !(["tenantId", "workspaceId", "participantSessionId"] as const).every(key =>
        application.participantSession?.[key] === command[key])) {
    throw Object.assign(new Error("The command application does not match the accepted receipt."), { retryable: false });
  }
  await options.apply({ ...application, command: receipt } as ParticipantRunCommandApplicationResult);
};
