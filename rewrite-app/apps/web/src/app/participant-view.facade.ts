import { Injectable, inject, signal } from "@angular/core";

import type {
  CompleteTestRunRequest,
  ParticipantCurrentRunStateResponse,
  ParticipantLaunchRequest,
  ParticipantLaunchResponse,
  ParticipantSignInRequest,
  ParticipantSignInResponse,
  ResumeParticipantSessionRequest,
  ResumeParticipantSessionResponse,
  ResumeTestRunResponse,
  SaveTestRunProgressRequest,
  SaveTestRunProgressResponse,
  UnlockParticipantTestletRequest,
  UnlockParticipantTestletResponse
} from "@testcenter-rewrite-app/contracts";
import {
  productionApiRoutes,
  resolveRoutePath
} from "@testcenter-rewrite-app/contracts";
import type { ParticipantRuntimeBooklet } from "@testcenter-rewrite-app/domain";

import { copyTextToClipboard } from "./copy-text-to-clipboard";
import { buildParticipantSessionEntryUrl } from "./participant-session-links";
import type { ApiErrorLike } from "./rewrite-app-api.service";
import { prettyPrintJson } from "./rewrite-app-shell.readers";
import { RewriteAppShellRequestService } from "./rewrite-app-shell-request.service";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";
import { RewriteAppViewStateService } from "./rewrite-app-view-state.service";

type ParticipantPlayerState = {
  headline: string;
  detail: string;
  displayNameLabel: string;
  loginLabel: string;
  groupLabel: string;
  sessionLabel: string;
  sessionEntryLink: string;
  bookletLabel: string;
  unitLabel: string;
  unitDescription: string;
  unitContent: string;
  unitKey: string;
  unitPosition: string;
  unitOverviewLabel: string;
  unitItems: ParticipantPlayerUnitItem[];
  responseProgressLabel: string;
  missingResponseLabel: string;
  progressPercent: number;
  completionLabel: string;
  completionReadinessLabel: string;
  completionReadinessDetail: string;
  completionReadinessState: "idle" | "incomplete" | "ready" | "complete";
  isComplete: boolean;
  previousUnitKey: string | null;
  nextUnitKey: string | null;
  runStatus: string;
  runId: string;
  nextStepLabel: string;
  nextStepDetail: string;
  actions: string[];
  canSaveProgress: boolean;
  showUnitMenu: boolean;
  showPreviousUnitControl: boolean;
  showNextUnitControl: boolean;
  canGoPreviousUnit: boolean;
  canGoNextUnit: boolean;
  canResumeRun: boolean;
  canComplete: boolean;
  canClearSession: boolean;
  saveProgressLabel: string;
  unitResponse: string;
  draftStateLabel: string;
  draftStateDetail: string;
  hasUnsavedResponse: boolean;
  navigationNotice: string;
  nextTestletGate: {
    testletKey: string;
    displayLabel: string;
    prompt: string;
  } | null;
  testletTimer: {
    testletKey: string;
    displayLabel: string;
    status: "running" | "paused";
    leave: "forbidden" | "confirm" | "allowed";
    remainingSeconds: number;
    remainingLabel: string;
    progressPercent: number;
    leaveLabel: string;
    showTimeLeft: boolean;
    warningMessage: string | null;
  } | null;
  leaveLock: {
    testletKey: string;
    displayLabel: string;
    unitKey: string;
    unitDisplayLabel: string;
    scope: "unit" | "testlet";
    confirm: boolean;
    detail: string;
  } | null;
};

type ParticipantPlayerUnitItem = {
  unitKey: string;
  label: string;
  position: string;
  statusLabel: string;
  accessibilityLabel: string;
  isCurrent: boolean;
  hasResponse: boolean;
  canOpen: boolean;
};

export type ParticipantVeronaPlayerState = {
  playerKey: string;
  playerHtml: string;
  testRunId: string;
  unitKey: string;
  unitTitle: string;
  unitDefinition: string;
  unitDefinitionType: string;
  resourceBasePath: string;
  savedResponse: string;
  unitNumber: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
  canComplete: boolean;
  logPolicy: "disabled" | "lean" | "rich" | "debug";
  pagingMode: "separate" | "concat-scroll" | "concat-scroll-snap";
  restoreCurrentPageOnReturn: boolean;
};

type ParticipantEntryIssue = {
  title: string;
  detail: string;
  action: string;
  errorCode: string;
  statusCode: string;
};

type ParticipantEntryParameters = {
  tenantKey?: string | null;
  workspaceKey?: string | null;
  loginKey?: string | null;
  groupKey?: string | null;
  bookletKey?: string | null;
  participantSessionId?: string | null;
  currentUnitKey?: string | null;
  unitResponse?: string | null;
};

type NormalizedParticipantEntryParameters = {
  tenantKey: string;
  workspaceKey: string;
  loginKey: string;
  groupKey: string;
  bookletKey: string;
  participantSessionId: string;
  currentUnitKey: string;
  unitResponse: string;
  hasUnitResponse: boolean;
};

@Injectable({ providedIn: "root" })
export class ParticipantViewFacade {
  private readonly requestState = inject(RewriteAppShellRequestService);
  private readonly uiState = inject(RewriteAppUiStateService);
  private readonly viewState = inject(RewriteAppViewStateService);

  readonly workspace = this.uiState.workspace;
  readonly runtime = this.uiState.runtime;
  assignedBooklets: ParticipantRuntimeBooklet[] = [];
  veronaSaveStatus: "not_saved" | "saving" | "saved" | "save_failed" =
    "not_saved";
  testletUnlockCode = "";
  readonly timerTick = signal(Date.now());
  private copiedSessionEntryLink = "";
  private timerTickerHandle: number | null = null;
  private timerExpiryRefreshPending = false;
  private activeTimerWarning: {
    testletKey: string;
    startedAt: string;
    minutes: number;
    visibleUntilMs: number;
  } | null = null;
  private readonly seenTimerWarnings = new Set<string>();
  private readonly timerRemainingSeconds = new Map<string, number>();
  private pendingVeronaSave: {
    testRunId: string;
    unitKey: string;
    response: string;
    status: "running" | "paused";
  } | null = null;
  private veronaSaveDrainPromise: Promise<void> | null = null;

  init(): void {
    this.viewState.setActiveView("participant");
    this.startTimerTicker();
  }

  destroy(): void {
    if (this.timerTickerHandle != null) {
      globalThis.window?.clearInterval(this.timerTickerHandle);
      this.timerTickerHandle = null;
    }
  }

  persistState(): void {
    this.viewState.persistShellState();
  }

  startFromEntryParameters(parameters: ParticipantEntryParameters): void {
    const normalized = this.applyEntryParameters(parameters);

    if (normalized.participantSessionId) {
      this.viewState.onActionAsync(async () => {
        await this.resumeEntrySessionInternal(normalized);
      });
      return;
    }

    if (normalized.workspaceKey && normalized.loginKey) {
      this.viewState.onActionAsync(async () => {
        await this.starterLaunchInternal();
        await this.applyEntryDraftAfterResume(normalized);
      });
    }
  }

  private applyEntryParameters(
    parameters: ParticipantEntryParameters
  ): NormalizedParticipantEntryParameters {
    const normalized = {
      tenantKey: parameters.tenantKey?.trim() ?? "",
      workspaceKey: parameters.workspaceKey?.trim() ?? "",
      loginKey: parameters.loginKey?.trim() ?? "",
      groupKey: parameters.groupKey?.trim() ?? "",
      bookletKey: parameters.bookletKey?.trim() ?? "",
      participantSessionId: parameters.participantSessionId?.trim() ?? "",
      currentUnitKey: parameters.currentUnitKey?.trim() ?? "",
      unitResponse: parameters.unitResponse ?? "",
      hasUnitResponse: parameters.unitResponse != null
    };
    const previousTenantKey = this.workspace.tenantKey.trim();
    const previousWorkspaceKey = this.workspace.workspaceKey.trim();
    const scopeChanged =
      !normalized.participantSessionId &&
      ((normalized.tenantKey && normalized.tenantKey !== previousTenantKey) ||
        (normalized.workspaceKey && normalized.workspaceKey !== previousWorkspaceKey));

    if (normalized.tenantKey) {
      this.workspace.tenantKey = normalized.tenantKey;
    }

    if (normalized.workspaceKey) {
      const loginChanged =
        normalized.loginKey &&
        normalized.loginKey !== this.runtime.loginKey.trim() &&
        !normalized.participantSessionId;
      const assignmentChanged =
        !normalized.participantSessionId &&
        ((normalized.groupKey &&
          normalized.groupKey !== this.runtime.groupKey.trim()) ||
          (normalized.bookletKey &&
            normalized.bookletKey !== this.runtime.bookletKey.trim()));
      this.workspace.workspaceKey = normalized.workspaceKey;
      if (scopeChanged || loginChanged || assignmentChanged) {
        this.runtime.participantSessionId = "";
        this.runtime.testRunId = "";
        this.runtime.currentRunStateView = 'Use "Start Or Resume".';
      }
    }

    if (normalized.loginKey) {
      this.runtime.loginKey = normalized.loginKey;
    }
    if (normalized.groupKey) {
      this.runtime.groupKey = normalized.groupKey;
    }
    if (normalized.bookletKey) {
      this.runtime.bookletKey = normalized.bookletKey;
    }
    if (normalized.participantSessionId) {
      this.runtime.participantSessionId = normalized.participantSessionId;
    }
    if (normalized.currentUnitKey) {
      this.runtime.currentUnitKey = normalized.currentUnitKey;
    }
    if (normalized.hasUnitResponse) {
      this.runtime.currentUnitResponse = normalized.unitResponse;
    }

    if (
      normalized.tenantKey ||
      normalized.workspaceKey ||
      normalized.loginKey ||
      normalized.groupKey ||
      normalized.bookletKey ||
      normalized.participantSessionId ||
      normalized.currentUnitKey ||
      normalized.hasUnitResponse
    ) {
      this.persistState();
    }

    return normalized;
  }

  private restoreEntryDraft(normalized: NormalizedParticipantEntryParameters): void {
    let shouldPersist = false;

    if (
      normalized.currentUnitKey &&
      this.runtime.currentUnitKey !== normalized.currentUnitKey
    ) {
      this.runtime.currentUnitKey = normalized.currentUnitKey;
      shouldPersist = true;
    }

    if (
      normalized.hasUnitResponse &&
      this.runtime.currentUnitResponse !== normalized.unitResponse
    ) {
      this.runtime.currentUnitResponse = normalized.unitResponse;
      shouldPersist = true;
    }

    if (shouldPersist) {
      this.persistState();
    }
  }

  private async applyEntryDraftAfterResume(
    normalized: NormalizedParticipantEntryParameters
  ): Promise<void> {
    if (normalized.currentUnitKey && this.runtime.testRunId.trim()) {
      this.runtime.currentUnitKey = normalized.currentUnitKey;
      if (normalized.hasUnitResponse) {
        this.runtime.currentUnitResponse = normalized.unitResponse;
      }
      this.persistState();
      await this.saveProgressInternal(
        "running",
        normalized.currentUnitKey,
        normalized.hasUnitResponse ? normalized.unitResponse : undefined
      );
      return;
    }

    this.restoreEntryDraft(normalized);
  }

  get player(): ParticipantPlayerState {
    const currentState = this.readCurrentRunState();
    if (!currentState) {
      const hasParticipantSession = Boolean(this.runtime.participantSessionId.trim());
      return {
        headline: hasParticipantSession
          ? "Session ready"
          : "Sign in to start",
        detail: hasParticipantSession
          ? "Resume the session to launch or continue the current run."
          : "Enter your workspace and login key, then sign in.",
        displayNameLabel:
          this.runtime.participantDisplayName.trim() ||
          this.runtime.loginKey.trim() ||
          "No participant name yet",
        loginLabel: this.runtime.loginKey.trim() || "No login yet",
        groupLabel: this.runtime.groupKey.trim() || "No group yet",
        sessionLabel: this.runtime.participantSessionId.trim() || "No session yet",
        sessionEntryLink: this.createParticipantSessionEntryLink(),
        bookletLabel: "No booklet loaded",
        unitLabel: "No unit loaded",
        unitDescription: "No unit description available yet.",
        unitContent: "Start or resume a session to load the current unit prompt.",
        unitKey: "n/a",
        unitPosition: "n/a",
        unitOverviewLabel: "No units loaded",
        unitItems: [],
        responseProgressLabel: "0 / 0 responses saved",
        missingResponseLabel: "No booklet loaded",
        progressPercent: 0,
        completionLabel: "Not started",
        completionReadinessLabel: "Not ready",
        completionReadinessDetail:
          "Start or resume a test before checking completion readiness.",
        completionReadinessState: "idle",
        isComplete: false,
        previousUnitKey: null,
        nextUnitKey: null,
        runStatus: hasParticipantSession ? "signed_in" : "idle",
        runId: this.runtime.testRunId.trim() || "no run yet",
        nextStepLabel: hasParticipantSession ? "Start test" : "Sign in",
        nextStepDetail: hasParticipantSession
          ? 'Use "Start Or Resume" to open the assigned booklet.'
          : "Enter the assigned workspace and login key first.",
        actions: [],
        canSaveProgress: false,
        showUnitMenu: false,
        showPreviousUnitControl: true,
        showNextUnitControl: true,
        canGoPreviousUnit: false,
        canGoNextUnit: false,
        canResumeRun: false,
        canComplete: false,
        canClearSession: hasParticipantSession,
        saveProgressLabel: "Save Progress",
        unitResponse: "",
        draftStateLabel: "No response loaded",
        draftStateDetail: "Start or resume a test before writing an answer.",
        hasUnsavedResponse: false,
        navigationNotice: "",
        nextTestletGate: null,
        testletTimer: null,
        leaveLock: null
      };
    }

    const availableActions = currentState.availableActions;
    const unitLabel =
      currentState.currentUnit.displayLabel ??
      currentState.currentUnit.unitKey ??
      "Untitled unit";
    const unitDescription =
      currentState.currentUnit.description?.trim() ||
      "No additional instructions for this unit.";
    const unitContent =
      currentState.currentUnit.content?.trim() ||
      `Respond to ${unitLabel}.`;
    const unitKey = currentState.currentUnit.unitKey ?? "";
    const bookletUnits = currentState.bookletUnits ?? [];
    const unitIndex = bookletUnits.findIndex(unit => unit.unitKey === unitKey);
    const previousUnitKey = currentState.navigation.previousUnitKey;
    const nextUnitKey = currentState.navigation.nextUnitKey;
    const policy = currentState.booklet.policy;
    const canNavigateUnits =
      currentState.testRun.status === "running" &&
      availableActions.includes("save_progress");
    const unitItems = bookletUnits.map((unit, index) => {
      const label = unit.displayLabel || unit.unitKey;
      const isCurrent = unit.unitKey === unitKey;
      const hasResponse = this.hasSavedResponse(currentState, unit.unitKey);
      const statusLabel = isCurrent
        ? hasResponse
          ? "Current answered"
          : "Current"
        : unit.isLocked
          ? "Locked"
          : hasResponse
          ? "Answered"
          : "Open";
      return {
        unitKey: unit.unitKey,
        label,
        position: `${index + 1}`,
        statusLabel,
        accessibilityLabel: [
          `Unit ${index + 1}: ${label}`,
          isCurrent ? "current" : "not current",
          hasResponse ? "answered" : "unanswered",
          unit.isLocked ? "locked" : "available"
        ].join(", "),
        isCurrent,
        hasResponse,
        canOpen:
          canNavigateUnits &&
          policy.navigation.unitMenuEnabled &&
          !isCurrent &&
          !unit.isLocked &&
          (index < unitIndex
            ? currentState.navigation.backwardDeniedReasons.length === 0
            : currentState.navigation.forwardDeniedReasons.length === 0)
      };
    });
    const answeredUnitCount = unitItems.filter(unit => unit.hasResponse).length;
    const totalUnitCount = bookletUnits.length;
    const missingUnitCount = Math.max(totalUnitCount - answeredUnitCount, 0);
    const progressPercent =
      totalUnitCount > 0 ? Math.round((answeredUnitCount / totalUnitCount) * 100) : 0;
    const isComplete = currentState.testRun.status === "completed";
    const savedUnitResponse = unitKey
      ? currentState.testRun.unitResponses[unitKey] ?? ""
      : "";
    const currentDraft = this.runtime.currentUnitResponse;
    const hasUnsavedResponse =
      currentState.testRun.status !== "completed" && currentDraft !== savedUnitResponse;
    const effectiveCompletion = this.getEffectiveCompletionState({
      answeredUnitCount,
      currentDraft,
      currentUnitKey: unitKey,
      hasUnsavedResponse,
      isComplete,
      totalUnitCount,
      unitItems
    });
    const draftStateLabel = this.getDraftStateLabel({
      canSaveProgress: availableActions.includes("save_progress"),
      hasSavedResponse: savedUnitResponse.length > 0,
      hasUnsavedResponse,
      isComplete
    });
    const draftStateDetail = this.getDraftStateDetail({
      hasUnsavedResponse,
      savedUnitResponse,
      currentDraft,
      isComplete
    });
    const displayNameLabel =
      currentState.participantRosterEntry?.displayName?.trim() ||
      currentState.participantSession.loginKey;
    const activeTestletTimer = currentState.activeTestletTimer;
    const testletTimer = activeTestletTimer
      ? (() => {
          const expiresAtMs = activeTestletTimer.expiresAt
            ? Date.parse(activeTestletTimer.expiresAt)
            : Number.NaN;
          const remainingSeconds =
            activeTestletTimer.status === "running" &&
            Number.isFinite(expiresAtMs)
              ? Math.max(
                  0,
                  Math.min(
                    activeTestletTimer.durationSeconds,
                    Math.ceil((expiresAtMs - this.timerTick()) / 1_000)
                  )
                )
              : activeTestletTimer.remainingSeconds;
          const minutes = Math.floor(remainingSeconds / 60);
          const seconds = remainingSeconds % 60;
          const activeWarning =
            this.activeTimerWarning?.testletKey === activeTestletTimer.testletKey &&
            this.activeTimerWarning.startedAt === activeTestletTimer.startedAt &&
            this.activeTimerWarning.visibleUntilMs > this.timerTick()
              ? this.activeTimerWarning
              : null;
          return {
            testletKey: activeTestletTimer.testletKey,
            displayLabel: activeTestletTimer.displayLabel,
            status: activeTestletTimer.status,
            leave: activeTestletTimer.leave,
            remainingSeconds,
            remainingLabel: `${minutes}:${String(seconds).padStart(2, "0")}`,
            progressPercent: Math.max(
              0,
              Math.min(
                100,
                Math.round(
                  (remainingSeconds / activeTestletTimer.durationSeconds) * 100
                )
              )
            ),
            leaveLabel:
              activeTestletTimer.leave === "forbidden"
                ? "This block cannot be left before time expires."
                : activeTestletTimer.leave === "allowed"
                  ? "Leaving this block closes it immediately."
                  : "Leaving this block requires confirmation.",
            showTimeLeft: activeTestletTimer.showTimeLeft,
            warningMessage: activeWarning
              ? `You have ${activeWarning.minutes} minute${activeWarning.minutes === 1 ? "" : "s"} left for this timed block.`
              : null
          };
        })()
      : null;
    const activeLeaveLock = currentState.activeLeaveLock;
    const leaveLock = activeLeaveLock
      ? {
          ...activeLeaveLock,
          detail:
            activeLeaveLock.scope === "unit"
              ? `After leaving, "${activeLeaveLock.unitDisplayLabel}" cannot be opened again.`
              : `After leaving, the block "${activeLeaveLock.displayLabel}" cannot be opened again.`
        }
      : null;

    return {
      headline: unitLabel,
      detail: currentState.booklet.displayLabel,
      displayNameLabel,
      loginLabel: currentState.participantSession.loginKey,
      groupLabel: currentState.participantSession.groupKey,
      sessionLabel: currentState.participantSession.participantSessionId,
      sessionEntryLink: this.createParticipantSessionEntryLink(),
      bookletLabel: currentState.booklet.displayLabel,
      unitLabel,
      unitDescription,
      unitContent,
      unitKey: unitKey || "n/a",
      unitPosition:
        unitIndex >= 0 ? `${unitIndex + 1} / ${bookletUnits.length}` : "n/a",
      unitOverviewLabel: `${answeredUnitCount}/${totalUnitCount} answered · ${missingUnitCount} open`,
      unitItems,
      responseProgressLabel: `${answeredUnitCount} / ${totalUnitCount} responses saved`,
      missingResponseLabel:
        missingUnitCount === 0
          ? "All units have a saved response."
          : `${missingUnitCount} ${missingUnitCount === 1 ? "unit" : "units"} without a saved response.`,
      progressPercent,
      completionLabel: isComplete
        ? currentState.testRun.completedAt
          ? `Completed ${currentState.testRun.completedAt}`
          : "Completed"
        : "Not completed yet",
      completionReadinessLabel: effectiveCompletion.label,
      completionReadinessDetail: effectiveCompletion.detail,
      completionReadinessState: effectiveCompletion.state,
      isComplete,
      previousUnitKey,
      nextUnitKey,
      runStatus: currentState.testRun.status,
      runId: currentState.testRun.testRunId,
      nextStepLabel: this.getNextStepLabel(currentState.testRun.status),
      nextStepDetail: this.getNextStepDetail({
        availableActions,
        isComplete,
        missingResponseLabel:
          missingUnitCount === 0
            ? "All units have a saved response."
            : `${missingUnitCount} ${missingUnitCount === 1 ? "unit" : "units"} without a saved response.`
      }),
      actions: availableActions,
      canSaveProgress: availableActions.includes("save_progress"),
      showUnitMenu: policy.navigation.unitMenuEnabled,
      showPreviousUnitControl: policy.navigation.unitControls === "both",
      showNextUnitControl: policy.navigation.unitControls !== "hidden",
      canGoPreviousUnit: canNavigateUnits && currentState.navigation.canGoPrevious,
      canGoNextUnit: canNavigateUnits && currentState.navigation.canGoNext,
      canResumeRun: availableActions.includes("resume"),
      canComplete: availableActions.includes("complete"),
      canClearSession: true,
      saveProgressLabel:
        currentState.testRun.status === "paused"
          ? "Save Running"
          : "Save Paused",
      unitResponse: savedUnitResponse,
      draftStateLabel,
      draftStateDetail,
      hasUnsavedResponse,
      navigationNotice: this.describeNavigationDenial(currentState),
      nextTestletGate: currentState.navigation.nextTestletGate,
      testletTimer,
      leaveLock
    };
  }

  get entryIssue(): ParticipantEntryIssue | null {
    const error = this.uiState.lastApiError();
    if (!error) {
      return null;
    }

    return this.describeParticipantEntryIssue(error);
  }

  get veronaPlayer(): ParticipantVeronaPlayerState | null {
    const currentState = this.readCurrentRunState();
    const player = currentState?.currentUnit.player;
    const unitDefinition = currentState?.currentUnit.unitDefinition?.trim();
    const unitKey = currentState?.currentUnit.unitKey;
    if (!currentState || !player?.html.trim() || !unitDefinition || !unitKey) {
      return null;
    }
    const unitIndex = currentState.bookletUnits.findIndex(
      unit => unit.unitKey === unitKey
    );
    return {
      playerKey: player.playerKey,
      playerHtml: player.html,
      testRunId: currentState.testRun.testRunId,
      unitKey,
      unitTitle: currentState.currentUnit.displayLabel ?? unitKey,
      unitDefinition,
      unitDefinitionType:
        currentState.currentUnit.unitDefinitionType?.trim() || player.playerKey,
      resourceBasePath: currentState.resourceBasePath?.trim() ?? "",
      savedResponse: currentState.testRun.unitResponses[unitKey] ?? "",
      unitNumber: Math.max(unitIndex + 1, 1),
      canGoPrevious: this.player.canGoPreviousUnit,
      canGoNext: this.player.canGoNextUnit,
      canComplete: currentState.navigation.canPlayerEnd,
      logPolicy: currentState.booklet.policy.player.logPolicy,
      pagingMode: currentState.booklet.policy.player.pagingMode,
      restoreCurrentPageOnReturn:
        currentState.booklet.policy.player.restoreCurrentPageOnReturn
    };
  }

  private describeNavigationDenial(
    currentState: ParticipantCurrentRunStateResponse["currentRunState"]
  ): string {
    const reasons = currentState.navigation.forwardDeniedReasons;
    if (reasons.includes("presentation_incomplete")) {
      return "View all required unit content before moving forward or completing the test.";
    }
    if (reasons.includes("response_incomplete")) {
      return "Complete the required response before moving forward or completing the test.";
    }
    if (reasons.includes("testlet_code_required")) {
      return "Enter the block code before opening the next block.";
    }
    if (reasons.includes("testlet_time_leave_forbidden")) {
      return "This timed block cannot be left before its time expires.";
    }
    if (reasons.includes("testlet_time_leave_confirmation_required")) {
      return "Confirm leaving the timed block before continuing.";
    }
    if (reasons.includes("testlet_time_closed")) {
      return "This timed block is closed and cannot be opened again.";
    }
    if (reasons.includes("testlet_leave_confirmation_required")) {
      return "Confirm leaving before the unit or block is locked.";
    }
    if (reasons.includes("testlet_leave_locked")) {
      return "This unit or block was locked after it was left.";
    }
    return "";
  }

  private startTimerTicker(): void {
    if (this.timerTickerHandle != null || !globalThis.window) {
      return;
    }
    this.timerTickerHandle = globalThis.window.setInterval(() => {
      const currentTick = Date.now();
      this.timerTick.set(currentTick);
      const activeTimer = this.readCurrentRunState()?.activeTestletTimer;
      const expiresAtMs = activeTimer?.expiresAt
        ? Date.parse(activeTimer.expiresAt)
        : Number.NaN;
      if (activeTimer?.status === "running" && Number.isFinite(expiresAtMs)) {
        const remainingSeconds = Math.max(
          0,
          Math.ceil((expiresAtMs - currentTick) / 1_000)
        );
        const timerKey = `${activeTimer.testletKey}:${activeTimer.startedAt}`;
        const previousRemainingSeconds = this.timerRemainingSeconds.get(timerKey);
        const warningMinutes = activeTimer.warningMinutes.find(minutes => {
          const warningSeconds = Math.round(minutes * 60);
          return (
            warningSeconds > 0 &&
            warningSeconds < activeTimer.durationSeconds &&
            remainingSeconds <= warningSeconds &&
            (previousRemainingSeconds === undefined
              ? remainingSeconds === warningSeconds
              : previousRemainingSeconds > warningSeconds)
          );
        });
        this.timerRemainingSeconds.set(timerKey, remainingSeconds);
        if (warningMinutes !== undefined) {
          const warningKey = `${activeTimer.testletKey}:${activeTimer.startedAt}:${warningMinutes}`;
          if (!this.seenTimerWarnings.has(warningKey)) {
            this.seenTimerWarnings.add(warningKey);
            this.activeTimerWarning = {
              testletKey: activeTimer.testletKey,
              startedAt: activeTimer.startedAt,
              minutes: warningMinutes,
              visibleUntilMs: currentTick + 5_000
            };
          }
        }
      }
      if (
        this.activeTimerWarning &&
        this.activeTimerWarning.visibleUntilMs <= currentTick
      ) {
        this.activeTimerWarning = null;
      }
      if (
        activeTimer?.status === "running" &&
        Number.isFinite(expiresAtMs) &&
        expiresAtMs <= currentTick &&
        !this.timerExpiryRefreshPending
      ) {
        this.timerExpiryRefreshPending = true;
        void this.refreshCurrentStateInternal(true).finally(() => {
          this.timerExpiryRefreshPending = false;
        });
      }
    }, 250);
  }

  get canSignIn(): boolean {
    return Boolean(
      this.workspace.workspaceKey.trim() && this.runtime.loginKey.trim()
    );
  }

  get canStartOrResume(): boolean {
    return Boolean(this.runtime.participantSessionId.trim()) || this.canSignIn;
  }

  get canRefreshCurrentState(): boolean {
    return Boolean(this.runtime.participantSessionId.trim());
  }

  resumeSession(): void {
    if (!this.canStartOrResume) {
      return;
    }

    this.viewState.onActionAsync(() => this.startOrResumeInternal());
  }

  signIn(): void {
    if (!this.canSignIn) {
      return;
    }

    this.viewState.onActionAsync(() => this.signInInternal());
  }

  refreshCurrentState(): void {
    if (!this.canRefreshCurrentState) {
      return;
    }

    this.viewState.onActionAsync(() => this.refreshCurrentStateInternal(false));
  }

  saveProgressFromPlayer(): void {
    const player = this.player;
    if (!player.canSaveProgress) {
      return;
    }

    this.viewState.onActionAsync(() =>
      this.saveProgressInternal(
        player.runStatus === "paused" ? "running" : "paused",
        this.runtime.currentUnitKey.trim() || undefined,
        this.runtime.currentUnitResponse
      )
    );
  }

  saveVeronaResponse(response: string): void {
    const currentState = this.readCurrentRunState();
    const unitKey = currentState?.currentUnit.unitKey?.trim();
    if (
      !currentState ||
      !unitKey ||
      !currentState.availableActions.includes("save_progress")
    ) {
      return;
    }

    this.runtime.currentUnitResponse = response;
    this.persistState();
    this.pendingVeronaSave = {
      testRunId: currentState.testRun.testRunId,
      unitKey,
      response,
      status: currentState.testRun.status === "paused" ? "paused" : "running"
    };
    this.scheduleVeronaSaveDrain();
  }

  retryVeronaSave(): void {
    if (this.pendingVeronaSave) {
      this.scheduleVeronaSaveDrain();
    }
  }

  navigateFromVerona(target: string): void {
    switch (target) {
      case "previous":
        this.goToPreviousUnit();
        break;
      case "next":
        this.goToNextUnit();
        break;
      case "first": {
        const firstUnit = this.player.unitItems[0];
        if (firstUnit) {
          this.goToUnit(firstUnit.unitKey);
        }
        break;
      }
      case "last": {
        const lastUnit = this.player.unitItems.at(-1);
        if (lastUnit) {
          this.goToUnit(lastUnit.unitKey);
        }
        break;
      }
      case "end":
        if (this.veronaPlayer?.canComplete) {
          this.completeRun();
        }
        break;
    }
  }

  goToPreviousUnit(): void {
    if (!this.player.canGoPreviousUnit) {
      return;
    }

    this.viewState.onActionAsync(() => this.goToPlayerUnitInternal("previous"));
  }

  goToNextUnit(): void {
    if (!this.player.canGoNextUnit) {
      return;
    }

    this.viewState.onActionAsync(() => this.goToPlayerUnitInternal("next"));
  }

  goToUnit(unitKey: string): void {
    if (!this.player.unitItems.some(unit => unit.unitKey === unitKey && unit.canOpen)) {
      return;
    }

    this.viewState.onActionAsync(() => this.goToPlayerUnitInternal(unitKey));
  }

  unlockNextTestlet(): void {
    const gate = this.player.nextTestletGate;
    if (!gate || !this.testletUnlockCode.trim()) {
      return;
    }
    this.viewState.onActionAsync(() => this.unlockNextTestletInternal(gate));
  }

  resumeRun(): void {
    if (!this.player.canResumeRun) {
      return;
    }

    this.viewState.onActionAsync(() => this.resumeRunInternal());
  }

  completeRun(): void {
    const player = this.player;
    if (!player.canComplete) {
      return;
    }

    const confirmTestletTimeLeave =
      player.testletTimer?.leave === "confirm";
    if (
      confirmTestletTimeLeave &&
      !globalThis.window?.confirm(
        `Leave the timed block "${player.testletTimer?.displayLabel}" and close it permanently?`
      )
    ) {
      return;
    }
    const confirmTestletLeaveLock =
      player.leaveLock?.confirm === true;
    if (
      confirmTestletLeaveLock &&
      !globalThis.window?.confirm(
        `${player.leaveLock?.detail} Continue?`
      )
    ) {
      return;
    }
    if (
      !player.isComplete &&
      player.completionReadinessState !== "ready" &&
      !globalThis.window?.confirm(
        `Complete this test with ${player.completionReadinessLabel.toLowerCase()}?`
      )
    ) {
      return;
    }
    this.viewState.onActionAsync(() =>
      this.completeRunInternal(
        confirmTestletTimeLeave,
        confirmTestletLeaveLock
      )
    );
  }

  clearSession(): void {
    this.clearStoredParticipantSession(
      'Session cleared locally. Use "Sign In" or "Start Or Resume" for the next participant.'
    );
  }

  async copySessionEntryLink(sessionEntryLink: string): Promise<void> {
    const normalizedSessionEntryLink = sessionEntryLink.trim();
    if (!normalizedSessionEntryLink) {
      return;
    }

    this.copiedSessionEntryLink = normalizedSessionEntryLink;
    if (!(await copyTextToClipboard(normalizedSessionEntryLink))) {
      this.copiedSessionEntryLink = "";
    }
  }

  isSessionEntryLinkCopied(sessionEntryLink: string): boolean {
    return (
      Boolean(sessionEntryLink.trim()) &&
      this.copiedSessionEntryLink === sessionEntryLink.trim()
    );
  }

  private async startOrResumeInternal(): Promise<void> {
    if (this.runtime.participantSessionId.trim()) {
      try {
        await this.resumeSessionInternal({ quiet: true });
        return;
      } catch (error) {
        if (!this.isStoredParticipantSessionMissing(error)) {
          throw error;
        }
        this.clearStoredParticipantSession();
      }
    }

    await this.starterLaunchInternal();
  }

  private async resumeEntrySessionInternal(
    normalized: NormalizedParticipantEntryParameters
  ): Promise<void> {
    // A session-only re-entry URL is authoritative. Do not let a booklet from a
    // previously persisted browser session constrain which assigned booklet the
    // server resumes next.
    this.runtime.bookletKey = normalized.bookletKey;
    try {
      await this.resumeSessionInternal({ quiet: true });
      await this.applyEntryDraftAfterResume(normalized);
    } catch (error) {
      if (!this.isParticipantSessionNoLongerResumable(error)) {
        throw error;
      }

      await this.refreshCurrentStateInternal(true);
    }
  }

  private async signInInternal(): Promise<void> {
    const payload = await this.requestState.request<ParticipantSignInResponse>(
      "Participant Sign In",
      "POST",
      productionApiRoutes.participant.signIn,
      {
        tenantKey: this.workspace.tenantKey.trim() || undefined,
        workspaceKey: this.workspace.workspaceKey.trim(),
        loginKey: this.runtime.loginKey.trim(),
        groupKey: this.runtime.groupKey.trim() || undefined,
        password: this.runtime.participantPassword || undefined
      } satisfies ParticipantSignInRequest
    );

    this.syncParticipantSessionFields(payload.participantSession);
    this.syncParticipantRosterEntry(payload.participantRosterEntry);
    this.syncRuntimeBooklets(payload.booklets);
    this.runtime.testRunId = "";
    this.runtime.currentUnitKey = "";
    this.runtime.currentUnitResponse = "";
    this.runtime.currentRunStateView = prettyPrintJson(
      {
        status: "participant_signed_in",
        message: 'Session is ready. Use "Start Or Resume" to open the test run.',
        participantSession: payload.participantSession
      },
      this.runtime.currentRunStateView
    );
    this.runtime.runtimeMonitorView = prettyPrintJson(
      payload,
      this.runtime.runtimeMonitorView
    );
    this.persistState();
  }

  private clearStoredParticipantSession(
    message = 'Stored participant session is gone. Use "Start Or Resume".'
  ): void {
    this.copiedSessionEntryLink = "";
    this.assignedBooklets = [];
    this.pendingVeronaSave = null;
    this.veronaSaveStatus = "not_saved";
    if (
      !this.runtime.participantSessionId.trim() &&
      !this.runtime.testRunId.trim()
    ) {
      return;
    }

    this.runtime.participantSessionId = "";
    this.runtime.testRunId = "";
    this.runtime.currentUnitKey = "";
    this.runtime.currentUnitResponse = "";
    this.runtime.currentRunStateView = message;
    this.persistState();
  }

  private isStoredParticipantSessionMissing(error: unknown): boolean {
    return (
      this.requestState.isApiError(error) &&
      error.error === "participant_session_not_found"
    );
  }

  private isParticipantSessionNoLongerResumable(error: unknown): boolean {
    return (
      this.requestState.isApiError(error) &&
      [
        "participant_session_has_no_resumable_run",
        "participant_session_closed",
        "booklet_already_completed"
      ].includes(error.error)
    );
  }

  private async starterLaunchInternal(): Promise<void> {
    const payload = await this.requestState.request<ParticipantLaunchResponse>(
      "Participant Starter Launch",
      "POST",
      productionApiRoutes.participant.launch,
      {
        tenantKey: this.workspace.tenantKey.trim() || undefined,
        workspaceKey: this.workspace.workspaceKey.trim(),
        loginKey: this.runtime.loginKey.trim(),
        groupKey: this.runtime.groupKey.trim() || undefined,
        bookletKey: this.runtime.bookletKey.trim() || undefined,
        password: this.runtime.participantPassword || undefined
      } satisfies ParticipantLaunchRequest
    );

    this.syncParticipantSessionFields(payload.participantSession);
    this.syncParticipantRosterEntry(payload.participantRosterEntry);
    this.syncRun(payload.testRun);
    this.syncRuntimeBooklets(payload.booklets);
    this.runtime.runtimeMonitorView = prettyPrintJson(
      payload,
      this.runtime.runtimeMonitorView
    );
    this.persistState();
    await this.refreshCurrentStateInternal(true);
  }

  private async resumeSessionInternal(options: { quiet?: boolean } = {}): Promise<void> {
    const payload = await this.requestState.request<ResumeParticipantSessionResponse>(
      "Participant Resume Session",
      "POST",
      resolveRoutePath(productionApiRoutes.participant.resumeSession, {
        participantSessionId: this.runtime.participantSessionId.trim()
      }),
      {
        bookletKey: this.runtime.bookletKey.trim() || undefined
      } satisfies ResumeParticipantSessionRequest,
      { quiet: options.quiet ?? false }
    );

    this.syncRun(payload.testRun);
    this.runtime.runtimeMonitorView = prettyPrintJson(
      payload,
      this.runtime.runtimeMonitorView
    );
    this.persistState();
    await this.refreshCurrentStateInternal(true);
  }

  private async saveProgressInternal(
    status: "paused" | "running",
    currentUnitKey = this.runtime.currentUnitKey.trim() || undefined,
    unitResponse?: string | null,
    confirmTestletTimeLeave = false,
    confirmTestletLeaveLock = false
  ): Promise<void> {
    const payload = await this.requestState.request<SaveTestRunProgressResponse>(
      status === "paused" ? "Participant Save Paused" : "Participant Save Running",
      "POST",
      resolveRoutePath(productionApiRoutes.participant.saveProgress, {
        testRunId: this.runtime.testRunId.trim()
      }),
      {
        currentUnitKey,
        status,
        unitResponse,
        confirmTestletTimeLeave,
        confirmTestletLeaveLock
      } satisfies SaveTestRunProgressRequest
    );

    this.syncRun(payload.testRun);
    this.runtime.runtimeMonitorView = prettyPrintJson(
      payload,
      this.runtime.runtimeMonitorView
    );
    this.persistState();
    await this.refreshCurrentStateInternal(true);
  }

  private scheduleVeronaSaveDrain(): void {
    if (this.veronaSaveDrainPromise) {
      return;
    }
    this.veronaSaveStatus = "saving";
    const drainPromise = this.drainVeronaSaveQueue().finally(() => {
      if (this.veronaSaveDrainPromise === drainPromise) {
        this.veronaSaveDrainPromise = null;
      }
      if (this.pendingVeronaSave && this.veronaSaveStatus !== "save_failed") {
        this.scheduleVeronaSaveDrain();
      }
    });
    this.veronaSaveDrainPromise = drainPromise;
    this.viewState.onActionAsync(() => drainPromise);
  }

  private async drainVeronaSaveQueue(): Promise<void> {
    while (this.pendingVeronaSave) {
      const save = this.pendingVeronaSave;
      this.pendingVeronaSave = null;
      try {
        const payload = await this.requestState.request<SaveTestRunProgressResponse>(
          "Verona Auto Save",
          "POST",
          resolveRoutePath(productionApiRoutes.participant.saveProgress, {
            testRunId: save.testRunId
          }),
          {
            currentUnitKey: save.unitKey,
            status: save.status,
            unitResponse: save.response
          } satisfies SaveTestRunProgressRequest,
          { quiet: true }
        );
        this.syncRun(payload.testRun);
        this.runtime.runtimeMonitorView = prettyPrintJson(
          payload,
          this.runtime.runtimeMonitorView
        );
      } catch {
        this.pendingVeronaSave = this.pendingVeronaSave ?? save;
        this.veronaSaveStatus = "save_failed";
        this.persistState();
        return;
      }
    }

    this.veronaSaveStatus = "saved";
    this.persistState();
    await this.refreshCurrentStateInternal(true);
  }

  private async goToPlayerUnitInternal(
    target: "previous" | "next" | string
  ): Promise<void> {
    await this.settleVeronaAutoSaveBeforeForegroundAction();
    const player = this.player;
    const targetUnitKey =
      target === "previous"
        ? player.previousUnitKey
        : target === "next"
          ? player.nextUnitKey
          : target.trim();
    if (!targetUnitKey) {
      return;
    }

    const targetUnit = player.unitItems.find(unit => unit.unitKey === targetUnitKey);
    if (targetUnitKey === player.unitKey || !targetUnit?.canOpen) {
      return;
    }

    const currentState = this.readCurrentRunState();
    const activeTimer = player.testletTimer;
    const targetTestletPath =
      currentState?.bookletUnits.find(
        unit => unit.unitKey === targetUnitKey
      )?.testletPath ?? [];
    const leavesActiveTimedBlock =
      activeTimer != null &&
      !targetTestletPath.includes(activeTimer.testletKey);
    const confirmTestletTimeLeave =
      leavesActiveTimedBlock && activeTimer.leave === "confirm";
    if (
      confirmTestletTimeLeave &&
      !globalThis.window?.confirm(
        `Leave the timed block "${activeTimer.displayLabel}" and close it permanently?`
      )
    ) {
      return;
    }
    const activeLeaveLock = player.leaveLock;
    const leavesLockScope =
      activeLeaveLock != null &&
      (activeLeaveLock.scope === "unit" ||
        targetTestletPath.at(-1) !== activeLeaveLock.testletKey);
    const confirmTestletLeaveLock =
      leavesLockScope && activeLeaveLock?.confirm === true;
    if (
      confirmTestletLeaveLock &&
      !globalThis.window?.confirm(
        `${activeLeaveLock.detail} Continue?`
      )
    ) {
      return;
    }
    const currentUnitKey = this.runtime.currentUnitKey.trim();
    if (currentUnitKey) {
      await this.saveProgressInternal(
        "running",
        currentUnitKey,
        this.runtime.currentUnitResponse
      );
    }
    await this.saveProgressInternal(
      "running",
      targetUnitKey,
      undefined,
      confirmTestletTimeLeave,
      confirmTestletLeaveLock
    );
  }

  private async unlockNextTestletInternal(gate: {
    testletKey: string;
  }): Promise<void> {
    await this.settleVeronaAutoSaveBeforeForegroundAction();
    const payload = await this.requestState.request<UnlockParticipantTestletResponse>(
      "Participant Unlock Block",
      "POST",
      resolveRoutePath(productionApiRoutes.participant.unlockTestlet, {
        testRunId: this.runtime.testRunId.trim(),
        testletKey: gate.testletKey
      }),
      {
        code: this.testletUnlockCode
      } satisfies UnlockParticipantTestletRequest
    );
    this.testletUnlockCode = "";
    this.syncRun(payload.testRun);
    this.persistState();
    await this.refreshCurrentStateInternal(true);
  }

  private async resumeRunInternal(): Promise<void> {
    const payload = await this.requestState.request<ResumeTestRunResponse>(
      "Participant Resume Run",
      "POST",
      resolveRoutePath(productionApiRoutes.participant.resumeRun, {
        testRunId: this.runtime.testRunId.trim()
      })
    );

    this.syncRun(payload.testRun);
    this.runtime.runtimeMonitorView = prettyPrintJson(
      payload,
      this.runtime.runtimeMonitorView
    );
    this.persistState();
    await this.refreshCurrentStateInternal(true);
  }

  private async completeRunInternal(
    confirmTestletTimeLeave = false,
    confirmTestletLeaveLock = false
  ): Promise<void> {
    await this.settleVeronaAutoSaveBeforeForegroundAction();
    await this.saveCurrentDraftBeforeCompleteInternal();

    const payload = await this.requestState.request<{
      testRun: {
        testRunId: string;
        status: string;
        currentUnitKey?: string | null;
        completedAt?: string | null;
      };
    }>(
      "Participant Complete Run",
      "POST",
      resolveRoutePath(productionApiRoutes.participant.completeRun, {
        testRunId: this.runtime.testRunId.trim()
      }),
      {
        confirmTestletTimeLeave,
        confirmTestletLeaveLock
      } satisfies CompleteTestRunRequest
    );

    this.syncRun(payload.testRun);
    this.runtime.runtimeMonitorView = prettyPrintJson(
      payload,
      this.runtime.runtimeMonitorView
    );
    this.persistState();
    await this.refreshCurrentStateInternal(true);
  }

  private async saveCurrentDraftBeforeCompleteInternal(): Promise<void> {
    const player = this.player;
    const currentUnitKey = this.runtime.currentUnitKey.trim();
    if (
      !player.canSaveProgress ||
      !this.runtime.testRunId.trim() ||
      !currentUnitKey
    ) {
      return;
    }

    await this.saveProgressInternal(
      player.runStatus === "paused" ? "paused" : "running",
      currentUnitKey,
      this.runtime.currentUnitResponse
    );
  }

  private async settleVeronaAutoSaveBeforeForegroundAction(): Promise<void> {
    const activeSave = this.veronaSaveDrainPromise;
    if (activeSave) {
      await activeSave;
    }
    // A failed background save remains queued for an explicit retry. Navigation
    // and completion perform the same save in the foreground, so use the latest
    // runtime response there instead of issuing the stale queued request later.
    this.pendingVeronaSave = null;
  }

  private async refreshCurrentStateInternal(quiet: boolean): Promise<void> {
    if (!this.runtime.participantSessionId.trim()) {
      return;
    }

    try {
      const payload =
        await this.requestState.request<ParticipantCurrentRunStateResponse>(
          "Participant Current State",
          "GET",
          resolveRoutePath(productionApiRoutes.participant.getCurrentRunState, {
            participantSessionId: this.runtime.participantSessionId.trim()
          }),
          undefined,
          { quiet }
        );
      this.runtime.currentRunStateView = prettyPrintJson(
        payload,
        this.runtime.currentRunStateView
      );
      this.syncCurrentRunState(payload.currentRunState);
      this.syncCurrentUnitResponse(payload.currentRunState);
      this.persistState();
    } catch (error) {
      if (
        this.requestState.isApiError(error) &&
        error.error === "participant_session_has_no_current_run"
      ) {
        this.runtime.currentRunStateView = prettyPrintJson(
          error,
          this.runtime.currentRunStateView
        );
        this.persistState();
        return;
      }
      throw error;
    }
  }

  private syncRun(testRun: {
    testRunId: string;
    status?: string;
    currentUnitKey?: string | null;
    bookletKey?: string;
    bookletAssignmentKey?: string;
  }): void {
    this.runtime.testRunId = testRun.testRunId;
    if (testRun.bookletAssignmentKey || testRun.bookletKey) {
      this.runtime.bookletKey =
        testRun.bookletAssignmentKey ?? testRun.bookletKey ?? "";
    }
    if (testRun.currentUnitKey != null) {
      this.runtime.currentUnitKey = testRun.currentUnitKey;
    }
  }

  private syncParticipantSessionFields(participantSession: {
    participantSessionId: string;
    loginKey: string;
    groupKey: string;
  }): void {
    this.runtime.participantSessionId = participantSession.participantSessionId;
    this.runtime.loginKey = participantSession.loginKey;
    this.runtime.groupKey = participantSession.groupKey;
  }

  private syncCurrentRunState(
    currentState: ParticipantCurrentRunStateResponse["currentRunState"]
  ): void {
    this.workspace.tenantKey = currentState.scope.tenantKey;
    this.workspace.workspaceKey = currentState.scope.workspaceKey;
    this.syncParticipantSessionFields(currentState.participantSession);
    this.syncParticipantRosterEntry(currentState.participantRosterEntry);
    this.syncRun(currentState.testRun);
    this.syncRuntimeBooklets(currentState.booklets);
  }

  private syncParticipantRosterEntry(
    participantRosterEntry: { displayName: string | null } | null
  ): void {
    this.runtime.participantDisplayName =
      participantRosterEntry?.displayName?.trim() ?? "";
  }

  private syncRuntimeBooklets(booklets: ParticipantRuntimeBooklet[]): void {
    this.assignedBooklets = booklets;
    const selectedBooklet = booklets.find(
      booklet => booklet.bookletKey === this.runtime.bookletKey.trim()
    );
    if (selectedBooklet && selectedBooklet.status !== "completed") {
      return;
    }

    const nextBooklet =
      booklets.find(booklet => booklet.status === "in_progress") ??
      booklets.find(booklet => booklet.status === "available") ??
      selectedBooklet ??
      booklets[0];
    if (nextBooklet) {
      this.runtime.bookletKey = nextBooklet.bookletKey;
    }
  }

  formatBookletVariant(booklet: ParticipantRuntimeBooklet): string {
    const preset = Object.entries(booklet.statePreset ?? {})
      .map(([stateKey, optionKey]) => `${stateKey}=${optionKey}`)
      .join(", ");
    return preset ? ` · ${preset}` : "";
  }

  private syncCurrentUnitResponse(
    currentState: ParticipantCurrentRunStateResponse["currentRunState"]
  ): void {
    const unitKey = currentState.currentUnit.unitKey;
    this.runtime.currentUnitResponse = unitKey
      ? currentState.testRun.unitResponses[unitKey] ?? ""
      : "";
  }

  private createParticipantSessionEntryLink(): string {
    const participantSessionId = this.runtime.participantSessionId.trim();
    if (!participantSessionId) {
      return "";
    }

    const currentState = this.readCurrentRunState();
    return buildParticipantSessionEntryUrl(participantSessionId, {
      tenantKey: currentState?.scope.tenantKey ?? this.workspace.tenantKey,
      workspaceKey: currentState?.scope.workspaceKey ?? this.workspace.workspaceKey,
      loginKey: currentState?.participantSession.loginKey ?? this.runtime.loginKey,
      groupKey: currentState?.participantSession.groupKey ?? this.runtime.groupKey,
      bookletKey: currentState?.testRun.bookletKey ?? this.runtime.bookletKey
    });
  }

  private hasSavedResponse(
    currentState: ParticipantCurrentRunStateResponse["currentRunState"],
    unitKey: string
  ): boolean {
    return Object.prototype.hasOwnProperty.call(
      currentState.testRun.unitResponses,
      unitKey
    );
  }

  private getEffectiveCompletionState(args: {
    answeredUnitCount: number;
    currentDraft: string;
    currentUnitKey: string;
    hasUnsavedResponse: boolean;
    isComplete: boolean;
    totalUnitCount: number;
    unitItems: ParticipantPlayerUnitItem[];
  }): {
    label: string;
    detail: string;
    state: ParticipantPlayerState["completionReadinessState"];
  } {
    if (args.isComplete) {
      return {
        label: "Complete",
        detail: "This test run is closed and ready for operator review.",
        state: "complete"
      };
    }

    if (args.totalUnitCount === 0) {
      return {
        label: "Not ready",
        detail: "No booklet units are loaded yet.",
        state: "idle"
      };
    }

    const draftAddsCurrentResponse =
      args.currentUnitKey.length > 0 &&
      args.currentDraft.length > 0 &&
      !args.unitItems.some(
        unit => unit.unitKey === args.currentUnitKey && unit.hasResponse
      );
    const answeredUnitCount = args.answeredUnitCount + (draftAddsCurrentResponse ? 1 : 0);
    const totalUnitCount = args.totalUnitCount;
    const missingUnitCount = Math.max(totalUnitCount - answeredUnitCount, 0);
    const missingResponseLabel =
      missingUnitCount === 0
        ? "all units will have a saved response"
        : `${missingUnitCount} ${missingUnitCount === 1 ? "unit" : "units"} still missing`;

    if (missingUnitCount === 0) {
      return {
        label: "Ready to complete",
        detail: args.hasUnsavedResponse
          ? "All units will be answered after Complete Test saves the current draft."
          : "All units already have saved responses.",
        state: "ready"
      };
    }

    return {
      label: `${missingUnitCount} ${missingUnitCount === 1 ? "response" : "responses"} missing`,
      detail: args.hasUnsavedResponse
        ? `Complete Test will save this draft, but ${missingResponseLabel}.`
        : `${missingResponseLabel} before the test is fully answered.`,
      state: "incomplete"
    };
  }

  private getDraftStateLabel(args: {
    canSaveProgress: boolean;
    hasSavedResponse: boolean;
    hasUnsavedResponse: boolean;
    isComplete: boolean;
  }): string {
    if (args.isComplete) {
      return "Completed";
    }
    if (!args.canSaveProgress) {
      return "Read only";
    }
    if (args.hasUnsavedResponse) {
      return "Unsaved draft";
    }
    return args.hasSavedResponse ? "Saved" : "No response yet";
  }

  private getDraftStateDetail(args: {
    hasUnsavedResponse: boolean;
    savedUnitResponse: string;
    currentDraft: string;
    isComplete: boolean;
  }): string {
    if (args.isComplete) {
      return "This test is complete; responses are no longer editable.";
    }
    if (args.hasUnsavedResponse) {
      return "Use save, navigation, or Complete Test to store this answer. Complete Test saves this draft before closing.";
    }
    if (args.savedUnitResponse.length > 0) {
      return "The answer shown here matches the saved response for this unit.";
    }
    if (args.currentDraft.length > 0) {
      return "The current answer is ready to save.";
    }
    return "Write an answer, then save or move to another unit.";
  }

  private getNextStepLabel(status: string): string {
    if (status === "completed") {
      return "Completed";
    }
    if (status === "paused") {
      return "Resume test";
    }
    return "Answer current unit";
  }

  private getNextStepDetail(args: {
    availableActions: string[];
    isComplete: boolean;
    missingResponseLabel: string;
  }): string {
    if (args.isComplete) {
      return "This test run is closed and ready for operator review.";
    }
    if (args.availableActions.includes("resume")) {
      return 'Use "Resume Run" or save a running answer to continue.';
    }
    if (args.availableActions.includes("save_progress")) {
      return `${args.missingResponseLabel} Save, navigate, or complete when ready.`;
    }
    return "No participant action is available for this run.";
  }

  private readCurrentRunState():
    | ParticipantCurrentRunStateResponse["currentRunState"]
    | null {
    try {
      const payload = JSON.parse(this.runtime.currentRunStateView) as Partial<
        ParticipantCurrentRunStateResponse
      >;
      return payload.currentRunState ?? null;
    } catch {
      return null;
    }
  }

  private describeParticipantEntryIssue(
    error: ApiErrorLike
  ): ParticipantEntryIssue {
    const details = this.readErrorDetails(error);
    const workspaceKey =
      typeof details.workspaceKey === "string"
        ? details.workspaceKey
        : this.workspace.workspaceKey.trim() || "the workspace";
    const matchingWorkspaceCount =
      typeof details.matchingWorkspaceCount === "number"
        ? details.matchingWorkspaceCount
        : null;
    const statusCode = error.statusCode ? `HTTP ${error.statusCode}` : "API error";

    switch (error.error) {
      case "participant_workspace_ambiguous":
        return {
          title: "Tenant key required",
          detail: matchingWorkspaceCount
            ? `Workspace '${workspaceKey}' exists in ${matchingWorkspaceCount} tenants.`
            : `Workspace '${workspaceKey}' exists in multiple tenants.`,
          action:
            "Enter the assigned tenant key or open a participant link that includes tenantKey.",
          errorCode: error.error,
          statusCode
        };
      case "participant_workspace_key_required":
        return {
          title: "Workspace key missing",
          detail: "The participant entry cannot find a workspace without the assigned workspace key.",
          action: "Enter the workspace key from the invitation or operator launchpad.",
          errorCode: error.error,
          statusCode
        };
      case "participant_login_key_required":
        return {
          title: "Login key missing",
          detail: "The participant entry needs the assigned login key before it can create or resume a session.",
          action: "Enter the login key from the participant roster or direct entry link.",
          errorCode: error.error,
          statusCode
        };
      case "workspace_not_found":
        return {
          title: "Workspace not found",
          detail: error.message,
          action:
            "Check the tenant and workspace keys, then use Sign In again. If the link came from an operator, regenerate it from the current workspace.",
          errorCode: error.error,
          statusCode
        };
      case "workspace_has_no_active_content_release":
        return {
          title: "No active test release",
          detail: "This workspace exists, but no content release is active for participants yet.",
          action:
            "Ask an operator to activate a release for this workspace, then start or resume again.",
          errorCode: error.error,
          statusCode
        };
      case "booklet_not_found":
        return {
          title: "Assigned booklet unavailable",
          detail: error.message,
          action:
            "Check the booklet key or ask an operator to update the roster assignment for the active release.",
          errorCode: error.error,
          statusCode
        };
      case "participant_session_not_found":
        return {
          title: "Session link expired",
          detail: "The saved participant session could not be found anymore.",
          action:
            "Use Leave Session, then sign in again with the assigned workspace and login key.",
          errorCode: error.error,
          statusCode
        };
      default:
        return {
          title: "Participant entry needs attention",
          detail: error.message,
          action:
            "Check the entered keys and try again. If the problem persists, share the error code with an operator.",
          errorCode: error.error,
          statusCode
        };
    }
  }

  private readErrorDetails(error: ApiErrorLike): Record<string, unknown> {
    return error.details && typeof error.details === "object"
      ? (error.details as Record<string, unknown>)
      : {};
  }
}
