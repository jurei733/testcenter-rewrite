import { ApplicationRef, Injectable, inject } from "@angular/core";

import {
  type GetContentReleaseActivationReadinessResponse,
  type GetContentReleaseResponse,
  type GetImportJobResponse,
  type GetSourcePackageResponse
} from "@testcenter-rewrite-app/contracts";
import { RewriteAppApiService, type ApiErrorLike } from "./rewrite-app-api.service";
import {
  rememberShellActivityInState,
  updateShellSummaryCardInState
} from "./rewrite-app-shell.feedback";
import {
  createActivationActionsStateHost,
  createContentActionsStateHost,
  createContentDetailsStateHost,
  createContentReadsStateHost,
  createActivationGuardStateHost,
  createRuntimePresentationStateHost,
  createRuntimeActionsStateHost,
  createRuntimeReadsStateHost,
  createShellOpsStateHost,
  createWorkspaceActionsStateHost,
  createWorkspaceContentPresentationStateHost
} from "./rewrite-app-shell.hosts";
import {
  clearShellAutoRefresh,
  ensureShellDataForView,
  scheduleShellAutoRefresh
} from "./rewrite-app-shell.lifecycle";
import { applyActivationReadinessView } from "./rewrite-app-shell.activation";
import {
  applyForegroundShellError,
  applyForegroundShellResponse,
  beginForegroundShellRequest,
  finishForegroundShellRequest
} from "./rewrite-app-shell.request-state";
import {
  createShellLifecycleStateHost,
  createShellPersistenceStateHost,
  createShellRequestStateHost
} from "./rewrite-app-shell.state-hosts";
import {
  applyHydratedShellState,
  createPersistedShellState
} from "./rewrite-app-shell.storage";
import { type AppView, type PersistedShellState, SHELL_STORAGE_KEY } from "./rewrite-app-shell.types";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";

@Injectable({ providedIn: "root" })
export class RewriteAppShellSupportService {
  private readonly api = inject(RewriteAppApiService);
  private readonly uiState = inject(RewriteAppUiStateService);
  private readonly applicationRef = inject(ApplicationRef);

  private readonly workspaceState = this.uiState.workspace;
  private readonly contentState = this.uiState.content;
  private readonly opsState = this.uiState.ops;
  private readonly runtimeState = this.uiState.runtime;
  private readonly feedbackState = this.uiState.feedback;

  scheduleAutoRefresh(
    refreshWorkspaceOverview: (quiet?: boolean) => Promise<void>,
    refreshContentReads: (quiet?: boolean) => Promise<void>,
    refreshRuntimeReads: (quiet?: boolean) => Promise<void>,
    refreshOperationalDiagnostics: (quiet?: boolean) => Promise<void>
  ): void {
    scheduleShellAutoRefresh(
      this.createLifecycleHost(
        refreshWorkspaceOverview,
        refreshContentReads,
        refreshRuntimeReads,
        refreshOperationalDiagnostics
      )
    );
  }

  clearAutoRefresh(
    refreshWorkspaceOverview: (quiet?: boolean) => Promise<void>,
    refreshContentReads: (quiet?: boolean) => Promise<void>,
    refreshRuntimeReads: (quiet?: boolean) => Promise<void>,
    refreshOperationalDiagnostics: (quiet?: boolean) => Promise<void>
  ): void {
    clearShellAutoRefresh(
      this.createLifecycleHost(
        refreshWorkspaceOverview,
        refreshContentReads,
        refreshRuntimeReads,
        refreshOperationalDiagnostics
      )
    );
  }

  ensureDataForView(
    view: AppView,
    refreshWorkspaceOverview: (quiet?: boolean) => Promise<void>,
    refreshContentReads: (quiet?: boolean) => Promise<void>,
    refreshRuntimeReads: (quiet?: boolean) => Promise<void>,
    refreshOperationalDiagnostics: (quiet?: boolean) => Promise<void>
  ): Promise<void> {
    return ensureShellDataForView(
      this.createLifecycleHost(
        refreshWorkspaceOverview,
        refreshContentReads,
        refreshRuntimeReads,
        refreshOperationalDiagnostics
      ),
      view
    );
  }

  persistShellState(): void {
    window.localStorage.setItem(
      SHELL_STORAGE_KEY,
      JSON.stringify(createPersistedShellState(this.createPersistenceStateHost()))
    );
  }

  hydrateShellState(): void {
    const rawValue = window.localStorage.getItem(SHELL_STORAGE_KEY);
    if (!rawValue) {
      return;
    }

    try {
      applyHydratedShellState(
        this.createPersistenceStateHost(),
        JSON.parse(rawValue) as Partial<PersistedShellState>
      );
    } catch {
      // Ignore broken browser state and keep defaults.
    }
  }

  createWorkspaceActionsHost() {
    return createWorkspaceActionsStateHost({
      request: <T>(label: string, method: string, path: string, body?: unknown) =>
        this.request<T>(label, method, path, body),
      workspaceState: this.workspaceState,
      rememberActivity: (title, detail) => this.rememberActivity(title, detail)
    });
  }

  createContentReadsHost() {
    return createContentReadsStateHost({
      request: <T>(
        label: string,
        method: string,
        path: string,
        body?: unknown,
        options: { quiet?: boolean } = {}
      ) => this.request<T>(label, method, path, body, options),
      workspaceState: this.workspaceState,
      createWorkspaceContentPresentationHost: () =>
        this.createWorkspaceContentPresentationHost()
    });
  }

  createActivationActionsHost(
    refreshContentReads: () => Promise<void>,
    loadContentReleaseActivationReadiness: () => Promise<unknown>,
    loadContentReleaseDetail: () => Promise<unknown>
  ) {
    return createActivationActionsStateHost({
      request: <T>(label: string, method: string, path: string, body?: unknown) =>
        this.request<T>(label, method, path, body),
      isBlockedActivationError: (error: unknown) =>
        this.api.isApiError(error) &&
        error.error === "active_content_release_has_open_runs",
      workspaceState: this.workspaceState,
      contentState: this.contentState,
      createActivationGuardHost: () => this.createStateActivationGuardHost(),
      rememberActivity: (title, detail) => this.rememberActivity(title, detail),
      refreshContentReads,
      loadContentReleaseActivationReadiness,
      loadContentReleaseDetail
    });
  }

  createRuntimePresentationHost() {
    return createRuntimePresentationStateHost({
      request: <T>(
        label: string,
        method: string,
        path: string,
        body?: unknown,
        options: { quiet?: boolean } = {}
      ) => this.request<T>(label, method, path, body, options),
      workspaceState: this.workspaceState,
      runtimeState: this.runtimeState,
      persistShellState: () => this.persistShellState(),
      updateRuntimeSummary: (headline, detail) =>
        this.updateRuntimeSummary(headline, detail),
      updateMonitorSummary: (headline, detail) =>
        this.updateMonitorSummary(headline, detail),
      rememberActivity: (title, detail) => this.rememberActivity(title, detail)
    });
  }

  createRuntimeActionsHost(refreshCrossViewStateAfterRuntimeChange: () => Promise<void>) {
    return createRuntimeActionsStateHost({
      request: <T>(label: string, method: string, path: string, body?: unknown) =>
        this.request<T>(label, method, path, body),
      workspaceState: this.workspaceState,
      runtimeState: this.runtimeState,
      createRuntimePresentationHost: () => this.createRuntimePresentationHost(),
      refreshCrossViewStateAfterRuntimeChange
    });
  }

  createRuntimeReadsHost() {
    return createRuntimeReadsStateHost({
      request: <T>(
        label: string,
        method: string,
        path: string,
        body?: unknown,
        options: { quiet?: boolean } = {}
      ) => this.request<T>(label, method, path, body, options),
      isCurrentRunMissingError: (error: unknown) =>
        this.api.isApiError(error) &&
        error.error === "participant_session_has_no_current_run",
      workspaceState: this.workspaceState,
      runtimeState: this.runtimeState,
      createRuntimePresentationHost: () => this.createRuntimePresentationHost()
    });
  }

  createContentActionsHost(
    refreshContentReads: (quiet?: boolean) => Promise<void>,
    loadSourcePackageDetail: () => Promise<GetSourcePackageResponse>,
    loadImportJobDetail: () => Promise<GetImportJobResponse>,
    loadContentReleaseDetail: () => Promise<GetContentReleaseResponse>,
    loadContentReleaseActivationReadiness: () => Promise<GetContentReleaseActivationReadinessResponse>
  ) {
    return createContentActionsStateHost({
      request: <T>(
        label: string,
        method: string,
        path: string,
        body?: unknown,
        options: { quiet?: boolean } = {}
      ) => this.request<T>(label, method, path, body, options),
      workspaceState: this.workspaceState,
      contentState: this.contentState,
      persistShellState: () => this.persistShellState(),
      rememberActivity: (title, detail) => this.rememberActivity(title, detail),
      refreshContentReads,
      loadSourcePackageDetail,
      loadImportJobDetail,
      loadContentReleaseDetail,
      loadContentReleaseActivationReadiness
    });
  }

  createContentDetailsHost() {
    return createContentDetailsStateHost({
      request: <T>(
        label: string,
        method: string,
        path: string,
        body?: unknown,
        options: { quiet?: boolean } = {}
      ) => this.request<T>(label, method, path, body, options),
      workspaceState: this.workspaceState,
      contentState: this.contentState,
      persistShellState: () => this.persistShellState(),
      rememberActivity: (title, detail) => this.rememberActivity(title, detail),
      applyActivationReadiness: (
        payload: GetContentReleaseActivationReadinessResponse
      ) => {
        this.applyActivationReadiness(payload);
      }
    });
  }

  createShellOpsHost() {
    return createShellOpsStateHost({
      requestJson: <T = Record<string, unknown>>(
        label: string,
        path: string,
        quiet = false
      ) => this.requestJson<T>(label, path, quiet),
      opsState: this.opsState,
      rememberActivity: (title, detail) => this.rememberActivity(title, detail)
    });
  }

  requestJson<T = Record<string, unknown>>(
    label: string,
    path: string,
    quiet = false
  ): Promise<T> {
    return this.request<T>(label, "GET", path, undefined, { quiet });
  }

  async request<T>(
    label: string,
    method: string,
    path: string,
    body?: unknown,
    options: { quiet?: boolean } = {}
  ): Promise<T> {
    if (!options.quiet) {
      beginForegroundShellRequest(this.createRequestStateHost(), label);
    }

    try {
      const { statusCode, payload } = await this.api.send<T>(method, path, body);
      if (!options.quiet) {
        applyForegroundShellResponse(
          this.createRequestStateHost(),
          label,
          statusCode,
          payload
        );
      }
      return payload;
    } catch (error) {
      if (!options.quiet) {
        const apiError = this.api.isApiError(error)
          ? error
          : ({
              error: "unexpected_error",
              message: error instanceof Error ? error.message : String(error)
            } satisfies ApiErrorLike);
        applyForegroundShellError(this.createRequestStateHost(), label, apiError);
      }
      throw error;
    } finally {
      if (!options.quiet) {
        finishForegroundShellRequest(this.createRequestStateHost());
      }
    }
  }

  clearForegroundBusyState(): void {
    this.uiState.foregroundRequestDepth = 0;
    this.uiState.activeRequestLabel.set(null);
  }

  async allowConflict<T>(
    operation: () => Promise<T>,
    allowedErrorCodes: string[]
  ): Promise<T | undefined> {
    try {
      return await operation();
    } catch (error) {
      if (this.api.isApiError(error) && allowedErrorCodes.includes(error.error)) {
        this.rememberActivity(
          "Guided Flow",
          `${error.message} Continuing with the existing resource.`
        );
        return undefined;
      }
      throw error;
    }
  }

  rememberActivity(title: string, detail: string): void {
    rememberShellActivityInState(this.feedbackState, title, detail);
  }

  getContentReleaseId(): string {
    return this.contentState.contentReleaseId.trim();
  }

  getParticipantSessionId(): string {
    return this.runtimeState.participantSessionId.trim();
  }

  private applyActivationReadiness(
    payload: GetContentReleaseActivationReadinessResponse
  ): void {
    applyActivationReadinessView(this.createStateActivationGuardHost(), payload);
  }

  private createLifecycleHost(
    refreshWorkspaceOverview: (quiet?: boolean) => Promise<void>,
    refreshContentReads: (quiet?: boolean) => Promise<void>,
    refreshRuntimeReads: (quiet?: boolean) => Promise<void>,
    refreshOperationalDiagnostics: (quiet?: boolean) => Promise<void>
  ) {
    return createShellLifecycleStateHost({
      workspaceState: this.workspaceState,
      contentState: this.contentState,
      runtimeState: this.runtimeState,
      opsState: this.opsState,
      getActiveView: () => this.uiState.activeView,
      setActiveView: nextValue => {
        this.uiState.activeView = nextValue;
      },
      getAutoRefreshHandle: () => this.uiState.autoRefreshHandle,
      setAutoRefreshHandle: nextValue => {
        this.uiState.autoRefreshHandle = nextValue;
      },
      refreshWorkspaceOverview,
      refreshContentReads,
      refreshRuntimeReads,
      refreshOperationalDiagnostics
    });
  }

  private createPersistenceStateHost() {
    return createShellPersistenceStateHost({
      workspaceState: this.workspaceState,
      contentState: this.contentState,
      runtimeState: this.runtimeState,
      getActiveView: () => this.uiState.activeView,
      setActiveView: nextValue => {
        this.uiState.activeView = nextValue;
      }
    });
  }

  private createRequestStateHost() {
    return createShellRequestStateHost({
      getForegroundRequestDepth: () => this.uiState.foregroundRequestDepth,
      setForegroundRequestDepth: nextValue => {
        this.uiState.foregroundRequestDepth = nextValue;
      },
      activeRequestLabel: this.uiState.activeRequestLabel,
      errorMessage: this.uiState.errorMessage,
      responseMeta: this.uiState.responseMeta,
      lastResponse: this.uiState.lastResponse,
      renderVersion: this.uiState.renderVersion,
      applicationRef: this.applicationRef
    });
  }

  private createWorkspaceContentPresentationHost() {
    return createWorkspaceContentPresentationStateHost({
      workspaceState: this.workspaceState,
      contentState: this.contentState,
      runtimeState: this.runtimeState,
      persistShellState: () => this.persistShellState(),
      updateWorkspaceSummary: (headline, detail) =>
        this.updateWorkspaceSummary(headline, detail),
      updateContentSummary: (headline, detail) =>
        this.updateContentSummary(headline, detail),
      rememberActivity: (title, detail) => this.rememberActivity(title, detail)
    });
  }

  private createStateActivationGuardHost() {
    return createActivationGuardStateHost({
      contentState: this.contentState,
      runtimeState: this.runtimeState,
      updateMonitorSummary: (headline, detail) =>
        this.updateMonitorSummary(headline, detail),
      rememberActivity: (title, detail) => this.rememberActivity(title, detail)
    });
  }

  private updateWorkspaceSummary(headline: string, detail: string): void {
    updateShellSummaryCardInState(this.feedbackState, "Workspace", headline, detail);
  }

  private updateContentSummary(headline: string, detail: string): void {
    updateShellSummaryCardInState(this.feedbackState, "Content", headline, detail);
  }

  private updateRuntimeSummary(headline: string, detail: string): void {
    updateShellSummaryCardInState(this.feedbackState, "Runtime", headline, detail);
  }

  private updateMonitorSummary(headline: string, detail: string): void {
    updateShellSummaryCardInState(this.feedbackState, "Monitor", headline, detail);
  }
}
