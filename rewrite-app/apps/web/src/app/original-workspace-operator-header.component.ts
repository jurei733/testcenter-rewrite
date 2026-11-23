import { Component, Injectable, inject, input, signal, type OnDestroy } from "@angular/core";
import { MatButton, MatIconButton } from "@angular/material/button";
import { MatDialog, MatDialogRef } from "@angular/material/dialog";
import { MatDivider } from "@angular/material/divider";
import { MatMenu, MatMenuTrigger } from "@angular/material/menu";
import { MatToolbar } from "@angular/material/toolbar";
import { MatTooltip } from "@angular/material/tooltip";
import { Router, RouterLink } from "@angular/router";

import { AppShellFacade } from "./app-shell.facade";
import { ApplicationSettingsService } from "./application-settings.service";
import { OriginalParticipantLogoutDialogComponent } from "./original-participant-logout-dialog.component";
import { OriginalWorkspaceFileIconComponent } from "./original-workspace-file-icon.component";
import { RewriteAppUiStateService } from "./rewrite-app-ui-state.service";

@Injectable()
export class OriginalWorkspaceOperatorHeaderState {
  readonly title = signal("Verwaltung");
}

@Component({
  selector: "app-original-workspace-operator-header",
  imports: [
    RouterLink, MatToolbar, MatButton, MatIconButton, MatDivider, MatMenu, MatMenuTrigger,
    MatTooltip, OriginalWorkspaceFileIconComponent
  ],
  templateUrl: "./original-workspace-operator-header.component.html",
  styleUrls: ["./original-login-theme.scss", "./original-workspace-operator-header.component.css"]
})
export class OriginalWorkspaceOperatorHeaderComponent implements OnDestroy {
  readonly headerId = input.required<string>();
  readonly title = input.required<string>();
  readonly app = inject(AppShellFacade);
  readonly settings = inject(ApplicationSettingsService);
  private readonly state = inject(RewriteAppUiStateService);
  private readonly dialogs = inject(MatDialog);
  private readonly router = inject(Router);
  private logout?: MatDialogRef<OriginalParticipantLogoutDialogComponent, boolean>;

  confirmLogout(trigger: MatMenuTrigger): void {
    if (this.logout) return;
    const token = this.state.ops.adminSessionToken;
    trigger.closeMenu();
    this.logout = this.dialogs.open(OriginalParticipantLogoutDialogComponent, {
      panelClass: "original-participant-logout-dialog",
      data: { safeMode: this.settings.settings().themeName === "Primar" },
      autoFocus: "dialog",
      restoreFocus: true,
      ariaLabelledBy: "originalParticipantLogoutTitle",
      ariaDescribedBy: "originalParticipantLogoutMessage"
    });
    this.logout.afterClosed().subscribe(accepted => {
      this.logout = undefined;
      if (!accepted || this.state.ops.adminSessionToken !== token) return;
      void this.app.signOutAdmin().finally(() => {
        if (!this.state.ops.adminSessionToken || this.state.ops.adminSessionToken === token) {
          void this.router.navigateByUrl("/ops");
        }
      });
    });
  }

  ngOnDestroy(): void {
    this.logout?.close(false);
  }
}
