import { CommonModule } from "@angular/common";
import { Component, inject } from "@angular/core";
import type { OnDestroy, OnInit } from "@angular/core";
import { Router, RouterLink, RouterLinkActive, RouterOutlet } from "@angular/router";

import { ActivityFeedComponent } from "./activity-feed.component";
import { AppShellFacade } from "./app-shell.facade";
import { LiveContextComponent } from "./live-context.component";
import type { AppView } from "./rewrite-app-shell.types";
import { SummaryCardsComponent } from "./summary-cards.component";

const routeViews: AppView[] = ["workspace", "content", "runtime", "participant", "ops"];

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
  private readonly router = inject(Router);

  async ngOnInit(): Promise<void> {
    const initialView = this.getInitialViewFromLocation();
    this.app.init(initialView);
    if (!initialView && (this.router.url === "/" || this.router.url === "")) {
      await this.router.navigateByUrl(`/${this.app.getPersistedView()}`, {
        replaceUrl: true
      });
    }
  }

  ngOnDestroy(): void {
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
