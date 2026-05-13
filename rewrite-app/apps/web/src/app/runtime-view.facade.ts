import { Injectable, inject } from "@angular/core";

import type {
  GetParticipantSessionResponse,
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
          loginKey: item.participantSession.loginKey
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
          loginKey: detail.participantSession.loginKey
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
        badges: [testRun.bookletKey],
        rows: [
          {
            label: "Current Unit",
            value: testRun.currentUnitKey ?? "none"
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
          loginKey: openRun.loginKey
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

  selectParticipantSession(item: RecordCollectionItem): void {
    const participantSessionId = item.actionPayload?.participantSessionId?.trim();
    if (!participantSessionId) {
      return;
    }

    this.runtime.participantSessionId = participantSessionId;
    if (item.actionPayload?.loginKey) {
      this.runtime.loginKey = item.actionPayload.loginKey;
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

  private formatDateTime(value: string): string {
    try {
      return new Date(value).toLocaleString();
    } catch {
      return value;
    }
  }
}
