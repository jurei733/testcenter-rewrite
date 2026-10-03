import { Component, inject, Injector, type OnDestroy } from "@angular/core";
import { MatButton, MatIconButton } from "@angular/material/button";
import { MatDivider } from "@angular/material/divider";
import { MatMenu, MatMenuTrigger } from "@angular/material/menu";
import type { MatDialogRef } from "@angular/material/dialog";
import { AppShellFacade } from "./app-shell.facade";
import { ParticipantViewFacade } from "./participant-view.facade";
import { OriginalOverlayStylesComponent } from "./original-overlay-styles.component";
import type { OriginalParticipantLogoutDialogComponent } from "./original-participant-logout-dialog.component";
import { parseJsonDocument, readStringValue } from "./rewrite-app-shell.readers";

// Adapted from IQB Testcenter 19's header account panel (MIT).
@Component({
  selector: "app-original-participant-account",
  standalone: true,
  imports: [MatButton, MatIconButton, MatDivider, MatMenu, MatMenuTrigger, OriginalOverlayStylesComponent],
  template: `
    <app-original-overlay-styles />
    @if (view.isParticipantStarter) {
      <button matIconButton id="originalParticipantAccountButton" class="account-button"
        aria-label="Nutzerinformationen" [matMenuTriggerFor]="accountMenu"
        #trigger="matMenuTrigger" data-cy="account-button">
        <svg viewBox="0 -960 960 960" aria-hidden="true"><path d="M367-527q-47-47-47-113t47-113q47-47 113-47t113 47q47 47 47 113t-47 113q-47 47-113 47t-113-47ZM160-160v-112q0-34 17.5-62.5T224-378q62-31 126-46.5T480-440q66 0 130 15.5T736-378q29 15 46.5 43.5T800-272v112H160Zm80-80h480v-32q0-11-5.5-20T700-306q-54-27-109-40.5T480-360q-56 0-111 13.5T260-306q-9 5-14.5 14t-5.5 20v32Zm296.5-343.5Q560-607 560-640t-23.5-56.5Q513-720 480-720t-56.5 23.5Q400-673 400-640t23.5 56.5Q447-560 480-560t56.5-23.5ZM480-640Zm0 400Z"/></svg>
      </button>
      <mat-menu #accountMenu="matMenu" class="original-participant-account-menu">
        <div class="heading">
          <div>Nutzerinformationen</div>
          <button matIconButton aria-label="Nutzerinformationen schließen" (click)="trigger.closeMenu()">
            <svg viewBox="0 -960 960 960" aria-hidden="true"><path d="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z"/></svg>
          </button>
        </div>
        <dl>
          <dt>Anmeldename:</dt><dd id="originalParticipantAccountLogin">{{ view.player.loginLabel }}</dd>
          <dt>Gruppe:</dt><dd id="originalParticipantAccountGroup">{{ view.player.groupLabel }}</dd>
          <dt>Berechtigung:</dt>
          <dd>{{ view.assignedBooklets.length > 1
            ? 'Ausführung/Ansicht von Befragungen oder Testheften'
            : 'Ausführung/Ansicht einer Befragung oder eines Testheftes' }}</dd>
          <dt>Version:</dt><dd>{{ version }}</dd>
        </dl>
        <mat-divider />
        <button matButton="tonal" class="logout-button" id="originalParticipantLogoutButton"
          data-cy="logout-button" [disabled]="view.participantSignOutBusy()"
          (click)="$event.stopPropagation(); confirmSignOut(trigger)"
          [attr.aria-describedby]="view.participantSignOutNotice() ? 'originalParticipantLogoutNotice' : null">Abmelden</button>
        @if (view.participantSignOutNotice()) {
          <p id="originalParticipantLogoutNotice" class="pending-note" role="alert">{{ view.participantSignOutNotice() }}</p>
        }
      </mat-menu>
    }
  `,
  styles: [`
    :host { display: block; position: relative; z-index: 1; }
    .account-button { background: white; color: var(--secondary); border-radius: 12px; }
    svg { height: 24px; width: 24px; fill: currentColor; }
    ::ng-deep :root[data-interface-mode="original"] .original-participant-account-menu { width: 330px; padding: 12px;
      max-width: calc(100vw - 24px); box-sizing: border-box; font-family: 'Nunito Sans', sans-serif; }
    ::ng-deep :root[data-interface-mode="original"] .original-participant-account-menu .heading { display: flex;
      align-items: center; font-size: 22px; }
    ::ng-deep :root[data-interface-mode="original"] .original-participant-account-menu .heading button {
      margin-left: auto; border-radius: 12px; border: 1px solid; }
    ::ng-deep :root[data-interface-mode="original"] .original-participant-account-menu dt { margin-top: 12px; font-weight: 700; }
    ::ng-deep :root[data-interface-mode="original"] .original-participant-account-menu dd { margin-top: 4px; margin-inline-start: 0; }
    ::ng-deep :root[data-interface-mode="original"] .original-participant-account-menu .logout-button {
      margin-top: 12px; border: 1px solid var(--secondary); }
    ::ng-deep :root[data-interface-mode="original"] .original-participant-account-menu svg { height: 24px; width: 24px; fill: currentColor; }
    ::ng-deep :root[data-interface-mode="original"] .original-participant-account-menu .pending-note {
      font-size: 12px; margin-bottom: 0; }
  `],
  styleUrl: "./original-login-theme.scss"
})
export class OriginalParticipantAccountComponent implements OnDestroy {
  readonly view = inject(ParticipantViewFacade);
  readonly app = inject(AppShellFacade);
  private readonly injector = inject(Injector);
  private logoutDialog: MatDialogRef<OriginalParticipantLogoutDialogComponent, boolean> | null = null;
  private openingLogoutDialog = false;
  private destroyed = false;

  async confirmSignOut(trigger: MatMenuTrigger): Promise<void> {
    if (this.logoutDialog || this.openingLogoutDialog || this.view.participantSignOutBusy() || !this.view.isParticipantStarter) return;
    const sessionId = this.view.runtime.participantSessionId.trim();
    this.openingLogoutDialog = true;
    try {
      const [{ MatDialog }, { OriginalParticipantLogoutDialogComponent }] = await Promise.all([
        import("@angular/material/dialog"), import("./original-participant-logout-dialog.component")
      ]);
      if (this.destroyed || this.view.runtime.participantSessionId.trim() !== sessionId) return;
      trigger.closeMenu();
      this.logoutDialog = this.injector.get(MatDialog).open(OriginalParticipantLogoutDialogComponent, {
        panelClass: "original-participant-logout-dialog",
        data: { safeMode: (document.documentElement.dataset["applicationTheme"] ?? "Primar") === "Primar" },
        autoFocus: "dialog", restoreFocus: false,
        ariaLabelledBy: "originalParticipantLogoutTitle", ariaDescribedBy: "originalParticipantLogoutMessage"
      });
      this.logoutDialog.afterClosed().subscribe(accepted => {
        this.logoutDialog = null;
        if (this.destroyed || this.view.runtime.participantSessionId.trim() !== sessionId) return;
        if (!accepted) {
          document.getElementById("originalParticipantAccountButton")?.focus();
          return;
        }
        void this.view.signOutParticipant(sessionId).then(() => {
          if (!this.destroyed && this.view.isParticipantStarter && this.view.participantSignOutNotice()) {
            trigger.openMenu();
            queueMicrotask(() => document.getElementById("originalParticipantLogoutButton")?.focus());
          }
        });
      });
    } catch {
      if (!this.destroyed) this.view.participantSignOutNotice.set("Die Abmeldebestätigung konnte nicht geladen werden. Bitte erneut versuchen.");
    } finally {
      this.openingLogoutDialog = false;
    }
  }

  ngOnDestroy(): void {
    this.destroyed = true;
    this.logoutDialog?.close(false);
  }

  get version(): string {
    const build = readStringValue(parseJsonDocument(this.app.ops.runtimeHealthView),
      ["manifest", "build", "commitSha"]);
    return build ? `Rewrite (${build.slice(0, 12)})` : "Rewrite";
  }
}
