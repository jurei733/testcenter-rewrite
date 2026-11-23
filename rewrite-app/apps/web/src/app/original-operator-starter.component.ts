import {
  Component, ElementRef, effect, inject, signal, untracked, viewChild,
  type AfterViewInit, type OnDestroy
} from "@angular/core";
import { MatButton } from "@angular/material/button";
import { Router, RouterLink } from "@angular/router";
import type { OriginalOperatorWorkspaceChoice } from "@testcenter-rewrite-app/contracts";

import { AppComponent } from "./app.component";
import { ApplicationSettingsService } from "./application-settings.service";
import { NativeMonitorIconComponent } from "./native-monitor/native-monitor-icon.component";
import { TestCardComponent } from "./native-participant/starter/test-card.component";
import { AssetService } from "./native-participant/shared/services/asset.service";
import { OriginalOverlayStylesComponent } from "./original-overlay-styles.component";
import { OriginalWorkspaceFileNoticeComponent } from "./original-workspace-file-notice.component";
import { RewriteAppOpsService } from "./rewrite-app-ops.service";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";
import { RewriteAppViewStateService } from "./rewrite-app-view-state.service";

@Component({
  selector: "app-original-operator-starter",
  imports: [
    MatButton, RouterLink, TestCardComponent, OriginalWorkspaceFileNoticeComponent,
    OriginalOverlayStylesComponent, NativeMonitorIconComponent
  ],
  providers: [AssetService],
  templateUrl: "./original-operator-starter.component.html",
  styleUrls: ["./original-login-theme.scss", "./original-operator-starter.component.css"]
})
export class OriginalOperatorStarterComponent implements AfterViewInit, OnDestroy {
  readonly shell = inject(AppComponent);
  readonly settings = inject(ApplicationSettingsService);
  readonly choices = signal<OriginalOperatorWorkspaceChoice[]>([]);
  readonly loading = signal(true);
  readonly failed = signal(false);
  readonly showScrollButton = signal(false);
  private readonly scroller = inject<ElementRef<HTMLElement>>(ElementRef).nativeElement;
  private readonly sentinel = viewChild.required<ElementRef<HTMLElement>>("bottomSentinel");
  private readonly observer = new IntersectionObserver(([entry]) => {
    this.showScrollButton.set(!entry.isIntersecting);
  });
  private readonly ops = inject(RewriteAppOpsService);
  private readonly state = inject(RewriteAppUiStateService);
  private readonly viewState = inject(RewriteAppViewStateService);
  private readonly router = inject(Router);
  // The password-change flow can update the current session without leaving this route.
  private identity?: { token: string; passwordChangeRequired: boolean };

  constructor() {
    effect(() => {
      this.state.renderVersion();
      const token = this.state.ops.adminSessionToken;
      const signedIn = this.state.adminSessionActive();
      const passwordChangeRequired = this.shell.app.requiresAdminPasswordChange;
      if (!signedIn || !token) {
        void this.router.navigateByUrl("/ops?ui=original", { replaceUrl: true });
        return;
      }
      if (this.identity?.token === token && this.identity.passwordChangeRequired === passwordChangeRequired) return;
      this.identity = { token, passwordChangeRequired };
      untracked(() => void this.loadChoices());
    });
  }

  ngAfterViewInit(): void {
    this.observer.observe(this.sentinel().nativeElement);
  }

  ngOnDestroy(): void {
    this.observer.disconnect();
  }

  scrollDown(): void {
    this.scroller.scrollBy({ top: 300, behavior: "smooth" });
  }

  async loadChoices(): Promise<void> {
    const identity = this.identity;
    if (!identity) return;
    this.choices.set([]);
    this.loading.set(true);
    this.failed.set(false);
    try {
      const session = await this.ops.refreshAdminSession({
        publishOriginalRights: true,
        includeOriginalWorkspaceChoices: true
      });
      if (this.identity !== identity || this.state.ops.adminSessionToken !== identity.token) return;
      this.choices.set(session?.originalWorkspaceChoices ?? []);
    } catch {
      if (this.identity === identity) this.failed.set(true);
    } finally {
      if (this.identity === identity) this.loading.set(false);
    }
  }

  openWorkspace(choice: OriginalOperatorWorkspaceChoice): void {
    if (this.state.ops.adminSessionToken !== this.identity?.token ||
        !this.choices().includes(choice) || this.shell.app.requiresAdminPasswordChange ||
        (choice.mode !== "RO" && choice.mode !== "RW")) return;
    this.state.workspace.tenantKey = choice.tenantKey;
    this.state.workspace.workspaceKey = choice.workspaceKey;
    this.viewState.persistShellState();
    void this.router.navigate(["/content"], {
      queryParams: { ui: "original", tab: "files", tenant: choice.tenantKey, workspace: choice.workspaceKey }
    });
  }
}
