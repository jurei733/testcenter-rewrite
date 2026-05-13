import { Injectable, inject } from "@angular/core";

import {
  type GetContentReleaseActivationReadinessResponse,
  type GetContentReleaseResponse,
  type GetImportJobResponse,
  type GetSourcePackageResponse
} from "@testcenter-rewrite-app/contracts";
import { RewriteAppShellFeedbackService } from "./rewrite-app-shell-feedback.service";
import { RewriteAppShellActivationGuardService } from "./rewrite-app-shell-activation-guard.service";
import {
  createActivationActionsStateHost,
  createContentActionsStateHost,
  createContentDetailsStateHost,
  createContentReadsStateHost
} from "./rewrite-app-shell.hosts";
import { RewriteAppShellPersistenceService } from "./rewrite-app-shell-persistence.service";
import { RewriteAppShellWorkspaceContentPresentationService } from "./rewrite-app-shell-workspace-content-presentation.service";
import { RewriteAppShellRequestService } from "./rewrite-app-shell-request.service";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";

@Injectable({ providedIn: "root" })
export class RewriteAppShellContentHostsService {
  private readonly feedback = inject(RewriteAppShellFeedbackService);
  private readonly persistence = inject(RewriteAppShellPersistenceService);
  private readonly activationGuard = inject(RewriteAppShellActivationGuardService);
  private readonly presentationHosts = inject(RewriteAppShellWorkspaceContentPresentationService);
  private readonly requestState = inject(RewriteAppShellRequestService);
  private readonly uiState = inject(RewriteAppUiStateService);

  private readonly workspaceState = this.uiState.workspace;
  private readonly contentState = this.uiState.content;

  createContentReadsHost() {
    return createContentReadsStateHost({
      request: <T>(
        label: string,
        method: string,
        path: string,
        body?: unknown,
        options: { quiet?: boolean } = {}
      ) => this.requestState.request<T>(label, method, path, body, options),
      workspaceState: this.workspaceState,
      createWorkspaceContentPresentationHost: () =>
        this.presentationHosts.createWorkspaceContentPresentationHost()
    });
  }

  createActivationActionsHost(
    refreshContentReads: () => Promise<void>,
    loadContentReleaseActivationReadiness: () => Promise<unknown>,
    loadContentReleaseDetail: () => Promise<unknown>
  ) {
    return createActivationActionsStateHost({
      request: <T>(label: string, method: string, path: string, body?: unknown) =>
        this.requestState.request<T>(label, method, path, body),
      isBlockedActivationError: (error: unknown) =>
        this.requestState.isApiError(error) &&
        error.error === "active_content_release_has_open_runs",
      workspaceState: this.workspaceState,
      contentState: this.contentState,
      createActivationGuardHost: () => this.activationGuard.createStateActivationGuardHost(),
      rememberActivity: (title, detail) => this.feedback.rememberActivity(title, detail),
      refreshContentReads,
      loadContentReleaseActivationReadiness,
      loadContentReleaseDetail
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
      ) => this.requestState.request<T>(label, method, path, body, options),
      workspaceState: this.workspaceState,
      contentState: this.contentState,
      persistShellState: () => this.persistence.persistShellState(),
      rememberActivity: (title, detail) => this.feedback.rememberActivity(title, detail),
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
      ) => this.requestState.request<T>(label, method, path, body, options),
      workspaceState: this.workspaceState,
      contentState: this.contentState,
      persistShellState: () => this.persistence.persistShellState(),
      rememberActivity: (title, detail) => this.feedback.rememberActivity(title, detail),
      applyActivationReadiness: (
        payload: GetContentReleaseActivationReadinessResponse
      ) => {
        this.activationGuard.applyActivationReadiness(payload);
      }
    });
  }
}
