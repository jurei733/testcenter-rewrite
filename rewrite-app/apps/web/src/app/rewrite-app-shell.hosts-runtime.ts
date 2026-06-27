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
    getDeleteGroupResultsPath: () =>
      resolveRoutePath(productionApiRoutes.workspace.deleteGroupResults, {
        tenantKey: args.workspaceState.tenantKey.trim(),
        workspaceKey: args.workspaceState.workspaceKey.trim(),
        groupKey: args.runtimeState.groupKey.trim()
      }),
    getCreateReviewPath: () =>
      resolveRoutePath(productionApiRoutes.workspace.createReview, {
        tenantKey: args.workspaceState.tenantKey.trim(),
        workspaceKey: args.workspaceState.workspaceKey.trim()
      }),
    getUpdateReviewPath: () =>
      resolveRoutePath(productionApiRoutes.workspace.updateReview, {
        tenantKey: args.workspaceState.tenantKey.trim(),
        workspaceKey: args.workspaceState.workspaceKey.trim(),
        reviewId: args.runtimeState.reviewId.trim()
      }),
    getDeleteReviewPath: () =>
      resolveRoutePath(productionApiRoutes.workspace.deleteReview, {
        tenantKey: args.workspaceState.tenantKey.trim(),
        workspaceKey: args.workspaceState.workspaceKey.trim(),
        reviewId: args.runtimeState.reviewId.trim()
      }),
    getWorkspaceKey: () => args.workspaceState.workspaceKey,
    getLoginKey: () => args.runtimeState.loginKey,
    getGroupKey: () => args.runtimeState.groupKey,
    getParticipantSessionId: () => args.runtimeState.participantSessionId,
    getTestRunId: () => args.runtimeState.testRunId,
    getCurrentUnitKey: () => args.runtimeState.currentUnitKey,
    getCurrentUnitResponse: () => args.runtimeState.currentUnitResponse,
    getReviewerId: () => args.runtimeState.reviewerId,
    getReviewCategory: () => args.runtimeState.reviewCategory,
    getReviewComment: () => args.runtimeState.reviewComment,
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
    getResponseCsvExportPath: () =>
      resolveRoutePath(productionApiRoutes.workspace.exportResponseCsv, {
        tenantKey: args.workspaceState.tenantKey.trim(),
        workspaceKey: args.workspaceState.workspaceKey.trim()
      }),
    getReviewCsvExportPath: () =>
      resolveRoutePath(productionApiRoutes.workspace.exportReviewCsv, {
        tenantKey: args.workspaceState.tenantKey.trim(),
        workspaceKey: args.workspaceState.workspaceKey.trim()
      }),
    getDetailedResponsesPath: () =>
      resolveRoutePath(productionApiRoutes.workspace.listDetailedResponses, {
        tenantKey: args.workspaceState.tenantKey.trim(),
        workspaceKey: args.workspaceState.workspaceKey.trim()
      }),
    getReviewsPath: () =>
      resolveRoutePath(productionApiRoutes.workspace.listReviews, {
        tenantKey: args.workspaceState.tenantKey.trim(),
        workspaceKey: args.workspaceState.workspaceKey.trim()
      }),
    setDetailedResponsesView: nextValue => {
      args.runtimeState.detailedResponsesView = nextValue;
    },
    setReviewsView: nextValue => {
      args.runtimeState.reviewsView = nextValue;
    },
    setResponseExportView: nextValue => {
      args.runtimeState.responseExportView = nextValue;
    },
    setReviewExportView: nextValue => {
      args.runtimeState.reviewExportView = nextValue;
    },
    getCurrentRunStatePath: () =>
      resolveRoutePath(productionApiRoutes.participant.getCurrentRunState, {
        participantSessionId: args.runtimeState.participantSessionId.trim()
      }),
    createRuntimePresentationHost: args.createRuntimePresentationHost
  };
}
