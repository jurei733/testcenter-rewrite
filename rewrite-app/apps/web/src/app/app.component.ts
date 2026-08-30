import { CommonModule } from "@angular/common";
import {
  ChangeDetectorRef,
  Component,
  effect,
  inject,
  signal
} from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import {
  NavigationEnd,
  Router,
  RouterLink,
  RouterLinkActive,
  RouterOutlet
} from "@angular/router";

import { ActivityFeedComponent } from "./activity-feed.component";
import { ApplicationSettingsService } from "./application-settings.service";
import { AppShellFacade } from "./app-shell.facade";
import { BugReportDialogComponent } from "./bug-report-dialog.component";
import { BugReportService } from "./bug-report.service";
import { ConfirmationDialogComponent } from "./confirmation-dialog.component";
import { ConfirmationDialogService } from "./confirmation-dialog.service";
import { LiveContextComponent } from "./live-context.component";
import { ParticipantShellStateService } from "./participant-shell-state.service";
import type { AppView } from "./rewrite-app-shell.types";
import { SummaryCardsComponent } from "./summary-cards.component";

const routeViews: AppView[] = [
  "home",
  "workspace",
  "content",
  "runtime",
  "participant",
  "system-check",
  "ops"
];

@Component({
  selector: "app-root",
  standalone: true,
  imports: [
    CommonModule,
    RouterOutlet,
    RouterLink,
    RouterLinkActive,
    SummaryCardsComponent,
    ActivityFeedComponent,
    BugReportDialogComponent,
    ConfirmationDialogComponent,
    LiveContextComponent
  ],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css"
})
export class AppComponent implements OnInit, OnDestroy {
  readonly app = inject(AppShellFacade);
  readonly applicationSettings = inject(ApplicationSettingsService);
  readonly bugReports = inject(BugReportService);
  readonly confirmation = inject(ConfirmationDialogService);
  readonly participantShell = inject(ParticipantShellStateService);
  readonly isOffline = signal(!navigator.onLine);
  requiredAdminPassword = "";
  requiredAdminPasswordConfirmation = "";
  requiredAdminPasswordError = "";
  ownAdminPasswordDialogOpen = false;
  currentAdminPassword = "";
  ownAdminPassword = "";
  ownAdminPasswordConfirmation = "";
  ownAdminPasswordError = "";
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly router = inject(Router);
  private readonly routeVersion = signal(0);
  private readonly routerEventsSubscription = this.router.events.subscribe(
    event => {
      if (event instanceof NavigationEnd) {
        queueMicrotask(() =>
          this.routeVersion.update(version => version + 1)
        );
      }
    }
  );
  private readonly operatorHero = signal(this.resolveOperatorHero());
  private readonly synchronizeOperatorHero = effect(() => {
    const next = this.resolveOperatorHero();
    queueMicrotask(() => this.operatorHero.set(next));
  });
  private readonly onlineListener = (): void => {
    this.isOffline.set(false);
  };
  private readonly offlineListener = (): void => {
    this.isOffline.set(true);
  };

  get isParticipantView(): boolean {
    return (
      this.activeRouteView === "participant" ||
      this.activeRouteView === "system-check" ||
      this.isAttachmentCaptureView ||
      this.isPublicInfoView
    );
  }

  get adminPasswordMinimumLength(): number {
    return this.app.adminPasswordMinimumLength;
  }

  get adminPasswordMaximumLength(): number {
    return this.app.adminPasswordMaximumLength;
  }

  get adminPasswordPattern(): string {
    return this.app.adminPasswordPattern;
  }

  get isHomeView(): boolean {
    return this.activeRouteView === "home";
  }

  get isSignedOutOpsView(): boolean {
    return this.activeRouteView === "ops" && !this.app.hasAdminSession;
  }

  get activeRouteView(): AppView {
    this.routeVersion();
    const routeSegment = this.router.url.split("?", 1)[0]?.split("/")[1];
    return routeViews.find(view => view === routeSegment) ?? this.app.activeView;
  }

  get isFocusedEntryView(): boolean {
    return this.operatorHero().focused;
  }

  get operatorHeroEyebrow(): string {
    return this.operatorHero().eyebrow;
  }

  get operatorHeroTitle(): string {
    return this.operatorHero().title;
  }

  get operatorHeroDetail(): string {
    return this.operatorHero().detail;
  }

  private resolveOperatorHero(): {
    focused: boolean;
    eyebrow: string;
    title: string;
    detail: string;
  } {
    if (this.isHomeView) {
      return {
        focused: true,
        eyebrow: "Assessment delivery",
        title: "Run, Monitor, And Manage Assessments.",
        detail:
          "Choose a participant, system-check, or protected operator entry point. The application keeps each workflow focused while sharing one production runtime."
      };
    }
    if (this.isSignedOutOpsView) {
      return {
        focused: true,
        eyebrow: "Operator access",
        title: "Sign In To Continue.",
        detail:
          "Administrative and monitoring tools stay private until an authorized operator session has been established."
      };
    }
    if (this.app.isMonitorOnlySession) {
      return {
        focused: false,
        eyebrow: this.app.operatorAccessLabel,
        title: "Monitor The Active Test Session.",
        detail:
          "This console is limited to the assigned monitor scope and exposes only live runs and permitted monitor controls."
      };
    }
    if (this.app.isReadOnlyAdminSession) {
      return {
        focused: false,
        eyebrow: this.app.operatorAccessLabel,
        title: "Inspect The Workspace Without Changing It.",
        detail:
          "This workspace administrator session can inspect operational data and exports. Changes require an RW role assignment."
      };
    }
    return {
      focused: false,
      eyebrow: "Operator workspace",
      title: "Operate The Assessment Workspace.",
      detail:
        "Manage workspace content, participant delivery, monitoring, results, and operational diagnostics from the protected Angular console."
    };
  }

  get isParticipantHeaderHidden(): boolean {
    return (
      this.activeRouteView === "participant" &&
      this.participantShell.headerHidden()
    );
  }

  leaveParticipantSession(): void {
    this.participantShell.setHeaderHidden(false);
    globalThis.dispatchEvent(new CustomEvent("participant-leave-session"));
  }

  openErrorReport(): void {
    this.bugReports.openForMessage(
      this.app.errorMessage() ?? "Unknown application error",
      this.app.ops.buildRef
    );
  }

  get isAttachmentCaptureView(): boolean {
    return this.router.url.split("?", 1)[0] === "/attachment-capture";
  }

  get isPublicInfoView(): boolean {
    return ["/legal-notice", "/privacy", "/accessibility"].includes(
      this.router.url.split("?", 1)[0] ?? ""
    );
  }

  get publicInfoTitle(): string {
    const path = this.router.url.split("?", 1)[0];
    return path === "/privacy"
      ? "Privacy"
      : path === "/accessibility"
        ? "Accessibility"
        : "Legal Notice";
  }

  async ngOnInit(): Promise<void> {
    window.addEventListener("online", this.onlineListener);
    window.addEventListener("offline", this.offlineListener);
    void this.applicationSettings.load().catch(() => undefined);
    const legacyParticipantLogin = this.getLegacyParticipantLoginFromHash();
    if (legacyParticipantLogin) {
      this.app.init("participant");
      await this.router.navigate(["/participant"], {
        queryParams: {
          tenantKey: "",
          workspaceKey: "",
          loginKey: legacyParticipantLogin,
          legacyShortLink: "true"
        },
        replaceUrl: true
      });
      return;
    }
    const initialView = this.getInitialViewFromLocation();
    const isApplicationRoot = this.router.url === "/" || this.router.url === "";
    this.app.init(initialView ?? (isApplicationRoot ? "home" : null));
    if (!initialView && isApplicationRoot) {
      await this.router.navigateByUrl("/home", {
        replaceUrl: true
      });
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener("online", this.onlineListener);
    window.removeEventListener("offline", this.offlineListener);
    this.routerEventsSubscription.unsubscribe();
  }

  get canSubmitRequiredAdminPassword(): boolean {
    return (
      this.app.getAdminPasswordViolation(this.requiredAdminPassword) === null &&
      this.requiredAdminPassword === this.requiredAdminPasswordConfirmation &&
      this.app.activeRequestLabel() === null
    );
  }

  async submitRequiredAdminPassword(): Promise<void> {
    if (!this.canSubmitRequiredAdminPassword) {
      this.requiredAdminPasswordError =
        this.describeAdminPasswordViolation(this.requiredAdminPassword) ??
        "The password confirmation does not match.";
      return;
    }
    this.requiredAdminPasswordError = "";
    try {
      await this.app.changeRequiredAdminPassword(this.requiredAdminPassword);
      this.requiredAdminPassword = "";
      this.requiredAdminPasswordConfirmation = "";
      this.changeDetector.detectChanges();
    } catch {
      this.requiredAdminPasswordError =
        "The password could not be changed. Check the connection and try again.";
      this.changeDetector.detectChanges();
    }
  }

  updateRequiredAdminPassword(event: Event): void {
    this.requiredAdminPassword = (event.target as HTMLInputElement).value;
    this.requiredAdminPasswordError = "";
  }

  updateRequiredAdminPasswordConfirmation(event: Event): void {
    this.requiredAdminPasswordConfirmation = (
      event.target as HTMLInputElement
    ).value;
    this.requiredAdminPasswordError = "";
  }

  async signOutRequiredAdmin(): Promise<void> {
    try {
      await this.app.signOutRequiredAdmin();
    } finally {
      this.requiredAdminPassword = "";
      this.requiredAdminPasswordConfirmation = "";
      this.requiredAdminPasswordError = "";
      this.changeDetector.detectChanges();
      await this.router.navigateByUrl("/ops", { replaceUrl: true });
    }
  }

  async signOutAdmin(): Promise<void> {
    try {
      await this.app.signOutAdmin();
    } finally {
      this.ownAdminPasswordDialogOpen = false;
      this.clearOwnAdminPasswordDialog();
      this.changeDetector.detectChanges();
      await this.router.navigateByUrl("/ops", { replaceUrl: true });
    }
  }

  get canSubmitOwnAdminPassword(): boolean {
    return (
      this.currentAdminPassword.length > 0 &&
      this.currentAdminPassword.length <= this.adminPasswordMaximumLength &&
      this.app.getAdminPasswordViolation(this.ownAdminPassword) === null &&
      this.ownAdminPassword === this.ownAdminPasswordConfirmation &&
      this.app.activeRequestLabel() === null
    );
  }

  openOwnAdminPasswordDialog(): void {
    this.clearOwnAdminPasswordDialog();
    this.ownAdminPasswordDialogOpen = true;
  }

  closeOwnAdminPasswordDialog(): void {
    if (this.app.activeRequestLabel() !== null) {
      return;
    }
    this.ownAdminPasswordDialogOpen = false;
    this.clearOwnAdminPasswordDialog();
  }

  updateCurrentAdminPassword(event: Event): void {
    this.currentAdminPassword = (event.target as HTMLInputElement).value;
    this.ownAdminPasswordError = "";
  }

  updateOwnAdminPassword(event: Event): void {
    this.ownAdminPassword = (event.target as HTMLInputElement).value;
    this.ownAdminPasswordError = "";
  }

  updateOwnAdminPasswordConfirmation(event: Event): void {
    this.ownAdminPasswordConfirmation = (event.target as HTMLInputElement).value;
    this.ownAdminPasswordError = "";
  }

  async submitOwnAdminPassword(): Promise<void> {
    if (!this.canSubmitOwnAdminPassword) {
      this.ownAdminPasswordError =
        this.currentAdminPassword.length === 0
          ? "Enter the current password."
          : this.currentAdminPassword.length > this.adminPasswordMaximumLength
            ? "The current password is invalid."
            : this.describeAdminPasswordViolation(this.ownAdminPassword) ??
              "The password confirmation does not match.";
      return;
    }
    this.ownAdminPasswordError = "";
    try {
      await this.app.changeOwnAdminPassword(
        this.currentAdminPassword,
        this.ownAdminPassword
      );
      this.ownAdminPasswordDialogOpen = false;
      this.clearOwnAdminPasswordDialog();
    } catch {
      this.ownAdminPasswordError =
        "The password could not be changed. Check the current password and try again.";
    } finally {
      this.changeDetector.detectChanges();
    }
  }

  private clearOwnAdminPasswordDialog(): void {
    this.currentAdminPassword = "";
    this.ownAdminPassword = "";
    this.ownAdminPasswordConfirmation = "";
    this.ownAdminPasswordError = "";
  }

  private describeAdminPasswordViolation(password: string): string | null {
    const violation = this.app.getAdminPasswordViolation(password);
    if (violation === "minimum_length") {
      return `The new password must contain at least ${this.adminPasswordMinimumLength} characters.`;
    }
    if (violation === "maximum_length") {
      return `The new password must contain no more than ${this.adminPasswordMaximumLength} characters.`;
    }
    if (violation === "pattern") {
      return `The new password must match the configured pattern ${this.adminPasswordPattern}.`;
    }
    return null;
  }

  trackOperatorAccountAccess(
    _index: number,
    access: { role: string; scope: string }
  ): string {
    return `${access.role}\u0000${access.scope}`;
  }

  private getInitialViewFromLocation(): AppView | null {
    const routeSegment = window.location.pathname
      .replace(/^\/app\/?/, "")
      .split("/")
      .at(0);
    return routeViews.find(view => view === routeSegment) ?? null;
  }

  private getLegacyParticipantLoginFromHash(): string | null {
    const match = /^#\/([^/?#]+)\/?$/.exec(window.location.hash);
    if (!match?.[1]) {
      return null;
    }

    try {
      const loginKey = decodeURIComponent(match[1]).trim();
      return loginKey && !loginKey.includes("/") ? loginKey : null;
    } catch {
      return null;
    }
  }
}
