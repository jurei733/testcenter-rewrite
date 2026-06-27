import { Injectable, inject } from "@angular/core";

import type {
  GetParticipantSessionResponse,
  ListDetailedResponsesResponse,
  ListParticipantSessionsResponse,
  MonitorOpenRunsResponse,
  ParticipantCurrentRunStateResponse,
  ParticipantRuntimeStateResponse
} from "@testcenter-rewrite-app/contracts";

import type { RecordCollectionItem } from "./record-collection.component";
import type { SummaryCard } from "./rewrite-app-shell.types";
import {
  parseJsonDocument,
  readStringValue,
  readUnknownValue
} from "./rewrite-app-shell.readers";
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

@Injectable({ providedIn: "root" })
export class RuntimeViewFacade {
  private readonly uiState = inject(RewriteAppUiStateService);
  private readonly runtimeService = inject(RewriteAppRuntimeService);
  private readonly viewState = inject(RewriteAppViewStateService);

  readonly runtime = this.uiState.runtime;

  get participantSessionsView(): string {
    return this.uiState.runtime.participantSessionsView;
  }

  get participantSessionItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<ListParticipantSessionsResponse>(
      this.runtime.participantSessionsView
    );
    return (
      payload?.items.map(item => ({
        headline: item.participantSession.loginKey,
        subline: item.participantSession.participantSessionId,
        badges: [
          item.participantSession.status,
          item.latestTestRun?.status ?? "no run"
        ],
        rows: [
          {
            label: "Group",
            value: item.participantSession.groupKey
          },
          {
            label: "Release",
            value: item.contentRelease?.releaseLabel ?? item.participantSession.contentReleaseId
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
      })) ?? []
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
        headline: detail.participantSession.loginKey,
        subline: detail.participantSession.participantSessionId,
        badges: [
          detail.participantSession.status,
          detail.contentRelease?.status ?? "no release"
        ],
        rows: [
          {
            label: "Group",
            value: detail.participantSession.groupKey
          },
          {
            label: "Release",
            value: detail.contentRelease?.releaseLabel ?? "none"
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

  get participantRunHistoryItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<GetParticipantSessionResponse>(
      this.runtime.participantSessionDetailView
    );
    return (
      payload?.participantSessionDetail.testRuns.map(testRun => ({
        headline: testRun.testRunId,
        subline: testRun.status,
        badges: [
          testRun.bookletKey,
          `${Object.keys(testRun.unitResponses ?? {}).length} response(s)`
        ],
        rows: [
          {
            label: "Current Unit",
            value: testRun.currentUnitKey ?? "none"
          },
          {
            label: "Unit Responses",
            value: String(Object.keys(testRun.unitResponses ?? {}).length)
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
      })) ?? []
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
      payload?.items.map(item => ({
        headline: `${item.loginKey} · ${item.unitKey}`,
        subline: item.testRunId,
        badges: [item.status, item.bookletKey, `${item.responseLength} char(s)`],
        rows: [
          { label: "Response", value: this.formatResponsePreview(item.response) },
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
      })) ?? []
    );
  }

  get openRunItems(): RecordCollectionItem[] {
    const payload = parseJsonDocument<MonitorOpenRunsResponse>(this.runtime.openRunsView);
    return (
      payload?.items.map(openRun => ({
        headline: openRun.loginKey,
        subline: openRun.testRunId,
        badges: [openRun.status, openRun.groupKey],
        rows: [
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
      })) ?? []
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
            value: openRuns[0]?.loginKey ?? "unknown"
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

  openRuns(): void {
    this.viewState.onActionAsync(() => this.runtimeService.refreshRuntimeReads());
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
      case "refreshRuntimeReads":
      default:
        this.refreshRuntimeReads();
        break;
    }
  }

  participantHappyPathFlow(): void {
    this.viewState.onActionAsync(() => this.runtimeService.participantHappyPathFlow());
  }

  getParticipantSessionDetail(): void {
    this.viewState.onActionAsync(() => this.runtimeService.loadParticipantSessionDetail());
  }

  exportResponsesCsv(): void {
    this.viewState.onActionAsync(() => this.runtimeService.exportResponsesCsv());
  }

  loadDetailedResponses(): void {
    this.viewState.onActionAsync(() => this.runtimeService.loadDetailedResponses());
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

  private findParticipantSessionIdByLoginKey(loginKey: string): string | null {
    const payload = parseJsonDocument<ListParticipantSessionsResponse>(
      this.runtime.participantSessionsView
    );
    const matchingItem = payload?.items.find(
      item => item.participantSession.loginKey === loginKey
    );
    return matchingItem?.participantSession.participantSessionId ?? null;
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
