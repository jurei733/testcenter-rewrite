import { CommonModule } from "@angular/common";
import { ChangeDetectorRef, Component, inject, signal } from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";

import { adminPasswordPolicy } from "@testcenter-rewrite-app/contracts";

import { ActivityFeedComponent } from "./activity-feed.component";
import { ApplicationSettingsService } from "./application-settings.service";
import { AppShellFacade } from "./app-shell.facade";
import { BrowserCompatibilityService } from "./browser-compatibility.service";
import { ConfirmationDialogComponent } from "./confirmation-dialog.component";
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
    ConfirmationDialogComponent,
    LiveContextComponent
  ],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css"
})
export class AppComponent implements OnInit, OnDestroy {
  readonly app = inject(AppShellFacade);
  readonly applicationSettings = inject(ApplicationSettingsService);
  readonly browserCompatibility = inject(BrowserCompatibilityService);
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
  readonly adminPasswordMinimumLength = adminPasswordPolicy.minimumLength;
  readonly adminPasswordMaximumLength = adminPasswordPolicy.maximumLength;
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly router = inject(Router);
  private readonly onlineListener = (): void => {
    this.isOffline.set(false);
  };
  private readonly offlineListener = (): void => {
    this.isOffline.set(true);
  };

  get isParticipantView(): boolean {
    return (
      this.app.activeView === "participant" ||
      this.app.activeView === "system-check" ||
      this.isAttachmentCaptureView ||
      this.isLegalNoticeView
    );
  }

  get isHomeView(): boolean {
    return this.app.activeView === "home";
  }

  get isSignedOutOpsView(): boolean {
    return this.app.activeView === "ops" && !this.app.hasAdminSession;
  }

  get isFocusedEntryView(): boolean {
    return this.isHomeView || this.isSignedOutOpsView;
  }

  get operatorHeroEyebrow(): string {
    if (this.isHomeView) {
      return "Assessment delivery";
    }
    if (this.isSignedOutOpsView) {
      return "Operator access";
    }
    if (this.app.isMonitorOnlySession || this.app.isReadOnlyAdminSession) {
      return this.app.operatorAccessLabel;
    }
    return "Operator workspace";
  }

  get operatorHeroTitle(): string {
    if (this.isHomeView) {
      return "Run, Monitor, And Manage Assessments.";
    }
    if (this.isSignedOutOpsView) {
      return "Sign In To Continue.";
    }
    if (this.app.isMonitorOnlySession) {
      return "Monitor The Active Test Session.";
    }
    if (this.app.isReadOnlyAdminSession) {
      return "Inspect The Workspace Without Changing It.";
    }
    return "Operate The Assessment Workspace.";
  }

  get operatorHeroDetail(): string {
    if (this.isHomeView) {
      return "Choose a participant, system-check, or protected operator entry point. The application keeps each workflow focused while sharing one production runtime.";
    }
    if (this.isSignedOutOpsView) {
      return "Administrative and monitoring tools stay private until an authorized operator session has been established.";
    }
    if (this.app.isMonitorOnlySession) {
      return "This console is limited to the assigned monitor scope and exposes only live runs and permitted monitor controls.";
    }
    if (this.app.isReadOnlyAdminSession) {
      return "This workspace administrator session can inspect operational data and exports. Changes require an RW role assignment.";
    }
    return "Manage workspace content, participant delivery, monitoring, results, and operational diagnostics from the protected Angular console.";
  }

  get isParticipantHeaderHidden(): boolean {
    return (
      this.app.activeView === "participant" &&
      this.participantShell.headerHidden()
    );
  }

  leaveParticipantSession(): void {
    this.participantShell.setHeaderHidden(false);
    globalThis.dispatchEvent(new CustomEvent("participant-leave-session"));
  }

  get isAttachmentCaptureView(): boolean {
    return this.router.url.split("?", 1)[0] === "/attachment-capture";
  }

  get isLegalNoticeView(): boolean {
    return this.router.url.split("?", 1)[0] === "/legal-notice";
  }

  async ngOnInit(): Promise<void> {
    window.addEventListener("online", this.onlineListener);
    window.addEventListener("offline", this.offlineListener);
    void this.applicationSettings.load().catch(() => undefined);
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
  }

  get canSubmitRequiredAdminPassword(): boolean {
    return (
      this.requiredAdminPassword.length >= adminPasswordPolicy.minimumLength &&
      this.requiredAdminPassword.length <= adminPasswordPolicy.maximumLength &&
      this.requiredAdminPassword === this.requiredAdminPasswordConfirmation &&
      this.app.activeRequestLabel() === null
    );
  }

  async submitRequiredAdminPassword(): Promise<void> {
    if (!this.canSubmitRequiredAdminPassword) {
      this.requiredAdminPasswordError =
        this.requiredAdminPassword.length < adminPasswordPolicy.minimumLength
          ? `The new password must contain at least ${adminPasswordPolicy.minimumLength} characters.`
          : this.requiredAdminPassword.length > adminPasswordPolicy.maximumLength
            ? `The new password must contain no more than ${adminPasswordPolicy.maximumLength} characters.`
            : "The password confirmation does not match.";
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
      this.currentAdminPassword.length <= adminPasswordPolicy.maximumLength &&
      this.ownAdminPassword.length >= adminPasswordPolicy.minimumLength &&
      this.ownAdminPassword.length <= adminPasswordPolicy.maximumLength &&
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
          : this.currentAdminPassword.length > adminPasswordPolicy.maximumLength
            ? "The current password is invalid."
            : this.ownAdminPassword.length < adminPasswordPolicy.minimumLength
              ? `The new password must contain at least ${adminPasswordPolicy.minimumLength} characters.`
              : this.ownAdminPassword.length > adminPasswordPolicy.maximumLength
                ? `The new password must contain no more than ${adminPasswordPolicy.maximumLength} characters.`
                : "The password confirmation does not match.";
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

  private getInitialViewFromLocation(): AppView | null {
    const routeSegment = window.location.pathname
      .replace(/^\/app\/?/, "")
      .split("/")
      .at(0);
    return routeViews.find(view => view === routeSegment) ?? null;
  }
}
