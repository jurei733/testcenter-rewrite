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
        <span id="participantVeronaSaveStatus">{{ saveStatus }}</span>
        <button
          *ngIf="saveStatus === 'save_failed'"
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
  @Input() savedResponse = "";
  @Input() unitNumber = 1;
  @Input() canGoPrevious = false;
  @Input() canGoNext = false;
  @Input() canComplete = false;
  @Input() saveStatus = "not_saved";

  @Output() readonly responseChange = new EventEmitter<string>();
  @Output() readonly navigationRequest = new EventEmitter<string>();
  @Output() readonly retrySave = new EventEmitter<void>();

  status: "loading" | "ready" | "running" | "error" = "loading";
  apiVersionLabel = "Waiting for player";
  errorMessage = "";

  private frame: HTMLIFrameElement | null = null;
  private readyTimeout: ReturnType<typeof setTimeout> | null = null;
  private viewReady = false;

  private get sessionId(): string {
    return `${this.testRunId}:${this.unitKey}`;
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
        changes["unitDefinitionType"])
    ) {
      this.mountPlayer();
    }
  }

  ngOnDestroy(): void {
    this.clearReadyTimeout();
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
    if (
      notification.sessionId &&
      notification.sessionId !== this.sessionId
    ) {
      this.fail(
        `Player sent a message for unexpected session '${notification.sessionId}'.`
      );
      return;
    }

    switch (notification.type) {
      case "vopStateChangedNotification":
        this.status = "running";
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
      case "vopRuntimeErrorNotification":
        this.fail(
          [notification.code, notification.message]
            .filter(Boolean)
            .join(": ") || "The player reported a runtime error."
        );
        break;
    }
  }

  private mountPlayer(): void {
    this.clearReadyTimeout();
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
    const startPage = persistedResponse?.playerState?.currentPage;
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
        enabledNavigationTargets,
        logPolicy: "lean",
        pagingMode: "separate",
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
    if (["previous", "next", "first", "last", "end"].includes(target)) {
      this.navigationRequest.emit(target);
    }
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
}
