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
    getImportParticipantRosterPath: () =>
      resolveRoutePath(productionApiRoutes.workspace.importParticipantRoster, {
        tenantKey: args.workspaceState.tenantKey.trim(),
        workspaceKey: args.workspaceState.workspaceKey.trim()
      }),
    getTenantKey: () => args.workspaceState.tenantKey,
    getWorkspaceKey: () => args.workspaceState.workspaceKey,
    getEntryRosterText: () => args.runtimeState.entryRosterText,
    setParticipantRosterView: nextValue => {
      args.runtimeState.participantRosterView = nextValue;
    },
    getLoginKey: () => args.runtimeState.loginKey,
    getGroupKey: () => args.runtimeState.groupKey,
    getBookletKey: () => args.runtimeState.bookletKey,
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
  const readQueryValue = (value: unknown): string =>
    typeof value === "string" ? value.trim() : String(value ?? "").trim();

  const appendQueryValue = (
    query: URLSearchParams,
    key: string,
    value: unknown
  ): void => {
    const queryValue = readQueryValue(value);
    if (queryValue) {
      query.set(key, queryValue);
    }
  };

  const withQuery = (path: string, query: URLSearchParams): string => {
    const queryString = query.toString();
    return queryString ? `${path}?${queryString}` : path;
  };

  const buildParticipantSessionsPath = (): string => {
    const path = resolveRoutePath(productionApiRoutes.workspace.listParticipantSessions, {
      tenantKey: args.workspaceState.tenantKey.trim(),
      workspaceKey: args.workspaceState.workspaceKey.trim()
    });
    const query = new URLSearchParams();
    appendQueryValue(query, "status", args.runtimeState.participantSessionStatusFilter);
    appendQueryValue(query, "groupKey", args.runtimeState.participantSessionGroupFilter);
    appendQueryValue(query, "loginKey", args.runtimeState.participantSessionLoginFilter);
    appendQueryValue(
      query,
      "contentReleaseId",
      args.runtimeState.participantSessionReleaseFilter
    );
    appendQueryValue(query, "limit", args.runtimeState.participantSessionLimit);

    return withQuery(path, query);
  };

  const buildParticipantRosterPath = (): string =>
    resolveRoutePath(productionApiRoutes.workspace.listParticipantRoster, {
      tenantKey: args.workspaceState.tenantKey.trim(),
      workspaceKey: args.workspaceState.workspaceKey.trim()
    });
  const buildParticipantRosterCsvExportPath = (): string =>
    resolveRoutePath(productionApiRoutes.workspace.exportParticipantRosterCsv, {
      tenantKey: args.workspaceState.tenantKey.trim(),
      workspaceKey: args.workspaceState.workspaceKey.trim()
    });

  const buildDetailedResponsesPath = (route: string): string => {
    const path = resolveRoutePath(route, {
      tenantKey: args.workspaceState.tenantKey.trim(),
      workspaceKey: args.workspaceState.workspaceKey.trim()
    });
    const query = new URLSearchParams();
    appendQueryValue(query, "loginKey", args.runtimeState.detailedResponseLoginFilter);
    appendQueryValue(query, "groupKey", args.runtimeState.detailedResponseGroupFilter);
    appendQueryValue(
      query,
      "participantSessionId",
      args.runtimeState.detailedResponseSessionFilter
    );
    appendQueryValue(query, "testRunId", args.runtimeState.detailedResponseRunFilter);
    appendQueryValue(query, "unitKey", args.runtimeState.detailedResponseUnitFilter);
    appendQueryValue(query, "status", args.runtimeState.detailedResponseStatusFilter);
    appendQueryValue(query, "limit", args.runtimeState.detailedResponseLimit);

    return withQuery(path, query);
  };

  const buildReviewsPath = (route: string): string => {
    const path = resolveRoutePath(route, {
      tenantKey: args.workspaceState.tenantKey.trim(),
      workspaceKey: args.workspaceState.workspaceKey.trim()
    });
    const query = new URLSearchParams();
    appendQueryValue(query, "loginKey", args.runtimeState.reviewLoginFilter);
    appendQueryValue(query, "groupKey", args.runtimeState.reviewGroupFilter);
    appendQueryValue(
      query,
      "participantSessionId",
      args.runtimeState.reviewSessionFilter
    );
    appendQueryValue(query, "testRunId", args.runtimeState.reviewRunFilter);
    appendQueryValue(query, "unitKey", args.runtimeState.reviewUnitFilter);
    appendQueryValue(query, "reviewerId", args.runtimeState.reviewReviewerFilter);
    appendQueryValue(query, "category", args.runtimeState.reviewCategoryFilter);
    appendQueryValue(query, "limit", args.runtimeState.reviewLimit);

    return withQuery(path, query);
  };

  return {
    request: args.request,
    isCurrentRunMissingError: args.isCurrentRunMissingError,
    getOpenRunsPath: () =>
      resolveRoutePath(productionApiRoutes.monitor.openRuns, {
        tenantKey: args.workspaceState.tenantKey.trim(),
        workspaceKey: args.workspaceState.workspaceKey.trim()
      }),
    getParticipantSessionsPath: buildParticipantSessionsPath,
    setParticipantSessionsView: nextValue => {
      args.runtimeState.participantSessionsView = nextValue;
    },
    getParticipantRosterPath: buildParticipantRosterPath,
    setParticipantRosterView: nextValue => {
      args.runtimeState.participantRosterView = nextValue;
    },
    getParticipantRosterCsvExportPath: buildParticipantRosterCsvExportPath,
    setParticipantRosterExportView: nextValue => {
      args.runtimeState.participantRosterExportView = nextValue;
    },
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
      buildDetailedResponsesPath(productionApiRoutes.workspace.exportResponseCsv),
    getReviewCsvExportPath: () =>
      buildReviewsPath(productionApiRoutes.workspace.exportReviewCsv),
    getDetailedResponsesPath: () =>
      buildDetailedResponsesPath(productionApiRoutes.workspace.listDetailedResponses),
    getReviewsPath: () => buildReviewsPath(productionApiRoutes.workspace.listReviews),
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
