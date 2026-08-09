import { CommonModule } from "@angular/common";
import { ChangeDetectorRef, Component, inject } from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";

import { adminPasswordPolicy } from "@testcenter-rewrite-app/contracts";

import { ActivityFeedComponent } from "./activity-feed.component";
import { ApplicationSettingsService } from "./application-settings.service";
import { AppShellFacade } from "./app-shell.facade";
import { BrowserCompatibilityService } from "./browser-compatibility.service";
import { LiveContextComponent } from "./live-context.component";
import type { AppView } from "./rewrite-app-shell.types";
import { SummaryCardsComponent } from "./summary-cards.component";

const routeViews: AppView[] = [
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
    LiveContextComponent
  ],
  templateUrl: "./app.component.html",
  styleUrl: "./app.component.css"
})
export class AppComponent implements OnInit, OnDestroy {
  readonly app = inject(AppShellFacade);
  readonly applicationSettings = inject(ApplicationSettingsService);
  readonly browserCompatibility = inject(BrowserCompatibilityService);
  isOffline = !navigator.onLine;
  requiredAdminPassword = "";
  requiredAdminPasswordConfirmation = "";
  requiredAdminPasswordError = "";
  readonly adminPasswordMinimumLength = adminPasswordPolicy.minimumLength;
  readonly adminPasswordMaximumLength = adminPasswordPolicy.maximumLength;
  private readonly changeDetector = inject(ChangeDetectorRef);
  private readonly router = inject(Router);
  private readonly onlineListener = (): void => {
    this.isOffline = false;
  };
  private readonly offlineListener = (): void => {
    this.isOffline = true;
  };

  get isParticipantView(): boolean {
    return (
      this.app.activeView === "participant" ||
      this.app.activeView === "system-check" ||
      this.isAttachmentCaptureView ||
      this.isLegalNoticeView
    );
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
    this.app.init(initialView);
    if (!initialView && (this.router.url === "/" || this.router.url === "")) {
      await this.router.navigateByUrl(`/${this.app.getPersistedView()}`, {
        replaceUrl: true
      });
    }
  }

  ngOnDestroy(): void {
    window.removeEventListener("online", this.onlineListener);
    window.removeEventListener("offline", this.offlineListener);
    this.app.destroy();
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
    }
  }

  private getInitialViewFromLocation(): AppView | null {
    const routeSegment = window.location.pathname
      .replace(/^\/app\/?/, "")
      .split("/")
      .at(0);
    return routeViews.find(view => view === routeSegment) ?? null;
  }
}
