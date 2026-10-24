import type { ParticipantRunCommand, ParticipantRunCommandScope, ParticipantRunCommandApplicationResult, TestRun, ParticipantSession, ParticipantControllerDispatch } from "@testcenter-rewrite-app/domain";
import { parseParticipantRunCommand, participantCommandExecutionRoute } from "@testcenter-rewrite-app/contracts/participant-run-command";
import { resolveRoutePath } from "@testcenter-rewrite-app/contracts";
import { readParticipantSessionCredential } from "./participant-access-credentials";
import { receivedParticipantControllerDispatch } from "./participant-native-command";
export { deliverParticipantControllerTimerInterruption } from "./participant-native-command";
import { isParticipantControllerDispatches } from "@testcenter-rewrite-app/contracts/participant-native-command";

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
    scope: ParticipantRunCommandScope & { contentReleaseId: string; bookletKey: string; controllerDispatches?: TestRun["controllerDispatches"] };
    isCurrent: () => boolean;
    controllerStatus: () => "RUNNING" | "PAUSED" | "ERROR" | "TERMINATED" | "TERMINATED_PAUSED";
    terminationNoop?: boolean;
    observed?: (dispatch: ParticipantControllerDispatch, status: "RUNNING" | "PAUSED" | "ERROR" | "TERMINATED" | "TERMINATED_PAUSED", terminationNoop?: true) => void;
    prepare: () => Promise<void>;
    started?: (dispatch: ParticipantControllerDispatch) => void;
    apply: (application: ParticipantRunCommandApplicationResult, dispatch: ParticipantControllerDispatch) => Promise<void>;
    completed?: (command: ParticipantRunCommand) => void;
  }
): Promise<void> => {
  if (signal.aborted || !options.isCurrent()) return;
  const terminal = command.commandType === "complete" || command.commandType === "complete_and_lock";
  let dispatch = terminal ? undefined : receivedParticipantControllerDispatch(command, options.scope.controllerDispatches);
  let controllerStatus = terminal ? undefined : options.controllerStatus();
  let terminationNoop = false;
  if (terminal) {
    const initial = options.controllerStatus();
    terminationNoop = options.terminationNoop ?? initial === "TERMINATED";
    if (!terminationNoop) await Promise.resolve();
    if (signal.aborted || !options.isCurrent()) return;
    controllerStatus = terminationNoop ? initial : options.controllerStatus();
    dispatch = receivedParticipantControllerDispatch(command, options.scope.controllerDispatches);
    options.observed?.(dispatch, controllerStatus, terminationNoop ? true : undefined);
  }
  if (dispatch && !terminationNoop) options.started?.(dispatch);
  if (command.commandType !== "debug" && !terminationNoop) await options.prepare();
  if (signal.aborted || !options.isCurrent()) return;
  dispatch ??= receivedParticipantControllerDispatch(command, options.scope.controllerDispatches);
  const token = readParticipantSessionCredential(command.participantSessionId);
  const response = await fetch(resolveRoutePath(participantCommandExecutionRoute, {
    participantSessionId: command.participantSessionId, commandId: command.commandId
  }), { method: "POST", cache: "no-store", signal, headers: {
    "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {})
  }, body: JSON.stringify({ testRunId: command.testRunId, controllerStatus: controllerStatus ?? options.controllerStatus(), controllerDispatch: dispatch,
    ...(options.completed ? { commandCompletion: "browser-v1" } : {}),
    ...(terminationNoop ? { terminationNoop: true } : {}) }) });
  if (!response.ok) throw Object.assign(new Error(`Command application returned HTTP ${response.status}.`), { retryable: response.status >= 500 });
  const payload = await response.json() as { application?: {
    command?: unknown;
    testRun?: Partial<TestRun>;
    participantSession?: Partial<ParticipantSession>;
    applied?: unknown;
    superseded?: unknown;
    terminalContinuation?: unknown;
    controllerDispatch?: unknown;
  } } | null;
  if (signal.aborted || !options.isCurrent()) return;
  const application = payload?.application, receipt = parseParticipantRunCommand(application?.command);
  if (!receipt?.executedAt || !receipt.executionSequence || Boolean(receipt.terminationNoop) !== terminationNoop || typeof application?.applied !== "boolean" ||
      application.superseded !== undefined && application.superseded !== true ||
      application.terminalContinuation !== undefined && (application.terminalContinuation !== true ||
        receipt.terminationNoop || !["complete", "complete_and_lock"].includes(receipt.commandType) || receipt.commandCompletion !== "browser-v1") ||
      (application.controllerDispatch !== undefined || application.testRun?.stateRevision !== undefined) && JSON.stringify(application.controllerDispatch) !== JSON.stringify(dispatch) ||
      Object.keys(command).some(key => !["executedAt", "executionSequence"].includes(key) &&
        (key === "debugArguments" ? JSON.stringify(receipt.debugArguments ?? []) !== JSON.stringify(command.debugArguments) :
          receipt[key as keyof ParticipantRunCommand] !== command[key as keyof ParticipantRunCommand])) ||
      !(["tenantId", "workspaceId", "participantSessionId", "testRunId", "contentReleaseId", "bookletKey"] as const).every(key =>
        application.testRun?.[key] === options.scope[key]) ||
      !["running", "paused", "completed"].includes(application.testRun?.status ?? "") ||
      application.testRun?.controllerDispatches !== undefined && !isParticipantControllerDispatches(application.testRun.controllerDispatches) ||
      application.testRun?.stateRevision !== undefined && (!Number.isSafeInteger(application.testRun.stateRevision) || application.testRun.stateRevision < 1) ||
          application.testRun?.controllerEntry !== undefined && (!application.testRun.controllerEntry ||
            typeof application.testRun.controllerEntry.active !== "boolean" || !Number.isSafeInteger(application.testRun.controllerEntry.revision) || application.testRun.controllerEntry.revision < 1) ||
      !application.testRun?.unitResponses || typeof application.testRun.unitResponses !== "object" || Array.isArray(application.testRun.unitResponses) ||
      !(["tenantId", "workspaceId", "participantSessionId"] as const).every(key =>
        application.participantSession?.[key] === command[key])) {
    throw Object.assign(new Error("The command application does not match the accepted receipt."), { retryable: false });
  }
  await options.apply({ ...application, command: receipt } as ParticipantRunCommandApplicationResult, dispatch);
  if (receipt.commandCompletion === "browser-v1") options.completed?.(receipt);
};

/** A handler waits for its own continuation; other command handlers remain independent. */
export const settleAcceptedParticipantCommand = async (options: {
  signal?: AbortSignal;
  isCurrent: () => boolean;
  reconcile: () => Promise<void>;
  failed: (error: Error) => void;
}): Promise<void> => {
  while (!options.signal?.aborted && options.isCurrent()) {
    try { await options.reconcile(); return; }
    catch (error) {
      const value = error instanceof Error ? error : new Error(String(error));
      if ((error as { retryable?: boolean })?.retryable === false ||
        (error as { statusCode?: number })?.statusCode! >= 400 && (error as { statusCode?: number }).statusCode! < 500) {
        options.failed(value); throw value;
      }
      await new Promise<void>(resolve => {
        const complete = (): void => { globalThis.clearTimeout(timer); options.signal?.removeEventListener("abort", complete); resolve(); };
        const timer = globalThis.setTimeout(complete, 1_000);
        options.signal?.addEventListener("abort", complete, { once: true });
        if (options.signal?.aborted) complete();
      });
    }
  }
};
