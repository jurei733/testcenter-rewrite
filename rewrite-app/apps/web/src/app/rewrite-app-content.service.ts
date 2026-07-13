import { Injectable, inject } from "@angular/core";

import {
  type GetContentReleaseActivationReadinessResponse,
  type GetContentReleaseResponse,
  type GetImportJobResponse,
  type GetSourcePackageResponse
} from "@testcenter-rewrite-app/contracts";
import { RewriteAppApiService } from "./rewrite-app-api.service";
import { RewriteAppShellFeedbackService } from "./rewrite-app-shell-feedback.service";
import { activateContentReleaseAction } from "./rewrite-app-shell.activation-actions";
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
import { refreshContentReadsAction } from "./rewrite-app-shell.content-reads";
import {
  createBlockedActivationFlowHost,
  createImportActivateFlowHost
} from "./rewrite-app-shell.hosts";
import {
  runBlockedActivationFlow,
  runImportActivateFlow
} from "./rewrite-app-shell.workflows";
import { RewriteAppShellRequestService } from "./rewrite-app-shell-request.service";
import { RewriteAppShellContentHostsService } from "./rewrite-app-shell-content-hosts.service";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";

@Injectable({ providedIn: "root" })
export class RewriteAppContentService {
  private readonly api = inject(RewriteAppApiService);
  private readonly feedback = inject(RewriteAppShellFeedbackService);
  private readonly hosts = inject(RewriteAppShellContentHostsService);
  private readonly requestState = inject(RewriteAppShellRequestService);
  private readonly uiState = inject(RewriteAppUiStateService);

  private readonly contentState = this.uiState.content;

  async createSourcePackage(): Promise<void> {
    await createSourcePackageAction(this.createActionsHost());
  }

  async createImportJob(): Promise<void> {
    await createImportJobAction(this.createActionsHost());
  }

  async activateContentRelease(): Promise<void> {
    await activateContentReleaseAction(
      this.hosts.createActivationActionsHost(
        () => this.refreshContentReads(),
        () => this.loadContentReleaseActivationReadiness(),
        () => this.loadContentReleaseDetail()
      )
    );
  }

  async refreshContentReads(quiet = false): Promise<void> {
    if (!this.hasWorkspaceScope()) {
      return;
    }
    await refreshContentReadsAction(this.hosts.createContentReadsHost(), quiet);
  }

  async loadSourcePackageDetail(): Promise<GetSourcePackageResponse> {
    return loadSourcePackageDetailAction(this.hosts.createContentDetailsHost());
  }

  async loadImportJobDetail(): Promise<GetImportJobResponse> {
    return loadImportJobDetailAction(this.hosts.createContentDetailsHost());
  }

  async loadContentReleaseActivationReadiness(): Promise<GetContentReleaseActivationReadinessResponse> {
    return loadContentReleaseActivationReadinessAction(this.hosts.createContentDetailsHost());
  }

  async loadContentReleaseDetail(): Promise<GetContentReleaseResponse> {
    return loadContentReleaseDetailAction(this.hosts.createContentDetailsHost());
  }

  async retrySourcePackageImport(): Promise<void> {
    await retrySourcePackageImportAction(this.createActionsHost());
  }

  async importActivateFlow(): Promise<void> {
    await runImportActivateFlow(createImportActivateFlowHost({
      createSourcePackage: () => this.createSourcePackage(),
      createImportJob: () => this.createImportJob(),
      activateContentRelease: () => this.activateContentRelease(),
      rememberActivity: (title: string, detail: string) => {
        this.feedback.rememberActivity(title, detail);
      },
      getContentReleaseId: () => this.getContentReleaseId()
    }));
  }

  async blockedActivationFlow(): Promise<void> {
    await runBlockedActivationFlow(createBlockedActivationFlowHost({
      createSourcePackage: () => this.createSourcePackage(),
      createImportJob: () => this.createImportJob(),
      loadContentReleaseActivationReadiness: () =>
        this.loadContentReleaseActivationReadiness(),
      activateContentRelease: () => this.activateContentRelease(),
      rememberActivity: (title: string, detail: string) => {
        this.feedback.rememberActivity(title, detail);
      },
      getContentReleaseId: () => this.getContentReleaseId(),
      isBlockedActivationError: (error: unknown) =>
        this.api.isApiError(error) &&
        error.error === "active_content_release_has_open_runs",
      onBlockedActivation: () => {
        this.requestState.clearForegroundBusyState();
        this.requestState.clearErrorMessage();
        this.requestState.setResponseMeta("Activation Guard · blocked");
      }
    }));
  }

  private createActionsHost() {
    return this.hosts.createContentActionsHost(
      quiet => this.refreshContentReads(quiet),
      () => this.loadSourcePackageDetail(),
      () => this.loadImportJobDetail(),
      () => this.loadContentReleaseDetail(),
      () => this.loadContentReleaseActivationReadiness()
    );
  }

  private getContentReleaseId(): string {
    return this.contentState.contentReleaseId.trim();
  }

  private hasWorkspaceScope(): boolean {
    return (
      this.uiState.workspace.tenantKey.trim() !== "" &&
      this.uiState.workspace.workspaceKey.trim() !== ""
    );
  }
}
