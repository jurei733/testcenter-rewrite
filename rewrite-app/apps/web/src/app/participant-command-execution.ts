import type { ParticipantRunCommand, ParticipantRunCommandScope } from "@testcenter-rewrite-app/domain";
import { parseParticipantRunCommand, participantCommandExecutionRoute } from "@testcenter-rewrite-app/contracts/participant-run-command";
import { resolveRoutePath } from "@testcenter-rewrite-app/contracts";
import { readParticipantSessionCredential } from "./participant-access-credentials";

/** Apply an accepted receipt before projecting its effect into the current view. */
export const executeReceivedParticipantCommand = async (
  command: ParticipantRunCommand,
  signal: AbortSignal,
  options: {
    isCurrent: () => boolean;
    controllerStatus: () => "RUNNING" | "PAUSED" | "ERROR";
    prepare: () => Promise<void>;
    apply: () => Promise<void>;
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
    testRun?: Partial<ParticipantRunCommandScope>;
    participantSession?: Partial<Omit<ParticipantRunCommandScope, "testRunId">>;
    applied?: unknown;
  } } | null;
  if (signal.aborted || !options.isCurrent()) return;
  const application = payload?.application, receipt = parseParticipantRunCommand(application?.command);
  if (!receipt?.executedAt || !receipt.executionSequence || typeof application?.applied !== "boolean" ||
      Object.keys(command).some(key => !["executedAt", "executionSequence"].includes(key) &&
        (key === "debugArguments" ? JSON.stringify(receipt.debugArguments ?? []) !== JSON.stringify(command.debugArguments) :
          receipt[key as keyof ParticipantRunCommand] !== command[key as keyof ParticipantRunCommand])) ||
      !(["tenantId", "workspaceId", "participantSessionId", "testRunId"] as const).every(key =>
        application.testRun?.[key] === command[key]) ||
      !(["tenantId", "workspaceId", "participantSessionId"] as const).every(key =>
        application.participantSession?.[key] === command[key])) {
    throw Object.assign(new Error("The command application does not match the accepted receipt."), { retryable: false });
  }
  await options.apply();
};
