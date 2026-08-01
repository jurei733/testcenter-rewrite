import { Injectable, inject } from "@angular/core";

import {
  type DeleteSourcePackageRequest,
  type DeleteSourcePackageResponse,
  type GetContentReleaseActivationReadinessResponse,
  type GetContentReleaseResponse,
  type GetImportJobResponse,
  type GetSourcePackageResponse,
  type GetSourcePackageDeletionReadinessResponse,
  type ReplaceSourcePackageRequest,
  type ReplaceSourcePackageResponse,
  productionApiRoutes,
  resolveRoutePath
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
import { downloadBlobFile, downloadTextFile } from "./download-text-file";
import { prettyPrintJson } from "./rewrite-app-shell.readers";
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
    if (!this.hasWorkspaceScope()) {
      return;
    }
    await createSourcePackageAction(this.createActionsHost());
  }

  async createImportJob(): Promise<void> {
    if (!this.hasWorkspaceScope()) {
      return;
    }
    await createImportJobAction(this.createActionsHost());
  }

  async activateContentRelease(): Promise<void> {
    if (!this.hasWorkspaceScope()) {
      return;
    }
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

  async exportSourcePackagesCsv(): Promise<string> {
    if (!this.hasWorkspaceScope()) {
      return "";
    }
    const tenantKey = this.uiState.workspace.tenantKey.trim();
    const workspaceKey = this.uiState.workspace.workspaceKey.trim();
    const csv = await this.requestState.request<string>(
      "Source Packages CSV Export",
      "GET",
      this.hosts.createContentReadsHost().getSourcePackagesExportPath()
    );

    this.contentState.sourcePackagesExportView = csv;
    downloadTextFile({
      filename: `${workspaceKey || "workspace"}-source-packages.csv`,
      mediaType: "text/csv;charset=utf-8",
      text: csv
    });
    this.feedback.rememberActivity(
      "Source Packages Exported",
      `CSV source package export loaded for ${tenantKey}/${workspaceKey}.`
    );
    return csv;
  }

  async exportImportJobsCsv(): Promise<string> {
    if (!this.hasWorkspaceScope()) {
      return "";
    }
    const tenantKey = this.uiState.workspace.tenantKey.trim();
    const workspaceKey = this.uiState.workspace.workspaceKey.trim();
    const csv = await this.requestState.request<string>(
      "Import Jobs CSV Export",
      "GET",
      this.hosts.createContentReadsHost().getImportJobsExportPath()
    );

    this.contentState.importJobsExportView = csv;
    downloadTextFile({
      filename: `${workspaceKey || "workspace"}-import-jobs.csv`,
      mediaType: "text/csv;charset=utf-8",
      text: csv
    });
    this.feedback.rememberActivity(
      "Import Jobs Exported",
      `CSV import job export loaded for ${tenantKey}/${workspaceKey}.`
    );
    return csv;
  }

  async exportContentReleasesCsv(): Promise<string> {
    if (!this.hasWorkspaceScope()) {
      return "";
    }
    const tenantKey = this.uiState.workspace.tenantKey.trim();
    const workspaceKey = this.uiState.workspace.workspaceKey.trim();
    const csv = await this.requestState.request<string>(
      "Content Releases CSV Export",
      "GET",
      this.hosts.createContentReadsHost().getContentReleasesExportPath()
    );

    this.contentState.contentReleasesExportView = csv;
    downloadTextFile({
      filename: `${workspaceKey || "workspace"}-content-releases.csv`,
      mediaType: "text/csv;charset=utf-8",
      text: csv
    });
    this.feedback.rememberActivity(
      "Content Releases Exported",
      `CSV content release export loaded for ${tenantKey}/${workspaceKey}.`
    );
    return csv;
  }

  async loadSourcePackageDetail(): Promise<GetSourcePackageResponse> {
    return loadSourcePackageDetailAction(this.hosts.createContentDetailsHost());
  }

  async downloadSourcePackage(): Promise<void> {
    if (!this.hasWorkspaceScope() || !this.contentState.sourcePackageId.trim()) {
      return;
    }
    const sourcePackageId = this.contentState.sourcePackageId.trim();
    const download = await this.requestState.requestDownload(
      "Source Package Download",
      resolveRoutePath(productionApiRoutes.workspace.downloadSourcePackage, {
        tenantKey: this.uiState.workspace.tenantKey.trim(),
        workspaceKey: this.uiState.workspace.workspaceKey.trim(),
        sourcePackageId
      })
    );
    const filename =
      download.filename || this.contentState.sourceFileName.trim() || "source-package";
    downloadBlobFile({ filename, blob: download.blob });
    this.feedback.rememberActivity(
      "Source Package Downloaded",
      `${filename} downloaded as ${download.blob.size} byte(s).`
    );
  }

  async loadSourcePackageDeletionReadiness(): Promise<GetSourcePackageDeletionReadinessResponse> {
    const sourcePackageId = this.contentState.sourcePackageId.trim();
    const payload = await this.requestState.request<GetSourcePackageDeletionReadinessResponse>(
      "Source Package Deletion Readiness",
      "GET",
      resolveRoutePath(
        productionApiRoutes.workspace.getSourcePackageDeletionReadiness,
        {
          tenantKey: this.uiState.workspace.tenantKey.trim(),
          workspaceKey: this.uiState.workspace.workspaceKey.trim(),
          sourcePackageId
        }
      )
    );
    this.contentState.sourcePackageDeletionReadinessView = prettyPrintJson(
      payload,
      this.contentState.sourcePackageDeletionReadinessView
    );
    this.feedback.rememberActivity(
      "Deletion Readiness Loaded",
      payload.deletionReadiness.canDelete
        ? `${payload.deletionReadiness.sourcePackage.fileName} can be deleted.`
        : `${payload.deletionReadiness.blockingDependencies.length} dependency item(s) block deletion.`
    );
    return payload;
  }

  async replaceSourcePackage(): Promise<ReplaceSourcePackageResponse> {
    const sourcePackageId = this.contentState.sourcePackageId.trim();
    const payload = await this.requestState.request<ReplaceSourcePackageResponse>(
      "Replace Source Package",
      "POST",
      resolveRoutePath(productionApiRoutes.workspace.replaceSourcePackage, {
        tenantKey: this.uiState.workspace.tenantKey.trim(),
        workspaceKey: this.uiState.workspace.workspaceKey.trim(),
        sourcePackageId
      }),
      {
        fileName: this.contentState.sourceFileName.trim(),
        mediaType: this.contentState.sourceMediaType.trim(),
        sourceDocument: this.contentState.sourceDocument
      } satisfies ReplaceSourcePackageRequest
    );
    this.contentState.sourcePackageId =
      payload.replacementSourcePackage.sourcePackageId;
    this.contentState.importJobId = payload.importJob.importJobId;
    this.contentState.contentReleaseId =
      payload.stagedContentRelease?.contentReleaseId ?? "";
    this.contentState.sourcePackageDeletionReadinessView =
      'Use "Deletion Readiness".';
    const host = this.createActionsHost();
    host.persistShellState();
    this.feedback.rememberActivity(
      "Source Package Replaced",
      `${payload.replacementSourcePackage.fileName} imported as ${payload.importJob.status}; the prior version remains.`
    );
    await this.refreshContentReads();
    await this.loadSourcePackageDetail();
    await this.loadImportJobDetail();
    if (payload.stagedContentRelease) {
      await this.loadContentReleaseActivationReadiness();
      await this.loadContentReleaseDetail();
    }
    return payload;
  }

  async deleteSourcePackage(
    confirmation: string
  ): Promise<DeleteSourcePackageResponse> {
    const sourcePackageId = this.contentState.sourcePackageId.trim();
    const payload = await this.requestState.request<DeleteSourcePackageResponse>(
      "Delete Source Package",
      "DELETE",
      resolveRoutePath(productionApiRoutes.workspace.deleteSourcePackage, {
        tenantKey: this.uiState.workspace.tenantKey.trim(),
        workspaceKey: this.uiState.workspace.workspaceKey.trim(),
        sourcePackageId
      }),
      { confirmation } satisfies DeleteSourcePackageRequest
    );
    this.contentState.sourcePackageId = "";
    this.contentState.importJobId = "";
    this.contentState.contentReleaseId = "";
    this.contentState.sourcePackageDetailView = 'Use "Source Package Detail".';
    this.contentState.importJobDetailView = 'Use "Import Job Detail".';
    this.contentState.contentReleaseDetailView = 'Use "Release Detail".';
    this.contentState.contentReleaseActivationReadinessView =
      'Use "Release Readiness".';
    this.contentState.sourcePackageDeletionReadinessView =
      'Use "Deletion Readiness".';
    const host = this.createActionsHost();
    host.persistShellState();
    this.feedback.rememberActivity(
      "Source Package Deleted",
      `${payload.deletion.fileName} and its unused derivatives were deleted.`
    );
    await this.refreshContentReads();
    return payload;
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
    if (!this.hasWorkspaceScope()) {
      return;
    }
    await retrySourcePackageImportAction(this.createActionsHost());
  }

  async importActivateFlow(): Promise<void> {
    if (!this.hasWorkspaceScope()) {
      return;
    }
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
    if (!this.hasWorkspaceScope()) {
      return;
    }
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
