import type { ParticipantRunCommand, ParticipantControllerDispatch, TestRun } from "@testcenter-rewrite-app/domain";
import { receivedParticipantControllerDispatch } from "./participant-native-command";
import { parseParticipantRunCommand } from "@testcenter-rewrite-app/contracts/participant-run-command";
import { productionApiRoutes, resolveRoutePath } from "@testcenter-rewrite-app/contracts";
import { withSelectedParticipantRun } from "./participant-session-links";

export type ParticipantCommandReceiver = {
  accept(commands: readonly unknown[]): void;
  hasOutstanding(): boolean;
  stop(): void;
};

/** Accept first, pace ACK starts, then dispatch in ACK completion order. */
export const createParticipantCommandReceiver = (options: {
  participantSessionId: string;
  testRunId: string;
  acknowledge: (command: ParticipantRunCommand, signal: AbortSignal) => Promise<unknown>;
  execute: (command: ParticipantRunCommand, signal: AbortSignal) => void | Promise<void>;
  now?: () => number;
  schedule?: (callback: () => void, delay: number) => () => void;
}): ParticipantCommandReceiver => {
  const now = options.now ?? Date.now;
  const schedule = options.schedule ?? ((callback, delay) => {
    const handle = globalThis.setTimeout(callback, delay);
    return () => globalThis.clearTimeout(handle);
  });
  const controller = new AbortController();
  const seen = new Set<string>();
  const outstanding = new Set<string>();
  const timers = new Set<() => void>();
  const execute = (command: ParticipantRunCommand): void => {
    if (controller.signal.aborted) return;
    // The Original subscription enters its handler in the successful ACK
    // callback, before another queued native invocation can overtake it.
    let execution: void | Promise<void>;
    try { execution = options.execute(command, controller.signal); }
    catch (error) { execution = Promise.reject(error); }
    void Promise.resolve(execution).then(() => {
      if (controller.signal.aborted) return;
      outstanding.delete(command.commandId);
    }).catch(error => {
      if (controller.signal.aborted) return;
      if (error?.retryable === false) {
        outstanding.delete(command.commandId);
        return;
      }
      let cancel: () => void;
      cancel = schedule(() => { timers.delete(cancel); execute(command); }, 1_000);
      timers.add(cancel);
    });
  };
  let nextStartAt = 0;
  const start = (command: ParticipantRunCommand) => {
    if (controller.signal.aborted) return;
    void options.acknowledge(command, controller.signal).then(value => {
      if (controller.signal.aborted) return;
      const receipt = parseParticipantRunCommand(value);
      if (!receipt?.acknowledgedAt || Object.keys(command).some(key => !["acknowledgedAt", "executedAt", "executionSequence"].includes(key) &&
        (key === "debugArguments" ? JSON.stringify(receipt.debugArguments ?? []) !== JSON.stringify(command.debugArguments) :
          receipt[key as keyof ParticipantRunCommand] !== command[key as keyof ParticipantRunCommand]))) {
        throw new Error("The command receipt does not match the accepted command.");
      }
      execute(receipt);
    }).catch(() => {
      // A failed acknowledgement never authorizes an effect. A subsequent
      // server delivery may retry it; the server retains the first receipt.
      seen.delete(command.commandId);
      outstanding.delete(command.commandId);
    });
  };
  return {
    accept(commands) {
      if (controller.signal.aborted) return;
      const parsed = commands.map(parseParticipantRunCommand);
      const ids = new Set<string>();
      let lastSequence = 0;
      for (const command of parsed) {
        if (!command || command.participantSessionId !== options.participantSessionId || command.testRunId !== options.testRunId ||
            command.executedAt != null || command.acknowledgedAt !== null ||
            ids.has(command.commandId) || command.sequence <= lastSequence) return;
        ids.add(command.commandId);
        lastSequence = command.sequence;
      }
      for (const item of parsed) {
        if (!item || seen.has(item.commandId)) continue;
        const command = structuredClone(item);
        seen.add(command.commandId);
        outstanding.add(command.commandId);
        const delay = Math.max(nextStartAt - now(), 0);
        nextStartAt = now() + delay + 1_000;
        if (delay === 0) start(command);
        else {
          let cancel: () => void;
          cancel = schedule(() => { timers.delete(cancel); start(command); }, delay);
          timers.add(cancel);
        }
      }
    },
    hasOutstanding() { return outstanding.size > 0; },
    stop() {
      controller.abort();
      for (const cancel of timers) cancel();
      timers.clear();
      outstanding.clear();
    }
  };
};

export type ParticipantCommandChannel = ParticipantCommandReceiver & {
  stopReception(): void;
  poll(isCurrent: () => boolean): Promise<void>;
};

export type ParticipantCommandExecution = (command: ParticipantRunCommand, signal: AbortSignal,
  allocate?: (observed?: TestRun["controllerDispatches"]) => ParticipantControllerDispatch) => void | Promise<void>;

export const createParticipantCommandChannel = (options: {
  participantSessionId: string; testRunId: string;
  readCredential: () => string | null;
  execute: ParticipantCommandExecution;
}): ParticipantCommandChannel => {
  const headers = (): Record<string, string> => {
    const token = options.readCredential();
    return token ? { authorization: `Bearer ${token}` } : {};
  };
  const receiver = createParticipantCommandReceiver({ ...options,
    execute: (command, signal) => options.execute(command, signal,
      observed => receivedParticipantControllerDispatch(command, observed)),
    acknowledge: async (command, signal) => {
      const response = await fetch(resolveRoutePath(productionApiRoutes.participant.acknowledgeCommand, {
        participantSessionId: options.participantSessionId, commandId: command.commandId
      }), { method: "PATCH", cache: "no-store", signal,
        headers: { "content-type": "application/json", ...headers() }, body: JSON.stringify({ testRunId: options.testRunId }) });
      if (!response.ok) throw new Error(`Command acknowledgement returned HTTP ${response.status}.`);
      return (await response.json() as { command?: unknown }).command;
    }
  });
  let polling: AbortController | null = null;
  return { ...receiver,
    stopReception() { polling?.abort(); polling = null; },
    stop() { polling?.abort(); polling = null; receiver.stop(); },
    async poll(isCurrent) {
      if (!isCurrent()) return;
      polling?.abort();
      const controller = new AbortController();
      polling = controller;
      try {
        const response = await fetch(withSelectedParticipantRun(resolveRoutePath(productionApiRoutes.participant.listPendingCommands, {
          participantSessionId: options.participantSessionId
        }), options.testRunId), { method: "GET", cache: "no-store", signal: controller.signal, headers: headers() });
        if (!response.ok || controller.signal.aborted || !isCurrent()) return;
        const payload = await response.json() as { commands?: unknown };
        if (!controller.signal.aborted && isCurrent() && Array.isArray(payload.commands)) receiver.accept(payload.commands);
      } finally {
        if (polling === controller) polling = null;
      }
    }
  };
};
