import { productionApiRoutes, resolveRoutePath } from "@testcenter-rewrite-app/contracts";
import type { ShellRuntimeActionsHost } from "./rewrite-app-shell.runtime-actions";
import type { ShellRuntimeReadsHost } from "./rewrite-app-shell.runtime-reads";
import type { RuntimePresentationHost } from "./rewrite-app-shell.runtime";
import type { ShellRuntimeState, ShellWorkspaceState } from "./rewrite-app-shell.state";

export function createRuntimeActionsStateHost(args: {
  request<T>(label: string, method: string, path: string, body?: unknown): Promise<T>;
  workspaceState: ShellWorkspaceState;
  runtimeState: ShellRuntimeState;
  createRuntimePresentationHost(): RuntimePresentationHost;
  refreshCrossViewStateAfterRuntimeChange(): Promise<void>;
}): ShellRuntimeActionsHost {
  return {
    request: args.request,
    getParticipantSignInPath: () => productionApiRoutes.participant.signIn,
    getResumeParticipantSessionPath: () =>
      resolveRoutePath(productionApiRoutes.participant.resumeSession, {
        participantSessionId: args.runtimeState.participantSessionId.trim()
      }),
    getSaveProgressPath: () =>
      resolveRoutePath(productionApiRoutes.participant.saveProgress, {
        testRunId: args.runtimeState.testRunId.trim()
      }),
    getResumeRunPath: () =>
      resolveRoutePath(productionApiRoutes.participant.resumeRun, {
        testRunId: args.runtimeState.testRunId.trim()
      }),
    getCompleteRunPath: () =>
      resolveRoutePath(productionApiRoutes.participant.completeRun, {
        testRunId: args.runtimeState.testRunId.trim()
      }),
    getWorkspaceKey: () => args.workspaceState.workspaceKey,
    getLoginKey: () => args.runtimeState.loginKey,
    getCurrentUnitKey: () => args.runtimeState.currentUnitKey,
    createRuntimePresentationHost: args.createRuntimePresentationHost,
    refreshCrossViewStateAfterRuntimeChange:
      args.refreshCrossViewStateAfterRuntimeChange
  };
}

export function createRuntimeReadsStateHost(args: {
  request<T>(
    label: string,
    method: string,
    path: string,
    body?: unknown,
    options?: { quiet?: boolean }
  ): Promise<T>;
  isCurrentRunMissingError(error: unknown): boolean;
  workspaceState: ShellWorkspaceState;
  runtimeState: ShellRuntimeState;
  createRuntimePresentationHost(): RuntimePresentationHost;
}): ShellRuntimeReadsHost {
  return {
    request: args.request,
    isCurrentRunMissingError: args.isCurrentRunMissingError,
    getOpenRunsPath: () =>
      resolveRoutePath(productionApiRoutes.monitor.openRuns, {
        tenantKey: args.workspaceState.tenantKey.trim(),
        workspaceKey: args.workspaceState.workspaceKey.trim()
      }),
    getRuntimeStatePath: () =>
      resolveRoutePath(productionApiRoutes.participant.getRuntimeState, {
        participantSessionId: args.runtimeState.participantSessionId.trim()
      }),
    getParticipantSessionDetailPath: () =>
      resolveRoutePath(productionApiRoutes.workspace.getParticipantSession, {
        tenantKey: args.workspaceState.tenantKey.trim(),
        workspaceKey: args.workspaceState.workspaceKey.trim(),
        participantSessionId: args.runtimeState.participantSessionId.trim()
      }),
    getCurrentRunStatePath: () =>
      resolveRoutePath(productionApiRoutes.participant.getCurrentRunState, {
        participantSessionId: args.runtimeState.participantSessionId.trim()
      }),
    createRuntimePresentationHost: args.createRuntimePresentationHost
  };
}
