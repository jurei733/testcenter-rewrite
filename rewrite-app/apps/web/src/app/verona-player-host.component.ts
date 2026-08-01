import { CommonModule } from "@angular/common";
import {
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
  parseVeronaIncomingNotification,
  parseVeronaUnitResponse,
  readVeronaPlayerApiVersion,
  serializeVeronaUnitResponse,
  SUPPORTED_VERONA_PLAYER_API_MAJOR_MAX,
  SUPPORTED_VERONA_PLAYER_API_MAJOR_MIN,
  type VeronaNavigationRequestedNotification,
  type VeronaStartCommand
} from "@testcenter-rewrite-app/contracts";
import type { ParticipantTestLogEntryInput } from "@testcenter-rewrite-app/domain";

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
      <div #frameHost class="verona-player-frame-host" id="participantVeronaFrameHost"></div>
      <section
        *ngIf="errorMessage"
        class="verona-player-error"
        id="participantVeronaPlayerError"
        role="alert"
      >
        <strong>Player could not start</strong>
        <p>{{ errorMessage }}</p>
        <button type="button" class="secondary" (click)="reload()">Reload Player</button>
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
  @Input() unitNumber = 1;
  @Input() canGoPrevious = false;
  @Input() canGoNext = false;
  @Input() canComplete = false;
  @Input() logPolicy: "disabled" | "lean" | "rich" | "debug" = "rich";
  @Input() pagingMode: "separate" | "concat-scroll" | "concat-scroll-snap" =
    "separate";
  @Input() restoreCurrentPageOnReturn = false;
  @Input() saveStatus = "not_saved";

  @Output() readonly responseChange = new EventEmitter<string>();
  @Output() readonly logEntries =
    new EventEmitter<ParticipantTestLogEntryInput[]>();
  @Output() readonly focusLogEntries =
    new EventEmitter<ParticipantTestLogEntryInput[]>();
  @Output() readonly navigationRequest = new EventEmitter<string>();
  @Output() readonly retrySave = new EventEmitter<void>();

  status: "loading" | "ready" | "running" | "error" = "loading";
  apiVersionLabel = "Waiting for player";
  errorMessage = "";

  private frame: HTMLIFrameElement | null = null;
  private readyTimeout: ReturnType<typeof setTimeout> | null = null;
  private focusLogTimeout: ReturnType<typeof setTimeout> | null = null;
  private pendingPlayerHasFocus: boolean | undefined;
  private lastFocusLogContent: "HAS" | "HAS_NOT" | null = null;
  private viewReady = false;

  private get sessionId(): string {
    return `${this.testRunId}:${this.unitKey}`;
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

  ngAfterViewInit(): void {
    this.viewReady = true;
    this.mountPlayer();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (
      this.viewReady &&
      (changes["playerHtml"] ||
        changes["playerKey"] ||
        changes["testRunId"] ||
        changes["unitKey"] ||
        changes["unitDefinition"] ||
        changes["unitDefinitionType"] ||
        changes["resourceBasePath"] ||
        changes["canGoPrevious"] ||
        changes["canGoNext"] ||
        changes["canComplete"] ||
        changes["logPolicy"] ||
        changes["pagingMode"] ||
        changes["restoreCurrentPageOnReturn"])
    ) {
      this.mountPlayer();
    }
  }

  ngOnDestroy(): void {
    this.clearReadyTimeout();
    this.clearFocusLogTimeout();
    this.frame?.remove();
    this.frame = null;
  }

  reload(): void {
    this.mountPlayer();
  }

  @HostListener("window:message", ["$event"])
  onWindowMessage(event: MessageEvent): void {
    if (!this.frame?.contentWindow || event.source !== this.frame.contentWindow) {
      return;
    }
    const notification = parseVeronaIncomingNotification(event.data);
    if (!notification) {
      return;
    }

    if (notification.type === "vopReadyNotification") {
      this.handleReady(notification);
      return;
    }
    const notificationSessionId =
      "sessionId" in notification ? notification.sessionId : undefined;
    if (notificationSessionId && notificationSessionId !== this.sessionId) {
      this.fail(
        `Player sent a message for unexpected session '${notificationSessionId}'.`
      );
      return;
    }

    switch (notification.type) {
      case "vopStateChangedNotification":
        this.status = "running";
        if (Array.isArray(notification.log)) {
          const logEntries = notification.log.flatMap(entry => {
            const key = typeof entry?.key === "string" ? entry.key.trim() : "";
            const timeStamp = Number(entry?.timeStamp);
            const content = entry.content == null ? "" : String(entry.content);
            if (
              !key ||
              key.length > 200 ||
              content.length > 32_768 ||
              !Number.isSafeInteger(timeStamp) ||
              timeStamp < 0 ||
              timeStamp > 8_640_000_000_000_000
            ) {
              return [];
            }
            return [{
              key,
              timeStamp,
              content
            } satisfies ParticipantTestLogEntryInput];
          }).slice(-200);
          if (logEntries.length > 0) {
            this.logEntries.emit(logEntries);
          }
        }
        this.responseChange.emit(
          serializeVeronaUnitResponse({
            unitState: notification.unitState,
            playerState: notification.playerState
          })
        );
        break;
      case "vopUnitNavigationRequestedNotification":
        this.handleNavigationRequest(notification);
        break;
      case "vopWindowFocusChangedNotification":
        this.scheduleFocusLog(notification.hasFocus);
        break;
      case "vopRuntimeErrorNotification":
        this.fail(
          [notification.code, notification.message]
            .filter(Boolean)
            .join(": ") || "The player reported a runtime error."
        );
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
    this.clearFocusLogTimeout();
    this.frame?.remove();
    this.frame = null;
    this.status = "loading";
    this.apiVersionLabel = "Waiting for player";
    this.errorMessage = "";

    if (!this.playerHtml.trim() || !this.unitDefinition.trim()) {
      this.fail("The release does not contain both player HTML and a unit definition.");
      return;
    }

    const frame = document.createElement("iframe");
    frame.className = "verona-player-frame";
    frame.id = "participantVeronaPlayerFrame";
    frame.title = this.unitTitle || this.unitKey || "Verona unit player";
    frame.setAttribute("sandbox", "allow-scripts allow-forms allow-modals");
    frame.setAttribute("referrerpolicy", "no-referrer");
    frame.setAttribute("srcdoc", this.playerHtml);
    this.frameHost.nativeElement.replaceChildren(frame);
    this.frame = frame;
    this.readyTimeout = setTimeout(() => {
      if (this.status === "loading") {
        this.fail("The player did not send vopReadyNotification within 8 seconds.");
      }
    }, 8_000);
  }

  private handleReady(notification: unknown): void {
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
    this.status = "ready";
    this.apiVersionLabel = `API ${apiVersion}`;
    const persistedResponse = parseVeronaUnitResponse(this.savedResponse);
    const startPage = this.restoreCurrentPageOnReturn
      ? persistedResponse?.playerState?.currentPage
      : undefined;
    const enabledNavigationTargets: VeronaStartCommand["playerConfig"]["enabledNavigationTargets"] = [];
    if (this.canGoPrevious) {
      enabledNavigationTargets.push("previous");
    }
    if (this.canGoNext) {
      enabledNavigationTargets.push("next");
    }
    if (this.canComplete) {
      enabledNavigationTargets.push("end");
    }
    const command: VeronaStartCommand = {
      type: "vopStartCommand",
      sessionId: this.sessionId,
      unitDefinition: this.unitDefinition,
      ...(this.unitDefinitionType
        ? { unitDefinitionType: this.unitDefinitionType }
        : {}),
      unitState: persistedResponse?.unitState ?? {},
      playerConfig: {
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
        unitTitle: this.unitTitle,
        unitId: this.unitKey,
        ...(startPage != null ? { startPage } : {})
      }
    };
    this.frame?.contentWindow?.postMessage(command, "*");
    this.status = "running";
  }

  private handleNavigationRequest(
    notification: VeronaNavigationRequestedNotification
  ): void {
    const target = (notification.target ?? notification.targetRelative ?? "")
      .replace(/^#/, "")
      .trim()
      .toLowerCase();
    const targetEnabled =
      (target === "previous" && this.canGoPrevious) ||
      (target === "next" && this.canGoNext) ||
      (target === "first" && this.canGoPrevious) ||
      (target === "last" && this.canGoNext) ||
      (target === "end" && this.canComplete);
    if (targetEnabled) {
      this.navigationRequest.emit(target);
    }
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
      this.focusLogEntries.emit([{
        key: "FOCUS",
        timeStamp: Date.now(),
        content
      }]);
    }, 500);
  }

  private fail(message: string): void {
    this.clearReadyTimeout();
    this.status = "error";
    this.errorMessage = message;
  }

  private clearReadyTimeout(): void {
    if (this.readyTimeout) {
      clearTimeout(this.readyTimeout);
      this.readyTimeout = null;
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
