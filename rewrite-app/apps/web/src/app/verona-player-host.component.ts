import { CommonModule } from "@angular/common";
import {
  ChangeDetectorRef,
  Component,
  ElementRef,
  EventEmitter,
  HostListener,
  Input,
  Output,
  ViewChild
} from "@angular/core";
import type {
  AfterViewInit,
  OnChanges,
  OnDestroy,
  SimpleChanges
} from "@angular/core";

import {
  isSupportedVeronaPlayerApiVersion,
  mergeVeronaUnitResponse,
  normalizeVeronaStateLogEntries,
  parseVeronaIncomingNotification,
  parseVeronaUnitResponse,
  prepareVeronaUnitStateForPlayer,
  projectVeronaPageState,
  projectVeronaUnitStateLogs,
  readVeronaPlayerApiVersion,
  resolveVeronaNavigationRequest,
  serializeVeronaUnitResponse,
  SUPPORTED_VERONA_PLAYER_API_MAJOR_MAX,
  SUPPORTED_VERONA_PLAYER_API_MAJOR_MIN,
  type VeronaNavigationDeniedNotification,
  type VeronaNavigationDeniedReason,
  type VeronaNavigationRequestedNotification,
  type VeronaPageNavigationCommand,
  type VeronaPlayerConfig,
  type VeronaPlayerConfigChangedNotification,
  type VeronaPlayerState,
  type VeronaSharedParameter,
  type VeronaStartCommand
} from "@testcenter-rewrite-app/contracts";
import type { ParticipantTestLogEntryInput } from "@testcenter-rewrite-app/domain";

const controllerRecoveryStorageKey =
  "testcenter-rewrite:participant-controller-recovery:v1";

export type VeronaResponseChange = {
  testRunId: string;
  unitKey: string;
  response: string;
  unitDataChanged: boolean;
  unitStateChanged: boolean;
  playerStateChanged: boolean;
};

export type VeronaLogChange = {
  testRunId: string;
  unitKey: string;
  entries: ParticipantTestLogEntryInput[];
};

export type VeronaControllerError = {
  testRunId: string;
  unitKey: string;
  message: string;
};

type RetiredVeronaFrame = {
  sessionId: string;
  testRunId: string;
  unitKey: string;
  latestResponse: string;
};

@Component({
  selector: "app-verona-player-host",
  standalone: true,
  imports: [CommonModule],
  template: `
    <section class="verona-player-shell" aria-label="Verona unit player">
      <header>
        <div>
          <span>Verona Player</span>
          <strong id="participantVeronaPlayerKey">{{ playerKey }}</strong>
        </div>
        <div class="verona-player-status">
          <span id="participantVeronaPlayerStatus">{{ status }}</span>
          <small id="participantVeronaPlayerVersion">{{ apiVersionLabel }}</small>
        </div>
      </header>
      <section
        *ngIf="status === 'loading'"
        class="verona-player-loading"
        id="participantVeronaPlayerLoading"
        [attr.data-loading-phase]="loadingPhase"
        role="status"
        aria-live="polite"
      >
        <span id="participantVeronaPlayerLoadingLabel">{{ loadingLabel }}</span>
        <strong id="participantVeronaPlayerLoadingTitle">{{ loadingTitle }}</strong>
        <div
          id="participantVeronaPlayerLoadingProgress"
          class="verona-player-loading-progress"
          [class.is-pending]="loadingPhase === 'pending'"
          [class.is-indeterminate]="loadingPhase === 'unknown'"
          [class.is-complete]="loadingPhase === 'complete'"
          role="progressbar"
          aria-valuemin="0"
          aria-valuemax="100"
          [attr.aria-valuenow]="loadingProgressPercent"
          [attr.aria-valuetext]="loadingStatusLabel"
        >
          <span [style.width.%]="loadingProgressPercent ?? 36"></span>
        </div>
        <p id="participantVeronaPlayerLoadingStatus">{{ loadingStatusLabel }}</p>
      </section>
      <div #frameHost class="verona-player-frame-host" id="participantVeronaFrameHost"></div>
      <nav
        *ngIf="showGlobalBackwardButton || showPageNavigation || showGlobalForwardButton"
        class="verona-player-page-navigation"
        id="participantVeronaPageNavigation"
        aria-label="Test navigation"
      >
        <button
          *ngIf="showGlobalBackwardButton"
          id="participantVeronaGlobalBackwardButton"
          type="button"
          class="secondary verona-player-global-navigation"
          aria-label="Back"
          [disabled]="!canGoPrevious && !hasPreviousPage"
          (click)="goGlobalBackward()"
        >
          ← Back
        </button>
        <ng-container *ngIf="showPageNavigation">
          <span
            id="participantVeronaPageNavigationPrompt"
            class="verona-player-page-navigation-prompt"
          >{{ pageNavigationPrompt }}</span>
          <button
            *ngIf="!pageNavigationControlsHidden"
            id="participantVeronaPreviousPageButton"
            type="button"
            class="ghost"
            aria-label="Previous page"
            [disabled]="currentPageIndex <= 0"
            (click)="goToRelativePage(-1)"
          >
            ←
          </button>
          <div
            *ngIf="showPageNavigationLabel"
            class="verona-player-page-label"
            id="participantVeronaPageLabel"
            aria-live="polite"
          >
            <span *ngIf="pageNavigationLabelMode !== 'list'">{{ pageNavigationLabel }}</span>
            <span
              *ngIf="pageNavigationLabelMode === 'list'"
              class="verona-player-page-list"
              aria-label="Available pages"
            >
              <span
                *ngFor="let page of pages; let pageIndex = index"
                [class.is-current]="pageIndex === currentPageIndex"
                [attr.aria-current]="pageIndex === currentPageIndex ? 'page' : null"
                [attr.title]="page.label"
              >{{ pageIndex + 1 }}</span>
            </span>
          </div>
          <button
            *ngIf="!pageNavigationControlsHidden"
            id="participantVeronaNextPageButton"
            type="button"
            class="ghost"
            aria-label="Next page"
            [disabled]="currentPageIndex < 0 || currentPageIndex >= pages.length - 1"
            (click)="goToRelativePage(1)"
          >
            →
          </button>
        </ng-container>
        <button
          *ngIf="showGlobalForwardButton"
          id="participantVeronaGlobalForwardButton"
          type="button"
          class="secondary verona-player-global-navigation"
          aria-label="Continue"
          [disabled]="!canGoNext && !hasNextPage"
          (click)="goGlobalForward()"
        >
          Continue →
        </button>
      </nav>
      <section
        *ngIf="errorMessage"
        class="verona-player-error"
        id="participantVeronaPlayerError"
        role="alert"
      >
        <strong>{{ errorTitle }}</strong>
        <p id="participantVeronaPlayerErrorText">{{ errorText }}</p>
        <details>
          <summary>Technical details</summary>
          <p id="participantVeronaPlayerErrorDetail">{{ errorMessage }}</p>
        </details>
        <button
          id="participantVeronaReloadPlayerButton"
          type="button"
          class="secondary"
          (click)="reload()"
        >Reload Player</button>
      </section>
      <footer>
        <span id="participantVeronaSaveStatus" aria-live="polite">{{ saveStatusLabel }}</span>
        <button
          *ngIf="saveStatus === 'save_failed' || saveStatus === 'queued_offline'"
          id="participantVeronaRetrySaveButton"
          type="button"
          class="ghost"
          (click)="retrySave.emit()"
        >
          Retry Save
        </button>
      </footer>
    </section>
  `
})
export class VeronaPlayerHostComponent
  implements AfterViewInit, OnChanges, OnDestroy
{
  @ViewChild("frameHost", { static: true })
  private frameHost!: ElementRef<HTMLDivElement>;

  @Input({ required: true }) playerHtml = "";
  @Input({ required: true }) playerKey = "";
  @Input({ required: true }) testRunId = "";
  @Input({ required: true }) unitKey = "";
  @Input({ required: true }) unitTitle = "";
  @Input({ required: true }) unitDefinition = "";
  @Input() unitDefinitionType = "";
  @Input() resourceBasePath = "";
  @Input() savedResponse = "";
  @Input() sharedParameters: VeronaSharedParameter[] = [];
  @Input() unitNumber = 1;
  @Input() unitCount = 1;
  @Input() canGoPrevious = false;
  @Input() canGoNext = false;
  @Input() canComplete = false;
  @Input() canNavigateUnits = false;
  @Input() navigationUnits: ReadonlyArray<{
    unitKey: string;
    isLocked: boolean;
  }> = [];
  @Input() backwardDeniedReasons: readonly string[] = [];
  @Input() forwardDeniedReasons: readonly string[] = [];
  @Input() logPolicy: "disabled" | "lean" | "rich" | "debug" = "rich";
  @Input() pagingMode:
    | "separate"
    | "concat-scroll"
    | "concat-scroll-snap"
    | "buttons" = "separate";
  @Input() restoreCurrentPageOnReturn = false;
  @Input() pageNavigationLabelMode: "hidden" | "index" | "label" | "list" =
    "index";
  @Input() pageNavigationControlsHidden = false;
  @Input() pageNavigationPrompt = "Weitere Seiten:";
  @Input() globalBackwardButtonMode:
    | "hidden"
    | "dynamic"
    | "units"
    | "pages" = "hidden";
  @Input() globalForwardButtonMode:
    | "hidden"
    | "dynamic"
    | "units"
    | "pages" = "hidden";
  @Input() saveStatus = "not_saved";
  @Input() loadingLabel = "Please wait";
  @Input() loadingTitle = "Unit is loading";
  @Input() loadingStatus = "Loading progress is not available";
  @Input() loadingPendingStatus = "In queue";
  @Input() loadingCompleteStatus = "Loaded";
  @Input() errorTitle = "Player could not start";
  @Input() errorText =
    "The unit could not be loaded. Reload the player or ask the test supervisor for help.";

  @Output() readonly responseChange = new EventEmitter<string>();
  @Output() readonly responseUpdate = new EventEmitter<VeronaResponseChange>();
  @Output() readonly logEntries = new EventEmitter<VeronaLogChange>();
  @Output() readonly testLogEntries =
    new EventEmitter<ParticipantTestLogEntryInput[]>();
  @Output() readonly controllerError =
    new EventEmitter<VeronaControllerError>();
  @Output() readonly navigationRequest = new EventEmitter<string>();
  @Output() readonly retrySave = new EventEmitter<void>();

  status: "loading" | "ready" | "running" | "error" = "loading";
  loadingPhase: "pending" | "unknown" | "complete" = "pending";
  apiVersionLabel = "Waiting for player";
  errorMessage = "";
  pages: Array<{ id: string; label: string }> = [];
  currentPageIndex = -1;

  private frame: HTMLIFrameElement | null = null;
  private readyTimeout: ReturnType<typeof setTimeout> | null = null;
  private mountFrameRequest: number | null = null;
  private startPlayerRequest: number | null = null;
  private focusLogTimeout: ReturnType<typeof setTimeout> | null = null;
  private pendingPlayerHasFocus: boolean | undefined;
  private lastFocusLogContent: "HAS" | "HAS_NOT" | null = null;
  private controllerErrorLoggedForFrame = false;
  private controllerRecoveryTestRunId: string | null = null;
  private latestResponse = "";
  private frameTestRunId = "";
  private frameUnitKey = "";
  private frameSessionId = "";
  private readonly retiredFrames = new Map<MessageEventSource, RetiredVeronaFrame>();
  private apiVersion: string | null = null;
  private viewReady = false;

  constructor(private readonly changeDetector: ChangeDetectorRef) {}

  private get sessionId(): string {
    return this.unitKey;
  }

  get saveStatusLabel(): string {
    switch (this.saveStatus) {
      case "queued_offline":
        return "queued offline";
      case "save_failed":
        return "save failed";
      case "not_saved":
        return "not saved";
      default:
        return this.saveStatus;
    }
  }

  get loadingProgressPercent(): number | null {
    return this.loadingPhase === "complete"
      ? 100
      : this.loadingPhase === "pending"
        ? 0
        : null;
  }

  get loadingStatusLabel(): string {
    switch (this.loadingPhase) {
      case "pending":
        return this.loadingPendingStatus;
      case "complete":
        return `100% ${this.loadingCompleteStatus}`;
      default:
        return this.loadingStatus;
    }
  }

  get pageNavigationLabel(): string {
    const currentPage = this.pages[this.currentPageIndex];
    if (this.pageNavigationLabelMode === "label") {
      return currentPage?.label || currentPage?.id || "Page";
    }
    return this.currentPageIndex >= 0
      ? `Page ${this.currentPageIndex + 1}/${this.pages.length}`
      : `Page –/${this.pages.length}`;
  }

  get showGlobalBackwardButton(): boolean {
    return this.globalBackwardButtonMode !== "hidden";
  }

  get showGlobalForwardButton(): boolean {
    return this.globalForwardButtonMode !== "hidden";
  }

  get showPageNavigation(): boolean {
    return (
      this.pages.length > 0 &&
      (this.showPageNavigationLabel || !this.pageNavigationControlsHidden)
    );
  }

  get showPageNavigationLabel(): boolean {
    return this.pageNavigationLabelMode !== "hidden" && this.pages.length > 0;
  }

  get hasPreviousPage(): boolean {
    return this.currentPageIndex > 0;
  }

  get hasNextPage(): boolean {
    return (
      this.currentPageIndex >= 0 &&
      this.currentPageIndex < this.pages.length - 1
    );
  }

  goGlobalBackward(): void {
    if (
      this.globalBackwardButtonMode === "units" ||
      (this.globalBackwardButtonMode === "dynamic" && !this.hasPreviousPage)
    ) {
      this.navigationRequest.emit("previous");
      return;
    }
    if (this.globalBackwardButtonMode !== "hidden") {
      this.goToRelativePage(-1);
    }
  }

  goGlobalForward(): void {
    if (
      this.globalForwardButtonMode === "units" ||
      (this.globalForwardButtonMode === "dynamic" && !this.hasNextPage)
    ) {
      this.navigationRequest.emit("next");
      return;
    }
    if (this.globalForwardButtonMode !== "hidden") {
      this.goToRelativePage(1);
    }
  }

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.mountPlayer();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (!this.viewReady) {
      return;
    }
    if (
      changes["playerHtml"] ||
      changes["playerKey"] ||
      changes["testRunId"] ||
      changes["unitKey"] ||
      changes["unitDefinition"] ||
      changes["unitDefinitionType"]
    ) {
      this.mountPlayer();
      return;
    }
    if (
      changes["resourceBasePath"] ||
      changes["sharedParameters"] ||
      changes["unitTitle"] ||
      changes["unitNumber"] ||
      changes["unitCount"] ||
      changes["canGoPrevious"] ||
      changes["canGoNext"] ||
      changes["canComplete"] ||
      changes["logPolicy"] ||
      changes["pagingMode"] ||
      changes["restoreCurrentPageOnReturn"]
    ) {
      this.updatePlayerConfig();
    }
  }

  ngOnDestroy(): void {
    this.clearReadyTimeout();
    this.clearScheduledFrames();
    this.clearFocusLogTimeout();
    this.frame?.remove();
    this.frame = null;
    this.retiredFrames.clear();
  }

  reload(): void {
    this.mountPlayer();
  }

  @HostListener("window:message", ["$event"])
  onWindowMessage(event: MessageEvent): void {
    const activeFrame = this.frame?.contentWindow;
    const retiredFrame = event.source
      ? this.retiredFrames.get(event.source)
      : undefined;
    if ((!activeFrame || event.source !== activeFrame) && !retiredFrame) {
      return;
    }
    const notification = parseVeronaIncomingNotification(event.data);
    if (!notification) {
      return;
    }

    if (retiredFrame) {
      this.handleRetiredFrameNotification(retiredFrame, notification);
      return;
    }

    if (notification.type === "vopReadyNotification") {
      this.handleReady(notification);
      return;
    }
    const notificationSessionId =
      "sessionId" in notification ? notification.sessionId : undefined;
    if (notificationSessionId && notificationSessionId !== this.frameSessionId) {
      this.fail(
        `Player sent a message for unexpected session '${notificationSessionId}'.`
      );
      return;
    }

    switch (notification.type) {
      case "vopStateChangedNotification":
        this.status = "running";
        const logEntries: ParticipantTestLogEntryInput[] = [];
        if (notification.playerState !== undefined) {
          logEntries.push(
            ...this.updatePageNavigation(notification.playerState)
          );
        }
        if (notification.unitState !== undefined) {
          logEntries.push(...projectVeronaUnitStateLogs(notification.unitState));
        }
        if (Array.isArray(notification.log)) {
          logEntries.push(...normalizeVeronaStateLogEntries(notification.log));
        }
        if (logEntries.length > 0) {
          this.logEntries.emit({
            testRunId: this.frameTestRunId,
            unitKey: this.frameUnitKey,
            entries: logEntries
          });
        }
        this.latestResponse = mergeVeronaUnitResponse(this.latestResponse, {
          unitState: notification.unitState,
          playerState: notification.playerState
        });
        this.responseChange.emit(this.latestResponse);
        this.responseUpdate.emit({
          testRunId: this.frameTestRunId,
          unitKey: this.frameUnitKey,
          response: this.latestResponse,
          unitDataChanged:
            notification.unitState != null &&
            Object.prototype.hasOwnProperty.call(
              notification.unitState,
              "dataParts"
            ),
          unitStateChanged:
            notification.unitState != null &&
            Object.keys(notification.unitState).some(key => key !== "dataParts"),
          playerStateChanged: notification.playerState !== undefined
        });
        break;
      case "vopUnitNavigationRequestedNotification":
        this.handleNavigationRequest(notification);
        break;
      case "vopWindowFocusChangedNotification":
        this.scheduleFocusLog(notification.hasFocus);
        break;
      case "vopRuntimeErrorNotification":
        this.handleRuntimeError(notification.code, notification.message);
        break;
    }
  }

  @HostListener("window:focus")
  onWindowFocus(): void {
    this.scheduleFocusLog();
  }

  @HostListener("window:blur")
  onWindowBlur(): void {
    this.scheduleFocusLog();
  }

  @HostListener("document:visibilitychange")
  onVisibilityChange(): void {
    this.scheduleFocusLog();
  }

  private mountPlayer(): void {
    this.clearReadyTimeout();
    this.clearScheduledFrames();
    this.clearFocusLogTimeout();
    this.retireCurrentFrame();
    this.frameTestRunId = this.testRunId;
    this.frameUnitKey = this.unitKey;
    this.frameSessionId = this.sessionId;
    this.status = "loading";
    this.loadingPhase = "pending";
    this.apiVersionLabel = "Waiting for player";
    this.apiVersion = null;
    this.errorMessage = "";
    this.controllerErrorLoggedForFrame = false;
    this.pages = [];
    this.currentPageIndex = -1;
    this.latestResponse = parseVeronaUnitResponse(this.savedResponse)
      ? this.savedResponse
      : serializeVeronaUnitResponse({});
    this.persistHostLog({
      key: "PLAYER",
      timeStamp: Date.now(),
      content: "LOADING"
    }, this.savedResponse);

    if (!this.playerHtml.trim() || !this.unitDefinition.trim()) {
      this.fail("The release does not contain both player HTML and a unit definition.");
      return;
    }

    this.mountFrameRequest = globalThis.window?.requestAnimationFrame(() => {
      this.mountFrameRequest = null;
      this.beginPlayerFrameLoad();
    }) ?? null;
  }

  private beginPlayerFrameLoad(): void {
    if (this.status !== "loading") {
      return;
    }
    this.loadingPhase = "unknown";
    this.changeDetector.detectChanges();
    this.mountFrameRequest = globalThis.window?.requestAnimationFrame(() => {
      this.mountFrameRequest = null;
      this.attachPlayerFrame();
    }) ?? null;
  }

  private attachPlayerFrame(): void {
    if (this.status !== "loading") {
      return;
    }
    const frame = document.createElement("iframe");
    frame.className = "verona-player-frame";
    frame.id = "participantVeronaPlayerFrame";
    frame.title = this.unitTitle || this.unitKey || "Verona unit player";
    frame.setAttribute(
      "sandbox",
      "allow-scripts allow-forms allow-modals allow-downloads allow-popups"
    );
    frame.setAttribute("allow", "clipboard-read; clipboard-write");
    frame.setAttribute("referrerpolicy", "no-referrer");
    frame.setAttribute("srcdoc", this.playerHtml);
    frame.addEventListener(
      "load",
      () => {
        if (this.frame === frame && this.status === "loading") {
          this.loadingPhase = "complete";
        }
      },
      { once: true }
    );
    this.frameHost.nativeElement.replaceChildren(frame);
    this.frame = frame;
    this.readyTimeout = setTimeout(() => {
      if (this.status === "loading") {
        this.fail("The player did not send vopReadyNotification within 8 seconds.");
      }
    }, 8_000);
  }

  private handleReady(notification: unknown): void {
    if (this.status !== "loading" || this.startPlayerRequest != null) {
      return;
    }
    const apiVersion = readVeronaPlayerApiVersion(notification);
    if (!apiVersion) {
      this.fail("The player ready notification does not declare a Verona API version.");
      return;
    }
    if (!isSupportedVeronaPlayerApiVersion(apiVersion)) {
      this.fail(
        `Player uses Verona ${apiVersion}; supported major versions are ${SUPPORTED_VERONA_PLAYER_API_MAJOR_MIN}–${SUPPORTED_VERONA_PLAYER_API_MAJOR_MAX}.`
      );
      return;
    }

    this.clearReadyTimeout();
    this.loadingPhase = "complete";
    this.apiVersion = apiVersion;
    this.apiVersionLabel = `API ${apiVersion}`;
    this.startPlayerRequest = globalThis.window?.requestAnimationFrame(() => {
      this.startPlayerRequest = null;
      this.startPlayer();
    }) ?? null;
  }

  private startPlayer(): void {
    if (this.status !== "loading" || !this.frame?.contentWindow) {
      return;
    }
    this.status = "ready";
    const persistedResponse = parseVeronaUnitResponse(this.savedResponse);
    const command: VeronaStartCommand = {
      type: "vopStartCommand",
      sessionId: this.sessionId,
      unitDefinition: this.unitDefinition,
      ...(this.unitDefinitionType
        ? { unitDefinitionType: this.unitDefinitionType }
        : {}),
      unitState: prepareVeronaUnitStateForPlayer(
        persistedResponse?.unitState ?? {},
        this.apiVersion ?? String(SUPPORTED_VERONA_PLAYER_API_MAJOR_MAX),
        persistedResponse?.dataPartValueTypes
      ),
      ...(this.restoreCurrentPageOnReturn && persistedResponse?.playerState
        ? { playerState: persistedResponse.playerState }
        : {}),
      playerConfig: this.createPlayerConfig()
    };
    this.frame?.contentWindow?.postMessage(command, "*");
    this.status = "running";
    this.persistHostLog({
      key: "PLAYER",
      timeStamp: Date.now(),
      content: "RUNNING"
    }, this.savedResponse);
    if (this.hasPendingControllerRecovery()) {
      this.testLogEntries.emit([{
        key: "CONTROLLER",
        timeStamp: Date.now(),
        content: "RUNNING"
      }]);
    }
    this.controllerRecoveryTestRunId = null;
  }

  private handleNavigationRequest(
    notification: VeronaNavigationRequestedNotification
  ): void {
    const request = resolveVeronaNavigationRequest(
      notification,
      this.navigationUnits.map(unit => unit.unitKey)
    );
    if (!request) {
      this.sendNavigationDenied([]);
      return;
    }
    if (request.kind === "absolute") {
      const currentIndex = this.navigationUnits.findIndex(
        unit => unit.unitKey === this.unitKey
      );
      const targetIndex = this.navigationUnits.findIndex(
        unit => unit.unitKey === request.unitKey
      );
      const targetUnit = this.navigationUnits[targetIndex];
      const reasons =
        targetIndex >= 0 && targetIndex < currentIndex
          ? this.backwardDeniedReasons
          : this.forwardDeniedReasons;
      if (
        this.canNavigateUnits &&
        currentIndex >= 0 &&
        targetIndex >= 0 &&
        targetIndex !== currentIndex &&
        targetUnit &&
        !targetUnit.isLocked &&
        reasons.length === 0
      ) {
        this.navigationRequest.emit(`#${request.unitKey}`);
        return;
      }
      this.sendNavigationDenied(reasons);
      return;
    }

    const target = request.target;
    const targetEnabled =
      (target === "previous" && this.canGoPrevious) ||
      (target === "next" && this.canGoNext) ||
      (target === "first" && this.canGoPrevious) ||
      (target === "last" && this.canGoNext) ||
      (target === "end" && this.canComplete);
    if (targetEnabled) {
      this.navigationRequest.emit(target);
      return;
    }
    this.sendNavigationDenied(
      target === "previous" || target === "first"
        ? this.backwardDeniedReasons
        : this.forwardDeniedReasons
    );
  }

  private createPlayerConfig(): VeronaPlayerConfig {
    const persistedResponse = parseVeronaUnitResponse(this.savedResponse);
    const startPage = this.restoreCurrentPageOnReturn
      ? persistedResponse?.playerState?.currentPage
      : undefined;
    const enabledNavigationTargets: VeronaPlayerConfig["enabledNavigationTargets"] =
      [];
    if (this.canGoPrevious) {
      enabledNavigationTargets.push("previous", "first");
    }
    if (this.canGoNext) {
      enabledNavigationTargets.push("next", "last");
    }
    if (this.canComplete) {
      enabledNavigationTargets.push("end");
    }
    return {
      ...(this.resourceBasePath
        ? {
            directDownloadUrl: new URL(
              this.resourceBasePath,
              window.location.origin
            ).toString()
          }
        : {}),
      enabledNavigationTargets,
      logPolicy: this.logPolicy,
      pagingMode: this.pagingMode,
      stateReportPolicy: "eager",
      unitNumber: this.unitNumber,
      unitCount: this.unitCount,
      unitTitle: this.unitTitle,
      unitId: this.unitKey,
      sharedParameters: this.sharedParameters.map(parameter => ({
        key: parameter.key,
        value: parameter.value
      })),
      ...(startPage != null ? { startPage } : {})
    };
  }

  private updatePlayerConfig(): void {
    if (this.status !== "running" || !this.frame?.contentWindow) {
      return;
    }
    const notification: VeronaPlayerConfigChangedNotification = {
      type: "vopPlayerConfigChangedNotification",
      sessionId: this.sessionId,
      playerConfig: this.createPlayerConfig()
    };
    this.frame.contentWindow.postMessage(notification, "*");
  }

  goToRelativePage(offset: -1 | 1): void {
    const targetIndex = this.currentPageIndex + offset;
    const targetPage = this.pages[targetIndex];
    if (!targetPage || !this.frame?.contentWindow || this.status !== "running") {
      return;
    }
    this.currentPageIndex = targetIndex;
    const command: VeronaPageNavigationCommand = {
      type: "vopPageNavigationCommand",
      sessionId: this.sessionId,
      target: targetPage.id
    };
    this.frame.contentWindow.postMessage(command, "*");
  }

  private updatePageNavigation(
    playerState: VeronaPlayerState
  ): ParticipantTestLogEntryInput[] {
    const projection = projectVeronaPageState(playerState);
    this.pages = projection.pages;
    this.currentPageIndex = projection.currentPageIndex;
    return projection.logEntries;
  }

  private sendNavigationDenied(reasons: readonly string[]): void {
    if (!this.frame?.contentWindow) {
      return;
    }
    const reason: VeronaNavigationDeniedReason[] = [];
    if (reasons.includes("presentation_incomplete")) {
      reason.push("presentationIncomplete");
    }
    if (reasons.includes("response_incomplete")) {
      reason.push("responsesIncomplete");
    }
    const notification: VeronaNavigationDeniedNotification = {
      type: "vopNavigationDeniedNotification",
      sessionId: this.sessionId,
      reason
    };
    this.frame.contentWindow.postMessage(notification, "*");
  }

  private handleRuntimeError(codeValue: unknown, messageValue: unknown): void {
    const { code, message, entry } = this.normalizeRuntimeError(
      codeValue,
      messageValue
    );
    this.persistHostLog(entry);
    this.fail(
      [code, message].filter(Boolean).join(": ") ||
        "The player reported a runtime error."
    );
  }

  private persistHostLog(
    entry: ParticipantTestLogEntryInput,
    response = this.latestResponse
  ): void {
    this.logEntries.emit({
      testRunId: this.frameTestRunId,
      unitKey: this.frameUnitKey,
      entries: [entry]
    });
    this.responseUpdate.emit({
      testRunId: this.frameTestRunId,
      unitKey: this.frameUnitKey,
      response,
      unitDataChanged: false,
      unitStateChanged: false,
      playerStateChanged: false
    });
  }

  private retireCurrentFrame(): void {
    const frame = this.frame;
    const source = frame?.contentWindow;
    if (frame && source && this.frameSessionId) {
      this.retiredFrames.set(source, {
        sessionId: this.frameSessionId,
        testRunId: this.frameTestRunId,
        unitKey: this.frameUnitKey,
        latestResponse: this.latestResponse
      });
      globalThis.window?.setTimeout(() => {
        this.retiredFrames.delete(source);
      }, 1_500);
    }
    frame?.remove();
    this.frame = null;
  }

  private handleRetiredFrameNotification(
    frame: RetiredVeronaFrame,
    notification: ReturnType<typeof parseVeronaIncomingNotification>
  ): void {
    if (
      notification?.type === "vopRuntimeErrorNotification" &&
      (!notification.sessionId || notification.sessionId === frame.sessionId)
    ) {
      const { entry } = this.normalizeRuntimeError(
        notification.code,
        notification.message
      );
      this.logEntries.emit({
        testRunId: frame.testRunId,
        unitKey: frame.unitKey,
        entries: [entry]
      });
      this.responseUpdate.emit({
        testRunId: frame.testRunId,
        unitKey: frame.unitKey,
        response: frame.latestResponse,
        unitDataChanged: false,
        unitStateChanged: false,
        playerStateChanged: false
      });
      return;
    }
    if (
      !notification ||
      notification.type !== "vopStateChangedNotification" ||
      notification.sessionId !== frame.sessionId
    ) {
      return;
    }
    const logEntries: ParticipantTestLogEntryInput[] = [];
    if (notification.playerState !== undefined) {
      logEntries.push(
        ...projectVeronaPageState(notification.playerState).logEntries
      );
    }
    if (notification.unitState !== undefined) {
      logEntries.push(...projectVeronaUnitStateLogs(notification.unitState));
    }
    if (Array.isArray(notification.log)) {
      logEntries.push(...normalizeVeronaStateLogEntries(notification.log));
    }
    if (logEntries.length > 0) {
      this.logEntries.emit({
        testRunId: frame.testRunId,
        unitKey: frame.unitKey,
        entries: logEntries
      });
    }
    frame.latestResponse = mergeVeronaUnitResponse(frame.latestResponse, {
      unitState: notification.unitState,
      playerState: notification.playerState
    });
    this.responseUpdate.emit({
      testRunId: frame.testRunId,
      unitKey: frame.unitKey,
      response: frame.latestResponse,
      unitDataChanged:
        notification.unitState != null &&
        Object.prototype.hasOwnProperty.call(notification.unitState, "dataParts"),
      unitStateChanged:
        notification.unitState != null &&
        Object.keys(notification.unitState).some(key => key !== "dataParts"),
      playerStateChanged: notification.playerState !== undefined
    });
  }

  private normalizeRuntimeError(
    codeValue: unknown,
    messageValue: unknown
  ): {
    code: string;
    message: string;
    entry: ParticipantTestLogEntryInput;
  } {
    const code =
      typeof codeValue === "string" && codeValue.trim()
        ? codeValue.trim().slice(0, 180)
        : "runtime-error";
    const message =
      typeof messageValue === "string"
        ? messageValue.trim().slice(0, 32_768)
        : "";
    return {
      code,
      message,
      entry: {
        key: `Runtime Error: ${code}`,
        timeStamp: Date.now(),
        content: message
      }
    };
  }

  private scheduleFocusLog(playerHasFocus?: boolean): void {
    if (this.status !== "running") {
      return;
    }
    this.pendingPlayerHasFocus = playerHasFocus;
    this.clearFocusLogTimeout(false);
    this.focusLogTimeout = setTimeout(() => {
      this.focusLogTimeout = null;
      const hasApplicationFocus =
        this.pendingPlayerHasFocus === true ||
        (!document.hidden && document.hasFocus());
      this.pendingPlayerHasFocus = undefined;
      const content = hasApplicationFocus ? "HAS" : "HAS_NOT";
      if (content === this.lastFocusLogContent) {
        return;
      }
      this.lastFocusLogContent = content;
      this.testLogEntries.emit([{
        key: "FOCUS",
        timeStamp: Date.now(),
        content
      }]);
    }, 500);
  }

  private fail(message: string): void {
    this.clearReadyTimeout();
    this.clearScheduledFrames();
    this.status = "error";
    this.errorMessage = message;
    if (!this.controllerErrorLoggedForFrame) {
      this.controllerErrorLoggedForFrame = true;
      this.controllerRecoveryTestRunId = this.frameTestRunId;
      try {
        globalThis.window?.sessionStorage.setItem(
          controllerRecoveryStorageKey,
          this.frameTestRunId
        );
      } catch {
        // Recovery logging still works for an in-page Player reload.
      }
      this.testLogEntries.emit([{
        key: "CONTROLLER",
        timeStamp: Date.now(),
        content: "ERROR"
      }]);
      this.controllerError.emit({
        testRunId: this.frameTestRunId,
        unitKey: this.frameUnitKey,
        message
      });
    }
  }

  private hasPendingControllerRecovery(): boolean {
    let persistedTestRunId = "";
    try {
      persistedTestRunId =
        globalThis.window?.sessionStorage.getItem(
          controllerRecoveryStorageKey
        ) ?? "";
      if (persistedTestRunId === this.frameTestRunId) {
        globalThis.window?.sessionStorage.removeItem(
          controllerRecoveryStorageKey
        );
      }
    } catch {
      // Session storage can be unavailable under restrictive browser policies.
    }
    return (
      this.controllerRecoveryTestRunId === this.frameTestRunId ||
      persistedTestRunId === this.frameTestRunId
    );
  }

  private clearReadyTimeout(): void {
    if (this.readyTimeout) {
      clearTimeout(this.readyTimeout);
      this.readyTimeout = null;
    }
  }

  private clearScheduledFrames(): void {
    if (this.mountFrameRequest != null) {
      globalThis.window?.cancelAnimationFrame(this.mountFrameRequest);
      this.mountFrameRequest = null;
    }
    if (this.startPlayerRequest != null) {
      globalThis.window?.cancelAnimationFrame(this.startPlayerRequest);
      this.startPlayerRequest = null;
    }
  }

  private clearFocusLogTimeout(clearPendingState = true): void {
    if (this.focusLogTimeout) {
      clearTimeout(this.focusLogTimeout);
      this.focusLogTimeout = null;
    }
    if (clearPendingState) {
      this.pendingPlayerHasFocus = undefined;
    }
  }
}
