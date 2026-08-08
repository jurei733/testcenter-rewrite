import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";

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
      this.isAttachmentCaptureView
    );
  }

  get isAttachmentCaptureView(): boolean {
    return this.router.url.split("?", 1)[0] === "/attachment-capture";
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

  private getInitialViewFromLocation(): AppView | null {
    const routeSegment = window.location.pathname
      .replace(/^\/app\/?/, "")
      .split("/")
      .at(0);
    return routeViews.find(view => view === routeSegment) ?? null;
  }
}
