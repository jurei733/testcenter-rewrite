import { Injectable, inject } from "@angular/core";

import {
  type AssembleSourcePackagesRequest,
  type AssembleSourcePackagesResponse,
  type CreateSourcePackageRequest,
  type CreateSourcePackageResponse,
  type DeleteSourcePackageRequest,
  type DeleteSourcePackageResponse,
  type DeleteSourcePackagesRequest,
  type DeleteSourcePackagesResponse,
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

const describeParticipantRosterImport = (
  summary: AssembleSourcePackagesResponse["participantRosterImport"]
): string =>
  summary
    ? ` Roster: ${summary.importedCount} imported, ${summary.updatedCount} updated, ${summary.operationalLoginCandidateCount} operational candidate(s) from ${summary.sourceFileNames.length} file(s).`
    : "";

export const MAX_LOOSE_SOURCE_PACKAGE_UPLOAD_COUNT = 200;

export type LooseSourcePackageUploadInput = {
  fileName: string;
  mediaType: string;
  loadSourceDocument: () => Promise<
    NonNullable<CreateSourcePackageRequest["sourceDocument"]>
  >;
};

export type LooseSourcePackageUploadIssue = {
  fileName: string;
  error: string;
  message: string;
  statusCode?: number;
};

export type LooseSourcePackageUploadPhase =
  | "uploading"
  | "refreshing"
  | "completed";

export type LooseSourcePackageUploadReport = {
  requestedCount: number;
  processedCount: number;
  phase: LooseSourcePackageUploadPhase;
  currentFileName?: string;
  uploaded: CreateSourcePackageResponse[];
  rejected: LooseSourcePackageUploadIssue[];
  refreshError?: LooseSourcePackageUploadIssue;
};

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

  async assembleSourcePackages(
    fileName: string,
    sourcePackageIds: string[]
  ): Promise<AssembleSourcePackagesResponse> {
    const payload = await this.requestState.request<AssembleSourcePackagesResponse>(
      "Assemble Source Packages",
      "POST",
      resolveRoutePath(productionApiRoutes.workspace.assembleSourcePackages, {
        tenantKey: this.uiState.workspace.tenantKey.trim(),
        workspaceKey: this.uiState.workspace.workspaceKey.trim()
      }),
      {
        fileName: fileName.trim(),
        sourcePackageIds
      } satisfies AssembleSourcePackagesRequest
    );
    this.contentState.sourcePackageId = payload.sourcePackage.sourcePackageId;
    this.contentState.sourceFileName = payload.sourcePackage.fileName;
    this.contentState.sourceMediaType = payload.sourcePackage.mediaType;
    this.contentState.importJobId = payload.importJob.importJobId;
    this.contentState.contentReleaseId =
      payload.stagedContentRelease?.contentReleaseId ?? "";
    this.createActionsHost().persistShellState();
    this.feedback.rememberActivity(
      "Source Packages Assembled",
      `${payload.assembledFrom.length} file(s) assembled as ${payload.sourcePackage.fileName}; import ${payload.importJob.status}.${describeParticipantRosterImport(payload.participantRosterImport)}`
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

  async uploadLooseSourcePackages(
    files: LooseSourcePackageUploadInput[],
    onProgress?: (report: LooseSourcePackageUploadReport) => void
  ): Promise<LooseSourcePackageUploadReport> {
    const route = resolveRoutePath(
      productionApiRoutes.workspace.createSourcePackage,
      {
        tenantKey: this.uiState.workspace.tenantKey.trim(),
        workspaceKey: this.uiState.workspace.workspaceKey.trim()
      }
    );
    const uploaded: CreateSourcePackageResponse[] = [];
    const uploadQueue = files.slice(0, MAX_LOOSE_SOURCE_PACKAGE_UPLOAD_COUNT);
    const rejected: LooseSourcePackageUploadIssue[] = files
      .slice(uploadQueue.length)
      .map(file => ({
        fileName: file.fileName,
        error: "source_package_upload_batch_limit_exceeded",
        message: `Only the first ${MAX_LOOSE_SOURCE_PACKAGE_UPLOAD_COUNT} selected files can be uploaded in one operation.`
      }));
    let refreshError: LooseSourcePackageUploadIssue | undefined;
    const createReport = (
      phase: LooseSourcePackageUploadPhase,
      currentFileName?: string
    ): LooseSourcePackageUploadReport => ({
      requestedCount: files.length,
      processedCount: uploaded.length + rejected.length,
      phase,
      ...(currentFileName ? { currentFileName } : {}),
      uploaded: [...uploaded],
      rejected: [...rejected],
      ...(refreshError ? { refreshError } : {})
    });
    const publishProgress = (
      phase: LooseSourcePackageUploadPhase,
      currentFileName?: string
    ): void => {
      try {
        onProgress?.(createReport(phase, currentFileName));
      } catch {
        // UI progress rendering must not interrupt the best-effort upload.
      }
    };
    publishProgress("uploading", uploadQueue[0]?.fileName);
    try {
      for (const [index, file] of uploadQueue.entries()) {
        try {
          uploaded.push(
            await this.requestState.request<CreateSourcePackageResponse>(
              `Upload ${file.fileName}`,
              "POST",
              route,
              {
                fileName: file.fileName,
                mediaType: file.mediaType,
                sourceDocument: await file.loadSourceDocument()
              } satisfies CreateSourcePackageRequest
            )
          );
        } catch (error) {
          rejected.push(this.toLooseSourcePackageUploadIssue(file.fileName, error));
        }
        publishProgress("uploading", uploadQueue[index + 1]?.fileName);
      }
    } finally {
      publishProgress("refreshing");
      try {
        await this.refreshContentReads(true);
      } catch (error) {
        refreshError = this.toLooseSourcePackageUploadIssue(
          "Workspace file refresh",
          error
        );
      }
    }
    const report = createReport("completed");
    publishProgress("completed");
    this.feedback.rememberActivity(
      "Loose Source File Upload Finished",
      `${uploaded.length}/${files.length} file(s) uploaded; ${rejected.length} rejected.${refreshError ? " Workspace refresh failed; retry the content read." : ""}`
    );
    return report;
  }

  async createImportJob(
    dependencySourcePackageIds: string[] = [],
    dependencySelectionRevision?: string
  ): Promise<void> {
    if (!this.hasWorkspaceScope()) {
      return;
    }
    await createImportJobAction(
      this.createActionsHost(),
      dependencySourcePackageIds,
      dependencySelectionRevision
    );
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
      `${payload.replacementSourcePackage.fileName} imported as ${payload.importJob.status}; the prior version remains.${describeParticipantRosterImport(payload.participantRosterImport)}`
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
    this.contentState.sourcePackageId = "";
    this.contentState.importJobId = "";
    this.contentState.contentReleaseId = "";
    host.persistShellState();
    return payload;
  }

  async deleteSourcePackages(
    items: DeleteSourcePackagesRequest["items"]
  ): Promise<DeleteSourcePackagesResponse> {
    const payload = await this.requestState.request<DeleteSourcePackagesResponse>(
      "Delete Selected Source Packages",
      "POST",
      resolveRoutePath(productionApiRoutes.workspace.deleteSourcePackages, {
        tenantKey: this.uiState.workspace.tenantKey.trim(),
        workspaceKey: this.uiState.workspace.workspaceKey.trim()
      }),
      { items } satisfies DeleteSourcePackagesRequest
    );
    const host = this.createActionsHost();
    this.feedback.rememberActivity(
      "Source Package Batch Deleted",
      `${payload.report.deleted.length}/${payload.report.requestedCount} selected file(s) were deleted; ${payload.report.wasUsed.length} remain in use and ${payload.report.notAllowed.length + payload.report.didNotExist.length + payload.report.errors.length} failed another check.`
    );
    await this.refreshContentReads();
    host.persistShellState();
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

  private toLooseSourcePackageUploadIssue(
    fileName: string,
    error: unknown
  ): LooseSourcePackageUploadIssue {
    if (this.requestState.isApiError(error)) {
      return {
        fileName,
        error: error.error,
        message: error.message,
        ...(error.statusCode === undefined
          ? {}
          : { statusCode: error.statusCode })
      };
    }
    return {
      fileName,
      error: "unexpected_error",
      message: error instanceof Error ? error.message : String(error)
    };
  }
}
