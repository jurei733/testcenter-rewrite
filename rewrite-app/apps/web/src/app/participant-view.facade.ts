import { Injectable, effect, inject, signal } from "@angular/core";

import type {
  CompleteTestRunRequest,
  CompleteTestRunResponse,
  CreateParticipantReviewRequest,
  DeleteParticipantReviewResponse,
  ListParticipantReviewsResponse,
  ParticipantCurrentRunStateResponse,
  ParticipantLaunchRequest,
  ParticipantLaunchResponse,
  ParticipantReviewResponse,
  ParticipantRuntimeStateResponse,
  ParticipantSignInRequest,
  ParticipantSignInResponse,
  ResumeParticipantSessionRequest,
  ResumeParticipantSessionResponse,
  ResumeTestRunResponse,
  SaveTestRunProgressRequest,
  SaveTestRunProgressResponse,
  SaveParticipantTestLogsRequest,
  SaveParticipantTestLogsResponse,
  SelectParticipantAdaptiveStateRequest,
  SelectParticipantAdaptiveStateResponse,
  UnlockParticipantTestletRequest,
  UnlockParticipantTestletResponse,
  UpdateParticipantReviewRequest
} from "@testcenter-rewrite-app/contracts";
import {
  type ParticipantCustomTextKey,
  isBookletPlayerEndAllowed,
  mergeParticipantCustomTextScopes,
  parseVeronaUnitResponse,
  projectTestcenterLoadEnvironment,
  productionApiRoutes,
  resolveAndFormatParticipantCustomText,
  resolveParticipantCustomText,
  resolveRoutePath
} from "@testcenter-rewrite-app/contracts";
import type {
  ParticipantRosterEntry,
  ParticipantRuntimeBooklet,
  ParticipantTestLogEntryInput,
  WorkspaceReview
} from "@testcenter-rewrite-app/domain";

import { copyTextToClipboard } from "./copy-text-to-clipboard";
import {
  createParticipantSaveOutboxEntry,
  discardParticipantSaveOutboxForRun,
  findParticipantSaveOutboxEntry,
  findParticipantSaveOutboxEntryForUnit,
  persistParticipantSaveOutboxEntry,
  queueParticipantSaveOutboxEntryForBackgroundDelivery,
  queueParticipantSaveOutboxForRunForBackgroundDelivery,
  removeParticipantSaveOutboxEntry,
  type ParticipantSaveOutboxEntry
} from "./participant-save-outbox";
import { buildParticipantSessionEntryUrl } from "./participant-session-links";
import { ApplicationSettingsService } from "./application-settings.service";
import { BrowserCompatibilityService } from "./browser-compatibility.service";
import { ParticipantEventStreamService } from "./participant-event-stream.service";
import { ParticipantShellStateService } from "./participant-shell-state.service";
import type { ApiErrorLike } from "./rewrite-app-api.service";
import { parseJsonDocument, prettyPrintJson } from "./rewrite-app-shell.readers";
import { RewriteAppShellRequestService } from "./rewrite-app-shell-request.service";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";
import { RewriteAppViewStateService } from "./rewrite-app-view-state.service";
import type {
  VeronaControllerError,
  VeronaLogChange,
  VeronaResponseChange
} from "./verona-player-host.component";

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
  unitNavigationLabel: string;
  executionMode: string;
  executionModeLabel: string;
  responsePersistenceLabel: string;
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
  showUnitNavigationList: boolean;
  showPreviousUnitControl: boolean;
  showNextUnitControl: boolean;
  canGoPreviousUnit: boolean;
  canGoNextUnit: boolean;
  canResumeRun: boolean;
  canComplete: boolean;
  canReview: boolean;
  canClearSession: boolean;
  saveProgressLabel: string;
  unitResponse: string;
  draftStateLabel: string;
  draftStateDetail: string;
  hasUnsavedResponse: boolean;
  navigationNoticeTitle: string;
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
  timerLifecycleEvent: {
    kind: "started" | "expired" | "cancelled";
    message: string;
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
  navigationLabel: string;
  position: string;
  statusLabel: string;
  accessibilityLabel: string;
  isCurrent: boolean;
  isLocked: boolean;
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
  unitCount: number;
  canGoPrevious: boolean;
  canGoNext: boolean;
  canComplete: boolean;
  canNavigateUnits: boolean;
  navigationUnits: ReadonlyArray<{ unitKey: string; isLocked: boolean }>;
  backwardDeniedReasons: readonly string[];
  forwardDeniedReasons: readonly string[];
  logPolicy: "disabled" | "lean" | "rich" | "debug";
  pagingMode: "separate" | "concat-scroll" | "concat-scroll-snap" | "buttons";
  restoreCurrentPageOnReturn: boolean;
  pageNavigationLabelMode: "hidden" | "index" | "label" | "list";
  pageNavigationControlsHidden: boolean;
  globalBackwardButtonMode: "hidden" | "dynamic" | "units" | "pages";
  globalForwardButtonMode: "hidden" | "dynamic" | "units" | "pages";
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

type ParticipantTestLogBatch = {
  unitKey: string | null;
  originalUnitId: string | null;
  entries: ParticipantTestLogEntryInput[];
};

type SettledVeronaResponse = Pick<
  ParticipantSaveOutboxEntry,
  "testRunId" | "unitKey" | "response"
>;

type ParticipantConfirmationDialog = {
  title: string;
  message: string;
  cancelLabel: string;
  confirmLabel: string;
};

const VERONA_FOREGROUND_STATE_GRACE_MS = 200;

@Injectable({ providedIn: "root" })
export class ParticipantViewFacade {
  private readonly requestState = inject(RewriteAppShellRequestService);
  private readonly uiState = inject(RewriteAppUiStateService);
  private readonly viewState = inject(RewriteAppViewStateService);
  private readonly browserCompatibility = inject(BrowserCompatibilityService);
  private readonly applicationSettings = inject(ApplicationSettingsService);
  private readonly participantEvents = inject(ParticipantEventStreamService);
  private readonly participantShell = inject(ParticipantShellStateService);

  readonly workspace = this.uiState.workspace;
  readonly runtime = this.uiState.runtime;

  get participantConnectionState() {
    return this.participantEvents.connectionState();
  }

  get participantConnectionLabel(): string {
    switch (this.participantConnectionState.status) {
      case "connecting":
        return "Connecting";
      case "live":
        return "Live";
      case "reconnecting":
        return "Reconnecting";
      case "offline":
        return "Offline";
      default:
        return "Inactive";
    }
  }

  get showParticipantConnectionState(): boolean {
    return (
      !!this.runtime.participantSessionId.trim() &&
      !this.hasControllerError &&
      this.readCurrentRunState()?.testRun.status !== "completed" &&
      this.participantConnectionState.status !== "idle"
    );
  }

  assignedBooklets: ParticipantRuntimeBooklet[] = [];
  private participantRosterCustomTexts: Record<string, string> = {};
  private participantBookletCustomTexts: Record<string, string> = {};
  private participantCustomTexts: Record<string, string> = {};
  private readonly applicationCustomTextEffect = effect(() => {
    this.applicationSettings.settings().customTexts;
    this.syncParticipantCustomTexts();
  });
  participantCodeRequired = false;
  veronaSaveStatus:
    | "not_saved"
    | "saving"
    | "saved"
    | "queued_offline"
    | "save_failed" = "not_saved";
  testletUnlockCode = "";
  participantReviews: WorkspaceReview[] = [];
  reviewTarget: "unit" | "test" | "task" = "unit";
  reviewPageLabel = "";
  reviewerId = "";
  reviewPriority: 0 | 1 | 2 | 3 = 0;
  reviewCategories: string[] = [];
  reviewComment = "";
  editingReviewId = "";
  editingReviewUnitKey: string | null = null;
  editingReviewPage: number | null = null;
  reviewFeedback = "";
  adaptiveStateFeedback = "";
  adaptiveStateChangePending = "";
  readonly reviewPriorityOptions = [
    { value: 0 as const, label: "No priority" },
    { value: 1 as const, label: "Critical / urgent" },
    { value: 2 as const, label: "Medium term" },
    { value: 3 as const, label: "Optional" }
  ];
  readonly reviewCategoryOptions = [
    { value: "tech", label: "Technical" },
    { value: "content", label: "Content" },
    { value: "design", label: "Design" }
  ];
  readonly timerTick = signal(Date.now());
  readonly fullscreenActive = signal(false);
  readonly fullscreenStatus = signal("");
  private readonly activeControllerError = signal<VeronaControllerError | null>(
    null
  );
  private copiedSessionEntryLink = "";
  private fullscreenPromptDismissedRunId = "";
  private fullscreenStatusRunId = "";
  private timerTickerHandle: number | null = null;
  private timerExpiryRefreshPending = false;
  private activeTimerWarning: {
    testletKey: string;
    startedAt: string;
    minutes: number;
    visibleUntilMs: number;
  } | null = null;
  private readonly activeTimerLifecycleEvent = signal<{
    key: string;
    kind: "started" | "expired" | "cancelled";
    durationSeconds: number;
    visibleUntilMs: number;
  } | null>(null);
  private readonly seenTimerLifecycleEvents = new Set<string>();
  private readonly presentedActiveTimers = new Set<string>();
  private readonly seenTimerWarnings = new Set<string>();
  private readonly timerRemainingSeconds = new Map<string, number>();
  private currentRunState: ParticipantCurrentRunStateResponse["currentRunState"] | null =
    null;
  private readonly loadedBookletAssets = signal<{
    testRunId: string;
    assets:
      | ParticipantCurrentRunStateResponse["currentRunState"]["bookletAssets"]
      | null;
  } | null>(null);
  private readonly bookletAssetLoadPromises = new Map<
    string,
    Promise<ParticipantCurrentRunStateResponse>
  >();
  private readonly bookletAssetLoadStartedAtMs = new Map<string, number>();
  private readonly loadCompleteRunIds = new Set<string>();
  private readonly loadCompleteDeliveryIds = new Map<string, string>();
  private pendingVeronaSave: ParticipantSaveOutboxEntry | null = null;
  private optimisticVeronaResponse: {
    testRunId: string;
    unitKey: string;
    response: string;
  } | null = null;
  private readonly ephemeralUnitResponses = new Map<string, Map<string, string>>();
  private queuedVeronaLogs: Array<{
    testRunId: string;
    unitKey: string | null;
    originalUnitId: string | null;
    entries: ParticipantTestLogEntryInput[];
  }> = [];
  private veronaSaveDrainPromise: Promise<void> | null = null;
  private veronaForegroundSaveSettlement = false;
  private veronaSaveBufferTimeout: number | null = null;
  private veronaSaveBufferDueAtMs: number | null = null;
  private readonly navigationAdvisory = signal<{
    title: string;
    message: string;
  } | null>(null);
  readonly confirmationDialog = signal<ParticipantConfirmationDialog | null>(
    null
  );
  private confirmationResolver: ((confirmed: boolean) => void) | null = null;
  private navigationAdvisoryTimeout: number | null = null;
  private readonly fullscreenChangeListener = (): void => {
    this.fullscreenActive.set(Boolean(globalThis.document?.fullscreenElement));
  };
  private readonly onlineListener = (): void => {
    this.retryVeronaSave();
  };
  private readonly pageHideListener = (): void => {
    this.queuePendingVeronaSaveForBackgroundDelivery();
  };
  private readonly leaveSessionListener = (): void => {
    this.clearSession();
  };
  private readonly refreshFromParticipantEvents = (): Promise<void> =>
    this.refreshCurrentStateInternal(true);
  private readonly logParticipantConnectionMode = (
    mode: "WEBSOCKET" | "POLLING"
  ): void => {
    this.saveVeronaTestLogs([{
      key: "CONNECTION",
      timeStamp: Date.now(),
      content: mode
    }]);
  };

  init(): void {
    this.viewState.setActiveView("participant");
    globalThis.document?.addEventListener(
      "fullscreenchange",
      this.fullscreenChangeListener
    );
    globalThis.window?.addEventListener("online", this.onlineListener);
    globalThis.window?.addEventListener("pagehide", this.pageHideListener);
    globalThis.window?.addEventListener(
      "participant-leave-session",
      this.leaveSessionListener
    );
    this.fullscreenChangeListener();
    this.startTimerTicker();
  }

  get preventBrowserNavigation(): boolean {
    const currentState = this.readCurrentRunState();
    return Boolean(
      currentState?.testRun.status === "running" &&
        currentState.currentUnit.unitKey &&
        currentState.booklet.policy.navigation.browserNavigation === "prevent"
    );
  }

  get isParticipantPlayerFocused(): boolean {
    const currentState = this.readCurrentRunState();
    return Boolean(
      currentState && currentState.testRun.status !== "completed"
    );
  }

  notifyBrowserNavigationPrevented(): void {
    const currentState = this.readCurrentRunState();
    if (!currentState || currentState.booklet.policy.display.silentMode) {
      return;
    }
    this.clearNavigationAdvisory();
    this.navigationAdvisory.set({
      title: "Browser navigation disabled",
      message:
        "Use the test controls to move between tasks or complete the test."
    });
    this.navigationAdvisoryTimeout =
      globalThis.window?.setTimeout(() => {
        this.navigationAdvisoryTimeout = null;
        this.navigationAdvisory.set(null);
      }, 8_000) ?? null;
  }

  destroy(): void {
    this.participantEvents.stop();
    this.participantShell.setHeaderHidden(false);
    globalThis.window?.removeEventListener(
      "participant-leave-session",
      this.leaveSessionListener
    );
    if (this.timerTickerHandle != null) {
      globalThis.window?.clearInterval(this.timerTickerHandle);
      this.timerTickerHandle = null;
    }
    globalThis.document?.removeEventListener(
      "fullscreenchange",
      this.fullscreenChangeListener
    );
    globalThis.window?.removeEventListener("online", this.onlineListener);
    globalThis.window?.removeEventListener("pagehide", this.pageHideListener);
    this.queuePendingVeronaSaveForBackgroundDelivery();
    this.clearVeronaSaveBuffer();
    this.clearNavigationAdvisory();
    this.resolveConfirmation(false);
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
        this.currentRunState = null;
        this.syncParticipantHeaderVisibility();
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
          : this.participantCodeRequired
            ? "Participant code required"
          : "Sign in to start",
        detail: hasParticipantSession
          ? "Resume the session to launch or continue the current run."
          : this.participantCodeRequired
            ? "Enter the second code assigned by the test supervisor, then sign in again."
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
        unitNavigationLabel: "",
        executionMode: "n/a",
        executionModeLabel: "No execution mode loaded",
        responsePersistenceLabel: "No run loaded",
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
        showUnitNavigationList: false,
        showPreviousUnitControl: true,
        showNextUnitControl: true,
        canGoPreviousUnit: false,
        canGoNextUnit: false,
        canResumeRun: false,
        canComplete: false,
        canReview: false,
        canClearSession: hasParticipantSession && !this.pendingVeronaSave,
        saveProgressLabel: "Save Progress",
        unitResponse: "",
        draftStateLabel: "No response loaded",
        draftStateDetail: "Start or resume a test before writing an answer.",
        hasUnsavedResponse: false,
        navigationNoticeTitle: "",
        navigationNotice: "",
        nextTestletGate: null,
        testletTimer: null,
        timerLifecycleEvent: null,
        leaveLock: null
      };
    }

    const availableActions = currentState.availableActions;
    const executionMode = currentState.executionMode;
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
    const currentDraft = this.runtime.currentUnitResponse;
    const backwardDeniedReasons = this.effectiveNavigationDeniedReasons(
      currentState.navigation.backwardDeniedReasons,
      currentDraft
    );
    const forwardDeniedReasons = this.effectiveNavigationDeniedReasons(
      currentState.navigation.forwardDeniedReasons,
      currentDraft
    );
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
        navigationLabel: unit.shortLabel?.trim() || `${index + 1}`,
        position: `${index + 1}`,
        statusLabel,
        accessibilityLabel: [
          `Unit ${index + 1}: ${label}`,
          isCurrent ? "current" : "not current",
          hasResponse ? "answered" : "unanswered",
          unit.isLocked ? "locked" : "available"
        ].join(", "),
        isCurrent,
        isLocked: unit.isLocked,
        hasResponse,
        canOpen:
          canNavigateUnits &&
          (policy.navigation.unitMenuEnabled ||
            Boolean(policy.navigation.unitListEnabled)) &&
          !isCurrent &&
          !unit.isLocked &&
          (index < unitIndex
            ? backwardDeniedReasons.length === 0
            : forwardDeniedReasons.length === 0)
      };
    });
    const answeredUnitCount = unitItems.filter(unit => unit.hasResponse).length;
    const totalUnitCount = bookletUnits.length;
    const missingUnitCount = Math.max(totalUnitCount - answeredUnitCount, 0);
    const progressPercent =
      totalUnitCount > 0 ? Math.round((answeredUnitCount / totalUnitCount) * 100) : 0;
    const isComplete = currentState.testRun.status === "completed";
    const hasControllerError = this.hasControllerError;
    const savedUnitResponse = unitKey
      ? this.effectiveUnitResponse(currentState, unitKey)
      : "";
    const hasUnsavedResponse =
      executionMode.saveResponses &&
      currentState.testRun.status !== "completed" &&
      currentDraft !== savedUnitResponse;
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
              ? this.customTextFormat(
                  "booklet_msgSoonTimeOver",
                  `You have ${activeWarning.minutes} minute${activeWarning.minutes === 1 ? "" : "s"} left for this timed block.`,
                  activeWarning.minutes
                )
              : null
          };
        })()
      : null;
    const activeLeaveLock = currentState.activeLeaveLock;
    const timerLifecycleEvent = this.getTimerLifecycleEvent();
    const leaveLock = activeLeaveLock
      ? {
          ...activeLeaveLock,
          detail:
            activeLeaveLock.scope === "unit"
              ? this.customText(
                  "booklet_lockedByAfterLeave",
                  `After leaving, "${activeLeaveLock.unitDisplayLabel}" cannot be opened again.`
                )
              : this.customText(
                  "booklet_blockLockedByAfterLeave",
                  `After leaving, the block "${activeLeaveLock.displayLabel}" cannot be opened again.`
                )
        }
      : null;
    const navigationDenial = this.describeNavigationDenial(currentState);
    const navigationAdvisory = this.navigationAdvisory();
    const unitNavigationLabelMode =
      policy.navigation.unitLabel ?? "index";
    const unitNavigationLabel =
      unitNavigationLabelMode === "hidden"
        ? ""
        : unitNavigationLabelMode === "label"
          ? unitLabel
          : unitIndex >= 0
            ? `Unit ${unitIndex + 1} / ${bookletUnits.length}`
            : "";

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
      unitNavigationLabel,
      executionMode: executionMode.mode,
      executionModeLabel: executionMode.label,
      responsePersistenceLabel: executionMode.saveResponses
        ? "Responses and player logs are saved"
        : "Responses and player logs are not saved",
      unitOverviewLabel: `${answeredUnitCount}/${totalUnitCount} answered · ${missingUnitCount} open`,
      unitItems,
      responseProgressLabel: executionMode.saveResponses
        ? `${answeredUnitCount} / ${totalUnitCount} responses saved`
        : "Response saving disabled for this mode",
      missingResponseLabel:
        !executionMode.saveResponses
          ? "Responses remain local to the current player view."
          : missingUnitCount === 0
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
      runStatus: hasControllerError ? "error" : currentState.testRun.status,
      runId: currentState.testRun.testRunId,
      nextStepLabel: hasControllerError
        ? "Reload test"
        : this.getNextStepLabel(currentState.testRun.status),
      nextStepDetail: hasControllerError
        ? "Reload the page to restart the test player. Ask the test supervisor for help if the problem continues."
        : this.getNextStepDetail({
            availableActions,
            isComplete,
            missingResponseLabel:
              missingUnitCount === 0
                ? "All units have a saved response."
                : `${missingUnitCount} ${missingUnitCount === 1 ? "unit" : "units"} without a saved response.`
          }),
      actions: hasControllerError ? [] : availableActions,
      canSaveProgress:
        !hasControllerError && availableActions.includes("save_progress"),
      showUnitMenu: !hasControllerError && policy.navigation.unitMenuEnabled,
      showUnitNavigationList:
        !hasControllerError && Boolean(policy.navigation.unitListEnabled),
      showPreviousUnitControl:
        !hasControllerError && policy.navigation.unitControls === "both",
      showNextUnitControl:
        !hasControllerError && policy.navigation.unitControls !== "hidden",
      canGoPreviousUnit:
        !hasControllerError &&
        canNavigateUnits && previousUnitKey != null && backwardDeniedReasons.length === 0,
      canGoNextUnit:
        !hasControllerError &&
        canNavigateUnits && nextUnitKey != null && forwardDeniedReasons.length === 0,
      canResumeRun: !hasControllerError && availableActions.includes("resume"),
      canComplete:
        !hasControllerError &&
        (availableActions.includes("complete") ||
          (!executionMode.saveResponses &&
            canNavigateUnits &&
            nextUnitKey == null &&
            currentState.navigation.nextTestletGate == null &&
            forwardDeniedReasons.length === 0)),
      canReview: !hasControllerError && availableActions.includes("review"),
      canClearSession: !hasControllerError && !this.pendingVeronaSave,
      saveProgressLabel:
        !executionMode.saveResponses
          ? "Continue Without Saving"
          : currentState.testRun.status === "paused"
          ? "Save Running"
          : "Save Paused",
      unitResponse: savedUnitResponse,
      draftStateLabel,
      draftStateDetail,
      hasUnsavedResponse,
      navigationNoticeTitle: policy.display.silentMode
        ? ""
        : navigationDenial
          ? this.customText(
              "booklet_msgNavigationDeniedTitle",
              "This unit cannot be left yet"
            )
          : navigationAdvisory?.title ?? "",
      navigationNotice: policy.display.silentMode
        ? ""
        : navigationDenial || navigationAdvisory?.message || "",
      nextTestletGate: currentState.navigation.nextTestletGate,
      testletTimer,
      timerLifecycleEvent,
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

  get bookletSelectionPrompt(): string {
    if (this.assignedBooklets.length === 0) {
      return "";
    }
    const selectableCount = this.assignedBooklets.filter(
      booklet => booklet.status !== "completed" && booklet.status !== "locked"
    ).length;
    if (selectableCount === 0) {
      return this.customText(
        "login_bookletSelectPromptNull",
        "All assigned tests are completed or unavailable."
      );
    }
    if (selectableCount === 1) {
      return this.customText(
        "login_bookletSelectPromptOne",
        "Select the available test to start or resume it."
      );
    }
    return this.customText(
      "login_bookletSelectPromptMany",
      "Select one of the available tests to start or resume it."
    );
  }

  get showUnitTitle(): boolean {
    return this.readCurrentRunState()?.booklet.policy.display.unitTitle ?? true;
  }

  get screenHeaderLabel(): string {
    const currentState = this.readCurrentRunState();
    if (
      !currentState ||
      currentState.testRun.status === "completed" ||
      this.hasControllerError ||
      (currentState.booklet.policy.display.headerHidden ?? false)
    ) {
      return "";
    }
    switch (currentState.booklet.policy.display.headerContent) {
      case "booklet":
        return currentState.booklet.displayLabel;
      case "block": {
        const testletKey = currentState.currentUnit.testletPath.at(-1);
        return (
          currentState.booklet.testlets.find(
            testlet => testlet.testletKey === testletKey
          )?.displayLabel ?? ""
        );
      }
      case "unit":
        return currentState.currentUnit.displayLabel ?? "";
      default:
        return "";
    }
  }

  get showFullscreenPrompt(): boolean {
    const currentState = this.readCurrentRunState();
    return Boolean(
      currentState &&
        currentState.testRun.status !== "completed" &&
        !this.hasControllerError &&
        currentState.booklet.policy.display.fullscreenPrompt &&
        !this.fullscreenActive() &&
        this.fullscreenPromptDismissedRunId !== currentState.testRun.testRunId
    );
  }

  get showFullscreenButton(): boolean {
    const currentState = this.readCurrentRunState();
    return Boolean(
      currentState?.testRun.status !== "completed" &&
        !this.hasControllerError &&
        currentState?.booklet.policy.display.fullscreenButton
    );
  }

  get showReloadButton(): boolean {
    const currentState = this.readCurrentRunState();
    return Boolean(
      currentState?.testRun.status !== "completed" &&
        !this.hasControllerError &&
        currentState?.booklet.policy.display.reloadButton
    );
  }

  get veronaLoadingLabel(): string {
    return this.customText("booklet_loading", "Please wait");
  }

  get bookletLoadedUnitCount(): number {
    return this.readCurrentRunState()?.testRun.status === "completed" ||
      this.hasControllerError
      ? 0
      : (this.loadedBookletAssets()?.assets?.units.length ?? 0);
  }

  get veronaLoadingTitle(): string {
    return this.readCurrentRunState()?.activeTestletTimer
      ? this.customText("booklet_loadingBlock", "Timed block is loading")
      : this.customText("booklet_loadingUnit", "Unit is loading");
  }

  get veronaLoadingStatus(): string {
    return this.customText(
      "booklet_unitLoadingUnknownProgress",
      "Loading progress is not available"
    );
  }

  get veronaLoadingPendingStatus(): string {
    return this.customText(
      "booklet_unitLoadingPending",
      "Waiting in the loading queue"
    );
  }

  get veronaLoadingCompleteStatus(): string {
    return this.customText("booklet_unitLoading", "Loaded");
  }

  get veronaErrorText(): string {
    return this.customText(
      "booklet_errormessage",
      "The unit could not be loaded. Reload the player or ask the test supervisor for help."
    );
  }

  reloadPage(): void {
    if (!this.showReloadButton) {
      return;
    }
    this.persistState();
    const entryLink = this.createParticipantSessionEntryLink();
    if (entryLink) {
      globalThis.window?.history.replaceState(null, "", entryLink);
    }
    globalThis.window?.location.reload();
  }

  reloadAfterControllerError(): void {
    if (!this.hasControllerError) {
      return;
    }
    this.persistState();
    const entryLink = this.createParticipantSessionEntryLink();
    if (entryLink) {
      globalThis.window?.history.replaceState(null, "", entryLink);
    }
    globalThis.window?.location.reload();
  }

  get fullscreenStatusText(): string {
    const currentState = this.readCurrentRunState();
    if (
      currentState?.testRun.status === "completed" ||
      this.hasControllerError
    ) {
      return "";
    }
    const testRunId = currentState?.testRun.testRunId ?? "";
    return testRunId && testRunId === this.fullscreenStatusRunId
      ? this.fullscreenStatus()
      : "";
  }

  dismissFullscreenPrompt(): void {
    this.fullscreenPromptDismissedRunId =
      this.readCurrentRunState()?.testRun.testRunId ?? "";
    this.setFullscreenStatus("Fullscreen prompt dismissed for this test run.");
  }

  async requestFullscreen(): Promise<void> {
    const currentState = this.readCurrentRunState();
    if (currentState) {
      this.fullscreenPromptDismissedRunId = currentState.testRun.testRunId;
    }
    const root = globalThis.document?.documentElement;
    if (!root?.requestFullscreen) {
      this.setFullscreenStatus(
        "Fullscreen is unavailable in this browser. Continue in the current window."
      );
      return;
    }
    try {
      await root.requestFullscreen();
      this.fullscreenChangeListener();
      this.setFullscreenStatus("Fullscreen is active.");
    } catch {
      this.setFullscreenStatus(
        "Fullscreen could not be started. Use the browser fullscreen control or continue in the current window."
      );
    }
  }

  async toggleFullscreen(): Promise<void> {
    if (!this.fullscreenActive()) {
      await this.requestFullscreen();
      return;
    }
    try {
      await globalThis.document?.exitFullscreen();
      this.fullscreenChangeListener();
      this.setFullscreenStatus("Fullscreen closed.");
    } catch {
      this.setFullscreenStatus(
        "Fullscreen could not be closed. Use the browser fullscreen control."
      );
    }
  }

  private setFullscreenStatus(message: string): void {
    this.fullscreenStatusRunId =
      this.readCurrentRunState()?.testRun.testRunId ?? "";
    this.fullscreenStatus.set(message);
  }

  get eagerBookletLoading(): boolean {
    const currentState = this.readCurrentRunState();
    return Boolean(
      currentState?.booklet.policy.player.loadingMode === "eager" &&
        this.loadedBookletAssets()?.testRunId !== currentState.testRun.testRunId
    );
  }

  get isRunPaused(): boolean {
    return this.readCurrentRunState()?.testRun.status === "paused";
  }

  get isMonitorPaused(): boolean {
    const testRun = this.readCurrentRunState()?.testRun;
    return testRun?.status === "paused" && testRun.pauseSource === "monitor";
  }

  get pausedMessage(): string {
    return this.customText(
      "booklet_pausedmessage",
      "This test is currently paused."
    );
  }

  get hasControllerError(): boolean {
    const currentState = this.readCurrentRunState();
    const controllerError = this.activeControllerError();
    return Boolean(
      currentState &&
        currentState.testRun.status !== "completed" &&
        controllerError?.testRunId === currentState.testRun.testRunId
    );
  }

  get controllerErrorMessage(): string {
    return this.hasControllerError
      ? (this.activeControllerError()?.message ?? "")
      : "";
  }

  get controllerErrorText(): string {
    return this.customText(
      "booklet_errormessage",
      "A technical problem occurred. Reload the page and ask the test supervisor for help if the problem continues."
    );
  }

  handleVeronaControllerError(controllerError: VeronaControllerError): void {
    const currentState = this.readCurrentRunState();
    if (
      currentState?.testRun.status !== "running" ||
      controllerError.testRunId !== currentState.testRun.testRunId ||
      controllerError.unitKey !== currentState.currentUnit.unitKey
    ) {
      return;
    }
    this.activeControllerError.set(controllerError);
  }

  get veronaPlayer(): ParticipantVeronaPlayerState | null {
    const currentState = this.readCurrentRunState();
    const player = currentState?.currentUnit.player;
    const unitDefinition = currentState?.currentUnit.unitDefinition?.trim();
    const unitKey = currentState?.currentUnit.unitKey;
    if (
      !currentState ||
      currentState.testRun.status !== "running" ||
      this.hasControllerError ||
      this.eagerBookletLoading ||
      !player?.html.trim() ||
      !unitDefinition ||
      !unitKey
    ) {
      return null;
    }
    const unitIndex = currentState.bookletUnits.findIndex(
      unit => unit.unitKey === unitKey
    );
    const playerEndAllowed = isBookletPlayerEndAllowed(
      currentState.booklet.policy.navigation.playerEnd,
      unitIndex >= 0 && unitIndex === currentState.bookletUnits.length - 1
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
      savedResponse:
        this.optimisticVeronaResponse?.testRunId ===
          currentState.testRun.testRunId &&
        this.optimisticVeronaResponse.unitKey === unitKey
          ? this.optimisticVeronaResponse.response
          : this.effectiveUnitResponse(currentState, unitKey),
      unitNumber: Math.max(unitIndex + 1, 1),
      unitCount: currentState.bookletUnits.length,
      canGoPrevious: this.player.canGoPreviousUnit,
      canGoNext: this.player.canGoNextUnit,
      canComplete: this.player.canComplete && playerEndAllowed,
      canNavigateUnits:
        currentState.testRun.status === "running" &&
        currentState.availableActions.includes("save_progress"),
      navigationUnits: currentState.bookletUnits.map(unit => ({
        unitKey: unit.unitKey,
        isLocked: unit.isLocked
      })),
      backwardDeniedReasons: currentState.navigation.backwardDeniedReasons,
      forwardDeniedReasons: currentState.navigation.forwardDeniedReasons,
      logPolicy: currentState.booklet.policy.player.logPolicy,
      pagingMode: currentState.booklet.policy.player.pagingMode,
      restoreCurrentPageOnReturn:
        currentState.booklet.policy.player.restoreCurrentPageOnReturn,
      pageNavigationLabelMode:
        currentState.booklet.policy.player.pageNavigation?.labelMode ?? "index",
      pageNavigationControlsHidden:
        currentState.booklet.policy.player.pageNavigation?.controlsHidden ?? false,
      globalBackwardButtonMode:
        currentState.booklet.policy.navigation.backwardButton ?? "hidden",
      globalForwardButtonMode:
        currentState.booklet.policy.navigation.forwardButton ?? "hidden"
    };
  }

  private describeNavigationDenial(
    currentState: ParticipantCurrentRunStateResponse["currentRunState"]
  ): string {
    if (currentState.testRun.status === "paused") {
      return this.customText(
        "booklet_pausedmessage",
        "This test is currently paused."
      );
    }
    return this.describeNavigationReasons(
      currentState.navigation.forwardDeniedReasons
    );
  }

  private describeNavigationReasons(reasons: readonly string[]): string {
    const messages: string[] = [];
    if (reasons.includes("presentation_incomplete")) {
      messages.push(
        this.customText(
          "booklet_msgNavigationDeniedText_presentationIncomplete",
          "View all required unit content before moving forward or completing the test."
        )
      );
    }
    if (reasons.includes("response_incomplete")) {
      messages.push(
        this.customText(
          "booklet_msgNavigationDeniedText_responsesIncomplete",
          "Complete the required response before moving forward or completing the test."
        )
      );
    }
    if (messages.length > 0) {
      return messages.join(" ");
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
      return this.customText(
        "booklet_lockedBlock",
        "This timed block is closed and cannot be opened again."
      );
    }
    if (reasons.includes("testlet_leave_confirmation_required")) {
      return "Confirm leaving before the unit or block is locked.";
    }
    if (reasons.includes("testlet_leave_locked")) {
      return this.customText(
        "booklet_lockedByAfterLeave",
        "This unit or block was locked after it was left."
      );
    }
    return "";
  }

  private presentNavigationAdvisory(
    direction: "forward" | "backward"
  ): void {
    this.clearNavigationAdvisory();
    const currentState = this.readCurrentRunState();
    if (!currentState || currentState.booklet.policy.display.silentMode) {
      return;
    }
    const reasons =
      direction === "backward"
        ? currentState.navigation.backwardAdvisoryReasons ?? []
        : currentState.navigation.forwardAdvisoryReasons ?? [];
    const detail = this.describeNavigationReasons(reasons);
    if (!detail) {
      return;
    }
    this.navigationAdvisory.set({
      title: "Test mode: navigation remains available",
      message: `In an enforced test, this action would be blocked. ${detail}`
    });
    this.navigationAdvisoryTimeout =
      globalThis.window?.setTimeout(() => {
        this.navigationAdvisoryTimeout = null;
        this.navigationAdvisory.set(null);
      }, 8_000) ?? null;
  }

  private clearNavigationAdvisory(): void {
    if (this.navigationAdvisoryTimeout != null) {
      globalThis.window?.clearTimeout(this.navigationAdvisoryTimeout);
      this.navigationAdvisoryTimeout = null;
    }
    this.navigationAdvisory.set(null);
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
      if (activeTimer) {
        const activeTimerPresentationKey = `${
          this.readCurrentRunState()?.testRun.testRunId ?? ""
        }:${activeTimer.testletKey}:${activeTimer.startedAt}`;
        if (!this.presentedActiveTimers.has(activeTimerPresentationKey)) {
          this.presentedActiveTimers.add(activeTimerPresentationKey);
          this.showTimerLifecycleEvent(
            this.readCurrentRunState()?.testRun.testRunId ?? "",
            "started",
            activeTimer,
            true
          );
        }
      }
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
      const activeTimerLifecycleEvent = this.activeTimerLifecycleEvent();
      if (
        activeTimerLifecycleEvent &&
        activeTimerLifecycleEvent.visibleUntilMs <= currentTick
      ) {
        this.activeTimerLifecycleEvent.set(null);
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

  private getTimerLifecycleEvent(): ParticipantPlayerState["timerLifecycleEvent"] {
    const event = this.activeTimerLifecycleEvent();
    if (!event || event.visibleUntilMs <= this.timerTick()) {
      return null;
    }
    if (event.kind === "started") {
      const minutes = Math.floor(event.durationSeconds / 60);
      const seconds = event.durationSeconds % 60;
      return {
        kind: event.kind,
        message: `${
          this.customText(
            "booklet_msgTimerStarted",
            "The time for this block has started: "
          ).trimEnd()
        } ${minutes}:${String(seconds).padStart(2, "0")}`
      };
    }
    return {
      kind: event.kind,
      message:
        event.kind === "expired"
          ? this.customText(
              "booklet_msgTimeOver",
              "The time for this block has ended."
            )
          : this.customText(
              "booklet_msgTimerCancelled",
              "The timed block was cancelled."
            )
    };
  }

  private captureTimerLifecycleTransitions(
    nextTestRun: Pick<
      ParticipantCurrentRunStateResponse["currentRunState"]["testRun"],
      "testRunId"
    > &
      Partial<ParticipantCurrentRunStateResponse["currentRunState"]["testRun"]>
  ): void {
    const previousTestRun = this.currentRunState?.testRun;
    if (
      !previousTestRun ||
      previousTestRun.testRunId !== nextTestRun.testRunId ||
      !nextTestRun.testletTimers
    ) {
      return;
    }
    for (const [testletKey, nextTimer] of Object.entries(
      nextTestRun.testletTimers
    )) {
      const previousTimer = previousTestRun.testletTimers?.[testletKey];
      if (
        !previousTimer &&
        (nextTimer.status === "running" || nextTimer.status === "paused")
      ) {
        this.showTimerLifecycleEvent(
          nextTestRun.testRunId,
          "started",
          nextTimer
        );
        continue;
      }
      if (
        previousTimer &&
        (previousTimer.status === "running" ||
          previousTimer.status === "paused") &&
        (nextTimer.status === "expired" || nextTimer.status === "cancelled")
      ) {
        this.showTimerLifecycleEvent(
          nextTestRun.testRunId,
          nextTimer.status,
          nextTimer
        );
      }
    }
  }

  private showTimerLifecycleEvent(
    testRunId: string,
    kind: "started" | "expired" | "cancelled",
    timer: {
      testletKey: string;
      startedAt: string;
      durationSeconds: number;
    },
    forceVisible = false
  ): void {
    const key = `${testRunId}:${timer.testletKey}:${timer.startedAt}:${kind}`;
    if (this.seenTimerLifecycleEvents.has(key) && !forceVisible) {
      return;
    }
    this.seenTimerLifecycleEvents.add(key);
    this.activeTimerLifecycleEvent.set({
      key,
      kind,
      durationSeconds: Math.max(0, Math.ceil(timer.durationSeconds)),
      visibleUntilMs: Date.now() + 5_000
    });
  }

  private resetTimerLifecyclePresentation(): void {
    this.activeTimerLifecycleEvent.set(null);
    this.seenTimerLifecycleEvents.clear();
    this.presentedActiveTimers.clear();
  }

  private setParticipantRosterCustomTexts(
    customTexts: Readonly<Record<string, string>>
  ): void {
    this.participantRosterCustomTexts = { ...customTexts };
    this.syncParticipantCustomTexts();
  }

  private setParticipantBookletCustomTexts(
    customTexts: Readonly<Record<string, string>>
  ): void {
    this.participantBookletCustomTexts = { ...customTexts };
    this.syncParticipantCustomTexts();
  }

  private syncParticipantCustomTexts(): void {
    this.participantCustomTexts = mergeParticipantCustomTextScopes(
      this.applicationSettings.settings().customTexts,
      this.participantRosterCustomTexts,
      this.participantBookletCustomTexts
    );
    this.browserCompatibility.setCustomTexts(this.participantCustomTexts);
  }

  get canSignIn(): boolean {
    return Boolean(
      !this.hasControllerError &&
      this.workspace.workspaceKey.trim() &&
      this.runtime.loginKey.trim() &&
      (!this.participantCodeRequired || this.runtime.participantCode.trim())
    );
  }

  get canStartOrResume(): boolean {
    if (this.hasControllerError) {
      return false;
    }
    if (!this.runtime.participantSessionId.trim()) {
      return this.canSignIn;
    }
    const runtimeState = parseJsonDocument<ParticipantRuntimeStateResponse>(
      this.runtime.runtimeStateView
    )?.runtimeState;
    return runtimeState?.availableAction !== "none";
  }

  get canRefreshCurrentState(): boolean {
    return Boolean(
      !this.hasControllerError && this.runtime.participantSessionId.trim()
    );
  }

  get adaptiveStates(): ParticipantCurrentRunStateResponse["currentRunState"]["adaptiveStates"] {
    return this.readCurrentRunState()?.adaptiveStates ?? [];
  }

  get canChangeAdaptiveStates(): boolean {
    return Boolean(
      this.readCurrentRunState()?.availableActions.includes(
        "change_state_options"
      ) && this.adaptiveStates.length > 0
    );
  }

  selectAdaptiveState(stateKey: string, optionKey: string): void {
    if (!this.canChangeAdaptiveStates || this.adaptiveStateChangePending) {
      return;
    }
    this.viewState.onActionAsync(() =>
      this.selectAdaptiveStateInternal(stateKey, optionKey)
    );
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

  resetParticipantCodeChallenge(): void {
    this.participantCodeRequired = false;
    this.runtime.participantCode = "";
  }

  refreshCurrentState(): void {
    if (!this.canRefreshCurrentState) {
      return;
    }

    this.viewState.onActionAsync(() => this.refreshCurrentStateInternal(false));
  }

  get canSubmitReview(): boolean {
    return Boolean(
      this.player.canReview &&
      this.runtime.testRunId.trim() &&
      this.reviewComment.trim()
    );
  }

  get reviewActionLabel(): string {
    return this.editingReviewId ? "Save Comment Changes" : "Add Comment";
  }

  get reviewUnitTargetLabel(): string {
    return this.editingReviewId && this.editingReviewUnitKey
      ? `Unit · ${this.editingReviewUnitKey}`
      : "Current Unit";
  }

  beginReviewEdit(review: WorkspaceReview): void {
    this.editingReviewId = review.reviewId;
    this.editingReviewUnitKey = review.unitKey;
    this.editingReviewPage = review.page;
    this.reviewTarget = review.unitKey
      ? review.page != null || review.pageLabel
        ? "task"
        : "unit"
      : "test";
    this.reviewPageLabel = review.pageLabel ?? "";
    this.reviewerId = review.reviewerId;
    this.reviewPriority = review.priority ?? 0;
    this.reviewCategories = [...(review.categories ?? [])];
    this.reviewComment = review.comment;
    this.reviewFeedback = `Editing comment from ${review.reviewerId}.`;
  }

  cancelReviewEdit(): void {
    this.resetReviewEditor();
    this.reviewFeedback = "Comment changes discarded.";
  }

  saveReview(): void {
    if (!this.canSubmitReview) {
      return;
    }
    this.viewState.onActionAsync(() => this.saveReviewInternal());
  }

  async deleteReview(review: WorkspaceReview): Promise<void> {
    if (!this.player.canReview) {
      return;
    }
    const accepted = await this.requestConfirmation({
      title: "Delete comment?",
      message: "Delete this participant comment permanently?",
      cancelLabel: "Keep comment",
      confirmLabel: "Delete comment"
    });
    if (!accepted || !this.player.canReview) {
      return;
    }
    this.viewState.onActionAsync(() =>
      this.deleteReviewInternal(review.reviewId)
    );
  }

  reviewTargetLabel(review: WorkspaceReview): string {
    if (!review.unitKey) {
      return "Whole test";
    }
    if (review.page != null || review.pageLabel) {
      const pageReference = [
        review.page == null ? "" : `Page ${review.page}`,
        review.pageLabel ?? ""
      ].filter(Boolean).join(" · ");
      return `Task · ${review.unitKey}${pageReference ? ` · ${pageReference}` : ""}`;
    }
    return `Unit · ${review.unitKey}`;
  }

  get currentReviewPage(): number | null {
    const currentPage = parseVeronaUnitResponse(
      this.runtime.currentUnitResponse
    )?.playerState?.currentPage;
    if (
      typeof currentPage === "number" &&
      Number.isInteger(currentPage) &&
      currentPage >= 0
    ) {
      return currentPage;
    }
    if (
      typeof currentPage === "string" &&
      currentPage.trim() &&
      Number.isInteger(Number(currentPage)) &&
      Number(currentPage) >= 0
    ) {
      return Number(currentPage);
    }
    return null;
  }

  get currentReviewPageReference(): string {
    const currentPage = parseVeronaUnitResponse(
      this.runtime.currentUnitResponse
    )?.playerState?.currentPage;
    return currentPage === undefined ? "Player page unavailable" : `Player page ${currentPage}`;
  }

  reviewPriorityLabel(priority: number): string {
    return (
      this.reviewPriorityOptions.find(option => option.value === priority)
        ?.label ?? "No priority"
    );
  }

  reviewCategoriesLabel(review: WorkspaceReview): string {
    const categories = review.categories?.length
      ? review.categories
      : review.category
          .split(/[\s,]+/)
          .map(category => category.trim())
          .filter(Boolean);
    return categories.length > 0 ? categories.join(", ") : "No category";
  }

  reviewBrowserLabel(review: WorkspaceReview): string {
    if (!review.userAgent) {
      return "unavailable";
    }
    return review.userAgent.length > 80
      ? `${review.userAgent.slice(0, 77)}...`
      : review.userAgent;
  }

  hasReviewCategory(category: string): boolean {
    return this.reviewCategories.includes(category);
  }

  toggleReviewCategory(category: string, selected: boolean): void {
    this.reviewCategories = selected
      ? Array.from(new Set([...this.reviewCategories, category]))
      : this.reviewCategories.filter(candidate => candidate !== category);
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

  saveVeronaResponse(change: VeronaResponseChange): void {
    const currentState = this.readCurrentRunState();
    const unitKey = change.unitKey.trim();
    if (
      !currentState ||
      change.testRunId !== currentState.testRun.testRunId ||
      !unitKey ||
      !currentState.bookletUnits.some(unit => unit.unitKey === unitKey) ||
      !currentState.availableActions.includes("save_progress")
    ) {
      return;
    }

    if (currentState.currentUnit.unitKey === unitKey) {
      this.runtime.currentUnitResponse = change.response;
      if (currentState.executionMode.saveResponses) {
        this.persistState();
      }
    }
    if (!currentState.executionMode.saveResponses) {
      this.rememberEphemeralUnitResponse(
        currentState.testRun.testRunId,
        unitKey,
        change.response
      );
      this.optimisticVeronaResponse = {
        testRunId: currentState.testRun.testRunId,
        unitKey,
        response: change.response
      };
      this.veronaSaveStatus = "not_saved";
      return;
    }
    const queuedEntries = this.queuedVeronaLogs
      .filter(
        batch =>
          batch.testRunId === currentState.testRun.testRunId &&
          (batch.unitKey === unitKey || batch.unitKey === null)
      )
      .map(({ testRunId: _testRunId, ...batch }) => batch);
    this.queuedVeronaLogs = this.queuedVeronaLogs.filter(
      batch =>
        batch.testRunId !== currentState.testRun.testRunId ||
        (batch.unitKey !== unitKey && batch.unitKey !== null)
    );
    const pendingLogs =
      this.pendingVeronaSave?.testRunId === currentState.testRun.testRunId &&
      this.pendingVeronaSave.unitKey === unitKey
        ? this.pendingVeronaSave.logs
        : [];
    const logs = this.compactParticipantTestLogBatches([
      ...pendingLogs,
      ...queuedEntries
    ]);
    const save = createParticipantSaveOutboxEntry({
      testRunId: currentState.testRun.testRunId,
      unitKey,
      response: change.response,
      status: currentState.testRun.status === "paused" ? "paused" : "running",
      logs
    });
    this.optimisticVeronaResponse = {
      testRunId: save.testRunId,
      unitKey: save.unitKey,
      response: save.response
    };
    this.pendingVeronaSave = save;
    persistParticipantSaveOutboxEntry(save);
    this.scheduleVeronaSaveDrain(this.veronaBufferDelayMs(change));
  }

  queueVeronaLogs(change: VeronaLogChange): void {
    const currentState = this.readCurrentRunState();
    const unitKey = change.unitKey.trim();
    if (
      !currentState ||
      change.testRunId !== currentState.testRun.testRunId ||
      !unitKey ||
      !currentState.bookletUnits.some(unit => unit.unitKey === unitKey) ||
      change.entries.length === 0 ||
      !currentState.executionMode.saveResponses
    ) {
      return;
    }
    this.queuedVeronaLogs.push({
      testRunId: change.testRunId,
      unitKey,
      originalUnitId: unitKey,
      entries: change.entries
    });
  }

  saveVeronaTestLogs(entries: ParticipantTestLogEntryInput[]): void {
    const currentState = this.readCurrentRunState();
    if (
      !currentState ||
      entries.length === 0 ||
      !currentState.availableActions.includes("save_progress") ||
      !currentState.executionMode.saveResponses
    ) {
      return;
    }
    this.queuedVeronaLogs.push({
      testRunId: currentState.testRun.testRunId,
      unitKey: null,
      originalUnitId: null,
      entries
    });
    this.saveVeronaResponse({
      testRunId: currentState.testRun.testRunId,
      unitKey: currentState.currentUnit.unitKey ?? "",
      response: this.runtime.currentUnitResponse,
      unitDataChanged: false,
      unitStateChanged: false,
      playerStateChanged: false
    });
  }

  retryVeronaSave(): void {
    if (!this.pendingVeronaSave) {
      this.restorePersistentVeronaSave(this.readCurrentRunState());
    }
    if (this.pendingVeronaSave) {
      this.scheduleVeronaSaveDrain(0);
    }
  }

  navigateFromVerona(target: string): void {
    if (target.startsWith("#")) {
      const unitKey = target.slice(1).trim();
      const targetUnit = this.player.unitItems.find(
        unit => unit.unitKey === unitKey
      );
      if (!targetUnit || targetUnit.isLocked || targetUnit.isCurrent) {
        return;
      }
      const currentIndex = this.player.unitItems.findIndex(unit => unit.isCurrent);
      const targetIndex = this.player.unitItems.findIndex(
        unit => unit.unitKey === unitKey
      );
      this.presentNavigationAdvisory(
        targetIndex >= 0 && targetIndex < currentIndex ? "backward" : "forward"
      );
      this.viewState.onActionAsync(() =>
        this.goToPlayerUnitInternal(`#${unitKey}`)
      );
      return;
    }
    switch (target) {
      case "previous":
        this.goToPreviousUnit();
        break;
      case "next":
        this.goToNextUnit();
        break;
      case "first": {
        if (this.player.canGoPreviousUnit) {
          this.presentNavigationAdvisory("backward");
          this.viewState.onActionAsync(() =>
            this.goToPlayerUnitInternal("first")
          );
        }
        break;
      }
      case "last": {
        if (this.player.canGoNextUnit) {
          this.presentNavigationAdvisory("forward");
          this.viewState.onActionAsync(() =>
            this.goToPlayerUnitInternal("last")
          );
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

    this.presentNavigationAdvisory("backward");
    this.viewState.onActionAsync(() => this.goToPlayerUnitInternal("previous"));
  }

  goToNextUnit(): void {
    if (!this.player.canGoNextUnit) {
      return;
    }

    this.presentNavigationAdvisory("forward");
    this.viewState.onActionAsync(() => this.goToPlayerUnitInternal("next"));
  }

  goToUnit(unitKey: string): void {
    if (!this.player.unitItems.some(unit => unit.unitKey === unitKey && unit.canOpen)) {
      return;
    }

    const currentState = this.readCurrentRunState();
    const currentIndex =
      currentState?.bookletUnits.findIndex(
        unit => unit.unitKey === currentState.currentUnit.unitKey
      ) ?? -1;
    const targetIndex =
      currentState?.bookletUnits.findIndex(unit => unit.unitKey === unitKey) ?? -1;
    this.presentNavigationAdvisory(
      targetIndex >= 0 && targetIndex < currentIndex ? "backward" : "forward"
    );
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
    this.presentNavigationAdvisory("forward");
    this.viewState.onActionAsync(() => this.completeRunWithConfirmation());
  }

  resolveConfirmation(confirmed: boolean): void {
    const resolve = this.confirmationResolver;
    this.confirmationResolver = null;
    this.confirmationDialog.set(null);
    resolve?.(confirmed);
  }

  clearSession(): void {
    this.clearStoredParticipantSession(
      'Session cleared locally. Use "Sign In" or "Start Or Resume" for the next participant.'
    );
  }

  customText(key: ParticipantCustomTextKey, fallback: string): string {
    return resolveParticipantCustomText(
      this.participantCustomTexts,
      key,
      fallback
    );
  }

  customTextFormat(
    key: ParticipantCustomTextKey,
    fallback: string,
    ...replacements: readonly (string | number)[]
  ): string {
    return resolveAndFormatParticipantCustomText(
      this.participantCustomTexts,
      key,
      replacements,
      fallback
    );
  }

  private leaveLockConfirmationText(
    leaveLock: ParticipantPlayerState["leaveLock"]
  ): string {
    if (!leaveLock) {
      return "Continue?";
    }
    return leaveLock.scope === "unit"
      ? this.customText(
          "booklet_warningLeaveTextPrompt-unit",
          `${leaveLock.detail} Continue?`
        )
      : this.customText(
          "booklet_warningLeaveTextPrompt-testlet",
          `${leaveLock.detail} Continue?`
        );
  }

  private leaveLockConfirmationTitle(
    leaveLock: ParticipantPlayerState["leaveLock"]
  ): string {
    return leaveLock?.scope === "unit"
      ? this.customText("booklet_warningLeaveTitle-unit", "Leave task?")
      : this.customText("booklet_warningLeaveTitle-testlet", "Leave section?");
  }

  private requestConfirmation(
    dialog: ParticipantConfirmationDialog
  ): Promise<boolean> {
    this.resolveConfirmation(false);
    this.confirmationDialog.set(dialog);
    return new Promise(resolve => {
      this.confirmationResolver = resolve;
    });
  }

  private async completeRunWithConfirmation(): Promise<void> {
    const player = this.player;
    const confirmTestletTimeLeave = player.testletTimer?.leave === "confirm";
    if (
      confirmTestletTimeLeave &&
      !(await this.requestConfirmation({
        title: this.customText(
          "booklet_warningLeaveTimerBlockTitle",
          "Leave timed block?"
        ),
        message: this.customText(
          "booklet_warningLeaveTimerBlockTextPrompt",
          `Leave the timed block "${player.testletTimer?.displayLabel}" and close it permanently?`
        ),
        cancelLabel: "Stay here",
        confirmLabel: "Leave anyway"
      }))
    ) {
      return;
    }
    const confirmTestletLeaveLock = player.leaveLock?.confirm === true;
    if (
      confirmTestletLeaveLock &&
      !(await this.requestConfirmation({
        title: this.leaveLockConfirmationTitle(player.leaveLock),
        message: this.leaveLockConfirmationText(player.leaveLock),
        cancelLabel: "Stay here",
        confirmLabel: "Leave anyway"
      }))
    ) {
      return;
    }
    if (
      !player.isComplete &&
      player.completionReadinessState !== "ready" &&
      !(await this.requestConfirmation({
        title: "Complete test?",
        message: `Complete this test with ${player.completionReadinessLabel.toLowerCase()}?`,
        cancelLabel: "Continue working",
        confirmLabel: "Complete test"
      }))
    ) {
      return;
    }
    await this.completeRunInternal(
      confirmTestletTimeLeave,
      confirmTestletLeaveLock
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
    // A session-only re-entry URL is authoritative. Load an existing run
    // without changing its status so a reload cannot bypass a monitor pause.
    // Do not let a booklet from a previously persisted browser session
    // constrain which assigned booklet the server starts when no run exists.
    this.runtime.bookletKey = normalized.bookletKey;
    try {
      await this.refreshCurrentStateInternal(true);
      if (!this.currentRunState) {
        await this.resumeSessionInternal({ quiet: true });
      }
      await this.applyEntryDraftAfterResume(normalized);
    } catch (error) {
      if (!this.isParticipantSessionNoLongerResumable(error)) {
        throw error;
      }

      await this.refreshCurrentStateInternal(true);
    }
  }

  private async signInInternal(): Promise<void> {
    this.participantEvents.stop();
    let payload: ParticipantSignInResponse;
    try {
      payload = await this.requestState.request<ParticipantSignInResponse>(
        "Participant Sign In",
        "POST",
        productionApiRoutes.participant.signIn,
        {
          tenantKey: this.workspace.tenantKey.trim() || undefined,
          workspaceKey: this.workspace.workspaceKey.trim(),
          loginKey: this.runtime.loginKey.trim(),
          groupKey: this.runtime.groupKey.trim() || undefined,
          password: this.runtime.participantPassword || undefined,
          participantCode: this.runtime.participantCode.trim() || undefined
        } satisfies ParticipantSignInRequest
      );
    } catch (error) {
      if (this.handleParticipantCodeChallenge(error)) {
        return;
      }
      throw error;
    }

    this.syncParticipantSessionFields(payload.participantSession);
    this.syncParticipantRosterEntry(payload.participantRosterEntry);
    this.syncRuntimeBooklets(payload.booklets);
    this.runtime.testRunId = "";
    this.syncActiveBookletCustomTexts();
    this.runtime.currentUnitKey = "";
    this.runtime.currentUnitResponse = "";
    this.currentRunState = null;
    this.syncParticipantHeaderVisibility();
    this.activeControllerError.set(null);
    this.resetTimerLifecyclePresentation();
    this.adaptiveStateFeedback = "";
    this.adaptiveStateChangePending = "";
    this.participantCodeRequired = false;
    this.runtime.participantCode = "";
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
    this.participantEvents.stop();
    const previousTestRunId = this.runtime.testRunId.trim();
    if (previousTestRunId) {
      discardParticipantSaveOutboxForRun(previousTestRunId);
    }
    this.copiedSessionEntryLink = "";
    this.assignedBooklets = [];
    this.participantReviews = [];
    this.resetReviewEditor();
    this.reviewFeedback = "";
    this.adaptiveStateFeedback = "";
    this.adaptiveStateChangePending = "";
    this.pendingVeronaSave = null;
    this.optimisticVeronaResponse = null;
    this.ephemeralUnitResponses.clear();
    this.currentRunState = null;
    this.syncParticipantHeaderVisibility();
    this.activeControllerError.set(null);
    this.resetTimerLifecyclePresentation();
    this.queuedVeronaLogs = [];
    this.veronaSaveStatus = "not_saved";
    this.participantCodeRequired = false;
    this.setParticipantRosterCustomTexts({});
    this.setParticipantBookletCustomTexts({});
    this.runtime.participantCode = "";
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

  private handleParticipantCodeChallenge(error: unknown): boolean {
    if (!this.requestState.isApiError(error)) {
      return false;
    }
    const details = error.details;
    if (details && typeof details === "object" && "customTexts" in details) {
      const customTexts = (details as { customTexts?: unknown }).customTexts;
      if (customTexts && typeof customTexts === "object" && !Array.isArray(customTexts)) {
        this.setParticipantRosterCustomTexts(Object.fromEntries(
          Object.entries(customTexts).filter(
            (entry): entry is [string, string] => typeof entry[1] === "string"
          )
        ));
      }
    }
    if (error.error === "participant_code_invalid") {
      this.participantCodeRequired = true;
      return false;
    }
    if (error.error !== "participant_code_required") {
      return false;
    }
    this.participantCodeRequired = true;
    this.runtime.currentRunStateView = prettyPrintJson(
      {
        status: "participant_code_required",
        message: "Enter the second code assigned by the test supervisor."
      },
      this.runtime.currentRunStateView
    );
    return true;
  }

  private async starterLaunchInternal(): Promise<void> {
    let payload: ParticipantLaunchResponse;
    try {
      payload = await this.requestState.request<ParticipantLaunchResponse>(
        "Participant Starter Launch",
        "POST",
        productionApiRoutes.participant.launch,
        {
          tenantKey: this.workspace.tenantKey.trim() || undefined,
          workspaceKey: this.workspace.workspaceKey.trim(),
          loginKey: this.runtime.loginKey.trim(),
          groupKey: this.runtime.groupKey.trim() || undefined,
          bookletKey: this.runtime.bookletKey.trim() || undefined,
          password: this.runtime.participantPassword || undefined,
          participantCode: this.runtime.participantCode.trim() || undefined
        } satisfies ParticipantLaunchRequest
      );
    } catch (error) {
      if (this.handleParticipantCodeChallenge(error)) {
        return;
      }
      throw error;
    }

    this.syncParticipantSessionFields(payload.participantSession);
    this.syncParticipantRosterEntry(payload.participantRosterEntry);
    this.syncRun(payload.testRun);
    this.syncRuntimeBooklets(payload.booklets);
    this.participantCodeRequired = false;
    this.runtime.participantCode = "";
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

    this.ephemeralUnitResponses.delete(payload.testRun.testRunId);
    if (
      ["run-demo", "run-review", "run-simulation"].includes(
        payload.testRun.executionMode ?? ""
      )
    ) {
      this.optimisticVeronaResponse = null;
      this.runtime.currentUnitResponse = "";
    }
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
    confirmTestletLeaveLock = false,
    refreshCurrentState = true,
    responseUnitKey?: string | null
  ): Promise<void> {
    const testRunId = this.runtime.testRunId.trim();
    const currentState = this.readCurrentRunState();
    const transientUnitResponses =
      currentState?.testRun.testRunId === testRunId &&
      !currentState.executionMode.saveResponses
        ? this.ephemeralUnitResponseRecord(testRunId)
        : undefined;
    const matchingLogBatches = currentUnitKey
      ? this.queuedVeronaLogs.filter(
          batch =>
            batch.testRunId === testRunId &&
            (batch.unitKey === currentUnitKey || batch.unitKey === null)
        )
      : [];
    const matchingLogBatchSet = new Set(matchingLogBatches);
    const compactedLogBatches = this.compactParticipantTestLogBatches(
      matchingLogBatches.map(({ testRunId: _testRunId, ...batch }) => batch)
    );
    const payload = await this.requestState.request<SaveTestRunProgressResponse>(
      status === "paused" ? "Participant Save Paused" : "Participant Save Running",
      "POST",
      resolveRoutePath(productionApiRoutes.participant.saveProgress, {
        testRunId
      }),
      {
        currentUnitKey,
        responseUnitKey,
        transientUnitResponses,
        status,
        unitResponse,
        confirmTestletTimeLeave,
        confirmTestletLeaveLock,
        logs: compactedLogBatches.length > 0
          ? compactedLogBatches
          : undefined
      } satisfies SaveTestRunProgressRequest
    );

    this.removeMatchingDeliveredOutbox(
      testRunId,
      currentUnitKey,
      unitResponse
    );

    if (matchingLogBatches.length > 0) {
      this.queuedVeronaLogs = this.queuedVeronaLogs.filter(
        batch => !matchingLogBatchSet.has(batch)
      );
    }

    this.syncRun(payload.testRun);
    this.runtime.runtimeMonitorView = prettyPrintJson(
      payload,
      this.runtime.runtimeMonitorView
    );
    this.persistState();
    if (refreshCurrentState) {
      await this.refreshCurrentStateInternal(true);
    }
  }

  private veronaBufferDelayMs(change: VeronaResponseChange): number {
    const persistence = this.readCurrentRunState()?.booklet.policy.persistence;
    const candidateDelays: number[] = [];
    if (change.unitDataChanged) {
      candidateDelays.push(persistence?.unitResponsesBufferMs ?? 5_000);
    }
    if (change.unitStateChanged || change.playerStateChanged) {
      candidateDelays.push(persistence?.unitStateBufferMs ?? 6_000);
    }
    if (candidateDelays.length === 0) {
      candidateDelays.push(persistence?.testStateBufferMs ?? 1_000);
    }
    return Math.min(...candidateDelays);
  }

  private scheduleVeronaSaveDrain(delayMs?: number): void {
    if (this.veronaForegroundSaveSettlement || !this.pendingVeronaSave) {
      return;
    }
    if (delayMs != null) {
      const dueAtMs = Date.now() + Math.max(0, delayMs);
      if (
        this.veronaSaveBufferDueAtMs == null ||
        dueAtMs < this.veronaSaveBufferDueAtMs
      ) {
        this.veronaSaveBufferDueAtMs = dueAtMs;
      }
    }
    this.veronaSaveStatus = "saving";
    if (this.veronaSaveDrainPromise) {
      return;
    }

    const remainingDelayMs = Math.max(
      0,
      (this.veronaSaveBufferDueAtMs ?? Date.now()) - Date.now()
    );
    if (remainingDelayMs > 0) {
      if (this.veronaSaveBufferTimeout != null) {
        globalThis.window?.clearTimeout(this.veronaSaveBufferTimeout);
      }
      this.veronaSaveBufferTimeout = globalThis.window?.setTimeout(() => {
        this.veronaSaveBufferTimeout = null;
        this.scheduleVeronaSaveDrain();
      }, remainingDelayMs) ?? null;
      return;
    }

    this.clearVeronaSaveBuffer();
    const drainPromise = this.drainVeronaSaveQueue().finally(() => {
      if (this.veronaSaveDrainPromise === drainPromise) {
        this.veronaSaveDrainPromise = null;
      }
      if (
        this.pendingVeronaSave &&
        !this.veronaForegroundSaveSettlement &&
        this.veronaSaveStatus !== "save_failed" &&
        this.veronaSaveStatus !== "queued_offline"
      ) {
        this.scheduleVeronaSaveDrain();
      }
    });
    this.veronaSaveDrainPromise = drainPromise;
    this.viewState.onActionAsync(() => drainPromise);
  }

  private clearVeronaSaveBuffer(): void {
    if (this.veronaSaveBufferTimeout != null) {
      globalThis.window?.clearTimeout(this.veronaSaveBufferTimeout);
      this.veronaSaveBufferTimeout = null;
    }
    this.veronaSaveBufferDueAtMs = null;
  }

  private async drainVeronaSaveQueue(): Promise<void> {
    while (this.pendingVeronaSave && !this.veronaForegroundSaveSettlement) {
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
            deliveryId: save.deliveryId,
            responseUnitKey: save.unitKey,
            status: save.status,
            unitResponse: save.response,
            logs: save.logs
          } satisfies SaveTestRunProgressRequest,
          { quiet: true }
        );
        const removedFromOutbox = removeParticipantSaveOutboxEntry(
          save.testRunId,
          save.deliveryId
        );
        if (removedFromOutbox && !this.pendingVeronaSave) {
          this.pendingVeronaSave = this.nextPersistentVeronaSave(
            save.testRunId
          );
        }
        this.syncRun(payload.testRun);
        this.runtime.runtimeMonitorView = prettyPrintJson(
          payload,
          this.runtime.runtimeMonitorView
        );
      } catch {
        const retrySave = this.pendingVeronaSave ?? save;
        this.pendingVeronaSave = retrySave;
        this.veronaSaveStatus =
          queueParticipantSaveOutboxEntryForBackgroundDelivery(retrySave)
          ? "queued_offline"
          : "save_failed";
        this.persistState();
        return;
      }
    }

    if (this.pendingVeronaSave) {
      return;
    }

    this.veronaSaveStatus = "saved";
    this.persistState();
    await this.refreshCurrentStateInternal(true);
  }

  private async goToPlayerUnitInternal(
    target: "previous" | "next" | "first" | "last" | string
  ): Promise<void> {
    const settledVeronaResponse =
      await this.settleVeronaAutoSaveBeforeForegroundAction();
    this.veronaForegroundSaveSettlement = true;
    try {
      const player = this.player;
      const directUnitKey = target.startsWith("#")
        ? target.slice(1).trim()
        : null;
      const targetUnitKey =
        directUnitKey ||
        (target === "previous"
          ? player.previousUnitKey
          : target === "next"
            ? player.nextUnitKey
            : target === "first"
              ? player.unitItems.find(unit => !unit.isCurrent && !unit.isLocked)
                  ?.unitKey ?? null
              : target === "last"
                ? [...player.unitItems]
                    .reverse()
                    .find(unit => !unit.isCurrent && !unit.isLocked)?.unitKey ??
                  null
                : target.trim());
      if (!targetUnitKey) {
        return;
      }

      const targetUnit = player.unitItems.find(
        unit => unit.unitKey === targetUnitKey
      );
      const usesUnitMenu = !["previous", "next", "first", "last"].includes(
        target
      ) && directUnitKey == null;
      if (
        targetUnitKey === player.unitKey ||
        !targetUnit ||
        (usesUnitMenu && !targetUnit.canOpen)
      ) {
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
        !(await this.requestConfirmation({
          title: this.customText(
            "booklet_warningLeaveTimerBlockTitle",
            "Leave timed block?"
          ),
          message: this.customText(
            "booklet_warningLeaveTimerBlockTextPrompt",
            `Leave the timed block "${activeTimer.displayLabel}" and close it permanently?`
          ),
          cancelLabel: "Stay here",
          confirmLabel: "Leave anyway"
        }))
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
        !(await this.requestConfirmation({
          title: this.leaveLockConfirmationTitle(activeLeaveLock),
          message: this.leaveLockConfirmationText(activeLeaveLock),
          cancelLabel: "Stay here",
          confirmLabel: "Leave anyway"
        }))
      ) {
        return;
      }
      const currentUnitKey = this.runtime.currentUnitKey.trim();
      const currentResponseAlreadySettled =
        settledVeronaResponse?.testRunId === this.runtime.testRunId.trim() &&
        settledVeronaResponse.unitKey === currentUnitKey;
      if (currentUnitKey && !currentResponseAlreadySettled) {
        await this.saveProgressInternal(
          "running",
          currentUnitKey,
          this.runtime.currentUnitResponse,
          false,
          false,
          false
        );
      }
      await this.saveProgressInternal(
        "running",
        targetUnitKey,
        currentState?.executionMode.saveResponses
          ? undefined
          : settledVeronaResponse?.response ?? this.runtime.currentUnitResponse,
        confirmTestletTimeLeave,
        confirmTestletLeaveLock,
        true,
        currentState?.executionMode.saveResponses ? undefined : currentUnitKey
      );
    } finally {
      this.veronaForegroundSaveSettlement = false;
      if (
        this.pendingVeronaSave &&
        this.veronaSaveStatus !== "save_failed" &&
        this.veronaSaveStatus !== "queued_offline"
      ) {
        this.scheduleVeronaSaveDrain();
      }
    }
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
    this.presentedActiveTimers.clear();
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
    const saveResponses =
      this.readCurrentRunState()?.executionMode.saveResponses ?? true;
    const settledVeronaResponse =
      await this.settleVeronaAutoSaveBeforeForegroundAction();
    const activeTimerBeforeComplete =
      this.readCurrentRunState()?.activeTestletTimer ??
      Object.values(
        this.readCurrentRunState()?.testRun.testletTimers ?? {}
      ).find(timer => timer.status === "running" || timer.status === "paused") ??
      null;
    await this.saveCurrentDraftBeforeCompleteInternal(settledVeronaResponse);

    const payload = await this.requestState.request<CompleteTestRunResponse>(
      "Participant Complete Run",
      "POST",
      resolveRoutePath(productionApiRoutes.participant.completeRun, {
        testRunId: this.runtime.testRunId.trim()
      }),
      {
        responseUnitKey: saveResponses
          ? undefined
          : this.runtime.currentUnitKey.trim() || undefined,
        unitResponse: saveResponses ? undefined : this.runtime.currentUnitResponse,
        transientUnitResponses: saveResponses
          ? undefined
          : this.ephemeralUnitResponseRecord(this.runtime.testRunId.trim()),
        confirmTestletTimeLeave,
        confirmTestletLeaveLock
      } satisfies CompleteTestRunRequest
    );

    this.syncRun(payload.testRun);
    if (!saveResponses) {
      this.ephemeralUnitResponses.delete(payload.testRun.testRunId);
      this.optimisticVeronaResponse = null;
      this.runtime.currentUnitResponse = "";
    }
    this.runtime.runtimeMonitorView = prettyPrintJson(
      payload,
      this.runtime.runtimeMonitorView
    );
    if (saveResponses) {
      this.persistState();
      await this.refreshCurrentStateInternal(true);
    } else {
      this.presentTransientCompletion(payload.testRun);
      this.persistState();
    }
    if (activeTimerBeforeComplete) {
      this.showTimerLifecycleEvent(
        payload.testRun.testRunId,
        "cancelled",
        activeTimerBeforeComplete,
        true
      );
    }
  }

  private async saveCurrentDraftBeforeCompleteInternal(
    settledVeronaResponse: SettledVeronaResponse | null
  ): Promise<void> {
    const player = this.player;
    const currentUnitKey = this.runtime.currentUnitKey.trim();
    if (
      !player.canSaveProgress ||
      !this.runtime.testRunId.trim() ||
      !currentUnitKey
    ) {
      return;
    }

    if (
      settledVeronaResponse?.testRunId === this.runtime.testRunId.trim() &&
      settledVeronaResponse.unitKey === currentUnitKey
    ) {
      return;
    }

    await this.saveProgressInternal(
      player.runStatus === "paused" ? "paused" : "running",
      currentUnitKey,
      this.runtime.currentUnitResponse
    );
  }

  private async settleVeronaAutoSaveBeforeForegroundAction(): Promise<
    SettledVeronaResponse | null
  > {
    if (this.veronaPlayer) {
      // Players may debounce stateChanged after an input event. Keep the frame
      // alive briefly so an immediate host navigation cannot retire it before
      // its latest answer reaches the outbox.
      await new Promise<void>(resolve => {
        globalThis.setTimeout(resolve, VERONA_FOREGROUND_STATE_GRACE_MS);
      });
    }
    const unsettledResponse = this.pendingVeronaSave
      ? {
          testRunId: this.pendingVeronaSave.testRunId,
          unitKey: this.pendingVeronaSave.unitKey,
          response: this.pendingVeronaSave.response
        }
      : this.optimisticVeronaResponse;
    this.clearVeronaSaveBuffer();
    for (let attempt = 0; attempt < 3; attempt += 1) {
      const activeSave = this.veronaSaveDrainPromise;
      if (activeSave) {
        await activeSave;
      }
      if (this.pendingVeronaSave) {
        this.scheduleVeronaSaveDrain(0);
        const forcedSave = this.veronaSaveDrainPromise;
        if (forcedSave) {
          await forcedSave;
        }
      }
      if (!this.pendingVeronaSave) {
        return unsettledResponse;
      }
      if (attempt < 2) {
        await new Promise<void>(resolve => {
          globalThis.setTimeout(resolve, 50);
        });
      }
    }
    if (this.pendingVeronaSave) {
      throw new Error(
        "The pending Verona response could not be saved before the participant action."
      );
    }
    return unsettledResponse;
  }

  private compactParticipantTestLogBatches(
    batches: ParticipantTestLogBatch[]
  ): ParticipantTestLogBatch[] {
    const latestEntries = batches
      .flatMap(batch =>
        batch.entries.map(entry => ({
          unitKey: batch.unitKey,
          originalUnitId: batch.originalUnitId,
          entry
        }))
      )
      .slice(-200);
    const compacted = new Map<string, ParticipantTestLogBatch>();
    for (const item of latestEntries) {
      const scopeKey = item.unitKey === null
        ? "test:"
        : `unit:${item.unitKey}`;
      const batch = compacted.get(scopeKey) ?? {
        unitKey: item.unitKey,
        originalUnitId: item.originalUnitId,
        entries: []
      };
      batch.entries.push(item.entry);
      compacted.set(scopeKey, batch);
    }
    return [...compacted.values()].slice(-20);
  }

  private resetReviewEditor(): void {
    this.editingReviewId = "";
    this.editingReviewUnitKey = null;
    this.editingReviewPage = null;
    this.reviewTarget = "unit";
    this.reviewPageLabel = "";
    this.reviewerId = "";
    this.reviewPriority = 0;
    this.reviewCategories = [];
    this.reviewComment = "";
  }

  private async refreshParticipantReviewsInternal(
    currentState: ParticipantCurrentRunStateResponse["currentRunState"],
    quiet: boolean
  ): Promise<void> {
    if (!currentState.executionMode.canReview) {
      this.participantReviews = [];
      this.resetReviewEditor();
      this.reviewFeedback = "";
      return;
    }
    const payload =
      await this.requestState.request<ListParticipantReviewsResponse>(
        "Participant Review Comments",
        "GET",
        resolveRoutePath(productionApiRoutes.participant.listReviews, {
          testRunId: currentState.testRun.testRunId
        }),
        undefined,
        { quiet }
      );
    this.participantReviews = payload.items;
  }

  private async selectAdaptiveStateInternal(
    stateKey: string,
    optionKey: string
  ): Promise<void> {
    const currentState = this.readCurrentRunState();
    if (
      !currentState ||
      !currentState.availableActions.includes("change_state_options")
    ) {
      return;
    }
    this.adaptiveStateChangePending = stateKey;
    this.adaptiveStateFeedback = "Saving adaptive route…";
    try {
      await this.requestState.request<SelectParticipantAdaptiveStateResponse>(
        "Select Adaptive Route",
        "POST",
        resolveRoutePath(productionApiRoutes.participant.selectAdaptiveState, {
          testRunId: currentState.testRun.testRunId,
          stateKey
        }),
        { optionKey } satisfies SelectParticipantAdaptiveStateRequest
      );
      await this.refreshCurrentStateInternal(true);
      const selectedState = this.adaptiveStates.find(
        state => state.stateKey === stateKey
      );
      this.adaptiveStateFeedback = selectedState
        ? `${selectedState.displayLabel}: ${selectedState.optionLabel} selected.`
        : "Adaptive route saved.";
    } finally {
      this.adaptiveStateChangePending = "";
    }
  }

  private async saveReviewInternal(): Promise<void> {
    const currentState = this.readCurrentRunState();
    if (!currentState || !currentState.executionMode.canReview) {
      return;
    }
    const unitKey =
      this.reviewTarget !== "test"
        ? this.editingReviewUnitKey ?? currentState.currentUnit.unitKey
        : null;
    const page =
      this.reviewTarget === "task"
        ? this.editingReviewId
          ? this.editingReviewPage
          : this.currentReviewPage
        : null;
    const pageLabel =
      this.reviewTarget === "task" ? this.reviewPageLabel.trim() || null : null;
    const reviewId = this.editingReviewId;
    if (reviewId) {
      await this.requestState.request<ParticipantReviewResponse>(
        "Update Participant Comment",
        "PATCH",
        resolveRoutePath(productionApiRoutes.participant.updateReview, {
          testRunId: currentState.testRun.testRunId,
          reviewId
        }),
        {
          unitKey,
          page,
          pageLabel,
          reviewerId: this.reviewerId.trim() || undefined,
          categories: this.reviewCategories,
          priority: this.reviewPriority,
          comment: this.reviewComment
        } satisfies UpdateParticipantReviewRequest
      );
      this.reviewFeedback = "Comment updated.";
    } else {
      await this.requestState.request<ParticipantReviewResponse>(
        "Create Participant Comment",
        "POST",
        resolveRoutePath(productionApiRoutes.participant.createReview, {
          testRunId: currentState.testRun.testRunId
        }),
        {
          unitKey,
          page,
          pageLabel,
          reviewerId: this.reviewerId.trim() || undefined,
          categories: this.reviewCategories,
          priority: this.reviewPriority,
          comment: this.reviewComment
        } satisfies CreateParticipantReviewRequest
      );
      this.reviewFeedback = "Comment saved.";
    }
    this.resetReviewEditor();
    await this.refreshParticipantReviewsInternal(currentState, true);
  }

  private async deleteReviewInternal(reviewId: string): Promise<void> {
    const currentState = this.readCurrentRunState();
    if (!currentState || !currentState.executionMode.canReview) {
      return;
    }
    await this.requestState.request<DeleteParticipantReviewResponse>(
      "Delete Participant Comment",
      "DELETE",
      resolveRoutePath(productionApiRoutes.participant.deleteReview, {
        testRunId: currentState.testRun.testRunId,
        reviewId
      })
    );
    if (this.editingReviewId === reviewId) {
      this.resetReviewEditor();
    }
    this.reviewFeedback = "Comment deleted.";
    await this.refreshParticipantReviewsInternal(currentState, true);
  }

  private async refreshCurrentStateInternal(quiet: boolean): Promise<void> {
    if (!this.runtime.participantSessionId.trim()) {
      return;
    }

    const loadStartedAtMs = Date.now();
    try {
      let payload =
        await this.requestState.request<ParticipantCurrentRunStateResponse>(
          "Participant Current State",
          "GET",
          resolveRoutePath(productionApiRoutes.participant.getCurrentRunState, {
            participantSessionId: this.runtime.participantSessionId.trim()
          }),
          undefined,
          { quiet }
        );
      const testRunId = payload.currentRunState.testRun.testRunId;
      if (!this.bookletAssetLoadStartedAtMs.has(testRunId)) {
        this.bookletAssetLoadStartedAtMs.set(testRunId, loadStartedAtMs);
      }
      if (
        payload.currentRunState.booklet.policy.player.loadingMode === "eager" &&
        this.loadedBookletAssets()?.testRunId !== testRunId
      ) {
        payload = await this.loadBookletAssets(payload);
        this.recordLoadedBookletAssets(payload, testRunId);
      }
      const currentStateViewPayload = payload.currentRunState.bookletAssets
        ? {
            ...payload,
            currentRunState: {
              ...payload.currentRunState,
              bookletAssets: undefined
            }
          }
        : payload;
      this.runtime.currentRunStateView = prettyPrintJson(
        currentStateViewPayload,
        this.runtime.currentRunStateView
      );
      this.syncCurrentRunState(payload.currentRunState);
      this.syncCurrentUnitResponse(payload.currentRunState);
      this.reconcileOptimisticVeronaResponse(payload.currentRunState);
      this.restorePersistentVeronaSave(payload.currentRunState);
      this.persistLoadCompleteLog(payload, testRunId);
      if (payload.currentRunState.booklet.policy.player.loadingMode !== "eager") {
        this.loadBookletAssetsInBackground(payload);
      }
      await this.refreshParticipantReviewsInternal(payload.currentRunState, true);
      if (payload.currentRunState.testRun.status === "completed") {
        this.participantEvents.stop();
      } else {
        this.participantEvents.start(
          payload.currentRunState.participantSession.participantSessionId,
          this.refreshFromParticipantEvents,
          this.logParticipantConnectionMode
        );
      }
      this.persistState();
    } catch (error) {
      if (
        this.requestState.isApiError(error) &&
        error.error === "participant_session_has_no_current_run"
      ) {
        this.participantEvents.stop();
        this.currentRunState = null;
        this.syncParticipantHeaderVisibility();
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

  private loadBookletAssets(
    payload: ParticipantCurrentRunStateResponse
  ): Promise<ParticipantCurrentRunStateResponse> {
    const testRunId = payload.currentRunState.testRun.testRunId;
    const existingLoad = this.bookletAssetLoadPromises.get(testRunId);
    if (existingLoad) {
      return existingLoad;
    }
    const participantSessionId =
      payload.currentRunState.participantSession.participantSessionId;
    const request = this.requestState.request<ParticipantCurrentRunStateResponse>(
      "Preload Participant Booklet",
      "GET",
      `${resolveRoutePath(
        productionApiRoutes.participant.getCurrentRunState,
        { participantSessionId }
      )}?includeBookletAssets=true`,
      undefined,
      { quiet: true }
    );
    const trackedRequest = request.finally(() => {
      if (this.bookletAssetLoadPromises.get(testRunId) === trackedRequest) {
        this.bookletAssetLoadPromises.delete(testRunId);
      }
    });
    this.bookletAssetLoadPromises.set(testRunId, trackedRequest);
    return trackedRequest;
  }

  private loadBookletAssetsInBackground(
    payload: ParticipantCurrentRunStateResponse
  ): void {
    const testRunId = payload.currentRunState.testRun.testRunId;
    if (this.loadedBookletAssets()?.testRunId === testRunId) {
      return;
    }
    void this.loadBookletAssets(payload)
      .then(loadedPayload => {
        if (this.currentRunState?.testRun.testRunId === testRunId) {
          this.recordLoadedBookletAssets(loadedPayload, testRunId);
          this.persistLoadCompleteLog(loadedPayload, testRunId);
        }
      })
      .catch(() => {
        // LAZY background loading is retried by the next current-state refresh.
      });
  }

  private recordLoadedBookletAssets(
    payload: ParticipantCurrentRunStateResponse,
    expectedTestRunId: string
  ): void {
    if (payload.currentRunState.testRun.testRunId !== expectedTestRunId) {
      return;
    }
    this.loadedBookletAssets.set({
      testRunId: expectedTestRunId,
      assets: payload.currentRunState.bookletAssets ?? null
    });
  }

  private persistLoadCompleteLog(
    payload: ParticipantCurrentRunStateResponse,
    expectedTestRunId: string
  ): void {
    const currentState = payload.currentRunState;
    if (
      currentState.testRun.testRunId !== expectedTestRunId ||
      this.currentRunState?.testRun.testRunId !== expectedTestRunId ||
      this.loadedBookletAssets()?.testRunId !== expectedTestRunId ||
      this.loadCompleteRunIds.has(expectedTestRunId) ||
      !currentState.availableActions.includes("save_progress")
    ) {
      return;
    }
    const completedAtMs = Date.now();
    const environment = projectTestcenterLoadEnvironment({
      userAgent: globalThis.navigator?.userAgent ?? "",
      screenSizeWidth: globalThis.screen?.width ?? 0,
      screenSizeHeight: globalThis.screen?.height ?? 0,
      loadTime:
        completedAtMs -
        (this.bookletAssetLoadStartedAtMs.get(expectedTestRunId) ??
          completedAtMs)
    });
    const deliveryId =
      this.loadCompleteDeliveryIds.get(expectedTestRunId) ??
      (globalThis.crypto?.randomUUID?.() ??
        `loadcomplete-${completedAtMs}-${Math.random().toString(36).slice(2)}`);
    this.loadCompleteDeliveryIds.set(expectedTestRunId, deliveryId);
    this.loadCompleteRunIds.add(expectedTestRunId);
    void this.requestState.request<SaveParticipantTestLogsResponse>(
      "Participant Load Complete Log",
      "POST",
      resolveRoutePath(productionApiRoutes.participant.saveTestLogs, {
        testRunId: expectedTestRunId
      }),
      {
        deliveryId,
        logs: [{
          unitKey: null,
          originalUnitId: null,
          entries: [
            {
              key: "LOADCOMPLETE",
              timeStamp: completedAtMs,
              content: JSON.stringify(environment)
            },
            {
              key: "CONNECTION",
              timeStamp: completedAtMs,
              content: "POLLING"
            }
          ]
        }]
      } satisfies SaveParticipantTestLogsRequest,
      { quiet: true }
    ).then(() => {
      this.bookletAssetLoadStartedAtMs.delete(expectedTestRunId);
      this.loadCompleteDeliveryIds.delete(expectedTestRunId);
    }).catch(() => {
      this.loadCompleteRunIds.delete(expectedTestRunId);
    });
  }

  private syncRun(
    testRun: Pick<
      ParticipantCurrentRunStateResponse["currentRunState"]["testRun"],
      "testRunId"
    > &
      Partial<ParticipantCurrentRunStateResponse["currentRunState"]["testRun"]>
  ): void {
    this.captureTimerLifecycleTransitions(testRun);
    if (this.currentRunState?.testRun.testRunId === testRun.testRunId) {
      this.currentRunState = {
        ...this.currentRunState,
        testRun: {
          ...this.currentRunState.testRun,
          ...testRun
        }
      };
      this.syncParticipantHeaderVisibility();
    }
    this.runtime.testRunId = testRun.testRunId;
    if (testRun.bookletAssignmentKey || testRun.bookletKey) {
      this.runtime.bookletKey =
        testRun.bookletAssignmentKey ?? testRun.bookletKey ?? "";
    }
    if (testRun.currentUnitKey != null) {
      this.runtime.currentUnitKey = testRun.currentUnitKey;
    }
    this.syncActiveBookletCustomTexts();
  }

  private presentTransientCompletion(
    testRun: CompleteTestRunResponse["testRun"]
  ): void {
    if (!this.currentRunState) {
      return;
    }
    const completedState: ParticipantCurrentRunStateResponse["currentRunState"] = {
      ...this.currentRunState,
      testRun: {
        ...this.currentRunState.testRun,
        ...testRun
      },
      currentUnit: {
        unitKey: null,
        displayLabel: null,
        description: null,
        content: null,
        player: null,
        unitDefinition: null,
        unitDefinitionType: null,
        testletPath: []
      },
      activeTestletTimer: null,
      activeLeaveLock: null,
      navigation: {
        previousUnitKey: null,
        nextUnitKey: null,
        canGoPrevious: false,
        canGoNext: false,
        canComplete: false,
        canPlayerEnd: false,
        backwardDeniedReasons: [],
        forwardDeniedReasons: [],
        backwardAdvisoryReasons: [],
        forwardAdvisoryReasons: [],
        nextTestletGate: null
      },
      availableActions: this.currentRunState.executionMode.canReview
        ? ["review"]
        : []
    };
    this.currentRunState = completedState;
    this.syncParticipantHeaderVisibility();
    this.runtime.currentUnitKey = "";
    this.runtime.currentRunStateView = prettyPrintJson(
      { currentRunState: completedState },
      this.runtime.currentRunStateView
    );
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
    const controllerError = this.activeControllerError();
    if (
      controllerError &&
      controllerError.testRunId !== currentState.testRun.testRunId
    ) {
      this.activeControllerError.set(null);
    }
    if (
      currentState.testRun.testRunId !==
      this.loadedBookletAssets()?.testRunId
    ) {
      this.loadedBookletAssets.set(null);
    }
    this.captureTimerLifecycleTransitions(currentState.testRun);
    this.currentRunState = currentState;
    this.syncParticipantHeaderVisibility();
    this.workspace.tenantKey = currentState.scope.tenantKey;
    this.workspace.workspaceKey = currentState.scope.workspaceKey;
    this.syncParticipantSessionFields(currentState.participantSession);
    this.syncParticipantRosterEntry(currentState.participantRosterEntry);
    this.syncRun(currentState.testRun);
    this.syncRuntimeBooklets(currentState.booklets);
  }

  private syncParticipantRosterEntry(
    participantRosterEntry: Pick<
      ParticipantRosterEntry,
      "displayName" | "customTexts"
    > | null
  ): void {
    this.runtime.participantDisplayName =
      participantRosterEntry?.displayName?.trim() ?? "";
    this.setParticipantRosterCustomTexts(participantRosterEntry?.customTexts ?? {});
  }

  private syncRuntimeBooklets(booklets: ParticipantRuntimeBooklet[]): void {
    this.assignedBooklets = booklets;
    const selectedBooklet = booklets.find(
      booklet => booklet.bookletKey === this.runtime.bookletKey.trim()
    );
    if (selectedBooklet && selectedBooklet.status !== "completed") {
      this.syncActiveBookletCustomTexts();
      return;
    }

    const nextBooklet =
      booklets.find(booklet => booklet.status === "in_progress") ??
      booklets.find(booklet => booklet.status === "locked") ??
      booklets.find(booklet => booklet.status === "available") ??
      selectedBooklet ??
      booklets[0];
    if (nextBooklet) {
      this.runtime.bookletKey = nextBooklet.bookletKey;
    }
    this.syncActiveBookletCustomTexts();
  }

  private syncActiveBookletCustomTexts(): void {
    if (!this.runtime.testRunId.trim()) {
      this.setParticipantBookletCustomTexts({});
      return;
    }
    const activeBooklet = this.assignedBooklets.find(
      booklet => booklet.bookletKey === this.runtime.bookletKey.trim()
    );
    this.setParticipantBookletCustomTexts(activeBooklet?.customTexts ?? {});
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
    const optimisticResponse =
      unitKey &&
      this.optimisticVeronaResponse?.testRunId ===
        currentState.testRun.testRunId &&
      this.optimisticVeronaResponse.unitKey === unitKey
        ? this.optimisticVeronaResponse.response
        : null;
    this.runtime.currentUnitResponse =
      optimisticResponse ??
      (unitKey ? this.effectiveUnitResponse(currentState, unitKey) : "");
  }

  private restorePersistentVeronaSave(
    currentState:
      | ParticipantCurrentRunStateResponse["currentRunState"]
      | null
  ): void {
    if (!currentState || this.pendingVeronaSave) {
      return;
    }
    const testRunId = currentState.testRun.testRunId;
    const currentUnitKey = currentState.currentUnit.unitKey;
    const saved =
      (currentUnitKey
        ? findParticipantSaveOutboxEntryForUnit(testRunId, currentUnitKey)
        : null) ?? findParticipantSaveOutboxEntry(testRunId);
    if (!saved) {
      return;
    }
    if (currentState.testRun.unitResponses[saved.unitKey] === saved.response) {
      removeParticipantSaveOutboxEntry(saved.testRunId, saved.deliveryId);
      this.veronaSaveStatus = "saved";
      return;
    }
    if (currentState.testRun.status === "completed") {
      this.veronaSaveStatus = "save_failed";
      return;
    }
    this.pendingVeronaSave = saved;
    this.optimisticVeronaResponse = {
      testRunId: saved.testRunId,
      unitKey: saved.unitKey,
      response: saved.response
    };
    this.veronaSaveStatus = "queued_offline";
    if (currentState.currentUnit.unitKey === saved.unitKey) {
      this.runtime.currentUnitResponse = saved.response;
    }
    if (
      (currentState.availableActions.includes("save_progress") ||
        (currentState.testRun.status === "paused" &&
          currentState.testRun.pauseSource === "monitor")) &&
      globalThis.navigator?.onLine !== false
    ) {
      this.scheduleVeronaSaveDrain();
    }
  }

  private reconcileOptimisticVeronaResponse(
    currentState: ParticipantCurrentRunStateResponse["currentRunState"]
  ): void {
    const optimistic = this.optimisticVeronaResponse;
    if (
      optimistic?.testRunId === currentState.testRun.testRunId &&
      currentState.testRun.unitResponses[optimistic.unitKey] ===
        optimistic.response
    ) {
      this.optimisticVeronaResponse = null;
    }
  }

  private removeMatchingDeliveredOutbox(
    testRunId: string,
    unitKey: string | undefined,
    unitResponse: string | null | undefined
  ): void {
    if (!unitKey || unitResponse == null) {
      return;
    }
    const saved = findParticipantSaveOutboxEntryForUnit(testRunId, unitKey);
    if (
      saved &&
      saved.unitKey === unitKey &&
      saved.response === unitResponse
    ) {
      removeParticipantSaveOutboxEntry(saved.testRunId, saved.deliveryId);
    }
  }

  private queuePendingVeronaSaveForBackgroundDelivery(): void {
    const testRunId =
      this.pendingVeronaSave?.testRunId ?? this.runtime.testRunId.trim();
    if (testRunId) {
      queueParticipantSaveOutboxForRunForBackgroundDelivery(testRunId);
    }
  }

  private nextPersistentVeronaSave(
    testRunId: string
  ): ParticipantSaveOutboxEntry | null {
    const currentUnitKey = this.readCurrentRunState()?.currentUnit.unitKey;
    return (
      (currentUnitKey
        ? findParticipantSaveOutboxEntryForUnit(testRunId, currentUnitKey)
        : null) ?? findParticipantSaveOutboxEntry(testRunId)
    );
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
    return (
      this.ephemeralUnitResponses
        .get(currentState.testRun.testRunId)
        ?.has(unitKey) === true ||
      Object.prototype.hasOwnProperty.call(
        currentState.testRun.unitResponses,
        unitKey
      )
    );
  }

  private effectiveUnitResponse(
    currentState: ParticipantCurrentRunStateResponse["currentRunState"],
    unitKey: string
  ): string {
    return (
      this.ephemeralUnitResponses
        .get(currentState.testRun.testRunId)
        ?.get(unitKey) ?? currentState.testRun.unitResponses[unitKey] ?? ""
    );
  }

  private rememberEphemeralUnitResponse(
    testRunId: string,
    unitKey: string,
    response: string
  ): void {
    const responses = this.ephemeralUnitResponses.get(testRunId) ?? new Map();
    responses.set(unitKey, response);
    this.ephemeralUnitResponses.set(testRunId, responses);
  }

  private ephemeralUnitResponseRecord(testRunId: string): Record<string, string> {
    return Object.fromEntries(this.ephemeralUnitResponses.get(testRunId) ?? []);
  }

  private effectiveNavigationDeniedReasons(
    deniedReasons: readonly string[],
    response: string
  ): string[] {
    const parsed = parseVeronaUnitResponse(response);
    const presentationComplete =
      parsed == null || parsed.unitState.presentationProgress === "complete";
    const responseComplete = parsed
      ? parsed.unitState.responseProgress === "complete"
      : response.trim().length > 0;
    return deniedReasons.filter(
      reason =>
        !(reason === "presentation_incomplete" && presentationComplete) &&
        !(reason === "response_incomplete" && responseComplete)
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
    if (this.currentRunState) {
      return this.currentRunState;
    }
    try {
      const payload = JSON.parse(this.runtime.currentRunStateView) as Partial<
        ParticipantCurrentRunStateResponse
      >;
      this.currentRunState = payload.currentRunState ?? null;
      this.syncParticipantHeaderVisibility();
      return this.currentRunState;
    } catch {
      return null;
    }
  }

  private syncParticipantHeaderVisibility(): void {
    const currentState = this.currentRunState;
    this.participantShell.setHeaderHidden(
      Boolean(
        currentState &&
          currentState.testRun.status !== "completed" &&
          (currentState.booklet.policy.display.headerHidden ?? false)
      )
    );
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
