import { Injectable, inject } from "@angular/core";
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
  readStringValue,
  readUnknownValue
} from "./rewrite-app-shell.readers";
import type { RecordCollectionItem } from "./record-collection.component";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";
import { RewriteAppContentService } from "./rewrite-app-content.service";
import { RewriteAppRuntimeService } from "./rewrite-app-runtime.service";
import { RewriteAppViewStateService } from "./rewrite-app-view-state.service";
import { RewriteAppWorkspaceService } from "./rewrite-app-workspace.service";

@Injectable({ providedIn: "root" })
export class ContentViewFacade {
  private readonly uiState = inject(RewriteAppUiStateService);
  private readonly contentService = inject(RewriteAppContentService);
  private readonly runtimeService = inject(RewriteAppRuntimeService);
  private readonly viewState = inject(RewriteAppViewStateService);
  private readonly workspaceService = inject(RewriteAppWorkspaceService);
  private readonly router = inject(Router);

  readonly content = this.uiState.content;
  readonly sourcePackageStatusOptions = sourcePackageStatuses;
  readonly importJobStatusOptions = importJobStatuses;
  readonly contentReleaseStatusOptions = contentReleaseStatuses;

  init(): void {
    this.viewState.setActiveView("content");
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
    this.viewState.onActionAsync(() => this.contentService.refreshContentReads());
  }

  useSelectedIdsAsContentReadFilters(): void {
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
    this.persistState();
    this.refreshContentReads();
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
    return payload?.items.map(item => ({
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
    })) ?? [];
  }

  get importJobItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ListImportJobsResponse>(this.content.importJobsView);
    return payload?.items.map(item => ({
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
            this.content.importJobId.trim() === item.importJob.importJobId ? "yes" : "no"
        }
      ],
      selected: this.content.importJobId.trim() === item.importJob.importJobId,
      actionLabel: "Select + Load",
      actionPayload: {
        importJobId: item.importJob.importJobId,
        sourcePackageId: item.sourcePackage?.sourcePackageId ?? ""
      }
    })) ?? [];
  }

  get contentReleaseItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ListContentReleasesResponse>(
      this.content.contentReleasesView
    );
    return payload?.items.map(item => ({
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
    })) ?? [];
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
          }
        ],
        selected: false
      })) ?? []
    );
  }

  get sourceDocumentPreviewItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetSourcePackageResponse>(
      this.content.sourcePackageDetailView
    );
    const sourcePackage = payload?.sourcePackageDetail.sourcePackage;
    const sourceDocument = sourcePackage?.sourceDocument?.trim();
    if (!sourcePackage || !sourceDocument) {
      return [];
    }

    const normalizedPreview = sourceDocument.replace(/\s+/g, " ").trim();
    const preview =
      normalizedPreview.length > 180
        ? `${normalizedPreview.slice(0, 177)}...`
        : normalizedPreview;
    const lineCount = sourceDocument.split(/\r?\n/).length;
    const bookletCount = sourcePackage.contentStructure?.bookletEntries.length ?? 0;
    const documentKind = this.inferSourceDocumentKind(
      sourcePackage.mediaType,
      sourceDocument
    );

    return [
      {
        headline: sourcePackage.fileName,
        subline: documentKind,
        badges: [
          `${sourceDocument.length} chars`,
          `${lineCount} line(s)`,
          `${bookletCount} booklet(s)`
        ],
        rows: [
          {
            label: "Media Type",
            value: sourcePackage.mediaType
          },
          {
            label: "Status",
            value: sourcePackage.status
          },
          {
            label: "Preview",
            value: preview
          }
        ],
        selected: true
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
    return [
      {
        headline: detail.contentRelease.releaseLabel,
        subline: detail.contentRelease.contentReleaseId,
        badges: [
          detail.canActivate ? "can activate" : "blocked",
          `${detail.blockingOpenRuns.length} open run(s)`
        ],
        rows: [
          {
            label: "Current Active Release",
            value: detail.activeContentReleaseId ?? "none"
          },
          {
            label: "Status",
            value: detail.contentRelease.status
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

  get activationBlockingRunItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetContentReleaseActivationReadinessResponse>(
      this.content.contentReleaseActivationReadinessView
    );
    return (
      payload?.activationReadiness.blockingOpenRuns.map(openRun => ({
        headline: openRun.loginKey,
        subline: openRun.testRunId,
        badges: [openRun.status, openRun.groupKey],
        rows: [
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
          testRunId: openRun.testRunId,
          currentUnitKey: openRun.currentUnitKey ?? ""
        }
      })) ?? []
    );
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
          }
        ],
        selected: false
      })) ?? []
    );
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
    return (
      detail?.participantSessions.map(participantSession => ({
        headline: participantSession.loginKey,
        subline: participantSession.participantSessionId,
        badges: [participantSession.status, participantSession.groupKey],
        rows: [
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
          loginKey: participantSession.loginKey
        }
      })) ?? []
    );
  }

  get contentReleaseTestRunItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetContentReleaseResponse>(
      this.content.contentReleaseDetailView
    );
    const detail = payload?.contentReleaseDetail;
    return (
      detail?.testRuns.map(testRun => {
        const matchingParticipantSession = detail.participantSessions.find(
          participantSession =>
            participantSession.participantSessionId === testRun.participantSessionId
        );
        return {
          headline: testRun.testRunId,
          subline: matchingParticipantSession?.loginKey ?? testRun.participantSessionId,
          badges: [testRun.status, testRun.bookletKey],
          rows: [
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

  openBlockingRunInRuntime(item: RecordCollectionItem): void {
    const loginKey = item.actionPayload?.loginKey?.trim();
    const testRunId = item.actionPayload?.testRunId?.trim();
    if (!loginKey || !testRunId) {
      return;
    }

    const runtime = this.uiState.runtime;
    runtime.loginKey = loginKey;
    runtime.testRunId = testRunId;
    runtime.currentUnitKey = item.actionPayload?.currentUnitKey ?? "";

    const participantSessionId = this.findParticipantSessionIdByLoginKey(loginKey);
    if (participantSessionId) {
      runtime.participantSessionId = participantSessionId;
    }

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

    this.persistState();
    void this.router.navigateByUrl("/runtime");
    this.viewState.onActionAsync(async () => {
      await this.runtimeService.loadParticipantSessionDetail();
      await this.runtimeService.refreshRuntimeReads(true);
    });
  }

  createSourcePackage(): void {
    this.viewState.onActionAsync(() => this.contentService.createSourcePackage());
  }

  createImportJob(): void {
    this.viewState.onActionAsync(() => this.contentService.createImportJob());
  }

  activateContentRelease(): void {
    this.viewState.onActionAsync(() => this.contentService.activateContentRelease());
  }

  refreshContentReads(): void {
    this.viewState.onActionAsync(() => this.contentService.refreshContentReads());
  }

  getSourcePackageDetail(): void {
    this.viewState.onActionAsync(() => this.contentService.loadSourcePackageDetail());
  }

  getImportJobDetail(): void {
    this.viewState.onActionAsync(() => this.contentService.loadImportJobDetail());
  }

  getParticipantSessionDetail(): void {
    this.viewState.onActionAsync(() => this.runtimeService.loadParticipantSessionDetail());
  }

  getContentReleaseActivationReadiness(): void {
    this.viewState.onActionAsync(() =>
      this.contentService.loadContentReleaseActivationReadiness()
    );
  }

  getContentReleaseDetail(): void {
    this.viewState.onActionAsync(() => this.contentService.loadContentReleaseDetail());
  }

  retrySourcePackageImport(): void {
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
        this.activateContentRelease();
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

  private inferSourceDocumentKind(mediaType: string, sourceDocument: string): string {
    if (mediaType.includes("json") || sourceDocument.trim().startsWith("{")) {
      return "JSON source document";
    }
    if (mediaType.includes("xml") || sourceDocument.trim().startsWith("<")) {
      return "XML source document";
    }
    return "Text source document";
  }

  private formatDateTime(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }
}
