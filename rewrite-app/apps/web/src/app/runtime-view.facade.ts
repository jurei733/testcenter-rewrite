import { Injectable, inject } from "@angular/core";

import { parseParticipantRosterText } from "@testcenter-rewrite-app/contracts";
import type {
  GetParticipantSessionResponse,
  ListDetailedResponsesResponse,
  ListReviewsResponse,
  ListParticipantRosterResponse,
  ListParticipantSessionsResponse,
  MonitorOpenRunsResponse,
  ParticipantCurrentRunStateResponse,
  ParticipantRuntimeStateResponse
} from "@testcenter-rewrite-app/contracts";
import {
  participantSessionStatuses,
  testRunStatuses
} from "@testcenter-rewrite-app/domain";

import type { RecordCollectionItem } from "./record-collection.component";
import type { SummaryCard } from "./rewrite-app-shell.types";
import {
  parseJsonDocument,
  readStringValue,
  readUnknownValue
} from "./rewrite-app-shell.readers";
import { downloadTextFile } from "./download-text-file";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";
import { RewriteAppRuntimeService } from "./rewrite-app-runtime.service";
import { RewriteAppViewStateService } from "./rewrite-app-view-state.service";

type RuntimePlayerPreview = {
  hasRun: boolean;
  bookletLabel: string;
  unitLabel: string;
  unitKey: string;
  unitResponse: string;
  runStatus: string;
  runId: string;
  availableActions: string[];
  hint: string;
  canSaveProgress: boolean;
  canResume: boolean;
  canComplete: boolean;
  saveProgressLabel: string;
};

type RuntimeEntryLink = {
  loginKey: string;
  groupKey: string;
  bookletKey: string;
  displayName?: string;
  url: string;
};

@Injectable({ providedIn: "root" })
export class RuntimeViewFacade {
  private readonly uiState = inject(RewriteAppUiStateService);
  private readonly runtimeService = inject(RewriteAppRuntimeService);
  private readonly viewState = inject(RewriteAppViewStateService);

  readonly runtime = this.uiState.runtime;
  readonly participantSessionStatusOptions = participantSessionStatuses;
  readonly testRunStatusOptions = testRunStatuses;

  get participantSessionsView(): string {
    return this.uiState.runtime.participantSessionsView;
  }

  get participantSessionItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ListParticipantSessionsResponse>(
      this.runtime.participantSessionsView
    );
    return (
      payload?.items.map(item => {
        const displayName = item.participantRosterEntry?.displayName;

        return {
          headline: displayName ?? item.participantSession.loginKey,
          subline: displayName
            ? item.participantSession.loginKey
            : item.participantSession.participantSessionId,
          badges: [
            item.participantSession.status,
            item.latestTestRun?.status ?? "no run",
            item.participantRosterEntry ? "roster" : "ad hoc"
          ],
          rows: [
            {
              label: "Session",
              value: item.participantSession.participantSessionId
            },
            {
              label: "Group",
              value: item.participantSession.groupKey
            },
            {
              label: "Roster Booklet",
              value: item.participantRosterEntry?.bookletKey ?? "none"
            },
            {
              label: "Release",
              value:
                item.contentRelease?.releaseLabel ??
                item.participantSession.contentReleaseId
            },
            {
              label: "Created",
              value: this.formatDateTime(item.participantSession.createdAt)
            }
          ],
          selected:
            this.runtime.participantSessionId.trim() ===
            item.participantSession.participantSessionId,
          actionLabel: "Select + Load",
          actionPayload: {
            participantSessionId: item.participantSession.participantSessionId,
            loginKey: item.participantSession.loginKey,
            groupKey: item.participantSession.groupKey
          }
        };
      }) ?? []
    );
  }

  get participantSessionDetailItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetParticipantSessionResponse>(
      this.runtime.participantSessionDetailView
    );
    const detail = payload?.participantSessionDetail;
    if (!detail) {
      return [];
    }

    return [
      {
        headline:
          detail.participantRosterEntry?.displayName ??
          detail.participantSession.loginKey,
        subline: detail.participantRosterEntry?.displayName
          ? detail.participantSession.loginKey
          : detail.participantSession.participantSessionId,
        badges: [
          detail.participantSession.status,
          detail.contentRelease?.status ?? "no release",
          `${detail.reviewCount ?? 0} review(s)`,
          detail.participantRosterEntry ? "roster" : "ad hoc"
        ],
        rows: [
          {
            label: "Session",
            value: detail.participantSession.participantSessionId
          },
          {
            label: "Group",
            value: detail.participantSession.groupKey
          },
          {
            label: "Roster Booklet",
            value: detail.participantRosterEntry?.bookletKey ?? "none"
          },
          {
            label: "Release",
            value: detail.contentRelease?.releaseLabel ?? "none"
          },
          {
            label: "Runs",
            value: String(detail.testRuns.length)
          },
          {
            label: "Responses",
            value: String(detail.responseCount ?? 0)
          },
          {
            label: "Reviews",
            value: String(detail.reviewCount ?? 0)
          },
          {
            label: "Created",
            value: this.formatDateTime(detail.participantSession.createdAt)
          }
        ],
        selected:
          this.runtime.participantSessionId.trim() ===
          detail.participantSession.participantSessionId,
        actionLabel: "Select + Load",
        actionPayload: {
          participantSessionId: detail.participantSession.participantSessionId,
          loginKey: detail.participantSession.loginKey,
          groupKey: detail.participantSession.groupKey
        }
      }
    ];
  }

  get entryLinkItems(): RecordCollectionItem[] {
    return this.parseEntryLinksView().map(link => ({
      headline: link.displayName || link.loginKey,
      subline: link.displayName ? link.loginKey : link.url,
      badges: [link.groupKey, link.bookletKey || "default booklet"],
      rows: [
        { label: "Login", value: link.loginKey },
        { label: "Group", value: link.groupKey },
        { label: "Booklet", value: link.bookletKey || "active release default" },
        { label: "Display Name", value: link.displayName || "none" },
        { label: "URL", value: link.url }
      ],
      selected: this.runtime.loginKey.trim() === link.loginKey,
      actionLabel: "Open Participant Entry",
      actionPayload: {
        loginKey: link.loginKey,
        groupKey: link.groupKey,
        bookletKey: link.bookletKey,
        url: link.url
      }
    }));
  }

  get entryLinkCards(): SummaryCard[] {
    const links = this.parseEntryLinksView();
    const explicitBookletCount = links.filter(link => link.bookletKey.trim()).length;
    const defaultBookletCount = Math.max(links.length - explicitBookletCount, 0);
    const tenantKey = this.uiState.workspace.tenantKey.trim();
    const workspaceKey = this.uiState.workspace.workspaceKey.trim();

    return [
      {
        label: "Entry Links",
        headline: String(links.length),
        detail:
          links.length > 0
            ? "Participant start links are generated for this workspace."
            : "Generate links from roster rows or saved roster entries."
      },
      {
        label: "Scope",
        headline: workspaceKey || "No workspace",
        detail: tenantKey || "No tenant selected"
      },
      {
        label: "Booklets",
        headline: `${explicitBookletCount} explicit`,
        detail:
          defaultBookletCount > 0
            ? `${defaultBookletCount} use the active release default.`
            : "Every link carries an explicit booklet key."
      },
      {
        label: "CSV",
        headline: links.length > 0 ? "Ready" : "Not ready",
        detail:
          links.length > 0
            ? "Preview and download contain the current link set."
            : "CSV export will be populated after link generation."
      }
    ];
  }

  get participantRosterItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ListParticipantRosterResponse>(
      this.runtime.participantRosterView
    );
    return (
      payload?.items.map(entry => {
        const validationWarnings = entry.validationWarnings ?? [];
        const link = {
          loginKey: entry.loginKey,
          groupKey: entry.groupKey,
          bookletKey: entry.bookletKey ?? ""
        };
        return {
          headline: entry.loginKey,
          subline: entry.displayName ?? entry.participantRosterEntryId,
          badges: [
            entry.groupKey,
            entry.bookletKey ?? "default booklet",
            validationWarnings.length > 0
              ? `${validationWarnings.length} warning${validationWarnings.length === 1 ? "" : "s"}`
              : "validated"
          ],
          rows: [
            { label: "Display Name", value: entry.displayName ?? "none" },
            { label: "Group", value: entry.groupKey },
            { label: "Booklet", value: entry.bookletKey ?? "active release default" },
            {
              label: "Validation",
              value:
                validationWarnings.length > 0
                  ? validationWarnings
                      .map(warning => `${warning.code}: ${warning.message}`)
                      .join(" | ")
                  : "No roster warnings"
            },
            { label: "Imported", value: this.formatDateTime(entry.importedAt) },
            {
              label: "Entry URL",
              value: this.buildParticipantEntryUrl(
                this.uiState.workspace.tenantKey.trim(),
                this.uiState.workspace.workspaceKey.trim(),
                link
              ),
              href: this.buildParticipantEntryUrl(
                this.uiState.workspace.tenantKey.trim(),
                this.uiState.workspace.workspaceKey.trim(),
                link
              )
            }
          ],
          selected: this.runtime.loginKey.trim() === entry.loginKey,
          actionLabel: "Use Roster Entry",
          actionPayload: {
            loginKey: entry.loginKey,
            groupKey: entry.groupKey,
            bookletKey: entry.bookletKey ?? ""
          }
        };
      }) ?? []
    );
  }

  get entryLinksCsvPreview(): string {
    const links = this.parseEntryLinksView();
    if (links.length === 0) {
      return "Generate entry links to preview CSV.";
    }
    return this.createEntryLinksCsv(links);
  }

  get participantRunHistoryItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetParticipantSessionResponse>(
      this.runtime.participantSessionDetailView
    );
    const detail = payload?.participantSessionDetail;
    const runSummaries =
      detail?.runSummaries ??
      detail?.testRuns.map(testRun => ({
        testRun,
        responseCount: Object.keys(testRun.unitResponses ?? {}).length,
        reviewCount: 0
      }));

    return (
      runSummaries?.map(summary => {
        const testRun = summary.testRun;
        return {
          headline: testRun.testRunId,
          subline: testRun.status,
          badges: [
            testRun.bookletKey,
            `${summary.responseCount} response(s)`,
            `${summary.reviewCount} review(s)`
          ],
          rows: [
            {
              label: "Current Unit",
              value: testRun.currentUnitKey ?? "none"
            },
            {
              label: "Unit Responses",
              value: String(summary.responseCount)
            },
            {
              label: "Reviews",
              value: String(summary.reviewCount)
            },
            {
              label: "Created",
              value: this.formatDateTime(testRun.createdAt)
            },
            {
              label: "Updated",
              value: this.formatDateTime(testRun.updatedAt)
            },
            {
              label: "Completed",
              value: testRun.completedAt
                ? this.formatDateTime(testRun.completedAt)
                : "not completed"
            }
          ],
          selected: this.runtime.testRunId.trim() === testRun.testRunId,
          actionLabel: "Select + Sync",
          actionPayload: {
            testRunId: testRun.testRunId,
            currentUnitKey: testRun.currentUnitKey ?? ""
          }
        };
      }) ?? []
    );
  }

  get runtimeStateItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ParticipantRuntimeStateResponse>(
      this.runtime.runtimeStateView
    );
    const detail = payload?.runtimeState;
    if (!detail) {
      return [];
    }

    return [
      {
        headline: detail.runtimeStatus,
        subline: detail.participantSession.loginKey,
        badges: [detail.availableAction],
        rows: [
          {
            label: "Session",
            value: detail.participantSession.participantSessionId
          },
          {
            label: "Latest Run",
            value: detail.latestTestRun?.testRunId ?? "none"
          },
          {
            label: "Latest Run Status",
            value: detail.latestTestRun?.status ?? "n/a"
          }
        ],
        selected:
          this.runtime.participantSessionId.trim() ===
          detail.participantSession.participantSessionId,
        actionLabel: "Select + Load",
        actionPayload: {
          participantSessionId: detail.participantSession.participantSessionId,
          loginKey: detail.participantSession.loginKey
        }
      }
    ];
  }

  get currentRunStateItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ParticipantCurrentRunStateResponse>(
      this.runtime.currentRunStateView
    );
    const detail = payload?.currentRunState;
    if (!detail) {
      return [];
    }

    const currentUnitKey = detail.currentUnit.unitKey ?? "";
    const unitResponses = detail.testRun.unitResponses ?? {};

    return [
      {
        headline: detail.booklet.displayLabel,
        subline: detail.testRun.testRunId,
        badges: [detail.testRun.status, ...detail.availableActions],
        rows: [
          {
            label: "Current Unit",
            value: detail.currentUnit.displayLabel ?? detail.currentUnit.unitKey ?? "none"
          },
          {
            label: "Current Response",
            value: currentUnitKey
              ? this.formatResponsePreview(unitResponses[currentUnitKey] ?? "")
              : "none"
          },
          {
            label: "Responses",
            value: String(Object.keys(unitResponses).length)
          },
          {
            label: "Booklet Key",
            value: detail.booklet.bookletKey
          },
          {
            label: "Created",
            value: this.formatDateTime(detail.testRun.createdAt)
          }
        ],
        selected: this.runtime.testRunId.trim() === detail.testRun.testRunId,
        actionLabel: "Select + Sync",
        actionPayload: {
          testRunId: detail.testRun.testRunId,
          currentUnitKey: detail.testRun.currentUnitKey ?? ""
        }
      }
    ];
  }

  get unitResponseItems(): RecordCollectionItem[] {
    const currentRunState = parseJsonDocument<ParticipantCurrentRunStateResponse>(
      this.runtime.currentRunStateView
    )?.currentRunState;
    if (currentRunState) {
      return this.createUnitResponseItems({
        testRunId: currentRunState.testRun.testRunId,
        status: currentRunState.testRun.status,
        currentUnitKey: currentRunState.testRun.currentUnitKey,
        unitResponses: currentRunState.testRun.unitResponses ?? {}
      });
    }

    const sessionDetail = parseJsonDocument<GetParticipantSessionResponse>(
      this.runtime.participantSessionDetailView
    )?.participantSessionDetail;
    const selectedRun =
      sessionDetail?.testRuns.find(
        testRun => testRun.testRunId === this.runtime.testRunId.trim()
      ) ?? sessionDetail?.testRuns[0];

    if (!selectedRun) {
      return [];
    }

    return this.createUnitResponseItems({
      testRunId: selectedRun.testRunId,
      status: selectedRun.status,
      currentUnitKey: selectedRun.currentUnitKey,
      unitResponses: selectedRun.unitResponses ?? {}
    });
  }

  get detailedResponseItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ListDetailedResponsesResponse>(
      this.runtime.detailedResponsesView
    );
    return (
      payload?.items.map(item => {
        const displayName = item.participantRosterEntry?.displayName;

        return {
          headline: `${displayName ?? item.loginKey} · ${item.unitKey}`,
          subline: displayName ? item.loginKey : item.testRunId,
          badges: [
            item.status,
            item.bookletKey,
            `${item.responseLength} char(s)`,
            item.participantRosterEntry ? "roster" : "ad hoc"
          ],
          rows: [
            { label: "Response", value: this.formatResponsePreview(item.response) },
            { label: "Login", value: item.loginKey },
            { label: "Group", value: item.groupKey || "unknown" },
            { label: "Session", value: item.participantSessionId },
            { label: "Updated", value: this.formatDateTime(item.updatedAt) }
          ],
          selected:
            this.runtime.testRunId.trim() === item.testRunId &&
            this.runtime.currentUnitKey.trim() === item.unitKey,
          actionLabel: "Select Response",
          actionPayload: {
            testRunId: item.testRunId,
            currentUnitKey: item.unitKey,
            participantSessionId: item.participantSessionId,
            loginKey: item.loginKey,
            groupKey: item.groupKey
          }
        };
      }) ?? []
    );
  }

  get selectedSessionReviewItems(): RecordCollectionItem[] {
    const detail = parseJsonDocument<GetParticipantSessionResponse>(
      this.runtime.participantSessionDetailView
    )?.participantSessionDetail;
    if (!detail) {
      return [];
    }

    return detail.reviews.map(review => ({
      headline: `${review.category} · ${review.unitKey ?? "whole run"}`,
      subline: review.reviewId,
      badges: [review.reviewerId, review.testRunId],
      rows: [
        { label: "Comment", value: this.formatResponsePreview(review.comment) },
        {
          label: "Participant",
          value:
            detail.participantRosterEntry?.displayName ??
            detail.participantSession.loginKey
        },
        { label: "Login", value: detail.participantSession.loginKey },
        { label: "Run", value: review.testRunId },
        { label: "Updated", value: this.formatDateTime(review.updatedAt) }
      ],
      selected:
        this.runtime.testRunId.trim() === review.testRunId &&
        (review.unitKey === null ||
          this.runtime.currentUnitKey.trim() === review.unitKey),
      actionLabel: "Select Review",
      actionPayload: {
        reviewId: review.reviewId,
        testRunId: review.testRunId,
        currentUnitKey: review.unitKey ?? "",
        participantSessionId: review.participantSessionId,
        loginKey: detail.participantSession.loginKey,
        groupKey: detail.participantSession.groupKey,
        reviewerId: review.reviewerId,
        reviewCategory: review.category,
        reviewComment: review.comment
      }
    }));
  }

  get reviewItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ListReviewsResponse>(this.runtime.reviewsView);
    return (
      payload?.items.map(item => {
        const displayName = item.participantRosterEntry?.displayName;
        const loginKey = item.participantSession?.loginKey ?? "unknown";

        return {
          headline: `${item.review.category} · ${displayName ?? loginKey}`,
          subline: item.review.reviewId,
          badges: [
            item.review.reviewerId,
            item.testRun?.status ?? "missing run",
            item.review.unitKey ?? "whole run",
            item.participantRosterEntry ? "roster" : "ad hoc"
          ],
          rows: [
            { label: "Review Id", value: item.review.reviewId },
            {
              label: "Comment",
              value: this.formatResponsePreview(item.review.comment)
            },
            { label: "Login", value: loginKey },
            { label: "Run", value: item.review.testRunId },
            {
              label: "Session",
              value: item.review.participantSessionId
            },
            {
              label: "Updated",
              value: this.formatDateTime(item.review.updatedAt)
            }
          ],
          selected:
            this.runtime.testRunId.trim() === item.review.testRunId &&
            (item.review.unitKey === null ||
              this.runtime.currentUnitKey.trim() === item.review.unitKey),
          actionLabel: "Select Review",
          actionPayload: {
            reviewId: item.review.reviewId,
            testRunId: item.review.testRunId,
            currentUnitKey: item.review.unitKey ?? "",
            participantSessionId: item.review.participantSessionId,
            loginKey: item.participantSession?.loginKey ?? "",
            groupKey: item.participantSession?.groupKey ?? "",
            reviewerId: item.review.reviewerId,
            reviewCategory: item.review.category,
            reviewComment: item.review.comment
          }
        };
      }) ?? []
    );
  }

  get reviewActionItems(): RecordCollectionItem[] {
    const reviewId = this.runtime.reviewId.trim();
    const testRunId = this.runtime.testRunId.trim();
    const participantSessionId = this.runtime.participantSessionId.trim();
    const currentUnitKey = this.runtime.currentUnitKey.trim();
    const reviewerId = this.runtime.reviewerId.trim();
    const category = this.runtime.reviewCategory.trim();
    const comment = this.runtime.reviewComment.trim();
    const items: RecordCollectionItem[] = [];

    if (testRunId && participantSessionId) {
      items.push({
        headline: "Create review for selected run",
        subline: currentUnitKey || "whole run",
        badges: ["review", "create", reviewerId || "no reviewer"],
        rows: [
          { label: "Run", value: testRunId },
          { label: "Session", value: participantSessionId },
          { label: "Reviewer", value: reviewerId || "enter reviewer id" },
          { label: "Category", value: category || "enter category" },
          {
            label: "Comment",
            value: comment ? this.formatResponsePreview(comment) : "enter comment"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { reviewCommand: "createReview" }
      });
    }

    if (reviewId) {
      items.push({
        headline: "Update selected review",
        subline: reviewId,
        badges: ["review", "update", category || "no category"],
        rows: [
          { label: "Review", value: reviewId },
          { label: "Run", value: testRunId || "unknown run" },
          { label: "Reviewer", value: reviewerId || "unchanged reviewer" },
          {
            label: "Comment",
            value: comment ? this.formatResponsePreview(comment) : "unchanged comment"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { reviewCommand: "updateReview" }
      });
      items.push({
        headline: "Delete selected review",
        subline: reviewId,
        badges: ["review", "delete"],
        rows: [
          { label: "Review", value: reviewId },
          { label: "Run", value: testRunId || "unknown run" },
          {
            label: "Expected Result",
            value: "Remove the review and refresh review read models"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { reviewCommand: "deleteReview" }
      });
    }

    if (
      this.runtime.loginKey.trim() ||
      this.runtime.groupKey.trim() ||
      participantSessionId ||
      testRunId ||
      currentUnitKey ||
      reviewerId ||
      category
    ) {
      items.push({
        headline: "Load reviews for selected scope",
        subline: testRunId || participantSessionId || this.runtime.loginKey.trim(),
        badges: ["review", "filter"],
        rows: [
          { label: "Login", value: this.runtime.loginKey.trim() || "any" },
          { label: "Group", value: this.runtime.groupKey.trim() || "any" },
          { label: "Run", value: testRunId || "any" },
          { label: "Unit", value: currentUnitKey || "any" }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { reviewCommand: "loadSelectedScope" }
      });
    }

    if (items.length === 0) {
      items.push({
        headline: "Select a runtime run before reviewing",
        subline: "No active review scope",
        badges: ["review", "needs run"],
        rows: [
          {
            label: "Expected Input",
            value: "Select a participant session and run, then add a review comment"
          },
          {
            label: "Shortcut",
            value: "Use Participant Sessions, Open Runs, or Detailed Responses"
          }
        ]
      });
    }

    return items;
  }

  get openRunItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<MonitorOpenRunsResponse>(this.runtime.openRunsView);
    return (
      payload?.items.map(openRun => {
        const displayName = openRun.participantRosterEntry?.displayName;

        return {
          headline: displayName ?? openRun.loginKey,
          subline: displayName ? openRun.loginKey : openRun.testRunId,
          badges: [
            openRun.status,
            openRun.groupKey,
            openRun.participantRosterEntry ? "roster" : "ad hoc"
          ],
          rows: [
            {
              label: "Run",
              value: openRun.testRunId
            },
            {
              label: "Booklet",
              value: openRun.bookletKey
            },
            {
              label: "Current Unit",
              value: openRun.currentUnitKey ?? "none"
            },
            {
              label: "Updated",
              value: this.formatDateTime(openRun.updatedAt)
            }
          ],
          selected: this.runtime.testRunId.trim() === openRun.testRunId,
          actionLabel: "Select + Sync",
          actionPayload: {
            testRunId: openRun.testRunId,
            currentUnitKey: openRun.currentUnitKey ?? "",
            loginKey: openRun.loginKey,
            groupKey: openRun.groupKey
          }
        };
      }) ?? []
    );
  }

  get runtimeCards(): SummaryCard[] {
    const runtimeState = parseJsonDocument(this.runtime.runtimeStateView);
    const currentRunState = parseJsonDocument(this.runtime.currentRunStateView);
    const openRunsState = parseJsonDocument(this.runtime.openRunsView);

    const runtimeStatus =
      readStringValue(runtimeState, ["runtimeState", "runtimeStatus"]) ?? "unknown";
    const availableAction =
      readStringValue(runtimeState, ["runtimeState", "availableAction"]) ?? "n/a";
    const runStatus =
      readStringValue(currentRunState, ["currentRunState", "testRun", "status"]) ?? "idle";
    const unitLabel =
      readStringValue(currentRunState, ["currentRunState", "currentUnit", "displayLabel"]) ??
      readStringValue(currentRunState, ["currentRunState", "currentUnit", "unitKey"]) ??
      "not set";
    const openRuns = readUnknownValue(openRunsState, ["items"]);
    const openRunCount = Array.isArray(openRuns) ? openRuns.length : 0;

    return [
      {
        label: "Session",
        headline: runtimeStatus,
        detail: this.runtime.participantSessionId.trim() || "no session selected"
      },
      {
        label: "Run",
        headline: runStatus,
        detail: this.runtime.testRunId.trim() || "no run selected"
      },
      {
        label: "Current Unit",
        headline: unitLabel,
        detail: `Next action: ${availableAction}`
      },
      {
        label: "Open Runs",
        headline: String(openRunCount),
        detail: openRunCount > 0 ? "Activation guard is active." : "No active blocker."
      }
    ];
  }

  get playerPreview(): RuntimePlayerPreview {
    const currentRunState = parseJsonDocument<ParticipantCurrentRunStateResponse>(
      this.runtime.currentRunStateView
    )?.currentRunState;

    if (!currentRunState) {
      return {
        hasRun: false,
        bookletLabel: "No active booklet",
        unitLabel: "No unit loaded",
        unitKey: "n/a",
        unitResponse: "",
        runStatus: "idle",
        runId: this.runtime.testRunId.trim() || "no run selected",
        availableActions: [],
        hint: "Sign in and resume a participant session to load the first unit.",
        canSaveProgress: false,
        canResume: false,
        canComplete: false,
        saveProgressLabel: "Save Progress"
      };
    }

    const unitLabel =
      currentRunState.currentUnit.displayLabel ??
      currentRunState.currentUnit.unitKey ??
      "Untitled unit";
    const unitKey = currentRunState.currentUnit.unitKey ?? "n/a";
    const canSaveProgress =
      currentRunState.availableActions.includes("save_progress");
    const canResume = currentRunState.availableActions.includes("resume");
    const canComplete = currentRunState.availableActions.includes("complete");
    const unitResponse = currentRunState.testRun.unitResponses?.[unitKey] ?? "";

    return {
      hasRun: true,
      bookletLabel: currentRunState.booklet.displayLabel,
      unitLabel,
      unitKey,
      unitResponse,
      runStatus: currentRunState.testRun.status,
      runId: currentRunState.testRun.testRunId,
      availableActions: currentRunState.availableActions,
      hint:
        currentRunState.testRun.status === "completed"
          ? "This run is complete; monitor reads should no longer list it as an open blocker."
          : "This preview is sourced from the same current-state endpoint a participant shell can use.",
      canSaveProgress,
      canResume,
      canComplete,
      saveProgressLabel:
        currentRunState.testRun.status === "paused"
          ? "Save Running"
          : "Save Paused"
    };
  }

  get runtimeActionItems(): RecordCollectionItem[] {
    const runtimeState = parseJsonDocument<ParticipantRuntimeStateResponse>(
      this.runtime.runtimeStateView
    )?.runtimeState;
    const currentRunState = parseJsonDocument<ParticipantCurrentRunStateResponse>(
      this.runtime.currentRunStateView
    )?.currentRunState;
    const openRuns = parseJsonDocument<MonitorOpenRunsResponse>(
      this.runtime.openRunsView
    )?.items ?? [];
    const items: RecordCollectionItem[] = [];

    if (runtimeState && runtimeState.availableAction !== "none") {
      const headline =
        runtimeState.availableAction === "launch"
          ? "Start first run for this session"
          : "Resume the participant session";
      items.push({
        headline,
        subline: runtimeState.participantSession.loginKey,
        badges: [runtimeState.runtimeStatus, runtimeState.availableAction],
        rows: [
          {
            label: "Session",
            value: runtimeState.participantSession.participantSessionId
          },
          {
            label: "Latest Run",
            value: runtimeState.latestTestRun?.testRunId ?? "none yet"
          },
          {
            label: "Expected Result",
            value:
              runtimeState.availableAction === "launch"
                ? "Create a running test run"
                : "Return the latest run to running"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { runtimeCommand: "resumeSession" }
      });
    }

    if (currentRunState) {
      const currentUnitLabel =
        currentRunState.currentUnit.displayLabel ??
        currentRunState.currentUnit.unitKey ??
        "none";
      if (currentRunState.availableActions.includes("resume")) {
        items.push({
          headline: "Resume paused run",
          subline: currentRunState.testRun.testRunId,
          badges: [currentRunState.testRun.status, "resume"],
          rows: [
            {
              label: "Current Unit",
              value: currentUnitLabel
            },
            {
              label: "Booklet",
              value: currentRunState.booklet.displayLabel
            },
            {
              label: "Expected Result",
              value: "Run status becomes running"
            }
          ],
          actionLabel: "Apply Suggestion",
          actionPayload: { runtimeCommand: "resumeRun" }
        });
      }

      if (currentRunState.testRun.status === "paused") {
        items.push({
          headline: "Monitor resume selected run",
          subline: currentRunState.testRun.testRunId,
          badges: [currentRunState.testRun.status, "monitor", "resume"],
          rows: [
            {
              label: "Current Unit",
              value: currentUnitLabel
            },
            {
              label: "Booklet",
              value: currentRunState.booklet.displayLabel
            },
            {
              label: "Expected Result",
              value: "Operator command records activity and returns the run to running"
            }
          ],
          actionLabel: "Apply Suggestion",
          actionPayload: { runtimeCommand: "monitorResume" }
        });
      }

      if (currentRunState.availableActions.includes("save_progress")) {
        const isPaused = currentRunState.testRun.status === "paused";
        items.push({
          headline: isPaused ? "Save current unit as running" : "Pause at current unit",
          subline: currentRunState.currentUnit.unitKey ?? currentUnitLabel,
          badges: [currentRunState.testRun.status, "save_progress"],
          rows: [
            {
              label: "Run",
              value: currentRunState.testRun.testRunId
            },
            {
              label: "Current Unit",
              value: currentUnitLabel
            },
            {
              label: "Expected Result",
              value: isPaused ? "Run status becomes running" : "Run status becomes paused"
            }
          ],
          actionLabel: "Apply Suggestion",
          actionPayload: {
            runtimeCommand: isPaused ? "saveRunning" : "savePaused"
          }
        });
      }

      if (currentRunState.testRun.status === "running") {
        items.push({
          headline: "Monitor pause selected run",
          subline: currentRunState.testRun.testRunId,
          badges: [currentRunState.testRun.status, "monitor", "pause"],
          rows: [
            {
              label: "Current Unit",
              value: currentUnitLabel
            },
            {
              label: "Booklet",
              value: currentRunState.booklet.displayLabel
            },
            {
              label: "Expected Result",
              value: "Operator command records activity and moves the run to paused"
            }
          ],
          actionLabel: "Apply Suggestion",
          actionPayload: { runtimeCommand: "monitorPause" }
        });
      }

      if (currentRunState.availableActions.includes("complete")) {
        items.push({
          headline: "Complete current run",
          subline: currentRunState.testRun.testRunId,
          badges: [currentRunState.testRun.status, "complete"],
          rows: [
            {
              label: "Session",
              value: currentRunState.participantSession.participantSessionId
            },
            {
              label: "Current Unit",
              value: currentUnitLabel
            },
            {
              label: "Expected Result",
              value: "Close the participant session and clear activation blockers"
            }
          ],
          actionLabel: "Apply Suggestion",
          actionPayload: { runtimeCommand: "completeRun" }
        });
      }

      if (["paused", "running"].includes(currentRunState.testRun.status)) {
        items.push({
          headline: "Monitor complete selected run",
          subline: currentRunState.testRun.testRunId,
          badges: [currentRunState.testRun.status, "monitor", "complete"],
          rows: [
            {
              label: "Session",
              value: currentRunState.participantSession.participantSessionId
            },
            {
              label: "Current Unit",
              value: currentUnitLabel
            },
            {
              label: "Expected Result",
              value: "Operator command closes the session and clears the monitor blocker"
            }
          ],
          actionLabel: "Apply Suggestion",
          actionPayload: { runtimeCommand: "monitorComplete" }
        });
      }
    }

    if (openRuns.length > 0) {
      items.push({
        headline: "Review activation blockers",
        subline: `${openRuns.length} open run${openRuns.length === 1 ? "" : "s"}`,
        badges: ["monitor", "activation guard"],
        rows: [
          {
            label: "Newest Run",
            value: openRuns[0]?.testRunId ?? "unknown"
          },
          {
            label: "Participant",
            value:
              openRuns[0]?.participantRosterEntry?.displayName ??
              openRuns[0]?.loginKey ??
              "unknown"
          },
          {
            label: "Expected Result",
            value: "Refresh monitor and current runtime context"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { runtimeCommand: "refreshRuntimeReads" }
      });
    }

    if (items.length === 0) {
      items.push({
        headline: "Refresh runtime context",
        subline: this.runtime.participantSessionId.trim() || "no session selected",
        badges: ["read model"],
        rows: [
          {
            label: "Session",
            value: this.runtime.participantSessionId.trim() || "select or sign in first"
          },
          {
            label: "Run",
            value: this.runtime.testRunId.trim() || "none selected"
          },
          {
            label: "Expected Result",
            value: "Reload session, current run, and monitor state"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { runtimeCommand: "refreshRuntimeReads" }
      });
    }

    return items;
  }

  init(): void {
    this.viewState.setActiveView("runtime");
  }

  persistState(): void {
    this.viewState.persistShellState();
  }

  participantSignIn(): void {
    this.viewState.onActionAsync(() => this.runtimeService.participantSignIn());
  }

  resumeSession(): void {
    this.viewState.onActionAsync(() => this.runtimeService.resumeParticipantSession());
  }

  refreshRuntimeReads(): void {
    this.viewState.onActionAsync(() => this.runtimeService.refreshRuntimeReads());
  }

  refreshParticipantSessions(): void {
    this.persistState();
    this.viewState.onActionAsync(() =>
      this.runtimeService.loadParticipantSessions()
    );
  }

  clearParticipantSessionFilters(): void {
    this.runtime.participantSessionStatusFilter = "";
    this.runtime.participantSessionGroupFilter = "";
    this.runtime.participantSessionLoginFilter = "";
    this.runtime.participantSessionReleaseFilter = "";
    this.runtime.participantSessionLimit = "100";
    this.refreshParticipantSessions();
  }

  applyDetailedResponseFilters(): void {
    this.persistState();
    this.loadDetailedResponses();
  }

  useSelectedRuntimeAsDetailedResponseFilters(): void {
    this.runtime.detailedResponseLoginFilter = this.runtime.loginKey.trim();
    this.runtime.detailedResponseGroupFilter = this.runtime.groupKey.trim();
    this.runtime.detailedResponseSessionFilter =
      this.runtime.participantSessionId.trim();
    this.runtime.detailedResponseRunFilter = this.runtime.testRunId.trim();
    this.runtime.detailedResponseUnitFilter = this.runtime.currentUnitKey.trim();
    this.applyDetailedResponseFilters();
  }

  clearDetailedResponseFilters(): void {
    this.runtime.detailedResponseLoginFilter = "";
    this.runtime.detailedResponseGroupFilter = "";
    this.runtime.detailedResponseSessionFilter = "";
    this.runtime.detailedResponseRunFilter = "";
    this.runtime.detailedResponseUnitFilter = "";
    this.runtime.detailedResponseStatusFilter = "";
    this.runtime.detailedResponseLimit = "100";
    this.applyDetailedResponseFilters();
  }

  applyReviewFilters(): void {
    this.persistState();
    this.loadReviews();
  }

  useSelectedRuntimeAsReviewFilters(): void {
    this.runtime.reviewLoginFilter = this.runtime.loginKey.trim();
    this.runtime.reviewGroupFilter = this.runtime.groupKey.trim();
    this.runtime.reviewSessionFilter = this.runtime.participantSessionId.trim();
    this.runtime.reviewRunFilter = this.runtime.testRunId.trim();
    this.runtime.reviewUnitFilter = this.runtime.currentUnitKey.trim();
    this.runtime.reviewReviewerFilter = this.runtime.reviewerId.trim();
    this.runtime.reviewCategoryFilter = this.runtime.reviewCategory.trim();
    this.applyReviewFilters();
  }

  clearReviewFilters(): void {
    this.runtime.reviewLoginFilter = "";
    this.runtime.reviewGroupFilter = "";
    this.runtime.reviewSessionFilter = "";
    this.runtime.reviewRunFilter = "";
    this.runtime.reviewUnitFilter = "";
    this.runtime.reviewReviewerFilter = "";
    this.runtime.reviewCategoryFilter = "";
    this.runtime.reviewLimit = "100";
    this.applyReviewFilters();
  }

  generateEntryLinks(): void {
    const links = this.parseEntryRosterRows();
    this.runtime.entryLinksView = JSON.stringify({ links }, null, 2);
    this.persistState();
  }

  importParticipantRoster(): void {
    this.persistState();
    this.viewState.onActionAsync(async () => {
      await this.runtimeService.importParticipantRoster();
      this.generateEntryLinksFromSavedRoster();
    });
  }

  loadParticipantRoster(): void {
    this.viewState.onActionAsync(() => this.runtimeService.loadParticipantRoster());
  }

  exportParticipantRosterCsv(): void {
    this.viewState.onActionAsync(() =>
      this.runtimeService.exportParticipantRosterCsv()
    );
  }

  generateEntryLinksFromSavedRoster(): void {
    const links = this.parseParticipantRosterView().map(entry => ({
      loginKey: entry.loginKey,
      groupKey: entry.groupKey,
      bookletKey: entry.bookletKey ?? "",
      displayName: entry.displayName ?? "",
      url: this.buildParticipantEntryUrl(
        this.uiState.workspace.tenantKey.trim(),
        this.uiState.workspace.workspaceKey.trim(),
        {
          loginKey: entry.loginKey,
          groupKey: entry.groupKey,
          bookletKey: entry.bookletKey ?? ""
        }
      )
    }));
    this.runtime.entryLinksView = JSON.stringify({ links }, null, 2);
    this.persistState();
  }

  downloadEntryLinksCsv(): void {
    let links = this.parseEntryLinksView();
    if (links.length === 0) {
      links = this.parseEntryRosterRows();
      this.runtime.entryLinksView = JSON.stringify({ links }, null, 2);
      this.persistState();
    }

    const workspaceKey = this.uiState.workspace.workspaceKey.trim() || "workspace";
    downloadTextFile({
      filename: `${workspaceKey}-participant-entry-links.csv`,
      mediaType: "text/csv;charset=utf-8",
      text: this.createEntryLinksCsv(links)
    });
  }

  useSelectedParticipantAsEntryRoster(): void {
    const loginKey = this.runtime.loginKey.trim() || "student-demo";
    const groupKey = this.runtime.groupKey.trim() || `group:${loginKey}`;
    const bookletKey = this.runtime.bookletKey.trim();
    this.runtime.entryRosterText = [loginKey, groupKey, bookletKey]
      .filter(Boolean)
      .join(",");
    this.generateEntryLinks();
  }

  saveProgressPaused(): void {
    this.viewState.onActionAsync(() => this.runtimeService.saveProgress("paused"));
  }

  saveProgressRunning(): void {
    this.viewState.onActionAsync(() => this.runtimeService.saveProgress("running"));
  }

  saveProgressFromPreview(): void {
    if (this.playerPreview.runStatus === "paused") {
      this.saveProgressRunning();
      return;
    }
    this.saveProgressPaused();
  }

  resumeRun(): void {
    this.viewState.onActionAsync(() => this.runtimeService.resumeRun());
  }

  completeRun(): void {
    this.viewState.onActionAsync(() => this.runtimeService.completeRun());
  }

  issueMonitorPause(): void {
    this.viewState.onActionAsync(() =>
      this.runtimeService.issueMonitorRunCommand("pause")
    );
  }

  issueMonitorResume(): void {
    this.viewState.onActionAsync(() =>
      this.runtimeService.issueMonitorRunCommand("resume")
    );
  }

  issueMonitorComplete(): void {
    this.viewState.onActionAsync(() =>
      this.runtimeService.issueMonitorRunCommand("complete")
    );
  }

  openRuns(): void {
    this.viewState.onActionAsync(() => this.runtimeService.refreshRuntimeReads());
  }

  exportOpenRunsCsv(): void {
    this.viewState.onActionAsync(() => this.runtimeService.exportOpenRunsCsv());
  }

  runRuntimeSuggestion(item: RecordCollectionItem): void {
    switch (item.actionPayload?.runtimeCommand) {
      case "resumeSession":
        this.resumeSession();
        break;
      case "resumeRun":
        this.resumeRun();
        break;
      case "savePaused":
        this.saveProgressPaused();
        break;
      case "saveRunning":
        this.saveProgressRunning();
        break;
      case "completeRun":
        this.completeRun();
        break;
      case "monitorPause":
        this.issueMonitorPause();
        break;
      case "monitorResume":
        this.issueMonitorResume();
        break;
      case "monitorComplete":
        this.issueMonitorComplete();
        break;
      case "refreshRuntimeReads":
      default:
        this.refreshRuntimeReads();
        break;
    }
  }

  runReviewSuggestion(item: RecordCollectionItem): void {
    switch (item.actionPayload?.reviewCommand) {
      case "createReview":
        this.createReview();
        break;
      case "updateReview":
        this.updateReview();
        break;
      case "deleteReview":
        this.confirmDeleteReview();
        break;
      case "loadSelectedScope":
        this.useSelectedRuntimeAsReviewFilters();
        break;
      default:
        this.loadReviews();
        break;
    }
  }

  participantHappyPathFlow(): void {
    this.viewState.onActionAsync(() => this.runtimeService.participantHappyPathFlow());
  }

  getParticipantSessionDetail(): void {
    this.viewState.onActionAsync(() => this.runtimeService.loadParticipantSessionDetail());
  }

  exportParticipantSessionsCsv(): void {
    this.viewState.onActionAsync(() =>
      this.runtimeService.exportParticipantSessionsCsv()
    );
  }

  exportResponsesCsv(): void {
    this.viewState.onActionAsync(() => this.runtimeService.exportResponsesCsv());
  }

  loadDetailedResponses(): void {
    this.viewState.onActionAsync(() => this.runtimeService.loadDetailedResponses());
  }

  loadReviews(): void {
    this.viewState.onActionAsync(() => this.runtimeService.loadReviews());
  }

  createReview(): void {
    this.viewState.onActionAsync(() => this.runtimeService.createReview());
  }

  updateReview(): void {
    this.viewState.onActionAsync(() => this.runtimeService.updateReview());
  }

  confirmDeleteReview(): void {
    const reviewId = this.runtime.reviewId.trim();
    if (!reviewId) {
      this.deleteReview();
      return;
    }
    const confirmed = globalThis.window?.confirm(
      `Delete review '${reviewId}' from this workspace?`
    );
    if (confirmed) {
      this.deleteReview();
    }
  }

  private deleteReview(): void {
    this.viewState.onActionAsync(() => this.runtimeService.deleteReview());
  }

  exportReviewsCsv(): void {
    this.viewState.onActionAsync(() => this.runtimeService.exportReviewsCsv());
  }

  confirmDeleteGroupResults(): void {
    const groupKey = this.runtime.groupKey.trim();
    if (!groupKey) {
      this.deleteGroupResults();
      return;
    }
    const confirmed = globalThis.window?.confirm(
      `Delete all collected test runs for group '${groupKey}' in this workspace?`
    );
    if (confirmed) {
      this.deleteGroupResults();
    }
  }

  private deleteGroupResults(): void {
    this.viewState.onActionAsync(() => this.runtimeService.deleteGroupResults());
  }

  selectEntryLink(item: RecordCollectionItem): void {
    if (item.actionPayload?.loginKey) {
      this.runtime.loginKey = item.actionPayload.loginKey;
    }
    if (item.actionPayload?.groupKey) {
      this.runtime.groupKey = item.actionPayload.groupKey;
    }
    this.runtime.bookletKey = item.actionPayload?.bookletKey ?? "";
    this.persistState();

    const url = item.actionPayload?.url?.trim();
    if (url) {
      globalThis.window?.open(url, "_blank", "noopener,noreferrer");
    }
  }

  selectParticipantSession(item: RecordCollectionItem): void {
    const participantSessionId = item.actionPayload?.participantSessionId?.trim();
    if (!participantSessionId) {
      return;
    }

    this.runtime.participantSessionId = participantSessionId;
    if (item.actionPayload?.loginKey) {
      this.runtime.loginKey = item.actionPayload.loginKey;
    }
    if (item.actionPayload?.groupKey) {
      this.runtime.groupKey = item.actionPayload.groupKey;
    }
    this.persistState();
    this.viewState.onActionAsync(async () => {
      await this.runtimeService.loadParticipantSessionDetail();
      await this.runtimeService.refreshRuntimeReads(true);
    });
  }

  selectTestRun(item: RecordCollectionItem): void {
    const testRunId = item.actionPayload?.testRunId?.trim();
    if (!testRunId) {
      return;
    }

    this.runtime.testRunId = testRunId;
    if (item.actionPayload?.currentUnitKey != null) {
      this.runtime.currentUnitKey = item.actionPayload.currentUnitKey;
    }
    if (item.actionPayload?.loginKey) {
      this.runtime.loginKey = item.actionPayload.loginKey;
    }
    if (item.actionPayload?.groupKey) {
      this.runtime.groupKey = item.actionPayload.groupKey;
    }
    if (item.actionPayload?.participantSessionId) {
      this.runtime.participantSessionId = item.actionPayload.participantSessionId;
    }
    if (!this.runtime.participantSessionId.trim() && this.runtime.loginKey.trim()) {
      const derivedParticipantSessionId = this.findParticipantSessionIdByLoginKey(
        this.runtime.loginKey.trim()
      );
      if (derivedParticipantSessionId) {
        this.runtime.participantSessionId = derivedParticipantSessionId;
      }
    }
    this.persistState();
    if (!this.runtime.participantSessionId.trim()) {
      return;
    }

    this.viewState.onActionAsync(async () => {
      await this.runtimeService.loadParticipantSessionDetail();
      await this.runtimeService.refreshRuntimeReads(true);
    });
  }

  selectReview(item: RecordCollectionItem): void {
    if (item.actionPayload?.reviewId) {
      this.runtime.reviewId = item.actionPayload.reviewId;
    }
    if (item.actionPayload?.reviewerId) {
      this.runtime.reviewerId = item.actionPayload.reviewerId;
    }
    if (item.actionPayload?.reviewCategory) {
      this.runtime.reviewCategory = item.actionPayload.reviewCategory;
    }
    if (item.actionPayload?.reviewComment) {
      this.runtime.reviewComment = item.actionPayload.reviewComment;
    }
    this.selectTestRun(item);
  }

  private findParticipantSessionIdByLoginKey(loginKey: string): string | null {
    const payload = parseJsonDocument<ListParticipantSessionsResponse>(
      this.runtime.participantSessionsView
    );
    const matchingItem = payload?.items.find(
      item => item.participantSession.loginKey === loginKey
    );
    return matchingItem?.participantSession.participantSessionId ?? null;
  }

  private parseEntryRosterRows(): RuntimeEntryLink[] {
    const tenantKey = this.uiState.workspace.tenantKey.trim();
    const workspaceKey = this.uiState.workspace.workspaceKey.trim();
    return parseParticipantRosterText(this.runtime.entryRosterText).map(link => {
      const entryLink = {
        loginKey: link.loginKey,
        groupKey: link.groupKey,
        bookletKey: link.bookletKey ?? "",
        displayName: link.displayName ?? ""
      };
      return {
        ...entryLink,
        url: this.buildParticipantEntryUrl(tenantKey, workspaceKey, entryLink)
      };
    });
  }

  private parseEntryLinksView(): RuntimeEntryLink[] {
    const payload = parseJsonDocument<{ links: RuntimeEntryLink[] }>(
      this.runtime.entryLinksView
    );
    return Array.isArray(payload?.links) ? payload.links : [];
  }

  private parseParticipantRosterView(): ListParticipantRosterResponse["items"] {
    const payload = parseJsonDocument<ListParticipantRosterResponse>(
      this.runtime.participantRosterView
    );
    return Array.isArray(payload?.items) ? payload.items : [];
  }

  private buildParticipantEntryUrl(
    tenantKey: string,
    workspaceKey: string,
    link: Omit<RuntimeEntryLink, "url">
  ): string {
    const query = new URLSearchParams();
    if (tenantKey) {
      query.set("tenantKey", tenantKey);
    }
    query.set("workspaceKey", workspaceKey || "demo-workspace");
    query.set("loginKey", link.loginKey);
    query.set("groupKey", link.groupKey);
    if (link.bookletKey) {
      query.set("bookletKey", link.bookletKey);
    }
    const participantPath = `/participant?${query.toString()}`;
    return this.browserOrigin
      ? `${this.browserOrigin}${participantPath}`
      : participantPath;
  }

  private get browserOrigin(): string {
    return globalThis.location?.origin ?? "";
  }

  private createEntryLinksCsv(links: RuntimeEntryLink[]): string {
    const rows = [
      ["loginKey", "groupKey", "bookletKey", "url", "displayName"],
      ...links.map(link => [
        link.loginKey,
        link.groupKey,
        link.bookletKey,
        link.url,
        link.displayName ?? ""
      ])
    ];
    return rows.map(row => row.map(value => this.escapeCsvValue(value)).join(",")).join("\n");
  }

  private escapeCsvValue(value: string): string {
    return `"${value.replace(/"/g, "\"\"")}"`;
  }

  private createUnitResponseItems(input: {
    testRunId: string;
    status: string;
    currentUnitKey: string | null;
    unitResponses: Record<string, string>;
  }): RecordCollectionItem[] {
    return Object.entries(input.unitResponses)
      .sort(([leftUnitKey], [rightUnitKey]) => leftUnitKey.localeCompare(rightUnitKey))
      .map(([unitKey, response]) => ({
        headline: unitKey,
        subline: input.testRunId,
        badges: [input.status, `${response.length} char(s)`],
        rows: [
          {
            label: "Response",
            value: this.formatResponsePreview(response)
          },
          {
            label: "Length",
            value: String(response.length)
          }
        ],
        selected:
          this.runtime.testRunId.trim() === input.testRunId &&
          this.runtime.currentUnitKey.trim() === unitKey,
        actionLabel: "Select Unit",
        actionPayload: {
          testRunId: input.testRunId,
          currentUnitKey: unitKey
        }
      }));
  }

  private formatResponsePreview(value: string): string {
    const normalized = value.trim();
    if (!normalized) {
      return "empty";
    }
    return normalized.length > 96 ? `${normalized.slice(0, 93)}...` : normalized;
  }

  private formatDateTime(value: string): string {
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  }
}
