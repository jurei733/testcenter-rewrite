import { Injectable, inject } from "@angular/core";
import { Router } from "@angular/router";

import type {
  GetStudyMonitorBookletResponse,
  GetStudyMonitorGroupResponse,
  GetStudyMonitorParticipantResponse,
  GetStudyMonitorParticipantMatrixResponse,
  GetStudyMonitorRunResponse,
  GetStudyMonitorSummaryResponse,
  GetStudyMonitorUnitResponse,
  GetWorkspaceOverviewResponse,
  ListParticipantSessionsResponse,
  ListTenantsResponse,
  ListWorkspacesResponse,
  ListWorkspaceActivityEventsResponse
} from "@testcenter-rewrite-app/contracts";
import {
  type WorkspaceStudyMonitorUnitProgress,
  workspaceActivityEventTypes,
  workspaceActivitySubjectTypes
} from "@testcenter-rewrite-app/domain";
import type { SummaryCard } from "./rewrite-app-shell.types";
import {
  parseJsonDocument,
  readNumberValue,
  readStringValue
} from "./rewrite-app-shell.readers";
import type {
  RecordCollectionAction,
  RecordCollectionItem
} from "./record-collection.component";
import {
  type ParticipantSessionEntryLinkContext,
  buildParticipantEntryUrl as buildParticipantEntryLinkUrl,
  participantSessionLinkRows as buildParticipantSessionLinkRows
} from "./participant-session-links";
import { RewriteAppContentService } from "./rewrite-app-content.service";
import { RewriteAppRuntimeService } from "./rewrite-app-runtime.service";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";
import { RewriteAppViewStateService } from "./rewrite-app-view-state.service";
import { RewriteAppWorkspaceService } from "./rewrite-app-workspace.service";

@Injectable({ providedIn: "root" })
export class WorkspaceViewFacade {
  private readonly contentService = inject(RewriteAppContentService);
  private readonly runtimeService = inject(RewriteAppRuntimeService);
  private readonly router = inject(Router);
  private readonly uiState = inject(RewriteAppUiStateService);
  private readonly viewState = inject(RewriteAppViewStateService);
  private readonly workspaceService = inject(RewriteAppWorkspaceService);

  readonly workspace = this.uiState.workspace;
  readonly workspaceActivityEventTypeOptions = workspaceActivityEventTypes;
  readonly workspaceActivitySubjectTypeOptions = workspaceActivitySubjectTypes;

  private readonly unitProgressBadges = (
    unit: WorkspaceStudyMonitorUnitProgress
  ): string[] => [
    `${unit.responseCount}/${unit.expectedRunCount} answered`,
    `${unit.missingResponseCount} missing`,
    ...(unit.unexpectedResponseCount > 0
      ? [`${unit.unexpectedResponseCount} unexpected`]
      : [])
  ];

  private readonly studyMonitorMatrixFilterAction = (
    payload: Record<string, string>
  ): RecordCollectionAction => ({
    label: "Show In Matrix",
    payload: {
      participantCommand: "filterStudyMonitorMatrixScope",
      ...payload
    }
  });

  private readonly monitorParticipantLabel = (item: {
    participantRosterEntry?: { displayName: string | null; loginKey: string } | null;
    participantSession?: { loginKey: string } | null;
  }): string =>
    item.participantRosterEntry?.displayName ??
    item.participantSession?.loginKey ??
    "unknown participant";

  private readonly monitorParticipantLogin = (item: {
    participantRosterEntry?: { loginKey: string } | null;
    participantSession?: { loginKey: string } | null;
  }): string =>
    item.participantSession?.loginKey ??
    item.participantRosterEntry?.loginKey ??
    "unknown participant";

  private readonly participantSessionLinkRows = (
    participantSessionId?: string | null,
    context: ParticipantSessionEntryLinkContext = {}
  ): ReturnType<typeof buildParticipantSessionLinkRows> =>
    buildParticipantSessionLinkRows(participantSessionId, {
      tenantKey: this.uiState.workspace.tenantKey,
      workspaceKey: this.uiState.workspace.workspaceKey,
      ...context
    });

  private readonly prepareRuntimeAction = (rosterEntry: {
    loginKey: string;
    groupKey?: string | null;
    bookletKey?: string | null;
  }): RecordCollectionAction => ({
    label: "Prepare Runtime",
    payload: {
      participantCommand: "prepareRuntime",
      participantLoginKey: rosterEntry.loginKey,
      groupKey: rosterEntry.groupKey ?? "",
      bookletKey: rosterEntry.bookletKey ?? ""
    }
  });

  private readonly openRuntimeActions = (
    payload: Record<string, string>
  ): RecordCollectionAction[] => {
    const testRunId = payload.testRunId?.trim();
    const participantSessionId = payload.participantSessionId?.trim();
    if (!testRunId || !participantSessionId) {
      return [];
    }

    return [
      {
        label: "Open In Runtime",
        payload: {
          ...payload,
          participantCommand: "openRuntime",
          subjectType: "test_run",
          subjectId: payload.subjectId?.trim() || testRunId,
          testRunId,
          participantSessionId
        }
      }
    ];
  };

  private readonly reviewResponseActions = (
    payload: Record<string, string>
  ): RecordCollectionAction[] => {
    const testRunId = payload.testRunId?.trim();
    const participantSessionId = payload.participantSessionId?.trim();
    if (!testRunId || !participantSessionId) {
      return [];
    }

    return [
      {
        label: "Review Response",
        payload: {
          ...payload,
          participantCommand: "reviewResponse",
          testRunId,
          participantSessionId
        }
      },
      ...this.openRuntimeActions(payload)
    ];
  };

  get workspaceActivityView(): string {
    return this.uiState.workspace.workspaceActivityView;
  }

  get workspaceLogExportView(): string {
    return this.uiState.workspace.workspaceLogExportView;
  }

  get studyMonitorExportView(): string {
    return this.uiState.workspace.studyMonitorExportView;
  }

  get studyMonitorParticipantMatrixExportView(): string {
    return this.uiState.workspace.studyMonitorParticipantMatrixExportView;
  }

  get studyMonitorParticipantMatrixItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetStudyMonitorParticipantMatrixResponse>(
      this.workspace.studyMonitorParticipantMatrixView
    );
    const matrix = payload?.studyMonitorParticipantMatrix;
    if (!matrix) {
      return [];
    }

    const loginFilter = this.workspace.studyMonitorMatrixLoginFilter
      .trim()
      .toLowerCase();
    const groupFilter = this.workspace.studyMonitorMatrixGroupFilter
      .trim()
      .toLowerCase();
    const bookletFilter = this.workspace.studyMonitorMatrixBookletFilter
      .trim()
      .toLowerCase();
    const unitFilter = this.workspace.studyMonitorMatrixUnitFilter
      .trim()
      .toLowerCase();
    const statusFilter = this.workspace.studyMonitorMatrixStatusFilter.trim();
    const answerFilter = this.workspace.studyMonitorMatrixAnswerFilter.trim();
    const limitValue = Number.parseInt(
      this.workspace.studyMonitorMatrixLimit,
      10
    );
    const visibleLimit = Number.isFinite(limitValue)
      ? Math.max(1, Math.min(limitValue, 200))
      : 25;
    const filteredRows = matrix.rows.filter(row => {
      if (
        loginFilter &&
        !`${row.loginKey} ${row.displayName ?? ""}`.toLowerCase().includes(loginFilter)
      ) {
        return false;
      }
      if (groupFilter && !row.groupKey.toLowerCase().includes(groupFilter)) {
        return false;
      }
      if (
        bookletFilter &&
        !`${row.bookletKey ?? ""} ${row.rosterBookletKey ?? ""}`
          .toLowerCase()
          .includes(bookletFilter)
      ) {
        return false;
      }
      if (
        unitFilter &&
        !`${row.unitKey} ${row.unitLabel}`.toLowerCase().includes(unitFilter)
      ) {
        return false;
      }
      if (statusFilter && row.testRunStatus !== statusFilter) {
        return false;
      }
      if (answerFilter === "answered" && !row.answered) {
        return false;
      }
      if (answerFilter === "missing" && row.answered) {
        return false;
      }
      return true;
    });

    const waitingRows = filteredRows.filter(
      row => row.testRunStatus === "not_started"
    );
    const activeRows = filteredRows.filter(row =>
      ["running", "paused"].includes(row.testRunStatus)
    );
    const missingRows = filteredRows.filter(row => row.expected && !row.answered);
    const displayedRows = filteredRows.slice(0, visibleLimit);
    const hiddenRowCount = Math.max(filteredRows.length - displayedRows.length, 0);

    return [
      {
        headline: `${matrix.workspaceKey} participant matrix`,
        subline: `${matrix.rows.length} participant-unit row(s), ${filteredRows.length} after filters, generated ${this.formatDateTime(matrix.generatedAt)}`,
        badges: [
          `${waitingRows.length} not started`,
          `${activeRows.length} active`,
          `${missingRows.length} missing answer(s)`,
          ...(hiddenRowCount > 0 ? [`${hiddenRowCount} more row(s)`] : [])
        ],
        rows: [
          { label: "Tenant", value: matrix.tenantKey },
          { label: "Workspace", value: matrix.workspaceKey },
          { label: "Total Rows", value: String(matrix.rows.length) },
          { label: "Filtered Rows", value: String(filteredRows.length) },
          { label: "Displayed Rows", value: String(displayedRows.length) },
          { label: "Hidden Rows", value: String(hiddenRowCount) },
          { label: "Visible Limit", value: String(visibleLimit) },
          { label: "Generated", value: this.formatDateTime(matrix.generatedAt) }
        ]
      },
      ...displayedRows.map(row => ({
        headline: row.displayName ?? row.loginKey,
        subline: `${row.unitLabel || row.unitKey || "No unit"} in ${row.bookletKey ?? "no booklet"}`,
        badges: [
          row.participantSessionStatus,
          row.testRunStatus,
          row.answered ? "answered" : "missing",
          `${row.reviewCount} review(s)`
        ],
        rows: [
          { label: "Login", value: row.loginKey },
          { label: "Group", value: row.groupKey },
          { label: "Roster Booklet", value: row.rosterBookletKey ?? "none" },
          { label: "Unit", value: row.unitKey || "none" },
          { label: "Expected", value: row.expected ? "yes" : "no" },
          { label: "Response Length", value: String(row.responseLength) },
          {
            label: "Latest Activity",
            value: row.latestActivityAt
              ? this.formatDateTime(row.latestActivityAt)
              : "none"
          }
        ],
        actionLabel: row.testRunId ? "Open Run Detail" : "Open Participant Detail",
        actionPayload: {
          participantLoginKey: row.loginKey,
          unitKey: row.unitKey,
          participantSessionId: row.participantSessionId ?? "",
          testRunId: row.testRunId ?? "",
          loginKey: row.loginKey,
          groupKey: row.groupKey,
          bookletKey: row.bookletKey ?? row.rosterBookletKey ?? "",
          currentUnitKey: row.unitKey
        },
        actions: this.openRuntimeActions({
          participantLoginKey: row.loginKey,
          unitKey: row.unitKey,
          participantSessionId: row.participantSessionId ?? "",
          testRunId: row.testRunId ?? "",
          loginKey: row.loginKey,
          groupKey: row.groupKey,
          bookletKey: row.bookletKey ?? row.rosterBookletKey ?? "",
          currentUnitKey: row.unitKey
        })
      }))
    ];
  }

  get studyMonitorParticipantItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetStudyMonitorParticipantResponse>(
      this.workspace.studyMonitorParticipantView
    );
    const detail = payload?.studyMonitorParticipant;
    if (!detail) {
      return [];
    }

    return [
      {
        headline: detail.displayName ?? detail.loginKey,
        subline: `${detail.groupKey ?? "no group"} in ${detail.rosterBookletKey ?? "no assigned booklet"}`,
        badges: [
          `${detail.participantSessionCount} session(s)`,
          `${detail.testRunCount} run(s)`,
          `${detail.responseCount} response(s)`,
          `${detail.reviewCount} review(s)`
        ],
        rows: [
          { label: "Login", value: detail.loginKey },
          { label: "Group", value: detail.groupKey ?? "none" },
          { label: "Display Name", value: detail.displayName ?? "none" },
          { label: "Roster Booklet", value: detail.rosterBookletKey ?? "none" },
          {
            label: "Latest Activity",
            value: detail.latestActivityAt
              ? this.formatDateTime(detail.latestActivityAt)
              : "none"
          },
          {
            label: "Generated",
            value: this.formatDateTime(detail.generatedAt)
          }
        ]
      },
      ...detail.unitRows.map(row => ({
        headline: row.unitLabel || row.unitKey || "No unit",
        subline: `${row.bookletKey ?? "no booklet"} / ${row.testRunStatus}`,
        badges: [
          row.expected ? "expected" : "unexpected",
          row.answered ? "answered" : "missing",
          row.participantSessionStatus,
          `${row.reviewCount} review(s)`
        ],
        rows: [
          { label: "Unit", value: row.unitKey || "none" },
          { label: "Booklet", value: row.bookletKey ?? "none" },
          { label: "Test Run", value: row.testRunId ?? "none" },
          ...this.participantSessionLinkRows(row.participantSessionId, {
            loginKey: row.loginKey,
            bookletKey: row.bookletKey
          }),
          { label: "Response Length", value: String(row.responseLength) },
          {
            label: "Latest Activity",
            value: row.latestActivityAt
              ? this.formatDateTime(row.latestActivityAt)
              : "none"
          }
        ],
        actionLabel: row.testRunId ? "Open Run Detail" : undefined,
        actionPayload: {
          subjectType: "test_run",
          subjectId: row.testRunId ?? "",
          testRunId: row.testRunId ?? "",
          participantSessionId: row.participantSessionId ?? "",
          loginKey: row.loginKey,
          groupKey: detail.groupKey ?? "",
          bookletKey: row.bookletKey ?? detail.rosterBookletKey ?? "",
          currentUnitKey: row.unitKey
        },
        actions: this.openRuntimeActions({
          subjectType: "test_run",
          subjectId: row.testRunId ?? "",
          testRunId: row.testRunId ?? "",
          participantSessionId: row.participantSessionId ?? "",
          loginKey: row.loginKey,
          groupKey: detail.groupKey ?? "",
          bookletKey: row.bookletKey ?? detail.rosterBookletKey ?? "",
          currentUnitKey: row.unitKey
        })
      })),
      ...detail.testRuns.map(item => ({
        headline: item.testRun.bookletKey,
        subline: item.testRun.testRunId,
        badges: [
          item.testRun.status,
          `${item.responseCount} response(s)`,
          `${item.reviewCount} review(s)`
        ],
        rows: [
          {
            label: "Participant Session",
            value: item.participantSession?.participantSessionId ?? "none"
          },
          ...this.participantSessionLinkRows(
            item.participantSession?.participantSessionId,
            {
              loginKey: item.participantSession?.loginKey,
              groupKey: item.participantSession?.groupKey,
              bookletKey: item.testRun.bookletKey
            }
          ),
          { label: "Current Unit", value: item.testRun.currentUnitKey ?? "none" },
          {
            label: "Started",
            value: this.formatDateTime(item.testRun.createdAt)
          },
          {
            label: "Updated",
            value: this.formatDateTime(item.testRun.updatedAt)
          }
        ],
        actionLabel: "Open Run Detail",
        actionPayload: {
          subjectType: "test_run",
          subjectId: item.testRun.testRunId,
          testRunId: item.testRun.testRunId,
          participantSessionId:
            item.participantSession?.participantSessionId ?? "",
          loginKey: detail.loginKey,
          groupKey: item.participantSession?.groupKey ?? detail.groupKey ?? "",
          bookletKey: item.testRun.bookletKey,
          currentUnitKey: item.testRun.currentUnitKey ?? ""
        },
        actions: this.openRuntimeActions({
          subjectType: "test_run",
          subjectId: item.testRun.testRunId,
          testRunId: item.testRun.testRunId,
          participantSessionId:
            item.participantSession?.participantSessionId ?? "",
          loginKey: detail.loginKey,
          groupKey: item.participantSession?.groupKey ?? detail.groupKey ?? "",
          bookletKey: item.testRun.bookletKey,
          currentUnitKey: item.testRun.currentUnitKey ?? ""
        })
      }))
    ];
  }

  get studyMonitorItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetStudyMonitorSummaryResponse>(
      this.workspace.studyMonitorView
    );
    const summary = payload?.studyMonitorSummary;
    if (!summary) {
      return [];
    }

    const missingResponseCount = summary.unitProgress.reduce(
      (total, unit) => total + unit.missingResponseCount,
      0
    );

    return [
      {
        headline: `${summary.workspaceKey} monitor`,
        subline: `${summary.expectedParticipantCount} expected participant(s), ${summary.participantSessionCount} session(s), ${summary.testRunCount} run(s)`,
        badges: [
          `${summary.groups.length} group(s)`,
          `${summary.unitProgress.length} unit(s)`,
          `${missingResponseCount} missing response(s)`
        ],
        rows: [
          { label: "Tenant", value: summary.tenantKey },
          {
            label: "Roster Entries",
            value: String(summary.rosterEntryCount)
          },
          {
            label: "Not Started",
            value: String(summary.notStartedCount)
          },
          { label: "Running", value: String(summary.runningCount) },
          { label: "Paused", value: String(summary.pausedCount) },
          { label: "Completed", value: String(summary.completedCount) },
          { label: "Responses", value: String(summary.responseCount) },
          { label: "Reviews", value: String(summary.reviewCount) },
          {
            label: "Generated",
            value: this.formatDateTime(summary.generatedAt)
          }
        ]
      },
      ...summary.groups.map(group => ({
        headline: group.groupKey,
        subline: `${group.expectedParticipantCount} expected, ${group.participantSessionCount} session(s)`,
        badges: [
          `${group.notStartedCount} not started`,
          `${group.runningCount} running`,
          `${group.pausedCount} paused`,
          `${group.completedCount} completed`,
          `${group.reviewCount ?? 0} review(s)`
        ],
        rows: [
          { label: "Roster Entries", value: String(group.rosterEntryCount) },
          { label: "Not Started", value: String(group.notStartedCount) },
          { label: "Test Runs", value: String(group.testRunCount) },
          { label: "Responses", value: String(group.responseCount) },
          { label: "Reviews", value: String(group.reviewCount ?? 0) },
          {
            label: "Latest Activity",
            value: group.latestActivityAt
              ? this.formatDateTime(group.latestActivityAt)
              : "none"
          }
        ],
        actionLabel: "Open Group Detail",
        actionPayload: { groupKey: group.groupKey },
        actions: [
          this.studyMonitorMatrixFilterAction({ groupKey: group.groupKey })
        ]
      })),
      ...summary.bookletProgress.map(booklet => ({
        headline: booklet.displayLabel,
        subline: `${booklet.expectedParticipantCount} expected, ${booklet.participantSessionCount} session(s)`,
        badges: [
          `${booklet.notStartedCount} not started`,
          `${booklet.runningCount} running`,
          `${booklet.pausedCount} paused`,
          `${booklet.completedCount} completed`,
          `${booklet.reviewCount} review(s)`
        ],
        rows: [
          { label: "Booklet", value: booklet.bookletKey },
          { label: "Roster Entries", value: String(booklet.rosterEntryCount) },
          { label: "Not Started", value: String(booklet.notStartedCount) },
          { label: "Participant Sessions", value: String(booklet.participantSessionCount) },
          { label: "Test Runs", value: String(booklet.testRunCount) },
          { label: "Responses", value: String(booklet.responseCount) },
          { label: "Units", value: String(booklet.unitCount) },
          {
            label: "Latest Activity",
            value: booklet.latestActivityAt
              ? this.formatDateTime(booklet.latestActivityAt)
              : "none"
          }
        ],
        actionLabel: "Open Booklet Detail",
        actionPayload: { bookletKey: booklet.bookletKey },
        actions: [
          this.studyMonitorMatrixFilterAction({
            bookletKey: booklet.bookletKey
          })
        ]
      })),
      ...summary.unitProgress.map(unit => ({
        headline: unit.displayLabel,
        subline: unit.unitKey,
        badges: this.unitProgressBadges(unit),
        rows: [
          { label: "Expected Runs", value: String(unit.expectedRunCount) },
          { label: "Roster Expected", value: String(unit.rosterExpectedCount) },
          { label: "Responses", value: String(unit.responseCount) },
          {
            label: "Unexpected Responses",
            value: String(unit.unexpectedResponseCount)
          },
          { label: "Completed Runs", value: String(unit.completedRunCount) },
          {
            label: "Latest Activity",
            value: unit.latestActivityAt
              ? this.formatDateTime(unit.latestActivityAt)
              : "none"
          }
        ],
        actionLabel: "Open Unit Detail",
        actionPayload: { unitKey: unit.unitKey },
        actions: [this.studyMonitorMatrixFilterAction({ unitKey: unit.unitKey })]
      }))
    ];
  }

  get studyMonitorStatusItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetStudyMonitorSummaryResponse>(
      this.workspace.studyMonitorView
    );
    const summary = payload?.studyMonitorSummary;
    if (!summary) {
      return [];
    }

    const statusCounts = [
      {
        headline: "Not Started",
        count: summary.notStartedCount,
        status: "not_started",
        badges: ["roster", "waiting"],
        detail: "Expected participants without a launched run."
      },
      {
        headline: "Running",
        count: summary.runningCount,
        status: "running",
        badges: ["active", "in progress"],
        detail: "Runs currently marked as running."
      },
      {
        headline: "Paused",
        count: summary.pausedCount,
        status: "paused",
        badges: ["active", "paused"],
        detail: "Runs saved as paused and resumable."
      },
      {
        headline: "Completed",
        count: summary.completedCount,
        status: "completed",
        badges: ["closed", "complete"],
        detail: "Runs completed by participants."
      }
    ];
    const totalStatusCount = statusCounts.reduce(
      (total, status) => total + status.count,
      0
    );

    return statusCounts.map(status => ({
      headline: status.headline,
      subline: `${status.count} participant state${status.count === 1 ? "" : "s"}`,
      badges: [
        ...status.badges,
        `${this.formatPercentage(status.count, totalStatusCount)}%`
      ],
      rows: [
        { label: "Count", value: String(status.count) },
        {
          label: "Share",
          value: `${this.formatPercentage(status.count, totalStatusCount)}%`
        },
        { label: "Total States", value: String(totalStatusCount) },
        { label: "Meaning", value: status.detail }
      ],
      actionLabel: "Show In Matrix",
      actionPayload: {
        participantCommand: "filterStudyMonitorMatrixStatus",
        testRunStatus: status.status
      }
    }));
  }

  get studyMonitorBookletProgressItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetStudyMonitorSummaryResponse>(
      this.workspace.studyMonitorView
    );
    const summary = payload?.studyMonitorSummary;
    if (!summary) {
      return [];
    }

    return summary.bookletProgress.map(booklet => ({
      headline: booklet.displayLabel,
      subline: `${booklet.bookletKey} · ${booklet.expectedParticipantCount} expected participant(s)`,
      badges: [
        `${booklet.notStartedCount} not started`,
        `${booklet.runningCount} running`,
        `${booklet.pausedCount} paused`,
        `${booklet.completedCount} completed`,
        `${booklet.reviewCount} review(s)`
      ],
      rows: [
        { label: "Booklet", value: booklet.bookletKey },
        { label: "Roster Entries", value: String(booklet.rosterEntryCount) },
        {
          label: "Participant Sessions",
          value: String(booklet.participantSessionCount)
        },
        { label: "Test Runs", value: String(booklet.testRunCount) },
        { label: "Responses", value: String(booklet.responseCount) },
        { label: "Units", value: String(booklet.unitCount) },
        {
          label: "Latest Activity",
          value: booklet.latestActivityAt
            ? this.formatDateTime(booklet.latestActivityAt)
            : "none"
        }
      ],
      actionLabel: "Open Booklet Detail",
      actionPayload: { bookletKey: booklet.bookletKey },
      actions: [
        this.studyMonitorMatrixFilterAction({
          bookletKey: booklet.bookletKey
        })
      ]
    }));
  }

  get studyMonitorUnitProgressItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetStudyMonitorSummaryResponse>(
      this.workspace.studyMonitorView
    );
    const summary = payload?.studyMonitorSummary;
    if (!summary) {
      return [];
    }

    return summary.unitProgress.map(unit => ({
      headline: unit.displayLabel,
      subline: unit.unitKey,
      badges: this.unitProgressBadges(unit),
      rows: [
        { label: "Expected Runs", value: String(unit.expectedRunCount) },
        { label: "Roster Expected", value: String(unit.rosterExpectedCount) },
        { label: "Responses", value: String(unit.responseCount) },
        { label: "Missing Responses", value: String(unit.missingResponseCount) },
        {
          label: "Unexpected Responses",
          value: String(unit.unexpectedResponseCount)
        },
        { label: "Completed Runs", value: String(unit.completedRunCount) },
        {
          label: "Latest Activity",
          value: unit.latestActivityAt
            ? this.formatDateTime(unit.latestActivityAt)
            : "none"
        }
      ],
      actionLabel: "Open Unit Detail",
      actionPayload: { unitKey: unit.unitKey },
      actions: [this.studyMonitorMatrixFilterAction({ unitKey: unit.unitKey })]
    }));
  }

  get studyMonitorAttentionItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetStudyMonitorSummaryResponse>(
      this.workspace.studyMonitorView
    );
    const summary = payload?.studyMonitorSummary;
    if (!summary) {
      return [];
    }

    const unitsByKey = new Map(
      summary.unitProgress.map(unit => [unit.unitKey, unit])
    );
    const groupsByKey = new Map(
      summary.groups.map(group => [group.groupKey, group])
    );
    const bookletsByKey = new Map(
      summary.bookletProgress.map(booklet => [booklet.bookletKey, booklet])
    );
    const items: RecordCollectionItem[] = [];

    for (const attention of summary.attentionItems) {
      if (attention.subjectType === "unit") {
        const unit = unitsByKey.get(attention.key);
        if (!unit) {
          continue;
        }
        items.push({
          headline: unit.displayLabel,
          subline: `${unit.missingResponseCount} missing response(s), ${unit.responseCount}/${unit.expectedRunCount} answered`,
          badges: [
            "unit",
            `${unit.missingResponseCount} missing`,
            ...(unit.unexpectedResponseCount > 0
              ? [`${unit.unexpectedResponseCount} unexpected`]
              : [])
          ],
          rows: [
            { label: "Unit", value: unit.unitKey },
            { label: "Expected Runs", value: String(unit.expectedRunCount) },
            { label: "Responses", value: String(unit.responseCount) },
            {
              label: "Missing Responses",
              value: String(unit.missingResponseCount)
            },
            {
              label: "Unexpected Responses",
              value: String(unit.unexpectedResponseCount)
            },
            {
              label: "Latest Activity",
              value: unit.latestActivityAt
                ? this.formatDateTime(unit.latestActivityAt)
                : "none"
            },
            {
              label: "Attention Score",
              value: String(attention.score)
            }
          ],
          actionLabel: "Open Unit Detail",
          actionPayload: { unitKey: unit.unitKey },
          actions: [
            this.studyMonitorMatrixFilterAction({ unitKey: unit.unitKey })
          ]
        });
        continue;
      }

      if (attention.subjectType === "group") {
        const group = groupsByKey.get(attention.key);
        if (!group) {
          continue;
        }
        const activeRunCount = group.runningCount + group.pausedCount;
        items.push({
          headline: group.groupKey,
          subline: `${group.notStartedCount} waiting, ${activeRunCount} active run(s)`,
          badges: [
            "group",
            `${group.notStartedCount} not started`,
            `${group.runningCount} running`,
            `${group.pausedCount} paused`
          ],
          rows: [
            {
              label: "Expected Participants",
              value: String(group.expectedParticipantCount)
            },
            { label: "Roster Entries", value: String(group.rosterEntryCount) },
            {
              label: "Participant Sessions",
              value: String(group.participantSessionCount)
            },
            { label: "Test Runs", value: String(group.testRunCount) },
            { label: "Responses", value: String(group.responseCount) },
            { label: "Reviews", value: String(group.reviewCount) },
            {
              label: "Attention Score",
              value: String(attention.score)
            }
          ],
          actionLabel: "Open Group Detail",
          actionPayload: { groupKey: group.groupKey },
          actions: [
            this.studyMonitorMatrixFilterAction({ groupKey: group.groupKey })
          ]
        });
        continue;
      }

      const booklet = bookletsByKey.get(attention.key);
      if (!booklet) {
        continue;
      }
      const activeRunCount = booklet.runningCount + booklet.pausedCount;
      items.push({
        headline: booklet.displayLabel,
        subline: `${booklet.notStartedCount} waiting, ${activeRunCount} active run(s), ${booklet.unitCount} unit(s)`,
        badges: [
          "booklet",
          `${booklet.notStartedCount} not started`,
          `${booklet.runningCount} running`,
          `${booklet.pausedCount} paused`
        ],
        rows: [
          { label: "Booklet", value: booklet.bookletKey },
          {
            label: "Expected Participants",
            value: String(booklet.expectedParticipantCount)
          },
          { label: "Roster Entries", value: String(booklet.rosterEntryCount) },
          {
            label: "Participant Sessions",
            value: String(booklet.participantSessionCount)
          },
          { label: "Test Runs", value: String(booklet.testRunCount) },
          { label: "Responses", value: String(booklet.responseCount) },
          { label: "Reviews", value: String(booklet.reviewCount) },
          {
            label: "Attention Score",
            value: String(attention.score)
          }
        ],
        actionLabel: "Open Booklet Detail",
        actionPayload: { bookletKey: booklet.bookletKey },
        actions: [
          this.studyMonitorMatrixFilterAction({
            bookletKey: booklet.bookletKey
          })
        ]
      });
    }

    return items;
  }

  get studyMonitorReviewQueueItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetStudyMonitorParticipantMatrixResponse>(
      this.workspace.studyMonitorParticipantMatrixView
    );
    const matrix = payload?.studyMonitorParticipantMatrix;
    if (!matrix) {
      return [];
    }

    return matrix.rows
      .filter(row => row.answered && row.testRunId && row.participantSessionId)
      .sort((left, right) => {
        const reviewDelta = left.reviewCount - right.reviewCount;
        if (reviewDelta !== 0) {
          return reviewDelta;
        }
        return (right.latestActivityAt ?? "").localeCompare(
          left.latestActivityAt ?? ""
        );
      })
      .slice(0, 12)
      .map(row => {
        const actionPayload = {
          participantLoginKey: row.loginKey,
          unitKey: row.unitKey,
          subjectType: "test_run",
          subjectId: row.testRunId ?? "",
          testRunId: row.testRunId ?? "",
          participantSessionId: row.participantSessionId ?? "",
          loginKey: row.loginKey,
          groupKey: row.groupKey,
          bookletKey: row.bookletKey ?? row.rosterBookletKey ?? "",
          currentUnitKey: row.unitKey
        };

        return {
          headline: row.displayName ?? row.loginKey,
          subline: `${row.unitLabel || row.unitKey || "No unit"} in ${row.bookletKey ?? "no booklet"}`,
          badges: [
            "answered",
            row.reviewCount > 0 ? "reviewed" : "needs review",
            row.testRunStatus,
            `${row.reviewCount} review(s)`
          ],
          rows: [
            { label: "Login", value: row.loginKey },
            { label: "Group", value: row.groupKey },
            { label: "Unit", value: row.unitKey || "none" },
            { label: "Booklet", value: row.bookletKey ?? "none" },
            { label: "Test Run", value: row.testRunId ?? "none" },
            { label: "Response Length", value: String(row.responseLength) },
            { label: "Reviews", value: String(row.reviewCount) },
            {
              label: "Latest Activity",
              value: row.latestActivityAt
                ? this.formatDateTime(row.latestActivityAt)
                : "none"
            }
          ],
          actionLabel: "Open Run Detail",
          actionPayload,
          actions: this.reviewResponseActions(actionPayload)
        };
      });
  }

  get studyMonitorNotStartedItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetStudyMonitorSummaryResponse>(
      this.workspace.studyMonitorView
    );
    const notStartedParticipants =
      payload?.studyMonitorSummary.notStartedParticipants ?? [];
    return notStartedParticipants.map(rosterEntry => ({
      headline: rosterEntry.displayName ?? rosterEntry.loginKey,
      subline: rosterEntry.loginKey,
      badges: [
        "not started",
        rosterEntry.groupKey,
        rosterEntry.bookletKey ?? "default booklet"
      ],
      rows: [
        { label: "Login", value: rosterEntry.loginKey },
        { label: "Group", value: rosterEntry.groupKey },
        { label: "Booklet", value: rosterEntry.bookletKey ?? "none" },
        { label: "Display Name", value: rosterEntry.displayName ?? "none" },
        {
          label: "Entry URL",
          value: this.buildParticipantEntryUrl(rosterEntry),
          href: this.buildParticipantEntryUrl(rosterEntry)
        },
        { label: "Imported", value: this.formatDateTime(rosterEntry.importedAt) }
      ],
      actionLabel: "Prepare Runtime",
      actionPayload: {
        participantCommand: "prepareRuntime",
        participantLoginKey: rosterEntry.loginKey,
        groupKey: rosterEntry.groupKey,
        bookletKey: rosterEntry.bookletKey ?? ""
      }
    }));
  }

  get studyMonitorBookletItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetStudyMonitorBookletResponse>(
      this.workspace.studyMonitorBookletView
    );
    const detail = payload?.studyMonitorBooklet;
    if (!detail) {
      return [];
    }

    const startedRosterLoginKeys = new Set(
      detail.testRuns
        .map(
          item =>
            item.participantSession?.loginKey ??
            item.participantRosterEntry?.loginKey ??
            ""
        )
        .filter(loginKey => loginKey.length > 0)
    );

    return [
      {
        headline: detail.displayLabel,
        subline: `${detail.expectedParticipantCount} expected, ${detail.participantSessionCount} session(s), ${detail.testRunCount} run(s)`,
        badges: [
          `${detail.notStartedCount} not started`,
          `${detail.testRunCount} run(s)`,
          `${detail.responseCount} response(s)`,
          `${detail.reviewCount} review(s)`,
          `${detail.unitCount} unit(s)`
        ],
        rows: [
          { label: "Tenant", value: detail.tenantKey },
          { label: "Workspace", value: detail.workspaceKey },
          { label: "Booklet", value: detail.bookletKey },
          { label: "Roster Entries", value: String(detail.rosterEntryCount) },
          { label: "Not Started", value: String(detail.notStartedCount) },
          { label: "Participant Sessions", value: String(detail.participantSessionCount) },
          { label: "Created Runs", value: String(detail.createdCount) },
          { label: "Running Runs", value: String(detail.runningCount) },
          { label: "Paused Runs", value: String(detail.pausedCount) },
          { label: "Completed Runs", value: String(detail.completedCount) },
          {
            label: "Generated",
            value: this.formatDateTime(detail.generatedAt)
          }
        ]
      },
      ...detail.rosterEntries.map(rosterEntry => ({
        headline: rosterEntry.displayName ?? rosterEntry.loginKey,
        subline: rosterEntry.loginKey,
        badges: [
          "roster entry",
          rosterEntry.groupKey,
          detail.testRuns.some(
            item => item.participantSession?.loginKey === rosterEntry.loginKey
          )
            ? "started"
            : "not started"
        ],
        rows: [
          { label: "Login", value: rosterEntry.loginKey },
          { label: "Group", value: rosterEntry.groupKey },
          {
            label: "Display Name",
            value: rosterEntry.displayName ?? "none"
          },
          {
            label: "Entry URL",
            value: this.buildParticipantEntryUrl(rosterEntry),
            href: this.buildParticipantEntryUrl(rosterEntry)
          },
          {
            label: "Imported",
            value: this.formatDateTime(rosterEntry.importedAt)
          }
        ],
        actionLabel: "Open Participant Detail",
        actionPayload: {
          participantLoginKey: rosterEntry.loginKey,
          groupKey: rosterEntry.groupKey
        },
        actions: startedRosterLoginKeys.has(rosterEntry.loginKey)
          ? []
          : [this.prepareRuntimeAction(rosterEntry)]
      })),
      ...detail.unitProgress.map(unit => ({
        headline: unit.displayLabel,
        subline: unit.unitKey,
        badges: this.unitProgressBadges(unit),
        rows: [
          { label: "Expected Runs", value: String(unit.expectedRunCount) },
          { label: "Roster Expected", value: String(unit.rosterExpectedCount) },
          { label: "Responses", value: String(unit.responseCount) },
          {
            label: "Unexpected Responses",
            value: String(unit.unexpectedResponseCount)
          },
          { label: "Completed Runs", value: String(unit.completedRunCount) },
          {
            label: "Latest Activity",
            value: unit.latestActivityAt
              ? this.formatDateTime(unit.latestActivityAt)
              : "none"
          }
        ],
        actionLabel: "Open Unit Detail",
        actionPayload: { unitKey: unit.unitKey }
      })),
      ...detail.testRuns.map(item => ({
        headline: this.monitorParticipantLabel(item),
        subline: item.testRun.testRunId,
        badges: [
          item.participantRosterEntry ? "roster" : "ad hoc",
          item.testRun.status,
          item.testRun.bookletKey
        ],
        rows: [
          {
            label: "Login",
            value: this.monitorParticipantLogin(item)
          },
          {
            label: "Display Name",
            value: item.participantRosterEntry?.displayName ?? "none"
          },
          { label: "Group", value: item.participantSession?.groupKey ?? "unknown group" },
          ...this.participantSessionLinkRows(
            item.participantSession?.participantSessionId,
            {
              loginKey: this.monitorParticipantLogin(item),
              groupKey: item.participantSession?.groupKey,
              bookletKey: item.testRun.bookletKey
            }
          ),
          { label: "Current Unit", value: item.testRun.currentUnitKey ?? "none" },
          { label: "Responses", value: String(item.responseCount) },
          { label: "Reviews", value: String(item.reviewCount) },
          {
            label: "Updated",
            value: this.formatDateTime(item.testRun.updatedAt)
          }
        ],
        actionLabel: "Open Run Detail",
        actionPayload: {
          subjectType: "test_run",
          subjectId: item.testRun.testRunId,
          testRunId: item.testRun.testRunId,
          participantSessionId:
            item.participantSession?.participantSessionId ?? "",
          loginKey: item.participantSession?.loginKey ?? "",
          groupKey:
            item.participantSession?.groupKey ??
            item.participantRosterEntry?.groupKey ??
            "",
          bookletKey: item.testRun.bookletKey,
          currentUnitKey: item.testRun.currentUnitKey ?? ""
        },
        actions: this.openRuntimeActions({
          subjectType: "test_run",
          subjectId: item.testRun.testRunId,
          testRunId: item.testRun.testRunId,
          participantSessionId:
            item.participantSession?.participantSessionId ?? "",
          loginKey: item.participantSession?.loginKey ?? "",
          groupKey:
            item.participantSession?.groupKey ??
            item.participantRosterEntry?.groupKey ??
            "",
          bookletKey: item.testRun.bookletKey,
          currentUnitKey: item.testRun.currentUnitKey ?? ""
        })
      }))
    ];
  }

  get studyMonitorGroupItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetStudyMonitorGroupResponse>(
      this.workspace.studyMonitorGroupView
    );
    const detail = payload?.studyMonitorGroup;
    if (!detail) {
      return [];
    }

    const signedInRosterLoginKeys = new Set(
      detail.sessions.map(session => session.participantSession.loginKey)
    );

    return [
      {
        headline: detail.groupKey,
        subline: `${detail.expectedParticipantCount} expected, ${detail.participantSessionCount} session(s), ${detail.testRunCount} run(s)`,
        badges: [
          `${detail.runningCount} running`,
          `${detail.pausedCount} paused`,
          `${detail.completedCount} completed`,
          `${detail.notStartedCount} not started`,
          `${detail.responseCount} response(s)`,
          `${detail.reviewCount} review(s)`
        ],
        rows: [
          { label: "Tenant", value: detail.tenantKey },
          { label: "Workspace", value: detail.workspaceKey },
          { label: "Roster Entries", value: String(detail.rosterEntryCount) },
          { label: "Tracked Units", value: String(detail.unitProgress.length) },
          {
            label: "Generated",
            value: this.formatDateTime(detail.generatedAt)
          },
          {
            label: "Latest Session",
            value:
              detail.sessions[0]?.participantRosterEntry?.displayName ??
              detail.sessions[0]?.participantSession.loginKey ??
              "no participant sessions"
          },
          {
            label: "Latest Run",
            value: detail.testRuns[0]?.testRun.status ?? "no runs"
          },
          {
            label: "Missing Responses",
            value: String(
              detail.unitProgress.reduce(
                (total, unit) => total + unit.missingResponseCount,
                0
              )
            )
          }
        ]
      },
      ...detail.rosterEntries.map(rosterEntry => ({
        headline: rosterEntry.displayName ?? rosterEntry.loginKey,
        subline: rosterEntry.loginKey,
        badges: [
          "roster entry",
          rosterEntry.bookletKey ? rosterEntry.bookletKey : "no booklet",
          signedInRosterLoginKeys.has(rosterEntry.loginKey)
            ? "signed in"
            : "not signed in"
        ],
        rows: [
          { label: "Login", value: rosterEntry.loginKey },
          { label: "Group", value: rosterEntry.groupKey },
          {
            label: "Booklet",
            value: rosterEntry.bookletKey ?? "none"
          },
          {
            label: "Display Name",
            value: rosterEntry.displayName ?? "none"
          },
          {
            label: "Entry URL",
            value: this.buildParticipantEntryUrl(rosterEntry),
            href: this.buildParticipantEntryUrl(rosterEntry)
          },
          {
            label: "Imported",
            value: this.formatDateTime(rosterEntry.importedAt)
          }
        ],
        actionLabel: "Open Participant Detail",
        actionPayload: {
          participantLoginKey: rosterEntry.loginKey,
          groupKey: rosterEntry.groupKey
        },
        actions: signedInRosterLoginKeys.has(rosterEntry.loginKey)
          ? []
          : [this.prepareRuntimeAction(rosterEntry)]
      })),
      ...detail.sessions.map(session => ({
        headline: this.monitorParticipantLabel(session),
        subline: session.participantSession.loginKey,
        badges: [
          session.participantRosterEntry ? "roster" : "ad hoc",
          session.participantSession.status,
          session.latestTestRun?.status ?? "not started"
        ],
        rows: [
          {
            label: "Display Name",
            value: session.participantRosterEntry?.displayName ?? "none"
          },
          {
            label: "Session",
            value: session.participantSession.participantSessionId
          },
          ...this.participantSessionLinkRows(
            session.participantSession.participantSessionId,
            {
              loginKey: session.participantSession.loginKey,
              groupKey: session.participantSession.groupKey,
              bookletKey:
                session.participantRosterEntry?.bookletKey ??
                session.latestTestRun?.bookletKey
            }
          ),
          {
            label: "Booklet",
            value: session.participantRosterEntry?.bookletKey ?? "none"
          },
          { label: "Runs", value: String(session.testRunCount) },
          { label: "Responses", value: String(session.responseCount) },
          { label: "Reviews", value: String(session.reviewCount) },
          {
            label: "Latest Activity",
            value: session.latestActivityAt
              ? this.formatDateTime(session.latestActivityAt)
              : "none"
          }
        ],
        actionLabel: "Open Participant Detail",
        actionPayload: {
          participantLoginKey: session.participantSession.loginKey,
          subjectType: "participant_session",
          subjectId: session.participantSession.participantSessionId,
          loginKey: session.participantSession.loginKey,
          groupKey: session.participantSession.groupKey,
          bookletKey:
            session.participantRosterEntry?.bookletKey ??
            session.latestTestRun?.bookletKey ??
            ""
        }
      })),
      ...detail.unitProgress.map(unit => ({
        headline: unit.displayLabel,
        subline: unit.unitKey,
        badges: this.unitProgressBadges(unit),
        rows: [
          { label: "Expected Runs", value: String(unit.expectedRunCount) },
          { label: "Roster Expected", value: String(unit.rosterExpectedCount) },
          { label: "Responses", value: String(unit.responseCount) },
          {
            label: "Unexpected Responses",
            value: String(unit.unexpectedResponseCount)
          },
          { label: "Completed Runs", value: String(unit.completedRunCount) },
          {
            label: "Latest Activity",
            value: unit.latestActivityAt
              ? this.formatDateTime(unit.latestActivityAt)
              : "none"
          }
        ],
        actionLabel: "Open Unit Detail",
        actionPayload: { unitKey: unit.unitKey }
      })),
      ...detail.testRuns.map(item => ({
        headline: this.monitorParticipantLabel(item),
        subline: item.testRun.testRunId,
        badges: [
          item.participantRosterEntry ? "roster" : "ad hoc",
          item.testRun.status,
          item.testRun.bookletKey
        ],
        rows: [
          {
            label: "Login",
            value: this.monitorParticipantLogin(item)
          },
          {
            label: "Display Name",
            value: item.participantRosterEntry?.displayName ?? "none"
          },
          ...this.participantSessionLinkRows(
            item.participantSession?.participantSessionId,
            {
              loginKey: this.monitorParticipantLogin(item),
              groupKey: item.participantSession?.groupKey,
              bookletKey: item.testRun.bookletKey
            }
          ),
          { label: "Current Unit", value: item.testRun.currentUnitKey ?? "none" },
          { label: "Responses", value: String(item.responseCount) },
          { label: "Reviews", value: String(item.reviewCount) },
          {
            label: "Updated",
            value: this.formatDateTime(item.testRun.updatedAt)
          }
        ],
        actionLabel: "Open Run Detail",
        actionPayload: {
          subjectType: "test_run",
          subjectId: item.testRun.testRunId,
          testRunId: item.testRun.testRunId,
          participantSessionId:
            item.participantSession?.participantSessionId ?? "",
          loginKey: item.participantSession?.loginKey ?? "",
          groupKey:
            item.participantSession?.groupKey ??
            item.participantRosterEntry?.groupKey ??
            "",
          bookletKey: item.testRun.bookletKey,
          currentUnitKey: item.testRun.currentUnitKey ?? ""
        },
        actions: this.openRuntimeActions({
          subjectType: "test_run",
          subjectId: item.testRun.testRunId,
          testRunId: item.testRun.testRunId,
          participantSessionId:
            item.participantSession?.participantSessionId ?? "",
          loginKey: item.participantSession?.loginKey ?? "",
          groupKey:
            item.participantSession?.groupKey ??
            item.participantRosterEntry?.groupKey ??
            "",
          bookletKey: item.testRun.bookletKey,
          currentUnitKey: item.testRun.currentUnitKey ?? ""
        })
      }))
    ];
  }

  get studyMonitorUnitItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetStudyMonitorUnitResponse>(
      this.workspace.studyMonitorUnitView
    );
    const detail = payload?.studyMonitorUnit;
    if (!detail) {
      return [];
    }

    return [
      {
        headline: detail.displayLabel,
        subline: detail.unitKey,
        badges: [
          `${detail.responseCount}/${detail.expectedRunCount} answered`,
          `${detail.missingResponseCount} missing`,
          ...(detail.unexpectedResponseCount > 0
            ? [`${detail.unexpectedResponseCount} unexpected`]
            : []),
          `${detail.reviewCount} review(s)`
        ],
        rows: [
          { label: "Tenant", value: detail.tenantKey },
          { label: "Workspace", value: detail.workspaceKey },
          {
            label: "Roster Expected",
            value: String(detail.rosterExpectedCount)
          },
          {
            label: "Unexpected Responses",
            value: String(detail.unexpectedResponseCount)
          },
          { label: "Completed Runs", value: String(detail.completedRunCount) },
          {
            label: "Generated",
            value: this.formatDateTime(detail.generatedAt)
          }
        ]
      },
      ...detail.rosterEntries.map(rosterEntry => ({
        headline: rosterEntry.displayName ?? rosterEntry.loginKey,
        subline: rosterEntry.loginKey,
        badges: ["roster expected", "missing", rosterEntry.bookletKey ?? "no booklet"],
        rows: [
          { label: "Login", value: rosterEntry.loginKey },
          { label: "Group", value: rosterEntry.groupKey },
          {
            label: "Booklet",
            value: rosterEntry.bookletKey ?? "none"
          },
          {
            label: "Entry URL",
            value: this.buildParticipantEntryUrl(rosterEntry),
            href: this.buildParticipantEntryUrl(rosterEntry)
          },
          {
            label: "Imported",
            value: this.formatDateTime(rosterEntry.importedAt)
          }
        ],
        actionLabel: "Open Participant Detail",
        actionPayload: {
          participantLoginKey: rosterEntry.loginKey,
          groupKey: rosterEntry.groupKey
        },
        actions: [this.prepareRuntimeAction(rosterEntry)]
      })),
      ...detail.testRuns.map(item => ({
        headline: this.monitorParticipantLabel(item),
        subline: item.testRun.testRunId,
        badges: [
          item.participantRosterEntry ? "roster" : "ad hoc",
          item.testRun.status,
          item.answered ? "answered" : "missing",
          `${item.reviewCount} review(s)`
        ],
        rows: [
          {
            label: "Login",
            value: this.monitorParticipantLogin(item)
          },
          {
            label: "Display Name",
            value: item.participantRosterEntry?.displayName ?? "none"
          },
          {
            label: "Group",
            value: item.participantSession?.groupKey ?? "unknown group"
          },
          ...this.participantSessionLinkRows(
            item.participantSession?.participantSessionId,
            {
              loginKey: this.monitorParticipantLogin(item),
              groupKey: item.participantSession?.groupKey,
              bookletKey: item.testRun.bookletKey
            }
          ),
          { label: "Booklet", value: item.testRun.bookletKey },
          { label: "Expected", value: item.expected ? "yes" : "no" },
          { label: "Response Length", value: String(item.responseLength) },
          {
            label: "Updated",
            value: this.formatDateTime(item.testRun.updatedAt)
          }
        ],
        actionLabel: "Open Run Detail",
        actionPayload: {
          subjectType: "test_run",
          subjectId: item.testRun.testRunId,
          testRunId: item.testRun.testRunId,
          participantSessionId:
            item.participantSession?.participantSessionId ?? "",
          loginKey: item.participantSession?.loginKey ?? "",
          groupKey:
            item.participantSession?.groupKey ??
            item.participantRosterEntry?.groupKey ??
            "",
          bookletKey: item.testRun.bookletKey,
          currentUnitKey: detail.unitKey
        },
        actions: this.openRuntimeActions({
          subjectType: "test_run",
          subjectId: item.testRun.testRunId,
          testRunId: item.testRun.testRunId,
          participantSessionId:
            item.participantSession?.participantSessionId ?? "",
          loginKey: item.participantSession?.loginKey ?? "",
          groupKey:
            item.participantSession?.groupKey ??
            item.participantRosterEntry?.groupKey ??
            "",
          bookletKey: item.testRun.bookletKey,
          currentUnitKey: detail.unitKey
        })
      }))
    ];
  }

  get studyMonitorRunItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetStudyMonitorRunResponse>(
      this.workspace.studyMonitorRunView
    );
    const detail = payload?.studyMonitorRun;
    if (!detail) {
      return [];
    }

    const participantLogin =
      detail.participantSession?.loginKey ??
      detail.participantRosterEntry?.loginKey ??
      "unknown participant";
    const participantSessionId =
      detail.participantSession?.participantSessionId ?? "";
    const participantGroupKey = detail.participantSession?.groupKey ?? "";
    const runActionPayload = {
      subjectType: "test_run",
      subjectId: detail.testRun.testRunId,
      testRunId: detail.testRun.testRunId,
      participantSessionId,
      loginKey: participantLogin,
      groupKey: participantGroupKey,
      bookletKey: detail.bookletKey,
      currentUnitKey: detail.testRun.currentUnitKey ?? ""
    };

    return [
      {
        headline: detail.bookletLabel,
        subline: detail.testRun.testRunId,
        badges: [
          detail.testRun.status,
          `${detail.responseCount}/${detail.expectedUnitCount} response(s)`,
          `${detail.missingExpectedUnitCount} missing`,
          `${detail.reviewCount} review(s)`
        ],
        rows: [
          { label: "Tenant", value: detail.tenantKey },
          { label: "Workspace", value: detail.workspaceKey },
          { label: "Login", value: participantLogin },
          { label: "Group", value: detail.participantSession?.groupKey ?? "none" },
          { label: "Booklet", value: detail.bookletKey },
          { label: "Current Unit", value: detail.testRun.currentUnitKey ?? "none" },
          { label: "Unexpected Responses", value: String(detail.unexpectedResponseCount) },
          { label: "Updated", value: this.formatDateTime(detail.testRun.updatedAt) },
          { label: "Generated", value: this.formatDateTime(detail.generatedAt) }
        ],
        actionLabel: "Open In Runtime",
        actionPayload: runActionPayload
      },
      ...detail.units.map(unit => {
        const unitActionPayload = {
          ...runActionPayload,
          unitKey: unit.unitKey,
          currentUnitKey: unit.unitKey
        };

        return {
          headline: unit.displayLabel,
          subline: unit.unitKey,
          badges: [
            unit.expected ? "expected" : "unexpected",
            unit.answered ? "answered" : "missing",
            unit.current ? "current" : "not current",
            `${unit.reviewCount} review(s)`
          ],
          rows: [
            { label: "Expected", value: unit.expected ? "yes" : "no" },
            { label: "Answered", value: unit.answered ? "yes" : "no" },
            { label: "Response Length", value: String(unit.responseLength) },
            { label: "Reviews", value: String(unit.reviewCount) },
            { label: "Current Unit", value: unit.current ? "yes" : "no" }
          ],
          actionLabel: "Open Unit Detail",
          actionPayload: unitActionPayload,
          actions: unit.answered
            ? this.reviewResponseActions(unitActionPayload)
            : this.openRuntimeActions(unitActionPayload)
        };
      }),
      ...detail.reviews.map(review => ({
        headline: `${review.category} by ${review.reviewerId}`,
        subline: review.unitKey ?? "whole run",
        badges: ["review", review.category],
        rows: [
          { label: "Review", value: review.reviewId },
          { label: "Unit", value: review.unitKey ?? "whole run" },
          { label: "Comment", value: review.comment },
          { label: "Created", value: this.formatDateTime(review.createdAt) },
          { label: "Updated", value: this.formatDateTime(review.updatedAt) }
        ]
      }))
    ];
  }

  get workspaceActionItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetWorkspaceOverviewResponse>(
      this.workspace.workspaceOverviewView
    );
    const detail = payload?.workspaceOverview;
    const items: RecordCollectionItem[] = [];
    const tenantKey = this.workspace.tenantKey.trim();
    const workspaceKey = this.workspace.workspaceKey.trim();

    if (!detail) {
      items.push({
        headline: "Bootstrap workspace scope",
        subline: workspaceKey || "workspace key missing",
        badges: ["setup", tenantKey ? "tenant ready" : "tenant missing"],
        rows: [
          {
            label: "Tenant",
            value: tenantKey || "enter a tenant key first"
          },
          {
            label: "Workspace",
            value: workspaceKey || "enter a workspace key first"
          },
          {
            label: "Expected Result",
            value: "Create or reuse the tenant and workspace, then load the overview"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { workspaceCommand: "bootstrapWorkspace" }
      });
      return items;
    }

    if (detail.sourcePackageCount === 0) {
      items.push({
        headline: "Start content intake",
        subline: "No packages have been imported yet",
        badges: ["content", "empty"],
        rows: [
          {
            label: "Active Release",
            value: detail.activeContentReleaseId ?? "none"
          },
          {
            label: "Expected Result",
            value: "Open Content with the current scope and load its read models"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { workspaceCommand: "openContent" }
      });
    } else if (!detail.activeContentReleaseId) {
      items.push({
        headline: "Finish release activation",
        subline: `${detail.sourcePackageCount} package(s), ${detail.contentReleaseCount} release(s)`,
        badges: ["content", "activation"],
        rows: [
          {
            label: "Imports",
            value: String(detail.importJobCount)
          },
          {
            label: "Expected Result",
            value: "Open Content to check readiness or activate a staged release"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { workspaceCommand: "openContent" }
      });
    }

    if (detail.activeContentReleaseId && detail.participantSessionCount === 0) {
      items.push({
        headline: "Start participant runtime",
        subline: detail.activeContentReleaseId,
        badges: ["runtime", "no sessions"],
        rows: [
          {
            label: "Participant Sessions",
            value: "0"
          },
          {
            label: "Expected Result",
            value: "Open Runtime so a participant can sign in against the active release"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { workspaceCommand: "openRuntime" }
      });
    }

    if (detail.openTestRunCount > 0) {
      items.push({
        headline: "Review open runtime blockers",
        subline: `${detail.openTestRunCount} open run(s)`,
        badges: ["runtime", "activation guard"],
        rows: [
          {
            label: "Active Release",
            value: detail.activeContentReleaseId ?? "none"
          },
          {
            label: "Expected Result",
            value: "Open Runtime and refresh monitor state for active runs"
          }
        ],
        actionLabel: "Apply Suggestion",
        actionPayload: { workspaceCommand: "openRuntime" }
      });
    }

    items.push({
      headline: "Refresh workspace overview",
      subline: `${detail.sourcePackageCount} package(s), ${detail.participantSessionCount} participant session(s)`,
      badges: ["read model"],
      rows: [
        {
          label: "Latest Import",
          value: detail.latestImportJobAt
            ? this.formatDateTime(detail.latestImportJobAt)
            : "none"
        },
        {
          label: "Expected Result",
          value: "Reload release, import, participant, and open-run counters"
        }
      ],
      actionLabel: "Apply Suggestion",
      actionPayload: { workspaceCommand: "refreshWorkspaceOverview" }
    });

    return items;
  }

  get workspaceOverviewItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetWorkspaceOverviewResponse>(
      this.workspace.workspaceOverviewView
    );
    const detail = payload?.workspaceOverview;
    if (!detail) {
      return [];
    }

    return [
      {
        headline: detail.workspace.displayName,
        subline: detail.workspace.workspaceKey,
        badges: [
          detail.activeContentReleaseId ?? "no active release",
          `${detail.openTestRunCount} open run(s)`
        ],
        rows: [
          {
            label: "Tenant",
            value: detail.tenant.tenantKey
          },
          {
            label: "Packages / Imports",
            value: `${detail.sourcePackageCount} / ${detail.importJobCount}`
          },
          {
            label: "Releases / Sessions",
            value: `${detail.contentReleaseCount} / ${detail.participantSessionCount}`
          },
          {
            label: "Latest Import",
            value: detail.latestImportJobAt
              ? this.formatDateTime(detail.latestImportJobAt)
              : "none"
          }
        ]
      }
    ];
  }

  get workspaceScopeItems(): RecordCollectionItem[] {
    return [
      {
        headline: this.workspace.workspaceKey || "workspace not set",
        subline: this.workspace.tenantKey || "tenant not set",
        badges: [
          this.workspace.autoRefreshEnabled ? "auto refresh on" : "auto refresh off",
          `${this.workspace.autoRefreshSeconds}s`
        ],
        rows: [
          {
            label: "Tenant Key",
            value: this.workspace.tenantKey || "n/a"
          },
          {
            label: "Workspace Key",
            value: this.workspace.workspaceKey || "n/a"
          },
          {
            label: "Refresh Mode",
            value: this.workspace.autoRefreshEnabled ? "automatic" : "manual"
          },
          {
            label: "Refresh Interval",
            value: `${this.workspace.autoRefreshSeconds}s`
          }
        ]
      }
    ];
  }

  get tenantDirectoryItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ListTenantsResponse>(
      this.workspace.tenantsView
    );
    if (!payload) {
      return [];
    }

    return [
      this.buildDirectoryWindowItem(
        "Tenant directory window",
        "tenant",
        payload.items.length,
        [
          { label: "Scope", value: "platform" },
          { label: "Selected Tenant", value: this.workspace.tenantKey || "none" }
        ]
      ),
      ...payload.items.map(tenant => ({
        headline: tenant.displayName,
        subline: tenant.tenantKey,
        badges: [tenant.status],
        rows: [
          { label: "Tenant ID", value: tenant.tenantId },
          { label: "Created", value: this.formatDateTime(tenant.createdAt) }
        ],
        selected: tenant.tenantKey === this.workspace.tenantKey,
        actionLabel: "Use Tenant",
        actionPayload: { tenantKey: tenant.tenantKey }
      }))
    ];
  }

  get workspaceDirectoryItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ListWorkspacesResponse>(
      this.workspace.workspacesView
    );
    if (!payload) {
      return [];
    }

    return [
      this.buildDirectoryWindowItem(
        "Workspace directory window",
        "workspace",
        payload.items.length,
        [
          { label: "Tenant Scope", value: this.workspace.tenantKey || "none" },
          {
            label: "Selected Workspace",
            value: this.workspace.workspaceKey || "none"
          }
        ]
      ),
      ...payload.items.map(workspace => ({
        headline: workspace.displayName,
        subline: workspace.workspaceKey,
        badges: [workspace.status],
        rows: [
          { label: "Workspace ID", value: workspace.workspaceId },
          { label: "Tenant ID", value: workspace.tenantId },
          { label: "Created", value: this.formatDateTime(workspace.createdAt) }
        ],
        selected: workspace.workspaceKey === this.workspace.workspaceKey,
        actionLabel: "Use Workspace",
        actionPayload: {
          tenantKey: this.workspace.tenantKey,
          workspaceKey: workspace.workspaceKey
        }
      }))
    ];
  }

  get workspacePressureItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetWorkspaceOverviewResponse>(
      this.workspace.workspaceOverviewView
    );
    const detail = payload?.workspaceOverview;
    if (!detail) {
      return [];
    }

    return [
      {
        headline: detail.activeContentReleaseId ?? "no active release",
        subline: `${detail.openTestRunCount} open run(s)`,
        badges: [
          `${detail.sourcePackageCount} package(s)`,
          `${detail.importJobCount} import(s)`,
          `${detail.contentReleaseCount} release(s)`
        ],
        rows: [
          {
            label: "Participant Sessions",
            value: String(detail.participantSessionCount)
          },
          {
            label: "Latest Import",
            value: detail.latestImportJobAt
              ? this.formatDateTime(detail.latestImportJobAt)
              : "none"
          },
          {
            label: "Workspace Status",
            value: detail.workspace.status
          },
          {
            label: "Tenant Status",
            value: detail.tenant.status
          }
        ]
      }
    ];
  }

  get workspaceCards(): SummaryCard[] {
    const payload = parseJsonDocument<GetWorkspaceOverviewResponse>(
      this.workspace.workspaceOverviewView
    );
    const activeReleaseId =
      readStringValue(payload, ["workspaceOverview", "activeContentReleaseId"]) ?? "none";
    const sourcePackageCount =
      readNumberValue(payload, ["workspaceOverview", "sourcePackageCount"]) ?? 0;
    const importJobCount =
      readNumberValue(payload, ["workspaceOverview", "importJobCount"]) ?? 0;
    const participantSessionCount =
      readNumberValue(payload, ["workspaceOverview", "participantSessionCount"]) ?? 0;
    const openTestRunCount =
      readNumberValue(payload, ["workspaceOverview", "openTestRunCount"]) ?? 0;

    return [
      {
        label: "Workspace",
        headline: this.workspace.workspaceKey,
        detail: this.workspace.tenantKey
      },
      {
        label: "Active Release",
        headline: activeReleaseId,
        detail: `${sourcePackageCount} package(s) · ${importJobCount} import(s)`
      },
      {
        label: "Participants",
        headline: String(participantSessionCount),
        detail: `${openTestRunCount} open run(s)`
      },
      {
        label: "Auto Refresh",
        headline: this.workspace.autoRefreshEnabled ? "enabled" : "paused",
        detail: `Every ${this.workspace.autoRefreshSeconds}s`
      }
    ];
  }

  get workspaceActivityItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ListWorkspaceActivityEventsResponse>(
      this.workspace.workspaceActivityView
    );
    const activityItems = payload?.items ?? [];
    if (activityItems.length === 0) {
      return [];
    }

    const displayedItems = activityItems.slice(0, 8);
    const hiddenItemCount = Math.max(activityItems.length - displayedItems.length, 0);

    return [
      {
        headline: "Workspace activity window",
        subline: `${activityItems.length} event(s) loaded for the current filters`,
        badges: [
          `${displayedItems.length} displayed`,
          ...(hiddenItemCount > 0 ? [`${hiddenItemCount} hidden`] : [])
        ],
        rows: [
          { label: "Loaded Events", value: String(activityItems.length) },
          { label: "Displayed Events", value: String(displayedItems.length) },
          { label: "Hidden Events", value: String(hiddenItemCount) },
          { label: "Limit", value: this.workspace.workspaceActivityLimit }
        ]
      },
      ...displayedItems.map(item => ({
        headline: item.activityEvent.summary,
        subline: `${item.activityEvent.eventType} · ${this.formatDateTime(item.activityEvent.occurredAt)}`,
        badges: [
          item.activityEvent.subjectType,
          item.activityEvent.actorId ?? "system"
        ],
        rows: [
          { label: "Subject", value: item.activityEvent.subjectId },
          ...this.participantSessionLinkRows(
            this.getActivityParticipantSessionId(
              item.activityEvent.subjectType,
              item.activityEvent.subjectId,
              readStringValue(item.activityEvent.details, ["participantSessionId"]) ?? ""
            ),
            {
              loginKey: readStringValue(item.activityEvent.details, ["loginKey"]),
              groupKey: readStringValue(item.activityEvent.details, ["groupKey"]),
              bookletKey: readStringValue(item.activityEvent.details, ["bookletKey"])
            }
          ),
          { label: "Event Id", value: item.activityEvent.activityEventId }
        ],
        selected: this.isActivitySubjectSelected(
          item.activityEvent.subjectType,
          item.activityEvent.subjectId
        ),
        actionLabel: this.getActivitySubjectActionLabel(item.activityEvent.subjectType),
        actionPayload: {
          subjectType: item.activityEvent.subjectType,
          subjectId: item.activityEvent.subjectId,
          participantSessionId:
            readStringValue(item.activityEvent.details, ["participantSessionId"]) ?? "",
          loginKey: readStringValue(item.activityEvent.details, ["loginKey"]) ?? "",
          groupKey: readStringValue(item.activityEvent.details, ["groupKey"]) ?? "",
          bookletKey:
            readStringValue(item.activityEvent.details, ["bookletKey"]) ?? "",
          currentUnitKey:
            readStringValue(item.activityEvent.details, ["currentUnitKey"]) ?? ""
        }
      }))
    ];
  }

  get workspaceActivityDetailItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ListWorkspaceActivityEventsResponse>(
      this.workspace.workspaceActivityView
    );
    const activityItems = payload?.items ?? [];
    if (activityItems.length === 0) {
      return [];
    }

    const displayedItems = activityItems.slice(0, 5);
    const hiddenItemCount = Math.max(activityItems.length - displayedItems.length, 0);

    return [
      {
        headline: "Workspace activity detail window",
        subline: `${activityItems.length} event payload(s) loaded for the current filters`,
        badges: [
          `${displayedItems.length} displayed`,
          ...(hiddenItemCount > 0 ? [`${hiddenItemCount} hidden`] : [])
        ],
        rows: [
          { label: "Loaded Events", value: String(activityItems.length) },
          { label: "Displayed Details", value: String(displayedItems.length) },
          { label: "Hidden Details", value: String(hiddenItemCount) },
          { label: "Limit", value: this.workspace.workspaceActivityLimit }
        ]
      },
      ...displayedItems.map(item => {
        const detailRows = Object.entries(item.activityEvent.details)
          .slice(0, 4)
          .map(([key, value]) => ({
            label: this.humanizeKey(key),
            value: this.stringifyValue(value)
          }));

        return {
          headline: item.activityEvent.eventType,
          subline: this.formatDateTime(item.activityEvent.occurredAt),
          badges: [
            item.activityEvent.subjectType,
            item.activityEvent.actorId ?? "system"
          ],
          rows: [
            { label: "Summary", value: item.activityEvent.summary },
            { label: "Subject Id", value: item.activityEvent.subjectId },
            ...this.participantSessionLinkRows(
              this.getActivityParticipantSessionId(
                item.activityEvent.subjectType,
                item.activityEvent.subjectId,
                readStringValue(item.activityEvent.details, ["participantSessionId"]) ?? ""
              ),
              {
                loginKey: readStringValue(item.activityEvent.details, ["loginKey"]),
                groupKey: readStringValue(item.activityEvent.details, ["groupKey"]),
                bookletKey: readStringValue(item.activityEvent.details, ["bookletKey"])
              }
            ),
            ...detailRows
          ],
          selected: this.isActivitySubjectSelected(
            item.activityEvent.subjectType,
            item.activityEvent.subjectId
          ),
          actionLabel: this.getActivitySubjectActionLabel(item.activityEvent.subjectType),
          actionPayload: {
            subjectType: item.activityEvent.subjectType,
            subjectId: item.activityEvent.subjectId,
            participantSessionId:
              readStringValue(item.activityEvent.details, ["participantSessionId"]) ?? "",
            loginKey: readStringValue(item.activityEvent.details, ["loginKey"]) ?? "",
            groupKey: readStringValue(item.activityEvent.details, ["groupKey"]) ?? "",
            bookletKey:
              readStringValue(item.activityEvent.details, ["bookletKey"]) ?? "",
            currentUnitKey:
              readStringValue(item.activityEvent.details, ["currentUnitKey"]) ?? ""
          }
        } satisfies RecordCollectionItem;
      })
    ];
  }

  init(): void {
    this.viewState.setActiveView("workspace");
  }

  get canUseTenantScope(): boolean {
    return this.workspace.tenantKey.trim() !== "";
  }

  get canUseWorkspaceScope(): boolean {
    return this.canUseTenantScope && this.workspace.workspaceKey.trim() !== "";
  }

  persistState(): void {
    this.viewState.persistShellState();
  }

  onAutoRefreshSettingsChanged(): void {
    this.viewState.onAutoRefreshSettingsChanged();
  }

  createTenant(): void {
    if (!this.canUseTenantScope) {
      return;
    }
    this.viewState.onActionAsync(() => this.workspaceService.createTenant());
  }

  createWorkspace(): void {
    if (!this.canUseWorkspaceScope) {
      return;
    }
    this.viewState.onActionAsync(() => this.workspaceService.createWorkspace());
  }

  refreshWorkspaceOverview(): void {
    if (!this.canUseWorkspaceScope) {
      return;
    }
    this.viewState.onActionAsync(() => this.workspaceService.refreshWorkspaceOverview());
  }

  refreshStudyMonitor(): void {
    if (!this.canUseWorkspaceScope) {
      return;
    }
    this.viewState.onActionAsync(() => this.workspaceService.refreshStudyMonitor());
  }

  refreshWorkspaceActivity(): void {
    if (!this.canUseWorkspaceScope) {
      return;
    }
    this.persistState();
    this.viewState.onActionAsync(() =>
      this.workspaceService.refreshWorkspaceActivity()
    );
  }

  clearWorkspaceActivityFilters(): void {
    this.workspace.workspaceActivityEventType = "";
    this.workspace.workspaceActivitySubjectType = "";
    this.workspace.workspaceActivitySubjectId = "";
    this.workspace.workspaceActivityLimit = "100";
    this.refreshWorkspaceActivity();
  }

  applyStudyMonitorMatrixFilters(): void {
    this.persistState();
    this.refreshStudyMonitor();
  }

  clearStudyMonitorMatrixFilters(): void {
    this.workspace.studyMonitorMatrixLoginFilter = "";
    this.workspace.studyMonitorMatrixGroupFilter = "";
    this.workspace.studyMonitorMatrixBookletFilter = "";
    this.workspace.studyMonitorMatrixUnitFilter = "";
    this.workspace.studyMonitorMatrixStatusFilter = "";
    this.workspace.studyMonitorMatrixAnswerFilter = "";
    this.workspace.studyMonitorMatrixLimit = "25";
    this.applyStudyMonitorMatrixFilters();
  }

  private filterStudyMonitorMatrixStatus(item: RecordCollectionItem): void {
    const testRunStatus = item.actionPayload?.testRunStatus?.trim();
    if (!this.canUseWorkspaceScope || !testRunStatus) {
      return;
    }

    this.workspace.studyMonitorMatrixLoginFilter = "";
    this.workspace.studyMonitorMatrixGroupFilter = "";
    this.workspace.studyMonitorMatrixBookletFilter = "";
    this.workspace.studyMonitorMatrixUnitFilter = "";
    this.workspace.studyMonitorMatrixStatusFilter = testRunStatus;
    this.workspace.studyMonitorMatrixAnswerFilter = "";
    this.workspace.studyMonitorMatrixLimit = "25";
    this.applyStudyMonitorMatrixFilters();
  }

  private filterStudyMonitorMatrixScope(item: RecordCollectionItem): void {
    const groupKey = item.actionPayload?.groupKey?.trim() ?? "";
    const bookletKey = item.actionPayload?.bookletKey?.trim() ?? "";
    const unitKey = item.actionPayload?.unitKey?.trim() ?? "";
    if (!this.canUseWorkspaceScope || (!groupKey && !bookletKey && !unitKey)) {
      return;
    }

    this.workspace.studyMonitorMatrixLoginFilter = "";
    this.workspace.studyMonitorMatrixGroupFilter = groupKey;
    this.workspace.studyMonitorMatrixBookletFilter = bookletKey;
    this.workspace.studyMonitorMatrixUnitFilter = unitKey;
    this.workspace.studyMonitorMatrixStatusFilter = "";
    this.workspace.studyMonitorMatrixAnswerFilter = "";
    this.workspace.studyMonitorMatrixLimit = "25";
    this.applyStudyMonitorMatrixFilters();
  }

  openStudyMonitorItem(item: RecordCollectionItem): void {
    if (item.actionPayload?.participantCommand === "openRuntime") {
      this.openActivitySubject(item);
      return;
    }

    if (item.actionPayload?.participantCommand === "reviewResponse") {
      this.reviewResponseInRuntime(item);
      return;
    }

    if (
      item.actionPayload?.participantCommand ===
      "filterStudyMonitorMatrixStatus"
    ) {
      this.filterStudyMonitorMatrixStatus(item);
      return;
    }

    if (
      item.actionPayload?.participantCommand ===
      "filterStudyMonitorMatrixScope"
    ) {
      this.filterStudyMonitorMatrixScope(item);
      return;
    }

    if (item.actionPayload?.participantCommand === "prepareRuntime") {
      this.prepareParticipantRuntime(item);
      return;
    }

    if (item.actionPayload?.testRunId?.trim()) {
      this.openStudyMonitorRun(item);
      return;
    }

    if (item.actionPayload?.participantLoginKey?.trim()) {
      this.openStudyMonitorParticipant(item);
      return;
    }

    if (item.actionPayload?.bookletKey?.trim()) {
      this.openStudyMonitorBooklet(item);
      return;
    }

    if (item.actionPayload?.unitKey?.trim()) {
      this.openStudyMonitorUnit(item);
      return;
    }

    this.openStudyMonitorGroup(item);
  }

  openStudyMonitorParticipant(item: RecordCollectionItem): void {
    const loginKey = item.actionPayload?.participantLoginKey?.trim();
    if (!this.canUseWorkspaceScope || !loginKey) {
      return;
    }

    this.viewState.onActionAsync(() =>
      this.workspaceService.loadStudyMonitorParticipant(loginKey)
    );
  }

  openStudyMonitorBookletDetailItem(item: RecordCollectionItem): void {
    if (item.actionPayload?.participantCommand === "openRuntime") {
      this.openActivitySubject(item);
      return;
    }

    if (item.actionPayload?.participantCommand === "reviewResponse") {
      this.reviewResponseInRuntime(item);
      return;
    }

    if (item.actionPayload?.participantCommand === "prepareRuntime") {
      this.prepareParticipantRuntime(item);
      return;
    }

    if (item.actionPayload?.testRunId?.trim()) {
      this.openStudyMonitorRun(item);
      return;
    }

    if (item.actionPayload?.unitKey?.trim()) {
      this.openStudyMonitorUnit(item);
      return;
    }

    if (item.actionPayload?.participantLoginKey?.trim()) {
      this.openStudyMonitorParticipant(item);
      return;
    }

    this.openActivitySubject(item);
  }

  openStudyMonitorDetailItem(item: RecordCollectionItem): void {
    if (item.actionPayload?.participantCommand === "openRuntime") {
      this.openActivitySubject(item);
      return;
    }

    if (item.actionPayload?.participantCommand === "reviewResponse") {
      this.reviewResponseInRuntime(item);
      return;
    }

    if (item.actionPayload?.participantCommand === "prepareRuntime") {
      this.prepareParticipantRuntime(item);
      return;
    }

    if (item.actionPayload?.testRunId?.trim()) {
      this.openStudyMonitorRun(item);
      return;
    }

    if (item.actionPayload?.participantLoginKey?.trim()) {
      this.openStudyMonitorParticipant(item);
      return;
    }

    if (item.actionPayload?.unitKey?.trim()) {
      this.openStudyMonitorUnit(item);
      return;
    }

    this.openActivitySubject(item);
  }

  openStudyMonitorGroup(item: RecordCollectionItem): void {
    const groupKey = item.actionPayload?.groupKey?.trim();
    if (!this.canUseWorkspaceScope || !groupKey) {
      return;
    }

    this.viewState.onActionAsync(() =>
      this.workspaceService.loadStudyMonitorGroup(groupKey)
    );
  }

  openStudyMonitorBooklet(item: RecordCollectionItem): void {
    const bookletKey = item.actionPayload?.bookletKey?.trim();
    if (!this.canUseWorkspaceScope || !bookletKey) {
      return;
    }

    this.viewState.onActionAsync(() =>
      this.workspaceService.loadStudyMonitorBooklet(bookletKey)
    );
  }

  openStudyMonitorUnit(item: RecordCollectionItem): void {
    const unitKey = item.actionPayload?.unitKey?.trim();
    if (!this.canUseWorkspaceScope || !unitKey) {
      return;
    }

    this.viewState.onActionAsync(() =>
      this.workspaceService.loadStudyMonitorUnit(unitKey)
    );
  }

  openStudyMonitorRun(item: RecordCollectionItem): void {
    const testRunId = item.actionPayload?.testRunId?.trim();
    if (!this.canUseWorkspaceScope || !testRunId) {
      return;
    }

    this.viewState.onActionAsync(() =>
      this.workspaceService.loadStudyMonitorRun(testRunId)
    );
  }

  prepareParticipantRuntime(item: RecordCollectionItem): void {
    const loginKey = item.actionPayload?.participantLoginKey?.trim();
    if (!loginKey) {
      return;
    }

    const groupKey =
      item.actionPayload?.groupKey?.trim() || `group:${loginKey}`;
    const bookletKey = item.actionPayload?.bookletKey?.trim() ?? "";
    const runtime = this.uiState.runtime;
    runtime.loginKey = loginKey;
    runtime.groupKey = groupKey;
    runtime.bookletKey = bookletKey;
    runtime.participantSessionId = "";
    runtime.testRunId = "";
    runtime.currentUnitKey = "";
    runtime.currentUnitResponse = "";
    runtime.currentRunStateView =
      'Participant prepared from monitor. Use "Sign In" or "Start Participant" in Runtime.';
    runtime.runtimeStateView =
      'Participant prepared from monitor. Use "Sign In" or "Start Participant" in Runtime.';
    this.persistState();
    void this.router.navigateByUrl("/runtime");
  }

  refreshTenantDirectory(): void {
    this.viewState.onActionAsync(() => this.workspaceService.refreshTenantDirectory());
  }

  refreshWorkspaceDirectory(): void {
    if (!this.canUseTenantScope) {
      return;
    }
    this.viewState.onActionAsync(() =>
      this.workspaceService.refreshWorkspaceDirectory()
    );
  }

  exportWorkspaceLogCsv(): void {
    if (!this.canUseWorkspaceScope) {
      return;
    }
    this.viewState.onActionAsync(() => this.workspaceService.exportWorkspaceLogCsv());
  }

  exportStudyMonitorCsv(): void {
    if (!this.canUseWorkspaceScope) {
      return;
    }
    this.viewState.onActionAsync(() => this.workspaceService.exportStudyMonitorCsv());
  }

  exportStudyMonitorParticipantMatrixCsv(): void {
    if (!this.canUseWorkspaceScope) {
      return;
    }
    this.viewState.onActionAsync(() =>
      this.workspaceService.exportStudyMonitorParticipantMatrixCsv()
    );
  }

  selectTenant(item: RecordCollectionItem): void {
    const tenantKey = item.actionPayload?.tenantKey?.trim();
    if (!tenantKey) {
      return;
    }

    this.workspace.tenantKey = tenantKey;
    this.workspace.workspaceKey = "";
    this.persistState();
    this.refreshWorkspaceDirectory();
  }

  selectWorkspace(item: RecordCollectionItem): void {
    const tenantKey = item.actionPayload?.tenantKey?.trim();
    const workspaceKey = item.actionPayload?.workspaceKey?.trim();
    if (!workspaceKey) {
      return;
    }

    if (tenantKey) {
      this.workspace.tenantKey = tenantKey;
    }
    this.workspace.workspaceKey = workspaceKey;
    this.persistState();
    this.refreshWorkspaceOverview();
  }

  runWorkspaceSuggestion(item: RecordCollectionItem): void {
    switch (item.actionPayload?.workspaceCommand) {
      case "bootstrapWorkspace":
        if (!this.canUseWorkspaceScope) {
          return;
        }
        this.viewState.onActionAsync(() => this.workspaceService.bootstrapWorkspaceFlow());
        break;
      case "openContent":
        void this.router.navigateByUrl("/content");
        this.viewState.onActionAsync(() => this.contentService.refreshContentReads(true));
        break;
      case "openRuntime":
        void this.router.navigateByUrl("/runtime");
        this.viewState.onActionAsync(() => this.runtimeService.refreshRuntimeReads(true));
        break;
      case "refreshWorkspaceOverview":
      default:
        this.refreshWorkspaceOverview();
        break;
    }
  }

  openActivitySubject(item: RecordCollectionItem): void {
    const subjectType = item.actionPayload?.subjectType?.trim();
    const subjectId = item.actionPayload?.subjectId?.trim();
    if (!subjectType || !subjectId) {
      return;
    }

    switch (subjectType) {
      case "workspace":
        void this.router.navigateByUrl("/workspace");
        this.viewState.onActionAsync(() => this.workspaceService.refreshWorkspaceOverview());
        return;
      case "source_package":
        this.openSourcePackageInContent(subjectId);
        return;
      case "import_job":
        this.openImportJobInContent(subjectId);
        return;
      case "content_release":
        this.openContentReleaseInContent(subjectId);
        return;
      case "participant_session":
        this.openParticipantSessionInRuntime(
          subjectId,
          item.actionPayload?.loginKey?.trim() ?? "",
          item.actionPayload?.groupKey?.trim() ?? "",
          item.actionPayload?.bookletKey ?? ""
        );
        return;
      case "test_run":
        this.openTestRunInRuntime(
          subjectId,
          item.actionPayload?.participantSessionId?.trim() ?? "",
          item.actionPayload?.loginKey?.trim() ?? "",
          item.actionPayload?.groupKey?.trim() ?? "",
          item.actionPayload?.bookletKey ?? "",
          item.actionPayload?.currentUnitKey ?? ""
        );
        return;
      default:
        return;
    }
  }

  private openSourcePackageInContent(sourcePackageId: string): void {
    const content = this.uiState.content;
    content.sourcePackageId = sourcePackageId;
    this.persistState();
    void this.router.navigateByUrl("/content");
    this.viewState.onActionAsync(() => this.contentService.loadSourcePackageDetail());
  }

  private openImportJobInContent(importJobId: string): void {
    const content = this.uiState.content;
    content.importJobId = importJobId;
    this.persistState();
    void this.router.navigateByUrl("/content");
    this.viewState.onActionAsync(() => this.contentService.loadImportJobDetail());
  }

  private openContentReleaseInContent(contentReleaseId: string): void {
    const content = this.uiState.content;
    content.contentReleaseId = contentReleaseId;
    this.persistState();
    void this.router.navigateByUrl("/content");
    this.viewState.onActionAsync(async () => {
      await this.contentService.loadContentReleaseActivationReadiness();
      await this.contentService.loadContentReleaseDetail();
    });
  }

  private openParticipantSessionInRuntime(
    participantSessionId: string,
    loginKey: string,
    groupKey: string,
    bookletKey: string
  ): void {
    const runtime = this.uiState.runtime;
    runtime.participantSessionId = participantSessionId;
    runtime.testRunId = "";
    runtime.currentUnitKey = "";
    if (loginKey) {
      runtime.loginKey = loginKey;
    }
    if (groupKey) {
      runtime.groupKey = groupKey;
    }
    if (bookletKey != null) {
      runtime.bookletKey = bookletKey;
    }

    this.persistState();
    void this.router.navigateByUrl("/runtime");
    this.viewState.onActionAsync(async () => {
      await this.runtimeService.loadParticipantSessionDetail();
      await this.runtimeService.refreshRuntimeReads(true);
    });
  }

  private openTestRunInRuntime(
    testRunId: string,
    participantSessionId: string,
    loginKey: string,
    groupKey: string,
    bookletKey: string,
    currentUnitKey: string
  ): void {
    const runtime = this.uiState.runtime;
    const matchingParticipantSession = this.findParticipantSessionByTestRunId(testRunId);
    const resolvedSession =
      participantSessionId || matchingParticipantSession?.participantSessionId || "";
    const resolvedLoginKey = loginKey || matchingParticipantSession?.loginKey || "";
    const resolvedGroupKey = groupKey || matchingParticipantSession?.groupKey || "";

    runtime.testRunId = testRunId;
    runtime.currentUnitKey = currentUnitKey;
    if (resolvedSession) {
      runtime.participantSessionId = resolvedSession;
    }
    if (resolvedLoginKey) {
      runtime.loginKey = resolvedLoginKey;
    }
    if (resolvedGroupKey) {
      runtime.groupKey = resolvedGroupKey;
    }
    if (bookletKey != null) {
      runtime.bookletKey = bookletKey;
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

  private reviewResponseInRuntime(item: RecordCollectionItem): void {
    const testRunId = item.actionPayload?.testRunId?.trim();
    const participantSessionId = item.actionPayload?.participantSessionId?.trim();
    if (!this.canUseWorkspaceScope || !testRunId || !participantSessionId) {
      return;
    }

    const runtime = this.uiState.runtime;
    runtime.testRunId = testRunId;
    runtime.participantSessionId = participantSessionId;
    runtime.currentUnitKey = item.actionPayload?.currentUnitKey ?? "";
    runtime.loginKey = item.actionPayload?.loginKey ?? runtime.loginKey;
    runtime.groupKey = item.actionPayload?.groupKey ?? runtime.groupKey;
    runtime.bookletKey = item.actionPayload?.bookletKey ?? runtime.bookletKey;
    runtime.detailedResponseLoginFilter = runtime.loginKey.trim();
    runtime.detailedResponseGroupFilter = runtime.groupKey.trim();
    runtime.detailedResponseBookletFilter = runtime.bookletKey.trim();
    runtime.detailedResponseSessionFilter = participantSessionId;
    runtime.detailedResponseRunFilter = testRunId;
    runtime.detailedResponseUnitFilter = runtime.currentUnitKey.trim();
    runtime.detailedResponseStatusFilter = "";
    runtime.reviewLoginFilter = runtime.loginKey.trim();
    runtime.reviewGroupFilter = runtime.groupKey.trim();
    runtime.reviewBookletFilter = runtime.bookletKey.trim();
    runtime.reviewSessionFilter = participantSessionId;
    runtime.reviewRunFilter = testRunId;
    runtime.reviewUnitFilter = runtime.currentUnitKey.trim();
    runtime.openRunLoginFilter = runtime.loginKey.trim();
    runtime.openRunGroupFilter = runtime.groupKey.trim();
    runtime.openRunBookletFilter = runtime.bookletKey.trim();
    runtime.openRunSessionFilter = participantSessionId;
    runtime.openRunRunFilter = testRunId;
    runtime.openRunUnitFilter = runtime.currentUnitKey.trim();
    runtime.reviewReviewerFilter = "";
    runtime.reviewCategoryFilter = "";
    this.persistState();

    void this.router.navigateByUrl("/runtime");
    this.viewState.onActionAsync(async () => {
      await this.runtimeService.loadParticipantSessionDetail();
      await this.runtimeService.refreshRuntimeReads(true);
      await this.runtimeService.loadDetailedResponses();
      await this.runtimeService.loadReviews();
    });
  }

  private getActivitySubjectActionLabel(
    subjectType: ListWorkspaceActivityEventsResponse["items"][number]["activityEvent"]["subjectType"]
  ): string {
    if (subjectType === "workspace") {
      return "Refresh Scope";
    }
    return "Open Subject";
  }

  private getActivityParticipantSessionId(
    subjectType: string,
    subjectId: string,
    detailParticipantSessionId: string
  ): string {
    if (subjectType === "participant_session") {
      return subjectId;
    }

    return detailParticipantSessionId;
  }

  private isActivitySubjectSelected(subjectType: string, subjectId: string): boolean {
    switch (subjectType) {
      case "workspace":
        return false;
      case "source_package":
        return this.uiState.content.sourcePackageId.trim() === subjectId;
      case "import_job":
        return this.uiState.content.importJobId.trim() === subjectId;
      case "content_release":
        return this.uiState.content.contentReleaseId.trim() === subjectId;
      case "participant_session":
        return this.uiState.runtime.participantSessionId.trim() === subjectId;
      case "test_run":
        return this.uiState.runtime.testRunId.trim() === subjectId;
      default:
        return false;
    }
  }

  private findParticipantSessionByTestRunId(
    testRunId: string
  ): { participantSessionId: string; loginKey: string; groupKey: string } | null {
    const payload = parseJsonDocument<ListParticipantSessionsResponse>(
      this.uiState.runtime.participantSessionsView
    );
    const matchingItem = payload?.items.find(
      item => item.latestTestRun?.testRunId === testRunId
    );
    if (!matchingItem) {
      return null;
    }

    return {
      participantSessionId: matchingItem.participantSession.participantSessionId,
      loginKey: matchingItem.participantSession.loginKey,
      groupKey: matchingItem.participantSession.groupKey
    };
  }

  private formatDateTime(value: string): string {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? value : date.toLocaleString();
  }

  private buildDirectoryWindowItem(
    headline: string,
    recordLabel: string,
    loadedCount: number,
    scopeRows: Array<{ label: string; value: string }>
  ): RecordCollectionItem {
    return {
      headline,
      subline: `${loadedCount} ${recordLabel} row(s) loaded for the current directory`,
      badges: [`${loadedCount} loaded`, "directory"],
      rows: [
        { label: "Loaded Records", value: String(loadedCount) },
        ...scopeRows
      ]
    };
  }

  private formatPercentage(count: number, total: number): string {
    if (total <= 0) {
      return "0";
    }
    return ((count / total) * 100).toFixed(1).replace(/\.0$/, "");
  }

  private buildParticipantEntryUrl(rosterEntry: {
    loginKey: string;
    groupKey: string;
    bookletKey: string | null;
  }): string {
    const tenantKey = this.uiState.workspace.tenantKey.trim();
    const workspaceKey = this.uiState.workspace.workspaceKey.trim();
    return buildParticipantEntryLinkUrl({
      tenantKey,
      workspaceKey: workspaceKey || "demo-workspace",
      loginKey: rosterEntry.loginKey,
      groupKey: rosterEntry.groupKey,
      bookletKey: rosterEntry.bookletKey
    });
  }

  private humanizeKey(value: string): string {
    return value
      .replace(/([A-Z])/g, " $1")
      .replace(/[_-]/g, " ")
      .replace(/^\w/, firstCharacter => firstCharacter.toUpperCase());
  }

  private stringifyValue(value: unknown): string {
    if (value == null) {
      return "null";
    }
    if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") {
      return String(value);
    }
    try {
      return JSON.stringify(value);
    } catch {
      return "[unserializable]";
    }
  }
}
