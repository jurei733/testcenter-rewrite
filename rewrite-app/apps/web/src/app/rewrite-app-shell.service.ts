import { Injectable, inject } from "@angular/core";

import {
  type ActivateContentReleaseResponse,
  type CreateImportJobRequest,
  type CreateImportJobResponse,
  type CreateSourcePackageRequest,
  type CreateSourcePackageResponse,
  type GetContentReleaseActivationReadinessResponse,
  type GetContentReleaseResponse,
  type GetImportJobResponse,
  type GetParticipantSessionResponse,
  type GetRuntimeConfigResponse,
  type GetRuntimeDiagnosticsResponse,
  type GetSourcePackageResponse,
  type GetWorkspaceOverviewResponse,
  type ListContentReleasesResponse,
  type ListImportJobsResponse,
  type ListParticipantSessionsResponse,
  type ListSourcePackagesResponse,
  type ListWorkspaceActivityEventsResponse,
  type MonitorOpenRunsResponse,
  type ParticipantCurrentRunStateResponse,
  type ParticipantRuntimeStateResponse,
  type RetrySourcePackageImportRequest,
  type RetrySourcePackageImportResponse,
} from "@testcenter-rewrite-app/contracts";
import { RewriteAppApiService, type ApiErrorLike } from "./rewrite-app-api.service";
import { type AppView } from "./rewrite-app-shell.types";
import {
  runBlockedActivationFlow,
  runBootstrapWorkspaceFlow,
  runImportActivateFlow,
  runParticipantHappyPathFlow
} from "./rewrite-app-shell.workflows";
import {
  createBlockedActivationFlowHost,
  createBootstrapWorkspaceFlowHost,
  createImportActivateFlowHost,
  createParticipantHappyPathFlowHost
} from "./rewrite-app-shell.hosts";
import {
  applyActivationReadinessView,
  applyActivationSuccessView,
  applyBlockedActivationView
} from "./rewrite-app-shell.activation";
import {
  applyCompleteRunResult,
  loadParticipantSessionDetailAction,
  applyRuntimeReadsCurrentRunMissing,
  applyRuntimeReadsWithSession,
  applyRuntimeReadsWithoutSession,
} from "./rewrite-app-shell.runtime";
import {
  applyContentReads,
  applyWorkspaceOverviewRead
} from "./rewrite-app-shell.content";
import {
  createImportJobAction,
  createSourcePackageAction,
  retrySourcePackageImportAction
} from "./rewrite-app-shell.content-actions";
import {
  loadContentReleaseActivationReadinessAction,
  loadContentReleaseDetailAction,
  loadImportJobDetailAction,
  loadSourcePackageDetailAction
} from "./rewrite-app-shell.content-details";
import {
  refreshMetricsOnlyAction,
  refreshOperationalDiagnosticsAction
} from "./rewrite-app-shell.ops";
import {
  prettyPrintJson,
  readNumberValue
} from "./rewrite-app-shell.readers";
import {
  completeRunAction,
  participantSignInAction,
  resumeParticipantSessionAction,
  resumeRunAction,
  saveProgressAction
} from "./rewrite-app-shell.runtime-actions";
import { refreshRuntimeReadsAction } from "./rewrite-app-shell.runtime-reads";
import {
  createTenantAction,
  createWorkspaceAction
} from "./rewrite-app-shell.workspace-actions";
import {
  refreshContentReadsAction,
  refreshWorkspaceOverviewAction
} from "./rewrite-app-shell.content-reads";
import { activateContentReleaseAction } from "./rewrite-app-shell.activation-actions";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";
import { RewriteAppShellSupportService } from "./rewrite-app-shell-support.service";

@Injectable({ providedIn: "root" })
export class RewriteAppShellService {
  private readonly api = inject(RewriteAppApiService);
  private readonly uiState = inject(RewriteAppUiStateService);
  private readonly support = inject(RewriteAppShellSupportService);
  readonly renderVersion = this.uiState.renderVersion;
  readonly feedback = this.uiState.feedback;
  readonly workspace = this.uiState.workspace;
  readonly content = this.uiState.content;
  readonly ops = this.uiState.ops;
  readonly runtime = this.uiState.runtime;
  readonly responseMeta = this.uiState.responseMeta;
  readonly lastResponse = this.uiState.lastResponse;
  readonly activeRequestLabel = this.uiState.activeRequestLabel;
  readonly errorMessage = this.uiState.errorMessage;

  private readonly workspaceState = this.uiState.workspace;
  private readonly contentState = this.uiState.content;
  private readonly opsState = this.uiState.ops;
  private readonly runtimeState = this.uiState.runtime;
  private readonly feedbackState = this.uiState.feedback;

  get activeView(): AppView {
    return this.uiState.activeView;
  }

  private set activeView(nextValue: AppView) {
    this.uiState.activeView = nextValue;
  }

  private get autoRefreshHandle(): number | null {
    return this.uiState.autoRefreshHandle;
  }

  private set autoRefreshHandle(nextValue: number | null) {
    this.uiState.autoRefreshHandle = nextValue;
  }

  private get foregroundRequestDepth(): number {
    return this.uiState.foregroundRequestDepth;
  }

  private set foregroundRequestDepth(nextValue: number) {
    this.uiState.foregroundRequestDepth = nextValue;
  }

  init(): void {
    this.support.hydrateShellState();
    this.support.scheduleAutoRefresh(
      quiet => this.refreshWorkspaceOverview(quiet),
      quiet => this.refreshContentReads(quiet),
      quiet => this.refreshRuntimeReads(quiet),
      quiet => this.refreshOperationalDiagnostics(quiet)
    );
    void this.refreshOperationalDiagnostics(true);
  }

  destroy(): void {
    this.support.clearAutoRefresh(
      quiet => this.refreshWorkspaceOverview(quiet),
      quiet => this.refreshContentReads(quiet),
      quiet => this.refreshRuntimeReads(quiet),
      quiet => this.refreshOperationalDiagnostics(quiet)
    );
  }

  setActiveView(view: AppView): void {
    if (this.activeView === view) {
      void this.support.ensureDataForView(
        view,
        quiet => this.refreshWorkspaceOverview(quiet),
        quiet => this.refreshContentReads(quiet),
        quiet => this.refreshRuntimeReads(quiet),
        quiet => this.refreshOperationalDiagnostics(quiet)
      );
      return;
    }
    this.activeView = view;
    this.persistShellState();
    void this.support.ensureDataForView(
      view,
      quiet => this.refreshWorkspaceOverview(quiet),
      quiet => this.refreshContentReads(quiet),
      quiet => this.refreshRuntimeReads(quiet),
      quiet => this.refreshOperationalDiagnostics(quiet)
    );
  }

  onAutoRefreshSettingsChanged(): void {
    this.workspaceState.autoRefreshSeconds = Math.max(
      3,
      Number(this.workspaceState.autoRefreshSeconds) || 8
    );
    this.persistShellState();
    this.support.scheduleAutoRefresh(
      quiet => this.refreshWorkspaceOverview(quiet),
      quiet => this.refreshContentReads(quiet),
      quiet => this.refreshRuntimeReads(quiet),
      quiet => this.refreshOperationalDiagnostics(quiet)
    );
  }

  onActionAsync(action: () => Promise<unknown>): void {
    void action().catch(() => undefined);
  }

  persistShellState(): void {
    this.support.persistShellState();
  }

  getPersistedView(): AppView {
    return this.activeView;
  }

  async createTenant(): Promise<void> {
    await createTenantAction(this.support.createWorkspaceActionsHost());
  }

  async createWorkspace(): Promise<void> {
    await createWorkspaceAction(this.support.createWorkspaceActionsHost());
  }

  async createSourcePackage(): Promise<void> {
    await createSourcePackageAction(
      this.support.createContentActionsHost(
        quiet => this.refreshContentReads(quiet),
        () => this.loadSourcePackageDetail(),
        () => this.loadImportJobDetail(),
        () => this.loadContentReleaseDetail(),
        () => this.loadContentReleaseActivationReadiness()
      )
    );
  }

  async createImportJob(): Promise<void> {
    await createImportJobAction(
      this.support.createContentActionsHost(
        quiet => this.refreshContentReads(quiet),
        () => this.loadSourcePackageDetail(),
        () => this.loadImportJobDetail(),
        () => this.loadContentReleaseDetail(),
        () => this.loadContentReleaseActivationReadiness()
      )
    );
  }

  async activateContentRelease(): Promise<void> {
    await activateContentReleaseAction(
      this.support.createActivationActionsHost(
        () => this.refreshContentReads(),
        () => this.loadContentReleaseActivationReadiness(),
        () => this.loadContentReleaseDetail()
      )
    );
  }

  async participantSignIn(): Promise<void> {
    await participantSignInAction(
      this.support.createRuntimeActionsHost(() =>
        this.refreshCrossViewStateAfterRuntimeChange()
      )
    );
  }

  async resumeParticipantSession(): Promise<void> {
    await resumeParticipantSessionAction(
      this.support.createRuntimeActionsHost(() =>
        this.refreshCrossViewStateAfterRuntimeChange()
      )
    );
  }

  async saveProgress(status: "paused" | "running"): Promise<void> {
    await saveProgressAction(
      this.support.createRuntimeActionsHost(() =>
        this.refreshCrossViewStateAfterRuntimeChange()
      ),
      status
    );
  }

  async resumeRun(): Promise<void> {
    await resumeRunAction(
      this.support.createRuntimeActionsHost(() =>
        this.refreshCrossViewStateAfterRuntimeChange()
      )
    );
  }

  async completeRun(): Promise<void> {
    await completeRunAction(
      this.support.createRuntimeActionsHost(() =>
        this.refreshCrossViewStateAfterRuntimeChange()
      )
    );
  }

  async refreshWorkspaceOverview(quiet = false): Promise<void> {
    await refreshWorkspaceOverviewAction(this.support.createContentReadsHost(), quiet);
  }

  async refreshContentReads(quiet = false): Promise<void> {
    await refreshContentReadsAction(this.support.createContentReadsHost(), quiet);
  }

  async refreshRuntimeReads(quiet = false): Promise<void> {
    await refreshRuntimeReadsAction(
      this.support.createRuntimeReadsHost(),
      this.runtimeState.participantSessionId,
      quiet
    );
  }

  async refreshOperationalDiagnostics(quiet = false): Promise<void> {
    await refreshOperationalDiagnosticsAction(this.support.createShellOpsHost(), quiet);
  }

  async refreshMetricsOnly(): Promise<void> {
    await refreshMetricsOnlyAction(this.support.createShellOpsHost());
  }

  async loadSourcePackageDetail(): Promise<GetSourcePackageResponse> {
    return loadSourcePackageDetailAction(this.support.createContentDetailsHost());
  }

  async loadImportJobDetail(): Promise<GetImportJobResponse> {
    return loadImportJobDetailAction(this.support.createContentDetailsHost());
  }

  async loadParticipantSessionDetail(): Promise<GetParticipantSessionResponse> {
    return loadParticipantSessionDetailAction(this.support.createRuntimePresentationHost());
  }

  async loadContentReleaseActivationReadiness(): Promise<GetContentReleaseActivationReadinessResponse> {
    return loadContentReleaseActivationReadinessAction(this.support.createContentDetailsHost());
  }

  async loadContentReleaseDetail(): Promise<GetContentReleaseResponse> {
    return loadContentReleaseDetailAction(this.support.createContentDetailsHost());
  }

  async retrySourcePackageImport(): Promise<void> {
    await retrySourcePackageImportAction(
      this.support.createContentActionsHost(
        quiet => this.refreshContentReads(quiet),
        () => this.loadSourcePackageDetail(),
        () => this.loadImportJobDetail(),
        () => this.loadContentReleaseDetail(),
        () => this.loadContentReleaseActivationReadiness()
      )
    );
  }

  async bootstrapWorkspaceFlow(): Promise<void> {
    await runBootstrapWorkspaceFlow(createBootstrapWorkspaceFlowHost({
      createTenant: () => this.createTenant(),
      createWorkspace: () => this.createWorkspace(),
      refreshWorkspaceOverview: () => this.refreshWorkspaceOverview(),
      rememberActivity: (title: string, detail: string) =>
        this.support.rememberActivity(title, detail),
      tenantKey: this.workspaceState.tenantKey,
      workspaceKey: this.workspaceState.workspaceKey,
      allowConflict: <T>(
        operation: () => Promise<T>,
        allowedErrorCodes: string[]
      ) =>
        this.support.allowConflict(operation, allowedErrorCodes)
    }));
  }

  async importActivateFlow(): Promise<void> {
    await runImportActivateFlow(createImportActivateFlowHost({
      createSourcePackage: () => this.createSourcePackage(),
      createImportJob: () => this.createImportJob(),
      activateContentRelease: () => this.activateContentRelease(),
      rememberActivity: (title: string, detail: string) =>
        this.support.rememberActivity(title, detail),
      getContentReleaseId: () => this.support.getContentReleaseId()
    }));
  }

  async blockedActivationFlow(): Promise<void> {
    await runBlockedActivationFlow(createBlockedActivationFlowHost({
      createSourcePackage: () => this.createSourcePackage(),
      createImportJob: () => this.createImportJob(),
      loadContentReleaseActivationReadiness: () =>
        this.loadContentReleaseActivationReadiness(),
      activateContentRelease: () => this.activateContentRelease(),
      rememberActivity: (title: string, detail: string) =>
        this.support.rememberActivity(title, detail),
      getContentReleaseId: () => this.support.getContentReleaseId(),
      isBlockedActivationError: (error: unknown) =>
        this.api.isApiError(error) &&
        error.error === "active_content_release_has_open_runs",
      onBlockedActivation: () => {
        this.support.clearForegroundBusyState();
        this.errorMessage.set(null);
        this.responseMeta.set("Activation Guard · blocked");
      }
    }));
  }

  async participantHappyPathFlow(): Promise<void> {
    await runParticipantHappyPathFlow(createParticipantHappyPathFlowHost({
      participantSignIn: () => this.participantSignIn(),
      resumeParticipantSession: () => this.resumeParticipantSession(),
      refreshRuntimeReads: () => this.refreshRuntimeReads(),
      rememberActivity: (title: string, detail: string) =>
        this.support.rememberActivity(title, detail),
      getParticipantSessionId: () => this.support.getParticipantSessionId()
    }));
  }

  private async refreshCrossViewStateAfterRuntimeChange(): Promise<void> {
    await Promise.all([
      this.refreshWorkspaceOverview(true),
      this.refreshContentReads(true),
      this.refreshRuntimeReads(true)
    ]);
  }
}
