import { ApplicationRef, Injectable, inject } from "@angular/core";
import { Router } from "@angular/router";

import type {
  GetContentReleaseActivationReadinessResponse,
  GetContentReleaseResponse,
  GetImportJobResponse,
  ListParticipantSessionsResponse,
  GetSourcePackageResponse,
  ListContentReleasesResponse,
  ListImportJobsResponse,
  ListSourcePackagesResponse
} from "@testcenter-rewrite-app/contracts";
import {
  contentReleaseStatuses,
  importJobStatuses,
  sourcePackageStatuses
} from "@testcenter-rewrite-app/domain";
import { DEFAULT_SOURCE_DOCUMENT, type SummaryCard } from "./rewrite-app-shell.types";
import {
  parseJsonDocument,
  readNumberValue,
  readStringValue,
  readUnknownValue
} from "./rewrite-app-shell.readers";
import { downloadDataUrlFile, downloadTextFile } from "./download-text-file";
import type { RecordCollectionItem } from "./record-collection.component";
import {
  type ParticipantSessionEntryLinkContext,
  participantSessionLinkRows as buildParticipantSessionLinkRows
} from "./participant-session-links";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";
import { RewriteAppContentService } from "./rewrite-app-content.service";
import { RewriteAppShellFeedbackService } from "./rewrite-app-shell-feedback.service";
import { RewriteAppRuntimeService } from "./rewrite-app-runtime.service";
import { RewriteAppViewStateService } from "./rewrite-app-view-state.service";
import { RewriteAppWorkspaceService } from "./rewrite-app-workspace.service";

@Injectable({ providedIn: "root" })
export class ContentViewFacade {
  private readonly applicationRef = inject(ApplicationRef);
  private readonly uiState = inject(RewriteAppUiStateService);
  private readonly contentService = inject(RewriteAppContentService);
  private readonly feedback = inject(RewriteAppShellFeedbackService);
  private readonly runtimeService = inject(RewriteAppRuntimeService);
  private readonly viewState = inject(RewriteAppViewStateService);
  private readonly workspaceService = inject(RewriteAppWorkspaceService);
  private readonly router = inject(Router);

  readonly content = this.uiState.content;
  readonly sourcePackageStatusOptions = sourcePackageStatuses;
  readonly importJobStatusOptions = importJobStatuses;
  readonly contentReleaseStatusOptions = contentReleaseStatuses;

  private readonly participantSessionLinkRows = (
    participantSessionId?: string | null,
    context: ParticipantSessionEntryLinkContext = {}
  ): ReturnType<typeof buildParticipantSessionLinkRows> =>
    buildParticipantSessionLinkRows(participantSessionId, {
      tenantKey: this.uiState.workspace.tenantKey,
      workspaceKey: this.uiState.workspace.workspaceKey,
      ...context
    });

  init(): void {
    this.viewState.setActiveView("content");
  }

  get canUseWorkspaceScope(): boolean {
    return this.isWorkspaceScopeComplete();
  }

  get canCreateSourcePackage(): boolean {
    return (
      this.isWorkspaceScopeComplete() &&
      this.content.sourceFileName.trim() !== "" &&
      this.content.sourceMediaType.trim() !== "" &&
      this.content.sourceDocument.trim() !== ""
    );
  }

  get canCreateImportJob(): boolean {
    return this.isWorkspaceScopeComplete() && this.content.sourcePackageId.trim() !== "";
  }

  get canUseSelectedSourcePackage(): boolean {
    return this.isWorkspaceScopeComplete() && this.content.sourcePackageId.trim() !== "";
  }

  get canUseSelectedImportJob(): boolean {
    return this.isWorkspaceScopeComplete() && this.content.importJobId.trim() !== "";
  }

  get canUseSelectedContentRelease(): boolean {
    return this.isWorkspaceScopeComplete() && this.content.contentReleaseId.trim() !== "";
  }

  get canUseSelectedParticipantSession(): boolean {
    return (
      this.isWorkspaceScopeComplete() &&
      this.uiState.runtime.participantSessionId.trim() !== ""
    );
  }

  get canRetrySourcePackageImport(): boolean {
    return (
      this.canUseSelectedSourcePackage &&
      this.hasSelectedFailedSourcePackageContext() &&
      this.content.sourceFileName.trim() !== "" &&
      this.content.sourceMediaType.trim() !== "" &&
      this.content.sourceDocument.trim() !== ""
    );
  }

  persistState(): void {
    this.viewState.persistShellState();
  }

  restoreDemoSource(): void {
    this.content.sourceFileName = "frontend-starter.xml";
    this.content.sourceMediaType = "application/xml";
    this.content.sourceDocument = DEFAULT_SOURCE_DOCUMENT;
    this.persistState();
  }

  async loadSourceDocumentFile(event: Event): Promise<void> {
    const input = event.target;
    if (!(input instanceof HTMLInputElement)) {
      return;
    }

    const file = input.files?.[0] ?? null;
    if (!file) {
      return;
    }

    const sourceDocument = this.isZipSourceFile(file)
      ? await this.readFileAsDataUrl(file)
      : await file.text();
    this.content.sourceFileName = file.name;
    this.content.sourceMediaType = this.inferMediaTypeFromFile(file);
    this.content.sourceDocument = sourceDocument;
    this.persistState();
    this.uiState.renderVersion.update(version => version + 1);
    this.applicationRef.tick();
    this.feedback.rememberActivity(
      "Source Document Loaded",
      `${file.name} loaded with ${sourceDocument.length} character(s) as ${this.content.sourceMediaType}.`
    );
  }

  clearContentReadFilters(): void {
    this.content.sourcePackageStatusFilter = "";
    this.content.sourcePackageMediaTypeFilter = "";
    this.content.sourcePackageFileNameFilter = "";
    this.content.sourcePackageLatestImportStatusFilter = "";
    this.content.sourcePackageLimit = "100";
    this.content.importJobStatusFilter = "";
    this.content.importJobSourcePackageFilter = "";
    this.content.importJobLimit = "100";
    this.content.contentReleaseStatusFilter = "";
    this.content.contentReleaseImportJobFilter = "";
    this.content.contentReleaseSourcePackageFilter = "";
    this.content.contentReleaseLimit = "100";
    this.persistState();
    this.refreshContentReads();
  }

  useSelectedIdsAsContentReadFilters(): void {
    if (!this.canUseWorkspaceScope) {
      return;
    }
    const sourcePackageId = this.content.sourcePackageId.trim();
    const importJobId = this.content.importJobId.trim();
    if (sourcePackageId) {
      this.content.importJobSourcePackageFilter = sourcePackageId;
      this.content.contentReleaseSourcePackageFilter = sourcePackageId;
    }
    if (importJobId) {
      this.content.contentReleaseImportJobFilter = importJobId;
    }
    this.persistState();
    this.refreshContentReads();
  }

  applyContentReadFilters(): void {
    if (!this.canUseWorkspaceScope) {
      return;
    }
    this.persistState();
    this.refreshContentReads();
  }

  exportSourcePackagesCsv(): void {
    if (!this.canUseWorkspaceScope) {
      return;
    }
    this.viewState.onActionAsync(() => this.contentService.exportSourcePackagesCsv());
  }

  exportImportJobsCsv(): void {
    if (!this.canUseWorkspaceScope) {
      return;
    }
    this.viewState.onActionAsync(() => this.contentService.exportImportJobsCsv());
  }

  exportContentReleasesCsv(): void {
    if (!this.canUseWorkspaceScope) {
      return;
    }
    this.viewState.onActionAsync(() =>
      this.contentService.exportContentReleasesCsv()
    );
  }

  get contentCards(): SummaryCard[] {
    const sourcePackages = parseJsonDocument(this.content.sourcePackagesView);
    const importJobs = parseJsonDocument(this.content.importJobsView);
    const releases = parseJsonDocument(this.content.contentReleasesView);
    const readiness = parseJsonDocument(
      this.content.contentReleaseActivationReadinessView
    );

    const latestSourceFile =
      readStringValue(sourcePackages, ["items", "0", "sourcePackage", "fileName"]) ??
      this.content.sourceFileName;
    const latestImportStatus =
      readStringValue(importJobs, ["items", "0", "importJob", "status"]) ?? "idle";
    const latestReleaseStatus =
      readStringValue(releases, ["items", "0", "contentRelease", "status"]) ?? "none";
    const blockingRuns = readUnknownValue(readiness, [
      "activationReadiness",
      "blockingOpenRuns"
    ]);
    const blockingRunCount = Array.isArray(blockingRuns) ? blockingRuns.length : 0;

    return [
      {
        label: "Source Package",
        headline: latestSourceFile,
        detail: this.content.sourcePackageId.trim() || "no package selected"
      },
      {
        label: "Import Job",
        headline: latestImportStatus,
        detail: this.content.importJobId.trim() || "no import selected"
      },
      {
        label: "Release",
        headline: latestReleaseStatus,
        detail: this.content.contentReleaseId.trim() || "no release selected"
      },
      {
        label: "Activation Guard",
        headline: blockingRunCount > 0 ? `${blockingRunCount} blocker(s)` : "clear",
        detail:
          blockingRunCount > 0
            ? "A participant still has an open run."
            : "No open-run blocker detected."
      }
    ];
  }

  get contentActionItems(): RecordCollectionItem[] {
    const sourcePackageDetail = parseJsonDocument<GetSourcePackageResponse>(
      this.content.sourcePackageDetailView
    )?.sourcePackageDetail;
    const importJobDetail = parseJsonDocument<GetImportJobResponse>(
      this.content.importJobDetailView
    )?.importJobDetail;
    const readiness = parseJsonDocument<GetContentReleaseActivationReadinessResponse>(
      this.content.contentReleaseActivationReadinessView
    )?.activationReadiness;
    const releaseDetail = parseJsonDocument<GetContentReleaseResponse>(
      this.content.contentReleaseDetailView
    )?.contentReleaseDetail;
    const items: RecordCollectionItem[] = [];
    const selectedSourcePackageId = this.content.sourcePackageId.trim();
    const selectedImportJobId = this.content.importJobId.trim();
    const selectedReleaseId = this.content.contentReleaseId.trim();

    if (!selectedSourcePackageId) {
      items.push({
        headline: "Create source package",
        subline: this.content.sourceFileName.trim() || "untitled source",
        badges: ["intake", this.content.sourceMediaType.trim() || "media type missing"],
        rows: [
          {
            label: "Document",
            value: this.content.sourceDocument.trim()
              ? `${this.content.sourceDocument.trim().length} chars ready`
              : "source document missing"
          },
          {
            label: "Expected Result",
            value: "Persist an uploaded package and select it"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { contentCommand: "createSourcePackage" }
      });
    } else if (!sourcePackageDetail) {
      items.push({
        headline: "Load selected package detail",
        subline: selectedSourcePackageId,
        badges: ["detail read"],
        rows: [
          {
            label: "Selected Package",
            value: selectedSourcePackageId
          },
          {
            label: "Expected Result",
            value: "Show structure, import history, and release history"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { contentCommand: "loadSourcePackageDetail" }
      });
    }

    if (sourcePackageDetail) {
      const latestImportJob = sourcePackageDetail.importJobs[0];
      const hasCompletedImport = sourcePackageDetail.importJobs.some(
        importJob => importJob.status === "completed"
      );
      if (
        sourcePackageDetail.sourcePackage.status === "rejected" ||
        latestImportJob?.status === "failed"
      ) {
        items.push({
          headline: "Retry failed package import",
          subline: sourcePackageDetail.sourcePackage.fileName,
          badges: [sourcePackageDetail.sourcePackage.status, "retry"],
          rows: [
            {
              label: "Latest Import",
              value: latestImportJob?.status ?? "none"
            },
            {
              label: "Expected Result",
              value: "Create a new import attempt with the current source document"
            }
          ],
          actionLabel: "Apply Suggestion",
          actionPayload: { contentCommand: "retrySourcePackageImport" }
        });
      } else if (!hasCompletedImport) {
        items.push({
          headline: "Create import job",
          subline: sourcePackageDetail.sourcePackage.fileName,
          badges: [sourcePackageDetail.sourcePackage.status, "import"],
          rows: [
            {
              label: "Attempts",
              value: String(sourcePackageDetail.importJobs.length)
            },
            {
              label: "Expected Result",
              value: "Produce a staged content release or diagnostics"
            }
          ],
          actionLabel: "Apply Suggestion",
          actionPayload: { contentCommand: "createImportJob" }
        });
      }
    }

    if (selectedImportJobId && !importJobDetail) {
      items.push({
        headline: "Load selected import detail",
        subline: selectedImportJobId,
        badges: ["detail read"],
        rows: [
          {
            label: "Selected Import",
            value: selectedImportJobId
          },
          {
            label: "Expected Result",
            value: "Show diagnostics and linked package or release"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { contentCommand: "loadImportJobDetail" }
      });
    }

    if (importJobDetail?.importJob.status === "failed") {
      items.push({
        headline: "Retry this failed import",
        subline: importJobDetail.importJob.importJobId,
        badges: ["failed", `${importJobDetail.importJob.diagnostics.length} diagnostic(s)`],
        rows: [
          {
            label: "Source Package",
            value: importJobDetail.sourcePackage?.sourcePackageId ?? selectedSourcePackageId
          },
          {
            label: "Expected Result",
            value: "Run another import attempt for the same package"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { contentCommand: "retrySourcePackageImport" }
      });
    }

    if (selectedReleaseId && !readiness) {
      items.push({
        headline: "Check release readiness",
        subline: selectedReleaseId,
        badges: ["activation guard"],
        rows: [
          {
            label: "Selected Release",
            value: selectedReleaseId
          },
          {
            label: "Expected Result",
            value: "Resolve whether activation is clear or blocked"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { contentCommand: "loadReleaseReadiness" }
      });
    }

    if (readiness) {
      const firstBlockingRun = readiness.blockingOpenRuns[0];
      if (readiness.canActivate && readiness.contentRelease.status === "staged") {
        items.push({
          headline: "Activate selected release",
          subline: readiness.contentRelease.releaseLabel,
          badges: ["staged", "clear"],
          rows: [
            {
              label: "Current Active",
              value: readiness.activeContentReleaseId ?? "none"
            },
            {
              label: "Expected Result",
              value: "Promote this release and supersede the previous active release"
            }
          ],
          actionLabel: "Apply Suggestion",
          actionPayload: { contentCommand: "activateContentRelease" }
        });
      } else if (!readiness.canActivate && firstBlockingRun) {
        items.push({
          headline: "Open blocking run in Runtime",
          subline: firstBlockingRun.testRunId,
          badges: ["blocked", firstBlockingRun.status],
          rows: [
            {
              label: "Participant",
              value: firstBlockingRun.loginKey
            },
            {
              label: "Expected Result",
              value: "Jump to the run that blocks activation"
            }
          ],
          actionLabel: "Apply Suggestion",
          actionPayload: {
            contentCommand: "openBlockingRunInRuntime",
            loginKey: firstBlockingRun.loginKey,
            groupKey: firstBlockingRun.groupKey,
            bookletKey: firstBlockingRun.bookletKey,
            participantSessionId: firstBlockingRun.participantSessionId,
            testRunId: firstBlockingRun.testRunId,
            currentUnitKey: firstBlockingRun.currentUnitKey ?? ""
          }
        });
      }
    }

    if (selectedReleaseId && !releaseDetail) {
      items.push({
        headline: "Load selected release detail",
        subline: selectedReleaseId,
        badges: ["release detail"],
        rows: [
          {
            label: "Selected Release",
            value: selectedReleaseId
          },
          {
            label: "Expected Result",
            value: "Show lineage, runtime snapshot, sessions, and runs"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { contentCommand: "loadContentReleaseDetail" }
      });
    }

    if (items.length === 0) {
      items.push({
        headline: "Refresh content reads",
        subline: this.content.contentReleaseId.trim() || "workspace content state",
        badges: ["read model"],
        rows: [
          {
            label: "Package",
            value: selectedSourcePackageId || "none selected"
          },
          {
            label: "Expected Result",
            value: "Reload package, import, release, session, and activity lists"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { contentCommand: "refreshContentReads" }
      });
    }

    return items;
  }

  get sourcePackageItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ListSourcePackagesResponse>(
      this.content.sourcePackagesView
    );
    if (!payload) {
      return [];
    }

    return [
      this.buildReadWindowItem(
        "Source package window",
        "source package",
        payload.items.length,
        this.content.sourcePackageLimit,
        [
          this.content.sourcePackageStatusFilter.trim() ? "status" : "",
          this.content.sourcePackageMediaTypeFilter.trim() ? "media type" : "",
          this.content.sourcePackageFileNameFilter.trim() ? "file name" : "",
          this.content.sourcePackageLatestImportStatusFilter.trim()
            ? "latest import"
            : ""
        ].filter(Boolean)
      ),
      ...payload.items.map(item => ({
        headline: item.sourcePackage.fileName,
        subline: item.sourcePackage.sourcePackageId,
        badges: [
          item.sourcePackage.status,
          item.latestImportJob?.status ?? "no import"
        ],
        rows: [
          { label: "Media Type", value: item.sourcePackage.mediaType },
          {
            label: "Uploaded",
            value: this.formatDateTime(item.sourcePackage.uploadedAt)
          }
        ],
        selected:
          this.content.sourcePackageId.trim() === item.sourcePackage.sourcePackageId,
        actionLabel: "Select + Load",
        actionPayload: {
          sourcePackageId: item.sourcePackage.sourcePackageId,
          sourceFileName: item.sourcePackage.fileName,
          sourceMediaType: item.sourcePackage.mediaType
        }
      }))
    ];
  }

  get importJobItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ListImportJobsResponse>(this.content.importJobsView);
    if (!payload) {
      return [];
    }

    return [
      this.buildReadWindowItem(
        "Import job window",
        "import job",
        payload.items.length,
        this.content.importJobLimit,
        [
          this.content.importJobStatusFilter.trim() ? "status" : "",
          this.content.importJobSourcePackageFilter.trim() ? "source package" : ""
        ].filter(Boolean)
      ),
      ...payload.items.map(item => ({
        headline: item.importJob.importJobId,
        subline: item.sourcePackage?.fileName ?? "Unknown source package",
        badges: [
          item.importJob.status,
          item.importJob.diagnostics.length > 0
            ? `${item.importJob.diagnostics.length} diagnostic(s)`
            : "clean"
        ],
        rows: [
          {
            label: "Finished",
            value: item.importJob.finishedAt
              ? this.formatDateTime(item.importJob.finishedAt)
              : "not finished"
          },
          {
            label: "Selected",
            value:
              this.content.importJobId.trim() === item.importJob.importJobId
                ? "yes"
                : "no"
          }
        ],
        selected: this.content.importJobId.trim() === item.importJob.importJobId,
        actionLabel: "Select + Load",
        actionPayload: {
          importJobId: item.importJob.importJobId,
          sourcePackageId: item.sourcePackage?.sourcePackageId ?? ""
        }
      }))
    ];
  }

  get contentReleaseItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ListContentReleasesResponse>(
      this.content.contentReleasesView
    );
    if (!payload) {
      return [];
    }

    return [
      this.buildReadWindowItem(
        "Content release window",
        "content release",
        payload.items.length,
        this.content.contentReleaseLimit,
        [
          this.content.contentReleaseStatusFilter.trim() ? "status" : "",
          this.content.contentReleaseImportJobFilter.trim() ? "import job" : "",
          this.content.contentReleaseSourcePackageFilter.trim()
            ? "source package"
            : ""
        ].filter(Boolean)
      ),
      ...payload.items.map(item => ({
        headline: item.contentRelease.releaseLabel,
        subline: item.contentRelease.contentReleaseId,
        badges: [
          item.contentRelease.status,
          `${item.openTestRunCount} open run(s)`
        ],
        rows: [
          {
            label: "Sessions",
            value: String(item.participantSessionCount)
          },
          {
            label: "Activated",
            value: item.contentRelease.activatedAt
              ? this.formatDateTime(item.contentRelease.activatedAt)
              : "not activated"
          }
        ],
        selected:
          this.content.contentReleaseId.trim() === item.contentRelease.contentReleaseId,
        actionLabel: "Select + Load",
        actionPayload: {
          contentReleaseId: item.contentRelease.contentReleaseId
        }
      }))
    ];
  }

  get sourcePackageDetailItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetSourcePackageResponse>(
      this.content.sourcePackageDetailView
    );
    const detail = payload?.sourcePackageDetail;
    if (!detail) {
      return [];
    }
    return [
      {
        headline: detail.sourcePackage.fileName,
        subline: detail.sourcePackage.sourcePackageId,
        badges: [
          detail.sourcePackage.status,
          `${detail.importJobs.length} import(s)`,
          `${detail.contentReleases.length} release(s)`
        ],
        rows: [
          { label: "Media Type", value: detail.sourcePackage.mediaType },
          {
            label: "Uploaded",
            value: this.formatDateTime(detail.sourcePackage.uploadedAt)
          }
        ],
        selected:
          this.content.sourcePackageId.trim() === detail.sourcePackage.sourcePackageId,
        actionLabel: "Select + Load",
        actionPayload: {
          sourcePackageId: detail.sourcePackage.sourcePackageId,
          sourceFileName: detail.sourcePackage.fileName,
          sourceMediaType: detail.sourcePackage.mediaType
        }
      }
    ];
  }

  get sourcePackageStructureItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetSourcePackageResponse>(
      this.content.sourcePackageDetailView
    );
    const structure = payload?.sourcePackageDetail.sourcePackage.contentStructure;
    return (
      structure?.bookletEntries.map(booklet => ({
        headline: booklet.displayLabel,
        subline: booklet.bookletKey,
        badges: [`${booklet.unitEntries.length} unit(s)`],
        rows: [
          {
            label: "Unit Keys",
            value: booklet.unitEntries.map(unit => unit.unitKey).join(", ") || "none"
          },
          {
            label: "Unit Labels",
            value:
              booklet.unitEntries.map(unit => unit.displayLabel).join(" | ") || "none"
          },
          {
            label: "Prompt Coverage",
            value: this.formatUnitPromptCoverage(booklet.unitEntries)
          },
          {
            label: "Unit Prompts",
            value: this.formatUnitPromptPreview(booklet.unitEntries)
          }
        ],
        selected: false
      })) ?? []
    );
  }

  get draftSourceDocumentPreviewItems(): RecordCollectionItem[] {
    return this.createSourceDocumentPreviewItems({
      fileName: this.content.sourceFileName,
      mediaType: this.content.sourceMediaType,
      sourceDocument: this.content.sourceDocument,
      status: "Draft",
      bookletCount: this.estimateSourceDocumentBookletCount(
        this.content.sourceMediaType,
        this.content.sourceDocument
      ),
      selected: false
    });
  }

  get sourceDocumentPreviewItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetSourcePackageResponse>(
      this.content.sourcePackageDetailView
    );
    const sourcePackage = payload?.sourcePackageDetail.sourcePackage;
    if (!sourcePackage) {
      return [];
    }

    return this.createSourceDocumentPreviewItems({
      fileName: sourcePackage.fileName,
      mediaType: sourcePackage.mediaType,
      sourceDocument: sourcePackage.sourceDocument ?? "",
      status: sourcePackage.status,
      bookletCount: sourcePackage.contentStructure?.bookletEntries.length ?? 0,
      selected: true
    });
  }

  private createSourceDocumentPreviewItems(input: {
    fileName: string;
    mediaType: string;
    sourceDocument: string | null | undefined;
    status: string;
    bookletCount: number | null;
    selected: boolean;
  }): RecordCollectionItem[] {
    const sourceDocument = input.sourceDocument?.trim();
    if (!sourceDocument) {
      return [];
    }

    const isZipSourceDocument = this.isZipSourceDocument(
      input.mediaType,
      sourceDocument
    );
    const normalizedPreview = sourceDocument.replace(/\s+/g, " ").trim();
    const preview =
      isZipSourceDocument
        ? "Base64 ZIP package payload staged for server-side manifest extraction."
        : normalizedPreview.length > 180
        ? `${normalizedPreview.slice(0, 177)}...`
        : normalizedPreview;
    const lineCount = sourceDocument.split(/\r?\n/).length;
    const documentKind = this.inferSourceDocumentKind(
      input.mediaType,
      sourceDocument
    );
    const bookletBadge =
      input.bookletCount == null
        ? "unknown booklet count"
        : `${input.bookletCount} inferred booklet(s)`;

    return [
      {
        headline: input.fileName.trim() || "unnamed-source-document",
        subline: documentKind,
        badges: [
          `${sourceDocument.length} chars`,
          `${lineCount} line(s)`,
          bookletBadge
        ],
        rows: [
          {
            label: "Media Type",
            value: input.mediaType.trim() || "unknown"
          },
          {
            label: "Status",
            value: input.status
          },
          {
            label: "Preview",
            value: preview
          }
        ],
        selected: input.selected
      }
    ];
  }

  get sourcePackageImportHistoryItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetSourcePackageResponse>(
      this.content.sourcePackageDetailView
    );
    return (
      payload?.sourcePackageDetail.importJobs.map(importJob => ({
        headline: importJob.importJobId,
        subline: importJob.status,
        badges: [
          importJob.finishedAt ? "finished" : "pending",
          importJob.diagnostics.length > 0
            ? `${importJob.diagnostics.length} diagnostic(s)`
            : "clean"
        ],
        rows: [
          {
            label: "Created",
            value: this.formatDateTime(importJob.createdAt)
          },
          {
            label: "Finished",
            value: importJob.finishedAt
              ? this.formatDateTime(importJob.finishedAt)
              : "not finished"
          }
        ],
        selected: this.content.importJobId.trim() === importJob.importJobId,
        actionLabel: "Select + Load",
        actionPayload: {
          importJobId: importJob.importJobId
        }
      })) ?? []
    );
  }

  get sourcePackageReleaseHistoryItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetSourcePackageResponse>(
      this.content.sourcePackageDetailView
    );
    return (
      payload?.sourcePackageDetail.contentReleases.map(release => ({
        headline: release.releaseLabel,
        subline: release.contentReleaseId,
        badges: [release.status],
        rows: [
          {
            label: "Created",
            value: this.formatDateTime(release.createdAt)
          },
          {
            label: "Activated",
            value: release.activatedAt
              ? this.formatDateTime(release.activatedAt)
              : "not activated"
          }
        ],
        selected: this.content.contentReleaseId.trim() === release.contentReleaseId,
        actionLabel: "Select + Load",
        actionPayload: {
          contentReleaseId: release.contentReleaseId
        }
      })) ?? []
    );
  }

  get importJobDetailItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetImportJobResponse>(this.content.importJobDetailView);
    const detail = payload?.importJobDetail;
    if (!detail) {
      return [];
    }
    return [
      {
        headline: detail.importJob.importJobId,
        subline: detail.sourcePackage?.fileName ?? "Unknown source package",
        badges: [
          detail.importJob.status,
          detail.contentRelease?.status ?? "no release"
        ],
        rows: [
          {
            label: "Created",
            value: this.formatDateTime(detail.importJob.createdAt)
          },
          {
            label: "Diagnostics",
            value: detail.importJob.diagnostics.length
              ? detail.importJob.diagnostics.map(diagnostic => diagnostic.code).join(", ")
              : "none"
          }
        ],
        selected: this.content.importJobId.trim() === detail.importJob.importJobId,
        actionLabel: "Select + Load",
        actionPayload: {
          importJobId: detail.importJob.importJobId,
          sourcePackageId: detail.sourcePackage?.sourcePackageId ?? "",
          contentReleaseId: detail.contentRelease?.contentReleaseId ?? ""
        }
      }
    ];
  }

  get importJobDiagnosticItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetImportJobResponse>(this.content.importJobDetailView);
    const detail = payload?.importJobDetail;
    return (
      detail?.importJob.diagnostics.map((diagnostic, index) => ({
        headline: diagnostic.code,
        subline: diagnostic.severity,
        badges: [detail.importJob.status, `diagnostic ${index + 1}`],
        rows: [
          {
            label: "Message",
            value: diagnostic.message
          },
          {
            label: "Import Job",
            value: detail.importJob.importJobId
          }
        ],
        selected: false
      })) ?? []
    );
  }

  get importJobLinkageItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetImportJobResponse>(this.content.importJobDetailView);
    const detail = payload?.importJobDetail;
    if (!detail) {
      return [];
    }

    const items: RecordCollectionItem[] = [];
    if (detail.sourcePackage) {
      items.push({
        headline: detail.sourcePackage.fileName,
        subline: detail.sourcePackage.sourcePackageId,
        badges: ["source package", detail.sourcePackage.status],
        rows: [
          {
            label: "Media Type",
            value: detail.sourcePackage.mediaType
          },
          {
            label: "Uploaded",
            value: this.formatDateTime(detail.sourcePackage.uploadedAt)
          }
        ],
        selected:
          this.content.sourcePackageId.trim() === detail.sourcePackage.sourcePackageId,
        actionLabel: "Open Package",
        actionPayload: {
          targetType: "source_package",
          sourcePackageId: detail.sourcePackage.sourcePackageId,
          sourceFileName: detail.sourcePackage.fileName,
          sourceMediaType: detail.sourcePackage.mediaType
        }
      });
    }

    if (detail.contentRelease) {
      items.push({
        headline: detail.contentRelease.releaseLabel,
        subline: detail.contentRelease.contentReleaseId,
        badges: ["content release", detail.contentRelease.status],
        rows: [
          {
            label: "Created",
            value: this.formatDateTime(detail.contentRelease.createdAt)
          },
          {
            label: "Activated",
            value: detail.contentRelease.activatedAt
              ? this.formatDateTime(detail.contentRelease.activatedAt)
              : "not activated"
          }
        ],
        selected:
          this.content.contentReleaseId.trim() ===
          detail.contentRelease.contentReleaseId,
        actionLabel: "Open Release",
        actionPayload: {
          targetType: "content_release",
          contentReleaseId: detail.contentRelease.contentReleaseId
        }
      });
    }

    return items;
  }

  get activationReadinessItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetContentReleaseActivationReadinessResponse>(
      this.content.contentReleaseActivationReadinessView
    );
    const detail = payload?.activationReadiness;
    if (!detail) {
      return [];
    }
    const participantRosterWarnings = detail.participantRosterWarnings ?? [];
    return [
      {
        headline: detail.contentRelease.releaseLabel,
        subline: detail.contentRelease.contentReleaseId,
        badges: [
          detail.canActivate ? "can activate" : "blocked",
          `${detail.blockingOpenRuns.length} open run(s)`,
          `${participantRosterWarnings.length} roster warning(s)`
        ],
        rows: [
          {
            label: "Current Active Release",
            value: detail.activeContentReleaseId ?? "none"
          },
          {
            label: "Status",
            value: detail.contentRelease.status
          },
          {
            label: "Roster Compatibility",
            value:
              participantRosterWarnings.length > 0
                ? participantRosterWarnings
                    .map(item => `${item.loginKey}: ${item.bookletKey ?? "default"}`)
                    .join(", ")
                : "No roster warnings for this release"
          }
        ],
        selected:
          this.content.contentReleaseId.trim() ===
          detail.contentRelease.contentReleaseId,
        actionLabel: "Select + Load",
        actionPayload: {
          contentReleaseId: detail.contentRelease.contentReleaseId
        }
      }
    ];
  }

  get activationRosterWarningItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetContentReleaseActivationReadinessResponse>(
      this.content.contentReleaseActivationReadinessView
    );
    return (
      payload?.activationReadiness.participantRosterWarnings.map(entry => {
        const warnings = entry.validationWarnings ?? [];
        return {
          headline: entry.displayName ?? entry.loginKey,
          subline: entry.displayName ? entry.loginKey : entry.participantRosterEntryId,
          badges: [
            entry.groupKey,
            entry.bookletKey ?? "default booklet",
            `${warnings.length} warning${warnings.length === 1 ? "" : "s"}`
          ],
          rows: [
            { label: "Login", value: entry.loginKey },
            { label: "Group", value: entry.groupKey },
            {
              label: "Booklet",
              value: entry.bookletKey ?? "active release default"
            },
            {
              label: "Validation",
              value: warnings.length
                ? warnings
                    .map(warning => `${warning.code}: ${warning.message}`)
                    .join(" | ")
                : "No roster warnings"
            },
            { label: "Imported", value: this.formatDateTime(entry.importedAt) }
          ],
          selected: this.uiState.runtime.loginKey.trim() === entry.loginKey,
          actionLabel: "Open In Runtime",
          actionPayload: {
            loginKey: entry.loginKey,
            groupKey: entry.groupKey,
            bookletKey: entry.bookletKey ?? ""
          }
        };
      }) ?? []
    );
  }

  get activationBlockingRunItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetContentReleaseActivationReadinessResponse>(
      this.content.contentReleaseActivationReadinessView
    );
    return (
      payload?.activationReadiness.blockingOpenRuns.map(openRun => {
        const displayName = openRun.participantRosterEntry?.displayName;
        const participantSessionId = openRun.participantSessionId;

        return {
          headline: displayName ?? openRun.loginKey,
          subline: displayName ? openRun.loginKey : openRun.testRunId,
          badges: [
            openRun.status,
            openRun.groupKey,
            openRun.participantRosterEntry ? "roster" : "ad hoc"
          ],
          rows: [
            { label: "Run", value: openRun.testRunId },
            ...this.participantSessionLinkRows(participantSessionId, {
              loginKey: openRun.loginKey,
              groupKey: openRun.groupKey,
              bookletKey: openRun.bookletKey
            }),
            { label: "Booklet", value: openRun.bookletKey },
            {
              label: "Current Unit",
              value: openRun.currentUnitKey ?? "none"
            }
          ],
          selected: this.uiState.runtime.testRunId.trim() === openRun.testRunId,
          actionLabel: "Open In Runtime",
          actionPayload: {
            loginKey: openRun.loginKey,
            groupKey: openRun.groupKey,
            bookletKey: openRun.bookletKey,
            participantSessionId,
            testRunId: openRun.testRunId,
            currentUnitKey: openRun.currentUnitKey ?? ""
          }
        };
      }) ?? []
    );
  }

  get activationGuardItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument(this.content.activationGuardView);
    const status = readStringValue(payload, ["status"]);
    if (!payload || !status) {
      return [];
    }

    const contentReleaseId =
      readStringValue(payload, ["contentReleaseId"]) ??
      readStringValue(payload, ["attemptedContentReleaseId"]) ??
      "unknown release";
    const activeContentReleaseId =
      readStringValue(payload, ["activeContentReleaseId"]) ?? "none";
    const previousActiveContentReleaseId =
      readStringValue(payload, ["previousActiveContentReleaseId"]) ?? "none";
    const supersededOpenRunCount =
      readNumberValue(payload, ["supersededOpenRunCount"]) ??
      readNumberValue(payload, ["openRunCount"]) ??
      0;
    const forceActivation = readUnknownValue(payload, ["forceActivation"]) === true;

    return [
      {
        headline:
          status === "activated"
            ? "Activation completed"
            : status === "blocked"
              ? "Activation blocked"
              : "Activation readiness",
        subline: contentReleaseId,
        badges: [
          status,
          forceActivation ? "force" : "guarded",
          `${supersededOpenRunCount} open run(s)`
        ],
        rows: [
          { label: "Content Release", value: contentReleaseId },
          { label: "Active Release", value: activeContentReleaseId },
          { label: "Previous Active", value: previousActiveContentReleaseId },
          {
            label: "Open Runs",
            value: String(supersededOpenRunCount)
          },
          {
            label: "Force Activation",
            value: forceActivation ? "enabled" : "disabled"
          }
        ],
        selected: this.content.contentReleaseId.trim() === contentReleaseId,
        actionLabel: contentReleaseId === "unknown release" ? undefined : "Select Release",
        actionPayload:
          contentReleaseId === "unknown release" ? undefined : { contentReleaseId }
      }
    ];
  }

  get contentReleaseDetailItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetContentReleaseResponse>(
      this.content.contentReleaseDetailView
    );
    const detail = payload?.contentReleaseDetail;
    if (!detail) {
      return [];
    }
    return [
      {
        headline: detail.contentRelease.releaseLabel,
        subline: detail.contentRelease.contentReleaseId,
        badges: [
          detail.contentRelease.status,
          `${detail.participantSessions.length} session(s)`,
          `${detail.testRuns.length} run(s)`
        ],
        rows: [
          {
            label: "Previous Active",
            value: detail.previousActivatedContentReleaseId ?? "none"
          },
          {
            label: "Next Active",
            value: detail.nextActivatedContentReleaseId ?? "none"
          }
        ],
        selected:
          this.content.contentReleaseId.trim() ===
          detail.contentRelease.contentReleaseId,
        actionLabel: "Select + Load",
        actionPayload: {
          contentReleaseId: detail.contentRelease.contentReleaseId
        }
      }
    ];
  }

  get contentReleaseLineageItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetContentReleaseResponse>(
      this.content.contentReleaseDetailView
    );
    const detail = payload?.contentReleaseDetail;
    if (!detail) {
      return [];
    }

    const items: RecordCollectionItem[] = [];
    if (detail.importJob) {
      items.push({
        headline: detail.importJob.importJobId,
        subline: "Import job",
        badges: ["import", detail.importJob.status],
        rows: [
          {
            label: "Created",
            value: this.formatDateTime(detail.importJob.createdAt)
          },
          {
            label: "Diagnostics",
            value: detail.importJob.diagnostics.length
              ? detail.importJob.diagnostics.map(diagnostic => diagnostic.code).join(", ")
              : "none"
          }
        ],
        selected: this.content.importJobId.trim() === detail.importJob.importJobId,
        actionLabel: "Open Import",
        actionPayload: {
          targetType: "import_job",
          importJobId: detail.importJob.importJobId,
          sourcePackageId: detail.sourcePackage?.sourcePackageId ?? "",
          contentReleaseId: detail.contentRelease.contentReleaseId
        }
      });
    }

    if (detail.sourcePackage) {
      items.push({
        headline: detail.sourcePackage.fileName,
        subline: detail.sourcePackage.sourcePackageId,
        badges: ["source package", detail.sourcePackage.status],
        rows: [
          {
            label: "Media Type",
            value: detail.sourcePackage.mediaType
          },
          {
            label: "Uploaded",
            value: this.formatDateTime(detail.sourcePackage.uploadedAt)
          }
        ],
        selected:
          this.content.sourcePackageId.trim() === detail.sourcePackage.sourcePackageId,
        actionLabel: "Open Package",
        actionPayload: {
          targetType: "source_package",
          sourcePackageId: detail.sourcePackage.sourcePackageId,
          sourceFileName: detail.sourcePackage.fileName,
          sourceMediaType: detail.sourcePackage.mediaType
        }
      });
    }

    if (detail.previousActivatedContentReleaseId) {
      items.push({
        headline: detail.previousActivatedContentReleaseId,
        subline: "Previous activated release",
        badges: ["release lineage"],
        rows: [
          {
            label: "Direction",
            value: "previous"
          }
        ],
        selected:
          this.content.contentReleaseId.trim() ===
          detail.previousActivatedContentReleaseId,
        actionLabel: "Open Release",
        actionPayload: {
          targetType: "content_release",
          contentReleaseId: detail.previousActivatedContentReleaseId
        }
      });
    }

    if (detail.nextActivatedContentReleaseId) {
      items.push({
        headline: detail.nextActivatedContentReleaseId,
        subline: "Next activated release",
        badges: ["release lineage"],
        rows: [
          {
            label: "Direction",
            value: "next"
          }
        ],
        selected:
          this.content.contentReleaseId.trim() === detail.nextActivatedContentReleaseId,
        actionLabel: "Open Release",
        actionPayload: {
          targetType: "content_release",
          contentReleaseId: detail.nextActivatedContentReleaseId
        }
      });
    }

    return items;
  }

	  get contentReleaseRuntimeSnapshotItems(): RecordCollectionItem[] {
	    const payload = parseJsonDocument<GetContentReleaseResponse>(
	      this.content.contentReleaseDetailView
	    );
	    const detail = payload?.contentReleaseDetail;
    return (
      detail?.contentRelease.runtimeSnapshot.bookletEntries.map(booklet => ({
        headline: booklet.displayLabel,
        subline: booklet.bookletKey,
        badges: [`${booklet.unitEntries.length} unit(s)`],
	        rows: [
	          {
	            label: "Unit Keys",
	            value: booklet.unitEntries.map(unit => unit.unitKey).join(", ") || "none"
	          },
	          {
	            label: "Unit Labels",
	            value:
	              booklet.unitEntries.map(unit => unit.displayLabel).join(" | ") || "none"
	          },
	          {
	            label: "Prompt Coverage",
	            value: this.formatUnitPromptCoverage(booklet.unitEntries)
	          },
	          {
	            label: "Unit Prompts",
	            value: this.formatUnitPromptPreview(booklet.unitEntries)
	          }
	        ],
	        selected: false
	      })) ?? []
	    );
	  }

	  private formatUnitPromptCoverage(
	    unitEntries: Array<{
	      description?: string | null;
	      content?: string | null;
	    }>
	  ): string {
	    const describedCount = unitEntries.filter(unit => unit.description?.trim()).length;
	    const promptCount = unitEntries.filter(unit => unit.content?.trim()).length;
	    return `${promptCount} / ${unitEntries.length} prompt(s), ${describedCount} / ${unitEntries.length} description(s)`;
	  }

	  private formatUnitPromptPreview(
	    unitEntries: Array<{
	      unitKey: string;
	      displayLabel?: string | null;
	      description?: string | null;
	      content?: string | null;
	    }>
	  ): string {
	    const previews = unitEntries
	      .map(unit => {
	        const description = unit.description?.trim();
	        const content = unit.content?.trim();
	        if (!description && !content) {
	          return "";
	        }
	        const label = unit.displayLabel?.trim() || unit.unitKey;
	        const parts = [description, content].filter(Boolean).join(" - ");
	        return `${label}: ${this.truncateText(parts, 120)}`;
	      })
	      .filter(Boolean);
	    return previews.join(" | ") || "none";
	  }

	  private truncateText(value: string, maxLength: number): string {
	    const normalized = value.replace(/\s+/g, " ").trim();
	    return normalized.length > maxLength
	      ? `${normalized.slice(0, Math.max(maxLength - 1, 0))}...`
	      : normalized;
	  }

  get contentReleaseHistoryItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetContentReleaseResponse>(
      this.content.contentReleaseDetailView
    );
    return (
      payload?.contentReleaseDetail.workspaceReleaseHistory.map(item => ({
        headline: item.contentRelease.releaseLabel,
        subline: item.contentRelease.contentReleaseId,
        badges: [item.contentRelease.status, `${item.openTestRunCount} open run(s)`],
        rows: [
          { label: "Sessions", value: String(item.participantSessionCount) },
          {
            label: "Source",
            value: item.sourcePackage?.fileName ?? "unknown"
          }
        ],
        selected:
          this.content.contentReleaseId.trim() === item.contentRelease.contentReleaseId,
        actionLabel: "Select + Load",
        actionPayload: {
          contentReleaseId: item.contentRelease.contentReleaseId
        }
      })) ?? []
    );
  }

  get contentReleaseParticipantSessionItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetContentReleaseResponse>(
      this.content.contentReleaseDetailView
    );
    const detail = payload?.contentReleaseDetail;
    const rosterEntriesByLoginKey = new Map(
      detail?.participantRosterEntries.map(entry => [entry.loginKey, entry]) ?? []
    );
    return (
      detail?.participantSessions.map(participantSession => {
        const rosterEntry = rosterEntriesByLoginKey.get(participantSession.loginKey);
        const displayName = rosterEntry?.displayName;
        return {
          headline: displayName ?? participantSession.loginKey,
          subline: displayName
            ? participantSession.loginKey
            : participantSession.participantSessionId,
          badges: [
            participantSession.status,
            participantSession.groupKey,
            rosterEntry ? "roster" : "ad hoc"
          ],
          rows: [
            {
              label: "Session",
              value: participantSession.participantSessionId
            },
            ...this.participantSessionLinkRows(
              participantSession.participantSessionId,
              {
                loginKey: participantSession.loginKey,
                groupKey: participantSession.groupKey,
                bookletKey: rosterEntry?.bookletKey
              }
            ),
            {
              label: "Booklet",
              value: rosterEntry?.bookletKey ?? "none"
            },
            {
              label: "Created",
              value: this.formatDateTime(participantSession.createdAt)
            },
            {
              label: "Release",
              value: detail.contentRelease.releaseLabel
            }
          ],
          selected:
            this.uiState.runtime.participantSessionId.trim() ===
            participantSession.participantSessionId,
          actionLabel: "Open In Runtime",
          actionPayload: {
            participantSessionId: participantSession.participantSessionId,
            loginKey: participantSession.loginKey,
            groupKey: participantSession.groupKey,
            bookletKey: detail.participantRosterEntries.find(
              entry => entry.loginKey === participantSession.loginKey
            )?.bookletKey ?? ""
          }
        };
      }) ?? []
    );
  }

  get contentReleaseTestRunItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetContentReleaseResponse>(
      this.content.contentReleaseDetailView
    );
    const detail = payload?.contentReleaseDetail;
    const rosterEntriesByLoginKey = new Map(
      detail?.participantRosterEntries.map(entry => [entry.loginKey, entry]) ?? []
    );
    return (
      detail?.testRuns.map(testRun => {
        const matchingParticipantSession = detail.participantSessions.find(
          participantSession =>
            participantSession.participantSessionId === testRun.participantSessionId
        );
        const rosterEntry = matchingParticipantSession
          ? rosterEntriesByLoginKey.get(matchingParticipantSession.loginKey)
          : undefined;
        const displayName = rosterEntry?.displayName;
        return {
          headline: displayName ?? matchingParticipantSession?.loginKey ?? testRun.testRunId,
          subline: displayName
            ? matchingParticipantSession?.loginKey ?? testRun.participantSessionId
            : testRun.testRunId,
          badges: [
            testRun.status,
            testRun.bookletKey,
            rosterEntry ? "roster" : "ad hoc"
          ],
          rows: [
            {
              label: "Run",
              value: testRun.testRunId
            },
            {
              label: "Participant Session",
              value: testRun.participantSessionId
            },
            ...this.participantSessionLinkRows(testRun.participantSessionId, {
              loginKey: matchingParticipantSession?.loginKey,
              groupKey: matchingParticipantSession?.groupKey,
              bookletKey: testRun.bookletKey
            }),
            {
              label: "Current Unit",
              value: testRun.currentUnitKey ?? "none"
            },
            {
              label: "Updated",
              value: this.formatDateTime(testRun.updatedAt)
            }
          ],
          selected: this.uiState.runtime.testRunId.trim() === testRun.testRunId,
          actionLabel: "Open In Runtime",
          actionPayload: {
            participantSessionId: testRun.participantSessionId,
            loginKey: matchingParticipantSession?.loginKey ?? "",
            groupKey: matchingParticipantSession?.groupKey ?? "",
            bookletKey: testRun.bookletKey,
            testRunId: testRun.testRunId,
            currentUnitKey: testRun.currentUnitKey ?? ""
          }
        } satisfies RecordCollectionItem;
      }) ?? []
    );
  }

  selectSourcePackage(item: RecordCollectionItem): void {
    const sourcePackageId = item.actionPayload?.sourcePackageId?.trim();
    if (!sourcePackageId) {
      return;
    }

    this.content.sourcePackageId = sourcePackageId;
    if (item.actionPayload?.sourceFileName) {
      this.content.sourceFileName = item.actionPayload.sourceFileName;
    }
    if (item.actionPayload?.sourceMediaType) {
      this.content.sourceMediaType = item.actionPayload.sourceMediaType;
    }
    this.persistState();
    this.viewState.onActionAsync(() => this.contentService.loadSourcePackageDetail());
  }

  selectImportJob(item: RecordCollectionItem): void {
    const importJobId = item.actionPayload?.importJobId?.trim();
    if (!importJobId) {
      return;
    }

    this.content.importJobId = importJobId;
    if (item.actionPayload?.sourcePackageId?.trim()) {
      this.content.sourcePackageId = item.actionPayload.sourcePackageId.trim();
    }
    if (item.actionPayload?.contentReleaseId?.trim()) {
      this.content.contentReleaseId = item.actionPayload.contentReleaseId.trim();
    }
    this.persistState();
    this.viewState.onActionAsync(() => this.contentService.loadImportJobDetail());
  }

  selectContentRelease(item: RecordCollectionItem): void {
    const contentReleaseId = item.actionPayload?.contentReleaseId?.trim();
    if (!contentReleaseId) {
      return;
    }

    this.content.contentReleaseId = contentReleaseId;
    this.persistState();
    this.viewState.onActionAsync(async () => {
      await this.contentService.loadContentReleaseActivationReadiness();
      await this.contentService.loadContentReleaseDetail();
    });
  }

  openLinkedDetail(item: RecordCollectionItem): void {
    switch (item.actionPayload?.targetType) {
      case "source_package":
        this.selectSourcePackage(item);
        return;
      case "import_job":
        this.selectImportJob(item);
        return;
      case "content_release":
        this.selectContentRelease(item);
        return;
      default:
        return;
    }
  }

  openRosterWarningInRuntime(item: RecordCollectionItem): void {
    const loginKey = item.actionPayload?.loginKey?.trim();
    if (!loginKey) {
      return;
    }

    const runtime = this.uiState.runtime;
    runtime.loginKey = loginKey;
    runtime.groupKey = item.actionPayload?.groupKey?.trim() || `group:${loginKey}`;
    runtime.bookletKey = item.actionPayload?.bookletKey?.trim() ?? "";
    runtime.participantSessionId = "";
    runtime.testRunId = "";
    runtime.currentUnitKey = "";

    this.persistState();
    this.feedback.rememberActivity(
      "Roster Warning Opened",
      `Prepared runtime launch context for ${loginKey}.`
    );
    void this.router.navigateByUrl("/runtime");
  }

  private seedRuntimeRunInspectionFilters(input: {
    loginKey: string;
    groupKey: string;
    bookletKey: string;
    participantSessionId: string;
    testRunId: string;
    currentUnitKey: string;
  }): void {
    const runtime = this.uiState.runtime;
    const loginKey = input.loginKey.trim();
    const groupKey = input.groupKey.trim();
    const bookletKey = input.bookletKey.trim();
    const participantSessionId = input.participantSessionId.trim();
    const testRunId = input.testRunId.trim();
    const currentUnitKey = input.currentUnitKey.trim();

    runtime.detailedResponseLoginFilter = loginKey;
    runtime.detailedResponseGroupFilter = groupKey;
    runtime.detailedResponseBookletFilter = bookletKey;
    runtime.detailedResponseSessionFilter = participantSessionId;
    runtime.detailedResponseRunFilter = testRunId;
    runtime.detailedResponseUnitFilter = currentUnitKey;
    runtime.detailedResponseStatusFilter = "";
    runtime.reviewLoginFilter = loginKey;
    runtime.reviewGroupFilter = groupKey;
    runtime.reviewBookletFilter = bookletKey;
    runtime.reviewSessionFilter = participantSessionId;
    runtime.reviewRunFilter = testRunId;
    runtime.reviewUnitFilter = currentUnitKey;
    runtime.reviewReviewerFilter = "";
    runtime.reviewCategoryFilter = "";
    runtime.openRunLoginFilter = loginKey;
    runtime.openRunGroupFilter = groupKey;
    runtime.openRunBookletFilter = bookletKey;
    runtime.openRunSessionFilter = participantSessionId;
    runtime.openRunRunFilter = testRunId;
    runtime.openRunUnitFilter = currentUnitKey;
    runtime.openRunStatusFilter = "";
  }

  openBlockingRunInRuntime(item: RecordCollectionItem): void {
    const loginKey = item.actionPayload?.loginKey?.trim();
    const testRunId = item.actionPayload?.testRunId?.trim();
    if (!loginKey || !testRunId) {
      return;
    }

    const runtime = this.uiState.runtime;
    runtime.loginKey = loginKey;
    if (item.actionPayload?.groupKey?.trim()) {
      runtime.groupKey = item.actionPayload.groupKey.trim();
    }
    if (item.actionPayload?.bookletKey != null) {
      runtime.bookletKey = item.actionPayload.bookletKey;
    }
    runtime.testRunId = testRunId;
    runtime.currentUnitKey = item.actionPayload?.currentUnitKey ?? "";

    const participantSessionId =
      item.actionPayload?.participantSessionId?.trim() ||
      this.findParticipantSessionIdByLoginKey(loginKey);
    if (participantSessionId) {
      runtime.participantSessionId = participantSessionId;
    }
    this.seedRuntimeRunInspectionFilters({
      loginKey: runtime.loginKey,
      groupKey: runtime.groupKey,
      bookletKey: runtime.bookletKey,
      participantSessionId: runtime.participantSessionId,
      testRunId: runtime.testRunId,
      currentUnitKey: runtime.currentUnitKey
    });

    this.persistState();
    void this.router.navigateByUrl("/runtime");
    if (!runtime.participantSessionId.trim()) {
      return;
    }

    this.viewState.onActionAsync(async () => {
      await this.runtimeService.loadParticipantSessionDetail();
      await this.runtimeService.refreshRuntimeReads(true);
    });
  }

  openParticipantSessionInRuntime(item: RecordCollectionItem): void {
    const participantSessionId = item.actionPayload?.participantSessionId?.trim();
    if (!participantSessionId) {
      return;
    }

    const runtime = this.uiState.runtime;
    runtime.participantSessionId = participantSessionId;
    runtime.testRunId = "";
    runtime.currentUnitKey = "";
    if (item.actionPayload?.loginKey?.trim()) {
      runtime.loginKey = item.actionPayload.loginKey.trim();
    }
    if (item.actionPayload?.groupKey?.trim()) {
      runtime.groupKey = item.actionPayload.groupKey.trim();
    }
    if (item.actionPayload?.bookletKey != null) {
      runtime.bookletKey = item.actionPayload.bookletKey;
    }
    this.seedRuntimeRunInspectionFilters({
      loginKey: runtime.loginKey,
      groupKey: runtime.groupKey,
      bookletKey: runtime.bookletKey,
      participantSessionId: runtime.participantSessionId,
      testRunId: runtime.testRunId,
      currentUnitKey: runtime.currentUnitKey
    });

    this.persistState();
    void this.router.navigateByUrl("/runtime");
    this.viewState.onActionAsync(async () => {
      await this.runtimeService.loadParticipantSessionDetail();
      await this.runtimeService.refreshRuntimeReads(true);
    });
  }

  openTestRunInRuntime(item: RecordCollectionItem): void {
    const participantSessionId = item.actionPayload?.participantSessionId?.trim();
    const testRunId = item.actionPayload?.testRunId?.trim();
    if (!participantSessionId || !testRunId) {
      return;
    }

    const runtime = this.uiState.runtime;
    runtime.participantSessionId = participantSessionId;
    runtime.testRunId = testRunId;
    runtime.currentUnitKey = item.actionPayload?.currentUnitKey ?? "";
    if (item.actionPayload?.loginKey?.trim()) {
      runtime.loginKey = item.actionPayload.loginKey.trim();
    }
    if (item.actionPayload?.groupKey?.trim()) {
      runtime.groupKey = item.actionPayload.groupKey.trim();
    }
    if (item.actionPayload?.bookletKey != null) {
      runtime.bookletKey = item.actionPayload.bookletKey;
    }

    this.persistState();
    void this.router.navigateByUrl("/runtime");
    this.viewState.onActionAsync(async () => {
      await this.runtimeService.loadParticipantSessionDetail();
      await this.runtimeService.refreshRuntimeReads(true);
    });
  }

  createSourcePackage(): void {
    if (!this.canCreateSourcePackage) {
      return;
    }
    this.viewState.onActionAsync(() => this.contentService.createSourcePackage());
  }

  createImportJob(): void {
    if (!this.canCreateImportJob) {
      return;
    }
    this.viewState.onActionAsync(() => this.contentService.createImportJob());
  }

  confirmActivateContentRelease(): void {
    const releaseId = this.content.contentReleaseId.trim();
    if (!this.canUseSelectedContentRelease) {
      return;
    }
    if (!this.content.forceActivation) {
      this.activateContentRelease();
      return;
    }
    const confirmed = globalThis.window?.confirm(
      `Force activate release '${releaseId || "selected release"}' and supersede open participant runs?`
    );
    if (confirmed) {
      this.activateContentRelease();
    }
  }

  private activateContentRelease(): void {
    this.viewState.onActionAsync(() => this.contentService.activateContentRelease());
  }

  refreshContentReads(): void {
    if (!this.canUseWorkspaceScope) {
      return;
    }
    this.viewState.onActionAsync(() => this.contentService.refreshContentReads());
  }

  getSourcePackageDetail(): void {
    if (!this.canUseSelectedSourcePackage) {
      return;
    }
    this.viewState.onActionAsync(() => this.contentService.loadSourcePackageDetail());
  }

  getImportJobDetail(): void {
    if (!this.canUseSelectedImportJob) {
      return;
    }
    this.viewState.onActionAsync(() => this.contentService.loadImportJobDetail());
  }

  getParticipantSessionDetail(): void {
    if (!this.canUseSelectedParticipantSession) {
      return;
    }
    this.viewState.onActionAsync(() => this.runtimeService.loadParticipantSessionDetail());
  }

  getContentReleaseActivationReadiness(): void {
    if (!this.canUseSelectedContentRelease) {
      return;
    }
    this.viewState.onActionAsync(() =>
      this.contentService.loadContentReleaseActivationReadiness()
    );
  }

  getContentReleaseDetail(): void {
    if (!this.canUseSelectedContentRelease) {
      return;
    }
    this.viewState.onActionAsync(() => this.contentService.loadContentReleaseDetail());
  }

  downloadSelectedSourceDocument(): void {
    if (!this.canUseSelectedSourcePackage) {
      return;
    }
    this.viewState.onActionAsync(async () => {
      const payload = await this.resolveSourcePackageDetailForDownload();
      const sourcePackage = payload.sourcePackageDetail.sourcePackage;
      const sourceDocument = sourcePackage.sourceDocument ?? "";
      const filename = sourcePackage.fileName.trim() || "source-document.txt";
      const mediaType = sourcePackage.mediaType.trim() || "text/plain";

      if (!sourceDocument.trim()) {
        this.feedback.rememberActivity(
          "Source Document Download Skipped",
          `${filename} has no persisted source document to download.`
        );
        return;
      }

      const downloadedFromDataUrl = downloadDataUrlFile({
        filename,
        dataUrl: sourceDocument
      });
      if (!downloadedFromDataUrl) {
        downloadTextFile({
          filename,
          mediaType,
          text: sourceDocument
        });
      }
      this.feedback.rememberActivity(
        "Source Document Downloaded",
        `${filename} downloaded from the selected source package.`
      );
    });
  }

  retrySourcePackageImport(): void {
    if (!this.canRetrySourcePackageImport) {
      return;
    }
    this.viewState.onActionAsync(() => this.contentService.retrySourcePackageImport());
  }

  runContentSuggestion(item: RecordCollectionItem): void {
    switch (item.actionPayload?.contentCommand) {
      case "createSourcePackage":
        this.createSourcePackage();
        break;
      case "createImportJob":
        this.createImportJob();
        break;
      case "activateContentRelease":
        this.confirmActivateContentRelease();
        break;
      case "loadSourcePackageDetail":
        this.getSourcePackageDetail();
        break;
      case "loadImportJobDetail":
        this.getImportJobDetail();
        break;
      case "loadReleaseReadiness":
        this.getContentReleaseActivationReadiness();
        break;
      case "loadContentReleaseDetail":
        this.getContentReleaseDetail();
        break;
      case "retrySourcePackageImport":
        this.retrySourcePackageImport();
        break;
      case "openBlockingRunInRuntime":
        this.openBlockingRunInRuntime(item);
        break;
      case "refreshContentReads":
      default:
        this.refreshContentReads();
        break;
    }
  }

  bootstrapWorkspaceFlow(): void {
    this.viewState.onActionAsync(() => this.workspaceService.bootstrapWorkspaceFlow());
  }

  importActivateFlow(): void {
    this.viewState.onActionAsync(() => this.contentService.importActivateFlow());
  }

  blockedActivationFlow(): void {
    this.viewState.onActionAsync(() => this.contentService.blockedActivationFlow());
  }

  private findParticipantSessionIdByLoginKey(loginKey: string): string | null {
    const payload = parseJsonDocument<ListParticipantSessionsResponse>(
      this.uiState.runtime.participantSessionsView
    );
    const matchingItem = payload?.items.find(
      item => item.participantSession.loginKey === loginKey
    );
    return matchingItem?.participantSession.participantSessionId ?? null;
  }

  private isWorkspaceScopeComplete(): boolean {
    return (
      this.uiState.workspace.tenantKey.trim() !== "" &&
      this.uiState.workspace.workspaceKey.trim() !== ""
    );
  }

  private hasSelectedFailedSourcePackageContext(): boolean {
    const selectedSourcePackageId = this.content.sourcePackageId.trim();
    if (!selectedSourcePackageId) {
      return false;
    }

    const sourcePackageDetail = parseJsonDocument<GetSourcePackageResponse>(
      this.content.sourcePackageDetailView
    )?.sourcePackageDetail;
    if (
      sourcePackageDetail?.sourcePackage.sourcePackageId === selectedSourcePackageId &&
      (sourcePackageDetail.sourcePackage.status === "rejected" ||
        sourcePackageDetail.importJobs.some(importJob => importJob.status === "failed"))
    ) {
      return true;
    }

    const importJobDetail = parseJsonDocument<GetImportJobResponse>(
      this.content.importJobDetailView
    )?.importJobDetail;
    return (
      importJobDetail?.importJob.status === "failed" &&
      importJobDetail.sourcePackage?.sourcePackageId === selectedSourcePackageId
    );
  }

  private inferSourceDocumentKind(mediaType: string, sourceDocument: string): string {
    const normalizedMediaType = mediaType.toLowerCase();
    if (this.isZipSourceDocument(mediaType, sourceDocument)) {
      return "ZIP package source document";
    }
    if (normalizedMediaType.includes("json") || sourceDocument.trim().startsWith("{")) {
      return "JSON source document";
    }
    if (normalizedMediaType.includes("xml") || sourceDocument.trim().startsWith("<")) {
      return "XML source document";
    }
    return "Text source document";
  }

  private async resolveSourcePackageDetailForDownload(): Promise<GetSourcePackageResponse> {
    const selectedSourcePackageId = this.content.sourcePackageId.trim();
    const existingPayload = parseJsonDocument<GetSourcePackageResponse>(
      this.content.sourcePackageDetailView
    );
    const existingSourcePackage =
      existingPayload?.sourcePackageDetail.sourcePackage ?? null;

    if (
      existingPayload &&
      existingSourcePackage &&
      (!selectedSourcePackageId ||
        existingSourcePackage.sourcePackageId === selectedSourcePackageId)
    ) {
      return existingPayload;
    }

    return this.contentService.loadSourcePackageDetail();
  }

  private buildReadWindowItem(
    headline: string,
    recordLabel: string,
    loadedCount: number,
    limit: string,
    activeFilters: string[]
  ): RecordCollectionItem {
    return {
      headline,
      subline: `${loadedCount} ${recordLabel} row(s) loaded for the current filters`,
      badges: [`${activeFilters.length} active filter(s)`, `limit ${limit}`],
      rows: [
        { label: "Loaded Records", value: String(loadedCount) },
        { label: "Limit", value: limit },
        {
          label: "Active Filters",
          value: activeFilters.length > 0 ? activeFilters.join(", ") : "none"
        }
      ]
    };
  }

  private inferMediaTypeFromFile(file: File): string {
    const normalizedName = file.name.toLowerCase();
    if (this.isZipSourceFile(file)) {
      return "application/zip";
    }
    if (normalizedName.endsWith(".json")) {
      return "application/json";
    }
    if (
      normalizedName.endsWith(".xml") ||
      normalizedName.endsWith(".imsmanifest") ||
      normalizedName.endsWith(".manifest")
    ) {
      return "application/xml";
    }
    return file.type || this.content.sourceMediaType.trim() || "text/plain";
  }

  private isZipSourceFile(file: File): boolean {
    const normalizedName = file.name.toLowerCase();
    const normalizedType = file.type.toLowerCase();
    return (
      normalizedName.endsWith(".zip") ||
      normalizedType.includes("zip")
    );
  }

  private readFileAsDataUrl(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.addEventListener("load", () => {
        resolve(typeof reader.result === "string" ? reader.result : "");
      });
      reader.addEventListener("error", () => {
        reject(reader.error ?? new Error(`Could not read ${file.name}.`));
      });
      reader.readAsDataURL(file);
    });
  }

  private isZipSourceDocument(mediaType: string, sourceDocument: string): boolean {
    const normalizedMediaType = mediaType.toLowerCase();
    const trimmedDocument = sourceDocument.trim();
    return (
      normalizedMediaType.includes("zip") ||
      trimmedDocument.startsWith("data:application/zip;base64,") ||
      trimmedDocument.startsWith("data:application/x-zip-compressed;base64,")
    );
  }

  private estimateSourceDocumentBookletCount(
    mediaType: string,
    sourceDocument: string
  ): number | null {
    const trimmedDocument = sourceDocument.trim();
    if (!trimmedDocument) {
      return null;
    }
    if (this.isZipSourceDocument(mediaType, sourceDocument)) {
      return null;
    }

    const normalizedMediaType = mediaType.toLowerCase();
    if (normalizedMediaType.includes("xml") || trimmedDocument.startsWith("<")) {
      const primaryBookletCount = Array.from(
        trimmedDocument.matchAll(
          /<(?:[a-zA-Z_][\w.-]*:)?(?:booklet|assessmentTest|assessment-test)\b/gi
        )
      ).length;
      if (primaryBookletCount > 0) {
        return primaryBookletCount;
      }
      const testletCount = Array.from(
        trimmedDocument.matchAll(
          /<(?:[a-zA-Z_][\w.-]*:)?testlet\b/gi
        )
      ).length;
      if (testletCount > 0) {
        return testletCount;
      }
      return Array.from(
        trimmedDocument.matchAll(/<(?:[a-zA-Z_][\w.-]*:)?test\b/gi)
      ).length;
    }

    if (normalizedMediaType.includes("json") || trimmedDocument.startsWith("{")) {
      try {
        return this.countJsonBookletHints(JSON.parse(trimmedDocument));
      } catch {
        return null;
      }
    }

    return null;
  }

  private countJsonBookletHints(value: unknown, depth = 0): number {
    if (depth > 8 || value == null || typeof value !== "object") {
      return 0;
    }

    if (Array.isArray(value)) {
      return value.reduce(
        (total, item) => total + this.countJsonBookletHints(item, depth + 1),
        0
      );
    }

    const objectValue = value as Record<string, unknown>;
    const directBookletKeys = [
      "bookletEntries",
      "booklets",
      "testlets",
      "assessmentTests",
      "assessment-tests"
    ];
    const directCount = directBookletKeys.reduce((total, key) => {
      const candidate = objectValue[key];
      if (Array.isArray(candidate)) {
        return total + candidate.length;
      }
      return candidate && typeof candidate === "object" ? total + 1 : total;
    }, 0);

    if (directCount > 0) {
      return directCount;
    }

    const nestedContainerKeys = [
      "contentStructure",
      "manifest",
      "assessment",
      "assessments",
      "testcenter",
      "packageManifest",
      "contentPackage",
      "package",
      "packages",
      "tests",
      "test",
      "testSuites",
      "testSuite"
    ];
    return nestedContainerKeys.reduce(
      (total, key) =>
        total + this.countJsonBookletHints(objectValue[key], depth + 1),
      0
    );
  }

  private formatDateTime(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }
}
